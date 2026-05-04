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

/**
 * Item #122 (release v0.2.0.3): nome compacto pro header.
 * Antes: firstName retornava só "Teste" pra "Teste Free" — perdia identidade.
 * Agora: retorna primeira + segunda palavra se ambas curtas (≤6 chars cada),
 * senão só primeira. Mantém leve no header mas preserva nome composto curto
 * tipo "Teste Free", "Plus Beta", "User Demo".
 *   "Luiz Henrique"  → "Luiz" (Henrique tem 8 chars > 6)
 *   "Teste Free"     → "Teste Free"
 *   "Daffiny"        → "Daffiny"
 *   "ELAINE PINTO"   → "Elaine" (capitalize via CSS no header)
 */
export function shortName(user) {
  const full = String(displayName(user))
  const parts = full.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return full
  const first = parts[0]
  const second = parts[1] || ''
  if (first.length <= 6 && second.length > 0 && second.length <= 6) {
    return `${first} ${second}`
  }
  return first
}

export function initial(user) {
  return String(displayName(user)).charAt(0).toUpperCase()
}
