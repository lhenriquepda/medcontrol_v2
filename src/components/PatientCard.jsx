import { memo } from 'react'
import { Link } from 'react-router-dom'
import PatientAvatar from './PatientAvatar'

// Aud 4.5.5 G5 — memo pra evitar re-render quando props não mudaram (lista 10+ patients).
// Aud 4.5.5 G6 — img loading="lazy" pra avatares (delegado ao PatientAvatar).
function PatientCard({ patient, children }) {
  return (
    <Link to={`/pacientes/${patient.id}`} className="card p-4 flex items-center gap-3 active:scale-[0.97] active:opacity-90 transition">
      <PatientAvatar patient={patient} size={48}/>
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
