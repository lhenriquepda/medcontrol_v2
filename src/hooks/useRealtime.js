import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import { fetchDashboard } from '../services/fetchDashboard'

/**
 * useRealtime — Refactor Sync v2 Fase 4 (v0.2.7.0).
 *
 * Substitui versão anterior (275 linhas, gate-aware, debounce 2.5s, watchdog
 * 60s, generation counter, reconnect backoff) por wrapper mínimo.
 *
 * Princípio P6 (Refactor_Sync_v2.md §2): Realtime é HINT, não fonte.
 * Cliente nunca aplica payload Realtime direto no cache — sempre agenda
 * refetch debounced. fetchDashboard() (Fase 2) carrega fresh data + popula
 * Zustand stores. Idempotência server-side (mutation_log, Fase 3) cobre
 * race conditions entre mutation otimista e refetch.
 *
 * Comportamento:
 *   - Subscribe quando user logado + Supabase configurado
 *   - postgres_changes em doses/patients/treatments/sos_rules/treatment_templates/patient_shares
 *     → scheduleRefetch (debounce 1.5s)
 *   - Auto-reconnect via Supabase JS (heartbeatIntervalMs 30s configurado em supabase.js)
 *   - Outras tables (sos_rules, etc) invalidam queries TanStack — não usam Zustand stores
 *
 * Removido:
 *   - realtimeGate.isInFlight check (Fase 4 deleta o gate)
 *   - versionedCache reconcileDoses (Fase 4 deleta)
 *   - generation counter / lock manual (delegado pra Supabase JS internals)
 *   - watchdog timer (heartbeat sessionManager cobre auth; Supabase JS cobre WebSocket)
 */
const SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'public'
const REFETCH_DEBOUNCE_MS = 1500

// Tables que disparam refetch do dashboard (afetam doses/patients/treatments).
const DASHBOARD_TABLES = ['doses', 'patients', 'treatments', 'patient_shares']
// Tables que só invalidam TanStack queries (não tocam stores Zustand).
const TANSTACK_TABLES_TO_KEYS = {
  sos_rules: [['sos_rules']],
  treatment_templates: [['templates']],
}

export function useRealtime() {
  const qc = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    if (!hasSupabase || !user) return

    let refetchTimer = null
    const tanstackTimers = new Map()
    let channel = null

    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer)
      refetchTimer = setTimeout(() => {
        refetchTimer = null
        fetchDashboard().catch(e => console.warn('[useRealtime] fetchDashboard fail:', e?.message))
      }, REFETCH_DEBOUNCE_MS)
    }

    const scheduleInvalidate = (queryKey) => {
      const k = JSON.stringify(queryKey)
      if (tanstackTimers.has(k)) clearTimeout(tanstackTimers.get(k))
      tanstackTimers.set(k, setTimeout(() => {
        tanstackTimers.delete(k)
        qc.invalidateQueries({ queryKey })
      }, REFETCH_DEBOUNCE_MS))
    }

    const chanName = `realtime:${user.id}:${Date.now()}`
    channel = supabase.channel(chanName)

    // Subscribe pra tables que afetam dashboard.
    for (const table of DASHBOARD_TABLES) {
      const filter = table === 'patient_shares'
        ? `sharedWithUserId=eq.${user.id}`  // recurso multi-user
        : `userId=eq.${user.id}`
      channel.on('postgres_changes', {
        event: '*', schema: SCHEMA, table, filter,
      }, scheduleRefetch)
    }

    // Subscribe pra tables que só invalidam queries TanStack.
    for (const [table, queryKeys] of Object.entries(TANSTACK_TABLES_TO_KEYS)) {
      channel.on('postgres_changes', {
        event: '*', schema: SCHEMA, table, filter: `userId=eq.${user.id}`,
      }, () => {
        for (const k of queryKeys) scheduleInvalidate(k)
      })
    }

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[useRealtime] channel ${status}`)
        // Supabase JS auto-reconnect via reconnectAfterMs config em supabase.js.
      }
    })

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer)
      for (const t of tanstackTimers.values()) clearTimeout(t)
      tanstackTimers.clear()
      if (channel) {
        supabase.removeChannel(channel).catch(() => { /* ignore */ })
      }
    }
  }, [user, qc])
}
