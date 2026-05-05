/**
 * notifications/fcm.js — FCM subscribe/unsubscribe + listener bind once.
 * #030 (release v0.2.0.11): split de notifications.js.
 */

import { supabase, hasSupabase } from '../supabase'
import { track, EVENTS } from '../analytics'
import {
  VAPID_PUBLIC_KEY,
  isNative,
  loadPrefs,
  savePrefs,
  urlBase64ToUint8Array
} from './prefs'
import { ensureFcmChannel, cancelAll } from './channels'

// Module-level guard: FCM listeners bound only once globally
let _fcmListenersBound = false

/**
 * Request permission + register FCM. Native only.
 * Persiste token em medcontrol.push_subscriptions via RPC (SECURITY DEFINER).
 * Lança Error com `code='NOTIFICATIONS_BLOCKED'` se permissão negada.
 */
export async function subscribeFcm(advanceMins = 15) {
  if (!isNative) {
    return subscribeWebPush(advanceMins)
  }
  const { PushNotifications } = await import('@capacitor/push-notifications')

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

export async function bindFcmListenersOnce() {
  if (!isNative || _fcmListenersBound) return
  _fcmListenersBound = true
  const { PushNotifications } = await import('@capacitor/push-notifications')

  await ensureFcmChannel()

  await PushNotifications.addListener('registration', async ({ value: deviceToken }) => {
    // Cache pra useAuth SIGNED_IN re-upsert em troca de user.
    try { localStorage.setItem('dosy_fcm_token', deviceToken) } catch {}
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
