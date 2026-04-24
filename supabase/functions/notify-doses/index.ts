// Supabase Edge Function — notify-doses
// Sends Web Push notifications for doses coming up within each user's advanceMins window.
// Intended to be called every minute by an external cron (e.g. cron-job.org) or pg_cron.
//
// Required env vars (set in Supabase dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   — base64url uncompressed P-256 public key
//   VAPID_PRIVATE_KEY  — base64url raw P-256 private key (JWK "d" field)
//   VAPID_SUBJECT      — mailto: or https: identifier (e.g. mailto:you@example.com)
//   SUPABASE_URL       — set automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — set automatically by Supabase

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@medcontrol.app'

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

const supabase = createClient(supabaseUrl, serviceKey, {
  db: { schema: 'medcontrol' }
})

Deno.serve(async (req) => {
  // Allow GET (cron ping) and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const now = new Date()
  const results: { userId: string; sent: number; errors: number }[] = []

  try {
    // Load all push subscriptions
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('*')
    if (subErr) throw subErr

    // Group by userId
    const byUser = new Map<string, typeof subs>()
    for (const sub of subs ?? []) {
      if (!byUser.has(sub.userId)) byUser.set(sub.userId, [])
      byUser.get(sub.userId)!.push(sub)
    }

    for (const [userId, userSubs] of byUser) {
      const advanceMins = userSubs[0]?.advanceMins ?? 15
      const windowStart = new Date(now.getTime() - 60 * 1000)           // 1 min ago (jitter)
      const windowEnd   = new Date(now.getTime() + advanceMins * 60 * 1000 + 60 * 1000)

      // Fetch upcoming pending doses for this user (via their patients)
      const { data: doses, error: doseErr } = await supabase
        .from('doses')
        .select('id, medName, unit, scheduledAt, patientId')
        .eq('status', 'pending')
        .gte('scheduledAt', windowStart.toISOString())
        .lte('scheduledAt', windowEnd.toISOString())
        .in('patientId',
          // sub-select patientIds owned by or shared with this user
          // simplification: fetch via a separate query
          (await supabase.from('patients').select('id').eq('userId', userId)).data?.map((p) => p.id) ?? []
        )

      if (doseErr || !doses?.length) {
        results.push({ userId, sent: 0, errors: 0 })
        continue
      }

      let sent = 0
      let errors = 0

      for (const dose of doses) {
        const minutesUntil = Math.round((new Date(dose.scheduledAt).getTime() - now.getTime()) / 60000)
        const body = minutesUntil <= 0
          ? `${dose.medName} — ${dose.unit} (agora)`
          : `${dose.medName} — ${dose.unit} (em ${minutesUntil} min)`

        for (const sub of userSubs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: sub.keys },
              JSON.stringify({
                title: 'MedControl 💊',
                body,
                tag: `dose-${dose.id}`,
                url: '/',
                doseId: dose.id
              })
            )
            sent++
          } catch (err: unknown) {
            errors++
            // 410 Gone = subscription expired → delete it
            if ((err as { statusCode?: number }).statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            }
          }
        }
      }

      results.push({ userId, sent, errors })
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
