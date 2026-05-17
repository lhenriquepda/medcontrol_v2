import { lazy, Suspense, useEffect, useMemo, useState, useRef } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import AppHeader from './components/dosy/AppHeader'
import BottomNav from './components/dosy/BottomNav'
// Aud 4.5.5 G1: route-level code splitting com React.lazy.
// Pages carregam sob demanda — bundle main reduz, time-to-interactive cai em rotas leves.
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Patients = lazy(() => import('./pages/Patients'))
const PatientForm = lazy(() => import('./pages/PatientForm'))
const PatientDetail = lazy(() => import('./pages/PatientDetail'))
const TreatmentForm = lazy(() => import('./pages/TreatmentForm'))
const TreatmentList = lazy(() => import('./pages/TreatmentList'))
const SOS = lazy(() => import('./pages/SOS'))
const More = lazy(() => import('./pages/More'))
const Analytics = lazy(() => import('./pages/Analytics'))
const DoseHistory = lazy(() => import('./pages/DoseHistory'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Admin = lazy(() => import('./pages/Admin'))
const Privacidade = lazy(() => import('./pages/Privacidade'))
const Termos = lazy(() => import('./pages/Termos'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Install = lazy(() => import('./pages/Install'))
const FAQ = lazy(() => import('./pages/FAQ'))
import { useAuth } from './hooks/useAuth'
import { useRealtime } from './hooks/useRealtime'
import { useAppResume } from './hooks/useAppResume'
import { useInAppReview, incrementReviewSignal } from './hooks/useInAppReview'
import { track, EVENTS } from './services/analytics'
import { useAdMobBanner } from './hooks/useAdMobBanner'
// #223 v0.2.3.0 — inline import (substitui usePushNotifications deprecated re-export)
import { useNotifications as usePushNotifications } from './services/notifications'
import { useDoses } from './hooks/useDoses'
import { usePatients } from './hooks/usePatients'
import DailySummaryModal from './components/DailySummaryModal'
import PermissionsOnboarding from './components/PermissionsOnboarding'
import OnboardingTour from './components/OnboardingTour'
import UpdateBanner from './components/UpdateBanner'
import OfflineBanner from './components/OfflineBanner'
import LockScreen from './components/LockScreen'
import ForceNewPasswordModal from './components/ForceNewPasswordModal'
import { useAppLock } from './hooks/useAppLock'

// Fallback minimalista enquanto chunk carrega
function PageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-slate-500">Carregando…</div>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  // #157 (v0.2.1.0) — DISABLED. Bug investigation 2026-05-05 found:
  //   1. publication `supabase_realtime` empty (NO postgres_changes events delivered)
  //   2. useRealtime reconnect cascade burns ~13 req/s storm sustained idle hidden
  //      tab (server logs: ChannelRateLimitReached + Stop tenant cycles)
  //   3. onStatusChange backoff 1-2s × refetchQueries({type:'active'}) loop
  //      generates ~5GB/h egress per idle user (extrapolated)
  // Net: zero functional value (publication empty) + catastrophic egress cost.
  // Re-enable plan v0.2.2.0+: populate publication via Studio → Database → Replication
  // → supabase_realtime toggle tables (medcontrol.doses/patients/treatments/etc) +
  // verify reconnect logic doesn't storm under empty channel state.
  // useRealtime()
  useAppResume()
  useAdMobBanner()
  // #170 (v0.2.1.3) — In-App Review smart prompt trigger.
  // Hook agenda check 30s pós mount + verifica conditions
  // (≥7d install + ≥3 doses confirmed + ≥1 alarm fired + active <24h).
  useInAppReview()
  const { locked, biometricAvailable, unlock } = useAppLock()
  const [showSummary, setShowSummary] = useState(false)
  // Tour shows after permissions modal closes (granted OR skipped). Web also shows immediately
  // since web has no special permissions modal.
  const [permsDone, setPermsDone] = useState(() => !Capacitor.isNativePlatform())
  // #153 (v0.2.0.12) — força modal nova senha pós verifyRecoveryOtp.
  // BUG fix: useState init lazy só roda 1x no mount. App monta no BOOT antes
  // do user logar via OTP; flag setada DEPOIS do mount não dispara reload.
  // Solução: useEffect monitora user + checa flag a cada SIGNED_IN/sessão nova.
  const [forcePassword, setForcePassword] = useState(false)
  useEffect(() => {
    if (!user) return
    try {
      if (localStorage.getItem('dosy_force_password_change') === '1') {
        setForcePassword(true)
      }
    } catch { /* ignore */ }
  }, [user])

  // Reset scroll para topo ao navegar entre rotas. Sem isso, navegar pra
  // /pacientes mantém scroll da rota anterior — botão "+ Novo" no topo
  // ficava escondido sob header quando user vinha de tela com scroll.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // v0.2.3.9 P3 — pathname ref atualizado pra closures de listeners persistentes
  // (notif tap + back button). Evita rebind dos listeners a cada navegação.
  const pathnameRef = useRef(location.pathname)
  useEffect(() => { pathnameRef.current = location.pathname }, [location.pathname])

  // Auto-prompt notif permissions on first login (once per user per device)
  // Note: subscribe activates LOCAL CriticalAlarm + LocalNotifications scheduling.
  // FCM register happens inside but server-side push is suppressed (no foreground
  // redisplay, see pushNotificationReceived listener below).
  const { subscribe, isNative, supported, scheduleDoses } = usePushNotifications()
  useEffect(() => {
    if (!user || !supported) return
    const key = `dosy_push_asked_${user.id}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    subscribe(0).catch((e) => {
      console.log('[Auto-subscribe] skipped:', e?.message)
    })
  }, [user, supported, subscribe])

  // ─── App-level alarm reschedule ───────────────────────────────────────
  // Re-runs rescheduleAll whenever doses or patients change. Mark/skip/undo
  // a dose → query invalidates → effect re-fires → alarmes recalculados,
  // doses não-pending excluídas. Cobre caso onde Dashboard não está montada
  // (modal aberto direto via notif) e garante alarmes sempre sincronizados.
  //
  // #092 (release v0.1.7.5): janela explícita -1d / +14d. AlarmManager nativo
  // só agenda doses futuras (~72h FCM cron horizon). Antes useDoses() sem
  // filter pulls 7000+ rows histórico — egress nuke. Janela 14d cobre buffer
  // FCM + safe margin pra AlarmScheduler. Past 1d cobre dose recém-marcada
  // que ainda invalidate em loop.
  // Memoizado por hour-tick: queryKey estável dentro da hora corrente.
  // Janela "+14d" muda a cada hora pra avançar conforme tempo passa
  // (sem isso, app aberto 24h teria janela rolando antiga).
  const [hourTick, setHourTick] = useState(() => Math.floor(Date.now() / 3600_000))
  useEffect(() => {
    const t = setInterval(() => setHourTick(Math.floor(Date.now() / 3600_000)), 3600_000)
    return () => clearInterval(t)
  }, [])
  // v0.2.3.7 #272 (F1 perf audit 2026-05-15) — revertido pra -1d/+14d original (#092).
  //
  // Histórico:
  //   v0.1.7.5 #092: janela -1d/+14d ("AlarmScheduler nativo só agenda doses futuras
  //     ~72h FCM cron horizon. 14d cobre buffer FCM + safe margin").
  //   v0.2.3.1 Bloco 7 A-04: expandido pra -30d/+60d ("unificar com Dashboard cache
  //     compartilhado, evitar 2 round-trips DB + 2x refetch por mutation").
  //   v0.2.3.4 #163: Dashboard migrou useDoses → useDashboardPayload (RPC consolidado).
  //     Dashboard parou de usar queryKey ['doses', alarmWindow]. Cache "compartilhado"
  //     não compartilha com ninguém — App.jsx é único consumidor.
  //
  // Razão revert: cache 90 dias era peso morto (~2160 doses × 500 bytes ≈ 1MB só essa
  // query) que IDB persist serializa 80-200ms blocking main thread cada mutation. Janela
  // -1d/+14d cobre o que AlarmScheduler nativo realmente precisa (FCM horizon 72h + buffer).
  // Detalhe: contexto/auditoria/2026-05-15-perf-audit-device-slow.md §8 F1.
  const alarmWindow = useMemo(() => {
    const now = new Date(hourTick * 3600_000)
    const past = new Date(now); past.setDate(past.getDate() - 1)
    const future = new Date(now); future.setDate(future.getDate() + 14)
    return { from: past.toISOString(), to: future.toISOString() }
  }, [hourTick])
  const { data: allDoses = [], isSuccess: dosesLoaded } = useDoses(alarmWindow)
  const { data: allPatients = [], isSuccess: patientsLoaded } = usePatients()

  // Item #198 (release v0.2.1.5) — detectar install/upgrade fresco. AlarmManager
  // é limpo a cada reinstalação Android, alarmes locais agendados perdidos.
  // Se versionCode mudou desde último boot, log warning + força rescheduleAll
  // assim que doses carregarem (evita janela 6h até cron schedule-alarms-fcm).
  //
  // Comparado a localStorage.dosy_last_known_vc — diff = upgrade detectado.
  // Reschedule é coberto pelo useEffect abaixo (que dispara em allDoses change),
  // este efeito só faz logging + atualiza flag pra próximo boot.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cancelled = false
    ;(async () => {
      try {
        const info = await CapacitorApp.getInfo()
        if (cancelled) return
        const currentVc = String(info?.build || '')
        const lastVc = localStorage.getItem('dosy_last_known_vc') || null
        if (lastVc !== currentVc) {
          console.warn('[App #198] install/upgrade detectado:', lastVc || '(primeira execução)', '→', currentVc, '— rescheduleAll será forçado quando doses carregarem')
          try { localStorage.setItem('dosy_last_known_vc', currentVc) } catch { /* ignore */ }
        }
      } catch (e) {
        console.warn('[App #198] App.getInfo falhou:', e?.message)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // v0.2.3.9 P6 — signature simplificada via length + XOR hash. Antes:
  // map+sort+join O(N log N) sobre todos os ids. Agora hash linear O(N)
  // sem alocação intermediária. Mesma propriedade: muda quando algum id/
  // status/scheduledAt muda; estável quando nada relevante mudou.
  const dosesSignature = useMemo(() => {
    if (!dosesLoaded) return ''
    const arr = allDoses || []
    if (arr.length === 0) return '0:0'
    // Hash rolling sem sort. Cada dose contribui via FNV-1a-style mixing.
    // status convertido a int (pending=1, done=2, skipped=3, overdue=4, cancelled=5, outros=0)
    // scheduledAt convertido a timestamp ms.
    const statusInt = { pending: 1, done: 2, skipped: 3, overdue: 4, cancelled: 5 }
    let hash = 2166136261 // FNV offset
    for (let i = 0; i < arr.length; i++) {
      const d = arr[i]
      // Mix id (string hash via charCode sum), status int, scheduledAt ms
      const idStr = String(d.id || '')
      let idH = 0
      for (let j = 0; j < idStr.length; j++) idH = (idH * 31 + idStr.charCodeAt(j)) | 0
      const sInt = statusInt[d.status] || 0
      const tMs = d.scheduledAt ? Date.parse(d.scheduledAt) : 0
      hash ^= idH; hash = Math.imul(hash, 16777619)
      hash ^= sInt; hash = Math.imul(hash, 16777619)
      hash ^= tMs; hash = Math.imul(hash, 16777619)
    }
    return `${arr.length}:${hash}`
  }, [allDoses, dosesLoaded])

  const patientsSignature = useMemo(() => {
    if (!patientsLoaded) return ''
    return (allPatients || [])
      .map(p => `${p.id}:${p.name || ''}`)
      .sort()
      .join('|')
  }, [allPatients, patientsLoaded])

  useEffect(() => {
    if (!user) return
    // Item #198 (release v0.2.1.5) — só agendar quando doses + patients
    // realmente carregaram do server (TanStack isSuccess). Antes, useEffect
    // disparava com array vazio durante login/boot → rescheduleAll.cancelAll()
    // zerava AlarmManager, depois reagendava 200-2000ms depois quando query
    // terminava. Window vazio + risco AlarmManager fica zerado se app fecha
    // entre cancel e reschedule.
    if (!dosesLoaded || !patientsLoaded) return
    // v0.2.2.2 — deps via signatures ao invés de refs. signature muda só
    // se algum dose.status/scheduledAt mudou (interação real, cron, edit).
    scheduleDoses(allDoses, { patients: allPatients })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dosesSignature, patientsSignature, dosesLoaded, patientsLoaded, scheduleDoses])

  // ─── Notification tap handlers (LocalNotifications + FCM) ─────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return
    let localTapHandle, pushTapHandle, pushFgHandle, localFireHandle

    const setupListeners = async () => {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const { PushNotifications } = await import('@capacitor/push-notifications')

      // Helper: route based on notification extra/data
      const handleTap = (extra) => {
        if (!extra) return
        if (extra.type === 'dailySummary') {
          setShowSummary(true)
          if (pathnameRef.current !== '/') navigate('/')
        } else if (extra.doseIds) {
          // Grouped (multi) — open queue
          navigate(`/?doses=${extra.doseIds}`)
        } else if (extra.doseId) {
          // Single (legacy or single-dose group)
          navigate(`/?dose=${extra.doseId}`)
        }
      }

      // LocalNotifications received (fire — apenas quando app foreground;
      // background fire não dispara este listener no Capacitor). #007 telemetria.
      localFireHandle = await LocalNotifications.addListener('localNotificationReceived', (notif) => {
        track(EVENTS.NOTIFICATION_DELIVERED, {
          kind: 'local_foreground',
          type: notif?.extra?.type,
          hasDoseId: Boolean(notif?.extra?.doseId || notif?.extra?.doseIds)
        })
        // #170 (v0.2.1.3) — alarm validated signal pra in-app review trigger
        if (notif?.extra?.doseId || notif?.extra?.doseIds) {
          incrementReviewSignal('alarm_fired')
        }
      })

      // LocalNotifications tap (alarmes agendados — doses + resumo)
      localTapHandle = await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        console.log('[LocalNotif] tap:', action?.notification?.extra)
        // #007 telemetria: user tocou notif local (resposta ativa). PII strip auto via sanitize_properties.
        track(EVENTS.NOTIFICATION_TAPPED, {
          kind: 'local',
          actionId: action?.actionId || 'tap',
          type: action?.notification?.extra?.type
        })
        handleTap(action?.notification?.extra)
      })

      // FCM push tap (server-side push)
      pushTapHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[FCM] tap:', action?.notification?.data)
        const data = action?.notification?.data
        // #007 telemetria: user tocou notif FCM background (delivered + tapped).
        track(EVENTS.NOTIFICATION_TAPPED, {
          kind: 'push',
          actionId: action?.actionId || 'tap',
          type: data?.type
        })
        if (data) {
          handleTap({
            type: data.type,
            doseId: data.doseId,
            doseIds: data.doseIds
          })
        }
      })

      // FCM push received — DO NOT re-display via LocalNotifications.
      // Local CriticalAlarm is the single source of truth for dose alerts.
      // FCM redisplay would cause duplicate sound + tray entries.
      pushFgHandle = await PushNotifications.addListener('pushNotificationReceived', (notif) => {
        console.log('[FCM] foreground received (suppressed redisplay):', notif?.data)
        // #007 telemetria CRÍTICA healthcare: confirma chegada FCM foreground.
        // Background delivery NÃO captura aqui (Android suspende JS) — fica
        // dependente Edge `notify-doses` server-side delivery report (out of scope JS).
        track(EVENTS.NOTIFICATION_DELIVERED, {
          kind: 'push_foreground',
          type: notif?.data?.type,
          hasDoseId: Boolean(notif?.data?.doseId || notif?.data?.doseIds)
        })
      })
    }
    setupListeners()
    return () => {
      localTapHandle?.remove?.()
      pushTapHandle?.remove?.()
      pushFgHandle?.remove?.()
      localFireHandle?.remove?.()
    }
    // v0.2.3.9 P3 — removido location.pathname dos deps; pathnameRef cobre via closure
  }, [user, navigate])

  // ─── Open DoseModal quando user toca notif persistente do alarme ──────
  useEffect(() => {
    if (!user) return
    const onOpenDose = (e) => {
      const { doseId } = e.detail || {}
      if (!doseId) return
      console.log('[dosy:openDose]', doseId)
      if (window.__dosyLastDoseId === doseId) return
      window.__dosyLastDoseId = doseId
      navigate(`/?dose=${doseId}`)
    }
    const onOpenDoses = (e) => {
      const { doseIds } = e.detail || {}
      if (!doseIds) return
      console.log('[dosy:openDoses]', doseIds)
      // Track last processed to dedupe retry dispatches from MainActivity
      if (window.__dosyLastDoseIds === doseIds) return
      window.__dosyLastDoseIds = doseIds
      navigate(`/?doses=${doseIds}`)
    }
    // v0.2.3.7 Bug B fix — FCM share notification tap navigation.
    // MainActivity.handleAlarmAction reads data.patientId from share FCM tap
    // intent extras → posts this event → navigate to patient detail.
    const onOpenPatient = (e) => {
      const { patientId } = e.detail || {}
      if (!patientId) return
      console.log('[dosy:openPatient]', patientId)
      if (window.__dosyLastPatientId === patientId) return
      window.__dosyLastPatientId = patientId
      navigate(`/pacientes/${patientId}`)
    }
    window.addEventListener('dosy:openDose', onOpenDose)
    window.addEventListener('dosy:openDoses', onOpenDoses)
    window.addEventListener('dosy:openPatient', onOpenPatient)
    // Process any pending IDs set by MainActivity before listener was bound (cold start)
    if (window.__dosyPendingDoseIds) {
      const ids = window.__dosyPendingDoseIds
      window.__dosyPendingDoseIds = null
      onOpenDoses({ detail: { doseIds: ids } })
    }
    if (window.__dosyPendingDoseId) {
      const id = window.__dosyPendingDoseId
      window.__dosyPendingDoseId = null
      onOpenDose({ detail: { doseId: id } })
    }
    if (window.__dosyPendingPatientId) {
      const id = window.__dosyPendingPatientId
      window.__dosyPendingPatientId = null
      onOpenPatient({ detail: { patientId: id } })
    }
    return () => {
      window.removeEventListener('dosy:openDose', onOpenDose)
      window.removeEventListener('dosy:openDoses', onOpenDoses)
      window.removeEventListener('dosy:openPatient', onOpenPatient)
    }
  }, [user, navigate])

  // Android hardware back button: history back if possible, else exit app
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let listenerHandle
    const setup = async () => {
      listenerHandle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack && pathnameRef.current !== '/') {
          navigate(-1)
        } else {
          CapacitorApp.exitApp()
        }
      })
    }
    setup()
    return () => { listenerHandle?.remove() }
    // v0.2.3.9 P3 — pathnameRef cobre via closure; listener registra 1× só
  }, [navigate])

  // Deep link callbacks (Capacitor):
  //   - dosy://auth/callback?code=...  (OAuth — Google/Facebook future)
  //   - dosy://reset-password?code=... (password recovery email link)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let urlHandle
    const setup = async () => {
      urlHandle = await CapacitorApp.addListener('appUrlOpen', async (event) => {
        const url = event?.url || ''
        const isAuthCb = url.includes('auth/callback')
        const isReset = url.includes('reset-password')
        if (!isAuthCb && !isReset) return
        try {
          // Close in-app browser if open
          const { Browser } = await import('@capacitor/browser')
          await Browser.close().catch(() => {})

          // Exchange code for session (PKCE)
          const u = new URL(url)
          const code = u.searchParams.get('code')
          if (code) {
            const { supabase: sb } = await import('./services/supabase')
            const { error } = await sb.auth.exchangeCodeForSession(code)
            if (error) console.error('[DeepLink] exchange error:', error.message)
          }
          // Route to appropriate page
          navigate(isReset ? '/reset-password' : '/', { replace: true })
        } catch (e) {
          console.warn('[DeepLink] handler:', e?.message)
        }
      })
    }
    setup()
    return () => { urlHandle?.remove() }
  }, [navigate])

  if (locked) {
    return <LockScreen unlock={unlock} biometricAvailable={biometricAvailable} />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-slate-500">Carregando…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/install" element={<Install />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
    )
  }

  const hideNav = location.pathname.startsWith('/entrar')

  return (
    <>
    <UpdateBanner />
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:bg-brand-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:font-semibold"
    >
      Pular para o conteúdo
    </a>
    <AppHeader />
    <main id="main-content" className="min-h-screen">
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pacientes" element={<Patients />} />
          <Route path="/pacientes/novo" element={<PatientForm />} />
          <Route path="/pacientes/:id" element={<PatientDetail />} />
          <Route path="/pacientes/:id/editar" element={<PatientForm />} />
          <Route path="/tratamento/novo" element={<TreatmentForm />} />
          <Route path="/tratamento/:id" element={<TreatmentForm />} />
          <Route path="/tratamentos" element={<TreatmentList />} />
          <Route path="/sos" element={<SOS />} />
          <Route path="/mais" element={<More />} />
          <Route path="/historico" element={<DoseHistory />} />
          <Route path="/relatorios-analise" element={<Analytics />} />
          <Route path="/relatorios" element={<Reports />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/install" element={<Install />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!hideNav && <BottomNav />}
    </main>
    <DailySummaryModal open={showSummary} onClose={() => setShowSummary(false)} />
    <PermissionsOnboarding
      onComplete={() => setPermsDone(true)}
      onClose={() => setPermsDone(true)}
    />
    <OnboardingTour enabled={permsDone} />
    {/* #153 (v0.2.0.12) — força nova senha pós recovery OTP */}
    <ForceNewPasswordModal
      open={forcePassword}
      onComplete={() => setForcePassword(false)}
    />
    {/* #204 (v0.2.1.7) — feedback visual fila offline + drain pós-reconexão */}
    <OfflineBanner />
    </>
  )
}
