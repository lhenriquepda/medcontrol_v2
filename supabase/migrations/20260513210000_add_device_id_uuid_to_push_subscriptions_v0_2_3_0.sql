-- #226 v0.2.3.0 — Padroniza device_id UUID cross-source em alarm_audit_log.
-- Antes: JS gravava UUID estável; Java gravava "MODEL (MANUFACTURER)" não-único;
-- Edge gravava deviceToken.slice(-12). 3 semânticas distintas dificultavam análise.
-- Solução: device_id_uuid persistido em push_subscriptions (gerado client-side via
-- CriticalAlarmPlugin.getDeviceId). Java AlarmAuditLogger lê do SharedPreferences;
-- Edge lê via push_subscriptions JOIN. Todos os sources gravam mesmo UUID.

-- 1) Adiciona coluna nullable
ALTER TABLE medcontrol.push_subscriptions
  ADD COLUMN IF NOT EXISTS device_id_uuid text;

COMMENT ON COLUMN medcontrol.push_subscriptions.device_id_uuid IS
'#226 v0.2.3.0 — UUID estável device (gerado client-side via CriticalAlarmPlugin.getDeviceId, persiste em SharedPreferences). Cross-source consistency em alarm_audit_log.device_id.';

-- 2) Backfill — gera UUID v4 pra rows existentes (devices vão re-upsert pós-update)
UPDATE medcontrol.push_subscriptions
SET device_id_uuid = gen_random_uuid()::text
WHERE device_id_uuid IS NULL;

-- 3) Estende RPC upsert_push_subscription pra aceitar p_device_id_uuid opcional.
CREATE OR REPLACE FUNCTION medcontrol.upsert_push_subscription(
  p_device_token text,
  p_platform text DEFAULT 'android',
  p_advance_mins int DEFAULT 0,
  p_user_agent text DEFAULT NULL,
  p_device_id_uuid text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_resolved_uuid text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  v_resolved_uuid := COALESCE(p_device_id_uuid, gen_random_uuid()::text);

  SELECT id INTO v_id FROM medcontrol.push_subscriptions
  WHERE "deviceToken" = p_device_token LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE medcontrol.push_subscriptions
    SET "userId" = v_user_id,
        platform = p_platform,
        "advanceMins" = p_advance_mins,
        "userAgent" = p_user_agent,
        device_id_uuid = COALESCE(device_id_uuid, v_resolved_uuid)
    WHERE id = v_id;
  ELSE
    INSERT INTO medcontrol.push_subscriptions (
      "userId", "deviceToken", platform, "advanceMins", "userAgent",
      device_id_uuid, "createdAt"
    ) VALUES (
      v_user_id, p_device_token, p_platform, p_advance_mins, p_user_agent,
      v_resolved_uuid, now()
    ) RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.upsert_push_subscription(text, text, int, text, text) TO authenticated;

DROP FUNCTION IF EXISTS medcontrol.upsert_push_subscription(text, text, int, text);
