import { useMemo, useState } from 'react'
import Header from '../components/Header'
import LockedOverlay from '../components/LockedOverlay'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'
import { useIsPro } from '../hooks/useSubscription'
import { formatDate } from '../utils/dateUtils'

export default function Analytics() {
  const { data: patients = [] } = usePatients()
  const [period, setPeriod] = useState('week') // week | month
  const [patientId, setPatientId] = useState(null)

  const days = period === 'week' ? 7 : 30
  const from = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - days + 1); d.setHours(0, 0, 0, 0); return d
  }, [days])
  const to = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }, [])

  const { data: doses = [] } = useDoses({
    from: from.toISOString(), to: to.toISOString(), patientId: patientId || undefined
  })

  const adherenceByPatient = useMemo(() => {
    const map = new Map()
    for (const d of doses) {
      if (new Date(d.scheduledAt) > new Date()) continue
      const m = map.get(d.patientId) || { total: 0, done: 0 }
      m.total += 1
      if (d.status === 'done') m.done += 1
      map.set(d.patientId, m)
    }
    return [...map.entries()].map(([pid, m]) => ({
      patient: patients.find((p) => p.id === pid),
      percent: m.total ? Math.round((m.done / m.total) * 100) : 0,
      ...m
    }))
  }, [doses, patients])

  // calendário heatmap simples
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
      let tone = 'bg-slate-200 dark:bg-slate-800'
      if (total > 0) {
        if (done === total) tone = 'bg-emerald-500'
        else if (done > 0) tone = 'bg-amber-400'
        else tone = 'bg-rose-500'
      }
      grid.push({ date: d, total, done, tone })
    }
    return grid
  }, [from, days, doses])

  // sos usage por med
  const sosByMed = useMemo(() => {
    const map = new Map()
    for (const d of doses) if (d.type === 'sos') map.set(d.medName, (map.get(d.medName) || 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [doses])

  const maxSos = Math.max(1, ...sosByMed.map(([, v]) => v))

  const isPro = useIsPro()

  return (
    <div className="pb-28">
      <Header back title="Análises" right={!isPro && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">🔒 PRO</span>} />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-4">
        {!isPro && (
          <LockedOverlay reason="Análises detalhadas de adesão, calendário e S.O.S são exclusivas do PRO." label="Desbloquear Análises">
            <div className="card p-4 space-y-3">
              <p className="text-sm font-semibold">Prévia</p>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-brand-500 w-3/4" /></div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className={`aspect-square rounded ${i % 3 === 0 ? 'bg-emerald-500' : i % 4 === 0 ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                ))}
              </div>
            </div>
          </LockedOverlay>
        )}
        <div className={`${isPro ? 'space-y-4' : 'hidden'}`}>
        <div className="flex gap-2">
          <button onClick={() => setPeriod('week')} className={`chip ${period === 'week' ? 'chip-active' : ''}`}>7 dias</button>
          <button onClick={() => setPeriod('month')} className={`chip ${period === 'month' ? 'chip-active' : ''}`}>30 dias</button>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
          <button onClick={() => setPatientId(null)} className={`chip whitespace-nowrap ${!patientId ? 'chip-active' : ''}`}>Todos</button>
          {patients.map((p) => (
            <button key={p.id} onClick={() => setPatientId(p.id)}
                    className={`chip whitespace-nowrap ${patientId === p.id ? 'chip-active' : ''}`}>{p.name.split(' ')[0]}</button>
          ))}
        </div>

        <section className="card p-4">
          <h3 className="font-semibold text-sm mb-3">Adesão por paciente</h3>
          {adherenceByPatient.length === 0 && <p className="text-xs text-slate-500">Sem dados no período.</p>}
          <div className="space-y-3">
            {adherenceByPatient.map((a) => (
              <div key={a.patient?.id || 'x'}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{a.patient?.avatar} {a.patient?.name || '—'}</span>
                  <span className="font-medium">{a.percent}% ({a.done}/{a.total})</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-brand-500" style={{ width: `${a.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4">
          <h3 className="font-semibold text-sm mb-3">Calendário de adesão</h3>
          <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${period === 'week' ? 7 : 10}, minmax(0, 1fr))` }}>
            {calendar.map((c, i) => (
              <div key={i} title={`${formatDate(c.date)} — ${c.done}/${c.total}`}
                   className={`aspect-square rounded-md ${c.tone}`} />
            ))}
          </div>
          <div className="flex gap-3 mt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> todas</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> parcial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500 inline-block" /> nenhuma</span>
          </div>
        </section>

        <section className="card p-4">
          <h3 className="font-semibold text-sm mb-3">Uso de S.O.S por medicamento</h3>
          {sosByMed.length === 0 && <p className="text-xs text-slate-500">Sem registros de S.O.S no período.</p>}
          <div className="space-y-2">
            {sosByMed.map(([med, count]) => (
              <div key={med}>
                <div className="flex justify-between text-xs mb-1"><span>{med}</span><span>{count}</span></div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: `${(count / maxSos) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>
    </div>
  )
}
