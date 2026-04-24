import { useRef, useState } from 'react'
import { suggestMedication } from '../data/medications'

export default function MedNameInput({ value, onChange, required = true }) {
  const [suggestion, setSuggestion] = useState(null)
  const acceptingRef = useRef(false)

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
    if (!suggestion) return
    if (e.key === 'Tab' || e.key === 'ArrowRight') {
      e.preventDefault()
      accept()
    } else if (e.key === 'Escape') {
      setSuggestion(null)
    }
  }

  function handleBlur() {
    setTimeout(() => {
      if (!acceptingRef.current) setSuggestion(null)
      acceptingRef.current = false
    }, 150)
  }

  // Ghost suffix: only when suggestion starts with what user typed
  const showGhost =
    suggestion &&
    suggestion.toLowerCase().startsWith(value.toLowerCase()) &&
    suggestion.length > value.length

  return (
    // Wrapper carries the visual input styling (bg, border, radius)
    // Input itself is transparent so ghost layer shows through
    <div className="relative w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-brand-500 overflow-hidden">
      {/* Ghost text — sits behind transparent input */}
      {showGhost && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center px-4 text-sm pointer-events-none"
        >
          <span className="invisible whitespace-pre">{value}</span>
          <span className="text-slate-400 dark:text-slate-500 whitespace-pre">
            {suggestion.slice(value.length)}
          </span>
        </div>
      )}

      <input
        required={required}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Ex: Paracetamol"
        className="w-full px-4 py-3 text-sm bg-transparent relative z-10 focus:outline-none placeholder-slate-400"
      />

      {/* Chip for "contains" match (no prefix ghost possible) */}
      {suggestion && !showGhost && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            acceptingRef.current = true
            accept()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-200 max-w-[55%] truncate z-20"
        >
          {suggestion}
        </button>
      )}

      {/* Invisible tap zone on right side to accept ghost suggestion (mobile) */}
      {showGhost && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Aceitar sugestão"
          onPointerDown={(e) => {
            e.preventDefault()
            acceptingRef.current = true
            accept()
          }}
          className="absolute inset-y-0 right-0 w-10 z-20"
        />
      )}
    </div>
  )
}
