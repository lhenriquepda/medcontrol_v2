import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import FilterBar from '../components/FilterBar'
import DoseCard from '../components/DoseCard'
import DoseModal from '../components/DoseModal'
import EmptyState from '../components/EmptyState'
import AdBanner from '../components/AdBanner'
import { SkeletonList } from '../components/Skeleton'
import { useDoses } from '../hooks/useDoses'
import { usePatients } from '../hooks/usePatients'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { rangeNow } from '../utils/dateUtils'

export default function Dashboard() {
  const { data: patients = [] } = usePatients()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState({ range: '24h', patientId: null, status: null, type: null })

  // Aplica filtro via URL param — funciona no mount E quando já está na tela
  useEffect(() => {
    const f = searchParams.get('filter')
    if (f === 'overdue') {
      setFilters({ range: 'all', patientId: null, status: 'overdue', type: null })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  const { from, to } = useMemo(() => rangeNow(filters.range), [filters.range])
  const query = { from, to, patientId: filters.patientId, status: filters.status, type: filters.type }
  const { data: doses = [], isLoading } = useDoses(query)

  const [selected, setSelected] = useState(null)

  // Janelas de tempo memoizadas (tick por minuto evita novas chaves a cada render)
  const [tick, setTick] = useState(() => Math.floor(Date.now() / 60000))
  useEffect(() => {
    const t = setInterval(() => setTick(Math.floor(Date.now() / 60000)), 60000)
    return () => clearInterval(t)
  }, [])
  const windows = useMemo(() => {
    const now = new Date(tick * 60000)
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999)
    const overdueFrom = new Date(now); overdueFrom.setDate(overdueFrom.getDate() - 30)
    const weekFrom = new Date(now); weekFrom.setDate(weekFrom.getDate() - 7)
    return {
      today: { from: startOfToday.toISOString(), to: endOfToday.toISOString() },
      overdue: { from: overdueFrom.toISOString(), to: now.toISOString(), status: 'overdue' },
      week: { from: weekFrom.toISOString(), to: now.toISOString() }
    }
  }, [tick])

  const { data: todayDoses = [] } = useDoses(windows.today)
  const pendingToday = todayDoses.filter((d) => d.status === 'pending' || d.status === 'overdue').length
  const { data: overdueAll = [] } = useDoses(windows.overdue)
  const overdueNow = overdueAll.length
  const { data: weekDoses = [] } = useDoses(windows.week)
  const adherence = (() => {
    const past = weekDoses.filter((d) => new Date(d.scheduledAt) <= new Date())
    if (past.length === 0) return null
    const taken = past.filter((d) => d.status === 'done').length
    return Math.round((taken / past.length) * 100)
  })()

  const grouped = useMemo(() => {
    const map = new Map()
    for (const d of doses) {
      if (!map.has(d.patientId)) map.set(d.patientId, [])
      map.get(d.patientId).push(d)
    }
    return [...map.entries()].map(([pid, list]) => ({
      patient: patients.find((p) => p.id === pid) || { id: pid, name: 'Paciente', avatar: '👤' },
      list
    }))
  }, [doses, patients])

  const selectedPatient = selected && patients.find((p) => p.id === selected.patientId)

  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dashCollapsed') || '{}') } catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem('dashCollapsed', JSON.stringify(collapsed)) } catch {}
  }, [collapsed])
  const toggleCollapse = (id) => setCollapsed((s) => ({ ...s, [id]: !s[id] }))

  // Schedule push notifications for upcoming doses in the next 24h
  const { scheduleDoses } = usePushNotifications()
  useEffect(() => {
    if (todayDoses.length) scheduleDoses(todayDoses)
  }, [todayDoses, scheduleDoses])

  return (
    <div className="pb-28">
      <FilterBar filters={filters} setFilters={setFilters} patients={patients} />

      <div className="max-w-md mx-auto px-4 pt-3">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="Pendentes hoje" value={pendingToday} tone="brand" />
          <Stat label="Adesão 7d" value={adherence == null ? '—' : `${adherence}%`} tone="emerald" />
          <Stat label="Atrasadas" value={overdueNow} tone={overdueNow > 0 ? 'rose' : 'slate'} alert={overdueNow > 0} />
        </div>

        <AdBanner className="mb-4" />

        {isLoading ? <SkeletonList count={4} /> : (
          patients.length === 0 ? (
            <div className="card p-5 mt-2">
              <div className="text-4xl mb-2">👋</div>
              <h3 className="font-semibold text-lg">Bem-vindo ao Dosy!</h3>
              <p className="text-sm text-slate-500 mt-1 mb-4">
                Comece cadastrando as pessoas que você vai acompanhar — você, seus filhos, familiares…
              </p>
              <ol className="text-sm space-y-2 mb-4">
                <li className="flex gap-2"><span className="font-bold text-brand-600">1.</span> Cadastre os pacientes</li>
                <li className="flex gap-2"><span className="font-bold text-brand-600">2.</span> Crie um tratamento para cada medicamento</li>
                <li className="flex gap-2"><span className="font-bold text-brand-600">3.</span> Acompanhe as doses por aqui</li>
              </ol>
              <Link to="/pacientes/novo" className="btn-primary w-full">➕ Cadastrar primeiro paciente</Link>
            </div>
          ) : doses.length === 0 ? (
            <EmptyState icon="💊" title="Nenhuma dose neste período"
                        description="Ajuste os filtros ou crie um novo tratamento."
                        action={<Link to="/tratamento/novo" className="btn-primary">+ Novo tratamento</Link>} />
          ) : (
            <div className="space-y-5">
              {grouped.map(({ patient, list }) => {
                const isCollapsed = !!collapsed[patient.id]
                const overdueCount = list.filter((d) => d.status === 'overdue').length
                const pendingCount = list.filter((d) => d.status === 'pending').length
                return (
                  <section key={patient.id}>
                    <button
                      onClick={() => toggleCollapse(patient.id)}
                      className="w-full flex items-center gap-2 mb-2 group"
                    >
                      <span className="text-lg">{patient.avatar || '👤'}</span>
                      <h2 className="font-semibold">{patient.name}</h2>
                      <span className="text-xs text-slate-500">({list.length})</span>
                      {overdueCount > 0 && (
                        <span className="text-[10px] font-semibold bg-rose-500 text-white px-1.5 py-0.5 rounded-full">
                          {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {isCollapsed && pendingCount > 0 && overdueCount === 0 && (
                        <span className="text-[10px] font-semibold bg-brand-500/20 text-brand-700 dark:text-brand-200 px-1.5 py-0.5 rounded-full">
                          {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className={`ml-auto text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-2">
                        {list.map((d) => (
                          <DoseCard key={d.id} dose={d} onClick={() => setSelected(d)} />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )
        )}
      </div>

      <DoseModal dose={selected} open={!!selected} onClose={() => setSelected(null)}
                 patientName={selectedPatient?.name} />
    </div>
  )
}


function Stat({ label, value, tone = 'slate', alert }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  }
  return (
    <div className={`rounded-2xl p-3 ${tones[tone]} ${alert ? 'ring-2 ring-rose-400' : ''}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  )
}
