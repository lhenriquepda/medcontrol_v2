import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { hasSupabase, supabase } from '../services/supabase'
import { useAuth } from './useAuth'

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
// v0.2.2.2 (#212) — 60s → 300s. Audit revelou storm rescheduleAll cadência 60s
// gatilhado por watchdog reconnect cycle (channel state !== 'joined' em Android
// Doze + token refresh window → force reconnect → refetchQueries ['doses'] →
// useEffect App.jsx detecta new data ref → scheduleDoses → rescheduleAll storm).
// 5min reduz frequência 5×. Status callbacks (CLOSED/CHANNEL_ERROR/TIMED_OUT)
// continuam funcionando — watchdog é só safety net pra silent fail (heartbeat
// parou mas status não disparou). Item separado: investigar pq channel state
// não é 'joined' a cada watchdog tick em S25 Ultra.
const WATCHDOG_INTERVAL_MS = 300_000 // 5min — verifica saúde do channel

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

    // Item #136 (egress-audit-2026-05-05 F2): debounce invalidateQueries 1s
    // por queryKey. Cron extend_continuous_treatments insere 100s doses
    // futuras em batch — sem debounce, 100 invalidates → 100 × 4 useDoses
    // Dashboard refetches em rajada. Com debounce: 1 invalidate = 4 refetches.
    // Estimado -15% a -25% egress (especialmente dias de cron).
    const invalidateTimers = new Map()
    const debouncedInvalidate = (queryKey) => {
      const k = JSON.stringify(queryKey)
      if (invalidateTimers.has(k)) clearTimeout(invalidateTimers.get(k))
      invalidateTimers.set(k, setTimeout(() => {
        qc.invalidateQueries({ queryKey })
        invalidateTimers.delete(k)
      }, 1000))
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
    // força reconnect. Roda a cada 60s.
    const startWatchdog = () => {
      watchdogTimer = setInterval(async () => {
        if (!channel) return
        const state = channel.state
        if (state !== 'joined' && state !== 'joining') {
          console.warn(`[useRealtime] watchdog: state=${state} → force reconnect`)
          await unsubscribe()
          await subscribe()
          // #145 (release v0.2.0.11): scoped refetch active-only após watchdog reconnect.
          // Mesma rationale do onStatusChange. Watchdog dispara mais raramente
          // (intervalos de 60s), mas mesma economia aplica.
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
