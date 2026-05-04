import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, X as XIcon } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import ConfirmDialog from '../components/ConfirmDialog'
import PaywallModal from '../components/PaywallModal'
import AdBanner from '../components/AdBanner'
import CropModal from '../components/CropModal'
import { Card, Button, Input } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { usePatient, useCreatePatient, useUpdatePatient } from '../hooks/usePatients'
import { usePatientLimitReached, FREE_PATIENT_LIMIT } from '../hooks/useSubscription'
import { useToast } from '../hooks/useToast'
import { useUndoableDelete } from '../hooks/useUndoableDelete'
import { primePatientPhotoCache, dropPatientPhotoCache } from '../hooks/usePatientPhoto'
import { useQueryClient } from '@tanstack/react-query'
import { deletePatient } from '../services/patientsService'

const AVATAR_GROUPS = [
  {
    label: 'Bolinhas',
    items: ['🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪',
            '🔶','🔷','🔸','🔹','🟥','🟧','🟨','🟩','🟦','🟪','🟫'],
  },
  {
    label: 'Pessoas',
    items: ['👶','🧒','👧','👦','🧑','👩','👨','🧔','👱','🧓','👵','👴',
            '👩‍⚕️','👨‍⚕️','🧑‍⚕️','👩‍🦯','👨‍🦯','🧑‍🦽','👩‍🦽','🧑‍🦼'],
  },
  {
    label: 'Animais',
    items: ['🐶','🐱','🐰','🐻','🐼','🐨','🐯','🦁','🐮','🐷',
            '🐸','🐵','🦊','🐺','🦝','🐱‍👤','🦋','🐧','🦜'],
  },
  {
    label: 'Símbolos',
    items: ['⭐','🌟','💫','✨','❤️','🧡','💛','💚','💙','💜','🤎','🖤','🤍',
            '🏠','🌸','🌺','🍀','🌈','☀️','🌙','⚡','🎯','🎀','🎗️'],
  },
]

export default function PatientForm() {
  const { id } = useParams()
  const editing = !!id
  const { data: existing } = usePatient(id)
  const create = useCreatePatient()
  const update = useUpdatePatient()
  const nav = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const limitReached = usePatientLimitReached()
  const [paywall, setPaywall] = useState(false)
  const [avatarGroup, setAvatarGroup] = useState(0)

  const [form, setForm] = useState({
    name: '', age: '', avatar: '👤', weight: '', condition: '', doctor: '', allergies: '',
    photo_url: '', photo_version: 0,
  })
  // Item #114: track se photo mudou nesta sessão (bump photo_version no submit).
  const photoChangedRef = useRef(false)
  // CropModal state: src é raw data URL antes do crop.
  const [cropSrc, setCropSrc] = useState(null)

  useEffect(() => {
    if (existing) setForm({
      name: existing.name || '',
      age: existing.age != null ? String(existing.age) : '',
      avatar: existing.avatar || '👤',
      // Item #108 BUG-036: weight DB é numeric. Coerce String pra <input> + evita
      // .replace TypeError no submit.
      weight: existing.weight != null ? String(existing.weight) : '',
      condition: existing.condition || '',
      doctor: existing.doctor || '', allergies: existing.allergies || '',
      photo_url: existing.photo_url || '',
      photo_version: existing.photo_version || 0,
    })
  }, [existing])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    if (!editing && limitReached) { setPaywall(true); return }
    // Item #115: photo_version bump quando foto mudou nesta sessão.
    // Outros devices vão ver mismatch via realtime → re-fetch único + cache.
    // Cleared photo (set to '') também bump pra invalidar cache antigo.
    let nextVersion = form.photo_version || 0
    if (photoChangedRef.current) {
      nextVersion = (form.photo_version || 0) + 1
    }
    const payload = {
      ...form,
      age: form.age ? Number(form.age) : null,
      // Item #108 BUG-036: existing.weight (numeric DB) carregado direto em state
      // sem coerce → weight pode ser number, não string → .replace throws TypeError.
      // Fix: coerce String(weight) antes de replace.
      weight: form.weight ? Number(String(form.weight).replace(',', '.')) : null,
      photo_version: nextVersion,
    }
    try {
      let saved
      if (editing) {
        saved = await update.mutateAsync({ id, patch: payload })
        toast.show({ message: 'Paciente atualizado.', kind: 'success' })
      } else {
        saved = await create.mutateAsync(payload)
        toast.show({ message: 'Paciente cadastrado.', kind: 'success' })
      }
      // Pre-warm cache local (skip 1 round-trip no próximo render da lista).
      if (saved?.id && photoChangedRef.current) {
        if (form.photo_url) {
          primePatientPhotoCache(saved.id, nextVersion, form.photo_url)
        } else {
          dropPatientPhotoCache(saved.id)
        }
      }
      nav('/pacientes')
    } catch (err) {
      if (err?.code === 'FREE_PATIENT_LIMIT') { setPaywall(true); return }
      toast.show({ message: err.message || 'Erro ao salvar', kind: 'error' })
    }
  }

  // FASE 15 — undo 5s antes de DELETE real no servidor
  const undoableDelete = useUndoableDelete({
    mutationFn: deletePatient,
    onOptimistic: (delId) => {
      qc.setQueryData(['patients'], (old) => (old || []).filter((p) => p.id !== delId))
    },
    onRestore: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
    },
    itemLabel: 'Paciente',
  })

  function handleDelete() {
    undoableDelete(id)
    nav('/pacientes')
  }

  // Item #114 BUG-038 (release v0.2.0.2): photo upload com crop UI.
  // Antes (v0.2.0.1): center-crop automático sem deixar user escolher
  // região — sujeito off-center cortava errado.
  // Agora: lê arquivo → CropModal abre com zoom + drag pan → confirm
  // gera canvas 512x512 jpeg q0.78 (~50KB). photoChangedRef trigga
  // photo_version bump no submit (Item #115).
  function onPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCropSrc(ev.target.result)
    }
    reader.onerror = () => {
      toast.show({ message: 'Falha ao ler arquivo.', kind: 'error' })
    }
    reader.readAsDataURL(file)
    // Reset input pra permitir mesmo arquivo de novo se user cancelar crop
    e.target.value = ''
  }

  function onCropConfirm({ full }) {
    set('photo_url', full)
    photoChangedRef.current = true
    setCropSrc(null)
  }

  function onCropCancel() {
    setCropSrc(null)
  }

  function clearPhoto() {
    set('photo_url', '')
    photoChangedRef.current = true
  }

  return (
    <motion.div
      style={{ paddingBottom: 110 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.inOut }}
    >
      <PageHeader title={editing ? 'Editar paciente' : 'Novo paciente'} back/>

      <form
        onSubmit={submit}
        className="max-w-md mx-auto px-4 pt-1"
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <AdBanner />

        {/* Avatar picker card */}
        <Card padding={16}>
          <p style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--dosy-fg-secondary)',
            margin: '0 0 12px 0',
            fontFamily: 'var(--dosy-font-display)',
          }}>Avatar</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 9999,
              background: 'var(--dosy-peach-100)',
              color: 'var(--dosy-fg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, overflow: 'hidden', flexShrink: 0,
            }}>
              {form.photo_url
                ? <img src={form.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : form.avatar}
            </div>
            <label className="dosy-press" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px',
              background: 'var(--dosy-bg-elevated)',
              color: 'var(--dosy-fg)',
              boxShadow: 'var(--dosy-shadow-sm)',
              borderRadius: 9999,
              fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
              cursor: 'pointer',
              fontFamily: 'var(--dosy-font-display)',
            }}>
              <Camera size={16} strokeWidth={1.75}/>
              Foto
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhoto}/>
            </label>
            {form.photo_url && (
              <button
                type="button"
                onClick={clearPhoto}
                style={{
                  fontSize: 12, color: 'var(--dosy-danger)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--dosy-font-body)',
                }}
              >Remover</button>
            )}
          </div>

          {/* Category tabs */}
          <div
            className="dosy-scroll"
            style={{
              display: 'flex', gap: 6, overflowX: 'auto',
              padding: 2, marginBottom: 10,
            }}
          >
            {AVATAR_GROUPS.map((g, i) => {
              const active = avatarGroup === i
              return (
                <button
                  type="button"
                  key={g.label}
                  onClick={() => setAvatarGroup(i)}
                  className="dosy-press"
                  style={{
                    flexShrink: 0,
                    padding: '6px 14px',
                    background: active ? 'var(--dosy-gradient-sunset)' : 'var(--dosy-bg-sunken)',
                    color: active ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-fg-secondary)',
                    border: 'none',
                    borderRadius: 9999,
                    fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
                    cursor: 'pointer',
                    fontFamily: 'var(--dosy-font-display)',
                    boxShadow: active ? '0 6px 14px -4px rgba(255,61,127,0.36)' : 'none',
                  }}
                >
                  {g.label}
                </button>
              )
            })}
          </div>

          {/* Emoji grid */}
          <div
            className="dosy-scroll"
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6,
              maxHeight: 144, overflowY: 'auto',
            }}
          >
            {AVATAR_GROUPS[avatarGroup].items.map((a) => {
              const active = form.avatar === a && !form.photo_url
              return (
                <button
                  type="button"
                  key={a}
                  onClick={() => { set('avatar', a); set('photo_url', '') }}
                  className="dosy-press"
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: 12,
                    fontSize: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? 'var(--dosy-peach-100)' : 'var(--dosy-bg-sunken)',
                    border: active ? '2px solid var(--dosy-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {a}
                </button>
              )
            })}
          </div>
        </Card>

        <Input
          label="Nome"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Nome completo"
        />
        <Input
          label="Idade"
          type="number"
          inputMode="numeric"
          value={form.age}
          onChange={(e) => set('age', e.target.value)}
          placeholder="Ex: 45"
        />
        <Input
          label="Peso (kg)"
          inputMode="decimal"
          value={form.weight}
          onChange={(e) => set('weight', e.target.value)}
          placeholder="Ex: 78,5"
        />
        <Input
          label="Condição / Diagnóstico"
          value={form.condition}
          onChange={(e) => set('condition', e.target.value)}
          placeholder="Ex: Hipertensão"
        />
        <Input
          label="Médico responsável"
          value={form.doctor}
          onChange={(e) => set('doctor', e.target.value)}
          placeholder="Ex: Dra. Ana"
        />
        {/* Alergias — textarea (Dosy Input ainda não aceita textarea, render inline com mesmo style) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{
            fontSize: 12, fontWeight: 600, color: 'var(--dosy-fg-secondary)',
            letterSpacing: '0.04em', textTransform: 'uppercase', paddingLeft: 4,
            fontFamily: 'var(--dosy-font-display)',
          }}>Alergias</label>
          <textarea
            rows={2}
            value={form.allergies}
            onChange={(e) => set('allergies', e.target.value)}
            placeholder="Ex: Penicilina, AAS"
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

        <Button
          type="submit"
          kind="primary"
          full
          size="lg"
          disabled={create.isPending || update.isPending}
        >
          {editing ? 'Salvar alterações' : 'Cadastrar paciente'}
        </Button>

        {editing && (
          <Button
            type="button"
            kind="danger"
            full
            onClick={() => setConfirm(true)}
          >
            Excluir paciente
          </Button>
        )}
      </form>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Excluir paciente?"
        message="Todos os tratamentos e doses deste paciente serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
      />

      <PaywallModal
        open={paywall}
        onClose={() => setPaywall(false)}
        reason={`No plano grátis você pode ter até ${FREE_PATIENT_LIMIT} paciente.`}
      />

      <CropModal
        open={!!cropSrc}
        src={cropSrc}
        onConfirm={onCropConfirm}
        onCancel={onCropCancel}
      />
    </motion.div>
  )
}
