-- v0.2.3.1 — Cleanup tabela + cron órfãos do sistema notify-doses descontinuado.
--
-- Histórico:
--   #080 (v0.1.7.1) criou tabela dose_notifications pra idempotência de notify-doses Edge
--   #197 (v0.2.1.5) ativou cron notify-doses-1min
--   #209 (v0.2.1.9) UNSCHEDULED cron via SQL inline
--   #216+#219 (v0.2.3.0) descontinuou Edge notify-doses + schedule-alarms-fcm (stubs 410)
--
-- Refactor v0.2.3.1 cleanup:
--   1. DROP tabela dose_notifications (150+ rows órfãs, sem readers/writers ativos)
--   2. Garantir cron notify-doses-1min unscheduled (idempotente)
--   3. (Edge function delete via supabase functions CLI — fora SQL)

DROP TABLE IF EXISTS medcontrol.dose_notifications CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-doses-1min') THEN
    PERFORM cron.unschedule('notify-doses-1min');
    RAISE NOTICE 'Unscheduled cron notify-doses-1min (legacy)';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'schedule-alarms-fcm-6h') THEN
    PERFORM cron.unschedule('schedule-alarms-fcm-6h');
    RAISE NOTICE 'Unscheduled cron schedule-alarms-fcm-6h (legacy)';
  END IF;
END $$;
