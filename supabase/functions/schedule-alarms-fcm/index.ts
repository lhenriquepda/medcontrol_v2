// Item #083.2 (release v0.1.7.2) — FCM-driven alarm scheduling cron 6h
//
// Edge Function chamada via pg_cron a cada 6h. Pra cada user com push_subscription
// FCM ativo, busca doses pendentes próximas 72h e manda FCM **data message**
// (silencioso, não-notification) com payload { action: "schedule_alarms", doses: [...] }.
//
// Device recebe via DosyMessagingService → AlarmScheduler.scheduleDose pra cada
// dose → AlarmManager.setAlarmClock agenda local → user idoso recebe despertador
// no horário mesmo sem nunca abrir app.
//
// Defense-in-depth caminho 1+2 coordenado:
//   - Trigger DB (#083.3) cobre real-time (<2s ao cadastrar)
//   - Este cron 6h cobre garantia (sweep 72h, recupera devices que perderam FCM data)
//   - rescheduleAll quando app abre (#083.7) reagenda local
//   - WorkManager 6h (#081) pega via REST direto se FCM falhar
//
// Idempotência: AlarmScheduler.scheduleDose com mesmo id (hash determinístico
// dos doseIds) = replace, nunca duplica. Filtra doses cujo dose_alarms_scheduled
// já tem row pro device (evita FCM redundante quando rescheduleAll já cobriu).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getUserNotifPrefs, inDndWindow } from '../_shared/userPrefs.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_PROJECT = Deno.env.get('FIREBASE_PROJECT_ID')!
const FCM_CLIENT  = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const FCM_KEY_PEM = Deno.env.get('FIREBASE_PRIVATE_KEY')!

const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'medcontrol' } })

const HORIZON_HOURS = 72

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

// ─── Send FCM data message ────────────────────────────────────────
async function sendFcmData(deviceToken: string, dataPayload: Record<string, string>): Promise<boolean> {
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
          // SEM `notification` field — silencioso, só wake-up app
          data: dataPayload,
          android: {
            priority: 'HIGH'
            // sem notification config — não mostra tray
          }
        }
      })
    }
  )
  if (!resp.ok) {
    const err = await resp.text()
    if (resp.status === 404 || err.includes('UNREGISTERED') || err.includes('INVALID_ARGUMENT')) {
      // Token inválido — cleanup
      await supabase.from('push_subscriptions').delete().eq('deviceToken', deviceToken)
    }
    console.warn(`[schedule-alarms-fcm] send fail ${resp.status}: ${err.slice(0, 200)}`)
    return false
  }
  return true
}

// ─── Main handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const now = new Date()
  const horizonEnd = new Date(now.getTime() + HORIZON_HOURS * 60 * 60 * 1000)

  try {
    // 1. Pega todos push_subscriptions FCM Android ativos
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('userId, deviceToken')
      .not('deviceToken', 'is', null)
    if (subErr) throw subErr

    // Group by userId
    const byUser = new Map<string, { deviceToken: string }[]>()
    for (const s of subs ?? []) {
      if (!byUser.has(s.userId)) byUser.set(s.userId, [])
      byUser.get(s.userId)!.push({ deviceToken: s.deviceToken })
    }

    let totalUsers = 0, totalSent = 0, totalErrors = 0, totalSkippedCriticalOff = 0

    for (const [userId, userSubs] of byUser) {
      totalUsers++

      // Item #085 (release v0.1.7.3) — respeita toggle Alarme Crítico per user.
      // Se OFF, skip FCM data pra este user (não agenda alarme nativo).
      const prefs = await getUserNotifPrefs(supabase, userId)
      if (!prefs.criticalAlarm) {
        totalSkippedCriticalOff++
        continue
      }

      // 2. Doses pendentes próximas 72h pra este user
      // Item #128 BUG-040 fix: select id + name pra mapear patientName no payload
      const { data: ownPatients } = await supabase
        .from('patients').select('id, name').eq('userId', userId)
      const patientIds = ownPatients?.map(p => p.id) ?? []
      if (patientIds.length === 0) continue
      const patientNameById = new Map((ownPatients ?? []).map(p => [p.id, p.name]))

      const { data: doses } = await supabase
        .from('doses')
        .select('id, medName, unit, scheduledAt, patientId')
        .eq('status', 'pending')
        .gte('scheduledAt', now.toISOString())
        .lte('scheduledAt', horizonEnd.toISOString())
        .in('patientId', patientIds)
        .order('scheduledAt', { ascending: true })
        .limit(500)

      if (!doses?.length) continue

      // Item #087 (release v0.1.7.3) — filtra doses que caem em janela DND.
      // Alarme nativo NÃO deve disparar dentro da janela; notify-doses cron
      // mandará push tray como cobertura silenciosa.
      const dosesOutsideDnd = doses.filter(d => !inDndWindow(new Date(d.scheduledAt), prefs))
      if (!dosesOutsideDnd.length) continue

      // 3. Payload data — JSON stringify pra fits no FCM data limit (~4KB)
      // Item #128 BUG-040: incluir patientName pra AlarmActivity agrupar correto
      // (era "Sem paciente" pra todas doses).
      const dosesPayload = dosesOutsideDnd.map(d => ({
        doseId: d.id,
        medName: d.medName,
        unit: d.unit,
        scheduledAt: d.scheduledAt,
        patientName: patientNameById.get(d.patientId) || ''
      }))

      const data = {
        action: 'schedule_alarms',
        doses: JSON.stringify(dosesPayload)
      }

      // 4. Envia pra cada device do user
      for (const sub of userSubs) {
        const ok = await sendFcmData(sub.deviceToken, data)
        if (ok) totalSent++
        else totalErrors++
      }
    }

    console.log(`[schedule-alarms-fcm] users=${totalUsers} sent=${totalSent} errors=${totalErrors} skippedCriticalOff=${totalSkippedCriticalOff} ts=${now.toISOString()}`)

    return new Response(JSON.stringify({ ok: true, users: totalUsers, sent: totalSent, errors: totalErrors, skippedCriticalOff: totalSkippedCriticalOff }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[schedule-alarms-fcm] error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
