import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * usePrivacyScreen — Aud 4.5.4 G2/G3.
 * Ativa FLAG_SECURE no Android (bloqueia screenshot + mask em recents view + screen recording)
 * enquanto componente estiver montado. Desativa ao desmontar.
 *
 * Usar em telas com info médica sensível: DoseModal, PatientDetail, Reports, DoseHistory.
 *
 * No-op em web (Notification.permission etc não aplicável).
 */
export function usePrivacyScreen(active = true) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !active) return
    let cancelled = false
    let plugin = null
    ;(async () => {
      try {
        const mod = await import('@capacitor-community/privacy-screen')
        plugin = mod.PrivacyScreen
        if (cancelled) return
        await plugin.enable()
      } catch (e) {
        // Plugin failure não-fatal — log silenciosamente
      }
    })()
    return () => {
      cancelled = true
      if (plugin) {
        try { plugin.disable() } catch {}
      }
    }
  }, [active])
}
