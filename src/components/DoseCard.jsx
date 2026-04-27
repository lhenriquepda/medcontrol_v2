import { useState } from 'react'
import { useSwipeable } from 'react-swipeable'
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

  const cardInner = (
    <button
      onClick={() => { if (Math.abs(delta) < 4) onClick?.() }}
      className={`w-full text-left card p-4 flex items-center gap-3 transition active:scale-[0.99] ${isOverdue ? 'border-rose-300 dark:border-rose-500/40' : ''}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${s.color}`}>{s.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold truncate">{dose.medName}</p>
          {dose.type === 'sos' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white">S.O.S</span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">{dose.unit}</p>
        <p className="text-xs mt-0.5 text-slate-600 dark:text-slate-400">
          {relativeLabel(dose.scheduledAt)} · {formatTime(dose.scheduledAt)}
          {dose.status === 'done' && dose.actualTime && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400">→ {formatTime(dose.actualTime)}</span>
          )}
        </p>
      </div>
      <span className={`chip ${s.color}`}>{s.label}</span>
    </button>
  )

  // Non-actionable doses → plain card, no swipe
  if (!isActionable) return cardInner

  // Actionable → wrap with swipe handlers + reveal layers
  // touch-action: pan-y → browser allows native vertical scroll;
  // horizontal swipe goes through JS handlers without blocking page scroll
  return (
    <div
      className="relative overflow-hidden rounded-2xl select-none"
      style={{ touchAction: 'pan-y' }}
      {...handlers}
    >
      {/* Reveal layer — confirm (right swipe) — green bg, icon left */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-start px-6 bg-emerald-500 text-white font-semibold transition-opacity"
        style={{ opacity: showRight ? Math.max(0.45, dragRatio) : 0 }}
      >
        <span className="text-2xl mr-2">✓</span>
        <span>Tomada</span>
      </div>

      {/* Reveal layer — skip (left swipe) — amber bg, icon right */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end px-6 bg-amber-500 text-white font-semibold transition-opacity"
        style={{ opacity: showLeft ? Math.max(0.45, dragRatio) : 0 }}
      >
        <span>Pular</span>
        <span className="text-2xl ml-2">⏭</span>
      </div>

      {/* Card slides on top */}
      <div
        style={{
          transform: `translateX(${delta}px)`,
          transition: delta === 0 ? 'transform 0.2s ease-out' : busy ? 'transform 0.15s ease-in' : 'none'
        }}
      >
        {cardInner}
      </div>
    </div>
  )
}
