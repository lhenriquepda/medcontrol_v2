/**
 * useTreatmentAlertLevel — v0.2.6.1 P3.4 (Roteiro_Alinhamento_Dosy_v2).
 *
 * Per-user-per-treatment override do nível de alerta:
 *   - 'critical' → alarme cheio (default, comportamento atual quando switch global ON)
 *   - 'push'     → só push silencioso (sem som, sem fullscreen)
 *   - 'silent'   → silencioso total (apenas no histórico)
 *
 * Sem entry no DB = 'critical' default (mantém comportamento atual).
 *
 * Server: tabela `medcontrol.treatment_user_alert_settings (treatment_id, user_id,
 * alert_level)` + RPCs `set_treatment_alert_level(treatment_id, alert_level)` e
 * `get_treatment_alert_levels()` (RLS per-user-self).
 *
 * Edge handler P3.20 (futuro) re-agenda alarme nativo via FCM quando settings muda.
 * Por enquanto, mudança ganha efeito no próximo rescheduleAll JS-side (App.jsx hourTick).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase, hasSupabase } from '../services/supabase'
import { useAuth } from './useAuth'
import { track, EVENTS } from '../services/analytics'

const DEFAULT_LEVEL = 'critical'

export function useAllTreatmentAlertLevels() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['treatment_alert_levels', user?.id],
    enabled: Boolean(user?.id) && hasSupabase,
    // v0.2.6.1 P8 — staleTime 1h (era 5min). User raramente muda alert level
    // após cadastro inicial. Cache hit rate >95% esperado. Reduz RPC calls
    // ~12×/h → ~1×/h por user.
    staleTime: 60 * 60 * 1000,
    gcTime: 6 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_treatment_alert_levels')
      if (error) throw error
      // Retorna map { treatment_id → 'critical'|'push'|'silent' }
      const map = {}
      for (const row of data || []) {
        map[row.treatment_id] = row.alert_level
      }
      return map
    },
  })
}

export function useTreatmentAlertLevel(treatmentId) {
  const { data: levels = {} } = useAllTreatmentAlertLevels()
  return levels[treatmentId] ?? DEFAULT_LEVEL
}

export function useSetTreatmentAlertLevel() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ treatmentId, alertLevel }) => {
      if (!hasSupabase) return { ok: true, treatment_id: treatmentId, alert_level: alertLevel }
      const { data, error } = await supabase.rpc('set_treatment_alert_level', {
        p_treatment_id: treatmentId,
        p_alert_level: alertLevel,
      })
      if (error) throw error
      if (data?.ok === false) {
        const e = new Error(data.error || 'set_treatment_alert_level failed')
        e.code = data.code
        throw e
      }
      return data
    },
    onMutate: async ({ treatmentId, alertLevel }) => {
      await qc.cancelQueries({ queryKey: ['treatment_alert_levels'] })
      const snapshot = qc.getQueryData(['treatment_alert_levels', user?.id])
      qc.setQueryData(['treatment_alert_levels', user?.id], (old = {}) => ({
        ...old,
        [treatmentId]: alertLevel,
      }))
      return { snapshot }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.snapshot !== undefined) {
        qc.setQueryData(['treatment_alert_levels', user?.id], ctx.snapshot)
      }
    },
    // v0.2.6.1 P8 — sem onSettled invalidate. Cache já foi patched optimistic
    // em onMutate. RPC retornou ok → cache já reflete server state.
    // Skip invalidate evita refetch HTTP desnecessário (1× por toggle).
    onSuccess: (_data, vars) => {
      try {
        track(EVENTS.TREATMENT_ALERT_LEVEL_CHANGED, { alert_level: vars.alertLevel })
      } catch {}
    },
  })
}

export const ALERT_LEVELS = [
  { id: 'critical', label: 'Crítico', short: 'CRÍ', description: 'Alarme cheio com som e fullscreen', icon: 'AlarmClock' },
  { id: 'push',     label: 'Push',    short: 'PUSH', description: 'Apenas notificação push (sem som)', icon: 'Bell' },
  { id: 'silent',   label: 'Silenc.', short: 'SIL',  description: 'Sem alerta — só aparece no histórico', icon: 'BellOff' },
]

export function useAlertLevels() {
  return useMemo(() => ALERT_LEVELS, [])
}
