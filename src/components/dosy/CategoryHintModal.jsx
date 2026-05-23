/**
 * CategoryHintModal — v0.2.5.0 fix Escitalopram
 *
 * Modal que aparece quando user tenta salvar tratamento/SOS sem
 * categoria preenchida. Mostra top-3 categorias sugeridas (heurística
 * sufixo farmacológico + histórico user + fallback global) + opção
 * "Ver todas as categorias" pra abrir o CategoryPicker completo.
 *
 * Bem menos friction que campo required vazio.
 */
import { useEffect, useMemo } from 'react'
import { Sheet, Button } from './surfaces.jsx'
import { MED_GROUPS, getGroup } from '../../constants/medCategories.js'
import { inferGroupsFromName } from '../../constants/groupKeywords.js'
// v0.2.6.1 — telemetria categoria (Roteiro_Alinhamento)
import { track, EVENTS } from '../../services/analytics.js'

const FALLBACK_TOP3 = ['antitermico_analgesico', 'antibiotico', 'anti_hipertensivo']

export default function CategoryHintModal({
  open,
  medName,
  onClose,
  onSelect,
  onOpenFullPicker,
  userHistoryGroups = [], // array de group_ids mais usados pelo user
}) {
  const suggestedGroups = useMemo(() => {
    if (!medName) return FALLBACK_TOP3
    // Camada 1: sufixo farmacológico (ex: -pram → antidepressivo)
    const fromKeywords = inferGroupsFromName(medName, 3)
    if (fromKeywords.length >= 3) return fromKeywords
    // Camada 2: histórico do user (top N grupos usados antes)
    const fromHistory = (userHistoryGroups || []).filter(g => !fromKeywords.includes(g))
    const combined = [...fromKeywords, ...fromHistory].slice(0, 3)
    if (combined.length >= 3) return combined
    // Camada 3: fallback global
    const remaining = FALLBACK_TOP3.filter(g => !combined.includes(g))
    return [...combined, ...remaining].slice(0, 3)
  }, [medName, userHistoryGroups])

  // v0.2.6.1 — telemetria: modal aberto (1× por open transition)
  useEffect(() => {
    if (!open) return
    try {
      track(EVENTS.CATEGORY_SUGGESTION_SHOWN, {
        suggested_count: suggestedGroups.length,
        has_user_history: (userHistoryGroups || []).length > 0,
      })
    } catch {}
  }, [open, suggestedGroups.length, userHistoryGroups])

  function handleSelect(groupId) {
    try {
      track(EVENTS.CATEGORY_SUGGESTION_ACCEPTED, { group_id: groupId, position: suggestedGroups.indexOf(groupId) })
    } catch {}
    onSelect(groupId)
  }

  function handleClose() {
    try { track(EVENTS.CATEGORY_SUGGESTION_SKIPPED) } catch {}
    onClose?.()
  }

  function handleOpenFullPicker() {
    try { track(EVENTS.CATEGORY_PICKED_MANUAL, { from: 'hint_modal_full_link' }) } catch {}
    onOpenFullPicker?.()
  }

  if (!open) return null

  return (
    <Sheet open={open} onClose={handleClose} title="Qual a categoria?">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--dosy-fg-muted)',
          fontFamily: 'var(--dosy-font-body)',
          lineHeight: 1.5,
        }}>
          Não conseguimos detectar a categoria de <strong style={{ color: 'var(--dosy-fg)' }}>{medName || 'esse medicamento'}</strong> automaticamente.
          Escolha uma das opções sugeridas:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suggestedGroups.map((groupId) => {
            const g = getGroup(groupId)
            return (
              <button
                key={groupId}
                type="button"
                onClick={() => handleSelect(groupId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 18px',
                  borderRadius: 14,
                  background: 'var(--dosy-bg-elevated)',
                  border: '1.5px solid var(--dosy-border)',
                  cursor: 'pointer',
                  fontFamily: 'var(--dosy-font-body)',
                  minHeight: 56,
                  transition: 'border-color 150ms var(--dosy-ease-out), transform 100ms',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--dosy-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--dosy-border)' }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: g.color,
                  flexShrink: 0,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                }} aria-hidden="true" />
                <span style={{
                  fontSize: 15, fontWeight: 600,
                  color: 'var(--dosy-fg)', flex: 1,
                }}>
                  {g.label}
                </span>
                <span aria-hidden="true" style={{ color: 'var(--dosy-fg-muted)', fontSize: 18 }}>→</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={handleOpenFullPicker}
          style={{
            padding: '14px 18px',
            borderRadius: 14,
            background: 'transparent',
            border: '1.5px dashed var(--dosy-border)',
            color: 'var(--dosy-fg-muted)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--dosy-font-body)',
            minHeight: 48,
          }}
        >
          Ver todas as {MED_GROUPS.length} categorias…
        </button>
      </div>
    </Sheet>
  )
}
