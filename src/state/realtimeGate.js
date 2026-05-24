/**
 * realtimeGate.js — DEPRECATED em v0.2.7.0 Fase 4 (Refactor Sync v2).
 *
 * Pre-v0.2.7.0: gate em memória bloqueava Realtime postgres_changes de
 * sobrescrever cache TanStack durante mutation optimistic em flight.
 *
 * Pós-v0.2.7.0:
 *   - Realtime apenas agenda fetchDashboard() debounced (useRealtime simplificado).
 *   - Mutations doses (markDose) usam Zustand stores em vez de TanStack cache.
 *   - Idempotência server-side (mutation_log + request_id) cobre race conditions.
 *
 * mutationRegistry.js ainda importa estas funções (mutations não-doses
 * continuam usando o registry). Mantemos exports como no-ops pra não quebrar
 * essas chamadas. Em v0.3.x considerar remoção completa quando mutationRegistry
 * for refatorado também.
 */

// No-ops. Sem state interno, sem TTL.
export function markInFlight(_queryKey, _ttlMs) { /* no-op */ }
export function clearInFlight(_queryKey) { /* no-op */ }
export function isInFlight(_queryKey) { return false }
