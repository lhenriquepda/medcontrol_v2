/**
 * notifications/scheduler.js — rescheduleAll + path web legacy.
 * #030 (release v0.2.0.11): split de notifications.js.
 * #207 (release v0.2.1.7): drop diff-and-apply, sempre full reschedule + Sentry breadcrumbs.
 */

import * as Sentry from '@sentry/react'
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
import { ensureChannel, cancelAll, cancelGroup, loadScheduledState, saveScheduledState, clearScheduledState } from './channels'
import { logAuditEvent, logAuditEventsBatch } from './auditLog'

/**
 * Re-agenda baseado em doses + prefs atuais.
 *
 * Item #207 (release v0.2.1.7) — REVERTE diff-and-apply de #200.1.
 * Reasoning: idempotência via localStorage `dosy_scheduled_groups_v1` causa
 * drift silencioso quando OEM agressivo (Samsung One UI 7) mata AlarmManager
 * mas localStorage cache continua dizendo "agendado". Diff vazio → não re-agenda
 * → AlarmManager fica vazio → alarme NÃO TOCA. App de medicação não pode
 * tolerar essa janela de incerteza.
 *
 * Agora: SEMPRE full cancelAll + reschedule from scratch. Custo: ~200-2000ms
 * janela curta sem alarmes (mitigação: roda async em background event loop,
 * usuário não percebe). Garantia: AlarmManager state SEMPRE bate com doses
 * pendentes do DB no momento da execução.
 *
 * Item #207 — `advanceMins ?? 0` (alinha DEFAULT_PREFS useUserPrefs.js).
 * Antes: `?? 15` agendava alarme 15min ANTES do horário da dose se prefs
 * locais não tinham campo explícito. Causava alarmes prematuros + confusão
 * user. DEFAULT_PREFS sempre declara 0 (alarme exato no horário).
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
  const adv = prefs.advanceMins ?? 0  // #207: alinha DEFAULT_PREFS (alarme exato)
  const pushOn = prefs.push === true
  const criticalOn = prefs.criticalAlarm !== false  // default true
  const summaryOn = prefs.dailySummary === true

  // Item #207 — força full cancelAll SEMPRE (drop idempotência diff-and-apply
  // de #200.1). Garante AlarmManager limpa state real antes re-agendar todos.
  Sentry.addBreadcrumb({
    category: 'alarm',
    message: 'rescheduleAll START',
    level: 'info',
    data: { dosesCount: doses.length, patientsCount: patients.length }
  })
  console.log('[Notif] reschedule START — full cancelAll')
  // Audit log: batch_start
  logAuditEvent({
    action: 'batch_start',
    metadata: { dosesCount: doses.length, patientsCount: patients.length }
  })
  await cancelAll()

  // Setup channel (idempotent, OK chamar sempre)
  await ensureChannel()

  // Verificar capability de exact alarm (Android 12+)
  let canExact = true
  try {
    const en = await checkCriticalAlarmEnabled()
    canExact = en?.canScheduleExact !== false
  } catch (e) { console.warn('[Notif] checkExact:', e?.message) }
  const canRingAlarm = criticalOn && isCriticalAlarmAvailable() && canExact

  console.log('[Notif] reschedule — push:', pushOn, 'critical:', criticalOn, 'dnd:', !!prefs.dndEnabled, 'summary:', summaryOn, 'advanceMins:', adv)

  const patientsMap = new Map((patients || []).map(p => [p.id, p]))
  const enriched = (doses || []).map(d => enrichDose(d, patientsMap))
  const upcoming = filterUpcoming(enriched)
  const groups = groupByMinute(upcoming)

  // Item #207 — full reschedule (sem diff-and-apply). Calcula state desejado
  // e agenda do zero. Estado persistido em localStorage só pra observabilidade
  // (debug + telemetria), não pra controle de fluxo.
  const desired = new Map() // groupId → { group, at, isDndWin, shouldRing, doseIdsCsv, hash }
  if (pushOn) {
    for (const [, group] of groups) {
      const at = new Date(new Date(group[0].scheduledAt).getTime() - adv * 60000)
      if (at.getTime() <= Date.now()) continue
      const groupKey = group.map(d => d.id).sort().join('|')
      const groupId = doseIdToNumber(groupKey)
      const doseIdsCsv = group.map(d => d.id).join(',')
      const isDndWin = inDnd(group[0].scheduledAt, prefs)
      const shouldRing = canRingAlarm && !isDndWin
      const hash = `${at.toISOString()}|${groupKey}|${shouldRing ? 'r' : 't'}|${group[0].scheduledAt}`
      desired.set(groupId, { hash, group, at, isDndWin, shouldRing, doseIdsCsv })
    }
  }

  console.log('[Notif] groups to schedule:', desired.size)

  const localNotifs = []
  let alarmsScheduled = 0
  let dndSkipped = 0
  const newState = {}

  // Schedule todos
  for (const [groupId, d] of desired) {
    const { group, at, isDndWin, shouldRing, doseIdsCsv, hash } = d

    if (shouldRing) {
      try {
        await scheduleCriticalAlarmGroup({
          id: groupId,
          at: at.toISOString(),
          doses: group.map(dose => ({
            doseId: dose.id,
            medName: dose.medName,
            unit: dose.unit,
            patientName: dose.patientName || '',
            scheduledAt: dose.scheduledAt
          }))
        })
        alarmsScheduled += group.length
        newState[groupId] = hash

        // Audit log: cada dose do grupo agendada como alarme crítico
        logAuditEventsBatch(group.map(dose => ({
          action: 'scheduled',
          doseId: dose.id,
          scheduledAt: dose.scheduledAt,
          patientName: dose.patientName || null,
          medName: dose.medName || null,
          metadata: {
            groupId,
            groupSize: group.length,
            ringAt: at.toISOString(),
            advanceMins: adv,
            kind: 'critical_alarm'
          }
        })))

        // Item #083.7 — reporta dose_alarms_scheduled pra cada dose
        try {
          const deviceId = await getDeviceId()
          if (deviceId && hasSupabase) {
            const rows = group.map(dose => ({
              doseId: dose.id,
              userId: dose.userId,
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
        console.error('[Notif] alarm schedule fail at groupId', groupId, ':', e?.message || e)
      }
    } else if (isDndWin && criticalOn) {
      dndSkipped += group.length
      newState[groupId] = hash
      logAuditEventsBatch(group.map(dose => ({
        action: 'skipped',
        doseId: dose.id,
        scheduledAt: dose.scheduledAt,
        patientName: dose.patientName || null,
        medName: dose.medName || null,
        metadata: { groupId, reason: 'dnd_window' }
      })))
    }

    // Push notif (tray) — só se NÃO vai tocar alarme crítico.
    if (!shouldRing) {
      const title = group.length === 1 ? 'Dosy 💊' : `💊 ${group.length} doses agora`
      const body = group.length === 1
        ? `${group[0].medName} — ${group[0].unit}`
        : group.map(dose => `${dose.medName} (${dose.unit})`).join(' · ')
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
      newState[groupId] = hash

      // Audit: local tray notif agendado (não critical)
      logAuditEventsBatch(group.map(dose => ({
        action: 'scheduled',
        doseId: dose.id,
        scheduledAt: dose.scheduledAt,
        patientName: dose.patientName || null,
        medName: dose.medName || null,
        metadata: {
          groupId,
          groupSize: group.length,
          ringAt: at.toISOString(),
          advanceMins: adv,
          kind: 'local_notif',
          dndWindow: isDndWin
        }
      })))
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
  if (localNotifs.length === 0 && !summaryOn) {
    // Item #207 — persiste state pra observabilidade (debug + getScheduledIds futuro).
    saveScheduledState(newState)
    console.log('[Notif] reschedule END — nothing to schedule')
    return { alarms: alarmsScheduled, dndSkipped, localNotifs: 0, summary: false }
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    if (localNotifs.length > 0) {
      const result = await LocalNotifications.schedule({ notifications: localNotifs })
      console.log('[Notif] reschedule END — alarms:', alarmsScheduled, '/ dnd-skipped:', dndSkipped, '/ local:', result?.notifications?.length, '/ summary:', summaryOn)
    } else {
      console.log('[Notif] reschedule END — alarms:', alarmsScheduled, '/ dnd-skipped:', dndSkipped, '/ local: 0 / summary:', summaryOn)
    }
  } catch (e) {
    console.error('[Notif] LocalNotifications.schedule FAILED:', e?.message || e)
    // Schedule batch falhou. Alarmes críticos podem estar agendados mas tray notifs não.
    // Limpar state força próximo rescheduleAll fazer reset completo (safe fallback).
    clearScheduledState()
    return { alarms: alarmsScheduled, dndSkipped, localNotifs: 0, summary: summaryOn, error: true }
  }

  // Persist state pra observabilidade.
  saveScheduledState(newState)

  Sentry.addBreadcrumb({
    category: 'alarm',
    message: 'rescheduleAll END',
    level: 'info',
    data: {
      alarmsScheduled,
      dndSkipped,
      localNotifs: localNotifs.length,
      summary: summaryOn,
      advanceMins: adv,
      groupsCount: desired.size
    }
  })

  // Audit log: batch_end
  logAuditEvent({
    action: 'batch_end',
    metadata: {
      alarmsScheduled,
      dndSkipped,
      localNotifs: localNotifs.length,
      summary: summaryOn,
      advanceMins: adv,
      groupsCount: desired.size
    }
  })

  return { alarms: alarmsScheduled, dndSkipped, localNotifs: localNotifs.length, summary: summaryOn }
}

// ─── WEB PUSH LEGACY ──────────────────────────────────────────────────────────

export async function rescheduleAllWeb(doses, patients, prefsOverride) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (Notification.permission !== 'granted') return
  const prefs = prefsOverride || loadPrefs()
  const adv = prefs.advanceMins ?? 0  // #207: alinha DEFAULT_PREFS
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
