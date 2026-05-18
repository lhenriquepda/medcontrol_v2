# Roadmap de Lançamento — Dosy

> **Documento de entrada.** Se você é um chat novo retomando o trabalho, comece aqui. Este arquivo é self-contained: tem contexto, estado atual, onde paramos, próximo passo, mapa dos demais arquivos e checklist macro completo.

---

## 🛑 REGRA CRÍTICA — Validação SEMPRE em conta teste

**IA NUNCA valida em conta pessoal do user.** Toda validação E2E autônoma (criar tratamento/paciente/dose/regra SOS) **DEVE** rodar em `teste-free@teste.com`, `teste-plus@teste.com` ou `teste-pro@teste.com` (senha `123456`).

Antes de qualquer Chrome MCP `left_click` em botão Criar/Salvar/Submit, IA verifica usuário logado (header "Boa noite, X" + `SELECT auth.uid()`). Se conta pessoal → logout + login conta teste.

Validação em conta pessoal polui dados reais → risco LGPD + drift + reprimenda forte. Ver `context/RULES.md` Regra 15.

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
   - CHECKLIST → criar entry completo com `**Categoria:**` + `**Prioridade:**` (template no próprio CHECKLIST.md — ver entradas existentes como modelo)
   - ROADMAP §6.2 sub-counter: incrementar categoria/prioridade
   - ROADMAP §6.3 Δ Release log: documentar item novo
   - Update log → seção "Items novos descobertos"

**Próximo número livre** (numeração cross-categoria global):
```bash
grep -oE "#[0-9]{3}" context/ROADMAP.md context/CHECKLIST.md | sort -u | tail -5
```

**Drift histórico observado:** items fechados sem update CHECKLIST → re-implementação acidental → conflito git. Última auditoria 2026-05-05 fechou ~60 discrepâncias acumuladas v0.1.7.4-v0.2.0.11. Rodar auditoria semestral cross-ref ROADMAP × CHECKLIST × `updates/*.md`.

**Detalhe completo das regras:** ver `context/RULES.md` (Regras 1-15).

> Estado atual (versão, branch, P0s, contas teste) → [`context/STATE.md`](STATE.md)

---

## 3. Onde paramos

> 🚨 **IA: SEMPRE varrer [`context/BUGS.md`](BUGS.md) ANTES desta seção.** ROADMAP cobre **features, melhorias e roadmap de lançamento**. Bugs ativos ficam em `BUGS.md` com numeração própria (#0001+) e severidade P0/P1/P2/P3/P4. Alertar o user sobre bugs abertos no início de cada sessão (Passo 0 README), igual ao alerta de itens pendentes do Validar.md.

**Branch ativa:** master @ tag `v0.2.3.11` (vc 74). Play Console Internal Testing publicado 2026-05-17 22:55 BRT. Vercel prod dosymed.app v0.2.3.11 confirmado 2026-05-18T01:58Z. Master merge `21b6a0e`. Todos os bugs #0001–#0008 fixados + feature #299 (in-app update DB autoritativo + modal mandatory). Pendência: validações device físico Samsung S25 Ultra após propagação Internal Testing (~1h).

**Bugs abertos:** ver [`context/BUGS.md`](BUGS.md) — nenhum bug aberto.

**✅ SHIPPED master `release/v0.2.3.11`** (vc 74, base master v0.2.3.10 vc 73):
- ✅ **#0001** P2 — Push subscription não registra auto — `useAuth` SIGNED_IN + INITIAL_SESSION auto-subscribe se perm=granted. Commit `7e043ab`. Validado emulador.
- ✅ **#0002** P2 — Banner Desfazer invisível device físico — `useToast` bottom `calc(6rem + safe-area-inset-bottom)`. Commit `7e043ab`. Validado CDP.
- ✅ **#0003+#0004** P2 — unshare background `startActivity` + tela "Paciente Carregando..." — WeakRef + SharedPrefs + var separada `__dosyPendingUnsharePatientId`. Commits `7e043ab` + `1062e62`. Validado behavioral 2-devices (Chrome web teste-plus + emulador teste-free).
- ✅ **#0005** P2 — Status "Cancelada" em Reports pós pause/resume — `resumeTreatment` restaura cancelled→pending + Reports exclui cancelled do denominador. Commit `3d73a57`. Validado live (Adesão 67% durante pause, não 40%).
- ✅ **#0006** P2 — Console `[object Object]` no logcat — root cause Capacitor bridge `console.dir(call)` debug-only + Sentry capture AppUpdate err -6 (emulador only). Fix: `capacitor.config.ts` `loggingBehavior: 'production'`.
- ✅ **#0007** P3 — SOS/DoseModal HORÁRIO en-US — `DoseModal` split `datetime-local` → `date`+`time`. Commit `3d73a57`. Validado.
- ✅ **#0008** P4 — "1 dias" pluralização — `Number(t.durationDays) === 1`. Commit `3d73a57`. Validado visual.
- ✅ **#299** Feature — Tabela `medcontrol.app_releases` autoritativa pra in-app update banner. Substitui mapa hardcoded + cadeia frágil Vercel. Banner verde dismissable default + modal vermelho full-screen quando `is_mandatory=true`. IA atualiza no Passo 12 via INSERT idempotente. Migration `20260518000000_app_releases_v0_2_3_11.sql` aplicada + `useAppUpdate.js` + `UpdateBanner.jsx` refatorados + README Passo 12 atualizado.

**✅ SHIPPED master `release/v0.2.3.8`** (vc 71, Play Console Internal Testing publicado 2026-05-17 14:32 BRT, tag `v0.2.3.8` merge `9bf1436`, Vercel prod dosymed.app v0.2.3.8 confirmado). 1 item P0: **#287** P0 BUG — killed caregiver alarm gap arquitetural FCM `notification` payload bloqueava `onMessageReceived` (Firebase Android SDK auto-renderiza tray + não chama handler), AlarmScheduler nunca executava no caregiver. Fix: Edge `dose-trigger-handler` v25 + `dose-fire-time-notifier` v7 enviam DATA-ONLY HIGH (sem notification block) → handler nativo executa + agenda AlarmManager.setAlarmClock OU dispara AlarmService FG imediato via novo `kind=fire_now_alarm`. QA emulador 3/3 PASS (S1 owner sem share, S2 caregiver background recebe schedule_alarms + alarme dispara, S3 caregiver background recebe fire_now_alarm + AlarmService FG dispatched). Commits `981fab4` + `ed180cc`.

**✅ SHIPPED master `release/v0.2.3.7`** (vc 70, Play Console Internal Testing publicado 2026-05-17 11:04 BRT, tag `v0.2.3.7` merge `e0933f8`). 10 itens fechados (perf bundle F1+F3+F6+F5 + server flow #279/#280/#281 + idempotência+WorkManager #282 + RPC userId=owner #283 + QA exaustivo #284). QA 21/21 OK ([QA_REPORT_v0_2_3_7_full_rerun.md](archive/qa/QA_REPORT_v0_2_3_7_full_rerun.md)).

**Releases shipped recentes:** ver §6.3 Δ release log e [`context/updates/`](updates/) — features, perf, refactors. Bugs específicos consolidados em [`BUGS.md`](BUGS.md) (abertos + histórico SHIPPED).

**✅ SHIPPED master `release/v0.2.3.6`** (vc 69, Play Console Internal Testing publicado 2026-05-15, tag `v0.2.3.6` merge `348eff7`). QA completo Chrome MCP localhost teste-plus@. 11 itens fechados + 5 P2-P4 abertos próxima release (#259-#263).

**✅ SHIPPED `release/v0.2.3.6` (detalhe itens):**
- ✅ **#250** P3 FEATURE ANVISA autocomplete medicamentos — `medications_catalog` 764 rows ETL + `search_medications` RPC unaccent + `MedNameInput.jsx` 3-fontes (local + ANVISA + userMeds) + `useMedCatalogSearch` hook 300ms debounce 10min staleTime
- ✅ **#253b** P2 BUG email template wordmark texto (img→CSS)
- ✅ **#254b** P2 BUG self-patient via user_metadata + session mutex + cache invalidate signup
- ✅ **#256b** P1 BUG SOS submit trava silencioso (3 causas): window.confirm→ConfirmDialog + onClose toast cleanup + `p_force` param RPC `register_sos_dose`
- ✅ **#257b** P1 BUG skeleton infinito pós-idle — `processLock` + `lockAcquireTimeout: 15s` (supabase.js)
- ✅ **#258b** P1 BUG sharing Dashboard não incluía pacientes compartilhados (`get_dashboard_payload` RPC CTE)
- ✅ **#255** P1 BUG idle longo (>1h token expirado) → skeleton infinito — fix v1 localStorage (`de90af7`) substituído v2 `inactiveMs > SUPABASE_TOKEN_LIFETIME_MS` (`6ac556e`) — funciona localStorage E SecureStorage nativo
- ✅ **#264** P1 BUG Dose 1ª passada pulada no `create_treatment_with_doses` — fix SQL removeu WHILE pula-passado + Form `type=date` + helpers `toDateInput/fromDateInput` (`4113639`)
- ✅ **#265** P2 BUG Total doses incorreto (15 esperado, 12 gerado) — fix SQL count exato `CEIL(durationDays × 24 / intervalHours)` (`4113639`)
- ✅ **#266** P1 BUG PatientDetail não mostrava tratamento recém-criado — fix `insertEntityIntoLists` em todas variações `['treatments', *]` + onSuccess loop substitui temp→real (`4113639`)
- ✅ **#267** P1 BUG Dashboard skeleton em troca de hora — fix `placeholderData` fallback varre cache `['dashboard-payload', *]` cross-key (`20efdbf`)

**Bugs detectados no QA v0.2.3.6 2026-05-15 — abertos para próxima sessão:**
> Relatório completo: [`QA_REPORT.md`](archive/qa/QA_REPORT.md)
- ✅ **#259** P2 BUG Status "Cancelada" em Relatórios após ciclo pause/resume — fixado como #0005 em v0.2.3.11.
- ✅ **#260** P2 BUG Console errors `[object Object]` — fixado como #0006 em v0.2.3.11 (`loggingBehavior: 'production'`).
- ✅ **#261** P3 BUG HORÁRIO SOS formato en-US — fixado como #0007 em v0.2.3.11 (`datetime-local` → `date`+`time` separados).
- ⏳ **#262** P3 UX Ad banner Plus renderiza ACIMA do header (QA BUG #2) — pendente.
- ✅ **#263** P4 UX "1 dias" pluralização — fixado como #0008 em v0.2.3.11.

**Regra crítica (`RULES.md` Regra 15):** IA NUNCA valida em conta pessoal — SEMPRE teste-free/teste-plus/teste-pro @teste.com pwd 123456.

**✅ SHIPPED `release/v0.2.3.5`** (vc 68, Play Console Internal Testing publicado 2026-05-15, tag `v0.2.3.5` commit `bf447d3`, Vercel prod dosymed.app):
- ✅ **#239** P1 BUG optimistic cache patch (regression #163)
- ✅ **#240-#241** P2 UX SOS + TreatmentList redesign
- ✅ **#243** P1 BUG Reports fmtDateInput UTC shift + isLoading distingue fetch
- ✅ **#244** P2 UX sistema gradiente unificado (token muted + Card variant)
- ✅ **#245** P2 UX Dark warm palette migration (slate→Dosy warm)
- ✅ **#246** P3 CLEANUP remove Estilo de ícones toggle (Flat padrão)
- ✅ **#247** P2 UX TreatmentForm redesign + PatientPicker PatientAvatar real
- ✅ **#248-#249** P2 UX Reports + Analytics redesign
- ✅ **#251** P1 BUG share Plus gating client+server (migration + copy cleanup)
- ✅ **#252** P2 UX tela "Verifique email" pós-signup (substitui toast vermelho)
- ✅ **#253** P2 UX email template Dosy branded (wordmark CSS, sunset hero, CTA)
- ✅ **#254** P2 FEATURE checkbox "criar paciente com meu nome" (user_metadata cross-device + session mutex + qc.invalidate)
- ⏭️ **#250** P3 DEFERIDO → v0.2.3.6 ✅ entregue

**Release anterior shipped v0.2.3.2 (2026-05-14):**

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
- Documentado: `android/gradle.properties` (comment header), `context/recipes/gradle-build.md`.

**Commits v0.2.3.2:** `1802853` fix #227-#230 + `a1ea4cd` docs Validar 100% + `2d460b4` docs ROADMAP §3+§6.3 + `e0fde9d` build CLI fix + release notes + AAB published + `c0cb372` merge master.

**✅ SHIPPED `release/v0.2.3.3`** (vc 66 Play Console Internal Testing 14/05 17:34 BRT, tag `v0.2.3.3` master merge `167bf47`):
- ✅ **#231** P2 BUG layout AdMob banner — patch-package plugin Android 15 topInset duplicado (`ce7d4c9`)
- ✅ **#232** P1 BUG ANR MainActivity.onCreate — WorkManager+cleanupChannels off-main-thread (`b373675`)
- ✅ **#233** P1 BUG 401 race tokens — Java Worker EXP_SAFETY_MARGIN 60s→300s (clock skew tolerance)
- 🚫 **#234** P2 Cache-Control — SUPERSEDED por #165
- ✅ **#074/#110** P2 Sentry Gradle Plugin 4.14.1 setup (token-conditional upload)
- ✅ **Sentry triage** — 15 → 3 abertas

**✅ SHIPPED `release/v0.2.3.4` (detalhe itens):**
- ✅ **#163** P1 RPC consolidado `get_dashboard_payload` Dashboard (4 round-trips → 1, esperado -40% a -60% Dashboard egress)
- ✅ **#165** P1 IndexedDB persist via idb-keyval + staleTime 5min→30min (-70% a -90% reads steady state combinado)
- ✅ **#236** P1 BUG UpdateBanner versionName incorrect — reorder fallback chain Play Core → local map → Vercel
- ✅ **#237** P1 BUG Dashboard skeleton infinito pós-resume — placeholderData + retry 5 backoff + error UI explícita
- 🚫 **#164** Realtime broadcast — PARKED (ROI baixo, FCM cobre 95% sync cross-device)
- 🚫 **#235** Free bottom banner — DEFERIDO v0.2.3.5 (5-8h patch plugin singleton state)

Esforço v0.2.3.3 final: ~5h aplicado. Validação via emulator autônomo (`context/recipes/emulator-setup.md`).

**✅ SHIPPED `release/v0.2.3.5` (detalhe itens):**
- ✅ **#239** P1 BUG optimistic skip/confirm patch cache `dashboard-payload` (regression #163) (`11248cd`)
- ✅ **#240** P2 UX SOS redesign — hero card peach→danger + chips paciente + grid recentes + Regras collapsible + form alerta over-limit (não bloqueia)
- ✅ **#241** P2 UX TreatmentList redesign — hero stats 3-col + filter chips paciente PatientAvatar + Ativos collapsible + cards visuais
- ✅ **#243** P1 BUG Reports "Sem doses" durante refetch + formatDate UTC parse shift -1 dia BRT — `isLoading` distingue fetch de empty + `fmtDateInput` helper local
- ✅ **#244** P2 UX Sistema gradientes unificado — token `--dosy-gradient-sunset-muted` + Card variant `muted` + padronização hero sunset (Reports/TreatmentList/Analytics/SOS/Settings)
- ✅ **#245** P2 UX Dark mode warm palette — legacy slate-950/900 → Dosy warm `#1C1410/#261B16` + focus ring peach (antes azul)
- ✅ **#246** P3 CLEANUP Remove "Estilo de ícones" Flat/Emoji toggle — Flat = padrão definitivo. Icon.jsx simplificado (sem `STYLE_KEY/emojiFor/CircleEllipsis`)
- ✅ **#247** P2 UX TreatmentForm redesign — hero sunset top + steps numerados (1-4) + PatientPicker usa PatientAvatar real + mode tabs sunset active + duration unit sunset + preview muted card
- ✅ **#248** P2 UX Reports redesign — period preset chips 7/10/30/365/Definir + patient chips PatientAvatar + hero gauge sunset + distribuição stacked bar + top meds ranking
- ✅ **#249** P2 UX Analytics redesign — gauge ring + trend badge + insight cards + atenção clínica corticoide/opioide/AINE keyword matching + horário difícil bar + adesão por paciente
- ✅ **#251** P1 BUG GATING SharePatientSheet Plus bloqueado erroneamente — local `isPro = tier === 'pro' || 'admin'` excluía plus. Fix usa `useIsPro()` hook centralizado (PRO_FEATURE_TIERS plus+pro+admin). Plus tem TODAS features Pro (memory `project_plus_vs_pro`).
- 🆕 **#250** P3 FEATURE [NOVO — DEFERIDO v0.2.3.6] **API medicamentos ANVISA + disclaimers clínicos.** User pediu autocomplete med name via API + info crítica (tarja, dose máx referência) pra disclaimers SOS + cadastro. Plano: ETL ANVISA Open Data CSV → tabela `medications_catalog` Supabase + edge function `/search-meds` + tabela `medication_warnings` (princípio_ativo, severity, label, fonte). Top 100 meds curados manual com WHO ATC class. Risk Play Console: NÃO calcular dose pediátrica auto, só MOSTRAR referência ANVISA/WHO + disclaimer "consulte médico". Esforço estimado 12-16h (ETL 4h + schema/edge 4h + curadoria warnings top 100 8h). Ver CHECKLIST #250 detalhado.

Esforço v0.2.3.5: ~6h aplicado. Validação web Chrome MCP localhost iterativa user-driven.

**Sentry triage 2026-05-14 — backlog limpo de 15 → 3 issues abertas:**
- ✅ **Resolved (7):** 6 issues postgres_changes callbacks (80 events bulk) já fechado por #157 disable Realtime — bundles antigos cacheados em users vão dropar naturalmente. + DOSY-K W.weight.replace TypeError — fix `String(weight).replace(...)` já aplicado release 0.2.0.0+, issue de bundle stale.
- ✅ **Archived (5):** DOSY-S/R ANR syscall Vsync (generic Android Choreographer, no actionable stack, Processing Error symbolication), DOSY-Q NullPointerException Capacitor Keyboard plugin (library bug upstream), DOSY-N RemoteServiceException broadcast (Android 12 system-level release 0.2.0.3 antigo), DOSY-P auth-token lock stolen (supabase-js NavigatorLock multi-tab — biblioteca noise, não bug).
- ⏳ **Open (3 — todas no scope v0.2.3.3):** DOSY-M ANR MainActivity.onCreate (#232 — fix code applied, auto-resolve no release ship), DOSY-7 Segfault `<unknown>` (#110 — needs #074 NDK symbols), DOSY-3 art::ArtMethod::Invoke IllegalInstruction (#110 — needs #074 NDK symbols).

**Pós-ship sessão validação emulator autônoma 2026-05-14 ~18:10 UTC (Pixel8_Test AVD criado via avdmanager CLI):**
- ✅ Setup completo CLI autônomo: AVD criado, emulator boot, APK debug install, login UI via ADB input + uiautomator dump
- ✅ #227 audit log RLS — runtime validado 6 sources populando (js_scheduler 4 rows pós-login + edge_trigger_handler:fcm_sent + java_fcm_received batch_start/scheduled/batch_end pós dose insert)
- ✅ #228 push_subscriptions device_id_uuid — 2 rows android coexistem (vc 65 install 18:05 + vc 64 prévio 14:17), unsubscribeFcm filter funcionando
- ✅ Dose flow end-to-end: SQL INSERT dose +3min → statement-level trigger → Edge v21 fcm_sent → DosyMessagingService receive → AlarmScheduler scheduleDoseAlarm → alarm fired @ 18:13 (user confirmou)
- 🐛 **#231 NOVO P2 BUG** layout — banner AdMob com gap peach vazio ~40px entre status bar e banner em Pixel 8 emulator Android 15. Confirmado via comparação direta: Pixel 9 Pro emulator Android 17 sdk_gphone16k renderiza correto (banner colado abaixo status bar). Root cause provável: `env(safe-area-inset-top)` duplicado Android 15 WebView vs 17 handling. Não reproduz device físico real. Esforço 2-4h DOM + AdMob plugin config.

CLI gradlew + Appium-style ADB UiAutomator2 fluxo COMPROVADO 100% autônomo end-to-end. Próximas validações podem rodar sem intervenção GUI.

**Refactor v0.2.3.1 — 4 auditorias + 7 blocos implementação (2026-05-13):**

- `context/auditoria/2026-05-13-alarme-push-auditoria.md` (auditoria 1, 563 linhas — bugs B-01 a B-15)
- `context/auditoria/2026-05-13-alarme-push-auditoria-FUNDO.md` (auditoria 2 — 4 root causes arquiteturais RC-1 a RC-4)
- `context/auditoria/2026-05-13-alarme-push-codigo-morto.md` (auditoria 3 — 23 itens código morto)
- `context/auditoria/2026-05-13-alarme-push-releitura-linha-por-linha.md` (auditoria 4 — 5 achados A-XX + 3 B-XX)
- `context/auditoria/2026-05-13-alarme-push-FINAL-fluxo-e-refactor.md` (consolidado + plano 7 blocos)
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

## 4. Fluxo macro (processo de release)

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

> Last accurate count: v0.2.3.9 (159 ✅ / 79 ⏳ / 0 🚨 / 3 🚫). Recount via grep:
> ```bash
> grep -cE "^- ✅" context/ROADMAP.md   # closed
> grep -cE "^- ⏳" context/ROADMAP.md   # open
> ```

**Open P0 críticos pré-launch (referência):** #006 device validation · #131 recrutamento Reddit · #132 gate 14d · #133 Production access · #191 #192 RevenueCat

### 6.3 Δ Release log (cronológico)

**Δ 2026-05-15 release/v0.2.3.7 (perf bundle low-risk pós auditoria device slow):** bump vc 69→70, vn 0.2.3.6→0.2.3.7. **Origem:** user reportou app lento no device pós últimas releases — toda ação (marcar dose swipe, click NAV BottomNav) "agarra". **Investigação documentada:** [`contexto/auditoria/2026-05-15-perf-audit-device-slow.md`](auditoria/2026-05-15-perf-audit-device-slow.md). **Root cause identificado:** 3 regressões cascateadas amplificam custo por interação — (1) v0.2.3.1 Bloco 7 A-04 expansão janela App.jsx -1d/+14d → -30d/+60d ("unificar com Dashboard" obsoletizado por #163), (2) v0.2.3.4 #163 RPC consolidado criou namespace duplo `['dashboard-payload']` com mesmas doses, (3) v0.2.3.5 #239 patch dose agora opera nos 2 namespaces + invalida ambos a cada mark/skip/undo. Cache cresceu ~6×, persist IDB serializa 3-5MB a cada interação. **Bundle escolhido (low-risk):**
- **#272 P1 F1** — App.jsx alarmWindow -30d/+60d → -1d/+14d (reverter A-04 da v0.2.3.1 — motivo original "compartilhar cache com Dashboard" obsoletizado quando Dashboard migrou pra useDashboardPayload em #163). Esperado -85% cache size.
- **#273 P1 F3** — useDashboardPayload placeholderData via ref module-scope cacheando último payload bem-sucedido — mantém proteção #267 (skeleton on hour boundary) sem custo findAll O(N) por render.
- **#274 P1 F6** — `React.memo` em BottomNav + AppHeader — eliminam re-render por navegação. Verificar props estáveis antes.
- **#275 P2 F5** — persister throttleTime 1000ms → 5000ms — fila offline #204 protege contra crash perda. Reduz frequência serialize IDB.

**HOLD:** #276 F4 (invalidate dashboard-payload — risco siblings BATCH_UPDATE), #277 F2 (eliminar duplo namespace — release dedicada, 3 caminhos a decidir), #278 F7 (hash incremental dosesSignature — toca proteção crítica #212 anti-storm).

**Auditoria detalhada com plano por fix:** seções 8-11 do doc — cada fix tem ANTES/DEPOIS de código, commit origem investigado, bug original protegido, justificativa de regressão segura, validação obrigatória.

**Counter:** 146 fechados / 80 abertos (+ #272-#275 abertos + #276-#278 HOLD).

**Δ 2026-05-17 release/v0.2.3.9 (perf bundle complete — round-2 device slow):** bump vc 71→72, vn 0.2.3.8→0.2.3.9. **Origem:** user reportou v0.2.3.7 instalada device físico AINDA extremamente lenta — bundle F1+F3+F6+F5 anterior não foi suficiente. 3 agents paralelos auditaram cache + render + hooks. **7 itens fechados** (#288-#294):
- **#288** P1 — useCallback DoseCard handlers + DoseCard.jsx onClick agora passa `dose` (substitui closure inline). Preserva React.memo do DoseCard.
- **#289** P2 — Dupla subscription resolvida via cascata do P4 (useDashboardPayload deixou de escrever ['doses', filter] → App.jsx useDoses não sofre cross-update).
- **#290** P3 — pathnameRef em App.jsx pra closures de listeners FCM/back button; deps cleanup remove `location.pathname` (listeners registram 1× só).
- **#291 / #277 F2** — Dual namespace cache eliminado. `patchDoseInCache` + `refetchDoses` operam só em `['dashboard-payload']`. `useDashboardPayload` deixou de escrever ['doses', filter]. **−50% patch cost, −50% IDB serialização estimado.**
- **#292** P5 — `motion.div` per dose substituído por `<div>` plain. 90+ motion components com stagger eram custo de ~5s reflow contínuo. Mantém stagger por paciente (motion.section).
- **#293 / #278 F7** — `dosesSignature` migrado map+sort+join O(N log N) → FNV-1a hash linear O(N). Mantém detecção mudança real (id/status/scheduledAt).
- **#294** P7 — `toggleCollapse` Dashboard envolto em useCallback (ref estável).

**Auditoria egress + storm:** P4 reduz egress (1 RPC ao invés de 2 por mutação). Demais zero impact egress. Storm risk zero (idempotência AlarmScheduler #282 preservada, signature #212 mantida via hash linear).

**Combined estimado:** 2-3× speedup Dashboard re-render no S25 Ultra (medição empírica pendente device físico).

**Counter:** 159 fechados / 79 abertos (release v0.2.3.9 fecha 7 itens: #288-#294, mais 2 HOLDs fechados como cascata #277 F2 + #278 F7).

**Δ 2026-05-17 release/v0.2.3.8 (P0 killed caregiver alarm gap):** bump vc 70→71, vn 0.2.3.7→0.2.3.8. **Origem:** user reportou device físico ainda recebe push silenciosa, alarme com som não dispara no cuidador. Root cause: Firebase Android SDK quando recebe FCM com `notification` block + app KILLED, renderiza tray sozinho + NÃO chama `onMessageReceived` → AlarmScheduler.scheduleDoseAlarm NUNCA executava no cuidador → AlarmManager vazio → alarme nativo nunca disparava. **Fix arquitetural #287** (4 mudanças coordenadas):
- Edge `dose-trigger-handler` v25 — REMOVE notification block. Envia data-only HIGH pra TODOS (owner+caregiver). SDK obrigado a acordar app + chamar onMessageReceived.
- Edge `dose-fire-time-notifier` v7 — REMOVE notification block. Envia data-only HIGH com `kind=fire_now_alarm`. Cron 1×/min cobre janela [NOW-90s, NOW+30s].
- Java `DosyMessagingService.handleFireNowAlarm` — novo branch. Parseia data fields + `startForegroundService(AlarmService)` IMEDIATO. AlarmService FG som loop + AlarmActivity lockscreen disparam.
- Bump vc 70→71, vn 0.2.3.7→0.2.3.8.

**QA emulador 3/3 PASS:** S1 Owner sem share alarme nativo, S2 Owner+Caregiver background recebe schedule_alarms + alarme fired, S3 Caregiver background recebe fire_now_alarm + AlarmService FG dispatched IMEDIATO.

**Limites aceitos (documentados):** force-stop via Settings = nada cobre (limite Android 12+ universal). Onboarding deve educar user.

**AAB vc 71 published Play Console Internal Testing** 2026-05-17 14:32 BRT via Chrome MCP. Tag `v0.2.3.8` em `9bf1436` (master HEAD). Vercel auto-deploy prod dosymed.app v0.2.3.8 confirmado. Commits `981fab4` + `ed180cc`.

**Δ 2026-05-16/17 release/v0.2.3.7 (server-side caregiver flow + idempotência + RPC ownerId + QA exaustivo):** mid-release +6 itens server/native fechados:
- **#279** P1 — Edge `dose-trigger-handler` v24 caregiver `notification` payload bypass Doze + `daily-alarm-sync` v5 inclui patient_shares
- **#280** P1 — Edge `patient-share-handler` v4 + DB trigger ON `patient_shares` INSERT → FCM push share notification
- **#281** P1 — Edge `dose-fire-time-notifier` v6 + pg_cron 1min + `doses.fire_notified_at` index parcial idempotência → cuidador app killed recebe fire-time tray
- **#282** P1 — `AlarmScheduler` idempotente (skip se triggerAt+dosesHash iguais) + `DoseSyncWorker` período 6h → 24h `REPLACE` policy backup Samsung Doze
- **#283** P1 — RPCs `create_treatment_with_doses` + `register_sos_dose` derivam userId de `patient.userId` em vez de `auth.uid()` (cuidador criando dose pra paciente compartilhado agora gera `dose.userId=owner real` → Edge dispatch FCM corretamente cross-owner)
- **#284** DOCS — QA exaustivo re-validação 21/21 OK ([QA_REPORT_v0_2_3_7_full_rerun.md](archive/qa/QA_REPORT_v0_2_3_7_full_rerun.md)) + scripts Appium reutilizáveis em `scripts/qa_*.mjs`

**Counter:** 152 fechados / 80 abertos (release v0.2.3.7 fecha 10 itens: #272-#275 + #279-#284).

**Δ 2026-05-15 release/v0.2.3.6 SHIPPED (Play Console Internal Testing 2026-05-15):** bump vc 68→69, vn 0.2.3.5→0.2.3.6. **11 itens fechados:** #250 P3 ANVISA autocomplete medicamentos (764 rows ETL + RPC unaccent + MedNameInput 3-fontes) + 9 bug-fixes P1/P2 (#253b email wordmark, #254b self-patient signup, #255 idle skeleton token expirado, #256b SOS submit window.confirm Capacitor, #257b lockAcquireTimeout, #258b sharing Dashboard RPC, #264 dose passada create_treatment, #265 count exato, #266 PatientDetail insertEntityIntoLists, #267 Dashboard skeleton hour boundary). QA completo Chrome MCP localhost teste-plus@. **5 P2-P4 abertos próxima release:** #259 (Reports Cancelada), #260 (console errors `[object Object]`), #261 (SOS horário en-US format), #262 (Ad acima header), #263 (1 dias termina hoje). Tag `v0.2.3.6` commit `348eff7` merge master. AAB vc 69 publicado.

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

**Δ 2026-05-13 docs/auditoria-alarme-push (auditoria 2026-05-13):** +12 NOVOS items descobertos via auditoria ponta-a-ponta sistema Alarme + Push (`context/auditoria/2026-05-13-alarme-push-auditoria.md`). Varredura completa: 11 arquivos Java native (CriticalAlarm plugin), JS services/notifications/* + criticalAlarm + mutationRegistry + hooks core, 6 Edge Functions (5 locais + daily-alarm-sync deployed-only via MCP), 22 migrations DB confirmadas via Supabase MCP, AndroidManifest + capacitor.config + build.gradle + public/sw.js. **#215** 🔄 P0 TURNAROUND refactor scheduler unificado + push backup co-agendado (cobre B-01 DnD zone silêncio + B-02 criticalAlarm-off silêncio + B-09 horizon desalinhado). **#216-#221** 🐛 P1 BUGS: Edge `notify-doses` referencia tabela DROPADA + drift repo↔prod Edge daily-alarm-sync + drift 15 migrations locais + Edges órfãs expostas + hash JS↔Java mismatch + cancel_alarms sem caller. **#222 #225** ✨ P2 MELHORIAS: consolidar 3 channels Android + cleanup ~150 linhas código morto AlarmActivity + FCM payload chunking 4KB. **#224** 🐛 P2 BUG: BootReceiver perde alarmes <1h margem. **#223 #226** ✨ P3 MELHORIAS: deletar usePushNotifications deprecated + padronizar device_id UUID cross-source. **Análise egress + storm risk:** todas correções zero/baixo impacto egress (LocalNotification local, FCM chunking idempotente, hash alinhamento gera 1 storm transitória ~5s durante migration). Counter: 142 fechados / 82 abertos.

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

- ✅ **#003** Senha postgres rotacionada + PAT revogado + INFOS.md cleanup (2026-05-04)
- ✅ **#004** Vídeo demo FOREGROUND_SERVICE_SPECIAL_USE YouTube unlisted + Console FGS form (2026-05-04)
- ⏳ **#006** 🔴 Device validation FASE 17 em 3 devices físicos (manual user)
- ✅ **#007** Telemetria PostHog notification_delivered/tapped/dismissed (v0.2.1.0)
- ✅ **#008** GitHub Secrets Sentry configurados Actions (2026-05-04)
- ✅ **#009** PITR DEFERRED + DR drill alternativo via daily backup (v0.2.0.11)
- ✅ **#025** Screenshots phone + ícone + feature graphic Console Listagem (2026-05-04)
- ✅ **#084** Migração Supabase legacy JWT → sb_publishable_/sb_secret_ + revoke HS256 (v0.1.7.5)
- ✅ **#126** Pre-commit gitleaks 8.30.1 + GitHub Action (v0.2.0.5)
- ✅ **#129** Google Group `dosy-testers@googlegroups.com` criado (v0.2.1.0)
- ✅ **#130** Closed Testing track "Alpha" APROVADO Google + ATIVO (2026-05-06)
- ⏳ **#131** 🔴 Recrutar 15-20 testers externos via Reddit/Twitter/LinkedIn — meta 12+ ativos
- ⏳ **#132** 🔴 Gate 14 dias com ≥12 testers ativos *(bloqueado por #131)*
- ⏳ **#133** 🔴 Solicitar Production access Console pós-gate *(bloqueado por #132)*
- ✅ **#142** Legacy JWT secret REVOKED + Edge functions via SERVICE_ROLE_KEY (v0.2.0.9)
- ✅ **#154** Custom SMTP Resend dosymed.app + DKIM/SPF/DMARC (v0.2.0.12)
- ✅ **#156** Página /privacidade v1.3 LGPD + Google Play Health Apps Policy (v0.2.1.0)
- ✅ **#158** Resolveu rejection Google Play Política org account (v0.2.1.2)
- ✅ **#204** Mutation queue offline (React Query nativa) Fase 1 offline-first (v0.2.1.7+v0.2.1.8)
- ✅ **#205** Single source refresh token (storm xx:00 fix) (v0.2.1.8)
- ✅ **#207** Defesa em profundidade alarme crítico 5 fixes (v0.2.1.7+v0.2.1.8)
- ✅ **#209** Refactor sistema alarmes + push + cron diário daily-alarm-sync (v0.2.1.9)

#### 🟠 P1 — Alta

- ✅ **#018** AdMob Android prod flag flip + banner real ads (v0.2.1.3)
- ⏳ **#021** 🟠 Backup keystore 3 locais seguros
- ✅ **#024** Pre-commit hooks gitleaks + lint-staged + Husky 9 (v0.2.0.5)
- ✅ **#026** Emails @dosymed.app via ImprovMX free + 7 aliases (v0.2.1.0)
- 🚫 **#027** Closed Testing + 12 testers via amigos — superseded por #129-#133
- ✅ **#127** CI lint fix AnimatedRoutes.jsx libera Sentry source maps (v0.2.0.8)
- ⏳ **#169** 🟠 ASO Play Store completo — keywords + listing copy + screenshots + A/B test
- 🚧 **#170** 🟠 Reviews Play Store In-App Review API + reply playbook *(código merged v0.2.1.3, validação device pendente)*
- ⏳ **#171** 🟠 Marketing orgânico playbook BR — Reddit + Instagram + LinkedIn + TikTok
- ⏳ **#173** 🟠 Healthcare differentiators moat — promover #064 + #065 + #066 P3→P1
- ⏳ **#174** 🟠 OCR camera medication scan — auto-cadastro via foto caixa (ML Kit)
- ⏳ **#175** 🟠 Receita médica scan OCR auto-import — único concorrente BR
- ⏳ **#176** 🟠 Adesão report PDF/email pra médico 30/60/90 dias
- ⏳ **#177** 🟠 WhatsApp share dose status — cuidador remoto via deep link
- ⏳ **#188** 🟠 Mini IA Chat NLP cadastro tratamento (KILLER feature mundial via Claude Haiku)

#### 🟡 P2 — Média

- ✅ **#046** Runbook DR docs/runbook-dr.md v1.0 (v0.2.1.0)
- ✅ **#074** Upload debug symbols NDK FULL — Sentry NDK stack traces (v0.2.0.2)
- ⏳ **#047** 🟡 Google Play Integrity API
- ⏳ **#155** 🟡 Adicionar 2 screenshots Console pós-v0.2.0.12 (#152 + #153)
- ⏳ **#172** 🟡 Landing page dosymed.app marketing + blog SEO healthcare BR

---

### 6.5 ✨ MELHORIAS — Incrementais

#### 🔴 P0 — Bloqueadores (egress + critical perf)

- ✅ **#079** Realtime heartbeat keep-alive + reconnect (v0.1.7.1)
- ✅ **#080** Edge notify-doses retry exponential FCM + idempotência (v0.1.7.1)
- ✅ **#081** WorkManager DoseSyncWorker periódico 6h defense-in-depth (v0.1.7.1)
- ✅ **#083** FCM-driven alarm scheduling + 4 caminhos coordenados (v0.1.7.2)
- ✅ **#115** Photo cache versioned `photo_version` SMALLINT + hook usePatientPhoto (v0.2.0.2)
- ✅ **#134** useAppResume short idle: removido invalidate cascade -30% a -45% egress (v0.2.0.8)
- ✅ **#135** useRealtime resume nativo: removido invalidate ALL keys (v0.2.0.8)
- ✅ **#136** useRealtime postgres_changes debounce 1s invalidate por queryKey (v0.2.0.8)
- ✅ **#137** Dashboard 4 useDoses paralelas → 1 query base + filtros memo (v0.2.0.9)
- ✅ **#138** DOSE_COLS_LIST sem observation + lazy-load DoseModal (v0.2.0.9)
- ✅ **#148** Dashboard extend_continuous_treatments rpc 2× fix + debounce 60s (v0.2.0.11)
- ✅ **#149** useDoses mutation refetch storm 12 fetches/200s → debounce 2s (v0.2.0.11)
- ✅ **#150** useDoses refetchInterval 5min → 15min -67% polling (v0.2.0.11)
- ✅ **#151** useDoses refetchInterval opt-in só Dashboard -80% adicional idle (v0.2.0.11)
- ✅ **#157** Disable useRealtime() App.jsx fix storm 12 req/s sustained idle (v0.2.1.0)

#### 🟠 P1 — Alta

- ⏳ **#163** 🟠 RPC consolidado Dashboard `get_dashboard_payload` — -40% a -60% Dashboard egress
- 🚫 **#164** Realtime broadcast — PARKED ROI baixo 2026-05-14 (FCM cobre 95% use cases)
- ⏳ **#165** 🟠 Delta sync doses + TanStack persist IndexedDB offline-first — -70% a -90% reads
- ✅ **#010** ic_stat_dosy notification icon vector drawable (v0.2.0.6)
- ✅ **#011** `<label>` em inputs Login TalkBack (v0.1.7.4)
- ✅ **#012** RLS policies recriadas TO authenticated (48 policies finais, v0.1.7.4)
- ✅ **#013** Split policies cmd=ALL em 4 (v0.1.7.4)
- ✅ **#014** RPC extend_continuous_treatments recriada + reativada (v0.1.7.4)
- ✅ **#015** PostHog key + dashboards launch (v0.1.7.4)
- ✅ **#016** Sentry alerts crash spike >10/h (v0.1.7.4)
- ✅ **#017** LockScreen UI + biometria useAppLock (v0.2.0.6)
- ✅ **#019** minimum_password_length 6→8 + complexity (v0.1.7.4)
- ✅ **#020** Disclaimer médico visível signup (v0.1.7.4)
- ✅ **#022** typescript@^6.0.3 legítimo confirmado (v0.1.7.4)
- ✅ **#023** useDoses refetchIntervalInBackground:false + staleTime:2min (v0.2.0.4)
- ✅ **#036** Skeleton screens TreatmentList + Analytics (v0.2.1.0)
- ✅ **#075** RQ global staleTime 30s + refetchOnMount:true (v0.1.7.0)
- ✅ **#076** useAppResume soft recover preserva URL (v0.1.7.0)
- ✅ **#077** TOKEN_REFRESHED listener useRealtime (v0.1.7.0)
- ✅ **#078** SW cache version v5→v6 (v0.1.7.0)
- ✅ **#082** Dual-app dev/prod com.dosyapp.dosy.dev Dosy Dev (v0.1.7.1)
- ✅ **#102** Atalho hardware silenciar alarme KEYCODE_VOLUME (v0.2.0.1)
- ✅ **#114** Avatar foto crop manual UI react-easy-crop 512×512 (v0.2.0.2)
- ✅ **#116** Header alertas sino dropdown → ícones diretos com badges (v0.2.0.3)
- ✅ **#118-followup** Pill amarelo abre EndingSoonSheet (v0.2.0.3)
- ✅ **#119** Promo free→plus removida do client (v0.2.0.3)
- ✅ **#119-followup** Server-side trigger drop signup_plus_promo (v0.2.0.4)
- ✅ **#139** dose-trigger-handler skip scheduledAt >6h -50% a -70% invocations (v0.2.0.10)
- ✅ **#140** schedule-alarms-fcm HORIZON 72h → 24h payload 3× menor (v0.2.0.10)
- ✅ **#141** useReceivedShares staleTime 60s → 5min -80% calls (v0.2.0.10)
- ✅ **#152** ChangePasswordModal Ajustes (v0.2.0.12)
- ✅ **#153** Recovery senha OTP 6 dígitos substitui magic-link (v0.2.0.12)
- ✅ **#160** PatientDetail refactor v1+v2+v2.1 (v0.2.1.2)
- ✅ **#161** Alerts dismiss refinement ending date-based (v0.2.1.2)

#### 🟡 P2 — Média

- ✅ **#028** Rate limit delete-account Edge fn (v0.2.0.4)
- ✅ **#029** Refactor Settings.jsx 692 LOC → src/pages/Settings/ (v0.2.0.11)
- ✅ **#030** Refactor services/notifications.js 613 LOC → src/services/notifications/ (v0.2.0.11)
- ✅ **#031** FORCE_RLS confirmed em 13/13 tabelas (v0.2.0.4)
- ✅ **#032** SET search_path em SECURITY DEFINER funcs (v0.2.0.4)
- ✅ **#033** React.memo em DoseCard (v0.2.0.3)
- ✅ **#034** Virtualização DoseHistory via @tanstack/react-virtual (v0.2.0.11)
- ⏳ **#035** 🟡 Integration tests useDoses/useUserPrefs mocks *(diferido v0.2.2.0+)*
- ✅ **#037** Erros inline em forms PatientForm + TreatmentForm (v0.2.0.4)
- ⏳ **#038** 🟡 Pen test interno (curl JWT, Burp/mitmproxy, Play Integrity tampering) *(diferido v0.2.2.0+)*
- ⏳ **#039** 🟡 Confirmação dupla delete batch *(bloqueado: pré-req batch select UI)*
- ✅ **#040** Subir contraste textos secundários dark mode (v0.2.0.3)
- ✅ **#041 partial** Hierarquia headings auditada partial (v0.2.1.0)
- ⏳ **#042** 🟡 Lighthouse mobile ≥90 Reports + Dashboard *(diferido v0.2.2.0+)*
- ⏳ **#043** 🟡 Performance scroll lista 200+ doses sem jank
- ✅ **#044** Audit RPC register_sos_dose SECURITY DEFINER (v0.2.0.4)
- ✅ **#045** coverage/ no .gitignore confirmed (v0.2.0.2)
- ✅ **#048** tools/supabase.exe NÃO tracked (v0.2.0.4)
- ⏳ **#049** 🟡 Pen test profissional
- ✅ **#100** Avatar emoji redesign 6 categorias (parcial v0.2.0.11)
- ✅ **#117** Alerta header paciente compartilhado patient_share (v0.2.0.3)
- ✅ **#118** Alerta header tratamento acabando ≤3 dias (v0.2.0.3)
- ✅ **#120** SharePatientSheet copy condicional tier real (v0.2.0.3)
- ✅ **#121** PaywallModal Escape close em Sheet+Modal primitives (v0.2.0.3)
- ✅ **#143** useUserPrefs getSession() vs getUser() -100% calls /auth/v1/user (v0.2.0.10)
- ✅ **#144** Custom JWT claim tier via Auth Hook -100% rpc('my_tier') (v0.2.0.12)
- ✅ **#145** useRealtime watchdog scoped refetchQueries active (v0.2.0.11)
- ✅ **#146** pg_cron extend_continuous_treatments audit log + view (v0.2.0.11)
- ⏳ **#166** 🟡 MessagePack Edge functions payload + compression — 50-70% menor
- ⏳ **#167** 🟡 Cursor pagination + DOSE_COLS aggressive + Supavisor transaction mode
- ⏳ **#168** 🟡 CDN cache strategy Vercel + Supabase Storage headers — aproveitar Cached Egress 250 GB
- ⏳ **#178** 🟡 Modo Alzheimer escalada — alarme intensifica + SMS/WhatsApp cuidador
- ⏳ **#179** 🟡 Wear OS / Galaxy Watch support — alarme pulso
- ⏳ **#180** 🟡 Health metrics tracking — PA/glicemia/peso/temperatura schema + trend chart
- ⏳ **#181** 🟡 Voz/TTS prompts + comando voz acessibilidade idosos
- ⏳ **#183** 🟡 Refill affiliate links Drogasil/Drogaria SP/Pague Menos (combinado #065)
- ✅ **#222** Consolidar channels Android 3→2 + cleanup AlarmActivity ~150 linhas mortas (v0.2.3.0)
- ✅ **#225** FCM payload daily-alarm-sync chunking 30 doses/message 4KB (v0.2.3.0)
- ✅ **#288** useCallback DoseCard handlers + onClick passa dose (v0.2.3.9)
- ✅ **#289** Dupla subscription resolved via cascata P4 (v0.2.3.9)
- ✅ **#290** pathnameRef App.jsx closures FCM/back button listeners (v0.2.3.9)
- ✅ **#291** Dual namespace `['doses']` eliminado — patchDoseInCache só dashboard-payload (v0.2.3.9)
- ✅ **#292** motion.div→div plain 90+ Dashboard, mantém stagger por paciente (v0.2.3.9)
- ✅ **#293** dosesSignature FNV-1a hash O(N) linear (v0.2.3.9)
- ✅ **#294** toggleCollapse Dashboard envolto em useCallback (v0.2.3.9)

#### 🟢 P3 — Baixa (90 dias / backlog)

- ⏳ **#050** 🟢 Audit_log abrangente UPDATE/DELETE triggers
- ⏳ **#051** 🟢 2FA opcional via TOTP
- ⏳ **#052** 🟢 Criptografia client-side de observation
- ⏳ **#053** 🟢 Logout remoto multi-device + tela Dispositivos conectados
- ⏳ **#054** 🟢 Notif email/push ao login em device novo
- ⏳ **#055** 🟢 Session replay *(opcional, privacy review)*
- ⏳ **#056** 🟢 Visual regression tests Chromatic/Percy
- ⏳ **#057** 🟢 Performance budget em CI
- ⏳ **#058** 🟢 TypeScript migration ou JSDoc + tsc --checkJs
- ⏳ **#059** 🟢 dosy_alarm.mp3 custom sound
- ⏳ **#060** 🟢 Detecção root/jailbreak
- ⏳ **#061** 🟢 Drag-sort de pacientes
- ⏳ **#062** 🟢 Anexar comprovantes/imagens (PRO)
- ⏳ **#063** 🟢 Avaliar remoção mockStore.js
- ⏳ **#064** 🟢 Verificação interações medicamentosas + alergia *(promovido P1 via #173)*
- ⏳ **#065** 🟢 Estoque + alerta "está acabando" *(promovido P1 via #173)*
- ⏳ **#066** 🟢 Lembrete de consulta médica + Calendar .ics export *(promovido P1 via #173)*
- ⏳ **#067** 🟢 DosyMonitorService Xiaomi/OPPO/Huawei
- ⏳ **#068** 🟢 iOS via Capacitor *(user confirmou NÃO promove pré-Android tração)*
- ⏳ **#069** 🟢 Internacionalização (en, es)
- ⏳ **#070** 🟢 Plano Family (até 5 usuários)
- ⏳ **#071** 🟢 Programa afiliados
- ⏳ **#072** 🟢 A/B test paywall e onboarding
- ⏳ **#073** 🟢 Programa de indicação (1 mês PRO grátis)
- ⏳ **#182** 🟢 Symptom diary + mood tracking antes/depois dose
- ⏳ **#184** 🟢 Telemedicina integration — Doctoralia/Conexa Saúde/Memed
- ⏳ **#185** 🟢 Cuidador profissional B2B mode — 1 cuidador 5+ residências
- ⏳ **#186** 🟢 Apple Health / Google Fit / Samsung Health bidirectional sync
- ⏳ **#187** 🟢 Receita digital prescription import — Memed/Nexodata
- ✅ **#122** AppHeader greeting shortName cobre Teste Free/Plus/Pro (v0.2.0.3)
- ✅ **#223** Deletar usePushNotifications.js deprecated re-export (v0.2.3.0)
- ✅ **#226** Padronizar device_id UUID cross-source em alarm_audit_log (v0.2.3.0)

---

### 6.6 🐛 BUGS — Correções

#### 🔴 P0 — Bloqueadores

- ✅ **#001** Admin auth check em send-test-push Edge Function (v0.1.6.10)
- ✅ **#002** Sanitizar erro email enumeration (v0.1.6.10)
- ✅ **#005** Encoding UTF-8 quebrado em nome paciente (v0.1.6.10)
- ✅ **#091** BUG-024 pg_cron extends contínuos TZ UTC errado firstDoseTime (v0.1.7.4)
- ✅ **#092** BUG-025 Egress reduction Supabase multi-frente (v0.1.7.5)
- ✅ **#094** BUG-027 Paywall falso users plus/pro durante mount race (v0.1.7.5)
- ✅ **#101** Auditoria egress pós-#092 pg_stat_statements (v0.2.0.1)
- ✅ **#106** BUG-034 Ícone launcher + splash fix completo (v0.2.0.3)
- 🚫 **#106-old** BUG-034 partial — superseded por #106 full fix v0.2.0.3
- ✅ **#107** BUG-035 TypeError schema().rpc().catch Dashboard pull-to-refresh (v0.2.0.0+)
- ✅ **#109** BUG-037 useRealtime concurrent subscribe race (v0.2.0.1)
- ✅ **#159** BUG-LOGOUT useAuth boot validation transient vs real auth failure (v0.2.1.1)

#### 🟠 P1 — Alta

- ✅ **#085** BUG-018 Alarme Crítico OFF respeitado em 6 caminhos (v0.1.7.3)
- ✅ **#086** BUG-019 Resumo Diário UI ocultada parqueado v0.1.8.0 (v0.1.7.3)
- ✅ **#087** BUG-020 DND UX condicional + Edges respeitam DND (v0.1.7.3)
- ✅ **#088** BUG-021 Dose cadastrada não aparece em Início sem refresh (v0.1.7.4)
- ✅ **#090** BUG-023 Pós-login redireciona pra Ajustes (v0.1.7.4)
- ✅ **#093** BUG-026 Race condition useRealtime postgres_changes callbacks (v0.1.7.5)
- ✅ **#095** /Ajustes mostra versão real via Capacitor.App.getInfo (v0.1.7.5)
- ✅ **#096** BUG-028 Admin panel tier inconsistente (v0.2.0.1)
- ✅ **#099** BUG-031 Avatar paciente upload + crop circular (v0.2.0.1)
- ✅ **#103** BUG-032 UpdateBanner URL dosy-teal.vercel.app fix runtime (v0.2.0.1)
- ✅ **#104** Skeleton legacy slate → Dosy peach palette (v0.2.0.1)
- ✅ **#105** BUG-033 MultiDoseModal Dosy primitives (v0.2.0.1)
- ✅ **#108** BUG-036 PatientForm weight.replace TypeError (v0.2.0.1)
- ✅ **#125** BUG-039 Splash distorcido S25 Ultra Android 12+ (v0.2.0.4)
- ✅ **#128** BUG-040 Edge functions populam patientName FCM payload (v0.2.0.9)
- 🚫 **#147** BUG-041 Recuperação senha — superseded por #152+#153 v0.2.0.12
- ✅ **#216** Edge notify-doses referência tabela DROPADA — stub 410 Gone (v0.2.3.0)
- ✅ **#217** Drift repo↔prod Edge daily-alarm-sync source commitado local (v0.2.3.0)
- ✅ **#218** Drift 15 migrations locais restauradas paridade local↔remote (v0.2.3.0)
- ✅ **#219** Edges órfãs notify-doses + schedule-alarms-fcm stubs deprecated (v0.2.3.0)
- ✅ **#220** Hash AlarmScheduler.idFromString Java aplica % 2147483647 (v0.2.3.0)
- ✅ **#221** cancel_alarms FCM action implementada dose-trigger-handler v18 (v0.2.3.0)
- ✅ **#227** alarm_audit_log 6 sources populando — RLS policies fix (v0.2.3.2)
- ✅ **#228** unsubscribeFcm cross-device contamination fix device_id_uuid filter (v0.2.3.2)
- ✅ **#229** A-03 Fix snooze persist em reboot apply()→commit() sync (v0.2.3.2)
- ✅ **#230** Fix C hash reconstruction Edge BATCH_UPDATE group siblings (v0.2.3.2)
- ✅ **#232** Sentry DOSY-M ANR MainActivity.onCreate WorkManager+cleanupChannels off-main-thread (v0.2.3.3)
- ✅ **#233** 401 race tokens Java Worker EXP_SAFETY_MARGIN 60s→300s clock skew (v0.2.3.3)
- 🚫 **#234** Cache-Control headers — SUPERSEDED por #165 v0.2.3.3
- ⏳ **#235** 🟠 Ads extras Free tier — bottom banner/Native inline *(deferido v0.2.3.5+)*
- ✅ **#236** UpdateBanner versionName reorder fallback Play Core → local map → Vercel (v0.2.3.4)
- ✅ **#237** Dashboard skeleton infinito pós-resume — placeholderData + retry 5 (v0.2.3.4)
- ✅ **#272** App.jsx alarmWindow -30d/+60d → -1d/+14d -85% cache size IDB (v0.2.3.7)
- ✅ **#273** useDashboardPayload placeholderData via ref module-scope (v0.2.3.7)
- ✅ **#274** React.memo em BottomNav + AppHeader elimina re-renders (v0.2.3.7)
- ✅ **#275** Persister throttleTime 1000ms → 5000ms reduz serialize IDB (v0.2.3.7)
- ✅ **#276** refetchDoses dashboard-payload refetchType:none (v0.2.3.7)
- ✅ **#277** Dual namespace `['doses']` eliminado — resolved via #291 cascata (v0.2.3.9)
- ✅ **#278** dosesSignature O(N) → FNV-1a hash linear — resolved via #293 (v0.2.3.9)

#### 🟡 P2 — Média

- ✅ **#089** BUG-022 Layout AdSense banner topo + header Dosy sem sobreposição (v0.2.0.12)
- ⏳ **#101-followup** 🟡 Re-audit egress quando user base ≥100
- ⏳ **#110** 🟡 Android native crashes art::ArtMethod::Invoke + Segfault (Sentry DOSY-3/7)
- ✅ **#123** Sessão não invalida após DELETE auth.users (v0.2.0.3)
- ✅ **#162** TreatmentForm Mounjaro repro warning + toggle Dias/Semanas/Meses (v0.2.1.3)
- ✅ **#189** UpdateBanner versionName triple fallback chain (v0.2.1.3)
- ✅ **#190** BUG-LOGOUT-RESUME useAppResume transient vs auth real (v0.2.1.3)
- ⏳ **#191** 🟠 Tela "Meu plano" Free/Plus/Pro acessível
- ⏳ **#192** 🟠 Validar pagamento E2E sandbox + License Tester
- ⏳ **#193** 🟠 Webhook Google Play RTDN — Pub/Sub→Edge play-billing-webhook
- ⏳ **#194** 🟠 Analytics flow upgrade — PostHog manage_plan/plan_card/upgrade_complete
- ✅ **#195** Não DELETAR push_subscription em SIGNED_OUT spurious — flag explicit_logout (v0.2.1.5)
- ✅ **#196** useAuth onAuthStateChange ignora SIGNED_OUT spurious (v0.2.1.5)
- ✅ **#197** Cron notify-doses-1min restaurado fallback push tray (v0.2.1.5)
- ✅ **#198** Detect install/upgrade APK + skip scheduleDoses durante loading (v0.2.1.5)
- ✅ **#199** Cron diário cleanup push_subscriptions stale >30d (v0.2.1.5)
- ✅ **#200** HORIZON cron 24h→30h + doc alarm-scheduling-shadows (v0.2.1.5)
- ✅ **#200.1** rescheduleAll idempotente diff-and-apply localStorage (v0.2.1.5)
- ✅ **#201** Telemetria auth events medcontrol.auth_events + painel /auth-log (v0.2.1.5)
- ✅ **#202** Mutex + debounce 1s useAppResume previne refresh storm (v0.2.1.5)
- ✅ **#203** Som alarme customizado dosy_alarm.mp3 res/raw/ (v0.2.1.6)
- ✅ **#208** UpdateBanner VERSION_CODE_TO_NAME map entries 56+57 (v0.2.1.9)
- ✅ **#224** BootReceiver perde alarmes <2h grace margin (v0.2.3.0)
- ⏳ **#231** 🟡 Banner AdMob gap peach Android 15 emulator-specific (não repro device físico)
- ✅ **#295** Alarme sem nome paciente — listDoses JOIN patients (v0.2.3.10)
- ✅ **#296** Pull-to-refresh fantasmas (v0.2.3.10)
- ✅ **#297** Unshare LGPD — Edge patient-unshare-handler (v0.2.3.10)

---

### 6.7 🔄 TURNAROUND — Mudanças drásticas

#### 🔴 P0 — Bloqueadores

- ✅ **#215** Refactor scheduler unificado 3-cenários + push backup co-agendado + cobertura DnD/criticalAlarm-off + janela dinâmica + cuidador compartilhado (v0.2.3.1)

---

### 6.7 fechados

- ✅ **REDESIGN v0.2.0.0** Peach/sunset palette + Sheet/Modal/Card primitives + DoseCard + PatientCard + AppHeader + 18 telas migradas (2026-05-03)

---

## 7. Itens descartados pela auditoria (com justificativa)

- **[Plan FASE 14.2 Sentry Replay]** — pulado por privacy concerns saúde. Manter pulado.
- **[REQUEST_IGNORE_BATTERY_OPTIMIZATIONS]** — não-incluído deliberadamente; `setAlarmClock()` bypassa Doze nativamente. Decisão correta.

---

## 8. Critérios de saída por fase

> Estado real cruzando contra §6 catálogo. Status ✅ = critério cumprido; ⏳ = pendente; 🚨 = bloqueado.

### Internal Testing → Closed Testing
- ✅ P0 fechados #001 #002 #003 #004 #005 #007 #008 #009 (#009 PITR DEFERRED via DR drill alternativo)
- ⏳ Device validation FASE 17 (#006) — manual user, 3 devices físicos
- ✅ Vídeo FGS demo no Console (#004)
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

## 9. Pergunta-chave do auditor

> *"Eu colocaria minha mãe ou meu filho dependendo deste app amanhã?"*

**Hoje:** Não com convicção total.
**Após P0 fechados + device validation:** SIM convicto.

A base é genuinamente sólida — alarme nativo, RLS defense-in-depth, LGPD coberta, bundle 64 KB. Falta fechar pontas específicas em ~3-5 dias-pessoa concentrados.

