import '@testing-library/jest-dom/vitest'

// Polyfills + mocks globais pra ambiente jsdom (sem Capacitor)
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] ?? null },
  setItem(k, v) { this.store[k] = String(v) },
  removeItem(k) { delete this.store[k] },
  clear() { this.store = {} }
}

// Capacitor stub — services importam @capacitor/core
import { vi } from 'vitest'
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web'
  },
  registerPlugin: () => ({})
}))
