import { hasSupabase, supabase } from './supabase'
import { mock } from './mockStore'
import { generateDoses } from '../utils/generateDoses'

export const CONTINUOUS_DAYS = 90

const byCreatedDesc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')

const TREATMENT_COLS = 'id, userId, patientId, medName, unit, intervalHours, durationDays, startDate, firstDoseTime, status, isTemplate, isContinuous, createdAt, updatedAt'

export async function listTreatments(filter = {}) {
  if (hasSupabase) {
    let q = supabase.from('treatments').select(TREATMENT_COLS)
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
    const { data, error } = await supabase.from('treatments').select(TREATMENT_COLS).eq('id', id).single()
    if (error) throw error
    return data
  }
  return mock.getById('treatments', id)
}

export async function createTreatmentWithDoses(payload) {
  // payload inclui modo, intervalo/horários etc. Gera doses atomicamente via RPC.
  if (hasSupabase) {
    // Browser timezone — RPC computes "first dose time" relative to user's local TZ
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
    const { data, error } = await supabase.rpc('create_treatment_with_doses', {
      p_patient_id:      payload.patientId,
      p_med_name:        payload.medName,
      p_unit:            payload.unit,
      p_interval_hours:  payload.mode === 'times' ? null : (payload.intervalHours ?? null),
      p_duration_days:   payload.isContinuous ? CONTINUOUS_DAYS : (payload.durationDays ?? 7),
      p_is_continuous:   !!payload.isContinuous,
      p_start_date:      payload.startDate,
      p_first_dose_time: payload.firstDoseTime ?? '08:00',
      p_mode:            payload.mode || 'interval',
      p_is_template:     !!payload.isTemplate,
      p_timezone:        tz,
    })
    if (error) throw error
    return data  // jsonb returned from RPC, parsed by Supabase JS client
  }
  const t = mock.insert('treatments', {
    patientId: payload.patientId, medName: payload.medName, unit: payload.unit,
    intervalHours: payload.intervalHours ?? null,
    durationDays: payload.isContinuous ? CONTINUOUS_DAYS : payload.durationDays,
    isContinuous: !!payload.isContinuous,
    startDate: payload.startDate, firstDoseTime: payload.firstDoseTime ?? null,
    status: 'active', isTemplate: !!payload.isTemplate
  })
  const doses = generateDoses({ ...payload, id: t.id })
  mock.insertMany('doses', doses)
  return t
}

export async function updateTreatment(id, patch) {
  if (hasSupabase) {
    // Atomic RPC: applies patch + regenerates future doses if schedule changed
    const { data, error } = await supabase.rpc('update_treatment_schedule', {
      p_treatment_id: id,
      p_patch:        patch,
    })
    if (error) throw error
    return data
  }
  // Mock: simple update (schedule regeneration skipped in demo mode)
  return mock.update('treatments', id, patch)
}

export async function deleteTreatment(id) {
  if (hasSupabase) {
    // ON DELETE CASCADE handles doses automatically
    const { error } = await supabase.from('treatments').delete().eq('id', id)
    if (error) throw error
    return
  }
  mock.removeWhere('doses', { treatmentId: id })
  mock.remove('treatments', id)
}

export async function listTemplates() {
  if (hasSupabase) {
    const { data, error } = await supabase.from('treatment_templates').select(
      'id, userId, name, medName, unit, intervalHours, durationDays, createdAt, updatedAt'
    )
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
