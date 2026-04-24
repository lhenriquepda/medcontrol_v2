import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Header from '../components/Header'
import BottomSheet from '../components/BottomSheet'
import { SkeletonList } from '../components/Skeleton'
import { useAllUsers, useGrantTier, useIsAdmin, useMyTier } from '../hooks/useSubscription'
import { useToast } from '../hooks/useToast'
import { formatDate, formatDateTime } from '../utils/dateUtils'
import { TIER_LABELS, TIER_COLORS_SUBTLE as TIER_COLORS } from '../utils/tierUtils'

export default function Admin() {
  const isAdmin = useIsAdmin()
  const { isLoading: tierLoading } = useMyTier()
  const { data: users = [], isLoading } = useAllUsers()
  const [selected, setSelected] = useState(null)

  if (tierLoading) return <div className="p-4 text-sm text-slate-500">Carregando…</div>
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="pb-28">
      <Header back title="Painel Admin" subtitle={`${users.length} usuário(s)`} />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-2">
        {isLoading ? <SkeletonList count={4} /> : users.map((u) => (
          <button key={u.userId} onClick={() => setSelected(u)}
                  className="w-full text-left card p-4 active:scale-[0.99]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{u.name || u.email.split('@')[0]}</p>
                <p className="text-xs text-slate-500 truncate">{u.email}</p>
                <p className="text-xs text-slate-500">
                  {u.patientsCount} paciente(s) · {u.treatmentsCount} tratamento(s)
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Criado em {formatDate(u.createdAt)}
                  {u.expiresAt && ` · expira ${formatDate(u.expiresAt)}`}
                </p>
              </div>
              <span className={`chip ${TIER_COLORS[u.effectiveTier]}`}>{TIER_LABELS[u.effectiveTier]}</span>
            </div>
          </button>
        ))}
      </div>

      <GrantSheet user={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function GrantSheet({ user, onClose }) {
  const grant = useGrantTier()
  const toast = useToast()
  const [tier, setTier] = useState(user?.effectiveTier === 'free' ? 'pro' : (user?.effectiveTier || 'pro'))
  const [mode, setMode] = useState('forever') // forever | days | until
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

  const TIERS = [
    { key: 'free', label: 'Free', desc: 'Sem PRO', tone: 'slate' },
    { key: 'pro', label: 'PRO', desc: 'Tudo liberado', tone: 'emerald' },
    { key: 'admin', label: 'Admin', desc: 'Painel total', tone: 'rose' }
  ]
  const TONE_ACTIVE = {
    slate: 'bg-slate-700 text-white ring-2 ring-slate-400',
    emerald: 'bg-emerald-600 text-white ring-2 ring-emerald-300',
    rose: 'bg-rose-600 text-white ring-2 ring-rose-300'
  }

  return (
    <BottomSheet open={!!user} onClose={onClose} title={user.name || user.email}>
      <div className="space-y-4">
        <div className="text-xs text-slate-500 space-y-0.5">
          <p>Tier atual: <strong>{TIER_LABELS[user.effectiveTier]}</strong></p>
          {user.expiresAt && <p>Expira em {formatDateTime(user.expiresAt)}</p>}
          <p>{user.patientsCount} paciente(s) · {user.treatmentsCount} tratamento(s)</p>
        </div>

        <div>
          <p className="text-xs font-medium mb-2">Escolher plano</p>
          <div className="grid grid-cols-3 gap-2">
            {TIERS.map((t) => {
              const active = tier === t.key
              return (
                <button key={t.key} onClick={() => setTier(t.key)}
                        className={`rounded-xl p-3 text-left transition ${active ? TONE_ACTIVE[t.tone] : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                  <p className="font-bold text-sm">{t.label}</p>
                  <p className={`text-[10px] ${active ? 'opacity-90' : 'text-slate-500'}`}>{t.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {tier !== 'free' && (
          <div>
            <p className="text-xs font-medium mb-2">Duração</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setMode('forever')}
                      className={`chip ${mode === 'forever' ? 'chip-active' : ''}`}>Para sempre</button>
              <button type="button" onClick={() => setMode('days')}
                      className={`chip ${mode === 'days' ? 'chip-active' : ''}`}>Por N dias</button>
              <button type="button" onClick={() => setMode('until')}
                      className={`chip ${mode === 'until' ? 'chip-active' : ''}`}>Até data</button>
            </div>
            {mode === 'days' && (
              <input type="number" min={1} className="input mt-2" value={days}
                     onChange={(e) => setDays(e.target.value)} placeholder="Dias" />
            )}
            {mode === 'until' && (
              <input type="datetime-local" className="input mt-2" value={until}
                     onChange={(e) => setUntil(e.target.value)} />
            )}
          </div>
        )}

        {tier === 'free' && (
          <p className="text-xs text-slate-500 rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
            Usuário volta para plano grátis imediatamente. Assinatura PRO removida.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={apply} disabled={grant.isPending}>
            {grant.isPending ? 'Aplicando…' : `Aplicar ${TIER_LABELS[tier]}`}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
