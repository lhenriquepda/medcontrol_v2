import { useEffect, useRef } from 'react'
import { useQueryClient, onlineManager } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { getValidSession, AuthLostError, onAuthLost } from '../services/sessionManager'
// v0.2.7.0 Fase 3 — drena mutations pendentes no resume (idempotência server-side).
import { drainPendingMutations, markColdStart } from '../services/markDose'
// v0.2.7.0 hardening — schedule notification se queue > 0 quando app vai bg.
import { schedulePendingSyncNotification, cancelPendingSyncNotification } from '../services/pendingSyncNotifier'

/**
 * useAppResume — handle app coming back from background/inactive state.
 *
 * Refactor Sync v2 Fase 1 (v0.2.7.0):
 *   - REMOVIDO: heartbeat soft-reconnect que detectava 401 mas NÃO chamava
 *     refreshSession() — causava loop infinito de degradação (heartbeat fail
 *     observado a cada 60s por 7min em S25U sem recovery).
 *   - REMOVIDO: watchdog ping (substituído por authedRpc com timeout 10s
 *     em cada RPC individual — fail-fast por chamada, não por estado global).
 *   - REMOVIDO: lógica de "soft recover" vs "long idle" — sempre que app
 *     retoma, valida sessão via sessionManager (que faz refresh proativo
 *     se token expira em <30s).
 *
 * Comportamento novo:
 *   - On resume (foreground / visibilitychange / app state): getValidSession()
 *     + invalidate active queries (TanStack refetch).
 *   - Heartbeat 60s: chama getValidSession() — se token expira em <30s,
 *     refresh proativo. Se refresh falha 2× → AuthLostError → emit pra UI.
 *   - Sem mutex próprio — sessionManager dedupa refreshSession() concorrentes.
 *
 * Alarme nativo Android (AlarmReceiver + SharedPreferences) é INDEPENDENTE
 * deste hook. Push FCM (background handler) também. Estes seguem disparando
 * normalmente durante idle.
 *
 * Mount once em App.jsx top-level.
 */
const RESUME_DEBOUNCE_MS = 1000
const HEARTBEAT_INTERVAL_MS = 60_000

let lastResumeAt = 0
// v0.2.8.6 #8 — separa o instante em que o app FOI pra background (onPause) do
// lastResumeAt (que serve ao debounce). Antes inactiveMs = now - lastResumeAt
// media "tempo desde o último resume" (~0 em resumes encadeados), então
// markColdStart (timeout 30s na 1ª RPC pós-idle longo) quase nunca disparava.
let lastBackgroundAt = 0

export function useAppResume() {
  const qc = useQueryClient()
  const lastActiveRef = useRef(0)

  useEffect(() => {
    const onResume = async () => {
      // Debounce: visibilitychange + focus + appStateChange disparam ~simultâneos
      // quando user retoma app. Sem debounce, múltiplas validações concorrentes.
      const now = Date.now()
      if (now - lastResumeAt < RESUME_DEBOUNCE_MS) return
      // v0.2.8.6 #8 — inactiveMs = tempo REAL em background (não desde o último resume).
      const inactiveMs = lastBackgroundAt ? (now - lastBackgroundAt) : 0
      lastResumeAt = now
      lastActiveRef.current = now

      // v0.2.7.0 hardening — resume tardio (>30s idle) marca cold start de novo.
      // Primeira RPC pós-resume tem latência alta (network re-establish, cold-start).
      // markDose vai usar timeout 30s em vez de 10s.
      if (inactiveMs > 30_000) {
        markColdStart()
      }

      try {
        // sessionManager garante token válido (lock-free; refresh via mutex se <90s).
        await getValidSession()
      } catch (e) {
        if (e instanceof AuthLostError) {
          // v0.2.8.6 #7 — NÃO desloga por AuthLost transitório (rádio acordando
          // pós-background gera 1-2 timeouts de refresh). O logout DEFINITIVO vem do
          // auth-js (SIGNED_OUT em refresh_token inválido, tratado em useAuth) ou do
          // boot getUser(). Antes: signOut + `return` aqui ABORTAVA o drain — a única
          // retomada capaz de drenar a fila se auto-destruía. Agora segue pro drain.
          console.warn('[useAppResume] AuthLost on resume — segue pro drain (sem signOut)')
        } else {
          console.warn('[useAppResume] resume session check failed:', e?.message)
        }
        // Segue mesmo assim — drain/refetch abaixo são best-effort e não travam UI.
      }

      // Re-sync onlineManager com Capacitor Network. Bridge listener pode ter
      // morrido junto com WebView durante Doze, deixando isOnline()=false sticky.
      if (Capacitor.isNativePlatform()) {
        try {
          const { Network } = await import('@capacitor/network')
          const status = await Network.getStatus()
          onlineManager.setOnline(status.connected)
        } catch (e) {
          console.warn('[useAppResume] Network.getStatus failed:', e?.message)
        }
      }

      // Drena mutations pendentes ANTES de refetch — evita race condition
      // (refetch carregaria server stale antes de drain aplicar mutations locais).
      // Idempotência server-side via mutation_log garante exactly-once mesmo se
      // drain duplica (ex: heartbeat e onResume concorrentes).
      try {
        await drainPendingMutations()
      } catch (e) {
        console.warn('[useAppResume] drainPendingMutations failed:', e?.message)
      }

      // v0.2.7.0 hardening — Dashboard agora vive em Zustand store (não TanStack
      // cache). refetchQueries só atinge useDoses/usePatients/useTreatments de
      // outras telas. Pra atualizar Dashboard, dispara fetchDashboard direto.
      try {
        const { fetchDashboard } = await import('../services/fetchDashboard')
        await fetchDashboard()
      } catch (e) {
        console.warn('[useAppResume] fetchDashboard failed:', e?.message)
      }

      // Refetch active queries TanStack (DoseHistory, Reports, Analytics, etc).
      try {
        await qc.refetchQueries({ type: 'active' })
      } catch (e) {
        console.warn('[useAppResume] refetchQueries failed:', e?.message)
      }

      // v0.2.7.0 hardening — cancela notification "doses não sincronizadas"
      // já que app voltou + drain rodou (queue agora vazia idealmente).
      cancelPendingSyncNotification().catch(() => { /* fail-safe */ })
    }

    const onPause = () => {
      const now = Date.now()
      lastActiveRef.current = now
      // v0.2.8.6 #8 — marca o instante de ida pra background (mede inactiveMs no resume).
      lastBackgroundAt = now
      // v0.2.7.0 hardening — se queue tem entries quando app vai bg,
      // schedule notification 30s alertando user pra reabrir e sincronizar.
      // Sem isso, cuidadores compartilhados nunca veem mutations queued.
      schedulePendingSyncNotification().catch(() => { /* fail-safe */ })
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

    // Heartbeat 60s — valida sessão silenciosamente. sessionManager faz refresh
    // proativo se token expira em <30s. AuthLostError emit cobre falhas.
    //
    // Diferente do v0.2.6.x: NÃO faz "soft reconnect" (remove channels, refetch
    // tudo). Heartbeat é APENAS validação de auth. Se sessão OK, no-op.
    const heartbeatTimer = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        await getValidSession()
      } catch (e) {
        if (e instanceof AuthLostError) {
          // v0.2.8.6 #7 — degrada, sem signOut (logout definitivo via auth-js/boot).
          console.warn('[useAppResume] heartbeat AuthLost — degrada (sem signOut)')
        } else {
          console.warn('[useAppResume] heartbeat exception:', e?.message)
        }
      }
    }, HEARTBEAT_INTERVAL_MS)

    // Listener pra emit de AuthLost vindos de qualquer RPC (authedRpc).
    // Por ora apenas signOut — Fase 2 vai adicionar UI banner via store.
    const unsubAuthLost = onAuthLost(({ reason }) => {
      // v0.2.8.6 #7 — emitAuthLost dispara após 2 falhas de refresh em <5min (com
      // decay). Ainda assim NÃO deslogamos aqui: logout só em erro auth DEFINITIVO
      // (auth-js SIGNED_OUT / boot getUser). Antes este signOut ejetava o user por
      // glitch de rede transitório. Fase 2 troca isto por banner "reconectando".
      console.warn('[useAppResume] onAuthLost (degrada, sem signOut):', reason)
    })

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('blur', onPause)
      stateHandle?.remove?.()
      clearInterval(heartbeatTimer)
      unsubAuthLost()
    }
  }, [qc])
}
