/**
 * versionedCache.js — utilitários pra "versioned cache" de doses.
 *
 * Refactor Fase 1 (Refactor_Full.md §4.1).
 *
 * Quando o cliente faz patch otimista (ex. confirmDose), stampa cada dose
 * patchada com `_localActedAt = Date.now()`. Refetch/Realtime payloads que
 * tentem sobrescrever a dose verificam o stamp:
 *
 *   - Se incoming não tem `_serverConfirmedAt` ou é mais antigo que
 *     `_localActedAt + LATENCY_BUDGET`, otimista vence (incoming descartado).
 *   - Caso contrário, server vence (otimista substituído).
 *
 * Este módulo expõe os helpers; quem decide aplicar é o caller (queryFn select,
 * patchDoseInCache).
 *
 * Trade-off de clock skew:
 *   - `_localActedAt` é Date.now() do device. `_serverConfirmedAt` virá do
 *     RPC retornando `actualTime` (server NOW()).
 *   - Não comparamos timestamps absolutos em sentido estrito. Usamos como
 *     TTL — se o stamp local foi feito recente (<2.5s), respeitamos.
 *   - Se device clock está 5min adiantado, dose stampada agora vai vencer
 *     refetches por 2.5s — comportamento correto.
 *   - Se 5min atrasado, dose stampada agora vai parecer "antiga" → refetch
 *     vence imediato. Pior caso é "status volta", mas é o sintoma original
 *     que estamos tentando evitar. Mitigação: gate (realtimeGate) cobre o
 *     caso comum sem depender de relógio.
 */

// v0.2.6.10 FIX B102 H1 — alinhar com realtimeGate (2500 → 10000ms).
// Mutation lifecycle real mede 5-7s; janela 2.5s expirava cedo → server
// refetch vencia stamp local → dose voltava pra pending.
const LATENCY_BUDGET_MS = 10000

/**
 * Stampa uma dose com timestamp local. Use no onMutate antes de setQueryData.
 * Mutação imutável: retorna NEW object (não muta input).
 */
export function stampLocalActedAt(dose, now = Date.now()) {
  if (!dose) return dose
  return { ...dose, _localActedAt: now }
}

/**
 * Decide se um incoming (Realtime payload ou refetch result) deve substituir
 * a versão atual no cache.
 *
 *   - current.status sem _localActedAt → sempre aceita incoming.
 *   - incoming sem _localActedAt nem _serverConfirmedAt → aceita só se passou
 *     mais que LATENCY_BUDGET desde o stamp local.
 *
 * @param {object} current  dose atual no cache (com _localActedAt opcional)
 * @param {object} incoming dose vinda do server (Realtime payload ou refetch)
 * @returns {boolean}
 */
export function shouldAccept(current, incoming) {
  if (!current) return true
  if (!current._localActedAt) return true

  const sinceLocal = Date.now() - current._localActedAt
  if (sinceLocal > LATENCY_BUDGET_MS) return true

  // Dentro da janela de proteção. Só aceita se server confirma timestamp
  // posterior ao nosso stamp.
  if (incoming?._serverConfirmedAt && incoming._serverConfirmedAt > current._localActedAt) {
    return true
  }

  // Default: protege otimista.
  return false
}

/**
 * Reconcilia array de doses incoming com cache existente.
 * Para cada dose incoming, decide aceitar ou manter cache.
 * Doses no cache mas não no incoming são mantidas (proteção contra refetch
 * com filtro diferente que poderia sumir doses otimistas).
 */
export function reconcileDoses(currentList, incomingList) {
  if (!Array.isArray(currentList)) return incomingList
  if (!Array.isArray(incomingList)) return currentList
  const byId = new Map(currentList.map((d) => [d.id, d]))
  const out = incomingList.map((incoming) => {
    const current = byId.get(incoming.id)
    if (!current) return incoming
    return shouldAccept(current, incoming) ? incoming : current
  })
  // Doses no cache mas não no incoming — preservar se otimista recente
  for (const current of currentList) {
    if (incomingList.find((d) => d.id === current.id)) continue
    if (current._localActedAt && Date.now() - current._localActedAt <= LATENCY_BUDGET_MS) {
      out.push(current)
    }
  }
  return out
}
