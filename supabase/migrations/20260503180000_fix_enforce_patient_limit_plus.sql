-- Item #094 BUG-027 (release v0.1.7.5) — fix trigger enforce_patient_limit
-- whitelist incompleto.
--
-- Bug reportado user 2026-05-03 em validação dosy-dev: teste03@teste
-- (tier plus em DB via beta_promo) tentou cadastrar 2º paciente. Frontend
-- recebeu 400 Bad Request "PLANO_FREE_LIMITE_PACIENTES" + paywall.
--
-- Causa raiz: trigger BEFORE INSERT em medcontrol.patients tinha whitelist
-- apenas ('pro', 'admin'). Tier 'plus' (beta promo) caía no else branch
-- e disparava check de limite free.
--
-- Tier model documentado em src/hooks/useSubscription.js:
--   free  — limite 1 paciente, ads
--   plus  — features ilimitadas (= pro), MAS continua com ads
--   pro   — features ilimitadas, sem ads
--   admin — pro + acesso painel admin
--
-- Fix: adicionar 'plus' ao whitelist do trigger. Plus tier passa a ter
-- pacientes ilimitados igual pro/admin.
--
-- Função recriada CREATE OR REPLACE — trigger reusa.

CREATE OR REPLACE FUNCTION medcontrol.enforce_patient_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'medcontrol', 'auth', 'public'
AS $function$
declare
  current_tier text;
  current_count int;
begin
  current_tier := medcontrol.effective_tier(new."userId");
  -- #094 fix: 'plus' adicionado ao whitelist (antes só 'pro', 'admin')
  if current_tier in ('plus', 'pro', 'admin') then return new; end if;

  select count(*) into current_count from medcontrol.patients where "userId" = new."userId";
  if current_count >= 1 then
    raise exception 'PLANO_FREE_LIMITE_PACIENTES: No plano grátis você pode ter apenas 1 paciente. Assine PRO para adicionar mais.';
  end if;
  return new;
end $function$;
