import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, FileText, BarChart3, Bell, UploadCloud, BellOff } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import { Sheet, Button } from './dosy'
import { track, EVENTS } from '../services/analytics'

const FEATURES = [
  { Icon: Users,       title: 'Pacientes ilimitados', desc: 'Cadastre toda a família num só lugar.' },
  { Icon: FileText,    title: 'Relatórios PDF/CSV',   desc: 'Leve ao médico ou exporte histórico completo.' },
  { Icon: BarChart3,   title: 'Análises avançadas',   desc: 'Adesão, heatmap e uso de S.O.S.' },
  { Icon: Bell,        title: 'Resumo diário',        desc: 'Notificação com todas as doses do dia.' },
  { Icon: UploadCloud, title: 'Backup na nuvem',      desc: 'Sincroniza entre dispositivos.' },
  { Icon: BellOff,     title: 'Sem anúncios',         desc: 'Foco total no que importa.' },
]

export default function PaywallModal({ open, onClose, reason }) {
  // Aud 4.5.7 G4 — paywall funnel start: view event
  useEffect(() => {
    if (open) track(EVENTS.PAYWALL_SHOWN, { reason: reason || 'unknown' })
  }, [open, reason])

  return (
    <Sheet open={open} onClose={onClose} title="Desbloqueie o Dosy PRO">
      {reason && (
        <div style={{
          padding: '12px 14px',
          borderRadius: 14,
          background: 'var(--dosy-warning-bg)',
          color: '#C5841A',
          fontSize: 13.5, fontWeight: 600,
          marginBottom: 16,
          fontFamily: 'var(--dosy-font-body)',
        }}>{reason}</div>
      )}

      <motion.div
        style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}
        initial="hidden"
        animate={open ? 'show' : 'hidden'}
        variants={{
          hidden: { opacity: 1 },
          show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
        }}
      >
        {FEATURES.map((f) => (
          <motion.div
            key={f.title}
            style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
            variants={{
              hidden: { opacity: 0, x: -10 },
              show: { opacity: 1, x: 0, transition: { duration: TIMING.base, ease: EASE.inOut } },
            }}
          >
            <span style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'var(--dosy-peach-100)',
              color: 'var(--dosy-primary)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <f.Icon size={18} strokeWidth={1.75}/>
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--dosy-fg)' }}>{f.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--dosy-fg-secondary)', marginTop: 1 }}>{f.desc}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className="dosy-press"
          style={{
            padding: 14, borderRadius: 16,
            background: 'var(--dosy-bg-elevated)',
            border: '2px solid var(--dosy-border-strong)',
            cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--dosy-font-body)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--dosy-fg-secondary)', fontWeight: 600 }}>Mensal</div>
          <div style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 800, fontSize: 18, color: 'var(--dosy-fg)',
            marginTop: 2, fontVariantNumeric: 'tabular-nums',
          }}>R$ 7,90</div>
          <div style={{ fontSize: 10, color: 'var(--dosy-fg-tertiary)', marginTop: 2 }}>/mês</div>
        </button>
        <button
          type="button"
          className="dosy-press"
          style={{
            padding: 14, borderRadius: 16,
            background: 'var(--dosy-gradient-sunset-soft)',
            border: '2px solid var(--dosy-primary)',
            cursor: 'pointer', textAlign: 'left',
            position: 'relative',
            fontFamily: 'var(--dosy-font-body)',
          }}
        >
          <span style={{
            position: 'absolute', top: -8, right: 8,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
            background: 'var(--dosy-gradient-sunset)',
            color: 'var(--dosy-fg-on-sunset)',
            padding: '2px 8px',
            borderRadius: 9999,
            fontFamily: 'var(--dosy-font-display)',
          }}>-48%</span>
          <div style={{ fontSize: 11, color: 'var(--dosy-primary)', fontWeight: 700 }}>Anual</div>
          <div style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 800, fontSize: 18, color: 'var(--dosy-fg)',
            marginTop: 2, fontVariantNumeric: 'tabular-nums',
          }}>R$ 49,90</div>
          <div style={{ fontSize: 10, color: 'var(--dosy-fg-secondary)', marginTop: 2 }}>≈ R$ 4,16/mês</div>
        </button>
      </div>

      <Button kind="primary" full disabled>
        Assinar PRO — em breve
      </Button>
      <p style={{
        fontSize: 11, color: 'var(--dosy-fg-tertiary)',
        textAlign: 'center', margin: '12px 0 0 0',
      }}>
        Pagamento via Google Play / App Store. Cancele quando quiser.
      </p>
    </Sheet>
  )
}
