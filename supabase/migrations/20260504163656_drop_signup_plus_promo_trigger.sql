-- Item #119-followup (release v0.2.0.4): finaliza remoção promo `free → plus`.
-- Antes: trigger on_auth_user_signup_plus chamava handle_new_user_plus_promo
-- que inseria tier='plus' source='beta_promo' pra TODO novo signup. Promo
-- beta server-side, complementar à promo client (já removida em #119).
-- Resultado: novos signups continuavam plus mesmo com client mostrando paywall.
-- Drop trigger + função fecha promo end-to-end. Novos signups: tier='free'
-- (default sem row em subscriptions). Side-effect bom: resolve #032 (função
-- SECURITY DEFINER sem search_path SET).

DROP TRIGGER IF EXISTS on_auth_user_signup_plus ON auth.users;
DROP FUNCTION IF EXISTS medcontrol.handle_new_user_plus_promo();
