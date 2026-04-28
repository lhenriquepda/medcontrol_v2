import { useState } from 'react'
import PaywallModal from './PaywallModal'
import Icon from './Icon'
import { useIsPro } from '../hooks/useSubscription'

/**
 * Wrap content that is PRO-only. For free users, dim + blur + show lock CTA.
 * Clicking opens paywall. For PRO/admin, just render children.
 */
export default function LockedOverlay({ children, reason, label = 'Recurso PRO' }) {
  const isPro = useIsPro()
  const [open, setOpen] = useState(false)
  if (isPro) return children
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40 blur-[2px]" aria-hidden>
        {children}
      </div>
      <button onClick={() => setOpen(true)}
              className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-center gap-2 rounded-full bg-slate-900/90 text-white text-xs font-semibold px-4 py-2 shadow-lg backdrop-blur">
          <Icon name="lock" size={14} /> {label}
        </span>
      </button>
      <PaywallModal open={open} onClose={() => setOpen(false)} reason={reason} />
    </div>
  )
}
