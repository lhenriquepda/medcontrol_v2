import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listPatientShares, sharePatientByEmail, unsharePatient } from '../services/sharesService'

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
