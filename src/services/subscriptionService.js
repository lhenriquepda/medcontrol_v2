import { hasSupabase, supabase } from './supabase'

export const FREE_PATIENT_LIMIT = 1

export async function getMyTier() {
  if (!hasSupabase) return 'pro' // modo demo libera tudo
  const { data, error } = await supabase.rpc('my_tier')
  if (error) throw error
  return data || 'free'
}

export async function listAllUsers() {
  if (!hasSupabase) return []
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw error
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
