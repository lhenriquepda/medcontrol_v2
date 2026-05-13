GRANT SELECT, INSERT, UPDATE, DELETE ON medcontrol.alarm_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON medcontrol.alarm_audit_config TO service_role;
GRANT USAGE ON SCHEMA medcontrol TO service_role;
