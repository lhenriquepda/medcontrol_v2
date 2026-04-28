-- Migration: check_constraints_patients
-- Auditoria 4.5.2 G8 — falta CHECK em patients.

ALTER TABLE medcontrol.patients
  ADD CONSTRAINT patients_name_length
    CHECK (length(name) > 0 AND length(name) <= 200);

ALTER TABLE medcontrol.patients
  ADD CONSTRAINT patients_condition_length
    CHECK (condition IS NULL OR length(condition) <= 500);

ALTER TABLE medcontrol.patients
  ADD CONSTRAINT patients_doctor_length
    CHECK (doctor IS NULL OR length(doctor) <= 200);

ALTER TABLE medcontrol.patients
  ADD CONSTRAINT patients_allergies_length
    CHECK (allergies IS NULL OR length(allergies) <= 500);

ALTER TABLE medcontrol.patients
  ADD CONSTRAINT patients_age_range
    CHECK (age IS NULL OR (age >= 0 AND age <= 150));

ALTER TABLE medcontrol.patients
  ADD CONSTRAINT patients_weight_range
    CHECK (weight IS NULL OR (weight > 0 AND weight < 1000));
