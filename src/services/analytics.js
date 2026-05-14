/**
 * analytics.js — wrapper PostHog (Aud 4.5.7 G4).
 * Single source of truth pra eventos custom + feature flags.
 *
 * No-op se VITE_POSTHOG_KEY ausente (dev local sem analytics).
 *
 * LGPD: PII removido em capture (similar ao Sentry beforeSend).
 *   - Não enviar email, name, observation, medName, patientName.
 *   - User identifier: hash do auth.uid() (anônimo).
 *
 * Init: chamar `initAnalytics()` em main.jsx só em PROD.
 * Track: `track('event_name', { prop: value })`.
 * Identify: `identifyUser(userId)` após login (não envia email).
 */

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let posthogInstance = null
let initialized = false

/**
 * Inicializa PostHog. Chamar uma vez em main.jsx em mode=PROD.
 * No-op se key ausente.
 */
export async function initAnalytics() {
  if (initialized) return
  if (!POSTHOG_KEY || !import.meta.env.PROD) return
  // Detecta adblockers que bloqueiam PostHog domains. Skip init (não-fatal).
  if (typeof window !== 'undefined') {
    try {
      const blocked = await fetch(POSTHOG_HOST + '/decide/', { method: 'HEAD', mode: 'no-cors' })
        .then(() => false)
        .catch(() => true)
      if (blocked) {
        console.warn('[analytics] PostHog endpoint blocked (adblocker?). Skipping init.')
        return
      }
    } catch {
      // Falha de rede silenciosa
      return
    }
  }
  try {
    const mod = await import('posthog-js')
    const posthog = mod.default || mod.posthog
    if (!posthog || typeof posthog.init !== 'function') {
      console.warn('[analytics] posthog-js loaded malformed, skipping')
      return
    }
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // LGPD — strip PII em propriedades de evento
      sanitize_properties: (props) => {
        const sanitized = { ...props }
        const piiFields = ['email', 'name', 'observation', 'medName', 'patientName', 'doctor', 'allergies', 'condition']
        for (const f of piiFields) delete sanitized[f]
        return sanitized
      },
      // Não capturar texto de inputs/textareas (LGPD)
      mask_all_text: false,
      mask_all_element_attributes: false,
      // Session replay desabilitado por padrão (privacidade saúde)
      disable_session_recording: true,
      // Capture pageviews automáticas
      capture_pageview: 'history_change',
      // Persistência local
      persistence: 'localStorage+cookie',
    })
    posthogInstance = posthog
    initialized = true
  } catch (e) {
    console.warn('[analytics] init failed:', e?.message)
  }
}

/**
 * Identifica usuário logado (sem PII — apenas user.id).
 * Chamar após login, antes de events específicos do user.
 */
export function identifyUser(userId) {
  if (!posthogInstance || !userId) return
  try {
    posthogInstance.identify(userId)
  } catch (e) {
    console.warn('[analytics] identify failed:', e?.message)
  }
}

/**
 * Reseta identidade (chamar em logout).
 */
export function resetUser() {
  if (!posthogInstance) return
  try {
    posthogInstance.reset()
  } catch {}
}

/**
 * Captura evento custom.
 * @param {string} event — nome do evento (snake_case, ex: 'dose_confirmed')
 * @param {Object} [props] — propriedades. PII será stripped automaticamente.
 */
export function track(event, props = {}) {
  if (!posthogInstance) return
  try {
    posthogInstance.capture(event, props)
  } catch (e) {
    // Silencioso — analytics nunca quebra fluxo principal
  }
}

/**
 * Verifica feature flag (retorna boolean ou variant string).
 * Default `false` se PostHog não inicializado.
 */
export function getFeatureFlag(name, defaultValue = false) {
  if (!posthogInstance) return defaultValue
  try {
    const value = posthogInstance.getFeatureFlag(name)
    return value === undefined ? defaultValue : value
  } catch {
    return defaultValue
  }
}

/**
 * Eventos catalog — referência centralizada pra evitar typos.
 * Use: track(EVENTS.DOSE_CONFIRMED, { trigger: 'card_swipe' })
 */
export const EVENTS = {
  // Doses
  DOSE_CONFIRMED: 'dose_confirmed',
  DOSE_SKIPPED: 'dose_skipped',
  DOSE_UNDONE: 'dose_undone',

  // Notifications (push + local) — #007 telemetria delivery healthcare crítico
  NOTIFICATION_DELIVERED: 'notification_delivered', // FCM foreground OR LocalNotif fire
  NOTIFICATION_TAPPED: 'notification_tapped',       // user tap (push OR local)

  // Permissions
  NOTIF_PERM_GRANTED: 'notification_permission_granted',
  NOTIF_PERM_DENIED: 'notification_permission_denied',
  CRITICAL_ALARM_TOGGLED: 'critical_alarm_toggled',
  DND_TOGGLED: 'dnd_toggled',

  // Paywall
  PAYWALL_SHOWN: 'paywall_shown',
  PAYWALL_CLICKED_PLAN: 'paywall_clicked_plan',
  UPGRADE_CHECKOUT_STARTED: 'upgrade_checkout_started',
  UPGRADE_COMPLETE: 'upgrade_complete',
  UPGRADE_FAILED: 'upgrade_failed',
  RESTORE_PURCHASES_CLICKED: 'restore_purchases_clicked',

  // CRUD
  PATIENT_CREATED: 'patient_created',
  PATIENT_DELETED: 'patient_deleted',
  TREATMENT_CREATED: 'treatment_created',
  TREATMENT_DELETED: 'treatment_deleted',
  SOS_DOSE_REGISTERED: 'sos_dose_registered',

  // Sharing
  SHARE_INVITE_SENT: 'share_patient_invite_sent',
  SHARE_INVITE_ACCEPTED: 'share_patient_invite_accepted',

  // Account
  ACCOUNT_DELETED: 'account_deleted',
  DATA_EXPORTED: 'data_exported',

  // App
  ONBOARDING_TOUR_COMPLETED: 'onboarding_tour_completed',
  ONBOARDING_TOUR_SKIPPED: 'onboarding_tour_skipped',
  UPDATE_BANNER_CLICKED: 'update_banner_clicked',
  UPDATE_BANNER_DISMISSED: 'update_banner_dismissed',

  // FAQ (FASE 18.5)
  FAQ_OPENED: 'faq_opened',
  FAQ_SEARCH_QUERY: 'faq_search_query',
  FAQ_QUESTION_EXPANDED: 'faq_question_expanded',
  FAQ_SUPPORT_EMAIL_CLICKED: 'faq_support_email_clicked',

  // In-App Review (#170 v0.2.1.3)
  REVIEW_PROMPT_SHOWN: 'review_prompt_shown',           // Play Core dialog displayed
  REVIEW_PROMPT_SKIPPED_QUOTA: 'review_prompt_skipped_quota', // Google quota exceeded
  REVIEW_PROMPT_FAILED: 'review_prompt_failed',         // plugin error
}
