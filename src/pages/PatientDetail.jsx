import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Edit3, Stethoscope, AlertTriangle, Share2, Users, Lock, Plus, Pill, ChevronRight } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import AdBanner from '../components/AdBanner'
import SharePatientSheet from '../components/SharePatientSheet'
import { Avatar, Card, StatusPill, SectionTitle } from '../components/dosy'
import { MiniStat } from '../components/dosy/MiniStat'
import PageHeader from '../components/dosy/PageHeader'
import { usePatient } from '../hooks/usePatients'
import { primePatientPhotoCache } from '../hooks/usePatientPhoto'
import { useTreatments } from '../hooks/useTreatments'
import { useDoses } from '../hooks/useDoses'
import { usePatientShares } from '../hooks/useShares'
import { useAuth } from '../hooks/useAuth'
import { useIsPro } from '../hooks/useSubscription'
import PaywallModal from '../components/PaywallModal'
import { usePrivacyScreen } from '../hooks/usePrivacyScreen'

export default function PatientDetail() {
  // Aud 4.5.4 G2 — info médica de paciente
  usePrivacyScreen()
  const { id } = useParams()
  const { user } = useAuth()
  const { data: patient } = usePatient(id)
  const { data: treatments = [] } = useTreatments({ patientId: id })
  const { data: shares = [] } = usePatientShares(id)
  const isPro = useIsPro()
  const [shareOpen, setShareOpen] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)

  // Item #115: detail page tem photo_url full carregado. Pré-aquece cache
  // local pra acelerar próximo render da lista (skip 1 round-trip).
  useEffect(() => {
    if (patient?.id && patient?.photo_url && patient?.photo_version) {
      primePatientPhotoCache(patient.id, patient.photo_version, patient.photo_url)
    }
  }, [patient?.id, patient?.photo_version, patient?.photo_url])
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
  const { data: todayDoses = [] } = useDoses({
    patientId: id,
    from: startOfToday.toISOString(),
    to: endOfToday.toISOString(),
  })

  const taken = todayDoses.filter((d) => d.status === 'done').length
  const total = todayDoses.length
  const adherence = total ? Math.round((taken / total) * 100) : null

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

  const active = treatments.filter((t) => t.status === 'active')
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

        {/* Stats 2-up */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <MiniStat
            label="Adesão hoje"
            value={adherence == null ? '—' : `${adherence}%`}
            tone={adherence == null ? 'neutral' : 'success'}
          />
          <MiniStat
            label="Tratamentos"
            value={active.length}
            unit="ativos"
            tone="neutral"
          />
        </div>

        {/* Tratamentos ativos */}
        <div>
          <SectionTitle
            style={{ padding: '4px 4px 8px' }}
            action={
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
          >Tratamentos ativos</SectionTitle>

          {active.length === 0 ? (
            <Card padding={20} style={{
              textAlign: 'center', color: 'var(--dosy-fg-tertiary)',
              fontSize: 13.5, fontWeight: 500,
            }}>
              <Pill size={28} strokeWidth={1.5} style={{ margin: '0 auto 8px', display: 'block' }}/>
              Sem tratamentos ativos
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {active.map((t) => (
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
          )}
        </div>
      </div>

      <SharePatientSheet open={shareOpen} onClose={() => setShareOpen(false)} patient={patient} />
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        reason="Compartilhar pacientes com outros cuidadores é um recurso PRO. Trabalhe em conjunto em tempo real."
      />
    </motion.div>
  )
}
