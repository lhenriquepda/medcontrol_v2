/**
 * treatmentStore.js — Refactor Sync v2 Fase 2 (v0.2.7.0)
 *
 * Mesma estrutura de doseStore/patientStore.
 */
import { create } from 'zustand'

const useTreatmentStore = create((set) => ({
  treatments: new Map(),
  loaded: false,
  loadedAt: null,
  _snapshots: new Map(),

  setAll(treatments) {
    set({
      treatments: new Map((treatments || []).map(t => [t.id, t])),
      loaded: true,
      loadedAt: Date.now(),
      _snapshots: new Map(),
    })
  },

  patch(id, patchObj) {
    set(state => {
      const current = state.treatments.get(id)
      if (!current) return state
      const nextSnapshots = new Map(state._snapshots)
      if (patchObj._optimistic && !nextSnapshots.has(id)) {
        nextSnapshots.set(id, current)
      }
      if (patchObj._optimistic === false || patchObj._confirmedAt) {
        nextSnapshots.delete(id)
      }
      const next = new Map(state.treatments)
      next.set(id, { ...current, ...patchObj })
      return { treatments: next, _snapshots: nextSnapshots }
    })
  },

  insert(treatment) {
    set(state => {
      const next = new Map(state.treatments)
      next.set(treatment.id, treatment)
      return { treatments: next }
    })
  },

  remove(id) {
    set(state => {
      const next = new Map(state.treatments)
      next.delete(id)
      const nextSnapshots = new Map(state._snapshots)
      nextSnapshots.delete(id)
      return { treatments: next, _snapshots: nextSnapshots }
    })
  },

  revert(id) {
    set(state => {
      const snapshot = state._snapshots.get(id)
      if (!snapshot) return state
      const next = new Map(state.treatments)
      next.set(id, snapshot)
      const nextSnapshots = new Map(state._snapshots)
      nextSnapshots.delete(id)
      return { treatments: next, _snapshots: nextSnapshots }
    })
  },

  reset() {
    set({ treatments: new Map(), loaded: false, loadedAt: null, _snapshots: new Map() })
  },
}))

export { useTreatmentStore }

export const setAllTreatments = (treatments) => useTreatmentStore.getState().setAll(treatments)
export const patchTreatment = (id, patch) => useTreatmentStore.getState().patch(id, patch)
export const insertTreatment = (t) => useTreatmentStore.getState().insert(t)
export const removeTreatment = (id) => useTreatmentStore.getState().remove(id)
export const revertTreatment = (id) => useTreatmentStore.getState().revert(id)
export const getTreatment = (id) => useTreatmentStore.getState().treatments.get(id)
export const resetTreatmentStore = () => useTreatmentStore.getState().reset()
