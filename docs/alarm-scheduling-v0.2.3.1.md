# Alarm + Push Scheduling — v0.2.3.1 (Refactor Plano A + Fixes B/C)

> Documento atualizado pós-refactor v0.2.3.1 (7 blocos). Substitui `docs/archive/alarm-scheduling-shadows-pre-v0.2.3.1.md`.

---

## Visão geral

Sistema de alarme + push do Dosy é **defense-in-depth com 5 caminhos de scheduling** convergindo num **único mecanismo de fire em Java AlarmManager**. Garante alarme dispara pontual mesmo se app fechado, FCM falhar, ou device em Doze.

### 5 caminhos de scheduling

| # | Caminho | Trigger | Cobertura |
|---|---------|---------|-----------|
| 1 | **JS rescheduleAll** (foreground) | useEffect App.jsx em dosesSignature/patientsSignature change | App aberto + mutations locais |
| 2 | **mutationRegistry → cache patch → C1** | onMutate em confirmDose/skipDose/etc | Latência <100ms pós ação user |
| 3 | **DB trigger AFTER INSERT → Edge dose-trigger-handler** | INSERT em medcontrol.doses | Real-time <2s pós dose criada (qualquer origem) |
| 4 | **Edge daily-alarm-sync (cron 5am BRT)** | pg_cron `0 8 * * *` | Diário 48h batch (todos users) |
| 5 | **Java DoseSyncWorker (WorkManager 6h)** | WorkManager periodic | App fechado + FCM dormido + bucket restricted |

### Mecanismos de fire (consolidados v0.2.3.1 Plano A)

| ID | Mecanismo | Quando |
|----|-----------|--------|
| M1 | **Java AlarmReceiver** → AlarmService (fullscreen + MediaPlayer loop) | Branch ALARM_PLUS_PUSH (default) |
| M2 | **Java TrayNotificationReceiver** (tray notif normal/DnD) | Branch PUSH_CRITICAL_OFF, PUSH_DND, ou backup ALARM_PLUS_PUSH |
| M3 | Capacitor LocalNotifications | **APENAS daily summary (repeat=day)** |

**Antes v0.2.3.1:** foreground path usava M3 Capacitor + FCM path usava M2 Java. Coexistência causava duplicate tray (RC-1).

**Pós v0.2.3.1:** todos os 5 caminhos terminam em M2 Java via `CriticalAlarm.scheduleTrayGroup`. IDs convergem em PendingIntent única AlarmManager = idempotente cross-source.

---

## Decisão de branch (alarm vs tray vs DnD-tray)

Decidida 2× — uma no agendamento, outra no fire time (Fix B v0.2.3.1):

### No agendamento (`unifiedScheduler.decideBranch`)

```javascript
if (!prefs.criticalAlarm) → PUSH_CRITICAL_OFF (tray dosy_tray)
else if (inDnd(scheduledAt, prefs)) → PUSH_DND (tray dosy_tray_dnd silencioso)
else → ALARM_PLUS_PUSH (alarme M1 + tray M2 backup)
```

### No fire time (`AlarmReceiver.onReceive` consulta SharedPrefs)

Se ALARM_PLUS_PUSH foi agendado mas user mudou prefs ENTRE agendamento e fire:
- prefs.criticalAlarm=false → re-rota pra `TrayNotificationReceiver` direto (sem AlarmService)
- prefs.dndEnabled + inDnd → re-rota pra tray canal `dosy_tray_dnd`

Elimina necessidade de cancelar+reagendar quando prefs mudam (RC-2).

---

## IDs e namespace

| Tipo | Range | Cálculo |
|------|-------|---------|
| `groupId` (alarmId) | `[0, 2^30-1]` | `doseIdToNumber(sortedDoseIds.join('|'))` |
| `trayId` (ALARM_PLUS_PUSH backup) | `groupId + 2^30` | `groupId + BACKUP_OFFSET` |
| `trayId` (PUSH_DND, PUSH_CRITICAL_OFF) | `groupId` | direto |
| `FG_NOTIF_ID` (AlarmService FG) | `300_000_000` | hardcoded |
| `FS_NOTIF_OFFSET` (AlarmReceiver fallback) | `+200_000_000` | hardcoded |
| `TAP_NOTIF_OFFSET` (AlarmService tap PI) | `+200_000_000` | hardcoded (mesma constante, namespace requestCode) |
| `DAILY_SUMMARY_NOTIF_ID` | `999_000_001` | constante |

Paridade JS↔Java garantida via `doseIdToNumber` (JS) ≡ `idFromString` (Java), ambos `Math.abs(h) % (2^30-1)`.

---

## Cancelamento

### 3 caminhos de cancel

| Trigger | Mecanismo |
|---------|-----------|
| `confirmDose/skipDose` (status pending→non-pending) | Trigger DB AFTER UPDATE FOR EACH STATEMENT → Edge `dose-trigger-handler` BATCH_UPDATE → FCM cancel_alarms (CSV) → DosyMessagingService cancela individual + group hash |
| `deleteDose` ou `pauseTreatment/endTreatment` (delete batch) | Trigger DB AFTER DELETE/UPDATE batch → Edge BATCH_DELETE/BATCH_UPDATE → FCM cancel_alarms (CSV) |
| JS rescheduleAll `cancelAll` | `CriticalAlarm.cancelAll` + `CriticalAlarm.cancelAllTrays` + Capacitor LocalNotifications cleanup |

### Cancel multi-dose groups (Fix C v0.2.3.1)

DosyMessagingService.handleCancelAlarms recebe CSV. Cancela:
1. Cada `hash(doseId)` individualmente (single-dose groups, hash bate)
2. **Reconstrói `hash(sortedDoseIds.join('|'))` e cancela group alarm**

Antes: multi-dose groups não cancelavam (hash mismatch single vs joined).

---

## Stores de prefs (consolidados v0.2.3.1 A-05)

| Store | Quem escreve | Quem lê |
|-------|--------------|---------|
| `localStorage['medcontrol_notif']` | `useUserPrefs.writeLocal` + `useAuth` listener (DB→cache) | `scheduler.js loadPrefs()` |
| `medcontrol.user_prefs.prefs` (jsonb) | `useUserPrefs.upsert` | Edge `getUserNotifPrefs` + `DoseSyncWorker.fetchUserPrefs` |
| `SharedPreferences dosy_user_prefs` | `CriticalAlarmPlugin.syncUserPrefs` | `AlarmScheduler.scheduleDoseAlarm` (prefsOverride fallback) + `AlarmReceiver` (Fix B re-rota fire time) + `DoseSyncWorker` (skip OFF) |

**Antes:** `dosy_sync_credentials.critical_alarm_enabled` legacy também escrito por `setCriticalAlarmEnabled`. Risco dessync. **Pós v0.2.3.1:** Apenas `dosy_user_prefs`. `dosy_sync_credentials` guarda só auth (refresh_token, anon_key, access_token, schema, user_id, device_id).

---

## Persistência reboot (BootReceiver expandido v0.2.3.1 Plano A)

`BootReceiver.onReceive` lê 2 SharedPreferences e re-agenda:

1. `dosy_critical_alarms` → AlarmReceiver PendingIntents (alarmes nativos)
2. `dosy_tray_scheduled` (novo v0.2.3.1) → TrayNotificationReceiver PendingIntents

Snooze persistido via `AlarmScheduler.persistSnoozedAlarm` (Fix A-03). Reboot dentro de 10min mantém triggerAt snoozed correto.

---

## Cenários end-to-end (fluxos completos)

### Cenário 1 — Criar dose no app

1. User confirma TreatmentForm → mutationRegistry.createTreatment.onMutate (cache patch otimista + temp IDs)
2. RPC `create_treatment_with_doses` retorna UUIDs reais → onSuccess invalidate
3. App.jsx useEffect detecta dosesSignature → scheduleDoses (throttle 30s)
4. rescheduleAll → cancelAll (3 fontes) + para cada group → buildSchedulePayload
   - ALARM_PLUS_PUSH → `CriticalAlarm.scheduleGroup` (M1) + `CriticalAlarm.scheduleTrayGroup` (M2)
5. EM PARALELO: trigger DB INSERT → Edge dose-trigger-handler → FCM schedule_alarms
6. DosyMessagingService.handleScheduleAlarms → AlarmScheduler.scheduleDoseAlarm (M1+M2)
7. **Idempotente:** mesmo groupId → mesma PendingIntent AlarmManager → replace ✓

### Cenário 2 — User marca dose Ciente em alarme tocando

1. AlarmActivity → handleAction("acknowledge") → AlarmService.stopActiveAlarm
2. openAppWithDoseIds → Intent MainActivity (openDoseIds=csv)
3. MainActivity.postJsEvent('dosy:openDoses', ids) — 3 retries
4. App.jsx listener → navigate(/?doses=...)
5. Dashboard mounts → MultiDoseModal abre
6. User clica "Tomada" → confirmMut → onMutate patch cache → scheduleDoses
7. RPC server → DB UPDATE status='done' → trigger statement-level batch → Edge BATCH_UPDATE
8. FCM cancel_alarms (CSV) → DosyMessagingService cancela individual + group hash

### Cenário 3 — Pausar tratamento 90 dias

1. PauseTreatment → mutationRegistry.pauseTreatment.onMutate (cache cleanup) → scheduleDoses
2. RPC server: UPDATE treatments status='paused' + cancelFutureDoses UPDATE doses status='cancelled' (batch ~360 rows)
3. Trigger statement-level batch dispara 1× → Edge BATCH_UPDATE com 360 doseIds
4. Edge envia 1 FCM por device com CSV completo
5. DosyMessagingService cancela individuais + reconstrói hashes grupo

**Antes v0.2.3.1:** 360 DELETE + 360 trigger fires + 360 FCMs (rate limit drop).

### Cenário 4 — App fechado, dose criada outro device

1. Web admin INSERT dose → trigger AFTER INSERT FOR EACH ROW (mantido)
2. Edge dose-trigger-handler → FCM schedule_alarms com prefs (server-authoritative)
3. DosyMessagingService.onMessageReceived → handleScheduleAlarms(doses, prefsOverride)
4. AlarmScheduler.scheduleDoseAlarm decide branch via prefsOverride payload
5. Branch ALARM_PLUS_PUSH → AlarmReceiver + TrayNotificationReceiver agendados
6. Fire time: AlarmReceiver consulta SharedPrefs (Fix B), re-rota se prefs mudaram
7. AlarmReceiver onReceive cancela tray PendingIntent pendente (Fix B-01) + startForegroundService

### Cenário 5 — Snooze 10min + device reboot 5min depois

1. AlarmActivity → handleAction("snooze") → scheduleSnooze(10)
2. am.setAlarmClock(snoozeAt) + `AlarmScheduler.persistSnoozedAlarm` (Fix A-03)
3. Device reboot
4. BootReceiver.onReceive → lê dosy_critical_alarms → vê triggerAt=snoozeAt → re-agenda corretamente
5. Aos snoozeAt: AlarmReceiver fires ✓

### Cenário 6 — Toggle Critical Alarm OFF

1. Settings Toggle → useUserPrefs.mutateAsync (writeLocal + DB + syncUserPrefs Java)
2. Settings.updateNotif chama scheduleDoses → rescheduleAll
3. cancelAll (Critical alarms + Trays Java + Capacitor) → re-agenda PUSH_CRITICAL_OFF (só tray M2)
4. Doses já agendadas via FCM/Worker antes do toggle: AlarmReceiver consulta prefs fire time (Fix B) → re-rota pra tray. **Sem necessidade cancelar+reagendar.**

### Cenário 7 — Logout

1. signOut() → DELETE push_subscription ANTES de auth.signOut (b4e879f+663cdef)
2. clearSyncCredentials Java + clear localStorage
3. supabase.auth.signOut → fires SIGNED_OUT
4. Listener: explicitLogout=1 → cleanup definitivo

---

## Arquivos críticos do fluxo

### JS (src/services/notifications/)
- `prefs.js` — DEFAULT_PREFS, BACKUP_OFFSET, doseIdToNumber, inDnd, filterUpcoming
- `unifiedScheduler.js` — decideBranch, computeHorizon, buildSchedulePayload
- `scheduler.js` — `rescheduleAll` (throttle 30s, signature guard)
- `channels.js` — ensureChannel, cancelAll
- `fcm.js` — subscribeFcm, unsubscribeFcm, bindFcmListenersOnce
- `auditLog.js` — logAuditEventsBatch
- `index.js` — useNotifications hook

### JS hooks
- `useAuth.jsx` — onAuthStateChange (SIGNED_IN/OUT/TOKEN_REFRESHED), syncUserPrefs DB→localStorage
- `useUserPrefs.js` — query + mutation (DB + localStorage + Java SharedPrefs via syncUserPrefs)
- `useDoses.js`, `useTreatments.js` — TanStack queries

### Java (android/.../plugins/criticalalarm/)
- `AlarmScheduler.java` — scheduleDoseAlarm, scheduleDose, scheduleTrayGroup, cancel*, persist*
- `CriticalAlarmPlugin.java` — @CapacitorPlugin com @PluginMethod scheduleGroup, scheduleTrayGroup, cancelTrayGroup, cancelAllTrays, etc
- `AlarmReceiver.java` — onReceive fires AlarmService + Fix B re-rota + Fix B-01 cancel tray
- `AlarmService.java` — FG service + MediaPlayer loop + Vibration
- `AlarmActivity.java` — UI fullscreen
- `AlarmActionReceiver.java` — handle Ciente/Adiar/Ignorar
- `TrayNotificationReceiver.java` — tray notification fire
- `BootReceiver.java` — re-agenda alarmes + trays pós reboot
- `DoseSyncWorker.java` — WorkManager periodic 6h
- `DosyMessagingService.java` — FCM intercept handleSchedule/handleCancel
- `AlarmAuditLogger.java` — audit log async

### Edge (supabase/functions/)
- `dose-trigger-handler` — INSERT/UPDATE/DELETE + BATCH_UPDATE/BATCH_DELETE
- `daily-alarm-sync` — cron 5am BRT batch FCM 48h horizon
- `_shared/userPrefs.ts` — getUserNotifPrefs + inDndWindow
- `_shared/auditLog.ts` — getEnabledAuditUsers + logAuditBatch

### SQL triggers
- `dose_change_notify_insert` AFTER INSERT FOR EACH ROW → notify_dose_change
- `dose_change_notify_update_batch` AFTER UPDATE FOR EACH STATEMENT → notify_doses_batch_change
- `dose_change_notify_delete_batch` AFTER DELETE FOR EACH STATEMENT → notify_doses_batch_change

### Crons ativos
- `daily-alarm-sync-5am` (8am UTC = 5am BRT) → Edge daily-alarm-sync
- `cleanup-stale-push-subs-daily` (5am UTC) → cleanup push_subscriptions órfãs
- `alarm-audit-cleanup-daily` (3:15am UTC) → cleanup alarm_audit_log >7d

---

## Validação device (smoke tests pós-refactor)

| Cenário | Esperado |
|---------|----------|
| 1. Criar dose, aguardar alarme, marcar Ciente | 1 notif fullscreen + modal abre |
| 2. Toggle Critical Alarm OFF antes de alarme tocar | tray (não fullscreen) |
| 3. Toggle DnD ON, dose dentro janela | tray silencioso vibração leve |
| 4. Pausar tratamento contínuo 90d | 1 FCM cancel + todos alarmes cancelados |
| 5. Snooze 10min + reboot device 5min depois | alarme dispara em horário snoozed |
| 6. App fechado, dose criada outro device | 1 notif (alarme OU tray, conforme branch) |
| 7. Logout + verificar FCM não chega mais | confirmado |
| 8. Multi-dose group (3 doses mesmo minuto) | 1 alarme com 3 doses listadas, marcar uma cancela só essa |

Sem reschedule storms em logcat. alarm_audit_log sem cascading inserts.
