import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * useOnlineStatus — true/false connectivity hook.
 *
 * Native: @capacitor/network listener (real connection state, including no-internet wifi).
 * Web:    navigator.onLine + online/offline window events (fallback, less accurate).
 *
 * Usage:
 *   const online = useOnlineStatus()
 *   if (!online) toast.show({ message: 'Sem conexão', kind: 'warn' })
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => {
    if (typeof navigator !== 'undefined') return navigator.onLine
    return true
  })

  useEffect(() => {
    let cleanup = () => {}
    if (Capacitor.isNativePlatform()) {
      let handle
      ;(async () => {
        const { Network } = await import('@capacitor/network')
        const status = await Network.getStatus()
        setOnline(status.connected)
        handle = await Network.addListener('networkStatusChange', (s) => {
          setOnline(s.connected)
        })
      })()
      cleanup = () => { handle?.remove?.() }
    } else {
      const onOn = () => setOnline(true)
      const onOff = () => setOnline(false)
      window.addEventListener('online', onOn)
      window.addEventListener('offline', onOff)
      cleanup = () => {
        window.removeEventListener('online', onOn)
        window.removeEventListener('offline', onOff)
      }
    }
    return () => cleanup()
  }, [])

  return online
}
