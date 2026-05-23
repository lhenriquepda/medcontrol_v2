// v0.2.6.1 P1.10 (Roteiro_Alinhamento_Dosy_v2) — wrapper Sentry.captureException
// pra 121 catches silenciosos.
//
// Antes: catches healthcare-critical (mutationRegistry, scheduler, fcm) usavam
// `} catch {}` ou `console.warn` apenas. Sentry só recebia crashes pelo ErrorBoundary
// → 121 erros silenciosos no hot path.
//
// Agora: `captureCaught(error, context)` em catches críticos com tags + extras.
// strip PII já aplicado em main.jsx beforeSend (P0.3).
//
// API:
//   import { captureCaught } from './sentry'
//   try { ... } catch (e) { captureCaught(e, { source: 'mutationRegistry.confirmDose', extra: { dose_id } }) }

import * as Sentry from '@sentry/react'

let sentryReady = null

function ensureReady() {
  if (sentryReady !== null) return sentryReady
  try {
    sentryReady = Boolean(Sentry.getCurrentHub?.()?.getClient?.())
  } catch {
    sentryReady = false
  }
  return sentryReady
}

export function captureCaught(error, context = {}) {
  if (!error) return
  // No-op em DEV (sem DSN) — evita spam local + economia main.jsx beforeSend already gates on PROD.
  if (!ensureReady()) {
    if (import.meta.env.DEV) {
      console.warn('[captureCaught]', context?.source || '?', '→', error?.message || error)
    }
    return
  }
  try {
    Sentry.captureException(error, {
      tags: {
        source: context.source || 'unknown',
        ...(context.tags || {}),
      },
      extra: context.extra || undefined,
      level: context.level || 'error',
    })
  } catch (e) {
    // Sentry crashou — não pode escalar. Log silencioso.
    if (import.meta.env.DEV) console.warn('[captureCaught] sentry failed:', e?.message)
  }
}

export function addBreadcrumb(crumb) {
  if (!ensureReady()) return
  try {
    Sentry.addBreadcrumb(crumb)
  } catch {}
}
