-- v0.2.2.4 (#214) — DROP tabela órfã.
-- Histórico:
--   #083.7 (v0.1.7.2) criou tabela pra notify-doses-1min cron skip push se
--   alarme local já agendado. Cron foi UNSCHEDULED em #209 v0.2.1.9.
--   Tabela ficou sem consumers leitores — apenas escritas órfãs.
-- v0.2.2.0 alarm_audit_log substitui rastreio.
-- Cleanup: ~5-10 MB/dia/device egress economizado.

DROP TABLE IF EXISTS medcontrol.dose_alarms_scheduled CASCADE;
