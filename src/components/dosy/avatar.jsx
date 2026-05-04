/**
 * Dosy primitives — Avatar, PillIcon
 * Source design: contexto/claude-design/dosy/project/src/Primitives.jsx
 */
import { Pill } from 'lucide-react'

const AVATAR_PALETTES = {
  sunset: { background: 'var(--dosy-gradient-sunset)', color: 'var(--dosy-fg-on-sunset)', shadow: '0 6px 14px -4px rgba(255,61,127,0.32)' },
  peach:  { background: 'var(--dosy-peach-200)', color: 'var(--dosy-fg)' },
  rose:   { background: '#FFD0DC', color: 'var(--dosy-fg)' },
  tan:    { background: '#F5E2D8', color: 'var(--dosy-fg)' },
  mint:   { background: '#D6EFE5', color: '#3F9E7E' },
  soft:   { background: 'var(--dosy-peach-100)', color: 'var(--dosy-fg)' },
}

/* ── Avatar ────────────────────────────────────────────────────────────
 * Emoji ou inicial. color: sunset (default) | peach | rose | tan | mint | soft
 */
export function Avatar({
  name,
  emoji,
  size = 44,
  color = 'sunset',
  className = '',
  style,
}) {
  const palette = AVATAR_PALETTES[color] || AVATAR_PALETTES.sunset
  const initial = name ? name.trim()[0]?.toUpperCase() : ''
  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: 9999,
        background: palette.background,
        color: palette.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--dosy-font-display)',
        fontSize: emoji ? size * 0.55 : size * 0.36,
        fontWeight: 800, letterSpacing: '-0.02em',
        boxShadow: palette.shadow || 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {emoji || initial}
    </div>
  )
}

/* ── PillIcon ──────────────────────────────────────────────────────────
 * Capsule colored bg + line icon (pra leading slot de DoseRow)
 * color: peach-100 (default) | peach-200 | peach-300 | tan | soft-rose | mint
 * icon: lucide-react component (default Pill)
 */
const PILL_ICON_BG = {
  'peach-100': '#FFE5D6',
  'peach-200': '#FFD4C2',
  'peach-300': '#FFB99B',
  'tan':       '#F5E2D8',
  'soft-rose': '#FFD0DC',
  'mint':      '#D6EFE5',
}

export function PillIcon({
  color = 'peach-100',
  icon: IconCmp = Pill,
  size = 44,
  className = '',
  style,
}) {
  const background = PILL_ICON_BG[color] || PILL_ICON_BG['peach-100']
  return (
    <div className={className} style={{
      width: size, height: size, borderRadius: 14,
      background,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      color: 'var(--dosy-fg)',
      ...style,
    }}>
      <IconCmp size={size > 40 ? 22 : 18} strokeWidth={1.75}/>
    </div>
  )
}
