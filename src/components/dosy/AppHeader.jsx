/**
 * Dosy AppHeader — release v0.2.0.0 redesign.
 * Source design: contexto/claude-design/dosy/project/src/Primitives.jsx (AppHeader).
 *
 * Sticky top, glass blur bg. Logo wordmark (inverte em dark via filter) +
 * greeting compacta + tier dot + BellAlerts (R3 padrão consolidado:
 * overdue, update available, future alerts) + Settings cog.
 *
 * MANTÉM lógica/comportamento legacy:
 * - useDoses overdue lookup (mesmo filter window 90d)
 * - useAuth current user → firstName(user) na saudação
 * - useAppUpdate detecta update available → BellAlerts mostra
 * - navigate('/?filter=overdue') ao tap atrasadas
 * - Link to '/' no logo (volta Dashboard)
 * - Link to '/ajustes' no settings cog
 * - ResizeObserver pra --app-header-height (FilterBar offset)
 * - safe-area-inset-top + ad-banner-height + update-banner-height no top
 */
import { useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon } from 'lucide-react'
import TierBadge from '../TierBadge'
import { BellAlerts } from './BellAlerts'
import { useAuth } from '../../hooks/useAuth'
import { useDoses } from '../../hooks/useDoses'
import { useAppUpdate } from '../../hooks/useAppUpdate'
import { firstName } from '../../utils/userDisplay'
import logoMonoDark from '../../assets/dosy/logo-mono-dark.png'

export default function DosyAppHeader() {
  const { user } = useAuth()
  const nav = useNavigate()
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const name = firstName(user) || ''

  // Overdue window — 90d. Mantém comportamento legacy (sem `to` pra refetch
  // detectar dose recém-overdue dynamic).
  const overdueFilter = useMemo(() => {
    const from = new Date()
    from.setDate(from.getDate() - 90)
    return { from: from.toISOString(), status: 'overdue' }
  }, [])
  const { data: overdueDoses = [] } = useDoses(overdueFilter)
  // Filter por status atual: cache patch (mark taken/skipped) muta dose dentro do
  // array sem alterar length. Sem este filter, sino fica com count stale após
  // user marcar overdue como tomada/pulada/encerrar tratamento.
  const overdueCount = overdueDoses.filter((d) => d.status === 'overdue').length

  // App update — integra mesmo padrão BellAlerts via R3
  const { available: updateAvailable, latest, startUpdate } = useAppUpdate()

  // Build alerts array — passa pra BellAlerts. Outros tipos (avisos sistema)
  // adicionam aqui no futuro.
  const alerts = useMemo(() => {
    const arr = []
    if (overdueCount > 0) {
      arr.push({
        id: 'overdue',
        kind: 'danger',
        message: `${overdueCount} dose${overdueCount > 1 ? 's' : ''} atrasada${overdueCount > 1 ? 's' : ''}`,
        count: overdueCount,
        onClick: () => nav('/?filter=overdue'),
      })
    }
    if (updateAvailable && latest?.version) {
      arr.push({
        id: 'update',
        kind: 'update',
        message: `Atualizar pra v${latest.version}`,
        count: 1,
        onClick: () => startUpdate(),
      })
    }
    return arr
  }, [overdueCount, updateAvailable, latest, nav, startUpdate])

  // ResizeObserver — mantém --app-header-height pra FilterBar offset legacy
  const headerRef = useRef(null)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return undefined
    const update = () => {
      const h = el.offsetHeight || 0
      document.documentElement.style.setProperty('--app-header-height', `${h}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <header
      ref={headerRef}
      style={{
        position: 'sticky',
        // safe-area + ad-banner + update-banner offsets legacy
        top: 'calc(env(safe-area-inset-top, 0px) + var(--ad-banner-height, 0px) + var(--update-banner-height, 0px))',
        zIndex: 40,
        // Glass blur bg — content scrolls behind blurred
        background: 'color-mix(in oklab, var(--dosy-bg) 86%, transparent)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--dosy-border)',
        fontFamily: 'var(--dosy-font-body)',
        color: 'var(--dosy-fg)',
      }}
    >
      <div
        style={{
          maxWidth: 448,
          margin: '0 auto',
          padding: '14px 22px 10px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Logo wordmark — Link to / (Dashboard) */}
          <Link to="/" aria-label="Início" style={{ display: 'flex', flexShrink: 0 }}>
            <img
              src={logoMonoDark}
              alt="Dosy"
              className="dosy-wordmark"
              style={{ height: 22, width: 'auto', display: 'block' }}
            />
          </Link>

          {/* Greeting + tier dot */}
          <div style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center',
            gap: 6, justifyContent: 'flex-end',
          }}>
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: 'var(--dosy-fg-secondary)',
              letterSpacing: '-0.01em', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {greet}
              {name && <>, <span style={{ color: 'var(--dosy-fg)', fontWeight: 700 }}>{name}</span></>}
            </span>
            <TierBadge variant="dot" />
          </div>

          {/* Bell + alerts (overdue + update + future) */}
          <BellAlerts alerts={alerts} />

          {/* Settings cog */}
          <Link
            to="/ajustes"
            aria-label="Ajustes"
            className="dosy-press"
            style={{
              width: 38, height: 38, borderRadius: 9999,
              background: 'var(--dosy-bg-elevated)',
              color: 'var(--dosy-fg)',
              boxShadow: 'var(--dosy-shadow-sm)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              textDecoration: 'none',
            }}
          >
            <SettingsIcon size={18} strokeWidth={1.75}/>
          </Link>
        </div>
      </div>
    </header>
  )
}
