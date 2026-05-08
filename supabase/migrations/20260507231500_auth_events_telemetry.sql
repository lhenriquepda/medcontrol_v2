-- Item #201 (release v0.2.1.5) — telemetria auth events pro painel admin.
-- Permite ver padrões de login/logout por user, versão, device, kind.
-- Crítico pra debugar bugs de logout transient/spurious em produção.

CREATE TABLE IF NOT EXISTS medcontrol.auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'sign_in',
    'sign_out',
    'sign_out_spurious_ignored',
    'session_recovered',
    'token_refreshed'
  )),
  app_version text,
  app_build text,
  platform text CHECK (platform IN ('web', 'android', 'ios', 'unknown')),
  user_agent text,
  device_id text,
  logout_kind text,
  details jsonb,
  "createdAt" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_events_userId_idx ON medcontrol.auth_events ("userId");
CREATE INDEX IF NOT EXISTS auth_events_createdAt_idx ON medcontrol.auth_events ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS auth_events_event_type_idx ON medcontrol.auth_events (event_type);

ALTER TABLE medcontrol.auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_events_user_read_own ON medcontrol.auth_events
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid() OR medcontrol.is_admin());

CREATE OR REPLACE FUNCTION medcontrol.log_auth_event(
  p_event_type text,
  p_app_version text DEFAULT NULL,
  p_app_build text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_id text DEFAULT NULL,
  p_logout_kind text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, medcontrol, pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF p_event_type NOT IN ('sign_in', 'sign_out', 'sign_out_spurious_ignored', 'session_recovered', 'token_refreshed') THEN
    RAISE EXCEPTION 'INVALID_EVENT_TYPE: %', p_event_type;
  END IF;
  INSERT INTO medcontrol.auth_events (
    "userId", event_type, app_version, app_build,
    platform, user_agent, device_id, logout_kind, details
  )
  VALUES (
    v_user_id, p_event_type, p_app_version, p_app_build,
    p_platform, p_user_agent, p_device_id, p_logout_kind, p_details
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.log_auth_event(text, text, text, text, text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION medcontrol.admin_list_auth_events(
  p_user_id uuid DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  "userId" uuid,
  email text,
  event_type text,
  app_version text,
  app_build text,
  platform text,
  user_agent text,
  device_id text,
  logout_kind text,
  details jsonb,
  "createdAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, medcontrol, pg_catalog
AS $$
BEGIN
  IF NOT medcontrol.is_admin() THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: apenas admin';
  END IF;
  RETURN QUERY
  SELECT
    e.id, e."userId", u.email::text,
    e.event_type, e.app_version, e.app_build,
    e.platform, e.user_agent, e.device_id,
    e.logout_kind, e.details, e."createdAt"
  FROM medcontrol.auth_events e
  LEFT JOIN auth.users u ON u.id = e."userId"
  WHERE (p_user_id IS NULL OR e."userId" = p_user_id)
    AND (p_event_type IS NULL OR e.event_type = p_event_type)
    AND (p_app_version IS NULL OR e.app_version = p_app_version)
    AND (p_since IS NULL OR e."createdAt" >= p_since)
  ORDER BY e."createdAt" DESC
  LIMIT LEAST(p_limit, 1000);
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.admin_list_auth_events(uuid, text, text, timestamptz, int) TO authenticated;
