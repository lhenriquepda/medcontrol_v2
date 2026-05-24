-- v0.2.6.8 FIX MEL-007 — Reset idempotente das contas teste antes de QA.
--
-- Limpa todas doses/treatments/patient_shares/patients das 3 contas teste-*
-- pra que QA encontre estado canônico em cada run. Sem isso QA acumula dados
-- de runs anteriores (Free com 5 patientes históricos, Plus com shares
-- legacy etc) que confundem assertions.
--
-- USO:
--   psql -h <supabase-host> -U postgres -d postgres -f reset-test-data.sql
-- ou via Supabase MCP / SQL editor.
--
-- NÃO RODAR EM PROD com user real. Só toca em emails @teste.com.

DO $$
DECLARE
  v_user_ids uuid[];
  v_plus_id uuid;
  v_pro_id uuid;
BEGIN
  -- Coleta IDs das contas teste-*@teste.com
  SELECT ARRAY_AGG(id) INTO v_user_ids
  FROM auth.users
  WHERE email IN ('teste-free@teste.com', 'teste-plus@teste.com', 'teste-pro@teste.com');

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RAISE NOTICE 'Nenhuma conta teste-* encontrada. Skip.';
    RETURN;
  END IF;

  RAISE NOTICE 'Reset dados de % contas teste-*', array_length(v_user_ids, 1);

  -- ORDER MATTERS — FKs cascateiam
  DELETE FROM medcontrol.doses             WHERE "userId"  = ANY(v_user_ids);
  DELETE FROM medcontrol.treatments        WHERE "userId"  = ANY(v_user_ids);
  DELETE FROM medcontrol.patient_shares    WHERE "ownerId" = ANY(v_user_ids)
                                              OR "userId"  = ANY(v_user_ids);
  DELETE FROM medcontrol.patients          WHERE "userId"  = ANY(v_user_ids);
  -- shadowed analytics state (per-user)
  DELETE FROM medcontrol.user_settings     WHERE "userId"  = ANY(v_user_ids);

  -- Re-cria dados canônicos pra cada conta
  SELECT id INTO v_plus_id FROM auth.users WHERE email = 'teste-plus@teste.com';
  SELECT id INTO v_pro_id  FROM auth.users WHERE email = 'teste-pro@teste.com';

  IF v_plus_id IS NOT NULL THEN
    INSERT INTO medcontrol.patients ("userId", name, avatar, age, condition)
    VALUES (v_plus_id, 'Paciente QA Plus', '🙂', 30, 'Hipertensão')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_pro_id IS NOT NULL THEN
    INSERT INTO medcontrol.patients ("userId", name, avatar, age, condition)
    VALUES (v_pro_id, 'Paciente QA Pro', '🙋', 45, 'Diabetes')
    ON CONFLICT DO NOTHING;
  END IF;

  -- teste-free NÃO recebe paciente seed — Mod 02.1 espera 0 patientes
  -- pra testar empty state + cadastro.

  RAISE NOTICE 'Reset OK — estado canônico restaurado';
END;
$$;

-- Verificação pós-reset
SELECT
  u.email,
  (SELECT COUNT(*) FROM medcontrol.patients p WHERE p."userId" = u.id) AS patients,
  (SELECT COUNT(*) FROM medcontrol.treatments t WHERE t."userId" = u.id) AS treatments,
  (SELECT COUNT(*) FROM medcontrol.doses d WHERE d."userId" = u.id) AS doses,
  (SELECT COUNT(*) FROM medcontrol.patient_shares s WHERE s."ownerId" = u.id) AS shares_owned
FROM auth.users u
WHERE u.email IN ('teste-free@teste.com', 'teste-plus@teste.com', 'teste-pro@teste.com')
ORDER BY u.email;
