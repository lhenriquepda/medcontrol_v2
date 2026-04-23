import { Link, useParams } from 'react-router-dom'
import Header from '../components/Header'
import EmptyState from '../components/EmptyState'
import { usePatient } from '../hooks/usePatients'
import { useTreatments } from '../hooks/useTreatments'
import { useDoses } from '../hooks/useDoses'

export default function PatientDetail() {
  const { id } = useParams()
  const { data: patient } = usePatient(id)
  const { data: treatments = [] } = useTreatments({ patientId: id })
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
  const { data: todayDoses = [] } = useDoses({ patientId: id, from: startOfToday.toISOString(), to: endOfToday.toISOString() })

  const taken = todayDoses.filter((d) => d.status === 'done').length
  const total = todayDoses.length
  const adherence = total ? Math.round((taken / total) * 100) : null

  if (!patient) return (
    <div><Header back title="Paciente" /><p className="p-4 text-sm text-slate-500">Carregando…</p></div>
  )

  const active = treatments.filter((t) => t.status === 'active')

  return (
    <div className="pb-28">
      <Header back title={patient.name} right={
        <Link to={`/pacientes/${id}/editar`} className="btn-ghost h-9 px-3 text-sm">Editar</Link>
      } />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-3xl flex items-center justify-center overflow-hidden">
            {patient.photo_url
              ? <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
              : patient.avatar || '👤'}
          </div>
          <div>
            <p className="font-semibold">{patient.name}</p>
            <p className="text-xs text-slate-500">
              {patient.age ? `${patient.age} anos` : 'Idade não informada'}
              {patient.weight ? ` · ${String(patient.weight).replace('.', ',')} kg` : ''}
            </p>
            {patient.condition && <p className="text-xs mt-1">{patient.condition}</p>}
            {patient.doctor && <p className="text-xs text-slate-500">Médico: {patient.doctor}</p>}
            {patient.allergies && <p className="text-xs text-rose-600 mt-1">⚠ Alergias: {patient.allergies}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-3 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300">
            <div className="text-[10px] uppercase tracking-wide">Adesão hoje</div>
            <div className="text-xl font-bold">{adherence == null ? '—' : `${adherence}%`}</div>
          </div>
          <div className="rounded-2xl p-3 bg-slate-100 dark:bg-slate-800">
            <div className="text-[10px] uppercase tracking-wide">Tratamentos ativos</div>
            <div className="text-xl font-bold">{active.length}</div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Tratamentos ativos</h3>
            <Link to={`/tratamento/novo?patientId=${id}`} className="text-xs text-brand-600">+ Novo</Link>
          </div>
          {active.length === 0 ? (
            <EmptyState icon="💊" title="Sem tratamentos ativos" />
          ) : (
            <div className="space-y-2">
              {active.map((t) => (
                <Link key={t.id} to={`/tratamento/${t.id}`} className="card p-3 block">
                  <p className="font-medium">{t.medName}</p>
                  <p className="text-xs text-slate-500">
                    {t.unit} · a cada {t.intervalHours}h · {t.durationDays} dias
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
