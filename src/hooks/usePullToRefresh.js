import { useEffect, useState, useRef, useCallback } from 'react'

/**
 * Pull-to-refresh hook usable WITHOUT wrapping content in a custom scroll container.
 *
 * Listens to touch events on window. When user is at scrollTop=0 and drags down,
 * tracks pull distance. Past threshold + release → triggers `onRefresh`.
 *
 * Returns { pulling, refreshing, pullDistance } so parent can render an overlay bar
 * (above the rest of UI, fixed positioned). Sticky elements in the page layout
 * keep working since we don't introduce extra scroll containers.
 *
 * Usage:
 *   const { pulling, refreshing, pullDistance } = usePullToRefresh(handleRefresh)
 *   {(pulling || refreshing) && <div className="fixed top-0 ...">{...}</div>}
 */
const THRESHOLD = 80
const MAX_PULL = 120
const RESISTANCE = 2.5
// v0.2.3.12 — hard timeout para evitar spinner stuck eterno se onRefresh
// retornar Promise que nunca resolve (ex: refetchQueries paused por
// onlineManager.setOnline(false) glitch, RPC sem timeout, retry chain longo).
// 20s é suficiente pra refetch normal (Dashboard RPC ~1-3s, multiple queries
// paralelas ~5-10s). Acima disso = algo travou, melhor liberar UI.
const REFRESH_TIMEOUT_MS = 20000

export function usePullToRefresh(onRefresh) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(null)

  const onTouchStart = useCallback((e) => {
    if (window.scrollY > 0 || refreshing) return
    startY.current = e.touches[0].clientY
  }, [refreshing])

  const onTouchMove = useCallback((e) => {
    if (startY.current == null || refreshing) return
    const delta = e.touches[0].clientY - startY.current
    if (delta <= 0) {
      setPulling(false)
      setPullDistance(0)
      return
    }
    if (window.scrollY > 0) {
      startY.current = null
      setPulling(false)
      setPullDistance(0)
      return
    }
    const adjusted = Math.min(MAX_PULL, delta / RESISTANCE)
    setPullDistance(adjusted)
    setPulling(adjusted > 10)
  }, [refreshing])

  const onTouchEnd = useCallback(async () => {
    const passedThreshold = pullDistance >= THRESHOLD
    startY.current = null
    setPulling(false)

    if (passedThreshold && !refreshing) {
      setRefreshing(true)
      setPullDistance(THRESHOLD)
      // v0.2.3.12 — Promise.race com timeout 20s. Sem isso, Promise.all em
      // handleRefresh (7 refetchQueries + 1 RPC) pode travar indefinidamente
      // se uma query estiver paused por onlineManager glitch ou retry chain.
      let timeoutId = null
      try {
        await Promise.race([
          Promise.resolve(onRefresh?.()),
          new Promise((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error('PTR timeout — refresh > 20s')),
              REFRESH_TIMEOUT_MS
            )
          })
        ])
      } catch (err) {
        // Log mas não crasha — user vê spinner sumir, dados podem estar stale.
        // Próximo refetch automático (refetchInterval, Realtime, focus) recovera.
        console.warn('[usePullToRefresh] refresh failed:', err?.message)
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, refreshing, onRefresh])

  useEffect(() => {
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  return { pulling, refreshing, pullDistance, threshold: THRESHOLD }
}
