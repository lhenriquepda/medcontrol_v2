/**
 * queryClientRef.js — Refactor Sync v2 hardening (v0.2.7.0)
 *
 * Singleton ref ao queryClient TanStack pra módulos não-React invalidarem
 * queries quando precisam (markDose → invalida ['doses'] em outras telas).
 *
 * main.jsx chama setQueryClient(qc) no boot, antes do mount React.
 * Callers usam getQueryClient() — null-safe.
 *
 * Por que não exportar de main.jsx direto: cria risco de circular import
 * (main.jsx importa quase tudo). Esse arquivo é leaf — zero deps.
 */
let _qc = null

export function setQueryClient(qc) {
  _qc = qc
}

export function getQueryClient() {
  return _qc
}

/**
 * Helper: invalida queries TanStack relacionadas a doses.
 * Chamado por markDose após patchDose (Zustand) pra DoseHistory/Reports/
 * Analytics/AppHeader que ainda usam useDoses TanStack refletirem mudança.
 *
 * Sem isso, mark dose no Dashboard não atualiza badge "X atrasadas" do header
 * (useDoses cached) nem lista de DoseHistory (próxima abertura mostra stale
 * até poll 60s expirar).
 */
export function invalidateDoseQueries() {
  if (!_qc) return
  try {
    _qc.invalidateQueries({ queryKey: ['doses'] })
  } catch (e) {
    console.warn('[queryClientRef] invalidate fail:', e?.message)
  }
}
