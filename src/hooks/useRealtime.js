import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import { fetchDashboard } from '../services/fetchDashboard'
import { useRealtimeManager } from './useRealtimeManager'
import { realtimeManager } from '../core/realtime/manager'

/**
 * useRealtime — Refactor Sync v2 Fase 4 (v0.2.7.0) + Gemini Fase 4 ADR-016 (v0.2.8.2).
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
 *   - Subscribe quando user logado + Supabase configurado + RealtimeManager.isActive
 *     (feature flag `realtime_enabled` true + não pausado por visibility/idle/etc)
 *   - postgres_changes em doses/patients/treatments/sos_rules/treatment_templates/patient_shares
 *     → scheduleRefetch (debounce 1.5s) + realtimeManager.trackMessageReceived(table)
 *   - Auto-reconnect via Supabase JS (heartbeatIntervalMs 30s configurado em supabase.js)
 *   - Outras tables (sos_rules, etc) invalidam queries TanStack — não usam Zustand stores
 *
 * Gemini Fase 4 ADR-016 (v0.2.8.2):
 *   - Gate via RealtimeManager: subscribe só se isActive=true
 *   - Quando isActive vira false → cleanup automático via useEffect deps
 *   - 5 salvaguardas (visibility/idle/feature flag/canal único/telemetria) em manager.js
 *
 * Removido:
 *   - realtimeGate.isInFlight check (Fase 4 v0.2.7.0 deleta o gate)
 *   - versionedCache reconcileDoses (Fase 4 v0.2.7.0 deleta)
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
  const { isActive } = useRealtimeManager()

  useEffect(() => {
    // ADR-016 gate: só subscribe se manager autoriza
    // (feature flag enabled + não pausado por visibility/idle/auth/network)
    if (!hasSupabase || !user || !isActive) return

    let refetchTimer = null
    const tanstackTimers = new Map()
    let channel = null

    const scheduleRefetch = (payload) => {
      // Telemetria PostHog throttled (ADR-016 salvaguarda E)
      try { realtimeManager.trackMessageReceived(payload?.table) } catch { /* */ }
      if (refetchTimer) clearTimeout(refetchTimer)
      refetchTimer = setTimeout(() => {
        refetchTimer = null
        fetchDashboard().catch(e => console.warn('[useRealtime] fetchDashboard fail:', e?.message))
      }, REFETCH_DEBOUNCE_MS)
    }

    const scheduleInvalidate = (queryKey, payload) => {
      try { realtimeManager.trackMessageReceived(payload?.table) } catch { /* */ }
      const k = JSON.stringify(queryKey)
      if (tanstackTimers.has(k)) clearTimeout(tanstackTimers.get(k))
      tanstackTimers.set(k, setTimeout(() => {
        tanstackTimers.delete(k)
        qc.invalidateQueries({ queryKey })
      }, REFETCH_DEBOUNCE_MS))
    }

    const chanName = `realtime:${user.id}:${Date.now()}`
    channel = supabase.channel(chanName)

    // Subscribe pra tables que afetam dashboard (canal único — ADR-016 salvaguarda D)
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
      }, (payload) => {
        for (const k of queryKeys) scheduleInvalidate(k, payload)
      })
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        try { realtimeManager.trackSubscribed(chanName) } catch { /* */ }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
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
  }, [user, qc, isActive])
}
