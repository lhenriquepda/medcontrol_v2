import {
  Pill,
  AlarmClock,
  Bell,
  BellOff,
  Settings,
  Check,
  X,
  SkipForward,
  Hand,
  Users,
  ChartBar,
  FileText,
  Lock,
  Download,
  Sparkles,
  Trash2,
  VolumeX,
  Volume2,
  RefreshCw,
  Search,
  Plus,
  Filter,
  Calendar,
  Clock,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Heart,
  Stethoscope,
  CircleAlert,
  CircleCheck,
  TriangleAlert,
  Info,
  LogOut,
  User,
  House,
  Share2,
  Eye,
  EyeOff,
  Ellipsis,
  Siren,
  CircleEllipsis,
  Mail,
  KeyRound,
  Crown,
  Hourglass,
  CalendarCheck,
  Pencil,
  Camera,
  ChevronLeft,
  Save,
  Upload,
  PartyPopper,
  PiggyBank
} from 'lucide-react'

/**
 * Icon component — abstrai mapeamento de nome semântico → ícone SVG (lucide)
 * com fallback pra emoji legado. Permite trocar visual de TODO o app
 * editando 1 constante (ICON_STYLE) ou via localStorage runtime.
 *
 * Uso:
 *   <Icon name="pill" size={20} />
 *   <Icon name="alarm" className="text-rose-500" />
 *
 * Trocar pra emojis legados:
 *   localStorage.setItem('dosy_icon_style', 'emoji')  → reload
 *
 * Voltar pra flat (default):
 *   localStorage.removeItem('dosy_icon_style')
 *
 * Quando confirmar flat = padrão final, remover branch emoji deste arquivo.
 */

const STYLE_KEY = 'dosy_icon_style'
const DEFAULT_STYLE = 'flat'  // 'flat' | 'emoji'

// Mapping: semantic name → { emoji legacy, lucide component }
const ICONS = {
  // Medication
  pill:        { emoji: '💊', lucide: Pill },
  // Alarms / Time
  alarm:       { emoji: '⏰', lucide: AlarmClock },
  clock:       { emoji: '🕐', lucide: Clock },
  calendar:    { emoji: '📅', lucide: Calendar },
  // Notifications
  bell:        { emoji: '🔔', lucide: Bell },
  'bell-off':  { emoji: '🔕', lucide: BellOff },
  // Audio
  'volume-on':  { emoji: '🔊', lucide: Volume2 },
  'volume-off': { emoji: '🔇', lucide: VolumeX },
  // Actions
  check:       { emoji: '✓', lucide: Check },
  close:       { emoji: '✕', lucide: X },
  skip:        { emoji: '⏭', lucide: SkipForward },
  refresh:     { emoji: '↻', lucide: RefreshCw },
  search:      { emoji: '🔍', lucide: Search },
  add:         { emoji: '+', lucide: Plus },
  filter:      { emoji: '⚙', lucide: Filter },
  download:    { emoji: '⬇', lucide: Download },
  trash:       { emoji: '🗑', lucide: Trash2 },
  share:       { emoji: '🤝', lucide: Share2 },
  logout:      { emoji: '⏻', lucide: LogOut },
  // People / Health
  hand:        { emoji: '👋', lucide: Hand },
  users:       { emoji: '👨‍👩‍👧', lucide: Users },
  user:        { emoji: '👤', lucide: User },
  heart:       { emoji: '❤', lucide: Heart },
  stethoscope: { emoji: '🩺', lucide: Stethoscope },
  // Charts / Data
  'bar-chart': { emoji: '📊', lucide: ChartBar },
  'file-text': { emoji: '📄', lucide: FileText },
  // Status / Feedback
  lock:        { emoji: '🔒', lucide: Lock },
  warning:     { emoji: '⚠', lucide: TriangleAlert },
  alert:       { emoji: '🚨', lucide: CircleAlert },
  success:     { emoji: '✅', lucide: CircleCheck },
  info:        { emoji: 'ℹ', lucide: Info },
  sparkles:    { emoji: '🆕', lucide: Sparkles },
  // Navigation
  home:        { emoji: '🏠', lucide: House },
  settings:    { emoji: '⚙️', lucide: Settings },
  back:        { emoji: '←', lucide: ArrowLeft },
  forward:     { emoji: '→', lucide: ArrowRight },
  chevron:     { emoji: '›', lucide: ChevronRight },
  // Visibility
  eye:         { emoji: '👁', lucide: Eye },
  'eye-off':   { emoji: '⚊', lucide: EyeOff },
  // Misc
  more:        { emoji: '⋯', lucide: Ellipsis },
  sos:         { emoji: '🆘', lucide: Siren },
  mail:        { emoji: '✉', lucide: Mail },
  key:         { emoji: '🔑', lucide: KeyRound },
  crown:       { emoji: '👑', lucide: Crown },
  // Status extras
  pending:     { emoji: '⏳', lucide: Hourglass },
  scheduled:   { emoji: '🗓️', lucide: CalendarCheck },
  // Edit / media
  edit:        { emoji: '✏️', lucide: Pencil },
  camera:      { emoji: '📷', lucide: Camera },
  'chevron-left': { emoji: '‹', lucide: ChevronLeft },
  save:        { emoji: '💾', lucide: Save },
  upload:      { emoji: '⬆', lucide: Upload },
  party:       { emoji: '🎉', lucide: PartyPopper },
  piggy:       { emoji: '🐷', lucide: PiggyBank }
}

function getStyle() {
  if (typeof window === 'undefined') return DEFAULT_STYLE
  return localStorage.getItem(STYLE_KEY) || DEFAULT_STYLE
}

export default function Icon({ name, size = 18, className = '', strokeWidth = 2, style }) {
  const map = ICONS[name]
  if (!map) {
    // unknown icon — render `?` placeholder
    return <span className={className} style={style} aria-hidden="true">?</span>
  }

  const useStyle = getStyle()

  if (useStyle === 'emoji' || !map.lucide) {
    return (
      <span
        className={className}
        style={{ fontSize: size, lineHeight: 1, ...style }}
        aria-hidden="true"
      >
        {map.emoji}
      </span>
    )
  }

  const Cmp = map.lucide
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      aria-hidden="true"
    />
  )
}

/**
 * Convenience wrapper for inline emoji-only legacy usage.
 * Useful em strings dinâmicas onde Icon component não cabe.
 */
export function emojiFor(name) {
  return ICONS[name]?.emoji || '?'
}
