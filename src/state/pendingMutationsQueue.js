/**
 * pendingMutationsQueue.js — Refactor Sync v2 Fase 3 (v0.2.7.0)
 *
 * Queue persistida em IDB pra mutations healthcare-críticas. Sobrevive process
 * kill agressivo (Samsung One UI 7 / Android Doze observado em S25U).
 *
 * Fluxo (markDose):
 *   1. add({ requestId, doseId, action, payload }) — IDB write ANTES do RPC
 *   2. RPC tentativa: timeout 10s via authedRpc
 *      - sucesso → remove(requestId)
 *      - falha network/timeout → mantém, drain posterior
 *      - falha auth (AUTH_LOST) → mantém, drain após re-login
 *      - falha 409 conflict / erro real → remove (não retry forever)
 *   3. drainPendingMutations(): chamado em boot + resume + reconnect → FIFO
 *
 * Idempotência: RPCs v3 fazem lookup em mutation_log pelo request_id PK.
 * Mesmo se queue drena 2× a mesma entry (kill mid-RPC + boot retry), server
 * retorna result anterior. Cliente trata igual sucesso.
 */
import { get as idbGet, set as idbSet } from 'idb-keyval'

const QUEUE_KEY = 'dosy:pending-mutations'

/**
 * Read queue from IDB. Returns array (empty if absent).
 */
async function readQueue() {
  try {
    const items = await idbGet(QUEUE_KEY)
    return Array.isArray(items) ? items : []
  } catch (e) {
    console.warn('[pendingMutationsQueue] readQueue fail:', e?.message)
    return []
  }
}

async function writeQueue(items) {
  try {
    await idbSet(QUEUE_KEY, items)
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
