-- Item #280 (release v0.2.3.7) — DB trigger on patient_shares.INSERT calls
-- Edge Function patient-share-handler via pg_net to dispatch FCM notification
-- to new caregiver.

CREATE OR REPLACE FUNCTION medcontrol.notify_patient_share_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'medcontrol', 'public'
AS $$
DECLARE
  v_edge_url text := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/patient-share-handler';
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'patient_shares',
    'schema', 'medcontrol',
    'record', jsonb_build_object(
      'patientId', NEW."patientId",
      'ownerId', NEW."ownerId",
      'sharedWithUserId', NEW."sharedWithUserId"
    )
  );

  PERFORM net.http_post(
    url := v_edge_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_patient_share] error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_patient_share_inserted ON medcontrol.patient_shares;
CREATE TRIGGER trg_notify_patient_share_inserted
AFTER INSERT ON medcontrol.patient_shares
FOR EACH ROW
EXECUTE FUNCTION medcontrol.notify_patient_share_inserted();
