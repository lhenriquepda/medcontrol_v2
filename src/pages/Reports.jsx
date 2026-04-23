import { useState } from 'react'
import Header from '../components/Header'
import PaywallModal from '../components/PaywallModal'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'
import { useIsPro } from '../hooks/useSubscription'
import { useToast } from '../hooks/useToast'
import { formatDate, formatDateTime, formatTime, toDatetimeLocalInput, fromDatetimeLocalInput } from '../utils/dateUtils'

const STATUS_PT = { done: 'Tomada', skipped: 'Pulada', overdue: 'Atrasada', pending: 'Pendente' }

export default function Reports() {
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState('')
  const now = new Date()
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30)
  const [from, setFrom] = useState(toDatetimeLocalInput(monthAgo.toISOString()))
  const [to, setTo] = useState(toDatetimeLocalInput(now.toISOString()))
  const toast = useToast()
  const isPro = useIsPro()
  const [paywall, setPaywall] = useState(false)
  const gate = (fn) => () => { if (!isPro) { setPaywall(true); return } fn() }

  const { data: doses = [] } = useDoses({
    patientId: patientId || undefined,
    from: from ? fromDatetimeLocalInput(from) : undefined,
    to: to ? fromDatetimeLocalInput(to) : undefined
  })

  const patient = patients.find((p) => p.id === patientId)

  function exportCSV() {
    if (doses.length === 0) { toast.show({ message: 'Sem doses no período.', kind: 'warn' }); return }
    const header = ['Medicamento', 'Paciente', 'Dose', 'Agendada', 'Real', 'Status', 'Tipo', 'Observação']
    const rows = doses.map((d) => {
      const p = patients.find((x) => x.id === d.patientId)
      return [
        d.medName, p?.name || '', d.unit,
        formatDateTime(d.scheduledAt),
        d.actualTime ? formatDateTime(d.actualTime) : '',
        STATUS_PT[d.status] || d.status, d.type === 'sos' ? 'S.O.S' : 'Agendada',
        (d.observation || '').replace(/\r?\n/g, ' ')
      ]
    })
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, `medcontrol_${Date.now()}.csv`)
    toast.show({ message: 'CSV exportado.', kind: 'success' })
  }

  function exportPDF() {
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Relatório de adesão</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#111}
h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:16px 0 8px;color:#555}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}
.done{color:#059669}.skipped{color:#b45309}.overdue{color:#dc2626}.pending{color:#2563eb}
</style></head><body>
<h1>Relatório de adesão — MedControl</h1>
<p><strong>Paciente:</strong> ${patient?.name || 'Todos'} · <strong>Período:</strong> ${formatDate(from)} a ${formatDate(to)}</p>
<table><thead><tr><th>Medicamento</th><th>Dose</th><th>Agendada</th><th>Real</th><th>Status</th></tr></thead><tbody>
${doses.map((d) => `<tr>
<td>${esc(d.medName)}${d.type === 'sos' ? ' <small>(S.O.S)</small>' : ''}</td>
<td>${esc(d.unit)}</td>
<td>${formatDate(d.scheduledAt)} ${formatTime(d.scheduledAt)}</td>
<td>${d.actualTime ? formatDate(d.actualTime) + ' ' + formatTime(d.actualTime) : '—'}</td>
<td class="${d.status}">${STATUS_PT[d.status] || d.status}</td>
</tr>`).join('')}
</tbody></table>
<script>window.onload=()=>window.print()</script>
</body></html>`
    const w = window.open('', '_blank')
    if (!w) { toast.show({ message: 'Permita pop-ups para exportar PDF.', kind: 'error' }); return }
    w.document.open(); w.document.write(html); w.document.close()
  }

  return (
    <div className="pb-28">
      <Header back title="Relatórios" />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-3">
        <Field label="Paciente">
          <select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Todos</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="De">
            <input type="datetime-local" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Até">
            <input type="datetime-local" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>

        <div className="card p-4 text-sm text-slate-500">
          {doses.length} dose(s) no período.
        </div>

        {!isPro && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 p-3 text-xs">
            🔒 Exportar PDF/CSV é um recurso <strong>PRO</strong>. Toque em um botão para assinar.
          </div>
        )}
        <button onClick={gate(exportPDF)} className={`btn-primary w-full ${!isPro ? 'opacity-60' : ''}`}>
          {!isPro && '🔒 '}📄 Exportar PDF
        </button>
        <button onClick={gate(exportCSV)} className={`btn-secondary w-full ${!isPro ? 'opacity-60' : ''}`}>
          {!isPro && '🔒 '}📊 Exportar CSV
        </button>
      </div>
      <PaywallModal open={paywall} onClose={() => setPaywall(false)}
                    reason="Exportar PDF e CSV é um recurso PRO. Assine para liberar relatórios completos." />
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="block text-xs font-medium mb-1">{label}</span>{children}</label>
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function esc(s) { return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) }
