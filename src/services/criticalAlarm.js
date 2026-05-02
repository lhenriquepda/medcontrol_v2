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
 * Schedule a critical alarm.
 * @param {Object} params
 * @param {number} params.id — alarm id (use stable hash from doseId)
 * @param {string} params.at — ISO timestamp (must be in future)
 * @param {string} params.doseId
 * @param {string} params.medName
 * @param {string} params.unit
 * @param {string} [params.patientName]
 */
export async function scheduleCriticalAlarm({ id, at, doseId, medName, unit, patientName }) {
  if (!isCriticalAlarmAvailable()) {
    console.warn('[CriticalAlarm] not available on this platform')
    return null
  }
  return CriticalAlarm.schedule({ id, at, doseId, medName, unit, patientName: patientName || '' })
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
 *     canDrawOverlay, notifsEnabled, allGranted }
 */
export async function checkAllPermissions() {
  if (!isCriticalAlarmAvailable()) {
    return {
      canPostNotifications: false, canScheduleExact: false,
      canFullScreenIntent: false, canDrawOverlay: false,
      notifsEnabled: false, allGranted: false
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
export async function setSyncCredentials({ supabaseUrl, anonKey, userId, refreshToken, schema, criticalAlarmEnabled }) {
  if (!isCriticalAlarmAvailable()) return null
  return CriticalAlarm.setSyncCredentials({
    supabaseUrl,
    anonKey,
    userId,
    refreshToken,
    schema: schema || 'medcontrol',
    // Item #085 (release v0.1.7.3) — propaga toggle Alarme Crítico pro
    // SharedPreferences Android. DoseSyncWorker + DosyMessagingService
    // leem essa flag antes de agendar alarme nativo.
    // Default true mantém comportamento atual (alarme ON) se não passado.
    criticalAlarmEnabled: criticalAlarmEnabled !== false
  })
}

/**
 * Item #085 — atualização incremental do toggle Alarme Crítico no
 * SharedPreferences Android. Chamado pelo useUserPrefs.mutationFn quando
 * user mexe no toggle em Ajustes. Sem precisar redo full sync de creds.
 */
export async function setCriticalAlarmEnabled(enabled) {
  if (!isCriticalAlarmAvailable()) return null
  return CriticalAlarm.setCriticalAlarmEnabled({ enabled: enabled !== false })
}

export async function clearSyncCredentials() {
  if (!isCriticalAlarmAvailable()) return null
  return CriticalAlarm.clearSyncCredentials()
}

/**
 * Item #083.6 — device_id estável (UUID v4 gerado pelo plugin uma vez,
 * persistido). Usado por rescheduleAll() pra reportar dose_alarms_scheduled
 * cross-device, e por notify-doses cron pra skip push redundante.
 */
export async function getDeviceId() {
  if (!isCriticalAlarmAvailable()) return null
  const r = await CriticalAlarm.getDeviceId()
  return r?.deviceId || null
}
