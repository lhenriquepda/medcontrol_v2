import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../components/Header'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icon'
import AdBanner from '../components/AdBanner'
import SharePatientSheet from '../components/SharePatientSheet'
import { usePatient } from '../hooks/usePatients'
import { useTreatments } from '../hooks/useTreatments'
import { useDoses } from '../hooks/useDoses'
import { usePatientShares } from '../hooks/useShares'
import { useAuth } from '../hooks/useAuth'
import { useIsPro } from '../hooks/useSubscription'
import PaywallModal from '../components/PaywallModal'

export default function PatientDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: patient } = usePatient(id)
  const { data: treatments = [] } = useTreatments({ patientId: id })
  const { data: shares = [] } = usePatientShares(id)
  const isPro = useIsPro()
  const [shareOpen, setShareOpen] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
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
  const isOwner = user && patient.userId === user.id

  return (
    <div className="pb-28">
      <Header back title={patient.name} right={
        <Link to={`/pacientes/${id}/editar`} className="btn-ghost h-9 px-3 text-sm">Editar</Link>
      } />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-4">
        <AdBanner />
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
            {patient.allergies && <p className="text-xs text-rose-600 mt-1 inline-flex items-start gap-1"><Icon name="warning" size={12} className="shrink-0 mt-0.5" /> Alergias: {patient.allergies}</p>}
          </div>
        </div>

        {isOwner ? (
          <button
            onClick={() => isPro ? setShareOpen(true) : setPaywallOpen(true)}
            className="w-full card p-3 flex items-center gap-3 active:scale-[0.99] transition text-left"
          >
            <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-200 flex items-center justify-center text-lg">
              🤝
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Compartilhar paciente</p>
              <p className="text-[11px] text-slate-500">
                {shares.length > 0
                  ? `Compartilhado com ${shares.length} pessoa${shares.length > 1 ? 's' : ''}`
                  : 'Trabalhe em conjunto com outro usuário · PRO'}
              </p>
            </div>
            <span className="text-slate-400">›</span>
          </button>
        ) : (
          <div className="card p-3 flex items-center gap-3 bg-brand-50 dark:bg-brand-500/10">
            <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center text-lg">👥</div>
            <div className="text-xs">
              <p className="font-semibold text-brand-700 dark:text-brand-200">Paciente compartilhado com você</p>
              <p className="text-slate-500">Edições aparecem em tempo real para ambos.</p>
            </div>
          </div>
        )}

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
            <EmptyState icon="pill" title="Sem tratamentos ativos" />
          ) : (
            <div className="space-y-2">
              {active.map((t) => (
                <Link key={t.id} to={`/tratamento/${t.id}`} className="card p-3 block">
                  <p className="font-medium">{t.medName}</p>
                  <p className="text-xs text-slate-500">
                    {t.unit} · {t.intervalHours ? `a cada ${t.intervalHours}h` : 'horários fixos'} · {t.isContinuous ? '♾ Contínuo' : `${t.durationDays} dias`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <SharePatientSheet open={shareOpen} onClose={() => setShareOpen(false)} patient={patient} />
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        reason="Compartilhar pacientes com outros cuidadores é um recurso PRO. Trabalhe em conjunto em tempo real."
      />
    </div>
  )
}
