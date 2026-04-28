import { Capacitor } from '@capacitor/core'
import { useAppUpdate } from '../hooks/useAppUpdate'
import Icon from './Icon'

const isNative = Capacitor.isNativePlatform()

/**
 * Sticky banner at top of screen when a newer app version is available.
 *
 * Native (Android): tap → opens system browser to /install page → user
 * downloads + reinstalls APK manually (data preserved if signature matches).
 *
 * Web: tap → reload page; new bundle picked up automatically.
 */
export default function UpdateBanner() {
  const { available, latest, dismiss } = useAppUpdate()
  if (!available) return null

  async function handleUpdate() {
    if (isNative) {
      try {
        const { Browser } = await import('@capacitor/browser')
        const url = window.location.origin + (latest?.installUrl || '/install')
        await Browser.open({ url })
      } catch {
        window.open(latest?.installUrl || '/install', '_blank')
      }
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[90] bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg">
      <div className="max-w-md mx-auto px-4 py-2.5 flex items-center gap-3">
        <Icon name="sparkles" size={20} className="shrink-0 text-white" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-tight">Nova versão disponível</p>
          <p className="text-[11px] text-white/80 leading-tight">
            v{latest?.version}{' '}
            {isNative ? '· toque para atualizar' : '· toque para recarregar'}
          </p>
        </div>
        <button
          onClick={handleUpdate}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-emerald-700 text-xs font-bold hover:bg-emerald-50 active:scale-95 transition"
        >
          Atualizar
        </button>
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="shrink-0 w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  )
}
