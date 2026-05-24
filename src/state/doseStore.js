/**
 * doseStore.js — Refactor Sync v2 Fase 2 (v0.2.7.0)
 *
 * Single source of truth pra doses no cliente. Substitui TanStack Query cache
 * de doses (com hydrate persist + race conditions) por Zustand store em memória.
 *
 * Princípios (Refactor_Sync_v2.md §2):
 *   P1 — server é fonte da verdade, store é view layer
 *   P4 — process kill é estado normal: NÃO persistimos cache (cold start = fresh fetch)
 *
 * API:
 *   - useDoseStore(selector)         — Zustand hook
 *   - setAllDoses(doses)             — substitui Map inteiro (cold fetch)
 *   - patchDose(id, patch)           — atualiza dose individual (optimistic / Realtime)
 *   - revertDose(id)                 — reverte ao último snapshot _confirmedAt
 *   - getDose(id)                    — getter síncrono
 *   - subscribeDoses(callback)       — alternativa pra contextos non-React
 */
import { create } from 'zustand'

const useDoseStore = create((set) => ({
  doses: new Map(),
  loaded: false,
  loadedAt: null,

  // Snapshots pra rollback de optimistic patches.
  // Key: doseId. Value: dose object antes do patch otimista (sem _optimistic flag).
  _snapshots: new Map(),

  setAll(doses) {
    set({
      doses: new Map((doses || []).map(d => [d.id, d])),
      loaded: true,
      loadedAt: Date.now(),
      _snapshots: new Map(),  // limpa snapshots — fresh fetch reseta tudo
    })
  },

  patch(id, patchObj) {
    set(state => {
      const current = state.doses.get(id)
      if (!current) return state  // dose não existe — ignora
      // Cria snapshot SE não existe ainda E se patch é otimista (pra rollback).
      const nextSnapshots = new Map(state._snapshots)
      if (patchObj._optimistic && !nextSnapshots.has(id)) {
        nextSnapshots.set(id, current)
      }
      // Se patch confirma (remove _optimistic), limpa snapshot.
      if (patchObj._optimistic === false || patchObj._confirmedAt) {
        nextSnapshots.delete(id)
      }
      const next = new Map(state.doses)
      next.set(id, { ...current, ...patchObj })
      return { doses: next, _snapshots: nextSnapshots }
    })
  },

  revert(id) {
    set(state => {
      const snapshot = state._snapshots.get(id)
      if (!snapshot) return state  // sem snapshot — nada pra reverter
      const next = new Map(state.doses)
      next.set(id, snapshot)
      const nextSnapshots = new Map(state._snapshots)
      nextSnapshots.delete(id)
      return { doses: next, _snapshots: nextSnapshots }
    })
  },

  reset() {
    set({ doses: new Map(), loaded: false, loadedAt: null, _snapshots: new Map() })
  },
}))

export { useDoseStore }

// Helpers de acesso direto (fora de contexto React)
export const setAllDoses = (doses) => useDoseStore.getState().setAll(doses)
export const patchDose = (id, patch) => useDoseStore.getState().patch(id, patch)
export const revertDose = (id) => useDoseStore.getState().revert(id)
export const getDose = (id) => useDoseStore.getState().doses.get(id)
export const resetDoseStore = () => useDoseStore.getState().reset()

export const subscribeDoses = (callback) => useDoseStore.subscribe(callback)
