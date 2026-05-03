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
