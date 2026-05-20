/**
 * TreatmentCard — Refactor Fase 4 (Refactor_Full.md §11.3 item 8).
 *
 * Substitui renderização inline de tratamento em PatientDetail
 * TreatmentSection + TreatmentList. Card click→detalhe + status pill +
 * dose count badge.
 *
 * Uso:
 *   <TreatmentCard treatment={t} status="active" />
 *   <TreatmentCard treatment={t} status="paused" upcomingDoses={3} onClick={...} />
 */
import { Link } from 'react-router-dom'
import { Pill, ChevronRight } from 'lucide-react'
import { StatusPill } from './feedback'

const STATUS_LABEL = {
  active:       { label: 'Ativo',           kind: 'success' },
  paused:       { label: 'Pausado',         kind: 'pending' },
  ended:        { label: 'Encerrado',       kind: 'skipped' },
  'auto-ended': { label: 'Encerrado',       kind: 'skipped' },
}

export default function TreatmentCard({
  treatment,
  status,
  upcomingDoses = null,
  to,
  onClick,
}) {
  if (!treatment) return null
  const cfg = STATUS_LABEL[status] || STATUS_LABEL.active
  const isInactive = status === 'paused' || status === 'ended' || status === 'auto-ended'
  const href = to ?? `/tratamento/${treatment.id}`

  const content = (
    <div
      className="dosy-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 14,
        background: 'var(--dosy-bg-elevated)',
        borderRadius: 16,
        boxShadow: 'var(--dosy-shadow-sm)',
        textDecoration: 'none',
        color: 'var(--dosy-fg)',
        opacity: isInactive ? 0.78 : 1,
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: 'var(--dosy-peach-100)',
        color: 'var(--dosy-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Pill size={20} strokeWidth={2}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--dosy-font-display)',
          fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.01em',
          margin: 0, color: 'var(--dosy-fg)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{treatment.medName}</p>
        <p style={{
          fontSize: 12.5, color: 'var(--dosy-fg-secondary)',
          margin: '2px 0 0 0',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {treatment.unit ? `${treatment.unit}` : ''}
          {treatment.intervalHours ? ` · ${treatment.intervalHours}h` : ''}
          {upcomingDoses != null && upcomingDoses > 0 && (
            <> · {upcomingDoses} próxima{upcomingDoses === 1 ? '' : 's'}</>
          )}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <StatusPill label={cfg.label} kind={cfg.kind}/>
        <ChevronRight size={18} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)' }}/>
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left' }}
      >
        {content}
      </button>
    )
  }

  return (
    <Link to={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      {content}
    </Link>
  )
}
