import { useEffect, useState, useCallback } from 'react'

/* eslint-disable no-undef */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
/* eslint-enable no-undef */

const STORAGE_KEY = 'dosy_tour_seen_version'

/**
 * Slides shown on:
 *   - First launch (no key set)
 *   - After app update (stored version != current APP_VERSION)
 *
 * If user dismisses tour, current version is saved → no re-show until next bump.
 * Add new slide entry + bump version in package.json to re-trigger tour.
 *
 * Slides reuse design language: dark navy gradient, brand teal accents,
 * emoji icons (consistent with rest of app — DoseModal, AlarmActivity).
 */
const SLIDES = [
  {
    icon: '👋',
    title: 'Bem-vindo ao Dosy',
    body: 'Seu assistente de medicação para toda a família. Esqueça doses esquecidas — o alarme funciona como um despertador, mesmo no silencioso.',
    accent: 'from-brand-500/20 to-brand-700/10'
  },
  {
    icon: '👨‍👩‍👧',
    title: 'Múltiplos pacientes',
    body: 'Cadastre filhos, pais, você mesmo. Cada um com seus tratamentos, histórico e alertas. Compartilhe pacientes com outros cuidadores.',
    accent: 'from-emerald-500/20 to-emerald-700/10'
  },
  {
    icon: '⏰',
    title: 'Alarme que toca de verdade',
    body: 'Tela cheia, som contínuo, vibração — até você confirmar ou adiar. Funciona com app fechado, tela bloqueada, em silencioso (com permissão).',
    accent: 'from-rose-500/20 to-rose-700/10'
  },
  {
    icon: '💊',
    title: 'Confirme em 1 toque',
    body: 'Quando o alarme toca, você marca a dose como Tomada, Pular ou Ignorar. Várias doses no mesmo horário aparecem juntas em uma fila rápida.',
    accent: 'from-blue-500/20 to-blue-700/10'
  },
  {
    icon: '🚨',
    title: 'Doses SOS quando precisar',
    body: 'Registre doses de resgate fora do agendamento — com regras de segurança automáticas (intervalo mínimo, máximo em 24h).',
    accent: 'from-amber-500/20 to-amber-700/10'
  },
  {
    icon: '📊',
    title: 'Histórico + Relatórios',
    body: 'Acompanhe sua adesão, exporte relatórios em PDF/CSV prontos pra mostrar ao médico. Dados sempre seus, criptografados, conforme a LGPD.',
    accent: 'from-purple-500/20 to-purple-700/10'
  }
]

export default function OnboardingTour({ enabled = true }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  // Show if version not seen yet
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
  const isFirst = index === 0
  const isLast = index === SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#0d1535] to-[#1a2660] rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Skip / version chip header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
            Versão {APP_VERSION}
          </span>
          <button
            onClick={dismiss}
            className="text-xs text-white/50 hover:text-white/80 transition px-2 py-1"
          >
            Pular
          </button>
        </div>

        {/* Slide content */}
        <div className="flex-1 px-7 py-6 flex flex-col items-center text-center overflow-y-auto">
          <div className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${slide.accent} flex items-center justify-center mb-6 ring-1 ring-white/10`}>
            <span className="text-6xl" role="img" aria-hidden="true">{slide.icon}</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3 leading-tight">
            {slide.title}
          </h2>
          <p className="text-sm text-white/70 leading-relaxed">
            {slide.body}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-3">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/25'
              }`}
            />
          ))}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-2 p-4 pt-2 border-t border-white/10">
          <button
            onClick={prev}
            disabled={isFirst}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${
              isFirst
                ? 'opacity-0 pointer-events-none'
                : 'text-white/70 hover:bg-white/5'
            }`}
          >
            ← Anterior
          </button>
          <button
            onClick={next}
            className="flex-[1.5] py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-semibold shadow-lg active:scale-[0.98] transition"
          >
            {isLast ? '🚀  Começar' : `Próximo →`}
          </button>
        </div>
      </div>
    </div>
  )
}
