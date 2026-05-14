# Alarm Scheduling — Sombras e Cobertura

> Documento de referência sobre como o agendamento de alarmes funciona no Dosy, com mapeamento explícito das sombras (períodos onde uma dose pode ficar sem alarme) e como cada uma é mitigada.
>
> Item #200 (release v0.2.1.5). Origem: investigação 2026-05-07 quando user reportou alarme não tocou às 20:00 BRT.

---

## Arquitetura geral (defense-in-depth)

O alarme de uma dose pode chegar ao usuário por **5 caminhos independentes**, cada um cobrindo um cenário diferente de falha do anterior:

| # | Caminho | Responsável | Trigger | Cobertura |
|---|---------|-------------|---------|-----------|
| 1 | DB trigger → FCM data → AlarmScheduler local | Edge Function `dose-trigger-handler` | INSERT/UPDATE em `medcontrol.doses` (Postgres webhook) | Dose criada/editada com `scheduledAt` < 6h. Real-time (<2s). |
| 2 | Cron sweep → FCM data → AlarmScheduler local | Edge Function `schedule-alarms-fcm` | pg_cron `0 */6 * * *` (a cada 6h) | Sweep doses pendentes próximas 30h. Recovery se trigger #1 falhou. |
| 3 | Cron push tray fallback | Edge Function `notify-doses` | pg_cron `* * * * *` (a cada 1min) | Janela [-1min, +advanceMins+1min]. Última linha defesa se #1 e #2 falharam. |
| 4 | rescheduleAll quando app abre | App.jsx useEffect + scheduler.js | Mudança de `user`, `allDoses`, `allPatients` | Reagenda local quando app retoma, baseado em cache TanStack. |
| 5 | WorkManager 6h Android | DoseSyncWorker (#081) | Android `WorkManager` periódico 6h | Background fetch REST direto se FCM falhou repetidamente. |

Todos os caminhos coordenam via tabela `medcontrol.dose_alarms_scheduled` (caminho 4 reporta) + `medcontrol.dose_notifications` (caminho 3 idempotência) pra evitar duplicação de notificação.

---

## Sombras identificadas

### Sombra A — Dose criada por outro device do mesmo user

**Cenário:** Device A (web ou tablet) cria uma dose. Device B (celular) está com app fechado e push_subscription tem FCM token expirado/UNREGISTERED.

**Caminhos cobrindo:**
- Caminho 1: tenta enviar FCM data pra Device B → fail UNREGISTERED → push_sub deletada → Device B não reagenda
- Caminho 2: próximo cron 6h envia FCM data pra Device B (mas push_sub foi deletada) → não chega
- Caminho 3 (notify-doses 1min): envia push tray quando dose entra na janela [-1min, +advance+1min] → chega via FCM se token OK; se token UNREGISTERED, push_sub é deletada e bug Device B perde alarmes

**Sombra real:** se Device B tem token expirado E user nunca reabriu app pra refazer push_subscription, alarmes ficam silenciados até user reabrir app no Device B. Mitigado parcialmente porque app abrir = `usePushNotifications.subscribe` re-cria push_sub com token novo + `rescheduleAll` (caminho 4) reagenda.

**Window:** indefinida até user reabrir app no Device B.

---

### Sombra B — Dose com `scheduledAt > 30h future`

**Cenário:** Cron `extend-continuous-treatments-daily` (jobid 2, schedule `0 4 * * *`) cria batch de doses 30 dias adiante diariamente.

**Caminhos cobrindo:**
- Caminho 1 (DB trigger): skip explicit `'beyond-cron-horizon'` se `scheduledAt > 6h` (otimização #139, evita ferrar egress com 100s de FCMs no batch insert)
- Caminho 2 (cron 6h): só pega doses até HORIZON_HOURS (30h após mudança #200)
- Caminhos 3-5: só ativam quando dose entra em janela <30h da scheduledAt

**Sombra real:** **NÃO É sombra real** — é design intencional. Doses 30+ dias adiante são reagendadas pelo cron 6h quando entram na janela 30h. Worst case: user nunca abre app + cron está atrasando = alarme reagendado dentro de 6h da scheduledAt.

---

### Sombra C — Cron `schedule-alarms-fcm` last run + dose criada entre crons

**Cenário:** Cron 18:00 UTC. Dose criada via UI 20:00 UTC com `scheduledAt = 22:00 UTC`.

**Caminhos cobrindo:**
- Caminho 1 (DB trigger): 2h < 6h → trigger dispara FCM data → device agenda local. **OK.**
- Caminho 4 (App.jsx useEffect): se app aberto quando dose foi criada, `allDoses` mudou via mutate → useEffect dispara → rescheduleAll local. **OK.**

**Sombra real:** **NÃO É sombra real** se DB trigger funcionar. Multi-redundância garante.

**Worst case:** trigger DB fail (rede flap, Edge Function down) E app fechado E cron 6h longe. Próximo cron (até 6h) recupera. Caminho 3 (notify-doses 1min) também cobre se dose entrar em janela <5min.

---

### Sombra D — Reinstalação ou upgrade do APK

**Cenário:** User instala vc N+1 substituindo vc N. Android limpa AlarmManager pending (comportamento nativo).

**Caminhos cobrindo:**
- Caminho 4 (App.jsx useEffect): primeira abertura pós-install dispara `rescheduleAll` quando user logar + doses carregarem. **#198 (v0.2.1.5)** detecta install fresco via `dosy_last_known_vc` e log warning.
- Caminho 2 (cron 6h): próximo cron envia FCM data + reagenda. Worst case 6h após install.
- Caminho 3 (notify-doses 1min): cobre push tray no minuto da dose se AlarmScheduler não conseguiu agendar local.

**Sombra real:** **mitigada por #198** — janela vazia entre install e primeiro login eliminada pelo guard `dosesLoaded && patientsLoaded`. AlarmManager começa vazio mas reagenda assim que doses carregam.

**Window:** ~200-2000ms entre login e doses TanStack carregarem (irrelevante).

---

### Sombra E — Device offline quando FCM enviado

**Cenário:** Cron envia FCM data pra device. Device offline (no service, modo avião). FCM tem retry 28 dias mas pode atrasar.

**Caminhos cobrindo:**
- Caminho 4 (App.jsx useEffect): app abrir = `rescheduleAll` reagenda local com base em cache local.
- Caminho 3 (notify-doses 1min): se dose entra na janela quando device voltar online, push tray entrega.

**Sombra real:** dose só agenda quando device volta online. Worst case: device offline 5h durante uma dose 20:00 → alarme local não foi agendado pra 20:00. Quando device volta às 21:00, AlarmManager local não tem entry pra 20:00 (que já passou). Caminho 3 push tray pode entregar atrasado se dose ainda < 5min anterior à janela atual.

**Window:** dose perdida se device permaneceu offline durante a janela de tolerância.

---

### Sombra F — Trigger DB webhook falhou (Edge Function down, rede flap)

**Cenário:** Postgres webhook chama `dose-trigger-handler` pra dose criada, mas Edge Function retorna 500 ou timeout.

**Caminhos cobrindo:**
- Postgres webhook **NÃO faz retry** automático — se falha, falha
- Caminho 2 (cron 6h): próximo cron pega
- Caminho 3 (notify-doses 1min): pega quando dose entrar na janela <5min

**Sombra real:** até 6h até próximo cron OU até a dose entrar em janela <5min (caminho 3 cobre).

**Window:** ~6h worst case. Mitigado por #197 (notify-doses 1min) que reduz pra ~1min de tolerância.

---

### Sombra G — SIGNED_OUT spurious deleta push_subscription (RESOLVIDO em #195/#196)

**Cenário:** Network glitch dispara `SIGNED_OUT` no Supabase JS. Listener `useAuth.onAuthStateChange` deletava push_subscription do device. Próximo cron `schedule-alarms-fcm` lia push_subs filtradas por `deviceToken IS NOT NULL` → device atual ausente → FCM não enviado → AlarmScheduler local não reagenda.

**Status:** **resolvido em release v0.2.1.5** via:
- **#195** — DELETE push_sub só em logout explícito (flag `dosy_explicit_logout`)
- **#196** — listener ignora SIGNED_OUT spurious (valida com `getSession()` se ainda há session local válida)

---

## Cobertura combinada por sombra

| Sombra | Caminho 1 | Caminho 2 | Caminho 3 | Caminho 4 | Caminho 5 | Status |
|--------|-----------|-----------|-----------|-----------|-----------|--------|
| A — outro device offline | ✗ | ✗ | ✓ (parcial) | ✓ no reabrir | ✓ | Mitigada |
| B — dose >30h | ✗ design | ✓ quando entra | ✓ quando entra | ✓ no reabrir | ✓ | Não é sombra real |
| C — cron last run | ✓ | ✓ próximo | ✓ | ✓ | ✓ | Mitigada |
| D — reinstall APK | ✗ | ✓ próximo | ✓ | ✓ #198 | ✓ | Mitigada (#198) |
| E — device offline | ✗ | ✗ | ✓ ao voltar | ✓ ao voltar | ✓ ao voltar | Mitigada se voltar a tempo |
| F — trigger fail | ✗ | ✓ próximo | ✓ <5min | ✓ no reabrir | ✓ | Mitigada (#197 reduz pra <1min) |
| G — SIGNED_OUT spurious | ✗ | ✗ resolvido | ✗ resolvido | ✗ resolvido | ✗ | **Resolvida** (#195+#196) |

---

## Mudanças aplicadas em release v0.2.1.5

1. **#195** — `useAuth.signOut()` seta flag `dosy_explicit_logout` antes de chamar `supabase.auth.signOut()`. Listener `onAuthStateChange` SIGNED_OUT só deleta push_subscription se flag presente.
2. **#196** — Listener `onAuthStateChange` valida com `supabase.auth.getSession()` antes de processar SIGNED_OUT sem flag. Se session local ainda válida = spurious, ignora event completo.
3. **#197** — Cron `notify-doses-1min` adicionado ao Postgres pg_cron. Edge Function redeployed com `verify_jwt: false` pra alinhar com schedule-alarms-fcm.
4. **#198** — `App.jsx` useEffect reschedule só dispara quando `dosesLoaded && patientsLoaded` (TanStack `isSuccess`). Também detecta install/upgrade comparando `dosy_last_known_vc`.
5. **#200** — Cron `schedule-alarms-fcm-6h` HORIZON aumentou 24h → 30h. Sobreposição entre runs cresce de 4× pra 5×, cobertura adicional sem aumentar frequência.

## Ainda em backlog (próximas releases)

- **#200.1** — `rescheduleAll` idempotente (diff and apply ao invés de cancelAll-then-reschedule). Requer mudança no plugin nativo Android (`CriticalAlarm.listScheduled()`). Mitigaria caso de crash mid-reschedule. Defer pra v0.2.1.6+.
- **#067** — DosyMonitorService Xiaomi/OPPO/Huawei foreground service pra battery saver bypass. Backlog P2.
- **#199** — Cleanup automático push_subscriptions stale (deviceToken NULL > 30d). Backlog P2.

---

## Como debugar quando alarme não toca

1. **Verificar se dose existe e está pending:**
   ```sql
   SELECT id, "scheduledAt", status, "medName"
   FROM medcontrol.doses
   WHERE "scheduledAt" >= NOW() - INTERVAL '1h'
     AND "scheduledAt" <= NOW() + INTERVAL '1h'
     AND "userId" IN (SELECT id FROM auth.users WHERE email = 'X');
   ```

2. **Verificar push_subscription com deviceToken válido:**
   ```sql
   SELECT "deviceToken" IS NOT NULL as has_token, "createdAt"
   FROM medcontrol.push_subscriptions
   WHERE "userId" IN (SELECT id FROM auth.users WHERE email = 'X');
   ```

3. **Verificar prefs (criticalAlarm + DND):**
   ```sql
   SELECT prefs
   FROM medcontrol.user_prefs
   WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'X');
   ```

4. **Verificar logs Edge Functions:**
   - Painel Supabase → Edge Functions → `schedule-alarms-fcm` / `dose-trigger-handler` / `notify-doses` → Logs
   - Olhar se houve erro de envio FCM (UNREGISTERED, INVALID_ARGUMENT, 5xx)

5. **Verificar cron last runs:**
   ```sql
   SELECT j.jobname, MAX(jrd.start_time) as last_run, MAX(jrd.status) as status
   FROM cron.job j
   LEFT JOIN cron.job_run_details jrd ON jrd.jobid = j.jobid
   GROUP BY j.jobid, j.jobname;
   ```

6. **Verificar se dose foi notificada (idempotência):**
   ```sql
   SELECT * FROM medcontrol.dose_notifications
   WHERE "doseId" = '<dose-uuid>';
   ```
