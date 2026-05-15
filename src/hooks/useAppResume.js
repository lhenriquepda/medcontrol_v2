import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from '../services/supabase'

// v0.2.3.6 idle fix: lê expires_at do token no storage sem passar pelo processLock.
// Usado para detectar sessão genuinamente expirada quando refreshSession() falha
// com erro transient (ex: ProcessLockAcquireTimeoutError pós-idle longo).
function _readStoredTokenExpiry() {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL
    if (!url) return null
    const projectRef = new URL(url).hostname.split('.')[0]
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.expires_at ?? parsed?.session?.expires_at ?? null
  } catch {
    return null
  }
}

/**
 * useAppResume — handle app coming back from background/inactive state.
 *
 * Item #076 (release v0.1.7.0) — recovery sem reload destrutivo.
 *
 * Comportamento anterior: após 5min idle, força `window.location.href = '/'`.
 * Causava cold reload + tela branca + perda de URL + cascata de refetch.
 * Se algo falhasse no caminho (SW velho, JWT expirado, race), app ficava
 * travado até hard close do Chrome.
 *
 * Comportamento novo: soft recovery preservando URL.
 *   - Curto (<5min): invalida queries (refresh suave)
 *   - Longo (≥5min): refresh JWT → drop realtime channels → invalidate +
 *     refetch active queries. URL preservada. Sem reload.
 *
 * Alarme nativo Android (AlarmReceiver + SharedPreferences) é INDEPENDENTE
 * deste hook. Push FCM (background handler) também. Estes seguem disparando
 * normalmente durante idle.
 *
 * Mount once em App.jsx top-level.
 */
const SOFT_RECOVER_THRESHOLD_MS = 5 * 60 * 1000 // 5 min

// Item #202 (release v0.2.1.5+) — mutex + debounce pra prevenir refresh storm.
// Bug observado em prod 2026-05-08 09:00 BRT: 5 tokens rotacionados em 1.48s
// → Supabase detectou reuse → revogou refresh chain → user deslogado.
// Causa: visibilitychange + window focus + Capacitor appStateChange podem
// disparar onResume() em paralelo, cada um chamando refreshSession() →
// múltiplas rotações concorrentes do mesmo refresh_token.
// Solução: mutex module-level + debounce 1s.
let refreshInProgress = false
let lastResumeAt = 0
const RESUME_DEBOUNCE_MS = 1000

export function useAppResume() {
  const qc = useQueryClient()
  const lastActiveRef = useRef(Date.now())

  useEffect(() => {
    const onResume = async () => {
      // Item #202 — debounce: ignora resume events <1s após o último.
      // visibilitychange + focus + appStateChange disparam quase simultâneos
      // ao retomar app. Sem debounce, múltiplos refreshSession() concorrentes.
      const now = Date.now()
      if (now - lastResumeAt < RESUME_DEBOUNCE_MS) {
        console.log('[useAppResume] debounced (last resume', now - lastResumeAt, 'ms ago)')
        return
      }
      lastResumeAt = now

      const inactiveMs = Date.now() - lastActiveRef.current
      lastActiveRef.current = Date.now()

      if (inactiveMs >= SOFT_RECOVER_THRESHOLD_MS) {
        console.log('[useAppResume] long idle', Math.round(inactiveMs / 1000), 's → soft recover')
        // Item #202 — mutex: se outro refresh em curso, skip pra evitar
        // token storm. Próximo onResume natural vai cobrir.
        if (refreshInProgress) {
          console.warn('[useAppResume] refresh já em curso, skip pra evitar storm')
          return
        }
        refreshInProgress = true
        try {
          // 1. Renovar JWT — Supabase rotaciona refresh token automaticamente.
          //
          // Item #190 (release v0.2.1.3) FIX BUG-LOGOUT-RESUME (extends #159):
          // distinguir refresh transient errors (network slow, timeout, 5xx,
          // SecureStorage hiccup) vs real auth failures (refresh_token revoked,
          // user deleted, JWT corrupt). Implementação anterior tratava QUALQUER
          // erro como falha — onAuthStateChange disparava SIGNED_OUT em network
          // glitch. Resultado: user deslogado toda vez voltava de >5min idle
          // com network instável (Android Doze + cellular fluctuations típicos).
          // Agora: signOut só se evidência forte de invalid refresh token. Outros
          // erros: log + preservar session, próxima request authenticated re-valida.
          const { error: refreshErr } = await supabase.auth.refreshSession()
          if (refreshErr) {
            const errMsg = refreshErr.message || ''
            const errStatus = refreshErr.status
            const isAuthFailure =
              errStatus === 401 ||
              errStatus === 403 ||
              /jwt|token.*expired|invalid.*refresh|invalid.*claim|invalid.*token|user.*not.*found|refresh.*revoked/i.test(errMsg)
            if (!isAuthFailure) {
              // v0.2.3.6 #255 idle fix: erro "transient" pode ser ProcessLockAcquireTimeout
              // pós-idle longo (>1h). Se o token já expirou no storage, refetchQueries()
              // vai falhar com 401 em todas as queries → skeleton infinito.
              // Detectar via localStorage (não usa processLock) e forçar signOut.
              const storedExp = _readStoredTokenExpiry()
              const tokenExpired = storedExp !== null && storedExp < Math.floor(Date.now() / 1000)
              if (tokenExpired) {
                console.warn('[useAppResume] token expirado + refresh falhou (transient) → signOut forçado')
                await supabase.auth.signOut()
                return
              }
              console.warn('[useAppResume] refresh transient error (keeping session):', errMsg, 'status:', errStatus)
            } else {
              console.warn('[useAppResume] refresh auth failure (will signOut via listener):', errMsg, 'status:', errStatus)
            }
          }
          // 2. Drop dead websocket channels — useRealtime resubscribe via
          //    onAuthStateChange (TOKEN_REFRESHED) ou re-mount do hook.
          await supabase.removeAllChannels()
          // 3. Item #134 (egress-audit-2026-05-05 F1): refetchQueries sem
          //    invalidateQueries antes. invalidate marca TODAS queries stale
          //    e dispara refetch separado em cada useQuery active — duplica
          //    round-trips com refetchOnWindowFocus. refetchQueries({active})
          //    sozinho re-executa só queries observadas.
          await qc.refetchQueries({ type: 'active' })
        } catch (err) {
          // Item #190 (release v0.2.1.3): NÃO forçar reload em catch.
          // Reload remonta React tree → useAuth init → getUser() boot check.
          // Se network ainda instável, getUser() falha → cascade signOut.
          // Preservar session local + log. Próxima request authenticated
          // vai re-validar OR onAuthStateChange dispara SIGNED_OUT se token
          // realmente revogado.
          console.warn('[useAppResume] soft recover network exception (keeping session):', err?.message || err)
        } finally {
          // Item #202 — sempre liberar mutex
          refreshInProgress = false
        }
      }
      // Item #134 (egress-audit-2026-05-05 F1): short idle (<5min) NÃO invalida
      // mais. Realtime postgres_changes + refetchInterval 5min cobrem updates
      // necessários. user típico mobile/web muda tabs/apps centenas de vezes/dia
      // → invalidate em cada mudança era a fonte #1 de egress (estimado -30 a
      // -45% após este fix). Trade-off: dados podem aparecer 30-120s "antigos"
      // se Realtime não trouxer update; aceitável vs custo.
    }

    const onPause = () => {
      lastActiveRef.current = Date.now()
    }

    // Web: document visibility change
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        onResume()
      } else {
        onPause()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Web: window focus/blur (fallback)
    window.addEventListener('focus', onResume)
    window.addEventListener('blur', onPause)

    // Native: Capacitor app state
    let stateHandle
    if (Capacitor.isNativePlatform()) {
      ;(async () => {
        stateHandle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            onResume()
          } else {
            onPause()
          }
        })
      })()
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('blur', onPause)
      stateHandle?.remove?.()
    }
  }, [qc])
}
