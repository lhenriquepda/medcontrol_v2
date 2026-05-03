-- Item #091 BUG-024 (release v0.1.7.4) — fix TZ bug em
-- medcontrol.extend_continuous_treatments(p_user_id, p_days_ahead).
--
-- Bug reportado user 2026-05-02: tratamento Cortisol cadastrado 27/04 com
-- firstDoseTime=["08:00","12:00"] BRT. Doses iniciais (criadas pelo
-- create_treatment_with_doses cliente) salvas como 11:00+15:00 UTC = 8h+12h
-- BRT ✅. Mas doses futuras (geradas pelo pg_cron daily 04:00 UTC chamando
-- extend_all_active_continuous → extend_continuous_treatments(uid)) salvas
-- como 08:00+12:00 UTC = 5h+9h BRT ❌.
--
-- Causa raiz: linha original
--   v_dt := date_trunc('day', t."startDate") + (v_d || ' days')::interval
--           + make_interval(hours => v_h, mins => v_m);
-- date_trunc('day', timestamptz) retorna timestamptz às 00:00 UTC.
-- Adicionar hours em UTC raw produz horário UTC, não local SP.
--
-- Fix: combinar date+time em America/Sao_Paulo, depois converter pra UTC.
--   (((startDate AT TIME ZONE 'America/Sao_Paulo')::date + d_offset)
--    + make_time(h, m, 0)) AT TIME ZONE 'America/Sao_Paulo'
--
-- Mesma fix aplicada no else branch (firstDoseTime único + intervalHours).
--
-- Treatments afetados na produção (3 do user lhenrique.pda):
--   5c0789ab Triiodotironina ["08:00","16:00"]
--   7f5a567d Cortisol         ["08:00","12:00"]
--   716a8bd4 Citrato Magnésio ["08:00","12:00","16:00","20:00"]
--
-- Cleanup aplicado manual em 2026-05-02 23:52 UTC:
--   1. DELETE doses pending futuras dos 3 treatments afetados
--   2. UPDATE doseHorizon = NULL nos 3 treatments
--   3. SELECT extend_continuous_treatments(uid, 10) regerou doses corretas
-- Validado: doses 03/05 agora 11/15 UTC = 8/12 BRT ✅.

CREATE OR REPLACE FUNCTION medcontrol.extend_continuous_treatments(p_user_id uuid DEFAULT NULL, p_days_ahead int DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, pg_temp
AS $func$
DECLARE
  v_target_uid uuid;
  v_target_horizon timestamptz := date_trunc('day', NOW()) + ((p_days_ahead + 1) || ' days')::interval;
  v_extended int := 0; v_doses_added int := 0; t RECORD;
  v_max_scheduled timestamptz; v_first_dose timestamptz;
  v_step_hours int; v_h int; v_m int; v_times text[]; v_hhmm text;
  v_dt timestamptz; v_d int; v_local_added int;
  v_caller_uid uuid := auth.uid();
  v_is_trusted boolean := current_user IN ('postgres', 'supabase_admin');
  v_tz constant text := 'America/Sao_Paulo';
BEGIN
  IF v_is_trusted THEN v_target_uid := p_user_id;
  ELSIF p_user_id IS NULL THEN v_target_uid := v_caller_uid;
  ELSIF medcontrol.is_admin() OR p_user_id = v_caller_uid THEN v_target_uid := p_user_id;
  ELSE RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF v_target_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  FOR t IN SELECT * FROM medcontrol.treatments
    WHERE "userId" = v_target_uid AND "isContinuous" = true AND status = 'active'
      AND COALESCE("doseHorizon", "startDate") < v_target_horizon
  LOOP
    v_local_added := 0;
    SELECT MAX("scheduledAt") INTO v_max_scheduled FROM medcontrol.doses WHERE "treatmentId" = t.id;
    v_times := NULL;
    BEGIN
      IF t."firstDoseTime" IS NOT NULL AND substr(trim(t."firstDoseTime"), 1, 1) = '[' THEN
        SELECT array_agg(x ORDER BY x) INTO v_times FROM jsonb_array_elements_text(t."firstDoseTime"::jsonb) AS x;
      END IF;
    EXCEPTION WHEN OTHERS THEN v_times := NULL; END;

    IF v_times IS NOT NULL AND array_length(v_times, 1) > 0 THEN
      v_d := 0;
      WHILE ((((t."startDate" AT TIME ZONE v_tz)::date + v_d) + time '00:00') AT TIME ZONE v_tz) < v_target_horizon LOOP
        FOREACH v_hhmm IN ARRAY v_times LOOP
          v_h := split_part(v_hhmm, ':', 1)::int;
          v_m := split_part(v_hhmm, ':', 2)::int;
          -- FIX TZ: combina date+time em America/Sao_Paulo, converte pra UTC
          v_dt := ((((t."startDate" AT TIME ZONE v_tz)::date + v_d) + make_time(v_h, v_m, 0)) AT TIME ZONE v_tz);
          IF v_dt > COALESCE(v_max_scheduled, t."startDate" - INTERVAL '1 second') AND v_dt <= v_target_horizon THEN
            INSERT INTO medcontrol.doses ("userId", "treatmentId", "patientId", "medName", unit, "scheduledAt", "actualTime", status, type, observation)
            VALUES (t."userId", t.id, t."patientId", t."medName", t.unit, v_dt, NULL, 'pending', 'scheduled', '');
            v_local_added := v_local_added + 1;
          END IF;
        END LOOP;
        v_d := v_d + 1;
      END LOOP;
    ELSE
      v_h := split_part(COALESCE(t."firstDoseTime", '08:00'), ':', 1)::int;
      v_m := split_part(COALESCE(t."firstDoseTime", '08:00'), ':', 2)::int;
      -- FIX TZ: mesma técnica branch firstDoseTime único
      v_first_dose := ((((t."startDate" AT TIME ZONE v_tz)::date) + make_time(v_h, v_m, 0)) AT TIME ZONE v_tz);
      v_step_hours := GREATEST(1, COALESCE(t."intervalHours", 24));
      IF v_max_scheduled IS NOT NULL THEN v_dt := v_max_scheduled + make_interval(hours => v_step_hours);
      ELSE v_dt := v_first_dose; END IF;
      WHILE v_dt <= v_target_horizon LOOP
        INSERT INTO medcontrol.doses ("userId", "treatmentId", "patientId", "medName", unit, "scheduledAt", "actualTime", status, type, observation)
        VALUES (t."userId", t.id, t."patientId", t."medName", t.unit, v_dt, NULL, 'pending', 'scheduled', '');
        v_local_added := v_local_added + 1;
        v_dt := v_dt + make_interval(hours => v_step_hours);
      END LOOP;
    END IF;

    UPDATE medcontrol.treatments SET "doseHorizon" = v_target_horizon, "updatedAt" = NOW() WHERE id = t.id;
    v_extended := v_extended + 1;
    v_doses_added := v_doses_added + v_local_added;
  END LOOP;

  RETURN jsonb_build_object('userId', v_target_uid, 'treatmentsExtended', v_extended, 'dosesAdded', v_doses_added, 'targetHorizon', v_target_horizon);
END; $func$;

-- Nota: outro overload extend_continuous_treatments(p_days_ahead int)
-- criado em #014 (release v0.1.7.4) NÃO afetado por este bug — não processa
-- firstDoseTime array, apenas intervalHours.
