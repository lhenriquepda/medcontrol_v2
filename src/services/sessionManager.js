/**
 * sessionManager.js — Refactor Sync v2 Fase 1 (v0.2.7.0)
 *
 * Centraliza:
 *   1. getValidSession() — garante token JWT válido (refresh proativo se <30s pra expirar)
 *   2. authedRpc() — wrapper de qualquer RPC com timeout duro + getValidSession upfront
 *
 * Princípios (Refactor_Sync_v2.md §2):
 *   P3 — token válido é pré-condição de qualquer RPC
 *   P5 — UI nunca trava esperando rede (timeout 10s hard)
 *
 * Substitui:
 *   - useAppResume heartbeat loop (que detectava 401 mas não chamava refreshSession)
 *   - rpcV2WithAuthRetry em dosesService (sem timeout, hang forever em token zombie)
 */
import { supabase, hasSupabase } from './supabase'

export class AuthLostError extends Error {
  constructor(message = 'Sessão perdida — login necessário') {
    super(message)
    this.name = 'AuthLostError'
    this.code = 'AUTH_LOST'
  }
}

export class TimeoutError extends Error {
  constructor(operation, ms) {
    super(`Operação ${operation} timeout após ${ms}ms`)
    this.name = 'TimeoutError'
    this.code = 'TIMEOUT'
    this.operation = operation
    this.timeoutMs = ms
  }
}

// Margem pra considerar token "quase expirado" e renovar proativamente.
// 30s cobre latency típica de RPC + clock skew razoável.
const TOKEN_EXPIRY_MARGIN_SEC = 30

// Mutex pra evitar refreshSession() concorrentes (Supabase rotaciona refresh_token
// uma vez por chamada — chamadas paralelas geram cadeia inválida → revoke).
let refreshPromise = null
let refreshFailCount = 0
const MAX_REFRESH_FAILS = 2

// Listeners pra emit AuthLostError pra camadas superiores reagirem (UI banner, etc).
const authLostListeners = new Set()
export function onAuthLost(callback) {
  authLostListeners.add(callback)
  return () => authLostListeners.delete(callback)
}
function emitAuthLost(reason) {
  refreshFailCount = 0  // reset pra próximo ciclo de login não acumular
  for (const cb of authLostListeners) {
    try { cb({ reason }) } catch { /* fail-safe */ }
  }
}

/**
 * Retorna sessão Supabase válida. Se token expira em <30s, faz refreshSession() sync.
 * Refresh concorrente é deduplicado via mutex.
 *
 * @returns {Promise<Session>} sessão com access_token válido
 * @throws {AuthLostError} se não há sessão ou refresh falha 2× consecutivas
 */
export async function getValidSession() {
  if (!hasSupabase) {
    throw new AuthLostError('Supabase não configurado')
  }

  // getSession() é LOCAL (lê SecureStorage), não faz network.
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    // Erro lendo storage local — raro, mas trata como auth perdido.
    throw new AuthLostError(`getSession falhou: ${error.message}`)
  }
  if (!session) {
    throw new AuthLostError('Nenhuma sessão ativa')
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const expiresAt = session.expires_at || 0
  const secsUntilExpiry = expiresAt - nowSec

  // Token válido com margem confortável — retorna direto.
  if (secsUntilExpiry > TOKEN_EXPIRY_MARGIN_SEC) {
    return session
  }

  // Token expirado ou quase — força refresh. Mutex evita concorrência.
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

async function doRefresh() {
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      refreshFailCount += 1
      if (refreshFailCount >= MAX_REFRESH_FAILS) {
        emitAuthLost(`refresh falhou ${refreshFailCount}× — ${error.message}`)
        throw new AuthLostError(`refreshSession falhou: ${error.message}`)
      }
      throw new AuthLostError(`refreshSession transient: ${error.message}`)
    }
    if (!data?.session) {
      refreshFailCount += 1
      emitAuthLost('refresh retornou null session')
      throw new AuthLostError('refreshSession retornou null')
    }
    refreshFailCount = 0  // sucesso reseta contador
    return data.session
  } catch (e) {
    if (e instanceof AuthLostError) throw e
    refreshFailCount += 1
    if (refreshFailCount >= MAX_REFRESH_FAILS) {
      emitAuthLost(`refresh exception ${refreshFailCount}× — ${e.message}`)
    }
    throw new AuthLostError(`refreshSession exception: ${e?.message || String(e)}`)
  }
}

/**
 * Wrapper pra qualquer chamada RPC. Garante:
 *   1. Token válido (chama getValidSession internamente)
 *   2. Timeout duro (default 10s — RPC NUNCA pendura forever)
 *
 * @param {string} rpcName — nome da função no schema configurado
 * @param {object} params — parâmetros nomeados (p_*)
 * @param {object} [options]
 * @param {number} [options.timeoutMs=10000]
 * @returns {Promise<any>} payload retornado pela RPC
 * @throws {AuthLostError|TimeoutError|Error}
 */
export async function authedRpc(rpcName, params, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10_000

  await getValidSession()  // pode throw AuthLostError

  const rpcPromise = supabase.rpc(rpcName, params)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new TimeoutError(rpcName, timeoutMs)), timeoutMs)
  })

  const { data, error } = await Promise.race([rpcPromise, timeoutPromise])
  if (error) throw error
  return data
}

// Reset interno pra testes — não usar em produção.
export function _resetForTests() {
  refreshPromise = null
  refreshFailCount = 0
  authLostListeners.clear()
}
