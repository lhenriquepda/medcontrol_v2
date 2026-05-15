-- Enable trigram extension for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- medications_catalog: catálogo público ANVISA (nome comercial + princípio ativo)
CREATE TABLE IF NOT EXISTS medcontrol.medications_catalog (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_comercial  text NOT NULL,
  principio_ativo text NOT NULL,
  ativo           boolean NOT NULL DEFAULT true,
  UNIQUE (nome_comercial, principio_ativo)
);

-- GIN trigram indexes para busca parcial rápida em ambos campos
CREATE INDEX IF NOT EXISTS medications_catalog_nome_trgm_idx
  ON medcontrol.medications_catalog USING gin (nome_comercial extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS medications_catalog_principio_trgm_idx
  ON medcontrol.medications_catalog USING gin (principio_ativo extensions.gin_trgm_ops);

-- RLS: leitura pública (catálogo não é PII)
ALTER TABLE medcontrol.medications_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medications_catalog_public_read"
  ON medcontrol.medications_catalog FOR SELECT USING (true);

-- RPC search_medications: retorna nome_comercial + principio_ativo ordenados por qualidade do match
CREATE OR REPLACE FUNCTION medcontrol.search_medications(q text, lim int DEFAULT 20)
RETURNS TABLE (nome_comercial text, principio_ativo text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT nome_comercial, principio_ativo
  FROM medcontrol.medications_catalog
  WHERE ativo = true
    AND (
      nome_comercial ILIKE '%' || q || '%'
      OR principio_ativo ILIKE '%' || q || '%'
    )
  ORDER BY
    CASE
      WHEN lower(nome_comercial) = lower(q)            THEN 0
      WHEN lower(nome_comercial) ILIKE lower(q) || '%' THEN 1
      WHEN lower(principio_ativo) ILIKE lower(q) || '%' THEN 2
      ELSE 3
    END,
    nome_comercial
  LIMIT lim;
$$;

-- Grant EXECUTE pra anon e authenticated
GRANT EXECUTE ON FUNCTION medcontrol.search_medications(text, int) TO anon, authenticated;
