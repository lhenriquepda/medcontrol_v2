import { hasSupabase, supabase } from './supabase'

export class ShareError extends Error {
  constructor(msg, code) { super(msg); this.code = code }
}

const ERR_MAP = {
  APENAS_PRO_COMPARTILHA: 'Somente usuários PRO podem compartilhar pacientes.',
  USUARIO_DESTINO_NAO_ENCONTRADO: 'E-mail não encontrado. Peça ao outro usuário para criar uma conta.',
  NAO_COMPARTILHA_COM_SI: 'Você não pode compartilhar com você mesmo.',
  PACIENTE_NAO_ENCONTRADO: 'Paciente não encontrado.',
  SOMENTE_DONO_COMPARTILHA: 'Apenas o dono pode compartilhar este paciente.',
  NAO_AUTENTICADO: 'Faça login para compartilhar.',
  SEM_ACESSO: 'Sem acesso ao paciente.'
}

function mapErr(error) {
  const raw = String(error?.message || '')
  for (const code of Object.keys(ERR_MAP)) {
    if (raw.includes(code)) return new ShareError(ERR_MAP[code], code)
  }
  return error
}

export async function listPatientShares(patientId) {
  if (!hasSupabase) return []
  const { data, error } = await supabase.rpc('list_patient_shares', { p_patient: patientId })
  if (error) throw mapErr(error)
  return data || []
}

export async function sharePatientByEmail(patientId, email) {
  if (!hasSupabase) throw new ShareError('Supabase indisponível')
  const { data, error } = await supabase.rpc('share_patient_by_email', {
    p_patient: patientId,
    p_email: email
  })
  if (error) throw mapErr(error)
  return data
}

export async function unsharePatient(patientId, targetUserId) {
  if (!hasSupabase) return
  const { error } = await supabase.rpc('unshare_patient', {
    p_patient: patientId,
    p_target: targetUserId
  })
  if (error) throw mapErr(error)
}
