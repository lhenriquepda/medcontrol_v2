-- v0.2.6.4 P9.6 + P9.7 (Roteiro) — categorization health + bulk re-categorize

-- ─── P9.7: view dashboard categorization health ────────────────────────
-- Métricas pra admin painel `/categorization-health` + alarme P0 webhook DPO
-- quando pct_null > 5% por 7 dias sustained.

CREATE OR REPLACE VIEW medcontrol.v_categorization_health AS
SELECT
  -- Catálogo
  (SELECT count(*) FROM medcontrol.medications_catalog) AS catalog_total,
  (SELECT count(*) FROM medcontrol.medications_catalog WHERE group_id IS NULL OR group_id = 'outro') AS catalog_uncategorized,
  ROUND(100.0 *
    (SELECT count(*) FROM medcontrol.medications_catalog WHERE group_id IS NULL OR group_id = 'outro')::numeric
    / NULLIF((SELECT count(*) FROM medcontrol.medications_catalog), 0)::numeric, 2
  ) AS catalog_pct_uncategorized,

  -- Treatments (active + paused, exclui ended) últimos 90 dias
  (SELECT count(*) FROM medcontrol.treatments WHERE status IN ('active', 'paused')) AS treatments_active,
  (SELECT count(*) FROM medcontrol.treatments WHERE status IN ('active', 'paused') AND group_id IS NULL) AS treatments_null,
  (SELECT count(*) FROM medcontrol.treatments WHERE status IN ('active', 'paused') AND group_id = 'outro') AS treatments_outro,

  -- Doses últimos 30 dias
  (SELECT count(*) FROM medcontrol.doses WHERE "scheduledAt" > NOW() - INTERVAL '30 days') AS doses_30d_total,
  (SELECT count(*) FROM medcontrol.doses WHERE "scheduledAt" > NOW() - INTERVAL '30 days' AND group_id IS NULL) AS doses_30d_null,
  (SELECT count(*) FROM medcontrol.doses WHERE "scheduledAt" > NOW() - INTERVAL '30 days' AND group_id = 'outro') AS doses_30d_outro,
  ROUND(100.0 *
    (SELECT count(*) FROM medcontrol.doses WHERE "scheduledAt" > NOW() - INTERVAL '30 days' AND group_id IS NULL)::numeric
    / NULLIF((SELECT count(*) FROM medcontrol.doses WHERE "scheduledAt" > NOW() - INTERVAL '30 days'), 0)::numeric, 2
  ) AS doses_30d_pct_null,
  ROUND(100.0 *
    (SELECT count(*) FROM medcontrol.doses WHERE "scheduledAt" > NOW() - INTERVAL '30 days' AND group_id = 'outro')::numeric
    / NULLIF((SELECT count(*) FROM medcontrol.doses WHERE "scheduledAt" > NOW() - INTERVAL '30 days'), 0)::numeric, 2
  ) AS doses_30d_pct_outro,

  NOW() AS computed_at;

-- RLS — só admin pode ver agregados globais
ALTER VIEW medcontrol.v_categorization_health OWNER TO postgres;
GRANT SELECT ON medcontrol.v_categorization_health TO service_role;

-- RPC pra admin painel ler (com check de admin)
CREATE OR REPLACE FUNCTION medcontrol.get_categorization_health()
RETURNS jsonb AS $$
DECLARE v_row record;
BEGIN
  IF NOT medcontrol.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin required';
  END IF;
  SELECT * INTO v_row FROM medcontrol.v_categorization_health;
  RETURN to_jsonb(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.get_categorization_health() TO authenticated;

-- ─── P9.6: RPC list_null_meds_with_suggestions ─────────────────────────
-- Lista medicamentos únicos do user com group_id NULL + sugestão classify_robust.
-- Modal Analytics drill-down "Não classificado" consome via tap na fatia donut.

CREATE OR REPLACE FUNCTION medcontrol.list_null_meds_with_suggestions(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  med_name TEXT,
  dose_count INT,
  patient_count INT,
  suggested_group TEXT,
  suggested_cmed_class TEXT,
  suggestion_source TEXT,
  suggestion_confidence numeric,
  matched_name TEXT
) AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  WITH null_doses AS (
    SELECT
      d."medName"::text AS name,
      count(*)::int AS doses,
      count(DISTINCT d."patientId")::int AS patients
    FROM medcontrol.doses d
    WHERE d."userId" = v_uid
      AND (d.group_id IS NULL OR d.group_id = 'outro')
    GROUP BY d."medName"
    ORDER BY count(*) DESC
    LIMIT p_limit
  )
  SELECT
    nd.name AS med_name,
    nd.doses AS dose_count,
    nd.patients AS patient_count,
    cls.group_id AS suggested_group,
    cls.cmed_class AS suggested_cmed_class,
    cls.source AS suggestion_source,
    cls.confidence AS suggestion_confidence,
    cls.matched_name AS matched_name
  FROM null_doses nd
  LEFT JOIN LATERAL (
    SELECT * FROM medcontrol.classify_medication_robust(nd.name) LIMIT 1
  ) cls ON true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.list_null_meds_with_suggestions(INT) TO authenticated;

-- RPC bulk apply suggestions (cascata treatment → doses)
CREATE OR REPLACE FUNCTION medcontrol.apply_bulk_categorize(
  p_meds JSONB  -- [{ med_name, group_id, cmed_class? }]
) RETURNS JSONB AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_med_name TEXT;
  v_group_id TEXT;
  v_cmed_class TEXT;
  v_treatments_fixed INT := 0;
  v_doses_fixed INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF jsonb_typeof(p_meds) != 'array' THEN
    RAISE EXCEPTION 'p_meds must be jsonb array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_meds)
  LOOP
    v_med_name := v_item->>'med_name';
    v_group_id := v_item->>'group_id';
    v_cmed_class := v_item->>'cmed_class';

    IF v_med_name IS NULL OR v_group_id IS NULL THEN CONTINUE; END IF;

    -- Update treatments do user com mesmo medName
    WITH upd AS (
      UPDATE medcontrol.treatments
      SET group_id = v_group_id,
          cmed_class = COALESCE(v_cmed_class, cmed_class)
      WHERE "userId" = v_uid
        AND "medName" = v_med_name
        AND (group_id IS NULL OR group_id = 'outro')
      RETURNING 1
    )
    SELECT v_treatments_fixed + count(*) INTO v_treatments_fixed FROM upd;

    -- Update doses do user (cascata)
    WITH upd AS (
      UPDATE medcontrol.doses
      SET group_id = v_group_id,
          cmed_class = COALESCE(v_cmed_class, cmed_class)
      WHERE "userId" = v_uid
        AND "medName" = v_med_name
        AND (group_id IS NULL OR group_id = 'outro')
      RETURNING 1
    )
    SELECT v_doses_fixed + count(*) INTO v_doses_fixed FROM upd;
  END LOOP;

  -- Audit log
  PERFORM medcontrol.write_audit_log('feature_flag_changed', NULL,
    jsonb_build_object('action', 'bulk_categorize', 'meds_count', jsonb_array_length(p_meds),
                       'treatments_fixed', v_treatments_fixed, 'doses_fixed', v_doses_fixed));

  RETURN jsonb_build_object(
    'treatments_fixed', v_treatments_fixed,
    'doses_fixed', v_doses_fixed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.apply_bulk_categorize(JSONB) TO authenticated;
