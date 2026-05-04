import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Fingerprint } from 'lucide-react'
import { Button } from './dosy'
import { useAuth } from '../hooks/useAuth'

/**
 * LockScreen — full-screen overlay shown when useAppLock.locked === true.
 * Auto-triggers biometric prompt on mount. Manual retry button + signOut escape hatch.
 *
 * Item #017 (Plan FASE 11.3). Native-only — web user never sees this (lock disabled).
 */
export default function LockScreen({ unlock, biometricAvailable }) {
  const { signOut } = useAuth()
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (tried) return
    setTried(true)
    setBusy(true)
    unlock().finally(() => setBusy(false))
  }, [tried, unlock])

  async function handleRetry() {
    if (busy) return
    setBusy(true)
    try { await unlock() } finally { setBusy(false) }
  }

  async function handleLogout() {
    try { await signOut() } catch {}
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--dosy-bg, #FFF4EC)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24, gap: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="App bloqueado"
    >
      <div
        style={{
          width: 96, height: 96, borderRadius: 32,
          background: 'var(--dosy-bg-elevated, #FFEAD6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--dosy-accent, #FF6B5B)',
          boxShadow: 'var(--dosy-shadow-md, 0 4px 16px rgba(255, 107, 91, 0.15))',
        }}
      >
        <Lock size={40} strokeWidth={2} />
      </div>

      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <h1
          style={{
            fontFamily: 'var(--dosy-font-display)',
            fontSize: 24, fontWeight: 700,
            color: 'var(--dosy-fg, #2A1F1A)',
            margin: '0 0 8px',
          }}
        >
          Dosy bloqueado
        </h1>
        <p style={{ fontSize: 14, color: 'var(--dosy-fg-secondary)', margin: 0, lineHeight: 1.5 }}>
          {biometricAvailable
            ? 'Use sua biometria ou senha do celular para desbloquear.'
            : 'Use a senha do celular para desbloquear.'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
        <Button
          kind="primary"
          full
          onClick={handleRetry}
          disabled={busy}
          icon={Fingerprint}
        >
          {busy ? 'Aguardando…' : 'Desbloquear'}
        </Button>
        <Button kind="ghost" full onClick={handleLogout} disabled={busy}>
          Sair da conta
        </Button>
      </div>
    </motion.div>
  )
}
