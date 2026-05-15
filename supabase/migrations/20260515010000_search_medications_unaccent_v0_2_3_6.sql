-- Accent-insensitive search for medications_catalog
-- "magne" matches "Magnésio", "Magnesio", "MAGNÉSIO" etc.

CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- Default unaccent is STABLE — can't use in functional index. Wrap as IMMUTABLE.
CREATE OR REPLACE FUNCTION medcontrol.immutable_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT extensions.unaccent('extensions.unaccent', $1)
$$;

-- Drop old GIN indexes (accent-sensitive)
DROP INDEX IF EXISTS medcontrol.medications_catalog_nome_trgm_idx;
DROP INDEX IF EXISTS medcontrol.medications_catalog_principio_trgm_idx;

-- New GIN indexes on unaccented + lowercased values
CREATE INDEX medications_catalog_nome_unaccent_trgm_idx
  ON medcontrol.medications_catalog
  USING gin (medcontrol.immutable_unaccent(lower(nome_comercial)) extensions.gin_trgm_ops);

CREATE INDEX medications_catalog_principio_unaccent_trgm_idx
  ON medcontrol.medications_catalog
  USING gin (medcontrol.immutable_unaccent(lower(principio_ativo)) extensions.gin_trgm_ops);

-- Updated RPC: unaccent + lowercase on both sides
CREATE OR REPLACE FUNCTION medcontrol.search_medications(q text, lim int DEFAULT 20)
RETURNS TABLE (nome_comercial text, principio_ativo text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH normalized AS (
    SELECT medcontrol.immutable_unaccent(lower(q)) AS nq
  )
  SELECT mc.nome_comercial, mc.principio_ativo
  FROM medcontrol.medications_catalog mc, normalized n
  WHERE mc.ativo = true
    AND (
      medcontrol.immutable_unaccent(lower(mc.nome_comercial)) LIKE '%' || n.nq || '%'
      OR medcontrol.immutable_unaccent(lower(mc.principio_ativo)) LIKE '%' || n.nq || '%'
    )
  ORDER BY
    CASE
      WHEN medcontrol.immutable_unaccent(lower(mc.nome_comercial)) = n.nq                    THEN 0
      WHEN medcontrol.immutable_unaccent(lower(mc.nome_comercial)) LIKE n.nq || '%'           THEN 1
      WHEN medcontrol.immutable_unaccent(lower(mc.principio_ativo)) LIKE n.nq || '%'          THEN 2
      ELSE 3
    END,
    mc.nome_comercial
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.immutable_unaccent(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION medcontrol.search_medications(text, int) TO anon, authenticated;
