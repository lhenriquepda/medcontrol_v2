-- Item #281 (release v0.2.3.7) — pg_cron job every 1 min calls dose-fire-time-notifier.
SELECT cron.schedule(
  'dose-fire-time-notifier-1min',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/dose-fire-time-notifier',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
