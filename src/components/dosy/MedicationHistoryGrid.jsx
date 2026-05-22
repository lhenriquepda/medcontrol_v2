/**
 * MedicationHistoryGrid — Refactor Fase 4 (Refactor_Full.md §11.3 item 10).
 *
 * Substitui top/recent meds grid em SOS.jsx (recentMeds — autocompletar
 * rápido) + Analytics.jsx (topMeds — ranking).
 *
 * Uso:
 *   <MedicationHistoryGrid
 *     meds={[{ name, unit, count }, ...]}
 *     variant="cards"   // ou "list"
 *     showCount
 *     onSelect={(med) => preencherForm(med)}
 *   />
 */
import { Pill } from 'lucide-react'

export default function MedicationHistoryGrid({
  meds = [],
  variant = 'cards',
  showCount = true,
  onSelect,
  emptyMessage,
}) {
  if (!Array.isArray(meds) || meds.length === 0) {
    if (!emptyMessage) return null
    return (
      <p style={{
        fontSize: 13,
        color: 'var(--dosy-fg-tertiary)',
        textAlign: 'center',
        padding: '12px 0',
        margin: 0,
      }}>
        {emptyMessage}
      </p>
    )
  }

  if (variant === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {meds.map((m, i) => (
          <button
            key={m.id || m.name || i}
            type="button"
            onClick={() => onSelect?.(m)}
            className="dosy-press"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: 'var(--dosy-bg-elevated)',
              border: 'none', borderRadius: 12,
              cursor: onSelect ? 'pointer' : 'default',
              textAlign: 'left',
              boxShadow: 'var(--dosy-shadow-xs)',
            }}
          >
            <Pill size={18} strokeWidth={1.75} style={{ color: 'var(--dosy-primary)', flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--dosy-font-display)',
                fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em',
                margin: 0, color: 'var(--dosy-fg)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{m.name}</p>
              {m.unit && (
                <p style={{
                  fontSize: 12, color: 'var(--dosy-fg-secondary)',
                  margin: '1px 0 0 0',
                }}>{m.unit}</p>
              )}
            </div>
            {showCount && m.count != null && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--dosy-fg-tertiary)',
                background: 'var(--dosy-bg-sunken)',
                padding: '3px 8px', borderRadius: 999,
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}>{m.count}×</span>
            )}
          </button>
        ))}
      </div>
    )
  }

  // Default 'cards' variant — grid 2-col.
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
    }}>
      {meds.map((m, i) => (
        <button
          key={m.id || m.name || i}
          type="button"
          onClick={() => onSelect?.(m)}
          className="dosy-press"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
            padding: '12px 14px',
            background: 'var(--dosy-bg-elevated)',
            border: 'none', borderRadius: 14,
            cursor: onSelect ? 'pointer' : 'default',
            textAlign: 'left',
            boxShadow: 'var(--dosy-shadow-sm)',
            minHeight: 64,
          }}
        >
          <p style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 700, fontSize: 13.5, letterSpacing: '-0.01em',
            margin: 0, color: 'var(--dosy-fg)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            width: '100%',
          }}>{m.name}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
            {m.unit && (
              <span style={{
                fontSize: 11, color: 'var(--dosy-fg-secondary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{m.unit}</span>
            )}
            {showCount && m.count != null && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, color: 'var(--dosy-fg-tertiary)',
                marginLeft: 'auto',
                fontVariantNumeric: 'tabular-nums',
              }}>{m.count}×</span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
