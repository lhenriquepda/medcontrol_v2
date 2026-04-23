import { useMyTier } from '../hooks/useSubscription'

const LABELS = { free: 'FREE', pro: 'PRO', admin: 'ADMIN' }
const STYLES = {
  free: 'bg-white/20 text-white ring-1 ring-white/30',
  pro: 'bg-emerald-400 text-emerald-950',
  admin: 'bg-rose-500 text-white'
}

export default function TierBadge({ className = '' }) {
  const { data: tier = 'free' } = useMyTier()
  return (
    <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full ${STYLES[tier]} ${className}`}>
      {LABELS[tier]}
    </span>
  )
}
