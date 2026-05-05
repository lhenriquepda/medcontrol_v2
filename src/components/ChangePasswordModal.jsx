// #152 (release v0.2.0.12) — ChangePasswordModal.
// User clica botão "Alterar senha" em Ajustes → Conta → modal opens.
// Re-autentica via signInWithPassword (valida senha atual) → updateUser({password}).

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Modal, Button, Input } from './dosy'
import { supabase, hasSupabase } from '../services/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

const MIN_PASSWORD_LENGTH = 8

export default function ChangePasswordModal({ open, onClose }) {
  const { user } = useAuth()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  function reset() {
    setCurrent('')
    setNext('')
    setConfirm('')
    setErrors({})
    setLoading(false)
  }

  function close() {
    reset()
    onClose?.()
  }

  function validate() {
    const e = {}
    if (!current) e.current = 'Informe a senha atual'
    if (!next) e.next = 'Informe a nova senha'
    else if (next.length < MIN_PASSWORD_LENGTH) e.next = `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`
    if (!confirm) e.confirm = 'Repita a nova senha'
    else if (confirm !== next) e.confirm = 'Senhas não coincidem'
    if (current && next && current === next) e.next = 'Nova senha igual à atual'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!hasSupabase || !user) return
    if (!validate()) return
    setLoading(true)
    try {
      // Re-autentica pra validar senha atual.
      // signInWithPassword retorna nova session com mesmo user; qc cache não invalida.
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      })
      if (authErr) {
        setErrors({ current: 'Senha atual incorreta' })
        setLoading(false)
        return
      }
      // Update senha
      const { error: updErr } = await supabase.auth.updateUser({ password: next })
      if (updErr) {
        toast.show({ message: updErr.message || 'Falha ao atualizar senha.', kind: 'error' })
        setLoading(false)
        return
      }
      toast.show({ message: 'Senha alterada com sucesso.', kind: 'success' })
      close()
    } catch (err) {
      toast.show({ message: err.message || 'Erro inesperado.', kind: 'error' })
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={loading ? undefined : close} closeOnOverlay={!loading} maxWidth={380}>
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
          <Lock size={22} strokeWidth={1.75}/>
        </div>
        <div>
          <h3 style={{
            margin: 0, fontSize: 18, fontWeight: 700,
            color: 'var(--dosy-fg)',
            fontFamily: 'var(--dosy-font-display)',
          }}>Alterar senha</h3>
          <p style={{
            margin: '2px 0 0 0', fontSize: 12,
            color: 'var(--dosy-fg-secondary)',
          }}>Confirme a senha atual e defina uma nova</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          label="Senha atual"
          type="password"
          value={current}
          onChange={(e) => { setCurrent(e.target.value); if (errors.current) setErrors({ ...errors, current: undefined }) }}
          error={errors.current}
          autoComplete="current-password"
          name="current-password"
        />
        <Input
          label="Nova senha"
          type="password"
          value={next}
          onChange={(e) => { setNext(e.target.value); if (errors.next) setErrors({ ...errors, next: undefined }) }}
          error={errors.next}
          hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
          autoComplete="new-password"
          name="new-password"
        />
        <Input
          label="Repetir nova senha"
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) setErrors({ ...errors, confirm: undefined }) }}
          error={errors.confirm}
          autoComplete="new-password"
          name="confirm-password"
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <Button kind="secondary" onClick={close} disabled={loading} full>
          Cancelar
        </Button>
        <Button kind="primary" onClick={submit} disabled={loading} full>
          {loading ? 'Alterando…' : 'Confirmar'}
        </Button>
      </div>
    </Modal>
  )
}
