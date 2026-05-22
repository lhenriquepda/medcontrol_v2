-- Refactor Fase 2 (Refactor_Full.md §4.4) — release v0.2.3.16.
-- Mata bug P1 "Snooze não persiste DB" do plugin Java CriticalAlarm.
--
-- Antes: AlarmActionReceiver.ACTION_SNOOZE re-agenda local via setAlarmClock
-- + persiste em SharedPreferences. Próximo rescheduleAll lê doses pending
-- no DB + re-agenda no horário original → snooze perdido.
--
-- Agora: ACTION_SNOOZE chama RPC snooze_dose que UPDATE doses.snoozed_until.
-- Cron/trigger/scheduler filtram doses com snoozed_until > NOW() — não
-- reagendam alarme nem mandam FCM até o snooze passar.
--
-- Aplicada em prod 2026-05-20 via Supabase MCP apply_migration.

ALTER TABLE medcontrol.doses
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ NULL;

COMMENT ON COLUMN medcontrol.doses.snoozed_until IS 'Timestamp futuro até quando dose está snoozed. NULL = sem snooze ativo. ACTION_SNOOZE chama snooze_dose RPC que seta este campo.';

CREATE INDEX IF NOT EXISTS idx_doses_snoozed_until
  ON medcontrol.doses (snoozed_until)
  WHERE snoozed_until IS NOT NULL;

CREATE OR REPLACE FUNCTION medcontrol.snooze_dose(
  p_dose_id uuid,
  p_minutes int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'medcontrol' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_dose medcontrol.doses%ROWTYPE;
  v_snooze_until TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

  IF p_minutes IS NULL OR p_minutes < 1 OR p_minutes > 360 THEN
    RAISE EXCEPTION 'p_minutes deve estar entre 1 e 360' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_dose FROM medcontrol.doses WHERE id = p_dose_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dose nao encontrada' USING ERRCODE = '02000';
  END IF;

  IF NOT medcontrol.has_patient_access(v_dose."patientId") THEN
    RAISE EXCEPTION 'sem permissao pra dose' USING ERRCODE = '42501';
  END IF;

  IF v_dose.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'dose status nao pode ser snoozed' USING ERRCODE = '22023';
  END IF;

  v_snooze_until := NOW() + (p_minutes || ' minutes')::INTERVAL;

  UPDATE medcontrol.doses
  SET snoozed_until = v_snooze_until,
      "updatedAt" = NOW()
  WHERE id = p_dose_id;

  RETURN jsonb_build_object(
    'id', p_dose_id,
    'snoozed_until', v_snooze_until,
    'minutes', p_minutes
  );
END
$$;

GRANT EXECUTE ON FUNCTION medcontrol.snooze_dose(uuid, int) TO authenticated;
