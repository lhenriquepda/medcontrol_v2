import { useEffect, useState } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CloudOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

/**
 * OfflineBanner — Item #204 (release v0.2.1.7).
 *
 * Sinalização visual quando user está offline com mutations enfileiradas
 * (confirmação de dose, criação de paciente etc) ou acabou de reconectar
 * com queue drenando.
 *
 * Visibilidade:
 *   1. Offline + N mutations pendentes → banner amber "N ação(ões) offline — sincroniza ao reconectar"
 *   2. Online (transição) + N mutations ainda drenando → banner verde "Sincronizando…" por 3s
 *   3. Caso contrário escondido.
 *
 * Posicionamento: fixed bottom-center acima BottomNav (z-40 < BottomNav z-50).
 * Compactly accessible — não bloqueia BottomNav nem conteúdo principal.
 */
export default function OfflineBanner() {
  const online = useOnlineStatus()
  const pending = useIsMutating()
  const [draining, setDraining] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  // Detecta transição offline → online com mutations enfileiradas: mostra
  // "Sincronizando…" por 3s ou até pending zerar.
  useEffect(() => {
    if (!online) {
      setWasOffline(true)
      setDraining(false)
      return
    }
    // Acabou de reconectar
    if (wasOffline && pending > 0) {
      setDraining(true)
      const t = setTimeout(() => setDraining(false), 3000)
      return () => clearTimeout(t)
    }
    if (online && pending === 0) {
      setDraining(false)
      setWasOffline(false)
    }
  }, [online, pending, wasOffline])

  const showOffline = !online && pending > 0
  const showDraining = online && draining && pending > 0
  const visible = showOffline || showDraining

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          className="fixed left-2 right-2 z-40 mx-auto max-w-md rounded-lg shadow-lg"
          style={{
            // Posiciona acima da BottomNav (~64px) + safe-bottom env
            bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))'
          }}
        >
          {showOffline ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/95 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <CloudOff size={16} aria-hidden="true" />
              <span>
                {pending} {pending === 1 ? 'ação salva' : 'ações salvas'} offline — sincroniza ao reconectar
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-600/95 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
              <span>Sincronizando {pending} {pending === 1 ? 'ação' : 'ações'}…</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
