import { memo } from 'react'
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
 * Icon component — mapeia nome semântico → ícone SVG (lucide flat).
 *
 * v0.2.3.5 #246 — Removido suporte a emoji style (toggle Settings deletado).
 * Flat = padrão definitivo. Antes mantinha branch emoji+localStorage `dosy_icon_style`.
 *
 * Uso:
 *   <Icon name="pill" size={20} />
 *   <Icon name="alarm" className="text-rose-500" />
 */

const ICONS = {
  pill: Pill,
  alarm: AlarmClock,
  clock: Clock,
  calendar: Calendar,
  bell: Bell,
  'bell-off': BellOff,
  'volume-on': Volume2,
  'volume-off': VolumeX,
  check: Check,
  close: X,
  skip: SkipForward,
  refresh: RefreshCw,
  search: Search,
  add: Plus,
  filter: Filter,
  download: Download,
  trash: Trash2,
  share: Share2,
  logout: LogOut,
  hand: Hand,
  users: Users,
  user: User,
  heart: Heart,
  stethoscope: Stethoscope,
  'bar-chart': ChartBar,
  'file-text': FileText,
  lock: Lock,
  warning: TriangleAlert,
  alert: CircleAlert,
  success: CircleCheck,
  info: Info,
  sparkles: Sparkles,
  home: House,
  settings: Settings,
  back: ArrowLeft,
  forward: ArrowRight,
  chevron: ChevronRight,
  eye: Eye,
  'eye-off': EyeOff,
  more: Ellipsis,
  sos: Siren,
  mail: Mail,
  key: KeyRound,
  crown: Crown,
  pending: Hourglass,
  scheduled: CalendarCheck,
  edit: Pencil,
  camera: Camera,
  'chevron-left': ChevronLeft,
  save: Save,
  upload: Upload,
  party: PartyPopper,
  piggy: PiggyBank,
}

// Aud 4.5.5 G5 — Icon usado centenas de vezes por render. memo evita re-render
// quando name/size/className/style permanecem iguais.
function IconComponent({ name, size = 18, className = '', strokeWidth = 2, style }) {
  const Cmp = ICONS[name]
  if (!Cmp) {
    return <span className={className} style={style} aria-hidden="true">?</span>
  }
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

const Icon = memo(IconComponent)
export default Icon
