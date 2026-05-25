/**
 * pendingMutationsQueue.js — Worker Native v0.2.8.0
 *
 * Queue persistida em SharedPreferences (via @capacitor/preferences) pra mutations
 * healthcare-críticas. Sobrevive process kill agressivo (Samsung One UI 7 / Doze).
 *
 * MIGRAÇÃO v0.2.7.0 → v0.2.8.0:
 * - Antes: idb-keyval em IndexedDB (apenas WebView JS conseguia ler)
 * - Agora: @capacitor/preferences (SharedPreferences Android = MutationDrainWorker Java pode ler)
 * - Migração one-way no boot via main.jsx (sem fallback IDB — decisão user #5)
 * - Web fallback: @capacitor/preferences usa localStorage automaticamente
 *
 * KEY change: 'dosy:pending-mutations' (colons) → 'dosy_pending_mutations' (underscore)
 * - SharedPreferences keys são strings livres mas convenção Android = snake_case
 * - Java Worker lê com mesma string exata
 *
 * Fluxo (markDose):
 *   1. add({ requestId, doseId, action, payload }) — Preferences write ANTES do RPC
 *   2. RPC tentativa: timeout 10s via authedRpc
 *      - sucesso → remove(requestId)
 *      - falha network/timeout → mantém, drain posterior (JS ou Worker nativo)
 *      - falha auth (AUTH_LOST) → mantém, drain após re-login (JS) ou refresh Worker
 *      - falha 409 conflict / erro real → mantém + retryCount++ até 3× (decisão user #3)
 *   3. drainPendingMutations(): chamado em boot + resume + reconnect → FIFO
 *   4. MutationDrainWorker Java: drena a cada 15min independente de WebView
 *
 * Idempotência: RPCs v3 fazem lookup em mutation_log pelo request_id PK.
 * Mesmo se queue drena 2× a mesma entry (JS + Worker concorrentes, ou kill mid-RPC),
 * server retorna result anterior. Cliente trata igual sucesso.
 */
import { Preferences } from '@capacitor/preferences'

const QUEUE_KEY = 'dosy_pending_mutations'

/**
 * Read queue from Preferences. Returns array (empty if absent or malformed).
 */
async function readQueue() {
  try {
    const { value } = await Preferences.get({ key: QUEUE_KEY })
    if (!value) return []
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.warn('[pendingMutationsQueue] readQueue fail:', e?.message)
    return []
  }
}

async function writeQueue(items) {
  try {
    await Preferences.set({
      key: QUEUE_KEY,
      value: JSON.stringify(items),
    })
  } catch (e) {
    console.warn('[pendingMutationsQueue] writeQueue fail:', e?.message)
  }
}

/**
 * Adiciona mutation à queue. Mantém FIFO ordering.
 *
 * @param {object} entry
 * @param {string} entry.requestId — UUID v4 (cliente)
 * @param {string} entry.doseId
 * @param {string} entry.action   — 'confirm' | 'skip' | 'undo'
 * @param {object} entry.payload  — { actualTime?, observation? }
 */
export async function add(entry) {
  const items = await readQueue()
  items.push({
    ...entry,
    createdAt: entry.createdAt || Date.now(),
    retryCount: entry.retryCount || 0,
  })
  await writeQueue(items)
}

/**
 * Remove mutation por requestId. Idempotente (no-op se não existe).
 */
export async function remove(requestId) {
  const items = await readQueue()
  const next = items.filter(e => e.requestId !== requestId)
  if (next.length !== items.length) {
    await writeQueue(next)
  }
}

/**
 * Incrementa retryCount da entry e retorna o novo valor.
 * Usado pelo drain JS quando RPC falha com erro real (não-network, não-auth).
 * Decisão user #3: descartar só após 3× falha.
 *
 * @returns {Promise<number>} novo retryCount (0 se entry não existe)
 */
export async function incrementRetry(requestId) {
  const items = await readQueue()
  let newCount = 0
  let found = false
  const next = items.map(e => {
    if (e.requestId === requestId) {
      found = true
      newCount = (e.retryCount || 0) + 1
      return { ...e, retryCount: newCount }
    }
    return e
  })
  if (found) {
    await writeQueue(next)
  }
  return newCount
}

/**
 * Retorna snapshot da queue. Não modifica.
 */
export async function getAll() {
  return readQueue()
}

/**
 * Quantos itens pendentes (sem ler payloads).
 */
export async function size() {
  const items = await readQueue()
  return items.length
}

/**
 * Limpa queue inteira. Cuidado — só use em logout ou reset.
 */
export async function clear() {
  await writeQueue([])
}
