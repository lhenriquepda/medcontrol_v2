/**
 * conflictBus.js — event bus pra propagar 409 conflicts de RPC pra UI toast.
 *
 * v0.2.6.1 P1.6 (Roteiro_Alinhamento_Dosy_v2).
 *
 * Cenário:
 *   - User marca dose "tomada" no device A.
 *   - Cuidador (device B) já tinha marcado a mesma dose.
 *   - RPC confirm_dose_v2 retorna 409 + current_state com status='done'.
 *   - dosesService.confirmDose lança DoseConflictError.
 *   - mutationRegistry.onError detecta error.code === 409 + emit conflictBus.
 *   - ConflictListener (mount em App.jsx) escuta event + mostra toast
 *     "Essa dose foi atualizada em outro dispositivo. Aceitar?" com action.
 *   - onAccept: cliente patcha cache com current_state retornado.
 *   - onDismiss: rollback (mutationRegistry já fez via snapshots).
 *
 * Por que event bus em vez de toast direto:
 *   mutationRegistry roda fora do ciclo React (defaults globais qc).
 *   ToastProvider só existe dentro do tree. Bus desacopla.
 */

const listeners = new Set()

export function subscribeConflict(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export function emitConflict(payload) {
  // payload: { mutation: 'confirmDose'|'skipDose'|'undoDose', doseId, currentState, from, to }
  for (const h of listeners) {
    try { h(payload) } catch (e) {
      // Listener errado não pode derrubar mutation
      console.warn('[conflictBus] listener fail:', e?.message)
    }
  }
}
