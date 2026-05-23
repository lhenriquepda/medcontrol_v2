import { useState } from 'react'
import { Lock, Mail, X as XIcon, Clock, Infinity as InfinityIcon } from 'lucide-react'
import { Sheet, Button, Input, Avatar } from './dosy'
import { usePatientShares, useSharePatient, useUnsharePatient } from '../hooks/useShares'
import { useMyTier, useIsPro } from '../hooks/useSubscription'
import PaywallModal from './PaywallModal'
import OfflineNotice from './OfflineNotice'
import { useOfflineGuard } from '../hooks/useOfflineGuard'
import { track, EVENTS } from '../services/analytics'

// v0.2.6.1 P3.15 (Roteiro_Alinhamento_Dosy_v2) — opções TTL pra share temporário.
const TTL_OPTIONS = [
  { id: '1h',   label: '1 hora',        hours: 1 },
  { id: '24h',  label: '24 horas',      hours: 24 },
  { id: '7d',   label: '7 dias',        hours: 24 * 7 },
  { id: '30d',  label: '30 dias',       hours: 24 * 30 },
]

function ttlIdToExpiresAt(id) {
  const opt = TTL_OPTIONS.find((o) => o.id === id)
  if (!opt) return null
  return new Date(Date.now() + opt.hours * 3600 * 1000).toISOString()
}

function formatRemaining(expiresAtIso) {
  if (!expiresAtIso) return ''
  const ms = new Date(expiresAtIso) - new Date()
  if (ms <= 0) return 'expirado'
  const h = Math.floor(ms / 3600000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}min`
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

export default function SharePatientSheet({ open, onClose, patient }) {
  // v0.2.3.5 #251 — Plus tem todas features Pro (só difere por mostrar 1 Ad).
  // Antes: isPro = ['pro','admin'] excluía plus → bloqueava Plus de compartilhar.
  // Fix: useIsPro() inclui plus+pro+admin (PRO_FEATURE_TIERS).
  const { data: tier } = useMyTier()
  const isPro = useIsPro()
  const patientId = patient?.id
  const { data: shares = [], isLoading, isError, error, refetch } = usePatientShares(patientId)
  const shareMut = useSharePatient()
  const unshareMut = useUnsharePatient()
  const guard = useOfflineGuard()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState(null)
  const [okMsg, setOkMsg] = useState(null)
  const [paywall, setPaywall] = useState(false)
  // v0.2.6.1 P3.15 — radio Permanente/Temporário + TTL select
  const [shareType, setShareType] = useState('permanent') // 'permanent' | 'temporary'
  const [ttlId, setTtlId] = useState('24h')

  async function submit(e) {
    e?.preventDefault?.()
    setErr(null); setOkMsg(null)
    const v = email.trim()
    if (!v) { setErr('Informe um e-mail.'); return }
    if (!isPro) { setPaywall(true); return }
    // Item #204 v0.2.1.8 — share NÃO entra queue offline (depende envio email
    // server-side). Bloqueio claro + toast em vez de iludir.
    if (!guard.ensure('Compartilhar paciente')) return
    const expiresAt = shareType === 'temporary' ? ttlIdToExpiresAt(ttlId) : null
    try {
      await shareMut.mutateAsync({ patientId, email: v, expiresAt })
      const ttlLabel = expiresAt ? ` (expira em ${formatRemaining(expiresAt)})` : ''
      setOkMsg(`Paciente compartilhado com ${v}${ttlLabel}.`)
      setEmail('')
      try {
        track(EVENTS.SHARE_TYPE_SELECTED, { type: shareType, ttl_id: shareType === 'temporary' ? ttlId : null })
      } catch {}
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
            aparecem em tempo real para ambos.
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

            {/* v0.2.6.1 P3.15 — radio Permanente / Temporário */}
            <div role="radiogroup" aria-label="Tipo de compartilhamento" style={{
              display: 'flex', gap: 8, marginTop: 4,
            }}>
              <button
                type="button"
                role="radio"
                aria-checked={shareType === 'permanent'}
                onClick={() => setShareType('permanent')}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 12,
                  border: shareType === 'permanent'
                    ? '2px solid var(--dosy-primary)'
                    : '1px solid var(--dosy-border)',
                  background: shareType === 'permanent'
                    ? 'color-mix(in srgb, var(--dosy-primary) 8%, transparent)'
                    : 'transparent',
                  color: 'var(--dosy-fg)',
                  cursor: 'pointer', minHeight: 56,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'var(--dosy-font-body)',
                }}
              >
                <InfinityIcon size={18} color={shareType === 'permanent' ? 'var(--dosy-primary)' : 'var(--dosy-fg-tertiary)'} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Permanente</div>
                  <div style={{ fontSize: 11, color: 'var(--dosy-fg-secondary)' }}>Acesso até remover</div>
                </div>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={shareType === 'temporary'}
                onClick={() => setShareType('temporary')}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 12,
                  border: shareType === 'temporary'
                    ? '2px solid var(--dosy-primary)'
                    : '1px solid var(--dosy-border)',
                  background: shareType === 'temporary'
                    ? 'color-mix(in srgb, var(--dosy-primary) 8%, transparent)'
                    : 'transparent',
                  color: 'var(--dosy-fg)',
                  cursor: 'pointer', minHeight: 56,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'var(--dosy-font-body)',
                }}
              >
                <Clock size={18} color={shareType === 'temporary' ? 'var(--dosy-primary)' : 'var(--dosy-fg-tertiary)'} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Temporário</div>
                  <div style={{ fontSize: 11, color: 'var(--dosy-fg-secondary)' }}>Expira automaticamente</div>
                </div>
              </button>
            </div>

            {shareType === 'temporary' && (
              <div style={{
                display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap',
              }} role="radiogroup" aria-label="Duração">
                {TTL_OPTIONS.map((opt) => {
                  const active = opt.id === ttlId
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTtlId(opt.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: active ? '1px solid var(--dosy-primary)' : '1px solid var(--dosy-border-faint)',
                        background: active ? 'var(--dosy-primary)' : 'transparent',
                        color: active ? 'white' : 'var(--dosy-fg-secondary)',
                        fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', minHeight: 32,
                        fontFamily: 'var(--dosy-font-body)',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}

            <Button
              type="submit"
              kind="primary"
              disabled={shareMut.isPending || !guard.online}
              full
            >
              {shareMut.isPending ? 'Enviando…' : (shareType === 'temporary' ? 'Compartilhar temporariamente' : 'Compartilhar')}
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
                {/* v0.2.3.5 #251 — Plus tem todas features Pro. Só Free vê este lock. */}
                Você está no plano Free. Assine PRO para compartilhar.
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
            ) : isError ? (
              // v0.2.3.14 #0009 — fallback UI quando query falha (JWT expirado, network).
              // Antes ficava em "Carregando..." infinito porque consumer só lia isLoading.
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
                <p style={{ fontSize: 12, color: 'var(--dosy-danger)', margin: 0 }}>
                  Não foi possível carregar a lista{error?.code ? ` (${error.code})` : ''}.
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--dosy-primary)',
                    background: 'transparent', border: 'none',
                    padding: '4px 0', cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Tentar novamente
                </button>
              </div>
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
                      {/* v0.2.6.1 P4.7c — TemporaryShareBadge (owner-side: mostra cronômetro) */}
                      {(s.is_temporary || s.isTemporary || s.expiresAt) && (
                        <p style={{
                          fontSize: 10.5, color: 'var(--dosy-accent, #6366f1)',
                          margin: '2px 0 0 0', fontWeight: 600,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <Clock size={10} strokeWidth={2.5}/>
                          Temporário · expira em {formatRemaining(s.expiresAt)}
                        </p>
                      )}
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
