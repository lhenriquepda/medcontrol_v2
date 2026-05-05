import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listPatientShares, listReceivedShares, sharePatientByEmail, unsharePatient } from '../services/sharesService'

export function usePatientShares(patientId) {
  return useQuery({
    queryKey: ['patient_shares', patientId],
    queryFn: () => listPatientShares(patientId),
    enabled: !!patientId
  })
}

export function useSharePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, email }) => sharePatientByEmail(patientId, email),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['patient_shares', vars.patientId] })
      qc.invalidateQueries({ queryKey: ['patients'] })
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
