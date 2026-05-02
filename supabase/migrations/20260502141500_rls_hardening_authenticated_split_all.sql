-- Items #012 + #013 (release v0.1.7.4) — RLS hardening defense-in-depth.
--
-- #012: Trocar role 'public' → 'authenticated' em todas policies de medcontrol.
--      Defesa-em-profundidade: anon (não-autenticado) precisa falhar policy
--      check ALÉM de RLS. Postgres anon role bypassa public-target policies
--      em certas combinações; ser explícito 'authenticated' garante que apenas
--      JWT verificado conta. Auditoria 4.5.2 G2 (P1).
--
-- #013: Splitar policies cmd=ALL em SELECT/INSERT/UPDATE/DELETE separadas.
--      Granularidade pra audit + permite policies diferenciadas no futuro
--      sem refatorar. Auditoria 4.5.2 G9 (P1).
--
-- Scope: 34 policies em medcontrol (antes da migration), 5 com cmd=ALL.
-- Após migration: ~49 policies, todas TO authenticated, todas single-cmd.
--
-- Idempotente: DROP IF EXISTS + CREATE; ALTER POLICY no-op se já authenticated.

BEGIN;

-- ─── PARTE 1: ALTER non-ALL policies pra authenticated ──────────────────────
-- Itera dynamicamente todas non-ALL policies em medcontrol que ainda têm 'public'
-- nos roles. Postgres ALTER POLICY ... TO permite trocar role sem mexer qual/check.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'medcontrol'
      AND 'public' = ANY(roles)
      AND cmd != 'ALL'
  LOOP
    EXECUTE format('ALTER POLICY %I ON medcontrol.%I TO authenticated',
      pol.policyname, pol.tablename);
    RAISE NOTICE '[#012] altered: %.%', pol.tablename, pol.policyname;
  END LOOP;
END $$;

-- ─── PARTE 2: Splitar cmd=ALL ───────────────────────────────────────────────
-- 5 policies cmd=ALL identificadas em audit 2026-05-02:
--   1. subscriptions.sub_admin_all          (qual=is_admin())
--   2. push_subscriptions.push_own_all      (qual=auth.uid()="userId")
--   3. security_events.security_events_admin_all (qual=is_admin(), check=NULL)
--   4. user_prefs.user_prefs_own            (qual=user_id=auth.uid())
--   5. dose_alarms_scheduled."user manages own alarms" (já authenticated)

-- 1. subscriptions
DROP POLICY IF EXISTS sub_admin_all ON medcontrol.subscriptions;
CREATE POLICY sub_admin_select ON medcontrol.subscriptions
  FOR SELECT TO authenticated USING (medcontrol.is_admin());
CREATE POLICY sub_admin_insert ON medcontrol.subscriptions
  FOR INSERT TO authenticated WITH CHECK (medcontrol.is_admin());
CREATE POLICY sub_admin_update ON medcontrol.subscriptions
  FOR UPDATE TO authenticated
  USING (medcontrol.is_admin())
  WITH CHECK (medcontrol.is_admin());
CREATE POLICY sub_admin_delete ON medcontrol.subscriptions
  FOR DELETE TO authenticated USING (medcontrol.is_admin());

-- 2. push_subscriptions
DROP POLICY IF EXISTS push_own_all ON medcontrol.push_subscriptions;
CREATE POLICY push_own_select ON medcontrol.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = "userId");
CREATE POLICY push_own_insert ON medcontrol.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = "userId");
CREATE POLICY push_own_update ON medcontrol.push_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");
CREATE POLICY push_own_delete ON medcontrol.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = "userId");

-- 3. security_events
-- Original tinha qual=is_admin(), with_check=NULL. Pra INSERT manter sem
-- check (admin escreve events de qualquer userId). Mas split obriga
-- INSERT ter with_check explícito; usamos is_admin() pra safety.
DROP POLICY IF EXISTS security_events_admin_all ON medcontrol.security_events;
CREATE POLICY security_events_admin_select ON medcontrol.security_events
  FOR SELECT TO authenticated USING (medcontrol.is_admin());
CREATE POLICY security_events_admin_insert ON medcontrol.security_events
  FOR INSERT TO authenticated WITH CHECK (medcontrol.is_admin());
CREATE POLICY security_events_admin_update ON medcontrol.security_events
  FOR UPDATE TO authenticated
  USING (medcontrol.is_admin())
  WITH CHECK (medcontrol.is_admin());
CREATE POLICY security_events_admin_delete ON medcontrol.security_events
  FOR DELETE TO authenticated USING (medcontrol.is_admin());

-- 4. user_prefs
DROP POLICY IF EXISTS user_prefs_own ON medcontrol.user_prefs;
CREATE POLICY user_prefs_own_select ON medcontrol.user_prefs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_prefs_own_insert ON medcontrol.user_prefs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY user_prefs_own_update ON medcontrol.user_prefs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY user_prefs_own_delete ON medcontrol.user_prefs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5. dose_alarms_scheduled
-- "user reads own alarms" (cmd=SELECT) pré-existente e cobre SELECT.
-- "user manages own alarms" (cmd=ALL) cobria SELECT+INSERT+UPDATE+DELETE.
-- Drop e recria apenas INSERT+UPDATE+DELETE pra evitar overlap com SELECT
-- já existente.
DROP POLICY IF EXISTS "user manages own alarms" ON medcontrol.dose_alarms_scheduled;
CREATE POLICY "user manages own alarms insert" ON medcontrol.dose_alarms_scheduled
  FOR INSERT TO authenticated WITH CHECK ("userId" = auth.uid());
CREATE POLICY "user manages own alarms update" ON medcontrol.dose_alarms_scheduled
  FOR UPDATE TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());
CREATE POLICY "user manages own alarms delete" ON medcontrol.dose_alarms_scheduled
  FOR DELETE TO authenticated USING ("userId" = auth.uid());

COMMIT;

-- Validação manual pós-apply:
--   SELECT tablename, COUNT(*) FILTER (WHERE 'public' = ANY(roles)) AS public_count,
--                     COUNT(*) FILTER (WHERE 'authenticated' = ANY(roles)) AS auth_count,
--                     COUNT(*) FILTER (WHERE cmd = 'ALL') AS all_count
--   FROM pg_policies WHERE schemaname='medcontrol' GROUP BY tablename ORDER BY tablename;
--   -- Esperado: public_count=0, all_count=0 em todas tables.
