/**
 * animations.js — fonte única para todas animações do app.
 *
 * Edite tempos, easings e variantes aqui — propaga pro app inteiro.
 *
 * Uso:
 *   import { motion } from 'motion/react'
 *   import { ANIM } from '../animations'
 *
 *   <motion.div {...ANIM.fadeIn}>...</motion.div>
 *   <motion.div variants={ANIM.pageTransition.variants} ...>...</motion.div>
 */

// ─── TIMINGS ──────────────────────────────────────────────────────────
// Ajuste único — afeta todas animações.
export const TIMING = {
  fast: 0.22,
  base: 0.36,
  slow: 0.55,
  page: 0.38,
  stagger: 0.06, // delay entre items em lista
}

// ─── EASINGS ──────────────────────────────────────────────────────────
// User preferiu ease-in-out smooth, sem bounce/spring.
export const EASE = {
  inOut: [0.4, 0, 0.2, 1],   // material standard (default)
  out: [0.4, 0, 0.2, 1],     // mesmo inOut (sem overshoot)
  in: [0.4, 0, 0.2, 1],      // mesmo inOut
  // Spring removidos — não usar em novos componentes.
  // Mantidos como fallback NÃO-bouncy (high damping) caso código antigo refira.
  spring: { duration: 0.36, ease: [0.4, 0, 0.2, 1] },
  springSoft: { duration: 0.42, ease: [0.4, 0, 0.2, 1] },
}

// ─── PAGE TRANSITION ──────────────────────────────────────────────────
// Padrão pedido:
//   - Tela entrante: slide-in da direita (translateX 100% → 0)
//   - Tela sainte: slide-out até metade pra esquerda (0 → -50%)
//   - Ambas no mesmo tempo (TIMING.page) com easeInOut
//
// Direção pode ser invertida quando navegar pra trás (enter from left, exit right)
// — controlada via variant `direction` ('forward' | 'back').
export const pageTransition = {
  variants: {
    initial: (direction) => ({
      x: direction === 'back' ? '-50%' : '100%',
      opacity: 0.6,
    }),
    enter: {
      x: 0,
      opacity: 1,
      transition: { duration: TIMING.page, ease: EASE.inOut },
    },
    exit: (direction) => ({
      x: direction === 'back' ? '100%' : '-50%',
      opacity: 0.6,
      transition: { duration: TIMING.page, ease: EASE.inOut },
    }),
  },
  // Aplica em <motion.div> que envolve cada rota
  motionProps: {
    initial: 'initial',
    animate: 'enter',
    exit: 'exit',
  },
}

// ─── PRESETS GERAIS (light micro-anims) ───────────────────────────────
export const ANIM = {
  // Aparece com fade
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: TIMING.fast, ease: EASE.inOut },
  },

  // Aparece subindo (cards, listas)
  fadeUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
    transition: { duration: TIMING.base, ease: EASE.out },
  },

  // Pop (modais, badges)
  pop: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.92 },
    transition: { duration: TIMING.base, ease: EASE.out },
  },

  // Slide up (BottomSheet)
  slideUp: {
    initial: { y: '100%' },
    animate: { y: 0, transition: { ...EASE.spring } },
    exit: { y: '100%', transition: { duration: TIMING.fast, ease: EASE.in } },
  },

  // Tap feedback (botões)
  tap: {
    whileTap: { scale: 0.96 },
    transition: { duration: TIMING.fast },
  },

  // Hover (cards interativos web)
  hover: {
    whileHover: { y: -2 },
    transition: { duration: TIMING.fast, ease: EASE.out },
  },

  // Stagger list (cada item fadeUp atrasado)
  list: {
    container: {
      animate: { transition: { staggerChildren: 0.04 } },
    },
    item: {
      initial: { opacity: 0, y: 6 },
      animate: { opacity: 1, y: 0, transition: { duration: TIMING.fast, ease: EASE.out } },
    },
  },

  // Toast slide-in da direita
  toast: {
    initial: { opacity: 0, x: 60 },
    animate: { opacity: 1, x: 0, transition: { duration: TIMING.base, ease: EASE.out } },
    exit: { opacity: 0, x: 60, transition: { duration: TIMING.fast, ease: EASE.in } },
  },

  // Pulse (notif badges)
  pulse: {
    animate: { scale: [1, 1.08, 1], transition: { duration: 1.6, repeat: Infinity, ease: EASE.inOut } },
  },
}

// ─── REDUCED MOTION ────────────────────────────────────────────────────
// Respeita preferência usuário. Quando true, anims viram instantâneas.
export function shouldReduceMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
