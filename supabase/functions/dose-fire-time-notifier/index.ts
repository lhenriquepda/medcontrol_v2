// Item #281 (release v0.2.3.7) — fire-time FCM caregiver alarm.
//
// pg_cron invoca esta Edge a cada 1 minuto. Busca doses pending com
// scheduledAt na janela [NOW()-90s, NOW()+30s] que ainda não tiveram
// fire FCM dispatched (fire_notified_at IS NULL).
//
// Pra cada dose: dispatch FCM `notification` payload a cada cuidador
// (patient_shares.sharedWithUserId). Android renderiza tray imediato
// mesmo com app KILLED/Doze (mesma técnica #279/#280).
//
// Owner NÃO recebe — local AlarmManager (AlarmScheduler.scheduleDoseAlarm)
// cuida do owner. Fire-time FCM é ESPECIFICAMENTE pra caregivers cujo
// app pode estar killed.
//
// Idempotência: doses marcadas `fire_notified_at = NOW()` após dispatch.
// Próximo cron run salta essas.

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_PROJECT = Deno.env.get('FIREBASE_PROJECT_ID')!
const FCM_CLIENT  = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const FCM_KEY_PEM = Deno.env.get('FIREBASE_PRIVATE_KEY')!

const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'medcontrol' } })

const SOURCE = 'edge_fire_time'

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

async function sendFcmNotification(deviceToken: string, title: string, body: string, data: Record<string, string>, collapseKey?: string): Promise<boolean> {
  const accessToken = await getFcmAccessToken()
  // deno-lint-ignore no-explicit-any
  const androidCfg: any = { priority: 'HIGH' }
  // v0.2.3.7 Bug B fix — collapseKey unique per logical event (e.g., doseId)
  // prevents Android auto-collapse with sibling notifs (e.g., "Dose programada"
  // + "Hora da dose" same dose). Without unique key, tap on collapsed group
  // loses last message's data extras → MainActivity.handleAlarmAction sees
  // intent.getExtras() == null. Setting collapseKey forces each notif into
  // distinct tray slot, preserving its data payload on tap.
  if (collapseKey) androidCfg.collapseKey = collapseKey
  const message: any = {
    token: deviceToken,
    notification: { title, body },
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
    console.warn(`[fire-time] fcm err ${resp.status}: ${err.slice(0, 200)}`)
    return false
  } catch (e) {
    console.error(`[fire-time] fcm exception: ${e}`)
    return false
  }
}

function formatHHMM(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  } catch { return iso }
}

Deno.serve(async (_req) => {
  try {
    // Fetch pending doses fire-window not yet notified
    const { data: doses, error: dosesErr } = await supabase
      .from('doses')
      .select('id, userId, patientId, medName, unit, scheduledAt, status, type')
      .eq('status', 'pending')
      .is('fire_notified_at', null)
      .gte('scheduledAt', new Date(Date.now() - 90_000).toISOString())
      .lte('scheduledAt', new Date(Date.now() + 30_000).toISOString())
      .limit(200)

    if (dosesErr) {
      return new Response(JSON.stringify({ ok: false, error: dosesErr.message }), {
        status: 500, headers: { 'content-type': 'application/json' }
      })
    }

    if (!doses?.length) {
      return new Response(JSON.stringify({ ok: true, doses: 0 }), {
        status: 200, headers: { 'content-type': 'application/json' }
      })
    }

    // Collect unique patientIds
    const patientIds = Array.from(new Set(doses.map(d => d.patientId)))

    // Lookup patients (names)
    const { data: patients } = await supabase
      .from('patients').select('id, name').in('id', patientIds)
    const patientNameById = new Map((patients ?? []).map(p => [p.id, p.name]))

    // Lookup caregivers per patient
    const { data: shares } = await supabase
      .from('patient_shares').select('patientId, sharedWithUserId').in('patientId', patientIds)
    const caregiversByPatient = new Map<string, string[]>()
    for (const s of (shares ?? [])) {
      const arr = caregiversByPatient.get(s.patientId) ?? []
      arr.push(s.sharedWithUserId)
      caregiversByPatient.set(s.patientId, arr)
    }

    let totalSent = 0
    let totalErrors = 0
    const firedDoseIds: string[] = []

    for (const dose of doses) {
      const caregivers = caregiversByPatient.get(dose.patientId) ?? []
      if (!caregivers.length) {
        // Still mark notified — no caregivers means nothing to do at fire-time
        firedDoseIds.push(dose.id)
        continue
      }

      const patientName = patientNameById.get(dose.patientId) ?? 'paciente'
      const hhmm = formatHHMM(dose.scheduledAt)
      const title = `Hora da dose — ${patientName}`
      const body = `${dose.medName ?? 'Medicamento'} às ${hhmm}`
      const data: Record<string, string> = {
        kind: 'dose_fire_time',
        // openDoseId matches MainActivity.handleAlarmAction Intent extra key →
        // existing JS handler (App.jsx dosy:openDose) opens DoseModal on tap.
        openDoseId: dose.id,
        doseId: dose.id,
        patientId: dose.patientId,
        scheduledAt: dose.scheduledAt,
        medName: String(dose.medName ?? ''),
        ownerUserId: String(dose.userId ?? '')
      }

      // Dispatch to all caregivers' android push_subs
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('userId, deviceToken')
        .in('userId', caregivers)
        .eq('platform', 'android')
        .not('deviceToken', 'is', null)

      if (subs?.length) {
        // collapseKey = `fire_${doseId}` ensures uniqueness across both
        // "Dose programada" (dose-trigger-handler insert path) and "Hora da
        // dose" (this fire-time path) for the same dose.
        const collapseKey = `fire_${dose.id}`
        for (const sub of subs) {
          const ok = await sendFcmNotification(sub.deviceToken, title, body, data, collapseKey)
          if (ok) totalSent++; else totalErrors++
        }
      }
      firedDoseIds.push(dose.id)
    }

    // Mark fire_notified_at for all processed doses (idempotency)
    if (firedDoseIds.length > 0) {
      await supabase
        .from('doses')
        .update({ fire_notified_at: new Date().toISOString() })
        .in('id', firedDoseIds)
    }

    // Audit summary
    try {
      await supabase.from('alarm_audit_log').insert({
        source: SOURCE,
        action: 'cron_tick',
        metadata: { doses: doses.length, sent: totalSent, errors: totalErrors }
      })
    } catch (_e) { /* ignore */ }

    return new Response(JSON.stringify({
      ok: true, doses: doses.length, sent: totalSent, errors: totalErrors, firedDoseIds
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    console.error(`[fire-time] error: ${e}`)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    })
  }
})
