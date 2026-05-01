import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from '../services/supabase'

/**
 * useAppResume — handle app coming back from background/inactive state.
 *
 * Item #076 (release v0.1.7.0) — recovery sem reload destrutivo.
 *
 * Comportamento anterior: após 5min idle, força `window.location.href = '/'`.
 * Causava cold reload + tela branca + perda de URL + cascata de refetch.
 * Se algo falhasse no caminho (SW velho, JWT expirado, race), app ficava
 * travado até hard close do Chrome.
 *
 * Comportamento novo: soft recovery preservando URL.
 *   - Curto (<5min): invalida queries (refresh suave)
 *   - Longo (≥5min): refresh JWT → drop realtime channels → invalidate +
 *     refetch active queries. URL preservada. Sem reload.
 *
 * Alarme nativo Android (AlarmReceiver + SharedPreferences) é INDEPENDENTE
 * deste hook. Push FCM (background handler) também. Estes seguem disparando
 * normalmente durante idle.
 *
 * Mount once em App.jsx top-level.
 */
const SOFT_RECOVER_THRESHOLD_MS = 5 * 60 * 1000 // 5min

export function useAppResume() {
  const qc = useQueryClient()
  const lastActiveRef = useRef(Date.now())

  useEffect(() => {
    const onResume = async () => {
      const inactiveMs = Date.now() - lastActiveRef.current
      lastActiveRef.current = Date.now()

      if (inactiveMs >= SOFT_RECOVER_THRESHOLD_MS) {
        console.log('[useAppResume] long idle', Math.round(inactiveMs / 1000), 's → soft recover')
        try {
          // 1. Renovar JWT — Supabase rotaciona refresh token automaticamente.
          // Se refresh token expirou, retorna error e auth listener faz signOut.
          await supabase.auth.refreshSession()
          // 2. Drop dead websocket channels — useRealtime resubscribe via
          //    onAuthStateChange (TOKEN_REFRESHED) ou re-mount do hook.
          await supabase.removeAllChannels()
          // 3. Invalida tudo + refetch queries ativas.
          await qc.invalidateQueries()
          await qc.refetchQueries({ type: 'active' })
        } catch (err) {
          console.warn('[useAppResume] soft recover failed', err)
          // Fallback de último caso: reload preservando URL atual.
          if (typeof window !== 'undefined') window.location.reload()
        }
      } else {
        console.log('[useAppResume] short idle', Math.round(inactiveMs / 1000), 's → invalidate')
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
          if (isActive) {
            onResume()
          } else {
            onPause()
          }
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
