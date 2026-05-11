import { useState } from 'react'
import { Lock, Mail, X as XIcon } from 'lucide-react'
import { Sheet, Button, Input, Avatar } from './dosy'
import { usePatientShares, useSharePatient, useUnsharePatient } from '../hooks/useShares'
import { useMyTier } from '../hooks/useSubscription'
import PaywallModal from './PaywallModal'
import OfflineNotice from './OfflineNotice'
import { useOfflineGuard } from '../hooks/useOfflineGuard'

export default function SharePatientSheet({ open, onClose, patient }) {
  const { data: tier } = useMyTier()
  const isPro = tier === 'pro' || tier === 'admin'
  const patientId = patient?.id
  const { data: shares = [], isLoading } = usePatientShares(patientId)
  const shareMut = useSharePatient()
  const unshareMut = useUnsharePatient()
  const guard = useOfflineGuard()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState(null)
  const [okMsg, setOkMsg] = useState(null)
  const [paywall, setPaywall] = useState(false)

  async function submit(e) {
    e?.preventDefault?.()
    setErr(null); setOkMsg(null)
    const v = email.trim()
    if (!v) { setErr('Informe um e-mail.'); return }
    if (!isPro) { setPaywall(true); return }
    // Item #204 v0.2.1.8 — share NÃO entra queue offline (depende envio email
    // server-side). Bloqueio claro + toast em vez de iludir.
    if (!guard.ensure('Compartilhar paciente')) return
    try {
      await shareMut.mutateAsync({ patientId, email: v })
      setOkMsg(`Paciente compartilhado com ${v}.`)
      setEmail('')
    } catch (e2) {
      setErr(e2?.message || 'Erro ao compartilhar.')
    }
  }

  async function remove(targetUserId) {
    if (!guard.ensure('Remover compartilhamento')) return
    try {
      await unshareMut.mutateAsync({ patientId, targetUserId })
    } catch (e) {
      setErr(e?.message || 'Erro ao remover.')
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={`Compartilhar · ${patient?.name || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <OfflineNotice featureLabel="compartilhamento de pacientes" />
          <p style={{
            fontSize: 12.5, color: 'var(--dosy-fg-secondary)',
            lineHeight: 1.5, margin: 0,
          }}>
            Compartilhe este paciente com outro usuário do Dosy. As alterações
            aparecem em tempo real para ambos.{' '}
            Recurso <span style={{ color: 'var(--dosy-primary)', fontWeight: 700 }}>PRO</span>
            {' '}— apenas quem compartilha precisa ser PRO.
          </p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input
              label="E-mail do convidado"
              type="email"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@exemplo.com"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <Button
              type="submit"
              kind="primary"
              disabled={shareMut.isPending || !guard.online}
              full
            >
              {shareMut.isPending ? 'Enviando…' : 'Compartilhar'}
            </Button>
            {err && (
              <p style={{ fontSize: 12, color: 'var(--dosy-danger)', margin: 0, paddingLeft: 4 }}>{err}</p>
            )}
            {okMsg && (
              <p style={{ fontSize: 12, color: '#3F9E7E', margin: 0, paddingLeft: 4 }}>{okMsg}</p>
            )}
            {!isPro && (
              <p style={{
                fontSize: 11.5, color: '#C5841A',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                margin: 0, paddingLeft: 4,
              }}>
                <Lock size={11} strokeWidth={1.75}/>
                {/* Item #120 (release v0.2.0.3): copy condicional baseado em tier real.
                    Plus user via "plano Plus" não "plano Free". Compartilhar é exclusivo
                    pro/admin. */}
                {tier === 'plus'
                  ? 'Você está no plano Plus. Compartilhar é exclusivo PRO.'
                  : 'Você está no plano Free. Assine PRO para compartilhar.'}
              </p>
            )}
          </form>

          <div>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
              fontFamily: 'var(--dosy-font-display)',
              margin: '0 0 10px 4px',
            }}>Compartilhado com</p>
            {isLoading ? (
              <p style={{ fontSize: 12, color: 'var(--dosy-fg-tertiary)', margin: 0 }}>Carregando…</p>
            ) : shares.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--dosy-fg-tertiary)', margin: 0 }}>Ninguém ainda.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {shares.map((s) => (
                  <li key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 10,
                    borderRadius: 14,
                    background: 'var(--dosy-bg-elevated)',
                    boxShadow: 'var(--dosy-shadow-xs)',
                  }}>
                    <Avatar name={s.name || s.email} color="sunset" size={36}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 14, fontWeight: 600, margin: 0,
                        color: 'var(--dosy-fg)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{s.name || s.email}</p>
                      <p style={{
                        fontSize: 11.5, color: 'var(--dosy-fg-secondary)',
                        margin: 0,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{s.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(s.sharedWithUserId)}
                      disabled={unshareMut.isPending}
                      aria-label="Remover"
                      style={{
                        width: 32, height: 32, borderRadius: 9999,
                        background: 'var(--dosy-danger-bg)',
                        color: 'var(--dosy-danger)',
                        border: 'none', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        opacity: unshareMut.isPending ? 0.4 : 1,
                      }}
                    >
                      <XIcon size={14} strokeWidth={2}/>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button kind="secondary" onClick={onClose} full>
            Fechar
          </Button>
        </div>
      </Sheet>
      <PaywallModal
        open={paywall}
        onClose={() => setPaywall(false)}
        reason="Compartilhar pacientes é um recurso PRO."
      />
    </>
  )
}
