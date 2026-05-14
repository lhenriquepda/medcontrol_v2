# Roadmap de Lançamento — Dosy

> **Documento de entrada.** Se você é um chat novo retomando o trabalho, comece aqui. Este arquivo é self-contained: tem contexto, estado atual, onde paramos, próximo passo, mapa dos demais arquivos e checklist macro completo.

---

## 📍 Legenda visual (global)

> Referência rápida usada em todo doc — §6 catálogo, §3 onde paramos, §6.3 Δ release log.

**Status do item** (4 principais):

| Emoji | Status | Significado |
|---|---|---|
| ✅ | **concluído** | Item fechado e mergeado em commit |
| ⏳ | **aberto** | Falta começar / em fila / aguardando priorização |
| 🚫 | **cancelado** | Não-aplicável / superseded por outro item / fora de escopo |
| 🚨 | **problema/pendência** | BLOQUEADO (Google review, dependência externa, decisão pendente) ou risco aberto |

**Status secundários** (uso opcional):

| Emoji | Status | Quando usar |
|---|---|---|
| 🚧 | em progresso | Iniciado mas ainda não fechado |
| ⏸️ | bloqueado dep | Aguardando outro item interno fechar |
| ⏭️ | parqueado | Movido pra release futura específica (ex: v0.2.2.0+) |

**Categorias §6** (cada item pertence a 1):

| Ícone | Categoria | Escopo |
|---|---|---|
| 🚀 | **IMPLEMENTAÇÃO** | Caminho launch Play Store — compliance Console + recrutamento testers + Production gate |
| ✨ | **MELHORIAS** | Incrementais visuais/UX/perf não-bloqueadoras |
| 🐛 | **BUGS** | Correções de bug específicos (Sentry, user-reported, audit findings) |
| 🔄 | **TURNAROUND** | Mudanças drásticas (redesign visual, pivot Negócio, schema breaking change) |

**Bolinhas prioridade** (cada item P0-P3):

| Bullet | Prioridade | SLA |
|---|---|---|
| 🔴 | **P0** | Bloqueador — fechar antes próxima release ou launch |
| 🟠 | **P1** | Alta — fechar próximas 1-2 releases |
| 🟡 | **P2** | Média — 30 dias pós-launch |
| 🟢 | **P3** | Baixa — 90 dias pós-launch / backlog |

---

## 🛠️ Regra de manutenção (CRÍTICA — leia ANTES de atualizar)

**`ROADMAP.md` (este arquivo) e `CHECKLIST.md` são complementares, não-redundantes:**

| Documento | Propósito | Granularidade |
|---|---|---|
| **ROADMAP.md §6** | **Lista RESUMIDA** organizada em **4 categorias** (🚀/✨/🐛/🔄) com sub-prioridade P0/P1/P2/P3 — visão macro | 1-2 linhas por item (descrição curta + status visual + bullet prioridade + commit/release) |
| **CHECKLIST.md** | **Lista DETALHADA** das tarefas — visão técnica completa | Entry completo (snippet, deps, aceitação, racional, links auditoria) |

**Compartilham numeração:** `#001` ROADMAP = `#001` CHECKLIST. Toda mudança de status atualiza **AMBOS**.

**Categorias §6** (ver §6.1 Legenda):
- 🚀 **IMPLEMENTAÇÃO** (§6.4) — caminho launch Play Store
- ✨ **MELHORIAS** (§6.5) — incrementais não-bloqueadoras
- 🐛 **BUGS** (§6.6) — correções
- 🔄 **TURNAROUND** (§6.7) — mudanças drásticas

**Bolinhas prioridade:** 🔴 P0 · 🟠 P1 · 🟡 P2 · 🟢 P3

**Status:** ✅ fechado · 🚧 em progresso · ⏳ aberto · 🚨 BLOQUEADO · ⏸️ bloqueado dep · 🚫 cancelado · ⏭️ parqueado

**Workflow obrigatório por sessão:**

1. **Item fechado?**
   - ROADMAP §6 → mover entry pra §6.8 "Items fechados — referência cronológica" (linha simples `- ✅ #XXX ... commit hash`) na sub-seção da release
   - CHECKLIST §#XXX → `**Status:** ✅ Concluído @ commit {sha} ({YYYY-MM-DD})`
   - ROADMAP §6.2 sub-counter: decrementar categoria/prioridade
   - ROADMAP §6.3 Δ Release log: documentar item fechado
   - Update log da release → seção "Items fechados v0.X.Y.Z"

2. **Item novo descoberto?**
   - **Decidir categoria** (🚀/✨/🐛/🔄) + prioridade (P0/P1/P2/P3)
   - ROADMAP §6 → adicionar `- ⏳ **#XXX** [PRIORIDADE] {descrição curta}` na sub-seção certa (ex: §6.6 P2 pra BUG médio)
   - CHECKLIST → criar entry completo com `**Categoria:**` + `**Prioridade:**` (template em `README.md` Regra 1)
   - ROADMAP §6.2 sub-counter: incrementar categoria/prioridade
   - ROADMAP §6.3 Δ Release log: documentar item novo
   - Update log → seção "Items novos descobertos"

**Próximo número livre** (numeração cross-categoria global):
```bash
grep -oE "#[0-9]{3}" contexto/ROADMAP.md contexto/CHECKLIST.md | sort -u | tail -5
```

**Drift histórico observado:** items fechados sem update CHECKLIST → re-implementação acidental → conflito git. Última auditoria 2026-05-05 fechou ~60 discrepâncias acumuladas v0.1.7.4-v0.2.0.11. Rodar auditoria semestral cross-ref ROADMAP × CHECKLIST × `updates/*.md`.

**Detalhe completo das regras:** `contexto/README.md` Regra 1.

---

## 1. Contexto rápido

**App:** Dosy — Controle de Medicação (PWA + Capacitor → Android final, package `com.dosyapp.dosy`).
**Versão atual:** `0.2.1.3` · master @ tag `v0.2.1.3` (publicada 2026-05-07 — vc 51 Internal + Closed Alpha promovida). Pre-Reddit hardening: 5 fixes (#018 AdMob real ads · #162 v1+v2 TreatmentForm warning + toggle Dias/Semanas/Meses · #170 In-App Review API · #189 UpdateBanner versionName · #190 BUG-LOGOUT-RESUME). **Android Play Store: vc 51 Internal Testing publicado**, Closed Alpha aguarda Google review (~24-72h).
**Vercel deploy:** `https://dosymed.app/` (custom domain) rodando v0.2.1.3 (master). Contas teste: `teste-free@teste.com / 123456` (tier free, paywall ativo) + `teste-plus@teste.com / 123456` (tier plus). Conta antiga `teste03` deletada.
**Supabase plano:** **Pro** (upgrade 2026-05-05 pra destravar grace period egress). Considerar downgrade após validação 24h pós-fixes #134-#136.
**⚠️ Nota:** existe projeto Vercel separado servindo `dosy-app.vercel.app` (em outra conta/org), travado em v0.2.0.4 — docs antigos referenciam mas NÃO é o canônico atual.
**Stack:** React 19 + TanStack Query 5 + Supabase 2.45 + Vite 5 + Capacitor 8.3 + Firebase FCM + Sentry + PostHog. Tier promo Plus ativa.

**Estado atual de testing:**
- ✅ Internal Testing **live** (URL opt-in: `https://play.google.com/apps/internaltest/4700769831647466031` · só user + agente, decisão pular recrutamento conhecidos)
- 🟡 Closed Testing: pronto pra configurar — bloqueadores formais Console fechados (#004 ✅ vídeo FGS + #025 ✅ screenshots + #003 ✅ pwd + #008 ✅ Sentry + Política Privacidade ✅ + Intent tela cheia ✅). Próximos passos: #129 Google Group + #130 Console track + #131 recrutamento externo + #132 gate 14d/12 ativos.
- 🔒 Open Testing / Produção pública: bloqueado até #132 gate cumprido (#133 solicita produção via Console)

**Veredito da auditoria:** ⚠️ **PRONTO COM RESSALVAS**.
- Score médio: 7.0/10 across 25 dimensões.
- Base sólida (alarme nativo, RLS defense-in-depth, LGPD coberta, bundle 64 KB).
- 9 bloqueadores P0 antes de Open Testing público.

---

## 2. Mapa dos arquivos `/analise/`

| Arquivo | Quando usar | Tamanho |
|---|---|---|
| **`README.md`** | Visão sumária 1 página + score por dimensão + estrutura da pasta | 9 KB |
| **`ROADMAP.md`** (este) | Entrada de qualquer novo chat. Macro + onde paramos + próximo passo | 15 KB |
| **`auditoria/01-relatorio-completo.md`** | Relatório técnico completo das 25 dimensões com evidências | 33 KB |
| **`auditoria/02-resumo-executivo.md`** | Brief executivo 2-3 páginas (top 3 forças, top 5 bloqueadores, ações imediatas) | 8 KB |
| **`CHECKLIST.md`** | Detalhe de cada item: snippet de código, esforço dias-pessoa, dependências, critério de aceitação | 24 KB |
| **`auditoria/04-supabase.md`** | DB profundo: tabelas, RLS, RPCs, edge functions, custos, SQL audits prontos | 19 KB |
| **`auditoria/05-codigo.md`** | Frontend: TanStack Query anti-patterns, deps, código morto, performance | 17 KB |
| **`auditoria/06-bugs.md`** | 15 bugs com classificação [ANDROID]/[AMBOS]/[WEB-ONLY] + severidade | 18 KB |
| **`auditoria/07-usabilidade.md`** | Diário live nav + friction log + personas + recomendações UX | 15 KB |
| **`08-limitacoes-web.md`** | Itens [WEB-ONLY] (alarmes nativos, biometria, push real) — fora do checklist | 9 KB |
| **`archive/plan-original.md`** | Cópia do `Plan.md` original (62 KB, 1055 linhas) — fonte de verdade do roadmap pre-auditoria |
| **`archive/security-original.md`** | Cópia `SECURITY.md` — vulns pendentes operacionais |
| **`archive/roadmap-original.md`** | Cópia `RoadMap.md` antigo (snapshot pre-Plan.md) |
| **`archive/plan-suggestions-original.md`** | Apêndice antigo |
| **`archive/prompt-auditoria-v2.md`** | Spec original que gerou esta auditoria |

### Como navegar

- **Quero status / próximo passo:** este arquivo §3 e §4
- **Quero ver TUDO que falta fazer:** este arquivo §6 (checklist macro)
- **Quero detalhe técnico de um item:** linkar pro `CHECKLIST.md`
- **Quero entender Supabase profundo:** `auditoria/04-supabase.md`
- **Quero entender frontend / cache / bundle:** `auditoria/05-codigo.md`
- **Quero ver bug específico:** `auditoria/06-bugs.md`
- **Quero entender UX / fluxos navegados:** `auditoria/07-usabilidade.md`
- **Quero contexto histórico do projeto:** `archive/plan-original.md` (Plan.md fontes de verdade)

---

## 3. Onde paramos

**Branch ativa:** `master` (release/v0.2.3.0 merged via `c0cb372`). v0.2.3.2 shipped 2026-05-14.

**Release v0.2.3.2 SHIPPED:**
- ✅ AAB vc 65 build via CLI gradlew (33s autônomo) — root cause loopback descoberto + fix permanente
- ✅ Play Console Internal Testing publicado 14/05 14:46 BRT (track: `https://play.google.com/apps/internaltest/4700769831647466031`)
- ✅ Tag `v0.2.3.2` pushed origin (commit `e277aa6` master merge)
- ✅ Master merge `c0cb372` pushed → Vercel auto-deploy prod dosymed.app
- ✅ Validar.md 62 [x] / 0 pending — todos FLUXOs v0.2.3.1 + legacy fechados
- ✅ 4 bugs P1/P2 fechados (#227 RLS audit, #228 multi-device push, #229 snooze persist, #230 batch=1)
- ✅ Audit infrastructure 100% funcional (6 sources)
- ✅ whatsnew-pt-BR atualizado v0.2.3.2

**CLI gradlew destravado v0.2.3.2 — bug Windows historicamente bloqueante:**
- **Root cause definitivo:** filter driver (não identificado individualmente) bloqueia AF_UNIX especificamente em `C:\Users\<user>\AppData\Local\Temp`. JDK NIO `PipeImpl.LoopbackConnector` (init Selector) usa AF_UNIX nesse temp → `connect0` retorna "Invalid argument".
- **Não é Kaspersky:** pausa total da proteção 1h não resolve. Falha persiste.
- **Não é JDK:** testado JDK 21 + 23 + 25 Adoptium Temurin — mesmo erro.
- **Fix:** redirect TEMP/TMP pra pasta sem filter driver (testado `C:\temp\gradle_tmp` OK). JDK 25 obrigatório (assertion mais nova, anteriores funcionam mas 25 alinhado AGP).
- **Comando:** `TEMP='C:\temp\gradle_tmp' TMP='C:\temp\gradle_tmp' JAVA_HOME='/c/Program Files/Eclipse Adoptium/jdk-25.0.3.9-hotspot' PATH="$JAVA_HOME/bin:$PATH" ./gradlew bundleRelease`
- Documentado: `android/gradle.properties` (comment header), `contexto/README.md` §11.

**Commits v0.2.3.2:** `1802853` fix #227-#230 + `a1ea4cd` docs Validar 100% + `2d460b4` docs ROADMAP §3+§6.3 + `e0fde9d` build CLI fix + release notes + AAB published + `c0cb372` merge master.

**Próximo passo:** aguardar feedback testers Play Console Internal Testing. Próximas releases podem usar CLI direto (sem Studio GUI).

**Pós-ship sessão validação emulator autônoma 2026-05-14 ~18:10 UTC (Pixel8_Test AVD criado via avdmanager CLI):**
- ✅ Setup completo CLI autônomo: AVD criado, emulator boot, APK debug install, login UI via ADB input + uiautomator dump
- ✅ #227 audit log RLS — runtime validado 6 sources populando (js_scheduler 4 rows pós-login + edge_trigger_handler:fcm_sent + java_fcm_received batch_start/scheduled/batch_end pós dose insert)
- ✅ #228 push_subscriptions device_id_uuid — 2 rows android coexistem (vc 65 install 18:05 + vc 64 prévio 14:17), unsubscribeFcm filter funcionando
- ✅ Dose flow end-to-end: SQL INSERT dose +3min → statement-level trigger → Edge v21 fcm_sent → DosyMessagingService receive → AlarmScheduler scheduleDoseAlarm → alarm fired @ 18:13 (user confirmou)
- 🐛 **#231 NOVO P2 BUG** descoberto runtime — banner AdMob renderiza no topo viewport em emulator Pixel8_Test x86_64 Android 15. Não reproduz device físico real. Esforço 2-4h plugin investigation.

CLI gradlew + Appium-style ADB UiAutomator2 fluxo COMPROVADO 100% autônomo end-to-end. Próximas validações podem rodar sem intervenção GUI.

**Refactor v0.2.3.1 — 4 auditorias + 7 blocos implementação (2026-05-13):**

- `contexto/auditoria/2026-05-13-alarme-push-auditoria.md` (auditoria 1, 563 linhas — bugs B-01 a B-15)
- `contexto/auditoria/2026-05-13-alarme-push-auditoria-FUNDO.md` (auditoria 2 — 4 root causes arquiteturais RC-1 a RC-4)
- `contexto/auditoria/2026-05-13-alarme-push-codigo-morto.md` (auditoria 3 — 23 itens código morto)
- `contexto/auditoria/2026-05-13-alarme-push-releitura-linha-por-linha.md` (auditoria 4 — 5 achados A-XX + 3 B-XX)
- `contexto/auditoria/2026-05-13-alarme-push-FINAL-fluxo-e-refactor.md` (consolidado + plano 7 blocos)
- `docs/alarm-scheduling-v0.2.3.1.md` (novo doc fluxos atualizados, substitui `docs/archive/alarm-scheduling-shadows-pre-v0.2.3.1.md`)

**7 blocos implementados (8 commits):**
- **Bloco 1** `0ef1eac` — Cleanup código morto (23 itens: 2 Edge stubs + DB orphan + 6 JS exports + 2 Java methods + 4 imports + 5 comentários estale)
- **Bloco 2** `f8596c7` — Fix B-01 (AlarmReceiver cancela PendingIntent tray pendente em AlarmManager) + A-03 (snooze persist via `AlarmScheduler.persistSnoozedAlarm`)
- **Bloco 3** `88d7f17` — **Plano A** unifica tray em Java M2 (`CriticalAlarm.scheduleTrayGroup` + `cancelTrayGroup` + `cancelAllTrays` + BootReceiver re-agenda trays persistidas). Elimina RC-1 (dual tray race) + RC-4
- **Bloco 4** `c8554c3` — **Fix B** AlarmReceiver consulta SharedPrefs `dosy_user_prefs` no fire time → re-rota se prefs mudaram (RC-2)
- **Bloco 5** `0bb8070` — **Fix C** + A-02: trigger statement-level batch UPDATE/DELETE + cancelFutureDoses UPDATE (não DELETE) + handleCancelAlarms reconstrói hash multi-dose group + Edge BATCH_UPDATE/BATCH_DELETE deployed v20 + migration `add_cancelled_status_to_doses`
- **Bloco 6** `5ab1af6` — A-05 consolida SharedPrefs (1 namespace `dosy_user_prefs`) + A-01 doc recomputeOverdue
- **Bloco 7** `0cfef80` — A-04 janela useDoses unificada (-30d/+60d App+Dashboard) + B-02 DailySummary 1 query + docs novos
- **Bump** `ba346ce` — v0.2.3.1 vc 64

**Backend deployed via MCP:**
- Edge `dose-trigger-handler` v20 ACTIVE (BATCH_UPDATE/BATCH_DELETE handlers)
- Edge `daily-alarm-sync` v4 ACTIVE
- Migration `cleanup_orphan_dose_notifications_v0_2_3_1` (DROP tabela + unschedule crons órfãos)
- Migration `dose_change_batch_trigger_v0_2_3_1` (trigger statement-level batch)
- Migration `add_cancelled_status_to_doses_v0_2_3_1`

**Root causes resolvidos:**
- **RC-1** dual tray race (Plano A unifica em M2 Java)
- **RC-2** prefs fire time (Fix B AlarmReceiver consulta SharedPrefs)
- **RC-3** cancel group hash multi-dose (Fix C reconstroi sortedDoseIds.join('|'))
- **RC-4** 5 paths sem coordenação (convergem PendingIntent única)
- **A-01..A-05** documentados/consolidados
- **B-01..B-03** B-01 PendingIntent cancel + B-02 DailySummary 1 query + B-03 cosmético skip

**Última release fechada master — v0.2.2.4 (2026-05-13):**
- ✅ **#214 P2 CLEANUP** — Remove `dose_alarms_scheduled` tabela órfã. Tabela criada em #083.7 (v0.1.7.2) pra `notify-doses-1min` cron skipar push se alarme local já agendado. Cron foi UNSCHEDULED em #209 (v0.2.1.9). Tabela ficou sem consumers leitores — apenas 2 writers (JS scheduler + Java FCM) gerando ~13k upserts/dia/device sem proposto. `alarm_audit_log` v0.2.2.0 substitui rastreio. Mudanças: (a) `src/services/notifications/scheduler.js` remove upsert + imports unused; (b) `DosyMessagingService.java` remove `reportAlarmScheduled()` method + call sites + imports HTTP unused; (c) Migration `drop_dose_alarms_scheduled_v0_2_2_4` aplicada. Economia ~5-10 MB/dia/device egress. Validado Dosy-Dev Studio Run vc 62 com mark/skip/undo doses + E2E 4 caminhos. AAB vc 62 publicado Internal Testing 2026-05-13 16:48 BRT. Tag `v0.2.2.4`.

**Release anterior fechada master — v0.2.2.3 (2026-05-13):**
- ✅ **#213 P1 STORM REAL ROOT CAUSE** — Auditoria via logcat Dosy-Dev (~6min monitoramento) confirmou storm 60s exato gerado por `Dashboard.jsx:99` `setInterval setTick(60s)`. Tick muda → `todayDoses` filter recalcula → useEffect `Dashboard.jsx:222` re-fires → `scheduleDoses(todayDoses)` → `cancelAll` + reagenda 9 alarmes idênticos. Conteúdo zero-mudança. App.jsx top-level signature guard v0.2.2.2 funcionando OK (initial só) mas Dashboard caller sem guard mantinha storm. Fix mínimo: remove caller redundante completo (`useEffect scheduleDoses` + `usePushNotifications` import desnecessários). App.jsx top-level cobre full 48h window. Esperado: 1440 reschedules/dia → ~5/dia (-99.7%). Validado Dosy-Dev Studio Run vc 61: 2 batches em 2.5min depois silêncio. Tag `v0.2.2.3`. AAB Internal Testing pendente.

**Release anterior fechada master — v0.2.2.2 (2026-05-13):**
- ✅ **#212 P1 STORM ROOT CAUSE** — Throttle v0.2.2.1 reduziu impacto mas root cause continuou: app reagendando 1.36 vezes/minuto (~2000/dia esperado ~10). Audit polling 11min confirmou cadência 60s estável + outliers. Egress estimado ~30-40 MB/dia/device em loop. 2 fixes: (a) `useRealtime.js WATCHDOG_INTERVAL_MS` 60s → 300s (5min) — watchdog reconnect cycle era gatilho primário, refetchQueries blanket disparava useEffect rescheduleAll; (b) `App.jsx useEffect` signature guard via `useMemo` — `dosesSignature` calculado por `id:status:scheduledAt` ordenado, useEffect dep usa signature em vez de array ref (mesma referência mas com timestamps microsec diferentes não retriggam). Esperado pós-fix: ~10 rescheduleAll/dia em vez de ~2000.
- AAB vc 60 publicado Internal Testing 2026-05-13 15:14 BRT. Tag `v0.2.2.2`.

**Release anterior fechada master — v0.2.2.1 (2026-05-13):**
- ✅ **#211 P1 HOTFIX** — Storm rescheduleAll 1×/min descoberto via audit v0.2.2.0 imediato pós-deploy. Audit gerou 868 rows em 30min (esperado: ~10). Root causes: realtime invalidation OR useEffect deps changing 1×/min em App.jsx → rescheduleAll re-run cycle, plus `SCHEDULE_WINDOW_MS` 168h (era 48h no plan #209 mas hardcoded errado) gerando 100 doses agendadas/batch, plus audit per-group inserts (10-100/batch) em vez de single batch insert. Fixes: (a) `SCHEDULE_WINDOW_MS = 48 * 3600 * 1000` em `prefs.js` (alinha daily-alarm-sync cron + Worker 6h); (b) Module-level throttle em `scheduler.js` — `RESCHEDULE_THROTTLE_MS = 30000` + `_lastRunAt` + `_pendingTrailing` setTimeout — primeira execução roda imediato, requests dentro janela 30s coalescem em single trailing run com last args; (c) `auditAccumulator` array push em todas paths + single `logAuditEventsBatch` flush pré-return (cobre 3 paths: nothing_to_schedule, error LocalNotifications.schedule, normal). DB-side: GRANT SELECT/INSERT/UPDATE/DELETE service_role + GRANT USAGE schema + GRANT SELECT/INSERT authenticated em alarm_audit_log/config (RLS policies estavam OK, mas table-level GRANTs faltando → silent fail antes deste fix). Limpeza: DELETE 868 storm rows.
- AAB vc 59 publicado Internal Testing 2026-05-13 13:53 BRT. Tag `v0.2.2.1`.

**Release anterior fechada master — v0.2.2.0 (2026-05-13):**
- ✅ **#210 NOVO P1** — Sistema de auditoria de alarmes para `admin.dosymed.app`. Captura cada agendamento/cancelamento/disparo de alarme nos 6 caminhos do sistema (JS scheduler, Java AlarmScheduler, Java Worker, Java FCM received, Edge daily-sync, Edge trigger-handler) e envia pra nova tabela `medcontrol.alarm_audit_log`. Configurável por user_id (`alarm_audit_config` whitelist) — só registra usuários explicitamente habilitados. Cron diário 3:15 UTC limpa registros >7d. **Admin UI:** página `/alarm-audit` com filtros (usuário/origem/ação/dose/período) + clicável → modal detalhes + descrições em linguagem natural pt-BR. Página `/alarm-audit-config` configurar quais users monitorar via email. Seed inicial habilita `lhenrique.pda@gmail.com`. Objetivo: investigar duplicidade/sobreposição/inconsistência entre caminhos pós-#209.
- AAB vc 58 publicado Internal Testing 2026-05-13 10:50 BRT. Tag `v0.2.2.0`.

**Release fechada — v0.2.1.9 (2026-05-13):**
- ✅ **#209 NOVO P0** — Refactor completo sistema alarmes + push. User-reported 2026-05-13: 3 bugs (alarme "Sem Paciente", push 5am pra dose 8am, alarme 8am não tocou). Causas raiz: (1) `DoseSyncWorker.java` hardcoded `patientName: ""` quando Worker era fonte do scheduling; (2) RPC SQL `update_treatment_schedule` sem `AT TIME ZONE` correction → dose `firstDoseTime: "08:00"` BRT salvava `08:00 UTC = 05:00 BRT`; (3) cascata Bug 2 — cron `notify-doses-1min` rodando 5am BRT detectou dose como "agora" + sistema atual com 5 caminhos concorrentes (cron 1min + cron 6h + Worker + JS + trigger) sem coordenação. Fix: (a) Migration SQL `update_treatment_schedule` + `AT TIME ZONE`; (b) Data-fix regenerando doses de todos treatments via RPC fixada (idempotente); (c) `DoseSyncWorker` PostgREST embed `patients(name)` + extract `patientName` + HORIZON 168h→48h; (d) Nova Edge Function `daily-alarm-sync` (cron 8am UTC = 5am BRT, FCM data 48h horizon, retry exponential, multi-TZ); (e) Refactor `dose-trigger-handler` horizon 6h→48h + action `cancel_alarms` em DELETE/status-change; (f) `DosyMessagingService` handler `cancel_alarms` + `AlarmScheduler.cancelAlarm` method; (g) UNSCHEDULE crons `notify-doses-1min` + `schedule-alarms-fcm-6h`; (h) SCHEDULE `daily-alarm-sync-5am`. **Egress estimado -99%** (1440 reqs/dia/user → ~5/dia/user). Plus fix #208 BUG superseded — VERSION_CODE_TO_NAME map +56 +57 entries.
- AAB vc 57 publicado Internal Testing 2026-05-13 10:09 BRT (substituído por vc 58 mesmo dia). Tag `v0.2.1.9`.

**Release anterior fechada master — v0.2.1.8 (2026-05-11):**
- ✅ #205 NOVO P0 — **Single source refresh token (storm xx:00 fix).** Auth-log + SQL `auth.refresh_tokens` revelaram storm 20+ refreshes/minuto em xx:00 (JWT exp 1h). 3 fontes paralelas: JS supabase-js + DoseSyncWorker.java + DosyMessagingService.java cada chamando `/auth/v1/token?grant_type=refresh_token`. Mesmo refresh_token reused → Supabase revoga chain → user re-login forçado a cada 9-12h. Fix: JS ÚNICA fonte refresh; native consome `access_token` cached em SharedPref via plugin `updateAccessToken` (gravado pelo useAuth.jsx em TOKEN_REFRESHED/INITIAL_SESSION). DoseSyncWorker + DosyMessagingService verificam exp local — se expirado, skip rodada (próxima execução periódica pega token fresco pós-refresh JS).
- ✅ #204 expand fixes A1/A2/B/C — Identificados via logcat S25 Ultra. **B**: `await Network.getStatus()` pré-mount React bloqueante. **C**: `onlineManager.setEventListener()` Capacitor única fonte (substitui default subscriber TanStack que disparava espúrio Capacitor WebView). **A1**: createPatient onSuccess marca `_tempIdSource` no cache real; createTreatment mutationFn resolve temp `patientId`→real via lookup `_tempIdSource` (drain FK fix). **A2**: createTreatment onMutate gera doses optimistic local via `generateDoses` → Dashboard renderiza + AlarmScheduler agenda alarme offline. Plus optimistic CRUD completos (updatePatient, updateTreatment, pause/resume/end Treatment, registerSos) + forms edit path detect offline + close imediato.
- ✅ `useOfflineGuard` + `OfflineNotice` — bloqueios features fora queue (share patient, SOS rules, LGPD export/delete, templates) com toast/banner claro "Sem conexão — requer internet".
- ✅ Bug fix `usePatient`/`useTreatment`/`useTreatments` — `initialData` fallback lookup cache lista (PatientDetail offline não trava em "Carregando…"; TreatmentForm edit cache cross-filter).
- ✅ Helper `patchEntityListsInCache` — patch TODAS variações queryKey `[entity, filter]` (fix: pauseTreatment não refletia status visual quando user em `useTreatments({patientId})`).
- AAB vc 56 publicado Internal Testing 2026-05-11 22:45 BRT. Vercel prod deployed 2026-05-12 01:50 UTC. Tag `v0.2.1.8` aponta commit `b7b5c71`.
- **13 validações marcadas** em [`Validar.md`](Validar.md) (8 device logcat + 5 web Chrome MCP + SQL Supabase MCP + Sentry parcial).
- **Pendente cumulativo (não-bloqueador):** 218.9.x #205 (24h SQL refresh_tokens + sessions lifespan) + 207.3 (3 dias alarme) + 207.4/207.5 parciais. Qualquer falha → fix v0.2.1.9+.

**Release anterior fechada — v0.2.1.7 (2026-05-10):**
- ✅ #204 Mutation queue offline — TanStack `networkMode: 'offlineFirst'` + `setMutationDefaults` por chave 12 mutations + bridge `Capacitor.Network` ↔ `onlineManager` + persist mutations + `resumePausedMutations` + OfflineBanner PT-BR. Esforço real ~3h código.
- ✅ #207 Defesa em profundidade alarme crítico (5 fixes) — `advanceMins ?? 0`; `SCHEDULE_WINDOW_MS` 48h→168h + Worker HORIZON 72h→168h; drop `firstResetDoneInSession`; `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` manifest + plugin + UX; Sentry breadcrumbs. Esforço real ~1.5h código.
- ✅ Reestruturação `contexto/` V2 — README entry point Passos 0-14 + `Validar.md` checklist validações manuais + memory project-scoped reorganizada.
- AAB vc 55 publicado Internal Testing 2026-05-09 23:08. Vercel prod deployed 2026-05-10 03:31 UTC. Tag `v0.2.1.7` aponta commit `0edc6b3`.
- **10 checks device-only S25 Ultra pendentes** em [`Validar.md`](Validar.md) — acumular validação com tempo.

**Última release publicada:** v0.2.1.6 em 2026-05-08 (vc 54 Internal Testing) — som customizado de alarme.

**Items v0.2.1.6 fechados (1):**
- ✅ #203 Som de alarme customizado `dosy_alarm.mp3` (96kbps mono, 811KB, 50% redução) — `res/raw/` + `AlarmService` já tinha fallback raw; `AlarmReceiver` channel atualizado pra usar raw + bump `CHANNEL_ID` `doses_critical_v2` pra forçar Android recriar canal. Esforço 30min.

**Release anterior:** v0.2.1.5 em 2026-05-08 (vc 52 + 53 Internal Testing) — bugs alarme/logout + telemetria auth.

**Items v0.2.1.5 fechados (9):**
- ✅ #195 Não DELETAR push_subscription em SIGNED_OUT auto (flag `dosy_explicit_logout`) — vc 52
- ✅ #196 useAuth onAuthStateChange ignora SIGNED_OUT spurious (valida com `getSession()`) — vc 52
- ✅ #197 Cron `notify-doses-1min` fallback push tray (Edge Function `verify_jwt: false`) — vc 52
- ✅ #198 Detectar install/upgrade APK + skip scheduleDoses durante loading (TanStack `isSuccess` guard) — vc 52
- ✅ #199 Cron diário cleanup push_subscriptions stale > 30d — vc 52
- ✅ #200 HORIZON cron 24h→30h + doc `docs/alarm-scheduling-shadows.md` (6 sombras documentadas + matrix cobertura) — vc 52
- ✅ #200.1 `rescheduleAll` idempotente (diff-and-apply JS-only via localStorage `dosy_scheduled_groups_v1`) — vc 52
- ✅ #201 Telemetria auth events com descrições PT-BR (signInEmail/signUp/recovery/sessionRestore/signOut) + painel admin `/auth-log` — vc 53
- ✅ #202 Mutex + debounce em useAppResume previne refresh storm (race condition observada prod 2026-05-08 09:00 BRT: 5 tokens rotacionados em 1.48s → Supabase revogou chain) — vc 53

**Sequência AAB Play Store:**
- vc 52 (publicado 7/mai 23:50, vn 0.2.1.5 — bugs logout + alarme + telemetria inicial)
- vc 53 (publicado 8/mai 11:48, vn 0.2.1.5 — fix #202 refresh storm + telemetria PT-BR)
- vc 54 (publicado 8/mai TBD, vn 0.2.1.6 — som alarme custom #203)

**Release anterior:** v0.2.1.3 em 2026-05-07 (vc 49-51 Internal/Closed Testing) — pre-Reddit hardening (#018 #162 #170 #189 #190).

**Items DESBLOQUEADOS:**
- ✅ #130 Closed Testing track APROVADO Google (2026-05-06) — track ATIVO, desbloqueia #131 recrutamento Reddit
- ✅ #158 fixes Console aceitos (categoria + checkboxes desmarcados) — sem mais rejection

**Release docs-only:** v0.2.1.4 em 2026-05-07 (Vercel apenas + tag git `v0.2.1.4` — sem AAB Play Store) — refactor §6 ROADMAP em 4 categorias visuais + 27 NOVOS items planejamento (#162-#189).

**Items v0.2.1.4 (27 NOVOS items planejamento + 0 código):**
- ✅ Refactor §6 ROADMAP completo (4 categorias + bolinhas + legenda topo)
- ✅ #162 BUG TreatmentForm UX warning Mounjaro repro
- ✅ #163-#168 plano egress otimização escala (RPC consolidado + Realtime broadcast + Delta sync + persist + MessagePack + Cursor pagination + CDN cache)
- ✅ #169-#173 marketing/ASO/growth playbook BR (Play Store ASO + In-App Review + Reddit/Instagram/LinkedIn/TikTok + Healthcare moat #064-#066 promovidos)
- ✅ #174-#187 features differentiators concorrentes (OCR med scan + receita scan auto-import + adesão report PDF/email + WhatsApp share + Modo Alzheimer escalada + Wear OS + health metrics + voz/TTS + symptom diary + refill affiliate + telemedicina + B2B caregiver mode + Apple Health/Google Fit + Memed/Nexodata receita digital BR)
- ✅ #188 🔥 KILLER feature Mini IA Chat NLP cadastro tratamento via escrita/fala natural (Anthropic Claude API tool use)
- ✅ #189 BUG UpdateBanner mostra versionCode → versionName fix
- ✅ #026 followup Sentry whitelist 9º filter Gmail (resolveu emails Sentry em Spam)

**Última release com AAB Play Store:** v0.2.1.2 em 2026-05-06 (versionCode 48) — Console fix #158 + PatientDetail refactor #160 + alerts dismiss #161 + Mounjaro data fix.

**Items v0.2.1.2 fechados (4 features + 1 data fix):**
- ✅ #158 fix #1 Console Apps de saúde — desmarcado todas Medicina checkboxes + texto "Outro" consumer descritivo + re-submit Closed Testing 14 mudanças (Google review ~7d)
- ✅ #158 fix #2 PWA manifest categories ["health","medical","productivity"] → ["health","lifestyle","productivity"] (remove flag medical W3C reduce trigger Google org gate)
- ✅ #160 v1+v2+v2.1 PatientDetail refactor — card "Adesão" → "Doses Hoje X/Y" + bug fix tratamentos 3 sections (Ativos/Pausados/Encerrados via effectiveStatus) + lista doses paciente DoseCard reuso filter 24h/Todas + reorder layout. v2: collapse opcional TODAS 4 seções + Doses dentro Card peach destaque. v2.1: dark mode adaptive (peach-100 var)
- ✅ #161 v1+v2 alerts dismiss refinement — ending date-based 1×/dia + useState mirror localStorage feedback visual immediate (bug v1 não dismissava UI)
- ✅ Mounjaro SQL data fix — paciente Luiz Henrique conta lhenrique.pda durationDays=4→28 + status active + 3 doses pendentes (06/05 13/05 20/05 14:30 BRT)

**Items BLOQUEADOS Google review:**
- 🚨 #130 Closed Testing track aguarda Google re-review pós #158 fixes Console (~24-72h até 7d)
- 🚨 #158 P0 URGENTE — fixes aplicados, aguarda Google decision

**Release anterior:** v0.2.1.1 em 2026-05-06 (Vercel `dosymed.app` + Play Store Internal Testing AAB versionCode 47 + tag git `v0.2.1.1`) — hotfix #159 BUG-LOGOUT.

**Items v0.2.1.1 fechados (1):**
- ✅ #159 BUG-LOGOUT fix useAuth boot validation distinguir transient vs auth failure

**Release anterior:** v0.2.1.0 em 2026-05-05 (Vercel `dosymed.app` + Play Store Internal Testing AAB versionCode 46 + tag git `v0.2.1.0`).

**Items v0.2.1.0 fechados (12):**
- ✅ #007 Telemetria PostHog notification_delivered + tapped (healthcare crítico, 4 listeners Capacitor)
- ✅ #018 cleanup AdSense placeholder index.html
- ✅ #026 ImprovMX 7 emails @dosymed.app + Gmail filtros + fix anti-spam (8º filtro catch-all `to:(dosymed.app)` Never Spam)
- ✅ #036 skeleton screens TreatmentList + Analytics
- ✅ #041 partial (headings audit) + #042 deferred v0.2.2.0+
- ✅ #046 Runbook DR `docs/runbook-dr.md` v1.0
- ✅ #089 BUG-022 fechado organicamente (validado print user Pixel 7)
- ✅ #129 Google Group `dosy-testers@googlegroups.com`
- ✅ #156 v1.3 Privacidade.jsx LGPD + Google Play Health Apps Policy + idade 18+
- ✅ #157 NOVO P0 fix storm useRealtime cascade (12 req/s → 0.02 req/s, 99.7% redução; root cause publication `supabase_realtime` vazia + reconnect cascade; fix targeted: comentar `useRealtime()` em App.jsx:67)
- ✅ Categoria Console Medicina → Saúde e fitness
- ✅ Bump v0.2.1.0 (versionCode 46) + AAB publicado Internal Testing 23:42

**Items BLOQUEADOS Google review:**
- 🚨 #130 Closed Testing track REJEITADO Google (org account required) 2026-05-05 23:30 BRT
- 🚨 #158 NOVO P0 URGENTE — plano 7-passos resolução rejection antes próximo release v0.2.2.0 (ler email Google + estudar policies + analisar app + investigar trigger + decision matrix opção A/B/C)

**Process improvement v0.2.1.0:**
- README Regra 9.1 reforçada — bisect deve usar window igual ao observation original (storm 30s ≠ 5min, false positive risk)
- Investigação multi-camada: Chrome MCP fetch interceptor + WebSocket hook + visibility events (cliente) + Supabase MCP execute_sql + get_logs (backend) + code analysis
- Lições durables: storm escala ao longo do tempo em hidden tab; publication realtime vazia + hook subscribe = silent rate-limit cascade; bug pré-existente latente é mais perigoso que regressão fresh

**Release anterior:** v0.2.0.12 publicada 2026-05-05 (Vercel `dosymed.app` + Play Store Internal Testing AAB versionCode 45 + tag git `v0.2.0.12`).
**Items v0.2.0.11 fechados (12 items — 8 planejados + 4 descobertos validação Chrome MCP):**

**Planejados (8):**
- #144 Custom JWT claim tier (Auth Hook) — backend ✅ migration + function permanente, frontend ❌ ROLLBACK (logout cascade prod)
- #145 useRealtime watchdog scoped refetch (active-only) substitui invalidate blanket
- #146 pg_cron extend batch INSERT verify — audit log + view health + 90d retention
- #029 refactor Settings.jsx 692 LOC → src/pages/Settings/ (index + sections + Row + constants)
- #030 split notifications.js 613 LOC → src/services/notifications/ (5 arquivos)
- #034 virtualizar DoseHistory via @tanstack/react-virtual VirtualTimeline
- #100 avatar emoji redesign — 6 categorias curadas + default 👤 → 🙂 + Saúde category nova
- #009 PITR deferred (Pro add-on $100/mo caro) — DR drill via daily backup baseline capturado

**Descobertos durante validação Chrome MCP preview Vercel (4):**
- #148 Dashboard extend_continuous_treatments rpc 2× por mount (AnimatePresence popLayout) → debounce 60s window flag
- #149 useDoses mutation refetch storm 12 fetches/200s (mark/skip/undo cascade) → debounce 2s timer
- #150 useDoses refetchInterval 5min × 5 active queryKeys = idle storm → 15min interval
- #151 useDoses refetchInterval opt-in só Dashboard (outras telas off) — Realtime cobre updates

**Bug crítico revertido v0.2.0.11:**
- #144 frontend integration causou logout cascade (refreshSession + qc.clear loop infinito)
- Hook Dashboard DISABLED + frontend volta path simples
- Re-tentativa parqueada v0.2.0.12 com plan conservador (read claim only, no auto-refresh)

**Process improvement v0.2.0.11:**
- README Regra 9.1 — validação preview Vercel via Chrome MCP obrigatória antes fechar release
- Receita JS fetch interceptor `window.__dosyNetMonitorV3` — sobrevive SPA navigation
- Bateria interações + idle longo (Bash sleep run_in_background)

**Release anterior:** v0.2.0.10 publicada 2026-05-05 (Vercel `dosymed.app` + Play Store Internal Testing AAB versionCode 43 + tag git `v0.2.0.10`).
**Items v0.2.0.10 fechados:**
- #139 dose-trigger-handler skip se scheduledAt > 6h (-50% a -70% chamadas Edge fn)
- #140 schedule-alarms-fcm HORIZON 72h → 24h (payload FCM 3× menor)
- #141 useReceivedShares staleTime 60s → 5min (-80% calls listReceivedShares)
- #143 useUserPrefs getSession() vs getUser() (-100% calls /auth/v1/user)
- #142 cleanup cosmético JWT cron (drop+recreate sem hardcoded JWT)
- #147 BUG-041 catalogado parqueado v0.2.1.0 (recovery flow link aponta localhost)
- Workaround: SQL reset senha Daffiny pra 123456 (link recovery quebrado em prod)

**Release anterior:** v0.2.0.9 publicada 2026-05-05 12:37 UTC.
**Items v0.2.0.9 fechados:**
- #137 Dashboard 4 useDoses paralelas → 1 query base + filtros memo client-side (-20% a -30% egress)
- #138 DOSE_COLS_LIST sem observation + lazy-load DoseModal (withObservation:true em DoseHistory/Reports)
- #128 BUG-040 patientName payload Edge functions (dose-trigger v10 + schedule-alarms v9 deployed)
- #142 verificado fechado (Legacy JWT secret revoked, PostgREST 401 com JWT antigo)
- Filter "Tudo" → "10 dias" (rangeNow('all') retornava null, quebrava client filter)
- useDoses queryKey fix withObservation deps

**Última release v0.2.0.8:** publicada 2026-05-05 11:23 UTC. Items: auditoria egress (`egress-audit-2026-05-05/`) + 13 items #134-#146 plano + #134-#136 P0 egress fixes (invalidate cascade) + #127 CI lint + #025 + #004 + Closed Testing externo plan + Pro plan upgrade.
**Items v0.2.0.8 fechados:**
- Auditoria egress robusta linha-a-linha (`contexto/egress-audit-2026-05-05/`)
- 13 items #134-#146 plano fixes egress catalogados
- #127 CI lint fix AnimatedRoutes.jsx (libera Sentry source maps)
- #134 useAppResume short idle: REMOVIDO invalidate cascade (-30% a -45% egress estimado)
- #135 useRealtime resume nativo: REMOVIDO invalidate ALL keys (-5% a -10%)
- #136 useRealtime postgres_changes: debounce 1s invalidate (-15% a -25%)
- #128 BUG-040 catalogado
- #025 screenshots + ícone Play Console upload
- #004 vídeo FGS YouTube unlisted + Console form preenchido
- Plano Closed Testing externo #129-#133 (Google Group + Reddit recrutamento)
- Test accounts atualizadas (teste-free + teste-plus, teste03 deletado)
- Regra 9 README (Chrome MCP automation pra Play Console / Vercel / Supabase)

**Items v0.2.0.7:** Dosy Dev FLAG_SECURE off + StatusBar tema sync + #128 BUG-040 catalogado.
**Items v0.2.0.6:** #010 ic_stat_dosy + #017 LockScreen biometria + sync docs.
**Última auditoria:** 2026-05-01 + auditoria-live-2026-05-01.

**Items fechados nas releases v0.2.0.0 → v0.2.0.5 (resumo — detalhe em §6):**
- v0.2.0.0: redesign visual Dosy (peach/sunset palette + primitives)
- v0.2.0.1: #099 avatar crop + #102 atalho hardware silenciar + #103 UpdateBanner + #104 skeleton + #105 MultiDoseModal + #106-old launcher fix partial + #108 PatientForm weight + #109 useRealtime race lock + #096 admin panel tier
- v0.2.0.2: #074 debug symbols NDK + #114 avatar crop UI + #115 photo cache versioned + #045/#048 audits
- v0.2.0.3: #033 React.memo + #040 contraste + #106 launcher full fix + #116 header alertas direct icons + #117 patient_share alert + #118 ending soon + #118-followup + #119 promo client + #120 Plus copy + #121 Escape close + #122 shortName + #123 deleted user signOut
- v0.2.0.4: #028 rate limit + #031/#032/#044/#048 audits + #037 inline errors + #119-followup trigger drop + #125 splash S25 Ultra fix
- v0.2.0.5: #126 gitleaks pre-commit + root cause vazamentos secrets + #024 husky reforçado

**Items fechados na release v0.1.7.5 (egress + race + JWT rotation):**
- ✅ **#092 [P0 CRÍTICO BUG-025]** Egress reduction Supabase: Realtime postgres_changes filter `userId=eq` server-side; subscriptions removido do Realtime; listDoses default range fail-safe (-30d/+60d) + paginate cap 5 pages; useDoses queryKey timestamps normalizados pra hour boundary; useDoses refetchInterval 60s→5min, staleTime 30s→2min; staleTime bump em useUserPrefs/usePatients/useTreatments/useMyTier; App.jsx alarm scope -1d/+14d. Critical alarm path NÃO regrediu.
- ✅ **#093 [P1 BUG-026]** Race condition useRealtime: nome único per-subscribe + await removeChannel + generation counter ignora callbacks de canais antigos.
- ✅ **#094 [P0 trust BUG-027]** Paywall falso pra users plus durante mount race (useMyTier `enabled: !!user` via useAuth + queryKey inclui userId) + DB trigger `enforce_patient_limit` whitelist faltava 'plus' (migration `20260503180000_fix_enforce_patient_limit_plus.sql`).
- ✅ **#095 [P1 UX]** /Ajustes mostra versão real do app via `Capacitor.App.getInfo()` packageInfo (não bundle baked-in que pode ficar stale se cap sync não rodou). Bonus fix FAQ.jsx APP_VERSION hardcoded '0.1.5.7' → __APP_VERSION__ injetado.
- ✅ **#084 [P0 security]** Migração Supabase legacy JWT → sb_publishable_/sb_secret_ + revoke HS256 signing key (key id 855AE81C... revoked) + disable JWT-based API keys. Service_role JWT vazado em commit 85d5e61 = inválido server-side. Edge functions migradas pra `SERVICE_ROLE_KEY` custom env (com fallback). Vercel envs atualizados todos 3 (prod/preview/dev). dosy-app.vercel.app público, Authentication Standard Protection desabilitada.
- ✅ Webhook Vercel↔GitHub reconectado (lhenriquepda/medcontrol_v2 connected via OAuth) — push pra master agora dispara auto-deploy.
- ✅ GitHub Security alert #3 closed as Revoked.

**Items fechados na release v0.1.7.4 (RLS hardening + RPC TZ fix + UX bundle):**
- ✅ #012 #013 RLS hardening — todas policies TO authenticated + split cmd=ALL (48 policies finais)
- ✅ #014 RPC extend_continuous_treatments recriada + reativada client Dashboard
- ✅ #011 `<label>` Login A11y (TalkBack + screen readers — universal)
- ✅ #019 password length 8 + complexity (config.toml + cloud confirmado)
- ✅ #020 Disclaimer médico visível no signup
- ✅ #022 typescript 6.0.3 confirmado legítimo
- ✅ #024 husky + lint-staged pre-commit setup
- ✅ #088 dose-not-shown viewport-specific (refetchOnMount=always)
- ✅ #090 pós-login redirect pra Início (em vez de pathname herdado)
- ✅ **#091 CRÍTICO BUG-024** TZ fix em extend_continuous_treatments — doses futuras com horários fixos agora respeitam America/Sao_Paulo (estavam UTC raw, gerando drift -3h)
- ✅ #086 Resumo Diário UI ocultada (parqueado v0.1.8.0)
- ✅ #015 PostHog Product Analytics dashboard + #016 Sentry alert "Crash spike >10/h"
- ✅ #081 gate validação 24h idle Dosy Dev fechado definitivo
- ✅ APP.md mapa funcional do app criado em contexto/

**Items fechados na release v0.1.7.3 (Ajustes user respeitados):**
- ✅ #085 [BUG-018] Alarme Crítico OFF agora respeitado em todos 6 caminhos (3 Edges + 2 Android nativo + 1 client React). Single source-of-truth via user_prefs.notif.criticalAlarm sincronizado em DB + localStorage + SharedPreferences. Validado emulador Pixel 7 cenários A/B/C.
- ✅ #087 Fase A [BUG-020] DND UX condicional (aparece só se Alarme Crítico ON) + Edges respeitam janela DND (skip FCM data dentro window). Validado emulador. Fase B (Android nativo fire time) parqueada v0.1.7.4.
- ⏸️ #086 [BUG-019] Resumo Diário — UI ocultada em Settings, parqueado v0.1.8.0 (precisa Edge cron + migration timezone).

**Items fechados na release v0.1.7.2 (BUG-016 fix definitivo):**
- ✅ #083 FCM-driven alarm scheduling + 4 caminhos coordenados (Trigger DB <2s + Cron 6h + rescheduleAll + WorkManager 6h). Validado end-to-end: cadastro web → alarme físico tocou no Android. (commits `23deca4` + `3465ab6` + `26c51ab` migration pg_net + `07b77ba` firebase-messaging dep)

**Items fechados na release v0.1.7.1 (defense-in-depth notif idle):**
- ✅ #079 Realtime heartbeat keep-alive (caminho 1)
- ✅ #080 notify-doses reliability + retry exp + cleanup tokens + idempotência (caminho 2)
- ✅ #081 WorkManager DoseSyncWorker periódico 6h (caminho 3)
- ✅ #082 Dual-app dev/prod (`com.dosyapp.dosy.dev` Dosy Dev coexiste com Dosy oficial)

**Items fechados na release v0.1.7.0 (perf + UX):**
- ✅ #023 useDoses background-aware
- ✅ #075 React Query global staleTime
- ✅ #076 useAppResume soft recover
- ✅ #077 useRealtime TOKEN_REFRESHED listener
- ✅ #078 SW cache bump v5→v6

**Items fechados em release v0.1.6.10 (security + encoding):**
- ✅ #001 Admin auth check em `send-test-push` Edge Function (deploy server-side)
- ✅ #002 Sanitizar email enumeration em `send-test-push`
- ✅ #005 Encoding UTF-8 paciente legacy (BUG-001) — cleanup data + verificação UI roundtrip OK

**Em desenvolvimento — release v0.1.7.5 (bundle security + financial + realtime):**

Code done (commit `557dcd9` em `release/v0.1.7.5`):
- ✅ **#092** [P0 CRÍTICO BUG-025] Egress reduction:
  - Realtime postgres_changes filter `userId=eq.X` server-side (era stream multi-tenant)
  - subscriptions removido do Realtime (admin-only writes)
  - listDoses default range fail-safe (-30d/+60d) — antes pull 5+ anos sem from/to
  - listDoses paginate cap 20→5 pages
  - useDoses queryKey timestamps normalizados pra hour boundary (evita refetch storm)
  - useDoses refetchInterval 60s→5min, staleTime 30s→2min, refetchOnMount=always→true
  - useUserPrefs staleTime 30s→10min, usePatients/useTreatments 6s→5min, useMyTier 60s→30min
  - App.jsx alarm reschedule scope -1d/+14d (era pull histórico todo)
- ✅ **#093** [P1 BUG-026] Race condition useRealtime: nome único per-subscribe + await removeChannel + generation counter

Pendente nesta release:
- **#084** [P0 security] Rotação service_role JWT + Vercel↔GitHub reconnect — requer USER actions (OAuth, JWT Roll irreversível, AAB build, Play Console publish)
- **#087 Fase B** [opcional, P1] Android nativo respeitar DND fire time

**Items pendentes pra v0.1.8.0 (próxima minor):**
- **#086** [P1 BUG-019] Resumo Diário fix completo (migration daily_summary_log + Edge cron + timezone)
- **#088** [P1 BUG-021] Dose não aparece em Início sem refresh (TanStack Query invalidate)
- **#089** [P2 BUG-022] Layout AdSense + header truncamento (viewport-specific Pixel 7)

**Process improvements na release:**
- Reorganização `contexto/` (auditoria → snapshot imutável em `auditoria/`, archive de docs históricos em `archive/`)
- Regra 8 README — comunicação com user não-dev (vocabulário, templates de decisão/teste, auto-checagem)
- Modelo "1 sessão = 1 release branch" — `release/v{X.Y.Z}` única, todas mudanças nela, merge → master + tag no fim

**Trabalho prévio (releases anteriores resumo `archive/plan-original.md`):**
- ✅ FASE 0-15: segurança, LGPD, alarme crítico, FCM, A11y partial, code splitting, Sentry, PostHog
- ✅ FASE 18.4.5: hot-fixes pós-deploy
- ✅ FASE 18.5: FAQ in-app
- ✅ FASE 19.1: Internal Testing setup
- ✅ Auditoria externa multidisciplinar 2026-05-01

**Bloqueadores formais Console — TODOS ✅ FECHADOS 2026-05-04/05:**
1. ~~#003 Rotacionar senha postgres + revogar PAT + INFOS.md~~ ✅
2. ~~#004 Vídeo demo `FOREGROUND_SERVICE_SPECIAL_USE`~~ ✅ (YouTube unlisted + Console FGS form salvo)
3. ~~#008 Sentry GitHub Secrets~~ ✅ (secrets criados 2026-04-28; #127 libera aceitação completa via CI)
4. ~~#025 Screenshots phone~~ ✅ (8 screenshots + ícone + assets YT uploadados Console)
5. ~~Política de Privacidade URL~~ ✅ atualizada pra dosymed.app
6. ~~Intent para tela cheia declaração~~ ✅ ("Despertador" + "Sim conceder previamente")

**Próximo gate — Closed Testing recrutamento externo (estratégia 2026-05-05):**
- #129 Criar Google Group `dosy-testers` (~10min user)
- #130 Configurar Closed Testing track Console com Group como tester list (~30min)
- #131 Recrutar 15-20 testers externos via Reddit/redes
- #132 Gate 14 dias × 12+ testers ativos
- #133 Solicitar produção Console

**P0 não-bloqueadores Closed Testing (mas devem fechar antes Production):**
- #006 Device validation 3 devices (manual user — paralelo, opcional pra Closed)
- #009 PITR + DR drill (depende upgrade Supabase Pro plan)
- #007 Telemetria PostHog `notification_delivered` (depende #018)
- #127 CI lint fix AnimatedRoutes.jsx (~30min código, libera Sentry source maps)

---

## 4. Próximo passo imediato

**Estado pós-v0.2.0.11:** master sincronizado com tag `v0.2.0.11`, sem release branch ativa. Validação Chrome MCP preview Vercel confirmou login + logout + Dashboard + Settings render OK + idle 6min = 0 requests.

**Próxima sessão (v0.2.0.12) — sugerida focar:**

| # | Tarefa | Prioridade | Tipo |
|---|---|---|---|
| validar | Egress cycle real 24-48h pós-v0.2.0.11 | P0 | manual obs Supabase Dashboard |
| #144 | Re-tentar JWT claim hook conservador (read only, no auto-refresh) | P1 | code |
| #006 | Device validation 3 devices Android | P1 | manual user |
| #007 | Telemetria PostHog `notification_delivered` (depende #018) | P2 | code |
| #110 | Investigação Android native crashes (NDK symbols disponíveis #074) | P2 | code |
| #086 | Resumo Diário fix completo (Edge cron + timezone) | P2 | code |
| #088 | BUG-021 dose não aparece Início sem refresh | P2 | code |
| #089 | BUG-022 layout AdSense Pixel 7 | P2 | code |
| #147 | BUG-041 reformulação fluxo recuperação senha | P2 | code |

**Closed Testing externo (paralelo, não-bloqueado):**
- #129 Criar Google Group `dosy-testers` (~10min user)
- #130 Configurar Closed Testing track Console com Group como tester list (~30min)
- #131 Recrutar 15-20 testers externos via Reddit/redes
- #132 Gate 14 dias × 12+ testers ativos
- #133 Solicitar produção Console

Branch a criar quando começar v0.2.0.12: `release/v0.2.0.12`.

**Process v0.2.0.12+ (Regra 9.1 README):** validar preview Vercel via Chrome MCP **antes** de fechar branch — fetch interceptor + bateria interações + idle 5min+. Detecta storms cascade + idle polling + double-mount que build local não captura.

---

## 5. Fluxo macro (processo de release)

```
ESTADO ATUAL: Internal Testing ativo
              │
              ▼
        ┌──────────────────────────────────────────┐
        │ FASE A: Fechar P0 (~3-5 dias)            │
        │ #001 send-test-push admin                 │
        │ #003 rotacionar senhas                    │
        │ #005 encoding UTF-8                       │
        │ #007 telemetria notification_delivered    │
        │ #008 Sentry CI secrets                    │
        │ #004 vídeo FGS                            │
        │ #009 PITR + DR drill                      │
        │ #006 device validation 3 devices          │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ FASE B: P1 (~10-15 dias)                  │
        │ ic_stat_dosy, labels, RLS refinement,     │
        │ extend_continuous, PostHog dashboards,    │
        │ Sentry alerts, biometria UI,              │
        │ disclaimer médico, screenshots,           │
        │ keystore backup 3 locais, SAC email...   │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ FASE C: Closed Testing (14 dias passivo) │
        │ Promover AAB → Closed track               │
        │ 12+ testers via Reddit/Google Group       │
        │ Sentry monitora · iterar bugs             │
        │ Critérios saída: 0 crashes 7d, NPS ≥7    │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ FASE D: Open Testing → Produção           │
        │ Rollout 5% → 20% → 50% → 100% (24h cada) │
        │ Crash-free ≥99.5%, ANR <0.5%             │
        │ Marketing + ASO + influencer              │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ FASE E: Pós-launch                        │
        │ P2 backlog (refactor, virtualização,     │
        │ integration tests, pen test profissional) │
        │ P3 backlog (audit_log, 2FA, iOS, i18n,   │
        │ DosyMonitorService Xiaomi/OPPO)           │
        └──────────────────────────────────────────┘
```

---

## 6. Itens (catálogo)

> **Refactor v0.2.1.4** (2026-05-06): §6 reorganizado em 4 categorias visuais (🚀 ✨ 🐛 🔄) com sub-prioridade P0/P1/P2/P3. Cada item mostra status visual (✅ ⏳ 🚫 🚨 — ver §📍 Legenda visual no topo). Items fechados ficam **na posição correta** dentro da categoria/prioridade (ordem ascendente por #), apenas marcados com ✅. Resumo cronológico de releases em §3.

### 6.1 📍 Pointer pra legenda

Tabelas detalhadas (status + categorias + prioridade) ficam no **§📍 Legenda visual (global)** no topo deste doc — usadas em todo o catálogo abaixo + §3 onde paramos + §6.3 Δ release log.

### 6.2 📊 Counter

**Total:** ~231 itens · ✅ **146 fechados** · ⏳ 65 abertos (+#231 P2 emulator Ad position) · 🚧 11 (#170 + #215 #216 #217 #218 #219 #220 #221 #222 #223 #224 #225 #226 código mergeado release/v0.2.3.0 + v0.2.3.1 — #227 #228 #229 #230 FECHADOS v0.2.3.2 2026-05-14) · 🚨 0 BLOQUEADOS · 🚫 3 cancelados (recount 2026-05-14 pós-v0.2.3.2 +4 fixes +#231 emulator-only Ad bug)

**Abertos por categoria × prioridade:**

| Categoria | 🔴 P0 | 🟠 P1 | 🟡 P2 | 🟢 P3 | Total abertos |
|---|---|---|---|---|---|
| 🚀 IMPLEMENTAÇÃO | 6 (#006 #131 #132 #133 #192 #193) | 10 (#021 #169-#171 #173-#177 #188) | 3 (#047 #155 #172) | 0 | 19 |
| ✨ MELHORIAS | 2 (#191 #194) | 3 (#163-#165) | 16 (#035 #038 #039 #042 #043 #049 #166-#168 #178-#181 #183 #222 #225) | 31 (P3 originais + #182 #184-#187 + #223 #226) | 52 |
| 🐛 BUGS | 0 | 6 (#216-#221) | 2 (#101-followup #110 #224) | 0 | 8 |
| 🔄 TURNAROUND | 1 (#215) | 0 | 0 | 0 | 1 |
| **Total abertos** | **10** | **19** | **21** | **31** | **80** |

**Δ 2026-05-11 v0.2.1.8 FECHADA (master @ tag `v0.2.1.8` commit `b7b5c71`; AAB vc 56 Internal Testing 22:45 BRT; Vercel prod 2026-05-12 01:50 UTC):** +**#205 NOVO P0** Single source refresh token — storm xx:00 fix. Investigação SQL `auth.refresh_tokens` durante session lifecycle do user lhenrique.pda revelou pattern: 100% das storms top-of-hour (xx:00:0X), JWT exp default 3600s. 3 fontes paralelas chamando `/auth/v1/token?grant_type=refresh_token`: JS supabase-js auto-refresh + `DoseSyncWorker.refreshAccessToken()` Android WorkManager + `DosyMessagingService.refreshAccessToken()` FCM data handler. Mesmo `refresh_token` SharedPref persisted compartilhado entre 3 contextos → race condition `sp.edit().putString("refresh_token", newRefresh).apply()` corrompe estado → Supabase detecta token reuse → revoga chain inteira → user re-login forçado a cada 9-12h. Logs: 20+ refreshes em 7s mesma session `89867645-...` em 2026-05-11 00:00, session lifespan 16min (vs healthy 1-3h). 8 sessões S25 Ultra em 72h indicando re-login 6×. Fix arquitetura: JS supabase-js é **ÚNICA fonte de refresh**; useAuth.jsx propaga `access_token` + `expires_at` ms → plugin `updateAccessToken` SharedPref `access_token`+`access_token_exp_ms`. DoseSyncWorker + DosyMessagingService.reportAlarmScheduled removem chamadas `refreshAccessToken()` — leem `access_token` cached, verificam exp local com margem 60s, se expirado skip rodada (next periodic run pega token fresco pós-JS refresh em foreground). Plus continuação #204 fixes A1/A2/B/C identificados via logcat S25 Ultra debug session: Fix B (`await Network.getStatus()` bloqueante pré-React mount evita race rehydrate); Fix C (`onlineManager.setEventListener` Capacitor única fonte substitui default TanStack que disparava espúrio em Capacitor WebView Android); Fix A1 (createPatient onSuccess marca `_tempIdSource`; createTreatment mutationFn resolve temp `patientId`→real lookup cache — antes drain failureCount=4 status=error); Fix A2 (createTreatment onMutate gera doses optimistic local via `generateDoses` → Dashboard renderiza + AlarmScheduler agenda offline). Plus optimistic CRUD completos: updatePatient + updateTreatment + pauseTreatment + resumeTreatment + endTreatment + registerSos cada com onMutate cache patch + onError rollback + onSuccess invalidate. Forms edit path PatientForm + TreatmentForm detect offline + close imediato. Novo `useOfflineGuard` hook + `OfflineNotice` component pra features FORA queue (Settings LGPD export/delete, SharePatientSheet, SOS rules saveRule, TreatmentForm saveAsTemplate offline) — bloqueio explícito + toast "Sem conexão — requer internet" + banner contextual. Bump vc 55→56, vn 0.2.1.7→0.2.1.8. AAB pendente publish Internal Testing. Validação device acumulada [`Validar.md`](Validar.md) 22 checks (12 #204 v218.x + 10 #207 v0.2.1.7).

**Δ 2026-05-08 v0.2.1.5/v0.2.1.6 fechados:** +9 v0.2.1.5 (#195 #196 #197 #198 #199 #200 #200.1 #201 #202) + 1 v0.2.1.6 (#203 som alarme custom). Total fechados +10.

**Δ 2026-05-08 v0.2.1.7 (em andamento):** +**#204 NOVO P0 🚀 IMPLEMENTAÇÃO** — Mutation queue offline pré-Teste Fechado. Auditoria offline-first revelou gap crítico healthcare: app abre offline (cache 24h via PersistQueryClientProvider) e mostra dados, mas escritas (confirmar dose, SOS, criar paciente) falham silenciosamente após 3 retries. Fix com React Query nativa (`onlineManager` + `mutationCache` persister) — zero deps novas, zero schema change, drena queue ao reconectar. Bloqueador antes Closed Testing público. Fases 2 (delta sync) + 3 (IndexedDB) já cobertas por #165 P1 (mantém release v0.2.2.0+). Counter: 138 fechados / 70 abertos + 0 BLOQUEADOS.

**Δ 2026-05-07 v0.2.1.3 vc 49-51 (em curso):** ✅ #018 fechado validado device + ✅ #189 fechado validado device + #162 v1 fechado vc 50 / v2 em curso vc 51 (toggle Dias/Semanas/Meses) + #190 NOVO P0 BUG-LOGOUT-RESUME (extends #159, fix vc 50 aguarda validação device pós-install) + #170 In-App Review API + reply playbook code merged (validação natural pós 7d uso ativo).

**Fechados por categoria** (todos inline na posição correta dentro de §6.4-§6.7):

| Categoria | ✅ Fechados | 🚫 Cancelados | Comentário |
|---|---|---|---|
| 🚀 IMPLEMENTAÇÃO | ~17 | 1 (#027) | Launch path infrastructure (security + emails + Console + recrutamento setup) |
| ✨ MELHORIAS | ~66 | 0 | Egress + perf + UX + a11y + features pacientes incrementais |
| 🐛 BUGS | ~31 | 2 (#106-old, #147) | BUG-001 a BUG-041 + Sentry crashes + user-reported |
| 🔄 TURNAROUND | 1 | 0 | Redesign visual Dosy v0.2.0.0 |

> Counter atualizado release v0.2.1.4 (2026-05-06). Recompor exato via `grep -cE "^- (✅\|⏳\|🚨\|🚫) " ROADMAP.md` ou auditoria semestral cross-ref ROADMAP × CHECKLIST. Origem itens: [Plan.md] · [Auditoria] · [BUG-XXX user-reported] · [Sentry] · [Sessão YYYY-MM-DD].

### 6.3 Δ Release log (cronológico)

**Δ 2026-05-14 release/v0.2.3.2 (bug-fixes device validação v0.2.3.1 + Validar.md 100%):** bump vc 64→65, vn 0.2.3.1→0.2.3.2. **4 bugs P1/P2 fechados** descobertos sessão Appium UiAutomator2 emulators Pixel 8 + 10 Pro XL (16k page size):
- **#227 P1** — alarm_audit_log RLS root cause múltiplo: (a) alarm_audit_config sem policy SELECT pra authenticated → WITH CHECK EXISTS falha silenciosamente; (b) alarm_audit_log sem SELECT policy own pra `Prefer: return=representation` PostgREST. **2 migrations:** `alarm_audit_config_user_select_policy_v0_2_3_2` (CREATE POLICY audit_config_user_select FOR SELECT TO authenticated USING user_id=auth.uid) + `audit_log_policies_final_v0_2_3_2` (recreate audit_log_user_insert WITH CHECK user_id=auth.uid AND is_alarm_audit_enabled + ADD audit_log_user_select_own FOR SELECT USING user_id=auth.uid). VALIDADO: SQL `SELECT DISTINCT source FROM alarm_audit_log` retorna 6 sources (edge_daily_sync, edge_trigger_handler, java_alarm_scheduler, java_fcm_received, java_worker, js_scheduler).
- **#228 P1** — `unsubscribeFcm` cross-device contamination: `DELETE WHERE userId AND platform='android'` apagava push_sub de TODOS devices do user. Fix `src/services/notifications/fcm.js:89-99` importa `criticalAlarm.getDeviceId` + `.eq('device_id_uuid', deviceIdUuid)` (fallback legacy se getDeviceId null).
- **#229 P1** — A-03 snooze persist em reboot falhava por `apply()` async. Fix `AlarmScheduler.java` 5 callsites trocados pra `commit()` sync (persistAlarm + saveTrayEntries + persistTrayEntry + removePersistedTrayEntry + removePersisted). RUNTIME validado: SnoozeT3 emulator-5556 audit chain `edge_trigger_handler:fcm_sent → java_fcm_received:scheduled → java_alarm_scheduler:fired_received`.
- **#230 P2** — Edge `dose-trigger-handler` v21 ACTIVE: BATCH_UPDATE/BATCH_DELETE agrupa por (ownerId, patientId, minute_bucket) + query group siblings no mesmo minuto + envia CSV completo. Java handleCancelAlarms agora reconstroi hash sortedDoseIds.join('|') corretamente. Audit row `batchSize=1 groupSize=2 reason=status_change_batch fcmOk=true` confirma server-side.

**Validar.md sweep:** 62 [x] / 0 [~] / 0 [ ] / 0 [skip]. Todos FLUXOs v0.2.3.1 A/B/C/D/E + audit fechados. Legacy v0.2.2.x/v0.2.1.x + 218.x/219.x/220.x fechados com observação direta OU code review + indirect evidence pós-deploy. Pull-to-refresh dashboard validated W3C Actions API gesture.

**CLI gradlew destravado (bonus técnico):** descoberto root cause definitivo do bug Windows que forçava builds via Studio GUI desde início projeto. **Filter driver bloqueia AF_UNIX especificamente em `C:\Users\<user>\AppData\Local\Temp`** — JDK NIO `PipeImpl.LoopbackConnector` (init Selector) usa AF_UNIX nesse temp → native `connect0` retorna `Invalid argument`. Não é Kaspersky (pausa total não resolve), não é JDK (testado 21+23+25 mesmo erro). Diagnóstico binário: bind+connect AF_UNIX OK em `C:\temp`, FAIL em `AppData\Local\Temp`. **Fix:** `TEMP/TMP` redirect pra `C:\temp\gradle_tmp` antes de `./gradlew`. JDK 25 Adoptium Temurin 25.0.3.9 instalado via winget. Build AAB CLI 33s autônomo (substitui Studio GUI manual). Documentado: `android/gradle.properties` header + `contexto/README.md` §11.

**AAB v0.2.3.2 vc 65 published Play Console Internal Testing** 2026-05-14 14:46 BRT via Chrome MCP (§10 receita README). Drag-drop AAB → release notes pt-BR (`<pt-BR>` tag formato) → Salvar e publicar. Disponível ~1h pra ~12.169 dispositivos compatíveis (Telefone) + 6.318 (Tablet) + 8 (TV).

**Commits:** `1802853` fix #227-#230 + `a1ea4cd` docs Validar 100% + `2d460b4` docs ROADMAP §3+§6.3 + `e0fde9d` build CLI fix + release notes + AAB published + `c0cb372` merge release/v0.2.3.0 → master. Tag `v0.2.3.2` em `e277aa6` (master HEAD).

**Master merge:** `c0cb372` pushed origin → Vercel auto-deploy prod dosymed.app.

**whatsnew-pt-BR atualizado:** `docs/play-store/whatsnew/whatsnew-pt-BR` — release notes pt-br user-facing (Soneca reboot + multi-dose 1 alarme + audit log + logout cross-device).

**Counter:** 142+4 = 146 fechados / 78 abertos (4 código mergeado P1/P2 BUGS #227-#230 movidos pra ✅ fechados).

**Δ 2026-05-13 release/v0.2.3.1 (refactor Plano A + Fixes B/C):** **#refactor-v0.2.3.1** rebranding logico v0.2.3.0 → v0.2.3.1 (bump vc 63→64, vn 0.2.3.0→0.2.3.1). 7 blocos implementados em 8 commits após 4 auditorias linha-por-linha descobrindo problemas arquiteturais não cobertos por #215-#226. **4 root causes resolvidos:** RC-1 dual tray race (Plano A unifica em Java M2 via `CriticalAlarm.scheduleTrayGroup` substituindo `LocalNotifications.schedule` foreground path), RC-2 prefs fire time (Fix B AlarmReceiver consulta SharedPrefs dosy_user_prefs antes de fire → re-rota dinâmica), RC-3 cancel group hash multi-dose (Fix C DosyMessagingService reconstroi `sortedDoseIds.join('|')`), RC-4 5 paths sem coordenação (convergem PendingIntent única). **5 achados A-XX + 3 B-XX consolidados:** A-01 doc recomputeOverdue, A-02 cancelFutureDoses UPDATE batch (não DELETE 360 trigger fires), A-03 snooze persist em reboot, A-04 janela useDoses unificada -30d/+60d, A-05 1 namespace SharedPrefs, B-01 AlarmReceiver cancela PendingIntent (não só notif visível), B-02 DailySummary 1 query. **Cleanup 23 itens código morto** removidos. **Backend deployed:** Edge dose-trigger-handler v20 BATCH_UPDATE/BATCH_DELETE handlers + 3 migrations (cleanup_orphan_dose_notifications + dose_change_batch_trigger + add_cancelled_status_to_doses). Counter inalterado (refactor sem novos items #).

**Δ 2026-05-13 release/v0.2.3.0 RODADA 2 (P1 fechamento total Alarme + Push):** +**#216 #218 #219 #226 código mergeado** — 4 items extras pra fechar TODOS P1 órfãos pré-launch. Mudanças: (a) **#216 + #219** Edges `notify-doses` v20 + `schedule-alarms-fcm` v16 deployed como stubs 410 Gone deprecated + verify_jwt:true (sources locais substituídos + endpoints anônimos protegidos); (b) **#218** 15 migrations DB restauradas locais via Supabase MCP `execute_sql schema_migrations.statements` — paridade local↔remote restaurada (add_patient_photo_thumb, replace_photo_thumb_with_photo_version, drop_signup_plus_promo_trigger, 144_jwt_claim_tier_auth_hook, 146_cron_audit_log_extend_continuous, admin_db_stats_function, add_tester_grade_to_subscriptions_v2, fix_update_treatment_schedule_timezone, data_fix_doses_timezone_v0_2_1_9_retry, cron_jobs_v0_2_1_9_daily_alarm_sync, create_alarm_audit_log_v0_2_2_0, cron_alarm_audit_cleanup_v0_2_2_0, grant_service_role_audit_tables, grant_authenticated_audit_tables, drop_dose_alarms_scheduled_v0_2_2_4); (c) **#226** migration `add_device_id_uuid_to_push_subscriptions_v0_2_3_0` applied + RPC `upsert_push_subscription` estendida pra aceitar `p_device_id_uuid` + Java `AlarmAuditLogger` lê SharedPreferences `device_id` UUID estável (não mais `MODEL (MANUFACTURER)`) + JS `fcm.js` + `useAuth.jsx` passam UUID via RPC. Counter: 142 fechados + 12 código mergeado (TODOS items #215-#226 da auditoria fechados em código — pendente validação device S25 Ultra).

**Δ 2026-05-13 release/v0.2.3.0 RODADA 1 (#215 refactor scheduler 3-cenários):** +**#215 P0 TURNAROUND código mergeado** Refactor scheduler unificado 3-cenários + push backup co-agendado. 4 commits (`21f8f32` bump vc 62→63 + `e45d1d5` Etapa 1 helper unificado + `04bbbef` Etapa 2 scheduler.js + `a2eb69c` Etapas 3+4+5). Mudanças: (a) `src/services/notifications/unifiedScheduler.js` NOVO 165 linhas — decideBranch + computeHorizon + buildSchedulePayload; (b) `src/services/notifications/channels.js` canais `dosy_tray` + `dosy_tray_dnd` (vibração leve sem som — decisão 3); (c) `src/services/notifications/scheduler.js` rescheduleAll delega ao unifiedScheduler + janela dinâmica 24/48h (decisão 8); (d) `AlarmScheduler.java` helper `scheduleDoseAlarm` + `cancelDoseAlarmAndBackup` + `isInDndWindow` + hash alinhado `% 2147483647` (#220 incluído) + canais Java side; (e) `TrayNotificationReceiver.java` NOVO — dispara LocalNotification tray no horário; (f) `AlarmReceiver.java` cancela LocalNotification backup ao disparar (anti-duplicate); (g) `MainActivity.cleanupLegacyChannels` remove doses_v2 + doses_critical_v2; (h) `DoseSyncWorker` + `DosyMessagingService` chamam helper unificado; (i) Edge `daily-alarm-sync` v3 deployed — janela dinâmica + chunking 30 doses/FCM (#225 incluído) + source local commitada (#217 incluído); (j) Edge `dose-trigger-handler` v18 deployed — action `cancel_alarms` em UPDATE pending→non-pending + DELETE (#221 incluído) + envia cuidadores via `patient_shares` (decisão 6 + 10) + horizon 6h→48h (#215 B-09 incluído); (k) Migration `expand_dose_change_notify_to_delete_v0_2_3_0` applied — trigger AFTER INSERT/UPDATE/DELETE com OLD record; (l) `CriticalAlarmPlugin.syncUserPrefs` novo (criticalAlarm + DnD) + `useUserPrefs` chama no load + mudanças; (m) `BootReceiver` margem 2h alarme atrasado (#224 incluído); (n) `usePushNotifications.js` deletado (#223 incluído); (o) `AlarmActivity.java` cleanup ~80 linhas código morto (#222 incluído). audit log enriquecido em todos 4 paths com metadata `{branch, horizon, source_scenario}` — admin.dosymed.app `/alarm-audit` funcional. Counter: 142 fechados + 11 código mergeado (não-fechado até device validação).

**Δ 2026-05-13 docs/auditoria-alarme-push (auditoria 2026-05-13):** +12 NOVOS items descobertos via auditoria ponta-a-ponta sistema Alarme + Push (`contexto/auditoria/2026-05-13-alarme-push-auditoria.md`). Varredura completa: 11 arquivos Java native (CriticalAlarm plugin), JS services/notifications/* + criticalAlarm + mutationRegistry + hooks core, 6 Edge Functions (5 locais + daily-alarm-sync deployed-only via MCP), 22 migrations DB confirmadas via Supabase MCP, AndroidManifest + capacitor.config + build.gradle + public/sw.js. **#215** 🔄 P0 TURNAROUND refactor scheduler unificado + push backup co-agendado (cobre B-01 DnD zone silêncio + B-02 criticalAlarm-off silêncio + B-09 horizon desalinhado). **#216-#221** 🐛 P1 BUGS: Edge `notify-doses` referencia tabela DROPADA + drift repo↔prod Edge daily-alarm-sync + drift 15 migrations locais + Edges órfãs expostas + hash JS↔Java mismatch + cancel_alarms sem caller. **#222 #225** ✨ P2 MELHORIAS: consolidar 3 channels Android + cleanup ~150 linhas código morto AlarmActivity + FCM payload chunking 4KB. **#224** 🐛 P2 BUG: BootReceiver perde alarmes <1h margem. **#223 #226** ✨ P3 MELHORIAS: deletar usePushNotifications deprecated + padronizar device_id UUID cross-source. **Análise egress + storm risk:** todas correções zero/baixo impacto egress (LocalNotification local, FCM chunking idempotente, hash alinhamento gera 1 storm transitória ~5s durante migration). Counter: 142 fechados / 82 abertos.

**Δ 2026-05-13 v0.2.1.9 (release/v0.2.1.9 em curso):** +**#209 NOVO P0 🚀 IMPLEMENTAÇÃO** — Refactor completo sistema alarmes + push pós 3 bugs reportados user 2026-05-13. **Bug 1** (alarme "Sem Paciente"): `DoseSyncWorker.java:191` hardcoded `patientName: ""` quando Worker periodic era fonte do alarme scheduling — DB query sem JOIN patients. **Bug 2** (push 5am dose 8am): RPC `update_treatment_schedule` sem `AT TIME ZONE` correction; `date_trunc('day', startDate) + make_interval(8h)` gerava `08:00 UTC = 05:00 BRT`. Compare `create_treatment_with_doses` (correto) que usa `AT TIME ZONE p_timezone`. **Bug 3** (cascata Bug 2 + 8am corretas tb falharam): cron `notify-doses-1min` rodando 5am BRT detectou dose 8am UTC como "agora" + Samsung One UI 7 mata Worker periodic + 5 caminhos concorrentes (cron 1min + cron 6h + Worker + JS + trigger) com lógica `shouldSkipPushBecauseAlarmScheduled` pula push se alarme local agendado, mas alarme local pode ter sido cancelado pelo OS. Fix completo: (a) Migration SQL `update_treatment_schedule` + `AT TIME ZONE` correction + parâmetro `p_timezone`; (b) Migration data-fix idempotente regenerando doses pending de todos treatments ativos via RPC fixada (zero perdas histórico, só pending futuras); (c) `DoseSyncWorker.java` PostgREST embed `patients(name)` + extract `patientName` payload + HORIZON 168h→48h; (d) Nova Edge Function `daily-alarm-sync` v1 (cron `0 8 * * *` UTC = 5am BRT, FCM data 48h horizon, retry exponential 3 attempts, multi-TZ via `user_prefs.timezone`); (e) Refactor `dose-trigger-handler` v16 horizon 6h→48h + action `cancel_alarms` em DELETE/UPDATE pending→non-pending/UPDATE scheduledAt mudou; (f) `DosyMessagingService.java` handler `cancel_alarms` chamando `AlarmScheduler.cancelAlarm`; (g) `AlarmScheduler.java` novo static `cancelAlarm(ctx, id)` + `removePersisted` helper; (h) UNSCHEDULE `notify-doses-1min` + `schedule-alarms-fcm-6h`; (i) SCHEDULE `daily-alarm-sync-5am`. **Egress -99%** estimado (1440 reqs/dia/user → ~5/dia/user). Plus fix #208 BUG superseded (VERSION_CODE_TO_NAME map +56 +57). Plus memory `feedback_release_lifecycle.md` checklist obrigatório.



**Δ 2026-05-05 (sessão pré-v0.2.1.0):** +#128 (BUG-040 backend done v0.2.0.9) +#027 (superseded por #129-#133). Itens revisados sem mudança status: #018 (escopo expandido AdMob+AdSense), #039 (bloqueado pre-req batch select), #007/#026/#036 (proposto v0.2.1.0), #035/#038 (diferido v0.2.2.0+).

**Δ 2026-05-05 v0.2.1.0:** +#129 (Google Group dosy-testers criado via Chrome MCP) +#018 cleanup AdSense placeholder (parcial — flag flip aguarda #133) +#130 (Closed Testing track submetido + **REJEITADO** Google) + categoria **Saúde e fitness** (trocada de Medicina) + detalhes contato `contato@dosymed.app`/`https://dosymed.app` publicados Console + **#026 ImprovMX 7 aliases verified DNS** + Gmail filtros + **#026 fix anti-spam: 8º filtro catch-all** + **#046 runbook DR** + **#156 página `/privacidade` v1.3 LGPD + Health Apps Policy + idade 18+** + **#007 RESTAURADO** (bisect inicial false positive; root cause real era #157) + **#036 skeleton screens** + **#157 NOVO P0 fix storm useRealtime cascade** + **bump v0.2.1.0** (versionCode 46) + **AAB v0.2.1.0 vc 46 publicado Internal Testing 23:42** + **#158 NOVO P0 URGENTE** rejection Google "Política requisitos org account required" — bloqueador Closed Testing público + Production. Counter: 111 fechados / 42 abertos + 2 BLOQUEADOS Google review (#130 + #158).

**Δ 2026-05-06 v0.2.1.1 (hotfix BUG-LOGOUT):** +#159 NOVO P0 fix useAuth boot validation distinguir transient (network/5xx) vs real auth failure (401/403/JWT-invalid). User reportava app desloga toda vez que abria — fix preserva session em network errors transient. Bump v0.2.1.0→v0.2.1.1 (versionCode 47). AAB publicado Internal Testing 08:26. Master merge + Vercel prod sync 13:00.

**Δ 2026-05-06 v0.2.1.2:** +**#158 fix #1** Console "Apps de saúde" desmarcado todas Medicina checkboxes + Outro texto consumer descritivo + re-submit Closed Testing 14 mudanças (Google review ~7d) + **#158 fix #2** PWA manifest.webmanifest categories ["health","medical","productivity"] → ["health","lifestyle","productivity"] (remove flag medical W3C que pode trigger Google org gate) + bump v0.2.1.1→v0.2.1.2 (versionCode 48). +**#160 NOVO P1** PatientDetail refactor — v1: card "Adesão" → "Doses Hoje X de Y" + bug fix tratamentos 3 seções (Ativos/Pausados/Encerrados via effectiveStatus) + lista doses paciente DoseCard reuso filter 24h/Todas + reorder layout. v2: collapse opcional TODAS 4 seções + Doses dentro Card peach destaque + count badge + chevron rotate. v2.1: dark mode adaptive (peach-100 var ao invés gradient fixo). +**#161 NOVO P1** Alerts dismiss refinement — ending date-based 1×/dia (LS_ENDING_SEEN_DATE YYYY-MM-DD), reaparece automático próximo dia. v2: useState mirror localStorage pra feedback visual immediate (bug v1 não dismissava UI). +**Mounjaro data fix SQL** (operacional sem código) — paciente lhenrique.pda durationDays=4→28 + status active + 3 doses pendentes (06/05 13/05 20/05 14:30 BRT). UX root cause parqueado novo #162. Counter: 114 fechados / 43 abertos + 2 BLOQUEADOS Google review.

**Δ 2026-05-08 v0.2.1.7 (em curso — escopo #204 + #207):** +**#207 NOVO P0 código mergeado** Defesa em profundidade alarme crítico (5 fixes, ~1.5h). User reportou 2026-05-08 19:48: push FCM 6min antes OK mas alarme não disparou; histórico inconsistência. Investigação encontrou 4 root causes silenciosos: (1) `advanceMins ?? 15` no scheduler agendava alarme 15min antes do horário se prefs locais incompletos (DEFAULT_PREFS é 0); (2) `SCHEDULE_WINDOW_MS` 48h limitava cobertura local, user que não abria app 49h+ ficava sem alarmes (cron+Worker server-side compensavam parcialmente, mas Samsung One UI 7 mata Worker); (3) `firstResetDoneInSession` cache idempotência #200.1 causava drift silencioso quando OEM matava AlarmManager mas localStorage `dosy_scheduled_groups_v1` continuava dizendo "agendado" → diff vazio → AlarmManager fica vazio; (4) `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission ausente do manifest + sem UX → Samsung One UI 7 colocava Dosy em bucket "rare/restricted" matando todo background activity. Fix: `?? 0` alinha DEFAULT_PREFS + janela 48h→168h + DoseSyncWorker HORIZON 72→168 + drop diff-and-apply (sempre full cancelAll+reschedule) + manifest permission + 3 plugin methods (isIgnoringBatteryOptimizations/requestIgnoreBatteryOptimizations + checkPermissions enriquecido) + 5º item PermissionsOnboarding "Ignorar otimização bateria" + Sentry.addBreadcrumb em rescheduleAll START/END pra rastreio prod. Trade-off: +200-2000ms janela cancelAll vazia por sessão (mitigada async, user não percebe) vs garantia 100% AlarmManager state correto. Build verde 21.11s. **Decisão crítica documentada:** "alarme é CRÍTICO no app" — user explicitamente requer alarme tocar SEMPRE independente de celular/hora/offline. Validação device S25 Ultra pendente. +**#204 código mergeado** (não fechado — validação device pendente). Implementação: `src/services/mutationRegistry.js` novo (setMutationDefaults por chave, 12 mutations críticas — doses state machine + CRUD pacientes/tratamentos + lifecycle + SOS) + `src/main.jsx` networkMode 'offlineFirst' both queries+mutations + bridge `Capacitor.Network.networkStatusChange` ↔ `onlineManager.setOnline` (fallback navigator.onLine web) + `registerMutationDefaults(qc)` antes hydrate + `shouldDehydrateMutation:()=>true` + `onSuccess: resumePausedMutations()` no PersistQueryClientProvider + hooks (useDoses/usePatients/useTreatments) refatorados pra `useMutation({mutationKey:[...]})` lookup + `src/components/OfflineBanner.jsx` novo (banner fixed bottom amber/emerald PT-BR via useIsMutating + useOnlineStatus + transição offline→online). **Auditoria egress completa documentada** em CHECKLIST §#204 (tabela 6 riscos × severidade × mitigação): buster mantido v1 (evita pico refetch global 1x todos users), refetchOnReconnect aceito (staleTime longo cobre), drain N RPCs inevitável (debounce 2s consolida invalidações), resumePausedMutations no-op vazio, persist mutations 100% local, useIsMutating cache local. Net egress incremental ~zero usuários online normais. Build verde 18.18s. **Memória durável criada:** `feedback_egress_priority.md` (consolidar prática auditar egress proativamente em mudanças fetch/persist/realtime).

**Δ 2026-05-06 v0.2.1.4 (em andamento):** +**#162 NOVO P2 BUG** TreatmentForm UX warning intervalHours/24 > durationDays (gerou Mounjaro silent fail). +**Refactor §6 v2** — items fechados redistribuídos **inline na posição correta** (categoria + prioridade certa, ordem # ascendente) marcados ✅; abertos ⏳; bloqueados 🚨; cancelados 🚫. §6.8 antiga (lista cronológica fechados) eliminada — release log cronológico mantido em §3 + §6.3. Legenda visual global movida pro topo do doc. +**#026 followup Sentry whitelist** via Chrome MCP — user reportou Sentry issues em Spam + dúvida sobre TESTE 02 contato@dosymed.app. Investigação: TESTE 02 chegou normal (~7min delay forward chain, SPF/DKIM/DMARC PASS); Sentry sender direto pra dosy.med@gmail.com bypass ImprovMX. Fix: 9º filter Gmail `from:(getsentry.com OR sentry.io)` Never Spam + Mark important + 5 emails Sentry resgatados Spam→Inbox manual. +**Plano egress otimização escala** — investigação Supabase Dashboard cycle 8.74 GB / 250 GB Pro com 4 MAU (=3.75 GB/user/mês ≈ 30× padrão SaaS healthcare). Storm pré-#157 dominou (7.2 GB May 5 → 0.5 GB May 6, redução 14×). Items NOVOS P1 MELHORIAS: **#163** RPC consolidado Dashboard `get_dashboard_payload` (-40% a -60% Dashboard); **#164** Realtime broadcast vez postgres_changes streaming (combinado retomar #157, -80% a -90% Realtime); **#165** Delta sync doses + TanStack persist IndexedDB offline-first (-70% a -90% reads steady state). Items NOVOS P2: **#166** MessagePack Edge functions payload + compression headers (50-70% menor payload); **#167** Cursor pagination + DOSE_COLS_LIST aggressive (status int code) + Supavisor transaction mode pooler; **#168** CDN cache strategy — Vercel CDN bundle/assets + Supabase Storage cache headers + Edge function `cache-control` (aproveitar Cached Egress 250 GB Pro separado, atualmente 0/250). Combined target: 5-10× redução DB egress = preparar Open Testing/Production scale. +**Plano marketing/ASO/growth** — análise concorrentes BR (Medisafe/MyTherapy/Pílula Certa) + forecast realista solo dev sem marketing 1.5K-3K MAU Year 1. Items NOVOS P1 IMPLEMENTAÇÃO: **#169** ASO Play Store keywords+listing+screenshots+A/B test (6-8h); **#170** Reviews strategy In-App Review API + reply playbook (4-5h); **#171** Marketing orgânico Reddit+Instagram+LinkedIn+TikTok playbook BR (8-10h setup); **#173** Healthcare differentiators moat (promove #064 P3→P1 interações med + #065 P3→P1 estoque + #066 P3→P1 lembrete consulta, posicionamento "ÚNICO app brasileiro com..." vs Medisafe/MyTherapy). NOVO P2: **#172** Landing page dosymed.app + blog SEO healthcare BR 12 artigos longtail keywords (12-16h initial + 24h conteúdo). +**Análise gap concorrentes 2 — features faltando** que viram diferencial Production: P1 IMPL: **#174** OCR camera medication scan (foto caixa → auto-cadastro 8-12h); **#175** Receita médica scan OCR auto-import (foto receita → batch treatments, único BR 12-16h); **#176** Adesão report PDF/email pra médico 30/60/90d (B2B trust 6-8h); **#177** WhatsApp share dose status cuidador remoto (cultural BR 3-4h). P2 MELHORIAS: **#178** Modo Alzheimer escalada (alarme intensifica + SMS/WhatsApp cuidador 6-8h); **#179** Wear OS / Galaxy Watch alarme pulso (8-12h); **#180** Health metrics tracking PA/glicemia/peso (10-14h); **#181** Voz/TTS prompts + comando voz acessibilidade (6-8h); **#183** Refill affiliate Drogasil/Pague Menos (4-6h). P3 backlog futuro: **#182** Symptom diary + mood tracking (6-8h); **#184** Telemedicina integration Doctoralia/Conexa (8-12h); **#185** Cuidador profissional B2B mode 5+ residências (16-24h); **#186** Apple Health/Google Fit sync (12-16h); **#187** Memed/Nexodata receita digital BR import (12-20h). User confirmou iOS NÃO promove (#068 mantém P3 — valida Android first antes custo dev iOS). +**#188 🔥 KILLER FEATURE Mini IA Chat NLP** P1 IMPLEMENTAÇÃO — cadastro tratamento via escrita natural ("Desloratadina 10 dias 5ml 8/8h pro Rael" → app preenche cadastro auto). Floating button + Sheet chat + Edge function gateway → Claude API Haiku tool use → structured output → user confirma. Future v0.3.0+: combinado #181 voz/TTS = falar naturalmente. Diferencial MUNDIAL — nenhum concorrente tem. Cost ~R$10/mês 1000 MAU. Esforço 12-18h. Counter: 115 fechados / 67 abertos + 2 BLOQUEADOS (6 escala #163-#168 + 5 growth #169-#173 + 14 differentiators #174-#187 + 1 KILLER #188 = 26 NOVOS plano completo).

---

### 6.4 🚀 IMPLEMENTAÇÃO — Caminho Play Store launch

#### 🔴 P0 — Bloqueadores

- ✅ **#003** [Plan + Auditoria, fechado 2026-05-04] Senha postgres rotacionada via Supabase Dashboard (auto-gen 16-char) + PAT `sbp_aedc82d7` revogado + INFOS.md ausente git history. → [archive/security-original.md](archive/security-original.md)
- ✅ **#004** [Plan, fechado 2026-05-04] Vídeo demo FOREGROUND_SERVICE_SPECIAL_USE — `alarm.mp4` 33s S25 Ultra → YouTube Shorts unlisted https://www.youtube.com/watch?v=qLBCzualcCw → Console FGS form preenchido. Plan FASE 18.9.1
- ⏳ **#006** [Plan + Auditoria] **Device validation FASE 17 em 3 devices físicos.** Manual user, paralelo. → `docs/device-validation-checklist.md`
- ✅ **#007** [Auditoria, fechado v0.2.1.0 (2026-05-05)] Telemetria PostHog `notification_delivered` + `notification_tapped` + `notification_dismissed` (4 listeners Capacitor: localNotificationReceived/ActionPerformed + pushNotificationReceived/ActionPerformed). PII strip auto via `sanitize_properties`. Bisect inicial false positive — root cause real era #157. RESTAURADO via revert. → [01 §14](auditoria/01-relatorio-completo.md#14--observabilidade-e-monitoramento--score-7510)
- ✅ **#008** [Plan, fechado 2026-05-04] GitHub Secrets `SENTRY_AUTH_TOKEN`/`SENTRY_ORG=lhp-tech`/`SENTRY_PROJECT=dosy`/`VITE_SENTRY_DSN` configurados Actions. Aceitação completa pendente #127. Plan FASE 10.1
- ✅ **#009** [Auditoria, fechado v0.2.0.11 — DEFERRED PITR] PITR Pro add-on $100/mo deferred. DR drill via daily backup baseline 2026-05-05. RTO 5-15min RPO 24h. Re-avaliar PITR pós-revenue Q3 2026 / 50+ paying users.
- ✅ **#025** [Plan, fechado 2026-05-04] Screenshots phone — 19 capturadas S25 Ultra (1080×2340), 8 melhores curadas + ícone 512 peach + feature graphic 1024×500 + assets YT. Tudo Console Listagem. Plan FASE 18.9.2
- ✅ **#084** [INCIDENTE 2026-05-02 22:23 UTC, fechado v0.1.7.5 commit `8b32245`] Migração Supabase legacy JWT → sb_publishable_/sb_secret_ + revoke HS256 signing key + disable JWT-based API keys. Service_role JWT vazado em commit 85d5e61 = inválido server-side. Edge functions migradas pra `SERVICE_ROLE_KEY` custom env. Vercel envs atualizados. Webhook Vercel↔GitHub reconectado.
- ✅ **#126** [P0 SECURITY, fechado v0.2.0.5] Pre-commit secret scanning + investigação root cause vazamentos. gitleaks 8.30.1 + .gitleaks.toml + .husky/pre-commit + .github/workflows/gitleaks.yml. 27→0 leaks após allowlist. Postgres pwd Dosy `xoeDZAnfn8TvBD5m` + VAPID rotação manual user-action.
- ✅ **#129** [P0, fechado v0.2.1.0 (2026-05-05) via Chrome MCP] Google Group público `dosy-testers@googlegroups.com` criado. URL https://groups.google.com/g/dosy-testers (HTTP 200 anônimo). Settings: pesquisa "Qualquer pessoa" + auto-aprovação participação + privacy outros campos.
- ✅ **#130** [P0 — APROVADO Google 2026-05-06, Closed Testing track "Alpha" ATIVO] Closed Testing track "Alpha" Console — País Brasil + Tester list `dosy-testers@googlegroups.com` + AAB vc 51 + Release notes pt-BR + Feedback URL Google Group. Rejeição inicial 2026-05-05 (org account) resolvida via #158 fixes; Google aprovou pós #158 fixes v0.2.1.2. Track ativo desde 2026-05-06 mid-day. Desbloqueia #131 #132 #133.
- ⏳ **#131** [P0 — desbloqueado pós #130 aprovação 2026-05-06] Recrutar 15-20 testers externos via Reddit (r/AlphaAndBetausers + r/SideProject + r/brasil + r/medicina/r/saude/r/tdah/r/diabetes) + Twitter + LinkedIn + Discord. Meta: 12+ ativos.
- ⏳ **#132** [P0 gate — bloqueado por #131] Aguardar 14 dias rodando com ≥12 testers ativos + iterar bugs reportados.
- ⏳ **#133** [P0 — bloqueado por #132] Solicitar Production access Console pós-gate. Aprovação Google ~24-72h. Decidir Open Testing 7-14d OU Production rollout direto.
- 🚧 **#207** [P0 v0.2.1.7 — código mergeado, validação device pendente] **Defesa em profundidade alarme crítico — 5 fixes.** User reportou 2026-05-08: push FCM 6min antes funcionou mas alarme não disparou. Histórico inconsistência ("cada hora funciona de um jeito"). Investigação achou 4 root causes + 1 observabilidade. Fixes: (1) `advanceMins ?? 15` → `?? 0` em scheduler.js (alinha DEFAULT_PREFS — alarme tocava 15min antes, não no horário); (2) `SCHEDULE_WINDOW_MS` 48h → 168h (7d) + `DoseSyncWorker.HORIZON_HOURS` 72 → 168 (cobre user que não abre app por dias, Samsung mata Worker); (3) drop `firstResetDoneInSession` cache idempotência diff-and-apply de #200.1 — sempre full cancelAll + reschedule (custo ~200ms vs garantia AlarmManager state correto, drift cache vs SO eliminado); (4) `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission + plugin `isIgnoring`/`requestIgnore` methods + 5º item "Ignorar otimização bateria" em PermissionsOnboarding (CRÍTICO Samsung One UI 7 + Xiaomi MIUI — sem isso OEM mata Worker + cancela alarms); (5) `Sentry.addBreadcrumb` em `rescheduleAll START`/`END` (rastreio prod). Build verde 21.11s. Pendente: validação device S25 Ultra 24h + cenários extremos (dose 2h e 3d futuras, app fechado, reinstalar app). Fase 1.5 backlog: telemetria PostHog + `getActiveAlarms` JS-probe + DosyMonitorService FGS sempre ON. Detalhe completo CHECKLIST §#207.

- 🚧 **#209** [P0 v0.2.1.9 — código mergeado, AAB vc 57 pendente] **Refactor sistema alarmes + push (3 bugs fix + cron diário).** User-reported 2026-05-13: alarme "Sem Paciente", push 5am dose 8am, alarme 8am não tocou. Fix: (a) RPC `update_treatment_schedule` + `AT TIME ZONE` correction; (b) DoseSyncWorker JOIN patients; (c) Nova `daily-alarm-sync` cron diário 5am BRT 48h horizon; (d) `dose-trigger-handler` v16 + action `cancel_alarms`; (e) AlarmScheduler.cancelAlarm + DosyMessagingService handler; (f) UNSCHEDULE crons antigos. Egress -99%. Detalhe completo CHECKLIST §#209.
- ✅ **#205** [P0 fechado v0.2.1.8 2026-05-11, tag `v0.2.1.8`, AAB vc 56 Internal Testing, Vercel prod deployed] **Single source refresh token (storm xx:00 fix).** Investigação SQL revelou pattern 100% das storms top-of-hour (JWT exp 1h). 3 fontes paralelas chamando `/auth/v1/token?grant_type=refresh_token`: JS supabase-js + `DoseSyncWorker.refreshAccessToken()` Android + `DosyMessagingService.refreshAccessToken()` FCM handler. Mesmo `refresh_token` compartilhado SharedPref → race condition `sp.edit().putString` corrompe estado → Supabase detecta reuse → revoga chain → user re-login forçado 9-12h cycle. 20+ refreshes em 7s observados session 89867645-... 2026-05-11 00:00 (lifespan 16min vs healthy 1-3h). Fix: JS ÚNICA fonte refresh; native consome `access_token` cached SharedPref via plugin `updateAccessToken(accessToken, accessTokenExp)`. `useAuth.jsx` listener SIGNED_IN/TOKEN_REFRESHED/INITIAL_SESSION → `setSyncCredentials({accessToken, accessTokenExp})`. DoseSyncWorker + DosyMessagingService.reportAlarmScheduled removem refresh paralelo — leem `access_token` cached + verificam `access_token_exp_ms` local com margem 60s; expirado → skip rodada (next periodic pega token fresco pós-refresh JS foreground). Trade-off: WorkManager rodada eventualmente skip se app não foreground por >1h — aceitável (AlarmManager local já scheduled da rodada anterior, próximas execuções recoveram). Detalhe completo CHECKLIST §#205. Bloqueador antes Closed Testing público — re-logins frequentes degradam UX + Sentry breadcrumbs perdem contexto.

- ✅ **#204** [P0 fechado v0.2.1.7 código base + v0.2.1.8 expand fixes A1/A2/B/C + bugs fixes initialData fallback + patchEntityListsInCache + forms edit offline + useOfflineGuard + OfflineNotice + Validar.md 13 checks marcados] **Mutation queue offline (React Query nativa) — Fase 1 offline-first FECHADA.** Código fechado: `src/services/mutationRegistry.js` com `setMutationDefaults` por chave (12 mutations: confirmDose/skipDose/undoDose/registerSos/createPatient/updatePatient/deletePatient/createTreatment/updateTreatment/deleteTreatment/pauseTreatment/resumeTreatment/endTreatment) — mutationFn + onMutate/onError/onSuccess/onSettled centralizados. `src/main.jsx` com `defaultOptions.{queries,mutations}.networkMode='offlineFirst'` + bridge `Capacitor.Network` ↔ `onlineManager.setOnline()` (fallback `navigator.onLine` web) + `registerMutationDefaults(qc)` antes hydrate + `dehydrateOptions.shouldDehydrateMutation:()=>true` + `onSuccess: resumePausedMutations()`. **Buster mantido v1** (NÃO bumpar — TanStack hydrate tolera campo `mutations` extra; bump invalidaria cache global → pico egress). Hooks viram `useMutation({mutationKey:[...]})` lookup. Novo `OfflineBanner.jsx` PT-BR fixed bottom (amber `N salva(s) offline` ou emerald `Sincronizando…` ≤3s pós-reconnect). Build verde 18.18s. Auditoria egress completa em CHECKLIST §#204 (4 riscos analisados, net incremental ~zero usuários online normais). Pendente: validação device S25 Ultra modo avião (5 doses confirm/skip + criar paciente + reabrir wifi + SQL check) + telemetria PostHog `mutation_queued_offline`/`mutation_drained_online` (Fase 1.5). Bloqueador antes Closed Testing público — testers reais podem perder confirmações offline = dados médicos comprometidos.
- ✅ **#142** [P0 SECURITY, fechado v0.2.0.9 + cleanup v0.2.0.10 commit `bf45f80`] Legacy JWT secret REVOKED (PostgREST 401). Edge function pública via `verify_jwt: false` autoriza via `SERVICE_ROLE_KEY` env interna. Cleanup cosmético: drop+recreate cron job sem header `Authorization` hardcoded.
- ✅ **#154** [P0 INFRA, fechado v0.2.0.12] Custom SMTP Resend pra dosymed.app. DNS Hostinger 4 records (DKIM + MX send → feedback-smtp.sa-east-1 + SPF + DMARC). Domain Resend VERIFIED. Supabase Auth SMTP smtp.resend.com:465 sender Dosy <noreply@dosymed.app>. Recovery OTP funcionando real prod. ADR `decisoes/2026-05-05-resend-smtp-setup.md`.
- ✅ **#156** [P0 BLOQUEADOR #130 — fechado v0.2.1.0 (2026-05-05)] Página `/privacidade` (Privacidade.jsx) v1.3 LGPD healthcare. DPO email `privacidade@dosymed.app` + entidade "Dosy Med LTDA" + terceiros expandidos (Resend SMTP/Firebase FCM/PostHog/Sentry/Supabase São Paulo/AdMob) + dados granular + bases legais art.7-I + art.11-II-f + idade 18+ + Google Play Health Apps Policy. Termos.jsx + FAQ.jsx tb atualizados.
- ✅ **#158** [P0 fechado v0.2.1.2 (2026-05-06) — Google aprovou pós-fixes] Resolveu rejection Google Play Política org account. Console submit Closed Testing rejeitado 2026-05-05; **fixes aplicados v0.2.1.2:** 13 declarações Console Apps de saúde desmarcadas Medicina + categoria Console medical→saude/fitness + manifest categories medical→lifestyle. Google revisou + APROVOU 2026-05-06. Closed Testing track "Alpha" ATIVO desde então (#130 ✅). Desbloqueou #131 #132 #133. ADR `decisoes/2026-05-06-001-rejection-google-fix.md`.

#### 🟠 P1 — Alta

- ✅ **#018** [P1, fechado v0.2.1.3 vc 49 (2026-05-07) — validado device user] AdMob Android prod flag flip `VITE_ADMOB_USE_TEST=true→false` em `.env.production`. Banner real ads ativos pós-AAB build. Validação device real: ad real OR vazio (sem "Test Ad"). AdSense web placeholder mantido (foco mobile). AdMob Console "Veiculação limitada" desbloqueia auto pós Production track (#133).
- ⏳ **#021** [P1, Plan FASE 18.3] **Backup keystore 3 locais seguros.**

> **Plano marketing/ASO/growth (2026-05-07):** análise concorrentes BR (Medisafe/MyTherapy/Pílula Certa) revelou Dosy precisa ataque ofensivo: forecast realista solo dev sem marketing = 1.5K-3K MAU Year 1 (mercado satura ~50K MAU top apps). Items #169-#173 visam crescimento orgânico Year 1 alcançar 5K-10K MAU (vs 1.5K passive). Receita realista ano 1: R$ 5-15K bruto sem ataque marketing; R$ 30-60K com playbook executado.

- ⏳ **#169** [P1 growth v0.2.1.4 NOVO] **ASO Play Store completo — keywords + listing copy + screenshots strategy + A/B test.** (a) Keywords research BR healthcare (target: "lembrete remédio", "alarme medicação", "controle medicamentos idosos", "cuidador medicação", "diabetes lembrete dose"); (b) Listing copy otimizado (título 30 chars com keyword primária + short desc 80 chars + full desc 4000 chars com 5-8 keywords distribuídas sem keyword stuffing); (c) Screenshots strategy — primeiros 3 são 80% conversão (destaque alarme nativo crítico + multi-paciente + compartilhamento cuidadores), 8 total Console (#025 base + 2 novos #155); (d) Vídeo preview Play Console 30s (gravação device real S25 Ultra walkthrough); (e) Localized FAQ pre-launch teasing #064 #065 #066; (f) A/B test screenshots via Play Console experiment (50/50 split, 2 semanas). Esforço 6-8h. Detalhe completo CHECKLIST §#169.
- 🚧 **#170** [P1 growth v0.2.1.4 — código merged v0.2.1.3 vc 50, validação device pendente] **Reviews Play Store strategy — In-App Review API + reply playbook.** Plugin `@capacitor-community/in-app-review` integrado em `useInAppReview.js`. Reply playbook `docs/reviews-reply-playbook.md` criado. Trigger inteligente: pós 3 doses tomadas + alarme disparou OK + 7 dias uso ativo (não show no boot). Response templates Console (3 categorias). Meta launch: 4.3+ rating + 50+ reviews mês 6 + reply rate >90%. Validação natural: aguardar tester real bater triggers (não dá pra forçar). Detalhe completo CHECKLIST §#170.
- ⏳ **#171** [P1 growth v0.2.1.4 NOVO] **Marketing orgânico playbook BR — Reddit + Instagram + LinkedIn + TikTok.** (a) Reddit BR target subs: r/saude, r/idosos, r/cuidadores, r/diabetes, r/tdah, r/bipolar, r/depressao, r/brasil (post útil + signature dosymed.app, evitar spam ban); (b) Instagram strategy: hashtags BR healthcare (#cuidadosaude #cuidadoidoso #saudemental #medicacao), parcerias 5-10 microinfluencers cuidadores (10K-50K followers, R$ 100-300/post permuta); (c) LinkedIn healthcare BR (médicos/farmacêuticos/cuidadores profissionais — content B2B trust); (d) TikTok healthcare BR (POV cuidadora 30s vídeos UX); (e) Content calendar 3 posts/semana 6 meses (90 posts initial). Esforço 8-10h setup + 2-3h/semana ongoing. Detalhe completo CHECKLIST §#171.
- ⏳ **#173** [P1 growth v0.2.1.4 NOVO] **Healthcare differentiators moat — promover #064 + #065 + #066 P3→P1.** Análise concorrentes: Medisafe/MyTherapy faltam features healthcare deep BR. Dosy pode criar moat real: (a) **#064 promovido P1**: verificação interações medicamentosas + alergias (parceria FDA OpenFDA API ou DataBase Brasil ANVISA); (b) **#065 promovido P1**: estoque medicação + alerta "está acabando" (input quantidade restante + cálculo dias até zero baseado em interval); (c) **#066 promovido P1**: lembrete consulta médica + integração Calendar (.ics export). Posicionamento marketing: "Dosy = ÚNICO app brasileiro com verificação interações + estoque + agenda médica integrada". Esforço cada: #064 8-12h (mais complexo), #065 4-6h, #066 3-4h. Total 15-22h. Detalhe completo CHECKLIST §#173 + atualização entries §6.5 P3 #064/#065/#066.

> **Análise gap concorrentes (2026-05-07) — features faltando que viram diferencial Production launch:** #174-#177 atacam onboarding friction + cultural BR + B2B trust (areas onde Medisafe/MyTherapy traduzidos US não otimizam pra Brasil). Items P1 launch differentiators críticos.

- ⏳ **#174** [P1 growth v0.2.1.4 NOVO] **OCR camera medication scan — auto-cadastro via foto caixa.** User fotografa caixa medicamento → ML Kit Text Recognition extrai nome med + dose + interval automaticamente → preenche TreatmentForm. Reduce onboarding friction 5min → 30s. Plugin `@capacitor-mlkit/text-recognition`. Diferencial onboarding vs Medisafe (parcial scanning) e maioria concorrentes (zero scanning). Esforço 8-12h. Detalhe completo CHECKLIST §#174.
- ⏳ **#175** [P1 growth v0.2.1.4 NOVO] **Receita médica scan OCR auto-import — cria todos treatments paciente via foto receita.** Fotografa receita médica → ML Kit OCR extrai medicamentos + posologia + paciente nome → cria batch treatments associados ao paciente. Onboarding 10× faster. **Único concorrente BR** com essa feature. Plugin ML Kit + parser regex BR (RDC/ANVISA padrão receita) + UX confirmação user antes salvar. Esforço 12-16h. Detalhe completo CHECKLIST §#175.
- ⏳ **#176** [P1 growth v0.2.1.4 NOVO] **Adesão report PDF/email pra médico — 30/60/90 dias.** Generate PDF report (lib `jsPDF` ou Edge function Puppeteer) com: % doses tomadas vs scheduled, doses esquecidas, padrões horário, observações user. Email pra médico via Resend SMTP (#154). Trust healthcare professional + B2B angle. MyTherapy tem weekly email simples; Dosy faz report visual robusto. Esforço 6-8h. Detalhe completo CHECKLIST §#176.
- ⏳ **#177** [P1 growth v0.2.1.4 NOVO] **WhatsApp share dose status — cuidador remoto.** Botão "Compartilhar status" em PatientDetail → abre WhatsApp Web/app com mensagem pré-formatada ("Mãe tomou Mounjaro 14:30 ✅") via `whatsapp://send?text=...` deep link. Cultural BR forte (90%+ smartphones BR usam WhatsApp). Filha distante vê mãe tomou remédio = trust + word-of-mouth orgânico. Nenhum concorrente BR tem. Esforço 3-4h. Detalhe completo CHECKLIST §#177.
- ⏳ **#188** [P1 growth v0.2.1.4 NOVO 🔥 KILLER FEATURE] **Mini IA Chat — cadastro tratamento via escrita/fala natural.** Floating button bottom-right (Dosy primary) → Sheet chat. User digita: "Desloratadina 10 dias 5ml 8 em 8 horas pro Rael" → Edge function `parse-treatment-nl` chama Claude API Haiku com tool definition `create_treatment` schema (medName/dose/unit/intervalHours/durationDays/patientName) → LLM retorna structured output → app preview parsed fields → user edita/confirma → salva treatment. **DIFERENCIAL MUNDIAL** — nenhum concorrente tem. Combina onboarding magic (#174 #175 OCR) + UX revolucionária. Future v0.3.0+ : combinado #181 voz/TTS = falar naturalmente "Mãe Mounjaro 5mg semanal por 6 meses começando hoje" → mesmo fluxo. Privacy consent required (envia frase pra Anthropic). Cost: ~R$10/mês 1000 MAU (Haiku) — escala bem. Esforço 12-18h. Detalhe completo CHECKLIST §#188.

- ✅ **#024** [Plan, fechado v0.2.0.5 — parte de #126] Pre-commit hooks. Antes só eslint via lint-staged. Agora gitleaks `protect --staged` (block secrets) + lint-staged (block lint). Husky 9.1.7 + gitleaks 8.30.1 + GitHub Action gitleaks/gitleaks-action@v2.
- ✅ **#026** [Plan — fechado v0.2.1.0 (2026-05-05) via Chrome MCP] Emails oficiais @dosymed.app via **ImprovMX free**. DNS Hostinger 2 MX + SPF TXT. Domain VERIFIED. 7 aliases ativos forward → `dosy.med@gmail.com`: catch-all + contato + privacidade + suporte + legal + dpo + security + hello. Não conflita Resend SMTP #154 (subdomain `send.`). + 8º filtro Gmail catch-all `to:(dosymed.app)` Never Spam. Plan FASE 18.5
- 🚫 **#027** [Plan — superseded v0.2.0.12] Substituído por #129-#133 (estratégia Reddit + Google Group público em vez de pessoas conhecidas). Item original "Closed Testing + 12 testers via amigos" não-aplicável.
- ✅ **#127** [P1 fechado v0.2.0.8] CI lint fix AnimatedRoutes.jsx (libera Sentry source maps upload em CI).

#### 🟡 P2 — Média

- ✅ **#046** [Plan — fechado v0.2.1.0 (2026-05-05)] Runbook DR `docs/runbook-dr.md` v1.0. RTO 5-15min/RPO 24h, baseline prod 2026-05-05, 6 procedures (daily backup restore, JWT roll #084, keystore restore #021, region outage, pós-incidente, drill schedule), 11 components mapeados (DB/Auth/Edge/Realtime/Storage/FCM/Resend/ImprovMX/CDN/AAB), contatos emergência. Plan FASE 23.4
- ✅ **#074** [P2 fechado v0.2.0.2] Habilitar upload debug symbols (`ndk.debugSymbolLevel 'FULL'`). Resolve aviso recorrente Play Console + melhora Sentry NDK stack traces (necessário pra #110 native crashes).
- ⏳ **#047** [P2, Plan FASE 23 backlog] **Google Play Integrity API.**
- ⏳ **#155** [P2 launch polish] **Adicionar 2 screenshots Console pós-v0.2.0.12:** "Alterar senha" Ajustes (#152) + "Recuperar senha código 6 dígitos" Login (#153). Capturar S25 Ultra real prod pós-merge master.
- ⏳ **#172** [P2 growth v0.2.1.4 NOVO] **Landing page dosymed.app marketing + blog SEO healthcare BR.** Hoje dosymed.app só serve PWA + /privacidade + /termos. Adicionar: (a) landing pages /sobre, /pacientes, /cuidadores, /precos com SEO; (b) blog SEO 12 artigos initial 1500+ palavras BR target longtail keywords ("como organizar medicação idoso Alzheimer", "alarme dose esquecida diabético tipo 2", "compartilhar lembrete remédio família WhatsApp", "lembrete medicação ansiedade depressão"); (c) Schema.org `SoftwareApplication` + `MedicalApplication` markup; (d) OG tags + Twitter cards; (e) sitemap.xml + robots.txt + canonical URLs. Esforço 12-16h initial + 2h/artigo (24h total 12 artigos). Detalhe completo CHECKLIST §#172.

---

### 6.5 ✨ MELHORIAS — Incrementais

#### 🔴 P0 — Bloqueadores (egress + critical perf)

- ✅ **#079** [BUG-016, fechado v0.1.7.1 commit `b4812e0`] Realtime heartbeat keep-alive + reconnect automático useRealtime.js. Heartbeat 30s detecta silent fail. Caminho 1 de 3.
- ✅ **#080** [BUG-016, fechado v0.1.7.1 commit `4b82d16`] Edge `notify-doses` retry exponential FCM + cleanup tokens inválidos + idempotência via `dose_notifications` + advanceMins fallback. Caminho 2 de 3.
- ✅ **#081** [BUG-016, fechado v0.1.7.1 commit `49550e4`] Defense-in-depth Android: WorkManager DoseSyncWorker periódico 6h fetcha doses 72h + agenda via setAlarmClock. Independe foreground/websocket/push. Caminho 3 de 3.
- ✅ **#083** [v0.1.7.1→v0.1.7.2 commits `23deca4`+`3465ab6`+`26c51ab`] FCM-driven alarm scheduling + 4 caminhos coordenados. Trigger DB <2s + Cron 6h FCM data + rescheduleAll quando app abre + WorkManager 6h. Push tray inteligente: skip se alarme nativo agendado. Fecha BUG-016 100%. Validado end-to-end device.
- ✅ **#115** [P0 cost+UX, fechado v0.2.0.2] Photo cache versioned. Antes: removeu photo_url de PATIENT_COLS_LIST (egress) → quebrou foto na lista. Fix: coluna `photo_version` SMALLINT (2B) na tabela patients + hook `usePatientPhoto(id, version)` cache localStorage. Foto baixa 1× por device. Storage 100 pacientes × 50KB = 5MB localStorage.
- ✅ **#134** [P0 cost, fechado v0.2.0.8] useAppResume short idle: removido invalidate cascade (-30% a -45% egress).
- ✅ **#135** [P0 cost, fechado v0.2.0.8] useRealtime resume nativo: removido invalidate ALL keys CapacitorApp.resume. -5% a -10% egress.
- ✅ **#136** [P0 cost, fechado v0.2.0.8] useRealtime postgres_changes: debounce 1s invalidate por queryKey. -15% a -25% egress.
- ✅ **#137** [P0 cost, fechado v0.2.0.9 commit `0124608`] Dashboard 4 useDoses paralelas → 1 query base + filtros memo client-side. -20% a -30% egress.
- ✅ **#138** [P0 cost, fechado v0.2.0.9 commit `0813d94`] DOSE_COLS_LIST sem observation + lazy-load DoseModal. -15% a -30% payload.
- ✅ **#148** [P0 cost, fechado v0.2.0.11 commit `7c8cf5b`] Dashboard extend_continuous_treatments rpc 2× por mount fix (AnimatePresence popLayout). Module-scope flag debounce 60s.
- ✅ **#149** [P0 cost, fechado v0.2.0.11 commit `758035b`] useDoses mutation refetch storm 12 fetches/200s → debounce 2s. -75% storm.
- ✅ **#150** [P0 cost, fechado v0.2.0.11 commit `017916d`] useDoses refetchInterval 5min → 15min. -67% polling rate.
- ✅ **#151** [P0 cost, fechado v0.2.0.11 commit `78127b7`] useDoses refetchInterval opt-in só Dashboard (outras telas off). -80% adicional idle egress.
- ✅ **#157** [P0 v0.2.1.0 NOVO — fechado commit `da61b04`] Disable `useRealtime()` App.jsx — fix storm 12 req/s sustained idle. Storm 99.7% eliminado pós-fix (9 reqs/7min idle = 0.021 req/s). Bug PRÉ-EXISTENTE master. Plano retomar v0.2.2.0+: populate publication `supabase_realtime` + refactor reconnect guard.

#### 🟠 P1 — Alta

> **Plano egress otimização escala (2026-05-06):** baseline cycle atual 8.74 GB / 250 GB Pro com 4 MAU = ~3.75 GB/user/mês (30× padrão SaaS). Storm pré-#157 dominou (~7.2 GB May 5; pós-fix ~0.5 GB/dia). Pós steady state esperado ainda 5-15 GB/mês com user único; com 100+ users heavy estourará Pro 250 GB. Items #163-#167 preparam escala Open Testing/Production (objetivo ≤500 MB/user/mês = 5 GB/mês com 10 users / 50 GB/mês com 100 users — 5-10× redução).

- ⏳ **#163** [P1 cost escala v0.2.1.4 NOVO] **RPC consolidado Dashboard `get_dashboard_payload`.** Dashboard hoje faz 4 queries paralelas (doses + patients + treatments + extend_continuous_treatments rpc). Substituir por single RPC `get_dashboard_payload(user_id)` retornando JSON consolidado: `{doses:[...], patients:[...], treatments:[...], stats:{overdue:N,upcoming:N}}`. Reduz round-trips 4→1 + payload duplicado eliminado (cada query carrega user/auth context separado). Esperado -40% a -60% Dashboard egress. Esforço 3-4h. Detalhe completo CHECKLIST §#163.
- ⏳ **#164** [P1 cost escala v0.2.1.4 NOVO — combinado retomar #157] **Realtime broadcast healthcare alerts** (em vez postgres_changes streaming). Hoje #157 disabled `useRealtime()` por storm publication empty + reconnect cascade. Retomar via padrão **broadcast** (server pushes evento delta ~1KB) ao invés de **postgres_changes** (cliente refetch full row 50KB). Edge function `dose-trigger-handler` envia `realtime.send({type:'dose_update', payload:{id, status, takenAt}})` → cliente recebe + patch cache local. Bypass refetch network completo. Esperado -80% a -90% Realtime egress + retoma sync multi-device. Pré-req: refactor reconnect guard + populate publication `supabase_realtime` SE precisar postgres_changes paralelo. Esforço 4-6h. Detalhe completo CHECKLIST §#164.
- ⏳ **#165** [P1 cost escala v0.2.1.4 NOVO] **Delta sync doses + TanStack persist IndexedDB offline-first.** (a) `listDoses(?since=lastSyncedAt)` server-side filter `WHERE updatedAt > since` retorna só rows mudadas após último sync (initial pull pesado, depois ~zero idle); (b) TanStack Query persist plugin (`@tanstack/query-persist-client`) salva cache em IndexedDB → app abre renderiza cache local instant + background refetch só se >5min stale; (c) staleTime bump 15min → 30min combinado com persist. Esperado -70% a -90% reads steady state + UX offline-first. Esforço 3-5h. Detalhe completo CHECKLIST §#165.
- ⏳ **#166** [P2 cost escala v0.2.1.4 NOVO] **MessagePack Edge functions payload + compression.** Edge functions (`dose-trigger-handler`, `schedule-alarms-fcm`, `notify-doses`, `send-test-push`) hoje retornam JSON. Trocar por **MessagePack** binary (`@msgpack/msgpack` deno port) → 50-70% menor payload. Cliente decode no fetch wrapper. Verificar `Accept-Encoding: br,gzip` headers Supabase + Vercel CDN explicit. Esforço 2-3h. Detalhe completo CHECKLIST §#166.
- ⏳ **#167** [P2 cost escala v0.2.1.4 NOVO] **Cursor pagination + selective columns aggressive + Supavisor transaction mode.** (a) Trocar offset pagination por cursor (`?after=last_id`) em listDoses/listTreatments — evita re-pull rows; (b) DOSE_COLS_LIST mais aggressive (status int code `0=scheduled 1=taken 2=skipped 3=overdue` em vez string + drop campos read-rare); (c) Supavisor transaction mode pooler em vez direct conn (reduz handshake overhead 200-400 bytes/request). Esforço 3-5h. Detalhe completo CHECKLIST §#167.
- ⏳ **#168** [P2 cost escala v0.2.1.4 NOVO] **CDN cache strategy — bundle + assets via Vercel CDN + Supabase Storage cache headers.** Pro plan tem **Cached Egress 250 GB separado** (atualmente 0 / 250 GB). Otimizar: (a) bundle JS + images Dosy servem via Vercel CDN (não via Supabase Storage) — verificar `cache-control` headers Vercel + service worker `medcontrol-v6` cobrindo assets; (b) Supabase Storage `patient-photos` + `treatment-images` (futuro) com `cache-control: public, max-age=31536000, immutable` em uploads; (c) Edge function responses estáticas-ish (FAQ, Termos) com `cache-control: public, max-age=3600 s-maxage=86400` pra cache CDN; (d) verificar `etag` headers PostgREST permitem 304 Not Modified em refetch idempotente. Esforço 2-3h. Detalhe completo CHECKLIST §#168.

- ✅ **#010** [Auditoria, fechado v0.2.0.6 commit `cbfc813`] `ic_stat_dosy` notification icon — vector drawable 24dp + 3 paths Java migrados + setColor accent peach.
- ✅ **#011** [Auditoria, fechado v0.1.7.4] `<label>` em inputs Login (TalkBack + screen readers).
- ✅ **#012** [Plan, fechado v0.1.7.4] RLS policies recriadas com `TO authenticated`. 48 policies finais. Plan FASE 8.3
- ✅ **#013** [Plan, fechado v0.1.7.4] Splitar policies `cmd=ALL` em 4 (push_subs, user_prefs, subscriptions, security_events). Plan FASE 8.3
- ✅ **#014** [Plan + Auditoria, fechado v0.1.7.4] RPC `extend_continuous_treatments` recriada + reativada client Dashboard.
- ✅ **#015** [Plan, fechado v0.1.7.4] PostHog key + dashboards launch. Plan FASE 14.1
- ✅ **#016** [Plan, fechado v0.1.7.4] Sentry alerts (crash spike >10/h, error threshold). Plan FASE 14.2
- ✅ **#017** [Plan, fechado v0.2.0.6 commit `869ab34`] LockScreen UI + biometria (`useAppLock`). Overlay App.jsx + Toggle Settings + timeout configurável + biometric-auth allowDeviceCredential fallback.
- ✅ **#019** [Auditoria, fechado v0.1.7.4] Subir `minimum_password_length` 6 → 8 + complexity (config.toml + cloud).
- ✅ **#020** [Plan, fechado v0.1.7.4] Disclaimer médico visível ("Não substitui orientação"). Plan FASE 18.5.1
- ✅ **#022** [Auditoria, fechado v0.1.7.4] Verificar legitimidade `typescript@^6.0.3` — confirmed legítimo.
- ✅ **#023** [Auditoria, fechado v0.2.0.4] useDoses já tem `refetchIntervalInBackground: false` + `staleTime: 2min` (set em #092). Verificado.
- ✅ **#036** [Plan — fechado v0.2.1.0 (2026-05-05)] Skeleton screens TreatmentList + Analytics. Componente `<SkeletonList count={N} />` reusado de #104 v0.2.0.0. Plan FASE 15
- ✅ **#075** [Sessão v0.1.7.0] Reduzir agressividade RQ global em main.jsx (`staleTime: 30_000`, `refetchOnMount: true` em vez de `'always'`). Mitiga lentidão geral.
- ✅ **#076** [Sessão v0.1.7.0] Refatorar useAppResume.js — soft recover (refresh JWT + reconnect realtime + invalidate, preserva URL).
- ✅ **#077** [Sessão v0.1.7.0] Listener `TOKEN_REFRESHED` em useRealtime.js pra resubscribe quando JWT renova.
- ✅ **#078** [Sessão v0.1.7.0] Bumpar SW cache version `medcontrol-v5` → `v6`.
- ✅ **#082** [Sessão v0.1.7.1 commit `5b5938e`] Dual-app dev/prod: `com.dosyapp.dosy.dev` "Dosy Dev" coexiste com `com.dosyapp.dosy` oficial. Permite testes destrutivos (force stop, idle 24h) sem afetar Dosy oficial.
- ✅ **#102** [P1 UX, fechado v0.2.0.1 commit `f02bf12`] Atalho hardware silenciar alarme. AlarmActivity.onKeyDown override KEYCODE_VOLUME_UP/DOWN → toggleMute() + return true (consume). Match comportamento padrão Android.
- ✅ **#114** [P1 BUG-038, fechado v0.2.0.2] Avatar foto crop manual UI. `react-easy-crop` em CropModal — zoom 1-3x + drag pan + cropShape circular live preview → canvas 512×512 jpeg q0.78 (~50KB).
- ✅ **#116** [P1 UX, fechado v0.2.0.3] Header alertas: sino dropdown → ícones diretos. Cada tipo de alerta tem ícone próprio com badge contador + click direto. Padrão WhatsApp/Gmail. AlertCircle pulse (overdue) + Users (shares) + Pill (ending soon) + Download (update). UpdateBanner mantido.
- ✅ **#118-followup** [P1 UX, fechado v0.2.0.3] Pill amarelo (tratamento acabando) abre EndingSoonSheet componente novo com lista tratamentos + paciente avatar + dias restantes ("termina hoje", "amanhã", "N dias"). Click row → patient detail.
- ✅ **#119** [P1 cost+truth, fechado v0.2.0.3] Promo `free → plus` removida do client. subscriptionService.getMyTier vem direto DB via RPC `my_tier`. Paywall ativo pra users free reais. teste-free@teste.com permite testar paywall.
- ✅ **#119-followup** [P1 truth, fechado v0.2.0.4] Server-side trigger drop. Migration `drop_signup_plus_promo_trigger`: DROP TRIGGER `on_auth_user_signup_plus` + DROP FUNCTION `handle_new_user_plus_promo`. Novos signups começam tier='free' real. Side-effect: resolve #032.
- ✅ **#139** [P1 cost, fechado v0.2.0.10 commit `bf45f80`] dose-trigger-handler v11 skip se scheduledAt > 6h futuro (early return `skipped: 'beyond-cron-horizon'`). Doses < 6h fluxo normal; doses > 6h via cron `schedule-alarms-fcm`. Edge invocations -50% a -70%.
- ✅ **#140** [P1 cost, fechado v0.2.0.10 commit `bf45f80`] schedule-alarms-fcm v10 HORIZON 72h → 24h. AlarmManager re-agenda cada cron 6h ciclo (4×6h = 24h coverage). Payload FCM ~3× menor.
- ✅ **#141** [P1 cost, fechado v0.2.0.10 commit `bf45f80`] useReceivedShares staleTime 60s → 5min. -80% calls listReceivedShares.
- ✅ **#152** [P1 UX, fechado v0.2.0.12 commit `b2f53ff`] ChangePasswordModal Ajustes. Botão "Alterar senha" Settings → Conta. Modal padrão Dosy + 3 inputs (atual + nova + repetir) + validação inline. Re-autentica via signInWithPassword → updateUser.
- ✅ **#153** [P1 UX, fechado v0.2.0.12 commits `b2f53ff`+`31da691`] Recovery senha OTP 6 dígitos (substitui magic-link broken #147). useAuth.sendRecoveryOtp/verifyRecoveryOtp + Login 2 sub-modes 'forgot-email'/'forgot-otp' + flag localStorage `dosy_force_password_change=1` + ForceNewPasswordModal auto. Email OTP length Supabase Dashboard 8→6 dígitos. Email template Magic Link customizado design Dosy peach.
- ✅ **#160** [P1 UX v0.2.1.2 NOVO — fechado commits `c6f6963`+extensão v2+v2.1] PatientDetail refactor. v1: card "Adesão" → "Doses Hoje X de Y" + tratamentos 3 seções (Ativos/Pausados/Encerrados via effectiveStatus) + lista doses paciente DoseCard reuso filter 24h/Todas. v2: collapse opcional 4 seções + Doses dentro Card peach destaque. v2.1: dark mode adaptive (peach-100 var).
- ✅ **#161** [P1 UX v0.2.1.2 NOVO — fechado v1+v2] Alerts dismiss refinement. ending date-based 1×/dia (LS_ENDING_SEEN_DATE YYYY-MM-DD). v2: useState mirror localStorage feedback visual immediate.

#### 🟡 P2 — Média

- ✅ **#028** [Auditoria, fechado v0.2.0.4] Rate limit `delete-account` Edge fn v7. 1 attempt/user/60s via security_events. Resposta 429 + Retry-After. Insert event antes da operação.
- ✅ **#029** [Plan + Auditoria, fechado v0.2.0.11 commit `9a9f399`] Refatorar Settings.jsx 692 LOC → src/pages/Settings/ com 4 arquivos: index.jsx (276 LOC orchestrator) + sections.jsx (470 LOC, 7 components) + Row.jsx + constants.js.
- ✅ **#030** [Plan SECURITY + Auditoria, fechado v0.2.0.11 commit `9a9f399`] Refatorar services/notifications.js 613 LOC → src/services/notifications/ com 5 arquivos (prefs/channels/scheduler/fcm/index barrel). API pública 100% retro-compat.
- ✅ **#031** [Auditoria, fechado v0.2.0.4] Confirmar `FORCE_RLS` em todas tabelas. 13/13 tabelas medcontrol com `relrowsecurity=true` AND `relforcerowsecurity=true`.
- ✅ **#032** [Auditoria, fechado v0.2.0.4] Confirmar `SET search_path` em todas SECURITY DEFINER. 1 função sem SET (`handle_new_user_plus_promo`) — resolvido indiretamente em #119-followup (trigger + função droppadas).
- ✅ **#033** [Auditoria, fechado v0.2.0.3] React.memo em DoseCard (PatientCard já tinha; TreatmentCard não existe — falso achado).
- ✅ **#034** [Plan, fechado v0.2.0.11 commit `9a9f399`] Virtualização DoseHistory via `@tanstack/react-virtual`. VirtualTimeline (ROW_HEIGHT 62px + ROW_GAP 6 + overscan 5). MaxHeight 60vh quando >10 itens. Pre-built patientById Map evita O(n²). Plan FASE 13. Patients virtualização parqueada (lista curta).
- ⏳ **#035** [Plan — diferido v0.2.2.0+] Integration tests (`useDoses`, `useUserPrefs` mocks). 1 dia esforço. Backlog estabilidade pós-Closed Testing.
- ✅ **#037** [Plan, fechado v0.2.0.4] Erros inline em forms. PatientForm valida nome/idade/peso + TreatmentForm valida medName/unit/durationDays via state errors + Input.error prop. Erro limpa onChange.
- ⏳ **#038** [Plan — diferido v0.2.2.0+ ou pré-Open Testing] Pen test interno (curl JWT roubado, Burp/mitmproxy, Play Integrity tampering). 1-2 dias.
- ⏳ **#039** [Plan — bloqueado, não-aplicável atual] Confirmação dupla delete batch (>10). Hoje app NÃO tem batch delete. Pré-req: implementar batch select UI primeiro.
- ✅ **#040** [Plan, fechado v0.2.0.3] Subir contraste textos secundários dark. fg-secondary #C8B8AB → #DDC8B6 (8.7→10.5), fg-tertiary #8E7F73 → #B0A091 (4.35→5.8 — passa AA).
- ✅ **#041 partial** [Plan — partial v0.2.1.0, refactor rem diferido v0.2.2.0+] Hierarquia headings auditada. `<h1>` semantic em PageHeader.jsx. Refactor mass `fontSize: Npx` → `rem` (172 ocorrências) **diferido**: 4h esforço + baixo ROI Capacitor (não respeita user font-scale system).
- ⏳ **#042** [Plan — diferido v0.2.2.0+] Lighthouse mobile ≥90 em Reports + Dashboard. Audit completo + iterar fixes (~1 dia).
- ⏳ **#043** [Plan] Performance scroll lista 200+ doses sem jank (já parcialmente coberto por #034 virtualização DoseHistory).
- ✅ **#044** [Plan, fechado v0.2.0.4] Audit RPC `register_sos_dose`. SECURITY DEFINER + search_path SET + has_patient_access check + sos_rules lookup case-insensitive + minIntervalHours/maxDosesIn24h validate + INSERT auth.uid(). Sem schema drift.
- ✅ **#045** [Auditoria, fechado v0.2.0.2] `coverage/` no `.gitignore` já presente.
- ✅ **#048** [Auditoria, fechado v0.2.0.4] tools/supabase.exe + supabase.tar.gz NÃO tracked (gitignore cobre). False alarm.
- ⏳ **#049** [Plan FASE 20] Pen test profissional.
- ✅ **#100** [P2 UX, fechado PARCIAL v0.2.0.11 commit `9a9f399`] Avatar emoji redesign — 6 categorias (Família, Saúde NOVO, Pessoas, Animais, Atividades NOVO, Cores). Saúde inclui emojis médicos (🩺💊💉🫀🧠). Default `'👤'` → `'🙂'`. Fallbacks PatientAvatar/FilterBar/Dashboard/PatientDetail. Escopo NÃO executado (parqueado): SVG flat tinted, sliders cor, migration ALTER TABLE.
- ✅ **#117** [P2 UX, fechado v0.2.0.3] Alerta header paciente compartilhado novo `patient_share`. Service `listReceivedShares` consulta `patient_shares WHERE sharedWithUserId = me`. Hook `useReceivedShares` (staleTime 60s). Header conta shares com `createdAt > localStorage[dosy_shares_seen_at]`. Click → seenAt=now → nav /pacientes.
- ✅ **#118** [P2 UX, fechado v0.2.0.3] Alerta header tratamento acabando ≤3 dias. Computa endDate = startDate + durationDays*24h em memória. Filtra: !isContinuous && status='active' && endDate >= now && endDate-now ≤ 3d. seenAt-based decay. Click → nav /pacientes.
- ✅ **#120** [P2 truth, fechado v0.2.0.3] SharePatientSheet copy condicional baseado tier real (era hardcoded "free"). Server-side check OK (RPC `APENAS_PRO_COMPARTILHA`), só client copy.
- ✅ **#121** [P2 a11y, fechado v0.2.0.3] PaywallModal Escape close. Fix em Sheet+Modal primitives keydown listener `Escape` chamando onClose. Cobre todos sheets/modals (PaywallModal, SharePatientSheet, EndingSoonSheet).
- ✅ **#143** [P2, fechado v0.2.0.10 commit `bf45f80`] useUserPrefs.queryFn `getSession()` em vez de `getUser()` — local-only (lê localStorage cache), zero round-trip /auth/v1/user. -100% calls /auth/v1/user em useUserPrefs path.
- ✅ **#144** [P2 longo prazo, fechado v0.2.0.12 commit `54e0d0a`] Custom JWT claim `tier` via Auth Hook. Backend permanente: migration `144_jwt_claim_tier_auth_hook` (schema `auth_hooks` + função `add_tier_to_jwt`). v0.2.0.11 frontend ROLLBACK (qc.clear cascade loop). v0.2.0.12 fix conservador: qc.clear scoped só em SIGNED_OUT ou SIGNED_IN com user diff. -100% rpc('my_tier') round-trip.
- ✅ **#145** [P2, fechado v0.2.0.11 commit `9a9f399`] useRealtime watchdog + onStatusChange reconnect: substitui `qc.invalidateQueries(...)` blanket por `qc.refetchQueries({type:'active'})` scoped. Inactive queries NÃO refetcham — só ativas. Reduz blast radius reconnect.
- ✅ **#146** [P2 audit, fechado v0.2.0.11 commit `9a9f399`] pg_cron extend_continuous_treatments: tabela `medcontrol.cron_audit_log` + wrapper `run_extend_continuous_with_audit()` + view `cron_health_recent` últimos 30 runs com flag `suspicious_zero_doses` + auto-cleanup 90d. Cron job 2 alterado pra wrapper.

> **Análise gap concorrentes (2026-05-07) — diferenciais médio prazo:** items #178-#181, #183 atacam acessibilidade idosos + healthcare deep + cultural BR (areas Wear OS, voz/TTS, health metrics, refill flow).

- ⏳ **#178** [P2 healthcare-niche v0.2.1.4 NOVO] **Modo Alzheimer escalada — alarme intensifica + SMS/WhatsApp cuidador se não dismiss em 5min.** Paciente Alzheimer não responde alarme normal. Modo opcional (toggle PatientForm "Cuidados especiais") escala: 5min sem dismiss → 2x volume + vibração contínua; 10min → SMS/WhatsApp cuidador via Twilio/Resend ("Mãe não tomou Mounjaro, alarme não foi atendido"). Diferencial real-world cuidadores Alzheimer/demência. Nenhum concorrente tem. Esforço 6-8h. Detalhe completo CHECKLIST §#178.
- ⏳ **#179** [P2 acessibilidade v0.2.1.4 NOVO] **Wear OS / Galaxy Watch support — alarme pulso.** Plugin `@capacitor-wear` ou native module Android Wear API. Alarme dispara no relógio + dismiss via watch button. Idoso dorme profundo, celular longe — relógio pulso garante notif. Galaxy Watch market BR crescendo (Samsung dominante). Esforço 8-12h. Detalhe completo CHECKLIST §#179.
- ⏳ **#180** [P2 healthcare-deep v0.2.1.4 NOVO] **Health metrics tracking — pressão arterial, glicemia, peso, temperatura.** Schema `health_metrics` table linked patient. Form dose tomada → opcional input metric (ex: glicemia 110 mg/dL antes Mounjaro). Chart trend 30/60/90 dias paciente. Diabéticos precisam glicemia + medicação link; hipertensos PA + med. Combina dose tracking + outcome. MyTherapy tem medições simples; Dosy faz trend + correlação dose-outcome. Esforço 10-14h. Detalhe completo CHECKLIST §#180.
- ⏳ **#181** [P2 acessibilidade v0.2.1.4 NOVO] **Voz/TTS prompts + comando voz — acessibilidade idosos baixa visão.** TTS via Capacitor Text-to-Speech plugin: ao alarme dispara, fala "É hora do Mounjaro 14:30". Comando voz via `@capacitor-community/speech-recognition`: user diz "Tomei minha dose Mounjaro" → app reconhece + marca taken. Acessibilidade vai além TalkBack — útil idosos baixa visão + mãos ocupadas. Esforço 6-8h. Detalhe completo CHECKLIST §#181.
- ⏳ **#183** [P2 monetização v0.2.1.4 NOVO — combinado #065 estoque] **Refill affiliate links Drogasil/Drogaria SP/Pague Menos.** Quando #065 estoque ≤7 dias → alert header novo "📦 Mounjaro acabando — Comprar?". Click → opção drogarias afiliadas com deeplinks (Drogasil app/web, Drogaria SP, Pague Menos, Raia). Programa afiliados retorna 2-5% comissão venda. Monetização extra retention real-world utility. Esforço 4-6h (incluindo signup affiliate programs + deeplinks pesquisa). Detalhe completo CHECKLIST §#183.
- 🚧 **#222** [P2 MELHORIA — origem auditoria 2026-05-13 B-10+B-11 — código mergeado em #215 release/v0.2.3.0: 2 channels novos dosy_tray + dosy_tray_dnd + migration delete legacy + AlarmActivity ~80 linhas removidas, validação device pendente] **Consolidar channels Android (3→2) + cleanup código morto AlarmActivity.** Hoje 3 channel IDs distintos (`doses_v2` LocalNotifications + `doses_critical` AlarmService FG + `doses_critical_v2` AlarmReceiver fallback). Channel antigo `doses_critical` (sem som — drives via MediaPlayer) continua órfão no device de users pré-#203. Plus AlarmActivity tem ~150 linhas código morto: `mediaPlayer`/`vibrator` fields nunca atribuídos; `startAlarmSound`/`startVibration` definidas nunca chamadas; `postPersistentNotification`/`cancelPersistentNotification` órfãs (cancel chamado em handleAction mas notif nunca foi postada). Fix: consolidar em 2 canais (`dosy_tray` + `dosy_critical`) + migration code em app boot pra `NotificationManager.deleteNotificationChannel("doses_critical")` + deletar ~150 linhas mortas + atualizar IDs. Esforço 2-3h. Detalhe CHECKLIST §#222.
- 🚧 **#225** [P2 MELHORIA — origem auditoria 2026-05-13 B-14 — código mergeado em #215 release/v0.2.3.0: daily-alarm-sync chunking 30 doses/FCM message + retry exponential, validação device pendente] **FCM payload `daily-alarm-sync` chunking 4KB.** `daily-alarm-sync/index.ts` envia `JSON.stringify(dosesPayload)` com até 1000 doses 48h horizon. FCM v1 data message limit é 4KB. User com 50+ doses/dia × 48h = 100+ doses pode passar 4KB → FCM responde `INVALID_ARGUMENT`. Fix: particionar `dosesPayload` em chunks de 30 doses por FCM message + send paralelo `Promise.all` no mesmo deviceToken. DosyMessagingService já é idempotente (mesmo groupKey hash) → safe receber múltiplas mensagens. Esforço 1-2h. Detalhe CHECKLIST §#225.

#### 🟢 P3 — Baixa (90 dias / backlog)

**Auditoria DB / Segurança avançada (Plan FASE 23.5):**

- ⏳ **#050** Audit_log abrangente (UPDATE/DELETE triggers).
- ⏳ **#051** 2FA opcional via TOTP.
- ⏳ **#052** Criptografia client-side de `observation`.
- ⏳ **#053** Logout remoto multi-device + tela "Dispositivos conectados".
- ⏳ **#054** Notif email/push ao login em device novo.
- ⏳ **#055** Session replay — *opcional, privacy review*.
- ⏳ **#056** Visual regression tests (Chromatic/Percy).
- ⏳ **#057** Performance budget em CI.

**TypeScript:**

- ⏳ **#058** TypeScript migration (ou JSDoc + `tsc --checkJs`). Plan FASE 23.5

**Alarme / OEMs:**

- ⏳ **#059** `dosy_alarm.mp3` custom sound. Plan FASE 2.5
- ⏳ **#060** Detecção root/jailbreak. Plan FASE 23 backlog
- ⏳ **#067** DosyMonitorService (Xiaomi/OPPO/Huawei). Plan FASE 23.7

**Features pacientes (Plan FASE 15 backlog):**

- ⏳ **#061** Drag-sort de pacientes.
- ⏳ **#062** Anexar comprovantes/imagens (PRO).
- ⏳ **#063** Avaliar remoção `mockStore.js`.

**Healthcare-specific (diferenciadores) [Auditoria — todos promovidos P1 via #173 healthcare differentiators moat]:**

- ⏳ **#064** [promovido P1 via #173] Verificação interações medicamentosas + alergia. OpenFDA API ou ANVISA scraping. → [01 §11](auditoria/01-relatorio-completo.md#11--funcionalidades-específicas-de-medicação--score-6510)
- ⏳ **#065** [promovido P1 via #173] Estoque + alerta "está acabando". Input quantidade + cálculo dias até zero.
- ⏳ **#066** [promovido P1 via #173] Lembrete de consulta médica + Calendar .ics export.

**Expansão (Plan FASE 23.6):**

- ⏳ **#068** iOS via Capacitor.
- ⏳ **#069** Internacionalização (en, es).
- ⏳ **#070** Plano Family (até 5 usuários).

**Marketing / aquisição (Plan FASE 22-23):**

- ⏳ **#071** Programa afiliados. Plan FASE 23.3
- ⏳ **#072** A/B test paywall e onboarding. Plan FASE 23.2
- ⏳ **#073** Programa de indicação (1 mês PRO grátis). Plan FASE 22.3

**Análise gap concorrentes (2026-05-07) — backlog futuro pós-Production estabilizada:**

- ⏳ **#182** [P3 healthcare-deep v0.2.1.4 NOVO] **Symptom diary + mood tracking — antes/depois dose.** Schema `symptom_logs` table linked dose. Form opcional após mark dose taken: "Como se sente?" emoji scale + sintomas checkbox + observation. Útil ajuste medicação psiquiátrica (ansiedade/depressão/bipolar) + crônica (dor/fadiga). MyTherapy tem feature similar. Esforço 6-8h. Detalhe completo CHECKLIST §#182.
- ⏳ **#184** [P3 monetização v0.2.1.4 NOVO] **Telemedicina integration — Doctoralia/Conexa Saúde/Memed clip agendar consulta.** Botão "Agendar consulta" PatientDetail → opções providers parceiros (Doctoralia, Conexa Saúde, Drogasil Telemedicina). Comissão affiliate 5-15% consulta agendada. Trust healthcare + monetização B2B2C. Esforço 8-12h (signup parcerias + deep links integration). Detalhe completo CHECKLIST §#184.
- ⏳ **#185** [P3 B2B v0.2.1.4 NOVO] **Cuidador profissional B2B mode — 1 cuidador 5+ idosos diferentes residências.** Mode "Cuidadora" toggle Settings → permite gerenciar 5+ pacientes residências distintas (vs PRO atual multi-paciente same residência). Reports separados por paciente + comunicação família via WhatsApp #177 + cobranças por hora cuidado (futuro feature monetização). Mercado BR cuidadores profissionais crescente (Cuidador.io fragmento). Esforço 16-24h (UX redesign + RLS expansion + reports per-patient). Detalhe completo CHECKLIST §#185.
- ⏳ **#186** [P3 integração v0.2.1.4 NOVO] **Apple Health / Google Fit / Samsung Health bidirectional sync.** Plugin `@capacitor-community/health` (ou native bridge Android Health Connect). Bidirectional: doses tomadas Dosy → Health platforms; health metrics #180 (BP/glicemia/peso) → Health platforms. Trust ecosystem + viralidade (apps health populares conectados). Esforço 12-16h. Detalhe completo CHECKLIST §#186.
- ⏳ **#187** [P3 BR-specific v0.2.1.4 NOVO] **Receita digital prescription import — Memed, Nexodata, RDC ANVISA.** Future-proof BR digitalização receitas. Memed (1ª receita digital BR) + Nexodata API integração: user receba receita digital → app importa automático criando treatments. Diferente #175 (OCR scan) — esse é integração nativa receita digital pre-formatted. Esforço 12-20h (signup parceria + API integration + UX consent). Detalhe completo CHECKLIST §#187.

**Cosmético fechado:**

- ✅ **#122** [P3 cosmético, fechado v0.2.0.3] AppHeader greeting `firstName` → `shortName` em userDisplay.js. Retorna primeira+segunda palavra se ambas ≤6 chars (cobre "Teste Free", "Teste Plus", "Plus Beta"), senão só primeira (preserva "Luiz", "Daffiny").

**Higiene código (auditoria 2026-05-13):**

- 🚧 **#223** [P3 MELHORIA — origem auditoria 2026-05-13 B-12 — código mergeado em #215 release/v0.2.3.0: usePushNotifications.js deletado + imports inline App.jsx + Settings/index.jsx, validação device pendente] **Deletar `usePushNotifications.js` deprecated re-export.** Arquivo único 7 linhas, comentário `@deprecated`. App.jsx ainda importa via `from '../hooks/usePushNotifications'`. Fix: trocar import direto pra `'../services/notifications'` + deletar arquivo. Esforço 5min. Detalhe CHECKLIST §#223.
- 🚧 **#226** [P3 MELHORIA — origem auditoria 2026-05-13 B-15 — código mergeado release/v0.2.3.0: migration add_device_id_uuid_to_push_subscriptions applied + RPC upsert_push_subscription estendida pra aceitar p_device_id_uuid + Java AlarmAuditLogger lê SharedPreferences device_id UUID + JS fcm.js + useAuth.jsx passam UUID via RPC] **Padronizar `device_id` UUID cross-source em `alarm_audit_log`.** Três semânticas distintas: JS grava UUID estável; Java `AlarmAuditLogger.java:106` grava `MODEL + " (" + MANUFACTURER + ")"` (não-único entre devices iguais); Edge `daily-alarm-sync` grava `deviceToken.slice(-12)`. Análise cross-source dificultada. Fix: padronizar UUID estável — Java lê de `SharedPreferences "device_id"` (já existe via `setSyncCredentials`); Edge usa UUID de `push_subscriptions` (precisa adicionar coluna ou cachear no payload FCM). Esforço 1-2h. Detalhe CHECKLIST §#226.

---

### 6.6 🐛 BUGS — Correções

#### 🔴 P0 — Bloqueadores

- ✅ **#001** [Auditoria] Admin auth check em `send-test-push` Edge Function. → [04 §7.2](auditoria/04-supabase.md#72-send-test-pushindexts-120-linhas--crítico) · [06 BUG-002](auditoria/06-bugs.md#bug-002--edge-function-send-test-push-não-valida-autorização-auditoria-estática) · [03 §#001](CHECKLIST.md#001--adicionar-auth-check-de-admin-em-send-test-push-edge-function)
- ✅ **#002** [Auditoria] Sanitizar erro email enumeration. → [06 BUG-015](auditoria/06-bugs.md#bug-015--resposta-de-erro-user-not-found-em-send-test-push-permite-enumeration)
- ✅ **#005** [Auditoria] Encoding UTF-8 quebrado em nome paciente. → [06 BUG-001](auditoria/06-bugs.md#bug-001--encoding-utf-8-quebrado-em-nome-de-paciente)
- ✅ **#091** [BUG-024, fechado v0.1.7.4 — CRÍTICO] pg_cron extends contínuos com TZ UTC errado em firstDoseTime array. User lhenrique.pda Cortisol 27/04 horários 5h+9h BRT (08/12 UTC raw). Fix: combina date+time em America/Sao_Paulo, converte AT TIME ZONE UTC. 3 treatments afetados (Triiodotironina, Cortisol, Citrato Magnésio). Cleanup: DELETE pending futuras + reset doseHorizon NULL + regen via fn fixed. Migration `20260503025200_fix_extend_continuous_tz_bug.sql`.
- ✅ **#092** [BUG-025, fechado v0.1.7.5 commit `557dcd9`] Egress reduction Supabase. Multi-frente: (1) Realtime postgres_changes filter `userId=eq.X` server-side; (2) subscriptions removido Realtime; (3) listDoses default range fail-safe (-30d/+60d); (4) listDoses paginate cap 5 pages; (5) useDoses queryKey hour-norm; (6) refetchInterval 60s→5min, staleTime 30s→2min; (7) staleTime bumps; (8) App.jsx alarm scope -1d/+14d. Critical alarm path NÃO regrediu.
- ✅ **#094** [BUG-027, fechado v0.1.7.5 commit `8b32245`] Paywall falso fires pra users plus/pro durante mount race. Causa: usePatientLimitReached retornava true quando tier=undefined; getMyTier auth.getUser() race resolvia null. Fix: useMyTier `enabled: !!user` via useAuth + queryKey inclui userId + usePatientLimitReached retorna false durante loading.
- ✅ **#101** [P0 cost/audit, fechado v0.2.0.1] Auditoria egress Supabase pós-#092 — pg_stat_statements + pg_replication_slots. 2 slots logical Realtime ativos lag 176 bytes (saudável). Top calls esperados (WAL polling, set_config, INSERT doses bulk via pg_cron). Sem queries patológicas. #092 fix manteve.
- ✅ **#106** [P0 BUG-034, fix completo v0.2.0.3] Ícone launcher + splash continuavam antigos. Causa: pasta `assets/` legacy precedência sobre `resources/` no `@capacitor/assets generate`. Fix: deletado assets/ legado + criado resources/icon-only.png composto + deletado mipmap-*/ic_launcher* + drawable-port/land/splash + re-run cap/assets → 86→61 outputs corretos.
- 🚫 **#106-old** [P0 BUG-034, partial v0.2.0.1 commit `1683f4f`] Removido legacy `drawable/ic_launcher_background.xml` template Capacitor (vector teal grid #26A69A). Superseded por #106 full fix v0.2.0.3.
- ✅ **#107** [P0 BUG-035, fechado v0.2.0.0+ — Sentry DOSY-J/F/G] **TypeError: schema(...).rpc(...).catch is not a function** em Dashboard pull-to-refresh. 6 events 3 bundle hashes. Causa: `supabase.schema().rpc()` retorna PostgrestFilterBuilder (PromiseLike, só `.then`). Fix: `.then(undefined, errHandler)` form 2-arg.
- ✅ **#109** [P0 BUG-037, fechado v0.2.0.1 commit `09724c1`] useRealtime concurrent subscribe race. Lock flag `subscribing` + try/catch ch.on() defensive previne 4 paths convergent (status reconnect + watchdog + TOKEN_REFRESHED + native resume). 9 events 4 issues distintas. #093 (closed v0.1.7.5) aplicou fix nome único + await removeChannel + generation counter.
- ✅ **#159** [P0 v0.2.1.1 NOVO BUG-LOGOUT — fechado] useAuth boot validation distinguir transient (network/5xx) vs real auth failure (401/403/JWT-invalid). User reportava app desloga toda vez que abria — fix preserva session em network errors transient.

#### 🟠 P1 — Alta

- ✅ **#085** [BUG-018, fechado v0.1.7.3 commit `f22f5a9`] Alarme Crítico desligado em Ajustes mas alarme tocou mesmo assim. User toggle OFF → alarme nativo fullscreen disparou normalmente. Fix: single source-of-truth via user_prefs.notif.criticalAlarm sincronizado em DB + localStorage + SharedPreferences. Validado emulador Pixel 7 cenários A/B/C.
- ✅ **#086** [BUG-019, parqueado v0.1.8.0] Resumo Diário não funciona — nunca dispara. UI ocultada em Settings. Precisa Edge cron + migration timezone — parqueado release futura.
- ✅ **#087** [BUG-020, Fase A fechada v0.1.7.3; Fase B parqueada v0.1.7.4] DND UX condicional (aparece só se Alarme Crítico ON) + Edges respeitam janela DND (skip FCM data dentro window). Validado emulador. Fase B (Android nativo fire time) parqueada.
- ✅ **#088** [BUG-021, fechado v0.1.7.4] Dose cadastrada não aparece em Início sem refresh. Causa: `invalidateQueries(['doses'])` não chamado após mutation INSERT em emulador Pixel 7 (latência realtime emulador-only). NÃO repro em S25 Ultra device real. Fix: refetchOnMount=always específico.
- ✅ **#090** [BUG-023, fechado v0.1.7.4] Pós-login redireciona pra Ajustes ao invés de Início. Causa: React Router preserva pathname após user mudar null→logged. Fix: navigate('/', {replace:true}) explícito em Login.submit após signin success se path atual não é `/` nem `/reset-password`.
- ✅ **#093** [BUG-026, fechado v0.1.7.5 commit `557dcd9`] Race condition em useRealtime: "cannot add postgres_changes callbacks after subscribe()". Fix: nome único `realtime:${userId}:${gen}:${Date.now()}` por subscribe + await `supabase.removeChannel()` (era fire-and-forget) + generation counter ignora callbacks de canais antigos.
- ✅ **#095** [P1 UX, fechado v0.1.7.5] /Ajustes mostra versão real do app via `Capacitor.App.getInfo()` packageInfo (não bundle baked-in). Bonus fix FAQ.jsx APP_VERSION hardcoded → `__APP_VERSION__` injetado.
- ✅ **#096** [BUG-028, fechado v0.2.0.1 commit `60d4422`] Admin panel tier inconsistente. listAllUsers agora aplica mesmo promo `free→plus` que getMyTier — admin panel sincroniza com client view.
- ✅ **#099** [P1 BUG-031, fechado v0.2.0.1 commit `1fcff21`] Avatar paciente — upload de foto não persiste + falta crop circular. Fix: canvas client-side center-square-crop 512x512 + JPEG 0.78 (~50KB). PatientForm submit invalidate ['patients'].
- ✅ **#103** [P1 BUG-032, fechado v0.2.0.1 commit `4a6e39c`] UpdateBanner URL apontava `dosy-teal.vercel.app` (preview antigo morto) → fetch 404 silent → available=false. Fix: `window.location.origin` runtime.
- ✅ **#104** [P2 UX, fechado v0.2.0.1 commit `8e093a0`] Skeleton legacy slate → Dosy peach palette. Card primitive bg-elevated + bg-sunken bars + dosy-shadow-xs. Componente SkeletonList (Dashboard isLoading, DoseHistory).
- ✅ **#105** [P1 BUG-033, fechado v0.2.0.1 commit `65211cb`] MultiDoseModal Dosy primitives. Sheet + Card per dose + StatusPill kind + Buttons ghost/secondary/primary com Lucide icons. Modal aparece em momento crítico pós-alarme nativo.
- ✅ **#108** [P1 BUG-036, fechado v0.2.0.1 commit `09724c1`] PatientForm weight.replace TypeError. Fix: coerce String(weight) antes onSubmit.
- ✅ **#125** [P1 BUG-039, fechado v0.2.0.4] Splash distorcido S25 Ultra (Android 12+). Causa: `drawable/splash_icon.png` 3224×1292 stale (legado wide). Fix: `cp resources/splash_icon.png android/app/src/main/res/drawable/splash_icon.png` (1024×1024 quadrado correto).
- ✅ **#128** [BUG-040, fechado v0.2.0.9 commit `559004b`] Backend: `schedule-alarms-fcm` + `dose-trigger-handler` Edge functions agora populam `patientName` no FCM payload data. `patients` query expandida `SELECT id, name`, `patientNameById` Map preenche `dosesPayload`. Falta apenas reproduzir 6 doses cross-patient device real S25 Ultra (validation pendente em #006).
- 🚫 **#147** [P1 BUG-041, fechado v0.2.0.12 via #152 + #153] Recuperação senha reformulada com OTP 6 dígitos via email (substitui magic-link broken localhost). Substituição completa #153.
- 🚧 **#216** [P1 BUG — origem auditoria 2026-05-13 B-03 — código mergeado release/v0.2.3.0: Edge notify-doses v20 deployed stub deprecated 410 Gone + verify_jwt:true (não crasha mais com tabela DROPADA)] **Edge `notify-doses` v19 deployed referencia tabela `dose_alarms_scheduled` DROPADA em v0.2.2.4.** Função `shouldSkipPushBecauseAlarmScheduled` (linha 187-203 `supabase/functions/notify-doses/index.ts`) consulta tabela inexistente. Se cron for re-scheduled OU alguém invocar a Edge manual → resposta 500 com erro PostgreSQL `42P01 relation "medcontrol.dose_alarms_scheduled" does not exist`. Fix: remover bloco `shouldSkipPushBecauseAlarmScheduled` + redeploy Edge (OU deletar Edge se confirmada desativação, ver #219). Esforço 30min. Detalhe CHECKLIST §#216.
- 🚧 **#217** [P1 BUG — origem auditoria 2026-05-13 B-04 — código mergeado em #215 release/v0.2.3.0: daily-alarm-sync source + _shared/auditLog.ts commitados local, validação device pendente] **Drift repo↔prod: Edge `daily-alarm-sync` + `_shared/auditLog.ts` ausentes no repo local.** Ambos deployed v2 ACTIVE com ~275 linhas que só existem no Supabase. Ninguém consegue revisar via PR, gitleaks, eslint, busca grep. Próximo `supabase functions deploy` daria push de pastas vazias (perderia função). Fix: `supabase functions download daily-alarm-sync` + commit `supabase/functions/daily-alarm-sync/index.ts` + `supabase/functions/_shared/auditLog.ts`. Esforço 15min. Detalhe CHECKLIST §#217.
- 🚧 **#218** [P1 BUG — origem auditoria 2026-05-13 B-05 — código mergeado release/v0.2.3.0: 15 migrations restauradas locais via Supabase MCP execute_sql `schema_migrations.statements`, paridade local↔remote restaurada] **Drift migrations locais: 15 migrations DB não commitadas no repo local.** Filesystem tem 21 migrations; DB tem 22 migrations (lista completa em auditoria §4.2). Falta: `add_patient_photo_thumb`, `replace_photo_thumb_with_photo_version`, `drop_signup_plus_promo_trigger`, `144_jwt_claim_tier_auth_hook`, `146_cron_audit_log_extend_continuous`, `admin_db_stats_function`, `add_tester_grade_to_subscriptions_v2`, `fix_update_treatment_schedule_timezone` (#209), `data_fix_doses_timezone_v0_2_1_9_retry`, `cron_jobs_v0_2_1_9_daily_alarm_sync`, `create_alarm_audit_log_v0_2_2_0` (#210), `cron_alarm_audit_cleanup_v0_2_2_0`, `grant_service_role_audit_tables` (#211), `grant_authenticated_audit_tables` (#211), `drop_dose_alarms_scheduled_v0_2_2_4` (#214). Impacto: rebuild local schema impossível. Fix: `supabase db pull` ou `supabase migration repair` por migration faltante. Esforço 1-2h. Detalhe CHECKLIST §#218.
- 🚧 **#219** [P1 BUG — origem auditoria 2026-05-13 B-06 — código mergeado release/v0.2.3.0: Edges notify-doses v20 + schedule-alarms-fcm v16 deployed como stubs deprecated 410 Gone + verify_jwt:true (não expõem endpoints anônimos)] **Edges `notify-doses` + `schedule-alarms-fcm` órfãs deployed `verify_jwt:false`.** Cron jobs `notify-doses-1min` e `schedule-alarms-fcm-6h` UNSCHEDULED em #209 — Edges sem trigger mas ainda ACTIVE + públicas (qualquer atacante anônimo pode invocar). Risco: consume quota Supabase + FCM (potencial abuse). Decisão: (a) deletar via `supabase functions delete notify-doses schedule-alarms-fcm` se aceito abandono, OU (b) set `verify_jwt:true` + usar apenas via cron autenticado se mantém como fallback. Esforço 15min. Detalhe CHECKLIST §#219.
- 🚧 **#220** [P1 BUG — origem auditoria 2026-05-13 B-07 — código mergeado em #215 release/v0.2.3.0 AlarmScheduler.idFromString agora aplica % 2147483647, validação device pendente] **Hash `AlarmScheduler.idFromString` Java sem `% 2147483647` — IDs cross-source podem divergir.** JS `doseIdToNumber` (`prefs.js:41-48`) aplica `Math.abs(h) % 2147483647`. Java (`AlarmScheduler.java:160-166`) só `Math.abs(h)`. Para certos groupKeys longos, IDs podem divergir → mesma dose pode ter alarme agendado **duas vezes** (JS path id_A, FCM/Worker path id_B). Probabilidade baixa (UUID v4 raramente estoura int32) mas não-zero. Fix: alinhar Java pra `Math.abs(h) % 2147483647` + teste unitário cross-source com 100 UUIDs random. Esforço 30min. Detalhe CHECKLIST §#220.
- 🚧 **#221** [P1 BUG — origem auditoria 2026-05-13 B-08 — código mergeado em #215 release/v0.2.3.0: dose-trigger-handler v18 deployed + migration trigger DB AFTER DELETE applied, validação device pendente] **`cancel_alarms` FCM action sem caller server-side.** Java `DosyMessagingService.handleCancelAlarms` + `AlarmScheduler.cancelAlarm` prontos pra receber `data.action=cancel_alarms` com `doseIds` CSV. Mas **nenhuma Edge Function envia esse FCM data**: `dose-trigger-handler` v17 ignora `DELETE` (linha 100-101) e não dispara cancel quando `status` muda `pending→done/skipped/cancelled`. Impacto: user deleta tratamento ou marca dose como done/skipped → alarme local continua agendado → toca no horário com payload cacheado SharedPreferences (dose já deletada/done). Mitigação atual: próxima abertura do app, `rescheduleAll` cancela tudo + re-agenda só doses pending. Fix: implementar action `cancel_alarms` em `dose-trigger-handler` para UPDATE com status≠pending + DELETE (requer expandir trigger DB `dose_change_notify` pra também firear em DELETE com `old_record` + status change). Esforço 2-3h. Detalhe CHECKLIST §#221.
- ⏳ **#231** [P2 BUG — emulator-only — descoberto 2026-05-14 vc 65 Pixel8_Test AVD Android 15 x86_64 Google Play system image] **Banner AdMob renderiza no TOPO da viewport (acima filtros 12h/24h/48h) em vez do rodapé/inline discreto.** Cenário: teste-plus@teste.com (plano Plus = Pro + 1 Ad discreto), login emulator → Dashboard scroll up → banner AdMob "Test Ad" inventory shopping (Google AdMob test ads default) aparece como header strip acima do app, empurrando todo conteúdo pra baixo. Esperado: ad inline ou bottom-anchored, não topo. **Não reproduz em device físico real** (user testou — Ad aparece em posição correta). Hipóteses root cause: (a) AdMob `BannerAd` adaptive anchor flag invertido em emulator system image; (b) viewport height calc errado em WebView Android 15 emulator x86_64; (c) CSS sticky/fixed z-index conflito com plugin Capacitor AdMob nativo; (d) emulator Google Play services AdMob test-mode bug. Screenshot `/c/temp/dash2.png` confirma posição header. Logcat sem warnings AdMob explícitos. Repro: criar AVD Pixel 8 system-image `android-35;google_apis_playstore;x86_64` + install vc 65 Dosy-Dev + login teste-plus + Dashboard. Impacto: emulator validation prejudicada (UI shift), mas releases reais não afetadas (device físico OK). Esforço 2-4h investigar plugin Capacitor `@capacitor-community/admob` config + WebView viewport. Fix opções: (a) força anchor `position=BannerAdPosition.BOTTOM_CENTER` se ainda não está; (b) detectar emulator via `Capacitor.getPlatform() + Build.FINGERPRINT contains 'generic'` e desabilitar Ad; (c) reportar upstream se plugin bug.
- ✅ **#230** [P2 BUG — fechado v0.2.3.2 Edge dose-trigger-handler v21 ACTIVE 2026-05-14 + VALIDADO server-side audit `batchSize=1 groupSize=2 reason=status_change_batch fcmOk=true`] **Fix C hash reconstruction nunca acionado quando user marca 1 dose de N como done.** Cenário: 2 doses Dipirona + Paracetamol mesmo minuto → AlarmScheduler agrupa em 1 alarmId via `idFromString(sortedDoseIds.join('|'))`. User marca Dipirona done. Trigger DB statement-level dispara Edge → `dose-trigger-handler` BATCH_UPDATE com `old_rows=[dipirona]` (batchSize:1). Edge envia FCM `cancel_alarms doseIds="<dipirona-id>"` — CSV com 1 ID. `DosyMessagingService.handleCancelAlarms` linha 214 `if (ids.length > 1)` → Fix C reconstroi hash SÓ se múltiplos IDs no CSV. Com 1 ID, só roda `cancelDoseAlarmAndBackup(idFromString(dipirona-id))` que NÃO match group alarmId. Resultado: group alarm permanece scheduled com ambas doses. Validado SharedPrefs `dosy_critical_alarms.xml` mantém scheduled_alarms entry com Paracetamol+Dipirona pós-cancel. Mitigação: próximo rescheduleAll (app focus) heals automaticamente. Race window: do mark-done até próximo app open. Impacto: alarme dispara horário mesmo dose já done (UX confuso "Ciente(2)" mostra dose done). Fix opções: (a) Edge query OTROS pending no mesmo `date_trunc('minute', scheduledAt)` window + includes em CSV; (b) Java handleCancelAlarms SEMPRE roda reconstruct se >0 (mas precisa contexto do grupo). Opção (a) mais limpo. Esforço 1-2h.
- ✅ **#229** [P1 BUG — fechado v0.2.3.2 commit `1802853` AlarmScheduler.java apply()→commit() em 5 callsites + APK rebuilt vc 65 + RUNTIME validado fire+SharedPrefs commit sync emulator Pixel 8] FLUXO-B v0.2.3.1 device validação 2026-05-14 Pixel 8 emulator **A-03 Fix snooze persist em reboot FALHA — `dosy_critical_alarms.xml` vazio pós-reboot apesar Adiar 10min disparado.** Reproduzido 2 tests independentes via Appium UiAutomator2 textContains("Adiar") tap em AlarmActivity. AlarmActivity.scheduleSnooze chama `AlarmScheduler.persistSnoozedAlarm(ctx, alarmId, snoozeAt, doses)` → `sp.edit().putString(KEY_SCHEDULED, filtered.toString()).apply()` (linha 470). `apply()` é async — escrita em SharedPrefs vai pra disco depois. `adb reboot` imediato após tap kill processo antes flush → dados perdidos. Snoozed alarm NÃO dispara no horário snoozeAt pós-boot. SharedPrefs scheduled_alarms `[]` confirmado. Fix: usar `commit()` em vez de `apply()` em `AlarmScheduler.persistAlarm` (linha 470) OR fazer write síncrono pre-finish() em AlarmActivity.scheduleSnooze. Trade-off: commit() é blocking ~5-20ms mas garante durabilidade. Para snooze action UX é aceitável. Esforço 15min. Detalhe: `android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/AlarmScheduler.java:470`.
- ✅ **#228** [P1 BUG — fechado v0.2.3.2 commit `1802853` fcm.js:96 `unsubscribeFcm` filtra delete por `device_id_uuid` quando disponível (fallback legacy se getDeviceId falha) + APK rebuilt vc 65, multi-device runtime validation observacional Internal Testing real] FLUXO-E v0.2.3.1 device validação 2026-05-14 com 2 devices físicos S25+Emu **`unsubscribeFcm()` (`src/services/notifications/fcm.js:89-99`) DELETA TODOS android push_subscriptions do user, não só do device atual.** Cenário reproduzido: S25 logado teste-plus com push_sub row A (device_id_uuid=de4ce92e); emulator login teste-plus + toggle Notificações OFF → unsubscribeFcm chama `DELETE FROM push_subscriptions WHERE userId=X AND platform='android'` — deleta AMBAS rows (S25 row A + emulator row B). SQL pós-toggle: 0 android rows. Pós toggle ON: só emulator row recriada. S25 órfã sem push_sub apesar ainda logado. **Cross-device contamination:** Device A toggle push OFF apaga FCM subscription do Device B → Device B para de receber alarmes apesar manter login + push ON local. Mesmo bug ocorre em **logout explícito** Device A (per #195 flow) — apaga FCM do Device B. Fix: adicionar `.eq('device_id_uuid', currentDeviceUuid)` no DELETE — Capacitor plugin precisa expor `device_id` SharedPref como currentDeviceUuid. Esforço 1h. Impacto pré-launch: family/caregiver users com múltiplos devices perdem notificações silenciosamente quando outro device é tocado. Relacionado #226 (padronizar device_id UUID — fix deveria ter coberto este caso).
- ✅ **#227** [P1 BUG — fechado v0.2.3.2 commit `1802853` + 2 migrations (`alarm_audit_config_user_select_policy_v0_2_3_2` + `audit_log_policies_final_v0_2_3_2`) — VALIDADO 2026-05-14 todos 6 sources populam alarm_audit_log: edge_daily_sync + edge_trigger_handler + java_alarm_scheduler + java_fcm_received + java_worker + js_scheduler] **alarm_audit_log não recebe entries de `js_scheduler` nem `java_alarm_scheduler` apesar de config `enabled=true`.** Root cause múltiplo: (a) alarm_audit_config RLS=true sem policy SELECT pra authenticated → WITH CHECK EXISTS falha; (b) alarm_audit_log sem SELECT policy own pra `return=representation` PostgREST pattern. Fix 2 policies + APK rebuild vc 65. Validação SQL `SELECT DISTINCT source` retorna 6 sources. Durante FLUXO-A test (teste-plus@teste.com, config enabled=true desde 2026-05-13): logcat AlarmScheduler.java confirma `branch=ALARM_PLUS_PUSH` + `branch=PUSH_CRITICAL_OFF` durante toggle Crítico ON/OFF e Capacitor breadcrumb confirma `rescheduleAll END` com `alarmsScheduled/criticalOffCount/trayScheduled` metadata. Mas query `SELECT source, action, COUNT(*) FROM alarm_audit_log WHERE user_id=<teste-plus-uuid> AND created_at > now() - interval '40min'` retorna SÓ `edge_trigger_handler:fcm_sent:4` — ZERO entries `js_scheduler` (rescheduleAll batches) e ZERO `java_alarm_scheduler` (alarm scheduled/fired events). Esperado: js_scheduler batch_start/scheduled/batch_end per rescheduleAll + java_alarm_scheduler scheduled per dose + fired_received quando dispara. Causa provável: (a) `AlarmAuditLogger.java` Executor falha silenciosa (access_token SharedPref ausente/expirado naquele momento — same pattern #205 fix), OR (b) JS path `logAuditEventsBatch` falha auth (verificar RPC `is_alarm_audit_enabled` cache TTL), OR (c) RLS policy `audit_log_user_insert` bug. Impacto: feature audit v0.2.2.0 inutilizada para FLUXO-A/B/C/D/E validation — só edge_trigger_handler aparece, não permite validar 220.1.1 + 220.2.1 + 220.5.1 do checklist v0.2.2.0. Fix: investigar AlarmAuditLogger swallow exceptions + JS audit batch error logging + verificar cache TTL is_alarm_audit_enabled. Esforço 2-4h. Audit feature broken pré-launch.

#### 🟡 P2 — Média

- ✅ **#089** [BUG-022, fechado organicamente entre v0.1.7.4-v0.2.0.12 — validado user print Pixel 7 emulador 2026-05-05] Layout AdSense banner topo + header Dosy abaixo sem sobreposição. "Dosy" wordmark inteiro visível. Provável fix em release intermediária buffer +4 px `--ad-banner-height` OR refactor AppHeader top calc com `safe-area-inset` + `--ad-banner-height` + `--update-banner-height`. NÃO precisou device-specific intervention.
- ⏳ **#101-followup** [P2 cost] Re-audit egress quando user base ≥100 — comparar baseline atual (~5 testers) vs scaled, decidir se Realtime poll bump (50ms→200ms) é necessário.
- ⏳ **#110** [P2 native, Sentry DOSY-3 REGRESSED + DOSY-7] **Android native crashes — `art::ArtMethod::Invoke` IllegalInstruction + Segfault unknown.** DOSY-3: 2 events 2 users. DOSY-7: 1 event Segfault. Investigar: AlarmActivity refactor v0.2.0.0 ValueAnimator + FrameLayout / DosyMessagingService FCM data handler / plugin nativo version mismatch / ProGuard R8 rules / Sentry NDK upload (#074 unblocked).
- ✅ **#123** [P2 UX/security, fechado v0.2.0.3] Sessão não invalida após DELETE auth.users. Fix useAuth boot: após getSession(), chama supabase.auth.getUser() (bate na API). Erro/null força signOut local + clear cache. Cobre: user deletado, banned, JWT key rotation.
- ✅ **#162** [P2 UX, fechado v0.2.1.3 vc 50+51 (2026-05-07) — validado device user] TreatmentForm Mounjaro repro prevention. **v1 (vc 50):** warning amarelo inline quando intervalHours/24 > durationDays. **v2 (vc 51):** toggle Dias/Semanas/Meses acima campo Duração + auto-switch baseado intervalHours (24h→Dias, 168h/336h→Semanas, 720h→Meses). Internamente persiste durationDays (×1, ×7, ×30 multiplier). Edit mode detecta best unit display (28d→4 Semanas, 30d→1 Mês, 21d→21 Dias). User feedback v1 OK → migrou v2 confirmou OK.
- ✅ **#190** [P0 BUG critical, fechado v0.2.1.3 vc 50 (2026-05-07) — validado device user] BUG-LOGOUT-RESUME extends #159. User-reported "app deslogando CONSTANTEMENTE em idle". Root cause useAppResume.js:44 `refreshSession()` long idle falha transient (Android Doze, SecureStorage hiccup) → SIGNED_OUT cascade. Fix: mesma estratégia #159 em resume path — distinguir transient vs auth real (401/403/refresh-revoked); preservar session em transient; remover `window.location.reload()` fallback agressivo. Validação device: idle >5min + ciclos repetidos = continua logado. Detalhe completo CHECKLIST §#190.
- ✅ **#189** [P2 UX, fechado v0.2.1.3 vc 49 (2026-05-07) — validado device user] UpdateBanner versionName fix. useAppUpdate.js triple fallback chain: Play Core `availableVersion` → version.json Vercel → local map VERSION_CODE_TO_NAME → "versão N" PT-BR friendly. Promise.allSettled paralelo Play Core + version.json. Banner mostra "v0.2.1.3" (não "v code 49"). User-reported confirmado fix.
- ⏳ **#191** [P0 pré-OpenTest ✨ MELHORIAS — promove plan-original FASE 16.3] Tela "Meu plano" acessível Free/Plus/Pro (não só paywall). Hoje paywall só fluxo Free com limite — Plus user preso, sem caminho UI pra virar Pro. Solução: tela `/meu-plano` com 3 estados (Free 3 cards, Plus card atual + Pro CTA, Pro link "Gerenciar Play"). Bloqueador conversion Plus→Pro. Inclui restore purchases + política cobrança + badge More.jsx. Detalhe CHECKLIST §#191.
- ⏳ **#192** [P0 pré-OpenTest 🚀 IMPLEMENTAÇÃO — promove plan-original FASE 16.4] Validar pagamento E2E (sandbox + License Tester). Cobre Free→Plus, Free→Pro, Plus→Pro, Cancel, Restore Purchases, edge cases (network fail, conta troca, multi-device). BLOQUEADOR launch OpenTest. Esforço 1-2 dias. Detalhe CHECKLIST §#192.
- ⏳ **#193** [P1 🚀 IMPLEMENTAÇÃO — promove plan-original FASE 16.2 reformulado] Webhook Google Play RTDN (Real-Time Developer Notifications). Plan original era RevenueCat→Supabase; reformulado direto Pub/Sub→Edge Function `play-billing-webhook` (evita custo+complexity RevenueCat). Atualiza tier table imediatamente sem precisar app abrir. Cobre SUBSCRIPTION_CANCELED/EXPIRED/RECOVERED/RESTARTED/GRACE_PERIOD. Esforço 1-2 dias. Detalhe CHECKLIST §#193.
- ⏳ **#194** [P1 pré-OpenTest ✨ MELHORIAS] Analytics flow upgrade — eventos PostHog completos (`manage_plan_opened`, `plan_card_clicked`, `upgrade_complete` com from/to_tier, `cancel_detected` via RTDN). Permite funnel conversion no painel admin /analytics. Detalhe CHECKLIST §#194.
- ✅ **#195** [P0 fechado v0.2.1.5 vc 52 (2026-05-08) 🐛 BUGS] Não DELETAR push_subscription em `SIGNED_OUT` automático — flag `dosy_explicit_logout` em signOut() distingue logout real (botão Sair) de SIGNED_OUT spurious. Fix em `useAuth.jsx:127-143`. Origem: investigação user-reported 2026-05-07 (alarme 20h não tocou + app deslogou).
- ✅ **#196** [P0 fechado v0.2.1.5 vc 52 (2026-05-08) 🐛 BUGS] useAuth `onAuthStateChange` ignora SIGNED_OUT spurious validando `getSession()` antes de processar. Extends #159 + #190. Listener antes capturava QUALQUER SIGNED_OUT do Supabase JS — agora se session local válida, ignora como transient.
- ✅ **#197** [P1 fechado v0.2.1.5 vc 52 (2026-05-08) 🚀 IMPL] Cron `notify-doses-1min` (`* * * * *`) restaurado como fallback push tray. Edge Function `notify-doses` redeployed `verify_jwt: false`. Defense-in-depth: caminho 1 (FCM data → AlarmScheduler) + caminho 2 (push tray cron 1min) garantem entrega.
- ✅ **#198** [P1 fechado v0.2.1.5 vc 52 (2026-05-08) 🐛 BUGS] Detectar install/upgrade APK via `localStorage.dosy_last_known_vc` + skip `scheduleDoses` quando `dosesLoaded && patientsLoaded` é false (evita window vazio durante login). App.jsx useEffect refactor.
- ✅ **#199** [P2 fechado v0.2.1.5 vc 52 (2026-05-08) 🚀 IMPL] Cron diário `0 5 * * *` cleanup push_subscriptions stale > 30d (deviceToken=NULL). Migration `20260507230500_cleanup_stale_push_subs_cron.sql`.
- ✅ **#200** [P1 fechado v0.2.1.5 vc 52 (2026-05-08) 🐛 BUGS] HORIZON cron `schedule-alarms-fcm` 24h → 30h + doc `docs/alarm-scheduling-shadows.md` enumera 7 sombras (A-G) + matrix cobertura por caminho. Sombra G (SIGNED_OUT spurious) resolvida via #195+#196.
- ✅ **#200.1** [P1 fechado v0.2.1.5 vc 52 (2026-05-08) 🐛 BUGS] `rescheduleAll` idempotente diff-and-apply via localStorage `dosy_scheduled_groups_v1`. Calcula `toRemove`/`toAddOrUpdate`/`toKeep`. Primeira execução por sessão força `cancelAll()` (cobre install fresco). Janela vazia 200-2000ms eliminada.
- ✅ **#201** [P1 fechado v0.2.1.5 vc 53 (2026-05-08) 🚀 IMPL] Telemetria auth events em `medcontrol.auth_events` (RPC `log_auth_event` + `admin_list_auth_events`). 5 tipos: login_email_senha / criou_conta_nova / recuperacao_senha / sessao_restaurada / clicou_sair. Descrições PT-BR amigáveis em `details.descricao`. Painel admin `/auth-log` renderiza em PT-BR + filtros user/tipo/versão.
- ✅ **#202** [P0 fechado v0.2.1.5 vc 53 (2026-05-08) 🐛 BUGS] Mutex `refreshInProgress` + debounce 1s em `useAppResume` previne refresh storm. Bug observado prod 2026-05-08 09:00 BRT user lhenrique.pda: 5 refresh tokens rotacionados em 1.48s → Supabase detectou reuse → revogou chain inteira. Causa: visibilitychange + window focus + Capacitor appStateChange disparam onResume() quase-simultâneos.
- ✅ **#203** [P2 fechado v0.2.1.6 vc 54 (2026-05-08) ✨ MELHORIAS] Som de alarme customizado `dosy_alarm.mp3` em `res/raw/` (96kbps mono, 811KB, 50% redução do original 1.66MB). `AlarmService` já tinha fallback raw; `AlarmReceiver` channel atualizado pra usar raw + bump `CHANNEL_ID` `doses_critical_v2` (sound immutable após channel criado).
- 🚧 **#224** [P2 BUG — origem auditoria 2026-05-13 B-13 + decisão user 2026-05-13 margem 2h — código mergeado em #215 release/v0.2.3.0: BootReceiver LATE_ALARM_GRACE_MS = 2h + flag lateRecovery, validação device pendente] **BootReceiver perde alarmes que passaram durante boot.** `BootReceiver.java:41` skipa `if (triggerAt <= now)`. Cenário: user dorme com phone off, boota às 9am, dose era 8am → BootReceiver pula esse alarme; dose fica `pending` no DB sem alerta visual até user abrir app. Fix: se `(now - triggerAt) < 7200_000` (**2h margem** — alinha decisão user pós #215), agendar alarme imediato em vez de skip. Aceitável user ver "atrasada" mas é notificado. Esforço 30min. Detalhe CHECKLIST §#224.
- ✅ **#208** [P2 BUG, fechado v0.2.1.9 vc 57 entries 56+57 adicionadas + memory `feedback_release_lifecycle.md` lembrete obrigatório] **UpdateBanner mostra versão errada quando entry falta no `VERSION_CODE_TO_NAME` map.** Extends #189 fix triple fallback chain. Bug recorrente: a cada release nova, falta `[vc]: 'versionName'` em [`useAppUpdate.js:89-101`](src/hooks/useAppUpdate.js) — fallback chain cai pra "versão N" feio OR cache stale Vercel CDN serve versionName antigo. User instalou vc 55 → banner mostrou "v0.2.1.7" (versão atual instalada) ao invés de "v0.2.1.8" (nova disponível). Plus comentário `// adicionar próximas releases aqui` nunca lembrado release lifecycle. **Fixes propostos:** (a) **Curto-prazo** — entry manual 56:'0.2.1.8' + 57 placeholder + memory note pra lembrar release lifecycle. (b) **Longer-term** — Vite plugin gera map dinamicamente a cada build via `vite-plugin-dynamic-versions` OR build script lê git tags + emite `versionMap.json` deployado junto `version.json`. Elimina bug recorrente. Esforço (a) 5min, (b) 1-2h. Não-bloqueador release v0.2.1.8 (cosmético — fluxo update funcionou, só label banner errado).

---

### 6.7 🔄 TURNAROUND — Mudanças drásticas

#### 🔴 P0 — Bloqueadores

- 🚧 **#215** [P0 v0.2.3.0 🔄 TURNAROUND — código mergeado release/v0.2.3.0, AAB+validação device pendente] — origem: auditoria 2026-05-13 + decisões user 2026-05-13 pós-revisão plano 3 cenários] **Refactor scheduler unificado 3-cenários + push backup co-agendado + cobertura DnD/criticalAlarm-off + janela dinâmica + cuidador compartilhado.** Auditoria identificou: (i) **B-01** janela DnD = zona silêncio total pós #209; (ii) **B-02** `criticalAlarm=false` + app background = silêncio total; (iii) **B-09** `dose-trigger-handler` 6h hardcoded desalinhado 48h horizon; (iv) lógica duplicada 4 lugares cross-source drift. **Solução unificada user-aligned:** 1 helper `scheduleDoseAlarm(ctx, dose, prefs)` chamado pelos 3 cenários: **Cenário 01** app abre/atualiza/muda toggle prefs → cancelAll + reagenda janela dinâmica; **Cenário 02** status change dose (Tomada/Pulada/Desfazer) → atualiza local + servidor envia FCM `schedule_alarms`/`cancel_alarms` pra TODOS aparelhos (paciente + cuidadores) que aplicam próprias prefs; **Cenário 03** WorkManager 6h Android background + cron daily 5am BRT Edge `daily-alarm-sync` FCM data. **3 branches no helper:** (a) `push_critical_off` (Alarme Crítico OFF) → só push tray canal `dosy_tray` sound default; (b) `push_dnd` (DnD janela) → só push tray canal `dosy_tray` vibração leve 200ms sem sound (decisão 3); (c) `alarm_plus_push` (caso normal) → alarme nativo `setAlarmClock` + LocalNotification backup co-agendada (ID = groupId + BACKUP_OFFSET). AlarmReceiver.onReceive cancela backup ao disparar anti-duplicate. OEM mata alarme → backup dispara fallback. **Decisões user consolidadas:** (2) BootReceiver margem 2h #224 alinhada; (3) push DnD vibra leve; (4) toggle OFF cancela alarmes nativos + recadastra como push; (6) cuidador SEMPRE recebe alarme cheio prioridade + respeita DnD próprio; (8) **janela dinâmica** — se itens projetados > 400 (margem 100 do limit ~500 Android) → horizon 24h, senão 48h; (9) update_treatment_schedule regenera + Cenário 02 dispara cancel+schedule cross-device; (10) cuidador sempre recebe (toggle opt-in futuro parqueado); (11) **admin `/alarm-audit` mantém funcional** — `alarm_audit_log` populado em todos 4 paths com metadata `{branch, horizon, source_scenario, groupId, criticalAlarmEnabled, dndEnabled, inDndWindow, reason}`. **Auditoria egress + storm:** zero egress server-side (LocalNotification local); FCM Cenário 02 ~5/dia/user trivial; throttle 30s + signature guard já cobrem storm; janela dinâmica previne estouro 500 limit. **Esforço:** 10-14h. **Pode ser mergeado em release com bump versão app (gera AAB novo).** Detalhe completo CHECKLIST §#215 (13 cenários validação device).

---

### 6.7 fechados

- ✅ **REDESIGN v0.2.0.0** [Turnaround visual completo, fechado 2026-05-03] Peach/sunset palette + Sheet/Modal/Card primitives + DoseCard + PatientCard + AppHeader + 18 telas migradas. Coleção de items individualmente classificados (#099 #102-#109 #114-#123 — ver §6.5/§6.6). Próximas turnarounds candidatas hipotéticas: pivot iOS first, schema breaking change LGPD, modelo plano Family DB rework.

---

## 7. Itens descartados pela auditoria (com justificativa)

- **[Plan FASE 14.2 Sentry Replay]** — pulado por privacy concerns saúde. Manter pulado.
- **[REQUEST_IGNORE_BATTERY_OPTIMIZATIONS]** — não-incluído deliberadamente; `setAlarmClock()` bypassa Doze nativamente. Decisão correta.

---

## 8. Critérios de saída por fase

> Estado real cruzando contra §6 catálogo. Status ✅ = critério cumprido; ⏳ = pendente; 🚨 = bloqueado.

### Internal Testing → Closed Testing
- ⏳ Todos P0 fechados (#001-009) — **#006 device validation 3 devices ABERTO**; #009 PITR DEFERRED com DR drill alternativo
- ✅ Vídeo FGS demo no Console (#004)
- ⏳ Device validation FASE 17 (#006) — manual user, 3 devices físicos
- ✅ Telemetria notification_delivered ativa (#007)
- ✅ BUG-001 encoding verificado em criação via UI (#005)
- ✅ Screenshots retrabalhados (#025)

### Closed Testing → Produção
- ⏳ 12+ testers ativos por 14 dias (#131 + #132) — Closed Testing track ATIVO desde 2026-05-06 (#158 resolvido), aguarda recrutamento Reddit
- ⏳ NPS médio ≥7 — sem dashboard medindo formalmente
- ⏳ Zero crashes nos últimos 7 dias — depende Sentry monitoring durante Closed Testing
- ⏳ Todos P1 fechados ou justificados — #018 ✅ fechado v0.2.1.3, #021 (backup keystore) pendente
- ⏳ Crash-free rate ≥99.5%, ANR <0.5% — sem dashboard medindo formalmente
- ⏳ Notification delivery rate ≥99% (medido via #007) — telemetria ativa, dashboard PostHog manual pendente

### Critérios contínuos pós-launch
- ⏳ Crash-free rate ≥99.5% — aspiracional (app não está em Produção ainda)
- ⏳ ANR rate <0.5% — aspiracional
- ⏳ Retention D7 ≥40% — aspiracional
- ⏳ Avaliação Play Store ≥4.3 — aspiracional
- ⏳ Notification delivery ≥99% — aspiracional

---

## 9. Como retomar trabalho em chat novo

**Prompt template para novo chat:**

```
Continuação do desenvolvimento Dosy. Leia analise/ROADMAP.md inteiro
primeiro pra contexto + estado atual + próximo passo.

Estou trabalhando no item #XXX. [descrever objetivo específico]

Confirme antes de começar:
1. Branch atual + sync com origin
2. Item #XXX está mesmo aberto no ROADMAP
3. Dependências do item já fechadas (se houver)

Não altere código sem aprovação. Detalhes técnicos em
analise/CHECKLIST.md §#XXX.
```

**Workflow padrão para fechar item:**

1. Ler item correspondente em `CHECKLIST.md` (snippet, dependências, critério aceitação)
2. Implementar mudança no código
3. Validar critério de aceitação
4. Commit com mensagem `feat(0.1.6.X): [item #XXX] [descrição]` ou `fix`/`security`
5. Marcar `[x]` neste ROADMAP + atualizar contadores §6
6. Se descobrir novo bug/item durante: adicionar ao ROADMAP na prioridade certa antes de fechar

**Sinalização de progresso:**

Após cada item fechado, atualizar contadores no topo §6:
```
**Total:** 154 itens (auditoria 2026-05-05) · 101 `[x]` · 50 `[ ]` · ~3 followups
                                ↑ decrementar conforme fecha
```

---

## 10. Limitações e gaps conhecidos da auditoria

1. **Live nav curta** (~15 min, não 90 min do prompt original) — credenciais fornecidas tarde. Sessão profunda manual em device físico fica como gate FASE 17.
2. **`remote_schema.sql` vazio** — RLS policies inferidas via Plan/SECURITY/services. Rodar SQLs em [04 §15](auditoria/04-supabase.md#15-recomendações-sql-prontas) no Supabase Studio para confirmação definitiva.
3. **Sem Lighthouse / device profile** — métricas placeholder. Validação device físico necessária.
4. **Sem testes E2E** — fluxos completos cobertos parcialmente. Ver [06 §"Bugs cobertos pela auditoria"](auditoria/06-bugs.md) para lista de cenários ainda não-testados.
5. **TS 6.0.3** — verificação legitimidade pendente (BUG-007).

---

## 11. Pergunta-chave do auditor

> *"Eu colocaria minha mãe ou meu filho dependendo deste app amanhã?"*

**Hoje:** Não com convicção total.
**Após P0 fechados + device validation:** SIM convicto.

A base é genuinamente sólida — alarme nativo, RLS defense-in-depth, LGPD coberta, bundle 64 KB. Falta fechar pontas específicas em ~3-5 dias-pessoa concentrados.

---

## 12. Resumo numérico (atualize após cada item fechado)

> Snapshot v0.2.1.4 (2026-05-06). Counter detalhado em §6.2 com sub-distribuição por categoria × prioridade.

- **Total:** ~211 itens (recount real grep 2026-05-08, +1 #204 v0.2.1.7)
  - ✅ 138 fechados (+10 em v0.2.1.5/v0.2.1.6)
  - ⏳ 69 abertos (+1 #204 v0.2.1.7)
  - 🚧 1 (#170 valid device pendente, código merged vc 50)
  - 🚨 0 BLOQUEADOS
  - 🚫 3 cancelados
- **Distribuição por categoria abertos (69 ⏳ + 1 🚧 = 70 total):**
  - 🚀 IMPLEMENTAÇÃO: 20 (7 P0 + 10 P1 + 3 P2)
  - ✨ MELHORIAS: 48 (2 P0 #191 #194 + 3 P1 + 14 P2 + 29 P3)
  - 🐛 BUGS: 2 (P2 — #101-followup #110)
  - 🔄 TURNAROUND: 0
- **P0 abertos críticos launch:** #131 (recrutar Reddit, agora desbloqueado) + #132 (gate 14d) + #133 (Production access) + #006 (device validation FASE 17) + **#191 #192** (pré-OpenTest revenue path) + **#204** (mutation queue offline pré-Teste Fechado)
- **P1 escala egress (preparar Open Testing):** #163 RPC consolidado + #164 Realtime broadcast + #165 Delta sync + persist
- **P1 growth/marketing/ASO:** #169 ASO Play Store + #170 Reviews strategy + #171 Marketing orgânico + #173 Healthcare differentiators moat
- **P1 features differentiators launch:** #174 OCR med scan + #175 Receita scan auto-import + #176 Adesão report PDF + #177 WhatsApp share + **#188 🔥 Mini IA Chat NLP cadastro (KILLER feature mundial)**
- **P2 escala egress:** #166 MessagePack + #167 Cursor/cols/Supavisor + #168 CDN cache strategy
- **P2 growth/features:** #172 Landing+blog SEO + #178 Alzheimer escalada + #179 Wear OS + #180 Health metrics + #181 Voz/TTS + #183 Refill affiliate
- **P3 backlog features:** #064 #065 #066 (promovidos #173) + #182 mood + #184 Telemedicina + #185 Cuidador B2B + #186 Apple Health/Google Fit + #187 Memed/Nexodata
- **iOS:** #068 mantém P3 (user confirmou 2026-05-07: NÃO promove antes tração Android — custo dev/validação/infra alto)
- **Esforço P0 restante até Production:** ~14d gate testers (#131 recrutamento Reddit em curso + #132 14d ativos + #133 Production access ~24-72h Google) — Google review #158 RESOLVIDO 2026-05-06
- **Esforço escala egress:** ~14-21h código (#163-#168 distribuído próximas releases)
- **Esforço growth/marketing:** ~50-65h initial (#169-#173) + 2-3h/semana ongoing (#171 content calendar)
- **Esforço features differentiators (#174-#187):** ~110-160h código distribuído v0.2.2.0+ → v1.0.0+
- **Wallclock até Open Testing pública:** ~3-5 semanas (Closed Testing ATIVO desde 2026-05-06, recrutamento Reddit em curso → 14d gate ≥12 testers → Production access ~72h → ramp Open Testing 7-14d) — egress + growth + features differentiators em paralelo

---

🚀 **Próximo passo concreto:**
1. Aguardar Google re-review v0.2.1.2 fixes (#158 desbloqueio Closed Testing — ETA 24h-7d)
2. Em paralelo: validar app prod estável (egress baseline pós-#157 storm fix; Sentry crash-free; user feedback teste-plus/teste-free)
3. Pós-desbloqueio: #131 recrutamento Reddit + #132 gate 14d ≥12 ativos + #133 solicita Production
4. Backlog v0.2.1.4+: #162 TreatmentForm UX warning (Mounjaro repro prevention)
