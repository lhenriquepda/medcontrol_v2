import { useEffect, useState, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'

/**
 * useAppLock — Aud 4.5.4 G7+G8.
 * Bloqueia app com biometria opcional + auto-lock após N min em background.
 *
 * Prefs (localStorage):
 *   - dosy_app_lock_enabled (bool) — toggle Settings
 *   - dosy_app_lock_timeout_min (int, default 5) — minutos em bg pra exigir re-auth
 *
 * Returns:
 *   { locked, biometricAvailable, unlock, lock, enable, disable, isEnabled }
 *
 * Native only. Web sempre retorna locked=false.
 */
const PREFS_ENABLED = 'dosy_app_lock_enabled'
const PREFS_TIMEOUT = 'dosy_app_lock_timeout_min'
const DEFAULT_TIMEOUT_MIN = 5

const isNative = Capacitor.isNativePlatform()

function readEnabled() {
  try {
    return localStorage.getItem(PREFS_ENABLED) === 'true'
  } catch {
    return false
  }
}

function readTimeout() {
  try {
    const v = parseInt(localStorage.getItem(PREFS_TIMEOUT) || String(DEFAULT_TIMEOUT_MIN), 10)
    return Number.isFinite(v) && v >= 1 ? v : DEFAULT_TIMEOUT_MIN
  } catch {
    return DEFAULT_TIMEOUT_MIN
  }
}

export function useAppLock() {
  const [locked, setLocked] = useState(() => false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [isEnabled, setIsEnabled] = useState(() => readEnabled())
  const lastActiveRef = useRef(Date.now())

  // Check biometric availability on mount
  useEffect(() => {
    if (!isNative) return
    ;(async () => {
      try {
        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
        const status = await BiometricAuth.checkBiometry()
        setBiometricAvailable(status?.isAvailable === true)
      } catch {
        setBiometricAvailable(false)
      }
    })()
  }, [])

  const unlock = useCallback(async () => {
    if (!isNative) {
      setLocked(false)
      return true
    }
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
      await BiometricAuth.authenticate({
        reason: 'Desbloquear Dosy',
        cancelTitle: 'Cancelar',
        allowDeviceCredential: true,
        iosFallbackTitle: 'Usar senha do celular',
        androidTitle: 'Dosy',
        androidSubtitle: 'Confirme sua identidade',
        androidConfirmationRequired: false,
      })
      setLocked(false)
      return true
    } catch (e) {
      // user cancelled or failed
      return false
    }
  }, [])

  const lock = useCallback(() => {
    if (isEnabled) setLocked(true)
  }, [isEnabled])

  const enable = useCallback(async () => {
    if (!isNative) return false
    // Test biometry once before saving
    const ok = await unlock()
    if (!ok) return false
    localStorage.setItem(PREFS_ENABLED, 'true')
    setIsEnabled(true)
    return true
  }, [unlock])

  const disable = useCallback(async () => {
    if (!isNative) return
    // Confirm with biometry before disabling (anti-tamper)
    const ok = await unlock()
    if (!ok) return
    localStorage.setItem(PREFS_ENABLED, 'false')
    setIsEnabled(false)
    setLocked(false)
  }, [unlock])

  // App lifecycle: lock on background after timeout
  useEffect(() => {
    if (!isNative || !isEnabled) return
    let bgListener, fgListener
    ;(async () => {
      bgListener = await CapApp.addListener('pause', () => {
        lastActiveRef.current = Date.now()
      })
      fgListener = await CapApp.addListener('resume', () => {
        const timeoutMs = readTimeout() * 60 * 1000
        if (Date.now() - lastActiveRef.current >= timeoutMs) {
          setLocked(true)
        }
      })
    })()
    return () => {
      bgListener?.remove?.()
      fgListener?.remove?.()
    }
  }, [isEnabled])

  // On mount, lock immediately if enabled
  useEffect(() => {
    if (isEnabled && isNative) setLocked(true)
  }, [isEnabled])

  return {
    locked,
    biometricAvailable,
    isEnabled,
    unlock,
    lock,
    enable,
    disable,
    timeoutMin: readTimeout(),
    setTimeoutMin: (n) => {
      const v = Math.max(1, Math.min(60, parseInt(n, 10) || DEFAULT_TIMEOUT_MIN))
      localStorage.setItem(PREFS_TIMEOUT, String(v))
    },
  }
}
