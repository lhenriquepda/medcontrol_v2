import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useShowAds } from '../hooks/useSubscription'

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || ''
const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT || ''

const isNative = Capacitor.isNativePlatform()

/**
 * In-flow ad slot — só usado quando há `VITE_ADSENSE_CLIENT/SLOT` configurados (web).
 * Native AdMob banner é overlay global gerenciado por `useAdMobBanner()` em App.jsx.
 *
 * Estado atual: foco mobile. Sem AdSense configurado → componente retorna null silencioso.
 */
export default function AdBanner({ className = '' }) {
  const showAds = useShowAds()
  const ref = useRef(null)
  const [adsenseLoaded, setAdsenseLoaded] = useState(false)

  useEffect(() => {
    if (!showAds || isNative || adsenseLoaded) return
    if (!ADSENSE_CLIENT || !ADSENSE_SLOT) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      setAdsenseLoaded(true)
    } catch {}
  }, [showAds, adsenseLoaded])

  if (!showAds) return null
  if (isNative) return null
  if (!ADSENSE_CLIENT || !ADSENSE_SLOT) return null

  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 text-center mb-1">Publicidade</p>
      <ins ref={ref} className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client={ADSENSE_CLIENT}
           data-ad-slot={ADSENSE_SLOT}
           data-ad-format="auto"
           data-full-width-responsive="true" />
    </div>
  )
}
