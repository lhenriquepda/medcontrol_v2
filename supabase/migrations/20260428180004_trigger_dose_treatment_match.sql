-- Migration: trigger_dose_treatment_match
-- Auditoria 4.5.2 G5 — sem trigger validando cross-FK ownership dose↔treatment.
-- Cenário: cliente envia INSERT com patientId=X + treatmentId=Y onde Y pertence a outro patient.
-- RLS valida has_patient_access(patientId), FK valida treatmentId existe, MAS nada valida
-- que treatment.patientId == dose.patientId. Resultado: dose órfã.

CREATE OR REPLACE FUNCTION medcontrol.validate_dose_treatment_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, pg_temp
AS $$
DECLARE
  v_treatment_patient_id uuid;
BEGIN
  -- Apenas valida se treatmentId não é NULL (SOS doses podem ter treatmentId NULL)
  IF NEW."treatmentId" IS NOT NULL THEN
    SELECT "patientId" INTO v_treatment_patient_id
    FROM medcontrol.treatments
    WHERE id = NEW."treatmentId";

    IF v_treatment_patient_id IS NULL THEN
      RAISE EXCEPTION 'Treatment % not found', NEW."treatmentId"
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_treatment_patient_id != NEW."patientId" THEN
      RAISE EXCEPTION 'Dose patientId (%) does not match treatment patientId (%)',
        NEW."patientId", v_treatment_patient_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_dose_treatment_match_trigger ON medcontrol.doses;

CREATE TRIGGER validate_dose_treatment_match_trigger
BEFORE INSERT OR UPDATE OF "patientId", "treatmentId" ON medcontrol.doses
FOR EACH ROW
EXECUTE FUNCTION medcontrol.validate_dose_treatment_match();

COMMENT ON FUNCTION medcontrol.validate_dose_treatment_match() IS
  'Aud 4.5.2 G5: valida que dose.patientId == treatment.patientId (cross-FK ownership).';
