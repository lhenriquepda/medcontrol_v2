import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDashboardPayload, recomputeOverdueDoses } from '../services/dashboardService'

// v0.2.3.4 #163 — Hook consolidado Dashboard.
// Substitui 3 useQuery individuais (usePatients + useTreatments + useDoses) + 1 RPC
// (extend_continuous_treatments) por single RPC call que retorna todos os 4 results.
//
// Side-effect: popula cache TanStack ['patients'], ['treatments', {}], ['doses', filter]
// com os resultados — outras telas que usam usePatients/useTreatments/useDoses pegam
// cache fresh sem refetch (initialData fallback continua working pra hooks com filter
// patientId etc).
//
// Range default igual ao listDoses (-30d/+60d), recompute overdue client-side mantido.

function roundToHour(iso) {
  if (!iso) return iso
  const d = new Date(iso)
  if (isNaN(d)) return iso
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

export function useDashboardPayload({ from, to, daysAhead = 5 } = {}) {
  const qc = useQueryClient()

  // Stable queryKey via hour-normalized timestamps (mesma estratégia useDoses)
  const keyFilter = useMemo(() => ({
    from: roundToHour(from),
    to: roundToHour(to),
    daysAhead
  }), [from, to, daysAhead])

  const query = useQuery({
    queryKey: ['dashboard-payload', keyFilter],
    queryFn: () => getDashboardPayload({ from, to, daysAhead }),
    staleTime: 2 * 60_000,
    refetchOnMount: true,
  })

  // Side-effect: popula caches individuais quando payload chega.
  // Outras telas (Patients, Treatments, DoseHistory) que usam hooks separados
  // pegam cache fresh sem refetch quando mount após Dashboard.
  useEffect(() => {
    if (!query.data) return
    const { patients, treatments, doses } = query.data

    if (Array.isArray(patients)) {
      qc.setQueryData(['patients'], patients)
    }
    if (Array.isArray(treatments)) {
      // useTreatments({}) é a queryKey padrão (sem filter)
      qc.setQueryData(['treatments', {}], treatments)
    }
    if (Array.isArray(doses)) {
      // Aplica recomputeOverdue + popula cache useDoses(filter) padrão Dashboard
      const computed = recomputeOverdueDoses(doses)
      qc.setQueryData(['doses', {
        from: roundToHour(from),
        to: roundToHour(to),
        patientId: undefined,
        status: undefined,
        type: undefined,
        withObservation: false
      }], computed)
    }
  }, [query.data, qc, from, to])

  // Expose recomputed doses diretamente (sem precisar caller fazer)
  const dosesComputed = useMemo(() => {
    if (!query.data?.doses) return undefined
    return recomputeOverdueDoses(query.data.doses)
  }, [query.data])

  return {
    ...query,
    data: query.data
      ? { ...query.data, doses: dosesComputed }
      : undefined,
  }
}
