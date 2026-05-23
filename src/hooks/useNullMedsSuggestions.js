/**
 * useNullMedsSuggestions — v0.2.6.4 P9.6 (Roteiro_Alinhamento_Dosy_v2)
 *
 * Hook pra BulkCategorizeModal (Analytics drill-down "Não classificado").
 *
 * RPC `list_null_meds_with_suggestions` retorna medicamentos do user com
 * group_id NULL/outro + sugestão classify_medication_robust (5-tier).
 *
 * RPC `apply_bulk_categorize` aplica categorias em cascata (treatments + doses).
 *
 * Uso:
 *   const { data: meds, isLoading } = useNullMedsSuggestions()
 *   const apply = useApplyBulkCategorize()
 *   await apply.mutateAsync([{ med_name: 'X', group_id: 'antibiotico' }, ...])
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, hasSupabase } from '../services/supabase'
import { useAuth } from './useAuth'
import { track, EVENTS } from '../services/analytics'

export function useNullMedsSuggestions(limit = 50) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['null-meds-suggestions', user?.id, limit],
    enabled: Boolean(user?.id) && hasSupabase,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_null_meds_with_suggestions', {
        p_limit: limit,
      })
      if (error) throw error
      return data || []
    },
  })
}

export function useApplyBulkCategorize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (meds) => {
      // meds = [{ med_name, group_id, cmed_class? }]
      const { data, error } = await supabase.rpc('apply_bulk_categorize', {
        p_meds: meds,
      })
      if (error) throw error
      return data
    },
    onSuccess: (result, vars) => {
      try {
        track('bulk_categorize_applied', {
          meds_count: vars.length,
          treatments_fixed: result?.treatments_fixed || 0,
          doses_fixed: result?.doses_fixed || 0,
        })
      } catch {}
      // Invalidate Analytics + Histórico + null-meds list
      qc.invalidateQueries({ queryKey: ['dashboard-payload'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['null-meds-suggestions'] })
    },
  })
}
