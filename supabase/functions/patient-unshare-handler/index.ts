// Item #297 (release v0.2.3.10) — Patient unshare notification.
//
// Edge Function chamada por Postgres webhook (pg_net) ao DELETE em
// medcontrol.patient_shares. Envia FCM data-only HIGH ao cuidador removido
// (sharedWithUserId) sinalizando pra invalidar cache local + remover dose
// entries do paciente que perdeu acesso.
//
// Cenário fix: owner deleta paciente OU revoga share → cuidador app vê
// paciente fantasma com doses até force-close. UX ruim + risco LGPD
// (cuidador acessa dado que não tem mais autorização).
//
// Webhook payload format (pg_net):
//   { type: "DELETE", table: "patient_shares", old_record: {...}, schema: "medcontrol" }

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_PROJECT = Deno.env.get('FIREBASE_PROJECT_ID')!
const FCM_CLIENT  = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const FCM_KEY_PEM = Deno.env.get('FIREBASE_PRIVATE_KEY')!

const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'medcontrol' } })

const SOURCE = 'edge_unshare_handler'

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

async function sendFcmDataOnly(deviceToken: string, data: Record<string, string>, collapseKey?: string): Promise<boolean> {
  const accessToken = await getFcmAccessToken()
  // deno-lint-ignore no-explicit-any
  const androidCfg: any = { priority: 'HIGH' }
  if (collapseKey) androidCfg.collapseKey = collapseKey
  // deno-lint-ignore no-explicit-any
  const message: any = {
    token: deviceToken,
    data,
    android: androidCfg
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
    if (resp.status === 404 || err.includes('UNREGISTERED') || err.includes('registration-token-not-registered')) {
      await supabase.from('push_subscriptions').delete().eq('deviceToken', deviceToken)
    }
    console.warn(`[unshare] fcm err ${resp.status}: ${err.slice(0, 200)}`)
    return false
  } catch (e) {
    console.error(`[unshare] fcm exception: ${e}`)
    return false
  }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()

    const oldRecord = payload?.old_record ?? payload?.record ?? payload
    const type = payload?.type ?? 'DELETE'

    if (type !== 'DELETE' || !oldRecord) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: 'not_delete' }), {
        status: 200, headers: { 'content-type': 'application/json' }
      })
    }

    const patientId = oldRecord.patientId ?? oldRecord.patient_id
    const ownerId = oldRecord.ownerId ?? oldRecord.owner_id
    const sharedWithUserId = oldRecord.sharedWithUserId ?? oldRecord.shared_with_user_id

    if (!patientId || !sharedWithUserId) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_fields', oldRecord }), {
        status: 400, headers: { 'content-type': 'application/json' }
      })
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('deviceToken')
      .eq('userId', sharedWithUserId)
      .eq('platform', 'android')
      .not('deviceToken', 'is', null)

    if (!subs?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no_caregiver_devices' }), {
        status: 200, headers: { 'content-type': 'application/json' }
      })
    }

    // Data-only HIGH — Java handler invalida cache local + remove paciente +
    // doses + tratamentos do paciente. Sem tray visível (silent operation).
    const data: Record<string, string> = {
      kind: 'patient_unshared',
      patientId: String(patientId),
      ownerId: String(ownerId ?? ''),
      sharedWithUserId: String(sharedWithUserId)
    }

    const collapseKey = `unshare_${patientId}_${sharedWithUserId}`
    let sent = 0
    let errors = 0
    for (const sub of subs) {
      const ok = await sendFcmDataOnly(sub.deviceToken, data, collapseKey)
      if (ok) sent++; else errors++
    }

    try {
      await supabase.from('alarm_audit_log').insert({
        user_id: sharedWithUserId,
        source: SOURCE,
        action: 'unshare_notified',
        metadata: { patientId, ownerId, sent, errors, devices: subs.length }
      })
    } catch (_e) { /* ignore */ }

    return new Response(JSON.stringify({ ok: true, sent, errors, devices: subs.length }), {
      status: 200, headers: { 'content-type': 'application/json' }
    })
  } catch (e) {
    console.error(`[unshare-handler] error: ${e}`)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    })
  }
})
