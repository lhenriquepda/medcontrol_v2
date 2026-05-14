/**
 * notifications/channels.js — Android channels + cancelAll central.
 * #030 (release v0.2.0.11): split de notifications.js.
 */

import { isNative } from './prefs'
import { cancelAllCriticalAlarms, cancelAllTrays } from '../criticalAlarm'

// v0.2.3.1 — canais unificados pra Plano A (Java AlarmScheduler.ensureTrayChannel cria com config correto).
// `dosy_tray`        — push tray normal (Alarme Crítico OFF) com som default + vibração
// `dosy_tray_dnd_v2` — push tray dentro DnD com vibração leve 200ms + SEM som
//   v2 forced rename: Capacitor LocalNotifications.createChannel ignora `sound:null`
//   e criava `dosy_tray_dnd` com som default. Channel immutable pós-criação → bump
//   ID força Android criar novo channel com config correto via Java side.
// v0.2.3.1 Plano A — Capacitor LocalNotifications.createChannel REMOVIDO pra trays.
// Java AlarmScheduler.ensureTrayChannel cria channel sob-demand com sound:null pra DnD.
// Daily summary ainda usa Capacitor mas channel TRAY_CHANNEL_ID (dosy_tray) compartilhado.
export const TRAY_CHANNEL_ID = 'dosy_tray'
export const TRAY_DND_CHANNEL_ID = 'dosy_tray_dnd_v2'

export async function ensureChannel() {
  if (!isNative) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    // Canal `dosy_tray` — push tray normal + daily summary (Plano A mantém Capacitor pra daily summary)
    await LocalNotifications.createChannel({
      id: TRAY_CHANNEL_ID,
      name: 'Lembretes de Dose',
      description: 'Lembretes de doses agendadas',
      importance: 5,        // IMPORTANCE_HIGH (heads-up + som default)
      visibility: 1,        // VISIBILITY_PUBLIC
      vibration: true,
      lights: true
    })
    // Canal `dosy_tray_dnd_v2` é criado por Java AlarmScheduler.ensureTrayChannel sob-demand
    // (Capacitor LocalNotifications.createChannel ignora sound:null — bug Capacitor).
  } catch (e) { console.warn('[Notif] createChannel:', e?.message || e) }
}

export async function ensureFcmChannel() {
  if (!isNative) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    // FCM push regular (servidor → cliente) — usa mesmo canal tray principal
    await PushNotifications.createChannel({
      id: TRAY_CHANNEL_ID,
      name: 'Lembretes de Dose',
      description: 'Lembretes de doses agendadas',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true
    })
  } catch (e) { console.warn('[FCM] createChannel:', e?.message || e) }
}

/**
 * Cleanup canais legados deletados em MainActivity.cleanupLegacyChannels:
 *   doses_v2 (LocalNotifications pré-#215)
 *   doses_critical_v2 (AlarmReceiver fallback pré-#215)
 *   dosy_tray_dnd (Capacitor criou com som default por bug — substituído por dosy_tray_dnd_v2)
 */
export const LEGACY_CHANNELS_TO_DELETE = ['doses_v2', 'doses_critical_v2', 'dosy_tray_dnd']

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
  // v0.2.3.1 Plano A — cancelAll cobre 3 fontes:
  //  1) Critical alarms (AlarmReceiver PendingIntents) via CriticalAlarm.cancelAll
  //  2) Tray notifications Java (TrayNotificationReceiver) via cancelAllTrays
  //  3) Capacitor LocalNotifications (daily summary apenas pós-refactor)
  try { await cancelAllCriticalAlarms() } catch (e) { console.warn('[Notif] cancelAll alarms:', e?.message) }
  try { await cancelAllTrays() } catch (e) { console.warn('[Notif] cancelAll trays:', e?.message) }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch (e) { console.warn('[Notif] cancelAll local:', e?.message) }
}

/**
 * State tracker em localStorage pra diff-and-apply.
 * Map<groupId, hash> permite detectar groups removidos/alterados/novos.
 */
const SCHEDULED_STATE_KEY = 'dosy_scheduled_groups_v1'

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
