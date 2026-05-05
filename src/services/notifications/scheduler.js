/**
 * notifications/scheduler.js — rescheduleAll + path web legacy.
 * #030 (release v0.2.0.11): split de notifications.js.
 */

import { supabase, hasSupabase } from '../supabase'
import {
  scheduleCriticalAlarmGroup,
  isCriticalAlarmAvailable,
  checkCriticalAlarmEnabled,
  getDeviceId
} from '../criticalAlarm'
import {
  CHANNEL_ID,
  DAILY_SUMMARY_NOTIF_ID,
  isNative,
  loadPrefs,
  doseIdToNumber,
  inDnd,
  groupByMinute,
  filterUpcoming,
  enrichDose
} from './prefs'
import { ensureChannel, cancelAll } from './channels'

/**
 * Re-agenda TUDO baseado em doses + prefs atuais.
 * Idempotente: cancela tudo primeiro, então agenda do zero.
 *
 * @param {Object} params
 * @param {Array} params.doses — todas doses do user (filtra interna por status+window)
 * @param {Array} params.patients — pra enriquecer com patientName
 * @param {Object} [params.prefsOverride] — força prefs customizadas (default: lê do storage)
 */
export async function rescheduleAll({ doses = [], patients = [], prefsOverride = null } = {}) {
  if (!isNative) {
    return rescheduleAllWeb(doses, patients, prefsOverride)
  }

  const prefs = prefsOverride || loadPrefs()
  const adv = prefs.advanceMins ?? 15
  const pushOn = prefs.push === true
  const criticalOn = prefs.criticalAlarm !== false  // default true
  const summaryOn = prefs.dailySummary === true

  // 1. Cancelar tudo (sempre, antes de qualquer agendamento)
  await cancelAll()

  // 2. Setup channel
  await ensureChannel()

  // 3. Verificar capability de exact alarm (Android 12+)
  let canExact = true
  try {
    const en = await checkCriticalAlarmEnabled()
    canExact = en?.canScheduleExact !== false
  } catch (e) { console.warn('[Notif] checkExact:', e?.message) }
  const canRingAlarm = criticalOn && isCriticalAlarmAvailable() && canExact

  console.log('[Notif] reschedule START — push:', pushOn, 'critical:', criticalOn, 'dnd:', !!prefs.dndEnabled, 'summary:', summaryOn)

  const patientsMap = new Map((patients || []).map(p => [p.id, p]))
  const enriched = (doses || []).map(d => enrichDose(d, patientsMap))
  const upcoming = filterUpcoming(enriched)
  const groups = groupByMinute(upcoming)

  const localNotifs = []
  let alarmsScheduled = 0
  let dndSkipped = 0

  // ─── DOSE NOTIFS + ALARMS (apenas se push master ON) ────────────────────────
  if (pushOn) {
    for (const [key, group] of groups) {
      const at = new Date(new Date(group[0].scheduledAt).getTime() - adv * 60000)
      if (at.getTime() <= Date.now()) continue

      const groupKey = group.map(d => d.id).sort().join('|')
      const groupId = doseIdToNumber(groupKey)
      const doseIdsCsv = group.map(d => d.id).join(',')
      const isDndWin = inDnd(group[0].scheduledAt, prefs)
      const shouldRing = canRingAlarm && !isDndWin

      // Critical alarm (fullscreen + som loop) — só se pode tocar
      if (shouldRing) {
        try {
          await scheduleCriticalAlarmGroup({
            id: groupId,
            at: at.toISOString(),
            doses: group.map(d => ({
              doseId: d.id,
              medName: d.medName,
              unit: d.unit,
              patientName: d.patientName || '',
              scheduledAt: d.scheduledAt
            }))
          })
          alarmsScheduled += group.length

          // Item #083.7 — reporta dose_alarms_scheduled pra cada dose
          // permitindo notify-doses cron skip push tray (alarme nativo cobre).
          // Best-effort: falha aqui não rollback alarme.
          try {
            const deviceId = await getDeviceId()
            if (deviceId && hasSupabase) {
              const rows = group.map(d => ({
                doseId: d.id,
                userId: d.userId,
                deviceId,
                via: 'app-foreground'
              }))
              const { error } = await supabase
                .from('dose_alarms_scheduled')
                .upsert(rows, { onConflict: 'doseId,deviceId', ignoreDuplicates: true })
              if (error) console.warn('[Notif] dose_alarms_scheduled upsert:', error.message)
            }
          } catch (e) {
            console.warn('[Notif] report alarm scheduled fail:', e?.message)
          }
        } catch (e) {
          console.error('[Notif] alarm schedule fail at', key, ':', e?.message || e)
        }
      } else if (isDndWin && criticalOn) {
        dndSkipped += group.length
      }

      // Push notif (tray) — só se NÃO vai tocar alarme crítico.
      // Quando alarme toca, AlarmService já posta FG notif com 3 actions —
      // local notif duplicaria (user vê 2 notifs iguais).
      if (!shouldRing) {
        const title = group.length === 1 ? 'Dosy 💊' : `💊 ${group.length} doses agora`
        const body = group.length === 1
          ? `${group[0].medName} — ${group[0].unit}`
          : group.map(d => `${d.medName} (${d.unit})`).join(' · ')
        localNotifs.push({
          id: groupId,
          title,
          body,
          largeBody: body,
          summaryText: group.length === 1 ? undefined : `${group.length} doses`,
          schedule: { at, allowWhileIdle: true },
          extra: { type: 'dose', doseIds: doseIdsCsv, scheduledAt: group[0].scheduledAt, dnd: isDndWin },
          channelId: CHANNEL_ID,
          autoCancel: true
        })
      }
    }
  }

  // ─── DAILY SUMMARY (independente de push master) ────────────────────────────
  if (summaryOn) {
    const [hh, mm] = (prefs.summaryTime || '07:00').split(':').map(Number)
    const nextFire = new Date()
    nextFire.setHours(hh, mm, 0, 0)
    if (nextFire.getTime() <= Date.now()) nextFire.setDate(nextFire.getDate() + 1)

    const in24h = Date.now() + 24 * 3600 * 1000
    const next24Count = (doses || []).filter(d => {
      const t = new Date(d.scheduledAt).getTime()
      return d.status === 'pending' && t >= Date.now() && t <= in24h
    }).length
    const overdueCount = (doses || []).filter(d => d.status === 'overdue').length

    let body = `${next24Count} dose${next24Count === 1 ? '' : 's'} nas próximas 24h`
    if (overdueCount > 0) body += ` · ${overdueCount} atrasada${overdueCount === 1 ? '' : 's'}`
    if (next24Count === 0 && overdueCount === 0) body = 'Nenhuma dose nas próximas 24h.'

    localNotifs.push({
      id: DAILY_SUMMARY_NOTIF_ID,
      title: '📅 Dosy — Resumo do dia',
      body,
      schedule: { at: nextFire, every: 'day', allowWhileIdle: true },
      channelId: CHANNEL_ID,
      autoCancel: true,
      extra: { type: 'dailySummary' }
    })
  }

  // ─── COMMIT LOCAL NOTIFS ────────────────────────────────────────────────────
  if (localNotifs.length === 0) {
    console.log('[Notif] reschedule END — nothing scheduled')
    return { alarms: 0, dndSkipped: 0, localNotifs: 0, summary: false }
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const result = await LocalNotifications.schedule({ notifications: localNotifs })
    console.log('[Notif] reschedule END — alarms:', alarmsScheduled, '/ dnd-skipped:', dndSkipped, '/ local:', result?.notifications?.length, '/ summary:', summaryOn)
  } catch (e) {
    console.error('[Notif] LocalNotifications.schedule FAILED:', e?.message || e)
  }

  return { alarms: alarmsScheduled, dndSkipped, localNotifs: localNotifs.length, summary: summaryOn }
}

// ─── WEB PUSH LEGACY ──────────────────────────────────────────────────────────

export async function rescheduleAllWeb(doses, patients, prefsOverride) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (Notification.permission !== 'granted') return
  const prefs = prefsOverride || loadPrefs()
  const adv = prefs.advanceMins ?? 15
  const upcoming = filterUpcoming(doses)
  const reg = await navigator.serviceWorker.ready
  const sw = reg.active || reg.waiting || reg.installing
  if (!sw) return
  sw.postMessage({
    type: 'SCHEDULE_DOSES',
    doses: upcoming.map((d) => ({
      id: d.id, medName: d.medName, unit: d.unit, scheduledAt: d.scheduledAt, advanceMins: adv
    }))
  })
}
