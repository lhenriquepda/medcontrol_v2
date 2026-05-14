-- #215 v0.2.3.0 fix dedup trigger fires: move WHEN logic pra dentro function.
-- TG_OP não acessível em WHEN clause direto. Solução: keep trigger AFTER
-- INSERT/UPDATE/DELETE + filter inside function.
--
-- Causa raiz: createTreatmentWithDoses RPC faz INSERT + cascade UPDATEs
-- (actualTime null, metadata, audit triggers) na mesma transação. Sem dedup,
-- cada UPDATE fires Edge dose-trigger-handler → 3× FCM redundante mesma dose.
-- AlarmManager idempotente cobre UX, mas desperdiça FCM quota + audit log inflado.

CREATE OR REPLACE FUNCTION medcontrol.notify_dose_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, pg_temp
AS $$
DECLARE
  edge_url text := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/dose-trigger-handler';
  payload jsonb;
  should_fire boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    should_fire := (NEW.status = 'pending' AND NEW."scheduledAt" > now());
  ELSIF TG_OP = 'UPDATE' THEN
    should_fire := (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD."scheduledAt" IS DISTINCT FROM NEW."scheduledAt"
    );
  ELSIF TG_OP = 'DELETE' THEN
    should_fire := (OLD.status = 'pending');
  END IF;

  IF NOT should_fire THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'old_record', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END
  );

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload,
    timeout_milliseconds := 5000
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_dose_change] http_post failed: %', SQLERRM;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

COMMENT ON FUNCTION medcontrol.notify_dose_change() IS
  '#215 v0.2.3.0 dedup — fires Edge SÓ em INSERT/DELETE pending OR UPDATE com status/scheduledAt mudou. Cascade UPDATEs (actualTime, observation) skipped.';
