import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listPatientShares, listReceivedShares, sharePatientByEmail, unsharePatient, extendTemporaryShare, updateShareAccess } from '../services/sharesService'

// v0.2.3.14 #0009 — skip retry em auth errors (JWT expired). Retry default 3×
// não recupera 401 — token continua expirado. Combinar com UI error state
// (SharePatientSheet) evita "Carregando..." infinito quando refresh tokens revogados.
function isAuthError(err) {
  const msg = String(err?.message || '')
  const code = String(err?.code || err?.status || '')
  return msg.includes('JWT') || msg.includes('jwt')
    || code === '401' || code === 'PGRST301' || code === 'PGRST302'
}

export function usePatientShares(patientId) {
  return useQuery({
    queryKey: ['patient_shares', patientId],
    queryFn: () => listPatientShares(patientId),
    enabled: !!patientId,
    retry: (failureCount, error) => !isAuthError(error) && failureCount < 2,
  })
}

export function useSharePatient() {
  const qc = useQueryClient()
  return useMutation({
    // v0.2.6.1 P3.15 — accepts {patientId, email, expiresAt?, accessLevel?}
    mutationFn: ({ patientId, email, expiresAt = null, accessLevel = 'full' }) =>
      sharePatientByEmail(patientId, email, expiresAt, accessLevel),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['patient_shares', vars.patientId] })
      qc.invalidateQueries({ queryKey: ['patients'] })
    }
  })
}

// v0.2.6.1 P3.15 — extend prazo share temporário
// v0.2.6.1 P8 — invalidate targeted apenas pro patientId afetado (não global ['patient_shares'])
export function useExtendTemporaryShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shareId, newExpiresAt }) => extendTemporaryShare(shareId, newExpiresAt),
    onSuccess: (data) => {
      // RPC retorna patient_shares row → ['patient_shares', patientId] queryKey específico
      const patientId = data?.patientId || data?.['patientId']
      if (patientId) {
        qc.invalidateQueries({ queryKey: ['patient_shares', patientId], exact: true })
      }
    }
  })
}

// v0.2.6.1 P3.15 — atualizar access_level
// v0.2.6.1 P8 — invalidate targeted apenas pro patientId do share
export function useUpdateShareAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shareId, accessLevel }) => updateShareAccess(shareId, accessLevel),
    onSuccess: (data) => {
      const patientId = data?.patientId || data?.['patientId']
      if (patientId) {
        qc.invalidateQueries({ queryKey: ['patient_shares', patientId], exact: true })
      }
    }
  })
}

// Item #117 (release v0.2.0.3): shares recebidos por mim (alerta header).
// Item #141 (release v0.2.0.10 — egress-audit F10): staleTime 60s → 5min.
// Shares mudam raramente; refetch a cada minuto era over-aggressive.
// Trade-off UX: novo share notif pode demorar até 5min em aparecer.
export function useReceivedShares() {
  return useQuery({
    queryKey: ['received_shares'],
    queryFn: listReceivedShares,
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => !isAuthError(error) && failureCount < 2,
  })
}

export function useUnsharePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, targetUserId }) => unsharePatient(patientId, targetUserId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['patient_shares', vars.patientId] })
      qc.invalidateQueries({ queryKey: ['patients'] })
    }
  })
}
