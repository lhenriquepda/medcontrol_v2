import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'
import { useAuth } from './useAuth'

const SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'public'

// Mapeia tabela -> queryKeys a invalidar
const TABLE_TO_KEYS = {
  patients: [['patients']],
  treatments: [['treatments'], ['doses']],
  doses: [['doses']],
  sos_rules: [['sos_rules']],
  treatment_templates: [['templates']],
  subscriptions: [['my_tier'], ['admin_users']]
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
    const channel = supabase.channel(`realtime:${user.id}`)

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
    return () => { supabase.removeChannel(channel) }
  }, [qc, user])
}
