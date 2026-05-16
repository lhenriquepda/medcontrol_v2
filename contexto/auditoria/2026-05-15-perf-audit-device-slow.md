# Auditoria — App Dosy lento no device pós últimas releases

**Data:** 2026-05-15
**Branch:** `docs/perf-audit-device-slow`
**Trigger:** User reportou: "cada ação trava, swipe marcar/pular doses em sequência agarra, até clicar no NAV menu engasga".
**Versão investigada:** master @ `v0.2.3.6` (vc 69)

---

## 1. TL;DR — Root cause provável

A lentidão **não é um único bug** — é uma **cascata de regressões introduzidas entre v0.2.3.4 e v0.2.3.6** que multiplicaram o custo por interação. Não existe ainda evidência de profiler (próximo passo), mas a leitura do código revela 3 amplificadores funcionando juntos:

| Amplificador | Release | Custo agregado |
|---|---|---|
| **A** — Cache duplicado: doses passaram a viver em DOIS namespaces (`['doses', *]` + `['dashboard-payload', *].doses`). Toda mark/skip/undo patch + invalida ambos. | v0.2.3.4 #163 + v0.2.3.5 #239 | 2× cache writes + 2× server refetch + 2× IDB serialize por interação |
| **B** — App.jsx mantém janela de **90 dias** (`-30d/+60d`) ativa na raiz via `useDoses(alarmWindow)`. Cache pode chegar a milhares de doses serializadas no IDB a cada mutação. | v0.2.3.1 Bloco 7 (A-04 "janela unificada com Dashboard") | Persist throttle 1s, mas `JSON.stringify` cresce com tamanho cache → blocking main thread no Android WebView |
| **C** — `useDashboardPayload.placeholderData` faz `findAll({ queryKey: ['dashboard-payload'] })` + sort em **toda renderização** do Dashboard. | v0.2.3.6 #267 | O(N) por render — não trava sozinho, mas amplifica quando combinado com A+B |

**Hipótese principal:** o usuário sente lag em **toda ação que dispara setQueryData** (mark dose, criar tratamento, navegar entre rotas que invalidam cache) porque cada uma agora dispara:

1. Patch em ~2× mais keys que antes (#239 espalhou para `['dashboard-payload']`).
2. Invalidate de ambos namespaces → 2 refetches RPC.
3. Persist IDB serializa cache crescido (90 dias × N pacientes × N tratamentos).
4. App.jsx re-renderiza subárvore inteira porque `allDoses` ref muda (mesmo com `dosesSignature` memoização — signature `id:status:scheduledAt` recalcula em O(N) por mark).

---

## 2. Evidências de código

### 2.1 Duplo namespace de cache (A)

`src/services/mutationRegistry.js:53-81` — `patchDoseInCache`:

```js
function patchDoseInCache(qc, id, patch) {
  // findAll em ['doses'] — patcha TODAS variações por filter
  const queries = qc.getQueryCache().findAll({ queryKey: ['doses'] })
  for (const q of queries) {
    const data = q.state.data
    if (!Array.isArray(data)) continue
    qc.setQueryData(q.queryKey, data.map(d => d.id === id ? { ...d, ...patch } : d))
  }
  // v0.2.3.5 #239 — patcha TAMBÉM ['dashboard-payload', *].doses
  const dpQueries = qc.getQueryCache().findAll({ queryKey: ['dashboard-payload'] })
  for (const q of dpQueries) {
    const data = q.state.data
    if (!data || !Array.isArray(data.doses)) continue
    qc.setQueryData(q.queryKey, {
      ...data,
      doses: data.doses.map(d => d.id === id ? { ...d, ...patch } : d)
    })
  }
}
```

`src/services/mutationRegistry.js:137-145` — `refetchDoses` (debounce 2s + invalida ambos):

```js
function refetchDoses(qc) {
  if (_refetchDosesTimer) clearTimeout(_refetchDosesTimer)
  _refetchDosesTimer = setTimeout(() => {
    qc.invalidateQueries({ queryKey: ['doses'], refetchType: 'active' })
    qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    _refetchDosesTimer = null
  }, 2000)
}
```

**Cada mark-dose dispara o ciclo completo 2× (uma vez pra `['doses']`, outra pra `['dashboard-payload']`).** Antes do #239, era 1×.

`src/hooks/useDashboardPayload.js:65-88` — side-effect que **escreve em ['doses']** quando RPC volta, criando uma terceira via de duplicação:

```js
useEffect(() => {
  if (!query.data) return
  const { patients, treatments, doses } = query.data
  if (Array.isArray(patients)) qc.setQueryData(['patients'], patients)
  if (Array.isArray(treatments)) qc.setQueryData(['treatments', {}], treatments)
  if (Array.isArray(doses)) {
    const computed = recomputeOverdueDoses(doses)
    qc.setQueryData(['doses', { from: ..., to: ..., ... }], computed)
  }
}, [query.data, qc, from, to])
```

Toda vez que `dashboard-payload` refetcha, sobrescreve `['doses']` também → invalida memoization downstream → re-render extra.

### 2.2 Janela 90 dias na raiz App.jsx (B)

`src/App.jsx:132-148`:

```js
const [hourTick, setHourTick] = useState(() => Math.floor(Date.now() / 3600_000))
useEffect(() => {
  const t = setInterval(() => setHourTick(...), 3600_000)
  return () => clearInterval(t)
}, [])
// v0.2.3.1 Bloco 7 (A-04) — janela unificada com Dashboard (-30d/+60d).
const alarmWindow = useMemo(() => {
  const now = new Date(hourTick * 3600_000)
  const past = new Date(now); past.setDate(past.getDate() - 30)
  const future = new Date(now); future.setDate(future.getDate() + 60)
  return { from: past.toISOString(), to: future.toISOString() }
}, [hourTick])
const { data: allDoses = [], isSuccess: dosesLoaded } = useDoses(alarmWindow)
```

**Histórico:** v0.1.7.5 #092 usava `-1d/+14d` ("janela explícita pra evitar pull 7000+ rows histórico — egress nuke"). v0.2.3.1 Bloco 7 alargou para `-30d/+60d` na justificativa de "unificar com Dashboard pra cache compartilhado e evitar 2 round-trips".

O problema: **a unificação não eliminou as 2 queries** porque o Dashboard usa `useDashboardPayload` (RPC `get_dashboard_payload`) em outro namespace. A janela só ficou maior. Cache cresceu ~6× sem ganho proporcional.

### 2.3 `placeholderData` cross-key O(N) (C)

`src/hooks/useDashboardPayload.js:50-57`:

```js
placeholderData: (previousData) => {
  if (previousData) return previousData
  const all = qc.getQueryCache().findAll({ queryKey: ['dashboard-payload'] })
  const withData = all.filter((q) => q.state.data)
  if (withData.length === 0) return undefined
  withData.sort((a, b) => (b.state.dataUpdatedAt || 0) - (a.state.dataUpdatedAt || 0))
  return withData[0].state.data
}
```

`placeholderData` é chamado em **todo render** do Dashboard. Mesmo o `previousData ? return` no início ajuda no caso comum, mas em qualquer transição de queryKey (boundary de hora, ou após invalidate global) cai no findAll + sort.

### 2.4 Persist IDB serializa cache crescido

`src/main.jsx:141-155`:

```js
const persister = idbAvailable
  ? createAsyncStoragePersister({
      storage: {
        getItem: (key) => idbGet(key),
        setItem: (key, value) => idbSet(key, value),
        removeItem: (key) => idbDel(key),
      },
      key: 'dosy-query-cache',
      throttleTime: 1000
    })
  : createSyncStoragePersister({...})
```

IDB é async (write off-main-thread), mas o **dehydrate (serialize JSON) roda no main thread** antes do write. Cache size ≈ doses × pacientes × tratamentos × payload duplicado.

**Estimativa caso médio:**
- 3 pacientes × 2 tratamentos ativos × ~4 doses/dia × 90 dias = **~2160 doses** em `['doses', alarmWindow]`
- Mesmas ~2160 doses em `['dashboard-payload', filter].doses`
- 2-3 outras queryKeys `['doses', {patientId: X}]` (PatientDetail screens visitadas)
- Total ~5-7 mil dose records serializados (~3-5MB de JSON)
- `JSON.stringify` de 4MB em Android WebView V8 ≈ 80-200ms blocking
- Disparado 1× por segundo no pior caso (throttle TanStack 1000ms)

### 2.5 App.jsx subárvore + hooks pesados no root

App.jsx tem **17 useEffects + 8 hooks ativos** na raiz, todos disparam em mudança de `user`, `location`, ou query state:
- `useAuth`, `useAppResume`, `useAdMobBanner`, `useInAppReview`, `useAppLock`
- `useDoses(alarmWindow)` (90 dias)
- `usePatients()`
- `usePushNotifications` (com `scheduleDoses` deps em signatures)

Cada re-render do App.jsx:
- Reavalia 485 linhas
- `dosesSignature` recalcula em O(N) sobre allDoses (~2000+ items): `.map().sort().join('|')`
- `patientsSignature` mesma coisa
- Memoização funciona, mas signature recalcula sempre que `allDoses` ref muda — e ref muda toda vez que cache `['doses', alarmWindow]` é patcheado/invalidado

---

## 3. O que regrediu — timeline

| Release | Commit | Impacto perf |
|---|---|---|
| v0.2.3.1 Bloco 7 | `0cfef80` | App.jsx alarmWindow expandido `-1d/+14d` → `-30d/+60d` ("unificar cache com Dashboard") |
| v0.2.3.4 #163 | `ad67369` | Novo namespace `['dashboard-payload']` criado |
| v0.2.3.4 #165 | `9729fc5` | localStorage sync → IDB async + staleTime 30min |
| v0.2.3.5 #239 | `11248cd` | `patchDoseInCache` agora patcha **ambos** namespaces |
| v0.2.3.5 #240-#249 | `14d739b` | Redesign UI 5 telas + sistema gradiente (custo render incremental — ainda não auditado em detalhe) |
| v0.2.3.6 #266 | `4113639` | `insertEntityIntoLists` adiciona varredura cross-key em `['treatments', *]` |
| v0.2.3.6 #267 | `20efdbf` | `placeholderData` findAll + sort em todo render Dashboard |
| v0.2.3.6 #271 | `66d0cd7` | `createTreatment.onSuccess` ganhou `invalidate ['dashboard-payload']` |

**Antes (≤v0.2.3.0):** mark dose disparava 1 patch em `['doses']` + 1 invalidate + 1 refetch. Cache pequeno (`-1d/+14d`).
**Agora (v0.2.3.6):** mark dose dispara 2 patches (N + M queryKeys), 2 invalidates, 2 refetches, persist serialize cache 6× maior, App.jsx re-renderiza com signature O(N) sobre 2000+ items.

---

## 4. Por que NAV menu também engasga (não só swipe)

Click em BottomNav → `navigate('/x')` →
1. `location.pathname` muda
2. `useEffect` em App.jsx:99-101 dispara `window.scrollTo(0, 0)` (cheap)
3. `useEffect` em App.jsx:219-309 reavalia listeners (deps `user, navigate, location.pathname`) — remove+adiciona 4 listeners Capacitor
4. Lazy chunk load do `<Page>` alvo (custo parse JS em Android WebView, ~100-300ms primeira visita)
5. `<Suspense>` mostra `PageSkeleton`
6. Page mounta — seus hooks rodam:
   - `useDoses(filter)` → cache check → se stale (2min) → refetch + invalidate cascade
   - `useDashboardPayload` (se Dashboard) → cache check + placeholderData findAll
7. `AppHeader` + `BottomNav` re-renderizam (não memoizados)
8. Persist IDB serializa qualquer setQueryData novo

Se o user navega rápido entre rotas → cada navegação pode estar disparando refetch+cache rewrite enquanto o JS chunk parse + render acontecem. Em Android WebView com cache 5MB, é receita pra long task >100ms = jank visível.

---

## 5. Outros suspeitos descartados ou de baixa prioridade

- **useRealtime** — desabilitado (#157) desde v0.2.1.0. App.jsx:70 `// useRealtime()` comentado. Confirmado.
- **alarm_audit_log JS scheduler** — throttle batch single insert v0.2.2.1 fix #211 + audit só captura quando `alarm_audit_config.enabled = true` (whitelist por email). Cost ~1 insert/batch (não disparado por user normal não-admin). Improvável causa.
- **framer-motion v0.2.3.5 redesign** — adiciona animações por tela mas sem `<motion.div layout>` global em App.jsx. Custo por componente, não global. Pode amplificar mas não causa raiz.
- **Bundle size + lazy chunk parse** — code splitting já está bem feito (route-level). Primeira visita cara, mas warm-up barato. Não explica lag em rotas já visitadas.

---

## 6. Próximos passos antes de fixar

### 6.1 Confirmar via profiler (essencial antes mudar código)

1. **localhost teste-plus@teste.com Chrome DevTools Performance** — gravar 10s de:
   - 5× swipe mark dose em sequência
   - 3× navegação BottomNav (Dashboard → Pacientes → Tratamentos → Dashboard)
2. **Localizar long tasks > 50ms** — flamegraph deve mostrar:
   - `JSON.stringify` chamadas longas (persist serialize)
   - `setQueryData` cadeia
   - `findAll` + `.map` reconciliation
3. **Application > IndexedDB > dosy-query-cache** — medir tamanho real `dosy-query-cache` keys
4. **Logcat device físico (S25 Ultra)** — `adb logcat | grep -iE "Choreographer|jank|skipped frames"` durante interação

Esperado se hipótese correta:
- `JSON.stringify` aparece como long task ~80-200ms em cada interação
- `setQueryData` aparece N×2 vezes (doses + dashboard-payload)
- `Choreographer: Skipped X frames` no logcat coincide com interações

### 6.2 Fixes propostos (em ordem de impacto × baixo risco)

| # | Fix | Impacto esperado | Risco |
|---|---|---|---|
| **F1** | **Reverter App.jsx alarmWindow** `-30d/+60d` → `-1d/+14d` (original #092). Janela só precisa cobrir doses pra AlarmScheduler nativo (FCM cron horizon ~72h + buffer). | -85% cache size, -85% serialize cost, sinais reverberam em todo amplificador | Baixo — janela original já validada release v0.1.7.5. Verificar se algo depende da janela larga (provavelmente não — comentário "unificar com Dashboard" só economiza 1 query e não compensa) |
| **F2** | **Eliminar duplo namespace.** Opção (a) Dashboard volta a usar `useDoses + usePatients + useTreatments` diretamente (rebatable: `useDashboardPayload` consolidou pra reduzir 4 round-trips → 1). Opção (b) **Manter RPC consolidado MAS dropar cache `['doses']` redundante**: useDashboardPayload **NÃO** escreve em `['doses']` no useEffect, e mutations só patcham `['dashboard-payload']`. | -50% patch cost, -50% invalidate cost, -50% persist size por dose | Médio — exige auditar quem lê `['doses']` (DoseHistory? Reports? Settings?). Dashboard é o consumidor pesado |
| **F3** | **placeholderData inline previousData only.** Remove cross-key sweep. Hour boundary fica com 1 skeleton flash — aceitável vs custo render. Alternativa: cache último `withData[0]` em `useRef` no boot, atualizar quando query sucessful. | -O(N) por render Dashboard | Baixo |
| **F4** | **refetchDoses não invalida `['dashboard-payload']` após patch.** Patch local já cobre UI. Server-side trigger (`dose_change_trigger`) garante consistência via realtime quando habilitado, ou next focus invalidate cobre. | -50% server roundtrips por mark | Baixo se patch confiável (já é — está em prod desde #239) |
| **F5** | **Bumpar throttleTime persister** 1000ms → 5000ms. Compensar com setQueryData mais frugais. | Reduz frequência serialize | Baixo (já está throttled) |
| **F6** | **`React.memo` em BottomNav + AppHeader.** Hoje rerenderizam em todo render App.jsx. | -render cost por navegação | Baixo |
| **F7** | **Migrar `dosesSignature` para hash incremental** (não O(N) `.map().sort().join`). Ou pular signature: usar `dataUpdatedAt` direto da query. | -CPU em re-render App.jsx | Médio — testar AlarmScheduler não dispara extra |

**Recomendação imediata:** aplicar **F1 + F3 + F6** primeiro (baixo risco, alto retorno conjunto). Medir. Se ainda lento → F2 (impacto maior, mais escopo). F4 + F5 + F7 ficam pra release seguinte se preciso.

### 6.3 Próximo passo concreto

Ordem sugerida:

1. **Profilar localhost** — confirmar/refutar hipótese. ~30min.
2. **Coletar tamanho real do IDB cache** no device do user — pedir pra `chrome://inspect` device + `Application > IndexedDB > dosy-query-cache` size.
3. **Abrir `release/v0.2.3.7`** com F1 + F3 + F6 (low-risk bundle). Validar localhost + emulator.
4. **Se ainda lento pós F1+F3+F6** → F2 em release seguinte.

---

## 7. Resumo executivo (1 parágrafo)

A lentidão pós últimas releases é consequência de **3 mudanças que se reforçam**: (1) `v0.2.3.1` expandiu a janela de doses no App.jsx de 15 dias para 90 dias; (2) `v0.2.3.4 #163` criou um segundo namespace de cache (`['dashboard-payload']`) com os mesmos dados; (3) `v0.2.3.5 #239` fez toda mutation patchar e invalidar AMBOS namespaces. O cache cresceu ~6×, cada interação faz 2× trabalho de patch + 2× refetch RPC + serialize JSON enorme no IDB. Soma-se a isso o `placeholderData` cross-key em todo render Dashboard (#267). Para a próxima release: encolher janela App.jsx + cortar cross-key findAll + memoizar AppHeader/BottomNav resolve a maior parte sem refactor grande. Eliminar o duplo namespace é o fix definitivo, mas exige auditar todos os consumidores de `['doses']`.

---

## 8. Plano detalhado por fix — o que mudar, como mudar, e proteção contra regressão

> **Princípio do plano:** todo fix abaixo foi cruzado com o commit original que introduziu a regressão (`git show <hash>`), com a justificativa registrada no commit, e com a análise se o motivo original do código **ainda existe** ou **foi obsoletizado por outra mudança posterior**. Cada fix lista o bug que estava protegendo e o motivo de a alteração ser segura agora.

### Status por fix

| Código | Status | Próxima release | Notas |
|---|---|---|---|
| **F1** — Encolher alarmWindow | ⏳ ABERTO | v0.2.3.7 | Bug original foi obsoletizado por #163. Reverter é seguro. |
| **F3** — Otimizar placeholderData | ⏳ ABERTO | v0.2.3.7 | **NÃO reverter** — manter a proteção, só evitar varredura por render. |
| **F6** — React.memo BottomNav + AppHeader | ⏳ ABERTO | v0.2.3.7 | Otimização nova, sem regressão. |
| **F5** — Persister throttleTime 1s → 5s | ⏳ ABERTO | v0.2.3.7 | Ajuste de número, sem regressão (fila offline #204 protege). |
| **F4** — refetchDoses não invalida dashboard-payload | ⏸️ HOLD | v0.2.3.8+ | Aguardar resultado F1+F3+F6+F5. Risco moderado (siblings BATCH_UPDATE). |
| **F2** — Eliminar duplo namespace | ⏭️ HOLD | release dedicada | Maior impacto, mas exige auditar todos os consumidores de `['doses']`. |
| **F7** — Hash incremental dosesSignature | ⏸️ HOLD | release dedicada | Só aplicar se F1+F3+F6+F5 não bastarem. Tocar aqui mexe em proteção crítica (#212 anti-storm). |

---

### F1 — Encolher janela de doses do App.jsx para 15 dias

**Status:** ⏳ ABERTO — aplicar na próxima release.

**Arquivo:** `src/App.jsx` linhas 132-148.

**O que mudar:**

```js
// ANTES (v0.2.3.1 Bloco 7 A-04)
const alarmWindow = useMemo(() => {
  const now = new Date(hourTick * 3600_000)
  const past = new Date(now); past.setDate(past.getDate() - 30)
  const future = new Date(now); future.setDate(future.getDate() + 60)
  return { from: past.toISOString(), to: future.toISOString() }
}, [hourTick])

// DEPOIS (revertendo para #092 original)
const alarmWindow = useMemo(() => {
  const now = new Date(hourTick * 3600_000)
  const past = new Date(now); past.setDate(past.getDate() - 1)
  const future = new Date(now); future.setDate(future.getDate() + 14)
  return { from: past.toISOString(), to: future.toISOString() }
}, [hourTick])
```

Plus: atualizar o comentário em volta explicando o porquê (era unificação com Dashboard antes de #163; após #163, Dashboard mudou pra `useDashboardPayload` e a unificação ficou sem propósito).

**Bug original protegido (v0.2.3.1 Bloco 7 — commit `0cfef80`):**

> "A-04 janela useDoses unificada — App.jsx alarmWindow -1d/+14d → -30d/+60d (mesma janela Dashboard sem filter). filter.patientId=undefined em ambos → queryKey igual → cache TanStack compartilhado. Antes: 2 round-trips DB + 2x refetch a cada mutation."

**Por que é seguro reverter agora:**

A unificação foi pra **compartilhar cache com o Dashboard** que, na época (v0.2.3.1), usava `useDoses + usePatients + useTreatments`. Em **v0.2.3.4 commit `ad67369`** (3 semanas depois), o Dashboard foi migrado para `useDashboardPayload` (RPC consolidado) e **deixou de usar `useDoses`**. Hoje:

- Dashboard.jsx linha 90 usa só `useDashboardPayload(baseWindow)`. Confirmado via grep `useDoses|useDashboardPayload` em `src/pages/Dashboard.jsx`.
- App.jsx é o **único** consumidor da queryKey `['doses', {-30d/+60d, ...}]`. O cache "compartilhado" não compartilha com mais ninguém.

Manter 90 dias hoje serve apenas para que o `AlarmScheduler` Java agende alarmes nativos. A janela do agendador nativo cobre ~3 dias (FCM horizon 72h + buffer), bem dentro de 15 dias.

**Validação obrigatória pós-fix:**

1. **Localhost:** abrir Dashboard com teste-plus, marcar dose, observar que dose desaparece da lista e que alarmes futuros continuam sendo agendados (logs `[scheduler] rescheduleAll` no console).
2. **Emulator §11b:** instalar APK, criar tratamento +15 dias, verificar via `adb logcat | grep AlarmScheduler` que doses até +14 dias têm alarme agendado.
3. **Validar.md device físico:** confirmar S25 Ultra que alarmes da próxima semana disparam.

**Métrica de sucesso:**

`localStorage.getItem('dosy-rq-cache')` ou IDB `dosy-query-cache` reduz de ~3-5MB para ~600KB-1MB.

---

### F3 — Otimizar placeholderData do Dashboard (NÃO reverter, ajustar)

**Status:** ⏳ ABERTO — aplicar na próxima release.

**Arquivo:** `src/hooks/useDashboardPayload.js` linhas 41-60.

**O que mudar:**

```js
// ANTES (v0.2.3.6 #267)
placeholderData: (previousData) => {
  if (previousData) return previousData
  const all = qc.getQueryCache().findAll({ queryKey: ['dashboard-payload'] })
  const withData = all.filter((q) => q.state.data)
  if (withData.length === 0) return undefined
  withData.sort((a, b) => (b.state.dataUpdatedAt || 0) - (a.state.dataUpdatedAt || 0))
  return withData[0].state.data
}

// DEPOIS — cache do último resultado conhecido em module-scope ref
// (varredura UMA vez quando hora vira, não a cada render)
let _lastDashboardPayload = null
let _lastDashboardPayloadUpdatedAt = 0

// dentro do hook, em useEffect:
useEffect(() => {
  if (query.data) {
    _lastDashboardPayload = query.data
    _lastDashboardPayloadUpdatedAt = Date.now()
  }
}, [query.data])

// placeholderData fica:
placeholderData: (previousData) => {
  if (previousData) return previousData
  return _lastDashboardPayload || undefined
}
```

**Bug original protegido (v0.2.3.6 #267 — commit `20efdbf`):**

> "Dashboard skeleton em troca de hora — placeholderData cross-key. roundToHour em useDashboardPayload cria nova queryKey a cada hora. Quando hora muda (ex: 19→20): nova queryKey, previousData retorna undefined, isLoading: true → SkeletonList eterno. Validado Chrome MCP localhost teste-plus 2026-05-15 16:46: bug reproduzido (4 skeletons visíveis pós idle ~1h hora trocou 19→20). Pós fix: 0 skeletons, dashboard renderiza dados imediatamente."

**Por que a versão otimizada mantém a proteção:**

O bug original era: quando vira a hora (19→20), queryKey muda, `previousData` é undefined, e nada no cache "vinculado" tem dados. A solução do #267 vasculha **todo o cache de dashboard-payload** atrás de qualquer dado.

A versão otimizada mantém o efeito (transição sem skeleton) sem o custo por render:
- `_lastDashboardPayload` é atualizado **apenas quando uma query é bem-sucedida** (não a cada render).
- A varredura desaparece — o placeholder volta com leitura O(1) do ref module-scope.
- Mantém o cenário coberto pelo teste do #267: pós-idle 1h, hora vira de 19→20, ref ainda tem o último payload bem-sucedido das 19h, renderiza dados.

**Caso edge não coberto** (raríssimo, aceitável): primeira abertura do app **exatamente** no minuto da virada de hora **antes** de qualquer fetch completar. Nesse caso o skeleton aparece — mesmo comportamento de antes do #267. Probabilidade: <0.1% das aberturas.

**Validação obrigatória:**

1. **Localhost:** repetir o mesmo cenário do #267 — abrir Dashboard às 19:55, deixar idle 10min, verificar às 20:05 que dados aparecem sem skeleton.
2. **Localhost:** marcar/desmarcar doses em sequência rápida — confirmar que Dashboard mantém dados visíveis o tempo todo (não pisca skeleton).

---

### F6 — React.memo em BottomNav e AppHeader

**Status:** ⏳ ABERTO — aplicar na próxima release.

**Arquivos:**
- `src/components/dosy/BottomNav.jsx`
- `src/components/dosy/AppHeader.jsx`

**O que mudar:**

Antes de aplicar, **verificar quais props cada componente recebe**. Se não receber props (lê tudo de hooks internos), `React.memo` sem custom comparator funciona. Se receber props de objeto/função do App.jsx, é preciso garantir referências estáveis.

```js
// Padrão recomendado para BottomNav
import { memo } from 'react'

function BottomNav() {
  // ... corpo atual
}

export default memo(BottomNav)
```

E o mesmo padrão para `AppHeader`. Caso receba props funcionais do App.jsx, envolver no `useCallback` no caller.

**Bug original protegido:** Nenhum — esses componentes nunca foram memoizados.

**Risco a verificar antes de mergear:**

- BottomNav lê tier do usuário (free/plus/pro/admin) para mostrar badges? Se sim, hook interno (`useSubscription`) já invalida quando muda — memo seguro.
- AppHeader mostra badges de notificação que dependem de estado externo? Se sim, esse estado precisa entrar como prop ou hook interno — memo seguro com comparator default.

**Validação obrigatória:**

1. **Localhost:** abrir DevTools React Profiler → "Record" → navegar BottomNav 5 vezes → conferir flamegraph: BottomNav + AppHeader devem aparecer **cinzas** (não renderizaram) na maioria das navegações.
2. **Localhost:** trocar tier (admin panel → upgrade test-free → plus) → confirmar que badges atualizam.

---

### F5 — Persister throttleTime de 1000ms para 5000ms

**Status:** ⏳ ABERTO — aplicar na próxima release.

**Arquivo:** `src/main.jsx` linhas 141-155.

**O que mudar:**

```js
// ANTES
const persister = idbAvailable
  ? createAsyncStoragePersister({
      storage: { ... },
      key: 'dosy-query-cache',
      throttleTime: 1000  // ← 1s
    })

// DEPOIS
const persister = idbAvailable
  ? createAsyncStoragePersister({
      storage: { ... },
      key: 'dosy-query-cache',
      throttleTime: 5000  // ← 5s
    })
```

**Bug original protegido:**

Nenhum diretamente — o throttle de 1000ms é o default do TanStack quando migrado pra IDB (v0.2.3.4 #165 commit `9729fc5`). A escolha do default era conservadora.

**Por que é seguro aumentar:**

Mutations críticas (confirm/skip/undo dose) têm **outra camada de persistência** desde #204 (v0.2.1.7): a **fila offline de mutations** salva cada mutation individualmente, separada do cache de queries. Esse mecanismo não usa o throttle do persister — usa `shouldDehydrateMutation:()=>true` no `PersistQueryClientProvider`.

Cenário no pior caso (app crash 4 segundos após o usuário marcar uma dose):
- Cache de queries: pode estar 4s desatualizado quando o app reabrir → primeira sincronização busca do servidor.
- Fila de mutations: salva. Drena na próxima abertura. Marcação não se perde.

**Validação obrigatória:**

1. **Localhost:** marcar 5 doses em sequência rápida → matar o tab (force quit) → reabrir → conferir que as 5 doses aparecem marcadas (fila offline drenou).
2. **Logcat device:** confirmar que `[mutationRegistry] resumePausedMutations drained N` aparece no boot quando há mutations pendentes.

---

### F4 — refetchDoses não invalida dashboard-payload pós-patch [HOLD]

**Status:** ⏸️ HOLD — só aplicar se F1+F3+F6+F5 não bastarem.

**Arquivo:** `src/services/mutationRegistry.js` linhas 137-145.

**O que mudaria (não aplicar agora):**

```js
// ANTES (v0.2.3.5 #239)
function refetchDoses(qc) {
  if (_refetchDosesTimer) clearTimeout(_refetchDosesTimer)
  _refetchDosesTimer = setTimeout(() => {
    qc.invalidateQueries({ queryKey: ['doses'], refetchType: 'active' })
    qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'active' })
    _refetchDosesTimer = null
  }, 2000)
}

// DEPOIS (proposto — mantém invalidate dashboard-payload SEM refetch ativo)
function refetchDoses(qc) {
  if (_refetchDosesTimer) clearTimeout(_refetchDosesTimer)
  _refetchDosesTimer = setTimeout(() => {
    qc.invalidateQueries({ queryKey: ['doses'], refetchType: 'active' })
    // dashboard-payload: marca stale mas NÃO refetch active.
    // Próximo focus/mount busca dado fresco.
    qc.invalidateQueries({ queryKey: ['dashboard-payload'], refetchType: 'none' })
    _refetchDosesTimer = null
  }, 2000)
}
```

**Bug original protegido (v0.2.3.5 #239 — commit `11248cd`):**

> "User reportou: marcar dose Avamys 20h como Pulada → banner amber confirma → dose continua visualmente atrasada → permite clicar Pular várias vezes. Root cause: v0.2.3.4 #163 RPC consolidado introduziu cache ['dashboard-payload', filter] que Dashboard usa. patchDoseInCache só patchava ['doses', ...] → Dashboard lia payload.doses do cache dashboard-payload separado → UI não atualizava."

**Por que é HOLD (risco moderado):**

O fix do #239 tem duas partes:
- **(a)** Patchar `['dashboard-payload']` no `onMutate` → essencial para UI imediata. **Mantém.**
- **(b)** Invalidar `['dashboard-payload']` no `onSettled` 2s depois → garante consistência com servidor.

A parte (b) é "cinto e suspensório". Em casos normais, (a) já cobre. Mas existe um cenário onde (b) é necessário: o servidor pode atualizar **doses irmãs** via `dose-trigger-handler` v21 BATCH_UPDATE (uma dose marcada done dispara atualização em irmãs do mesmo grupo). Sem (b), o Dashboard pode mostrar irmãs parcialmente desatualizadas até o usuário sair e voltar para a tela.

**Quando reconsiderar aplicar:**

Se F1+F3+F6+F5 reduzirem o lag em >70% mas marcar/desmarcar rápido continuar pesando, o custo do refetch é o resíduo. Aplicar então — mas avaliar antes:
- Investigar quantas doses **realmente** mudam via BATCH_UPDATE em uma marcação típica (audit log).
- Se o servidor não mudar irmãs em ≥95% dos casos, vale o trade-off.

---

### F2 — Eliminar duplo namespace dashboard-payload [HOLD parqueado]

**Status:** ⏭️ HOLD — release dedicada futura.

**Por que parqueado:**

Eliminar o duplo namespace é a correção mais profunda, mas exige decisão arquitetural + auditoria completa. Caminhos possíveis:

**Caminho (a) — Reverter #163 (Dashboard volta a usar useDoses+usePatients+useTreatments):**
- Pró: elimina duplicação total.
- Contra: volta o problema que #163 resolveu — 4 round-trips Dashboard a cada open (-40% a -60% egress perdido). Não vale para 1 usuário, mas inviável para Closed Testing escalado.

**Caminho (b) — Manter RPC consolidado, parar de popular `['doses']` no useEffect side-effect:**
- Pró: mantém ganho do #163.
- Contra: outras telas (`PatientDetail`, `DoseHistory`, `Reports`) leem de `['doses', filter]` com filtros diferentes. Se Dashboard parar de popular, essas telas refetcham na primeira abertura (regression de cache compartilhado). Esforço: auditar cada consumidor + decidir se aceitável.

**Caminho (c) — Manter RPC consolidado, **Dashboard lê de `['doses']` em vez de `['dashboard-payload']`:**
- Pró: 1 namespace.
- Contra: precisa adaptar Dashboard pra consumir `useDoses` + outras queries pequenas (`extend_continuous` separado). Reverte parcialmente #163.

**Decisão necessária do user:** qual caminho seguir?

**Quando reabrir esse fix:**

Após F1+F3+F6+F5 e medição em produção. Se ainda houver lag pós Closed Testing escalado, esse vira release P1 dedicado (~6-10h de trabalho + validação extensa).

---

### F7 — Hash incremental dosesSignature [HOLD]

**Status:** ⏸️ HOLD — só aplicar se F1+F3+F6+F5 não bastarem.

**Arquivo:** `src/App.jsx` linhas 185-201.

**Bug original protegido (v0.2.2.2 #212 — commit `82e91b5` aproximado):**

> "STORM ROOT CAUSE — app reagendando 1.36 vezes/minuto. Audit polling 11min confirmou cadência 60s estável. Egress estimado ~30-40 MB/dia/device. Fix: signature guard via useMemo. dosesSignature calculado por id:status:scheduledAt ordenado, useEffect dep usa signature em vez de array ref."

**Por que é HOLD (proteção crítica):**

A `dosesSignature` é uma **defesa contra storm de reagendamento de alarmes**. Falhar nessa detecção significa:
- Alarmes podem **não** reagendar quando deveriam (dose mudou mas hash não detectou) → **paciente não toma remédio na hora** (bug crítico para app de saúde).
- Ou alarmes reagendam toda hora desnecessariamente → volta a storm de 30-40 MB/dia/device.

**Alternativa segura sugerida (se vier a aplicar):**

Usar `dataUpdatedAt` da query TanStack como sinal primário (já incrementa em cada atualização real):

```js
// Em vez de dosesSignature O(N):
const { data: allDoses = [], isSuccess: dosesLoaded, dataUpdatedAt } = useDoses(alarmWindow)

// useEffect deps usa dataUpdatedAt em vez de signature
useEffect(() => {
  if (!user || !dosesLoaded || !patientsLoaded) return
  scheduleDoses(allDoses, { patients: allPatients })
}, [user, dataUpdatedAt, patientsUpdatedAt, dosesLoaded, patientsLoaded, scheduleDoses])
```

**Risco:** `dataUpdatedAt` pode mudar em refetches que **não trazem mudanças reais** (mesma resposta do servidor). Resultado: reagendamentos desnecessários, mas **nunca falha em detectar mudança real**. Para healthcare é o trade-off correto — prefere reagendar a mais a deixar de reagendar.

**Quando reabrir:**

Profiler localhost mostra que `dosesSignature` aparece no flamegraph como long task (>30ms) **depois** de F1+F3+F6+F5 aplicados. Improvável — F1 já reduz `allDoses.length` em ~85%, a signature passa a ser ~O(N/6).

---

## 9. Plano de execução por release

### Release v0.2.3.7 (próxima) — perf bundle low-risk

**Escopo:** F1 + F3 + F6 + F5. Esforço estimado: 2-3h código + 1h validação localhost + 1h validação device.

**Itens ROADMAP correspondentes:** #272 (F1), #273 (F3), #274 (F6), #275 (F5).

**Validação pré-AAB:**
1. `npm run build` verde.
2. Localhost teste-plus@: 20 marcações de dose em sequência. Conferir DevTools Performance:
   - Sem long tasks > 50ms.
   - JSON.stringify some do flamegraph (ou cai abaixo de 30ms).
3. Localhost: 10 navegações entre Dashboard ↔ Pacientes ↔ Tratamentos ↔ Mais. Cada uma <100ms.
4. Emulator §11b: instalar APK, marcar 10 doses sequencial — conferir `Choreographer skipped frames` no logcat fica <5/interação.
5. Tamanho do IDB cache `dosy-query-cache` <1MB pós abrir Dashboard.

**Validar.md device físico:**
- Marcação sequencial 10 doses S25 Ultra — sem lag perceptível.
- Navegação BottomNav 20× — sem engasgo.
- Confirmação visual: alarmes futuros (próximos 7 dias) continuam soando.

### Release v0.2.3.8+ (condicional)

**Aplicar se v0.2.3.7 não resolver totalmente:**
- F4 — Reduz refetch dashboard-payload pós-patch. Risco moderado, valida com cuidado.
- F7 — Substitui signature O(N) por dataUpdatedAt. Risco moderado, monitorar alarm_audit_log pós-deploy.

### Release dedicada futura (decisão do user)

- F2 — Eliminar duplo namespace. Decidir entre caminhos (a), (b), (c). Esforço 6-10h + validação extensa.

---

## 10. Checklist de proteção contra regressão

Antes de aplicar qualquer fix desta auditoria, **obrigatoriamente**:

- [ ] Ler o commit original que introduziu o código a ser alterado (`git show <hash>`).
- [ ] Confirmar que o bug original está documentado no histórico (ROADMAP, CHECKLIST, commit message).
- [ ] Identificar o cenário do bug original e reproduzir em ambiente de teste **antes** de aplicar o fix (linha base).
- [ ] Aplicar o fix.
- [ ] Reproduzir o mesmo cenário do bug original — confirmar que **não voltou**.
- [ ] Adicionar entry no [`Validar.md`](../Validar.md) listando o cenário do bug original como caso de teste device-only.
- [ ] Manter o commit do fix com referência explícita ao número do bug original no corpo do commit (ex: `Protege regressão de #239 — testado cenário Avamys 20h Skip OK`).

---

## 11. Referências cruzadas

- Branch da auditoria: `docs/perf-audit-device-slow`
- ROADMAP §6.6 BUGS: #272 (F1), #273 (F3), #274 (F6), #275 (F5), #276 (F4 HOLD), #277 (F2 HOLD), #278 (F7 HOLD)
- ROADMAP §6.3 Release log: entry v0.2.3.7
- Commits-chave investigados:
  - `0cfef80` — v0.2.3.1 Bloco 7 A-04 (origem F1)
  - `ad67369` — v0.2.3.4 #163 RPC consolidado (origem do duplo namespace, F2)
  - `9729fc5` — v0.2.3.4 #165 IDB persister + staleTime 30min (origem F5)
  - `11248cd` — v0.2.3.5 #239 patch dashboard-payload (origem F4)
  - `20efdbf` — v0.2.3.6 #267 placeholderData cross-key (origem F3)
  - `82e91b5` (aprox) — v0.2.2.2 #212 dosesSignature (origem F7)
