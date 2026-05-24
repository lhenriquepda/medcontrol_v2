/**
 * useDashboardData.js — Refactor Sync v2 Fase 2 (v0.2.7.0)
 *
 * Substitui useDashboardPayload. API próxima do useQuery pra facilitar migração:
 *   const { data, isLoading, isError, error, refetch } = useDashboardData({ from, to })
 *   data = { doses, patients, treatments, fetchedAt, range }
 *
 * Diferenças vs useDashboardPayload:
 *   - Fonte: Zustand stores (não TanStack cache)
 *   - Sem persist hydrate stale: cold start sempre fetcha fresh (custo: ~200ms)
 *   - Sem refetchInterval / staleTime cobrindo invalidações:
 *     refetch é manual (mount, pull-to-refresh, Realtime notify [Fase 4])
 *   - Sem versionedCache reconcile (Fase 3 reescreve mutation pipeline)
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useDoseStore } from '../state/doseStore'
import { usePatientStore } from '../state/patientStore'
import { useTreatmentStore } from '../state/treatmentStore'
import { fetchDashboard, forceRefetchDashboard } from '../services/fetchDashboard'
import { AuthLostError } from '../services/sessionManager'

export function useDashboardData({ from, to, daysAhead = 5 } = {}) {
  const dosesMap = useDoseStore(s => s.doses)
  const dosesLoaded = useDoseStore(s => s.loaded)
  const dosesLoadedAt = useDoseStore(s => s.loadedAt)
  const patientsMap = usePatientStore(s => s.patients)
  const treatmentsMap = useTreatmentStore(s => s.treatments)

  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(false)

  const doFetch = useCallback(async (force = false) => {
    if (!mountedRef.current) return
    setIsFetching(true)
    setError(null)
    let err = null
    try {
      if (force) {
        await forceRefetchDashboard({ from, to, daysAhead })
      } else {
        await fetchDashboard({ from, to, daysAhead })
      }
    } catch (e) {
      err = e
      if (!(e instanceof AuthLostError)) {
        // sessionManager AuthLost: useAppResume cuida do signOut via onAuthLost listener.
        // Outros erros: armazena pra UI mostrar.
      }
    } finally {
      if (mountedRef.current) {
        setError(err)
        setIsFetching(false)
      }
    }
  }, [from, to, daysAhead])

  // Fetch on mount + quando params mudam. Dispara async, sem setState síncrono no effect.
  useEffect(() => {
    mountedRef.current = true
    Promise.resolve().then(() => doFetch(false))
    return () => { mountedRef.current = false }
  }, [doFetch])

  // Materializa data como objeto com arrays (compat com useDashboardPayload consumers).
  const data = useMemo(() => {
    if (!dosesLoaded) return undefined
    return {
      doses: Array.from(dosesMap.values()),
      patients: Array.from(patientsMap.values()),
      treatments: Array.from(treatmentsMap.values()),
      fetchedAt: dosesLoadedAt ? new Date(dosesLoadedAt).toISOString() : null,
    }
  }, [dosesMap, patientsMap, treatmentsMap, dosesLoaded, dosesLoadedAt])

  return {
    data,
    isLoading: !dosesLoaded && isFetching,
    isFetching,
    isError: !!error,
    error,
    refetch: () => doFetch(true),
  }
}
