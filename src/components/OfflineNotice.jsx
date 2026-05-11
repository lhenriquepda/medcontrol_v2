import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

/**
 * OfflineNotice — Item #204 v0.2.1.8.
 *
 * Banner contextual reusável pra páginas/sections com features que NÃO funcionam
 * offline. Diferente de OfflineBanner (bottom-amber count mutations queued),
 * este é informativo estático.
 *
 * Uso:
 *   <OfflineNotice featureLabel="compartilhamento, exportação e exclusão de conta" />
 *
 * Se online: render null (não ocupa espaço).
 */
export default function OfflineNotice({
  featureLabel = 'algumas configurações',
  variant = 'inline', // 'inline' (card padrão) | 'compact' (linha fina)
}) {
  const online = useOnlineStatus()
  if (online) return null

  if (variant === 'compact') {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: 'var(--dosy-warn-bg, #fef3c7)',
          color: 'var(--dosy-warn-fg, #92400e)',
          borderRadius: 8,
          fontSize: 13,
          fontFamily: 'var(--dosy-font-body)',
        }}
      >
        <WifiOff size={14} aria-hidden="true" />
        <span>Sem conexão — {featureLabel} indisponível.</span>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px',
        background: 'var(--dosy-warn-bg, #fef3c7)',
        color: 'var(--dosy-warn-fg, #92400e)',
        borderRadius: 12,
        fontSize: 13.5,
        lineHeight: 1.4,
        fontFamily: 'var(--dosy-font-body)',
        margin: '0 0 12px 0',
      }}
    >
      <WifiOff size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <strong style={{ display: 'block', marginBottom: 2 }}>Você está offline</strong>
        <span>{featureLabel} requer internet. Reconecte para usar.</span>
      </div>
    </div>
  )
}
