import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppUpdate } from '../hooks/useAppUpdate'
import Icon from './Icon'
import { TIMING, EASE } from '../animations'

/**
 * Banner / modal de atualização.
 *
 * - Default (is_mandatory=false): banner verde no topo, dismissable em web.
 * - Mandatory (is_mandatory=true em app_releases): modal vermelho full-screen
 *   bloqueando uso do app até atualização. Sem dismiss.
 *
 * Native (Android): Google Play In-App Updates flexible mode.
 *   Tap "Atualizar" → Play prompt nativo → download em background.
 *   Quando baixado → "Reiniciar para instalar" → completeFlexibleUpdate().
 *
 * Web: legacy /version.json. Tap "Atualizar" → reload bundle. Dispensável.
 */
export default function UpdateBanner() {
  const {
    available, mandatory, latest, downloaded, progress, isNative,
    startUpdate, completeUpdate, dismiss,
  } = useAppUpdate()
  const ref = useRef(null)

  // Mede própria altura → CSS var --update-banner-height (só pro banner verde).
  // Modal mandatory é overlay, não empurra layout.
  useEffect(() => {
    const el = ref.current
    if (!available || mandatory || !el) {
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
  }, [available, mandatory])

  // Bloqueia scroll do body enquanto modal mandatory aberto
  useEffect(() => {
    if (mandatory && available) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [mandatory, available])

  if (!available) return null

  const handleClick = downloaded ? completeUpdate : startUpdate
  const downloading = isNative && progress > 0 && progress < 1 && !downloaded

  // ───── MODAL MANDATORY (full-screen blocking) ─────────────────────
  if (mandatory) {
    let title = 'Atualização obrigatória'
    let subtitle = 'Esta versão exige atualização para continuar usando o Dosy.'
    let buttonLabel = 'Atualizar agora'

    if (downloaded) {
      title = 'Atualização pronta'
      subtitle = 'Toque para reiniciar e finalizar a instalação.'
      buttonLabel = 'Reiniciar'
    } else if (downloading) {
      title = 'Baixando atualização'
      subtitle = `${Math.round(progress * 100)}% concluído. Aguarde…`
      buttonLabel = `${Math.round(progress * 100)}%`
    }

    return (
      <AnimatePresence>
        <motion.div
          key="update-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: TIMING.base, ease: EASE.inOut }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          aria-modal="true"
          role="alertdialog"
          aria-labelledby="update-modal-title"
          aria-describedby="update-modal-desc"
        >
          <motion.div
            key="update-modal-card"
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ duration: TIMING.base, ease: EASE.out }}
            className="w-full sm:max-w-sm mx-4 mb-4 sm:mb-0 rounded-3xl shadow-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8F6 100%)',
              boxShadow: '0 24px 60px -12px rgba(220, 38, 38, 0.35), 0 0 0 1px rgba(220, 38, 38, 0.08)',
            }}
          >
            {/* Header com ícone */}
            <div
              className="px-6 pt-7 pb-2 flex flex-col items-center text-center"
              style={{ background: 'linear-gradient(180deg, rgba(254,242,242,0.85) 0%, transparent 100%)' }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: 'linear-gradient(135deg, #FEE2E2 0%, #FCA5A5 100%)',
                  boxShadow: '0 8px 16px -4px rgba(220, 38, 38, 0.25)',
                }}
              >
                <Icon name="warning" size={32} className="text-red-600" />
              </div>
              <h2
                id="update-modal-title"
                className="text-lg font-bold text-gray-900 leading-tight"
                style={{ fontFamily: 'var(--dosy-font-display, var(--dosy-font-body))' }}
              >
                {title}
              </h2>
              {latest?.version && !latest?.isVersionFallback && (
                // v0.2.3.14 #C — só mostra chip "Versão X disponível" se temos
                // version_name real (semver). Em fallback (`versão N`) omite
                // pra evitar copy duplicado tipo "Versão versão 77 disponível".
                <p className="text-xs font-semibold text-red-600 mt-1.5 tracking-wide uppercase">
                  Versão {latest.version} disponível
                </p>
              )}
            </div>

            {/* Body */}
            <div className="px-6 pb-2">
              <p
                id="update-modal-desc"
                className="text-sm text-gray-700 leading-relaxed text-center"
              >
                {subtitle}
              </p>

              {latest?.whatsnew && !downloaded && !downloading && (
                <div
                  className="mt-4 p-3 rounded-xl text-xs text-gray-600 leading-relaxed"
                  style={{ background: 'rgba(249, 250, 251, 0.8)' }}
                >
                  <div className="font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Icon name="sparkles" size={12} className="text-amber-500" />
                    Novidades
                  </div>
                  {latest.whatsnew}
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="px-6 pt-5 pb-6">
              <button
                onClick={handleClick}
                disabled={downloading}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: downloading
                    ? 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)'
                    : 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                  color: 'white',
                  boxShadow: downloading
                    ? 'none'
                    : '0 10px 20px -6px rgba(220, 38, 38, 0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                {buttonLabel}
              </button>
              <p className="text-[10px] text-gray-400 text-center mt-3 leading-snug">
                Não é possível usar o Dosy sem esta atualização.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // ───── BANNER VERDE (default, dismissable em web) ─────────────────
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
    // v0.2.3.14 #C — em fallback (`versão N`), omitir prefixo `v` pra evitar
    // copy duplicado tipo "vversão 77 · toque para baixar".
    const vPrefix = latest?.isVersionFallback ? '' : 'v'
    subtitle = isNative
      ? `${vPrefix}${latest.version} · toque para baixar`
      : `${vPrefix}${latest.version} · toque para recarregar`
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
