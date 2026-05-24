/**
 * fetchDashboard.js — Refactor Sync v2 Fase 2 (v0.2.7.0)
 *
 * Single point para popular os 3 stores (dose/patient/treatment) com dados frescos
 * do server. Substitui useDashboardPayload + setQueryData espalhado pelos hooks
 * (que carregava TanStack cache em paralelo).
 *
 * Princípios:
 *   P1 — server source of truth, store é view layer.
 *   P5 — UI nunca trava: timeout via authedRpc (10s hard).
 *
 * Uso:
 *   await fetchDashboard()                // -7d/+14d default
 *   await fetchDashboard({ from, to })    // janela custom (Reports, DoseHistory)
 *
 * Side-effect: popula doseStore, patientStore, treatmentStore.
 * Retorna: payload completo (compat com callers que ainda esperam objeto).
 */
import { hasSupabase } from './supabase'
import { authedRpc } from './sessionManager'
import { setAllDoses } from '../state/doseStore'
import { setAllPatients } from '../state/patientStore'
import { setAllTreatments } from '../state/treatmentStore'
import { recomputeOverdueDoses } from './dashboardService'

const DEFAULT_RANGE_PAST_DAYS = 7
const DEFAULT_RANGE_FUTURE_DAYS = 14

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

// Dedup: evita fetches concorrentes (Dashboard mount + App.jsx scheduler trigger
// simultâneo). Promise compartilhada — segundo caller espera primeiro resolver.
let inFlightPromise = null

export async function fetchDashboard({ from, to, daysAhead = 5 } = {}) {
  // Reutiliza fetch em curso se mesmo range (raro variação no Dashboard).
  if (inFlightPromise) return inFlightPromise

  inFlightPromise = doFetch({ from, to, daysAhead })
    .finally(() => { inFlightPromise = null })

  return inFlightPromise
}

async function doFetch({ from, to, daysAhead }) {
  const range = applyDefaultRange(from, to)

  if (!hasSupabase) {
    // Mock fallback: compõe via existing services (paths preservados).
    const { listPatients } = await import('./patientsService')
    const { listTreatments } = await import('./treatmentsService')
    const { listDoses } = await import('./dosesService')
    const [patients, treatments, doses] = await Promise.all([
      listPatients(),
      listTreatments({}),
      listDoses({ from: range.from, to: range.to }),
    ])
    const enrichedDoses = enrichDoses(doses, patients)
    setAllPatients(patients)
    setAllTreatments(treatments)
    setAllDoses(enrichedDoses)
    return { patients, treatments, doses: enrichedDoses, range, fetchedAt: new Date().toISOString() }
  }

  // Production: RPC consolidado com timeout via authedRpc.
  const data = await authedRpc('get_dashboard_payload', {
    p_from: range.from,
    p_to: range.to,
    p_days_ahead: daysAhead,
  })

  const patients = Array.isArray(data?.patients) ? data.patients : []
  const treatments = Array.isArray(data?.treatments) ? data.treatments : []
  const rawDoses = Array.isArray(data?.doses) ? data.doses : []

  const enrichedDoses = enrichDoses(rawDoses, patients)

  // Popula stores. Ordem importa: patients/treatments antes de doses
  // (DoseCard / Dashboard joins lookup patientName/medName).
  setAllPatients(patients)
  setAllTreatments(treatments)
  setAllDoses(enrichedDoses)

  return {
    patients,
    treatments,
    doses: enrichedDoses,
    extend_result: data?.extend_result,
    range,
    fetchedAt: new Date().toISOString(),
  }
}

function enrichDoses(doses, patients) {
  const patientsMap = new Map((patients || []).map(p => [p.id, p]))
  const enriched = (doses || []).map((d) => ({
    ...d,
    patientName: d.patientName || patientsMap.get(d.patientId)?.name || '',
  }))
  return recomputeOverdueDoses(enriched)
}

// Helper pra forçar refetch sem caching cooperativo (pull-to-refresh, etc).
export async function forceRefetchDashboard(options = {}) {
  inFlightPromise = null  // invalida dedup
  return fetchDashboard(options)
}
