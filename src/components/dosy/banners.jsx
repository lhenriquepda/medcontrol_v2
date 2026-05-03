/**
 * Dosy primitives — AdBanner, UpdateBanner
 * Source design: contexto/claude-design/dosy/project/src/Primitives.jsx
 */
import { Image as ImageIcon, X, Sparkles } from 'lucide-react'

/* ── AdBanner — Free tier ad placeholder com estética dashed warm ─────── */
export function AdBanner({
  onClick,
  onClose,
  label = 'Anúncio',
  hint = 'Sem ads no Plus',
  className = '',
  style,
}) {
  return (
    <div
      onClick={onClick}
      className={`dosy-press ${className}`}
      style={{
        margin: '6px 22px 0',
        padding: '12px 14px',
        background: 'var(--dosy-bg-sunken)',
        borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: onClick ? 'pointer' : 'default',
        border: '1px dashed var(--dosy-border-strong)',
        ...style,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: 'rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--dosy-fg-tertiary)',
      }}>
        <ImageIcon size={20} strokeWidth={1.75}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--dosy-fg-tertiary)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          fontFamily: 'var(--dosy-font-display)',
        }}>{label}</div>
        <div style={{
          fontSize: 12.5, color: 'var(--dosy-fg-secondary)',
          fontWeight: 500, marginTop: 2,
        }}>{hint}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose() }}
          aria-label="Fechar"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--dosy-fg-tertiary)', display: 'flex',
            padding: 2,
          }}
        >
          <X size={14} strokeWidth={1.75}/>
        </button>
      )}
    </div>
  )
}

/* ── UpdateBanner — pill com sunset-soft bg + CTA atualizar ──────────── */
export function UpdateBanner({
  message = 'Nova versão disponível',
  onUpdate,
  onDismiss,
  ctaLabel = 'Atualizar',
  className = '',
  style,
}) {
  return (
    <div className={className} style={{
      margin: '0 22px 10px',
      padding: '10px 14px',
      background: 'var(--dosy-gradient-sunset-soft)',
      borderRadius: 14,
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 13, fontWeight: 600,
      color: 'var(--dosy-fg)',
      fontFamily: 'var(--dosy-font-body)',
      ...style,
    }}>
      <Sparkles size={16} strokeWidth={1.75}/>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onUpdate}
        style={{
          border: 'none',
          background: 'var(--dosy-fg)',
          color: 'var(--dosy-bg)',
          fontSize: 12, fontWeight: 700,
          padding: '5px 12px',
          borderRadius: 9999,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {ctaLabel}
      </button>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--dosy-fg-secondary)',
            padding: 2,
          }}
        >
          <X size={14} strokeWidth={1.75}/>
        </button>
      )}
    </div>
  )
}
