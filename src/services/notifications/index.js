/**
 * notifications/index.js — barrel export + useNotifications hook.
 * #030 (release v0.2.0.11): split de notifications.js (613 LOC) em 5 arquivos:
 *   - prefs.js     storage + helpers puros
 *   - channels.js  Android channels + cancelAll
 *   - scheduler.js rescheduleAll + path web legacy
 *   - fcm.js       subscribeFcm + unsubscribeFcm + bindFcmListenersOnce
 *   - index.js     barrel export + useNotifications hook
 *
 * API pública mantida 100% retro-compat — imports `'../services/notifications'`
 * resolvem aqui automaticamente (Node module resolution).
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
 */

import { useCallback, useEffect, useState } from 'react'
import { supabase, hasSupabase } from '../supabase'
import { isNative, loadPrefs, inDnd } from './prefs'
import { cancelAll } from './channels'
import { rescheduleAll } from './scheduler'
import { subscribeFcm, unsubscribeFcm, bindFcmListenersOnce } from './fcm'

// Re-exports (back-compat com `import { rescheduleAll, inDnd, ... } from '../services/notifications'`)
export { inDnd } from './prefs'
export { cancelAll } from './channels'
export { rescheduleAll } from './scheduler'
export { subscribeFcm, unsubscribeFcm } from './fcm'

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
