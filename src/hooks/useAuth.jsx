import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { hasSupabase, supabase, traduzirErro } from '../services/supabase'
import { mock } from '../services/mockStore'

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

  async function signInGoogle() {
    if (hasSupabase) {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
      if (error) throw new Error(traduzirErro(error))
      return
    }
    throw new Error('Login com Google requer Supabase configurado. Use email/senha ou o modo demonstração.')
  }

  async function signInDemo() { await mock.signInDemo() }

  async function signOut() {
    if (hasSupabase) await supabase.auth.signOut()
    else await mock.signOut()
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, signInEmail, signUpEmail, signInGoogle, signInDemo, signOut, updateProfile, hasSupabase }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
