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

  // v0.2.3.12 Bug #7 — aguardar registration event (10s timeout) antes de retornar success.
  // PushNotifications.register() resolve sync ANTES do FCM token chegar. Token (ou erro)
  // chega async via listener registration/registrationError. Sem aguardar aqui, togglePush
  // marca push=true mesmo se FCM falhou (sem Google Play Services, conta Google removida,
  // etc) → state broken silencioso, alarmes nunca chegam.
  let regListener = null
  let errListener = null
  const registrationPromise = new Promise((resolve, reject) => {
    PushNotifications.addListener('registration', () => resolve()).then(h => { regListener = h })
    PushNotifications.addListener('registrationError', (err) => {
      const msg = err?.error || err?.message || JSON.stringify(err)
      const e = new Error(`Falha ao registrar FCM: ${msg}. Verifique Google Play Services.`)
      e.code = 'FCM_REGISTRATION_FAILED'
      reject(e)
    }).then(h => { errListener = h })
  })

  try {
    await PushNotifications.register()
    await Promise.race([
      registrationPromise,
      new Promise((_, reject) => setTimeout(() => {
        const e = new Error('Tempo esgotado registrando FCM (10s). Verifique Google Play Services.')
        e.code = 'FCM_REGISTRATION_TIMEOUT'
        reject(e)
      }, 10000))
    ])
  } finally {
    try { if (regListener) await regListener.remove() } catch {}
    try { if (errListener) await errListener.remove() } catch {}
  }

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
          // v0.2.3.2 #228 fix — filtra delete por device_id_uuid pra não apagar push_sub
          // de OUTROS devices do mesmo user (multi-device cross-contamination bug).
          // Fallback: se getDeviceId falha (legacy), deleta todos android (old behavior).
          let deviceIdUuid = null
          try {
            const mod = await import('../criticalAlarm')
            deviceIdUuid = await mod.getDeviceId()
          } catch { /* fallback null → legacy delete-all */ }

          let q = supabase.schema('medcontrol').from('push_subscriptions')
            .delete().eq('userId', user.id).eq('platform', 'android')
          if (deviceIdUuid) q = q.eq('device_id_uuid', deviceIdUuid)
          await q
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

      // #226 v0.2.3.0 — passa device_id UUID pra RPC consistência cross-source.
      // CriticalAlarmPlugin.getDeviceId retorna UUID estável de SharedPreferences.
      let deviceIdUuid = null
      try {
        const mod = await import('../criticalAlarm')
        deviceIdUuid = await mod.getDeviceId()
      } catch { /* fallback null — server-side gen_random_uuid */ }

      const { error } = await supabase.schema('medcontrol').rpc('upsert_push_subscription', {
        p_device_token: deviceToken,
        p_platform: 'android',
        p_advance_mins: advanceMins,
        p_user_agent: 'capacitor-android',
        p_device_id_uuid: deviceIdUuid
      })
      // v0.2.3.6 #260 fix: serializar error para evitar `[object Object]` no console.
      if (error) console.error('[FCM] upsert RPC FAILED:', error?.message || error?.code || JSON.stringify(error))
      else console.log('[FCM] token persisted device_id_uuid:', deviceIdUuid)
    } catch (e) { console.error('[FCM] registration handler:', e?.message || JSON.stringify(e)) }
  })

  await PushNotifications.addListener('registrationError', (err) => {
    console.error('[FCM] registrationError:', JSON.stringify(err))
  })
}
