/**
 * patientStore.js — Refactor Sync v2 Fase 2 (v0.2.7.0) + persist BUG #0031 (v0.2.8.4)
 *
 * Mesma estrutura de doseStore. Pacientes têm CRUD mais simples — sem
 * Realtime postgres_changes (não há listener pra patients hoje, fetch on mount
 * ou após mutation invalidate).
 *
 * v0.2.8.4 persist (BUG #0031 root fix): cache local Capacitor Preferences.
 * Cuida partialize/merge pra Map↔Array conversion (JSON-safe).
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { capacitorStorage } from './persistStorage'

const usePatientStore = create(
  persist(
    (set) => ({
      patients: new Map(),
      loaded: false,
      loadedAt: null,
      _snapshots: new Map(),

      setAll(patients) {
        set({
          patients: new Map((patients || []).map(p => [p.id, p])),
          loaded: true,
          loadedAt: Date.now(),
          _snapshots: new Map(),
        })
      },

      patch(id, patchObj) {
        set(state => {
          const current = state.patients.get(id)
          if (!current) return state
          const nextSnapshots = new Map(state._snapshots)
          if (patchObj._optimistic && !nextSnapshots.has(id)) {
            nextSnapshots.set(id, current)
          }
          if (patchObj._optimistic === false || patchObj._confirmedAt) {
            nextSnapshots.delete(id)
          }
          const next = new Map(state.patients)
          next.set(id, { ...current, ...patchObj })
          return { patients: next, _snapshots: nextSnapshots }
        })
      },

      insert(patient) {
        set(state => {
          const next = new Map(state.patients)
          next.set(patient.id, patient)
          return { patients: next }
        })
      },

      remove(id) {
        set(state => {
          const next = new Map(state.patients)
          next.delete(id)
          const nextSnapshots = new Map(state._snapshots)
          nextSnapshots.delete(id)
          return { patients: next, _snapshots: nextSnapshots }
        })
      },

      revert(id) {
        set(state => {
          const snapshot = state._snapshots.get(id)
          if (!snapshot) return state
          const next = new Map(state.patients)
          next.set(id, snapshot)
          const nextSnapshots = new Map(state._snapshots)
          nextSnapshots.delete(id)
          return { patients: next, _snapshots: nextSnapshots }
        })
      },

      reset() {
        set({ patients: new Map(), loaded: false, loadedAt: null, _snapshots: new Map() })
      },
    }),
    {
      name: 'dosy_cache_patients_v1',
      storage: createJSONStorage(() => capacitorStorage),
      version: 1,
      partialize: (state) => ({
        patients: Array.from(state.patients.entries()),
        loadedAt: state.loadedAt,
      }),
      merge: (persisted, current) => {
        if (!persisted || !Array.isArray(persisted.patients)) return current
        try {
          return {
            ...current,
            patients: new Map(persisted.patients),
            loaded: true,
            loadedAt: persisted.loadedAt,
          }
        } catch {
          return current
        }
      },
      migrate: (persistedState) => persistedState,
    }
  )
)

export { usePatientStore }

export const setAllPatients = (patients) => usePatientStore.getState().setAll(patients)
export const patchPatient = (id, patch) => usePatientStore.getState().patch(id, patch)
export const insertPatient = (p) => usePatientStore.getState().insert(p)
export const removePatient = (id) => usePatientStore.getState().remove(id)
export const revertPatient = (id) => usePatientStore.getState().revert(id)
export const getPatient = (id) => usePatientStore.getState().patients.get(id)
export const resetPatientStore = () => usePatientStore.getState().reset()
