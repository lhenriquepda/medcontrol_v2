// Item #083.3 (release v0.1.7.2) — FCM scheduling em real-time via DB trigger
//
// Edge Function chamada por Postgres webhook (extension `pg_net`) ao
// INSERT/UPDATE/DELETE em medcontrol.doses. Manda FCM data message imediato
// pra device(s) do user, agendar alarme nativo local em <2s.
//
// v0.2.3.0 #215 + #221 — expand:
//   - UPDATE com status pending→non-pending OU DELETE → action=cancel_alarms
//   - Horizon 6h → 48h alinhado com daily-alarm-sync (#009 fix)
//   - Envia também pra cuidadores do paciente (patient_shares lookup)
//   - Audit log enriquecido {branch, horizon, source_scenario}

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getUserNotifPrefs } from '../_shared/userPrefs.ts'
import { getEnabledAuditUsers, logAuditBatch, AuditRow } from '../_shared/auditLog.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_PROJECT = Deno.env.get('FIREBASE_PROJECT_ID')!
const FCM_CLIENT  = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const FCM_KEY_PEM = Deno.env.get('FIREBASE_PRIVATE_KEY')!

const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'medcontrol' } })

// #215 v0.2.3.0 — alinhado com daily-alarm-sync horizon 48h (B-09 fix)
const HORIZON_MS = 48 * 60 * 60 * 1000
const SOURCE = 'edge_trigger_handler'

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
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'BATCH_UPDATE' | 'BATCH_DELETE'
  table: string
  schema: string
  record?: {
    id: string
    userId: string
    patientId: string
    medName: string
    unit: string
    scheduledAt: string
    status: string
    [key: string]: unknown
  } | null
  old_record?: {
    id: string
    userId: string
    patientId: string
    status: string
    [key: string]: unknown
  } | null
  // v0.2.3.1 Bloco 5 — batch trigger envia array de old rows
  old_rows?: Array<{
    id: string
    userId: string
    patientId: string
    status: string
    [key: string]: unknown
  }>
}

/**
 * #221 — Resolve TODOS user IDs que precisam receber FCM pra essa dose:
 *   - owner (record.userId OR old_record.userId)
 *   - cuidadores via medcontrol.patient_shares.sharedWithUserId
 * Cuidadores SEMPRE recebem (decisão 6 + 10) — toggle opt-in parqueado futuro.
 */
async function getRecipientUserIds(patientId: string, ownerId: string): Promise<string[]> {
  const recipients = new Set<string>([ownerId])
  try {
    const { data: shares } = await supabase
      .from('patient_shares')
      .select('sharedWithUserId')
      .eq('patientId', patientId)
    for (const s of shares ?? []) {
      if (s.sharedWithUserId) recipients.add(s.sharedWithUserId)
    }
  } catch (e) {
    console.warn(`[dose-trigger] patient_shares lookup error: ${(e as Error).message}`)
  }
  return Array.from(recipients)
}

// v0.2.3.7 #279 fix-caregiver-fcm:
// `notification` payload opcional pra cuidador. Garante Android tray render IMEDIATO
// mesmo se DosyMessagingService deferred por Doze/AppStandby. Owner mantém data-only
// (próprio app já tá ativo, alarme local agendado direto sem precisar de tray).
async function sendFcmTo(
  deviceToken: string,
  dataPayload: Record<string, string>,
  notification?: { title: string; body: string },
  collapseKey?: string
): Promise<boolean> {
  const accessToken = await getFcmAccessToken()
  // deno-lint-ignore no-explicit-any
  const androidCfg: any = { priority: 'HIGH' }
  // v0.2.3.7 Bug B fix — collapseKey unique per dose prevents Android merge
  // between "Dose programada" (this path) + "Hora da dose" (fire-time) trays.
  // Without it, tap on merged group loses data extras → MainActivity sees
  // intent.getExtras() == null. Set collapseKey only for caregiver notification
  // path (owner data-only path doesn't render tray, so collapseKey moot).
  if (collapseKey) androidCfg.collapseKey = collapseKey
  // deno-lint-ignore no-explicit-any
  const message: any = { token: deviceToken, data: dataPayload, android: androidCfg }
  if (notification) {
    message.notification = notification
    // android.notification omitted — FCM v1 API doesn't accept `priority` here
    // (campo é message.android.priority já set). Channel_id também omitted —
    // default FCM channel usado, garante delivery em device force-stopped onde
    // `dosy_tray` custom channel pode não ter sido criado pelo JS path.
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
    // Fix: NÃO deletar token em INVALID_ARGUMENT (pode ser payload error, não
    // token error). Só deletar quando explicitamente UNREGISTERED ou 404 not-found.
    if (resp.status === 404 || err.includes('UNREGISTERED') || err.includes('registration-token-not-registered')) {
      await supabase.from('push_subscriptions').delete().eq('deviceToken', deviceToken)
    }
    return false
  } catch {
    return false
  }
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

  const { type, table, record, old_record, old_rows } = payload

  if (table !== 'doses') {
    return new Response(JSON.stringify({ ok: true, skipped: 'not-doses' }))
  }

  const auditEnabledUsers = await getEnabledAuditUsers(supabase)
  const auditRows: AuditRow[] = []

  // v0.2.3.1 Bloco 5 — BATCH_UPDATE / BATCH_DELETE: agrega doseIds + envia 1 FCM
  // por device com CSV. DosyMessagingService reconstroi hash do grupo.
  if (type === 'BATCH_UPDATE' || type === 'BATCH_DELETE') {
    if (!old_rows || old_rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no-old-rows' }))
    }
    // v0.2.3.2 #230 fix — agrupa por (ownerId, patientId, minute_bucket) pra cobrir
    // grupos multi-dose. Edge envia CSV com TODOS doseIds do grupo no minuto pra
    // Java reconstruir hash sortedDoseIds.join('|') corretamente (Fix C path).
    type GroupKey = string  // `${userId}|${patientId}|${minute_iso}`
    const groups = new Map<GroupKey, {
      ownerId: string
      patientId: string
      minuteIso: string
      changedIds: Set<string>
    }>()
    for (const row of old_rows) {
      const scheduledAt = row.scheduledAt ?? row.scheduled_at
      if (!scheduledAt) continue
      const minuteIso = new Date(scheduledAt).toISOString().slice(0, 16) + ':00.000Z'
      const key = `${row.userId}|${row.patientId}|${minuteIso}`
      if (!groups.has(key)) {
        groups.set(key, {
          ownerId: String(row.userId),
          patientId: String(row.patientId),
          minuteIso,
          changedIds: new Set()
        })
      }
      groups.get(key)!.changedIds.add(String(row.id))
    }

    let totalSent = 0, totalErrors = 0
    for (const { ownerId, patientId, minuteIso, changedIds } of groups.values()) {
      const recipients = await getRecipientUserIds(patientId, ownerId)
      const reason = type === 'BATCH_DELETE' ? 'dose_deleted_batch' : 'status_change_batch'
      // Query ALL doses (incl. changed + siblings ainda pending) no mesmo minuto bucket
      // pra reconstruir group hash que AlarmScheduler usou ao agendar.
      const minStart = minuteIso
      const minEnd = new Date(new Date(minuteIso).getTime() + 60000).toISOString()
      const { data: groupSiblings } = await supabase
        .from('doses')
        .select('id, status')
        .eq('userId', ownerId)
        .eq('patientId', patientId)
        .gte('scheduledAt', minStart)
        .lt('scheduledAt', minEnd)
      const allGroupIds = new Set<string>(Array.from(changedIds))
      for (const s of (groupSiblings ?? [])) allGroupIds.add(String(s.id))
      const doseIds = Array.from(allGroupIds)
      const doseIdsCsv = doseIds.join(',')

      for (const userId of recipients) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('deviceToken')
          .eq('userId', userId)
          .not('deviceToken', 'is', null)
        if (!subs?.length) continue

        for (const sub of subs) {
          const ok = await sendFcmTo(sub.deviceToken, {
            action: 'cancel_alarms',
            doseIds: doseIdsCsv,
            source_scenario: reason,
            count: String(doseIds.length)
          })
          if (ok) totalSent++; else totalErrors++

          if (auditEnabledUsers.has(userId)) {
            // v0.2.3.2 #230 — audit só changed doses (não siblings do grupo que não mudaram)
            for (const did of changedIds) {
              auditRows.push({
                user_id: userId, source: SOURCE, action: 'cancelled',
                dose_id: did,
                device_id: sub.deviceToken.slice(-12),
                metadata: { reason, source_scenario: reason, batchSize: changedIds.size, groupSize: doseIds.length, fcmOk: ok }
              })
            }
          }
        }
      }
    }

    await logAuditBatch(supabase, auditRows)
    console.log(`[dose-trigger] ${type} groups=${groups.size} changedDoses=${old_rows.length} sent=${totalSent} errors=${totalErrors}`)
    return new Response(JSON.stringify({ ok: true, action: 'cancel_alarms_batch', sent: totalSent, errors: totalErrors }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // #221 — DELETE: dispara cancel_alarms cross-device
  if (type === 'DELETE') {
    if (!old_record) return new Response(JSON.stringify({ ok: true, skipped: 'no-old-record' }))
    const ownerId = String(old_record.userId)
    const patientId = String(old_record.patientId)
    const doseId = String(old_record.id)

    const recipients = await getRecipientUserIds(patientId, ownerId)
    let sent = 0, errors = 0

    for (const userId of recipients) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('deviceToken')
        .eq('userId', userId)
        .not('deviceToken', 'is', null)
      if (!subs?.length) continue

      for (const sub of subs) {
        const ok = await sendFcmTo(sub.deviceToken, {
          action: 'cancel_alarms',
          doseIds: doseId,
          source_scenario: 'dose_deleted'
        })
        if (ok) sent++; else errors++

        if (auditEnabledUsers.has(userId)) {
          auditRows.push({
            user_id: userId, source: SOURCE, action: 'cancelled',
            dose_id: doseId,
            device_id: sub.deviceToken.slice(-12),
            metadata: {
              reason: 'dose_deleted', source_scenario: 'dose_deleted',
              isOwner: userId === ownerId, fcmOk: ok
            }
          })
        }
      }
    }

    await logAuditBatch(supabase, auditRows)
    console.log(`[dose-trigger] DELETE dose=${doseId} recipients=${recipients.length} sent=${sent} errors=${errors}`)
    return new Response(JSON.stringify({ ok: true, action: 'cancel_alarms', sent, errors }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // #221 — UPDATE com status pending→non-pending: cancel_alarms cross-device
  if (type === 'UPDATE' && record && old_record &&
      old_record.status === 'pending' && record.status !== 'pending') {
    const ownerId = String(record.userId)
    const patientId = String(record.patientId)
    const doseId = String(record.id)
    const newStatus = String(record.status)

    const recipients = await getRecipientUserIds(patientId, ownerId)
    let sent = 0, errors = 0

    for (const userId of recipients) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('deviceToken')
        .eq('userId', userId)
        .not('deviceToken', 'is', null)
      if (!subs?.length) continue

      for (const sub of subs) {
        const ok = await sendFcmTo(sub.deviceToken, {
          action: 'cancel_alarms',
          doseIds: doseId,
          source_scenario: 'status_change',
          newStatus
        })
        if (ok) sent++; else errors++

        if (auditEnabledUsers.has(userId)) {
          auditRows.push({
            user_id: userId, source: SOURCE, action: 'cancelled',
            dose_id: doseId,
            device_id: sub.deviceToken.slice(-12),
            metadata: {
              reason: 'status_change', newStatus,
              source_scenario: 'status_change',
              isOwner: userId === ownerId, fcmOk: ok
            }
          })
        }
      }
    }

    await logAuditBatch(supabase, auditRows)
    console.log(`[dose-trigger] UPDATE→${newStatus} dose=${doseId} recipients=${recipients.length} sent=${sent} errors=${errors}`)
    return new Response(JSON.stringify({ ok: true, action: 'cancel_alarms', sent, errors }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // INSERT ou UPDATE pra pending — dispara schedule_alarms
  if (!record) return new Response(JSON.stringify({ ok: true, skipped: 'no-record' }))
  if (record.status !== 'pending') {
    return new Response(JSON.stringify({ ok: true, skipped: 'not-pending' }))
  }

  const scheduledAt = new Date(record.scheduledAt)
  if (scheduledAt.getTime() < Date.now()) {
    return new Response(JSON.stringify({ ok: true, skipped: 'past-dose' }))
  }
  // #215 B-09 — horizon 6h → 48h alinhado com daily-alarm-sync
  if (scheduledAt.getTime() > Date.now() + HORIZON_MS) {
    return new Response(JSON.stringify({ ok: true, skipped: 'beyond-horizon-48h' }))
  }

  try {
    const ownerId = String(record.userId)
    const patientId = String(record.patientId)
    const doseId = String(record.id)

    // #215 — NÃO filtra criticalAlarm/DnD aqui. Envia pra todos devices;
    // helper unificado Java AlarmScheduler.scheduleDoseAlarm decide branch local.

    // Patient name lookup pro AlarmActivity (#128 BUG-040)
    const { data: patient } = await supabase
      .from('patients').select('name').eq('id', patientId).maybeSingle()

    const dosePayload = [{
      doseId,
      medName: record.medName,
      unit: record.unit,
      scheduledAt: record.scheduledAt,
      patientName: patient?.name || ''
    }]

    const data: Record<string, string> = {
      action: 'schedule_alarms',
      doses: JSON.stringify(dosePayload),
      source_scenario: 'dose_inserted_or_updated',
      // openDoseId matches MainActivity.handleAlarmAction Intent extra key →
      // existing JS handler (App.jsx dosy:openDose) opens DoseModal on tap.
      // Used by caregiver path (isOwner=false) — owner relies on AlarmActivity.
      openDoseId: doseId
    }

    const recipients = await getRecipientUserIds(patientId, ownerId)
    let sent = 0, errors = 0

    for (const userId of recipients) {
      // #215 decisão 6 — cuidador SEMPRE recebe alarme cheio prioridade,
      // mas respeita DnD próprio do device dele (lógica branch local Java).
      // Fix race-condition device-validation 2026-05-13: incluir prefs no
      // payload FCM (autoritativo server-side, Java decide branch sem ler
      // SharedPreferences que pode estar stale).
      const userPrefs = await getUserNotifPrefs(supabase, userId)
      const prefsPayload = JSON.stringify({
        criticalAlarm: userPrefs.criticalAlarm,
        dndEnabled: userPrefs.dndEnabled,
        dndStart: userPrefs.dndStart,
        dndEnd: userPrefs.dndEnd,
      })

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('deviceToken')
        .eq('userId', userId)
        .not('deviceToken', 'is', null)
      if (!subs?.length) continue

      // v0.2.3.8 #287 fix-killed-caregiver:
      // REMOVED notification payload pra TODOS (owner + cuidador). Antes (v24):
      // cuidador recebia notification+data → Firebase Android SDK app killed renderiza
      // tray sozinho + NÃO chama onMessageReceived → AlarmScheduler.scheduleDoseAlarm
      // NUNCA executa → AlarmManager vazio → alarme nativo NUNCA dispara no horário.
      // Fix: data-only HIGH priority pra ambos. Handler nativo Java (DosyMessagingService)
      // renderiza tray custom IDÊNTICA + agenda AlarmManager.setAlarmClock local.
      // Trade-off Samsung: data-only HIGH é throttled em Restricted bucket sem notification
      // visible — mitigação: handler renderiza tray como user-visible action no recebimento,
      // sai do "data-only invisible" pattern + cron fire-time 1×/min cobre delay residual.
      const isOwner = userId === ownerId
      const collapseKey = `fire_${doseId}`
      for (const sub of subs) {
        const ok = await sendFcmTo(sub.deviceToken, { ...data, prefs: prefsPayload }, undefined, collapseKey)
        if (ok) sent++; else errors++

        if (auditEnabledUsers.has(userId)) {
          auditRows.push({
            user_id: userId, source: SOURCE, action: ok ? 'fcm_sent' : 'skipped',
            dose_id: doseId, scheduled_at: record.scheduledAt,
            patient_name: patient?.name || null, med_name: record.medName,
            device_id: sub.deviceToken.slice(-12),
            metadata: {
              kind: 'fcm_schedule_alarms', source_scenario: 'dose_inserted_or_updated',
              isOwner: isOwner, type, fcmOk: ok, withNotification: false
            }
          })
        }
      }
    }

    await logAuditBatch(supabase, auditRows)
    console.log(`[dose-trigger] ${type} dose=${doseId} recipients=${recipients.length} sent=${sent} errors=${errors}`)

    return new Response(JSON.stringify({ ok: true, sent, errors }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[dose-trigger] error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
