# 🐛 BUGS — Lista de bugs

> **Esta é a fonte de verdade para bugs.** Toda IA recebendo o projeto DEVE varrer este arquivo no início da sessão (Passo 0 README) — alertar o user sobre bugs abertos antes de iniciar trabalho novo.
>
> **Numeração própria começando em #0001**, independente do ROADMAP (que cobre features, perf, refactor e roadmap de lançamento).
>
> **Como funciona:**
> - IA adiciona bug novo aqui assim que descoberto/reportado pelo user.
> - Severidade: `🔴 P0` bloqueador, `🟠 P1` alta, `🟡 P2` média, `🟢 P3` baixa, `🔵 P4` cosmético.
> - Cada bug tem: número, prioridade, descrição, causa-raiz se conhecida, plano de fix se proposto, status (`OPEN` / `IN_PROGRESS` / `FIXED v0.X.Y.Z`).
> - Quando fixado: marcar `FIXED v0.X.Y.Z` + commit hash + mover para Histórico no fim do arquivo.

---

## 🔴 P0 — Bloqueadores

Nenhum bug P0 aberto.

---

## 🟠 P1 — Alta prioridade

- **#0031** ✅ FIXED v0.2.8.4 (raiz atacada) — **Boot exibe banner "Carregando fila de envio de modificações" mesmo com internet OK; bug crônico desde v0.2.6.6.**

  **Fix v0.2.8.4 (camada arquitetural, padrão WhatsApp/Gmail):**
  - **Zustand persist (M1)** — patient/treatment/doseStore agora usam `zustand/middleware persist` + Capacitor Preferences. Boot hydrate cache → UI imediato (387ms validado S25U, era 15-30s skeleton).
  - **fetchDashboard coalesce 2s (M2)** — cascade resume 5 calls → 1 RPC.
  - **Drain batch chunks 3 (M3)** — backlog grande não estoura connection pool.
  - **Realtime debounce 3s unified (M4)** — burst cross-account → 1 fetchDashboard.
  - **refetchOnWindowFocus false global (M5)** — apenas useDoses/useAccessiblePatientIds override.
  - **Mutex zombie killer 60s (M7)** — drain stuck zombie auto-clear.
  - **Bug runtime durante QA:** `await import('@capacitor/preferences')` HUNG no persist adapter (CDP timeout 3s revelou). Fix: `Capacitor.Plugins.Preferences` direto.

  QA empírico S25U: Cenário A (force-kill + reabrir) **387ms** UI hidratada · Cenário B (marcar dose runtime) **1583ms** queue→drained→_confirmedAt.

  [Histórico v0.2.8.3 abaixo:]

- **#0031-original** P1 (mesma classe #0029, mais profundo) — **Boot exibe banner "Carregando fila de envio de modificações" mesmo com internet OK; bug crônico desde v0.2.6.6.** User reportou (2026-05-25 21:25 BRT): "às vezes ao iniciar app com boot, fica carregando fila de envio mesmo estando com internet". Investigação profunda revelou múltiplos problemas combinados:
  - **Drain serial FIFO**: backlog de N doses × 30s timeout = 30·N segundos UI stuck banner. Cold-start latência 15-25s × backlog de 5 doses = 75-125s banner.
  - **Terser strippava `console.warn`** desde v0.2.7.0 (lista `pure_funcs` em vite.config) — diagnóstico impossível em prod, fica adivinhando root cause.
  - **TanStack `onlineManager` reconnect não disparava drain** em Capacitor Android — apenas `window 'online'` event listener; em Capacitor, esse event dispara prematuro vs Capacitor.Network.
  - **Boot drain rodava 1 vez fire-and-forget** — se primeira tentativa falhasse silenciosamente (processLock zombie, fetch hang antes do timeout), não havia 2ª chance até watchdog 30s rodar.
  - Status: `FIXED v0.2.8.3 (boot drain test empirically validated 2026-05-25 21:35 BRT)`:
    - **`_runDrain` reescrito em paralelo por doseId** — `Promise.allSettled` de grupos por doseId (mesma dose serial, doses diferentes paralelas). Idempotência via mutation_log PK garante safety.
    - **`vite.config.js` Terser pure_funcs**: removido `console.warn` da lista → preservado em prod pra logcat capture. Logs `[drain] start/done/group/...` agora visíveis.
    - **`markDose.js`** subscriber dual `window 'online'` + `onlineManager.subscribe` — TanStack onlineManager é fonte mais confiável em Capacitor Android.
    - **`main.jsx` boot drain DUAS rodadas**: 1ª @ +0s timeout 30s, 2ª @ +15s timeout 15s. Idempotência cobre re-tentativa. Combinado com watchdog 10s + scheduleRetryDrain 5s backoff em markDose.js.
    - **QA empírico boot drain** (2026-05-25 21:35 BRT): script `qa-test-boot-drain.mjs` populou queue com 2 entries → force-stop + restart → drain detectou queue size: 2 → grouped 2 unique doseIds → drained em 2.1s (parallel) → BD `status='skipped'` confirmado SQL. Total UI banner disappear: ~6s.
    - **QA empírico RUNTIME drain (validação REAL do bug user)** (2026-05-25 21:48 BRT): user clarificou que bug real é "mods ficam stuck mesmo com app aberto + internet OK, só drenam após restart". Script `qa-runtime-drain.mjs` populou queue com 2 entries SEM restart → drain auto-disparou em **t+452ms** (340ms após populate) → drained em **1.1s** → watchdog 10s pegou residual de 1 entry race → queue final = 0 em **30s total**. BD final: ambas doses status='skipped'. App permaneceu aberto durante todo teste. **Bug user "fila stuck com app aberto e internet OK" CONFIRMADAMENTE RESOLVIDO** — drain runtime funciona via watchdog 10s + onlineManager.subscribe + scheduleRetryDrain combinados.

- **#0030** P1 — **Realtime cross-account `postgres_changes` UPDATE não entrega para sharegiver.** Status atualizado v0.2.8.4: hardening complementar (gate `hasCollabContext` restaurado em useRealtime — regressão round 4 v0.2.8.3 — user solo sem shares: zero subscribe; debounce 1500→3000ms trailing-only unified pra reduzir storm cascade). QA real cross-account in-app delivery em Samsung S25U a ser revalidado em release subsequente. **Histórico v0.2.8.3:** Descoberto QA real v0.2.8.3 (2026-05-25 17:46 BRT): teste-plus marcou dose `aea9db03-5b34-4193-8ca7-f1b3984df01e` como Pular (BD `status='skipped'` confirmado SQL). teste-free S25U Dashboard continua mostrando "atrasada 2h" mesmo 8s+ pós-update. App foreground, network OK. **Hipótese:** Supabase Realtime publication só está com INSERT events, não UPDATE — OU `REPLICA IDENTITY DEFAULT` apenas envia primary key na payload e o filter `patientId.in.(uuid)` não pode aplicar sem patientId no payload. **Plano fix:** rodar `ALTER TABLE medcontrol.doses REPLICA IDENTITY FULL` em migration → garante UPDATE entrega payload completo incluindo patientId pra filter funcionar. Bug crítico pra UX cuidador — sharegiver não vê mudanças real-time. Status: `PARTIAL FIX v0.2.8.3`:
  - **Migration aplicada** `v0_2_8_3_replica_identity_full_realtime` — ALTER TABLE doses/treatments/patients/patient_shares REPLICA IDENTITY FULL. Verificado via pg_class: `relreplident='f'` confirmado.
  - **Pub config OK** — publication supabase_realtime tem `pubupdate=true` pra todas 4 tabelas.
  - **QA round 3 resultado**: BD sync correto (dose UPDATE status='skipped' chega ao S25U **pós force-restart**, com label "pulada" correto). Mas Realtime delivery in-app real-time (sem restart) **ainda intermitente** — S25U Samsung agressive kill desconecta channel; reconnect strategy/refetchDoses on UPDATE handler precisa ser revisitado. Residual investigation pendente.

- **#0029** P1 (mesma classe #B102/#0023) — **`pendingMutationsQueue` drain não dispara após mark dose Pular/Tomada.** Descoberto QA real v0.2.8.3 (2026-05-25 ~17:42 BRT no emul-5554, teste-plus): após tap em DoseModal > Pular na dose `aea9db03-5b34-4193-8ca7-f1b3984df01e`, UI atualizou otimisticamente ("pulada" + banner amarelo "1 dose ainda não foi salva — Marcação só vai pra nuvem quando reconectar"). BD permaneceu `status='pending'` por 2+ minutos. CDP inspect `Capacitor.Preferences.get('dosy_pending_mutations')` retornou queue com 1 entry `{action:'skip', retryCount:0}` — **`retryCount=0` prova que drain function nunca tentou RPC**. Mesmo após `window.dispatchEvent(new Event('online'))` queue não drenou. Mesma classe v0.2.6.6 #0023 + v0.2.7.0 #B102 + v0.2.8.0 supposedly fixed. **Hipótese:** v0.2.8.0 Java MutationDrainWorker roda a cada 15min mas não foi invocado on-demand pós add() do queue. JS drain (`drainPendingMutations()` em markDose.js) só chama em boot + heartbeat + onlineManager flip — nenhum desses gatilhos disparou. Marcação fica stuck em IDB local; força reload/restart pra eventual drain. **Impacto severo:** healthcare flow core — cuidadores não veem dose marcada cross-account até user reabrir app. **Plano fix:** após `pendingMutationsQueue.add()` em markDose, schedule `drainPendingMutations()` immediate via setTimeout(0). Adicional: encurtar interval WorkManager 15min → 5min pra mitigar caso JS falhar. Status: `FIXED v0.2.8.3 (QA round 3 confirmado)`:
  - **markDose.js** — `scheduleRetryDrain()` chamado em catch AuthLost + Network (force schedule timer 5s backoff)
  - **markDose.js** — `setTimeout(drainPendingMutations, 5000)` adicionado pós `queueAdd()` como belt-and-suspenders (drain backup roda mesmo se RPC inline foi silenciosamente engolido)
  - **markDose.js** — watchdog 30s → 10s (snappier recovery em healthcare critical)
  - **QA round 3 (2026-05-25 21:12 BRT)**: tap Pular na dose `256da164-...` → BD `status='skipped'` em <10s ✅ (sem precisar restart). Confirmado funcionando.


- **#0025** P1 — **Mutation `create_patient` (e outras forms) fica stuck disabled após timeout RPC.** Descoberto em QA real cross-account v0.2.8.3 (2026-05-25 18:40): preencher form Novo Paciente, tap "Cadastrar paciente" → RPC `from('patients').insert(...)` demora >10s (mesmo bug classe "perde comunicação BD após idle" #0023 v0.2.6.6) → `create.isPending` setado `true` no useMutation, **nunca volta `false`** porque RPC nunca resolve/rejeita. Botão fica permanentemente disabled. User precisa reload page pra resetar state. Bloqueia QA inteiro (sem criar paciente, nada flui). **Plano fix inicial:** em `usePatientCreate.js`/`usePatients.js` mutation hook adicionar `mutationFn` envolto em Promise.race com timeout 15s → se timeout, throw `TimeoutError` → TanStack chama `onError` → `isPending` volta `false` automaticamente. Pattern já existe em `services/sessionManager.js authedRpc` (Refactor Sync v2). Aplicar consistência. Adicional: snackbar UI ao timeout pra user saber que pode tentar de novo. Status: `PARTIAL FIX v0.2.8.3 + RESIDUAL BUG`:
  - **Aplicado (não resolve bug-classe):** criado `src/utils/withTimeout.js` (MutationTimeoutError + withTimeout helper Promise.race, default 20s) + aplicado em `patientsService.js` (createPatient/updatePatient/deletePatient), `treatmentsService.js` (createTreatmentWithDoses/updateTreatment/deleteTreatment/pauseTreatment/resumeTreatment/endTreatment/cancelFutureDoses/createTemplate), `dosesService.js` (registerSos/upsertSosRule/deleteSosRule — confirmDose/skipDose/undoDose já passam por authedRpc), `sharesService.js` (extendTemporaryShare/updateShareAccess — sharePatientByEmail/unsharePatient já tinham inline Promise.race 15s).
  - **Diagnóstico QA 2026-05-25 19:45 BRT (emul-5554):** Click Cadastrar → btn disabled 30s → **ZERO requests pra supabase via Network domain CDP** → mutationFn jamais executou. Test repetido pós force-stop+restart do app **criou paciente em 1069ms**. Confirma: bug não é timeout na RPC, é **TanStack mutation queue preso em estado stale (paused indefinido)** quando há resíduo de mutation anterior OU race onlineManager init. withTimeout helper inutil porque mutationFn never runs.
  - **Root cause REAL identificado**: `networkMode: 'offlineFirst'` default em main.jsx faz TanStack PAUSAR mutation quando onlineManager.isOnline() retorna false (race durante boot/resume). mutationFn nunca executa → btn stuck disabled, zero requests.
  - **Fix v0.2.8.3 (QA round 3 confirmado)**: `networkMode: 'always'` aplicado em `mutationRegistry.setMutationDefaults` pra createPatient/updatePatient/deletePatient/createTreatment/updateTreatment/deleteTreatment/pauseTreatment/resumeTreatment/endTreatment. Doses mutations (confirmDose/skipDose/undoDose) **mantidas em offlineFirst** porque elas usam pendingMutationsQueue pattern (drain-aware).
  - **QA round 3 (2026-05-25 21:05 BRT)**: criar paciente em 2s ✅ (era stuck 30s+). Confirmed FIXED.

## 🟡 P2 — Média prioridade

- **#0026** P2 — **Dashboard `get_dashboard_payload` timeout 10s em emulator** (recorrência v0.2.6.6 #0023). QA cross-account v0.2.8.3 (2026-05-25): primeira tela após login mostra "Não consegui carregar suas doses · Operação get_dashboard_payload timeout após 10000ms" + skeletons com animação infinita. Reload resolve. **Root cause provável:** RPC cold-start lento em emul ou Network bridge Capacitor lag inicial. **Plano fix:** (a) aumentar `rpcTimeoutMs` cold-start 10s → 30s (como markDose já faz); (b) retry automatic 1× pós-timeout antes de mostrar erro; (c) loading state com `setTimeout(showRetryButton, 8s)` mais cedo pra user reagir antes do "Tentar de novo" reativo. Não-bloqueador em prod (rede real responde <2s), mas degrada UX inicial em emul. Status: `IN_PROGRESS v0.2.8.3` — em `fetchDashboard.js` adicionados constants `DASHBOARD_RPC_TIMEOUT_FIRST_MS = 30_000` (1ª tentativa cold-start) + `DASHBOARD_RPC_TIMEOUT_RETRY_MS = 15_000` (retry imediato se TimeoutError). Total worst-case 45s mas Dashboard popular em vez de skeleton stuck. Pendente: QA validar em emul cold-start.

- **#0027** P2 (device-specific Samsung One UI 7+) — **"Try out your stylus" popup intercepta primeiro tap em input no S25 Ultra.** Descoberto em QA cross-account v0.2.8.3 (2026-05-25): tap no campo Nome do form Novo Paciente abre tutorial S Pen overlay nativo do Samsung One UI (não é popup do app). Texto digitado vai pro popup, não pro form. Bloqueia primeiro uso de input em S25U fresh install. Em devices Pixel/AOSP não acontece. **Plano fix opções:**
  1. Capacitor config Android `<meta-data android:name="com.samsung.android.spen.disabled" android:value="true"/>` no AndroidManifest (se Samsung suporta opt-out)
  2. JS: `e.preventDefault()` em first focus event do input se `userAgent` Samsung
  3. Aceitar limitação + UX onboarding "feche o popup do S Pen antes de usar" — pior opção
  Status: `DEFERRED v0.2.8.3` — opção 1 não tem meta-data oficial pública no Samsung SDK (verificado AndroidManifest — não há flag exposed pra suprimir tutorial S Pen). Popup é **one-time tutorial** Samsung System UI; após user dismissar uma vez, não reaparece. Não-bloqueador em uso real. Considerar opção 2 (JS preventDefault) em release futura se reportado por outros users. Por agora aceitar limitação device-specific.

## 🟢 P3 — Baixa prioridade

Nenhum bug P3 aberto.

---

## 🔵 P4 — Cosmético / UX

- **#0028** P4 — **AdMob banner mantém WebView a 120Hz contínuo → log spam `setRequestedFrameRate frameRate=-4.0`** em todas rotas (~120 logs/seg). Descoberto QA v0.2.8.3 (2026-05-25). Não afeta funcionamento, só verbose em debug logcat. Em prod release, Android system não exibe esses logs (debugger only). Mas em emul debug mode polui logcat impossibilitando filtros por outros warnings/errors. **Plano fix:** `AdMob.hideBanner()` em rotas não-monetary (`/paciente/novo`, `/tratamento/novo`, `/sos/novo`, formulários em geral). `useAdMobBanner()` hook adiciona path check via `useLocation()`. Implementar lista whitelist de rotas onde banner aparece (Dashboard, Patients, History) — todas outras hide. Status: `DEFERRED v0.2.8.3` — verificado: log é Android system `Choreographer.setRequestedFrameRate` emitido pelo WebView interno quando AdMob refresh anim 120Hz dispara. **Não é AdMob lib direto** — é WebGL/Canvas refresh trigger interno. Hide banner não suprime pois Android continua avaliando frame rate de todo app. Em prod release Terser strip não afeta logs nativos Android. Single-source-of-spam impossível resolver no JS sem refactor AdMob plugin. Aceitar como verbose-only log debug.

- **#0024** P4 — `MedNameInput.jsx:142-144` filtra catálogo Supabase se nome bate com sugestão local (`localSuggestions` da heurística `suggestMedications`). Como local entries têm `source: 'free'` ou `source: 'user'`, **badges CMED/DCB ANVISA não renderizam** mesmo quando o item existe no `medications_catalog`. Descoberto em QA Appium v0.2.8.1 (2026-05-25): digitar "amox" mostra "Amoxicilina" + "Amoxicilina + Clavulanato" sem badges, apesar do RPC `search_medications` retornar 5 rows válidas no BD. **Não é regressão** do grant fix v0.2.8.1; é decisão de design preexistente (dedup local-first). **Plano fix**: priorizar entries do catálogo Supabase OR fazer merge dos metadados (`is_dcb`, `group_id`, `cmed_class`) quando nome bate. Status: `OPEN` (fix aplicado em v0.2.8.2 mas QA cross-account ainda não confirmou — pendente revalidação).

---

## 📦 Histórico — Bugs SHIPPED (referência cronológica)

> Ordem cronológica reversa. Releases anteriores: ver `context/updates/` + ROADMAP §6.3 Δ release log.

### v0.2.8.1 (2026-05-25, vc 103)

- **Correções de Testes e warnings de Linter (Fase 1)**:
  - **Fila Offline (`src/services/markDose.js`)**: Corrigido o processador de drain offline (`_runDrain`) para reverter o estado local visual e emitir erro via `emitMutationError` quando ocorrerem falhas lógicas do Supabase (como `401`, `403` ou `404`) que não sejam de concorrência (`409`).
  - **Divergência de Testes (`dateUtils.test.js` / `statusUtils.test.js`)**: Corrigido teste de `rangeNow('24h')` para esperar `0h` em vez de `6h` de início. Atualizado o teste de quantidade de status para 5 elementos incluindo `cancelled`.
  - **Vitest Config (`vitest.config.js`)**: Excluído o diretório `e2e/**` da execução padrão do Vitest, evitando erros de carregamento de sintaxe Mocha do Appium.
  - **Warnings do ESLint (`TreatmentForm.jsx` / `notifications/index.js`)**: Removido o `useEffect` reativo de auto-switch de `durationUnit` no formulário e substituído por atualizações síncronas nos cliques, eliminando o warning `react-hooks/set-state-in-effect`. Removida a chamada duplicada de `setPermState` no `useEffect` de montagem de notificações.

- **GRANT SELECT em `medications_catalog`** (migration `20260525124500_v0_2_8_2_grant_medications_catalog_select.sql`, commit `672dc2b`) — fix HTTP 403 silencioso no autocomplete do nome do medicamento. RPC inline `search_medications` retornava 0 rows sem erro visível (browser PostgREST 403 swallowed por TanStack como `data: []`). Concedido `SELECT` na tabela `medcontrol.medications_catalog` para roles `anon`, `authenticated`, `service_role`. Aplicado em Supabase prod via MCP. 4 grantees confirmados (incluindo postgres). Validado em emulador Appium: digitar "amox" agora retorna 5 entries do catálogo.

### v0.2.8.0 (2026-05-25, vc 102)

- **B102** P0 crônico **FECHADO CATEGORICAMENTE** — "Dose marcada não persiste depois de fechar e abrir o app" (8 tentativas hotfix v0.2.6.7→v0.2.6.15 falharam parcialmente). Root cause em camadas: (1) `mutateAsync` sem `await` em DoseModal — fixed v0.2.6.12; (2) `processLock` órfão supabase-js pós-Doze — fixed sessionManager v0.2.7.0; (3) JS timers suspended em Doze — UNFIXABLE em JS, requer Worker nativo. **Fix arquitetural v0.2.8.0:** `MutationDrainWorker.java` (`com.dosyapp.dosy.sync`) WorkManager 15min CONNECTED drena `pending_mutations` SharedPreferences "CapacitorStorage" key `dosy_pending_mutations` (mesma fonte que `@capacitor/preferences` usa do JS). Worker faz refresh nativo Java (Opção B do user) via POST `/auth/v1/token?grant_type=refresh_token` se access_token expirado, persiste novos tokens atomicamente em `dosy_sync_credentials`. Retry 3× erro real antes de descartar (decisão #3). Idempotência server-side via `mutation_log` PK request_id garante drain JS + Worker concorrentes = 1 RPC. Migration one-way IDB → Preferences no boot (`src/main.jsx`). Plano detalhado: `Plano_Worker_Native_v028.md`. ProGuard `-keep class com.dosyapp.dosy.sync.**` pra WorkManager reflection. Schedule em `MainActivity.enqueueMutationDrainWorker` policy KEEP.

### v0.2.7.0 (2026-05-25, vc 101)

- **B102** P0 — Refactor sync v2 (4 fases): sessionManager + authedRpc Fase 1; Zustand stores Fase 2; markDose + pendingMutationsQueue + RPCs v3 idempotentes (mutation_log table) Fase 3; Realtime simplificado Fase 4. Resolve 90% B102 (kill mid-RPC + reabrir = drain idempotente boot). Hardening pós-QA real: AppHeader overdueCount Zustand reativo; retry backoff exponencial 5s→60s self-perpetuating; AuthLost também agenda retry; watchdog 30s setInterval. 4 commits: `7d47726` `69e1879` `c1ce900` `2f9a069` `a80a349`. **Remaining 10%:** marca dose durante suspended Doze deep → JS timers não disparam → resolvido por v0.2.8.0 (Worker nativo).

### v0.2.6.6 (2026-05-23, vc 91)

- **#0023** P0 crônico — App fica horas aberto/idle (Android Doze) → JWT Supabase expira (default 1h) → WebView pausada mid-refresh → `processLock` supabase-js órfão → next mutation usa JWT stale → RPC v2 SECURITY DEFINER detecta `auth.uid()=NULL` e retorna JSONB `{ok:false, code:401}` HTTP 200 (NÃO throw) → `parseDoseV2Response` lança Error → `mutationRegistry.onError` faz rollback silent + Sentry log (sample 1%) → user vê optimistic reverter sem toast → "perdeu BD silencioso". Diagnóstico: 4 agentes paralelos confirmaram cadeia. Postgres_log prod últimas 24h: `permission denied for table doses/patients` recorrente. **Fix em 8 camadas:** F1 onlineManager re-sync pós-resume (Capacitor Network) + F2 `qc.resumePausedMutations()` pós-soft-recover + F3 watchdog ping timeout 5s (token zombie → signOut+reload) + F4 `rpcV2WithAuthRetry` wrapper (detect 401 → refreshSession + retry 1×) + F5 mutationErrorBus + MutationErrorListener (toast UI em 8 onError handlers) + F7 DROP 8 RPC overloads stale (zero ambiguidade PostgREST) + F8 Sentry visibilidade total 401/403/409 (skip rate-limit + dedup).

### v0.2.6.5 (2026-05-23, vc 90)

- **#0020** P1 — Dashboard "X atrasadas" continua mostrando dose como overdue após user marcar como Tomada via MultiDoseModal (alarme → Ciente). Root cause: `confirmDose/skipDose/undoDose/registerSos` `onMutate` cancela apenas `cancelQueries({queryKey:['doses']})` MAS NÃO cancela `['dashboard-payload', *]` que é o que Dashboard usa. Query in-flight `dashboard-payload` continua, retorna server data pre-mutation, TanStack `setQueryData` SOBRESCREVE cache patched (perdendo `_localActedAt` stamp) → reconcile não protege → Dashboard mostra dose stale. HeaderAlertIcon funcionou corretamente porque usa `useDoses` (queryKey `['doses', *]`, cancelada). Fix: cancelar AMBAS queries em todas 4 mutations + `refetchDoses()` em `onSettled` invalida ambos namespaces.
- **#0021** P1 — Keyboard virtual Android cobre input/textarea/select ao focar. Recorrente em todos forms. Fix: hook global `useKeyboardAwareScroll` em App.jsx — `focusin` delegation no document + Capacitor `Keyboard.keyboardWillShow` listener → `scrollIntoView({block:'start', behavior:'smooth'})` com delay 220ms (espera teclado abrir). CSS `scroll-margin-top` calc dinâmico (env-safe + ad-banner + update-banner + app-header + 12px) respeita pilha sticky atual sem hardcode.
- **#0022** P1 — AdMob banner não aparecia / aparecia sobre status bar. Root cause duplo: (a) `initializeForTesting: !import.meta.env.PROD` — `vite build` SEMPRE seta PROD=true → modo prod no test slot → Google retorna NO_FILL (errorCode 3). (b) `margin: 0` no `showBanner` — AdMob plugin usa coordenadas ABSOLUTAS de tela → banner sobreposto à status bar/notch. Fix: (a) `isUsingTestAd = ADMOB_BANNER_ANDROID === TEST_AD_UNIT` → garante test mode + EMULATOR testing device sempre que usando test slot; (b) `MainActivity.java` mede WindowInsets.statusBars + displayCutout nativo via `ViewCompat.setOnApplyWindowInsetsListener`, injeta CSS var `--system-status-bar-height` + JS `window.__dosySystemStatusBarHeight`. `useAdMobBanner` lê valor real + `waitForStatusBarHeight(500ms)` antes do showBanner. Per-device dinâmico (Pixel 38dp, Samsung 44dp, devices antigos 24dp).

### v0.2.6.4 (2026-05-23, vc 89 mandatory)

- **#0018** P0 — Regex `inferGroupFromName` muito ampla em medCategories.js — sufixo "alina" do antidepressivo capturava "anlodipina" (deveria ser anti_hipertensivo). Plus: `dipino` só matchava gender masculino, falhando em "anlodipina" gender feminino. Fix: reordenar precedência (anti_hipertensivo PRIMEIRO) + gender `(a|o)?` + `\b` boundary em pril/olol/prazol/zolam/azepam/terol/tropio. Heurísticas expandidas (antialergico, antitermico, anticoagulante). Roteiro P0.2.
- **#0019** P0 — 458 rows medications_catalog WHERE group_id='outro' AND cmed_class IS NULL = antibióticos invisíveis. Drogas como Tigeciclina, Linezolida, Cefazolina, Amoxicilina, Olmesartana, Anlodipino, Tiroxina ficavam em 'outro' em vez do grupo correto. Fix: migration `v0_2_6_4_p0_5_catalog_cleanup` com 17 UPDATE statements pattern-based em principio_ativo (96 rows movidas). Remanescentes 362 são legitimamente 'outro' (oncológicos/biológicos/anti-arrítmicos sem grupo na taxonomy 17). Roteiro P0.5.

### v0.2.6.3 (2026-05-23, vc 88 mandatory)

- **#0015** P0 — Histórico/Analytics ainda mostra "Outro" mesmo após fix DOSE_COLS+RPC em v0.2.6.2. Root cause: PersistQueryClientProvider IDB key `dosy-query-cache` com buster `v1` contém payloads serializados pré-fix (vc 84/85). TanStack hydrate carrega cache stale na 1ª abertura do novo APK. Fix: bump buster v1→v2 em main.jsx + mutationRegistry.js (commit `d38f356`). Pico egress global aceito 1×.
- **#0016** P0 — Autofill sempre sugere "Antidepressivo" mesmo trocando medName. Root cause: useEffect em TreatmentForm/SOS aplicava classifyResult somente quando form.group_id era NULL (early return). User digitava Escitalopram→antidepressivo, depois Amoxil → categoria stale. Plus: useClassifyMedication só rodava com `!form.group_id`. Fix: hook sempre roda; useEffect re-aplica em `[classifyResult, medName]`; distingue manual pick (autoFilledGroup=false) de autofill — LIMPA stale autofill quando classifyResult null.
- **#0017** P0 — RPC `classify_medication_robust` NÃO EXISTIA no DB (foi documentada v0.2.4.0 mas nunca criada). Hook caía sempre no fallback heurístico cliente com regex amplo (`/pram|alina/`). Falta cruzar nome digitado com BD CMED 30k real-time + dropdown não mostrava origem. Fix: migration `v0_2_6_3_classify_medication_robust_5tier` cria RPC 5-tier (DCB exact 1.0 / catalog exact 0.95 / catalog LIKE 0.85 / principio LIKE 0.75 / heurística sufixo 0.55 word-boundary-aware). MedNameInput exibe 3 badges: DCB ANVISA (azul) / CMED (verde) / SEU (laranja).

### v0.2.6.2 (2026-05-23, vc 87 mandatory)

- **#0012** P0 — Histórico/Analytics tudo em "Outro" mesmo com antibióticos categorizados no DB. Root cause duplo: (a) `DOSE_COLS_LIST` em `dosesService.js` SELECT PostgREST omitia `group_id, cmed_class` → cliente recebia undefined → fallback `d.group_id || 'outro'` agrupava tudo; (b) RPC `get_dashboard_payload` `jsonb_build_object` omitia mesmos campos. Fix duplo (commit `2bf8dad` + migration `v0_2_6_2_dashboard_payload_includes_group_id`). BD estava correto (47 doses antibiotico done Liam Sinot Clav + Rael Clavulin/Amoxi/Azitro). Bug pre-existente desde v0.2.4.0. ✅ Validado QA Android emulator Pixel8.
- **#0013** P0 — TreatmentForm crasha `Cannot access 'Se' before initialization` em build minificado prod. Root cause: `useClassifyMedication(form?.medName)` referenciava `form` ANTES de `const [form, setForm] = useState()` na linha 89. Vite dev hidden o TDZ; build minificado expõe. Fix: reorder useState antes de useClassifyMedication (commit `23213f9`). Bug pre-existente v0.2.5.0. ✅ Validado QA Android.
- **#0014** P0 — MedNameInput mobile UX quebrada (campo some, teclado por cima, sugestões somem ao scroll, "uma zona" segundo user). Root cause: dropdown inline em Capacitor WebView Android — teclado virtual reposiciona, scroll body desfocava input, click-outside captura tap em scrollbar interno. Fix estrutural: reescrito mobile-first em FULL-SCREEN sheet `position:fixed inset:0 z-index:1500` (P0.7 Roteiro_Alinhamento_Dosy_v2 anti-pattern P9.8). Detect mobile via `matchMedia('(max-width:768px)')` OR coarse pointer. Trigger é `<button aria-haspopup="dialog">`, tap abre sheet com header fixo (X close + search icon + input fontSize:16 anti-zoom Android) + lista flex-1 `overscroll-behavior:contain`. Lock body scroll, autoFocus delay 80ms. Desktop dropdown inline mantido inalterado. Commit `2bf8dad`.

### v0.2.3.14 (2026-05-19, vc 77)

- **#0009** P2 — `usePatientShares` query 401 JWT expiry mostrava "Carregando..." pra sempre. Fix `useShares.js`: retry handler skip auth errors (não retry 401/PGRST301). `SharePatientSheet.jsx`: error state explícito + botão "Tentar novamente" quando query em `status: 'error'`. Commit `8fc5f03`. ✅ Validado web Chrome MCP (inject `q.setState({status:'error'})` via fiber walk → sheet renderiza mensagem vermelha + retry).
- **#0010** P2 — Update banner mostrava `"versão 75"` em vez de `"0.2.3.12"`. Root cause: `useAppUpdate.js:153-156` preferia `info.availableVersion` (Play Core retorna stringified versionCode quando Play Store backend não popula versionName imediatamente pós-publish). Fix: inverter ordem — DB autoritativa primeiro, validar shape semver de `info.availableVersion` (`/\d+\.\d+/`), fallback `versão N` sem `v` prefix. Commit `2bd4139`. ✅ Validado web (`__dosyForceUpdate=true` → `"v0.2.3.14 · toque para recarregar"`).
- **#0011** P2 — Update banner verde em vez de modal mandatory quando release intermediária tem `is_mandatory=true`. Root cause race: `currentVersionCode=null` em primeiro check (useEffect getRealVersion ainda não populou) → mandatory check pulado. Fix: query upper-bound-only quando currentVc null (any release `<=availableVc` mandatory → conservatively treat as mandatory). Trade-off falso-positivo em fresh install antigo aceitável em healthcare. Commit `2bd4139`. ✅ Validado web (`__dosyForceMandatory=true` → modal vermelho z-index 9999, body overflow hidden, sem dismiss).

#### Recursos novos v0.2.3.14 (Empilhamento C — debugability)

- **Sentry breadcrumbs em `useAppUpdate`** — `fetchReleaseFromDb` emite info/warning/error levels. Permite confirmar root cause real de #0011 em prod (timing A vs race Play Core B).
- **Copy fallback sanitization** — banner fallback path renderiza `"versão 99 · toque para recarregar"` sem `v` prefix (evita `"vversão 99"`). Modal fallback path sem chip `"VERSÃO X DISPONÍVEL"` (evita `"VERSÃO versão 99 DISPONÍVEL"`). Default semver path inalterado.
- **Debug toggle `window.__dosyForceFallback`** — força copy fallback localmente sem precisar derrubar DB query. Padrão consistente com `__dosyForceUpdate`/`__dosyForceMandatory` de v0.2.3.11. Commits `077e796` + `c839d5f`.

### v0.2.3.11 (2026-05-18, vc 74)

- **#0001** P2 — Push subscription Android não registra automaticamente. Fix `useAuth` SIGNED_IN + INITIAL_SESSION: se `!cachedToken` e permissão Android `granted` → `subscribeFcm(15)` auto. Sem prompt surpresa. Commit `7e043ab`. ✅ Validado emulador (CDP clear `dosy_fcm_token` + reload → token restaurado via auto-subscribe path).
- **#0002** P2 — Banner "Desfazer" não aparecia no Samsung One UI device físico após marcar dose. Fix `useToast.jsx`: `bottom-24` → `calc(6rem + env(safe-area-inset-bottom, 0px))`. Garante toast acima BottomNav em gesture nav (safe-area ≈ 28-34px). Commit `7e043ab`. ✅ Validado emulador (CDP captureScreenshot `TOAST_FOUND pos=fixed bottom=96px`).
- **#0003** P2 — `DosyMessagingService.handlePatientUnshared` chamava `ctx.startActivity(intent)` forçando app abrir sozinho. Fix: REMOVE startActivity. `MainActivity.sWeakRef = WeakReference<MainActivity>` em onCreate. App vivo: `runOnUiThread → postJsEvent` direto. App morto: SharedPreferences `dosy_pending_unshare` consumido em `onResume → checkPendingUnshare`. Commits `7e043ab` + `1062e62`. ✅ Validado behavioral (Chrome web teste-plus unshare → emulador teste-free focus=Launcher pós FCM, cache cleanup silencioso).
- **#0004** P2 — Após unshare em background, app abria travado em "Paciente Carregando..." infinito. Fix: `postJsEvent` nova key `"unsharePatientId"` → window var separada `__dosyPendingUnsharePatientId` (não confunde com `__dosyPendingPatientId` do openPatient). App.jsx cold-start handler lê var separada → `onPatientUnshared` (cache cleanup), não `onOpenPatient` (navegação). Commits `7e043ab` + `1062e62`. ✅ Validado cold-start (SharedPrefs manualmente populado + open app → onResume consome + abre `/` Dashboard).
- **#0005** P2 — Status "Cancelada" em Reports persistia indevidamente após ciclo pause/resume. Fix `treatmentsService.resumeTreatment`: após RPC `update_treatment_schedule`, UPDATE doses cancelled→pending WHERE `scheduledAt > now()`. Reports: exclui cancelled do denominador de adherence + topMeds ignora cancelled. Commit `3d73a57`. ✅ Validado live (pausar SHARE 01 → Reports Adesão 67% (2/3) durante pause — não 40% (2/5) que seria sem fix → resume → 3 doses sem Cancelada).
- **#0006** P2 — Console logs `[object Object]` em logcat (Dashboard/Patients). Root cause identificado via CDP trace: (a) Capacitor bridge interno `cap.toNative` linha 348 chama `console.dir(call)` em TODA chamada nativa (~110 entries por reload); (b) Sentry vendor captura AppUpdate install error -6 (ERROR_INSTALL_NOT_ALLOWED, emulador-only) e re-emite event object → `toString → [object Object]`. **Não é código app** — `useAppUpdate.js` usa `e?.message` correto. Fix: `capacitor.config.ts` adiciona `android: { loggingBehavior: 'production' }` — silencia bridge tracing em debug builds também. Release builds já silenciam via BuildConfig.DEBUG=false. Commit deste fix (#299 sessão).
- **#0007** P3 — HORÁRIO no DoseModal modo "outro" exibia formato en-US (`05/15/2026 3:06PM`). Fix `DoseModal.jsx`: substitui `datetime-local` por `type="date"` + `type="time"` separados — mesmo fix #261 SOS.jsx v0.2.3.6. Commit `3d73a57`. ✅ Validado emulador (CDP query `<input type=date>` + `<input type=time>` campos distintos pt-BR DD/MM/YYYY + 24h).
- **#0008** P4 — TreatmentList exibia "1 dias" (plural) quando `durationDays === 1`. Fix `TreatmentList.jsx:446`: `t.durationDays === 1` → `Number(t.durationDays) === 1` (DB retorna string). Branch `Termina hoje` quando `diffDays === 0` já existente — validado visualmente após cruzar meia-noite durante teste. Commit `3d73a57`. ✅ Validado.

#### Recursos novos v0.2.3.11
- **#299** Tabela autoritativa `medcontrol.app_releases` substitui mapa hardcoded `VERSION_CODE_TO_NAME` + cadeia frágil `/version.json` Vercel. RLS `FOR SELECT USING (true)` (read-only public). IA atualiza no Passo 12 via INSERT idempotente (ON CONFLICT DO NOTHING). Cache localStorage `dosy_vname_<vcode>` evita queries repetidas. Banner verde dismissable default; coluna `is_mandatory BOOLEAN` força modal vermelho full-screen bloqueante (uso de modal só em security fixes / breaking schema). Migration `20260518000000_app_releases_v0_2_3_11.sql` aplicada. Hook `useAppUpdate.js` + componente `UpdateBanner.jsx` refatorados.

### v0.2.3.10 (2026-05-17, vc 73)
- **#295** P2 — "Sem paciente" no alarme — `listDoses` JOIN inline `patients(name)` + `useDashboardPayload` enrich client. Commit `efd4aa7`. ✅ Validado device físico (paciente "Dona Maria").
- **#296** P2 — Pull-to-refresh Dashboard não removia pacientes/doses fantasmas — invalidação ampla de namespaces. Commit `efd4aa7`. ✅ Validado device físico.
- **#297** P1 LGPD — Unshare patient deixava paciente fantasma no cuidador — Edge `patient-unshare-handler` v1 + DB trigger DELETE + Java handler. Commit `efd4aa7`. ⚠️ Cache cleanup funciona mas UX errada — gerou #0003 + #0004 abertos (fechados em v0.2.3.11).

### v0.2.3.8 (2026-05-17, vc 71)
- **#287** P0 — Killed caregiver alarm gap — Edge `dose-trigger-handler` v25 + `dose-fire-time-notifier` v7 enviam DATA-ONLY HIGH + Java `handleFireNowAlarm` dispara `AlarmService` imediato. Commit `981fab4`. ✅ Validado device físico.

### v0.2.3.7 (2026-05-17, vc 70)
- **#279** P1 — Edge FCM caregiver bypass Doze.
- **#280** P1 — Patient share PUSH notification.
- **#281** P1 — Fire-time alarm FCM cuidador app killed.
- **#282** P1 — Idempotência AlarmScheduler + WorkManager backup Samsung Doze.
- **#283** P1 — RPCs salvam userId=patient.userId (não auth.uid).

### v0.2.3.6 (2026-05-15, vc 69)
- **#253b** P2 — Email template wordmark texto (img→CSS).
- **#254b** P2 — Self-patient signup via user_metadata.
- **#255** P1 — Idle longo (>1h) → skeleton infinito.
- **#256b** P1 — SOS submit trava silencioso (window.confirm Capacitor).
- **#257b** P1 — `lockAcquireTimeout: 15s` em `supabase.js`.
- **#258b** P1 — Sharing Dashboard via `get_dashboard_payload` CTE.
- **#259** P2 — Status "Cancelada" persistia em Reports pós pause/resume (fix parcial — reaberto como #0005, fechado v0.2.3.11).
- **#260** P2 — Console errors `[object Object]` (fix parcial — reaberto como #0006, fechado v0.2.3.11).
- **#261** P3 — HORÁRIO SOS en-US format (fix parcial — reaberto como #0007, fechado v0.2.3.11).
- **#262** P3 — Ad banner posição (resolvido — Ad agora é overlay global no topo, sem conflito de header).
- **#263** P4 — "1 dia" / "Termina hoje" relativo (fix parcial — reaberto como #0008, fechado v0.2.3.11).
- **#264** P1 — Dose 1ª passada pulada em `create_treatment_with_doses`.
- **#265** P2 — Count exato total doses.
- **#266** P1 — PatientDetail não mostrava tratamento recém-criado.
- **#267** P1 — Dashboard skeleton em hour boundary.

### v0.2.3.2 (2026-05-14, vc 65)
- **#227** P1 — `alarm_audit_log` RLS root cause.
- **#228** P1 — `unsubscribeFcm` cross-device contamination.
- **#229** P1 — Snooze persist em reboot (`apply()` → `commit()` sync).
- **#230** P2 — Edge `dose-trigger-handler` BATCH_UPDATE multi-dose group hash.

### Releases anteriores
Ver `context/ROADMAP.md` §6.3 Δ release log para histórico completo (v0.2.1.x, v0.2.2.x, v0.2.3.0, v0.2.3.1).
