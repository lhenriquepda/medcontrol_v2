// DEPRECATED — release v0.2.3.0 #216 + #219
//
// Esta Edge Function foi descontinuada com o refactor #215 (v0.2.3.0):
//   - Cron `notify-doses-1min` foi UNSCHEDULED em #209 (v0.2.1.9)
//   - Código antigo referenciava `medcontrol.dose_alarms_scheduled` tabela
//     DROPADA em #214 (v0.2.2.4) → causava 500 PostgreSQL 42P01 quando invocada
//   - Substituída pelo helper unificado `AlarmScheduler.scheduleDoseAlarm`
//     consumido por `daily-alarm-sync` (cron 5am BRT) + `dose-trigger-handler`
//     (trigger DB realtime) + `DoseSyncWorker` (Android WorkManager 6h)
//
// Mantida como stub 410 Gone pra:
//   - Não quebrar callers legacy (preferível 410 vs 500/404)
//   - Permitir cleanup futuro via `supabase functions delete notify-doses`
//   - Documentar deprecation pra próxima auditoria

Deno.serve(() => {
  return new Response(
    JSON.stringify({
      ok: false,
      deprecated: true,
      message: 'notify-doses foi descontinuada em v0.2.3.0. Use daily-alarm-sync + dose-trigger-handler.',
      replacement: 'daily-alarm-sync (cron 5am BRT) + dose-trigger-handler (trigger DB realtime)',
      since: 'v0.2.3.0',
      removed_dependency: 'medcontrol.dose_alarms_scheduled (DROPADA em v0.2.2.4)'
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' }
    }
  )
})
