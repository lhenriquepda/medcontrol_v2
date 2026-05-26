import { useMemo, useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listDoses, listSosRules, upsertSosRule, deleteSosRule } from '../services/dosesService'
import { markDose } from '../services/markDose'
import { useDoseStore } from '../state/doseStore'

// #092 (release v0.1.7.5) — queryKey timestamp normalization.
function roundToHour(iso) {
  if (!iso) return iso
  const d = new Date(iso)
  if (isNaN(d)) return iso
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

/**
 * useDoses — Para queries com filter custom (DoseHistory, Reports, Analytics).
 * Dashboard NÃO usa este hook — usa useDashboardData (Zustand store via fetchDashboard).
 *
 * v0.2.7.0 Fase 2 — TanStack persist removido, mas useQuery sem persist mantém.
 */
export function useDoses(filter = {}, options = {}) {
  const keyFilter = useMemo(() => ({
    ...filter,
    from: roundToHour(filter.from),
    to: roundToHour(filter.to)
  }), [filter.from, filter.to, filter.patientId, filter.status, filter.type, filter.withObservation])

  return useQuery({
    queryKey: ['doses', keyFilter],
    queryFn: () => listDoses(filter),
    refetchInterval: options.pollIntervalMs || false,
    refetchIntervalInBackground: false,
    staleTime: 2 * 60_000,
    refetchOnMount: true,
    // v0.2.8.4 BUG #0031 — override global default (false → true). DoseHistory/
    // Reports/Analytics precisam atualizar quando user volta foco (ex: cuidador
    // marcou dose em outro dispositivo enquanto sharegiver estava em outro app).
    refetchOnWindowFocus: true,
  })
}

/**
 * v0.2.7.0 Fase 3 — Mutation hooks substituídos.
 *
 * Antes (v0.2.6.x): `useMutation({ mutationKey: ['confirmDose'] })` + defaults
 * registrados em mutationRegistry. Cadeia: hook → TanStack mutation pipeline →
 * setMutationDefaults onMutate/mutationFn/onError/onSettled → realtimeGate →
 * versionedCache → flushPersistImmediate → 6 camadas mal coordenadas.
 *
 * Agora: thin wrappers em torno de markDose() (Refactor_Sync_v2 §5).
 * Mantém API `useXDose()` compat com Dashboard / DoseModal / MultiDoseModal:
 *   const mut = useConfirmDose()
 *   mut.mutate({ id, actualTime, observation })  ou  mut.mutateAsync(...)
 *   mut.status === 'pending' enquanto await
 */
function useDoseAction(action) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const exec = useCallback(async (vars) => {
    setStatus('pending')
    setError(null)
    const { id, ...rest } = (action === 'undo' && typeof vars === 'string')
      ? { id: vars }
      : vars
    const result = await markDose({
      doseId: id,
      action,
      payload: rest,
    })
    if (result.ok) {
      setStatus('success')
      return result.dose
    }
    // v0.2.7.0 hardening — pendingSync (offline/timeout/auth) NÃO é erro pra UI.
    // markDose já patchou store com _pendingSync flag, queue persistida em IDB,
    // drain vai retomar quando network voltar / re-login. Caller (Dashboard /
    // DoseModal) recebe success → toast normal ("marcada como pulada") em vez de
    // toast vermelho assustador "Failed to fetch".
    if (result.pendingSync) {
      setStatus('success')
      return { _pendingSync: true }
    }
    // Conflict 409 também não é erro fatal — server tem state diferente, já foi
    // aplicado via emitConflict (banner "Aceitar mudança outro dispositivo?").
    if (result.conflict) {
      setStatus('success')
      return { _conflict: true, currentState: result.currentState }
    }
    setStatus('error')
    setError(result.error || new Error('markDose failed'))
    if (result.error) throw result.error
    return null
  }, [action])

  // Compat com TanStack mutation API
  return {
    status,
    error,
    isPending: status === 'pending',
    isSuccess: status === 'success',
    isError: status === 'error',
    mutate: (vars) => { exec(vars).catch(() => {}) },
    mutateAsync: exec,
    reset: () => { setStatus('idle'); setError(null) },
  }
}

export function useConfirmDose() { return useDoseAction('confirm') }
export function useSkipDose() { return useDoseAction('skip') }
export function useUndoDose() { return useDoseAction('undo') }

// ─── SOS rules (não-healthcare-critical, mantém TanStack) ───────────────────
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

// Exporta hook do store pra Dashboard/outros que querem ler doses do store local.
// Equivalente a useDoses sem filter — retorna todas doses memoizadas.
export function useDosesFromStore() {
  const dosesMap = useDoseStore(s => s.doses)
  return useMemo(() => Array.from(dosesMap.values()), [dosesMap])
}
