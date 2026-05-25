-- Grant SELECT privilege on medications_catalog to anon, authenticated and service_role.
-- Fixes silent 403 permission denied error when calling inline search_medications RPC function.
GRANT SELECT ON medcontrol.medications_catalog TO anon, authenticated, service_role;
