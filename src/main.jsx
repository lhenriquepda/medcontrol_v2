import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, onlineManager } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
// v0.2.3.4 #165 — IndexedDB persister via idb-keyval (async, sem limit ~5MB localStorage)
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
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
//
// v0.2.6.1 P0.3 (Roteiro_Alinhamento_Dosy_v2): strip exhaustivo — antes só 4 campos
// (event.user.email/username/ip + event.request.data), agora cobre user/request/
// contexts/extra/tags/breadcrumbs (data + message regex). 23 campos sensíveis
// healthcare BR (name/email/medName/patientName/observation/condition/allergies/
// doctor/insurance/phone/emergency/weight/height/blood_type/access_token/
// refresh_token/jwt/apiKey/password/service_role/anon_key).
//
// v0.2.6.1 P1.11: tracesSampleRate 0 → 0.1 em prod habilita performance monitoring
// (10% sampling cabe Sentry Free tier 10k transactions/mês).
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

const SENTRY_SENSITIVE_FIELDS = [
  // PII básica
  'name', 'email', 'username', 'ip_address', 'phone',
  // Healthcare PII (LGPD categoria especial)
  'condition', 'allergies', 'doctor', 'insurance', 'insurance_card',
  'emergency_contact', 'emergency_phone',
  'weight', 'height', 'blood_type',
  // Dados clínicos / cadastro
  'medname', 'patientname', 'observation',
  // Tokens / secrets
  'access_token', 'refresh_token', 'jwt', 'apikey', 'api_key',
  'password', 'service_role', 'anon_key',
]

function stripPII(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return obj
  // Arrays — itera elementos
  if (Array.isArray(obj)) {
    obj.forEach((v) => {
      if (v && typeof v === 'object') stripPII(v, depth + 1)
    })
    return obj
  }
  for (const key of Object.keys(obj)) {
    const lower = key.toLowerCase()
    if (SENTRY_SENSITIVE_FIELDS.some((f) => lower.includes(f))) {
      obj[key] = '[REDACTED]'
    } else if (obj[key] && typeof obj[key] === 'object') {
      stripPII(obj[key], depth + 1)
    }
  }
  return obj
}

function redactBreadcrumbMessage(msg) {
  if (!msg || typeof msg !== 'string') return msg
  let out = msg
  // Redact JWT-like patterns
  out = out.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT_REDACTED]')
  // Redact email-like patterns
  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
  // Redact UUID v4-like (potencial user_id leak em URLs/logs)
  out = out.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[UUID]')
  return out
}

// v0.2.6.1 P8.2 (Roteiro §P8) — critical operations oversampling
// Lista de RPCs/transactions healthcare-críticas que sempre coletam (independente sample rate).
const SENTRY_CRITICAL_OPS = [
  'confirm_dose', 'skip_dose', 'undo_dose',
  'register_sos_dose', 'create_treatment_with_doses',
  'confirm_dose_v2', 'skip_dose_v2', 'undo_dose_v2',
]

// v0.2.6.1 P8.9 (Roteiro §P8) — known errors silenciados (não-fatais conhecidos)
const SENTRY_KNOWN_NOISE = [
  'Network request failed', 'NetworkError', 'Load failed', 'Failed to fetch',
  'AbortError', 'The operation was aborted',
]

// v0.2.6.1 P8.2 — rate limit per-user 10 events/dia (anti single-bug-recorrente-estoura-quota)
function sentryRateLimitCheck(userId) {
  if (!userId || typeof sessionStorage === 'undefined') return true
  try {
    const key = `sentry_rate_${userId}_${new Date().toISOString().slice(0, 10)}`
    const count = parseInt(sessionStorage.getItem(key) || '0', 10)
    if (count >= 10) return false
    sessionStorage.setItem(key, String(count + 1))
    return true
  } catch {
    return true
  }
}

// v0.2.6.1 P8.9 — fingerprint dedup: 100% primeiro do dia, 1% repetições mesma fingerprint
function sentryFingerprintSample(fingerprintKey) {
  if (typeof sessionStorage === 'undefined') return true
  try {
    const fpKey = `sentry_fp_${fingerprintKey}_${new Date().toISOString().slice(0, 10)}`
    const seen = parseInt(sessionStorage.getItem(fpKey) || '0', 10)
    if (seen >= 1 && Math.random() > 0.01) return false
    sessionStorage.setItem(fpKey, String(seen + 1))
    return true
  } catch {
    return true
  }
}

if (SENTRY_DSN && import.meta.env.PROD) {
  const sentryConfig = {
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Auditoria 4.5.7 G3 — release tag pra correlacionar crashes com versão
    release: `dosy@${__APP_VERSION__}`,
    // v0.2.6.1 P8.2 — 0.005 (0.5%) em prod. Original P1.11 era 0.1, projetado em
    // 300k traces/mês × 1000 users (30× free tier). 0.005 = ~15k traces/mês total,
    // cabe free tier. Critical ops (confirm_dose etc) oversampled em beforeSendTransaction.
    tracesSampleRate: 0.005,
    autoSessionTracking: false,
    sendClientReports: false,
    // v0.2.6.1 P8.2 — oversample transactions de RPCs healthcare críticas a 5%
    // (vs sample default 0.5%). Mantém visibilidade do hot path sem estourar quota.
    beforeSendTransaction(transaction) {
      const opName = transaction?.transaction || ''
      if (SENTRY_CRITICAL_OPS.some((op) => opName.includes(op))) {
        // Critical ops: 5% sample (10× a taxa base)
        return Math.random() < 0.05 ? transaction : null
      }
      // Não-críticas: já filtradas pelo tracesSampleRate 0.005 base
      return transaction
    },
    beforeSend(event) {
      // v0.2.6.1 P0.3 — strip exhaustivo PII (healthcare LGPD)
      if (event.user) stripPII(event.user)
      if (event.request) stripPII(event.request)
      if (event.contexts) stripPII(event.contexts)
      if (event.extra) stripPII(event.extra)
      if (event.tags) stripPII(event.tags)
      if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          if (b?.data) stripPII(b.data)
          if (b?.message) b.message = redactBreadcrumbMessage(b.message)
          return b
        })
      }
      if (event.request?.data) delete event.request.data

      // v0.2.6.1 P8.2 — rate limit per-user 10 events/dia
      if (!sentryRateLimitCheck(event.user?.id)) return null

      // v0.2.6.1 P8.9 — skip noise conhecido (network errors transitórios)
      const excValue = event.exception?.values?.[0]?.value || ''
      if (SENTRY_KNOWN_NOISE.some((n) => excValue.includes(n))) return null

      // v0.2.6.6 F8 — visibilidade total pra silent fails healthcare (401/403/409
       // RPC v2). Eventos raros mas críticos: pular rate-limit + dedup pra ter
      // visibilidade prod completa. Sem isso bug crônico "mutation falha silencioso
      // pós-idle" demora pra detectar (sample 1% reduz já-raros eventos pra zero).
      const errorCode = event.tags?.error_code
      const mutationTag = event.tags?.mutation
      const isCriticalAuthError = mutationTag && ['401','403','409'].includes(String(errorCode))
      if (isCriticalAuthError) {
        return event // sem rate-limit, sem fingerprint sample
      }

      // v0.2.6.11 AUTO-VALIDATE B102 — audit events sempre passam, pra confirmar
      // que fix B102 v0.2.6.10 está funcionando em prod sem depender de user
      // reportar manualmente. Tag `is_audit: 'true'` marca esses eventos.
      // Outcome=bug = race ainda existe (alarme). Outcome=ok = fix confirmed
      // (info level — agregação total mostra ratio bug/ok). Remover quando
      // confidence > 99% (estimado 2-3 releases).
      if (event.tags?.is_audit === 'true') {
        return event // sem rate-limit, sem fingerprint sample
      }

      // v0.2.6.1 P8.9 — fingerprint dedup: agrupa erros similares + amostra 1% repetições
      if (event.exception?.values?.[0]) {
        const exc = event.exception.values[0]
        const lastFrame = exc.stacktrace?.frames?.slice(-1)[0]
        event.fingerprint = [
          exc.type ?? 'UnknownError',
          lastFrame?.function ?? 'unknown',
          // Source file sem version hash (-[hash].js)
          (lastFrame?.filename ?? '').replace(/-[a-f0-9]{8}\./, '.'),
        ]
        const fpKey = event.fingerprint.join(':')
        if (!sentryFingerprintSample(fpKey)) return null
      }

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
      // v0.2.6.7 FIX B102 — retry de mutations healthcare reduzido pra 1.
      // Razão: retry exponential original (3x + backoff 2/4/8s) causava efeito
      // colateral em RPCs v2 que retornam JSONB `{ok:false, code:409}` (não throws
      // de network). DoseConflictError throws sintético dispara retry policy do
      // TanStack mesmo sendo 409 lógico → estado cache fica em "loading" 14s+ e
      // user fecha modal antes onSettled rodar. Com retry:1, mutation resolve
      // rápido (ok ou error) e estado se estabiliza.
      retry: 1,
      retryDelay: 1000,
    }
  }
})

// Item #204 — registra mutationFn + callbacks por chave (mutationRegistry).
// Crítico: precisa rodar ANTES da hydrate do PersistQueryClientProvider, senão
// resumePausedMutations não acha mutationFn e descarta mutations persistidas.
// v0.2.3.12 NB-4 — registerMutationDefaults movido pra DEPOIS da persister creation
// (linha ~161 abaixo) pra passar persister como segundo arg. Healthcare critical
// mutations chamam flushPersistImmediate(persister) em onMutate, garantindo persist
// IDB ~100ms (era throttle 1s window) entre tap e potential force-kill.

// Item #204 v0.2.1.8 fix-C — bridge connectivity real → TanStack onlineManager.
// Substitui default subscriber TanStack via setEventListener pra Capacitor.Network
// ser ÚNICA fonte de verdade native (default usa window.online/offline events
// que em Capacitor WebView Android disparam erradamente — race condition observada
// logcat 2026-05-10 09:24:38: window.online dispara 7ms ANTES Capacitor confirmar
// avião mode → mutations resumed prematuro + falham + re-pausam).
//
// Web: mantém default TanStack (navigator.onLine + window events — único caminho disponível).
if (Capacitor.isNativePlatform()) {
  onlineManager.setEventListener((setOnline) => {
    let listenerHandle = null
    let mounted = true
    ;(async () => {
      try {
        const { Network } = await import('@capacitor/network')
        const status = await Network.getStatus()
        if (mounted) setOnline(status.connected)
        listenerHandle = await Network.addListener('networkStatusChange', (s) => {
          if (mounted) setOnline(s.connected)
        })
      } catch (e) {
        console.warn('[onlineManager bridge] Capacitor Network indisponível:', e?.message)
        // fallback navigator.onLine se plugin falhar
        if (typeof navigator !== 'undefined' && mounted) setOnline(navigator.onLine)
      }
    })()
    return () => {
      mounted = false
      listenerHandle?.remove?.()
    }
  })
}
// Web: TanStack default subscriber já cobre (navigator.onLine + online/offline events).

// Persist React Query cache → fast re-open + offline last-known data.
// v0.2.3.4 #165 — IndexedDB via idb-keyval (async, sem limit ~5MB localStorage).
// Antes: localStorage sync block main thread em write + max ~5MB (quota varia browser).
// Agora: IDB async + suporta GB-scale + write off-main-thread.
// Fallback localStorage se IDB indisponível (Safari private mode raro).
//
// v0.2.3.12 NB-4 — REVERT #275 throttle 5000→1000ms.
// Assumption #275 ("crash-safety preservado pela fila offline") PROVADA ERRADA
// pelo QA Appium v0.2.3.12: mutations críticas (confirmDose) também são throttled
// junto com cache. Force-kill <1s após mark "tomada" perde a dose silenciosamente
// (mutation queue não chegou no IDB antes do kill). Healthcare = data loss inaceitável.
//
// Trade-off: ~5× mais writes IDB (~600KB-1MB cache) vs zero data loss em force-kill.
// IDB writes off-main-thread, custo perf desprezível. Otimização #275 era assumption
// errada — outras melhorias #272-#274 (cache size + memo + signature) já cobrem perf.
const idbAvailable = typeof window !== 'undefined' && 'indexedDB' in window
const persister = idbAvailable
  ? createAsyncStoragePersister({
      storage: {
        getItem: (key) => idbGet(key),
        setItem: (key, value) => idbSet(key, value),
        removeItem: (key) => idbDel(key),
      },
      key: 'dosy-query-cache',
      throttleTime: 1000
    })
  : createSyncStoragePersister({
      storage: typeof window !== 'undefined' ? window.localStorage : null,
      key: 'dosy-query-cache',
      throttleTime: 1000
    })

// v0.2.3.12 NB-4 — registerMutationDefaults precisa do persister pra flushPersistImmediate
// em mutations críticas. Chamado aqui após persister const, antes do render.
registerMutationDefaults(queryClient, persister)

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

// [Fix B v0.2.1.8] Boot bloqueante — pre-mount sync Network.getStatus + setOnline
// pra garantir onlineManager.isOnline() reflete realidade ANTES React mount +
// PersistQueryClientProvider hydrate + resumePausedMutations. Sem isso, mutations
// rehydradas em avião mode tentam executar (1s), falham, re-pausam — burn fetches
// + race condition observada logcat 09:24:22.
async function boot() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Network } = await import('@capacitor/network')
      const status = await Network.getStatus()
      onlineManager.setOnline(status.connected)
    } catch (e) {
      console.warn('[onlineManager] pre-mount fail:', e?.message)
    }
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
          //
          // v0.2.6.3 #0015 — EXCEÇÃO LEGÍTIMA pra bump v1 → v2:
          // Bug fix prévio v0.2.6.2 incluiu DOSE_COLS_LIST com group_id+cmed_class
          // e RPC `get_dashboard_payload` atualizada. PORÉM payloads cached em IDB
          // (key `dosy-query-cache`) ANTES do fix continham doses sem group_id.
          // TanStack hydrate carrega esse cache stale → user vê doses sem
          // categoria mesmo após update do APK. Bump buster força purge único
          // do cache local na primeira abertura da nova versão. Próximo fetch
          // bate no server e popula com group_id presente. Pico egress global
          // aceito (1x) pelo benefício de UX correto pós-update.
          buster: 'v2',
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
}
boot()
