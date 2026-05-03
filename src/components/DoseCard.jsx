import { useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import Icon from './Icon'
import { formatTime, relativeLabel } from '../utils/dateUtils'
import { STATUS_CONFIG } from '../utils/statusUtils'

const ACTION_THRESHOLD = 90   // px — drag past this → triggers action on release
const MAX_DRAG = 140          // px — visual cap on drag amount
const MIN_DELTA = 30          // px — ignore micro-movements (touch jitter)
const AXIS_LOCK_RATIO = 1.5   // horizontal must beat vertical by this factor to count as swipe

/**
 * DoseCard — list item with tap (open modal) + swipe gestures:
 *   • Swipe right → confirm (Tomada)   — emerald reveal
 *   • Swipe left  → skip (Pular)       — amber reveal
 *
 * Swipe gestures only enabled for pending/overdue (actionable). Done/skipped
 * show as plain card without gesture handlers.
 *
 * Visual: card translates by deltaX during drag; behind it sits a reveal layer
 * with the action's color + label. On release past threshold, action fires;
 * otherwise card springs back to 0.
 */
export default function DoseCard({ dose, onClick, onSwipeConfirm, onSwipeSkip }) {
  const s = STATUS_CONFIG[dose.status] || STATUS_CONFIG.pending
  const isActionable = dose.status === 'pending' || dose.status === 'overdue'
  const isOverdue = dose.status === 'overdue'

  const [delta, setDelta] = useState(0)
  const [busy, setBusy] = useState(false)
  // Axis lock: once first significant move detected, lock to that axis for entire gesture
  const [axisLocked, setAxisLocked] = useState(null)  // null | 'h' | 'v'

  const handlers = useSwipeable({
    onSwipeStart: () => setAxisLocked(null),
    onSwiping: (e) => {
      if (!isActionable || busy) return
      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      // Determine axis on first meaningful movement
      if (axisLocked === null) {
        if (absX < MIN_DELTA && absY < MIN_DELTA) return  // wait for clear intent
        if (absY > absX * AXIS_LOCK_RATIO || absY > absX) {
          setAxisLocked('v')
          return  // vertical = scroll, leave delta=0
        }
        setAxisLocked('h')
      }
      if (axisLocked === 'v') return  // user is scrolling, never engage swipe
      // Horizontal lock active — track delta
      const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, e.deltaX))
      setDelta(clamped)
    },
    onSwiped: (e) => {
      const wasHorizontal = axisLocked === 'h'
      setAxisLocked(null)
      if (!wasHorizontal || !isActionable || busy) { setDelta(0); return }
      const dx = e.deltaX
      if (dx > ACTION_THRESHOLD && onSwipeConfirm) {
        setBusy(true)
        setDelta(MAX_DRAG)
        setTimeout(() => { onSwipeConfirm(dose); setDelta(0); setBusy(false) }, 150)
      } else if (dx < -ACTION_THRESHOLD && onSwipeSkip) {
        setBusy(true)
        setDelta(-MAX_DRAG)
        setTimeout(() => { onSwipeSkip(dose); setDelta(0); setBusy(false) }, 150)
      } else {
        setDelta(0)
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: false,  // axis lock + CSS touch-action handle this manually
    delta: MIN_DELTA
  })

  // Color reveal opacity scales with drag distance
  const dragRatio = Math.min(1, Math.abs(delta) / ACTION_THRESHOLD)
  const showRight = delta > 4  // user swiping right (confirm)
  const showLeft = delta < -4  // user swiping left (skip)

  // Status → Dosy StatusPill kind + leading icon container colors
  const statusKindMap = {
    done:    { kind: 'success', color: '#3F9E7E', bg: '#DDF1E8' },
    pending: { kind: 'pending', color: 'var(--dosy-fg-secondary)', bg: 'var(--dosy-peach-100)' },
    overdue: { kind: 'danger',  color: 'var(--dosy-danger)', bg: 'var(--dosy-danger-bg)' },
    skipped: { kind: 'skipped', color: 'var(--dosy-fg-tertiary)', bg: 'var(--dosy-bg-sunken)' },
  }
  const dosyStatus = statusKindMap[dose.status] || statusKindMap.pending

  // bare=true: inner sem outer wrapper visual (usado em actionable swipe wrapper)
  const renderInner = (bare = false) => (
    <button
      onClick={() => { if (Math.abs(delta) < 4) onClick?.() }}
      className="dosy-press"
      style={{
        width: '100%', textAlign: 'left',
        padding: 14,
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--dosy-bg-elevated)',
        border: bare
          ? 'none'
          : (isOverdue ? '1px solid rgba(229,86,74,0.3)' : '1px solid var(--dosy-border)'),
        borderRadius: bare ? 0 : 18,
        boxShadow: bare ? 'none' : 'var(--dosy-shadow-sm)',
        cursor: 'pointer',
        fontFamily: 'var(--dosy-font-body)',
        color: 'var(--dosy-fg)',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 14,
        background: dosyStatus.bg,
        color: dosyStatus.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={s.iconName} size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.01em',
            color: 'var(--dosy-fg)', margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{dose.medName}</p>
          {dose.type === 'sos' && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: '0.02em',
              padding: '2px 6px', borderRadius: 6,
              background: 'var(--dosy-danger)',
              color: 'var(--dosy-fg-on-sunset)',
              fontFamily: 'var(--dosy-font-display)',
            }}>S.O.S</span>
          )}
        </div>
        <p style={{
          fontSize: 12, color: 'var(--dosy-fg-secondary)', margin: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{dose.unit}</p>
        <p style={{
          fontSize: 12, color: 'var(--dosy-fg-tertiary)', margin: '2px 0 0 0',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {relativeLabel(dose.scheduledAt)} · {formatTime(dose.scheduledAt)}
          {dose.status === 'done' && dose.actualTime && (
            <span style={{ marginLeft: 6, color: '#3F9E7E', fontWeight: 600 }}>
              → {formatTime(dose.actualTime)}
            </span>
          )}
        </p>
      </div>
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
        color: dosyStatus.color,
        background: dosyStatus.bg,
        padding: '4px 10px',
        borderRadius: 9999,
        whiteSpace: 'nowrap',
        textTransform: 'lowercase',
        fontFamily: 'var(--dosy-font-display)',
        flexShrink: 0,
      }}>
        {s.label}
      </span>
    </button>
  )

  // Non-actionable doses → plain card, no swipe
  if (!isActionable) return renderInner(false)

  // Actionable → wrap. Outer wrapper assume border/radius/shadow.
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        background: 'var(--dosy-bg-elevated)',
        border: isOverdue ? '1px solid rgba(229,86,74,0.3)' : '1px solid var(--dosy-border)',
        borderRadius: 18,
        boxShadow: 'var(--dosy-shadow-sm)',
        touchAction: 'pan-y',
      }}
      {...handlers}
    >
      {/* Reveal layer — confirm (right swipe) — green bg, icon left */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-start px-6 bg-emerald-500 text-white font-semibold transition-opacity"
        style={{ opacity: showRight ? Math.max(0.45, dragRatio) : 0 }}
      >
        <Icon name="check" size={24} className="mr-2" />
        <span>Tomada</span>
      </div>

      {/* Reveal layer — skip (left swipe) — amber bg, icon right */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end px-6 bg-amber-500 text-white font-semibold transition-opacity"
        style={{ opacity: showLeft ? Math.max(0.45, dragRatio) : 0 }}
      >
        <span>Pular</span>
        <Icon name="skip" size={24} className="ml-2" />
      </div>

      {/* Card slides on top */}
      <div
        style={{
          transform: `translateX(${delta}px)`,
          transition: delta === 0 ? 'transform 0.2s ease-out' : busy ? 'transform 0.15s ease-in' : 'none'
        }}
      >
        {renderInner(true)}
      </div>
    </div>
  )
}
