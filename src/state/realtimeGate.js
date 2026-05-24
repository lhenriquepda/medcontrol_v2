/**
 * realtimeGate.js — coordenação entre mutations em flight e Realtime invalidates.
 *
 * Refactor Fase 1 (Refactor_Full.md §5).
 *
 * Problema que resolve:
 *   - Mutation otimista marca dose como `done` no cache (onMutate).
 *   - RPC executa server-side; statement-level trigger publica postgres_changes.
 *   - useRealtime debounceia invalidate por 1s; mutationRegistry debounceia refetch por 2s.
 *   - Realtime invalidate dispara ANTES do refetch da mutation → query refetcha
 *     e pode trazer dado pré-commit ou pré-otimista → UI volta status pra
 *     `pending/overdue` por 2-5s.
 *
 * Solução:
 *   - Mutation registra a queryKey afetada como "in flight" no onMutate.
 *   - useRealtime, antes de invalidar, consulta o gate: se key está in-flight,
 *     descarta o payload (vai vir invalidate do próprio onSettled da mutation).
 *   - Cada entrada tem TTL (LATENCY_BUDGET) — auto-expira se onSettled falhar
 *     em limpar (defesa contra leak).
 *
 * Não usa React/Context — singleton módulo. Module state OK aqui:
 *   - Único worker per tab/window (não há SSR).
 *   - Acesso sync (não async — evita race no próprio gate).
 *   - Limpeza centralizada via setInterval de housekeeping.
 */

// v0.2.6.10 FIX B102 H1+H3 — 2500 → 10000ms.
// Diagnóstico v3 (2026-05-24): mutation lifecycle típico mede 5-7s:
//   onMutate (10ms) + RPC (200-2000ms) + onSuccess (10ms) + refetchDoses
//   debounce 1500ms + RPC refetch (200-2000ms) + setQueryData (~10ms).
// TTL 2500ms expirava ANTES do refetch terminar → Realtime/refetch payload
// passava no gate → cache otimista sobrescrito por server stale.
// 10s cobre toda janela. Trade-off: outro device cuidador no mesmo paciente
// vê delay de até 10s em vez de 2.5s — aceitável vs bug crônico data loss.
const LATENCY_BUDGET_MS = 10000

const inFlight = new Map() // serializedKey -> expiresAt (timestamp)

function serializeKey(queryKey) {
  // queryKey pode ser ['doses'] ou ['doses', {filter}] ou string.
  // Stringify estável (Array.isArray + JSON é determinístico pra valores
  // primitivos + objects shallow). Suficiente — não precisa hash criptográfico.
  if (typeof queryKey === 'string') return queryKey
  try { return JSON.stringify(queryKey) } catch { return String(queryKey) }
}

/**
 * Marca queryKey como "mutation em flight". Realtime payloads pra essa key
 * serão descartados até `clearInFlight` ou TTL.
 *
 * Pode chamar múltiplas keys numa mesma mutation:
 *   markInFlight(['dashboard-payload'])
 *   markInFlight(['doses'])
 *
 * TTL é refresh-on-mark (se chamar de novo, expiresAt empurra pra frente).
 */
export function markInFlight(queryKey, ttlMs = LATENCY_BUDGET_MS) {
  const k = serializeKey(queryKey)
  inFlight.set(k, Date.now() + ttlMs)
}

/**
 * Limpa queryKey do gate. Chamar em onSettled (sucesso ou erro).
 *
 * Se a chave não existia, no-op. Não chame em onSuccess sozinho —
 * onError também precisa limpar pra não vazar.
 */
export function clearInFlight(queryKey) {
  const k = serializeKey(queryKey)
  inFlight.delete(k)
}

/**
 * Retorna true se a queryKey está atualmente in-flight.
 * Realtime usa antes de invalidar.
 */
export function isInFlight(queryKey) {
  const k = serializeKey(queryKey)
  const expiresAt = inFlight.get(k)
  if (!expiresAt) return false
  if (Date.now() > expiresAt) {
    inFlight.delete(k)
    return false
  }
  return true
}

/**
 * Housekeeping — limpa entradas expiradas. Chamada periódica via setInterval
 * em main.jsx (ou no-op se módulo só é importado).
 */
export function gcExpired() {
  const now = Date.now()
  for (const [k, expiresAt] of inFlight.entries()) {
    if (now > expiresAt) inFlight.delete(k)
  }
}

/**
 * Inspeção pra testes / debug. NÃO usar em código de produção.
 */
export function _peek() {
  return new Map(inFlight)
}

// GC a cada 5s. Custo desprezível.
if (typeof window !== 'undefined') {
  setInterval(gcExpired, 5000)
}
