/**
 * useDosyMutation — wrapper fino sobre useMutation que padroniza:
 *   - mutationKey obrigatória (vincula ao mutationRegistry)
 *   - retorna helpers ergonômicos
 *
 * Fase 1 (Refactor_Full.md §5). O wrapper é intencionalmente fino —
 * a lógica pesada (gate, versioned cache, optimistic) vive no
 * mutationRegistry, que é singleton e roda antes da hydrate do
 * PersistQueryClient. Wrapper só dá ergonomia ao caller.
 *
 * Uso:
 *   const confirm = useDosyMutation(['confirmDose'])
 *   confirm.mutate({ id, actualTime, observation })
 */
import { useMutation } from '@tanstack/react-query'

export function useDosyMutation(mutationKey, options = {}) {
  if (!mutationKey) {
    throw new Error('[useDosyMutation] mutationKey é obrigatória')
  }
  return useMutation({ mutationKey, ...options })
}
