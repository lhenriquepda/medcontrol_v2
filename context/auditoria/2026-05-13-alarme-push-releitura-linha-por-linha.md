# Auditoria 3 — Releitura LINHA-POR-LINHA Sistema Alarme + Push

**Data:** 2026-05-13 (terceira passada — releitura exaustiva)
**Escopo:** ler o código completo dos arquivos que afetam scheduling/fire/cancel, **não só símbolos com nome óbvio**. Procurar comportamento que muda push/alarme escondido em hooks de UI, side-effects, mutations, listDoses, recomputeOverdue, etc.

---

## 1. Sumário

A primeira/segunda auditoria pegaram **a aresta visível** (símbolos com nome `alarm`, `push`, `notification`). Esta terceira passada examinou cada `useEffect`, `onMutate`, `onSettled`, `setQueryData`, recomputeOverdue, throttle, debounce, biometric lock e cada ponto onde **o cache de doses muda** — porque qualquer mudança em `dosesSignature` dispara `scheduleDoses → rescheduleAll`.

**Achados:**
- **5 novos pontos críticos** (P0/P1) que afetam scheduling sem usar a palavra "alarm"/"push" no código.
- **3 novos itens de código morto** (analytics EVENTS órfãs).
- **Confirmação** de que o problema é arquitetural (consistente com auditoria FUNDO), e não há mais bugs ocultos em arquivos isolados.

---

## 2. Novos Achados Críticos (P0/P1)

### 🔴 A-01 — `listDoses` recomputa `overdue` no cliente → invalida `dosesSignature` toda hora

**Arquivo:** `src/services/dosesService.js` linhas 79-83.

```js
const now = new Date()
let rows = (data || []).map((d) => {
  if (d.status === 'pending' && new Date(d.scheduledAt) < now) return { ...d, status: 'overdue' }
  return d
})
```

**Comportamento:** cada chamada `listDoses` retorna doses com `status='overdue'` recomputado dinamicamente quando passa do horário. No DB elas continuam como `'pending'`.

**Impacto em scheduling:**
- `dosesSignature` em App.jsx (`${d.id}:${d.status}:${d.scheduledAt}`) **MUDA** assim que uma dose passa do horário.
- `App.jsx useEffect` dispara → `scheduleDoses` → `rescheduleAll` → `cancelAll + reschedule` da janela inteira.
- Throttle 30s alivia, mas se 5 doses passam do horário no mesmo minuto (típico — usuário com várias doses 8h da manhã), elas geram **5 disparos rapidamente consecutivos**, todos throttled exceto o último.

**Bug latente:** se device está sem internet e useDoses não consegue refetch, recomputeOverdue ainda roda no cache em cada listDoses call. Cada call gera new array reference. TanStack structural sharing nivela se valor === antigo, mas como `status` mudou, ref é nova → signature flip mesmo offline.

**Severidade:** baixa em si (é correto recomputar), mas é fonte oculta de invalidate que ninguém pensa quando debuga storm de scheduling.

### 🔴 A-02 — `pauseTreatment` / `endTreatment` deleta doses em batch → trigger DB fires N vezes → spam Edge

**Arquivo:** `src/services/treatmentsService.js` linhas 92-112 (cancelFutureDoses).

```js
const { error } = await supabase
  .from('doses')
  .delete()
  .eq('treatmentId', treatmentId)
  .eq('status', 'pending')
  .gt('scheduledAt', nowIso)
```

**Comportamento:** quando user pausa ou encerra um tratamento, todas doses futuras `pending` são deletadas em um único `DELETE FROM`. Postgres trigger `dose_change_notify` dispara **por linha** (`FOR EACH ROW`).

**Impacto:**
- Tratamento contínuo de 90 dias × 4 doses/dia = **360 doses deletadas** = 360 fires de trigger.
- Cada fire chama `pg_net.http_post` → Edge `dose-trigger-handler`.
- Edge processa cada um, busca push_subscriptions, manda FCM `cancel_alarms` com 1 doseId.
- Device recebe 360 FCM messages em rajada (FCM rate limit ~1 msg/sec/device pode descartar muitas).
- **Cada FCM cancel_alarms** chama `AlarmScheduler.cancelDoseAlarmAndBackup(idFromString(doseId))` — mas o alarme original foi agendado com `idFromString(sortedDoseIds.join('|'))` para grupos multi-dose. **Cancelamento misses para multi-dose groups.**

**Severidade:** P0 para usuários com tratamentos longos.

**Mitigação:** mudar `cancelFutureDoses` para usar UPDATE status (não DELETE). Trigger dedup já em vigor (migration 20260513213000) filtra `UPDATE pending→non-pending` mas isso passa pelo Edge ainda. Melhor: batch RPC server-side que envia 1 FCM com array de doseIds em vez de N FCMs.

### 🔴 A-03 — Snooze do alarme NÃO persiste em SharedPreferences → perde em reboot

**Arquivo:** `android/.../AlarmActionReceiver.java` linhas 70-93 (scheduleSnooze) + `AlarmActivity.java` linhas 729-749 (scheduleSnooze).

```java
am.setAlarmClock(new AlarmManager.AlarmClockInfo(snoozeAt, showPi), firePi);
```

**Comportamento:** quando user clica "Adiar 10min", o alarme é re-agendado direto via `AlarmManager.setAlarmClock`. **NÃO chama `AlarmScheduler.persistAlarm`**, então o triggerAt antigo permanece em SharedPreferences `dosy_critical_alarms`.

**Impacto:**
- Se device reiniciar nos 10 minutos seguintes, `BootReceiver.onReceive` lê SharedPreferences → vê triggerAt antigo → re-agenda com o **horário ORIGINAL** (não snoozed).
- User clicou "Adiar" mas alarme dispara no horário original mesmo assim.
- Race rara mas possível em devices instáveis.

**Severidade:** P1 (bug funcional latente).

**Fix:** chamar `AlarmScheduler.persistAlarm(ctx, alarmId, snoozeAt, doses)` após `setAlarmClock` em ambas as scheduleSnooze.

### 🟡 A-04 — App.jsx useDoses + Dashboard useDoses usam janelas diferentes → duplas refetch sem compartilhar cache

**Arquivos:** `src/App.jsx` linhas 137-143 + `src/pages/Dashboard.jsx` linhas 102-115.

- App.jsx: `alarmWindow` -1d/+14d (15 dias) — sem filter.patientId.
- Dashboard: `baseWindow` -30d/+60d (90 dias) — com filter.patientId opcional.

Os queryKeys são `['doses', {...keyFilter}]` com `keyFilter.from/to` diferentes → **duas queries TanStack distintas**, cada uma chama listDoses separadamente.

**Impacto:**
- 2 round-trips ao DB toda vez que o app abre (uma por janela).
- 2 invalidations independentes a cada mutation (refetchType:'active' invalida ambas).
- Não compartilham resultado mesmo que dose pertença às duas janelas.

**Severidade:** P2 — egress + lentidão, não scheduling bug.

**Fix:** consolidar em uma só janela (a maior, -30d/+60d) e fazer Dashboard filtrar client-side.

### 🟡 A-05 — `useUserPrefs.queryFn` chama 2 mutations SharedPrefs em paralelo a cada refetch

**Arquivo:** `src/hooks/useUserPrefs.js` linhas 70-82.

```js
setCriticalAlarmEnabled(merged.criticalAlarm !== false).catch(() => {})
syncUserPrefs({ ... }).catch(() => {})
```

**Comportamento:** toda vez que `useUserPrefs` re-faz fetch (mount Settings, refetchOnWindowFocus, mutation invalidate), chama BOTH:
- `setCriticalAlarmEnabled` (escreve `dosy_user_prefs.critical_alarm_enabled` E `dosy_sync_credentials.critical_alarm_enabled`)
- `syncUserPrefs` (escreve `dosy_user_prefs.{critical_alarm_enabled, dnd_*}`)

**Impacto:**
- Dois plugin calls async paralelos. SharedPreferences.apply() não é atômico ordenado entre calls.
- Plugin Java escreve via `edit().apply()` que é fire-and-forget. Ordem de gravação não garantida.
- Para `critical_alarm_enabled`, AMBOS escrevem o mesmo valor → idempotente.
- Mas é **redundante e gera ruído** em logcat + 2× IPC calls por refetch.

**Severidade:** P2 — não causa bug visível, mas é sintoma da duplicação de namespaces (RC-2 da auditoria FUNDO).

**Fix:** remover `setCriticalAlarmEnabled` (legacy), manter só `syncUserPrefs`.

---

## 3. Novos Itens Mortos (analytics EVENTS)

**Arquivo:** `src/services/analytics.js` linhas 140-147 (EVENTS).

EVENTS constants definidas mas NUNCA chamadas em `track(EVENTS.XXX)`:
- `EVENTS.ALARM_FIRED` (linha 140)
- `EVENTS.ALARM_DISMISSED` (linha 141)
- `EVENTS.ALARM_SNOOZED` (linha 142)
- `EVENTS.NOTIFICATION_DISMISSED` (linha 147)
- `EVENTS.DOSE_OVERDUE_DISMISSED` (linha 136)

Track de alarme fire é feito via `useInAppReview.incrementReviewSignal('alarm_fired')` que NÃO usa analytics.track. Track de tap está em App.jsx via `NOTIFICATION_TAPPED` — esse SIM usa.

**Severidade:** P3 — apenas ruído. Pode remover ou implementar telemetria de alarme fired/dismissed/snoozed que está faltando (útil pra debug healthcare).

---

## 4. Confirmação por Releitura

Os pontos abaixo eu reli **linha por linha** e confirmo: comportamento OK, nenhum bug oculto.

### 4.1 App.jsx

- **Linha 113** auto-subscribe `subscribe(0)` (advanceMins=0) — OK, pode quebrar se Plus tier tem default diferente. Hoje todos usam 0. ✅
- **Linha 137-142** alarmWindow recalcula a cada hora via hourTick — OK ✅ (mas vide A-04 sobre duplicação)
- **Linha 154-172** detecção install/upgrade — só loga, sem efeito side ✅
- **Linha 198-211** useEffect scheduleDoses dependency `[user, dosesSignature, patientsSignature, dosesLoaded, patientsLoaded, scheduleDoses]` — não inclui `prefs`. **Mudança de prefs NÃO dispara rescheduleAll daqui.** Mas Settings.updateNotif chama scheduleDoses manualmente após updatePrefsMut. ✅ coberto.
- **Linha 214-304** notification listeners (LocalNotif, PushNotif) — OK ✅
- **Linha 285-294** `pushNotificationReceived` apenas track telemetria, NÃO redisplay. **Confirmado intencional pela comentário.** ✅
- **Linha 307-343** window events `dosy:openDose/openDoses` — bind correto + pending cold-start check ✅
- **Linha 398-400** `if (locked) return <LockScreen>` — Routes NÃO montam quando locked, MAS useEffect listeners de notif/event continuam bound. User clica notif → URL muda → quando desbloquear, Dashboard processa searchParams. ✅

### 4.2 useAppResume

- Long-idle (>5min) faz `supabase.auth.refreshSession()` + `supabase.removeAllChannels()` + `refetchQueries({type:'active'})`.
- refetch dispara useDoses → dosesSignature pode mudar → App.jsx useEffect → scheduleDoses (throttle 30s).
- Refresh token mutex `refreshInProgress` + debounce 1s previne storm. ✅ coberto pela auditoria #202.

### 4.3 useRealtime

- **DISABLED** em App.jsx linha 70. Não roda. ✅
- Se reativar no futuro, `WATCHDOG_INTERVAL_MS=300_000` (5min) — invalidation realista. OK.

### 4.4 mutationRegistry

- `confirmDose / skipDose / undoDose` onMutate patcham `status` no cache imediato → dosesSignature flippa instantâneo → scheduleDoses dispara antes da invalidate confirmar server. ✅ correto (rescheduleAll usa o cache patched).
- `createTreatment` onMutate insere doses temp `_optimistic:true`. `filterUpcoming` skip via flag. ✅ correto.
- `pauseTreatment / endTreatment` onMutate remove doses futuras local. dosesSignature flippa → cancelAll + reschedule sem essas. ✅ correto.
- `registerSos` insere temp status='done' → filterUpcoming skipa (só pending). ✅ correto.
- `refetchDoses` debounce 2s — OK ✅
- **Mas vide A-02:** o DELETE batch real em pauseTreatment fires N triggers DB. Issue server-side, não client.

### 4.5 useUserPrefs

- mutateAsync escreve localStorage + DB + SharedPrefs.
- Settings.updateNotif chama `scheduleDoses(upcomingDoses)` após mutateAsync → reschedule manual.
- ⚠️ **Bug residual:** `upcomingDoses` é `useDoses({from:now, to:+48h})` em Settings. Não tem patients. rescheduleAll vai usar patientsMap vazio → `patientName=''` em alarmes agendados via Settings path. Cosmético.
- Vide A-05 sobre dupla chamada SharedPrefs.

### 4.6 DoseModal / MultiDoseModal

- DoseModal.handleConfirm/handleSkip chama mutation hook + onClose imediato. ✅
- MultiDoseModal mesmo padrão. Estado local `states[]` rastreia handled per-dose. ✅
- Não toca scheduling diretamente — depende de mutationRegistry.

### 4.7 listDoses / dosesService

- `applyDefaultRange` aplica -30d/+60d se from/to ausentes ✅
- `recomputeOverdue` vide A-01.
- `confirmDose/skipDose/undoDose` chama RPC server-side. Server trigger fires `dose_change_notify` → Edge → FCM cancel_alarms. Idempotente com client-side reschedule via mutationRegistry.

### 4.8 useAppLock

- Biometric lock — `<LockScreen>` renderizado early quando locked=true.
- App.jsx useEffect de scheduleDoses + notif listeners continuam montados (não bloqueados).
- AlarmActivity native usa `showWhenLocked="true"` no manifest → não bloqueado por lock screen. ✅

### 4.9 Java AlarmReceiver / AlarmService / AlarmActivity / etc

- Já cobertos na auditoria FUNDO e auditoria de código morto.
- Vide A-03 sobre snooze sem persist.

### 4.10 Edge dose-trigger-handler / daily-alarm-sync

- Padrão FCM data message. prefs incluso no payload (fix race v0.2.3.0).
- Vide RC-2 da auditoria FUNDO sobre prefs no fire time.

### 4.11 ProGuard / build.gradle

- Keep rules cobrem `com.dosyapp.dosy.plugins.criticalalarm.**` e Capacitor reflection. ✅
- SSL pinning Supabase ativo, expira 2027-12-01. Risk longo prazo. ✅

---

## 5. Conclusão da Terceira Passada

**Confirmação:** o **problema central** continua sendo arquitetural — dual tray mechanism (M2 Java + M3 Capacitor) descrito na auditoria FUNDO (RC-1).

**Novos achados:**
- 3 P0/P1 (A-01 recomputeOverdue silencioso, A-02 DELETE batch trigger spam, A-03 snooze não persiste em reboot).
- 2 P2 (A-04 janelas useDoses duplicadas, A-05 dupla chamada SharedPrefs).
- 5 EVENTS constants mortas em analytics.

**Confirmação que NÃO encontrei:**
- Bugs grandes ocultos em hooks de UI ou componentes
- Side-effects rogue de scheduling em arquivos não-óbvios
- Imports ou dependências que afetam push/alarme escondidamente
- Configs `capacitor.config.ts` / `AndroidManifest.xml` / `build.gradle` problemáticos

**Veredito:** o sistema de Alarme/Push **não tem mais código morto significativo** afetando comportamento. Os problemas atuais (validações falhando) são consequência dos **4 root causes arquiteturais** documentados na auditoria FUNDO + os **5 pontos novos** acima — todos endereçáveis no Plano A + Fix B + Fix C + ajustes A-01 a A-05.

**Recomendação atualizada:**
1. **Plano A** (unificar tray em Java M2) — resolve RC-1, RC-4.
2. **Fix B** (re-rota fire time consultando prefs) — resolve RC-2.
3. **Fix C** (Edge envia doseIds CSV completo no cancel_alarms) — resolve RC-3 + mitiga A-02.
4. **A-03 fix** — chamar `persistAlarm` em scheduleSnooze (10 minutos de código).
5. **A-05 fix** — remover `setCriticalAlarmEnabled` (legacy), só `syncUserPrefs` (Bloco 5 da auditoria código morto).
6. **A-02 mitigação completa** — converter `cancelFutureDoses` DELETE em UPDATE batch OR adicionar RPC server-side que envia 1 FCM com CSV.

Estimativa total dos itens A: ~3h de código + teste device.
