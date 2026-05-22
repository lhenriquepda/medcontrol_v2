/**
 * useAppLifecycle — Refactor Fase 3 (Refactor_Full.md §4.4 + §11.4).
 *
 * Consolida `useAppResume` + `useAppLock` em UM ponto de entry pra
 * lifecycle do app. Antes: 2 hooks separados, cada um com seu próprio
 * timer/lastActiveRef, lidando com `appStateChange` independente, sem
 * coordenação.
 *
 * Estado retornado (state machine simples):
 *   { phase: 'foreground' | 'background' | 'locked', isLocked, unlock }
 *
 * Comportamento:
 *   - Foreground com `useAppLock` enabled + bg >timeout → locked
 *   - Foreground com lock disabled → executa resume soft (refresh JWT,
 *     invalidate queries, drop+resub realtime se >5min idle)
 *   - useAppLock só monta se `enabled = true` em prefs (lazy mount evita
 *     reativar comportamento de lock que ainda não está disponível em
 *     produção).
 *
 * Uso (App.jsx):
 *   const { phase, isLocked, unlock } = useAppLifecycle()
 *   if (isLocked) return <LockScreen onUnlock={unlock} />
 *
 * Compat: hooks underlying `useAppResume.js` e `useAppLock.js` continuam
 * existindo e funcionando standalone. Este wrapper só CONSOLIDA o entry
 * point — código existente que ainda usa `useAppResume()` direto não
 * quebra. Adoção gradual.
 */
import { useAppResume } from './useAppResume'
import { useAppLock } from './useAppLock'

export function useAppLifecycle() {
  // useAppResume é side-effect only (sem retorno) — handles soft refresh
  // em onResume. Sempre roda.
  useAppResume()

  // useAppLock retorna estado (locked, isEnabled, unlock, ...) — só age se
  // user habilitou. Quando disabled, locked é sempre false (sem fricção).
  const lockState = useAppLock()

  return {
    phase: lockState.locked ? 'locked' : 'foreground',
    isLocked: lockState.locked,
    biometricAvailable: lockState.biometricAvailable,
    isLockEnabled: lockState.isEnabled,
    unlock: lockState.unlock,
    lock: lockState.lock,
    enableLock: lockState.enable,
    disableLock: lockState.disable,
  }
}

export default useAppLifecycle
