import { useMemo, useState } from 'react'
import { Search, X as XIcon, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import AdBanner from '../components/AdBanner'
import PatientPicker from '../components/PatientPicker'
import DoseModal from '../components/DoseModal'
import { SkeletonList } from '../components/Skeleton'
import { Card, Chip, Input } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'
import { formatTime, pad } from '../utils/dateUtils'
import { STATUS_CONFIG } from '../utils/statusUtils'
import { usePrivacyScreen } from '../hooks/usePrivacyScreen'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function endOfDay(d)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function dayLabel(date) {
  const d = new Date(date)
  const today = startOfDay(new Date())
  const diff = Math.round((startOfDay(d) - today) / 86400000)
  const weekday = DIAS_SEMANA[d.getDay()]
  const dateStr = `${pad(d.getDate())} ${MESES[d.getMonth()]}`
  if (diff === 0) return { label: 'Hoje', sub: dateStr, highlight: true }
  if (diff === -1) return { label: 'Ontem', sub: dateStr, highlight: false }
  return { label: weekday, sub: dateStr, highlight: false }
}

const DOSE_STATUS_DOSY = {
  done:    { color: '#3F9E7E', bg: '#DDF1E8' },
  pending: { color: 'var(--dosy-fg-secondary)', bg: 'var(--dosy-peach-100)' },
  overdue: { color: 'var(--dosy-danger)', bg: 'var(--dosy-danger-bg)' },
  skipped: { color: 'var(--dosy-fg-tertiary)', bg: 'var(--dosy-bg-sunken)' },
}

export default function DoseHistory() {
  // Aud 4.5.4 G2 — histórico de doses (info médica longitudinal)
  usePrivacyScreen()
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState(null)
  const [period, setPeriod] = useState(7)
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  const { periodStart, periodEnd } = useMemo(() => {
    const base = startOfDay(new Date())
    const end = addDays(base, -(offset * period))
    const start = addDays(end, -(period - 1))
    return { periodStart: startOfDay(start), periodEnd: endOfDay(end) }
  }, [period, offset])

  const { data: rawDoses = [], isLoading } = useDoses({
    from: periodStart.toISOString(),
    to: periodEnd.toISOString(),
    patientId: patientId || undefined,
  })

  const doses = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rawDoses
    return rawDoses.filter((d) =>
      (d.medName || '').toLowerCase().includes(term) ||
      (d.unit || '').toLowerCase().includes(term) ||
      (d.observation || '').toLowerCase().includes(term),
    )
  }, [rawDoses, search])

  const days = useMemo(() => {
    const map = new Map()
    for (const d of doses) {
      const key = startOfDay(d.scheduledAt).toISOString()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(d)
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, list]) => ({ date: new Date(key), list }))
  }, [doses])

  const summary = useMemo(() => {
    const past = doses.filter((d) => new Date(d.scheduledAt) <= new Date())
    const done = past.filter((d) => d.status === 'done').length
    const skipped = past.filter((d) => d.status === 'skipped').length
    const missed = past.filter((d) => d.status === 'overdue').length
    const total = past.length
    const pct = total ? Math.round((done / total) * 100) : null
    return { done, skipped, missed, total, pct }
  }, [doses])

  const isCurrentPeriod = offset === 0
  const selectedPatient = selected && patients.find((p) => p.id === selected.patientId)

  function periodLabel() {
    const opts = { day: '2-digit', month: 'short' }
    return `${periodStart.toLocaleDateString('pt-BR', opts)} – ${periodEnd.toLocaleDateString('pt-BR', opts)}`
  }

  return (
    <div style={{ paddingBottom: 110 }}>
      <PageHeader title="Histórico de doses" back/>

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AdBanner />

        {/* Period chips + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[7, 14, 30].map((d) => (
              <Chip
                key={d}
                size="sm"
                active={period === d}
                onClick={() => { setPeriod(d); setOffset(0) }}
              >
                {d === 7 ? '7d' : d === 14 ? '14d' : '30d'}
              </Chip>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            aria-label="Período anterior"
            className="dosy-press"
            style={{
              width: 38, height: 38, borderRadius: 9999,
              background: 'var(--dosy-bg-elevated)',
              color: 'var(--dosy-fg)',
              boxShadow: 'var(--dosy-shadow-sm)',
              border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><ChevronLeft size={18} strokeWidth={1.75}/></button>
          <span style={{
            fontSize: 11, color: 'var(--dosy-fg-secondary)',
            minWidth: 90, textAlign: 'center',
            fontFamily: 'var(--dosy-font-display)', fontWeight: 600,
            letterSpacing: '-0.01em',
          }}>{periodLabel()}</span>
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={isCurrentPeriod}
            aria-label="Próximo período"
            className="dosy-press"
            style={{
              width: 38, height: 38, borderRadius: 9999,
              background: 'var(--dosy-bg-elevated)',
              color: 'var(--dosy-fg)',
              boxShadow: 'var(--dosy-shadow-sm)',
              border: 'none', cursor: isCurrentPeriod ? 'not-allowed' : 'pointer',
              opacity: isCurrentPeriod ? 0.3 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><ChevronRight size={18} strokeWidth={1.75}/></button>
        </div>

        {/* Patient filter */}
        {patients.length > 1 && (
          <PatientPicker
            patients={patients}
            value={patientId}
            onChange={setPatientId}
            allowAll
            placeholder="Todos pacientes"
          />
        )}

        {/* Search */}
        <Input
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por medicamento ou observação…"
          suffix={search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--dosy-fg-tertiary)',
                padding: 2, display: 'inline-flex',
              }}
            ><XIcon size={14} strokeWidth={2}/></button>
          ) : null}
        />

        {/* Summary card */}
        {summary.total > 0 && (
          <Card padding={14}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--dosy-fg-secondary)',
                fontFamily: 'var(--dosy-font-display)',
              }}>Adesão no período</span>
              <span style={{
                fontFamily: 'var(--dosy-font-display)', fontWeight: 800, fontSize: 14,
                color: summary.pct == null ? 'var(--dosy-fg-tertiary)'
                  : summary.pct >= 80 ? '#3F9E7E'
                  : summary.pct >= 50 ? '#C5841A'
                  : 'var(--dosy-danger)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {summary.pct == null ? '—' : `${summary.pct}%`}
              </span>
            </div>
            <div style={{
              height: 8, borderRadius: 9999,
              background: 'var(--dosy-bg-sunken)',
              overflow: 'hidden', marginBottom: 8,
            }}>
              <div style={{
                height: '100%',
                background: 'var(--dosy-gradient-sunset)',
                borderRadius: 9999,
                width: `${summary.pct ?? 0}%`,
                transition: 'width 600ms var(--dosy-ease-out)',
              }}/>
            </div>
            <div style={{
              display: 'flex', gap: 12,
              fontSize: 11, color: 'var(--dosy-fg-secondary)',
            }}>
              <span style={{ color: '#3F9E7E', fontWeight: 600 }}>✓ {summary.done} tomadas</span>
              <span style={{ color: '#C5841A' }}>↷ {summary.skipped} puladas</span>
              <span style={{ color: 'var(--dosy-danger)' }}>! {summary.missed} perdidas</span>
            </div>
          </Card>
        )}

        {/* Day groups */}
        {isLoading ? (
          <SkeletonList count={5} />
        ) : days.length === 0 ? (
          <Card padding={28} style={{
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: 'var(--dosy-peach-100)',
              color: 'var(--dosy-primary)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={28} strokeWidth={1.75}/>
            </div>
            <p style={{ fontSize: 14, color: 'var(--dosy-fg-secondary)', margin: 0 }}>
              Nenhuma dose registrada neste período.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {days.map(({ date, list }) => {
              const { label, sub, highlight } = dayLabel(date)
              const dayDone = list.filter((d) => d.status === 'done').length
              const dayTotal = list.filter((d) => new Date(d.scheduledAt) <= new Date()).length
              return (
                <section key={date.toISOString()}>
                  {/* Day header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: highlight ? 'var(--dosy-gradient-sunset)' : 'var(--dosy-bg-sunken)',
                      color: highlight ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-fg)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      fontFamily: 'var(--dosy-font-display)',
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1 }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.1, marginTop: 1 }}>{sub}</span>
                    </div>
                    <div style={{ flex: 1, height: 1, background: 'var(--dosy-divider)' }}/>
                    {dayTotal > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: dayDone === dayTotal ? '#3F9E7E'
                          : dayDone > 0 ? '#C5841A'
                          : 'var(--dosy-danger)',
                      }}>
                        {dayDone}/{dayTotal}
                      </span>
                    )}
                  </div>

                  {/* Doses */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {list.map((dose) => {
                      const s = STATUS_CONFIG[dose.status] || STATUS_CONFIG.pending
                      const dosyStyle = DOSE_STATUS_DOSY[dose.status] || DOSE_STATUS_DOSY.pending
                      const patient = patients.find((p) => p.id === dose.patientId)
                      return (
                        <button
                          key={dose.id}
                          type="button"
                          onClick={() => setSelected(dose)}
                          className="dosy-press"
                          style={{
                            width: '100%', textAlign: 'left',
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px',
                            borderRadius: 14,
                            background: 'var(--dosy-bg-elevated)',
                            border: '1px solid var(--dosy-border)',
                            cursor: 'pointer',
                            fontFamily: 'var(--dosy-font-body)',
                            color: 'var(--dosy-fg)',
                          }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: 9999,
                            background: dosyStyle.bg,
                            color: dosyStyle.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 800,
                            flexShrink: 0,
                            fontFamily: 'var(--dosy-font-display)',
                          }}>
                            {s.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <p style={{
                                fontSize: 13.5, fontWeight: 600,
                                color: 'var(--dosy-fg)', margin: 0,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>{dose.medName}</p>
                              {dose.type === 'sos' && (
                                <span style={{
                                  fontSize: 9, fontWeight: 800,
                                  padding: '1px 5px', borderRadius: 4,
                                  background: 'var(--dosy-danger)',
                                  color: 'var(--dosy-fg-on-sunset)',
                                  flexShrink: 0,
                                  fontFamily: 'var(--dosy-font-display)',
                                }}>SOS</span>
                              )}
                            </div>
                            <p style={{
                              fontSize: 11, color: 'var(--dosy-fg-secondary)', margin: 0,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {dose.unit}
                              {patient && patients.length > 1 && ` · ${patient.name.split(' ')[0]}`}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{
                              fontSize: 12, fontWeight: 600, color: 'var(--dosy-fg-secondary)',
                              margin: 0, fontVariantNumeric: 'tabular-nums',
                            }}>
                              {formatTime(dose.scheduledAt)}
                            </p>
                            {dose.status === 'done' && dose.actualTime && (
                              <p style={{
                                fontSize: 10, color: '#3F9E7E', margin: 0,
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                → {formatTime(dose.actualTime)}
                              </p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      <DoseModal
        dose={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        patientName={selectedPatient?.name}
      />
    </div>
  )
}
