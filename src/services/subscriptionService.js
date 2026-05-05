import { hasSupabase, supabase } from './supabase'

export const FREE_PATIENT_LIMIT = 1

export async function getMyTier() {
  if (!hasSupabase) return 'pro' // modo demo libera tudo

  // #144 (v0.2.0.11) ROLLBACK: Hook integration causou logout cascade em prod.
  // Hook `auth_hooks.add_tier_to_jwt` continua deployed (migration aplicada)
  // mas Dashboard hook DISABLED. Frontend volta ao path simples via rpc.
  // Re-tentar integração hook em release futura após investigar root cause.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null

  // Tenta claim primeiro (no-op enquanto hook desativado, mas OK pra futuro).
  const claimTier = user.app_metadata?.tier
  if (claimTier) return claimTier

  // Path padrão atual: rpc('my_tier').
  const { data, error } = await supabase.rpc('my_tier')
  if (error) throw error
  return data || 'free'
}

/**
 * #144 — força refresh JWT (placeholder noop até re-ativar hook).
 * Mantido API pública pra useGrantTier não quebrar.
 */
export async function refreshSelfTier() {
  if (!hasSupabase) return
  // Re-ativar quando hook funcionar:
  // await supabase.auth.refreshSession()
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
