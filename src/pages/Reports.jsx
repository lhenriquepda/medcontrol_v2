import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { motion } from 'framer-motion'
import { FileText, BarChart3, Lock, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Pill, Calendar, TrendingUp } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import PaywallModal from '../components/PaywallModal'
import AdBanner from '../components/AdBanner'
import PatientAvatar from '../components/PatientAvatar'
import { Card, Button, Input } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'
import { useIsPro } from '../hooks/useSubscription'
import { useToast } from '../hooks/useToast'
import { formatDate, formatDateTime, formatTime } from '../utils/dateUtils'
import { statusLabel } from '../utils/statusUtils'
import { escapeHtml as esc } from '../utils/sanitize'
import { usePrivacyScreen } from '../hooks/usePrivacyScreen'

const isNative = Capacitor.isNativePlatform()

const STATUS_DOSY_COLOR = {
  done: '#3F9E7E',
  skipped: '#C5841A',
  overdue: 'var(--dosy-danger)',
  pending: 'var(--dosy-fg-secondary)',
}

export default function Reports() {
  // Aud 4.5.4 G2 — relatórios contém histórico médico completo
  usePrivacyScreen()
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState('')
  // Date inputs YYYY-MM-DD (sem hora). Convertidos a ISO start-of-day / end-of-day no query.
  function toDateInput(iso) {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  function dateInputToIsoStart(s) {
    if (!s) return undefined
    const [y, m, d] = s.split('-').map(Number)
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0)
    return dt.toISOString()
  }
  function dateInputToIsoEnd(s) {
    if (!s) return undefined
    const [y, m, d] = s.split('-').map(Number)
    const dt = new Date(y, m - 1, d, 23, 59, 59, 999)
    return dt.toISOString()
  }
  const now = new Date()
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30)
  const [from, setFrom] = useState(toDateInput(monthAgo.toISOString()))
  const [to, setTo] = useState(toDateInput(now.toISOString()))
  // v0.2.3.5 #242 — preset período rápido: 7d/10d/30d/365d + 'custom' libera date pickers
  const [periodPreset, setPeriodPreset] = useState('30')
  function applyPreset(days) {
    setPeriodPreset(String(days))
    const today = new Date()
    const start = new Date(); start.setDate(start.getDate() - days)
    setFrom(toDateInput(start.toISOString()))
    setTo(toDateInput(today.toISOString()))
  }
  const toast = useToast()
  const isPro = useIsPro()
  const [paywall, setPaywall] = useState(false)
  const [exporting, setExporting] = useState(null) // 'pdf' | 'csv' | null
  const gate = (fn) => () => { if (!isPro) { setPaywall(true); return } fn() }

  const { data: doses = [], isPending, isFetching } = useDoses({
    patientId: patientId || undefined,
    from: dateInputToIsoStart(from),
    to: dateInputToIsoEnd(to),
    // #138: export PDF/CSV inclui observation
    withObservation: true,
  })
  // v0.2.3.5 #243 — distingue loading de vazio real (antes: refetch mostrava "Sem doses" falsamente)
  const isLoading = isPending || (isFetching && doses.length === 0)

  // v0.2.3.5 #243 — formatDate(YYYY-MM-DD) parseia UTC e shifta -1 dia em BRT.
  // Helper local que renderiza date-string sem TZ shift.
  function fmtDateInput(s) {
    if (!s) return ''
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y}`
  }

  const patient = patients.find((p) => p.id === patientId)

  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'todos'
  }
  function shortHash() {
    return Math.random().toString(36).slice(2, 8)
  }
  function buildFilename(ext) {
    const d = new Date()
    const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    const who = patient?.name ? slug(patient.name) : 'todos'
    return `dosy-${who}-${ymd}-${shortHash()}.${ext}`
  }

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
        (d.observation || '').replace(/\r?\n/g, ' '),
      ]
    })
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const csvWithBom = '﻿' + csv
    const filename = buildFilename('csv')

    if (isNative) {
      setExporting('csv')
      ;(async () => {
        try {
          const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
          const { Share } = await import('@capacitor/share')
          await Filesystem.writeFile({
            path: filename,
            data: csvWithBom,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
            recursive: true,
          })
          const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Documents })
          toast.show({ message: `CSV salvo em Documentos · ${filename}`, kind: 'success', duration: 6000 })
          setExporting(null)
          Share.share({
            title: 'Relatório Dosy',
            url: uri,
            dialogTitle: 'Compartilhar relatório',
          }).catch((shareErr) => {
            if (!/cancel/i.test(shareErr?.message || '')) console.warn('Share failed:', shareErr)
          })
        } catch (e) {
          toast.show({ message: 'Falha ao exportar CSV: ' + (e?.message || e), kind: 'error' })
          setExporting(null)
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

  .header{background:linear-gradient(135deg,#FF3D7F 0%,#FF6B5B 50%,#FFA56B 100%);padding:28px 36px;display:flex;align-items:center;justify-content:space-between;
          -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .brand{display:flex;align-items:center;gap:16px}
  .brand img{height:48px;width:auto}
  .brand-sub{font-size:11px;color:rgba(255,255,255,0.75);margin-top:3px}
  .header-meta{text-align:right;color:rgba(255,255,255,0.85);font-size:11px;line-height:1.7}
  .header-meta strong{color:#fff;font-size:13px;display:block;margin-bottom:2px}

  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid #e2e8f0}
  .stat{padding:16px 20px;text-align:center;border-right:1px solid #e2e8f0}
  .stat:last-child{border-right:none}
  .stat-val{font-size:24px;font-weight:700;line-height:1}
  .stat-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-top:4px}
  .green{color:#3F9E7E}.red{color:#E5564A}.amber{color:#C5841A}.coral{color:#FF6B5B}

  .section{padding:24px 36px}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  th{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;padding:8px 10px;background:#f8fafc;
     border-bottom:2px solid #e2e8f0;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;
         -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .badge-done{background:#DDF1E8;color:#3F9E7E}
  .badge-skipped{background:#FCEFCF;color:#C5841A}
  .badge-overdue{background:#FCE6E2;color:#E5564A}
  .badge-pending{background:#FFE9D9;color:#9A4724}
  .sos{font-size:10px;color:#FF3D7F;background:#FFE9D9;padding:1px 5px;border-radius:4px;margin-left:4px;
       -webkit-print-color-adjust:exact;print-color-adjust:exact}

  .footer{padding:16px 36px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;
          -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .footer-brand{font-size:11px;font-weight:700;color:#FF3D7F}
  .footer-note{font-size:10px;color:#94a3b8}
</style></head><body>
<div class="page">

  <div class="header">
    <div class="brand">
      <img src="${origin}/dosy-logo-light.png" alt="Dosy" />
      <div style="border-left:1px solid rgba(255,255,255,0.3);padding-left:14px">
        <div class="brand-sub">Relatório de adesão</div>
      </div>
    </div>
    <div class="header-meta">
      <strong>${esc(patient?.name || 'Todos os pacientes')}</strong>
      ${fmtDateInput(from)} → ${fmtDateInput(to)}<br/>
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
      setExporting('pdf')
      ;(async () => {
        try {
          const [{ default: html2canvas }, jsPDFmod, { Filesystem, Directory }, { Share }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
            import('@capacitor/filesystem'),
            import('@capacitor/share'),
          ])
          const { jsPDF } = jsPDFmod

          const iframe = document.createElement('iframe')
          iframe.style.cssText = 'position:fixed;top:0;left:-99999px;width:860px;height:1200px;border:0;opacity:0;pointer-events:none;'
          iframe.setAttribute('aria-hidden', 'true')
          const cleanedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '')
          document.body.appendChild(iframe)
          await new Promise((res) => {
            iframe.onload = res
            iframe.srcdoc = cleanedHtml
            setTimeout(res, 2000)
          })
          const idoc = iframe.contentDocument
          const target = idoc.querySelector('.page') || idoc.body
          iframe.style.height = target.scrollHeight + 'px'
          const imgs = idoc.querySelectorAll('img')
          await Promise.all(Array.from(imgs).map((img) =>
            img.complete ? Promise.resolve() :
              new Promise((res) => { img.onload = res; img.onerror = res; setTimeout(res, 1500) }),
          ))
          await new Promise((r) => setTimeout(r, 200))
          const canvas = await html2canvas(target, {
            scale: 1, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
            windowWidth: 860, windowHeight: target.scrollHeight,
            foreignObjectRendering: false,
          })
          document.body.removeChild(iframe)

          const pdf = new jsPDF('p', 'mm', 'a4')
          const pageW = pdf.internal.pageSize.getWidth()
          const pageH = pdf.internal.pageSize.getHeight()
          const imgH = (canvas.height * pageW) / canvas.width
          const imgData = canvas.toDataURL('image/jpeg', 0.82)
          if (imgH <= pageH) {
            pdf.addImage(imgData, 'JPEG', 0, 0, pageW, imgH)
          } else {
            let heightLeft = imgH
            let position = 0
            pdf.addImage(imgData, 'JPEG', 0, position, pageW, imgH)
            heightLeft -= pageH
            while (heightLeft > 0) {
              position = heightLeft - imgH
              pdf.addPage()
              pdf.addImage(imgData, 'JPEG', 0, position, pageW, imgH)
              heightLeft -= pageH
            }
          }

          const filename = buildFilename('pdf')
          const base64 = pdf.output('datauristring').split(',')[1]
          const CHUNK = 512 * 1024
          if (base64.length <= CHUNK) {
            await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Documents, recursive: true })
          } else {
            await Filesystem.writeFile({ path: filename, data: base64.slice(0, CHUNK), directory: Directory.Documents, recursive: true })
            for (let i = CHUNK; i < base64.length; i += CHUNK) {
              await Filesystem.appendFile({ path: filename, data: base64.slice(i, i + CHUNK), directory: Directory.Documents })
            }
          }
          const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Documents })
          toast.show({ message: `PDF salvo em Documentos · ${filename}`, kind: 'success', duration: 6000 })
          setExporting(null)
          Share.share({
            title: 'Relatório Dosy',
            url: uri,
            dialogTitle: 'Compartilhar PDF',
          }).catch((shareErr) => {
            if (!/cancel/i.test(shareErr?.message || '')) console.warn('Share failed:', shareErr)
          })
        } catch (e) {
          toast.show({ message: 'Falha ao exportar PDF: ' + (e?.message || e), kind: 'error' })
          setExporting(null)
        }
      })()
      return
    }

    const w = window.open('', '_blank')
    if (!w) { toast.show({ message: 'Permita pop-ups para exportar PDF.', kind: 'error' }); return }
    w.document.open(); w.document.write(html); w.document.close()
  }

  const adherencePct = doses.length > 0
    ? Math.round((doses.filter((d) => d.status === 'done').length / doses.length) * 100)
    : null

  // v0.2.3.5 #242 — stats agregados pro hero + distribuição
  const stats = (() => {
    const total = doses.length
    const done = doses.filter(d => d.status === 'done').length
    const skipped = doses.filter(d => d.status === 'skipped').length
    const overdue = doses.filter(d => d.status === 'overdue').length
    const pending = doses.filter(d => d.status === 'pending').length
    return { total, done, skipped, overdue, pending }
  })()

  // Top 5 medicamentos do período (count + done count)
  const topMeds = (() => {
    const map = new Map()
    for (const d of doses) {
      const m = map.get(d.medName) || { count: 0, done: 0 }
      m.count += 1
      if (d.status === 'done') m.done += 1
      map.set(d.medName, m)
    }
    return [...map.entries()]
      .map(([name, m]) => ({ name, ...m, pct: m.count ? Math.round(m.done / m.count * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  })()

  return (
    <motion.div
      style={{ paddingBottom: 110 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.inOut }}
    >
      <PageHeader title="Relatórios" back/>

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AdBanner />

        {/* PATIENT FILTER chips — padrão Tratamentos/Analytics */}
        {patients.length > 0 && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, paddingLeft: 4,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--dosy-fg-secondary)',
              fontFamily: 'var(--dosy-font-display)',
            }}>
              Paciente
            </div>
            <div style={{
              display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
              scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}>
              <button
                type="button"
                onClick={() => setPatientId('')}
                style={chipStyle(!patientId)}
              >
                Todos
              </button>
              {patients.map((p) => {
                const active = patientId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPatientId(active ? '' : p.id)}
                    style={{ ...chipStyle(active), paddingLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <PatientAvatar patient={p} size={22} />
                    <span style={{ paddingRight: 4 }}>{p.name.split(' ')[0]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* PERÍODO — chips presets + Definir custom */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, paddingLeft: 4,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--dosy-fg-secondary)',
            fontFamily: 'var(--dosy-font-display)',
          }}>
            Período
          </div>
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}>
            <button type="button" onClick={() => applyPreset(7)} style={chipStyle(periodPreset === '7')}>7 dias</button>
            <button type="button" onClick={() => applyPreset(10)} style={chipStyle(periodPreset === '10')}>10 dias</button>
            <button type="button" onClick={() => applyPreset(30)} style={chipStyle(periodPreset === '30')}>30 dias</button>
            <button type="button" onClick={() => applyPreset(365)} style={chipStyle(periodPreset === '365')}>1 ano</button>
            <button type="button" onClick={() => setPeriodPreset('custom')} style={chipStyle(periodPreset === 'custom')}>Definir</button>
          </div>
        </div>

        {/* DATE PICKERS — só visível em 'custom' */}
        {periodPreset === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
          >
            <Input
              label="De"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              label="Até"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </motion.div>
        )}

        {/* PERÍODO ATUAL display read-only quando não-custom */}
        {periodPreset !== 'custom' && (
          <div style={{
            fontSize: 12, color: 'var(--dosy-fg-secondary)', textAlign: 'center',
            padding: '4px 8px',
          }}>
            {fmtDateInput(from)} → {fmtDateInput(to)}
          </div>
        )}

        {/* HERO RESUMO — gradient peach gauge + sub-stats */}
        {stats.total > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: TIMING.base, ease: EASE.inOut }}
            style={{
              background: 'var(--dosy-gradient-sunset)',
              borderRadius: 24,
              padding: 20,
              color: 'white',
              boxShadow: '0 12px 32px -8px rgba(255, 107, 91, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ReportGauge percent={adherencePct ?? 0} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', opacity: 0.9, marginBottom: 4,
                }}>
                  {patient?.name || 'Todos pacientes'}
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 800, lineHeight: 1.1,
                  fontFamily: 'var(--dosy-font-display)', marginBottom: 6,
                }}>
                  Adesão {adherencePct}%
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>
                  {stats.done} de {stats.total} doses
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 16, paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,0.22)',
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
            }}>
              <HeroStatBox icon={CheckCircle2} value={stats.done} label="Tomadas"/>
              <HeroStatBox icon={XCircle} value={stats.skipped} label="Puladas"/>
              <HeroStatBox icon={AlertCircle} value={stats.overdue} label="Atrasadas"/>
              <HeroStatBox icon={Clock} value={stats.pending} label="Pendentes"/>
            </div>
          </motion.div>
        )}

        {/* DISTRIBUIÇÃO — stacked horizontal bar visual */}
        {stats.total > 0 && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
            <Card padding={16}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 12,
              }}>
                <h3 style={{
                  fontFamily: 'var(--dosy-font-display)',
                  fontWeight: 700, fontSize: 14, margin: 0,
                  color: 'var(--dosy-fg)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <BarChart3 size={14} strokeWidth={2.25} style={{ color: 'var(--dosy-primary)' }}/>
                  Distribuição
                </h3>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--dosy-fg-secondary)',
                }}>{stats.total} doses</span>
              </div>
              <div style={{
                display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden',
                background: 'var(--dosy-bg-sunken)', marginBottom: 12,
              }}>
                {stats.done > 0 && <div style={{ width: `${(stats.done/stats.total)*100}%`, background: '#3F9E7E' }}/>}
                {stats.skipped > 0 && <div style={{ width: `${(stats.skipped/stats.total)*100}%`, background: '#C5841A' }}/>}
                {stats.overdue > 0 && <div style={{ width: `${(stats.overdue/stats.total)*100}%`, background: 'var(--dosy-danger)' }}/>}
                {stats.pending > 0 && <div style={{ width: `${(stats.pending/stats.total)*100}%`, background: 'var(--dosy-fg-tertiary)' }}/>}
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                fontSize: 11,
              }}>
                <LegendRow color="#3F9E7E" label="Tomadas" value={stats.done} pct={stats.total ? Math.round(stats.done/stats.total*100) : 0}/>
                <LegendRow color="#C5841A" label="Puladas" value={stats.skipped} pct={stats.total ? Math.round(stats.skipped/stats.total*100) : 0}/>
                <LegendRow color="var(--dosy-danger)" label="Atrasadas" value={stats.overdue} pct={stats.total ? Math.round(stats.overdue/stats.total*100) : 0}/>
                <LegendRow color="var(--dosy-fg-tertiary)" label="Pendentes" value={stats.pending} pct={stats.total ? Math.round(stats.pending/stats.total*100) : 0}/>
              </div>
            </Card>
          </motion.div>
        )}

        {/* TOP MEDS RANKING */}
        {topMeds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
            <Card padding={16}>
              <h3 style={{
                fontFamily: 'var(--dosy-font-display)',
                fontWeight: 700, fontSize: 14, margin: '0 0 12px 0',
                color: 'var(--dosy-fg)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Pill size={14} strokeWidth={2.25} style={{ color: 'var(--dosy-primary)' }}/>
                Top medicamentos
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topMeds.map((m, i) => (
                  <div key={m.name} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 10,
                      background: 'var(--dosy-peach-100, #FEE0D6)',
                      color: 'var(--dosy-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800,
                      fontFamily: 'var(--dosy-font-display)',
                      flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--dosy-fg)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{m.name}</div>
                      <div style={{
                        height: 4, borderRadius: 999, marginTop: 4,
                        background: 'var(--dosy-bg-sunken)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          background: m.pct >= 80 ? '#3F9E7E' : m.pct >= 50 ? '#F2B441' : 'var(--dosy-danger)',
                          width: `${m.pct}%`,
                        }}/>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 800, color: 'var(--dosy-fg)',
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: 'var(--dosy-font-display)',
                      }}>{m.count}</div>
                      <div style={{ fontSize: 10, color: 'var(--dosy-fg-tertiary)' }}>{m.pct}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        <Card padding={0}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--dosy-divider)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--dosy-fg-secondary)',
              fontFamily: 'var(--dosy-font-display)',
            }}>Detalhamento ({doses.length})</span>
            {adherencePct != null && (
              <span style={{
                fontSize: 12, fontWeight: 800,
                color: adherencePct >= 80 ? '#3F9E7E' : adherencePct >= 50 ? '#C5841A' : 'var(--dosy-danger)',
                fontFamily: 'var(--dosy-font-display)',
                fontVariantNumeric: 'tabular-nums',
              }}>{adherencePct}% adesão</span>
            )}
          </div>
          {isLoading ? (
            <div style={{
              padding: '32px 16px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <Loader2 size={28} strokeWidth={1.75} className="animate-spin" style={{ color: 'var(--dosy-primary)' }}/>
              <p style={{ fontSize: 12, color: 'var(--dosy-fg-tertiary)', margin: 0 }}>Carregando doses…</p>
            </div>
          ) : doses.length === 0 ? (
            <div style={{
              padding: '32px 16px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'var(--dosy-peach-100, #FEE0D6)',
                color: 'var(--dosy-primary)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Calendar size={28} strokeWidth={1.75}/>
              </div>
              <p style={{
                fontSize: 14, fontWeight: 600, color: 'var(--dosy-fg)',
                margin: 0, fontFamily: 'var(--dosy-font-display)',
              }}>Sem doses no período</p>
              <p style={{
                fontSize: 12, color: 'var(--dosy-fg-tertiary)', margin: 0,
                maxWidth: 240, lineHeight: 1.4,
              }}>Tente um período mais amplo ou outro paciente</p>
            </div>
          ) : (
            <ul style={{
              maxHeight: 320, overflowY: 'auto',
              listStyle: 'none', margin: 0, padding: 0,
            }}>
              {doses.slice(0, 50).map((d, i) => {
                const p = patients.find((x) => x.id === d.patientId)
                const statusColor = STATUS_DOSY_COLOR[d.status] || 'var(--dosy-fg-secondary)'
                const statusBg = d.status === 'done' ? '#DDF1E8'
                  : d.status === 'skipped' ? '#FCEFCF'
                  : d.status === 'overdue' ? '#FCE6E2'
                  : 'var(--dosy-bg-sunken)'
                return (
                  <li key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--dosy-divider)',
                  }}>
                    {!patientId && p && (
                      <PatientAvatar patient={p} size={28} />
                    )}
                    {(patientId || !p) && (
                      <div style={{
                        width: 28, height: 28, borderRadius: 10,
                        background: 'var(--dosy-peach-100, #FEE0D6)',
                        color: 'var(--dosy-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Pill size={14} strokeWidth={2.25}/>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, margin: 0,
                        color: 'var(--dosy-fg)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.medName}</span>
                        {d.type === 'sos' && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
                            padding: '1px 6px', borderRadius: 999,
                            background: 'var(--dosy-danger)', color: 'white',
                            flexShrink: 0,
                          }}>SOS</span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 11, color: 'var(--dosy-fg-tertiary)',
                        margin: '2px 0 0 0', fontVariantNumeric: 'tabular-nums',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {!patientId && p && <><span>{p.name.split(' ')[0]}</span><span style={{ opacity: 0.4 }}>·</span></>}
                        <span>{formatDate(d.scheduledAt)} {formatTime(d.scheduledAt)}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, flexShrink: 0,
                      padding: '4px 10px', borderRadius: 999,
                      background: statusBg, color: statusColor,
                      fontFamily: 'var(--dosy-font-display)',
                      letterSpacing: '0.02em',
                    }}>{statusLabel(d.status)}</span>
                  </li>
                )
              })}
              {doses.length > 50 && (
                <li style={{
                  padding: '8px 16px', textAlign: 'center',
                  fontSize: 11, color: 'var(--dosy-fg-tertiary)',
                  borderTop: '1px solid var(--dosy-divider)',
                }}>+{doses.length - 50} mais no export</li>
              )}
            </ul>
          )}
        </Card>

        {!isPro && (
          <Card padding={12} style={{
            background: 'var(--dosy-warning-bg)',
            border: '1px solid rgba(197,132,26,0.2)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <Lock size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2, color: '#C5841A' }}/>
            <span style={{ fontSize: 12, color: '#C5841A', lineHeight: 1.4 }}>
              Exportar PDF/CSV é recurso <strong>PRO</strong>. Toque num botão para assinar.
            </span>
          </Card>
        )}

        <Button
          kind="primary"
          full
          size="lg"
          icon={exporting === 'pdf' ? Loader2 : (!isPro ? Lock : FileText)}
          disabled={!!exporting}
          onClick={gate(exportPDF)}
        >
          {exporting === 'pdf' ? 'Gerando PDF…' : 'Exportar PDF'}
        </Button>

        <Button
          kind="secondary"
          full
          size="lg"
          icon={exporting === 'csv' ? Loader2 : (!isPro ? Lock : BarChart3)}
          disabled={!!exporting}
          onClick={gate(exportCSV)}
        >
          {exporting === 'csv' ? 'Gerando CSV…' : 'Exportar CSV'}
        </Button>
      </div>

      <PaywallModal
        open={paywall}
        onClose={() => setPaywall(false)}
        reason="Exportar PDF e CSV é um recurso PRO. Assine para liberar relatórios completos."
      />
    </motion.div>
  )
}

function ReportGauge({ percent, size = 84, stroke = 9 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke}/>
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke="white" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: EASE.out }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--dosy-font-display)' }}>{percent}</div>
        <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.85, marginTop: 1 }}>%</div>
      </div>
    </div>
  )
}

function HeroStatBox({ icon: Icon, value, label }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <Icon size={14} strokeWidth={2} style={{ opacity: 0.85 }}/>
      <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--dosy-font-display)' }}>{value}</div>
      <div style={{
        fontSize: 9, fontWeight: 600, opacity: 0.85,
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  )
}

function LegendRow({ color, label, value, pct }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }}/>
      <span style={{ color: 'var(--dosy-fg-secondary)', flex: 1, minWidth: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--dosy-fg)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{value}</span>
      <span style={{ color: 'var(--dosy-fg-tertiary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: 10 }}>({pct}%)</span>
    </div>
  )
}

function chipStyle(active) {
  return {
    flexShrink: 0,
    padding: '6px 12px',
    borderRadius: 999,
    background: active ? 'var(--dosy-primary)' : 'var(--dosy-bg-elevated)',
    color: active ? 'white' : 'var(--dosy-fg)',
    border: active ? 'none' : '1.5px solid var(--dosy-border)',
    fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 180ms',
    boxShadow: active ? '0 4px 10px -2px rgba(255,107,91,0.4)' : 'var(--dosy-shadow-xs)',
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
