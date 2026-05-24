/**
 * versionedCache.js — DEPRECATED em v0.2.7.0 Fase 4 (Refactor Sync v2).
 *
 * Pre-v0.2.7.0: helpers pra coordenar optimistic patches (_localActedAt stamp)
 * com Realtime/refetch payloads (_serverConfirmedAt). reconcileDoses descartava
 * incoming server data dentro da janela LATENCY_BUDGET_MS.
 *
 * Pós-v0.2.7.0:
 *   - Zustand doseStore + markDose gerenciam optimistic patches diretamente
 *     (_optimistic + _pendingSync flags substituem _localActedAt).
 *   - Realtime simplificado: apenas fetchDashboard debounced, sem aplicar
 *     payload direto no cache.
 *   - Idempotência via request_id PK (mutation_log) resolve race conditions
 *     server-side.
 *
 * useDashboardPayload.js (já deletado em Fase 4) era o único consumer real
 * de reconcileDoses. Mantemos exports como stubs no-op pra qualquer caller
 * legado eventual.
 */

export const LATENCY_BUDGET_MS = 2500

export function shouldAccept(_incoming, _current) {
  // Sem coordenação: server sempre vence. markDose protege via Zustand snapshots
  // antes de patch otimista.
  return true
}

export function reconcileDoses(_cached, incoming) {
  // Identity passthrough — incoming sempre vence (server source of truth).
  return incoming
}
