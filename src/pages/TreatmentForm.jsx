import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import ConfirmDialog from '../components/ConfirmDialog'
import BottomSheet from '../components/BottomSheet'
import { usePatients } from '../hooks/usePatients'
import { useCreateTreatment, useDeleteTreatment, useTreatment, useTemplates, useCreateTemplate, useUpdateTreatment } from '../hooks/useTreatments'
import { useToast } from '../hooks/useToast'
import { toDatetimeLocalInput, fromDatetimeLocalInput, pad } from '../utils/dateUtils'
import Field from '../components/Field'
import MedNameInput from '../components/MedNameInput'

const INTERVALS = [4, 6, 8, 12, 24]

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
  const del = useDeleteTreatment()
  const createTpl = useCreateTemplate()
  const toast = useToast()
  const nav = useNavigate()

  const [form, setForm] = useState({
    patientId: preselectPatient || '',
    medName: '', unit: '',
    mode: 'interval', // 'interval' | 'times'
    intervalHours: 8,
    dailyTimes: ['08:00'],
    durationDays: 7,
    startAt: toDatetimeLocalInput(new Date().toISOString()),
    firstDoseTime: '08:00',
    saveAsTemplate: false,
    templateName: ''
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => {
    if (existing) {
      // Detect mode: if intervalHours is set → 'interval', otherwise → 'times'
      const mode = existing.intervalHours ? 'interval' : 'times'
      // Try to recover dailyTimes from firstDoseTime field if stored as JSON, else fallback
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
        durationDays: existing.durationDays,
        startAt: toDatetimeLocalInput(existing.startDate),
        firstDoseTime: mode === 'interval' ? (existing.firstDoseTime || '08:00') : '08:00'
      }))
    }
  }, [existing])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  function addTime() { setForm((f) => ({ ...f, dailyTimes: [...f.dailyTimes, '12:00'] })) }
  function removeTime(i) { setForm((f) => ({ ...f, dailyTimes: f.dailyTimes.filter((_, idx) => idx !== i) })) }
  function setTime(i, v) { setForm((f) => ({ ...f, dailyTimes: f.dailyTimes.map((t, idx) => idx === i ? v : t) })) }

  async function submit(e) {
    e.preventDefault()
    if (!form.patientId) { toast.show({ message: 'Selecione um paciente.', kind: 'error' }); return }
    try {
      const payload = {
        patientId: form.patientId,
        medName: form.medName.trim(),
        unit: form.unit.trim(),
        durationDays: Number(form.durationDays),
        startDate: fromDatetimeLocalInput(form.startAt),
        mode: form.mode,
        intervalHours: form.mode === 'interval' ? Number(form.intervalHours) : null,
        // store dailyTimes as JSON inside firstDoseTime so it can be restored on edit
        firstDoseTime: form.mode === 'interval'
          ? form.firstDoseTime
          : JSON.stringify(form.dailyTimes),
        dailyTimes: form.mode === 'times' ? form.dailyTimes : null
      }
      if (editing) {
        await update.mutateAsync({ id, patch: {
          medName: payload.medName, unit: payload.unit,
          intervalHours: payload.intervalHours, durationDays: payload.durationDays,
          startDate: payload.startDate, firstDoseTime: payload.firstDoseTime
        }})
        toast.show({ message: 'Tratamento atualizado.', kind: 'success' })
      } else {
        await create.mutateAsync(payload)
        if (form.saveAsTemplate && form.templateName.trim()) {
          await createTpl.mutateAsync({
            name: form.templateName.trim(), medName: payload.medName, unit: payload.unit,
            intervalHours: payload.intervalHours, durationDays: payload.durationDays
          })
        }
        toast.show({ message: 'Tratamento criado.', kind: 'success' })
      }
      nav('/')
    } catch (err) {
      toast.show({ message: err.message || 'Erro ao salvar', kind: 'error' })
    }
  }

  async function handleDelete() {
    await del.mutateAsync(id)
    toast.show({ message: 'Tratamento excluído.', kind: 'info' })
    nav('/')
  }

  function applyTemplate(tpl) {
    setForm((f) => ({
      ...f, medName: tpl.medName, unit: tpl.unit,
      intervalHours: tpl.intervalHours || 8, durationDays: tpl.durationDays || 7
    }))
    setShowTemplates(false)
  }

  const preview = useMemo(() => {
    if (form.mode === 'interval') {
      const total = Math.floor((Number(form.durationDays) * 24) / Number(form.intervalHours || 1))
      return `${total} doses no total`
    }
    return `${form.dailyTimes.length * Number(form.durationDays || 0)} doses no total`
  }, [form])

  return (
    <div className="pb-28">
      <Header back title={editing ? 'Editar tratamento' : 'Novo tratamento'}
              right={!editing && templates.length > 0 && (
                <button onClick={() => setShowTemplates(true)} className="btn-ghost h-9 px-3 text-sm">📋</button>
              )} />
      <form onSubmit={submit} className="max-w-md mx-auto px-4 pt-3 space-y-4">
        <Field label="Paciente *">
          <select required className="input" value={form.patientId} onChange={(e) => set('patientId', e.target.value)} disabled={editing}>
            <option value="">Selecione…</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <label className="block">
          <span className="block text-xs font-medium mb-1">Medicamento *</span>
          <MedNameInput value={form.medName} onChange={(v) => set('medName', v)} />
        </label>
        <Field label="Dose / unidade *">
          <input required className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="Ex: 1 comprimido, 15 gotas" />
        </Field>

        <div className="card p-4 space-y-3">
          <p className="text-xs font-medium">Modo de agendamento</p>
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button type="button" onClick={() => set('mode', 'interval')}
                    className={`flex-1 py-2 text-sm rounded-lg ${form.mode === 'interval' ? 'bg-white dark:bg-slate-900 shadow font-medium' : 'text-slate-500'}`}>Intervalo fixo</button>
            <button type="button" onClick={() => set('mode', 'times')}
                    className={`flex-1 py-2 text-sm rounded-lg ${form.mode === 'times' ? 'bg-white dark:bg-slate-900 shadow font-medium' : 'text-slate-500'}`}>Horários</button>
          </div>

          {form.mode === 'interval' ? (
            <>
              <div>
                <p className="text-xs font-medium mb-1">A cada</p>
                <div className="flex gap-2 flex-wrap">
                  {INTERVALS.map((h) => (
                    <button key={h} type="button" onClick={() => set('intervalHours', h)}
                            className={`chip ${Number(form.intervalHours) === h ? 'chip-active' : ''}`}>{h}h</button>
                  ))}
                </div>
              </div>
              <Field label="Horário da 1ª dose">
                <input type="time" className="input" value={form.firstDoseTime} onChange={(e) => set('firstDoseTime', e.target.value)} />
              </Field>
            </>
          ) : (
            <div className="space-y-2">
              {form.dailyTimes.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <input type="time" className="input" value={t} onChange={(e) => setTime(i, e.target.value)} />
                  {form.dailyTimes.length > 1 && (
                    <button type="button" className="btn-secondary px-3" onClick={() => removeTime(i)}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn-secondary w-full" onClick={addTime}>+ Adicionar horário</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Duração (dias)">
            <input type="number" min={1} className="input" value={form.durationDays} onChange={(e) => set('durationDays', e.target.value)} />
          </Field>
          <Field label="Início">
            <input type="datetime-local" className="input" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
          </Field>
        </div>

        <p className="text-xs text-slate-500">{preview}</p>

        {!editing && (
          <div className="card p-4 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="w-4 h-4 accent-brand-600"
                     checked={form.saveAsTemplate} onChange={(e) => set('saveAsTemplate', e.target.checked)} />
              Salvar como modelo
            </label>
            {form.saveAsTemplate && (
              <input className="input" placeholder="Nome do modelo (ex: Analgésico padrão)"
                     value={form.templateName} onChange={(e) => set('templateName', e.target.value)} />
            )}
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={create.isPending || update.isPending}>
          {editing ? 'Salvar alterações' : 'Criar tratamento'}
        </button>

        {editing && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="btn-danger w-full">
            Excluir tratamento
          </button>
        )}
      </form>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)}
                     title="Excluir tratamento?"
                     message="Todas as doses associadas a este tratamento serão removidas."
                     confirmLabel="Excluir" danger onConfirm={handleDelete} />

      <BottomSheet open={showTemplates} onClose={() => setShowTemplates(false)} title="Carregar modelo">
        <div className="space-y-2">
          {templates.map((tpl) => (
            <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                    className="w-full text-left card p-3">
              <p className="font-medium">{tpl.name}</p>
              <p className="text-xs text-slate-500">{tpl.medName} · {tpl.unit} · {tpl.intervalHours}h</p>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}

