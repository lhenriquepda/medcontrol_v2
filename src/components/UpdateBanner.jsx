import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppUpdate } from '../hooks/useAppUpdate'
import Icon from './Icon'
import { TIMING, EASE } from '../animations'

/**
 * Sticky banner exibido quando há nova versão disponível.
 *
 * Native (Android): Google Play In-App Updates flexible mode.
 *   - Banner aparece sempre que Play reporta update disponível
 *   - Tap "Atualizar" → Play prompt nativo → download em background
 *   - Banner mostra progresso (%) durante download
 *   - Quando baixado → vira "Reiniciar para instalar" → completeFlexibleUpdate()
 *   - Não dispensável (banner persiste até user atualizar)
 *
 * Web: legacy version.json check.
 *   - Tap "Atualizar" → reload bundle
 *   - Dispensável (X) — user escolhe quando atualizar
 */
export default function UpdateBanner() {
  const { available, latest, downloaded, progress, isNative, startUpdate, completeUpdate, dismiss } = useAppUpdate()
  const ref = useRef(null)

  // Mede própria altura → CSS var --update-banner-height. AppHeader/FilterBar
  // usam pra calcular offset sticky correto (empurra tudo pra baixo).
  // Toggle body.has-update-banner → status bar bleed verde (sangra banner).
  useEffect(() => {
    const el = ref.current
    if (!available || !el) {
      document.documentElement.style.setProperty('--update-banner-height', '0px')
      document.body.classList.remove('has-update-banner')
      return
    }
    document.body.classList.add('has-update-banner')
    const update = () => {
      const h = el.offsetHeight || 0
      document.documentElement.style.setProperty('--update-banner-height', `${h}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.setProperty('--update-banner-height', '0px')
      document.body.classList.remove('has-update-banner')
    }
  }, [available])

  if (!available) return null

  const handleClick = downloaded ? completeUpdate : startUpdate
  const downloading = isNative && progress > 0 && progress < 1 && !downloaded

  let title = 'Nova versão disponível'
  let subtitle
  let buttonLabel = 'Atualizar'

  if (downloaded) {
    title = 'Atualização pronta'
    subtitle = 'Toque para reiniciar e instalar'
    buttonLabel = 'Reiniciar'
  } else if (downloading) {
    title = 'Baixando atualização'
    subtitle = `${Math.round(progress * 100)}%`
    buttonLabel = '...'
  } else if (latest?.version) {
    subtitle = isNative
      ? `v${latest.version} · toque para baixar`
      : `v${latest.version} · toque para recarregar`
  }

  return (
    <AnimatePresence>
      <motion.div
        key="update-banner"
        ref={ref}
        initial={{ y: '-100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '-100%', opacity: 0 }}
        transition={{ duration: TIMING.base, ease: EASE.inOut }}
        className="sticky left-0 right-0 z-[50] bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg"
        style={{
          // env-safe sempre incluído. ad-banner-height some quando user é Pro/Admin.
          // Banner sempre fica logo abaixo do ad (ou status bar quando ad ausente).
          top: 'calc(env(safe-area-inset-top, 0px) + var(--ad-banner-height, 0px))'
        }}
      >
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center gap-3">
          <Icon name="sparkles" size={20} className="shrink-0 text-white" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-tight">{title}</p>
            {subtitle && (
              <p className="text-[11px] text-white/80 leading-tight">{subtitle}</p>
            )}
          </div>
          <button
            onClick={handleClick}
            disabled={downloading}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-emerald-700 text-xs font-bold hover:bg-emerald-50 active:scale-95 transition disabled:opacity-60"
          >
            {buttonLabel}
          </button>
          {/* Web user pode dispensar; native NÃO (forçar update flow) */}
          {!isNative && (
            <button
              onClick={dismiss}
              aria-label="Dispensar"
              className="shrink-0 w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
