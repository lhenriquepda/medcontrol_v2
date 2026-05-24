/**
 * PullToRefreshOverlay — v0.2.6.5
 *
 * Overlay visual reutilizável pra usePullToRefresh. Renderiza spinner "puxe pra atualizar"
 * fixed posicionado ABAIXO da pilha sticky (AdMob banner + UpdateBanner + AppHeader),
 * pra não ficar coberto pelo banner native overlay.
 *
 * Resolve bug v0.2.6.5: spinner ficava com top:0 → AdMob banner ocupava 0..60dp
 * (native overlay z-order acima do WebView) → spinner invisível atrás dele.
 *
 * v0.2.6.8 FIX M102: adicionado estado "✓ Atualizado" exibido por 1200ms após
 * o refresh completar. Antes user via "Atualizando..." sumir abruptamente sem
 * feedback de conclusão.
 *
 * Uso:
 *   const ptr = usePullToRefresh(handleRefresh)
 *   <PullToRefreshOverlay ptr={ptr} />
 *   <YourPageContent />
 */
import { useEffect, useRef, useState } from 'react'

export default function PullToRefreshOverlay({ ptr }) {
  // v0.2.6.8 FIX M102: rastreia transição refreshing true→false pra mostrar
  // "✓ Atualizado" por 1200ms (cobre cache miss + slow render). Não usa useToast
  // pra evitar acoplamento + sobreposição com toasts de mutation.
  const [justRefreshed, setJustRefreshed] = useState(false)
  const wasRefreshingRef = useRef(false)
  useEffect(() => {
    if (!ptr) return
    if (wasRefreshingRef.current && !ptr.refreshing) {
      setJustRefreshed(true)
      const id = setTimeout(() => setJustRefreshed(false), 1200)
      return () => clearTimeout(id)
    }
    wasRefreshingRef.current = ptr.refreshing
  }, [ptr?.refreshing])

  if (!ptr) return null
  const visible = ptr.pulling || ptr.refreshing || justRefreshed
  if (!visible) return null
  return (
    <div
      className="fixed left-0 right-0 z-50 flex items-end justify-center pointer-events-none"
      style={{
        // v0.2.6.5: começar ABAIXO da pilha sticky (banner + update + header).
        // --ad-banner-height + --update-banner-height são setados pelos respectivos
        // componentes via ResizeObserver. Sem isso spinner fica atrás do banner native.
        top: 'calc(var(--ad-banner-height, 0px) + var(--update-banner-height, 0px))',
        height: Math.max(ptr.pullDistance, 56),
        transition: ptr.refreshing || justRefreshed ? 'height 0.2s ease-out' : 'none',
      }}
      aria-live="polite"
    >
      <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur shadow-lg">
        {justRefreshed ? (
          <span aria-hidden="true" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 14, height: 14, borderRadius: 999,
            background: '#3F9E7E', color: 'white',
            fontSize: 10, fontWeight: 900, lineHeight: 1,
          }}>✓</span>
        ) : (
          <span
            className={`inline-block w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white ${
              ptr.refreshing ? 'animate-spin' : ''
            }`}
            style={{
              transform: ptr.refreshing
                ? undefined
                : `rotate(${(ptr.pullDistance / ptr.threshold) * 360}deg)`,
            }}
            aria-hidden="true"
          />
        )}
        <span className="text-[11px] font-medium text-white">
          {justRefreshed
            ? 'Atualizado'
            : ptr.refreshing
              ? 'Atualizando…'
              : ptr.pullDistance >= ptr.threshold
                ? 'Solte para atualizar'
                : 'Puxe para atualizar'}
        </span>
      </div>
    </div>
  )
}
