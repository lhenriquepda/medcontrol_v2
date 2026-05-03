/**
 * Dosy primitives — Button, IconButton, Chip
 * Source design: contexto/claude-design/dosy/project/src/Primitives.jsx
 *
 * Sunset gradient signature em primary/active states. Pill rounded.
 * Press feedback via .dosy-press CSS class (transform scale 0.98).
 */
import { forwardRef } from 'react'

/* ── Button ────────────────────────────────────────────────────────────
 * kinds: primary (sunset gradient) | secondary | ghost | danger | danger-solid
 * size:  sm | md | lg
 */
export const Button = forwardRef(function DosyButton({
  kind = 'primary',
  size = 'md',
  children,
  onClick,
  full,
  icon: IconLeft,
  iconRight: IconRight,
  disabled,
  type = 'button',
  className = '',
  style,
  ...rest
}, ref) {
  const sizes = {
    sm: { padding: '9px 16px', fontSize: 13, minHeight: 36, iconSize: 16 },
    md: { padding: '13px 22px', fontSize: 14.5, minHeight: 46, iconSize: 18 },
    lg: { padding: '16px 28px', fontSize: 15.5, minHeight: 54, iconSize: 20 },
  }[size]

  const kindStyles = {
    primary: {
      background: 'var(--dosy-gradient-sunset)',
      color: 'var(--dosy-fg-on-sunset)',
      boxShadow: '0 12px 28px -8px rgba(255,61,127,0.42)',
    },
    secondary: {
      background: 'var(--dosy-bg-elevated)',
      color: 'var(--dosy-fg)',
      boxShadow: 'var(--dosy-shadow-sm)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--dosy-fg)',
    },
    danger: {
      background: 'var(--dosy-danger-bg)',
      color: 'var(--dosy-danger)',
      boxShadow: 'var(--dosy-shadow-xs)',
    },
    'danger-solid': {
      background: 'var(--dosy-danger)',
      color: 'var(--dosy-fg-on-sunset)',
      boxShadow: '0 8px 20px -6px rgba(229,86,74,0.35)',
    },
  }[kind]

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`dosy-press ${className}`}
      style={{
        ...kindStyles,
        padding: sizes.padding,
        fontSize: sizes.fontSize,
        minHeight: sizes.minHeight,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 9999,
        fontFamily: 'var(--dosy-font-display)',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        width: full ? '100%' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
      {...rest}
    >
      {IconLeft && <IconLeft size={sizes.iconSize} strokeWidth={2}/>}
      {children}
      {IconRight && <IconRight size={sizes.iconSize} strokeWidth={2}/>}
    </button>
  )
})

/* ── IconButton — round, 38-44px ──────────────────────────────────────
 * kinds: elevated (default) | ghost | sunken | sunset
 * dot:   show small sunset notification dot top-right
 */
export const IconButton = forwardRef(function DosyIconButton({
  icon: IconCmp,
  onClick,
  size = 44,
  kind = 'elevated',
  dot,
  disabled,
  type = 'button',
  ariaLabel,
  className = '',
  style,
  ...rest
}, ref) {
  const kindStyles = {
    elevated: {
      background: 'var(--dosy-bg-elevated)',
      color: 'var(--dosy-fg)',
      boxShadow: 'var(--dosy-shadow-sm)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--dosy-fg)',
      boxShadow: 'none',
    },
    sunken: {
      background: 'var(--dosy-bg-sunken)',
      color: 'var(--dosy-fg)',
      boxShadow: 'none',
    },
    sunset: {
      background: 'var(--dosy-gradient-sunset)',
      color: 'var(--dosy-fg-on-sunset)',
      boxShadow: '0 8px 20px -6px rgba(255,61,127,0.4)',
    },
  }[kind]
  const iconSize = size > 40 ? 20 : 18
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`dosy-press ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        border: 'none',
        ...kindStyles,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
      {...rest}
    >
      {IconCmp && <IconCmp size={iconSize} strokeWidth={1.75}/>}
      {dot && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          width: 9, height: 9, borderRadius: 9999,
          background: 'var(--dosy-sunset-1)',
          boxShadow: '0 0 0 2px var(--dosy-bg-elevated)',
        }}/>
      )}
    </button>
  )
})

/* ── Chip ──────────────────────────────────────────────────────────────
 * active=true → sunset gradient + white. active=false → elevated bg.
 */
export const Chip = forwardRef(function DosyChip({
  children,
  active,
  onClick,
  icon: IconCmp,
  size = 'md',
  disabled,
  className = '',
  style,
  ...rest
}, ref) {
  const sz = size === 'sm'
    ? { padding: '6px 12px', fontSize: 12, minHeight: 28, iconSize: 13 }
    : { padding: '9px 16px', fontSize: 13, minHeight: 36, iconSize: 15 }
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`dosy-press ${className}`}
      style={{
        padding: sz.padding,
        fontSize: sz.fontSize,
        minHeight: sz.minHeight,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--dosy-gradient-sunset)' : 'var(--dosy-bg-elevated)',
        color: active ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-fg)',
        borderRadius: 9999,
        fontFamily: 'var(--dosy-font-display)',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: active
          ? '0 6px 14px -4px rgba(255,61,127,0.36)'
          : 'var(--dosy-shadow-xs)',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
      {...rest}
    >
      {IconCmp && <IconCmp size={sz.iconSize} strokeWidth={1.75}/>}
      {children}
    </button>
  )
})
