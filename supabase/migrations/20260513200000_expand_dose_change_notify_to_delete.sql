-- #221 v0.2.3.0 — expand trigger dose_change_notify pra firear em DELETE também
-- + remover WHEN restritivo (Edge dose-trigger-handler agora decide cancel_alarms
-- baseado em record/old_record). Trigger continua AFTER INSERT/UPDATE/DELETE +
-- envia OLD em DELETE/UPDATE pra Edge inferir transição pending→non-pending.
--
-- Comportamento Edge dose-trigger-handler v0.2.3.0:
--   - INSERT pending future → action=schedule_alarms (cuidadores também)
--   - UPDATE status pending→non-pending → action=cancel_alarms cross-device
--   - UPDATE pending→pending (ex: scheduledAt mudou) → action=schedule_alarms
--   - DELETE pending → action=cancel_alarms cross-device
--
-- Trigger WHEN antigo (NEW.status='pending' AND NEW.scheduledAt>now) filtrava
-- DEMAIS — UPDATEs com status mudando pra done não disparavam Edge, deixando
-- alarme zombie. Removido. Edge faz filtragem fina via record/old_record.

CREATE OR REPLACE FUNCTION medcontrol.notify_dose_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, pg_temp
AS $$
DECLARE
  edge_url text := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/dose-trigger-handler';
  payload jsonb;
BEGIN
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

-- Recria trigger sem WHEN restritivo + cobre INSERT/UPDATE/DELETE
DROP TRIGGER IF EXISTS dose_change_notify ON medcontrol.doses;
CREATE TRIGGER dose_change_notify
  AFTER INSERT OR UPDATE OR DELETE
  ON medcontrol.doses
  FOR EACH ROW
  EXECUTE FUNCTION medcontrol.notify_dose_change();

COMMENT ON TRIGGER dose_change_notify ON medcontrol.doses IS
  '#221 v0.2.3.0 — chama Edge dose-trigger-handler em real-time pra schedule/cancel alarms via FCM <2s. Edge decide action baseado em record + old_record (INSERT/UPDATE pending → schedule_alarms; UPDATE pending→non-pending OR DELETE → cancel_alarms).';
