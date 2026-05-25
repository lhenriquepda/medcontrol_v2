import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import { fetchDashboard } from '../services/fetchDashboard'
import { useRealtimeManager } from './useRealtimeManager'
import { realtimeManager } from '../core/realtime/manager'
import { useAccessiblePatientIds } from './useAccessiblePatientIds'

/**
 * useRealtime — Refactor Sync v2 Fase 4 (v0.2.7.0) + Gemini Fase 4 ADR-016 (v0.2.8.2)
 *   + Opção D cross-account (v0.2.8.3).
 *
 * Princípio P6 (Refactor_Sync_v2.md §2): Realtime é HINT, não fonte. Cliente
 * nunca aplica payload Realtime direto no cache — sempre agenda refetch debounced.
 *
 * v0.2.8.3 Opção D — cross-account funcional:
 *   Filter `patientId.in.(uuid1,uuid2,...)` em doses/treatments/patients cobre
 *   pacientes próprios + compartilhados (recebidos). Cuidador (sharedWithUserId)
 *   recebe eventos quando dono modifica dose, fechando o gap descoberto em QA
 *   v0.2.8.2 (filter `userId.eq.${user.id}` só pegava eventos do próprio user).
 *
 *   patient_shares mantém filters duplos por ownerId OR sharedWithUserId
 *   (cobre criação/revogação de share de qualquer lado).
 *
 * Gate triplo:
 *   1. RealtimeManager.isActive — feature flag + visibility + idle + auth + network
 *   2. hasCollabContext — user tem ≥1 share enviado OU ≥1 share recebido (cuidador-mode)
 *   3. patientIds.length > 0 — sem patients acessíveis, sem nada pra observar
 *
 * User solo (sem share enviado/recebido): hasCollabContext=false → skip subscribe → 0 egress.
 *
 * Re-subscribe automático quando patientIds muda (novo share criado/revogado) via dep array.
 */
const SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'public'
const REFETCH_DEBOUNCE_MS = 1500

// Tables que afetam dashboard — filtrar por patientId (cross-account)
const DASHBOARD_TABLES_BY_PATIENT = ['doses', 'treatments', 'patients']
// Tables que só invalidam TanStack queries (não tocam stores Zustand).
const TANSTACK_TABLES_TO_KEYS = {
  sos_rules: [['sos_rules']],
  treatment_templates: [['templates']],
}

export function useRealtime() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { isActive } = useRealtimeManager()
  const { patientIds, hasCollabContext } = useAccessiblePatientIds()

  // Stringify pra usar em dep array (array reference change recriaria subscription a cada render)
  const patientIdsKey = patientIds.join(',')

  useEffect(() => {
    // Gate triplo (ADR-016 v2 cross-account):
    //   1. Manager: flag enabled + não pausado
    //   2. hasCollabContext: user é dono que compartilhou OR cuidador que recebeu share
    //   3. patientIds não vazio
    if (!hasSupabase || !user || !isActive || !hasCollabContext || patientIds.length === 0) return

    let refetchTimer = null
    const tanstackTimers = new Map()
    let channel = null

    const scheduleRefetch = (payload) => {
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

    // Filter cross-account: patientId IN (lista UUIDs próprios + compartilhados)
    // Supabase Realtime postgres_changes suporta `in` clause oficialmente
    const patientFilter = `patientId=in.(${patientIds.join(',')})`

    for (const table of DASHBOARD_TABLES_BY_PATIENT) {
      // patients table usa `id`, não `patientId`
      const filter = table === 'patients'
        ? `id=in.(${patientIds.join(',')})`
        : patientFilter
      channel.on('postgres_changes', {
        event: '*', schema: SCHEMA, table, filter,
      }, scheduleRefetch)
    }

    // patient_shares: 2 subscriptions (user pode ser owner OU recipient)
    channel.on('postgres_changes', {
      event: '*', schema: SCHEMA, table: 'patient_shares', filter: `ownerId=eq.${user.id}`,
    }, scheduleRefetch)
    channel.on('postgres_changes', {
      event: '*', schema: SCHEMA, table: 'patient_shares', filter: `sharedWithUserId=eq.${user.id}`,
    }, scheduleRefetch)

    // Tables TanStack-only (sos_rules, treatment_templates) — escopo só do próprio user
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
    // patientIdsKey usado em vez de patientIds[] pra estabilizar dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, qc, isActive, hasCollabContext, patientIdsKey])
}
