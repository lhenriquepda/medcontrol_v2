/**
 * Display name helper.
 * Priority: user_metadata.name → name → email local-part → 'Usuário'
 */
export function displayName(user) {
  if (!user) return 'Usuário'
  const meta = user.user_metadata || {}
  return (
    meta.name ||
    user.name ||
    (user.email ? user.email.split('@')[0] : null) ||
    'Usuário'
  )
}

export function firstName(user) {
  return String(displayName(user)).split(' ')[0]
}

export function initial(user) {
  return String(displayName(user)).charAt(0).toUpperCase()
}
