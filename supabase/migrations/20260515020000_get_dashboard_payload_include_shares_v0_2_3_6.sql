-- Fix get_dashboard_payload: incluir pacientes compartilhados.
-- Bug v0.2.3.4 #163: RPC filtrava só "userId" = auth.uid(). Daffiny (recebe shares
-- mas não é owner) via dashboard 0 patients/0 treatments/0 doses mesmo com 2 shares
-- ativos (Rael + Liam). Hooks individuais funcionavam via RLS shared_select_patients,
-- mas dashboard-payload bypassava RLS via SECURITY DEFINER + filtro só ownership.

CREATE OR REPLACE FUNCTION medcontrol.get_dashboard_payload(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_days_ahead int DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'medcontrol' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from timestamptz := COALESCE(p_from, NOW() - INTERVAL '30 days');
  v_to timestamptz := COALESCE(p_to, NOW() + INTERVAL '60 days');
  v_extend_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- Extend contínuos primeiro (gera doses novas se necessário, depois agregamos).
  -- Só extends próprios (user owner) — share recipients não disparam extend.
  BEGIN
    v_extend_result := medcontrol.extend_continuous_treatments(v_uid, p_days_ahead);
  EXCEPTION WHEN OTHERS THEN
    v_extend_result := jsonb_build_object('error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'patients', (
      WITH accessible AS (
        SELECT id FROM medcontrol.patients WHERE "userId" = v_uid
        UNION
        SELECT "patientId" AS id FROM medcontrol.patient_shares WHERE "sharedWithUserId" = v_uid
      )
      SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p."createdAt"), '[]'::jsonb)
      FROM medcontrol.patients p
      WHERE p.id IN (SELECT id FROM accessible)
    ),
    'treatments', (
      WITH accessible AS (
        SELECT id FROM medcontrol.patients WHERE "userId" = v_uid
        UNION
        SELECT "patientId" AS id FROM medcontrol.patient_shares WHERE "sharedWithUserId" = v_uid
      )
      SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."createdAt" DESC), '[]'::jsonb)
      FROM medcontrol.treatments t
      WHERE t."patientId" IN (SELECT id FROM accessible)
    ),
    'doses', (
      WITH accessible AS (
        SELECT id FROM medcontrol.patients WHERE "userId" = v_uid
        UNION
        SELECT "patientId" AS id FROM medcontrol.patient_shares WHERE "sharedWithUserId" = v_uid
      )
      SELECT COALESCE(jsonb_agg(d ORDER BY (d->>'scheduledAt') DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'id', id,
          'userId', "userId",
          'treatmentId', "treatmentId",
          'patientId', "patientId",
          'medName', "medName",
          'unit', unit,
          'scheduledAt', "scheduledAt",
          'actualTime', "actualTime",
          'status', status,
          'type', type
        ) AS d
        FROM medcontrol.doses
        WHERE "patientId" IN (SELECT id FROM accessible)
          AND "scheduledAt" >= v_from
          AND "scheduledAt" <= v_to
        ORDER BY "scheduledAt" DESC
        LIMIT 5000
      ) sub
    ),
    'extend_result', v_extend_result,
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'fetchedAt', NOW()
  );
END
$$;
