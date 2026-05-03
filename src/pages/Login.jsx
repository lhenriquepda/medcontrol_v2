import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { TIMING, EASE } from '../animations'

function validatePassword(pwd) {
  const errors = []
  if (pwd.length < 8) errors.push('mínimo 8 caracteres')
  if (!/[A-Z]/.test(pwd)) errors.push('pelo menos uma letra maiúscula')
  if (!/[0-9]/.test(pwd)) errors.push('pelo menos um número')
  return errors
}

export default function Login() {
  const { signInEmail, signUpEmail, resetPassword, signInDemo, hasSupabase } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('signin')   // 'signin' | 'signup' | 'forgot'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (mode === 'signup') {
      const pwdErrors = validatePassword(password)
      if (pwdErrors.length > 0) {
        toast.show({ message: `Senha fraca: ${pwdErrors.join(', ')}.`, kind: 'error' }); return
      }
      if (!consent) {
        toast.show({ message: 'Aceite a Política de Privacidade para continuar.', kind: 'error' }); return
      }
    }
    setBusy(true)
    try {
      if (mode === 'signin') await signInEmail(email, password)
      else if (mode === 'signup') await signUpEmail(email, password, name)
      else if (mode === 'forgot') {
        await resetPassword(email)
        toast.show({ message: 'Email enviado. Verifique sua caixa de entrada (e spam).', kind: 'success' })
        setMode('signin')
      }
      // Item #090 (release v0.1.7.4) — BUG-023: pós-login não redirecionava
      // pra Início se URL atual era rota authenticated-only (ex: /ajustes
      // herdada da session anterior pré-logout). React Router preservava
      // pathname após user mudar null→logged, fazendo Settings renderizar
      // direto. Fix: navigate('/') explícito após signin/signup success
      // se path atual não é raiz nem reset-password (preserva deep links
      // legítimos como /reset-password com token).
      if (mode === 'signin' || mode === 'signup') {
        if (location.pathname !== '/' && location.pathname !== '/reset-password') {
          navigate('/', { replace: true })
        }
      }
    } catch (err) {
      toast.show({ message: err.message || 'Falha na operação', kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-[#0d1535] to-[#1a2660]">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: TIMING.base, ease: EASE.inOut }}
      >
        <div className="text-center mb-8">
          <img src="/dosy-logo-light.png" alt="Dosy" className="h-20 w-auto mx-auto mb-4 object-contain" />
          <p className="text-sm text-white/60 mt-1">Gestão simples de medicamentos</p>
        </div>

        <div className="card p-5 space-y-4">
          {mode !== 'forgot' ? (
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button onClick={() => setMode('signin')}
                      className={`flex-1 py-2 text-sm rounded-lg ${mode === 'signin' ? 'bg-white dark:bg-slate-900 shadow font-medium' : 'text-slate-500'}`}>Entrar</button>
              <button onClick={() => setMode('signup')}
                      className={`flex-1 py-2 text-sm rounded-lg ${mode === 'signup' ? 'bg-white dark:bg-slate-900 shadow font-medium' : 'text-slate-500'}`}>Criar conta</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                aria-label="Voltar"
              >
                ←
              </button>
              <h2 className="text-base font-semibold flex-1">Recuperar senha</h2>
            </div>
          )}

          {mode === 'forgot' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Informe seu email cadastrado. Enviaremos um link para você redefinir a senha.
            </p>
          )}

          <form onSubmit={submit} className="space-y-3">
            {/* Item #011 (release v0.1.7.4) — labels explícitos pra A11y idosos
                + TalkBack lê corretamente. Mantém placeholder pra UX visual. */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="login-name" className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
                  Nome
                </label>
                <input id="login-name" type="text" required placeholder="Seu nome" className="input"
                       value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
            )}
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
                Email
              </label>
              <input id="login-email" type="email" required placeholder="seu@email.com" className="input"
                     value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            {mode !== 'forgot' && (
              <div>
                <label htmlFor="login-password" className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
                  Senha
                </label>
                <input id="login-password" type="password" required placeholder="••••••••" className="input"
                       value={password} onChange={(e) => setPassword(e.target.value)}
                       minLength={mode === 'signup' ? 8 : undefined}
                       autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
              </div>
            )}
            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}
            {mode === 'signup' && (
              <>
                <p className="text-[10px] text-slate-400">Senha: mín. 8 chars, uma maiúscula, um número.</p>
                <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    Li e aceito a{' '}
                    <a href="/privacidade" className="text-brand-600 dark:text-brand-400 underline" target="_blank" rel="noopener noreferrer">
                      Política de Privacidade
                    </a>
                    {' '}e consinto com o tratamento dos meus dados de saúde conforme a LGPD.
                  </span>
                </label>
                {/* Item #020 (release v0.1.7.4) — Disclaimer médico no signup.
                    Plan FASE 18.5.1 + Auditoria Dim 16. Aparece visivelmente
                    pra deixar claro escopo do Dosy antes de criar conta. */}
                <div className="rounded-lg border border-amber-300/60 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-900/20 p-3 text-xs text-amber-900 dark:text-amber-100 leading-snug">
                  <strong className="block mb-1">⚠️ Aviso importante</strong>
                  Dosy é uma ferramenta de organização e lembrete de medicação.
                  <strong> Não substitui prescrição, diagnóstico ou orientação de profissional de saúde.</strong>{' '}
                  Em caso de dúvida sobre seu tratamento, consulte seu médico ou farmacêutico.
                </div>
              </>
            )}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Aguarde…' : (
                mode === 'signin' ? 'Entrar' :
                mode === 'signup' ? 'Criar conta' :
                'Enviar link de recuperação'
              )}
            </button>
          </form>

          {!hasSupabase && (
            <>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                ou
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>
              <button onClick={signInDemo} className="btn-ghost w-full text-brand-600 dark:text-brand-400">
                Entrar em modo demonstração
              </button>
            </>
          )}
        </div>

        {!hasSupabase && (
          <p className="text-[11px] text-slate-400 text-center mt-4 leading-snug">
            Supabase não configurado. Dados serão salvos neste dispositivo (localStorage).<br />
            Configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> em <code>.env</code>.
          </p>
        )}
      </motion.div>
    </div>
  )
}
