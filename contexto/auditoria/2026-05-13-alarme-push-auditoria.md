# Auditoria — Sistema de Alarme + Push (Dosy)

> **Branch:** `docs/auditoria-alarme-push` · **Data:** 2026-05-13 · **Versão base:** master @ v0.2.2.4 (vc 62)
>
> Varredura ponta-a-ponta de todos os caminhos que participam do agendamento, entrega e disparo de alertas de dose (alarme estilo despertador + notificações push). Cobre Java nativo, JS, Edge Functions, banco (migrations + triggers + cron), Manifest Android, Service Worker e configuração Capacitor. Identifica fluxo real, dependências cruzadas, código morto, drift entre código local e prod, e bugs latentes.

---

## 1. Inventário — Tudo que participa

### 1.1 Plugin nativo Android (`android/app/src/main/java/com/dosyapp/dosy/`)

| Arquivo | Papel | Linhas-chave |
|---|---|---|
| `MainActivity.java` | Boot do app Capacitor. Registra `CriticalAlarmPlugin`. Enqueue `DoseSyncWorker` periódico 6h. Trata intents de notif/alarm (`openDoseId`, `openDoseIds`) e dispara eventos JS (`dosy:openDose`, `dosy:openDoses`). | 20 (register), 32–45 (Worker enqueue), 59–78 (handleAlarmAction), 80–94 (postJsEvent com retries 300/1500/3500ms) |
| `plugins/criticalalarm/CriticalAlarmPlugin.java` | Bridge Capacitor → AlarmManager. Métodos `schedule`/`scheduleGroup`/`cancel`/`cancelAll`/`isEnabled`/`checkPermissions`/`setSyncCredentials`/`updateAccessToken`/`setCriticalAlarmEnabled`/`getDeviceId`/`clearSyncCredentials`/`openExactAlarmSettings`/`openFullScreenIntentSettings`/`openOverlaySettings`/`openAppNotificationSettings`/`isIgnoringBatteryOptimizations`/`requestIgnoreBatteryOptimizations`. Persiste alarmes em `SharedPreferences "dosy_critical_alarms"` key `scheduled_alarms` (JSONArray). Persiste credenciais em `SharedPreferences "dosy_sync_credentials"`. | 107–134 (scheduleInternal delega `AlarmScheduler.scheduleDose`), 145–196 (setSyncCredentials grava url/anonKey/userId/refreshToken/accessToken/exp/deviceId/criticalAlarmEnabled), 207–223 (updateAccessToken só access_token), 449–516 (checkPermissions retorna `allGranted` baseado em 6 flags incluindo battery opt) |
| `plugins/criticalalarm/AlarmScheduler.java` | Helper estático compartilhado por plugin JS-side e Worker/FCM Java. `scheduleDose(ctx, id, triggerAtMs, doses)` chama `AlarmManager.setAlarmClock` (bypassa Doze). `cancelAlarm(ctx, id)` para `cancel_alarms` FCM action. `idFromString(s)` deriva int positivo determinístico do groupKey (deve coincidir com `doseIdToNumber` JS). | 38–79 (scheduleDose floor 60s, setAlarmClock, persist), 117–130 (cancelAlarm), 156–166 (idFromString — **SEM `% 2147483647`**) |
| `plugins/criticalalarm/AlarmReceiver.java` | BroadcastReceiver disparado pelo AlarmManager no horário. Path primário: `startForegroundService(AlarmService)`. Fallback: posta notif fullScreenIntent + tap MainActivity. Audita `fired_received` via `AlarmAuditLogger`. Cria canal `doses_critical_v2` com som `dosy_alarm.mp3`. | 37 (`CHANNEL_ID = "doses_critical_v2"`), 41–47 (PARTIAL_WAKE_LOCK + ACQUIRE_CAUSES_WAKEUP 10s), 53–70 (audit fired_received), 74–84 (startForegroundService primary), 86–166 (fallback fullScreenIntent + tap PendingIntent), 186–200 (som customizado + USAGE_ALARM) |
| `plugins/criticalalarm/AlarmService.java` | Foreground Service `FOREGROUND_SERVICE_TYPE_SPECIAL_USE` (`medication_reminder`). Mantém MediaPlayer em loop + Vibrator pattern. Posta notif persistente com 3 actions (Ciente/Adiar 10min/Ignorar). Dispara fullScreenIntent + tenta `startActivity(directLaunch)` BAL via SYSTEM_ALERT_WINDOW. `stopActiveAlarm()` cleanup estático. | 47 (`CHANNEL_ID = "doses_critical"` — **diferente de AlarmReceiver**), 51–69 (stopActiveAlarm static), 75–95 (ACTION_STOP/MUTE/UNMUTE), 165–167 (3 PendingIntent actions), 174–203 (Notification builder + startForeground 3 SDK variants), 215–219 (directLaunch via BAL), 242–283 (MediaPlayer + Vibrator loops), 315–337 (ensureChannel **sem som — drives sound via MediaPlayer**) |
| `plugins/criticalalarm/AlarmActivity.java` | Activity full-screen sunset gradient ripple + cards agrupados por paciente. 3 botões (Ciente/Adiar/Pular) + close `✕` + toggle mute. Block back-button. Volume keys → mute. `requestDismissKeyguard` só ao Ciente. Snooze auto-reagenda mesmo `alarmId` via `setAlarmClock`. | 63 (`CHANNEL_ID = "doses_v2"` — **3º channel ID**), 81–90 (finishReceiver para `FINISH_ALARM_ACTIVITY` broadcast), 92–141 (onCreate setShowWhenLocked + WakeLock SCREEN_BRIGHT 10min), 596–605 (mute button), 660–668 (toggleMute), 728–746 (handleAction acknowledge/snooze/ignore), 758–772 (openAppWithDoseIds com dismissKeyguard), 842–863 (scheduleSnooze 10min), 866–868 (onBackPressed block), 871–884 (volume keys → mute), 676–712 (**startAlarmSound + startVibration — código morto**) |
| `plugins/criticalalarm/AlarmActionReceiver.java` | Handler das 3 actions do notif persistente (`ACTION_ACK`/`ACTION_SNOOZE`/`ACTION_IGNORE`). Para `AlarmService`, cancela notifs, envia broadcast `FINISH_ALARM_ACTIVITY` pra fechar Activity se aberta, executa lógica equivalente ao botão. | 23–25 (action constants), 30–67 (onReceive), 70–93 (scheduleSnooze 10min) |
| `plugins/criticalalarm/BootReceiver.java` | Restaura alarmes após `BOOT_COMPLETED`/`LOCKED_BOOT_COMPLETED`/`MY_PACKAGE_REPLACED`. Lê JSONArray de `SharedPreferences`. Skip se `triggerAt <= now` (alarme passou enquanto device off). | 22–28 (action filter inclui upgrade), 38–82 (loop re-schedule via setAlarmClock + fallback legacy schema sem `doses` array) |
| `plugins/criticalalarm/DoseSyncWorker.java` | WorkManager periódico 6h. Lê creds + accessToken cached, fetcha `/rest/v1/doses?select=...,patients(name)&status=eq.pending&scheduledAt=gte.now&lte.now+48h&limit=500`. Agrupa por minuto exato, agenda via `AlarmScheduler.scheduleDose`. Audita `batch_start/scheduled/batch_end` source=`java_worker`. | 60–63 (HORIZON_HOURS=48), 66 (EXP_SAFETY_MARGIN_MS=60s), 84–95 (skip se creds vazias), 92–96 (skip se `critical_alarm_enabled=false`), 98–111 (skip se access_token expirado — NÃO chama refresh), 130–161 (fetchUpcomingDoses), 168–252 (scheduleDoses grouping + audit) |
| `plugins/criticalalarm/DosyMessagingService.java` | Extends `MessagingService` do Capacitor. Intercepta FCM data `action=schedule_alarms` (agenda alarme via AlarmScheduler) e `action=cancel_alarms` (cancela via AlarmScheduler.cancelAlarm). Outras mensagens delega `super.onMessageReceived`. Audita `java_fcm_received`. | 49–64 (handle schedule_alarms com toggle check), 69–76 (handle cancel_alarms), 92–173 (handleScheduleAlarms agrupa minute key, agenda, audita), 186–207 (handleCancelAlarms por doseIdsCsv) |
| `plugins/criticalalarm/AlarmAuditLogger.java` | Singleton com `Executors.newSingleThreadExecutor()`. POST `medcontrol.alarm_audit_log` via REST quando user está no whitelist `alarm_audit_config`. Falha silenciosa. Sources: `java_alarm_scheduler`/`java_worker`/`java_fcm_received`. | 39 (executor compartilhado), 54–83 (logScheduled/logCancelled/logFired/logBatch), 85–143 (logEvent — POST PostgREST com Bearer + Content-Profile schema) |

### 1.2 JS / React (`src/`)

| Arquivo | Papel |
|---|---|
| `src/services/notifications/index.js` | Barrel + `useNotifications` hook. Re-exporta `rescheduleAll`/`cancelAll`/`subscribeFcm`/`unsubscribeFcm`/`inDnd`. `scheduleDoses` retro-compat wrapper. |
| `src/services/notifications/prefs.js` | Constantes (`CHANNEL_ID = 'doses_v2'`, `SCHEDULE_WINDOW_MS = 48h`, `DAILY_SUMMARY_NOTIF_ID = 999000001`, `VAPID_PUBLIC_KEY`). Helpers `loadPrefs`/`savePrefs`/`urlBase64ToUint8Array`/`doseIdToNumber` (com `% 2147483647`)/`inDnd`/`groupByMinute`/`filterUpcoming`/`enrichDose`. |
| `src/services/notifications/channels.js` | `ensureChannel` + `ensureFcmChannel` (LocalNotifications + PushNotifications API). `cancelAll` (full reset). `cancelGroup` (legado #200.1). `loadScheduledState`/`saveScheduledState`/`clearScheduledState` em `localStorage["dosy_scheduled_groups_v1"]`. |
| `src/services/notifications/scheduler.js` | `rescheduleAll` (módulo throttle 30s + trailing run + audit batch). `_rescheduleAllImpl` full cancel + reschedule from scratch. Path web legacy via `postMessage SCHEDULE_DOSES` → SW. |
| `src/services/notifications/fcm.js` | `subscribeFcm` (Capacitor + permission + register + ensureFcmChannel + savePrefs + analytics). `unsubscribeFcm` (delete push_sub + cancelAll). `bindFcmListenersOnce` (`registration` listener cacheia token em `localStorage["dosy_fcm_token"]` + RPC `upsert_push_subscription`). |
| `src/services/notifications/auditLog.js` | `isEnabled` RPC `is_alarm_audit_enabled` com cache 5min. `logAuditEvent` + `logAuditEventsBatch` insert direto em `alarm_audit_log`. Silent-fail garantido. Source `js_scheduler`. |
| `src/services/criticalAlarm.js` | Wrapper plugin Capacitor `registerPlugin('CriticalAlarm')`. Funções: `scheduleCriticalAlarm{,Group}`/`cancelCriticalAlarm{,s}`/`checkCriticalAlarmEnabled`/`checkAllPermissions`/`open*Settings`/`isIgnoringBatteryOptimizations`/`requestIgnoreBatteryOptimizations`/`setSyncCredentials`/`updateAccessToken`/`setCriticalAlarmEnabled`/`clearSyncCredentials`/`getDeviceId`. |
| `src/services/mutationRegistry.js` | `registerMutationDefaults(qc)` — defaults TanStack pra `confirmDose`/`skipDose`/`undoDose`/`registerSos`/`create*Patient/Treatment`/`update*`/`pause*`/`resume*`/`end*Treatment`. Onsettled `refetchDoses` debounce 2s. Não toca alarme direto — efeito: invalidate `['doses']` → App.jsx useEffect re-fires → rescheduleAll. |
| `src/hooks/useAuth.jsx` | Propaga `setSyncCredentials` em SIGNED_IN/TOKEN_REFRESHED/INITIAL_SESSION (`access_token + expires_at × 1000` para epoch ms). SIGNED_OUT explícito: `clearSyncCredentials` + DELETE push_sub. SIGNED_OUT spurious: ignora. Re-upsert push_sub em SIGNED_IN com `dosy_fcm_token` cached. |
| `src/hooks/useRealtime.js` | **DESABILITADO no App.jsx desde #157**. Mantido o código com watchdog 300s (foi 60s pré-#212), reconnect backoff exponencial, scoped refetch, debounce 1s invalidate, lock anti-concurrent-subscribe. |
| `src/hooks/usePushNotifications.js` | **Deprecated** — só `export { useNotifications as usePushNotifications }`. |
| `src/hooks/useUserPrefs.js` | TanStack query `['user_prefs']` lê `medcontrol.user_prefs` jsonb + cache local `medcontrol_notif`. Sync `setCriticalAlarmEnabled` Android no load + em mutation com `criticalAlarm` field. |
| `src/hooks/useAppResume.js` | Soft recover ≥5min idle: mutex `refreshInProgress` + debounce `RESUME_DEBOUNCE_MS=1000`. `supabase.auth.refreshSession()` + `removeAllChannels` + `refetchQueries({type:'active'})`. NÃO força reload (preserva URL). |
| `src/App.jsx` | Top-level useEffect re-agenda alarmes via `scheduleDoses(allDoses, {patients})` quando signatures (`id:status:scheduledAt`) mudam. Janela `-1d/+14d` com hourTick. Auto-subscribe push em first-login (`subscribe(0)`). Listeners FCM/LocalNotifications (foreground tap + receive). Deep-link `dosy:openDose`/`dosy:openDoses` (com retries 300/1500/3500ms do MainActivity). |
| `src/pages/Dashboard.jsx` | **NÃO chama mais `scheduleDoses`** desde v0.2.2.3 (#213 — caller redundante removido). Setinterval 60s só atualiza `tick` (UI stats), não dispara alarme. |
| `src/components/PermissionsOnboarding.jsx` | Modal de 5 permissões (`notifsEnabled`/`canScheduleExact`/`canFullScreenIntent`/`canDrawOverlay`/`ignoringBatteryOpt`). Refresh em `resume` Capacitor. Dismissed por versão em `localStorage["dosy_permissions_dismissed_version"]`. |
| `src/pages/Settings/sections.jsx` | `NotificationsSection` controla toggle push, advanceMins, criticalAlarm, DnD. Botão "Verificar permissões do alarme" dispara `dosy:checkPermissions` (capturado pelo PermissionsOnboarding). |

### 1.3 Edge Functions Supabase

| Slug | Deployed? | Local source? | verify_jwt | Cron? |
|---|---|---|---|---|
| `daily-alarm-sync` | ✅ v2 ACTIVE | ❌ **NÃO ESTÁ NO REPO LOCAL** | false | `daily-alarm-sync-5am` (`0 8 * * *` = 5am BRT) |
| `dose-trigger-handler` | ✅ v17 ACTIVE | ✅ `supabase/functions/dose-trigger-handler/index.ts` | false | Disparo via trigger DB `dose_change_notify` AFTER INSERT/UPDATE em doses |
| `notify-doses` | ✅ v19 ACTIVE | ✅ `supabase/functions/notify-doses/index.ts` | false | **Cron `notify-doses-1min` UNSCHEDULED em #209** — Edge órfã, código stale com refs `dose_alarms_scheduled` |
| `schedule-alarms-fcm` | ✅ v15 ACTIVE | ✅ `supabase/functions/schedule-alarms-fcm/index.ts` | false | **Cron `schedule-alarms-fcm-6h` UNSCHEDULED em #209** — Edge órfã |
| `send-test-push` | ✅ v14 ACTIVE | ✅ `supabase/functions/send-test-push/index.ts` | true | Manual via admin |
| `delete-account` | ✅ v13 ACTIVE | ✅ | true | Manual |
| `admin-posthog-stats`/`admin-sentry-issues`/`admin-feature-flags` | ✅ ACTIVE | ❌ Não no repo principal | true | Manual (painel admin) |
| `_shared/userPrefs.ts` | Embedded em cada Edge | ✅ local | n/a | — |
| `_shared/auditLog.ts` | Embedded em daily-alarm-sync deployed | ❌ **NÃO está no repo local** | n/a | — |

### 1.4 Banco — Schema `medcontrol`

#### Tabelas relevantes

- `push_subscriptions` — id/userId/endpoint/keys/advanceMins/userAgent/createdAt/platform/deviceToken. Usado por todas Edges + `useAuth.jsx` re-upsert.
- `dose_notifications` — (doseId, channel) PK. Idempotência `notify-doses`. **Ainda existe no DB** mas só era escrita pelo cron unscheduled.
- `dose_alarms_scheduled` — **DROPADA em v0.2.2.4 (`drop_dose_alarms_scheduled_v0_2_2_4`)**.
- `alarm_audit_log` — id/user_id/device_id/dose_id/source/action/scheduled_at/patient_name/med_name/metadata jsonb/created_at. Criada em v0.2.2.0 (#210).
- `alarm_audit_config` — user_id PK/enabled/notes/created_at/created_by/updated_at. Whitelist por user.
- `auth_events` — id/userId/event_type/app_version/app_build/platform/user_agent/device_id/logout_kind/details/createdAt. Telemetria auth pt-BR (#201).
- `user_prefs` — user_id PK/prefs jsonb/updatedAt. Default `{push, criticalAlarm, dailySummary, summaryTime, advanceMins, dndEnabled, dndStart, dndEnd}`.

#### Triggers ativos

| Tabela | Trigger | Quando | Função |
|---|---|---|---|
| `doses` | `dose_change_notify` | AFTER INSERT/UPDATE OF status,scheduledAt + WHEN(NEW.status='pending' AND scheduledAt>now) | `notify_dose_change()` → `net.http_post` para Edge `dose-trigger-handler` |
| `doses` | `enforce_sos_via_rpc_trigger` | BEFORE INSERT | bloqueia INSERT direto type=sos (força RPC) |
| `doses` | `validate_dose_treatment_match_trigger` | BEFORE INSERT/UPDATE | valida (treatmentId, patientId) consistente |
| `patients` | `enforce_patient_limit_trigger` | BEFORE INSERT | gating Free (max 1 paciente) |

#### Cron jobs ATIVOS (`pg_cron`)

| Job | Schedule (UTC) | Schedule (BRT) | Comando |
|---|---|---|---|
| `daily-alarm-sync-5am` | `0 8 * * *` | 5am BRT | POST Edge `daily-alarm-sync` |
| `alarm-audit-cleanup-daily` | `15 3 * * *` | 0:15 BRT | `cron_alarm_audit_cleanup()` — limpa >7d |
| `cleanup-stale-push-subs-daily` | `0 5 * * *` | 2am BRT | `cleanup_stale_push_subscriptions()` — DELETE deviceToken NULL + >30d |
| `extend-continuous-treatments-daily` | `0 4 * * *` | 1am BRT | `run_extend_continuous_with_audit()` (não-alarme, mas adiciona doses → trigger dose_change_notify firea por cada uma) |
| `anonymize-old-doses` | `0 3 * * 0` | dom 0am BRT | UPDATE doses SET observation='[anonimizado]' WHERE scheduledAt < now - 3y |

Cron jobs **UNSCHEDULED** em #209 (não aparecem mais em `cron.job`):
- `notify-doses-1min` (push tray fallback)
- `schedule-alarms-fcm-6h` (FCM data sweep)

### 1.5 Manifest, Capacitor, Service Worker

| Arquivo | Pontos relevantes |
|---|---|
| `android/app/src/main/AndroidManifest.xml` | Permissões: POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, USE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED, WAKE_LOCK, VIBRATE, USE_FULL_SCREEN_INTENT, ACCESS_NOTIFICATION_POLICY, TURN_SCREEN_ON, DISABLE_KEYGUARD, FOREGROUND_SERVICE, FOREGROUND_SERVICE_SPECIAL_USE, SYSTEM_ALERT_WINDOW, REQUEST_IGNORE_BATTERY_OPTIMIZATIONS. Components: AlarmActivity (showOnLockScreen/turnScreenOn/showWhenLocked/singleInstance/excludeFromRecents), AlarmReceiver, AlarmActionReceiver, AlarmService (foregroundServiceType=specialUse + PROPERTY_SPECIAL_USE_FGS_SUBTYPE=medication_reminder), DosyMessagingService com intent-filter MESSAGING_EVENT (substitui o do Capacitor via `tools:node="remove"`), BootReceiver com BOOT_COMPLETED/LOCKED_BOOT_COMPLETED/MY_PACKAGE_REPLACED. |
| `capacitor.config.ts` | PushNotifications presentationOptions: badge/sound/alert. LocalNotifications smallIcon `ic_stat_dosy` + iconColor `#FF6B5B` + sound `default`. |
| `android/app/build.gradle` | versionCode 62 / versionName 0.2.2.4. Deps: `androidx.work:work-runtime:2.9.1`, `com.google.guava:guava:33.4.0-android`, `com.google.firebase:firebase-messaging:25.0.1`. Dual-app debug/release com applicationIdSuffix `.dev`. |
| `public/sw.js` | Service Worker web legado (CACHE `medcontrol-v6`). `push` handler com title/body + actions confirm/snooze 15min via setTimeout. `message` handler `SCHEDULE_DOSES` + `CLEAR_SCHEDULE` (Map _timers de setTimeout). Não usado em native (Capacitor não roda SW). |
| `android/app/src/main/res/raw/dosy_alarm.mp3` | 96kbps mono ~811KB (release v0.2.1.6 #203). |

---

## 2. Fluxo Real — Ponta a Ponta

### 2.1 Como uma dose vira alarme/push (estado pós v0.2.2.4)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Cenário A — Dose criada via app (CRUD)                                │
│                                                                        │
│   User cria treatment → RPC create_treatment_with_doses                │
│   → INSERT múltiplas rows em medcontrol.doses                          │
│   → Trigger dose_change_notify AFTER INSERT (filtra status='pending'    │
│     AND scheduledAt>now) → net.http_post para Edge dose-trigger-handler│
│                                                                        │
│   dose-trigger-handler:                                                │
│     1. Verifica prefs.criticalAlarm — se OFF, retorna 'critical-alarm- │
│        off' (NO FCM, NO push tray — gap!)                              │
│     2. Verifica inDndWindow — se TRUE, retorna 'dnd-window' (NO FCM,   │
│        notify-doses cron deveria cobrir push tray mas está UNSCHEDULED)│
│     3. Verifica scheduledAt > now + 6h → 'beyond-cron-horizon' (espera │
│        daily-alarm-sync 5am BRT pegar)                                 │
│     4. Caso contrário: monta payload {action:'schedule_alarms', doses: │
│        JSON.stringify([{doseId, medName, unit, scheduledAt,           │
│        patientName}])} e dispara FCM v1 para cada device do user      │
│                                                                        │
│   Device recebe FCM data message:                                      │
│     → DosyMessagingService.onMessageReceived (data.action=='schedule_  │
│        alarms')                                                        │
│     → Verifica critical_alarm_enabled local — se false, skip          │
│     → handleScheduleAlarms agrupa doses por minute key, calcula        │
│        alarmId = AlarmScheduler.idFromString(sorted doseIds join '|')  │
│     → AlarmScheduler.scheduleDose: setAlarmClock(triggerAt, showPi)    │
│        + persistAlarm em SharedPreferences                             │
│     → Audita 'java_fcm_received' + 'scheduled' em alarm_audit_log      │
│                                                                        │
│   App em foreground também:                                            │
│     → useAuth seta credentials                                         │
│     → App.jsx useEffect detecta dosesSignature mudou → scheduleDoses() │
│     → rescheduleAll throttled 30s → cancelAll + agenda groups com      │
│        scheduleCriticalAlarmGroup → plugin Java AlarmScheduler        │
│     → Audita 'js_scheduler' + 'scheduled'                              │
│                                                                        │
│   IDs determinísticos: tanto FCM-path quanto JS-path usam o mesmo      │
│   groupKey hash → setAlarmClock com mesmo id = replace (idempotente)   │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ Cenário B — App fechado + dose já existente                            │
│                                                                        │
│   Cron daily-alarm-sync-5am (5am BRT diário):                          │
│     → Edge daily-alarm-sync                                            │
│     → Lê push_subscriptions agrupado por userId                        │
│     → Para cada user: prefs.criticalAlarm? + patients + doses pendentes│
│        próximas 48h + filtra fora DnD                                  │
│     → FCM data com TODAS doses 48h horizon                             │
│     → DosyMessagingService handleScheduleAlarms agenda todas no        │
│        AlarmManager                                                    │
│                                                                        │
│   Defense-in-depth via DoseSyncWorker (periodic 6h):                   │
│     → Lê creds + accessToken cached (NÃO refreshea)                    │
│     → Skip se token expirado (próxima execução pega fresh do JS)       │
│     → fetchUpcomingDoses 48h PostgREST direto                          │
│     → scheduleDoses local (idêntico ao FCM path)                       │
│     → Audita 'java_worker'                                             │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ Cenário C — Alarme dispara no horário                                  │
│                                                                        │
│   AlarmManager dispara PendingIntent → AlarmReceiver.onReceive         │
│     1. Wakelock partial 10s                                            │
│     2. Audita 'fired_received' em alarm_audit_log (1 row por dose)    │
│     3. startForegroundService(AlarmService) — path primário            │
│        (fallback se exception: posta notif fullScreenIntent com som    │
│        do canal doses_critical_v2 e tap → MainActivity openDoseIds)    │
│                                                                        │
│   AlarmService.onStartCommand:                                         │
│     1. ensureChannel doses_critical (sem som — service drives)         │
│     2. Constrói notif persistente com 3 actions + fullScreenIntent     │
│     3. startForeground com FOREGROUND_SERVICE_TYPE_SPECIAL_USE         │
│     4. startActivity(AlarmActivity) — BAL via SYSTEM_ALERT_WINDOW      │
│     5. MediaPlayer (dosy_alarm.mp3 USAGE_ALARM loop) + Vibrator        │
│        waveform repeat                                                 │
│                                                                        │
│   Lockscreen: AlarmActivity setShowWhenLocked + WakeLock SCREEN_BRIGHT │
│   Unlocked: heads-up notif + activity por direct startActivity         │
│                                                                        │
│   User interage:                                                       │
│     - Ciente → AlarmActivity.handleAction('acknowledge'):              │
│         AlarmService.stopActiveAlarm + cancel persistent notif +       │
│         requestDismissKeyguard + MainActivity com openDoseIds          │
│         → MainActivity postJsEvent('dosy:openDoses', ...)              │
│         → App.jsx event listener → navigate(`/?doses=...`)             │
│         → Dashboard MultiDoseModal abre                                │
│     - Adiar 10min → scheduleSnooze: setAlarmClock(+10min, mesmo id)    │
│     - Pular/Ignorar → cancelPersistentNotification + finish()          │
│     - Mute (volume keys ou botão) → AlarmService ACTION_MUTE/UNMUTE    │
│     - Notif tray actions (sem abrir activity) → AlarmActionReceiver    │
│       mesma lógica + broadcast FINISH_ALARM_ACTIVITY                   │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ Cenário D — Dose cancelada/mudou status (UPDATE)                       │
│                                                                        │
│   confirm_dose/skip_dose RPC → UPDATE doses SET status=...             │
│   → Trigger dose_change_notify firea (WHEN status='pending' falha     │
│     pois status virou done/skipped → trigger NÃO firea)                │
│                                                                        │
│   Ou DELETE via deleteTreatment cascade:                              │
│   → Trigger dose_change_notify só firea AFTER INSERT/UPDATE, não       │
│     DELETE → FCM cancel_alarms NÃO é disparado                         │
│                                                                        │
│   ⚠️ GAP: cancel_alarms FCM existe em DosyMessagingService.handle      │
│     CancelAlarms (com dose IDs CSV) MAS nenhuma Edge Function dispara  │
│     esse action. Código JAVA está pronto mas não tem caller server-    │
│     side. Documentação README aponta dose-trigger-handler v16          │
│     'cancel_alarms' action mas a versão deployed v17 do código local   │
│     NÃO TEM esse path (linha 100: type==='DELETE' → skipped).          │
│     Fix prático: alarme antigo continua agendado no AlarmManager,      │
│     dispara no horário, AlarmActivity mostra dose deletada (groupBy    │
│     query falha — apenas exibe payload cacheado em SharedPreferences). │
│   Mitigação parcial: rescheduleAll cancelAll + reschedule from         │
│     scratch sempre que app foreground roda → corrige na próxima        │
│     reabertura do app (mas user com app fechado vê alarme zombie).     │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Componentes e responsabilidades

```
                ┌─────────────────────────────────────────┐
                │  React App (Capacitor WebView)          │
                │                                          │
                │  App.jsx useEffect ──► rescheduleAll ──► │
                │      ▲                  (throttled 30s)  │
                │      │                     │             │
                │   doses+patients      auditLog.js       │
                │   signature              POST          │
                │      │                     ▼             │
                │  useDoses           alarm_audit_log     │
                │      │                                    │
                │  ['doses'] cache                          │
                └──────┬──────────────────────────────────┘
                       │
                       │   (Capacitor bridge)
                       ▼
   ┌───────────────────────────────────────────────────────┐
   │ Java native — CriticalAlarmPlugin                      │
   │                                                         │
   │   scheduleGroup ─► AlarmScheduler.scheduleDose         │
   │                            │                            │
   │                            ▼                            │
   │              AlarmManager.setAlarmClock(triggerAt, pi) │
   │                            +                            │
   │              SharedPreferences "scheduled_alarms"      │
   │                            │                            │
   │            ┌───────────────┴─────────────────────┐     │
   │            │                                      │     │
   │            ▼                                      ▼     │
   │     BootReceiver                          AlarmReceiver │
   │     (reagenda pós                           (no horário)│
   │      boot/upgrade)                                │     │
   │                                                    ▼    │
   │                                       AlarmService FG  │
   │                                       (MediaPlayer +   │
   │                                        Vibrator +      │
   │                                        FG notif 3btn)  │
   │                                                    │   │
   │                                                    ▼   │
   │                                          AlarmActivity │
   │                                          (full-screen) │
   │                                                    │   │
   │                                                    ▼   │
   │                            handleAction acknowledge    │
   │                                                    │   │
   │                                                    ▼   │
   │                          MainActivity.postJsEvent     │
   │                          'dosy:openDoses' + retries   │
   └────────────────────────┬──────────────────────────────┘
                            │
                            ▼  (FCM data caminho paralelo)
   ┌───────────────────────────────────────────────────────┐
   │ Supabase Edge Functions                                │
   │                                                         │
   │  dose-trigger-handler (trigger DB realtime)            │
   │  daily-alarm-sync (cron 5am BRT, 48h horizon)          │
   │                            │                            │
   │                            ▼ FCM v1 data message       │
   │                  DosyMessagingService                   │
   │                  onMessageReceived                      │
   │                            │                            │
   │                            ▼                            │
   │                  handleScheduleAlarms                   │
   │                  → AlarmScheduler.scheduleDose         │
   │                  → AlarmAuditLogger 'java_fcm_received'│
   │                                                         │
   │  DoseSyncWorker periodic 6h (defense-in-depth):        │
   │       REST /doses + AlarmScheduler.scheduleDose        │
   │       NÃO depende de FCM, é fallback se FCM falhar     │
   └───────────────────────────────────────────────────────┘
```

### 2.3 Channels Android (3 IDs distintos)

| Channel ID | Quem cria | Som | Uso |
|---|---|---|---|
| `doses_v2` | LocalNotifications via `notifications/channels.js` `ensureChannel`/`ensureFcmChannel` + AlarmActivity.ensureChannel | default ringtone (LocalNotifications sound:'default') | Push tray FCM regular + LocalNotifications agendadas (path !shouldRing) + AlarmActivity.postPersistentNotification (código morto) |
| `doses_critical` | AlarmService.ensureChannel | **NULL** (service drives MediaPlayer) | Notif foreground service do alarme ativo (3 actions) |
| `doses_critical_v2` | AlarmReceiver.ensureChannel | `dosy_alarm.mp3` USAGE_ALARM | Fallback notif se startForegroundService falhar |

---

## 3. Mapa de Dependências Cruzadas

### 3.1 Hash de groupId (cross-source idempotency)

| Origem | Algoritmo |
|---|---|
| JS `notifications/prefs.js` `doseIdToNumber` | `((h<<5)-h)+charCode` loop + `Math.abs(h) % 2147483647` |
| Java `AlarmScheduler.idFromString` | `((h<<5)-h)+charCode` loop + `Math.abs(h)` (**sem `% 2147483647`**) |
| Java passa para `getBroadcast(ctx, id, ...)` | int 32-bit, qualquer valor positivo OK |

⚠️ **Inconsistência**: para hashes que produzem valor `> 2147483647 / 2` o JS aplica módulo mas o Java não. Para a maioria dos doseIds (UUID v4) o `Math.abs(h)` já cai dentro do range int32 positivo (a soma cumulativa não tende a estourar para strings curtas), então na prática IDs coincidem. **Mas não é garantido teoricamente** — vale validar com um teste cruzado JS↔Java.

### 3.2 Channels que NÃO recebem cancel

- Cron `notify-doses-1min` (UNSCHEDULED) → idempotência `dose_notifications` PK fica órfã. Tabela ainda existe mas não cresce.
- `dose_alarms_scheduled` → DROPADA em #214. Código `notify-doses/index.ts` linha 196 ainda consulta a tabela inexistente.

### 3.3 Identidades de device

- `criticalAlarmPlugin.getDeviceId()` retorna UUID v4 persistido em SharedPreferences (estável até `clearSyncCredentials`).
- `auditLog.js` JS-side usa `criticalAlarm.getDeviceId()` (UUID).
- `AlarmAuditLogger.java` linha 106 grava `device_id` como `MODEL + " (" + MANUFACTURER + ")"` (string descritiva, **não-única** entre devices iguais).
- `daily-alarm-sync` (Edge) linha 169 grava `device_id` como `sub.deviceToken.slice(-12)` (últimos 12 chars do FCM token).

→ Três significados distintos para `device_id` na mesma coluna `alarm_audit_log.device_id`. Análise cross-source dificultada.

---

## 4. Bugs, Riscos e Observações

### 4.1 P0 — Funcional crítico

#### 🔴 [B-01] Janela DnD cria zona de silêncio total

- **Sintoma:** user com `dndEnabled=true` (ex.: 23:00–07:00) e dose nesse intervalo recebe **zero** notificações.
- **Causa:**
  - `dose-trigger-handler` linha 134-138: skip FCM data com `inDndWindow=true`.
  - `daily-alarm-sync` linha 121 (`dosesOutsideDnd = doses.filter(d => !inDndWindow)`): filtra fora doses na janela DnD.
  - `notify-doses` cron 1min era o caminho de "push tray silencioso" pra dose em DnD — **UNSCHEDULED em #209**.
- **Resultado:** dose dentro da janela DnD não tem alarme nativo (correto, é a intenção) **mas também não tem push tray fallback** (regressão pós-#209).
- **Mitigação parcial:** `rescheduleAll` (JS, app foreground) tem path `!shouldRing` que agenda `LocalNotification` tray local (`scheduler.js` linha 224-261). User com app aberto na noite passa. User com app fechado em background pela noite não recebe nada até o cron das 5am BRT (que também filtra DnD).
- **Fix sugerido:** reativar `notify-doses-1min` cron, ou modificar `daily-alarm-sync` para emitir `LocalNotification` tray (não-FCM, sem som via channel `doses_v2`) para doses dentro da janela DnD.

#### 🔴 [B-02] `criticalAlarm=false` + app em background = silêncio total

- **Sintoma:** user que desligou "Alarme crítico" e fechou o app não recebe notificação nenhuma quando a dose chega.
- **Causa:**
  - `dose-trigger-handler` linha 125-129: skip FCM data se `prefs.criticalAlarm=false`.
  - `daily-alarm-sync` linha 116: `if (!prefs.criticalAlarm) skip` (continue early, não envia FCM).
  - `notify-doses` cron UNSCHEDULED desde #209.
- **Resultado:** intenção do toggle era "trocar alarme estilo despertador por push tray simples". Hoje significa "desligar tudo se app não estiver foreground".
- **Fix sugerido:** mesmo do B-01 (reativar caminho push tray fallback).

#### 🔴 [B-03] Edge `notify-doses` v19 deployed referencia tabela DROPADA

- **Sintoma:** se cron `notify-doses-1min` for re-scheduled ou alguém invocar a Edge manualmente, ela responde 500 com erro PostgreSQL `42P01 relation "medcontrol.dose_alarms_scheduled" does not exist`.
- **Causa:** `notify-doses/index.ts` linha 187-203 ainda consulta `dose_alarms_scheduled` (função `shouldSkipPushBecauseAlarmScheduled`). Migration `drop_dose_alarms_scheduled_v0_2_2_4` removeu a tabela. Edge não foi re-deployed para limpar a referência.
- **Fix:** remover bloco `shouldSkipPushBecauseAlarmScheduled` da Edge (e do código local) e re-deploy. Alternativamente, decidir explicitamente desativar a Edge (set status=PAUSED via Supabase Management API). Estado atual é "código órfão deployed que crasha se chamado".

### 4.2 P1 — Drift e código sujo

#### 🟠 [B-04] `daily-alarm-sync` + `_shared/auditLog.ts` ausentes no repo local

- **Sintoma:** `supabase/functions/` local não tem `daily-alarm-sync/index.ts` nem `_shared/auditLog.ts`. Ambos estão deployed (v2 ACTIVE) com 211 linhas (Edge) + 64 linhas (shared) que só existem no Supabase.
- **Impacto:** ninguém consegue revisar via PR, code review, gitleaks, eslint, busca grep. Próximo deploy via `supabase functions deploy` daria push de pastas vazias (ou perderia a função).
- **Fix:** exportar via `supabase functions download daily-alarm-sync` + commit. Repetir para `_shared/auditLog.ts`.

#### 🟠 [B-05] Migrations locais incompletas — ~10 ausentes

- **Sintoma:** filesystem tem 21 migrations; DB tem 22. Faltam locais:
  - `20260504133842_add_patient_photo_thumb`
  - `20260504134036_replace_photo_thumb_with_photo_version`
  - `20260504163656_drop_signup_plus_promo_trigger`
  - `20260505133325_144_jwt_claim_tier_auth_hook`
  - `20260505133542_146_cron_audit_log_extend_continuous`
  - `20260507175920_admin_db_stats_function`
  - `20260507191028_add_tester_grade_to_subscriptions_v2`
  - `20260513121915_fix_update_treatment_schedule_timezone` (#209)
  - `20260513122009_data_fix_doses_timezone_v0_2_1_9_retry`
  - `20260513122442_cron_jobs_v0_2_1_9_daily_alarm_sync`
  - `20260513132459_create_alarm_audit_log_v0_2_2_0` (#210)
  - `20260513132512_cron_alarm_audit_cleanup_v0_2_2_0`
  - `20260513161435_grant_service_role_audit_tables` (#211)
  - `20260513161809_grant_authenticated_audit_tables` (#211)
  - `20260513191154_drop_dose_alarms_scheduled_v0_2_2_4` (#214)
- **Impacto:** rebuild local do schema é impossível. ADR/history perdido.
- **Fix:** `supabase db diff` ou `supabase migration repair` + commit.

#### 🟠 [B-06] Edge `schedule-alarms-fcm` v15 deployed órfã

- **Sintoma:** Edge `schedule-alarms-fcm` ainda deployed ACTIVE, mas o cron `schedule-alarms-fcm-6h` foi UNSCHEDULED em #209. `notify-doses` idem.
- **Impacto:** menor (sem cron, sem invocação), mas qualquer atacante anônimo pode disparar essas Edges (`verify_jwt:false`) → consome quota Supabase + FCM (potencial abuse).
- **Fix:** deletar as Edges via `supabase functions delete notify-doses schedule-alarms-fcm` OU set `verify_jwt:true` e usar apenas via cron autenticado.

#### 🟠 [B-07] Hash `AlarmScheduler.idFromString` Java sem `% 2147483647`

- **Sintoma:** JS `doseIdToNumber` aplica `Math.abs(h) % 2147483647`. Java só `Math.abs(h)`. Para certos groupKeys (longos), os IDs cross-source podem divergir.
- **Impacto:** mesma dose pode ter alarme agendado **duas vezes** (JS path com id_A, FCM/Worker path com id_B), aparecer duplicado pra user.
- **Probabilidade:** baixa (UUID v4 hashes raramente estouram int32) mas não-zero. Ver tabela de testes no item 5.
- **Fix:** alinhar Java pra `Math.abs(h) % 2147483647` ou alinhar JS pra só `Math.abs(h)`.

#### 🟠 [B-08] `cancel_alarms` FCM action sem caller server-side

- **Sintoma:** `DosyMessagingService.handleCancelAlarms` está pronto pra receber `action=cancel_alarms` com `doseIds` CSV, e `AlarmScheduler.cancelAlarm` existe. Mas **nenhuma Edge Function envia esse FCM data**. O `dose-trigger-handler` (v17 deployed) ignora `DELETE` (linha 100-101 `skipped:'delete'`) e não dispara cancel quando status muda de `pending` → `done/skipped/cancelled`.
- **Impacto:** user deleta tratamento ou pula dose → alarme local continua agendado → toca no horário com payload cacheado em SharedPreferences (dose já deletada).
- **Mitigação atual:** próxima vez que app abrir, `rescheduleAll` cancela tudo + re-agenda só doses pending.
- **Fix:** ou implementar `cancel_alarms` no `dose-trigger-handler` (caminho server→device em tempo real) ou aceitar a limitação documentada (próxima abertura do app corrige).

### 4.3 P2 — Inconsistências e código morto

#### 🟡 [B-09] `dose-trigger-handler` SIX_HOURS_MS desalinhado com 48h horizon

- Linha 115-118 skipa doses agendadas mais de 6h no futuro com `'beyond-cron-horizon'`. Comentário diz que o cron `schedule-alarms-fcm-6h` cobriria essas — mas esse cron foi UNSCHEDULED. Hoje, dose criada com `scheduledAt` entre 6h e 48h no futuro só recebe FCM no próximo `daily-alarm-sync` (até 24h de atraso).
- **Fix:** mudar `SIX_HOURS_MS` para `FORTY_EIGHT_HOURS_MS` (48 × 60 × 60 × 1000) alinhado ao horizon do `daily-alarm-sync` + Worker.

#### 🟡 [B-10] 3 Channel IDs distintos, papéis sobrepostos

- `doses_v2` (LocalNotifications + AlarmActivity.postPersistentNotification dead code)
- `doses_critical` (AlarmService FG notif — sound null, MediaPlayer drives)
- `doses_critical_v2` (AlarmReceiver fallback fullScreenIntent — sound `dosy_alarm.mp3`)
- O canal antigo `doses_critical` continua órfão no device de users de v0.1.7 pré-#203. Sem migration / cleanup. Próximo merge do som customizado para o service deveria consolidar em 2 canais (1 push tray, 1 alarme crítico) ou 1 só com sound configurável.

#### 🟡 [B-11] Código morto em `AlarmActivity.java`

- `mediaPlayer`, `vibrator` (campos instance, linha 67-68) — nunca atribuídos (Service tem `activePlayer` estático)
- `startAlarmSound` (685), `startVibration` (703) — funções definidas, nunca chamadas
- `postPersistentNotification` (774) — função definida, nunca chamada
- `cancelPersistentNotification` (820) — chamada em `handleAction` mas a notif que cancela nunca foi postada (postPersistentNotification não roda)
- `CHANNEL_ID = "doses_v2"` (63), `NOTIF_ID_OFFSET = 100_000_000` (64) — usados só no código morto
- **Fix:** remover ~150 linhas de código morto.

#### 🟡 [B-12] `usePushNotifications.js` é só re-export deprecated

- Arquivo único com 7 linhas, comentário `@deprecated`. App.jsx ainda importa via `from '../hooks/usePushNotifications'`.
- **Fix:** trocar import direto em App.jsx e remover o arquivo.

#### 🟡 [B-13] `BootReceiver` perde alarmes que passaram durante boot

- Linha 41: `if (triggerAt <= now) continue;` — dose passada durante reboot é skip. Sem recovery.
- Cenário: user dorme com phone off, boota às 9am, dose era 8am. Boot receiver pula esse alarme, dose fica como `pending` no DB sem alerta visual até user abrir o app.
- **Fix:** se `now - triggerAt < 1h` (margem), disparar alarme imediato (mostrar como atrasada).

#### 🟡 [B-14] FCM payload `daily-alarm-sync` sem chunking

- Linha 145-149 `JSON.stringify(dosesPayload)` para 48h horizon (limit 1000 doses em `daily-alarm-sync`, 500 em `DoseSyncWorker`). FCM v1 data message limit é 4KB. Para user com 50+ doses/dia e 48h horizon = 100+ doses, payload pode passar 4KB → FCM `INVALID_ARGUMENT`.
- **Fix:** dividir em batches de ~30 doses por FCM data message (3-4 mensagens sequenciais por device).

### 4.4 P3 — Higiene e telemetria

#### 🟢 [B-15] `device_id` inconsistente entre fontes
- JS escreve UUID estável; Java grava `Model (Manufacturer)`; Edge grava últimos 12 chars do FCM token. Mesma coluna `alarm_audit_log.device_id` tem 3 semânticas.
- **Fix:** padronizar em UUID estável + cache. AlarmAuditLogger Java deve ler de `SharedPreferences "device_id"` (já existe via `setSyncCredentials`). Edge pode usar `deviceToken.slice(-12)` mas marcar isso em metadata, deixar `device_id` consistente.

#### 🟢 [B-16] `useRealtime` desabilitado — UI não atualiza entre devices
- Comentado no App.jsx desde #157 v0.2.1.0 por `publication supabase_realtime empty + reconnect cascade burn 13 req/s`. Confirmado em README.
- Atualizações cross-device só via pull-to-refresh, `refetchOnWindowFocus` ou interval 15min do Dashboard.
- Para alarme: irrelevante (FCM cobre). Para UI: degradação documentada.

#### 🟢 [B-17] `subscribeFcm(0)` no first-login com `advanceMins=0`
- App.jsx linha 112: `subscribe(0)` — auto-subscribe push permission no first-login com `advanceMins=0`. Mas a função `subscribeFcm(advanceMins=15)` no `fcm.js` linha 25 default é 15. App.jsx força 0 → conflito com default global. Não-bug funcional mas inconsistência semântica.

#### 🟢 [B-18] `MainActivity.postJsEvent` retries fixos sem dedup window
- 3 dispatches (300/1500/3500ms). App.jsx dedupes via `window.__dosyLastDoseIds` (comparação `===`). Se IDs CSV chegam em ordem diferente (por race), dedup falha. Risk baixo (mesma string vinda do mesmo intent).

#### 🟢 [B-19] Service Worker `sw.js` ainda menciona "MedControl" (linha 71/156)
- Não-bug funcional (web legacy), mas branding antigo persiste no path web.

---

## 5. Sugestões de Melhoria — Priorizadas

### P0 (próxima release)

1. **[B-01/B-02 fix]** Restaurar caminho "push tray fallback DnD/criticalAlarm-off". Opções:
   - Reativar cron `notify-doses-1min` (mais simples, custo egress já analisado em README) E corrigir Edge `notify-doses` removendo refs `dose_alarms_scheduled`.
   - OU evoluir `daily-alarm-sync` para gerar **dois tipos** de payload: `schedule_alarms` (alarme crítico fora DnD) E `schedule_tray_only` (push tray dentro DnD ou com criticalAlarm OFF) — DosyMessagingService teria handler novo `schedule_tray_only` que agenda LocalNotifications via JSI bridge.
2. **[B-03 fix]** Remover bloco `shouldSkipPushBecauseAlarmScheduled` da Edge `notify-doses` + redeploy. Ou deletar a Edge.

### P1

3. **[B-04 fix]** Baixar source `daily-alarm-sync` + `_shared/auditLog.ts` do Supabase e commitar no repo.
4. **[B-05 fix]** Restaurar migrations faltantes via `supabase db diff` ou pull manual de cada uma.
5. **[B-06 fix]** Deletar Edges órfãs `schedule-alarms-fcm` e (se confirmado abandono) `notify-doses`.
6. **[B-07 fix]** Alinhar `AlarmScheduler.idFromString` Java com `% 2147483647`. Adicionar teste unitário cross-source.
7. **[B-08 fix]** Implementar cancel_alarms server-side em `dose-trigger-handler` para `UPDATE` com `status` mudando para `done/skipped/cancelled` E `DELETE` (precisa expandir o trigger DB para passar `old_record`).

### P2

8. **[B-09 fix]** `dose-trigger-handler` `SIX_HOURS_MS` → `48 * 60 * 60 * 1000`.
9. **[B-10 fix]** Consolidar para 2 canais: `dosy_tray` (LocalNotifications + FCM push regular) e `dosy_critical` (alarme estilo despertador). Plano de migration: criar canais novos, deletar antigos via `NotificationManager.deleteNotificationChannel("doses_critical")` em código de migration que roda no app boot uma vez.
10. **[B-11 fix]** Deletar código morto em `AlarmActivity` (mediaPlayer/vibrator/startAlarmSound/startVibration/postPersistentNotification/cancelPersistentNotification + constantes associadas).
11. **[B-12 fix]** Inline `useNotifications` em App.jsx + deletar `usePushNotifications.js`.
12. **[B-13 fix]** Em `BootReceiver`, se `(now - triggerAt) < 3600_000` (1h), agendar alarme imediato em vez de skip. Aceitável que o user veja "atrasada" mas pelo menos é notificado.
13. **[B-14 fix]** Em `daily-alarm-sync`, particionar `dosesPayload` em chunks de 30 doses por FCM message. Send paralelo `Promise.all` no mesmo deviceToken.

### P3

14. **[B-15 fix]** Padronizar `device_id` = UUID. Java AlarmAuditLogger lê de `SharedPreferences "device_id"`. Edge usa `device_id` da row push_subscriptions (precisa adicionar coluna, ou cachear no payload FCM).
15. **[B-19 fix]** Trocar `MedControl 💊` por `Dosy 💊` no `sw.js`.
16. **Documentar** em CLAUDE.md / PROJETO.md o fluxo completo de alarme com diagrama. Esta auditoria pode virar a base.
17. **Teste E2E** alarme: criar dose +1min → confirmar disparo do AlarmActivity + sound + actions. Hoje cobre só logcat manual em device físico.

---

## 6. Conclusão

**Pontos fortes:**

- Defense-in-depth real: 3 caminhos (JS app foreground, FCM data via cron+trigger, WorkManager) garantem que dose é agendada mesmo com qualquer um falhando.
- Idempotência via hash determinístico de groupId — múltiplas fontes não duplicam (com a ressalva de B-07).
- Persistência em SharedPreferences + BootReceiver garante sobrevivência a reboots.
- Audit log v0.2.2.0 dá visibilidade ponta-a-ponta dos 6 caminhos (JS scheduler, Java AlarmReceiver/Worker/FCM, Edge daily-sync/trigger).
- Throttle 30s + signature guard pós #211/#212/#213 eliminou o storm 1×/min.
- Permissões críticas Android todas cobertas em manifest + UI onboarding (5 checks).
- Sound customizado `dosy_alarm.mp3` em USAGE_ALARM stream bypassa silent/DND no nível do sistema.

**Pontos críticos a tratar:**

- **DnD + criticalAlarm-off viraram zonas de silêncio total** desde a UNSCHEDULE dos crons antigos em #209 (B-01 e B-02). É o bug funcional mais sério encontrado.
- **Drift entre repo e prod** — Edge `daily-alarm-sync` + 15 migrations só existem no Supabase (B-04, B-05). Sem rollback path.
- **Refs stale** em Edges `notify-doses` e `schedule-alarms-fcm` (B-03, B-06) — código órfão que crasha se chamado.
- **`cancel_alarms` sem caller** (B-08) — alarmes zombies de doses deletadas/marcadas tocam até user reabrir app.

**Métricas observáveis (via `alarm_audit_log`):**

- Source `js_scheduler` `batch_start/scheduled/batch_end` — saúde do path foreground (esperado <10/dia/user pós #212).
- Source `java_worker` — saúde do WorkManager 6h (esperado 4/dia/device).
- Source `java_fcm_received` — saúde da entrega FCM data (esperado 1/dia/device = cron 5am + qualquer trigger realtime).
- Source `java_alarm_scheduler` `fired_received` — saúde do disparo real (esperado = total de doses agendadas).
- Cross-check: doses pendentes 48h horizon ≈ `scheduled` count por source — discrepância indica falha em algum caminho.

**Próximos passos sugeridos:**

1. P0 acima (B-01/B-02 — restaurar fallback DnD).
2. P0 acima (B-03 — limpar Edge `notify-doses`).
3. P1 acima (B-04/B-05 — fechar drift repo↔prod).
4. Validação com user de B-08 (decidir se vale implementar cancel server-side ou aceitar mitigação atual).
