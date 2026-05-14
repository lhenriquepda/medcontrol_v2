-- #144 (release v0.2.0.11) — Custom Access Token Hook injeta tier em JWT claims.
-- Frontend useMyTier passa a ler session.user.app_metadata.tier (local, sem round-trip).
-- Elimina top vector egress: rpc('my_tier') call em todo mount + every 30min staleTime.
--
-- Spec Supabase Auth Hook (Custom Access Token):
--   event: { user_id uuid, claims jsonb, authentication_method text }
--   return: { claims jsonb } com claims merged
--
-- Hook ATIVA via Supabase Dashboard → Auth → Hooks → Custom Access Token Hook
-- (manual — não tem Management API endpoint pra setar hook).

CREATE SCHEMA IF NOT EXISTS auth_hooks;

GRANT USAGE ON SCHEMA auth_hooks TO supabase_auth_admin;
GRANT USAGE ON SCHEMA medcontrol TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION auth_hooks.add_tier_to_jwt(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid;
  user_tier text;
  claims jsonb;
BEGIN
  uid := (event ->> 'user_id')::uuid;
  claims := COALESCE(event -> 'claims', '{}'::jsonb);

  -- effective_tier resolve admins + subscriptions com fallback 'free'.
  -- Se erro (uid null, table missing) cai em 'free' silencioso — JWT nunca falha emit.
  BEGIN
    SELECT medcontrol.effective_tier(uid) INTO user_tier;
  EXCEPTION WHEN OTHERS THEN
    user_tier := 'free';
  END;

  user_tier := COALESCE(user_tier, 'free');

  -- Inject em app_metadata (server-trusted, user não pode forjar).
  -- Padrão: merge dentro de app_metadata existente.
  claims := jsonb_set(
    claims,
    '{app_metadata}',
    COALESCE(claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object('tier', user_tier),
    true
  );

  RETURN jsonb_build_object('claims', claims);
END;
$$;

-- Grant exec pro Auth runtime
GRANT EXECUTE ON FUNCTION auth_hooks.add_tier_to_jwt(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION auth_hooks.add_tier_to_jwt(jsonb) FROM authenticated, anon, public;

-- Permissão pro hook acessar effective_tier (já SECURITY DEFINER, mas garantir EXECUTE)
GRANT EXECUTE ON FUNCTION medcontrol.effective_tier(uuid) TO supabase_auth_admin;

COMMENT ON FUNCTION auth_hooks.add_tier_to_jwt(jsonb) IS
'#144 v0.2.0.11 Custom Access Token Hook — injeta tier em claims.app_metadata.tier. Elimina round-trip rpc(my_tier).';
