import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Siren } from 'lucide-react'
import { onlineManager } from '@tanstack/react-query'
import { TIMING, EASE } from '../animations'
import AdBanner from '../components/AdBanner'
import PatientPicker from '../components/PatientPicker'
import MedNameInput from '../components/MedNameInput'
import OfflineNotice from '../components/OfflineNotice'
import { Card, Button, Input } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { usePatients } from '../hooks/usePatients'
import { useDoses, useRegisterSos, useSosRules, useUpsertSosRule } from '../hooks/useDoses'
import { useOfflineGuard } from '../hooks/useOfflineGuard'
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
  const guard = useOfflineGuard()

  const currentRule = useMemo(
    () => rules.find((r) => r.medName.toLowerCase() === medName.toLowerCase()),
    [rules, medName],
  )
  const [ruleMin, setRuleMin] = useState('')
  const [ruleMax, setRuleMax] = useState('')

  async function saveRule() {
    if (!patientId || !medName) return
    // Item #204 v0.2.1.8 — SOS rules NÃO entram queue offline. Bloqueio claro.
    if (!guard.ensure('Salvar regra de segurança')) return
    await upsertRule.mutateAsync({
      id: currentRule?.id, patientId, medName: medName.trim(),
      minIntervalHours: ruleMin ? Number(ruleMin) : null,
      maxDosesIn24h: ruleMax ? Number(ruleMax) : null,
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
        kind: 'error', duration: 7000,
      })
      return
    }
    // Item #204 v0.2.1.8 — registerSos ESTÁ na queue offline (optimistic dose
    // local). Offline: mutate fire-and-forget + toast claro "Salvo offline".
    const payload = { patientId, medName: medName.trim(), unit: unit.trim(), scheduledAt, observation }
    if (!onlineManager.isOnline()) {
      register.mutate(payload)
      toast.show({ message: 'Dose S.O.S salva offline — sincroniza ao reconectar.', kind: 'info' })
    } else {
      await register.mutateAsync(payload)
      toast.show({ message: 'Dose S.O.S registrada.', kind: 'success' })
    }
    setMedName(''); setUnit(''); setObservation(''); setWhen(toDatetimeLocalInput(new Date().toISOString()))
  }

  return (
    <motion.div
      style={{
        paddingBottom: 110,
        background: 'var(--dosy-danger-bg)',
        minHeight: '100vh',
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.inOut }}
    >
      <PageHeader title="S.O.S" subtitle="Dose extra fora do agendado"/>

      <form
        onSubmit={submit}
        className="max-w-md mx-auto px-4 pt-1"
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <AdBanner />
        <OfflineNotice featureLabel="Regras de segurança SOS" />


        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{
            fontSize: 12, fontWeight: 600, color: 'var(--dosy-fg-secondary)',
            letterSpacing: '0.04em', textTransform: 'uppercase', paddingLeft: 4,
            fontFamily: 'var(--dosy-font-display)',
          }}>Paciente <span style={{ color: 'var(--dosy-danger)' }}>*</span></label>
          <PatientPicker
            patients={patients}
            value={patientId}
            onChange={setPatientId}
            placeholder="Selecione paciente"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{
            fontSize: 12, fontWeight: 600, color: 'var(--dosy-fg-secondary)',
            letterSpacing: '0.04em', textTransform: 'uppercase', paddingLeft: 4,
            fontFamily: 'var(--dosy-font-display)',
          }}>Medicamento <span style={{ color: 'var(--dosy-danger)' }}>*</span></label>
          <MedNameInput value={medName} onChange={setMedName} required/>
        </div>

        <Input
          label="Dose"
          required
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Ex: 1 comprimido"
        />
        <Input
          label="Horário"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{
            fontSize: 12, fontWeight: 600, color: 'var(--dosy-fg-secondary)',
            letterSpacing: '0.04em', textTransform: 'uppercase', paddingLeft: 4,
            fontFamily: 'var(--dosy-font-display)',
          }}>Observação</label>
          <textarea
            rows={2}
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex: Dor de cabeça forte"
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: 16,
              background: 'var(--dosy-bg-elevated)',
              boxShadow: 'var(--dosy-shadow-xs)',
              border: '1.5px solid transparent',
              fontSize: 15, color: 'var(--dosy-fg)',
              outline: 'none',
              fontFamily: 'var(--dosy-font-body)',
              resize: 'vertical',
            }}
          />
        </div>

        {patientId && medName && (
          <Card padding={16}>
            <p style={{
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--dosy-fg-secondary)',
              margin: '0 0 8px 0',
              fontFamily: 'var(--dosy-font-display)',
            }}>Regras de segurança para "{medName}"</p>
            {currentRule ? (
              <div style={{ fontSize: 12.5, color: 'var(--dosy-fg-secondary)', marginBottom: 12 }}>
                {currentRule.minIntervalHours ? `Intervalo mínimo: ${currentRule.minIntervalHours}h · ` : ''}
                {currentRule.maxDosesIn24h ? `Máx: ${currentRule.maxDosesIn24h}/24h` : ''}
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: 'var(--dosy-fg-secondary)', marginBottom: 12, margin: '0 0 12px 0' }}>
                Nenhuma regra definida.
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <Input
                placeholder="Intervalo mín. (h)"
                value={ruleMin}
                onChange={(e) => setRuleMin(e.target.value)}
                type="number"
                inputMode="decimal"
                min={0}
              />
              <Input
                placeholder="Máx/24h"
                value={ruleMax}
                onChange={(e) => setRuleMax(e.target.value)}
                type="number"
                inputMode="numeric"
                min={0}
              />
            </div>
            <Button type="button" kind="secondary" full onClick={saveRule}>
              {currentRule ? 'Atualizar regra' : 'Salvar regra'}
            </Button>
          </Card>
        )}

        <Button
          type="submit"
          kind="danger-solid"
          full
          size="lg"
          icon={Siren}
          disabled={register.isPending}
        >
          Registrar S.O.S
        </Button>
      </form>
    </motion.div>
  )
}
