import { useEffect, useState } from 'react'
import Header from '../components/Header'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { displayName } from '../utils/userDisplay'

const NOTIF_KEY = 'medcontrol_notif'
const loadNotif = () => {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY)) || { push: false, dailySummary: false, summaryTime: '07:00' } }
  catch { return { push: false, dailySummary: false, summaryTime: '07:00' } }
}

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { signOut, user, updateProfile } = useAuth()
  const toast = useToast()
  const [notif, setNotif] = useState(loadNotif())
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [name, setName] = useState(displayName(user))
  const [savingName, setSavingName] = useState(false)
  useEffect(() => { setName(displayName(user)) }, [user])

  async function saveName() {
    setSavingName(true)
    try {
      await updateProfile({ name })
      toast.show({ message: 'Nome atualizado.', kind: 'success' })
    } catch (err) {
      toast.show({ message: err.message || 'Falha ao salvar nome.', kind: 'error' })
    } finally { setSavingName(false) }
  }

  function updateNotif(patch) {
    const next = { ...notif, ...patch }
    setNotif(next)
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next))
  }

  async function requestPush() {
    if (!('Notification' in window)) {
      toast.show({ message: 'Notificações não suportadas.', kind: 'error' }); return
    }
    const res = await Notification.requestPermission()
    if (res === 'granted') {
      updateNotif({ push: true })
      toast.show({ message: 'Notificações ativadas.', kind: 'success' })
    } else {
      updateNotif({ push: false })
      toast.show({ message: 'Permissão negada.', kind: 'warn' })
    }
  }

  return (
    <div className="pb-28">
      <Header back title="Ajustes" />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-4">
        <section className="card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Aparência</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Modo escuro</span>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className={`w-12 h-7 rounded-full p-0.5 transition ${theme === 'dark' ? 'bg-brand-600' : 'bg-slate-300'}`}>
              <span className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${theme === 'dark' ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </section>

        <section className="card p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Notificações</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Notificações push</span>
            <button onClick={() => notif.push ? updateNotif({ push: false }) : requestPush()}
                    className={`w-12 h-7 rounded-full p-0.5 transition ${notif.push ? 'bg-brand-600' : 'bg-slate-300'}`}>
              <span className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${notif.push ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Resumo diário</span>
            <button onClick={() => updateNotif({ dailySummary: !notif.dailySummary })}
                    className={`w-12 h-7 rounded-full p-0.5 transition ${notif.dailySummary ? 'bg-brand-600' : 'bg-slate-300'}`}>
              <span className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${notif.dailySummary ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {notif.dailySummary && (
            <label className="block">
              <span className="block text-xs font-medium mb-1">Horário do resumo</span>
              <input type="time" className="input" value={notif.summaryTime}
                     onChange={(e) => updateNotif({ summaryTime: e.target.value })} />
            </label>
          )}
        </section>

        <section className="card p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Conta</p>
          <label className="block">
            <span className="block text-xs font-medium mb-1">Seu nome</span>
            <div className="flex gap-2">
              <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)}
                     placeholder="Como quer ser chamado" />
              <button onClick={saveName} disabled={savingName || !name.trim()}
                      className="btn-primary px-4">{savingName ? '…' : 'Salvar'}</button>
            </div>
          </label>
          <p className="text-xs text-slate-500">{user?.email || 'Demo'}</p>
          <button onClick={() => setConfirmLogout(true)} className="btn-secondary w-full">Sair</button>
        </section>

        <p className="text-[11px] text-center text-slate-400">MedControl v1.0 · pt-BR</p>
      </div>

      <ConfirmDialog open={confirmLogout} onClose={() => setConfirmLogout(false)}
                     title="Sair da conta?" message="Você precisará entrar novamente."
                     confirmLabel="Sair" onConfirm={signOut} />
    </div>
  )
}
