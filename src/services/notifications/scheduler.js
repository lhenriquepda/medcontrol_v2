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
import { ensureChannel, cancelAll, cancelGroup, loadScheduledState, saveScheduledState } from './channels'

// Item #200.1 (release v0.2.1.5) — guard pra primeira execução após boot.
// Garante que rescheduleAll roda full cancelAll + reschedule from scratch
// no primeiro call (cobre install fresco, app data wipe, dessincronia
// localStorage vs AlarmManager). Calls subsequentes na mesma sessão usam
// diff-and-apply pra preservar alarmes inalterados (sem janela vazia).
let firstResetDoneInSession = false

/**
 * Re-agenda baseado em doses + prefs atuais.
 *
 * Item #200.1 (release v0.2.1.5) — diff-and-apply (idempotente sem janela vazia).
 * Antes: cancelAll() + reschedule from scratch → window 200-2000ms vazio +
 * risco AlarmManager ficar zerado se exception mid-reschedule.
 * Agora: localStorage tracker `dosy_scheduled_groups_v1` permite calcular
 * diff (toRemove/toUpdate/toAdd) e aplicar só o necessário, preservando
 * alarmes não-modificados.
 *
 * Primeira execução por sessão (firstResetDoneInSession=false): força
 * cancelAll completo pra cobrir install fresco + dessincronia eventual
 * localStorage vs AlarmManager. Subsequentes: diff-only.
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

  // Item #200.1: primeira execução por sessão força cancelAll (cobre install
  // fresco + dessincronia localStorage vs AlarmManager). Subsequentes na mesma
  // sessão usam diff-and-apply.
  const isFirstSessionRun = !firstResetDoneInSession
  if (isFirstSessionRun) {
    console.log('[Notif] reschedule first session run — full cancelAll for safety')
    await cancelAll()
    firstResetDoneInSession = true
  }

  // Setup channel (idempotent, OK chamar sempre)
  await ensureChannel()

  // Verificar capability de exact alarm (Android 12+)
  let canExact = true
  try {
    const en = await checkCriticalAlarmEnabled()
    canExact = en?.canScheduleExact !== false
  } catch (e) { console.warn('[Notif] checkExact:', e?.message) }
  const canRingAlarm = criticalOn && isCriticalAlarmAvailable() && canExact

  console.log('[Notif] reschedule START — push:', pushOn, 'critical:', criticalOn, 'dnd:', !!prefs.dndEnabled, 'summary:', summaryOn, 'firstSessionRun:', isFirstSessionRun)

  const patientsMap = new Map((patients || []).map(p => [p.id, p]))
  const enriched = (doses || []).map(d => enrichDose(d, patientsMap))
  const upcoming = filterUpcoming(enriched)
  const groups = groupByMinute(upcoming)

  // Item #200.1 — calcula desired state com hash por grupo
  const desired = new Map() // groupId → { hash, group, at, isDndWin, shouldRing, doseIdsCsv }
  if (pushOn) {
    for (const [, group] of groups) {
      const at = new Date(new Date(group[0].scheduledAt).getTime() - adv * 60000)
      if (at.getTime() <= Date.now()) continue
      const groupKey = group.map(d => d.id).sort().join('|')
      const groupId = doseIdToNumber(groupKey)
      const doseIdsCsv = group.map(d => d.id).join(',')
      const isDndWin = inDnd(group[0].scheduledAt, prefs)
      const shouldRing = canRingAlarm && !isDndWin
      // Hash inclui scheduledAt + doseIds + flag shouldRing (mudanças nesses
      // params requerem re-agendar). Ignora `at` derivado de adv pois adv mesmo).
      const hash = `${at.toISOString()}|${groupKey}|${shouldRing ? 'r' : 't'}|${group[0].scheduledAt}`
      desired.set(groupId, { hash, group, at, isDndWin, shouldRing, doseIdsCsv })
    }
  }

  // Item #200.1 — current state (vazio se firstSessionRun ou primeira instalação)
  const current = isFirstSessionRun ? {} : loadScheduledState()
  const currentIds = new Set(Object.keys(current).map(k => Number(k)))
  const desiredIds = new Set(desired.keys())

  const toRemove = [...currentIds].filter(id => !desiredIds.has(id))
  const toAddOrUpdate = [...desiredIds].filter(id => {
    const d = desired.get(id)
    return current[id] !== d.hash // novo OU hash diferente
  })
  const toKeep = [...desiredIds].filter(id => current[id] === desired.get(id).hash)

  console.log('[Notif] diff — keep:', toKeep.length, 'add/update:', toAddOrUpdate.length, 'remove:', toRemove.length)

  // Cancelar removidos + alterados
  for (const groupId of toRemove) {
    await cancelGroup(groupId)
  }
  for (const groupId of toAddOrUpdate) {
    // toUpdate precisa cancelar antes de re-agendar (caso mudou scheduledAt)
    if (current[groupId]) await cancelGroup(groupId)
  }

  const localNotifs = []
  let alarmsScheduled = 0
  let dndSkipped = 0
  const newState = {}

  // Preserva entradas de toKeep no novo state
  for (const id of toKeep) newState[id] = current[id]

  // Schedule novos/alterados
  for (const groupId of toAddOrUpdate) {
    const d = desired.get(groupId)
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
    // Item #200.1 — persistir state mesmo sem schedule novo (cobre caso
    // toRemove sem toAdd, que precisa zerar localStorage state correspondente).
    saveScheduledState(newState)
    console.log('[Notif] reschedule END — nothing new to schedule (state persisted)')
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
  }

  // Item #200.1 — persistir state final pro próximo diff
  saveScheduledState(newState)

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
