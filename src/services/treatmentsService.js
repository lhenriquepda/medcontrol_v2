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
      // v0.2.4.0 — Categorias de Medicamentos. RPC tem DEFAULT NULL, retrocompat.
      p_group_id:        payload.group_id ?? null,
      p_cmed_class:      payload.cmed_class ?? null,
    })
    if (error) throw error
    return data
  }
  const t = mock.insert('treatments', {
    patientId: payload.patientId, medName: payload.medName, unit: payload.unit,
    intervalHours: payload.intervalHours ?? null,
    durationDays: payload.isContinuous ? CONTINUOUS_DAYS : payload.durationDays,
    isContinuous: !!payload.isContinuous,
    startDate: payload.startDate, firstDoseTime: payload.firstDoseTime ?? null,
    status: 'active', isTemplate: !!payload.isTemplate,
    group_id: payload.group_id || null,
    cmed_class: payload.cmed_class || null,
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

/** Cancel all pending future doses (scheduledAt > now). Used when pausing/ending.
 * v0.2.3.1 Bloco 5 (A-02) — UPDATE em vez de DELETE.
 * Antes: DELETE batch fazia trigger fires FOR EACH ROW × N → N FCMs spam.
 * Agora: UPDATE batch dispara trigger FOR EACH STATEMENT que agrega doseIds
 * → 1 FCM por device com CSV (DosyMessagingService reconstroi hash do grupo).
 * Preserva historico das doses (status='cancelled' em vez de DELETE).
 */
async function cancelFutureDoses(treatmentId) {
  if (hasSupabase) {
    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('doses')
      .update({ status: 'cancelled' })
      .eq('treatmentId', treatmentId)
      .eq('status', 'pending')
      .gt('scheduledAt', nowIso)
    if (error) throw error
    return
  }
  // Mock: marca cancelled local
  const all = mock.list('doses', { treatmentId })
  const nowMs = Date.now()
  for (const d of all) {
    if (d.status === 'pending' && new Date(d.scheduledAt).getTime() > nowMs) {
      mock.update('doses', d.id, { status: 'cancelled' })
    }
  }
}

/** Pausa tratamento: status=paused + cancela doses futuras pendentes (alarmes param). Reversível. */
export async function pauseTreatment(id) {
  if (hasSupabase) {
    const { error } = await supabase.from('treatments').update({ status: 'paused' }).eq('id', id)
    if (error) throw error
  } else {
    mock.update('treatments', id, { status: 'paused' })
  }
  await cancelFutureDoses(id)
}

/** Retoma tratamento pausado: status=active. Doses futuras canceladas → pending. */
export async function resumeTreatment(id) {
  if (hasSupabase) {
    try {
      const { error } = await supabase.rpc('update_treatment_schedule', {
        p_treatment_id: id,
        p_patch: { status: 'active' },
      })
      if (error) throw error
    } catch (e) {
      console.warn('[resumeTreatment] RPC failed, falling back to status update:', e?.message)
      const { error } = await supabase.from('treatments').update({ status: 'active' }).eq('id', id)
      if (error) throw error
    }
    // #0005 fix — RPC só muda treatment.status; doses cancelled pela pausa ficam
    // cancelled (v_schedule_changed=false, sem regenerate). Restaurar futuras → pending.
    // Doses passadas (período da pausa) permanecem cancelled como histórico correto.
    const nowIso = new Date().toISOString()
    const { error: restoreErr } = await supabase
      .from('doses')
      .update({ status: 'pending' })
      .eq('treatmentId', id)
      .eq('status', 'cancelled')
      .gt('scheduledAt', nowIso)
    if (restoreErr) console.warn('[resumeTreatment] restore cancelled doses err:', restoreErr.message)
  } else {
    mock.update('treatments', id, { status: 'active' })
    const nowMs = Date.now()
    const all = mock.list('doses', { treatmentId: id })
    for (const d of all) {
      if (d.status === 'cancelled' && new Date(d.scheduledAt).getTime() > nowMs) {
        mock.update('doses', d.id, { status: 'pending' })
      }
    }
  }
}

/** Encerra tratamento permanentemente: status=ended + cancela doses futuras. Não reversível. */
export async function endTreatment(id) {
  if (hasSupabase) {
    const { error } = await supabase.from('treatments').update({ status: 'ended' }).eq('id', id)
    if (error) throw error
  } else {
    mock.update('treatments', id, { status: 'ended' })
  }
  await cancelFutureDoses(id)
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
