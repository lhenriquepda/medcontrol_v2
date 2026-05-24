/**
 * MutationErrorListener — v0.2.6.6 F5
 *
 * Mount em App.jsx dentro do ToastProvider. Escuta mutationErrorBus + mostra
 * toast user-friendly quando mutation falha sem ser conflict 409 (já coberto
 * por ConflictListener) — cura bug "silent fail" pós-idle.
 */
import { useEffect } from 'react'
import { subscribeMutationError } from '../state/mutationErrorBus'
import { useToast } from '../hooks/useToast'

const MUTATION_LABELS = {
  confirmDose: 'marcar dose',
  skipDose: 'pular dose',
  undoDose: 'desfazer dose',
  registerSos: 'registrar SOS',
  createTreatment: 'criar tratamento',
  updateTreatment: 'atualizar tratamento',
  deleteTreatment: 'remover tratamento',
  pauseTreatment: 'pausar tratamento',
  resumeTreatment: 'retomar tratamento',
  endTreatment: 'encerrar tratamento',
  createPatient: 'criar paciente',
  updatePatient: 'atualizar paciente',
  deletePatient: 'remover paciente',
}

export default function MutationErrorListener() {
  const toast = useToast()

  useEffect(() => {
    const unsubscribe = subscribeMutationError(({ mutation, error, code, label }) => {
      const friendlyLabel = label || MUTATION_LABELS[mutation] || 'operação'
      let message
      if (code === 401 || /unauthorized|jwt/i.test(error?.message || '')) {
        message = `Sessão expirou. Faça login novamente.`
      } else if (code === 403) {
        message = `Sem permissão para ${friendlyLabel}.`
      } else if (code === 404) {
        message = `Item não encontrado para ${friendlyLabel}.`
      } else if (/network|fetch|timeout/i.test(error?.message || '')) {
        message = `Falha de conexão ao ${friendlyLabel}. Sua mudança ficará pendente.`
      } else {
        message = `Erro ao ${friendlyLabel}: ${error?.message || 'tente novamente'}`
      }
      toast?.show({
        message,
        kind: 'error',
        // 6s = leitura tranquila + dá tempo de reagir.
        duration: 6000,
      })
    })
    return unsubscribe
  }, [toast])

  return null
}
