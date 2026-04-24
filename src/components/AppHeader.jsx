import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TierBadge from './TierBadge'
import { useAuth } from '../hooks/useAuth'
import { useDoses } from '../hooks/useDoses'
import { firstName } from '../utils/userDisplay'

export default function AppHeader() {
  const { user } = useAuth()
  const nav = useNavigate()
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const name = firstName(user)

  // Overdue window: doses pendentes atrasadas nos últimos 30 dias
  const overdueFilter = useMemo(() => {
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - 30)
    return { from: from.toISOString(), to: now.toISOString(), status: 'overdue' }
  }, []) // stable key — query refetches every 60s automatically

  const { data: overdueDoses = [] } = useDoses(overdueFilter)
  const overdueNow = overdueDoses.length

  return (
    <header className="sticky top-0 z-40 bg-[#0d1535] text-white shadow-lg safe-top">
      <div className="max-w-md mx-auto px-4 pt-2 pb-3 flex items-center gap-3">
        {/* Logo — clicável → volta pro Dashboard */}
        <Link to="/" className="flex-shrink-0">
          <img src="/dosy-logo.png" alt="Dosy" className="h-10 w-auto object-contain" />
        </Link>

        {/* Saudação */}
        <div className="flex-1 min-w-0 border-l border-white/20 pl-3">
          <p className="text-[11px] text-white/60 leading-none mb-0.5">{greet}</p>
          <p className="text-sm font-semibold truncate leading-tight flex items-center gap-1.5">
            {name || 'Olá!'} <TierBadge />
          </p>
        </div>

        {/* Badge doses atrasadas */}
        {overdueNow > 0 && (
          <button
            onClick={() => nav('/')}
            aria-label="Ver doses atrasadas"
            className="text-[11px] font-semibold bg-rose-500 px-2 py-1 rounded-full animate-pulse active:scale-95 hover:bg-rose-400 transition flex-shrink-0"
          >
            {overdueNow} atrasada{overdueNow > 1 ? 's' : ''}
          </button>
        )}

        {/* Ajustes */}
        <Link
          to="/ajustes"
          aria-label="Ajustes"
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0"
        >
          <span className="text-lg">⚙</span>
        </Link>
      </div>
    </header>
  )
}
