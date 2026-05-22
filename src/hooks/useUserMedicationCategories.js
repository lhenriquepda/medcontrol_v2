import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'

/**
 * useUserMedicationCategories — v0.2.4.0 Categorias de Medicamentos
 *
 * Hook unificado para o "catálogo pessoal" de meds do user. Consulta
 * `get_user_medications` RPC e expõe:
 *   - `data`: lista [{ id, name, group_id, cmed_class, principio_ativo, usage_count, last_used_at }]
 *   - `hintFor(name)`: retorna { group_id, cmed_class, principio_ativo } se user já cadastrou esse med antes
 *   - `upsertMutation`: registra/bumpa uso via `upsert_user_medication` RPC
 *
 * Padrão alinhado com Refactor Fase 1: serve como dica leve no autofill,
 * SEM bloquear render se Supabase indisponível.
 */
export function useUserMedicationCategories() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['user_med_categories'],
    queryFn: async () => {
      if (!hasSupabase) return []
      const { data, error } = await supabase.rpc('get_user_medications', { p_limit: 200 })
      if (error) {
        console.warn('[useUserMedicationCategories] fetch failed:', error.message)
        return []
      }
      return data || []
    },
    staleTime: 30_000,
    gcTime: 1000 * 60 * 30,
  })

  const upsertMutation = useMutation({
    mutationFn: async ({ name, group_id = null, cmed_class = null, principio_ativo = null }) => {
      if (!hasSupabase) return null
      if (!name || !name.trim()) return null
      const { data, error } = await supabase.rpc('upsert_user_medication', {
        p_name: name.trim(),
        p_group_id: group_id,
        p_cmed_class: cmed_class,
        p_principio_ativo: principio_ativo,
      })
      if (error) {
        console.warn('[upsert_user_medication] failed:', error.message)
        return null
      }
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user_med_categories'] })
    },
  })

  function normalize(s) {
    if (!s) return ''
    return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
  }

  /**
   * Procura categoria sugerida para um nome digitado.
   * Tenta match exato (lowercased) primeiro, depois starts-with.
   * Retorna null se nenhum match — caller deve cair pro catálogo global.
   */
  function hintFor(name) {
    if (!name || !query.data) return null
    const n = normalize(name)
    if (!n) return null
    const exact = query.data.find((m) => normalize(m.name) === n)
    if (exact) {
      return {
        source: 'user',
        group_id: exact.group_id || null,
        cmed_class: exact.cmed_class || null,
        principio_ativo: exact.principio_ativo || null,
      }
    }
    const starts = query.data.find((m) => normalize(m.name).startsWith(n))
    if (starts) {
      return {
        source: 'user',
        group_id: starts.group_id || null,
        cmed_class: starts.cmed_class || null,
        principio_ativo: starts.principio_ativo || null,
      }
    }
    return null
  }

  return {
    ...query,
    hintFor,
    upsertMutation,
    upsert: upsertMutation.mutate,
    upsertAsync: upsertMutation.mutateAsync,
  }
}
