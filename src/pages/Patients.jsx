import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Info, ChevronRight, Users } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import PaywallModal from '../components/PaywallModal'
import AdBanner from '../components/AdBanner'
import { SkeletonList } from '../components/Skeleton'
import { Card, IconButton, Button, EmptyState } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import PatientAvatar from '../components/PatientAvatar'
import { usePatients } from '../hooks/usePatients'
import { pruneStalePhotoCaches } from '../hooks/usePatientPhoto'
import { usePatientLimitReached, useMyTier, useOwnPatientCount, FREE_PATIENT_LIMIT } from '../hooks/useSubscription'
// v0.2.6.5 — pull-to-refresh
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import PullToRefreshOverlay from '../components/PullToRefreshOverlay'
import { useQueryClient } from '@tanstack/react-query'

export default function Patients() {
  const qc = useQueryClient()
  const ptr = usePullToRefresh(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['patients'] }),
      qc.invalidateQueries({ queryKey: ['shares'] }),
    ])
  })
  const { data: patients = [], isLoading } = usePatients()
  const limitReached = usePatientLimitReached()
  const ownCount = useOwnPatientCount()
  const { data: tier } = useMyTier()
  const [paywall, setPaywall] = useState(false)
  const nav = useNavigate()

  function handleNew() {
    if (limitReached) { setPaywall(true); return }
    nav('/pacientes/novo')
  }

  // Item #115: limpa caches de fotos cujo paciente foi deletado.
  useEffect(() => {
    if (patients.length > 0) {
      pruneStalePhotoCaches(patients.map((p) => p.id))
    }
  }, [patients])

  return (
    <div style={{ paddingBottom: 110 }}>
      <PullToRefreshOverlay ptr={ptr} />
      <PageHeader
        title="Pacientes"
        right={<IconButton icon={Plus} kind="sunset" onClick={handleNew} ariaLabel="Novo paciente"/>}
      />

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AdBanner />

        {tier === 'free' && ownCount > 0 && (
          <button
            type="button"
            onClick={() => setPaywall(true)}
            className="dosy-press"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 14,
              background: 'var(--dosy-gradient-sunset-soft)',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'var(--dosy-font-body)',
              color: 'var(--dosy-fg)',
            }}
          >
            <Info size={18} strokeWidth={1.75}/>
            <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>
              Plano Free: {ownCount}/{FREE_PATIENT_LIMIT} paciente.{' '}
              <span style={{ textDecoration: 'underline' }}>Conhecer Pro</span>
            </div>
          </button>
        )}

        {isLoading ? (
          <SkeletonList count={3} />
        ) : patients.length === 0 ? (
          // Refactor Fase 4 (v0.2.3.17) — substitui bloco inline pelo componente
          // unificado EmptyState. Mesmo visual; mantém icon Users + message customizada.
          <EmptyState
            icon={<Users size={28} strokeWidth={1.5}/>}
            title="Nenhum paciente cadastrado"
            message="Cadastre a primeira pessoa que você está acompanhando."
            action={
              <Link to="/pacientes/novo" style={{ textDecoration: 'none' }}>
                <Button kind="primary" size="md" icon={Plus}>Adicionar paciente</Button>
              </Link>
            }
          />
        ) : (
          <motion.div
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: TIMING.stagger } } }}
          >
            {patients.map((p) => (
              <motion.div
                key={p.id}
                variants={{
                  initial: { opacity: 0, x: -20 },
                  animate: { opacity: 1, x: 0, transition: { duration: TIMING.base, ease: EASE.out } },
                }}
              >
                <Link
                  to={`/pacientes/${p.id}`}
                  className="dosy-press"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: 14,
                    background: 'var(--dosy-bg-elevated)',
                    borderRadius: 20,
                    boxShadow: 'var(--dosy-shadow-sm)',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    color: 'var(--dosy-fg)',
                  }}
                >
                  <PatientAvatar patient={p} size={52} color="peach"/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--dosy-font-display)', fontWeight: 800,
                      fontSize: 17, letterSpacing: '-0.02em',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{p.name}</div>
                    <div style={{
                      fontSize: 12.5, color: 'var(--dosy-fg-secondary)',
                      marginTop: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {p.age ? `${p.age} anos` : 'Idade não informada'}
                      {p.condition ? ` · ${p.condition}` : ''}
                    </div>
                  </div>
                  <ChevronRight size={18} strokeWidth={1.75} style={{ color: 'var(--dosy-fg-tertiary)', flexShrink: 0 }}/>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <PaywallModal open={paywall} onClose={() => setPaywall(false)}
                    reason={`No plano grátis você pode ter até ${FREE_PATIENT_LIMIT} paciente. Faça upgrade para adicionar toda a família.`} />
    </div>
  )
}
