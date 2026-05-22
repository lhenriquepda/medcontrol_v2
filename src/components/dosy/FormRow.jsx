/**
 * FormRow — Refactor Fase 4 (Refactor_Full.md §11.3 item 7).
 *
 * Encapsula padrão repetido em TreatmentForm (~15×), PatientForm, SOS,
 * Settings: label + slot do input + helper + error. Centraliza a11y
 * (label htmlFor + aria-describedby) sem precisar de cada caller
 * gerar IDs únicos.
 *
 * Uso:
 *   <FormRow label="Nome" helper="Como você chama o paciente">
 *     <input value={name} onChange={...} />
 *   </FormRow>
 *
 *   <FormRow label="E-mail" required error={emailError}>
 *     <input type="email" value={email} onChange={...} />
 *   </FormRow>
 */
import { useId, Children, cloneElement, isValidElement } from 'react'

export default function FormRow({
  label,
  helper,
  error,
  required = false,
  children,
  style,
}) {
  const baseId = useId()
  const inputId = `${baseId}-input`
  const helperId = helper ? `${baseId}-helper` : null
  const errorId = error ? `${baseId}-error` : null
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined

  // Injeta id + aria-describedby no primeiro child (caller passa só o
  // input cru; FormRow cuida da semântica).
  const enhancedChild = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? inputId,
        'aria-describedby': children.props['aria-describedby'] ?? describedBy,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })
    : children

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(style || {}) }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--dosy-fg-secondary)',
            fontFamily: 'var(--dosy-font-body)',
          }}
        >
          {label}
          {required && (
            <span aria-hidden="true" style={{ color: 'var(--dosy-danger)', marginLeft: 4 }}>*</span>
          )}
        </label>
      )}
      {enhancedChild}
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontSize: 12,
            color: 'var(--dosy-danger)',
            fontWeight: 500,
          }}
        >
          {error}
        </span>
      )}
      {helper && !error && (
        <span
          id={helperId}
          style={{
            fontSize: 12,
            color: 'var(--dosy-fg-tertiary)',
            lineHeight: 1.4,
          }}
        >
          {helper}
        </span>
      )}
    </div>
  )
}
