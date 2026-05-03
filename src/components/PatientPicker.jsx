import { useEffect, useRef, useState, useMemo } from 'react'
import { Search, X as XIcon, Check, ChevronDown, User } from 'lucide-react'

/**
 * PatientPicker — dropdown searchable Dosy-styled.
 * v0.2.0.0 redesign: substitui visual legacy por tokens --dosy-*.
 *
 * Props:
 *   patients      — array { id, name, avatar }
 *   value         — id selecionado (ou null)
 *   onChange      — (id|null) => void
 *   allowAll      — oferece opção "Todos pacientes" (default false)
 *   placeholder   — texto trigger quando nada selecionado
 */
export default function PatientPicker({
  patients = [],
  value,
  onChange,
  allowAll = false,
  placeholder = 'Selecione paciente',
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const selected = useMemo(
    () => patients.find((p) => p.id === value),
    [patients, value],
  )

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return patients
    return patients.filter((p) => p.name.toLowerCase().includes(term))
  }, [patients, q])

  // Fecha em click fora
  useEffect(() => {
    if (!open) return undefined
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Autofocus input ao abrir
  useEffect(() => {
    if (open) {
      setQ('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  function pick(id) {
    onChange?.(id)
    setOpen(false)
  }

  const triggerLabel = selected
    ? selected.name
    : (allowAll && value === null) ? 'Todos pacientes' : placeholder

  const triggerEmoji = selected ? selected.avatar : null

  return (
    <div ref={wrapRef} style={{ position: 'relative', fontFamily: 'var(--dosy-font-body)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="dosy-press"
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          fontSize: 14, textAlign: 'left',
          background: 'var(--dosy-bg-elevated)',
          color: selected || (allowAll && value === null) ? 'var(--dosy-fg)' : 'var(--dosy-fg-tertiary)',
          border: 'none',
          borderRadius: 14,
          boxShadow: 'var(--dosy-shadow-xs)',
          cursor: 'pointer',
        }}
      >
        {selected ? (
          triggerEmoji ? (
            <span style={{ fontSize: 18, flexShrink: 0 }}>{triggerEmoji}</span>
          ) : (
            <User size={16} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--dosy-fg-secondary)' }}/>
          )
        ) : null}
        <span style={{
          flex: 1, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontWeight: selected || (allowAll && value === null) ? 600 : 500,
        }}>{triggerLabel}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          style={{
            color: 'var(--dosy-fg-tertiary)',
            flexShrink: 0,
            transition: 'transform 200ms var(--dosy-ease-out)',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)',
            zIndex: 30,
            background: 'var(--dosy-bg-elevated)',
            border: '1px solid var(--dosy-border)',
            borderRadius: 16,
            boxShadow: 'var(--dosy-shadow-lg)',
            overflow: 'hidden',
            animation: 'dosy-slide-down 200ms var(--dosy-ease-out) both',
          }}
        >
          {/* Search input */}
          <div style={{ padding: 8, borderBottom: '1px solid var(--dosy-border)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: 'var(--dosy-bg-sunken)',
              borderRadius: 12,
            }}>
              <Search size={14} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)', flexShrink: 0 }}/>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar paciente…"
                style={{
                  flex: 1, minWidth: 0,
                  background: 'transparent',
                  border: 'none', outline: 'none',
                  fontSize: 14, color: 'var(--dosy-fg)',
                  fontFamily: 'inherit',
                }}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  aria-label="Limpar busca"
                  style={{
                    background: 'transparent', border: 'none',
                    color: 'var(--dosy-fg-tertiary)', cursor: 'pointer',
                    flexShrink: 0, padding: 2, display: 'inline-flex',
                  }}
                >
                  <XIcon size={12} strokeWidth={2}/>
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <ul style={{
            maxHeight: 256, overflowY: 'auto',
            margin: 0, padding: '4px 0',
            listStyle: 'none',
          }}>
            {allowAll && (
              <li>
                <Option
                  active={value === null}
                  onClick={() => pick(null)}
                  emoji={null}
                  label="Todos pacientes"
                  hint="·"
                />
              </li>
            )}
            {filtered.length === 0 ? (
              <li style={{
                padding: '14px 16px',
                fontSize: 12.5,
                color: 'var(--dosy-fg-tertiary)',
                textAlign: 'center',
              }}>Nenhum paciente encontrado</li>
            ) : filtered.map((p) => (
              <li key={p.id}>
                <Option
                  active={p.id === value}
                  onClick={() => pick(p.id)}
                  emoji={p.avatar}
                  label={p.name}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Option({ active, onClick, emoji, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: active ? 'var(--dosy-peach-100)' : 'transparent',
        color: active ? 'var(--dosy-fg)' : 'var(--dosy-fg)',
        fontWeight: active ? 700 : 500,
        fontSize: 14,
        border: 'none', cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 150ms var(--dosy-ease-out)',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--dosy-bg-sunken)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{
        width: 24, textAlign: 'center', flexShrink: 0, fontSize: 18,
        color: 'var(--dosy-fg-secondary)',
      }}>
        {emoji || hint || <User size={14} strokeWidth={1.75}/>}
      </span>
      <span style={{
        flex: 1, minWidth: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</span>
      {active && (
        <Check size={14} strokeWidth={2} style={{ color: 'var(--dosy-primary)', flexShrink: 0 }}/>
      )}
    </button>
  )
}
