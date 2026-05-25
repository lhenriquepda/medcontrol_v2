import { useEffect, useState } from 'react'
import { realtimeManager } from '../core/realtime/manager'

/**
 * useRealtimeManager — Hook React que escuta o RealtimeManager (Fase 4 v0.2.8.2).
 *
 * Retorna snapshot reativo do estado:
 *   { isActive, isPaused, pauseReasons, featureFlagEnabled }
 *
 * useRealtime() consulta esse hook pra decidir se faz subscribe ou unsubscribe.
 * Quando isActive vira `true`, useRealtime re-monta o canal.
 * Quando vira `false`, useRealtime remove o canal.
 */
export function useRealtimeManager() {
  const [state, setState] = useState(() => ({
    isActive: realtimeManager.isActive,
    isPaused: realtimeManager.isPaused,
    pauseReasons: realtimeManager.pauseReasons,
    featureFlagEnabled: realtimeManager.featureFlagEnabled,
  }))

  useEffect(() => {
    return realtimeManager.subscribe((snapshot) => {
      setState(snapshot)
    })
  }, [])

  return state
}
