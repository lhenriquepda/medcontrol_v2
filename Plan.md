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

### 4.3 Ads ✅ CONCLUÍDA
- [x] Instalar `@capacitor-community/admob`
- [x] `AdBanner.jsx` condicional AdSense (web) / AdMob (nativo)
- [x] AdMob singleton TOP_CENTER overlay
- [x] AdBanner in-flow em todas pages internas

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

## FASE 11 — Mobile Security Hardening

> Após quality refactor estável. Vinda Aud 5.4.

### 11.1 ProGuard + screens
- [ ] Validar/escrever `proguard-rules.pro` (Capacitor + Sentry + Supabase keep rules) — testar APK release pós-minify
- [ ] FLAG_SECURE em telas sensíveis: `DoseModal`, `PatientDetail`, `Reports`, `DoseHistory` (Aud 5.4 G2)
  - Implementação: hook `useFlagSecure()` + plugin Capacitor custom OR `@capacitor-community/privacy-screen`
- [ ] Plugin privacy-screen / nativo: mask em recents view (G3)

### 11.2 Network & integrity
- [ ] Cert pinning `dosy-teal.vercel.app` em `network_security_config.xml` (G5)
- [ ] Google Play Integrity API (`@capgo/capacitor-play-integrity` ou nativo) (G6)
- [ ] AdMob: confirmar prod ID via env, remover hardcoded test ID fallback do bundle prod (G13)

### 11.3 User-side security
- [ ] Detecção root/jailbreak: plugin `capacitor-jailbreak-root-detection` + warn user (G4)
- [ ] Biometria opcional pra abrir app: `@capacitor-community/native-biometric` + toggle Settings (G7)
- [ ] Auto-lock após N min em background — re-autenticar via biometria/senha (G8)

**Validação 11:** APK release com obfuscação. Telas médicas não vazam screenshot. Device rooted = warning. Biometria opcional funcional.

---

## FASE 12 — A11y Remediation

> WCAG AA compliance. Vinda Aud 5.3.

### 12.1 Foco e navegação
- [ ] Trap de foco em `BottomSheet` (cyclic Tab) — `focus-trap-react` ou implementação custom (Aud 5.3 G2)
- [ ] Skip-to-content link no `<main>` (G9)
- [ ] `aria-current="page"` em BottomNav active (G10)

### 12.2 Touch targets & labels
- [ ] Touch targets <44×44px → aumentar em Header back-btn, FilterBar funil, DoseHistory nav, AppHeader settings, UpdateBanner close (G3)
- [ ] `aria-label` em ~50 botões só-ícone (audit visual + adicionar one-by-one) (G4)

### 12.3 Forms & feedback
- [ ] Erros de validação inline próximos ao campo em forms (PatientForm, TreatmentForm, SOS, Settings name update) (G6)
- [ ] Skeleton screens completos: TreatmentList, Reports, Analytics, SOS, PatientForm, TreatmentForm (G7)

### 12.4 Visual & typo
- [ ] Subir contraste textos secundários no dark mode (audit com axe DevTools) (G8)
- [ ] Hierarquia headings: h1 único por page, h2/h3 sub
- [ ] Suportar Dynamic Type: usar `rem` em vez de `px` onde possível (G12)

**Validação 12:** axe DevTools passa WCAG AA. TalkBack: fluxos críticos navegáveis. Tab + Enter funciona em todos modais.

---

## FASE 13 — Performance Avançada

> Após code splitting básico (FASE 10). Vinda Aud 5.5.

- [ ] Bundle analyzer (`rollup-plugin-visualizer`) — relatório de chunks
- [ ] Virtualização listas longas (`@tanstack/react-virtual`) em `DoseHistory`, `Patients`, `TreatmentList` (Aud 5.5 G4)
- [ ] Lighthouse score baseline + alvo ≥90 mobile

**Validação 13:** Lighthouse mobile ≥90. 60fps scroll em 500 doses. Time-to-interactive ≤3s em 3G simulado.

---

## FASE 14 — Observability Avançada

> Voar com instrumentos antes de Beta. Vinda Aud 5.7.

### 14.1 PostHog
- [ ] PostHog SDK web + native (`posthog-js` + capacitor wrapper)
- [ ] Eventos custom críticos:
  - `dose_confirmed`, `dose_skipped`, `dose_overdue_dismissed`
  - `alarm_fired`, `alarm_dismissed`, `alarm_snoozed`
  - `notification_permission_granted/denied`
  - `paywall_shown`, `paywall_clicked_plan`, `upgrade_complete`, `upgrade_failed`
  - `share_patient_invite_sent/accepted`
  - `treatment_created`, `patient_created`, `account_deleted`
- [ ] Funil paywall: view → click → checkout_started → success/failure
- [ ] Feature flags via PostHog

### 14.2 Sentry alerting
- [ ] Alertas: crash spike, error rate threshold, Edge Function failures
- [ ] (opcional) Sentry Replay pra debug visual

### 14.3 Dashboards launch
- [ ] DAU, MAU, retention D1/D7/D30
- [ ] Crash-free rate (alvo ≥99.5%)
- [ ] ANR rate via Android Vitals export (alvo <0.5%)
- [ ] Critical alarm enabled rate
- [ ] Onboarding completion rate
- [ ] Documentar métricas-alvo em `docs/launch-metrics.md`

**Validação 14:** dashboards live. Eventos chegando. Alertas configurados. Pronto pra observar Beta.

---

## FASE 15 — UX Refinements (P2)

> Não bloqueia launch mas eleva produto. Pode ir em paralelo com FASE 14 ou pós-Beta.

- [ ] Undo (5s) ao deletar paciente/tratamento (Dosy tem em doses só)
- [ ] Busca text-search dentro de Histórico
- [ ] Confirmação dupla ao deletar batch (>10 itens)
- [ ] Sort configurável de pacientes (drag-and-drop ou ordem manual)
- [ ] Anexar comprovantes/imagens em doses (foto da medicação) — feature PRO
- [ ] Avaliar remoção de `mockStore.js` (205 LOC, modo demo) ou lazy-load
- [ ] Mover `Plan-detalhado-backup.md` + `Plan-pre-reorg-backup.md` pra `docs/archive/`

---

## FASE 16 — Monetização Real (In-App Purchase)

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

### 18.2 Play Console requirements
- [ ] Preencher questionário IARC no Play Console
- [ ] Preencher declaração de saúde
- [ ] Data Safety section preenchida
- [ ] Classificação etária

### 18.3 Keystore + signing ✅ CONCLUÍDA (parcial)
- [x] `android/app/build.gradle` com signingConfig env-based
- [x] `.keystore` + `*.jks` no `.gitignore`
- [ ] Gerar keystore release final ⚠️ MANUAL CRÍTICO
- [ ] Backup keystore em 3 locais seguros

### 18.4 Build AAB
- [ ] Gerar primeiro `.aab` release (`./gradlew bundleRelease`)

### 18.5 Assets de loja
- [ ] Screenshots: Dashboard, DoseModal, Relatório, Settings, Pacientes (1080×1920)
- [ ] Feature Graphic (1024×500px)

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

## FASE 18.5 — FAQ + Suporte In-App (pre-beta)

> Reduzir suporte 1-on-1 antes do Beta. Antecipar dúvidas comuns sobre funcionamento, alarme, permissões, planos.

### 18.5.1 Conteúdo
- [ ] Levantar perguntas previstas por categoria:
  - **Primeiros passos:** "Como cadastrar primeiro paciente?", "Como criar tratamento?", "Como funciona dose contínua?"
  - **Alarme & Notificações:** "Por que o alarme não toca?", "O que é o modo Não Perturbe?", "Como tocar mesmo no silencioso?", "Adiar 10min vai gerar nova dose?", "Push notif sumiu — como reativar?"
  - **Permissões Android:** "Por que precisa de tantas permissões?", "Como liberar 'tela cheia' nas configurações?", "App não abre depois de update — re-conceder permissões"
  - **Doses:** "Diferença entre Tomada/Pular/Ignorar?", "Como registrar dose extra (S.O.S)?", "Como editar uma dose tomada?", "Por que aparece 'atrasada'?"
  - **Compartilhar paciente:** "Como compartilhar com cuidador?", "Compartilhar dá permissão de editar?"
  - **Plano PRO/Plus:** "O que vem no PRO?", "Como cancelar?", "Trial 7 dias funciona como?", "Restaurar compras"
  - **Privacidade:** "Onde meus dados ficam?", "Como exportar?", "Como excluir conta?", "App vê meus dados de saúde?"
  - **Sincronização:** "Posso usar em 2 celulares?", "App funciona offline?", "Atualização automática?"
  - **Bugs comuns:** "Alarme tocou 2x", "Resumo diário não chegou", "Versão desatualizada"
- [ ] Escrever respostas concisas (3-5 linhas cada) em pt-BR
- [ ] Revisar com advogado as respostas sobre privacidade/saúde (não dar conselho médico)
- [ ] Salvar em `src/data/faq.js` como array `[{ category, question, answer, keywords }]`

### 18.5.2 UI in-app
- [ ] Criar página `src/pages/FAQ.jsx` com:
  - Search box no topo (filtra por question + keywords)
  - Lista por categoria, accordion expandable
  - Empty state se busca sem resultado + CTA "Não achou? Entre em contato"
- [ ] Rota `/faq` em `App.jsx`
- [ ] Link "Ajuda / FAQ" em `More.jsx` (entre "Ajustes" e "Painel Admin")
- [ ] Link "Ver FAQ" no header da `PermissionsOnboarding` (caso usuário não entenda permissão)
- [ ] Botão "Dúvidas frequentes" no `Settings.jsx` section "Sobre"
- [ ] Tag PostHog: `faq_opened`, `faq_search_query`, `faq_question_expanded` (após FASE 14 instrumentation)

### 18.5.3 Onboarding hint
- [ ] Slide adicional no `OnboardingTour` apontando pra FAQ ("Tem dúvidas? Acesse Mais → FAQ a qualquer momento")
- [ ] OR tooltip discreto pós-1º login: "💡 FAQ disponível em Mais"

### 18.5.4 Suporte fallback
- [ ] Email suporte funcional: `suporte@dosyapp.com` (ou similar)
- [ ] Botão "Falar com suporte" no FAQ que abre email com template (subject + corpo pré-preenchido com versão do app + device info)
- [ ] Resposta SLA documentada em `docs/support-sla.md` (24h dia útil PRO, 72h Free)

**Validação 18.5:** FAQ respondendo ≥30 perguntas. Search funcional. Acessível de 3 entry-points (More, Settings, OnboardingTour). Email suporte testado.

---

# PARTE II — TESTERS

## FASE 19 — Beta Interno (testers conhecidos)

### 19.1 Preparação
- [ ] Lista 5-10 testers (família, amigos próximos)
- [ ] Configurar Internal Testing track no Play Console
- [ ] Adicionar testers como licensed testers
- [ ] Versão `0.9.x-internal` (ou seguir 0.1.x.x)

### 19.2 Distribuição
- [ ] Convite via Play Store (link interno)
- [ ] Onboarding em vídeo para testers
- [ ] Canal Telegram/WhatsApp pra feedback
- [ ] Formulário Google estruturado (bugs, sugestões, NPS)

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
- [ ] Closed Testing track com até 100 testers
- [ ] Open Testing depois de estável
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

---

## STATUS GERAL

- **Total de fases:** 23 (mais Fase 0)
- **Concluídas (✅):** Fase 0, 1, 2, 2.5, 3, 5
- **Em andamento:** Fase 4 (~95%)
- **Próxima:** Fase 6 (Migrations CLI) → Fase 7 (Quick Wins) → cascata
- **Estimativa restante até launch:** ~3-5 meses
- **Versão atual:** 0.1.5.6 (dev — pre-1.0). v1.0 reservada pra Play Store launch.

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
| Anon role tem grants em 10/11 tabelas | **Pendente** | Crítico | FASE 7.1 `REVOKE ALL FROM anon` |
| `minifyEnabled false` permite reverse-engineering | **Pendente** | Alto | FASE 7.2 ProGuard ativo |
| FLAG_SECURE ausente — info médica vaza recents | **Pendente** | Alto | FASE 11.1 |
| Sem testes — refactors arriscados | **Pendente** | Crítico | FASE 9 Vitest |
| Sem source maps — crashes prod inúteis | **Pendente** | Alto | FASE 10.1 `@sentry/vite-plugin` |
| Supabase auth token expirar offline | Média | Médio | `autoRefreshToken: true` + redirect Login |
| Permissões especiais Android (full-screen, overlay) resetam após install | Média | Médio | PermissionsOnboarding re-aparece após APP_VERSION change ✅ |
