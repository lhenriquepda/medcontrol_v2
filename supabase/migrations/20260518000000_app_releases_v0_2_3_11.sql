-- v0.2.3.11 #299 — tabela autoritativa app_releases
--
-- Substitui o mapa hardcoded VERSION_CODE_TO_NAME + cadeia frágil de fallbacks
-- (Play Core null em Internal Testing + Vercel /version.json desync) por uma
-- única fonte de verdade no DB. IA atualiza via INSERT no Passo 12 do README
-- após upload do AAB no Play Console.
--
-- Coluna is_mandatory: força modal bloqueante (não dismissable) quando true.
-- Default false = banner verde dismissable normal.

CREATE TABLE IF NOT EXISTS medcontrol.app_releases (
  version_code  INT PRIMARY KEY,
  version_name  TEXT NOT NULL,
  is_mandatory  BOOLEAN NOT NULL DEFAULT false,
  whatsnew      TEXT,
  shipped_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE medcontrol.app_releases IS
  'Tabela autoritativa de releases shipadas. IA insere uma linha no Passo 12 do README após upload do AAB. useAppUpdate.js consulta version_name por version_code.';

COMMENT ON COLUMN medcontrol.app_releases.is_mandatory IS
  'true = força modal bloqueante (user não consegue usar app até atualizar). Use só pra security fixes, breaking schema, bugs críticos.';

-- RLS público read-only — version_name é dado não-sensível
ALTER TABLE medcontrol.app_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_releases_public_read"
  ON medcontrol.app_releases
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Seed releases já shipadas (Play Store production)
INSERT INTO medcontrol.app_releases (version_code, version_name, shipped_at) VALUES
  (70, '0.2.3.7',  '2026-05-17 00:00:00+00'),
  (71, '0.2.3.8',  '2026-05-17 00:00:00+00'),
  (72, '0.2.3.9',  '2026-05-17 00:00:00+00'),
  (73, '0.2.3.10', '2026-05-17 00:00:00+00')
ON CONFLICT (version_code) DO NOTHING;
