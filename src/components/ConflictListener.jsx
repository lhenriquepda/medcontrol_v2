// v0.2.6.1 P1.6 (Roteiro_Alinhamento_Dosy_v2) — listener pra conflict bus.
//
// Quando mutationRegistry detecta 409 em confirm/skip/undo Dose, emite payload
// via conflictBus. Este componente escuta + mostra toast "Aceitar mudança em
// outro dispositivo?" com botão action que patcha cache com current_state.
//
// Mount em App.jsx dentro do ToastProvider (precisa do hook).

import { useEffect, useRef } from 'react'
import { useToast } from '../hooks/useToast'
import { subscribeConflict } from '../state/conflictBus'

const STATUS_LABEL = {
  pending: 'pendente',
  overdue: 'atrasada',
  done: 'tomada',
  skipped: 'pulada',
  cancelled: 'cancelada',
}

function summarizeConflict(payload) {
  const { mutation, currentState, from, to } = payload
  const remoteStatus = currentState?.status
  const remoteLabel = STATUS_LABEL[remoteStatus] || remoteStatus || 'alterada'
  if (mutation === 'confirmDose') {
    return `Outro dispositivo já marcou esta dose como ${remoteLabel}. Aceitar?`
  }
  if (mutation === 'skipDose') {
    return `Outro dispositivo já marcou esta dose como ${remoteLabel}. Aceitar?`
  }
  if (mutation === 'undoDose') {
    return `Esta dose voltou a ficar ${remoteLabel} em outro dispositivo. Aceitar?`
  }
  return `Esta dose foi alterada em outro dispositivo (${from || '?'} → ${to || '?'} bloqueado). Aceitar versão atualizada?`
}

export default function ConflictListener() {
  const toast = useToast()
  // Evita listener duplicado em StrictMode dev (mount/unmount/mount)
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (subscribedRef.current) return
    subscribedRef.current = true
    const off = subscribeConflict((payload) => {
      const message = summarizeConflict(payload)
      toast?.show({
        kind: 'warn',
        message,
        undoLabel: 'Aceitar',
        duration: 10_000,
        onUndo: () => {
          try { payload.onAccept?.() } catch (e) {
            console.warn('[ConflictListener] onAccept failed:', e?.message)
          }
        },
      })
      // onReject implícito: quando toast some sem clicar, chama onReject pra refetch.
      // Como useToast atual não tem onDismiss callback, fazemos refetch via timer
      // — payload.onReject é best-effort e pode ser invocado pelo onSettled
      // (refetchDoses já roda 1.5s pós onError).
    })
    return () => {
      off?.()
      subscribedRef.current = false
    }
  }, [toast])

  return null
}
