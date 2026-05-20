/**
 * EmptyState — Refactor Fase 4 (Refactor_Full.md §11.3 item 1).
 *
 * Substitui blocos inline "Nenhum X cadastrado" em Dashboard, Patients,
 * PatientDetail, DoseHistory, TreatmentList. Centraliza copy + visual.
 *
 * Uso:
 *   <EmptyState kind="no-doses" />
 *   <EmptyState
 *     icon={<Pill size={24} />}
 *     title="Sem doses no filtro"
 *     message="Ajuste o período ou crie um tratamento."
 *     action={<Button>Novo tratamento</Button>}
 *   />
 *
 * Variantes built-in: no-patients, no-doses, no-treatments, no-results-filter.
 */
import { Users, Pill, ClipboardList, Filter } from 'lucide-react'
import { Card } from './surfaces'

const VARIANTS = {
  'no-patients': {
    icon: <Users size={28} strokeWidth={1.5} />,
    title: 'Nenhum paciente cadastrado',
    message: 'Comece cadastrando seu primeiro paciente para acompanhar doses.',
  },
  'no-doses': {
    icon: <Pill size={28} strokeWidth={1.5} />,
    title: 'Nenhuma dose neste período',
    message: 'Ajuste o filtro de período ou crie um tratamento novo.',
  },
  'no-treatments': {
    icon: <ClipboardList size={28} strokeWidth={1.5} />,
    title: 'Sem tratamentos ativos',
    message: 'Crie um tratamento para começar a registrar doses.',
  },
  'no-results-filter': {
    icon: <Filter size={28} strokeWidth={1.5} />,
    title: 'Sem resultados',
    message: 'Nenhum item encontrado para os filtros atuais. Tente ampliar o período ou limpar filtros.',
  },
}

export default function EmptyState({
  kind,
  icon,
  title,
  message,
  action,
  compact = false,
}) {
  const v = kind ? VARIANTS[kind] : null
  const finalIcon = icon ?? v?.icon
  const finalTitle = title ?? v?.title ?? 'Sem dados'
  const finalMessage = message ?? v?.message ?? ''

  return (
    <Card
      padding={compact ? 20 : 28}
      style={{
        textAlign: 'center',
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? 10 : 14,
      }}
    >
      {finalIcon && (
        <div
          style={{
            width: compact ? 52 : 64,
            height: compact ? 52 : 64,
            borderRadius: 16,
            background: 'var(--dosy-peach-100)',
            color: 'var(--dosy-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {finalIcon}
        </div>
      )}
      <div>
        <h3
          style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 800,
            fontSize: compact ? 16 : 18,
            letterSpacing: '-0.015em',
            color: 'var(--dosy-fg)',
            margin: 0,
          }}
        >
          {finalTitle}
        </h3>
        {finalMessage && (
          <p
            style={{
              fontSize: 13.5,
              color: 'var(--dosy-fg-secondary)',
              margin: '6px 0 0 0',
              lineHeight: 1.45,
            }}
          >
            {finalMessage}
          </p>
        )}
      </div>
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </Card>
  )
}
