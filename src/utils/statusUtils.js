export const STATUS_CONFIG = {
  done:      { label: 'Tomada',    icon: '✓', iconName: 'check',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  skipped:   { label: 'Pulada',    icon: '↷', iconName: 'skip',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  overdue:   { label: 'Atrasada',  icon: '!', iconName: 'warning', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' },
  pending:   { label: 'Pendente',  icon: '○', iconName: 'pending', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300' },
  // v0.2.3.1 — status novo: dose cancelada via pauseTreatment/endTreatment (UPDATE batch).
  cancelled: { label: 'Cancelada', icon: '⊘', iconName: 'cancel',  color: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400' }
}

export function statusLabel(status) {
  return STATUS_CONFIG[status]?.label ?? status
}
