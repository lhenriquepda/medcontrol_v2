import { useQuery } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'

/**
 * useMedCatalogSearch — busca no catálogo ANVISA via RPC search_medications.
 * Retorna [{ nome_comercial, principio_ativo }] para q ≥ 2 chars.
 * Cache 10min (catálogo muda lentamente — atualização ANVISA é mensal).
 */
export function useMedCatalogSearch(q) {
  const trimmed = (q || '').trim()
  const enabled = hasSupabase && trimmed.length >= 2

  return useQuery({
    queryKey: ['med-catalog-search', trimmed],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_medications', {
        q: trimmed,
        lim: 20,
      })
      if (error) {
        console.warn('[useMedCatalogSearch] rpc error:', error.message)
        return []
      }
      return data || []
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: [],
  })
}
