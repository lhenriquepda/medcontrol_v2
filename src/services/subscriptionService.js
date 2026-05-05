import { hasSupabase, supabase } from './supabase'

export const FREE_PATIENT_LIMIT = 1

export async function getMyTier() {
  if (!hasSupabase) return 'pro' // modo demo libera tudo

  // #144 (v0.2.0.11) — Lê tier do JWT claim (server-injected via Auth Hook
  // `auth_hooks.add_tier_to_jwt`). Local, zero round-trip.
  // getSession() ler localStorage (sem network).
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null

  // app_metadata é server-trusted (user não pode forjar). Hook seta em cada
  // emit/refresh JWT — tier sempre fresh per session (max stale = JWT exp).
  const claimTier = user.app_metadata?.tier
  if (claimTier) return claimTier

  // Fallback: legacy session sem hook (pré-#144 deploy). Rpc 1× + força refresh.
  // Após refresh, próximos getMyTier() leem do claim direto.
  const { data, error } = await supabase.rpc('my_tier')
  if (error) throw error
  // Trigger JWT refresh pra próxima session ter claim. Não-bloqueante.
  supabase.auth.refreshSession().catch(() => {})
  return data || 'free'
}

/**
 * #144 — força refresh JWT após admin grantTier (próprio user) pra que
 * a UI reflita o novo tier sem logout. Cross-user (admin grant em outro
 * user) requer logout/login do user impactado — aceitável, raro.
 */
export async function refreshSelfTier() {
  if (!hasSupabase) return
  await supabase.auth.refreshSession()
}

export async function listAllUsers() {
  if (!hasSupabase) return []
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw error
  // Item #119 (release v0.2.0.3): promo `free → plus` removida (ver getMyTier).
  // Admin agora vê tier real. Free fica free.
  return data || []
}

export async function grantTier({ userId, tier, expiresAt = null, source = 'admin_panel' }) {
  if (!hasSupabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase.rpc('admin_grant_tier', {
    target_user: userId,
    new_tier: tier,
    expires: expiresAt,
    src: source
  })
  if (error) throw error
  return data
}
