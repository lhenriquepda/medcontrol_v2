import { useEffect, useState, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'

/* eslint-disable no-undef */
const BUNDLE_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
/* eslint-enable no-undef */

const isNative = Capacitor.isNativePlatform()

// #095 fix (v0.1.7.5): native app version source-of-truth = Android packageInfo
// (App.getInfo()), não JS bundle. Bundle pode ficar stale se cap sync não rodou
// antes do AAB build. PackageInfo reflete versionName real do APK instalado.
// Web continua usando bundle version (não tem nativo).
let cachedNativeVersion = null
async function getRealVersion() {
  if (!isNative) return BUNDLE_VERSION
  if (cachedNativeVersion) return cachedNativeVersion
  try {
    const { App } = await import('@capacitor/app')
    const info = await App.getInfo()
    cachedNativeVersion = info?.version || BUNDLE_VERSION
    return cachedNativeVersion
  } catch {
    return BUNDLE_VERSION
  }
}

// Web-only fallback. Native ignora — usa Play Store In-App Updates API.
// Item #103 BUG-032: URL hardcoded apontava 'dosy-teal.vercel.app' (preview
// antigo). Domínio real prod = dosy-app.vercel.app. Fetch ia 404 silent →
// latest=null → available=false → banner nunca aparecia. Fix: usar origin
// runtime quando web (mesmo deployment). Native ignora essa URL.
const VERSION_URL = typeof window !== 'undefined' && window.location?.origin
  ? `${window.location.origin}/version.json`
  : 'https://dosy-app.vercel.app/version.json'
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
  const [currentVersion, setCurrentVersion] = useState(BUNDLE_VERSION)
  const listenerRef = useRef(null)

  // #095 (v0.1.7.5): resolver versão real native (Android packageInfo)
  useEffect(() => {
    let active = true
    getRealVersion().then(v => { if (active) setCurrentVersion(v) })
    return () => { active = false }
  }, [])

  // ─── Native check (Play Store) ──────────────────────────────────────
  // #189 (v0.2.1.3): triple fallback chain pra resolver versionName ao invés
  // de versionCode no banner. Play Core API frequentemente retorna
  // info.availableVersion=undefined em Android < API 31 OR Play Core SDK older.
  // Fix: paralelo Play Core + version.json Vercel (canônico versionName) +
  // local map versionCode→versionName + fallback PT-BR friendly "versão N".
  const VERSION_CODE_TO_NAME = {
    46: '0.2.1.0',
    47: '0.2.1.1',
    48: '0.2.1.2',
    49: '0.2.1.3',
    50: '0.2.1.3',
    51: '0.2.1.3',
    52: '0.2.1.5',
    // adicionar próximas releases aqui
  }
  const checkNative = useCallback(async () => {
    try {
      const { AppUpdate } = await import('@capawesome/capacitor-app-update')
      // Paralelo: Play Core + version.json Vercel
      const [infoResult, webResult] = await Promise.allSettled([
        AppUpdate.getAppUpdateInfo(),
        fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ])
      const info = infoResult.status === 'fulfilled' ? infoResult.value : null
      const versionData = webResult.status === 'fulfilled' ? webResult.value : null

      // updateAvailability: 1=NOT_AVAILABLE, 2=UPDATE_AVAILABLE, 3=DEVELOPER_TRIGGERED_IN_PROGRESS
      // installStatus: 0=UNKNOWN, 1=PENDING, 2=DOWNLOADING, 11=DOWNLOADED, 4=INSTALLED, 5=FAILED, 6=CANCELED
      if (info?.updateAvailability === 2 && info.flexibleUpdateAllowed) {
        // Triple fallback chain pra resolver versionName user-friendly:
        // 1. Play Core availableVersion (versionName) — primary
        // 2. version.json Vercel (canônico web) — secondary
        // 3. Local map versionCode → versionName — tertiary
        // 4. PT-BR friendly "versão N" — final fallback (vs ugly "code N")
        const version =
          info.availableVersion
          ?? versionData?.version
          ?? VERSION_CODE_TO_NAME[info.availableVersionCode]
          ?? `versão ${info.availableVersionCode}`
        setLatest({ version, source: 'play' })
      } else {
        setLatest(null)
      }
      if (info?.installStatus === 11) setDownloaded(true)
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
  const isWebNewer = !isNative && latest?.version && isNewer(latest.version, currentVersion)
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
    current: currentVersion,
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
