-- Migration: force_rls_user_prefs
-- Auditoria 4.5.2 G2 (P1): user_prefs era a única tabela sem FORCE ROW LEVEL SECURITY.
-- Outras 10/11 já têm. Adiciona pra consistência.

ALTER TABLE medcontrol.user_prefs FORCE ROW LEVEL SECURITY;

-- Verificação
-- SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
-- WHERE relnamespace='medcontrol'::regnamespace AND relname='user_prefs';
-- Esperado: rls=true, force_rls=true
