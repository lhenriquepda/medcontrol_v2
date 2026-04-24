import { formatTime, relativeLabel } from '../utils/dateUtils'
import { STATUS_CONFIG } from '../utils/statusUtils'

export default function DoseCard({ dose, onClick }) {
  const s = STATUS_CONFIG[dose.status] || STATUS_CONFIG.pending
  const isOverdue = dose.status === 'overdue'
  return (
    <button onClick={onClick}
      className={`w-full text-left card p-4 flex items-center gap-3 transition active:scale-[0.99] ${isOverdue ? 'border-rose-300 dark:border-rose-500/40' : ''}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${s.color}`}>{s.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold truncate">{dose.medName}</p>
          {dose.type === 'sos' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white">S.O.S</span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">{dose.unit}</p>
        <p className="text-xs mt-0.5 text-slate-600 dark:text-slate-400">
          {relativeLabel(dose.scheduledAt)} · {formatTime(dose.scheduledAt)}
          {dose.status === 'done' && dose.actualTime && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400">→ {formatTime(dose.actualTime)}</span>
          )}
        </p>
      </div>
      <span className={`chip ${s.color}`}>{s.label}</span>
    </button>
  )
}
