import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Lock, TrendingUp, TrendingDown, Minus, Flame,
  AlertTriangle, Clock, Pill, Activity, Calendar
} from 'lucide-react'
import { TIMING, EASE } from '../animations'
import LockedOverlay from '../components/LockedOverlay'
import AdBanner from '../components/AdBanner'
import { Card, Chip, StatusPill } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import PatientAvatar from '../components/PatientAvatar'
import { SkeletonList } from '../components/Skeleton'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'
import { useIsPro } from '../hooks/useSubscription'
import { formatDate } from '../utils/dateUtils'

// v0.2.3.5 #241 — Analytics redesign healthcare-focused.
// Layout inspired premium dark mobile dashboards (gauge ring + insight cards + trends).
// Mantém colors Dosy (peach primary, danger red).
// Foco insights acionáveis: adesão geral + trend vs período anterior + streak + top meds +
// horário problemático + flags healthcare (uso alto certas classes).

// Classes med flagged pra alerta clínico (uso prolongado/frequente preocupante).
// Match heuristic case-insensitive substring (não exato, pega variações comerciais).
const FLAGGED_CLASSES = {
  corticoide: { keywords: ['prednisona', 'predniso', 'dexameta', 'hidrocortis', 'budesonid', 'beclometaso', 'mometaso', 'fluticaso', 'avamys', 'nasacort', 'flixonase'], severity: 'warn', reason: 'Corticoide — uso prolongado pode ter efeitos colaterais sérios' },
  opioide: { keywords: ['tramadol', 'codeína', 'codeina', 'morfina', 'oxicodona', 'fentanil'], severity: 'danger', reason: 'Opioide — risco de dependência, monitorar tempo de uso' },
  ansiolitico: { keywords: ['diazepam', 'alprazolam', 'clonazepam', 'rivotril', 'lorazepam', 'bromazepam'], severity: 'warn', reason: 'Benzodiazepínico — uso > 4 semanas merece reavaliação' },
  aine: { keywords: ['ibuprofeno', 'diclofenaco', 'nimesulida', 'naproxeno', 'cetoprofeno'], severity: 'info', reason: 'Anti-inflamatório — uso frequente pode afetar estômago/rins' },
}

function classifyMed(medName) {
  const n = medName.toLowerCase()
  for (const [klass, cfg] of Object.entries(FLAGGED_CLASSES)) {
    if (cfg.keywords.some(k => n.includes(k))) return { klass, ...cfg }
  }
  return null
}

export default function Analytics() {
  const { data: patients = [] } = usePatients()
  const [period, setPeriod] = useState('30')
  const [patientId, setPatientId] = useState(null)
  const isPro = useIsPro()

  const days = Number(period)
  const from = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - days + 1); d.setHours(0, 0, 0, 0); return d
  }, [days])
  const to = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }, [])

  // Período anterior pra comparativo trend (mesma duração antes do current)
  const prevFrom = useMemo(() => {
    const d = new Date(from); d.setDate(d.getDate() - days); return d
  }, [from, days])
  const prevTo = useMemo(() => {
    const d = new Date(from); d.setMilliseconds(d.getMilliseconds() - 1); return d
  }, [from])

  const { data: doses = [], isLoading: loadingDoses } = useDoses({
    from: from.toISOString(), to: to.toISOString(), patientId: patientId || undefined,
  })
  const { data: prevDoses = [] } = useDoses({
    from: prevFrom.toISOString(), to: prevTo.toISOString(), patientId: patientId || undefined,
  })

  // ─── COMPUTAÇÕES ────────────────────────────────────────────────────────

  // Adesão geral (% doses tomadas / agendadas no período, excluindo futuras)
  const overall = useMemo(() => {
    const past = doses.filter(d => new Date(d.scheduledAt) <= new Date())
    const total = past.length
    const done = past.filter(d => d.status === 'done').length
    const skipped = past.filter(d => d.status === 'skipped').length
    const overdue = past.filter(d => d.status === 'overdue' || (d.status === 'pending' && new Date(d.scheduledAt) < new Date())).length
    return {
      total, done, skipped, overdue,
      percent: total ? Math.round((done / total) * 100) : 0,
    }
  }, [doses])

  const prevOverall = useMemo(() => {
    const past = prevDoses.filter(d => new Date(d.scheduledAt) <= new Date())
    const total = past.length
    const done = past.filter(d => d.status === 'done').length
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 }
  }, [prevDoses])

  const trend = overall.percent - prevOverall.percent

  // Streak — dias consecutivos com 100% adesão (sem skip/overdue) recente até hoje
  const streak = useMemo(() => {
    const byDay = new Map()
    for (const d of doses) {
      const t = new Date(d.scheduledAt)
      if (t > new Date()) continue
      const key = t.toISOString().slice(0, 10)
      const m = byDay.get(key) || { total: 0, done: 0 }
      m.total += 1
      if (d.status === 'done') m.done += 1
      byDay.set(key, m)
    }
    let count = 0
    for (let i = 0; i < days; i++) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0)
      const key = d.toISOString().slice(0, 10)
      const m = byDay.get(key)
      if (!m || m.total === 0) continue
      if (m.done === m.total) count += 1
      else break
    }
    return count
  }, [doses, days])

  const adherenceByPatient = useMemo(() => {
    const map = new Map()
    for (const d of doses) {
      if (new Date(d.scheduledAt) > new Date()) continue
      const m = map.get(d.patientId) || { total: 0, done: 0 }
      m.total += 1
      if (d.status === 'done') m.done += 1
      map.set(d.patientId, m)
    }
    return [...map.entries()]
      .map(([pid, m]) => ({
        patient: patients.find((p) => p.id === pid),
        percent: m.total ? Math.round((m.done / m.total) * 100) : 0,
        ...m,
      }))
      .sort((a, b) => b.percent - a.percent)
  }, [doses, patients])

  // Top medicamentos por uso (count doses scheduled, não importa status)
  const topMeds = useMemo(() => {
    const map = new Map()
    for (const d of doses) {
      const key = d.medName
      const m = map.get(key) || { count: 0, done: 0, patients: new Set() }
      m.count += 1
      if (d.status === 'done') m.done += 1
      m.patients.add(d.patientId)
      map.set(key, m)
    }
    return [...map.entries()]
      .map(([medName, m]) => ({
        medName,
        count: m.count,
        done: m.done,
        patientsCount: m.patients.size,
        flag: classifyMed(medName),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [doses])

  // Horário problemático — agrupa por hora-do-dia, % skip+overdue
  const hourlyMissed = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => ({ total: 0, missed: 0 }))
    for (const d of doses) {
      const t = new Date(d.scheduledAt)
      if (t > new Date()) continue
      const h = t.getHours()
      buckets[h].total += 1
      if (d.status === 'skipped' || d.status === 'overdue' || (d.status === 'pending' && t < new Date())) {
        buckets[h].missed += 1
      }
    }
    return buckets.map((b, h) => ({
      hour: h,
      total: b.total,
      missed: b.missed,
      pct: b.total ? Math.round((b.missed / b.total) * 100) : 0,
    }))
  }, [doses])

  const worstHour = useMemo(() => {
    const candidates = hourlyMissed.filter(h => h.total >= 2)
    if (candidates.length === 0) return null
    return candidates.reduce((a, b) => a.pct > b.pct ? a : b)
  }, [hourlyMissed])

  // Insights healthcare flags — meds flagged com count alto
  const healthInsights = useMemo(() => {
    const list = []
    for (const m of topMeds) {
      if (!m.flag) continue
      // threshold: count >= 5 em 30d, ou >=3 em 7d
      const threshold = days <= 7 ? 3 : days <= 30 ? 5 : 10
      if (m.count >= threshold) {
        list.push({
          medName: m.medName,
          count: m.count,
          flag: m.flag,
        })
      }
    }
    return list
  }, [topMeds, days])

  const calendar = useMemo(() => {
    const grid = []
    for (let i = 0; i < days; i++) {
      const d = new Date(from); d.setDate(d.getDate() + i)
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999)
      const inDay = doses.filter((x) => {
        const t = new Date(x.scheduledAt)
        return t >= dayStart && t <= dayEnd && t <= new Date()
      })
      const total = inDay.length
      const done = inDay.filter((x) => x.status === 'done').length
      let bg = 'var(--dosy-bg-sunken)'
      let pct = 0
      if (total > 0) {
        pct = done / total
        if (pct === 1) bg = '#6EC9A8'
        else if (pct >= 0.5) bg = '#F2B441'
        else bg = 'var(--dosy-danger)'
      }
      grid.push({ date: d, total, done, bg, pct })
    }
    return grid
  }, [from, days, doses])

  const sosByMed = useMemo(() => {
    const map = new Map()
    for (const d of doses) if (d.type === 'sos') map.set(d.medName, (map.get(d.medName) || 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [doses])

  const maxSos = Math.max(1, ...sosByMed.map(([, v]) => v))
  const maxHourly = Math.max(1, ...hourlyMissed.map(h => h.missed))

  return (
    <div style={{ paddingBottom: 110 }}>
      <PageHeader
        title="Análises"
        back
        right={!isPro && (
          <span style={{
            fontSize: 10, fontWeight: 800,
            padding: '4px 8px', borderRadius: 9999,
            background: 'var(--dosy-warning-bg)',
            color: '#C5841A',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--dosy-font-display)',
          }}>
            <Lock size={10} strokeWidth={2}/> PRO
          </span>
        )}
      />

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AdBanner />

        {!isPro && (
          <LockedOverlay reason="Análises detalhadas de adesão, calendário e S.O.S são exclusivas do PRO." label="Desbloquear Análises">
            <Card padding={16}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--dosy-fg)', margin: '0 0 12px 0' }}>Prévia</p>
              <div style={{ height: 8, borderRadius: 9999, background: 'var(--dosy-bg-sunken)', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', background: 'var(--dosy-gradient-sunset)', width: '75%' }}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} style={{
                    aspectRatio: '1 / 1', borderRadius: 6,
                    background: i % 3 === 0 ? '#6EC9A8' : i % 4 === 0 ? 'var(--dosy-danger)' : 'var(--dosy-bg-sunken)',
                  }}/>
                ))}
              </div>
            </Card>
          </LockedOverlay>
        )}

        {isPro && (
          <>
            {/* PERIOD CHIPS */}
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip size="sm" active={period === '7'} onClick={() => setPeriod('7')}>7 dias</Chip>
              <Chip size="sm" active={period === '30'} onClick={() => setPeriod('30')}>30 dias</Chip>
              <Chip size="sm" active={period === '90'} onClick={() => setPeriod('90')}>90 dias</Chip>
            </div>

            {/* PATIENT FILTER chips — padronizado igual Tratamentos com PatientAvatar */}
            {patients.length > 0 && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, paddingLeft: 4,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--dosy-fg-secondary)',
                  fontFamily: 'var(--dosy-font-display)',
                }}>
                  Filtrar por paciente
                </div>
                <div style={{
                  display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
                  scrollbarWidth: 'none', msOverflowStyle: 'none',
                }}>
                  <button
                    type="button"
                    onClick={() => setPatientId(null)}
                    style={chipStyle(!patientId)}
                  >
                    Todos
                  </button>
                  {patients.map((p) => {
                    const active = patientId === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPatientId(active ? null : p.id)}
                        style={{ ...chipStyle(active), paddingLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <PatientAvatar patient={p} size={22} />
                        <span style={{ paddingRight: 4 }}>{p.name.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Skeleton só em cold-start (sem cache prévio nem doses prev pra fallback) */}
            {loadingDoses && doses.length === 0 && prevDoses.length === 0 ? <SkeletonList count={3} /> : null}

            {/* HERO ADERÊNCIA — gauge ring + trend + streak */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
              <div style={{
                background: 'var(--dosy-gradient-sunset)',
                borderRadius: 24,
                padding: 20,
                color: 'white',
                boxShadow: '0 12px 32px -8px rgba(255, 107, 91, 0.4)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <GaugeRing percent={overall.percent} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', opacity: 0.9, marginBottom: 4,
                    }}>
                      Adesão geral
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 600, marginBottom: 8,
                      lineHeight: 1.35,
                    }}>
                      {overall.done} de {overall.total} doses tomadas
                    </div>
                    <TrendBadge delta={trend} />
                  </div>
                </div>

                {/* Sub-stats grid */}
                <div style={{
                  marginTop: 16, paddingTop: 14,
                  borderTop: '1px solid rgba(255,255,255,0.22)',
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                }}>
                  <SubStat label="Tomadas" value={overall.done} />
                  <SubStat label="Puladas" value={overall.skipped} />
                  <SubStat label="Atrasadas" value={overall.overdue} />
                </div>
              </div>
            </motion.div>

            {/* INSIGHT CARDS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <InsightCard
                icon={Flame}
                iconBg="var(--dosy-warning-bg, #FFF3E0)"
                iconColor="#E68A1A"
                label="Sequência"
                value={streak > 0 ? `${streak} ${streak === 1 ? 'dia' : 'dias'}` : '0 dias'}
                hint={streak > 0 ? 'Sem esquecer' : 'Comece hoje'}
              />
              <InsightCard
                icon={Activity}
                iconBg="var(--dosy-peach-100, #FEE0D6)"
                iconColor="var(--dosy-primary)"
                label="Total doses"
                value={String(overall.total)}
                hint={`em ${days} dias`}
              />
              {worstHour ? (
                <InsightCard
                  icon={Clock}
                  iconBg="#FFE5E1"
                  iconColor="var(--dosy-danger)"
                  label="Horário difícil"
                  value={`${String(worstHour.hour).padStart(2,'0')}h`}
                  hint={`${worstHour.pct}% perdidas`}
                />
              ) : (
                <InsightCard
                  icon={Clock}
                  iconBg="#E8F5EF"
                  iconColor="#3DA77F"
                  label="Horário difícil"
                  value="—"
                  hint="Sem dados"
                />
              )}
              <InsightCard
                icon={Pill}
                iconBg="#E8F0FE"
                iconColor="#4A7BC8"
                label="SOS no período"
                value={String(sosByMed.reduce((a, [, v]) => a + v, 0))}
                hint={sosByMed[0] ? `top: ${sosByMed[0][0]}` : 'Nenhum'}
              />
            </div>

            {/* HEALTHCARE INSIGHTS — flags clínicas */}
            {healthInsights.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
                <Card padding={0} style={{ overflow: 'hidden' }}>
                  <div style={{
                    padding: '12px 16px',
                    background: 'var(--dosy-warning-bg, #FFF3E0)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <AlertTriangle size={16} strokeWidth={2.25} style={{ color: '#C5841A', flexShrink: 0 }}/>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: '#7A4F08',
                      fontFamily: 'var(--dosy-font-display)',
                    }}>
                      Atenção clínica
                    </div>
                  </div>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {healthInsights.map((h, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: 10,
                        background: 'var(--dosy-bg)',
                        borderRadius: 12,
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', marginTop: 6,
                          background: h.flag.severity === 'danger' ? 'var(--dosy-danger)' : '#E68A1A',
                          flexShrink: 0,
                        }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dosy-fg)' }}>
                            {h.medName} <span style={{ fontWeight: 600, color: 'var(--dosy-fg-secondary)' }}>· {h.count}× em {days}d</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                            {h.flag.reason}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* TOP MEDS RANKING */}
            {topMeds.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
                <Card padding={16}>
                  <h3 style={{
                    fontFamily: 'var(--dosy-font-display)',
                    fontWeight: 700, fontSize: 14, margin: '0 0 12px 0',
                    color: 'var(--dosy-fg)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Pill size={14} strokeWidth={2.25} style={{ color: 'var(--dosy-primary)' }}/>
                    Medicamentos mais usados
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {topMeds.map((m, i) => {
                      const maxCount = topMeds[0].count
                      return (
                        <div key={m.medName}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 12.5, marginBottom: 4,
                          }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: 'var(--dosy-fg-tertiary)',
                              width: 16, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                            }}>{i + 1}</span>
                            <span style={{ fontWeight: 600, color: 'var(--dosy-fg)', flex: 1, minWidth: 0,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.medName}
                            </span>
                            {m.flag && (
                              <StatusPill
                                label={m.flag.klass}
                                kind={m.flag.severity === 'danger' ? 'skipped' : 'pending'}
                              />
                            )}
                            <span style={{
                              fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                              color: 'var(--dosy-fg)', flexShrink: 0,
                            }}>{m.count}</span>
                          </div>
                          <div style={{
                            height: 6, borderRadius: 9999, marginLeft: 24,
                            background: 'var(--dosy-bg-sunken)', overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              background: m.flag?.severity === 'danger' ? 'var(--dosy-danger)' : 'var(--dosy-gradient-sunset)',
                              width: `${(m.count / maxCount) * 100}%`,
                              transition: 'width 600ms var(--dosy-ease-out)',
                            }}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* HORÁRIOS PROBLEMÁTICOS — bar chart 24h */}
            {hourlyMissed.some(h => h.missed > 0) && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
                <Card padding={16}>
                  <h3 style={{
                    fontFamily: 'var(--dosy-font-display)',
                    fontWeight: 700, fontSize: 14, margin: '0 0 4px 0',
                    color: 'var(--dosy-fg)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Clock size={14} strokeWidth={2.25} style={{ color: 'var(--dosy-danger)' }}/>
                    Doses perdidas por horário
                  </h3>
                  <p style={{
                    fontSize: 11.5, color: 'var(--dosy-fg-secondary)',
                    margin: '0 0 14px 0', lineHeight: 1.4,
                  }}>
                    Horas com mais doses puladas/atrasadas
                  </p>
                  <div style={{
                    display: 'flex', alignItems: 'flex-end', gap: 2,
                    height: 80, paddingBottom: 18,
                  }}>
                    {hourlyMissed.map((h) => (
                      <div
                        key={h.hour}
                        title={`${String(h.hour).padStart(2,'0')}h — ${h.missed}/${h.total} perdidas`}
                        style={{
                          flex: 1, height: '100%', display: 'flex',
                          flexDirection: 'column', justifyContent: 'flex-end',
                          alignItems: 'center', gap: 4,
                        }}
                      >
                        <div style={{
                          width: '100%',
                          height: h.missed > 0 ? `${(h.missed / maxHourly) * 100}%` : '2px',
                          background: h.missed > 0
                            ? `rgba(229, 92, 78, ${0.4 + (h.missed / maxHourly) * 0.6})`
                            : 'var(--dosy-border)',
                          borderRadius: 3,
                          transition: 'height 400ms var(--dosy-ease-out)',
                        }}/>
                        {(h.hour === 0 || h.hour === 6 || h.hour === 12 || h.hour === 18) && (
                          <div style={{
                            fontSize: 9, color: 'var(--dosy-fg-tertiary)',
                            position: 'absolute', marginTop: 84,
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {String(h.hour).padStart(2,'0')}h
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ADESÃO POR PACIENTE */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
              <Card padding={16}>
                <h3 style={{
                  fontFamily: 'var(--dosy-font-display)',
                  fontWeight: 700, fontSize: 14, margin: '0 0 12px 0',
                  color: 'var(--dosy-fg)',
                }}>Adesão por paciente</h3>
                {adherenceByPatient.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', margin: 0 }}>Sem dados no período.</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {adherenceByPatient.map((a) => (
                    <div key={a.patient?.id || 'x'}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 12, marginBottom: 6, gap: 8,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          {a.patient && <PatientAvatar patient={a.patient} size={20} />}
                          <span style={{
                            color: 'var(--dosy-fg)', fontWeight: 600,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{a.patient?.name || '—'}</span>
                        </div>
                        <span style={{
                          fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: a.percent >= 80 ? '#3DA77F' : a.percent >= 50 ? '#E68A1A' : 'var(--dosy-danger)',
                          fontSize: 13,
                        }}>{a.percent}%</span>
                      </div>
                      <div style={{
                        height: 8, borderRadius: 9999,
                        background: 'var(--dosy-bg-sunken)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          background: a.percent >= 80 ? '#6EC9A8' : a.percent >= 50 ? '#F2B441' : 'var(--dosy-danger)',
                          width: `${a.percent}%`,
                          transition: 'width 600ms var(--dosy-ease-out)',
                        }}/>
                      </div>
                      <div style={{
                        fontSize: 10.5, color: 'var(--dosy-fg-tertiary)', marginTop: 2,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {a.done}/{a.total} doses
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* CALENDÁRIO HEATMAP */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
              <Card padding={16}>
                <h3 style={{
                  fontFamily: 'var(--dosy-font-display)',
                  fontWeight: 700, fontSize: 14, margin: '0 0 12px 0',
                  color: 'var(--dosy-fg)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Calendar size={14} strokeWidth={2.25} style={{ color: 'var(--dosy-primary)' }}/>
                  Calendário de adesão
                </h3>
                <div style={{
                  display: 'grid', gap: 4,
                  gridTemplateColumns: `repeat(${days <= 7 ? 7 : days <= 30 ? 10 : 15}, minmax(0, 1fr))`,
                }}>
                  {calendar.map((c, i) => (
                    <div
                      key={i}
                      title={`${formatDate(c.date)} — ${c.done}/${c.total}`}
                      style={{
                        aspectRatio: '1 / 1',
                        borderRadius: 4,
                        background: c.bg,
                      }}
                    />
                  ))}
                </div>
                <div style={{
                  display: 'flex', gap: 12, marginTop: 12,
                  fontSize: 11, color: 'var(--dosy-fg-secondary)',
                }}>
                  <LegendDot color="#6EC9A8" label="todas"/>
                  <LegendDot color="#F2B441" label="parcial"/>
                  <LegendDot color="var(--dosy-danger)" label="nenhuma"/>
                </div>
              </Card>
            </motion.div>

            {/* SOS POR MEDICAMENTO */}
            {sosByMed.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
                <Card padding={16}>
                  <h3 style={{
                    fontFamily: 'var(--dosy-font-display)',
                    fontWeight: 700, fontSize: 14, margin: '0 0 12px 0',
                    color: 'var(--dosy-fg)',
                  }}>Uso de S.O.S por medicamento</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sosByMed.map(([med, count]) => (
                      <div key={med}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          fontSize: 12, marginBottom: 4, color: 'var(--dosy-fg)',
                        }}>
                          <span>{med}</span>
                          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                        </div>
                        <div style={{
                          height: 8, borderRadius: 9999,
                          background: 'var(--dosy-bg-sunken)', overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', background: 'var(--dosy-danger)',
                            width: `${(count / maxSos) * 100}%`,
                          }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── COMPONENTES INTERNOS ─────────────────────────────────────────────────

function chipStyle(active) {
  return {
    flexShrink: 0,
    padding: '6px 12px',
    borderRadius: 999,
    background: active ? 'var(--dosy-primary)' : 'var(--dosy-bg-elevated)',
    color: active ? 'white' : 'var(--dosy-fg)',
    border: active ? 'none' : '1.5px solid var(--dosy-border)',
    fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 180ms',
    boxShadow: active ? '0 4px 10px -2px rgba(255,107,91,0.4)' : 'var(--dosy-shadow-xs)',
  }
}

function GaugeRing({ percent, size = 96, stroke = 10 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="white"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: EASE.out }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <div style={{
          fontSize: 26, fontWeight: 800, lineHeight: 1,
          fontFamily: 'var(--dosy-font-display)',
        }}>{percent}</div>
        <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>%</div>
      </div>
    </div>
  )
}

function TrendBadge({ delta }) {
  if (delta === 0) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', borderRadius: 999,
        background: 'rgba(255,255,255,0.18)',
        fontSize: 11, fontWeight: 700,
      }}>
        <Minus size={11} strokeWidth={2.5}/> Estável vs. anterior
      </span>
    )
  }
  const isUp = delta > 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 999,
      background: 'rgba(255,255,255,0.18)',
      fontSize: 11, fontWeight: 700,
    }}>
      {isUp ? <TrendingUp size={11} strokeWidth={2.5}/> : <TrendingDown size={11} strokeWidth={2.5}/>}
      {isUp ? '+' : ''}{delta} pp vs. anterior
    </span>
  )
}

function SubStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--dosy-font-display)' }}>{value}</div>
      <div style={{
        fontSize: 9, fontWeight: 600, opacity: 0.9, marginTop: 4,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  )
}

function InsightCard({ icon: Icon, iconBg, iconColor, label, value, hint }) {
  return (
    <Card padding={14}>
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 10,
      }}>
        <Icon size={18} strokeWidth={2.25} />
      </div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--dosy-fg-secondary)',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 800, color: 'var(--dosy-fg)',
        fontFamily: 'var(--dosy-font-display)', lineHeight: 1.1,
      }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--dosy-fg-tertiary)', marginTop: 4 }}>
          {hint}
        </div>
      )}
    </Card>
  )
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 12, height: 12, borderRadius: 4, background: color }}/>
      {label}
    </span>
  )
}
