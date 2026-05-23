-- =====================================================================
-- v0.2.6.1 Fase B (Roteiro_Alinhamento_Dosy_v2)
--   P1.6  — RPCs healthcare retornam JSONB com {ok, dose, error, code, current_state}
--           via novos wrappers _v2 (mantém v1 backward-compat).
--   P3.4  — medcontrol.treatment_user_alert_settings (per-user-per-treatment)
--   P3.15 — patient_shares colunas TTL granular: access_level + is_temporary
--           + invited_at + accepted_at + last_extended_at + 1h/24h notify columns.
-- Aplicada em prod 2026-05-23 via Supabase MCP apply_migration. Versão replay aqui.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- P3.4 — treatment_user_alert_settings
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medcontrol.treatment_user_alert_settings (
  treatment_id UUID NOT NULL REFERENCES medcontrol.treatments(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_level  TEXT NOT NULL CHECK (alert_level IN ('critical', 'push', 'silent')),
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (treatment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_treatment_user_alert_settings_user
  ON medcontrol.treatment_user_alert_settings(user_id);

ALTER TABLE medcontrol.treatment_user_alert_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alert_settings_self ON medcontrol.treatment_user_alert_settings;
CREATE POLICY alert_settings_self ON medcontrol.treatment_user_alert_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION medcontrol.set_treatment_alert_level(
  p_treatment_id UUID,
  p_alert_level  TEXT
) RETURNS JSONB AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_patient_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized', 'code', 401);
  END IF;
  IF p_alert_level NOT IN ('critical','push','silent') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_alert_level', 'code', 400);
  END IF;
  SELECT "patientId" INTO v_patient_id FROM medcontrol.treatments WHERE id = p_treatment_id;
  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'treatment_not_found', 'code', 404);
  END IF;
  IF NOT medcontrol.has_patient_access(v_patient_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'code', 403);
  END IF;

  INSERT INTO medcontrol.treatment_user_alert_settings (treatment_id, user_id, alert_level)
  VALUES (p_treatment_id, v_uid, p_alert_level)
  ON CONFLICT (treatment_id, user_id) DO UPDATE
    SET alert_level = EXCLUDED.alert_level,
        "updatedAt" = NOW();

  RETURN jsonb_build_object('ok', true, 'treatment_id', p_treatment_id, 'alert_level', p_alert_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

REVOKE ALL ON FUNCTION medcontrol.set_treatment_alert_level(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION medcontrol.set_treatment_alert_level(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION medcontrol.get_treatment_alert_levels()
RETURNS TABLE (treatment_id UUID, alert_level TEXT) AS $$
  SELECT t.treatment_id, t.alert_level
  FROM medcontrol.treatment_user_alert_settings t
  WHERE t.user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.get_treatment_alert_levels() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- P3.15 — patient_shares TTL granular
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE medcontrol.patient_shares
  ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'full'
    CHECK (access_level IN ('read','mark','full')),
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_extended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS one_hour_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS twenty_four_hour_notified_at TIMESTAMPTZ;

UPDATE medcontrol.patient_shares
  SET invited_at = COALESCE(invited_at, "createdAt")
  WHERE invited_at IS NULL;

UPDATE medcontrol.patient_shares
  SET is_temporary = true
  WHERE "expiresAt" IS NOT NULL AND is_temporary = false;

ALTER TABLE medcontrol.patient_shares
  DROP CONSTRAINT IF EXISTS chk_patient_shares_ttl_consistency;
ALTER TABLE medcontrol.patient_shares
  ADD CONSTRAINT chk_patient_shares_ttl_consistency CHECK (
    (is_temporary = false) OR
    (is_temporary = true AND "expiresAt" IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_patient_shares_expires_at
  ON medcontrol.patient_shares("expiresAt") WHERE is_temporary = true;

CREATE OR REPLACE FUNCTION medcontrol.share_patient_by_email(
  p_patient_id  UUID,
  p_email       TEXT,
  p_expires_at  TIMESTAMPTZ DEFAULT NULL,
  p_access_level TEXT DEFAULT 'full'
) RETURNS medcontrol.patient_shares AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_target_uid  UUID;
  v_share       medcontrol.patient_shares;
  v_is_temp     BOOLEAN := (p_expires_at IS NOT NULL);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_access_level NOT IN ('read','mark','full') THEN
    RAISE EXCEPTION 'invalid_access_level: %', p_access_level;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM medcontrol.patients
    WHERE id = p_patient_id AND "userId" = v_uid
  ) THEN
    RAISE EXCEPTION 'forbidden: not patient owner';
  END IF;

  SELECT id INTO v_target_uid FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_target_uid IS NULL THEN
    RAISE EXCEPTION 'user_not_found: %', p_email;
  END IF;
  IF v_target_uid = v_uid THEN
    RAISE EXCEPTION 'cannot_share_with_self';
  END IF;

  IF v_is_temp AND p_expires_at <= NOW() THEN
    RAISE EXCEPTION 'invalid_expires_at: must be in future';
  END IF;

  INSERT INTO medcontrol.patient_shares (
    "patientId", "ownerId", "sharedWithUserId",
    "expiresAt", is_temporary, access_level, invited_at
  )
  VALUES (
    p_patient_id, v_uid, v_target_uid,
    p_expires_at, v_is_temp, p_access_level, NOW()
  )
  ON CONFLICT ("patientId", "sharedWithUserId") DO UPDATE
    SET "expiresAt"       = EXCLUDED."expiresAt",
        is_temporary      = EXCLUDED.is_temporary,
        access_level      = EXCLUDED.access_level,
        last_extended_at  = NOW()
  RETURNING * INTO v_share;

  RETURN v_share;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public, auth;

GRANT EXECUTE ON FUNCTION medcontrol.share_patient_by_email(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION medcontrol.extend_temporary_share(
  p_share_id     UUID,
  p_new_expires_at TIMESTAMPTZ
) RETURNS medcontrol.patient_shares AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_share  medcontrol.patient_shares;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_new_expires_at <= NOW() THEN
    RAISE EXCEPTION 'invalid_expires_at: must be in future';
  END IF;
  UPDATE medcontrol.patient_shares
    SET "expiresAt"            = p_new_expires_at,
        last_extended_at       = NOW(),
        one_hour_notified_at   = NULL,
        twenty_four_hour_notified_at = NULL
    WHERE id = p_share_id
      AND "ownerId" = v_uid
      AND is_temporary = true
    RETURNING * INTO v_share;
  IF v_share.id IS NULL THEN
    RAISE EXCEPTION 'share_not_found_or_forbidden';
  END IF;
  RETURN v_share;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.extend_temporary_share(UUID, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION medcontrol.update_share_access(
  p_share_id      UUID,
  p_access_level  TEXT
) RETURNS medcontrol.patient_shares AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_share  medcontrol.patient_shares;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_access_level NOT IN ('read','mark','full') THEN
    RAISE EXCEPTION 'invalid_access_level: %', p_access_level;
  END IF;
  UPDATE medcontrol.patient_shares
    SET access_level = p_access_level
    WHERE id = p_share_id
      AND "ownerId" = v_uid
    RETURNING * INTO v_share;
  IF v_share.id IS NULL THEN
    RAISE EXCEPTION 'share_not_found_or_forbidden';
  END IF;
  RETURN v_share;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.update_share_access(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION medcontrol.cleanup_expired_shares()
RETURNS INT AS $$
DECLARE
  v_deleted INT;
BEGIN
  WITH del AS (
    DELETE FROM medcontrol.patient_shares
    WHERE is_temporary = true
      AND "expiresAt" IS NOT NULL
      AND "expiresAt" <= NOW()
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM del;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

REVOKE ALL ON FUNCTION medcontrol.cleanup_expired_shares() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION medcontrol.cleanup_expired_shares() TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- P1.6 — RPCs dose _v2 (retornam JSONB com 409 + current_state)
-- ─────────────────────────────────────────────────────────────────────
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
  RETURN jsonb_build_object('ok', true, 'dose', row_to_json(v_updated)::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.confirm_dose_v2(UUID, TIMESTAMPTZ, TEXT) TO authenticated;

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
  RETURN jsonb_build_object('ok', true, 'dose', row_to_json(v_updated)::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.undo_dose_v2(UUID) TO authenticated;
