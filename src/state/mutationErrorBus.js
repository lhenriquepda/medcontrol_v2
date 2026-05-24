/**
 * mutationErrorBus.js — event bus pra propagar erros de mutation pra UI toast.
 *
 * v0.2.6.6 F5 (bug "perde comunicação com BD após idle"). Mesma pattern do conflictBus.
 *
 * Cenário:
 *   - mutationRegistry roda fora do tree React (defaults globais qc.setMutationDefaults).
 *   - ToastProvider só existe dentro do tree.
 *   - Quando mutation falha (rollback feito), user vê otimista reverter mas SEM toast.
 *     Bug crônico: SOS/treatment "salvo" silenciosamente reverte, user pensa "perdeu BD".
 *
 *   - mutationRegistry.onError emite via emitMutationError({mutation, error, code, label}).
 *   - MutationErrorListener (mount em App.jsx dentro do ToastProvider) escuta + mostra toast.
 *
 * Filtros (não emite pra):
 *   - 409 conflicts (cobertos pelo conflictBus já — toast diferenciado)
 *   - Mutations canceladas pelo TanStack (CancelledError)
 *   - Erros de rede já tratados como offline (network mode kicks in)
 */

const listeners = new Set()

export function subscribeMutationError(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export function emitMutationError(payload) {
  // payload: { mutation: 'confirmDose'|'createTreatment'|..., error, code, label }
  for (const h of listeners) {
    try { h(payload) } catch (e) {
      console.warn('[mutationErrorBus] listener fail:', e?.message)
    }
  }
}
