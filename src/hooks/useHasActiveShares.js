import { useQuery } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'
import { useAuth } from './useAuth'

/**
 * useHasActiveShares — verifica se o user tem QUALQUER patient_share ativo
 * (seja como dono que compartilhou, seja como cuidador recebendo).
 *
 * Gemini Fase 4 ADR-016 optimization (v0.2.8.2):
 *   Realtime é INÚTIL pra user solo (1 conta, sem compartilhamento) — não há
 *   segundo device/conta pra sincronizar. Esse hook habilita o gate adicional
 *   em useRealtime() pra evitar subscribe vazio (egress sem valor).
 *
 * Returns:
 *   { hasShares: boolean, isLoading: boolean }
 *
 * Cache:
 *   - staleTime 5min (compartilhamentos não mudam toda hora)
 *   - refetchOnWindowFocus true (pega novo share rápido pós-foreground)
 *   - refetchInterval false (deixa visibility/focus + manual invalidate cobrirem)
 *
 * Quando o count vira ≥1, o hook flipa e useRealtime re-subscribe automaticamente
 * via dep array do useEffect. Quando vira 0, useRealtime unsubscribe.
 */
export function useHasActiveShares() {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['has-active-shares', user?.id],
    enabled: hasSupabase && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5min
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      if (!user?.id) return 0
      // Conta shares onde user é dono OU recipient. PostgREST `count: 'exact'` evita
      // trazer rows (egress mínimo — só metadata header).
      // Patient_shares pode ter `expiresAt NULL` (permanente) ou futuro (temporário).
      const nowIso = new Date().toISOString()
      const { count, error } = await supabase
        .from('patient_shares')
        .select('id', { count: 'exact', head: true })
        .or(`userId.eq.${user.id},sharedWithUserId.eq.${user.id}`)
        .or(`expiresAt.is.null,expiresAt.gt.${nowIso}`)
      if (error) {
        // Em erro, fail-CLOSED (false) pra não subscribir inadvertidamente
        console.warn('[useHasActiveShares] count fail:', error.message)
        return 0
      }
      return count || 0
    },
  })

  return {
    hasShares: (data || 0) > 0,
    sharesCount: data || 0,
    isLoading,
  }
}
