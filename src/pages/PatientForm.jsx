import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import ConfirmDialog from '../components/ConfirmDialog'
import PaywallModal from '../components/PaywallModal'
import AdBanner from '../components/AdBanner'
import { usePatient, useCreatePatient, useUpdatePatient, useDeletePatient } from '../hooks/usePatients'
import { usePatientLimitReached, FREE_PATIENT_LIMIT } from '../hooks/useSubscription'
import { useToast } from '../hooks/useToast'

const AVATAR_GROUPS = [
  {
    label: 'Bolinhas',
    items: ['🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪',
            '🔶','🔷','🔸','🔹','🟥','🟧','🟨','🟩','🟦','🟪','🟫']
  },
  {
    label: 'Pessoas',
    items: ['👶','🧒','👧','👦','🧑','👩','👨','🧔','👱','🧓','👵','👴',
            '👩‍⚕️','👨‍⚕️','🧑‍⚕️','👩‍🦯','👨‍🦯','🧑‍🦽','👩‍🦽','🧑‍🦼']
  },
  {
    label: 'Animais',
    items: ['🐶','🐱','🐰','🐻','🐼','🐨','🐯','🦁','🐮','🐷',
            '🐸','🐵','🦊','🐺','🦝','🐱‍👤','🦋','🐧','🦜']
  },
  {
    label: 'Símbolos',
    items: ['⭐','🌟','💫','✨','❤️','🧡','💛','💚','💙','💜','🤎','🖤','🤍',
            '🏠','🌸','🌺','🍀','🌈','☀️','🌙','⚡','🎯','🎀','🎗️']
  }
]

export default function PatientForm() {
  const { id } = useParams()
  const editing = !!id
  const { data: existing } = usePatient(id)
  const create = useCreatePatient()
  const update = useUpdatePatient()
  const del = useDeletePatient()
  const nav = useNavigate()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  const limitReached = usePatientLimitReached()
  const [paywall, setPaywall] = useState(false)

  const [avatarGroup, setAvatarGroup] = useState(0)

  const [form, setForm] = useState({
    name: '', age: '', avatar: '👤', weight: '', condition: '', doctor: '', allergies: '', photo_url: ''
  })

  useEffect(() => {
    if (existing) setForm({
      name: existing.name || '', age: existing.age || '', avatar: existing.avatar || '👤',
      weight: existing.weight || '', condition: existing.condition || '',
      doctor: existing.doctor || '', allergies: existing.allergies || '', photo_url: existing.photo_url || ''
    })
  }, [existing])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    if (!editing && limitReached) { setPaywall(true); return }
    const payload = {
      ...form, age: form.age ? Number(form.age) : null, weight: form.weight ? Number(form.weight.replace(',', '.')) : null
    }
    try {
      if (editing) {
        await update.mutateAsync({ id, patch: payload })
        toast.show({ message: 'Paciente atualizado.', kind: 'success' })
      } else {
        await create.mutateAsync(payload)
        toast.show({ message: 'Paciente cadastrado.', kind: 'success' })
      }
      nav('/pacientes')
    } catch (err) {
      if (err?.code === 'FREE_PATIENT_LIMIT') { setPaywall(true); return }
      toast.show({ message: err.message || 'Erro ao salvar', kind: 'error' })
    }
  }

  async function handleDelete() {
    await del.mutateAsync(id)
    toast.show({ message: 'Paciente removido.', kind: 'info' })
    nav('/pacientes')
  }

  function onPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('photo_url', reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="pb-28">
      <Header back title={editing ? 'Editar paciente' : 'Novo paciente'} />
      <form onSubmit={submit} className="max-w-md mx-auto px-4 pt-3 space-y-4">
        <AdBanner />
        <div className="card p-4">
          <p className="text-xs font-medium mb-2">Avatar</p>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl overflow-hidden">
              {form.photo_url
                ? <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
                : form.avatar}
            </div>
            <label className="btn-secondary text-sm cursor-pointer">
              📷 Foto
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </label>
            {form.photo_url && <button type="button" className="text-xs text-rose-600" onClick={() => set('photo_url', '')}>Remover</button>}
          </div>
          {/* Category tabs */}
          <div className="flex gap-1 mt-3 overflow-x-auto no-scrollbar">
            {AVATAR_GROUPS.map((g, i) => (
              <button
                type="button" key={g.label}
                onClick={() => setAvatarGroup(i)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition ${
                  avatarGroup === i
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          {/* Emoji grid */}
          <div className="mt-2 grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto">
            {AVATAR_GROUPS[avatarGroup].items.map((a) => (
              <button
                type="button" key={a}
                onClick={() => { set('avatar', a); set('photo_url', '') }}
                className={`w-full aspect-square rounded-xl text-xl flex items-center justify-center transition active:scale-95 ${
                  form.avatar === a && !form.photo_url
                    ? 'ring-2 ring-brand-500 bg-brand-50 dark:bg-brand-500/10'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <Field label="Nome *">
          <input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome completo" />
        </Field>
        <Field label="Idade">
          <input type="number" className="input" value={form.age} onChange={(e) => set('age', e.target.value)} placeholder="Ex: 45" />
        </Field>
        <Field label="Peso (kg)">
          <input className="input" value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="Ex: 78,5" />
        </Field>
        <Field label="Condição / Diagnóstico">
          <input className="input" value={form.condition} onChange={(e) => set('condition', e.target.value)} placeholder="Ex: Hipertensão" />
        </Field>
        <Field label="Médico responsável">
          <input className="input" value={form.doctor} onChange={(e) => set('doctor', e.target.value)} placeholder="Ex: Dra. Ana" />
        </Field>
        <Field label="Alergias">
          <textarea className="input" rows={2} value={form.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Ex: Penicilina, AAS" />
        </Field>

        <button type="submit" className="btn-primary w-full" disabled={create.isPending || update.isPending}>
          {editing ? 'Salvar alterações' : 'Cadastrar paciente'}
        </button>

        {editing && (
          <button type="button" onClick={() => setConfirm(true)} className="btn-danger w-full">
            Excluir paciente
          </button>
        )}
      </form>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)}
                     title="Excluir paciente?"
                     message="Todos os tratamentos e doses deste paciente serão removidos. Esta ação não pode ser desfeita."
                     confirmLabel="Excluir" danger onConfirm={handleDelete} />

      <PaywallModal open={paywall} onClose={() => setPaywall(false)}
                    reason={`No plano grátis você pode ter até ${FREE_PATIENT_LIMIT} paciente.`} />
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
