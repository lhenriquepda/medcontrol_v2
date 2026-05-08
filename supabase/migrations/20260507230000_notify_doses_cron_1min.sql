-- Item #197 (release v0.2.1.5) — restaurar caminho 2 (push tray fallback).
-- Edge Function notify-doses já existe e funciona; faltava só cron job.
--
-- Schedule: a cada 1 minuto. Função tem janela [-1min, +advanceMins+1min].
-- Default advanceMins=0 → janela 2min total → cron 1min garante 0 misses.
-- Idempotência via tabela dose_notifications (PK doseId+channel) — re-runs
-- não duplicam push.
--
-- Defense-in-depth: se cron schedule-alarms-fcm-6h falhou OU AlarmScheduler
-- local crashou OU FCM data não chegou, este cron entrega push tray simples
-- como fallback. Push é skipped se alarm nativo já agendado
-- (shouldSkipPushBecauseAlarmScheduled em notify-doses).
--
-- Custo egress: 1 query pequena por minuto + N FCM por dose pendente nos
-- próximos minutos. Aceitável (<0.1MB/dia/user típico).

SELECT cron.schedule(
  'notify-doses-1min',
  '* * * * *',
  $$
    SELECT net.http_post(
      url:='https://guefraaqbkcehofchnrc.supabase.co/functions/v1/notify-doses',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body:='{}'::jsonb
    ) AS request_id;
  $$
);
