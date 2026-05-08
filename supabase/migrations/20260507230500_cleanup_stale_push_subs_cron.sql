-- Item #199 (release v0.2.1.5) — cleanup automático push_subscriptions
-- com deviceToken=NULL acumulados de instalações antigas.
--
-- User típico tem 6+ rows stale ao longo do tempo. Cron schedule-alarms-fcm
-- já filtra por deviceToken IS NOT NULL, então não é problema funcional,
-- mas é debt de DB.
--
-- Schedule: diário 5am UTC (02am BRT, low traffic).
-- Threshold: deviceToken NULL E createdAt > 30 dias.

CREATE OR REPLACE FUNCTION medcontrol.cleanup_stale_push_subscriptions()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, medcontrol, pg_catalog
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  DELETE FROM medcontrol.push_subscriptions
  WHERE "deviceToken" IS NULL
    AND "createdAt" < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'cleanup_stale_push_subscriptions: deleted % rows', v_deleted;
  RETURN v_deleted;
END;
$$;

SELECT cron.schedule(
  'cleanup-stale-push-subs-daily',
  '0 5 * * *',
  $$ SELECT medcontrol.cleanup_stale_push_subscriptions() $$
);
