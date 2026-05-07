/**
 * useInAppReview — #170 (v0.2.1.3): smart in-app review prompt trigger.
 *
 * Strategy: prompt user só após múltiplos sinais positivos compostos pra
 * minimizar negative reviews. Google Play quota = 4-5 prompts/year per user
 * — gastar wisely.
 *
 * Trigger conditions (TODOS devem true simultaneamente):
 *   1. ≥7 dias install (não no boot)
 *   2. ≥3 doses confirmadas (engagement real)
 *   3. ≥1 alarme nativo disparado OK (#007 alarm_fired event tracked)
 *   4. Não foi prompted antes (lifetime once via localStorage)
 *   5. Última sessão ativa <24h (user retornou)
 *
 * Web: no-op (Play Store specific).
 *
 * Plugin: @capacitor-community/in-app-review v8.x — Google Play Core API
 * onSuccess: dialog mostrado (não significa user reviewed — Google opaque)
 * onError: quota exceeded OR API unavailable
 */
import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { track, EVENTS } from '../services/analytics'

const isNative = Capacitor.isNativePlatform()

// localStorage keys
const LS_INSTALLED_AT = 'dosy_installed_at'
const LS_DOSE_CONFIRMED_COUNT = 'dosy_dose_confirmed_count'
const LS_ALARM_FIRED_COUNT = 'dosy_alarm_fired_count'
const LS_LAST_ACTIVE_AT = 'dosy_last_active_at'
const LS_REVIEW_PROMPTED_AT = 'dosy_review_prompted_at'

// Thresholds
const MIN_INSTALL_DAYS = 7
const MIN_DOSES_CONFIRMED = 3
const MIN_ALARMS_FIRED = 1
const MAX_LAST_ACTIVE_HOURS = 24

/**
 * Increment counter localStorage. Use no callback de events (DOSE_CONFIRMED,
 * ALARM_FIRED) pra acumular signals.
 */
export function incrementReviewSignal(signal) {
  try {
    if (signal === 'dose_confirmed') {
      const n = parseInt(localStorage.getItem(LS_DOSE_CONFIRMED_COUNT) || '0', 10)
      localStorage.setItem(LS_DOSE_CONFIRMED_COUNT, String(n + 1))
    } else if (signal === 'alarm_fired') {
      const n = parseInt(localStorage.getItem(LS_ALARM_FIRED_COUNT) || '0', 10)
      localStorage.setItem(LS_ALARM_FIRED_COUNT, String(n + 1))
    }
  } catch { /* ignore quota */ }
}

/**
 * Mark app session active — chamado a cada app resume / pageview.
 * Tracking last active timestamp permite detectar user retornou
 * (não show prompt em first-ever boot).
 */
export function markActive() {
  try {
    const now = Date.now()
    if (!localStorage.getItem(LS_INSTALLED_AT)) {
      localStorage.setItem(LS_INSTALLED_AT, String(now))
    }
    localStorage.setItem(LS_LAST_ACTIVE_AT, String(now))
  } catch { /* ignore */ }
}

/**
 * Check todas conditions + trigger Play Core review dialog se elegível.
 * Idempotent — safe chamar múltiplas vezes.
 */
export async function tryRequestReview() {
  if (!isNative) return { shown: false, reason: 'web' }

  try {
    // Already prompted before? Lifetime once.
    if (localStorage.getItem(LS_REVIEW_PROMPTED_AT)) {
      return { shown: false, reason: 'already_prompted' }
    }

    const installedAt = parseInt(localStorage.getItem(LS_INSTALLED_AT) || '0', 10)
    const lastActiveAt = parseInt(localStorage.getItem(LS_LAST_ACTIVE_AT) || '0', 10)
    const dosesConfirmed = parseInt(localStorage.getItem(LS_DOSE_CONFIRMED_COUNT) || '0', 10)
    const alarmsFired = parseInt(localStorage.getItem(LS_ALARM_FIRED_COUNT) || '0', 10)

    const now = Date.now()
    const installDays = installedAt ? (now - installedAt) / 86_400_000 : 0
    const lastActiveHours = lastActiveAt ? (now - lastActiveAt) / 3_600_000 : Infinity

    if (installDays < MIN_INSTALL_DAYS) {
      return { shown: false, reason: `install_too_recent_${installDays.toFixed(1)}d` }
    }
    if (dosesConfirmed < MIN_DOSES_CONFIRMED) {
      return { shown: false, reason: `low_dose_engagement_${dosesConfirmed}` }
    }
    if (alarmsFired < MIN_ALARMS_FIRED) {
      return { shown: false, reason: `no_alarm_validated_${alarmsFired}` }
    }
    if (lastActiveHours > MAX_LAST_ACTIVE_HOURS) {
      return { shown: false, reason: `inactive_${lastActiveHours.toFixed(1)}h` }
    }

    // Eligible — trigger Play Core dialog
    const { InAppReview } = await import('@capacitor-community/in-app-review')
    await InAppReview.requestReview()

    // Mark prompted (independente user clicou ou não — Google opaque)
    localStorage.setItem(LS_REVIEW_PROMPTED_AT, String(now))
    track(EVENTS.REVIEW_PROMPT_SHOWN, {
      installDays: Math.round(installDays),
      dosesConfirmed,
      alarmsFired,
    })
    return { shown: true, reason: 'shown' }
  } catch (e) {
    const msg = e?.message || String(e)
    // Google Play Core quota exceeded é silent error
    if (/quota|limit|throttl/i.test(msg)) {
      track(EVENTS.REVIEW_PROMPT_SKIPPED_QUOTA, { error: msg })
      return { shown: false, reason: 'quota_exceeded' }
    }
    track(EVENTS.REVIEW_PROMPT_FAILED, { error: msg })
    console.log('[useInAppReview] failed:', msg)
    return { shown: false, reason: 'error', error: msg }
  }
}

/**
 * Hook integração App.jsx — mark active no mount + agenda check review
 * 30s pós mount (não prompt no boot — feel intrusive).
 */
export function useInAppReview() {
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (!isNative) return undefined
    markActive()

    // Delay 30s pós mount — user já interagiu com app, não é first impression
    const timer = setTimeout(() => {
      if (triggeredRef.current) return
      triggeredRef.current = true
      tryRequestReview().catch(() => { /* swallow */ })
    }, 30_000)

    return () => clearTimeout(timer)
  }, [])
}
