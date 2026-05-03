import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Pill, Search } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import AdBanner from '../components/AdBanner'
import { Card, IconButton, Button, Chip, Input, StatusPill } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { useTreatments, useUpdateTreatment } from '../hooks/useTreatments'
import { usePatients } from '../hooks/usePatients'

const STATUS_LABELS = { active: 'Ativo', ended: 'Encerrado', paused: 'Pausado' }
const STATUS_KINDS = { active: 'success', ended: 'skipped', paused: 'upcoming' }

export default function TreatmentList() {
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState(null)
  const [status, setStatus] = useState(null)
  const [q, setQ] = useState('')
  const { data: all = [] } = useTreatments({
    patientId: patientId || undefined,
    status: status || undefined,
  })
  const update = useUpdateTreatment()

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return all
    return all.filter((t) => t.medName.toLowerCase().includes(term))
  }, [all, q])

  function patientName(id) { return patients.find((p) => p.id === id)?.name || '—' }

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

        {patients.length > 0 && (
          <div className="dosy-scroll" style={{
            display: 'flex', gap: 6, overflowX: 'auto', padding: '2px',
          }}>
            <Chip size="sm" active={!patientId} onClick={() => setPatientId(null)}>Todos pacientes</Chip>
            {patients.map((p) => (
              <Chip
                key={p.id}
                size="sm"
                active={patientId === p.id}
                onClick={() => setPatientId(p.id)}
              >
                {p.name.split(' ')[0]}
              </Chip>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[null, 'active', 'paused', 'ended'].map((s) => (
            <Chip
              key={s || 'all'}
              size="sm"
              active={status === s}
              onClick={() => setStatus(s)}
            >
              {s ? STATUS_LABELS[s] : 'Todos'}
            </Chip>
          ))}
        </div>

        {filtered.length === 0 ? (
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
        ) : filtered.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: TIMING.base, ease: EASE.out, delay: i * TIMING.stagger }}
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
                    {patientName(t.patientId)} · {t.unit} · {t.intervalHours ? `${t.intervalHours}h` : 'horários'}
                    {t.isContinuous ? ' · ♾ Contínuo' : ` · ${t.durationDays} dias`}
                  </div>
                </div>
                <StatusPill
                  label={STATUS_LABELS[t.status] || t.status}
                  kind={STATUS_KINDS[t.status] || 'pending'}
                />
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/tratamento/${t.id}`} style={{ textDecoration: 'none', flex: 1 }}>
                  <Button kind="secondary" size="sm" full>Editar</Button>
                </Link>
                {t.status === 'active' && (
                  <>
                    <Button kind="ghost" size="sm" onClick={() => update.mutate({ id: t.id, patch: { status: 'paused' } })}>
                      Pausar
                    </Button>
                    <Button kind="ghost" size="sm" onClick={() => update.mutate({ id: t.id, patch: { status: 'ended' } })}>
                      Encerrar
                    </Button>
                  </>
                )}
                {t.status === 'paused' && (
                  <Button kind="ghost" size="sm" onClick={() => update.mutate({ id: t.id, patch: { status: 'active' } })}>
                    Retomar
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
