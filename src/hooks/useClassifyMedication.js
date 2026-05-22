import { useQuery } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'
import { inferGroupFromName } from '../constants/medCategories'

/**
 * useClassifyMedication — v0.2.5.0
 *
 * Background classification quando user digita nome de med fora do dropdown.
 * Faz lookup robusto server-side (`classify_medication_robust`):
 *   1. DCB exact match
 *   2. Catalog exact match
 *   3. Catalog LIKE
 *   4. Principio_ativo LIKE
 *   5. Heurística sufixo server-side
 *
 * Fallback client-side: `inferGroupFromName` (mesma heurística, offline).
 *
 * Uso:
 *   const { data: classification, isFetching } = useClassifyMedication(medName)
 *   // classification = { group_id, cmed_class, source, principio_ativo } | null
 */
export function useClassifyMedication(name) {
  const trimmed = (name || '').trim()
  const enabled = trimmed.length >= 3

  return useQuery({
    queryKey: ['classify-med', trimmed],
    queryFn: async () => {
      if (!enabled) return null

      // Try server-side first (mais robusto, lookup completo no catálogo)
      if (hasSupabase) {
        try {
          const { data, error } = await supabase.rpc('classify_medication_robust', {
            p_name: trimmed,
          })
          if (!error && Array.isArray(data) && data.length > 0) {
            const row = data[0]
            if (row?.group_id) return row
          }
        } catch (e) {
          console.warn('[useClassifyMedication] RPC failed, falling back:', e?.message)
        }
      }

      // Fallback offline: heurística client-side
      const fromHeuristic = inferGroupFromName(trimmed)
      if (fromHeuristic) {
        return {
          group_id: fromHeuristic,
          cmed_class: null,
          source: 'heuristic_client',
          principio_ativo: null,
        }
      }

      return null
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5min — mesmo nome não re-consulta
    gcTime: 30 * 60 * 1000,
  })
}
