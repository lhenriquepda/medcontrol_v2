import { useMyTier } from '../hooks/useSubscription'

const LABELS = { free: 'FREE', plus: 'PLUS', pro: 'PRO', admin: 'ADMIN' }
const STYLES = {
  free: 'bg-white/20 text-white ring-1 ring-white/30',
  plus: 'bg-sky-400 text-sky-950',
  pro: 'bg-emerald-400 text-emerald-950',
  admin: 'bg-rose-500 text-white'
}

// Cores sólidas pra dot mode (header compacto)
const DOT_COLORS = {
  free: 'bg-slate-300',
  plus: 'bg-sky-400',
  pro: 'bg-emerald-400',
  admin: 'bg-rose-500'
}

/**
 * Tier indicator. 3 modes:
 *   - dot (default header): bolinha colorida só
 *   - badge (default elsewhere): chip com texto
 *   - large (Ajustes destaque): chip maior com texto
 */
export default function TierBadge({ variant = 'badge', className = '' }) {
  const { data: tier = 'free' } = useMyTier()

  if (variant === 'dot') {
    return (
      <span
        aria-label={`Plano ${LABELS[tier]}`}
        title={LABELS[tier]}
        className={`inline-block w-2.5 h-2.5 rounded-full ${DOT_COLORS[tier]} ${className}`}
      />
    )
  }

  if (variant === 'large') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm font-bold tracking-wider px-3 py-1 rounded-full ${STYLES[tier]} ${className}`}>
        <span className={`w-2 h-2 rounded-full ${tier === 'free' ? 'bg-white' : 'bg-current opacity-60'}`} />
        {LABELS[tier]}
      </span>
    )
  }

  return (
    <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full ${STYLES[tier]} ${className}`}>
      {LABELS[tier]}
    </span>
  )
}
