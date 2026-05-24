/**
 * mutationRegistry.js — central setMutationDefaults por chave.
 *
 * Item #204 (release v0.2.1.7) — Mutation queue offline (Fase 1 offline-first).
 *
 * Por que existe:
 *   TanStack Query offline mutations só conseguem retomar (resumePausedMutations)
 *   se a mutationFn estiver registrada nos defaults da queryClient ANTES da
 *   hydrate do cache persistido. Hooks individuais (useConfirmDose etc) viviam
 *   dentro de componentes React, então a mutationFn não estava disponível
 *   quando PersistQueryClientProvider chamava resume.
 *
 *   Solução: registrar todas mutations críticas aqui via mutationKey, e os hooks
 *   passam a apenas referenciar a chave (`useMutation({ mutationKey: ['confirmDose'] })`).
 *   Defaults aplicam mutationFn + callbacks (onMutate/onError/onSuccess/onSettled).
 *
 * Cobertura (mutations críticas healthcare):
 *   ['confirmDose'], ['skipDose'], ['undoDose']             — doses state machine
 *   ['registerSos']                                         — dose SOS extra
 *   ['createPatient'|'updatePatient'|'deletePatient']       — CRUD paciente
 *   ['createTreatment'|'updateTreatment'|'deleteTreatment'] — CRUD tratamento
 *   ['pauseTreatment'|'resumeTreatment'|'endTreatment']     — lifecycle
 *
 * Mutations NÃO cobertas (intencional):
 *   - useUserPrefs.update    — não-crítico (escreve localStorage instant + DB best-effort)
 *   - usePushSubscription    — fallback FCM cron já cobre
 *   - sos_rules upsert       — settings de regra, não-crítico
 */
import { dehydrate } from '@tanstack/react-query'
import { confirmDose, skipDose, undoDose, registerSos } from './dosesService'
import { createPatient, updatePatient, deletePatient } from './patientsService'
import {
  createTreatmentWithDoses, updateTreatment, deleteTreatment,
  pauseTreatment, resumeTreatment, endTreatment
} from './treatmentsService'
import { track, EVENTS } from './analytics'
import { incrementReviewSignal } from '../hooks/useInAppReview'
import { uuid } from '../utils/uuid'
import { generateDoses } from '../utils/generateDoses'
// Refactor Fase 1 — gate Realtime, versioned cache.
// Mutations healthcare-críticas marcam queryKey como in-flight no onMutate
// e limpam no onSettled; Realtime checa o gate antes de invalidar (impede
// "status volta do nada" causado por race entre debounce Realtime e refetch).
// versionedCache helpers são usados in-line (stamp _localActedAt em patchDoseInCache).
import { markInFlight, clearInFlight } from '../state/realtimeGate'
// v0.2.6.1 P1.6 — bus de conflict 409 (toast "Aceitar mudança outro dispositivo?")
import { emitConflict } from '../state/conflictBus'
// v0.2.6.6 F5 — toast UI quando mutation falha (cura bug "silent fail" pós-idle).
import { emitMutationError } from '../state/mutationErrorBus'
// v0.2.6.1 P1.10 — Sentry.captureException nos catches healthcare críticos
import { captureCaught } from './sentry'

// Refactor Fase 1: queryKeys que mutations healthcare protegem do Realtime.
// Marcadas in-flight em onMutate, limpas em onSettled.
const DOSE_PROTECTED_KEYS = [
  ['dashboard-payload'],
  ['doses'],
]
// v0.2.6.10 FIX B102 H1 — TTL explícito 10s (default era 2500ms via realtimeGate).
// Mutation lifecycle real: onMutate (10ms) → RPC (200-2000ms) → onSuccess (10ms)
// → refetchDoses debounce 1500ms → RPC refetch (200-2000ms) → setQueryData.
// Total 5-7s. TTL 2500ms expirava ANTES do refetch terminar → Realtime/refetch
// payload passava no gate → cache otimista sobrescrito → dose voltava pending.
// 10s cobre toda janela com folga. Cleared explicitamente em onSettled.
const GATE_TTL_MS = 10_000
function markDosesInFlight() {
  for (const key of DOSE_PROTECTED_KEYS) markInFlight(key, GATE_TTL_MS)
}
function clearDosesInFlight() {
  for (const key of DOSE_PROTECTED_KEYS) clearInFlight(key)
}

// Item #204 v0.2.1.8 fix-A — temp ID prefix pra entidades criadas optimistic offline.
// Quando mutation drena após reconnect, onSuccess substitui temp por real do server.
// Helper UI pode detectar entidade offline via id.startsWith('temp-') (e.g. badge "salvando").
const TEMP_ID_PREFIX = 'temp-'
const makeTempId = () => `${TEMP_ID_PREFIX}${uuid()}`

// Item #204 v0.2.1.8 fix-A — singleton qc reference pra mutationFn translate temp IDs
// (createTreatment offline cita patientId temp; drain pós-reconnect precisa lookup
// real ID via cache patients onde createPatient onSuccess marcou _tempIdSource).
// Sem isso, FK violation server-side → mutation status=error → descarta.
let _qcRef = null
// v0.2.3.12 NB-4 — persister ref pra flushPersistImmediate em mutations críticas.
let _persisterRef = null

// v0.2.3.12 NB-4 — força persist IDB imediato pra mutations críticas (healthcare).
// Bypass do throttle 1000ms. Reduz janela force-kill 1000ms → ~100ms (IDB write).
// Buster 'v1' DEVE bater com PersistQueryClientProvider (main.jsx:226).
// `shouldDehydrateMutation: () => true` mesmo do provider — persist mutations
// pausadas (offline) + mutation pendente atual em flight.
async function flushPersistImmediate() {
  if (!_persisterRef || !_qcRef) return
  try {
    await _persisterRef.persistClient({
      buster: 'v2', // v0.2.6.3 #0015 bumped → DEVE bater com main.jsx PersistQueryClientProvider
      timestamp: Date.now(),
      clientState: dehydrate(_qcRef, {
        shouldDehydrateMutation: () => true,
      })
    })
  } catch (e) {
    // Log mas não bloqueia mutation. Pior caso: persist falha + force-kill rápido =
    // perda. Best-effort. TanStack throttle 1s ainda cobre como backup ~1s depois.
    console.warn('[mutationRegistry] flushPersistImmediate fail:', e?.message)
    // v0.2.6.1 P1.10 — escalar pra Sentry (era silencioso). Hot path healthcare crítico.
    captureCaught(e, { source: 'mutationRegistry.flushPersistImmediate', level: 'warning' })
  }
}

// ─── helpers cache patch ───────────────────────────────────────────
// v0.2.3.9 P4 — dual namespace eliminado. Dashboard agora lê APENAS
// `['dashboard-payload', *].doses` (RPC consolidado é a única fonte).
// useDashboardPayload (P4 part 2) deixou de escrever em `['doses', *]`,
// logo só `['dashboard-payload']` precisa ser patchado aqui. Outras telas
// (DoseHistory, Reports) que usam useDoses(filter) refetcham on-mount.
function patchDoseInCache(qc, id, patch) {
  // Refactor Fase 1 — stampa _localActedAt em cada dose patchada. Realtime/refetch
  // dentro de LATENCY_BUDGET_MS (2500ms) que tentem sobrescrever esse status são
  // ignorados (versionedCache.shouldAccept), mesmo se gate falhar.
  const stampedPatch = { ...patch, _localActedAt: Date.now() }
  const dpQueries = qc.getQueryCache().findAll({ queryKey: ['dashboard-payload'] })
  const snapshots = []
  for (const q of dpQueries) {
    const data = q.state.data
    if (!data || !Array.isArray(data.doses)) continue
    snapshots.push([q.queryKey, data])
    qc.setQueryData(q.queryKey, {
      ...data,
      doses: data.doses.map((d) => (d.id === id ? { ...d, ...stampedPatch } : d))
    })
  }
  // Também patcha `['doses', *]` se houver (DoseHistory aberto, etc) —
  // findAll retorna [] se nenhum consumidor ativo, custo zero.
  const queries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
  for (const q of queries) {
    const data = q.state.data
    if (!Array.isArray(data)) continue
    snapshots.push([q.queryKey, data])
    qc.setQueryData(
      q.queryKey,
      data.map((d) => (d.id === id ? { ...d, ...stampedPatch } : d))
    )
  }
  return snapshots
}

// Item #204 v0.2.1.8 fix — patch genérico em TODAS variações de queryKey
// `[entity, *]` (lista filtrada por patientId/filter etc). Antes:
// `setQueryData(['treatments'], ...)` só afetava chave exata sem filter array
// → UI lendo `useTreatments({patientId})` não via update → status pausado não
// refletia visualmente offline. Agora varre cache, patch cada list array.
function patchEntityListsInCache(qc, entity, id, patch) {
  const queries = qc.getQueryCache().findAll({ queryKey: [entity] })
  const snapshots = []
  for (const q of queries) {
    const data = q.state.data
    if (!Array.isArray(data)) continue
    snapshots.push([q.queryKey, data])
    qc.setQueryData(
      q.queryKey,
      data.map((item) => (item?.id === id ? { ...item, ...patch } : item))
    )
  }
  return snapshots
}

// Insert temp entity em TODAS variações de queryKey `[entity, *]` lista.
function insertEntityIntoLists(qc, entity, item, filterMatchFn) {
  const queries = qc.getQueryCache().findAll({ queryKey: [entity] })
  const snapshots = []
  for (const q of queries) {
    const data = q.state.data
    if (!Array.isArray(data)) continue
    snapshots.push([q.queryKey, data])
    // Aplica filter da queryKey se função fornecida + match retornar true
    const filterArg = q.queryKey[1] || {}
    if (!filterMatchFn || filterMatchFn(item, filterArg)) {
      qc.setQueryData(q.queryKey, [item, ...data])
    }
  }
  return snapshots
}

// Remove items por predicado em TODAS variações queryKey `[entity, *]`.
function removeFromEntityLists(qc, entity, predicateFn) {
  const queries = qc.getQueryCache().findAll({ queryKey: [entity] })
  for (const q of queries) {
    const data = q.state.data
    if (!Array.isArray(data)) continue
    qc.setQueryData(q.queryKey, data.filter((item) => !predicateFn(item)))
  }
}

function rollback(qc, snapshots) {
  for (const [key, data] of (snapshots ?? [])) qc.setQueryData(key, data)
}

// v0.2.6.1 P1.6 — patch cache com current_state retornado pelo RPC 409.
// Chamado quando user clica "Aceitar" no toast de conflito.
function patchDoseFromServerState(qc, doseId, currentState) {
  if (!currentState || !doseId) return
  const stamped = { ...currentState, _serverConfirmedAt: Date.now() }
  // dashboard-payload
  const dpQueries = qc.getQueryCache().findAll({ queryKey: ['dashboard-payload'] })
  for (const q of dpQueries) {
    const data = q.state.data
    if (!data || !Array.isArray(data.doses)) continue
    qc.setQueryData(q.queryKey, {
      ...data,
      doses: data.doses.map((d) => (d.id === doseId ? { ...d, ...stamped } : d)),
    })
  }
  // ['doses', *]
  const doseQueries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
  for (const q of doseQueries) {
    const data = q.state.data
    if (!Array.isArray(data)) continue
    qc.setQueryData(
      q.queryKey,
      data.map((d) => (d.id === doseId ? { ...d, ...stamped } : d))
    )
  }
}

// v0.2.6.1 P1.6 — handler centralizado de erro pra mutations doses.
// Se error.code === 409 → mantém cache no estado otimista + dispara conflict bus
//   pro toast oferecer "Aceitar" (patcha com current_state).
// Caso contrário → rollback normal pra snapshot pré-mutate.
function handleDoseMutationError(qc, mutation, error, variables, ctx) {
  // v0.2.6.1 P1.10 — capturar TODOS os erros de mutation healthcare em Sentry
  // (antes ficava só em onError snapshots rollback). 409 é tagged como warning,
  // resto como error pra ranking severidade no dashboard.
  const level = error?.code === 409 ? 'warning' : 'error'
  captureCaught(error, {
    source: `mutationRegistry.${mutation}`,
    level,
    tags: { mutation, error_code: String(error?.code || 'unknown') },
    extra: { dose_id: variables?.id ?? (typeof variables === 'string' ? variables : null) },
  })
  if (error?.code === 409 && error?.currentState) {
    const doseId = variables?.id ?? (typeof variables === 'string' ? variables : null)
    // Rollback PRIMEIRO (deixa cache no estado pré-otimista), depois conflict bus
    // dispara toast. Se user clicar "Aceitar", aplicamos current_state via
    // patchDoseFromServerState — UI converge com servidor.
    rollback(qc, ctx?.snapshots)
    try { track(EVENTS.SYNC_CONFLICT_DETECTED, { mutation, from: error.from, to: error.to }) } catch {}
    emitConflict({
      mutation,
      doseId,
      currentState: error.currentState,
      from: error.from,
      to: error.to,
      onAccept: () => {
        patchDoseFromServerState(qc, doseId, error.currentState)
        try { track(EVENTS.SYNC_CONFLICT_ACCEPTED_SERVER, { mutation }) } catch {}
      },
      onReject: () => {
        // User descartou — refetch pra forçar sync com server (fonte de verdade)
        try { track(EVENTS.SYNC_CONFLICT_REJECTED_SERVER, { mutation }) } catch {}
        qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
      },
    })
    return
  }
  // Erro genérico (network, 500, etc) — rollback simples
  rollback(qc, ctx?.snapshots)
  // v0.2.6.6 F5 — emite toast UI. Pular cancelamento intencional do TanStack
  // (CancelledError, AbortError) que acontece em flow normal.
  const isCancelled = error?.name === 'CancelError' || error?.name === 'AbortError'
  if (!isCancelled) {
    emitMutationError({ mutation, error, code: error?.code })
  }
}

// v0.2.6.6 F5 — helper pra rollback + emit error pras mutations não-healthcare
// (treatments, patients, registerSos). Antes cada onError fazia rollback silent.
function rollbackAndEmit(qc, mutation, error, snapshotsKey, ctx, opts = {}) {
  const snaps = ctx?.[snapshotsKey] ?? []
  for (const [key, data] of snaps) qc.setQueryData(key, data)
  if (opts?.extraRollback) {
    try { opts.extraRollback(ctx) } catch (e) { console.warn('extraRollback fail:', e?.message) }
  }
  const isCancelled = error?.name === 'CancelError' || error?.name === 'AbortError'
  if (!isCancelled) {
    emitMutationError({ mutation, error, code: error?.code, label: opts?.label })
  }
}

// Debounce pra consolidar invalidate de mutações em sequência rápida
// (confirm → undo → skip → undo geraria 9-12 fetches sem debounce).
//
// Refactor Fase 1: 2000ms → 1500ms. Garante que mutation refetch SEMPRE
// vence Realtime invalidate (debounce 2500ms no useRealtime + gate).
// Sequência de uma marcação otimista:
//   t=0     onMutate patch + markInFlight (TTL 2500ms)
//   t=200   RPC retorna, onSettled chama refetchDoses + clearInFlight
//   t=1700  refetchDoses dispara (1500ms debounce) — server tem commit
//   t=2500+ se Realtime payload chegou em t=300, debounce extra 2500 → t=2800
//           gate já limpou em t=200; mas se houve race extra, _localActedAt
//           ainda protege (stamp em t=0, janela 2500ms = até t=2500).
let _refetchDosesTimer = null
function refetchDoses(qc) {
  if (_refetchDosesTimer) clearTimeout(_refetchDosesTimer)
  _refetchDosesTimer = setTimeout(() => {
    // v0.2.6.5 BUG #0020 — invalidar AMBOS namespaces. AppHeader usa ['doses', filter]
    // pra contar overdue; sem invalidate aqui, alert badge ficava stale após mutation.
    qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    qc.invalidateQueries({ queryKey: ['doses'], refetchType: 'active' })
    _refetchDosesTimer = null
  }, 1500)
}

/**
 * Registra todos defaults globais. Chamar UMA VEZ em main.jsx, ANTES de
 * <PersistQueryClientProvider> hydrate (resumePausedMutations precisa achar
 * mutationFn nos defaults pra reexecutar mutations persistidas).
 */
export function registerMutationDefaults(qc, persister = null) {
  _qcRef = qc
  _persisterRef = persister
  // ─── Doses ──────────────────────────────────────────────────────────
  // v0.2.6.7 INSTRUMENTAÇÃO B102 — telemetria verbose pra trackear lifecycle.
  //
  // v0.2.6.9 FIX UI-LENTA: wrap em DEV-only. Em PROD WebView Android, cada
  // `console.info` faz bridge JS↔Native (~1-3ms) + cada `Sentry.addBreadcrumb`
  // serializa JSON pra buffer 100-entry. 7 calls/mutation × 50 mutations sessão
  // = 350+ bridge calls + 350 breadcrumbs sliding/dropping. Hot path acumula
  // event loop pressure → UI scroll/animação travada após poucos minutos.
  //
  // DEV/devDebug: mantém logs pra reproduzir B102.
  // PROD: silencia. Sentry continua capturando errors via captureException
  // em handleDoseMutationError (cobertura preservada).
  // v0.2.6.13 — gate _IS_DEV removido temporariamente pra capturar mutation
  // lifecycle em devDebug build via logcat. Re-add em v0.2.6.15+ após diagnóstico.
  // v0.2.6.14 — console.info → console.warn pra garantir logcat (W level nunca strip).
  // Também serializa extra inline (object → JSON string) pra ler em logcat.
  const _IS_DEV = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
  function logMut(stage, mutation, extra = {}) {
    void _IS_DEV
    try {
      const extraStr = JSON.stringify(extra)
      console.warn(`[mut:${mutation}] ${stage} ${extraStr}`)
      if (typeof window !== 'undefined' && window.Sentry?.addBreadcrumb) {
        window.Sentry.addBreadcrumb({
          category: `mutation.${mutation}`,
          message: stage,
          level: 'info',
          data: extra,
        })
      }
    } catch {}
  }

  qc.setMutationDefaults(['confirmDose'], {
    mutationFn: async ({ id, ...rest }) => {
      logMut('mutationFn:start', 'confirmDose', { id })
      try {
        const result = await confirmDose(id, rest)
        logMut('mutationFn:ok', 'confirmDose', { id, hasResult: !!result })
        return result
      } catch (e) {
        logMut('mutationFn:throw', 'confirmDose', { id, errCode: e?.code, errMsg: e?.message?.slice(0, 80) })
        throw e
      }
    },
    onMutate: async ({ id, actualTime }) => {
      logMut('onMutate', 'confirmDose', { id })
      markDosesInFlight()
      await Promise.all([
        qc.cancelQueries({ queryKey: ['doses'] }),
        qc.cancelQueries({ queryKey: ['dashboard-payload'] }),
      ])
      const snapshots = patchDoseInCache(qc, id, {
        status: 'done',
        actualTime: actualTime || new Date().toISOString()
      })
      await flushPersistImmediate()
      return { snapshots, startedAt: Date.now(), doseId: id }
    },
    onError: (error, variables, ctx) => {
      logMut('onError', 'confirmDose', { errName: error?.name, errCode: error?.code, errMsg: error?.message?.slice(0, 100) })
      handleDoseMutationError(qc, 'confirmDose', error, variables, ctx)
    },
    onSuccess: (data) => {
      logMut('onSuccess', 'confirmDose', { doseId: data?.id, doseStatus: data?.status })
      track(EVENTS.DOSE_CONFIRMED)
      incrementReviewSignal('dose_confirmed')
    },
    onSettled: (_data, _err, _vars, ctx) => {
      logMut('onSettled', 'confirmDose')
      clearDosesInFlight()
      refetchDoses(qc)
      // v0.2.6.11 AUTO-VALIDATE B102 — capture FINAL cache state pós-onSettled.
      // Sample 100% pra confirmar fix prod sem depender de user reportar.
      // Captura 1500ms após onSettled (espera refetchDoses debounce) e compara
      // dose.status final vs esperado 'done'. Se != 'done' = race ainda existe.
      // Skip rate-limit Sentry via tag is_audit (beforeSend handler).
      try {
        const auditDoseId = ctx?.doseId
        const startedAt = ctx?.startedAt
        if (!auditDoseId) return
        setTimeout(() => {
          try {
            const dpQueries = qc.getQueryCache().findAll({ queryKey: ['dashboard-payload'] })
            let finalStatus = null
            let hasLocalActed = false
            let hasServerConf = false
            for (const q of dpQueries) {
              const data = q.state.data
              if (!data?.doses) continue
              const found = data.doses.find((d) => d.id === auditDoseId)
              if (found) {
                finalStatus = found.status
                hasLocalActed = !!found._localActedAt
                hasServerConf = !!found._serverConfirmedAt
                break
              }
            }
            const expected = 'done'
            const isBug = finalStatus && finalStatus !== expected
            captureCaught(new Error(isBug ? 'B102_RACE_DETECTED' : 'B102_OK'), {
              source: 'mutationRegistry.confirmDose.audit',
              level: isBug ? 'error' : 'info',
              tags: {
                mutation: 'confirmDose',
                is_audit: 'true',
                outcome: isBug ? 'bug' : 'ok',
                final_status: finalStatus || 'missing',
              },
              extra: {
                dose_id: auditDoseId,
                expected_status: expected,
                final_status: finalStatus,
                has_local_acted: hasLocalActed,
                has_server_confirmed: hasServerConf,
                elapsed_ms: startedAt ? Date.now() - startedAt : null,
              },
            })
          } catch { /* fail-safe */ }
        }, 1500)
      } catch { /* fail-safe */ }
    },
  })

  qc.setMutationDefaults(['skipDose'], {
    mutationFn: ({ id, ...rest }) => skipDose(id, rest),
    onMutate: async ({ id }) => {
      markDosesInFlight()
      // v0.2.6.5 BUG #0020 — ver comentário em confirmDose acima
      await Promise.all([
        qc.cancelQueries({ queryKey: ['doses'] }),
        qc.cancelQueries({ queryKey: ['dashboard-payload'] }),
      ])
      const snapshots = patchDoseInCache(qc, id, { status: 'skipped' })
      await flushPersistImmediate()
      return { snapshots }
    },
    // v0.2.6.1 P1.6 — detect 409 + dispara conflict bus
    onError: (error, variables, ctx) => handleDoseMutationError(qc, 'skipDose', error, variables, ctx),
    onSuccess: () => track(EVENTS.DOSE_SKIPPED),
    onSettled: () => {
      clearDosesInFlight()
      refetchDoses(qc)
    },
  })

  qc.setMutationDefaults(['undoDose'], {
    mutationFn: (id) => undoDose(id),
    onMutate: async (id) => {
      markDosesInFlight()
      // v0.2.6.5 BUG #0020 — ver comentário em confirmDose acima
      await Promise.all([
        qc.cancelQueries({ queryKey: ['doses'] }),
        qc.cancelQueries({ queryKey: ['dashboard-payload'] }),
      ])
      const snapshots = patchDoseInCache(qc, id, { status: 'pending', actualTime: null })
      await flushPersistImmediate()
      return { snapshots }
    },
    // v0.2.6.1 P1.6 — detect 409 + dispara conflict bus
    onError: (error, variables, ctx) => handleDoseMutationError(qc, 'undoDose', error, variables, ctx),
    onSuccess: () => track(EVENTS.DOSE_UNDONE),
    onSettled: () => {
      clearDosesInFlight()
      refetchDoses(qc)
    },
  })

  // Item #204 v0.2.1.8 fix-A — optimistic registerSos.
  // Insert dose temp tipo 'sos' status 'done' no cache; drain RPC server-side valida
  // SOS rules (minIntervalHours, maxDosesIn24h). Se server rejeita → onError reverte
  // e UI mostra dose desaparecendo (raro: validação local já feita pré-mutate).
  qc.setMutationDefaults(['registerSos'], {
    mutationFn: registerSos,
    onMutate: async (vars) => {
      markDosesInFlight()
      // v0.2.6.5 BUG #0020 — também cancelar dashboard-payload
      await Promise.all([
        qc.cancelQueries({ queryKey: ['doses'] }),
        qc.cancelQueries({ queryKey: ['dashboard-payload'] }),
      ])
      const tempId = makeTempId()
      const tempDose = {
        id: tempId,
        _optimistic: true,
        _localActedAt: Date.now(), // Refactor Fase 1 — versioned cache stamp
        treatmentId: null,
        patientId: vars.patientId,
        medName: vars.medName,
        unit: vars.unit,
        scheduledAt: vars.scheduledAt || new Date().toISOString(),
        actualTime: vars.scheduledAt || new Date().toISOString(),
        status: 'done',
        type: 'sos',
        observation: vars.observation || '',
      }
      const doseQueries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
      const doseSnapshots = doseQueries.map(q => [q.queryKey, q.state.data])
      for (const q of doseQueries) {
        const data = q.state.data
        if (!Array.isArray(data)) continue
        qc.setQueryData(q.queryKey, [tempDose, ...data])
      }
      // v0.2.3.12 NB-4 — persist IDB imediato. SOS é healthcare-critical.
      await flushPersistImmediate()
      return { doseSnapshots, tempId }
    },
    onError: (error, _v, ctx) => {
      for (const [key, data] of (ctx?.doseSnapshots ?? [])) qc.setQueryData(key, data)
      // v0.2.6.6 F5 — toast user em vez de silent rollback
      if (!['CancelError','AbortError'].includes(error?.name)) {
        emitMutationError({ mutation: 'registerSos', error, code: error?.code })
      }
    },
    onSuccess: (_data, _v, ctx) => {
      track(EVENTS.SOS_DOSE_REGISTERED)
      // Remove temp + invalidate busca dose SOS real do server
      if (ctx?.tempId) {
        const doseQueries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
        for (const q of doseQueries) {
          const data = q.state.data
          if (!Array.isArray(data)) continue
          qc.setQueryData(q.queryKey, data.filter(d => d.id !== ctx.tempId))
        }
      }
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    },
    onSettled: () => {
      clearDosesInFlight()
    },
  })

  // ─── Patients ───────────────────────────────────────────────────────
  // Item #204 v0.2.1.8 fix-A — optimistic createPatient.
  // Sem onMutate, modal PatientForm trava em loading offline (mutateAsync espera
  // reconnect). Cache patch local insere temp paciente → UI fecha modal +
  // mostra paciente novo imediato. onSuccess substitui temp por real pós-drain.
  qc.setMutationDefaults(['createPatient'], {
    mutationFn: createPatient,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['patients'] })
      const tempId = makeTempId()
      const tempPatient = {
        id: tempId,
        _optimistic: true,
        ...vars,
        createdAt: new Date().toISOString(),
      }
      const prev = qc.getQueryData(['patients'])
      qc.setQueryData(['patients'], (old = []) => [tempPatient, ...(old || [])])
      return { prev, tempId }
    },
    onError: (error, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['patients'], ctx.prev)
      if (!['CancelError','AbortError'].includes(error?.name)) {
        emitMutationError({ mutation: 'createPatient', error, code: error?.code })
      }
    },
    onSuccess: (data, _v, ctx) => {
      track(EVENTS.PATIENT_CREATED)
      // Substitui entry temp pelo paciente real retornado do server.
      // Marca _tempIdSource: tempId pra createTreatment mutationFn poder traduzir
      // patientId temp → real ID quando drain após reconnect (FK violation fix).
      if (ctx?.tempId && data?.id) {
        qc.setQueryData(['patients'], (old = []) =>
          (old || []).map(p => p.id === ctx.tempId
            ? { ...data, _tempIdSource: ctx.tempId }
            : p
          )
        )
      }
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    },
  })

  // Item #204 v0.2.1.8 fix-A — optimistic updatePatient.
  // Edit offline: cache patch local + modal fecha imediato. onError rollback.
  qc.setMutationDefaults(['updatePatient'], {
    mutationFn: ({ id, patch }) => updatePatient(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['patients'] })
      const prev = qc.getQueryData(['patients'])
      qc.setQueryData(['patients'], (old = []) =>
        (old || []).map(p => p.id === id ? { ...p, ...patch, _optimistic: true } : p)
      )
      // Patch single patient cache também (getPatient)
      const prevSingle = qc.getQueryData(['patients', id])
      if (prevSingle) {
        qc.setQueryData(['patients', id], { ...prevSingle, ...patch, _optimistic: true })
      }
      return { prev, prevSingle, id }
    },
    onError: (error, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['patients'], ctx.prev)
      if (ctx?.prevSingle !== undefined) qc.setQueryData(['patients', ctx.id], ctx.prevSingle)
      if (!['CancelError','AbortError'].includes(error?.name)) {
        emitMutationError({ mutation: 'updatePatient', error, code: error?.code })
      }
    },
    onSuccess: (data, _v, ctx) => {
      // Remove _optimistic flag substituindo entry pelo retorno real.
      if (data?.id) {
        qc.setQueryData(['patients'], (old = []) =>
          (old || []).map(p => p.id === data.id ? data : p)
        )
        qc.setQueryData(['patients', data.id], data)
      }
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    },
  })

  qc.setMutationDefaults(['deletePatient'], {
    mutationFn: deletePatient,
    onSuccess: () => {
      track(EVENTS.PATIENT_DELETED)
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    },
  })

  // ─── Treatments ─────────────────────────────────────────────────────
  // Item #204 v0.2.1.8 fix-A — optimistic createTreatment + doses local.
  // Cache patch insere treatment temp + doses geradas localmente via generateDoses()
  // (mesma fonte que mock/server). Dashboard renderiza tratamento + alarme nativo
  // agenda (AlarmScheduler escuta cache ['doses']). mutationFn resolve patientId
  // temp → real ID antes RPC (drain pós-reconnect FK fix).
  qc.setMutationDefaults(['createTreatment'], {
    mutationFn: async (vars) => {
      let pid = vars.patientId
      // fix-A1: se patientId é temp, busca real ID via _tempIdSource marker
      // em cache patients (createPatient onSuccess marca pós-drain).
      if (pid?.startsWith(TEMP_ID_PREFIX) && _qcRef) {
        const patients = _qcRef.getQueryData(['patients']) || []
        const real = patients.find((p) => p._tempIdSource === pid)
        if (real?.id) {
          pid = real.id
        } else {
          // createPatient ainda não drenou — TanStack FIFO submittedAt ordem
          // deveria drenar createPatient antes createTreatment. Se chegou aqui
          // sem marker, lance erro pra TanStack retry (drain createPatient
          // primeiro depois retoma createTreatment).
          throw new Error('Paciente temp ainda não sincronizado — retry após drain createPatient')
        }
      }
      return createTreatmentWithDoses({ ...vars, patientId: pid })
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['treatments'] })
      await qc.cancelQueries({ queryKey: ['doses'] })
      const tempId = makeTempId()
      const tempTreatment = {
        id: tempId,
        _optimistic: true,
        patientId: vars.patientId,
        medName: vars.medName,
        unit: vars.unit,
        intervalHours: vars.mode === 'times' ? null : (vars.intervalHours ?? null),
        durationDays: vars.isContinuous ? 90 : (vars.durationDays ?? 7),
        isContinuous: !!vars.isContinuous,
        startDate: vars.startDate,
        firstDoseTime: vars.firstDoseTime ?? '08:00',
        status: 'active',
        isTemplate: !!vars.isTemplate,
        createdAt: new Date().toISOString(),
      }
      // fix-A2: gera doses optimistic local pra Dashboard renderizar + AlarmScheduler
      // agendar alarme nativo offline. onSuccess remove temps + invalidate busca reais.
      const generated = generateDoses({
        ...vars,
        id: tempId,
        durationDays: tempTreatment.durationDays,
      })
      const tempDoses = generated.map((d) => ({
        ...d,
        id: makeTempId(),
        treatmentId: tempId,
        _optimistic: true,
      }))
      // v0.2.3.6 #266 fix: insert em TODAS variações ['treatments', *] (sem
      // filter + por patientId, etc). setQueryData(['treatments']) sozinho só
      // atinge queryKey exata — PatientDetail (`useTreatments({patientId})`)
      // não recebia o novo tratamento até refetch.
      // Filter match: queryKey filter pode ter {patientId} — inserir se bate
      // ou se filter sem patientId (lista geral).
      const treatmentSnapshots = insertEntityIntoLists(
        qc, 'treatments', tempTreatment,
        (item, filter) => !filter?.patientId || filter.patientId === item.patientId
      )
      // Cache doses pode ter múltiplas queryKeys (filter por patientId/from/to). Faz
      // findAll + patch cada — mesma estratégia patchDoseInCache pra confirm/skip.
      const doseQueries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
      const doseSnapshots = doseQueries.map((q) => [q.queryKey, q.state.data])
      for (const q of doseQueries) {
        const data = q.state.data
        if (!Array.isArray(data)) continue
        qc.setQueryData(q.queryKey, [...tempDoses, ...data])
      }
      return {
        treatmentSnapshots, tempId,
        tempDoseIds: tempDoses.map((d) => d.id),
        doseSnapshots,
      }
    },
    onError: (error, _v, ctx) => {
      // Rollback treatments via snapshots (todas queryKeys ['treatments', *])
      rollback(qc, ctx?.treatmentSnapshots)
      // Rollback doses por snapshot (todas queryKeys ['doses'] afetadas)
      for (const [key, data] of (ctx?.doseSnapshots ?? [])) {
        qc.setQueryData(key, data)
      }
      // v0.2.6.6 F5
      if (!['CancelError','AbortError'].includes(error?.name)) {
        emitMutationError({ mutation: 'createTreatment', error, code: error?.code })
      }
    },
    onSuccess: (data, _v, ctx) => {
      track(EVENTS.TREATMENT_CREATED)
      // RPC retorna treatment + doses jsonb. Substitui temp pelo real.
      const real = data?.treatment || data
      // v0.2.3.6 #266: substitui temp por real em TODAS variações ['treatments', *]
      if (ctx?.tempId && real?.id) {
        const treatmentQueries = qc.getQueryCache().findAll({ queryKey: ['treatments'] })
        for (const q of treatmentQueries) {
          const arr = q.state.data
          if (!Array.isArray(arr)) continue
          qc.setQueryData(q.queryKey,
            arr.map((t) => t.id === ctx.tempId
              ? { ...real, _tempIdSource: ctx.tempId }
              : t
            )
          )
        }
      }
      // Remove doses temp via tempDoseIds; invalidate busca doses reais do server.
      if (ctx?.tempDoseIds?.length) {
        const doseQueries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
        for (const q of doseQueries) {
          const data = q.state.data
          if (!Array.isArray(data)) continue
          qc.setQueryData(q.queryKey, data.filter((d) => !ctx.tempDoseIds.includes(d.id)))
        }
      }
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
      // v0.2.3.6 #271 fix: createTreatment não invalidava ['dashboard-payload'],
      // resultado: Dashboard não mostrava doses recém-criadas até next mount/focus.
      // Mantém parity com createPatient (line 142) que já invalida.
      qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    },
  })

  // Item #204 v0.2.1.8 fix-A — optimistic updateTreatment.
  // NOTA: edit que muda schedule (intervalHours/durationDays/startDate/firstDoseTime)
  // requer RPC server-side regenerar doses. Offline patch só altera treatment cache;
  // doses futuras só ficam corretas pós-drain (invalidate ['doses']). Aceitável —
  // mostra status correto na lista, refetch real após reconectar.
  qc.setMutationDefaults(['updateTreatment'], {
    mutationFn: ({ id, patch }) => updateTreatment(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['treatments'] })
      const prev = qc.getQueryData(['treatments'])
      qc.setQueryData(['treatments'], (old = []) =>
        (old || []).map(t => t.id === id ? { ...t, ...patch, _optimistic: true } : t)
      )
      const prevSingle = qc.getQueryData(['treatments', id])
      if (prevSingle) {
        qc.setQueryData(['treatments', id], { ...prevSingle, ...patch, _optimistic: true })
      }
      return { prev, prevSingle, id }
    },
    onError: (error, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['treatments'], ctx.prev)
      if (ctx?.prevSingle !== undefined) qc.setQueryData(['treatments', ctx.id], ctx.prevSingle)
      if (!['CancelError','AbortError'].includes(error?.name)) {
        emitMutationError({ mutation: 'updateTreatment', error, code: error?.code })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
      qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    },
  })

  qc.setMutationDefaults(['deleteTreatment'], {
    mutationFn: deleteTreatment,
    onSuccess: () => {
      track(EVENTS.TREATMENT_DELETED)
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    },
  })

  // Item #204 v0.2.1.8 fix — pauseTreatment patch TODAS variações queryKey
  // ['treatments', filter]. setQueryData(['treatments']) sozinho NÃO atinge
  // useTreatments({patientId}) etc → UI mostrava status antigo.
  qc.setMutationDefaults(['pauseTreatment'], {
    mutationFn: pauseTreatment,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['treatments'] })
      await qc.cancelQueries({ queryKey: ['doses'] })
      const treatmentSnapshots = patchEntityListsInCache(qc, 'treatments', id, {
        status: 'paused', _optimistic: true
      })
      // Patch single cache key também (useTreatment(id))
      const prevSingle = qc.getQueryData(['treatments', id])
      if (prevSingle) {
        qc.setQueryData(['treatments', id], { ...prevSingle, status: 'paused', _optimistic: true })
      }
      // Remove doses futuras pendentes local (cancelFutureDoses semântica server)
      const nowMs = Date.now()
      const doseQueries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
      const doseSnapshots = doseQueries.map(q => [q.queryKey, q.state.data])
      for (const q of doseQueries) {
        const data = q.state.data
        if (!Array.isArray(data)) continue
        qc.setQueryData(q.queryKey, data.filter(d =>
          !(d.treatmentId === id && d.status === 'pending' && new Date(d.scheduledAt).getTime() > nowMs)
        ))
      }
      return { treatmentSnapshots, doseSnapshots, prevSingle, id }
    },
    onError: (error, _v, ctx) => {
      rollback(qc, ctx?.treatmentSnapshots)
      rollback(qc, ctx?.doseSnapshots)
      if (ctx?.prevSingle !== undefined) qc.setQueryData(['treatments', ctx.id], ctx.prevSingle)
      if (!['CancelError','AbortError'].includes(error?.name)) {
        emitMutationError({ mutation: 'pauseTreatment', error, code: error?.code })
      }
    },
    onSuccess: () => {
      track(EVENTS.TREATMENT_PAUSED || 'treatment_paused')
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
      qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    },
  })

  // Item #204 v0.2.1.8 fix — resumeTreatment patch TODAS variações.
  qc.setMutationDefaults(['resumeTreatment'], {
    mutationFn: resumeTreatment,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['treatments'] })
      const snapshots = patchEntityListsInCache(qc, 'treatments', id, {
        status: 'active', _optimistic: true
      })
      const prevSingle = qc.getQueryData(['treatments', id])
      if (prevSingle) {
        qc.setQueryData(['treatments', id], { ...prevSingle, status: 'active', _optimistic: true })
      }
      return { snapshots, prevSingle, id }
    },
    onError: (error, _v, ctx) => {
      rollback(qc, ctx?.snapshots)
      if (ctx?.prevSingle !== undefined) qc.setQueryData(['treatments', ctx.id], ctx.prevSingle)
      if (!['CancelError','AbortError'].includes(error?.name)) {
        emitMutationError({ mutation: 'resumeTreatment', error, code: error?.code })
      }
    },
    onSuccess: () => {
      track(EVENTS.TREATMENT_RESUMED || 'treatment_resumed')
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
      qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    },
  })

  // Item #204 v0.2.1.8 fix — endTreatment patch TODAS variações + cancel doses.
  qc.setMutationDefaults(['endTreatment'], {
    mutationFn: endTreatment,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['treatments'] })
      await qc.cancelQueries({ queryKey: ['doses'] })
      const treatmentSnapshots = patchEntityListsInCache(qc, 'treatments', id, {
        status: 'ended', _optimistic: true
      })
      const prevSingle = qc.getQueryData(['treatments', id])
      if (prevSingle) {
        qc.setQueryData(['treatments', id], { ...prevSingle, status: 'ended', _optimistic: true })
      }
      const nowMs = Date.now()
      const doseQueries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
      const doseSnapshots = doseQueries.map(q => [q.queryKey, q.state.data])
      for (const q of doseQueries) {
        const data = q.state.data
        if (!Array.isArray(data)) continue
        qc.setQueryData(q.queryKey, data.filter(d =>
          !(d.treatmentId === id && d.status === 'pending' && new Date(d.scheduledAt).getTime() > nowMs)
        ))
      }
      return { treatmentSnapshots, doseSnapshots, prevSingle, id }
    },
    onError: (error, _v, ctx) => {
      rollback(qc, ctx?.treatmentSnapshots)
      rollback(qc, ctx?.doseSnapshots)
      if (ctx?.prevSingle !== undefined) qc.setQueryData(['treatments', ctx.id], ctx.prevSingle)
      if (!['CancelError','AbortError'].includes(error?.name)) {
        emitMutationError({ mutation: 'endTreatment', error, code: error?.code })
      }
    },
    onSuccess: () => {
      track(EVENTS.TREATMENT_ENDED || 'treatment_ended')
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
      qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    },
  })
}
