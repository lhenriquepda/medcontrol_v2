/**
 * withTimeout — envolve Promise com timeout via Promise.race.
 *
 * BUG #0025 (v0.2.8.3 QA cross-account 2026-05-25):
 *   Mutations TanStack que chamam `supabase.from(...).insert/update/delete()` direto
 *   ficavam stuck em isPending=true quando RPC não respondia em tempo razoável.
 *   Botão "Cadastrar paciente" (e similares) ficava permanentemente disabled →
 *   user precisava reload page pra resetar state.
 *
 *   Root cause: supabase-js fetch underlying não tem timeout default. Se network
 *   pendura (emul cold-start, Doze deep, rede ruim), promise nunca resolve nem
 *   rejeita → useMutation onError nunca chamado → isPending nunca volta false.
 *
 * Fix: envolver mutationFn em Promise.race com timeout. Se exceder, reject com
 * MutationTimeoutError. TanStack então chama onError → isPending=false →
 * UI libera botão + emitMutationError mostra toast.
 *
 * Pattern já validado em src/services/sessionManager.js authedRpc (Refactor Sync v2).
 *
 * Default 20s: cold-start emul pode levar até 15s legítimos; rede real <2s.
 * Pra mutations crítica healthcare (markDose) usar timeout dinâmico via
 * `services/markDose.js` (não substituir aqui).
 */

export class MutationTimeoutError extends Error {
  constructor(opName, ms) {
    super(`Operação ${opName} excedeu ${ms}ms — verifique sua conexão.`)
    this.name = 'MutationTimeoutError'
    this.code = 'TIMEOUT'
    this.opName = opName
    this.timeoutMs = ms
  }
}

/**
 * Race entre promise e timeout.
 *
 * @param {Promise<T>} promise — promise a ser observada
 * @param {number} ms — timeout em milissegundos (default 20000)
 * @param {string} opName — nome operação pra mensagem erro/telemetria
 * @returns {Promise<T>} — mesma resolução de `promise` OU rejeita com MutationTimeoutError
 */
export function withTimeout(promise, ms = 20000, opName = 'operação') {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new MutationTimeoutError(opName, ms)), ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}
