import { useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import TierBadge from './TierBadge'
import Icon from './Icon'
import { useAuth } from '../hooks/useAuth'
import { useDoses } from '../hooks/useDoses'
import { firstName } from '../utils/userDisplay'

export default function AppHeader() {
  const { user } = useAuth()
  const nav = useNavigate()
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const name = firstName(user)

  // Overdue window: doses pendentes nos últimos 90 dias.
  // SEM `to` — service computa overdue client-side (scheduledAt < now). Se `to` for fixado
  // no mount, doses agendadas DEPOIS do mount nunca entram no fetch (mobile bg-alive sofre).
  // refetchInterval 60s + listDoses usa `new Date()` interno → status atualiza a cada tick.
  const overdueFilter = useMemo(() => {
    const from = new Date()
    from.setDate(from.getDate() - 90)
    return { from: from.toISOString(), status: 'overdue' }
  }, [])

  const { data: overdueDoses = [] } = useDoses(overdueFilter)
  const overdueNow = overdueDoses.length

  // Measure AppHeader height → CSS var --app-header-height. FilterBar (sticky)
  // usa pra calcular offset correto. Padding dinâmico do header (safe-area)
  // muda altura conforme ad/banner presentes.
  const headerRef = useRef(null)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
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
      className="sticky z-40 bg-[#0d1535] text-white shadow-lg"
      style={{
        // env-safe + ad-banner + update-banner. AppHeader sticky bottom of stack.
        top: 'calc(env(safe-area-inset-top, 0px) + var(--ad-banner-height, 0px) + var(--update-banner-height, 0px))'
      }}
    >
      <div className="max-w-md mx-auto px-4 py-[21px] flex items-center gap-3">
        {/* Logo — clicável → volta pro Dashboard */}
        <Link to="/" className="flex-shrink-0">
          <img src="/dosy-logo-light.png" alt="Dosy" className="h-8 w-auto object-contain" />
        </Link>

        {/* Saudação */}
        <div className="flex-1 min-w-0 border-l border-white/20 pl-3">
          <p className="text-[11px] text-white/60 leading-none mb-0.5">{greet}</p>
          <p className="text-sm font-semibold truncate leading-tight flex items-center gap-1.5">
            {name || 'Olá!'} <TierBadge variant="dot" />
          </p>
        </div>

        {/* Badge doses atrasadas */}
        {overdueNow > 0 && (
          <button
            onClick={() => nav('/?filter=overdue')}
            aria-label="Ver doses atrasadas"
            className="text-[11px] font-semibold bg-rose-500 px-2 py-1 rounded-full animate-pulse active:scale-95 hover:bg-rose-400 transition flex-shrink-0"
          >
            {overdueNow} atrasada{overdueNow > 1 ? 's' : ''}
          </button>
        )}

        {/* Ajustes */}
        <motion.div whileTap={{ scale: 0.85, rotate: 60 }} className="flex-shrink-0">
          <Link
            to="/ajustes"
            aria-label="Ajustes"
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <Icon name="settings" size={20} className="text-white" />
          </Link>
        </motion.div>
      </div>
    </header>
  )
}
