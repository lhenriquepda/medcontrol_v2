import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listDoses, confirmDose, skipDose, undoDose, registerSos, listSosRules, upsertSosRule } from '../services/dosesService'
import { track, EVENTS } from '../services/analytics'

// #092 (release v0.1.7.5) — queryKey timestamp normalization.
// Callers tipicamente passam `new Date().toISOString()` em filter.from/to,
// gerando queryKey diferente a cada render → refetch storm.
// Soluciona arredondando pra hora corrente no queryKey (mas mantém timestamp
// real no queryFn pra precisão da query SQL).
function roundToHour(iso) {
  if (!iso) return iso
  const d = new Date(iso)
  if (isNaN(d)) return iso
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

export function useDoses(filter = {}) {
  // Normaliza timestamps pra queryKey estável dentro da hora.
  // Usa filter.from/to crus na queryFn (precisão real).
  const keyFilter = useMemo(() => ({
    ...filter,
    from: roundToHour(filter.from),
    to: roundToHour(filter.to)
  }), [filter.from, filter.to, filter.patientId, filter.status, filter.type, filter.withObservation])

  return useQuery({
    queryKey: ['doses', keyFilter],
    queryFn: () => listDoses(filter),
    // #092: refetchInterval 60s → 5min. Realtime cobre updates instantes;
    // este interval é fallback caso websocket morra. 5min reduz egress 5x
    // pra users idle no app.
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
    // #092: staleTime 30s → 2min. Reduz refetchOnMount/refetchOnWindowFocus
    // hits desnecessários quando user navega entre páginas em <2min.
    staleTime: 2 * 60_000,
    // Item #088 (release v0.1.7.4) — BUG-021: dose recém-cadastrada não aparecia
    // em Início sem refresh manual em emulador Pixel 7 API 35.
    // Mantém refetchOnMount='always' pra cobrir #088 cross-device, mas com
    // staleTime 2min o cost cai (não refetch dentro da janela 2min se cache válido).
    // Wait — refetchOnMount='always' BYPASSA staleTime. Voltando pra `true` (default)
    // que respeita staleTime. #088 ainda mitigado pq invalidate pós-create já força.
    refetchOnMount: true
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
