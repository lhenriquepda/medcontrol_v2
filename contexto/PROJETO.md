# Dosy — Contexto Completo do Projeto

> Documento para onboarding de IA. Leia do início ao fim antes de tocar em qualquer código.
> **Última revisão:** 2026-05-13 — master @ **v0.2.2.4** FECHADA (vc 62, tag `v0.2.2.4`, AAB Internal Testing pendente). **v0.2.2.4 entregou:** **#214 P2 CLEANUP:** Remove `dose_alarms_scheduled` tabela órfã (consumers removidos em #209). 3 mudanças: scheduler.js remove upsert + DosyMessagingService.java remove reportAlarmScheduled + Migration DROP TABLE. Economia ~5-10 MB/dia/device egress. Master @ **v0.2.2.3** FECHADA (vc 61, tag `v0.2.2.3`, AAB Internal Testing pendente). **v0.2.2.3 entregou:** **#213 P1 STORM REAL ROOT CAUSE:** Auditoria logcat Dosy-Dev (~6min) confirmou storm 60s exato vinha de `Dashboard.jsx:99 setInterval setTick(60s)` flipando `todayDoses` ref → useEffect Dashboard:222 chamando `scheduleDoses` redundante. App.jsx top-level signature guard v0.2.2.2 funcionando, mas Dashboard caller sem guard mantinha 1440 reschedules/dia. Fix mínimo: remove caller completo (vestígio pré-#198). Master @ **v0.2.2.2** FECHADA (vc 60 Internal Testing 2026-05-13 15:14 BRT, tag `v0.2.2.2`). **v0.2.2.2 entregou:** **#212 P1 STORM ROOT CAUSE:** Throttle v0.2.2.1 reduziu impacto mas root cause continuou (1.36 batches/min via audit polling 11min). 2 fixes: (a) `useRealtime.js WATCHDOG_INTERVAL_MS` 60s → 300s (5min); (b) `App.jsx useEffect` signature guard via `useMemo dosesSignature`. Esperado: ~10 rescheduleAll/dia (era ~2000, ~30-40 MB/dia egress/device). **Master @ v0.2.2.1** FECHADA (vc 59 Internal Testing 2026-05-13 13:53 BRT, tag `v0.2.2.1`). **v0.2.2.1 entregou:** **#211 P1 HOTFIX** Storm rescheduleAll 1×/min descoberto via audit v0.2.2.0 imediato pós-deploy: (a) `SCHEDULE_WINDOW_MS` 168h→48h alinha plan #209 (era hardcoded 168h mas comentário inline dizia 48h); (b) Throttle module-level rescheduleAll 30s com trailing run pattern — única execução em janela 30s, requests adicionais agendam single trailing run no fim da janela com last args; (c) Audit batch single insert via accumulator (1 insert/batch contendo batch_start + N scheduled + batch_end, antes era 10-100 inserts separados/batch); (d) GRANTS DB service_role + authenticated em alarm_audit_log/config (bug descoberto: tabelas criadas com RLS mas sem GRANTs table-level → Edge Functions e user client silenciava INSERTs). 868 storm rows passados limpos via DELETE direto. **v0.2.2.0 entregou:** **#210 NOVO P1** Sistema auditoria alarmes admin.dosymed.app: tabela `alarm_audit_log` + config whitelist `alarm_audit_config` (seed: lhenrique.pda@gmail.com); captura 6 caminhos (JS scheduler + Java AlarmScheduler/Worker/FCM + Edge daily-sync/trigger-handler); admin pages `/alarm-audit` (filtros + modal) + `/alarm-audit-config` (toggle por email); cron cleanup >7d. **v0.2.1.9 também fechada** (vc 57 publicado 10:09 BRT, substituído por vc 58 mesmo dia): **#209 NOVO P0** Refactor sistema alarmes + push pós 3 bugs reportados: (1) alarme "Sem Paciente" — `DoseSyncWorker` JOIN patients fix; (2) push 5am dose 8am — RPC `update_treatment_schedule` `AT TIME ZONE` correction + data-fix idempotente; (3) cascata Bug 2 — substituído sistema 5 caminhos por arquitetura unificada: `daily-alarm-sync` cron 5am BRT 48h horizon + `dose-trigger-handler` v16 com action `cancel_alarms` (DELETE/UPDATE status-change) + `AlarmScheduler.cancelAlarm` + `DosyMessagingService.handleCancelAlarms` + UNSCHEDULE crons antigos. Egress -99%. Plus fix #208 (VERSION_CODE_TO_NAME map). AAB vc 57 + Internal Testing pendente. Master @ **v0.2.1.8** FECHADA (vc 56 Internal Testing 2026-05-11 22:45 BRT, Vercel prod 2026-05-12 01:50 UTC, tag `v0.2.1.8` commit `b7b5c71`). **v0.2.1.8 entregou:** **#205 NOVO P0 single source refresh token** (storm xx:00 fix — `DoseSyncWorker.java` + `DosyMessagingService.java` removem chamadas paralelas `/auth/v1/token`; consomem `access_token` cached SharedPref atualizado pelo `useAuth.jsx` em SIGNED_IN/TOKEN_REFRESHED/INITIAL_SESSION via plugin `updateAccessToken(accessToken, accessTokenExp)`. JS supabase-js = ÚNICA fonte refresh. Antes: SQL revelou 20+ refreshes/min em xx:00 mesma session, lifespan 16min, user re-login 9-12h cycle). Plus #204 expand fixes A1/A2/B/C + optimistic CRUD completos (updatePatient/updateTreatment/pause/resume/end Treatment/registerSos) + forms PatientForm + TreatmentForm edit path offline + `useOfflineGuard` hook + `OfflineNotice` component pra features FORA queue (LGPD export/delete, shares, SOS rules, templates) com bloqueio + toast "Sem conexão — requer internet". 22 checks device-only S25 Ultra em [`Validar.md`](Validar.md). **Master @ v0.2.1.7 release fechada:** **#204 Mutation queue offline** (TanStack `networkMode: 'offlineFirst'` + `setMutationDefaults` por chave 12 mutations + bridge Capacitor.Network ↔ onlineManager + persist mutations + resumePausedMutations + OfflineBanner PT-BR) e **#207 Defesa em profundidade alarme crítico** (5 fixes: advanceMins fallback `?? 0`; SCHEDULE_WINDOW_MS 48h→168h + DoseSyncWorker HORIZON_HOURS 72→168; drop diff-and-apply idempotência; REQUEST_IGNORE_BATTERY_OPTIMIZATIONS manifest + plugin methods + UX onboarding; Sentry breadcrumbs). Plus reestruturação `contexto/` V2: README entry point bulletproof Passos 0-14 + novo `Validar.md` rastreio validações manuais entre sessões + memory project-scoped reorganizada. 10 checks device-only S25 Ultra em [`Validar.md`](Validar.md) (acumular). Antes: 10 itens fechados v0.2.1.5/v0.2.1.6: #195+#196 logout cascade fix (SIGNED_OUT spurious detection + push_sub preservada) + #197 cron notify-doses 1min fallback + #198 install/upgrade detection + skip scheduleDoses durante loading + #199 cleanup push_subs stale > 30d + #200+#200.1 HORIZON cron 30h + rescheduleAll idempotente + doc shadows + #201 telemetria auth events PT-BR + painel admin /auth-log + #202 mutex/debounce useAppResume previne refresh storm + #203 som alarme `dosy_alarm.mp3` 96kbps mono. Closed Testing track ATIVO desde 2026-05-06 (#130 #158 resolvidos).

---

## 1. O que é o projeto

App Android nativo (Capacitor) **+ PWA mobile-first** de **gestão de medicamentos** em pt-BR, marca **Dosy** (originalmente MedControl). Usuário cadastra **pacientes** (filhos, familiares, ele mesmo, terceiros sob cuidado), cria **tratamentos** por medicamento e acompanha **doses** agendadas no dashboard diário. Inclui modo SOS para doses de resgate, análises de adesão, exportação de relatórios PDF/CSV, alarme estilo despertador (plugin nativo Android), notificações FCM, sistema de assinaturas Free/Plus/Pro/Admin e atualizações in-app via Google Play.

**Público-alvo (amplo, não restrito a uma persona):**
- Pais com crianças em tratamento (antibióticos, vitaminas, medicações contínuas)
- Pessoas organizadas que tomam múltiplos medicamentos diários (cardio, ansiolíticos, hormônios, suplementação)
- Cuidadores formais ou informais (acompanham doses de terceiros)
- Clínicas, consultórios e equipes de saúde (gerenciam adesão de pacientes)
- Hospitais e instituições de longa permanência (auxílio operacional + handoff entre turnos)
- Idosos auto-gerindo medicação (uma persona dentre várias, não a única)

Decisões de UX devem balancear todas essas personas — letras legíveis e fluxos simples NÃO significam "design só pra idosos", significa **design universal** que serve do adolescente em tratamento crônico ao cuidador profissional.

**Repositório:** https://github.com/lhenriquepda/medcontrol_v2
**Deploy web (Vercel):** https://dosy-app.vercel.app
**Deploy Android (Play Store):** **Internal Testing ativo** — `com.dosyapp.dosy` versionCode 43 / versionName 0.2.0.10. Closed Testing externo via Google Group #129-#133 pendente. BUG-016 fechado 100%; #084-#095 fechados v0.1.7.x; redesign v0.2.0.0; #099-#123 + #126 fechados em v0.2.0.1-v0.2.0.5; #010 + #017 fechados v0.2.0.6; v0.2.0.7 FLAG_SECURE off Dev + StatusBar tema; v0.2.0.8 P0 egress fixes #127 + #134-#136 + assets store + vídeo FGS + auditoria egress; v0.2.0.9 P1 egress fixes #137 (Dashboard 4→1) + #138 (DOSE_COLS_LIST) + #128 (patientName Edge) + filter '10 dias'; v0.2.0.10 P2 egress #139 (trigger 6h) + #140 (cron 24h) + #141 (shares 5min) + #143 (getSession) + #142 cleanup JWT cron + #147 BUG-041 catalogado; v0.2.0.11 P2 estrutural #144 (JWT claim tier Auth Hook) + #145 (realtime scoped refetch) + #146 (cron audit log) + #029 refactor Settings split + #030 split notifications + #034 virtualizar DoseHistory + #100 avatar emoji redesign + #009 PITR deferred (DR drill via daily backup).

**Supabase plano:** Pro (upgrade 2026-05-05). Considerar downgrade Free pós validação 26 mai cycle.
**Dev local:** `npm run dev` (web) / Android Studio Run (mobile) em `G:/00_Trabalho/01_Pessoal/Apps/medcontrol_v2`

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| UI | React 19 + Vite 5.4 + Tailwind 3 (darkMode: 'class') |
| Animações | framer-motion 11 |
| Roteamento | React Router DOM v6 |
| Estado servidor | TanStack React Query v5 + PersistQueryClient (localStorage, 24h TTL) |
| Backend | Supabase (projeto `guefraaqbkcehofchnrc`, nome `dosy-app`) |
| Schema DB | `medcontrol` (dedicado, isolado do `public`) |
| Auth | Supabase Auth email/senha + metadata (name) — SecureStorage Android (KeyStore AES-256) |
| Realtime | Supabase Realtime (postgres_changes) — pause/resume Capacitor lifecycle |
| Push servidor | FCM HTTP v1 API + JWT OAuth (Firebase project `dosy-b592e`) — Edge Function `notify-doses` |
| Push web (legado) | Web Push API + VAPID (mantido como fallback web) |
| Service Worker | `public/sw.js` — cache network-first + scheduling local web |
| Plugin nativo | **CriticalAlarm** (Java) — alarme estilo despertador, fullscreen, USAGE_ALARM, FG service, lockscreen overlay |
| Mobile shell | Capacitor 8.3 + Android API 26-36 |
| App update | Google Play In-App Updates flexible mode — `@capawesome/capacitor-app-update` |
| Storage nativo | `@aparajita/capacitor-secure-storage` (Android KeyStore) |
| Biometria | `@aparajita/capacitor-biometric-auth` |
| PDF | jsPDF + html2canvas (native) / `window.print()` (web) |
| File share native | `@capacitor/filesystem` + `@capacitor/share` |
| Connectivity | `@capacitor/network` |
| Privacy screen | `@capacitor-community/privacy-screen` (recents blur) |
| Anúncios | AdSense (web) / AdMob `@capacitor-community/admob` (native — banner top, ADAPTIVE_BANNER) |
| Crash monitoring | `@sentry/react` 10.x + `@sentry/capacitor` 3.x (PROD only, beforeSend strips PII) |
| Product analytics | `posthog-js` 1.x (PROD only) |
| Deploy web | Vercel CLI (`vercel deploy --prod`) |
| Deploy Android | Android Studio (build local) ou GitHub Actions → Play Store |
| PWA | manifest.webmanifest + ícones PNG na raiz |
| Monetização | Free/Plus/Pro/Admin — RevenueCat planejado (Fase 3 pendente) |

---

## 3. Variáveis de ambiente

### `.env.local` (NÃO commitado — copiar de `.env.example`):
```
VITE_SUPABASE_URL=https://guefraaqbkcehofchnrc.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key painel Supabase>
VITE_SUPABASE_SCHEMA=medcontrol
VITE_VAPID_PUBLIC_KEY=<chave VAPID pública>
VITE_ADSENSE_CLIENT=         # opcional, web only
VITE_ADSENSE_SLOT=           # opcional, web only
VITE_ADMOB_BANNER_ANDROID=   # ad unit ID real (test ID padrão se vazio)
VITE_ADMOB_USE_TEST=true     # toggle test/real ad
VITE_SENTRY_DSN=             # opcional, prod monitoring
VITE_POSTHOG_KEY=            # opcional, prod analytics
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

### `.env.local` (root, gitignored — secrets locais Claude/scripts):
```
SUPABASE_PAT=sbp_...         # Personal Access Token Supabase Management API
SENTRY_AUTH_TOKEN=sntryu_... # Sentry API token (manual ops)
```

### Vercel production:
Mesmas vars do bloco acima. **`.env.production` é gitignored** (Vercel CLI gera com OIDC token sensível).

### Supabase Edge Function secrets:
```
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY     # NUNCA documentar
VAPID_SUBJECT=mailto:dosy.med@gmail.com
FIREBASE_PROJECT_ID=dosy-b592e
FIREBASE_CLIENT_EMAIL=<service account email>
FIREBASE_PRIVATE_KEY  # NUNCA documentar
SUPABASE_SERVICE_ROLE_KEY  # usado apenas dentro de Edge Functions
```

### CI/CD secrets (GitHub Actions):
Ver `docs/play-store/ci-setup.md` — `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON`, `VITE_*` acima.

> **NUNCA commitar valores reais.** `.env.production`, `INFOS.md`, `keystore.properties`, `*.keystore`, `*.jks` no `.gitignore`.

---

## 4. Banco de dados Supabase

**Projeto:** `guefraaqbkcehofchnrc` (`dosy-app`) — projeto dedicado, sem compartilhamento.

### Schema `medcontrol` — tabelas principais:

```
patients            — id, "userId", name, age, avatar, photo_url, weight, condition, doctor, allergies
treatments          — id, "userId", "patientId", "medName", unit, "intervalHours", "durationDays",
                      "startDate", "firstDoseTime", status, "isTemplate", "isContinuous",
                      "doseHorizon" (jsonb interno)
doses               — id, "userId", "treatmentId", "patientId", "medName", unit,
                      "scheduledAt", "actualTime", status, type, observation
                      CHECK observation length ≤ 500 (LGPD data minimization)
sos_rules           — id, "userId", "patientId", "medName", "minIntervalHours", "maxDosesIn24h"
treatment_templates — modelos por usuário
subscriptions       — "userId" PK, tier, "expiresAt", source, "consentAt", "consentVersion" (LGPD)
user_prefs          — user_id PK, prefs (jsonb), updatedAt
                      → push, criticalAlarm, advanceMins, dailySummary, summaryTime, dnd*
push_subscriptions  — id, "userId", endpoint, keys (JSONB), "deviceToken", platform,
                      "advanceMins", "userAgent" (simplificado), "createdAt"
admins              — user_id PK, added_at, added_by — controla quem é admin (sem hardcoded)
security_events     — id, user_id, event_type, ip_address, user_agent, metadata, created_at
                      → log auditoria LGPD
patient_shares      — id, "patientId", "ownerId", "sharedWithUserId" → cuidadores
```

> **camelCase no DDL:** colunas entre aspas (`"userId"`, `"scheduledAt"`). Não remover.

### RLS:
**Todas** tabelas têm `rowsecurity=true`. Policies por `auth.uid()` + `has_patient_access()` em doses/treatments.

### Funções (SECURITY DEFINER):

**Tier/admin:**
```
is_admin()                       — SELECT 1 FROM admins WHERE user_id = auth.uid()
effective_tier(uid)              — 'admin'|'pro'|'plus'|'free' respeitando expiresAt
my_tier()                        — atalho effective_tier(auth.uid())
admin_grant_tier(target, tier, expires, src) — verifica is_admin() server-side, log security_events
admin_list_users()               — lista bypass RLS
```

**Doses (server-side state machine):**
```
register_sos_dose(patientId, medName, unit, scheduledAt, observation)
                                 — valida minIntervalHours/maxDosesIn24h server-side
confirm_dose(p_dose_id, p_actual_time, p_observation)  — pending|overdue → done
skip_dose(p_dose_id, p_observation)                    — pending|overdue → skipped
undo_dose(p_dose_id)                                   — done|skipped → pending
create_treatment_with_doses(payload jsonb, p_timezone) — atomic, valida ownership, durationDays ≤ 365
update_treatment_schedule(payload)                     — regenera doses atomicamente
has_patient_access(patient_id)                         — true se ownership ou patient_shares
```

**Push:**
```
upsert_push_subscription(p_device_token, p_platform, p_advance_mins, p_user_agent)
```

**Compartilhamento:**
```
share_patient_by_email(patient_id, email)
list_patient_shares(patient_id)
unshare_patient(share_id)
```

**LGPD:**
```
delete_my_account()              — cascata + Edge Function delete-account chama
                                   service_role auth.admin.deleteUser
```

**Triggers ATIVOS:**
```
on_new_user_subscription          AFTER INSERT auth.users → cria subscription free
on_auth_user_signup_plus          AFTER INSERT auth.users → handle_new_user_plus_promo()
                                  → cria subscription tier='plus' source='beta_promo'
                                  PROMO TEMPORÁRIA durante closed testing
enforce_patient_limit             BEFORE INSERT patients → bloqueia free >1
enforce_sos_via_rpc_trigger       BEFORE INSERT doses (type=sos) → força via RPC
```

### Constraints:
- `doses_observation_length` CHECK length ≤ 500 (LGPD)
- `doses_status_check` IN (pending|overdue|done|skipped)
- `doses_type_check` IN (scheduled|sos)
- `treatments_status_check` IN (active|ended|paused)
- `subscriptions_tier_check` IN (free|plus|pro|admin)
- **ON DELETE CASCADE** em todas FKs

### pg_cron:
```
anonymize-old-doses    — Domingos 3h UTC, anonimiza observation +3 anos (LGPD retenção)
```

### Auth Dashboard:
- `mailer_autoconfirm=false` (confirmação email obrigatória)
- `rate_limit_otp=5`, `rate_limit_token_refresh=150`

### Edge Functions:
```
notify-doses          — FCM HTTP v1 (cron 5min externo dispara)
delete-account        — service_role + RPC delete_my_account
send-test-push        — admin debug
```

---

## 5. Estrutura de arquivos

```
src/
├── main.jsx                    # PersistQueryClient (24h TTL), StatusBar (native), Sentry/PostHog init
├── App.jsx                     # Rotas + AppHeader + BottomNav + UpdateBanner + listeners notif
│                                 # + Capacitor back button + DailySummaryModal + PermissionsOnboarding
│                                 # + APP-LEVEL RESCHEDULE (useEffect watches useDoses + usePatients)
├── animations.js               # TIMING + EASE constants framer-motion
│
├── pages/
│   ├── Login.jsx               # Auth + validatePassword + checkbox consentimento LGPD
│   ├── Dashboard.jsx           # Stats, FilterBar, doses agrupadas, doseQueue (modal queue)
│   ├── Patients.jsx
│   ├── PatientForm.jsx         # CRUD paciente + foto data: URL (sem compressão — débito)
│   ├── PatientDetail.jsx       # Detalhe + shares
│   ├── TreatmentForm.jsx       # CRUD via RPC create_treatment_with_doses
│   ├── TreatmentList.jsx
│   ├── DoseHistory.jsx
│   ├── SOS.jsx                 # Dose SOS via RPC register_sos_dose
│   ├── Analytics.jsx           # PRO (LockedOverlay free)
│   ├── Reports.jsx             # PDF/CSV — native: jsPDF+html2canvas+Filesystem+Share
│   ├── Settings.jsx            # Tema, push, antecedência, exportar dados, excluir conta
│   ├── More.jsx
│   ├── Admin.jsx               # Painel admin (tier management)
│   ├── FAQ.jsx                 # Perguntas frequentes (rota /faq pública)
│   ├── Privacidade.jsx         # /privacidade — política completa LGPD
│   ├── Termos.jsx              # /termos
│   ├── ResetPassword.jsx
│   └── Install.jsx             # /install — instruções Android APK (legacy backup)
│
├── components/
│   ├── AppHeader.jsx           # Sticky z-40, dosy-logo-light, badge atrasadas
│   │                             # mede própria altura → CSS var --app-header-height
│   ├── Header.jsx              # Header interno não-sticky
│   ├── BottomNav.jsx
│   ├── FilterBar.jsx           # Sticky offset = ad + update + app-header heights
│   ├── DoseCard.jsx
│   ├── DoseModal.jsx
│   ├── MultiDoseModal.jsx      # 3 actions inline + auto-close 1500ms + inline Desfazer
│   ├── DailySummaryModal.jsx
│   ├── PatientCard.jsx
│   ├── TierBadge.jsx           # 3 variants: dot (header), badge (default), large (Settings)
│   ├── AdBanner.jsx            # Web AdSense in-flow (native usa hook root-level)
│   ├── UpdateBanner.jsx        # Sticky + mede altura → CSS var --update-banner-height
│   │                             # Toggle body.has-update-banner → bleed status bar verde
│   ├── PermissionsOnboarding.jsx  # Modal pos-login (Notif/Exact/FSI/Overlay)
│   ├── OnboardingTour.jsx
│   ├── PaywallModal.jsx
│   ├── BottomSheet.jsx         # createPortal + safe-bottom + pb-5
│   ├── ConfirmDialog.jsx       # Wrapper BottomSheet
│   ├── EmptyState.jsx
│   ├── ErrorBoundary.jsx
│   ├── Field.jsx
│   ├── Icon.jsx                # Lucide flat / emoji legacy via prefs
│   ├── MedNameInput.jsx
│   ├── PatientPicker.jsx
│   ├── Dropdown.jsx
│   ├── Skeleton.jsx
│   ├── LockedOverlay.jsx
│   ├── SharePatientSheet.jsx
│   └── AnimatedRoutes.jsx
│
├── hooks/
│   ├── useAuth.jsx             # signOut limpa localStorage notif/dashCollapsed + qc.clear()
│   ├── useDoses.js             # useConfirmDose/useSkipDose/useUndoDose via RPCs + refetchInterval 60s
│   ├── usePatients.js
│   ├── useTreatments.js        # via RPC create_treatment_with_doses
│   ├── useSubscription.js      # useMyTier (staleTime 60s)
│   ├── useUserPrefs.js         # DEFAULT_PREFS: push:true, advanceMins:0, dailySummary:true,
│   │                             # summaryTime:'12:00', criticalAlarm:true
│   ├── usePushNotifications.js # Re-export useNotifications (notifications.js)
│   ├── useRealtime.js          # Cap pause/resume reconnection
│   ├── useShares.js
│   ├── useTheme.jsx
│   ├── useToast.jsx
│   ├── useOnlineStatus.js
│   ├── usePullToRefresh.js
│   ├── useAdMobBanner.js       # NOVO: hook root-level singleton AdMob (App.jsx mount)
│   │                             # listeners bannerAdSize/Loaded/Failed, +16px buffer
│   ├── useAppUpdate.js         # NOVO: Google Play In-App Updates (native) + Vercel /version.json (web)
│   ├── useAppResume.js         # NOVO: cap appStateChange + visibilitychange + focus
│   │                             # cold-resume >5min → window.location.href='/'
│   ├── useAppLock.js           # ⚠️ HOOK EXISTE MAS NÃO MONTADO (regressão pendente)
│   ├── usePrivacyScreen.js     # @capacitor-community/privacy-screen wrapper
│   ├── useUndoableDelete.js    # Toast undo wrap pra deletes
│   └── useUserMedications.js   # Autocomplete med names do user
│
├── services/
│   ├── supabase.js             # SecureStorage adapter (native: KeyStore) / localStorage (web)
│   │                             # detectSessionInUrl: false (native), schema medcontrol
│   ├── dosesService.js         # RPCs (confirm/skip/undo/sos), select com colunas explícitas
│   ├── treatmentsService.js    # CONTINUOUS_DAYS=90, RPCs atomicas
│   ├── patientsService.js
│   ├── subscriptionService.js  # FREE_PATIENT_LIMIT=1, getMyTier (free → plus promo), grantTier
│   ├── sharesService.js
│   ├── notifications.js        # MASTER: rescheduleAll, scheduleDoses, subscribeFcm,
│   │                             # DND logic (inDnd), groupByMinute, filterUpcoming
│   │                             # Suprime LocalNotif quando criticalAlarm vai tocar
│   ├── criticalAlarm.js        # Bridge plugin: schedule/scheduleGroup/cancel/cancelAll/
│   │                             # checkAllPermissions/openSettings*
│   ├── analytics.js            # NOVO: PostHog wrapper + EVENTS dict
│   └── mockStore.js            # Demo: sessionStorage (LGPD — não persiste cross-session)
│
├── utils/
│   ├── dateUtils.js
│   ├── generateDoses.js        # Legacy — agora server-side via create_treatment_with_doses
│   ├── statusUtils.js
│   ├── tierUtils.js
│   ├── userDisplay.js
│   ├── sanitize.js             # escapeHtml — Reports PDF (XSS)
│   └── uuid.js                 # NOVO: polyfill crypto.randomUUID (Android 11 webview crash)
│
└── data/
    ├── medications.js          # Autocomplete
    └── faq.js                  # Conteúdo FAQ.jsx

public/
├── sw.js                       # SW v5 (web only — ignorado em Capacitor)
├── manifest.webmanifest
├── version.json                # Atualizado a cada build (vite plugin) — useAppUpdate web check
├── dosy-logo.png / dosy-logo-light.png
├── icon-*.png / apple-touch-icon.png / favicon-64.png

android/
├── app/
│   ├── google-services.json    # Firebase config (FCM)
│   ├── build.gradle            # versionCode 25 / versionName 0.1.7.1
│   │                             # signingConfigs.release env-based
│   └── src/main/
│       ├── AndroidManifest.xml # Permissions + AlarmActionReceiver registrado
│       ├── res/values/colors.xml  # NOVO
│       ├── res/drawable*/splash.webp  # WebP convertido (~10x menor que PNG)
│       ├── res/drawable/splash_icon.png  # Logo escalado 0.55 (anti-crop)
│       └── java/com/dosyapp/dosy/
│           ├── MainActivity.java
│           └── plugins/criticalalarm/
│               ├── CriticalAlarmPlugin.java     # bridge + isEnabled (FSI real check)
│               ├── AlarmReceiver.java           # broadcast → AlarmService FG
│               ├── AlarmService.java            # FG service: som + 3 actions notif persistente
│               │                                  # ACTION_MUTE/UNMUTE/STOP intents
│               ├── AlarmActivity.java           # UI fullscreen sem dismissKeyguard
│               │                                  # ouve broadcast FINISH_ALARM_ACTIVITY
│               ├── AlarmActionReceiver.java     # NOVO: Ciente/Adiar/Ignorar via notif
│               └── BootReceiver.java            # re-agenda boot, fallback schema legacy

supabase/
├── functions/
│   ├── notify-doses/index.ts
│   ├── delete-account/index.ts
│   └── send-test-push/index.ts
└── migrations/                 # versionadas

docs/
├── RIPD.md                     # Relatório Impacto Proteção Dados (LGPD)
├── beta-feedback-form.md
├── device-validation-checklist.md
├── launch-metrics.md
├── launch-posts.md
├── support-sla.md
├── play-store/
│   ├── app-title.txt
│   ├── description-short.txt
│   ├── description-long.txt
│   ├── release-notes.md
│   ├── seo-metadata.md
│   ├── keystore-instructions.md
│   ├── ci-setup.md
│   └── whatsnew/whatsnew-pt-BR
└── archive/                    # Plan-* legacy backups

resources/
├── icon-512.png / logo-light.png / logo-dark.png
├── feature-graphic.png         # Play Store 1024×500
├── icon-padded-preview.png
└── screenshots/                # 6 telas Play Store

tools/                          # Scripts dev
├── extract-spki.cjs            # SSL pinning hash
├── test-sos-bypass.cjs
├── capture-screen.ps1          # NOVO
└── ...

.github/workflows/
├── ci.yml
└── android-release.yml         # signed AAB + Play Store upload

capacitor.config.ts             # appId com.dosyapp.dosy
Plan.md                         # Roadmap detalhado (fonte de verdade)
```

---

## 6. Funcionalidades detalhadas

### Pacientes
- Cadastro nome + avatar emoji + foto opcional
- RLS por usuário + compartilhamento via `patient_shares`
- Free: máximo 1 paciente (trigger server-side + `PaywallModal` client)
- **Débito:** foto sem compressão (data: URL inflado)

### Tratamentos
- Medicamento, unit, intervalo, horários múltiplos, data início, duração
- **Uso contínuo** (`isContinuous`): `CONTINUOUS_DAYS = 90`
- Intervalos: 4h / 6h / 8h / 12h / 1x/dia / 2-em-2-dias / 3-em-3-dias / 1x/semana / quinzenal / 1x/mês
- Templates reutilizáveis
- **Geração server-side** via RPC `create_treatment_with_doses` (atomic, durationDays ≤ 365)
- Edição regenera doses futuras via `update_treatment_schedule`
- **Débito:** modo 'times' salva `dailyTimes` JSON em `firstDoseTime` (overload schema)
- **Débito:** `extend_continuous_treatments` RPC removida — comentado em `Dashboard.jsx:6,34-41,150` — contínuo após 90d sem renovação

### Doses — ciclo de vida
```
pending → done    (RPC confirm_dose)
pending → skipped (RPC skip_dose)
done/skipped → pending (RPC undo_dose)
overdue           (calculado client-side: scheduledAt no passado + status pending)
```
- Períodos: 12h / 24h / 48h / 7d / tudo
- Filtros: status, tipo, paciente
- Optimistic update via `patchDoseInCache` + rollback
- **App-level reschedule:** `App.jsx` watches `useDoses` + `usePatients` → mark/skip/undo cancela alarme automaticamente

### SOS
- Dose extra via RPC `register_sos_dose` — valida `minIntervalHours`/`maxDosesIn24h` server-side
- INSERT direto bloqueado por trigger

### Dashboard
- Stats: pendentes hoje, % adesão 7d, atrasadas (30d)
- Doses agrupadas por paciente (collapsible, localStorage)
- Badge "N atrasadas" no AppHeader → `?filter=overdue`
- **Modal queue** (notif tap): `?dose=ID` ou `?doses=A,B,C` → MultiDoseModal Ignorar/Pular/Tomada
- FilterBar sticky offset dinâmico (ad + update + app-header)

### Notificações — sistema unificado

**3 canais de aviso:**

1. **CriticalAlarm (plugin nativo Android — primário)**
   - `AlarmManager.setAlarmClock` (bypass Doze)
   - `AlarmReceiver` → `AlarmService` (FG service `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`)
   - Service mantém `MediaPlayer` USAGE_ALARM loop + vibração + FG notif persistente
   - **FG notif tem 3 action buttons:** Ciente / Adiar 10min / Ignorar (`AlarmActionReceiver`)
   - **Activity = só UI:** mute/handleAction comandam Service via Intent
   - `AlarmActivity` fullscreen sobre lockscreen (sem `requestDismissKeyguard` no onCreate)
   - Tap "Ciente" → dismiss keyguard + open MainActivity com `openDoseIds`
   - **Agrupa doses por minuto:** mesmo horário = 1 alarme + 1 notif lista
   - Plugin floor `triggerAt` para boundary minuto (anti drift segundos)
   - `BootReceiver` re-agenda após reboot (fallback schema legacy)
   - Channel: `doses_critical` IMPORTANCE_HIGH bypass DND

2. **LocalNotifications (Capacitor — fallback DND)**
   - `usePushNotifications.scheduleDoses` agenda via `@capacitor/local-notifications`
   - **Suprimida quando `shouldRing` true** (anti-duplicate notif)
   - Só dispara em DND ou quando criticalAlarm desligado
   - Channel: `doses_v2`

3. **FCM (server-side, fallback last-resort)**
   - Edge Function `notify-doses` envia via FCM HTTP v1 API
   - Cron externo chama Edge Function a cada 5 min
   - Suprimido foreground (sem dup)

**`useUserPrefs.DEFAULT_PREFS` (novo signup):**
```
push: true,              criticalAlarm: true,
dailySummary: true,      summaryTime: '12:00',
advanceMins: 0,          (Na hora — alarme exato)
dndEnabled: false,       dndStart: '23:00', dndEnd: '07:00'
```

**Persistência:** prefs salvas em `medcontrol.user_prefs` (JSONB) + cache `localStorage['medcontrol_notif']`. Cross-device + cross-reinstall por user.

**Reschedule triggers:**
- App mount com user
- `useDoses` data change (mutation invalidates query → effect re-fires)
- `usePatients` data change
- ⚠️ **NÃO dispara automaticamente em `useUpdateUserPrefs`** — débito conhecido

**Fluxo notif tap:**
- Tap heads-up notif → `MainActivity` com `openDoseIds` → JS event `dosy:openDoses` → `?doses=A,B,C`
- Tap AlarmActivity Ciente → mesmo fluxo
- Dashboard `doseQueue` → MultiDoseModal abre com primeira → fechar avança próxima

### Atualizações in-app (UpdateBanner)

- **Native (Android):** Google Play In-App Updates **flexible mode**
  - Banner persistente quando Play reporta update disponível
  - Não-dismissável (force update flow)
  - Tap "Atualizar" → Play prompt nativo → download bg → restart prompt
  - Source of truth = Play Console (publish nova versão = banner aparece automaticamente)
  - Plugin: `@capawesome/capacitor-app-update`
- **Web:** check `https://dosy-app.vercel.app/version.json` a cada 30min + onFocus
  - Banner dismissable (close X)
  - Tap → window.location.reload()
- Debug toggle: `window.__dosyForceUpdate = true` em DevTools

### Permissions Onboarding
- Modal pós-login (`PermissionsOnboarding.jsx`)
- Checa: `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT` (Android 14+ real check), `SYSTEM_ALERT_WINDOW`
- Cada item abre Settings nativo correspondente
- Storage: `dosy_permissions_dismissed_version` — re-prompt após update (toggles especiais resetam)

### AdMob banner

- Hook root-level singleton `useAdMobBanner` em `App.jsx`
- ADAPTIVE_BANNER TOP_CENTER
- Listeners: `bannerAdSize` (+16px buffer pra evitar overlap), `bannerAdLoaded`, `bannerAdFailedToLoad`
- Pre-aplica `--ad-banner-height: 76px` antes do showBanner (evita race com sticky header)
- Hide branch quando `showAds=false` (logout, Pro/Admin upgrade runtime)
- `body.has-ad-banner` class controla padding-top
- Toggle test/real via `VITE_ADMOB_USE_TEST=true`

### Status bar bleed (layout)

- `body::before` fixed pinta env-safe + ad-banner-height area
- z-index 30 (abaixo header z-40 e UpdateBanner z-50)
- Cor dinâmica:
  - Default: `#0d1535` (header dark)
  - `body.has-update-banner`: `#059669` (emerald-600 — match UpdateBanner)
- Independente de scroll (não vaza conteúdo atrás do header)

### Relatórios (PRO)
- **PDF native:** html2canvas → jsPDF → Filesystem Cache → Share sheet
- **PDF web:** `window.print()` em janela nova
- **CSV:** UTF-8 BOM + Filesystem + Share native
- Filename pattern: `dosy-[paciente|todos]-[YYYYMMDD]-[hash].[ext]`
- Salva em `Directory.Documents` (persistente)

### Branding Dosy
- Logo: `dosy-logo-light.png` (fundo escuro) / `dosy-logo.png` (fundo claro)
- Cor primária: `#0d1535` (dark navy)
- Splash WebP (logo escala 0.55 anti-crop Android 12+ Splash API)
- Ícones PWA + adaptive icon Android

### LGPD Compliance
- `/privacidade` + `/termos` rotas públicas
- Checkbox consentimento explícito no cadastro (gravado em `subscriptions.consentAt` + `consentVersion`)
- Exportação completa JSON (Settings → exportar dados)
- Exclusão de conta (RPC `delete_my_account` + Edge Function `delete-account`)
- Anonimização automática doses +3 anos (pg_cron)
- Senhas fortes (8+ chars, maiúscula, número)
- `observation` ≤ 500 chars
- `userAgent` simplificado
- `security_events` log auditoria
- `docs/RIPD.md` documentação ANPD
- Privacy Screen Android (recents blur)

---

## 7. AppHeader (componente global)

```jsx
// App.jsx — autenticado
<UpdateBanner />     // sticky top env-safe + ad
<AppHeader />        // sticky top env-safe + ad + update-banner
<main>
  <Routes>...</Routes>
  <BottomNav />
</main>
```

- Logo `dosy-logo-light.png` clicável → `/`
- Saudação + `<TierBadge variant="dot" />` (bolinha colorida)
- Badge "N atrasadas" (animate-pulse) → `nav('/?filter=overdue')`
- Link engrenagem → `/ajustes`
- Header interno (`Header.jsx`) **não sticky**
- Padding-top dinâmico: `max(env-safe - ad - update, 0)` (anti double-padding)
- Mede própria altura → `--app-header-height` CSS var

---

## 8. Plugin CriticalAlarm (Android nativo)

**Pacote:** `com.dosyapp.dosy.plugins.criticalalarm`

**Arquivos Java:**
- `CriticalAlarmPlugin.java` — bridge: `schedule/scheduleGroup/cancel/cancelAll/isEnabled/checkPermissions/openExactAlarmSettings/openFullScreenIntentSettings/openOverlaySettings/openAppNotificationSettings`
  - `isEnabled` retorna `canScheduleExact` + `canFullScreenIntent` (real check Android 14+)
  - `scheduleInternal` floor `triggerAt` para minuto exato
- `AlarmReceiver.java` — BroadcastReceiver fired por AlarmManager → starta AlarmService FG (fallback heads-up notif se startForegroundService falhar)
- `AlarmService.java` — FG service:
  - MediaPlayer USAGE_ALARM looping + Vibrator pattern
  - FG notif IMPORTANCE_HIGH com 3 action buttons (PendingIntent → AlarmActionReceiver)
  - Tap notif → re-abre AlarmActivity
  - Direct startActivity AlarmActivity (BAL via SYSTEM_ALERT_WINDOW)
  - ACTION_STOP/MUTE/UNMUTE intents
  - `static stopActiveAlarm(Context)`
- `AlarmActivity.java` — Fullscreen Activity:
  - `setShowWhenLocked(true)` + `setTurnScreenOn(true)` — sem `requestDismissKeyguard` no onCreate
  - Lista cards (medName, unit, patientName, scheduledAt time)
  - Botões: Mute (toggle Service), Adiar 10min, Ciente, Ignorar
  - Tap Ciente → dismiss keyguard + openApp
  - Ouve broadcast `FINISH_ALARM_ACTIVITY` (close quando user resolve via notif action)
  - Service-driven sound (Activity NÃO toca som próprio)
- `AlarmActionReceiver.java` — handle Ciente/Adiar/Ignorar inline notif
  - Stop service + cancel notifs + send finish broadcast
  - Snooze re-schedule via setAlarmClock
- `BootReceiver.java` — re-agenda após `BOOT_COMPLETED`/`LOCKED_BOOT_COMPLETED`/`MY_PACKAGE_REPLACED` (fallback schema flat → doses[] JSON)

**JS bridge:** `src/services/criticalAlarm.js`

**Permissões necessárias (manifest):**
```
USE_FULL_SCREEN_INTENT          # Android 14+ — requer user grant
SYSTEM_ALERT_WINDOW             # BAL bypass — requer user grant
SCHEDULE_EXACT_ALARM
USE_EXACT_ALARM
FOREGROUND_SERVICE
FOREGROUND_SERVICE_SPECIAL_USE  # com PROPERTY_SPECIAL_USE_FGS_SUBTYPE = "medication_reminder"
ACCESS_NOTIFICATION_POLICY      # bypass DND
RECEIVE_BOOT_COMPLETED
WAKE_LOCK
VIBRATE
TURN_SCREEN_ON
DISABLE_KEYGUARD
POST_NOTIFICATIONS              # Android 13+
```

**Bugs/débitos conhecidos:**
- ⚠️ `AlarmService.activePlayer/activeVibrator` static — race em multi-alarm
- ⚠️ Snooze não persiste DB — próximo `rescheduleAll` cancela snooze
- ⚠️ "Ciente" não confirma dose — re-agendamento dispara alarme novamente
- ⚠️ Boot perde doses durante device-off (sem catch-up)

---

## 9. Service Worker (`public/sw.js`)

**Cache version:** `medcontrol-v5`

```
install  → caches base
activate → deleta caches antigos
fetch    → cross-origin? bypass (não cacheia Supabase)
           navegação? network-first com cache fallback
           asset? stale-while-revalidate
push     → notificação (web only — native usa CriticalAlarm)
notificationclick → snooze 15min ou abre app
message  → SCHEDULE_DOSES / CLEAR_SCHEDULE
```

> SW só ativo em **modo web**. Capacitor WebView ignora.

---

## 10. TanStack React Query — padrões

### QueryClient (main.jsx):
```js
queries: { staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true,
           refetchOnReconnect: true, retry: 1, gcTime: 24h }
mutations: { retry: 3, retryDelay: exponential backoff (max 30s) }
```

### PersistQueryClientProvider:
- localStorage (`dosy-query-cache`)
- maxAge 24h, buster `v1`

### Query keys:
```
['patients']                ['treatments', filter]      ['doses', filter]
['sos_rules', patientId]    ['my_tier']                  ['admin_users']
['patient_shares']          ['user_prefs']               ['templates']
```

### Optimistic update doses:
```js
onMutate: async ({ id, ... }) => {
  await qc.cancelQueries({ queryKey: ['doses'] })
  const snapshots = patchDoseInCache(qc, id, { status: 'done', ... })
  return { snapshots }
},
onError: (_e, _v, ctx) => rollback(qc, ctx?.snapshots),
onSettled: () => refetchDoses(qc)
```

### Notas:
- `getQueryCache().findAll()` + loop manual (mais confiável que `setQueriesData` em v5)
- `invalidateQueries({ refetchType: 'active' })` em `useDoses` mutations (lazy refetch only active observers)

---

## 11. Constantes importantes

| Constante | Arquivo | Valor | Descrição |
|---|---|---|---|
| `CONTINUOUS_DAYS` | `treatmentsService.js` | `90` | Uso contínuo |
| `refetchInterval` | `useDoses.js` | `60_000` ms | Refetch doses/min |
| `SCHEDULE_WINDOW_MS` | `notifications.js` | `48 * 3600 * 1000` ms | Janela scheduling |
| `STALE_RELOAD_THRESHOLD_MS` | `useAppResume.js` | `5 * 60_000` | Cold reload threshold |
| `CHECK_INTERVAL_MS` | `useAppUpdate.js` | `30 * 60_000` | Web update poll |
| `FREE_PATIENT_LIMIT` | `subscriptionService.js` | `1` | Free max pacientes |
| `PREFS_LOCAL_KEY` | `useUserPrefs.js` | `'medcontrol_notif'` | localStorage prefs cache |
| `--ad-banner-height` | useAdMobBanner | `76px` default + listener | CSS var |
| `--update-banner-height` | UpdateBanner | dinâmico via ResizeObserver | CSS var |
| `--app-header-height` | AppHeader | dinâmico via ResizeObserver | CSS var |

---

## 12. Rotas

```
/                     Dashboard (doses + modal queue via ?dose / ?doses)
/pacientes            Lista
/pacientes/novo       Criar
/pacientes/:id        Detalhe + shares
/pacientes/:id/editar Editar
/tratamento/novo      Criar (?patientId opcional)
/tratamento/:id       Editar
/tratamentos          Lista
/sos                  Dose SOS
/mais                 Hub PRO
/historico            Histórico
/relatorios-analise   Analytics (PRO)
/relatorios           Relatórios PDF/CSV (PRO)
/ajustes              Settings
/admin                Admin (isAdmin only)
/faq                  FAQ (público)
/privacidade          Política Privacidade (público)
/termos               Termos Uso (público)
/reset-password       Reset password
/install              Instruções instalação APK (legacy)
*                     → Navigate to /
```

---

## 13. Gating Free/Plus/Pro/Admin

### Free:
- 1 paciente máx (trigger + `PatientLimitError`)
- Analytics: `LockedOverlay` blur
- Relatórios: dim + paywall
- AdBanner visível
- ⚠️ **PROMO ATIVA**: novos signups recebem `tier='plus'` automaticamente via trigger DB

### Plus (promo temporária):
- Sem ads
- Acesso a Analytics + Relatórios
- Cor TierBadge: cyan/blue

### Pro:
- Tudo acima + features futuras (RevenueCat pendente)
- Cor: emerald

### Admin:
- Acesso `/admin`
- `admin_grant_tier` para promover/rebaixar users
- Cor: red

### `getMyTier()`:
```js
// subscriptionService.js
const tier = data || 'free'
return tier === 'free' ? 'plus' : tier   // PROMO TEMPORÁRIA
```

### PaywallModal:
6 features, R$7,90/mês · R$49,90/ano. Botão **disabled** (RevenueCat pendente Fase 3).

---

## 14. Auth + perfil

- `signUpEmail(email, password, name)` → `user_metadata.name` + auto-login (mailer_autoconfirm OFF mas trigger faz auto-confirm em dev?)
- `updateProfile({ name })` → `auth.updateUser({ data: { name } })`
- `displayName(user)` / `firstName(user)` → metadata.name fallback email split
- **Confirmação email obrigatória**
- Demo: `signInDemo()` → mockStore sessionStorage (LGPD)
- `signOut`: `qc.clear()` + remove `medcontrol_notif`/`dashCollapsed` localStorage

---

## 15. Modo dual (Supabase vs Mock)

`hasSupabase = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)`

- **Com Supabase:** dados banco, RLS, auth real, FCM, CriticalAlarm
- **Sem Supabase (demo):** `mockStore.js` simula em sessionStorage com dados seed

Services verificam `hasSupabase` e desviam para `mock.*`.

---

## 16. Deploy

### Web (Vercel):
```bash
npm run build
npx vercel --prod --yes
# → https://dosy-app.vercel.app
```

### Android (local):
```bash
npm run build:android       # vite build + cap sync
# Studio Run ▶️  ou:
cd android && .\gradlew.bat bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

> ⚠️ **Loopback bug:** `gradlew.bat` quebra com `Unable to establish loopback connection` em sandbox. Workaround: build via Android Studio (JBR patched) ou shell normal Windows.

### Android (CI/CD):
```bash
git tag v0.1.6.10 && git push --tags
# OU
gh workflow run android-release.yml -f track=internal
```

### Bump version:
1. `android/app/build.gradle`: `versionCode +1` + `versionName "0.1.6.X"`
2. `package.json`: mesma versão
3. `npm run build:android` (regenera `dist/version.json`)
4. Build AAB
5. Upload Play Console → Closed Testing → Salvar e publicar

---

## 17. Conta admin

**Sistema:**
- Tabela `medcontrol.admins`
- `is_admin()` checa `EXISTS(SELECT 1 FROM admins WHERE user_id = auth.uid())`
- `admin_grant_tier` rejeita não-admin server-side
- Adicionar admin manualmente:
```sql
INSERT INTO medcontrol.admins (user_id) VALUES ('<uuid>');
```

Painel `/admin` lista usuários, `admin_grant_tier(target_user, tier, expires, src)`.

**Admin atual:** `lhenrique.pda@gmail.com`

---

## 18. Convenções código

- Tailwind inline, sem CSS modules
- `camelCase` JS / `"camelCase"` SQL (aspas obrigatórias)
- React Query keys: array, primeiro elemento = entidade
- `BottomSheet` via `createPortal(…, document.body)` + `pb-5 safe-bottom`
- Forms: loading via `mutation.isPending`, erro via `useToast`
- Tier check: `useIsPro()` / `useIsAdmin()` — nunca string compare
- `displayName(user)` / `firstName(user)` — nunca `user.email` direto
- `CONTINUOUS_DAYS` importar de `treatmentsService.js`
- `Field` component de `components/Field.jsx`
- **Mutações server-side via RPC** — nunca INSERT/UPDATE direto em `doses`
- **Select com colunas explícitas** (sem `select('*')` em production code)
- **escapeHtml** sanitize em todo HTML injetado (PDF, etc)
- **uuid()** de `utils/uuid.js` em vez de `crypto.randomUUID()` direto (Android 11 polyfill)

---

## 19. Problemas resolvidos (não reinventar)

| Problema | Solução |
|---|---|
| Status dose não atualizava mobile | SW v5 bypass cross-origin |
| `patchDoseInCache` não patcheava todas | `getQueryCache().findAll()` + loop manual |
| Dose não atualizava após mutação | `invalidateQueries({refetchType:'active'})` |
| Modal cortado atrás sticky | `BottomSheet` via `createPortal` |
| Free criava >1 paciente | Trigger server-side + `PatientLimitError` |
| Background PDF some na impressão | `print-color-adjust: exact` |
| **Android 14+ BAL block startActivity** | FG service + `SYSTEM_ALERT_WINDOW` + fullScreenIntent |
| **Alarme dup (FCM + Local)** | Suprimir LocalNotif quando shouldRing |
| **Doses simultâneas = N alarmes** | Agrupar por minuto (`scheduledAt.slice(0,16)`) → 1 alarm group |
| **gradlew loopback Win11** | Build via Studio (workaround JBR) |
| **PDF OOM crash 72MB** | JPEG quality 0.82, scale:1, chunked Filesystem.appendFile 512KB |
| **PDF container leaking visualmente** | iframe `position:fixed; left:-99999px; opacity:0` |
| **Share cancel triggered loader stuck** | setExporting(null) ANTES Share.share() (fire-and-forget) |
| **crypto.randomUUID Android 11 crash** | Polyfill `utils/uuid.js` (RFC 4122 v4 com getRandomValues fallback) |
| **Banner overlap header race** | Pre-aplica 76px CSS var ANTES showBanner |
| **Banner persistir Login após logout** | `qc.clear()` em signOut + `getMyTier null` no não-auth |
| **MultiDoseModal badge sumindo após mutation** | useEffect deps `[open]` only (não `[open, doses]`) |
| **Splash icon cropped Android 12+** | Logo escala 0.55 (238px em 432px canvas) |
| **Splash files >100kb** | WebP conversion (~10x menor) |
| **BootReceiver schema mismatch** | Fallback flat extras → doses[] JSON array |
| **Lockscreen overlay não funcionava** | Removido `requestDismissKeyguard` no onCreate (só em "Ciente") |
| **FG notif sem actions visíveis** | Action icons populated (R.mipmap.ic_launcher, não 0) |
| **2 notifs idênticas durante alarme** | LocalNotif skip when shouldRing + AlarmActivity dup notif removida |
| **Service mata sound quando Activity dismissed** | Service mantém sound + FG notif; Activity = só UI |
| **Status bar vazando conteúdo no scroll** | `body::before` fixed pinta env-safe + ad-banner |
| **Alarme 1min depois do exato** | Plugin floor `triggerAt` para minute boundary |
| **Cold-resume após 5min vai para rota anterior** | `window.location.href='/'` (sempre home) |

---

## 20. Status do roadmap (referência rápida — fonte verdade: `Plan.md`)

| Fase | Status |
|---|---|
| 0 — Segurança/LGPD | ✅ 100% código (manuais ops restantes) |
| 1 — Capacitor | ✅ 100% |
| 2 — FCM | ✅ 100% |
| 2.5 — CriticalAlarm | ✅ 100% (refactor 0.1.6.x: lockscreen overlay, FG notif actions, service-driven sound) |
| 3 — Monetização | ❌ 0% (bloqueado: contas RevenueCat + Play Billing) |
| 4 — Polimento | ✅ 90% |
| 5 — Play Store | ✅ Closed Testing ativo |
| 6 — Publicação | ✅ Sentry + PostHog ativos, CI ok |
| 18.9 — Open Testing | ⚠️ Pendente (screenshots phone, video FGS demo, 12 testers, Google review) |
| 23.7 — DosyMonitorService | 🔮 Pós-launch (WorkManager pra OEMs agressivos) |

---

## 21. O que NÃO está implementado / débitos conhecidos

### P0 (corrigir antes Open Testing)
- [ ] **`extend_continuous_treatments` RPC removida** — tratamentos contínuos não renovam após 90d
- [ ] **`useAppLock` não montado** — feature lock screen totalmente inutilizada (regressão)
- [ ] **`AlarmService` static `activePlayer/activeVibrator`** — race em multi-alarm
- [ ] **AdMob listeners empilhar sem dedup** — re-renders/tier change vazam
- [ ] **Snooze não persiste DB** — próximo reschedule cancela
- [ ] **"Ciente" não confirma dose** — re-agendamento dispara alarme novamente

### P1 (durante Open Testing)
- [ ] `subscribeFcm` não chama `rescheduleAll`
- [ ] `useUpdateUserPrefs` não dispara reschedule
- [ ] BootReceiver descarta doses perdidas silenciosamente
- [ ] `dailyTimes` salvo serializado em `firstDoseTime` (overload schema)
- [ ] `advanceMins` default conflitante (0 vs 15)
- [ ] `summaryTime` default conflitante (12:00 vs 07:00)
- [ ] DST drift em `generateDoses` interval mode
- [ ] Photo upload sem compressão (data: URL)
- [ ] `FREE_PATIENT_LIMIT` checked client-side (verificar enforce server)
- [ ] DoseModal mutation 3 padrões diferentes (mutate/mutateAsync/fire-forget)
- [ ] Reports export bloqueia UI thread

### Pendentes Play Store / lançamento
- [ ] **Pagamento real (Fase 3)** — RevenueCat + Play Billing
- [ ] **Cron externo notify-doses** — configurar cron-job.org (5min)
- [ ] **Capacitor iOS** — só Android suportado
- [ ] **Open Testing track** — promover Closed → Open
- [ ] **Screenshots Play Store finais** — 5 telas 1080×1920
- [ ] **Vídeo demo FOREGROUND_SERVICE_SPECIAL_USE** — Google revisão exige
- [ ] **12 testers via Reddit/grupo** — recrutamento Closed → Open Testing

### Vulnerabilidades dependências (npm audit)
- `@xmldom/xmldom <0.8.12` (5 CVEs XML injection) via `@capacitor/assets` (devDep, build-only — risco baixo)
- `esbuild <=0.24.2` (dev server CSRF) via `vite 5.4.21` — fix: bump `vite 5 → 6+` (semver major)

### Bumps recomendados
- `@supabase/supabase-js 2.103.3 → 2.105.1` (minor)
- `@tanstack/react-query 5.100.5 → 5.100.7` (patch)
- `@sentry/capacitor 3.2.1 → 4.0.0` (major — testar)
- `vite 5.4.21 → 6/7/8` (necessário pra fix CVE — major)

---

## 22. Worktrees git

Projeto suporta múltiplas worktrees `.claude/worktrees/` (gitignored). Branches `claude/*` para experimentação isolada. Commits feitos em main checkout (`G:/.../medcontrol_v2`) afetam master diretamente.

```bash
git worktree list
git worktree remove .claude/worktrees/NAME --force
git branch -D claude/NAME
```

---

## 23. Test users (closed testing)

- `lhenrique.pda@gmail.com` — admin
- `daffiny.estevam@gmail.com` — tester pro
- `teste-free@teste.com` / `123456` — tester tier `free` (paywall ativo, 1 paciente máx)
- `teste-plus@teste.com` / `123456` — tester tier `plus` (sem limite paciente, sem share)
- (legado) `teste02@teste.com` + `teste03@teste.com` deletados — não usar
