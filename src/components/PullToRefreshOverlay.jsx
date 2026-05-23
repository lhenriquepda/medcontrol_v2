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
 * Uso:
 *   const ptr = usePullToRefresh(handleRefresh)
 *   <PullToRefreshOverlay ptr={ptr} />
 *   <YourPageContent />
 */
export default function PullToRefreshOverlay({ ptr }) {
  if (!ptr) return null
  const visible = ptr.pulling || ptr.refreshing
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
        transition: ptr.refreshing ? 'height 0.2s ease-out' : 'none',
      }}
      aria-live="polite"
    >
      <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur shadow-lg">
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
        <span className="text-[11px] font-medium text-white">
          {ptr.refreshing
            ? 'Atualizando…'
            : ptr.pullDistance >= ptr.threshold
              ? 'Solte para atualizar'
              : 'Puxe para atualizar'}
        </span>
      </div>
    </div>
  )
}
