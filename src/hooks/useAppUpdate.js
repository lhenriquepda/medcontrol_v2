import { useEffect, useState, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'

/* eslint-disable no-undef */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
/* eslint-enable no-undef */

const isNative = Capacitor.isNativePlatform()

// Web-only fallback. Native ignora — usa Play Store In-App Updates API.
const VERSION_URL = 'https://dosy-teal.vercel.app/version.json'
const CHECK_INTERVAL_MS = 30 * 60 * 1000  // every 30 min while open
const DISMISS_KEY = 'dosy_update_dismissed_version'

/** Compares "1.2.3" semver strings. Returns true if `a > b`. */
function isNewer(a, b) {
  const as = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0)
  const bs = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const av = as[i] ?? 0
    const bv = bs[i] ?? 0
    if (av > bv) return true
    if (av < bv) return false
  }
  return false
}

/**
 * useAppUpdate — version availability detector + update trigger.
 *
 * NATIVE (Android): Google Play In-App Updates API (flexible mode).
 *   - getAppUpdateInfo() reads Play Store directly — source of truth = Play Console
 *   - Banner aparece sempre que availableVersion > currentVersion (NÃO dismiss)
 *   - Tap "Atualizar" → startFlexibleUpdate (download bg, app continua usável)
 *   - Download done → banner vira "Reiniciar" → completeFlexibleUpdate restarts app
 *   - Falha graceful: erro plugin = retorna available=false, app não trava
 *
 * WEB: legacy fetch /version.json from Vercel (deployed bundle).
 *   - Tap → window.location.reload()
 *   - User pode dispensar (DISMISS_KEY persiste em localStorage)
 */
export function useAppUpdate() {
  const [latest, setLatest] = useState(null)
  const [downloaded, setDownloaded] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1 download fraction
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) } catch { return null }
  })
  const listenerRef = useRef(null)

  // ─── Native check (Play Store) ──────────────────────────────────────
  const checkNative = useCallback(async () => {
    try {
      const { AppUpdate } = await import('@capawesome/capacitor-app-update')
      const info = await AppUpdate.getAppUpdateInfo()
      // updateAvailability: 1=NOT_AVAILABLE, 2=UPDATE_AVAILABLE, 3=DEVELOPER_TRIGGERED_IN_PROGRESS
      // installStatus: 0=UNKNOWN, 1=PENDING, 2=DOWNLOADING, 11=DOWNLOADED, 4=INSTALLED, 5=FAILED, 6=CANCELED
      if (info.updateAvailability === 2 && info.flexibleUpdateAllowed) {
        setLatest({
          version: info.availableVersion ?? `code ${info.availableVersionCode}`,
          source: 'play'
        })
      } else {
        setLatest(null)
      }
      if (info.installStatus === 11) setDownloaded(true)
    } catch (e) {
      console.log('[useAppUpdate] native check skipped:', e?.message || e)
    }
  }, [])

  // ─── Web check (Vercel) ─────────────────────────────────────────────
  const checkWeb = useCallback(async () => {
    try {
      const res = await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setLatest({ ...data, source: 'web' })
    } catch {
      // network/404 → ignore silently
    }
  }, [])

  const check = useCallback(() => {
    if (isNative) return checkNative()
    return checkWeb()
  }, [checkNative, checkWeb])

  useEffect(() => {
    check()
    const t = setInterval(check, CHECK_INTERVAL_MS)
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [check])

  // ─── Native: subscribe a download state changes ─────────────────────
  useEffect(() => {
    if (!isNative) return
    let active = true
    ;(async () => {
      try {
        const { AppUpdate } = await import('@capawesome/capacitor-app-update')
        const handle = await AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
          if (!active) return
          // installStatus codes (Google Play Core)
          if (state.installStatus === 2 && state.bytesDownloaded && state.totalBytesToDownload) {
            setProgress(state.bytesDownloaded / state.totalBytesToDownload)
          }
          if (state.installStatus === 11) setDownloaded(true)
        })
        listenerRef.current = handle
      } catch (e) {
        console.log('[useAppUpdate] listener skipped:', e?.message)
      }
    })()
    return () => {
      active = false
      listenerRef.current?.remove?.()
    }
  }, [])

  // ─── Trigger update ────────────────────────────────────────────────
  const startUpdate = useCallback(async () => {
    if (!isNative) {
      window.location.reload()
      return
    }
    try {
      const { AppUpdate } = await import('@capawesome/capacitor-app-update')
      await AppUpdate.startFlexibleUpdate()
    } catch (e) {
      console.error('[useAppUpdate] start failed:', e?.message)
    }
  }, [])

  const completeUpdate = useCallback(async () => {
    if (!isNative) return
    try {
      const { AppUpdate } = await import('@capawesome/capacitor-app-update')
      await AppUpdate.completeFlexibleUpdate()
    } catch (e) {
      console.error('[useAppUpdate] complete failed:', e?.message)
    }
  }, [])

  // ─── Availability flag ─────────────────────────────────────────────
  // Native: banner só some quando versão atual = última (após restart)
  // Web: banner desaparece quando user dispensa explicitamente
  const isWebNewer = !isNative && latest?.version && isNewer(latest.version, APP_VERSION)
  let available = isNative
    ? !!latest                              // sempre exibe enquanto Play reporta update
    : (isWebNewer && dismissed !== latest.version)

  // Debug toggle: set window.__dosyForceUpdate=true em runtime pra forçar banner
  // sem update real (preview visual). Default off em produção.
  if (typeof window !== 'undefined' && window.__dosyForceUpdate === true) {
    available = true
  }

  const dismiss = () => {
    if (latest) {
      localStorage.setItem(DISMISS_KEY, latest.version)
      setDismissed(latest.version)
    }
  }

  return {
    available,
    current: APP_VERSION,
    latest,
    downloaded,
    progress,
    isNative,
    startUpdate,
    completeUpdate,
    dismiss,
    recheck: check
  }
}
