import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from '../components/Header'
import Dropdown from '../components/Dropdown'
import TierBadge from '../components/TierBadge'
import { TIMING, EASE } from '../animations'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'
import AdBanner from '../components/AdBanner'
import { track, EVENTS } from '../services/analytics'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useUserPrefs, useUpdateUserPrefs, DEFAULT_PREFS } from '../hooks/useUserPrefs'
import { useAppUpdate } from '../hooks/useAppUpdate'
import { Capacitor } from '@capacitor/core'
import { displayName } from '../utils/userDisplay'
import { hasSupabase, supabase } from '../services/supabase'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'

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

  // User-level prefs synced via DB (medcontrol.user_prefs) — same view across devices
  const { data: notif = DEFAULT_PREFS } = useUserPrefs()
  const updatePrefsMut = useUpdateUserPrefs()
  const update = useAppUpdate()

  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState(displayName(user))
  const [savingName, setSavingName] = useState(false)
  const [exportingData, setExportingData] = useState(false)

  useEffect(() => { setName(displayName(user)) }, [user])

  async function updateNotif(patch) {
    try {
      await updatePrefsMut.mutateAsync(patch)
    } catch (err) {
      toast.show({ message: err.message || 'Falha ao salvar preferência.', kind: 'error' })
      return
    }
    // Re-schedule sempre que pref relevante mudar — daily summary é independente
    // do estado `subscribed`, então não gated. scheduleDoses internamente respeita
    // prefs.push pra decidir sobre dose notifs/alarms.
    const triggers = ['push', 'dailySummary', 'summaryTime', 'advanceMins', 'criticalAlarm', 'dndEnabled', 'dndStart', 'dndEnd']
    if (triggers.some(k => k in patch)) {
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
    setExportingData(true)
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
      const json = JSON.stringify(dump, null, 2)
      const d = new Date()
      const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
      const hash = Math.random().toString(36).slice(2, 8)
      const filename = `dosy-backup-${ymd}-${hash}.json`

      if (Capacitor.isNativePlatform()) {
        // Native: Documents dir → persistente, Share sheet → user salva via "Save to Files"
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
        const { Share } = await import('@capacitor/share')
        await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true
        })
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Documents })
        toast.show({ message: `Backup salvo em Documentos · ${filename}`, kind: 'success', duration: 6000 })
        // File saved → libera loader ANTES do share (share pode não resolver em alguns webviews)
        setExportingData(false)
        Share.share({
          title: 'Meus dados Dosy',
          url: uri,
          dialogTitle: 'Compartilhar backup'
        }).catch((shareErr) => {
          if (!/cancel/i.test(shareErr?.message || '')) {
            console.warn('Share failed:', shareErr)
          }
        })
      } else {
        // Web: blob + anchor download
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = filename
        document.body.appendChild(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        toast.show({ message: 'Dados exportados com sucesso.', kind: 'success' })
      }
    } catch (err) {
      toast.show({ message: err.message || 'Falha ao exportar dados.', kind: 'error' })
    } finally {
      setExportingData(false)
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
      <motion.div
        className="max-w-md mx-auto px-4 pt-3 space-y-1"
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: TIMING.stagger } } }}
      >
        <AdBanner />

        {/* Tier destaque */}
        <motion.div
          variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }}
          className="flex items-center justify-between bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl px-4 py-3 mb-2"
        >
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Seu plano</p>
            <p className="text-xs text-slate-500 mt-0.5">Tier ativo da conta</p>
          </div>
          <TierBadge variant="large" />
        </motion.div>

        {/* Aparência */}
        <motion.section variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }} className="card p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Aparência</p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Modo escuro</span>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`w-12 h-7 rounded-full p-0.5 transition ${theme === 'dark' ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${theme === 'dark' ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Estilo de ícones (flat lucide vs emojis legado) */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Estilo de ícones</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Flat = visual moderno · Emoji = legado colorido</p>
            </div>
            <select
              defaultValue={typeof window !== 'undefined' ? (localStorage.getItem('dosy_icon_style') || 'flat') : 'flat'}
              onChange={(e) => {
                if (e.target.value === 'flat') localStorage.removeItem('dosy_icon_style')
                else localStorage.setItem('dosy_icon_style', e.target.value)
                window.location.reload()
              }}
              className="text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
            >
              <option value="flat">Flat</option>
              <option value="emoji">Emoji</option>
            </select>
          </div>
        </motion.section>

        {/* Notificações */}
        <motion.section variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }} className="card p-4 space-y-4">
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

          {/* Re-check Android special-access permissions (alarme estilo despertador) */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('dosy:checkPermissions'))}
            className="w-full text-left flex items-center justify-between rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Verificar permissões do alarme</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Alarme estilo despertador exige 4 permissões especiais Android.
              </p>
            </div>
            <span className="text-brand-600 dark:text-brand-400 ml-3">→</span>
          </button>

          {/* Advance time — only shown when push is active */}
          {pushActive && (
            <Dropdown
              label="Avisar com antecedência"
              value={notif.advanceMins ?? 0}
              onChange={(v) => handleAdvanceChange(Number(v))}
              options={ADVANCE_OPTIONS}
              size="sm"
            />
          )}

          {/* Alarme crítico (estilo despertador) */}
          {pushActive && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium inline-flex items-center gap-1.5"><Icon name="alarm" size={14} /> Alarme crítico</p>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">
                  Toca som contínuo, tela cheia, ignora silencioso e modo Não Perturbe.
                  Recomendado para doses essenciais.
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !(notif.criticalAlarm !== false)
                  updateNotif({ criticalAlarm: next })
                  track(EVENTS.CRITICAL_ALARM_TOGGLED, { enabled: next })
                }}
                className={`flex-shrink-0 w-12 h-7 rounded-full p-0.5 transition ${notif.criticalAlarm !== false ? 'bg-rose-500' : 'bg-slate-300'}`}
              >
                <span className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${notif.criticalAlarm !== false ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          )}

          {/* Não perturbe — janela silenciosa (Item #087: aparece só se Alarme Crítico ON) */}
          {pushActive && notif.criticalAlarm !== false && (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium inline-flex items-center gap-1.5"><Icon name="bell-off" size={14} /> Não perturbe</p>
                  <p className="text-xs text-slate-500 leading-tight mt-0.5">
                    Define janela em que o alarme crítico não toca. Doses no horário recebem só
                    notificação push (sem despertador). Útil pra noite/madrugada.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !notif.dndEnabled
                    updateNotif({ dndEnabled: next })
                    track(EVENTS.DND_TOGGLED, { enabled: next })
                  }}
                  className={`flex-shrink-0 w-12 h-7 rounded-full p-0.5 transition ${notif.dndEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
                >
                  <span className={`block w-6 h-6 rounded-full bg-white shadow transform transition ${notif.dndEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {notif.dndEnabled && (
                <div className="grid grid-cols-2 gap-2 pl-1">
                  <label className="block">
                    <span className="block text-[11px] font-medium mb-1 text-slate-500">De</span>
                    <input
                      type="time"
                      value={notif.dndStart || '23:00'}
                      onChange={(e) => updateNotif({ dndStart: e.target.value })}
                      className="input text-sm py-1.5"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-medium mb-1 text-slate-500">Até</span>
                    <input
                      type="time"
                      value={notif.dndEnd || '07:00'}
                      onChange={(e) => updateNotif({ dndEnd: e.target.value })}
                      className="input text-sm py-1.5"
                    />
                  </label>
                </div>
              )}
            </>
          )}

          {/* Resumo diário — Item #086 (BUG-019): UI ocultada em v0.1.7.3.
              Feature broken end-to-end (LocalNotifications client-side só
              dispara se app abrir; sem cron server-side equivalente).
              Reativar quando Edge daily-summary-cron estiver pronta em
              release v0.1.8.0. Toggle/horário ainda persistem em DB se
              setados anteriormente — apenas escondidos visualmente. */}
        </motion.section>

        {/* Conta */}
        <motion.section variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }} className="card p-4 space-y-3">
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
        </motion.section>

        {/* Dados & Privacidade */}
        {hasSupabase && user && (
          <motion.section variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }} className="card p-4 space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Dados & Privacidade</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Conforme a LGPD, você pode exportar ou excluir todos os seus dados a qualquer momento.
            </p>
            <button onClick={exportUserData} disabled={exportingData} className={`btn-secondary w-full text-sm inline-flex items-center justify-center gap-2 ${exportingData ? 'opacity-70 cursor-wait' : ''}`}>
              {exportingData ? (
                <>
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-400/40 border-t-slate-700 dark:border-t-slate-200 animate-spin" />
                  Gerando backup…
                </>
              ) : (
                <>📦 {Capacitor.isNativePlatform() ? 'Compartilhar meus dados (JSON)' : 'Exportar meus dados (JSON)'}</>
              )}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 py-2.5 text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
            >
              <span className="inline-flex items-center justify-center gap-1.5"><Icon name="trash" size={14} /> Excluir minha conta e todos os dados</span>
            </button>
          </motion.section>
        )}

        <motion.section variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }} className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Versão</p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Dosy v{update.current} · pt-BR
              </p>
            </div>
            {update.available ? (
              <button
                onClick={async () => {
                  if (Capacitor.isNativePlatform()) {
                    try {
                      const { Browser } = await import('@capacitor/browser')
                      await Browser.open({ url: 'https://dosy-teal.vercel.app' + (update.latest?.installUrl || '/install') })
                    } catch {
                      window.open('https://dosy-teal.vercel.app' + (update.latest?.installUrl || '/install'), '_blank')
                    }
                  } else {
                    window.location.reload()
                  }
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow active:scale-95"
              >
                ↑ Atualizar v{update.latest?.version}
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">Atualizado</span>
            )}
          </div>
          {update.available && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
              Nova versão disponível com correções e melhorias.
            </p>
          )}
          <Link
            to="/faq"
            className="mt-2 flex items-center justify-between text-xs px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
              <Icon name="info" size={14} /> Dúvidas frequentes
            </span>
            <Icon name="chevron" size={14} className="text-slate-400" />
          </Link>
        </motion.section>
      </motion.div>

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
