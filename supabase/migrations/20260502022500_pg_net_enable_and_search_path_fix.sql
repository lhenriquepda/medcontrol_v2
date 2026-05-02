-- Item #083 (release v0.1.7.2) — fix server-side aplicado ad-hoc em 2026-05-02
-- formalizado como migration pra reprodutibilidade.
--
-- Problema descoberto durante validação device físico:
-- Trigger dose_change_notify (migration 20260502091000) chamava net.http_post(...)
-- mas falhava silenciosamente. Causas:
--   1. Extensão pg_net não estava habilitada no projeto.
--   2. search_path da function = 'medcontrol, pg_temp' — não inclui schema 'net',
--      então net.http_post resolvia como undefined function. EXCEPTION WHEN OTHERS
--      engolia o erro, INSERT seguia normal, mas Edge nunca era chamada.
--
-- Após fix manual:
--   - INSERT em doses dispara trigger
--   - pg_net._http_response registra status 200
--   - Edge dose-trigger-handler responde {"sent":N,"errors":0}
--   - Device recebe FCM data → AlarmScheduler agenda local AlarmManager
--   - Validado end-to-end via cadastro web + alarme tocou no Android.
--
-- Idempotente: aplicar de novo em prod (que já está nesse estado) é no-op.

-- 1. Habilita pg_net (mantida no schema 'extensions' por convenção Supabase).
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Recria notify_dose_change com search_path correto (inclui schema 'net').
CREATE OR REPLACE FUNCTION medcontrol.notify_dose_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, net, pg_temp
AS $$
DECLARE
  edge_url text := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/dose-trigger-handler';
  payload jsonb;
BEGIN
  -- Edge dose-trigger-handler é deployada com --no-verify-jwt.
  -- Não inclui service_role JWT em SQL/migration por segurança (vazaria em git).
  -- Validação acontece dentro da Edge.
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
    headers := jsonb_build_object('Content-Type', 'application/json'),
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

-- Trigger não muda (já criado em 20260502091000_dose_trigger_webhook.sql + audit B
-- em commit 3465ab6). Mantém WHEN clause filtrando status=pending + scheduledAt > now().
