-- v0.2.6.4 P3.3 (Roteiro) — feature_flags master switch runtime
-- Permite rollback feature em <5min sem deploy (ex: storm Realtime).
-- Edge cache 5min implementado em P8.8 (próxima sprint).

CREATE TABLE IF NOT EXISTS medcontrol.feature_flags (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE medcontrol.feature_flags ENABLE ROW LEVEL SECURITY;

-- SELECT público (read-only — cliente consome flags em runtime)
DROP POLICY IF EXISTS ff_select_public ON medcontrol.feature_flags;
CREATE POLICY ff_select_public ON medcontrol.feature_flags
  FOR SELECT TO authenticated, anon
  USING (true);

-- WRITE somente admin
DROP POLICY IF EXISTS ff_admin_write ON medcontrol.feature_flags;
CREATE POLICY ff_admin_write ON medcontrol.feature_flags
  FOR ALL TO authenticated
  USING (medcontrol.is_admin())
  WITH CHECK (medcontrol.is_admin());

-- Seed inicial
INSERT INTO medcontrol.feature_flags (key, value, description) VALUES
  ('realtime_enabled',
   'false'::jsonb,
   'Master switch Supabase Realtime — DESLIGADO desde #157 (storm 5GB/h). Reativar com P1.9+P8.1 safeguards (lifecycle pause + idle detection + master switch flip-rollback).'),
  ('engine_interactions_enabled',
   'false'::jsonb,
   'Habilita check_interactions modal pre-submit TreatmentForm (Roteiro P3.6 ADR-012).'),
  ('ocr_enabled',
   'false'::jsonb,
   'OCR via Gemini Vision (Future v0.3+).'),
  ('cmed_monthly_sync_enabled',
   'true'::jsonb,
   'Cron mensal CMED XLSX sync (Roteiro P9.2). Off = pula sync se XLSX URL muda formato.'),
  ('classify_real_time_enabled',
   'true'::jsonb,
   'Hook useClassifyMedication chama RPC server-side (vs fallback heurístico). v0.2.6.3 shipped.'),
  ('share_temporary_enabled',
   'true'::jsonb,
   'TTL share UI radio (Permanente/Temporário). v0.2.6.1 shipped.')
ON CONFLICT (key) DO NOTHING;

-- RPC admin pra mudar flag em runtime
CREATE OR REPLACE FUNCTION medcontrol.admin_set_feature_flag(p_key TEXT, p_value JSONB)
RETURNS VOID AS $$
BEGIN
  IF NOT medcontrol.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin required';
  END IF;
  INSERT INTO medcontrol.feature_flags (key, value, updated_by)
  VALUES (p_key, p_value, auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        "updatedAt" = NOW(),
        updated_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

REVOKE ALL ON FUNCTION medcontrol.admin_set_feature_flag(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION medcontrol.admin_set_feature_flag(TEXT, JSONB) TO authenticated;

-- RPC pública pra ler todas as flags (cliente cacheia)
CREATE OR REPLACE FUNCTION medcontrol.list_feature_flags()
RETURNS TABLE (key TEXT, value JSONB) AS $$
  SELECT key, value FROM medcontrol.feature_flags ORDER BY key;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = medcontrol, public;

GRANT EXECUTE ON FUNCTION medcontrol.list_feature_flags() TO authenticated, anon;
