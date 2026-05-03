/**
 * Dosy PageHeader — sub-header de páginas secundárias (Pacientes, More,
 * Settings, etc). Renderiza ABAIXO do AppHeader sticky principal.
 *
 * Title display 28 + optional back button + optional subtitle + right slot.
 */
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function PageHeader({ title, subtitle, back, right, className = '', style }) {
  const nav = useNavigate()
  return (
    <div
      className={className}
      style={{
        maxWidth: 448,
        margin: '0 auto',
        padding: '14px 22px 8px',
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'var(--dosy-font-display)',
        ...style,
      }}
    >
      {back && (
        <button
          type="button"
          onClick={() => nav(-1)}
          aria-label="Voltar"
          className="dosy-press"
          style={{
            width: 38, height: 38, borderRadius: 9999,
            background: 'var(--dosy-bg-elevated)',
            color: 'var(--dosy-fg)',
            boxShadow: 'var(--dosy-shadow-sm)',
            border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={20} strokeWidth={1.75}/>
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          fontWeight: 800, fontSize: 28, letterSpacing: '-0.025em',
          color: 'var(--dosy-fg)', lineHeight: 1.1,
          margin: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</h1>
        {subtitle && (
          <p style={{
            fontSize: 13, color: 'var(--dosy-fg-secondary)',
            margin: '4px 0 0 0',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: 'var(--dosy-font-body)',
          }}>{subtitle}</p>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}
