-- v0.2.6.7 FIX #E02 [QA real 2026-05-24] — RPC ausente get_user_medications.
-- Frontend hook `useUserMedicationCategories.js` chamava esse RPC há tempo
-- (introduzido v0.2.4.0 P9 catalogo pessoal) mas RPC NUNCA foi criado no schema.
-- Console error empírico: "Could not find the function medcontrol.get_user_medications".
-- Categorias custom do user falhavam silente → autofill caía sempre pro CMED catálogo
-- global (sem priorizar history pessoal).
--
-- Implementação: retorna top N medicações do user ordenadas por uso recente.
-- usage_count + last_used_at populados via upsert_user_medication (já existe).
CREATE OR REPLACE FUNCTION medcontrol.get_user_medications(p_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  name text,
  group_id text,
  cmed_class text,
  principio_ativo text,
  usage_count integer,
  last_used_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'medcontrol', 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    -- Sem auth: retorna vazio (não throw — hook trata como "sem hint pessoal").
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      um.id,
      um.name,
      um.group_id,
      um.cmed_class,
      um.principio_ativo,
      um.usage_count,
      um.last_used_at
    FROM medcontrol.user_medications um
    WHERE um."userId" = v_uid
    ORDER BY
      COALESCE(um.last_used_at, um.first_used_at) DESC NULLS LAST,
      um.usage_count DESC NULLS LAST
    LIMIT GREATEST(p_limit, 0);
END;
$$;

-- Permitir authenticated chamar via PostgREST
GRANT EXECUTE ON FUNCTION medcontrol.get_user_medications(integer) TO authenticated;

COMMENT ON FUNCTION medcontrol.get_user_medications(integer) IS
  'v0.2.6.7 FIX E02: retorna top N medicações personalizadas do user. SECURITY DEFINER + auth.uid() guard.';
