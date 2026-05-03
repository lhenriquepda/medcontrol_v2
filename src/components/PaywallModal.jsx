import { useEffect } from 'react'
import { Crown, Users, BarChart3, FileText, Share2, BellOff } from 'lucide-react'
import { Sheet, Button } from './dosy'
import { track, EVENTS } from '../services/analytics'

const FEATURES = [
  { Icon: Users,    label: 'Pacientes ilimitados',   sub: 'Cuide da família toda' },
  { Icon: BarChart3,label: 'Análises e calendários', sub: 'Adesão por mês, paciente, remédio' },
  { Icon: FileText, label: 'Relatórios PDF / CSV',   sub: 'Para mostrar pro médico' },
  { Icon: Share2,   label: 'Compartilhar pacientes', sub: 'Cuidadores em tempo real' },
  { Icon: BellOff,  label: 'Sem anúncios',           sub: 'Foco no que importa' },
]

export default function PaywallModal({ open, onClose, reason }) {
  // Aud 4.5.7 G4 — paywall funnel start: view event
  useEffect(() => {
    if (open) track(EVENTS.PAYWALL_SHOWN, { reason: reason || 'unknown' })
  }, [open, reason])

  return (
    <Sheet open={open} onClose={onClose} padding="14px 22px 28px">
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 18,
          margin: '0 auto 12px',
          background: 'var(--dosy-gradient-sunset)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 24px -8px rgba(255,61,127,0.4)',
          color: 'var(--dosy-fg-on-sunset)',
        }}>
          <Crown size={26} strokeWidth={1.75}/>
        </div>
        <div style={{
          fontFamily: 'var(--dosy-font-display)',
          fontWeight: 800, fontSize: 24,
          letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 6,
          color: 'var(--dosy-fg)',
        }}>Liberar com Dosy Pro</div>
        <div style={{
          fontSize: 14, color: 'var(--dosy-fg-secondary)',
          lineHeight: 1.5, padding: '0 16px',
        }}>
          {reason || 'Pacientes ilimitados, análises completas e relatórios pro médico.'}
        </div>
      </div>

      {/* Features list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {FEATURES.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 16,
            background: 'var(--dosy-bg-elevated)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'var(--dosy-gradient-sunset-soft)',
              color: 'var(--dosy-fg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <f.Icon size={18} strokeWidth={1.75}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 700, fontSize: 14,
                letterSpacing: '-0.01em', color: 'var(--dosy-fg)',
              }}>{f.label}</div>
              <div style={{
                fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 1,
              }}>{f.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Plans 2-up */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{
          padding: 14, borderRadius: 18,
          background: 'var(--dosy-bg-elevated)',
          border: '1.5px solid var(--dosy-border)',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--dosy-fg-secondary)',
            fontFamily: 'var(--dosy-font-display)',
          }}>Mensal</div>
          <div style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em',
            marginTop: 4, color: 'var(--dosy-fg)',
            fontVariantNumeric: 'tabular-nums',
          }}>R$ 14,90</div>
          <div style={{
            fontSize: 11.5, color: 'var(--dosy-fg-secondary)', marginTop: 2,
          }}>por mês</div>
        </div>
        <div style={{
          padding: 14, borderRadius: 18,
          background: 'var(--dosy-gradient-sunset)',
          color: 'var(--dosy-fg-on-sunset)',
          boxShadow: '0 12px 28px -8px rgba(255,61,127,0.42)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: -8, right: 10,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
            background: '#fff', color: 'var(--dosy-primary)',
            padding: '3px 8px', borderRadius: 9999,
            textTransform: 'uppercase',
            fontFamily: 'var(--dosy-font-display)',
          }}>−40%</div>
          <div style={{
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            opacity: 0.9,
            fontFamily: 'var(--dosy-font-display)',
          }}>Anual</div>
          <div style={{
            fontFamily: 'var(--dosy-font-display)',
            fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em',
            marginTop: 4, fontVariantNumeric: 'tabular-nums',
          }}>R$ 8,90</div>
          <div style={{
            fontSize: 11.5, opacity: 0.9, marginTop: 2,
          }}>por mês</div>
        </div>
      </div>

      <Button kind="primary" full size="lg" disabled>
        Assinar Pro — em breve
      </Button>
      <button
        type="button"
        onClick={onClose}
        style={{
          width: '100%', marginTop: 8, padding: 10,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--dosy-fg-secondary)',
          fontSize: 13, fontWeight: 600,
          fontFamily: 'var(--dosy-font-body)',
        }}
      >
        Agora não
      </button>
    </Sheet>
  )
}
