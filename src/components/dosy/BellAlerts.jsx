/**
 * Dosy BellAlerts — reusable alert pattern (R3 do prompt redesign).
 *
 * Padrão consolidado: bell button no header com badge contador.
 * Toque expande banner inline abaixo com lista de alertas. Outros tipos
 * de alerta (update available, aviso sistema, etc) plugam no mesmo
 * componente via prop `alerts`.
 *
 * Props:
 *   alerts:  Array<{ id, kind, message, count?, onClick? }>
 *            kind: 'danger' | 'info' | 'warning' (controla cor banner)
 *   align:   posição do banner ('below-button' default | 'fullwidth')
 *   open:    forced controlled state (opcional — se omitido, gerencia interno)
 *   onOpenChange: callback open/close
 */
import { useEffect, useRef, useState } from 'react'
import { Bell, AlertTriangle, Sparkles, Info, ChevronRight } from 'lucide-react'

// Banner kinds — bg sólido (não alpha translucent) pra não misturar com
// fundo translúcido do header glass em dark mode. Em dark, bg-elevated +
// tinta semântica (color-mix com 25% opacity) = banner legível sobre header.
const KIND_STYLES = {
  danger:  {
    bg: 'color-mix(in oklab, var(--dosy-bg-elevated) 100%, transparent), color-mix(in oklab, var(--dosy-danger) 25%, transparent)',
    background: 'linear-gradient(0deg, color-mix(in oklab, var(--dosy-danger) 18%, var(--dosy-bg-elevated)) 0%, color-mix(in oklab, var(--dosy-danger) 18%, var(--dosy-bg-elevated)) 100%)',
    color: 'var(--dosy-danger)',
    Icon: AlertTriangle,
  },
  info: {
    background: 'linear-gradient(0deg, color-mix(in oklab, var(--dosy-info) 18%, var(--dosy-bg-elevated)) 0%, color-mix(in oklab, var(--dosy-info) 18%, var(--dosy-bg-elevated)) 100%)',
    color: 'var(--dosy-info)',
    Icon: Info,
  },
  warning: {
    background: 'linear-gradient(0deg, color-mix(in oklab, var(--dosy-warning) 18%, var(--dosy-bg-elevated)) 0%, color-mix(in oklab, var(--dosy-warning) 18%, var(--dosy-bg-elevated)) 100%)',
    color: '#C5841A',
    Icon: AlertTriangle,
  },
  update: {
    background: 'var(--dosy-gradient-sunset-soft)',
    color: 'var(--dosy-fg)',
    Icon: Sparkles,
  },
}

export function BellButton({ count = 0, onClick, ariaLabel, className = '', style }) {
  const hasAlerts = count > 0
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || (hasAlerts ? `${count} alerta${count > 1 ? 's' : ''}` : 'Sem alertas')}
      className={`dosy-press ${className}`}
      style={{
        position: 'relative',
        width: 38, height: 38, borderRadius: 9999,
        border: 'none', cursor: 'pointer', flexShrink: 0,
        background: hasAlerts ? 'var(--dosy-danger-bg)' : 'var(--dosy-bg-elevated)',
        color: hasAlerts ? 'var(--dosy-danger)' : 'var(--dosy-fg)',
        boxShadow: 'var(--dosy-shadow-sm)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      <Bell size={18} strokeWidth={1.75}/>
      {hasAlerts && (
        <span style={{
          position: 'absolute', top: -2, right: -2,
          minWidth: 18, height: 18, padding: '0 5px',
          borderRadius: 9999,
          background: 'var(--dosy-danger)',
          color: 'var(--dosy-fg-on-sunset)',
          fontSize: 10.5, fontWeight: 800, letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'var(--dosy-font-display)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 2px var(--dosy-bg)',
          lineHeight: 1,
        }}>{count > 9 ? '9+' : count}</span>
      )}
    </button>
  )
}

/**
 * BellAlerts — full pattern (Bell + expand banner)
 * Usa estado interno se `open` não passado.
 *
 * UX:
 * - Click fora do bell+banner = fecha (não precisa re-clicar bell)
 * - Banner com 7px gap abaixo do bell pra não grudar
 * - Bg sólido (color-mix com bg-elevated) pra dark mode legível sobre
 *   header translúcido glass
 */
export function BellAlerts({ alerts = [], open, onOpenChange, className = '', style }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open !== undefined ? open : internalOpen
  const bellRef = useRef(null)
  const bannerRef = useRef(null)

  const setOpen = (v) => {
    if (onOpenChange) onOpenChange(v)
    if (open === undefined) setInternalOpen(v)
  }
  const totalCount = alerts.reduce((sum, a) => sum + (a.count || 1), 0)

  // Click outside → close. Listener só registra quando aberto.
  useEffect(() => {
    if (!isOpen) return undefined
    const onDocClick = (e) => {
      const bell = bellRef.current
      const banner = bannerRef.current
      if (bell && bell.contains(e.target)) return
      if (banner && banner.contains(e.target)) return
      setOpen(false)
    }
    // Pointerdown captura ANTES de click — fecha sem disparar tap
    // acidentalmente em underlying element.
    document.addEventListener('pointerdown', onDocClick, true)
    return () => document.removeEventListener('pointerdown', onDocClick, true)
  }, [isOpen])

  if (alerts.length === 0) {
    return (
      <span ref={bellRef} style={{ display: 'inline-flex' }}>
        <BellButton count={0} onClick={() => setOpen(!isOpen)} className={className} style={style}/>
      </span>
    )
  }

  return (
    <>
      <span ref={bellRef} style={{ display: 'inline-flex' }}>
        <BellButton
          count={totalCount}
          onClick={() => setOpen(!isOpen)}
          className={className}
          style={style}
        />
      </span>
      {isOpen && (
        <div
          ref={bannerRef}
          style={{
            position: 'absolute', left: 22, right: 22,
            // Distância de 15px abaixo do header bottom (overlap negativo
            // do top legacy era -8px). Total ~+7px de header bottom.
            top: 'calc(100% + 7px)',
            display: 'flex', flexDirection: 'column', gap: 8,
            animation: 'dosy-slide-down 200ms var(--dosy-ease-out) both',
            zIndex: 21,
          }}
        >
          {alerts.map((alert) => {
            const styles = KIND_STYLES[alert.kind] || KIND_STYLES.danger
            const Icon = alert.icon || styles.Icon
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (alert.onClick) alert.onClick()
                }}
                className="dosy-press"
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: styles.background,
                  color: styles.color,
                  border: '1px solid var(--dosy-border)',
                  borderRadius: 14,
                  fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
                  cursor: alert.onClick ? 'pointer' : 'default',
                  textAlign: 'left',
                  fontFamily: 'var(--dosy-font-body)',
                  boxShadow: 'var(--dosy-shadow-md)',
                }}
              >
                <Icon size={16} strokeWidth={2}/>
                <span style={{ flex: 1 }}>{alert.message}</span>
                {alert.onClick && <ChevronRight size={16} strokeWidth={1.75}/>}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
