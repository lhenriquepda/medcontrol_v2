import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, MailCheck, Inbox, UserPlus } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { TIMING, EASE } from '../animations'
import { Card, Button, Input } from '../components/dosy'

function validatePassword(pwd) {
  const errors = []
  if (pwd.length < 8) errors.push('mínimo 8 caracteres')
  if (!/[A-Z]/.test(pwd)) errors.push('pelo menos uma letra maiúscula')
  if (!/[0-9]/.test(pwd)) errors.push('pelo menos um número')
  return errors
}

export default function Login() {
  const { signInEmail, signUpEmail, sendRecoveryOtp, verifyRecoveryOtp, signInDemo, hasSupabase } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  // #153 (v0.2.0.12) — modes:
  //  'signin' | 'signup' | 'forgot-email' | 'forgot-otp' | 'check-email' (v0.2.3.5 #252 pós-signup confirme email)
  const [mode, setMode] = useState('signin')
  const [pendingEmail, setPendingEmail] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [consent, setConsent] = useState(false)
  // v0.2.3.5 #254 — checkbox "criar paciente com meu nome" no signup
  const [createSelfPatient, setCreateSelfPatient] = useState(true)
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
      else if (mode === 'signup') {
        // v0.2.3.5 #254 — flag pra criar paciente self pós session active.
        // useAuth SIGNED_IN listener consome flag + cria patient + limpa.
        if (createSelfPatient && name.trim()) {
          try { localStorage.setItem('dosy_pending_self_patient', name.trim()) } catch { /* ignore */ }
        }
        const res = await signUpEmail(email, password, name)
        // v0.2.3.5 #252 — pending email confirm → tela explicativa em vez de toast.
        if (res?.pendingConfirmation) {
          setPendingEmail(email)
          setMode('check-email')
          setBusy(false)
          return
        }
      }
      else if (mode === 'forgot-email') {
        // #153: envia OTP code 6 dígitos por email
        await sendRecoveryOtp(email)
        toast.show({ message: 'Código enviado. Confira email (e spam).', kind: 'success' })
        setMode('forgot-otp')
        setBusy(false)
        return
      }
      else if (mode === 'forgot-otp') {
        // #153: verifica OTP → cria sessão + flag dosy_force_password_change
        if (!otp || otp.length < 6) {
          toast.show({ message: 'Informe os 6 dígitos do código.', kind: 'error' })
          setBusy(false)
          return
        }
        await verifyRecoveryOtp(email, otp)
        toast.show({ message: 'Recuperação confirmada. Defina uma nova senha.', kind: 'success' })
        // useAuth listener detecta SIGNED_IN → AppShell renderiza dashboard
        // + ForceNewPasswordModal abre auto via flag localStorage
        navigate('/', { replace: true })
        return
      }
      // Item #090 (release v0.1.7.4) — BUG-023: pós-login não redirecionava
      // pra Início se URL atual era rota authenticated-only.
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

  const submitLabel = mode === 'signin' ? 'Entrar'
    : mode === 'signup' ? 'Criar conta'
    : mode === 'forgot-email' ? 'Enviar código'
    : mode === 'forgot-otp' ? 'Confirmar código'
    : 'Enviar'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--dosy-gradient-sunset)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative radial glow */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.25), transparent 60%)',
        pointerEvents: 'none',
      }}/>

      <motion.div
        style={{ width: '100%', maxWidth: 384, position: 'relative', zIndex: 1 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: TIMING.base, ease: EASE.inOut }}
      >
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="/dosy-logo-light.png"
            alt="Dosy"
            style={{ height: 72, width: 'auto', margin: '0 auto 12px', objectFit: 'contain' }}
          />
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.85)',
            margin: 0, fontFamily: 'var(--dosy-font-body)',
          }}>Gestão simples de medicamentos</p>
        </div>

        {/* v0.2.3.5 #252 — Tela "verifique email" pós-signup. Substitui toast vermelho confuso. */}
        {mode === 'check-email' ? (
          <Card padding={24} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 9999, margin: '0 auto',
              background: 'var(--dosy-gradient-sunset)',
              color: 'var(--dosy-fg-on-sunset)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 12px 32px -8px rgba(255,107,91,0.35)',
            }}>
              <MailCheck size={28} strokeWidth={2}/>
            </div>
            <div>
              <h2 style={{
                fontSize: 20, fontWeight: 800, margin: '0 0 6px 0',
                color: 'var(--dosy-fg)', fontFamily: 'var(--dosy-font-display)',
                letterSpacing: '-0.02em',
              }}>Verifique seu email</h2>
              <p style={{
                fontSize: 13.5, color: 'var(--dosy-fg-secondary)',
                lineHeight: 1.5, margin: 0,
              }}>
                Enviamos um link de confirmação para
              </p>
              <p style={{
                fontSize: 14, fontWeight: 700, margin: '4px 0 0 0',
                color: 'var(--dosy-primary)',
                fontFamily: 'var(--dosy-font-display)',
                wordBreak: 'break-all',
              }}>{pendingEmail}</p>
            </div>
            <div style={{
              padding: 14, borderRadius: 14,
              background: 'var(--dosy-gradient-sunset-muted)',
              display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
            }}>
              <Inbox size={18} strokeWidth={2} style={{
                flexShrink: 0, color: 'var(--dosy-primary)', marginTop: 1,
              }}/>
              <div style={{ fontSize: 12.5, color: 'var(--dosy-fg)', lineHeight: 1.5 }}>
                Abra o email e clique em <strong>Confirmar email</strong>. Você cairá direto no app.
                Se não chegar em 2 minutos, confira a pasta de <strong>Spam</strong>.
              </div>
            </div>
            <Button
              type="button"
              kind="secondary"
              full
              onClick={() => { setMode('signin'); setEmail(pendingEmail); setPassword(''); setName(''); setConsent(false) }}
            >
              Já confirmei — entrar
            </Button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setPendingEmail('') }}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                color: 'var(--dosy-fg-secondary)',
                fontFamily: 'var(--dosy-font-display)',
              }}
            >Usar outro email</button>
          </Card>
        ) : (
        <Card padding={20} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Mode toggle / forgot header */}
          {mode !== 'forgot-email' && mode !== 'forgot-otp' ? (
            <div style={{
              display: 'flex',
              background: 'var(--dosy-bg-sunken)',
              borderRadius: 12, padding: 4,
            }}>
              <button
                type="button"
                onClick={() => setMode('signin')}
                style={{
                  flex: 1, padding: '8px 12px',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: mode === 'signin' ? 'var(--dosy-bg-elevated)' : 'transparent',
                  boxShadow: mode === 'signin' ? 'var(--dosy-shadow-xs)' : 'none',
                  color: mode === 'signin' ? 'var(--dosy-fg)' : 'var(--dosy-fg-secondary)',
                  fontWeight: mode === 'signin' ? 700 : 500,
                  fontSize: 13,
                  fontFamily: 'var(--dosy-font-display)',
                  transition: 'all 200ms var(--dosy-ease-out)',
                }}
              >Entrar</button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                style={{
                  flex: 1, padding: '8px 12px',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: mode === 'signup' ? 'var(--dosy-bg-elevated)' : 'transparent',
                  boxShadow: mode === 'signup' ? 'var(--dosy-shadow-xs)' : 'none',
                  color: mode === 'signup' ? 'var(--dosy-fg)' : 'var(--dosy-fg-secondary)',
                  fontWeight: mode === 'signup' ? 700 : 500,
                  fontSize: 13,
                  fontFamily: 'var(--dosy-font-display)',
                  transition: 'all 200ms var(--dosy-ease-out)',
                }}
              >Criar conta</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => { setOtp(''); setMode('signin') }}
                aria-label="Voltar"
                className="dosy-press"
                style={{
                  width: 32, height: 32, borderRadius: 9999,
                  border: 'none', cursor: 'pointer',
                  background: 'var(--dosy-bg-sunken)',
                  color: 'var(--dosy-fg)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              ><ArrowLeft size={16} strokeWidth={2}/></button>
              <h2 style={{
                flex: 1, fontSize: 15, fontWeight: 700, margin: 0,
                color: 'var(--dosy-fg)',
                fontFamily: 'var(--dosy-font-display)',
              }}>Recuperar senha</h2>
            </div>
          )}

          {mode === 'forgot-email' && (
            <p style={{
              fontSize: 12, color: 'var(--dosy-fg-secondary)',
              lineHeight: 1.5, margin: 0,
            }}>
              Informe seu email cadastrado. Enviaremos um código de 6 dígitos para você confirmar.
            </p>
          )}
          {mode === 'forgot-otp' && (
            <p style={{
              fontSize: 12, color: 'var(--dosy-fg-secondary)',
              lineHeight: 1.5, margin: 0,
            }}>
              Código enviado para <strong>{email}</strong>. Digite os 6 dígitos abaixo. Pode levar 1-2min.
            </p>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'signup' && (
              <Input
                id="login-name"
                label="Nome"
                type="text"
                required
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}
            <Input
              id="login-email"
              label="Email"
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {(mode === 'signin' || mode === 'signup') && (
              <Input
                id="login-password"
                label="Senha"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'signup' ? 8 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            )}
            {mode === 'forgot-otp' && (
              <Input
                id="login-otp"
                label="Código de 6 dígitos"
                type="text"
                required
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              />
            )}
            {mode === 'signin' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setMode('forgot-email')}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--dosy-primary)',
                    fontFamily: 'var(--dosy-font-display)',
                    padding: 2,
                  }}
                >Esqueci minha senha</button>
              </div>
            )}
            {mode === 'forgot-otp' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setOtp(''); setMode('forgot-email') }}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--dosy-primary)',
                    fontFamily: 'var(--dosy-font-display)',
                    padding: 2,
                  }}
                >Reenviar código</button>
              </div>
            )}
            {mode === 'signup' && (
              <>
                <p style={{
                  fontSize: 10, color: 'var(--dosy-fg-tertiary)', margin: 0,
                }}>
                  Senha: mín. 8 chars, uma maiúscula, um número.
                </p>
                {/* v0.2.3.5 #254 — checkbox destacado: criar paciente com nome do user */}
                <button
                  type="button"
                  onClick={() => setCreateSelfPatient((v) => !v)}
                  className="dosy-press"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 14px',
                    borderRadius: 16,
                    border: createSelfPatient ? 'none' : '1.5px solid var(--dosy-border)',
                    background: createSelfPatient
                      ? 'var(--dosy-gradient-sunset)'
                      : 'var(--dosy-bg-elevated)',
                    color: createSelfPatient ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-fg)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--dosy-font-body)',
                    boxShadow: createSelfPatient
                      ? '0 8px 20px -6px rgba(255,107,91,0.4)'
                      : 'var(--dosy-shadow-xs)',
                    transition: 'all 200ms',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: createSelfPatient ? 'rgba(255,255,255,0.22)' : 'var(--dosy-peach-100)',
                    color: createSelfPatient ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-primary)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    backdropFilter: createSelfPatient ? 'blur(8px)' : 'none',
                    border: createSelfPatient ? '1px solid rgba(255,255,255,0.3)' : 'none',
                  }}>
                    <UserPlus size={18} strokeWidth={2.25}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13.5, fontWeight: 800,
                      fontFamily: 'var(--dosy-font-display)',
                      lineHeight: 1.2, marginBottom: 2,
                    }}>Criar paciente com meu nome</div>
                    <div style={{
                      fontSize: 11.5, opacity: createSelfPatient ? 0.9 : 0.7,
                      lineHeight: 1.4,
                    }}>{name.trim()
                      ? `Vai cadastrar "${name.trim()}" como paciente automaticamente`
                      : 'Cadastra você como paciente automaticamente'}</div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 7,
                    background: createSelfPatient ? '#FFFFFF' : 'transparent',
                    border: createSelfPatient ? 'none' : '2px solid var(--dosy-fg-tertiary)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 180ms',
                  }}>
                    {createSelfPatient && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dosy-primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </button>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  fontSize: 12, color: 'var(--dosy-fg-secondary)',
                  cursor: 'pointer', lineHeight: 1.5,
                }}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--dosy-primary)' }}
                  />
                  <span>
                    Li e aceito a{' '}
                    <a
                      href="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--dosy-primary)', textDecoration: 'underline', fontWeight: 600 }}
                    >Política de Privacidade</a>
                    {' '}e consinto com o tratamento dos meus dados de saúde conforme a LGPD.
                  </span>
                </label>
                {/* Disclaimer médico */}
                <div style={{
                  borderRadius: 12,
                  background: 'var(--dosy-warning-bg)',
                  border: '1px solid rgba(197,132,26,0.2)',
                  padding: 12,
                  display: 'flex', gap: 8,
                  fontSize: 12, lineHeight: 1.5,
                  color: '#9A6313',
                }}>
                  <AlertTriangle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }}/>
                  <div>
                    <strong style={{ display: 'block', marginBottom: 2 }}>Aviso importante</strong>
                    Dosy é uma ferramenta de organização e lembrete de medicação.{' '}
                    <strong>Não substitui prescrição, diagnóstico ou orientação de profissional de saúde.</strong>{' '}
                    Em caso de dúvida sobre seu tratamento, consulte seu médico ou farmacêutico.
                  </div>
                </div>
              </>
            )}
            <Button
              type="submit"
              kind="primary"
              full
              size="lg"
              disabled={busy}
            >
              {busy ? 'Aguarde…' : submitLabel}
            </Button>
          </form>

          {!hasSupabase && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                fontSize: 11, color: 'var(--dosy-fg-tertiary)',
              }}>
                <div style={{ flex: 1, height: 1, background: 'var(--dosy-divider)' }}/>
                ou
                <div style={{ flex: 1, height: 1, background: 'var(--dosy-divider)' }}/>
              </div>
              <Button
                kind="ghost"
                full
                onClick={signInDemo}
              >
                Entrar em modo demonstração
              </Button>
            </>
          )}
        </Card>
        )}

        {!hasSupabase && (
          <p style={{
            fontSize: 11, textAlign: 'center', marginTop: 16,
            color: 'rgba(255,255,255,0.85)', lineHeight: 1.5,
          }}>
            Supabase não configurado. Dados serão salvos neste dispositivo (localStorage).<br/>
            Configure <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: 4 }}>VITE_SUPABASE_URL</code> e <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: 4 }}>VITE_SUPABASE_ANON_KEY</code> em <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: 4 }}>.env</code>.
          </p>
        )}
      </motion.div>
    </div>
  )
}
