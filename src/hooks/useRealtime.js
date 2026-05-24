import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { hasSupabase, supabase } from '../services/supabase'
import { useAuth } from './useAuth'
// Refactor Fase 1 (Refactor_Full.md §4.1) — gate previne Realtime sobrescrever
// optimistic em curso. Mutation marca queryKey como in-flight no onMutate;
// Realtime descarta invalidate enquanto in-flight.
import { isInFlight } from '../state/realtimeGate'

const SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'public'

// Mapeia tabela -> queryKeys a invalidar
// #092 (release v0.1.7.5): subscriptions removido — admin-only writes, raras
// (tier change manual). User pode refresh ou re-login. Não vale custo realtime
// + 1 channel registration / user × 10k users.
const TABLE_TO_KEYS = {
  patients: [['patients']],
  treatments: [['treatments'], ['doses'], ['user_medications']],
  doses: [['doses']],
  sos_rules: [['sos_rules']],
  treatment_templates: [['templates']],
  patient_shares: [['patient_shares'], ['patients']]
}

/**
 * Subscribes to realtime Postgres changes on medcontrol schema,
 * invalidating React Query caches so UI updates instantly without
 * needing to navigate away and back.
 *
 * Item #079 (release v0.1.7.1) — defense-in-depth caminho 1 de 3.
 * Heartbeat detection + watchdog + reconnect com backoff. Endereça
 * BUG-016 onde websocket morria silently durante idle longo (~16min)
 * em Android Doze.
 *
 * Item #093 (release v0.1.7.5) — race condition fix:
 *   1. Channel name uses uuid per-subscribe (não reusa nome durante reconnect)
 *   2. removeChannel awaitado (era fire-and-forget)
 *   3. Generation counter ignora callbacks de canais antigos
 *
 * Item #092 (release v0.1.7.5) — egress reduction:
 *   1. postgres_changes filter server-side por userId (evita streaming
 *      changes de TODOS users pra TODOS clients — multi-tenant fix)
 *   2. invalidateQueries scoped por table (era invalidate ALL queries)
 *   3. patient_shares fica sem filter (multi-user resource — necessário
 *      receber notif quando outro user compartilha paciente comigo)
 */
// v0.2.6.9 FIX UI-LENTA — 300s → 60s.
// Bug crônico: user reportou app fica lento + mutations não persistem em <5min.
// Watchdog 300s não detectava WebSocket morto dentro dessa janela. Combinado com
// degradação ativa (sem trigger visibility) → Realtime morre invisivelmente,
// futuras invalidates Postgres changes nunca chegam, UI fica stale.
// 60s tick + connection state check direto pega esses casos.
// Tradeoff #212 (rescheduleAll storm pós-reconnect) mitigado por: (a) scheduleDoses
// debounce em App.jsx, (b) refetchQueries scoped 'active', (c) heartbeat useAppResume
// que também drena qc.refetchQueries — overlap intencional pra cobertura.
const WATCHDOG_INTERVAL_MS = 60_000

export function useRealtime() {
  const qc = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    if (!hasSupabase || !user) return

    let channel = null
    let watchdogTimer = null
    let reconnectAttempts = 0
    let generation = 0 // #093: ignora callbacks de canais antigos
    // Item #109 BUG-037: lock evita concurrent subscribe() de paths múltiplos
    // (status reconnect + watchdog + TOKEN_REFRESHED + native resume convergindo).
    // Sem lock, 2+ subscribes paralelos disputam Supabase channel state, alguns
    // ch.on() chamados após .subscribe() interno do supabase-js → throws
    // "cannot add postgres_changes callbacks for realtime:..." (Sentry DOSY-9).
    let subscribing = false

    // Item #136 (egress-audit-2026-05-05 F2): debounce invalidateQueries por
    // queryKey. Cron extend_continuous_treatments insere 100s doses futuras em
    // batch — sem debounce, 100 invalidates → 100 × 4 useDoses Dashboard
    // refetches em rajada. Com debounce: 1 invalidate = 4 refetches.
    //
    // Refactor Fase 1: debounce subiu de 1000ms pra 2500ms.
    //   1) Alinha com LATENCY_BUDGET_MS do realtimeGate — Realtime espera a
    //      mutation drenar antes de pensar em invalidar.
    //   2) Mutation refetch (mutationRegistry.js refetchDoses) usa 1500ms.
    //      Garantia: mutation onSettled sempre vence Realtime invalidate.
    //   3) Skip explícito se queryKey está no gate (defesa em profundidade).
    const invalidateTimers = new Map()
    const debouncedInvalidate = (queryKey) => {
      const k = JSON.stringify(queryKey)
      if (invalidateTimers.has(k)) clearTimeout(invalidateTimers.get(k))
      invalidateTimers.set(k, setTimeout(() => {
        invalidateTimers.delete(k)
        // Gate: descarta payload se mutation em flight pra essa key.
        // Mutation onSettled vai disparar o refetch correto na sequência.
        if (isInFlight(queryKey)) {
          // Não logar em produção — log spam em paciente compartilhado ativo.
          if (import.meta.env.DEV) {
            console.log(`[useRealtime] skip invalidate ${k} (in-flight mutation)`)
          }
          return
        }
        qc.invalidateQueries({ queryKey })
      }, 2500))
    }

    const onStatusChange = (myGen) => (status) => {
      if (myGen !== generation) return // canal antigo — ignore
      // status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT'
      if (status === 'SUBSCRIBED') {
        reconnectAttempts = 0
        return
      }
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reconnectAttempts++
        const delay = Math.min(1_000 * Math.pow(2, reconnectAttempts), 30_000)
        console.warn(`[useRealtime] status=${status} attempt=${reconnectAttempts} reconnect in ${delay}ms`)
        setTimeout(async () => {
          if (!user) return
          await unsubscribe()
          await subscribe()
          // #145 (release v0.2.0.11): refetch SCOPED a queries ATIVAS apenas.
          // Antes (#092): invalidateQueries blanket → marcava stale tudo,
          // forçava refetch em mount mesmo quando query não-mounted (ie. user
          // foi pra Settings durante disconnect → patients query stale → refetch
          // imediato ao voltar Dashboard, sem necessidade).
          // Agora: só ativas (com observers ativos) refetcham. Inactive queries
          // ficam como estão — vão refetch natural ao montar.
          for (const keys of Object.values(TABLE_TO_KEYS)) {
            for (const key of keys) {
              qc.refetchQueries({ queryKey: key, type: 'active' })
            }
          }
        }, delay)
      }
    }

    const subscribe = async () => {
      // #109: lock + check existing channel — evita concurrent subscribe race.
      if (channel || subscribing) return
      subscribing = true
      try {
        generation++
        const myGen = generation
        // #093: nome único por subscribe — evita race com removeChannel async
        const chanName = `realtime:${user.id}:${myGen}:${Date.now()}`
        const ch = supabase.channel(chanName)
        for (const table of Object.keys(TABLE_TO_KEYS)) {
          // #092: filter postgres_changes server-side por userId.
          // Sem filter, Realtime stream MUDA TODAS rows pra TODOS clients
          // conectados (multi-tenant egress nuke). Filter força broker
          // rotear apenas changes do meu userId.
          // Exceção: patient_shares (recurso multi-user — preciso saber
          // quando alguém compartilha paciente comigo).
          const opts = { event: '*', schema: SCHEMA, table }
          if (table !== 'patient_shares') {
            opts.filter = `userId=eq.${user.id}`
          }
          // #109: try/catch defensive — se channel state transitou pra
          // 'subscribed' antes desse loop terminar (race interno supabase-js),
          // .on() throws. Logamos warning sem crashar setup do canal inteiro.
          try {
            ch.on('postgres_changes', opts, () => {
              if (myGen !== generation) return // callback de canal antigo
              // #092: invalidate APENAS keys da tabela mudada
              // #136: debounced 1s — múltiplos changes em <1s consolidam
              for (const key of TABLE_TO_KEYS[table]) {
                debouncedInvalidate(key)
              }
            })
          } catch (e) {
            console.warn(`[useRealtime] ch.on(${table}) failed:`, e?.message)
          }
        }
        ch.subscribe(onStatusChange(myGen))
        channel = ch
      } finally {
        subscribing = false
      }
    }

    const unsubscribe = async () => {
      const ch = channel
      channel = null
      if (ch) {
        // #093: await removeChannel — era fire-and-forget
        try { await supabase.removeChannel(ch) } catch (e) { console.warn('[useRealtime] removeChannel:', e) }
      }
    }

    // Watchdog: detecta silent fail (heartbeat parou mas status callback
    // não disparou). Verifica channel.state — se !== 'joined' mas deveria estar,
    // força reconnect. Roda a cada 60s (v0.2.6.9 fix UI-lenta).
    //
    // v0.2.6.9 ADIÇÃO — também checa supabase.realtime.connection state direto.
    // Caso onde channel.state="joined" mas WebSocket subjacente está CLOSED:
    // supabase-js mantém referência do channel mas socket morreu silently.
    // Sem este check, watchdog não dispara reconnect → invalidates Postgres
    // changes nunca chegam.
    const startWatchdog = () => {
      watchdogTimer = setInterval(async () => {
        if (!channel) return
        const channelState = channel.state
        // Check WebSocket subjacente. supabase-js v2: `supabase.realtime.connectionState()`
        // retorna 'connecting' | 'open' | 'closing' | 'closed'. Cobertura defensiva
        // pra APIs que mudam entre versões: try/catch + fallback string check.
        let wsState = 'unknown'
        try {
          if (typeof supabase.realtime?.connectionState === 'function') {
            wsState = supabase.realtime.connectionState()
          } else if (supabase.realtime?.conn?.readyState != null) {
            const rs = supabase.realtime.conn.readyState
            wsState = rs === 0 ? 'connecting' : rs === 1 ? 'open' : rs === 2 ? 'closing' : 'closed'
          }
        } catch { /* ignore */ }
        const channelUnhealthy = channelState !== 'joined' && channelState !== 'joining'
        const wsUnhealthy = wsState === 'closed' || wsState === 'closing'
        if (channelUnhealthy || wsUnhealthy) {
          console.warn(`[useRealtime] watchdog: channel=${channelState} ws=${wsState} → force reconnect`)
          await unsubscribe()
          await subscribe()
          // #145 (release v0.2.0.11): scoped refetch active-only após watchdog reconnect.
          for (const keys of Object.values(TABLE_TO_KEYS)) {
            for (const key of keys) {
              qc.refetchQueries({ queryKey: key, type: 'active' })
            }
          }
        }
      }, WATCHDOG_INTERVAL_MS)
    }

    subscribe()
    startWatchdog()

    // Item #077 (release v0.1.7.0) — resubscribe ao Supabase rotacionar JWT.
    const { data: authSub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        await unsubscribe()
        await subscribe()
      }
    })

    // Native lifecycle: drop channel on background, resubscribe + invalidate on foreground
    let pauseHandle, resumeHandle
    if (Capacitor.isNativePlatform()) {
      const setupListeners = async () => {
        pauseHandle = await CapacitorApp.addListener('pause', async () => {
          if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null }
          await unsubscribe()
        })
        resumeHandle = await CapacitorApp.addListener('resume', async () => {
          await subscribe()
          if (!watchdogTimer) startWatchdog()
          // Item #135 (egress-audit-2026-05-05 F6): invalidate ALL keys removido.
          // Resubscribe + Realtime postgres_changes events trazem updates pós-
          // resume automaticamente. useAppResume long-idle (>=5min) já cobre
          // refetch active queries. Estimado -5% a -10% egress.
        })
      }
      setupListeners()
    }

    return () => {
      if (watchdogTimer) clearInterval(watchdogTimer)
      // #136: limpa pending debounce timers
      for (const t of invalidateTimers.values()) clearTimeout(t)
      invalidateTimers.clear()
      unsubscribe() // fire-and-forget no unmount (sync cleanup boundary)
      authSub?.subscription?.unsubscribe?.()
      pauseHandle?.remove()
      resumeHandle?.remove()
    }
  }, [qc, user])
}
