// Item #209 v0.2.1.9 — Daily alarm sync (cron 8am UTC = 5am BRT)
// Substitui notify-doses-1min + schedule-alarms-fcm-6h.
//
// v0.2.2.0 — adiciona audit log (alarm_audit_log) pra observabilidade admin.dosymed.
// v0.2.3.0 #215 — janela dinâmica + chunking 30 doses/FCM (#225) + audit metadata
//                 enriquecida {branch, horizon, source_scenario}. Helper unificado
//                 Java AlarmScheduler.scheduleDoseAlarm decide branch local.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getUserNotifPrefs, inDndWindow } from '../_shared/userPrefs.ts'
import { getEnabledAuditUsers, logAuditBatch, AuditRow } from '../_shared/auditLog.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_PROJECT = Deno.env.get('FIREBASE_PROJECT_ID')!
const FCM_CLIENT  = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const FCM_KEY_PEM = Deno.env.get('FIREBASE_PRIVATE_KEY')!

const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'medcontrol' } })

// #215 v0.2.3.0 — janela dinâmica + chunking
const HORIZON_HOURS_FULL = 48
const HORIZON_HOURS_REDUCED = 24
const ITEM_LIMIT_THRESHOLD = 400      // > 400 itens projetados → reduz horizon
const FCM_CHUNK_SIZE = 30              // payload ~3KB safe margin vs FCM 4KB limit
const SOURCE = 'edge_daily_sync'

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
  const pemBody = FCM_KEY_PEM.replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '')
  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
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

async function sendFcmDataWithRetry(deviceToken: string, dataPayload: Record<string, string>): Promise<boolean> {
  const MAX_ATTEMPTS = 3
  const accessToken = await getFcmAccessToken()
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT}/messages:send`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: { token: deviceToken, data: dataPayload, android: { priority: 'HIGH' } }
          })
        }
      )
      if (resp.ok) return true
      const err = await resp.text()
      if (resp.status === 404 || err.includes('UNREGISTERED') || err.includes('INVALID_ARGUMENT')) {
        await supabase.from('push_subscriptions').delete().eq('deviceToken', deviceToken)
        console.warn(`[daily-alarm-sync] token invalid, deleted: ${err.slice(0, 200)}`)
        return false
      }
      if (attempt < MAX_ATTEMPTS && (resp.status >= 500 || resp.status === 429)) {
        const delay = 500 * Math.pow(2, attempt - 1) + Math.random() * 200
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      console.warn(`[daily-alarm-sync] send fail ${resp.status}: ${err.slice(0, 200)}`)
      return false
    } catch (e) {
      console.warn(`[daily-alarm-sync] exception attempt ${attempt}: ${(e as Error).message}`)
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)))
        continue
      }
    }
  }
  return false
}

// #215 #225 — chunking 30 doses/FCM message (DosyMessagingService idempotente via hash)
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }
  const now = new Date()

  try {
    const auditEnabledUsers = await getEnabledAuditUsers(supabase)
    const auditRows: AuditRow[] = []

    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions').select('userId, deviceToken').not('deviceToken', 'is', null)
    if (subErr) throw subErr

    const byUser = new Map<string, { deviceToken: string }[]>()
    for (const s of subs ?? []) {
      if (!byUser.has(s.userId)) byUser.set(s.userId, [])
      byUser.get(s.userId)!.push({ deviceToken: s.deviceToken })
    }

    let totalUsers = 0, totalDevicesOk = 0, totalDevicesFail = 0
    let totalSkippedNoDoses = 0

    for (const [userId, userSubs] of byUser) {
      totalUsers++
      const auditOn = auditEnabledUsers.has(userId)
      const prefs = await getUserNotifPrefs(supabase, userId)
      // deno-lint-ignore no-explicit-any
      const tz = (prefs as any).timezone || 'America/Sao_Paulo'

      // #215 — NÃO filtra criticalAlarm/DnD aqui. Envia TODAS doses pra device;
      // helper unificado Java AlarmScheduler.scheduleDoseAlarm decide branch local
      // baseado em prefs SharedPreferences sincronizadas.

      // v0.2.3.7 #279 fix-caregiver-daily-sync:
      // Inclui pacientes compartilhados (cuidador) além dos próprios. Antes só pegava
      // ownPatients — cuidador ficava sem self-healing diário se Edge dose-trigger-handler
      // falhar (FCM data-only deferred Doze, app force-stopped, etc).
      const { data: ownPatients } = await supabase
        .from('patients').select('id, name').eq('userId', userId)
      const ownIds = ownPatients?.map(p => p.id) ?? []

      const { data: shares } = await supabase
        .from('patient_shares').select('patientId').eq('sharedWithUserId', userId)
      const sharedIds = (shares ?? []).map(s => s.patientId)

      // Lookup nomes dos pacientes compartilhados (RLS bypass via service_role)
      const sharedPatients = sharedIds.length > 0
        ? (await supabase.from('patients').select('id, name').in('id', sharedIds)).data ?? []
        : []

      const allPatients = [...(ownPatients ?? []), ...sharedPatients]
      const patientIds = Array.from(new Set([...ownIds, ...sharedIds]))
      if (patientIds.length === 0) { totalSkippedNoDoses++; continue }
      const patientNameById = new Map(allPatients.map(p => [p.id, p.name]))

      // Fetch janela full 48h primeiro pra calcular projeção
      const horizonEndFull = new Date(now.getTime() + HORIZON_HOURS_FULL * 60 * 60 * 1000)
      const { data: dosesFull } = await supabase
        .from('doses')
        .select('id, medName, unit, scheduledAt, patientId')
        .eq('status', 'pending')
        .gte('scheduledAt', now.toISOString())
        .lte('scheduledAt', horizonEndFull.toISOString())
        .in('patientId', patientIds)
        .order('scheduledAt', { ascending: true })
        .limit(2000)

      if (!dosesFull?.length) { totalSkippedNoDoses++; continue }

      // #215 decisão 8 — projeta itens (estima 2 itens/dose pra criticalOn+!DnD, senão 1)
      let projectedItems = 0
      const criticalOn = prefs.criticalAlarm
      for (const d of dosesFull) {
        const isDnd = inDndWindow(new Date(d.scheduledAt), prefs, tz)
        projectedItems += (criticalOn && !isDnd) ? 2 : 1
      }
      const horizonHours = projectedItems > ITEM_LIMIT_THRESHOLD ? HORIZON_HOURS_REDUCED : HORIZON_HOURS_FULL
      const horizonEnd = new Date(now.getTime() + horizonHours * 60 * 60 * 1000)
      const doses = dosesFull.filter(d => new Date(d.scheduledAt) <= horizonEnd)

      if (auditOn) {
        auditRows.push({
          user_id: userId, source: SOURCE, action: 'batch_start',
          metadata: {
            dosesCount: doses.length, deviceCount: userSubs.length, tz,
            horizon: horizonHours, projectedItems,
            source_scenario: 'cron_5am'
          }
        })
      }

      const dosesPayload = doses.map(d => ({
        doseId: d.id,
        medName: d.medName,
        unit: d.unit,
        scheduledAt: d.scheduledAt,
        patientName: patientNameById.get(d.patientId) || ''
      }))

      // #215 #225 — chunking 30 doses/FCM message
      const chunks = chunkArray(dosesPayload, FCM_CHUNK_SIZE)

      // Fix race-condition device-validation 2026-05-13: incluir prefs no payload
      const prefsPayload = JSON.stringify({
        criticalAlarm: prefs.criticalAlarm,
        dndEnabled: prefs.dndEnabled,
        dndStart: prefs.dndStart,
        dndEnd: prefs.dndEnd,
      })

      for (const sub of userSubs) {
        // Envia chunks paralelo pra mesmo device — DosyMessagingService idempotente
        // via hash determinístico AlarmScheduler.idFromString (alinha JS).
        const sendPromises = chunks.map((chunk, idx) =>
          sendFcmDataWithRetry(sub.deviceToken, {
            action: 'schedule_alarms',
            doses: JSON.stringify(chunk),
            syncedAt: now.toISOString(),
            horizonHours: String(horizonHours),
            chunkIndex: String(idx),
            chunkTotal: String(chunks.length),
            source_scenario: 'cron_5am',
            prefs: prefsPayload
          })
        )
        const results = await Promise.all(sendPromises)
        const allOk = results.every(r => r)
        if (allOk) totalDevicesOk++; else totalDevicesFail++

        if (auditOn) {
          for (const dp of dosesPayload) {
            auditRows.push({
              user_id: userId, source: SOURCE, action: allOk ? 'fcm_sent' : 'skipped',
              dose_id: dp.doseId, scheduled_at: dp.scheduledAt,
              patient_name: dp.patientName, med_name: dp.medName,
              device_id: sub.deviceToken.slice(-12),
              metadata: {
                kind: 'fcm_schedule_alarms',
                horizon: horizonHours,
                chunks: chunks.length,
                fcmAllOk: allOk,
                source_scenario: 'cron_5am'
              }
            })
          }
        }
      }

      if (auditOn) {
        auditRows.push({
          user_id: userId, source: SOURCE, action: 'batch_end',
          metadata: {
            dosesCount: doses.length, deviceCount: userSubs.length,
            horizon: horizonHours, projectedItems,
            source_scenario: 'cron_5am'
          }
        })
      }
    }

    await logAuditBatch(supabase, auditRows)

    const summary = {
      users: totalUsers, devicesOk: totalDevicesOk, devicesFail: totalDevicesFail,
      skippedNoDoses: totalSkippedNoDoses,
      auditRows: auditRows.length, ts: now.toISOString()
    }
    console.log(`[daily-alarm-sync] ${JSON.stringify(summary)}`)
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[daily-alarm-sync] error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
