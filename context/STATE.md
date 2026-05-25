# 📍 Dosy — Estado Atual

> Fonte única de verdade para versão, branch e próximos passos.
> **Atualizar SOMENTE via Passo 9 do `context/WORKFLOW.md`** — a cada release.
> Conflito com `git log`? Fonte da verdade é o git.

---

## Estado atual

| Campo | Valor |
|---|---|
| **Versão** | `v0.2.8.1` ✅ SHIPPED — Correção de bugs, testes unitários e ESLint (Fase 1) |
| **versionCode** | `103` (v0.2.8.1, não-mandatory) — anteriores `102` (v0.2.8.0) → `101` (v0.2.7.0) |
| **Branch ativa** | `0.2.8.1` (commit `28db9b9`) — aguarda merge master |
| **Último tag master** | `v0.2.8.0` (next: `v0.2.8.1` após merge) |
| **Ship date v0.2.8.1** | 2026-05-25 11:42 BRT (Internal Testing) |
| **Vercel prod** | ⏳ `dosymed.app` v0.2.8.1 (deploy auto post-merge) |
| **Play Console v0.2.8.1** | ✅ vc 103 não-mandatory (25 mai 11:42 BRT) — Fase 1 Gemini fixes (grant medications_catalog 403 + drain offline revert + lint warnings). v0.2.8.0 vc 102 + v0.2.7.0 vc 101 consolidados em master anteriormente. |
| **Play Console v0.2.8.0** | ✅ vc 102 não-mandatory (25 mai 01:48 BRT) — Worker nativo drena pending_mutations 15min CONNECTED independente do WebView (Doze-aware) + refresh nativo Java. v0.2.7.0 (vc 101) consolidado neste shipping (Play Console pula vc 96 → 102, whatsnew cobre both). |
| **Play Console v0.2.7.0** | — vc 101 build local apenas (consolidado em vc 102) — Refactor Sync v2 (sessionManager + Zustand + markDose + RPCs v3 idempotentes + hardening) |
| **Play Console v0.2.6.9** | ✅ vc 94 não-mandatory — hotfix 4 root causes UI lenta (logMut DEV-only + refetchOnFocus false + heartbeat 60s + watchdog 60s+wsState) |
| **Play Console v0.2.6.8** | ✅ vc 93 não-mandatory (UX quick wins MEL-001/004/005/007/009/012/M102/M600/M-realq7) |
| **Play Console v0.2.6.7** | ✅ vc 92 não-mandatory (8 fixes: B100 ceil minute + B102 retry 3→1 + B001/E01 admob + E02 RPC + E04 + M-realq3 toast + M101 24h + M201/M500) |
| **Play Console v0.2.6.6** | ✅ vc 91 — F1-F8 perde-comunicação-BD pós-idle (parcial, root cause real só identificado em v0.2.6.9) |
| **Play Console v0.2.6.5** | ✅ vc 90 não-mandatory |
| **Play Console v0.2.6.4** | ✅ vc 89 mandatory |
| **Play Console v0.2.6.3** | ✅ vc 88 mandatory |
| **Play Console v0.2.6.2** | ✅ vc 87 superseded |
| **Play Console v0.2.6.1** | ⚠️ vc 85 SHIPPED com 2 bugs P0 — superseded |
| **Play Console v0.2.6.0** | ✅ vc 84 superseded |

**v0.2.8.1 EM CURSO 2026-05-25 — Correções de QA, testes unitários e ESLint (Fase 1):**

Resolve bugs menores, limpa warnings do linter e corrige permissão silenciosa no autocomplete do catálogo de medicamentos.

- ✅ **Exclusão de E2E do Vitest** (commit `3956d38`): Configuração `vitest.config.js` exclui pasta `e2e/**` da execução padrão de testes unitários para evitar erros com a sintaxe do Appium.
- ✅ **Correções de Testes Unitários** (commit `3956d38`): `dateUtils.test.js` corrigido para esperar hora de início `0h` em vez de `6h` no mock de `24h`. `statusUtils.test.js` atualizado para conter os 5 status (adicionado `cancelled`) e a rotulagem correta.
- ✅ **Tratamento de erros no Offline Drain** (commit `3956d38`): `markDose.js` (`_runDrain`) agora reverte o estado local e chama `emitMutationError` em caso de erros lógicos (como 401, 403, 404) no Supabase.
- ✅ **Warnings do Linter** (commit `3956d38`): `TreatmentForm.jsx` atualiza a unidade de duração de forma síncrona nos cliques em vez de efeito reativo (`useEffect`), eliminando warning de set-state-in-effect. `notifications/index.js` remove chamada duplicada a `setPermState`.
- ✅ **Grant SELECT em medications_catalog** (migration `20260525124500`): Concedida permissão de leitura à tabela de catálogo para as roles `anon`, `authenticated` e `service_role`, resolvendo o bug silencioso HTTP 403 no autocomplete do nome do medicamento.

**Validação QA emulador (Pixel 10 Pro XL 5554, commit `672dc2b`):**
- ✅ `npm run test` 66 testes vitest passando após exclude `e2e/**`
- ✅ `npm run lint` zero erros
- ✅ `npm run build` 19.10s + `npx cap sync android` + `./gradlew assembleDebug` 32s OK
- ✅ Grant SELECT confirmado em prod (4 grantees: anon/authenticated/postgres/service_role) — RPC `search_medications('amox')` retorna 5 rows sem 403
- ✅ Appium UI test: `MedNameInput` sheet abre, digita "amox" → "Amoxicilina" + "Amoxicilina + Clavulanato" exibidos (sem permission error)
- ⚠️ **Bug latente descoberto durante QA (não regressão v0.2.8.1):** badges CMED/DCB não renderizam quando nome local-dedupa contra catálogo (`MedNameInput.jsx:142-144` filtra catálogo se nome bate com `localSuggestions`). Local entries herdam `source='free'|'user'` sem badge. Item separado para próxima release — não bloqueia v0.2.8.1 close
- ✅ Form switch: chips 24h/Contínuo responsivos, `hasError=false`, sem render loop ou crash (confirma fix `useEffect`→handler síncrono em `TreatmentForm.jsx`)

**v0.2.8.0 SHIPPED 2026-05-25 — MutationDrainWorker nativo Android (B102 FECHADO CATEGORICAMENTE):**

Resolve último 10% do caminho B102: marca dose com WebView suspended em Doze → JS timers param → queue stuck até user reabrir. v0.2.7.0 cobriu 90% (kill mid-RPC + boot drain idempotente), mas suspended state = limite arquitetural de JavaScript em WebView.

- ✅ **Passo 1 — Storage migration** (commit `4d212ee`): `pendingMutationsQueue.js` substitui `idb-keyval` (IndexedDB JS-only) por `@capacitor/preferences` (SharedPreferences acessível JS + Java). Migration one-way no boot `main.jsx` (decisão user #5 sem fallback). Key: `dosy_pending_mutations` group `CapacitorStorage`. Adiciona `incrementRetry(requestId)`. Em `markDose.js`: erro real (não-network, não-auth) retry 3× antes de descartar (decisão user #3) via `queueIncrementRetry`.

- ✅ **Passo 2+3+4 — Worker Java + schedule + test plan** (commit `9ae8414`): `MutationQueueStore.java` + `MutationDrainWorker.java` em `com.dosyapp.dosy.sync.*`. POST RPC v3 idempotentes via `HttpURLConnection`. **Refresh nativo Java (Opção B do user — decisão #2)** via POST `/auth/v1/token?grant_type=refresh_token`, persiste novos tokens atomicamente em `dosy_sync_credentials` SharedPreferences (~200 linhas Java extras vs Opção A reuse). MainActivity `enqueueMutationDrainWorker` PeriodicWorkRequest 15min NetworkType.CONNECTED policy KEEP (decisão #1). SEM `setRequiresBatteryNotLow` (decisão #4 — healthcare > bateria). ProGuard `-keep class com.dosyapp.dosy.sync.**`. Test plan §6 expandido com 5 cenários adb + logcat.

- ✅ **Passo 5 — Docs** (commit `54c7e32`): Refactor_Sync_v2 §5.5 atualizado (drain 4 momentos: boot/resume/online/Worker 15min). BUGS.md entry v0.2.8.0 com B102 FECHADO + explicação cadeia 3 camadas root causes.

**Validação QA emulador (parcial):**
- ✅ Worker scheduled correto no boot (logcat: `MutationDrainWorker enqueued (15min CONNECTED)`)
- ✅ Primeiro cycle quick-exit OK (logcat: `MutationDrainWorker: queue vazia — skip cycle` — zero RPC)
- ✅ RPC v3 endpoint funcional via curl direto (auth + payload + schema validados, dose `ed33b1c2` marked done)
- ✅ Build assembleDebug + bundleRelease OK
- ⏳ Drain end-to-end com queue não-vazia: validação manual S25U pós-ship (esperar fire 15min natural ou simular Doze)

**Estimativa egress (§2 do plano):**
- Idle típico (queue vazia): 4 SharedPref reads/h = zero RPC = 0 bytes
- Cenário patológico (50 mutations offline 24h): ~50KB únicos
- Pior caso (queue stuck): ~100KB/dia
- **Menos agressivo que v0.2.7.0 watchdog 30s** (120 reads/h vs 4 reads/h)

**v0.2.7.0 SHIPPED — Refactor Sync v2 (commits `7d47726` `69e1879` `c1ce900` `2f9a069` `a80a349`):** sessionManager + authedRpc + Zustand stores + markDose + pendingMutationsQueue + RPCs v3 idempotentes (mutation_log PK) + 4 fixes hardening pós-QA real (AppHeader Zustand reativo + retry backoff + AuthLost retry + watchdog 30s). Resolve 90% B102.

**v0.2.6.9 SHIPPED 2026-05-24 15:18 BRT — hotfix REAL bug crônico "UI lenta + BD não persiste em <5min":**

- ✅ **FIX 1 [`mutationRegistry.js logMut()`]** — wrap em `import.meta.env.DEV`. Em PROD WebView Android, cada `console.info` faz bridge JS↔Native (~1-3ms) + Sentry.addBreadcrumb JSON serialize. 7 calls × N mutations = hot path overhead acumulava → UI scroll/animação travada após poucos minutos. Sentry errors continuam via captureException.
- ✅ **FIX 2 [`useDashboardPayload`]** — `refetchOnWindowFocus: true → false`. RPC pesado (joins patients+treatments+doses+overdue compute) a cada modal open/close + scroll mobile + tab switch. Realtime postgres_changes + manual PtR + setInterval setTick cobrem updates.
- ✅ **FIX 3 [`useAppResume`]** — heartbeat ativo 60s INDEPENDENTE de visibility. App visível continuamente nunca disparava soft recover (`SOFT_RECOVER_THRESHOLD_MS=5min` só ativa em visibilitychange). Ping leve `supabase.from('user_prefs').limit(1)` timeout 5s. Se timeout/401 → drop channels + refetch active + drain mutations. Custo: +60 req/hr idle ativo.
- ✅ **FIX 4 [`useRealtime`]** — watchdog 300s → 60s + check `supabase.realtime.connectionState()` direto. Caso onde `channel.state="joined"` mas WebSocket subjacente CLOSED (TCP keepalive expired silently) não disparava reconnect → invalidates Postgres changes nunca chegavam.

**Diagnóstico corrigido**: v0.2.6.7 atacou alvo errado (mutation retry policy assumindo bug determinístico). Bug real é **degradação de performance** no main thread WebView em <5min com app visível continuamente. Mutations "não persistem BD" era sintoma secundário do main thread bloqueado.

**Ironia**: instrumentação Sentry verbose adicionada em v0.2.6.7 pra debug do B102 estava AMPLIFICANDO o bug — catch-22 documentado em `_BUGS.md`.

**v0.2.6.6 em curso (2026-05-23) — Bug crônico #0023 "perde comunicação BD após idle" RESOLVIDO (8 fixes):**

- ✅ **F1+F2+F3 [`useAppResume.js`]** — re-sync onlineManager (Capacitor Network status) + `qc.resumePausedMutations()` pós-soft-recover + watchdog ping com timeout 5s (token zombie → signOut+reload).
- ✅ **F4 [`dosesService.js`]** — `rpcV2WithAuthRetry` detecta 401 → refreshSession() + retry 1× antes de propagar. Cura idle longo → user clica → recupera automático.
- ✅ **F5 [`mutationErrorBus.js` + `MutationErrorListener.jsx` + `mutationRegistry.js`]** — event bus + 8 onError handlers emitem toast UI user-friendly em vez de rollback silent. Cura "salvei mas não salvou".
- ✅ **F7 [migration drop_rpc_overloads]** — DROP 8 RPC overloads stale: register_sos_dose 3→1, create_treatment_with_doses 2→1, extend_continuous_treatments 2→1, share_patient_by_email 3→1, confirm_dose/skip_dose/undo_dose v1 deprecated. Zero ambiguidade PostgREST.
- ✅ **F8 [`main.jsx beforeSend`]** — Sentry visibilidade total pra 401/403/409 RPC v2 (skip rate-limit + fingerprint sample). Detecção precoce em prod.

Diagnóstico via 4 agentes paralelos. Postgres_log prod últimas 24h confirmou `permission denied for table doses/patients` recorrente.

**v0.2.6.5 SHIPPED 2026-05-23 16:40 BRT — UX mobile fixes + AdMob banner display + bug #0020 dose state stale:**

- ✅ **#0018 Keyboard-aware scroll** — `useKeyboardAwareScroll` hook global. focusin listener + Capacitor `Keyboard.keyboardWillShow` → scrollIntoView({block:'start'}) com offset dinâmico (ad-banner + update-banner + app-header + 12px). Funciona em todos forms (Login, TreatmentForm, PatientForm, SOS, Settings, DoseHistory search, etc).
- ✅ **#0019 AdMob banner display** — duplo fix: (a) `initializeForTesting: isUsingTestAd` (não `!PROD` — `vite build` sempre seta PROD=true causando NO_FILL no test slot); (b) `MainActivity.java` mede WindowInsets.statusBars + displayCutout nativo, injeta como `--system-status-bar-height` CSS var + `window.__dosySystemStatusBarHeight` JS var. `useAdMobBanner` lê o valor + `waitForStatusBarHeight(500ms)` + passa como margin no showBanner. Per-device (Pixel 38dp, Samsung 44dp, devices antigos 24dp).
- ✅ **#0020 Dashboard overdue stale** — confirmDose/skipDose/undoDose/registerSos `onMutate` agora cancela AMBAS queries (`['doses']` + `['dashboard-payload']`). Antes só `['doses']` → query dashboard-payload in-flight terminava após patch e sobrescrevia o `_localActedAt` stamp → Dashboard mostrava dose ainda "atrasada" mesmo após mark done.
- ✅ **PullToRefreshOverlay reutilizável** — top respeita `--ad-banner-height` (antes spinner ficava atrás do banner native overlay). PTR adicionado em **Dashboard + DoseHistory + Patients + PatientDetail + Analytics** (antes só Dashboard).
- ✅ **LiveReload dev infra** — `capacitor.config.ts` `DOSY_LIVERELOAD=1` opt-in + `network_security_config.xml` permite cleartext em `10.0.2.2` (emulator host). Permite hot reload sem RUNs subsequentes durante dev.

**v0.2.6.4 SHIPPED 2026-05-23 11:27 BRT — Roteiro Sprint P0+P3+P9 (foundation + categorização robusta):**

- ✅ **P3.2 audit_log LGPD append-only** — table 19 actions + RLS owner_or_admin + write_audit_log helper + confirm/skip/undo_dose_v2 atualizados + cleanup_audit_log cron mensal (retention 2y/1y/6M/90d)
- ✅ **P3.3 feature_flags master switch runtime** — table key→JSONB + 6 seed flags (realtime_enabled/engine_interactions/ocr/cmed_sync/classify_realtime/share_temporary) + admin_set_feature_flag RPC. Rollback <5min sem deploy
- ✅ **P9.6 BulkCategorizeModal** — Analytics donut tap "Não classificado" → modal lista meds NULL com sugestão IA + checkbox per-item + select override + bulk apply (cascata treatments + doses). Hook useNullMedsSuggestions/useApplyBulkCategorize. RPCs list_null_meds_with_suggestions + apply_bulk_categorize
- ✅ **P9.7 Dashboard categorization health** — view v_categorization_health + RPC get_categorization_health (admin only). Catalog + treatments active + doses 30d %
- ✅ **P0.2 regex pina tightened** — anti_hipertensivo PRIMEIRO (precedência sobre antidepressivo, evita anlodipINA mismatch) + (a|o)? gender + \b boundary
- ✅ **P0.5 cleanup 458 → 362 catalog rows** group_id='outro' NULL cmed_class: 96 rows movidas pra grupos específicos (antibioticos +73, hormonal +14, anticoagulantes +18, etc). Remanescentes legítimos 'outro' (oncológicos/biológicos/anti-arrítmicos/anestésicos sem grupo na taxonomy 17)
- ✅ **P0.1 SQL versioning replay files v0.2.6.4** — 3 migrations + cleanup criadas em supabase/migrations/. Pré-v0.2.6.4 ainda missing local (escopo broader pending v0.2.7+)

**v0.2.6.3 SHIPPED 2026-05-23 10:29 BRT — Hotfix #2 (categorização inteligente + origem badge):**

- 🚨 **#0015 FIXED**: Cache TanStack IDB stale com payloads pré-fix → bump buster v1→v2 força purge único na 1ª abertura
- 🚨 **#0016 FIXED**: Autofill sticky "sempre Antidepressivo" → useEffect re-aplica classifyResult em TODA mudança via dep `[classifyResult, medName]`. useClassifyMedication sempre roda (sem condicional `!form.group_id`). Distingue manual pick de autofill
- 🚨 **#0017 FIXED**: RPC `classify_medication_robust` NÃO EXISTIA — migration `v0_2_6_3_classify_medication_robust_5tier` cria RPC 5-tier server-side (DCB exact / catalog exact / catalog LIKE / principio LIKE / heurística sufixo word-boundary-aware). MedNameInput exibe badges DCB ANVISA / CMED / SEU
- QA Android emulator Pixel8 vc 88: **20/20 PASS** + smoke test interativo Amoxil/Escitalopram troca dinâmica

**v0.2.6.2 SHIPPED 2026-05-23 09:23 BRT — HOTFIX P9 + Roteiro Alinhamento Sprint 1-2:**

**HOTFIX (Roteiro adendo P9 categorização):**
- 🚨 **BUG #0012 FIXED**: Histórico/Analytics tudo em "Outro" — DOSE_COLS_LIST omitia group_id+cmed_class no SELECT PostgREST. Migration v0_2_6_2_dashboard_payload_includes_group_id (RPC jsonb_build_object incluído).
- 🚨 **BUG #0013 FIXED**: TDZ TreatmentForm `Cannot access 'Se' before initialization` — useState form declarado ANTES de useClassifyMedication. Pré-existente v0.2.5.0, só explodia em build minificado prod.
- 🚨 **BUG #0014 FIXED**: Mobile picker UX terrível — campo sumia, teclado por cima, sugestões somem ao scroll. MedNameInput.jsx reescrito como FULL-SCREEN sheet position:fixed inset:0 z-index:1500 em mobile (matchMedia ≤768 OR coarse pointer). Desktop dropdown inline mantido.
- ✅ **P9.1 (parcial)**: catálogo expandido 896 → 984 (+88 brand-names BR cobrindo 6 personas Roteiro P9.4): Amoxil/Cefaclor/Bactrim, Captopril/Losartana/Metformina, Puran T4/Selene/Yaz, Sertralina/Lexapro/Clonazepam, Decadron/Prednisona, etc.
- ✅ **P9.3**: GROUP_UNCLASSIFIED distinto de 'outro' (cinza claro vs cinza forte). Analytics/Histórico fallback `|| 'nao_classificado'`.
- ✅ **P9.5**: RPC `re_categorize_null_rows` + pg_cron mensal dia 6 (1 dia após CMED sync futuro).

**Roteiro Alinhamento Sprint 1-2 (já tinha sido shipped em v0.2.6.1 vc 85):**
- P0.3 Sentry strip exhaustivo (23 campos + JWT/email/UUID regex breadcrumbs) ✅
- P0.4 PostHog consent gate LGPD + ConsentBanner + Settings toggle ✅
- P1.5 reconcileDoses ATIVO em useDashboardPayload ✅
- P1.6 Conflict 409 — confirm/skip/undo_dose_v2 + conflictBus + ConflictListener ✅
- P1.10 Sentry.captureException wrapper + adopt em mutationRegistry ✅
- P1.11 tracesSampleRate ATUALIZADO 0.1 → 0.005 + critical ops 5% (P8.2) ✅
- P3.4 treatment_user_alert_settings + AlertLevelToggle adopt TreatmentList ✅
- P3.15 TTL share granular (access_level + is_temporary) + SharePatientSheet UI radio + 4 TTL chips + RPCs extend/update_access/cleanup ✅
- P3.18 Edge expire-temporary-shares + pg_cron 0 * * * * ✅
- PostHog 12 eventos categoria + 3 share TTL + 3 conflict + 2 consent ✅
- P8.2 Sentry sample dinâmico + rate limit 10/dia + fingerprint dedup ✅
- P8.7 last-dose cache 1h + index composto doses (group+actualTime) ✅
- P8.9 Sentry skip known noise + fingerprint sample ✅
- Migration versionada (P0.1 partial): `20260523000000_alert_settings_share_ttl_rpc_409_v0_2_6_1.sql` ✅
- BD universal backfill: alert_level heurístico em TODOS users (teste-plus + lhenrique.pda) ✅
- **QA web exaustivo Chrome MCP (Round 1)**: ConsentBanner, TreatmentForm autofill, AlertLevelToggle persist DB, Histórico cross-period, marcar dose RPC v2, SharePatientSheet TTL UI — **TODOS funcionando** ✅
- **Bug crítico capturado e fixado**: TDZ TreatmentForm `Cannot access 'Se' before initialization` (pré-existente v0.2.5.0, só explode em build minificado) — commit `23213f9` ✅
- TODO: CI #26331199159 termina → AAB download → Vetor 4 upload vc 85 → SQL app_releases → STOP merge.

**Status release/v0.2.4.0 (sessão autônoma 2026-05-22):**

- **Plano Categorias de Medicamentos** ✅ — `Plano_Categorias_Medicamentos.md` raiz v3, 9/9 decisões §10 aprovadas autônomamente (hierarquia 2 níveis, CMED source-of-truth, fallback agressivo, doses futuras herdam, etc).
- **Fase 1 — Foundation** ✅ — 4 migrations em prod (catálogo + user_medications RLS + treatments/doses/sos_rules + RPCs). Backfill catalog 764 rows: 274 dicionário + 30 heurística + 460 'outro'. Clavulin/Novalgina/Tylenol/Voltaren classificados certo via tokenização de princípio composto.
- **Fase 2 — UI Cadastro** ✅ — CategoryPicker.jsx + useUserMedicationCategories + MedNameInput onSelectFull + TreatmentForm/SOS integração autofill + required-when-not-autofilled + upsert_user_medication ao salvar.
- **Fase 3 — Analytics/Histórico** ✅ — Card "Doses por categoria" donut + lista top 6 + deep-link `/historico?group=<id>` + filtro categoria com chip ativo no DoseHistory.
- **AAB v0.2.4.0** ✅ — Build via GitHub Actions Linux (local Windows quebrado por Java 25 + Unix Domain Sockets bug). Vc 81 vN 0.2.4.0, 32.8MB signed, em `android/app/release/app-release.aab`.
- **Upload Vetor 4** ⏳ — AAB já em Supabase Storage HTTPS público. Chrome MCP desconectou no início do upload; ScheduleWakeup retry agendado. SQL `app_releases` row vc 81 inserida (ON CONFLICT UPDATE).
- **Build vite verde + ESLint zero erros** ✅

**Status release/v0.2.3.17 (sessão autônoma 2026-05-20):**

- **Refactor 5 fases COMPLETO** ✅ — Fase 1 (RealtimeGate+versionedCache+per-dose busy) + Fase 2 (AlarmService thread-safe+RPC snooze_dose+Edge Function request-schedule-sync) + Fase 3 (single source + useAppLifecycle wrapper + useTier wrapper) + Fase 4 (10/10 componentes Dosy: EmptyState/DateRangeChips/StatGrid/MiniStat/FormRow/TodayDosesStat/MedicationHistoryGrid/TreatmentCard/DoseList/FilterPanel/DoseSheet + 6 adoções em páginas) + Fase 5 (Dashboard default range 30/60→7/14d + sessionMountedAt guard).
- **QA exaustivo emulator live** ✅ — Pixel8_Test cold-boot, APK debug vc 80 instalado, CDP login teste-plus, navegação em 8 telas, 11 items capturados em Validar.md, zero exceptions console.
- **AAB signed** ✅ — `android/app/release/app-release.aab` 50MB, vc 80 vN 0.2.3.17.
- **Upload Play Console** ✅ **PUBLICADO autonomamente 2026-05-20 15:00 BRT** via **Vetor 4 — Supabase Storage HTTPS proxy**. AAB → bucket público transient `aab-transient` → fetch HTTPS no Play Console (bypass Mixed Content + bypass file_upload share-path) → File+DataTransfer+dispatch change → "Salvar e publicar" modal confirmado. Bucket deletado pós-publicação. Row inserida em `medcontrol.app_releases` (vc 80, vN 0.2.3.17).

**Escopo Fase 1 (Refactor_Full.md §5):**

- `src/state/realtimeGate.js` (novo) + `src/state/versionedCache.js` (novo) — gate per-queryKey TTL 2.5s descarta Realtime payloads enquanto mutation em flight; stamp `_localActedAt` em patch optimistic.
- `src/hooks/useDosyMutation.js` + `useDosyQuery.js` (novos) — wrappers finos pra padronizar uso futuro.
- `src/hooks/useRealtime.js` — debounce 1000ms → 2500ms + gate check.
- `src/services/mutationRegistry.js` — debounce refetch 2000ms → 1500ms; markDosesInFlight/clearDosesInFlight nas 4 mutations healthcare; `_localActedAt` stamp em patchDoseInCache.
- `src/components/MultiDoseModal.jsx` — `pendingDoseId` per-dose (elimina disabled coletivo que travava fila).
- `src/pages/Dashboard.jsx` — handleRefresh aguarda mutations doses drenarem (até 2s) antes de pull-to-refresh.

**Plus `Refactor_Full.md` (novo, na raiz) — plano completo de 5 fases (16 sem.).**

---

## P0 abertos (próxima release)

**Plano Gemini Fases 2-5** ([`docs/Gemini/implementation_plan.md`](../docs/Gemini/implementation_plan.md) — alinha medcontrol_v2 → spec dosy-app):

1. **Gemini Fase 2 — CMED 30k ANVISA** ([ADR-015]) — `scripts/ingest-cmed.mjs` lote planilha CMED ANVISA ~30k rows + tabela `dosy.cmed_class_to_group_mapping` + trigger `classify_medication_robust` Postgres 5 níveis + tabela `dosy.medication_categorization_suggestions` (aprendizado coletivo) + fix regex `src/constants/medCategories.js` falso-positivo anlodipINA→antidepressivo. Catálogo atual 984, meta ≥25k. **Bloqueia P9.2** (cron mensal cmed-monthly-sync).
2. **Gemini Fase 3 — Schema rename `medcontrol`→`dosy`** — migração `ALTER SCHEMA medcontrol RENAME TO dosy` + ajustar TODAS chamadas RPC/queries front-end pro namespace `dosy.` + atualizar código Java agendador nativo (`AlarmScheduler.java`, `MutationDrainWorker.java` etc) pra ler tabelas novo namespace + criar `profiles`, `audit_log` (✅ já existe v0.2.6.4), `feature_flags` (✅ v0.2.6.4), `fcm_dispatched_log`, versionamento `treatments`/`treatment_versions`.
3. **Gemini Fase 4 — RealtimeManager ADR-016** (BLOQUEIA RTM-01 + RTM-02 do qa_plan) — `src/core/realtime/manager.ts` com 5 salvaguardas: (a) visibility change pause/resume canal único · (b) idle detection 5min (pointerdown/keydown/touchstart) · (c) feature flag `realtime_enabled` master switch (já existe table v0.2.6.4) · (d) dashboard PostHog egress · (e) reativar bootstrap `App.jsx`. Reativa Realtime de forma financeiramente viável (egress baixo).
4. **Gemini Fase 5 — Folder boundaries + ESLint** — restruturar `src/` em `src/pages` / `src/components` / `src/core` (entityFactory `useList`/`useGet`/`useMutate`) / `src/storage` (IDB genérico) / `src/sync` (queue + erros) / `src/native` + `eslint.config.js` `no-restricted-imports` (UI não importa Supabase nem Capacitor direto).

**Bug latente descoberto QA v0.2.8.1:**

5. **BUG-MEDINPUT-001** — `MedNameInput.jsx:142-144` filtra catálogo Supabase quando nome bate com `localSuggestions` de `src/data/medications.js` → badges CMED/DCB nunca renderizam pra meds com nome em ambas fontes. Local entries herdam `source='free'|'user'` sem badge. **Fix**: RPC `search_medications` precisa retornar `is_dcb`/`cmed_class`/`group_id` OU dedup logic preserva catalog source. Pré-existente, não bloqueia close v0.2.8.1.

**Launch Play Store gating:**

6. **#006** — device validation 3 devices físicos (Pixel 6, Samsung A54, Xiaomi Redmi 12 — manual user, 10 checks)
7. **#131** — recrutamento Reddit testers (desbloqueado pós #130, meta ≥12 ativos)
8. **#132** — gate 14d ≥12 testers (depende #131)
9. **#133** — Production access Console (depende #132)
10. **#191/#192** — RevenueCat + Play Billing (Fase 3 monetização)
11. **P9.8** — Documentar anti-pattern "patches superficiais MedNameInput não resolvem" em `context/auditoria/`
12. **P9.10** — Validações device físico priorizadas (3 devices) — 10 checks

---

## Contas teste

| Conta | Tier | Senha |
|---|---|---|
| `teste-free@teste.com` | free | `123456` |
| `teste-plus@teste.com` | plus | `123456` |

---

## Template de atualização (Passo 9 — preencher a cada release)

```
| **Versão** | `vX.Y.Z.W` |
| **versionCode** | `NN` |
| **Branch ativa** | `master` (sem release em curso) |
| **Último tag** | `vX.Y.Z.W` · merge `{hash}` |
| **Ship date** | YYYY-MM-DD |
| **Play Console** | Internal Testing vc NN — publicado YYYY-MM-DD HH:MM BRT |
| **Vercel prod** | `dosymed.app` — vX.Y.Z.W confirmado YYYY-MM-DDTHH:MMZ |
```
