import { useEffect, useId, useMemo, useRef, useState, useCallback } from 'react'
import { Search, X as XIcon, Pill } from 'lucide-react'
import { suggestMedications } from '../data/medications'
import { useUserMedications } from '../hooks/useUserMedications'
import { useUserMedicationCategories } from '../hooks/useUserMedicationCategories'
import { useMedCatalogSearch } from '../hooks/useMedCatalogSearch'
import { getGroup } from '../constants/medCategories'
import { track, EVENTS } from '../services/analytics'

/**
 * MedNameInput — v0.2.6.2 RESCRITA MOBILE-FIRST
 *
 * 3 problemas reportados pelo user (2026-05-23) que motivaram esta reescrita:
 *  1. "Campo de digitação some da tela" — input ficava atrás do teclado
 *  2. "Não vejo as sugestões" — dropdown sobreposto pelo teclado
 *  3. "Quando arrasto pra olhar, sugestões somem, teclado some" — scroll
 *     disputado entre página e dropdown, teclado fechando ao scroll body
 *
 * Solução nova:
 *  - Em mobile (width ≤ 768 OU Capacitor native): input vira "chip de busca"
 *    que ao tap abre um FULL-SCREEN PICKER (top: 0, bottom: 0). Input fica
 *    fixo no topo, lista flex-1 com overflow-y. Teclado virtual NUNCA cobre
 *    input nem sugestões. ScrollView dentro do picker tem `WebkitOverflowScrolling`
 *    + `overscroll-behavior: contain` (não vaza pro body).
 *  - Em desktop (width > 768 OU sem touch): dropdown inline antigo (mantido).
 *
 * Spec inspirada em Roteiro_Alinhamento_Dosy_v2 P4.1 MedicationPicker BottomSheet.
 *
 * Comportamento idêntico em ambos modos:
 *  - onChange(text) ao digitar
 *  - onSelectFull({name, principio_ativo, group_id, cmed_class, source}) ao escolher
 *  - Texto livre permitido (botão "Continuar com 'X' digitado" no picker mobile)
 */
export default function MedNameInput({ value, onChange, onSelectFull, required = true }) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [highlight, setHighlight] = useState(-1)
  const [debouncedValue, setDebouncedValue] = useState(value)
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(280)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches
  })
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const sheetInputRef = useRef(null)
  const debounceRef = useRef(null)
  const pickingRef = useRef(false)
  const listId = useId()

  const { data: userMeds = [] } = useUserMedications()
  const { data: catalogItems = [], isFetching: catalogFetching } = useMedCatalogSearch(debouncedValue)
  const { hintFor: userHintFor } = useUserMedicationCategories()

  // Detect mobile dinamicamente (orientation/resize)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    const onChange = () => setIsMobile(mq.matches || window.matchMedia('(pointer: coarse)').matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Debounce value pro RPC ANVISA (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedValue(value), 300)
    return () => clearTimeout(debounceRef.current)
  }, [value])

  // Telemetria search start throttled 5s
  const searchTrackedRef = useRef({ lastValue: null, lastTrackedAt: 0 })
  useEffect(() => {
    if (!debouncedValue || debouncedValue.length < 3) return
    const now = Date.now()
    const ref = searchTrackedRef.current
    if (ref.lastValue === debouncedValue) return
    if (now - ref.lastTrackedAt < 5000) return
    ref.lastValue = debouncedValue
    ref.lastTrackedAt = now
    try { track(EVENTS.MEDICATION_SEARCH_STARTED, { length: debouncedValue.length }) } catch {}
  }, [debouncedValue])

  // visualViewport — ajusta maxHeight dropdown desktop quando teclado abre (não mobile)
  useEffect(() => {
    if (isMobile || typeof window === 'undefined' || !window.visualViewport) return
    function recomputeHeight() {
      if (!wrapperRef.current) return
      const inputRect = wrapperRef.current.getBoundingClientRect()
      const vh = window.visualViewport.height
      const spaceBelow = vh - inputRect.bottom - 24
      setDropdownMaxHeight(Math.max(160, Math.min(spaceBelow, 380)))
    }
    recomputeHeight()
    window.visualViewport.addEventListener('resize', recomputeHeight)
    window.visualViewport.addEventListener('scroll', recomputeHeight)
    return () => {
      window.visualViewport.removeEventListener('resize', recomputeHeight)
      window.visualViewport.removeEventListener('scroll', recomputeHeight)
    }
  }, [open, isMobile])

  // Lock body scroll quando sheet mobile está aberto
  useEffect(() => {
    if (!isMobile || !open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [isMobile, open])

  // Auto-focus sheet input mobile
  useEffect(() => {
    if (isMobile && open && sheetInputRef.current) {
      // delay pra animation flush
      setTimeout(() => sheetInputRef.current?.focus(), 80)
    }
  }, [isMobile, open])

  // Merge fontes (histórico user + ANVISA + fallback local)
  const userMedsKey = useMemo(() => userMeds.join('|'), [userMeds])

  useEffect(() => {
    const local = suggestMedications(value, 4, userMeds)
    const normKey = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

    // v0.2.6.3 #0017 — source codes pra badge de origem no dropdown:
    //  'user'           → BD Pessoal (histórico do user)
    //  'cmed_dcb'       → CMED ANVISA (DCB — denominação comum brasileira)
    //  'cmed_comercial' → CMED ANVISA (nome comercial registrado)
    //  'free'           → texto livre (sem match) — sem badge
    //
    // BUG-MEDINPUT-001 fix (v0.2.8.2): quando nome local bate com catálogo,
    // promove a sugestão local pra fonte catálogo (cmed_dcb/cmed_comercial)
    // herdando is_dcb/cmed_class/group_id/principio_ativo do RPC search_medications.
    // Antes filtrava catálogo silenciosamente → badges CMED/DCB nunca renderizavam
    // pra meds com nome em ambas fontes (ex: "Amoxicilina", "Escitalopram").
    const catalogByKey = new Map((catalogItems || []).map((item) => [normKey(item.nome_comercial), item]))
    const localSuggestions = local.map((text) => {
      const hint = userHintFor ? userHintFor(text) : null
      const catalogMatch = catalogByKey.get(normKey(text))
      if (catalogMatch) {
        // Merge: catálogo Supabase é fonte autoritativa pra metadados
        return {
          text,
          principio: normKey(catalogMatch.principio_ativo) !== normKey(text) ? catalogMatch.principio_ativo : undefined,
          source: catalogMatch.is_dcb ? 'cmed_dcb' : 'cmed_comercial',
          is_dcb: !!catalogMatch.is_dcb,
          group_id: catalogMatch.group_id || hint?.group_id || null,
          cmed_class: catalogMatch.cmed_class || hint?.cmed_class || null,
          principio_ativo: catalogMatch.principio_ativo || hint?.principio_ativo || null,
        }
      }
      // Sem match no catálogo — só hint user ou livre
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
      .slice(0, isMobile ? 30 : 8) // mobile mostra mais (sheet tem mais espaço)
      .map((item) => ({
        text: item.nome_comercial,
        principio: normKey(item.principio_ativo) !== normKey(item.nome_comercial) ? item.principio_ativo : undefined,
        source: item.is_dcb ? 'cmed_dcb' : 'cmed_comercial',
        is_dcb: !!item.is_dcb,
        group_id: item.group_id || null,
        cmed_class: item.cmed_class || null,
        principio_ativo: item.principio_ativo || null,
      }))

    const merged = [...localSuggestions, ...catalogSuggestions]
    setSuggestions(merged)

    if (merged.length === 0) setHighlight(-1)
    else if (highlight >= merged.length) setHighlight(merged.length - 1)

    // Desktop only: abre dropdown se focado + sugestões + sem exact match
    if (!isMobile && document.activeElement === inputRef.current && !pickingRef.current) {
      const exact = merged.length > 0 && normKey(merged[0].text) === normKey(value)
      setOpen(merged.length > 0 && !exact)
    }
  }, [value, userMedsKey, catalogItems, isMobile, highlight, userHintFor])

  // Fechamento por tap fora (desktop dropdown)
  useEffect(() => {
    if (!open || isMobile) return
    function handleDocClick(e) {
      if (pickingRef.current) return
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleDocClick)
    return () => document.removeEventListener('pointerdown', handleDocClick)
  }, [open, isMobile])

  function handleChange(e) { onChange(e.target.value) }

  const handleFocus = useCallback(() => {
    if (isMobile) {
      // Em mobile: tap no input dispara abertura do sheet pleno (não digitação inline)
      setOpen(true)
      // blur input externo pra teclado não abrir embaixo (sheet input ganha foco)
      inputRef.current?.blur()
      return
    }
    if (suggestions.length > 0 && value && value.length >= 2) {
      const exact = suggestions.length > 0 && (suggestions[0].text || '').toLowerCase() === value.toLowerCase()
      if (!exact) setOpen(true)
    }
  }, [isMobile, suggestions, value])

  const pick = useCallback((item) => {
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
    setTimeout(() => { pickingRef.current = false }, 300)
  }, [onChange, onSelectFull])

  const closeSheet = useCallback(() => {
    setOpen(false)
    setHighlight(-1)
  }, [])

  function handleKeyDown(e) {
    if (isMobile) {
      // No mobile o keydown principal é dentro do sheet
      return
    }
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

  // ─── Common item renderer ─────────────────────────────────────────
  const renderSuggestionItem = (item, i, opts = {}) => {
    const { large = false, onPick = pick } = opts
    const isHl = i === highlight
    const padding = large ? '18px 18px' : '14px 16px'
    const minH = large ? 64 : 56
    return (
      <li
        key={`${item.text}-${i}`}
        id={`${listId}-opt-${i}`}
        role="option"
        aria-selected={isHl}
        onPointerDown={(e) => { e.preventDefault(); onPick(item) }}
        onClick={() => onPick(item)}
        style={{
          padding,
          minHeight: minH,
          fontSize: large ? 15 : 14,
          cursor: 'pointer',
          userSelect: 'none',
          background: isHl ? 'var(--dosy-peach-100)' : 'transparent',
          color: 'var(--dosy-fg)',
          fontWeight: isHl ? 600 : 500,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--dosy-border-faint, rgba(0,0,0,0.05))',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>{highlightMatch(item.text, value)}</span>
            {/* v0.2.6.3 #0017 — badge de origem do match */}
            {item.source === 'cmed_dcb' && (
              <span aria-label="Denominação Comum Brasileira — ANVISA" title="DCB · ANVISA" style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: 'var(--dosy-blue-100, #e0f2fe)',
                color: 'var(--dosy-blue-600, #0369a1)',
                letterSpacing: '0.5px',
              }}>DCB ANVISA</span>
            )}
            {item.source === 'cmed_comercial' && (
              <span aria-label="Catálogo CMED ANVISA" title="CMED ANVISA — Câmara de Regulação de Preços" style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: 'var(--dosy-emerald-100, #d1fae5)',
                color: 'var(--dosy-emerald-700, #047857)',
                letterSpacing: '0.5px',
              }}>CMED</span>
            )}
            {item.source === 'user' && (
              <span aria-label="Catálogo pessoal — usado por você antes" title="BD pessoal — você já usou esse medicamento" style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: 'var(--dosy-peach-100, #ffedd5)',
                color: 'var(--dosy-orange-700, #c2410c)',
                letterSpacing: '0.5px',
              }}>SEU</span>
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
            }}>{item.principio}</div>
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
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: getGroup(item.group_id).color }} aria-hidden="true" />
            {getGroup(item.group_id).label}
          </span>
        )}
      </li>
    )
  }

  // ─── MOBILE: Sheet picker fullscreen ──────────────────────────────
  if (isMobile) {
    return (
      <div ref={wrapperRef} className="relative w-full">
        {/* "Botão" disfarçado de input — abre o sheet */}
        <button
          type="button"
          data-testid="med-name-input-trigger"
          onClick={handleFocus}
          aria-haspopup="dialog"
          aria-expanded={open}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: 16,
            background: 'var(--dosy-bg-elevated)',
            boxShadow: 'var(--dosy-shadow-xs)',
            border: '1.5px solid transparent',
            fontSize: 15,
            color: value ? 'var(--dosy-fg)' : 'var(--dosy-fg-muted)',
            outline: 'none',
            fontFamily: 'var(--dosy-font-body)',
            textAlign: 'left',
            cursor: 'pointer',
            minHeight: 52,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Pill size={18} color="var(--dosy-fg-muted)" strokeWidth={1.75} />
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value || 'Toque para buscar medicamento…'}
          </span>
        </button>

        {/* Sheet fullscreen — fixed position, escapa do scroll do body */}
        {open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar medicamento"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1500,
              background: 'var(--dosy-bg, #fff)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'dosy-slide-up 220ms var(--dosy-ease-out) both',
              fontFamily: 'var(--dosy-font-body)',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Header com input fixo */}
            <div style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--dosy-border-faint, rgba(0,0,0,0.08))',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--dosy-bg, #fff)',
              flexShrink: 0,
            }}>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Fechar"
                style={{
                  width: 40, height: 40,
                  borderRadius: 999,
                  background: 'var(--dosy-bg-sunken)',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <XIcon size={20} color="var(--dosy-fg)" strokeWidth={2} />
              </button>
              <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}>
                <Search size={18} color="var(--dosy-fg-muted)" strokeWidth={2} style={{ position: 'absolute', left: 14 }} />
                <input
                  ref={sheetInputRef}
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  value={value}
                  onChange={handleChange}
                  placeholder="Ex: Paracetamol, Amoxi…"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: 12,
                    border: '1.5px solid var(--dosy-border)',
                    background: 'var(--dosy-bg-elevated)',
                    fontSize: 16, // ≥16px previne zoom auto Android Chrome
                    color: 'var(--dosy-fg)',
                    outline: 'none',
                    fontFamily: 'var(--dosy-font-body)',
                  }}
                />
              </div>
            </div>

            {/* Lista — flex-1 + overflow-y; teclado NUNCA cobre porque sheet
                é position:fixed + visualViewport tradicionalmente reduz
                a área visível mas mantém o input acima. */}
            <ul
              id={listId}
              role="listbox"
              style={{
                flex: 1,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                margin: 0,
                padding: '4px 0 12px 0',
                listStyle: 'none',
                background: 'var(--dosy-bg, #fff)',
              }}
            >
              {/* Loading state quando catálogo busca */}
              {catalogFetching && suggestions.length === 0 && (
                <li style={{ padding: '24px 18px', fontSize: 13, color: 'var(--dosy-fg-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                  Buscando no catálogo ANVISA…
                </li>
              )}

              {/* Sem nada digitado: hint */}
              {!value && (
                <li style={{ padding: '24px 18px', fontSize: 13, color: 'var(--dosy-fg-muted)', textAlign: 'center' }}>
                  Comece a digitar para ver sugestões.
                </li>
              )}

              {/* Sugestões */}
              {suggestions.map((item, i) => renderSuggestionItem(item, i, { large: true }))}

              {/* Continuar com texto livre */}
              {value && value.trim().length >= 1 && (
                <li
                  onPointerDown={(e) => {
                    e.preventDefault()
                    pick({
                      text: value.trim(),
                      source: 'free',
                      principio_ativo: null,
                      group_id: null,
                      cmed_class: null,
                    })
                  }}
                  onClick={() => pick({
                    text: value.trim(),
                    source: 'free',
                    principio_ativo: null,
                    group_id: null,
                    cmed_class: null,
                  })}
                  style={{
                    margin: '8px 14px',
                    padding: '14px 16px',
                    minHeight: 56,
                    borderRadius: 14,
                    background: 'transparent',
                    border: '1.5px dashed var(--dosy-border)',
                    color: 'var(--dosy-fg-muted)',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                  Continuar com <strong style={{ color: 'var(--dosy-fg)' }}>{value.trim()}</strong>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // ─── DESKTOP: dropdown inline antigo ──────────────────────────────
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
            overscrollBehavior: 'contain',
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
          {suggestions.map((item, i) => renderSuggestionItem(item, i))}
          {catalogFetching && (
            <li style={{ padding: '10px 16px', fontSize: 11, color: 'var(--dosy-fg-muted)', fontStyle: 'italic', listStyle: 'none' }}>
              buscando no catálogo ANVISA…
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
