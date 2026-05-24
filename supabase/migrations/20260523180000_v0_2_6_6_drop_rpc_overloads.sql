-- v0.2.6.6 F7 — DROP overloads RPC stale.
-- Aplicada via MCP. Garante PostgREST sempre resolve pra signature correta sem
-- ambiguidade. Bug crônico potencial: PostgREST escolhia overload errado quando
-- cliente omitia params opcionais → mutation usava versão sem RLS check correto.

-- register_sos_dose: 3 overloads → 1. Mantém 8 params (com p_group_id + p_cmed_class).
DROP FUNCTION IF EXISTS medcontrol.register_sos_dose(uuid, text, text, timestamptz, text);
DROP FUNCTION IF EXISTS medcontrol.register_sos_dose(uuid, text, text, timestamptz, text, boolean);

-- create_treatment_with_doses: 2 overloads → 1. Mantém 13 params.
DROP FUNCTION IF EXISTS medcontrol.create_treatment_with_doses(uuid, text, text, integer, integer, boolean, timestamptz, text, text, boolean, text);

-- extend_continuous_treatments: 2 overloads → 1. Mantém versão com p_user_id explícito.
DROP FUNCTION IF EXISTS medcontrol.extend_continuous_treatments(integer);

-- share_patient_by_email: 3 overloads → 1. Mantém 4 params com p_access_level.
DROP FUNCTION IF EXISTS medcontrol.share_patient_by_email(uuid, text);
DROP FUNCTION IF EXISTS medcontrol.share_patient_by_email(uuid, text, timestamptz);

-- v1 dose RPCs deprecated: frontend usa v2 desde v0.2.6.1 (error handling 409 + audit).
-- v1 ainda existindo era risco de chamada acidental sem proteções.
DROP FUNCTION IF EXISTS medcontrol.confirm_dose(uuid, timestamptz, text);
DROP FUNCTION IF EXISTS medcontrol.skip_dose(uuid, text);
DROP FUNCTION IF EXISTS medcontrol.undo_dose(uuid);
