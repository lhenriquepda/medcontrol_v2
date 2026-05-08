/**
 * notifications/channels.js — Android channels + cancelAll central.
 * #030 (release v0.2.0.11): split de notifications.js.
 */

import { CHANNEL_ID, isNative } from './prefs'
import { cancelAllCriticalAlarms, cancelCriticalAlarm } from '../criticalAlarm'

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
 *
 * Item #200.1 (release v0.2.1.5): mantida pra fallback (primeira execução
 * pós-install + casos de recovery). Fluxo padrão usa cancelGroup() pra
 * preservar alarmes não-modificados.
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

/**
 * Item #200.1 (release v0.2.1.5) — cancela 1 grupo específico.
 * Cobre tanto critical alarm (id grupo) quanto LocalNotification tray
 * (mesmo id grupo — vide doseIdToNumber em scheduler.js que gera id estável).
 *
 * Usado pelo rescheduleAll diff-and-apply: alarmes não-modificados ficam,
 * só os removidos/alterados são cancelados.
 */
export async function cancelGroup(groupId) {
  if (!isNative || groupId == null) return
  try { await cancelCriticalAlarm(groupId) } catch (e) { console.warn('[Notif] cancelGroup alarm:', groupId, e?.message) }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: groupId }] })
  } catch (e) { console.warn('[Notif] cancelGroup local:', groupId, e?.message) }
}

/**
 * Item #200.1 — state tracker em localStorage pra diff-and-apply.
 * Map<groupId, hash> permite detectar groups removidos/alterados/novos
 * sem precisar consultar SharedPreferences nativo.
 */
const SCHEDULED_STATE_KEY = 'dosy_scheduled_groups_v1'

export function loadScheduledState() {
  try {
    const raw = localStorage.getItem(SCHEDULED_STATE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (e) {
    console.warn('[Notif] loadScheduledState corrupted, resetting:', e?.message)
    try { localStorage.removeItem(SCHEDULED_STATE_KEY) } catch { /* ignore */ }
    return {}
  }
}

export function saveScheduledState(map) {
  try {
    localStorage.setItem(SCHEDULED_STATE_KEY, JSON.stringify(map || {}))
  } catch (e) {
    console.warn('[Notif] saveScheduledState fail:', e?.message)
  }
}

export function clearScheduledState() {
  try { localStorage.removeItem(SCHEDULED_STATE_KEY) } catch { /* ignore */ }
}
