import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { hasSupabase, supabase, traduzirErro } from '../services/supabase'
import { mock } from '../services/mockStore'
import { identifyUser, resetUser } from '../services/analytics'
import { setSyncCredentials, clearSyncCredentials } from '../services/criticalAlarm'

const isNative = Capacitor.isNativePlatform()
// Deep link Capacitor (manifest dosy:// already configured) OR https web origin
const OAUTH_REDIRECT = isNative
  ? 'dosy://auth/callback'
  : (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined)

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const qc = useQueryClient()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = () => {}
    async function init() {
      if (hasSupabase) {
        const { data } = await supabase.auth.getSession()
        const initialUser = data.session?.user || null
        setUser(initialUser)
        if (initialUser?.id) identifyUser(initialUser.id)
        const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
          const u = s?.user || null
          setUser(u)
          if (u?.id) identifyUser(u.id)
          else resetUser()
          qc.clear() // limpa cache (tier, patients, doses...) ao trocar de usuário

          // Item #081 (release v0.1.7.1) — propaga credentials pro DoseSyncWorker
          // (Android background) sempre que session muda. Worker precisa do
          // refresh_token atualizado pra fetch autenticado em background.
          if (s?.user?.id && s?.refresh_token && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
            setSyncCredentials({
              supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
              anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              userId: s.user.id,
              refreshToken: s.refresh_token,
              schema: import.meta.env.VITE_SUPABASE_SCHEMA || 'medcontrol'
            }).catch((e) => console.warn('[useAuth] setSyncCredentials err:', e?.message))
          } else if (event === 'SIGNED_OUT') {
            clearSyncCredentials().catch((e) => console.warn('[useAuth] clearSyncCredentials err:', e?.message))
          }
        })
        unsub = () => sub.subscription.unsubscribe()
      } else {
        setUser(mock.get().user)
        const off = mock.subscribe(() => setUser(mock.get().user))
        unsub = off
      }
      setLoading(false)
    }
    init()
    return () => unsub()
  }, [qc])

  async function signInEmail(email, password) {
    if (hasSupabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(traduzirErro(error))
      return
    }
    await mock.signInLocal(email, password)
  }

  async function signUpEmail(email, password, name = '') {
    if (hasSupabase) {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name: name.trim() || null } }
      })
      if (error) throw new Error(traduzirErro(error))
      // Detecção de email duplicado: Supabase retorna user sem identidades em vez de erro.
      const identities = data?.user?.identities
      if (data?.user && Array.isArray(identities) && identities.length === 0) {
        throw new Error('Este email já está cadastrado. Use a aba Entrar.')
      }
      // Se auto-confirm está ativo, já logamos direto. Senão o trigger confirma no DB
      // e fazemos o login imediatamente.
      if (!data.session) {
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password })
        if (e2) throw new Error(traduzirErro(e2))
      }
      return
    }
    await mock.signUpLocal(email, password, name)
  }

  async function updateProfile({ name }) {
    if (hasSupabase) {
      const { data, error } = await supabase.auth.updateUser({ data: { name: (name || '').trim() || null } })
      if (error) throw new Error(traduzirErro(error))
      if (data?.user) setUser(data.user)
      return
    }
    mock.updateProfile({ name })
  }

  // OAuth (Google/Facebook) — código mantido pra reativar quando providers
  // estiverem configurados em Supabase Dashboard. Atualmente desabilitado da UI.
  async function signInOAuth(provider) {
    if (!hasSupabase) {
      throw new Error(`Login com ${provider} requer Supabase configurado. Use email/senha ou modo demonstração.`)
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: OAUTH_REDIRECT,
        skipBrowserRedirect: isNative
      }
    })
    if (error) throw new Error(traduzirErro(error))
    if (isNative && data?.url) {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: data.url, presentationStyle: 'popover' })
    }
  }

  async function signInGoogle() { return signInOAuth('google') }
  async function signInFacebook() { return signInOAuth('facebook') }

  /**
   * Send password reset email. Email contains link to /reset-password where
   * user types new password (page calls updatePassword).
   */
  async function resetPassword(email) {
    if (!hasSupabase) {
      throw new Error('Recuperação de senha requer Supabase configurado.')
    }
    if (!email || !email.includes('@')) {
      throw new Error('Informe um email válido.')
    }
    const redirectTo = isNative
      ? 'dosy://reset-password'
      : `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw new Error(traduzirErro(error))
  }

  /**
   * Update password for the currently authenticated user (used by reset-password page
   * after the recovery link logs the user in temporarily).
   */
  async function updatePassword(newPassword) {
    if (!hasSupabase) {
      throw new Error('Atualização de senha requer Supabase configurado.')
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(traduzirErro(error))
  }

  async function signInDemo() { await mock.signInDemo() }

  async function signOut() {
    if (hasSupabase) await supabase.auth.signOut()
    else await mock.signOut()
    // Limpar dados locais sensíveis ao sair
    localStorage.removeItem('medcontrol_notif')
    localStorage.removeItem('dashCollapsed')
    setUser(null)
    // Limpa cache de queries pra evitar stale data (ex: tier=plus persistir
    // após logout, mantendo banner ad na tela de Login)
    qc.clear()
  }

  return (
    <AuthCtx.Provider value={{
      user, loading,
      signInEmail, signUpEmail,
      signInGoogle, signInFacebook,   // disponíveis (UI desabilitada por ora)
      signInDemo,
      resetPassword, updatePassword,
      signOut, updateProfile,
      hasSupabase
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
