/**
 * notifications.js — SISTEMA ÚNICO DE NOTIFICAÇÕES, ALARMES E RESUMOS
 * =============================================================================
 *
 * Toda lógica de scheduling, FCM, permissões e estado React vive aqui.
 * Não espalhar lógica em outros arquivos. Bridge Java fica em criticalAlarm.js.
 *
 * REGRAS DE NEGÓCIO (hierárquicas):
 *
 *   prefs.push (master) ──┬─ ON  → schedule push notif para cada dose
 *                         │       │
 *                         │       ├─ criticalAlarm ON e !DND → + alarme fullscreen
 *                         │       └─ criticalAlarm OFF ou DND → só push, sem alarme
 *                         │
 *                         └─ OFF → skip dose notif e alarm completamente
 *
 *   prefs.dailySummary ─→ INDEPENDENTE de tudo. Se ON, agenda no horário escolhido.
 *
 *   DND (Não perturbe) ─→ Afeta APENAS critical alarm. Push notif continua passando.
 *
 * API PÚBLICA:
 *   useNotifications()      — hook React (state + callbacks)
 *   rescheduleAll(...)      — função pura, agenda tudo baseado em prefs
 *   cancelAll()             — cancela alarms + local notifs pendentes
 *   inDnd(when, prefs)      — helper público
 *   subscribeFcm()          — request perm + register FCM (only native)
 *   unsubscribeFcm()        — remove FCM token
 *
 * INVARIANTES:
 *   - rescheduleAll é IDEMPOTENTE — sempre cancela tudo antes de agendar.
 *   - Chamado de Settings (toggle change) e Dashboard (doses change).
 *   - Daily summary scheduling roda mesmo se 0 doses (independente do push).
 * =============================================================================
 */

import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase, hasSupabase } from './supabase'
import {
  scheduleCriticalAlarmGroup,
  cancelAllCriticalAlarms,
  isCriticalAlarmAvailable,
  checkCriticalAlarmEnabled,
  getDeviceId
} from './criticalAlarm'
import { track, EVENTS } from './analytics'

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const PREFS_LOCAL_KEY = 'medcontrol_notif'
const SCHEDULE_WINDOW_MS = 48 * 3600 * 1000 // 48h — cobre noite + reabrir app no dia seguinte
const CHANNEL_ID = 'doses_v2'
const DAILY_SUMMARY_NOTIF_ID = 999000001
const isNative = Capacitor.isNativePlatform()

// Module-level guard: FCM listeners bound only once globally
let _fcmListenersBound = false

// ─── HELPERS PUROS ─────────────────────────────────────────────────────────────

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_LOCAL_KEY)) || {} } catch { return {} }
}

function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch }
  localStorage.setItem(PREFS_LOCAL_KEY, JSON.stringify(next))
  return next
}

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// Hash UUID -> int32 positivo. Usado como ID estável de LocalNotification + alarm
function doseIdToNumber(uuid) {
  let h = 0
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h) + uuid.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h) % 2147483647
}

/**
 * Verifica se um horário cai dentro da janela "Não perturbe".
 * Suporta janelas que cruzam meia-noite (ex: 23:00 → 07:00).
 * Public — usado também por outros componentes pra avisos visuais.
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
function groupByMinute(doses) {
  const groups = new Map()
  for (const d of doses) {
    const key = d.scheduledAt.slice(0, 16)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(d)
  }
  return groups
}

// Filtra apenas pending no janela 48h
function filterUpcoming(doses) {
  const now = Date.now()
  const end = now + SCHEDULE_WINDOW_MS
  return (doses || []).filter((d) => {
    if (d.status !== 'pending') return false
    const t = new Date(d.scheduledAt).getTime()
    return t >= now && t <= end
  })
}

// Enrich dose com patientName (lookup pelo patientsMap)
function enrichDose(d, patientsMap) {
  return { ...d, patientName: d.patientName || patientsMap.get(d.patientId)?.name || '' }
}

// ─── ANDROID CHANNEL SETUP ─────────────────────────────────────────────────────

async function ensureChannel() {
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

async function ensureFcmChannel() {
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

// ─── CANCELAMENTO TOTAL ────────────────────────────────────────────────────────

/**
 * Cancela TODOS critical alarms + LocalNotifications pendentes.
 * Chame antes de re-agendar pra garantir estado limpo (idempotência).
 */
export async function cancelAll() {
  if (!isNative) return
  // Critical alarms
  try { await cancelAllCriticalAlarms() } catch (e) { console.warn('[Notif] cancelAll alarms:', e?.message) }
  // Local notifs
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch (e) { console.warn('[Notif] cancelAll local:', e?.message) }
}

// ─── SCHEDULING PRINCIPAL ──────────────────────────────────────────────────────

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
    // Web Push legacy path delegate to SW
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
      const isDnd = inDnd(group[0].scheduledAt, prefs)
      const shouldRing = canRingAlarm && !isDnd

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
      } else if (isDnd && criticalOn) {
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
          extra: { type: 'dose', doseIds: doseIdsCsv, scheduledAt: group[0].scheduledAt, dnd: isDnd },
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

async function rescheduleAllWeb(doses, patients, prefsOverride) {
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

// ─── FCM SUBSCRIBE / UNSUBSCRIBE ───────────────────────────────────────────────

/**
 * Request permission + register FCM. Native only.
 * Persiste token em medcontrol.push_subscriptions via RPC (SECURITY DEFINER).
 * Lança Error com `code='NOTIFICATIONS_BLOCKED'` se permissão negada.
 */
export async function subscribeFcm(advanceMins = 15) {
  if (!isNative) {
    // Web push legacy path
    return subscribeWebPush(advanceMins)
  }
  const { PushNotifications } = await import('@capacitor/push-notifications')

  // 1. Check current permission
  const current = await PushNotifications.checkPermissions()
  let permResult = current
  if (current.receive === 'prompt' || current.receive === 'prompt-with-rationale') {
    permResult = await PushNotifications.requestPermissions()
  }
  if (permResult.receive !== 'granted') {
    track(EVENTS.NOTIF_PERM_DENIED, { platform: 'android' })
    const err = new Error('Notificações estão desativadas no Android. Toque em "Abrir Configurações" para habilitar.')
    err.code = 'NOTIFICATIONS_BLOCKED'
    throw err
  }

  await PushNotifications.register()
  await ensureFcmChannel()
  savePrefs({ push: true, advanceMins })
  track(EVENTS.NOTIF_PERM_GRANTED, { platform: 'android' })
  return { permState: permResult.receive }
}

async function subscribeWebPush(advanceMins) {
  if (!('Notification' in window)) throw new Error('Push não suportado.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    const err = new Error('Permissão negada pelo usuário.')
    err.code = 'NOTIFICATIONS_BLOCKED'
    throw err
  }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
  }
  if (hasSupabase) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const subJson = sub.toJSON()
      await supabase.schema('medcontrol').from('push_subscriptions').upsert({
        userId: user.id,
        endpoint: sub.endpoint,
        keys: subJson.keys,
        platform: 'web',
        advanceMins,
        userAgent: navigator.userAgent.slice(0, 250)
      }, { onConflict: 'endpoint' })
    }
  }
  savePrefs({ push: true, advanceMins })
  return { sub }
}

/**
 * Unsubscribe FCM + remove token. Cancela TUDO (alarms + local notifs).
 * Caller deve chamar rescheduleAll depois pra re-agendar dailySummary
 * caso ainda esteja ON.
 */
export async function unsubscribeFcm() {
  if (isNative) {
    if (hasSupabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.schema('medcontrol').from('push_subscriptions')
            .delete().eq('userId', user.id).eq('platform', 'android')
        }
      } catch (e) { console.warn('[Notif] unsubscribe delete:', e?.message) }
    }
  } else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        if (hasSupabase) {
          await supabase.schema('medcontrol').from('push_subscriptions')
            .delete().eq('endpoint', endpoint)
        }
      }
      const sw = reg.active || reg.waiting || reg.installing
      sw?.postMessage({ type: 'CLEAR_SCHEDULE' })
    } catch (e) { console.warn('[Notif] unsubscribe web:', e?.message) }
  }
  savePrefs({ push: false })
  await cancelAll()
}

// ─── FCM LISTENER BINDING (chamado uma vez no mount global) ───────────────────

async function bindFcmListenersOnce() {
  if (!isNative || _fcmListenersBound) return
  _fcmListenersBound = true
  const { PushNotifications } = await import('@capacitor/push-notifications')

  await ensureFcmChannel()

  // Token recebido — persistir via RPC
  await PushNotifications.addListener('registration', async ({ value: deviceToken }) => {
    if (!hasSupabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const advanceMins = loadPrefs().advanceMins ?? 15
      const { error } = await supabase.schema('medcontrol').rpc('upsert_push_subscription', {
        p_device_token: deviceToken,
        p_platform: 'android',
        p_advance_mins: advanceMins,
        p_user_agent: 'capacitor-android'
      })
      if (error) console.error('[FCM] upsert RPC FAILED:', error)
      else console.log('[FCM] token persisted')
    } catch (e) { console.error('[FCM] registration handler:', e) }
  })

  await PushNotifications.addListener('registrationError', (err) => {
    console.error('[FCM] registrationError:', JSON.stringify(err))
  })
}

// ─── REACT HOOK ────────────────────────────────────────────────────────────────

/**
 * Hook React — wrapper fino sobre as funções do módulo.
 * Use em componentes pra pegar estado de permissão + subscription.
 */
export function useNotifications() {
  const supported = isNative
    ? true
    : (typeof window !== 'undefined'
       && 'serviceWorker' in navigator
       && 'PushManager' in window
       && 'Notification' in window)

  const [permState, setPermState] = useState(() => {
    if (isNative) return 'prompt'
    return supported ? Notification.permission : 'unsupported'
  })
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Bind FCM listeners ao mount (uma vez global)
  useEffect(() => {
    if (!isNative) return
    bindFcmListenersOnce().catch(e => console.warn('[Notif] bindFcm:', e?.message))

    // Recover subscribed state from DB + permission
    ;(async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const status = await PushNotifications.checkPermissions()
        setPermState(status.receive === 'granted' ? 'granted' : 'prompt')
        if (hasSupabase) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: existing } = await supabase
              .schema('medcontrol').from('push_subscriptions')
              .select('deviceToken').eq('userId', user.id).eq('platform', 'android')
              .not('deviceToken', 'is', null).limit(1)
            if (existing?.length) setSubscribed(true)
          }
        }
      } catch (e) { console.warn('[Notif] recover state:', e?.message) }
    })()
  }, [])

  // Web — current subscription on mount
  useEffect(() => {
    if (isNative || !supported) return
    setPermState(Notification.permission)
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    }).catch(() => {})
  }, [supported])

  const subscribe = useCallback(async (advanceMins = 15) => {
    setLoading(true)
    try {
      const r = await subscribeFcm(advanceMins)
      if (r?.permState) setPermState(r.permState)
      setSubscribed(true)
      return r
    } finally { setLoading(false) }
  }, [])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      await unsubscribeFcm()
      setSubscribed(false)
    } finally { setLoading(false) }
  }, [])

  // Wrapper retro-compat — aceita assinatura legada (doses, advanceMins) ou (doses, opts)
  const scheduleDoses = useCallback(async (doses, advanceMinsOrOpts, maybeOpts) => {
    let patients
    if (typeof advanceMinsOrOpts === 'object' && advanceMinsOrOpts !== null) {
      patients = advanceMinsOrOpts.patients
    } else {
      patients = maybeOpts?.patients
    }
    return rescheduleAll({ doses, patients })
  }, [])

  return {
    supported,
    permState,
    subscribed,
    loading,
    isNative,
    subscribe,
    unsubscribe,
    scheduleDoses,           // retro-compat — chama rescheduleAll
    rescheduleAll,           // novo nome canônico
    cancelAll,
    inDnd: (whenIso) => inDnd(whenIso, loadPrefs())
  }
}
