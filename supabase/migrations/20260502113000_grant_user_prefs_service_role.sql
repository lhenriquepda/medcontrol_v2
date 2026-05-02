-- Item #085 (release v0.1.7.3) — fix Edge Functions consultarem user_prefs.
--
-- Migration 20260428142412_revoke_anon_grants revogou anon grants. Mas
-- service_role nunca teve GRANT SELECT em medcontrol.user_prefs (só
-- 'authenticated' tinha). Edge Functions usam service_role + bypassam RLS
-- via FORCE ROW LEVEL SECURITY, mas não bypassam GRANT — table-level
-- privileges precisam ser explicitamente concedidos.
--
-- Sintoma: SELECT em user_prefs retorna 403 "permission denied for table
-- user_prefs" mesmo via service_role JWT. Edge `dose-trigger-handler`,
-- `schedule-alarms-fcm` e `notify-doses` (item #085) precisam ler
-- prefs.criticalAlarm pra decidir se mandam FCM data + push tray.
--
-- Adicionando SELECT only — service_role não escreve em user_prefs (writes
-- vêm do client autenticado via useUpdateUserPrefs).

GRANT SELECT ON medcontrol.user_prefs TO service_role;

-- Idempotente: GRANT é fail-safe se já concedido.
