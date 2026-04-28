import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import Header from '../components/Header'
import PaywallModal from '../components/PaywallModal'
import Icon from '../components/Icon'
import AdBanner from '../components/AdBanner'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'
import { useIsPro } from '../hooks/useSubscription'
import { useToast } from '../hooks/useToast'
import { formatDate, formatDateTime, formatTime, toDatetimeLocalInput, fromDatetimeLocalInput } from '../utils/dateUtils'
import { statusLabel } from '../utils/statusUtils'
import { escapeHtml as esc } from '../utils/sanitize'

const isNative = Capacitor.isNativePlatform()

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
        statusLabel(d.status), d.type === 'sos' ? 'S.O.S' : 'Agendada',
        (d.observation || '').replace(/\r?\n/g, ' ')
      ]
    })
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const csvWithBom = '\ufeff' + csv
    const filename = `dosy_${Date.now()}.csv`

    if (isNative) {
      // Native: write to cache dir + share via system sheet
      ;(async () => {
        try {
          const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
          const { Share } = await import('@capacitor/share')
          await Filesystem.writeFile({
            path: filename,
            data: csvWithBom,
            directory: Directory.Cache,
            encoding: Encoding.UTF8
          })
          const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
          await Share.share({
            title: 'Relat\u00f3rio Dosy',
            url: uri,
            dialogTitle: 'Compartilhar relat\u00f3rio'
          })
          toast.show({ message: 'CSV pronto.', kind: 'success' })
        } catch (e) {
          toast.show({ message: 'Falha ao exportar CSV: ' + (e?.message || e), kind: 'error' })
        }
      })()
    } else {
      const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8' })
      downloadBlob(blob, filename)
      toast.show({ message: 'CSV exportado.', kind: 'success' })
    }
  }

  function exportPDF() {
    if (doses.length === 0) { toast.show({ message: 'Sem doses no período.', kind: 'warn' }); return }
    const showPatient = !patientId
    const total = doses.length
    const done = doses.filter((d) => d.status === 'done').length
    const skipped = doses.filter((d) => d.status === 'skipped').length
    const overdue = doses.filter((d) => d.status === 'overdue').length
    const adherence = total > 0 ? Math.round((done / total) * 100) : 0

    const origin = window.location.origin
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Dosy — Relatório de adesão</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;font-size:13px;
       -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:860px;margin:0 auto;background:#fff;min-height:100vh}

  /* Header */
  .header{background:linear-gradient(135deg,#0d1535 0%,#1a2660 100%);padding:28px 36px;display:flex;align-items:center;justify-content:space-between;
          -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .brand{display:flex;align-items:center;gap:16px}
  .brand img{height:48px;width:auto}
  .brand-sub{font-size:11px;color:rgba(255,255,255,0.5);margin-top:3px}
  .header-meta{text-align:right;color:rgba(255,255,255,0.7);font-size:11px;line-height:1.7}
  .header-meta strong{color:#fff;font-size:13px;display:block;margin-bottom:2px}

  /* Stats */
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid #e2e8f0}
  .stat{padding:16px 20px;text-align:center;border-right:1px solid #e2e8f0}
  .stat:last-child{border-right:none}
  .stat-val{font-size:24px;font-weight:700;line-height:1}
  .stat-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-top:4px}
  .green{color:#059669}.red{color:#dc2626}.amber{color:#d97706}.blue{color:#2563eb}

  /* Table */
  .section{padding:24px 36px}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  th{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;padding:8px 10px;background:#f8fafc;
     border-bottom:2px solid #e2e8f0;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;
         -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .badge-done{background:#d1fae5;color:#065f46}
  .badge-skipped{background:#fef3c7;color:#92400e}
  .badge-overdue{background:#fee2e2;color:#991b1b}
  .badge-pending{background:#dbeafe;color:#1e40af}
  .sos{font-size:10px;color:#7c3aed;background:#ede9fe;padding:1px 5px;border-radius:4px;margin-left:4px;
       -webkit-print-color-adjust:exact;print-color-adjust:exact}

  /* Footer */
  .footer{padding:16px 36px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;
          -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .footer-brand{font-size:11px;font-weight:700;color:#2B3EDF}
  .footer-note{font-size:10px;color:#94a3b8}
</style></head><body>
<div class="page">

  <div class="header">
    <div class="brand">
      <img src="${origin}/dosy-logo-light.png" alt="Dosy" />
      <div style="border-left:1px solid rgba(255,255,255,0.2);padding-left:14px">
        <div class="brand-sub">Relatório de adesão</div>
      </div>
    </div>
    <div class="header-meta">
      <strong>${esc(patient?.name || 'Todos os pacientes')}</strong>
      ${formatDate(from)} → ${formatDate(to)}<br/>
      Gerado em ${formatDate(new Date().toISOString())}
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-val">${total}</div><div class="stat-lbl">Total doses</div></div>
    <div class="stat"><div class="stat-val green">${adherence}%</div><div class="stat-lbl">Adesão</div></div>
    <div class="stat"><div class="stat-val amber">${skipped}</div><div class="stat-lbl">Puladas</div></div>
    <div class="stat"><div class="stat-val red">${overdue}</div><div class="stat-lbl">Atrasadas</div></div>
  </div>

  <div class="section">
    <div class="section-title">Detalhamento por dose</div>
    <table>
      <thead><tr>
        ${showPatient ? '<th>Paciente</th>' : ''}
        <th>Medicamento</th><th>Dose</th><th>Agendada</th><th>Tomada em</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${doses.map((d) => {
          const p = patients.find((x) => x.id === d.patientId)
          return `<tr>
            ${showPatient ? `<td>${esc(p?.name || '—')}</td>` : ''}
            <td>${esc(d.medName)}${d.type === 'sos' ? '<span class="sos">S.O.S</span>' : ''}</td>
            <td>${esc(d.unit)}</td>
            <td>${formatDate(d.scheduledAt)} ${formatTime(d.scheduledAt)}</td>
            <td>${d.actualTime ? formatDate(d.actualTime) + ' ' + formatTime(d.actualTime) : '<span style="color:#94a3b8">—</span>'}</td>
            <td><span class="badge badge-${d.status}">${statusLabel(d.status)}</span></td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <span class="footer-brand">dosy.vercel.app</span>
    <span class="footer-note">${total} doses · ${formatDate(from)} a ${formatDate(to)}</span>
  </div>

</div>
<script>window.onload=()=>window.print()</script>
</body></html>`
    if (isNative) {
      // Native: render HTML offscreen → html2canvas → jsPDF → save + share
      ;(async () => {
        try {
          const [{ default: html2canvas }, jsPDFmod, { Filesystem, Directory }, { Share }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
            import('@capacitor/filesystem'),
            import('@capacitor/share')
          ])
          const { jsPDF } = jsPDFmod

          const container = document.createElement('div')
          container.style.cssText = 'position:fixed;top:0;left:0;z-index:-1;width:860px;background:#fff;'
          container.innerHTML = html
          document.body.appendChild(container)

          await new Promise(r => setTimeout(r, 250))
          const canvas = await html2canvas(container.firstElementChild, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
          document.body.removeChild(container)

          const pdf = new jsPDF('p', 'mm', 'a4')
          const pageW = pdf.internal.pageSize.getWidth()
          const imgH = (canvas.height * pageW) / canvas.width
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, imgH)

          const filename = `dosy_relatorio_${Date.now()}.pdf`
          const base64 = pdf.output('datauristring').split(',')[1]
          await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Cache
          })
          const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
          await Share.share({
            title: 'Relatório Dosy',
            url: uri,
            dialogTitle: 'Compartilhar PDF'
          })
          toast.show({ message: 'PDF pronto.', kind: 'success' })
        } catch (e) {
          toast.show({ message: 'Falha ao exportar PDF: ' + (e?.message || e), kind: 'error' })
        }
      })()
      return
    }

    // Web: legacy window.print() flow
    const w = window.open('', '_blank')
    if (!w) { toast.show({ message: 'Permita pop-ups para exportar PDF.', kind: 'error' }); return }
    w.document.open(); w.document.write(html); w.document.close()
  }

  return (
    <div className="pb-28">
      <Header back title="Relatórios" />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-3">
        <AdBanner />
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

        {/* Preview */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{doses.length} dose(s)</span>
            {doses.length > 0 && (() => {
              const done = doses.filter((d) => d.status === 'done').length
              const pct = Math.round((done / doses.length) * 100)
              return <span className="text-xs font-bold text-emerald-600">{pct}% adesão</span>
            })()}
          </div>
          {doses.length === 0
            ? <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma dose no período.</p>
            : <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {doses.slice(0, 50).map((d) => {
                  const p = patients.find((x) => x.id === d.patientId)
                  const statusColors = { done: 'text-emerald-600', skipped: 'text-amber-500', overdue: 'text-rose-500', pending: 'text-blue-500' }
                  return (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.medName}
                          {!patientId && p && <span className="ml-1.5 text-[11px] text-slate-400">· {p.name.split(' ')[0]}</span>}
                        </p>
                        <p className="text-[11px] text-slate-400">{formatDate(d.scheduledAt)} {formatTime(d.scheduledAt)}</p>
                      </div>
                      <span className={`text-[11px] font-semibold shrink-0 ${statusColors[d.status] || 'text-slate-500'}`}>{statusLabel(d.status)}</span>
                    </li>
                  )
                })}
                {doses.length > 50 && <li className="px-4 py-2 text-center text-xs text-slate-400">+{doses.length - 50} mais no export</li>}
              </ul>
          }
        </div>

        {!isPro && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 p-3 text-xs flex items-start gap-1.5">
            <Icon name="lock" size={14} className="shrink-0 mt-0.5" /> <span>Exportar PDF/CSV é um recurso <strong>PRO</strong>. Toque em um botão para assinar.</span>
          </div>
        )}
        <button onClick={gate(exportPDF)} className={`btn-primary w-full inline-flex items-center justify-center gap-1.5 ${!isPro ? 'opacity-60' : ''}`}>
          {!isPro && <Icon name="lock" size={14} />} <Icon name="file-text" size={16} /> Exportar PDF
        </button>
        <button onClick={gate(exportCSV)} className={`btn-secondary w-full inline-flex items-center justify-center gap-1.5 ${!isPro ? 'opacity-60' : ''}`}>
          {!isPro && <Icon name="lock" size={14} />} <Icon name="bar-chart" size={16} /> Exportar CSV
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
