import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Siren, Pill, ShieldAlert, AlertCircle, ChevronDown, Trash2, Plus } from 'lucide-react'
import { onlineManager } from '@tanstack/react-query'
import { TIMING, EASE } from '../animations'
import AdBanner from '../components/AdBanner'
import MedNameInput from '../components/MedNameInput'
import OfflineNotice from '../components/OfflineNotice'
import { Card, Button, Input, Avatar } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import PatientAvatar from '../components/PatientAvatar'
import { usePatients } from '../hooks/usePatients'
import { useDoses, useRegisterSos, useSosRules, useUpsertSosRule, useDeleteSosRule } from '../hooks/useDoses'
import { useOfflineGuard } from '../hooks/useOfflineGuard'
import { validateSos } from '../services/dosesService'
import { useToast } from '../hooks/useToast'
import { formatDateTime, fromDatetimeLocalInput, toDateInput } from '../utils/dateUtils'

// v0.2.3.5 #238 — SOS redesign: card-grid dinâmico inspirado em dashboard mobile premium.
// Mantém colors Dosy (peach/danger), adiciona hero card stat + chips pacientes scroll +
// grid 2-col medicamentos recentes (auto-fill) + form section visual cards.

export default function SOS() {
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState('')
  const [medName, setMedName] = useState('')
  const [unit, setUnit] = useState('')
  // v0.2.3.6 #261 fix: split datetime-local em date + time separados.
  // WebView Android usa locale OS (en-US emulator) ignorando lang="pt-BR".
  // Date type="date" + time type="time" renderizam consistentes pt-BR.
  const _initialNow = new Date()
  const [dateVal, setDateVal] = useState(toDateInput(_initialNow.toISOString()))
  const [timeVal, setTimeVal] = useState(`${String(_initialNow.getHours()).padStart(2,'0')}:${String(_initialNow.getMinutes()).padStart(2,'0')}`)
  const when = `${dateVal}T${timeVal}`
  const [observation, setObservation] = useState('')

  const { data: rules = [] } = useSosRules(patientId)
  const { data: history = [] } = useDoses({ patientId })
  const upsertRule = useUpsertSosRule()
  const deleteRule = useDeleteSosRule()
  const register = useRegisterSos()
  const toast = useToast()
  const guard = useOfflineGuard()

  const currentRule = useMemo(
    () => rules.find((r) => r.medName.toLowerCase() === medName.toLowerCase()),
    [rules, medName],
  )
  const [ruleMin, setRuleMin] = useState('')
  const [ruleMax, setRuleMax] = useState('')
  const [rulesExpanded, setRulesExpanded] = useState(false)
  // v0.2.3.6 fix — window.confirm em Capacitor WebView retorna false sem mostrar
  // dialog (bug Android Chromium WebView), travando submit silenciosamente.
  // Substituído por ConfirmDialog component.
  const [overLimitConfirm, setOverLimitConfirm] = useState(null) // { payload, reason, nextHint } | null

  // Stats hero card: SOS doses registradas últimas 24h pro paciente selecionado
  const sosStats = useMemo(() => {
    const now = Date.now()
    const past24h = now - 24 * 3600_000
    const sosDoses = history.filter((d) => d.type === 'sos')
    const last24h = sosDoses.filter((d) => new Date(d.scheduledAt).getTime() >= past24h)
    return {
      last24h: last24h.length,
      total: sosDoses.length,
      lastTaken: sosDoses[0]?.scheduledAt
    }
  }, [history])

  // Medicamentos recentes únicos (dose-by-dose history) pra autofill cards grid
  const recentMeds = useMemo(() => {
    const seen = new Map()
    for (const d of history) {
      const key = `${d.medName}::${d.unit}`
      if (!seen.has(key)) {
        seen.set(key, { medName: d.medName, unit: d.unit, count: 0, lastAt: d.scheduledAt })
      }
      seen.get(key).count += 1
    }
    return Array.from(seen.values()).sort((a, b) => b.count - a.count).slice(0, 4)
  }, [history])

  function pickRecentMed(med) {
    setMedName(med.medName)
    setUnit(med.unit)
  }

  async function saveRule() {
    if (!patientId || !medName) return
    if (!ruleMin && !ruleMax) {
      toast.show({ message: 'Preencha pelo menos um limite (intervalo mínimo ou máx/24h).', kind: 'error' })
      return
    }
    if (!guard.ensure('Salvar regra de segurança')) return
    try {
      await upsertRule.mutateAsync({
        id: currentRule?.id, patientId, medName: medName.trim(),
        minIntervalHours: ruleMin ? Number(ruleMin) : null,
        maxDosesIn24h: ruleMax ? Number(ruleMax) : null,
      })
      toast.show({ message: 'Limite de segurança salvo.', kind: 'success' })
      setRuleMin(''); setRuleMax('')
    } catch (e) {
      toast.show({ message: 'Erro ao salvar limite: ' + (e?.message || 'desconhecido'), kind: 'error' })
    }
  }

  async function removeRule(rule) {
    if (!guard.ensure('Remover limite')) return
    try {
      await deleteRule.mutateAsync({ id: rule.id, patientId })
      toast.show({ message: `Limite removido para ${rule.medName}.`, kind: 'success' })
    } catch (e) {
      toast.show({ message: 'Erro ao remover: ' + (e?.message || 'desconhecido'), kind: 'error' })
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!patientId || !medName || !unit) {
      toast.show({ message: 'Preencha paciente, medicamento e dose.', kind: 'error' }); return
    }
    const scheduledAt = fromDatetimeLocalInput(when)
    const v = validateSos({ rules, history, medName, scheduledAt })
    const payload = { patientId, medName: medName.trim(), unit: unit.trim(), scheduledAt, observation }
    // v0.2.3.5 #238 — app NÃO bloqueia, apenas ALERTA. User decide se prossegue.
    // v0.2.3.6 fix — usa ConfirmDialog (não window.confirm que bug em Capacitor webview).
    if (!v.ok) {
      const nextHint = v.nextAt ? `Próxima permitida: ${formatDateTime(v.nextAt)}` : ''
      setOverLimitConfirm({ payload, reason: v.reason, nextHint })
      return
    }
    await doSubmit(payload, false)
  }

  async function doSubmit(payload, overLimit) {
    const finalPayload = overLimit ? { ...payload, force: true } : payload
    if (overLimit) {
      toast.show({
        message: `Dose registrada acima do limite. ${overLimitConfirm?.reason || ''}`,
        kind: 'warning', duration: 6000,
      })
    }
    if (!onlineManager.isOnline()) {
      register.mutate(finalPayload)
      toast.show({ message: 'Dose S.O.S salva offline — sincroniza ao reconectar.', kind: 'info' })
    } else {
      try {
        await register.mutateAsync(finalPayload)
        toast.show({ message: 'Dose S.O.S registrada.', kind: 'success' })
      } catch (e) {
        toast.show({ message: 'Erro ao registrar: ' + (e?.message || 'desconhecido'), kind: 'error' })
        return
      }
    }
    setMedName(''); setUnit(''); setObservation('')
    const _now = new Date()
    setDateVal(toDateInput(_now.toISOString()))
    setTimeVal(`${String(_now.getHours()).padStart(2,'0')}:${String(_now.getMinutes()).padStart(2,'0')}`)
  }

  const selectedPatient = patients.find((p) => p.id === patientId)

  return (
    <motion.div
      style={{
        paddingBottom: 110,
        background: 'var(--dosy-bg)',
        minHeight: '100vh',
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.inOut }}
    >
      <PageHeader title="S.O.S" subtitle="Dose extra fora do agendado"/>

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AdBanner />
        <OfflineNotice featureLabel="Regras de segurança SOS" />

        {/* HERO CARD — gradient danger com siren + stat 24h */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: TIMING.base, ease: EASE.inOut }}
          style={{
            background: 'var(--dosy-gradient-sunset)',
            borderRadius: 24,
            padding: 20,
            color: 'white',
            boxShadow: '0 12px 32px -8px rgba(255, 107, 91, 0.45)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
                padding: '4px 10px', borderRadius: 999,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                marginBottom: 12,
              }}>
                <Siren size={12} strokeWidth={2.5} /> Dose emergencial
              </div>
              <h2 style={{
                margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2,
                fontFamily: 'var(--dosy-font-display)',
              }}>
                Registre uma dose<br/>fora do horário
              </h2>
            </div>
            <div style={{
              width: 64, height: 64, flexShrink: 0,
              background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
              borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldAlert size={32} strokeWidth={1.75} color="white" />
            </div>
          </div>

          {patientId && (
            <div style={{
              marginTop: 16, paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,0.25)',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Últimas 24h</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--dosy-font-display)' }}>{sosStats.last24h}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Total SOS</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--dosy-font-display)' }}>{sosStats.total}</div>
              </div>
            </div>
          )}
        </motion.div>

        {/* CHIPS PACIENTES — horizontal scroll */}
        {patients.length > 0 && (
          <div>
            <label style={{
              display: 'block', marginBottom: 8, paddingLeft: 4,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--dosy-fg-secondary)',
              fontFamily: 'var(--dosy-font-display)',
            }}>
              Paciente <span style={{ color: 'var(--dosy-danger)' }}>*</span>
            </label>
            <div style={{
              display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
              scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}>
              {patients.map((p) => {
                const active = p.id === patientId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPatientId(p.id)}
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px 8px 8px',
                      borderRadius: 999,
                      background: active ? 'var(--dosy-primary)' : 'var(--dosy-bg-elevated)',
                      color: active ? 'white' : 'var(--dosy-fg)',
                      border: active ? 'none' : '1.5px solid var(--dosy-border)',
                      fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 180ms',
                      boxShadow: active ? '0 4px 12px -2px rgba(255,107,91,0.4)' : 'var(--dosy-shadow-xs)',
                    }}
                  >
                    <PatientAvatar patient={p} size={28} />
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* GRID MEDICAMENTOS RECENTES — autofill rápido */}
        {patientId && recentMeds.length > 0 && (
          <div>
            <label style={{
              display: 'block', marginBottom: 8, paddingLeft: 4,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--dosy-fg-secondary)',
              fontFamily: 'var(--dosy-font-display)',
            }}>
              Medicamentos recentes
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {recentMeds.map((med) => {
                const active = medName === med.medName && unit === med.unit
                return (
                  <motion.button
                    key={`${med.medName}::${med.unit}`}
                    type="button"
                    onClick={() => pickRecentMed(med)}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      textAlign: 'left',
                      padding: 14,
                      borderRadius: 18,
                      background: active ? 'var(--dosy-primary)' : 'var(--dosy-bg-elevated)',
                      color: active ? 'white' : 'var(--dosy-fg)',
                      border: active ? 'none' : '1.5px solid var(--dosy-border)',
                      boxShadow: active ? '0 8px 20px -4px rgba(255,107,91,0.35)' : 'var(--dosy-shadow-xs)',
                      cursor: 'pointer',
                      transition: 'all 180ms',
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 12,
                      background: active ? 'rgba(255,255,255,0.22)' : 'var(--dosy-peach-100, #FEE0D6)',
                      color: active ? 'white' : 'var(--dosy-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Pill size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
                        {med.medName}
                      </div>
                      <div style={{ fontSize: 11, opacity: active ? 0.9 : 0.6 }}>
                        {med.unit} · {med.count}× usado
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>
        )}

        {/* FORM PRINCIPAL — visual cards */}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{
              fontSize: 11, fontWeight: 700, color: 'var(--dosy-fg-secondary)',
              letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 4,
              fontFamily: 'var(--dosy-font-display)',
            }}>
              Medicamento <span style={{ color: 'var(--dosy-danger)' }}>*</span>
            </label>
            <MedNameInput value={medName} onChange={setMedName} required/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input
              label="Dose"
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ex: 1 cp"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <Input
                label="Data"
                type="date"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
              />
              <Input
                label="Hora"
                type="time"
                value={timeVal}
                onChange={(e) => setTimeVal(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{
              fontSize: 11, fontWeight: 700, color: 'var(--dosy-fg-secondary)',
              letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 4,
              fontFamily: 'var(--dosy-font-display)',
            }}>
              Observação
            </label>
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

          {patientId && (
            <div style={{
              background: 'var(--dosy-bg-elevated)',
              borderRadius: 18,
              border: '1.5px solid var(--dosy-border)',
              boxShadow: 'var(--dosy-shadow-xs)',
              overflow: 'hidden',
            }}>
              {/* HEADER COLAPSADO — sempre visível */}
              <button
                type="button"
                onClick={() => setRulesExpanded(v => !v)}
                style={{
                  width: '100%', padding: 14,
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: 'var(--dosy-peach-100, #FEE0D6)',
                  color: 'var(--dosy-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <ShieldAlert size={18} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: 'var(--dosy-fg)',
                    fontFamily: 'var(--dosy-font-display)',
                  }}>
                    Limites de segurança {rules.length > 0 && <span style={{
                      fontSize: 11, fontWeight: 700,
                      background: 'var(--dosy-primary)', color: 'white',
                      padding: '2px 8px', borderRadius: 999, marginLeft: 6,
                    }}>{rules.length}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 2 }}>
                    {rules.length > 0
                      ? 'Alerta ao registrar dose acima do limite (você decide se prossegue)'
                      : 'Opcional — alerta quando você passar do intervalo seguro'}
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: rulesExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ color: 'var(--dosy-fg-secondary)', flexShrink: 0 }}
                >
                  <ChevronDown size={20} strokeWidth={2} />
                </motion.div>
              </button>

              {/* CONTEÚDO EXPANDIDO */}
              {rulesExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  style={{ padding: '0 14px 14px 14px', borderTop: '1px solid var(--dosy-border)' }}
                >
                  {/* LISTA REGRAS EXISTENTES */}
                  {rules.length > 0 && (
                    <div style={{ marginTop: 12, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--dosy-fg-secondary)', marginBottom: 2,
                      }}>
                        Limites atuais
                      </div>
                      {rules.map((r) => (
                        <div key={r.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px',
                          background: 'var(--dosy-bg)',
                          borderRadius: 12,
                        }}>
                          <Pill size={16} strokeWidth={2} style={{ color: 'var(--dosy-primary)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dosy-fg)' }}>{r.medName}</div>
                            <div style={{ fontSize: 11, color: 'var(--dosy-fg-secondary)', marginTop: 1 }}>
                              {r.minIntervalHours ? `mín. ${r.minIntervalHours}h entre doses` : ''}
                              {r.minIntervalHours && r.maxDosesIn24h ? ' · ' : ''}
                              {r.maxDosesIn24h ? `máx. ${r.maxDosesIn24h}/dia` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRule(r)}
                            disabled={deleteRule.isPending}
                            style={{
                              padding: 8, borderRadius: 10,
                              background: 'transparent', border: 'none',
                              color: 'var(--dosy-danger)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            aria-label={`Remover limite ${r.medName}`}
                          >
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* FORM ADICIONAR/ATUALIZAR */}
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'var(--dosy-fg-secondary)', marginBottom: 8, marginTop: rules.length > 0 ? 4 : 12,
                  }}>
                    {currentRule ? `Atualizar "${medName}"` : medName ? `Novo limite para "${medName}"` : 'Selecione um medicamento acima'}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--dosy-fg-secondary)', marginBottom: 10,
                    background: 'var(--dosy-bg)', padding: 10, borderRadius: 10,
                  }}>
                    Ex: Dipirona — <strong>mín. 6h</strong> entre doses + <strong>máx. 4/dia</strong>. Se tentar registrar SOS antes do intervalo, app alerta — você decide se prossegue.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <Input
                      placeholder="Intervalo mín. (horas)"
                      value={ruleMin}
                      onChange={(e) => setRuleMin(e.target.value)}
                      type="number"
                      inputMode="decimal"
                      min={0}
                    />
                    <Input
                      placeholder="Máximo por dia"
                      value={ruleMax}
                      onChange={(e) => setRuleMax(e.target.value)}
                      type="number"
                      inputMode="numeric"
                      min={0}
                    />
                  </div>
                  <Button
                    type="button"
                    kind="secondary"
                    full
                    onClick={saveRule}
                    disabled={!medName || upsertRule.isPending || (!ruleMin && !ruleMax)}
                    icon={currentRule ? undefined : Plus}
                  >
                    {currentRule ? 'Atualizar limite' : 'Adicionar limite'}
                  </Button>
                </motion.div>
              )}
            </div>
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
      </div>

      <ConfirmDialog
        open={!!overLimitConfirm}
        title="⚠️ Limite de segurança atingido"
        message={
          overLimitConfirm
            ? `${overLimitConfirm.reason}${overLimitConfirm.nextHint ? '\n\n' + overLimitConfirm.nextHint : ''}\n\nDeseja registrar mesmo assim?`
            : ''
        }
        confirmLabel="Registrar mesmo assim"
        cancelLabel="Cancelar"
        danger
        onConfirm={async () => {
          const payload = overLimitConfirm?.payload
          setOverLimitConfirm(null)
          if (payload) await doSubmit(payload, true)
        }}
        onClose={() => {
          // ConfirmDialog dispara onConfirm() + onClose() no confirm path.
          // Sem toast aqui: user que clicou Cancelar sabe que cancelou.
          setOverLimitConfirm(null)
        }}
      />
    </motion.div>
  )
}
