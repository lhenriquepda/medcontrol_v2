/**
 * sessionManager.js — Refactor Sync v2 Fase 1 (v0.2.7.0)
 *   + v0.2.8.6 Dual-client lock-free (diagnostico_conexao_cronica)
 *
 * Centraliza:
 *   1. getValidSession() — garante token JWT válido (refresh proativo se <90s pra expirar),
 *      LOCK-FREE: lê uma sessão em cache (primada por onAuthStateChange), só toca o
 *      storage/lock no cold path (boot antes do listener disparar).
 *   2. getDataAccessToken() — provider do cliente de dados (supabaseData). Lock-free,
 *      com timeout + fallback pro token cacheado: o caminho de DADOS nunca trava
 *      esperando o lock de auth.
 *   3. authedRpc() — wrapper de qualquer RPC com timeout duro, rodando no supabaseData
 *      (cliente de dados lock-free, accessToken custom).
 *
 * ROOT CAUSE histórico (v0.2.8.6 — ver docs/diagnostico_conexao_cronica.md):
 *   No cliente único, supabase.rpc() → fetchWithAuth → _getAccessToken →
 *   auth.getSession() → _acquireLock (o MESMO mutex do refreshSession). Um refresh
 *   pendurado em background retinha o lock → toda RPC travava ou caía pra Bearer anon
 *   (RLS nega) → "perde conexão com o BD" até reload. Margem divergente (30s aqui vs
 *   90s no auth-js) re-armava o gatilho a cada ciclo idle. Este arquivo desacopla
 *   auth de dados (supabaseData lock-free) e alinha a margem a 90s.
 *
 * Princípios (Refactor_Sync_v2.md §2):
 *   P3 — token válido é pré-condição de qualquer RPC
 *   P5 — UI nunca trava esperando rede (timeout duro)
 */
import { supabase, supabaseData, hasSupabase, setDataTokenProvider } from './supabase'

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

// v0.2.8.6 #3 — margem alinhada ao EXPIRY_MARGIN_MS do auth-js (3×30s = 90s).
// Antes era 30s: na janela 30-90s, getValidSession dizia "ok" e seguia, mas a
// montagem do header (auth-js, margem 90s) disparava um refresh INLINE sob lock.
// Com 90s, refrescamos PROATIVAMENTE (via doRefresh, mutex) antes do auth-js tentar.
const TOKEN_EXPIRY_MARGIN_SEC = 90

// Mutex pra evitar refreshSession() concorrentes (Supabase rotaciona refresh_token
// uma vez por chamada — chamadas paralelas geram cadeia inválida → revoke).
let refreshPromise = null

// Contador de falhas de refresh. v0.2.8.6 #7 — agora com DECAY temporal: 2 falhas
// transitórias (rádio acordando pós-background) só disparam AuthLost se ocorrerem
// dentro de uma janela curta. Antes era global-sem-decay → glitches isolados
// acumulavam e deslogavam o user.
let refreshFailCount = 0
let lastRefreshFailAt = 0
const MAX_REFRESH_FAILS = 2
const REFRESH_FAIL_DECAY_MS = 5 * 60 * 1000

// v0.2.8.6 #5 — sessão em CACHE (lock-free). Primada por useAuth.onAuthStateChange
// (INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED) via primeAuthSession e atualizada
// internamente no doRefresh. É um read-through do cliente de auth (fonte da verdade),
// que permite servir o access_token SEM adquirir o lock de auth.
let cachedSession = null

/** Atualiza o cache de sessão. Chamado por useAuth no onAuthStateChange. */
export function primeAuthSession(session) {
  cachedSession = session || null
}

/** Limpa o cache + contadores. Chamado em signOut. */
export function clearAuthSession() {
  cachedSession = null
  refreshFailCount = 0
  lastRefreshFailAt = 0
}

// Listeners pra emit AuthLostError pra camadas superiores reagirem (UI banner, etc).
const authLostListeners = new Set()
export function onAuthLost(callback) {
  authLostListeners.add(callback)
  return () => authLostListeners.delete(callback)
}
function emitAuthLost(reason) {
  refreshFailCount = 0  // reset pra próximo ciclo de login não acumular
  lastRefreshFailAt = 0
  for (const cb of authLostListeners) {
    try { cb({ reason }) } catch { /* fail-safe */ }
  }
}

// v0.2.8.6 #7 — incrementa fail com decay: se a última falha foi há >5min, o
// contador reseta antes de incrementar (falhas isoladas não somam pra signOut).
function noteRefreshFail() {
  const now = Date.now()
  if (now - lastRefreshFailAt > REFRESH_FAIL_DECAY_MS) refreshFailCount = 0
  lastRefreshFailAt = now
  refreshFailCount += 1
  return refreshFailCount
}

function secsUntilExpiry(session) {
  const nowSec = Math.floor(Date.now() / 1000)
  return (session?.expires_at || 0) - nowSec
}

/**
 * Retorna sessão Supabase válida. LOCK-FREE no caminho quente: lê cachedSession
 * (primado por onAuthStateChange). Só chama supabase.auth.getSession() (que toca
 * o storage/lock) no cold path — quando o cache ainda não foi primado (boot).
 * Se token expira em <90s, faz refresh (mutex). Refresh concorrente é deduplicado.
 *
 * @returns {Promise<Session>} sessão com access_token válido
 * @throws {AuthLostError} se não há sessão ou refresh falha 2× consecutivas
 */
export async function getValidSession() {
  if (!hasSupabase) {
    throw new AuthLostError('Supabase não configurado')
  }

  let session = cachedSession
  if (!session) {
    // Cold path (boot, antes do onAuthStateChange primar). getSession() é LOCAL
    // (lê storage) mas adquire o lock de auth — aceitável 1× no boot (cliente fresco,
    // sem wedge). Após isso o cache cobre tudo lock-free.
    const { data: { session: s } = { session: null }, error } = await supabase.auth.getSession()
    if (error) {
      throw new AuthLostError(`getSession falhou: ${error.message}`)
    }
    session = s || null
    cachedSession = session
  }
  if (!session) {
    throw new AuthLostError('Nenhuma sessão ativa')
  }

  // Token válido com margem confortável (>90s) — retorna direto, sem lock nem rede.
  if (secsUntilExpiry(session) > TOKEN_EXPIRY_MARGIN_SEC) {
    return session
  }

  // Token expirado ou quase — força refresh. Mutex evita concorrência.
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// v0.2.7.0 hardening — refreshSession() pode pendurar indefinido (processLock
// zombie observado em prod, especialmente pós-WebView pause). Wrap em timeout
// pra forçar fail-fast em vez de bloquear a stack de auth. Nota v0.2.8.6: com o
// dual-client, um refresh pendurado NÃO trava mais o caminho de dados (que usa
// o token cacheado via getDataAccessToken), então este timeout é defesa do
// caminho de AUTH (resume/heartbeat), não mais do hot path de dados.
const REFRESH_TIMEOUT_MS = 8_000

async function doRefresh() {
  try {
    const refreshNetwork = supabase.auth.refreshSession()
    const refreshTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('refreshSession timeout 8s')), REFRESH_TIMEOUT_MS)
    })
    const { data, error } = await Promise.race([refreshNetwork, refreshTimeoutPromise])
    if (error) {
      const n = noteRefreshFail()
      if (n >= MAX_REFRESH_FAILS) {
        emitAuthLost(`refresh falhou ${n}× — ${error.message}`)
        throw new AuthLostError(`refreshSession falhou: ${error.message}`)
      }
      throw new AuthLostError(`refreshSession transient: ${error.message}`)
    }
    if (!data?.session) {
      noteRefreshFail()
      emitAuthLost('refresh retornou null session')
      throw new AuthLostError('refreshSession retornou null')
    }
    refreshFailCount = 0  // sucesso reseta contador
    lastRefreshFailAt = 0
    cachedSession = data.session  // v0.2.8.6 #5 — mantém o cache lock-free atualizado
    return data.session
  } catch (e) {
    if (e instanceof AuthLostError) throw e
    const n = noteRefreshFail()
    if (n >= MAX_REFRESH_FAILS) {
      emitAuthLost(`refresh exception ${n}× — ${e.message}`)
    }
    throw new AuthLostError(`refreshSession exception: ${e?.message || String(e)}`)
  }
}

// v0.2.8.6 #5 — PROVIDER lock-free do cliente de dados (supabaseData).
// Chamado pelo supabase-js em CADA request de dados pra montar o header
// Authorization (index.cjs:519-522: _getAccessToken → await accessToken()).
// NUNCA chama getSession()/_acquireLock no caminho quente. Timeout+fallback:
// se o refresh pendura, devolve o token cacheado (válido server-side até a margem
// de 90s) — o dado nunca trava. Quando o token já passou da validade e o refresh
// falha, devolve o cacheado mesmo assim (server retorna 401 → markDose mantém na
// fila → drain reentra; degradação graciosa, NÃO wedge).
const DATA_TOKEN_REFRESH_RACE_MS = 6_000

export async function getDataAccessToken() {
  try {
    let session = cachedSession
    if (!session) {
      const { data: { session: s } = { session: null } } = await supabase.auth.getSession()
      session = s || null
      cachedSession = session
    }
    if (!session) return null  // deslogado → supabaseData manda Bearer anon (RLS nega; esperado)

    if (secsUntilExpiry(session) > TOKEN_EXPIRY_MARGIN_SEC) {
      return session.access_token
    }

    // Perto de expirar: refresca (mutex compartilhado com getValidSession), mas
    // com timeout — o dado não espera o lock de auth pendurar.
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => { refreshPromise = null })
    }
    const refreshed = await Promise.race([
      refreshPromise.catch(() => null),
      new Promise((r) => setTimeout(() => r(null), DATA_TOKEN_REFRESH_RACE_MS)),
    ])
    return (refreshed && refreshed.access_token) || cachedSession?.access_token || null
  } catch {
    // Qualquer falha → melhor esforço com o token cacheado (deixa o server decidir).
    return cachedSession?.access_token || null
  }
}

// Registra o provider no cliente de dados (injeção tardia evita ciclo de import).
setDataTokenProvider(getDataAccessToken)

/**
 * Wrapper pra qualquer chamada RPC. Garante:
 *   1. Token válido (chama getValidSession internamente — lock-free)
 *   2. Roda no supabaseData (cliente de dados lock-free, v0.2.8.6 #5)
 *   3. Timeout duro (default 10s — RPC NUNCA pendura forever)
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

  const wrappedPromise = (async () => {
    // v0.2.8.6 #1 — instrumentação: mede latência do getValidSession. Wedge do lock
    // se manifestava como ~15s aqui (lockAcquireTimeout) com internet OK. Warn raro
    // (>5s é anômalo), não polui hot path normal.
    const t0 = Date.now()
    await getValidSession()  // pode throw AuthLostError — lock-free no caminho quente
    const dt = Date.now() - t0
    if (dt > 5_000) {
      console.warn(`[authedRpc] getValidSession lento: ${dt}ms (rpc=${rpcName}) — possível lock-wedge de auth`)
    }
    // v0.2.8.6 #5 — usa o cliente de DADOS lock-free (accessToken custom).
    const client = supabaseData || supabase
    const { data, error } = await client.rpc(rpcName, params)
    if (error) throw error
    return data
  })()

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new TimeoutError(rpcName, timeoutMs)), timeoutMs)
  })

  return Promise.race([wrappedPromise, timeoutPromise])
}

// Reset interno pra testes — não usar em produção.
export function _resetForTests() {
  refreshPromise = null
  refreshFailCount = 0
  lastRefreshFailAt = 0
  cachedSession = null
  authLostListeners.clear()
}
