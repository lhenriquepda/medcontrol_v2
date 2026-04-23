import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listTreatments, getTreatment, createTreatmentWithDoses, updateTreatment, deleteTreatment, listTemplates, createTemplate } from '../services/treatmentsService'

export function useTreatments(filter = {}) {
  return useQuery({ queryKey: ['treatments', filter], queryFn: () => listTreatments(filter) })
}
export function useTreatment(id) {
  return useQuery({ queryKey: ['treatments', id], queryFn: () => getTreatment(id), enabled: !!id })
}
export function useCreateTreatment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createTreatmentWithDoses,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
    }
  })
}
export function useUpdateTreatment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => updateTreatment(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['treatments'] })
  })
}
export function useDeleteTreatment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteTreatment,
    onSuccess: () => {
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
