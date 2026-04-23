import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listPatients, createPatient, updatePatient, deletePatient, getPatient } from '../services/patientsService'

export function usePatients() {
  return useQuery({ queryKey: ['patients'], queryFn: listPatients })
}
export function usePatient(id) {
  return useQuery({ queryKey: ['patients', id], queryFn: () => getPatient(id), enabled: !!id })
}
export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] })
  })
}
export function useUpdatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => updatePatient(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] })
  })
}
export function useDeletePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePatient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
    }
  })
}
