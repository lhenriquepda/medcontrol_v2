SELECT cron.schedule(
  'alarm-audit-cleanup-daily',
  '15 3 * * *',  -- 3:15 UTC = 0:15 BRT diário
  $$SELECT medcontrol.cron_alarm_audit_cleanup();$$
);
