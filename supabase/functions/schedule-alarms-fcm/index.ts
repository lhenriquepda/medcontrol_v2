// DEPRECATED — release v0.2.3.0 #219
//
// Esta Edge Function foi descontinuada com o refactor #215 (v0.2.3.0):
//   - Cron `schedule-alarms-fcm-6h` foi UNSCHEDULED em #209 (v0.2.1.9)
//   - Substituída por `daily-alarm-sync` (cron 5am BRT diário, FCM data 48h horizon)
//   - Trabalhador `DoseSyncWorker` (Android WorkManager 6h) cobre defense-in-depth
//
// Mantida como stub 410 Gone pra:
//   - Não quebrar callers legacy (preferível 410 vs 500/404)
//   - Permitir cleanup futuro via `supabase functions delete schedule-alarms-fcm`

Deno.serve(() => {
  return new Response(
    JSON.stringify({
      ok: false,
      deprecated: true,
      message: 'schedule-alarms-fcm foi descontinuada em v0.2.3.0. Use daily-alarm-sync.',
      replacement: 'daily-alarm-sync (cron 5am BRT) + DoseSyncWorker (Android WorkManager 6h)',
      since: 'v0.2.3.0'
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' }
    }
  )
})
