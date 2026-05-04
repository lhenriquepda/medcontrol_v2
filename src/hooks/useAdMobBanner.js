import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { useShowAds } from './useSubscription'

// Real AdMob ad unit (em revisão, retorna no-fill até aprovação)
const REAL_AD_UNIT = import.meta.env.VITE_ADMOB_BANNER_ANDROID || ''
// Google sandbox banner ID — sempre fill, nunca contabiliza
const TEST_AD_UNIT = 'ca-app-pub-3940256099942544/6300978111'

const USE_TEST = String(import.meta.env.VITE_ADMOB_USE_TEST || 'false').toLowerCase() === 'true'

const ADMOB_BANNER_ANDROID = USE_TEST || !REAL_AD_UNIT ? TEST_AD_UNIT : REAL_AD_UNIT

const isNative = Capacitor.isNativePlatform()

/**
 * Singleton AdMob banner init/destroy hook.
 *
 * Mount EXACTLY ONCE at App root level (App.jsx), NOT in pages.
 *
 * Toggle test/real ad unit via VITE_ADMOB_USE_TEST env:
 *  - true (dev/internal testing): TEST_AD_UNIT (sandbox sempre fill, $0)
 *  - false (produção pós-aprovação AdMob): REAL_AD_UNIT
 *
 * Listeners:
 *  - bannerAdSize → CSS var `--ad-banner-height` baseada altura real (ADAPTIVE_BANNER varia per device)
 *  - bannerAdLoadFail → CSS var = 0px + classe removida (sem espaço vazio quando no-fill)
 *  - bannerAdLoaded → CSS var aplicada (banner real renderiza)
 */
export function useAdMobBanner() {
  const showAds = useShowAds()

  useEffect(() => {
    if (!isNative) return
    let cancelled = false

    ;(async () => {
      const mod = await import('@capacitor-community/admob').catch(() => ({}))
      const { AdMob, BannerAdPosition, BannerAdSize } = mod
      if (!AdMob) return

      if (showAds) {
        if (typeof window !== 'undefined' && window.__dosyAdMobShown) return

        try {
          // Listeners — registrados ANTES showBanner pra não perder primeiros eventos
          AdMob.addListener('bannerAdSize', (info) => {
            const h = info?.height
            if (typeof h === 'number' && h > 0) {
              // #113 [Note 10 fix 2026-05-04]: buffer +16 era exagerado, gerava
              // gap visual grande abaixo do ad em viewports menores (Note 10
              // ~80px gap). Plugin reporta altura content overlay real ~match.
              // +4 cobre rounding DP→CSS px sem inflar gap.
              document.documentElement.style.setProperty('--ad-banner-height', `${h + 4}px`)
            }
          }).catch(() => {})

          AdMob.addListener('bannerAdLoaded', () => {
            // Ad carregou — garante body class
            document.body.classList.add('has-ad-banner')
          }).catch(() => {})

          AdMob.addListener('bannerAdFailedToLoad', (err) => {
            console.warn('[AdMob] no-fill / load fail:', err)
            // No-fill = banner ocupa espaço vazio. Colapsa CSS var pra remover gap.
            document.documentElement.style.setProperty('--ad-banner-height', '0px')
            document.body.classList.remove('has-ad-banner')
          }).catch(() => {})

          await AdMob.initialize({ initializeForTesting: !import.meta.env.PROD })
          if (cancelled) return

          // PRE-APLICA padding default ANTES do showBanner pra evitar race condition.
          // Banner native overlay renderiza rápido (~ms); listeners bannerAdLoaded/AdSize
          // chegam depois. #113: 60px é altura típica banner ADAPTIVE_BANNER (50dp ~50-65
          // px content + minimal scaling). bannerAdSize listener corrige pra real ms depois.
          document.documentElement.style.setProperty('--ad-banner-height', '60px')
          document.body.classList.add('has-ad-banner')

          await AdMob.showBanner({
            adId: ADMOB_BANNER_ANDROID,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.TOP_CENTER,
            margin: 0
          })

          if (!cancelled) {
            window.__dosyAdMobShown = true
          }
        } catch (e) {
          console.warn('[AdMob] init/show failed:', e?.message)
        }
      } else if (typeof window !== 'undefined' && window.__dosyAdMobShown) {
        // Tier upgraded to PRO/admin OR signed out — remove banner.
        try {
          await AdMob.hideBanner()
          await AdMob.removeBanner()
          window.__dosyAdMobShown = false
          document.body.classList.remove('has-ad-banner')
          document.documentElement.style.removeProperty('--ad-banner-height')
        } catch (e) {
          console.warn('[AdMob] hide failed:', e?.message)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [showAds])
}
