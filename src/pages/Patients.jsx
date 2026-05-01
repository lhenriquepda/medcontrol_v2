import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from '../components/Header'
import { TIMING, EASE } from '../animations'
import PatientCard from '../components/PatientCard'
import EmptyState from '../components/EmptyState'
import PaywallModal from '../components/PaywallModal'
import AdBanner from '../components/AdBanner'
import { SkeletonList } from '../components/Skeleton'
import { usePatients } from '../hooks/usePatients'
import { usePatientLimitReached, useMyTier, FREE_PATIENT_LIMIT } from '../hooks/useSubscription'

export default function Patients() {
  const { data: patients = [], isLoading } = usePatients()
  const limitReached = usePatientLimitReached()
  const { data: tier } = useMyTier()
  const [paywall, setPaywall] = useState(false)
  const nav = useNavigate()

  function handleNew() {
    if (limitReached) { setPaywall(true); return }
    nav('/pacientes/novo')
  }

  return (
    <div className="pb-28">
      <Header title="Pacientes" right={
        <button onClick={handleNew} className="btn-primary h-9 px-3 text-sm">+ Novo</button>
      } />
      <div className="max-w-md mx-auto px-4 pt-3 space-y-3">
        <AdBanner />
        {tier === 'free' && patients.length > 0 && (
          <div className="card p-3 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
            <span>Plano grátis: {patients.length}/{FREE_PATIENT_LIMIT} paciente</span>
            <button onClick={() => setPaywall(true)} className="text-brand-600 font-medium">Ver PRO →</button>
          </div>
        )}

        {isLoading ? <SkeletonList count={3} /> : (
          patients.length === 0 ? (
            <EmptyState icon="user" title="Nenhum paciente cadastrado"
                        description="Cadastre a primeira pessoa que você está acompanhando."
                        action={<Link to="/pacientes/novo" className="btn-primary">Adicionar paciente</Link>} />
          ) : (
            <motion.div
              className="space-y-1"
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
                  <PatientCard patient={p} />
                </motion.div>
              ))}
            </motion.div>
          )
        )}
      </div>

      <PaywallModal open={paywall} onClose={() => setPaywall(false)}
                    reason={`No plano grátis você pode ter até ${FREE_PATIENT_LIMIT} paciente. Faça upgrade para adicionar toda a família.`} />
    </div>
  )
}
