import { onlineManager } from '@tanstack/react-query'
import { useOnlineStatus } from './useOnlineStatus'
import { useToast } from './useToast'

/**
 * useOfflineGuard — Item #204 v0.2.1.8.
 *
 * Helper pra features que NÃO estão na mutation queue offline (mutationRegistry).
 * Bloqueia ação + mostra toast claro pro user em vez de iludir que "vai sincronizar".
 *
 * Uso típico em handlers:
 *
 *   const guard = useOfflineGuard()
 *   async function handleShare() {
 *     if (!guard.ensure('Compartilhamento de paciente')) return
 *     await sharePatient(...)
 *   }
 *
 * Plus expõe `online` reativo pra desabilitar botões / inputs visualmente:
 *
 *   const { online } = useOfflineGuard()
 *   <Button disabled={!online}>Compartilhar</Button>
 *
 * Features na queue offline (createPatient etc) NÃO devem usar este hook —
 * elas drenam ao reconectar (toast "Salvo offline" em vez de "Sem conexão").
 */
export function useOfflineGuard() {
  const online = useOnlineStatus()
  const toast = useToast()

  function ensure(featureLabel = 'Esta ação') {
    if (onlineManager.isOnline()) return true
    toast.show({
      message: `Sem conexão. ${featureLabel} requer internet. Reconecte e tente novamente.`,
      kind: 'warn',
    })
    return false
  }

  return { online, ensure }
}
