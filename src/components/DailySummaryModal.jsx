import { useMemo } from 'react'
import { useDoses, useConfirmDose, useSkipDose } from '../hooks/useDoses'
import { usePatients } from '../hooks/usePatients'
import { useToast } from '../hooks/useToast'
import { formatDateTime } from '../utils/dateUtils'
import Icon from './Icon'

/**
 * DailySummaryModal — overlay shown when user taps the "Resumo diário" notification.
 * Lists pending doses (next 24h) + overdue (last 30 days, not done).
 * Quick actions: Tomada / Pular per dose.
 */
export default function DailySummaryModal({ open, onClose }) {
  const { data: patients = [] } = usePatients()
  const toast = useToast()
  const confirmMut = useConfirmDose()
  const skipMut = useSkipDose()

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000)
  const past30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000)

  const { data: pending = [] } = useDoses({
    from: now.toISOString(),
    to: in24h.toISOString(),
    status: 'pending'
  })
  const { data: overdue = [] } = useDoses({
    from: past30.toISOString(),
    to: now.toISOString(),
    status: 'overdue'
  })

  const patientName = useMemo(() => {
    const map = new Map(patients.map(p => [p.id, p.name]))
    return (id) => map.get(id) || '—'
  }, [patients])

  if (!open) return null

  async function handleConfirm(dose) {
    try {
      await confirmMut.mutateAsync({ id: dose.id, actualTime: dose.scheduledAt, observation: '' })
      toast.show({ message: `${dose.medName} confirmada.`, kind: 'success' })
    } catch (e) {
      toast.show({ message: e.message || 'Erro ao confirmar.', kind: 'error' })
    }
  }

  async function handleSkip(dose) {
    try {
      await skipMut.mutateAsync({ id: dose.id, observation: '' })
      toast.show({ message: `${dose.medName} pulada.`, kind: 'info' })
    } catch (e) {
      toast.show({ message: e.message || 'Erro ao pular.', kind: 'error' })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Icon name="calendar" size={20} className="text-brand-600" /> Resumo das próximas 24h
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {pending.length} agendada{pending.length === 1 ? '' : 's'}
              {overdue.length > 0 && <> · <span className="text-rose-500">{overdue.length} atrasada{overdue.length === 1 ? '' : 's'}</span></>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 px-2"
            aria-label="Fechar"
          ><Icon name="close" size={20} /></button>
        </div>

        {/* Lists */}
        <div className="overflow-y-auto px-5 py-3 space-y-4">
          {/* Atrasadas (prioridade) */}
          {overdue.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-600 mb-2 flex items-center gap-1">
                <Icon name="warning" size={14} /> Atrasadas ({overdue.length})
              </h3>
              <ul className="space-y-2">
                {overdue.map(d => (
                  <DoseRow
                    key={d.id}
                    dose={d}
                    patient={patientName(d.patientId)}
                    onConfirm={() => handleConfirm(d)}
                    onSkip={() => handleSkip(d)}
                    overdue
                  />
                ))}
              </ul>
            </section>
          )}

          {/* Próximas 24h */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-2">
              Próximas 24 horas ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4 text-center">
                Nenhuma dose agendada nas próximas 24 horas.
              </p>
            ) : (
              <ul className="space-y-2">
                {pending.map(d => (
                  <DoseRow
                    key={d.id}
                    dose={d}
                    patient={patientName(d.patientId)}
                    onConfirm={() => handleConfirm(d)}
                    onSkip={() => handleSkip(d)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-medium hover:bg-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function DoseRow({ dose, patient, onConfirm, onSkip, overdue }) {
  return (
    <li className={`p-3 rounded-xl border ${overdue ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{dose.medName}</p>
          <p className="text-xs text-slate-500 truncate">
            {patient} · {dose.unit} · {formatDateTime(dose.scheduledAt)}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={onConfirm}
          className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
        ><span className="inline-flex items-center gap-1"><Icon name="check" size={12} /> Tomada</span></button>
        <button
          onClick={onSkip}
          className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300"
        >Pular</button>
      </div>
    </li>
  )
}
