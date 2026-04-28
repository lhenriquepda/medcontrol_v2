-- Migration: check_constraints_treatments
-- Auditoria 4.5.2 G6 — falta CHECK em treatments.
-- Adiciona: intervalHours > 0, durationDays > 0 AND <= 365, length max em medName/unit.

ALTER TABLE medcontrol.treatments
  ADD CONSTRAINT treatments_interval_positive
    CHECK ("intervalHours" IS NULL OR "intervalHours" > 0);

ALTER TABLE medcontrol.treatments
  ADD CONSTRAINT treatments_duration_positive
    CHECK ("durationDays" > 0 AND "durationDays" <= 365);

ALTER TABLE medcontrol.treatments
  ADD CONSTRAINT treatments_medname_length
    CHECK (length("medName") > 0 AND length("medName") <= 200);

ALTER TABLE medcontrol.treatments
  ADD CONSTRAINT treatments_unit_length
    CHECK (length(unit) > 0 AND length(unit) <= 100);
