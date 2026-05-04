import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Pill, Search, Pause, Play, StopCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import AdBanner from '../components/AdBanner'
import { Card, IconButton, Button, Input, StatusPill } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import {
  useTreatments,
  usePauseTreatment,
  useResumeTreatment,
  useEndTreatment,
} from '../hooks/useTreatments'
import { usePatients } from '../hooks/usePatients'
import { useToast } from '../hooks/useToast'
import { formatDate } from '../utils/dateUtils'

// Logica:
// - active     : doses futuras agendadas, alarmes disparam
// - paused     : doses futuras canceladas, alarmes parados, REVERSIVEL via Retomar
// - ended      : doses futuras canceladas permanentemente, sem retomada
// - auto-ended : status='active' mas endDate < now → finalizado por data (visual)
//
// Sort: createdAt asc (mais antigo primeiro = sequencia cronologica natural).
// Sections: Ativos / Pausados / Encerrados (collapsable).

function endDateOf(t) {
  if (t.isContinuous) return null
  if (!t.startDate || !t.durationDays) return null
  const d = new Date(t.startDate)
  d.setDate(d.getDate() + Number(t.durationDays))
  return d
}

function effectiveStatus(t) {
  if (t.status === 'paused') return 'paused'
  if (t.status === 'ended') return 'ended'
  // active: check if endDate passed
  const ed = endDateOf(t)
  if (ed && ed.getTime() < Date.now()) return 'auto-ended'
  return 'active'
}

const STATUS_CONFIG = {
  active:       { label: 'Ativo',           kind: 'success' },
  paused:       { label: 'Pausado',         kind: 'pending' },
  ended:        { label: 'Encerrado',       kind: 'skipped' },
  'auto-ended': { label: 'Encerrado (data)', kind: 'skipped' },
}

const BY_CREATED_ASC = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')

export default function TreatmentList() {
  const { data: patients = [] } = usePatients()
  const [q, setQ] = useState('')
  const { data: all = [] } = useTreatments()
  const pauseMut = usePauseTreatment()
  const resumeMut = useResumeTreatment()
  const endMut = useEndTreatment()
  const toast = useToast()

  // Section collapse persistence (lightweight)
  const [collapsed, setCollapsed] = useState({ paused: false, ended: true })
  const toggleSection = (k) => setCollapsed((s) => ({ ...s, [k]: !s[k] }))

  // Filtered + grouped
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const filtered = all.filter((t) => {
      if (t.isTemplate) return false
      if (!term) return true
      return t.medName.toLowerCase().includes(term)
    })
    const sorted = [...filtered].sort(BY_CREATED_ASC)
    const out = { active: [], paused: [], ended: [] }
    for (const t of sorted) {
      const s = effectiveStatus(t)
      if (s === 'active') out.active.push(t)
      else if (s === 'paused') out.paused.push(t)
      else out.ended.push(t) // ended + auto-ended both go to encerrados section
    }
    return out
  }, [all, q])

  function patientName(id) { return patients.find((p) => p.id === id)?.name || '—' }

  async function handlePause(t) {
    try {
      await pauseMut.mutateAsync(t.id)
      toast.show({ message: `${t.medName} pausado. Alarmes futuros cancelados.`, kind: 'success' })
    } catch (e) {
      toast.show({ message: e?.message || 'Falha ao pausar.', kind: 'error' })
    }
  }
  async function handleResume(t) {
    try {
      await resumeMut.mutateAsync(t.id)
      toast.show({ message: `${t.medName} retomado.`, kind: 'success' })
    } catch (e) {
      toast.show({ message: e?.message || 'Falha ao retomar.', kind: 'error' })
    }
  }
  async function handleEnd(t) {
    if (!confirm(`Encerrar tratamento "${t.medName}"? Doses futuras canceladas. Esta ação não pode ser desfeita.`)) return
    try {
      await endMut.mutateAsync(t.id)
      toast.show({ message: `${t.medName} encerrado.`, kind: 'success' })
    } catch (e) {
      toast.show({ message: e?.message || 'Falha ao encerrar.', kind: 'error' })
    }
  }

  const total = groups.active.length + groups.paused.length + groups.ended.length

  return (
    <div style={{ paddingBottom: 110 }}>
      <PageHeader
        title="Tratamentos"
        back
        right={
          <Link to="/tratamento/novo" aria-label="Novo tratamento" style={{ textDecoration: 'none' }}>
            <IconButton icon={Plus} kind="sunset"/>
          </Link>
        }
      />

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AdBanner />

        <Input
          icon={Search}
          placeholder="Buscar por medicamento…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {total === 0 ? (
          <Card padding={28} style={{
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'var(--dosy-peach-100)',
              color: 'var(--dosy-primary)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Pill size={32} strokeWidth={2}/>
            </div>
            <h3 style={{
              fontFamily: 'var(--dosy-font-display)', fontWeight: 800,
              fontSize: 20, letterSpacing: '-0.02em', color: 'var(--dosy-fg)',
              margin: 0,
            }}>Nenhum tratamento</h3>
            <p style={{
              fontSize: 14, color: 'var(--dosy-fg-secondary)',
              lineHeight: 1.5, margin: 0,
            }}>Crie um novo tratamento pelo botão +</p>
          </Card>
        ) : (
          <>
            {/* Ativos */}
            {groups.active.length > 0 && (
              <Section title="Ativos" count={groups.active.length} kind="success">
                {groups.active.map((t, i) => (
                  <TreatmentCard
                    key={t.id}
                    t={t}
                    i={i}
                    patientName={patientName(t.patientId)}
                    actions={[
                      { kind: 'secondary', icon: Pause, label: 'Pausar', onClick: () => handlePause(t), disabled: pauseMut.isPending },
                      { kind: 'ghost-danger', icon: StopCircle, label: 'Encerrar', onClick: () => handleEnd(t), disabled: endMut.isPending },
                    ]}
                  />
                ))}
              </Section>
            )}

            {/* Pausados */}
            {groups.paused.length > 0 && (
              <CollapsibleSection
                title="Pausados"
                count={groups.paused.length}
                kind="pending"
                collapsed={collapsed.paused}
                onToggle={() => toggleSection('paused')}
              >
                {groups.paused.map((t, i) => (
                  <TreatmentCard
                    key={t.id}
                    t={t}
                    i={i}
                    patientName={patientName(t.patientId)}
                    actions={[
                      { kind: 'primary', icon: Play, label: 'Retomar', onClick: () => handleResume(t), disabled: resumeMut.isPending },
                      { kind: 'ghost-danger', icon: StopCircle, label: 'Encerrar', onClick: () => handleEnd(t), disabled: endMut.isPending },
                    ]}
                  />
                ))}
              </CollapsibleSection>
            )}

            {/* Encerrados */}
            {groups.ended.length > 0 && (
              <CollapsibleSection
                title="Encerrados"
                count={groups.ended.length}
                kind="skipped"
                collapsed={collapsed.ended}
                onToggle={() => toggleSection('ended')}
              >
                {groups.ended.map((t, i) => (
                  <TreatmentCard
                    key={t.id}
                    t={t}
                    i={i}
                    patientName={patientName(t.patientId)}
                    readOnly
                  />
                ))}
              </CollapsibleSection>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, count, kind, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionHeader title={title} count={count} kind={kind}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

function CollapsibleSection({ title, count, kind, collapsed, onToggle, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        onClick={onToggle}
        className="dosy-press"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <SectionHeader title={title} count={count} kind={kind}/>
        <span style={{
          color: 'var(--dosy-fg-tertiary)',
          display: 'inline-flex',
          marginLeft: 'auto',
        }}>
          {collapsed ? <ChevronDown size={18} strokeWidth={2}/> : <ChevronUp size={18} strokeWidth={2}/>}
        </span>
      </button>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, count, kind }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flex: 1,
      padding: '4px 4px',
    }}>
      <h2 style={{
        fontFamily: 'var(--dosy-font-display)',
        fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em',
        color: 'var(--dosy-fg)', margin: 0,
        textTransform: 'uppercase',
      }}>{title}</h2>
      <StatusPill label={String(count)} kind={kind}/>
    </div>
  )
}

function TreatmentCard({ t, i, patientName, actions = [], readOnly }) {
  const eff = effectiveStatus(t)
  const cfg = STATUS_CONFIG[eff]
  const ed = endDateOf(t)
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.out, delay: Math.min(i * TIMING.stagger, 0.3) }}
    >
      <Card padding={16}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--dosy-font-display)',
              fontWeight: 700, fontSize: 15.5,
              letterSpacing: '-0.02em', color: 'var(--dosy-fg)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{t.medName}</div>
            <div style={{
              fontSize: 12.5, color: 'var(--dosy-fg-secondary)', marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {patientName} · {t.unit} · {t.intervalHours ? `${t.intervalHours}h` : 'horários'}
              {t.isContinuous ? ' · ♾ Contínuo' : ` · ${t.durationDays} dias`}
            </div>
            {ed && (
              <div style={{
                fontSize: 11, color: 'var(--dosy-fg-tertiary)', marginTop: 4,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {eff === 'auto-ended' ? `Encerrado em ${formatDate(ed.toISOString())}` : `Termina em ${formatDate(ed.toISOString())}`}
              </div>
            )}
          </div>
          <StatusPill label={cfg.label} kind={cfg.kind}/>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/tratamento/${t.id}`} style={{ textDecoration: 'none', flex: 1 }}>
            <Button kind="secondary" size="sm" full>{readOnly ? 'Ver detalhes' : 'Editar'}</Button>
          </Link>
          {actions.map((a, idx) => (
            <Button
              key={idx}
              kind={a.kind === 'ghost-danger' ? 'ghost' : a.kind}
              size="sm"
              icon={a.icon}
              onClick={a.onClick}
              disabled={a.disabled}
              style={a.kind === 'ghost-danger' ? { color: 'var(--dosy-danger)' } : undefined}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </Card>
    </motion.div>
  )
}
