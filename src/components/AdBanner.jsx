import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useShowAds } from '../hooks/useSubscription'

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || ''
const ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT || ''

// AdMob test IDs (production: replace with real ad unit IDs from AdMob console)
// Google test banner: ca-app-pub-3940256099942544/6300978111
const ADMOB_BANNER_ANDROID = import.meta.env.VITE_ADMOB_BANNER_ANDROID || 'ca-app-pub-3940256099942544/6300978111'

const isNative = Capacitor.isNativePlatform()

/**
 * Discreet ad banner. Only renders for free users.
 * Native (Capacitor Android): AdMob banner via @capacitor-community/admob.
 * Web: AdSense ins block.
 * Fallback (no IDs): placeholder card.
 */
export default function AdBanner({ className = '' }) {
  const showAds = useShowAds()
  const ref = useRef(null)
  const [adsenseLoaded, setAdsenseLoaded] = useState(false)
  const [admobLoaded, setAdmobLoaded] = useState(false)

  // AdMob (native) — singleton via window flag, evita flicker em nav entre páginas
  useEffect(() => {
    if (!showAds || !isNative) return
    if (typeof window !== 'undefined' && window.__dosyAdMobShown) {
      setAdmobLoaded(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { AdMob, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob')
        await AdMob.initialize({ initializeForTesting: !import.meta.env.PROD })
        if (cancelled) return
        await AdMob.showBanner({
          adId: ADMOB_BANNER_ANDROID,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.TOP_CENTER,
          margin: 56  // abaixo do AppHeader (~56dp)
        })
        if (!cancelled) {
          window.__dosyAdMobShown = true
          setAdmobLoaded(true)
        }
      } catch (e) {
        console.warn('[AdMob] init/show failed:', e?.message)
      }
    })()
    return () => { cancelled = true }
    // No removeBanner on unmount — singleton persists across navigation
  }, [showAds])

  // AdSense (web)
  useEffect(() => {
    if (!showAds || isNative || adsenseLoaded) return
    if (!ADSENSE_CLIENT || !ADSENSE_SLOT) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      setAdsenseLoaded(true)
    } catch {}
  }, [showAds, adsenseLoaded])

  if (!showAds) return null

  // Native + AdMob real ad: rendered as overlay by AdMob plugin (BOTTOM_CENTER, margin 56dp).
  // Show a small in-flow card so user knows where ad space lives + visual continuity with web.
  if (isNative) {
    // AdMob banner é overlay TOP_CENTER global. Não renderizar in-flow no native.
    return null
  }

  // Web: AdSense or placeholder
  if (!ADSENSE_CLIENT || !ADSENSE_SLOT) {
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
           data-ad-client={ADSENSE_CLIENT}
           data-ad-slot={ADSENSE_SLOT}
           data-ad-format="auto"
           data-full-width-responsive="true" />
    </div>
  )
}
