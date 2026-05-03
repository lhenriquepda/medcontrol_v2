-- Item #014 (release v0.1.7.4) — Recriar RPC extend_continuous_treatments.
--
-- BUG-004 audit 2026-05-01: RPC sumiu do schema (PGRST202 404). Mitigação
-- atual = pg_cron diário. Sem fallback client-side, doses contínuas
-- demoram até 24h pra renovar pra users idle. Pra users ativos chamar
-- mount Dashboard pra renovar sob-demanda.
--
-- Lógica:
--   1. Authenticated user só (auth.uid() IS NOT NULL)
--   2. Pra cada treatment do user que isContinuous=true AND isTemplate=false
--      AND intervalHours válido AND (doseHorizon NULL OR doseHorizon < target):
--        - target = now() + p_days_ahead days
--        - last_at = MAX(scheduledAt) das doses existentes do treatment, OR startDate
--        - Inserir doses incrementando intervalHours até target
--        - Update treatment.doseHorizon = target
--   3. Returns json {dosesAdded, treatmentsExtended, horizon}
--
-- Idempotente: NOT EXISTS check antes INSERT evita duplicatas em qualquer
-- chamada concorrente (pg_cron + client). Re-execução é no-op.
--
-- Constraints respeitadas:
--   doses.status IN ('pending', 'overdue', 'done', ...)  → 'pending'
--   doses.type IN ('scheduled', 'sos')                   → 'scheduled'

CREATE OR REPLACE FUNCTION medcontrol.extend_continuous_treatments(p_days_ahead int DEFAULT 5)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  target_horizon timestamptz;
  treatments_extended int := 0;
  doses_added int := 0;
  t RECORD;
  last_at timestamptz;
  next_at timestamptz;
  iter_count int;
  max_iter constant int := 1000; -- guarda contra loops infinitos (intervalHours=0 etc)
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_days_ahead < 1 OR p_days_ahead > 30 THEN
    RAISE EXCEPTION 'p_days_ahead must be between 1 and 30';
  END IF;

  target_horizon := now() + (p_days_ahead || ' days')::interval;

  FOR t IN
    SELECT id, "patientId", "medName", unit, "intervalHours",
           "doseHorizon", "startDate", "firstDoseTime"
    FROM medcontrol.treatments
    WHERE "userId" = uid
      AND "isContinuous" = true
      AND "isTemplate" = false
      AND "intervalHours" IS NOT NULL
      AND "intervalHours" > 0
      AND ("doseHorizon" IS NULL OR "doseHorizon" < target_horizon)
  LOOP
    -- Última dose agendada deste treatment (ou NULL se nunca teve dose)
    SELECT MAX("scheduledAt") INTO last_at
    FROM medcontrol.doses
    WHERE "treatmentId" = t.id;

    -- Próxima dose: se já existe, soma intervalo; se não, parte do startDate
    IF last_at IS NULL THEN
      next_at := t."startDate";
    ELSE
      next_at := last_at + (t."intervalHours" || ' hours')::interval;
    END IF;

    iter_count := 0;

    WHILE next_at <= target_horizon LOOP
      iter_count := iter_count + 1;
      IF iter_count > max_iter THEN
        RAISE WARNING 'extend_continuous_treatments: max_iter atingido para treatment %', t.id;
        EXIT;
      END IF;

      -- Idempotência: skip se já existe dose nesse exato horário
      IF NOT EXISTS (
        SELECT 1 FROM medcontrol.doses
        WHERE "treatmentId" = t.id AND "scheduledAt" = next_at
      ) THEN
        INSERT INTO medcontrol.doses (
          "userId", "treatmentId", "patientId", "medName", unit,
          "scheduledAt", status, type, "createdAt", "updatedAt"
        ) VALUES (
          uid, t.id, t."patientId", t."medName", t.unit,
          next_at, 'pending', 'scheduled', now(), now()
        );
        doses_added := doses_added + 1;
      END IF;

      next_at := next_at + (t."intervalHours" || ' hours')::interval;
    END LOOP;

    -- Atualiza horizon do treatment (mesmo se nada foi inserido — registra que
    -- avaliamos até esse target, evita re-scan na próxima chamada antes do prazo)
    UPDATE medcontrol.treatments
    SET "doseHorizon" = target_horizon, "updatedAt" = now()
    WHERE id = t.id;

    treatments_extended := treatments_extended + 1;
  END LOOP;

  RETURN json_build_object(
    'dosesAdded', doses_added,
    'treatmentsExtended', treatments_extended,
    'horizon', target_horizon
  );
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.extend_continuous_treatments(int) TO authenticated;

COMMENT ON FUNCTION medcontrol.extend_continuous_treatments(int) IS
  'Item #014 — recria RPC pra estender doses de tratamentos contínuos no horizonte de p_days_ahead dias. Idempotente. SECURITY DEFINER + RLS bypass implícito (filtra por auth.uid() explicitamente).';
