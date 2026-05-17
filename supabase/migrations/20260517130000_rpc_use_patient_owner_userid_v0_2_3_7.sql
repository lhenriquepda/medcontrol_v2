-- Bug P1 fix v0.2.3.7 #283 — RPCs salvam treatment/dose com userId = paciente
-- owner real, NÃO auth.uid() do caller. Garante que cuidador criando dose pra
-- paciente compartilhado gera registro pertencente ao owner real → trigger DB
-- dispara dose-trigger-handler com record.userId=owner → Edge busca shares OK →
-- FCM dispatched correctamente pra ambos (owner + cuidador via patient_shares).
--
-- Antes: caller=cuidador → dose.userId=cuidador → Edge trata cuidador como
-- ownerId → busca shares onde ownerId=cuidador → vazio (cuidador não é dono) →
-- apenas cuidador recebe FCM, owner real fica órfão de push.
--
-- 2 RPCs corrigidos:
--   1. create_treatment_with_doses
--   2. register_sos_dose

CREATE OR REPLACE FUNCTION medcontrol.create_treatment_with_doses(p_patient_id uuid, p_med_name text, p_unit text, p_interval_hours integer, p_duration_days integer, p_is_continuous boolean, p_start_date timestamp with time zone, p_first_dose_time text, p_mode text, p_is_template boolean DEFAULT false, p_timezone text DEFAULT 'America/Sao_Paulo'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'medcontrol', 'public'
AS $function$
DECLARE
  v_caller_uid       uuid := auth.uid();
  v_patient_owner    uuid;
  v_uid              uuid;
  v_treatment        medcontrol.treatments%ROWTYPE;
  v_treatment_id     uuid;
  v_effective_days   int;
  v_start_local      timestamp;
  v_first            timestamptz;
  v_step_hours       int;
  v_total_doses      int;
  v_t                int;
  v_i                int;
  v_dt               timestamptz;
  v_h                int;
  v_m                int;
  v_times            text[];
  v_hhmm             text;
  v_d                int;
  v_horizon          timestamptz;
  v_now              timestamptz := NOW();
BEGIN
  IF NOT medcontrol.has_patient_access(p_patient_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT "userId" INTO v_patient_owner FROM medcontrol.patients WHERE id = p_patient_id;
  IF v_patient_owner IS NULL THEN
    RAISE EXCEPTION 'PACIENTE_NAO_ENCONTRADO';
  END IF;
  v_uid := v_patient_owner;

  v_effective_days := CASE
    WHEN COALESCE(p_is_continuous, false) THEN 90
    ELSE LEAST(COALESCE(p_duration_days, 7), 365)
  END;

  v_start_local := (p_start_date AT TIME ZONE p_timezone)::timestamp;
  v_horizon := (date_trunc('day', v_start_local) + (v_effective_days || ' days')::interval) AT TIME ZONE p_timezone;

  INSERT INTO medcontrol.treatments (
    "userId", "patientId", "medName", unit,
    "intervalHours", "durationDays", "isContinuous",
    "startDate", "firstDoseTime", status, "isTemplate", "doseHorizon"
  )
  VALUES (
    v_uid, p_patient_id, p_med_name, p_unit,
    p_interval_hours,
    CASE WHEN COALESCE(p_is_continuous, false) THEN COALESCE(p_duration_days, 90) ELSE COALESCE(p_duration_days, 7) END,
    COALESCE(p_is_continuous, false),
    p_start_date, p_first_dose_time, 'active',
    COALESCE(p_is_template, false),
    v_horizon
  )
  RETURNING * INTO v_treatment;

  v_treatment_id := v_treatment.id;

  IF p_mode = 'times' THEN
    SELECT array_agg(x ORDER BY x) INTO v_times
    FROM jsonb_array_elements_text(p_first_dose_time::jsonb) AS x;

    FOR v_d IN 0..(v_effective_days - 1) LOOP
      FOREACH v_hhmm IN ARRAY v_times LOOP
        v_h := split_part(v_hhmm, ':', 1)::int;
        v_m := split_part(v_hhmm, ':', 2)::int;
        v_dt := ((date_trunc('day', v_start_local) + (v_d || ' days')::interval
                 + make_interval(hours => v_h, mins => v_m)) AT TIME ZONE p_timezone);
        INSERT INTO medcontrol.doses (
          "userId", "treatmentId", "patientId", "medName", unit,
          "scheduledAt", "actualTime", status, type, observation
        ) VALUES (
          v_uid, v_treatment_id, p_patient_id, p_med_name, p_unit,
          v_dt, NULL, 'pending', 'scheduled', ''
        );
      END LOOP;
    END LOOP;
  ELSE
    v_step_hours := GREATEST(1, COALESCE(p_interval_hours, 8));
    v_h := split_part(COALESCE(p_first_dose_time, '08:00'), ':', 1)::int;
    v_m := split_part(COALESCE(p_first_dose_time, '08:00'), ':', 2)::int;
    v_first := (date_trunc('day', v_start_local) + make_interval(hours => v_h, mins => v_m)) AT TIME ZONE p_timezone;
    v_total_doses := CEIL((v_effective_days * 24.0) / v_step_hours)::int;
    v_t := 0;
    FOR v_i IN 0..(v_total_doses - 1) LOOP
      v_dt := v_first + make_interval(hours => v_i * v_step_hours);
      INSERT INTO medcontrol.doses (
        "userId", "treatmentId", "patientId", "medName", unit,
        "scheduledAt", "actualTime", status, type, observation
      ) VALUES (
        v_uid, v_treatment_id, p_patient_id, p_med_name, p_unit,
        v_dt, NULL, 'pending', 'scheduled', ''
      );
    END LOOP;
  END IF;

  RETURN to_jsonb(v_treatment);
END;
$function$;

CREATE OR REPLACE FUNCTION medcontrol.register_sos_dose(p_patient_id uuid, p_med_name text, p_unit text, p_scheduled_at timestamp with time zone DEFAULT now(), p_observation text DEFAULT ''::text)
RETURNS medcontrol.doses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'medcontrol', 'public'
AS $function$
DECLARE
  v_rule          medcontrol.sos_rules%ROWTYPE;
  v_last_actual   timestamptz;
  v_count_24h     int;
  v_diff_hours    float;
  v_new_dose      medcontrol.doses%ROWTYPE;
  v_patient_owner uuid;
BEGIN
  IF NOT medcontrol.has_patient_access(p_patient_id) THEN
    RAISE EXCEPTION 'PACIENTE_NAO_AUTORIZADO';
  END IF;
  SELECT "userId" INTO v_patient_owner FROM medcontrol.patients WHERE id = p_patient_id;
  IF v_patient_owner IS NULL THEN
    RAISE EXCEPTION 'PACIENTE_NAO_ENCONTRADO';
  END IF;

  SELECT * INTO v_rule
  FROM medcontrol.sos_rules
  WHERE "patientId" = p_patient_id AND lower("medName") = lower(p_med_name)
  LIMIT 1;
  IF FOUND THEN
    IF v_rule."minIntervalHours" IS NOT NULL THEN
      SELECT MAX(COALESCE("actualTime", "scheduledAt")) INTO v_last_actual
      FROM medcontrol.doses
      WHERE "patientId" = p_patient_id AND lower("medName") = lower(p_med_name) AND status = 'done';
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
      WHERE "patientId" = p_patient_id AND lower("medName") = lower(p_med_name)
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
    (v_patient_owner, p_patient_id, p_med_name, p_unit, p_scheduled_at, p_scheduled_at,
     'done', 'sos', COALESCE(p_observation, ''), NULL)
  RETURNING * INTO v_new_dose;
  RETURN v_new_dose;
END;
$function$;
