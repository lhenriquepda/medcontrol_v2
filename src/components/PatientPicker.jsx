import { useEffect, useRef, useState, useMemo } from 'react'
import Icon from './Icon'

/**
 * PatientPicker — dropdown searchable pra escolher paciente.
 *
 * Substitui pill-row horizontal (que não escala com muitos pacientes).
 *
 * Props:
 *   patients      — array { id, name, avatar }
 *   value         — id selecionado (ou null)
 *   onChange      — (id|null) => void
 *   allowAll      — boolean: oferece opção "Todos pacientes" (default false)
 *   placeholder   — texto trigger quando nada selecionado (default "Selecione paciente")
 *
 * UX:
 *   - Trigger button mostra avatar + nome do selecionado (ou placeholder)
 *   - Clicar abre painel com input search + lista filtrada
 *   - Filtro case-insensitive em nome
 *   - Fecha em selecionar / clicar fora / Esc
 */
export default function PatientPicker({
  patients = [],
  value,
  onChange,
  allowAll = false,
  placeholder = 'Selecione paciente'
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const selected = useMemo(
    () => patients.find((p) => p.id === value),
    [patients, value]
  )

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return patients
    return patients.filter((p) => p.name.toLowerCase().includes(term))
  }, [patients, q])

  // Fecha em click fora
  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
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

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] active:scale-[0.99] transition"
      >
        {selected ? (
          <>
            <span className="text-base shrink-0">{selected.avatar || <Icon name="user" size={14} />}</span>
            <span className="flex-1 truncate">{selected.name}</span>
          </>
        ) : allowAll && value === null ? (
          <span className="flex-1 truncate text-slate-600 dark:text-slate-300">Todos pacientes</span>
        ) : (
          <span className="flex-1 truncate text-slate-400">{placeholder}</span>
        )}
        <Icon name={open ? 'chevron' : 'chevron'} size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--color-bg-subtle)] rounded-[var(--radius-sm)]">
              <Icon name="search" size={14} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar paciente…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              {q && (
                <button type="button" onClick={() => setQ('')} className="text-slate-400 hover:text-slate-600 shrink-0">
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {allowAll && (
              <li>
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--color-bg-subtle)] ${value === null ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 font-medium' : ''}`}
                >
                  <span className="w-6 text-center">·</span>
                  <span>Todos pacientes</span>
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-slate-400 text-center">Nenhum paciente encontrado</li>
            ) : filtered.map((p) => {
              const active = p.id === value
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--color-bg-subtle)] ${active ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 font-medium' : ''}`}
                  >
                    <span className="w-6 text-center text-base shrink-0">{p.avatar || <Icon name="user" size={14} />}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    {active && <Icon name="check" size={14} className="text-brand-600 dark:text-brand-300 shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
