import { hasSupabase, supabase } from './supabase'
import { mock } from './mockStore'

// Marca doses pendentes cujo horário já passou como 'overdue' (mock + cliente Supabase).
//
// v0.2.3.1 Bloco 6 (A-01) NOTE: cada chamada listDoses retorna NEW array refs
// pra doses que passaram horário (clone via spread). DB ainda persiste status='pending'.
// App.jsx dosesSignature inclui d.status → flippa quando dose passa horário → dispara
// scheduleDoses (throttled 30s) → rescheduleAll roda cancelAll + reagenda. Comportamento
// CORRETO mas pode parecer storm em logcat. filterUpcoming filtra status !== 'pending'
// → overdue dose já passada NÃO é re-agendada (correto).
function recomputeOverdue(rows) {
  const now = new Date()
  return rows.map((d) => {
    if (d.status === 'pending' && new Date(d.scheduledAt) < now) {
      return { ...d, status: 'overdue' }
    }
    return d
  })
}

// Item #138 (egress-audit-2026-05-05 F4) — split COLS pra reduzir payload listDoses.
// observation pode ter até 500 chars/dose. Em listas com 1000s rows = MB extras
// sem necessidade (UI lista exibe só medName + horário + paciente + status).
// observation só é mostrada em DoseModal detail / Reports export / DoseHistory
// search — esses callers explicitam DOSE_COLS_FULL no listDoses({withObservation:true}).
const DOSE_COLS_LIST = 'id, userId, treatmentId, patientId, medName, unit, scheduledAt, actualTime, status, type'
const DOSE_COLS_FULL = DOSE_COLS_LIST + ', observation'

// #092 (release v0.1.7.5) — egress reduction.
// Default range fail-safe: se caller não passar from/to, aplica janela
// padrão (-30d passado, +60d futuro). Evita pull histórico inteiro
// (5+ anos × 4 doses/dia = 7000+ rows × 250 bytes = 1.75 MB / refetch).
// Caller deve sempre passar from/to explícito quando precisar histórico
// completo (e.g. Reports com range custom).
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

export async function listDoses({ from, to, patientId, status, type, withObservation = false } = {}) {
  if (hasSupabase) {
    // #092: aplica default range se ausente
    const range = applyDefaultRange(from, to)
    // #138: lista por padrão exclui observation. Callers que precisam (DoseHistory
    // search, Reports export, Settings export LGPD) passam withObservation:true.
    const cols = withObservation ? DOSE_COLS_FULL : DOSE_COLS_LIST
    // Order desc by scheduledAt + paginate to bypass 1000-row default limit.
    let q = supabase
      .from('doses')
      .select(cols)
      .order('scheduledAt', { ascending: false })
      .gte('scheduledAt', range.from)
      .lte('scheduledAt', range.to)
    if (patientId) q = q.eq('patientId', patientId)
    if (type) q = q.eq('type', type)
    // Importante: NÃO filtrar por status no servidor — overdue é computado no cliente
    // e doses "overdue" ficam persistidas como 'pending' no DB.

    const PAGE = 1000
    const all = []
    let page = 0
    // #092: safety cap reduzida 20→5 pages (5k rows max — coverage 90d window
    // mesmo cenário extremo 50 doses/dia). Maior = bug ou misuse.
    while (page < 5) {
      const { data, error } = await q.range(page * PAGE, (page + 1) * PAGE - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < PAGE) break
      page++
    }
    const data = all
    const now = new Date()
    let rows = (data || []).map((d) => {
      if (d.status === 'pending' && new Date(d.scheduledAt) < now) return { ...d, status: 'overdue' }
      return d
    })
    if (status) rows = rows.filter((d) => d.status === status)
    rows.sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''))
    return rows
  }
  let rows = recomputeOverdue(mock.list('doses'))
  if (from) rows = rows.filter((d) => d.scheduledAt >= from)
  if (to) rows = rows.filter((d) => d.scheduledAt <= to)
  if (patientId) rows = rows.filter((d) => d.patientId === patientId)
  if (status) rows = rows.filter((d) => d.status === status)
  if (type) rows = rows.filter((d) => d.type === type)
  rows.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  return rows
}

export async function confirmDose(id, { actualTime, observation } = {}) {
  if (hasSupabase) {
    const { data, error } = await supabase.rpc('confirm_dose', {
      p_dose_id:     id,
      p_actual_time: actualTime || new Date().toISOString(),
      p_observation: observation || ''
    })
    if (error) throw error
    return data
  }
  return mock.update('doses', id, {
    status: 'done',
    actualTime: actualTime || new Date().toISOString(),
    observation: observation || ''
  })
}

export async function skipDose(id, { observation } = {}) {
  if (hasSupabase) {
    const { data, error } = await supabase.rpc('skip_dose', {
      p_dose_id:    id,
      p_observation: observation || ''
    })
    if (error) throw error
    return data
  }
  return mock.update('doses', id, {
    status: 'skipped',
    actualTime: new Date().toISOString(),
    observation: observation || ''
  })
}

export async function undoDose(id) {
  if (hasSupabase) {
    const { data, error } = await supabase.rpc('undo_dose', { p_dose_id: id })
    if (error) throw error
    return data
  }
  return mock.update('doses', id, { status: 'pending', actualTime: null })
}

export async function registerSos({ patientId, medName, unit, scheduledAt, observation }) {
  if (hasSupabase) {
    // Usa RPC server-side: valida regras SOS (minIntervalHours, maxDosesIn24h) antes de inserir
    const { data, error } = await supabase.rpc('register_sos_dose', {
      p_patient_id:   patientId,
      p_med_name:     medName,
      p_unit:         unit,
      p_scheduled_at: scheduledAt || new Date().toISOString(),
      p_observation:  observation || ''
    })
    if (error) throw error
    return data
  }
  // Mock: insert direto (demo mode sem validação server-side)
  return mock.insert('doses', {
    treatmentId: null, patientId, medName, unit,
    scheduledAt: scheduledAt || new Date().toISOString(),
    actualTime: scheduledAt || new Date().toISOString(),
    status: 'done', type: 'sos', observation: observation || ''
  })
}

export async function listSosRules(patientId) {
  if (hasSupabase) {
    const { data, error } = await supabase
      .from('sos_rules')
      .select('id, userId, patientId, medName, minIntervalHours, maxDosesIn24h, createdAt, updatedAt')
      .eq('patientId', patientId)
    if (error) throw error
    return data || []
  }
  return mock.list('sos_rules', { patientId })
}

export async function upsertSosRule({ id, ...payload }) {
  if (hasSupabase) {
    if (id) {
      const { data, error } = await supabase.from('sos_rules').update(payload).eq('id', id).select().single()
      if (error) throw error; return data
    }
    // v0.2.3.5 #238 fix — RLS WITH CHECK exige userId=auth.uid() em INSERT. Sem userId no
    // payload, insert era silenciosamente bloqueado. Pega user atual via supabase.auth.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')
    const { data, error } = await supabase.from('sos_rules').insert({ ...payload, userId: user.id }).select().single()
    if (error) throw error; return data
  }
  if (id) return mock.update('sos_rules', id, payload)
  return mock.insert('sos_rules', payload)
}

export async function deleteSosRule(id) {
  if (hasSupabase) {
    const { error } = await supabase.from('sos_rules').delete().eq('id', id)
    if (error) throw error
    return true
  }
  return mock.delete('sos_rules', id)
}

export function validateSos({ rules, history, medName, scheduledAt }) {
  const rule = rules.find((r) => r.medName.toLowerCase() === medName.toLowerCase())
  if (!rule) return { ok: true }
  const when = new Date(scheduledAt || Date.now())
  const related = history
    .filter((d) => d.medName.toLowerCase() === medName.toLowerCase() && (d.status === 'done'))
    .map((d) => new Date(d.actualTime || d.scheduledAt))
    .sort((a, b) => b - a)

  // min interval
  if (rule.minIntervalHours && related.length > 0) {
    const diffH = (when - related[0]) / 36e5
    if (diffH < rule.minIntervalHours) {
      const next = new Date(related[0].getTime() + rule.minIntervalHours * 36e5)
      return { ok: false, reason: `Intervalo mínimo de ${rule.minIntervalHours}h não respeitado.`, nextAt: next }
    }
  }
  // max in 24h
  if (rule.maxDosesIn24h) {
    const since = new Date(when.getTime() - 24 * 36e5)
    const count = related.filter((d) => d >= since).length
    if (count >= rule.maxDosesIn24h) {
      const earliest = related[rule.maxDosesIn24h - 1]
      const nextAt = earliest ? new Date(earliest.getTime() + 24 * 36e5) : null
      return { ok: false, reason: `Limite de ${rule.maxDosesIn24h} doses em 24h atingido.`, nextAt }
    }
  }
  return { ok: true }
}
