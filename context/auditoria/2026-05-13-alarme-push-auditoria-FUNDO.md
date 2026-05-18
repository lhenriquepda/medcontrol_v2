# Auditoria FUNDO — Sistema Alarme + Push (release v0.2.3.0 / #215 TURNAROUND)

**Data:** 2026-05-13 — pós device-validation S25 Ultra com múltiplas falhas
**Branch:** `release/v0.2.3.0`
**Motivo:** Após o refactor #215 (unified scheduler 3-cenários), nenhuma validação manual passou na primeira tentativa. Cada bug consertado expôs o próximo. Esta auditoria não procura mais micro-bugs — vai atrás dos **root causes arquiteturais**.

---

## Sumário Executivo

O sistema tem **5 caminhos independentes** que agendam ou disparam notificações de dose, e **3 caminhos independentes** que cancelam. Eles convergem nos mesmos IDs Java/AlarmManager mas **usam mecanismos de tray diferentes**, com paridade frágil. Quase todos os bugs validados estão na **interseção de dois caminhos** (race condition, dupla agenda, cancelamento incompleto), não dentro de um caminho isolado.

A correção tem que ser **arquitetural** (consolidar caminhos), não cosmética (mais flags / mais fixes pontuais). Senão, todo bug novo vai gerar 1-3 fixes em cadeia (padrão observado nessa validação).

**Recomendação principal:** unificar tudo num único caminho (Plano A abaixo). Mantém defense-in-depth no nível do scheduling (3 fontes podem agendar) mas **um único mecanismo de fire** (Java AlarmManager para TODOS alarmes E TODAS notificações tray).

---

## 1. Mapa Arquitetural Real

### 1.1 Fontes de scheduling (5 caminhos)

| # | Caminho | Onde mora | Trigger | Quem chama |
|---|---------|-----------|---------|------------|
| C1 | **JS foreground rescheduleAll** | `src/services/notifications/scheduler.js` | `useEffect` em `App.jsx` (deps: `dosesSignature`, `patientsSignature`, `user`) | App.jsx + Settings.updateNotif |
| C2 | **JS mutationRegistry → invalidate → C1** | `src/services/mutationRegistry.js` | `confirmDose`/`skipDose`/`undoDose`/CRUDs disparam cache patch → signature muda → C1 fire | TanStack Query |
| C3 | **DB trigger → Edge `dose-trigger-handler`** | `supabase/migrations/...notify_dose_change` + `supabase/functions/dose-trigger-handler` | INSERT/UPDATE/DELETE em `medcontrol.doses` → `pg_net.http_post` → Edge → FCM data | Postgres trigger |
| C4 | **Edge `daily-alarm-sync` cron 5am** | `supabase/functions/daily-alarm-sync` | `pg_cron` diário 8am UTC | Cron job |
| C5 | **Java `DoseSyncWorker` periodic 6h** | `android/.../DoseSyncWorker.java` | `WorkManager.PeriodicWorkRequest 6h` | Android WorkManager |

**Conclusão:** 5 caminhos é defense-in-depth genuíno. C1+C2 cobrem app aberto. C3 cobre evento real-time. C4 cobre o dia inteiro (5am batch). C5 cobre app fechado + WorkManager bucket. Mantemos os 5.

### 1.2 Mecanismos de fire (TRÊS, e aí está o problema)

| Mecanismo | Mora em | Disparado por |
|-----------|---------|---------------|
| M1 | **Java `AlarmReceiver`** (alarme fullscreen + AlarmService MediaPlayer loop) | `AlarmManager.setAlarmClock()` em `AlarmScheduler.scheduleDose` |
| M2 | **Java `TrayNotificationReceiver`** (tray normal/DnD) | `AlarmManager.setExactAndAllowWhileIdle()` em `AlarmScheduler.scheduleTrayNotification` |
| M3 | **Capacitor `LocalNotifications`** (tray via plugin Capacitor) | `LocalNotifications.schedule()` chamado em `scheduler.js` |

**O problema:** quem chama qual?

| Caminho fonte | Usa M1? | Usa M2? | Usa M3? |
|---------------|---------|---------|---------|
| C1 (JS foreground) | ✅ via `CriticalAlarm.scheduleGroup` (apenas alarme) | ❌ **NUNCA** | ✅ via `LocalNotifications.schedule` (tray) |
| C2 (mutation → C1) | igual C1 | igual C1 | igual C1 |
| C3 (Edge → FCM → DosyMessagingService) | ✅ via `AlarmScheduler.scheduleDoseAlarm` | ✅ via `AlarmScheduler.scheduleDoseAlarm` | ❌ **NUNCA** |
| C4 (cron → FCM → DosyMessagingService) | igual C3 | igual C3 | igual C3 |
| C5 (Worker) | ✅ via `AlarmScheduler.scheduleDoseAlarm` | ✅ via `AlarmScheduler.scheduleDoseAlarm` | ❌ **NUNCA** |

**Resultado direto:** ao chegar a hora da dose, dependendo de qual caminho agendou por último, o tray vem de **M2** OU de **M3** — nunca dos dois ao mesmo tempo INTENCIONALMENTE, mas vem dos dois ao mesmo tempo SE houve agendamento dual (foreground agendou via M3, FCM chegou e agendou via M2, sem cancelar M3).

### 1.3 IDs e namespace

| ID | Range usado | Calculado por |
|----|-------------|---------------|
| `groupId` (alarmId) | `[0, 2^30-1]` (após fix 9574696) | hash determinístico `doseIdToNumber(sorted doseIds joined '|')` |
| `trayId` quando `alarm_plus_push` | `groupId + 2^30` | `groupId + BACKUP_OFFSET` |
| `trayId` quando `push_dnd` ou `push_critical_off` | `groupId` (sem offset) | direto |
| `FG_NOTIF_ID` (AlarmReceiver fallback) | `alarmId + 200_000_000` | hardcoded offset |
| `AlarmService FG notif` | `300_000_000` constante | hardcoded |
| `AlarmActionReceiver requestCode` | `alarmId * 10 + seq` (seq=1,2,3 pra ack/snooze/ignore) | derivado |
| `DAILY_SUMMARY_NOTIF_ID` | `999_000_001` | constante |
| `AlarmService TAP_NOTIF_OFFSET` | `200_000_000` | hardcoded |

**Pendente desde 9574696:** paridade Java↔JS estabelecida. Antes, hash divergia (Java sem `% MAX_INT`, JS com).

### 1.4 Stores de prefs (TRÊS namespaces)

| Namespace | Onde mora | Quem escreve | Quem lê |
|-----------|-----------|--------------|---------|
| `localStorage["medcontrol_notif"]` | navegador/WebView | `useUserPrefs.writeLocal` + `useAuth` listener (DB→cache) | `scheduler.js loadPrefs()` (no rescheduleAll) |
| `medcontrol.user_prefs` (DB, JSONB) | Postgres | `useUserPrefs.upsert` | Edge `getUserNotifPrefs` (C3+C4) + `DoseSyncWorker.fetchUserPrefs` (C5) |
| `SharedPreferences "dosy_user_prefs"` | Android | `CriticalAlarmPlugin.syncUserPrefs` + `setCriticalAlarmEnabled` | `AlarmScheduler.scheduleDoseAlarm` fallback se `prefsOverride==null` |
| `SharedPreferences "dosy_sync_credentials"` (legado namespace) | Android | `CriticalAlarmPlugin.setSyncCredentials` + `setCriticalAlarmEnabled` (legacy field) | `DoseSyncWorker` (decide skip), `AlarmAuditLogger` (deviceId) |

Após `setCriticalAlarmEnabled` ser chamado, o campo `critical_alarm_enabled` fica em DOIS namespaces (`dosy_user_prefs` e `dosy_sync_credentials.critical_alarm_enabled`). Após `syncUserPrefs`, só `dosy_user_prefs` é tocado. Eles podem ficar dessincronizados se uma chamada falhar.

---

## 2. Bugs Identificados — Por Severidade

### 🔴 P0 Architectural — Duplicate tray notification

**Sintoma observado:** 2 push notifications para a mesma dose (validação 22:13 e 22:20).

**Root cause:** dois mecanismos de tray (M2 e M3) podem coexistir agendados para o mesmo `groupId+BACKUP_OFFSET`. PendingIntents em AlarmManager usam `(requestCode, intent.component)` como chave de equivalência. M2 (`TrayNotificationReceiver.class`) e M3 (Capacitor `LocalNotificationReceiver.class`) são `Components` diferentes → DUAS PendingIntents distintas no AlarmManager → AMBAS disparam.

**Caminho de reprodução:**
1. Dose criada → C3 (Edge trigger) dispara FCM → DosyMessagingService → M1 + M2 agendados.
2. C1 (foreground useEffect) detecta `dosesSignature` mudar → `rescheduleAll` → `cancelAll`:
   - `cancelAllCriticalAlarms` cancela M1 ✅
   - (antes do fix 9574696) NÃO cancela M2 ❌ — agora cancela ✅
   - `LocalNotifications.cancel(pending)` cancela M3 (mas M3 ainda não foi agendado neste cenário, no-op) ✅
3. Depois `rescheduleAll` agenda novamente: M1 + M3.
4. Resultado: M2 (deixado vivo se cancelAll pré-fix) + M3 fire juntos.

**Fix 9574696 cobre o cenário direto** (overflow + cancelAll cancela M2). Mas **NÃO cobre o cenário inverso**:
1. C1 roda primeiro → M1 + M3 agendados.
2. C3 chega depois → `handleScheduleAlarms` → `AlarmScheduler.scheduleDoseAlarm` → M1 (replace, ok) + M2 (NOVO).
3. M3 continua agendado. M2 agora também.
4. Fire time: M2 + M3 dois trays.

**Conclusão:** o fix 9574696 alivia mas não resolve. O problema é arquitetural: **escolher M2 ou M3, não os dois**.

### 🔴 P0 Race — prefs payload vs SharedPrefs no fire time

**Sintoma observado:** alarme tocou com Critical Alarm OFF (validação 22:03), push chegou com som mesmo em DnD.

**Root cause:** `scheduleDoseAlarm` decide branch (`ALARM_PLUS_PUSH` vs `PUSH_DND` vs `PUSH_CRITICAL_OFF`) **uma vez**, no momento do agendamento. O alarme já vai pra `AlarmManager.setAlarmClock` com componentes (`AlarmReceiver.class` para fullscreen, ou `TrayNotificationReceiver.class` pra tray) já decididos. Se a pref mudar entre agendamento e fire, o branch antigo ainda dispara.

Exemplo concreto:
- t=0: dose agendada com prefs `criticalAlarm:true, dndEnabled:false` → branch `ALARM_PLUS_PUSH` → M1 agendado.
- t=+1h: user toggle Critical OFF.
- C1 dispara → `cancelAll` → cancela M1+M2. Re-agenda como `PUSH_CRITICAL_OFF` → só M3.
- t=+2h: dose dispara. ✅ correto.

Mas no caminho FCM:
- t=0: dose criada. Edge envia FCM com `prefs:{criticalAlarm:true,...}`. Java agenda M1+M2.
- t=+1h: user toggle Critical OFF. DB atualizada, mas FCM NÃO REFAZ. M1+M2 ficam agendados.
- t=+1h: `useUserPrefs.mutationFn` dispara `setCriticalAlarmEnabled` + `syncUserPrefs` em SharedPrefs. Também dispara C1 (Settings.updateNotif chama scheduleDoses).
- C1 cancelAll cancela M1+M2 (com fix 9574696) ✅
- C1 re-agenda PUSH_CRITICAL_OFF → M3.

Aqui funciona desde que C1 rode após o toggle. **Mas se o app estiver fechado** quando user mudar a pref (improvável mas possível via web admin), C1 NÃO roda. M1+M2 ficam agendados com pref velha. C5 (Worker) só roda a cada 6h e respeita o toggle skip OFF (return early). C3 não re-dispara porque DB doses não mudou (só user_prefs mudou).

**Brecha:** mudança de pref que não dispara INSERT/UPDATE em `doses` é invisível pros caminhos FCM/Worker. Só JS foreground refaz.

**Implicação prática limitada:** user toggla pref no app → app está aberto → C1 roda. Cenário web admin → mobile não tem app aberto na maioria do tempo → bug latente até C5 rodar e refazer com prefs atualizadas (até 6h). User vê alarme inconsistente até lá.

### 🔴 P0 — Cancelamento de grupo multi-dose

**Sintoma esperado (não verificado pois validação foi single-dose):** ao marcar Ciente em 1 dose de um grupo de 3 doses agendadas no mesmo minuto, o alarme do grupo continua ativo.

**Root cause:** `DosyMessagingService.handleCancelAlarms` recebe doseIds CSV (1 por vez no caso de status change), computa `idFromString(doseId)`. Mas o alarme foi agendado com `idFromString(sortedDoseIds.join('|'))`. Os hashes diferem para grupos com >1 dose.

Comentário no código (linhas 185-188) já reconhece a limitação ("conservador, individual aceito"). É P0 porque grupos multi-dose são **comuns** (mesmo paciente, múltiplos remédios no mesmo horário).

### 🟡 P1 — `signOut()` deleta push_sub mas race com listener

**Sintoma observado:** validação reportou logout vazando FCM (alarme chegando após logout).

**Root cause atual** (pós fix 663cdef): `signOut()` deleta `push_subscriptions` ANTES de `supabase.auth.signOut()`. Mas o listener `onAuthStateChange` ainda recebe SIGNED_OUT e tenta deletar de novo. Idempotente (já deletada), mas o listener pega `dosy_fcm_token` do localStorage. Se localStorage já foi limpo, `cachedToken=null` → no-op ✅.

Cenário restante: JWT revoked server-side (sem chamar signOut()). Listener fires SIGNED_OUT real (não-spurious por `getSession` returning null). Fix b4e879f garante delete forçado. ✅ coberto.

**Buraco residual:** se device perder a sessão por dias (cache acabou de renovar), JWT pode ainda estar válido localmente → listener nunca fires → push_subscription nunca limpa. Apenas signOut() explícito ou JWT revoke server-side limpa. **Mitigação atual:** quando user re-logar em outro device, RPC `upsert_push_subscription` deleta outras subscriptions pro mesmo deviceToken. Aceitável.

### 🟡 P1 — useUserPrefs queryFn idempotência

**Em `useUserPrefs.queryFn`:** cada vez que useUserPrefs query é re-fetched (mount de Settings, refetchOnWindowFocus, etc), dispara:
- `setCriticalAlarmEnabled` (escreve SharedPrefs)
- `syncUserPrefs` (escreve SharedPrefs)

Isso roda em paralelo. Ambos no mesmo thread, mas `SharedPreferences.apply()` é async. Pode haver write reorder. Probabilidade baixa (write único do mesmo valor), mas redundante.

**Sugestão:** unificar para uma chamada `syncUserPrefs` apenas, e remover `setCriticalAlarmEnabled` (legacy field). Reduz superfície.

### 🟡 P1 — `_optimistic`/`temp-` filter funciona, mas mascara um problema upstream

O fix em `filterUpcoming` (skip `_optimistic` ou `id.startsWith('temp-')`) resolveu o modal não abrir. Mas a **causa** é que `mutationRegistry.createTreatmentWithDoses.onMutate` cria doses com `temp-` IDs no cache. Quando esses temp IDs entram em `rescheduleAll` e são agendados em AlarmManager com hash(temp-id), o alarme nativo eventualmente dispara `MainActivity?openDoseIds=temp-...` → modal procura no cache, não encontra (temp já foi substituído por UUID real no `onSuccess`).

O filter é correto (não agendar enquanto otimista), mas idealmente o `rescheduleAll` aguardaria o flush do mutation. Hoje confia que temp doses não estarão futuras em <30s. Para usuários offline com criar tratamento → ir embora → conectar tarde → drain mutation → dose já passou: pode falhar. Edge case raro.

### 🟢 P2 — Throttle 30s pode atrasar cancelamento

`rescheduleAll` tem throttle 30s. Cenário: dose agendada para xx:00. User clica Ciente em xx:00:15. mutationRegistry patch cache → dosesSignature muda → `rescheduleAll` agendado em trailing 30s (mas `_lastRunAt` foi xx:00:00 quando alarme tocou e disparou re-render). Throttle salva trailing pra xx:00:30. Em paralelo, Edge dose-trigger-handler envia FCM cancel → Java cancela imediatamente. Throttle não causa duplicação visível, só atrasa convergência local. ✅ aceitável.

### 🟢 P2 — Battery optimization whitelist pode estar OFF

Plugin tem `requestIgnoreBatteryOptimizations` mas nada no boot/onboarding força check. User Samsung One UI 7 pode estar com app em bucket "restricted" → WorkManager periodic cancelado, AlarmManager `setAlarmClock` ainda funciona mas `setExactAndAllowWhileIdle` pode falhar silently. Fora do escopo deste bug, mas reforça que C5 não é confiável em todas as marcas.

### 🟢 P2 — Channel `doses_critical` cria em AlarmService.ensureChannel + também em AlarmReceiver.ensureChannel + também na cleanup MainActivity

Triplo `ensureChannel` no boot. Idempotente, mas indica que ninguém limpou após split de canais. Cosmético.

---

## 3. Cenários Reais — Tabela de Convergência

Para cada cenário, qual caminho fonte agenda primeiro e qual mecanismo dispara.

### 3.1 App aberto + dose criada via app (cenário 1.1)

| t | Evento | Mecanismo agendado |
|---|--------|---------------------|
| 0 | User clica "Criar tratamento" — mutationRegistry.onMutate cache patch (temp-id) | nenhum |
| 0+200ms | Server confirma, onSuccess substitui temp por UUID real, invalidate query | nenhum |
| 0+500ms | useDoses refetch retorna nova lista, dosesSignature muda | nenhum |
| 0+700ms | C1 useEffect rescheduleAll → cancelAll + agenda | **M1+M3** (foreground path) |
| 0+800ms | Em paralelo, DB INSERT → trigger → Edge dose-trigger-handler → FCM | (M1+M2 agendados após chegada FCM) |
| 0+2s | FCM chega → DosyMessagingService → AlarmScheduler.scheduleDoseAlarm | **M1 (replace) + M2 (NOVO)** |
| 0+3s | Estado final: M1 (replace, ok) + M3 + M2 todos agendados | ⚠️ |

**No fire time:** M1 dispara fullscreen ✅. M2 e M3 ambos disparam tray (na branch ALARM_PLUS_PUSH, M3 fica como backup pra M1). AlarmReceiver cancela M3 visível via `NotificationManagerCompat.cancel(alarmId + BACKUP_OFFSET)` mas M2 não é cancelado por AlarmReceiver. **Duplicate tray possível.**

### 3.2 App fechado + dose criada via outro device (cenário 1.2)

| t | Evento | Mecanismo agendado |
|---|--------|---------------------|
| 0 | DB INSERT (outro device) → trigger → Edge → FCM | nenhum |
| 0+2s | FCM chega no device alvo → DosyMessagingService (app fechado, JS dorme) | **M1 + M2** |

**No fire time:** M1 dispara fullscreen + M2 dispara tray. Único caminho. ✅ ok.

Quando app abrir depois:
- C1 useEffect roda quando user/doses carregam.
- C1 cancelAll cancela M1+M2 (após fix 9574696).
- C1 re-agenda M1+M3.
- Estado final: M1+M3.

⚠️ Se entre o cancel e o re-agendamento o app crashar/fechar, alarmes podem ficar vazios.

### 3.3 Toggle Critical Alarm OFF (cenário 230.1.3)

| t | Evento | Mecanismo agendado |
|---|--------|---------------------|
| 0 | User toca toggle | nenhum |
| 0+10ms | updatePrefsMut.mutateAsync → writeLocal + DB upsert + setCriticalAlarmEnabled + syncUserPrefs Java | SharedPrefs atualizadas |
| 0+50ms | Settings.updateNotif → scheduleDoses → C1 rescheduleAll | **M3 (push_critical_off branch)** após cancelAll |
| 0+100ms | cancelAll cancela M1+M2 (fix 9574696) + M3 antigo | limpo |
| 0+200ms | Re-agenda como push_critical_off → só M3 (id=groupId, sem offset) | **M3** |

**No fire time:** M3 dispara tray (Capacitor LocalNotifications, channel `dosy_tray`). ✅

**Cenário 230.1.3 falhou em 22:13 com 2 push duplicados.** Causa raiz: ANTES do fix 9574696, M2 ficava órfão pendente em AlarmManager (cancelAll não cancelava). Disparava junto com novo M3.

Com fix 9574696, cenário deveria funcionar. **Requer revalidação no device.**

### 3.4 DnD janela (cenário 230.2)

Mesma mecânica de 3.3 mas branch=push_dnd, channelId=dosy_tray_dnd. M3 fire com importance DEFAULT, sem som, vibração 200ms.

⚠️ Se FCM chegou antes do toggle DnD ON e agendou M1+M2 com prefs antigas (não-DnD), M1 (fullscreen com som) dispara mesmo em DnD. Race fix #215 (Edge envia prefs no payload) só funciona PARA NOVAS doses. Doses já agendadas ficam com a config antiga até C1 cancelar+reagendar.

### 3.5 Logout (cenário 230.5)

Verificado em validação 22:13. Fix b4e879f + 663cdef cobrem.

---

## 4. Root Causes Arquiteturais (Resumo)

### RC-1 — Trindade de mecanismos de tray (M2 + M3 coexistem)

**Origem:** o refactor #215 introduziu M2 (TrayNotificationReceiver) pra cobrir FCM-only path mas manteve M3 (Capacitor LocalNotifications) para foreground path. Lógica "AlarmReceiver cancela backup quando dispara OK" funciona dentro de um caminho mas não cross-caminho.

**Custo do bug:** todo cenário com FCM + foreground tem risco de duplicate.

**Como resolver:** ver Plano A ou Plano B na seção 5.

### RC-2 — Prefs distribuídas em 3 namespaces sem source-of-truth ao fire time

**Origem:** otimização de performance — Java não pode bater no DB cada vez que dispara, então cache em SharedPrefs. JS cache em localStorage para evitar fetch DB. DB é canônica.

**Custo do bug:** prefs mudam entre agendamento e fire time → branch decidido com pref velha. Doses agendadas via FCM antes do toggle mudam comportamento só após C1 rodar.

**Como resolver:** ver "Fix B" na seção 5.

### RC-3 — Hash de cancelamento incompatível com hash de scheduling para grupos multi-dose

**Origem:** scheduling usa `hash(sortedDoseIds.join('|'))`. Cancelamento por FCM (status change) recebe 1 doseId → `hash(doseId)`. Hashes não convergem.

**Custo do bug:** grupos multi-dose não cancelam pelo caminho FCM. Caminho C1 (foreground) re-agenda corretamente, mas só quando app aberto.

**Como resolver:** ver "Fix C" na seção 5.

### RC-4 — Defense-in-depth dos 5 caminhos sem coordenação

**Origem:** cada caminho foi adicionado independentemente (#081, #083.3, #209). Cada um agenda. Nenhum sabe se outro já agendou.

**Custo do bug:** alarmes idempotentes via mesmo ID, mas tray quebra (RC-1). Audit log conta múltiplas vezes por dose (`alarm_audit_log` inflado).

**Como resolver:** parte da Plano A.

---

## 5. Plano de Correção

Dois caminhos arquiteturais possíveis. **Recomendação: Plano A.**

### Plano A — Unificar tray em M2 (Java TrayNotificationReceiver)

**Mudança:** scheduler.js para de chamar `LocalNotifications.schedule({notifications: [trayNotifPayload]})`. Em vez disso, chama um novo método do plugin `CriticalAlarm.scheduleTrayOnly({id, at, channelId, doses, ...})` que internamente chama `AlarmScheduler.scheduleTrayNotification` (M2). Para ALARM_PLUS_PUSH, scheduler chama `CriticalAlarm.scheduleGroup` (M1) + `CriticalAlarm.scheduleTrayOnly` (M2 backup).

**Resultado:** M3 some. Foreground e FCM/Worker convergem em M2.

**Wins:**
- RC-1 eliminado: 1 mecanismo de tray, IDs convergem em PendingIntent única.
- `AlarmReceiver.onReceive` pode cancelar M2 backup via PendingIntent.cancel diretamente (não NotificationManagerCompat.cancel que só limpa tray visível).
- Notificações persistem por boot via BootReceiver (M3 não persistia).
- Channel management em 1 lugar (Java).

**Custos:**
- Notification tap → MainActivity → CustomEvent JS. JÁ implementado em TrayNotificationReceiver ✅.
- LocalNotifications listeners (`localNotificationActionPerformed`, `localNotificationReceived`) em App.jsx param de fire para tray normal. **Refactor App.jsx pra ouvir `dosy:openDoses` CustomEvent em vez** (já implementado parcialmente pra alarme M1).
- DAILY_SUMMARY_NOTIF_ID continua via Capacitor LocalNotifications (M3) — daily summary não é dose, repete diariamente, é caso especial. Manter M3 só pra ele. OU migra também pra M2.
- BootReceiver atual só re-agenda M1 (alarme). Expandir pra M2 tray também (pendente, comentário linha 27-30 já reconhece TODO).

**Esforço:** ~300 LOC mudança. Branch isolada, dá pra fazer em 4-6h.

### Plano B — Unificar tray em M3 (Capacitor LocalNotifications)

**Mudança:** TrayNotificationReceiver some. DosyMessagingService FCM/Worker chama `LocalNotifications.schedule` via bridge JS? Não dá — eles rodam em Java background, JS dorme.

**Alternativa:** Java agenda diretamente via `LocalNotifications` API privada do plugin Capacitor (não exposta). Ou usa Capacitor LocalNotificationManager classes internas.

**Veredito:** **inviável**. Capacitor LocalNotifications é tipicamente JS-only no público. Implementar bridge custom é complexidade igual ou maior que Plano A.

### Plano C — Status quo + sempre-cancela-M2-antes-M3

**Mudança:** Antes de qualquer `LocalNotifications.schedule` em scheduler.js, chama `CriticalAlarm.cancelAllTrayBackups()` (novo método) que limpa todos M2 pending. Antes de qualquer `AlarmScheduler.scheduleTrayNotification`, cancela M3 correspondente.

**Veredito:** alivia mas não resolve. Race ainda existe. Adiciona complexidade. **Rejeitado.**

### Fix B — Source-of-truth de prefs ao fire time

**Mudança:** TrayNotificationReceiver (M2) e AlarmReceiver (M1) consultam SharedPrefs `dosy_user_prefs` no `onReceive`, ANTES de mostrar a notif. Se prefs mudaram para `criticalAlarm:false` desde agendamento → AlarmReceiver entrega de volta para TrayNotificationReceiver (re-rota). Se prefs mudaram para `dndEnabled:true` e está em janela → muda canal pra `dosy_tray_dnd`.

**Custo:** SharedPreferences read no broadcast onReceive (rápido, ~1ms). Aceitável.

**Win:** elimina RC-2 sem precisar re-agendar tudo quando prefs mudam.

### Fix C — Compositive cancellation para multi-dose

**Mudança:** Edge `dose-trigger-handler` na branch `cancel_alarms` faz lookup de TODAS doses do mesmo minuto+paciente. Envia FCM com `doseIds=CSV completo`. Java handleCancelAlarms reconstrói hash do grupo.

**Custo:** +1 query no Edge per cancel. Aceitável.

**Win:** elimina RC-3.

---

## 6. Quick Wins Imediatos (sem mudança arquitetural)

Pode aplicar agora, antes do Plano A:

1. **Validar fix 9574696 em device** — confirmar que cenário 230.1.3 funciona pós-fix. Se sim, P0 mais agudo está mitigado.
2. **`useUserPrefs.queryFn` dedupe** — remover `setCriticalAlarmEnabled` (legacy) e usar só `syncUserPrefs`. -1 superfície.
3. **`useAuth` listener sync prefs em UMA chamada** — atualmente lê DB + cache, decide, chama syncUserPrefs. Verificar que sempre roda antes do primeiro useEffect rescheduleAll. Talvez adicionar um `await` chain.
4. **Adicionar telemetria de duplicate** — `TrayNotificationReceiver.onReceive` checa se uma notif Capacitor com mesmo title+body acabou de disparar (within 5s). Se sim, suppress + log. Heurística temporária até Plano A.
5. **`signOut()` aguardar listener completar** — adicionar `await new Promise(r => setTimeout(r, 200))` após `supabase.auth.signOut()` pra dar tempo do listener limpar antes do `qc.clear()`. Cosmético.

---

## 7. Decisões Pendentes (para o usuário)

1. **Aplicar Plano A?** Esforço estimado 4-6h dedicadas. Reduz superfície de bugs drasticamente. Recomendo SIM antes de pôr o release v0.2.3.0 na Play Store. *(Se preferir não, manter status quo + fix 9574696 + revalidar)*

2. **Fix B (re-rota no fire time) — incluir junto com Plano A?** +1h. Vale a pena pra cobrir o cenário "user muda pref e doses já agendadas mantêm comportamento velho". *Recomendo SIM.*

3. **Fix C (multi-dose cancel)** — pode ficar pra v0.2.3.1 hotfix. Grupos multi-dose são caso raro (mesmo paciente, mesmo horário, múltiplos remédios). *Recomendo PRÓXIMA release.*

4. **Validação device antes ou depois do Plano A?** Se fizer Plano A primeiro, evita 2 ciclos de validação. Se quiser confirmar 9574696 antes (~10min teste 230.1.3), validamos primeiro e seguimos pro Plano A com base sólida. *Recomendo: rápido teste de 9574696, depois Plano A.*

---

## 8. Conclusão da Auditoria

O sistema de Alarme + Push **não é simples** — ele tem 5 caminhos de scheduling, 3 mecanismos de fire, 3 stores de prefs, e 3 caminhos de cancelamento. A complexidade é justificada pelo defense-in-depth healthcare (alarme NÃO PODE falhar). Mas a arquitetura atual permite que dois mecanismos co-existam para a mesma notificação, e isso é a fonte de praticamente todos os bugs que apareceram nesta validação.

A boa notícia: **a maioria dos componentes individuais está bem implementada**. Não tem bug grosso em nenhum arquivo isolado. O problema é nas **interfaces entre eles**.

**Plano A consolida tray em Java** (M2). Mantém os 5 caminhos de scheduling intactos, mas todos terminam no mesmo PendingIntent slot. Idempotência via ID determinístico volta a funcionar cross-source. **Recomendação forte.**

Pronto pra discutir tradeoffs e seguir.
