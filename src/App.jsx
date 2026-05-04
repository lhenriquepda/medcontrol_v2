import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
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
import { useAdMobBanner } from './hooks/useAdMobBanner'
import { usePushNotifications } from './hooks/usePushNotifications'
import { useDoses } from './hooks/useDoses'
import { usePatients } from './hooks/usePatients'
import DailySummaryModal from './components/DailySummaryModal'
import PermissionsOnboarding from './components/PermissionsOnboarding'
import OnboardingTour from './components/OnboardingTour'
import UpdateBanner from './components/UpdateBanner'
import LockScreen from './components/LockScreen'
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
  useRealtime()
  useAppResume()
  useAdMobBanner()
  const { locked, biometricAvailable, unlock } = useAppLock()
  const [showSummary, setShowSummary] = useState(false)
  // Tour shows after permissions modal closes (granted OR skipped). Web also shows immediately
  // since web has no special permissions modal.
  const [permsDone, setPermsDone] = useState(() => !Capacitor.isNativePlatform())

  // Reset scroll para topo ao navegar entre rotas. Sem isso, navegar pra
  // /pacientes mantém scroll da rota anterior — botão "+ Novo" no topo
  // ficava escondido sob header quando user vinha de tela com scroll.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

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
  const alarmWindow = useMemo(() => {
    const now = new Date(hourTick * 3600_000)
    const past = new Date(now); past.setDate(past.getDate() - 1)
    const future = new Date(now); future.setDate(future.getDate() + 14)
    return { from: past.toISOString(), to: future.toISOString() }
  }, [hourTick])
  const { data: allDoses = [] } = useDoses(alarmWindow)
  const { data: allPatients = [] } = usePatients()
  useEffect(() => {
    if (!user) return
    scheduleDoses(allDoses, { patients: allPatients })
  }, [user, allDoses, allPatients, scheduleDoses])

  // ─── Notification tap handlers (LocalNotifications + FCM) ─────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return
    let localTapHandle, pushTapHandle, pushFgHandle

    const setupListeners = async () => {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const { PushNotifications } = await import('@capacitor/push-notifications')

      // Helper: route based on notification extra/data
      const handleTap = (extra) => {
        if (!extra) return
        if (extra.type === 'dailySummary') {
          setShowSummary(true)
          if (location.pathname !== '/') navigate('/')
        } else if (extra.doseIds) {
          // Grouped (multi) — open queue
          navigate(`/?doses=${extra.doseIds}`)
        } else if (extra.doseId) {
          // Single (legacy or single-dose group)
          navigate(`/?dose=${extra.doseId}`)
        }
      }

      // LocalNotifications tap (alarmes agendados — doses + resumo)
      localTapHandle = await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        console.log('[LocalNotif] tap:', action?.notification?.extra)
        handleTap(action?.notification?.extra)
      })

      // FCM push tap (server-side push)
      pushTapHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[FCM] tap:', action?.notification?.data)
        const data = action?.notification?.data
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
      })
    }
    setupListeners()
    return () => {
      localTapHandle?.remove?.()
      pushTapHandle?.remove?.()
      pushFgHandle?.remove?.()
    }
  }, [user, navigate, location.pathname])

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
    window.addEventListener('dosy:openDose', onOpenDose)
    window.addEventListener('dosy:openDoses', onOpenDoses)
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
    return () => {
      window.removeEventListener('dosy:openDose', onOpenDose)
      window.removeEventListener('dosy:openDoses', onOpenDoses)
    }
  }, [user, navigate])

  // Android hardware back button: history back if possible, else exit app
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let listenerHandle
    const setup = async () => {
      listenerHandle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack && location.pathname !== '/') {
          navigate(-1)
        } else {
          CapacitorApp.exitApp()
        }
      })
    }
    setup()
    return () => { listenerHandle?.remove() }
  }, [location.pathname, navigate])

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
    </>
  )
}
