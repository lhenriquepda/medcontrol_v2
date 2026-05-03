import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listPatients, createPatient, updatePatient, deletePatient, getPatient } from '../services/patientsService'
import { track, EVENTS } from '../services/analytics'

export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: listPatients,
    // Durante janela undo (5s) o paciente já foi removido optimistic do cache,
    // mas o servidor ainda não deletou. staleTime cobre a janela pra evitar
    // refetch on mount que traria o paciente "morto" de volta visualmente.
    // #092 (v0.1.7.5): pacientes mudam raramente, staleTime 6s → 5min.
    // Realtime + invalidate em mutations cobrem updates cross-device.
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  })
}
export function usePatient(id) {
  return useQuery({ queryKey: ['patients', id], queryFn: () => getPatient(id), enabled: !!id })
}
export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      track(EVENTS.PATIENT_CREATED)
      qc.invalidateQueries({ queryKey: ['patients'] })
    }
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
      track(EVENTS.PATIENT_DELETED)
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
    }
  })
}
