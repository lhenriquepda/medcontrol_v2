import { useMemo, useState } from 'react'
import Header from '../components/Header'
import AdBanner from '../components/AdBanner'
import PatientPicker from '../components/PatientPicker'
import Icon from '../components/Icon'
import DoseModal from '../components/DoseModal'
import { SkeletonList } from '../components/Skeleton'
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

export default function DoseHistory() {
  // Aud 4.5.4 G2 — histórico de doses (info médica longitudinal)
  usePrivacyScreen()
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState(null)
  const [period, setPeriod] = useState(7) // days back
  const [offset, setOffset] = useState(0)  // periods back (0 = current)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')  // FASE 15 — text search por medName/observation

  // Window: [periodStart, periodEnd]
  const { periodStart, periodEnd } = useMemo(() => {
    const base = startOfDay(new Date())
    // offset=0: last `period` days ending today
    // offset=1: the period before that, etc.
    const end = addDays(base, -(offset * period))
    const start = addDays(end, -(period - 1))
    return { periodStart: startOfDay(start), periodEnd: endOfDay(end) }
  }, [period, offset])

  const { data: rawDoses = [], isLoading } = useDoses({
    from: periodStart.toISOString(),
    to: periodEnd.toISOString(),
    patientId: patientId || undefined
  })

  // FASE 15 — filtra client-side por search (medName / unit / observation case-insensitive)
  const doses = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rawDoses
    return rawDoses.filter((d) =>
      (d.medName || '').toLowerCase().includes(term) ||
      (d.unit || '').toLowerCase().includes(term) ||
      (d.observation || '').toLowerCase().includes(term)
    )
  }, [rawDoses, search])

  // Group doses by calendar day (descending)
  const days = useMemo(() => {
    const map = new Map()
    for (const d of doses) {
      const key = startOfDay(d.scheduledAt).toISOString()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(d)
    }
    // Sort each day's doses by scheduledAt ascending
    for (const list of map.values()) list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    // Days descending
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, list]) => ({ date: new Date(key), list }))
  }, [doses])

  // Aggregate for the period header
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
    <div className="pb-28">
      <Header back title="Histórico de doses" />

      <div className="max-w-md mx-auto px-4 pt-3 space-y-3">
        <AdBanner />
        {/* Period selector */}
        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-full bg-slate-200/70 dark:bg-slate-800/70">
            {[7, 14, 30].map((d) => (
              <button key={d}
                onClick={() => { setPeriod(d); setOffset(0) }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  period === d ? 'bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-500'
                }`}>
                {d === 7 ? '7d' : d === 14 ? '14d' : '30d'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {/* Navigation arrows */}
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm shadow-sm active:scale-95"
            aria-label="Período anterior"
          >‹</button>
          <span className="text-xs text-slate-500 min-w-[90px] text-center">{periodLabel()}</span>
          <button
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={isCurrentPeriod}
            className={`w-11 h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm shadow-sm active:scale-95 ${
              isCurrentPeriod ? 'opacity-30' : ''
            }`}
            aria-label="Próximo período"
          >›</button>
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

        {/* FASE 15 — Text search */}
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por medicamento ou observação…"
            aria-label="Buscar doses"
            className="input pl-9"
          />
          <Icon
            name="search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Summary bar */}
        {summary.total > 0 && (
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500">Adesão no período</span>
              <span className={`text-sm font-bold ${
                summary.pct == null ? 'text-slate-400'
                : summary.pct >= 80 ? 'text-emerald-600 dark:text-emerald-400'
                : summary.pct >= 50 ? 'text-amber-600 dark:text-amber-400'
                : 'text-rose-600 dark:text-rose-400'
              }`}>
                {summary.pct == null ? '—' : `${summary.pct}%`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2">
              <div className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${summary.pct ?? 0}%` }} />
            </div>
            <div className="flex gap-3 text-[11px] text-slate-500">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ {summary.done} tomadas</span>
              <span className="text-amber-600 dark:text-amber-400">↷ {summary.skipped} puladas</span>
              <span className="text-rose-600 dark:text-rose-400">! {summary.missed} perdidas</span>
            </div>
          </div>
        )}

        {/* Day groups */}
        {isLoading ? (
          <SkeletonList count={5} />
        ) : days.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            <p className="text-3xl mb-2">📋</p>
            Nenhuma dose registrada neste período.
          </div>
        ) : (
          <div className="space-y-4">
            {days.map(({ date, list }) => {
              const { label, sub, highlight } = dayLabel(date)
              const dayDone = list.filter((d) => d.status === 'done').length
              const dayTotal = list.filter((d) => new Date(d.scheduledAt) <= new Date()).length
              return (
                <section key={date.toISOString()}>
                  {/* Day header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl text-center flex-shrink-0 ${
                      highlight
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      <span className="text-[10px] font-medium leading-none">{label}</span>
                      <span className="text-[11px] font-bold leading-tight">{sub}</span>
                    </div>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                    {dayTotal > 0 && (
                      <span className={`text-[11px] font-medium ${
                        dayDone === dayTotal ? 'text-emerald-600 dark:text-emerald-400'
                        : dayDone > 0 ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-500'
                      }`}>
                        {dayDone}/{dayTotal}
                      </span>
                    )}
                  </div>

                  {/* Doses */}
                  <div className="space-y-1.5 ml-1">
                    {list.map((dose) => {
                      const s = STATUS_CONFIG[dose.status] || STATUS_CONFIG.pending
                      const patient = patients.find((p) => p.id === dose.patientId)
                      return (
                        <button
                          key={dose.id}
                          onClick={() => setSelected(dose)}
                          className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 active:scale-[0.97] active:opacity-90 transition"
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.color}`}>
                            {s.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">{dose.medName}</p>
                              {dose.type === 'sos' && (
                                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-rose-600 text-white flex-shrink-0">SOS</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              {dose.unit}
                              {patient && patients.length > 1 && ` · ${patient.name.split(' ')[0]}`}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              {formatTime(dose.scheduledAt)}
                            </p>
                            {dose.status === 'done' && dose.actualTime && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
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
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
    </div>
  )
}
