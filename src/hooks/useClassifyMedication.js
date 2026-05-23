import { useQuery } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'
import { inferGroupFromName } from '../constants/medCategories'

/**
 * useClassifyMedication — v0.2.6.3
 *
 * Background classification em real-time quando user digita medName fora do dropdown.
 * Server-side RPC `classify_medication_robust` 5-tier:
 *   1. DCB exact match           confidence 1.0   source='dcb'
 *   2. Catalog nome exact         confidence 0.95  source='catalog_exact'
 *   3. Catalog nome LIKE prefix   confidence 0.85  source='catalog_like'
 *   4. Principio_ativo LIKE       confidence 0.75  source='principio_like'
 *   5. Heurística sufixo (server) confidence 0.55  source='heuristic_suffix'
 *
 * Fallback offline: `inferGroupFromName` (heurística sufixo client-side).
 *
 * Retorna { group_id, cmed_class, principio_ativo, source, confidence, matched_name } | null
 *
 * v0.2.6.3 #0016 — chave do cache inclui `_lc` (lowercased+trimmed) pra evitar
 * cache stale quando user troca o nome rapidamente. queryFn retorna null quando
 * RPC retorna 0 rows OU group_id NULL — assim o consumer pode resetar form state.
 */
export function useClassifyMedication(name) {
  const trimmed = (name || '').trim()
  const normalized = trimmed.toLowerCase()
  const enabled = trimmed.length >= 3

  return useQuery({
    queryKey: ['classify-med', normalized],
    queryFn: async () => {
      if (!enabled) return null

      if (hasSupabase) {
        try {
          const { data, error } = await supabase.rpc('classify_medication_robust', {
            p_name: trimmed,
          })
          if (!error && Array.isArray(data) && data.length > 0) {
            const row = data[0]
            // Server pode retornar row com group_id NULL (tier 5 heurística sem match).
            // Nesses casos consideramos "sem classificação" → caller abre CategoryHintModal.
            if (row?.group_id) return row
            return null
          }
          if (error) {
            console.warn('[useClassifyMedication] RPC error:', error.message)
          }
        } catch (e) {
          console.warn('[useClassifyMedication] RPC threw, falling back:', e?.message)
        }
      }

      // Fallback offline: heurística client-side mínima (apenas pra sufixos clássicos).
      const fromHeuristic = inferGroupFromName(trimmed)
      if (fromHeuristic) {
        return {
          group_id: fromHeuristic,
          cmed_class: null,
          principio_ativo: null,
          source: 'heuristic_client',
          confidence: 0.5,
          matched_name: trimmed,
        }
      }

      return null
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
