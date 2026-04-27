import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { suggestMedications } from '../data/medications'
import { useUserMedications } from '../hooks/useUserMedications'

/**
 * MedNameInput — text field with dropdown autocomplete.
 *
 * Behavior:
 *   - User types ≥2 chars → dropdown shows up to 6 matches below input
 *   - List narrows as user types more
 *   - Tap row OR Enter on highlighted row → fills input + closes dropdown
 *   - Esc → closes dropdown (keeps typed value — input is free-text)
 *   - Blur → closes (small delay to allow tap)
 *   - User can submit free-text not in list (medications.js is hint, not whitelist)
 *
 * Mobile-friendly: dropdown is a tap-target list, not ghost-text or chips.
 */
export default function MedNameInput({ value, onChange, required = true }) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [highlight, setHighlight] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const blurTimerRef = useRef(null)
  const listId = useId()

  // User's own medication history — merged with hardcoded list as priority hints
  const { data: userMeds = [] } = useUserMedications()
  const userMedsKey = useMemo(() => userMeds.join('|'), [userMeds])

  // Recompute suggestions when value or user history changes
  useEffect(() => {
    const list = suggestMedications(value, 6, userMeds)
    setSuggestions(list)
    if (list.length === 0) setHighlight(-1)
    else if (highlight >= list.length) setHighlight(list.length - 1)
    // open only if input focused AND list non-empty AND value not exactly matching first
    // (closes when user accepts a suggestion, since exact match means typed = picked)
    if (document.activeElement === inputRef.current) {
      const exact = list.length > 0 && list[0].toLowerCase() === value.toLowerCase()
      setOpen(list.length > 0 && !exact)
    }
  }, [value, userMedsKey])

  // Close dropdown when user taps outside
  useEffect(() => {
    if (!open) return
    function handleDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleDocClick)
    return () => document.removeEventListener('pointerdown', handleDocClick)
  }, [open])

  function handleChange(e) {
    onChange(e.target.value)
  }

  function handleFocus() {
    if (suggestions.length > 0) setOpen(true)
  }

  function handleBlur() {
    // Delay close so onPointerDown of a suggestion row can fire first
    blurTimerRef.current = setTimeout(() => setOpen(false), 150)
  }

  function pick(med) {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    onChange(med)
    setOpen(false)
    setHighlight(-1)
    // Move focus back to input for continued editing if needed
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        e.preventDefault()
        setOpen(true)
        setHighlight(0)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && highlight < suggestions.length) {
        e.preventDefault()
        pick(suggestions[highlight])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'Tab') {
      // Tab accepts highlighted suggestion if any, otherwise lets focus move naturally
      if (highlight >= 0 && highlight < suggestions.length) {
        e.preventDefault()
        pick(suggestions[highlight])
      }
    }
  }

  // Highlight matched substring inside suggestion (case + diacritic insensitive)
  function highlightMatch(med, query) {
    if (!query || query.length < 2) return med
    const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    const nQuery = norm(query)
    const nMed = norm(med)
    const idx = nMed.indexOf(nQuery)
    if (idx === -1) return med
    return (
      <>
        {med.slice(0, idx)}
        <strong className="text-brand-700 dark:text-brand-300">{med.slice(idx, idx + query.length)}</strong>
        {med.slice(idx + query.length)}
      </>
    )
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        ref={inputRef}
        required={required}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Ex: Paracetamol"
        className="input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={highlight >= 0 ? `${listId}-opt-${highlight}` : undefined}
      />

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-30 max-h-60 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg"
        >
          {suggestions.map((med, i) => {
            const isHl = i === highlight
            return (
              <li
                key={med}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={isHl}
                onPointerDown={(e) => {
                  // Prevent blur firing before pick
                  e.preventDefault()
                  pick(med)
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`px-4 py-2.5 text-sm cursor-pointer select-none ${
                  isHl
                    ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-800 dark:text-brand-100'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {highlightMatch(med, value)}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
