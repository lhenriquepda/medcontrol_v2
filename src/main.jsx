import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, onlineManager } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { Capacitor } from '@capacitor/core'
import * as Sentry from '@sentry/react'
import * as SentryCapacitor from '@sentry/capacitor'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ToastProvider } from './hooks/useToast.jsx'
import { AuthProvider } from './hooks/useAuth.jsx'
import { ThemeProvider } from './hooks/useTheme.jsx'
import { initAnalytics } from './services/analytics'
import { registerMutationDefaults } from './services/mutationRegistry'
import './index.css'

// Aud 4.5.7 G4 — PostHog analytics. No-op se VITE_POSTHOG_KEY ausente ou modo dev.
initAnalytics()

// Sentry — production-only crash + error monitoring.
// LGPD: beforeSend strips PII (emails, names, dose observations).
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
if (SENTRY_DSN && import.meta.env.PROD) {
  const sentryConfig = {
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Auditoria 4.5.7 G3 — release tag pra correlacionar crashes com versão
    release: `dosy@${__APP_VERSION__}`,
    tracesSampleRate: 0,
    // Auto-session tracking gera 1 envelope/pageload → quando ingest devolve 503
    // (rate-limit transitório), CORS error spam no console. Ficamos só com
    // captureException pra erros reais (sem session tracking).
    autoSessionTracking: false,
    sendClientReports: false,
    beforeSend(event) {
      // Strip PII (LGPD: medication data is "categoria especial")
      if (event.user) {
        delete event.user.email
        delete event.user.username
        delete event.user.ip_address
      }
      // Avoid logging request body (may contain medName, patientName, observation)
      if (event.request?.data) delete event.request.data
      return event
    },
    ignoreErrors: [
      'Network request failed',
      'NetworkError',
      'Load failed',
      'Failed to fetch'
    ]
  }
  if (Capacitor.isNativePlatform()) {
    SentryCapacitor.init(sentryConfig, Sentry.init)
  } else {
    Sentry.init(sentryConfig)
  }
}

// Item #075 (release v0.1.7.0) — config menos agressiva pra mitigar lentidão geral.
// Antes: staleTime: 0 + refetchOnMount: 'always' fazia toda nav refetchar todas queries.
// Agora: staleTime 30s + refetchOnMount: true (só se stale) — refetch só quando necessário.
// refetchOnWindowFocus mantido (útil pós-idle curto sem reload).
// Hooks individuais (ex.: useDoses) podem override se precisarem janela menor/maior.
//
// Item #204 (release v0.2.1.7) — networkMode: 'offlineFirst' nos defaults.
//   queries.networkMode='offlineFirst' → serve cache mesmo offline (já era comportamento
//   c/ PersistQueryClientProvider, agora explícito).
//   mutations.networkMode='offlineFirst' → pausa mutation enquanto onlineManager.isOnline()
//   retorna false (em vez de falhar imediato após retry exhaust). resumePausedMutations
//   drena fila quando onlineManager flipa pra true (bridge Capacitor Network abaixo).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 30_000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
      gcTime: 1000 * 60 * 60 * 24 // 24h — survives offline reconnect
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000)
    }
  }
})

// Item #204 — registra mutationFn + callbacks por chave (mutationRegistry).
// Crítico: precisa rodar ANTES da hydrate do PersistQueryClientProvider, senão
// resumePausedMutations não acha mutationFn e descarta mutations persistidas.
registerMutationDefaults(queryClient)

// Item #204 — bridge connectivity real → TanStack onlineManager.
// Native (Capacitor): @capacitor/network detecta wifi-sem-internet, avião mode etc
//   (mais preciso que navigator.onLine no WebView, que costuma reportar true sempre).
// Web: navigator.onLine + window online/offline events (já é o default do TanStack,
//   mas explicitamos pra consistency cross-platform).
;(async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Network } = await import('@capacitor/network')
      const status = await Network.getStatus()
      onlineManager.setOnline(status.connected)
      Network.addListener('networkStatusChange', (s) => {
        onlineManager.setOnline(s.connected)
      })
    } catch (e) {
      console.warn('[onlineManager bridge] Capacitor Network indisponível:', e?.message)
    }
  } else if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    onlineManager.setOnline(navigator.onLine)
    window.addEventListener('online', () => onlineManager.setOnline(true))
    window.addEventListener('offline', () => onlineManager.setOnline(false))
  }
})()

// Persist React Query cache → fast re-open + offline last-known data.
// Native: localStorage (Capacitor WebView storage); Web: localStorage.
const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : null,
  key: 'dosy-query-cache',
  throttleTime: 1000
})

// Native StatusBar overlay config one-time. Style + background color são
// sincronizados dinamicamente pelo ThemeProvider conforme theme light/dark.
if (Capacitor.isNativePlatform()) {
  ;(async () => {
    try {
      const { StatusBar } = await import('@capacitor/status-bar')
      await StatusBar.setOverlaysWebView({ overlay: false })
    } catch {}
  })()

  // Dosy Dev (debug variant `.dev` package): força PrivacyScreen.disable() no
  // boot pra liberar screenshot + screen recording pra captura de assets store /
  // demos / vídeo FGS sem ritual. Plugin community privacy-screen aplica
  // FLAG_SECURE automaticamente no load() nativo (sem precisar hook chamar
  // enable). Precisa cancelar explicitamente.
  // Dosy oficial (release variant): bloco abaixo NÃO roda (id sem .dev) →
  // FLAG_SECURE permanece ativo como sempre.
  ;(async () => {
    try {
      const { App: CapApp } = await import('@capacitor/app')
      const info = await CapApp.getInfo().catch(() => null)
      if (info?.id?.endsWith('.dev')) {
        const { PrivacyScreen } = await import('@capacitor-community/privacy-screen')
        await PrivacyScreen.disable()
      }
    } catch {}
  })()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24, // 24h
          // Item #204: NÃO bumpar buster pra adicionar persist de mutations.
          // TanStack hydrate é tolerante a campo extra `mutations` (legacy v1 sem
          // mutations carrega normal, cache antigo continua válido). Bumpar
          // invalidaria caches de TODOS users existentes 1x na atualização →
          // pico egress global desnecessário (doses+patients+treatments refetch
          // simultâneo). Mantém v1.
          buster: 'v1',
          dehydrateOptions: {
            // Persist mutations pausadas (offline) pra sobreviver a force-kill / reboot.
            // Sem isso, queue offline é perdida quando user fecha app antes reconectar.
            shouldDehydrateMutation: () => true,
          }
        }}
        onSuccess={() => {
          // Hydrate completo — drena fila de mutations pausadas. No-op se nada persistido
          // ou se ainda offline (TanStack mantém pause até onlineManager.isOnline()).
          queryClient.resumePausedMutations()
        }}
      >
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
