ALTER TABLE medcontrol.subscriptions
  ADD COLUMN IF NOT EXISTS "testerGrade" text DEFAULT 'none' CHECK ("testerGrade" IN ('none', 'tester', 'power', 'champion')),
  ADD COLUMN IF NOT EXISTS "testerNotes" text DEFAULT NULL;

COMMENT ON COLUMN medcontrol.subscriptions."testerGrade" IS 'Classificação manual do tester: none | tester | power | champion';
COMMENT ON COLUMN medcontrol.subscriptions."testerNotes" IS 'Notas livres sobre o tester (bugs, reviews, contribuições)';

DROP FUNCTION IF EXISTS medcontrol.admin_list_users();

CREATE FUNCTION medcontrol.admin_list_users()
RETURNS TABLE (
  "userId" uuid,
  email text,
  name text,
  "createdAt" timestamptz,
  tier text,
  "expiresAt" timestamptz,
  source text,
  "effectiveTier" text,
  "patientsCount" bigint,
  "treatmentsCount" bigint,
  "testerGrade" text,
  "testerNotes" text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, medcontrol, pg_catalog
AS $$
BEGIN
  IF NOT medcontrol.is_admin() THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: apenas admin';
  END IF;

  RETURN QUERY
  SELECT
    s."userId",
    u.email::text,
    COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', '') AS name,
    u.created_at AS "createdAt",
    s.tier,
    s."expiresAt",
    s.source,
    medcontrol.effective_tier(s."userId") AS "effectiveTier",
    COALESCE((SELECT COUNT(*) FROM medcontrol.patients p WHERE p."userId" = s."userId"), 0) AS "patientsCount",
    COALESCE((SELECT COUNT(*) FROM medcontrol.treatments t WHERE t."userId" = s."userId"), 0) AS "treatmentsCount",
    s."testerGrade",
    s."testerNotes"
  FROM medcontrol.subscriptions s
  LEFT JOIN auth.users u ON u.id = s."userId"
  ORDER BY u.created_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION medcontrol.admin_set_tester_grade(
  target_user uuid,
  new_grade text,
  notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, medcontrol, pg_catalog
AS $$
DECLARE
  v_old_grade text;
BEGIN
  IF NOT medcontrol.is_admin() THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: apenas admin';
  END IF;

  IF new_grade NOT IN ('none', 'tester', 'power', 'champion') THEN
    RAISE EXCEPTION 'GRADE_INVALIDO: %', new_grade;
  END IF;

  SELECT "testerGrade" INTO v_old_grade FROM medcontrol.subscriptions WHERE "userId" = target_user;

  INSERT INTO medcontrol.subscriptions ("userId", tier, "testerGrade", "testerNotes")
  VALUES (target_user, 'free', new_grade, notes)
  ON CONFLICT ("userId") DO UPDATE
  SET "testerGrade" = EXCLUDED."testerGrade",
      "testerNotes" = COALESCE(EXCLUDED."testerNotes", medcontrol.subscriptions."testerNotes"),
      "updatedAt" = now();

  RETURN jsonb_build_object(
    'ok', true,
    'userId', target_user,
    'oldGrade', COALESCE(v_old_grade, 'none'),
    'newGrade', new_grade
  );
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.admin_set_tester_grade(uuid, text, text) TO authenticated;
