import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Icon from '../components/Icon'
import PaywallModal from '../components/PaywallModal'
import AdBanner from '../components/AdBanner'
import { useAuth } from '../hooks/useAuth'
import { displayName, initial } from '../utils/userDisplay'
import { useIsAdmin, useIsPro, useMyTier } from '../hooks/useSubscription'
import { TIER_LABELS, TIER_COLORS_BOLD as TIER_COLORS } from '../utils/tierUtils'

const ITEMS = [
  { to: '/historico', icon: 'calendar', label: 'Histórico', hint: 'Doses por dia, adesão', pro: false },
  { to: '/tratamentos', icon: 'pill', label: 'Tratamentos', hint: 'Lista e gerenciamento', pro: false },
  { to: '/relatorios-analise', icon: 'bar-chart', label: 'Análises', hint: 'Adesão e calendários', pro: true },
  { to: '/relatorios', icon: 'file-text', label: 'Relatórios', hint: 'Exportar PDF / CSV', pro: true },
  { to: '/ajustes', icon: 'settings', label: 'Ajustes', hint: 'Tema, notificações, conta', pro: false }
]

export default function More() {
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const isPro = useIsPro()
  const { data: tier = 'free' } = useMyTier()
  const [paywall, setPaywall] = useState(false)
  const nav = useNavigate()

  function handleItem(it, e) {
    if (it.pro && !isPro) {
      e.preventDefault()
      setPaywall(true)
    }
  }

  return (
    <div className="pb-28">
      <Header title="Mais" />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-4">
        <AdBanner />
        {user && (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl font-bold">
              {initial(user)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{displayName(user)}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
              <p className="text-[10px] text-slate-400">Plano <strong>{TIER_LABELS[tier]}</strong></p>
            </div>
            <span className={`chip ${TIER_COLORS[tier]}`}>{TIER_LABELS[tier]}</span>
          </div>
        )}

        {tier === 'free' && (
          <button onClick={() => setPaywall(true)}
                  className="w-full rounded-2xl p-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-left active:scale-[0.99]">
            <p className="font-bold">Conheça o Dosy PRO</p>
            <p className="text-xs opacity-90">Pacientes ilimitados · Relatórios · Análises</p>
          </button>
        )}

        <div className="space-y-1">
          {ITEMS.map((it) => {
            const locked = it.pro && !isPro
            return (
              <Link key={it.to} to={it.to}
                    onClick={(e) => handleItem(it, e)}
                    className={`card p-4 flex items-center gap-3 active:scale-[0.99] ${locked ? 'opacity-60' : ''}`}>
                <span className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300 flex items-center justify-center shrink-0">
                  <Icon name={it.icon} size={22} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {it.label}
                    {locked && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 inline-flex items-center gap-1">
                        <Icon name="lock" size={11} /> PRO
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{it.hint}</p>
                </div>
                <Icon name={locked ? 'lock' : 'chevron'} size={18} className="text-slate-400 shrink-0" />
              </Link>
            )
          })}

          {isAdmin && (
            <Link to="/admin" className="card p-4 flex items-center gap-3 active:scale-[0.99] border-2 border-rose-200 dark:border-rose-500/30">
              <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                <Icon name="crown" size={22} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium">Painel Admin</p>
                <p className="text-xs text-slate-500">Gerenciar usuários e assinaturas</p>
              </div>
              <Icon name="chevron" size={18} className="text-slate-400 shrink-0" />
            </Link>
          )}
        </div>

      </div>

      <PaywallModal open={paywall} onClose={() => setPaywall(false)} />
    </div>
  )
}
