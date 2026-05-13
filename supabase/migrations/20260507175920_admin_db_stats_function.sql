-- RPC retorna stats de DB pra painel admin
-- Acesso restrito: apenas tier=admin via medcontrol.is_admin()
CREATE OR REPLACE FUNCTION medcontrol.admin_db_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, medcontrol, pg_catalog
AS $$
DECLARE
  v_db_size_bytes bigint;
  v_tables jsonb;
  v_total_rows bigint;
BEGIN
  -- Gate: só admin
  IF NOT medcontrol.is_admin() THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: apenas admin';
  END IF;

  -- Tamanho total do DB
  SELECT pg_database_size(current_database()) INTO v_db_size_bytes;

  -- Stats por tabela em medcontrol
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', relname,
      'rows', n_live_tup,
      'sizeBytes', pg_relation_size(schemaname||'.'||relname),
      'totalSizeBytes', pg_total_relation_size(schemaname||'.'||relname)
    ) ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
  ) INTO v_tables
  FROM pg_stat_user_tables
  WHERE schemaname = 'medcontrol';

  -- Total de rows
  SELECT COALESCE(SUM(n_live_tup), 0) INTO v_total_rows
  FROM pg_stat_user_tables
  WHERE schemaname = 'medcontrol';

  RETURN jsonb_build_object(
    'dbSizeBytes', v_db_size_bytes,
    'totalRows', v_total_rows,
    'tables', COALESCE(v_tables, '[]'::jsonb),
    'collectedAt', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.admin_db_stats() TO authenticated;
