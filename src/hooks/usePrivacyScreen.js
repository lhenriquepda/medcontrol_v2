import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'

/**
 * usePrivacyScreen — Aud 4.5.4 G2/G3.
 * Ativa FLAG_SECURE no Android (bloqueia screenshot + mask em recents view + screen recording)
 * enquanto componente estiver montado. Desativa ao desmontar.
 *
 * Usar em telas com info médica sensível: DoseModal, PatientDetail, Reports, DoseHistory.
 *
 * Pulado no Dosy Dev (debug variant `.dev` package) — permite screenshots + screen recording
 * pra captura de assets store / demos / vídeos sem ritual. Dosy oficial (release variant)
 * mantém FLAG_SECURE ativo normalmente.
 *
 * No-op em web.
 */
export function usePrivacyScreen(active = true) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !active) return
    let cancelled = false
    let plugin = null
    ;(async () => {
      try {
        const info = await CapApp.getInfo().catch(() => null)
        if (info?.id?.endsWith('.dev')) return
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
