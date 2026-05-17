-- Bug A fix v0.2.3.7 — UPDATE pending→pending com scheduledAt mudado
-- agora dispara dose-trigger-handler com tipo UPDATE (single record) para
-- re-agendar alarme local via AlarmScheduler.scheduleDoseAlarm (idempotente).

CREATE OR REPLACE FUNCTION medcontrol.notify_dose_rescheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'medcontrol', 'public'
AS $$
DECLARE
  v_edge_url text := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/dose-trigger-handler';
  v_payload jsonb;
BEGIN
  IF NEW.status <> 'pending' OR OLD.status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF NEW."scheduledAt" IS NOT DISTINCT FROM OLD."scheduledAt" THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'type', 'UPDATE',
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'old_record', to_jsonb(OLD)
  );

  PERFORM net.http_post(
    url := v_edge_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := v_payload,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_dose_rescheduled] error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_dose_rescheduled ON medcontrol.doses;
CREATE TRIGGER trg_notify_dose_rescheduled
AFTER UPDATE OF "scheduledAt" ON medcontrol.doses
FOR EACH ROW
EXECUTE FUNCTION medcontrol.notify_dose_rescheduled();
