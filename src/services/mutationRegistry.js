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

  qc.setMutationDefaults(['registerSos'], {
    mutationFn: registerSos,
    onSuccess: () => {
      track(EVENTS.SOS_DOSE_REGISTERED)
      qc.invalidateQueries({ queryKey: ['doses'] })
    },
  })

  // ─── Patients ───────────────────────────────────────────────────────
  qc.setMutationDefaults(['createPatient'], {
    mutationFn: createPatient,
    onSuccess: () => {
      track(EVENTS.PATIENT_CREATED)
      qc.invalidateQueries({ queryKey: ['patients'] })
    },
  })

  qc.setMutationDefaults(['updatePatient'], {
    mutationFn: ({ id, patch }) => updatePatient(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
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
  qc.setMutationDefaults(['createTreatment'], {
    mutationFn: createTreatmentWithDoses,
    onSuccess: () => {
      track(EVENTS.TREATMENT_CREATED)
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
    },
  })

  qc.setMutationDefaults(['updateTreatment'], {
    mutationFn: ({ id, patch }) => updateTreatment(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treatments'] })
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

  qc.setMutationDefaults(['pauseTreatment'], {
    mutationFn: pauseTreatment,
    onSuccess: () => {
      track(EVENTS.TREATMENT_PAUSED || 'treatment_paused')
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
    },
  })

  qc.setMutationDefaults(['resumeTreatment'], {
    mutationFn: resumeTreatment,
    onSuccess: () => {
      track(EVENTS.TREATMENT_RESUMED || 'treatment_resumed')
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
    },
  })

  qc.setMutationDefaults(['endTreatment'], {
    mutationFn: endTreatment,
    onSuccess: () => {
      track(EVENTS.TREATMENT_ENDED || 'treatment_ended')
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
      qc.invalidateQueries({ queryKey: ['user_medications'] })
    },
  })
}
