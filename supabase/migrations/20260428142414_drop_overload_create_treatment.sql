-- Migration: drop_overload_create_treatment
-- Auditoria 4.5.2 G4 (P1): create_treatment_with_doses tem 2 versões.
-- V1 (10 params, sem p_timezone) é dead code — cliente atual sempre passa p_timezone.
-- Risco: se algum caller cair na V1, comportamento diferente (timezone server UTC).
-- Drop V1, mantém apenas V2 (com p_timezone).

DROP FUNCTION IF EXISTS medcontrol.create_treatment_with_doses(
  p_patient_id uuid,
  p_med_name text,
  p_unit text,
  p_interval_hours integer,
  p_duration_days integer,
  p_is_continuous boolean,
  p_start_date timestamp with time zone,
  p_first_dose_time text,
  p_mode text,
  p_is_template boolean
);

-- Verificação
-- SELECT pg_get_function_identity_arguments(oid) FROM pg_proc
-- WHERE pronamespace='medcontrol'::regnamespace AND proname='create_treatment_with_doses';
-- Esperado: 1 row (apenas V2 com p_timezone)
