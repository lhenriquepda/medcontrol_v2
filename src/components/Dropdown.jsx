import { forwardRef } from 'react'

/**
 * Dropdown — componente reusável padrão pro app.
 * Use quando ≥4 opções pra escolher (vs chips quando 2-3).
 *
 * Props:
 *   - value: valor selecionado
 *   - onChange: (newValue) => void
 *   - options: Array<{ value, label }>
 *   - label: string opcional, renderiza acima
 *   - placeholder: string opcional, aparece como <option value=""> primeiro
 *   - disabled, required, name, id, className: passthrough
 *   - size: 'sm' | 'md' (default 'md')
 *
 * Mantém visual consistente com `.input` (ver index.css).
 */
const Dropdown = forwardRef(function Dropdown(
  {
    value,
    onChange,
    options = [],
    label,
    placeholder,
    disabled = false,
    required = false,
    name,
    id,
    className = '',
    size = 'md',
  },
  ref
) {
  const selectId = id || (name ? `dropdown-${name}` : undefined)
  const sizeCls = size === 'sm' ? 'py-2 text-sm' : 'py-3 text-base'

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="block text-xs font-medium mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          name={name}
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value
            // numérico se options forem todas number
            const opt = options.find((o) => String(o.value) === v)
            onChange?.(opt ? opt.value : v)
          }}
          disabled={disabled}
          required={required}
          className={`input appearance-none pr-9 ${sizeCls}`}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
        >
          ▼
        </span>
      </div>
    </div>
  )
})

export default Dropdown
