import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyTier, listAllUsers, grantTier, FREE_PATIENT_LIMIT } from '../services/subscriptionService'
import { usePatients } from './usePatients'
import { useAuth } from './useAuth'

export { FREE_PATIENT_LIMIT }

export function useMyTier() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my_tier', user?.id],
    queryFn: getMyTier,
    // BUG fix (v0.1.7.5): query só roda quando user autenticado.
    // Antes: race com auth.getUser() retornava null cached por 30min,
    // tratando user logado como 'free' → paywall em paciente novo
    // mesmo pra usuários plus/pro.
    enabled: !!user,
    // #092 (v0.1.7.5): tier raramente muda (admin grant). 60s → 30min.
    staleTime: 30 * 60_000
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
  const { data: tier, isLoading: tierLoading } = useMyTier()
  const { data: patients = [], isLoading: patientsLoading } = usePatients()
  // BUG fix (v0.1.7.5): durante loading inicial, NÃO assumir worst case.
  // Antes: tier undefined → !PRO_FEATURE_TIERS.includes(undefined) → true se >=1 paciente.
  // Disparava paywall em users plus/pro durante mount race.
  if (tierLoading || patientsLoading || tier == null) return false
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
