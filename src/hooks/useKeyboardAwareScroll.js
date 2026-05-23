/**
 * useKeyboardAwareScroll — v0.2.6.5
 *
 * Global focus handler que rola elemento focado pra topo (acima do teclado virtual).
 * Mata bug recorrente Android Capacitor WebView: teclado aparece sobre input/textarea
 * → user não vê o que está digitando.
 *
 * Estratégia:
 *  • Listener `focusin` no document (delegation) — captura focus em qualquer input/textarea/
 *    select/contenteditable em qualquer página.
 *  • Listener `keyboardWillShow` do plugin Capacitor — re-scroll quando teclado aparecer
 *    com altura conhecida (mais preciso que estimar).
 *  • `scrollIntoView({ block: 'start', behavior: 'smooth' })` com `scroll-margin-top` via CSS
 *    pra deixar header visível.
 *  • Skip no desktop (matchMedia coarse-pointer) — desktop tem teclado físico fixo.
 *
 * Opt-out: elemento com atributo `data-keyboard-scroll="false"`.
 * Opt-in extra: elemento não-input com `data-keyboard-scroll="true"` (ex: trigger button
 * de Sheet com search interno) também rola.
 *
 * Chamado 1× em App.jsx — efeito global.
 */
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

// Elementos que disparam teclado virtual ao receber foco
const SCROLLABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
// Inputs que NÃO abrem teclado (não precisa rolar)
const SKIP_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'hidden', 'range', 'color'])

function isScrollableTarget(el) {
  if (!el || el.nodeType !== 1) return false
  if (el.getAttribute('data-keyboard-scroll') === 'false') return false
  if (el.getAttribute('data-keyboard-scroll') === 'true') return true
  if (el.isContentEditable) return true
  if (!SCROLLABLE_TAGS.has(el.tagName)) return false
  if (el.tagName === 'INPUT') {
    const type = (el.type || 'text').toLowerCase()
    if (SKIP_INPUT_TYPES.has(type)) return false
  }
  return true
}

// Lê altura combinada da pilha sticky no topo (ad-banner + update-banner + header).
// Cada componente expõe sua CSS var via ResizeObserver — ler a cada scroll garante valor
// atual mesmo se header redimensionar. Status bar NÃO entra: overlay:false faz WebView
// começar abaixo dela (coordenadas WebView já corretas).
function getStickyTopOffset() {
  if (typeof window === 'undefined') return 80
  const styles = getComputedStyle(document.documentElement)
  const read = (name, fallback = 0) => {
    const v = parseFloat(styles.getPropertyValue(name))
    return Number.isFinite(v) ? v : fallback
  }
  const ad = read('--ad-banner-height', 0)
  const update = read('--update-banner-height', 0)
  const header = read('--app-header-height', 64)
  return ad + update + header + 12 // +12px breathing
}

function scrollFocusedIntoView(el, opts = {}) {
  if (!el || !el.isConnected) return
  const { delay = 0 } = opts
  const exec = () => {
    try {
      // scrollIntoView respeita scroll-margin-top (CSS) → posição correta abaixo do header.
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      // Fallback manual: se algum scroll container ignorar scroll-margin-top,
      // ajusta window.scrollY +offset pra garantir element fica visível.
      // (Detecção: rect.top < stickyOffset → scroll a mais.)
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        const offset = getStickyTopOffset()
        if (rect.top < offset) {
          const delta = offset - rect.top
          window.scrollBy({ top: -delta, behavior: 'smooth' })
        }
      })
    } catch {
      try { el.scrollIntoView(true) } catch { /* ignore */ }
    }
  }
  if (delay > 0) setTimeout(exec, delay)
  else exec()
}

export function useKeyboardAwareScroll() {
  useEffect(() => {
    // Skip em desktop (mouse pointer) — teclado físico não obscurece UI.
    // matchMedia coarse-pointer = touch device (mobile/tablet).
    if (typeof window === 'undefined') return
    const isTouch = window.matchMedia?.('(pointer: coarse)').matches
    const isNative = Capacitor.isNativePlatform()
    if (!isTouch && !isNative) return

    // === Focus handler — delegation no document ===
    function onFocusIn(e) {
      const target = e.target
      if (!isScrollableTarget(target)) return
      // Delay 220ms: dá tempo pro teclado começar a abrir (em Android é progressivo).
      // Sem delay, scrollIntoView roda ANTES do viewport encolher → posição final fica errada.
      scrollFocusedIntoView(target, { delay: 220 })
    }
    document.addEventListener('focusin', onFocusIn, { passive: true })

    // === Capacitor Keyboard plugin (native only) ===
    // Mais preciso que estimar — re-scroll quando o teclado realmente aparece com altura conhecida.
    let removeNativeListener
    if (isNative) {
      // Import dinâmico pra não falhar no web (plugin não vem no bundle web).
      import('@capacitor/keyboard').then(({ Keyboard }) => {
        const handle = Keyboard.addListener('keyboardWillShow', () => {
          const active = document.activeElement
          if (isScrollableTarget(active)) {
            scrollFocusedIntoView(active, { delay: 50 })
          }
        })
        // Capacitor v6+: addListener retorna Promise<PluginListenerHandle>
        removeNativeListener = async () => {
          try {
            const h = await handle
            await h?.remove?.()
          } catch { /* ignore */ }
        }
      }).catch(() => { /* plugin não disponível, fallback no focusin já cobre */ })
    }

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      removeNativeListener?.()
    }
  }, [])
}
