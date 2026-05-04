import { hasSupabase, supabase } from './supabase'

export const FREE_PATIENT_LIMIT = 1

export async function getMyTier() {
  if (!hasSupabase) return 'pro' // modo demo libera tudo
  // Skip query se user não autenticado (evita ad persistir na Login screen)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase.rpc('my_tier')
  if (error) throw error
  // Item #119 (release v0.2.0.3): promo `free → plus` removida.
  // Antes (v0.1.7.x): durante beta interno, todos free viravam plus pra
  // bypass paywall. Agora paywall ativo pra testes reais (teste-free
  // valida flows). Reais (lhenrique pda admin, daffiny + ela.almeida pro)
  // não afetados — tier vem direto do DB via RPC my_tier.
  return data || 'free'
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
