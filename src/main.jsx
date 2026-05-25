import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
// v0.2.7.0 Fase 2 — TanStack persist REMOVIDO (Refactor_Sync_v2.md §6.2).
// Princípio P4: cold start sempre fetcha fresh (sem hydrate stale → elimina classe
// inteira de bugs "cache stale sobrescreve fresh"). Doses/patients/treatments agora
// vivem em Zustand stores (src/state/), populados via fetchDashboard().
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
// v0.2.7.0 hardening — expõe queryClient pra módulos non-React invalidarem
// queries (markDose Zustand → invalida TanStack ['doses'] de outras telas).
import { setQueryClient } from './services/queryClientRef'
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

// v0.2.7.0 Fase 2 — persister REMOVIDO. Mutações healthcare migram pra pendingMutationsQueue
// (IDB próprio, sobrevive process kill por design) na Fase 3. Por ora mutationRegistry
// continua existindo (Fase 3 deleta), mas SEM persist — mutations em flight perdidas
// se app killed mid-RPC. Trade-off aceito: Fase 1 já tem authedRpc timeout 10s, hang
// forever zerou. Fase 3 entrega exactly-once via request_id PK em mutation_log.
registerMutationDefaults(queryClient, null)
// v0.2.7.0 hardening — expõe queryClient pra markDose invalidar queries TanStack
// (DoseHistory/Reports/Analytics) após patchDose Zustand.
setQueryClient(queryClient)

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
// pra garantir onlineManager.isOnline() reflete realidade ANTES React mount.
//
// v0.2.7.0 Fase 3 — drena pending mutations queue (IDB) ANTES do mount.
// Mutations persistidas em sessão anterior (process kill mid-RPC) são retomadas
// via idempotência server-side (mutation_log PK request_id). Não-bloqueante:
// fire-and-forget pra não atrasar UI mount.
async function boot() {
  // v0.2.8.0 — migração one-way IDB → @capacitor/preferences (decisão user #5).
  //
  // Por quê: v0.2.7.0 usava idb-keyval (IndexedDB), acessível apenas pela WebView JS.
  // v0.2.8.0 introduz MutationDrainWorker (Java nativo) que precisa ler a queue
  // independente do WebView (drena durante Doze / app killed). SharedPreferences
  // é o storage compartilhado mais simples (plugin @capacitor/preferences).
  //
  // Estratégia one-way: lê IDB legacy uma vez, escreve em Preferences, deleta IDB.
  // Sem fallback de volta pra IDB (decisão explícita user). Próximo boot: no-op
  // (IDB key não existe).
  //
  // Idempotente: se rodar 2× sem entries em IDB, no-op silencioso.
  // Robust: try/catch envolvendo tudo — falha de migração não bloqueia app boot
  // (mutations ficam temporariamente invisíveis pro drain JS mas Worker nativo
  // ainda lê do mesmo SharedPreferences depois).
  try {
    const { get: idbGet, del: idbDel } = await import('idb-keyval')
    const LEGACY_KEY = 'dosy:pending-mutations'
    const oldQueue = await idbGet(LEGACY_KEY)
    if (Array.isArray(oldQueue) && oldQueue.length > 0) {
      const { Preferences } = await import('@capacitor/preferences')
      const NEW_KEY = 'dosy_pending_mutations'
      // Lê Preferences atual (idealmente vazio em primeira execução, mas pode
      // ter algo se v0.2.8.0 instalada e desinstalada — defensive).
      const { value: existingValue } = await Preferences.get({ key: NEW_KEY })
      let existing = []
      try { existing = existingValue ? JSON.parse(existingValue) : [] } catch { existing = [] }
      if (!Array.isArray(existing)) existing = []
      // Dedupe por requestId (IDB entries têm prioridade — vieram primeiro)
      const seenIds = new Set(existing.map(e => e.requestId))
      const merged = [
        ...oldQueue.filter(e => e?.requestId && !seenIds.has(e.requestId)),
        ...existing,
      ]
      await Preferences.set({ key: NEW_KEY, value: JSON.stringify(merged) })
      await idbDel(LEGACY_KEY)
      console.log('[migrate v028] IDB→Preferences:', oldQueue.length, 'entries migradas,', merged.length, 'total')
    }
  } catch (e) {
    console.warn('[migrate v028] IDB→Preferences fail:', e?.message)
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const { Network } = await import('@capacitor/network')
      const status = await Network.getStatus()
      onlineManager.setOnline(status.connected)
    } catch (e) {
      console.warn('[onlineManager] pre-mount fail:', e?.message)
    }
  }

  // v0.2.7.0 hardening — drena pending mutations ANTES do mount React.
  //
  // Cold start latência (WebView pre-warm + TLS handshake + supabase-js init):
  // primeira RPC pode levar 20-30s. Boot drain usa timeout 30s pra cobrir; resume
  // / heartbeat ulteriores usam default 10s. Drain roda em background (não await)
  // pra não atrasar mount React — race condition com fetchDashboard é resolvido
  // pelo currentDrainPromise reutilizável (fetchDashboard aguarda mesma promise).
  //
  // QA real 2026-05-25: cold start drain timeout 10s expirava → banner queue
  // persistente até user reabrir app. timeout 30s + retry loop cobrem.
  try {
    const { drainPendingMutations } = await import('./services/markDose')
    drainPendingMutations({ rpcTimeoutMs: 30_000 }).catch(e =>
      console.warn('[boot] drain fail:', e?.message)
    )
  } catch (e) {
    console.warn('[boot] drain import fail:', e?.message)
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
  )
}
boot()
