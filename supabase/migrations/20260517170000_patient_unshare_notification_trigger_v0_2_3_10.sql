-- Item #297 (release v0.2.3.10) — DB trigger on patient_shares.DELETE calls
-- Edge Function patient-unshare-handler via pg_net to dispatch FCM data-only
-- HIGH ao cuidador removido. Java handler invalida cache local + remove
-- paciente fantasma + doses/tratamentos órfãos.
--
-- Cenário fix: owner deleta paciente OU revoga share → cuidador app mostrava
-- paciente fantasma com doses até force-close. UX ruim + risco LGPD.

CREATE OR REPLACE FUNCTION medcontrol.notify_patient_share_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'medcontrol', 'public'
AS $$
DECLARE
  v_edge_url text := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/patient-unshare-handler';
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'type', 'DELETE',
    'table', 'patient_shares',
    'schema', 'medcontrol',
    'old_record', jsonb_build_object(
      'patientId', OLD."patientId",
      'ownerId', OLD."ownerId",
      'sharedWithUserId', OLD."sharedWithUserId"
    )
  );

  PERFORM net.http_post(
    url := v_edge_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := v_payload
  );

  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_patient_unshare] error: %', SQLERRM;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_patient_share_deleted ON medcontrol.patient_shares;
CREATE TRIGGER trg_notify_patient_share_deleted
AFTER DELETE ON medcontrol.patient_shares
FOR EACH ROW
EXECUTE FUNCTION medcontrol.notify_patient_share_deleted();
