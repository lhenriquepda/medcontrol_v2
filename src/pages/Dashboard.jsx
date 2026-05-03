import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { TIMING, EASE } from '../animations'
import { supabase, hasSupabase } from '../services/supabase'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import FilterBar from '../components/FilterBar'
import DoseCard from '../components/DoseCard'
import DoseModal from '../components/DoseModal'
import MultiDoseModal from '../components/MultiDoseModal'
import Icon from '../components/Icon'
import AdBanner from '../components/AdBanner'
import { SkeletonList } from '../components/Skeleton'
// Dosy v0.2.0.0 redesign — primitives + hero/stats
import { Card, Avatar, StatusPill, Button } from '../components/dosy'
import { HeroGauge } from '../components/dosy/HeroGauge'
import { MiniStat } from '../components/dosy/MiniStat'
import { Plus as PlusIcon, Hand as HandIcon } from 'lucide-react'
import { useDoses, useConfirmDose, useSkipDose, useUndoDose } from '../hooks/useDoses'
import { useToast } from '../hooks/useToast'
import { usePatients } from '../hooks/usePatients'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { rangeNow } from '../utils/dateUtils'

export default function Dashboard() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: patients = [] } = usePatients()
  const confirmMut = useConfirmDose()
  const skipMut = useSkipDose()
  const undoMut = useUndoDose()
  const [searchParams, setSearchParams] = useSearchParams()

  // Item #014 (release v0.1.7.4) — RPC extend_continuous_treatments recriada.
  // Rolling 5-day horizon for continuous treatments. RPC idempotente + cheap
  // (no-op quando horizon já cobre próximos 5 dias). Runs once per mount;
  // pg_cron também roda diário como backup pra users inativos.
  useEffect(() => {
    if (!hasSupabase) return
    supabase
      .schema('medcontrol')
      .rpc('extend_continuous_treatments', { p_days_ahead: 5 })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[Dashboard] extend_continuous_treatments rpc error:', error.message)
          return
        }
        if (data?.dosesAdded > 0) {
          console.log('[Dashboard] extend_continuous: added', data.dosesAdded, 'doses across', data.treatmentsExtended, 'treatments')
          qc.invalidateQueries({ queryKey: ['doses'] })
        }
      })
      .catch(err => console.warn('[Dashboard] extend_continuous_treatments exception:', err?.message))
  }, [qc])
  const [filters, setFilters] = useState({ range: '12h', patientId: null, status: null, type: null })

  // Notif-tap → IDs pra abrir em modal multi-dose
  const [multiDoseIds, setMultiDoseIds] = useState([])

  // Aplica filtro via URL param — funciona no mount E quando já está na tela
  useEffect(() => {
    const f = searchParams.get('filter')
    const doseParam = searchParams.get('dose')
    const dosesParam = searchParams.get('doses')
    if (doseParam || dosesParam) {
      setFilters({ range: 'all', patientId: null, status: null, type: null })
      const ids = dosesParam ? dosesParam.split(',').filter(Boolean) : [doseParam]
      setMultiDoseIds(ids)
      setSearchParams({}, { replace: true })
      return
    }
    if (f === 'overdue') {
      setFilters({ range: 'all', patientId: null, status: 'overdue', type: null })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const { from, to } = useMemo(() => rangeNow(filters.range), [filters.range])
  const query = useMemo(
    () => ({ from, to, patientId: filters.patientId, status: filters.status, type: filters.type }),
    [from, to, filters.patientId, filters.status, filters.type]
  )
  const { data: doses = [], isLoading } = useDoses(query)

  const [selected, setSelected] = useState(null)

  // MultiDoseModal — derived from multiDoseIds + loaded doses
  const multiDoseList = useMemo(
    () => multiDoseIds.map(id => doses.find(d => d.id === id)).filter(Boolean),
    [multiDoseIds, doses]
  )

  // Janelas de tempo memoizadas (tick por minuto evita novas chaves a cada render)
  const [tick, setTick] = useState(() => Math.floor(Date.now() / 60000))
  useEffect(() => {
    const t = setInterval(() => setTick(Math.floor(Date.now() / 60000)), 60000)
    return () => clearInterval(t)
  }, [])
  const windows = useMemo(() => {
    const now = new Date(tick * 60000)
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999)
    const overdueFrom = new Date(now); overdueFrom.setDate(overdueFrom.getDate() - 30)
    const weekFrom = new Date(now); weekFrom.setDate(weekFrom.getDate() - 7)
    // Stats respect current patient filter — show focused data when 1 patient selected
    const pid = filters.patientId
    return {
      today: { from: startOfToday.toISOString(), to: endOfToday.toISOString(), patientId: pid },
      overdue: { from: overdueFrom.toISOString(), to: now.toISOString(), status: 'overdue', patientId: pid },
      week: { from: weekFrom.toISOString(), to: now.toISOString(), patientId: pid }
    }
  }, [tick, filters.patientId])

  const { data: todayDoses = [] } = useDoses(windows.today)
  const pendingToday = todayDoses.filter((d) => d.status === 'pending' || d.status === 'overdue').length
  const { data: overdueAll = [] } = useDoses(windows.overdue)
  const overdueNow = overdueAll.length
  const { data: weekDoses = [] } = useDoses(windows.week)
  const adherence = (() => {
    const past = weekDoses.filter((d) => new Date(d.scheduledAt) <= new Date())
    if (past.length === 0) return null
    const taken = past.filter((d) => d.status === 'done').length
    return Math.round((taken / past.length) * 100)
  })()

  const grouped = useMemo(() => {
    const map = new Map()
    for (const d of doses) {
      if (!map.has(d.patientId)) map.set(d.patientId, [])
      map.get(d.patientId).push(d)
    }
    return [...map.entries()].map(([pid, list]) => ({
      patient: patients.find((p) => p.id === pid) || { id: pid, name: 'Paciente', avatar: '👤' },
      list
    }))
  }, [doses, patients])

  const selectedPatient = selected && patients.find((p) => p.id === selected.patientId)

  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dashCollapsed') || '{}') } catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem('dashCollapsed', JSON.stringify(collapsed)) } catch {}
  }, [collapsed])
  const toggleCollapse = (id) => setCollapsed((s) => ({ ...s, [id]: !s[id] }))

  // Schedule push notifications for upcoming doses + daily summary.
  // SEMPRE roda (mesmo sem doses hoje) — daily summary é independente e precisa
  // ser agendado mesmo quando não há doses programadas.
  const { scheduleDoses } = usePushNotifications()
  useEffect(() => {
    scheduleDoses(todayDoses, { patients })
  }, [todayDoses, patients, scheduleDoses])

  // Pull-to-refresh — overlay bar (não wrapa content, preserva sticky FilterBar)
  const handleRefresh = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ['doses'] }),
      qc.refetchQueries({ queryKey: ['patients'] }),
      qc.refetchQueries({ queryKey: ['user_prefs'] }),
      qc.refetchQueries({ queryKey: ['my_tier'] }),
      // Item #014 — refresh sob-demanda do horizon de tratamentos contínuos
      hasSupabase
        ? supabase.schema('medcontrol').rpc('extend_continuous_treatments', { p_days_ahead: 5 })
            .catch(err => console.warn('[refresh] extend_continuous err:', err?.message))
        : Promise.resolve()
    ])
  }
  const ptr = usePullToRefresh(handleRefresh)
  const ptrVisible = ptr.pulling || ptr.refreshing

  return (
    <>
    {ptrVisible && (
      <div
        className="fixed left-0 right-0 z-50 flex items-end justify-center pointer-events-none safe-top"
        style={{
          top: 0,
          height: Math.max(ptr.pullDistance, 56),
          transition: ptr.refreshing ? 'height 0.2s ease-out' : 'none',
        }}
      >
        <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur shadow-lg">
          <span
            className={`inline-block w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white ${
              ptr.refreshing ? 'animate-spin' : ''
            }`}
            style={{
              transform: ptr.refreshing
                ? undefined
                : `rotate(${(ptr.pullDistance / ptr.threshold) * 360}deg)`,
            }}
            aria-hidden="true"
          />
          <span className="text-[11px] font-medium text-white">
            {ptr.refreshing
              ? 'Atualizando…'
              : ptr.pullDistance >= ptr.threshold
                ? 'Solte para atualizar'
                : 'Puxe para atualizar'}
          </span>
        </div>
      </div>
    )}
    <div className="pb-28">
      <FilterBar filters={filters} setFilters={setFilters} patients={patients} />

      <div className="max-w-md mx-auto px-4 pt-3" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Dosy v0.2.0.0 redesign — Hero sunset card + 2 MiniStat 2-up */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card gradient padding={18} style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Subtle radial highlight overlay */}
            <div style={{
              position: 'absolute', top: -50, right: -40, width: 200, height: 200,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
              <HeroGauge taken={todayDoses.filter(d => d.status === 'done').length} total={Math.max(todayDoses.length, 1)} size={108}/>
              <div style={{ flex: 1, color: '#fff' }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', opacity: 0.85,
                  fontFamily: 'var(--dosy-font-display)',
                }}>Hoje</div>
                <div style={{
                  fontFamily: 'var(--dosy-font-display)',
                  fontWeight: 800, fontSize: 30,
                  lineHeight: 1.05, letterSpacing: '-0.025em', marginTop: 4,
                }}>
                  {pendingToday} {pendingToday === 1 ? 'pendente' : 'pendentes'}
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 6, lineHeight: 1.4 }}>
                  {overdueNow > 0
                    ? `${overdueNow} atrasada${overdueNow > 1 ? 's' : ''} agora`
                    : 'Tá em dia.'}
                </div>
              </div>
            </div>
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MiniStat
              label="Adesão 7d"
              value={adherence == null ? '—' : `${adherence}%`}
              tone="success"
            />
            <MiniStat
              label="Atrasadas"
              value={overdueNow}
              unit={overdueNow > 0 ? 'hoje' : undefined}
              tone={overdueNow > 0 ? 'danger' : 'neutral'}
            />
          </div>
        </div>

        <AdBanner />

        {isLoading ? <SkeletonList count={4} /> : (
          patients.length === 0 ? (
            <Card padding={20} style={{ marginTop: 8 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'var(--dosy-peach-100)',
                color: 'var(--dosy-primary)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                <HandIcon size={28} strokeWidth={1.75}/>
              </div>
              <h3 style={{
                fontFamily: 'var(--dosy-font-display)', fontWeight: 800,
                fontSize: 22, letterSpacing: '-0.025em', color: 'var(--dosy-fg)',
              }}>Bem-vindo ao Dosy!</h3>
              <p style={{
                fontSize: 14, color: 'var(--dosy-fg-secondary)',
                lineHeight: 1.5, marginTop: 6, marginBottom: 18,
              }}>
                Comece cadastrando as pessoas que você vai acompanhar — você,
                seus filhos, familiares, pacientes sob seu cuidado…
              </p>
              <ol style={{
                listStyle: 'none', padding: 0, margin: '0 0 18px 0',
                display: 'flex', flexDirection: 'column', gap: 10,
                fontSize: 14, color: 'var(--dosy-fg)',
              }}>
                {[
                  'Cadastre os pacientes',
                  'Crie um tratamento para cada medicamento',
                  'Acompanhe as doses por aqui',
                ].map((step, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="t-dosy-sunset" style={{
                      fontFamily: 'var(--dosy-font-display)', fontWeight: 800,
                      fontSize: 16, fontVariantNumeric: 'tabular-nums',
                    }}>{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <Link to="/pacientes/novo" style={{ textDecoration: 'none' }}>
                <Button kind="primary" size="md" full icon={PlusIcon}>
                  Cadastrar primeiro paciente
                </Button>
              </Link>
            </Card>
          ) : doses.length === 0 ? (
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
                <Icon name="pill" size={32} />
              </div>
              <h3 style={{
                fontFamily: 'var(--dosy-font-display)', fontWeight: 800,
                fontSize: 20, letterSpacing: '-0.02em', color: 'var(--dosy-fg)',
                margin: 0,
              }}>Nenhuma dose neste período</h3>
              <p style={{
                fontSize: 14, color: 'var(--dosy-fg-secondary)',
                lineHeight: 1.5, margin: 0,
              }}>Ajuste os filtros ou crie um novo tratamento.</p>
              <Link to="/tratamento/novo" style={{ textDecoration: 'none', marginTop: 6 }}>
                <Button kind="primary" size="md" icon={PlusIcon}>
                  Novo tratamento
                </Button>
              </Link>
            </Card>
          ) : (
            <motion.div
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              initial="initial"
              animate="animate"
              variants={{ animate: { transition: { staggerChildren: TIMING.stagger, delayChildren: 0.06 } } }}
            >
              {grouped.map(({ patient, list }, idx) => {
                const isCollapsed = !!collapsed[patient.id]
                const overdueCount = list.filter((d) => d.status === 'overdue').length
                const pendingCount = list.filter((d) => d.status === 'pending').length
                return (
                  <motion.section
                    key={patient.id}
                    variants={{
                      initial: { opacity: 0, y: 18, scale: 0.98 },
                      animate: { opacity: 1, y: 0, scale: 1, transition: { duration: TIMING.base, ease: EASE.out } },
                    }}
                    style={{
                      background: 'var(--dosy-bg-elevated)',
                      borderRadius: 22,
                      boxShadow: 'var(--dosy-shadow-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => toggleCollapse(patient.id)}
                      className="dosy-press"
                      style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 14px',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <Avatar emoji={patient.avatar || '👤'} color="peach" size={40}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--dosy-font-display)',
                          fontWeight: 800, fontSize: 15.5,
                          letterSpacing: '-0.02em', color: 'var(--dosy-fg)',
                        }}>{patient.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--dosy-fg-secondary)', marginTop: 1 }}>
                          {list.length} dose{list.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {overdueCount > 0 && (
                        <StatusPill
                          label={`${overdueCount} atrasada${overdueCount > 1 ? 's' : ''}`}
                          kind="danger"
                        />
                      )}
                      {isCollapsed && pendingCount > 0 && overdueCount === 0 && (
                        <StatusPill
                          label={`${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`}
                          kind="pending"
                        />
                      )}
                      <span style={{
                        color: 'var(--dosy-fg-tertiary)',
                        fontSize: 12,
                        transition: 'transform 200ms var(--dosy-ease-out)',
                        transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                        flexShrink: 0,
                      }}>▶</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          key="doses"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{
                            opacity: 1,
                            height: 'auto',
                            transition: {
                              duration: TIMING.base,
                              ease: EASE.inOut,
                              staggerChildren: TIMING.stagger,
                              delayChildren: 0.05,
                            },
                          }}
                          exit={{
                            opacity: 0,
                            height: 0,
                            transition: { duration: TIMING.fast, ease: EASE.inOut, staggerChildren: 0.02, staggerDirection: -1 },
                          }}
                          className="space-y-1 overflow-hidden"
                        >
                          {list.map((d) => (
                            <motion.div
                              key={d.id}
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
                                onClick={() => setSelected(d)}
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.section>
                )
              })}
            </motion.div>
          )
        )}
      </div>

      <DoseModal
        dose={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        patientName={selectedPatient?.name}
      />

      <MultiDoseModal
        open={multiDoseList.length > 0}
        onClose={() => setMultiDoseIds([])}
        doses={multiDoseList}
        patients={patients}
      />
    </div>
    </>
  )
}


function Stat({ label, value, tone = 'slate', alert }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-1 dark:ring-brand-700/30',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-1 dark:ring-emerald-700/30',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-1 dark:ring-rose-700/30',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-1 dark:ring-slate-700/40'
  }
  return (
    <div className={`rounded-2xl p-3 ${tones[tone]} ${alert ? 'ring-2 ring-rose-400' : ''}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  )
}
