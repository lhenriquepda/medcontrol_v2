import { useState } from 'react'
import BottomSheet from './BottomSheet'
import Icon from './Icon'
import PatientPicker from './PatientPicker'

const RANGES = [
  { key: '12h', label: '12h' },
  { key: '24h', label: '24h' },
  { key: '48h', label: '48h' },
  { key: '7d', label: '7 dias' },
  { key: 'all', label: 'Tudo' }
]
const STATUS = [
  { key: 'pending', label: 'Pendente', icon: 'pending', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { key: 'overdue', label: 'Atrasada', icon: 'warning', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  { key: 'done', label: 'Tomada', icon: 'success', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  { key: 'skipped', label: 'Pulada', icon: 'skip', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' }
]
const TYPES = [
  { key: 'scheduled', label: 'Horário fixo', icon: 'scheduled', hint: 'Doses com horário marcado' },
  { key: 'sos', label: 'S.O.S', icon: 'sos', hint: 'Se necessário' }
]

export default function FilterBar({ filters, setFilters, patients }) {
  const [open, setOpen] = useState(false)

  const activeCount =
    (filters.status ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.patientId ? 1 : 0)

  const activeChips = []
  if (filters.patientId) {
    const p = patients?.find((x) => x.id === filters.patientId)
    if (p) activeChips.push({
      key: 'p',
      node: <>{p.avatar ? <span>{p.avatar}</span> : <Icon name="user" size={12} />} {p.name.split(' ')[0]}</>,
      clear: () => setFilters((f) => ({ ...f, patientId: null }))
    })
  }
  if (filters.status) {
    const s = STATUS.find((x) => x.key === filters.status)
    activeChips.push({
      key: 's',
      node: <><Icon name={s.icon} size={12} /> {s.label}</>,
      clear: () => setFilters((f) => ({ ...f, status: null }))
    })
  }
  if (filters.type) {
    const t = TYPES.find((x) => x.key === filters.type)
    activeChips.push({
      key: 't',
      node: <><Icon name={t.icon} size={12} /> {t.label}</>,
      clear: () => setFilters((f) => ({ ...f, type: null }))
    })
  }

  function clearAll() {
    setFilters((f) => ({ ...f, patientId: null, status: null, type: null }))
  }

  return (
    <div
      className="sticky z-30 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-100 dark:border-slate-800"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 78px)' }}
    >
      <div className="max-w-md mx-auto px-4 py-2.5 space-y-2">
        {/* Linha 1: segmented period + botão Filtros */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex p-1 rounded-full bg-slate-200/70 dark:bg-slate-800/70 overflow-x-auto no-scrollbar">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setFilters((f) => ({ ...f, range: r.key }))}
                className={`flex-1 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition
                  ${filters.range === r.key
                    ? 'bg-white dark:bg-slate-950 text-brand-700 dark:text-brand-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="relative shrink-0 w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm active:scale-95 transition"
            aria-label="Abrir filtros"
          >
            <Icon name="filter" size={16} className="text-slate-600 dark:text-slate-300" />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* Linha 2: chips ativos */}
        {activeChips.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            {activeChips.map((c) => (
              <button
                key={c.key}
                onClick={c.clear}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-200 text-xs font-medium active:scale-95"
              >
                {c.node}
                <Icon name="close" size={10} className="opacity-60" />
              </button>
            ))}
            <button
              onClick={clearAll}
              className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 ml-1 underline"
            >
              limpar
            </button>
          </div>
        )}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Filtros"
        footer={
          <div className="flex gap-2">
            <button onClick={clearAll} className="btn-secondary flex-1">Limpar</button>
            <button onClick={() => setOpen(false)} className="btn-primary flex-1">Aplicar</button>
          </div>
        }
      >
        <div className="space-y-5">
          {patients && patients.length > 0 && (
            <Section title="Paciente">
              <PatientPicker
                patients={patients}
                value={filters.patientId}
                onChange={(id) => setFilters((f) => ({ ...f, patientId: id }))}
                allowAll
                placeholder="Todos pacientes"
              />
            </Section>
          )}

          <Section title="Status">
            <div className="grid grid-cols-2 gap-2">
              {STATUS.map((s) => {
                const active = filters.status === s.key
                return (
                  <button
                    key={s.key}
                    onClick={() => setFilters((f) => {
                      const nextStatus = f.status === s.key ? null : s.key
                      return { ...f, status: nextStatus, range: nextStatus ? 'all' : f.range }
                    })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition
                      ${active
                        ? `${s.tone} ring-2 ring-brand-500`
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                  >
                    <Icon name={s.icon} size={18} />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Tipo">
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => {
                const active = filters.type === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setFilters((f) => ({ ...f, type: f.type === t.key ? null : t.key }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition
                      ${active
                        ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-200 ring-2 ring-brand-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                  >
                    <div className="flex flex-col items-start leading-tight">
                      <span className="flex items-center gap-1.5"><Icon name={t.icon} size={18} />{t.label}</span>
                      <span className="text-[10px] font-normal opacity-70">{t.hint}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>
        </div>
      </BottomSheet>

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { scrollbar-width: none; }`}</style>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{title}</p>
      {children}
    </div>
  )
}

function PickPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition
        ${active
          ? 'bg-brand-600 text-white shadow'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
    >
      {children}
    </button>
  )
}
