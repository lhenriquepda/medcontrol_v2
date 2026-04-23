import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import Logo from '../components/Logo'

export default function Login() {
  const { signInEmail, signUpEmail, signInDemo, hasSupabase } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'signin') await signInEmail(email, password)
      else await signUpEmail(email, password, name)
    } catch (err) {
      toast.show({ message: err.message || 'Falha no login', kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-brand-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><Logo size={72} /></div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="text-brand-600 dark:text-brand-400">Med</span>Control
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gestão simples de medicamentos</p>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button onClick={() => setMode('signin')}
                    className={`flex-1 py-2 text-sm rounded-lg ${mode === 'signin' ? 'bg-white dark:bg-slate-900 shadow font-medium' : 'text-slate-500'}`}>Entrar</button>
            <button onClick={() => setMode('signup')}
                    className={`flex-1 py-2 text-sm rounded-lg ${mode === 'signup' ? 'bg-white dark:bg-slate-900 shadow font-medium' : 'text-slate-500'}`}>Criar conta</button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <input type="text" required placeholder="Seu nome" className="input"
                     value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            )}
            <input type="email" required placeholder="Email" className="input"
                   value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" required placeholder="Senha" className="input"
                   value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Aguarde…' : (mode === 'signin' ? 'Entrar' : 'Criar conta')}
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
      </div>
    </div>
  )
}
