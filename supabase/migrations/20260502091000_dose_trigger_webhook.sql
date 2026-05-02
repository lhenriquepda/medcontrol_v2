-- Item #083.3 (release v0.1.7.2) — Postgres trigger ON INSERT/UPDATE doses
-- chama Edge Function dose-trigger-handler em real-time (<2s).
--
-- Cobre cenário: user cadastra dose +30min via web → trigger detecta INSERT
-- → Edge manda FCM data → device agenda alarme local. Sem este trigger,
-- próximo cron 6h podia demorar até 6h pra agendar.
--
-- Implementação via pg_net.http_post (extension nativa Supabase pra HTTP
-- chamadas async não-bloqueantes em triggers).

CREATE OR REPLACE FUNCTION medcontrol.notify_dose_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, pg_temp
AS $$
DECLARE
  edge_url text := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/dose-trigger-handler';
  -- service_role JWT pra Edge auth bypass
  service_jwt text := 'SUPABASE_SERVICE_ROLE_REVOKED';
  payload jsonb;
BEGIN
  -- Build payload no formato do webhook Supabase (compatível com handler)
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );

  -- Async HTTP POST (não-bloqueia INSERT). Falha silenciosa se Edge fora do ar.
  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_jwt
    ),
    body := payload,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Falha pg_net não deve quebrar INSERT/UPDATE. Log + continue.
  RAISE WARNING '[notify_dose_change] http_post failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger AFTER INSERT/UPDATE em doses
-- Item #083 audit (v0.1.7.2): WHEN clause filtra scheduledAt futuro pra evitar
-- HTTP wasted em doses com horário no passado (ex.: import histórico, edição).
DROP TRIGGER IF EXISTS dose_change_notify ON medcontrol.doses;
CREATE TRIGGER dose_change_notify
  AFTER INSERT OR UPDATE OF status, "scheduledAt"
  ON medcontrol.doses
  FOR EACH ROW
  WHEN (NEW.status = 'pending' AND NEW."scheduledAt" > now())
  EXECUTE FUNCTION medcontrol.notify_dose_change();

COMMENT ON TRIGGER dose_change_notify ON medcontrol.doses IS
  'Item #083.3 — chama Edge dose-trigger-handler em real-time pra agendar alarme nativo via FCM data <2s. Filtra status=pending + scheduledAt futuro pra evitar HTTP wasted.';
