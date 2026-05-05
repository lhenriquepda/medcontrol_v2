// #029 (v0.2.0.11) — Row helper extraído do Settings.jsx pra reuso isolado.
export default function Row({ icon: IconCmp, label, hint, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {IconCmp && <IconCmp size={16} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-secondary)' }}/>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--dosy-fg)', margin: 0 }}>{label}</p>
          {hint && <p style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0' }}>{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}
