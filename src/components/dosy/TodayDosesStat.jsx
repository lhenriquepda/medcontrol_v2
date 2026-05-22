/**
 * TodayDosesStat — Refactor Fase 4 (Refactor_Full.md §11.3 item 9).
 *
 * Wrapper "Doses Hoje X de Y" — gauge + título + subtitle. Substitui
 * blocos inline em Dashboard (hero card) + PatientDetail (stat card).
 *
 * Uso:
 *   <TodayDosesStat taken={3} total={5} />
 *   <TodayDosesStat taken={3} total={5} compact showOverdue={2} />
 */
import { HeroGauge } from './HeroGauge'
import { Card } from './surfaces'

export default function TodayDosesStat({
  taken = 0,
  total = 0,
  compact = false,
  showOverdue = null,
  variant = 'hero',
}) {
  const pending = Math.max(total - taken, 0)
  const totalEffective = Math.max(total, 1)
  const gaugeSize = compact ? 72 : 108

  if (variant === 'mini') {
    return (
      <Card padding={compact ? 12 : 16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <HeroGauge taken={taken} total={totalEffective} size={gaugeSize}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
              margin: 0, fontFamily: 'var(--dosy-font-display)',
            }}>Hoje</p>
            <p style={{
              fontSize: compact ? 16 : 18, fontWeight: 800,
              letterSpacing: '-0.015em', color: 'var(--dosy-fg)',
              margin: '2px 0 0 0', fontFamily: 'var(--dosy-font-display)',
            }}>
              {pending === 0 ? 'Tá em dia' : `${pending} pendente${pending === 1 ? '' : 's'}`}
            </p>
            {showOverdue != null && showOverdue > 0 && (
              <p style={{
                fontSize: 12, color: 'var(--dosy-danger)',
                margin: '2px 0 0 0', fontWeight: 600,
              }}>
                {showOverdue} atrasada{showOverdue === 1 ? '' : 's'} agora
              </p>
            )}
          </div>
        </div>
      </Card>
    )
  }

  // Default 'hero' variant — usado em Dashboard.
  return (
    <Card
      padding={compact ? 18 : 22}
      style={{
        background: 'var(--dosy-gradient-sunset)',
        color: 'var(--dosy-fg-on-sunset)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <HeroGauge taken={taken} total={totalEffective} size={gaugeSize}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', opacity: 0.85,
            margin: 0, fontFamily: 'var(--dosy-font-display)',
          }}>Hoje</p>
          <p style={{
            fontSize: compact ? 22 : 28, fontWeight: 800,
            letterSpacing: '-0.025em',
            margin: '2px 0 0 0', fontFamily: 'var(--dosy-font-display)',
            lineHeight: 1.1,
          }}>
            {pending === 0 ? 'Tá em dia' : `${pending} pendente${pending === 1 ? '' : 's'}`}
          </p>
          {showOverdue != null && showOverdue > 0 && (
            <p style={{
              fontSize: 13, opacity: 0.92,
              margin: '4px 0 0 0', fontWeight: 600,
            }}>
              {showOverdue} atrasada{showOverdue === 1 ? '' : 's'} agora
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
