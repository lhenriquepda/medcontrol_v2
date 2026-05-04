/**
 * Dosy primitives — Input, Toggle
 * Source design: contexto/claude-design/dosy/project/src/Primitives.jsx
 */
import { forwardRef } from 'react'

/* ── Input — label uppercase tiny + warm shadow + radius 16 ────────────
 * suffix renderiza unidade/hint à direita
 * icon renderiza ícone à esquerda
 * error string mostra borda vermelha + mensagem abaixo
 */
export const Input = forwardRef(function DosyInput({
  label,
  value,
  defaultValue,
  placeholder,
  onChange,
  icon: IconCmp,
  type = 'text',
  readOnly,
  hint,
  error,
  suffix,
  inputMode,
  autoComplete,
  required,
  id,
  name,
  className = '',
  inputClassName = '',
  style,
  inputStyle,
  ...rest
}, ref) {
  const inputId = id || (name ? `dosy-input-${name}` : undefined)
  const isControlled = value !== undefined
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 7, ...style }}>
      {label && (
        <label htmlFor={inputId} style={{
          fontSize: 12, fontWeight: 600, color: 'var(--dosy-fg-secondary)',
          letterSpacing: '0.04em', textTransform: 'uppercase', paddingLeft: 4,
          fontFamily: 'var(--dosy-font-display)',
        }}>{label}{required && <span style={{ color: 'var(--dosy-danger)', marginLeft: 4 }}>*</span>}</label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {IconCmp && (
          <div style={{
            position: 'absolute', left: 16,
            color: 'var(--dosy-fg-secondary)',
            pointerEvents: 'none',
            display: 'flex', alignItems: 'center',
          }}>
            <IconCmp size={18} strokeWidth={1.75}/>
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          required={required}
          {...(isControlled ? { value: value ?? '' } : { defaultValue })}
          placeholder={placeholder}
          onChange={onChange}
          readOnly={readOnly}
          className={inputClassName}
          style={{
            width: '100%',
            padding: IconCmp ? '14px 18px 14px 44px' : '14px 18px',
            paddingRight: suffix ? 56 : 18,
            borderRadius: 16,
            background: 'var(--dosy-bg-elevated)',
            boxShadow: 'var(--dosy-shadow-xs)',
            border: error ? '1.5px solid var(--dosy-danger)' : '1.5px solid transparent',
            fontSize: 15, color: 'var(--dosy-fg)',
            outline: 'none',
            fontFamily: 'var(--dosy-font-body)',
            ...inputStyle,
          }}
          {...rest}
        />
        {suffix && (
          <div style={{
            position: 'absolute', right: 14,
            fontSize: 13, color: 'var(--dosy-fg-secondary)', fontWeight: 500,
          }}>{suffix}</div>
        )}
      </div>
      {hint && !error && (
        <div style={{ fontSize: 12, color: 'var(--dosy-fg-tertiary)', paddingLeft: 4, lineHeight: 1.4 }}>
          {hint}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: 'var(--dosy-danger)', paddingLeft: 4, lineHeight: 1.4 }}>
          {error}
        </div>
      )}
    </div>
  )
})

/* ── Toggle (switch) ───────────────────────────────────────────────────
 * value=true → sunset gradient track + knob right
 */
export function Toggle({ value, onChange, disabled, ariaLabel, className = '', style }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!value}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange && onChange(!value)}
      className={className}
      style={{
        width: 46, height: 28, borderRadius: 9999,
        background: value ? 'var(--dosy-gradient-sunset)' : 'var(--dosy-bg-sunken)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        padding: 0,
        transition: 'background 250ms var(--dosy-ease-out)',
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 22, height: 22, borderRadius: 9999,
        background: '#fff',
        boxShadow: '0 2px 6px rgba(74,36,16,0.25)',
        transition: 'left 250ms var(--dosy-ease-out)',
      }}/>
    </button>
  )
}
