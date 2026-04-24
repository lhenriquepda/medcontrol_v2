import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listDoses, confirmDose, skipDose, undoDose, registerSos, listSosRules, upsertSosRule } from '../services/dosesService'

export function useDoses(filter = {}) {
  return useQuery({
    queryKey: ['doses', filter],
    queryFn: () => listDoses(filter),
    refetchInterval: 60_000
  })
}

function patchDoseInCache(qc, id, patch) {
  const snapshots = qc.getQueriesData({ queryKey: ['doses'] })
  qc.setQueriesData({ queryKey: ['doses'] }, (old) => {
    if (!Array.isArray(old)) return old
    return old.map((d) => (d.id === id ? { ...d, ...patch } : d))
  })
  return snapshots
}

function rollback(qc, snapshots) {
  snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
}

export function useConfirmDose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...rest }) => confirmDose(id, rest),
    onMutate: async ({ id, actualTime }) => {
      await qc.cancelQueries({ queryKey: ['doses'] })
      const snapshots = patchDoseInCache(qc, id, {
        status: 'done',
        actualTime: actualTime || new Date().toISOString()
      })
      return { snapshots }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: ['doses'] })
  })
}

export function useSkipDose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...rest }) => skipDose(id, rest),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['doses'] })
      const snapshots = patchDoseInCache(qc, id, { status: 'skipped' })
      return { snapshots }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: ['doses'] })
  })
}

export function useUndoDose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => undoDose(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['doses'] })
      const snapshots = patchDoseInCache(qc, id, { status: 'pending', actualTime: null })
      return { snapshots }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: ['doses'] })
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
