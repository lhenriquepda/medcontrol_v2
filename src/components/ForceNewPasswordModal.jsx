// #153 (release v0.2.0.12) — ForceNewPasswordModal.
// Aberto automático pelo AppShell após verifyRecoveryOtp com sucesso (flag
// localStorage `dosy_force_password_change=1`). Variant ChangePasswordModal
// SEM campo "senha atual" — user esqueceu mesmo, OTP já validou identidade.
//
// closeOnOverlay=false + sem botão Cancelar — força user definir senha nova
// antes de continuar (sair = clear flag = user perde recovery e tem que repetir).

import { useState } from 'react'
import { Lock, KeyRound } from 'lucide-react'
import { Modal, Button, Input } from './dosy'
import { supabase, hasSupabase } from '../services/supabase'
import { useToast } from '../hooks/useToast'

const MIN_PASSWORD_LENGTH = 8

export default function ForceNewPasswordModal({ open, onComplete }) {
  const toast = useToast()
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  function validate() {
    const e = {}
    if (!next) e.next = 'Informe a nova senha'
    else if (next.length < MIN_PASSWORD_LENGTH) e.next = `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`
    if (!confirm) e.confirm = 'Repita a nova senha'
    else if (confirm !== next) e.confirm = 'Senhas não coincidem'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!hasSupabase) return
    if (!validate()) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) {
        toast.show({ message: error.message || 'Falha ao definir senha.', kind: 'error' })
        setLoading(false)
        return
      }
      // Limpa flag — recovery completo
      try { localStorage.removeItem('dosy_force_password_change') } catch { /* ignore */ }
      toast.show({ message: 'Senha definida com sucesso.', kind: 'success' })
      onComplete?.()
    } catch (err) {
      toast.show({ message: err.message || 'Erro inesperado.', kind: 'error' })
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={undefined} closeOnOverlay={false} maxWidth={380}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        margin: '0 0 16px 0',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'var(--dosy-gradient-sunset-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--dosy-primary)', flexShrink: 0,
        }}>
          <KeyRound size={22} strokeWidth={1.75}/>
        </div>
        <div>
          <h3 style={{
            margin: 0, fontSize: 18, fontWeight: 700,
            color: 'var(--dosy-fg)',
            fontFamily: 'var(--dosy-font-display)',
          }}>Definir nova senha</h3>
          <p style={{
            margin: '2px 0 0 0', fontSize: 12,
            color: 'var(--dosy-fg-secondary)',
          }}>Recuperação confirmada · escolha senha nova</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          label="Nova senha"
          type="password"
          value={next}
          onChange={(e) => { setNext(e.target.value); if (errors.next) setErrors({ ...errors, next: undefined }) }}
          error={errors.next}
          hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
          autoComplete="new-password"
          icon={Lock}
        />
        <Input
          label="Repetir nova senha"
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) setErrors({ ...errors, confirm: undefined }) }}
          error={errors.confirm}
          autoComplete="new-password"
          icon={Lock}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <Button kind="primary" onClick={submit} disabled={loading} full>
          {loading ? 'Salvando…' : 'Confirmar nova senha'}
        </Button>
      </div>
    </Modal>
  )
}
