import { useQuery } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'
import { useAuth } from './useAuth'

/**
 * useAccessiblePatientIds — retorna lista de patient IDs acessíveis pelo user.
 *
 * Inclui:
 *   - Pacientes próprios (`patients.userId = user.id`)
 *   - Pacientes recebidos via share (`patient_shares.sharedWithUserId = user.id`)
 *
 * Gemini Fase 4 ADR-016 v0.2.8.3 (Opção D pós-QA cross-account):
 *
 *   Realtime postgres_changes filter aceita `patientId.in.(uuid1,uuid2,...)`.
 *   Permite cross-account sync (cuidador vê dose marcada pelo dono) sem subscribe
 *   sem filter (que traria todos events de todos users — egress catastrófico).
 *
 *   Trade-off: hook precisa rodar antes do useRealtime saber QUAIS pacientes
 *   observar. staleTime 5min + refetchOnFocus cobre adição/remoção de share.
 *
 * Gate Realtime:
 *   sharedCount > 0 → faz sentido (há cuidador-mode ou multi-device do mesmo user)
 *   sharedCount = 0 (user solo sem share enviado/recebido) → skip subscribe
 *
 * Returns:
 *   {
 *     patientIds: string[]           // todos UUIDs acessíveis (próprios + compartilhados)
 *     ownedCount: number             // só próprios
 *     sharedCount: number            // só recebidos
 *     hasCollabContext: boolean      // true se user ENVIOU share OR RECEBEU share
 *     isLoading: boolean
 *   }
 */
export function useAccessiblePatientIds() {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['accessible-patient-ids', user?.id],
    enabled: hasSupabase && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5min
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      if (!user?.id) return { ownIds: [], sharedIds: [], outboundSharedCount: 0 }
      // 1. Próprios pacientes
      const { data: own, error: errOwn } = await supabase
        .from('patients')
        .select('id')
      if (errOwn) {
        console.warn('[useAccessiblePatientIds] own fail:', errOwn.message)
        return { ownIds: [], sharedIds: [], outboundSharedCount: 0 }
      }
      const ownIds = (own || []).map((p) => p.id)

      // 2. Compartilhados (recebidos)
      const nowIso = new Date().toISOString()
      const { data: shared, error: errShared } = await supabase
        .from('patient_shares')
        .select('patientId, expiresAt')
        .eq('sharedWithUserId', user.id)
      if (errShared) {
        console.warn('[useAccessiblePatientIds] shared fail:', errShared.message)
        return { ownIds, sharedIds: [], outboundSharedCount: 0 }
      }
      const sharedIds = (shared || [])
        .filter((s) => !s.expiresAt || s.expiresAt > nowIso)
        .map((s) => s.patientId)

      // 3. Conta shares enviados (user é OWNER que compartilhou com outros)
      // pra decidir se Realtime tem valor mesmo quando user solo nas tabelas dele
      const { count: outboundCount, error: errOut } = await supabase
        .from('patient_shares')
        .select('id', { count: 'exact', head: true })
        .eq('ownerId', user.id)
        .or(`expiresAt.is.null,expiresAt.gt.${nowIso}`)
      const outboundSharedCount = errOut ? 0 : (outboundCount || 0)

      return { ownIds, sharedIds, outboundSharedCount }
    },
  })

  const ownIds = data?.ownIds || []
  const sharedIds = data?.sharedIds || []
  const outboundSharedCount = data?.outboundSharedCount || 0
  // Set pra dedup eventual overlap
  const patientIds = [...new Set([...ownIds, ...sharedIds])]
  // Valor de Realtime: tem cuidador-mode quando user recebeu OU enviou share
  const hasCollabContext = sharedIds.length > 0 || outboundSharedCount > 0

  return {
    patientIds,
    ownedCount: ownIds.length,
    sharedCount: sharedIds.length,
    outboundSharedCount,
    hasCollabContext,
    isLoading,
  }
}
