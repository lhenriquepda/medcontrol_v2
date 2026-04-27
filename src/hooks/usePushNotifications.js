import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase, hasSupabase } from '../services/supabase'
import { scheduleCriticalAlarm, scheduleCriticalAlarmGroup, cancelAllCriticalAlarms, isCriticalAlarmAvailable, checkCriticalAlarmEnabled } from '../services/criticalAlarm'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const NOTIF_KEY = 'medcontrol_notif'
const MS_IN_24H = 24 * 3600 * 1000
const MS_SCHEDULE_WINDOW = 48 * 3600 * 1000 // 48h — cobre noite + reabertura do app no dia seguinte

const isNative = Capacitor.isNativePlatform()

// Module-level guard: FCM listeners are registered only once globally.
// Hook is called from multiple components (App, Dashboard, Settings) — without
// this, each mount adds duplicate listeners → events fire 3x, logcat floods.
let _fcmListenersBound = false

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY)) || {} } catch { return {} }
}
function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch }
  localStorage.setItem(NOTIF_KEY, JSON.stringify(next))
  return next
}

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// Hash UUID to int32 for LocalNotifications id (positive only)
function doseIdToNumber(uuid) {
  let h = 0
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h) + uuid.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h) % 2147483647
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePushNotifications() {
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

  // ─── Native (Capacitor) — FCM token listener ────────────────────────────
  useEffect(() => {
    if (!isNative) return
    if (_fcmListenersBound) {
      console.log('[FCM] listeners already bound globally — skipping')
      // Still need to recover subscribed state for this hook instance
      ;(async () => {
        if (!hasSupabase) return
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          const { data: existing } = await supabase
            .schema('medcontrol')
            .from('push_subscriptions')
            .select('deviceToken')
            .eq('userId', user.id)
            .eq('platform', 'android')
            .not('deviceToken', 'is', null)
            .limit(1)
          if (existing?.length) setSubscribed(true)
          const status = await (await import('@capacitor/push-notifications')).PushNotifications.checkPermissions()
          setPermState(status.receive === 'granted' ? 'granted' : 'prompt')
        } catch {}
      })()
      return
    }
    _fcmListenersBound = true
    let regHandler, errHandler

    ;(async () => {
      console.log('[FCM] Setting up listeners (first instance)...')
      const { PushNotifications } = await import('@capacitor/push-notifications')

      // Criar notification channel 'doses_v2' (Android 8+ requer)
      // Sem `sound` field → plugin usa default do sistema p/ HIGH importance
      try {
        await PushNotifications.createChannel({
          id: 'doses_v2',
          name: 'Doses de Medicação',
          description: 'Lembretes de doses agendadas',
          importance: 5,        // IMPORTANCE_HIGH (heads-up + som default)
          visibility: 1,        // VISIBILITY_PUBLIC
          vibration: true,
          lights: true
        })
        console.log('[FCM] channel "doses_v2" created/updated')
      } catch (e) {
        console.warn('[FCM] createChannel failed (may not be supported):', e)
      }

      // Token recebido do FCM
      regHandler = await PushNotifications.addListener('registration', async ({ value: deviceToken }) => {
        console.log('[FCM] registration fired, token:', deviceToken?.slice(0, 20) + '...')
        if (!hasSupabase) {
          console.warn('[FCM] no supabase configured — token not persisted')
          return
        }
        try {
          const { data: { user }, error: userErr } = await supabase.auth.getUser()
          if (userErr) console.error('[FCM] getUser error:', userErr)
          if (!user) {
            console.warn('[FCM] no user — token not persisted')
            return
          }
          const advanceMins = loadPrefs().advanceMins ?? 15
          // Use RPC (SECURITY DEFINER) — handles cross-user device ownership transfer
          const { error: upsertErr } = await supabase
            .schema('medcontrol')
            .rpc('upsert_push_subscription', {
              p_device_token: deviceToken,
              p_platform: 'android',
              p_advance_mins: advanceMins,
              p_user_agent: 'capacitor-android'
            })
          if (upsertErr) {
            console.error('[FCM] upsert RPC FAILED:', upsertErr)
            return
          }
          console.log('[FCM] token persisted to push_subscriptions')
          savePrefs({ push: true, advanceMins })
          setSubscribed(true)
        } catch (e) {
          console.error('[FCM] registration handler exception:', e)
        }
      })

      errHandler = await PushNotifications.addListener('registrationError', (err) => {
        console.error('[FCM] registrationError event:', JSON.stringify(err))
      })

      // Check existing permission + DB state
      try {
        const status = await PushNotifications.checkPermissions()
        setPermState(status.receive === 'granted' ? 'granted' : 'prompt')
        console.log('[FCM] perm state:', status.receive)
      } catch (e) {
        console.error('[FCM] checkPermissions failed:', e)
      }

      // Recover subscribed state from DB
      if (hasSupabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: existing } = await supabase
              .schema('medcontrol')
              .from('push_subscriptions')
              .select('deviceToken')
              .eq('userId', user.id)
              .eq('platform', 'android')
              .not('deviceToken', 'is', null)
              .limit(1)
            if (existing?.length) {
              console.log('[FCM] found existing token in DB → subscribed=true')
              setSubscribed(true)
            }
          }
        } catch (e) {
          console.error('[FCM] DB state check failed:', e)
        }
      }
    })()

    return () => {
      regHandler?.remove?.()
      errHandler?.remove?.()
    }
  }, [])

  // ─── Web — current subscription on mount ────────────────────────────────
  useEffect(() => {
    if (isNative || !supported) return
    setPermState(Notification.permission)
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    }).catch(() => {})
  }, [supported])

  // ─── Subscribe ──────────────────────────────────────────────────────────
  const subscribe = useCallback(async (advanceMins = 15) => {
    if (!supported) throw new Error('Push não suportado.')
    setLoading(true)
    try {
      // ─── Native FCM path ──────────────────────────────────────────────
      if (isNative) {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        // 1. Check current permission
        const current = await PushNotifications.checkPermissions()
        console.log('[FCM] current permission:', current.receive)

        let permResult = current
        // 2. Only request if 'prompt' (else Android won't show popup anyway)
        if (current.receive === 'prompt' || current.receive === 'prompt-with-rationale') {
          permResult = await PushNotifications.requestPermissions()
          console.log('[FCM] after request:', permResult.receive)
        }
        setPermState(permResult.receive)

        // 3. If still denied/blocked, throw clear error — UI shows toast + redirect option
        if (permResult.receive !== 'granted') {
          const err = new Error('NOTIFICATIONS_BLOCKED')
          err.code = 'NOTIFICATIONS_BLOCKED'
          err.message = 'Notificações estão desativadas no Android. Toque em "Abrir Configurações" para habilitar.'
          throw err
        }

        await PushNotifications.register()
        savePrefs({ push: true, advanceMins })
        return null
      }

      // ─── Web Push path (legacy) ───────────────────────────────────────
      const permission = await Notification.requestPermission()
      setPermState(permission)
      if (permission !== 'granted') throw new Error('Permissão negada pelo usuário.')

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
          await supabase
            .schema('medcontrol')
            .from('push_subscriptions')
            .upsert({
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
      setSubscribed(true)
      return sub
    } finally {
      setLoading(false)
    }
  }, [supported])

  // ─── Unsubscribe ────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      if (isNative) {
        // Cancel local notifications
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications')
          const pending = await LocalNotifications.getPending()
          if (pending.notifications.length) {
            await LocalNotifications.cancel({ notifications: pending.notifications })
          }
        } catch {}
        // Delete row by userId (we don't have endpoint)
        if (hasSupabase) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await supabase
              .schema('medcontrol')
              .from('push_subscriptions')
              .delete()
              .eq('userId', user.id)
              .eq('platform', 'android')
          }
        }
      } else {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          const endpoint = sub.endpoint
          await sub.unsubscribe()
          if (hasSupabase) {
            await supabase
              .schema('medcontrol')
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', endpoint)
          }
        }
        const sw = reg.active || reg.waiting || reg.installing
        sw?.postMessage({ type: 'CLEAR_SCHEDULE' })
      }
      savePrefs({ push: false })
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Schedule upcoming doses (next 24h) ─────────────────────────────────
  const scheduleDoses = useCallback(async (doses, advanceMins) => {
    if (!supported) return
    const adv = advanceMins ?? loadPrefs().advanceMins ?? 15
    const now = Date.now()
    const windowEnd = now + MS_SCHEDULE_WINDOW

    const upcoming = (doses || []).filter((d) => {
      if (d.status !== 'pending') return false
      const t = new Date(d.scheduledAt).getTime()
      return t >= now && t <= windowEnd
    })

    if (isNative) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      console.log('[LocalNotif] scheduling', upcoming.length, 'doses (advance:', adv, 'min)')

      // Garantir channel doses_v2 existe (HIGH importance pra heads-up + som)
      // Sem `sound` field → plugin usa default do sistema
      try {
        await LocalNotifications.createChannel({
          id: 'doses_v2',
          name: 'Doses de Medicação',
          description: 'Lembretes de doses agendadas',
          importance: 5,         // IMPORTANCE_HIGH (heads-up + som default)
          visibility: 1,         // VISIBILITY_PUBLIC
          vibration: true,
          lights: true
        })
      } catch (e) {
        console.warn('[LocalNotif] createChannel:', e?.message || e)
      }

      // Verificar permissão de exact alarm (Android 12+)
      try {
        const perm = await LocalNotifications.checkExactNotificationSetting?.()
        console.log('[LocalNotif] exactAlarm perm:', perm)
      } catch {}

      // Clear pending then re-schedule
      try {
        const pending = await LocalNotifications.getPending()
        if (pending.notifications.length) {
          console.log('[LocalNotif] cancelling', pending.notifications.length, 'pending')
          await LocalNotifications.cancel({ notifications: pending.notifications })
        }
      } catch (e) { console.warn('[LocalNotif] getPending/cancel:', e?.message) }

      // ─── CRITICAL ALARM (estilo despertador) ──────────────────────────
      // IMPORTANTE: critical alarm é COMPLEMENTAR ao LocalNotifications, não substituto.
      // Sempre agendar ambos. Se permissão exact alarm faltar, critical não dispara
      // mas local serve como fallback garantido.
      const prefsCritical = loadPrefs().criticalAlarm !== false
      let canExact = true
      try {
        const en = await checkCriticalAlarmEnabled()
        canExact = en?.canScheduleExact !== false
      } catch (e) {
        console.warn('[CriticalAlarm] checkEnabled failed:', e?.message)
      }
      const useCritical = prefsCritical && isCriticalAlarmAvailable() && canExact
      let criticalSucceeded = 0
      console.log('[CriticalAlarm] available:', isCriticalAlarmAvailable(), 'prefs:', prefsCritical, 'canExact:', canExact, 'will use:', useCritical)

      // Group upcoming doses by trigger minute (YYYY-MM-DDTHH:MM).
      // Doses with same scheduledAt → 1 grouped alarm + 1 grouped notif.
      const groups = new Map()
      for (const d of upcoming) {
        const key = d.scheduledAt.slice(0, 16) // minute granularity
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(d)
      }
      console.log('[scheduleDoses] grouped', upcoming.length, 'doses into', groups.size, 'time slots')

      if (useCritical) {
        try { await cancelAllCriticalAlarms() } catch (e) { console.warn('[CriticalAlarm] cancelAll:', e?.message) }

        for (const [key, group] of groups) {
          const at = new Date(new Date(group[0].scheduledAt).getTime() - adv * 60000)
          if (at.getTime() <= Date.now()) continue
          // Group ID: stable hash from concatenated dose IDs
          const groupKey = group.map(d => d.id).sort().join('|')
          const groupId = doseIdToNumber(groupKey)
          try {
            const r = await scheduleCriticalAlarmGroup({
              id: groupId,
              at: at.toISOString(),
              doses: group.map(d => ({
                doseId: d.id,
                medName: d.medName,
                unit: d.unit,
                patientName: d.patientName || ''
              }))
            })
            console.log('[CriticalAlarm] scheduled group:', group.length, 'doses at', at.toISOString(), '→', r)
            criticalSucceeded += group.length
          } catch (e) {
            console.error('[CriticalAlarm] schedule fail for group at', key, ':', e?.message || e)
          }
        }
        console.log('[CriticalAlarm] total scheduled:', criticalSucceeded, '/', upcoming.length)
      } else if (prefsCritical && !canExact) {
        console.warn('[CriticalAlarm] DISABLED: SCHEDULE_EXACT_ALARM permission missing — falling back to LocalNotifications only')
      }

      // ─── Local Notifications agrupadas — APENAS fallback ─────────────
      // Quando critical alarm escala com sucesso, AlarmReceiver já posta
      // notif (com fullScreenIntent + tap → MainActivity com doseIds).
      // Agendar LocalNotif paralelo causaria duplicata. Só usa local pra
      // grupos onde critical falhou OU pra dailySummary (não-crítico).
      const notifications = []
      if (!useCritical) {
        // Sem critical (permissão ausente, plataforma web, etc) — local agenda tudo
        for (const [, group] of groups) {
          const at = new Date(new Date(group[0].scheduledAt).getTime() - adv * 60000)
          const groupKey = group.map(d => d.id).sort().join('|')
          const groupId = doseIdToNumber(groupKey)
          const doseIdsCsv = group.map(d => d.id).join(',')
          const title = group.length === 1 ? 'Dosy 💊' : `💊 ${group.length} doses agora`
          const body = group.length === 1
            ? `${group[0].medName} — ${group[0].unit}`
            : group.map(d => `${d.medName} (${d.unit})`).join(' · ')
          notifications.push({
            id: groupId,
            title,
            body,
            largeBody: body,
            summaryText: group.length === 1 ? undefined : `${group.length} doses`,
            schedule: { at, allowWhileIdle: true },
            extra: { type: 'dose', doseIds: doseIdsCsv, scheduledAt: group[0].scheduledAt },
            channelId: 'doses_v2',
            autoCancel: true
          })
        }
        console.log('[LocalNotif] critical disabled — scheduling local for all', groups.size, 'groups')
      } else {
        console.log('[LocalNotif] critical handles dose alarms — skipping local notifs (no dup)')
      }

      // LocalNotifications agendam SEMPRE (em paralelo ao critical alarm).
      // Garante notif heads-up + entrada no tray mesmo se critical alarm falhar
      // ao disparar (permissão revogada, OEM matando background, etc.).
      // Trade-off aceito: se ambos dispararem = alarme + notif simultâneos (esperado).
      if (useCritical) {
        console.log('[LocalNotif] scheduling local notifs in PARALLEL with critical alarm (no suppression)')
      }

      // ─── Resumo diário (recorrente) ────────────────────────────────────
      const prefs = loadPrefs()
      if (prefs.dailySummary) {
        const [hh, mm] = (prefs.summaryTime || '07:00').split(':').map(Number)
        const nextFire = new Date()
        nextFire.setHours(hh, mm, 0, 0)
        if (nextFire.getTime() <= Date.now()) nextFire.setDate(nextFire.getDate() + 1)

        // Counts: pending nas próximas 24h + atrasadas
        const in24h = Date.now() + 24 * 3600 * 1000
        const next24Count = (doses || []).filter(d => {
          const t = new Date(d.scheduledAt).getTime()
          return d.status === 'pending' && t >= Date.now() && t <= in24h
        }).length
        const overdueCount = (doses || []).filter(d => d.status === 'overdue').length

        let body = `${next24Count} dose${next24Count === 1 ? '' : 's'} nas próximas 24h`
        if (overdueCount > 0) body += ` · ${overdueCount} atrasada${overdueCount === 1 ? '' : 's'}`
        if (next24Count === 0 && overdueCount === 0) body = 'Nenhuma dose nas próximas 24h.'

        notifications.push({
          id: 999000001, // ID fixo para resumo (evita duplicar)
          title: '📅 Dosy — Resumo do dia',
          body,
          schedule: {
            at: nextFire,
            every: 'day',          // recorrência diária
            allowWhileIdle: true
          },
          channelId: 'doses_v2',
          autoCancel: true,
          extra: { type: 'dailySummary' }
        })
        console.log('[LocalNotif] daily summary scheduled at', nextFire.toISOString(), '—', body)
      }

      if (notifications.length === 0) {
        console.log('[LocalNotif] no notifications to schedule')
        return
      }

      console.log('[LocalNotif] scheduling:', notifications.length, 'total')

      try {
        const result = await LocalNotifications.schedule({ notifications })
        console.log('[LocalNotif] scheduled OK:', result?.notifications?.length, 'notifs')
      } catch (e) {
        console.error('[LocalNotif] schedule FAILED:', e?.message || e)
      }
      return
    }

    // ─── Web Push (legacy) — via SW ─────────────────────────────────────
    if (Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.ready
    const sw = reg.active || reg.waiting || reg.installing
    if (!sw) return
    sw.postMessage({
      type: 'SCHEDULE_DOSES',
      doses: upcoming.map((d) => ({
        id: d.id,
        medName: d.medName,
        unit: d.unit,
        scheduledAt: d.scheduledAt,
        advanceMins: adv
      }))
    })
  }, [supported])

  return { supported, permState, subscribed, loading, subscribe, unsubscribe, scheduleDoses, isNative }
}
