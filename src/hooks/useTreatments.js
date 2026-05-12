import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listTreatments, getTreatment, listTemplates, createTemplate } from '../services/treatmentsService'

export function useTreatments(filter = {}) {
  const qc = useQueryClient()
  // Item #204 v0.2.1.8 — initialData fallback: filter por patientId pode ter cache
  // vazio offline (queryKey diferente da lista geral ['treatments', {}]). Varre
  // todas queries ['treatments', *] no cache + filtra client-side. Sem isso,
  // PatientDetail offline mostra "Sem tratamentos ativos" mesmo quando existem.
  return useQuery({
    queryKey: ['treatments', filter],
    queryFn: () => listTreatments(filter),
    staleTime: 5 * 60_000,
    refetchOnMount: false,
    initialData: () => {
      const queries = qc.getQueryCache().findAll({ queryKey: ['treatments'] })
      // Coleta todos treatments de cache (de-dup por id), depois aplica filter
      const allMap = new Map()
      for (const q of queries) {
        const data = q.state.data
        if (!Array.isArray(data)) continue
        for (const t of data) {
          if (t?.id && !allMap.has(t.id)) allMap.set(t.id, t)
        }
      }
      const all = Array.from(allMap.values())
      if (all.length === 0) return undefined
      // Aplica filter client-side (mesmas chaves de listTreatments)
      let filtered = all
      if (filter?.patientId) filtered = filtered.filter(t => t.patientId === filter.patientId)
      return filtered
    },
  })
}
export function useTreatment(id) {
  const qc = useQueryClient()
  // Item #204 v0.2.1.8 — mesma estratégia usePatient: initialData lookup
  // na lista ['treatments'] cache (qualquer filter) pra TreatmentForm edit
  // offline não travar em "Carregando...".
  return useQuery({
    queryKey: ['treatments', id],
    queryFn: () => getTreatment(id),
    enabled: !!id,
    initialData: () => {
      if (!id) return undefined
      // findAll varre todas variações de queryKey ['treatments', {filter}]
      const queries = qc.getQueryCache().findAll({ queryKey: ['treatments'] })
      for (const q of queries) {
        const data = q.state.data
        if (!Array.isArray(data)) continue
        const found = data.find(t => t.id === id)
        if (found) return found
      }
      return undefined
    },
  })
}

// Item #204 (release v0.2.1.7) — Mutation queue offline. Defaults em mutationRegistry.
export function useCreateTreatment() {
  return useMutation({ mutationKey: ['createTreatment'] })
}
export function useUpdateTreatment() {
  return useMutation({ mutationKey: ['updateTreatment'] })
}
export function useDeleteTreatment() {
  return useMutation({ mutationKey: ['deleteTreatment'] })
}
export function usePauseTreatment() {
  return useMutation({ mutationKey: ['pauseTreatment'] })
}
export function useResumeTreatment() {
  return useMutation({ mutationKey: ['resumeTreatment'] })
}
export function useEndTreatment() {
  return useMutation({ mutationKey: ['endTreatment'] })
}

// Templates: baixa criticidade, não entram na queue offline (mantém useMutation local).
export function useTemplates() {
  return useQuery({ queryKey: ['templates'], queryFn: listTemplates })
}
export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] })
  })
}
