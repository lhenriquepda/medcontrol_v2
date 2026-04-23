import { hasSupabase, supabase } from './supabase'
import { mock } from './mockStore'
import { generateDoses } from '../utils/generateDoses'

const byCreatedDesc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')

export async function listTreatments(filter = {}) {
  if (hasSupabase) {
    let q = supabase.from('treatments').select('*')
    if (filter.patientId) q = q.eq('patientId', filter.patientId)
    if (filter.status) q = q.eq('status', filter.status)
    const { data, error } = await q
    if (error) throw error
    return (data || []).sort(byCreatedDesc)
  }
  return mock.list('treatments', filter).sort(byCreatedDesc)
}

export async function getTreatment(id) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('treatments').select('*').eq('id', id).single()
    if (error) throw error
    return data
  }
  return mock.getById('treatments', id)
}

export async function createTreatmentWithDoses(payload) {
  // payload inclui modo, intervalo/horários etc. Gera doses atomicamente.
  if (hasSupabase) {
    const { data: t, error } = await supabase.from('treatments').insert({
      patientId: payload.patientId, medName: payload.medName, unit: payload.unit,
      intervalHours: payload.intervalHours ?? null, durationDays: payload.durationDays,
      startDate: payload.startDate, firstDoseTime: payload.firstDoseTime ?? null,
      status: 'active', isTemplate: !!payload.isTemplate
    }).select().single()
    if (error) throw error
    const doses = generateDoses({ ...payload, id: t.id })
    if (doses.length) {
      const { error: e2 } = await supabase.from('doses').insert(doses)
      if (e2) throw e2
    }
    return t
  }
  const t = mock.insert('treatments', {
    patientId: payload.patientId, medName: payload.medName, unit: payload.unit,
    intervalHours: payload.intervalHours ?? null, durationDays: payload.durationDays,
    startDate: payload.startDate, firstDoseTime: payload.firstDoseTime ?? null,
    status: 'active', isTemplate: !!payload.isTemplate
  })
  const doses = generateDoses({ ...payload, id: t.id })
  mock.insertMany('doses', doses)
  return t
}

export async function updateTreatment(id, patch) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('treatments').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  }
  return mock.update('treatments', id, patch)
}

export async function deleteTreatment(id) {
  if (hasSupabase) {
    const { error: e1 } = await supabase.from('doses').delete().eq('treatmentId', id)
    if (e1) throw e1
    const { error } = await supabase.from('treatments').delete().eq('id', id)
    if (error) throw error
    return
  }
  mock.removeWhere('doses', { treatmentId: id })
  mock.remove('treatments', id)
}

export async function listTemplates() {
  if (hasSupabase) {
    const { data, error } = await supabase.from('treatment_templates').select('*')
    if (error) throw error
    return (data || []).sort(byCreatedDesc)
  }
  return mock.list('treatment_templates')
}

export async function createTemplate(payload) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('treatment_templates').insert(payload).select().single()
    if (error) throw error
    return data
  }
  return mock.insert('treatment_templates', payload)
}
