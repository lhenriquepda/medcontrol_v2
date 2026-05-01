import { createContext, useContext, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TIMING, EASE } from '../animations'
import { uuid } from '../utils/uuid'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const show = useCallback((opts) => {
    const id = uuid()
    const toast = {
      id,
      message: opts.message || '',
      kind: opts.kind || 'info',
      undoLabel: opts.undoLabel,
      onUndo: opts.onUndo,
      duration: opts.duration ?? 5000
    }
    setToasts((t) => [...t, toast])
    if (toast.duration > 0) setTimeout(() => dismiss(id), toast.duration)
    return id
  }, [dismiss])

  return (
    <ToastCtx.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed bottom-24 inset-x-0 px-4 flex flex-col items-center gap-2 z-[60] pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              transition={{ duration: TIMING.base, ease: EASE.out }}
              className={`pointer-events-auto w-full max-w-md rounded-xl shadow-lg px-4 py-3 flex items-center justify-between gap-3 ${
                t.kind === 'success' ? 'bg-emerald-600 text-white' :
                t.kind === 'error' ? 'bg-rose-600 text-white' :
                t.kind === 'warn' ? 'bg-amber-500 text-white' :
                'bg-slate-900 text-white dark:bg-slate-800'
              }`}>
              <span className="text-sm">{t.message}</span>
              <div className="flex items-center gap-2">
                {t.onUndo && (
                  <button onClick={() => { t.onUndo(); dismiss(t.id) }}
                          className="text-sm font-semibold underline underline-offset-2">
                    {t.undoLabel || 'Desfazer'}
                  </button>
                )}
                <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">✕</button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
