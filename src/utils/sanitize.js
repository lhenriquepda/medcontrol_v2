/**
 * Escapa caracteres HTML para prevenir XSS em template strings injetadas via innerHTML.
 * Usar em TODOS os dados vindos do banco antes de injetar em HTML (ex: PDF em Reports.jsx).
 */
export function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
