-- Migration: revoke_anon_grants
-- Auditoria 4.5.2 G1 (P0 CRÍTICO): anon role tinha SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER em 10/11 tabelas.
-- RLS bloqueia (auth.uid() retorna NULL pra anon), mas defense-in-depth quebrada.
-- Esta migration: REVOKE ALL FROM anon em todas tabelas medcontrol.
-- user_prefs já estava OK (apenas authenticated tinha grants).

REVOKE ALL ON medcontrol.admins FROM anon;
REVOKE ALL ON medcontrol.doses FROM anon;
REVOKE ALL ON medcontrol.patient_shares FROM anon;
REVOKE ALL ON medcontrol.patients FROM anon;
REVOKE ALL ON medcontrol.push_subscriptions FROM anon;
REVOKE ALL ON medcontrol.security_events FROM anon;
REVOKE ALL ON medcontrol.sos_rules FROM anon;
REVOKE ALL ON medcontrol.subscriptions FROM anon;
REVOKE ALL ON medcontrol.treatment_templates FROM anon;
REVOKE ALL ON medcontrol.treatments FROM anon;

-- Verificação: pode rodar pós-migration pra confirmar
-- SELECT grantee, table_name FROM information_schema.role_table_grants
-- WHERE table_schema='medcontrol' AND grantee='anon';
-- Esperado: 0 rows
