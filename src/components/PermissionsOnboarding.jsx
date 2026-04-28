import { useEffect, useState, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import Icon from './Icon'
import {
  checkAllPermissions,
  openExactAlarmSettings,
  openFullScreenIntentSettings,
  openOverlaySettings,
  openAppNotificationSettings,
} from '../services/criticalAlarm'

const isNative = Capacitor.isNativePlatform()
const STORAGE_KEY = 'dosy_permissions_dismissed'

/**
 * PermissionsOnboarding — first-launch screen guiding user through Android
 * special-access permissions required for alarme estilo despertador.
 *
 * Required for full notif behavior:
 *   1. POST_NOTIFICATIONS         (Android 13+ runtime — auto-prompt when first scheduling)
 *   2. SCHEDULE_EXACT_ALARM       (Android 12+ — usually auto via USE_EXACT_ALARM)
 *   3. USE_FULL_SCREEN_INTENT     (Android 14+ — needs Settings grant)
 *   4. SYSTEM_ALERT_WINDOW        (any version — needs Settings grant for BAL bypass)
 *
 * Without #3 + #4, fullscreen alarm activity is blocked on unlocked screen.
 * Sound + heads-up notif still work.
 *
 * UX:
 *   - Modal overlay on top of Dashboard, blocking until grants OR explicit skip
 *   - Each item shows status (✓ granted / ✗ missing) + button to open Settings
 *   - Auto re-checks on app resume (Capacitor lifecycle)
 *   - Once allGranted=true, dismisses + writes localStorage flag
 *   - User can skip; banner reappears in Settings/Dashboard if still missing
 */
export default function PermissionsOnboarding({ onComplete, onClose }) {
  const [perms, setPerms] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!isNative) {
      setPerms({ allGranted: true })
      setOpen(false)
      onClose?.()
      return
    }
    try {
      const status = await checkAllPermissions()
      setPerms(status)
      const dismissed = localStorage.getItem(STORAGE_KEY) === '1'
      const shouldShow = !status.allGranted && !dismissed
      setOpen(shouldShow)
      if (status.allGranted) {
        localStorage.setItem(STORAGE_KEY, '1')
        onComplete?.()
        onClose?.()
      } else if (!shouldShow) {
        // Already dismissed
        onClose?.()
      }
    } catch (e) {
      console.warn('[Permissions] check failed:', e?.message)
    }
  }, [onComplete, onClose])

  // Initial check
  useEffect(() => {
    refresh()
  }, [refresh])

  // External trigger: Settings button OR any caller dispatches this event
  // to force the modal open (re-check permissions on demand).
  useEffect(() => {
    const handler = async () => {
      localStorage.removeItem(STORAGE_KEY)
      if (!isNative) {
        setPerms({ allGranted: true })
        setOpen(false)
        return
      }
      try {
        const status = await checkAllPermissions()
        setPerms(status)
        setOpen(true)
      } catch (e) {
        console.warn('[Permissions] manual check failed:', e?.message)
      }
    }
    window.addEventListener('dosy:checkPermissions', handler)
    return () => window.removeEventListener('dosy:checkPermissions', handler)
  }, [])

  // Re-check when app returns from Settings (Capacitor lifecycle)
  useEffect(() => {
    if (!isNative) return
    let resumeHandle
    const setup = async () => {
      resumeHandle = await CapApp.addListener('resume', refresh)
    }
    setup()
    return () => resumeHandle?.remove?.()
  }, [refresh])

  if (!perms || !open) return null

  const items = [
    {
      key: 'notifsEnabled',
      title: 'Notificações habilitadas',
      desc: 'Permita o app enviar notificações de doses.',
      action: openAppNotificationSettings,
      granted: perms.notifsEnabled,
      essential: true,
    },
    {
      key: 'canScheduleExact',
      title: 'Alarmes exatos',
      desc: 'Permite que o alarme dispare no horário exato da dose.',
      action: openExactAlarmSettings,
      granted: perms.canScheduleExact,
      essential: true,
    },
    {
      key: 'canFullScreenIntent',
      title: 'Notificações em tela cheia',
      desc: 'Mostra a tela do alarme automaticamente quando a dose fica.',
      action: openFullScreenIntentSettings,
      granted: perms.canFullScreenIntent,
      essential: true,
    },
    {
      key: 'canDrawOverlay',
      title: 'Aparecer sobre outros apps',
      desc: 'Permite o alarme abrir mesmo com você usando outro app.',
      action: openOverlaySettings,
      granted: perms.canDrawOverlay,
      essential: true,
    },
  ]

  const grantedCount = items.filter(i => i.granted).length
  const total = items.length

  async function handleAction(action) {
    setBusy(true)
    try { await action() }
    catch (e) { console.warn('[Permissions] open settings failed:', e?.message) }
    finally { setBusy(false) }
  }

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl">
          <Icon name="alarm" size={28} className="mb-2 text-brand-600" />
          <h2 className="text-lg font-semibold">Configurar alarmes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pra você nunca esquecer uma dose, libere as permissões abaixo. O alarme funciona como um despertador.
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(grantedCount / total) * 100}%` }}
              />
            </div>
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {grantedCount}/{total}
            </span>
          </div>
        </div>

        <ul className="p-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.key}
              className={`rounded-xl border p-3 transition ${
                item.granted
                  ? 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-500/10'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`text-xl shrink-0 ${item.granted ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {item.granted ? '✓' : '○'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
                  {!item.granted && (
                    <button
                      onClick={() => handleAction(item.action)}
                      disabled={busy}
                      className="mt-2 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Abrir configurações →
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 sticky bottom-0 bg-white dark:bg-slate-900">
          <button
            onClick={dismiss}
            className="flex-1 py-2.5 text-sm rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Pular por agora
          </button>
          <button
            onClick={refresh}
            disabled={busy}
            className="flex-1 py-2.5 text-sm rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium"
          >
            Verificar de novo
          </button>
        </div>

        {grantedCount < total && (
          <p className="px-4 pb-4 text-[11px] text-slate-400 text-center">
            Pode pular agora e configurar depois em <strong>Ajustes</strong>.
          </p>
        )}
      </div>
    </div>
  )
}
