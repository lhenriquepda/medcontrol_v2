-- v0.2.2.0 — Alarm audit log feature
CREATE TABLE IF NOT EXISTS medcontrol.alarm_audit_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medcontrol.alarm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text,
  dose_id uuid,
  source text NOT NULL CHECK (source IN (
    'js_scheduler', 'java_alarm_scheduler', 'java_worker',
    'java_fcm_received', 'edge_daily_sync', 'edge_trigger_handler'
  )),
  action text NOT NULL CHECK (action IN (
    'scheduled', 'cancelled', 'fired_received', 'fcm_sent', 'skipped', 'batch_start', 'batch_end'
  )),
  scheduled_at timestamptz,
  patient_name text,
  med_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alarm_audit_log_user_created
  ON medcontrol.alarm_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alarm_audit_log_dose
  ON medcontrol.alarm_audit_log(dose_id) WHERE dose_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alarm_audit_log_source
  ON medcontrol.alarm_audit_log(source);

ALTER TABLE medcontrol.alarm_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE medcontrol.alarm_audit_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_admin_select ON medcontrol.alarm_audit_log;
CREATE POLICY audit_log_admin_select ON medcontrol.alarm_audit_log
  FOR SELECT USING (medcontrol.is_admin());

DROP POLICY IF EXISTS audit_config_admin_all ON medcontrol.alarm_audit_config;
CREATE POLICY audit_config_admin_all ON medcontrol.alarm_audit_config
  FOR ALL USING (medcontrol.is_admin()) WITH CHECK (medcontrol.is_admin());

DROP POLICY IF EXISTS audit_log_user_insert ON medcontrol.alarm_audit_log;
CREATE POLICY audit_log_user_insert ON medcontrol.alarm_audit_log
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM medcontrol.alarm_audit_config c
      WHERE c.user_id = auth.uid() AND c.enabled = true
    )
  );

CREATE OR REPLACE FUNCTION medcontrol.is_alarm_audit_enabled(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = medcontrol, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM medcontrol.alarm_audit_config
    WHERE user_id = COALESCE(p_user_id, auth.uid())
      AND enabled = true
  );
$$;
GRANT EXECUTE ON FUNCTION medcontrol.is_alarm_audit_enabled(uuid) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION medcontrol.admin_list_alarm_audit(
  p_user_id uuid DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_dose_id uuid DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid, user_id uuid, user_email text, device_id text, dose_id uuid,
  source text, action text, scheduled_at timestamptz,
  patient_name text, med_name text, metadata jsonb, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = medcontrol, public, auth
AS $$
BEGIN
  IF NOT medcontrol.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    l.id, l.user_id, u.email::text AS user_email, l.device_id, l.dose_id,
    l.source, l.action, l.scheduled_at,
    l.patient_name, l.med_name, l.metadata, l.created_at
  FROM medcontrol.alarm_audit_log l
  LEFT JOIN auth.users u ON u.id = l.user_id
  WHERE (p_user_id IS NULL OR l.user_id = p_user_id)
    AND (p_source IS NULL OR l.source = p_source)
    AND (p_action IS NULL OR l.action = p_action)
    AND (p_dose_id IS NULL OR l.dose_id = p_dose_id)
    AND (p_since IS NULL OR l.created_at >= p_since)
  ORDER BY l.created_at DESC
  LIMIT LEAST(p_limit, 1000);
END;
$$;
GRANT EXECUTE ON FUNCTION medcontrol.admin_list_alarm_audit(uuid, text, text, uuid, timestamptz, int) TO authenticated;

CREATE OR REPLACE FUNCTION medcontrol.admin_list_alarm_audit_config()
RETURNS TABLE (
  user_id uuid, email text, enabled boolean, notes text,
  created_at timestamptz, updated_at timestamptz, log_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = medcontrol, public, auth
AS $$
BEGIN
  IF NOT medcontrol.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    c.user_id, u.email::text, c.enabled, c.notes, c.created_at, c.updated_at,
    (SELECT COUNT(*) FROM medcontrol.alarm_audit_log l WHERE l.user_id = c.user_id) AS log_count
  FROM medcontrol.alarm_audit_config c
  LEFT JOIN auth.users u ON u.id = c.user_id
  ORDER BY u.email NULLS LAST;
END;
$$;
GRANT EXECUTE ON FUNCTION medcontrol.admin_list_alarm_audit_config() TO authenticated;

CREATE OR REPLACE FUNCTION medcontrol.admin_toggle_alarm_audit(
  p_email text, p_enabled boolean, p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = medcontrol, public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT medcontrol.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO medcontrol.alarm_audit_config (user_id, enabled, notes, created_by, updated_at)
  VALUES (v_user_id, p_enabled, p_notes, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        notes = COALESCE(EXCLUDED.notes, medcontrol.alarm_audit_config.notes),
        updated_at = now();
  RETURN v_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION medcontrol.admin_toggle_alarm_audit(text, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION medcontrol.cron_alarm_audit_cleanup()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = medcontrol, public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM medcontrol.alarm_audit_log
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

INSERT INTO medcontrol.alarm_audit_config (user_id, enabled, notes, created_by)
SELECT id, true, 'Owner debug — seed v0.2.2.0', id
FROM auth.users WHERE lower(email) = 'lhenrique.pda@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET enabled = true, updated_at = now();
