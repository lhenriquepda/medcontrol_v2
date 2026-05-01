import { memo } from 'react'
import { Link } from 'react-router-dom'

// Aud 4.5.5 G5 — memo pra evitar re-render quando props não mudaram (lista 10+ patients).
// Aud 4.5.5 G6 — img loading="lazy" pra avatares.
function PatientCard({ patient, children }) {
  return (
    <Link to={`/pacientes/${patient.id}`} className="card p-4 flex items-center gap-3 active:scale-[0.97] active:opacity-90 transition">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl overflow-hidden">
        {patient.photo_url
          ? <img src={patient.photo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <span>{patient.avatar || '👤'}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{patient.name}</p>
        <p className="text-xs text-slate-500 truncate">
          {patient.age ? `${patient.age} anos` : 'Idade não informada'}
          {patient.condition ? ` · ${patient.condition}` : ''}
        </p>
      </div>
      {children}
    </Link>
  )
}

export default memo(PatientCard)
