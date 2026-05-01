import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FocusTrap } from 'focus-trap-react'
import { AnimatePresence, motion } from 'framer-motion'
import { TIMING, EASE } from '../animations'

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

  return createPortal((
    <AnimatePresence>
      {open && (
        <FocusTrap focusTrapOptions={{ allowOutsideClick: true, escapeDeactivates: false, fallbackFocus: '[role="dialog"]' }}>
          <div className="fixed inset-0 z-[100] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title || 'Dialog'} tabIndex={-1}>
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: TIMING.fast, ease: EASE.inOut }}
              onClick={onClose}
              aria-hidden="true"
            />
            <motion.div
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ ...EASE.spring }}
            >
              <div className="pt-2 flex justify-center">
                <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
              </div>
              {title && <div className="px-5 pt-3 pb-2 font-semibold">{title}</div>}
              <div className={`px-5 py-3 overflow-y-auto ${footer ? '' : 'safe-bottom pb-5'}`}>{children}</div>
              {footer && <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 safe-bottom pb-5">{footer}</div>}
            </motion.div>
          </div>
        </FocusTrap>
      )}
    </AnimatePresence>
  ), document.body)
}
