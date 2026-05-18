# Auditoria FINAL + Plano REFACTOR — Sistema Alarme + Push

**Data:** 2026-05-13 (quarta passada — releitura completa todos arquivos do fluxo)
**Versão alvo do refactor:** v0.2.3.1 (próxima patch)
**Branch sugerida:** `refactor/alarme-push-v0.2.3.1`

Este documento substitui as 3 auditorias anteriores. Contém:
1. **Mapa completo de fluxos** (criar dose, tocar alarme, snooze, marcar, toggle pref, logout)
2. **Todos achados consolidados** (RC-1..4 + A-01..05 + novos B-01..03)
3. **Plano REFACTOR detalhado** em 7 blocos ordenados por win-to-risk

---

## PARTE I — FLUXOS END-TO-END

### Fluxo 1 — Usuário cria tratamento com 4 doses/dia × 7 dias = 28 doses

```
1. TreatmentForm submit → useCreateTreatment.mutate(payload)
2. mutationRegistry.createTreatment.onMutate
   - Gera doses optimistic via generateDoses() — IDs temp- prefix, _optimistic:true
   - Insere no cache ['treatments'] (1 treatment temp) + ['doses'] (28 doses temp)
3. App.jsx useEffect detecta dosesSignature mudou → scheduleDoses
   - rescheduleAll throttle 30s
   - cancelAll: cancela alarmes anteriores
   - filterUpcoming: **SKIP _optimistic + temp- prefix** → 0 doses passam o filtro
   - rescheduleAll termina sem agendar nada
4. createTreatmentWithDoses RPC retorna { treatment, doses } com UUIDs reais
5. mutationRegistry.onSuccess
   - Substitui treatment temp pelo real
   - Remove doses temp do cache
   - qc.invalidateQueries(['doses', 'treatments', 'user_medications'])
6. useDoses refetch → listDoses(supabase) → retorna 28 doses reais
7. dosesSignature muda (UUIDs reais agora) → App.jsx useEffect → scheduleDoses
   - rescheduleAll throttle ainda ativo (30s desde último) → schedule trailing
   - 30s depois: cancelAll + reschedule com IDs reais
   - filterUpcoming: passa só doses na janela 48h ≈ 8 doses
   - buildSchedulePayload por minute group → ~8 groups single-dose
   - Para cada group: alarmPayload + trayNotifPayload + metadata
   - Branch decisão: alarm_plus_push (default)
   - scheduleCriticalAlarmGroup → Java CriticalAlarmPlugin.scheduleGroup → AlarmScheduler.scheduleDose (ALARME APENAS, NÃO chama scheduleDoseAlarm que faria branch + tray)
   - LocalNotifications.schedule({ notifications: [...trayNotifPayload×8] }) → Capacitor LocalNotificationReceiver agendado pra cada
   - saveScheduledState (localStorage)
   - logAuditEventsBatch ao alarm_audit_log
8. EM PARALELO: trigger DB notify_dose_change fires AFTER INSERT por linha × 28
   - Função filtra: only INSERT pending future → all 28 passam
   - pg_net.http_post → Edge dose-trigger-handler (28× concorrentes)
   - Cada Edge call: busca push_subscriptions do user + caregivers → FCM data
   - **28 FCMs schedule_alarms para o device** (1 dose cada, sem agrupar)
9. DosyMessagingService.onMessageReceived × 28
   - Cada chamada: handleScheduleAlarms(doses=[1 dose])
   - AlarmScheduler.scheduleDoseAlarm(ctx, alarmId, ...) — agenda ALARME + TRAY JAVA
   - Para cada uma das 8 doses na janela 48h, dois mecanismos agora coexistem:
     * Capacitor LocalNotificationReceiver (PendingIntent A) ← foreground path
     * Java TrayNotificationReceiver (PendingIntent B) ← FCM path
   - **MESMO ID requestCode (groupId + BACKUP_OFFSET) mas Components DIFERENTES → AlarmManager guarda DUAS PendingIntents pendentes**
```

**Bug observado:** ao chegar a hora da dose, AlarmReceiver (alarme fullscreen) dispara, mas BOTH PendingIntents tray também disparam. AlarmReceiver linha 87 chama `NotificationManagerCompat.cancel(alarmId + BACKUP_OFFSET)` que **só cancela notificação JÁ VISÍVEL**. Os 2 PendingIntents tray pendentes no AlarmManager continuam e ambos fires.

### Fluxo 2 — Usuário marca dose como Ciente em xx:00 (alarme tocando)

```
1. Notificação fullscreen Dosy abre via AlarmActivity
2. User clica "Ciente"
3. AlarmActivity.handleAction("acknowledge")
   - AlarmService.stopActiveAlarm → para MediaPlayer + vibration + FG notif
   - openAppWithDoseIds() → Intent(MainActivity, extras: openDoseIds=csv)
4. MainActivity.onNewIntent (singleTask) → handleAlarmAction
   - postJsEvent('dosy:openDoses', doseIds) — 3 retries (300ms, 1500ms, 3500ms)
5. App.jsx useEffect listener pega CustomEvent → navigate(`/?doses=${ids}`)
6. Dashboard mounted → useEffect filtra searchParams → setMultiDoseIds([...])
7. MultiDoseModal abre listando as doses
8. User clica "Tomada" em cada dose
   - confirmMut.mutate({ id, actualTime, observation: '' })
9. mutationRegistry.confirmDose
   - onMutate: cache patch status='done', actualTime=now
   - dosesSignature flippa → App.jsx useEffect → scheduleDoses
     * rescheduleAll throttle 30s (provável já ativo desde alarme tocou)
     * filterUpcoming filtra fora doses 'done' → menos doses agendadas
     * cancelAll + reschedule
   - confirmDose RPC server-side → DB UPDATE status='done'
10. EM PARALELO: trigger notify_dose_change fires UPDATE
    - notify_dose_change filtra: OLD.status='pending' AND NEW.status!='pending' → fire
    - Edge dose-trigger-handler recebe UPDATE
    - Detecta pending→non-pending → action=cancel_alarms
    - FCM cancel_alarms enviado pra device com doseId (1)
11. DosyMessagingService.handleCancelAlarms
    - idFromString(doseId) → alarmId (singular dose, hash bate)
    - AlarmScheduler.cancelDoseAlarmAndBackup(alarmId)
      * cancelAlarm: AlarmReceiver PendingIntent cancel ✅
      * NotificationManagerCompat.cancel(alarmId + BACKUP_OFFSET) ✅
      * AlarmManager.cancel(TrayNotificationReceiver PendingIntent) ✅
    - Mas NÃO cancela Capacitor LocalNotifications.cancel({id: groupId + BACKUP_OFFSET}) ❌
    - **Capacitor LocalNotificationReceiver continua pendente pro mesmo timestamp**
12. mutationRegistry.confirmDose.onSettled → refetchDoses debounce 2s
13. useDoses refetch → 8 doses reais (1 'done', 7 'pending') → dosesSignature
14. App.jsx useEffect → scheduleDoses trailing 30s → cancelAll (cancela tudo Capacitor) + reschedule corretamente
```

**Bug latente:** janela entre passo 11 e passo 14 (~30s) há Capacitor LocalNotification pending agendada pro mesmo horário da dose já marcada done. Se passar pra próximo dia sem rescheduleAll completar, notif visualmente "fantasma" pode aparecer.

### Fluxo 3 — Usuário pausa tratamento com 80 doses futuras pendentes

```
1. PauseTreatment button → usePauseTreatment.mutate(treatmentId)
2. mutationRegistry.pauseTreatment.onMutate
   - Patch treatments local: status='paused'
   - Remove doses futuras pending do cache local
   - dosesSignature flippa → scheduleDoses → cancelAll + reschedule (menos doses)
3. pauseTreatment service:
   - supabase.from('treatments').update({status:'paused'})
   - **cancelFutureDoses: supabase.from('doses').delete()** — N=80 doses deletadas
4. Trigger notify_dose_change fires FOR EACH ROW × 80
   - Função filtra DELETE com OLD.status='pending' → fire
   - pg_net.http_post × 80 concorrentes → Edge dose-trigger-handler
5. Edge dose-trigger-handler × 80
   - Cada chamada: DELETE branch → action=cancel_alarms (1 doseId)
   - getRecipientUserIds(patientId, ownerId) — 80× same query
   - sendFcmTo(deviceToken, {action:'cancel_alarms', doseIds:doseId}) × 80
6. Device recebe 80 FCMs em rajada
   - FCM rate limit ~1 msg/sec/device pode descartar alguns
   - Para cada que chega: DosyMessagingService.handleCancelAlarms
   - hash(singleDoseId) match único pra doses single-group. Multi-dose groups MISS.
   - cancelDoseAlarmAndBackup cancela AlarmReceiver + Java tray. Capacitor M3 NÃO cancela.
7. EM PARALELO: foreground rescheduleAll já cancelou TUDO Capacitor M3 no passo 2.
```

**Bug observado:** spam Edge function 80×. Egress overhead + FCM rate limit drops. Multi-dose groups têm cancel falho.

### Fluxo 4 — Usuário muda DnD ON em Settings

```
1. Settings NotificationsSection Toggle DnD onChange(true) → updateNotif({dndEnabled:true})
2. updateNotif → updatePrefsMut.mutateAsync
3. mutationFn:
   - writeLocal({...current, dndEnabled:true}) — localStorage atualizado
   - qc.setQueryData(['user_prefs'], merged) — TanStack cache atualizado
   - supabase.from('user_prefs').upsert({...}) — DB write
   - setCriticalAlarmEnabled(true) — escreve dosy_user_prefs.critical_alarm_enabled E dosy_sync_credentials.critical_alarm_enabled (NÃO PRECISA — apenas dndEnabled mudou!)
   - syncUserPrefs({...full prefs}) — escreve dosy_user_prefs.dnd_enabled + dnd_start + dnd_end
4. Settings.updateNotif chama scheduleDoses(upcomingDoses) → rescheduleAll
   - loadPrefs() lê localStorage (atualizado) → dndEnabled:true
   - buildSchedulePayload: cada dose dentro da janela DnD → branch=push_dnd
   - alarmPayload=null, trayNotifPayload com channelId='dosy_tray_dnd'
   - LocalNotifications.schedule(M3) — silenciosa
   - CriticalAlarmGroup NÃO agendado pra essas doses
5. PROBLEMA: doses já agendadas via FCM path (Java M1+M2 antes do toggle) PERMANECEM agendadas com prefs OLD (criticalAlarm:true, dndEnabled:false)
   - Java AlarmReceiver não consulta prefs no fire time
   - Vai disparar alarme fullscreen mesmo em janela DnD
```

**Bug arquitetural:** Java fire time ignora prefs atualizadas (RC-2).

### Fluxo 5 — App fechado, dose criada em outro device

```
1. Web admin cria dose → DB INSERT
2. Trigger notify_dose_change → Edge dose-trigger-handler
3. Edge: INSERT pending future detected → action=schedule_alarms
4. getRecipientUserIds + push_subscriptions lookup
5. Edge envia FCM data message com:
   - action: 'schedule_alarms'
   - doses: JSON.stringify([{doseId, medName, ...}])
   - prefs: JSON.stringify({criticalAlarm, dndEnabled, dndStart, dndEnd}) (server-authoritative)
6. Device dormindo recebe FCM (high priority)
7. Android Firebase service → DosyMessagingService.onMessageReceived
8. handleScheduleAlarms(dosesJson, prefsOverride)
9. AlarmScheduler.scheduleDoseAlarm:
   - prefsOverride from payload (autoritative)
   - Calcula branch: alarm_plus_push / push_dnd / push_critical_off
   - Agenda alarme nativo (AlarmReceiver) + Java tray (TrayNotificationReceiver)
10. Quando dose hora chegar:
    - AlarmReceiver onReceive: tenta startForegroundService(AlarmService)
    - AlarmService.startMediaPlayerLoop + startVibrationLoop + setFullScreenIntent
    - User vê AlarmActivity fullscreen com som
11. EM PARALELO Java TrayNotificationReceiver onReceive (mesmo timestamp)
    - nm.notify(notifId, ...) → POSTA tray notification
12. AlarmReceiver linha 87: `NotificationManagerCompat.cancel(alarmId + BACKUP_OFFSET)` —
    - Cancela tray notif visível IF já postada por TrayNotificationReceiver
    - Mas se TrayNotificationReceiver ainda não rodou (race), cancel é no-op + tray posta DEPOIS = duplicate

**Resultado:** AlarmActivity + (talvez) tray notif separada visível.
```

### Fluxo 6 — User clica "Adiar 10min" no alarme

```
1. AlarmActivity.handleAction("snooze")
2. AlarmService.stopActiveAlarm — para som + FG notif
3. scheduleSnooze(10)
   - snoozeAt = now + 10 * 60 * 1000
   - Re-monta Intent(AlarmReceiver) com mesmo alarmId + dosesJson
   - PendingIntent fire + show
   - am.setAlarmClock(snoozeAt, ...)
   - **NÃO chama AlarmScheduler.persistAlarm** — SharedPreferences mantém triggerAt antigo
4. AlarmActivity.finish()
5. 10 min depois: AlarmReceiver fires no horário snoozed ✅
```

**Bug latente:** se device reiniciar dentro dos 10 min, BootReceiver lê SharedPreferences vê triggerAt original → re-agenda no horário antigo. Snooze perde efeito.

### Fluxo 7 — User clica "Sair" em Settings

```
1. signOut() em useAuth.jsx
2. localStorage.setItem('dosy_explicit_logout', '1')
3. logAuthEvent('sign_out', ...) com timeout 2s
4. DELETE push_subscriptions WHERE deviceToken=cachedToken
5. localStorage.removeItem('dosy_fcm_token')
6. clearSyncCredentials() — limpa Java SharedPreferences
7. supabase.auth.signOut() → fires SIGNED_OUT listener
8. onAuthStateChange SIGNED_OUT
   - dosy_explicit_logout='1' → NÃO spurious → continua
   - setUser(null)
   - qc.clear()
   - Bloco SIGNED_OUT cleanup: tenta DELETE push_sub novamente — mas cachedToken já removido → no-op ✅
   - clearSyncCredentials de novo (idempotente)
   - removeItem 'dosy_explicit_logout'
9. localStorage.removeItem('medcontrol_notif') + 'dashCollapsed'
```

**OK ✅** — fluxo correto pós fix b4e879f + 663cdef.

---

## PARTE II — TODOS ACHADOS CONSOLIDADOS

### Root Causes Arquiteturais (RC-1 a RC-4)

| ID | Severidade | Descrição | Status |
|----|-----------|-----------|--------|
| RC-1 | 🔴 P0 | Dois mecanismos de tray (M2 Java TrayNotificationReceiver + M3 Capacitor LocalNotifications) podem coexistir agendados para o mesmo timestamp. PendingIntent IDs iguais mas Components diferentes = NÃO idempotentes cross-source. | Não resolvido (Plano A) |
| RC-2 | 🔴 P0 | Prefs em 3 stores (localStorage, DB, SharedPrefs Android). Branch decidido no agendamento. Toggle pós-agendamento não re-rota alarmes em AlarmManager. | Não resolvido (Fix B) |
| RC-3 | 🔴 P0 | Hash de cancelamento usa doseId individual; hash de scheduling usa sortedDoseIds.join('|'). Multi-dose groups não cancelam via FCM cancel_alarms. | Não resolvido (Fix C) |
| RC-4 | 🟡 P1 | 5 caminhos scheduling sem coordenação cross-source. Idempotência alarme funciona (M1 mesmo ID), tray quebra (M2≠M3). | Não resolvido (Plano A) |

### Achados da Releitura (A-01 a A-05)

| ID | Severidade | Arquivo:Linha | Descrição |
|----|-----------|---------------|-----------|
| A-01 | 🟡 P1 | dosesService.js:79-83 | `recomputeOverdue` em listDoses retorna doses com status mutado pra 'overdue' quando passa horário. dosesSignature flippa → reschedule storm sempre que doses passam horário. |
| A-02 | 🔴 P0 | treatmentsService.js:92-112 | `cancelFutureDoses` faz DELETE batch. Trigger fires FOR EACH ROW. N doses = N FCMs spam Edge. Multi-dose cancel hash miss. |
| A-03 | 🟡 P1 | AlarmActionReceiver.java:70 + AlarmActivity.java:729 | `scheduleSnooze` não chama `persistAlarm`. Reboot em <10min → BootReceiver re-agenda horário original. |
| A-04 | 🟢 P2 | App.jsx:137 + Dashboard.jsx:102 | App.jsx janela -1d/+14d, Dashboard janela -30d/+60d. 2 queries TanStack diferentes, mesma data overlapping. Egress duplicado. |
| A-05 | 🟢 P2 | useUserPrefs.js:70-82 | `setCriticalAlarmEnabled` + `syncUserPrefs` chamados paralelos a cada refetch. 2× IPC SharedPreferences pro mesmo dado. |

### Achados Novos da 4ª Passada (B-01 a B-03)

| ID | Severidade | Arquivo:Linha | Descrição |
|----|-----------|---------------|-----------|
| B-01 | 🔴 P0 | AlarmReceiver.java:86-88 | Cancel tray backup usa `NotificationManagerCompat.cancel(id)` apenas. Esse método cancela notificação **VISÍVEL**, mas NÃO cancela `PendingIntent` pendente em AlarmManager. Se TrayNotificationReceiver dispara DEPOIS de AlarmReceiver (race no mesmo timestamp), tray notif ainda aparece. Fix: também cancelar `AlarmManager.cancel(trayPendingIntent)`. |
| B-02 | 🟡 P1 | DailySummaryModal.jsx:23-32 | 2 queries `useDoses` separadas com `status:'pending'` e `status:'overdue'` em janelas diferentes. Status filter é client-side (dosesService.js:84), então cada query baixa janela inteira do DB. Egress double-fetch sem benefício. Fix: 1 query única com from=past30, to=in24h e filter client-side por status. |
| B-03 | 🟢 P3 | AndroidManifest.xml:59 | `android:showOnLockScreen="true"` é **atributo inválido Android** (não existe na spec). Foi renomeado pra `showWhenLocked` pré-Android O. Atributo aparece duplicado linha 61 correto. Linha 59 ignorada por Android. Cosmético. |

### Itens de Código Morto (consolidados das auditorias anteriores)

| Camada | Item | Ação |
|--------|------|------|
| Edge | `notify-doses` (deployed stub 410) | `supabase functions delete notify-doses` |
| Edge | `schedule-alarms-fcm` (deployed stub 410) | `supabase functions delete schedule-alarms-fcm` |
| DB | Tabela `dose_notifications` (150 rows órfãs) | Migration DROP em v0.2.3.1 |
| DB | Migration `20260507230000_notify_doses_cron_1min.sql` | Adicionar migration unschedule idempotente |
| Java | `CriticalAlarmPlugin.schedule()` single-dose | Deletar (JS export órfão) |
| Java | `CriticalAlarmPlugin.updateAccessToken()` | Deletar (JS export órfão) |
| Java | `AlarmActionReceiver.NOTIF_ID_OFFSET` + `nm.cancel(alarmId + NOTIF_ID_OFFSET)` | Deletar (postPersistentNotification removida) |
| Java | `AlarmReceiver.CHANNEL_ID="doses_critical_v2"` + ensureChannel | Migrar pra `dosy_tray`; canal foi deletado por MainActivity |
| Java | 4 imports não usados em `AlarmScheduler.java` | Limpar |
| Java | Comentários estale em CriticalAlarmPlugin.java:142,280 + DosyMessagingService.java:32,33 | Atualizar |
| JS | `scheduleCriticalAlarm` (single-dose) em criticalAlarm.js:28 | Deletar |
| JS | `updateAccessToken` em criticalAlarm.js:170 | Deletar |
| JS | `isIgnoringBatteryOptimizations` em criticalAlarm.js:117 | Deletar |
| JS | `cancelGroup` em channels.js:115 | Deletar |
| JS | `loadScheduledState` em channels.js:131 | Deletar |
| JS | `logAuditEvent` (singular) em auditLog.js:80 | Deletar (mantém `logAuditEventsBatch`) |
| JS | `_resetAuditCache` em auditLog.js:21 | Deletar |
| JS | Re-exports em `notifications/index.js:35-38` | Deletar (callers usam hook) |
| JS | `CHANNEL_ID = 'doses_v2'` em prefs.js:19 + branch em channels.js | Deletar (canal deletado por MainActivity) |
| JS | EVENTS órfãos: ALARM_FIRED, ALARM_DISMISSED, ALARM_SNOOZED, NOTIFICATION_DISMISSED, DOSE_OVERDUE_DISMISSED | Implementar telemetria OU deletar |
| Docs | `docs/alarm-scheduling-shadows.md` | Arquivar ou reescrever |

---

## PARTE III — PLANO REFACTOR v0.2.3.1

Ordenação por **dependência** (cada bloco preserva ou repara fluxo) + **win-to-risk ratio**.

### Bloco 1 — Cleanup de código morto (zero risco, ~1h)

**Objetivo:** reduzir superfície antes de mexer em fluxo. Cada item testado isoladamente.

**Ações:**
1. **Edge functions deprecated:**
   ```bash
   supabase functions delete notify-doses
   supabase functions delete schedule-alarms-fcm
   rm -rf supabase/functions/notify-doses supabase/functions/schedule-alarms-fcm
   ```
2. **DB cleanup migration** (`20260514000000_drop_orphan_dose_notifications.sql`):
   ```sql
   DROP TABLE IF EXISTS medcontrol.dose_notifications CASCADE;
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-doses-1min') THEN
       PERFORM cron.unschedule('notify-doses-1min');
     END IF;
   END $$;
   ```
3. **JS dead exports** (6 exports + 5 re-exports): edits cirúrgicos
4. **Java dead methods + imports** (2 methods + 4 imports + 5 comentários): edits cirúrgicos
5. **Channel `doses_v2` loop fix**: remover ensureChannel branch em `channels.js`, deixar MainActivity continuar deletando
6. **EVENTS analytics:** remover os 5 órfãos OU adicionar `track(EVENTS.ALARM_FIRED)` em AlarmReceiver via JS bridge (mais útil)

**Validação:** build + cap sync + verificar logs sem warnings. Smoke test alarme básico.

### Bloco 2 — Fix B-01 + A-03 (race fire time + snooze persist) (~30min)

**B-01 fix em AlarmReceiver.java linhas 86-88:**

```java
// Cancela LocalNotification backup ANTES de fire AlarmService.
// IMPORTANTE: NotificationManagerCompat.cancel cobre apenas notif VISÍVEL.
// Para PendingIntent pendente no AlarmManager (TrayNotificationReceiver) precisamos
// AlarmManager.cancel(PendingIntent). Cancel both pra cobrir race no mesmo timestamp.
try {
    NotificationManagerCompat.from(context).cancel(alarmId + BACKUP_OFFSET);
    // Cancela PendingIntent do TrayNotificationReceiver pendente
    Intent trayIntent = new Intent(context, TrayNotificationReceiver.class);
    PendingIntent trayPi = PendingIntent.getBroadcast(
        context, alarmId + BACKUP_OFFSET, trayIntent,
        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
    );
    if (trayPi != null) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(trayPi);
        trayPi.cancel();
    }
} catch (Exception ignored) {}
```

**A-03 fix em AlarmActionReceiver.java:scheduleSnooze + AlarmActivity.java:scheduleSnooze:**

```java
// Adicionar após am.setAlarmClock(...):
// Persistir snooze pra sobreviver reboot. Sem isso, BootReceiver re-agenda horário original.
AlarmScheduler.persistSnoozedAlarm(context, alarmId, snoozeAt, dosesJsonArray);
```

E adicionar método público em AlarmScheduler.java:

```java
public static void persistSnoozedAlarm(Context ctx, int id, long triggerAt, JSONArray doses) {
    persistAlarm(ctx, id, triggerAt, doses);
}
```

**Validação device:**
- Cenário A: alarme + cancel tray race → confirmar 1 notif fullscreen, 0 tray visível.
- Cenário B: snooze 10min + reboot device em 5min → confirmar alarme dispara em horário snoozed (não original).

### Bloco 3 — Plano A: unificar tray em M2 (Java) (~4h)

**Objetivo:** eliminar RC-1 (dual tray race). Foreground path para de usar M3 Capacitor LocalNotifications pra tray de dose. Daily summary continua em M3 (caso especial).

**Mudanças JS:**

`src/services/criticalAlarm.js` — adicionar export:

```javascript
/**
 * #refactor v0.2.3.1 — Plano A: scheduleTrayOnly delega ao Java AlarmScheduler.
 * Substitui LocalNotifications.schedule pra trays de dose (foreground path).
 * Daily summary continua em LocalNotifications (caso especial).
 */
export async function scheduleTrayGroup({ id, at, channelId, doses }) {
  if (!isCriticalAlarmAvailable()) return null
  return CriticalAlarm.scheduleTrayGroup({ id, at, channelId, doses })
}
```

`src/services/notifications/scheduler.js` — refator do `_rescheduleAllImpl`:

```javascript
// Em vez de localNotifs.push(trayNotifPayload) pra cada branch,
// dispatch direto via plugin Java:

if (branch === 'alarm_plus_push') {
  await scheduleCriticalAlarmGroup(alarmPayload)
  await scheduleTrayGroup({
    id: groupId + BACKUP_OFFSET,
    at: trayNotifPayload.schedule.at,
    channelId: 'dosy_tray',
    doses: group
  })
  alarmsScheduled += group.length
}
else if (branch === 'push_dnd') {
  await scheduleTrayGroup({
    id: groupId,
    at: trayNotifPayload.schedule.at,
    channelId: 'dosy_tray_dnd',
    doses: group
  })
  trayScheduled++
  dndCount += group.length
}
else if (branch === 'push_critical_off') {
  await scheduleTrayGroup({
    id: groupId,
    at: trayNotifPayload.schedule.at,
    channelId: 'dosy_tray',
    doses: group
  })
  trayScheduled++
  criticalOffCount += group.length
}

// localNotifs só pra daily summary
if (summaryOn) {
  localNotifs.push({ id: DAILY_SUMMARY_NOTIF_ID, ... })
}
```

**Mudanças Java:**

`CriticalAlarmPlugin.java` — adicionar PluginMethod:

```java
@PluginMethod
public void scheduleTrayGroup(PluginCall call) {
    Integer id = call.getInt("id");
    String at = call.getString("at");
    String channelId = call.getString("channelId", "dosy_tray");
    JSArray dosesArr = call.getArray("doses");
    if (id == null || at == null || dosesArr == null) {
        call.reject("missing required: id, at, doses[]");
        return;
    }
    long triggerAt;
    try {
        triggerAt = java.time.Instant.parse(at).toEpochMilli();
    } catch (Exception e) {
        call.reject("invalid 'at': " + at);
        return;
    }
    JSONArray doses = new JSONArray();
    for (int i = 0; i < dosesArr.length(); i++) {
        try { doses.put(dosesArr.getJSONObject(i)); } catch (Exception ignored) {}
    }
    AlarmScheduler.scheduleTrayGroup(getContext(), id, triggerAt, doses, channelId);
    JSObject ret = new JSObject();
    ret.put("scheduled", true);
    ret.put("id", id);
    call.resolve(ret);
}
```

`AlarmScheduler.java` — expor scheduleTrayNotification publicamente:

```java
public static void scheduleTrayGroup(Context ctx, int notifId, long triggerAtMs, JSONArray doses, String channelId) {
    scheduleTrayNotification(ctx, notifId, triggerAtMs, doses, channelId);
}
```

**Cancellation:** `cancelAll` + `cancelGroup` em JS continuam mesma API. Atualizar implementação:

`src/services/notifications/channels.js`:

```javascript
// Plano A — cancelAll cancela apenas via CriticalAlarm plugin (Java cobre tudo).
// LocalNotifications.cancel mantida só pra daily summary cleanup.
export async function cancelAll() {
  if (!isNative) return
  try { await cancelAllCriticalAlarms() } catch (e) { console.warn(e?.message) }
  // Daily summary cleanup (M3 LocalNotifications)
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch (e) { console.warn(e?.message) }
}
```

`CriticalAlarmPlugin.cancelAll` (Java) já cancela alarme + tray Java (corrige 9574696). OK.

**BootReceiver:** **estender pra re-agendar tray também**, não só alarme nativo. Hoje `BootReceiver.onReceive` lê `SharedPreferences dosy_critical_alarms` que só tem AlarmReceiver entries. Adicionar segundo namespace `dosy_tray_scheduled` que `scheduleTrayNotification` persista (tipo `persistAlarm`).

**Validação device:** todos cenários 1-7 retestados. Especialmente:
- App aberto cria dose → 1 notif tray no horário (não 2)
- FCM chega app fechado → 1 notif tray no horário (não 2)
- Toggle critical OFF → 1 notif tray (não 2)

### Bloco 4 — Fix B: re-rota fire time consultando prefs (~1h)

**Objetivo:** RC-2. Java fire time consulta prefs SharedPrefs antes de mostrar notif. Permite branch dinâmico mesmo pra alarmes agendados com prefs antigas.

**Mudanças:**

`AlarmReceiver.java.onReceive`:

```java
// #refactor v0.2.3.1 Fix B — antes de fire alarme fullscreen, consulta prefs atuais.
// Se prefs criticalAlarm:false OU dndEnabled+inDnd, re-rota pra TrayNotificationReceiver.
SharedPreferences sp = context.getSharedPreferences("dosy_user_prefs", Context.MODE_PRIVATE);
boolean criticalOn = sp.getBoolean("critical_alarm_enabled", true);
boolean dndOn = sp.getBoolean("dnd_enabled", false);
String dndStart = sp.getString("dnd_start", "23:00");
String dndEnd = sp.getString("dnd_end", "07:00");
boolean inDnd = dndOn && AlarmScheduler.isInDndWindowPublic(System.currentTimeMillis(), dndStart, dndEnd);
boolean shouldFireAlarm = criticalOn && !inDnd;

if (!shouldFireAlarm) {
    // Re-rota pra tray notification em vez de alarme fullscreen
    String channelId = inDnd ? AlarmScheduler.TRAY_DND_CHANNEL_ID : AlarmScheduler.TRAY_CHANNEL_ID;
    Intent trayIntent = new Intent(context, TrayNotificationReceiver.class);
    trayIntent.putExtra("notifId", alarmId);
    trayIntent.putExtra("doses", dosesJson);
    trayIntent.putExtra("channelId", channelId);
    context.sendBroadcast(trayIntent);  // dispara imediato
    if (wl.isHeld()) wl.release();
    return;
}
// continua fluxo normal startForegroundService...
```

`AlarmScheduler.java` — expor `isInDndWindowPublic`:

```java
public static boolean isInDndWindowPublic(long epochMs, String dndStart, String dndEnd) {
    return isInDndWindow(epochMs, dndStart, dndEnd);
}
```

**TrayNotificationReceiver.onReceive** já consulta `channelId` do Intent. Pode receber broadcast direto sem AlarmManager. ✅

**Validação:**
- Agendar dose com critical ON, depois toggle OFF antes do fire → confirmar tray em vez de fullscreen
- Agendar dose fora DnD, toggle DnD ON antes do fire dentro janela → confirmar tray DnD silencioso

### Bloco 5 — Fix C + A-02: batch cancel cross-dose (~1h)

**Objetivo:** RC-3 + A-02. Cancel multi-dose groups + reduz spam Edge.

**SQL: novo trigger AFTER UPDATE OR DELETE statement-level que agrega doseIds:**

```sql
-- v0.2.3.1 — batch trigger
CREATE OR REPLACE FUNCTION medcontrol.notify_doses_batch_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  edge_url text := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/dose-trigger-handler';
  payload jsonb;
BEGIN
  -- Agrega doseIds afetados num único POST
  payload := jsonb_build_object(
    'type', 'BATCH_' || TG_OP,
    'table', TG_TABLE_NAME,
    'records', (SELECT jsonb_agg(to_jsonb(t)) FROM ... )
  );
  PERFORM net.http_post(url := edge_url, headers := ..., body := payload);
  RETURN NULL;
END;
$$;

CREATE TRIGGER dose_change_notify_batch
  AFTER UPDATE OR DELETE
  ON medcontrol.doses
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION medcontrol.notify_doses_batch_change();

-- Manter trigger AFTER INSERT FOR EACH ROW (INSERT é raro, alimenta scheduling)
```

**Edge dose-trigger-handler.ts:** adicionar handler `BATCH_UPDATE` e `BATCH_DELETE` que enviam 1 FCM com `doseIds` CSV.

**DosyMessagingService.handleCancelAlarms** — JÁ aceita CSV (split por `,`). Apenas reconstruir hash do grupo a partir do CSV:

```java
private void handleCancelAlarms(String doseIdsCsv) {
    String[] ids = doseIdsCsv.split(",");
    // 1) Cancel cada doseId individualmente (single-dose groups)
    for (String id : ids) {
        int alarmId = AlarmScheduler.idFromString(id.trim());
        AlarmScheduler.cancelDoseAlarmAndBackup(ctx, alarmId);
    }
    // 2) Reconstrói hash do grupo (sortedDoseIds.join('|')) e cancel também
    String[] sorted = ids.clone();
    Arrays.sort(sorted);
    String groupKey = String.join("|", sorted);
    int groupAlarmId = AlarmScheduler.idFromString(groupKey);
    AlarmScheduler.cancelDoseAlarmAndBackup(ctx, groupAlarmId);
}
```

**Mudanças JS service: `cancelFutureDoses` UPDATE em vez de DELETE:**

`src/services/treatmentsService.js:92-112`:

```javascript
async function cancelFutureDoses(treatmentId) {
  if (hasSupabase) {
    const nowIso = new Date().toISOString()
    // UPDATE status='cancelled' em vez de DELETE — preserva histórico + batch trigger
    const { error } = await supabase
      .from('doses')
      .update({ status: 'cancelled' })
      .eq('treatmentId', treatmentId)
      .eq('status', 'pending')
      .gt('scheduledAt', nowIso)
    if (error) throw error
    return
  }
  // mock unchanged
}
```

Trigger statement-level captura todos UPDATEs num único batch → 1 FCM cancel_alarms com CSV.

**Validação:**
- Pausar tratamento 90 dias × 4 doses/dia → 1 FCM cancel_alarms (não 360)
- Verificar todas doses canceladas no device (single + multi-dose groups)

### Bloco 6 — A-05 + A-01 cleanup (~30min)

**A-05:** remover `setCriticalAlarmEnabled` (legacy), consolidar em `syncUserPrefs`:

`src/hooks/useUserPrefs.js:70-82` + linhas 127-129:
```javascript
// Remover linhas:
// setCriticalAlarmEnabled(merged.criticalAlarm !== false).catch(() => {})
// Manter apenas:
syncUserPrefs({
  criticalAlarm: merged.criticalAlarm !== false,
  dndEnabled: !!merged.dndEnabled,
  dndStart: merged.dndStart || '23:00',
  dndEnd: merged.dndEnd || '07:00'
}).catch(() => {})
```

`DoseSyncWorker.java:92` migrar lê de `dosy_user_prefs` em vez de legacy:
```java
SharedPreferences spPrefs = ctx.getSharedPreferences("dosy_user_prefs", Context.MODE_PRIVATE);
boolean criticalAlarmEnabled = spPrefs.getBoolean("critical_alarm_enabled", true);
```

Remover write redundante em `CriticalAlarmPlugin.setSyncCredentials:188` e `setCriticalAlarmEnabled:243` (já escrevia em DOIS namespaces).

**A-01:** documentar em comentário do dosesService.js que recomputeOverdue é fonte intencional de status mutation. **Adicionar bypass em filterUpcoming**: doses com `status='pending' && scheduledAt < now+10s` continuam scheduling (race overdue/pending). Hoje filtra `status !== 'pending'` → exclui. Mantém comportamento atual mas adiciona log debug.

### Bloco 7 — A-04 + B-02 + Docs (~30min)

**A-04:** consolidar useDoses janelas em App.jsx + Dashboard:

`src/App.jsx:137`:
```javascript
const alarmWindow = useMemo(() => {
  const now = new Date(hourTick * 3600_000)
  const past = new Date(now); past.setDate(past.getDate() - 30)  // ampliado
  const future = new Date(now); future.setDate(future.getDate() + 60)  // ampliado
  return { from: past.toISOString(), to: future.toISOString() }
}, [hourTick])
```

`src/pages/Dashboard.jsx:102` — usar mesma janela:
```javascript
const baseWindow = useMemo(() => ({
  from: alarmWindow.from,
  to: alarmWindow.to,
  patientId: filters.patientId
}), [alarmWindow, filters.patientId])
```

Compartilha cache TanStack (queryKey eq se filter.patientId null).

**B-02:** DailySummaryModal usa 1 query:

```javascript
const { data: doses = [] } = useDoses({
  from: past30.toISOString(),
  to: in24h.toISOString()
})
const pending = doses.filter(d => d.status === 'pending' && new Date(d.scheduledAt) >= now)
const overdue = doses.filter(d => d.status === 'overdue')
```

**Docs:** arquivar `docs/alarm-scheduling-shadows.md` e substituir por novo `docs/alarm-scheduling-v0.2.3.1.md` com fluxos atualizados.

---

## PARTE IV — Estimativa + Ordem

| Bloco | Esforço | Risco | Resolve |
|-------|---------|-------|---------|
| 1 | ~1h | Zero | Código morto (15+ itens) |
| 2 | ~30min | Baixo | B-01 + A-03 |
| 3 | ~4h | Médio | RC-1 + RC-4 (Plano A) |
| 4 | ~1h | Baixo | RC-2 (Fix B) |
| 5 | ~1h | Médio | RC-3 + A-02 (Fix C) |
| 6 | ~30min | Baixo | A-05 + A-01 |
| 7 | ~30min | Zero | A-04 + B-02 + docs |

**Total:** ~8.5h dedicadas + 1 build + 1 cap sync + 1 ciclo validação device (~2h).

**Ordem sugerida:** 1 → 2 → 3 → 4 → 5 → 6 → 7. Cada bloco testado isoladamente antes do próximo.

**Quick win imediato sem refactor:** Bloco 1 + Bloco 2. ~1.5h. Resolve duplicate push observado em 22:13/22:20 device-validation + bug snooze persist + reduz superfície sem mudança arquitetural.

**Refactor completo:** Blocos 1-7. ~10.5h total. Sistema fica estável + manutenível para próximas releases.

---

## PARTE V — Validação Pós-Refactor

Cenários a re-testar device S25 Ultra:

1. **Criar dose, aguardar alarme, marcar Ciente** → 1 notif fullscreen + modal abre com dose ✅
2. **Toggle Critical Alarm OFF antes de alarme tocar** → tray notif (não fullscreen) ✅
3. **Toggle DnD ON, dose dentro janela** → tray silencioso vibração leve ✅
4. **Pausar tratamento contínuo 90d** → 1 FCM cancel + todos alarmes cancelados device ✅
5. **Snooze 10min + reboot device 5min depois** → alarme dispara em horário snoozed ✅
6. **App fechado, dose criada outro device, FCM chega** → 1 notif (alarme OU tray, conforme branch) ✅
7. **Logout + verificar FCM não chega mais** ✅
8. **Multi-dose group (3 doses mesmo minuto)** → 1 alarme com 3 doses listadas, marcar uma cancela só essa ✅

Sem reschedule storms em logcat. alarm_audit_log sem cascading inserts.

---

## Conclusão

Sistema **NÃO** tem bugs ocultos individuais agora. Problemas observados são **arquiteturais conhecidos** + **alguns pontos identificados nas releituras**. Plano REFACTOR acima é completo e implementável em ~10h dedicadas + validação. Recomendação: aplicar em uma branch `refactor/alarme-push-v0.2.3.1`, validar cada bloco, fazer commits granulares, validar device no final.
