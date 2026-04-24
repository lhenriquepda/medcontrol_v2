import { useRef, useState } from 'react'
import { suggestMedication } from '../data/medications'

/**
 * Input com ghost-text autocomplete para nomes de medicamentos.
 * - Digitou "Des" → mostra "Desloratadina" com "loratadina" em cinza
 * - Tab / ArrowRight / Enter aceita sugestão
 * - Qualquer outro caractere continua digitando
 */
export default function MedNameInput({ value, onChange, required = true }) {
  const [suggestion, setSuggestion] = useState(null)
  const inputRef = useRef(null)

  function handleChange(e) {
    const v = e.target.value
    onChange(v)
    setSuggestion(v.length >= 2 ? suggestMedication(v) : null)
  }

  function accept() {
    if (suggestion) {
      onChange(suggestion)
      setSuggestion(null)
    }
  }

  function handleKeyDown(e) {
    if (suggestion && (e.key === 'Tab' || e.key === 'ArrowRight')) {
      e.preventDefault()
      accept()
    } else if (e.key === 'Escape') {
      setSuggestion(null)
    }
  }

  // Ghost suffix = parte da sugestão que ainda não foi digitada
  const ghostSuffix =
    suggestion && suggestion.toLowerCase().startsWith(value.toLowerCase())
      ? suggestion.slice(value.length)
      : null

  return (
    <div className="relative">
      {/* Ghost text layer — fica atrás do input real */}
      {ghostSuffix && (
        <div
          aria-hidden="true"
          className="absolute inset-0 px-3 py-2 text-sm pointer-events-none overflow-hidden whitespace-nowrap"
          style={{ fontFamily: 'inherit' }}
        >
          <span className="invisible">{value}</span>
          <span className="text-slate-400 dark:text-slate-500">{ghostSuffix}</span>
        </div>
      )}

      <input
        ref={inputRef}
        required={required}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setSuggestion(null)}
        placeholder="Ex: Paracetamol"
        className="input w-full bg-transparent relative z-10"
        style={{ caretColor: 'auto' }}
      />

      {/* Chip clicável com sugestão completa (quando não há ghost — contém match) */}
      {suggestion && !ghostSuffix && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); accept() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-200 max-w-[55%] truncate"
        >
          {suggestion}
        </button>
      )}
    </div>
  )
}
