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

export async function openExactAlarmSettings() {
  if (!isCriticalAlarmAvailable()) return
  return CriticalAlarm.openExactAlarmSettings()
}
