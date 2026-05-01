import { useCallback, useRef } from 'react'
import { useToast } from './useToast'

/**
 * useUndoableDelete — wrap mutation com janela undo de 5s.
 * Aud 4.5.1 G16 / FASE 15 UX refinement.
 *
 * Comportamento:
 *   1. Click delete → otimisticamente remove da UI (cache patch via onOptimistic)
 *   2. Toast aparece com botão "Desfazer" (5s)
 *   3. Se user clica Desfazer → cancela timer + restore na UI (onRestore)
 *   4. Senão → após 5s executa DELETE real no servidor (mutationFn)
 *
 * Usar em useDeletePatient, useDeleteTreatment.
 *
 * Args:
 *   mutationFn   — async (id) => server delete (ex: deletePatient)
 *   onOptimistic — (id) => void — remove da UI cache imediatamente
 *   onRestore    — (id) => void — restaura na UI cache em caso de undo
 *   itemLabel    — string — usado em toast ("Paciente removido")
 *
 * Returns: trigger(id, snapshotData) function
 */
export function useUndoableDelete({ mutationFn, onOptimistic, onRestore, itemLabel = 'Item' }) {
  const toast = useToast()
  // Timer ativo por id — cancela duplicado se user clica delete novamente
  const timersRef = useRef(new Map())

  return useCallback(
    (id) => {
      // Otimisticamente remove da UI
      onOptimistic?.(id)

      // Cancela timer anterior pra mesmo id (idempotente)
      const existing = timersRef.current.get(id)
      if (existing) {
        clearTimeout(existing.timerId)
        timersRef.current.delete(id)
      }

      let undone = false

      const timerId = setTimeout(async () => {
        if (undone) return
        timersRef.current.delete(id)
        try {
          await mutationFn(id)
        } catch (err) {
          // Servidor falhou após otimista. Restaura UI + avisa.
          onRestore?.(id)
          toast.show({
            message: err?.message || `Falha ao remover ${itemLabel.toLowerCase()}.`,
            kind: 'error',
            duration: 6000,
          })
        }
      }, 5000)

      timersRef.current.set(id, { timerId })

      toast.show({
        message: `${itemLabel} removido.`,
        kind: 'info',
        duration: 5000,
        undoLabel: 'Desfazer',
        onUndo: () => {
          undone = true
          const t = timersRef.current.get(id)
          if (t) {
            clearTimeout(t.timerId)
            timersRef.current.delete(id)
          }
          onRestore?.(id)
        },
      })
    },
    [mutationFn, onOptimistic, onRestore, itemLabel, toast]
  )
}
