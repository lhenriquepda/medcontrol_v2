import { useEffect, useState } from 'react'
import { Pill, Check, SkipForward, X as XIcon, Undo2 } from 'lucide-react'
import { Sheet, Button, StatusPill } from './dosy'
import { formatTime } from '../utils/dateUtils'
import { useConfirmDose, useSkipDose, useUndoDose } from '../hooks/useDoses'
import { useToast } from '../hooks/useToast'

/**
 * MultiDoseModal — opens when user taps notification or hits Ciente in alarm.
 * Item #105 [P1, v0.2.0.1]: refactored from BottomSheet legacy → Dosy Sheet
 * primitive + Card per dose + Button primary/secondary + StatusPill.
 */
export default function MultiDoseModal({ open, onClose, doses, patients }) {
  const toast = useToast()
  const confirmMut = useConfirmDose()
  const skipMut = useSkipDose()
  const undoMut = useUndoDose()

  // 'pending' | 'done' | 'skipped' | 'ignored'
  const [states, setStates] = useState({})

  useEffect(() => {
    if (open) setStates({})
  }, [open])

  useEffect(() => {
    if (!open || !doses || doses.length === 0) return
    const handled = doses.every((d) => states[d.id])
    if (handled) {
      const t = setTimeout(() => onClose?.(), 1500)
      return () => clearTimeout(t)
    }
  }, [states, open, doses, onClose])

  function handleUndo(dose) {
    const prev = states[dose.id]
    setStates((s) => ({ ...s, [dose.id]: undefined }))
    if (prev === 'done' || prev === 'skipped') {
      undoMut.mutate(dose.id)
    }
  }

  if (!doses || doses.length === 0) return null

  const patientsMap = new Map((patients || []).map((p) => [p.id, p]))
  const allHandled = doses.every((d) => states[d.id])

  function patientName(d) {
    return d.patientName || patientsMap.get(d.patientId)?.name || 'Sem paciente'
  }

  async function handleConfirm(dose) {
    setStates((s) => ({ ...s, [dose.id]: 'done' }))
    try {
      await confirmMut.mutateAsync({ id: dose.id, actualTime: new Date().toISOString(), observation: '' })
      toast.show({
        message: `${dose.medName} marcada como tomada.`, kind: 'success',
        undoLabel: 'Desfazer',
        onUndo: () => {
          undoMut.mutate(dose.id)
          setStates((s) => ({ ...s, [dose.id]: undefined }))
        },
      })
    } catch (e) {
      setStates((s) => ({ ...s, [dose.id]: undefined }))
      toast.show({ message: e?.message || 'Falha ao confirmar.', kind: 'error' })
    }
  }

  async function handleSkip(dose) {
    setStates((s) => ({ ...s, [dose.id]: 'skipped' }))
    try {
      await skipMut.mutateAsync({ id: dose.id, observation: '' })
      toast.show({
        message: `${dose.medName} pulada.`, kind: 'warn',
        undoLabel: 'Desfazer',
        onUndo: () => {
          undoMut.mutate(dose.id)
          setStates((s) => ({ ...s, [dose.id]: undefined }))
        },
      })
    } catch (e) {
      setStates((s) => ({ ...s, [dose.id]: undefined }))
      toast.show({ message: e?.message || 'Falha ao pular.', kind: 'error' })
    }
  }

  function handleIgnore(dose) {
    setStates((s) => ({ ...s, [dose.id]: 'ignored' }))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={doses.length === 1 ? 'Dose' : `${doses.length} doses`}
      footer={
        <Button kind="secondary" full onClick={onClose}>
          {allHandled ? 'Fechar' : 'Marcar depois'}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {doses.map((dose) => {
          const status = states[dose.id]
          const isHandled = !!status
          const statusCfg = {
            done: { label: 'tomada', kind: 'success' },
            skipped: { label: 'pulada', kind: 'pending' },
            ignored: { label: 'ignorada', kind: 'skipped' },
          }[status]

          return (
            <div
              key={dose.id}
              style={{
                background: isHandled ? 'var(--dosy-bg-sunken)' : 'var(--dosy-bg-elevated)',
                border: '1px solid var(--dosy-border)',
                borderRadius: 16,
                padding: 12,
                opacity: isHandled ? 0.7 : 1,
                transition: 'opacity 200ms var(--dosy-ease-out)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'var(--dosy-peach-100)',
                  color: 'var(--dosy-primary)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Pill size={22} strokeWidth={2}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--dosy-fg-tertiary)',
                    margin: 0, fontFamily: 'var(--dosy-font-display)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{patientName(dose)}</p>
                  <p style={{
                    fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em',
                    color: 'var(--dosy-fg)', margin: '2px 0 0 0',
                    fontFamily: 'var(--dosy-font-display)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{dose.medName}</p>
                  <p style={{
                    fontSize: 12, color: 'var(--dosy-fg-secondary)',
                    margin: '2px 0 0 0',
                  }}>
                    {dose.unit}
                    {dose.scheduledAt && (
                      <span style={{ marginLeft: 6, color: 'var(--dosy-fg-tertiary)' }}>
                        · {formatTime(dose.scheduledAt)}
                      </span>
                    )}
                  </p>
                </div>
                {statusCfg && <StatusPill label={statusCfg.label} kind={statusCfg.kind}/>}
              </div>

              {isHandled && (
                <button
                  type="button"
                  onClick={() => handleUndo(dose)}
                  className="dosy-press"
                  style={{
                    width: '100%', marginTop: 12,
                    padding: '8px 12px', borderRadius: 10,
                    background: 'var(--dosy-bg-elevated)',
                    border: '1px solid var(--dosy-border)',
                    color: 'var(--dosy-fg-secondary)',
                    fontSize: 12, fontWeight: 700,
                    fontFamily: 'var(--dosy-font-display)',
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Undo2 size={14} strokeWidth={2}/> Desfazer
                </button>
              )}

              {!isHandled && (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8, marginTop: 12,
                }}>
                  <Button
                    kind="ghost"
                    size="sm"
                    icon={XIcon}
                    onClick={() => handleIgnore(dose)}
                    disabled={confirmMut.isPending || skipMut.isPending}
                  >
                    Ignorar
                  </Button>
                  <Button
                    kind="secondary"
                    size="sm"
                    icon={SkipForward}
                    onClick={() => handleSkip(dose)}
                    disabled={confirmMut.isPending || skipMut.isPending}
                    style={{ background: '#FCEACB', color: '#C5841A' }}
                  >
                    Pular
                  </Button>
                  <Button
                    kind="primary"
                    size="sm"
                    icon={Check}
                    onClick={() => handleConfirm(dose)}
                    disabled={confirmMut.isPending || skipMut.isPending}
                  >
                    Tomada
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {allHandled && (
        <p style={{
          textAlign: 'center', fontSize: 12,
          color: '#3F9E7E', fontWeight: 700,
          marginTop: 16,
          fontFamily: 'var(--dosy-font-display)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          width: '100%',
        }}>
          <Check size={14} strokeWidth={2.5}/> Todas as doses marcadas
        </p>
      )}
    </Sheet>
  )
}
