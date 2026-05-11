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

// ─── helpers cache patch (movidos de useDoses.js — mesmas semânticas) ───
function patchDoseInCache(qc, id, patch) {
  // findAll() em vez de setQueriesData partial key — mais confiável em v5
  const queries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
  const snapshots = queries.map((q) => [q.queryKey, q.state.data])
  for (const q of queries) {
    const data = q.state.data
    if (!Array.isArray(data)) continue
    qc.setQueryData(
      q.queryKey,
      data.map((d) => (d.id === id ? { ...d, ...patch } : d))
    )
  }
  return snapshots
}

function rollback(qc, snapshots) {
  for (const [key, data] of (snapshots ?? [])) qc.setQueryData(key, data)
}

// Debounce 2s pra consolidar invalidate de mutações em sequência rápida
// (confirm → undo → skip → undo geraria 9-12 fetches sem debounce).
let _refetchDosesTimer = null
function refetchDoses(qc) {
  if (_refetchDosesTimer) clearTimeout(_refetchDosesTimer)
  _refetchDosesTimer = setTimeout(() => {
    qc.invalidateQueries({ queryKey: ['doses'], refetchType: 'active' })
    _refetchDosesTimer = null
  }, 2000)
}

/**
 * Registra todos defaults globais. Chamar UMA VEZ em main.jsx, ANTES de
 * <PersistQueryClientProvider> hydrate (resumePausedMutations precisa achar
 * mutationFn nos defaults pra reexecutar mutations persistidas).
 */
export function registerMutationDefaults(qc) {
  _qcRef = qc
  // ─── Doses ──────────────────────────────────────────────────────────
  qc.setMutationDefaults(['confirmDose'], {
    mutationFn: ({ id, ...rest }) => confirmDose(id, rest),
    onMutate: async ({ id, actualTime }) => {
      await qc.cancelQueries({ queryKey: ['doses'] })
      const snapshots = patchDoseInCache(qc, id, {
        status: 'done',
        actualTime: actualTime || new Date().toISOString()
      })
      return { snapshots }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snapshots),
    onSuccess: () => {
      track(EVENTS.DOSE_CONFIRMED)
      incrementReviewSignal('dose_confirmed')
    },
    onSettled: () => refetchDoses(qc),
  })

  qc.setMutationDefaults(['skipDose'], {
    mutationFn: ({ id, ...rest }) => skipDose(id, rest),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['doses'] })
      const snapshots = patchDoseInCache(qc, id, { status: 'skipped' })
      return { snapshots }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snapshots),
    onSuccess: () => track(EVENTS.DOSE_SKIPPED),
    onSettled: () => refetchDoses(qc),
  })

  qc.setMutationDefaults(['undoDose'], {
    mutationFn: (id) => undoDose(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['doses'] })
      const snapshots = patchDoseInCache(qc, id, { status: 'pending', actualTime: null })
      return { snapshots }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snapshots),
    onSuccess: () => track(EVENTS.DOSE_UNDONE),
    onSettled: () => refetchDoses(qc),
  })

  // Item #204 v0.2.1.8 fix-A — optimistic registerSos.
  // Insert dose temp tipo 'sos' status 'done' no cache; drain RPC server-side valida
  // SOS rules (minIntervalHours, maxDosesIn24h). Se server rejeita → onError reverte
  // e UI mostra dose desaparecendo (raro: validação local já feita pré-mutate).
  qc.setMutationDefaults(['registerSos'], {
    mutationFn: registerSos,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['doses'] })
      const tempId = makeTempId()
      const tempDose = {
        id: tempId,
        _optimistic: true,
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
      return { doseSnapshots, tempId }
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of (ctx?.doseSnapshots ?? [])) qc.setQueryData(key, data)
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
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['patients'], ctx.prev)
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
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['patients'], ctx.prev)
      if (ctx?.prevSingle !== undefined) qc.setQueryData(['patients', ctx.id], ctx.prevSingle)
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
    },
  })

  qc.setMutationDefaults(['deletePatient'], {
    mutationFn: deletePatient,
    onSuccess: () => {
      track(EVENTS.PATIENT_DELETED)
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
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
      const prevTreatments = qc.getQueryData(['treatments'])
      const prevDoses = qc.getQueryData(['doses'])
      qc.setQueryData(['treatments'], (old = []) => [tempTreatment, ...(old || [])])
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
        prevTreatments, prevDoses, tempId,
        tempDoseIds: tempDoses.map((d) => d.id),
        doseSnapshots,
      }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevTreatments !== undefined) qc.setQueryData(['treatments'], ctx.prevTreatments)
      // Rollback doses por snapshot (todas queryKeys ['doses'] afetadas)
      for (const [key, data] of (ctx?.doseSnapshots ?? [])) {
        qc.setQueryData(key, data)
      }
    },
    onSuccess: (data, _v, ctx) => {
      track(EVENTS.TREATMENT_CREATED)
      // RPC retorna treatment + doses jsonb. Substitui temp pelo real.
      const real = data?.treatment || data
      if (ctx?.tempId && real?.id) {
        qc.setQueryData(['treatments'], (old = []) =>
          (old || []).map((t) => t.id === ctx.tempId
            ? { ...real, _tempIdSource: ctx.tempId }
            : t
          )
        )
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
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['treatments'], ctx.prev)
      if (ctx?.prevSingle !== undefined) qc.setQueryData(['treatments', ctx.id], ctx.prevSingle)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
    },
  })

  qc.setMutationDefaults(['deleteTreatment'], {
    mutationFn: deleteTreatment,
    onSuccess: () => {
      track(EVENTS.TREATMENT_DELETED)
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
    },
  })

  // Item #204 v0.2.1.8 fix-A — optimistic pauseTreatment.
  // Status muda imediato no cache + cancela doses futuras local (AlarmScheduler
  // re-agenda baseado no cache → alarmes param). Drain RPC server-side replica.
  qc.setMutationDefaults(['pauseTreatment'], {
    mutationFn: pauseTreatment,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['treatments'] })
      await qc.cancelQueries({ queryKey: ['doses'] })
      const prevT = qc.getQueryData(['treatments'])
      qc.setQueryData(['treatments'], (old = []) =>
        (old || []).map(t => t.id === id ? { ...t, status: 'paused', _optimistic: true } : t)
      )
      // Remove doses futuras pendentes local (mesma semântica cancelFutureDoses server)
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
      return { prevT, doseSnapshots, id }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevT !== undefined) qc.setQueryData(['treatments'], ctx.prevT)
      for (const [key, data] of (ctx?.doseSnapshots ?? [])) qc.setQueryData(key, data)
    },
    onSuccess: () => {
      track(EVENTS.TREATMENT_PAUSED || 'treatment_paused')
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
    },
  })

  // Item #204 v0.2.1.8 fix-A — optimistic resumeTreatment.
  // Status flip pra active local; doses futuras geradas SERVER-SIDE pela RPC
  // update_treatment_schedule. Offline cache não regenera doses — drain online
  // restaura. Aceitável (resume é raro + AlarmScheduler refetch após drain).
  qc.setMutationDefaults(['resumeTreatment'], {
    mutationFn: resumeTreatment,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['treatments'] })
      const prev = qc.getQueryData(['treatments'])
      qc.setQueryData(['treatments'], (old = []) =>
        (old || []).map(t => t.id === id ? { ...t, status: 'active', _optimistic: true } : t)
      )
      return { prev, id }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['treatments'], ctx.prev)
    },
    onSuccess: () => {
      track(EVENTS.TREATMENT_RESUMED || 'treatment_resumed')
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
    },
  })

  // Item #204 v0.2.1.8 fix-A — optimistic endTreatment.
  // Mesma estratégia pauseTreatment: status=ended + cancela doses futuras local.
  qc.setMutationDefaults(['endTreatment'], {
    mutationFn: endTreatment,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['treatments'] })
      await qc.cancelQueries({ queryKey: ['doses'] })
      const prevT = qc.getQueryData(['treatments'])
      qc.setQueryData(['treatments'], (old = []) =>
        (old || []).map(t => t.id === id ? { ...t, status: 'ended', _optimistic: true } : t)
      )
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
      return { prevT, doseSnapshots, id }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevT !== undefined) qc.setQueryData(['treatments'], ctx.prevT)
      for (const [key, data] of (ctx?.doseSnapshots ?? [])) qc.setQueryData(key, data)
    },
    onSuccess: () => {
      track(EVENTS.TREATMENT_ENDED || 'treatment_ended')
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
    },
  })
}
