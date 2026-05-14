-- v0.2.3.4 #163 — RPC consolidado Dashboard reduz 4 queries paralelas
-- (patients + treatments + doses + extend_continuous_treatments) em 1 RPC round-trip.
-- Esperado -40% a -60% Dashboard egress + overhead PostgREST por request eliminado.
-- SECURITY DEFINER usa auth.uid() do JWT — bypassa RLS mas filtra por user_id manualmente.

CREATE OR REPLACE FUNCTION medcontrol.get_dashboard_payload(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_days_ahead integer DEFAULT 5
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, medcontrol
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from timestamptz := COALESCE(p_from, NOW() - INTERVAL '30 days');
  v_to timestamptz := COALESCE(p_to, NOW() + INTERVAL '60 days');
  v_extend_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- Extend contínuos primeiro (gera doses novas se necessário, depois agregamos)
  BEGIN
    v_extend_result := medcontrol.extend_continuous_treatments(v_uid, p_days_ahead);
  EXCEPTION WHEN OTHERS THEN
    v_extend_result := jsonb_build_object('error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'patients', (
      SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p."createdAt"), '[]'::jsonb)
      FROM medcontrol.patients p
      WHERE p."userId" = v_uid
    ),
    'treatments', (
      SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."createdAt" DESC), '[]'::jsonb)
      FROM medcontrol.treatments t
      WHERE t."userId" = v_uid
    ),
    'doses', (
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
        WHERE "userId" = v_uid
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

GRANT EXECUTE ON FUNCTION medcontrol.get_dashboard_payload(timestamptz, timestamptz, integer) TO authenticated;
