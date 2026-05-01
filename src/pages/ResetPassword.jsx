import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TIMING, EASE } from '../animations'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import Icon from '../components/Icon'

function validatePassword(pwd) {
  const errors = []
  if (pwd.length < 8) errors.push('mínimo 8 caracteres')
  if (!/[A-Z]/.test(pwd)) errors.push('pelo menos uma letra maiúscula')
  if (!/[0-9]/.test(pwd)) errors.push('pelo menos um número')
  return errors
}

/**
 * /reset-password — acessada via link no email de recuperação.
 *
 * Fluxo Supabase:
 *   1. User clica botão "Esqueci minha senha" no Login → resetPassword(email)
 *   2. Supabase envia email com link contendo `?code=...` (PKCE)
 *   3. Link redireciona para esta página
 *   4. Supabase auth client (detectSessionInUrl=true em web) detecta `code` na URL
 *      e estabelece sessão temporária com escopo de recovery
 *   5. User digita nova senha aqui → updateUser({ password })
 *   6. Logout + redirect para /entrar (usuário entra com senha nova)
 */
export default function ResetPassword() {
  const { user, updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Native: pode chegar via deep link dosy://reset-password com code= — App.jsx
  // captura via appUrlOpen e chama exchangeCodeForSession. Aqui só esperamos user setado.
  useEffect(() => {
    const url = new URL(window.location.href)
    const errParam = url.searchParams.get('error_description')
    if (errParam) {
      toast.show({ message: decodeURIComponent(errParam), kind: 'error' })
    }
  }, [toast])

  async function submit(e) {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.show({ message: 'As senhas não coincidem.', kind: 'error' })
      return
    }
    const errors = validatePassword(password)
    if (errors.length > 0) {
      toast.show({ message: `Senha fraca: ${errors.join(', ')}.`, kind: 'error' })
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
      toast.show({ message: 'Senha atualizada com sucesso.', kind: 'success' })
      // Logout e redireciona ao Login pra forçar entrada com nova senha
      await signOut()
      setTimeout(() => navigate('/', { replace: true }), 800)
    } catch (err) {
      toast.show({ message: err.message || 'Falha ao atualizar senha.', kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-[#0d1535] to-[#1a2660]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.inOut }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/dosy-logo-light.png" alt="Dosy" className="h-16 w-auto mx-auto mb-3 object-contain" />
          <h1 className="text-white text-lg font-semibold">Definir nova senha</h1>
        </div>

        <div className="card p-5 space-y-4">
          {!user ? (
            <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p className="mb-3 inline-flex items-center gap-1.5">
                <Icon name="warning" size={16} className="text-amber-600" /> Link inválido ou expirado.
              </p>
              <p className="text-xs text-slate-500">
                Solicite um novo link de recuperação na tela de login.
              </p>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="btn-primary w-full mt-4"
              >
                Voltar ao login
              </button>
            </div>
          ) : done ? (
            <div className="text-center text-sm text-emerald-600 dark:text-emerald-400">
              ✓ Senha atualizada. Redirecionando…
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Conta: <span className="font-medium text-slate-700 dark:text-slate-200">{user.email}</span>
              </p>
              <input
                type="password"
                required
                placeholder="Nova senha"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
              <input
                type="password"
                required
                placeholder="Confirmar nova senha"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-[10px] text-slate-400">
                Mínimo 8 caracteres, uma letra maiúscula, um número.
              </p>
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'Aguarde…' : 'Atualizar senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  )
}
