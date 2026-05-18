# Auditoria Egress Supabase — 2026-05-05

> **Tipo:** Auditoria técnica focada (egress consumption analysis)
> **Escopo:** App inteiro — frontend hooks + services + Edge Functions + cron jobs + DB triggers + Realtime config
> **Duração:** ~2h
> **Ferramentas:** `pg_stat_statements`, Supabase Dashboard Reports, leitura código linha por linha
> **Veredito:** ⚠️ **Múltiplos vetores ativos. Fix #092 (v0.1.7.5) resolveu apenas ~30% do problema.**

---

## 1. Sumário Executivo

**Métricas observadas:**

| Métrica | Valor | Limite Free | Status |
|---|---|---|---|
| Egress mês corrente (26 abr → 26 mai) | **35.79 GB** | 5 GB | **715% (overage 30.79 GB)** |
| Pico diário 04 mai 2026 | **9.64 GB** | — | crítico |
| Cache hit ratio | **0.0%** | qualquer % > 0 | nada cacheado |
| Quebra dia 04 mai: PostgREST | **9.64 GB (98.6%)** | — | **culpa principal** |
| Realtime | 136.5 MB (1.4%) | — | OK |
| Auth | 2.2 MB (0.0%) | — | OK |
| Edge Functions | 15.1 KB (0.0%) | — | OK em egress (mas custa internamente — ver §3.7) |
| pg_stat_statements top query (`SELECT 11cols FROM doses WHERE scheduledAt BETWEEN...`) | **3.5 milhões de calls** | — | 1.4 calls/s contínuo |

**Diagnóstico em 1 linha:** Egress dominado por **PostgREST GET `medcontrol.doses`** disparado por 6+ caminhos diferentes que **invalidam queries em massa** sem debounce.

**Grace period Free tier expira 06 May 2026 (amanhã).** Após: requests retornam HTTP 402 → app inutilizável.

---

## 2. Histórico de tentativas anteriores (não refazer)

| Item | Quando | O que fez | Funcionou? |
|---|---|---|---|
| **#092 v0.1.7.5** (2026-05-03) | egress reduction multi-frente | Realtime filter `userId=eq.X` + `listDoses` default range -30d/+60d + queryKey `roundToHour` + paginate cap 20→5 + `staleTime` bumps em `useUserPrefs/usePatients/useTreatments/useMyTier` | **Parcial** — reduziu listDoses range mas deixou intactos os caminhos de invalidação massiva |
| **#101 v0.2.0.1** (2026-05-04) | re-audit pós-#092 | Snapshot pg_stat_statements: WAL polling normal, 0 queries patológicas isoladas | Validação superficial — não detectou pattern de invalidate cascade |
| **#115 v0.2.0.2** (2026-05-04) | photo_version localStorage cache | Patient photo `photo_url` removido de PATIENT_COLS_LIST | OK pra photo egress, não relacionado ao bug atual |

**Conclusão:** corrigimos sintomas óbvios (range gigante, payload foto) mas não a **causa raiz**: hooks de lifecycle disparando `invalidateQueries()` em eventos não-data-related (visibility change, focus, resume, watchdog tick).

---

## 3. Findings detalhados

### F1 — `useAppResume` invalida TUDO em cada visibility/focus change [P0 CRÍTICO]
**Arquivo:** `src/hooks/useAppResume.js:39-59`

```js
if (inactiveMs >= SOFT_RECOVER_THRESHOLD_MS) {
  // 5min idle → soft recover
  await qc.invalidateQueries()        // ← invalida TUDO
  await qc.refetchQueries({ type: 'active' })
} else {
  qc.invalidateQueries()              // ← invalida TUDO mesmo se idle 1 segundo!
}
```

**Triggers:** `visibilitychange`, `window.focus`, `Capacitor appStateChange`. User típico mobile/web muda tabs/apps **dezenas a centenas de vezes/dia**. Cada mudança → invalidate sem queryKey → **TODAS queries marcadas stale** → `refetchOnWindowFocus` (default `true` no queryClient) → **REFETCH ALL** na próxima render.

**Volume estimado:** 100 visibility changes/dia × 6-10 useDoses ativos × 50KB-1MB = **30-100 MB/dia/user só desse hook**.

### F2 — `useRealtime` invalida em CADA `postgres_change` sem debounce [P0 CRÍTICO]
**Arquivo:** `src/hooks/useRealtime.js:113-119`

```js
ch.on('postgres_changes', opts, () => {
  for (const key of TABLE_TO_KEYS[table]) {
    qc.invalidateQueries({ queryKey: key })  // ← imediato, sem debounce
  }
})
```

**Combinado com `pg_cron.extend-continuous-treatments-daily`** (insere ~50-200 doses futuras/treatment ativo/dia em **batch único**) = **batch de N INSERTs → N webhooks broadcast Realtime → N invalidates → N × M refetches** (M = useDoses ativos no client).

**Volume:** cron extend daily com 8 treatments ativos × 30 doses futuras = 240 INSERTs em segundos → 240 invalidates → 240 × 4 useDoses Dashboard = **960 refetches em rajada** se app aberto durante o cron.

### F3 — Dashboard tem 4 `useDoses` paralelas [P0 ALTO]
**Arquivo:** `src/pages/Dashboard.jsx:85, 116, 118, 123`

```js
const { data: doses = [] } = useDoses(query)             // range filtro user
const { data: todayDoses = [] } = useDoses(windows.today)// hoje only
const { data: overdueAll = [] } = useDoses(windows.overdue) // -30d → now
const { data: weekDoses = [] } = useDoses(windows.week)  // -7d → now
```

Cada qual com `queryKey` próprio = cache separado = refetch separado. **Cada navegação pra Dashboard dispara 4 round-trips paralelos.** Cada invalidate cascade (F1, F2) multiplica por 4.

### F4 — `DOSE_COLS` inclui `observation` (até 500 chars) [P1 MEDIUM]
**Arquivo:** `src/services/dosesService.js:15`

```js
const DOSE_COLS = 'id, userId, treatmentId, patientId, medName, unit, scheduledAt, actualTime, status, type, observation'
```

`observation` carregado em **toda lista** mesmo quando UI não mostra. Cada dose com obs longa = 250→700 bytes. listDoses retorna até 5000 rows × 1KB médio = **5 MB por call**.

### F5 — `useRealtime` watchdog reconecta a cada 60s + invalida tudo [P1]
**Arquivo:** `src/hooks/useRealtime.js:144-155`

```js
watchdogTimer = setInterval(async () => {
  if (state !== 'joined' && state !== 'joining') {
    await unsubscribe(); await subscribe()
    for (const keys of Object.values(TABLE_TO_KEYS)) {
      for (const key of keys) qc.invalidateQueries({ queryKey: key })  // ← todas tabelas
    }
  }
}, 60_000)
```

Em mobile com network instável (que é o cenário Dosy), `state` varia. Pode disparar reconnect + invalidate **a cada 60s** continuamente.

### F6 — `useRealtime` native resume invalida tudo [P1]
**Arquivo:** `src/hooks/useRealtime.js:177-183`

```js
resumeHandle = await CapacitorApp.addListener('resume', async () => {
  await subscribe()
  for (const keys of Object.values(TABLE_TO_KEYS)) {
    for (const key of keys) qc.invalidateQueries({ queryKey: key })
  }
})
```

Mais 1 caminho que invalida tudo ao resume. Combina com F1 (`useAppResume.appStateChange`) — **2 listeners disparando em paralelo no mesmo evento**.

### F7 — `dose-trigger-handler` Edge dispara em CADA INSERT/UPDATE doses [P1]
**Arquivo:** `supabase/functions/dose-trigger-handler/index.ts:96-106`

Cada modificação em `medcontrol.doses` → webhook DB → Edge function:
1. SELECT `user_prefs` (1 query)
2. SELECT `push_subscriptions` (1 query)
3. OAuth Google FCM (cached 1h)
4. POST FCM API per device

**Cron `extend_continuous_treatments` insere centenas de doses futuras** mas dose-trigger-handler **não filtra por horizon**: dispara FCM imediato pra dose que toca **30 dias adiante**. Cron 6h cobriria mesma necessidade.

### F8 — `schedule-alarms-fcm` cron envia payload até 500 doses [P1]
**Arquivo:** `supabase/functions/schedule-alarms-fcm/index.ts:156-185`

```js
const { data: doses } = await supabase.from('doses')
  .select('id, medName, unit, scheduledAt, patientId')
  .eq('status', 'pending')
  .gte('scheduledAt', now.toISOString())
  .lte('scheduledAt', horizonEnd.toISOString())  // HORIZON_HOURS = 72
  .limit(500)
```

72h horizon × 4 doses/dia × 5 treatments ativos = **120 doses por device call**. JSON stringify ~150B/dose × 120 = **18KB por FCM message**. 4×/dia × 2 devices × 18KB × 30 dias = **4.3 MB FCM-only**. Pequeno isolado mas combina com volume.

### F9 — `useUserPrefs.queryFn` faz `auth.getUser()` HTTP round-trip [P2]
**Arquivo:** `src/hooks/useUserPrefs.js:50`

`supabase.auth.getUser()` em Supabase JS v2 recente bate `/auth/v1/user` (não local). Cada query useUserPrefs = 1 round-trip auth + 1 query DB. `getSession()` seria local-only.

### F10 — `useReceivedShares` staleTime 60s [P2]
**Arquivo:** `src/hooks/useShares.js`

```js
staleTime: 60_000
```

Refetch a cada 1min. Shares mudam raramente. Deveria ser 5-15min.

### F11 — `pg_cron schedule-alarms-fcm-6h` JWT service_role HARDCODED [P0 SECURITY, não-egress]
**Cron job 3:**
```sql
SELECT net.http_post(
  url:='https://guefraaqbkcehofchnrc.supabase.co/functions/v1/schedule-alarms-fcm',
  headers:='{"Authorization":"Bearer eyJ...service_role JWT...iat 26 abr 2026 exp 10 anos"}'
)
```

JWT iat 26 abr (anterior #084 02 mai). Indica que rolling JWT secret de #084 NÃO afetou esse JWT, OU rotação foi parcial. Risco: este JWT vazado em qualquer commit antigo continua válido.

### F12 — `pg_stat_statements` confirma magnitude
- `set_config('search_path'...)` (PostgREST per-request setup): **4.092.245 calls** (4M, ~1 a cada 0.6s)
- WAL polling Realtime (pgoutput): **315k calls + 434M block I/O** (bom — só CPU/I/O interno, não egress)
- listDoses query template: **3.514.255 calls + 3.5M rows retornadas** = **1.4 calls/s contínuos**, ~85KB resp média = **~3 GB/dia só dessa query**

---

## 4. Plano de fixes priorizados

> Ordem por **impacto / esforço**. Fix top-3 sozinho deve resolver grace period.

### P0 IMEDIATO (impacto >50% redução, esforço baixo)

#### #134 [P0 cost] — `useAppResume`: remover invalidate em short idle, scopear em long idle
**Mudança:** linha 58 de `useAppResume.js` (`qc.invalidateQueries()` em short idle <5min) — **REMOVER**. Realtime + refetchInterval cobrem updates necessários em janelas <5min. Long idle (>=5min) já faz refetch active queries — não precisa também invalidar tudo.

**Impacto egress:** **-30% a -45%** (depende padrão de uso)

**Impacto funcional:** Web — user que troca tabs frequentemente NÃO refetch tudo a cada return. Cache válido se staleTime não esgotou. **UX:** dados podem aparecer 30-120s mais "antigos" se Realtime não trouxer update; pequeno trade-off por enorme economia.

#### #135 [P0 cost] — `useRealtime` resume nativo: remover invalidate ALL keys
**Mudança:** `useRealtime.js:180-182` — remover loop `qc.invalidateQueries`. Realtime postgres_changes traz updates pós-resume automaticamente.

**Impacto egress:** **-5% a -10%**

**Impacto funcional:** zero. Realtime resubscribe + postgres_changes events tomam conta.

#### #136 [P0 cost] — `useRealtime` postgres_changes: debounce invalidate 1s
**Mudança:** wrap `qc.invalidateQueries` em `lodash.debounce` (ou simples timeout + flag) por table. Múltiplos changes em <1s = 1 invalidate.

**Impacto egress:** **-15% a -25%** (especialmente dias de cron extend)

**Impacto funcional:** atualização cross-device pode demorar até 1s extra (vs imediato). Healthcare app — não-crítico pra dose listing.

#### #137 [P0 cost] — Dashboard: consolidar 4 useDoses em 1
**Mudança:** `Dashboard.jsx` — substituir 4 hooks por 1 `useDoses({from: -30d, to: +14d})` (cobre overdue + today + week + range filtro user). Filtros visuais via `useMemo` client-side sobre o array único.

**Impacto egress:** **-20% a -30%** em sessões Dashboard (~50% do uso típico)

**Impacto funcional:** Dashboard 1 round-trip em vez de 4. **Mais rápido** pra usuário (paralelismo HTTP em mobile não compensa serialização parsing). Filtros em memória são instantâneos.

#### #138 [P0 cost] — `DOSE_COLS_LIST` sem `observation`
**Mudança:** `dosesService.js` — criar `DOSE_COLS_LIST` (10 cols, sem observation) pra `listDoses`. Manter `DOSE_COLS_FULL` pra `getDose` detail (DoseModal). Análoga à mudança feita em #115 (PATIENT_COLS_LIST/FULL).

**Impacto egress:** **-15% a -30%** no payload listDoses

**Impacto funcional:** zero — UI lista não exibe observation, só DoseModal carrega detail. (Verificar Reports.jsx e Analytics.jsx — se exibem observation em lista, ajustar pra carregar via getDose só ao expandir).

### P1 (impacto medium, esforço baixo-médio)

#### #139 [P1 cost] — `dose-trigger-handler`: skip se scheduledAt > 6h futuro
**Mudança:** `dose-trigger-handler/index.ts:103-106` adicionar:
```ts
if (scheduledAt.getTime() > Date.now() + 6 * 3600 * 1000) {
  return new Response(JSON.stringify({ ok: true, skipped: 'beyond-cron-horizon' }))
}
```
Cron 6h `schedule-alarms-fcm` cobre 72h adiante — quando dose chega janela 6h, cron pega.

**Impacto egress:** Edge invocations -50-70% (não diretamente egress mas reduz internal egress + DB load + FCM API calls)

**Impacto funcional:** zero. Alarme nativo agendado pelo cron 6h antes da dose, comportamento idêntico ao usuário.

#### #140 [P1 cost] — `schedule-alarms-fcm`: HORIZON 72h → 24h
**Mudança:** `schedule-alarms-fcm/index.ts` — `HORIZON_HOURS = 24` (era 72). Cron roda 6h × 4 ciclos = janela 24h coberta com folga 4×.

**Impacto egress:** payload FCM 3× menor; AlarmManager nativo recebe lista menor por call.

**Impacto funcional:** zero. Cron 6h re-agenda cada batch — nada perde.

#### #141 [P1 cost] — `useReceivedShares` staleTime 60s → 5min
**Impacto egress:** pequeno mas free win.

**Impacto funcional:** novo share notif pode demorar até 5min em aparecer. Aceitável.

#### #142 [P0 SECURITY] — Rotacionar JWT cron `schedule-alarms-fcm-6h` + refatorar pra usar vault/env
**Mudança:** drop cron job atual + recriar usando `vault.read_secret('SUPABASE_SERVICE_ROLE_KEY')` ou `supabase_functions.http_request` (passa service key automaticamente). Deletar JWT antigo + rotate JWT secret se ainda válido.

**Impacto egress:** zero (security-only).

**Impacto funcional:** zero (cron continua igual com auth correta).

### P2 (estructural, longo prazo)

#### #143 [P2] — `useUserPrefs.queryFn`: `getSession()` em vez de `getUser()`
**Impacto egress:** 1 round-trip auth a menos por refetch useUserPrefs.

#### #144 [P2] — Custom JWT claim `tier` via Auth Hook
**Impacto egress:** elimina `useMyTier` round-trip — tier vem direto no JWT.

#### #145 [P2] — `useRealtime` watchdog: invalidate só se data divergente
**Mudança:** verificar timestamp último change broadcast vs `qc.getQueryState('doses').dataUpdatedAt`. Só invalidate se diff significativo.

**Impacto egress:** mobile flaky -5%.

#### #146 [P2] — `pg_cron extend_continuous_treatments`: insert em batch single transaction
**Atual:** Possível fazer N INSERTs separados → N webhooks. Confirmar.
**Fix:** single multi-row INSERT → 1 webhook (Supabase webhooks consolidam? verificar).

---

## 5. Estimativa de impacto consolidado

| Aplicar | Redução estimada | Egress mensal projetado (2 users) |
|---|---|---|
| Apenas P0 (#134-#138) | **-65% a -75%** | ~9-12 GB |
| P0 + P1 cost (#139-#141) | **-75% a -85%** | ~5-8 GB |
| P0 + P1 + P2 | **-85% a -90%** | ~3-5 GB |

**Comparação Free Plan (5GB):** P0 sozinho não cabe Free com 2 users heavy. P0+P1 fica próximo do limite. P0+P1+P2 cabe. **Em escala 10+ users, Pro plan ($25, 250GB) é necessário independente.**

---

## 6. Recomendação sequencial

1. **Imediato (próximas horas):** aplicar **P0 (#134, #135, #136, #137, #138)** — ~3-4h código + 1 release v0.2.0.8. Resolve grace period AMANHÃ.
2. **24h:** observar métricas dashboard. Se egress diário <500MB → confirmado.
3. **48h:** aplicar P1 (#139-#142) em release v0.2.0.9.
4. **Próxima semana:** P2 estructural pré-Closed Testing.

**Em paralelo, recomendado:** upgrade Pro $25/mês temporário enquanto fixes não validados. Downgrade após confirmar redução.

---

## 7. Validação pós-fix

**Métricas a observar:**

```sql
-- pg_stat_statements pgrst doses calls/dia
SELECT calls, rows FROM pg_stat_statements
WHERE query LIKE '%pgrst_source%medcontrol.doses%scheduledAt%' LIMIT 1;
-- Antes: ~117k calls/dia
-- Esperado pós-P0: ~30-40k calls/dia
```

**Dashboard Reports → Egress per day:** deve cair de 9.6GB/dia pra <2GB/dia em 24-48h.

**Cache hit ratio:** deve subir de 0% pra 5-15% (embora Supabase Free não otimize cache muito).

---

## Appendix — Arquivos auditados

- `src/hooks/useDoses.js` (149 linhas)
- `src/hooks/useRealtime.js` (197 linhas)
- `src/hooks/useAppResume.js` (101 linhas)
- `src/hooks/useAppUpdate.js` (parcial — fetch /version.json a cada 30min OK)
- `src/hooks/usePatients.js` (50 linhas)
- `src/hooks/useTreatments.js` (97 linhas)
- `src/hooks/useUserPrefs.js` (118 linhas)
- `src/hooks/useSubscription.js` (83 linhas)
- `src/hooks/useShares.js` (parcial — useReceivedShares staleTime 60s)
- `src/services/dosesService.js` (DOSE_COLS, applyDefaultRange, listDoses pagination)
- `src/services/patientsService.js` (PATIENT_COLS_LIST/FULL — OK pós-#115)
- `src/main.jsx` (queryClient defaults — `refetchOnWindowFocus: true` global)
- `src/App.jsx` (alarmWindow hourTick — OK)
- `src/components/dosy/AppHeader.jsx` (4 queries por header global)
- `src/pages/Dashboard.jsx` (4 useDoses paralelas)
- `supabase/functions/dose-trigger-handler/index.ts` (194 linhas)
- `supabase/functions/schedule-alarms-fcm/index.ts` (207 linhas)
- pg_stat_statements top calls
- pg_cron jobs ativos
- pg_publication_tables (Realtime)

**Não auditados (fora escopo egress agora):**
- `notify-doses` Edge Function (não causa egress significativo per logs)
- Storage bucket policies (zero usage atualmente)
- AdMob outbound (web only, não Supabase)
- Sentry / PostHog egress (separados do Supabase quota)
