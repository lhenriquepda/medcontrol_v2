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
import PatientAvatar from '../components/PatientAvatar'
import { HeroGauge } from '../components/dosy/HeroGauge'
import { MiniStat } from '../components/dosy/MiniStat'
import { Plus as PlusIcon, Hand as HandIcon } from 'lucide-react'
import { useConfirmDose, useSkipDose, useUndoDose } from '../hooks/useDoses'
import { useToast } from '../hooks/useToast'
import { useDashboardPayload } from '../hooks/useDashboardPayload'
import { rangeNow } from '../utils/dateUtils'

export default function Dashboard() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirmMut = useConfirmDose()
  const skipMut = useSkipDose()
  const undoMut = useUndoDose()
  const [searchParams, setSearchParams] = useSearchParams()

  // v0.2.3.4 #163 — extend_continuous_treatments agora roda dentro do RPC consolidado
  // get_dashboard_payload (chamado pelo useDashboardPayload hook abaixo). Side-effect
  // separado removido. extend_result fica no payload se caller precisar inspecionar.
  const [filters, setFilters] = useState({ range: '12h', patientId: null, status: null, type: null })

  // Notif-tap → IDs pra abrir em modal multi-dose
  const [multiDoseIds, setMultiDoseIds] = useState([])

  // Aplica filtro via URL param — funciona no mount E quando já está na tela
  useEffect(() => {
    const f = searchParams.get('filter')
    const doseParam = searchParams.get('dose')
    const dosesParam = searchParams.get('doses')
    if (doseParam || dosesParam) {
      // #137 (v0.2.0.9): 'all' removido — usar '7d' (máximo visível agora)
      setFilters({ range: '7d', patientId: null, status: null, type: null })
      const ids = dosesParam ? dosesParam.split(',').filter(Boolean) : [doseParam]
      setMultiDoseIds(ids)
      setSearchParams({}, { replace: true })
      return
    }
    if (f === 'overdue') {
      setFilters({ range: '7d', patientId: null, status: 'overdue', type: null })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Item #137 (egress-audit-2026-05-05 F3) — consolidação 4 useDoses → 1.
  // Antes: query + today + overdue + week = 4 queries paralelas, cada uma
  // round-trip Supabase. Cada invalidate cascade × 4 = 4 refetches. Multiplicado
  // por refetchInterval 5min × refetchOnWindowFocus + Realtime invalidate +
  // useAppResume = ~4× cargo desnecessário.
  // Agora: 1 query base com janela ampla (-30d/+60d) + filtros visuais via
  // useMemo client-side. Trade-off: range='all' que pretendia mostrar histórico
  // > 30d agora cobre só -30d/+60d (suficiente pra 99% uso; histórico full
  // continua via /historico). Estimado -20% a -30% egress nesta release.
  const [tick, setTick] = useState(() => Math.floor(Date.now() / 60000))
  useEffect(() => {
    const t = setInterval(() => setTick(Math.floor(Date.now() / 60000)), 60000)
    return () => clearInterval(t)
  }, [])

  const baseWindow = useMemo(() => {
    const now = new Date(tick * 60000)
    const past = new Date(now); past.setDate(past.getDate() - 30)
    const future = new Date(now); future.setDate(future.getDate() + 60)
    return {
      from: past.toISOString(),
      to: future.toISOString(),
    }
  }, [tick])

  // v0.2.3.4 #163 — RPC consolidado get_dashboard_payload substitui 3 queries paralelas
  // (usePatients + useTreatments + useDoses) + 1 RPC (extend_continuous_treatments) por
  // single round-trip. Hook popula caches individuais via qc.setQueryData side-effect,
  // outras telas (Patients, DoseHistory, Reports) continuam usando hooks separados sem regressão.
  const { data: payload, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useDashboardPayload(baseWindow)
  // v0.2.3.6 #270 fix — detectar query travada mascarada por placeholderData (#267).
  // Quando current queryKey está fetching há >8s + temos placeholderData de OUTRA key,
  // mostrar banner "Sincronizando..." pra user saber que dados podem estar stale.
  // Esconde após 60s pra não ficar permanente (Sentry breadcrumb captura caso travado).
  const isStaleSync = isFetching && dataUpdatedAt && (Date.now() - dataUpdatedAt > 8000) && (Date.now() - dataUpdatedAt < 60000)
  const allDosesRaw = payload?.doses || []
  const patients = payload?.patients || []
  // Filter client-side por patientId (era passado pra useDoses query antes)
  const allDoses = useMemo(() => {
    if (!filters.patientId) return allDosesRaw
    return allDosesRaw.filter(d => d.patientId === filters.patientId)
  }, [allDosesRaw, filters.patientId])

  // Visualização principal — aplica range/status/type sobre allDoses
  const { from: rangeFrom, to: rangeTo } = useMemo(() => rangeNow(filters.range), [filters.range])
  const doses = useMemo(() => {
    const fromMs = new Date(rangeFrom).getTime()
    const toMs = new Date(rangeTo).getTime()
    let r = allDoses.filter(d => {
      const t = new Date(d.scheduledAt).getTime()
      return t >= fromMs && t <= toMs
    })
    if (filters.status) r = r.filter(d => d.status === filters.status)
    if (filters.type) r = r.filter(d => d.type === filters.type)
    return r
  }, [allDoses, rangeFrom, rangeTo, filters.status, filters.type])

  const [selected, setSelected] = useState(null)

  // MultiDoseModal — derived from multiDoseIds + loaded doses
  const multiDoseList = useMemo(
    () => multiDoseIds.map(id => allDoses.find(d => d.id === id)).filter(Boolean),
    [multiDoseIds, allDoses]
  )

  // Stats client-side (filtra allDoses por janela específica)
  const todayDoses = useMemo(() => {
    const now = new Date(tick * 60000)
    const sToday = new Date(now); sToday.setHours(0, 0, 0, 0)
    const eToday = new Date(now); eToday.setHours(23, 59, 59, 999)
    const sMs = sToday.getTime(); const eMs = eToday.getTime()
    return allDoses.filter(d => {
      const t = new Date(d.scheduledAt).getTime()
      return t >= sMs && t <= eMs
    })
  }, [allDoses, tick])
  const pendingToday = todayDoses.filter((d) => d.status === 'pending' || d.status === 'overdue').length

  // overdueAll: status='overdue' computed dynamically by listDoses (recomputeOverdue)
  // — filter por status atual cobre patches in-cache (post-confirmação)
  const overdueAll = useMemo(() => {
    const now = new Date(tick * 60000).getTime()
    return allDoses.filter(d => {
      const t = new Date(d.scheduledAt).getTime()
      return d.status === 'overdue' && t <= now
    })
  }, [allDoses, tick])
  const overdueNow = overdueAll.length

  const adherence = useMemo(() => {
    const now = new Date(tick * 60000).getTime()
    const weekAgo = now - 7 * 86_400_000
    const past = allDoses.filter(d => {
      const t = new Date(d.scheduledAt).getTime()
      return t >= weekAgo && t <= now
    })
    if (past.length === 0) return null
    const taken = past.filter(d => d.status === 'done').length
    return Math.round((taken / past.length) * 100)
  }, [allDoses, tick])

  // Merge: forward-window doses + sempre-overdue. Atrasadas semana passada
  // aparecem mesmo no filtro '12h'. Quando user escolhe status explícito ou
  // 'Tudo', merge é skip (evita dup ou poluição).
  const shouldMergeOverdue = !filters.status && filters.range !== 'all'
  const mergedDoses = useMemo(() => {
    if (!shouldMergeOverdue) return doses
    const seen = new Map()
    for (const d of doses) seen.set(d.id, d)
    for (const d of overdueAll) if (!seen.has(d.id)) seen.set(d.id, d)
    return [...seen.values()]
  }, [doses, overdueAll, shouldMergeOverdue])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const d of mergedDoses) {
      if (!map.has(d.patientId)) map.set(d.patientId, [])
      map.get(d.patientId).push(d)
    }
    // Doses dentro do grupo: cronológico asc (data + hora) independente do status.
    for (const list of map.values()) {
      list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    }
    // Pacientes: alfabético por name (locale pt-BR, case-insensitive).
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })
    return [...map.entries()]
      .map(([pid, list]) => ({
        patient: patients.find((p) => p.id === pid) || { id: pid, name: 'Paciente', avatar: '🙂' }, // #100 default
        list,
      }))
      .sort((a, b) => collator.compare(a.patient.name || '', b.patient.name || ''))
  }, [mergedDoses, patients])

  const selectedPatient = selected && patients.find((p) => p.id === selected.patientId)

  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dashCollapsed') || '{}') } catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem('dashCollapsed', JSON.stringify(collapsed)) } catch {}
  }, [collapsed])
  const toggleCollapse = (id) => setCollapsed((s) => ({ ...s, [id]: !s[id] }))

  // v0.2.2.3 (#213) — REMOVIDO scheduleDoses caller. App.jsx top-level useEffect
  // (com signature guard v0.2.2.2) já agenda full window 48h. Dashboard caller
  // era vestígio pré-#198 + executava a cada 60s via setInterval setTick:99
  // que flipava todayDoses ref → useEffect re-fire → cancelAll + reagenda mesmo
  // conteúdo idêntico → storm 1440 reschedules/dia. Audit logcat confirmou.
  // Daily summary é agendado dentro do mesmo rescheduleAll de App.jsx, sem perda.

  // Pull-to-refresh — overlay bar (não wrapa content, preserva sticky FilterBar)
  const handleRefresh = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ['doses'] }),
      qc.refetchQueries({ queryKey: ['patients'] }),
      qc.refetchQueries({ queryKey: ['user_prefs'] }),
      qc.refetchQueries({ queryKey: ['my_tier'] }),
      // Item #014 — refresh sob-demanda do horizon de tratamentos contínuos.
      // BUG-035 (#107): supabase.rpc() retorna PostgrestFilterBuilder (PromiseLike,
      // só .then), NÃO Promise nativo. .catch() direto throws TypeError. Usa
      // .then(handler, errHandler) — 2-arg form funciona em PromiseLike.
      hasSupabase
        ? supabase.schema('medcontrol').rpc('extend_continuous_treatments', { p_days_ahead: 5 })
            .then(undefined, err => console.warn('[refresh] extend_continuous err:', err?.message))
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
              unit={overdueNow > 0 ? 'agora' : undefined}
              tone={overdueNow > 0 ? 'danger' : 'neutral'}
            />
          </div>
        </div>

        <AdBanner />

        {isStaleSync && (
          <div role="status" style={{
            background: 'var(--dosy-info-bg)',
            color: 'var(--dosy-info)',
            padding: '8px 14px',
            borderRadius: 12,
            fontSize: 12.5,
            display: 'flex', alignItems: 'center', gap: 8,
            marginTop: 8,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: 99,
              background: 'currentColor',
              animation: 'shimmer 1.3s infinite',
              opacity: 0.7,
            }} />
            Sincronizando dados... (mostrando última versão conhecida)
          </div>
        )}

        {isError && !payload ? (
          // v0.2.3.4 #237 fix — error state explícito ao invés de skeleton infinito.
          // Quando RPC falha (401, network) sem placeholderData prévia disponível,
          // mostrar UI com retry ao invés de SkeletonList eterno.
          <Card padding={20} style={{ marginTop: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--dosy-fg-muted)', marginBottom: 12 }}>
              Não consegui carregar suas doses. Verifique sua conexão.
            </div>
            <Button variant="primary" onClick={() => refetch()}>
              Tentar de novo
            </Button>
            {error?.message && (
              <div style={{ fontSize: 11, color: 'var(--dosy-fg-muted)', marginTop: 8, opacity: 0.6 }}>
                {error.message.slice(0, 80)}
              </div>
            )}
          </Card>
        ) : isLoading ? <SkeletonList count={4} /> : (
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
          ) : mergedDoses.length === 0 ? (
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
                      <PatientAvatar patient={patient} color="peach" size={40}/>
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
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{
                            padding: '0 10px 10px',
                            display: 'flex', flexDirection: 'column', gap: 10,
                          }}>
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
                          </div>
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
