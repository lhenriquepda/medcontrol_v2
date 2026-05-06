# Roadmap de Lançamento — Dosy

> **Documento de entrada.** Se você é um chat novo retomando o trabalho, comece aqui. Este arquivo é self-contained: tem contexto, estado atual, onde paramos, próximo passo, mapa dos demais arquivos e checklist macro completo.

---

## 🛠️ Regra de manutenção (CRÍTICA — leia ANTES de atualizar)

**`ROADMAP.md` (este arquivo) e `CHECKLIST.md` são complementares, não-redundantes:**

| Documento | Propósito | Granularidade |
|---|---|---|
| **ROADMAP.md §6** | **Lista RESUMIDA** de tarefas — visão macro | 1 linha por item (descrição curta + status `[ ]/[x]` + commit/release) |
| **CHECKLIST.md** | **Lista DETALHADA** das tarefas — visão técnica completa | Entry completo (snippet, deps, aceitação, racional, links auditoria) |

**Compartilham numeração:** `#001` ROADMAP = `#001` CHECKLIST. Toda mudança de status atualiza **AMBOS**.

**Workflow obrigatório por sessão:**

1. **Item fechado?**
   - ROADMAP §6 → `- [x] **#XXX** [...] **fechado v0.X.Y.Z commit `{sha}`** {descrição curta}`
   - CHECKLIST §#XXX → `**Status:** ✅ Concluído @ commit {sha} ({YYYY-MM-DD})`
   - Update log da release → seção "Items fechados v0.X.Y.Z"

2. **Item novo descoberto?**
   - ROADMAP §6 → `- [ ] **#XXX** [PRIORIDADE] {descrição curta}` na P0/P1/P2/P3
   - CHECKLIST → criar entry completo (template em `README.md` Regra 1)
   - Update log → seção "Items novos descobertos"

**Próximo número livre:**
```bash
grep -oE "#[0-9]{3}" contexto/ROADMAP.md contexto/CHECKLIST.md | sort -u | tail -5
```

**Drift histórico observado:** items fechados sem update CHECKLIST → re-implementação acidental → conflito git. Última auditoria 2026-05-05 fechou ~60 discrepâncias acumuladas v0.1.7.4-v0.2.0.11. Rodar auditoria semestral cross-ref ROADMAP × CHECKLIST × `updates/*.md`.

**Detalhe completo das regras:** `contexto/README.md` Regra 1.

---

## 1. Contexto rápido

**App:** Dosy — Controle de Medicação (PWA + Capacitor → Android final, package `com.dosyapp.dosy`).
**Versão atual:** `0.2.0.12` (em desenvolvimento) · branch `release/v0.2.0.12`. Master @ tag `v0.2.0.11`.
**Vercel deploy:** `https://dosymed.app/` (custom domain) rodando v0.2.0.11 (master). Preview release/v0.2.0.12 via `https://dosy-git-release-v02012-lhenriquepdas-projects.vercel.app/`. Contas teste: `teste-free@teste.com / 123456` (tier free, paywall ativo) + `teste-plus@teste.com / 123456` (tier plus). Conta antiga `teste03` deletada.
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

**Em desenvolvimento — v0.2.0.12 (release/v0.2.0.12 ativa):**
- ✅ #152 ChangePasswordModal em Ajustes (Conta → Alterar senha, modal 3 inputs, re-auth + update)
- ✅ #153 Recovery senha via OTP 6 dígitos email (substitui magic-link broken #147 BUG-041)
- ✅ #154 NOVO Custom SMTP Resend pra dosymed.app (DNS Hostinger DKIM/SPF/MX/DMARC + API key + Supabase SMTP)
- ✅ #144 Auth Hook tier claim re-ativado (qc.clear scoped fix em useAuth onAuthStateChange)
- ✅ #147 BUG-041 magic-link recovery FECHADO via #152 + #153 (escopo movido v0.2.1.0 → v0.2.0.12)
- ✅ traduzirErro tradução OTP/rate-limit erros (commit 9dfb0f5)
- ⏳ Em curso: items v0.2.0.12 (todos fechados — release publicada)

**Última release:** v0.2.0.11 publicada 2026-05-05 (Vercel `dosymed.app` + Play Store Internal Testing AAB versionCode 44 + tag git `v0.2.0.11`).
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

## 6. Checklist macro completo

**Total:** 156 itens (numeração até #156 — adicionado #156 v0.2.1.0)
**Status:** 111 fechados (`[x]`) · 41 abertos (`[ ]`) · 1 hold (`[~]` #130) · ~3 com seguintes (#118-followup, #119-followup, #106-old) — recontado via `grep -cE` 2026-05-05 (+#036 fechado +#007 RESTAURADO +#157 NOVO P0 fix storm useRealtime cascade)
**Δ 2026-05-05 (sessão):** +#128 (BUG-040 backend done v0.2.0.9) +#027 (superseded por #129-#133). Itens revisados sem mudança status: #018 (escopo expandido AdMob+AdSense), #039 (bloqueado pre-req batch select), #007/#026/#036 (proposto v0.2.1.0), #035/#038 (diferido v0.2.2.0+).
**Δ 2026-05-05 v0.2.1.0 (em andamento):** +#129 (Google Group dosy-testers criado via Chrome MCP) +#018 cleanup AdSense placeholder (parcial — flag flip aguarda #133) +#130 (Closed Testing track salvo rascunho HOLD pré-submit) + categoria **Saúde e fitness** (trocada de Medicina) + detalhes contato `contato@dosymed.app`/`https://dosymed.app` publicados Console + **#026 ImprovMX 7 aliases verified DNS** + Gmail filtros + **#026 fix anti-spam: 8º filtro catch-all** + **#046 runbook DR** + **#156 página `/privacidade` v1.3 LGPD + Health Apps Policy + idade 18+** + **#007 RESTAURADO** (bisect inicial false positive; root cause real era #157) + **#036 skeleton screens** + **#157 NOVO P0 fix storm useRealtime cascade** (preview Vercel 12 req/s sustained idle hidden tab = 5GB/h egress por user; root cause publication `supabase_realtime` vazia + reconnect cascade `unsubscribe+subscribe+refetchQueries(active)` em loop; fix targeted: comentar `useRealtime()` em App.jsx:67; storm 99.7% eliminado pós-fix `da61b04` validado idle 5min completo; plano retomar v0.2.2.0+: populate publication via Studio + reconnect guard). Counter: 111 fechados / 41 abertos / 1 hold (`[~]` #130).
**Distribuição prioridade aproximada:** P0: ~25 · P1: ~50 · P2: ~50 · P3: ~30
**Origem:** [Plan.md] · [Auditoria] · [Plan.md + Auditoria] · [BUG-XXX user-reported] · [Sentry] · [Sessão YYYY-MM-DD]

**Counter §6 stale histórico:** valores anteriores (Total: 73, P0:9, P1:18, P2:22, P3:24) refletiam apenas itens originais Plan + Auditoria pré-v0.1.7.0. Hoje (pós-#154) os contadores reais incluem itens descobertos durante releases v0.1.7.x → v0.2.0.12 (BUGs Sentry, egress audit, validação Chrome MCP, sessões com user). Recompor counter exato exigiria varredura linha-a-linha — manter como aproximado até próxima auditoria semestral.

### 🔴 P0 — Bloqueadores

#### Segurança server-side
- [x] **#001** [Auditoria] Admin auth check em `send-test-push` Edge Function. → [04 §7.2](auditoria/04-supabase.md#72-send-test-pushindexts-120-linhas--crítico) · [06 BUG-002](auditoria/06-bugs.md#bug-002--edge-function-send-test-push-não-valida-autorização-auditoria-estática) · [03 §#001](CHECKLIST.md#001--adicionar-auth-check-de-admin-em-send-test-push-edge-function)
- [x] **#002** [Auditoria] Sanitizar erro email enumeration. → [06 BUG-015](auditoria/06-bugs.md#bug-015--resposta-de-erro-user-not-found-em-send-test-push-permite-enumeration)
- [x] **#003** [Plan + Auditoria, fechado 2026-05-04] Senha postgres rotacionada via Supabase Dashboard (auto-gen 16-char, salva password manager user). PAT `sbp_aedc82d7` (conta `lhenrique.pda@gmail.com` kids-paint) já revogado anteriormente — verificado conta sem tokens. INFOS.md ausente local + git history. → [archive/security-original.md](archive/security-original.md)

#### Bloqueador Play Console
- [x] **#004** [Plan, fechado 2026-05-04] Vídeo demo FOREGROUND_SERVICE_SPECIAL_USE — `alarm.mp4` 33s gravado S25 Ultra Dosy Dev → YouTube Shorts unlisted https://www.youtube.com/watch?v=qLBCzualcCw → Console Permissões FGS preenchido (uso especial + descrição PT-BR + URL). Pendente envio revisão Google. Plan FASE 18.9.1

#### Integridade dados
- [x] **#005** [Auditoria] Encoding UTF-8 quebrado em nome paciente. → [06 BUG-001](auditoria/06-bugs.md#bug-001--encoding-utf-8-quebrado-em-nome-de-paciente)

#### Validação manual
- [ ] **#006** [Plan + Auditoria] Device validation FASE 17 em 3 devices físicos. → `docs/device-validation-checklist.md`

#### Observabilidade healthcare crítica
- [x] **#007** [Auditoria — fechado v0.2.1.0 (2026-05-05)] Telemetria PostHog `notification_delivered` + `notification_tapped` + `notification_dismissed` (constants em `analytics.js` EVENTS). Wire em `App.jsx` 4 listeners Capacitor: `LocalNotifications.localNotificationReceived` (foreground delivery), `LocalNotifications.localNotificationActionPerformed` (tap), `PushNotifications.pushNotificationReceived` (FCM foreground delivery), `PushNotifications.pushNotificationActionPerformed` (FCM tap). PII strip auto via `sanitize_properties` analytics.js (LGPD). **Bisect inicial deu false positive** atribuindo storm preview Vercel a #007 (commit `76dc28a` revertia src) — investigação aprofundada via Chrome MCP + Supabase MCP identificou **#157 useRealtime cascade** como root cause real. #007 RESTAURADO via revert do bisect commit `ff431ca`. **Out of scope JS-only:** background FCM delivery (JS suspenso Android) — fica server-side via Edge `notify-doses` delivery report. **Pendente operacional:** dashboard PostHog manual + alert queda 5%/1h manual. → [01 §14](auditoria/01-relatorio-completo.md#14--observabilidade-e-monitoramento--score-7510)
- [x] **#157** [P0 v0.2.1.0 NOVO — fechado (2026-05-05) commit `da61b04`] **Disable `useRealtime()` em App.jsx — fix storm 12 req/s sustained idle hidden tab.** Validação preview Vercel detectou storm 18× prod baseline (1053 reqs / 30s, escalando 35 req/s sustained 5min). Investigação Chrome MCP + Supabase MCP `pg_publication_tables` revelou: publication `supabase_realtime` está VAZIA (zero tabelas configuradas) → useRealtime subscribes 6 tables postgres_changes que nunca recebem eventos → server logs mostram `ChannelRateLimitReached` + `Stop tenant no connected users` cycles → onStatusChange CLOSED dispara setTimeout backoff 1-2s × refetchQueries({type:'active'}) loop em ALL keys (~13 reqs/burst paralelas). Fix targeted: comentar `useRealtime()` em App.jsx:67 (single line). Hook `useRealtime.js` preservado intacto. Storm 99.7% eliminado pós-fix (9 reqs / 7min idle = 0.021 req/s). Bug PRÉ-EXISTENTE master (não regressão release v0.2.1.0). **Plano retomar v0.2.2.0+:** Studio → Database → Replication populate `supabase_realtime` (medcontrol.doses/patients/treatments/sos_rules/treatment_templates/patient_shares) + refactor reconnect guard (`reconnectAttempts >= 5 → suspend until visibility=visible`) + uncomment App.jsx:67 + validar preview idle 5min. Detalhe completo CHECKLIST §#157.

#### Setup CI / DR
- [x] **#008** [Plan, fechado 2026-05-04 — secrets criados 2026-04-28] GitHub Secrets `SENTRY_AUTH_TOKEN`/`SENTRY_ORG=lhp-tech`/`SENTRY_PROJECT=dosy`/`VITE_SENTRY_DSN` configurados em Actions. Workflows referenciam corretamente. Aceitação completa pendente #127 (CI lint fix → source maps upload roda auto). Plan FASE 10.1
- [x] **#009** [Auditoria, fechado v0.2.0.11 — DEFERRED PITR add-on $100/mo] PITR Supabase pago Pro add-on extra (não-incluído base) — pre-revenue overkill. DR drill executado via daily backup (7-day retention): baseline production capturado 2026-05-05 (auth_users:5, doses:582, patients:6, treatments:33, subscriptions:5, push_subs:10). Procedure docs Dashboard → Backups → Restore. RTO ~5-15min, RPO max 24h. Re-avaliar PITR quando Dosy gerar revenue (Q3 2026 ou 50+ paying users).

### 🟠 P1 — Alta Prioridade

#### Mobile / Android
- [x] **#010** [Auditoria, fechado v0.2.0.6 commit `cbfc813` — validado S25 Ultra] `ic_stat_dosy` notification icon — vector drawable 24dp + 3 paths Java migrados + setColor accent peach. → [06 BUG-005](auditoria/06-bugs.md#bug-005--ic_stat_dosy-referenciado-mas-ausente-nos-drawables)
- [x] **#017** [Plan, fechado v0.2.0.6 commit `869ab34` — validado S25 Ultra] LockScreen UI + biometria (`useAppLock`). Overlay App.jsx + Toggle Settings "Privacidade e segurança" + timeout configurável + biometric-auth allowDeviceCredential fallback. Plan FASE 11.3
- [x] **#128** [BUG-040, P1 healthcare-adjacent — fechado v0.2.0.9 commit `559004b`, validação device pendente em #006] Backend: `schedule-alarms-fcm` + `dose-trigger-handler` Edge functions agora populam `patientName` no FCM payload data (antes faltava → AlarmActivity caía "Sem paciente"). `patients` query expandida `SELECT id, name`, `patientNameById` Map preenche `dosesPayload`. Falta apenas reproduzir 6 doses cross-patient device real S25 Ultra pra confirmar resolução visual.
- [ ] **#021** [Plan] Backup keystore 3 locais seguros. Plan FASE 18.3

#### A11y
- [x] **#011** [Auditoria] `<label>` em inputs Login. → [07 §F2](auditoria/07-usabilidade.md#f2--inputs-sem-label-explícito-login)

#### Defense-in-depth DB
- [x] **#012** [Plan] Recriar policies RLS com `TO authenticated`. Plan FASE 8.3 · [04 §15.2](auditoria/04-supabase.md#152-audit-de-policies)
- [x] **#013** [Plan] Splitar policies `cmd=ALL` em 4 (push_subs, user_prefs, subscriptions, security_events). Plan FASE 8.3
- [x] **#014** [Plan + Auditoria] Recriar RPC `extend_continuous_treatments`. → [06 BUG-004](auditoria/06-bugs.md#bug-004--extend_continuous_treatments-rpc-sumiu-pgrst202-404)
- [x] **#019** [Auditoria] Subir `minimum_password_length` 6 → 8. → [06 BUG-008](auditoria/06-bugs.md#bug-008--minimum_password_length--6-no-supabaseconfigtoml)

#### Observabilidade
- [x] **#015** [Plan] PostHog key + dashboards launch. Plan FASE 14.1
- [x] **#016** [Plan] Alertas Sentry (crash spike, error threshold). Plan FASE 14.2

#### Compliance / SAC
- [x] **#020** [Plan] Disclaimer médico visível ("Não substitui orientação"). Plan FASE 18.5.1
- [x] **#025** [Plan, fechado 2026-05-04] Screenshots phone — 19 capturadas S25 Ultra (1080×2340), 8 melhores curadas em `resources/prints/processado/01-08-*.png` + ícone 512 peach (composto icon-bg + logo-mono-light) + feature graphic 1024×500 + assets YT (avatar 800 + banner 2560×1440). Tudo uploadado Console Listagem da loja como rascunho. Pendente envio revisão Google. Plan FASE 18.9.2
- [x] **#026** [Plan — fechado v0.2.1.0 (2026-05-05) via Chrome MCP] Emails oficiais `@dosymed.app` provisionados via **ImprovMX free**. DNS Hostinger: 2 MX (`mx1/mx2.improvmx.com`) + 1 TXT SPF (`v=spf1 include:spf.improvmx.com ~all`). Domain ImprovMX **VERIFIED**. 7 aliases ativos forward → `dosy.med@gmail.com`: catch-all `*` + `contato` + `privacidade` + `suporte` + `legal` + `dpo` + `security` + `hello`. Não conflita Resend SMTP #154 (subdomain `send.`). Pendente user: criar Gmail labels manuais (Suporte, Contato, etc) via filter `to:<alias>@dosymed.app`. Plan FASE 18.5
- [x] **#027** [Plan — fechado v0.2.0.12 (superseded)] Substituído por #129-#133 conforme estratégia 2026-05-05 (Google Group público + Reddit recrutamento externo em vez de pessoas conhecidas). Item original "Closed Testing + 12 testers via amigos" não-aplicável.

#### Closed Testing — recrutamento externo (estratégia 2026-05-05)
> User decidiu pular recrutamento Internal com pessoas conhecidas e ir direto Closed via Google Group público + Reddit/redes.

- [x] **#129** [P0 — fechado v0.2.1.0 (2026-05-05) via Chrome MCP] Google Group público `dosy-testers@googlegroups.com` criado. URL pública https://groups.google.com/g/dosy-testers (HTTP 200 anônimo). Settings: pesquisa "Qualquer pessoa da web" + participação "Qualquer pessoa pode participar" (auto-aprovação) + conversas/post/membros restritos a participantes (privacy).
- [~] **#130** [P0 — RASCUNHO SALVO v0.2.1.0 (2026-05-05) via Chrome MCP, em HOLD pré-submit] Closed Testing track "Alpha" configurado: País Brasil + Tester list `dosy-testers@googlegroups.com` (Google Group) + AAB **v0.2.0.12 vc 45** + Release notes pt-BR + Feedback URL `https://groups.google.com/g/dosy-testers`. **Side-effects setup pré-publicação:** Categoria app **Saúde e fitness** (trocada de Medicina pra audiência consumer self-care/cuidador, escrutinio Google razoável vs profissional clínico) + Detalhes contato `contato@dosymed.app` + `https://dosymed.app` (publicado direto). **Pendente:** 14+ mudanças acumuladas (Política Privacidade URL → #156 ✅ done v1.2, Classificação conteúdo, Público-alvo, Segurança dados, Intent tela cheia, Anúncios) + click "Enviar mudanças para revisão". Hold até cross-check pré-checks (HTTP 200 URL privacidade após próximo deploy Vercel, questionários completos).
- [ ] **#131** [P0] Recrutar 15-20 testers externos via Reddit (r/AlphaAndBetausers + r/SideProject + r/brasil + targeted r/medicina/r/saude/r/tdah/r/diabetes) + Twitter + LinkedIn + Discord. Meta: 12+ ativos.
- [ ] **#132** [P0 gate] Aguardar 14 dias rodando com ≥12 testers ativos + iterar bugs reportados em mini-releases.
- [ ] **#133** [P0] Solicitar acesso de produção Console pós-gate. Aprovação Google ~24-72h. Decidir Open Testing 7-14d OU Production rollout direto.

#### Fixes egress (auditoria 2026-05-05 — `egress-audit-2026-05-05/`)
> Egress 35.79 GB / 5 GB Free (715%). Grace expira 06 May. Fix #092 cobriu apenas ~30%. Múltiplos vetores ativos. Detalhamento: `contexto/egress-audit-2026-05-05/README.md`.

- [x] **#134** [P0 cost, fechado v0.2.0.8] `useAppResume`: removido invalidate em short idle (<5min); long idle usa `refetchQueries({active})` sem invalidate redundante. -30% a -45% egress estimado.
- [x] **#135** [P0 cost, fechado v0.2.0.8] `useRealtime` resume nativo: removido invalidate ALL keys em CapacitorApp.resume. Resubscribe + postgres_changes events tomam conta. -5% a -10% egress.
- [x] **#136** [P0 cost, fechado v0.2.0.8] `useRealtime` postgres_changes: debounce 1s invalidate por queryKey via `invalidateTimers` Map. Cron extend insere 100s doses → 1 invalidate consolidado em vez de 100. -15% a -25% egress.
- [x] **#137** [P0 cost, fechado v0.2.0.9 commit `0124608`] Dashboard: consolidar 4 useDoses paralelas em 1 query + filtros client-side. -20% a -30% egress.
- [x] **#138** [P0 cost, fechado v0.2.0.9 commit `0813d94`] DOSE_COLS_LIST sem observation + lazy-load detail. -15% a -30% payload listDoses.
- [x] **#139** [P1 cost, fechado v0.2.0.10 commit `bf45f80`] `dose-trigger-handler` v11 skip se scheduledAt > 6h futuro (early return `skipped: 'beyond-cron-horizon'`). Doses dentro 6h continuam fluxo normal; doses > 6h pegas pelo cron `schedule-alarms-fcm`. Edge invocations -50% a -70% em batch tratamentos contínuos.
- [x] **#140** [P1 cost, fechado v0.2.0.10 commit `bf45f80`] `schedule-alarms-fcm` v10 HORIZON 72h → 24h. AlarmManager nativo Android re-agenda a cada cron 6h ciclo (4 ciclos × 6h = 24h coverage). Payload FCM ~3× menor por device.
- [x] **#141** [P1 cost, fechado v0.2.0.10 commit `bf45f80`] `useReceivedShares` staleTime 60s → 5min. Shares mudam raríssimo (user aceita 1× e fica). -80% calls listReceivedShares estimado.
- [x] **#142** [P0 SECURITY, fechado v0.2.0.9 verificação + v0.2.0.10 cleanup `bf45f80`] Legacy JWT secret REVOKED (PostgREST 401 com JWT antigo). Edge function pública via `verify_jwt: false` autoriza via `SERVICE_ROLE_KEY` env interna. Atacante com JWT vazado NÃO consegue privilege escalation. Cleanup cosmético v0.2.0.10: drop cron job 3 + recreate sem header `Authorization` hardcoded.
- [x] **#143** [P2, fechado v0.2.0.10 commit `bf45f80`] `useUserPrefs.queryFn` `getSession()` em vez de `getUser()` — local-only (lê localStorage cache), zero round-trip /auth/v1/user. Top vector egress eliminado (-100% calls /auth/v1/user em useUserPrefs path).
- [x] **#144** [P2 longo prazo, fechado v0.2.0.12 commit `54e0d0a`] Custom JWT claim `tier` via Auth Hook. Backend permanente: migration `144_jwt_claim_tier_auth_hook` (schema `auth_hooks` + função `add_tier_to_jwt`). v0.2.0.11 frontend ROLLBACK pq qc.clear cascade em TOKEN_REFRESHED criou loop logout. v0.2.0.12 fix conservador: qc.clear scoped só em SIGNED_OUT ou SIGNED_IN com user diff (preserva cache em TOKEN_REFRESHED). Hook re-ativado prod v0.2.0.12. -100% rpc('my_tier') round-trip via app_metadata.tier claim local.
- [x] **#145** [P2, fechado v0.2.0.11 commit `9a9f399`] `useRealtime` watchdog + onStatusChange reconnect: substitui `qc.invalidateQueries(...)` blanket por `qc.refetchQueries({type:'active'})` scoped. Inactive queries (montadas em outras rotas, sem observers) NÃO refetcham — só ativas. Reduz blast radius reconnect.
- [x] **#146** [P2 audit, fechado v0.2.0.11 commit `9a9f399`] `pg_cron extend_continuous_treatments`: tabela `medcontrol.cron_audit_log` (job_name, ran_at, status, payload jsonb, error_msg, duration_ms) + wrapper `run_extend_continuous_with_audit()` + view `cron_health_recent` últimos 30 runs com flag `suspicious_zero_doses` + auto-cleanup 90d. Cron job 2 alterado pra wrapper. Test run gerou row 1 ok (users:1, treatments:0, doses:0, duration_ms:17).
- [x] **#147** [P1 BUG-041, fechado v0.2.0.12 via #152 + #153] Recuperação senha reformulada com OTP 6 dígitos via email (substitui magic-link broken localhost). Substituição completa #153.
- [x] **#152** [P1 UX, fechado v0.2.0.12 commit `b2f53ff`] **ChangePasswordModal em Ajustes**. Botão "Alterar senha" em Settings → Conta. Modal padrão Dosy (ícone Lock) + 3 inputs (atual + nova + repetir). Validação inline (≥8 chars, match repeat, atual ≠ nova). Re-autentica via signInWithPassword({email, password: current}) → updateUser({password: nova}). Toast success + close modal. Loading state bloqueia close.
- [x] **#153** [P1 UX, fechado v0.2.0.12 commits `b2f53ff` + `31da691`] **Recovery senha via OTP 6 dígitos** (substitui magic-link broken #147). useAuth.sendRecoveryOtp(email) → signInWithOtp shouldCreateUser:false. useAuth.verifyRecoveryOtp(email, token) → verifyOtp type:'email' + flag localStorage `dosy_force_password_change=1`. Login.jsx 2 sub-modes 'forgot-email' + 'forgot-otp'. App.jsx ForceNewPasswordModal aberto auto via useEffect [user] (FIX: useState init lazy não re-rodava após sessão criada — useEffect monitora SIGNED_IN). Email OTP length Supabase Dashboard 8→6 dígitos. Email template Magic Link customizado pra OTP code com `{{ .Token }}` em design Dosy peach. Validado fluxo end-to-end via Chrome MCP preview: email recebido + código + modal força nova senha + define + entra app.
- [x] **#154** [P0 INFRA, fechado v0.2.0.12] **Custom SMTP Resend pra dosymed.app**. Built-in Supabase email service rate-limited 2 emails/h (não-prod). Resend SMTP 30 emails/h Supabase (1000+ Resend free tier). DNS Hostinger: 4 records (DKIM TXT resend._domainkey, MX send → feedback-smtp.sa-east-1.amazonses.com priority 10, TXT send v=spf1 include:amazonses.com ~all, TXT _dmarc v=DMARC1; p=none;). Domain Resend VERIFIED em <5min após DNS prop. Supabase Auth → SMTP Settings: smtp.resend.com:465 user `resend` pass=API key, sender Dosy <noreply@dosymed.app>. Substitui built-in legacy. Recovery OTP funcionando real prod. Ver `contexto/decisoes/2026-05-05-resend-smtp-setup.md`.
- [x] **#148** [P0 cost, descoberto + fechado v0.2.0.11 commit `7c8cf5b`] Dashboard `extend_continuous_treatments` rpc 2× por mount. Causa: AnimatePresence popLayout mantém old + new Dashboard durante exit anim ~600ms → ambos useEffects firam. Fix: module-scope flag `window.__dosyExtendContinuousAt` debounce 60s. Skip se chamou nos últimos 60s. Identificado via Chrome MCP fetch interceptor preview Vercel.
- [x] **#149** [P0 cost, descoberto + fechado v0.2.0.11 commit `758035b`] useDoses mutation refetch storm — 12 fetches /doses em 200s sessão real (mark/skip/undo cascade). Causa: cada mutation onSettled invalida `['doses']` → todas active queryKeys (3-5) refetcham simultâneo. Optimistic update via `patchDoseInCache` já garante UI consistency. Fix: debounce 2s via module-scope timer. Multi-mutation rapid consolida em 1 refetch. -75% storm.
- [x] **#150** [P0 cost, descoberto + fechado v0.2.0.11 commit `017916d`] useDoses refetchInterval idle storm — 5 fetches /doses simultâneos cada 5min em IDLE. Causa: 5 active queryKeys × 5min interval. Math: 5 × 50KB × 12 cycles/h × 24h × 1000 users = 14GB/dia idle polling. Fix: 5min → 15min = -67% polling rate.
- [x] **#151** [P0 cost, descoberto + fechado v0.2.0.11 commit `78127b7`] useDoses refetchInterval opt-in only Dashboard. Antes: hardcoded 15min em TODAS queries (5 active queryKeys idle polling). Agora: default OFF, opt-in via `options.pollIntervalMs`. Dashboard explicitamente passa 15min. Outras telas (Settings, DoseHistory, Reports) sem polling — refetch só on mount + Realtime + invalidate explícito. -80% adicional idle egress.

#### Web (não-bloq Android)
- [ ] **#018** [Plan, escopo expandido 2026-05-05 — AdMob Android prod + AdSense web] **AdMob Android (prioritário):** App ID `ca-app-pub-2350865861527931~5445284437` + ad unit Banner `/2984960441` JÁ configurados em AndroidManifest + `.env`/`.env.production`. Únicos itens pendentes: (a) flip `VITE_ADMOB_USE_TEST=true → false` em `.env.production` (sandbox sempre fill, real ad unit tem aprovação Google); (b) AdMob Console: app status "Requer revisão / Veiculação limitada" → desbloqueia automático após Play Store linking via Production track (#133). **AdSense web (secundário):** `index.html` ainda contém placeholder `ca-pub-XXXXXXXXXXXXXXXX`. AdBanner.jsx silently retorna null se `VITE_ADSENSE_CLIENT/SLOT` vazios. Foco mobile → AdSense pode permanecer placeholder/remover script até demanda real web. Plan FASE 4.3 · [06 BUG-006](auditoria/06-bugs.md#bug-006--adsense-placeholder-em-produção-indexhtml)

#### Performance & custo
- [x] **#023** [Auditoria, fechado v0.2.0.4 — verificado] `useDoses` já tem `refetchIntervalInBackground: false` + `staleTime: 2min` (set em #092 v0.1.7.5). Verificado em release v0.2.0.4. → [05 §4.4](auditoria/05-codigo.md#44-anti-patterns-encontrados)

#### DX
- [x] **#022** [Auditoria] Verificar legitimidade `typescript@^6.0.3`. → [06 BUG-007](auditoria/06-bugs.md#bug-007--typescript-declarado-como-603-no-packagejson)
- [x] **#024** [Auditoria, fechado v0.2.0.5 — parte de #126] Pre-commit hooks (husky + lint-staged + gitleaks). Detalhe completo em §P0 abaixo (linha duplicada removida 2026-05-05).

### 🟡 P2 — Média Prioridade (30 dias pós-launch)

- [x] **#028** [Auditoria, fechado v0.2.0.4] Rate limit `delete-account`. Edge fn v7 deployed prod. Max 1 attempt/user/60s via security_events table check. Resposta 429 + Retry-After. Insert event antes da operação. → [06 BUG-003](auditoria/06-bugs.md#bug-003--edge-function-delete-account-sem-rate-limit-auditoria-estática)
- [x] **#029** [Plan + Auditoria, fechado v0.2.0.11 commit `9a9f399`] Refatorar `Settings.jsx` 692 LOC → `src/pages/Settings/` com 4 arquivos: index.jsx (276 LOC orchestrator) + sections.jsx (470 LOC, 7 components: Plan, Aparência, Notificações, Privacidade, Conta, Dados, Versão) + Row.jsx + constants.js. Imports preservados (Vite resolve auto). Plan FASE 15
- [x] **#030** [Plan SECURITY + Auditoria, fechado v0.2.0.11 commit `9a9f399`] Refatorar `services/notifications.js` 613 LOC → `src/services/notifications/` com 5 arquivos: prefs.js (helpers + storage + constants) + channels.js (Android channels + cancelAll) + scheduler.js (rescheduleAll + path web) + fcm.js (subscribeFcm/unsubscribeFcm/bindFcmListenersOnce) + index.js (barrel + useNotifications hook). API pública 100% retro-compat.
- [x] **#031** [Auditoria, fechado v0.2.0.4 — verificado] Confirmar `FORCE_RLS` em todas tabelas. Audit: 13/13 tabelas medcontrol com `relrowsecurity=true` AND `relforcerowsecurity=true`. ✓
- [x] **#032** [Auditoria, fechado v0.2.0.4] Confirmar `SET search_path` em todas SECURITY DEFINER. Audit revelou 1 função sem SET (`handle_new_user_plus_promo`). Resolvido indiretamente em #119-followup: trigger + função droppadas (eram da promo beta encerrada). 0/0 funções pendentes agora.
- [x] **#033** [Auditoria, fechado v0.2.0.3] React.memo em DoseCard (PatientCard já tinha; TreatmentCard não existe — falso achado).
- [x] **#034** [Plan, fechado v0.2.0.11 commit `9a9f399`] Virtualização DoseHistory via `@tanstack/react-virtual`. VirtualTimeline component envelopa map TimelineRow (ROW_HEIGHT 62px + ROW_GAP 6 + overscan 5). MaxHeight 60vh + scroll quando >10 itens. Pre-built patientById Map evita O(n²) lookup. Plan FASE 13. Patients virtualização parqueada (lista curta tipicamente).
- [ ] **#035** [Plan — diferido v0.2.2.0+] Integration tests (`useDoses`, `useUserPrefs` mocks). 1 dia esforço. Backlog estabilidade pós-rampa Closed Testing. Plan FASE 9.4
- [x] **#036** [Plan — fechado v0.2.1.0 (2026-05-05)] Skeleton screens aplicados em páginas com lista renderizada (evita flash empty state durante initial fetch): TreatmentList + Analytics (loading doses). Reports/SOS/PatientForm/TreatmentForm pulados — form-based, renderizam form imediato sem depender de fetch (skeleton não-aplicável). Componente `<SkeletonList count={N} />` reusado de #104 v0.2.0.0. Páginas com skeleton agora: Dashboard, Patients, DoseHistory, Admin, TreatmentList, Analytics. Plan FASE 15
- [x] **#037** [Plan, fechado v0.2.0.4] Erros inline em forms. PatientForm valida nome/idade/peso + TreatmentForm valida medName/unit/durationDays via state errors + Input.error prop (já existia no primitive). Erro limpa onChange do field. Substitui HTML5 required tooltip nativo (UX inconsistente browser/native).
- [ ] **#038** [Plan — diferido v0.2.2.0+ ou pré-Open Testing] Pen test interno completo documentado (curl JWT roubado, Burp/mitmproxy, Play Integrity tampering). 1-2 dias. Recomendado executar antes Open Testing (#133) mesmo que não bloqueante Closed. Plan FASE 8.4 + 20.3
- [ ] **#039** [Plan — bloqueado, não-aplicável atual] Confirmação dupla delete batch (>10). Hoje app NÃO tem feature batch delete (only delete 1-by-1 dose/patient/treatment). Pré-req: implementar batch select UI primeiro. Re-avaliar quando feature for priorizada. Plan FASE 15
- [x] **#040** [Plan, fechado v0.2.0.3] Subir contraste textos secundários no dark. fg-secondary #C8B8AB → #DDC8B6 (ratio 8.7→10.5), fg-tertiary #8E7F73 → #B0A091 (ratio 4.35→5.8 — passa AA), border alpha bumps.
- [ ] **#041** [Plan — partial v0.2.1.0, refactor rem diferido v0.2.2.0+] Hierarquia headings auditada: `<h1>` semantic em PageHeader.jsx (componente reusado por 14/18 pages); pages com semantic h1 explicit (Privacidade, Termos, Login, Install). Refactor mass `fontSize: Npx` → `rem` (172 ocorrências em pages + components) **diferido v0.2.2.0+**: trabalho substancial (4h) + baixo ROI no Android WebView Capacitor (não respeita user font-scale system) + alto risco regressão visual. Plan FASE 15.
- [ ] **#042** [Plan — diferido v0.2.2.0+] Lighthouse mobile ≥90 em Reports + Dashboard. Audit completo + iterar fixes (~1 dia). Defer release v0.2.2.0+ — depende ambiente prod estável + análise profunda profile bundle. Não-bloqueante Closed Testing. Plan FASE 17
- [ ] **#043** [Plan] Performance scroll lista 200+ doses sem jank (já coberto por #034)
- [x] **#044** [Plan, fechado v0.2.0.4 — verificado] Auditar continuidade RPC `register_sos_dose` (drift schema). Audit: SECURITY DEFINER ✓, search_path SET ✓, has_patient_access check ✓, sos_rules lookup case-insensitive ✓, minIntervalHours validate ✓, maxDosesIn24h validate ✓, INSERT com auth.uid() ✓. Sem schema drift.
- [x] **#045** [Auditoria, fechado v0.2.0.2 — verificado] Confirmar `coverage/` no `.gitignore`. Já presente (linha única). → [06 BUG-010](auditoria/06-bugs.md#bug-010--coverage-versionado-no-repo-provável)
- [x] **#046** [Plan — fechado v0.2.1.0 (2026-05-05)] Runbook DR documentado em `docs/runbook-dr.md` v1.0. Cobertura: RTO 5-15min / RPO 24h, baseline prod 2026-05-05 (5 users, 582 doses, etc), 6 procedures (daily backup restore, JWT roll #084, keystore restore #021, region outage, pós-incidente, drill schedule), 11 components mapeados (DB/Auth/Edge/Realtime/Storage/FCM/Resend/ImprovMX/CDN/AAB), contatos emergência. PITR ainda DEFERRED #009. Plan FASE 23.4
- [ ] **#047** [Plan] Google Play Integrity API. Plan FASE 23 backlog
- [x] **#048** [Auditoria, fechado v0.2.0.4 — verificado] Remover `tools/supabase.exe` do git (se versionado). Verificado: tools/supabase.exe + supabase.tar.gz NÃO tracked (gitignore cobre). False alarm.
- [ ] **#049** [Plan] Pen test profissional. Plan FASE 20

### 🟢 P3 — Melhorias (90 dias)

#### Auditoria DB / Segurança avançada
- [ ] **#050** [Plan] Audit_log abrangente (UPDATE/DELETE triggers). Plan FASE 23.5
- [ ] **#051** [Plan] 2FA opcional via TOTP. Plan FASE 23.5
- [ ] **#052** [Plan] Criptografia client-side de `observation`. Plan FASE 23.5
- [ ] **#053** [Plan] Logout remoto multi-device + tela "Dispositivos conectados". Plan FASE 23.5
- [ ] **#054** [Plan] Notif email/push ao login em device novo. Plan FASE 23.5
- [ ] **#055** [Plan] Session replay — *opcional, privacy review*
- [ ] **#056** [Plan] Visual regression tests (Chromatic/Percy). Plan FASE 23.5
- [ ] **#057** [Plan] Performance budget em CI. Plan FASE 23.5

#### TypeScript
- [ ] **#058** [Plan] TypeScript migration (ou JSDoc + `tsc --checkJs`). Plan FASE 23.5

#### Alarme / OEMs
- [ ] **#059** [Plan] `dosy_alarm.mp3` custom sound. Plan FASE 2.5
- [ ] **#060** [Plan] Detecção root/jailbreak. Plan FASE 23 backlog
- [ ] **#067** [Plan] DosyMonitorService (Xiaomi/OPPO/Huawei). Plan FASE 23.7

#### Features pacientes
- [ ] **#061** [Plan] Drag-sort de pacientes. Plan FASE 15 backlog
- [ ] **#062** [Plan] Anexar comprovantes/imagens (PRO). Plan FASE 15 backlog
- [ ] **#063** [Plan] Avaliar remoção `mockStore.js`. Plan FASE 15 backlog

#### Healthcare-specific (diferenciadores)
- [ ] **#064** [Auditoria] Verificação interações medicamentosas + alergia. → [01 §11](auditoria/01-relatorio-completo.md#11--funcionalidades-específicas-de-medicação--score-6510)
- [ ] **#065** [Auditoria] Estoque + alerta "está acabando"
- [ ] **#066** [Auditoria] Lembrete de consulta médica

#### Expansão
- [ ] **#068** [Plan] iOS via Capacitor. Plan FASE 23.6
- [ ] **#069** [Plan] Internacionalização (en, es). Plan FASE 23.6
- [ ] **#070** [Plan] Plano Family (até 5 usuários). Plan FASE 23.6

#### Marketing / aquisição
- [ ] **#071** [Plan] Programa afiliados. Plan FASE 23.3
- [ ] **#072** [Plan] A/B test paywall e onboarding. Plan FASE 23.2
- [ ] **#073** [Plan] Programa de indicação (1 mês PRO grátis). Plan FASE 22.3
- [ ] **#155** [P3 cosmético] Adicionar 1-2 screenshots novos Play Console pra v0.2.0.12: tela "Alterar senha" Ajustes (#152) + tela "Recuperar senha código 6 dígitos" Login (#153). Não-bloqueador release; releitura screenshots store mostra modais novos. Capturar S25 Ultra real prod pós-merge master.
- [x] **#156** [P0 BLOQUEADOR #130 — fechado v0.2.1.0 (2026-05-05)] Página `https://dosymed.app/privacidade` (Privacidade.jsx) atualizada com conteúdo LGPD healthcare. Mudanças: DPO email canônico `privacidade@dosymed.app` + outros 6 aliases (#026), entidade "Dosy Med LTDA", site `https://dosymed.app`, terceiros expandidos (Resend SMTP/Firebase FCM/PostHog/Sentry/Supabase São Paulo/AdMob), seção dados coletados granular (FCM token, telemetria anônima, security_events, foto paciente), bases legais art.7-I + art.11-II-f, anúncios Free não-personalizados sem dados saúde. Termos.jsx + FAQ.jsx tb atualizados emails. Versão v1.0 → v1.1. **Desbloqueia:** #130 submit Google review.

#### DX / Observability
- [x] **#074** [fechado v0.2.0.2] Habilitar upload de debug symbols (`ndk.debugSymbolLevel 'FULL'` em buildTypes.release). Resolve aviso recorrente Play Console + melhora Sentry NDK stack traces (necessário pra investigar #110 native ART crashes).

#### Performance / UX (P1 — fechados em v0.1.7.0)
- [x] **#075** [Sessão v0.1.7.0] Reduzir agressividade React Query global em `main.jsx` (`staleTime: 30_000`, `refetchOnMount: true` em vez de `'always'`). Mitiga lentidão geral observada.
- [x] **#076** [Sessão v0.1.7.0] Refatorar `useAppResume.js` — trocar `window.location.href = '/'` por soft recover (refresh JWT + reconect realtime + invalidate, preserva URL).
- [x] **#077** [Sessão v0.1.7.0] Listener `TOKEN_REFRESHED` em `useRealtime.js` pra resubscribe quando JWT renova.
- [x] **#078** [Sessão v0.1.7.0] Bumpar SW cache version `medcontrol-v5` → `v6` em `public/sw.js`.

#### Notificações idle ilimitado (P0 — release v0.1.7.1, defense-in-depth)
> **Princípio user-driven:** muitos users (não só idosos — também cuidadores ocupados, pais multi-tarefa, profissionais saúde) deixam app aberto em background indefinidamente. Idle deve ser ilimitado e ainda assim alarme + push funcionarem 100%. Estratégia: 3 caminhos independentes de notificação, qualquer 1 garante a dose. Hoje só 1 caminho ativo.

- [x] **#079** [BUG-016] Realtime heartbeat keep-alive + reconnect automático em `useRealtime.js`. Heartbeat 30s detecta silent fail. Caminho 1 de 3. (commit `b4812e0`)
- [x] **#080** [BUG-016] Edge `notify-doses` reliability: retry exponential FCM + cleanup tokens inválidos + idempotência via `dose_notifications` + advanceMins fallback. Caminho 2 de 3. (commit `4b82d16`)
- [x] **#081** [BUG-016] Defense-in-depth Android: WorkManager DoseSyncWorker periódico 6h fetcha doses 72h adiante + agenda via `setAlarmClock()`. Independe de app foreground / websocket / push. Caminho 3 de 3. (commit `49550e4`) — validação device em andamento
- [x] **#082** [Sessão v0.1.7.1] Dual-app dev/prod: `com.dosyapp.dosy.dev` "Dosy Dev" coexiste com `com.dosyapp.dosy` "Dosy" oficial. Permite testes destrutivos (force stop, idle 24h) sem afetar Dosy oficial. Firebase entry .dev separada. (commit `5b5938e`)
- [x] **#083** [Sessão v0.1.7.1 → v0.1.7.2] FCM-driven alarm scheduling + 4 caminhos coordenados (idempotente). Trigger DB <2s + Cron 6h FCM data + rescheduleAll quando app abre + WorkManager 6h. Push tray inteligente: skip se alarme nativo já agendado. Fecha BUG-016 100%. Validado end-to-end no device: cadastro web → trigger DB → Edge FCM → AlarmScheduler → alarme físico tocou. (commits `23deca4` + `3465ab6` + `26c51ab`)
- [ ] **#084** [INCIDENTE 2026-05-02 22:23 UTC] **Rotacionar service_role JWT + JWT secret do projeto Supabase**. Service role JWT foi commitado em migration `20260502091000_dose_trigger_webhook.sql` (commit 85d5e61), pushado pra GitHub público. GitGuardian + GitHub Security detectaram em ~6min (22:23-22:29). Histórico do branch reescrito via git-filter-repo + force push (commit 6310c1e), MAS chave permanece em GitHub commit cache + indexers externos. Service_role JWT bypassa RLS = expõe todos dados saúde de todos users (LGPD categoria especial). Ação: Supabase Dashboard → Settings → API → Roll JWT Secret. Atualizar VITE_SUPABASE_ANON_KEY em Vercel + .env.local + rebuild apps. Auditar logs Auth/REST janela 22:23-22:29 UTC. Bonus: reconectar Vercel↔GitHub (webhook quebrou após force push). Plano detalhado em `CHECKLIST.md §#084` (8 fases, autônomo vs USER ACTION). Próxima release v0.1.7.3. P0 security.
- [x] **#085** [BUG-018, fechado v0.1.7.3 commit `f22f5a9`] **Alarme Crítico desligado em Ajustes mas alarme tocou mesmo assim.** User toggle OFF na tela Ajustes → cadastrou dose → alarme nativo fullscreen disparou normalmente, deveria ter recebido apenas notificação push tray. Toggle não respeitado em algum dos 4 caminhos (#083). Possíveis causas: setting não persistido em prefs ou DB; AlarmScheduler não consulta flag antes de agendar; DosyMessagingService.onMessageReceived ignora flag em FCM data path; Edge `notify-doses` skip-push logic não respeita flag user. Auditar todos 4 caminhos + criar source-of-truth single check. P1 healthcare-adjacent (trust violation + LGPD/privacy).
- [x] **#086** [BUG-019, reportado user 2026-05-02 v0.1.7.2] **Resumo Diário não funciona — nunca dispara na hora marcada.** Feature de resumo diário configurada em Ajustes (horário definido) nunca enviou notificação. Verificar: persistência de horário em prefs/DB, cron agendado (Edge ou pg_cron), trigger envia push, FCM token ativo, channel notif Android registrado. Se broken end-to-end, decidir: fix em v0.1.7.3 ou parquear feature até v0.1.8.0. P1 broken feature user-facing.
- [x] **#087** [BUG-020, Fase A fechada v0.1.7.3 commit `f22f5a9`; Fase B parqueada v0.1.7.4] **Verificar Não Perturbe funcional + UX condicional.** Verificar se DND atual está respeitando horários configurados (alarme deveria silenciar entre X-Y). Refactor UX: Não Perturbe deve aparecer SOMENTE quando Alarme Crítico ON (toggle pai); quando ON, sub-toggle DND habilita janela horária para desabilitar Alarme Crítico nesse intervalo. Depende de #085 fix (toggle parent precisa funcionar antes UX condicional fazer sentido). P1 UX healthcare-adjacent.
- [x] **#088** [BUG-021, reportado user 2026-05-02 emulador Pixel 7 API 35] **Dose cadastrada não aparece em Início sem refresh manual.** Após cadastrar dose nova, voltar pra Início mostra lista antiga — user precisa pull-to-refresh OU sair/voltar de tab. Provável causa: TanStack Query `invalidateQueries(['doses'])` não chamado após mutation INSERT em doses (ou hook useDoses não escuta eventos realtime suficientes). Verificar `dosesService.js` mutate handlers + `useDoses` queryKey invalidation. **⚠️ NÃO repro em Samsung S25 Ultra device real** — fix DEVE preservar comportamento atual em devices modernos. Antes de mudar `useDoses`/`dosesService`/realtime, regredir em S25 Ultra primeiro. Provável race condition timing OR latência realtime emulador-only. P1 UX healthcare-adjacent (user pode achar dose não foi salva, recadastrar = duplicata).
- [x] **#090** [BUG-023, fechado v0.1.7.4 commit pendente] **Pós-login redireciona pra Ajustes ao invés de Início.** Causa raiz: React Router preserva pathname após user mudar null→logged. Se URL era `/ajustes` (herdada session anterior pré-logout), App re-renderiza com user truthy + rota /ajustes existente → Settings renderiza direto sem redirecionar Início. Fix: navigate('/', {replace:true}) explícito em Login.submit após signin/signup success se path atual não é `/` nem `/reset-password` (preserva deep links legítimos com token).
- [x] **#089** [BUG-022, fechado organicamente entre v0.1.7.4-v0.2.0.12 — validado user print Pixel 7 emulador 2026-05-05] Layout AdSense banner topo + header Dosy abaixo sem sobreposição. "Dosy" wordmark inteiro visível. Provável fix em release intermediária (#113 v0.2.0.x buffer +4 px `--ad-banner-height` OR refactor AppHeader top calc com `safe-area-inset` + `--ad-banner-height` + `--update-banner-height`). NÃO precisou device-specific intervention.
- [x] **#099** [P1 BUG-031, fechado v0.2.0.1 commit `1fcff21`] **Avatar paciente — upload de foto não persiste + falta crop circular.** Fix: canvas client-side center-square-crop 512x512 + JPEG 0.78 (~50KB) antes de salvar. Resolve aspect 1:1 + reduz payload DB. No formulário Cadastro/Editar Paciente (PatientForm.jsx), user seleciona imagem do device pra avatar do filho. Dois problemas: (1) Sem UI de crop pra escolher pedaço da imagem que vai aparecer no círculo do avatar — qualquer foto retangular fica espremida/cortada errado. (2) Click em "Salvar Alterações" — nada acontece visualmente, avatar não muda, sem toast feedback. Provável: handler upload incompleto OR Supabase Storage sem bucket configurado OR `photo_url` field não chega no PATCH RPC. Investigar: PatientForm.jsx file input handler, `patients.photo_url` column (existe schema), service updatePatient payload, Supabase Storage policies bucket `patient-photos`. Fix: (a) integrar lib crop circular (ex `react-easy-crop` ou `react-image-crop`) com aspect 1:1 round mask, (b) confirmar Storage bucket + RLS policy auth user-scoped, (c) upload → URL → patches `photo_url`, (d) toast success + invalidate queryClient ['patients']. P1 UX broken feature healthcare-adjacent.
- [x] **#100** [P2 UX, fechado PARCIAL v0.2.0.11 commit `9a9f399` — escopo reduzido] **Avatar emoji redesign — categorização curada + default amigável.** Escopo executado: (1) PatientForm AVATAR_GROUPS reorganizado em 6 categorias (Família, Saúde ⭐ NOVO, Pessoas, Animais, Atividades ⭐ NOVO, Cores), (2) Saúde inclui emojis médicos (🩺 🩹 💊 💉 🫀 🧠 🦴 🦷 👁️ 👂), (3) Família com laços comuns (👨‍👩‍👧 👨‍👩‍👦 👪), (4) Default `'👤'` (silhueta cinza) → `'🙂'` (rosto amigável universal) com const `DEFAULT_AVATAR`, (5) dedup duplicatas (🟥 🟧 etc removidas, mantém círculos coloridos). Fallbacks atualizados em PatientAvatar/FilterBar/Dashboard/PatientDetail. Escopo NÃO executado (parqueado backlog): SVG flat tinted, sliders cor emoji + cor bg, migration ALTER TABLE `avatarColor`/`avatarBg`, lib `emojibase` + `react-emoji-render`. Decisão: ganho UX já é grande sem migration DB; redesign visual avançado quando branding maturar.
- [x] **#107** [P0 BUG-035, fechado v0.2.0.0+ commit pendente — Sentry DOSY-J/F/G] **TypeError: schema(...).rpc(...).catch is not a function** em Dashboard pull-to-refresh. 6 events combined em 3 bundle hashes (Dashboard-Cmc-tujf.js, Dashboard-BhDXgu92.js, Dashboard-BLHPy4NG.js) últimas 22min/2hr/10hr. Causa: `supabase.schema().rpc()` retorna PostgrestFilterBuilder (PromiseLike, só `.then`), NÃO Promise nativo. `.catch()` direto throws TypeError. Fix: `.then(undefined, errHandler)` form 2-arg (compatível PromiseLike). Linha Dashboard.jsx handleRefresh array Promise.all.
- [x] **#108** [P1 BUG-036, fechado v0.2.0.1 commit `09724c1`] **PatientForm weight.replace TypeError (Sentry DOSY-K).** Coerce String() em load + submit. 1 event 1 user, ~1hr ago. Causa: campo `weight` passa pelo input já como number OR null, mas onSubmit chama `weight.replace(',','.')` esperando string. Fix: coerce String(weight) antes OR só chamar replace se typeof string. Quick Fix Sentry sugerido. Test: cadastrar paciente com peso preenchido. P1 broken submit (cadastro paciente falha).
- [x] **#109** [P0 BUG-037, fechado v0.2.0.1 commit `09724c1`] **useRealtime concurrent subscribe race.** Lock flag `subscribing` + try/catch ch.on() defensive previne 4 paths convergent (status reconnect + watchdog + TOKEN_REFRESHED + native resume). 9 events combined em 4 issues distintas (variants vendor-data hashes BCdG1osb, CdTeGmV2). #093 (closed v0.1.7.5) aplicou fix nome único + await removeChannel + generation counter. Mas erro voltou. Investigar: (a) novo cenário race não coberto por #093 fix, (b) nova chamada `.on('postgres_changes')` em outro lugar (BellAlerts? Dashboard hook?), (c) realtime client v2.x mudança de comportamento, (d) regressão por código novo v0.2.0.0 chamando subscribe múltiplas vezes (useEffect deps incorretas). Stack trace `Vr.on(/assets/vendor-data-...js)` — vendor bundle, não nosso código diretamente. Reproduzir + isolar caller. P0 healthcare reliability.
- [ ] **#110** [P2 native, Sentry DOSY-3 REGRESSED + DOSY-7] **Android native crashes — art::ArtMethod::Invoke IllegalInstruction + Segfault unknown.** DOSY-3: 2 events 2 users, REGRESSED 4d ago. DOSY-7: 1 event Segfault unknown stack. Native code crash em ART runtime. Sem symbols completos, difícil pinpoint. Investigar: (a) AlarmActivity refactor v0.2.0.0 introduziu ValueAnimator + FrameLayout — possível crash em devices antigos sem suporte hardware, (b) DosyMessagingService FCM data handler, (c) plugin nativo (criticalAlarm/local-notifications) versão mismatch, (d) ProGuard/R8 rules — código keepers podem estar removendo classes nativas necessárias, (e) habilitar Sentry NDK / native symbols upload pra próximas releases. P2 (low frequency mas crítico — silent crash). **Update v0.2.0.2:** debug symbols ndk habilitados (#074) — próxima crash terá stack symbolicado.

- [x] **#114** [P1 BUG-038, fechado v0.2.0.2] **Avatar foto sem UI de crop manual.** Antes (v0.2.0.1): center-square auto-crop sem deixar user escolher região — sujeito off-center cortava errado. Fix: integrado `react-easy-crop` em `CropModal` component novo. PatientForm onPhoto → modal abre com zoom slider 1-3x + drag pan (cropShape circular live preview) → confirm gera canvas 512×512 jpeg q0.78 (~50KB) salvo em `photo_url`. Reset input após cancel/confirm pra permitir mesmo arquivo de novo. P1 UX healthcare-adjacent.

- [x] **#116** [P1 UX, fechado v0.2.0.3] **Header alertas: sino dropdown → ícones diretos.** Antes: 1 sino com badge total → click abre lista expandida → user clica item específico (2 taps + dropdown intermediário, padrão confuso reportado pelo user). Agora: cada tipo de alerta tem ícone próprio no header com badge contador + click direto dispara ação. Padrão WhatsApp/Gmail. Componente `HeaderAlertIcon` primitive (4 tones: danger/warning/info/update). AppHeader renderiza condicionalmente: AlertCircle pulse (overdue → /?filter=overdue), Users (shares novos → /pacientes), Pill (tratamentos acabando ≤3d → /pacientes), Download (update → startUpdate). UpdateBanner verde no topo MANTIDO (redundância intencional). BellAlerts component fica deprecated mas exportado pra compat.

- [x] **#117** [P2 UX, fechado v0.2.0.3] **Alerta header: paciente compartilhado comigo (novo `patient_share` recebido).** Service `listReceivedShares` consulta `patient_shares WHERE sharedWithUserId = me`. Hook `useReceivedShares` (staleTime 60s). Header conta shares cujo `createdAt > localStorage[dosy_shares_seen_at]`. Click → seenAt=now → nav /pacientes. Decay automático.

- [x] **#118** [P2 UX, fechado v0.2.0.3] **Alerta header: tratamento acabando ≤3 dias.** Computa endDate = startDate + durationDays*24h em memória (sem coluna nova). Filtra: !isContinuous && status='active' && endDate >= now && endDate-now ≤ 3d. seenAt-based decay igual ao #117. Click → nav /pacientes. Useful pra renovação de receitas + visibilidade de fim de uso.

- [x] **#115** [P0 cost+UX, fechado v0.2.0.2] **Avatar foto não aparecia na lista/Início + risco egress.** Antes (v0.2.0.1 commit `e6c9423`): #101 fix removeu `photo_url` de PATIENT_COLS_LIST por egress (50KB-2MB × refetch frequente = MB/min). Side effect: Patients list + Dashboard mostravam emoji em vez da foto. Fix: nova coluna `photo_version` SMALLINT na tabela patients (migration `replace_photo_thumb_with_photo_version` 2026-05-04). Lista carrega só `photo_version` (2B). Hook `usePatientPhoto(id, version)` checa `localStorage[dosy_photo_<id>] = {v, data}` — match version → render instant ZERO request da imagem. Mismatch (1ª vez OU edit externo) → 1 fetch único via `getPatient` → cache forever. PatientForm submit bump version quando foto muda → realtime invalida lista nos outros devices → mismatch detectado → re-fetch automático. `primePatientPhotoCache` em PatientForm + PatientDetail pré-aquece cache. `pruneStalePhotoCaches` em Patients screen limpa entries de pacientes deletados. Componente `PatientAvatar` wrapper centraliza lógica. Resultado: foto baixa 1 vez por device, lista vê só version int. Storage budget: 100 pacientes × 50KB = 5MB localStorage. P0 cost (volta foto na lista sem regredir egress fix #101).

- [x] **#120** [P2 truth, fechado v0.2.0.3] **SharePatientSheet copy "Você está no plano Free" pra user Plus.** Reproduzir: login com user tier='plus' (ex teste-plus@teste.com) → abrir patient detail → click "Compartilhar paciente" → sheet abre. Mostra mensagem "Você está no plano Free. Assine PRO para compartilhar." mas user NÃO é free. Causa: SharePatientSheet.jsx:10 hardcoded `tier === 'pro' || tier === 'admin'`, define `isPro=false` pra plus. Footer message e button styling assume `!isPro = free`. Fix: copy condicional baseado em `tier` real (ex: "Você está no plano Plus. Compartilhar é exclusivo PRO." vs "Você está no plano Free. Assine PRO."). Server-side check OK (RPC `APENAS_PRO_COMPARTILHA`), apenas client copy errado.

- [x] **#121** [P2 a11y, fechado v0.2.0.3] **PaywallModal não fecha com Escape.** Fix em surfaces.jsx Sheet + Modal: keydown listener `Escape` chamando onClose. Cobre todos sheets/modals dosy (PaywallModal, SharePatientSheet, EndingSoonSheet, etc). Reproduzir: trigger PaywallModal (click + cadastrar 2º paciente como free) → press Escape → modal continua aberto. Sheet primitive deve respeitar keyboard close. Fix: adicionar `keydown` listener `Escape` em Sheet/Modal Dosy primitive, OR PaywallModal específico.

- [x] **#122** [P3 cosmético, fechado v0.2.0.3] **AppHeader greeting trunca nome.** Substituído `firstName` por `shortName` em userDisplay.js: retorna primeira+segunda palavra se ambas ≤6 chars (cobre "Teste Free", "Teste Plus", "Plus Beta"), senão só primeira (preserva "Luiz", "Daffiny", "Elaine"). "Teste Free" + "Teste Plus" exibem só "Teste" no header. firstName(user) extrai primeira palavra. Possivelmente design intencional (espaço apertado), mas perde identidade do user em ambientes com múltiplas contas teste. Considerar mostrar `display_name` completo OU primeiro nome real (Daffiny, Elaine, etc) — para nomes compostos do `name` field.

- [x] **#123** [P2 UX/security, fechado v0.2.0.3] **Sessão não invalida após DELETE auth.users.** Fix useAuth boot: após getSession(), chama supabase.auth.getUser() (bate na API). Se retornar erro/null, força signOut local + clear cache. Cobre: user deletado, banned, JWT key rotation. Quando app abre/refresh, JWT antigo é validado server-side → invalidação imediata.

- [x] **#118-followup** [P1 UX, fechado v0.2.0.3] **Pill amarelo (tratamento acabando) navegava silenciosamente.** Antes: click → /pacientes sem explicar alerta. Agora: abre `EndingSoonSheet` componente novo com lista de tratamentos acabando + paciente avatar + medicamento + dias restantes ("termina hoje", "termina amanhã", "N dias"). Click row → patient detail. Resolve confusão "não sei o que esse ícone está alertando". Reproduzir: app aberto logado como teste03 → admin DELETE FROM auth.users WHERE email='teste03@teste.com' → app continua mostrando "Bom dia, teste03" até refresh manual / TOKEN_REFRESHED. RPCs vão falhar com JWT inválido (low risk, fail-safe). Mas UX confusa. Fix: useAuth listener `onAuthStateChange` evento `USER_DELETED` (Supabase emit?) OR detect 401 em qualquer request → forçar signOut local. Edge case raro mas afeta delete-account flow.

- [x] **#126** [P0 SECURITY, fechado v0.2.0.5] **Pre-commit secret scanning + investigação root cause vazamentos.** GitGuardian retornou 4 incidents High em 2026-05-04: 3× postgres pwd hardcoded em `tools/*.cjs` (commits `2119b45`, `666574a`) + 1× VAPID_PRIVATE_KEY em `Contexto.md` (commit `78f4b77`). **Root cause analysis:** husky pre-commit rodava só `npx lint-staged` (eslint), sem scan de secrets. Padrões identificados: (a) dev scripts `tools/*.cjs` hardcoding connection strings em vez de `process.env`, (b) docs/Contexto.md exemplificando env vars com VALORES REAIS em vez de placeholders. **Fix:** (1) `gitleaks` instalado scoop (8.30.1), (2) `.gitleaks.toml` com regras custom (postgres conn string, VAPID, supabase service role JWT) + allowlist tuning (.env gitignored, build artifacts, google-services.json convenção mobile), (3) `.husky/pre-commit` agora roda `gitleaks protect --staged` ANTES de lint-staged — bloqueia commit se secret detectado, exit 1, instrui user OR `--no-verify` (proibido master), (4) `.github/workflows/gitleaks.yml` action segunda camada (CI scan no push/PR, não-bypassable se branch protection ativa), (5) full filesystem scan validado: 27→0 leaks após allowlist refinada. **Rotação manual (P0 user action):** postgres pwd Dosy `xoeDZAnfn8TvBD5m` (vazada commit `2119b45`) precisa reset Supabase Dashboard. VAPID já rotacionado anteriormente (public era `BEIoP8V9...`, hoje `BHnTRizOlz...`). Legacy DB `oubmmyitpahbcsjrhcxr` (`bJkXaiMIbQlc9ZWP`) verificar se ainda existe — se sim rotate, se não delete project. GitGuardian incidents marcar Revoked após rotate.

- [x] **#024** [Plan, fechado v0.2.0.5 — parte de #126] Pre-commit hooks. Antes só eslint via lint-staged. Agora gitleaks `protect --staged` adicionado primeiro (block secrets) + lint-staged (block lint errors). Husky 9.1.7 + gitleaks 8.30.1 + GitHub Action gitleaks/gitleaks-action@v2.

- [x] **#119-followup** [P1 truth, fechado v0.2.0.4] **Promo `free → plus` server-side trigger remoção.** v0.2.0.3 removeu promo só client. Server-side trigger `on_auth_user_signup_plus` em auth.users continuava chamando `handle_new_user_plus_promo()` que inseria tier='plus' source='beta_promo' pra todo novo signup. Migration `drop_signup_plus_promo_trigger` v0.2.0.4: DROP TRIGGER + DROP FUNCTION. Novos signups agora começam tier='free' real. Side-effect: resolve #032 (função sem search_path SET sumiu).

- [x] **#119** [P1 cost+truth, fechado v0.2.0.3] **Promo `free → plus` removida do client.** Antes (v0.1.7.x): subscriptionService.getMyTier mapeava `free → plus` durante beta interno, bypass paywall pra qualquer user free. Agora (v0.2.0.3): tier vem direto do DB via RPC `my_tier`. Paywall ativo pra users free reais. Reais (lhenrique admin, daffiny+ela pro) não afetados — tier real DB já é admin/pro. Mesmo bypass removido em `listAllUsers` (admin panel agora mostra tier real, não mapped). Permite testar paywall via teste-free@teste.com.

- [x] **#125** [P1 BUG-039, fechado v0.2.0.4] **Splash distorcido em S25 Ultra (Android 12+).** User reportou que pós-v0.2.0.3 splash continuava errado. **Causa:** `android/app/src/main/res/drawable/splash_icon.png` era 3224×1292 stale (legado wide). Theme.SplashScreen Android 12+ aponta `windowSplashScreenAnimatedIcon=@drawable/splash_icon` esperando ícone quadrado 1:1 — sistema esticava 3224×1292 pra preencher safe zone 240dp causando aparência "comprida". Source `resources/splash_icon.png` JÁ ERA 1024×1024 quadrado correto (logo "doosy" peach centralizado, bg transparent). Pipeline `@capacitor/assets` NÃO regenera `drawable/splash_icon.png` — esse path requer cópia manual. **Fix:** `cp resources/splash_icon.png android/app/src/main/res/drawable/splash_icon.png`. Android 12+ Splash agora mostra ícone quadrado centralizado + bg color #FFF4EC (define em colors.xml `dosy_splash_bg`) escala perfeito em qualquer aspect ratio (incluindo S25 Ultra 1440×3120 2.17:1). Android <12 fallback usa `drawable/splash.png` legacy (CENTER_CROP fullscreen — pode ainda ter compromise visual em ultra-wide, mas só afeta devices Android 11 ou anterior).

- [x] **#106** [P0 BUG-034, fix completo v0.2.0.3 — REGRESSÃO IDENTIFICADA] **Ícone launcher + splash continuavam antigos.** Após reinstall em S25 Ultra v0.2.0.2, user reportou ícone azul/"doosy" wordmark + splash distorcido. **Causa raiz:** pasta `assets/` legacy com `icon-only.png` antigo (azul wordmark) + `icon.png` antigo TEM PRECEDÊNCIA sobre `resources/` no `@capacitor/assets generate` ("By default will check `assets` and `resources` directories, in that order"). Pipeline lia `assets/icon-only.png` antigo, ignorando `resources/icon-foreground.png` + `icon-background.png` peach corretos. **Fix v0.2.0.3:** (a) deletado `assets/` legado completo, (b) criado `resources/icon-only.png` composto (foreground sobre background) pra cap/assets ter source single, (c) deletado todos `mipmap-*/ic_launcher*.png` + `drawable-port-*/splash.png` + `drawable-land-*/splash.png` stale, (d) re-run `npx @capacitor/assets generate --android` → 86→61 outputs novos com source correto, (e) outputs validados visualmente: ic_launcher peach pill com gradient sunset, ic_launcher_foreground peach pill transparent, ic_launcher_background gradient sunset, splash full peach gradient com "doosy" wordmark center. P0 brand consistency.

- [x] **#106-old** [P0 BUG-034, partial fix v0.2.0.1 commit `1683f4f`] **Ícone launcher + splash não atualizam.** Removido legacy `drawable/ic_launcher_background.xml` template Capacitor (vector teal grid #26A69A) — adaptive XML referenciava `@mipmap/` correctly mas resolver podia escolher errado em algumas builds. User precisa: (a) `./gradlew clean` antes próximo bundleRelease, (b) uninstall+reinstall device pra invalidar launcher cache. Sintomas: emulador (debug build) + device físico (release build via Play Store) ambos mostram ícone azul antigo + splash recortado errado. Pipeline @capacitor/assets gerou 86 assets em mipmap-* + drawable-* (commit `e6c9423`), versionCode bumped 32, AAB rebuilt, mas Android renderiza recursos cached/legacy. Investigar: (a) **drawable/ic_launcher_background.xml** vetor template default Capacitor (teal grid #26A69A) ainda existe — pode estar overriding adaptive icon mipmap-anydpi-v26 reference, (b) **mipmap-anydpi-v26/ic_launcher.xml** confirmar referencia `@mipmap/ic_launcher_background` (PNG nas mipmap dirs) NÃO `@drawable/ic_launcher_background` (XML legacy), (c) **AndroidManifest.xml** `android:icon` + `android:roundIcon` attribute conferir aponta `@mipmap/ic_launcher` + `@mipmap/ic_launcher_round` (não @drawable), (d) **build.gradle release buildType minifyEnabled true + shrinkResources true** podem estar removendo PNGs novos não-referenciados — adicionar `proguard-rules.pro` keep `**.png` em mipmap, (e) **capacitor.config.ts SplashScreen.androidSplashResourceName='splash'** confirmar corresponde drawable/splash.png novo (não cached resource old name), (f) **Android Studio cache** Build → Clean + Invalidate Caches/Restart pode resolver dev local, (g) **device launcher cache** Pixel/Samsung launcher cacheia ícone — Force Stop app + Remove home + Re-add do drawer + reboot device, (h) **Play Store install cache** se versionCode 31 instalado primeiro, dispositivo pode reusar assets antigos mesmo após update versionCode 32 — clear app data ou uninstall+install. Próximo passo: AAB local + assembleRelease + APK direto via adb (bypassa Play Store) pra isolar variável Store cache. Se APK local também mostra ícone velho → bug build pipeline. Se APK local OK → bug Play Store cache. P0 brand consistency + trust pós-release.

- [x] **#103** [P1 BUG-032, fechado v0.2.0.1 commit `4a6e39c`] **UpdateBanner URL.** Apontava `dosy-teal.vercel.app` (preview antigo morto) → fetch 404 silent → available=false. Fix: usar `window.location.origin` runtime. UpdateBanner (componente sticky topo + handler `useAppUpdate`) parou de notificar user quando há nova versão Play Store. Esperado: app detecta `latest.version > current` (via `version.json` Vercel ou Play Store hook) → BellAlerts mostra alert "Atualizar pra v0.2.0.0" + UpdateBanner sticky. Atual: nenhum alerta aparece mesmo com nova versão publicada. Investigar: (a) `useAppUpdate` hook fetch `version.json` — endpoint `dosy-app.vercel.app/version.json` existe? Confere CORS + cache headers, (b) compare logic — pode estar comparando string lexicográfica (0.10.0 < 0.2.0.0), precisa semver compare, (c) BellAlerts `alerts` array recebe update entry (AppHeader.jsx linha 63), mas pode não disparar se `available=false`, (d) Capacitor App Update plugin (@capawesome/capacitor-app-update) também tem path nativo Play Store — verificar se inicializa, (e) talvez localStorage `dosy_update_dismissed_v{x}` flag persiste antiga e bloqueia. Fix pós debug. P1 trust (user não atualiza, fica vulnerável a bugs antigos).
- [x] **#104** [P2 UX, fechado v0.2.0.1 commit `8e093a0`] **Skeleton legacy slate → Dosy peach palette.** Card primitive bg-elevated + bg-sunken bars + dosy-shadow-xs. Componente `SkeletonList` (src/components/Skeleton.jsx ou similar) usado durante loading queries (Dashboard isLoading, DoseHistory, etc) renderiza retângulos com bg azul/slate (`bg-slate-200` ou shimmer azul) — não migrou pro Dosy design (peach + warm). Refazer: `bg-dosy-bg-sunken` (peach #FBE9DC) + shimmer warm `linear-gradient(90deg, transparent, rgba(255,200,180,0.4), transparent)`. Verificar todos lugares que renderizam skeleton (SkeletonList, possíveis inline). Match Dosy primitives. P2 visual consistency.
- [x] **#105** [P1 BUG-033, fechado v0.2.0.1 commit `65211cb`] **MultiDoseModal Dosy primitives.** Sheet + Card per dose + StatusPill kind + Buttons ghost/secondary/primary com Lucide icons. Quando user clica Ciente no AlarmActivity nativo, app abre via deep link `?doses=id1,id2,...` → Dashboard renderiza MultiDoseModal (src/components/MultiDoseModal.jsx) com fila de doses pra marcar Tomada/Pular/Ignorar. Modal continua com classes legacy (bg-slate-900, btn-primary brand blue, etc). Refactor pra Dosy primitives: Sheet primitive bottom slide + Card per dose (bg-elevated radius 16) + Status chips (Tomada/Pular/Ignorar) com cores Dosy (mint/amber/danger) + Button primary/secondary. Preservar lógica iteration queue. Verificar também DoseModal single-dose se já migrou. P1 UX consistency healthcare-flow (modal aparece em momento crítico pós-alarme).

- [x] **#102** [P1 UX, fechado v0.2.0.1 commit `f02bf12`] **Atalho hardware silenciar alarme.** AlarmActivity.onKeyDown override KEYCODE_VOLUME_UP/DOWN → toggleMute() + return true (consume). Comportamento padrão Android (Samsung GS25 Ultra confirmado): durante alarme nativo tocando, qualquer botão físico volume (up ou down) silencia ringtone instantaneamente sem dismiss. Atual AlarmActivity Dosy: botões volume só ajustam volume da stream USAGE_ALARM, não silenciam. Fix: override `onKeyDown(KeyEvent.KEYCODE_VOLUME_DOWN | KEYCODE_VOLUME_UP)` em AlarmActivity → chama `toggleMute()` (ou direct `AlarmService.ACTION_MUTE` intent) → return true (consume event). Visual: muteButton label sincroniza pra "🔇 Som off — tocar". User ainda precisa explicitamente Ciente/Adiar/Pular pra dismiss alarme inteiro — só som silencia. Bonus: KEYCODE_POWER curto também (mesmo padrão clock app stock), mas verificar se Android permite intercept (provável bloqueado pra screen-off action). P1 UX healthcare-adjacent (alarme acordando família).
- [x] **#101** [P0 cost/audit, fechado v0.2.0.1 commit pendente] **Auditoria egress Supabase pós-#092 — findings via pg_stat_statements + pg_replication_slots.**

  **Achados (2026-05-04):**
  - `pg_replication_slots`: 2 slots logical Realtime ativos (wal2json + pgoutput), lag 176 bytes — **saudável, não acumulando**.
  - `pg_stat_statements top calls`:
    - WAL polling Realtime: 265,400 calls, 1.24M ms total (esperado — pgoutput plugin tail). Não regredindo.
    - set_config (auth context per request): 3.3M calls (1 per HTTP req). Standard PostgREST RLS context.
    - INSERT doses bulk: 6 calls 1800 rows (300/call) = pg_cron `extend_continuous_treatments` OR `create_treatment_with_doses` RPC. Normal.
    - INSERT doses single: 1605 calls, 1605 rows. Normal user activity.
  - `pg_stat_user_tables medcontrol`: doses 597 rows / 1MB total · treatments 35 rows / 136kB · push_subs 13 rows / 120kB. Tudo dentro proporção esperada base teste pequena.
  - **Conclusão:** #092 fix manteve. Nenhum query patológico. Egress real (bytes saídos) só via Supabase Reports dashboard manualmente — não exposto SQL.

  **Próximas otimizações futuras (parqueadas, não urgentes):**
  - Realtime poll interval: bump 50ms → 200ms (config Supabase) trade latência +150ms por 4x menos polls. Aceptable healthcare.
  - Edge functions cold start audit (logs notify-doses + dose-trigger-handler).
  - Re-rodar audit quando usuários reais > 100 (atual ~5 testers — base small demais pra extrapolar).

- [ ] **#101-followup** [P2 cost] **Re-audit egress quando user base ≥100** — comparar baseline atual vs scaled, decidir se WAL poll bump é necessário.

 #092 (release v0.1.7.5) aplicou múltiplas reduções (Realtime filter server-side, listDoses range fail-safe, paginate cap, queryKey hour-normalized, refetchInterval 60s→5min, staleTime bumps). Faltou validação dashboard pós-deploy. Ação: (a) abrir Supabase Dashboard > Reports > Egress + Database queries, (b) comparar baseline pré-#092 (semana 28/04) vs pós-#092 (semana 04/05), (c) identificar top 5 endpoints/queries que ainda consomem mais egress, (d) verificar se Realtime filter `userId=eq.X` realmente aplicado server-side (não client-side), (e) checar listDoses chamadas com range `null` ainda existindo em algum caller, (f) revisar queryKey + invalidate frequency em produção via Sentry breadcrumbs ou PostHog events, (g) auditar Edge functions logs (notify-doses, dose-trigger-handler, schedule-alarms-fcm) por loops/retries, (h) decidir se precisa segundo round de otimização (ex: reduzir Realtime presence churn, batch FCM sends, edge function cold start). Output: relatório pós-mortem com gráfico antes/depois + nova lista de quick wins. P0 cost (egress > free tier = bill explode).

- [x] **#096** [BUG-028, fechado v0.2.0.1 commit `60d4422`] **Admin panel tier inconsistente.** listAllUsers agora aplica mesmo promo `free→plus` que getMyTier — admin panel sincroniza com client view. Inconsistência de tier display: `AjustesScreen` + `AppHeader` (TierBadge) leem tier via `useMyTier` (RPC `my_tier`/`effective_tier`) que retorna 'plus' (correto, beta_promo). Já `Admin.jsx` (painel /admin) provavelmente lista users via `admin_list_users` RPC sem aplicar promo `free → plus` map (ver `subscriptionService.getMyTier` — só promo no client). Resultado: dashboard admin mostra "free" mas client trata como plus. Fix: replicar map promo no client Admin OR mover promo pro server (effective_tier RPC retorna plus se beta_promo source). Plus: validar paywall não dispara para plus em todas as páginas (já fixed no #094 mount race, mas re-validar Admin user grant flow). P1 trust/UX.
- [x] **#094** [BUG-027, fechado v0.1.7.5 commit `8b32245`] **Paywall falso fires pra users plus/pro durante mount race**. Reportado user em validação dosy-dev: teste03@teste (tier plus DB) tentou cadastrar paciente novo → paywall "No plano grátis você pode ter até 1 paciente". Causa: (1) usePatientLimitReached retornava true quando tier=undefined durante loading; (2) getMyTier faz auth.getUser() race podendo resolver null e cachear 30min. Fix: useMyTier `enabled: !!user` via useAuth + queryKey inclui userId + usePatientLimitReached retorna false durante loading/null em vez de assumir free. P0 trust violation (user pago vê paywall).
- [x] **#093** [BUG-026, fechado v0.1.7.5 commit `557dcd9`] **Race condition em useRealtime: "cannot add postgres_changes callbacks after subscribe()"**. Fix aplicado: nome único `realtime:${userId}:${gen}:${Date.now()}` por subscribe + await `supabase.removeChannel()` (era fire-and-forget) + generation counter ignora callbacks de canais antigos durante reconnect. AbortError "Lock broken" continua WONTFIX (benigno cross-tab).
- [x] **#092** [BUG-025, fechado v0.1.7.5 commit `557dcd9`] **Egress reduction Supabase**. Multi-frente: (1) Realtime postgres_changes filter `userId=eq.X` server-side (era stream multi-tenant todas rows); (2) subscriptions removido do Realtime (admin-only writes raras); (3) listDoses default range fail-safe (-30d/+60d) — era pull histórico inteiro 5+ anos sem from/to (1.7MB / refetch); (4) listDoses paginate cap 20→5 pages; (5) useDoses queryKey timestamps normalizados pra hour boundary (evita refetch storm com `new Date()` inline); (6) useDoses refetchInterval 60s→5min, staleTime 30s→2min, refetchOnMount=always→true; (7) staleTime bump em useUserPrefs/usePatients/useTreatments/useMyTier; (8) App.jsx alarm reschedule scope -1d/+14d. Critical alarm path (dose-trigger-handler INSERT trigger + schedule-alarms-fcm cron 6h + notify-doses cron) NÃO regrediu. Validar via dashboard pós-deploy.
- [x] **#091** [BUG-024, fechado v0.1.7.4 commit pendente — CRÍTICO] **pg_cron extends contínuos com TZ UTC errado em firstDoseTime array.** User lhenrique.pda reportou Cortisol cadastrado 27/04 com horários 08:00+12:00 BRT — doses iniciais OK (11/15 UTC), mas doses futuras geradas pelo cron diário aparecem com horário 5h+9h BRT (08/12 UTC raw). Causa: `date_trunc('day', startDate) + make_interval(hours=>h)` produz UTC. Fix: combina date+time em America/Sao_Paulo, converte AT TIME ZONE pra UTC. 3 treatments afetados (Triiodotironina, Cortisol, Citrato Magnésio). Cleanup aplicado: DELETE pending futuras + reset doseHorizon NULL + regen via fn fixed. Validado doses 03/05 = 11/15/19 UTC = 8/12/16 BRT ✅. Migration `20260503025200_fix_extend_continuous_tz_bug.sql`. P0 healthcare-critical (user pode tomar dose hora errada).

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

> ⚠️ **Stale — reconciliação completa pendente.** Master rodou v0.2.0.0 → v0.2.0.6 enquanto §12 ficou paralisado em v0.1.7.5. Re-auditar contadores na próxima release.
>
> Fechados em v0.2.0.6: #010 (P1 BUG-005 ic_stat_dosy) + #017 (P1 LockScreen biometria) = 2 P1.

- **Total:** ~95 itens (numeração até #126 hoje)
- **Em aberto (CHECKLIST grep):** ~72 (74 antes da v0.2.0.6 - 2 P1 fechados)
- **P0:** 2 manuais user (#004 vídeo FGS + #006 device validation) + #025 screenshots + 2 dependentes (#007 PostHog, #009 PITR) — todos non-código. (#003 pwd postgres + #008 Sentry secrets fechados 2026-05-04.)
- **P1 novo:** #127 CI lint fix AnimatedRoutes.jsx (~30min código).
- **Esforço P0 restante:** ~3-5 dias manual user (zero código)
- **Wallclock até Open Testing pública:** ~5-6 semanas (Closed Testing 14 dias + ramp + estabilização)

---

🚀 **Próximo passo concreto:** v0.2.0.8 + v0.2.0.9 publicadas com bateria completa fixes egress (#127 + #134-#138 + #142 verify + #128 alarme bug). Validar redução agregada egress 24-72h via Supabase Reports. Esperado: pico diário 9.6GB → <1GB; cycle 26 mai - 26 jun = primeiro inteiro pós-fix. Pós-validação:
- Se confirmado <5GB/mês → considerar downgrade Free no fim do ciclo
- Se ainda alto → release v0.2.0.10 com P1 #139 (dose-trigger 6h horizon) + #140 (schedule-alarms 24h) + cleanup JWT cron hardcoded

Em paralelo: Closed Testing externo #129-#133 (Google Group + Reddit) destrava caminho Open Testing.
