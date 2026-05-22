/**
 * DateRangeChips — Refactor Fase 4 (Refactor_Full.md §11.3 item 4).
 *
 * Substitui horizontal scroll de chips de período em FilterBar (Dashboard),
 * DoseHistory (day strip), Reports (presets), Analytics (7d/30d). Padrão
 * visual consistente.
 *
 * Uso:
 *   <DateRangeChips
 *     ranges={[
 *       { key: '12h', label: '12h' },
 *       { key: '24h', label: '24h' },
 *       { key: '48h', label: '48h' },
 *       { key: '7d', label: '7 dias' },
 *     ]}
 *     value={range}
 *     onChange={setRange}
 *   />
 */
import { Chip } from './buttons'

export default function DateRangeChips({
  ranges,
  value,
  onChange,
  ariaLabel = 'Selecionar período',
  scrollable = true,
}) {
  if (!Array.isArray(ranges) || ranges.length === 0) return null

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        gap: 6,
        overflowX: scrollable ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
      className="dosy-no-scrollbar"
    >
      {ranges.map((r) => {
        const active = r.key === value
        return (
          <Chip
            key={r.key}
            role="radio"
            aria-checked={active}
            active={active}
            onClick={() => onChange?.(r.key)}
            style={{ flexShrink: 0 }}
          >
            {r.label}
          </Chip>
        )
      })}
    </div>
  )
}
