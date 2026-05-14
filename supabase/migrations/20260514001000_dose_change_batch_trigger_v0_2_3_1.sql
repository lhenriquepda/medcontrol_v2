-- v0.2.3.1 Bloco 5 (Fix C + A-02) — batch trigger pra UPDATE/DELETE em doses.
--
-- Problema (A-02):
--   pauseTreatment/endTreatment fazem DELETE/UPDATE em batch (90d × 4 doses = 360 rows).
--   Trigger AFTER ... FOR EACH ROW fires N vezes → N HTTP POSTs Edge dose-trigger-handler.
--   FCM rate limit ~1 msg/sec/device pode dropar mensagens. Hash de single doseId
--   nao bate hash do grupo (RC-3) — multi-dose groups cancel miss.
--
-- Fix:
--   1. Trigger AFTER UPDATE OR DELETE FOR EACH STATEMENT agrega doseIds afetados.
--   2. Envia 1 HTTP POST Edge com payload CSV de doseIds.
--   3. Edge envia 1 FCM por device com action=cancel_alarms + doseIds=CSV.
--   4. DosyMessagingService.handleCancelAlarms reconstrói hash do grupo
--      (sortedDoseIds.join('|')) — cobre multi-dose groups.
--
--   Trigger AFTER INSERT FOR EACH ROW mantido (INSERT geralmente single dose
--   via createTreatmentWithDoses RPC que tambem trata batch internamente).

-- Function batch UPDATE/DELETE
CREATE OR REPLACE FUNCTION medcontrol.notify_doses_batch_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, pg_temp
AS $$
DECLARE
  edge_url text := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/dose-trigger-handler';
  affected_rows jsonb;
  old_rows_json jsonb;
  payload jsonb;
BEGIN
  -- Coleta old_rows (status='pending' que viraram non-pending OU foram deletados)
  IF TG_OP = 'DELETE' THEN
    SELECT jsonb_agg(to_jsonb(r))
      INTO old_rows_json
      FROM old_doses r
      WHERE r.status = 'pending';
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT jsonb_agg(to_jsonb(o))
      INTO old_rows_json
      FROM old_doses o
      JOIN new_doses n ON n.id = o.id
      WHERE o.status = 'pending' AND n.status IS DISTINCT FROM 'pending';
  END IF;

  IF old_rows_json IS NULL OR jsonb_array_length(old_rows_json) = 0 THEN
    RETURN NULL;
  END IF;

  payload := jsonb_build_object(
    'type', 'BATCH_' || TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'old_rows', old_rows_json
  );

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload,
    timeout_milliseconds := 5000
  );

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_doses_batch_change] http_post failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- DROP old per-row trigger pra UPDATE/DELETE (mantém INSERT per-row)
DROP TRIGGER IF EXISTS dose_change_notify ON medcontrol.doses;

-- Trigger INSERT FOR EACH ROW (unchanged behavior)
CREATE TRIGGER dose_change_notify_insert
  AFTER INSERT
  ON medcontrol.doses
  FOR EACH ROW
  EXECUTE FUNCTION medcontrol.notify_dose_change();

-- Trigger UPDATE batch (FOR EACH STATEMENT + transition tables)
CREATE TRIGGER dose_change_notify_update_batch
  AFTER UPDATE
  ON medcontrol.doses
  REFERENCING OLD TABLE AS old_doses NEW TABLE AS new_doses
  FOR EACH STATEMENT
  EXECUTE FUNCTION medcontrol.notify_doses_batch_change();

-- Trigger DELETE batch
CREATE TRIGGER dose_change_notify_delete_batch
  AFTER DELETE
  ON medcontrol.doses
  REFERENCING OLD TABLE AS old_doses
  FOR EACH STATEMENT
  EXECUTE FUNCTION medcontrol.notify_doses_batch_change();

COMMENT ON FUNCTION medcontrol.notify_doses_batch_change() IS
  'v0.2.3.1 Fix C + A-02 — batch trigger pra UPDATE/DELETE. Agrega doseIds afetados, envia 1 HTTP POST com array.';
