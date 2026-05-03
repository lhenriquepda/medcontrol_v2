import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, BellOff, Sun, Moon, AlarmClock, Trash2, Download, ChevronRight, HelpCircle, ArrowUpCircle } from 'lucide-react'
import Dropdown from '../components/Dropdown'
import { TIMING, EASE } from '../animations'
import ConfirmDialog from '../components/ConfirmDialog'
import AdBanner from '../components/AdBanner'
import { Card, Button, Input, Toggle } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
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
import { useMyTier } from '../hooks/useSubscription'
import { TIER_LABELS } from '../utils/tierUtils'

const ADVANCE_OPTIONS = [
  { value: 0,  label: 'Na hora' },
  { value: 5,  label: '5 min antes' },
  { value: 10, label: '10 min antes' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1h antes' },
]

const SECTION_LABEL_STYLE = {
  fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--dosy-fg-secondary)',
  margin: '0 0 12px 0',
  fontFamily: 'var(--dosy-font-display)',
}

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

        {/* Plan card */}
        <motion.div
          variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }}
        >
          <Card padding={16} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--dosy-gradient-sunset-soft)',
          }}>
            <div>
              <p style={{
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--dosy-fg-secondary)', margin: 0,
                fontFamily: 'var(--dosy-font-display)',
              }}>Seu plano</p>
              <p style={{
                fontSize: 12, color: 'var(--dosy-fg-secondary)',
                margin: '2px 0 0 0',
              }}>Tier ativo da conta</p>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
              padding: '6px 14px',
              background: tier === 'pro' || tier === 'admin'
                ? 'var(--dosy-gradient-sunset)'
                : 'var(--dosy-bg-elevated)',
              color: tier === 'pro' || tier === 'admin'
                ? 'var(--dosy-fg-on-sunset)'
                : 'var(--dosy-fg)',
              borderRadius: 9999,
              boxShadow: 'var(--dosy-shadow-sm)',
              textTransform: 'uppercase',
              fontFamily: 'var(--dosy-font-display)',
            }}>{TIER_LABELS[tier]}</span>
          </Card>
        </motion.div>

        {/* Aparência */}
        <motion.section variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }}>
          <Card padding={16}>
            <p style={SECTION_LABEL_STYLE}>Aparência</p>
            <Row
              icon={theme === 'dark' ? Moon : Sun}
              label="Modo escuro"
              right={<Toggle value={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')}/>}
            />
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--dosy-fg)', margin: 0 }}>Estilo de ícones</p>
                <p style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                  Flat = visual moderno · Emoji = legado colorido
                </p>
              </div>
              <select
                defaultValue={typeof window !== 'undefined' ? (localStorage.getItem('dosy_icon_style') || 'flat') : 'flat'}
                onChange={(e) => {
                  if (e.target.value === 'flat') localStorage.removeItem('dosy_icon_style')
                  else localStorage.setItem('dosy_icon_style', e.target.value)
                  window.location.reload()
                }}
                style={{
                  fontSize: 13, fontWeight: 600,
                  padding: '8px 12px', borderRadius: 12,
                  background: 'var(--dosy-bg-sunken)',
                  color: 'var(--dosy-fg)',
                  border: 'none', outline: 'none',
                  fontFamily: 'var(--dosy-font-body)',
                  cursor: 'pointer',
                }}
              >
                <option value="flat">Flat</option>
                <option value="emoji">Emoji</option>
              </select>
            </div>
          </Card>
        </motion.section>

        {/* Notificações */}
        <motion.section variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }}>
          <Card padding={16}>
            <p style={SECTION_LABEL_STYLE}>Notificações</p>

            {/* Push toggle */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14, fontWeight: 600,
                  color: 'var(--dosy-fg)', margin: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <Bell size={14} strokeWidth={1.75}/>
                  Notificações push
                </p>
                <p style={{
                  fontSize: 11.5, color: 'var(--dosy-fg-secondary)',
                  margin: '2px 0 0 0', lineHeight: 1.4,
                }}>{pushSubtitle}</p>
                {pushActive && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, color: '#3F9E7E', fontWeight: 600,
                    marginTop: 4,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: 9999,
                      background: '#3F9E7E', display: 'inline-block',
                      animation: 'dosy-pulse-ring 1.4s ease-out infinite',
                    }}/>
                    {pushLabel}
                  </span>
                )}
                {!pushActive && supported && permState !== 'denied' && (
                  <span style={{ fontSize: 11, color: 'var(--dosy-fg-tertiary)' }}>{pushLabel}</span>
                )}
                {permState === 'denied' && (
                  <span style={{ fontSize: 11, color: 'var(--dosy-danger)' }}>{pushLabel}</span>
                )}
              </div>
              <Toggle
                value={pushActive}
                onChange={togglePush}
                disabled={loading || !supported || permState === 'denied'}
                ariaLabel="Notificações push"
              />
            </div>

            {/* Permissões verificar */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('dosy:checkPermissions'))}
              className="dosy-press"
              style={{
                width: '100%', textAlign: 'left',
                marginTop: 12,
                padding: '10px 14px',
                background: 'var(--dosy-bg-sunken)',
                border: 'none', borderRadius: 12,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                fontFamily: 'var(--dosy-font-body)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--dosy-fg)', margin: 0 }}>
                  Verificar permissões do alarme
                </p>
                <p style={{ fontSize: 11, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                  Alarme estilo despertador exige 4 permissões especiais Android.
                </p>
              </div>
              <ChevronRight size={16} strokeWidth={1.75} style={{ color: 'var(--dosy-primary)' }}/>
            </button>

            {/* Advance time — só com push ativo */}
            {pushActive && (
              <div style={{ marginTop: 14 }}>
                <Dropdown
                  label="Avisar com antecedência"
                  value={notif.advanceMins ?? 0}
                  onChange={(v) => handleAdvanceChange(Number(v))}
                  options={ADVANCE_OPTIONS}
                  size="sm"
                />
              </div>
            )}

            {/* Alarme crítico */}
            {pushActive && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 14, fontWeight: 600,
                    color: 'var(--dosy-fg)', margin: 0,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    <AlarmClock size={14} strokeWidth={1.75}/>
                    Alarme crítico
                  </p>
                  <p style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                    Toca som contínuo, tela cheia, ignora silencioso e modo Não Perturbe.
                    Recomendado para doses essenciais.
                  </p>
                </div>
                <Toggle
                  value={notif.criticalAlarm !== false}
                  onChange={(v) => {
                    updateNotif({ criticalAlarm: v })
                    track(EVENTS.CRITICAL_ALARM_TOGGLED, { enabled: v })
                  }}
                  ariaLabel="Alarme crítico"
                />
              </div>
            )}

            {/* Não perturbe — cascata: aparece só se Alarme Crítico ON */}
            {pushActive && notif.criticalAlarm !== false && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 600,
                      color: 'var(--dosy-fg)', margin: 0,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      <BellOff size={14} strokeWidth={1.75}/>
                      Não perturbe
                    </p>
                    <p style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                      Define janela em que o alarme crítico não toca. Doses no horário recebem só
                      notificação push (sem despertador). Útil pra noite/madrugada.
                    </p>
                  </div>
                  <Toggle
                    value={notif.dndEnabled}
                    onChange={(v) => {
                      updateNotif({ dndEnabled: v })
                      track(EVENTS.DND_TOGGLED, { enabled: v })
                    }}
                    ariaLabel="Não perturbe"
                  />
                </div>
                {notif.dndEnabled && (
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Input
                      label="De"
                      type="time"
                      value={notif.dndStart || '23:00'}
                      onChange={(e) => updateNotif({ dndStart: e.target.value })}
                    />
                    <Input
                      label="Até"
                      type="time"
                      value={notif.dndEnd || '07:00'}
                      onChange={(e) => updateNotif({ dndEnd: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.section>

        {/* Conta */}
        <motion.section variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }}>
          <Card padding={16}>
            <p style={SECTION_LABEL_STYLE}>Conta</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Input
                label="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como quer ser chamado"
              />
              <Button
                kind="primary"
                full
                onClick={saveName}
                disabled={savingName || !name.trim()}
              >
                {savingName ? 'Salvando…' : 'Salvar nome'}
              </Button>
              <p style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', margin: '4px 0 0 4px' }}>
                {user?.email || 'Demo'}
              </p>
              <Button kind="secondary" full onClick={() => setConfirmLogout(true)}>
                Sair
              </Button>
            </div>
          </Card>
        </motion.section>

        {/* Dados & Privacidade */}
        {hasSupabase && user && (
          <motion.section variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }}>
            <Card padding={16}>
              <p style={SECTION_LABEL_STYLE}>Dados & Privacidade</p>
              <p style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                Conforme a LGPD, você pode exportar ou excluir todos os seus dados a qualquer momento.
              </p>
              <Button
                kind="secondary"
                full
                icon={Download}
                onClick={exportUserData}
                disabled={exportingData}
              >
                {exportingData
                  ? 'Gerando backup…'
                  : (Capacitor.isNativePlatform() ? 'Compartilhar meus dados (JSON)' : 'Exportar meus dados (JSON)')}
              </Button>
              <div style={{ marginTop: 8 }}>
                <Button
                  kind="danger"
                  full
                  icon={Trash2}
                  onClick={() => setConfirmDelete(true)}
                >
                  Excluir minha conta e todos os dados
                </Button>
              </div>
            </Card>
          </motion.section>
        )}

        {/* Versão / Update / FAQ */}
        <motion.section variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } } }}>
          <Card padding={16}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13, fontWeight: 700, color: 'var(--dosy-fg)', margin: 0,
                  fontFamily: 'var(--dosy-font-display)',
                }}>Versão</p>
                <p style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0' }}>
                  Dosy v{update.current} · pt-BR
                </p>
              </div>
              {update.available ? (
                <Button
                  kind="primary"
                  size="sm"
                  icon={ArrowUpCircle}
                  onClick={async () => {
                    if (Capacitor.isNativePlatform()) {
                      try {
                        const { Browser } = await import('@capacitor/browser')
                        await Browser.open({ url: 'https://dosy-app.vercel.app' + (update.latest?.installUrl || '/install') })
                      } catch {
                        window.open('https://dosy-app.vercel.app' + (update.latest?.installUrl || '/install'), '_blank')
                      }
                    } else {
                      window.location.reload()
                    }
                  }}
                >
                  Atualizar v{update.latest?.version}
                </Button>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--dosy-fg-tertiary)' }}>Atualizado</span>
              )}
            </div>
            {update.available && (
              <p style={{ fontSize: 11, color: '#3F9E7E', margin: '8px 0 0 0' }}>
                Nova versão disponível com correções e melhorias.
              </p>
            )}
            <Link
              to="/faq"
              className="dosy-press"
              style={{
                marginTop: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--dosy-bg-sunken)',
                borderRadius: 12,
                textDecoration: 'none',
                color: 'var(--dosy-fg)',
                fontFamily: 'var(--dosy-font-body)',
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600,
              }}>
                <HelpCircle size={14} strokeWidth={1.75}/> Dúvidas frequentes
              </span>
              <ChevronRight size={14} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)' }}/>
            </Link>
          </Card>
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

function Row({ icon: IconCmp, label, hint, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {IconCmp && <IconCmp size={16} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-secondary)' }}/>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--dosy-fg)', margin: 0 }}>{label}</p>
          {hint && <p style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', margin: '2px 0 0 0' }}>{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}
