import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, Plus, X as XIcon, Pill, User, CalendarClock, CalendarRange, Sparkles, Infinity as InfinityIcon } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import AdBanner from '../components/AdBanner'
import ConfirmDialog from '../components/ConfirmDialog'
import { Sheet, Card, Button, Input, Chip, Toggle } from './../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { usePatients } from '../hooks/usePatients'
import { useCreateTreatment, useDeleteTreatment, useTreatment, useTemplates, useCreateTemplate, useUpdateTreatment } from '../hooks/useTreatments'
import { useToast } from '../hooks/useToast'
import { toDateInput, fromDateInput } from '../utils/dateUtils'
import MedNameInput from '../components/MedNameInput'
import PatientPicker from '../components/PatientPicker'
import { CONTINUOUS_DAYS, deleteTreatment } from '../services/treatmentsService'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import { useQueryClient, onlineManager } from '@tanstack/react-query'

// [horas, rótulo]
const INTERVALS = [
  [4,   '4h'],
  [6,   '6h'],
  [8,   '8h'],
  [12,  '12h'],
  [24,  '1x/dia'],
  [48,  '2 em 2 dias'],
  [72,  '3 em 3 dias'],
  [168, '1x/semana'],
  [336, 'quinzenal'],
  [720, '1x/mês'],
]

export default function TreatmentForm() {
  const { id } = useParams()
  const editing = !!id
  const [sp] = useSearchParams()
  const preselectPatient = sp.get('patientId')

  const { data: patients = [] } = usePatients()
  const { data: existing } = useTreatment(id)
  const { data: templates = [] } = useTemplates()
  const create = useCreateTreatment()
  const update = useUpdateTreatment()
  const createTpl = useCreateTemplate()
  const toast = useToast()
  const nav = useNavigate()
  const qc = useQueryClient()

  // Item #037 (release v0.2.0.4): erros inline por campo.
  const [errors, setErrors] = useState({})

  const [form, setForm] = useState({
    patientId: preselectPatient || '',
    medName: '', unit: '',
    mode: 'interval', // 'interval' | 'times'
    intervalHours: 8,
    dailyTimes: ['08:00'],
    durationDays: 7,
    isContinuous: false,
    // #162 v2 (v0.2.1.3) — duration UI granularity (días/semanas/meses).
    // Persiste durationDays internamente (single source of truth);
    // durationUnit + durationValue são UI-only state.
    // Auto-switch baseado em intervalHours (semanal → semanas, etc).
    durationUnit: 'days', // 'days' | 'weeks' | 'months'
    durationValue: 7,
    startAt: toDateInput(new Date().toISOString()),
    firstDoseTime: '08:00',
    saveAsTemplate: false,
    templateName: '',
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => {
    if (existing) {
      const mode = existing.intervalHours ? 'interval' : 'times'
      let dailyTimes = ['08:00']
      if (mode === 'times' && existing.firstDoseTime) {
        try { dailyTimes = JSON.parse(existing.firstDoseTime) } catch { dailyTimes = [existing.firstDoseTime] }
      }
      // #162 v2 — detecta best unit pra display existing durationDays.
      // Prioriza maior unit que divide perfeitamente (e.g. 28d → 4 semanas, não 28 dias).
      const days = existing.isContinuous ? CONTINUOUS_DAYS : existing.durationDays
      let unit = 'days'
      let value = days
      if (days > 0 && days % 30 === 0 && days >= 30) {
        unit = 'months'; value = days / 30
      } else if (days > 0 && days % 7 === 0 && days >= 7) {
        unit = 'weeks'; value = days / 7
      }
      setForm((f) => ({
        ...f,
        patientId: existing.patientId,
        medName: existing.medName,
        unit: existing.unit,
        mode,
        intervalHours: existing.intervalHours || 8,
        dailyTimes,
        durationDays: days,
        durationUnit: unit,
        durationValue: value,
        isContinuous: !!existing.isContinuous,
        startAt: toDateInput(existing.startDate),
        firstDoseTime: mode === 'interval' ? (existing.firstDoseTime || '08:00') : '08:00',
      }))
    }
  }, [existing])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  function addTime() { setForm((f) => ({ ...f, dailyTimes: [...f.dailyTimes, '12:00'] })) }
  function removeTime(i) { setForm((f) => ({ ...f, dailyTimes: f.dailyTimes.filter((_, idx) => idx !== i) })) }
  function setTime(i, v) { setForm((f) => ({ ...f, dailyTimes: f.dailyTimes.map((t, idx) => idx === i ? v : t) })) }

  // #162 v2 — duration unit conversion helpers
  const DURATION_MULTIPLIER = { days: 1, weeks: 7, months: 30 }

  // Update durationDays + durationValue mantendo durationUnit
  function setDurationValue(v) {
    setForm((f) => {
      const value = Number(v) || 0
      const days = value * DURATION_MULTIPLIER[f.durationUnit]
      return { ...f, durationValue: v, durationDays: days }
    })
    if (errors.durationDays) setErrors({ ...errors, durationDays: undefined })
  }

  // Trocar unit recalcula durationDays preservando intent user (ex: 4 semanas → 28 dias)
  function setDurationUnit(unit) {
    setForm((f) => {
      const days = (Number(f.durationValue) || 0) * DURATION_MULTIPLIER[unit]
      return { ...f, durationUnit: unit, durationDays: days }
    })
  }

  // Auto-switch unit baseado em intervalHours quando user muda interval (não em edit existing).
  useEffect(() => {
    if (existing) return // Não auto-switch em edit mode (preserva escolha original)
    if (form.mode !== 'interval') return
    const ih = Number(form.intervalHours)
    let newUnit
    if (ih === 720) newUnit = 'months'           // mensal
    else if (ih === 168 || ih === 336) newUnit = 'weeks' // semanal/quinzenal
    else newUnit = 'days'                        // 4h, 6h, 8h, 12h, 24h, 48h, 72h
    if (newUnit !== form.durationUnit) {
      setDurationUnit(newUnit)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.intervalHours, form.mode])

  async function submit(e) {
    e.preventDefault()
    // Item #037 (release v0.2.0.4): valida campos obrigatórios inline.
    const errs = {}
    if (!form.medName?.trim()) errs.medName = 'Medicamento obrigatório.'
    if (!form.unit?.trim()) errs.unit = 'Dose/unidade obrigatório.'
    if (!form.isContinuous && (!form.durationDays || Number(form.durationDays) < 1)) {
      errs.durationDays = 'Duração obrigatória (≥ 1 dia).'
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    if (!form.patientId) { toast.show({ message: 'Selecione um paciente.', kind: 'error' }); return }
    const payload = {
      patientId: form.patientId,
      medName: form.medName.trim(),
      unit: form.unit.trim(),
      durationDays: form.isContinuous ? CONTINUOUS_DAYS : Number(form.durationDays),
      isContinuous: form.isContinuous,
      startDate: fromDateInput(form.startAt),
      mode: form.mode,
      intervalHours: form.mode === 'interval' ? Number(form.intervalHours) : null,
      firstDoseTime: form.mode === 'interval'
        ? form.firstDoseTime
        : JSON.stringify(form.dailyTimes),
      dailyTimes: form.mode === 'times' ? form.dailyTimes : null,
    }
    // Item #204 v0.2.1.8 fix-A — offline-aware submit (create + edit paths).
    const isOffline = !onlineManager.isOnline()
    if (isOffline) {
      if (editing) {
        update.mutate({ id, patch: {
          medName: payload.medName, unit: payload.unit,
          intervalHours: payload.intervalHours, durationDays: payload.durationDays,
          isContinuous: payload.isContinuous,
          startDate: payload.startDate, firstDoseTime: payload.firstDoseTime,
        } })
        toast.show({ message: 'Alterações salvas offline — sincronizam ao reconectar.', kind: 'info' })
      } else {
        create.mutate(payload)
        // Template NÃO entra queue offline (useCreateTemplate fora mutationRegistry).
        // Aviso explícito ao user se ele marcou saveAsTemplate offline.
        if (form.saveAsTemplate && form.templateName.trim()) {
          toast.show({
            message: 'Tratamento salvo offline. Salvar como modelo requer internet — refaça online.',
            kind: 'warn', duration: 6000,
          })
        } else {
          toast.show({ message: 'Tratamento salvo offline — sincroniza ao reconectar.', kind: 'info' })
        }
      }
      nav('/')
      return
    }
    try {
      if (editing) {
        await update.mutateAsync({ id, patch: {
          medName: payload.medName, unit: payload.unit,
          intervalHours: payload.intervalHours, durationDays: payload.durationDays,
          isContinuous: payload.isContinuous,
          startDate: payload.startDate, firstDoseTime: payload.firstDoseTime,
        } })
        toast.show({ message: 'Tratamento atualizado.', kind: 'success' })
      } else {
        await create.mutateAsync(payload)
        if (form.saveAsTemplate && form.templateName.trim()) {
          await createTpl.mutateAsync({
            name: form.templateName.trim(), medName: payload.medName, unit: payload.unit,
            intervalHours: payload.intervalHours, durationDays: payload.durationDays,
          })
        }
        toast.show({ message: 'Tratamento criado.', kind: 'success' })
      }
      nav('/')
    } catch (err) {
      toast.show({ message: err.message || 'Erro ao salvar', kind: 'error' })
    }
  }

  // FASE 15 — undo 5s antes de DELETE real no servidor
  const undoableDelete = useUndoableDelete({
    mutationFn: deleteTreatment,
    onOptimistic: (delId) => {
      qc.setQueriesData({ queryKey: ['treatments'] }, (old) =>
        Array.isArray(old) ? old.filter((t) => t.id !== delId) : old,
      )
    },
    onRestore: () => {
      qc.invalidateQueries({ queryKey: ['treatments'] })
      qc.invalidateQueries({ queryKey: ['doses'] })
    },
    itemLabel: 'Tratamento',
  })

  function handleDelete() {
    undoableDelete(id)
    nav('/')
  }

  function applyTemplate(tpl) {
    setForm((f) => ({
      ...f, medName: tpl.medName, unit: tpl.unit,
      intervalHours: tpl.intervalHours || 8, durationDays: tpl.durationDays || 7,
    }))
    setShowTemplates(false)
  }

  const preview = useMemo(() => {
    const days = form.isContinuous ? CONTINUOUS_DAYS : Number(form.durationDays || 0)
    const suffix = form.isContinuous ? ` (primeiros ${CONTINUOUS_DAYS} dias gerados)` : ' no total'
    if (form.mode === 'interval') {
      const total = Math.floor((days * 24) / Number(form.intervalHours || 1))
      return `${total} doses${suffix}`
    }
    return `${form.dailyTimes.length * days} doses${suffix}`
  }, [form])

  // #162 (v0.2.1.3) — warning silent fail Mounjaro repro prevention.
  // Quando intervalHours/24 > durationDays (ex: semanal 168h + 4 dias),
  // só dispara 1 dose e auto-encerra. User não percebe = trust violation.
  // Detalhe: paciente lhenrique.pda 2026-05-06 cadastrou Mounjaro semanal
  // com durationDays=4 (literal) ao invés 28 (4 doses × 7d). effectiveStatus
  // auto-ended dia 03/05 — alerta encerrando silenciou cedo.
  const silentFailWarning = useMemo(() => {
    if (form.isContinuous || form.mode !== 'interval') return null
    const interval = Number(form.intervalHours || 0)
    const duration = Number(form.durationDays || 0)
    if (interval < 24 || duration <= 0) return null
    const intervalDays = interval / 24
    if (intervalDays <= duration) return null
    const dosesPossiveis = Math.floor((duration * 24) / interval)
    const sugerido = Math.ceil(intervalDays * 4) // sugere mínimo 4 doses
    return { intervalDays: Math.round(intervalDays), duration, dosesPossiveis, sugerido }
  }, [form.isContinuous, form.mode, form.intervalHours, form.durationDays])

  return (
    <motion.div
      style={{ paddingBottom: 110 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.inOut }}
    >
      <PageHeader
        title={editing ? 'Editar tratamento' : 'Novo tratamento'}
        back
        right={!editing && templates.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            aria-label="Carregar modelo"
            className="dosy-press"
            style={{
              width: 38, height: 38, borderRadius: 9999,
              background: 'var(--dosy-bg-elevated)',
              color: 'var(--dosy-fg)',
              boxShadow: 'var(--dosy-shadow-sm)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer',
            }}
          >
            <ClipboardList size={18} strokeWidth={1.75}/>
          </button>
        ) : null}
      />

      <form
        onSubmit={submit}
        className="max-w-md mx-auto px-4 pt-1"
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <AdBanner />

        {/* HERO sunset card — contexto + preview agregado */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: TIMING.base, ease: EASE.inOut }}
          style={{
            background: 'var(--dosy-gradient-sunset)',
            borderRadius: 24,
            padding: 18,
            color: 'var(--dosy-fg-on-sunset)',
            boxShadow: '0 12px 32px -8px rgba(255,107,91,0.35)',
            display: 'flex', alignItems: 'center', gap: 14,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: -30, right: -30, width: 140, height: 140,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}/>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'rgba(255,255,255,0.22)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Pill size={28} strokeWidth={2}/>
          </div>
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', opacity: 0.85,
              fontFamily: 'var(--dosy-font-display)',
            }}>{editing ? 'Editando' : 'Novo tratamento'}</div>
            <div style={{
              fontFamily: 'var(--dosy-font-display)',
              fontSize: 18, fontWeight: 800, marginTop: 2, lineHeight: 1.1,
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{form.medName || 'Sem nome'}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{preview}</div>
          </div>
        </motion.div>

        {/* STEP 1 — Paciente + Medicamento + Dose */}
        <SectionHeader number={1} icon={User} title="Quem e o quê" />
        <Card padding={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <FieldLabel required>Paciente</FieldLabel>
            <PatientPicker
              patients={patients}
              value={form.patientId || null}
              onChange={(id) => set('patientId', id || '')}
              placeholder="Selecione…"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <FieldLabel required>Medicamento</FieldLabel>
            <MedNameInput value={form.medName} onChange={(v) => { set('medName', v); if (errors.medName) setErrors({ ...errors, medName: undefined }) }} />
            {errors.medName && <FieldError>{errors.medName}</FieldError>}
          </div>

          <Input
            label="Dose / unidade"
            required
            value={form.unit}
            onChange={(e) => { set('unit', e.target.value); if (errors.unit) setErrors({ ...errors, unit: undefined }) }}
            placeholder="Ex: 1 comprimido, 15 gotas"
            error={errors.unit}
          />
        </Card>

        {/* STEP 2 — Agendamento */}
        <SectionHeader number={2} icon={CalendarClock} title="Quando tomar" />
        <Card padding={16}>
          <p style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--dosy-fg-secondary)',
            margin: '0 0 10px 0',
            fontFamily: 'var(--dosy-font-display)',
          }}>Modo</p>

          {/* Segmented mode picker — sunset quando active */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
            background: 'var(--dosy-bg-sunken)',
            padding: 4, borderRadius: 14, marginBottom: 14,
          }}>
            {[
              { id: 'interval', label: 'Intervalo fixo', hint: 'A cada X horas' },
              { id: 'times',    label: 'Horários',       hint: 'Dia: 8h, 14h, 20h' },
            ].map((opt) => {
              const active = form.mode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => set('mode', opt.id)}
                  className="dosy-press"
                  style={{
                    border: 'none', cursor: 'pointer',
                    padding: '10px 6px', borderRadius: 10,
                    background: active ? 'var(--dosy-gradient-sunset)' : 'transparent',
                    color: active ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-fg-secondary)',
                    boxShadow: active ? '0 4px 12px -2px rgba(255,107,91,0.35)' : 'none',
                    fontFamily: 'var(--dosy-font-display)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{opt.label}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 500, opacity: active ? 0.85 : 0.7 }}>{opt.hint}</span>
                </button>
              )
            })}
          </div>

          {form.mode === 'interval' ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--dosy-fg-secondary)',
                  margin: '0 0 8px 0',
                  fontFamily: 'var(--dosy-font-display)',
                }}>Frequência</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {INTERVALS.map(([h, label]) => (
                    <Chip
                      key={h}
                      size="sm"
                      active={Number(form.intervalHours) === h}
                      onClick={() => set('intervalHours', h)}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
              <Input
                label="Horário da 1ª dose"
                type="time"
                value={form.firstDoseTime}
                onChange={(e) => set('firstDoseTime', e.target.value)}
              />
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.dailyTimes.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => setTime(i, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '14px 18px',
                      borderRadius: 16,
                      background: 'var(--dosy-bg-elevated)',
                      boxShadow: 'var(--dosy-shadow-xs)',
                      border: '1.5px solid transparent',
                      fontSize: 15, color: 'var(--dosy-fg)',
                      outline: 'none',
                      fontFamily: 'var(--dosy-font-body)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                  {form.dailyTimes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTime(i)}
                      aria-label="Remover horário"
                      className="dosy-press"
                      style={{
                        width: 46, height: 46, borderRadius: 14,
                        background: 'var(--dosy-danger-bg)',
                        color: 'var(--dosy-danger)',
                        border: 'none', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <XIcon size={16} strokeWidth={2}/>
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                kind="secondary"
                full
                icon={Plus}
                onClick={addTime}
              >
                Adicionar horário
              </Button>
            </div>
          )}
        </Card>

        {/* STEP 3 — Duração */}
        <SectionHeader number={3} icon={CalendarRange} title="Por quanto tempo" />
        <Card padding={16}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: form.isContinuous ? 14 : 14,
            padding: form.isContinuous ? '10px 12px' : '0',
            background: form.isContinuous ? 'var(--dosy-gradient-sunset-muted)' : 'transparent',
            borderRadius: form.isContinuous ? 14 : 0,
            transition: 'all 200ms',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: form.isContinuous ? 'rgba(255,255,255,0.22)' : 'var(--dosy-peach-100)',
                color: form.isContinuous ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-primary)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <InfinityIcon size={18} strokeWidth={2.25}/>
              </div>
              <div>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: 'var(--dosy-fg)',
                  fontFamily: 'var(--dosy-font-display)',
                }}>Uso contínuo</div>
                <div style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 2 }}>
                  Sem data de fim
                </div>
              </div>
            </div>
            <Toggle
              value={form.isContinuous}
              onChange={(v) => set('isContinuous', v)}
              ariaLabel="Uso contínuo"
            />
          </div>

          {/* #162 v2 (v0.2.1.3) — toggle Dias/Semanas/Meses acima do input.
              Auto-switch baseado em intervalHours (semanal→Semanas, mensal→Meses).
              Internamente persiste durationDays (multiplier × value). */}
          {!form.isContinuous && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.04em', textTransform: 'uppercase',
                color: 'var(--dosy-fg-secondary)',
                fontFamily: 'var(--dosy-font-display)',
                marginBottom: 6,
              }}>Unidade da duração</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { unit: 'days', label: 'Dias' },
                  { unit: 'weeks', label: 'Semanas' },
                  { unit: 'months', label: 'Meses' },
                ].map(({ unit, label }) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setDurationUnit(unit)}
                    className="dosy-press"
                    style={{
                      flex: 1,
                      padding: '8px 12px', borderRadius: 9999,
                      fontSize: 13, fontWeight: 700,
                      fontFamily: 'var(--dosy-font-display)',
                      border: form.durationUnit === unit ? 'none' : '1px solid var(--dosy-border)',
                      background: form.durationUnit === unit
                        ? 'var(--dosy-gradient-sunset)'
                        : 'var(--dosy-bg-elevated)',
                      color: form.durationUnit === unit
                        ? 'var(--dosy-fg-on-sunset)'
                        : 'var(--dosy-fg)',
                      boxShadow: form.durationUnit === unit ? '0 4px 10px -2px rgba(255,107,91,0.35)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: form.isContinuous ? '1fr' : '1fr 1fr',
            gap: 10,
          }}>
            {!form.isContinuous && (
              <Input
                label={
                  form.durationUnit === 'weeks' ? 'Duração (semanas)'
                  : form.durationUnit === 'months' ? 'Duração (meses)'
                  : 'Duração (dias)'
                }
                type="number"
                inputMode="numeric"
                min={1}
                value={form.durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                error={errors.durationDays}
              />
            )}
            <Input
              label="Data de início"
              type="date"
              value={form.startAt}
              onChange={(e) => set('startAt', e.target.value)}
              hint="Hora vem do campo 'Horário da 1ª dose' acima. Pode ser data passada (doses anteriores aparecem como atrasadas)."
            />
          </div>
        </Card>

        {/* #162 (v0.2.1.3) Warning silent fail Mounjaro prevention */}
        {silentFailWarning && (
          <div role="alert" style={{
            background: 'var(--dosy-warning-bg)',
            border: '1px solid var(--dosy-warning)',
            borderRadius: 12, padding: 12,
            fontSize: 13.5, lineHeight: 1.5,
            color: 'var(--dosy-fg)',
            fontFamily: 'var(--dosy-font-body)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }} aria-hidden>⚠️</span>
              <div style={{ flex: 1 }}>
                <strong>Atenção:</strong> Com intervalo de <strong>{silentFailWarning.intervalDays} dia{silentFailWarning.intervalDays > 1 ? 's' : ''}</strong>{' '}
                e duração <strong>{silentFailWarning.duration} dia{silentFailWarning.duration > 1 ? 's' : ''}</strong>,
                {' '}apenas <strong>{silentFailWarning.dosesPossiveis} dose{silentFailWarning.dosesPossiveis !== 1 ? 's' : ''}</strong>{' '}
                {silentFailWarning.dosesPossiveis === 1 ? 'será agendada' : 'serão agendadas'}. O tratamento auto-encerra em {silentFailWarning.duration} dia{silentFailWarning.duration > 1 ? 's' : ''}.
                <div style={{ fontSize: 12.5, marginTop: 6, opacity: 0.85 }}>
                  Quer mais doses? Aumente <strong>"Duração"</strong> para pelo menos <strong>{silentFailWarning.sugerido} dias</strong> (4 doses), ou ative <strong>"Uso contínuo"</strong>.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview muted card */}
        <Card padding={14} muted style={{
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'rgba(255,255,255,0.15)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: 'var(--dosy-fg)',
          }}>
            <Sparkles size={18} strokeWidth={2}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
              fontFamily: 'var(--dosy-font-display)',
            }}>Resumo</div>
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--dosy-fg)',
              fontFamily: 'var(--dosy-font-display)', marginTop: 2,
            }}>{preview}</div>
          </div>
        </Card>

        {!editing && (
          <>
            <SectionHeader number={4} icon={ClipboardList} title="Salvar como modelo (opcional)" />
            <Card padding={16}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: form.saveAsTemplate ? 12 : 0,
              }}>
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: 'var(--dosy-fg)',
                    fontFamily: 'var(--dosy-font-display)',
                  }}>Salvar como modelo</div>
                  <div style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 2 }}>
                    Reutilizar config em tratamentos futuros
                  </div>
                </div>
                <Toggle
                  value={form.saveAsTemplate}
                  onChange={(v) => set('saveAsTemplate', v)}
                  ariaLabel="Salvar como modelo"
                />
              </div>
              {form.saveAsTemplate && (
                <Input
                  value={form.templateName}
                  onChange={(e) => set('templateName', e.target.value)}
                  placeholder="Nome do modelo (ex: Analgésico padrão)"
                />
              )}
            </Card>
          </>
        )}

        <Button
          type="submit"
          kind="primary"
          full
          size="lg"
          disabled={create.isPending || update.isPending}
        >
          {editing ? 'Salvar alterações' : 'Criar tratamento'}
        </Button>

        {editing && (
          <Button
            type="button"
            kind="danger"
            full
            onClick={() => setConfirmDelete(true)}
          >
            Excluir tratamento
          </Button>
        )}
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir tratamento?"
        message="Todas as doses associadas a este tratamento serão removidas."
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
      />

      <Sheet open={showTemplates} onClose={() => setShowTemplates(false)} title="Carregar modelo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="dosy-press"
              style={{
                width: '100%', textAlign: 'left',
                padding: 14,
                background: 'var(--dosy-bg-elevated)',
                borderRadius: 16,
                boxShadow: 'var(--dosy-shadow-xs)',
                border: 'none', cursor: 'pointer',
                fontFamily: 'var(--dosy-font-body)',
              }}
            >
              <div style={{
                fontWeight: 700, fontSize: 14, color: 'var(--dosy-fg)',
                fontFamily: 'var(--dosy-font-display)',
              }}>{tpl.name}</div>
              <div style={{
                fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 2,
              }}>{tpl.medName} · {tpl.unit} · {tpl.intervalHours}h</div>
            </button>
          ))}
        </div>
      </Sheet>
    </motion.div>
  )
}

// v0.2.3.5 #247 — helpers visuais: SectionHeader numerado + FieldLabel + FieldError
function SectionHeader({ number, icon: Icon, title }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '4px 4px 0',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 9999,
        background: 'var(--dosy-gradient-sunset)',
        color: 'var(--dosy-fg-on-sunset)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800,
        fontFamily: 'var(--dosy-font-display)',
        boxShadow: '0 4px 10px -2px rgba(255,107,91,0.35)',
        flexShrink: 0,
      }}>{number}</div>
      <Icon size={14} strokeWidth={2.25} style={{ color: 'var(--dosy-primary)', flexShrink: 0 }}/>
      <span style={{
        fontFamily: 'var(--dosy-font-display)',
        fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em',
        color: 'var(--dosy-fg)',
        textTransform: 'uppercase',
      }}>{title}</span>
    </div>
  )
}

function FieldLabel({ children, required }) {
  return (
    <label style={{
      fontSize: 11.5, fontWeight: 700, color: 'var(--dosy-fg-secondary)',
      letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: 4,
      fontFamily: 'var(--dosy-font-display)',
    }}>
      {children}
      {required && <span style={{ color: 'var(--dosy-danger)' }}> *</span>}
    </label>
  )
}

function FieldError({ children }) {
  return (
    <p style={{
      fontSize: 11.5, color: 'var(--dosy-danger)',
      margin: '2px 0 0 4px',
      fontFamily: 'var(--dosy-font-body)',
    }}>{children}</p>
  )
}
