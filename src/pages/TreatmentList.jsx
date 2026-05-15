import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Pill, Search, Pause, Play, StopCircle, ChevronDown, ChevronUp, Filter, X } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import AdBanner from '../components/AdBanner'
import { Card, IconButton, Button, Input, StatusPill } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import PatientAvatar from '../components/PatientAvatar'
import { SkeletonList } from '../components/Skeleton'
import {
  useTreatments,
  usePauseTreatment,
  useResumeTreatment,
  useEndTreatment,
} from '../hooks/useTreatments'
import { usePatients } from '../hooks/usePatients'
import { useToast } from '../hooks/useToast'
import { formatDate } from '../utils/dateUtils'

// v0.2.3.5 #240 — Treatments redesign: filtro paciente chips + Ativos collapsable +
// cards visuais com avatar paciente + ícone pill colorido + hero stats compactos.
// Mantém logic effectiveStatus + status config + actions handlers.

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
  const [patientFilter, setPatientFilter] = useState(null)
  const { data: all = [], isLoading: loadingTreatments } = useTreatments()
  const pauseMut = usePauseTreatment()
  const resumeMut = useResumeTreatment()
  const endMut = useEndTreatment()
  const toast = useToast()

  // Section collapse — Ativos default expandido, Pausados expandido, Encerrados colapsado.
  // v0.2.3.5 #240: Ativos agora também collapsable.
  const [collapsed, setCollapsed] = useState({ active: false, paused: false, ended: true })
  const toggleSection = (k) => setCollapsed((s) => ({ ...s, [k]: !s[k] }))

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const filtered = all.filter((t) => {
      if (t.isTemplate) return false
      if (patientFilter && t.patientId !== patientFilter) return false
      if (!term) return true
      return t.medName.toLowerCase().includes(term)
    })
    const sorted = [...filtered].sort(BY_CREATED_ASC)
    const out = { active: [], paused: [], ended: [] }
    for (const t of sorted) {
      const s = effectiveStatus(t)
      if (s === 'active') out.active.push(t)
      else if (s === 'paused') out.paused.push(t)
      else out.ended.push(t)
    }
    return out
  }, [all, q, patientFilter])

  function patientName(id) { return patients.find((p) => p.id === id)?.name || '—' }
  function patientById(id) { return patients.find((p) => p.id === id) }

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
  const hasFilter = q || patientFilter

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

        {/* HERO STATS COMPACT — only when data exists */}
        {!loadingTreatments && all.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: TIMING.base, ease: EASE.inOut }}
            style={{
              background: 'var(--dosy-gradient-sunset)',
              borderRadius: 20,
              padding: 16,
              color: 'white',
              boxShadow: '0 8px 24px -6px rgba(255, 107, 91, 0.35)',
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            }}
          >
            <StatBox label="Ativos" value={groups.active.length} />
            <StatBox label="Pausados" value={groups.paused.length} />
            <StatBox label="Encerrados" value={groups.ended.length} />
          </motion.div>
        )}

        {/* SEARCH + PATIENT FILTER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input
            icon={Search}
            placeholder="Buscar por medicamento…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {patients.length > 0 && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, paddingLeft: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--dosy-fg-secondary)',
                fontFamily: 'var(--dosy-font-display)',
              }}>
                <Filter size={11} strokeWidth={2.5} /> Filtrar por paciente
              </div>
              <div style={{
                display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
                scrollbarWidth: 'none', msOverflowStyle: 'none',
              }}>
                <button
                  type="button"
                  onClick={() => setPatientFilter(null)}
                  style={chipStyle(patientFilter === null)}
                >
                  Todos
                </button>
                {patients.map((p) => {
                  const active = patientFilter === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPatientFilter(active ? null : p.id)}
                      style={{ ...chipStyle(active), paddingLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <PatientAvatar patient={p} size={22} />
                      <span style={{ paddingRight: 4 }}>{p.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {loadingTreatments ? (
          <SkeletonList count={3} />
        ) : total === 0 ? (
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
            }}>{hasFilter ? 'Nenhum resultado' : 'Nenhum tratamento'}</h3>
            <p style={{
              fontSize: 14, color: 'var(--dosy-fg-secondary)',
              lineHeight: 1.5, margin: 0,
            }}>
              {hasFilter
                ? 'Tente ajustar busca ou filtro de paciente'
                : 'Crie um novo tratamento pelo botão +'}
            </p>
            {hasFilter && (
              <Button kind="secondary" size="sm" onClick={() => { setQ(''); setPatientFilter(null) }} icon={X}>
                Limpar filtros
              </Button>
            )}
          </Card>
        ) : (
          <>
            {groups.active.length > 0 && (
              <CollapsibleSection
                title="Ativos"
                count={groups.active.length}
                kind="success"
                collapsed={collapsed.active}
                onToggle={() => toggleSection('active')}
              >
                {groups.active.map((t, i) => (
                  <TreatmentCard
                    key={t.id}
                    t={t}
                    i={i}
                    patient={patientById(t.patientId)}
                    patientName={patientName(t.patientId)}
                    actions={[
                      { kind: 'secondary', icon: Pause, label: 'Pausar', onClick: () => handlePause(t), disabled: pauseMut.isPending },
                      { kind: 'ghost-danger', icon: StopCircle, label: 'Encerrar', onClick: () => handleEnd(t), disabled: endMut.isPending },
                    ]}
                  />
                ))}
              </CollapsibleSection>
            )}

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
                    patient={patientById(t.patientId)}
                    patientName={patientName(t.patientId)}
                    actions={[
                      { kind: 'primary', icon: Play, label: 'Retomar', onClick: () => handleResume(t), disabled: resumeMut.isPending },
                      { kind: 'ghost-danger', icon: StopCircle, label: 'Encerrar', onClick: () => handleEnd(t), disabled: endMut.isPending },
                    ]}
                  />
                ))}
              </CollapsibleSection>
            )}

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
                    patient={patientById(t.patientId)}
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

function StatBox({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 24, fontWeight: 800, lineHeight: 1,
        fontFamily: 'var(--dosy-font-display)',
      }}>{value}</div>
      <div style={{
        fontSize: 10, fontWeight: 600, opacity: 0.9, marginTop: 4,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>{label}</div>
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

function TreatmentCard({ t, i, patient, patientName, actions = [], readOnly }) {
  const eff = effectiveStatus(t)
  const cfg = STATUS_CONFIG[eff]
  const ed = endDateOf(t)
  const isInactive = eff === 'paused' || eff === 'ended' || eff === 'auto-ended'

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.out, delay: Math.min(i * TIMING.stagger, 0.3) }}
    >
      <Card padding={14} style={isInactive ? { opacity: 0.78 } : undefined}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* PILL ICON LEFT */}
          <div style={{
            width: 42, height: 42, flexShrink: 0,
            borderRadius: 14,
            background: eff === 'active'
              ? 'var(--dosy-peach-100, #FEE0D6)'
              : 'var(--dosy-bg)',
            color: eff === 'active' ? 'var(--dosy-primary)' : 'var(--dosy-fg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Pill size={20} strokeWidth={2} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--dosy-font-display)',
                  fontWeight: 700, fontSize: 15.5,
                  letterSpacing: '-0.02em', color: 'var(--dosy-fg)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{t.medName}</div>
                <div style={{
                  fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 2,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {patient && <PatientAvatar patient={patient} size={16} />}
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {patientName}
                  </span>
                </div>
              </div>
              <StatusPill label={cfg.label} kind={cfg.kind}/>
            </div>

            <div style={{
              fontSize: 11.5, color: 'var(--dosy-fg-secondary)', marginTop: 6,
              display: 'flex', flexWrap: 'wrap', gap: 8,
            }}>
              <span>{t.unit}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{t.intervalHours ? `a cada ${t.intervalHours}h` : 'horários fixos'}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{t.isContinuous ? '♾ contínuo' : `${t.durationDays} ${t.durationDays === 1 ? 'dia' : 'dias'}`}</span>
            </div>

            {ed && (
              <div style={{
                fontSize: 11, color: 'var(--dosy-fg-tertiary)', marginTop: 6,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {(() => {
                  // v0.2.3.6 #263 fix: "Termina hoje" / "Amanhã" relative quando próximo
                  const today = new Date(); today.setHours(0,0,0,0)
                  const edDay = new Date(ed); edDay.setHours(0,0,0,0)
                  const diffDays = Math.round((edDay - today) / 86400000)
                  if (eff === 'auto-ended') return `Encerrado em ${formatDate(ed.toISOString())}`
                  if (diffDays === 0) return 'Termina hoje'
                  if (diffDays === 1) return 'Termina amanhã'
                  return `Termina em ${formatDate(ed.toISOString())}`
                })()}
              </div>
            )}
          </div>
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
