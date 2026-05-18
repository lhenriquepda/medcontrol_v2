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
| Paciente UNSHARED | Paciente Unshared Test v13 `46128e76-...334d` (owner=teste-plus, sem shares) |
| Push subscription | android token `cS7p0L4sRxS8r0lf...` criada 17:54 |

## Cenário D ✅ — shared + offline → disclaimer

Sequência:
- 20:19:02 INSERT dose Paracetamol Test v13 (500mg) pra paciente SHARED, scheduledAt=NOW+2min
- 20:19:04 FCM `schedule_alarms` recebido. `AlarmScheduler.scheduleDoseAlarm groupId=256092622 branch=ALARM_PLUS_PUSH count=1`
- 20:19:20 Airplane mode ON (cmd connectivity airplane-mode enable)
- 20:21:00 AlarmReceiver fires:
  ```
  AlarmReceiver: preCheck outcome=unverified online=false resolved=0 unknown=1 alarmId=256092622
  ```
- 20:21:00 AlarmService FG starts → AlarmActivity launches

Screenshot `C:/temp/scenario_d.png` mostra:
- Heads-up notif: "🔔 ALARME Dosy ... · **Sem intern...** · now" + "Paracetamol Test v13 (500mg)"
- AlarmActivity banner âmbar com:
  - Título: "⚠️ CONFIRME ANTES DE MEDICAR"
  - Corpo: "Sem conexão com a internet pra checar se outro cuidador já registrou esta dose. Pergunte antes de medicar pra evitar dose duplicada."
- Posicionado entre subtitle "1 dose pra agora · 1 pessoa" e card da dose

**Resultado: PASSOU.** Pre-check rodou, detectou offline + cache vazio, disparou alarme com disclaimer.

## Cenário C indireto ✅ — shared + online + pending → fire SEM disclaimer

Sequência:
- 20:23:53 Force-stop app
- 20:24:01 Airplane mode OFF (wifi back)
- 20:24:07 AlarmReceiver re-fired (FCM redelivery do dose D anterior):
  ```
  AlarmReceiver: preCheck outcome=server_pending anyPending=true resolved=0/1 alarmId=256092622
  ```
- AlarmService FG starts → AlarmActivity launches **SEM banner disclaimer**

**Resultado: PASSOU.** Pre-check HTTP funcionou online, server confirmou status=pending, fire normal sem disclaimer.

## Cenário A ✅ — paciente unshared → sem disclaimer (regressão)

Sequência:
- 20:24:01 Network ON (post scenario D cleanup)
- 20:24:01 INSERT dose Dipirona Unshared v13 (500mg) pra paciente UNSHARED, scheduledAt=NOW+90s
- 20:24:13 FCM `schedule_alarms` recebido. `AlarmScheduler.scheduleDoseAlarm groupId=755858507 branch=ALARM_PLUS_PUSH count=1`
- 20:25:00 AlarmReceiver fires
- **NENHUMA linha `preCheck` no log** — `collectSharedDoseIds` retornou vazio (isShared=false) → dispatchAlarm direto sem pre-check
- AlarmService FG starts (intent NÃO inclui flag unverifiedShared=true)

Screenshot `C:/temp/scenario_a.png` mostra heads-up:
- "🔔 ALARME Dosy — Di... · **Toque pra a...** · 1m" (subtitle normal "Toque pra abrir", sem "Sem intern...")
- "Dipirona Unshared v13 (500mg)"
- **SEM `⚠️` prefix no título**, **SEM `(verificar)` suffix**

**Resultado: PASSOU.** Zero regressão: paciente NÃO shared mantém fluxo original sem pre-check + sem disclaimer.

## Cenário B/E — inferidos por code review

- **B (shared+online+pending)**: idêntico ao C indireto observado acima — preCheck HTTP retorna server_pending → fire sem disclaimer.
- **E (shared+offline+cache=cancelled)**: code path `runPreCheck` → HTTP fail → cache lookup → todas resolved → `outcome=cache_all_resolved` → `AlarmScheduler.cancelDoseAlarmAndBackup` → alarme cancelado.

Code review confirma branches corretas em `AlarmReceiver.runPreCheck` linhas 217-280. Validação E e2e demandaria popular SharedPrefs `dosy_dose_status` manualmente — diferido próxima iteração ou validação em device físico via FCM cancel real.

## Conclusão

3 cenários core validados emulator + Appium + Supabase MCP:
- ✅ D: shared offline disclaimer renderizou
- ✅ C-indireto: shared online HTTP OK fire sem disclaimer
- ✅ A: unshared zero regressão sem pre-check

Branches B/E cobertos por inspeção de código (paths simétricos a C/D).

Pronto pra build AAB pós-aprovação user (Passo 10.5 STOP obrigatório).
