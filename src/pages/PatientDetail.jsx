import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit3, Stethoscope, AlertTriangle, Share2, Users, Lock, Plus, Pill, ChevronRight, ChevronDown } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import AdBanner from '../components/AdBanner'
import SharePatientSheet from '../components/SharePatientSheet'
import DoseCard from '../components/DoseCard'
import DoseModal from '../components/DoseModal'
import { Avatar, Card, StatusPill, SectionTitle } from '../components/dosy'
import { MiniStat } from '../components/dosy/MiniStat'
import PageHeader from '../components/dosy/PageHeader'
import { usePatient } from '../hooks/usePatients'
import { primePatientPhotoCache } from '../hooks/usePatientPhoto'
import { useTreatments } from '../hooks/useTreatments'
import { useDoses, useConfirmDose, useSkipDose, useUndoDose } from '../hooks/useDoses'
import { usePatientShares } from '../hooks/useShares'
import { useAuth } from '../hooks/useAuth'
import { useIsPro } from '../hooks/useSubscription'
import { useToast } from '../hooks/useToast'
import PaywallModal from '../components/PaywallModal'
import { usePrivacyScreen } from '../hooks/usePrivacyScreen'

// #160 (v0.2.1.2) — Treatment status logic copy de TreatmentList.jsx.
// Mantém parity: paused/ended explicit + auto-ended (active mas endDate < now).
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

const BY_CREATED_ASC = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')

export default function PatientDetail() {
  // Aud 4.5.4 G2 — info médica de paciente
  usePrivacyScreen()
  const { id } = useParams()
  const { user } = useAuth()
  const { data: patient } = usePatient(id)
  const { data: treatments = [] } = useTreatments({ patientId: id })
  const { data: shares = [] } = usePatientShares(id)
  const isPro = useIsPro()
  const toast = useToast()
  const confirmMut = useConfirmDose()
  const skipMut = useSkipDose()
  const undoMut = useUndoDose()
  const [shareOpen, setShareOpen] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [selectedDose, setSelectedDose] = useState(null)
  // #160 — filtro segmentado lista doses paciente
  const [doseFilter, setDoseFilter] = useState('24h') // '24h' | 'all'
  // #160 — collapse state pra 3 seções tratamentos
  const [collapsed, setCollapsed] = useState({ paused: true, ended: true })
  const toggleSection = (k) => setCollapsed((s) => ({ ...s, [k]: !s[k] }))

  // Item #115: detail page tem photo_url full carregado. Pré-aquece cache
  // local pra acelerar próximo render da lista (skip 1 round-trip).
  useEffect(() => {
    if (patient?.id && patient?.photo_url && patient?.photo_version) {
      primePatientPhotoCache(patient.id, patient.photo_version, patient.photo_url)
    }
  }, [patient?.id, patient?.photo_version, patient?.photo_url])

  // Doses HOJE (stat card "Doses Hoje X de Y")
  const startOfToday = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const endOfToday = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }, [])
  const { data: todayDoses = [] } = useDoses({
    patientId: id,
    from: startOfToday.toISOString(),
    to: endOfToday.toISOString(),
  })
  const taken = todayDoses.filter((d) => d.status === 'done').length
  const totalToday = todayDoses.length

  // Doses lista paciente: 24h (rolling -12h/+12h) ou todas (-30d/+60d cobrindo escopo razoável)
  // Janela rolling 12h matches Dashboard '24h' filter UX
  const listWindow = useMemo(() => {
    const now = new Date()
    if (doseFilter === '24h') {
      const past = new Date(now); past.setHours(now.getHours() - 12)
      const future = new Date(now); future.setHours(now.getHours() + 12)
      return { from: past.toISOString(), to: future.toISOString() }
    }
    // 'all' — janela ampla -30d / +60d (suficiente histórico paciente, evita pull infinito)
    const past = new Date(now); past.setDate(now.getDate() - 30)
    const future = new Date(now); future.setDate(now.getDate() + 60)
    return { from: past.toISOString(), to: future.toISOString() }
  }, [doseFilter])

  const { data: listDoses = [] } = useDoses({
    patientId: id,
    from: listWindow.from,
    to: listWindow.to,
  })
  // Sort lista cronológico ascending (mais antigo → futuro)
  const sortedListDoses = useMemo(
    () => [...listDoses].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)),
    [listDoses]
  )

  // Treatment groups por status efetivo (#160 fix bug atual incluir encerrados em "ativos")
  const treatmentGroups = useMemo(() => {
    const sorted = [...treatments]
      .filter((t) => !t.isTemplate)
      .sort(BY_CREATED_ASC)
    const out = { active: [], paused: [], ended: [] }
    for (const t of sorted) {
      const s = effectiveStatus(t)
      if (s === 'active') out.active.push(t)
      else if (s === 'paused') out.paused.push(t)
      else out.ended.push(t) // ended + auto-ended
    }
    return out
  }, [treatments])

  if (!patient) {
    return (
      <div>
        <PageHeader title="Paciente" back/>
        <p style={{
          padding: 16,
          fontSize: 14, color: 'var(--dosy-fg-secondary)',
          fontFamily: 'var(--dosy-font-body)',
        }}>Carregando…</p>
      </div>
    )
  }

  const isOwner = user && patient.userId === user.id

  return (
    <motion.div
      style={{ paddingBottom: 110 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.inOut }}
    >
      <PageHeader
        title={patient.name}
        back
        right={
          <Link
            to={`/pacientes/${id}/editar`}
            aria-label="Editar"
            className="dosy-press"
            style={{
              width: 38, height: 38, borderRadius: 9999,
              background: 'var(--dosy-bg-elevated)',
              color: 'var(--dosy-fg)',
              boxShadow: 'var(--dosy-shadow-sm)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', flexShrink: 0,
            }}
          >
            <Edit3 size={18} strokeWidth={1.75}/>
          </Link>
        }
      />

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AdBanner />

        {/* Hero patient — avatar grande + nome + idade·peso·condição */}
        <Card padding={20} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          {patient.photo_url ? (
            <div style={{
              width: 92, height: 92, borderRadius: 9999,
              overflow: 'hidden', flexShrink: 0,
            }}>
              <img
                src={patient.photo_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <Avatar emoji={patient.avatar || '🙂'} color="peach" size={92}/>
          )}
          <div style={{
            fontFamily: 'var(--dosy-font-display)', fontWeight: 800,
            fontSize: 26, letterSpacing: '-0.025em', textAlign: 'center',
            color: 'var(--dosy-fg)',
          }}>{patient.name}</div>
          <div style={{
            fontSize: 13.5, color: 'var(--dosy-fg-secondary)', textAlign: 'center',
          }}>
            {patient.age ? `${patient.age} anos` : 'Idade não informada'}
            {patient.weight ? ` · ${String(patient.weight).replace('.', ',')} kg` : ''}
            {patient.condition ? ` · ${patient.condition}` : ''}
          </div>
        </Card>

        {/* Doctor + alergias */}
        {(patient.doctor || patient.allergies) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patient.doctor && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: 'var(--dosy-bg-elevated)',
                borderRadius: 14, boxShadow: 'var(--dosy-shadow-xs)',
              }}>
                <Stethoscope size={18} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-secondary)' }}/>
                <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--dosy-fg)' }}>
                  {patient.doctor}
                </div>
              </div>
            )}
            {patient.allergies && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: 'var(--dosy-danger-bg)',
                borderRadius: 14,
              }}>
                <AlertTriangle size={18} strokeWidth={1.75} style={{ color: 'var(--dosy-danger)' }}/>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--dosy-danger)', fontWeight: 600 }}>
                  Alergias: {patient.allergies}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compartilhar (Pro) ou banner shared-with-me */}
        {isOwner ? (
          <button
            type="button"
            onClick={() => isPro ? setShareOpen(true) : setPaywallOpen(true)}
            className="dosy-press"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
              background: 'var(--dosy-bg-elevated)',
              borderRadius: 14, cursor: 'pointer',
              boxShadow: 'var(--dosy-shadow-xs)',
              border: 'none', textAlign: 'left',
              width: '100%', color: 'var(--dosy-fg)',
              fontFamily: 'var(--dosy-font-body)',
            }}
          >
            <Share2 size={18} strokeWidth={1.75}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Compartilhar paciente</div>
              <div style={{ fontSize: 11.5, color: 'var(--dosy-fg-secondary)', marginTop: 1 }}>
                {shares.length > 0
                  ? `Compartilhado com ${shares.length} pessoa${shares.length > 1 ? 's' : ''}`
                  : 'Trabalhe em conjunto com outro usuário · PRO'}
              </div>
            </div>
            {shares.length > 0 && (
              <StatusPill label={`${shares.length} cuidador${shares.length > 1 ? 'es' : ''}`} kind="info"/>
            )}
            {!isPro && <Lock size={14} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)' }}/>}
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px',
            background: 'var(--dosy-info-bg)',
            borderRadius: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 9999,
              background: 'var(--dosy-info)',
              color: 'var(--dosy-fg-on-sunset)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Users size={20} strokeWidth={1.75}/>
            </div>
            <div style={{ fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, color: 'var(--dosy-info)' }}>
                Paciente compartilhado com você
              </div>
              <div style={{ color: 'var(--dosy-fg-secondary)', marginTop: 1 }}>
                Edições aparecem em tempo real para ambos.
              </div>
            </div>
          </div>
        )}

        {/* #160 Stats 2-up: Doses Hoje X/Y + Tratamentos Ativos count */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <MiniStat
            label="Doses hoje"
            value={totalToday > 0 ? `${taken} de ${totalToday}` : '—'}
            tone={
              totalToday === 0 ? 'neutral'
              : taken === totalToday ? 'success'
              : taken > 0 ? 'warn'
              : 'neutral'
            }
          />
          <MiniStat
            label="Tratamentos"
            value={treatmentGroups.active.length}
            unit="ativos"
            tone="neutral"
          />
        </div>

        {/* #160 NOVA seção: Lista de doses paciente com filtro 24h/Todas + ações inline */}
        <div>
          <SectionTitle style={{ padding: '4px 4px 8px' }}>Doses</SectionTitle>

          {/* Filtro segmentado 24h | Todas */}
          <div style={{
            display: 'inline-flex', gap: 4, padding: 4,
            background: 'var(--dosy-bg-sunken)', borderRadius: 12,
            marginBottom: 10,
          }}>
            {[
              { key: '24h', label: '24h' },
              { key: 'all', label: 'Todas' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDoseFilter(opt.key)}
                className="dosy-press"
                style={{
                  padding: '6px 14px',
                  border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700,
                  fontFamily: 'var(--dosy-font-display)',
                  borderRadius: 8,
                  background: doseFilter === opt.key ? 'var(--dosy-primary)' : 'transparent',
                  color: doseFilter === opt.key ? 'var(--dosy-fg-on-sunset)' : 'var(--dosy-fg-secondary)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >{opt.label}</button>
            ))}
          </div>

          {sortedListDoses.length === 0 ? (
            <Card padding={20} style={{
              textAlign: 'center', color: 'var(--dosy-fg-tertiary)',
              fontSize: 13.5, fontWeight: 500,
            }}>
              <Pill size={28} strokeWidth={1.5} style={{ margin: '0 auto 8px', display: 'block' }}/>
              {doseFilter === '24h' ? 'Sem doses nas próximas 24h' : 'Sem doses no histórico'}
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatePresence initial={false}>
                {sortedListDoses.map((d) => (
                  <motion.div
                    key={d.id}
                    layout
                    variants={{
                      initial: { opacity: 0, y: 8 },
                      animate: { opacity: 1, y: 0, transition: { duration: TIMING.fast, ease: EASE.inOut } },
                      exit: { opacity: 0, y: 6, transition: { duration: 0.12, ease: EASE.inOut } },
                    }}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <DoseCard
                      dose={d}
                      onClick={() => setSelectedDose(d)}
                      onSwipeConfirm={async (dose) => {
                        try {
                          await confirmMut.mutateAsync({ id: dose.id, actualTime: dose.scheduledAt, observation: '' })
                          toast.show({
                            message: `${dose.medName} marcada como tomada.`, kind: 'success',
                            undoLabel: 'Desfazer', onUndo: () => undoMut.mutate(dose.id)
                          })
                        } catch (e) {
                          toast.show({ message: e?.message || 'Falha ao confirmar.', kind: 'error' })
                        }
                      }}
                      onSwipeSkip={async (dose) => {
                        try {
                          await skipMut.mutateAsync({ id: dose.id, observation: '' })
                          toast.show({
                            message: `${dose.medName} marcada como pulada.`, kind: 'warn',
                            undoLabel: 'Desfazer', onUndo: () => undoMut.mutate(dose.id)
                          })
                        } catch (e) {
                          toast.show({ message: e?.message || 'Falha ao pular.', kind: 'error' })
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* #160 — 3 seções tratamentos por status (Ativos / Pausados / Encerrados) */}
        {/* Tratamentos Ativos — sempre expandido + Botão Novo */}
        <TreatmentSection
          title="Tratamentos ativos"
          treatments={treatmentGroups.active}
          collapsed={false}
          actionRight={
            <Link
              to={`/tratamento/novo?patientId=${id}`}
              style={{
                textDecoration: 'none',
                fontSize: 12.5, fontWeight: 700,
                color: 'var(--dosy-primary)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: 'var(--dosy-font-display)',
              }}
            >
              <Plus size={14} strokeWidth={2}/> Novo
            </Link>
          }
          emptyLabel="Sem tratamentos ativos"
        />

        {/* Pausados — collapse default */}
        {treatmentGroups.paused.length > 0 && (
          <TreatmentSection
            title="Tratamentos pausados"
            treatments={treatmentGroups.paused}
            collapsed={collapsed.paused}
            onToggle={() => toggleSection('paused')}
            emptyLabel="Sem tratamentos pausados"
          />
        )}

        {/* Encerrados — collapse default */}
        {treatmentGroups.ended.length > 0 && (
          <TreatmentSection
            title="Tratamentos encerrados"
            treatments={treatmentGroups.ended}
            collapsed={collapsed.ended}
            onToggle={() => toggleSection('ended')}
            emptyLabel="Sem tratamentos encerrados"
          />
        )}
      </div>

      <DoseModal
        dose={selectedDose}
        open={!!selectedDose}
        onClose={() => setSelectedDose(null)}
        patientName={patient.name}
      />
      <SharePatientSheet open={shareOpen} onClose={() => setShareOpen(false)} patient={patient} />
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        reason="Compartilhar pacientes com outros cuidadores é um recurso PRO. Trabalhe em conjunto em tempo real."
      />
    </motion.div>
  )
}

/**
 * #160 — TreatmentSection sub-component pra render seções Ativos/Pausados/Encerrados.
 * Header com count + chevron toggle (se onToggle definido). Lista cards padrão Dashboard.
 */
function TreatmentSection({ title, treatments, collapsed, onToggle, actionRight, emptyLabel }) {
  const isCollapsible = !!onToggle
  const count = treatments.length

  return (
    <div>
      <SectionTitle
        style={{ padding: '4px 4px 8px' }}
        action={actionRight}
      >
        <button
          type="button"
          onClick={onToggle}
          disabled={!isCollapsible}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: isCollapsible ? 'pointer' : 'default',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            font: 'inherit', color: 'inherit',
          }}
        >
          {title} {count > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: 'var(--dosy-fg-tertiary)',
              background: 'var(--dosy-bg-sunken)',
              borderRadius: 9999,
              padding: '2px 8px',
            }}>{count}</span>
          )}
          {isCollapsible && (
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              style={{
                color: 'var(--dosy-fg-tertiary)',
                transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 0.2s',
              }}
            />
          )}
        </button>
      </SectionTitle>

      {(!isCollapsible || !collapsed) && (
        count === 0 ? (
          <Card padding={20} style={{
            textAlign: 'center', color: 'var(--dosy-fg-tertiary)',
            fontSize: 13.5, fontWeight: 500,
          }}>
            <Pill size={28} strokeWidth={1.5} style={{ margin: '0 auto 8px', display: 'block' }}/>
            {emptyLabel}
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {treatments.map((t) => (
              <Link
                key={t.id}
                to={`/tratamento/${t.id}`}
                className="dosy-press"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12,
                  background: 'var(--dosy-bg-elevated)',
                  borderRadius: 16, boxShadow: 'var(--dosy-shadow-xs)',
                  textDecoration: 'none', color: 'var(--dosy-fg)',
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 14,
                  background: 'var(--dosy-peach-100)',
                  color: 'var(--dosy-primary)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Pill size={20} strokeWidth={2}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{t.medName}</div>
                  <div style={{
                    fontSize: 12.5, color: 'var(--dosy-fg-secondary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {t.unit} · {t.intervalHours ? `a cada ${t.intervalHours}h` : 'horários fixos'}
                    {t.isContinuous ? ' · ♾ Contínuo' : ` · ${t.durationDays} dias`}
                  </div>
                </div>
                <ChevronRight size={18} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)' }}/>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  )
}
