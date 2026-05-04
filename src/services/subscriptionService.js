import { hasSupabase, supabase } from './supabase'

export const FREE_PATIENT_LIMIT = 1

export async function getMyTier() {
  if (!hasSupabase) return 'pro' // modo demo libera tudo
  // Skip query se user não autenticado (evita ad persistir na Login screen)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase.rpc('my_tier')
  if (error) throw error
  // PROMO TEMPORÁRIA: durante beta/teste interno, todos free → plus.
  // Mantém pro/admin/plus como estão. Remover quando assinatura lançar.
  const tier = data || 'free'
  return tier === 'free' ? 'plus' : tier
}

export async function listAllUsers() {
  if (!hasSupabase) return []
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw error
  // Item #096 BUG-028: aplica mesma promo `free → plus` que getMyTier aplica
  // pro client logado. Sem isso, Admin panel mostra users como "free" mas
  // app deles trata como "plus" (inconsistência tier display).
  // Remover quando assinatura lançar e promo for desativada.
  return (data || []).map((u) => ({
    ...u,
    effectiveTier: u.effectiveTier === 'free' ? 'plus' : u.effectiveTier,
  }))
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
