/**
 * Dosy MiniStat — small stat card 2-up grid.
 * Source design: contexto/claude-design/dosy/project/src/screens/Inicio.jsx
 *
 * Variants:
 *   tone: neutral | success | danger
 *   trend: optional small caption ("+4", "-2")
 *   unit: optional inline suffix ("hoje", "%")
 */
export function MiniStat({ label, value, unit, trend, tone = 'neutral', className = '', style }) {
  const colors = {
    neutral: { fg: 'var(--dosy-fg)', trendFg: 'var(--dosy-fg-secondary)' },
    success: { fg: 'var(--dosy-fg)', trendFg: '#3F9E7E' },
    danger:  { fg: 'var(--dosy-danger)', trendFg: 'var(--dosy-danger)' },
  }[tone] || { fg: 'var(--dosy-fg)', trendFg: 'var(--dosy-fg-secondary)' }
  return (
    <div className={className} style={{
      padding: '14px 16px',
      background: 'var(--dosy-bg-elevated)',
      borderRadius: 18,
      boxShadow: 'var(--dosy-shadow-sm)',
      ...style,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
        fontFamily: 'var(--dosy-font-display)',
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
        <span style={{
          fontFamily: 'var(--dosy-font-display)',
          fontWeight: 800, fontSize: 26,
          letterSpacing: '-0.02em', color: colors.fg,
          fontVariantNumeric: 'tabular-nums',
        }}>{value}</span>
        {unit && (
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--dosy-fg-secondary)' }}>
            {unit}
          </span>
        )}
      </div>
      {trend && (
        <div style={{
          fontSize: 11.5, color: colors.trendFg,
          fontWeight: 600, marginTop: 2,
        }}>{trend}</div>
      )}
    </div>
  )
}
