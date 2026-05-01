import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'

/**
 * useAppResume — handle app coming back from background/inactive state.
 *
 * Issue: app fica travado quando volta do background após muito tempo.
 * Causas comuns:
 *   - WebSocket Supabase realtime morto, não reconecta sozinho
 *   - React Query cache stale, mas refetchOnWindowFocus não dispara
 *     em alguns webviews mobile (visibilitychange ≠ focus event)
 *   - Service Worker cached old chunks, JS state corrompido
 *   - Render frozen porque Suspense/Promise nunca resolveu
 *
 * Solução:
 *   - Native: Capacitor `appStateChange` (isActive)
 *   - Web: `document.visibilitychange` (visible)
 *   - On resume:
 *     - Curto (<5min inativo): invalida queries críticas
 *     - Longo (≥5min inativo): hard reload pra reset state completo
 *
 * Mount once em App.jsx top-level.
 */
const STALE_RELOAD_THRESHOLD_MS = 5 * 60 * 1000 // 5min

export function useAppResume() {
  const qc = useQueryClient()
  const lastActiveRef = useRef(Date.now())

  useEffect(() => {
    const onResume = () => {
      const inactiveMs = Date.now() - lastActiveRef.current
      lastActiveRef.current = Date.now()

      if (inactiveMs >= STALE_RELOAD_THRESHOLD_MS) {
        // Inativo muito tempo — reload completo pra evitar app travado.
        // Force-redirect pra home (/) — reload simples preservaria URL atual
        // e abriria em /ajustes ou outra página interna após cold-resume.
        console.log('[useAppResume] inactive', Math.round(inactiveMs / 1000), 's → reload to home')
        if (typeof window !== 'undefined') {
          window.location.href = '/'
        }
      } else {
        // Curto — só invalida queries pra refresh data
        console.log('[useAppResume] inactive', Math.round(inactiveMs / 1000), 's → invalidate')
        qc.invalidateQueries()
      }
    }

    const onPause = () => {
      lastActiveRef.current = Date.now()
    }

    // Web: document visibility change
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        onResume()
      } else {
        onPause()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Web: window focus/blur (fallback)
    window.addEventListener('focus', onResume)
    window.addEventListener('blur', onPause)

    // Native: Capacitor app state
    let stateHandle
    if (Capacitor.isNativePlatform()) {
      ;(async () => {
        stateHandle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) onResume()
          else onPause()
        })
      })()
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('blur', onPause)
      stateHandle?.remove?.()
    }
  }, [qc])
}
