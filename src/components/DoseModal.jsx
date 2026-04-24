import { useEffect, useState } from 'react'
import BottomSheet from './BottomSheet'
import { formatDateTime, fromDatetimeLocalInput, toDatetimeLocalInput } from '../utils/dateUtils'
import { useConfirmDose, useSkipDose, useUndoDose } from '../hooks/useDoses'
import { useToast } from '../hooks/useToast'

export default function DoseModal({ dose, open, onClose, patientName }) {
  const confirmMut = useConfirmDose()
  const skipMut = useSkipDose()
  const undoMut = useUndoDose()
  const toast = useToast()

  const [takenAtScheduled, setTakenAtScheduled] = useState(true)
  const [actualTime, setActualTime] = useState('')
  const [observation, setObservation] = useState('')

  useEffect(() => {
    if (dose) {
      setTakenAtScheduled(true)
      setActualTime(toDatetimeLocalInput(new Date().toISOString()))
      setObservation(dose.observation || '')
    }
  }, [dose])

  if (!dose) return null

  const isDone = dose.status === 'done' || dose.status === 'skipped'

  async function handleConfirm() {
    const actualIso = takenAtScheduled ? dose.scheduledAt : fromDatetimeLocalInput(actualTime)
    await confirmMut.mutateAsync({ id: dose.id, actualTime: actualIso, observation })
    onClose?.()
    toast.show({
      message: `Dose de ${dose.medName} confirmada.`, kind: 'success',
      undoLabel: 'Desfazer', onUndo: () => undoMut.mutate(dose.id)
    })
  }

  async function handleSkip() {
    await skipMut.mutateAsync({ id: dose.id, observation })
    onClose?.()
    toast.show({
      message: `Dose de ${dose.medName} marcada como pulada.`, kind: 'warn',
      undoLabel: 'Desfazer', onUndo: () => undoMut.mutate(dose.id)
    })
  }

  async function handleUndo() {
    await undoMut.mutateAsync(dose.id)
    onClose?.()
    toast.show({ message: 'Dose revertida para pendente.', kind: 'info' })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={dose.medName}>
      <div className="space-y-4">
        <div className="text-sm text-slate-500">
          {patientName && <p>Paciente: <span className="text-slate-800 dark:text-slate-200 font-medium">{patientName}</span></p>}
          <p>Agendada para: <span className="text-slate-800 dark:text-slate-200 font-medium">{formatDateTime(dose.scheduledAt)}</span></p>
          <p>Dosagem: <span className="text-slate-800 dark:text-slate-200 font-medium">{dose.unit}</span></p>
        </div>

        {!isDone ? (
          <>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" className="w-5 h-5 accent-brand-600"
                     checked={takenAtScheduled} onChange={(e) => setTakenAtScheduled(e.target.checked)} />
              <span className="text-sm">Tomada no horário agendado</span>
            </label>
            {!takenAtScheduled && (
              <div>
                <label className="block text-xs font-medium mb-1">Horário real</label>
                <input type="datetime-local" className="input" value={actualTime}
                       onChange={(e) => setActualTime(e.target.value)} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">Observação (opcional)</label>
              <textarea className="input" rows={3} placeholder="Ex: tomou com comida"
                        value={observation} onChange={(e) => setObservation(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <button className="btn-secondary flex-1" onClick={handleSkip} disabled={skipMut.isPending}>Pular</button>
              <button className="btn-primary flex-1" onClick={handleConfirm} disabled={confirmMut.isPending}>Confirmar</button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3 text-sm space-y-1">
              <p>Status: <strong>{dose.status === 'done' ? 'Tomada' : 'Pulada'}</strong></p>
              {dose.actualTime && <p>Horário real: {formatDateTime(dose.actualTime)}</p>}
              {dose.observation && <p>Obs.: {dose.observation}</p>}
            </div>
            <button className="btn-secondary w-full" onClick={handleUndo}>Desfazer</button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
