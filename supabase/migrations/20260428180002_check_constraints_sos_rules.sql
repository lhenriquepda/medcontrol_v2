-- Migration: check_constraints_sos_rules
-- Auditoria 4.5.2 G7 — falta CHECK em sos_rules.

ALTER TABLE medcontrol.sos_rules
  ADD CONSTRAINT sos_rules_min_interval_positive
    CHECK ("minIntervalHours" IS NULL OR "minIntervalHours" > 0);

ALTER TABLE medcontrol.sos_rules
  ADD CONSTRAINT sos_rules_max_doses_positive
    CHECK ("maxDosesIn24h" IS NULL OR "maxDosesIn24h" > 0);

ALTER TABLE medcontrol.sos_rules
  ADD CONSTRAINT sos_rules_medname_length
    CHECK (length("medName") > 0 AND length("medName") <= 200);
