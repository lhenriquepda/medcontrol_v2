import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import EmptyState from '../components/EmptyState'
import { useTreatments, useUpdateTreatment } from '../hooks/useTreatments'
import { usePatients } from '../hooks/usePatients'

const STATUS_LABELS = { active: 'Ativo', ended: 'Encerrado', paused: 'Pausado' }

export default function TreatmentList() {
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState(null)
  const [status, setStatus] = useState(null)
  const [q, setQ] = useState('')
  const { data: all = [] } = useTreatments({ patientId: patientId || undefined, status: status || undefined })
  const update = useUpdateTreatment()

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return all
    return all.filter((t) => t.medName.toLowerCase().includes(term))
  }, [all, q])

  function patientName(id) { return patients.find((p) => p.id === id)?.name || '—' }

  return (
    <div className="pb-28">
      <Header back title="Tratamentos" right={
        <Link to="/tratamento/novo" className="btn-primary h-9 px-3 text-sm">+ Novo</Link>
      } />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-3">
        <input className="input" placeholder="Buscar por medicamento…" value={q} onChange={(e) => setQ(e.target.value)} />

        <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
          <button onClick={() => setPatientId(null)} className={`chip whitespace-nowrap ${!patientId ? 'chip-active' : ''}`}>Todos pacientes</button>
          {patients.map((p) => (
            <button key={p.id} onClick={() => setPatientId(p.id)}
                    className={`chip whitespace-nowrap ${patientId === p.id ? 'chip-active' : ''}`}>{p.name.split(' ')[0]}</button>
          ))}
        </div>

        <div className="flex gap-2">
          {[null, 'active', 'paused', 'ended'].map((s) => (
            <button key={s || 'all'} onClick={() => setStatus(s)}
                    className={`chip ${status === s ? 'chip-active' : ''}`}>
              {s ? STATUS_LABELS[s] : 'Todos'}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="💊" title="Nenhum tratamento" description="Crie um novo tratamento pelo botão +" />
        ) : filtered.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{t.medName}</p>
                <p className="text-xs text-slate-500 truncate">
                  {patientName(t.patientId)} · {t.unit} · {t.intervalHours ? `${t.intervalHours}h` : 'horários'} · {t.durationDays} dias
                </p>
              </div>
              <span className="chip">{STATUS_LABELS[t.status] || t.status}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Link to={`/tratamento/${t.id}`} className="btn-secondary flex-1 text-sm">Editar</Link>
              {t.status === 'active' && (
                <>
                  <button className="btn-ghost text-sm" onClick={() => update.mutate({ id: t.id, patch: { status: 'paused' } })}>Pausar</button>
                  <button className="btn-ghost text-sm" onClick={() => update.mutate({ id: t.id, patch: { status: 'ended' } })}>Encerrar</button>
                </>
              )}
              {t.status === 'paused' && (
                <button className="btn-ghost text-sm" onClick={() => update.mutate({ id: t.id, patch: { status: 'active' } })}>Retomar</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
