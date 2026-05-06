# Roadmap de Lançamento — Dosy

> **Documento de entrada.** Se você é um chat novo retomando o trabalho, comece aqui. Este arquivo é self-contained: tem contexto, estado atual, onde paramos, próximo passo, mapa dos demais arquivos e checklist macro completo.

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
**Versão atual:** `0.2.1.2` · master @ tag `v0.2.1.2` (publicada 2026-05-06 — Console fix #158 + PatientDetail refactor #160 + alerts dismiss #161 + Mounjaro data fix).
**Vercel deploy:** `https://dosymed.app/` (custom domain) rodando v0.2.1.2 (master). Contas teste: `teste-free@teste.com / 123456` (tier free, paywall ativo) + `teste-plus@teste.com / 123456` (tier plus). Conta antiga `teste03` deletada.
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

**Branch ativa:** `release/v0.2.1.4` (refactor docs §6 ROADMAP em 4 categorias + #162 NOVO BUG TreatmentForm UX warning).

**Última release publicada:** v0.2.1.2 em 2026-05-06 (Vercel `dosymed.app` + Play Store Internal Testing AAB versionCode 48 + tag git `v0.2.1.2`) — Console fix #158 + PatientDetail refactor #160 + alerts dismiss #161 + Mounjaro data fix.

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

> **Refactor v0.2.1.4** (2026-05-06): §6 reorganizado em 4 categorias visuais — 🚀 IMPLEMENTAÇÃO · ✨ MELHORIAS · 🐛 BUGS · 🔄 TURNAROUND. Cada item mantém prioridade P0/P1/P2/P3. Closed items movidos pra §6.8 "Items fechados — referência cronológica" com link CHECKLIST §#XXX pra detalhe técnico.

### 6.1 📍 Legenda

**Categorias** (cada item pertence a 1):

| Ícone | Categoria | Escopo |
|---|---|---|
| 🚀 | **IMPLEMENTAÇÃO** | Caminho launch Play Store — compliance Console + recrutamento testers + Production gate |
| ✨ | **MELHORIAS** | Incrementais visuais/UX/perf não-bloqueadoras |
| 🐛 | **BUGS** | Correções de bug específicos (Sentry, user-reported, audit findings) |
| 🔄 | **TURNAROUND** | Mudanças drásticas (redesign visual, pivot Negócio, schema breaking change) |

**Prioridade** (cada item P0-P3, bolinha colorida):

| Bullet | Prioridade | SLA |
|---|---|---|
| 🔴 | **P0** | Bloqueador — fechar antes próxima release ou launch |
| 🟠 | **P1** | Alta — fechar próximas 1-2 releases |
| 🟡 | **P2** | Média — 30 dias pós-launch |
| 🟢 | **P3** | Baixa — 90 dias pós-launch / backlog |

**Status:**

- ✅ fechado @ commit · 🚧 em progresso · ⏳ aberto · 🚨 BLOQUEADO Google review · ⏸️ bloqueado outro item · 🚫 cancelado · ⏭️ parqueado vX.Y.Z

### 6.2 📊 Counter

**Total:** 162 itens · 114 fechados · 44 abertos · 2 BLOQUEADOS Google review

| Categoria | 🔴 P0 | 🟠 P1 | 🟡 P2 | 🟢 P3 | Total abertos |
|---|---|---|---|---|---|
| 🚀 IMPLEMENTAÇÃO | 5 (2 🚨) | 2 | 2 | 0 | 9 |
| ✨ MELHORIAS | 0 | 0 | 6 | 24 | 30 |
| 🐛 BUGS | 0 | 0 | 3 | 0 | 3 |
| 🔄 TURNAROUND | 0 | 0 | 0 | 0 | 0 |
| **Total** | **5** | **2** | **11** | **24** | **42** |

> Counter atualizado release v0.2.1.4 (2026-05-06). Recompor exato via auditoria semestral cross-ref `grep -cE` ROADMAP × CHECKLIST. Distribuição prioridade histórica aproximada permanece: P0:~25 · P1:~50 · P2:~50 · P3:~30 across todas releases. Origem itens: [Plan.md] · [Auditoria] · [BUG-XXX user-reported] · [Sentry] · [Sessão YYYY-MM-DD].

### 6.3 Δ Release log (cronológico)

**Δ 2026-05-05 (sessão pré-v0.2.1.0):** +#128 (BUG-040 backend done v0.2.0.9) +#027 (superseded por #129-#133). Itens revisados sem mudança status: #018 (escopo expandido AdMob+AdSense), #039 (bloqueado pre-req batch select), #007/#026/#036 (proposto v0.2.1.0), #035/#038 (diferido v0.2.2.0+).

**Δ 2026-05-05 v0.2.1.0:** +#129 (Google Group dosy-testers criado via Chrome MCP) +#018 cleanup AdSense placeholder (parcial — flag flip aguarda #133) +#130 (Closed Testing track submetido + **REJEITADO** Google) + categoria **Saúde e fitness** (trocada de Medicina) + detalhes contato `contato@dosymed.app`/`https://dosymed.app` publicados Console + **#026 ImprovMX 7 aliases verified DNS** + Gmail filtros + **#026 fix anti-spam: 8º filtro catch-all** + **#046 runbook DR** + **#156 página `/privacidade` v1.3 LGPD + Health Apps Policy + idade 18+** + **#007 RESTAURADO** (bisect inicial false positive; root cause real era #157) + **#036 skeleton screens** + **#157 NOVO P0 fix storm useRealtime cascade** + **bump v0.2.1.0** (versionCode 46) + **AAB v0.2.1.0 vc 46 publicado Internal Testing 23:42** + **#158 NOVO P0 URGENTE** rejection Google "Política requisitos org account required" — bloqueador Closed Testing público + Production. Counter: 111 fechados / 42 abertos + 2 BLOQUEADOS Google review (#130 + #158).

**Δ 2026-05-06 v0.2.1.1 (hotfix BUG-LOGOUT):** +#159 NOVO P0 fix useAuth boot validation distinguir transient (network/5xx) vs real auth failure (401/403/JWT-invalid). User reportava app desloga toda vez que abria — fix preserva session em network errors transient. Bump v0.2.1.0→v0.2.1.1 (versionCode 47). AAB publicado Internal Testing 08:26. Master merge + Vercel prod sync 13:00.

**Δ 2026-05-06 v0.2.1.2:** +**#158 fix #1** Console "Apps de saúde" desmarcado todas Medicina checkboxes + Outro texto consumer descritivo + re-submit Closed Testing 14 mudanças (Google review ~7d) + **#158 fix #2** PWA manifest.webmanifest categories ["health","medical","productivity"] → ["health","lifestyle","productivity"] (remove flag medical W3C que pode trigger Google org gate) + bump v0.2.1.1→v0.2.1.2 (versionCode 48). +**#160 NOVO P1** PatientDetail refactor — v1: card "Adesão" → "Doses Hoje X de Y" + bug fix tratamentos 3 seções (Ativos/Pausados/Encerrados via effectiveStatus) + lista doses paciente DoseCard reuso filter 24h/Todas + reorder layout. v2: collapse opcional TODAS 4 seções + Doses dentro Card peach destaque + count badge + chevron rotate. v2.1: dark mode adaptive (peach-100 var ao invés gradient fixo). +**#161 NOVO P1** Alerts dismiss refinement — ending date-based 1×/dia (LS_ENDING_SEEN_DATE YYYY-MM-DD), reaparece automático próximo dia. v2: useState mirror localStorage pra feedback visual immediate (bug v1 não dismissava UI). +**Mounjaro data fix SQL** (operacional sem código) — paciente lhenrique.pda durationDays=4→28 + status active + 3 doses pendentes (06/05 13/05 20/05 14:30 BRT). UX root cause parqueado novo #162. Counter: 114 fechados / 43 abertos + 2 BLOQUEADOS Google review.

**Δ 2026-05-06 v0.2.1.4 (em andamento):** +**#162 NOVO P2 BUG** TreatmentForm UX warning intervalHours/24 > durationDays (gerou Mounjaro silent fail). +**Refactor §6** ROADMAP em 4 categorias (🚀 IMPLEMENTAÇÃO · ✨ MELHORIAS · 🐛 BUGS · 🔄 TURNAROUND) com bolinhas P0/P1/P2/P3 + sub-counter por categoria + legenda + closed items movidos pra §6.8 cronológica. Adequação README Regra 1 alinhando estrutura nova. Counter: 114 fechados / 44 abertos + 2 BLOQUEADOS.

---

### 6.4 🚀 IMPLEMENTAÇÃO — Caminho Play Store launch

#### 🔴 P0 — Bloqueadores

- 🚨 **#158** [P0 v0.2.1.0 — BLOQUEADO Google review, fixes em curso v0.2.1.2] **Resolver rejection Google Play Política org account.** Console submit Closed Testing track Alpha rejeitado <30min após "Enviar 14 mudanças" (2026-05-05 23:14→23:30 BRT). Internal Testing intacto; Closed + Production travados. **Plano 7 passos** (CHECKLIST §#158): (1) ler email Google rejection completo; (2) entrar links sugeridos (Health Apps Policy 13316080 + Developer Program Policies 9858738); (3) estudar org account requirements 2026; (4) analisar app atual via Console Conteúdo do app; (5) validar regras Google (consumer wellness vs medical clinical); (6) investigar declaração específica que triggered gate; (7) elaborar correção via decision matrix + ADR. **3 opções:** (A) criar conta Developer empresarial CNPJ + transferir app — 1-3 semanas; (B) reverter declarações app específicas — 2-4h mas perde certificações; (C) apelo Google reclassificação consumer — 1-2 semanas. Recomendação default: A longo prazo + B paralelo curto prazo. **Fixes v0.2.1.2 aplicados:** Console 13 declarações Apps de saúde desmarcadas Medicina + manifest categories medical→lifestyle. Bloqueia: #131 #132 #133. ADR `decisoes/2026-05-06-001-rejection-google-fix.md`.
- 🚨 **#130** [P0 v0.2.1.0 — BLOQUEADO Google review, em HOLD pré-submit] **Closed Testing track "Alpha" Console.** Configurado: País Brasil + Tester list `dosy-testers@googlegroups.com` (Google Group) + AAB **v0.2.0.12 vc 45** + Release notes pt-BR + Feedback URL. Pendente 14+ mudanças acumuladas (Política Privacidade ✅ #156 done, Classificação conteúdo, Público-alvo, Segurança dados, Intent tela cheia, Anúncios) + click "Enviar mudanças para revisão". Hold cross-check pré-checks pós-deploy.
- ⏳ **#006** [P0, Plan + Auditoria] **Device validation FASE 17 em 3 devices físicos.** Não-bloqueador formal Closed Testing (manual user, paralelo). Documento: `docs/device-validation-checklist.md`.
- ⏳ **#131** [P0 — bloqueado por #158] **Recrutar 15-20 testers externos.** Reddit (r/AlphaAndBetausers + r/SideProject + r/brasil + targeted r/medicina/r/saude/r/tdah/r/diabetes) + Twitter + LinkedIn + Discord. Meta: 12+ ativos.
- ⏳ **#132** [P0 gate — bloqueado por #131] **Aguardar 14 dias rodando com ≥12 testers ativos** + iterar bugs reportados em mini-releases.
- ⏳ **#133** [P0 — bloqueado por #132] **Solicitar acesso de produção Console pós-gate.** Aprovação Google ~24-72h. Decidir Open Testing 7-14d OU Production rollout direto.

#### 🟠 P1 — Alta

- ⏳ **#021** [P1, Plan FASE 18.3] **Backup keystore 3 locais seguros.**
- ⏳ **#018** [P1, Plan FASE 4.3 — escopo expandido 2026-05-05] **AdMob Android prod + AdSense web.** AdMob: App ID `ca-app-pub-2350865861527931~5445284437` + ad unit Banner JÁ configurados em AndroidManifest + .env. Pendente: (a) flip `VITE_ADMOB_USE_TEST=true → false` em `.env.production`; (b) AdMob Console: app status "Requer revisão / Veiculação limitada" → desbloqueia automático após Play Store linking via Production track (#133). AdSense web (secundário): index.html ainda contém placeholder. AdBanner.jsx silently retorna null se vazio. Foco mobile.

#### 🟡 P2 — Média

- ⏳ **#047** [P2, Plan FASE 23 backlog] **Google Play Integrity API.**
- ⏳ **#155** [P2 launch polish] **Adicionar 1-2 screenshots novos Play Console pós-v0.2.0.12:** tela "Alterar senha" Ajustes (#152) + tela "Recuperar senha código 6 dígitos" Login (#153). Capturar S25 Ultra real prod pós-merge master.

---

### 6.5 ✨ MELHORIAS — Incrementais

#### 🟡 P2 — Média

- ⏳ **#035** [P2, Plan FASE 9.4 — diferido v0.2.2.0+] **Integration tests** (`useDoses`, `useUserPrefs` mocks). 1 dia esforço. Backlog estabilidade pós-rampa Closed Testing.
- ⏳ **#038** [P2, Plan FASE 8.4 + 20.3 — diferido v0.2.2.0+ ou pré-Open Testing] **Pen test interno completo documentado** (curl JWT roubado, Burp/mitmproxy, Play Integrity tampering). 1-2 dias. Recomendado executar antes Open Testing (#133).
- ⏳ **#041** [P2, Plan FASE 15 — partial v0.2.1.0, refactor rem diferido v0.2.2.0+] **Refactor mass `fontSize: Npx` → `rem`** (172 ocorrências). Diferido: trabalho substancial (4h) + baixo ROI Android WebView Capacitor (não respeita user font-scale system) + alto risco regressão visual.
- ⏳ **#042** [P2, Plan FASE 17 — diferido v0.2.2.0+] **Lighthouse mobile ≥90** em Reports + Dashboard. Audit completo + iterar fixes (~1 dia).
- ⏳ **#043** [P2, Plan] **Performance scroll lista 200+ doses sem jank** (já parcialmente coberto por #034 virtualização DoseHistory).
- ⏳ **#049** [P2, Plan FASE 20] **Pen test profissional.**

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

**Healthcare-specific (diferenciadores) [Auditoria]:**

- ⏳ **#064** Verificação interações medicamentosas + alergia. → [01 §11](auditoria/01-relatorio-completo.md#11--funcionalidades-específicas-de-medicação--score-6510)
- ⏳ **#065** Estoque + alerta "está acabando".
- ⏳ **#066** Lembrete de consulta médica.

**Expansão (Plan FASE 23.6):**

- ⏳ **#068** iOS via Capacitor.
- ⏳ **#069** Internacionalização (en, es).
- ⏳ **#070** Plano Family (até 5 usuários).

**Marketing / aquisição (Plan FASE 22-23):**

- ⏳ **#071** Programa afiliados. Plan FASE 23.3
- ⏳ **#072** A/B test paywall e onboarding. Plan FASE 23.2
- ⏳ **#073** Programa de indicação (1 mês PRO grátis). Plan FASE 22.3

---

### 6.6 🐛 BUGS — Correções

#### 🟡 P2 — Média

- ⏳ **#110** [P2 native, Sentry DOSY-3 REGRESSED + DOSY-7] **Android native crashes — `art::ArtMethod::Invoke` IllegalInstruction + Segfault unknown.** DOSY-3: 2 events 2 users, REGRESSED 4d ago. DOSY-7: 1 event Segfault unknown stack. Native code crash em ART runtime. Investigar: (a) AlarmActivity refactor v0.2.0.0 introduziu ValueAnimator + FrameLayout; (b) DosyMessagingService FCM data handler; (c) plugin nativo version mismatch; (d) ProGuard/R8 rules; (e) Sentry NDK upload disponível pós-#074 v0.2.0.2 — próxima crash terá stack symbolicado.
- ⏳ **#101-followup** [P2 cost] **Re-audit egress quando user base ≥100** — comparar baseline atual (~5 testers) vs scaled, decidir se Realtime poll bump (50ms→200ms) é necessário.
- ⏳ **#162** [P2 UX healthcare-adjacent NOVO v0.2.1.4] **TreatmentForm warning `intervalHours/24 > durationDays`.** User lhenrique.pda 2026-05-06 reportou Mounjaro semanal salvo `durationDays=4` (literal 4 dias) ao invés 28 (4 doses × 7d). `effectiveStatus` auto-ended dia 03/05 — alerta "encerrando" silenciou cedo demais. SQL data fix aplicado v0.2.1.2 (durationDays 4→28 + status active + 3 doses pendentes 06/05 13/05 20/05 14:30 BRT). UX root cause: form aceita durationDays < intervalHours/24 sem warning visual. **Fix v0.2.2.0+:** validação inline `intervalHours/24 > durationDays` → warning amarelo "Tratamento dura menos que intervalo entre doses — durar X dias significa X doses únicas? Continuar mesmo assim?" + sugestão calcular automático (intervalHours/24 × N doses esperadas). Detalhe completo CHECKLIST §#162.

---

### 6.7 🔄 TURNAROUND — Mudanças drásticas

(Vazio — última turnaround foi **REDESIGN visual Dosy v0.2.0.0** já fechado: peach/sunset palette + Sheet/Modal/Card primitives + DoseCard + PatientCard + AppHeader + 18 telas migradas. Próximas turnaround candidatas hipotéticas: pivot iOS first, schema breaking change LGPD, modelo plano Family DB schema rework.)

---

### 6.8 📚 Items fechados — referência cronológica

> **114 itens fechados** desde release v0.1.7.0 → v0.2.1.2. Detalhe técnico de cada item em CHECKLIST §#XXX. Lista cronológica abaixo (mais recentes primeiro):

**v0.2.1.2** (2026-05-06):
- ✅ #158 fix #1+#2 — Console Apps de saúde Medicina checkboxes desmarcadas + manifest categories ["health","lifestyle","productivity"]
- ✅ #160 v1+v2+v2.1 PatientDetail refactor — Doses Hoje X/Y card + 3 sections tratamentos + lista doses + collapse + dark mode adaptive
- ✅ #161 v1+v2 Alerts dismiss refinement — ending date-based 1×/dia + useState mirror immediate feedback
- ✅ Mounjaro durationDays SQL data fix (operacional sem código — paciente lhenrique.pda 4→28 + 3 doses inseridas; UX root cause parqueado #162)

**v0.2.1.1** (2026-05-06 — hotfix):
- ✅ #159 BUG-LOGOUT — useAuth boot validation distinguir transient vs auth failure

**v0.2.1.0** (2026-05-05):
- ✅ #007 Telemetria PostHog notification_delivered/tapped (4 listeners Capacitor)
- ✅ #018 cleanup AdSense placeholder index.html (parcial)
- ✅ #026 ImprovMX 7 emails @dosymed.app + Gmail filtros + anti-spam catch-all
- ✅ #036 skeleton screens TreatmentList + Analytics
- ✅ #041 partial (headings audit)
- ✅ #046 Runbook DR docs/runbook-dr.md v1.0
- ✅ #089 BUG-022 layout AdSense fechado organicamente
- ✅ #129 Google Group dosy-testers@googlegroups.com criado
- ✅ #156 v1.3 Privacidade.jsx LGPD + Health Apps Policy + idade 18+
- ✅ #157 NOVO P0 fix storm useRealtime cascade (12 req/s → 0.02 req/s, 99.7% redução)
- ✅ Categoria Console Medicina → Saúde e fitness

**v0.2.0.12** (2026-05-05):
- ✅ #029 refactor Settings.jsx 692 LOC → src/pages/Settings/
- ✅ #030 split notifications.js 613 LOC → 5 arquivos
- ✅ #034 virtualizar DoseHistory @tanstack/react-virtual VirtualTimeline
- ✅ #100 avatar emoji 6 categorias + default 👤→🙂 + Saúde category
- ✅ #144 Custom JWT claim tier (Auth Hook conservador read-only)
- ✅ #145 useRealtime watchdog scoped refetchQueries({active})
- ✅ #146 pg_cron audit log + view health + 90d retention
- ✅ #147 BUG-041 substituído por #152+#153 (recovery flow link broken localhost)
- ✅ #152 ChangePasswordModal Ajustes
- ✅ #153 Recovery senha OTP 6 dígitos (substitui magic-link broken)
- ✅ #154 Custom SMTP Resend pra dosymed.app
- ✅ #148 Dashboard extend_continuous rpc 2× → debounce 60s
- ✅ #149 useDoses mutation refetch storm → debounce 2s
- ✅ #150 useDoses refetchInterval 5min→15min
- ✅ #151 useDoses refetchInterval opt-in Dashboard

**v0.2.0.10** (2026-05-05):
- ✅ #139 dose-trigger-handler skip > 6h horizon (-50% a -70%)
- ✅ #140 schedule-alarms-fcm HORIZON 24h (3× menor payload FCM)
- ✅ #141 useReceivedShares staleTime 5min (-80% calls listReceivedShares)
- ✅ #142 cleanup cron JWT cosmetic
- ✅ #143 useUserPrefs getSession() vs getUser() (-100% calls /auth/v1/user)

**v0.2.0.9** (2026-05-05):
- ✅ #137 Dashboard 4 useDoses → 1 query + filtros memo client
- ✅ #138 DOSE_COLS_LIST sem observation + lazy-load DoseModal
- ✅ #128 BUG-040 patientName payload Edge functions

**v0.2.0.8** (2026-05-05):
- ✅ #134 useAppResume short idle no invalidate cascade (-30% a -45%)
- ✅ #135 useRealtime resume nativo no invalidate ALL keys (-5% a -10%)
- ✅ #136 useRealtime postgres_changes debounce 1s invalidate (-15% a -25%)
- ✅ #127 CI lint AnimatedRoutes.jsx (libera Sentry source maps)
- ✅ #025 screenshots phone Console + ícone + feature graphic + assets YT
- ✅ #004 vídeo FGS YouTube unlisted + Console form
- ✅ #027 superseded por #129-#133

**v0.2.0.7** (2026-05-04):
- ✅ Dosy Dev FLAG_SECURE off + StatusBar tema sync

**v0.2.0.6** (2026-05-04):
- ✅ #010 ic_stat_dosy notification icon vector drawable
- ✅ #017 LockScreen UI + biometria + timeout configurável

**v0.2.0.5** (2026-05-04):
- ✅ #126 gitleaks pre-commit + root cause vazamentos secrets
- ✅ #024 husky reforçado (gitleaks + lint-staged)

**v0.2.0.4** (2026-05-04):
- ✅ #028 rate limit delete-account Edge fn v7 (1/user/60s)
- ✅ #031 FORCE_RLS audit (13/13 tabelas)
- ✅ #032 search_path SECURITY DEFINER audit (resolvido via #119-followup)
- ✅ #044 register_sos_dose audit (sem schema drift)
- ✅ #048 supabase.exe gitignore audit (false alarm)
- ✅ #023 useDoses background-aware verify
- ✅ #037 inline errors forms (PatientForm + TreatmentForm)
- ✅ #119-followup trigger free→plus drop server-side
- ✅ #125 BUG-039 splash S25 Ultra fix (drawable/splash_icon.png 1024×1024)
- ✅ #090 BUG-023 pós-login redirect Início

**v0.2.0.3** (2026-05-03):
- ✅ #033 React.memo DoseCard (PatientCard já tinha)
- ✅ #040 contraste textos secundários dark (fg-secondary AA)
- ✅ #106 launcher full fix (cap/assets pipeline assets/ legado removido)
- ✅ #116 header alertas direct icons (sino dropdown → ícones diretos)
- ✅ #117 patient_share alert recebido novo
- ✅ #118 ending soon ≤3d alert
- ✅ #118-followup EndingSoonSheet (lista tratamentos)
- ✅ #119 promo client free→plus removida (paywall Free real)
- ✅ #120 SharePatientSheet copy plus (não-só free)
- ✅ #121 PaywallModal Escape key (Sheet/Modal primitives)
- ✅ #122 AppHeader shortName (preserva 2 palavras curtas)
- ✅ #123 deleted user signOut auto via getUser() boot

**v0.2.0.2** (2026-05-04):
- ✅ #074 debug symbols NDK FULL (Sentry stack symbolicado)
- ✅ #114 avatar crop UI react-easy-crop (BUG-038)
- ✅ #115 photo cache versioned localStorage (BUG-035 cost+UX)
- ✅ #045 coverage gitignore (já presente)
- ✅ #048 supabase.exe verify

**v0.2.0.1** (2026-05-03):
- ✅ #099 avatar crop center-square 512×512 (BUG-031)
- ✅ #102 atalho hardware silenciar volume AlarmActivity
- ✅ #103 UpdateBanner URL fix (origin runtime, BUG-032)
- ✅ #104 skeleton legacy slate → Dosy peach palette
- ✅ #105 MultiDoseModal Dosy primitives (BUG-033)
- ✅ #106-old launcher partial fix
- ✅ #108 PatientForm weight String coerce (BUG-036)
- ✅ #109 useRealtime concurrent subscribe lock (BUG-037)
- ✅ #096 admin panel tier sync (BUG-028)
- ✅ #107 schema().rpc().catch TypeError fix (BUG-035)

**v0.2.0.0** (2026-05-03):
- ✅ **🔄 TURNAROUND: REDESIGN visual Dosy** — peach/sunset palette + Sheet/Modal/Card primitives + DoseCard + PatientCard + AppHeader + 18 telas migradas

**v0.1.7.5** (2026-05-03):
- ✅ #092 BUG-025 egress reduction multi-frente (Realtime filter server + listDoses range fail-safe + paginate cap + queryKey hour-norm + refetchInterval 5min + staleTime bumps)
- ✅ #093 BUG-026 useRealtime race subscribe (nome único + await removeChannel + generation counter)
- ✅ #094 BUG-027 paywall falso plus mount race (useMyTier enabled + queryKey userId)
- ✅ #095 versão real app via Capacitor.App.getInfo packageInfo
- ✅ #084 JWT rotation legacy → sb_publishable_/sb_secret_ + revoke HS256

**v0.1.7.4** (2026-05-02):
- ✅ #012 #013 RLS hardening 48 policies (TO authenticated + split cmd=ALL)
- ✅ #014 RPC extend_continuous_treatments recriada
- ✅ #011 label Login a11y (TalkBack)
- ✅ #019 password length 8 + complexity
- ✅ #020 Disclaimer médico signup
- ✅ #022 typescript 6.0.3 verify legítimo
- ✅ #024 husky lint-staged setup
- ✅ #088 BUG-021 dose-not-shown viewport-specific (refetchOnMount=always)
- ✅ #091 BUG-024 TZ extend_continuous fix America/Sao_Paulo
- ✅ #015 PostHog dashboard
- ✅ #016 Sentry alert crash spike >10/h
- ✅ #081 gate validação 24h Dosy Dev fechado
- ✅ #086 Resumo Diário UI ocultada parqueado v0.1.8.0
- ✅ #087 Fase A BUG-020 DND UX condicional
- ✅ #085 BUG-018 Alarme Crítico OFF respeitado 6 caminhos

**v0.1.7.3** (2026-05-02):
- ✅ #085 BUG-018 Alarme Crítico OFF respeitado 6 caminhos (commit `f22f5a9`)

**v0.1.7.2** (2026-05-02):
- ✅ #083 FCM-driven alarm + 4 caminhos coordenados (BUG-016 fix definitivo)

**v0.1.7.1** (2026-05-01):
- ✅ #079 Realtime heartbeat keep-alive
- ✅ #080 notify-doses retry exp + cleanup tokens + idempotência
- ✅ #081 WorkManager DoseSyncWorker 6h (defense-in-depth)
- ✅ #082 Dual-app dev/prod com.dosyapp.dosy.dev "Dosy Dev"

**v0.1.7.0** (2026-05-01):
- ✅ #023 useDoses background-aware
- ✅ #075 React Query global staleTime (30s + refetchOnMount:true)
- ✅ #076 useAppResume soft recover (refresh JWT + reconnect realtime + invalidate)
- ✅ #077 useRealtime TOKEN_REFRESHED listener resubscribe
- ✅ #078 SW cache version v5→v6

**v0.1.6.10** (anterior):
- ✅ #001 Admin auth check send-test-push Edge Function
- ✅ #002 Sanitizar email enumeration send-test-push
- ✅ #005 BUG-001 encoding UTF-8 paciente legacy

**v0.1.6.x → v0.1.6.9** (Plan FASE 0-19 resumo):
- ✅ FASE 0-15: segurança, LGPD, alarme crítico, FCM, A11y partial, code splitting, Sentry, PostHog setup
- ✅ FASE 18.4.5: hot-fixes pós-deploy
- ✅ FASE 18.5: FAQ in-app
- ✅ FASE 19.1: Internal Testing setup
- ✅ Auditoria externa multidisciplinar 2026-05-01

**Itens superseded / cancelados:**
- 🚫 #027 Closed Testing pessoas conhecidas (superseded por #129-#133 estratégia Reddit + Google Group público 2026-05-05)
- 🚫 #147 BUG-041 magic-link recovery localhost (superseded por #152+#153 OTP 6 dígitos v0.2.0.12)
- 🚫 #106-old launcher partial fix (superseded por #106 full fix v0.2.0.3)

---

## 7. Itens descartados pela auditoria (com justificativa)

- **[Plan FASE 14.2 Sentry Replay]** — pulado por privacy concerns saúde. Manter pulado.
- **[REQUEST_IGNORE_BATTERY_OPTIMIZATIONS]** — não-incluído deliberadamente; `setAlarmClock()` bypassa Doze nativamente. Decisão correta.

---

## 8. Critérios de saída por fase

### Internal Testing → Closed Testing
- ✅ Todos P0 fechados (#001-009)
- ✅ Vídeo FGS demo no Console (#004)
- ✅ Device validation FASE 17 (#006)
- ✅ Telemetria notification_delivered ativa (#007)
- ✅ BUG-001 encoding verificado em criação via UI (#005)
- ✅ Screenshots retrabalhados (#025)

### Closed Testing → Produção
- ✅ 12+ testers ativos por 14 dias (#027)
- ✅ NPS médio ≥7
- ✅ Zero crashes nos últimos 7 dias
- ✅ Todos P1 fechados ou justificados
- ✅ Crash-free rate ≥99.5%, ANR <0.5%
- ✅ Notification delivery rate ≥99% (medido via #007)

### Critérios contínuos pós-launch
- ✅ Crash-free rate ≥99.5%
- ✅ ANR rate <0.5%
- ✅ Retention D7 ≥40%
- ✅ Avaliação Play Store ≥4.3
- ✅ Notification delivery ≥99%

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

> Snapshot v0.2.1.4 (2026-05-06). Counter detalhado em §6.2 com sub-distribuição por categoria.

- **Total:** 162 itens · 114 fechados · 44 abertos · 2 BLOQUEADOS Google review
- **Distribuição por categoria abertos:**
  - 🚀 IMPLEMENTAÇÃO: 9 (5 P0 + 2 P1 + 2 P2)
  - ✨ MELHORIAS: 30 (6 P2 + 24 P3)
  - 🐛 BUGS: 3 (P2)
  - 🔄 TURNAROUND: 0
- **P0 abertos críticos launch:** #158 🚨 + #130 🚨 + #131 + #132 + #133 + #006
- **Esforço P0 restante até Production:** ~3-5 dias manual user (recrutamento + 14d gate testers) + variável (Google review #158 1-3 semanas)
- **Wallclock até Open Testing pública:** ~5-7 semanas (rejection #158 fix → Closed Testing 14d gate → ramp → estabilização)

---

🚀 **Próximo passo concreto:**
1. Aguardar Google re-review v0.2.1.2 fixes (#158 desbloqueio Closed Testing — ETA 24h-7d)
2. Em paralelo: validar app prod estável (egress baseline pós-#157 storm fix; Sentry crash-free; user feedback teste-plus/teste-free)
3. Pós-desbloqueio: #131 recrutamento Reddit + #132 gate 14d ≥12 ativos + #133 solicita Production
4. Backlog v0.2.1.4+: #162 TreatmentForm UX warning (Mounjaro repro prevention)
