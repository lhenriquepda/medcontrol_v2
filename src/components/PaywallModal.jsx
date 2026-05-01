import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { TIMING, EASE } from '../animations'
import BottomSheet from './BottomSheet'
import Icon from './Icon'
import { track, EVENTS } from '../services/analytics'

const FEATURES = [
  { icon: 'users', title: 'Pacientes ilimitados', desc: 'Cadastre toda a família num só lugar.' },
  { icon: 'file-text', title: 'Relatórios PDF/CSV', desc: 'Leve ao médico ou exporte histórico completo.' },
  { icon: 'bar-chart', title: 'Análises avançadas', desc: 'Adesão, heatmap e uso de S.O.S.' },
  { icon: 'bell', title: 'Resumo diário', desc: 'Notificação com todas as doses do dia.' },
  { icon: 'upload', title: 'Backup na nuvem', desc: 'Sincroniza entre dispositivos.' },
  { icon: 'bell-off', title: 'Sem anúncios', desc: 'Foco total no que importa.' }
]

export default function PaywallModal({ open, onClose, reason }) {
  // Aud 4.5.7 G4 — paywall funnel start: view event
  useEffect(() => {
    if (open) track(EVENTS.PAYWALL_SHOWN, { reason: reason || 'unknown' })
  }, [open, reason])
  return (
    <BottomSheet open={open} onClose={onClose} title="Desbloqueie o Dosy PRO">
      {reason && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 p-3 text-sm mb-4">
          {reason}
        </div>
      )}
      <motion.div
        className="space-y-3 mb-5"
        initial="hidden"
        animate={open ? 'show' : 'hidden'}
        variants={{
          hidden: { opacity: 1 },
          show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } }
        }}
      >
        {FEATURES.map((f) => (
          <motion.div
            key={f.title}
            className="flex gap-3 items-start"
            variants={{
              hidden: { opacity: 0, x: -10 },
              show: { opacity: 1, x: 0, transition: { duration: TIMING.base, ease: EASE.inOut } }
            }}
          >
            <span className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300 flex items-center justify-center shrink-0">
              <Icon name={f.icon} size={18} />
            </span>
            <div>
              <p className="font-medium text-sm">{f.title}</p>
              <p className="text-xs text-slate-500">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button className="card p-3 text-left border-2 border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500">Mensal</p>
          <p className="font-bold text-lg">R$ 7,90</p>
          <p className="text-[10px] text-slate-400">/mês</p>
        </button>
        <button className="card p-3 text-left border-2 border-brand-500 bg-brand-50/50 dark:bg-brand-500/10 relative">
          <span className="absolute -top-2 right-2 text-[10px] font-bold bg-brand-600 text-white px-2 py-0.5 rounded-full">-48%</span>
          <p className="text-xs text-brand-700 dark:text-brand-300">Anual</p>
          <p className="font-bold text-lg">R$ 49,90</p>
          <p className="text-[10px] text-slate-500">≈ R$ 4,16/mês</p>
        </button>
      </div>

      <button className="btn-primary w-full" disabled>
        Assinar PRO — em breve
      </button>
      <p className="text-[11px] text-center text-slate-400 mt-3">
        Pagamento via Google Play / App Store. Cancele quando quiser.
      </p>
    </BottomSheet>
  )
}
