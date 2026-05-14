/**
 * notifications/prefs.js — prefs storage + helpers puros
 * #030 (release v0.2.0.11): split de notifications.js (613 LOC → 5 arquivos).
 */

import { Capacitor } from '@capacitor/core'

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
export const PREFS_LOCAL_KEY = 'medcontrol_notif'
// Item #207 (release v0.2.1.7) — janela 48h → 168h (7 dias).
// Cobre user que não abre app por dias (Samsung One UI 7 mata WorkManager
// background → DoseSyncWorker pode não rodar 6h periodic). 28 alarmes/user
// típico (4 doses/dia × 7d) está bem dentro do limit AlarmManager Android (~500/app).
// #209 v0.2.1.9: 168h → 48h alinha daily-alarm-sync cron 5am + Worker periodic.
// 168h gerava ~100 doses/batch agendadas no AlarmManager. 48h tem ~30 doses.
// Cron 5am + Worker 6h + dose-trigger real-time mantêm janela rolling.
// v0.2.2.1: comentário atualizado pra refletir valor real (era 48 no plan mas 168 hardcoded).
export const SCHEDULE_WINDOW_MS = 48 * 3600 * 1000 // 48h
export const CHANNEL_ID = 'doses_v2'
export const DAILY_SUMMARY_NOTIF_ID = 999000001
export const isNative = Capacitor.isNativePlatform()

export function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_LOCAL_KEY)) || {} } catch { return {} }
}

export function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch }
  localStorage.setItem(PREFS_LOCAL_KEY, JSON.stringify(next))
  return next
}

export function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// Hash UUID -> int32 positivo. ID estável LocalNotification + alarm
export function doseIdToNumber(uuid) {
  let h = 0
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h) + uuid.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h) % 2147483647
}

/**
 * Verifica se horário cai dentro janela "Não perturbe".
 * Suporta janelas que cruzam meia-noite (ex: 23:00 → 07:00).
 */
export function inDnd(whenIso, prefs) {
  if (!prefs?.dndEnabled) return false
  const [sh, sm] = (prefs.dndStart || '23:00').split(':').map(Number)
  const [eh, em] = (prefs.dndEnd || '07:00').split(':').map(Number)
  const t = new Date(whenIso)
  const mins = t.getHours() * 60 + t.getMinutes()
  const start = sh * 60 + sm
  const end = eh * 60 + em
  return start <= end ? (mins >= start && mins < end) : (mins >= start || mins < end)
}

// Group doses pela mesma "minute key" (YYYY-MM-DDTHH:MM)
export function groupByMinute(doses) {
  const groups = new Map()
  for (const d of doses) {
    const key = d.scheduledAt.slice(0, 16)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(d)
  }
  return groups
}

// Filtra apenas pending na janela 48h.
// #215 v0.2.3.0 fix bug device-validation 2026-05-13: skip doses optimistic
// (id começa `temp-` OR _optimistic=true). Doses temp são criadas pelo
// mutationRegistry onMutate antes do server responder. Se agendar alarme
// nativo com hash(temp-id), AlarmActivity passa `openDoseIds=temp-...`
// pra MainActivity, mas onSuccess substituiu temp por UUID real → modal
// MultiDose busca id no cache + temp não existe mais → modal não abre.
// Solução: aguardar server confirm + onSuccess invalidate ['doses'] →
// rescheduleAll re-roda com IDs reais.
export function filterUpcoming(doses) {
  const now = Date.now()
  const end = now + SCHEDULE_WINDOW_MS
  return (doses || []).filter((d) => {
    if (d.status !== 'pending') return false
    if (d._optimistic) return false
    if (typeof d.id === 'string' && d.id.startsWith('temp-')) return false
    const t = new Date(d.scheduledAt).getTime()
    return t >= now && t <= end
  })
}

// Enrich dose com patientName (lookup pelo patientsMap)
export function enrichDose(d, patientsMap) {
  return { ...d, patientName: d.patientName || patientsMap.get(d.patientId)?.name || '' }
}
