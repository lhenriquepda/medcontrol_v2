import { useEffect, useState } from 'react'
import BottomSheet from './BottomSheet'
import Icon from './Icon'
import { formatTime, formatDate } from '../utils/dateUtils'
import { useConfirmDose, useSkipDose, useUndoDose } from '../hooks/useDoses'
import { useToast } from '../hooks/useToast'

/**
 * MultiDoseModal — opens when user taps notification or hits Ciente in alarm.
 *
 * Lists ALL doses from the alert in one sheet. Each row has 3 inline actions:
 *   • Tomada (✓)  — confirmDose RPC
 *   • Pular  (⏭) — skipDose RPC
 *   • Ignorar (✕) — removes row from list visually (no DB write)
 *
 * Footer: "Marcar depois" — closes modal with remaining unprocessed doses
 * left as pending. User can re-engage from Dashboard.
 */
export default function MultiDoseModal({ open, onClose, doses, patients }) {
  const toast = useToast()
  const confirmMut = useConfirmDose()
  const skipMut = useSkipDose()
  const undoMut = useUndoDose()

  // Track per-dose visual state: 'pending' | 'done' | 'skipped' | 'ignored'
  const [states, setStates] = useState({})

  // Reset state apenas em open false→true (não em mudança de doses array,
  // que dispara após cada mutation invalidar a query e apaga o badge visual)
  useEffect(() => {
    if (open) setStates({})
  }, [open])

  // Auto-close quando todas doses processadas (Tomada/Pulada/Ignorar)
  // 1500ms dá tempo user ver badge + Desfazer inline + toast
  useEffect(() => {
    if (!open || !doses || doses.length === 0) return
    const handled = doses.every(d => states[d.id])
    if (handled) {
      const t = setTimeout(() => onClose?.(), 1500)
      return () => clearTimeout(t)
    }
  }, [states, open, doses, onClose])

  function handleUndo(dose) {
    const prev = states[dose.id]
    setStates(s => ({ ...s, [dose.id]: undefined }))
    if (prev === 'done' || prev === 'skipped') {
      undoMut.mutate(dose.id)
    }
  }

  if (!doses || doses.length === 0) return null

  const patientsMap = new Map((patients || []).map(p => [p.id, p]))
  const allHandled = doses.every(d => states[d.id])

  function patientName(d) {
    return d.patientName || patientsMap.get(d.patientId)?.name || 'Sem paciente'
  }

  async function handleConfirm(dose) {
    setStates(s => ({ ...s, [dose.id]: 'done' }))
    try {
      await confirmMut.mutateAsync({ id: dose.id, actualTime: new Date().toISOString(), observation: '' })
      toast.show({
        message: `${dose.medName} marcada como tomada.`, kind: 'success',
        undoLabel: 'Desfazer',
        onUndo: () => {
          undoMut.mutate(dose.id)
          setStates(s => ({ ...s, [dose.id]: undefined }))
        }
      })
    } catch (e) {
      setStates(s => ({ ...s, [dose.id]: undefined }))
      toast.show({ message: e?.message || 'Falha ao confirmar.', kind: 'error' })
    }
  }

  async function handleSkip(dose) {
    setStates(s => ({ ...s, [dose.id]: 'skipped' }))
    try {
      await skipMut.mutateAsync({ id: dose.id, observation: '' })
      toast.show({
        message: `${dose.medName} pulada.`, kind: 'warn',
        undoLabel: 'Desfazer',
        onUndo: () => {
          undoMut.mutate(dose.id)
          setStates(s => ({ ...s, [dose.id]: undefined }))
        }
      })
    } catch (e) {
      setStates(s => ({ ...s, [dose.id]: undefined }))
      toast.show({ message: e?.message || 'Falha ao pular.', kind: 'error' })
    }
  }

  function handleIgnore(dose) {
    // Local-only — dose continues pending in DB; visually removed from this view
    setStates(s => ({ ...s, [dose.id]: 'ignored' }))
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={doses.length === 1 ? 'Dose' : `${doses.length} doses`}
      footer={
        <button onClick={onClose} className="btn-secondary w-full">
          {allHandled ? 'Fechar' : 'Marcar depois'}
        </button>
      }
    >
      <div className="space-y-2">
        {doses.map((dose) => {
          const status = states[dose.id]
          const isHandled = !!status
          const statusBadge = {
            done: { icon: 'check', label: 'Tomada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
            skipped: { icon: 'skip', label: 'Pulada', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
            ignored: { icon: 'close', label: 'Ignorada', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }
          }[status]

          return (
            <div
              key={dose.id}
              className={`rounded-2xl border p-3 transition ${
                isHandled
                  ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-70'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-brand-600"><Icon name="pill" size={24} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate">
                    {patientName(dose)}
                  </p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {dose.medName}
                  </p>
                  <p className="text-xs text-brand-600 dark:text-brand-300">
                    {dose.unit}
                    {dose.scheduledAt && (
                      <span className="ml-2 text-slate-500 dark:text-slate-400">
                        · {formatTime(dose.scheduledAt)}
                      </span>
                    )}
                  </p>
                </div>
                {statusBadge && (
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1 ${statusBadge.cls}`}>
                    <Icon name={statusBadge.icon} size={10} /> {statusBadge.label}
                  </span>
                )}
              </div>

              {isHandled && (
                <button
                  onClick={() => handleUndo(dose)}
                  className="w-full mt-3 rounded-lg py-2 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 inline-flex items-center justify-center gap-1.5"
                >
                  <Icon name="undo" size={12} /> Desfazer
                </button>
              )}

              {!isHandled && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button
                    onClick={() => handleIgnore(dose)}
                    disabled={confirmMut.isPending || skipMut.isPending}
                    className="rounded-lg py-2 text-xs font-medium bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Ignorar
                  </button>
                  <button
                    onClick={() => handleSkip(dose)}
                    disabled={confirmMut.isPending || skipMut.isPending}
                    className="rounded-lg py-2 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    Pular
                  </button>
                  <button
                    onClick={() => handleConfirm(dose)}
                    disabled={confirmMut.isPending || skipMut.isPending}
                    className="rounded-lg py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Tomada
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {allHandled && (
        <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 mt-4 font-medium inline-flex items-center justify-center gap-1 w-full">
          <Icon name="check" size={12} /> Todas as doses marcadas
        </p>
      )}
    </BottomSheet>
  )
}
