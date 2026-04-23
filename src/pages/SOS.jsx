import { useMemo, useState } from 'react'
import Header from '../components/Header'
import { usePatients } from '../hooks/usePatients'
import { useDoses, useRegisterSos, useSosRules, useUpsertSosRule } from '../hooks/useDoses'
import { validateSos } from '../services/dosesService'
import { useToast } from '../hooks/useToast'
import { formatDateTime, fromDatetimeLocalInput, toDatetimeLocalInput } from '../utils/dateUtils'

export default function SOS() {
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState('')
  const [medName, setMedName] = useState('')
  const [unit, setUnit] = useState('')
  const [when, setWhen] = useState(toDatetimeLocalInput(new Date().toISOString()))
  const [observation, setObservation] = useState('')

  const { data: rules = [] } = useSosRules(patientId)
  const { data: history = [] } = useDoses({ patientId })
  const upsertRule = useUpsertSosRule()
  const register = useRegisterSos()
  const toast = useToast()

  const currentRule = useMemo(() => rules.find((r) => r.medName.toLowerCase() === medName.toLowerCase()), [rules, medName])
  const [ruleMin, setRuleMin] = useState('')
  const [ruleMax, setRuleMax] = useState('')

  async function saveRule() {
    if (!patientId || !medName) return
    await upsertRule.mutateAsync({
      id: currentRule?.id, patientId, medName: medName.trim(),
      minIntervalHours: ruleMin ? Number(ruleMin) : null,
      maxDosesIn24h: ruleMax ? Number(ruleMax) : null
    })
    toast.show({ message: 'Regra de segurança salva.', kind: 'success' })
    setRuleMin(''); setRuleMax('')
  }

  async function submit(e) {
    e.preventDefault()
    if (!patientId || !medName || !unit) {
      toast.show({ message: 'Preencha paciente, medicamento e dose.', kind: 'error' }); return
    }
    const scheduledAt = fromDatetimeLocalInput(when)
    const v = validateSos({ rules, history, medName, scheduledAt })
    if (!v.ok) {
      toast.show({
        message: `${v.reason}${v.nextAt ? ' Próxima permitida: ' + formatDateTime(v.nextAt) : ''}`,
        kind: 'error', duration: 7000
      })
      return
    }
    await register.mutateAsync({ patientId, medName: medName.trim(), unit: unit.trim(), scheduledAt, observation })
    toast.show({ message: 'Dose S.O.S registrada.', kind: 'success' })
    setMedName(''); setUnit(''); setObservation(''); setWhen(toDatetimeLocalInput(new Date().toISOString()))
  }

  return (
    <div className="pb-28 bg-rose-50/60 dark:bg-rose-950/30 min-h-screen">
      <Header title="S.O.S" subtitle="Dose extra fora do agendado" />
      <form onSubmit={submit} className="max-w-md mx-auto px-4 pt-3 space-y-4">
        <div>
          <p className="text-xs font-medium mb-1">Paciente *</p>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
            {patients.map((p) => (
              <button type="button" key={p.id} onClick={() => setPatientId(p.id)}
                      className={`chip whitespace-nowrap ${patientId === p.id ? 'chip-active' : ''}`}>
                <span>{p.avatar || '👤'}</span> {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <Field label="Medicamento *">
          <input required className="input" value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="Ex: Dipirona" />
        </Field>
        <Field label="Dose *">
          <input required className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Ex: 1 comprimido" />
        </Field>
        <Field label="Horário">
          <input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label="Observação">
          <textarea className="input" rows={2} value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Ex: Dor de cabeça forte" />
        </Field>

        {patientId && medName && (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-medium">Regras de segurança para “{medName}”</p>
            {currentRule ? (
              <div className="text-xs text-slate-500">
                {currentRule.minIntervalHours ? `Intervalo mínimo: ${currentRule.minIntervalHours}h · ` : ''}
                {currentRule.maxDosesIn24h ? `Máx: ${currentRule.maxDosesIn24h}/24h` : ''}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Nenhuma regra definida.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Intervalo mín. (h)" value={ruleMin}
                     onChange={(e) => setRuleMin(e.target.value)} type="number" min={0} />
              <input className="input" placeholder="Máx/24h" value={ruleMax}
                     onChange={(e) => setRuleMax(e.target.value)} type="number" min={0} />
            </div>
            <button type="button" onClick={saveRule} className="btn-secondary w-full text-sm">
              {currentRule ? 'Atualizar regra' : 'Salvar regra'}
            </button>
          </div>
        )}

        <button type="submit" className="btn-danger w-full" disabled={register.isPending}>
          🆘 Registrar S.O.S
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1">{label}</span>
      {children}
    </label>
  )
}
