import { useState } from 'react'
import { Filter, X as XIcon, Clock, AlertTriangle, Check, SkipForward, Calendar, Siren } from 'lucide-react'
import { Sheet, Button, Chip } from './dosy'
import PatientPicker from './PatientPicker'

// #137 (release v0.2.0.9 — egress-audit) — removido 'Tudo' (rangeNow('all')
// retornava {null,null} forçando filter consumir TODO histórico via PostgREST
// = egress massivo. Substituído por '10d' fechado. Histórico completo
// continua via /historico (DoseHistory) com range customizado por usuário.
const RANGES = [
  { key: '12h', label: '12h' },
  { key: '24h', label: '24h' },
  { key: '48h', label: '48h' },
  { key: '7d',  label: '7 dias' },
  { key: '10d', label: '10 dias' },
]

const STATUS = [
  { key: 'pending', label: 'Pendente', Icon: Clock,         tone: { color: 'var(--dosy-fg-secondary)', bg: 'var(--dosy-peach-100)' } },
  { key: 'overdue', label: 'Atrasada', Icon: AlertTriangle, tone: { color: 'var(--dosy-danger)',       bg: 'var(--dosy-danger-bg)' } },
  { key: 'done',    label: 'Tomada',   Icon: Check,         tone: { color: '#3F9E7E',                  bg: '#DDF1E8' } },
  { key: 'skipped', label: 'Pulada',   Icon: SkipForward,   tone: { color: '#C5841A',                  bg: 'var(--dosy-warning-bg)' } },
]

const TYPES = [
  { key: 'scheduled', label: 'Horário fixo', Icon: Calendar, hint: 'Doses com horário marcado' },
  { key: 'sos',       label: 'S.O.S',        Icon: Siren,    hint: 'Se necessário' },
]

export default function FilterBar({ filters, setFilters, patients }) {
  const [open, setOpen] = useState(false)

  const activeCount =
    (filters.status ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.patientId ? 1 : 0)

  const activeChips = []
  if (filters.patientId) {
    const p = patients?.find((x) => x.id === filters.patientId)
    if (p) activeChips.push({
      key: 'p',
      label: `${p.avatar || '🙂'} ${p.name.split(' ')[0]}`, // #100 default avatar
      clear: () => setFilters((f) => ({ ...f, patientId: null })),
    })
  }
  if (filters.status) {
    const s = STATUS.find((x) => x.key === filters.status)
    activeChips.push({
      key: 's',
      label: s.label,
      clear: () => setFilters((f) => ({ ...f, status: null })),
    })
  }
  if (filters.type) {
    const t = TYPES.find((x) => x.key === filters.type)
    activeChips.push({
      key: 't',
      label: t.label,
      clear: () => setFilters((f) => ({ ...f, type: null })),
    })
  }

  function clearAll() {
    setFilters((f) => ({ ...f, patientId: null, status: null, type: null }))
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 'calc(var(--ad-banner-height, 0px) + var(--update-banner-height, 0px) + var(--app-header-height, 84px))',
        zIndex: 30,
        background: 'color-mix(in oklab, var(--dosy-bg) 90%, transparent)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--dosy-border)',
      }}
    >
      <div
        className="max-w-md mx-auto"
        style={{
          padding: '10px 22px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        {/* Period chips horizontal scroll + Filtros button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className="dosy-scroll"
            style={{
              flex: 1, minWidth: 0,
              display: 'flex', gap: 6,
              overflowX: 'auto',
              padding: 2,
            }}
          >
            {RANGES.map((r) => (
              <Chip
                key={r.key}
                size="sm"
                active={filters.range === r.key}
                onClick={() => setFilters((f) => ({ ...f, range: r.key }))}
              >
                {r.label}
              </Chip>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir filtros"
            className="dosy-press"
            style={{
              position: 'relative',
              width: 38, height: 38, borderRadius: 9999,
              background: 'var(--dosy-bg-elevated)',
              color: 'var(--dosy-fg)',
              boxShadow: 'var(--dosy-shadow-sm)',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Filter size={16} strokeWidth={1.75}/>
            {activeCount > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                minWidth: 18, height: 18, padding: '0 5px',
                borderRadius: 9999,
                background: 'var(--dosy-gradient-sunset)',
                color: 'var(--dosy-fg-on-sunset)',
                fontSize: 10.5, fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'var(--dosy-font-display)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 2px var(--dosy-bg)',
                lineHeight: 1,
              }}>{activeCount}</span>
            )}
          </button>
        </div>

        {/* Active chips row */}
        {activeChips.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
          }}>
            {activeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={c.clear}
                className="dosy-press"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px',
                  background: 'var(--dosy-peach-100)',
                  color: 'var(--dosy-fg)',
                  borderRadius: 9999,
                  border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  fontFamily: 'var(--dosy-font-body)',
                }}
              >
                {c.label}
                <XIcon size={11} strokeWidth={2} style={{ opacity: 0.6 }}/>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              style={{
                fontSize: 11, color: 'var(--dosy-fg-secondary)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                marginLeft: 4, textDecoration: 'underline',
                fontFamily: 'var(--dosy-font-body)',
              }}
            >
              limpar
            </button>
          </div>
        )}
      </div>

      {/* Filtros Sheet */}
      <Sheet open={open} onClose={() => setOpen(false)} title="Filtros">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {patients && patients.length > 0 && (
            <Section title="Paciente">
              <PatientPicker
                patients={patients}
                value={filters.patientId}
                onChange={(id) => setFilters((f) => ({ ...f, patientId: id }))}
                allowAll
                placeholder="Todos pacientes"
              />
            </Section>
          )}

          <Section title="Status">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {STATUS.map((s) => {
                const active = filters.status === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setFilters((f) => {
                      const nextStatus = f.status === s.key ? null : s.key
                      // #137: 'all' removido — usar '7d' (máximo visível) ao escolher status
                      return { ...f, status: nextStatus, range: nextStatus ? '7d' : f.range }
                    })}
                    className="dosy-press"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: active ? s.tone.bg : 'var(--dosy-bg-sunken)',
                      color: active ? s.tone.color : 'var(--dosy-fg)',
                      border: active ? '2px solid var(--dosy-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      fontSize: 14, fontWeight: 600,
                      letterSpacing: '-0.01em',
                      fontFamily: 'var(--dosy-font-body)',
                    }}
                  >
                    <s.Icon size={18} strokeWidth={1.75}/>
                    {s.label}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Tipo">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TYPES.map((t) => {
                const active = filters.type === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, type: f.type === t.key ? null : t.key }))}
                    className="dosy-press"
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: active ? 'var(--dosy-peach-100)' : 'var(--dosy-bg-sunken)',
                      color: active ? 'var(--dosy-fg)' : 'var(--dosy-fg)',
                      border: active ? '2px solid var(--dosy-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      fontFamily: 'var(--dosy-font-body)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                    }}>
                      <t.Icon size={18} strokeWidth={1.75}/>
                      {t.label}
                    </span>
                    <span style={{
                      fontSize: 11, color: 'var(--dosy-fg-tertiary)',
                      fontWeight: 500, lineHeight: 1.3,
                    }}>{t.hint}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button kind="secondary" full onClick={clearAll}>Limpar</Button>
            <Button kind="primary" full onClick={() => setOpen(false)}>Aplicar</Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p style={{
        fontSize: 11, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--dosy-fg-secondary)',
        margin: '0 0 10px 4px',
        fontFamily: 'var(--dosy-font-display)',
      }}>{title}</p>
      {children}
    </div>
  )
}
