import { useEffect, useState } from 'react'
import Header from '../components/Header'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { displayName } from '../utils/userDisplay'
import { hasSupabase, supabase } from '../services/supabase'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'

const NOTIF_KEY = 'medcontrol_notif'
const loadNotif = () => {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY)) ||
      { push: false, criticalAlarm: true, dailySummary: false, summaryTime: '07:00', advanceMins: 15 }
  } catch {
    return { push: false, dailySummary: false, summaryTime: '07:00', advanceMins: 15 }
  }
}

const ADVANCE_OPTIONS = [
  { value: 0,  label: 'Na hora' },
  { value: 5,  label: '5 min antes' },
  { value: 10, label: '10 min antes' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1h antes' },
]

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { signOut, user, updateProfile } = useAuth()
  const toast = useToast()
  const { supported, permState, subscribed, loading, subscribe, unsubscribe, scheduleDoses } = usePushNotifications()
  const { data: patients = [] } = usePatients()
  // Fetch upcoming doses (next 48h) — used to re-schedule when notification prefs change
  const { data: upcomingDoses = [] } = useDoses({
    from: new Date().toISOString(),
    to: new Date(Date.now() + 48 * 3600 * 1000).toISOString()
  })

  const [notif, setNotif] = useState(loadNotif())
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState(displayName(user))
  const [savingName, setSavingName] = useState(false)

  useEffect(() => { setName(displayName(user)) }, [user])

  function updateNotif(patch) {
    const next = { ...notif, ...patch }
    setNotif(next)
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next))
    // Se subscribed e mudou prefs que afetam scheduling, re-schedule
    const triggers = ['dailySummary', 'summaryTime', 'advanceMins', 'criticalAlarm']
    if (subscribed && triggers.some(k => k in patch)) {
      scheduleDoses(upcomingDoses).catch(e => console.warn('reschedule:', e?.message))
    }
  }

  async function saveName() {
    setSavingName(true)
    try {
      await updateProfile({ name })
      toast.show({ message: 'Nome atualizado.', kind: 'success' })
    } catch (err) {
      toast.show({ message: err.message || 'Falha ao salvar nome.', kind: 'error' })
    } finally { setSavingName(false) }
  }

  async function togglePush() {
    if (subscribed || notif.push) {
      try {
        await unsubscribe()
        updateNotif({ push: false })
        toast.show({ message: 'Notificações desativadas.', kind: 'info' })
      } catch (err) {
        toast.show({ message: err.message || 'Erro ao desativar.', kind: 'error' })
      }
    } else {
      if (permState === 'denied') {
        toast.show({ message: 'Permissão bloqueada. Libere nas configurações do navegador.', kind: 'error' })
        return
      }
      try {
        await subscribe(notif.advanceMins ?? 15)
        updateNotif({ push: true })
        toast.show({ message: '🔔 Notificações ativadas!', kind: 'success' })
      } catch (err) {
        toast.show({ message: err.message || 'Erro ao ativar notificações.', kind: 'error' })
      }
    }
  }

  async function handleAdvanceChange(val) {
    updateNotif({ advanceMins: val })
    // If already subscribed, update DB with new advance time
    if (subscribed) {
      try {
        await subscribe(val) // upsert updates advanceMins
      } catch {}
    }
  }

  async function exportUserData() {
    if (!hasSupabase || !user) {
      toast.show({ message: 'Exportação disponível apenas com conta Supabase.', kind: 'warn' }); return
    }
    try {
      const [dosesRes, treatmentsRes, subsRes] = await Promise.all([
        supabase.from('doses').select('id, patientId, medName, unit, scheduledAt, actualTime, status, type, observation'),
        supabase.from('treatments').select('id, patientId, medName, unit, intervalHours, durationDays, startDate, status'),
        supabase.from('subscriptions').select('tier, expiresAt').eq('userId', user.id).maybeSingle()
      ])
      const dump = {
        exportedAt: new Date().toISOString(),
        user: { id: user.id, email: user.email, createdAt: user.created_at },
        patients,
        treatments: treatmentsRes.data || [],
        doses: dosesRes.data || [],
        subscription: subsRes.data || null
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `dosy-meus-dados-${Date.now()}.json`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.show({ message: 'Dados exportados com sucesso.', kind: 'success' })
    } catch (err) {
      toast.show({ message: err.message || 'Falha ao exportar dados.', kind: 'error' })
    }
  }

  async function handleDeleteAccount() {
    if (!hasSupabase || !user) return
    try {
      // Chama Edge Function que deleta dados + auth.users com service_role
      const { error } = await supabase.functions.invoke('delete-account')
      if (error) throw error
      await signOut()
      toast.show({ message: 'Conta excluída. Todos os dados foram removidos.', kind: 'success' })
    } catch (err) {
      toast.show({ message: err.message || 'Falha ao excluir conta.', kind: 'error' })
    }
  }

  const pushActive = subscribed && notif.push
  const pushLabel = !supported
    ? 'Não suportado'
    : permState === 'denied'
    ? 'Bloqueado pelo navegador'
    : pushActive
    ? 'Ativo'
    : 'Inativo'
  const pushSubtitle = !supported
    ? 'Seu navegador não suporta notificações push.'
    : permState === 'denied'
    ? 'Acesse as configurações do navegador para permitir.'
    : pushActive
    ? `Aviso ${notif.advanceMins === 0 ? 'na hora' : `${notif.advanceMins} min antes`} da dose`
    : 'Ative para receber lembretes de dose.'

  return (
    <div className="pb-28">
      <Header back title="Ajustes" />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-4">

        {/* Aparência */}
        <section className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Aparência</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Modo escuro</span>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`w-12 h-7 rounded-full p-0.5 transition ${theme === 'dark' ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${theme === 'dark' ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </section>

        {/* Notificações */}
        <section className="card p-4 space-y-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Notificações</p>

          {/* Push toggle */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Notificações push</p>
              <p className="text-xs text-slate-500 mt-0.5">{pushSubtitle}</p>
              {pushActive && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  {pushLabel}
                </span>
              )}
              {!pushActive && supported && permState !== 'denied' && (
                <span className="text-[11px] text-slate-400">{pushLabel}</span>
              )}
              {permState === 'denied' && (
                <span className="text-[11px] text-rose-500">{pushLabel}</span>
              )}
            </div>
            <button
              onClick={togglePush}
              disabled={loading || !supported || permState === 'denied'}
              className={`flex-shrink-0 w-12 h-7 rounded-full p-0.5 transition disabled:opacity-40
                ${pushActive ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${pushActive ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Advance time — only shown when push is active */}
          {pushActive && (
            <div>
              <p className="text-xs font-medium mb-2">Avisar com antecedência</p>
              <div className="flex flex-wrap gap-2">
                {ADVANCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleAdvanceChange(opt.value)}
                    className={`chip ${notif.advanceMins === opt.value ? 'chip-active' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Alarme crítico (estilo despertador) */}
          {pushActive && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">⏰ Alarme crítico</p>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">
                  Toca som contínuo, tela cheia, ignora silencioso e modo Não Perturbe.
                  Recomendado para doses essenciais.
                </p>
              </div>
              <button
                onClick={() => updateNotif({ criticalAlarm: !(notif.criticalAlarm !== false) })}
                className={`flex-shrink-0 w-12 h-7 rounded-full p-0.5 transition ${notif.criticalAlarm !== false ? 'bg-rose-500' : 'bg-slate-300'}`}
              >
                <span className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${notif.criticalAlarm !== false ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          )}

          {/* Resumo diário */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Resumo diário</p>
              <p className="text-xs text-slate-500">Visão geral das doses do dia</p>
            </div>
            <button
              onClick={() => updateNotif({ dailySummary: !notif.dailySummary })}
              className={`flex-shrink-0 w-12 h-7 rounded-full p-0.5 transition ${notif.dailySummary ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${notif.dailySummary ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {notif.dailySummary && (
            <label className="block">
              <span className="block text-xs font-medium mb-1">Horário do resumo</span>
              <input
                type="time"
                className="input"
                value={notif.summaryTime}
                onChange={(e) => updateNotif({ summaryTime: e.target.value })}
              />
            </label>
          )}
        </section>

        {/* Conta */}
        <section className="card p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Conta</p>
          <label className="block">
            <span className="block text-xs font-medium mb-1">Seu nome</span>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como quer ser chamado"
              />
              <button
                onClick={saveName}
                disabled={savingName || !name.trim()}
                className="btn-primary px-4"
              >
                {savingName ? '…' : 'Salvar'}
              </button>
            </div>
          </label>
          <p className="text-xs text-slate-500">{user?.email || 'Demo'}</p>
          <button onClick={() => setConfirmLogout(true)} className="btn-secondary w-full">Sair</button>
        </section>

        {/* Dados & Privacidade */}
        {hasSupabase && user && (
          <section className="card p-4 space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Dados & Privacidade</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Conforme a LGPD, você pode exportar ou excluir todos os seus dados a qualquer momento.
            </p>
            <button onClick={exportUserData} className="btn-secondary w-full text-sm">
              📦 Exportar meus dados (JSON)
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 py-2.5 text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
            >
              🗑️ Excluir minha conta e todos os dados
            </button>
          </section>
        )}

        <p className="text-[11px] text-center text-slate-400">Dosy v1.0 · pt-BR</p>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="Sair da conta?"
        message="Você precisará entrar novamente."
        confirmLabel="Sair"
        onConfirm={signOut}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir conta permanentemente?"
        message="Todos os seus dados serão deletados: pacientes, tratamentos, doses e histórico. Esta ação é irreversível."
        confirmLabel="Excluir tudo"
        onConfirm={handleDeleteAccount}
        danger
      />
    </div>
  )
}
