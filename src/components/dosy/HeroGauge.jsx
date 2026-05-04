/**
 * Dosy HeroGauge — circular SVG ring animado pra hero card sunset.
 * Source design: contexto/claude-design/dosy/project/src/screens/Inicio.jsx
 *
 * Renderiza ring outer track + foreground arc proporcional a taken/total.
 * Animação CSS transition stroke-dashoffset 900ms ease-out (suave).
 */
import { useEffect, useState } from 'react'

export function HeroGauge({ taken, total, size = 108, label = 'doses' }) {
  const safeTotal = total > 0 ? total : 1
  const pct = Math.round((taken / safeTotal) * 100)
  const r = (size - 16) / 2
  const c = 2 * Math.PI * r
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setProgress(pct), 120)
    return () => clearTimeout(t)
  }, [pct])

  const offset = c * (1 - progress / 100)

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="8"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#fff',
      }}>
        <div style={{
          fontFamily: 'var(--dosy-font-display)',
          fontWeight: 800, fontSize: size * 0.3,
          lineHeight: 1, letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span>{taken}</span>
          <span style={{ opacity: 0.6, fontSize: '0.6em' }}>/{total}</span>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, opacity: 0.85,
          marginTop: 3, letterSpacing: '0.05em',
        }}>{label}</div>
      </div>
    </div>
  )
}
