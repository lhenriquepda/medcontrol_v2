# Dosy — Contexto Completo do Projeto

> Documento para onboarding de IA. Leia do início ao fim antes de tocar em qualquer código.
> **Última revisão:** Abril 2026 — pós Fase 0/1/2/2.5/4/6 (CI+Sentry).

---

## 1. O que é o projeto

PWA mobile-first **+ App Android nativo** (Capacitor) de **gestão de medicamentos** em pt-BR, marca **Dosy** (originalmente MedControl). Usuário cadastra **pacientes** (filhos, familiares, ele mesmo), cria **tratamentos** por medicamento e acompanha **doses** agendadas no dashboard diário. Inclui modo SOS para doses de resgate, análises de adesão, exportação de relatórios PDF/CSV, alarme estilo despertador (plugin nativo Android), notificações FCM e sistema de assinaturas Free/PRO/Admin.

**Repositório:** https://github.com/lhenriquepda/medcontrol_v2
**Deploy web (Vercel):** https://dosy-teal.vercel.app
**Deploy Android (Play Store):** pendente — pacote `com.dosyapp.dosy`
**Dev local:** `npm run dev` (web) / Android Studio Run (mobile) em `G:/00_Trabalho/01_Pessoal/Apps/medcontrol_v2`

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| UI | React 19 + Vite 5 + Tailwind 3 (darkMode: 'class') |
| Roteamento | React Router DOM v6 |
| Estado servidor | TanStack React Query v5 + PersistQueryClient (localStorage, 24h TTL) |
| Backend | Supabase (projeto `guefraaqbkcehofchnrc`, nome `dosy-app`) |
| Schema DB | `medcontrol` (dedicado, isolado do `public`) |
| Auth | Supabase Auth email/senha + metadata (name) — SecureStorage no Android (KeyStore AES-256) |
| Realtime | Supabase Realtime (postgres_changes) — pause/resume Capacitor lifecycle |
| Push servidor | FCM HTTP v1 API + JWT OAuth (Firebase project `dosy-b592e`) — Edge Function `notify-doses` |
| Push web (legado) | Web Push API + VAPID (mantido como fallback web) |
| Service Worker | `public/sw.js` — cache network-first + scheduling local web |
| Plugin nativo | **CriticalAlarm** (Java) — alarme estilo despertador, fullscreen, USAGE_ALARM, BAL bypass via SYSTEM_ALERT_WINDOW |
| Mobile shell | Capacitor 8 + Android API 26-36 |
| Storage nativo | `@aparajita/capacitor-secure-storage` (Android KeyStore) |
| PDF | jsPDF + html2canvas (native) / `window.print()` (web) |
| File share native | `@capacitor/filesystem` + `@capacitor/share` |
| Connectivity | `@capacitor/network` |
| Anúncios | AdSense (web) / AdMob `@capacitor-community/admob` (native) |
| Crash monitoring | `@sentry/react` + `@sentry/capacitor` (PROD only, beforeSend strips PII) |
| Deploy web | Vercel CLI (`vercel deploy --prod`) |
| Deploy Android | Android Studio (build local) ou GitHub Actions (`.github/workflows/android-release.yml` → Play Store) |
| PWA | manifest.webmanifest + ícones PNG na raiz |
| Monetização | Free/PRO/Admin — RevenueCat planejado (Fase 3 pendente) |

---

## 3. Variáveis de ambiente

### `.env.local` (NÃO commitado — copiar de `.env.example`):
```
VITE_SUPABASE_URL=https://guefraaqbkcehofchnrc.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key painel Supabase>
VITE_SUPABASE_SCHEMA=medcontrol
VITE_VAPID_PUBLIC_KEY=<chave VAPID pública nova — projeto dosy-app>
VITE_ADSENSE_CLIENT=         # opcional, web only
VITE_ADSENSE_SLOT=           # opcional, web only
VITE_ADMOB_BANNER_ANDROID=   # opcional, prod (test ID padrão)
VITE_SENTRY_DSN=             # opcional, prod monitoring
```

> **NUNCA commitar valores reais.** `INFOS.md` no disco contém secrets locais (gitignored).

### Vercel production:
Mesmas vars do bloco acima.

### Supabase Edge Function secrets:
```
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY     # NUNCA documentar
VAPID_SUBJECT=mailto:lhenrique.pda@gmail.com
FIREBASE_PROJECT_ID=dosy-b592e
FIREBASE_CLIENT_EMAIL=<service account email>
FIREBASE_PRIVATE_KEY  # NUNCA documentar
SUPABASE_SERVICE_ROLE_KEY  # usado apenas dentro de Edge Functions
```

### CI/CD secrets (GitHub Actions):
Ver `docs/play-store/ci-setup.md` — `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON`, mais as `VITE_*` acima.

---

## 4. Banco de dados Supabase

**Projeto:** `guefraaqbkcehofchnrc` (`dosy-app`) — projeto dedicado, sem compartilhamento.

### Schema `medcontrol` — tabelas (10 total):

```
patients            — id, "userId", name, age, avatar, photo_url, weight, condition, doctor, allergies
treatments          — id, "userId", "patientId", "medName", unit, "intervalHours", "durationDays",
                      "startDate", "firstDoseTime", status, "isTemplate", "isContinuous"
doses               — id, "userId", "treatmentId", "patientId", "medName", unit,
                      "scheduledAt", "actualTime", status, type, observation
                      CHECK observation length ≤ 500 (LGPD data minimization)
sos_rules           — id, "userId", "patientId", "medName", "minIntervalHours", "maxDosesIn24h"
treatment_templates — modelos por usuário
subscriptions       — "userId" PK, tier, "expiresAt", source, "consentAt", "consentVersion" (LGPD)
push_subscriptions  — id, "userId", endpoint, keys (JSONB), "deviceToken", platform,
                      "advanceMins", "userAgent" (simplificado), "createdAt"
admins              — user_id PK, added_at, added_by — controla quem é admin (sem hardcoded)
security_events     — id, user_id, event_type, ip_address, user_agent, metadata, created_at
                      → log auditoria LGPD (login, tier change, account delete, etc.)
patient_shares      — id, "patientId", "ownerId", "sharedWithUserId" → compartilhar pacientes entre cuidadores
```

> **camelCase no DDL:** colunas entre aspas (`"userId"`, `"scheduledAt"`). Não remover.

### RLS:
**Todas** tabelas têm `rowsecurity=true`. Policies por `auth.uid()` + `has_patient_access()` em doses/treatments.

### Funções (~22 — SECURITY DEFINER):

**Tier/admin:**
```
admin_email()                    — legacy (não mais usado em is_admin)
is_admin()                       — SELECT 1 FROM admins WHERE user_id = auth.uid()
effective_tier(uid)              — 'admin'|'pro'|'free' respeitando expiresAt
my_tier()                        — atalho effective_tier(auth.uid())
admin_grant_tier(target, tier, expires, src) — verifica is_admin() server-side, log security_events
admin_list_users()               — lista bypass RLS
```

**Doses (server-side state machine — Fase 0.14):**
```
register_sos_dose(patientId, medName, unit, scheduledAt, observation)
                                 — valida minIntervalHours/maxDosesIn24h server-side
confirm_dose(p_dose_id, p_actual_time, p_observation)
                                 — pending|overdue → done
skip_dose(p_dose_id, p_observation)
                                 — pending|overdue → skipped
undo_dose(p_dose_id)              — done|skipped → pending
create_treatment_with_doses(payload jsonb)
                                 — atomic, valida ownership, limita durationDays ≤ 365
update_treatment_schedule(payload) — regenera doses atomicamente
has_patient_access(patient_id)   — true se ownership ou patient_shares
```

**Push:**
```
upsert_push_subscription(p_device_token, p_platform, p_advance_mins, p_user_agent)
                                 — handles cross-user device transfer (logout/login)
```

**LGPD:**
```
delete_my_account()              — cascata: doses, treatments, sos_rules, patient_shares,
                                   patient_shares (where shared with), push_subs, subscriptions, patients.
                                   Edge Function `delete-account` chama isso + auth.admin.deleteUser
```

**Compartilhamento:**
```
share_patient_by_email(patient_id, email)
list_patient_shares(patient_id)
unshare_patient(share_id)
```

**Triggers:**
```
on_new_user_subscription          AFTER INSERT auth.users → cria subscription free
enforce_patient_limit             BEFORE INSERT patients → bloqueia free >1
enforce_sos_via_rpc_trigger       BEFORE INSERT doses (type=sos) → bloqueia, força via RPC
auto_confirm_email_trigger        legacy (mailer_autoconfirm=false agora — confirmação obrigatória)
```

### Índices compostos (performance + segurança DoS):
```
doses_patient_scheduled_idx          ("patientId", "scheduledAt")
doses_patient_status_scheduled_idx   ("patientId", status, "scheduledAt")
treatments_patient_status_idx        ("patientId", status)
push_subs_user_idx                   ("userId")
security_events_type_idx             (event_type, created_at DESC)
... + indexes por userId em todas tabelas
```

### Constraints:
- `doses_observation_length` CHECK length ≤ 500 (LGPD)
- `doses_status_check` IN (pending|overdue|done|skipped)
- `doses_type_check` IN (scheduled|sos)
- `treatments_status_check` IN (active|ended|paused)
- `subscriptions_tier_check` IN (free|pro|admin)
- **ON DELETE CASCADE** em todas FKs (`treatmentId→treatments`, `patientId→patients`, `userId→auth.users`)

### pg_cron jobs:
```
anonymize-old-doses    — Domingos 3h UTC, anonimiza observation de doses +3 anos (LGPD retenção)
```

### Auth Dashboard (Fase 0):
- `mailer_autoconfirm=false` (confirmação email obrigatória)
- `rate_limit_otp=5`, `rate_limit_anonymous_users=30`, `rate_limit_token_refresh=150`

---

## 5. Estrutura de arquivos

```
src/
├── main.jsx                    # Entry: PersistQueryClient (24h TTL), StatusBar (native), Sentry init
├── App.jsx                     # Rotas + AppHeader + BottomNav + listeners notif tap (openDose/openDoses)
│                                 # + Capacitor back button + DailySummaryModal
│
├── pages/
│   ├── Login.jsx               # Auth + validatePassword + checkbox consentimento LGPD
│   ├── Dashboard.jsx           # Stats, FilterBar, doses agrupadas, doseQueue (modal queue)
│   ├── Patients.jsx            # Lista pacientes
│   ├── PatientForm.jsx         # CRUD paciente
│   ├── PatientDetail.jsx       # Detalhe + shares
│   ├── TreatmentForm.jsx       # CRUD tratamento via RPC create_treatment_with_doses
│   ├── TreatmentList.jsx       # Lista tratamentos
│   ├── DoseHistory.jsx         # Histórico
│   ├── SOS.jsx                 # Dose SOS via RPC register_sos_dose
│   ├── Analytics.jsx           # PRO
│   ├── Reports.jsx             # PDF/CSV — native: jsPDF+html2canvas+Filesystem+Share / web: window.print
│   ├── Settings.jsx            # Tema, push, antecedência, exportar dados (LGPD), excluir conta
│   ├── More.jsx                # Hub PRO
│   ├── Admin.jsx               # Painel admin (tier management)
│   ├── Privacidade.jsx         # /privacidade — política completa LGPD
│   └── Termos.jsx              # /termos — termos de uso
│
├── components/
│   ├── AppHeader.jsx           # Sticky z-40, dosy-logo-light, badge atrasadas
│   ├── Header.jsx              # Header interno (não sticky)
│   ├── BottomNav.jsx
│   ├── FilterBar.jsx           # Sticky top-[68px]
│   ├── DoseCard.jsx
│   ├── DoseModal.jsx           # 3 botões grid: Ignorar | Pular | Tomada + queue counter banner
│   ├── DailySummaryModal.jsx   # Tap notif resumo diário
│   ├── PatientCard.jsx
│   ├── TierBadge.jsx
│   ├── AdBanner.jsx            # Conditional: AdSense (web) / AdMob (native) / placeholder
│   ├── PaywallModal.jsx        # Bottom sheet — botões disabled (RevenueCat pendente)
│   ├── BottomSheet.jsx         # createPortal (escapa stacking context)
│   ├── ConfirmDialog.jsx
│   ├── EmptyState.jsx
│   ├── Field.jsx
│   ├── MedNameInput.jsx
│   ├── Skeleton.jsx
│   ├── LockedOverlay.jsx
│   └── SharePatientSheet.jsx
│
├── hooks/
│   ├── useAuth.jsx             # signOut limpa localStorage notif/dashCollapsed (Fase 0)
│   ├── useDoses.js             # useConfirmDose/useSkipDose/useUndoDose via RPCs
│   ├── usePatients.js
│   ├── useTreatments.js        # via RPC create_treatment_with_doses
│   ├── useSubscription.js
│   ├── usePushNotifications.js # FCM register, agrupa doses por minuto, suppress LocalNotif quando
│   │                            # CriticalAlarm OK (no dup), canScheduleExact pre-check, FCM listener
│   │                            # global guard (1x), advanceMins=0 default
│   ├── useRealtime.js          # Cap pause/resume reconnection
│   ├── useShares.js
│   ├── useTheme.jsx
│   ├── useToast.jsx
│   └── useOnlineStatus.js      # Cap Network listener (native) / navigator.onLine (web)
│
├── services/
│   ├── supabase.js             # SecureStorage adapter (native: KeyStore) / localStorage (web)
│   │                            # detectSessionInUrl: false (native), schema medcontrol
│   ├── dosesService.js         # Todas mutações via RPCs (confirm/skip/undo/sos), select com colunas explícitas
│   ├── treatmentsService.js    # create/update via RPCs atomicas
│   ├── patientsService.js
│   ├── subscriptionService.js
│   ├── sharesService.js
│   ├── criticalAlarm.js        # Bridge Capacitor: schedule/scheduleGroup/cancel/cancelAll/checkEnabled
│   └── mockStore.js            # Demo: sessionStorage (LGPD — não persiste cross-session)
│
├── utils/
│   ├── dateUtils.js
│   ├── generateDoses.js        # Legacy — agora server-side via create_treatment_with_doses
│   ├── statusUtils.js
│   ├── tierUtils.js
│   ├── userDisplay.js
│   └── sanitize.js             # escapeHtml — usado em Reports.jsx PDF (XSS protection)
│
└── data/
    └── medications.js          # Autocomplete

public/
├── sw.js                       # SW v5 (web only — ignorado em Capacitor)
├── manifest.webmanifest
├── dosy-logo.png / dosy-logo-light.png
├── icon-*.png / apple-touch-icon.png / favicon-64.png

android/                        # Capacitor Android shell
├── app/
│   ├── google-services.json    # Firebase config (FCM)
│   ├── build.gradle            # signingConfigs.release env-based (KEYSTORE_PATH, etc)
│   └── src/main/
│       ├── AndroidManifest.xml # Permissions: USE_FULL_SCREEN_INTENT, SYSTEM_ALERT_WINDOW,
│       │                         # SCHEDULE_EXACT_ALARM, FOREGROUND_SERVICE_SPECIAL_USE,
│       │                         # ACCESS_NOTIFICATION_POLICY, deep links dosy:// + https
│       ├── java/com/dosyapp/dosy/
│       │   ├── MainActivity.java                       # Registra plugin + handle openDoseIds
│       │   └── plugins/criticalalarm/
│       │       ├── CriticalAlarmPlugin.java            # schedule/scheduleGroup via setAlarmClock
│       │       ├── AlarmReceiver.java                  # Broadcast → AlarmService
│       │       ├── AlarmService.java                   # FG service + MediaPlayer USAGE_ALARM loop
│       │       │                                         # + startActivity (BAL bypass via SYSTEM_ALERT_WINDOW)
│       │       ├── AlarmActivity.java                  # Fullscreen lock+unlocked, dose list cards,
│       │       │                                         # Ciente / Adiar 10min, vibração contínua
│       │       └── BootReceiver.java                   # Re-agenda após reboot
│       └── res/xml/network_security_config.xml         # SSL pinning Supabase

supabase/
└── functions/
    ├── notify-doses/index.ts   # FCM HTTP v1 (JWT OAuth) + web-push fallback
    ├── delete-account/index.ts # service_role auth.users delete + RPC delete_my_account
    └── send-test-push/index.ts # admin test push

docs/
├── RIPD.md                     # Relatório Impacto Proteção Dados (LGPD Art. 37-38)
└── play-store/
    ├── app-title.txt
    ├── description-short.txt   # 80 chars
    ├── description-long.txt    # ~3500 chars
    ├── release-notes.md
    ├── keystore-instructions.md # geração + backup 3 locais + AAB build
    ├── ci-setup.md              # GitHub Actions secrets list
    └── whatsnew/whatsnew-pt-BR  # ≤500 chars Play Store

tools/                          # Scripts dev (gitignored binários)
├── extract-spki.cjs            # SSL pinning hash extraction
├── test-sos-bypass.cjs         # Validação SOS RPC bypass
├── security-fix.cjs            # Drop legacy own_* policies
├── fcm-schema-migration.cjs    # Migration deviceToken/platform
└── ...                         # ~17 scripts utilitários

.github/workflows/
├── ci.yml                      # build + cap sync em PRs
└── android-release.yml         # signed AAB + Play Store upload (tag v* ou workflow_dispatch)

capacitor.config.ts             # appId com.dosyapp.dosy, plugins (StatusBar, Keyboard, Splash, Push, Local)
```

---

## 6. Funcionalidades detalhadas

### Pacientes
- Cadastro nome + avatar emoji
- RLS por usuário + compartilhamento via `patient_shares` (cuidadores)
- Free: máximo 1 paciente (trigger server-side + `PaywallModal` client)

### Tratamentos
- Medicamento, unit, intervalo, horários múltiplos, data início, duração
- **Uso contínuo** (`isContinuous`): `CONTINUOUS_DAYS = 90`
- Intervalos: 4h / 6h / 8h / 12h / 1x/dia / 2-em-2-dias / 3-em-3-dias / 1x/semana / quinzenal / 1x/mês
- Templates reutilizáveis
- **Geração server-side** via RPC `create_treatment_with_doses` (atomic, durationDays ≤ 365)
- Edição regenera doses futuras via `update_treatment_schedule`

### Doses — ciclo de vida (server-side state machine)
```
pending → done    (RPC confirm_dose)
pending → skipped (RPC skip_dose)
done/skipped → pending (RPC undo_dose)
overdue           (calculado: scheduledAt no passado + status pending)
```
- Períodos: 12h / 24h / 48h / 7d / tudo
- Filtros: status, tipo, paciente
- Optimistic update via `patchDoseInCache` + rollback
- Realtime sync após mutação (`refetchQueries`, não `invalidateQueries` — ver §Decisões)

### SOS
- Dose extra via RPC `register_sos_dose` — valida `minIntervalHours`/`maxDosesIn24h` server-side
- INSERT direto bloqueado por trigger (testado via `tools/test-sos-bypass.cjs`)

### Dashboard
- Stats: pendentes hoje, % adesão 7d, atrasadas (30d)
- Doses agrupadas por paciente (collapsible, localStorage)
- Badge "N atrasadas" no AppHeader → `?filter=overdue`
- **Modal queue** (notif tap): URL `?dose=ID` ou `?doses=A,B,C` → abre fila modal Ignorar/Pular/Tomada
- FilterBar sticky `top-[68px]`

### Notificações — sistema unificado

**3 canais de aviso (mesmo dose):**

1. **CriticalAlarm (plugin nativo Android — primário)**
   - `AlarmManager.setAlarmClock` (bypass Doze)
   - `AlarmReceiver` → `AlarmService` (FG service)
   - `AlarmService` toca `MediaPlayer` USAGE_ALARM loop + vibração + `startActivity(AlarmActivity)`
   - BAL bypass: requer `SYSTEM_ALERT_WINDOW` permission grant (manual ou via plugin `openOverlaySettings`)
   - `AlarmActivity` fullscreen sobre lock screen, lista de doses, botões Ciente / Adiar 10min
   - **Agrupa doses por minuto:** mesmo horário = 1 alarme + 1 notif lista (não N alarmes)
   - `BootReceiver` re-agenda após reboot

2. **FCM (server-side, fallback)**
   - Edge Function `notify-doses` envia via FCM HTTP v1 API (JWT OAuth, secrets Firebase)
   - Cron externo (cron-job.org) chama Edge Function a cada 5 min
   - Suprimido foreground (sem dup) — só serve quando app killed +24h após scheduling local

3. **LocalNotifications (Capacitor — fallback se CriticalAlarm OFF/falha)**
   - `usePushNotifications.scheduleDoses` agenda via `@capacitor/local-notifications`
   - Suprimida quando `useCritical && canScheduleExact` (evita dup)

**Fluxo notif tap:**
- Tap heads-up notif → `MainActivity` com `openDoseIds` extra → JS event `dosy:openDoses` → `?doses=A,B,C`
- Tap AlarmActivity Ciente → mesmo fluxo
- Dashboard `doseQueue` state → modal abre com primeira → fechar avança próxima

**Antecedência (Settings):** padrão 0min (alarme exato no horário). Configurável: 5/10/15/30/60 min antes.

### Relatórios (PRO)
- **PDF native:** html2canvas → jsPDF → Filesystem Cache → Share sheet
- **PDF web:** `window.print()` em janela nova com HTML estilizado, logo via URL absoluta, `print-color-adjust: exact`
- **CSV:** UTF-8 BOM, todas colunas, native = Filesystem + Share
- Preview in-app: lista doses + adesão %

### Branding Dosy
- Logo: `dosy-logo-light.png` (fundo escuro: AppHeader, Login, PDF) / `dosy-logo.png` (fundo claro)
- Cor primária: `#0d1535` (dark navy)
- Ícones PWA + adaptive icon Android (mipmap-*-foreground)

### LGPD Compliance (Fase 0)
- `/privacidade` + `/termos` rotas públicas
- Checkbox consentimento explícito no cadastro (gravado em `subscriptions.consentAt` + `consentVersion`)
- Exportação completa de dados (botão Settings → JSON download)
- Exclusão de conta (RPC `delete_my_account` + Edge Function `delete-account`)
- Anonimização automática doses +3 anos (pg_cron `anonymize-old-doses`)
- Senhas fortes (8+ chars, maiúscula, número)
- `observation` ≤ 500 chars (data minimization)
- `userAgent` simplificado (só platform)
- `security_events` log auditoria (login, tier change, account delete)
- `docs/RIPD.md` documentação ANPD

---

## 7. AppHeader (componente global)

```jsx
// App.jsx — autenticado, antes das Routes
<AppHeader />   // sticky top-0 z-40 bg-[#0d1535]
<div className="min-h-screen">
  <Routes>...</Routes>
  <BottomNav />
</div>
```

- Logo `dosy-logo-light.png` clicável → `/`
- Saudação + `<TierBadge />`
- Badge atrasadas (animate-pulse) → `nav('/?filter=overdue')`
- Link ajustes → `/ajustes`
- Header interno (`Header.jsx`) **não é sticky** (evita conflito)

---

## 8. Plugin CriticalAlarm (Android nativo)

**Pacote:** `com.dosyapp.dosy.plugins.criticalalarm`

**Arquivos Java:**
- `CriticalAlarmPlugin.java` — Capacitor bridge, expõe schedule/scheduleGroup/cancel/cancelAll/isEnabled/openExactAlarmSettings/openFullScreenIntentSettings
- `AlarmReceiver.java` — BroadcastReceiver fired por AlarmManager → starta AlarmService
- `AlarmService.java` — Foreground service (`FOREGROUND_SERVICE_TYPE_SPECIAL_USE`):
  - MediaPlayer USAGE_ALARM looping
  - Vibrator pattern contínuo
  - `startActivity(AlarmActivity)` — BAL exempt via `SYSTEM_ALERT_WINDOW`
  - `static stopActiveAlarm(Context)` — chamado por AlarmActivity / MainActivity tap notif
- `AlarmActivity.java` — Fullscreen Activity:
  - `setShowWhenLocked` + `setTurnScreenOn` + WakeLock
  - Lista de cards por dose (medName, unit, patientName)
  - Botão Ciente → MainActivity com `openDoseIds`, stop som
  - Botão Adiar 10min → re-schedule alarm +10min
- `BootReceiver.java` — re-agenda após `BOOT_COMPLETED`/`LOCKED_BOOT_COMPLETED`/`MY_PACKAGE_REPLACED`

**JS bridge:** `src/services/criticalAlarm.js`

**Permissões necessárias (manifest):**
```
USE_FULL_SCREEN_INTENT          # Android 14+ — requer user grant via Settings
SYSTEM_ALERT_WINDOW             # BAL bypass — requer user grant ou adb appops set
SCHEDULE_EXACT_ALARM
USE_EXACT_ALARM
FOREGROUND_SERVICE
FOREGROUND_SERVICE_SPECIAL_USE
ACCESS_NOTIFICATION_POLICY      # bypass DND (com user grant)
RECEIVE_BOOT_COMPLETED
WAKE_LOCK
VIBRATE
TURN_SCREEN_ON
DISABLE_KEYGUARD
POST_NOTIFICATIONS              # Android 13+
```

**Grant via adb (dev):**
```
adb shell appops set com.dosyapp.dosy USE_FULL_SCREEN_INTENT allow
adb shell appops set com.dosyapp.dosy SYSTEM_ALERT_WINDOW allow
```

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

**Por que `cross-origin return`?** Fix v5 — antes SW cacheava respostas Supabase, status de dose stale no mobile. Bypass total para diferentes origins.

---

## 10. TanStack React Query — padrões

### QueryClient (main.jsx):
```js
queries: {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  retry: 1,
  gcTime: 24h    // sobrevive offline reconnect
}
mutations: {
  retry: 3,
  retryDelay: exponential backoff (max 30s)
}
```

### PersistQueryClientProvider:
- localStorage (`dosy-query-cache`)
- maxAge 24h
- buster `v1` (bump pra invalidar persisted cache em schema change)

### Query keys:
```
['patients']
['treatments', filter]
['doses', filter]            // filter memoizado useMemo Dashboard
['sos_rules', patientId]
['my_tier']
['admin_users']
['patient_shares']
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

### Por que `getQueryCache().findAll()` e não `setQueriesData()`?
v5 tem matching parcial inconsistente. `findAll({ queryKey: ['doses'] })` + loop manual é confiável.

### Por que `refetchQueries` e não `invalidateQueries`?
`invalidate` é lazy (só refetch quando focus). `refetchQueries` força refetch imediato — necessário pra UI mobile.

---

## 11. Constantes importantes

| Constante | Arquivo | Valor | Descrição |
|---|---|---|---|
| `CONTINUOUS_DAYS` | `treatmentsService.js` | `90` | Uso contínuo |
| `refetchInterval` | `useDoses.js` | `60_000` ms | Refetch doses/min |
| `MS_SCHEDULE_WINDOW` | `usePushNotifications.js` | `48 * 3600 * 1000` ms | Janela scheduling |
| `NOTIF_KEY` | `usePushNotifications.js` | `'medcontrol_notif'` | Prefs localStorage |
| `CACHE` | `sw.js` | `'medcontrol-v5'` | SW version |
| `FREE_PATIENT_LIMIT` | `subscriptionService.js` | `1` | Free max pacientes |

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
/privacidade          Política Privacidade (público, antes auth)
/termos               Termos Uso (público)
*                     → Navigate to /
```

---

## 13. Gating Free/PRO

### Free:
- 1 paciente máx (trigger + `PatientLimitError`)
- Analytics: `LockedOverlay` blur
- Relatórios: dim + paywall
- AdBanner visível (AdSense web / AdMob native)

### PRO/Admin:
- Sem ads, acesso total
- Admin: `/admin`

### PaywallModal:
6 features, R$7,90/mês · R$49,90/ano. Botão **disabled** (RevenueCat pendente Fase 3).

---

## 14. Auth + perfil

- `signUpEmail(email, password, name)` → `user_metadata.name`
- `updateProfile({ name })` → `auth.updateUser({ data: { name } })`
- `displayName(user)` → `user_metadata.name || user.name || email.split('@')[0] || 'Usuário'`
- **Confirmação email obrigatória** (`mailer_autoconfirm=false`)
- Demo: `signInDemo()` → mockStore sessionStorage (LGPD)

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
vercel deploy --prod
```

### Android (local):
```bash
npm run build
npx cap sync android
# Studio Run ▶️  ou:
cd android && .\gradlew.bat assembleDebug
```

> ⚠️ **Loopback bug:** `gradlew.bat` quebra com `Unable to establish loopback connection` em Win11 24H2 (bug JVM UnixDomainSockets). Workaround: build via Android Studio (JBR patched). CI Linux runner não tem o bug.

### Android (CI/CD):
```bash
git tag v1.0.0 && git push --tags    # → workflow android-release.yml builds + uploads internal
gh workflow run android-release.yml -f track=beta    # manual track
```

Configurar secrets — `docs/play-store/ci-setup.md`.

---

## 17. Conta admin

**Email padrão:** `lhenrique.pda@gmail.com` (apenas para legado `admin_email()`).

**Sistema atual (Fase 0.3):**
- Tabela `medcontrol.admins` (sem RLS visible)
- `is_admin()` checa `EXISTS(SELECT 1 FROM admins WHERE user_id = auth.uid())`
- `admin_grant_tier` rejeita não-admin server-side
- Adicionar admin manualmente no Supabase Dashboard:
```sql
INSERT INTO medcontrol.admins (user_id) VALUES ('<uuid>');
```

Painel `/admin` lista usuários, `admin_grant_tier(target_user, tier, expires, src)`.

---

## 18. Convenções código

- Tailwind inline, sem CSS modules
- `camelCase` JS / `"camelCase"` SQL (aspas obrigatórias)
- React Query keys: array, primeiro elemento = entidade
- `BottomSheet` via `createPortal(…, document.body)` (evita stacking context bug)
- Forms: loading via `mutation.isPending`, erro via `useToast`
- Tier check: `useIsPro()` / `useIsAdmin()` — nunca string compare
- `displayName(user)` / `firstName(user)` — nunca `user.email` direto
- `CONTINUOUS_DAYS` importar de `treatmentsService.js`
- `Field` component de `components/Field.jsx`
- **Mutações server-side via RPC** (Fase 0.14): nunca INSERT/UPDATE direto em `doses`
- **Select com colunas explícitas** (sem `select('*')`)
- **escapeHtml** sanitize em todo HTML injetado (PDF, etc)

---

## 19. Problemas resolvidos (não reinventar)

| Problema | Solução |
|---|---|
| Status dose não atualizava mobile | SW v5 bypass cross-origin (não cacheia Supabase) |
| `patchDoseInCache` não patcheava todas | `getQueryCache().findAll()` + loop manual |
| Dose não atualizava após mutação | `refetchQueries` em vez de `invalidateQueries` |
| Badge atrasadas não filtrava na tela | `useEffect` observa `searchParams` |
| Modal cortado atrás sticky | `BottomSheet` via `createPortal` |
| Free criava >1 paciente | Trigger server-side + `PatientLimitError` |
| Admin não via outros usuários | RPC `admin_list_users` SECURITY DEFINER |
| Erros Supabase em inglês | `traduzirErro()` |
| Background PDF some na impressão | `print-color-adjust: exact` |
| Logo PDF janela nova | URL absoluta `window.location.origin` |
| `query` instável queryKey | `useMemo` |
| **Android 14+ BAL block startActivity** | FG service + `SYSTEM_ALERT_WINDOW` permission |
| **Alarme dup (FCM + Local)** | Suprimir LocalNotif quando CriticalAlarm OK |
| **Modal não abria notif tap** | MainActivity dispatch JS event 3x retry (300/1500/3500ms) + global var fallback cold start |
| **Doses simultâneas = N alarmes** | Agrupar por minuto (`scheduledAt.slice(0,16)`) → 1 alarm group |
| **Receiver tap → AlarmActivity** | Mudou pra MainActivity (tap = ver modal, não re-alarm) |
| **gradlew loopback Win11** | Build via Studio (workaround JBR) |

---

## 20. Status do roadmap (referência rápida — fonte verdade: Plan.md)

| Fase | Status |
|---|---|
| 0 — Segurança/LGPD | ✅ 100% código (manuais ops restantes) |
| 1 — Capacitor | ✅ 100% (device físico test pendente) |
| 2 — FCM | ✅ 100% (snooze test pendente) |
| 2.5 — CriticalAlarm | ✅ 100% (DND/silencioso device físico) |
| 3 — Monetização | ❌ 0% (bloqueado: contas RevenueCat + Play Console) |
| 4 — Polimento | ✅ ~85% (ícones design pendentes) |
| 5 — Play Store | ⚠️ ~50% (manuais: IARC, screenshots, keystore, feature graphic) |
| 6 — Publicação | ✅ CI+Sentry feitos (manuais: upload, beta, monitoramento pós-launch) |

---

## 21. O que NÃO está implementado (pendente)

- [ ] **Pagamento real (Fase 3)** — RevenueCat + Play Billing. PaywallModal disabled.
- [ ] **Cron externo notify-doses** — configurar cron-job.org (5min) chamando Edge Function
- [ ] **Login com Google** — Supabase configurado, OAuth callback precisa domínio
- [ ] **Capacitor iOS** — só Android suportado
- [ ] **Paginação doses** — sem limite resultados em períodos longos
- [ ] **Offline mutation queue robusto** — TanStack persist + retry implementado, mas falhas silenciosas em deletes/upserts complexos
- [ ] **Domínio customizado** — `dosy.vercel.app` sem sufixo: Vercel → Settings → Domains
- [ ] **Ícones adaptive Android finais** — `resources/icon.png` 1024×1024, `icon-foreground.png` 108×108, `splash.png` 2732×2732 (design)
- [ ] **Screenshots Play Store** — 5 telas 1080×1920
- [ ] **Feature Graphic Play Store** — 1024×500
- [ ] **Keystore release** — geração + backup 3 locais (`docs/play-store/keystore-instructions.md`)
- [ ] **Conta Google Play Console** — USD 25 signup
