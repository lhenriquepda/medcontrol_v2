import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { hasSupabase, supabase, traduzirErro } from '../services/supabase'
import { mock } from '../services/mockStore'
import { identifyUser, resetUser } from '../services/analytics'
import { setSyncCredentials, clearSyncCredentials } from '../services/criticalAlarm'
import { logAuthEvent } from '../services/authTelemetry'

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
        if (initialUser?.id) {
          identifyUser(initialUser.id)
          // Item #201 (release v0.2.1.5) — registra "abriu app com sessão salva".
          // User não digitou nada; sessão veio do cache local. Distingue de login real.
          logAuthEvent('sign_in', {
            details: {
              tipo: 'sessao_restaurada',
              descricao: 'Abriu o app e a sessão já estava salva (não digitou senha)'
            }
          }).catch(() => { /* fail-safe */ })
        }
        // Item #123 (release v0.2.0.3): valida session no boot. JWT pode ter
        // sido invalidado server-side (user deletado, banned, etc) sem evento
        // local. supabase.auth.getUser() bate na API e retorna erro se token
        // não vale mais → forçar signOut local pra limpar cache stale.
        //
        // Item #159 (release v0.2.1.1) FIX BUG-LOGOUT: distinguir transient
        // errors (network slow, timeout, 5xx) vs real auth failures (401/403
        // JWT invalid). Implementação anterior (#123) deslogava em QUALQUER
        // erro — incluindo flutuações network mobile que são frequentes em
        // Android cold start. Resultado: user deslogado toda vez que abria app
        // com network instável. Agora: signOut só se evidência forte de JWT
        // inválido (status 401/403 OR mensagem contém "jwt"/"token expired"/
        // "user not found"). Outros erros: preservar session local, retry no
        // próximo boot. Trade-off aceitável: user com session realmente revogada
        // continua com cache stale até próxima request 401 (que dispara signOut
        // via auth.onAuthStateChange normalmente).
        if (initialUser) {
          try {
            const { data: u, error } = await supabase.auth.getUser()
            if (error || !u?.user) {
              const errMsg = error?.message || ''
              const errStatus = error?.status
              const isAuthFailure =
                errStatus === 401 ||
                errStatus === 403 ||
                /jwt|token.*expired|user.*not.*found|invalid.*claim|invalid.*token/i.test(errMsg)
              if (isAuthFailure) {
                console.warn('[useAuth] session invalid on boot (auth failure), signing out:', errMsg, 'status:', errStatus)
                await supabase.auth.signOut()
                setUser(null)
                qc.clear()
                try {
                  localStorage.removeItem('medcontrol_notif')
                  localStorage.removeItem('dashCollapsed')
                } catch { /* ignore */ }
              } else {
                // Transient (network slow / timeout / 5xx) — preservar session local.
                // Próximo boot OU próxima request authenticada vai re-validar.
                console.warn('[useAuth] getUser transient error (keeping session):', errMsg, 'status:', errStatus)
              }
            }
          } catch (e) {
            // Network exception (offline) — preservar session local.
            console.warn('[useAuth] getUser network exception (keeping session):', e?.message)
          }
        }
        const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
          const u = s?.user || null
          const prevUserId = user?.id

          // Item #196 (release v0.2.1.5) — SIGNED_OUT spurious detection.
          // Extends #159 (boot getUser) + #190 (useAppResume.refreshSession):
          // listener captura QUALQUER SIGNED_OUT do Supabase JS — incluindo
          // transient/spurious (refresh loops, WebSocket disconnects, internal
          // cleanups). Sem esse check, network glitch dispara setUser(null) →
          // user vê tela de login mesmo session local ainda válida.
          //
          // Estratégia: se SIGNED_OUT NÃO foi disparado por logout explícito
          // (botão Sair seta flag `dosy_explicit_logout`), valida com getSession()
          // se session local ainda existe. Se sim, é spurious — ignora event
          // completo (sem setUser(null), sem qc.clear, sem DELETE push_sub).
          if (event === 'SIGNED_OUT') {
            const explicitLogout = localStorage.getItem('dosy_explicit_logout') === '1'
            if (!explicitLogout) {
              try {
                const { data: { session: stillValid } } = await supabase.auth.getSession()
                if (stillValid?.user) {
                  console.warn('[useAuth] SIGNED_OUT spurious — session still valid locally, ignoring')
                  // Item #201 — registra evento spurious pra análise no painel admin
                  logAuthEvent('sign_out_spurious_ignored', {
                    logoutKind: 'transient_ignored',
                    details: { source: 'onAuthStateChange' }
                  }).catch(() => { /* fail-safe */ })
                  return
                }
              } catch (e) {
                console.warn('[useAuth] SIGNED_OUT getSession check exception:', e?.message)
              }
            }
          }

          // Item #195 (release v0.2.1.5) — limpar flag stale em SIGNED_IN.
          // Edge case: signOut() seta flag mas listener nunca processou SIGNED_OUT
          // (rare). Flag persiste em localStorage. Próximo login com flag stale
          // deixaria SIGNED_OUT spurious futuro ser tratado como real → DELETE
          // push_sub indevido. Limpar em SIGNED_IN garante state fresco.
          if (event === 'SIGNED_IN') {
            try { localStorage.removeItem('dosy_explicit_logout') } catch { /* ignore */ }
          }
          // Item #201 (release v0.2.1.5) — telemetria sign_in foi MOVIDA do listener
          // pra signInEmail()/signInOAuth(). Listener SIGNED_IN também fire em session
          // restore de cache (abrir app fechado), gerando false positive. Logar só em
          // login real com credenciais.

          setUser(u)
          if (u?.id) identifyUser(u.id)
          else resetUser()
          // #144 (release v0.2.0.12) — qc.clear SCOPED:
          // Antes: clear em todo onAuthStateChange (incluindo TOKEN_REFRESHED).
          // Cascade quebrava: hook tier → JWT refresh → TOKEN_REFRESHED → qc.clear
          // → useMyTier remount → reload tier → infinite loop.
          // Agora: clear só em troca real de user (SIGNED_IN com user diff)
          // ou SIGNED_OUT. TOKEN_REFRESHED preserva cache (mesmo user, mesmo dado).
          if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && prevUserId && prevUserId !== u?.id)) {
            qc.clear()
          }

          // Item #081 (release v0.1.7.1) — propaga credentials pro DoseSyncWorker
          // (Android background) sempre que session muda.
          // Item #205 (release v0.2.1.8) — agora propaga access_token + exp pra
          // Worker consumir token cached em vez de chamar /auth/v1/token paralelo.
          // JS é ÚNICA fonte refresh (storm xx:00 fix).
          if (s?.user?.id && s?.refresh_token && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
            const accessToken = s?.access_token || null
            const expiresAt = s?.expires_at ? Number(s.expires_at) * 1000 : null // s.expires_at é epoch seconds
            setSyncCredentials({
              supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
              anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              userId: s.user.id,
              refreshToken: s.refresh_token,
              accessToken,
              accessTokenExp: expiresAt,
              schema: import.meta.env.VITE_SUPABASE_SCHEMA || 'medcontrol'
            }).catch((e) => console.warn('[useAuth] setSyncCredentials err:', e?.message))

            // Item #098 — re-bind FCM deviceToken cached ao novo user.
            // Listener PushNotifications 'registration' só dispara em install/
            // refresh do FCM token; troca de user (logout→login) não refire,
            // deixando push_subscriptions com userId antigo. Aqui força upsert
            // RPC com cached token → DELETE other-user subs + INSERT pro user
            // atual. Resolve push de user A chegar em device logado user B
            // (que quebrava refresh chain → logout sozinho).
            if (event === 'SIGNED_IN' && isNative) {
              try {
                const cachedToken = localStorage.getItem('dosy_fcm_token')
                if (cachedToken) {
                  supabase.schema('medcontrol').rpc('upsert_push_subscription', {
                    p_device_token: cachedToken,
                    p_platform: 'android',
                    p_advance_mins: 15,
                    p_user_agent: 'capacitor-android',
                  }).then(({ error }) => {
                    if (error) console.warn('[useAuth] re-upsert push_sub err:', error.message)
                    else console.log('[useAuth] push_sub re-bound to user', s.user.id)
                  })
                }
              } catch (e) { console.warn('[useAuth] re-upsert push_sub catch:', e?.message) }
            }
          } else if (event === 'SIGNED_OUT') {
            // Item #195 (release v0.2.1.5) — só DELETAR push_subscription se
            // logout foi explícito (botão Sair). Antes deletava em qualquer
            // SIGNED_OUT — quebrava reagendamento próximo cron schedule-alarms-fcm
            // quando bug logout transient/spurious acontecia (combinado com #196
            // protection acima, esse caminho só roda em logout REAL).
            const explicitLogout = localStorage.getItem('dosy_explicit_logout') === '1'
            // Item #201 — telemetria de logout REAL feita aqui (caminho
            // SIGNED_OUT não-explícito = token revogado/inválido). Logout
            // explícito é registrado dentro de signOut() ANTES de chamar
            // supabase.auth.signOut(), pois aqui auth.uid() já é null e RPC
            // log_auth_event falharia com AUTH_REQUIRED.
            // NOTA: real_invalid_token NÃO consegue logar (sessão zerada).
            // Trade-off aceito — caso raro e debugável via Sentry.
            if (!explicitLogout) {
              console.warn('[useAuth] SIGNED_OUT real_invalid_token — telemetria não registrada (auth.uid() null)')
            }
            if (explicitLogout) {
              clearSyncCredentials().catch((e) => console.warn('[useAuth] clearSyncCredentials err:', e?.message))

              // Item #098 — limpar push_subscription deste device do user que saiu
              // (precisa rodar ANTES do auth.signOut completar o cache clear).
              // Best-effort: se token cached + user atual disponível, delete sub.
              try {
                const cachedToken = localStorage.getItem('dosy_fcm_token')
                if (cachedToken) {
                  supabase.schema('medcontrol').from('push_subscriptions')
                    .delete().eq('deviceToken', cachedToken)
                    .then(({ error }) => {
                      if (error) console.warn('[useAuth] cleanup push_sub err:', error.message)
                    })
                }
              } catch (e) { console.warn('[useAuth] cleanup push_sub catch:', e?.message) }

              // Limpa flag pra próximos eventos serem avaliados frescos
              try { localStorage.removeItem('dosy_explicit_logout') } catch { /* ignore */ }
            } else {
              console.warn('[useAuth] SIGNED_OUT without explicit logout flag — preserving push_subscription + sync credentials (extends #195)')
            }
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
      // Item #201 — registra login real (digitou email + senha e clicou Entrar).
      // Aqui auth.uid() já está disponível pois signInWithPassword retornou OK.
      logAuthEvent('sign_in', {
        details: {
          tipo: 'login_email_senha',
          descricao: 'Digitou email e senha e clicou em Entrar'
        }
      }).catch(() => { /* fail-safe */ })
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
      // Item #201 — registra criação de conta + login automático
      logAuthEvent('sign_in', {
        details: {
          tipo: 'criou_conta_nova',
          descricao: 'Criou conta nova e entrou pela primeira vez'
        }
      }).catch(() => { /* fail-safe */ })
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
   * #147 BUG-041 LEGACY (parqueado) — Send password reset email via magic link.
   * Quebrado em prod (link aponta localhost). Mantido pra retrocompat até v0.2.1.0.
   * Use `sendRecoveryOtp` + `verifyRecoveryOtp` (#153 v0.2.0.12) em vez disso.
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
   * #153 (release v0.2.0.12) — Recovery via OTP code 6 dígitos por email.
   * Substitui magic-link broken (#147 BUG-041). Supabase envia código no email
   * (configurado via Auth → Email Templates → "Magic Link" custom usando {{ .Token }}).
   */
  async function sendRecoveryOtp(email) {
    if (!hasSupabase) throw new Error('Recuperação requer Supabase configurado.')
    if (!email || !email.includes('@')) throw new Error('Informe um email válido.')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (error) throw new Error(traduzirErro(error))
  }

  /**
   * #153 — Verifica OTP enviado por email. Cria sessão. Marca flag localStorage
   * pra AppShell abrir ForceNewPasswordModal automático após redirect Dashboard.
   */
  async function verifyRecoveryOtp(email, token) {
    if (!hasSupabase) throw new Error('Recuperação requer Supabase configurado.')
    if (!email || !token) throw new Error('Email e código obrigatórios.')
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    if (error) throw new Error(traduzirErro(error))
    // Flag pra forçar troca senha pós-recovery (consumido por AppShell)
    try { localStorage.setItem('dosy_force_password_change', '1') } catch { /* ignore */ }
    // Item #201 — registra recuperação de senha bem-sucedida
    logAuthEvent('sign_in', {
      details: {
        tipo: 'recuperacao_senha',
        descricao: 'Recuperou a senha pelo código enviado por email'
      }
    }).catch(() => { /* fail-safe */ })
    return data
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
    // Item #195 (release v0.2.1.5) — marcar logout como explícito ANTES
    // de chamar supabase.auth.signOut(). Isso permite ao listener
    // onAuthStateChange (acima) distinguir SIGNED_OUT real (botão Sair) de
    // SIGNED_OUT transient/spurious (network glitch, refresh loop interno).
    // Em logout real, push_subscription é deletada + sync credentials limpas.
    // Em transient, tudo é preservado pra reagendar alarme corretamente.
    try { localStorage.setItem('dosy_explicit_logout', '1') } catch { /* ignore */ }

    // Item #201 (release v0.2.1.5) — registra logout ANTES de signOut().
    // Tem que ser aqui porque após auth.signOut() o auth.uid() vira null
    // e RPC log_auth_event falha com AUTH_REQUIRED.
    // Aguarda completar (com timeout pequeno) pra garantir log persiste
    // antes de cleanup da session.
    try {
      await Promise.race([
        logAuthEvent('sign_out', {
          logoutKind: 'explicit',
          details: {
            tipo: 'clicou_sair',
            descricao: 'Clicou no botão Sair'
          }
        }),
        new Promise((resolve) => setTimeout(resolve, 2000))  // timeout 2s
      ])
    } catch { /* fail-safe */ }

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
      sendRecoveryOtp, verifyRecoveryOtp, // #153 v0.2.0.12
      signOut, updateProfile,
      hasSupabase
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
