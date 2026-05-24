import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDashboardPayload, recomputeOverdueDoses } from '../services/dashboardService'
// v0.2.6.1 P1.5 (Roteiro_Alinhamento_Dosy_v2) — ativa reconcileDoses no payload.
// reconcileDoses respeita doses com `_localActedAt` recente (LATENCY_BUDGET_MS=2500ms)
// e descarta server payload que tentaria reverter status. Mata o bug "status volta do
// nada" em cellular ruim. Combina com gate Realtime + versionedCache stamp em mutations.
import { reconcileDoses } from '../state/versionedCache'

// v0.2.3.4 #163 — Hook consolidado Dashboard.
// Substitui 3 useQuery individuais (usePatients + useTreatments + useDoses) + 1 RPC
// (extend_continuous_treatments) por single RPC call que retorna todos os 4 results.
//
// Side-effect: popula cache TanStack ['patients'], ['treatments', {}], ['doses', filter]
// com os resultados — outras telas que usam usePatients/useTreatments/useDoses pegam
// cache fresh sem refetch (initialData fallback continua working pra hooks com filter
// patientId etc).
//
// Range default igual ao listDoses (-30d/+60d), recompute overdue client-side mantido.

function roundToHour(iso) {
  if (!iso) return iso
  const d = new Date(iso)
  if (isNaN(d)) return iso
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

// v0.2.3.7 #273 (F3 perf audit 2026-05-15) — cache module-scope do último payload
// bem-sucedido. Mantém proteção #267 (skeleton infinito on hour boundary) MAS sem
// custo `qc.getQueryCache().findAll() + sort` em CADA render do Dashboard.
//
// Antes (#267): placeholderData varria todo cache + sortava por dataUpdatedAt em todo
// render. O(N) onde N = todas entries `['dashboard-payload', *]` no cache.
//
// Agora: useEffect atualiza ref module-scope quando query bem-sucedida. placeholderData
// lê ref O(1). Mesmo benefício pra cross-key transition (hour 19→20), zero custo render.
//
// Edge case raríssimo (<0.1%): primeira abertura exata no minuto da virada de hora
// antes de qualquer fetch completar — ref ainda undefined → skeleton momentâneo. Mesmo
// comportamento do código pre-#267. Aceitável.
let _lastDashboardPayload = null
let _lastDashboardPayloadUpdatedAt = 0

export function useDashboardPayload({ from, to, daysAhead = 5 } = {}) {
  const qc = useQueryClient()

  // Stable queryKey via hour-normalized timestamps (mesma estratégia useDoses)
  const keyFilter = useMemo(() => ({
    from: roundToHour(from),
    to: roundToHour(to),
    daysAhead
  }), [from, to, daysAhead])

  const query = useQuery({
    queryKey: ['dashboard-payload', keyFilter],
    queryFn: () => getDashboardPayload({ from, to, daysAhead }),
    staleTime: 2 * 60_000,
    refetchOnMount: true,
    refetchOnReconnect: true,
    // v0.2.6.9 FIX UI-LENTA: focus refetch OFF. RPC `get_dashboard_payload` é
    // pesado (joins patients+treatments+doses+overdue compute server-side).
    // Antes: cada modal open/close, scroll snap mobile, tab switch → focus event
    // → refetch full payload. Múltiplas vezes/min. PostgreSQL CPU + WebView main
    // thread parse JSON ~50-200KB. Cobertura mantida: Realtime postgres_changes
    // + manual PtR + setInterval setTick recompute overdue. useAppResume cobre
    // soft recover pós-idle >=5min.
    refetchOnWindowFocus: false,
    // v0.2.3.4 #237 fix — placeholderData cobre RPC falhar silentemente (401/network
    // drop) mantendo Dashboard UI com último dado conhecido em vez de SkeletonList eterno.
    //
    // v0.2.3.6 #267 — cross-key transition (hour 19→20 cria nova queryKey, previousData
    // undefined). Cache do último payload via ref module-scope (v0.2.3.7 #273 F3) atende
    // sem custo O(N) per-render.
    placeholderData: (previousData) => previousData || _lastDashboardPayload || undefined,
    retry: 5,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
  })

  // v0.2.3.7 #273 — atualiza ref module-scope quando query bem-sucedida (1× por update).
  // Substitui findAll+sort O(N) por render do placeholderData pre-fix.
  useEffect(() => {
    if (query.isSuccess && query.data) {
      _lastDashboardPayload = query.data
      _lastDashboardPayloadUpdatedAt = Date.now()
    }
  }, [query.isSuccess, query.data])

  // v0.2.3.9 P4 — dual write removido. Antes populava ['doses', filter] também,
  // criando duplo namespace que dobrava custo de patch/invalidate por mutação +
  // serializava 2× no IDB. Agora payload.doses fica APENAS em ['dashboard-payload', *]
  // (single source of truth). ['patients'] + ['treatments', {}] mantidos —
  // são caches pequenos sem patch-heavy hot path.
  useEffect(() => {
    if (!query.data) return
    const { patients, treatments } = query.data

    if (Array.isArray(patients)) {
      qc.setQueryData(['patients'], patients)
    }
    if (Array.isArray(treatments)) {
      qc.setQueryData(['treatments', {}], treatments)
    }
  }, [query.data, qc])

  // v0.2.3.10 #295 — enriquecer doses com patientName via payload.patients
  // ANTES de cachear. Garante consumer (App.jsx scheduler, AlarmService, etc)
  // sempre tem patientName sem depender de patientsMap cache stale.
  //
  // v0.2.6.1 P1.5 — reconcileDoses entre cache atual e incoming. Se cache tem doses
  // patchadas optimistic (com _localActedAt < 2.5s), mantém otimista — server payload
  // que tentaria reverter status é descartado dentro da janela. Combina com gate Realtime.
  const dosesComputed = useMemo(() => {
    if (!query.data?.doses) return undefined
    const patientsMap = new Map((query.data.patients || []).map(p => [p.id, p]))
    const enriched = query.data.doses.map((d) => ({
      ...d,
      patientName: d.patientName || patientsMap.get(d.patientId)?.name || '',
    }))
    const overdueRecomputed = recomputeOverdueDoses(enriched)
    // Lê snapshot atual do cache pra reconciliar.
    const cachedPayload = qc.getQueryData(['dashboard-payload', keyFilter])
    const cachedDoses = Array.isArray(cachedPayload?.doses) ? cachedPayload.doses : null
    if (!cachedDoses) return overdueRecomputed
    return reconcileDoses(cachedDoses, overdueRecomputed)
  }, [query.data, qc, keyFilter])

  return {
    ...query,
    data: query.data
      ? { ...query.data, doses: dosesComputed }
      : undefined,
  }
}
