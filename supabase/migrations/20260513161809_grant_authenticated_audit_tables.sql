GRANT USAGE ON SCHEMA medcontrol TO authenticated, anon;
GRANT INSERT ON medcontrol.alarm_audit_log TO authenticated;
GRANT SELECT ON medcontrol.alarm_audit_log TO authenticated;
GRANT SELECT ON medcontrol.alarm_audit_config TO authenticated;
