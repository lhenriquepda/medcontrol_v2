# QA Report v0.2.3.13 — Plano A first-step disclaimer paciente compartilhado

Data: 2026-05-18
Emulator: Pixel8_Test (Android 14, debug APK vc 76)
Build: assembleDebug ✅ + compileDebugJavaWithJavac ✅
Edge deploy: dose-trigger-handler v26 + dose-fire-time-notifier v8

## Setup

| Item | Valor |
|---|---|
| Owner user (logado emulator) | teste-plus@teste.com — `99e498cf-...a328` |
| Cuidador share alvo | teste-free@teste.com — `41f4e02d-...bb16` |
| Paciente SHARED | Paciente Share LH `698a6240-...e9fe` (owner=teste-plus, share=teste-free) |
| Paciente UNSHARED | Paciente Unshared Test v13 `46128e76-...334d` (owner=teste-plus, sem shares — depois deletado) |
| Push subscription | android tokens `cS7p0L4sRxS8r0lf...` 17:54 + `c7QjiAYnTNmTZOo7...` 20:39 |

---

## Cenário D ✅ — shared + offline → disclaimer renderiza

Bug case principal: cuidador offline no momento do fire, dose pode ter sido marcada por outro cuidador.

Sequência:
- 20:19:02 INSERT dose Paracetamol Test v13 (500mg) pra paciente SHARED, scheduledAt=NOW+2min
- 20:19:04 FCM `schedule_alarms` recebido. `AlarmScheduler.scheduleDoseAlarm groupId=256092622 branch=ALARM_PLUS_PUSH count=1`
- 20:19:20 Airplane mode ON (`cmd connectivity airplane-mode enable`)
- 20:21:00 AlarmReceiver fires:
  ```
  AlarmReceiver: preCheck outcome=unverified online=false resolved=0 unknown=1 alarmId=256092622
  ```
- 20:21:00 AlarmService FG starts → AlarmActivity launches

Screenshot `C:/temp/scenario_d.png`:
- Heads-up notif: "🔔 ALARME Dosy ... · **Sem intern...** · now" + "Paracetamol Test v13 (500mg)"
- AlarmActivity banner âmbar destacado:
  - Título: "⚠️ CONFIRME ANTES DE MEDICAR"
  - Corpo: "Sem conexão com a internet pra checar se outro cuidador já registrou esta dose. Pergunte antes de medicar pra evitar dose duplicada."
- Posicionado entre subtitle "1 dose pra agora · 1 pessoa" e card da dose

**Resultado: PASSOU.** Pre-check rodou, detectou offline + cache vazio, disparou alarme COM disclaimer.

---

## Cenário C indireto ✅ — shared + online + pending → fire sem disclaimer

Captura acidental do branch `server_pending` por FCM redelivery após network back.

Sequência:
- 20:23:53 Force-stop app (limpar estado scenario D)
- 20:24:01 Airplane mode OFF (wifi back)
- 20:24:07 AlarmReceiver re-fires (FCM redelivery do dose D ainda pending):
  ```
  AlarmReceiver: preCheck outcome=server_pending anyPending=true resolved=0/1 alarmId=256092622
  ```
- AlarmService FG starts → AlarmActivity launches **SEM banner disclaimer**

**Resultado: PASSOU.** Pre-check HTTP funcionou online, server confirmou pending, fire normal sem disclaimer.

---

## Cenário A ✅ — paciente unshared → zero regressão

Sequência:
- 20:24:01 Network ON
- 20:24:01 INSERT dose Dipirona Unshared v13 (500mg) pra paciente UNSHARED, scheduledAt=NOW+90s
- 20:24:13 FCM `schedule_alarms` recebido. `AlarmScheduler.scheduleDoseAlarm groupId=755858507 branch=ALARM_PLUS_PUSH count=1`
- 20:25:00 AlarmReceiver fires
- **NENHUMA linha `preCheck` no log** — `collectSharedDoseIds` retornou vazio (isShared=false) → dispatchAlarm direto sem pre-check
- AlarmService FG starts (intent NÃO inclui flag unverifiedShared=true)

Screenshot `C:/temp/scenario_a.png` heads-up:
- "🔔 ALARME Dosy — Di... · **Toque pra a...** · 1m" (subtitle normal "Toque pra abrir", sem "Sem intern...")
- "Dipirona Unshared v13 (500mg)"
- **SEM `⚠️` prefix no título**, **SEM `(verificar)` suffix**

**Resultado: PASSOU.** Zero regressão: paciente NÃO shared mantém fluxo original sem pre-check + sem disclaimer.

---

## Cenário C-real ✅ — shared + cancel FCM antes do fire → alarme cancelado + cache populado

Bug case secundário: cuidador online, outro cuidador marca dose como done antes do fire → cancel_alarms FCM chega → alarme local cancelado preventivamente.

Sequência:
- 20:40:54 INSERT dose Amoxicilina C-real (500mg) pra paciente SHARED, scheduledAt=NOW+90s
- 20:40:56 FCM `schedule_alarms` recebido. `AlarmScheduler.scheduleDoseAlarm groupId=772134183 branch=ALARM_PLUS_PUSH count=1`
- 20:41:18 SQL UPDATE dose status='done' (dispara trigger `dose_change_notify_update_batch`)
- 20:41:24 FCM `cancel_alarms` recebido:
  ```
  AlarmScheduler: cancelled id=772134183
  DosyMessagingService: cancel_alarms: requested=1 cancelled=1
  ```
- Cache SharedPrefs `dosy_dose_status` escrito:
  ```xml
  <string name="status:940c26e3-fb4d-4ef7-b207-ce4444ff0a0e">cancelled</string>
  <long name="ts:940c26e3-fb4d-4ef7-b207-ce4444ff0a0e" value="1779136884612" />
  ```
- 20:42:36 (past fire time 20:42:00) — **NENHUMA linha AlarmReceiver no log** para este alarmId

**Resultado: PASSOU.** Cancel preventivo funcionou. Cache populado para defesa em profundidade (caso alarme re-agende via BootReceiver após reboot e mesma dose ainda esteja persistida).

---

## Cenário HTTP server=done ✅ — pre-check HTTP detecta dose já resolvida no server → cancela alarme

Testa o branch `server_all_resolved` do `runPreCheck` quando rede está OK mas o cancel_alarms FCM não chegou (simulado via trigger temporariamente desabilitado).

Sequência:
- 20:43:28 INSERT dose Ibuprofeno HTTP-done (400mg) pra paciente SHARED, scheduledAt=NOW+90s
- 20:43:30 FCM `schedule_alarms` recebido. `AlarmScheduler.scheduleDoseAlarm groupId=855204252 branch=ALARM_PLUS_PUSH count=1`
- 20:43:50 SQL `ALTER TABLE doses DISABLE TRIGGER dose_change_notify_update_batch; UPDATE doses SET status='done' WHERE id=...; ALTER TABLE ENABLE TRIGGER...`
- (Trigger desabilitado garante que cancel_alarms FCM NÃO foi enviado pra emulador)
- 20:44:01 AlarmReceiver fires (alarm time = 20:44:00 UTC):
  ```
  AlarmReceiver: preCheck outcome=server_all_resolved=1/1 alarmId=855204252
  AlarmScheduler: cancelled id=855204252
  AlarmScheduler: cancelDoseAlarmAndBackup groupId=855204252
  ```
- AlarmService NÃO inicia. AlarmActivity NÃO renderiza. Cache atualizado: `status:8832d6fb-...=done`.

**Resultado: PASSOU.** Pre-check HTTP confirmou status='done' no server, cancelou alarme antes de despertar device. NO disclaimer mostrado, NO interrupção. Defense-in-depth case mais crítico funcionando.

---

## Cenário E ⚠️ — cache hit offline → cancela via cache (code-reviewed apenas)

Branch `cache_all_resolved` do `runPreCheck`: HTTP fails AND cache local tem todas doses como não-pending → cancela alarme sem despertar UI.

**Tentativa E2E falhou** por restrição arquitetural do Android:
1. Para popular cache do AlarmReceiver, precisaria que o app processo lesse o XML fresh
2. SharedPreferences cacheia file em memória após first read — escrita externa via `run-as` não invalida cache in-memory
3. Para forçar reload precisaria force-stop o app
4. Mas `am force-stop` põe app em "stopped state" — AlarmManager broadcasts são bloqueados para apps em stopped state (Android 3.1+ security)
5. Resultado: alarme NÃO entrega no AlarmReceiver pós force-stop, impedindo o teste do branch

Tentativa observada:
- 20:47:19 INSERT dose Cetamina E (alarm scheduled id=76304851 at 20:49:00)
- 20:47:50 Write cache via run-as: `status:70b58712-...=cancelled`
- 20:47:53 Airplane mode ON + `am force-stop com.dosyapp.dosy.dev`
- 20:49:00 fire time — **broadcast bloqueado**, AlarmReceiver não dispara
- 20:49:54 relaunch app — ainda sem fire log para alarmId 76304851

**Code review confirmou correctness do branch** em `AlarmReceiver.java` linhas 268-280:
```java
SharedPreferences cache = ctx.getSharedPreferences("dosy_dose_status", Context.MODE_PRIVATE);
int resolvedFromCache = 0;
int unknown = 0;
for (String did : doseIds) {
    String cached = cache.getString("status:" + did, null);
    if (cached != null && !"pending".equalsIgnoreCase(cached)) resolvedFromCache++;
    else unknown++;
}
if (resolvedFromCache == doseIds.size()) {
    return new PreCheckOutcome(true, false, "cache_all_resolved=" + resolvedFromCache + " (offline)");
}
```

Lógica simétrica ao branch `server_all_resolved` (validado em HTTP server=done). Mesma chamada `cancelDoseAlarmAndBackup`. Diferença é só a fonte da verdade (HTTP vs cache).

**Em produção real**, o cenário E exercita-se quando:
- App processo reinicia (cancel cache file fica fresh in-memory)
- BootReceiver re-schedula alarme pós reboot a partir do `dosy_critical_alarms.scheduled_alarms` SharedPrefs
- Network está offline no momento do fire (sem 4G + sem wifi)
- Cache `dosy_dose_status` tem entry recente desse doseId

Exercitar isso requer device físico real com reboot + sequência manual. Diferido para validação no S25 Ultra.

**Resultado: BRANCH PROVADO CORRETO (code review), E2E DIFERIDO.**

---

## Cenário B — inferido por C-real + HTTP server=done

B = shared + online + pending → fire normal. C indireto cobriu este caminho (`preCheck outcome=server_pending → fire sem disclaimer`). Mesmo branch já validado.

---

## Conclusão

**5 dos 6 cenários do plano original validados em emulator com logs + screenshots**:

| Cenário | Status | Evidência |
|---|---|---|
| D — shared offline → disclaimer | ✅ E2E | preCheck=unverified + screenshot scenario_d.png |
| C-indireto — shared online pending → fire sem disclaimer | ✅ E2E | preCheck=server_pending |
| A — unshared → zero regressão | ✅ E2E | sem preCheck log + screenshot scenario_a.png |
| C-real — cancel FCM cancela alarme + escreve cache | ✅ E2E | cancel_alarms log + SharedPrefs verificado |
| HTTP server=done — preCheck HTTP cancela | ✅ E2E | preCheck=server_all_resolved=1/1 |
| E — cache hit offline cancela | ⚠️ code-reviewed | branch trivial linhas 268-280, simétrico HTTP path |

**Branch tests pendentes pra validação device físico**:
- E2E cenário E (cache hit offline) — requer reboot + sequência manual real
- Snooze 10min re-fire — requer aguardar 10 min real
- Multi-dose grouped alarm com isShared misto — não testado
- Comportamento Samsung One UI 7 / Xiaomi MIUI battery optimizers

**Edge functions deployadas e funcionando em produção**:
- `dose-trigger-handler` v26 — envia `isShared=true` por dose quando patient_shares match
- `dose-fire-time-notifier` v8 — envia `isShared='true'` (caregivers-only por definição)

FCM `schedule_alarms` para teste-plus emulator chegou em <3s consistentemente. FCM `cancel_alarms` em ~6s após SQL UPDATE.

**Pronto pra Internal Testing AAB**. Validação final em S25 Ultra real cobre os branches restantes (E, snooze, Samsung optimizers).
