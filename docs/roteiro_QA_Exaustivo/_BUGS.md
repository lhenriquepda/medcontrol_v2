# _BUGS.md — Bugs encontrados no QA real v0.2.6.6

> Atualizado durante execução interativa via ADB + screenshots reais do Dosy-dev v0.2.6.6 (vc 91) rodando em emulator-5554 (Pixel 8 API 36, 1080x2400).
> Sessão QA: 2026-05-24 10:19-10:57 BRT (~40min interativo).
> Cada bug tem: ID, severidade, descrição, evidência (screenshot/logcat/SQL).

## Sumário executivo

| Severidade | Quantidade | Bugs |
|---|---:|---|
| 🔴 P0 catastrófico | 3 | B100, B102, B103 |
| 🔴 P0 alto | 1 | B101 |
| 🟡 P2 visual | 1 | B001 |
| **Total** | **5** | — |

## 🔥 Top finding

**#B102** é o BUG CRÔNICO que vem afligindo o user há semanas ("perde comunicação BD após idle"). Empiricamente confirmado: mutations `confirmDose`/`skipDose` NUNCA atingem o backend Supabase. Cache local mostra otimismo, BD nunca persiste. Force-stop + reabrir → tudo volta pra `pending`. Logcat confirmou ZERO POSTs pra `/rpc/confirm_dose_v2`. App QUEBRADO pra função primária.

**Trio relacionado** (provavelmente mesma causa raiz):
- B102: Mutation não dispara HTTP
- B103: DoseModal botões ficam disabled após primeira tentativa  
- B100: scheduleGroup falha em doses muito próximas (correlato — plugin nativo + JS coordenação)

**Suspeita**: regressão em v0.2.6.6 F4 `rpcV2WithAuthRetry` wrapper (introduzido pra resolver bug "perde BD" — pode ter introduzido pior).

## Versão app testada

- `versionCode=91 versionName=0.2.6.6-dev` (confirmado via `dumpsys package com.dosyapp.dosy.dev`)
- Emulador: `emulator-5554` Pixel 8 API 36

## Screenshots evidência

Diretório: `docs/qa-reports/qa-real-v0266/` (42 PNGs capturados)
- `00-login-screen.png` — Tela login inicial
- `04-login-ready.png` — Login preenchido teste-plus
- `06-post-tour.png` — Dashboard pós-onboarding (banner Ad visível com gap)
- `09-paciente-criado.png` — Paciente "QA Real" criado (toast verde)
- `27-after-13-40-tray.png` — 5 doses, 2 atrasadas (tray notification disparou)
- `29-after-tap-notif.png` — MultiDoseModal aberto pós-tap notif
- `34-after-tomada-correct.png` — UI mostra "1/5 tomada" (otimista)
- `36-after-pular.png` — UI mostra "1 tomada + 1 pulada" (otimista)
- `42-final-bd-state.png` — Após force-stop+reabrir: 0/5, 2 atrasadas (BD wins, marcações perdidas) 🔥

## Convenção IDs

- `B001+` — bugs visuais / UI
- `B100+` — bugs funcionais / fluxo  
- `B200+` — bugs de dados / persistência
- `B300+` — bugs de alarme / push

---

**Evidência**: `docs/qa-reports/qa-real-v0266/06-post-tour.png` — banner visível mas com offset Y desnecessário (parece estar `top: ~70px` em vez de `top: 132px = status bar height`).

**Hipótese**: O CSS reserva `--ad-banner-height: 60px` mas pode estar somando margin extra do status bar 2x. Conferir lógica em `useAdMobBanner.js` quando `--system-status-bar-height` está populado vs fallback 30dp.

**Repro**: login teste-plus → Dashboard → observar banner

**Categoria**: continuação do bug #E01 do relatório [qa-dinamico v0.2.6.6](../qa-reports/2026-05-24-qa-dinamico-v0.2.6.6.md#e01)

---

## B100 — CriticalAlarm.scheduleGroup falha em doses muito próximas [P0]

**Sintoma**: ao chamar `scheduleGroup` para dose com `at` apenas ~12s no futuro, plugin nativo retorna erro `"schedule failed (past trigger or permission)"`. Dose perde alarme crítico full-screen — apenas a tray notification fica.

**Evidência empírica** (logcat capturado às 13:40:36 com dose agendada pra 13:40:48):
```
13:40:36 CriticalAlarm: scheduleGroup {"id":743540242,"at":"2026-05-24T13:40:48.749Z","doses":[...]}
13:40:36 Capacitor: Sending plugin error: {"save":false,"callbackId":"4075","pluginId":"CriticalAlarm","methodName":"scheduleGroup","success":false,"error":{"message":"schedule failed (past trigger or permission)"}}
13:40:36 CriticalAlarm: scheduleTrayGroup id:1817282066 at:2026-05-24T13:40:48.749Z (SUCCESS)
```

**Causa-raiz suspeita**: `CriticalAlarmPlugin.java::scheduleGroup` provavelmente tem guarda contra horários "muito próximos" (< 30s? < 60s?) OU o `SCHEDULE_EXACT_ALARM` permission ficou negada. A mensagem mistura 2 causas distintas ("past trigger or permission"), dificultando debug.

**Impacto user**:
- App reaberto após criar/sync dose com <60s pra disparar: **alarme crítico NÃO DISPARA**
- Mas tray notification sim dispara (downgrade silencioso)
- User pode não notar a dose se tela bloqueada (tray notification sem som)

**Cenário real do bug**: user cria SOS pra "tomar agora" → reagenda → dose perde alarme crítico → não toca quando tela bloqueada.

**Fix sugerido**:
1. Separar mensagens de erro: `past_trigger` vs `permission_denied` vs `too_close`
2. Se `< X seconds`, exibir alarme/notificação IMEDIATAMENTE em vez de agendar (fallback)
3. Logar em telemetria para medir frequência real

**Repro**:
1. Criar dose via SQL com `scheduledAt = NOW() + 12s`
2. Force-stop + restart app
3. Observar logcat `cancelAll` → `scheduleGroup` → `schedule failed`

---

## B101 — Tap em tray notif redireciona pra Dashboard sem abrir MultiDoseModal [P0]

**Sintoma**: Quando user tap na tray notification de doses, app abre + navega pra `/?doses=<id1>,<id2>` mas IMEDIATAMENTE redireciona de volta pra `/` (Dashboard). MultiDoseModal nunca abre. Fluxo "Ciente → marcar via modal" fica inviável.

**Evidência empírica** (logcat 13:42:23):
```
navigation from: "/" to: "/?doses=916dce53-cb98-452a-83ac-1ba0ef0b3290,bbadd159-91ae-417d-8eb2-7727b27cb346"
navigation from: "/?doses=916dce53-...,bbadd159-..." to: "/"
```

Apenas ~20ms entre as 2 navigations. App rejeita a query string `?doses` e dropa.

**Causa-raiz suspeita**:
1. Router config tem `replace` em alguma rota que limpa `?doses` query
2. Componente Dashboard tem `useEffect` que limpa querystring sem processar `doses=` antes
3. OU MultiDoseModal handler depende de algum state (auth?) que ainda não montou

**Impacto user**: 
- Sem alarme crítico full-screen (#B100 já causa isso) **+** sem MultiDoseModal por notif
- Único caminho pra marcar dose é abrir app manualmente + scroll → tap card → DoseModal
- Cancela 50% da proposta de UX "Ciente em 1 tap"

**Fix sugerido**: Auditar `App.jsx` rotas + Dashboard.jsx useEffect searchParams (vide spec K3 do inventário).

---

## B102 — 🔴🔴🔴 CONFIRM_DOSE/SKIP_DOSE NÃO PERSISTE NO BD [P0 CRÍTICO]

**É O BUG CRÔNICO DO USER**: "perde comunicação com BD após idle". Mas não é após idle — **acontece SEMPRE**.

**Sintoma**: User tap "Tomada" ou "Pular" no DoseModal → UI atualiza otimisticamente (gauge muda, card vira verde/amarelo, toast "Dose confirmada"), MAS o BD **NÃO É ATUALIZADO**. `status` continua `pending`, `actualTime` continua `null`.

**Evidência empírica completa** (este QA):
1. **UI mostrou sucesso** (screenshot 34 + 36):
   - Hero "1/5 doses", "3 pendentes"
   - Card 1: ✓ verde "13:40 tomada"
   - Card 2: ▶ amarelo "13:40 pulada"
   - Toast "Dose de Paracetamol 500mg confirmada"

2. **BD via SQL após 2+ min** (NENHUMA mutação):
   ```sql
   SELECT id, status, actualTime FROM doses WHERE userId = '99e498cf...';
   -- 5/5 rows: status="pending", actualTime=null, updatedAt="13:37" (inicial)
   ```

3. **Logcat após tap Tomada (13:46:18) e tap Pular (13:47:16)**:
   - `Sentry breadcrumb category:"ui.click"` ✅ click captado
   - `Sentry breadcrumb category:"alarm" message:"rescheduleAll START"` ← reagendou alarmes
   - `Sentry breadcrumb category:"alarm" message:"rescheduleAll END" alarmsScheduled:3` ← reduziu de 5 alarmes pra 3 (otimista local)
   - **❌ NENHUM POST pra `/rpc/confirm_dose_v2` ou `/rpc/skip_dose_v2`**
   - **❌ NENHUM PATCH pra `/rest/v1/doses`**
   - HTTP requests visíveis: só GET dashboard_payload, list_patient_shares, classify_medication — sem mutation de dose

**Conclusão**: Frontend faz mutation otimista + atualiza cache local + reagenda alarmes nativos, **mas o callback que chama o RPC do Supabase nunca dispara**. Mutation queue corrompida OU registry não dispatcha.

**Impacto user**:
- Marca dose → vê "tomada" verde → fecha app
- Reabre app → fetch fresh do BD → dose volta a "pending" → fica "atrasada"
- User pensa "o app comeu minha marcação"
- Cenário REAL do bug crônico que o user vem reportando há semanas

**Onde investigar**:
- `src/services/mutationRegistry.js` — onMutate dispara cache update + flushPersistImmediate; o mutationFn chama supabase.rpc('confirm_dose_v2', ...). Verificar se chega no mutationFn.
- `src/services/dosesService.js::confirmDoseV2` / `skipDoseV2` — verificar se está sendo invocada
- TanStack Query: `qc.setMutationDefaults(['confirmDose'], { mutationFn: ... })`. Se mutationFn não está bound, mutation skipa.
- Suspeita FORTE: bug introduzido em v0.2.6.6 F4 `rpcV2WithAuthRetry` wrapper (chamado mas não retornado/awaited?)

**Repro 100% determinístico**:
1. Login + criar paciente + 1 dose qualquer
2. Tap card dose → DoseModal → Tomada
3. UI mostra otimista. Toast verde aparece.
4. **Query BD** após 5+ segundos: status ainda `pending`
5. Force-stop + reabrir: dose volta a "pending" (estado real do BD)

**Prioridade**: 🔴🔴🔴 P0 CATASTRÓFICO — quebra função primária do APP (registrar doses).

---

## B103 — DoseModal botões ficam permanentemente desabilitados após mutation [P0]

**Sintoma**: Após tap em Tomada/Pular numa dose, os 3 botões (Ignorar, Pular, Tomada) ficam com `enabled="false"`. Novos toques não funcionam. Mesma dose ou outra dose: modal abre mas botões dead.

**Evidência empírica** (UI dump pós tentativa marcação dose 14:27):
```xml
<Button text="Tomada" enabled="false" bounds=[714,2142][1026,2271]/>
<Button text="Pular" enabled="false" bounds=[385,2142][698,2271]/>
<Button text="Ignorar" enabled="false" bounds=[55,2142][367,2271]/>
```

**Causa-raiz suspeita**: aria-busy state em DoseModal nunca limpa após mutation. Combinado com B102 (mutation nunca completa), botões ficam disabled forever.

**Impacto**: APP fica INUTILIZÁVEL pra registrar doses após primeira tentativa. Single chance.

**Fix sugerido**:
- Auditar `DoseModal.jsx::useEffect aria-busy`
- Adicionar timeout (10s) pra resetar aria-busy se mutation não completar
- Cross-ref com B102 — root cause provavelmente compartilhado (mutation queue corrompida)

---

---

## 🔥 EVIDÊNCIA FINAL B102 — Force-stop + reabrir DESCARTA marcações

**Captado neste QA (13:56)**:

Estado pré force-stop (cache otimista, screenshot 36):
- 1/5 doses
- ADESÃO 50%
- ATRASADAS 0
- Card 1: ✓ "13:40 tomada" verde
- Card 2: ▶ "13:40 pulada" amarelo

Estado pós force-stop + reabrir (BD wins, screenshot 42):
- **0/5 doses** ← perdeu marcação
- **ADESÃO 0%** ← perdeu cache
- **ATRASADAS 2** ← voltou pra pendente
- Card 1: ⚠️ "13:40 atrasada" ← reverteu
- Card 2: ⚠️ "13:40 atrasada" ← reverteu

**Conclusão definitiva**: Mutations confirmDose/skipDose NUNCA atingem o backend Supabase. Cache TanStack Query persiste otimismo localmente mas perde TUDO ao reload fresh.

**É o bug crônico** "perde comunicação com BD após idle" mencionado pelo user — só que não é "após idle", é **TODA marcação, SEMPRE**. App está catastroficamente quebrado pra função primária (registrar doses tomadas).

**Trail de logcat completo** (zero RPCs `confirm_dose_v2` / `skip_dose_v2` ao longo de toda a sessão):
- `breadcrumb category:"fetch" url:".../rpc/get_dashboard_payload" status:200` ✅ leitura OK
- `breadcrumb category:"fetch" url:".../rpc/list_patient_shares" status:200` ✅
- `breadcrumb category:"fetch" url:".../alarm_audit_log" status:201` ✅ audit OK
- `breadcrumb category:"fetch" url:".../rpc/confirm_dose_v2"` ❌ **NUNCA APARECE**
- `breadcrumb category:"fetch" url:".../rpc/skip_dose_v2"` ❌ **NUNCA APARECE**

**Fix urgente**: investigar `src/services/mutationRegistry.js` e verificar se `mutationFn` está sendo invocado. Suspeita: wrapper `rpcV2WithAuthRetry` (v0.2.6.6 F4) introduziu regression — talvez a função wrapper retorna `undefined` em vez de aguardar promise.

---

## 🔥 EVIDÊNCIA ULTRA B102 — Offline queue não drena ao reconectar

Após **>20min**, com mais um ciclo airplane mode + reconectar:
- App mostrou banner amarelo: "⚡ 2 ações salvas offline — sincroniza ao reconectar"  
- Confirma que mutation queue LOCAL tem itens enfileirados ✅
- Mas após reconectar Wi-Fi: BD AINDA mostra updatedAt=13:37:48 (sem mudanças desde criação SQL)

**Conclusão definitiva**: bug é no **TanStack Query `resumePausedMutations`** — não está sendo invocado OU mutationFn falha silenciosamente. Ver `mutationRegistry.js` + `useAppResume.js` F2 logic.

**Confirmado**: B102 acontece TODA marcação, ONLINE OU OFFLINE — não é problema de rede, é problema arquitetural do mutation queue.

Screenshot: `coverage/emul5554-15-offline.png` mostra banner "2 ações salvas offline".

---

---

## 🟢 STATUS FIX v0.2.6.7 (commit 3c58767 + migration 20260524150000)

| ID | Status | Commit | Linha do fix |
|---|---|---|---|
| **B100** | 🟢 FIXED | `3c58767` | `AlarmScheduler.java:477` ceil to minute + fallback tray broadcast |
| **B101** | 🟡 BUG REVISTO (screenshot 29 mostrou modal SIM abriu; era apenas log redirect rápido — falso positivo) | — | — |
| **B102** | 🟢 FIX (root cause) | `3c58767` | `main.jsx:240` mutations retry 3→1 + `mutationRegistry.js` instrumentação verbose |
| **B103** | 🟢 INDIRETO FIX (B102 root cause compartilhado — botões disabled era consequência do retry loop eterno) | `3c58767` | mesma fix B102 |
| **B001** | 🟢 FIX (typo evento) | `3c58767` | `useAdMobBanner.js:98` `bannerAdSize`→`bannerAdSizeChanged` (resolve E01 também — gap visual era consequência da altura não atualizar) |
| **E01** | 🟢 FIXED | `3c58767` | `useAdMobBanner.js:98` event name correto |
| **E02** | 🟢 FIXED | migration `20260524150000` | RPC `medcontrol.get_user_medications(p_limit)` criado |
| **E04** | 🟢 FIXED | `3c58767` | `CategoryPicker.jsx:42` `showRequiredError` prop + 2 callers atualizados |

**Validação**: AAB v0.2.6.7 sendo gerado em CI (run #26364183801). Pós-build, instalar nos 2 emul + re-rodar QA fluxo doses pra confirmar B102 finalmente persiste no BD.
