import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listTreatments, getTreatment, createTreatmentWithDoses, updateTreatment, deleteTreatment, listTemplates, createTemplate } from '../services/treatmentsService'
import { track, EVENTS } from '../services/analytics'

export function useTreatments(filter = {}) {
  return useQuery({
    queryKey: ['treatments', filter],
    queryFn: () => listTreatments(filter),
    // Cobre janela undo de 5s pra delete optimistic não voltar visualmente.
    staleTime: 6_000,
    refetchOnMount: false,
  })
}
export function useTreatment(id) {
  return useQuery({ queryKey: ['treatments', id], queryFn: () => getTreatment(id), enabled: !!id })
}
export function useCreateTreatment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createTreatmentWithDoses,
    onSuccess: () => {
      track(EVENTS.TREATMENT_CREATED)
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
    }
  })
}
export function useUpdateTreatment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => updateTreatment(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
    }
  })
}
export function useDeleteTreatment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteTreatment,
    onSuccess: () => {
      track(EVENTS.TREATMENT_DELETED)
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
    }
  })
}
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
