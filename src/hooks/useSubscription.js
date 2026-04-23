import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyTier, listAllUsers, grantTier, FREE_PATIENT_LIMIT } from '../services/subscriptionService'
import { usePatients } from './usePatients'

export { FREE_PATIENT_LIMIT }

export function useMyTier() {
  return useQuery({
    queryKey: ['my_tier'],
    queryFn: getMyTier,
    staleTime: 60_000
  })
}

export function useIsAdmin() {
  const { data: tier } = useMyTier()
  return tier === 'admin'
}

export function useIsPro() {
  const { data: tier } = useMyTier()
  return tier === 'pro' || tier === 'admin'
}

// Retorna true se user free atingiu limite de pacientes
export function usePatientLimitReached() {
  const { data: tier } = useMyTier()
  const { data: patients = [] } = usePatients()
  if (tier === 'pro' || tier === 'admin') return false
  return patients.length >= FREE_PATIENT_LIMIT
}

export function useAllUsers() {
  return useQuery({ queryKey: ['admin_users'], queryFn: listAllUsers })
}

export function useGrantTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: grantTier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_users'] })
  })
}
