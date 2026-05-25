/**
 * RealtimeManager — ADR-016 (Gemini Fase 4 v0.2.8.2).
 *
 * Singleton que gerencia o ciclo de vida do Supabase Realtime postgres_changes
 * com 5 salvaguardas obrigatórias para não queimar egress no Supabase free tier.
 *
 * Histórico:
 *   - v0.2.1.0 #157: useRealtime() DESATIVADO em App.jsx por storm 5GB/h em idle
 *     (publication vazia + reconnect cascade burnando 13 req/s sustained).
 *   - v0.2.7.0 Fase 4: useRealtime refatorado pra wrapper minimalista 110 linhas
 *     (postgres_changes 6 tables + debounce 1.5s + canal único) mas ainda comentado.
 *   - v0.2.8.2 Fase 4 (este arquivo): reativa Realtime com salvaguardas.
 *
 * As 5 salvaguardas (ADR-016):
 *   (a) Visibility change: `document.hidden=true` → pauseAll('visibility')
 *       `document.hidden=false` → resumeAll('visibility')
 *   (b) Idle detection: 5min sem `pointerdown/keydown/touchstart` → pauseAll('idle')
 *       Próxima interação → resumeAll('activity')
 *   (c) Feature flag master switch: lê `medcontrol.feature_flags` key `realtime_enabled`
 *       (default `false` desde v0.2.6.4). Refetch a cada 60min ou pós-resume.
 *   (d) Canal único: useRealtime já agrega 6 tables num único channel (não há fan-out
 *       de canais — confirmar no `useRealtime.js`).
 *   (e) Telemetria PostHog: `realtime_subscribed`, `realtime_paused` (com reason),
 *       `realtime_resumed`, `realtime_message_received` (rate-limited).
 *
 * Como usar:
 *   1. Boot em `App.jsx`: `realtimeManager.init()` pós-auth + ler feature flag.
 *   2. Hook `useRealtimeManager()` em components que precisam saber se está ativo.
 *   3. `useRealtime()` consulta `realtimeManager.isActive` antes de subscribe.
 *
 * Não exporta classe — apenas singleton + helpers. Imports diretos de `@supabase/*`
 * e `@capacitor/*` continuam isolados aqui (regra ESLint folder boundaries Fase 5).
 */

import { hasSupabase, supabase } from '../../services/supabase'
import { track } from '../../services/analytics'

const IDLE_THRESHOLD_MS = 5 * 60 * 1000 // 5min
const FLAG_REFETCH_INTERVAL_MS = 60 * 60 * 1000 // 60min
const MESSAGE_TRACK_THROTTLE_MS = 30 * 1000 // 1 evento PostHog / 30s pra evitar storm

const PAUSE_REASONS = {
  VISIBILITY: 'visibility',
  IDLE: 'idle',
  FEATURE_FLAG_DISABLED: 'feature_flag_disabled',
  AUTH_LOST: 'auth_lost',
  NETWORK_OFFLINE: 'network_offline',
  EXPLICIT: 'explicit',
}

const RESUME_REASONS = {
  VISIBILITY: 'visibility',
  ACTIVITY: 'activity',
  FEATURE_FLAG_ENABLED: 'feature_flag_enabled',
  AUTH_RESTORED: 'auth_restored',
  NETWORK_ONLINE: 'network_online',
  EXPLICIT: 'explicit',
}

class _RealtimeManager {
  constructor() {
    this._initialized = false
    this._featureFlagEnabled = false // (c) default false até RPC confirmar
    this._paused = false // composição de todos os pause reasons ativos
    this._pauseReasons = new Set() // multi-source: visibility|idle|flag|auth|network
    this._lastActivity = Date.now()
    this._idleTimer = null
    this._flagRefetchTimer = null
    this._listeners = new Set() // observers (useRealtimeManager hook)
    this._lastMessageTrackedAt = 0 // throttle PostHog events
    this._cleanupFns = [] // teardown handlers
  }

  // === Lifecycle ===

  async init() {
    if (this._initialized) return
    if (typeof window === 'undefined') return // SSR safety
    this._initialized = true

    // (c) Feature flag — poll inicial
    await this._refetchFeatureFlag()
    this._flagRefetchTimer = setInterval(() => {
      this._refetchFeatureFlag().catch(() => { /* silent */ })
    }, FLAG_REFETCH_INTERVAL_MS)

    // (a) Visibility change
    const onVisChange = () => {
      if (document.hidden) this.pauseAll(PAUSE_REASONS.VISIBILITY)
      else this.resumeAll(RESUME_REASONS.VISIBILITY)
    }
    document.addEventListener('visibilitychange', onVisChange)
    this._cleanupFns.push(() => document.removeEventListener('visibilitychange', onVisChange))

    // (b) Idle detection
    const onActivity = () => this._registerActivity()
    document.addEventListener('pointerdown', onActivity, { passive: true })
    document.addEventListener('keydown', onActivity, { passive: true })
    document.addEventListener('touchstart', onActivity, { passive: true })
    this._cleanupFns.push(() => {
      document.removeEventListener('pointerdown', onActivity)
      document.removeEventListener('keydown', onActivity)
      document.removeEventListener('touchstart', onActivity)
    })
    this._resetIdleTimer()

    // Initial state baseada em visibility
    if (typeof document !== 'undefined' && document.hidden) {
      this.pauseAll(PAUSE_REASONS.VISIBILITY)
    }
  }

  destroy() {
    if (!this._initialized) return
    this._initialized = false
    if (this._idleTimer) clearTimeout(this._idleTimer)
    if (this._flagRefetchTimer) clearInterval(this._flagRefetchTimer)
    this._cleanupFns.forEach((fn) => { try { fn() } catch { /* */ } })
    this._cleanupFns = []
    this._listeners.clear()
    this._pauseReasons.clear()
    this._paused = false
  }

  // === State accessors ===

  /**
   * Realtime está ativo (subscribe permitido)?
   * Requer: feature flag enabled E não pausado por nenhum motivo.
   */
  get isActive() {
    return this._featureFlagEnabled && !this._paused
  }

  get featureFlagEnabled() { return this._featureFlagEnabled }
  get pauseReasons() { return Array.from(this._pauseReasons) }
  get isPaused() { return this._paused }

  // === Pause / Resume ===

  pauseAll(reason = PAUSE_REASONS.EXPLICIT) {
    const wasPaused = this._paused
    this._pauseReasons.add(reason)
    this._paused = this._pauseReasons.size > 0
    if (!wasPaused) {
      // Transição inativo: emit evento + notifica observers
      try { track('realtime_paused', { reason }) } catch { /* */ }
      this._notify()
    }
  }

  resumeAll(reason = RESUME_REASONS.EXPLICIT) {
    // Remove um motivo específico — só resume de fato se TODOS removidos
    const reasonMap = {
      [RESUME_REASONS.VISIBILITY]: PAUSE_REASONS.VISIBILITY,
      [RESUME_REASONS.ACTIVITY]: PAUSE_REASONS.IDLE,
      [RESUME_REASONS.FEATURE_FLAG_ENABLED]: PAUSE_REASONS.FEATURE_FLAG_DISABLED,
      [RESUME_REASONS.AUTH_RESTORED]: PAUSE_REASONS.AUTH_LOST,
      [RESUME_REASONS.NETWORK_ONLINE]: PAUSE_REASONS.NETWORK_OFFLINE,
      [RESUME_REASONS.EXPLICIT]: PAUSE_REASONS.EXPLICIT,
    }
    const pauseReason = reasonMap[reason]
    if (pauseReason) this._pauseReasons.delete(pauseReason)

    const wasPaused = this._paused
    this._paused = this._pauseReasons.size > 0
    if (wasPaused && !this._paused) {
      // Transição ativo
      try { track('realtime_resumed', { reason }) } catch { /* */ }
      // Reset idle timer pós-resume pra dar 5min "fresh"
      this._registerActivity()
      this._notify()
    }
  }

  // === (c) Feature flag ===

  async _refetchFeatureFlag() {
    if (!hasSupabase) return
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('value')
        .eq('key', 'realtime_enabled')
        .maybeSingle()
      if (error) {
        console.warn('[RealtimeManager] feature flag fetch error:', error.message)
        return
      }
      // value é JSONB — pode ser `true` ou `false` direto
      const enabled = data?.value === true || data?.value === 'true'
      const wasEnabled = this._featureFlagEnabled
      this._featureFlagEnabled = enabled
      if (wasEnabled !== enabled) {
        if (enabled) {
          this.resumeAll(RESUME_REASONS.FEATURE_FLAG_ENABLED)
        } else {
          this.pauseAll(PAUSE_REASONS.FEATURE_FLAG_DISABLED)
        }
        this._notify()
      }
    } catch (e) {
      console.warn('[RealtimeManager] feature flag fetch threw:', e?.message)
    }
  }

  // === (b) Idle ===

  _registerActivity() {
    this._lastActivity = Date.now()
    if (this._pauseReasons.has(PAUSE_REASONS.IDLE)) {
      this.resumeAll(RESUME_REASONS.ACTIVITY)
    }
    this._resetIdleTimer()
  }

  _resetIdleTimer() {
    if (this._idleTimer) clearTimeout(this._idleTimer)
    this._idleTimer = setTimeout(() => {
      this.pauseAll(PAUSE_REASONS.IDLE)
    }, IDLE_THRESHOLD_MS)
  }

  // === (e) Telemetria ===

  /**
   * Chamado pelo useRealtime sempre que um payload postgres_changes chega.
   * Throttled pra evitar spam PostHog (1 event / 30s, agrega count).
   */
  trackMessageReceived(table) {
    const now = Date.now()
    if (now - this._lastMessageTrackedAt < MESSAGE_TRACK_THROTTLE_MS) return
    this._lastMessageTrackedAt = now
    try { track('realtime_message_received', { table }) } catch { /* */ }
  }

  trackSubscribed(channelName) {
    try { track('realtime_subscribed', { channel: channelName }) } catch { /* */ }
  }

  // === Observers (pra React hook) ===

  subscribe(callback) {
    this._listeners.add(callback)
    return () => this._listeners.delete(callback)
  }

  _notify() {
    const snapshot = {
      isActive: this.isActive,
      isPaused: this._paused,
      pauseReasons: Array.from(this._pauseReasons),
      featureFlagEnabled: this._featureFlagEnabled,
    }
    this._listeners.forEach((cb) => { try { cb(snapshot) } catch { /* */ } })
  }
}

export const realtimeManager = new _RealtimeManager()
export { PAUSE_REASONS, RESUME_REASONS }
