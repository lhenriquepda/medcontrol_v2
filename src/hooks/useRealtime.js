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
const WATCHDOG_INTERVAL_MS = 60_000 // 60s — verifica saúde do channel

export function useRealtime() {
  const qc = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    if (!hasSupabase || !user) return

    let channel = null
    let watchdogTimer = null
    let reconnectAttempts = 0
    let generation = 0 // #093: ignora callbacks de canais antigos

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
          // #092: invalidate APENAS keys relevantes (não ALL queries) durante reconnect
          for (const keys of Object.values(TABLE_TO_KEYS)) {
            for (const key of keys) qc.invalidateQueries({ queryKey: key })
          }
        }, delay)
      }
    }

    const subscribe = async () => {
      if (channel) return
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
        ch.on('postgres_changes', opts, () => {
          if (myGen !== generation) return // callback de canal antigo
          // #092: invalidate APENAS keys da tabela mudada
          for (const key of TABLE_TO_KEYS[table]) {
            qc.invalidateQueries({ queryKey: key })
          }
        })
      }
      ch.subscribe(onStatusChange(myGen))
      channel = ch
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
          for (const keys of Object.values(TABLE_TO_KEYS)) {
            for (const key of keys) qc.invalidateQueries({ queryKey: key })
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
          for (const keys of Object.values(TABLE_TO_KEYS)) {
            for (const key of keys) qc.invalidateQueries({ queryKey: key })
          }
        })
      }
      setupListeners()
    }

    return () => {
      if (watchdogTimer) clearInterval(watchdogTimer)
      unsubscribe() // fire-and-forget no unmount (sync cleanup boundary)
      authSub?.subscription?.unsubscribe?.()
      pauseHandle?.remove()
      resumeHandle?.remove()
    }
  }, [qc, user])
}
