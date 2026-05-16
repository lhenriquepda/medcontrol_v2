import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listPatients, getPatient } from '../services/patientsService'

export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: listPatients,
    // Durante janela undo (5s) o paciente já foi removido optimistic do cache,
    // mas o servidor ainda não deletou. staleTime cobre a janela pra evitar
    // refetch on mount que traria o paciente "morto" de volta visualmente.
    // #092 (v0.1.7.5): pacientes mudam raramente, staleTime 6s → 5min.
    // v0.2.3.4 #165: 5min → 30min combinado com IDB persist (main.jsx). App abre renderiza
    // cache local instant + background refetch só se >30min stale. Realtime + invalidate
    // em mutations cobrem updates cross-device pra cenários < 30min staleness.
    // v0.2.3.6 [bug fix sharing] — removido `refetchOnMount: false`. Cenário quebrado:
    // Daffiny tinha cache IDB persistido com `[]` antigo (antes de receber shares).
    // Hidrate → cache vazio → refetchOnMount=false bloqueia refresh → sees "Bem-vindo".
    // Mantém staleTime 30min: refetch on mount só dispara se cache>30min stale.
    staleTime: 30 * 60_000,
  })
}
export function usePatient(id) {
  const qc = useQueryClient()
  // Item #204 v0.2.1.8 — initialData lookup na lista ['patients'] cache.
  // Sem isso, offline PatientDetail trava em "Carregando..." quando user navega
  // direto pra detalhe sem ter visitado antes (PATIENT_COLS_LIST tem dados
  // suficientes pra renderizar; photo_url full vem do fetch online quando disponível).
  return useQuery({
    queryKey: ['patients', id],
    queryFn: () => getPatient(id),
    enabled: !!id,
    initialData: () => {
      if (!id) return undefined
      const list = qc.getQueryData(['patients']) || []
      return list.find(p => p.id === id)
    },
    initialDataUpdatedAt: () => qc.getQueryState(['patients'])?.dataUpdatedAt,
  })
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
