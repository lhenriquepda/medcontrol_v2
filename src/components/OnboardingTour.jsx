import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Hand, Users, AlarmClock, Pill, Siren, BarChart3, ArrowLeft, ArrowRight, PartyPopper } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import { Button } from './dosy'

/* eslint-disable no-undef */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
/* eslint-enable no-undef */

const STORAGE_KEY = 'dosy_tour_seen_version'

/**
 * Slides shown on first launch + after app update.
 * Re-trigger: bump APP_VERSION → users with stale `dosy_tour_seen_version` see again.
 *
 * Visual: Dosy sunset gradient hero icon container, white card on warm bg,
 * progress dots sunset, primary Button sunset gradient.
 */
const SLIDES = [
  {
    icon: Hand,
    title: 'Bem-vindo ao Dosy',
    body: 'Seu assistente de medicação para toda a família. Esqueça doses esquecidas — o alarme funciona como despertador, mesmo no silencioso.',
  },
  {
    icon: Users,
    title: 'Múltiplos pacientes',
    body: 'Cadastre filhos, pais, você mesmo. Cada um com seus tratamentos, histórico e alertas. Compartilhe pacientes com outros cuidadores.',
  },
  {
    icon: AlarmClock,
    title: 'Alarme que toca de verdade',
    body: 'Tela cheia, som contínuo, vibração — até você confirmar ou adiar. Funciona com app fechado, tela bloqueada, em silencioso (com permissão).',
  },
  {
    icon: Pill,
    title: 'Confirme em 1 toque',
    body: 'Quando o alarme toca, marque a dose como Tomada, Pular ou Ignorar. Várias doses no mesmo horário aparecem juntas em fila rápida.',
  },
  {
    icon: Siren,
    title: 'Doses S.O.S quando precisar',
    body: 'Registre doses de resgate fora do agendamento — com regras de segurança automáticas (intervalo mínimo, máximo em 24h).',
  },
  {
    icon: BarChart3,
    title: 'Histórico + Relatórios',
    body: 'Acompanhe adesão, exporte relatórios em PDF/CSV prontos pra mostrar ao médico. Dados sempre seus, criptografados, conforme LGPD.',
  },
]

export default function OnboardingTour({ enabled = true }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen !== APP_VERSION) setOpen(true)
  }, [enabled])

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, APP_VERSION)
    setOpen(false)
  }, [])

  const next = () => {
    if (index < SLIDES.length - 1) setIndex(index + 1)
    else dismiss()
  }
  const prev = () => { if (index > 0) setIndex(index - 1) }

  if (!open) return null

  const slide = SLIDES[index]
  const Icon = slide.icon
  const isFirst = index === 0
  const isLast = index === SLIDES.length - 1

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(28,20,16,0.65)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: TIMING.base, ease: EASE.inOut }}
        style={{
          width: '100%', maxWidth: 420,
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--dosy-bg-elevated)',
          borderRadius: 28,
          boxShadow: 'var(--dosy-shadow-lg)',
          overflow: 'hidden',
          border: '1px solid var(--dosy-border)',
        }}
      >
        {/* Header: version + skip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 0 20px',
        }}>
          <span style={{
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--dosy-fg-tertiary)',
            fontFamily: 'var(--dosy-font-display)', fontWeight: 600,
          }}>Versão {APP_VERSION}</span>
          <button
            type="button"
            onClick={dismiss}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              color: 'var(--dosy-fg-secondary)',
              padding: '4px 8px', borderRadius: 8,
              fontFamily: 'var(--dosy-font-display)',
            }}
          >Pular</button>
        </div>

        {/* Slide content */}
        <div style={{
          flex: 1,
          padding: '12px 28px 20px 28px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          overflowY: 'auto',
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: TIMING.fast, ease: EASE.inOut }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div style={{
                width: 112, height: 112, borderRadius: 28,
                background: 'var(--dosy-gradient-sunset)',
                boxShadow: 'var(--dosy-shadow-sunset)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 24,
                color: 'var(--dosy-fg-on-sunset)',
              }}>
                <Icon size={56} strokeWidth={1.75}/>
              </div>
              <h2 style={{
                fontFamily: 'var(--dosy-font-display)',
                fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em',
                color: 'var(--dosy-fg)', margin: '0 0 10px 0', lineHeight: 1.2,
              }}>{slide.title}</h2>
              <p style={{
                fontSize: 14, color: 'var(--dosy-fg-secondary)',
                lineHeight: 1.55, margin: 0,
              }}>{slide.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6,
          padding: '8px 0 12px 0',
        }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                height: 6,
                width: i === index ? 24 : 6,
                borderRadius: 9999,
                border: 'none', cursor: 'pointer',
                background: i === index
                  ? 'var(--dosy-gradient-sunset)'
                  : 'var(--dosy-bg-sunken)',
                transition: 'all 250ms var(--dosy-ease-out)',
              }}
            />
          ))}
        </div>

        {/* Footer buttons */}
        <div style={{
          display: 'flex', gap: 8,
          padding: '8px 16px 16px 16px',
          borderTop: '1px solid var(--dosy-divider)',
          paddingTop: 12,
        }}>
          <div style={{ flex: 1 }}>
            {!isFirst && (
              <Button kind="ghost" full icon={ArrowLeft} onClick={prev}>
                Anterior
              </Button>
            )}
          </div>
          <div style={{ flex: 1.5 }}>
            <Button
              kind="primary"
              full
              icon={isLast ? PartyPopper : undefined}
              iconRight={isLast ? undefined : ArrowRight}
              onClick={next}
            >
              {isLast ? 'Começar' : 'Próximo'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
