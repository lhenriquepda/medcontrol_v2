/**
 * CategoryPicker — v0.2.4.0 Categorias de Medicamentos
 *
 * Chip + sheet de seleção de grupo terapêutico amigável (Nível 1).
 *
 *   <CategoryPicker
 *     value={group_id}
 *     onChange={(group_id) => ...}
 *     autoFilled={true}          // chip aparece com 🔒 + texto "detectado automaticamente"
 *     required                   // mostra asterisco e helperError quando vazio
 *     helperText="..."           // override do texto auxiliar
 *   />
 *
 * Comportamento:
 *   - Chip exibe cor + label do grupo. Tap abre sheet com lista das 16 categorias.
 *   - `autoFilled`: indica que value veio de autofill (catálogo/user). UI mostra ícone cadeado
 *     mas SEMPRE permite override — sheet abre normalmente.
 *   - `required`: quando true e value vazio, helper vira erro acessível.
 *
 * Visual segue tokens Dosy + cores próprias por grupo (medCategories.js).
 */
import { useId, useMemo, useState } from 'react'
import { Sheet } from './surfaces.jsx'
import { MED_GROUPS, GROUP_UNCLASSIFIED, getGroup } from '../../constants/medCategories.js'

export default function CategoryPicker({
  value = null,
  onChange,
  autoFilled = false,
  required = false,
  helperText = null,
  disabled = false,
  label = 'Categoria do medicamento',
  ariaDescribedBy = null,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const helperId = useId()

  const selected = useMemo(() => getGroup(value), [value])
  const isEmpty = !value
  const showError = required && isEmpty && !autoFilled

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return MED_GROUPS
    const q = query.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
    return MED_GROUPS.filter((g) => {
      const norm = g.label.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      return norm.includes(q)
    })
  }, [query])

  function handleSelect(groupId) {
    if (onChange) onChange(groupId)
    setOpen(false)
    setQuery('')
  }

  function handleClear() {
    if (onChange) onChange(null)
    setOpen(false)
  }

  const helperMessage = showError
    ? 'Escolha uma categoria — não conseguimos detectar pelo nome.'
    : autoFilled
    ? 'Detectada automaticamente · toque para alterar'
    : helperText

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--dosy-fg-muted)',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span>{label}</span>
        {required && <span style={{ color: 'var(--dosy-red-500)' }}>*</span>}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={ariaDescribedBy || helperId}
        aria-invalid={showError || undefined}
        style={{
          width: '100%',
          minHeight: 56,
          padding: '12px 16px',
          borderRadius: 16,
          background: 'var(--dosy-bg-elevated)',
          boxShadow: 'var(--dosy-shadow-xs)',
          border: showError
            ? '1.5px solid var(--dosy-red-500)'
            : '1.5px solid transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontFamily: 'var(--dosy-font-body)',
          transition: 'border-color 150ms var(--dosy-ease-out)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, textAlign: 'left' }}>
          <span style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: isEmpty ? GROUP_UNCLASSIFIED.color : selected.color,
            flexShrink: 0,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
          }} aria-hidden="true" />
          <span style={{
            fontSize: 15,
            color: isEmpty ? 'var(--dosy-fg-muted)' : 'var(--dosy-fg)',
            fontWeight: isEmpty ? 400 : 500,
            fontStyle: isEmpty ? 'italic' : 'normal',
          }}>
            {isEmpty ? 'Escolher categoria' : selected.label}
          </span>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--dosy-fg-muted)' }}>
          {autoFilled && !isEmpty && (
            <span aria-label="detectado automaticamente" style={{ fontSize: 14 }}>🔒</span>
          )}
          <span style={{ fontSize: 18, lineHeight: 1 }}>▾</span>
        </span>
      </button>

      {helperMessage && (
        <div
          id={helperId}
          role={showError ? 'alert' : 'note'}
          style={{
            marginTop: 6,
            fontSize: 12,
            color: showError ? 'var(--dosy-red-500)' : 'var(--dosy-fg-muted)',
            fontFamily: 'var(--dosy-font-body)',
          }}
        >
          {helperMessage}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Categoria do medicamento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar categoria…"
            aria-label="Buscar categoria"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              background: 'var(--dosy-bg)',
              border: '1.5px solid var(--dosy-border)',
              fontSize: 14,
              color: 'var(--dosy-fg)',
              outline: 'none',
              fontFamily: 'var(--dosy-font-body)',
            }}
          />

          <ul role="listbox" style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            maxHeight: '60vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            {filteredGroups.map((g) => {
              const isSelected = g.id === value
              return (
                <li
                  key={g.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(g.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: isSelected ? 'var(--dosy-peach-100)' : 'transparent',
                    border: isSelected ? '1.5px solid var(--dosy-primary)' : '1.5px solid transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--dosy-font-body)',
                    transition: 'background 150ms var(--dosy-ease-out)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--dosy-bg)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: g.color,
                    flexShrink: 0,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                  }} aria-hidden="true" />
                  <span style={{
                    fontSize: 15,
                    color: 'var(--dosy-fg)',
                    fontWeight: isSelected ? 600 : 500,
                    flex: 1,
                  }}>
                    {g.label}
                  </span>
                  {isSelected && (
                    <span aria-hidden="true" style={{ color: 'var(--dosy-primary)', fontSize: 18 }}>✓</span>
                  )}
                </li>
              )
            })}
            {filteredGroups.length === 0 && (
              <li style={{ padding: 16, textAlign: 'center', color: 'var(--dosy-fg-muted)', fontSize: 13 }}>
                Nenhuma categoria com esse nome.
              </li>
            )}
          </ul>

          {!isEmpty && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                marginTop: 8,
                padding: '10px 16px',
                borderRadius: 12,
                background: 'transparent',
                border: '1px solid var(--dosy-border)',
                color: 'var(--dosy-fg-muted)',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'var(--dosy-font-body)',
              }}
            >
              Limpar categoria
            </button>
          )}
        </div>
      </Sheet>
    </div>
  )
}
