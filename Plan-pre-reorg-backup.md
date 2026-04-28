# Plano — Dosy para Android (Produto)

Roadmap em fases para transformar o Dosy (PWA + Capacitor) em produto comercial pronto para Play Store, com segurança robusta, alarme crítico estilo despertador, monetização Free/PRO/Plus e disponibilização gradual (testers internos → beta fechado → Play Store → público).

Cada fase tem critérios de saída antes da próxima.

> **Nota histórica:** versão detalhada anterior preservada em `Plan-detalhado-backup.md` (2285 linhas, contém código de referência, exemplos, runbooks). Este `Plan.md` é o checklist-master operacional.

---

## 📌 Como usar este documento

Este é o **arquivo principal de roadmap**. Toda nova ação descoberta em qualquer auditoria, análise ou bug deve ser inserida aqui na ordem cronológica/lógica certa (não no fim). Itens concluídos ficam marcados `[x]` e a sub-fase ganha "✅ CONCLUÍDA" no título.

**Para retomar trabalho em um novo chat:**
1. Abrir este `Plano.md` e identificar a primeira sub-fase com itens `[ ]` ainda abertos
2. Conferir documentos anexos referenciados na sub-fase imediatamente anterior (ex: `Auditoria-4.5.X.md`) — eles são **inputs read-only**, não checklists adicionais. Tudo que precisa ser feito já foi propagado pra cá.
3. Começar pelo primeiro item aberto

**Convenção:**
- `[ ]` = pendente · `[x]` = feito · `✅ CONCLUÍDA` no título quando todos itens fechados
- Cada nova ação descoberta entra na sub-fase apropriada **na ordem em que precisa ser executada**, não anexada no fim
- Cada fase tem **Validação** ao final que serve de critério de saída
- Itens descobertos via auditoria devem citar fonte (ex: "vinda da Auditoria-4.5.2")

**Documentos anexos esperados (gerados durante FASE 4.5):**
- `docs/audits/Auditoria-4.5.1.md` — código & arquitetura
- `docs/audits/Auditoria-4.5.2.md` — DB & RLS
- `docs/audits/Auditoria-4.5.6.md` — UX & A11y
- `docs/audits/Auditoria-4.5.9.md` — segurança mobile

---

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
- [x] Migrar Supabase `auth.storage` localStorage → SecureStorage (Android KeyStore) via adapter condicional
- [x] `detectSessionInUrl: false` no Supabase client (apenas native)
- [x] Handler do botão Voltar Android em `App.jsx`
- [x] Reconexão Realtime em `useRealtime.js` (pause/resume)
- [x] `npx cap add android` + `npx cap sync android`
- [x] Instalar JDK 17 + JDK 21 (Temurin) + Android SDK (cmdline-tools, platforms 34/35/36, build-tools 34.0.0)
- [x] `JAVA_HOME` + `ANDROID_HOME` em variáveis de usuário
- [x] Testar app no emulador Android (Pixel 10 Pro via Studio)
- [ ] Testar app em dispositivo físico
- [x] Login/auth funcionando no Android (validado emulador 2026-04-26)
- [x] SSL Pinning em `network_security_config.xml` (`guefraaqbkcehofchnrc.supabase.co`, primary GTS WE1 + backup GTS Root R4)
- [x] Bloquear ADB backup (`allowBackup="false"` + `data_extraction_rules.xml`)
- [ ] **NOTA:** Build CLI via `gradlew.bat` quebra com `Unable to establish loopback connection` (bug Win11 24H2 + JVM UnixDomainSockets). Workaround: Studio (JBR patched). CI: Linux runner.

**Validação fase 1:** APK rodando offline + online em emulador.

---

## FASE 2 — Notificações FCM + LocalNotifications ✅ CONCLUÍDA

### 2.1 Setup Firebase + plugins
- [x] Projeto Firebase `dosy-b592e`
- [x] App Android `com.dosyapp.dosy` registrado
- [x] `google-services.json` em `android/app/`
- [x] Instalar `@capacitor/push-notifications` + `@capacitor/local-notifications`
- [x] Configuração no `capacitor.config.ts`
- [x] `usePushNotifications.js` com lógica `isNative`/web

### 2.2 Backend FCM
- [x] Migration: colunas `deviceToken` + `platform` em `push_subscriptions`
- [x] Edge Function `notify-doses` com FCM HTTP v1 API + JWT OAuth
- [x] Secrets Firebase no Supabase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- [x] RPC `upsert_push_subscription` SECURITY DEFINER (handles cross-user device transfer)
- [x] UNIQUE constraint em `deviceToken` (substituiu partial index — não funciona com ON CONFLICT)
- [x] Edge Function `send-test-push` (POST email do alvo, admin only)

### 2.3 Validação ✅
- [x] LocalNotifications no Android (10 doses, Pixel 10 Pro)
- [x] Push server-side FCM (token persistido, HTTP v1 retornou 200)
- [x] Notification channel `doses` criado (Android 8+ requer)
- [x] Multi-device test (2 emuladores, push direcionado)
- [x] Payload FCM correto (`priority: 'HIGH'`, `notification_priority: 'PRIORITY_HIGH'`, `default_sound: true`)
- [ ] Confirmar snooze no nativo (não-bloqueante)

---

## FASE 2.5 — Alarme Crítico Nativo (BLOCKER) ✅ CONCLUÍDA
> Push padrão toca som 1x e não bypassa silencioso/DND. Pra app de medicação, lembretes precisam comportar-se como **alarme do despertador**: tela cheia, som em loop até dismiss, ignora silencioso, mostra na lock screen. Plugin Android nativo custom (não há plugin Capacitor maintained).

- [x] Plugin Capacitor Android `CriticalAlarmPlugin` (Java)
- [x] `AlarmReceiver` (BroadcastReceiver disparado por AlarmManager)
- [x] `AlarmActivity` full-screen (FLAG_SHOW_WHEN_LOCKED + TURN_SCREEN_ON, MediaPlayer USAGE_ALARM loop, botões Ciente/Adiar 10min, vibração)
- [x] Permissão `USE_FULL_SCREEN_INTENT` no AndroidManifest
- [x] Permissão `ACCESS_NOTIFICATION_POLICY`
- [x] Permissão `SYSTEM_ALERT_WINDOW` (BAL bypass Android 14+, granted via adb appops)
- [x] Registrar plugin em `MainActivity.java`
- [x] Bridge JS: `src/services/criticalAlarm.js`
- [x] `AlarmService` foreground service (BAL workaround Android 14+)
- [x] Agrupamento doses mesmo horário (1 alarme único + lista, vs N simultâneos)
- [x] Modal queue (tap notif abre fila Ignorar/Pular/Tomada por dose)
- [x] Tap notif tray → MainActivity → modal queue
- [x] Re-agendar alarmes após reboot (`BootReceiver` + BOOT_COMPLETED + LOCKED_BOOT_COMPLETED + MY_PACKAGE_REPLACED)
- [x] Testar device bloqueado → tela cheia + som (validado emulador Pixel 10 Pro 2026-04-27)
- [x] Testar app killed (home) → alarme dispara fullscreen
- [ ] `dosy_alarm.mp3` em `res/raw/` (custom, opcional — fallback usa default)
- [ ] Testar dose com alarme ATIVO → silenciar device → ainda tocar (validar device físico)
- [ ] Testar dose com alarme ATIVO → DND mode → ainda tocar (após `ACCESS_NOTIFICATION_POLICY` granted)
- [ ] Testar tap "Adiar 10 min" → re-agenda +10min

---

## FASE 3 — Sistema Notificações Centralizado ✅ CONCLUÍDA

> Refatoração: toda lógica de scheduling, FCM, prefs, alarme, DND e resumo diário consolidada em `src/services/notifications.js` (single source of truth, ~430 linhas).

- [x] Criar `src/services/notifications.js` consolidado
- [x] Helpers puros: `loadPrefs`, `inDnd`, `groupByMinute`, `filterUpcoming`
- [x] `rescheduleAll({ doses, patients, prefsOverride })` idempotente — cancela tudo antes de agendar
- [x] `cancelAll()` — alarms + local notifs (idempotente)
- [x] `subscribeFcm()` / `unsubscribeFcm()` (request perm + register + persist token via RPC)
- [x] `bindFcmListenersOnce()` (registra handlers globalmente, sem duplicar)
- [x] React hook `useNotifications()` (state + callbacks)
- [x] `usePushNotifications.js` virou re-export shim retro-compat
- [x] Regras de negócio hierárquicas implementadas:
  - `prefs.push` ON → push notif sempre + (criticalAlarm ON & !DND → alarme fullscreen)
  - `prefs.push` OFF → nada
  - `prefs.dailySummary` → independente de tudo
  - DND afeta APENAS critical alarm; push notif passa
- [x] Toggle critical OFF agora cancela alarmes pendentes (era bug — só cancelava quando ON)
- [x] Push notif scheduled em paralelo com alarme (era bug — `if (!useCritical)` bloqueava)
- [x] Daily summary roda mesmo sem doses hoje (era bug — Dashboard só chamava `if (todayDoses.length)`)
- [x] DND prefs: `dndEnabled`, `dndStart`, `dndEnd` (suporta wrap meia-noite)
- [x] Settings UI: section "Não perturbe" com toggle + 2 time pickers
- [x] Reschedule triggers expandidos: `push, dailySummary, summaryTime, advanceMins, criticalAlarm, dndEnabled, dndStart, dndEnd`
- [x] AppHeader overdue badge: drop `to` cap (estava congelado no mount), expand `from` para 90d
- [x] Permissions onboarding re-aparece após update (storage versionado por APP_VERSION)

---

## FASE 4 — Polimento Nativo (parcial)

### 4.1 Export PDF/CSV ✅
- [x] Instalar `jspdf` + `html2canvas`
- [x] Substituir `window.print()` por jsPDF (native: html2canvas → jsPDF → Filesystem.Cache → Share)
- [x] Instalar `@capacitor/filesystem` + `@capacitor/share`
- [x] Adaptar export CSV para Android

### 4.2 Offline & Network ✅
- [x] Offline mutations + cache persistence (TanStack PersistQueryClient + retry exponential 3x)
- [x] Instalar `@capacitor/network`
- [x] `src/hooks/useOnlineStatus.js` (Network listener native + navigator.onLine web)

### 4.3 Ads ✅
- [x] Instalar `@capacitor-community/admob`
- [x] `AdBanner.jsx` condicional AdSense (web) / AdMob (nativo)
- [x] AdMob singleton TOP_CENTER overlay (margin 56dp acima do AppHeader)
- [x] AdBanner in-flow em todas pages internas (Dashboard, More, Patients, etc)

### 4.4 Visual & UX ✅ (rodada v1.0.5)
- [x] Design system centralizado em `src/styles/theme.css` (CSS vars editáveis)
- [x] Tailwind config consume CSS vars (`bg-brand-600` etc)
- [x] Border radius -30% global (app menos arredondado)
- [x] Header padding +50% (AppHeader + Header sub-pages)
- [x] Espaçamento card-to-card uniforme (4px) em Dashboard/Patients/More/Settings
- [x] Ícones flat lucide em ~25 componentes/páginas (toggle Settings flat/emoji reversível)
- [x] PatientPicker dropdown searchable (substitui pill-rows em SOS, FilterBar, DoseHistory)
- [x] Dark mode brand opacity bug fix (RGB triplet vars + tailwind.config rgb format)
- [x] FilterBar sticky offset usando `calc(env(safe-area-inset-top) + 78px)`
- [x] DoseCard refactor (outer wrapper assume border/radius/shadow → fix stroke clipping)

### 4.5 StatusBar + Deep Links ✅
- [x] StatusBar dark `#0d1535` na inicialização (main.jsx + Capacitor StatusBar plugin)
- [x] Deep links em AndroidManifest.xml (`https://dosy-teal.vercel.app` + `dosy://` custom scheme)

### 4.6 Update Banner ✅
- [x] `useAppUpdate` hook (compara `version.json` Vercel com bundle local)
- [x] `UpdateBanner` component sticky top
- [x] Settings botão "Atualizar" com URL absoluta (era `window.location.origin` = capacitor://localhost, broken)
- [x] UpdateBanner safe-top (respeita status bar HUD)
- [x] Versão visível no BottomNav (text-[8px] discreto abaixo do FAB +)

### 4.7 Pendente
- [ ] Criar assets ícone: `resources/icon.png` (1024×1024) + `resources/splash.png` (manual)
- [ ] Criar `resources/icon-foreground.png` para adaptive icon (108×108)
- [ ] Executar `npx @capacitor/assets generate --android` (depende dos assets)
- [ ] Testar safe area em devices com notch (device físico)
- [ ] Testar performance Android (scroll, animações) (device físico)

---

## FASE 4.5 — Auditorias (READ-ONLY, NÃO MUDAR CÓDIGO)

> **Princípio:** Auditoria não modifica código. Só lê, analisa, gera relatório. Cada auditoria produz `docs/audits/Auditoria-4.5.X.md` com achados (severidade crit/high/med/low + recomendação).
>
> **Fluxo:** rodar TODAS auditorias primeiro → consolidar achados → propagar tasks concretas pras sub-fases corretas no checklist (ordem lógica de execução, não no fim).
>
> **Quando rodar:** AGORA (estado atual do app), antes de seguir pra Fase 5 (Monetização) e demais. App passou Fases 0-4, mas auditorias podem revelar gaps que viraram dívida técnica.
>
> **Saída de cada auditoria:** doc com pontuação de risco + top recomendações + lista de gaps. Esses gaps viram tasks `[ ]` em sub-fases novas (ex: 0.4 RLS hardening v2, 4.7 A11y remediação) inseridas na ordem certa.

### 4.5.1 Auditoria de código & arquitetura ✅ CONCLUÍDA
> Resultado em [`docs/audits/Auditoria-4.5.1.md`](./docs/audits/Auditoria-4.5.1.md). Score 5.5/10. 17 gaps identificados (3 críticos, 6 altos, 5 médios, 3 baixos). Top 3: bundle monolítico 716KB sem code-splitting, zero testes automatizados, 12 vulns npm em devDeps Capacitor.
- [x] Mapear todas queries Supabase (RPC + select direto) — 14 RPCs SECURITY DEFINER mapeadas
- [x] Inventariar Edge Functions (3: delete-account, notify-doses, send-test-push) — 433 LOC
- [x] Listar tabelas operadas direto vs via RPC
- [x] Mapear lógica de negócio client-side (`validateSos`, `generateDoses` — duplicada em mock fallback)
- [x] Bundle size analysis (716KB main, jspdf 390KB + html2canvas 202KB eager)
- [x] Tech debt + comportamentos: ErrorBoundary ausente, 42 console.* no bundle, retry inconsistente, Settings.jsx 465 LOC god-component
- [x] `npm audit` (12 vulns: 8 high + 4 moderate, concentradas em devDeps `@capacitor/assets` chain)
- [x] Gerar `docs/audits/Auditoria-4.5.1.md` (score, gaps, top 10 recomendações)

### 4.5.2 Auditoria DB — schema + RLS ✅ CONCLUÍDA
> Resultado em [`docs/audits/Auditoria-4.5.2.md`](./docs/audits/Auditoria-4.5.2.md). Score 7/10. RLS sólido (11/11), mas anon tem TODOS os grants em 10/11 tabelas (P0 — defense-in-depth). Gaps em CHECK constraints, role explícito, overload dead code.
- [x] Auditadas 11 tabelas + 33 indexes + 22 functions + 2 triggers + 2 cron jobs
- [x] RLS habilitado: 11/11 ✓
- [x] FORCE RLS: 10/11 (gap: user_prefs)
- [x] Policies role: TODAS usam `{public}` (não explicit `authenticated`) — gap P1
- [x] **CRÍTICO:** anon tem SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER em 10/11 tabelas
- [x] FK ON DELETE CASCADE: 18/18 ✓
- [x] CHECKs presentes mas faltam: `intervalHours/durationDays > 0`, length max em treatments/patients/sos_rules
- [x] Trigger ownership cruzado dose↔treatment ausente
- [x] Overload dead code: `create_treatment_with_doses` V1 (sem timezone) coexiste com V2
- [x] Gerar `docs/audits/Auditoria-4.5.2.md`

### 4.5.3 Auditoria UX & A11y ✅ CONCLUÍDA (estática)
> Resultado em [`docs/audits/Auditoria-4.5.3.md`](./docs/audits/Auditoria-4.5.3.md). Score 4/10. Gaps: ZERO `:focus-visible`, ZERO trap de foco em modais, 16 botões <44px, ~50 icon-buttons sem aria-label, ZERO `inputMode`. Validação manual device fica em 4.5.15.
- [x] Static analysis: aria-label coverage (11/~50 botões), `:focus-visible` (0), focus trap (0), touch targets (16 abaixo de 44px), `inputMode` (0)
- [x] Skeleton screens: 6 arquivos usam, gaps em Reports/Analytics/SOS/Forms
- [x] Empty states: presente
- [x] Gerar `docs/audits/Auditoria-4.5.3.md`

### 4.5.4 Auditoria de segurança mobile ✅ CONCLUÍDA
> Resultado em [`docs/audits/Auditoria-4.5.4.md`](./docs/audits/Auditoria-4.5.4.md). Score 6/10. **CRÍTICO:** `minifyEnabled false` em release (sem ProGuard/R8), ZERO FLAG_SECURE em telas com info médica, sem mask recents, sem Play Integrity, sem biometria.
- [x] AndroidManifest review (permissões enxutas, justificadas)
- [x] Network Security Config (cleartext blocked, SSL pinning Supabase 3 pins ativo)
- [x] Build flags (`minifyEnabled false` ⚠️, signing config env-based ✓)
- [x] Secrets scan dist/ (apenas anon key esperado, sem service_role/PAT/FCM private)
- [x] FLAG_SECURE: 0 ocorrências
- [x] Cert pinning Vercel: ausente
- [x] Pen test profissional: TBD em FASE 8
- [x] Gerar `docs/audits/Auditoria-4.5.4.md`

### 4.5.5 Auditoria de performance ✅ CONCLUÍDA
> Resultado em [`docs/audits/Auditoria-4.5.5.md`](./docs/audits/Auditoria-4.5.5.md). Score 4/10. Bundle main 716KB (alvo 500KB), jspdf+html2canvas 590KB eager, ZERO `React.lazy`, ZERO `manualChunks`, ZERO virtualização. Mutations retry + persistor já OK.
- [x] Bundle analysis (716KB main, 390KB jspdf, 202KB html2canvas, 151KB purify)
- [x] Code patterns: 48 useMemo/useCallback OK, 0 React.memo, 0 React.lazy, 0 virtualização
- [x] mutations retry (3x exponential ✓), queries retry (1x), persistor 24h ✓
- [x] Lighthouse score: TBD validação manual 4.5.15
- [x] Gerar `docs/audits/Auditoria-4.5.5.md`

### 4.5.6 Auditoria de testes & CI ✅ CONCLUÍDA
> Resultado em [`docs/audits/Auditoria-4.5.6.md`](./docs/audits/Auditoria-4.5.6.md). Score 2/10. ZERO testes (Vitest/Jest/Playwright não instalados). CI verifica build mas sem lint/tests/security scan. Sem ESLint/Prettier/pre-commit hooks.
- [x] Test files: 0 em src/ (excluindo node_modules)
- [x] Test framework: Vitest/Jest/Playwright NÃO instalados
- [x] CI workflows: ci.yml (build verify) + android-release.yml (signed AAB) — sem lint/tests/audit
- [x] ESLint/Prettier: não configurados
- [x] Source maps Sentry: NÃO uploadados
- [x] Gerar `docs/audits/Auditoria-4.5.6.md`

### 4.5.7 Auditoria de observability ✅ CONCLUÍDA
> Resultado em [`docs/audits/Auditoria-4.5.7.md`](./docs/audits/Auditoria-4.5.7.md). Score 5/10. Sentry integrado com PII strip ✓ MAS sem source maps, sem release tag, sem ErrorBoundary. ZERO PostHog (product analytics, feature flags, funil paywall). Voar cego em launch.
- [x] Sentry config: integrado native+web, beforeSend strips PII, tracesSampleRate 0.1, ignoreErrors rede ✓
- [x] Sentry source maps upload: ausente
- [x] Sentry release tag: não configurado
- [x] Sentry ErrorBoundary: ausente
- [x] PostHog: não integrado
- [x] Eventos custom críticos: nenhum (dose_confirmed, paywall_*, alarm_fired)
- [x] Métricas-alvo launch documented: TBD em 4.6
- [x] Gerar `docs/audits/Auditoria-4.5.7.md`

**Validação FASE 4.5:** ✅ todas 7 auditorias rodadas. 7 docs em `docs/audits/`. Nenhuma mudança de código.

---

## FASE 4.6 — Consolidação dos Achados ✅ CONCLUÍDA

> Auditorias 4.5.1–4.5.7 geraram 7 docs com 60+ gaps. Triagem cross-cutting por severidade + ordem lógica dev→test→deploy.

- [x] 7 docs `Auditoria-4.5.X.md` em `docs/audits/`
- [x] Triagem severidade: 6 P0 imediatos, 23 P1 antes-beta, 18 P2 podem-esperar, 13 P3 backlog
- [x] Sub-fases concretas criadas abaixo (4.7 → 4.13), ordenadas: bloqueios primeiro → segurança → qualidade → A11y → perf → tests → observability
- [x] Cada sub-fase referencia o gap origem (G#) na auditoria correspondente

**Princípio de ordem:** itens P0 baixo-esforço primeiro (XS/S de alta razão valor/risco), depois P1 médios, depois P2/P3 segundo prioridade. Tests/observability ANTES de beta pra capturar regressões. Pen test profissional fica em FASE 8 (já planejado).

---

## FASE 4.7 — P0 Quick Wins (impedem launch, esforço XS)

> Bloco de fixes rápidos que removem riscos imediatos sem refactor. Rodar TUDO antes de qualquer outra remediação.

- [ ] **DB:** `REVOKE ALL ON medcontrol.<10 tabelas> FROM anon` (Aud 4.5.2 G1) — defesa em profundidade
- [ ] **DB:** `ALTER TABLE medcontrol.user_prefs FORCE ROW LEVEL SECURITY` (Aud 4.5.2 G2)
- [ ] **DB:** `DROP FUNCTION` overload V1 de `create_treatment_with_doses` (10 params, sem timezone) (Aud 4.5.2 G4)
- [ ] **Build:** `minifyEnabled true` em `android/app/build.gradle` release + testar APK release não quebra (Aud 4.5.4 G1)
- [ ] **Build:** Vite `vite-plugin-remove-console` em mode=production (Aud 4.5.1 G5)
- [ ] **Sentry:** adicionar `release: pkg.version` no init pra correlacionar crashes (Aud 4.5.7 G3)
- [ ] **A11y:** `:focus-visible` global em `theme.css` com outline brand (Aud 4.5.3 G1)
- [ ] **A11y:** `inputMode="numeric"` em campos quantidade/dose/idade/peso (Aud 4.5.3 G5)
- [ ] **Deps:** `npm audit fix` non-breaking (Aud 4.5.1 G3) — review breaking changes antes de `--force`

**Validação 4.7:** todos os 9 itens fechados. App ainda builda. APK release menor (ProGuard ativo). DB query `pg_class.relrowsecurity AND relforcerowsecurity` = `true,true` em 11/11 tabelas.

---

## FASE 4.8 — Hardening DB (constraints + triggers)

> Após 4.7 wipe quick wins, fechar gaps de schema integrity. Vinda de Aud 4.5.2.

- [ ] CHECK em `treatments`: `intervalHours > 0`, `durationDays > 0 AND durationDays <= 365`, `length(medName) <= 200`, `length(unit) <= 100` (G6)
- [ ] CHECK em `sos_rules`: `minIntervalHours > 0`, `maxDosesIn24h > 0`, `length(medName) <= 200` (G7)
- [ ] CHECK em `patients`: `length(name) <= 200`, `length(condition) <= 500`, `length(doctor) <= 200`, `length(allergies) <= 500`, `age >= 0 AND age <= 150`, `weight > 0 AND weight < 1000` (G8)
- [ ] CHECK em `doses`: `length(medName) <= 200`, `length(unit) <= 100` (preencher gap)
- [ ] Trigger `validate_dose_treatment_match` BEFORE INSERT/UPDATE em `doses`: `treatment.patientId == dose.patientId` quando `treatmentId NOT NULL` (G5)
- [ ] Recriar policies com `TO authenticated` explícito (todas tabelas) (G3) — após REVOKE FROM anon
- [ ] Splitar `cmd=ALL` policies em 4 (push_subs, user_prefs, subscriptions admin, security_events admin) (G9)
- [ ] Pen test interno: user A tenta SQL/PostgREST direto contra dados user B → bloqueado em todos cenários

**Validação 4.8:** todas CHECKs aplicadas via migration. Trigger valida cross-FK. Policies com role explícito. Pen test interno passa.

---

## FASE 4.9 — Quality Refactor (resilência client)

> Vinda de Aud 4.5.1. Estabilidade em prod.

- [ ] `<Sentry.ErrorBoundary>` no `main.jsx` wrappando `<App />` + fallback amigável (Aud 4.5.7 G2)
- [ ] Strip `console.log` confirmado em build prod (validar dist/ pós 4.7)
- [ ] `vite.config.js` `manualChunks` separar vendor/react/supabase (Aud 4.5.5 G3)
- [ ] Code splitting routes: `React.lazy` + `<Suspense>` em todas pages do `App.jsx` (Aud 4.5.5 G1)
- [ ] Dynamic import `jspdf` + `html2canvas` dentro do handler de export em `Reports.jsx` (Aud 4.5.5 G2)
- [ ] `@sentry/vite-plugin` upload source maps no Vercel build (Aud 4.5.6 G4 / 4.5.7 G1)
- [ ] Refatorar `Settings.jsx` (465 LOC) em sub-componentes: `SettingsAppearance`, `SettingsNotifs`, `SettingsAccount`, `SettingsAbout`, `SettingsAdmin` (Aud 4.5.1 G8)
- [ ] React.memo em `DoseCard`, `PatientCard`, `Icon`, `Stat` (Aud 4.5.5 G5)
- [ ] Lazy load avatares (`<img loading="lazy">` em PatientCard) (Aud 4.5.5 G6)

**Validação 4.9:** bundle main ≤500KB (alvo 300KB). Lighthouse score sobe (medir em 4.5.15). ErrorBoundary captura erro forçado. Source maps em Sentry decodificam crash.

---

## FASE 4.10 — Mobile Security Hardening

> Vinda de Aud 4.5.4. APK production-grade.

- [ ] Validar/escrever `proguard-rules.pro` (Capacitor + Sentry + Supabase precisam keep rules) — testar APK release pós-minify
- [ ] FLAG_SECURE em telas sensíveis: `DoseModal`, `PatientDetail`, `Reports`, `DoseHistory` (Aud 4.5.4 G2)
  - Implementação: helper hook `useFlagSecure()` que chama plugin Capacitor custom OR `@capacitor-community/privacy-screen`
- [ ] Plugin `@capacitor-community/privacy-screen` ou nativo: mask em recents view (G3)
- [ ] Cert pinning `dosy-teal.vercel.app` em `network_security_config.xml` (G5)
- [ ] Detecção root/jailbreak: plugin `capacitor-jailbreak-root-detection` + warn user (G4)
- [ ] Biometria opcional pra abrir app: `@capacitor-community/native-biometric` + toggle Settings (G7)
- [ ] Auto-lock após N min em background (G8) — re-autenticar via biometria/senha
- [ ] Google Play Integrity API (`@capgo/capacitor-play-integrity` ou nativo) (G6)
- [ ] AdMob: confirmar prod ID via env, remover hardcoded test ID fallback do bundle prod (Aud 4.5.4 G13)

**Validação 4.10:** APK release com obfuscação. Telas médicas não vazam screenshot. Device rooted = warning visível. Biometria funcional opcional.

---

## FASE 4.11 — A11y Remediation

> Vinda de Aud 4.5.3. WCAG AA compliance.

- [ ] Trap de foco em `BottomSheet` (cyclic Tab) — usar `focus-trap-react` ou implementação custom (G2)
- [ ] Touch targets <44×44px → aumentar em Header back-btn, FilterBar funil, DoseHistory nav, AppHeader settings, UpdateBanner close (G3)
- [ ] `aria-label` em ~50 botões só-ícone (audit visual + adicionar one-by-one) (G4)
- [ ] Erros de validação inline próximos ao campo em forms (PatientForm, TreatmentForm, SOS, Settings name update) (G6)
- [ ] Skeleton screens completos: TreatmentList, Reports, Analytics, SOS, PatientForm, TreatmentForm (G7)
- [ ] Subir contraste textos secundários no dark mode (audit com axe DevTools) (G8)
- [ ] Skip-to-content link no `<main>` (G9)
- [ ] `aria-current="page"` em BottomNav active (G10)
- [ ] Hierarquia headings: h1 único por page, h2/h3 sub (audit manual)
- [ ] Suportar Dynamic Type: usar `rem` em vez de `px` onde possível (G12)

**Validação 4.11:** axe DevTools passa WCAG AA. TalkBack: fluxos críticos navegáveis. Tab + Enter funciona em todos modais.

---

## FASE 4.12 — Performance Optimizations (avançadas)

> Após code splitting básico (4.9). Vinda de Aud 4.5.5.

- [ ] Virtualização listas longas (`@tanstack/react-virtual`) em `DoseHistory`, `Patients`, `TreatmentList` (G4)
- [ ] Bundle analyzer report (`rollup-plugin-visualizer` plugin Vite)
- [ ] Lighthouse score baseline + alvo ≥90 mobile
- [ ] Time-to-interactive ≤3s em 3G simulado
- [ ] 60fps scroll em lista de 500 doses

**Validação 4.12:** métricas atingidas em ambiente de teste device físico.

---

## FASE 4.13 — Tests Setup

> Vinda de Aud 4.5.6. Cobertura crítica antes de Beta.

### 4.13.1 Setup
- [ ] Instalar Vitest + `@testing-library/react` + `@testing-library/jest-dom`
- [ ] Config `vitest.config.js` (jsdom env, setup file, coverage v8)
- [ ] ESLint config + Prettier + lint-staged + husky pre-commit
- [ ] CI workflow `ci.yml`: adicionar steps `npm run lint`, `npm run test`, `npm audit --audit-level=high`

### 4.13.2 Unit tests críticos
- [ ] `utils/dateUtils.test.js` (formatTime, relativeLabel, edge cases timezone)
- [ ] `utils/generateDoses.test.js` (mode=times + mode=interval, durationDays, edge cases meia-noite)
- [ ] `utils/statusUtils.test.js`
- [ ] `utils/tierUtils.test.js`
- [ ] `services/dosesService.test.js` (validateSos — minInterval, maxIn24h, edge cases)
- [ ] `services/notifications.test.js` (`inDnd` wrap meia-noite, `groupByMinute`, `filterUpcoming`, `doseIdToNumber` collision check)

### 4.13.3 Integration tests
- [ ] Hooks: `useDoses` com mock Supabase (confirm/skip/undo cache update)
- [ ] Hooks: `useUserPrefs` (DB sync + localStorage cache)

### 4.13.4 E2E (mínimo viável)
- [ ] Playwright setup
- [ ] Happy path: login → dashboard → criar treatment → ver doses
- [ ] Happy path: dose → confirm → status update

**Validação 4.13:** ≥90% cobertura em utils núcleo. ≥70% no resto. CI verde 5 dias consecutivos. E2E happy path passa.

---

## FASE 4.14 — Observability Avançada

> Vinda de Aud 4.5.7. Voar com instrumentos antes de launch.

- [ ] PostHog SDK web + native (`posthog-js` + `@posthog/capacitor` se houver, senão wrapper manual)
- [ ] Eventos custom críticos:
  - `dose_confirmed`, `dose_skipped`, `dose_overdue_dismissed`
  - `alarm_fired`, `alarm_dismissed`, `alarm_snoozed`
  - `notification_permission_granted/denied`
  - `paywall_shown`, `paywall_clicked_plan`, `upgrade_complete`, `upgrade_failed`
  - `share_patient_invite_sent/accepted`
  - `treatment_created`, `patient_created`, `account_deleted`
- [ ] Funil paywall: view → click → checkout_started → success/failure
- [ ] Feature flags via PostHog (toggle features pra subset users sem redeploy)
- [ ] Sentry alerting: crash spike, error rate threshold, Edge Function failures
- [ ] Dashboards (PostHog/Sentry):
  - Crash-free rate (alvo ≥99.5%)
  - ANR rate (Android Vitals export)
  - Retention D1/D7/D30
  - DAU/MAU
  - Critical alarm enabled rate
  - Onboarding completion rate
- [ ] Documentar métricas-alvo em `docs/launch-metrics.md`

**Validação 4.14:** dashboards live, eventos chegando, alertas configurados. Pronto pra observar Beta.

---

## FASE 4.15 — Validação Manual em Device Real

> Antes de Beta interno. Catch UX/perf issues que static audit não pega.

- [ ] 3 devices Android: baixo (Moto E ou similar), médio (Samsung A), top (Pixel) — versões 12, 13, 14
- [ ] axe DevTools / Accessibility Scanner — confirmar WCAG AA
- [ ] Lighthouse mobile ≥90 (Reports, Dashboard)
- [ ] Performance scroll lista 200+ doses
- [ ] Teclado virtual não cobre submit
- [ ] TalkBack ativo: fluxos críticos navegáveis
- [ ] Modo escuro forçado, fonte aumentada (Dynamic Type)
- [ ] Notch / dynamic island / safe-area inferior
- [ ] Pull-to-refresh
- [ ] Sem rede + 3G simulada (TanStack persistor offline)
- [ ] Contraste sob luz solar real
- [ ] Alarme dispara: locked, unlocked, app killed, DND mode
- [ ] DND respeitado (alarme silencia, push notif passa)
- [ ] FLAG_SECURE: screenshot + recents view bloqueados nas telas sensíveis
- [ ] Biometria + auto-lock funcionais

**Validação 4.15:** todos checks ✓ em 3 devices. Issues → backlog ou re-abrir sub-fase relevante.

---

## FASE 4.16 — UX Refinements (gaps notados)

> Vinda de Aud 4.5.1 G16/G17 + UX patterns descobertos. P2-P3.

- [ ] Undo (5s) ao deletar paciente/tratamento (Dosy tem em doses só)
- [ ] Busca text-search dentro de Histórico (filtros têm chips, falta search)
- [ ] Confirmação dupla ao deletar batch (>10 itens)
- [ ] Sort configurável de pacientes (drag-and-drop ou ordem manual)
- [ ] Anexar comprovantes/imagens em doses (foto da medicação) — feature PRO
- [ ] Avaliar remoção de `mockStore.js` (205 LOC, modo demo) ou lazy-load
- [ ] Mover `Plan-detalhado-backup.md` pra `docs/archive/`

**Validação 4.16:** opcional pré-launch. Pode ir pós-launch (FASE 11).

---

## FASE 4.17 — Migrations Versionadas (Supabase CLI)

> Vinda do plano original 4.5.5. Necessário ANTES de mais mudanças DB (4.7 + 4.8) entrarem em prod.

- [ ] Instalar Supabase CLI local
- [ ] `supabase init` no repo + commitar `supabase/config.toml`
- [ ] `supabase link --project-ref guefraaqbkcehofchnrc`
- [ ] `supabase db pull` → migration baseline
- [ ] Documentar fluxo: criar migration → testar local → push prod
- [ ] Pasta `supabase/migrations/` versionada
- [ ] Regra: ZERO edits diretos em prod schema daqui pra frente

**Validação 4.17:** baseline migration aplicada. Próximas mudanças DB (4.7+4.8) entram via migrations versionadas.

---

## FASE 4.18 — Backlog Pós-launch (P3)

> Não bloqueia launch. Adicionar em FASE 11 após launch público.

- [ ] Audit_log abrangente (triggers em UPDATE/DELETE de doses/treatments/patients) (Aud 4.5.2 G12)
- [ ] 2FA opcional via TOTP (Aud 4.5.4 G10)
- [ ] Criptografia client-side de `observation` (Aud 4.5.4 G11)
- [ ] Logout remoto multi-device + tela "Dispositivos conectados" (Aud 4.5.4 G9)
- [ ] Notif email + push ao login em device novo
- [ ] Session replay (Sentry Replay ou PostHog) (Aud 4.5.7 G8)
- [ ] Tracing distributed (Sentry traces correlacionando web → Edge Function → DB) (Aud 4.5.7 G10)
- [ ] Logs estruturados (Logflare/Axiom) (Aud 4.5.7 G11)
- [ ] Visual regression tests (Chromatic/Percy) (Aud 4.5.6 G9)
- [ ] Performance budget em CI (size-limit/bundlesize) (Aud 4.5.6 G10)
- [ ] TypeScript migration (ou JSDoc + `tsc --checkJs`) (Aud 4.5.1 G10)
- [ ] `dosy_alarm.mp3` custom sound (FASE 2.5 opcional)

---

## FASE 5 — Monetização Real (In-App Purchase)

### 5.1 Setup contas + produtos
- [ ] Criar conta RevenueCat
- [ ] Criar conta Google Play Console (USD 25)
- [ ] Criar produtos no Play Console: `dosy_pro_monthly` (R$7,90) + `dosy_pro_yearly` (R$49,90)
- [ ] Conectar Play Console ao RevenueCat via chave de serviço
- [ ] Trial 7 dias do PRO (configurar Play Console)

### 5.2 Integração código
- [ ] Instalar `@revenuecat/purchases-capacitor`
- [ ] Criar `src/hooks/useInAppPurchase.js`
- [ ] Atualizar `PaywallModal.jsx` com botões compra reais
- [ ] Botão "Restaurar compras" (obrigatório Google Play)
- [ ] Edge Function `validate-purchase` (validar receipt Google Play)
- [ ] Webhook RevenueCat → Supabase para renovações/cancelamentos (opcional)

### 5.3 CTA permanente "Gerenciar plano"
> Atualmente paywall só abre via fluxos pontuais. Usuário PRO/Plus não tem onde gerenciar. Free não tem ponto fixo de upgrade.
- [ ] Adicionar seção **"Assinatura"** em `Settings.jsx` (após "Aparência" ou antes de "Conta"):
  - Free: card tier atual + botão "Conhecer PRO" → abre PaywallModal
  - PRO/Plus: card tier atual + data renovação + botões "Mudar plano" + "Cancelar" (deep link Play Store)
- [ ] Reforçar card de tier em `More.jsx` com CTA explícito
- [ ] Botão "Restaurar compras" na seção
- [ ] Link "Política de cobrança" (renovação automática + como cancelar)
- [ ] Badge/banner sutil pra Free em pages-chave (quando hit limit)

### 5.4 Validação
- [ ] Testar fluxo de compra em sandbox Play Store
- [ ] Testar restauração de compra
- [ ] Testar cancelamento + renovação

**Validação fase 5:** fluxo completo testado em sandbox + 3 contas reais.

---

## FASE 6 — Preparação Play Store

### 6.1 Documentos legais ✅ CONCLUÍDA
- [x] Política de Privacidade (`src/pages/Privacidade.jsx`)
- [x] Termos de Uso (`src/pages/Termos.jsx`)
- [x] Rotas `/privacidade` + `/termos` públicas em `App.jsx`

### 6.2 Play Console requirements
- [ ] Preencher questionário IARC no Play Console
- [ ] Preencher declaração de saúde
- [ ] Data Safety section preenchida
- [ ] Classificação etária

### 6.3 Keystore + signing ✅ CONCLUÍDA
- [x] `android/app/build.gradle` com signingConfig env-based
- [x] `.keystore` + `*.jks` no `.gitignore`
- [ ] Gerar keystore release final ⚠️ MANUAL CRÍTICO (quando ready pra prod)
- [ ] Backup keystore em 3 locais seguros

### 6.4 Build AAB
- [ ] Gerar primeiro `.aab` release (`./gradlew bundleRelease`)

### 6.5 Assets de loja
- [ ] Screenshots: Dashboard, DoseModal, Relatório, Settings, Pacientes (1080×1920)
- [ ] Feature Graphic (1024×500px)

### 6.6 Textos de loja ✅ CONCLUÍDA
- [x] Descrição curta (`docs/play-store/description-short.txt`, 80 chars)
- [x] Descrição longa (`docs/play-store/description-long.txt`, ~3500 chars)
- [x] Release notes template (`docs/play-store/release-notes.md`)
- [x] App title (`docs/play-store/app-title.txt`)
- [x] Whatsnew template pt-BR (`docs/play-store/whatsnew/`)

### 6.7 Preços
- [ ] Configurar gratuito (download) + PRO Mensal + PRO Anual em Play Console + RevenueCat

**Validação fase 6:** Play Console sem avisos, advogado revisou Termos + Política.

---

## FASE 7 — Beta Interno (testers conhecidos)

### 7.1 Preparação
- [ ] Lista 5-10 testers (família, amigos próximos)
- [ ] Configurar Internal Testing track no Play Console
- [ ] Adicionar testers como licensed testers
- [ ] Versão `0.9.x-internal` (ou continuar 0.1.x.x)

### 7.2 Distribuição
- [ ] Convite via Play Store (link interno)
- [ ] Onboarding em vídeo para testers
- [ ] Canal Telegram/WhatsApp pra feedback
- [ ] Formulário Google estruturado (bugs, sugestões, NPS)

### 7.3 Coleta
- [ ] Sentry capturando crashes
- [ ] PostHog registrando eventos críticos (depende 4.5.13)
- [ ] Reuniões semanais com 2-3 testers (feedback qualitativo)
- [ ] Iteração rápida (release a cada 3-5 dias)

### 7.4 Critérios de saída
- [ ] Zero crashes nos últimos 7 dias
- [ ] NPS médio ≥ 7
- [ ] 100% bugs P0/P1 resolvidos
- [ ] Pelo menos 1 ciclo completo testado por cada tester

---

## FASE 8 — Beta Fechado (testers profissionais)

### 8.1 Recrutamento
- [ ] Contratar 1-2 QAs profissionais (freelancer ou agência)
- [ ] Brief com escopo, fluxos críticos, áreas de risco
- [ ] Contratar pen tester pra auditoria de segurança específica
- [ ] Definir prazo (1-2 semanas)

### 8.2 Plano de teste
- [ ] Test cases documentados (Notion/TestRail)
- [ ] Matriz devices: 5 marcas, 3 versões Android (12, 13, 14)
- [ ] Cenários stress (1000 doses, 50 tratamentos)
- [ ] Cenários falha (sem rede, rede lenta, bateria fraca)
- [ ] A11y (TalkBack ativo)

### 8.3 Pen test
- [ ] OWASP Mobile Top 10 cobertos
- [ ] Tentativa bypass RLS via API direta
- [ ] Tentativa tampering no APK
- [ ] Análise tráfego (sniffing) com Burp/mitmproxy
- [ ] Relatório com severidades (crit/high/med/low)

### 8.4 Correções
- [ ] Triage com prioridades
- [ ] Fix de tudo crit/high antes de avançar
- [ ] Re-teste das correções
- [ ] Documentar issues aceitos como "won't fix"

**Validação fase 8:** zero crit/high abertos, relatório pen test aprovado.

---

## FASE 9 — Beta Aberto (Play Store)

### 9.1 Setup
- [ ] Closed Testing track com até 100 testers
- [ ] Open Testing depois de estável
- [ ] Versão `1.0.0-beta.x`
- [ ] Página "junte-se ao beta" no site

### 9.2 Recrutamento testers
- [ ] Post Reddit r/financasbr ou r/brasil
- [ ] Influencer saúde/medicação (parceria)
- [ ] Lista email de interessados
- [ ] Meta: 50-200 testers ativos

### 9.3 Monitoramento
- [ ] Dashboards: crash rate, ANR rate, retention D1/D7/D30
- [ ] Alertas Sentry para regressões
- [ ] Reviews diárias do feedback
- [ ] Hotfixes em <48h pra bugs críticos

### 9.4 Critérios de saída
- [ ] Crash-free rate ≥99.5%
- [ ] ANR rate <0.5%
- [ ] Retention D7 ≥40%
- [ ] Avaliação média (beta) ≥4.3
- [ ] Pelo menos 50 testers ativos por 14 dias

---

## FASE 10 — Lançamento Público

### 10.1 Pré-lançamento
- [ ] Versão `1.0.0` final, build assinado
- [ ] Rollout gradual: 5% → 20% → 50% → 100% (a cada 24h se sem regressão)
- [ ] Página Play Store finalizada (screenshots, vídeo, descrição SEO)
- [ ] ASO (App Store Optimization): keywords título/subtítulo/descrição
- [ ] Press kit (logo, screenshots, descrição, contato)

### 10.2 Marketing
- [ ] Site oficial publicado (landing + blog + suporte)
- [ ] Posts redes sociais (Instagram, Twitter, LinkedIn)
- [ ] Email pra lista de interessados
- [ ] Product Hunt launch
- [ ] Indicação 3-5 sites/canais tech ou saúde

### 10.3 Programa de indicação
- [ ] User ganha 1 mês PRO grátis ao indicar 3 amigos que se cadastram
- [ ] Tracking UTMs pra medir canais

### 10.4 Suporte 24/48h
- [ ] Time de plantão na primeira semana
- [ ] Templates de resposta prontos
- [ ] FAQ atualizado com perguntas novas

**Validação fase 10:** primeira semana sem incidentes críticos, instalações dentro da meta.

---

## FASE 11 — Pós-lançamento e Operação

### 11.1 Monitoramento contínuo
- [ ] Dashboards saúde (DAU, MAU, retention, churn, ARPU)
- [ ] Funil conversão Free → PRO
- [ ] Crash rate semanal revisado
- [ ] Feedback in-app categorizado

### 11.2 Iteração
- [ ] Sprint quinzenal com priorização baseada em dados
- [ ] A/B test de paywall e onboarding
- [ ] Releases regulares (bi-semanal mínimo)

### 11.3 Crescimento
- [ ] Análise dos competidores
- [ ] Roadmap público com upcoming features
- [ ] Comunidade (Discord/Telegram)
- [ ] Programa afiliados (5-10% recorrente)

### 11.4 Operações de segurança
- [ ] Pen test anual obrigatório
- [ ] Review trimestral RLS + Edge Functions
- [ ] Atualização mensal de dependências
- [ ] Drill anual de disaster recovery

### 11.5 Expansão
- [ ] iOS via Capacitor (mesmo código)
- [ ] Internacionalização (en, es) se demanda confirmar
- [ ] Plano Family (até 5 usuários compartilhando)
- [ ] API pública para integrações (apenas PRO)

---

## STATUS GERAL

- **Total de fases:** 11 (mais Fase 0)
- **Concluídas (✅):** Fase 0, 1, 2, 2.5, 3
- **Em andamento:** Fase 4 (~80%)
- **Pendente:** Fases 4.5 → 11
- **Estimativa restante:** ~4-6 meses para lançamento público com qualidade
- **Versão atual:** 0.1.5.6 (dev — pre-1.0). v1.0 reservada pra Play Store launch.

## Riscos Críticos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Google rejeitar app (categoria saúde) | Média | Alto | Política privacidade robusta + não mencionar diagnóstico médico |
| Vazamento dados (LGPD) | Baixa | Crítico | RLS completo, CSP, sanitização, sem secrets no frontend |
| Multa LGPD por falta consentimento | Média | Alto | Checkbox consentimento, política publicada |
| Keystore perdido/corrompido | Baixa | Crítico | Backup em 3 locais seguros |
| Push FCM falhar background | Média | Médio | LocalNotifications + CriticalAlarm fallback |
| RevenueCat billing error | Baixa | Alto | Testar extensivamente sandbox |
| `admin_grant_tier` chamado por user malicioso | **Mitigado** | **Crítico** | RPC verifica `is_admin()` server-side ✅ |
| Bypass regras SOS via requisição direta | **Mitigado** | Alto | RPC `register_sos_dose` + trigger bloqueia INSERT direto ✅ |
| DoS via `durationDays` enorme → 100k doses | **Mitigado** | Alto | RPC valida limite 365 dias ✅ |
| Dados órfãos por DELETE parcial | **Mitigado** | Médio | FK ON DELETE CASCADE ✅ |
| Supabase auth token expirar offline | Média | Médio | `autoRefreshToken: true` + redirect Login ao falhar |
| Permissões especiais Android (full-screen, overlay) resetam após install | Média | Médio | PermissionsOnboarding re-aparece após APP_VERSION change ✅ |
