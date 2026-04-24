import { useCallback, useEffect, useState } from 'react'
import { supabase, hasSupabase } from '../services/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const NOTIF_KEY = 'medcontrol_notif'

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

// ─── State ────────────────────────────────────────────────────────────────────

export function usePushNotifications() {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  const [permState, setPermState] = useState(() =>
    supported ? Notification.permission : 'unsupported'
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Check current subscription on mount
  useEffect(() => {
    if (!supported) return
    setPermState(Notification.permission)
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    }).catch(() => {})
  }, [supported])

  // ── Subscribe ───────────────────────────────────────────────────────────────
  const subscribe = useCallback(async (advanceMins = 15) => {
    if (!supported) throw new Error('Push não suportado neste navegador.')
    setLoading(true)
    try {
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

      // Persist to Supabase so the edge function can send server-side pushes
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

  // ── Unsubscribe ─────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
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
      // Clear SW timers
      const sw = reg.active || reg.waiting || reg.installing
      sw?.postMessage({ type: 'CLEAR_SCHEDULE' })

      savePrefs({ push: false })
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Schedule upcoming doses in SW (local notifications) ─────────────────────
  const scheduleDoses = useCallback(async (doses, advanceMins) => {
    if (!supported || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.ready
    const sw = reg.active || reg.waiting || reg.installing
    if (!sw) return
    const now = Date.now()
    const window24h = now + 24 * 3600 * 1000
    const upcoming = (doses || [])
      .filter((d) => {
        if (d.status !== 'pending') return false
        const t = new Date(d.scheduledAt).getTime()
        return t >= now && t <= window24h
      })
      .map((d) => ({
        id: d.id,
        medName: d.medName,
        unit: d.unit,
        scheduledAt: d.scheduledAt,
        advanceMins: advanceMins ?? loadPrefs().advanceMins ?? 15
      }))
    sw.postMessage({ type: 'SCHEDULE_DOSES', doses: upcoming })
  }, [supported])

  return { supported, permState, subscribed, loading, subscribe, unsubscribe, scheduleDoses }
}
