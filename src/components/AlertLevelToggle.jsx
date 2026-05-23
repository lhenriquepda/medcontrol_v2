// v0.2.6.1 P4.7a (Roteiro_Alinhamento_Dosy_v2) — AlertLevelToggle 3-segmentos.
//
// Per-treatment override do switch global Alarme Crítico. Cobre:
//   - Persona 2 Helena (PRD §4.1): tratamentos críticos cheios + suplementos silenciosos.
//   - Persona 3 Patrícia: hipertensivos críticos + vitaminas silenciosas.
//
// Uso:
//   <AlertLevelToggle treatmentId={t.id} level={current} onChange={(next) => mutate(next)} />
//
// Visual: 3 chips (Crítico / Push / Silenc.) com active state colorido (sunset/peach/muted).

import { AlarmClock, Bell, BellOff } from 'lucide-react'
import { ALERT_LEVELS } from '../hooks/useTreatmentAlertLevel'

const ICONS = { critical: AlarmClock, push: Bell, silent: BellOff }
const ACTIVE_COLORS = {
  critical: 'var(--dosy-primary)',
  push:     'var(--dosy-accent, #6366f1)',
  silent:   'var(--dosy-fg-tertiary, #94a3b8)',
}

export default function AlertLevelToggle({
  level = 'critical',
  onChange,
  disabled = false,
  size = 'md',
  ariaLabel = 'Nível de alerta deste tratamento',
}) {
  const isSm = size === 'sm'
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        background: 'var(--dosy-bg-sunken)',
        borderRadius: 999,
        border: '1px solid var(--dosy-border-faint)',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {ALERT_LEVELS.map((opt) => {
        const Icon = ICONS[opt.id] ?? AlarmClock
        const active = level === opt.id
        const activeColor = ACTIVE_COLORS[opt.id]
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${opt.label} — ${opt.description}`}
            onClick={() => onChange?.(opt.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: isSm ? '5px 10px' : '7px 12px',
              borderRadius: 999,
              border: 'none',
              background: active ? activeColor : 'transparent',
              color: active ? 'white' : 'var(--dosy-fg-secondary)',
              fontSize: isSm ? 11 : 12,
              fontWeight: active ? 700 : 600,
              cursor: 'pointer',
              transition: 'background 120ms ease, color 120ms ease',
              fontFamily: 'var(--dosy-font-body)',
              minHeight: isSm ? 28 : 32,
            }}
          >
            <Icon size={isSm ? 12 : 13} strokeWidth={active ? 2.4 : 2} />
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
