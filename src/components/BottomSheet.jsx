import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function BottomSheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
           style={{ animation: 'slideUp .25s ease-out' }}>
        <div className="pt-2 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>
        {title && <div className="px-5 pt-3 pb-2 font-semibold">{title}</div>}
        <div className="px-5 py-3 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 safe-bottom">{footer}</div>}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  ), document.body)
}
