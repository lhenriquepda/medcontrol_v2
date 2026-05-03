// Edge Function — send-test-push
// Disparo de push de teste pra todos os tokens FCM de um user.
// POST { email: string, title?: string, body?: string }
// Auth: requires Authorization: Bearer <JWT> from a user listed in medcontrol.admins.
// Non-admin / unauthenticated callers are rejected. Responses are neutral re:
// email existence (no enumeration via status code or body).

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_PROJECT  = Deno.env.get('FIREBASE_PROJECT_ID')!
const FCM_CLIENT   = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const FCM_KEY_PEM  = Deno.env.get('FIREBASE_PRIVATE_KEY')!

const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'medcontrol' } })

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const NEUTRAL_OK = JSON.stringify({ ok: true, sent: 0 })

let cachedToken: { token: string; exp: number } | null = null

async function getFcmAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() / 1000 + 60) return cachedToken.token

  const now = Math.floor(Date.now() / 1000)
  const enc = (o: object) => btoa(JSON.stringify(o))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const unsignedJwt = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: FCM_CLIENT,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  })}`

  const pemBody = FCM_KEY_PEM
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(unsignedJwt))
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsignedJwt}.${sig}`
  })
  if (!resp.ok) throw new Error(`OAuth: ${resp.status} ${await resp.text()}`)
  const { access_token, expires_in } = await resp.json()
  cachedToken = { token: access_token, exp: now + expires_in }
  return access_token
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })

  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: JSON_HEADERS })
  }
  const jwt = authHeader.slice(7).trim()
  const { data: userData, error: jwtErr } = await supabase.auth.getUser(jwt)
  if (jwtErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: JSON_HEADERS })
  }
  const caller = userData.user

  const { data: adminRow, error: adminErr } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', caller.id)
    .maybeSingle()
  if (adminErr) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: JSON_HEADERS })
  }
  if (!adminRow) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: JSON_HEADERS })
  }

  let payload: { email?: string; title?: string; body?: string }
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: JSON_HEADERS })
  }
  const { email, title = 'Dosy 💊 — Teste', body = 'Push de teste' } = payload
  if (!email || typeof email !== 'string') {
    return new Response(JSON.stringify({ error: 'email_required' }), { status: 400, headers: JSON_HEADERS })
  }

  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) {
    return new Response(NEUTRAL_OK, { status: 200, headers: JSON_HEADERS })
  }
  const target = users.find((u: any) => u.email === email)
  if (!target) {
    return new Response(NEUTRAL_OK, { status: 200, headers: JSON_HEADERS })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('"deviceToken"')
    .eq('userId', target.id)
    .not('deviceToken', 'is', null)

  if (!subs?.length) {
    return new Response(NEUTRAL_OK, { status: 200, headers: JSON_HEADERS })
  }

  const accessToken = await getFcmAccessToken()
  let sent = 0

  for (const s of subs) {
    const r = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            token: s.deviceToken,
            notification: { title, body },
            android: {
              priority: 'HIGH',
              notification: {
                sound: 'default',
                default_sound: true,
                default_vibrate_timings: true,
                notification_priority: 'PRIORITY_HIGH',
                visibility: 'PUBLIC',
                icon: 'ic_launcher'
              }
            }
          }
        })
      }
    )
    if (r.ok) sent++
  }

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200, headers: JSON_HEADERS })
})
