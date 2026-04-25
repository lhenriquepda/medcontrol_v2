import { hasSupabase, supabase } from './supabase'
import { mock } from './mockStore'

// Marca doses pendentes cujo horário já passou como 'overdue' (apenas no mock).
function recomputeOverdue(rows) {
  const now = new Date()
  return rows.map((d) => {
    if (d.status === 'pending' && new Date(d.scheduledAt) < now) {
      return { ...d, status: 'overdue' }
    }
    return d
  })
}

export async function listDoses({ from, to, patientId, status, type } = {}) {
  if (hasSupabase) {
    let q = supabase.from('doses').select('*')
    if (from) q = q.gte('scheduledAt', from)
    if (to) q = q.lte('scheduledAt', to)
    if (patientId) q = q.eq('patientId', patientId)
    if (type) q = q.eq('type', type)
    // Importante: NÃO filtrar por status no servidor — overdue é computado no cliente
    // e doses "overdue" ficam persistidas como 'pending' no DB.
    const { data, error } = await q
    if (error) throw error
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
    const { data, error } = await supabase.from('sos_rules').select('*').eq('patientId', patientId)
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
    const { data, error } = await supabase.from('sos_rules').insert(payload).select().single()
    if (error) throw error; return data
  }
  if (id) return mock.update('sos_rules', id, payload)
  return mock.insert('sos_rules', payload)
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
