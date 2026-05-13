/**
 * notifications/channels.js — Android channels + cancelAll central.
 * #030 (release v0.2.0.11): split de notifications.js.
 */

import { CHANNEL_ID, isNative } from './prefs'
import { cancelAllCriticalAlarms, cancelCriticalAlarm } from '../criticalAlarm'

// #215 v0.2.3.0 — canais unificados pra refactor scheduler 3-cenários.
// `dosy_tray`     — push tray normal (Alarme Crítico OFF) com som default + vibração
// `dosy_tray_dnd` — push tray dentro DnD com vibração leve 200ms + SEM som
//
// Channel sound + vibration são immutable após criação Android — precisa novo ID
// pra mudar comportamento. Antigos `doses_v2` (LocalNotifications), `doses_critical`
// (AlarmService FG), `doses_critical_v2` (AlarmReceiver fallback) ficam órfãos —
// cleanup migration code em MainActivity boot (#222).
export const TRAY_CHANNEL_ID = 'dosy_tray'
export const TRAY_DND_CHANNEL_ID = 'dosy_tray_dnd'

export async function ensureChannel() {
  if (!isNative) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    // Canal `dosy_tray` — push tray normal (caso Alarme Crítico OFF)
    await LocalNotifications.createChannel({
      id: TRAY_CHANNEL_ID,
      name: 'Lembretes de Dose',
      description: 'Lembretes de doses agendadas',
      importance: 5,        // IMPORTANCE_HIGH (heads-up + som default)
      visibility: 1,        // VISIBILITY_PUBLIC
      vibration: true,
      lights: true
    })
    // Canal `dosy_tray_dnd` — push silencioso dentro DnD (vibração leve)
    await LocalNotifications.createChannel({
      id: TRAY_DND_CHANNEL_ID,
      name: 'Lembretes — Não Perturbe',
      description: 'Lembretes silenciosos dentro da janela Não Perturbe',
      importance: 3,        // IMPORTANCE_DEFAULT (sem heads-up + sem som)
      visibility: 1,        // VISIBILITY_PUBLIC
      vibration: true,      // vibração leve definida no schedule (pattern via Notification)
      lights: false,
      sound: null           // explicit sem som
    })
    // Compat: cria também canal legado pra LocalNotifications agendadas pré-#215.
    // Pode ser removido após 1-2 releases (todas notifs antigas drained).
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Doses de Medicação (legado)',
      description: 'Canal legado pré-v0.2.3.0',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true
    })
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
 * #222 v0.2.3.0 — cleanup canais legados (doses_v2, doses_critical_v2).
 * Channel `doses_critical` permanece (usado AlarmService FG sound null — MediaPlayer drives).
 * Chamado em MainActivity onCreate / boot do app uma vez por install fresh.
 *
 * Nota: Capacitor LocalNotifications/PushNotifications plugins não expõem
 * `deleteChannel` API. Cleanup precisa ser feito Java-side via
 * NotificationManager.deleteNotificationChannel — implementado em MainActivity.
 */
export const LEGACY_CHANNELS_TO_DELETE = ['doses_v2', 'doses_critical_v2']

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
