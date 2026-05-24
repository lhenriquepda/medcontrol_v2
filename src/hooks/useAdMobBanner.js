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
 * v0.2.6.5 — Margem topo do banner AdMob (DP) por device.
 *
 * AdMob banner usa coordenadas ABSOLUTAS da tela (não relativas ao WebView),
 * mesmo com `StatusBar.setOverlaysWebView({ overlay: false })`. `margin: 0`
 * coloca o ad EM CIMA da status bar (battery/clock/notch covered).
 *
 * MainActivity.java mede WindowInsetsCompat.statusBars + displayCutout nativamente
 * e injeta como CSS var `--system-status-bar-height` + `window.__dosySystemStatusBarHeight`.
 * Lemos esse valor — funciona corretamente em qualquer device (Pixel punch-hole 32dp,
 * Samsung notch 44dp, devices antigos sem notch 24dp).
 *
 * Fallback 30 DP cobre caso edge (race antes do native injetar) — Android típico.
 */
const STATUS_BAR_MARGIN_FALLBACK_DP = 30

function getStatusBarTopMargin() {
  if (typeof window === 'undefined') return STATUS_BAR_MARGIN_FALLBACK_DP
  try {
    // 1) Tentar variável JS injetada pelo MainActivity (rápido, sem layout)
    if (typeof window.__dosySystemStatusBarHeight === 'number' && window.__dosySystemStatusBarHeight > 0) {
      return window.__dosySystemStatusBarHeight
    }
    // 2) Fallback: ler CSS var (caso JS ainda não tenha sido populado mas CSS foi)
    const cssVal = getComputedStyle(document.documentElement)
      .getPropertyValue('--system-status-bar-height').trim()
    const cssPx = parseInt(cssVal, 10)
    if (Number.isFinite(cssPx) && cssPx > 0) return cssPx
  } catch { /* ignore */ }
  return STATUS_BAR_MARGIN_FALLBACK_DP
}

/** Aguarda até timeoutMs pela injeção do status bar height pelo native (com listener event). */
function waitForStatusBarHeight(timeoutMs = 500) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve()
    if (typeof window.__dosySystemStatusBarHeight === 'number' && window.__dosySystemStatusBarHeight > 0) {
      return resolve()
    }
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.removeEventListener('dosy:statusBarHeight', finish)
      resolve()
    }
    window.addEventListener('dosy:statusBarHeight', finish, { once: true })
    setTimeout(finish, timeoutMs)
  })
}

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
          // Listeners — registrados ANTES showBanner pra não perder primeiros eventos.
          // v0.2.6.7 FIX #E01 [QA real 2026-05-24]: evento correto é `bannerAdSizeChanged`
          // (vide @capacitor-community/admob `BannerAdPluginEvents.SizeChanged.webEventName`).
          // Antes era `bannerAdSize` (typo): logcat `Capacitor/AdMob: No listeners found
          // for event bannerAdSizeChanged` x3 por refresh ad. CSS var `--ad-banner-height`
          // ficava fixo em 60px fallback (pre-apply linha 137) sem ajustar pra altura real.
          AdMob.addListener('bannerAdSizeChanged', (info) => {
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

          // v0.2.6.5 fix: amarrar `initializeForTesting` ao uso do TEST_AD_UNIT (não ao
          // build mode). `vite build` seta PROD=true, então `!PROD=false` → modo prod com
          // test slot = NO_FILL imediato (Google rejeita real ad request em test slot).
          // Quando usando test ad unit, SEMPRE precisa initializeForTesting:true +
          // testingDevices:['EMULATOR'] pra forçar test mode garantido.
          const isUsingTestAd = ADMOB_BANNER_ANDROID === TEST_AD_UNIT
          await AdMob.initialize({
            initializeForTesting: isUsingTestAd,
            testingDevices: isUsingTestAd ? ['EMULATOR'] : undefined,
          })
          if (cancelled) return

          // PRE-APLICA padding default ANTES do showBanner pra evitar race condition.
          // Banner native overlay renderiza rápido (~ms); listeners bannerAdLoaded/AdSize
          // chegam depois. #113: 60px é altura típica banner ADAPTIVE_BANNER (50dp ~50-65
          // px content + minimal scaling). bannerAdSize listener corrige pra real ms depois.
          document.documentElement.style.setProperty('--ad-banner-height', '60px')
          document.body.classList.add('has-ad-banner')

          // v0.2.3.6 #262 REVERT: banner TOP_CENTER. User feedback 2026-05-15
          // confirmou que TOP era certo (ad no topo, abaixo da status bar e
          // ANTES do header Dosy). BOTTOM_CENTER tentado causou regressão visual.
          // v0.2.6.5: aguarda native injetar status bar height (até 500ms).
          // MainActivity.injectStatusBarHeightCssVar dispara em 0/500/2000ms post-layout.
          // Sem wait, race condition pode usar fallback 30 antes do valor real chegar.
          await waitForStatusBarHeight(500)
          // `margin` dinâmico do device — funciona em Pixel/Samsung/devices antigos.
          const statusBarMargin = getStatusBarTopMargin()
          console.log('[AdMob] showBanner margin (DP):', statusBarMargin, 'adId:', ADMOB_BANNER_ANDROID)
          await AdMob.showBanner({
            adId: ADMOB_BANNER_ANDROID,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.TOP_CENTER,
            margin: statusBarMargin
          })
          console.log('[AdMob] showBanner returned OK')

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
