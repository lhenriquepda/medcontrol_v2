import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, Pill, BarChart3, FileText, Settings as SettingsIcon, HelpCircle, Lock, ChevronRight, Crown } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import PaywallModal from '../components/PaywallModal'
import AdBanner from '../components/AdBanner'
import { Card, Avatar } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { useAuth } from '../hooks/useAuth'
import { displayName } from '../utils/userDisplay'
import { useIsAdmin, useIsPro, useMyTier } from '../hooks/useSubscription'
import { TIER_LABELS } from '../utils/tierUtils'

const ITEMS = [
  { to: '/historico',          Icon: Calendar,     label: 'Histórico',     hint: 'Doses por dia, adesão',           pro: false },
  { to: '/tratamentos',        Icon: Pill,         label: 'Tratamentos',   hint: 'Lista e gerenciamento',           pro: false },
  { to: '/relatorios-analise', Icon: BarChart3,    label: 'Análises',      hint: 'Adesão e calendários',            pro: true },
  { to: '/relatorios',         Icon: FileText,     label: 'Relatórios',    hint: 'Exportar PDF / CSV',              pro: true },
  { to: '/ajustes',            Icon: SettingsIcon, label: 'Ajustes',       hint: 'Tema, notificações, conta',       pro: false },
  { to: '/faq',                Icon: HelpCircle,   label: 'Ajuda / FAQ',   hint: 'Dúvidas, suporte e tutoriais',    pro: false },
]

const TIER_BADGE_STYLE = {
  free:  { background: 'var(--dosy-peach-100)',          color: 'var(--dosy-fg-secondary)' },
  plus:  { background: 'var(--dosy-info-bg)',            color: 'var(--dosy-info)' },
  pro:   { background: 'var(--dosy-gradient-sunset)',    color: 'var(--dosy-fg-on-sunset)' },
  admin: { background: 'var(--dosy-fg)',                 color: 'var(--dosy-bg)' },
}

export default function More() {
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const isPro = useIsPro()
  const { data: tier = 'free' } = useMyTier()
  const [paywall, setPaywall] = useState(false)

  function handleItem(it, e) {
    if (it.pro && !isPro) {
      e.preventDefault()
      setPaywall(true)
    }
  }

  return (
    <div style={{ paddingBottom: 110 }}>
      <PageHeader title="Mais" />

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AdBanner />

        {user && (
          <Card padding={16} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={displayName(user)} color="sunset" size={48}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--dosy-font-display)', fontWeight: 700, fontSize: 15,
                letterSpacing: '-0.01em', color: 'var(--dosy-fg)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{displayName(user)}</div>
              <div style={{
                fontSize: 12, color: 'var(--dosy-fg-secondary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{user.email}</div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
              padding: '4px 10px', borderRadius: 9999,
              ...(TIER_BADGE_STYLE[tier] || TIER_BADGE_STYLE.free),
              textTransform: 'uppercase', flexShrink: 0,
              fontFamily: 'var(--dosy-font-display)',
            }}>{TIER_LABELS[tier]}</span>
          </Card>
        )}

        {tier === 'free' && (
          <button
            type="button"
            onClick={() => setPaywall(true)}
            className="dosy-press"
            style={{
              width: '100%', textAlign: 'left',
              padding: 18,
              background: 'var(--dosy-gradient-sunset)',
              color: 'var(--dosy-fg-on-sunset)',
              border: 'none', borderRadius: 24,
              cursor: 'pointer',
              boxShadow: '0 16px 36px -10px rgba(255,61,127,0.4), 0 6px 14px -6px rgba(255,107,91,0.24)',
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: 'var(--dosy-font-body)',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Crown size={22} strokeWidth={1.75}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--dosy-font-display)',
                fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em',
              }}>Conheça o Dosy PRO</div>
              <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 2 }}>
                Pacientes ilimitados · Relatórios · Análises
              </div>
            </div>
            <ChevronRight size={20} strokeWidth={2}/>
          </button>
        )}

        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: TIMING.stagger } } }}
        >
          {ITEMS.map((it) => {
            const locked = it.pro && !isPro
            return (
              <motion.div
                key={it.to}
                variants={{
                  initial: { opacity: 0, x: 24 },
                  animate: { opacity: 1, x: 0, transition: { duration: TIMING.base, ease: EASE.inOut } },
                }}
              >
                <Link
                  to={it.to}
                  onClick={(e) => handleItem(it, e)}
                  className="dosy-press"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 14,
                    background: 'var(--dosy-bg-elevated)',
                    borderRadius: 18,
                    boxShadow: 'var(--dosy-shadow-sm)',
                    textDecoration: 'none',
                    color: 'var(--dosy-fg)',
                    opacity: locked ? 0.7 : 1,
                  }}
                >
                  <span style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: 'var(--dosy-peach-100)',
                    color: 'var(--dosy-primary)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <it.Icon size={22} strokeWidth={1.75}/>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 14.5,
                      display: 'flex', alignItems: 'center', gap: 6,
                      color: 'var(--dosy-fg)',
                    }}>
                      {it.label}
                      {locked && (
                        <span style={{
                          fontSize: 10, fontWeight: 800,
                          padding: '2px 6px',
                          background: 'var(--dosy-warning-bg)',
                          color: '#C5841A',
                          borderRadius: 6,
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          fontFamily: 'var(--dosy-font-display)',
                        }}>
                          <Lock size={10} strokeWidth={2}/> PRO
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 1 }}>
                      {it.hint}
                    </div>
                  </div>
                  {locked
                    ? <Lock size={16} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)', flexShrink: 0 }}/>
                    : <ChevronRight size={18} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)', flexShrink: 0 }}/>
                  }
                </Link>
              </motion.div>
            )
          })}

          {isAdmin && (
            <Link
              to="/admin"
              className="dosy-press"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 14,
                background: 'var(--dosy-bg-elevated)',
                borderRadius: 18,
                boxShadow: 'var(--dosy-shadow-sm)',
                border: '2px solid rgba(229,86,74,0.3)',
                textDecoration: 'none',
                color: 'var(--dosy-fg)',
              }}
            >
              <span style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'var(--dosy-danger-bg)',
                color: 'var(--dosy-danger)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Crown size={22} strokeWidth={1.75}/>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--dosy-fg)' }}>
                  Painel Admin
                </div>
                <div style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 1 }}>
                  Gerenciar usuários e assinaturas
                </div>
              </div>
              <ChevronRight size={18} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)', flexShrink: 0 }}/>
            </Link>
          )}
        </motion.div>
      </div>

      <PaywallModal open={paywall} onClose={() => setPaywall(false)} />
    </div>
  )
}
