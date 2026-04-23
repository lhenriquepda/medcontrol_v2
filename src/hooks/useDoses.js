import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listDoses, confirmDose, skipDose, undoDose, registerSos, listSosRules, upsertSosRule } from '../services/dosesService'

export function useDoses(filter = {}) {
  return useQuery({
    queryKey: ['doses', filter],
    queryFn: () => listDoses(filter),
    refetchInterval: 60_000
  })
}
export function useConfirmDose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...rest }) => confirmDose(id, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doses'] })
  })
}
export function useSkipDose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...rest }) => skipDose(id, rest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doses'] })
  })
}
export function useUndoDose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => undoDose(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doses'] })
  })
}
export function useRegisterSos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: registerSos,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doses'] })
  })
}
export function useSosRules(patientId) {
  return useQuery({
    queryKey: ['sos_rules', patientId],
    queryFn: () => listSosRules(patientId),
    enabled: !!patientId
  })
}
export function useUpsertSosRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: upsertSosRule,
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['sos_rules', vars.patientId] })
  })
}
