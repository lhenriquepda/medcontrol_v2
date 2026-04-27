// Supabase Edge Function — notify-doses
// Sends push notifications for doses coming up within each user's advanceMins window.
// Suporta FCM (Android nativo) + Web Push (PWA legacy) na mesma função.
//
// Required env vars (Supabase secrets):
//   FIREBASE_PROJECT_ID         — ex: "dosy-b592e"
//   FIREBASE_CLIENT_EMAIL       — service account email
//   FIREBASE_PRIVATE_KEY        — service account PEM (com \n reais)
//   VAPID_PUBLIC_KEY            — Web Push (legacy)
//   VAPID_PRIVATE_KEY           — Web Push (legacy)
//   VAPID_SUBJECT               — mailto:owner@dosy.app
//   SUPABASE_URL                — auto
//   SUPABASE_SERVICE_ROLE_KEY   — auto

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ─── FCM setup ───────────────────────────────────────────────────────
const FCM_PROJECT  = Deno.env.get('FIREBASE_PROJECT_ID')!
const FCM_CLIENT   = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const FCM_KEY_PEM  = Deno.env.get('FIREBASE_PRIVATE_KEY')!

// ─── Web Push setup ──────────────────────────────────────────────────
const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@dosyapp.com'
webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

const supabase = createClient(supabaseUrl, serviceKey, {
  db: { schema: 'medcontrol' }
})

// ─── FCM OAuth token (cached) ────────────────────────────────────────
let cachedToken: { token: string; exp: number } | null = null

async function getFcmAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() / 1000 + 60) {
    return cachedToken.token
  }

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: FCM_CLIENT,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }

  const enc = (o: object) => btoa(JSON.stringify(o))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const unsignedJwt = `${enc(header)}.${enc(payload)}`

  // Import PEM to CryptoKey
  const pemBody = FCM_KEY_PEM
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  )
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${unsignedJwt}.${sig}`

  // Exchange JWT for access token
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  if (!resp.ok) {
    throw new Error(`FCM auth failed: ${resp.status} ${await resp.text()}`)
  }
  const { access_token, expires_in } = await resp.json()
  cachedToken = { token: access_token, exp: now + expires_in }
  return access_token
}

async function sendFcm(deviceToken: string, title: string, body: string, data: Record<string, string>) {
  const accessToken = await getFcmAccessToken()
  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          data,
          android: {
            priority: 'HIGH',
            notification: {
              channel_id: 'doses_v2',
              sound: 'default',
              default_sound: true,
              default_vibrate_timings: true,
              notification_priority: 'PRIORITY_MAX',
              visibility: 'PUBLIC'
            }
          }
        }
      })
    }
  )
  if (!resp.ok) {
    const err = await resp.text()
    // 404 NOT_FOUND or UNREGISTERED → token invalid, delete it
    if (resp.status === 404 || err.includes('UNREGISTERED') || err.includes('INVALID_ARGUMENT')) {
      await supabase.from('push_subscriptions').delete().eq('deviceToken', deviceToken)
    }
    throw new Error(`FCM send failed: ${resp.status} ${err}`)
  }
}

// ─── Main handler ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const now = new Date()
  const results: { userId: string; sent: number; errors: number; via: string[] }[] = []

  try {
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('*')
    if (subErr) throw subErr

    const byUser = new Map<string, typeof subs>()
    for (const sub of subs ?? []) {
      if (!byUser.has(sub.userId)) byUser.set(sub.userId, [])
      byUser.get(sub.userId)!.push(sub)
    }

    for (const [userId, userSubs] of byUser) {
      const advanceMins = userSubs[0]?.advanceMins ?? 15
      const windowStart = new Date(now.getTime() - 60 * 1000)
      const windowEnd   = new Date(now.getTime() + advanceMins * 60 * 1000 + 60 * 1000)

      const { data: ownPatients } = await supabase
        .from('patients')
        .select('id')
        .eq('userId', userId)
      const patientIds = ownPatients?.map(p => p.id) ?? []
      if (patientIds.length === 0) continue

      const { data: doses } = await supabase
        .from('doses')
        .select('id, medName, unit, scheduledAt, patientId')
        .eq('status', 'pending')
        .gte('scheduledAt', windowStart.toISOString())
        .lte('scheduledAt', windowEnd.toISOString())
        .in('patientId', patientIds)

      if (!doses?.length) {
        results.push({ userId, sent: 0, errors: 0, via: [] })
        continue
      }

      let sent = 0, errors = 0
      const via: string[] = []

      for (const dose of doses) {
        const minutesUntil = Math.round((new Date(dose.scheduledAt).getTime() - now.getTime()) / 60000)
        const body = minutesUntil <= 0
          ? `${dose.medName} — ${dose.unit} (agora)`
          : `${dose.medName} — ${dose.unit} (em ${minutesUntil} min)`
        const data = { doseId: dose.id, url: '/' }

        for (const sub of userSubs) {
          try {
            // FCM path (Android nativo)
            if (sub.deviceToken) {
              await sendFcm(sub.deviceToken, 'Dosy 💊', body, data)
              sent++
              via.push('fcm')
            }
            // Web Push path (PWA legacy)
            else if (sub.endpoint && sub.keys) {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: sub.keys },
                JSON.stringify({
                  title: 'Dosy 💊',
                  body,
                  tag: `dose-${dose.id}`,
                  url: '/',
                  doseId: dose.id
                })
              )
              sent++
              via.push('webpush')
            }
          } catch (err: unknown) {
            errors++
            const e = err as { statusCode?: number; message?: string }
            // 410 Gone (Web Push) → delete sub
            if (e.statusCode === 410 && sub.endpoint) {
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            }
          }
        }
      }

      results.push({ userId, sent, errors, via })
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('notify-doses error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
