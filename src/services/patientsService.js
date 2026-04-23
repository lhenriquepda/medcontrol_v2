import { hasSupabase, supabase } from './supabase'
import { mock } from './mockStore'

const byCreatedDesc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')

export async function listPatients() {
  if (hasSupabase) {
    const { data, error } = await supabase.from('patients').select('*')
    if (error) throw error
    return (data || []).sort(byCreatedDesc)
  }
  return mock.list('patients').sort(byCreatedDesc)
}

export async function getPatient(id) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).single()
    if (error) throw error
    return data
  }
  return mock.getById('patients', id)
}

export class PatientLimitError extends Error {
  constructor(msg) { super(msg); this.code = 'FREE_PATIENT_LIMIT' }
}

export async function createPatient(payload) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('patients').insert(payload).select().single()
    if (error) {
      const raw = error.message || ''
      if (raw.includes('PLANO_FREE_LIMITE_PACIENTES')) {
        throw new PatientLimitError('No plano grátis você pode ter apenas 1 paciente. Assine PRO para adicionar mais.')
      }
      throw error
    }
    return data
  }
  return mock.insert('patients', payload)
}

export async function updatePatient(id, patch) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('patients').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  }
  return mock.update('patients', id, patch)
}

export async function deletePatient(id) {
  if (hasSupabase) {
    const { error } = await supabase.from('patients').delete().eq('id', id)
    if (error) throw error
    return
  }
  // cascata: remove tratamentos, doses, regras
  const treatments = mock.list('treatments', { patientId: id })
  treatments.forEach((t) => mock.removeWhere('doses', { treatmentId: t.id }))
  mock.removeWhere('treatments', { patientId: id })
  mock.removeWhere('doses', { patientId: id })
  mock.removeWhere('sos_rules', { patientId: id })
  mock.remove('patients', id)
}
