# Plano — Dosy para Android (Produto)

Roadmap em fases para transformar o Dosy (PWA + Capacitor) em produto comercial pronto para Play Store, com segurança robusta, alarme crítico estilo despertador, monetização Free/PRO/Plus e disponibilização gradual (testers internos → beta fechado → Play Store → público).

> **Nota histórica:** versão detalhada anterior preservada em `Plan-detalhado-backup.md` + reorg anterior em `Plan-pre-reorg-backup.md`.

---

## 📌 Como usar este documento

Este é o **arquivo principal de roadmap**. Toda nova ação descoberta em qualquer auditoria, análise ou bug deve ser inserida aqui na ordem cronológica/lógica certa (não no fim).

**Estrutura linear em 3 partes:**

- **PARTE I — DESENVOLVIMENTO** (FASE 0 → 9): foundation, app build, hardening, monetization, store prep
- **PARTE II — TESTERS** (FASE 10 → 12): beta interno, beta fechado com pen test, beta aberto Play Store
- **PARTE III — DEPLOY & PÓS-LAUNCH** (FASE 13 → 14): produção + operação contínua

**Para retomar trabalho em novo chat:**
1. Identificar primeira sub-fase com itens `[ ]` abertos
2. Conferir docs anexos `docs/audits/Auditoria-X.X.X.md` (inputs read-only)
3. Começar pelo primeiro item aberto

**Convenção:**
- `[ ]` = pendente · `[x]` = feito · `✅ CONCLUÍDA` no título quando todos itens fechados
- Itens vindos de auditoria citam fonte (ex: "Aud 5.2 G1")
- Cada fase tem **Validação** ao final = critério de saída

**Versão atual:** 0.1.5.6 (dev — pre-1.0). v1.0 reservada pra Play Store launch.

---

# PARTE I — DESENVOLVIMENTO

## FASE 0 — Segurança & LGPD ✅ CONCLUÍDA

### 0.1 RLS, secrets, auth ✅ CONCLUÍDA
- [x] `.env.example` com todas variáveis (sem valores reais)
- [x] Rotacionar VAPID keys (migração para projeto `dosy-app`, par novo gerado)
- [x] `git grep` no histórico verificando vazamento de secrets (auditado, baixo risco)
- [x] Auditar RLS em todas tabelas: `patients`, `treatments`, `doses`, `push_subscriptions`, `subscriptions`, `sos_rules`
- [x] Policy RLS em `push_subscriptions` isolando por usuário (`push_own_all`)
- [x] Proteger `admin_grant_tier` RPC com `is_admin()` server-side
- [x] Remover email hardcoded de admin → tabela `admins`
- [x] `vercel.json` com headers CSP, X-Frame-Options, X-Content-Type-Options
- [x] Validação de senha forte no cadastro (8+ chars, maiúscula, número)
- [x] Limpar localStorage de dados sensíveis no `signOut`
- [x] `sessionStorage` no modo demo (não localStorage)
- [x] Rate limiting Supabase Auth (`rate_limit_otp=5`, `rate_limit_anonymous_users=30`, `rate_limit_token_refresh=150`)
- [x] Confirmação email obrigatória (`mailer_autoconfirm=false`)
- [x] Tabela `security_events` para audit log
- [x] Eventos de mudança de tier registrados em `admin_grant_tier`
- [x] Eventos de exclusão de conta registrados em `delete_my_account`
- [x] Índices compostos: `doses(patientId, scheduledAt)`, `doses(patientId, status, scheduledAt)`, `treatments(patientId, status)`, `push_subscriptions(userId)`

### 0.2 LGPD & Privacidade ✅ CONCLUÍDA
- [x] `src/utils/sanitize.js` com `escapeHtml`
- [x] Aplicar `escapeHtml` em template strings do PDF em `Reports.jsx`
- [x] Exportação de dados do usuário em Settings (portabilidade LGPD)
- [x] RPC `delete_my_account` (cascata em todas tabelas)
- [x] Edge Function `delete-account` com service_role (deleta `auth.users`)
- [x] Botão "Excluir minha conta" em Settings
- [x] Checkbox de consentimento explícito no cadastro
- [x] Colunas `consentAt` e `consentVersion` em `subscriptions`
- [x] Rota `/privacidade` (política completa LGPD)
- [x] Rota `/termos` (termos de uso)
- [x] pg_cron `anonymize-old-doses` (Domingos 3h, anonimiza doses +3 anos)
- [x] Limitar `observation` a 500 chars (Data Minimization)
- [x] Trocar `userAgent` por `platform` simplificado em `push_subscriptions`
- [x] `docs/RIPD.md` documentando Edge Functions que processam PII

### 0.3 Lógica de Negócio Server-Side ✅ CONCLUÍDA
- [x] **[CRÍTICO]** RPC `register_sos_dose` validando `minIntervalHours` + `maxDosesIn24h` server-side
- [x] **[CRÍTICO]** Substituir `INSERT` direto por RPC em `dosesService.js`
- [x] **[CRÍTICO]** Trigger `enforce_sos_via_rpc_trigger` bloqueia INSERT direto (testado via `tools/test-sos-bypass.cjs`)
- [x] **[CRÍTICO]** Drop policies inseguras `own_*` (via `tools/security-fix.cjs`)
- [x] **[ALTO]** RPC `create_treatment_with_doses(payload jsonb)` com ownership check + limite `durationDays` ≤365
- [x] **[ALTO]** RPC `update_treatment_schedule` regenera doses atomicamente
- [x] **[ALTO]** `ON DELETE CASCADE` em FKs `doses → treatments`, `treatments/doses/sos_rules/patient_shares → patients`
- [x] **[MÉDIO]** RPCs `confirm_dose`, `skip_dose`, `undo_dose` com validação de transição de status
- [x] **[MÉDIO]** Substituir UPDATEs diretos em `dosesService.js` por RPCs
- [x] **[MÉDIO]** RLS em `doses` e `treatments` via `has_patient_access()`
- [x] **[BAIXO]** Substituir `select('*')` por colunas explícitas em todos services

**Validação fase 0:** RLS pen test interno aprovado, todos endpoints exigem auth, sem secrets no bundle, LGPD compliance via páginas + delete + export.

---

## FASE 1 — Fundação Capacitor ✅ CONCLUÍDA

- [x] Instalar `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- [x] Instalar `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/keyboard`, `@capacitor/splash-screen`
- [x] `capacitor.config.ts` com `appId: com.dosyapp.dosy`
- [x] Scripts `build:android`, `open:android` em `package.json`
- [x] Instalar `@aparajita/capacitor-secure-storage`
- [x] Migrar Supabase `auth.storage` localStorage → SecureStorage (Android KeyStore)
- [x] `detectSessionInUrl: false` no Supabase client (apenas native)
- [x] Handler do botão Voltar Android em `App.jsx`
- [x] Reconexão Realtime em `useRealtime.js` (pause/resume)
- [x] `npx cap add android` + `npx cap sync android`
- [x] JDK 17 + JDK 21 (Temurin) + Android SDK
- [x] `JAVA_HOME` + `ANDROID_HOME` em variáveis de usuário
- [x] Testar app no emulador Android (Pixel 10 Pro)
- [x] Login/auth funcionando no Android (validado emulador 2026-04-26)
- [x] SSL Pinning em `network_security_config.xml` (Supabase, primary GTS WE1 + backup GTS Root R4)
- [x] Bloquear ADB backup (`allowBackup="false"` + `data_extraction_rules.xml`)
- [x] Testar app em dispositivo físico (FASE 1 device test concluído 2026-04-28)
- [ ] **NOTA:** Build CLI `gradlew.bat` quebra em Win11 24H2 (`Unable to establish loopback connection`). Workaround: Studio (JBR patched). CI: Linux runner.

---

## FASE 2 — Notificações FCM + LocalNotifications ✅ CONCLUÍDA

- [x] Projeto Firebase `dosy-b592e` + app Android registrado
- [x] `google-services.json` em `android/app/`
- [x] Instalar `@capacitor/push-notifications` + `@capacitor/local-notifications`
- [x] `usePushNotifications.js` com lógica `isNative`/web
- [x] Migration: colunas `deviceToken` + `platform` em `push_subscriptions`
- [x] Edge Function `notify-doses` com FCM HTTP v1 API + JWT OAuth
- [x] Secrets Firebase no Supabase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- [x] RPC `upsert_push_subscription` SECURITY DEFINER (cross-user device transfer)
- [x] UNIQUE constraint em `deviceToken`
- [x] Edge Function `send-test-push` (admin only)
- [x] Validação: LocalNotifications + push server-side FCM no Android
- [x] Notification channel `doses` criado (Android 8+ requer)
- [x] Multi-device test (push direcionado funciona)
- [x] Payload FCM correto (`priority: 'HIGH'`, `default_sound: true`)
- [x] Push notif device físico funcionando (FASE 2 device test concluído 2026-04-28)

---

## FASE 2.5 — Alarme Crítico Nativo ✅ CONCLUÍDA

> Push padrão toca som 1x e não bypassa silencioso/DND. App de medicação precisa **alarme do despertador**: tela cheia, som em loop até dismiss, ignora silencioso, mostra na lock screen. Plugin Android nativo custom.

- [x] Plugin Capacitor Android `CriticalAlarmPlugin` (Java)
- [x] `AlarmReceiver` (BroadcastReceiver disparado por AlarmManager)
- [x] `AlarmActivity` full-screen (FLAG_SHOW_WHEN_LOCKED + TURN_SCREEN_ON, MediaPlayer USAGE_ALARM loop, Ciente/Adiar 10min, vibração)
- [x] Permissões: `USE_FULL_SCREEN_INTENT`, `ACCESS_NOTIFICATION_POLICY`, `SYSTEM_ALERT_WINDOW`
- [x] Registrar plugin em `MainActivity.java`
- [x] Bridge JS: `src/services/criticalAlarm.js`
- [x] `AlarmService` foreground service (BAL workaround Android 14+)
- [x] Agrupamento doses mesmo horário (1 alarme único + lista, vs N simultâneos)
- [x] Modal queue (tap notif abre fila Ignorar/Pular/Tomada)
- [x] Tap notif tray → MainActivity → modal queue
- [x] Re-agendar alarmes após reboot (`BootReceiver` + BOOT_COMPLETED + LOCKED_BOOT_COMPLETED + MY_PACKAGE_REPLACED)
- [x] Testar device bloqueado → tela cheia + som (validado emulador 2026-04-27)
- [x] Testar app killed → alarme dispara fullscreen
- [ ] `dosy_alarm.mp3` custom em `res/raw/` (opcional, fallback usa default — pós-launch)
- [x] Testar device físico: locked + app killed + silenciado + adiar 10min (concluído 2026-04-28)
- [ ] Testar device físico: DND nativo Android (alarme bypass via `ACCESS_NOTIFICATION_POLICY`)
- [ ] Testar device físico: após reboot (BootReceiver re-agenda)
- [ ] Testar device físico: DND interno Dosy (janela 23:00-07:00 em Settings → alarme silencia, push notif passa)

---

## FASE 3 — Sistema Notificações Centralizado ✅ CONCLUÍDA

> Refator v1.0.5.5: toda lógica de scheduling, FCM, prefs, alarme, DND e resumo diário consolidada em `src/services/notifications.js` (single source of truth, ~430 linhas).

- [x] Criar `src/services/notifications.js` consolidado
- [x] Helpers puros: `loadPrefs`, `inDnd`, `groupByMinute`, `filterUpcoming`
- [x] `rescheduleAll({ doses, patients, prefsOverride })` idempotente
- [x] `cancelAll()` (alarms + local notifs)
- [x] `subscribeFcm()` / `unsubscribeFcm()` com perm + FCM register + persist token
- [x] React hook `useNotifications()` (state + callbacks)
- [x] `usePushNotifications.js` virou re-export shim
- [x] Regras hierárquicas: push (master) → criticalAlarm (sub) → DND (filtro alarm-only) → dailySummary (independente)
- [x] Toggle critical OFF cancela alarmes pendentes (era bug)
- [x] Push notif scheduled em paralelo com alarme (era bug)
- [x] Daily summary roda mesmo sem doses hoje (era bug Dashboard)
- [x] DND prefs: `dndEnabled`, `dndStart`, `dndEnd` (suporta wrap meia-noite)
- [x] Settings UI: section "Não perturbe" com toggle + 2 time pickers
- [x] AppHeader overdue badge: drop `to` cap, expand `from` 90d
- [x] Permissions onboarding re-aparece após update (storage versionado por APP_VERSION)

---

## FASE 4 — Polimento Nativo (parcial)

### 4.1 Export PDF/CSV ✅ CONCLUÍDA
- [x] Instalar `jspdf` + `html2canvas`
- [x] Substituir `window.print()` por jsPDF (native: html2canvas → jsPDF → Filesystem.Cache → Share)
- [x] Instalar `@capacitor/filesystem` + `@capacitor/share`
- [x] Adaptar export CSV para Android

### 4.2 Offline & Network ✅ CONCLUÍDA
- [x] Offline mutations + cache persistence (TanStack PersistQueryClient + retry exponential 3x)
- [x] Instalar `@capacitor/network`
- [x] `src/hooks/useOnlineStatus.js`

### 4.3 Ads ✅ CONCLUÍDA (parcial — AdSense web pendente IDs)
- [x] Instalar `@capacitor-community/admob`
- [x] `AdBanner.jsx` condicional AdSense (web) / AdMob (nativo)
- [x] AdMob singleton TOP_CENTER overlay
- [x] AdBanner in-flow em todas pages internas
- [x] **AdMob (Android native) ID real** `ca-app-pub-2350865861527931/2984960441` em `VITE_ADMOB_BANNER_ANDROID` (Vercel + .env)
- [ ] **AdSense (web) IDs reais** — `index.html` ainda tem placeholder `ca-pub-XXXXXXXXXXXXXXXX`. Falta:
  - Substituir publisher ID em `index.html` script tag
  - Setar `VITE_ADSENSE_CLIENT` (ca-pub-XXX) no Vercel
  - Setar `VITE_ADSENSE_SLOT` (ad unit ID) no Vercel
  - Sem isso, web mostra apenas placeholder "Publicidade · Espaço reservado"

### 4.4 Visual & UX ✅ CONCLUÍDA (rodada v1.0.5)
- [x] Design system centralizado em `src/styles/theme.css`
- [x] Tailwind config consume CSS vars
- [x] Border radius -30% global
- [x] Header padding +50%
- [x] Espaçamento card-to-card uniforme (4px)
- [x] Ícones flat lucide em ~25 componentes
- [x] PatientPicker dropdown searchable
- [x] Dark mode brand opacity bug fix (RGB triplet vars)
- [x] FilterBar sticky offset com safe-area
- [x] DoseCard refactor (outer wrapper assume border/radius/shadow)

### 4.5 StatusBar + Deep Links + Update Banner ✅ CONCLUÍDA
- [x] StatusBar dark `#0d1535` na inicialização
- [x] Deep links em AndroidManifest.xml
- [x] `useAppUpdate` hook + `UpdateBanner` component
- [x] Settings botão "Atualizar" com URL absoluta Vercel
- [x] UpdateBanner safe-top
- [x] Versão visível no BottomNav

### 4.6 Assets ícone & splash ✅ CONCLUÍDA
- [x] Criar `resources/icon.png` (1024×1024 RGBA)
- [x] Criar `resources/splash.png` (2732×2732 RGBA)
- [x] Criar `resources/icon-foreground.png` (1024×1024 RGBA, adaptive icon)
- [x] Executar `npx @capacitor/assets generate --android` — 86 assets gerados (mdpi→xxxhdpi + dark mode + landscape)

---

## FASE 5 — Auditorias Read-Only ✅ CONCLUÍDA

> Bateria de 7 auditorias estáticas. Sem mudanças de código. Geram docs em `docs/audits/` com gaps + recomendações priorizadas. Achados consolidados nas FASES 6-9 abaixo.

### 5.1 Código & arquitetura ✅
> [`docs/audits/Auditoria-4.5.1.md`](./docs/audits/Auditoria-4.5.1.md). Score 5.5/10. 17 gaps. Top: bundle 716KB sem code-split, ZERO testes, 12 vulns npm.

### 5.2 DB schema + RLS ✅
> [`docs/audits/Auditoria-4.5.2.md`](./docs/audits/Auditoria-4.5.2.md). Score 7/10. RLS sólido mas anon tem TODOS grants em 10/11 tabelas (P0 defense-in-depth).

### 5.3 UX & A11y ✅
> [`docs/audits/Auditoria-4.5.3.md`](./docs/audits/Auditoria-4.5.3.md). Score 4/10. ZERO `:focus-visible`, ZERO focus trap, 16 botões <44px, ~50 icon-buttons sem aria-label.

### 5.4 Segurança mobile ✅
> [`docs/audits/Auditoria-4.5.4.md`](./docs/audits/Auditoria-4.5.4.md). Score 6/10. **CRÍTICO:** `minifyEnabled false`, ZERO FLAG_SECURE em telas médicas, sem mask recents.

### 5.5 Performance ✅
> [`docs/audits/Auditoria-4.5.5.md`](./docs/audits/Auditoria-4.5.5.md). Score 4/10. jspdf+html2canvas 590KB eager, ZERO `React.lazy`, ZERO virtualização.

### 5.6 Tests & CI ✅
> [`docs/audits/Auditoria-4.5.6.md`](./docs/audits/Auditoria-4.5.6.md). Score 2/10. ZERO testes, sem ESLint/Prettier, CI sem lint+test+audit.

### 5.7 Observability ✅
> [`docs/audits/Auditoria-4.5.7.md`](./docs/audits/Auditoria-4.5.7.md). Score 5/10. Sentry integrado mas sem source maps, sem release tag, sem ErrorBoundary. ZERO PostHog.

**Validação FASE 5:** ✅ todas 7 auditorias rodadas. Achados se propagam pras FASES 6-9.

---

## FASE 6 — Migrations Versionadas (Supabase CLI) ✅ CONCLUÍDA

> Forward-only migrations via Management API (Docker dispensável). Baseline implícito documentado em `docs/audits/Auditoria-4.5.2.md`.

- [x] Supabase CLI 2.90 instalado (via Scoop, já estava)
- [x] `supabase init` rodado — `supabase/config.toml` criado, schema `medcontrol` adicionado
- [x] `supabase link --project-ref guefraaqbkcehofchnrc`
- [ ] ~~`supabase db pull`~~ — exige Docker Desktop ou DB password. Skipped (forward-only approach)
- [x] `docs/db-migrations.md` documenta fluxo + regras + 3 caminhos de aplicação
- [x] Pasta `supabase/migrations/` criada
- [x] Script `tools/apply-migration.cjs` — aplica .sql via Management API (sem Docker)
- [x] Regra documentada: ZERO edits diretos em prod schema daqui pra frente

**Validação 6:** ✅ infraestrutura migrations pronta. FASES 7+8 podem entrar via migrations versionadas em `supabase/migrations/`.

---

## FASE 7 — P0 Quick Wins ✅ CONCLUÍDA

### 7.1 DB defense-in-depth ✅
- [x] `20260428142412_revoke_anon_grants.sql` aplicada — anon agora 0 grants em medcontrol (Aud 5.2 G1)
- [x] `20260428142413_force_rls_user_prefs.sql` aplicada — FORCE_RLS em user_prefs (Aud 5.2 G2)
- [x] `20260428142414_drop_overload_create_treatment.sql` aplicada — overload V1 dropado (Aud 5.2 G4)
- [x] Verificação via `audit-db.cjs`: anon=0 grants, user_prefs.relforcerowsecurity=true, create_treatment_with_doses count=1

### 7.2 Build & bundle ✅
- [x] `minifyEnabled true` + `shrinkResources true` em `build.gradle` release (Aud 5.4 G1)
- [x] `proguard-rules.pro` reescrito com keep rules pra Capacitor + plugins + Sentry + Firebase + custom CriticalAlarm
- [x] Strip console.log/warn/info/debug via Terser `pure_funcs` em `vite.config.js` (Aud 5.1 G5). console.error preservado pra Sentry.
- [x] Bundle 716KB → 698KB (Terser + console strip)
- [ ] ~~`npm audit fix`~~ — 12 vulns persistem em devDeps (`@capacitor/assets` chain). Zero risco runtime, dev-only. Aceito.

### 7.3 Sentry ✅
- [x] `release: dosy@${__APP_VERSION__}` no Sentry init em `main.jsx` (Aud 5.7 G3)

### 7.4 A11y quick wins ✅
- [x] `:focus-visible` global em `index.css` com outline brand (Aud 5.3 G1)
- [x] `inputMode` em campos numéricos: TreatmentForm/PatientForm/SOS/Admin (numeric/decimal conforme campo) (Aud 5.3 G5)

**Validação 7:** ✅ DB integro defense-in-depth. APK release vai reduzir com ProGuard (validar pós Studio build). Build prod 698KB. Sentry events com release tag. Focus-visible visível em keyboard nav.

---

## FASE 8 — Hardening DB ✅ CONCLUÍDA (parcial — policies refinadas movidas pra 8.3 backlog)

### 8.1 CHECK constraints ✅
- [x] `20260428180000_check_constraints_treatments.sql` — `intervalHours > 0`, `durationDays > 0 AND <= 365`, length max em medName/unit (Aud 5.2 G6)
- [x] `20260428180001_check_constraints_doses.sql` — length max em medName/unit
- [x] `20260428180002_check_constraints_sos_rules.sql` — `minIntervalHours > 0`, `maxDosesIn24h > 0`, length em medName (G7)
- [x] `20260428180003_check_constraints_patients.sql` — length em name/condition/doctor/allergies, age 0-150, weight 0-1000kg (G8)
- [x] Verificação: doses=5 checks, patients=6, sos_rules=3, treatments=5

### 8.2 Triggers cross-FK ownership ✅
- [x] `20260428180004_trigger_dose_treatment_match.sql` — `validate_dose_treatment_match` BEFORE INSERT/UPDATE OF patientId/treatmentId (Aud 5.2 G5)
- [x] Pen test passou: tentativa de INSERT cross-patient via SQL bloqueada com ERRCODE 23514

### 8.3 Policies refinadas (movidas pra backlog — não-crítico após REVOKE FROM anon)
> Defense-in-depth já forte com FASE 7.1 (anon 0 grants). Itens abaixo são polish de explicitness/precision, P1/P2.
- [ ] Recriar policies com `TO authenticated` explícito (todas tabelas) (Aud 5.2 G3)
- [ ] Splitar `cmd=ALL` policies em 4 (push_subs, user_prefs, subscriptions admin, security_events admin) (Aud 5.2 G9)

### 8.4 Pen test interno ✅
- [x] Trigger validate_dose_treatment_match bloqueou cross-patient INSERT (ERRCODE 23514)
- [x] Trigger enforce_sos_via_rpc continua bloqueando type=sos direct INSERT (validado em FASE 0.3)
- [ ] (P2) Pen test completo user A → user B via API direta documentado em `docs/audits/pentest-interno.md`

**Validação 8:** ✅ CHECKs cobrem inputs malformados. Trigger valida cross-FK ownership. Policies refinadas em backlog (não-crítico).

---

## FASE 9 — Tests Setup ✅ CONCLUÍDA (parcial — integration/E2E em backlog)

### 9.1 Lint & format infra ✅
- [x] ESLint 9 (flat config) + plugin React + react-hooks 7 + Prettier 3 instalados
- [x] `eslint.config.js` (rules: react/react-hooks/refresh + customizações)
- [x] `.prettierrc` + `.prettierignore`
- [x] Scripts npm: `lint`, `lint:fix`, `format`, `format:check`
- [x] Lint output: 0 errors, 49 warnings (max=50 configurado)
- [ ] (opcional pós-launch) Husky + lint-staged pre-commit

### 9.2 Vitest setup ✅
- [x] Vitest 4.1 + Testing Library + jsdom + coverage-v8 instalados
- [x] `vitest.config.js` (jsdom env, setup file, coverage v8 com threshold em utils)
- [x] `vitest.setup.js` (mock Capacitor, polyfill localStorage)
- [x] Scripts npm: `test`, `test:watch`, `test:coverage`

### 9.3 Unit tests críticos ✅
- [x] `utils/dateUtils.test.js` — 28 tests (pad, formatDate, formatTime, relativeLabel, toDatetimeLocalInput, fromDatetimeLocalInput, rangeNow)
- [x] `utils/generateDoses.test.js` — 13 tests (mode=interval + mode=times, edge cases firstDoseTime/intervalHours/dailyTimes)
- [x] `utils/statusUtils.test.js` — 4 tests
- [x] `utils/tierUtils.test.js` — 3 tests
- [x] `services/dosesService.test.js` — 7 tests (validateSos: minInterval, maxIn24h, case-insensitive, only done counted, 24h window)
- [x] `services/notifications.test.js` — 12 tests (inDnd: window not-crossing-midnight, crossing-midnight, defaults, edge zero-length)
- [x] **Total: 66/66 passing.** Coverage utils: 88.46% lines, 100% generateDoses.

### 9.4 Integration tests (backlog — pós-launch)
- [ ] Hooks: `useDoses` com mock Supabase
- [ ] Hooks: `useUserPrefs` (DB sync + localStorage cache)

### 9.5 E2E (backlog — pós-launch ou Beta)
- [ ] Playwright setup
- [ ] Happy paths: login → dashboard → criar treatment / dose → confirm

### 9.6 CI integration ✅
- [x] `.github/workflows/ci.yml` atualizado: lint + test + audit + build + cap sync
- [x] `npm audit --audit-level=high` em CI (continue-on-error: devDeps Capacitor chain conhecida)

**Validação 9:** ✅ infra Vitest + ESLint funcional. 66 tests verdes. Coverage utils ≥88%. CI roda lint+test+build em todo PR. Integration/E2E em backlog (não-bloqueante pra Beta interno).

---

## FASE 10 — Quality Refactor ✅ CONCLUÍDA (parcial — Settings refactor adiado pra 15)

### 10.1 ErrorBoundary + source maps ✅
- [x] `src/components/ErrorBoundary.jsx` — captura crashes React tree, reporta Sentry, fallback amigável com Recarregar/Voltar Início (Aud 5.7 G2)
- [x] `<ErrorBoundary>` wrappando `<App />` em `main.jsx`
- [x] `@sentry/vite-plugin` em `vite.config.js` — upload source maps quando `SENTRY_AUTH_TOKEN+ORG+PROJECT` setados em CI (Aud 5.6 G4 / 5.7 G1)
- [x] `build.sourcemap: 'hidden'` em prod (gera maps mas não expõe ao client)
- [ ] Configurar SENTRY_AUTH_TOKEN/ORG/PROJECT como secrets em GitHub Actions (manual)

### 10.2 Code splitting & dynamic imports ✅
- [x] `vite.config.js` `manualChunks` separa: vendor-react, vendor-data (Supabase+TanStack), vendor-sentry, vendor-capacitor, vendor-icons, vendor (resto), jspdf+html2canvas+dompurify isolados em chunks próprios (Aud 5.5 G3)
- [x] `React.lazy` + `<Suspense>` em todas 18 pages do `App.jsx` com fallback `PageSkeleton` (Aud 5.5 G1)
- [x] `Reports.jsx` já usa `import('jspdf')` e `import('html2canvas')` dynamic (Aud 5.5 G2)
- [x] **Bundle main: 716KB → 64KB** (gzip 206KB → 20KB). Alvo ≤500KB superado (-91%)
- [x] Vendor chunks: react 206KB, data 234KB, vendor 220KB, sentry 11KB, capacitor 29KB
- [x] Reports route lazy: jspdf 340KB + html2canvas 199KB carregam só ao acessar /relatorios

### 10.3 Component refactor ✅ (parcial)
- [x] `React.memo` em `PatientCard`, `Icon` (Aud 5.5 G5)
- [x] `<img loading="lazy">` em `PatientCard` (Aud 5.5 G6)
- [ ] (movido pra FASE 15) Refatorar `Settings.jsx` (465 LOC) em sub-componentes — não-crítico, Settings funciona OK

**Validação 10:** ✅ bundle main 64KB (alvo ≤500KB). ErrorBoundary instalado. Source maps configurados (auth token CI pendente). Tests 66/66 passing. Lint 0 errors.

---

## FASE 11 — Mobile Security Hardening ✅ CONCLUÍDA (parcial — biometria UI + Play Integrity + root detection movidos pra FASE 23 backlog)

### 11.1 FLAG_SECURE + privacy mask ✅
- [x] Plugin `@capacitor-community/privacy-screen@8.0.0` instalado
- [x] Hook `usePrivacyScreen` em `src/hooks/usePrivacyScreen.js` — wrapper React idiomático
- [x] FLAG_SECURE ativo em telas com info médica (Aud 5.4 G2):
  - `DoseModal` (open=true → enabled)
  - `PatientDetail`
  - `Reports`
  - `DoseHistory`
- [x] Mask em recents view automático via plugin (Aud 5.4 G3)
- [x] ProGuard rules já validadas (FASE 7)

### 11.2 Network ✅ (parcial)
- [x] Cert pinning Supabase já ativo (FASE 1)
- [x] Cert pinning Vercel: `dosy-teal.vercel.app` adicionado em `network_security_config.xml` com CA validation (sem pin estrito — Vercel rotaciona LE certs frequente) (Aud 5.4 G5)
- [x] AdMob: prod ID via `VITE_ADMOB_BANNER_ANDROID` env (já configurado FASE 4)
- [ ] (movido pra FASE 23 backlog) Google Play Integrity API (Aud 5.4 G6) — não-crítico pra Beta

### 11.3 User-side security (infra criada, UI integration pendente)
- [x] Plugin `@aparajita/capacitor-biometric-auth@10.0.0` instalado (Capacitor 7+ compat)
- [x] Hook `useAppLock` em `src/hooks/useAppLock.js` — biometric unlock + auto-lock após N min bg (Aud 5.4 G7+G8)
- [ ] (movido pra FASE 12 ou 23) LockScreen UI + integração no `main.jsx` + toggle Settings — precisa device test antes de wire
- [ ] (movido pra FASE 23 backlog) Detecção root/jailbreak (Aud 5.4 G4) — plugin community não maintained pra Capacitor 8

**Validação 11:** ✅ APK release com obfuscação (FASE 7). Telas médicas com FLAG_SECURE. Cert pinning Supabase + Vercel. Biometria infra pronta (UI pendente). Build + tests verdes.

---

## FASE 12 — A11y Remediation ✅ CONCLUÍDA (parcial — forms/visual movidos pra 15)

### 12.1 Foco e navegação ✅
- [x] `focus-trap-react@latest` instalado
- [x] `BottomSheet` com `<FocusTrap>` cyclic Tab (Aud 5.3 G2). Suporta escape via clique fora + Esc key
- [x] Skip-to-content link em `App.jsx` — `sr-only` + `focus:not-sr-only` brand-colored (Aud 5.3 G9)
- [x] `<main id="main-content">` wrapper com aria target
- [x] `<nav aria-label="Navegação principal">` em BottomNav (Aud 5.3 G10)
- [x] `NavLink` do react-router já aplica `aria-current="page"` automaticamente quando ativo

### 12.2 Touch targets & labels ✅
- [x] Header back: `w-9 h-9` → `w-11 h-11` + `aria-label="Voltar"`
- [x] AppHeader settings: `w-9 h-9` → `w-11 h-11` + `aria-label="Ajustes"` (já tinha)
- [x] FilterBar funil: `w-10 h-10` → `w-11 h-11` + `aria-label="Abrir filtros"` (já tinha)
- [x] DoseHistory nav buttons: `w-8 h-8` → `w-11 h-11`
- [x] UpdateBanner close: `w-7 h-7` → `w-11 h-11` + `aria-label="Dispensar"` (já tinha)
- [x] BottomNav FAB: `aria-label="Novo (paciente ou tratamento)"`
- [x] BottomNav NavLinks: `aria-label={t.label}`

### 12.3 Forms & feedback (movido pra FASE 15 UX)
- [ ] Erros de validação inline em forms — escopo expandido, fica em FASE 15
- [ ] Skeleton screens completos — fica em FASE 15

### 12.4 Visual & typo (movido pra FASE 15 UX)
- [ ] Subir contraste textos secundários no dark mode
- [ ] Hierarquia headings revisão
- [ ] Dynamic Type via `rem`

**Validação 12:** ✅ Touch targets ≥44px nos botões críticos. FocusTrap em BottomSheet. Skip-to-content acessível via Tab. Build verde, 66/66 tests, lint 0 errors.

---

## FASE 13 — Performance Avançada ✅ CONCLUÍDA (parcial — virtualização + Lighthouse em backlog/FASE 17)

- [x] `rollup-plugin-visualizer` instalado em vite.config.js — gera `dist/stats.html` treemap após build prod
- [x] `@tanstack/react-virtual` instalado (infra pronta pra integração futura)
- [ ] (movido pra FASE 23 backlog) Virtualização em DoseHistory/Patients/TreatmentList — refactor grande, risco UX. Aplicar quando user real tiver listas grandes (>200 items)
- [ ] (movido pra FASE 17) Lighthouse baseline + alvo ≥90 mobile — manual em device real
- [ ] (movido pra FASE 17) Performance scroll lista 500 doses — manual

**Validação 13:** ✅ infra instrumentação pronta (stats.html + react-virtual). Métricas reais ficam pra validação FASE 17 device.

---

## FASE 14 — Observability Avançada ✅ CONCLUÍDA (parcial — Sentry alerts + dashboards manuais)

### 14.1 PostHog ✅
- [x] `posthog-js` instalado
- [x] `src/services/analytics.js` — wrapper com `initAnalytics`, `track`, `identifyUser`, `resetUser`, `getFeatureFlag`
- [x] `EVENTS` catalog (24 eventos): dose_*, alarm_*, paywall_*, patient_*, treatment_*, share_*, account_*, etc
- [x] LGPD: `sanitize_properties` strips PII (email/name/observation/medName/patientName/doctor/allergies/condition)
- [x] Session replay desabilitado (privacidade saúde)
- [x] Init em `main.jsx` (no-op se VITE_POSTHOG_KEY ausente ou modo dev)
- [x] `identifyUser(userId)` em `useAuth` após login (UUID anônimo)
- [x] `resetUser()` em logout
- [x] Eventos wired em pontos críticos:
  - Doses: confirm/skip/undo + sos register em useDoses (4 events)
  - Patients: create/delete em usePatients (2 events)
  - Treatments: create/delete em useTreatments (2 events)
  - Permissions: notification_permission_granted/denied em notifications.js (2 events)
  - Settings: critical_alarm_toggled, dnd_toggled (2 events)
  - Paywall: paywall_shown em PaywallModal (1 event)
- [x] `.env.example` com `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST`
- [ ] (manual) Criar conta PostHog + projeto + adicionar key em GitHub Secret `VITE_POSTHOG_KEY`
- [ ] (manual) Feature flags em PostHog UI (futuro)

### 14.2 Sentry alerting (manual em Sentry UI)
- [ ] (manual) Alertas em https://lhp-tech.sentry.io/alerts/rules/dosy/: crash spike, error threshold
- [ ] (opcional) Sentry Replay — pulado por privacidade saúde

### 14.3 Dashboards launch ✅
- [x] `docs/launch-metrics.md` — métricas-alvo, dashboards Sentry/PostHog/Android Vitals, eventos catalog, LGPD
- [x] Critérios saída Beta: crash-free ≥99.5%, ANR <0.5%, retention D7 ≥40%, NPS ≥7
- [ ] (manual) Criar dashboards customizados PostHog após primeiros eventos

**Validação 14:** ✅ infra analytics pronta (no-op sem key). Eventos críticos wired. PII LGPD-safe. Métricas documentadas. User adiciona PostHog key quando criar conta.

---

## FASE 15 — UX Refinements (P2) ✅ CONCLUÍDA (parcial — drag-sort + comprovantes movidos pra FASE 23 backlog)

- [x] Undo (5s) ao deletar paciente — `useUndoableDelete` hook + integrado em PatientForm
- [x] Undo (5s) ao deletar tratamento — integrado em TreatmentForm
- [x] Busca text-search em Histórico — input com Icon, filtra por medName/unit/observation case-insensitive
- [x] Mover backups md pra `docs/archive/` (Plan-detalhado-backup.md + Plan-pre-reorg-backup.md)
- [ ] (FASE 23 backlog) Confirmação dupla ao deletar batch (>10 itens) — não há fluxo batch atual
- [ ] (FASE 23 backlog) Sort configurável de pacientes (drag-and-drop) — refactor maior
- [ ] (FASE 23 backlog) Anexar comprovantes/imagens em doses — feature PRO, requer Supabase Storage
- [ ] (FASE 23 backlog) Avaliar remoção de `mockStore.js` (205 LOC, modo demo)
- [ ] (FASE 23 backlog) Skeleton screens completos: TreatmentList/Reports/Analytics/SOS/forms
- [ ] (FASE 23 backlog) Erros inline em forms (PatientForm/TreatmentForm/SOS/Settings)
- [ ] (FASE 23 backlog) Subir contraste textos secundários no dark
- [ ] (FASE 23 backlog) Hierarquia headings revisão + Dynamic Type via `rem`

---

## FASE 16 — Monetização Real (In-App Purchase) ⏸ ADIADA — pós-beta-aberto

> Decisão: Beta interno + fechado serão FREE pra todos (sem cobrança). Monetização ativa apenas quando rollout produção.

> **PROMO temporária ativa (sessão 30/abr/2026):** `getMyTier()` em `src/services/subscriptionService.js` converte `'free'` → `'plus'` automaticamente. Todos cadastros novos + free existing recebem Plus (features ilimitadas + ads ainda visíveis). **REVERTER ANTES DO LANÇAMENTO PRODUÇÃO:** trocar `return tier === 'free' ? 'plus' : tier` → `return tier`. Optional SQL trigger durável commented em chat. Pra DB ficar consistente com painel Admin, rodar SQL trigger Supabase SQL Editor:
> ```sql
> CREATE OR REPLACE FUNCTION medcontrol.handle_new_user_plus_promo()
> RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
> BEGIN
>   INSERT INTO medcontrol.subscriptions ("userId", tier, source)
>   VALUES (NEW.id, 'plus', 'beta_promo')
>   ON CONFLICT ("userId") DO NOTHING;
>   RETURN NEW;
> END; $$;
> DROP TRIGGER IF EXISTS on_auth_user_signup_plus ON auth.users;
> CREATE TRIGGER on_auth_user_signup_plus
>   AFTER INSERT ON auth.users
>   FOR EACH ROW EXECUTE FUNCTION medcontrol.handle_new_user_plus_promo();
> ```



### 16.1 Setup contas + produtos
- [ ] Criar conta RevenueCat
- [ ] Criar conta Google Play Console (USD 25)
- [ ] Criar produtos Play Console: `dosy_pro_monthly` (R$7,90) + `dosy_pro_yearly` (R$49,90)
- [ ] Conectar Play Console ao RevenueCat via chave de serviço
- [ ] Trial 7 dias do PRO (configurar Play Console)

### 16.2 Integração código
- [ ] Instalar `@revenuecat/purchases-capacitor`
- [ ] Criar `src/hooks/useInAppPurchase.js`
- [ ] Atualizar `PaywallModal.jsx` com botões compra reais
- [ ] Botão "Restaurar compras" (obrigatório Google Play)
- [ ] Edge Function `validate-purchase` (validar receipt Google Play)
- [ ] Webhook RevenueCat → Supabase para renovações/cancelamentos (opcional)

### 16.3 CTA permanente "Gerenciar plano"
- [ ] Seção **"Assinatura"** em `Settings.jsx`:
  - Free: card tier atual + botão "Conhecer PRO" → PaywallModal
  - PRO/Plus: card tier atual + data renovação + botões "Mudar plano" + "Cancelar" (deep link Play Store)
- [ ] Reforçar card de tier em `More.jsx` com CTA explícito
- [ ] Botão "Restaurar compras" na seção
- [ ] Link "Política de cobrança"
- [ ] Badge/banner sutil pra Free em pages-chave (quando hit limit)

### 16.4 Validação
- [ ] Fluxo de compra em sandbox Play Store
- [ ] Restauração de compra
- [ ] Cancelamento + renovação

**Validação 16:** fluxo completo testado em sandbox + 3 contas reais.

---

## FASE 17 — Validação Manual em Device Real (Pre-Beta Gate)

> **Checklist completo gerado em `docs/device-validation-checklist.md`** — 9 seções (Devices, A11y, Performance, Notif/Alarmes, Mobile security, Fluxos críticos, Edge cases, Battery, Update).
> Imprimir + executar quando 3 devices estiverem disponíveis.

> Última checagem antes de Beta interno. Catch UX/perf issues que static audit não pega. Vinda Aud 5.3 + 5.5 device validation.

### 17.1 Devices & versões
- [ ] 3 devices Android: baixo (Moto E ou similar), médio (Samsung A), top (Pixel) — versões 12, 13, 14
- [ ] Confirmar app instala via APK sideload em todos

### 17.2 A11y manual
- [ ] axe DevTools / Accessibility Scanner — confirmar WCAG AA
- [ ] TalkBack ativo: fluxos críticos navegáveis
- [ ] Modo escuro forçado, fonte aumentada (Dynamic Type)
- [ ] Contraste sob luz solar real

### 17.3 Performance
- [ ] Lighthouse mobile ≥90 (Reports, Dashboard)
- [ ] Performance scroll lista 200+ doses sem jank
- [ ] Teclado virtual não cobre submit
- [ ] Notch / dynamic island / safe-area inferior
- [ ] Pull-to-refresh
- [ ] Sem rede + 3G simulada (TanStack persistor offline)

### 17.4 Notificações & Alarmes
- [ ] Alarme dispara: locked, unlocked, app killed, DND mode
- [ ] DND respeitado (alarme silencia, push notif passa)
- [ ] Adiar 10min funciona
- [ ] Snooze nativo (FASE 2 carry-over)

### 17.5 Mobile security
- [ ] FLAG_SECURE: screenshot + recents view bloqueados nas telas sensíveis
- [ ] Biometria + auto-lock funcionais
- [ ] Detecção root: warning aparece em device rooted (testar via Magisk)

**Validação 17:** todos checks ✓ em 3 devices. Issues → backlog ou re-abrir sub-fase relevante. App pronto pra Beta interno.

---

## FASE 18 — Preparação Play Store

### 18.1 Documentos legais ✅ CONCLUÍDA
- [x] Política de Privacidade (`src/pages/Privacidade.jsx`)
- [x] Termos de Uso (`src/pages/Termos.jsx`)
- [x] Rotas `/privacidade` + `/termos` públicas

### 18.2 Play Console requirements ✅ CONCLUÍDA (parcial — 1 declaração pendente)
**App criado em 30/abr/2026** — App ID `4972201184307332877`, package `com.dosyapp.dosy`, conta pessoal "Dosy Med" (ID `6887515170724268248`)

- [x] App registrado no Play Console (Dosy, pt-BR, Grátis)
- [x] Política Privacidade URL: `https://dosy-teal.vercel.app/privacidade`
- [x] Anúncios declarado: SIM (AdMob)
- [x] Acesso de apps: credenciais teste (`teste02@teste.com / 123456`) declaradas
- [x] Classificações IARC (questionário completo, "Todos os Outros Tipos", todas Não)
- [x] Público-alvo: 18+ (Maiores de 18 anos)
- [x] Segurança dos dados: Nome+Email+IDs+Saúde+Logs falha+Diagnóstico+ID dispositivo, criptografia trânsito SIM, exclusão conta SIM via `dosy-teal.vercel.app/privacidade`
- [x] ID de publicidade: SIM, finalidade Publicidade ou marketing
- [x] Apps governamentais: NÃO
- [x] Recursos financeiros: NÃO
- [x] Apps de saúde: SIM, "Controle de medicamentos e tratamentos"
- [x] Intent tela cheia: Despertador (qualifica concessão prévia)
- [x] Alarmes exatos: Despertador
- [ ] **Permissões serviço primeiro plano** ⏳ PENDENTE — exige vídeo demo
  - Dosy usa `FOREGROUND_SERVICE_SPECIAL_USE` em `AlarmService.java:163` (alarme crítico de dose)
  - Console exige vídeo YouTube unlisted demonstrando uso (alarme tocando fullscreen com tela bloqueada)
  - Alternativa: refatorar pra `FOREGROUND_SERVICE_TYPE_DATA_SYNC` (não exige justificativa) — mas pode quebrar alarme em background
  - URL declaração: `app-content/foreground-services`

### 18.3 Keystore + signing ✅ CONCLUÍDA
- [x] `android/app/build.gradle` com signingConfig dual-source: lê `keystore.properties` PRIMEIRO, fallback env vars
- [x] Path resolver custom: relative path resolve relativo a `rootProject.projectDir` (android/), não app/. Antes resolveu errado e signing skip silente.
- [x] `.keystore` + `*.jks` + `keystore.properties` no `.gitignore`
- [x] Gerar keystore release final: `dosy-release.keystore` (RSA 2048, validity 10000 dias)
  - Subject: `CN=Luiz Henrique Almeida, OU=Dosy, O=Dosy, L=Volta Redonda, ST=Rio de Janeiro, C=BR`
  - Alias: `dosykey`
- [x] `android/keystore.properties` criado com creds (gitignored, sem BOM UTF-8)
- [ ] **Backup keystore em 3 locais seguros** ⚠️ MANUAL CRÍTICO antes de publicar
  - 1: password manager (1Password/Bitwarden) — keystore + senhas
  - 2: pendrive offline guardado fisicamente
  - 3: cloud cifrado (drive cifrado / pCloud Crypto)
  - **Perdeu = app morto no Play Store (não consegue mais publicar updates)**

### 18.4 Build AAB ✅ CONCLUÍDA
- [x] AAB release assinado: `android/app/release/app-release.aab` (build manual via Studio: Build → Generate Signed App Bundle)
- [x] Tamanho: 17.9 MB
- [x] Signing: v1 JAR + v2 (default AGP) verificado via `jarsigner -verify`
- [x] Capacitor sync executado (web assets copiados)
- [x] versionCode 14 / versionName 0.1.6.1 (último upload: promo Plus tier)
- [x] minifyEnabled true (ProGuard/R8)
- [x] shrinkResources true
- [x] **Histórico uploads Internal track:**
  - v0.1.6.0 (13) — primeiro upload, "Disponível pra testadores internos"
  - v0.1.6.1 (14) — fix loader export PDF/CSV/JSON + Plus tier promo + filename pattern + splash limpo

### 18.5 Assets de loja ✅ CONCLUÍDA (parcial)
- [x] **Android icons + splash** gerados via sharp custom script a partir de `resources/icon.png`, `splash.png`, `splash_icon.png`. Splash >100KB convertidos pra .webp
- [x] **Feature Graphic 1024×500** em `resources/feature-graphic.png` — uploaded Console
- [x] **Ícone 512×512** em `resources/icon-512.png` — uploaded Console (Detalhes app)
- [x] **Textos ficha** Console preenchidos (nome Dosy + breve 80c + completa 4000c) — salvos como rascunho
- [ ] **Screenshots phone 1080×1920** ⏳ PENDENTE — user vai retrabalhar
  - Existing em `resources/screenshots/01-14`. User quer regerar mais polidos
  - Mín 2 phone, máx 8. Pra qualificar promo: 4+ com 1080px+
  - Console exige 16:9 ou 9:16, 320-3840px cada lado
  - Telas: Dashboard, Pacientes, Tratamentos, Análises, Relatórios, S.O.S, Ajustes, DoseModal
- [ ] **Tablet 7"/10" screenshots** — opcional (asterisco mas Console aceita sem pra Internal/Closed)

### 18.6 Textos de loja ✅ CONCLUÍDA
- [x] Descrição curta (`docs/play-store/description-short.txt`)
- [x] Descrição longa (`docs/play-store/description-long.txt`)
- [x] Release notes template
- [x] App title
- [x] Whatsnew template pt-BR

### 18.7 Preços
- [ ] Configurar gratuito + PRO Mensal + PRO Anual em Play Console + RevenueCat

**Validação 18:** Play Console sem avisos, advogado revisou Termos + Política, AAB assinado pronto.

---

## FASE 18.4.5 — Hot-fixes pós-deploy (smoke tests Chrome MCP) ✅ CONCLUÍDA

> Bugs catados durante validação live em `dosy-teal.vercel.app` via Chrome MCP. Console limpo, fluxos básicos OK.

### Bugs identificados + fixes
- [x] **Sentry 403 Forbidden** — DSN no Vercel apontava project_id antigo (`4511299692855296`) de project deletado. Vercel env `VITE_SENTRY_DSN` atualizado para project ativo `4511299700129792`. `.env.production` re-puxado via `vercel env pull`.
- [x] **Sentry 503 + CORS spam** — `autoSessionTracking: true` (default) gerava 1 envelope/pageload, ingest devolvia 503 (rate-limit transitório), CORS error spam. Disabled `autoSessionTracking: false` + `sendClientReports: false` + `tracesSampleRate: 0`. Mantém só captureException pra erros reais.
- [x] **Supabase 406 Not Acceptable** — `getPatient(id).single()` disparava 406 (PGRST116) quando paciente recém-deletado mas hook ainda tinha id no cache. Trocado por `.maybeSingle()` (retorna `null` em 0 rows).
- [x] **RPC `extend_continuous_treatments` 404 (PGRST202)** — função sumiu do schema (migration perdida). Chamadas client-side comentadas em `Dashboard.jsx` (mount + handleRefresh). Imports `hasSupabase, supabase` removidos. pg_cron faz fallback diário. Backlog FASE 23.5: recriar função + reativar.
- [x] **DoseModal travado em undo race** — `await mutateAsync` bloqueava modal aberto se request lenta/abortada por cancelQueries do próximo onMutate. Trocado por `mutate` não-bloqueante; modal fecha imediato; optimistic update já cobre UI.
- [x] **Storm `net::ERR_FAILED` em sequência confirm→undo→skip→undo** — `refetchQueries` (eager) em `onSettled` de cada mutation cancelava request anterior e refazia, gerando centenas de logs. Trocado por `invalidateQueries({refetchType: 'active'})` (lazy).
- [x] **Paciente/Tratamento "morto" reaparece na lista pós-delete** — `usePatients`/`useTreatments` herdavam `staleTime: 0 + refetchOnMount: 'always'` global. Ao navegar pra `/pacientes` durante janela undo (5s), refetch trazia paciente do servidor (DELETE só roda em 5s). Setado `staleTime: 6_000 + refetchOnMount: false` em ambos.
- [x] **Scroll herdado entre rotas** — botão "+ Novo" ficava sob header ao navegar de tela com scroll. Adicionado `useEffect` no `App.jsx` que `window.scrollTo(0, 0)` em cada `location.pathname` change.

**Validação:** smoke test full (criar paciente → criar tratamento → marcar Tomada → marcar Pular → deletar tratamento → deletar paciente) executado via Chrome MCP. 0 erros console. Network limpo (sem 4xx/5xx exceto cache miss esperado).

---

## FASE 18.5 — FAQ + Suporte In-App (pre-beta) ✅ CONCLUÍDA

> Reduzir suporte 1-on-1 antes do Beta. Antecipar dúvidas comuns sobre funcionamento, alarme, permissões, planos.

### 18.5.1 Conteúdo
- [x] Levantar 35 perguntas previstas em 9 categorias
  - Primeiros passos · Alarme · Permissões · Doses · Compartilhar · Plano PRO · Privacidade · Sync · Bugs
- [x] Respostas concisas (3-5 linhas cada) em pt-BR
- [ ] Revisar com advogado as respostas sobre privacidade/saúde (deferred — pre-launch)
- [x] Salvar em `src/data/faq.js` como array `[{ id, category, question, answer, keywords }]` + helper `searchFaq()` com normalização (lowercase + sem acento)

### 18.5.2 UI in-app
- [x] Criar página `src/pages/FAQ.jsx`:
  - Search box (filtra question + answer + keywords + categoria)
  - Chips de categoria (sticky scroll horizontal)
  - Lista agrupada por categoria, accordion expandable (chevron rotaciona)
  - Empty state com CTA "Falar com suporte" (mailto)
- [x] Rota `/faq` em `App.jsx` (lazy + acessível pre-login também)
- [x] Item "Ajuda / FAQ" em `More.jsx` (após "Ajustes")
- [x] Botão "Dúvidas frequentes" no `Settings.jsx` (seção Versão)
- [ ] Link "Ver FAQ" no header da `PermissionsOnboarding` (deferred — opcional)
- [x] Eventos PostHog: `faq_opened`, `faq_search_query` (debounce 800ms), `faq_question_expanded`, `faq_support_email_clicked`

### 18.5.3 Onboarding hint
- [ ] Slide adicional no `OnboardingTour` apontando pra FAQ (deferred — opcional pós-Beta)

### 18.5.4 Suporte fallback
- [x] Email reservado: `suporte@dosyapp.com` (configurar caixa real antes do Beta)
- [x] Botão "Falar com suporte" abre `mailto:` com subject + body pré-preenchidos (versão app + plataforma + UA)
- [x] SLA documentada em `docs/support-sla.md` (Free 72h · PRO 24h · Plus 12h, severidades S1-S4)

**Validação 18.5:** ✅ 35 perguntas respondendo. Search funcional. Acessível de 2 entry-points (More + Settings). Email suporte com template. Build OK (FAQ chunk 19.4KB / gzip 7.5KB). 66/66 tests pass. 0 lint errors.

**Pendente pre-Beta:** revisar respostas com advogado · provisionar caixa `suporte@dosyapp.com` · testar mailto em device real Android.

---

## FASE 18.9 — Pendências Console pra desbloquear Closed/Open Testing

> Sessão 30/abr/2026: Internal testing já live (FASE 19.1 ✅). Pendências antes de Closed/Open Testing pra cumprir requisito Google "12 testers × 14 dias" antes de Produção.

### 18.9.1 Vídeo demo FOREGROUND_SERVICE_SPECIAL_USE
- [ ] Gravar vídeo ~30s demonstrando alarme crítico de dose:
  - Abrir Dosy → criar tratamento dose horário próximo
  - Bloquear telefone / app em background
  - Aguardar alarme disparar fullscreen sobre lockscreen
  - Marcar Tomada/Pulada
- [ ] Subir YouTube unlisted
- [ ] Console → `Conteúdo do app` → `Permissões de serviço em primeiro plano` → marcar "Outro" + colar URL vídeo + descrição uso
- [ ] Alternativa custosa: refatorar `AlarmService.java` pra `FOREGROUND_SERVICE_TYPE_DATA_SYNC` ou outro tipo que não exige justificativa (risk: alarme pode ser killed em background)

### 18.9.2 Screenshots phone retrabalho
- [ ] User vai regerar 2-8 screenshots polidos (1080×1920 PNG)
- [ ] Subir Console → `Detalhes do app` → `Capturas de tela do telefone`
- [ ] Para qualificar promo Play: 4+ com 1080px+
- [ ] Telas sugeridas: Dashboard com doses, Pacientes lista, Tratamentos, Relatórios PDF, S.O.S, Análises, Ajustes, DoseModal aberto

### 18.9.3 Closed Testing track + 12 testers via Reddit (caminho pra Produção)
**Regra Google 2024:** contas pessoais novas precisam **12 testers × 14 dias em Closed Testing** antes de publicar Open/Produção.

- [ ] Promover versão atual (0.1.6.1) pra Closed Testing track
  - URL: `play.google.com/console/u/0/developers/6887515170724268248/app/4972201184307332877/closed-testing`
- [ ] Criar Google Group público pra testers ("dosy-beta-testers@googlegroups.com" ou similar) — qualquer pessoa pode entrar
- [ ] Adicionar Group como tester list no Closed track
- [ ] Pegar URL opt-in público gerado pelo Console
- [ ] Posts Reddit (templates em `docs/launch-posts.md`):
  - r/AndroidBeta
  - r/brasil ou r/financasbr (subreddit BR)
  - BetaList submission
- [ ] Aguardar 14 dias com 12+ testers ativos
- [ ] Após 14 dias: solicitar acesso Produção via Console (pré-requisito mostra contagem ao vivo)

### 18.9.4 Após Produção destravada → Open Testing público
- [ ] Configurar Open Testing track com mesma versão
- [ ] Submit pra revisão Google (1-3 dias)
- [ ] Após aprovado: link público Play Store pra Reddit/redes/site

---

# PARTE II — TESTERS

## FASE 19 — Beta Interno (testers conhecidos)

> **Templates prontos:**
> - `docs/beta-feedback-form.md` — spec Google Form com 20 perguntas (NPS + uso real + bugs + UX + features faltando + plano PRO)
> - `docs/launch-posts.md` — 3 posts passivos prontos (Reddit r/AndroidBeta, BetaList, AlternativeTo) — postar 1x cada após Open Testing live
> - `docs/play-store/seo-metadata.md` — keywords-alvo Brasil, title/short-desc otimizados, classificação IARC, ASO checklist

### 19.1 Preparação ✅ CONCLUÍDA
- [x] Lista 2 testers: `lhenrique.pda@gmail.com` + `daffiny.estevam@gmail.com` (lista "Dosy Testers" no Console — editável depois)
- [x] Internal Testing track ativo no Play Console
- [x] Versão `0.1.6.1 (14)` publicada no track
- [x] **URL opt-in interno:** `https://play.google.com/apps/internaltest/4700769831647466031`
  - Cada tester abre URL no celular logado com Gmail correspondente → "Become a tester" → instala via Play Store

### 19.2 Distribuição
- [x] Convite via Play Store (URL opt-in pronta)
- [ ] Onboarding em vídeo para testers
- [ ] Canal Telegram/WhatsApp pra feedback
- [ ] Formulário Google estruturado (bugs, sugestões, NPS) — spec em `docs/beta-feedback-form.md`

### 19.3 Coleta
- [ ] Sentry capturando crashes (já config FASE 10)
- [ ] PostHog registrando eventos (já config FASE 14)
- [ ] Reuniões semanais com 2-3 testers
- [ ] Iteração rápida (release a cada 3-5 dias)

### 19.4 Critérios de saída
- [ ] Zero crashes nos últimos 7 dias
- [ ] NPS médio ≥ 7
- [ ] 100% bugs P0/P1 resolvidos
- [ ] Pelo menos 1 ciclo completo testado por tester

---

## FASE 20 — Beta Fechado + Pen Test Profissional

### 20.1 Recrutamento
- [ ] Contratar 1-2 QAs profissionais (freelancer ou agência)
- [ ] Brief com escopo, fluxos críticos, áreas de risco
- [ ] **Contratar pen tester** pra auditoria de segurança específica
- [ ] Definir prazo (1-2 semanas)

### 20.2 Plano de teste
- [ ] Test cases documentados (Notion/TestRail)
- [ ] Matriz devices: 5 marcas, 3 versões Android (12, 13, 14)
- [ ] Cenários stress (1000 doses, 50 tratamentos)
- [ ] Cenários falha (sem rede, rede lenta, bateria fraca)
- [ ] A11y (TalkBack ativo)

### 20.3 Pen test profissional
- [ ] OWASP Mobile Top 10 cobertos
- [ ] Tentativa bypass RLS via API direta
- [ ] Tentativa tampering APK (Play Integrity ativo da FASE 11)
- [ ] Análise tráfego (Burp/mitmproxy) — cert pinning ativo
- [ ] Relatório com severidades (crit/high/med/low)

### 20.4 Correções
- [ ] Triage com prioridades
- [ ] Fix de tudo crit/high antes de avançar
- [ ] Re-teste das correções
- [ ] Documentar issues aceitos como "won't fix"

**Validação 20:** zero crit/high abertos, relatório pen test aprovado.

---

## FASE 21 — Beta Aberto (Play Store Closed/Open Testing)

### 21.1 Setup
- [ ] Closed Testing track com até 100 testers (config detalhada em FASE 18.9.3)
- [ ] Open Testing depois de estável (FASE 18.9.4)
- [ ] Versão `1.0.0-beta.x`
- [ ] Página "junte-se ao beta" no site

### 21.2 Recrutamento testers
- [ ] Post Reddit r/financasbr ou r/brasil
- [ ] Influencer saúde/medicação (parceria)
- [ ] Lista email de interessados
- [ ] Meta: 50-200 testers ativos

### 21.3 Monitoramento
- [ ] Dashboards crash rate, ANR rate, retention D1/D7/D30 (já config FASE 14)
- [ ] Alertas Sentry para regressões
- [ ] Reviews diárias do feedback
- [ ] Hotfixes em <48h pra bugs críticos

### 21.4 Critérios de saída
- [ ] Crash-free rate ≥99.5%
- [ ] ANR rate <0.5%
- [ ] Retention D7 ≥40%
- [ ] Avaliação média (beta) ≥4.3
- [ ] Pelo menos 50 testers ativos por 14 dias

---

# PARTE III — DEPLOY & PÓS-LAUNCH

## FASE 22 — Lançamento Público

### 22.1 Pré-lançamento
- [ ] Versão `1.0.0` final, build assinado
- [ ] Rollout gradual: 5% → 20% → 50% → 100% (a cada 24h se sem regressão)
- [ ] Página Play Store finalizada (screenshots, vídeo, descrição SEO)
- [ ] ASO (App Store Optimization): keywords título/subtítulo/descrição
- [ ] Press kit (logo, screenshots, descrição, contato)

### 22.2 Marketing
- [ ] Site oficial publicado (landing + blog + suporte)
- [ ] Posts redes sociais (Instagram, Twitter, LinkedIn)
- [ ] Email pra lista de interessados
- [ ] Product Hunt launch
- [ ] Indicação 3-5 sites/canais tech ou saúde

### 22.3 Programa de indicação
- [ ] User ganha 1 mês PRO grátis ao indicar 3 amigos que se cadastram
- [ ] Tracking UTMs pra medir canais

### 22.4 Suporte 24/48h
- [ ] Time de plantão na primeira semana
- [ ] Templates de resposta prontos
- [ ] FAQ atualizado com perguntas novas

**Validação 22:** primeira semana sem incidentes críticos, instalações dentro da meta.

---

## FASE 23 — Pós-launch & Operação

### 23.1 Monitoramento contínuo
- [ ] Dashboards saúde (DAU, MAU, retention, churn, ARPU)
- [ ] Funil conversão Free → PRO
- [ ] Crash rate semanal revisado
- [ ] Feedback in-app categorizado

### 23.2 Iteração
- [ ] Sprint quinzenal com priorização baseada em dados
- [ ] A/B test de paywall e onboarding
- [ ] Releases regulares (bi-semanal mínimo)

### 23.3 Crescimento
- [ ] Análise dos competidores
- [ ] Roadmap público
- [ ] Comunidade (Discord/Telegram)
- [ ] Programa afiliados (5-10% recorrente)

### 23.4 Operações de segurança
- [ ] Pen test anual obrigatório
- [ ] Review trimestral RLS + Edge Functions
- [ ] Atualização mensal de dependências
- [ ] Drill anual de disaster recovery

### 23.5 Backlog pós-launch (vinda das auditorias 5.X — P3)
- [ ] **Recriar RPC `extend_continuous_treatments(p_days_ahead int)`** — função sumiu do schema (PGRST202 404). Chamada client-side desabilitada em `Dashboard.jsx` (mount + handleRefresh). pg_cron faz fallback diário. Quando criar: assinatura `(p_days_ahead int) returns json` com `{dosesAdded, treatmentsExtended}`. Testar com user contínuo ativo. Reativar chamadas no Dashboard.
- [ ] Audit_log abrangente (triggers em UPDATE/DELETE de doses/treatments/patients) (Aud 5.2 G12)
- [ ] 2FA opcional via TOTP (Aud 5.4 G10)
- [ ] Criptografia client-side de `observation` (Aud 5.4 G11)
- [ ] Logout remoto multi-device + tela "Dispositivos conectados" (Aud 5.4 G9)
- [ ] Notif email + push ao login em device novo
- [ ] Session replay (Sentry Replay ou PostHog) (Aud 5.7 G8)
- [ ] Tracing distributed (Aud 5.7 G10)
- [ ] Logs estruturados Logflare/Axiom (Aud 5.7 G11)
- [ ] Visual regression tests (Chromatic/Percy) (Aud 5.6 G9)
- [ ] Performance budget em CI (size-limit/bundlesize) (Aud 5.6 G10)
- [ ] TypeScript migration (ou JSDoc + `tsc --checkJs`) (Aud 5.1 G10)
- [ ] `dosy_alarm.mp3` custom sound

### 23.6 Expansão
- [ ] iOS via Capacitor (mesmo código)
- [ ] Internacionalização (en, es) se demanda confirmar
- [ ] Plano Family (até 5 usuários compartilhando)
- [ ] API pública para integrações (apenas PRO)

### 23.7 DosyMonitorService — confiabilidade alarmes em OEMs hostis (POST OPEN TESTING)

> **Contexto:** Sem service em background, OEMs como Xiaomi MIUI, Huawei EMUI, OPPO ColorOS, OnePlus OxygenOS matam app idle e podem cancelar alarms agendados via `setAlarmClock`. ~30% Android BR afetado. Sintoma: user reporta "alarme não tocou" mesmo com permissões corretas.
>
> **Escopo desta fase (sem notification persistente):**
> - Service silent rodando em background pra:
>   - Re-agendar alarms cancelados por OEM agressivo
>   - Sync periódico Supabase → puxar novas doses sem app aberto
>   - Health-check permissões (alarme exato, full-screen intent ainda granted)
> - Sem foreground notification visível pro user
> - Triggered por boot + abertura app + WorkManager periodic
>
> **Decisão técnica (Android 12+):**
> Android 12+ EXIGE foreground services terem notification visible. Não é possível service permanente totalmente silent. Caminhos:
> - **Opção A — WorkManager periodic 15min:** sem foreground, sem notification. Funciona em stock Android, ainda pode falhar em OEMs muito agressivos (Xiaomi MIUI 13+ kills workers). Battery cost mínimo.
> - **Opção B — Foreground service com notification PRIORITY_MIN + silent + low importance channel:** notification existe mas usuário nem vê (oculta no badge da barra). User pode "Ocultar notificação" via long-press canal. Tradeoff aceitável.
> - **Opção C — Hybrid:** WorkManager default + ativar foreground service apenas quando detectar alarm prestes a disparar (próximas 24h).
>
> **Recomendação inicial:** Opção A (WorkManager). Avaliar feedback Open Testing — se usuários Xiaomi/OnePlus reportarem alarms missing, escalar pra Opção C.
>
> **Tarefas:**
- [ ] Implementar `DosyMonitorWorker` com `WorkManager.enqueueUniquePeriodicWork(15min, KEEP)`
- [ ] Lógica re-schedule: ler `dosy_critical_alarms` SharedPreferences + verificar via AlarmManager se ainda ativos; recriar se missing
- [ ] Sync Supabase: query doses 24h ahead, agendar alarms novos
- [ ] Schedule worker em: `MainActivity.onCreate`, `BootReceiver`, após login bem-sucedido
- [ ] Toggle Ajustes "Modo confiável" (default ON) — desabilita worker se user prefere
- [ ] Telemetria PostHog: evento `worker_run`, `alarm_re_scheduled` pra medir frequência re-spawn
- [ ] Testar matriz: Pixel (stock), Xiaomi Redmi (MIUI), Samsung A14 (One UI battery saver ON)
- [ ] Documentar workaround usuário Xiaomi: "Auto-start" + "Background activity" devem ser ativados manualmente

---

## STATUS GERAL

- **Total de fases:** 23 (mais Fase 0)
- **Concluídas (✅):** Fase 0, 1, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11 (algumas parciais com remediações em backlog)
- **Próxima:** Fase 12 (A11y Remediation) → 13 (Perf Avançada) → 14 (Observability+) → 15 (UX) → 16 (Monetização) → 17 (Device Validation) → 18 (Play Store) → 19 Beta Interno
- **Estimativa restante até launch:** ~2-4 meses
- **Versão atual:** 0.1.5.7 (dev — pre-1.0). v1.0 reservada pra Play Store launch.

### Métricas atuais (snapshot)
- Bundle main: **64KB** gzip 20KB (era 716KB → -91%)
- APK release: **10.4MB** (era 12.3MB → -15% via ProGuard)
- Tests: **66/66 passing** · coverage utils 88%
- Lint: **0 errors**, 49 warnings (max=50)
- DB: 11 tabelas RLS+FORCE_RLS · 33 indexes · 5 triggers integridade · anon 0 grants
- 8 migrations DB versionadas em `supabase/migrations/`
- 7 docs auditoria em `docs/audits/`
- Sentry source maps live (release `dosy@0.1.5.7`)
- FLAG_SECURE ativo em DoseModal/PatientDetail/Reports/DoseHistory

## Riscos Críticos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Google rejeitar app (categoria saúde) | Média | Alto | Política privacidade robusta + não mencionar diagnóstico médico |
| Vazamento dados (LGPD) | Baixa | Crítico | RLS completo, CSP, sanitização, sem secrets no frontend |
| Multa LGPD por falta consentimento | Média | Alto | Checkbox consentimento, política publicada |
| Keystore perdido/corrompido | Baixa | Crítico | Backup em 3 locais seguros (FASE 18.3) |
| Push FCM falhar background | Média | Médio | LocalNotifications + CriticalAlarm fallback |
| RevenueCat billing error | Baixa | Alto | Testar extensivamente sandbox (FASE 16) |
| `admin_grant_tier` chamado por user malicioso | **Mitigado** | **Crítico** | RPC verifica `is_admin()` server-side ✅ |
| Bypass regras SOS via requisição direta | **Mitigado** | Alto | RPC `register_sos_dose` + trigger bloqueia INSERT direto ✅ |
| DoS via `durationDays` enorme → 100k doses | **Mitigado** | Alto | RPC valida limite 365 dias ✅ |
| Dados órfãos por DELETE parcial | **Mitigado** | Médio | FK ON DELETE CASCADE ✅ |
| Anon role tem grants em 10/11 tabelas | **Mitigado** | Crítico | FASE 7.1 — REVOKE ALL FROM anon aplicado em 10/11 tabelas ✅ |
| Cross-FK ownership (dose↔treatment mismatch) | **Mitigado** | Médio | FASE 8.2 — trigger `validate_dose_treatment_match` BEFORE INSERT/UPDATE ✅ |
| Inputs malformados (length, range numérico) | **Mitigado** | Médio | FASE 8.1 — CHECK constraints em treatments/doses/sos_rules/patients ✅ |
| `minifyEnabled false` permite reverse-engineering | **Mitigado** | Alto | FASE 7.2 — ProGuard/R8 ativo + custom keep rules. APK 12.3MB → 10.4MB ✅ |
| FLAG_SECURE ausente — info médica vaza recents | **Mitigado** | Alto | FASE 11.1 — FLAG_SECURE em DoseModal/PatientDetail/Reports/DoseHistory via plugin privacy-screen ✅ |
| Sem testes — refactors arriscados | **Mitigado** | Crítico | FASE 9 — Vitest 66 tests + ESLint + CI lint+test+audit. Coverage utils 88% ✅ |
| Sem source maps — crashes prod inúteis | **Mitigado** | Alto | FASE 10.1 — @sentry/vite-plugin upload + release tag `dosy@0.1.5.7` em CI ✅ |
| Sem ErrorBoundary — white screen em crash React | **Mitigado** | Alto | FASE 10.1 — ErrorBoundary global com Sentry capture + fallback amigável ✅ |
| Bundle 716KB main bloqueia time-to-interactive 3G | **Mitigado** | Alto | FASE 10.2 — code splitting React.lazy + manualChunks → main 64KB ✅ |
| Cleartext HTTP em domínios não-pinned | **Mitigado** | Médio | FASE 11.2 — network_security_config bloqueia cleartext + cert pinning Supabase + Vercel ✅ |
| `:focus-visible` ausente — A11y keyboard nav | **Mitigado** | Médio | FASE 7.4 — outline brand global em theme.css ✅ |
| Supabase auth token expirar offline | Média | Médio | `autoRefreshToken: true` + redirect Login |
| Permissões especiais Android (full-screen, overlay) resetam após install | Média | Médio | PermissionsOnboarding re-aparece após APP_VERSION change ✅ |
| Touch targets <44×44px — A11y mobile fail | **Pendente** | Médio | FASE 12 — audit + bump pra w-11 h-11 mínimo |
| ARIA labels ausentes em ~50 botões só-ícone | **Pendente** | Médio | FASE 12 — adicionar one-by-one |
| Trap de foco ausente em modais | **Pendente** | Médio | FASE 12 — focus-trap-react em BottomSheet |
| Listas longas sem virtualização (200+ doses) | **Pendente** | Baixo | FASE 13 — `@tanstack/react-virtual` |
| Sem PostHog — voar cego no launch (sem retention/funnel) | **Pendente** | Alto | FASE 14 — eventos custom + dashboards |
| Sem Play Integrity — APK modificado pode instalar | **Pendente** | Médio | FASE 23 backlog (não-crítico Beta) |
| Sem biometria opcional — saúde sensível sem 2nd factor | **Pendente** | Médio | FASE 23 backlog (infra pronta `useAppLock`) |
| Sem detecção root/jailbreak | **Pendente** | Baixo | FASE 23 backlog (plugin não maintained Capacitor 8) |
