/**
 * notifications/auditLog.js — captura de eventos de agendamento de alarme para
 * observabilidade via admin.dosymed.app. Configurável por user_id whitelist
 * (tabela `medcontrol.alarm_audit_config`).
 *
 * #209 v0.2.2.0 — debug duplicidade / sobreposição / inconsistência sources.
 *
 * Performance: helper SILENT-FAIL. Nunca bloqueia / lança / atrasa alarme.
 * Cache 5min do enabled flag pra evitar RPC roundtrip a cada call.
 */
import { supabase, hasSupabase } from '../supabase'

const SOURCE = 'js_scheduler'
const CACHE_TTL_MS = 5 * 60 * 1000

let cachedEnabled = null
let cacheExpiry = 0
let cachedUserId = null
let cachedDeviceId = null

async function getUserId() {
  if (cachedUserId) return cachedUserId
  try {
    const { data } = await supabase.auth.getUser()
    cachedUserId = data?.user?.id || null
    return cachedUserId
  } catch {
    return null
  }
}

async function getDeviceIdLazy() {
  if (cachedDeviceId) return cachedDeviceId
  try {
    const mod = await import('../criticalAlarm')
    cachedDeviceId = (await mod.getDeviceId()) || null
  } catch {
    cachedDeviceId = null
  }
  return cachedDeviceId
}

async function isEnabled() {
  if (!hasSupabase) return false
  if (Date.now() < cacheExpiry && cachedEnabled !== null) return cachedEnabled
  try {
    const { data, error } = await supabase.rpc('is_alarm_audit_enabled')
    if (error) {
      cachedEnabled = false
    } else {
      cachedEnabled = !!data
    }
    cacheExpiry = Date.now() + CACHE_TTL_MS
    return cachedEnabled
  } catch {
    cachedEnabled = false
    cacheExpiry = Date.now() + CACHE_TTL_MS
    return false
  }
}

/**
 * Loga vários eventos em batch (insert único). Silent-fail garantido.
 * @param {Array} events
 */
export async function logAuditEventsBatch(events) {
  try {
    if (!Array.isArray(events) || events.length === 0) return
    if (!(await isEnabled())) return
    const userId = await getUserId()
    if (!userId) return
    const deviceId = await getDeviceIdLazy()
    const rows = events.map(ev => ({
      user_id: userId,
      device_id: deviceId,
      dose_id: ev.doseId || null,
      source: ev.source || SOURCE,
      action: ev.action,
      scheduled_at: ev.scheduledAt || null,
      patient_name: ev.patientName || null,
      med_name: ev.medName || null,
      metadata: ev.metadata || {}
    }))
    const { error } = await supabase.from('alarm_audit_log').insert(rows)
    if (error && import.meta.env?.DEV) {
      console.warn('[AuditLog] batch insert error:', error.message)
    }
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[AuditLog] batch silent fail:', e?.message)
  }
}
