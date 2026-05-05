/**
 * notifications/channels.js — Android channels + cancelAll central.
 * #030 (release v0.2.0.11): split de notifications.js.
 */

import { CHANNEL_ID, isNative } from './prefs'
import { cancelAllCriticalAlarms } from '../criticalAlarm'

export async function ensureChannel() {
  if (!isNative) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Doses de Medicação',
      description: 'Lembretes de doses agendadas',
      importance: 5,         // IMPORTANCE_HIGH (heads-up + som default)
      visibility: 1,         // VISIBILITY_PUBLIC
      vibration: true,
      lights: true
    })
  } catch (e) { console.warn('[Notif] createChannel:', e?.message || e) }
}

export async function ensureFcmChannel() {
  if (!isNative) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Doses de Medicação',
      description: 'Lembretes de doses agendadas',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true
    })
  } catch (e) { console.warn('[FCM] createChannel:', e?.message || e) }
}

/**
 * Cancela TODOS critical alarms + LocalNotifications pendentes.
 * Chame antes de re-agendar pra garantir estado limpo (idempotência).
 */
export async function cancelAll() {
  if (!isNative) return
  try { await cancelAllCriticalAlarms() } catch (e) { console.warn('[Notif] cancelAll alarms:', e?.message) }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch (e) { console.warn('[Notif] cancelAll local:', e?.message) }
}
