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
 */
export function useRealtime() {
  const qc = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    if (!hasSupabase || !user) return

    let channel = null

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
      channel.subscribe()
    }

    const unsubscribe = () => {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }

    subscribe()

    // Native lifecycle: drop channel on background, resubscribe + invalidate on foreground
    let pauseHandle, resumeHandle
    if (Capacitor.isNativePlatform()) {
      const setupListeners = async () => {
        pauseHandle = await CapacitorApp.addListener('pause', () => {
          unsubscribe()
        })
        resumeHandle = await CapacitorApp.addListener('resume', () => {
          subscribe()
          // Force refetch — data may be stale after backgrounding
          qc.invalidateQueries()
        })
      }
      setupListeners()
    }

    return () => {
      unsubscribe()
      pauseHandle?.remove()
      resumeHandle?.remove()
    }
  }, [qc, user])
}
