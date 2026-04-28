import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import AppHeader from './components/AppHeader'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import PatientForm from './pages/PatientForm'
import PatientDetail from './pages/PatientDetail'
import TreatmentForm from './pages/TreatmentForm'
import TreatmentList from './pages/TreatmentList'
import SOS from './pages/SOS'
import More from './pages/More'
import Analytics from './pages/Analytics'
import DoseHistory from './pages/DoseHistory'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Privacidade from './pages/Privacidade'
import Termos from './pages/Termos'
import ResetPassword from './pages/ResetPassword'
import Install from './pages/Install'
import { useAuth } from './hooks/useAuth'
import { useRealtime } from './hooks/useRealtime'
import { usePushNotifications } from './hooks/usePushNotifications'
import DailySummaryModal from './components/DailySummaryModal'
import PermissionsOnboarding from './components/PermissionsOnboarding'
import OnboardingTour from './components/OnboardingTour'
import UpdateBanner from './components/UpdateBanner'

export default function App() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  useRealtime()
  const [showSummary, setShowSummary] = useState(false)
  // Tour shows after permissions modal closes (granted OR skipped). Web also shows immediately
  // since web has no special permissions modal.
  const [permsDone, setPermsDone] = useState(() => !Capacitor.isNativePlatform())

  // Auto-prompt notif permissions on first login (once per user per device)
  // Note: subscribe activates LOCAL CriticalAlarm + LocalNotifications scheduling.
  // FCM register happens inside but server-side push is suppressed (no foreground
  // redisplay, see pushNotificationReceived listener below).
  const { subscribe, isNative, supported } = usePushNotifications()
  useEffect(() => {
    if (!user || !supported) return
    const key = `dosy_push_asked_${user.id}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    subscribe(0).catch((e) => {
      console.log('[Auto-subscribe] skipped:', e?.message)
    })
  }, [user, supported, subscribe])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-slate-500">Carregando…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/install" element={<Install />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  const hideNav = location.pathname.startsWith('/entrar')

  return (
    <>
    <UpdateBanner />
    <AppHeader />
    <div className="min-h-screen">
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
    <DailySummaryModal open={showSummary} onClose={() => setShowSummary(false)} />
    <PermissionsOnboarding
      onComplete={() => setPermsDone(true)}
      onClose={() => setPermsDone(true)}
    />
    <OnboardingTour enabled={permsDone} />
    </>
  )
}
