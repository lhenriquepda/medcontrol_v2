/**
 * Dosy primitives — Card, Sheet (bottom), Modal (centered), SectionTitle
 * Source design: contexto/claude-design/dosy/project/src/Primitives.jsx
 *
 * Sheet/Modal: glass effect (Apple liquid glass) padrão.
 * backdrop-filter blur 36px saturate 180%, gradient translucent warm.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/* ── Card ──────────────────────────────────────────────────────────────
 * variants: gradient (sunset destacado) | muted (sunset-muted discreto) | soft (sunset-soft pastel) | elevated (default)
 * v0.2.3.5 #244 — muted: warm tint sutil, adapta light/dark, texto fg-primary legível.
 */
export function Card({
  children,
  padding = 18,
  gradient,
  muted,
  soft,
  onClick,
  className = '',
  style,
  ...rest
}) {
  const background = gradient
    ? 'var(--dosy-gradient-sunset)'
    : muted
    ? 'var(--dosy-gradient-sunset-muted)'
    : soft
    ? 'var(--dosy-gradient-sunset-soft)'
    : 'var(--dosy-bg-elevated)'
  const color = gradient ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-fg)'
  const boxShadow = gradient
    ? '0 16px 36px -10px rgba(255,61,127,0.4), 0 6px 14px -6px rgba(255,107,91,0.24)'
    : muted
    ? '0 8px 20px -8px rgba(255,107,91,0.18), var(--dosy-shadow-sm)'
    : 'var(--dosy-shadow-md)'
  return (
    <div
      onClick={onClick}
      className={`${onClick ? 'dosy-press' : ''} ${className}`}
      style={{
        background, color,
        borderRadius: 24,
        padding,
        boxShadow,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

/* ── SectionTitle — uppercase secondary label + optional action slot ───── */
export function SectionTitle({ children, action, style, className = '' }) {
  return (
    <div className={className} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 22px 10px',
      ...style,
    }}>
      <div style={{
        fontFamily: 'var(--dosy-font-display)',
        fontWeight: 700, fontSize: 15,
        letterSpacing: '0.02em', textTransform: 'uppercase',
        color: 'var(--dosy-fg-secondary)',
      }}>
        {children}
      </div>
      {action}
    </div>
  )
}

/* ── Sheet — bottom sheet com glass effect (Apple liquid glass) ──────── */
export function Sheet({
  open,
  onClose,
  children,
  title,
  full,
  padding = '14px 22px 26px',
  closeOnOverlay = true,
  glass = true,
  zIndex = 50,
  className = '',
  style,
}) {
  // Lock body scroll when sheet open
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Item #121 (release v0.2.0.3): Escape fecha o sheet/modal.
  // Antes: nenhum keydown listener → keyboard a11y quebrada.
  useEffect(() => {
    if (!open || !onClose) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const glassPanel = glass ? {
    background: 'linear-gradient(180deg, color-mix(in oklab, var(--dosy-bg-elevated) 88%, transparent) 0%, color-mix(in oklab, var(--dosy-bg) 82%, transparent) 100%)',
    backdropFilter: 'blur(36px) saturate(180%)',
    WebkitBackdropFilter: 'blur(36px) saturate(180%)',
    boxShadow: [
      'inset 0 1px 0 color-mix(in oklab, var(--dosy-fg-on-sunset, #fff) 35%, transparent)',
      'inset 0 0 0 1px var(--dosy-border)',
      '0 -24px 60px -16px rgba(0,0,0,0.45)',
    ].join(', '),
  } : {
    background: 'var(--dosy-bg)',
    boxShadow: '0 -20px 40px -12px rgba(74,36,16,0.18)',
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={closeOnOverlay ? onClose : undefined}
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--dosy-bg-overlay)',
          animation: 'dosy-fade-in 220ms var(--dosy-ease-out) both',
        }}
      />
      <div
        className={`dosy-scroll ${className}`}
        style={{
          position: 'relative',
          borderRadius: '32px 32px 0 0',
          padding,
          animation: 'dosy-slide-up 350ms var(--dosy-ease-out) both',
          maxHeight: full ? '92%' : '82%',
          overflow: 'auto',
          fontFamily: 'var(--dosy-font-body)',
          color: 'var(--dosy-fg)',
          ...glassPanel,
          ...style,
        }}
      >
        <div style={{
          width: 40, height: 5, borderRadius: 9999,
          background: 'var(--dosy-border-strong)',
          margin: '0 auto 16px',
        }}/>
        {title && (
          <div style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 800, fontSize: 22,
            letterSpacing: '-0.02em', marginBottom: 16,
          }}>
            {title}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}

/* ── Modal — centered glass ────────────────────────────────────────── */
export function Modal({
  open,
  onClose,
  children,
  title,
  closeOnOverlay = true,
  zIndex = 60,
  maxWidth = 340,
  className = '',
  style,
}) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Item #121 (release v0.2.0.3): Escape fecha modal — keyboard a11y.
  useEffect(() => {
    if (!open || !onClose) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={closeOnOverlay ? onClose : undefined}
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--dosy-bg-overlay)',
          animation: 'dosy-fade-in 220ms var(--dosy-ease-out) both',
        }}
      />
      <div
        className={className}
        style={{
          position: 'relative', width: '100%', maxWidth,
          background: 'linear-gradient(180deg, color-mix(in oklab, var(--dosy-bg-elevated) 88%, transparent) 0%, color-mix(in oklab, var(--dosy-bg) 82%, transparent) 100%)',
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          borderRadius: 28, padding: 24,
          animation: 'dosy-pop 250ms var(--dosy-ease-out) both',
          boxShadow: [
            'inset 0 1px 0 color-mix(in oklab, #fff 35%, transparent)',
            'inset 0 0 0 1px var(--dosy-border)',
            '0 24px 60px -16px rgba(0,0,0,0.45)',
          ].join(', '),
          fontFamily: 'var(--dosy-font-body)',
          color: 'var(--dosy-fg)',
          ...style,
        }}
      >
        {title && (
          <div style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 800, fontSize: 20,
            letterSpacing: '-0.02em', marginBottom: 12,
          }}>
            {title}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}
