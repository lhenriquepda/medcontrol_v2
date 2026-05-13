-- Item #209 v0.2.1.9 Bug 2 data-fix retry — renomear variável conflito alias

ALTER TABLE medcontrol.doses DISABLE TRIGGER dose_change_notify;

DO $$
DECLARE
  rec RECORD;
  v_patch jsonb;
  v_regenerated int := 0;
  v_first_dose_time text;
BEGIN
  FOR rec IN
    SELECT DISTINCT tr.id AS treatment_id, tr."userId" AS user_id, tr."firstDoseTime" AS fdt
    FROM medcontrol.treatments tr
    WHERE tr.status = 'active'
      AND tr."isTemplate" = false
      AND EXISTS (
        SELECT 1 FROM medcontrol.doses d
        WHERE d."treatmentId" = tr.id
          AND d.status IN ('pending', 'overdue')
          AND d."scheduledAt" > NOW()
      )
  LOOP
    v_patch := jsonb_build_object('firstDoseTime', rec.fdt);
    PERFORM set_config('request.jwt.claim.sub', rec.user_id::text, true);

    BEGIN
      PERFORM medcontrol.update_treatment_schedule(rec.treatment_id, v_patch, 'America/Sao_Paulo');
      v_regenerated := v_regenerated + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Skip treatment %: %', rec.treatment_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Regenerated % treatments', v_regenerated;
END $$;

ALTER TABLE medcontrol.doses ENABLE TRIGGER dose_change_notify;
