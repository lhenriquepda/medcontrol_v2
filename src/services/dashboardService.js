// v0.2.3.4 #163 — RPC consolidado Dashboard.
// Substitui 4 round-trips (listPatients + listTreatments + listDoses + extend_continuous_treatments)
// por single RPC `medcontrol.get_dashboard_payload(p_from, p_to, p_days_ahead)`.
// Esperado -40% a -60% Dashboard egress (eliminação overhead PostgREST por request +
// payload duplicado eliminado).
import { hasSupabase, supabase } from './supabase'

const DEFAULT_RANGE_PAST_DAYS = 30
const DEFAULT_RANGE_FUTURE_DAYS = 60

function applyDefaultRange(from, to) {
  if (from && to) return { from, to }
  const now = new Date()
  if (!from) {
    const past = new Date(now); past.setDate(past.getDate() - DEFAULT_RANGE_PAST_DAYS)
    from = past.toISOString()
  }
  if (!to) {
    const future = new Date(now); future.setDate(future.getDate() + DEFAULT_RANGE_FUTURE_DAYS)
    to = future.toISOString()
  }
  return { from, to }
}

/**
 * Retorna payload consolidado { patients, treatments, doses, extend_result, range, fetchedAt }.
 *
 * Doses retornadas SEM observation (DOSE_COLS_LIST equivalent) — Dashboard não exibe.
 * Callers que precisam observation (DoseHistory search, Reports export) ainda usam
 * listDoses({ withObservation: true }).
 *
 * Doses ainda podem ter status='pending' com scheduledAt no passado — recomputeOverdue
 * deve ser aplicado client-side (mesma lógica de dosesService.js listDoses).
 */
export async function getDashboardPayload({ from, to, daysAhead = 5 } = {}) {
  if (!hasSupabase) {
    // Mock fallback: composição via existing services
    const { listPatients } = await import('./patientsService')
    const { listTreatments } = await import('./treatmentsService')
    const { listDoses } = await import('./dosesService')
    const range = applyDefaultRange(from, to)
    const [patients, treatments, doses] = await Promise.all([
      listPatients(), listTreatments({}), listDoses({ from: range.from, to: range.to })
    ])
    return {
      patients, treatments, doses,
      extend_result: { mock: true },
      range,
      fetchedAt: new Date().toISOString()
    }
  }

  const range = applyDefaultRange(from, to)
  const { data, error } = await supabase
    .schema('medcontrol')
    .rpc('get_dashboard_payload', {
      p_from: range.from,
      p_to: range.to,
      p_days_ahead: daysAhead
    })
  if (error) throw error
  return data
}

/**
 * Recompute overdue status client-side (mesma lógica de dosesService.recomputeOverdue).
 * Doses no DB persistidas como 'pending' mas scheduledAt no passado → status='overdue' UI.
 */
export function recomputeOverdueDoses(doses) {
  if (!Array.isArray(doses)) return []
  const now = new Date()
  return doses.map((d) => {
    if (d.status === 'pending' && new Date(d.scheduledAt) < now) {
      return { ...d, status: 'overdue' }
    }
    return d
  })
}
