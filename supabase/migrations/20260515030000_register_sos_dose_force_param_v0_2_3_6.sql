-- Bug user-reported: SOS submit "trava silencioso". Root cause TRIPLO:
-- 1) window.confirm bug Capacitor WebView (fix em SOS.jsx ConfirmDialog)
-- 2) ConfirmDialog onConfirm+onClose race toast (fix em SOS.jsx)
-- 3) **AQUI**: RPC ainda validava server-side e rejeitava INTERVALO_MINIMO mesmo
--    quando user clicou "Registrar mesmo assim" no ConfirmDialog.
--
-- Política v0.2.3.5 #238: app NÃO bloqueia, apenas ALERTA. User decide.
-- Mas RPC backend ainda tinha validação dura. Fix: param `p_force`. Quando
-- true, pula validação interval/24h (user já confirmou alerta cliente-side).

CREATE OR REPLACE FUNCTION medcontrol.register_sos_dose(
  p_patient_id uuid,
  p_med_name text,
  p_unit text,
  p_scheduled_at timestamptz DEFAULT now(),
  p_observation text DEFAULT '',
  p_force boolean DEFAULT false
)
RETURNS medcontrol.doses
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'medcontrol', 'public' AS $$
DECLARE
  v_rule         medcontrol.sos_rules%ROWTYPE;
  v_last_actual  timestamptz;
  v_count_24h    int;
  v_diff_hours   float;
  v_new_dose     medcontrol.doses%ROWTYPE;
BEGIN
  IF NOT medcontrol.has_patient_access(p_patient_id) THEN
    RAISE EXCEPTION 'PACIENTE_NAO_AUTORIZADO';
  END IF;

  SELECT * INTO v_rule
  FROM medcontrol.sos_rules
  WHERE "patientId" = p_patient_id
    AND lower("medName") = lower(p_med_name)
  LIMIT 1;

  -- v0.2.3.6: validações over-limit puláveis via p_force (user já alertado cliente-side)
  IF FOUND AND NOT p_force THEN
    IF v_rule."minIntervalHours" IS NOT NULL THEN
      SELECT MAX(COALESCE("actualTime", "scheduledAt")) INTO v_last_actual
      FROM medcontrol.doses
      WHERE "patientId" = p_patient_id
        AND lower("medName") = lower(p_med_name)
        AND status = 'done';

      IF v_last_actual IS NOT NULL THEN
        v_diff_hours := EXTRACT(EPOCH FROM (p_scheduled_at - v_last_actual)) / 3600.0;
        IF v_diff_hours < v_rule."minIntervalHours" THEN
          RAISE EXCEPTION 'INTERVALO_MINIMO_NAO_RESPEITADO: minimo %h, ultima dose ha %.1fh',
            v_rule."minIntervalHours", v_diff_hours;
        END IF;
      END IF;
    END IF;

    IF v_rule."maxDosesIn24h" IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count_24h
      FROM medcontrol.doses
      WHERE "patientId" = p_patient_id
        AND lower("medName") = lower(p_med_name)
        AND status = 'done'
        AND COALESCE("actualTime", "scheduledAt") >= (p_scheduled_at - INTERVAL '24 hours');

      IF v_count_24h >= v_rule."maxDosesIn24h" THEN
        RAISE EXCEPTION 'LIMITE_24H_ATINGIDO: maximo % doses em 24h, ja foram %',
          v_rule."maxDosesIn24h", v_count_24h;
      END IF;
    END IF;
  END IF;

  PERFORM set_config('medcontrol.via_register_sos_dose', 'true', true);
  INSERT INTO medcontrol.doses
    ("userId", "patientId", "medName", unit, "scheduledAt", "actualTime",
     status, type, observation, "treatmentId")
  VALUES
    (auth.uid(), p_patient_id, p_med_name, p_unit, p_scheduled_at, p_scheduled_at,
     'done', 'sos', COALESCE(p_observation, ''), NULL)
  RETURNING * INTO v_new_dose;

  RETURN v_new_dose;
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.register_sos_dose(uuid, text, text, timestamptz, text, boolean) TO anon, authenticated;
