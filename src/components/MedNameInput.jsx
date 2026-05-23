import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { suggestMedications } from '../data/medications'
import { useUserMedications } from '../hooks/useUserMedications'
import { useUserMedicationCategories } from '../hooks/useUserMedicationCategories'
import { useMedCatalogSearch } from '../hooks/useMedCatalogSearch'
import { getGroup } from '../constants/medCategories'
// v0.2.6.1 — PostHog instrumentação categoria (Roteiro_Alinhamento P3.4 + Validar.md escopo)
import { track, EVENTS } from '../services/analytics'

/**
 * MedNameInput — autocomplete v0.2.5.0 mobile-aware
 *
 * Fixes UX (mobile Android):
 *  - Removido handler Tab (não auto-selecionava errado quando user só queria sair)
 *  - Removido onMouseEnter setHighlight (gerava hovers fantasmas em touch)
 *  - Removido blur 150ms automático — só fecha via Escape, X explícito, ou pick()
 *  - Touch target <li> min-height 56px
 *  - Não auto-abre em exact match (evita re-abertura indesejada após pick)
 *  - visualViewport listener — maxHeight ajusta quando teclado abre
 *  - Sem e.preventDefault no pointerdown do <li> — scroll touch funciona
 *
 * onSelectFull (v0.2.4.0): { name, principio_ativo, group_id, cmed_class, source }
 */
export default function MedNameInput({ value, onChange, onSelectFull, required = true }) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [highlight, setHighlight] = useState(-1)
  const [debouncedValue, setDebouncedValue] = useState(value)
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(280)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)
  const pickingRef = useRef(false) // protege contra fechamento espúrio durante pick
  const listId = useId()

  const { data: userMeds = [] } = useUserMedications()
  const { data: catalogItems = [], isFetching: catalogFetching } = useMedCatalogSearch(debouncedValue)
  const { hintFor: userHintFor } = useUserMedicationCategories()

  // Debounce value pro RPC ANVISA (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedValue(value), 300)
    return () => clearTimeout(debounceRef.current)
  }, [value])

  // v0.2.6.1 — track inicio de busca (≥3 chars), throttled via ref pra evitar spam
  const searchTrackedRef = useRef(null)
  useEffect(() => {
    if (!debouncedValue || debouncedValue.length < 3) return
    if (searchTrackedRef.current === debouncedValue) return
    searchTrackedRef.current = debouncedValue
    try { track(EVENTS.MEDICATION_SEARCH_STARTED, { length: debouncedValue.length }) } catch {}
  }, [debouncedValue])

  // visualViewport — ajusta maxHeight quando teclado abre/fecha em Android
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    function recomputeHeight() {
      if (!wrapperRef.current) return
      const inputRect = wrapperRef.current.getBoundingClientRect()
      const vv = window.visualViewport
      // Espaço disponível abaixo do input dentro do viewport visível (com teclado aberto, vv.height é menor)
      const available = (vv.offsetTop + vv.height) - inputRect.bottom - 24
      const clamped = Math.max(140, Math.min(380, available))
      setDropdownMaxHeight(clamped)
    }
    recomputeHeight()
    window.visualViewport.addEventListener('resize', recomputeHeight)
    window.visualViewport.addEventListener('scroll', recomputeHeight)
    return () => {
      window.visualViewport.removeEventListener('resize', recomputeHeight)
      window.visualViewport.removeEventListener('scroll', recomputeHeight)
    }
  }, [open])

  // Merge fontes (histórico user + ANVISA + fallback local)
  const userMedsKey = useMemo(() => userMeds.join('|'), [userMeds])

  useEffect(() => {
    const local = suggestMedications(value, 4, userMeds)
    const normKey = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

    const localSuggestions = local.map((text) => {
      const hint = userHintFor ? userHintFor(text) : null
      return {
        text,
        source: hint ? 'user' : 'free',
        group_id: hint?.group_id || null,
        cmed_class: hint?.cmed_class || null,
        principio_ativo: hint?.principio_ativo || null,
      }
    })

    const localKeys = new Set(local.map(normKey))
    const catalogSuggestions = (catalogItems || [])
      .filter((item) => !localKeys.has(normKey(item.nome_comercial)))
      .slice(0, 8)
      .map((item) => ({
        text: item.nome_comercial,
        principio: normKey(item.principio_ativo) !== normKey(item.nome_comercial) ? item.principio_ativo : undefined,
        source: 'catalog',
        is_dcb: !!item.is_dcb,
        group_id: item.group_id || null,
        cmed_class: item.cmed_class || null,
        principio_ativo: item.principio_ativo || null,
      }))

    const merged = [...localSuggestions, ...catalogSuggestions]
    setSuggestions(merged)

    if (merged.length === 0) setHighlight(-1)
    else if (highlight >= merged.length) setHighlight(merged.length - 1)

    // Abre APENAS se está focado E tem sugestões E não tem exact-match (evita re-abertura pós-pick)
    if (document.activeElement === inputRef.current && !pickingRef.current) {
      const exact = merged.length > 0 && normKey(merged[0].text) === normKey(value)
      setOpen(merged.length > 0 && !exact)
    }
  }, [value, userMedsKey, catalogItems])

  // Fechamento por tap fora — só quando NÃO está picking
  useEffect(() => {
    if (!open) return
    function handleDocClick(e) {
      if (pickingRef.current) return
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleDocClick)
    return () => document.removeEventListener('pointerdown', handleDocClick)
  }, [open])

  function handleChange(e) { onChange(e.target.value) }

  function handleFocus() {
    if (suggestions.length > 0 && value && value.length >= 2) {
      const exact = suggestions.length > 0 && (suggestions[0].text || '').toLowerCase() === value.toLowerCase()
      if (!exact) setOpen(true)
    }
  }

  // Removido handleBlur automático — fechamento só via Escape, outside-click, ou pick()

  function pick(item) {
    pickingRef.current = true
    onChange(item.text)
    if (onSelectFull) {
      onSelectFull({
        name: item.text,
        principio_ativo: item.principio_ativo || item.principio || null,
        group_id: item.group_id || null,
        cmed_class: item.cmed_class || null,
        source: item.source || 'free',
      })
    }
    // v0.2.6.1 — telemetria seleção do catálogo (Roteiro_Alinhamento P3.4)
    try {
      track(EVENTS.MEDICATION_SELECTED_FROM_CATALOG, {
        source: item.source || 'unknown',
        has_group: Boolean(item.group_id),
        has_cmed_class: Boolean(item.cmed_class),
        is_dcb: Boolean(item.is_dcb),
      })
      if (item.group_id) {
        track(EVENTS.CATEGORY_AUTOFILLED, {
          source: item.source || 'unknown',
          group_id: item.group_id,
        })
      }
    } catch {}
    setOpen(false)
    setHighlight(-1)
    // Reset flag após próximo tick pra outside-click voltar a funcionar
    setTimeout(() => { pickingRef.current = false }, 300)
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
    }
    // Tab não auto-seleciona (v0.2.5.0 fix) — só Enter explícito
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
        placeholder="Ex: Paracetamol, Dipirona, Amoxicilina…"
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
          fontSize: 15,
          color: 'var(--dosy-fg)',
          outline: 'none',
          fontFamily: 'var(--dosy-font-body)',
        }}
      />

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 1000,
            maxHeight: dropdownMaxHeight,
            overflowY: 'auto',
            overscrollBehavior: 'contain',  // evita scroll do body
            WebkitOverflowScrolling: 'touch',
            margin: 0,
            padding: '4px 0',
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
                onClick={() => pick(item)}
                style={{
                  padding: '14px 16px',
                  minHeight: 56,
                  fontSize: 14,
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: isHl ? 'var(--dosy-peach-100)' : 'transparent',
                  color: 'var(--dosy-fg)',
                  fontWeight: isHl ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderBottom: '1px solid var(--dosy-border)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {highlightMatch(item.text, value)}
                    {item.is_dcb && (
                      <span aria-label="Denominação genérica" style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'var(--dosy-blue-100, #e0f2fe)',
                        color: 'var(--dosy-blue-600, #0369a1)',
                        letterSpacing: '0.5px',
                      }}>DCB</span>
                    )}
                  </div>
                  {item.principio && (
                    <div style={{
                      fontSize: 11,
                      color: 'var(--dosy-fg-muted)',
                      fontWeight: 400,
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.principio}
                    </div>
                  )}
                </div>
                {item.group_id && (
                  <span aria-label={`categoria ${getGroup(item.group_id).label}`} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: 'var(--dosy-bg)',
                    border: '1px solid var(--dosy-border)',
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--dosy-fg-muted)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: getGroup(item.group_id).color,
                    }} aria-hidden="true" />
                    {getGroup(item.group_id).label}
                  </span>
                )}
              </li>
            )
          })}
          {catalogFetching && (
            <li style={{
              padding: '10px 16px',
              fontSize: 11,
              color: 'var(--dosy-fg-muted)',
              fontStyle: 'italic',
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
