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
import { invalidateDoseQueries } from './queryClientRef'

const MUTATION_TIMEOUT_NORMAL_MS = 10_000
const MUTATION_TIMEOUT_COLD_MS = 30_000
const COLD_START_WINDOW_MS = 60_000

// v0.2.7.0 hardening — cold start (boot ou pós-Samsung-kill / idle longo) tem
// latência alta na primeira RPC (TLS handshake, WebView pre-warm, supabase-js init).
// Timeout dinâmico: 30s durante COLD_START_WINDOW (60s) após boot ou resume tardio.
// Sem isso, primeira marcação após idle longo SEMPRE caía em pendingSync.
let lastColdStartAt = Date.now()

export function markColdStart() {
  lastColdStartAt = Date.now()
}

function getMutationTimeoutMs() {
  return (Date.now() - lastColdStartAt < COLD_START_WINDOW_MS)
    ? MUTATION_TIMEOUT_COLD_MS
    : MUTATION_TIMEOUT_NORMAL_MS
}

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

  // BUG #0029 v0.2.8.3 belt-and-suspenders — agenda drain backup em 5s.
  // Mesmo se o RPC inline abaixo suceder (caso comum), drain encontra queue
  // vazia e exit cheap. Se RPC falhar silenciosamente (cenário capturado em QA
  // 2026-05-25 ~17:42, queue stuck retryCount=0), esse drain garante retry.
  setTimeout(() => { drainPendingMutations().catch(() => {}) }, 5000)

  // 4. RPC tentativa. v0.2.7.0 hardening: timeout dinâmico — 30s em cold-start
  // window (boot ou resume tardio), 10s em regime normal.
  try {
    const result = await authedRpc(rpcName, {
      p_request_id: requestId,
      p_dose_id: doseId,
      ...(action === 'confirm' ? { p_actual_time: optimisticPatch.actualTime } : {}),
      ...(payload.observation !== undefined ? { p_observation: payload.observation || '' } : {}),
    }, { timeoutMs: getMutationTimeoutMs() })

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
    // v0.2.7.0 hardening — invalida TanStack queries de doses pra DoseHistory/
    // Reports/Analytics/etc refletirem mudança imediato (não esperar poll 60s).
    invalidateDoseQueries()
    trackAction(action)
    return { ok: true, dose: finalDose }

  } catch (e) {
    if (e instanceof AuthLostError) {
      // Sessão perdida: useAppResume cuida signOut. Mantém queue pra drain pós-login.
      patchDose(doseId, { _pendingSync: true, _pendingReason: 'auth_lost' })
      // BUG #0029 v0.2.8.3 fix — schedule drain retry imediato. Antes só dependia de:
      //   (a) watchdog 30s (que pode estar bloqueado por currentDrainPromise zombie)
      //   (b) window 'online' event (não dispara se network nunca caiu)
      //   (c) useAppResume heartbeat (idle a maior parte do tempo).
      // Resultado: queue ficava 2+min stuck sem drain rodar (QA 2026-05-25 ~17:42).
      // Fix: dispara scheduleRetryDrain() do markDose.js que arma timer 5s→60s backoff.
      scheduleRetryDrain()
      return { ok: false, pendingSync: true, error: e }
    }
    if (isNetworkError(e)) {
      // Timeout / offline / fetch failed: mantém optimistic + queue pra drain.
      patchDose(doseId, { _pendingSync: true, _pendingReason: 'network' })
      // BUG #0029 v0.2.8.3 fix — ver comment AuthLostError acima.
      scheduleRetryDrain()
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

import { getAll as queueGetAll, remove as _queueRemove, size as queueSize, incrementRetry as queueIncrementRetry } from '../state/pendingMutationsQueue'

// v0.2.8.0 — decisão user #3: erro real (não-network, não-auth) tem 3× retry
// antes de descartar. Cobre bugs transitórios server (500 esporádico) que se
// resolveriam num retry. Antes era 1× descart imediato.
const REAL_ERROR_MAX_RETRIES = 3

let currentDrainPromise = null
let retryDrainTimer = null

// v0.2.7.0 hardening — retry persistente com backoff exponencial.
// Enquanto queue > 0 e há transient errors, agenda nova tentativa.
// Reset delay em sucesso. Para quando queue = 0 OU erro real (não-network).
//
// Storm prevention:
//   - Apenas 1 timer ativo (retryDrainTimer guard)
//   - Backoff 5s → 60s evita rajada em offline real
//   - Quando queue = 0, NÃO re-agenda → 0 RPC em idle
//   - Quando RPC sucede, delay reseta pra 5s pra próxima possível falha
const RETRY_DELAY_MIN_MS = 5_000
const RETRY_DELAY_MAX_MS = 60_000
let currentRetryDelayMs = RETRY_DELAY_MIN_MS

function scheduleRetryDrain() {
  if (retryDrainTimer) return  // já agendado, evita duplicado
  retryDrainTimer = setTimeout(async () => {
    retryDrainTimer = null
    let result = null
    try {
      result = await drainPendingMutations()
    } catch { /* ignore */ }

    // Verifica se ainda há fila — se sim, re-agenda. Se não, para.
    let remaining = 0
    try { remaining = await queueSize() } catch { /* ignore */ }

    if (remaining === 0) {
      currentRetryDelayMs = RETRY_DELAY_MIN_MS  // reseta pra próxima
      return  // queue vazia, para retry chain
    }

    // Ainda tem fila — backoff: se drenou algo, reseta; senão dobra.
    if (result?.drained > 0) {
      currentRetryDelayMs = RETRY_DELAY_MIN_MS  // sucesso parcial reseta
    } else {
      currentRetryDelayMs = Math.min(currentRetryDelayMs * 2, RETRY_DELAY_MAX_MS)
    }
    scheduleRetryDrain()  // re-agenda com novo delay
  }, currentRetryDelayMs)
}

// v0.2.7.0 hardening — Watchdog independente. A cada 30s, checa queue e força
// drain se > 0. Defesa em camadas — garante que mesmo se scheduleRetryDrain
// quebrar (bug, edge case, exception perdida), a fila eventualmente drena.
// Custo zero quando queue vazia. Bug capturado QA real 2026-05-25 00:00:
// queue ficou stuck 7+min sem drain rodar por causa do AuthLost break.
// v0.2.8.3 BUG #0029 — reduzido 30s → 10s. Em healthcare critical, 30s de
// dose stuck é eternidade — usuário marca, vê banner amarelo, app fica idle
// e nada acontece por meio minuto. 10s é compromise entre snappy recovery e
// custo idle (1 queueSize check a cada 10s é trivial).
const WATCHDOG_INTERVAL_MS = 10_000
if (typeof window !== 'undefined') {
  setInterval(async () => {
    let n = 0
    try { n = await queueSize() } catch { /* ignore */ }
    if (n > 0 && !currentDrainPromise && !retryDrainTimer) {
      // Há fila e nenhum drain agendado/em curso — força.
      drainPendingMutations().catch(() => {})
    }
  }, WATCHDOG_INTERVAL_MS)
}

// v0.2.7.0 hardening — Network reconnect listener: força drain imediato quando
// device sai de offline. Antes user precisava interagir pra disparar drain.
//
// BUG #0031 v0.2.8.3 — adicionado TanStack onlineManager.subscribe() em paralelo.
// window 'online' event dispara prematuramente em Capacitor Android (logcat 2026-05-10:
// 7ms antes do Capacitor confirmar connectivity). TanStack onlineManager.subscribe é
// a UI fonte mais confiável (atualizada via Capacitor.Network bridge em main.jsx).
// Camadas redundantes garantem que pelo menos UMA delas dispara drain pós-reconnect.
if (typeof window !== 'undefined') {
  const triggerDrain = (source) => {
    console.warn('[drain] trigger via', source)
    currentRetryDelayMs = RETRY_DELAY_MIN_MS
    if (retryDrainTimer) {
      clearTimeout(retryDrainTimer)
      retryDrainTimer = null
    }
    drainPendingMutations().then(() => {
      queueSize().then((n) => {
        if (n > 0) scheduleRetryDrain()
      }).catch(() => {})
    }).catch(() => {})
  }
  window.addEventListener('online', () => triggerDrain('window.online'))
  // TanStack onlineManager subscribe — mais confiável em Capacitor Android.
  // Lazy import pra evitar dep circular se markDose carregar antes do queryClient init.
  import('@tanstack/react-query').then(({ onlineManager }) => {
    onlineManager.subscribe((isOnline) => {
      if (isOnline) triggerDrain('tanstack.onlineManager')
    })
  }).catch(() => { /* fail-safe */ })
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
/**
 * @param {object} [options]
 * @param {number} [options.rpcTimeoutMs=10000] — timeout por RPC. Boot usa 30s
 *   pra cobrir cold-start latência (TLS handshake, WebView pre-warm). Resume/
 *   heartbeat usa default 10s.
 */
export async function drainPendingMutations(options = {}) {
  if (currentDrainPromise) return currentDrainPromise
  currentDrainPromise = _runDrain(options).finally(() => { currentDrainPromise = null })
  return currentDrainPromise
}

async function _runDrain(options = {}) {
  const rpcTimeoutMs = options.rpcTimeoutMs ?? getMutationTimeoutMs()
  let drained = 0
  let failedTransient = 0
  let failedReal = 0
  try {
    const pending = await queueGetAll()
    // BUG #0031 v0.2.8.3 — log detalhado pra capture pendentes stuck no boot.
    // Terser preserva console.warn (config v0.2.6.15). Permite reproduzir + debug
    // logcat real quando user reporta "carregando fila no boot mesmo online".
    console.warn('[drain] start — queue size:', pending.length, 'timeout:', rpcTimeoutMs, 'ms')
    if (pending.length === 0) return { drained: 0 }

    // BUG #0031 fix — drenagem PARALELA por doseId.
    // Antes era FIFO serial: 5 entries × 30s cold-start = 150s pra UI limpar banner.
    // Agora agrupa por doseId pra preservar ordem dentro de cada dose (Pular→Undo→Tomada),
    // mas drena groups diferentes em paralelo via Promise.allSettled.
    // Resultado: backlog de N doses únicas drena em ~30s (uma rodada paralela),
    // não 30s × N. Idempotência via mutation_log PK request_id garante safety.
    const byDose = new Map()
    for (const mut of pending) {
      const arr = byDose.get(mut.doseId) || []
      arr.push(mut)
      byDose.set(mut.doseId, arr)
    }
    console.warn('[drain] grouped into', byDose.size, 'unique doseIds')

    // Cada grupo processa serial internamente (mesma dose) mas grupos rodam paralelo.
    const groupResults = await Promise.allSettled(
      Array.from(byDose.values()).map(group => _drainDoseGroup(group, rpcTimeoutMs))
    )

    let anyTransientFailed = false
    for (const gr of groupResults) {
      if (gr.status === 'fulfilled') {
        drained += gr.value.drained
        failedTransient += gr.value.failedTransient
        failedReal += gr.value.failedReal
        if (gr.value.failedTransient > 0) anyTransientFailed = true
      } else {
        console.warn('[drain] group rejected:', gr.reason?.message)
        failedTransient += 1
        anyTransientFailed = true
      }
    }

    console.warn('[drain] done — drained:', drained, 'transient:', failedTransient, 'real:', failedReal)

    // Se qualquer transient falhou, agenda retry com backoff (5s → 60s).
    if (anyTransientFailed) {
      scheduleRetryDrain()
    }

    return { drained, failedTransient, failedReal }
  } catch (e) {
    console.warn('[drain] outer catch:', e?.message)
    return { drained, failedTransient: failedTransient + 1, failedReal }
  }
}

// BUG #0031 v0.2.8.3 — processa um grupo de mutations da mesma dose serial.
// Diferentes doses rodam paralelo (chamado N vezes via Promise.allSettled em _runDrain).
async function _drainDoseGroup(mutations, rpcTimeoutMs) {
  let drained = 0
  let failedTransient = 0
  let failedReal = 0
  for (const mut of mutations) {
    const rpcName = RPC_BY_ACTION[mut.action]
    if (!rpcName) {
      // Action inválida — remove pra não acumular lixo.
      console.warn('[drain] entry com action inválida, removendo:', mut.action, mut.requestId)
      await _queueRemove(mut.requestId)
      continue
    }
    try {
      const result = await authedRpc(rpcName, {
        p_request_id: mut.requestId,
        p_dose_id: mut.doseId,
        ...(mut.action === 'confirm' ? { p_actual_time: mut.payload?.actualTime || new Date().toISOString() } : {}),
        ...(mut.payload?.observation !== undefined ? { p_observation: mut.payload.observation || '' } : {}),
      }, { timeoutMs: rpcTimeoutMs })

      if (result?.ok === false) {
        if (result?.code === 409 && result?.current_state) {
          patchDose(mut.doseId, {
            ...result.current_state,
            _optimistic: false,
            _pendingSync: false,
            _conflict: { from: result.from, to: result.to, at: Date.now() },
          })
          emitConflict({
            mutation: mut.action,
            doseId: mut.doseId,
            currentState: result.current_state,
            from: result.from,
            to: result.to,
          })
        } else {
          revertDose(mut.doseId)
          const e = new Error(result?.error || 'rpc_error')
          e.code = result?.code
          emitMutationError({ mutation: rpcName, error: e, code: result?.code })
        }
      } else {
        patchDose(mut.doseId, {
          ...(result?.dose || result),
          _optimistic: false,
          _pendingSync: false,
          _confirmedAt: Date.now(),
        })
      }
      await _queueRemove(mut.requestId)
      invalidateDoseQueries()
      drained += 1
    } catch (e) {
      if (e instanceof AuthLostError) {
        console.warn('[drain] AuthLost em', mut.doseId, '— scheduleRetryDrain')
        failedTransient += 1
        // BUG #0031 — não break do loop, mas SKIP demais entries desse grupo
        // (auth global afetaria todas igual). scheduleRetryDrain global na _runDrain.
        return { drained, failedTransient, failedReal, abortReason: 'auth' }
      }
      if (isNetworkError(e)) {
        console.warn('[drain] Network/Timeout em', mut.doseId, '— skip rest of group, scheduleRetryDrain')
        failedTransient += 1
        return { drained, failedTransient, failedReal, abortReason: 'network' }
      }
      // Erro real (não-network, não-auth). Retry 3× antes de descartar.
      const newRetry = await queueIncrementRetry(mut.requestId)
      console.warn('[drain] real error em', mut.doseId, 'code:', e?.code, 'retry:', newRetry)
      if (newRetry >= REAL_ERROR_MAX_RETRIES) {
        await _queueRemove(mut.requestId)
        failedReal += 1
        captureCaught(e, {
          source: 'drainPendingMutations',
          level: 'warning',
          extra: { mut, retryCount: newRetry },
        })
      } else {
        failedTransient += 1
        captureCaught(e, {
          source: 'drainPendingMutations.retry',
          level: 'info',
          extra: { mut, retryCount: newRetry, maxRetries: REAL_ERROR_MAX_RETRIES },
        })
      }
    }
  }
  return { drained, failedTransient, failedReal }
}
