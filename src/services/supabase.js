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
      db: { schema: SCHEMA }
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
    [/row-level security/i, 'Permissão negada para acessar estes dados.']
  ]
  for (const [re, pt] of map) if (re.test(msg)) return pt
  return 'Ocorreu um erro. Tente novamente.'
}
