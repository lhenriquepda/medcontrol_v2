import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { AlarmClock, Check, Circle, ChevronRight } from 'lucide-react'
import { Button } from './dosy'
import {
  checkAllPermissions,
  openExactAlarmSettings,
  openFullScreenIntentSettings,
  openOverlaySettings,
  openAppNotificationSettings,
  requestIgnoreBatteryOptimizations,
} from '../services/criticalAlarm'

const isNative = Capacitor.isNativePlatform()
const STORAGE_KEY = 'dosy_permissions_dismissed_version'
/* eslint-disable no-undef */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
/* eslint-enable no-undef */

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
      const dismissedVersion = localStorage.getItem(STORAGE_KEY)
      const dismissedThisVersion = dismissedVersion === APP_VERSION
      const shouldShow = !status.allGranted && !dismissedThisVersion
      setOpen(shouldShow)
      if (status.allGranted) {
        localStorage.setItem(STORAGE_KEY, APP_VERSION)
        onComplete?.()
        onClose?.()
      } else if (!shouldShow) {
        onClose?.()
      }
    } catch (e) {
      console.warn('[Permissions] check failed:', e?.message)
    }
  }, [onComplete, onClose])

  useEffect(() => { refresh() }, [refresh])

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
    },
    {
      key: 'canScheduleExact',
      title: 'Alarmes exatos',
      desc: 'Permite que o alarme dispare no horário exato da dose.',
      action: openExactAlarmSettings,
      granted: perms.canScheduleExact,
    },
    {
      key: 'canFullScreenIntent',
      title: 'Notificações em tela cheia',
      desc: 'Mostra a tela do alarme automaticamente quando a dose toca.',
      action: openFullScreenIntentSettings,
      granted: perms.canFullScreenIntent,
    },
    {
      key: 'canDrawOverlay',
      title: 'Aparecer sobre outros apps',
      desc: 'Permite o alarme abrir mesmo com você usando outro app.',
      action: openOverlaySettings,
      granted: perms.canDrawOverlay,
    },
    {
      key: 'ignoringBatteryOpt',
      title: 'Ignorar otimização de bateria',
      desc: 'Crítico em Samsung/Xiaomi: sem isso o sistema pode cancelar alarmes pra economizar bateria.',
      action: requestIgnoreBatteryOptimizations,
      granted: perms.ignoringBatteryOpt,
    },
  ]

  const grantedCount = items.filter((i) => i.granted).length
  const total = items.length

  async function handleAction(action) {
    setBusy(true)
    try { await action() }
    catch (e) { console.warn('[Permissions] open settings failed:', e?.message) }
    finally { setBusy(false) }
  }

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, APP_VERSION)
    setOpen(false)
    onClose?.()
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(28,20,16,0.55)',
        backdropFilter: 'blur(14px) saturate(160%)',
        WebkitBackdropFilter: 'blur(14px) saturate(160%)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 448,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--dosy-bg-elevated)',
        borderRadius: 28,
        boxShadow: 'var(--dosy-shadow-lg)',
        border: '1px solid var(--dosy-border)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--dosy-divider)',
          background: 'var(--dosy-bg-elevated)',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--dosy-peach-100)',
            color: 'var(--dosy-primary)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 10,
          }}>
            <AlarmClock size={26} strokeWidth={1.75}/>
          </div>
          <h2 style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em',
            color: 'var(--dosy-fg)', margin: 0, lineHeight: 1.2,
          }}>Configurar alarmes</h2>
          <p style={{
            fontSize: 13.5, color: 'var(--dosy-fg-secondary)',
            lineHeight: 1.5, margin: '6px 0 0 0',
          }}>
            Pra nunca esquecer uma dose, libere as permissões abaixo. O alarme funciona como um despertador.
          </p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 14,
          }}>
            <div style={{
              flex: 1, height: 6, borderRadius: 9999,
              background: 'var(--dosy-bg-sunken)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${(grantedCount / total) * 100}%`,
                background: 'var(--dosy-gradient-sunset)',
                borderRadius: 9999,
                transition: 'width 600ms var(--dosy-ease-out)',
              }}/>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: 'var(--dosy-fg-secondary)',
              fontFamily: 'var(--dosy-font-display)',
              fontVariantNumeric: 'tabular-nums',
            }}>{grantedCount}/{total}</span>
          </div>
        </div>

        {/* Items list */}
        <ul className="dosy-scroll" style={{
          listStyle: 'none', margin: 0, padding: '12px',
          display: 'flex', flexDirection: 'column', gap: 8,
          overflowY: 'auto', flex: 1,
        }}>
          {items.map((item) => (
            <li
              key={item.key}
              style={{
                padding: 14,
                borderRadius: 14,
                background: item.granted ? 'var(--dosy-success-bg)' : 'var(--dosy-bg-sunken)',
                border: item.granted
                  ? '1px solid rgba(110,201,168,0.35)'
                  : '1px solid var(--dosy-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  width: 24, height: 24, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: item.granted ? '#3F9E7E' : 'var(--dosy-fg-tertiary)',
                  marginTop: 1,
                }}>
                  {item.granted
                    ? <Check size={18} strokeWidth={2.5}/>
                    : <Circle size={18} strokeWidth={1.75}/>}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 13.5, fontWeight: 700, margin: 0,
                    color: 'var(--dosy-fg)',
                    fontFamily: 'var(--dosy-font-display)',
                    letterSpacing: '-0.01em',
                  }}>{item.title}</p>
                  <p style={{
                    fontSize: 12, color: 'var(--dosy-fg-secondary)',
                    margin: '2px 0 0 0', lineHeight: 1.4,
                  }}>{item.desc}</p>
                  {!item.granted && (
                    <button
                      type="button"
                      onClick={() => handleAction(item.action)}
                      disabled={busy}
                      style={{
                        marginTop: 8,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: 0,
                        fontSize: 12, fontWeight: 700,
                        color: 'var(--dosy-primary)',
                        fontFamily: 'var(--dosy-font-display)',
                        display: 'inline-flex', alignItems: 'center', gap: 2,
                      }}
                    >
                      Abrir configurações
                      <ChevronRight size={13} strokeWidth={2.5}/>
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div style={{
          padding: 14,
          borderTop: '1px solid var(--dosy-divider)',
          display: 'flex', gap: 8,
          background: 'var(--dosy-bg-elevated)',
        }}>
          <Button kind="ghost" onClick={dismiss} full size="md">
            Pular por agora
          </Button>
          <Button kind="primary" onClick={refresh} disabled={busy} full size="md">
            Verificar de novo
          </Button>
        </div>

        {grantedCount < total && (
          <p style={{
            padding: '0 16px 14px',
            fontSize: 11, textAlign: 'center',
            color: 'var(--dosy-fg-tertiary)', margin: 0,
          }}>
            Pode pular agora e configurar depois em <strong>Ajustes</strong>.
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
