/**
 * Cross-browser UUID v4 generator.
 *
 * `crypto.randomUUID()` requires Chrome 92+ / Android WebView 92+.
 * Older Android WebViews (Android 11 with stock WebView, OnePlus 8 Pro etc.)
 * throw `TypeError: crypto.randomUUID is not a function`. Sentry observed
 * crashes in `useToast.show()` and Login error path.
 *
 * Order of preference:
 *   1. crypto.randomUUID() — native, fastest
 *   2. crypto.getRandomValues() — manual RFC 4122 v4 build
 *   3. Math.random() — last resort, NOT cryptographically secure
 */
export function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID() } catch {}
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  // Fallback insecure (only for non-security-critical IDs like toast IDs)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
