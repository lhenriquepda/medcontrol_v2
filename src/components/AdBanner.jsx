import { useEffect, useRef, useState } from 'react'
import { useIsPro } from '../hooks/useSubscription'

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || ''
const SLOT = import.meta.env.VITE_ADSENSE_SLOT || ''

/**
 * Discreet AdSense banner. Only renders for free users.
 * If AdSense env vars are missing, renders a placeholder so layout is visible in dev.
 */
export default function AdBanner({ className = '' }) {
  const isPro = useIsPro()
  const ref = useRef(null)
  const [pushed, setPushed] = useState(false)

  useEffect(() => {
    if (isPro) return
    if (!CLIENT || !SLOT) return
    if (pushed) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      setPushed(true)
    } catch {}
  }, [isPro, pushed])

  if (isPro) return null

  if (!CLIENT || !SLOT) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 text-center ${className}`}>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Publicidade</p>
        <p className="text-xs text-slate-500 mt-1">Espaço reservado · integra AdSense quando publicado</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 text-center mb-1">Publicidade</p>
      <ins ref={ref} className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client={CLIENT}
           data-ad-slot={SLOT}
           data-ad-format="auto"
           data-full-width-responsive="true" />
    </div>
  )
}
