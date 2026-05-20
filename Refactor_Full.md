# Refactor_Full — Plano completo de refatoração do Dosy

> **Documento de planejamento.** Não modifica código. Define o "o quê" e "como" do refactor que vem a seguir.
> **Fonte da verdade do produto:** `dosy-app/docs/01-PRD.md` + `dosy-app/docs/02-PERSONAS.md`.
> **Foco:** transformar o app travado e improvisado de hoje em um app leve, ágil, com marcação otimista e sync resiliente, à prova dos travamentos que tornaram a v0.2.3.14 impraticável em Internal Testing.
> **Autor:** Investigação técnica feita por agentes Explore em paralelo (front, hooks, services, banco, Edge Functions, plugin nativo Android) cruzada com `BUGS.md`, `STATE.md`, `APP.md`, `PROJETO.md`.
> **Data:** 2026-05-19.
> **Estado base:** `master @ v0.2.3.14` (vc 77).

---

## Sumário executivo

O Dosy v0.2.3.x é um app que cumpre o escopo do PRD mas está estruturalmente comprometido por:

1. **Múltiplas fontes de verdade** para os mesmos dados (alarmes em 4 sistemas paralelos; tier em 3 lugares; versão em 4 lugares; doses geradas em 2 caminhos).
2. **Race condition real e diária** entre o `debounce` do Realtime (1 s) e o `debounce` do refetch de mutação (2 s) que **sobrescreve o optimistic update**. Esse é o "status volta do nada" relatado.
3. **Lógica de "botão preso"** em `MultiDoseModal` (`disabled = qualquer mutation pending`) que trava toda a fila quando uma única dose está sincronizando.
4. **App-level reschedule** que recalcula TODOS os alarmes a cada mudança em `doses` ou `patients`, sem decisão por escopo. Mesmo com throttle 30 s, cada chamada é cara (cancelAll + 3-branch recompute + reagendamento via Capacitor + Java).
5. **Camada de notificação dupla** (`src/services/notifications/*` + `src/services/criticalAlarm.js`) com migração v0.2.3.1 incompleta — dois caminhos coexistem.
6. **Plugin Android com bugs estruturais** já mapeados: `static MediaPlayer` sem sincronização (race em multi-alarme), snooze não persiste no DB, "Ciente" não confirma dose, boot perde doses do horizonte futuro.
7. **47 scripts QA acumulados** untracked no git, sem padrão de matriz de teste — cada bug virou um arquivo novo.
8. **42 menções a `legacy`/`removed`/`deprecated`/`débito`** no código vivo — patches em cima de patches sem refator estrutural.
9. **Componentização parcial.** Primitivas (Card, Button, Sheet, Modal) e pickers (PatientPicker, MedNameInput, ConfirmDialog) já bem unificados. Mas várias telas reimplementam inline o que poderia ser componente: empty states (5 páginas), lista de doses (3 páginas), chips de período (4 páginas), filtros de Reports/Analytics/DoseHistory (3 implementações paralelas), stat cards 2-col grid (3 páginas), form rows (4 forms). Inventário completo em §11.

A meta deste refactor é **eliminar essas seis dimensões na raiz**, não amenizar. O app precisa virar **boring infrastructure** (previsível, instrumentado, fácil de raciocinar) sem perder o diferencial (alarme crítico nativo, multi-cuidador, OCR no roadmap v1.5 do Dosy).

A recomendação central é **rewrite cirúrgico em camadas** (sem virar Big Bang Rewrite), com 5 fases entregáveis em sequência, cada uma comendo uma classe de problema. A fase 1 derruba o problema reportado pelo user em produção; as fases 2-5 fazem o saneamento profundo.

---

## 1. Diagnóstico — problemas-raiz por camada

> Cada item abaixo é uma observação confirmada por leitura de código, comentário no repositório, ou bug histórico em `BUGS.md`. Quando há `file:line`, é localização atual no `master`.

### 1.1 Front-end — fluxo de marcação de dose

#### RC-1: Optimistic sobrescrito por Realtime (CRÍTICO — explica "status volta do nada")

**Cadeia atual:**

1. User arrasta/toca "Tomada" → `onMutate` aplica patch optimistic no cache (status `done`) — UI atualiza imediato.
2. `mutationFn` dispara RPC `confirm_dose` (200-800 ms tipicamente).
3. Server commit `UPDATE doses` → dispara `dose_change_notify` (statement-level trigger).
4. Postgres publica `postgres_changes` → cliente recebe payload na conexão Realtime.
5. `useRealtime.js:79-86` agenda `debouncedInvalidate(['doses'])` em **1 s**.
6. RPC retorna (sucesso) → `mutationRegistry.js:164-172` agenda `refetchDoses` em **2 s**.
7. **Em 1 s**: Realtime debounce resolve antes → `invalidateQueries(['doses'])` → refetch executa.
8. **Mas:** o refetch pode chegar antes do commit final ser visto por uma segunda query (replica lag, statement-level trigger fora da transação, http_post async), ou colide com o estado em memória ainda otimista.
9. Resultado observado: a dose **volta para `pending`/`overdue` por 2-5 s** até o refetch "real" do mutationRegistry chegar.

**Arquivos confirmados:**

- `src/hooks/useRealtime.js:79-86` — debounce 1 s por key.
- `src/services/mutationRegistry.js:164-172` — `refetchDoses` debounce 2 s.
- `src/hooks/useDoses.js:50-51` — mutation key `['confirmDose']`.

Esse é **o bug central que o user relata**. Não é hipótese: o ordering dos timeouts está documentado no código e explica o sintoma exato.

#### Botão preso em `MultiDoseModal`

**Causa:** `src/components/MultiDoseModal.jsx:194,203,213` faz `disabled={confirmMut.isPending || skipMut.isPending}` para os **3 botões de TODAS as doses no modal**.

Cenário: 3 doses no modal (push agrupado). User toca "Tomada" na primeira → mutation entra em `pending` (200-800 ms) → as 3 doses ficam com botões `disabled` durante esse tempo. Se a rede degrada (típico em mobile), o disabled fica visível por segundos.

**Sintoma do user:** "clico no BT, ele fica desabilitado, mas nada acontece... preciso fechar e abrir o app". A explicação é mais simples: o disabled é coletivo, não per-dose. Sair e voltar limpa o estado React e desbloqueia.

#### Pull-to-refresh sem barrier de mutação

`src/pages/Dashboard.jsx:247-264` (`handleRefresh`) chama `safeRefetch(['dashboard-payload'])` sem checar `qc.getMutationCache().findAll()`. Se o user dispara pull enquanto uma confirm está em flight, o refetch pode trazer dados pré-commit e sobrescrever o optimistic.

#### `flushPersistImmediate` no onMutate

`src/services/mutationRegistry.js:193` força `flushPersistImmediate(persister)` — write IDB ~100 ms síncrono no path crítico. Em mobile médio-baixo, é frame drop visível. Foi necessário porque o user pode matar o app <1 s após o toque; mas paga o preço em jank.

### 1.2 Front-end — reschedule storm e cascatas

#### Cascata de invalidations

Em uma sessão típica (login → mount → resume → realtime → mutation), **8-12 invalidations** podem disparar em sequência sem coordenação central:

- Login (`useAuth.jsx:200-213`): 4 invalidates simultâneos (`patients`, `received_shares`, `dashboard-payload`, `patient_shares`).
- Mount (`App.jsx:233-246`): `useDoses` + `usePatients` queries iniciam.
- Resume (`useAppResume.js:46-161`): `refetchQueries({type:'active'})` após 5 min idle.
- Realtime payload (`useRealtime.js:73-86`): `debouncedInvalidate` por table.
- Mutation onSuccess (`mutationRegistry.js`): invalidate por key.
- `refetchOnWindowFocus: true` (main.jsx) — mais um refetch quando o app volta foreground.

**Guards existentes** (válidos, mas insuficientes):

- `dosesSignature`/`patientsSignature` (App.jsx:201-231) — `useMemo` hash, previne reschedule com mesmos dados.
- `useRealtime.WATCHDOG_INTERVAL_MS = 300_000` (post-fix #212).
- `rescheduleAll` throttle 30 s + trailing run (`scheduler.js:40-73`, post-fix #211).
- `useAppResume` debounce 1 s + mutex `refreshInProgress`.
- `refetchType: 'active'` (não força queries não-montadas).

**Por que não basta:** os guards previnem _storm catastrófica_ (200×/min, como acontecia pré-#211). Não previnem 3-4 refetches paralelos numa janela de 1 s em cenários comuns (resume + realtime reconnect + windowFocus). Cada refetch dispara 1 RPC `get_dashboard_payload` (200-600 ms, com extend_continuous_treatments recursivo). O resultado prático: pico de CPU + IDB write + reconciliation em ondas, percebido pelo user como travamento.

### 1.3 Front-end — múltiplas fontes de verdade

| Dado | Fontes que coexistem hoje | Risco |
|------|---------------------------|-------|
| Tier (free/plus/pro/admin) | JWT claim + `subscriptions` table + cache `useSubscription` | Stale após upgrade — usado em paywall + AdMob gating |
| Push token FCM | SharedPrefs Android + `push_subscriptions` table | Token rotation pode divergir entre 2 fontes |
| Versão do app | `App.getInfo()` + `app_releases` table + `/version.json` Vercel (legacy) + `BUNDLE_VERSION` hardcoded | Bug #0010 já causou banner "versão 75" em vez de "0.2.3.12" |
| Doses geradas | `utils/generateDoses.js` (local, offline mutation) + RPC `create_treatment_with_doses` (server-side) | mutationRegistry usa local; Dashboard usa server — divergência possível |
| Alarmes agendados | Plugin Java `CriticalAlarm` + Capacitor `LocalNotifications` (legacy) + `notify-doses` Edge (410 stub) + `daily-alarm-sync` cron | 4 sistemas; 2 já deprecated mas com código vivo |
| Notification channels | `Capacitor.createChannel('doses_v2')` + Java `AlarmScheduler.scheduleTrayGroup` | Migração v0.2.3.1 incompleta |
| User prefs (push, criticalAlarm, advanceMins) | `user_prefs` JSONB + `localStorage['medcontrol_notif']` cache + DEFAULT_PREFS hardcoded | Divergência se write em uma fonte falha |

### 1.4 Hooks com sobreposição

Mapeamento dos 21 hooks em `src/hooks/`. **Sobreposições críticas:**

- `useDashboardPayload.js` (RPC consolidado 4-em-1) coexiste com `useDoses.js`, `usePatients.js`, `useTreatments.js` populando o mesmo cache. **Resultado:** Dashboard usa o consolidado; outras telas usam queries individuais; quando ambos rodam, 2 fontes alimentam `['doses']`.
- `useAppResume.js` (refresh após idle ≥5 min) + `useAppLock.js` (auto-lock biometria após 5 min) — **ambos lidam com timeout de inatividade**, sem coordenação. `useAppLock` existe mas **não está montado** (regressão pendente, mencionada em `PROJETO.md`).
- `usePushNotifications.js` é re-export do `notifications/index.js`. Confunde leitura.
- `useShares.js` + lógica de compartilhamento em `useAuth.jsx` (invalidate `received_shares` no login).

### 1.5 Services — zona crítica de débito

`src/services/notifications/` (5 arquivos: `index.js`, `fcm.js`, `channels.js`, `scheduler.js`, `prefs.js`) vs `src/services/criticalAlarm.js`. Ambas disparam alarmes/trays. A migração v0.2.3.1 (Plano A) consolidou trays foreground via Capacitor → Java, mas:

- `channels.js:15` ainda comenta "LocalNotifications.createChannel REMOVIDO para trays" — código removido, comentário vivo.
- `scheduler.js` mantém **web legacy path** sem uso confirmado.
- `fcm.js:128-133` mantém fallback "delete-all" para legacy push tokens sem device_id.

### 1.6 Banco Supabase — sólido com pontos de atenção

**50 migrations cronológicas** (20260428 → 20260518). Schema dedicado `medcontrol`. RLS ativo em todas tabelas.

**RPCs críticas e suas latências estimadas:**

| RPC | Risco | Latência típica |
|-----|-------|-----------------|
| `create_treatment_with_doses` | Alto — loop batch até 90 dias × N horários | 500-2000 ms |
| `update_treatment_schedule` | Alto — regenera doses; bug histórico AT TIME ZONE corrigido em v0.2.3.7 (#283) | 1000 ms+ |
| `get_dashboard_payload` | Médio — 4 SELECTs + `extend_continuous_treatments` recursiva | 200-600 ms |
| `register_sos_dose` | Médio — validação `minIntervalHours`/`maxDosesIn24h` server-side | 50-200 ms |
| `confirm_dose`/`skip_dose`/`undo_dose` | Baixo — UPDATE single row | 50-150 ms |
| `has_patient_access` | Baixo — helper RLS via EXISTS | <5 ms |

**Triggers ativos:**

- `dose_change_notify` (AFTER INSERT/UPDATE doses futuras+pending) → pg_net.http_post para `dose-trigger-handler` Edge (<5 s async, fora da transação).
- `enforce_patient_limit` (BEFORE INSERT patients para free).
- `enforce_sos_via_rpc_trigger` (BEFORE INSERT type=sos — força via RPC).
- `on_new_user_subscription` (AFTER INSERT auth.users).
- `patient_unshare_notification_trigger` (AFTER DELETE patient_shares) → Edge FCM.

**Pontos atenção:**

- **Trigger fora da transação:** `dose_change_notify` usa `pg_net.http_post` que é async. Realtime publica `postgres_changes` **antes** do Edge confirmar o FCM. Janela de inconsistência: cliente vê novo estado antes do alarme nativo ser cancelado. Pequena, mas existe.
- **Constraint `doses_observation_length ≤ 500`** (LGPD): pode rejeitar mutation se UI permitir digitar mais — checar validação client-side.
- **CASCADE em FKs:** delete paciente apaga doses, treatments — comportamento esperado, mas sem `RESTRICT` em produção há risco de soft-delete acidental.

### 1.7 Edge Functions — relativamente saneadas

**7 functions deployadas** (após cleanup #209):

- `dose-trigger-handler v21` — main path (real-time, BATCH_UPDATE/BATCH_DELETE com group hash).
- `daily-alarm-sync v3` — cron 5 am BRT, horizonte dinâmico 24-48 h, chunking 30/FCM.
- `dose-fire-time-notifier` — cron 1 min, janela `[NOW-90s, NOW+30s]`, idempotência via `fire_notified_at`.
- `patient-unshare-handler` — DELETE trigger → FCM unshare.
- `delete-account` — service_role para LGPD.
- `send-test-push` — admin debug.
- `notify-doses` / `schedule-alarms-fcm` — **stubs 410 Gone** (deprecated).

**Pontos de atenção:**

- `dose-fire-time-notifier` rodando a cada 1 min = 1440 invocações/dia mesmo sem doses. Idempotência via flag previne FCM duplicado, mas o custo de execução é fixo.
- **OAuth tokens FCM** (~60 fetches/dia). Cache in-memory por instância Edge, mas Edge é stateless — cold start gera novo fetch.
- Duplicação **mitigada mas existente**: `dose-trigger-handler` + `daily-alarm-sync` podem ambos agendar a mesma dose. Mitigado por filtros, mas se trigger falhar silenciosamente, cron cobre 17 h depois.

### 1.8 Plugin nativo Android CriticalAlarm

**Pacote:** `com.dosyapp.dosy.plugins.criticalalarm`. **6 arquivos Java.**

**Race conditions críticas:**

- `AlarmService.java:51-52` — `static MediaPlayer activePlayer` + `static Vibrator activeVibrator` **sem sincronização**. Multi-alarme simultâneo (dose 8:00 + 8:15 do mesmo paciente, ou de pacientes diferentes) pode causar NPE ou estado corrupto. Documentado em `PROJETO.md` ("⚠️ static race em multi-alarm") mas não resolvido.
- `BootReceiver.java` — query "doses > NOW", **sem margem retroativa**. Device off entre 8:00-12:00, boot 13:00 → dose 12:30 perdida (não vai nem para tray persistente "Pulada"). O PRD §4.1 prevê persistência sobrevivendo a reboot — o código não cumpre 100%.

**Bugs P1 conhecidos não resolvidos:**

- **Snooze não persiste DB.** `AlarmActionReceiver.ACTION_SNOOZE` reagenda local via `AlarmManager.setAlarmClock`, mas não escreve flag `snoozed_until` no banco. Próximo `rescheduleAll` (a 30 s + qualquer trigger) cancela o snooze. User toca "Adiar 10 min" no alarme, alarme volta a tocar em 20 s.
- **"Ciente" não confirma dose.** `ACTION_ACK` faz dismiss local da notif + activity, mas NÃO chama RPC `confirm_dose`. Próximo `rescheduleAll` reagenda. Único caminho legítimo de marcar é abrir o app + tocar no modal.
- **Boot perde doses.** Já descrito acima.

**Memory leak suspeito:**

- `DosyMessagingService.java` importa `MainActivity` diretamente. Falta verificar se `MainActivity.sWeakRef = WeakReference<MainActivity>` (introduzido em #0003 v0.2.3.11) cobre todos os callers, ou se há strong reference em algum handler.

### 1.9 Inventário de débito superficial mas chato

- **47 scripts QA** em `scripts/qa_*.mjs` untracked. 8 categorias (sessões Appium, drills, repro bugs, toggles, inspectors, navigation, patching, outros). Cada bug virou arquivo novo. **Falta matriz parametrizada.**
- **30+ comentários `legacy`/`removed`/`débito`/`fallback compat`** identificados no front + Android + migrations. Tornam leitura confusa e introduzem cargas mentais a quem mantém.
- `src/utils/generateDoses.js` — marcado como legacy mas ainda importado por `mutationRegistry.js` para fallback offline.
- `dose_notifications` table — criada para idempotência de `notify-doses` (já deprecated). Migration `20260514000000` marca cleanup mas a tabela física pode ainda existir.
- `BUNDLE_VERSION` hardcoded coexiste com `app_releases` DB.

### 1.10 Sinais que vieram de bugs históricos (`BUGS.md`)

Padrão recorrente: **fix sintomático, não estrutural**. Exemplos representativos:

- #0005 (status Cancelada em Reports após pause/resume) — corrigido com UPDATE específico no RPC `resumeTreatment` + exclusão em queries de Reports. Mas a **abstração de estado de dose** não foi consolidada (continua: `pending`/`overdue`/`done`/`skipped`/`cancelled` espalhados em N queries).
- #0006 (`[object Object]` em logcat) — corrigido com `loggingBehavior: 'production'`. Mas o bug original era **Sentry vendor capturando AppUpdate install error -6** que NÃO ocorre fora do emulador. A real correção seria `beforeSend` filtrar errors emulator-only.
- #0009 (`useShares` 401 JWT expiry mostrava "Carregando..." pra sempre) — corrigido com error state + retry button. Mas o **padrão de "loading infinito quando query falha sem rollback"** existe em outros lugares (provavelmente em `useSubscription`, `useDashboardPayload`, etc).
- #209 (refactor sistema alarmes pós 3 bugs) — bom no DESIGN consolidado, mas executado em paralelo a outros refactors em curso (`v0.2.3.0`, `v0.2.3.1`) → 4 auditorias linha-por-linha pra encontrar 4 root causes não cobertos pela primeira passada (RC-1 a RC-4 documentadas no `PROJETO.md`).

---

## 2. Princípios da arquitetura-alvo

> Cinco princípios não-negociáveis. Toda decisão do refactor deve passar por eles.

### P1. Marcação otimista, sync resiliente

Toda ação do user (marcar dose, criar SOS, mudar config, editar tratamento) **reflete imediatamente na UI**. Sync com backend acontece em background sem bloquear próxima ação. Falha de sync exibe feedback explícito ("não foi possível salvar — tentando novamente" / "sua ação foi revertida"), nunca silencioso.

Já é princípio do PRD §4.1 do Dosy. O refactor materializa.

### P2. Sem botão "esperando resposta"

Loading inline (spinner pequeno) ao lado da ação confirmada. Botões nunca ficam `disabled` esperando rede. User pode continuar usando o app durante o sync. Clique não fica "preso".

Significa **abandonar o padrão `isPending` global no JSX**.

### P3. Estado nunca volta do nada

Status confirmado pelo user é definitivo na UI até evento explícito (sync error com notificação visível, ou ação de outro cuidador com indicação de quem fez).

Materialização técnica:

- **Versioned cache** com `_localActedAt` timestamp por dose. Realtime/refetch só sobrescreve se `incoming._serverConfirmedAt > cache._localActedAt + LATENCY_BUDGET`.
- **Coordenação Realtime ↔ mutation queue**: Realtime payload é descartado para keys com mutation em flight.

### P4. Single source of truth por dado

Cada pedaço de informação tem **um lugar autoritativo**. Caches são caches (TTL explícito + invalidate rule clara), não fontes paralelas.

- Tier: server-side via JWT claim. Cliente lê do claim, nunca de localStorage paralelo.
- Push token: `push_subscriptions` table (server-authoritative). SharedPrefs Android é cache para wake before login.
- Versão: `app_releases` table. `/version.json` removido. `BUNDLE_VERSION` removido. Play Core SDK só para banner trigger no Android.
- Alarmes: plugin Java é executor; `doses` table é fonte. Capacitor `LocalNotifications` removido inteiramente.
- User prefs: `user_prefs` JSONB. localStorage só para hidratação inicial offline.

### P5. Boring infrastructure — previsível, instrumentado, fácil de raciocinar

- **Um único ponto de invalidação de queries** (não 8-12 espalhados).
- **Um único orquestrador de alarmes** (não 4 sistemas).
- **Instrumentação obrigatória** em mutations (analytics + Sentry breadcrumb + audit log) — diagnóstico de produção sem precisar repro.
- **Sem comentários `legacy`/`removed` vivos** — código removido é removido; histórico fica no git.

---

## 3. Decisão estratégica: refactor in-place, não rewrite

**Decisão:** refactor in-place em fases sequenciais, NÃO rewrite from scratch.

**Motivos:**

1. **PRD §2 do Dosy diz "tudo do medcontrol_v2 já inicialmente, mas reescrito limpo"** — escopo está estável, função está validada, o que falha é a estrutura, não a lógica de produto.
2. **Banco está sólido.** 50 migrations, RLS em todas tabelas, RPCs com semântica clara, audit trail montado. Trocar o banco seria autossabotagem.
3. **Plugin Java está 80% certo.** Os 3 bugs P1 (snooze DB, Ciente confirm, boot catch-up) são fixes localizados, não justificam rewrite.
4. **Closed Testing está ativo desde 2026-05-06.** Rewrite from scratch quebra continuidade com testers (mesmo bundle id = mesmo app na Play Store; rewrite com novo bundle id = perda dos testers).
5. **Riscos de rewrite paralelo:** já vimos isso em #209 — refactor concorrente em duas frentes (v0.2.3.0 + v0.2.3.1) causou 4 root causes adicionais. Repetir em escala maior = desastre.

**Como evitar que "refactor in-place" vire "patches em cima de patches" (o pattern atual):**

- Fases entregam **camadas inteiras** (não bug a bug).
- Cada fase termina com **remoção de código legacy** correspondente (não acúmulo).
- Cada fase tem **DoD** (Definition of Done) explícito que inclui: testes passando, métricas atingidas, validação device físico, código legacy removido, docs atualizados.
- Cada fase merge **em branch dedicada** (`refactor/fase-1-sync` etc), só vai pro master quando DoD inteira.

---

## 4. Arquitetura-alvo — camadas

### 4.1 Camada de estado (front)

**Hoje:** TanStack Query v5 + PersistQueryClient (localStorage 24h) + caches por hook + invalidations espalhadas.

**Alvo:**

- **TanStack mantém.** É boa biblioteca; o problema é o uso.
- **Wrapper único `useDosyMutation(opts)`** que toda mutation usa. Encapsula:
  - `onMutate` com `patchDoseInCache` (otimista).
  - `_localActedAt` stamp (Date.now()) no cache patch.
  - `mutationFn` → RPC.
  - `onError` rollback.
  - `onSuccess` → 1 único `invalidate` (não múltiplos `refetchQueries` paralelos).
- **Wrapper único `useDosyQuery(opts)`** com `staleTime` default explícito + `select` para projeção memoizada + integração com versioned cache.
- **`refetchInterval`:** removido em geral. Polling vira opt-in raríssimo (talvez só `app_releases` no UpdateBanner, 30 min).
- **Realtime gate** (novo módulo `src/state/realtimeGate.js`):
  - Mantém mapa `keysWithInFlightMutation: Set<string>`.
  - `postgres_changes` para key X → se key X está no set, **ignora** (espera mutation drenar).
  - Mutation `onMutate` add key ao set; `onSettled` remove.

**Versioned cache (resolve RC-1 na raiz):**

```
type DoseCacheEntry = {
  ...doseFields,
  _localActedAt?: number,     // set por onMutate (Date.now)
  _serverConfirmedAt?: number // set por payload Realtime/refetch
}

// Regra de reconciliação:
// incoming sobrescreve cache se:
//   !cache._localActedAt OR
//   (incoming._serverConfirmedAt > cache._localActedAt + 2000ms)
// Caso contrário: incoming é descartado (optimistic vence).
```

**Resultado prático:** durante os 2 s entre `onMutate` e `onSuccess`, qualquer Realtime/refetch que tente sobrescrever a dose é ignorado.

### 4.2 Camada de UI — feedback inline, nunca disabled

**Padrão alvo para mutations:**

```jsx
// Hoje (ruim)
<button disabled={mut.isPending}>Tomada</button>

// Alvo
<button onClick={handle} aria-busy={mut.isPending}>
  Tomada
  {mut.isPending && <Spinner size="xs" />}
</button>
```

`MultiDoseModal` em particular:

- Estado `pendingDoseId` local ao componente.
- `handleConfirm(doseId)` → `setPendingDoseId(doseId); mut.mutate(...)`.
- Botão de cada dose: `aria-busy={pendingDoseId === dose.id}`, **não** `disabled`.
- Avança próxima dose **imediatamente** após `onMutate` (não após `onSuccess`).

`Dashboard` e `DoseCard`:

- Swipe gesture com debounce 150 ms (já existe — manter).
- Ao soltar: `patchDoseInCache` imediato + mutation em background.
- Sem feedback bloqueante.

### 4.3 Camada de scheduling de alarmes

**Hoje:** 4 sistemas (Java CriticalAlarm + Capacitor LocalNotifications + dose-trigger-handler + daily-alarm-sync) + cliente reagenda tudo via `rescheduleAll`.

**Alvo (princípio: server agenda, cliente confirma):**

- **`daily-alarm-sync`** continua como pilar (cron 5 am BRT, 48 h horizonte, FCM data push para devices).
- **`dose-trigger-handler`** continua como real-time response a INSERT/UPDATE/DELETE de doses.
- **`dose-fire-time-notifier`** **REMOVIDO**. Substituído por: cliente Android agenda local via `AlarmManager.setAlarmClock` no momento do `schedule_alarms` FCM (o que já acontece) — o cron de 1 min é redundância de safety net que custa 1440 invocações/dia.
- **Capacitor `LocalNotifications` removido inteiramente.** Migration v0.2.3.1 finaliza.
- **Cliente JS deixa de reagendar alarmes.** `rescheduleAll` no app vira `requestServerSync` (envia "sincronize meu schedule" para Edge function, que retorna ack). Throttle agressivo (60 s mínimo).

**Resultado prático:**

- `rescheduleAll` em mutation onSuccess → REMOVIDO. Server cuida via `dose_change_notify` trigger.
- App-level `useEffect` watching doses/patients para reschedule → REMOVIDO.
- `useUserPrefs` mudar advanceMins → 1 RPC `update_user_prefs(prefs)` → trigger DB → FCM `reschedule_all`. Sem cliente JS orquestrando.

### 4.4 Camada de plugin Android

**Fixes diretos:**

- **Race static fields** (`AlarmService.java:51-52`): trocar `static MediaPlayer/Vibrator` por `Map<String, MediaPlayer>` indexado por alarmId. `synchronized` block em start/stop.
- **Snooze persiste DB:** `AlarmActionReceiver.ACTION_SNOOZE` → 1) reagendamento local via `setAlarmClock`; 2) envia intent JS → bridge chama RPC novo `snooze_dose(doseId, minutes)` que escreve `snoozed_until` na dose. Cron/trigger filtram doses snoozed.
- **"Ciente" confirma dose:** `AlarmActionReceiver.ACTION_ACK` → bridge intent JS → chama RPC `confirm_dose`. UI atualiza.
- **Boot catch-up:** `BootReceiver` query "doses entre `NOW - 2h` e `NOW + horizon`". Doses do passado próximo viram persistent tray "Você perdeu N doses entre Hh e Hh" sem som (já estão atrasadas, alarme não rouba atenção retroativa).

### 4.5 Camada de banco

**Adições:**

- `medcontrol.doses.snoozed_until TIMESTAMPTZ` — nullable. Trigger/cron/RPCs filtram.
- `medcontrol.doses.local_acted_at TIMESTAMPTZ` — server registra timestamp da chamada (vem do client header). Audit trail.
- Function `medcontrol.snooze_dose(p_dose_id, p_minutes)` — atomic.
- Função `medcontrol.bulk_confirm_doses(p_dose_ids[])` — `MultiDoseModal` confirma N de uma vez (1 RPC em vez de N).

**Remoções:**

- `dose_notifications` table (idempotência de `notify-doses` deprecated) — DROP via migration.
- `extend_continuous_treatments` — verificar se ainda é chamada por `get_dashboard_payload` ou se já é dead code (comentário em `Dashboard.jsx:6,34-41,150` indica que sim).

**Sem mudanças de schema invasivas em:** patients, treatments, subscriptions, user_prefs, push_subscriptions, patient_shares, app_releases. RLS policies estáveis.

### 4.6 Camada de Edge functions

**Mantidas:** `dose-trigger-handler`, `daily-alarm-sync`, `patient-unshare-handler`, `delete-account`, `send-test-push`.

**Removidas:** `dose-fire-time-notifier`, `notify-doses` (stub 410), `schedule-alarms-fcm` (stub 410).

**Adicionada:** `request-schedule-sync` — endpoint chamado pelo cliente quando user muda prefs ou volta da Settings, faz schedule + FCM `reschedule_all` para o device chamador. Substitui `rescheduleAll` JS.

### 4.7 Camada de instrumentação

- **Sentry breadcrumbs** em todas as mutations (já existe parcialmente em `useAppUpdate`).
- **PostHog events** padronizados:
  - `dose.confirmed` / `dose.skipped` / `dose.undone` / `dose.snoozed`
  - `mutation.optimistic_overwrite_blocked` (RealtimeGate em ação)
  - `mutation.rolled_back` (onError)
  - `app.reschedule_requested` (server-side now)
- **Admin dashboard** (`admin.dosymed.app`) — já existe `/alarm-audit`. Adicionar:
  - `/sync-health` — taxa de optimistic_overwrite_blocked nos últimos 7 dias.
  - `/mutation-errors` — top RPCs com erro.
- **Estrutura de logs em RPCs críticas** — incluir `userId`, `doseId`, `localActedAt` em todos os SECURITY DEFINER.

---

## 5. Plano de execução em fases

### Fase 1 — Sync resiliente e marcação otimista (4 semanas)

**Goal:** matar os bugs reportados pelo user em produção. Após esta fase, o app é usável em Internal Testing.

**Releases alvo:** `v0.2.4.0` (refactor) + hotfix `v0.2.4.x` se necessário.

**Entregáveis:**

1. **RealtimeGate** (`src/state/realtimeGate.js`) — novo módulo. Mutation registra key em flight, Realtime descarta payloads para essas keys.
2. **Versioned cache** — `patchDoseInCache` stampa `_localActedAt`. Reconciler em `useDoses` query select compara timestamps.
3. **`useDosyMutation` wrapper** — substitui mutations diretas de TanStack em todos os hooks. Padroniza onMutate/onError/onSuccess.
4. **Alinhar debounces** — Realtime debounce 1 s → 2.5 s. Mutation refetch 2 s → 1.5 s. Mutation refetch agora **sempre vence**. (Mitigação imediata enquanto RealtimeGate é desenvolvido.)
5. **`MultiDoseModal` refactor** — `pendingDoseId` local, sem `disabled` coletivo. Avança fila imediato.
6. **`Dashboard.handleRefresh` barrier** — checa `qc.getMutationCache().findAll()` antes de refetchar.
7. **Audit `flushPersistImmediate`** — confirmar que é necessário; se for, mover para Web Worker / fora do main thread.
8. **Testes de carga e regressão**:
   - Appium script `qa_sync_stress.mjs` — marca 10 doses em sequência rápida (Gmail-style), verifica zero status flicker.
   - Scenario com network throttling (chrome DevTools: Slow 3G) — confirma sync resiliente.
9. **Validação device físico** — S25 Ultra + outro Android baixo-end. Roteiro: marcar 5 doses Tomadas + 5 Puladas + 3 undo, sem ver botão preso nem status fantasma.

**DoD:**

- ✅ Testes Appium passam local + emulador.
- ✅ Validação 2 devices físicos passa.
- ✅ PostHog `mutation.optimistic_overwrite_blocked` reportando >0 em dogfooding (= RealtimeGate ativo).
- ✅ Bugs equivalentes a #0009 ("Carregando..." infinito) auditados nos outros hooks; mesma correção aplicada onde necessário.
- ✅ Métricas baseline coletadas para Fase 2.

### Fase 2 — Consolidação de alarmes (4 semanas)

**Goal:** um único orquestrador de alarmes. Eliminar dual-path Capacitor LocalNotifications. Server agenda; cliente confirma.

**Releases alvo:** `v0.2.5.0` (refactor) + hotfixes.

**Entregáveis:**

1. **Remover Capacitor LocalNotifications** inteiramente. Pasta `src/services/notifications/` consolidada em `src/services/scheduling/`:
   - `index.js` — facade
   - `criticalAlarm.js` — bridge plugin (renomeado/limpo)
   - `prefs.js` — read/write user_prefs JSONB
   - REMOVIDO: `channels.js`, `scheduler.js` (legacy web path), `fcm.js` (consolidado em prefs+facade).
2. **Plugin Java fixes**:
   - Race `static MediaPlayer/Vibrator` → `ConcurrentHashMap<alarmId, ...>` com synchronized.
   - `ACTION_ACK` chama RPC `confirm_dose` via bridge.
   - `ACTION_SNOOZE` chama RPC `snooze_dose` + reagenda local.
   - `BootReceiver` query NOW-2h..NOW+horizon, com tray sem som para passadas.
3. **DB migrations**:
   - ADD `doses.snoozed_until TIMESTAMPTZ`.
   - ADD `doses.local_acted_at TIMESTAMPTZ`.
   - CREATE `snooze_dose(uuid, int)` RPC.
   - CREATE `bulk_confirm_doses(uuid[])` RPC.
   - DROP `dose_notifications` table.
4. **Edge `request-schedule-sync`** criada. **`dose-fire-time-notifier` DESCOMISSIONADA.**
5. **Cliente JS `rescheduleAll` REMOVIDO.** `App.jsx` useEffect watching doses/patients para reschedule REMOVIDO. Substituído por chamada a `request-schedule-sync` apenas em: mudança de prefs, reconexão online após >24 h offline, click manual "Sincronizar agora" em Settings (botão diagnóstico).
6. **Validação device físico extensa** — bateria 0%→100%, modo silencioso, Doze, bateria otimizada Samsung, app killed swipe, reboot device.

**DoD:**

- ✅ Tray Capacitor não aparece nunca (verificar logcat).
- ✅ Snooze "Adiar 10 min" funciona após app killed + screen off + DND ativo.
- ✅ "Ciente" no alarme nativo confirma dose (verificar histórico).
- ✅ Boot com dose 30 min no passado: tray "Você perdeu 1 dose" sem som.
- ✅ Egress diminui em pelo menos 30% (dose-fire-time-notifier era 1440 invocações/dia).

### Fase 3 — Single source of truth + consolidação de hooks (3 semanas)

**Goal:** eliminar multiple sources of truth listadas em 1.3. Consolidar hooks com sobreposição.

**Releases alvo:** `v0.2.6.0`.

**Entregáveis:**

1. **Tier**: 
   - JWT custom claim já tem `tier` (Auth Hook implementado em #144). Cliente sempre lê do claim.
   - `useSubscription` virou `useTier()` thin wrapper sobre `useAuth().session.tier`.
   - localStorage cache de tier REMOVIDO.
2. **Push token**:
   - `push_subscriptions` é fonte. SharedPrefs Android é cache wake-before-login (mantido).
   - Verificar que `fcm.js` não escreve em outro lugar.
3. **Versão**:
   - `app_releases` table é fonte. Play Core SDK só decide se há update disponível (boolean). `version_name` vem do DB.
   - `/version.json` REMOVIDO do `public/`. `BUNDLE_VERSION` hardcoded REMOVIDO.
4. **Doses geradas**:
   - `utils/generateDoses.js` REMOVIDO. mutationRegistry fallback offline reimplementado usando o mesmo algoritmo do RPC `create_treatment_with_doses` (transpila TS → JS em build se necessário, ou via WASM se viabilidade existir; mais provável: pequena lib pura compartilhada).
5. **User prefs**:
   - `user_prefs` JSONB é fonte. localStorage só hidrata estado inicial.
   - `DEFAULT_PREFS` hardcoded vai para 1 lugar único (`src/state/defaults.js`).
6. **Hooks consolidação**:
   - `useDoses`/`usePatients`/`useTreatments` em telas que não são Dashboard: revisar se ainda precisam ou se `useDashboardPayload` cobre. Provavelmente:
     - DoseHistory: usa `useDoses` (com filtros mais amplos) — manter.
     - Reports: idem.
     - TreatmentList: `useTreatments` — manter.
     - PatientDetail: usar `usePatients` por ID — manter.
   - **Decisão final caso a caso**, mas com regra: cada hook tem 1 propósito; nenhum hook é wrapper de outro hook.
   - `usePushNotifications.js` REMOVIDO (re-export inútil).
   - `useAppResume` + `useAppLock` consolidados em `useAppLifecycle` com state machine `{background, foreground, locked}`.

**DoD:**

- ✅ Cada dado da tabela em 1.3 tem 1 source documentada em `context/PROJETO.md`.
- ✅ Bug `useShares` 401 padrão aplicado: todos os hooks com queries tratam `error` state explicitamente (sem "Carregando..." infinito).
- ✅ Lint regra customizada bloqueia `import` de `notifications/scheduler.js`, `generateDoses.js`, `/version.json` (arquivos removidos).

### Fase 4 — Componentização, limpeza de débito e padronização (4 semanas)

**Goal:** consolidar componentes duplicados/quase-duplicados em primitivas reutilizáveis. Zerar comentários `legacy`/`removed`/`débito` vivos. Consolidar QA scripts. Pavimentar a base para features novas (TTL share, OCR, 3-níveis de alerta) entrarem sem cópia/cola.

**Releases alvo:** `v0.2.7.0`.

> **Ver §11 abaixo** para o inventário completo de componentes que disparou esta fase, incluindo o que já está bem unificado (PatientPicker, MedNameInput, ConfirmDialog, primitivas Card/Button/Sheet/Modal) e o que ainda está disperso.

**Entregáveis:**

1. **Componentes novos (alta prioridade — pavimentam o app):**
   - **`<EmptyState>`** — substitui blocos inline em Dashboard, Patients, PatientDetail, DoseHistory, TreatmentList. Variantes `kind="no-patients" | "no-doses" | "no-treatments" | "no-results"` + `icon`/`title`/`message`/`action` customizáveis. Esforço P, economia ~200 LOC.
   - **`<DoseList>`** — substitui renderização inline em Dashboard, PatientDetail, DoseHistory. Modos `grouped` (header por paciente) e `flat`. Props `doses`, `onSwipeConfirm`, `onSwipeSkip`, `onClick`. Esforço M, economia ~80 LOC por página.
   - **`<DateRangeChips>`** — substitui horizontal scroll de períodos em FilterBar (Dashboard), DoseHistory (day strip), Reports (presets), Analytics (7d/30d). Props `ranges`, `value`, `onChange`. Esforço P.
   - **`<FilterPanel>` schema-driven** — substitui filtros locais em Reports, Analytics, DoseHistory. Schema `[{key, label, type:'chips|select|multi|text', options}, ...]`. Reutiliza PatientPicker. Esforço M.
   - **`<StatGrid>`** — substitui 2-col MiniStat grids em Dashboard, PatientDetail, Analytics. Props `stats: [{label, value, unit, tone}]`, `columns`. Esforço P.
   - **`<TodayDosesStat>`** — substitui hero/stat card "Doses Hoje X de Y" em Dashboard + PatientDetail. Esforço P.
   - **`<FormRow>`** — substitui repetição `label + input + helper + error` em TreatmentForm, PatientForm, SOS, Settings. Esforço P, economia ~200 LOC.
   - **`<TreatmentCard>`** — substitui renderização inline em PatientDetail + TreatmentList. Props `treatment`, `onEdit`, `onDelete`, `upcomingDoses`. Esforço P.
   - **`<MedicationHistoryGrid>`** — substitui top/recent meds em SOS + Analytics. Esforço P.
   - **`<UnitPicker>`** — extrair se TreatmentForm usa inline (5-10 unidades padronizadas: mg, ml, comprimido, gota, jato, etc.). Esforço P.

2. **Consolidações de componentes existentes:**
   - **`DoseModal` + `MultiDoseModal`** → `<DoseSheet doses={...}>` único. `doses.length === 1` renderiza UI completa de edição (timing/observação); `doses.length > 1` renderiza fila simplificada (confirm/skip). Esforço M.
   - **`BottomSheet.jsx` (legacy, 0 imports)** → REMOVER. Sheet (em `dosy/surfaces.jsx`) é o padrão. Esforço P.
   - **`StatusPill` inconsistente** → DoseCard renderiza inline `<span>` em vez de usar `<StatusPill>`. Padronizar — sempre via componente. Esforço P.
   - **`AppHeader` vs `Header` interno** → manter ambos (complementares: global sticky + page-scoped). Confirmar que nenhuma página renderiza header inline.
   - **`AnimatedRoutes`** → manter se Framer Motion está em uso pesado; senão, simplificar.

3. **Remover comentários debt** — passar varredura regex (`legacy|deprecated|REMOVIDO|débito|TODO|FIXME`) e limpar. Comentários com contexto histórico viram ADR em `context/decisoes/`.

4. **Scripts QA**:
   - Consolidar 47 `qa_*.mjs` em `scripts/qa/` com `run.mjs` parametrizado (`node scripts/qa/run.mjs --flow=mark-dose --device=emulator`).
   - Cobertura: login, criar paciente, criar tratamento, marcar dose (com sync stress), SOS, share, unshare, prefs, snooze.
   - Limpeza: 47 → ~12 arquivos.

5. **`legacy` files limpeza**:
   - `utils/generateDoses.js` — confirmado removido em Fase 3.
   - Comentários `// v0.2.3.X — REMOVIDO X` — apagar (git log preserva).
   - Edge `notify-doses` e `schedule-alarms-fcm` stubs 410 — deletar diretórios `supabase/functions/notify-doses/` e `schedule-alarms-fcm/`.
   - Migration `cleanup_orphan_dose_notifications_v0_2_3_1` — confirmar drop e remover comentários remanescentes.

**DoD:**

- ✅ Cada componente novo tem 1 fonte e 0 implementações inline equivalentes (validado por busca textual).
- ✅ `git grep -nE '(legacy|deprecated|débito|TODO|FIXME)' src/ android/ supabase/` retorna < 5 hits, todos legítimos.
- ✅ `scripts/qa/` tem <15 arquivos.
- ✅ Lint passa sem warnings.
- ✅ Economia mensurada: ~500-800 LOC removidos.
- ✅ Validação visual em device físico — telas afetadas (Dashboard, PatientDetail, DoseHistory, Reports, Analytics, TreatmentList, TreatmentForm, SOS) iguais ou melhores que antes.

### Fase 5 — Performance e instrumentação (3 semanas)

**Goal:** app comprovadamente leve. Instrumentação suficiente pra diagnosticar em produção sem repro. Eliminar overhead de queries que não escalam com volume real do user.

**Releases alvo:** `v0.2.8.0`. Após esta fase, candidato a Closed Testing público no Dosy v2.

**Entregáveis:**

1. **Bundle analysis** — `vite-bundle-visualizer`. Identificar libs grandes (Framer Motion, jsPDF, html2canvas, posthog, Sentry). Tree-shake / lazy load. Alvo: -30% no bundle inicial.
2. **Lazy load por rota** — `React.lazy` em Analytics, Reports, Admin, FAQ, Privacidade, Termos, Install. Dashboard e Patients ficam no main bundle.
3. **Memoização de listas** — Dashboard agrupa doses por paciente. Garantir que group key é estável e `<DoseCard>` é `React.memo`'d com props shallow-comparável.
4. **Web Vitals em PostHog** — TTI, INP, LCP por device class.
5. **Sentry tracing** — RPC duration, FCM latency end-to-end (cron envia → device recebe).
6. **Admin dashboards** em `admin.dosymed.app`:
   - `/sync-health` — taxa de optimistic_overwrite_blocked, rolled_back, mutation errors.
   - `/perf` — Web Vitals percentis por versão.
7. **Verificação UI real** (Chrome MCP) — em conta `teste-plus@teste.com`, executar 30 ações de marcação em 60 segundos, monitorar console errors, network requests, INP.

8. **Dashboard query optimization (banner "Sincronizando dados..." em conta de volume real)** — bloco novo descoberto durante validação Fase 1 em device físico do user (2026-05-20). Diagnóstico: a conta pessoal do owner tem 2.421 doses no histórico (2.115 dentro da janela default do Dashboard) + Analytics dispara 2 queries paralelas (current + previous period) cada uma podendo paginar até 5.000 rows. Em rede lenta isso passa de 8s → trigger do `isStaleSync` em [`src/pages/Dashboard.jsx:95`](src/pages/Dashboard.jsx) → banner aparece. Não é bug; é sintoma estrutural. Três sub-tarefas:

   **8.1. Reduzir janela default do Dashboard** — `applyDefaultRange` em [`src/services/dashboardService.js:8-9`](src/services/dashboardService.js) hoje é `DEFAULT_RANGE_PAST_DAYS = 30` + `DEFAULT_RANGE_FUTURE_DAYS = 60` (90 dias, 2.115 rows na conta real). Trocar para `-7d / +14d` (21 dias, estimado ~120 rows). Dashboard renderiza só doses do filtro inline (12h/24h/48h/7d/10d) — manter janela maior que o filtro máximo (10d) é desperdício. Janelas históricas continuam via DoseHistory, Reports, Analytics (que passam range custom explícito). Mesma mudança aplicada em `dosesService.js:52-53` para alinhar.

   **8.2. Esconder banner durante mount inicial** — [`Dashboard.jsx:95`](src/pages/Dashboard.jsx) usa `dataUpdatedAt` do TanStack, que vem hidratado da sessão anterior (PersistQueryClient 24h). Resultado: na primeira reabertura do app após >8s sem usar, banner aparece falsamente porque `dataUpdatedAt` é do dia anterior. Fix: guard `isStaleSync` com `sessionMountedAt` (ref local na primeira render bem-sucedida da sessão) — só ativar banner se já houve pelo menos 1 fetch bem-sucedido nesta sessão (não usar timestamp persistido cross-session). Mantém o uso legítimo (refetch após reabrir tela com dados frescos no cache).

   **8.3. Investigar e unificar `useDoses` paralelos não-Dashboard** — em [`src/pages/Analytics.jsx:62-67`](src/pages/Analytics.jsx) o componente chama `useDoses` 2× (current period + previous period pra comparativo trend). Cada query pode paginar até 5×1000 rows. Em refresh com período 30d, são 60 dias de dados em duas chamadas paralelas — frequente trigger de >8s. Opções (decidir na fase): (a) criar RPC nova `medcontrol.get_analytics_payload(p_from, p_to, p_prev_from, p_prev_to)` que retorna ambos períodos em 1 round-trip; (b) `useDoses` ganha opção `compareToPeriod` que internamente combina; (c) carregar `prevDoses` lazy (só quando user expande comparativo). Auditar também outros callers de `useDoses` com range custom em telas montadas no mesmo session (cache stale fica ativo se TanStack mantém observers).

**DoD:**

- ✅ Bundle inicial < 600 KB gzipped (hoje provavelmente 800-900 KB).
- ✅ INP p75 < 200 ms em device baixo-end (Moto E ou similar).
- ✅ Marcar 30 doses em 60 s sem freeze visível.
- ✅ Sync error rate < 0.5% em PostHog.
- ✅ **Banner "Sincronizando dados..." não aparece em conta com 2.000+ doses em WiFi normal.** Validar com a conta pessoal do owner (sem mutar dados — apenas pull-to-refresh + observação) e em conta `teste-plus` com batch de 1.500 doses históricas inseridas via SQL para repro.
- ✅ Bytes/refresh do Dashboard caem >50% (medir via Sentry breadcrumb HTTP).

---

## 6. Métricas de sucesso

| Métrica | Baseline (v0.2.3.14) | Alvo pós-refactor |
|---|---|---|
| Tempo médio entre toque "Tomada" e UI atualizar | 200-1000 ms (depende rede) | < 50 ms (otimista imediato) |
| Frequência de "status fantasma" (status volta após confirmar) | Reportado "às vezes, mas o tempo todo" | 0 (RealtimeGate + versioned cache) |
| Frequência de "botão preso" obrigando fechar app | "O TEMPO TODO mas não sempre" | 0 (sem disabled bloqueante) |
| Egress estimado por user/dia (FCM + DB) | ~30-140 FCM/dia + RPCs | -40% (remove dose-fire-time-notifier; consolida invalidations) |
| Hooks com responsabilidade ambígua | 21 hooks, 6 com sobreposição | 21→16 hooks, 0 sobreposição |
| Multiple sources of truth | 7 (tabela 1.3) | 0 |
| Comentários `legacy`/`débito`/`TODO`/`FIXME` no código | 30+ identificados | < 5 |
| Bugs P0/P1 abertos | 0 P0, 0 P1 no momento | manter 0; reabertura de P2 documentada |
| Scripts QA | 47 untracked | <15 organizados |
| Blocos JSX inline duplicados (empty states, listas doses, chips de período, form rows, stat grids) | >15 blocos repetidos em 5+ páginas | 0 — todos via componentes (§11) |
| LOC removidos por componentização | — | 500-800 LOC |
| Bundle size inicial gzipped | ~800-900 KB (estimado) | < 600 KB |
| INP p75 device baixo-end | desconhecido (sem instrumentação) | < 200 ms |
| Sync error rate (mutations) | desconhecido | < 0.5% |
| Bytes transferidos por refresh Dashboard (conta com 2k+ doses) | ~3 MB (3.000 rows paginadas) | < 500 KB (janela −7d/+14d) |
| Banner "Sincronizando dados..." em uso normal | aparece em conta volumosa após pull-to-refresh | nunca aparece em rede normal |

---

## 7. Riscos e mitigação

### R1. Refactor em curso colide com hotfix de produção

**Risco:** novo bug P0 em Internal Testing exige fix imediato; branch de refactor atrapalha.

**Mitigação:**

- Branches de refactor sempre `refactor/fase-N-tema` (claro no nome).
- Master sempre shippable. Hotfix em `release/v0.2.3.X` independente.
- Cada fase tem **DoD obrigatória antes do merge**. Sem DoD, não merge. Sem merge, sem release.

### R2. Plugin Java fixes quebram alarme em devices específicos

**Risco:** Samsung One UI, Xiaomi MIUI, Motorola Pure Edition têm comportamentos próprios. Race fix com synchronized pode introduzir deadlock em device específico.

**Mitigação:**

- Validação device físico obrigatória em pelo menos 3 fabricantes antes de cada release Fase 2.
- `alarm_audit_log` em prod captura todo schedule/fire/cancel — anomalia detectável.
- Rollback rápido (Play Console Internal Testing permite múltiplas tracks).

### R3. RealtimeGate sobrescreve estado servidor legítimo

**Risco:** cuidador A confirma dose; Realtime informa cuidador B; gate bloqueia se B tinha mutation em flight em outra dose.

**Mitigação:**

- Gate é **per-key específica** (não global). `['doses', 'doseId-X']` em flight não bloqueia `['doses', 'doseId-Y']`.
- Janela de bloqueio expira em `LATENCY_BUDGET = 2 s` (suficiente para a maioria das mutations, curto o bastante pra não causar stale).
- Audit `mutation.optimistic_overwrite_blocked` em PostHog detecta anomalia.

### R4. Versioned cache + `_localActedAt` causa data drift

**Risco:** clock skew entre device e server. `_localActedAt` (Date.now() do device) vs `_serverConfirmedAt` (NOW() do banco) podem divergir minutos.

**Mitigação:**

- Não comparar timestamps absolutos. Comparar **diferença entre ações** no mesmo cliente.
- Reconciler usa `_localActedAt` como TTL (não foi sobrescrito em 2 s = aceita server).
- Tolerância de clock drift verificada em testes.

### R5. Internal Testing perde testers durante refactor

**Risco:** sequência v0.2.4 → v0.2.8 = 5+ releases em 4 meses; testers fatigam.

**Mitigação:**

- Cada release tem release notes claras sobre o que mudou (formato `docs/play-store/whatsnew/`).
- Fase 1 entrega valor visível (app deixa de travar). Testers continuam motivados.
- Recrutamento contínuo via Reddit (#131 em STATE.md) cobre churn.

### R6. Refactor expande de escopo e nunca termina

**Risco:** "while we're at it" syndrome. Refactor de 16 semanas vira 32 semanas.

**Mitigação:**

- Cada fase tem **time-box explícito** (4+4+3+3+2 = 16 semanas).
- DoD não inclui "perfeito"; inclui "métricas atingidas".
- Itens de "nice-to-have" ficam em ROADMAP, não em refactor.

---

## 8. Apêndice — Mapa de arquivos por fase

### Fase 1 (Sync resiliente)

**Criar:**

- `src/state/realtimeGate.js`
- `src/state/versionedCache.js`
- `src/hooks/useDosyMutation.js`
- `src/hooks/useDosyQuery.js`
- `scripts/qa/qa_sync_stress.mjs`

**Modificar:**

- `src/hooks/useRealtime.js` — integrar gate; debounce 2.5 s.
- `src/services/mutationRegistry.js` — debounce 1.5 s; gate integration; `_localActedAt` stamp.
- `src/hooks/useDoses.js` — usar `useDosyMutation`.
- `src/components/MultiDoseModal.jsx` — `pendingDoseId` local; sem disabled coletivo.
- `src/components/DoseModal.jsx` — `aria-busy` em vez de `disabled`.
- `src/components/DoseCard.jsx` — confirmar feedback inline.
- `src/pages/Dashboard.jsx` — `handleRefresh` checa mutation cache.
- `src/main.jsx` — `flushPersistImmediate` audit + possível mover para idle callback.

**Sem mudança:** banco, Edge Functions, plugin Java.

### Fase 2 (Alarmes)

**Criar:**

- `supabase/functions/request-schedule-sync/index.ts`
- `supabase/migrations/YYYYMMDD_doses_snooze_local_acted.sql`
- `supabase/migrations/YYYYMMDD_drop_dose_notifications.sql`
- `supabase/migrations/YYYYMMDD_rpc_snooze_dose.sql`
- `supabase/migrations/YYYYMMDD_rpc_bulk_confirm_doses.sql`

**Modificar:**

- `android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/AlarmService.java` — `ConcurrentHashMap` em vez de static.
- `AlarmActionReceiver.java` — ACK chama bridge → RPC; SNOOZE persiste DB.
- `BootReceiver.java` — query com margem retroativa NOW-2h.
- `src/services/notifications/` → renomeado `src/services/scheduling/` + arquivos consolidados.
- `src/App.jsx` — removidos useEffects de reschedule client-side.
- `src/services/criticalAlarm.js` — bridge atualizada para snooze+ack.

**Remover:**

- `src/services/notifications/scheduler.js` (legacy path)
- `src/services/notifications/channels.js` (substituído por Java único)
- `supabase/functions/dose-fire-time-notifier/`
- `supabase/functions/notify-doses/` (stub 410)
- `supabase/functions/schedule-alarms-fcm/` (stub 410)

### Fase 3 (Single source of truth)

**Modificar:**

- `src/hooks/useAuth.jsx` — tier lido de `session.user.app_metadata.tier` (Auth Hook).
- `src/hooks/useSubscription.js` → renomeado `useTier.js` (thin wrapper).
- `src/services/subscriptionService.js` — sem localStorage cache.
- `src/hooks/useAppUpdate.js` — `/version.json` removido; só DB + Play Core.
- `public/version.json` — REMOVIDO.
- `src/utils/generateDoses.js` — REMOVIDO.
- `src/services/mutationRegistry.js` — fallback offline reimplementado.

**Remover/Consolidar:**

- `src/hooks/usePushNotifications.js` (re-export inútil) — remover.
- `src/hooks/useAppResume.js` + `useAppLock.js` → `src/hooks/useAppLifecycle.js`.

### Fase 4 (Componentização + limpeza)

**Criar:**

- `src/components/dosy/EmptyState.jsx` — variantes `no-patients | no-doses | no-treatments | no-results` + props customizáveis.
- `src/components/dosy/DoseList.jsx` — modos `grouped | flat`. Substitui blocos em Dashboard, PatientDetail, DoseHistory.
- `src/components/dosy/DateRangeChips.jsx` — chips horizontal de período. Substitui em FilterBar, DoseHistory, Reports, Analytics.
- `src/components/dosy/FilterPanel.jsx` — schema-driven. Reutiliza PatientPicker + Chip + Status grid.
- `src/components/dosy/StatGrid.jsx` — 2/3-col MiniStat grid.
- `src/components/dosy/TodayDosesStat.jsx` — wrapper HeroGauge + MiniStat para "Doses Hoje X de Y".
- `src/components/dosy/FormRow.jsx` — `label + input slot + helper + error`.
- `src/components/dosy/TreatmentCard.jsx` — substitui inline em PatientDetail + TreatmentList.
- `src/components/dosy/MedicationHistoryGrid.jsx` — substitui inline em SOS + Analytics.
- `src/components/dosy/UnitPicker.jsx` — se confirmado inline em TreatmentForm.
- `src/components/dosy/DoseSheet.jsx` — consolida DoseModal + MultiDoseModal.
- `scripts/qa/run.mjs` — runner parametrizado.

**Modificar:**

- `src/pages/Dashboard.jsx` — usar `<EmptyState>`, `<DoseList grouped>`, `<DateRangeChips>` em FilterBar, `<StatGrid>`, `<TodayDosesStat>`.
- `src/pages/PatientDetail.jsx` — usar `<DoseList flat>`, `<TreatmentCard>`, `<StatGrid>`, `<TodayDosesStat>`.
- `src/pages/DoseHistory.jsx` — usar `<DoseList>`, `<FilterPanel>`, `<DateRangeChips>`.
- `src/pages/Reports.jsx` — usar `<FilterPanel>`, `<DateRangeChips>`.
- `src/pages/Analytics.jsx` — usar `<FilterPanel>`, `<DateRangeChips>`, `<StatGrid>`, `<MedicationHistoryGrid>`.
- `src/pages/Patients.jsx` — usar `<EmptyState>`.
- `src/pages/TreatmentList.jsx` — usar `<EmptyState>`, `<TreatmentCard>`.
- `src/pages/TreatmentForm.jsx` — usar `<FormRow>`, `<UnitPicker>`.
- `src/pages/PatientForm.jsx` — usar `<FormRow>`.
- `src/pages/SOS.jsx` — usar `<FormRow>`, `<MedicationHistoryGrid>`.
- `src/pages/Settings.jsx` — usar `<FormRow>`.
- `src/components/DoseCard.jsx` — usar `<StatusPill>` em vez de `<span>` inline.
- `src/components/FilterBar.jsx` — refactor para usar `<FilterPanel>` internamente (mantém API externa por compat).
- Todo `src/`, `android/`, `supabase/` — varredura regex `legacy|deprecated|REMOVIDO|débito|TODO|FIXME` e limpeza linha-a-linha.

**Remover:**

- `src/components/BottomSheet.jsx` — legacy, 0 imports.
- `src/components/DoseModal.jsx` — substituído por `DoseSheet`.
- `src/components/MultiDoseModal.jsx` — substituído por `DoseSheet`.
- 35+ scripts QA antigos.
- Arquivos vazios / comentários históricos.

### Fase 5 (Performance)

**Criar:**

- `src/perf/webVitals.js` — Web Vitals → PostHog.
- `supabase/migrations/YYYYMMDD_rpc_get_analytics_payload.sql` — RPC nova consolidando current + previous period (sub-tarefa 8.3, opção a).

**Modificar:**

- `src/App.jsx` — `React.lazy` em rotas pesadas.
- `vite.config.js` — bundle splitting otimizado.
- `src/components/DoseCard.jsx` — `React.memo` confirmado.
- `src/services/dashboardService.js` — `DEFAULT_RANGE_PAST_DAYS` 30→7, `DEFAULT_RANGE_FUTURE_DAYS` 60→14 (sub-tarefa 8.1).
- `src/services/dosesService.js` — `DEFAULT_RANGE_PAST_DAYS` 30→7, `DEFAULT_RANGE_FUTURE_DAYS` 60→14 (alinha com Dashboard; callers de janelas históricas — DoseHistory, Reports, Analytics — passam range custom explícito).
- `src/pages/Dashboard.jsx` — guard `isStaleSync` com `sessionMountedAt` (sub-tarefa 8.2). Banner só ativa após primeiro fetch bem-sucedido da sessão atual.
- `src/pages/Analytics.jsx` — substituir 2 `useDoses` paralelos por chamada única a `get_analytics_payload` RPC, ou lazy-load `prevDoses` (sub-tarefa 8.3).
- `admin.dosymed.app` (repo separado) — páginas `/sync-health`, `/perf`.

---

## 9. Apêndice — Como o Dosy v2 do PRD se conecta a este refactor

O `dosy-app/docs/01-PRD.md` define o Dosy v1 (MVP) e v1.5 (pós-launch). Features novas vs medcontrol_v2 (marcadas `(NOVA)`):

- **TTL share** (acesso temporário cuidador) — NÃO faz parte deste refactor. Vai em release dedicada pós-Fase 5.
- **OCR de receita/embalagem** — NÃO faz parte deste refactor. Roadmap separado.
- **Catálogo + regras de espaçamento** — parcialmente já existe (`sos_rules` table + #250 ANVISA autocomplete). Refinamento incremental, fora deste plano.
- **3 níveis de alerta por tratamento (Crítico/Push/Silencioso) per-user** — Fase 2 cria infra para isso (RPC `update_user_prefs` + Edge orquestra). UI final em release dedicada.

Este refactor **prepara o terreno** para essas features sem implementá-las. O que ele garante:

- Camada de scheduling unificada → Crítico/Push/Silencioso é só decisão server-side sobre qual canal usar.
- RPCs idempotentes + audit → OCR pode escrever doses em batch sem corrupção.
- Versioned cache + RealtimeGate → multi-cuidador (já existe) fica confiável (zero status fantasma entre devices).
- Single source of truth do tier → paywall fica trivial.

---

## 10. Próximos passos imediatos (pós-aprovação deste plano)

1. **User valida este documento.** Marca o que muda, o que tira, o que prioriza diferente.
2. **Criar branch `refactor/fase-1-sync` a partir do master.**
3. **Atualizar `context/ROADMAP.md`** com Fase 1 como bloco prioritário, marcar bugs históricos relacionados.
4. **Criar ADR** em `context/decisoes/ADR-014-refactor-completo.md` registrando a decisão de refactor in-place + os 5 princípios.
5. **Implementar Fase 1.** 4 semanas. Validar device físico antes do merge.
6. **Repetir 2-5 para Fases 2-5.**

---

## 11. Inventário de componentes — oportunidades de unificação

> Investigação dedicada feita após o plano principal, em resposta à pergunta "card de dose, filtros, etc. são componentes únicos com props ou cada página reinventa?". Esta seção dá os detalhes técnicos por trás da Fase 4 (§5). Toda a análise foi feita lendo os arquivos das páginas (Dashboard, Patients, PatientDetail, PatientForm, TreatmentForm, TreatmentList, DoseHistory, SOS, Analytics, Reports, Settings, More, Admin, FAQ, Login, etc.) e do diretório `src/components/`.

### 11.1 O que **já está bem unificado** (não mexer)

| Componente | Função | Páginas que importam | Status |
|---|---|---|---|
| `PatientPicker.jsx` (246 LOC) | Dropdown searchable de pacientes | FilterBar, TreatmentForm, SOS, Reports, DoseHistory | ✅ Excelente |
| `MedNameInput.jsx` (241 LOC) | Autocomplete medicamento (user history + ANVISA) | TreatmentForm, SOS | ✅ Excelente |
| `ConfirmDialog.jsx` | Modal centered confirm/cancel | SOS, Settings, PatientDetail, TreatmentForm, Dashboard | ✅ Reutilizado em 4+ páginas |
| `PatientAvatar.jsx` | Render emoji/photo | DoseCard, PatientPicker, Patients, PatientDetail, Reports, Analytics, DoseHistory | ✅ Reutilizado em 7+ páginas |
| `Card`, `Button`, `Sheet`, `Modal`, `Input`, `Chip`, `Toggle` (primitivas em `src/components/dosy/`) | Primitivas de design | Todas as páginas | ✅ Padrão |
| `PageHeader` + `AppHeader` (dosy) | Title bar + global header | Todas as páginas | ✅ Complementares |
| `BottomNav` | Nav inferior 5 abas | App.jsx wrapper | ✅ Único |
| `Skeleton.jsx` | SkeletonList placeholders | Dashboard, Patients, Reports, DoseHistory, Analytics | ✅ Reutilizado em 5 páginas |
| `PaywallModal.jsx` | Upgrade Pro gating | Patients, PatientDetail, Analytics, Reports | ✅ Reutilizado |
| `Icon.jsx` | Lucide wrapper | Todos componentes | ✅ Padrão |

**Conclusão:** o app **já tem base sólida de componentização**. Não é o caso de "tudo está duplicado". O problema é específico em alguns padrões repetitivos que não viraram componente.

### 11.2 O que **está duplicado/quase-duplicado entre páginas** (oportunidades de unificação)

| Padrão | Páginas onde aparece (inline) | Variação | Candidato a componente |
|---|---|---|---|
| **Empty state** ("Nenhum X cadastrado" + icon + button) | Dashboard (hero onboarding), Patients, PatientDetail (sem doses, sem tratamentos), DoseHistory, TreatmentList | 80-90% igual | `<EmptyState>` |
| **Lista de doses** (loop renderizando DoseCard) | Dashboard (agrupada por paciente), PatientDetail (flat), DoseHistory (timeline) | 85% igual em DoseCard; o que muda é wrapper (grouped vs flat vs timeline) | `<DoseList>` |
| **Chips horizontais de período** (12h/24h/48h/7d/etc) | FilterBar (Dashboard), DoseHistory (day strip), Reports (presets), Analytics (7d/30d) | 70% — DoseHistory tem labels diferentes; lógica idêntica | `<DateRangeChips>` |
| **Painel de filtros** (paciente + período + status + tipo) | FilterBar.jsx (Dashboard, completo); Reports e Analytics e DoseHistory têm filtros locais com subset diferente | Cada um inventou o seu | `<FilterPanel>` schema-driven |
| **Stat card 2-col grid** (Adesão + Atrasadas, etc) | Dashboard (MiniStat 2-col), PatientDetail (Adesão hoje + Tratamentos ativos), Analytics (overall %) | 85% igual | `<StatGrid>` |
| **"Doses Hoje X de Y" card** (gauge + texto) | Dashboard (HeroGauge), PatientDetail (stat card) | 90% igual | `<TodayDosesStat>` |
| **Form row** (label + input + helper + error) | TreatmentForm (~15 ocorrências), PatientForm, SOS, Settings | Padrão repete, sem componente | `<FormRow>` |
| **Card de tratamento** (treatment + status + dose count + action) | PatientDetail (lista tratamentos ativos), TreatmentList (lista) | 80% igual | `<TreatmentCard>` |
| **Top/recent medications grid** (med + dose count, layout grid) | SOS (recentMeds), Analytics (topMeds) | 70% — SOS é "últimos usados pra autopreencher", Analytics é "ranking" | `<MedicationHistoryGrid>` com `variant` |
| **Status badge inline** (DoseCard renderiza `<span>` inline, outros usam `<StatusPill>`) | DoseCard inline; DoseModal/MultiDoseModal/Analytics via StatusPill | StatusPill já existe, mas DoseCard ignora | Padronizar uso |
| **Unit picker** (mg/ml/comprimido/gota/jato) em forms | TreatmentForm, SOS — provavelmente inline | A confirmar | `<UnitPicker>` se for o caso |

### 11.3 Top 10 oportunidades de unificação — ordenadas por impacto

> Para cada um: **substitui o quê** (em qual arquivo); **API proposta** (props essenciais); **esforço** (P=≤3h, M=3-8h, G=>8h); **benefício**.

#### 1. `<EmptyState>` — esforço P, alto impacto

- **Substitui:** Dashboard.jsx:394-456, Patients.jsx:73-99, PatientDetail (doses vazias, tratamentos vazios), DoseHistory (dia sem doses), TreatmentList (sem tratamentos).
- **API:** `<EmptyState kind="no-patients" />` ou `<EmptyState icon={<UserPlus/>} title="..." message="..." action={<Button>...</Button>} />`.
- **Variantes built-in:** `no-patients`, `no-doses`, `no-treatments`, `no-results-filter`.
- **Benefício:** ~200 LOC removidos; copy centralizada em 1 lugar; um designer ajusta o visual em 5 telas alterando 1 componente.

#### 2. `<DoseList>` — esforço M, alto impacto

- **Substitui:** Dashboard.jsx:474-533 (grouped por paciente), PatientDetail.jsx:320-380 (flat), DoseHistory.jsx:200-260 (timeline com search).
- **API:** `<DoseList doses={...} mode="grouped|flat|timeline" patients={...} onSwipeConfirm onSwipeSkip onClick emptyState={<EmptyState/>} />`.
- **Internamente:** usa `<DoseCard>` no loop. Wrappers diferentes por mode.
- **Benefício:** Marcação otimista, RealtimeGate, versioned cache (Fase 1) ficam em 1 lugar. Sem dispersão. Refator de lista futura toca 1 arquivo.

#### 3. `<FilterPanel>` schema-driven — esforço M, impacto médio-alto

- **Substitui:** FilterBar.jsx (Dashboard, completo), filtros locais em DoseHistory, Reports, Analytics.
- **API:** 
  ```
  <FilterPanel
    schema={[
      { key: 'range', label: 'Período', type: 'chips', options: [...] },
      { key: 'patientId', label: 'Paciente', type: 'patient-picker' },
      { key: 'status', label: 'Status', type: 'multi-select', options: [...] },
      { key: 'type', label: 'Tipo', type: 'select', options: [...] },
      { key: 'search', label: 'Buscar', type: 'text', placeholder: '...' },
    ]}
    values={values}
    onChange={setValues}
  />
  ```
- **Benefício:** elimina implementação paralela em 3 páginas. Adicionar nova dimensão de filtro (ex: "cuidador que marcou", quando TTL share entrar) = 1 schema entry, 0 código.

#### 4. `<DateRangeChips>` — esforço P, impacto médio

- **Substitui:** chips horizontal scroll em FilterBar (Dashboard), DoseHistory (day strip), Reports (presets), Analytics (7d/30d).
- **API:** `<DateRangeChips ranges={[{key:'12h', label:'12h'}, ...]} value={range} onChange={setRange} />`.
- **Benefício:** centraliza o padrão visual de "scrollable period chips" usado em 4 páginas.

#### 5. `<StatGrid>` — esforço P, impacto médio

- **Substitui:** Dashboard.jsx:338-350, PatientDetail (Adesão + Tratamentos), Analytics (overall).
- **API:** `<StatGrid columns={2} stats={[{label, value, unit, tone}, ...]} />`.
- **Benefício:** padroniza grids de stats em 3+ páginas.

#### 6. `<DoseSheet>` (consolidar DoseModal + MultiDoseModal) — esforço M, impacto médio

- **Substitui:** `src/components/DoseModal.jsx` + `src/components/MultiDoseModal.jsx`.
- **API:** `<DoseSheet doses={[dose1]} mode="auto" />` — `auto` decide:
  - 1 dose → UI completa com edição timing/observação.
  - N doses → fila simplificada (confirm/skip por dose).
- **Benefício:** -1 arquivo. Marcação otimista, RealtimeGate, bulk confirm (Fase 2) integrados em 1 lugar.

#### 7. `<FormRow>` — esforço P, impacto médio

- **Substitui:** padrão `label + input + helper + error` repetido em TreatmentForm (~15x), PatientForm, SOS, Settings.
- **API:** `<FormRow label="..." helper="..." error={...} required>{<input.../>}</FormRow>`.
- **Benefício:** ~200 LOC. Mudar visual de form em todo o app = 1 alteração.

#### 8. `<TreatmentCard>` — esforço P, impacto médio

- **Substitui:** renderização inline em PatientDetail (tratamentos ativos) + TreatmentList.
- **API:** `<TreatmentCard treatment={...} upcomingDoses={n} onEdit={...} onDelete={...} />`.
- **Benefício:** quando entrarem badges "Crítico inerte" (PRD §4.1) ou TTL share, ajuste é em 1 arquivo.

#### 9. `<TodayDosesStat>` — esforço P, impacto baixo-médio

- **Substitui:** hero card Dashboard.jsx:306-350 + stat card PatientDetail.jsx:190-220.
- **API:** `<TodayDosesStat taken={n} total={m} compact={false} showOverdue />`.
- **Benefício:** consolida HeroGauge + MiniStat composition.

#### 10. `<MedicationHistoryGrid>` — esforço P, impacto baixo-médio

- **Substitui:** SOS.jsx:72-82 (recentMeds), Analytics.jsx:135-150 (topMeds).
- **API:** `<MedicationHistoryGrid meds={...} variant="cards|list" showCount onSelect />`.
- **Benefício:** padrão grid de meds reutilizável.

### 11.4 Componentes a remover

| Componente | Por quê |
|---|---|
| `src/components/BottomSheet.jsx` | 0 imports (substituído por `Sheet` em `dosy/surfaces.jsx`). |
| `src/components/DoseModal.jsx` | Substituído por `DoseSheet`. |
| `src/components/MultiDoseModal.jsx` | Substituído por `DoseSheet`. |
| `src/components/dosy/Avatar.jsx` (deprecated) | Substituído por `PatientAvatar`. Confirmar 0 imports antes de remover. |

### 11.5 Componentes que **não** devem ser fundidos

- **`AppHeader`** (global sticky) + **`PageHeader`** (page title bar): complementares, escopos diferentes. Manter ambos.
- **`Sheet`** (bottom, glass) + **`Modal`** (centered): primitivas de surfaces com use cases distintos. Cada uma serve um padrão UX.
- **`ConfirmDialog`** + **`Modal`**: ConfirmDialog é especialização legítima de Modal (não é wrapping ruim). Mantém.
- **`OnboardingTour`** (Framer overlay) vs **Sheets**: padrão visual diferente (tutorial step com highlight de elemento). Mantém.

### 11.6 Inventário de modais e sheets — estado atual

Para mapeamento futuro:

| Modal/Sheet | Tipo | Onde aparece | Base |
|---|---|---|---|
| `DoseModal` | Sheet bottom | Dashboard, PatientDetail | `Sheet` ✓ → consolidar em `DoseSheet` |
| `MultiDoseModal` | Sheet bottom | Dashboard (notif tap) | `Sheet` ✓ → consolidar em `DoseSheet` |
| `SharePatientSheet` | Sheet bottom | PatientDetail | `Sheet` ✓ |
| `DailySummaryModal` | Sheet bottom | NotificationCenter | `Sheet` ✓ |
| `EndingSoonSheet` | Sheet bottom | PatientDetail (treatment ending) | `Sheet` ✓ |
| `PermissionsOnboarding` | Sheet full | Install.jsx | `Sheet` ✓ |
| `ConfirmDialog` | Modal centered | SOS, Settings, etc. | `Modal` ✓ |
| `PaywallModal` | Modal centered | Patients, etc. | `Modal` ✓ |
| `ChangePasswordModal` | Modal centered | Settings | `Modal` ✓ |
| `ForceNewPasswordModal` | Modal centered | Login | `Modal` ✓ |
| `CropModal` | Modal centered | PatientForm (photo) | `Modal` ✓ |
| `OnboardingTour` | Framer overlay | App.jsx first launch | Custom — OK |

Diagnóstico: surfaces **bem padronizadas**. Única simplificação útil é DoseModal + MultiDoseModal → DoseSheet (já em §6 da Fase 4).

### 11.7 Como isso conecta com o resto do plano

- **Fase 1 (Sync resiliente):** mantém `DoseCard` ou refatora pra usar `useDosyMutation`. `DoseList` virá na Fase 4 (não bloqueia Fase 1).
- **Fase 4 (Componentização):** entrega todos os componentes listados aqui. Validação visual em device físico obrigatória.
- **Features futuras (TTL share, OCR, 3-níveis de alerta per-user, IA conversacional, schedule fracionado/tapering):** todas se beneficiam da componentização — exemplos:
  - **3-níveis de alerta per-user** → toggle inline no `<TreatmentCard>` (1 componente, aparece em 2 telas).
  - **TTL share** → badge "Compartilhamento temporário" em `<PatientCard>` (1 componente).
  - **OCR de receita** → modal usando `<Sheet>` já existente; preenche `<FormRow>` (sem nova UI).
  - **Filtros novos** (ex: filtro por cuidador) → schema entry em `<FilterPanel>` (sem mexer em 3 páginas).

### 11.8 Estimativas finais

| Item | Esforço | LOC economizados |
|---|---|---|
| EmptyState | P | ~200 |
| DoseList | M | ~240 (80 × 3 páginas) |
| FilterPanel | M | ~200 |
| DateRangeChips | P | ~80 |
| StatGrid | P | ~60 |
| TodayDosesStat | P | ~40 |
| FormRow | P | ~200 |
| TreatmentCard | P | ~100 |
| MedicationHistoryGrid | P | ~50 |
| DoseSheet (consolidar DoseModal+MultiDoseModal) | M | ~150 |
| Cleanup BottomSheet + comentários debt | P | ~50 |
| **TOTAL** | **3-4 semanas** | **~1.300 LOC** |

> Após a Fase 4, o app passa a ter um **design system aplicado** (não só primitivas espalhadas). Páginas viram composição de componentes; o "boilerplate de tela" some.

---

> **Fim do plano.** Esse documento é a fonte de verdade do refactor. Atualizar conforme decisões mudem (registrar em "Histórico" no rodapé).

## Histórico

- 2026-05-20: Fase 5 expandida com sub-tarefa 8 ("Dashboard query optimization") em 3 itens após diagnóstico em device físico do user. Sintoma: banner "Sincronizando dados... (mostrando última versão conhecida)" aparecendo no Dashboard em uso real. Investigação via `adb logcat` mostrou que: (a) conta pessoal tem 2.421 doses (2.115 dentro da janela default −30d/+60d) e Dashboard pagina em 3×1000 rows; (b) Analytics dispara 2 `useDoses` paralelos (current + previous period); (c) Lógica de `isStaleSync` em `Dashboard.jsx:95` ativa quando `isFetching=true` e `dataUpdatedAt` está entre 8s e 60s atrás — em rede lenta com volume real isso vira hit frequente. Não é regressão da Fase 1 (RealtimeGate/versioned cache não afetam tempo de fetch); é overhead estrutural. 3 sub-tarefas adicionadas: reduzir janela Dashboard −30/+60 → −7/+14 (8.1), guard `isStaleSync` com `sessionMountedAt` para não usar timestamp persistido cross-session (8.2), unificar/lazy-load `useDoses` paralelos em Analytics via RPC nova ou opt-in (8.3). DoD inclui "banner não aparece em conta com 2.000+ doses em rede normal" e "bytes/refresh Dashboard caem >50%". Fase 5 duração 2 → 3 semanas. Métricas e apêndice de arquivos §8 atualizados.
- 2026-05-19 (segunda passada): §11 "Inventário de componentes — oportunidades de unificação" adicionada após pergunta do user sobre componentização (card de dose / filtros reutilizáveis). Investigação dedicada por Explore agent cobriu Dashboard, Patients, PatientDetail, PatientForm, TreatmentForm, TreatmentList, DoseHistory, SOS, Analytics, Reports, Settings, More, Admin, FAQ, Login + `src/components/` inteiro. Conclusão: base de componentes já sólida (PatientPicker, MedNameInput, ConfirmDialog, primitivas Card/Button/Sheet/Modal reutilizadas em 4-7 páginas cada). 10 oportunidades concretas de unificação identificadas (EmptyState, DoseList, FilterPanel schema-driven, DateRangeChips, StatGrid, DoseSheet consolidando DoseModal+MultiDoseModal, FormRow, TreatmentCard, TodayDosesStat, MedicationHistoryGrid) — ~1.300 LOC economizados, 3-4 semanas. Fase 4 do plano principal expandida pra incluir tudo. Sumário executivo, métricas e apêndice §8 atualizados.
- 2026-05-19: Versão inicial. Investigação feita por 4 agents Explore em paralelo cobrindo (a) fluxo de marcação de dose, (b) reschedule + sync resiliente, (c) duplicidades + sources of truth, (d) banco + Edge + Android. Cruzamento com `BUGS.md`, `STATE.md`, `APP.md`, `PROJETO.md`, PRD do Dosy, Personas do Dosy. Base: `master @ v0.2.3.14` (vc 77).
