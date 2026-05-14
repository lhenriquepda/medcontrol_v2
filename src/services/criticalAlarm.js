/**
 * CriticalAlarm — bridge para plugin Android nativo.
 * Comporta-se como alarme do despertador:
 *   - Bypassa silencioso/DND (USAGE_ALARM stream)
 *   - Tela cheia mesmo lock screen
 *   - Som em loop até user dismissar
 *   - Vibração contínua
 */
import { registerPlugin } from '@capacitor/core'
import { Capacitor } from '@capacitor/core'

export const CriticalAlarm = registerPlugin('CriticalAlarm')

export function isCriticalAlarmAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/**
 * Schedule a grouped critical alarm (multiple doses at same trigger time).
 * @param {Object} params
 * @param {number} params.id — group id (use stable hash from concatenated doseIds)
 * @param {string} params.at — ISO timestamp
 * @param {Array<{doseId, medName, unit, patientName}>} params.doses
 */
export async function scheduleCriticalAlarmGroup({ id, at, doses }) {
  if (!isCriticalAlarmAvailable()) {
    console.warn('[CriticalAlarm] not available on this platform')
    return null
  }
  return CriticalAlarm.scheduleGroup({
    id,
    at,
    doses: doses.map(d => ({
      doseId: d.doseId,
      medName: d.medName || 'Dose',
      unit: d.unit || '',
      patientName: d.patientName || ''
    }))
  })
}

/**
 * v0.2.3.1 Plano A — bridge pra Java AlarmScheduler.scheduleTrayGroup.
 * Substitui Capacitor LocalNotifications.schedule pra trays de dose (foreground path).
 * Daily summary continua em Capacitor LocalNotifications (caso especial repeat=day).
 * Elimina dual tray race (M2 Java + M3 Capacitor coexistindo).
 */
export async function scheduleTrayGroup({ id, at, channelId, doses }) {
  if (!isCriticalAlarmAvailable()) return null
  return CriticalAlarm.scheduleTrayGroup({
    id,
    at,
    channelId: channelId || 'dosy_tray',
    doses: doses.map(d => ({
      doseId: d.doseId || d.id || '',
      medName: d.medName || 'Dose',
      unit: d.unit || '',
      patientName: d.patientName || '',
      scheduledAt: d.scheduledAt || ''
    }))
  })
}

export async function cancelTrayGroup(id) {
  if (!isCriticalAlarmAvailable() || id == null) return
  return CriticalAlarm.cancelTrayGroup({ id })
}

export async function cancelAllTrays() {
  if (!isCriticalAlarmAvailable()) return
  return CriticalAlarm.cancelAllTrays()
}

export async function cancelCriticalAlarm(id) {
  if (!isCriticalAlarmAvailable()) return
  return CriticalAlarm.cancel({ id })
}

export async function cancelAllCriticalAlarms() {
  if (!isCriticalAlarmAvailable()) return
  return CriticalAlarm.cancelAll()
}

export async function checkCriticalAlarmEnabled() {
  if (!isCriticalAlarmAvailable()) return { canScheduleExact: false, canFullScreenIntent: false }
  return CriticalAlarm.isEnabled()
}

/**
 * Full permission audit for the critical alarm subsystem.
 * Returns:
 *   { canPostNotifications, canScheduleExact, canFullScreenIntent,
 *     canDrawOverlay, notifsEnabled, ignoringBatteryOpt, allGranted }
 */
export async function checkAllPermissions() {
  if (!isCriticalAlarmAvailable()) {
    return {
      canPostNotifications: false, canScheduleExact: false,
      canFullScreenIntent: false, canDrawOverlay: false,
      notifsEnabled: false, ignoringBatteryOpt: false, allGranted: false
    }
  }
  return CriticalAlarm.checkPermissions()
}

export async function openExactAlarmSettings() {
  if (!isCriticalAlarmAvailable()) return
  return CriticalAlarm.openExactAlarmSettings()
}

export async function openFullScreenIntentSettings() {
  if (!isCriticalAlarmAvailable()) return
  return CriticalAlarm.openFullScreenIntentSettings()
}

export async function openOverlaySettings() {
  if (!isCriticalAlarmAvailable()) return
  return CriticalAlarm.openOverlaySettings()
}

export async function openAppNotificationSettings() {
  if (!isCriticalAlarmAvailable()) return
  return CriticalAlarm.openAppNotificationSettings()
}

/**
 * Item #207 — solicita user adicionar Dosy à whitelist battery optimization.
 * Abre dialog system Sim/Não. Crítico Samsung One UI 7 + Xiaomi MIUI.
 */
export async function requestIgnoreBatteryOptimizations() {
  if (!isCriticalAlarmAvailable()) return
  return CriticalAlarm.requestIgnoreBatteryOptimizations()
}

/**
 * Item #081 (release v0.1.7.1) — credentials pra DoseSyncWorker fazer
 * fetch autenticado em background. Plugin grava em SharedPreferences pra
 * Worker ler.
 *
 * Caminho 3 de 3 defense-in-depth: WorkManager periódico (6h) busca doses
 * próximas 72h e agenda alarmes nativos. Independe de app foreground /
 * websocket realtime / push FCM.
 *
 * Chamar após login (useAuth onAuthStateChange SIGNED_IN/TOKEN_REFRESHED)
 * pra Worker ter token de refresh atualizado.
 */
export async function setSyncCredentials({ supabaseUrl, anonKey, userId, refreshToken, accessToken, accessTokenExp, schema, criticalAlarmEnabled }) {
  if (!isCriticalAlarmAvailable()) return null
  // Item #205 (release v0.2.1.8) — inclui access_token + exp epoch ms. Native
  // (Worker + MessagingService) consome esse token cached em vez de chamar
  // /auth/v1/token?grant_type=refresh_token em paralelo (storm xx:00 fix).
  // JS supabase-js é ÚNICA fonte de refresh; native só lê o token cached.
  const payload = {
    supabaseUrl,
    anonKey,
    userId,
    refreshToken,
    schema: schema || 'medcontrol',
    // Item #085 (release v0.1.7.3) — propaga toggle Alarme Crítico pro
    // SharedPreferences Android. DoseSyncWorker + DosyMessagingService
    // leem essa flag antes de agendar alarme nativo.
    criticalAlarmEnabled: criticalAlarmEnabled !== false,
  }
  if (accessToken) payload.accessToken = accessToken
  if (typeof accessTokenExp === 'number' && accessTokenExp > 0) payload.accessTokenExp = accessTokenExp
  return CriticalAlarm.setSyncCredentials(payload)
}

/**
 * #215 v0.2.3.0 — sincroniza prefs (criticalAlarm + DnD) pro SharedPreferences
 * `dosy_user_prefs` Android. AlarmScheduler.scheduleDoseAlarm (helper unificado
 * usado por DoseSyncWorker + DosyMessagingService) lê dali pra decidir branch.
 *
 * Chamado por useUserPrefs.mutationFn sempre que prefs mudam.
 */
export async function syncUserPrefs(prefs) {
  if (!isCriticalAlarmAvailable() || !prefs) return null
  const payload = {}
  if (typeof prefs.criticalAlarm === 'boolean') payload.criticalAlarm = prefs.criticalAlarm
  if (typeof prefs.dndEnabled === 'boolean') payload.dndEnabled = prefs.dndEnabled
  if (typeof prefs.dndStart === 'string') payload.dndStart = prefs.dndStart
  if (typeof prefs.dndEnd === 'string') payload.dndEnd = prefs.dndEnd
  return CriticalAlarm.syncUserPrefs(payload)
}

export async function clearSyncCredentials() {
  if (!isCriticalAlarmAvailable()) return null
  return CriticalAlarm.clearSyncCredentials()
}

/**
 * Item #083.6 — device_id estável (UUID v4 gerado pelo plugin uma vez,
 * persistido). Usado por alarm_audit_log device_id cross-source consistency.
 */
export async function getDeviceId() {
  if (!isCriticalAlarmAvailable()) return null
  const r = await CriticalAlarm.getDeviceId()
  return r?.deviceId || null
}
