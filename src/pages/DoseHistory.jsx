import { useMemo, useState } from 'react'
import { Search, X as XIcon, FileText, Check, AlertTriangle, X as XCloseIcon } from 'lucide-react'
import AdBanner from '../components/AdBanner'
import PatientPicker from '../components/PatientPicker'
import DoseModal from '../components/DoseModal'
import { SkeletonList } from '../components/Skeleton'
import { Card, Input, StatusPill } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'
import { formatTime, pad } from '../utils/dateUtils'
import { usePrivacyScreen } from '../hooks/usePrivacyScreen'

// Source: contexto/claude-design/dosy/project/src/screens/Auxiliary.jsx (HistoricoScreen)
// Pattern: day strip horizontal (7 dias) + summary card (texto esq + % box dir) + timeline rows.

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function endOfDay(d)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function dayChipLabel(date, today) {
  const d = startOfDay(date)
  const t = startOfDay(today)
  const diff = Math.round((d - t) / 86400000)
  if (diff === 0) return 'HOJE'
  if (diff === -1) return 'ONTEM'
  return DIAS_SEMANA[d.getDay()]
}

function fullDateLabel(date) {
  const d = new Date(date)
  const wd = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()]
  return `${wd}, ${pad(d.getDate())} ${MESES[d.getMonth()]}`
}

export default function DoseHistory() {
  // Aud 4.5.4 G2 — histórico de doses (info médica longitudinal)
  usePrivacyScreen()
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedDayOffset, setSelectedDayOffset] = useState(0) // 0 = hoje, 1 = ontem, ...
  const [selected, setSelected] = useState(null)

  // Day strip: últimos 7 dias (offset 0..6, 0=hoje)
  const today = useMemo(() => startOfDay(new Date()), [])
  const dayChips = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(today, -i)
      return { offset: i, date, label: dayChipLabel(date, today) }
    })
  }, [today])

  // Periodo: últimos 7 dias completos pra calcular % por dia (chip strip)
  const periodFrom = useMemo(() => addDays(today, -6), [today])
  const periodTo = useMemo(() => endOfDay(today), [today])

  const { data: rangeDoses = [], isLoading } = useDoses({
    from: periodFrom.toISOString(),
    to: periodTo.toISOString(),
    patientId: patientId || undefined,
    // #138: search inclui observation, precisa col full
    withObservation: !!search.trim(),
  })

  // Filtra busca search (med/unit/observation)
  const filteredDoses = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rangeDoses
    return rangeDoses.filter((d) =>
      (d.medName || '').toLowerCase().includes(term) ||
      (d.unit || '').toLowerCase().includes(term) ||
      (d.observation || '').toLowerCase().includes(term),
    )
  }, [rangeDoses, search])

  // Adesão % por dia (pra day strip)
  const adherenceByDay = useMemo(() => {
    const map = new Map()
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, -i)
      const start = startOfDay(date)
      const end = endOfDay(date)
      const dayDoses = rangeDoses.filter((x) => {
        const t = new Date(x.scheduledAt)
        return t >= start && t <= end && t <= new Date()
      })
      const total = dayDoses.length
      const done = dayDoses.filter((x) => x.status === 'done').length
      const pct = total > 0 ? Math.round((done / total) * 100) : null
      map.set(i, { total, done, pct })
    }
    return map
  }, [rangeDoses, today])

  // Doses do dia selecionado (filtra busca)
  const selectedDate = useMemo(() => addDays(today, -selectedDayOffset), [today, selectedDayOffset])
  const selectedDayDoses = useMemo(() => {
    const start = startOfDay(selectedDate)
    const end = endOfDay(selectedDate)
    return filteredDoses
      .filter((d) => {
        const t = new Date(d.scheduledAt)
        return t >= start && t <= end
      })
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  }, [filteredDoses, selectedDate])

  // Summary do dia selecionado
  const summary = useMemo(() => {
    const past = selectedDayDoses.filter((d) => new Date(d.scheduledAt) <= new Date())
    const done = past.filter((d) => d.status === 'done').length
    const skipped = past.filter((d) => d.status === 'skipped').length
    const overdue = past.filter((d) => d.status === 'overdue').length
    const total = past.length
    const pct = total > 0 ? Math.round((done / total) * 100) : null
    return { done, skipped, overdue, total, pct }
  }, [selectedDayDoses])

  const selectedPatient = selected && patients.find((p) => p.id === selected.patientId)

  return (
    <div style={{ paddingBottom: 110 }}>
      <PageHeader title="Histórico de doses" back/>

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AdBanner />

        {/* Day strip horizontal */}
        <div className="dosy-scroll" style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          padding: '2px 2px 4px',
        }}>
          {dayChips.map((c) => {
            const ad = adherenceByDay.get(c.offset)
            const isActive = selectedDayOffset === c.offset
            return (
              <button
                key={c.offset}
                type="button"
                onClick={() => setSelectedDayOffset(c.offset)}
                className="dosy-press"
                style={{
                  padding: '10px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: isActive ? 'var(--dosy-gradient-sunset)' : 'var(--dosy-bg-elevated)',
                  color: isActive ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-fg)',
                  boxShadow: isActive ? '0 8px 16px -6px rgba(255,61,127,0.4)' : 'var(--dosy-shadow-xs)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  minWidth: 64, flexShrink: 0,
                  fontFamily: 'var(--dosy-font-display)',
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  opacity: isActive ? 0.9 : 0.7,
                }}>{c.label}</span>
                <span style={{
                  fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {ad.pct == null ? '—' : `${ad.pct}%`}
                </span>
              </button>
            )
          })}
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

        {/* Daily summary card — esq texto, dir % box sunset-soft */}
        <Card padding={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
                fontFamily: 'var(--dosy-font-display)',
              }}>{fullDateLabel(selectedDate)}</div>
              <div style={{
                fontFamily: 'var(--dosy-font-display)',
                fontWeight: 800, fontSize: 24, letterSpacing: '-0.025em',
                marginTop: 4, color: 'var(--dosy-fg)',
              }}>
                {summary.done} de {summary.total} dose{summary.total === 1 ? '' : 's'}
              </div>
              <div style={{
                fontSize: 12.5, color: 'var(--dosy-fg-secondary)', marginTop: 2,
              }}>
                {summary.overdue} atraso{summary.overdue === 1 ? '' : 's'}, {summary.skipped} pulada{summary.skipped === 1 ? '' : 's'}
              </div>
            </div>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'var(--dosy-gradient-sunset-soft)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                fontFamily: 'var(--dosy-font-display)',
                fontWeight: 800, fontSize: 22, letterSpacing: '-0.025em',
                lineHeight: 1, color: 'var(--dosy-fg)',
                fontVariantNumeric: 'tabular-nums',
              }}>{summary.pct == null ? '—' : `${summary.pct}%`}</div>
              <div style={{
                fontSize: 10, fontWeight: 600, opacity: 0.7, marginTop: 2,
                color: 'var(--dosy-fg)',
                fontFamily: 'var(--dosy-font-display)',
              }}>adesão</div>
            </div>
          </div>
        </Card>

        {/* Timeline */}
        {isLoading ? (
          <SkeletonList count={5} />
        ) : selectedDayDoses.length === 0 ? (
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
              Nenhuma dose neste dia.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selectedDayDoses.map((dose) => (
              <TimelineRow
                key={dose.id}
                dose={dose}
                patient={patients.find((p) => p.id === dose.patientId)}
                showPatient={patients.length > 1 && !patientId}
                onClick={() => setSelected(dose)}
              />
            ))}
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

// Timeline row — design.HistoricoScreen pattern
function TimelineRow({ dose, patient, showPatient, onClick }) {
  const status = dose.status
  const tone = status === 'done' ? 'success'
    : status === 'overdue' ? 'danger'
    : status === 'skipped' ? 'skipped'
    : 'pending'
  const Icon = status === 'done' ? Check
    : status === 'overdue' ? AlertTriangle
    : status === 'skipped' ? XCloseIcon
    : null
  const iconBg = tone === 'success' ? '#DDF1E8'
    : tone === 'danger' ? 'var(--dosy-danger-bg)'
    : tone === 'skipped' ? 'var(--dosy-bg-sunken)'
    : 'var(--dosy-peach-100)'
  const iconColor = tone === 'success' ? '#3F9E7E'
    : tone === 'danger' ? 'var(--dosy-danger)'
    : tone === 'skipped' ? 'var(--dosy-fg-tertiary)'
    : 'var(--dosy-fg-secondary)'

  let delta = ''
  if (status === 'done' && dose.actualTime) {
    const actualMs = new Date(dose.actualTime).getTime()
    const schedMs = new Date(dose.scheduledAt).getTime()
    const minDiff = Math.round((actualMs - schedMs) / 60000)
    if (Math.abs(minDiff) < 5) delta = 'no horário'
    else if (minDiff > 0) delta = `+${minDiff} min`
    else delta = `${minDiff} min`
  } else if (status === 'skipped') {
    delta = 'pulou'
  } else if (status === 'overdue') {
    delta = 'atrasada'
  } else if (dose.type === 'sos') {
    delta = 'S.O.S'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="dosy-press"
      style={{
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 12,
        background: 'var(--dosy-bg-elevated)',
        border: 'none',
        borderRadius: 16,
        boxShadow: 'var(--dosy-shadow-xs)',
        cursor: 'pointer',
        fontFamily: 'var(--dosy-font-body)',
        color: 'var(--dosy-fg)',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 12,
        background: iconBg,
        color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {Icon && <Icon size={16} strokeWidth={2.25}/>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em',
            color: 'var(--dosy-fg)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{dose.medName}</span>
          {dose.type === 'sos' && <StatusPill label="S.O.S" kind="danger"/>}
        </div>
        <div style={{
          fontSize: 12.5, color: 'var(--dosy-fg-secondary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {dose.unit}
          {showPatient && patient && ` · ${patient.name.split(' ')[0]}`}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: 'var(--dosy-font-display)',
          fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--dosy-fg)',
        }}>{formatTime(dose.scheduledAt)}</div>
        {delta && (
          <div style={{
            fontSize: 11, color: 'var(--dosy-fg-secondary)', marginTop: 1,
          }}>{delta}</div>
        )}
      </div>
    </button>
  )
}
