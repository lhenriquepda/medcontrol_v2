import { useEffect, useState, useCallback } from 'react'

/* eslint-disable no-undef */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
/* eslint-enable no-undef */

// Absolute URL — Capacitor native serves '/version.json' from local bundle (always
// matches built version, never reports an update). Use Vercel deployed URL instead.
const VERSION_URL = 'https://dosy-teal.vercel.app/version.json'
const CHECK_INTERVAL_MS = 30 * 60 * 1000  // every 30 min while open
const DISMISS_KEY = 'dosy_update_dismissed_version'

/**
 * Compares "1.2.3" semver strings. Returns true if `a > b`.
 */
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
 * useAppUpdate — checks /version.json against current bundle on mount + every
 * 30 min while app is open. Returns latest version + apkUrl when newer.
 *
 * UpdateBanner component renders banner if `available` true. Tap → opens
 * installUrl page (or apkUrl direct).
 */
export function useAppUpdate() {
  const [latest, setLatest] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) } catch { return null }
  })

  const check = useCallback(async () => {
    try {
      const res = await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setLatest(data)
    } catch {
      // network/404 → ignore silently
    }
  }, [])

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

  const available = latest && isNewer(latest.version, APP_VERSION) && dismissed !== latest.version

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
    dismiss,
    recheck: check
  }
}
