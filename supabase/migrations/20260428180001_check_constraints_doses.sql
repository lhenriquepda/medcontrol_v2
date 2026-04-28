-- Migration: check_constraints_doses
-- Auditoria 4.5.2 — completar CHECK em doses (já tem observation_length, type, status).
-- Adiciona: length max em medName/unit.

ALTER TABLE medcontrol.doses
  ADD CONSTRAINT doses_medname_length
    CHECK (length("medName") > 0 AND length("medName") <= 200);

ALTER TABLE medcontrol.doses
  ADD CONSTRAINT doses_unit_length
    CHECK (length(unit) > 0 AND length(unit) <= 100);
