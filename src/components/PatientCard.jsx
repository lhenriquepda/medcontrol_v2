import { Link } from 'react-router-dom'

export default function PatientCard({ patient, children }) {
  return (
    <Link to={`/pacientes/${patient.id}`} className="card p-4 flex items-center gap-3 active:scale-[0.99] transition">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl overflow-hidden">
        {patient.photo_url
          ? <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
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
