import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, Plus, X as XIcon } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import AdBanner from '../components/AdBanner'
import ConfirmDialog from '../components/ConfirmDialog'
import { Sheet, Card, Button, Input, Chip, Toggle } from './../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { usePatients } from '../hooks/usePatients'
import { useCreateTreatment, useDeleteTreatment, useTreatment, useTemplates, useCreateTemplate, useUpdateTreatment } from '../hooks/useTreatments'
import { useToast } from '../hooks/useToast'
import { toDatetimeLocalInput, fromDatetimeLocalInput } from '../utils/dateUtils'
import MedNameInput from '../components/MedNameInput'
import PatientPicker from '../components/PatientPicker'
import { CONTINUOUS_DAYS, deleteTreatment } from '../services/treatmentsService'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import { useQueryClient } from '@tanstack/react-query'

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
    startAt: toDatetimeLocalInput(new Date().toISOString()),
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
      setForm((f) => ({
        ...f,
        patientId: existing.patientId,
        medName: existing.medName,
        unit: existing.unit,
        mode,
        intervalHours: existing.intervalHours || 8,
        dailyTimes,
        durationDays: existing.isContinuous ? CONTINUOUS_DAYS : existing.durationDays,
        isContinuous: !!existing.isContinuous,
        startAt: toDatetimeLocalInput(existing.startDate),
        firstDoseTime: mode === 'interval' ? (existing.firstDoseTime || '08:00') : '08:00',
      }))
    }
  }, [existing])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  function addTime() { setForm((f) => ({ ...f, dailyTimes: [...f.dailyTimes, '12:00'] })) }
  function removeTime(i) { setForm((f) => ({ ...f, dailyTimes: f.dailyTimes.filter((_, idx) => idx !== i) })) }
  function setTime(i, v) { setForm((f) => ({ ...f, dailyTimes: f.dailyTimes.map((t, idx) => idx === i ? v : t) })) }

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
    try {
      const payload = {
        patientId: form.patientId,
        medName: form.medName.trim(),
        unit: form.unit.trim(),
        durationDays: form.isContinuous ? CONTINUOUS_DAYS : Number(form.durationDays),
        isContinuous: form.isContinuous,
        startDate: fromDatetimeLocalInput(form.startAt),
        mode: form.mode,
        intervalHours: form.mode === 'interval' ? Number(form.intervalHours) : null,
        firstDoseTime: form.mode === 'interval'
          ? form.firstDoseTime
          : JSON.stringify(form.dailyTimes),
        dailyTimes: form.mode === 'times' ? form.dailyTimes : null,
      }
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

        {/* Paciente picker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{
            fontSize: 12, fontWeight: 600, color: 'var(--dosy-fg-secondary)',
            letterSpacing: '0.04em', textTransform: 'uppercase', paddingLeft: 4,
            fontFamily: 'var(--dosy-font-display)',
          }}>Paciente <span style={{ color: 'var(--dosy-danger)' }}>*</span></label>
          <PatientPicker
            patients={patients}
            value={form.patientId || null}
            onChange={(id) => set('patientId', id || '')}
            placeholder="Selecione…"
          />
        </div>

        {/* Medicamento (autocomplete custom) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{
            fontSize: 12, fontWeight: 600, color: 'var(--dosy-fg-secondary)',
            letterSpacing: '0.04em', textTransform: 'uppercase', paddingLeft: 4,
            fontFamily: 'var(--dosy-font-display)',
          }}>Medicamento <span style={{ color: 'var(--dosy-danger)' }}>*</span></label>
          <MedNameInput value={form.medName} onChange={(v) => { set('medName', v); if (errors.medName) setErrors({ ...errors, medName: undefined }) }} />
          {errors.medName && (
            <p style={{
              fontSize: 11.5, color: 'var(--dosy-danger)',
              margin: '2px 0 0 4px',
              fontFamily: 'var(--dosy-font-body)',
            }}>{errors.medName}</p>
          )}
        </div>

        <Input
          label="Dose / unidade"
          required
          value={form.unit}
          onChange={(e) => { set('unit', e.target.value); if (errors.unit) setErrors({ ...errors, unit: undefined }) }}
          placeholder="Ex: 1 comprimido, 15 gotas"
          error={errors.unit}
        />

        {/* Mode + frequency card */}
        <Card padding={16}>
          <p style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--dosy-fg-secondary)',
            margin: '0 0 12px 0',
            fontFamily: 'var(--dosy-font-display)',
          }}>Modo de agendamento</p>

          {/* Segmented mode picker */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
            background: 'var(--dosy-bg-sunken)',
            padding: 4, borderRadius: 14, marginBottom: 14,
          }}>
            {[
              { id: 'interval', label: 'Intervalo fixo' },
              { id: 'times',    label: 'Horários' },
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
                    background: active ? 'var(--dosy-bg)' : 'transparent',
                    color: active ? 'var(--dosy-fg)' : 'var(--dosy-fg-secondary)',
                    boxShadow: active ? 'var(--dosy-shadow-sm)' : 'none',
                    fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                    fontFamily: 'var(--dosy-font-display)',
                  }}
                >
                  {opt.label}
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

        {/* Duration / continuous + start */}
        <Card padding={16}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div>
              <div style={{
                fontSize: 14, fontWeight: 700, color: 'var(--dosy-fg)',
                fontFamily: 'var(--dosy-font-display)',
              }}>Uso contínuo ♾</div>
              <div style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 2 }}>
                Sem data de fim
              </div>
            </div>
            <Toggle
              value={form.isContinuous}
              onChange={(v) => set('isContinuous', v)}
              ariaLabel="Uso contínuo"
            />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: form.isContinuous ? '1fr' : '1fr 1fr',
            gap: 10,
          }}>
            {!form.isContinuous && (
              <Input
                label="Duração (dias)"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.durationDays}
                onChange={(e) => { set('durationDays', e.target.value); if (errors.durationDays) setErrors({ ...errors, durationDays: undefined }) }}
                error={errors.durationDays}
              />
            )}
            <Input
              label="Início"
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => set('startAt', e.target.value)}
            />
          </div>
        </Card>

        <p style={{
          fontSize: 12.5, color: 'var(--dosy-fg-secondary)',
          textAlign: 'center', margin: 0, fontFamily: 'var(--dosy-font-body)',
        }}>{preview}</p>

        {!editing && (
          <Card padding={16}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: form.saveAsTemplate ? 12 : 0,
            }}>
              <span style={{
                fontSize: 14, fontWeight: 600, color: 'var(--dosy-fg)',
              }}>Salvar como modelo</span>
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
