/**
 * useDosyQuery — wrapper fino sobre useQuery com defaults sãos.
 *
 * Fase 1 (Refactor_Full.md §5). Wrapper só dá ergonomia:
 *   - staleTime default 30s (alinha com main.jsx)
 *   - sem polling default (refetchInterval=false)
 *   - retry: 1
 *
 * Para queries que precisam de polling, passa `pollIntervalMs` ou
 * sobrescreve `refetchInterval` explicitamente.
 */
import { useQuery } from '@tanstack/react-query'

export function useDosyQuery(options = {}) {
  if (!options.queryKey) {
    throw new Error('[useDosyQuery] queryKey é obrigatória')
  }
  return useQuery({
    staleTime: 30_000,
    refetchInterval: options.pollIntervalMs || false,
    refetchOnMount: true,
    retry: 1,
    ...options,
  })
}
