import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listDoses, confirmDose, skipDose, undoDose, registerSos, listSosRules, upsertSosRule } from '../services/dosesService'
import { track, EVENTS } from '../services/analytics'
import { incrementReviewSignal } from './useInAppReview'

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

export function useDoses(filter = {}, options = {}) {
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
    // #151 (release v0.2.0.11) — refetchInterval OPT-IN.
    // Antes: 5min hardcoded em TODAS queries → 5 active queryKeys polling juntas.
    // Math idle: 5 × 50KB × 12 cycles/h × 24h × 1000 users = 14GB/dia.
    //
    // Agora: default OFF. Dashboard (caller principal) passa pollIntervalMs:15*60_000.
    // Outros (Settings, DoseHistory, Reports) ficam sem polling — refetch só em
    // mount + Realtime postgres_changes + invalidate explícito.
    //
    // Estimado população 1000 users idle: 5GB/dia (antes #151) → ~1GB/dia (-80%).
    refetchInterval: options.pollIntervalMs || false,
    refetchIntervalInBackground: false,
    staleTime: 2 * 60_000,
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

// #149 (release v0.2.0.11) — debounce 2s pra evitar storm de invalidate.
// Antes: cada mutation onSettled invalida ['doses'] → 3+ active queries
// refetcham paralelo (Dashboard + DoseHistory + Reports cached). Multi-mutation
// rápida (confirm → undo → skip → undo) gerava 9-12 fetches /doses.
// Optimistic update via patchDoseInCache já garante UI consistency; refetch é
// redundante exceto quando server rejeita silently (raro). Debounce consolida.
let _refetchDosesTimer = null
function refetchDoses(qc) {
  if (_refetchDosesTimer) clearTimeout(_refetchDosesTimer)
  _refetchDosesTimer = setTimeout(() => {
    qc.invalidateQueries({ queryKey: ['doses'], refetchType: 'active' })
    _refetchDosesTimer = null
  }, 2000)
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
    onSuccess: () => {
      track(EVENTS.DOSE_CONFIRMED)
      // #170 (v0.2.1.3) — engagement signal pra in-app review trigger
      incrementReviewSignal('dose_confirmed')
    },
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
