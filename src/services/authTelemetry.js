/**
 * Item #201 (release v0.2.1.5) — telemetria auth events.
 *
 * Helper pra registrar eventos de auth (login/logout/spurious) na tabela
 * medcontrol.auth_events via RPC log_auth_event. Usado pelo painel admin
 * pra debugar padrões de logout transient em produção.
 *
 * Fail-safe: erros são silenciosos (telemetria nunca quebra fluxo de auth).
 */

import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { hasSupabase, supabase } from './supabase'

const isNative = Capacitor.isNativePlatform()

let cachedAppInfo = null
async function getAppInfoCached() {
  if (cachedAppInfo) return cachedAppInfo
  if (!isNative) {
    cachedAppInfo = {
      app_version: import.meta.env.VITE_APP_VERSION || null,
      app_build: null,
      platform: 'web',
    }
    return cachedAppInfo
  }
  try {
    const info = await CapacitorApp.getInfo()
    cachedAppInfo = {
      app_version: info?.version || null,
      app_build: info?.build || null,
      platform: 'android',
    }
  } catch (e) {
    cachedAppInfo = {
      app_version: null,
      app_build: null,
      platform: 'unknown',
      _error: e?.message,
    }
  }
  return cachedAppInfo
}

let cachedDeviceId = null
async function getDeviceIdCached() {
  if (cachedDeviceId !== null) return cachedDeviceId
  if (!isNative) {
    cachedDeviceId = null
    return null
  }
  try {
    const { getDeviceId } = await import('./criticalAlarm')
    cachedDeviceId = await getDeviceId()
  } catch {
    cachedDeviceId = null
  }
  return cachedDeviceId
}

/**
 * Registra evento de auth.
 * @param {string} eventType — 'sign_in' | 'sign_out' | 'sign_out_spurious_ignored' | 'session_recovered' | 'token_refreshed'
 * @param {Object} [extra] — { logoutKind, details }
 */
export async function logAuthEvent(eventType, extra = {}) {
  if (!hasSupabase) return
  try {
    const info = await getAppInfoCached()
    const deviceId = await getDeviceIdCached()
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null

    const { error } = await supabase.schema('medcontrol').rpc('log_auth_event', {
      p_event_type: eventType,
      p_app_version: info?.app_version,
      p_app_build: info?.app_build,
      p_platform: info?.platform,
      p_user_agent: userAgent ? userAgent.slice(0, 500) : null,
      p_device_id: deviceId,
      p_logout_kind: extra?.logoutKind || null,
      p_details: extra?.details ? extra.details : null,
    })
    if (error) {
      console.warn('[authTelemetry] log_auth_event err:', error.message)
    }
  } catch (e) {
    console.warn('[authTelemetry] log_auth_event exception:', e?.message)
  }
}
