/**
 * notifications/scheduler.js — rescheduleAll + path web legacy.
 *
 * #215 v0.2.3.0 — REFATORADO pra usar unifiedScheduler.js helper único 3-cenários.
 * Antes lógica de decidir alarm vs tray vivia espalhada (advanceMins, criticalOn,
 * canRingAlarm, dndWin checks). Agora delegado a `buildSchedulePayload` que
 * retorna alarmPayload (opcional) + trayNotifPayload + metadata uniformizada.
 *
 * Throttle 30s + signature guard pós #211/#212 mantidos.
 * Audit log enriquecido com `branch` + `horizon` + `source_scenario`.
 */

import * as Sentry from '@sentry/react'
import {
  scheduleCriticalAlarmGroup,
  isCriticalAlarmAvailable,
  checkCriticalAlarmEnabled
} from '../criticalAlarm'
import {
  DAILY_SUMMARY_NOTIF_ID,
  isNative,
  loadPrefs,
  groupByMinute,
  filterUpcoming,
  enrichDose
} from './prefs'
import {
  ensureChannel,
  cancelAll,
  saveScheduledState,
  clearScheduledState,
  TRAY_CHANNEL_ID
} from './channels'
import { logAuditEventsBatch } from './auditLog'
import { buildSchedulePayload, computeHorizon } from './unifiedScheduler'

// #211 — throttle module-level. Realtime channel reconnect, useEffect deps changing,
// watchdog 60s, e queries refetch convergem em rescheduleAll frequente.
const RESCHEDULE_THROTTLE_MS = 30_000
let _lastRunAt = 0
let _pendingTrailing = null
let _pendingArgs = null

export async function rescheduleAll(args = {}) {
  if (!isNative) {
    return rescheduleAllWeb(args.doses, args.patients, args.prefsOverride)
  }

  const now = Date.now()
  const elapsed = now - _lastRunAt
  if (elapsed < RESCHEDULE_THROTTLE_MS) {
    _pendingArgs = args
    if (!_pendingTrailing) {
      const delay = RESCHEDULE_THROTTLE_MS - elapsed
      _pendingTrailing = setTimeout(() => {
        _pendingTrailing = null
        const a = _pendingArgs
        _pendingArgs = null
        rescheduleAll(a)
      }, delay)
      console.log(`[Notif] reschedule throttled — trailing run em ${delay}ms`)
    }
    return { throttled: true }
  }
  _lastRunAt = now
  if (_pendingTrailing) {
    clearTimeout(_pendingTrailing)
    _pendingTrailing = null
    _pendingArgs = null
  }

  return _rescheduleAllImpl(args)
}

/**
 * #215 — Cenário 01: app open / update / mudança de pref.
 * Reagenda TUDO from scratch (cancelAll + reschedule) baseado em doses + prefs atuais.
 *
 * @param {Object} params
 * @param {Array}  params.doses        — todas doses do user (filtra interna)
 * @param {Array}  params.patients     — pra enriquecer com patientName
 * @param {Object} [params.prefsOverride] — força prefs customizadas (default: loadPrefs())
 * @param {string} [params.sourceScenario] — 'app_open' | 'prefs_change' | 'manual'
 */
async function _rescheduleAllImpl({ doses = [], patients = [], prefsOverride = null, sourceScenario = 'app_open' } = {}) {
  const prefs = prefsOverride || loadPrefs()
  const summaryOn = prefs.dailySummary === true

  Sentry.addBreadcrumb({
    category: 'alarm',
    message: 'rescheduleAll START',
    level: 'info',
    data: { dosesCount: doses.length, patientsCount: patients.length, sourceScenario }
  })
  console.log('[Notif] reschedule START — full cancelAll, sourceScenario:', sourceScenario)

  const auditAccumulator = []
  auditAccumulator.push({
    action: 'batch_start',
    metadata: { dosesCount: doses.length, patientsCount: patients.length, source_scenario: sourceScenario }
  })

  await cancelAll()
  await ensureChannel()

  // Verifica permission Android exact alarm (only relevant pra branch alarm_plus_push)
  let canExact = true
  try {
    const en = await checkCriticalAlarmEnabled()
    canExact = en?.canScheduleExact !== false
  } catch (e) { console.warn('[Notif] checkExact:', e?.message) }
  const criticalEnabledNative = isCriticalAlarmAvailable() && canExact

  // Enriquece doses com patientName + filtra pending na janela 48h
  const patientsMap = new Map((patients || []).map(p => [p.id, p]))
  const enriched = (doses || []).map(d => enrichDose(d, patientsMap))
  const upcoming = filterUpcoming(enriched)

  // #215 decisão 8 — janela dinâmica baseada em projeção de itens
  const { horizonMs, projectedItems } = computeHorizon(upcoming, prefs)
  const horizonHours = Math.round(horizonMs / 3600000)
  const horizonCutoff = Date.now() + horizonMs
  const dosesInHorizon = upcoming.filter(d => new Date(d.scheduledAt).getTime() <= horizonCutoff)

  console.log(`[Notif] reschedule — push:${prefs.push} crit:${prefs.criticalAlarm} dnd:${!!prefs.dndEnabled} summary:${summaryOn} horizon:${horizonHours}h projected:${projectedItems}items`)

  // Group by minute (doses no mesmo minuto compartilham mesma branch decision)
  const groups = groupByMinute(dosesInHorizon)

  const localNotifs = []
  let alarmsScheduled = 0
  let trayScheduled = 0
  let dndCount = 0
  let criticalOffCount = 0
  const newState = {}

  for (const [, group] of groups) {
    const payload = buildSchedulePayload(group, prefs)
    if (!payload) continue

    const { branch, groupId, alarmPayload, trayNotifPayload, metadata } = payload

    // Branch alarm_plus_push: agenda alarme nativo + tray backup co-agendado
    if (branch === 'alarm_plus_push') {
      if (!criticalEnabledNative) {
        // Permission negada (canScheduleExact=false) — degradate gracefully pra só push
        console.warn('[Notif] alarm_plus_push solicitado mas permission negada — fallback pra só push tray')
        localNotifs.push(trayNotifPayload)
        trayScheduled++
        for (const dose of group) {
          auditAccumulator.push({
            action: 'scheduled',
            doseId: dose.id,
            scheduledAt: dose.scheduledAt,
            patientName: dose.patientName || null,
            medName: dose.medName || null,
            metadata: { ...metadata, branch: 'push_critical_off', degraded: true, reason: 'cannot_schedule_exact', source_scenario: sourceScenario, horizon: horizonHours }
          })
        }
        continue
      }
      try {
        await scheduleCriticalAlarmGroup(alarmPayload)
        alarmsScheduled += group.length
      } catch (e) {
        console.error('[Notif] alarm schedule fail at groupId', groupId, ':', e?.message || e)
        // Continua agendando tray backup mesmo se alarme falhar
      }
      localNotifs.push(trayNotifPayload)
      newState[groupId] = `${trayNotifPayload.schedule.at}|${branch}|${horizonHours}`
      for (const dose of group) {
        auditAccumulator.push({
          action: 'scheduled',
          doseId: dose.id,
          scheduledAt: dose.scheduledAt,
          patientName: dose.patientName || null,
          medName: dose.medName || null,
          metadata: { ...metadata, source_scenario: sourceScenario, horizon: horizonHours }
        })
      }
    }

    // Branch push_dnd: só tray (canal dosy_tray_dnd vibração leve)
    else if (branch === 'push_dnd') {
      localNotifs.push(trayNotifPayload)
      trayScheduled++
      dndCount += group.length
      newState[groupId] = `${trayNotifPayload.schedule.at}|${branch}|${horizonHours}`
      for (const dose of group) {
        auditAccumulator.push({
          action: 'scheduled',
          doseId: dose.id,
          scheduledAt: dose.scheduledAt,
          patientName: dose.patientName || null,
          medName: dose.medName || null,
          metadata: { ...metadata, source_scenario: sourceScenario, horizon: horizonHours }
        })
      }
    }

    // Branch push_critical_off: só tray (canal dosy_tray)
    else if (branch === 'push_critical_off') {
      localNotifs.push(trayNotifPayload)
      trayScheduled++
      criticalOffCount += group.length
      newState[groupId] = `${trayNotifPayload.schedule.at}|${branch}|${horizonHours}`
      for (const dose of group) {
        auditAccumulator.push({
          action: 'scheduled',
          doseId: dose.id,
          scheduledAt: dose.scheduledAt,
          patientName: dose.patientName || null,
          medName: dose.medName || null,
          metadata: { ...metadata, source_scenario: sourceScenario, horizon: horizonHours }
        })
      }
    }
  }

  // ─── DAILY SUMMARY (independente do refactor #215) ──────────────────────────
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
      channelId: TRAY_CHANNEL_ID,
      autoCancel: true,
      extra: { type: 'dailySummary' }
    })
  }

  // ─── COMMIT LocalNotifications ──────────────────────────────────────────────
  if (localNotifs.length === 0 && !summaryOn) {
    saveScheduledState(newState)
    console.log('[Notif] reschedule END — nothing to schedule')
    auditAccumulator.push({
      action: 'batch_end',
      metadata: {
        alarmsScheduled, trayScheduled, dndCount, criticalOffCount,
        summary: false, horizon: horizonHours, projectedItems,
        reason: 'nothing_to_schedule', source_scenario: sourceScenario
      }
    })
    logAuditEventsBatch(auditAccumulator)
    return { alarms: alarmsScheduled, trayScheduled, dndCount, criticalOffCount, summary: false, horizon: horizonHours }
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    if (localNotifs.length > 0) {
      const result = await LocalNotifications.schedule({ notifications: localNotifs })
      console.log(`[Notif] reschedule END — alarms:${alarmsScheduled} tray:${trayScheduled} dnd:${dndCount} criticalOff:${criticalOffCount} local:${result?.notifications?.length} summary:${summaryOn} horizon:${horizonHours}h`)
    }
  } catch (e) {
    console.error('[Notif] LocalNotifications.schedule FAILED:', e?.message || e)
    clearScheduledState()
    auditAccumulator.push({
      action: 'batch_end',
      metadata: {
        alarmsScheduled, trayScheduled, dndCount, criticalOffCount,
        summary: summaryOn, horizon: horizonHours,
        error: true, errorMsg: e?.message, source_scenario: sourceScenario
      }
    })
    logAuditEventsBatch(auditAccumulator)
    return { alarms: alarmsScheduled, trayScheduled, dndCount, criticalOffCount, summary: summaryOn, horizon: horizonHours, error: true }
  }

  saveScheduledState(newState)

  Sentry.addBreadcrumb({
    category: 'alarm',
    message: 'rescheduleAll END',
    level: 'info',
    data: {
      alarmsScheduled, trayScheduled, dndCount, criticalOffCount,
      localNotifs: localNotifs.length, summary: summaryOn,
      horizon: horizonHours, projectedItems, sourceScenario
    }
  })

  auditAccumulator.push({
    action: 'batch_end',
    metadata: {
      alarmsScheduled, trayScheduled, dndCount, criticalOffCount,
      localNotifs: localNotifs.length, summary: summaryOn,
      horizon: horizonHours, projectedItems, source_scenario: sourceScenario
    }
  })
  logAuditEventsBatch(auditAccumulator)

  return { alarms: alarmsScheduled, trayScheduled, dndCount, criticalOffCount, summary: summaryOn, horizon: horizonHours }
}

// ─── WEB PUSH LEGACY ──────────────────────────────────────────────────────────

export async function rescheduleAllWeb(doses, patients, prefsOverride) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (Notification.permission !== 'granted') return
  const prefs = prefsOverride || loadPrefs()
  const adv = prefs.advanceMins ?? 0
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
