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
  // v0.2.3.7 Bug C fix — timeout 15s evita "Enviando…" hang infinito quando
  // PostgREST connection fica stale pós idle/reload (similar gap #255/#268).
  const rpcPromise = supabase.rpc('share_patient_by_email', {
    p_patient: patientId,
    p_email: email
  })
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new ShareError('Tempo esgotado. Verifique conexão e tente novamente.', 'SHARE_TIMEOUT')),
      15000
    )
  })
  const { data, error } = await Promise.race([rpcPromise, timeoutPromise])
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

// Item #117 (release v0.2.0.3): shares onde current user é o destinatário.
// Usado pelo HeaderAlertIcon "paciente compartilhado comigo". RLS permite ver
// rows onde sharedWithUserId = auth.uid() (mesma policy que dá acesso ao paciente).
export async function listReceivedShares() {
  if (!hasSupabase) return []
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('patient_shares')
    .select('id, patientId, ownerId, createdAt')
    .eq('sharedWithUserId', user.id)
    .order('createdAt', { ascending: false })
  if (error) throw error
  return data || []
}
