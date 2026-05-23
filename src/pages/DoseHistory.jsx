import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X as XIcon, FileText, Check, AlertTriangle, X as XCloseIcon, Download } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import AdBanner from '../components/AdBanner'
import PatientPicker from '../components/PatientPicker'
import DoseModal from '../components/DoseModal'
import { SkeletonList } from '../components/Skeleton'
import { Card, Input, StatusPill, EmptyState, Sheet, Button, Chip } from '../components/dosy'
import { getGroup, MED_GROUPS } from '../constants/medCategories'
import PageHeader from '../components/dosy/PageHeader'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'
import { formatTime, pad } from '../utils/dateUtils'
import { usePrivacyScreen } from '../hooks/usePrivacyScreen'
// v0.2.6.1 — PostHog instrumentação categoria (Roteiro_Alinhamento §10 P3.4)
import { track, EVENTS } from '../services/analytics'

// v0.2.5.0 — refactor cross-period + multi-categoria + agrupamento dinâmico.
// Resolve caso "quando foi última vez que tomei antibiótico" sem precisar PDF.

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Períodos disponíveis (substituem o day-strip quando > 7d)
const PERIODS = [
  { id: '7d',  label: '7 dias',   days: 7 },
  { id: '30d', label: '30 dias',  days: 30 },
  { id: '90d', label: '90 dias',  days: 90 },
  { id: '6m',  label: '6 meses',  days: 180 },
  { id: '1a',  label: '1 ano',    days: 365 },
]

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function endOfDay(d)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d) { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x }

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

function weekLabel(weekStart) {
  const ws = new Date(weekStart)
  const we = addDays(ws, 6)
  return `${pad(ws.getDate())} ${MESES[ws.getMonth()]} – ${pad(we.getDate())} ${MESES[we.getMonth()]}`
}

export default function DoseHistory() {
  usePrivacyScreen()
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showExportSheet, setShowExportSheet] = useState(false)

  // v0.2.5.0 — querystring multi-categoria + período
  const [searchParams, setSearchParams] = useSearchParams()
  const periodId = searchParams.get('period') || '7d'
  const groupsParam = searchParams.get('groups') || searchParams.get('group') || ''
  const selectedGroups = useMemo(() => {
    if (!groupsParam) return []
    return groupsParam.split(',').map(s => s.trim()).filter(Boolean)
  }, [groupsParam])

  const period = useMemo(() => PERIODS.find(p => p.id === periodId) || PERIODS[0], [periodId])

  // Day strip: apenas quando período = 7d
  const today = useMemo(() => startOfDay(new Date()), [])
  const [selectedDayOffset, setSelectedDayOffset] = useState(0)
  const dayChips = useMemo(() => {
    if (period.id !== '7d') return []
    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(today, -i)
      return { offset: i, date, label: dayChipLabel(date, today) }
    })
  }, [today, period])

  // Período de fetch (substitui days fixo de 7)
  const periodFrom = useMemo(() => addDays(today, -(period.days - 1)), [today, period])
  const periodTo = useMemo(() => endOfDay(today), [today])

  const { data: rangeDoses = [], isLoading } = useDoses({
    from: periodFrom.toISOString(),
    to: periodTo.toISOString(),
    patientId: patientId || undefined,
    withObservation: !!search.trim(),
  })

  // Filtro: search + multi-categoria
  const filteredDoses = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = rangeDoses
    if (selectedGroups.length > 0) {
      const set = new Set(selectedGroups)
      list = list.filter((d) => set.has(d.group_id || 'nao_classificado'))
    }
    if (term) {
      list = list.filter((d) =>
        (d.medName || '').toLowerCase().includes(term) ||
        (d.unit || '').toLowerCase().includes(term) ||
        (d.observation || '').toLowerCase().includes(term),
      )
    }
    return list
  }, [rangeDoses, search, selectedGroups])

  function setPeriod(id) {
    const next = new URLSearchParams(searchParams)
    next.set('period', id)
    setSearchParams(next, { replace: true })
    // v0.2.6.1 — telemetria período histórico
    try { track(EVENTS.HISTORICO_PERIOD_CHANGED, { period_id: id }) } catch {}
  }
  function toggleGroup(g) {
    const cur = new Set(selectedGroups)
    const wasActive = cur.has(g)
    if (wasActive) cur.delete(g)
    else cur.add(g)
    const next = new URLSearchParams(searchParams)
    if (cur.size > 0) next.set('groups', [...cur].join(','))
    else next.delete('groups')
    next.delete('group') // legacy single
    setSearchParams(next, { replace: true })
    // v0.2.6.1 — telemetria filtro categoria
    try {
      track(EVENTS.HISTORICO_FILTERED_BY_GROUP, {
        group_id: g,
        action: wasActive ? 'remove' : 'add',
        active_count: cur.size,
      })
    } catch {}
  }
  function clearAllGroups() {
    const next = new URLSearchParams(searchParams)
    next.delete('groups')
    next.delete('group')
    setSearchParams(next, { replace: true })
  }

  // Adesão % por dia (só quando period=7d, alimenta day strip)
  const adherenceByDay = useMemo(() => {
    if (period.id !== '7d') return new Map()
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
  }, [rangeDoses, today, period])

  // === RESUMO DO ESCOPO ATUAL (totals + adesão) ===
  const scopeSummary = useMemo(() => {
    const past = filteredDoses.filter((d) => new Date(d.scheduledAt) <= new Date())
    const total = past.length
    const done = past.filter((d) => d.status === 'done').length
    const skipped = past.filter((d) => d.status === 'skipped').length
    const overdue = past.filter((d) => d.status === 'overdue' || (d.status === 'pending' && new Date(d.scheduledAt) < new Date())).length
    const pct = total > 0 ? Math.round((done / total) * 100) : null
    const uniqueMeds = new Set(past.map(d => (d.medName || '').toLowerCase().trim())).size
    return { total, done, skipped, overdue, pct, uniqueMeds }
  }, [filteredDoses])

  // v0.2.6.0 audit A→B #5 — última dose por categoria (JTBD "quando foi última vez antibiótico?")
  // Só aparece quando há filtro de categoria ativo OU groupingMode='med' (resultado focado)
  const lastDosesByGroup = useMemo(() => {
    if (selectedGroups.length === 0 && !search.trim()) return []
    const done = filteredDoses.filter(d => d.status === 'done')
    const byGroup = new Map()
    for (const d of done) {
      const g = d.group_id || 'nao_classificado'
      const existing = byGroup.get(g)
      if (!existing || new Date(d.actualTime || d.scheduledAt) > new Date(existing.date)) {
        byGroup.set(g, {
          group_id: g,
          medName: d.medName,
          date: d.actualTime || d.scheduledAt,
        })
      }
    }
    return [...byGroup.values()].sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [filteredDoses, selectedGroups, search])

  // === AGRUPAMENTO DINÂMICO ===
  // ≤7d → por dia (mostra day-strip + lista do dia)
  // >7d sem filtro categoria → por semana
  // >7d com filtro categoria/med → por medicamento (mais acionável)
  const groupingMode = useMemo(() => {
    if (period.id === '7d') return 'day'
    if (selectedGroups.length > 0 || search.trim()) return 'med'
    return 'week'
  }, [period, selectedGroups, search])

  // Para mode='day' (legado): filtra doses do dia selecionado
  const selectedDate = useMemo(() => addDays(today, -selectedDayOffset), [today, selectedDayOffset])
  const dayDoses = useMemo(() => {
    if (groupingMode !== 'day') return []
    const start = startOfDay(selectedDate)
    const end = endOfDay(selectedDate)
    return filteredDoses
      .filter((d) => {
        const t = new Date(d.scheduledAt)
        return t >= start && t <= end
      })
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  }, [filteredDoses, selectedDate, groupingMode])

  // Para mode='week': agrupa filteredDoses por semana
  const weekGroups = useMemo(() => {
    if (groupingMode !== 'week') return []
    const map = new Map()
    for (const d of filteredDoses) {
      const ws = startOfWeek(new Date(d.scheduledAt))
      const key = ws.toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, { weekStart: ws, doses: [] })
      map.get(key).doses.push(d)
    }
    return [...map.values()].sort((a, b) => b.weekStart - a.weekStart)
  }, [filteredDoses, groupingMode])

  // Para mode='med': agrupa por medicamento
  const medGroups = useMemo(() => {
    if (groupingMode !== 'med') return []
    const map = new Map()
    for (const d of filteredDoses) {
      const key = (d.medName || '').trim()
      if (!key) continue
      if (!map.has(key)) map.set(key, { medName: key, doses: [], group_id: d.group_id })
      map.get(key).doses.push(d)
    }
    const arr = [...map.values()]
    // ordena por última dose mais recente
    arr.forEach(g => g.doses.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)))
    arr.sort((a, b) => b.doses[0].scheduledAt.localeCompare(a.doses[0].scheduledAt))
    return arr
  }, [filteredDoses, groupingMode])

  const selectedPatient = selected && patients.find((p) => p.id === selected.patientId)
  const patientById = useMemo(() => new Map(patients.map(p => [p.id, p])), [patients])

  // === EXPORT CSV (botão "Exportar" sheet) ===
  function exportCSV() {
    const headers = ['data', 'hora', 'paciente', 'medicamento', 'categoria', 'unidade', 'status', 'observacao']
    const rows = filteredDoses.map(d => {
      const dt = new Date(d.scheduledAt)
      return [
        `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`,
        formatTime(d.scheduledAt),
        patientById.get(d.patientId)?.name || '—',
        d.medName,
        getGroup(d.group_id).label,
        d.unit,
        d.status,
        (d.observation || '').replace(/"/g, '""'),
      ].map(v => `"${v}"`).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dosy-historico-${period.id}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setShowExportSheet(false)
  }

  return (
    <div style={{ paddingBottom: 110 }}>
      <PageHeader title="Histórico de doses" back/>

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AdBanner />

        {/* PERÍODO chips (always visible) */}
        <div className="dosy-scroll" style={{
          display: 'flex', gap: 6, overflowX: 'auto',
          padding: '2px 2px 4px',
        }}>
          {PERIODS.map((p) => {
            const isActive = p.id === period.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: isActive ? 'var(--dosy-gradient-sunset)' : 'var(--dosy-bg-elevated)',
                  color: isActive ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-fg)',
                  boxShadow: isActive ? '0 6px 12px -4px rgba(255,61,127,0.4)' : 'var(--dosy-shadow-xs)',
                  fontSize: 13, fontWeight: 600,
                  whiteSpace: 'nowrap', flexShrink: 0,
                  fontFamily: 'var(--dosy-font-body)',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {/* CATEGORIA chips multi-select */}
        <div className="dosy-scroll" style={{
          display: 'flex', gap: 6, overflowX: 'auto',
          padding: '2px 2px 4px',
        }}>
          {MED_GROUPS.map((g) => {
            const isActive = selectedGroups.includes(g.id)
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGroup(g.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 999, border: `1.5px solid ${isActive ? 'var(--dosy-primary)' : 'var(--dosy-border)'}`,
                  cursor: 'pointer',
                  background: isActive ? 'var(--dosy-peach-100)' : 'var(--dosy-bg-elevated)',
                  color: 'var(--dosy-fg)',
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  whiteSpace: 'nowrap', flexShrink: 0,
                  fontFamily: 'var(--dosy-font-body)',
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: g.color,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                }} aria-hidden="true" />
                {g.label}
              </button>
            )
          })}
          {selectedGroups.length > 0 && (
            <button
              type="button"
              onClick={clearAllGroups}
              style={{
                padding: '7px 10px', borderRadius: 999, border: '1.5px dashed var(--dosy-border)',
                background: 'transparent', color: 'var(--dosy-fg-muted)',
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'var(--dosy-font-body)',
              }}
            >
              Limpar
            </button>
          )}
        </div>

        {/* PATIENT FILTER */}
        {patients.length > 1 && (
          <PatientPicker
            patients={patients}
            value={patientId}
            onChange={setPatientId}
            allowAll
            placeholder="Todos pacientes"
          />
        )}

        {/* SEARCH */}
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

        {/* RESUMO DO ESCOPO ATUAL + Exportar */}
        <Card padding={16} muted>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
                fontFamily: 'var(--dosy-font-display)',
              }}>
                {period.label}{selectedGroups.length > 0 ? ` · ${selectedGroups.length} categoria${selectedGroups.length > 1 ? 's' : ''}` : ''}
              </div>
              <div style={{
                fontFamily: 'var(--dosy-font-display)',
                fontWeight: 800, fontSize: 22, letterSpacing: '-0.025em',
                marginTop: 4, color: 'var(--dosy-fg)',
              }}>
                {scopeSummary.done} de {scopeSummary.total} dose{scopeSummary.total === 1 ? '' : 's'}
              </div>
              <div style={{
                fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 2,
              }}>
                {scopeSummary.uniqueMeds} medicamento{scopeSummary.uniqueMeds === 1 ? '' : 's'} · {scopeSummary.overdue} atraso{scopeSummary.overdue === 1 ? '' : 's'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: 'var(--dosy-gradient-sunset)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 6px 14px -4px rgba(255,61,127,0.35)',
              }}>
                <div style={{
                  fontFamily: 'var(--dosy-font-display)',
                  fontWeight: 800, fontSize: 22, letterSpacing: '-0.025em',
                  lineHeight: 1, color: 'var(--dosy-fg-on-sunset)',
                  fontVariantNumeric: 'tabular-nums',
                }}>{scopeSummary.pct == null ? '—' : `${scopeSummary.pct}%`}</div>
                <div style={{
                  fontSize: 10, fontWeight: 600, opacity: 0.9, marginTop: 2,
                  color: 'var(--dosy-fg-on-sunset)',
                  fontFamily: 'var(--dosy-font-display)',
                }}>adesão</div>
              </div>
              <button
                type="button"
                onClick={() => setShowExportSheet(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 999,
                  background: 'var(--dosy-bg-elevated)',
                  border: '1px solid var(--dosy-border)',
                  fontSize: 11, fontWeight: 600,
                  color: 'var(--dosy-fg-muted)',
                  cursor: 'pointer',
                  fontFamily: 'var(--dosy-font-body)',
                }}
              >
                <Download size={12} strokeWidth={2.25} /> Exportar
              </button>
            </div>
          </div>
        </Card>

        {/* v0.2.6.0 — Card "Última dose por categoria" — só quando há filtro ativo
            Resolve JTBD: "Quando foi a última vez que tomei antibiótico?" */}
        {lastDosesByGroup.length > 0 && (
          <Card padding={14}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
              fontFamily: 'var(--dosy-font-display)',
              marginBottom: 10,
            }}>
              Última dose
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lastDosesByGroup.slice(0, 5).map((row) => {
                const g = getGroup(row.group_id)
                const d = new Date(row.date)
                const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000)
                const ago = daysAgo === 0 ? 'hoje' : daysAgo === 1 ? 'ontem' : `há ${daysAgo} dias`
                return (
                  <div key={row.group_id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--dosy-border)',
                  }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: g.color,
                      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                      flexShrink: 0,
                    }} aria-hidden="true" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600, color: 'var(--dosy-fg)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{row.medName}</div>
                      <div style={{ fontSize: 11, color: 'var(--dosy-fg-muted)', marginTop: 1 }}>
                        {g.label} · {ago}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 11, color: 'var(--dosy-fg-muted)',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}>
                      {pad(d.getDate())} {MESES[d.getMonth()]}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* DAY STRIP — só quando period=7d */}
        {period.id === '7d' && (
          <div className="dosy-scroll" style={{
            display: 'flex', gap: 8, overflowX: 'auto',
            padding: '2px 2px 4px',
          }}>
            {dayChips.map((c) => {
              const ad = adherenceByDay.get(c.offset) || { pct: null }
              const isActive = selectedDayOffset === c.offset
              return (
                <button
                  key={c.offset}
                  type="button"
                  onClick={() => setSelectedDayOffset(c.offset)}
                  style={{
                    padding: '10px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: isActive ? 'var(--dosy-gradient-sunset)' : 'var(--dosy-bg-elevated)',
                    color: isActive ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-fg)',
                    boxShadow: isActive ? '0 8px 16px -6px rgba(255,61,127,0.4)' : 'var(--dosy-shadow-xs)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    minWidth: 56, flexShrink: 0,
                    fontFamily: 'var(--dosy-font-display)',
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    opacity: isActive ? 0.9 : 0.7,
                  }}>{c.label}</span>
                  <span style={{
                    fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {ad.pct == null ? '—' : `${ad.pct}%`}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* LISTA — agrupamento dinâmico */}
        {isLoading ? (
          <SkeletonList count={5} />
        ) : filteredDoses.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} strokeWidth={1.5}/>}
            title="Nenhuma dose encontrada"
            message={selectedGroups.length > 0
              ? "Tente outras categorias, outro período ou ajuste a busca."
              : "Tente outro período ou ajuste o filtro de paciente."
            }
            compact
          />
        ) : groupingMode === 'day' ? (
          <VirtualTimeline
            doses={dayDoses}
            patients={patients}
            showPatient={patients.length > 1 && !patientId}
            onSelect={setSelected}
          />
        ) : groupingMode === 'week' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {weekGroups.map((wg) => (
              <WeekGroup
                key={wg.weekStart.toISOString()}
                weekStart={wg.weekStart}
                doses={wg.doses}
                patients={patientById}
                showPatient={patients.length > 1 && !patientId}
                onSelect={setSelected}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {medGroups.map((mg) => (
              <MedGroup
                key={mg.medName}
                medName={mg.medName}
                groupId={mg.group_id}
                doses={mg.doses}
                patients={patientById}
                showPatient={patients.length > 1 && !patientId}
                onSelect={setSelected}
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

      {/* EXPORT SHEET */}
      <Sheet open={showExportSheet} onClose={() => setShowExportSheet(false)} title="Exportar histórico">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{
            margin: 0, fontSize: 14,
            color: 'var(--dosy-fg-muted)',
            fontFamily: 'var(--dosy-font-body)',
            lineHeight: 1.5,
          }}>
            Exporta as <strong style={{ color: 'var(--dosy-fg)' }}>{filteredDoses.length} doses</strong> filtradas (período {period.label}
            {selectedGroups.length > 0 ? ` · ${selectedGroups.length} categoria${selectedGroups.length > 1 ? 's' : ''}` : ''}
            {patientId ? ` · paciente selecionado` : ''}) em arquivo CSV. Abre no Excel/Google Sheets.
          </p>
          <Button
            variant="primary"
            icon={<Download size={16} strokeWidth={2.25}/>}
            onClick={exportCSV}
          >
            Baixar CSV
          </Button>
          <p style={{
            margin: 0, fontSize: 11.5,
            color: 'var(--dosy-fg-muted)',
            fontFamily: 'var(--dosy-font-body)',
            textAlign: 'center',
          }}>
            Para PDF formatado para médico, use a tela "Relatórios" (em breve consolidada aqui).
          </p>
        </div>
      </Sheet>
    </div>
  )
}

// === SUBCOMPONENTS ===

function WeekGroup({ weekStart, doses, patients, showPatient, onSelect }) {
  const done = doses.filter(d => d.status === 'done').length
  const pct = doses.length > 0 ? Math.round((done / doses.length) * 100) : null
  return (
    <Card padding={12}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, gap: 8,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
          textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
          fontFamily: 'var(--dosy-font-display)',
        }}>
          {weekLabel(weekStart)}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: 'var(--dosy-fg-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {done}/{doses.length} {pct != null ? `· ${pct}%` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {doses.slice(0, 12).map(d => (
          <DoseRowCompact
            key={d.id}
            dose={d}
            patient={patients.get(d.patientId)}
            showPatient={showPatient}
            onClick={() => onSelect(d)}
          />
        ))}
        {doses.length > 12 && (
          <div style={{
            padding: '6px 12px', fontSize: 11,
            color: 'var(--dosy-fg-muted)', textAlign: 'center',
          }}>
            +{doses.length - 12} doses nesta semana
          </div>
        )}
      </div>
    </Card>
  )
}

function MedGroup({ medName, groupId, doses, patients, showPatient, onSelect }) {
  const done = doses.filter(d => d.status === 'done').length
  const pct = doses.length > 0 ? Math.round((done / doses.length) * 100) : null
  const lastDose = doses[0] // já ordenado por mais recente
  const lastDate = lastDose ? new Date(lastDose.scheduledAt) : null
  const group = getGroup(groupId)
  return (
    <Card padding={12}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 10, gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', background: group.color,
              flexShrink: 0,
            }} aria-hidden="true" />
            <span style={{
              fontSize: 16, fontWeight: 700, color: 'var(--dosy-fg)',
              fontFamily: 'var(--dosy-font-display)', letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{medName}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--dosy-fg-muted)' }}>
            {group.label} · última: {lastDate ? fullDateLabel(lastDate) : '—'}
          </div>
        </div>
        <div style={{
          fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: 'var(--dosy-fg)', flexShrink: 0,
        }}>
          {done}/{doses.length}{pct != null ? ` · ${pct}%` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {doses.slice(0, 8).map(d => (
          <DoseRowCompact
            key={d.id}
            dose={d}
            patient={patients.get(d.patientId)}
            showPatient={showPatient}
            onClick={() => onSelect(d)}
          />
        ))}
        {doses.length > 8 && (
          <div style={{
            padding: '6px 12px', fontSize: 11,
            color: 'var(--dosy-fg-muted)', textAlign: 'center',
          }}>
            +{doses.length - 8} doses
          </div>
        )}
      </div>
    </Card>
  )
}

function DoseRowCompact({ dose, patient, showPatient, onClick }) {
  const status = dose.status
  const tone = status === 'done' ? 'success'
    : status === 'overdue' ? 'danger'
    : status === 'skipped' ? 'skipped'
    : 'pending'
  const Icon = status === 'done' ? Check
    : status === 'overdue' ? AlertTriangle
    : status === 'skipped' ? XCloseIcon
    : null
  const dt = new Date(dose.scheduledAt)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 10,
        background: 'var(--dosy-bg)',
        border: '1px solid var(--dosy-border)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--dosy-font-body)',
        width: '100%',
      }}
    >
      <span style={{
        width: 24, height: 24, borderRadius: '50%',
        background: tone === 'success' ? 'var(--dosy-green-100)' : tone === 'danger' ? 'var(--dosy-red-100)' : 'var(--dosy-gray-100)',
        color: tone === 'success' ? 'var(--dosy-green-700)' : tone === 'danger' ? 'var(--dosy-red-700)' : 'var(--dosy-gray-700)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {Icon ? <Icon size={12} strokeWidth={2.5} /> : <span style={{ fontSize: 10, fontWeight: 800 }}>—</span>}
      </span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
        <div style={{ fontWeight: 500, color: 'var(--dosy-fg)' }}>
          {pad(dt.getDate())} {MESES[dt.getMonth()]} · {formatTime(dose.scheduledAt)}
          {showPatient && patient && (
            <span style={{ color: 'var(--dosy-fg-muted)', fontSize: 11, marginLeft: 6 }}>
              · {patient.name}
            </span>
          )}
        </div>
        {dose.unit && (
          <div style={{ fontSize: 11, color: 'var(--dosy-fg-muted)', marginTop: 1 }}>
            {dose.unit}
          </div>
        )}
      </div>
    </button>
  )
}

// VirtualTimeline mantida pra mode='day' (legacy, alta performance)
function VirtualTimeline({ doses, patients, showPatient, onSelect }) {
  const parentRef = useRef(null)
  const ROW_HEIGHT = 62
  const ROW_GAP = 6
  const rowVirtualizer = useVirtualizer({
    count: doses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT + ROW_GAP,
    overscan: 5,
  })
  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])

  return (
    <div ref={parentRef} style={{
      maxHeight: '60vh',
      overflowY: doses.length > 10 ? 'auto' : 'visible',
    }}>
      <div style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}>
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const dose = doses[virtualItem.index]
          return (
            <div
              key={dose.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${ROW_HEIGHT}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <DoseRow
                dose={dose}
                patient={patientById.get(dose.patientId)}
                showPatient={showPatient}
                onClick={() => onSelect(dose)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DoseRow({ dose, patient, showPatient, onClick }) {
  const status = dose.status
  const tone = status === 'done' ? 'success'
    : status === 'overdue' ? 'danger'
    : status === 'skipped' ? 'skipped'
    : 'pending'
  const Icon = status === 'done' ? Check
    : status === 'overdue' ? AlertTriangle
    : status === 'skipped' ? XCloseIcon
    : null
  let detailText = ''
  if (status === 'done' && dose.actualTime) {
    const diff = Math.round((new Date(dose.actualTime) - new Date(dose.scheduledAt)) / 60000)
    if (Math.abs(diff) < 5) detailText = 'no horário'
    else detailText = diff < 0 ? `${-diff}min antes` : `${diff}min depois`
  } else if (status === 'skipped') {
    detailText = 'pulada'
  } else if (status === 'overdue') {
    detailText = 'atrasada'
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 14, width: '100%',
        background: 'var(--dosy-bg-elevated)',
        border: 'none', cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--dosy-font-body)',
        boxShadow: 'var(--dosy-shadow-xs)',
      }}
    >
      <span style={{
        width: 38, height: 38, borderRadius: '50%',
        background: tone === 'success' ? 'var(--dosy-green-100)' : tone === 'danger' ? 'var(--dosy-red-100)' : 'var(--dosy-gray-100)',
        color: tone === 'success' ? 'var(--dosy-green-700)' : tone === 'danger' ? 'var(--dosy-red-700)' : 'var(--dosy-gray-700)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {Icon ? <Icon size={18} strokeWidth={2.5} /> : <span style={{ fontSize: 12, fontWeight: 800 }}>—</span>}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 14, fontWeight: 600,
          color: 'var(--dosy-fg)',
        }}>
          <span style={{
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{dose.medName}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--dosy-fg-muted)', marginTop: 1 }}>
          {formatTime(dose.scheduledAt)}{dose.unit ? ` · ${dose.unit}` : ''}{detailText ? ` · ${detailText}` : ''}
          {showPatient && patient && ` · ${patient.name}`}
        </div>
      </div>
      <StatusPill tone={tone} compact />
    </button>
  )
}
