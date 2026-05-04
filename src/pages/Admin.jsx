import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TIMING, EASE } from '../animations'
import { SkeletonList } from '../components/Skeleton'
import { Card, Sheet, Button, Chip, Input, StatusPill } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { useAllUsers, useGrantTier, useIsAdmin, useMyTier } from '../hooks/useSubscription'
import { useToast } from '../hooks/useToast'
import { formatDate, formatDateTime } from '../utils/dateUtils'
import { TIER_LABELS } from '../utils/tierUtils'

const TIER_PILL_KIND = {
  free: 'skipped',
  plus: 'pending',
  pro: 'success',
  admin: 'sunset',
}

export default function Admin() {
  const isAdmin = useIsAdmin()
  const { isLoading: tierLoading } = useMyTier()
  const { data: users = [], isLoading } = useAllUsers()
  const [selected, setSelected] = useState(null)

  if (tierLoading) {
    return (
      <div style={{
        padding: 16, fontSize: 13, color: 'var(--dosy-fg-secondary)',
      }}>Carregando…</div>
    )
  }
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <motion.div
      style={{ paddingBottom: 110 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.inOut }}
    >
      <PageHeader title="Painel Admin" subtitle={`${users.length} usuário(s)`} back/>

      <div className="max-w-md mx-auto px-4 pt-1" style={{
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {isLoading ? <SkeletonList count={4} /> : users.map((u) => (
          <button
            key={u.userId}
            type="button"
            onClick={() => setSelected(u)}
            className="dosy-press"
            style={{
              width: '100%', textAlign: 'left',
              padding: 14,
              background: 'var(--dosy-bg-elevated)',
              border: '1px solid var(--dosy-border)',
              borderRadius: 16,
              boxShadow: 'var(--dosy-shadow-xs)',
              cursor: 'pointer',
              fontFamily: 'var(--dosy-font-body)',
              color: 'var(--dosy-fg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontWeight: 700, fontSize: 14.5, color: 'var(--dosy-fg)',
                  margin: 0, letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  fontFamily: 'var(--dosy-font-display)',
                }}>{u.name || u.email.split('@')[0]}</p>
                <p style={{
                  fontSize: 12, color: 'var(--dosy-fg-secondary)',
                  margin: '2px 0 0 0',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{u.email}</p>
                <p style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0' }}>
                  {u.patientsCount} paciente(s) · {u.treatmentsCount} tratamento(s)
                </p>
                <p style={{
                  fontSize: 11, color: 'var(--dosy-fg-tertiary)',
                  margin: '4px 0 0 0',
                }}>
                  Criado em {formatDate(u.createdAt)}
                  {u.expiresAt && ` · expira ${formatDate(u.expiresAt)}`}
                </p>
              </div>
              <StatusPill
                label={TIER_LABELS[u.effectiveTier]}
                kind={TIER_PILL_KIND[u.effectiveTier] || 'pending'}
              />
            </div>
          </button>
        ))}
      </div>

      <GrantSheet user={selected} onClose={() => setSelected(null)} />
    </motion.div>
  )
}

const TIERS = [
  { key: 'free',  label: 'Free',  desc: 'Sem PRO',     accent: 'var(--dosy-fg-tertiary)' },
  { key: 'plus',  label: 'PLUS',  desc: 'Tudo + ads',  accent: '#C5841A' },
  { key: 'pro',   label: 'PRO',   desc: 'Tudo, sem ads', accent: '#3F9E7E' },
  { key: 'admin', label: 'Admin', desc: 'Painel total', accent: 'var(--dosy-primary)' },
]

function GrantSheet({ user, onClose }) {
  const grant = useGrantTier()
  const toast = useToast()
  const [tier, setTier] = useState(user?.effectiveTier === 'free' ? 'pro' : (user?.effectiveTier || 'pro'))
  const [mode, setMode] = useState('forever')
  const [days, setDays] = useState(30)
  const [until, setUntil] = useState('')

  useEffect(() => {
    if (!user) return
    setTier(user.effectiveTier === 'free' ? 'pro' : user.effectiveTier)
    setMode('forever')
  }, [user?.userId])

  if (!user) return null

  async function apply() {
    let expiresAt = null
    if (tier !== 'free') {
      if (mode === 'days') {
        const d = new Date(); d.setDate(d.getDate() + Number(days)); expiresAt = d.toISOString()
      } else if (mode === 'until') {
        expiresAt = until ? new Date(until).toISOString() : null
      }
    }
    try {
      await grant.mutateAsync({ userId: user.userId, tier, expiresAt, source: 'admin_panel' })
      toast.show({ message: `Acesso atualizado para ${user.name || user.email}.`, kind: 'success' })
      onClose()
    } catch (err) {
      toast.show({ message: err.message || 'Falha ao conceder.', kind: 'error' })
    }
  }

  return (
    <Sheet open={!!user} onClose={onClose} title={user.name || user.email}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Current tier info */}
        <div style={{
          fontSize: 12, color: 'var(--dosy-fg-secondary)',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <p style={{ margin: 0 }}>
            Tier atual: <strong style={{ color: 'var(--dosy-fg)' }}>{TIER_LABELS[user.effectiveTier]}</strong>
          </p>
          {user.expiresAt && <p style={{ margin: 0 }}>Expira em {formatDateTime(user.expiresAt)}</p>}
          <p style={{ margin: 0 }}>
            {user.patientsCount} paciente(s) · {user.treatmentsCount} tratamento(s)
          </p>
        </div>

        {/* Tier picker */}
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--dosy-fg-secondary)',
            margin: '0 0 8px 0',
            fontFamily: 'var(--dosy-font-display)',
          }}>Escolher plano</p>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
          }}>
            {TIERS.map((t) => {
              const active = tier === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTier(t.key)}
                  className="dosy-press"
                  style={{
                    padding: 14, textAlign: 'left',
                    background: active ? 'var(--dosy-bg-elevated)' : 'var(--dosy-bg-sunken)',
                    border: active ? `2px solid ${t.accent}` : '2px solid transparent',
                    borderRadius: 14,
                    cursor: 'pointer',
                    boxShadow: active ? 'var(--dosy-shadow-sm)' : 'none',
                    fontFamily: 'var(--dosy-font-body)',
                  }}
                >
                  <p style={{
                    fontFamily: 'var(--dosy-font-display)',
                    fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em',
                    color: active ? t.accent : 'var(--dosy-fg)',
                    margin: 0,
                  }}>{t.label}</p>
                  <p style={{
                    fontSize: 11, color: 'var(--dosy-fg-secondary)',
                    margin: '2px 0 0 0',
                  }}>{t.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Duration */}
        {tier !== 'free' && (
          <div>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--dosy-fg-secondary)',
              margin: '0 0 8px 0',
              fontFamily: 'var(--dosy-font-display)',
            }}>Duração</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip size="sm" active={mode === 'forever'} onClick={() => setMode('forever')}>Para sempre</Chip>
              <Chip size="sm" active={mode === 'days'} onClick={() => setMode('days')}>Por N dias</Chip>
              <Chip size="sm" active={mode === 'until'} onClick={() => setMode('until')}>Até data</Chip>
            </div>
            {mode === 'days' && (
              <div style={{ marginTop: 10 }}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  placeholder="Dias"
                />
              </div>
            )}
            {mode === 'until' && (
              <div style={{ marginTop: 10 }}>
                <Input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {tier === 'free' && (
          <p style={{
            fontSize: 12, color: 'var(--dosy-fg-secondary)',
            background: 'var(--dosy-warning-bg)',
            border: '1px solid rgba(197,132,26,0.2)',
            borderRadius: 12,
            padding: 12,
            margin: 0, lineHeight: 1.5,
          }}>
            Usuário volta para plano grátis imediatamente. Assinatura PRO removida.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <Button kind="ghost" full onClick={onClose}>Cancelar</Button>
          <Button kind="primary" full onClick={apply} disabled={grant.isPending}>
            {grant.isPending ? 'Aplicando…' : `Aplicar ${TIER_LABELS[tier]}`}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
