import { NavLink, useNavigate } from 'react-router-dom'
import { usePatients } from '../hooks/usePatients'

const tabs = [
  { to: '/', label: 'Início', icon: '🏠', end: true },
  { to: '/pacientes', label: 'Pacientes', icon: '👥' },
  { to: '__fab__', label: 'Novo', icon: '＋' },
  { to: '/sos', label: 'S.O.S', icon: '🆘' },
  { to: '/mais', label: 'Mais', icon: '⋯' }
]

export default function BottomNav() {
  const nav = useNavigate()
  const { data: patients = [] } = usePatients()
  const fabTarget = patients.length === 0 ? '/pacientes/novo' : '/tratamento/novo'
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-200 dark:border-slate-800 safe-bottom">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {tabs.map((t) => {
          if (t.to === '__fab__') {
            return (
              <button key="fab" onClick={() => nav(fabTarget)} className="flex justify-center">
                <span className="-mt-6 w-14 h-14 rounded-full bg-brand-600 text-white text-3xl flex items-center justify-center shadow-lg active:scale-95">
                  {t.icon}
                </span>
              </button>
            )
          }
          return (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                  isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
                }`
              }>
              <span className="text-xl leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
