import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FilterBar from '../components/FilterBar'
import DoseCard from '../components/DoseCard'
import DoseModal from '../components/DoseModal'
import EmptyState from '../components/EmptyState'
import Logo from '../components/Logo'
import TierBadge from '../components/TierBadge'
import AdBanner from '../components/AdBanner'
import { SkeletonList } from '../components/Skeleton'
import { useDoses } from '../hooks/useDoses'
import { usePatients } from '../hooks/usePatients'
import { useAuth } from '../hooks/useAuth'
import { firstName } from '../utils/userDisplay'
import { rangeNow } from '../utils/dateUtils'

export default function Dashboard() {
  const { data: patients = [] } = usePatients()
  const [filters, setFilters] = useState({ range: '24h', patientId: null, status: null, type: null })

  const { from, to } = useMemo(() => rangeNow(filters.range), [filters.range])
  const query = { from, to, patientId: filters.patientId, status: filters.status, type: filters.type }
  const { data: doses = [], isLoading } = useDoses(query)

  const [selected, setSelected] = useState(null)

  // resumo
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
  const { data: todayDoses = [] } = useDoses({ from: startOfToday.toISOString(), to: endOfToday.toISOString() })
  const pendingToday = todayDoses.filter((d) => d.status === 'pending' || d.status === 'overdue').length
  const overdueNow = todayDoses.filter((d) => d.status === 'overdue').length
  const weekFrom = new Date(); weekFrom.setDate(weekFrom.getDate() - 7)
  const { data: weekDoses = [] } = useDoses({ from: weekFrom.toISOString(), to: new Date().toISOString() })
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

  return (
    <div className="pb-28">
      <DashboardHero overdueNow={overdueNow} />
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
              <h3 className="font-semibold text-lg">Bem-vindo ao MedControl!</h3>
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
              {grouped.map(({ patient, list }) => (
                <section key={patient.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{patient.avatar || '👤'}</span>
                    <h2 className="font-semibold">{patient.name}</h2>
                    <span className="text-xs text-slate-500">({list.length})</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((d) => (
                      <DoseCard key={d.id} dose={d} onClick={() => setSelected(d)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        )}
      </div>

      <DoseModal dose={selected} open={!!selected} onClose={() => setSelected(null)}
                 patientName={selectedPatient?.name} />
    </div>
  )
}

function DashboardHero({ overdueNow }) {
  const { user } = useAuth()
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const name = firstName(user)
  return (
    <header className="sticky top-0 z-30 safe-top bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 text-white shadow-lg">
      <div className="max-w-md mx-auto px-4 pt-3 pb-4 flex items-center gap-3">
        <Logo size={44} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest opacity-80">{greet}{name ? `, ${name}` : ''}</p>
          <h1 className="font-extrabold text-lg leading-tight tracking-tight flex items-center gap-2">
            Med<span className="opacity-90">Control</span>
            <TierBadge />
          </h1>
        </div>
        {overdueNow > 0 && (
          <span className="text-[11px] font-semibold bg-rose-500 px-2 py-1 rounded-full animate-pulse">
            {overdueNow} atrasada{overdueNow > 1 ? 's' : ''}
          </span>
        )}
        <Link to="/ajustes" aria-label="Ajustes"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center">
          <span className="text-lg">⚙</span>
        </Link>
      </div>
    </header>
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
