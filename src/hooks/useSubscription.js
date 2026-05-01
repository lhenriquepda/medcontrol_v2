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

/**
 * Tier model:
 *   free  — limite 1 paciente, ads, sem analytics/relatórios/share
 *   plus  — features ilimitadas (= pro), MAS continua com ads
 *           Concedido só por admin (não vendido). Goodwill pra early adopters/testers.
 *   pro   — features ilimitadas, sem ads
 *   admin — pro + acesso painel admin
 */
const PRO_FEATURE_TIERS = ['plus', 'pro', 'admin']

/**
 * Acesso a features Premium (multi-paciente, analytics, relatórios, share, etc).
 * Inclui plus + pro + admin.
 */
export function useIsPro() {
  const { data: tier } = useMyTier()
  return PRO_FEATURE_TIERS.includes(tier)
}

/**
 * Anúncios visíveis: free + plus. Pro/admin não veem ads.
 *
 * IMPORTANTE: aguarda tier carregar antes de retornar true, evitando
 * banner ser mostrado preemptivamente (pra admin/pro) e ficar fixo
 * por causa do singleton AdMob.
 */
export function useShowAds() {
  const { data: tier, isLoading } = useMyTier()
  if (isLoading || !tier) return false
  return tier !== 'pro' && tier !== 'admin'
}

// Retorna true se user free atingiu limite de pacientes
export function usePatientLimitReached() {
  const { data: tier } = useMyTier()
  const { data: patients = [] } = usePatients()
  if (PRO_FEATURE_TIERS.includes(tier)) return false
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
