-- v0.2.6.4 P3.2 (Roteiro) — audit_log append-only LGPD
-- Trilha de auditoria pra ações healthcare-critical + LGPD operations.
-- Triggers em RPCs healthcare (confirm_dose_v2, share_patient_by_email, etc).

CREATE TABLE IF NOT EXISTS medcontrol.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES medcontrol.patients(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    -- Doses state machine
    'dose_marked_done', 'dose_marked_skipped', 'dose_undone',
    'sos_registered', 'sos_forced_override',
    -- Sharing
    'patient_shared', 'patient_unshared', 'share_access_changed',
    'share_extended', 'share_expired',
    -- Treatments lifecycle
    'treatment_created', 'treatment_paused', 'treatment_resumed',
    'treatment_ended', 'treatment_alert_level_changed',
    -- LGPD obrigações legais
    'account_deleted', 'data_exported',
    -- Admin
    'feature_flag_changed',
    -- Sistema (cron)
    're_categorize_null_rows_cron', 'cmed_sync_run'
  )),
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_user_idx ON medcontrol.audit_log(user_id, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS audit_log_patient_idx ON medcontrol.audit_log(patient_id, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON medcontrol.audit_log(action, "createdAt" DESC);

ALTER TABLE medcontrol.audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: owner do user_id OU acesso ao patient_id OU admin
DROP POLICY IF EXISTS audit_log_select_owner_or_admin ON medcontrol.audit_log;
CREATE POLICY audit_log_select_owner_or_admin ON medcontrol.audit_log
  FOR SELECT TO authenticated
  USING (
    medcontrol.is_admin()
    OR user_id = auth.uid()
    OR (patient_id IS NOT NULL AND medcontrol.has_patient_access(patient_id))
  );

-- INSERT: somente via RPCs SECURITY DEFINER (sem policy INSERT pública).
-- audit_log NUNCA aceita INSERT/UPDATE/DELETE direto do client.

-- RPC helper pra inserir audit log (chamada por outras RPCs internas)
CREATE OR REPLACE FUNCTION medcontrol.write_audit_log(
  p_action TEXT,
  p_patient_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO medcontrol.audit_log (user_id, patient_id, action, metadata)
  VALUES (auth.uid(), p_patient_id, p_action, p_metadata);
EXCEPTION WHEN OTHERS THEN
  -- Audit log fail NUNCA deve quebrar a operação principal.
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

REVOKE ALL ON FUNCTION medcontrol.write_audit_log(TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION medcontrol.write_audit_log(TEXT, UUID, JSONB) TO authenticated;

-- Atualizar confirm_dose_v2 / skip_dose_v2 / undo_dose_v2 pra escrever audit
CREATE OR REPLACE FUNCTION medcontrol.confirm_dose_v2(
  p_dose_id      UUID,
  p_actual_time  TIMESTAMPTZ,
  p_observation  TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_current medcontrol.doses;
  v_updated medcontrol.doses;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized', 'code', 401);
  END IF;
  SELECT * INTO v_current FROM medcontrol.doses WHERE id = p_dose_id;
  IF v_current.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND', 'code', 404);
  END IF;
  IF NOT medcontrol.has_patient_access(v_current."patientId") THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'code', 403);
  END IF;
  IF v_current.status NOT IN ('pending', 'overdue') THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'INVALID_TRANSITION', 'code', 409,
      'from', v_current.status, 'to', 'done',
      'current_state', row_to_json(v_current)::jsonb
    );
  END IF;
  UPDATE medcontrol.doses
    SET status='done', "actualTime"=p_actual_time,
        observation = COALESCE(p_observation, observation),
        "updatedAt"=NOW()
    WHERE id = p_dose_id RETURNING * INTO v_updated;

  -- v0.2.6.4 P3.2 — audit log
  PERFORM medcontrol.write_audit_log('dose_marked_done', v_current."patientId",
    jsonb_build_object('dose_id', p_dose_id, 'med_name', v_current."medName", 'group_id', v_current.group_id)
  );

  RETURN jsonb_build_object('ok', true, 'dose', row_to_json(v_updated)::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.confirm_dose_v2(UUID, TIMESTAMPTZ, TEXT) TO authenticated;

-- Mesmo padrão pra skip_dose_v2 e undo_dose_v2
CREATE OR REPLACE FUNCTION medcontrol.skip_dose_v2(
  p_dose_id     UUID,
  p_observation TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_current medcontrol.doses;
  v_updated medcontrol.doses;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized', 'code', 401);
  END IF;
  SELECT * INTO v_current FROM medcontrol.doses WHERE id = p_dose_id;
  IF v_current.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND', 'code', 404);
  END IF;
  IF NOT medcontrol.has_patient_access(v_current."patientId") THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'code', 403);
  END IF;
  IF v_current.status NOT IN ('pending', 'overdue') THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'INVALID_TRANSITION', 'code', 409,
      'from', v_current.status, 'to', 'skipped',
      'current_state', row_to_json(v_current)::jsonb
    );
  END IF;
  UPDATE medcontrol.doses
    SET status='skipped',
        observation = COALESCE(p_observation, observation),
        "updatedAt"=NOW()
    WHERE id = p_dose_id RETURNING * INTO v_updated;

  PERFORM medcontrol.write_audit_log('dose_marked_skipped', v_current."patientId",
    jsonb_build_object('dose_id', p_dose_id, 'med_name', v_current."medName", 'group_id', v_current.group_id)
  );

  RETURN jsonb_build_object('ok', true, 'dose', row_to_json(v_updated)::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.skip_dose_v2(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION medcontrol.undo_dose_v2(p_dose_id UUID) RETURNS JSONB AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_current medcontrol.doses;
  v_updated medcontrol.doses;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized', 'code', 401);
  END IF;
  SELECT * INTO v_current FROM medcontrol.doses WHERE id = p_dose_id;
  IF v_current.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND', 'code', 404);
  END IF;
  IF NOT medcontrol.has_patient_access(v_current."patientId") THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'code', 403);
  END IF;
  IF v_current.status NOT IN ('done', 'skipped') THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'INVALID_TRANSITION', 'code', 409,
      'from', v_current.status, 'to', 'pending',
      'current_state', row_to_json(v_current)::jsonb
    );
  END IF;
  UPDATE medcontrol.doses
    SET status='pending', "actualTime"=NULL, observation=NULL,
        "updatedAt"=NOW()
    WHERE id = p_dose_id RETURNING * INTO v_updated;

  PERFORM medcontrol.write_audit_log('dose_undone', v_current."patientId",
    jsonb_build_object('dose_id', p_dose_id, 'med_name', v_current."medName", 'prev_status', v_current.status)
  );

  RETURN jsonb_build_object('ok', true, 'dose', row_to_json(v_updated)::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.undo_dose_v2(UUID) TO authenticated;

-- Retention policy (P8.5) — cron mensal
CREATE OR REPLACE FUNCTION medcontrol.cleanup_audit_log()
RETURNS INT AS $$
DECLARE v_deleted INT := 0;
BEGIN
  -- dose_* + sos_* → 2 anos
  WITH del AS (
    DELETE FROM medcontrol.audit_log
    WHERE action IN ('dose_marked_done', 'dose_marked_skipped', 'dose_undone', 'sos_registered', 'sos_forced_override')
      AND "createdAt" < NOW() - INTERVAL '2 years'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM del;

  -- treatment_* → 2 anos
  DELETE FROM medcontrol.audit_log
  WHERE action IN ('treatment_created', 'treatment_paused', 'treatment_resumed', 'treatment_ended', 'treatment_alert_level_changed')
    AND "createdAt" < NOW() - INTERVAL '2 years';

  -- share_* → 1 ano após patient_id NULL (paciente deletado)
  DELETE FROM medcontrol.audit_log
  WHERE action IN ('patient_shared', 'patient_unshared', 'share_access_changed', 'share_extended', 'share_expired')
    AND patient_id IS NULL
    AND "createdAt" < NOW() - INTERVAL '1 year';

  -- feature_flag_changed → 6 meses
  DELETE FROM medcontrol.audit_log
  WHERE action = 'feature_flag_changed'
    AND "createdAt" < NOW() - INTERVAL '6 months';

  -- cron actions → 90 dias
  DELETE FROM medcontrol.audit_log
  WHERE action IN ('re_categorize_null_rows_cron', 'cmed_sync_run')
    AND "createdAt" < NOW() - INTERVAL '90 days';

  -- account_deleted, data_exported → indefinido (LGPD obrigação legal)

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

REVOKE ALL ON FUNCTION medcontrol.cleanup_audit_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION medcontrol.cleanup_audit_log() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-audit-log-monthly';
SELECT cron.schedule(
  'cleanup-audit-log-monthly',
  '0 5 1 * *',
  $$SELECT medcontrol.cleanup_audit_log();$$
);
