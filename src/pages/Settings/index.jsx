// #029 (release v0.2.0.11) — Settings.jsx orchestrator pós-refactor.
// Antes: 692 LOC monolítico. Agora: ~200 LOC orchestrator + sections.jsx + Row.jsx + constants.js.
// Sections puras receivem state via props. State + handlers + queries ficam aqui.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { TIMING } from '../../animations'
import ConfirmDialog from '../../components/ConfirmDialog'
import ChangePasswordModal from '../../components/ChangePasswordModal'
import AdBanner from '../../components/AdBanner'
import PageHeader from '../../components/dosy/PageHeader'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useUserPrefs, useUpdateUserPrefs, DEFAULT_PREFS } from '../../hooks/useUserPrefs'
import { useAppUpdate } from '../../hooks/useAppUpdate'
import { useAppLock } from '../../hooks/useAppLock'
import { displayName } from '../../utils/userDisplay'
import { hasSupabase, supabase } from '../../services/supabase'
import { usePatients } from '../../hooks/usePatients'
import { useDoses } from '../../hooks/useDoses'
import { useMyTier } from '../../hooks/useSubscription'
import {
  PlanSection,
  AppearanceSection,
  NotificationsSection,
  SecuritySection,
  AccountSection,
  DataPrivacySection,
  VersionSection,
} from './sections'

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { signOut, user, updateProfile } = useAuth()
  const toast = useToast()
  const { supported, permState, subscribed, loading, subscribe, unsubscribe, scheduleDoses } = usePushNotifications()
  const { data: patients = [] } = usePatients()
  const { data: tier = 'free' } = useMyTier()
  const { data: upcomingDoses = [] } = useDoses({
    from: new Date().toISOString(),
    to: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  })

  const { data: notif = DEFAULT_PREFS } = useUserPrefs()
  const updatePrefsMut = useUpdateUserPrefs()
  const update = useAppUpdate()
  const appLock = useAppLock()
  const isNative = Capacitor.isNativePlatform()

  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
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
    const triggers = ['push', 'dailySummary', 'summaryTime', 'advanceMins', 'criticalAlarm', 'dndEnabled', 'dndStart', 'dndEnd']
    if (triggers.some((k) => k in patch)) {
      scheduleDoses(upcomingDoses).catch((e) => console.warn('reschedule:', e?.message))
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
    if (subscribed) {
      try { await subscribe(val) } catch {}
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
        supabase.from('subscriptions').select('tier, expiresAt').eq('userId', user.id).maybeSingle(),
      ])
      const dump = {
        exportedAt: new Date().toISOString(),
        user: { id: user.id, email: user.email, createdAt: user.created_at },
        patients,
        treatments: treatmentsRes.data || [],
        doses: dosesRes.data || [],
        subscription: subsRes.data || null,
      }
      const json = JSON.stringify(dump, null, 2)
      const d = new Date()
      const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
      const hash = Math.random().toString(36).slice(2, 8)
      const filename = `dosy-backup-${ymd}-${hash}.json`

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
        const { Share } = await import('@capacitor/share')
        await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        })
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Documents })
        toast.show({ message: `Backup salvo em Documentos · ${filename}`, kind: 'success', duration: 6000 })
        setExportingData(false)
        Share.share({
          title: 'Meus dados Dosy',
          url: uri,
          dialogTitle: 'Compartilhar backup',
        }).catch((shareErr) => {
          if (!/cancel/i.test(shareErr?.message || '')) {
            console.warn('Share failed:', shareErr)
          }
        })
      } else {
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
    <div style={{ paddingBottom: 110 }}>
      <PageHeader title="Ajustes" back/>

      <motion.div
        className="max-w-md mx-auto px-4 pt-1"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: TIMING.stagger } } }}
      >
        <AdBanner />

        <PlanSection tier={tier} />

        <AppearanceSection theme={theme} setTheme={setTheme} />

        <NotificationsSection
          pushActive={pushActive}
          pushLabel={pushLabel}
          pushSubtitle={pushSubtitle}
          loading={loading}
          supported={supported}
          permState={permState}
          togglePush={togglePush}
          handleAdvanceChange={handleAdvanceChange}
          notif={notif}
          updateNotif={updateNotif}
        />

        {isNative && <SecuritySection appLock={appLock} toast={toast} />}

        <AccountSection
          name={name}
          setName={setName}
          savingName={savingName}
          saveName={saveName}
          user={user}
          onLogoutClick={() => setConfirmLogout(true)}
          onChangePasswordClick={hasSupabase && user ? () => setChangePasswordOpen(true) : null}
        />

        {hasSupabase && user && (
          <DataPrivacySection
            exportingData={exportingData}
            exportUserData={exportUserData}
            onDeleteClick={() => setConfirmDelete(true)}
          />
        )}

        <VersionSection update={update} />
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
      {/* #152 (v0.2.0.12) — Modal alterar senha */}
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  )
}
