/**
 * HeaderAlertIcon — single direct-action icon button for AppHeader.
 *
 * Item #116 (release v0.2.0.3): substitui BellAlerts dropdown.
 * Antes: 1 sino → click → expande lista de alertas → user clica item.
 * Agora: cada tipo de alerta = ícone próprio no header → click direto
 * dispara ação (sem dropdown intermediário). Padrão WhatsApp/Gmail —
 * badge com contagem, glance imediato, 1 tap pra ação.
 *
 * Props:
 *   icon:       lucide-react component (ex: AlertCircle, Download)
 *   count:      número no badge (omitir → dot puro sem número)
 *   tone:       'danger' | 'warning' | 'info' | 'update' (controla cor)
 *   onClick:    handler (obrigatório — sem onClick não renderiza)
 *   ariaLabel:  rótulo a11y (obrigatório)
 *   pulse:      anima badge (opcional, urgência alta)
 */
const TONE_STYLES = {
  danger: {
    bg: 'var(--dosy-danger-bg)',
    fg: 'var(--dosy-danger)',
    badge: 'var(--dosy-danger)',
  },
  warning: {
    bg: 'color-mix(in oklab, #C5841A 16%, var(--dosy-bg-elevated))',
    fg: '#C5841A',
    badge: '#C5841A',
  },
  info: {
    bg: 'color-mix(in oklab, var(--dosy-info) 16%, var(--dosy-bg-elevated))',
    fg: 'var(--dosy-info)',
    badge: 'var(--dosy-info)',
  },
  update: {
    bg: 'color-mix(in oklab, var(--dosy-primary) 16%, var(--dosy-bg-elevated))',
    fg: 'var(--dosy-primary)',
    badge: 'var(--dosy-primary)',
  },
}

export default function HeaderAlertIcon({
  icon: IconCmp,
  count,
  tone = 'danger',
  onClick,
  ariaLabel,
  pulse = false,
  className = '',
  style,
}) {
  const palette = TONE_STYLES[tone] || TONE_STYLES.danger
  const showBadge = count !== undefined && count !== null
  const badgeText = count > 9 ? '9+' : String(count)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`dosy-press ${className}`}
      style={{
        position: 'relative',
        width: 38, height: 38, borderRadius: 9999,
        border: 'none', cursor: 'pointer', flexShrink: 0,
        background: palette.bg,
        color: palette.fg,
        boxShadow: 'var(--dosy-shadow-sm)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      <IconCmp size={18} strokeWidth={1.75}/>
      {showBadge && (
        <span
          style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 9999,
            background: palette.badge,
            color: 'var(--dosy-fg-on-sunset)',
            fontSize: 10.5, fontWeight: 800, letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--dosy-font-display)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px var(--dosy-bg)',
            lineHeight: 1,
            animation: pulse ? 'dosy-pulse 1.6s ease-in-out infinite' : undefined,
          }}
        >{badgeText}</span>
      )}
    </button>
  )
}
