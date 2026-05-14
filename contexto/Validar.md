# 📋 Validações Manuais Pendentes — Dosy

> **Checklist de validações que exigem ação sua** (device físico, observação visual em produção, conferência manual em painéis externos). A IA não consegue executar sozinha.
>
> **Como funciona:**
> - A cada nova release, a IA adiciona uma seção **no topo** com as validações pendentes daquela versão.
> - Você executa cada item e marca `[x]` quando confirmar OK.
> - A IA varre este arquivo no início de cada nova sessão e te alerta se houver `[ ]` pendente — você decide se quer validar antes de começar trabalho novo, ou se prefere acumular.
> - Validações fechadas migram pra seção "📦 Histórico" no final do arquivo (manter rastro cronológico).
>
> **Convenções:**
> - `[ ]` = pendente · `[x]` = validado OK · `[~]` = parcial / observação anotada · `[skip]` = pulado (com motivo)
> - Cada validação tem 3 partes: **Como fazer**, **O que esperar**, **Se falhar**.

---

## 🆕 Release v0.2.3.1 — versionCode 64 (refactor alarme/push Plano A + Fixes B/C)

**Escopo:** refactor v0.2.3.1 em 7 blocos consolida sistema alarme/push. Substitui v0.2.3.0 (#215) que tinha 5 caminhos com dual tray race. Agora 5 caminhos convergem em 1 mecanismo Java (Plano A).

**Root causes resolvidos:**
- **RC-1** (dual tray Java M2 + Capacitor M3 race) — Plano A unifica tudo em Java
- **RC-2** (prefs fire time) — Fix B AlarmReceiver consulta SharedPrefs antes de fire
- **RC-3** (cancel group hash) — Fix C reconstroi hash sortedDoseIds em multi-dose groups
- **RC-4** (5 paths sem coordenação) — todos convergem em PendingIntent única Java

**Achados pontuais corrigidos:**
- **A-01** doc recomputeOverdue · **A-02** cancelFutureDoses UPDATE batch (não DELETE 360 trigger fires)
- **A-03** snooze persist em reboot · **A-04** janela useDoses unificada · **A-05** SharedPrefs consolida
- **B-01** AlarmReceiver cancela tray PendingIntent (não só notif visível) · **B-02** DailySummary 1 query

**Backend deployed via MCP:**
- Edge `dose-trigger-handler` v20 ACTIVE (BATCH_UPDATE/BATCH_DELETE handlers)
- Migration `cleanup_orphan_dose_notifications_v0_2_3_1` applied (DROP tabela órfã)
- Migration `dose_change_batch_trigger_v0_2_3_1` applied (trigger statement-level batch)
- Migration `add_cancelled_status_to_doses_v0_2_3_1` applied (status='cancelled')

**Cleanup repo:**
- Edge functions deprecated removidas do repo (notify-doses + schedule-alarms-fcm)
- 23 itens código morto removidos (JS exports + Java methods + imports + comentários estale)

**Pendente device:** 5 fluxos longos (A-E) cobrem TUDO. Cada fluxo executa várias ações em sequência validando múltiplos cenários de uma vez.

---

### #v0.2.3.1.FLUXO-A — Branches scheduling + duplicate tray race + Fix B fire time

**Cobre:** 230.1.1 + 230.1.2 + 230.1.3 + 230.1.4 + B-01 + RC-1 + Fix B

#### `[ ]` A — Toggle prefs entre cadastros + valida 3 branches sem duplicate

**Como fazer:**
1. Instalar vc 64 (`adb install -r app-debug.apk`) + login `teste-plus@teste.com`.
2. Ajustes → confirmar Alarme Crítico ON + DnD OFF.
3. Cadastrar dose A **+5min** (Crítico ON, fora DnD).
4. **Sem fechar app:** Ajustes → Alarme Crítico **OFF**.
5. Cadastrar dose B **+10min** (Crítico OFF).
6. **Sem fechar app:** Ajustes → Alarme Crítico ON + DnD ON (23:00–07:00).
7. Cadastrar dose C **+15min** (Crítico ON + DnD janela conforme horário cadastro).
8. Bloquear celular + aguardar dose A.
9. Logcat: `adb logcat -s "AlarmReceiver" "AlarmScheduler" "TrayNotificationReceiver" "DosyMessagingService"`.

**O que esperar:**
- **Dose A (+5min):** alarme fullscreen toca + 1 tray. **ZERO** notif duplicada.
- **Dose B (+10min):** SÓ tray notif canal `dosy_tray` (som default). **ZERO** alarme fullscreen.
- **Dose C (+15min):** se horário cair janela DnD → tray silencioso canal `dosy_tray_dnd` vibração 200ms; se fora janela → alarme fullscreen.
- SQL `/alarm-audit` últimas 24h: 3 batches com `branch=alarm_plus_push` + `branch=push_critical_off` + `branch=push_dnd` (ou alarm_plus_push se fora DnD).
- Logcat AlarmReceiver dose A: linha `Cancel tray PendingIntent pendente (race fix)` antes de startForegroundService.

**Se falhar:**
- Dose A com 2 notifs (fullscreen + tray separada) → B-01 fix não pegou (cancel só notif visível, PendingIntent pendente AlarmManager dispara).
- Dose B com alarme fullscreen → toggle OFF não disparou rescheduleAll.
- Dose C com som default em janela DnD → channelId errado.

#### `[ ]` A.bonus — Fix B re-rota fire time (toggle entre agendamento e fire)

**Como fazer:**
1. Critical ON, cadastrar dose +5min → branch=alarm_plus_push agendado.
2. **Imediatamente** (antes do alarme tocar): Ajustes → Critical Alarm OFF.
3. **NÃO triggar rescheduleAll** — fechar app antes do toggle disparar Settings.updateNotif.
4. Aguardar dose tocar.

**O que esperar:**
- Mesmo com alarme nativo agendado, AlarmReceiver.onReceive consulta SharedPrefs `dosy_user_prefs.critical_alarm_enabled=false` → re-rota direto pra TrayNotificationReceiver.
- Tray notif aparece em vez de alarme fullscreen.
- Logcat: `Fix B re-rota fire time: criticalOn=false inDnd=false channel=dosy_tray`.

**Se falhar:**
- Alarme fullscreen tocou mesmo com Critical OFF → Fix B SharedPrefs consulta não rodou.

---

### #v0.2.3.1.FLUXO-B — Snooze persist em reboot + status change cancel

**Cobre:** A-03 + 230.2.1 + 230.2.2 + RC-3 cancel idempotente

#### `[ ]` B — Snooze + reboot + Ciente + Desfazer

**Como fazer:**
1. Critical ON, criar dose **+10min**.
2. Aguardar alarme fullscreen tocar.
3. Click **"Adiar 10min"** no AlarmActivity.
4. Imediatamente: `adb reboot` (force reboot device).
5. Aguardar device ligar (~30s) + esperar total snoozeAt chegar (10min total desde click Adiar).
6. Quando alarme tocar (deveria ser horário snoozed):
   - Click **"Ciente"** → app abre → modal aparece com dose.
   - Marcar **"Tomada"**.
7. Voltar Dashboard, achar dose marcada Tomada.
8. Click dose → **"Desfazer"** no DoseModal.
9. Logcat completo desde reboot.

**O que esperar:**
- Alarme dispara em **horário snoozed** (não original). Logcat BootReceiver:
  ```
  triggerAt=<snoozeAt epoch ms> (não triggerAt original)
  ```
- Click Ciente → MainActivity recebe `openDoseIds=<uuid>` → app abre modal.
- Marcar Tomada → confirmMut → trigger DB UPDATE → Edge BATCH_UPDATE (statement-level) → FCM cancel_alarms → DosyMessagingService cancela alarme.
- SQL `/alarm-audit` últimas 5min:
  - `action=fired_received source=java_alarm_scheduler` (alarme disparou)
  - `action=cancelled source=edge_trigger_handler reason=status_change_batch` (cancel cross-device)
- Click Desfazer → undoMut → status=pending → trigger INSERT-like → alarme reagendado.

**Se falhar:**
- Alarme tocou no horário ORIGINAL (não snoozed) → A-03 fix não pegou. BootReceiver leu triggerAt antigo de SharedPreferences.
- Cancel não disparou pós-Tomada → trigger batch não fired OR DosyMessagingService não recebeu FCM.

---

### #v0.2.3.1.FLUXO-C — Pausar tratamento batch + multi-dose group + cuidador compartilhado

**Cobre:** A-02 + RC-3 + 230.2.3 + 230.2.4 + 230.2.5 + Fix C

#### `[ ]` C — Tratamento 28 doses + multi-dose group + caregiver + pause batch

**Setup:**
1. Login `teste-plus@teste.com` no device A.
2. Login `teste-free@teste.com` no device B (segundo emulador OR Chrome admin).
3. teste-plus: criar paciente Maria + compartilhar com teste-free (Pacientes → Maria → Compartilhar → email teste-free).
4. teste-free: aceitar convite (verificar Pacientes mostra Maria).

**Multi-dose group + caregiver:**
5. teste-plus: criar tratamento Dipirona 7 dias × 4 doses/dia = 28 doses pra Maria.
6. teste-plus: criar tratamento Paracetamol pra Maria, **primeira dose no MESMO MINUTO da próxima dose Dipirona** (multi-dose group).
7. Aguardar próxima dose multi-dose chegar.
   - **AMBOS devices** devem mostrar alarme fullscreen.
   - Modal abre com **2 doses** listadas (Dipirona + Paracetamol).
8. teste-plus: marcar SÓ Dipirona Tomada (não Paracetamol).
9. **Esperado:** alarme nativo cancelado (Fix C reconstroi hash multi-dose group via `sortedDoseIds.join('|')`). Paracetamol fica pendente até user marcar.

**Caregiver DnD:**
10. teste-free Ajustes → DnD ON 22:00–07:00.
11. teste-plus: criar dose **23:30** pra Maria.
12. **Esperado:**
    - teste-plus 23:30: alarme fullscreen normal (sem DnD).
    - teste-free 23:30: tray silencioso canal `dosy_tray_dnd` (DnD ON).

**Pausar tratamento batch:**
13. teste-plus: pausar tratamento Dipirona 7-day via TreatmentList → Pausar.
14. SQL imediato:
    ```sql
    SELECT count(*), source, action, metadata->>'reason'
    FROM medcontrol.alarm_audit_log
    WHERE user_id IN (<plus_id>, <free_id>)
      AND created_at > now() - interval '1 minute'
    GROUP BY 2,3,4 ORDER BY 1 DESC;
    ```

**O que esperar:**
- ~28 doses Dipirona pending → UPDATE batch status='cancelled' em 1 query.
- Trigger `dose_change_notify_update_batch` statement-level fires **1 vez** (não 28).
- Edge `BATCH_UPDATE` recebe `old_rows` array de 28 doseIds.
- Edge envia **1 FCM por device** (teste-plus + teste-free) com action=cancel_alarms + doseIds=CSV completo.
- DosyMessagingService.handleCancelAlarms cancela individual cada doseId + reconstrói hash grupo (Fix C).
- SQL retorna: `count=28 source=edge_trigger_handler action=cancelled metadata.reason=status_change_batch` (× 2 devices = 56 audit rows).
- **Ambos devices param de receber alarmes Dipirona**. Paracetamol single-dose continua.

**Se falhar:**
- 28 trigger fires individuais em logcat → trigger ainda FOR EACH ROW (migration não aplicou).
- Multi-dose group Paracetamol cancelado junto com Dipirona → hash multi-dose calculado errado.
- teste-free não recebeu cancel_alarms → patient_shares lookup falhou.

---

### #v0.2.3.1.FLUXO-D — Boot recovery + WorkManager + daily-alarm-sync

**Cobre:** 230.3.1 + 230.3.2 + 230.4.1 + Plano A persistência tray pós-reboot

#### `[ ]` D — Reboot + worker + cron 5am

**Como fazer:**
1. Critical ON, DnD OFF, criar dose **+2h** (futura).
2. Aguardar 10min → confirmar via logcat `AlarmScheduler scheduled id=` (alarme + tray Java persisted em `dosy_user_prefs` SharedPrefs).
3. SQL verificar SharedPrefs Java (via `adb shell run-as com.dosyapp.dosy.dev cat shared_prefs/dosy_tray_scheduled.xml`):
   - Esperar entry com `notifId`, `triggerAt`, `channelId="dosy_tray"`.
4. **Force reboot:** `adb reboot`.
5. Após device ligar (~30s): aguardar dose tocar no horário ORIGINAL.
6. Logcat pós-boot:
   ```
   adb logcat -s "BootReceiver" "AlarmScheduler" "DoseSyncWorker" "DosyMessagingService"
   ```
7. Force-stop app pós-alarme: `adb shell am force-stop com.dosyapp.dosy.dev`.
8. Aguardar próximo trigger WorkManager (6h periodic) — OR forçar: `adb shell cmd jobscheduler run -f com.dosyapp.dosy.dev 0`.
9. Aguardar próximo 5am BRT (cron daily-alarm-sync).

**O que esperar:**
- **Boot:** BootReceiver re-agenda:
  - Alarme AlarmReceiver (de `dosy_critical_alarms` SharedPrefs).
  - Tray TrayNotificationReceiver (de `dosy_tray_scheduled` SharedPrefs — novo v0.2.3.1).
- Dose toca no horário ORIGINAL com alarme fullscreen + tray (não duplicated).
- **WorkManager:** logcat `DoseSyncWorker doWork` → `sync ok: fetched=N scheduled=M`.
- SQL `alarm_audit_log` source='java_worker' source_scenario='workmanager_6h' nas últimas 6h.
- **Cron 5am:** logcat madrugada `DosyMessagingService schedule_alarms: N doses` ~5am.
- SQL source='edge_daily_sync' metadata `chunks=N horizon=48` (ou 24 se projectedItems > 400).

**Se falhar:**
- Pós-reboot SÓ alarme tocou (sem tray) → BootReceiver não re-agendou trays (Plano A persistência falhou).
- Pós-reboot NADA tocou → ambos PendingIntents perdidos (SharedPrefs corrupt OR migration nova não aplicou).
- Worker não disparou → battery optimization matando WorkManager.

---

### #v0.2.3.1.FLUXO-E — Logout multi-device + push_subscriptions cleanup

**Cobre:** logout security + cleanup push_sub + multi-device FCM routing

#### `[ ]` E — 2 devices same user + logout device A

**Como fazer:**
1. Device A: login `teste-plus@teste.com` → ativar push (Ajustes → toggle Notificações).
2. Device B (segundo emulador OR Chrome admin): login mesmo teste-plus → ativar push.
3. SQL antes do logout:
   ```sql
   SELECT id, "deviceToken", "userId", device_id_uuid, "createdAt"
   FROM medcontrol.push_subscriptions
   WHERE "userId" = '<teste-plus-uuid>'
   ORDER BY "createdAt" DESC;
   ```
   Esperar **2 rows** (1 per device).
4. Device A: cadastrar dose +30min.
5. **AMBOS devices** devem receber FCM (logcat DosyMessagingService).
6. Device A: Ajustes → **Sair**.
7. SQL imediato pós-logout:
   ```sql
   SELECT id, "deviceToken", "userId", "createdAt"
   FROM medcontrol.push_subscriptions
   WHERE "userId" = '<teste-plus-uuid>';
   ```
8. Device A: cadastrar dose +5min (logado teste-free OR sem login).
9. Aguardar 5min.
10. Logcat Device A.

**O que esperar:**
- **Pós-logout Device A:**
  - push_subscriptions row do Device A **DELETED**. SQL retorna 1 row (só Device B).
  - localStorage Device A: `dosy_fcm_token` removed.
  - SharedPreferences Device A `dosy_sync_credentials`: cleared.
- **Dose criada pós-logout NÃO chega Device A**:
  - Logcat Device A: ZERO `DosyMessagingService schedule_alarms`.
  - Edge dose-trigger-handler envia FCM SÓ pra deviceToken Device B (push_subscriptions filtra Device A out).
- Device B continua recebendo FCM normalmente.

**Se falhar:**
- push_subscriptions Device A ainda existe pós-logout → race fix b4e879f+663cdef regrediu.
- Device A recebe FCM mesmo deslogado → token cache não limpo OR push_sub não deletada (vazamento security).

---

### #v0.2.3.1.audit — Verificação geral admin /alarm-audit

#### `[ ]` audit — Todos 5 sources populam alarm_audit_log + admin painel funcional

**Como fazer:**
1. Após executar FLUXOS A-E acima:
   ```sql
   SELECT source, count(*)
   FROM medcontrol.alarm_audit_log
   WHERE user_id = '<teste-plus-uuid>'
     AND created_at > now() - interval '24 hours'
   GROUP BY source ORDER BY source;
   ```
2. Navegar `https://admin.dosymed.app/alarm-audit`.
3. Filtrar por email `teste-plus@teste.com`.

**O que esperar:**
- 5 sources com entries:
  - `js_scheduler` (FLUXO A foreground reschedule)
  - `java_alarm_scheduler` (FLUXO B alarme fires)
  - `java_worker` (FLUXO D WorkManager 6h)
  - `java_fcm_received` (FLUXO C cancel batch + FLUXO D cron 5am)
  - `edge_daily_sync` (FLUXO D cron 5am)
  - `edge_trigger_handler` (FLUXO C cancel + FLUXO A INSERT)
- Metadata jsonb mostra `branch`, `horizon`, `source_scenario`, `criticalAlarmEnabled`, `dndEnabled`, `inDndWindow`.
- Admin painel: lista carrega + filtros funcionam + modal detalhes traduzido PT-BR.

---

## Release v0.2.2.4 — versionCode 62 (Internal Testing pendente)

**Escopo:** #214 P2 CLEANUP — Remove `dose_alarms_scheduled` tabela órfã + writers. Validação: zero logs `dose_alarms_scheduled upsert` + zero rows novas tabela (DROPada).

---

### #214.v224.1 — Cleanup órfão sem regressão

#### `[x]` 224.1.1 — JS scheduler não tenta upsert dose_alarms_scheduled

**Como fazer:**
1. Instalar vc 62 + abrir app.
2. Logcat `adb logcat -v time --pid=$(adb shell pidof com.dosyapp.dosy.dev) | grep -E "dose_alarms_scheduled|reportAlarmScheduled"`.
3. Aguardar rescheduleAll fire.

**O que esperar:**
- ZERO ocorrências `dose_alarms_scheduled` no logcat.
- Audit log v0.2.2.0 continua funcionando normal (batch_start/scheduled/batch_end).

**Se falhar:**
- Logs `[Notif] dose_alarms_scheduled upsert` → fix não aplicou JS-side.
- Logs `reportAlarmScheduled` → Java path ainda tentando.

---

### #214.v224.2 — Java FCM handler sem reportAlarmScheduled

#### `[x]` 224.2.1 — Trigger FCM data simulado não chama método removido

**Como fazer:**
1. SQL: `UPDATE doses SET "updatedAt"=now() WHERE id = <some pending>` (dispara dose-trigger-handler).
2. Logcat filter `DosyMessagingService`.

**O que esperar:**
- `schedule_alarms: N doses` log
- `AlarmScheduler scheduled id=...` logs
- `audit per dose scheduled` logs (alarm_audit_log)
- ZERO `reportAlarmScheduled` log.

---

### #214.v224.3 — Tabela DROPada não afeta nada

#### `[x]` 224.3.1 — SQL confirma tabela DROPada

**Como fazer:**
```sql
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'medcontrol' AND table_name = 'dose_alarms_scheduled') AS exists;
```

**O que esperar:**
- `exists = false`.

---

## Release v0.2.2.3 — versionCode 61 (Internal Testing pendente)

**Escopo:** #213 P1 STORM REAL — Remove `Dashboard.jsx` caller redundante. Confirmado via logcat Dosy-Dev: 60s exato vinha setInterval setTick(60s) flipando todayDoses ref. Fix mínimo 1 linha.

---

### #213.v223.1 — Storm eliminado definitivamente

#### `[x]` 223.1.1 — App aberto 10min ≤2 batches

**Como fazer:**
1. TRUNCATE alarm_audit_log.
2. Instalar vc 61 + login.
3. Aguardar 10min sem interagir.
4. /alarm-audit últimas 24h.

**O que esperar:**
- ≤2 batches (initial App.jsx open + máximo 1 watchdog 5min).
- Logcat: 1 só `rescheduleAll START dosesCount=434` (App.jsx full). Zero rescheduleAll dosesCount=30 (Dashboard caller eliminado).

**Se falhar:**
- 5+ batches OU logs `dosesCount=30` aparecem → Dashboard caller voltou OR build não tem fix.

---

### #213.v223.2 — Daily summary ainda agendado

#### `[x]` 223.2.1 — Daily summary notif agendado pelo App.jsx

**Como fazer:**
1. /alarm-audit último batch normal.
2. Click modal → metadata `localNotifs` ≥1 e `summary: true`.

**O que esperar:**
- Daily summary não-perdido (App.jsx caller agenda dentro mesmo rescheduleAll).

**Se falhar:**
- summary=false → Settings.prefs.dailySummary=true mas scheduler skip — bug.

---

## Release v0.2.2.2 — versionCode 60 (Internal Testing pendente)

**Escopo:** #212 P1 — Storm rescheduleAll root cause. Watchdog 60s→300s + signature guard useEffect.

---

### #212.v222.1 — Storm eliminado

#### `[x]` 222.1.1 — App aberto 10min gera ≤2 batches

**Como fazer:**
1. Limpar audit log: `TRUNCATE medcontrol.alarm_audit_log`.
2. Instalar vc 60 + abrir app.
3. Aguardar 10min sem interagir.
4. /alarm-audit últimos 10min.

**O que esperar:**
- ≤2 batches (initial open + máximo 1 watchdog em 10min com 5min interval).

**Se falhar:**
- 5+ batches → signature guard não aplicou OR watchdog ainda em 60s.

---

### #212.v222.2 — Mudança real dispara reschedule

#### `[x]` 222.2.1 — Marcar dose como tomada → 1 batch_start aparece

**Como fazer:**
1. App aberto vc 60.
2. /alarm-audit última 1h.
3. Confirmar dose Tomada no app.
4. Refresh /alarm-audit.

**O que esperar:**
- 1 batch_start novo com signature change → scheduleDoses fires.

**Se falhar:**
- Nenhum batch → signature não detectou status change (bug).

---

### #212.v222.3 — Idle longo

#### `[x]` 222.3.1 — Idle 30min mostra ≤1 batches

**Como fazer:**
1. App aberto 30min idle (não interagir).
2. /alarm-audit últimos 30min.

**O que esperar:**
- 0-2 batches (initial + máx 1 watchdog 5min).

**Se falhar:**
- 5+ → watchdog OR algum useEffect ainda flipa identity.

---

## Release v0.2.2.1 — versionCode 59 (Internal Testing publicado 13:53 BRT)

**Escopo:** #211 P1 HOTFIX — Storm rescheduleAll 1×/min descoberto via audit v0.2.2.0. Throttle 30s + window 168h→48h + audit batch single insert + DB grants.

---

### #211.v221.1 — Throttle rescheduleAll 30s

#### `[x]` 221.1.1 — App aberto 5min gera ≤5 batches

**Como fazer:**
1. Instalar vc 59 device.
2. Abrir app + interagir 5min (Dashboard, Pacientes, voltar).
3. /alarm-audit filtro origem "App (em uso ativo)" + período "Última 1h".

**O que esperar:**
- ≤5 batches em 5min.
- Logcat (`adb logcat -s "Capacitor/Console:V"`) mostra `[Notif] reschedule throttled — trailing run em Xms` quando algo tenta reagendar dentro 30s.

**Se falhar:**
- 10+ batches em 5min → throttle não aplicou.

---

### #211.v221.2 — Window 48h reduz scheduled por batch

#### `[x]` 221.2.1 — Cada batch agenda ≤40 doses

**Como fazer:**
1. /alarm-audit filtro origem "App (em uso ativo)" + ação "Fim do ciclo".
2. Click row → modal metadata.

**O que esperar:**
- metadata.groupsCount ≤30 (com janela 48h).
- metadata.alarmsScheduled ≤40.

**Se falhar:**
- 100+ scheduled → window ainda 168h.

---

### #211.v221.3 — Audit batch single insert

#### `[x]` 221.3.1 — Eventos do batch compartilham timestamp ms

**Como fazer:**
1. SQL: `SELECT date_trunc('millisecond', created_at) AS ts, action, COUNT(*) FROM medcontrol.alarm_audit_log WHERE source='js_scheduler' GROUP BY 1,2 ORDER BY 1 DESC LIMIT 30;`

**O que esperar:**
- Todos eventos de 1 batch (batch_start + N scheduled + batch_end) compartilham mesmo timestamp ms (single INSERT).

**Se falhar:**
- Timestamps espaçados → ainda per-iteration inserts.

---

## Release v0.2.2.0 — versionCode 58 (Internal Testing pendente)

**Escopo:** #210 NOVO P1 — Sistema auditoria de alarmes pra admin.dosymed.app. Captura 6 caminhos (JS scheduler + Java AlarmScheduler/Worker/FCM + Edge daily-sync/trigger-handler). Tabela `alarm_audit_log` + config whitelist `alarm_audit_config`. Admin pages `/alarm-audit` (filtros + modal detalhes) + `/alarm-audit-config` (toggle por email).

**Conta teste audit:** `lhenrique.pda@gmail.com` (seed enabled).

---

### #210.v220.1 — Eventos JS scheduler aparecem em admin.dosymed

#### `[x]` 220.1.1 — Abrir app + rescheduleAll → linhas `js_scheduler` no /alarm-audit

**Como fazer:**
1. Instalar vc 58 via Internal Testing no S25 Ultra.
2. Login `lhenrique.pda@gmail.com`.
3. Aguardar 30s (rescheduleAll natural pós-login).
4. Abrir admin.dosymed.app → /alarm-audit → filtro origem "App (em uso ativo)" + período "Última 1h".

**O que esperar:**
- Lista com pelo menos 1 `batch_start` + N eventos `scheduled` (kind=critical_alarm ou local_notif) + 1 `batch_end`.
- Descrição linguagem natural: "Iniciou ciclo de agendamento (App em uso ativo)" + "Agendou alarme: Broncho-Vaxom para Liam" + "Concluiu ciclo — 14 alarmes agendados".

**Se falhar:**
- Zero rows → audit config OFF pro user (verificar /alarm-audit-config) OR RPC `is_alarm_audit_enabled` retornando false (RLS bug).

---

### #210.v220.2 — Eventos Java Worker 6h aparecem

#### `[x]` 220.2.1 — DoseSyncWorker periodic → rows `java_worker`

**Como fazer:**
1. App vc 58 instalado.
2. Aguardar 6h (próxima execução WorkManager periodic) OR forçar via adb: `adb shell cmd jobscheduler run -f com.dosyapp.dosy 999`.
3. /alarm-audit filtro origem "App (verificação automática 6h)".

**O que esperar:**
- Rows source=`java_worker`, batch_start/scheduled per dose/batch_end.

**Se falhar:**
- Sem rows → Worker não rodou OR audit credentials SharedPrefs (`access_token`) ausentes/expirados.

---

### #210.v220.3 — Eventos Edge daily-alarm-sync (5am BRT) aparecem

#### `[ ]` 220.3.1 — Cron 5am BRT → rows `edge_daily_sync`

**Como fazer:**
1. Aguardar 5am BRT seguinte.
2. /alarm-audit filtro origem "Servidor (sincronização diária 5h)" + período "Últimas 24h".

**O que esperar:**
- batch_start + N `fcm_sent` (kind=fcm_schedule_alarms, deviceTokenTail visível) + batch_end.
- 1 par batch_start/batch_end por dia.

**Se falhar:**
- Sem rows 5am BRT → cron `daily-alarm-sync-5am` não executou. Verificar Supabase Dashboard → Edge Functions logs.

---

### #210.v220.4 — Eventos Edge dose-trigger-handler real-time aparecem

#### `[x]` 220.4.1 — Marcar dose como tomada → row `cancelled` source `edge_trigger_handler`

**Como fazer:**
1. Marcar uma dose pending como "Tomada" no app.
2. /alarm-audit filtro origem "Servidor (alteração em tempo real)" + período "Última 1h".

**O que esperar:**
- Row `cancelled` com triggerReason=`status_pending_to_done` no metadata.
- Plus row source=`java_fcm_received` action=`cancelled` (device recebeu FCM cancel).

**Se falhar:**
- Sem row Edge → trigger DB → webhook não disparou.
- Sem row Java FCM cancelled → AlarmScheduler.cancelAlarm não executou (idFromString mismatch?).

---

### #210.v220.5 — Eventos AlarmReceiver fired aparecem

#### `[ ]` 220.5.1 — Alarme dispara → row `fired_received` source `java_alarm_scheduler`

**Como fazer:**
1. Aguardar próximo alarme programado disparar.
2. /alarm-audit filtro ação "Disparado".

**O que esperar:**
- Row source=`java_alarm_scheduler` action=`fired_received` per dose do group + metadata.alarmId.

**Se falhar:**
- Sem row pós-fire → AlarmAuditLogger Executor falhou OR access_token expirado naquele momento.

---

### #210.v220.6 — Toggle config refletindo

#### `[~]` 220.6.1 — Desabilitar user em /alarm-audit-config para inserções

**Como fazer:**
1. /alarm-audit-config → linha lhenrique.pda → botão "Pausar".
2. Forçar rescheduleAll no app (kill + reabrir app).
3. /alarm-audit período "Última 1h".

**O que esperar:**
- Eventos pós-pausa NÃO aparecem (RLS bloqueou INSERT).
- Eventos pré-pausa permanecem visíveis até cleanup 7d.

**Se falhar:**
- Novos rows aparecem mesmo desabilitado → RLS policy `audit_log_user_insert` bug OR cache JS `is_alarm_audit_enabled` 5min ainda válido (esperar TTL OR force reload app).

**Pós-validação:** Reativar `lhenrique.pda` no /alarm-audit-config.

---

## Release v0.2.1.9 — versionCode 57 (Internal Testing pendente)

**Escopo:** #209 NOVO P0 — Refactor completo sistema alarmes + push. Fix 3 bugs reportados 2026-05-13 (alarme "Sem Paciente", push 5am pra dose 8am, alarme 8am não disparou). Substitui 5 caminhos redundantes por arquitetura simples: cron diário 5am BRT (FCM data 48h horizon) + trigger DB delta real-time + Worker 6h defense-in-depth + app open rescheduleAll JS.

**Mudanças código:**
- **DB Migration `update_treatment_schedule`** — adiciona `AT TIME ZONE` correction + parâmetro opcional `p_timezone` (default `America/Sao_Paulo`). Fix Bug 2.
- **DB data-fix** — regenera doses pending de todos treatments ativos via RPC fixada (idempotente). Doses já corrigidas.
- **`DoseSyncWorker.java`** — embed PostgREST `patients(name)` + extrai `patientName` do payload. Fix Bug 1. Plus HORIZON_HOURS 168 → 48.
- **Edge Function `daily-alarm-sync`** (NOVO) — substitui `notify-doses-1min` + `schedule-alarms-fcm-6h`. Cron 8am UTC = 5am BRT. FCM data 48h. Retry exponential. Multi-TZ via `user_prefs.timezone`.
- **Edge Function `dose-trigger-handler` v16** — horizon 6h → 48h. Suporte action `cancel_alarms` em DELETE + UPDATE status pending→non-pending. Suporte UPDATE pending→pending com scheduledAt mudou (cancel+re-schedule).
- **`DosyMessagingService.java`** — novo handler `cancel_alarms` action chamando `AlarmScheduler.cancelAlarm`.
- **`AlarmScheduler.java`** — novo método static `cancelAlarm(ctx, id)` + `removePersisted` helper.
- **Cron pg_cron** — UNSCHEDULE notify-doses-1min + schedule-alarms-fcm-6h. SCHEDULE daily-alarm-sync-5am.
- **`useAppUpdate.js`** — VERSION_CODE_TO_NAME map adicionado entries 56 e 57 (fix #208 BUG superseded UpdateBanner version label).
- **Memory note** `feedback_release_lifecycle.md` — checklist obrigatório bump VERSION_CODE_TO_NAME a cada release.

**Conta de teste:** `lhenrique.pda@gmail.com` (admin pessoal, dados reais com Liam/Rael/Luiz Henrique).

---

### #209.v219.0 — Internal Testing vc 57 publicado + reinstall flow

#### `[x]` 219.0.1 — AAB vc 57 (0.2.1.9) publicado Internal Testing

✅ **Validado 2026-05-13 10:09 BRT** — Play Console Internal Testing mostra "57 (0.2.1.9) · Disponível para testadores internos · 1 código de versão · Data do lançamento: 13 de mai. 10:09". Upload via Chrome MCP (receita README §10).

---

#### `[ ]` 219.0.2 — Banner update mostra "v0.2.1.9" correto (fix #208)

**Como fazer:**
1. Aguardar propagação Internal Testing CDN (~30-60min pós-publish).
2. Device S25 Ultra: Play Store → Dosy → "Atualizar" se já instalado vc 56, OU desinstalar + reinstalar via Teste Interno.
3. Se já em vc 56 com banner aparecer: abrir app → ler subtitle banner verde.

**O que esperar:**
- Banner exibe **"v0.2.1.9"** (não "versão 57" feio fallback).
- Map `VERSION_CODE_TO_NAME[57] = '0.2.1.9'` ativo (useAppUpdate.js).

**Se falhar:**
- "versão 57" aparece → map fallback não bateu, Vercel CDN ainda servindo `version.json` stale + map entry 57 missing (não é o caso — confirmado no commit ae656c3).

---

#### `[ ]` 219.0.3 — Reinstall limpa estado + login OK

**Como fazer:**
1. Desinstalar Dosy.
2. Reinstalar via Teste Interno Play Store.
3. Login `lhenrique.pda@gmail.com`.

**O que esperar:**
- Login completa sem storm refresh_token (#205 fix master).
- Dashboard carrega doses Liam/Rael/Luiz Henrique.
- Doses futuras 8am exibem horário 08:00 (não 05:00).

**Se falhar:**
- Doses 05:00 aparecem → migration TZ fix `update_treatment_schedule` não regenerou doses pending (re-rodar `data_fix_doses_timezone_v0_2_1_9_retry`).

---

### #209.v219.1 — Alarme dispara no horário correto (BRT)

#### `[ ]` 219.1.1 — Dose 8am BRT alarme toca 8am BRT (não 5am)

**Como fazer:**
1. Confirmar SQL Supabase Studio: dose pending qualquer com `scheduledAt AT TIME ZONE 'America/Sao_Paulo'` = `08:00:00` (não `05:00:00`).
2. Aguardar horário da dose.

**O que esperar:**
- Alarme nativo dispara **exatamente** no horário BRT (margem 30s).
- NÃO dispara 3h antes (5am).
- Tela cheia AlarmActivity OR notif heads-up.

**Se falhar:**
- Alarme tocou 3h antes → migration `update_treatment_schedule` TZ fix não aplicou (verificar via SQL re-run).

---

### #209.v219.2 — Alarme mostra nome do paciente correto

#### `[ ]` 219.2.1 — Alarme nunca mostra "Sem Paciente" quando paciente existe

**Como fazer:**
1. Aguardar alarme disparar via qualquer caminho (cron 5am, trigger real-time, ou Worker 6h).

**O que esperar:**
- Header alarme mostra **nome real do paciente** (ex: "Liam", "Luiz Henrique").
- NUNCA "Sem Paciente" pra dose com `patientId` válido.

**Se falhar:**
- "Sem Paciente" aparece → Worker `DoseSyncWorker.java:191` ainda não tem patientName extract. Verificar build vc 57 deployado.

---

### #209.v219.3 — Cron diário 5am dispara FCM data pra todos devices

#### `[ ]` 219.3.1 — Logcat 5am BRT mostra schedule_alarms FCM data recebido

**Como fazer:**
1. Aguardar 5am BRT seguinte (próxima execução cron `daily-alarm-sync-5am`).
2. USB device + `adb logcat -s DosyMessagingService:V AlarmScheduler:V`.

**O que esperar:**
- Logcat ~5am BRT:
  ```
  DosyMessagingService: schedule_alarms: N doses
  AlarmScheduler: scheduled id=X at=Y count=Z
  ```
- Vários alarmes agendados (alarms próximas 48h).
- Sentry breadcrumbs `rescheduleAll START/END` aparecem em qualquer crash.

**Se falhar:**
- 5am BRT sem FCM data recebido → cron `daily-alarm-sync-5am` falhou. Verificar Supabase Dashboard → cron logs.

---

### #209.v219.4 — Cron antigos foram REMOVIDOS

#### `[x]` 219.4.1 — SQL `cron.job` sem `notify-doses-1min` e `schedule-alarms-fcm-6h`

**Como fazer:**
```sql
SELECT jobname FROM cron.job ORDER BY jobname;
```

**O que esperar:**
- ✅ `anonymize-old-doses`
- ✅ `cleanup-stale-push-subs-daily`
- ✅ `daily-alarm-sync-5am`
- ✅ `extend-continuous-treatments-daily`
- ❌ NÃO deve aparecer `notify-doses-1min`
- ❌ NÃO deve aparecer `schedule-alarms-fcm-6h`

**Se falhar:**
- Cron antigo ainda ativo → re-rodar migration `cron_jobs_v0_2_1_9_daily_alarm_sync`.

---

### #209.v219.5 — Trigger DB delta real-time funciona

#### `[x]` 219.5.1 — Marcar dose como tomada cancela alarme local

**Como fazer:**
1. Configurar dose +5min futuro.
2. Aguardar AlarmScheduler agendar (`adb logcat AlarmScheduler`).
3. Marcar dose como "Tomada" no app antes do alarme disparar.
4. Aguardar 5min.

**O que esperar:**
- Logcat: `cancel_alarms: cancelled=1`.
- Alarme NÃO toca 5min depois.

**Se falhar:**
- Alarme toca mesmo após dose marcada → trigger DB → dose-trigger-handler → cancel_alarms quebrou. Verificar Edge Function logs.

---

### #209.v219.6 — Egress reduzido (≥99% redução crons antigos)

#### `[ ]` 219.6.1 — Supabase Dashboard Egress monitor 7 dias

**Como fazer:**
1. Aguardar 7 dias rodando v0.2.1.9.
2. Supabase Dashboard → Reports → Edge Functions invocations.

**O que esperar:**
- `daily-alarm-sync` invocations: 7 (1×/dia) + 1-2× por dose criada/alterada.
- `notify-doses` invocations: 0 (cron unscheduled).
- `schedule-alarms-fcm` invocations: 0.
- Total egress doses-related cai >99% vs baseline.

**Se falhar:**
- Egress não caiu → algum cron remanescente OR trigger DB rodando excessivo (storm). Investigar audit.

---

**Escopo:** #204 mutation queue offline expandido — fixes A1/A2/B/C identificados via logcat S25 Ultra (sessão 2026-05-10). Mutations CRUD completas com optimistic + alarme offline + bloqueios features fora queue + avisos UX honestos.

**Mudanças código:**
- `src/main.jsx` — Fix B (pre-mount `Network.getStatus` bloqueante) + Fix C (`onlineManager.setEventListener` Capacitor única fonte, substitui default subscriber TanStack que disparava espúrio em Capacitor WebView)
- `src/services/mutationRegistry.js` — optimistic onMutate/onError/onSuccess em **TODAS** 12 mutations queue: confirmDose/skipDose/undoDose/registerSos/createPatient/updatePatient/deletePatient/createTreatment/updateTreatment/deleteTreatment/pauseTreatment/resumeTreatment/endTreatment. createTreatment gera doses local via `generateDoses` (dashboard + alarme offline). mutationFn createTreatment resolve `patientId` temp→real via `_tempIdSource` marker (drain pós-reconnect FK fix)
- `src/pages/PatientForm.jsx` + `src/pages/TreatmentForm.jsx` — detect offline em CREATE + EDIT paths: `mutate` fire-and-forget + toast claro + close modal imediato
- `src/hooks/useOfflineGuard.js` (novo) — helper `guard.ensure(label)` bloqueia + toast pra features FORA queue
- `src/components/OfflineNotice.jsx` (novo) — banner contextual reusable
- `src/components/SharePatientSheet.jsx` — guard share/unshare + button disable + banner
- `src/pages/SOS.jsx` — guard saveRule (SOS rules fora queue) + queue registerSos offline-aware + banner
- `src/pages/Settings/index.jsx` — guard exportar LGPD + excluir conta + banner topo

**Conta de teste:** `teste-plus@teste.com / 123456`. Conta admin pessoal pra dados reais.

---

### #204.v218.1 — Boot offline: mutations rehydradas NÃO disparam fetches espúrios

#### `[x]` 218.1.1 — Pre-mount Network.getStatus bloqueante

✅ **Validado device S25 Ultra 2026-05-11 via logcat**: boot pós force-kill em avião mode mostrou `[Dosy:net] pre-mount Network.getStatus: {"connected":false}` ANTES React mount. 21 mutations rehydradas mantiveram `isPaused=true failureCount=1` (sem fetch espúrio que incrementaria failureCount). Pós-religar wifi, todas drenaram `status=success`.

**Como fazer:**
1. App aberto + algumas ações offline pendentes da sessão anterior (mutations no localStorage).
2. **Settings Android → Modo avião ON.**
3. Force-kill o Dosy (recents → swipe).
4. Reabrir Dosy.
5. Conectar device USB + rodar `adb logcat -s "Capacitor/Console:E"` no PC.

**O que esperar:**
- Logcat mostra (na ordem):
  ```
  [Dosy:net] pre-mount Network.getStatus: {"connected":false,"connectionType":"none"}
  [Dosy:net] bridge listener registered (Capacitor única fonte)
  ```
- Mutations rehydradas mantêm `isPaused=true` (NÃO tentam fetch).
- Banner amber aparece com count de pendentes.

**Se falhar:**
- Pre-mount não emite → `boot()` async não está bloqueando React mount.
- Mutations resumed imediato (isPaused=false ~1s no boot) → bridge Capacitor tarde.

---

### #204.v218.2 — Reconnect: setOnline única fonte (Capacitor bridge)

#### `[x]` 218.2.1 — Sem flips espúrios `setOnline(true)` por TanStack default subscriber

✅ **Validado device S25 Ultra 2026-05-11 via logcat** (evidência indireta): 7 events `[Dosy:net] networkStatusChange` consecutivos em transição avião→online (none→cellular→wifi → connected:true), todos via plugin Capacitor.Network bridge. Zero callers `vendor-data` ou outras fontes paralelas. Mutations drenaram 100% `status=success` sem `failureCount` inflado — indicador indireto de zero refresh espúrio durante reconnect window. Wrap `onlineManager.setOnline` debug removido pré-commit, rastreio direto de outros callers não disponível nesta sessão.

**Como fazer:**
1. App offline com mutations pausadas.
2. **Modo avião OFF.**
3. Logcat ativo.

**O que esperar:**
- Logs `[Dosy:net] networkStatusChange event:` aparecem APENAS via Capacitor bridge (caller `Object.callback`).
- NÃO há `setOnline(true) caller=vendor-data-*` espúrio (default subscriber substituído por `setEventListener`).

**Se falhar:**
- Caller `vendor-data` aparece → Fix C não aplicou. Default subscriber TanStack ainda ativo.

---

### #204.v218.3 — Modal Cadastrar Paciente fecha imediato offline

#### `[x]` 218.3.1 — Create offline + UX honesto

**Como fazer:**
1. Modo avião ON.
2. Pacientes → ➕ Novo paciente.
3. Preencher nome "Teste Offline" + idade 30 + salvar.

**O que esperar:**
- Modal fecha imediato (sem trava em loading).
- Toast info: **"Paciente salvo offline — sincroniza ao reconectar."**
- Lista pacientes mostra "Teste Offline" no topo (temp ID local).
- Banner amber count incrementa.

**Se falhar:**
- Modal trava em "Cadastrar paciente..." > 2s → `mutate` não foi chamado fire-and-forget.
- Sem toast → handler não detectou offline.

---

### #204.v218.4 — Modal Editar Paciente fecha imediato offline

#### `[x]` 218.4.1 — Edit offline + UX honesto

✅ **Validado device S25 Ultra 2026-05-11**: bug encontrado — `usePatient(id)` sem cache fallback travava PatientDetail em "Carregando…". Fix aplicado: `initialData` lookup na lista `['patients']` cache + análogo em `useTreatment(id)`. Após rebuild, edit offline OK: modal fecha imediato + toast "Alterações salvas offline" + logcat `[Dosy:mut] updatePatient pending→paused→success` pós-reconnect.

**Como fazer:**
1. Modo avião ON.
2. Pacientes → tap paciente existente → Editar.
3. Mudar nome para "Editado Offline" + salvar.

**O que esperar:**
- Modal fecha imediato.
- Toast info: **"Alterações salvas offline — sincronizam ao reconectar."**
- Lista mostra nome novo "Editado Offline".

**Se falhar:**
- Modal trava → handler editing offline não foi adicionado.

---

### #204.v218.5 — Tratamento offline aparece no Dashboard + alarme dispara

#### `[x]` 218.5.1 — createTreatment optimistic + doses local + alarme

✅ **Validado device S25 Ultra 2026-05-11 via logcat**: createTreatment pausou offline + `generateDoses` JS gerou doses local → `AlarmScheduler: scheduled id=723326328 at=<+2min>` + 2 doses futuras adicionais agendadas. AlarmReceiver BROADCAST disparou no horário, app levantou (Start proc com.dosyapp.dosy.dev) processar alarme. Fix A2 (doses optimistic local + alarme offline) funcionando end-to-end.

**Como fazer:**
1. Modo avião ON.
2. Pacientes → tap paciente → ➕ Novo tratamento.
3. Preencher medicamento "TesteOffline" + dose "1 comp" + intervalo 8h + dose inicial **+2min do agora** + duração 1 dia + salvar.

**O que esperar:**
- Modal fecha imediato.
- Toast info: **"Tratamento salvo offline — sincroniza ao reconectar."**
- **Dashboard mostra tratamento + dose pendente +2min**.
- Esperar 2min com modo avião ON.
- **Alarme nativo dispara** (som customizado + tela cheia OU notif heads-up).

**Se falhar:**
- Dashboard sem dose → `generateDoses` local não inseriu no cache `['doses']`.
- Alarme não toca → AlarmScheduler não detectou doses temp no cache (verificar logcat `[Notif] reschedule`).

---

### #204.v218.6 — createTreatment drena após reconnect resolvendo temp patientId

#### `[x]` 218.6.1 — Drain ordem FIFO + lookup _tempIdSource

✅ **Validado device S25 Ultra 2026-05-11 + SQL Supabase**: logcat `[Dosy:mut] updated createTreatment status=success failureCount=0` pós-reconnect (zero `failureCount=4 error` de v0.2.1.7). SQL `medcontrol.treatments` mostra row `medName=TesteOffiline` com `patientId=0bdf9abb-21fe-4312-8318-393d58aefc1d` (UUID real, não `temp-xxx`) + JOIN `patients` retornou `name="Teste Offline 2"` (FK válida). Fix A1 (mutationFn createTreatment resolve temp→real via `_tempIdSource` lookup cache) funcionando.

**Como fazer:**
1. Modo avião ON + receita 218.3 (paciente novo) + 218.5 (tratamento novo no mesmo paciente).
2. Cache tem 2 mutations pausadas: `createPatient(temp-A)` + `createTreatment(patientId: temp-A)`.
3. **Modo avião OFF.**
4. Aguardar 5-10s banner drainings emerald.

**O que esperar:**
- Logcat:
  ```
  [Dosy:mut] updated createPatient status=success
  [Dosy:mut] updated createTreatment status=success (sem failureCount=4)
  ```
- Banner some.
- SQL no Supabase Studio:
  ```sql
  SELECT id, "patientId", "medName" FROM medcontrol.treatments
  WHERE "userId" = auth.uid()
  ORDER BY "createdAt" DESC LIMIT 3;
  ```
- Treatment row tem `patientId` real (UUID, não temp-xxx).

**Se falhar:**
- `createTreatment status=error failureCount=4` → mutationFn não resolveu temp patientId. Lookup `_tempIdSource` falhou.

---

### #204.v218.7 — Features FORA queue: bloqueio explícito + avisos

#### `[x]` 218.7.1 — Compartilhar paciente bloqueado offline

✅ **Validado web Chrome MCP 2026-05-10** (localhost:5173): banner amarelo "Você está offline — compartilhamento de pacientes requer internet" + botão Compartilhar desabilitado (visível no Sheet "Compartilhar · Lucas Henrique").

**Como fazer:**
1. Modo avião ON.
2. Pacientes → tap paciente → 🔗 Compartilhar.
3. Tentar digitar email + Compartilhar.

**O que esperar:**
- Banner amarelo topo Sheet: **"Você está offline. Compartilhamento de pacientes requer internet."**
- Botão "Compartilhar" DESABILITADO.
- Se clicar mesmo assim: toast warn **"Sem conexão. Compartilhar paciente requer internet."**

**Se falhar:**
- Botão clicável → `disabled={!guard.online}` não aplicou.
- Sem banner → `<OfflineNotice />` não renderizou.

---

#### `[x]` 218.7.2 — SOS regra bloqueada offline

✅ **Validado web Chrome MCP 2026-05-10**: toast amarelo "Sem conexão. Salvar regra de segurança requer internet. Reconecte e tente novamente." (paciente Lucas Henrique + medicamento TesteOff + intervalo 6h).

**Como fazer:**
1. Modo avião ON.
2. Página S.O.S → selecionar paciente + medicamento.
3. Preencher intervalo mín 6h + clicar "Salvar regra".

**O que esperar:**
- Toast warn: **"Sem conexão. Salvar regra de segurança requer internet."**
- Regra NÃO salva.

**Se falhar:**
- Toast diferente / nenhum → `guard.ensure` não foi chamado.

---

#### `[x]` 218.7.3 — SOS dose registrada offline ENTRA queue

✅ **Validado device S25 Ultra 2026-05-11 via logcat**: `[Dosy:mut] added registerSos status=idle → pending failureCount=1 → isPaused=true`. Mutation entrou queue offline corretamente. Toast info exibido + dose SOS aparece Dashboard via onMutate optimistic insert (temp ID). Drain post-reconnect ocorre quando wifi voltar.

**Como fazer:**
1. Modo avião ON.
2. Página S.O.S → preencher paciente + medicamento + dose + horário.
3. Clicar "Registrar S.O.S".

**O que esperar:**
- Toast info: **"Dose S.O.S salva offline — sincroniza ao reconectar."**
- Banner amber count incrementa.
- Dashboard mostra dose SOS (status done).

**Se falhar:**
- Modal trava → `mutate` não foi chamado fire-and-forget.

---

#### `[x]` 218.7.4 — LGPD exportar bloqueado offline

✅ **Validado web Chrome MCP 2026-05-10**: toast amarelo "Sem conexão. Exportar dados LGPD requer internet. Reconecte e tente novamente."

**Como fazer:**
1. Modo avião ON.
2. Ajustes → "Exportar meus dados".

**O que esperar:**
- Toast warn: **"Sem conexão. Exportar dados LGPD requer internet."**
- Sem download / sem dialog.

**Se falhar:**
- Tentativa de fetch → guard.ensure não foi adicionado em `exportUserData`.

---

#### `[x]` 218.7.5 — LGPD excluir conta bloqueado offline

✅ **Validado web Chrome MCP 2026-05-10**: ConfirmDialog "Excluir conta permanentemente?" aberto + click "Excluir tudo" → toast amarelo "Sem conexão. Excluir conta requer internet. Reconecte e tente novamente." Conta não excluída.

**Como fazer:**
1. Modo avião ON.
2. Ajustes → "Excluir minha conta" → confirma.

**O que esperar:**
- Toast warn: **"Sem conexão. Excluir conta requer internet."**
- Conta NÃO excluída.

**Se falhar:**
- Edge Function tentou rodar → guard.ensure não aplicou.

---

#### `[x]` 218.7.6 — Settings banner global offline

✅ **Validado web Chrome MCP 2026-05-10**: banner amarelo topo Ajustes "Você está offline — exportação de dados, exclusão de conta e algumas configurações requer internet. Reconecte para usar."

**Como fazer:**
1. Modo avião ON.
2. Abrir Ajustes.

**O que esperar:**
- Banner amarelo topo Ajustes: **"Você está offline. Exportação de dados, exclusão de conta e algumas configurações requer internet."**

**Se falhar:**
- Banner ausente → `<OfflineNotice />` não foi adicionado em Settings/index.

---

### #204.v218.8 — pause/resume/end Treatment optimistic

#### `[x]` 218.8.1 — Pausar tratamento offline

✅ **Validado device S25 Ultra 2026-05-11**: bug encontrado primeiro round — patch `setQueryData(['treatments'])` queryKey exata não atingia useTreatments({patientId}) → status visual não mudava. Fix aplicado: helper `patchEntityListsInCache` varre `findAll({queryKey: ['treatments']})` + patch cada variação. Bug separado: PatientDetail sem botão Pausar (UX gap — usar página Tratamentos). Logcat `[Dosy:mut] added pauseTreatment idle → pending failureCount=1 → isPaused=true`. Status visual atualiza imediato + doses futuras canceladas local + entrada queue OK.

**Backlog UI:** clicks duplos no botão Pausar geram mutations duplicadas no queue (cada click = nova mutation independente). Disable button via cache lookup status==='paused' pendente. Não-bloqueador (server-side idempotente).

**Como fazer:**
1. Modo avião ON.
2. Tratamento ativo → menu ⋮ → Pausar.

**O que esperar:**
- Status muda visualmente pra "Pausado" imediato.
- Doses futuras pendentes do tratamento somem do Dashboard.
- Alarmes do tratamento param (verificar próximo alarme NÃO toca).

**Se falhar:**
- Status não muda → onMutate optimistic não rodou.
- Doses futuras continuam → filter cancelFutureDoses local não rolou.

---

### #205.v218.9 — Single source refresh token: zero storms xx:00

#### `[ ]` 218.9.1 — Lifespan session ≥ 12h (sem re-login forçado)

**Como fazer:**
1. Instalar AAB vc 56 release variant (`com.dosyapp.dosy`) S25 Ultra.
2. Login `lhenrique.pda@gmail.com` (conta admin pessoal).
3. Anotar timestamp login + Painel admin `/auth-log` evento `login_email_senha`.
4. Usar app normalmente por 24h (foreground/background ciclos naturais).
5. Após 24h, abrir Painel admin `/auth-log` filtrado pelo user.

**O que esperar:**
- Eventos `login_email_senha` nas últimas 24h: **APENAS 1** (o login inicial).
- Demais eventos: `sessao_restaurada` apenas.
- Zero forced re-login (user não digitou senha novamente).

**Se falhar:**
- 2+ `login_email_senha` em 24h → re-login forçado ainda acontece. Verificar SQL `auth.refresh_tokens` se storm pattern xx:00 persiste.

---

#### `[ ]` 218.9.2 — SQL refresh_tokens sem storm xx:00

**Como fazer:**
1. 24h após install vc 56, abrir Supabase Studio SQL Editor.
2. Rodar:
   ```sql
   WITH u AS (SELECT id::text AS uid FROM auth.users WHERE email = 'lhenrique.pda@gmail.com')
   SELECT DATE_TRUNC('minute', rt.created_at) AS bucket,
          COUNT(*) AS tokens_in_minute
   FROM auth.refresh_tokens rt, u
   WHERE rt.user_id = u.uid
     AND rt.created_at > NOW() - INTERVAL '24 hours'
   GROUP BY 1 HAVING COUNT(*) > 2
   ORDER BY 1 DESC;
   ```

**O que esperar:**
- Result: 0 rows. Nenhum minuto com mais de 2 refreshes simultâneos.

**Se falhar:**
- Qualquer bucket >5 tokens em 1 minuto → storm ativa. Anotar timestamp + verificar logcat `DoseSyncWorker` / `DosyMessagingService` se aparecem refresh attempts.

---

#### `[ ]` 218.9.3 — Sessions lifespan ≥ 12h

**Como fazer:**
1. SQL:
   ```sql
   WITH u AS (SELECT id::uuid AS uid FROM auth.users WHERE email = 'lhenrique.pda@gmail.com')
   SELECT s.id, s.created_at, s.updated_at,
          EXTRACT(EPOCH FROM (s.updated_at - s.created_at))/3600 AS lifespan_hours
   FROM auth.sessions s, u
   WHERE s.user_id = u.uid AND s.created_at > NOW() - INTERVAL '7 days'
   ORDER BY s.created_at DESC LIMIT 10;
   ```

**O que esperar:**
- Sessões S25 Ultra (`user_agent LIKE 'Dalvik%SM-S938B%'`) lifespan ≥ 12h cada (vs 18min-3h v0.2.1.7).

**Se falhar:**
- Lifespan curto persiste → refresh chain ainda corrompendo. Verificar logcat se Worker/MessagingService log refresh attempts.

---

#### `[ ]` 218.9.4 — Logcat sem refresh calls native

**Como fazer:**
1. Device USB + `adb logcat -s "DoseSyncWorker:V" "DosyMessagingService:V"`.
2. Esperar Worker periodic rodar (6h ciclo natural OR forçar via Settings → Developer options → Workers → DoseSyncWorker → "Run").

**O que esperar:**
- Logs `DoseSyncWorker`: zero linhas `token refresh status=`.
- Pode aparecer: `access_token expired/near-expiry — skip rodada` (esperado se >1h sem foreground).
- `sync ok: fetched=N scheduled=M` em rodadas com token válido.

**Se falhar:**
- Linha `token refresh status=` → Worker ainda chama `/auth/v1/token`. Fix #205 não aplicou.

---

### Validação cruzada — drain completo após reconnect

#### `[ ]` 218.X — Reconectar drena TODAS mutations sem perda

**Como fazer:**
1. Receita completa offline 218.3 + 218.4 + 218.5 + 218.7.3 + 218.8 + várias confirmDose/skipDose.
2. **Modo avião OFF.**
3. Aguardar drain (banner emerald → some, ~10s).

**O que esperar:**
- Logcat zero `status=error failureCount=4`.
- Todas mutations `status=success`.
- SQL:
  ```sql
  SELECT id, "medName", status, "actualTime", "updatedAt"
  FROM medcontrol.doses
  WHERE "userId" = auth.uid()
    AND "updatedAt" > NOW() - INTERVAL '15 minutes'
  ORDER BY "updatedAt" DESC;
  ```
- Reflete todas confirmações/skips + dose SOS + doses do tratamento novo.

**Se falhar:**
- Qualquer mutation `status=error` → bug específico daquela mutation. Anotar key + failureCount.

---

## Release v0.2.1.7 — versionCode 55 (publicado Internal Testing 2026-05-09 23:08)

**Escopo:** [#204 Mutation queue offline](CHECKLIST.md#204--mutation-queue-offline-react-query-nativa--fase-1-offline-first) + [#207 Defesa em profundidade alarme crítico](CHECKLIST.md#207--defesa-em-profundidade-alarme-crítico-5-fixes)

**AAB:** Internal Testing track ativo. Instalar via link [https://play.google.com/apps/internaltest/4700769831647466031](https://play.google.com/apps/internaltest/4700769831647466031)

**Conta de teste recomendada pra validação:** sua conta admin pessoal (com tratamentos e dados reais), ou `teste-plus@teste.com / 123456` (tier plus, sem ads). Para validar gating Free/Plus, use também `teste-free@teste.com / 123456`.

---

### #204 — Mutation queue offline (Fase 1 offline-first)

**Resumo:** ações offline (confirmar dose, pular, criar paciente, etc) ficam salvas localmente e sincronizam automaticamente quando a internet volta. Antes do fix, ficavam perdidas silenciosamente após 30s offline.

#### `[skip]` 204.1 — Avião mode + ações offline → banner amber

⏭️ **Superseded por 218.5.1** v0.2.1.8 (validado device 2026-05-11) — Fix A2 createTreatment optimistic + doses local + alarme offline cobre mesmo escopo + adições.

**Como fazer:**
1. Abrir Dosy no celular (S25 Ultra ou outro Android com Internal Testing instalado).
2. Fazer login normalmente.
3. **Settings Android → ativar "Modo avião"** (corta tudo: wifi + dados móveis).
4. Voltar pro Dosy.
5. Executar 5 ações em sequência:
   - Confirmar 1 dose (botão "Tomada")
   - Pular 1 dose (botão "Pular")
   - Confirmar mais 1 dose
   - Criar 1 paciente novo (Pacientes → +)
   - Cadastrar 1 tratamento novo no paciente recém-criado (botão `+` flutuante)
6. Aguardar uns 5 segundos depois da última ação.

**O que esperar:**
- Banner amarelo (amber) aparece no rodapé acima do BottomNav: **"5 ações salvas offline — sincroniza ao reconectar"** (ou número correspondente).
- Cada ação aparece como confirmada/pulada na tela na hora (optimistic update — UI responde instantâneo).
- App NÃO trava nem mostra erro de rede.

**Se falhar:**
- Sem banner aparecendo → `OfflineBanner.jsx` não está pegando state. Anotar no item: `[~] banner não apareceu`.
- App trava ou mostra erro → bug de retry/network mode. Anotar log do erro.

---

#### `[skip]` 204.2 — Reabrir conexão → drain emerald

⏭️ **Superseded por 218.6.1** v0.2.1.8 (validado device + SQL 2026-05-11) — drain temp patientId pós-reconnect + Fix A1 resolve `_tempIdSource` cobre escopo expandido.

**Como fazer:**
1. Continuando do item 204.1 (5 ações offline pendentes).
2. **Settings Android → desativar "Modo avião"** (volta wifi/dados).
3. Voltar pro Dosy e ficar olhando o banner.

**O que esperar:**
- Banner muda de amarelo (amber) para verde (emerald) com texto: **"Sincronizando 5 ações…"** (com ícone girando).
- Banner fica visível por até 3 segundos.
- Banner some sozinho.
- Stats do dashboard atualizam (atrasadas/adesão refletem ações sincronizadas).

**Se falhar:**
- Banner some sem mostrar emerald → drain rápido demais (feature funcionou mas UX não viu).
- Banner fica preso emerald além de 5s → mutations travadas. Verificar console logcat.

---

#### `[x]` 204.3 — Confirmar sync server-side via SQL

✅ **Validado SQL Supabase MCP 2026-05-12 00:40 UTC**: query `medcontrol.doses WHERE updatedAt > NOW() - INTERVAL '4 hours'` retornou 21 doses drenadas — 1 dose SOS `type=sos status=done` (218.7.3 drain confirmado), 18 doses `skipped` + 2 `done` (218.x mass mutations). Zero perda observada. Drain server-side healthcare integro.

**Como fazer:**
1. Após 204.2 confirmado, abrir [Supabase Studio](https://supabase.com/dashboard/project/guefraaqbkcehofchnrc/editor).
2. SQL Editor → rodar:
   ```sql
   SELECT id, "medName", status, "actualTime", "updatedAt"
   FROM medcontrol.doses
   WHERE "userId" = auth.uid()
     AND "updatedAt" > NOW() - INTERVAL '15 minutes'
   ORDER BY "updatedAt" DESC
   LIMIT 10;
   ```
   (Se SQL Editor não usar `auth.uid()`, substituir pelo seu UUID — pega em Authentication → Users.)

**O que esperar:**
- 3 linhas com `status = 'done'` (as confirmações)
- 1 linha com `status = 'skipped'` (a pulada)
- Para o paciente novo + tratamento, rodar SQL nas tabelas `patients` e `treatments` filtrando `"createdAt" > NOW() - INTERVAL '15 minutes'`.

**Se falhar:**
- Linhas faltando no DB → mutation foi descartada em vez de drenada. Bug crítico.

---

#### `[skip]` 204.4 — Force-kill app offline + reabrir → mutations sobrevivem

⏭️ **Superseded por 218.1.1** v0.2.1.8 (validado device 2026-05-11) — pre-mount Network.getStatus bloqueante mostrou 21 mutations rehydradas pós force-kill mantendo `isPaused=true failureCount=1` (sem fetch espúrio). Cobre cenário 204.4 + valida Fix B race rehydrate.

**Como fazer:**
1. Modo avião ativo + 1 dose confirmada offline (banner amber visível).
2. **Force kill o Dosy** (Recents → swipe away).
3. Reabrir o Dosy (ainda em avião mode).

**O que esperar:**
- Banner amber **continua aparecendo** "1 ação salva offline" (mutation persistida via TanStack Query persist mutations).
- Ao desativar avião mode, drain acontece normalmente (item 204.2).

**Se falhar:**
- Banner some após reabrir → persist de mutation não está funcionando. Bug crítico.

---

### #207 — Defesa em profundidade alarme crítico (5 fixes)

**Resumo:** alarmes agora disparam SEMPRE no horário, mesmo se o usuário não abrir o app por dias, e mesmo em Samsung/Xiaomi (que matam apps em background). Cobertura ampliada de 48h pra 7 dias. Permissão "Ignorar otimização de bateria" agora é solicitada explicitamente.

#### `[x]` 207.1 — PermissionsOnboarding 5º item: battery optimization

✅ **Validado device S25 Ultra 2026-05-11** (user confirmou via instalações repetidas Dosy-Dev): modal PermissionsOnboarding lista 5º item "Ignorar otimização de bateria" com descrição crítico Samsung/Xiaomi. Plugin `isIgnoringBatteryOptimizations` + `requestIgnoreBatteryOptimizations` funcionando.

**Como fazer:**
1. Desinstalar o Dosy do S25 Ultra (Settings → Apps → Dosy → Desinstalar).
2. Reinstalar via Internal Testing link.
3. Abrir o app, fazer login.
4. Após login, deve aparecer o modal **"Configurar alarmes"** com permissões.

**O que esperar:**
- Modal lista **5 itens**:
  1. Notificações habilitadas
  2. Alarmes exatos
  3. Notificações em tela cheia
  4. Aparecer sobre outros apps
  5. **Ignorar otimização de bateria** ← novo, com descrição: *"Crítico em Samsung/Xiaomi: sem isso o sistema pode cancelar alarmes pra economizar bateria."*
- Tocar "Abrir configurações" no 5º item abre dialog do Android: *"Permitir que o Dosy ignore a otimização de bateria? Sim/Não"*.
- Aceitar **Sim**.
- Voltar pro modal e tocar "Verificar de novo".
- 5º item agora aparece marcado com ✅ verde.
- Após todos 5 itens granted, modal fecha automaticamente.

**Se falhar:**
- 5º item não aparece → manifest ou plugin não tem `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
- Tap não abre dialog system → plugin `requestIgnoreBatteryOptimizations` quebrado.
- Recheck não detecta granted → plugin `isIgnoringBatteryOptimizations` retorna errado.

---

#### `[x]` 207.2 — Alarme dispara no horário EXATO (não 15min antes)

✅ **Validado device S25 Ultra 2026-05-11** (user confirmou): alarme +5min disparou no horário exato, não 15min antes. Fix `advanceMins ?? 0` em scheduler.js aplicou.

**Contexto bug:** antes do fix, `advanceMins ?? 15` no scheduler.js fazia o alarme disparar 15 minutos antes do horário marcado quando as preferências locais não tinham o campo explícito. Agora `?? 0` alinha com o default real (alarme exato).

**Como fazer:**
1. Configurar um tratamento novo com dose **5 minutos no futuro** (ex: agora são 18:30, marcar dose pra 18:35).
2. Fechar o app (swipe away recents) — não deixar aberto.
3. Não tocar o celular por 5 minutos.

**O que esperar:**
- Alarme dispara **exatamente às 18:35** (margem de 30s aceitável devido floor pra minuto).
- **NÃO dispara antes** (não às 18:20 — esse seria o bug antigo).
- Som customizado `dosy_alarm.mp3` toca em loop.
- Tela cheia AlarmActivity OU notificação heads-up com botões "Ciente / Adiar 10min / Ignorar".

**Se falhar:**
- Alarme tocou 15min antes → fix `?? 0` não pegou (verificar `localStorage.medcontrol_notif`).
- Alarme não tocou → outro problema (battery optimization? exact alarm permission?).

---

#### `[ ]` 207.3 — Cobertura 7 dias mesmo sem abrir app

**Contexto bug:** antes, janela de scheduling local era 48h. User que não abria o app por 49h+ ficava sem alarmes locais (dependia de cron servidor + WorkManager, que Samsung mata). Agora 168h (7 dias).

**Como fazer:**
1. Abrir Dosy.
2. Configurar tratamento com dose **3 dias no futuro** (ex: hoje é dia 10, dose dia 13).
3. Fechar app.
4. **NÃO abrir o app entre hoje e dia 13.**
5. Aguardar dia 13 chegar.

**O que esperar:**
- Alarme dispara no horário marcado dia 13, mesmo sem abrir o app entre install e dose.
- Se quiser confirmar agendamento antes de esperar 3 dias: rodar `adb logcat -s AlarmScheduler` durante a configuração — deve aparecer `AlarmScheduler: scheduled id=N at=<timestamp dia 13>`.

**Se falhar:**
- Alarme não tocou dia 13 → janela ainda 48h ou DoseSyncWorker não rodou. Verificar `prefs.js` e `DoseSyncWorker.java`.

---

#### `[~]` 207.4 — rescheduleAll sempre faz full reset (drop diff-and-apply)

🟡 **Parcial 2026-05-11**: evidência INDIRETA via logcat: 8 `AlarmScheduler: scheduled id=` em 1 session 218.5.1 (múltiplos reschedule completos sem diff). Limite: `console.log [Notif] reschedule START — full cancelAll` strippado por terser em prod → não rastreável logcat direto. Plus zero issues Sentry v0.2.1.7+ com `category=alarm` breadcrumbs (ausência confirma código mas não dá evidência positiva). Validação completa exige crash captura prod v0.2.1.8 Internal Testing.

**Contexto bug:** antes, idempotência via `localStorage.dosy_scheduled_groups_v1` causava drift quando OEM matava AlarmManager mas localStorage dizia "já agendado" → diff vazio → AlarmManager continuava vazio → alarme não tocava. Agora sempre `cancelAll() + reschedule from scratch`.

**Como fazer:**
1. Configurar 3 doses com horários diferentes (ex: +10min, +20min, +30min do agora).
2. Fechar app.
3. Reabrir app.
4. Conectar device USB + rodar `adb logcat -s AlarmScheduler AlarmReceiver Notif`.
5. Forçar reschedule fechando e reabrindo o app.

**O que esperar:**
- Log: `[Notif] reschedule START — full cancelAll`
- Log: `[Notif] groups to schedule: 3` (ou número correto)
- Log 3x: `AlarmScheduler: scheduled id=X at=Y count=1`
- **NÃO aparece** texto `diff — keep: N add/update: M remove: K` (esse é o log antigo do diff-and-apply removido).

**Se falhar:**
- Log antigo `diff — keep:` ainda aparece → fix não aplicou.
- `groups to schedule: 0` quando deveria ser 3 → window/filter bug.

---

#### `[~]` 207.5 — Sentry breadcrumbs em rescheduleAll

🟡 **Parcial 2026-05-11**: Sentry dashboard verificado via Chrome MCP — projeto Dosy ATIVO (1710 sessions, 39 releases, v0.2.1.8 listado topo). Plus issue DOSY-P captured = refresh storm #205 bug em v0.2.0.10 (`Lock "sb-...auth-token" was released because another request stole it`) — Sentry confirmadamente capturando crashes prod. Zero issues v0.2.1.7+ últimas 7d → sem inspeção breadcrumbs `category=alarm` disponível agora. Validação completa exige crash v0.2.1.8 prod Internal Testing.

**Como fazer:**
1. Forçar uma sessão real do app:
   - Login + uso normal por 5 min
   - Configurar/editar tratamentos
   - Confirmar/pular doses
2. Aguardar até que algum erro real ocorra OU 24h pós-uso.
3. Abrir [Sentry](https://lhp-tech.sentry.io/projects/dosy/) → ver issues recentes do release `dosy@0.2.1.7`.

**O que esperar:**
- Em qualquer issue capturada, no painel "Breadcrumbs" deve aparecer trail com:
  - `category=alarm`, `message=rescheduleAll START`, `data={dosesCount: N, patientsCount: M}`
  - `category=alarm`, `message=rescheduleAll END`, `data={alarmsScheduled: N, dndSkipped: 0, localNotifs: 0, summary: true, advanceMins: 0, groupsCount: N}`

**Se falhar:**
- Breadcrumbs sem entries de `category=alarm` → import Sentry em scheduler.js não pegou ou DSN não configurado em produção.

**Nota:** Sentry é gated em `import.meta.env.PROD` only. Build local de Studio é release variant → Sentry ativo.

---

### Validação cruzada (#204 + #207 juntos)

#### `[skip]` 204+207.x — Avião mode + alarme local agendado dispara

⏭️ **Superseded por 218.5.1** v0.2.1.8 (validado device 2026-05-11) — createTreatment offline + `generateDoses` JS + AlarmScheduler agendou 3 alarmes nativos + AlarmReceiver BROADCAST disparou no horário. Cobre cenário 204+207 alarme offline end-to-end.

**Como fazer:**
1. Configurar dose +5min futuro com app online.
2. **Settings Android → Modo avião ON.**
3. Aguardar 5min.

**O que esperar:**
- Alarme dispara mesmo offline (porque foi agendado localmente via `setAlarmClock` antes do avião mode).
- Tap "Ciente" → app abre + tenta confirmar dose → mutation queued offline (banner amber aparece) → drain quando reconectar.

**Se falhar:**
- Alarme não disparou offline → AlarmManager não foi agendado ou foi cancelado.

---

## 📦 Histórico (validações fechadas)

> Quando você marcar todos `[x]` de uma release, a IA move a seção pra cá.

_(vazio — primeira release com este arquivo)_
