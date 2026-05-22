/**
 * Dosy primitives barrel — release v0.2.0.0 redesign
 * Source design: contexto/claude-design/dosy/project/src/Primitives.jsx
 *
 * Uso recomendado:
 *   import { Button, IconButton, Card, Sheet, StatusPill, Avatar } from '@/components/dosy'
 *
 * Todos primitivos consomem CSS vars `--dosy-*` definidas em
 * `src/styles/dosy-tokens.css`. Tokens e tema (light/dark) gerenciados
 * centralmente. Usa lucide-react pra ícones (mesma convenção do app).
 */

export { Button, IconButton, Chip } from './buttons.jsx'
export { StatusPill, Toast } from './feedback.jsx'
export { Input, Toggle } from './forms.jsx'
export { Card, SectionTitle, Sheet, Modal } from './surfaces.jsx'
export { Avatar, PillIcon } from './avatar.jsx'
export { AdBanner, UpdateBanner } from './banners.jsx'
export { HeroGauge } from './HeroGauge.jsx'
export { MiniStat } from './MiniStat.jsx'
export { BellButton, BellAlerts } from './BellAlerts.jsx'
export { default as HeaderAlertIcon } from './HeaderAlertIcon.jsx'
export { default as PageHeader } from './PageHeader.jsx'
// Refactor Fase 4 (Refactor_Full.md §11.3) — componentes prontos pra adoption.
export { default as EmptyState } from './EmptyState.jsx'
export { default as DateRangeChips } from './DateRangeChips.jsx'
export { default as StatGrid } from './StatGrid.jsx'
export { default as FormRow } from './FormRow.jsx'
export { default as TodayDosesStat } from './TodayDosesStat.jsx'
export { default as MedicationHistoryGrid } from './MedicationHistoryGrid.jsx'
export { default as TreatmentCard } from './TreatmentCard.jsx'
export { default as DoseList } from './DoseList.jsx'
export { default as FilterPanel } from './FilterPanel.jsx'
export { default as DoseSheet } from './DoseSheet.jsx'
