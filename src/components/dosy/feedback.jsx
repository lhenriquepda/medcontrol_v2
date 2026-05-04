/**
 * Dosy primitives — StatusPill, Toast
 * Source design: contexto/claude-design/dosy/project/src/Primitives.jsx
 */
import { useEffect } from 'react'
import { Check, AlertTriangle } from 'lucide-react'

/* ── StatusPill ────────────────────────────────────────────────────────
 * kinds: success | upcoming | pending | danger | info | sunset | skipped
 * lowercase, weight 700, tinted bg
 */
export function StatusPill({ label, kind = 'success', icon: IconCmp, className = '', style }) {
  const styles = {
    success:  { color: '#3F9E7E', background: '#DDF1E8' },
    upcoming: { color: '#C5841A', background: '#FCEACB' },
    pending:  { color: 'var(--dosy-fg-secondary)', background: 'var(--dosy-peach-100)' },
    danger:   { color: 'var(--dosy-danger)', background: 'var(--dosy-danger-bg)' },
    info:     { color: 'var(--dosy-info)', background: 'var(--dosy-info-bg)' },
    sunset:   { color: 'var(--dosy-fg-on-sunset)', background: 'var(--dosy-gradient-sunset)' },
    skipped:  { color: 'var(--dosy-fg-tertiary)', background: 'var(--dosy-bg-sunken)' },
  }[kind]
  return (
    <span className={className} style={{
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.02em',
      color: styles.color,
      background: styles.background,
      padding: IconCmp ? '4px 10px 4px 7px' : '4px 10px',
      borderRadius: 9999,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      whiteSpace: 'nowrap',
      textTransform: 'lowercase',
      fontFamily: 'var(--dosy-font-display)',
      ...style,
    }}>
      {IconCmp && <IconCmp size={11} strokeWidth={2}/>}
      {label}
    </span>
  )
}

/* ── Toast — pill-shape, leading colored circle, auto-dismiss
 * kind: success (mint) | danger (coral)
 */
export function Toast({
  message,
  action,
  onAction,
  onDismiss,
  kind = 'success',
  durationMs = 4500,
}) {
  useEffect(() => {
    if (!message) return undefined
    const t = setTimeout(() => onDismiss && onDismiss(), durationMs)
    return () => clearTimeout(t)
  }, [message, durationMs, onDismiss])
  if (!message) return null
  const Icon = kind === 'success' ? Check : AlertTriangle
  return (
    <div className="dosy-toast" style={{
      position: 'absolute', left: 16, right: 16, bottom: 110, zIndex: 70,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      background: 'var(--dosy-bg-elevated)',
      borderRadius: 9999,
      boxShadow: 'var(--dosy-shadow-lg)',
      border: '1px solid var(--dosy-border)',
      fontFamily: 'var(--dosy-font-body)',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9999,
        background: kind === 'success' ? '#DDF1E8' : 'var(--dosy-danger-bg)',
        color: kind === 'success' ? '#3F9E7E' : 'var(--dosy-danger)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={16} strokeWidth={2}/>
      </div>
      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}>
        {message}
      </div>
      {action && (
        <button onClick={onAction} type="button" style={{
          border: 'none', background: 'transparent',
          color: 'var(--dosy-primary)', fontWeight: 700, fontSize: 13,
          cursor: 'pointer', padding: '4px 4px',
          fontFamily: 'inherit',
        }}>
          {action}
        </button>
      )}
    </div>
  )
}
