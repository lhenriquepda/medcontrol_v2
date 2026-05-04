/**
 * Dosy AppHeader — release v0.2.0.3 redesign #116.
 *
 * Sticky top, glass blur bg. Logo wordmark + greeting + tier dot +
 * direct-action alert icons + Settings cog.
 *
 * Item #116 (release v0.2.0.3): sino dropdown SUBSTITUÍDO por ícones
 * diretos. Cada tipo de alerta = ícone próprio com badge + click direto.
 * Padrão WhatsApp/Gmail: glance imediato, 1 tap pra ação.
 *
 * Tipos de alerta (renderizados condicionalmente — só aparece se count > 0):
 *   - AlertCircle (danger)  → doses atrasadas → /?filter=overdue
 *   - Users (info)          → paciente compartilhado novo → /pacientes
 *   - Pill (warning)        → tratamento acabando ≤3d → /pacientes
 *   - Download (update)     → app update disponível → startUpdate()
 *
 * UpdateBanner verde no topo é mantido (redundância intencional —
 * banner full-width chama atenção, ícone permite acesso rápido).
 */
import { useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Settings as SettingsIcon,
  AlertCircle,
  Users,
  Pill,
  Download,
} from 'lucide-react'
import TierBadge from '../TierBadge'
import HeaderAlertIcon from './HeaderAlertIcon'
import { useAuth } from '../../hooks/useAuth'
import { useDoses } from '../../hooks/useDoses'
import { useTreatments } from '../../hooks/useTreatments'
import { useReceivedShares } from '../../hooks/useShares'
import { useAppUpdate } from '../../hooks/useAppUpdate'
import { firstName } from '../../utils/userDisplay'
import logoMonoDark from '../../assets/dosy/logo-mono-dark.png'

// localStorage keys — track "last seen" timestamps por tipo de alerta.
// Permite badge zerar quando user clica (sem persistir backend).
const LS_SHARES_SEEN = 'dosy_shares_seen_at'
const LS_ENDING_SEEN = 'dosy_ending_seen_at'

/**
 * Computa endDate de tratamento finito (não-contínuo).
 * Returns null pra tratamentos contínuos OU sem startDate/durationDays.
 */
function endingSoon(t, msHorizon) {
  if (t.isContinuous) return false
  if (t.status !== 'active') return false
  if (!t.startDate || !t.durationDays) return false
  const start = new Date(t.startDate).getTime()
  if (Number.isNaN(start)) return false
  const end = start + t.durationDays * 86_400_000
  const now = Date.now()
  return end >= now && end - now <= msHorizon
}

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

  // App update — Play Store In-App / web reload
  const { available: updateAvailable, startUpdate } = useAppUpdate()

  // Item #117: shares recebidos (paciente compartilhado comigo).
  // Compara createdAt vs lastSeen localStorage → conta NEW shares.
  const { data: receivedShares = [] } = useReceivedShares()
  const newSharesCount = useMemo(() => {
    const seenAt = localStorage.getItem(LS_SHARES_SEEN) || '1970-01-01T00:00:00Z'
    return receivedShares.filter((s) => s.createdAt > seenAt).length
  }, [receivedShares])

  // Item #118: tratamentos acabando ≤3 dias (não-contínuos, status active).
  const { data: treatments = [] } = useTreatments()
  const endingSoonList = useMemo(() => {
    const HORIZON = 3 * 86_400_000 // 3 dias
    return treatments.filter((t) => endingSoon(t, HORIZON))
  }, [treatments])
  const endingSoonNew = useMemo(() => {
    const seenAt = localStorage.getItem(LS_ENDING_SEEN) || '1970-01-01T00:00:00Z'
    // count only treatments cujo updatedAt > seenAt (notificou desde última visualização)
    // OR todos se nunca abriu — first-time user vê todos.
    return endingSoonList.filter((t) => (t.updatedAt || t.createdAt || '') > seenAt).length
  }, [endingSoonList])

  // Click handlers — limpam localStorage seen + navegam.
  const onClickOverdue = () => nav('/?filter=overdue')
  const onClickShares = () => {
    localStorage.setItem(LS_SHARES_SEEN, new Date().toISOString())
    nav('/pacientes')
  }
  const onClickEnding = () => {
    localStorage.setItem(LS_ENDING_SEEN, new Date().toISOString())
    nav('/pacientes')
  }
  const onClickUpdate = () => startUpdate()

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

          {/* Item #116: ícones de alerta diretos (sem dropdown).
              Cada ícone só renderiza se count > 0. */}
          {overdueCount > 0 && (
            <HeaderAlertIcon
              icon={AlertCircle}
              count={overdueCount}
              tone="danger"
              pulse
              onClick={onClickOverdue}
              ariaLabel={`${overdueCount} dose${overdueCount > 1 ? 's' : ''} atrasada${overdueCount > 1 ? 's' : ''}`}
            />
          )}
          {newSharesCount > 0 && (
            <HeaderAlertIcon
              icon={Users}
              count={newSharesCount}
              tone="info"
              onClick={onClickShares}
              ariaLabel={`${newSharesCount} paciente${newSharesCount > 1 ? 's' : ''} compartilhado${newSharesCount > 1 ? 's' : ''} comigo`}
            />
          )}
          {endingSoonNew > 0 && (
            <HeaderAlertIcon
              icon={Pill}
              count={endingSoonNew}
              tone="warning"
              onClick={onClickEnding}
              ariaLabel={`${endingSoonNew} tratamento${endingSoonNew > 1 ? 's' : ''} acabando em 3 dias`}
            />
          )}
          {updateAvailable && (
            <HeaderAlertIcon
              icon={Download}
              tone="update"
              onClick={onClickUpdate}
              ariaLabel="Atualização disponível"
            />
          )}

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
