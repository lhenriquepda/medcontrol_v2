import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || 'public'

export const hasSupabase = Boolean(URL && KEY)

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
        // Native: encrypted KeyStore. Web: default localStorage (browser session-isolated)
        ...(isNative ? { storage: SecureStorageAdapter } : {}),
        // Required on native — no URL redirect for OAuth in WebView
        detectSessionInUrl: !isNative
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
