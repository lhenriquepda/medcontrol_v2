-- #146 (release v0.2.0.11) — pg_cron extend batch INSERT verify.
-- Antes cron job 2 (extend_all_active_continuous) rodava silencioso —
-- nenhum log persistido. Sem visibilidade pra detectar drift (cron parou,
-- treatments contínuos sem novas doses, users idle perdem alarme).
--
-- Agora: tabela audit + wrapper que captura resultado + erros.
-- View cron_health_recent expõe last 30 runs pra dashboard admin.

CREATE TABLE IF NOT EXISTS medcontrol.cron_audit_log (
  id           bigserial PRIMARY KEY,
  job_name     text NOT NULL,
  ran_at       timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL CHECK (status IN ('ok','error')),
  payload      jsonb,
  error_msg    text,
  duration_ms  int
);

CREATE INDEX IF NOT EXISTS idx_cron_audit_ran_at ON medcontrol.cron_audit_log (ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_audit_job_name_ran_at ON medcontrol.cron_audit_log (job_name, ran_at DESC);

-- Auto-cleanup rows > 90 dias (audit log não cresce sem limite)
CREATE OR REPLACE FUNCTION medcontrol.cron_audit_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = medcontrol
AS $$
  DELETE FROM medcontrol.cron_audit_log WHERE ran_at < now() - interval '90 days';
$$;

-- Wrapper executa extend_all_active_continuous + log audit + cleanup periódico
CREATE OR REPLACE FUNCTION medcontrol.run_extend_continuous_with_audit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, pg_temp
AS $$
DECLARE
  v_start timestamptz := clock_timestamp();
  v_result jsonb;
  v_duration int;
BEGIN
  BEGIN
    v_result := medcontrol.extend_all_active_continuous();
    v_duration := extract(milliseconds FROM clock_timestamp() - v_start)::int;
    INSERT INTO medcontrol.cron_audit_log (job_name, status, payload, duration_ms)
    VALUES ('extend-continuous-treatments-daily', 'ok', v_result, v_duration);
  EXCEPTION WHEN OTHERS THEN
    v_duration := extract(milliseconds FROM clock_timestamp() - v_start)::int;
    INSERT INTO medcontrol.cron_audit_log (job_name, status, error_msg, duration_ms)
    VALUES ('extend-continuous-treatments-daily', 'error', SQLERRM, v_duration);
    RAISE;
  END;

  -- Cleanup 1× por execução (idempotente, barato)
  PERFORM medcontrol.cron_audit_cleanup();

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.run_extend_continuous_with_audit() TO postgres;
GRANT EXECUTE ON FUNCTION medcontrol.cron_audit_cleanup() TO postgres;

-- View health: últimos 30 runs com flags drift
CREATE OR REPLACE VIEW medcontrol.cron_health_recent AS
SELECT
  id,
  job_name,
  ran_at,
  status,
  duration_ms,
  payload,
  error_msg,
  -- drift flag: doses=0 em day quando há treatments contínuos ativos
  CASE
    WHEN status = 'ok'
      AND COALESCE((payload->>'treatments')::int, 0) > 0
      AND COALESCE((payload->>'doses')::int, 0) = 0
    THEN true ELSE false
  END AS suspicious_zero_doses
FROM medcontrol.cron_audit_log
ORDER BY ran_at DESC
LIMIT 30;

-- RLS na audit table — só admin lê via view
ALTER TABLE medcontrol.cron_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE medcontrol.cron_audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY cron_audit_admin_only ON medcontrol.cron_audit_log
  FOR SELECT
  TO authenticated
  USING (medcontrol.is_admin());

GRANT SELECT ON medcontrol.cron_audit_log TO authenticated;
GRANT SELECT ON medcontrol.cron_health_recent TO authenticated;

COMMENT ON TABLE medcontrol.cron_audit_log IS '#146 v0.2.0.11 audit log cron jobs. Auto-cleanup 90d. RLS admin-only.';
COMMENT ON VIEW medcontrol.cron_health_recent IS '#146 v0.2.0.11 last 30 cron runs com drift flags. Admin painel.';
