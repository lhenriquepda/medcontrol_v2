-- Item #209 v0.2.1.9 — substituir crons antigos por daily-alarm-sync.
-- - DELETE notify-doses-1min (storm 1440 reqs/dia/user — substituído por
--   AlarmManager nativo + trigger DB real-time)
-- - DELETE schedule-alarms-fcm-6h (substituído por cron diário 5am BRT)
-- - ADD daily-alarm-sync-5am (cron 8am UTC = 5am BRT, sync alarmes 48h)

SELECT cron.unschedule('notify-doses-1min');
SELECT cron.unschedule('schedule-alarms-fcm-6h');

SELECT cron.schedule(
  'daily-alarm-sync-5am',
  '0 8 * * *', -- 8am UTC = 5am BRT (UTC-3, BRT sem DST desde 2019)
  $$
    SELECT net.http_post(
      url:='https://guefraaqbkcehofchnrc.supabase.co/functions/v1/daily-alarm-sync',
      headers:='{"Content-Type":"application/json"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);
