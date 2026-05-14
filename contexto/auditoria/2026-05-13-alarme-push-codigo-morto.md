# Auditoria — Código Morto Sistema Alarme + Push

**Data:** 2026-05-13 (segunda passada)
**Escopo:** todo arquivo / função / export / canal / SharedPref / coluna DB / cron / Edge function / migration relacionado a alarme/push.
**Metodologia:** Grep cruzado de cada símbolo exportado vs callers reais. Verificação no DB Supabase via MCP do que está realmente deployado e ativo.

---

## 1. Sumário

Encontrados **23 itens de código morto** em 5 camadas (JS, Java, Edge, SQL, docs). Nenhum causa bug ativo — todos são "ruído arquitetural" que dificulta leitura + manutenção. **Não há nenhum arquivo `.java`, `.js`, `.ts` ou `.sql` INTEIRO que esteja morto.**

Categorias:
- **Edge Functions deployadas mas sem callers:** 2 (stubs 410 Gone, ok manter ou deletar)
- **Tabela DB sem readers/writers:** 1 (`dose_notifications` — 150 rows órfãs)
- **Migration órfã (cria cron que foi unscheduled):** 1
- **Java methods/keys/imports não usados:** 7
- **JS exports não usados:** 6
- **Channel Android com loop deleta-cria:** 1
- **Docs obsoletos:** 1
- **Comentários estale:** 4

---

## 2. Por Camada

### 2.1 Edge Functions (Supabase Deno)

| Arquivo | Status | Recomendação |
|---------|--------|--------------|
| `supabase/functions/notify-doses/index.ts` | Stub 410 Gone (deployed v20, ativo) | **DELETAR** Edge deployada via `supabase functions delete notify-doses` + arquivo do repo. Sem callers (cron unscheduled, JS não chama). |
| `supabase/functions/schedule-alarms-fcm/index.ts` | Stub 410 Gone (deployed v16, ativo) | **DELETAR** Edge deployada via `supabase functions delete schedule-alarms-fcm` + arquivo do repo. Sem callers (cron unscheduled, JS não chama). |
| `supabase/functions/dose-trigger-handler/index.ts` | ATIVA ✅ | Manter. |
| `supabase/functions/daily-alarm-sync/index.ts` | ATIVA ✅ | Manter. |
| `supabase/functions/send-test-push/index.ts` | ATIVA ✅ (admin testing) | Manter. |
| `supabase/functions/_shared/userPrefs.ts` | ATIVA ✅ | Manter. |
| `supabase/functions/_shared/auditLog.ts` | ATIVA ✅ | Manter. |

**Verificação DB:** confirmado via `cron.job` que `notify-doses-1min` e `schedule-alarms-fcm-6h` NÃO estão na lista de crons ativos.

### 2.2 SQL Migrations (`supabase/migrations/`)

| Arquivo | Status | Ação |
|---------|--------|------|
| `20260501190000_dose_notifications.sql` | Cria tabela `dose_notifications` que está órfã | **Deixar histórico**, mas adicionar migration nova `DROP TABLE medcontrol.dose_notifications CASCADE` em release v0.2.3.1. |
| `20260502091000_dose_trigger_webhook.sql` | Cria notify_dose_change v1 (depois recriada em 200000 + 213000) | Manter (histórico). |
| `20260507230000_notify_doses_cron_1min.sql` | Cria cron `notify-doses-1min` (depois unscheduled externo, sem migration unschedule) | **Adicionar migration nova:** `SELECT cron.unschedule('notify-doses-1min')` IF EXISTS, pra garantir paridade idempotente. |
| `20260513200000_expand_dose_change_notify_to_delete.sql` | Define função notify_dose_change v2 + recria trigger | Manter (depois sobrescrito em 213000). |
| `20260513213000_dose_change_notify_dedupe_in_function_v0_2_3_0.sql` | Versão final notify_dose_change v3 com dedup interno | ATIVA ✅. |
| `20260513191154_drop_dose_alarms_scheduled_v0_2_2_4.sql` | Drop tabela dose_alarms_scheduled | ATIVA ✅. |
| `20260513210000_add_device_id_uuid_to_push_subscriptions_v0_2_3_0.sql` | Adiciona device_id_uuid + RPC upsert | ATIVA ✅. |
| `20260507230500_cleanup_stale_push_subs_cron.sql` | Cron cleanup_stale_push_subscriptions | ATIVA ✅. |

### 2.3 Tabelas DB órfãs

| Tabela | Rows | Readers | Writers | Recomendação |
|--------|------|---------|---------|--------------|
| `medcontrol.dose_notifications` | 150 | **nenhum ativo** (notify-doses Edge é stub) | **nenhum ativo** | **DROPAR** em v0.2.3.1. Comentário da tabela ainda diz "Idempotency log for notify-doses Edge Function" — confirmado órfã. |
| `medcontrol.dose_alarms_scheduled` | — | — | — | Já dropada em v0.2.2.4 ✅. |
| `medcontrol.push_subscriptions` | 10 | dose-trigger-handler + daily-alarm-sync + send-test-push + useNotifications | useAuth (DELETE), upsert_push_subscription RPC | ATIVA ✅. |
| `medcontrol.alarm_audit_log` | 1164 | admin_list_alarm_audit (admin dashboard) | scheduler.js + Java AlarmAuditLogger + Edge | ATIVA ✅. |
| `medcontrol.alarm_audit_config` | 2 | getEnabledAuditUsers (Edge) + is_alarm_audit_enabled RPC | admin_toggle_alarm_audit | ATIVA ✅. |
| `medcontrol.user_prefs` | 3 | useUserPrefs + getUserNotifPrefs Edge + DoseSyncWorker | useUserPrefs mutation | ATIVA ✅. |

### 2.4 DB Functions (procedures)

Listadas todas que contém `notif`/`alarm`/`push`/`dose`/`cleanup`. **Nenhuma órfã.** Todas têm caller.

### 2.5 Cron Jobs

```
alarm-audit-cleanup-daily          ATIVO ✅
anonymize-old-doses                ATIVO ✅
cleanup-stale-push-subs-daily      ATIVO ✅
daily-alarm-sync-5am               ATIVO ✅
extend-continuous-treatments-daily ATIVO ✅
```

Confirmado: nenhum cron órfão. `notify-doses-1min` e `schedule-alarms-fcm-6h` removidos.

### 2.6 Java (Android plugin criticalalarm)

#### Methods mortos

| Arquivo | Símbolo | Motivo |
|---------|---------|--------|
| `CriticalAlarmPlugin.java` linhas 49-77 | `schedule(PluginCall)` (single-dose wrapper) | JS export `scheduleCriticalAlarm` que invoca está morto. Nenhum caller real. **Pode deletar**. |
| `CriticalAlarmPlugin.java` linhas 207-223 | `updateAccessToken(PluginCall)` | JS export `updateAccessToken` está morto (useAuth.jsx usa `setSyncCredentials` que já carrega accessToken inline). **Pode deletar**. |

#### Constantes / Keys mortas

| Arquivo | Símbolo | Motivo |
|---------|---------|--------|
| `AlarmActionReceiver.java` linha 27 | `NOTIF_ID_OFFSET = 100_000_000` | Usado em linha 44 `nm.cancel(alarmId + NOTIF_ID_OFFSET)`, mas nenhuma notif é POSTADA com esse ID (postPersistentNotification removida em #222). Cancel inócuo. **Pode deletar constante + linha 44**. |
| `AlarmReceiver.java` linha 37 | `CHANNEL_ID = "doses_critical_v2"` | Canal foi DELETADO em `MainActivity.cleanupLegacyChannels`. `ensureChannel()` em AlarmReceiver recria — loop deleta-cria a cada boot. Comentário linha 35 ainda diz "doses_critical" canal antigo. **Migrar fallback path pra `dosy_tray` channel** + remover ensureChannel recreate. |

#### Imports não usados

| Arquivo | Imports |
|---------|---------|
| `AlarmScheduler.java` | `android.media.AudioAttributes` (linha 10), `android.net.Uri` (linha 11), `com.dosyapp.dosy.MainActivity` (linha 18), `com.dosyapp.dosy.R` (linha 19) — 4 imports nunca referenciados |

#### Comentários estale

| Arquivo | Linha | Comentário desatualizado |
|---------|-------|---------------------------|
| `CriticalAlarmPlugin.java` | 142 | "Usado por DosyMessagingService.reportAlarmScheduled" — método removido em v0.2.2.4 |
| `CriticalAlarmPlugin.java` | 280 | "rescheduleAll upsert dose_alarms_scheduled" — tabela dropada em v0.2.2.4 |
| `DosyMessagingService.java` | 32 | "chama AlarmScheduler.scheduleDose pra cada" — agora é scheduleDoseAlarm |
| `DosyMessagingService.java` | 33 | "reporta server-side via dose_alarms_scheduled, NÃO mostra notif" — reportAlarmScheduled removido |

#### SharedPreferences keys duplicadas (não morta mas redundante)

`critical_alarm_enabled` armazenado em DOIS namespaces:
- `dosy_sync_credentials.critical_alarm_enabled` — legacy, lido por `DoseSyncWorker` (linha 92) e `AlarmScheduler.scheduleDoseAlarm` fallback (linha 116)
- `dosy_user_prefs.critical_alarm_enabled` — unificado #215, lido por `AlarmScheduler.scheduleDoseAlarm` primary (linha 108)

**Recomendação:** consolidar em `dosy_user_prefs` apenas. Migrar `DoseSyncWorker` pra ler do unificado. Remover write do legacy field em `CriticalAlarmPlugin.setSyncCredentials` (linha 188) e `setCriticalAlarmEnabled` (linha 243). Aceitável manter o namespace `dosy_sync_credentials` pros campos sensitive (refresh_token, anon_key, etc), só remover o campo redundante.

### 2.7 JS (`src/services/notifications/` + `src/services/criticalAlarm.js`)

#### Funções exportadas sem callers

| Arquivo | Símbolo | Motivo |
|---------|---------|--------|
| `services/criticalAlarm.js` linha 28 | `scheduleCriticalAlarm` (single-dose) | Nunca importada. Todos chamam `scheduleCriticalAlarmGroup`. **Pode deletar** + Java method correspondente. |
| `services/criticalAlarm.js` linha 117 | `isIgnoringBatteryOptimizations` | Nunca importada (PermissionsOnboarding usa `checkAllPermissions` que retorna `ignoringBatteryOpt`). **Pode deletar**. |
| `services/criticalAlarm.js` linha 170 | `updateAccessToken` | Nunca importada (useAuth usa setSyncCredentials inline). **Pode deletar** + Java method. |
| `services/notifications/channels.js` linha 115 | `cancelGroup` | Nunca importada externamente. Comentário menciona "Fluxo padrão usa cancelGroup()" mas nada chama. **Pode deletar**. |
| `services/notifications/channels.js` linha 131 | `loadScheduledState` | Exportada mas nunca importada (apenas `saveScheduledState` + `clearScheduledState` usadas). **Pode deletar**. |
| `services/notifications/auditLog.js` linha 80 | `logAuditEvent` (singular) | Exportada mas nunca importada (apenas `logAuditEventsBatch` usado). **Pode deletar**. |
| `services/notifications/auditLog.js` linha 21 | `_resetAuditCache` | Test helper, sem testes. Pode manter ou remover. |
| `services/notifications/index.js` linhas 35-38 | Re-exports `inDnd, cancelAll, rescheduleAll, subscribeFcm, unsubscribeFcm` | Nenhum caller externo (todos usam via `useNotifications` hook). Comentário linha 34 diz "back-compat". **Pode deletar re-exports e simplificar imports.** |

#### Constantes potencialmente mortas

| Arquivo | Símbolo | Análise |
|---------|---------|---------|
| `services/notifications/prefs.js` linha 19 | `CHANNEL_ID = 'doses_v2'` | Usado em channels.js linha 48 (ensureChannel cria canal legado). Canal DELETADO por MainActivity. Loop deleta-cria. **Remover both export + ensureChannel para `doses_v2`**. Daily summary usa TRAY_CHANNEL_ID — não depende. |

#### Service Worker (`public/sw.js`)

- Web push path. Comentário "MedControl 💊" — antigo nome do app (linha 73, 156). **Cosmético** — branding stale.
- Sem callers FCM (não usado em Android). Mantido pra web admin.

### 2.8 Docs

| Arquivo | Status |
|---------|--------|
| `docs/alarm-scheduling-shadows.md` | **Obsoleto** (descreve arquitetura pré-v0.2.3.0 com `dose_alarms_scheduled`, `dose_notifications`, `schedule-alarms-fcm`, `notify-doses`). Substituído pela auditoria FUNDO. **Mover pra `docs/archive/`** ou atualizar pra arquitetura atual. |

---

## 3. Itens NÃO Mortos (verificados, mantém)

Listo aqui pra registro — todos aparentaram suspeitos em algum momento da varredura mas têm caller confirmado:

- `groupByMinute`, `enrichDose`, `filterUpcoming`, `inDnd`, `loadPrefs`, `savePrefs`, `doseIdToNumber`, `urlBase64ToUint8Array`, `VAPID_PUBLIC_KEY`, `DAILY_SUMMARY_NOTIF_ID`, `SCHEDULE_WINDOW_MS` (em prefs.js) — todos usados em scheduler.js / fcm.js / unifiedScheduler.js
- `saveScheduledState`, `clearScheduledState`, `TRAY_CHANNEL_ID`, `TRAY_DND_CHANNEL_ID`, `cancelAll`, `ensureChannel`, `ensureFcmChannel` (em channels.js) — todos usados
- `scheduleCriticalAlarmGroup`, `cancelCriticalAlarm`, `cancelAllCriticalAlarms`, `checkCriticalAlarmEnabled`, `checkAllPermissions`, `openExactAlarmSettings`, `openFullScreenIntentSettings`, `openOverlaySettings`, `openAppNotificationSettings`, `requestIgnoreBatteryOptimizations`, `setSyncCredentials`, `clearSyncCredentials`, `setCriticalAlarmEnabled`, `syncUserPrefs`, `getDeviceId` (em criticalAlarm.js) — todos usados
- `rescheduleAll`, `rescheduleAllWeb` (em scheduler.js) — usados via App.jsx + Settings + fcm.js subscribeWebPush
- `subscribeFcm`, `unsubscribeFcm`, `bindFcmListenersOnce` (em fcm.js) — usados via useNotifications hook
- `logAuditEventsBatch` (auditLog.js) — usado em scheduler.js
- `useNotifications` (index.js) — usado em App.jsx + Settings
- `useUserPrefs`, `useUpdateUserPrefs`, `DEFAULT_PREFS` (useUserPrefs.js) — usados em Settings
- `mutationRegistry.confirmDose/skipDose/undoDose/...` — usados via TanStack defaults
- Java `AlarmReceiver`, `AlarmService`, `AlarmActivity`, `AlarmActionReceiver`, `BootReceiver`, `DoseSyncWorker`, `DosyMessagingService`, `TrayNotificationReceiver`, `AlarmAuditLogger`, `AlarmScheduler`, `CriticalAlarmPlugin` — todos referenciados em AndroidManifest.xml + MainActivity

---

## 4. Recomendação de Cleanup

Ordeno por **win-to-risk ratio**. Pode aplicar em **uma única branch `chore/dead-code-cleanup`** sem afetar funcionalidade:

### Bloco 1 — Edge functions deprecated (zero risk, alto win)

```bash
supabase functions delete notify-doses
supabase functions delete schedule-alarms-fcm
rm -rf supabase/functions/notify-doses
rm -rf supabase/functions/schedule-alarms-fcm
```

### Bloco 2 — DB cleanup (baixo risk)

Nova migration `20260513XXXXXX_drop_dose_notifications_orphan.sql`:

```sql
-- Drop tabela dose_notifications órfã pós-#209 (notify-doses-1min unscheduled).
DROP TABLE IF EXISTS medcontrol.dose_notifications CASCADE;

-- Garantir cron notify-doses-1min unscheduled (idempotente).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-doses-1min') THEN
    PERFORM cron.unschedule('notify-doses-1min');
  END IF;
END $$;
```

### Bloco 3 — JS dead exports (zero risk)

- Deletar 6 exports JS órfãos (vide tabela 2.7)
- Deletar re-exports inúteis em `services/notifications/index.js`
- Deletar `CHANNEL_ID = 'doses_v2'` + ensureChannel branch correspondente

### Bloco 4 — Java dead code (baixo risk)

- Deletar `CriticalAlarmPlugin.schedule` (single-dose method)
- Deletar `CriticalAlarmPlugin.updateAccessToken` method
- Deletar `AlarmActionReceiver.NOTIF_ID_OFFSET` + cancel line 44
- Limpar 4 imports não usados em `AlarmScheduler.java`
- Migrar `AlarmReceiver.CHANNEL_ID` fallback path para usar `dosy_tray` em vez de `doses_critical_v2` (eliminar loop deleta-cria)
- Atualizar 4 comentários estale

### Bloco 5 — SharedPreferences consolidation (médio risk, requer teste)

- Consolidar `critical_alarm_enabled` em `dosy_user_prefs` apenas
- Migrar `DoseSyncWorker` pra ler de `dosy_user_prefs`
- Remover write redundante em `CriticalAlarmPlugin.setSyncCredentials` + `setCriticalAlarmEnabled`
- Testar fluxo toggle Critical Alarm OFF + DoseSyncWorker rodada subsequente

### Bloco 6 — Docs (zero risk)

- `mv docs/alarm-scheduling-shadows.md docs/archive/` OU atualizar conteúdo
- Atualizar `contexto/CHECKLIST.md` removendo refs a `dose_alarms_scheduled`, `notify-doses`, etc.

---

## 5. Conclusão

**Não há arquivo morto inteiro no sistema alarme/push.** Existe ruído: 23 itens entre exports, constantes, imports, comentários e canais inconsistentes. **Nenhum item causa bug ativo**, mas o ruído dificulta a auditoria FUNDO e mascara o real fluxo dos caminhos.

**Recomendo aplicar Blocos 1-4 antes do Plano A da auditoria FUNDO.** Reduz a superfície de leitura em ~15% e torna o refactor M2→M3 mais fácil de raciocinar. Blocos 5-6 podem ficar pra hotfix v0.2.3.1.

**Estimativa:** 1.5-2h para Blocos 1-4 + 1 build/test + commit. Sem risco material — todos os símbolos foram verificados sem callers.
