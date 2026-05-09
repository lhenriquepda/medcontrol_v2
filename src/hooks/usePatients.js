import { useMutation, useQuery } from '@tanstack/react-query'
import { listPatients, getPatient } from '../services/patientsService'

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

// Item #204 (release v0.2.1.7) — Mutation queue offline. Defaults em mutationRegistry.
export function useCreatePatient() {
  return useMutation({ mutationKey: ['createPatient'] })
}
export function useUpdatePatient() {
  return useMutation({ mutationKey: ['updatePatient'] })
}
export function useDeletePatient() {
  return useMutation({ mutationKey: ['deletePatient'] })
}
