/**
 * persistStorage.js — Capacitor Preferences adapter para zustand/middleware persist
 *
 * BUG #0031 fix (v0.2.8.3+) — habilita cache LOCAL persistido para stores Zustand
 * (doseStore/patientStore/treatmentStore). Padrão WhatsApp/Gmail:
 *
 *   1. Boot: hydrate cache local (SharedPreferences) → UI imediato (skeleton-free)
 *   2. Em paralelo: fetchDashboard() pega delta fresh do server
 *   3. setAll(...) substitui cache → UI atualiza in-place sem flicker
 *
 * Sem cache local, Samsung kill agressivo (One UI 7) + cold-start = skeleton
 * de 15-30s mesmo com app aberto + internet OK → user percebe "fila stuck".
 * Cache local elimina classe inteira do bug crônico desde v0.2.6.6 (#0023, #0031).
 *
 * Por que Capacitor Preferences em vez de IndexedDB / localStorage:
 *  - Mesmo backing store da pendingMutationsQueue (SharedPreferences Android,
 *    SDK iOS UserDefaults na web localStorage). Único storage que Worker Java
 *    nativo MutationDrainWorker também acessa (consistência storage).
 *  - SharedPreferences Android NÃO é wiped por Samsung Doze / battery optimizer
 *    (diferente do WebView IndexedDB que pode ser limpo em background-kill).
 *  - API async simples (get/set/remove) compatível com zustand persist storage.
 *
 * Limites SharedPreferences:
 *  - Single-value limit ~8MB Android (mais que suficiente: ~500KB pra 1000 doses).
 *  - Atomic writes by-key (sem race entre múltiplos stores).
 *
 * Cache é wiped explicitamente em useAuth.signOut() — evita vazamento cross-account.
 */
import { Capacitor } from '@capacitor/core'

// v0.2.8.4 hardening — usa Capacitor.Plugins.Preferences DIRETAMENTE em vez de
// dynamic import '@capacitor/preferences'. Investigação empírica (S25U, 23:30 BRT)
// mostrou que `await import('@capacitor/preferences')` quando chamado de dentro
// do Zustand persist middleware HANG indefinidamente (provavelmente circular
// dep entre state/doseStore → state/persistStorage → @capacitor/preferences
// → core de boot que ainda está montando React tree).
//
// Capacitor.Plugins.Preferences é injetado pelo bridge native ANTES do React mount
// (linha 1 do main.jsx, antes do ReactDOM.createRoot), então sempre disponível.
//
// Web fallback: localStorage shim (Capacitor.Plugins.Preferences é undefined em web).
function getPrefsSync() {
  if (Capacitor.isNativePlatform() && Capacitor.Plugins?.Preferences) {
    return Capacitor.Plugins.Preferences
  }
  // Web fallback: shim localStorage com mesmo API surface (get/set/remove return Promise)
  return {
    async get({ key }) {
      try { return { value: localStorage.getItem(key) } } catch { return { value: null } }
    },
    async set({ key, value }) {
      try { localStorage.setItem(key, value) } catch { /* quota fail-safe */ }
    },
    async remove({ key }) {
      try { localStorage.removeItem(key) } catch { /* ignore */ }
    },
  }
}

/**
 * Storage adapter compatível com Zustand `createJSONStorage(() => capacitorStorage)`.
 *
 * Zustand chama getItem/setItem/removeItem com chave string e value string JSON.
 * Capacitor Preferences mesma assinatura — wrapper trivial.
 */
export const capacitorStorage = {
  async getItem(name) {
    try {
      const prefs = getPrefsSync()
      const { value } = await prefs.get({ key: name })
      return value ?? null
    } catch (e) {
      console.warn('[persist] getItem FAIL', name, e?.message)
      return null
    }
  },
  async setItem(name, value) {
    try {
      const prefs = getPrefsSync()
      await prefs.set({ key: name, value })
    } catch (e) {
      console.warn('[persist] setItem FAIL', name, e?.message)
    }
  },
  async removeItem(name) {
    try {
      const prefs = getPrefsSync()
      await prefs.remove({ key: name })
    } catch (e) {
      console.warn('[persist] removeItem FAIL', name, e?.message)
    }
  },
}

/**
 * Helper pra limpar TODOS caches Zustand de uma vez (chamado em signOut).
 * Mantém keys aqui pra single source of truth.
 */
export const ZUSTAND_PERSIST_KEYS = [
  'dosy_cache_doses_v1',
  'dosy_cache_patients_v1',
  'dosy_cache_treatments_v1',
]

export async function clearAllZustandCaches() {
  const prefs = getPrefsSync()
  await Promise.all(
    ZUSTAND_PERSIST_KEYS.map((key) => prefs.remove({ key }).catch(() => { /* ignore */ }))
  )
}
