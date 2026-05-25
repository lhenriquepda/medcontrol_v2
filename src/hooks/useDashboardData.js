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

// v0.2.7.0 hardening — normaliza timestamps pra hora corrente.
// Dashboard.jsx recomputa baseWindow a cada tick 60s → causava refetch a cada
// minuto em idle (60 RPC/hora, ~3-5MB egress). Round-to-hour estabiliza key:
// useEffect só dispara fetch novo quando hora vira (1× por hora vs 60× por hora).
function roundToHour(iso) {
  if (!iso) return iso
  const d = new Date(iso)
  if (isNaN(d)) return iso
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

export function useDashboardData({ from, to, daysAhead = 5 } = {}) {
  // Normaliza params pra hora — re-fetch só dispara em hour boundary.
  // fetchDashboard usa from/to crus na RPC (precisão preservada).
  const stableFrom = useMemo(() => roundToHour(from), [from])
  const stableTo = useMemo(() => roundToHour(to), [to])
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
      // v0.2.7.0 hardening — usa stableFrom/stableTo (round-to-hour) pras deps
      // do useCallback, mas envia from/to crus pro fetchDashboard (precisão RPC).
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableFrom, stableTo, daysAhead])

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
