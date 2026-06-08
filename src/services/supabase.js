import { createClient, processLock } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'public'

export const hasSupabase = Boolean(URL && KEY)

// v0.2.8.6 #1 (diagnostico_conexao_cronica) — auth debug atrás de flag.
// Liga os markers internos do GoTrueClient ('#_acquireLock begin/end',
// '#__loadSession session has expired', '_callRefreshToken') no console, pra
// capturar o lock-wedge (begin sem end pós-idle) em DEV ou via ?authdebug=1.
// NUNCA liga em prod por default (verbose degrada main thread WebView — catch-22
// documentado v0.2.6.9). Removido/auditado em #11.
const AUTH_DEBUG = (() => {
  try {
    if (import.meta.env.DEV) return true
    if (typeof window !== 'undefined' && /[?&]authdebug=1/.test(window.location.search)) return true
  } catch { /* ignore */ }
  return false
})()

// Storage adapter: KeyStore (Android) / Keychain (iOS) / localStorage (web fallback)
const isNative = Capacitor.isNativePlatform()

const SecureStorageAdapter = {
  getItem: async (key) => {
    try {
      const v = await SecureStorage.get(key)
      return v ?? null
    } catch {
      return null
    }
  },
  setItem: async (key, value) => {
    try { await SecureStorage.set(key, value) } catch {}
  },
  removeItem: async (key) => {
    try { await SecureStorage.remove(key) } catch {}
  }
}

export const supabase = hasSupabase
  ? createClient(URL, KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // v0.2.8.6 #1 — instrumentação temporária (ver AUTH_DEBUG acima).
        debug: AUTH_DEBUG,
        // Native: encrypted KeyStore. Web: default localStorage (browser session-isolated)
        ...(isNative ? { storage: SecureStorageAdapter } : {}),
        // Required on native — no URL redirect for OAuth in WebView
        detectSessionInUrl: !isNative,
        // v0.2.3.6 — processLock substitui navigatorLock default.
        // navigator.locks API fica órfão em StrictMode + remount rápido + WebView
        // background→foreground: orphan lock bloqueia TODAS queries auth-dependentes
        // (skeleton loop infinito Dashboard, SharePatientSheet Carregando..., etc).
        // processLock é mutex em memória do processo, não usa Web Lock API.
        lock: processLock,
        // v0.2.3.6 — lockAcquireTimeout obrigatório p/ Capacitor WebView mobile.
        // Cenário sem timeout (default infinito): JS pausa em background mid-refresh
        // → promise nunca resolve → processLock chain trava → todas auth-dependent
        // queries pending forever quando app resume (skeleton infinito).
        // Com timeout 15s: lock trava → ProcessLockAcquireTimeoutError → supabase-js
        // trata como transient (não dispara SIGNED_OUT) → useAppResume refresh retry.
        // User "fica logado pra sempre" — token interno renova silencioso, percepção
        // é de sessão eterna até deslogar manual.
        lockAcquireTimeout: 15_000
      },
      db: { schema: SCHEMA },
      // Item #079 (release v0.1.7.1) — heartbeat explicit + reconnect rápido.
      // Defense-in-depth caminho 1: detectar websocket morto durante idle longo
      // (Android Doze + OS network management matam silently após ~10-15min).
      // Default supabase-js: 30s heartbeat, reconnect lento. Mantemos 30s mas
      // forçamos reconnectAfterMs custom com backoff agressivo.
      realtime: {
        heartbeatIntervalMs: 30_000,
        reconnectAfterMs: (tries) => Math.min(1_000 * Math.pow(2, tries), 30_000)
      }
    })
  : null

// ─────────────────────────────────────────────────────────────────────────────
// v0.2.8.6 #5 (diagnostico_conexao_cronica) — DUAL-CLIENT: cliente de DADOS
// separado, lock-free.
//
// ROOT CAUSE que isto resolve: no cliente único, TODA RPC PostgREST monta o
// header Authorization via fetchWithAuth → _getAccessToken → auth.getSession()
// → _acquireLock (o MESMO mutex em memória que o refreshSession). Quando um
// refresh pendura em background (WebView/aba congelada mid-fetch), o lock fica
// retido e toda query trava ou cai pra Bearer anon (RLS nega) — "perde conexão
// com o BD" até reload. Confirmado em @supabase/auth-js 2.103.3
// (GoTrueClient.js getSession→_acquireLock→__loadSession→_callRefreshToken inline)
// + supabase-js index.cjs:108,519-524.
//
// FIX: com a opção `accessToken` custom (index.cjs:379-388,519-524), o
// _getAccessToken do cliente de dados retorna `await accessToken()` SEM chamar
// getSession nem _acquireLock — eliminando o acoplamento auth↔dados na raiz.
// O provider (registrado pelo sessionManager via setDataTokenProvider) lê uma
// sessão em CACHE (sem lock) e só refresca perto da expiração, com timeout +
// fallback pro token cacheado (válido server-side até a margem) — o dado NUNCA
// trava esperando o lock de auth.
//
// IMPORTANTE: `accessToken` custom transforma `supabaseData.auth.*` num Proxy
// que LANÇA (index.cjs:385) e desativa _listenForAuthEvents (index.cjs:402).
// Por isso é um SEGUNDO cliente: o `supabase` acima continua sendo a ÚNICA fonte
// de auth (login/sessão/refresh/onAuthStateChange/signOut) E de realtime
// (auth-js auto-propaga token ao realtime via _handleTokenChanged no refresh).
// O `supabaseData` é só PostgREST de dados.
// ─────────────────────────────────────────────────────────────────────────────

// Provider injetado tardiamente pelo sessionManager (evita ciclo de import:
// supabase.js NÃO importa sessionManager). Default seguro: sem token → Bearer
// anon (só ocorre antes do sessionManager carregar, i.e. nunca no hot path real).
let _dataTokenProvider = async () => null
export function setDataTokenProvider(fn) {
  if (typeof fn === 'function') _dataTokenProvider = fn
}

export const supabaseData = hasSupabase
  ? createClient(URL, KEY, {
      db: { schema: SCHEMA },
      // _getAccessToken retorna await this.accessToken() — sem getSession/lock.
      accessToken: () => _dataTokenProvider(),
    })
  : null

// Traduz mensagens comuns de erro para pt-BR
export function traduzirErro(err) {
  if (!err) return 'Erro desconhecido.'
  const msg = typeof err === 'string' ? err : err.message || ''
  const map = [
    [/invalid login credentials/i, 'Credenciais inválidas. Verifique email e senha.'],
    [/email not confirmed/i, 'Email ainda não confirmado.'],
    [/user already registered/i, 'Este email já está cadastrado.'],
    [/password should be at least/i, 'Senha muito curta. Use pelo menos 6 caracteres.'],
    [/network/i, 'Sem conexão com a internet.'],
    [/not authenticated/i, 'Você precisa estar logado para continuar.'],
    [/row-level security/i, 'Permissão negada para acessar estes dados.'],
    // #153 (release v0.2.0.12) — tradução erros OTP recovery
    [/(invalid|expired|incorrect).*(otp|token|code)/i, 'Código inválido ou expirado. Confira o código no email ou peça um novo.'],
    [/token has expired/i, 'Código expirado. Peça um novo código.'],
    [/(otp|token).*not.*found/i, 'Código não encontrado. Peça um novo.'],
    [/email rate limit/i, 'Muitas solicitações. Aguarde 1 minuto e tente novamente.'],
    [/over.*request.*rate.*limit/i, 'Muitas tentativas. Aguarde alguns minutos.'],
    [/user not found/i, 'Email não cadastrado.'],
    [/signup.*disabled|disabled signup/i, 'Cadastros desativados. Contato suporte.']
  ]
  for (const [re, pt] of map) if (re.test(msg)) return pt
  return 'Ocorreu um erro. Tente novamente.'
}
