import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listDoses, listSosRules, upsertSosRule, deleteSosRule } from '../services/dosesService'

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

// Item #204 (release v0.2.1.7) — Mutation queue offline.
// Hooks de mutations referem mutationKey; mutationFn + onMutate/onError/onSettled
// vêm de src/services/mutationRegistry.js (registrados em main.jsx antes do hydrate).
// Permite resumePausedMutations encontrar mutationFn pós-hydrate de queue persistida.
export function useConfirmDose() {
  return useMutation({ mutationKey: ['confirmDose'] })
}

export function useSkipDose() {
  return useMutation({ mutationKey: ['skipDose'] })
}

export function useUndoDose() {
  return useMutation({ mutationKey: ['undoDose'] })
}

export function useRegisterSos() {
  return useMutation({ mutationKey: ['registerSos'] })
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
export function useDeleteSosRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => deleteSosRule(id),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['sos_rules', vars.patientId] })
  })
}
