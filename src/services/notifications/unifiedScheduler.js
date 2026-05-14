/**
 * unifiedScheduler.js — helper único pra decidir branch alarme/push por dose.
 *
 * #215 v0.2.3.0 — refactor scheduler unificado 3-cenários.
 *
 * 3 branches:
 *   1. push_critical_off — prefs.criticalAlarm=false → só LocalNotification tray
 *   2. push_dnd           — DnD ON + dose em janela → só LocalNotification tray vibração leve
 *   3. alarm_plus_push    — caso normal → alarme nativo + LocalNotification backup co-agendada
 *
 * Janela dinâmica: itens projetados > 400 (margem 100 do limit ~500 Android) → 24h, senão 48h.
 *
 * Helper consumido por:
 *   - Cenário 01 (App.jsx top-level useEffect → scheduler.js rescheduleAll)
 *   - Cenário 02 (mutationRegistry onSettled → reagenda só dose alterada)
 *   - Cenário 03a (DoseSyncWorker Java — paridade via AlarmScheduler.scheduleDoseAlarm)
 *   - Cenário 03b (daily-alarm-sync Edge → FCM data → DosyMessagingService → AlarmScheduler.scheduleDoseAlarm)
 */

import { doseIdToNumber, inDnd, SCHEDULE_WINDOW_MS } from './prefs'

// Offset pra ID de LocalNotification backup (anti-collision com alarmId nativo).
// AlarmManager IDs e LocalNotification IDs vivem em namespaces distintos mas
// usamos offset alto pra garantir zero colisão também com DAILY_SUMMARY_NOTIF_ID
// (999000001) que ocupa o topo.
// #215 v0.2.3.0 fix overflow device-validation 2026-05-13: 700M → 2^30 (1073741824).
// doseIdToNumber range agora [0, 2^30-1]. groupId + BACKUP_OFFSET ≤ 2^31-1 = Java MAX_INT.
// Antes: groupId 1.69B + 700M = 2.39B overflow → Capacitor LocalNotifications.schedule
// rejeita silent ("identifier should be Java int") + Java AlarmScheduler aceita overflow
// negativo → TrayNotificationReceiver órfão pendente AlarmManager → 2 push duplicados.
export const BACKUP_OFFSET = 1073741824 // 2^30

// Janela dinâmica — Android limit ~500 itens (alarmes + notificações) por app.
// Margem 100 → threshold 400. Acima → cai horizon pra 24h.
export const ITEM_LIMIT_THRESHOLD = 400
export const HORIZON_FULL_MS = SCHEDULE_WINDOW_MS // 48h
export const HORIZON_REDUCED_MS = 24 * 3600 * 1000 // 24h

// Vibração leve pattern (ms) — usado em path push_dnd.
// Pattern: [waitBeforeFirstVibration, vibrateDuration, pauseDuration, vibrateDuration, ...]
export const DND_VIBRATION_PATTERN = [0, 200] // single short pulse 200ms

/**
 * Decide branch de uma dose (sem efeito colateral — pura).
 *
 * @param {Object} dose — { id, scheduledAt, medName, unit, patientId, patientName }
 * @param {Object} prefs — { criticalAlarm, dndEnabled, dndStart, dndEnd, advanceMins }
 * @returns {{ branch: string, criticalEligible: boolean, inDndWindow: boolean }}
 */
export function decideBranch(dose, prefs) {
  const criticalOn = prefs.criticalAlarm !== false // default true
  const isDnd = inDnd(dose.scheduledAt, prefs)

  if (!criticalOn) {
    return { branch: 'push_critical_off', criticalEligible: false, inDndWindow: isDnd }
  }
  if (isDnd) {
    return { branch: 'push_dnd', criticalEligible: true, inDndWindow: true }
  }
  return { branch: 'alarm_plus_push', criticalEligible: true, inDndWindow: false }
}

/**
 * Janela dinâmica baseada em projeção de itens.
 * Para cada dose: 2 itens se branch=alarm_plus_push, 1 item caso contrário.
 *
 * @param {Array} doses — lista filtrada já-pendentes futuras
 * @param {Object} prefs
 * @returns {{ horizonMs: number, projectedItems: number }}
 */
export function computeHorizon(doses, prefs) {
  let projected = 0
  for (const dose of doses) {
    const { branch } = decideBranch(dose, prefs)
    projected += branch === 'alarm_plus_push' ? 2 : 1
  }
  const horizonMs = projected > ITEM_LIMIT_THRESHOLD ? HORIZON_REDUCED_MS : HORIZON_FULL_MS
  return { horizonMs, projectedItems: projected }
}

/**
 * Constrói payload pra agendamento de uma dose ou grupo (mesmo minute key).
 * Retorna objetos que o caller deve usar pra chamar CriticalAlarm.scheduleGroup
 * e LocalNotifications.schedule.
 *
 * Group = lista de doses no mesmo minute key. Branch decidida pelo primeiro item.
 * (Doses no mesmo minuto compartilham mesma window DnD + mesmas prefs → mesma branch.)
 *
 * @param {Array} group — array de doses (>=1) com mesmo scheduledAt-minute
 * @param {Object} prefs
 * @returns {{
 *   branch: string,
 *   groupId: number,
 *   alarmPayload: ?object,        // se branch=alarm_plus_push
 *   trayNotifPayload: ?object,    // se branch=push_* OR branch=alarm_plus_push (backup)
 *   metadata: object,             // pra audit log
 * }}
 */
export function buildSchedulePayload(group, prefs) {
  if (!Array.isArray(group) || group.length === 0) return null

  const firstDose = group[0]
  const { branch, criticalEligible, inDndWindow } = decideBranch(firstDose, prefs)

  // groupKey determinístico: doseIds ordenados join '|'
  const groupKey = group.map(d => d.id).sort().join('|')
  const groupId = doseIdToNumber(groupKey)

  const at = new Date(firstDose.scheduledAt)
  const doseIdsCsv = group.map(d => d.id).join(',')

  const sharedExtra = {
    type: 'dose',
    doseIds: doseIdsCsv,
    scheduledAt: firstDose.scheduledAt,
    branch,
    inDnd: inDndWindow,
  }

  // Alarme nativo (só caso branch=alarm_plus_push)
  let alarmPayload = null
  if (branch === 'alarm_plus_push') {
    alarmPayload = {
      id: groupId,
      at: at.toISOString(),
      doses: group.map(d => ({
        doseId: d.id,
        medName: d.medName,
        unit: d.unit,
        patientName: d.patientName || '',
        scheduledAt: d.scheduledAt,
      })),
    }
  }

  // LocalNotification tray — sempre agendada (em push_* paths é o ÚNICO aviso;
  // em alarm_plus_push é backup que AlarmReceiver cancela ao disparar)
  const title = group.length === 1 ? 'Dosy 💊' : `💊 ${group.length} doses agora`
  const body = group.length === 1
    ? `${firstDose.medName} — ${firstDose.unit}`
    : group.map(d => `${d.medName} (${d.unit})`).join(' · ')

  const trayId = branch === 'alarm_plus_push' ? groupId + BACKUP_OFFSET : groupId
  const channelId = branch === 'push_dnd' ? 'dosy_tray_dnd' : 'dosy_tray'

  const trayNotifPayload = {
    id: trayId,
    title,
    body,
    largeBody: body,
    summaryText: group.length === 1 ? undefined : `${group.length} doses`,
    schedule: { at, allowWhileIdle: true },
    extra: sharedExtra,
    channelId,
    autoCancel: true,
  }

  const metadata = {
    branch,
    groupId,
    groupSize: group.length,
    criticalAlarmEnabled: prefs.criticalAlarm !== false,
    dndEnabled: !!prefs.dndEnabled,
    inDndWindow,
    criticalEligible,
    backupOffset: branch === 'alarm_plus_push' ? BACKUP_OFFSET : null,
  }

  return { branch, groupId, alarmPayload, trayNotifPayload, metadata }
}
