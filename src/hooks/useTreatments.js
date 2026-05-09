import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listTreatments, getTreatment, listTemplates, createTemplate } from '../services/treatmentsService'

export function useTreatments(filter = {}) {
  return useQuery({
    queryKey: ['treatments', filter],
    queryFn: () => listTreatments(filter),
    // Cobre janela undo de 5s pra delete optimistic não voltar visualmente.
    // #092 (v0.1.7.5): tratamentos mudam raramente, staleTime 6s → 5min.
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  })
}
export function useTreatment(id) {
  return useQuery({ queryKey: ['treatments', id], queryFn: () => getTreatment(id), enabled: !!id })
}

// Item #204 (release v0.2.1.7) — Mutation queue offline. Defaults em mutationRegistry.
export function useCreateTreatment() {
  return useMutation({ mutationKey: ['createTreatment'] })
}
export function useUpdateTreatment() {
  return useMutation({ mutationKey: ['updateTreatment'] })
}
export function useDeleteTreatment() {
  return useMutation({ mutationKey: ['deleteTreatment'] })
}
export function usePauseTreatment() {
  return useMutation({ mutationKey: ['pauseTreatment'] })
}
export function useResumeTreatment() {
  return useMutation({ mutationKey: ['resumeTreatment'] })
}
export function useEndTreatment() {
  return useMutation({ mutationKey: ['endTreatment'] })
}

// Templates: baixa criticidade, não entram na queue offline (mantém useMutation local).
export function useTemplates() {
  return useQuery({ queryKey: ['templates'], queryFn: listTemplates })
}
export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] })
  })
}
