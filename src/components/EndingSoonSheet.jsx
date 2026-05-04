import { useNavigate } from 'react-router-dom'
import { Pill, ChevronRight } from 'lucide-react'
import { Sheet } from './dosy'
import PatientAvatar from './PatientAvatar'

/**
 * EndingSoonSheet — explica alerta "Tratamento acabando" + lista detalhes.
 *
 * Item #118-followup (release v0.2.0.3): user reportou que click no ícone Pill
 * amarelo do header navegava silenciosamente pra /pacientes sem explicar o
 * que era o alerta. Agora sheet abre primeiro mostrando lista de tratamentos
 * acabando ≤3 dias, com paciente + medicamento + dias restantes. Click numa
 * row leva pro detail do paciente.
 *
 * Props:
 *   open, onClose
 *   treatments: array filtrado (já passou pelo endingSoon filter no header)
 *   patients:   array completo (pra resolver patientId → nome/avatar)
 */
function daysUntilEnd(t) {
  const start = new Date(t.startDate).getTime()
  const end = start + t.durationDays * 86_400_000
  const ms = end - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

export default function EndingSoonSheet({ open, onClose, treatments = [], patients = [] }) {
  const nav = useNavigate()
  const byId = new Map(patients.map((p) => [p.id, p]))

  function goToPatient(patientId) {
    onClose()
    nav(`/pacientes/${patientId}`)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Tratamentos acabando">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{
          fontSize: 13, color: 'var(--dosy-fg-secondary)',
          lineHeight: 1.5, margin: 0,
        }}>
          {treatments.length === 1
            ? '1 tratamento finito termina nos próximos 3 dias. Considere renovar a receita ou encerrar.'
            : `${treatments.length} tratamentos finitos terminam nos próximos 3 dias. Considere renovar receitas ou encerrar.`}
        </p>

        {treatments.length === 0 ? (
          <p style={{
            fontSize: 12.5, color: 'var(--dosy-fg-tertiary)',
            margin: '8px 0', textAlign: 'center',
          }}>Nenhum tratamento acabando.</p>
        ) : (
          <ul style={{
            listStyle: 'none', padding: 0, margin: 0,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {treatments.map((t) => {
              const patient = byId.get(t.patientId)
              const days = daysUntilEnd(t)
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => patient && goToPatient(patient.id)}
                    className="dosy-press"
                    disabled={!patient}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: 12,
                      borderRadius: 14,
                      background: 'var(--dosy-bg-elevated)',
                      boxShadow: 'var(--dosy-shadow-xs)',
                      border: 'none',
                      cursor: patient ? 'pointer' : 'default',
                      textAlign: 'left',
                      fontFamily: 'var(--dosy-font-body)',
                    }}
                  >
                    {patient
                      ? <PatientAvatar patient={patient} size={40} color="peach"/>
                      : <div style={{
                          width: 40, height: 40, borderRadius: 9999,
                          background: 'var(--dosy-bg-sunken)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--dosy-fg-tertiary)',
                        }}><Pill size={18} strokeWidth={1.75}/></div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 14, fontWeight: 700, margin: 0,
                        color: 'var(--dosy-fg)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{t.medName || 'Medicamento'}</p>
                      <p style={{
                        fontSize: 12, color: 'var(--dosy-fg-secondary)',
                        margin: '2px 0 0 0',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {patient?.name || 'Paciente'} ·{' '}
                        <span style={{ color: '#C5841A', fontWeight: 700 }}>
                          {days === 0 ? 'termina hoje' : days === 1 ? 'termina amanhã' : `${days} dias`}
                        </span>
                      </p>
                    </div>
                    {patient && <ChevronRight size={16} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)' }}/>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
