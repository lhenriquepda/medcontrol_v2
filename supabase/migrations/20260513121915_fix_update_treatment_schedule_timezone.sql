-- Item #209 v0.2.1.9 Bug 2 fix — TZ correction em update_treatment_schedule.
-- Antes: `date_trunc('day', startDate) + make_interval(hours => 8)` gerava
-- 08:00 UTC = 05:00 BRT. Compare create_treatment_with_doses (correto) que
-- usa AT TIME ZONE conversion. Esta RPC esqueceu o mesmo tratamento.

CREATE OR REPLACE FUNCTION medcontrol.update_treatment_schedule(
  p_treatment_id uuid,
  p_patch jsonb,
  p_timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'medcontrol', 'auth', 'extensions'
AS $function$
DECLARE
  v_uid              uuid := auth.uid();
  v_now              timestamptz := now();
  v_treatment        medcontrol.treatments%ROWTYPE;
  v_schedule_changed boolean;
  v_is_times_mode    boolean;
  v_daily_times      text[];
  v_effective_days   int;
  v_orig_end         timestamptz;
  v_remain_days      int;
  v_step_hours       int;
  v_h                int;
  v_m                int;
  v_first            timestamptz;
  v_t                int;
  v_dt               timestamptz;
  v_hhmm             text;
  v_d                int;
  v_start_local      timestamp;
BEGIN
  -- Load treatment and validate access
  SELECT * INTO v_treatment FROM medcontrol.treatments WHERE id = p_treatment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TREATMENT_NOT_FOUND';
  END IF;
  IF NOT medcontrol.has_patient_access(v_treatment."patientId") THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  -- Apply patch (only keys present in jsonb are updated)
  UPDATE medcontrol.treatments
  SET
    "intervalHours" = CASE WHEN p_patch ? 'intervalHours' THEN (p_patch->>'intervalHours')::int       ELSE "intervalHours" END,
    "durationDays"  = CASE WHEN p_patch ? 'durationDays'  THEN (p_patch->>'durationDays')::int         ELSE "durationDays"  END,
    "firstDoseTime" = CASE WHEN p_patch ? 'firstDoseTime' THEN  p_patch->>'firstDoseTime'              ELSE "firstDoseTime" END,
    "startDate"     = CASE WHEN p_patch ? 'startDate'     THEN (p_patch->>'startDate')::timestamptz    ELSE "startDate"     END,
    "isContinuous"  = CASE WHEN p_patch ? 'isContinuous'  THEN (p_patch->>'isContinuous')::boolean     ELSE "isContinuous"  END,
    "medName"       = CASE WHEN p_patch ? 'medName'       THEN  p_patch->>'medName'                    ELSE "medName"       END,
    unit            = CASE WHEN p_patch ? 'unit'          THEN  p_patch->>'unit'                       ELSE unit            END,
    status          = CASE WHEN p_patch ? 'status'        THEN  p_patch->>'status'                     ELSE status          END,
    "updatedAt"     = v_now
  WHERE id = p_treatment_id
  RETURNING * INTO v_treatment;

  -- Only regenerate doses when schedule keys changed
  v_schedule_changed :=
    (p_patch ? 'intervalHours') OR
    (p_patch ? 'durationDays')  OR
    (p_patch ? 'firstDoseTime') OR
    (p_patch ? 'startDate');

  IF v_schedule_changed THEN
    -- Remove only future pending/overdue doses (preserve done/skipped history)
    DELETE FROM medcontrol.doses
    WHERE "treatmentId" = p_treatment_id
      AND status IN ('pending', 'overdue')
      AND "scheduledAt" >= v_now;

    -- Detect mode from firstDoseTime format
    v_is_times_mode :=
      v_treatment."intervalHours" IS NULL AND
      v_treatment."firstDoseTime" IS NOT NULL AND
      left(v_treatment."firstDoseTime", 1) = '[';

    v_effective_days := CASE
      WHEN v_treatment."isContinuous" THEN 90
      ELSE LEAST(v_treatment."durationDays", 365)
    END;

    -- Item #209 fix: converter startDate pra local timezone ANTES truncate dia.
    -- date_trunc('day', timestamptz) retorna UTC midnight; precisamos local midnight.
    v_start_local := (v_treatment."startDate" AT TIME ZONE p_timezone)::timestamp;

    IF v_is_times_mode THEN
      -- Parse JSON daily times array
      SELECT array_agg(x ORDER BY x) INTO v_daily_times
      FROM jsonb_array_elements_text(v_treatment."firstDoseTime"::jsonb) AS x;

      -- Remaining days until original end date
      v_orig_end := v_treatment."startDate"::date + v_treatment."durationDays" * INTERVAL '1 day';
      v_remain_days := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_orig_end - v_now)) / 86400)::int);
      v_effective_days := v_remain_days;
      v_start_local := date_trunc('day', (v_now AT TIME ZONE p_timezone)::timestamp);

      FOR v_d IN 0..(v_effective_days - 1) LOOP
        FOREACH v_hhmm IN ARRAY v_daily_times LOOP
          v_h := split_part(v_hhmm, ':', 1)::int;
          v_m := split_part(v_hhmm, ':', 2)::int;
          -- Local time = v_start_local + v_d days + HH:MM, convertido pra UTC
          v_dt := ((date_trunc('day', v_start_local) + (v_d || ' days')::interval + make_interval(hours => v_h, mins => v_m)) AT TIME ZONE p_timezone);
          IF v_dt > v_now THEN
            INSERT INTO medcontrol.doses (
              "userId", "treatmentId", "patientId", "medName", unit,
              "scheduledAt", "actualTime", status, type, observation
            ) VALUES (
              v_uid, p_treatment_id, v_treatment."patientId", v_treatment."medName", v_treatment.unit,
              v_dt, NULL, 'pending', 'scheduled', ''
            );
          END IF;
        END LOOP;
      END LOOP;

    ELSE
      -- Interval mode: align next dose to original schedule rhythm
      v_step_hours := GREATEST(1, COALESCE(v_treatment."intervalHours", 8));
      v_h := split_part(COALESCE(v_treatment."firstDoseTime", '08:00'), ':', 1)::int;
      v_m := split_part(COALESCE(v_treatment."firstDoseTime", '08:00'), ':', 2)::int;

      -- Item #209 fix: calcular firstDose em local TZ + converter pra UTC
      v_first := (date_trunc('day', v_start_local) + make_interval(hours => v_h, mins => v_m)) AT TIME ZONE p_timezone;

      -- Advance to first slot strictly after now, maintaining original rhythm
      WHILE v_first <= v_now LOOP
        v_first := v_first + make_interval(hours => v_step_hours);
      END LOOP;

      -- Generate doses from v_first for v_effective_days
      v_t := 0;
      WHILE v_t < (v_effective_days * 24) LOOP
        v_dt := v_first + make_interval(hours => v_t);
        INSERT INTO medcontrol.doses (
          "userId", "treatmentId", "patientId", "medName", unit,
          "scheduledAt", "actualTime", status, type, observation
        ) VALUES (
          v_uid, p_treatment_id, v_treatment."patientId", v_treatment."medName", v_treatment.unit,
          v_dt, NULL, 'pending', 'scheduled', ''
        );
        v_t := v_t + v_step_hours;
      END LOOP;
    END IF;
  END IF;

  RETURN to_jsonb(v_treatment);
END;
$function$;
