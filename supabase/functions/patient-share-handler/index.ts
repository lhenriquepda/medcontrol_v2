// Item #280 (release v0.2.3.7) — Patient share notification.
//
// Edge Function chamada por Postgres webhook (pg_net) ao INSERT em
// medcontrol.patient_shares. Envia FCM notification ao novo cuidador
// (sharedWithUserId) informando que paciente foi compartilhado com ele.
//
// Payload notification (não data) pra renderizar tray IMEDIATO mesmo
// se app cuidador esteja killed/Doze/AppStandby (mesmo princípio #279).
//
// Webhook payload format (pg_net):
//   { type: "INSERT", table: "patient_shares", record: {...}, schema: "medcontrol" }

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_PROJECT = Deno.env.get('FIREBASE_PROJECT_ID')!
const FCM_CLIENT  = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const FCM_KEY_PEM = Deno.env.get('FIREBASE_PRIVATE_KEY')!

const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'medcontrol' } })

const SOURCE = 'edge_share_handler'

// ─── FCM OAuth (cached) ────────────────────────────────────────────
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
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(unsignedJwt))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const jwt = `${unsignedJwt}.${sigB64}`
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const json = await resp.json()
  if (!json.access_token) throw new Error(`fcm_oauth_failed: ${JSON.stringify(json)}`)
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) }
  return json.access_token
}

async function sendFcmNotification(deviceToken: string, title: string, body: string, data: Record<string, string>): Promise<boolean> {
  const accessToken = await getFcmAccessToken()
  // deno-lint-ignore no-explicit-any
  const message: any = {
    token: deviceToken,
    notification: { title, body },
    data,
    android: { priority: 'HIGH' }
  }
  try {
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT}/messages:send`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      }
    )
    if (resp.ok) return true
    const err = await resp.text()
    // Same approach as v24 dose-trigger-handler: only delete on definite UNREGISTERED
    if (resp.status === 404 || err.includes('UNREGISTERED') || err.includes('registration-token-not-registered')) {
      await supabase.from('push_subscriptions').delete().eq('deviceToken', deviceToken)
    }
    console.warn(`[share] fcm err ${resp.status}: ${err.slice(0, 200)}`)
    return false
  } catch (e) {
    console.error(`[share] fcm exception: ${e}`)
    return false
  }
}

// ─── Lookup helpers ─────────────────────────────────────────────────
async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId)
    if (error || !data?.user) return 'Alguém'
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
    const name = (meta.name ?? meta.display_name ?? meta.full_name) as string | undefined
    if (name && name.trim()) return name.trim()
    if (data.user.email) return String(data.user.email).split('@')[0]
  } catch (_e) { /* fall-through */ }
  return 'Alguém'
}

async function getPatientName(patientId: string): Promise<string> {
  const { data } = await supabase.from('patients').select('name').eq('id', patientId).maybeSingle()
  return data?.name ?? 'paciente'
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()

    // Accept both pg_net webhook payload AND direct invocation
    const record = payload?.record ?? payload
    const type = payload?.type ?? 'INSERT'

    if (type !== 'INSERT' || !record) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: 'not_insert' }), {
        status: 200, headers: { 'content-type': 'application/json' }
      })
    }

    const patientId = record.patientId ?? record.patient_id
    const ownerId = record.ownerId ?? record.owner_id
    const sharedWithUserId = record.sharedWithUserId ?? record.shared_with_user_id

    if (!patientId || !ownerId || !sharedWithUserId) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_fields', record }), {
        status: 400, headers: { 'content-type': 'application/json' }
      })
    }

    // Lookup names in parallel
    const [ownerName, patientName] = await Promise.all([
      getUserDisplayName(ownerId),
      getPatientName(patientId)
    ])

    // Fetch caregiver push subscriptions (android only — FCM)
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('deviceToken, device_id_uuid')
      .eq('userId', sharedWithUserId)
      .eq('platform', 'android')
      .not('deviceToken', 'is', null)

    if (!subs?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no_caregiver_devices' }), {
        status: 200, headers: { 'content-type': 'application/json' }
      })
    }

    const title = 'Paciente compartilhado'
    const body = `${ownerName} compartilhou ${patientName} com você`
    const data = {
      kind: 'patient_share_added',
      patientId,
      ownerId,
      sharedWithUserId
    }

    let sent = 0
    let errors = 0
    for (const sub of subs) {
      const ok = await sendFcmNotification(sub.deviceToken, title, body, data)
      if (ok) sent++; else errors++
    }

    // Best-effort audit (table may not accept this source — wrap try)
    try {
      await supabase.from('alarm_audit_log').insert({
        user_id: sharedWithUserId,
        source: SOURCE,
        action: 'share_notified',
        metadata: { patientId, ownerId, sent, errors, devices: subs.length }
      })
    } catch (_e) { /* ignore */ }

    return new Response(JSON.stringify({ ok: true, sent, errors, devices: subs.length }), {
      status: 200, headers: { 'content-type': 'application/json' }
    })
  } catch (e) {
    console.error(`[share-handler] error: ${e}`)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    })
  }
})
