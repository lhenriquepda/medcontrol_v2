import { useEffect, useState } from 'react'
import { Pill } from 'lucide-react'
import { Sheet, Button, StatusPill, Input } from './dosy'
import { formatDateTime, fromDatetimeLocalInput, toDateInput } from '../utils/dateUtils'
import { useConfirmDose, useSkipDose, useUndoDose } from '../hooks/useDoses'
import { useToast } from '../hooks/useToast'
import { usePrivacyScreen } from '../hooks/usePrivacyScreen'
import { hasSupabase, supabase } from '../services/supabase'

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
  const [actualDateVal, setActualDateVal] = useState('')
  const [actualTime, setActualTime] = useState('')
  const [observation, setObservation] = useState('')
  // Item #138 (egress-audit-2026-05-05 F4) — listDoses agora exclui observation
  // por padrão (DOSE_COLS_LIST). DoseModal lazy-load observation quando abre,
  // se não veio na prop (1 query individual << 1000 rows × observation/lista).
  const [loadedObs, setLoadedObs] = useState(null)

  useEffect(() => {
    if (dose) {
      setTimingMode('agora')
      const _now = new Date()
      setActualDateVal(toDateInput(_now.toISOString()))
      setActualTime(`${String(_now.getHours()).padStart(2,'0')}:${String(_now.getMinutes()).padStart(2,'0')}`)
      setObservation(dose.observation || '')
      setLoadedObs(null)
      // Lazy-load observation se não veio na lista (DOSE_COLS_LIST exclui)
      if (open && hasSupabase && dose.observation === undefined && dose.id) {
        supabase.from('doses').select('observation').eq('id', dose.id).maybeSingle()
          .then(({ data, error }) => {
            if (error || !data) return
            const obs = data.observation || ''
            setLoadedObs(obs)
            setObservation(obs)
          })
      }
    }
  }, [dose, open])

  // Use loadedObs se carregada, senão dose.observation original (cache cheio).
  const displayObs = loadedObs !== null ? loadedObs : (dose?.observation || '')

  if (!dose) return null

  const isDone = dose.status === 'done' || dose.status === 'skipped'
  const statusInfo = STATUS_INFO[dose.status] || STATUS_INFO.pending

  function computeActualIso() {
    if (timingMode === 'prevista') return dose.scheduledAt
    if (timingMode === 'outro') return fromDatetimeLocalInput(`${actualDateVal}T${actualTime}`)
    return new Date().toISOString() // agora
  }

  // v0.2.6.12 FIX B102 REAL — mutateAsync + await em vez de mutate fire-and-forget.
  //
  // Logcat QA real S25 Ultra (2026-05-24) confirmou bug:
  //   17:40:04  user tap Tomada (UI mostra ✅ otimista)
  //   17:42:32  app pra background
  //   17:49:14  PID NOVO 21330 cold start (Android OS KILLED process antigo)
  //   0 chamadas /rpc/confirm_dose_v2 em ambas sessões = mutation NUNCA virou fetch HTTP
  //
  // Root cause: confirmMut.mutate() é fire-and-forget. handleConfirm chamava onClose()
  // IMEDIATAMENTE depois, sem aguardar mutation async completar. TanStack mutationFn
  // ficava em fila a executar depois mas Samsung One UI / Android Doze KILL o process
  // (battery opt + memory pressure) antes do fetch sair → mutation perdida no kill.
  //
  // Fix: mutateAsync + await. Modal não fecha + UI bloqueada (spinner via isPending)
  // até RPC completar. Tradeoff: tap → 200ms-2000ms blocking. Mas garante fetch HTTP
  // enviado antes de user fechar app/process morrer.
  //
  // Offline: TanStack networkMode: 'offlineFirst' faz mutate pausar imediatamente
  // (não tenta fetch quando offline), retorna paused state. Comportamento offline
  // queue paused inalterado — drena via resumePausedMutations no boot.
  async function handleConfirm() {
    const actualIso = computeActualIso()
    const doseId = dose.id
    const medName = dose.medName
    try {
      await confirmMut.mutateAsync({ id: doseId, actualTime: actualIso, observation })
    } catch {
      // onError já trata via handleDoseMutationError (toast + rollback + Sentry).
    }
    onClose?.()
    toast.show({
      message: `Dose de ${medName} confirmada.`, kind: 'success',
      undoLabel: 'Desfazer', onUndo: () => undoMut.mutate(doseId),
    })
  }

  async function handleSkip() {
    const doseId = dose.id
    const medName = dose.medName
    try {
      await skipMut.mutateAsync({ id: doseId, observation })
    } catch { /* onError trata */ }
    onClose?.()
    toast.show({
      message: `Dose de ${medName} marcada como pulada.`, kind: 'warn',
      undoLabel: 'Desfazer', onUndo: () => undoMut.mutate(doseId),
    })
  }

  async function handleUndo() {
    const doseId = dose.id
    try {
      await undoMut.mutateAsync(doseId)
    } catch { /* onError trata */ }
    onClose?.()
    toast.show({ message: 'Dose revertida para pendente.', kind: 'info' })
  }

  const scheduledTime = new Date(dose.scheduledAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <Sheet open={open} onClose={onClose}>
      {/* v0.2.6.10 MEL-001 — data-testid pra QA automation determinístico */}
      <div data-testid="dose-modal" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
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
            <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
              <Input
                label="Data"
                type="date"
                value={actualDateVal}
                onChange={(e) => setActualDateVal(e.target.value)}
                style={{ flex: 1 }}
              />
              <Input
                label="Hora"
                type="time"
                value={actualTime}
                onChange={(e) => setActualTime(e.target.value)}
                style={{ flex: 1 }}
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

          {/* v0.2.6.10 M-realq2 — botões com minHeight 48dp (Material Design touch target)
              + data-testid (MEL-001). gap 10 → 12 melhora separação visual e reduz
              mistap entre botões adjacentes em hands largas. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Button
              kind="ghost"
              onClick={onClose}
              disabled={skipMut.isPending || confirmMut.isPending}
              full
              data-testid="dose-modal-ignore"
              style={{ minHeight: 48 }}
            >
              Ignorar
            </Button>
            <Button
              kind="secondary"
              onClick={handleSkip}
              disabled={skipMut.isPending}
              full
              data-testid="dose-modal-skip"
              style={{ minHeight: 48 }}
            >
              Pular
            </Button>
            <Button
              kind="primary"
              onClick={handleConfirm}
              disabled={confirmMut.isPending}
              full
              data-testid="dose-modal-confirm"
              style={{ minHeight: 48 }}
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
            {displayObs && (
              <p style={{ margin: 0, color: 'var(--dosy-fg-secondary)' }}>
                Obs.: {displayObs}
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
