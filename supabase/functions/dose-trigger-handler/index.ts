// Item #083.3 (release v0.1.7.2) — FCM scheduling em real-time via DB trigger
//
// Edge Function chamada por Postgres webhook (extension `pg_net` ou
// `supabase_functions.http_request`) ao INSERT/UPDATE em medcontrol.doses.
// Manda FCM data message imediato pra device(s) do user, agendar alarme
// nativo local em <2s.
//
// Cobre cenário: user cadastra dose +30min via web, app fechado.
// Sem este trigger, próximo cron 6h pode demorar até 6h pra agendar.
//
// Webhook payload (Supabase Database Webhooks):
//   { type: "INSERT" | "UPDATE", table: "doses", record: {...}, old_record: {...} }

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getUserNotifPrefs, inDndWindow } from '../_shared/userPrefs.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_PROJECT = Deno.env.get('FIREBASE_PROJECT_ID')!
const FCM_CLIENT  = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const FCM_KEY_PEM = Deno.env.get('FIREBASE_PRIVATE_KEY')!

const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'medcontrol' } })

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

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: {
    id: string
    userId: string
    patientId: string
    medName: string
    unit: string
    scheduledAt: string
    status: string
    [key: string]: unknown
  }
  old_record?: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 })
  }

  const { type, table, record } = payload

  // Filtra: só INSERT/UPDATE em doses pendentes futuras
  if (table !== 'doses') return new Response(JSON.stringify({ ok: true, skipped: 'not-doses' }))
  if (type === 'DELETE') return new Response(JSON.stringify({ ok: true, skipped: 'delete' }))
  if (record.status !== 'pending') return new Response(JSON.stringify({ ok: true, skipped: 'not-pending' }))

  const scheduledAt = new Date(record.scheduledAt)
  if (scheduledAt.getTime() < Date.now()) {
    return new Response(JSON.stringify({ ok: true, skipped: 'past-dose' }))
  }

  // Item #139 (release v0.2.0.10 — egress-audit F7): skip se scheduledAt > 6h
  // futuro. Cron schedule-alarms-fcm-6h cobre janela 6h adiante. Antes:
  // CADA INSERT em doses (cron extend insere 100s doses futuras 30d adiante)
  // disparava FCM imediato sem necessidade — payload egress + DB queries +
  // FCM API calls multiplicados desnecessariamente.
  // Estimado: Edge invocations -50 a -70%.
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000
  if (scheduledAt.getTime() > Date.now() + SIX_HOURS_MS) {
    return new Response(JSON.stringify({ ok: true, skipped: 'beyond-cron-horizon' }))
  }

  try {
    // Item #085 (release v0.1.7.3) — respeita toggle Alarme Crítico do user.
    // Se OFF, skip FCM data (não agenda alarme nativo). notify-doses cron
    // mandará push tray no momento certo.
    const prefs = await getUserNotifPrefs(supabase, record.userId)
    if (!prefs.criticalAlarm) {
      return new Response(JSON.stringify({ ok: true, skipped: 'critical-alarm-off' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Item #087 (release v0.1.7.3) — respeita janela DND do user. Se dose cai
    // em DND, skip FCM data — alarme nativo NÃO deve disparar nesse intervalo.
    // notify-doses cron mandará push tray como cobertura silenciosa.
    if (inDndWindow(scheduledAt, prefs)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'dnd-window' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Busca push_subscriptions FCM do user
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('deviceToken')
      .eq('userId', record.userId)
      .not('deviceToken', 'is', null)

    if (!subs?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no-fcm-subs' }))
    }

    // Item #128 BUG-040: busca patient name pra incluir no payload — antes
    // alarm activity mostrava "Sem paciente" pra todas doses.
    const { data: patient } = await supabase
      .from('patients')
      .select('name')
      .eq('id', record.patientId)
      .maybeSingle()

    const data = {
      action: 'schedule_alarms',
      doses: JSON.stringify([{
        doseId: record.id,
        medName: record.medName,
        unit: record.unit,
        scheduledAt: record.scheduledAt,
        patientName: patient?.name || ''
      }])
    }

    const accessToken = await getFcmAccessToken()
    let sent = 0, errors = 0

    for (const sub of subs) {
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
              token: sub.deviceToken,
              data,
              android: { priority: 'HIGH' }
            }
          })
        }
      )

      if (resp.ok) {
        sent++
      } else {
        errors++
        const err = await resp.text()
        if (resp.status === 404 || err.includes('UNREGISTERED') || err.includes('INVALID_ARGUMENT')) {
          await supabase.from('push_subscriptions').delete().eq('deviceToken', sub.deviceToken)
        }
      }
    }

    console.log(`[dose-trigger] dose=${record.id} type=${type} sent=${sent} errors=${errors}`)

    return new Response(JSON.stringify({ ok: true, sent, errors }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[dose-trigger] error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
