import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { suggestMedications } from '../data/medications'
import { useUserMedications } from '../hooks/useUserMedications'
import { useMedCatalogSearch } from '../hooks/useMedCatalogSearch'

/**
 * MedNameInput — text field with dropdown autocomplete.
 *
 * Sources (merged, deduplicated):
 *   1. User's own medication history (priority, synchronous)
 *   2. ANVISA catalog via search_medications RPC (debounced 300ms)
 *   3. Local curated list (fallback)
 *
 * Each suggestion: { text: string, principio?: string }
 * principio shown as subtitle for catalog results only.
 * onChange always receives the plain medName string.
 */
export default function MedNameInput({ value, onChange, required = true }) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [highlight, setHighlight] = useState(-1)
  const [debouncedValue, setDebouncedValue] = useState(value)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const blurTimerRef = useRef(null)
  const debounceRef = useRef(null)
  const listId = useId()

  const { data: userMeds = [] } = useUserMedications()
  const { data: catalogItems = [], isFetching: catalogFetching } = useMedCatalogSearch(debouncedValue)

  // Debounce value for ANVISA catalog search (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedValue(value), 300)
    return () => clearTimeout(debounceRef.current)
  }, [value])

  // Merge sources whenever any input changes
  const userMedsKey = useMemo(() => userMeds.join('|'), [userMeds])

  useEffect(() => {
    const local = suggestMedications(value, 4, userMeds)

    // Convert local to suggestion objects (no subtitle)
    const localSuggestions = local.map((text) => ({ text }))

    // ANVISA results not already in local (dedup by lowercase nome_comercial)
    const localLower = new Set(local.map((t) => t.toLowerCase()))
    const catalogSuggestions = (catalogItems || [])
      .filter((item) => !localLower.has((item.nome_comercial || '').toLowerCase()))
      .slice(0, 6)
      .map((item) => ({
        text: item.nome_comercial,
        principio: item.principio_ativo !== item.nome_comercial ? item.principio_ativo : undefined,
      }))

    const merged = [...localSuggestions, ...catalogSuggestions]
    setSuggestions(merged)

    if (merged.length === 0) setHighlight(-1)
    else if (highlight >= merged.length) setHighlight(merged.length - 1)

    if (document.activeElement === inputRef.current) {
      const exact = merged.length > 0 && merged[0].text.toLowerCase() === value.toLowerCase()
      setOpen(merged.length > 0 && !exact)
    }
  }, [value, userMedsKey, catalogItems])

  // Close on outside tap
  useEffect(() => {
    if (!open) return
    function handleDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleDocClick)
    return () => document.removeEventListener('pointerdown', handleDocClick)
  }, [open])

  function handleChange(e) { onChange(e.target.value) }

  function handleFocus() { if (suggestions.length > 0) setOpen(true) }

  function handleBlur() {
    blurTimerRef.current = setTimeout(() => setOpen(false), 150)
  }

  function pick(item) {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    onChange(item.text)
    setOpen(false)
    setHighlight(-1)
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
      if (highlight >= 0 && highlight < suggestions.length) {
        e.preventDefault()
        pick(suggestions[highlight])
      }
    }
  }

  function highlightMatch(text, query) {
    if (!query || query.length < 2) return text
    const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    const nQuery = norm(query)
    const nText = norm(text)
    const idx = nText.indexOf(nQuery)
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <strong style={{ color: 'var(--dosy-primary)' }}>{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
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
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={highlight >= 0 ? `${listId}-opt-${highlight}` : undefined}
        style={{
          width: '100%',
          padding: '14px 18px',
          borderRadius: 16,
          background: 'var(--dosy-bg-elevated)',
          boxShadow: 'var(--dosy-shadow-xs)',
          border: '1.5px solid transparent',
          fontSize: 15, color: 'var(--dosy-fg)',
          outline: 'none',
          fontFamily: 'var(--dosy-font-body)',
        }}
      />

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)',
            zIndex: 30,
            maxHeight: 280, overflowY: 'auto',
            margin: 0, padding: '4px 0',
            listStyle: 'none',
            borderRadius: 16,
            background: 'var(--dosy-bg-elevated)',
            border: '1px solid var(--dosy-border)',
            boxShadow: 'var(--dosy-shadow-lg)',
            animation: 'dosy-slide-down 200ms var(--dosy-ease-out) both',
            fontFamily: 'var(--dosy-font-body)',
          }}
        >
          {suggestions.map((item, i) => {
            const isHl = i === highlight
            return (
              <li
                key={`${item.text}-${i}`}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={isHl}
                onPointerDown={(e) => { e.preventDefault(); pick(item) }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  padding: item.principio ? '8px 14px 6px' : '10px 14px',
                  fontSize: 14,
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: isHl ? 'var(--dosy-peach-100)' : 'transparent',
                  color: 'var(--dosy-fg)',
                  fontWeight: isHl ? 600 : 500,
                  transition: 'background 150ms var(--dosy-ease-out)',
                }}
              >
                <div>{highlightMatch(item.text, value)}</div>
                {item.principio && (
                  <div style={{ fontSize: 11, color: 'var(--dosy-fg-muted)', fontWeight: 400, marginTop: 1 }}>
                    {item.principio}
                  </div>
                )}
              </li>
            )
          })}
          {catalogFetching && (
            <li style={{
              padding: '6px 14px', fontSize: 11,
              color: 'var(--dosy-fg-muted)', fontStyle: 'italic',
              listStyle: 'none',
            }}>
              buscando no catálogo ANVISA…
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
