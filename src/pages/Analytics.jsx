import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { TIMING, EASE } from '../animations'
import LockedOverlay from '../components/LockedOverlay'
import AdBanner from '../components/AdBanner'
import { Card, Chip } from '../components/dosy'
import PageHeader from '../components/dosy/PageHeader'
import { SkeletonList } from '../components/Skeleton'
import { usePatients } from '../hooks/usePatients'
import { useDoses } from '../hooks/useDoses'
import { useIsPro } from '../hooks/useSubscription'
import { formatDate } from '../utils/dateUtils'

export default function Analytics() {
  const { data: patients = [] } = usePatients()
  const [period, setPeriod] = useState('week')
  const [patientId, setPatientId] = useState(null)

  const days = period === 'week' ? 7 : 30
  const from = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - days + 1); d.setHours(0, 0, 0, 0); return d
  }, [days])
  const to = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }, [])

  const { data: doses = [], isLoading: loadingDoses } = useDoses({
    from: from.toISOString(), to: to.toISOString(), patientId: patientId || undefined,
  })

  const adherenceByPatient = useMemo(() => {
    const map = new Map()
    for (const d of doses) {
      if (new Date(d.scheduledAt) > new Date()) continue
      const m = map.get(d.patientId) || { total: 0, done: 0 }
      m.total += 1
      if (d.status === 'done') m.done += 1
      map.set(d.patientId, m)
    }
    return [...map.entries()].map(([pid, m]) => ({
      patient: patients.find((p) => p.id === pid),
      percent: m.total ? Math.round((m.done / m.total) * 100) : 0,
      ...m,
    }))
  }, [doses, patients])

  const calendar = useMemo(() => {
    const grid = []
    for (let i = 0; i < days; i++) {
      const d = new Date(from); d.setDate(d.getDate() + i)
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999)
      const inDay = doses.filter((x) => {
        const t = new Date(x.scheduledAt)
        return t >= dayStart && t <= dayEnd && t <= new Date()
      })
      const total = inDay.length
      const done = inDay.filter((x) => x.status === 'done').length
      let bg = 'var(--dosy-bg-sunken)'
      if (total > 0) {
        if (done === total) bg = '#6EC9A8'
        else if (done > 0) bg = '#F2B441'
        else bg = 'var(--dosy-danger)'
      }
      grid.push({ date: d, total, done, bg })
    }
    return grid
  }, [from, days, doses])

  const sosByMed = useMemo(() => {
    const map = new Map()
    for (const d of doses) if (d.type === 'sos') map.set(d.medName, (map.get(d.medName) || 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [doses])

  const maxSos = Math.max(1, ...sosByMed.map(([, v]) => v))
  const isPro = useIsPro()

  return (
    <div style={{ paddingBottom: 110 }}>
      <PageHeader
        title="Análises"
        back
        right={!isPro && (
          <span style={{
            fontSize: 10, fontWeight: 800,
            padding: '4px 8px', borderRadius: 9999,
            background: 'var(--dosy-warning-bg)',
            color: '#C5841A',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--dosy-font-display)',
          }}>
            <Lock size={10} strokeWidth={2}/> PRO
          </span>
        )}
      />

      <div className="max-w-md mx-auto px-4 pt-1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AdBanner />

        {!isPro && (
          <LockedOverlay reason="Análises detalhadas de adesão, calendário e S.O.S são exclusivas do PRO." label="Desbloquear Análises">
            <Card padding={16}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--dosy-fg)', margin: '0 0 12px 0' }}>Prévia</p>
              <div style={{
                height: 8, borderRadius: 9999,
                background: 'var(--dosy-bg-sunken)', overflow: 'hidden',
                marginBottom: 12,
              }}>
                <div style={{
                  height: '100%', background: 'var(--dosy-gradient-sunset)',
                  width: '75%',
                }}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: 6,
                      background: i % 3 === 0 ? '#6EC9A8' : i % 4 === 0 ? 'var(--dosy-danger)' : 'var(--dosy-bg-sunken)',
                    }}
                  />
                ))}
              </div>
            </Card>
          </LockedOverlay>
        )}

        {isPro && (
          <>
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip size="sm" active={period === 'week'} onClick={() => setPeriod('week')}>7 dias</Chip>
              <Chip size="sm" active={period === 'month'} onClick={() => setPeriod('month')}>30 dias</Chip>
            </div>

            <div className="dosy-scroll" style={{
              display: 'flex', gap: 6, overflowX: 'auto', padding: '2px',
            }}>
              <Chip size="sm" active={!patientId} onClick={() => setPatientId(null)}>Todos</Chip>
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

            {/* #036 skeleton durante fetch initial — evita flash empty "Sem dados" */}
            {loadingDoses && doses.length === 0 ? (
              <SkeletonList count={3} />
            ) : null}

            {/* Adesão por paciente */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
              <Card padding={16}>
                <h3 style={{
                  fontFamily: 'var(--dosy-font-display)',
                  fontWeight: 700, fontSize: 14, margin: '0 0 12px 0',
                  color: 'var(--dosy-fg)',
                }}>Adesão por paciente</h3>
                {adherenceByPatient.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', margin: 0 }}>Sem dados no período.</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {adherenceByPatient.map((a) => (
                    <div key={a.patient?.id || 'x'}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 12, marginBottom: 4,
                      }}>
                        <span style={{ color: 'var(--dosy-fg)' }}>{a.patient?.avatar} {a.patient?.name || '—'}</span>
                        <span style={{
                          fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                          color: 'var(--dosy-fg)',
                        }}>{a.percent}% ({a.done}/{a.total})</span>
                      </div>
                      <div style={{
                        height: 8, borderRadius: 9999,
                        background: 'var(--dosy-bg-sunken)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', background: 'var(--dosy-gradient-sunset)',
                          width: `${a.percent}%`,
                          transition: 'width 600ms var(--dosy-ease-out)',
                        }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Calendário heatmap */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
              <Card padding={16}>
                <h3 style={{
                  fontFamily: 'var(--dosy-font-display)',
                  fontWeight: 700, fontSize: 14, margin: '0 0 12px 0',
                  color: 'var(--dosy-fg)',
                }}>Calendário de adesão</h3>
                <div style={{
                  display: 'grid', gap: 4,
                  gridTemplateColumns: `repeat(${period === 'week' ? 7 : 10}, minmax(0, 1fr))`,
                }}>
                  {calendar.map((c, i) => (
                    <div
                      key={i}
                      title={`${formatDate(c.date)} — ${c.done}/${c.total}`}
                      style={{
                        aspectRatio: '1 / 1',
                        borderRadius: 6,
                        background: c.bg,
                      }}
                    />
                  ))}
                </div>
                <div style={{
                  display: 'flex', gap: 12, marginTop: 12,
                  fontSize: 11, color: 'var(--dosy-fg-secondary)',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: '#6EC9A8' }}/>
                    todas
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: '#F2B441' }}/>
                    parcial
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--dosy-danger)' }}/>
                    nenhuma
                  </span>
                </div>
              </Card>
            </motion.div>

            {/* SOS por medicamento */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: TIMING.base, ease: EASE.inOut }}>
              <Card padding={16}>
                <h3 style={{
                  fontFamily: 'var(--dosy-font-display)',
                  fontWeight: 700, fontSize: 14, margin: '0 0 12px 0',
                  color: 'var(--dosy-fg)',
                }}>Uso de S.O.S por medicamento</h3>
                {sosByMed.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', margin: 0 }}>
                    Sem registros de S.O.S no período.
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sosByMed.map(([med, count]) => (
                    <div key={med}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 12, marginBottom: 4, color: 'var(--dosy-fg)',
                      }}>
                        <span>{med}</span>
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                      </div>
                      <div style={{
                        height: 8, borderRadius: 9999,
                        background: 'var(--dosy-bg-sunken)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', background: 'var(--dosy-danger)',
                          width: `${(count / maxSos) * 100}%`,
                        }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
