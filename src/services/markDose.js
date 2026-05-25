/**
 * markDose.js — Refactor Sync v2 Fase 3 (v0.2.7.0)
 *
 * Função central de marcação de doses (healthcare-crítico). Substitui o stack
 * TanStack `useMutation({mutationKey})` + `mutationRegistry.setMutationDefaults`
 * + `realtimeGate` + `versionedCache` + `flushPersistImmediate` por um pipeline
 * simples e auditável.
 *
 * Princípios (Refactor_Sync_v2.md §2):
 *   P2 — healthcare: confirmação visual = persistência garantida (UI mostra
 *        ⏳ pending até server OK ou ⚠️ fila se offline/timeout).
 *   P5 — UI nunca trava: authedRpc (Fase 1) timeout 10s hard.
 *   P7 — idempotência via request_id PK em mutation_log (RPCs v3).
 *
 * Fluxo (§5.4 do doc):
 *
 *   1. Optimistic patch em doseStore (UI mostra novo status com _optimistic flag)
 *   2. Persist em pendingMutationsQueue (IDB) ANTES do RPC — sobrevive kill
 *   3. authedRpc('confirm_dose_v3', ...) com timeout 10s
 *      ┌──────────────────┬──────────────────────────────────────┐
 *      │ sucesso          │ patch confirma (sem _optimistic),     │
 *      │                  │ remove da queue                       │
 *      ├──────────────────┼──────────────────────────────────────┤
 *      │ TimeoutError /   │ deixa optimistic + _pendingSync flag, │
 *      │ NetworkError     │ queue mantida pra drain posterior     │
 *      ├──────────────────┼──────────────────────────────────────┤
 *      │ AuthLostError    │ idem timeout (drain após re-login)    │
 *      ├──────────────────┼──────────────────────────────────────┤
 *      │ 409 Conflict     │ aceita server state, remove queue,    │
 *      │                  │ emit conflict pra UI prompt           │
 *      ├──────────────────┼──────────────────────────────────────┤
 *      │ erro real        │ revert optimistic, remove queue,      │
 *      │ (validação/500)  │ toast.error + Sentry                  │
 *      └──────────────────┴──────────────────────────────────────┘
 */
import { uuid } from '../utils/uuid'
import { authedRpc, AuthLostError, TimeoutError } from './sessionManager'
import { patchDose, revertDose, getDose } from '../state/doseStore'
import { add as queueAdd, remove as queueRemove } from '../state/pendingMutationsQueue'
import { captureCaught } from './sentry'
import { emitConflict } from '../state/conflictBus'
import { emitMutationError } from '../state/mutationErrorBus'
import { track, EVENTS } from './analytics'

const MUTATION_TIMEOUT_MS = 10_000

const RPC_BY_ACTION = {
  confirm: 'confirm_dose_v3',
  skip:    'skip_dose_v3',
  undo:    'undo_dose_v3',
}

const STATUS_BY_ACTION = {
  confirm: 'done',
  skip:    'skipped',
  undo:    'pending',
}

// v0.2.7.0 hardening — undo retorna dose pra 'pending' no server. Se a dose
// já passou da hora (scheduledAt < now), client recompute pra 'overdue' senão
// fica como "pendente" no Dashboard mesmo já atrasada (UI inconsistente
// reportada em QA real 2026-05-24 22:54).
// Espelha a lógica de recomputeOverdueDoses (services/dashboardService.js).
function applyOverdueRule(dose) {
  if (!dose || dose.status !== 'pending') return dose
  try {
    if (new Date(dose.scheduledAt) < new Date()) {
      return { ...dose, status: 'overdue' }
    }
  } catch { /* fail-safe */ }
  return dose
}

// Erro de rede (genérico — DOMException, TypeError de fetch abortado etc).
function isNetworkError(e) {
  if (!e) return false
  if (e instanceof TimeoutError) return true
  if (/network|fetch|failed to fetch|abort/i.test(e.message || '')) return true
  if (e.name === 'TypeError' && /fetch/i.test(e.message || '')) return true
  return false
}

/**
 * Marca dose (confirm/skip/undo) com semântica healthcare-grade.
 *
 * @param {object} args
 * @param {string} args.doseId
 * @param {'confirm'|'skip'|'undo'} args.action
 * @param {object} [args.payload]
 * @param {string} [args.payload.actualTime] — ISO timestamp (confirm)
 * @param {string} [args.payload.observation]
 * @returns {Promise<{ok: boolean, dose?: object, pendingSync?: boolean, error?: any}>}
 */
export async function markDose({ doseId, action, payload = {} }) {
  if (!doseId || !['confirm', 'skip', 'undo'].includes(action)) {
    throw new Error(`markDose: invalid args { doseId, action }`)
  }

  const requestId = uuid()
  const optimisticStatus = STATUS_BY_ACTION[action]
  const rpcName = RPC_BY_ACTION[action]

  // 1. Snapshot pré-patch (pra revert em caso de erro real).
  const before = getDose(doseId)
  if (!before) {
    // Dose não existe no store — caller passou ID inválido. Não há otimismo possível.
    return { ok: false, error: new Error('dose_not_in_store') }
  }

  // 2. Optimistic patch local. doseStore guarda snapshot interno automaticamente
  // quando _optimistic:true (pra revertDose funcionar).
  const optimisticPatch = {
    status: optimisticStatus,
    _optimistic: true,
    _requestId: requestId,
    _localActedAt: Date.now(),
  }
  if (action === 'confirm') {
    optimisticPatch.actualTime = payload.actualTime || new Date().toISOString()
  } else if (action === 'undo') {
    optimisticPatch.actualTime = null
    // v0.2.7.0 hardening — undo retorna 'pending' mas se já passou da hora,
    // virar 'overdue' direto pra UI consistente.
    const merged = applyOverdueRule({ ...before, ...optimisticPatch })
    optimisticPatch.status = merged.status
  }
  patchDose(doseId, optimisticPatch)

  // 3. Persist queue ANTES do RPC — sobrevive process kill mid-RPC.
  const queueEntry = { requestId, doseId, action, payload }
  try {
    await queueAdd(queueEntry)
  } catch (e) {
    // Falha persist é não-crítica (RPC ainda pode ter sucesso) mas log.
    console.warn('[markDose] queue.add fail:', e?.message)
  }

  // 4. RPC tentativa.
  try {
    const result = await authedRpc(rpcName, {
      p_request_id: requestId,
      p_dose_id: doseId,
      ...(action === 'confirm' ? { p_actual_time: optimisticPatch.actualTime } : {}),
      ...(payload.observation !== undefined ? { p_observation: payload.observation || '' } : {}),
    }, { timeoutMs: MUTATION_TIMEOUT_MS })

    // RPC v3 retorna JSONB { ok, dose } | { ok:false, error, code, current_state }
    if (result?.ok === false) {
      return handleRpcLogicalError({ result, doseId, requestId, action, before })
    }

    // Sucesso real
    const serverDose = result?.dose || result
    // v0.2.7.0 hardening — recompute overdue (server retorna 'pending' mas se
    // já passou da hora, UI deve mostrar 'overdue'). Aplica pra todos os actions
    // mas só tem efeito quando status final é 'pending' (undo, ou edge cases).
    const finalDose = applyOverdueRule(serverDose)
    patchDose(doseId, {
      ...finalDose,
      _optimistic: false,
      _pendingSync: false,
      _confirmedAt: Date.now(),
    })
    await queueRemove(requestId)
    trackAction(action)
    return { ok: true, dose: finalDose }

  } catch (e) {
    if (e instanceof AuthLostError) {
      // Sessão perdida: useAppResume cuida signOut. Mantém queue pra drain pós-login.
      patchDose(doseId, { _pendingSync: true, _pendingReason: 'auth_lost' })
      return { ok: false, pendingSync: true, error: e }
    }
    if (isNetworkError(e)) {
      // Timeout / offline / fetch failed: mantém optimistic + queue pra drain.
      patchDose(doseId, { _pendingSync: true, _pendingReason: 'network' })
      return { ok: false, pendingSync: true, error: e }
    }
    // Erro real (não tratado pelo RPC v3 — server bug, network corruption etc).
    // Revert + remove da queue (não retry).
    revertDose(doseId)
    await queueRemove(requestId)
    emitMutationError({ mutation: rpcName, error: e, code: e?.code })
    captureCaught(e, {
      source: `markDose.${action}`,
      level: 'error',
      tags: { action, error_code: String(e?.code || 'unknown') },
      extra: { doseId, requestId },
    })
    return { ok: false, error: e }
  }
}

function handleRpcLogicalError({ result, doseId, requestId, action, before: _before }) {
  const code = result?.code
  const errorMsg = result?.error

  if (code === 409 && result?.current_state) {
    // Conflict: outro dispositivo já modificou. Aceita server state, emit conflict pra UI.
    const serverDose = result.current_state
    patchDose(doseId, {
      ...serverDose,
      _optimistic: false,
      _pendingSync: false,
      _conflict: { from: result.from, to: result.to, at: Date.now() },
    })
    queueRemove(requestId).catch(() => { /* fail-safe */ })
    try {
      track(EVENTS.SYNC_CONFLICT_DETECTED, { mutation: action, from: result.from, to: result.to })
    } catch { /* analytics fail-safe */ }
    emitConflict({
      mutation: action,
      doseId,
      currentState: serverDose,
      from: result.from,
      to: result.to,
    })
    return { ok: false, conflict: true, currentState: serverDose }
  }

  if (code === 401 || code === 403) {
    // Auth/permission negada — não retry. Revert + emit.
    revertDose(doseId)
    queueRemove(requestId).catch(() => {})
    const e = new Error(errorMsg || 'unauthorized')
    e.code = code
    emitMutationError({ mutation: RPC_BY_ACTION[action], error: e, code })
    return { ok: false, error: e }
  }

  if (code === 404) {
    // Dose deletada server-side. Revert local + remove queue.
    revertDose(doseId)
    queueRemove(requestId).catch(() => {})
    const e = new Error('dose_not_found')
    e.code = 404
    emitMutationError({ mutation: RPC_BY_ACTION[action], error: e, code: 404 })
    return { ok: false, error: e }
  }

  // Erro lógico não-mapeado. Revert.
  revertDose(doseId)
  queueRemove(requestId).catch(() => {})
  const e = new Error(errorMsg || 'rpc_error')
  e.code = code
  emitMutationError({ mutation: RPC_BY_ACTION[action], error: e, code })
  captureCaught(e, {
    source: `markDose.${action}.rpc_logical`,
    level: 'error',
    tags: { action, error_code: String(code) },
    extra: { doseId, requestId, raw: result },
  })
  return { ok: false, error: e }
}

function trackAction(action) {
  try {
    if (action === 'confirm') track(EVENTS.DOSE_CONFIRMED)
    else if (action === 'skip') track(EVENTS.DOSE_SKIPPED)
    else if (action === 'undo') track(EVENTS.DOSE_UNDONE)
  } catch { /* analytics fail-safe */ }
}

// ─── Drain queue ───────────────────────────────────────────────────────────
// Chamado em boot, resume, network reconnect.
// Re-executa mutations pendentes via authedRpc. Idempotência server-side
// (mutation_log) garante exactly-once mesmo se entry foi parcialmente processada
// em runtime anterior.

import { getAll as queueGetAll, remove as _queueRemove, size as queueSize } from '../state/pendingMutationsQueue'

let currentDrainPromise = null
let retryDrainTimer = null

// v0.2.7.0 hardening — re-agenda drain rápido em transient errors (rede flapping,
// auth refresh). Sem este retry, mutations ficavam stuck esperando heartbeat 60s
// (useAppResume), causando UI mostrar server stale por 1min após reconnect.
const RETRY_DRAIN_DELAY_MS = 5_000
function scheduleRetryDrain() {
  if (retryDrainTimer) return
  retryDrainTimer = setTimeout(() => {
    retryDrainTimer = null
    drainPendingMutations().catch(() => {})
  }, RETRY_DRAIN_DELAY_MS)
}

// Exporta pra Dashboard usar como indicador visual ("N doses sincronizando").
export async function getPendingQueueSize() {
  try { return await queueSize() } catch { return 0 }
}

// v0.2.7.0 hardening — callers concorrentes await a MESMA promise em vez de
// pular (que fazia fetchDashboard prosseguir com server stale). Bug capturado
// QA real 2026-05-24 23:00: boot tinha drain (main.jsx fire-and-forget) +
// fetchDashboard (Dashboard mount) em paralelo. fetchDashboard pulava drain
// (mutex), pegava server payload ANTES da mutation drenar → setAllDoses
// sobrescrevia patchDose feita pelo drain → UI mostrava status antigo.
export async function drainPendingMutations() {
  if (currentDrainPromise) return currentDrainPromise
  currentDrainPromise = _runDrain().finally(() => { currentDrainPromise = null })
  return currentDrainPromise
}

async function _runDrain() {
  let drained = 0
  let failedTransient = 0
  let failedReal = 0
  try {
    const pending = await queueGetAll()
    if (pending.length === 0) return { drained: 0 }

    // FIFO serial (evita conflitar entre si — mutations consecutivas mesma dose).
    for (const mut of pending) {
      const rpcName = RPC_BY_ACTION[mut.action]
      if (!rpcName) {
        // Action inválida — remove pra não acumular lixo.
        await _queueRemove(mut.requestId)
        continue
      }
      try {
        const result = await authedRpc(rpcName, {
          p_request_id: mut.requestId,
          p_dose_id: mut.doseId,
          ...(mut.action === 'confirm' ? { p_actual_time: mut.payload?.actualTime || new Date().toISOString() } : {}),
          ...(mut.payload?.observation !== undefined ? { p_observation: mut.payload.observation || '' } : {}),
        }, { timeoutMs: MUTATION_TIMEOUT_MS })

        if (result?.ok === false && result?.code === 409 && result?.current_state) {
          patchDose(mut.doseId, {
            ...result.current_state,
            _optimistic: false,
            _pendingSync: false,
            _conflict: { from: result.from, to: result.to, at: Date.now() },
          })
        } else if (result?.ok === true) {
          patchDose(mut.doseId, {
            ...(result.dose || result),
            _optimistic: false,
            _pendingSync: false,
            _confirmedAt: Date.now(),
          })
        }
        await _queueRemove(mut.requestId)
        drained += 1
      } catch (e) {
        if (e instanceof AuthLostError) {
          // Auth perdido — sem ponto retry até user re-logar. useAppResume
          // signOut chega via onAuthLost listener. Para drain neste ciclo.
          failedTransient += 1
          break
        }
        if (isNetworkError(e)) {
          // Network transient — para drain neste ciclo MAS re-agenda retry em 5s.
          // Sem este retry, mutations ficavam stuck até heartbeat 60s, fazendo UI
          // mostrar server stale por 1min após reconectar (QA real 2026-05-24).
          failedTransient += 1
          scheduleRetryDrain()
          break
        }
        // Erro real — descarta mutation pra não retry forever.
        await _queueRemove(mut.requestId)
        failedReal += 1
        captureCaught(e, {
          source: 'drainPendingMutations',
          level: 'warning',
          extra: { mut },
        })
      }
    }
  } catch (e) {
    // Erro de ler queue / outro fail. Log mas não propaga.
    console.warn('[drainPendingMutations] outer catch:', e?.message)
  }
  return { drained, failedTransient, failedReal }
}
