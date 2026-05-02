import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listDoses, confirmDose, skipDose, undoDose, registerSos, listSosRules, upsertSosRule } from '../services/dosesService'
import { track, EVENTS } from '../services/analytics'

export function useDoses(filter = {}) {
  return useQuery({
    queryKey: ['doses', filter],
    queryFn: () => listDoses(filter),
    // Item #023 (release v0.1.7.0) — refetch só com tab ativa.
    // Antes: refetchInterval rodava em background gerando backlog após 15min idle.
    // Realtime (useRealtime.js) cobre updates cross-device em tempo real;
    // alarme nativo Android é independente do cache TanStack.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    // Item #088 (release v0.1.7.4) — BUG-021: dose recém-cadastrada não aparecia
    // em Início sem refresh manual em emulador Pixel 7 API 35 (NÃO repro em
    // Samsung S25 Ultra device físico real). Provável race condition em devices
    // lentos: navigate dispara antes invalidate refetch completar.
    // Fix conservador: refetchOnMount='always' força refetch toda vez Dashboard
    // monta. Cost: +1 request /navegação (S25 já fazia se cache stale, então
    // sem regressão visível). Backstop garantido cross-device.
    refetchOnMount: 'always'
  })
}

function patchDoseInCache(qc, id, patch) {
  // Use getQueryCache().findAll() — more reliable than setQueriesData partial key in v5
  const queries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
  const snapshots = queries.map((q) => [q.queryKey, q.state.data])
  for (const q of queries) {
    const data = q.state.data
    if (!Array.isArray(data)) continue
    qc.setQueryData(
      q.queryKey,
      data.map((d) => (d.id === id ? { ...d, ...patch } : d))
    )
  }
  return snapshots
}

function rollback(qc, snapshots) {
  for (const [key, data] of (snapshots ?? [])) qc.setQueryData(key, data)
}

function refetchDoses(qc) {
  // invalidate (lazy) ao invés de refetch (eager). Optimistic update já cobre
  // a UI; refetch só roda quando query observador re-monta. Evita storm de
  // fetches concorrentes em sequência rápida (confirm → undo → skip → undo)
  // que apareciam como `net::ERR_FAILED` no console (request anterior abortado
  // por cancelQueries do próximo onMutate).
  qc.invalidateQueries({ queryKey: ['doses'], refetchType: 'active' })
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
    onSuccess: () => track(EVENTS.DOSE_CONFIRMED),
    onSettled: () => refetchDoses(qc)
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
    onSuccess: () => track(EVENTS.DOSE_SKIPPED),
    onSettled: () => refetchDoses(qc)
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
    onSuccess: () => track(EVENTS.DOSE_UNDONE),
    onSettled: () => refetchDoses(qc)
  })
}

export function useRegisterSos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: registerSos,
    onSuccess: () => {
      track(EVENTS.SOS_DOSE_REGISTERED)
      qc.invalidateQueries({ queryKey: ['doses'] })
    }
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
