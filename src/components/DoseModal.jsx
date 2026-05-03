import { useEffect, useState } from 'react'
import { Pill } from 'lucide-react'
import { Sheet, Button, StatusPill, Input } from './dosy'
import { formatDateTime, fromDatetimeLocalInput, toDatetimeLocalInput } from '../utils/dateUtils'
import { useConfirmDose, useSkipDose, useUndoDose } from '../hooks/useDoses'
import { useToast } from '../hooks/useToast'
import { usePrivacyScreen } from '../hooks/usePrivacyScreen'

const STATUS_INFO = {
  done:    { label: 'Tomada', kind: 'success' },
  pending: { label: 'Pendente', kind: 'pending' },
  overdue: { label: 'Atrasada', kind: 'danger' },
  skipped: { label: 'Pulada', kind: 'skipped' },
}

export default function DoseModal({ dose, open, onClose, patientName, queueRemaining = 0 }) {
  const confirmMut = useConfirmDose()
  const skipMut = useSkipDose()
  const undoMut = useUndoDose()
  const toast = useToast()
  // Aud 4.5.4 G2 — bloqueia screenshot + mask recents enquanto modal aberto
  usePrivacyScreen(open)

  const [timingMode, setTimingMode] = useState('agora') // agora | prevista | outro
  const [actualTime, setActualTime] = useState('')
  const [observation, setObservation] = useState('')

  useEffect(() => {
    if (dose) {
      setTimingMode('agora')
      setActualTime(toDatetimeLocalInput(new Date().toISOString()))
      setObservation(dose.observation || '')
    }
  }, [dose])

  if (!dose) return null

  const isDone = dose.status === 'done' || dose.status === 'skipped'
  const statusInfo = STATUS_INFO[dose.status] || STATUS_INFO.pending

  function computeActualIso() {
    if (timingMode === 'prevista') return dose.scheduledAt
    if (timingMode === 'outro') return fromDatetimeLocalInput(actualTime)
    return new Date().toISOString() // agora
  }

  function handleConfirm() {
    const actualIso = computeActualIso()
    const doseId = dose.id
    const medName = dose.medName
    confirmMut.mutate({ id: doseId, actualTime: actualIso, observation })
    onClose?.()
    toast.show({
      message: `Dose de ${medName} confirmada.`, kind: 'success',
      undoLabel: 'Desfazer', onUndo: () => undoMut.mutate(doseId),
    })
  }

  function handleSkip() {
    const doseId = dose.id
    const medName = dose.medName
    skipMut.mutate({ id: doseId, observation })
    onClose?.()
    toast.show({
      message: `Dose de ${medName} marcada como pulada.`, kind: 'warn',
      undoLabel: 'Desfazer', onUndo: () => undoMut.mutate(doseId),
    })
  }

  function handleUndo() {
    undoMut.mutate(dose.id)
    onClose?.()
    toast.show({ message: 'Dose revertida para pendente.', kind: 'info' })
  }

  const scheduledTime = new Date(dose.scheduledAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <Sheet open={open} onClose={onClose}>
      {/* Header — pill icon + med name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'var(--dosy-peach-100)',
          color: 'var(--dosy-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Pill size={26} strokeWidth={1.75}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 800, fontSize: 22, letterSpacing: '-0.025em',
            lineHeight: 1.1, color: 'var(--dosy-fg)',
          }}>{dose.medName}</div>
          <div style={{ fontSize: 14, color: 'var(--dosy-fg-secondary)', marginTop: 3 }}>
            {dose.unit}{patientName ? ` · ${patientName}` : ''}
          </div>
        </div>
        <StatusPill label={statusInfo.label} kind={statusInfo.kind}/>
      </div>

      {queueRemaining > 0 && (
        <div style={{
          fontSize: 12.5, fontWeight: 600,
          color: 'var(--dosy-primary)',
          marginBottom: 12,
        }}>
          +{queueRemaining} dose{queueRemaining === 1 ? '' : 's'} na fila após esta
        </div>
      )}

      {/* Big time card — Previsto / Tomado */}
      <div style={{
        background: dose.status === 'overdue' ? 'var(--dosy-danger-bg)' : 'var(--dosy-bg-sunken)',
        borderRadius: 18,
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: dose.status === 'overdue' ? 'var(--dosy-danger)' : 'var(--dosy-fg-secondary)',
            fontFamily: 'var(--dosy-font-display)',
          }}>Previsto</div>
          <div style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 800, fontSize: 28,
            letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums',
            color: dose.status === 'overdue' ? 'var(--dosy-danger)' : 'var(--dosy-fg)',
            lineHeight: 1.1, marginTop: 2,
          }}>{scheduledTime}</div>
        </div>
        {dose.actualTime && (
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
              fontFamily: 'var(--dosy-font-display)',
            }}>Tomado</div>
            <div style={{
              fontFamily: 'var(--dosy-font-display)',
              fontWeight: 800, fontSize: 28,
              letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums',
              color: '#3F9E7E', lineHeight: 1.1, marginTop: 2,
            }}>{new Date(dose.actualTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        )}
      </div>

      {!isDone ? (
        <>
          {/* Timing picker segmentado */}
          <div style={{
            background: 'var(--dosy-bg-elevated)',
            borderRadius: 18, padding: 4,
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4,
            marginBottom: 12, boxShadow: 'var(--dosy-shadow-xs)',
          }}>
            {[
              { id: 'agora',    label: 'Agora',         sub: 'agora mesmo' },
              { id: 'prevista', label: 'Hora prevista', sub: scheduledTime },
              { id: 'outro',    label: 'Outro',         sub: 'definir' },
            ].map(opt => {
              const active = timingMode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTimingMode(opt.id)}
                  className="dosy-press"
                  style={{
                    border: 'none', cursor: 'pointer',
                    padding: '10px 6px', borderRadius: 14,
                    background: active ? 'var(--dosy-bg)' : 'transparent',
                    color: active ? 'var(--dosy-fg)' : 'var(--dosy-fg-secondary)',
                    boxShadow: active ? 'var(--dosy-shadow-sm)' : 'none',
                    display: 'flex', flexDirection: 'column', gap: 2,
                    alignItems: 'center',
                    fontFamily: 'var(--dosy-font-body)',
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{opt.label}</span>
                  <span style={{
                    fontSize: 10.5, color: 'var(--dosy-fg-tertiary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>{opt.sub}</span>
                </button>
              )
            })}
          </div>

          {timingMode === 'outro' && (
            <div style={{ marginBottom: 12 }}>
              <Input
                label="Horário real"
                type="datetime-local"
                value={actualTime}
                onChange={(e) => setActualTime(e.target.value)}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <Input
              label="Observação (opcional)"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: tomou com comida"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Button
              kind="ghost"
              onClick={onClose}
              disabled={skipMut.isPending || confirmMut.isPending}
              full
            >
              Ignorar
            </Button>
            <Button
              kind="secondary"
              onClick={handleSkip}
              disabled={skipMut.isPending}
              full
            >
              Pular
            </Button>
            <Button
              kind="primary"
              onClick={handleConfirm}
              disabled={confirmMut.isPending}
              full
            >
              Tomada
            </Button>
          </div>
        </>
      ) : (
        <>
          <div style={{
            background: 'var(--dosy-bg-sunken)',
            borderRadius: 16, padding: 14,
            fontSize: 13.5, lineHeight: 1.5,
            color: 'var(--dosy-fg)',
            display: 'flex', flexDirection: 'column', gap: 4,
            marginBottom: 12,
          }}>
            <p style={{ margin: 0 }}>
              Status: <strong>{dose.status === 'done' ? 'Tomada' : 'Pulada'}</strong>
            </p>
            {dose.actualTime && (
              <p style={{ margin: 0, color: 'var(--dosy-fg-secondary)' }}>
                Horário real: {formatDateTime(dose.actualTime)}
              </p>
            )}
            {dose.observation && (
              <p style={{ margin: 0, color: 'var(--dosy-fg-secondary)' }}>
                Obs.: {dose.observation}
              </p>
            )}
          </div>
          <Button kind="secondary" onClick={handleUndo} full>
            Desfazer
          </Button>
        </>
      )}
    </Sheet>
  )
}
