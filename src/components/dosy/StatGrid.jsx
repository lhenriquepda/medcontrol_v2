/**
 * StatGrid — Refactor Fase 4 (Refactor_Full.md §11.3 item 5).
 *
 * Substitui grids de stats 2-col em Dashboard ("Adesão 7d" + "Atrasadas"),
 * PatientDetail (stats hoje + tratamentos ativos), Analytics (overall %).
 *
 * Uso:
 *   <StatGrid
 *     stats={[
 *       { label: 'Adesão 7d', value: '92%', tone: 'success' },
 *       { label: 'Atrasadas', value: 3, unit: 'agora', tone: 'danger' },
 *     ]}
 *     columns={2}
 *   />
 */
import { MiniStat } from './MiniStat'

export default function StatGrid({ stats, columns = 2, gap = 12 }) {
  if (!Array.isArray(stats) || stats.length === 0) return null
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
      }}
    >
      {stats.map((s, i) => (
        <MiniStat
          key={s.key || s.label || i}
          label={s.label}
          value={s.value}
          unit={s.unit}
          tone={s.tone || 'neutral'}
        />
      ))}
    </div>
  )
}
