import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { hasSupabase, supabase } from '../services/supabase'
import { useAuth } from './useAuth'

const SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'public'

// Mapeia tabela -> queryKeys a invalidar
const TABLE_TO_KEYS = {
  patients: [['patients']],
  treatments: [['treatments'], ['doses'], ['user_medications']],
  doses: [['doses']],
  sos_rules: [['sos_rules']],
  treatment_templates: [['templates']],
  subscriptions: [['my_tier'], ['admin_users']],
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
 * em Android Doze. User: "idoso não fecha app, idle deve ser ilimitado".
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

    const onStatusChange = (status) => {
      // status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT'
      if (status === 'SUBSCRIBED') {
        reconnectAttempts = 0 // success — reset backoff
        return
      }
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Bad state — reconnect with backoff
        reconnectAttempts++
        const delay = Math.min(1_000 * Math.pow(2, reconnectAttempts), 30_000)
        console.warn(`[useRealtime] status=${status} attempt=${reconnectAttempts} reconnect in ${delay}ms`)
        setTimeout(() => {
          if (!user) return
          unsubscribe()
          subscribe()
          // Refetch — data pode estar stale durante reconnect window
          qc.invalidateQueries()
        }, delay)
      }
    }

    const subscribe = () => {
      if (channel) return
      channel = supabase.channel(`realtime:${user.id}`)
      for (const table of Object.keys(TABLE_TO_KEYS)) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: SCHEMA, table },
          () => {
            for (const key of TABLE_TO_KEYS[table]) {
              qc.invalidateQueries({ queryKey: key })
            }
          }
        )
      }
      channel.subscribe(onStatusChange)
    }

    const unsubscribe = () => {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }

    // Watchdog: detecta silent fail (heartbeat parou mas status callback
    // não disparou). Verifica channel.state — se !== 'joined' mas deveria estar,
    // força reconnect. Roda a cada 60s.
    const startWatchdog = () => {
      watchdogTimer = setInterval(() => {
        if (!channel) return
        const state = channel.state // 'joined' | 'closed' | 'errored' | 'leaving' | 'joining'
        if (state !== 'joined' && state !== 'joining') {
          console.warn(`[useRealtime] watchdog: state=${state} → force reconnect`)
          unsubscribe()
          subscribe()
          qc.invalidateQueries()
        }
      }, WATCHDOG_INTERVAL_MS)
    }

    subscribe()
    startWatchdog()

    // Item #077 (release v0.1.7.0) — resubscribe ao Supabase rotacionar JWT.
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        unsubscribe()
        subscribe()
      }
    })

    // Native lifecycle: drop channel on background, resubscribe + invalidate on foreground
    let pauseHandle, resumeHandle
    if (Capacitor.isNativePlatform()) {
      const setupListeners = async () => {
        pauseHandle = await CapacitorApp.addListener('pause', () => {
          // Pausa watchdog + drop channel — economia bateria background
          if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null }
          unsubscribe()
        })
        resumeHandle = await CapacitorApp.addListener('resume', () => {
          subscribe()
          if (!watchdogTimer) startWatchdog()
          qc.invalidateQueries()
        })
      }
      setupListeners()
    }

    return () => {
      if (watchdogTimer) clearInterval(watchdogTimer)
      unsubscribe()
      authSub?.subscription?.unsubscribe?.()
      pauseHandle?.remove()
      resumeHandle?.remove()
    }
  }, [qc, user])
}
