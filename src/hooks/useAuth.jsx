import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { hasSupabase, supabase, traduzirErro } from '../services/supabase'
import { mock } from '../services/mockStore'

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
        setUser(data.session?.user || null)
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
          setUser(s?.user || null)
          qc.clear() // limpa cache (tier, patients, doses...) ao trocar de usuário
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
