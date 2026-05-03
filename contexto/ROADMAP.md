# Roadmap de Lançamento — Dosy

> **Documento de entrada.** Se você é um chat novo retomando o trabalho, comece aqui. Este arquivo é self-contained: tem contexto, estado atual, onde paramos, próximo passo, mapa dos demais arquivos e checklist macro completo.

---

## 1. Contexto rápido

**App:** Dosy — Controle de Medicação (PWA + Capacitor → Android final, package `com.dosyapp.dosy`).
**Versão atual:** `0.1.7.5` em desenvolvimento (branch `release/v0.1.7.5`) · master ainda em `0.1.7.4`.
**Vercel deploy:** `https://dosy-app.vercel.app/` rodando v0.1.7.4 (deploy v0.1.7.5 pendente). Conta de teste: `teste03@teste.com / 123456`.
**Stack:** React 19 + TanStack Query 5 + Supabase 2.45 + Vite 5 + Capacitor 8.3 + Firebase FCM + Sentry + PostHog. Tier promo Plus ativa.

**Estado atual de testing:**
- ✅ Internal Testing **live** (URL opt-in: `https://play.google.com/apps/internaltest/4700769831647466031` — 2 testers)
- 🔒 Closed Testing: bloqueado (precisa P0 #004 vídeo FGS + #025 screenshots + #006 device validation)
- 🔒 Open Testing / Produção pública: bloqueado até Closed Testing rodar 14 dias com 12+ testers

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

**Última release:** v0.1.7.4 publicada 2026-05-03 (Vercel + Play Store Internal Testing AAB versionCode 28 + tag git `v0.1.7.4`).
**Em desenvolvimento:** v0.1.7.5 (branch `release/v0.1.7.5`) — egress reduction + race fix coded, AAB/deploy pendentes.
**Última auditoria:** 2026-05-01 + auditoria-live-2026-05-01.

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

**Bloqueando avanço para Closed Testing (P0 manuais user):**
1. #003 Rotacionar senha postgres + revogar PAT + INFOS.md → vault (~30min)
2. #004 Vídeo demo `FOREGROUND_SERVICE_SPECIAL_USE` (~2-3h)
3. #006 Device validation 3 devices físicos (1-2 dias)
4. #008 Sentry GitHub Secrets (~15min)
5. #009 PITR + DR drill (depende upgrade Pro plan)
6. #007 Telemetria PostHog `notification_delivered` (depende #018)

---

## 4. Próximo passo imediato

**Próxima sessão dedicada — release v0.1.7.4 (hotfix security):**
- **#084** [P0 security] Rotacionar service_role JWT + JWT secret Supabase + reconectar Vercel↔GitHub (incidente 2026-05-02). Plano 8-fase em CHECKLIST §#084.
- **#087 Fase B** [opcional P1] Android nativo respeitar DND fire time.
- **#081 gate validação 24h** [opcional] em andamento, pode fechar antes ou junto.

Branch nova: `release/v0.1.7.4` (criar a partir de master atualizada quando começar sessão).

**Sequência sugerida (sessão dedicada):**
```
Pré-sessão: USER cadastra dose teste +24-30h em Vercel prod + FECHA Dosy Dev (gate #081 começa)
Hora 0-1: validação 24h pós v0.1.7.2 (Sentry, Play Console, dose_alarms_scheduled, logs Supabase JWT janela)
Hora 1-5: #085 alarme toggle bypass (refactor source-of-truth)
Hora 5-9: #087 DND UX condicional (reusa fix #085)
Hora 9-12: #086 resumo diário (paralelo possível)
Hora ~24: USER reporta se alarme da dose teste disparou no horário → fecha #081 gate
Hora final: #084 rotação JWT (último, requer redeploy tudo)
Cleanup + release v0.1.7.3
```

**P0 restantes (todos manuais user):**

| # | Tarefa | Esforço | Tipo |
|---|---|---|---|
| #003 | Rotacionar senha postgres + revogar PAT kids-paint + INFOS.md → vault | 30 min | manual user |
| #008 | Configurar `SENTRY_AUTH_TOKEN/ORG/PROJECT` em GitHub Secrets | 15 min | manual user |
| #004 | Gravar vídeo demo FGS YouTube unlisted | 2-3h | manual user |
| #006 | Device validation FASE 17 em 3 devices Android | 1-2 dias | manual user |
| #007 | Telemetria PostHog `notification_delivered` | 1-2h | depende #018 manual user |
| #009 | PITR + DR drill | 30min config + 2h drill | depende upgrade Pro plan |

**Próxima sessão de código (sugerida pós-#084):** atacar P1 batch — RLS policies refinement (#012 + #013), recriar RPC `extend_continuous_treatments` (#014), `<label>` Login (#011), `ic_stat_dosy` icon (#010), `useDoses` refactor (#023), `minimum_password_length` 6→8 (#019). Release `v0.1.8.0` minor.

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

**Total:** 73 itens · **P0:** 9 · **P1:** 18 · **P2:** 22 · **P3:** 24
**Origem:** [Plan.md] 38 · [Auditoria] 19 · [Plan.md + Auditoria] 16

### 🔴 P0 — Bloqueadores

#### Segurança server-side
- [x] **#001** [Auditoria] Admin auth check em `send-test-push` Edge Function. → [04 §7.2](auditoria/04-supabase.md#72-send-test-pushindexts-120-linhas--crítico) · [06 BUG-002](auditoria/06-bugs.md#bug-002--edge-function-send-test-push-não-valida-autorização-auditoria-estática) · [03 §#001](CHECKLIST.md#001--adicionar-auth-check-de-admin-em-send-test-push-edge-function)
- [x] **#002** [Auditoria] Sanitizar erro email enumeration. → [06 BUG-015](auditoria/06-bugs.md#bug-015--resposta-de-erro-user-not-found-em-send-test-push-permite-enumeration)
- [ ] **#003** [Plan + Auditoria] Rotacionar senha postgres + revogar PAT + INFOS.md → vault. → [archive/security-original.md](archive/security-original.md)

#### Bloqueador Play Console
- [ ] **#004** [Plan] Vídeo demo FOREGROUND_SERVICE_SPECIAL_USE YouTube unlisted. Plan FASE 18.9.1

#### Integridade dados
- [x] **#005** [Auditoria] Encoding UTF-8 quebrado em nome paciente. → [06 BUG-001](auditoria/06-bugs.md#bug-001--encoding-utf-8-quebrado-em-nome-de-paciente)

#### Validação manual
- [ ] **#006** [Plan + Auditoria] Device validation FASE 17 em 3 devices físicos. → `docs/device-validation-checklist.md`

#### Observabilidade healthcare crítica
- [ ] **#007** [Auditoria] Telemetria PostHog `notification_delivered` + alert queda. → [01 §14](auditoria/01-relatorio-completo.md#14--observabilidade-e-monitoramento--score-7510)

#### Setup CI / DR
- [ ] **#008** [Plan] GitHub Secrets `SENTRY_AUTH_TOKEN+ORG+PROJECT`. Plan FASE 10.1
- [ ] **#009** [Auditoria] PITR Supabase + drill restore + runbook DR. → [04 §11](auditoria/04-supabase.md#11-backups-e-pitr)

### 🟠 P1 — Alta Prioridade

#### Mobile / Android
- [ ] **#010** [Auditoria] Criar `ic_stat_dosy` notification icon. → [06 BUG-005](auditoria/06-bugs.md#bug-005--ic_stat_dosy-referenciado-mas-ausente-nos-drawables)
- [ ] **#017** [Plan] Wire LockScreen UI + biometria (`useAppLock`). Plan FASE 11.3 → 12 ou 23
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
- [ ] **#025** [Plan] Screenshots phone retrabalho 1080×1920. Plan FASE 18.9.2
- [ ] **#026** [Plan] Provisionar caixa real `suporte@dosyapp.com`. Plan FASE 18.5
- [ ] **#027** [Plan] Closed Testing track + 12 testers (14 dias). Plan FASE 18.9.3

#### Web (não-bloq Android)
- [ ] **#018** [Plan] AdSense IDs reais em `index.html`. Plan FASE 4.3 · [06 BUG-006](auditoria/06-bugs.md#bug-006--adsense-placeholder-em-produção-indexhtml)

#### Performance & custo
- [ ] **#023** [Auditoria] `useDoses` com `refetchIntervalInBackground: false` + `staleTime`. → [05 §4.4](auditoria/05-codigo.md#44-anti-patterns-encontrados)

#### DX
- [x] **#022** [Auditoria] Verificar legitimidade `typescript@^6.0.3`. → [06 BUG-007](auditoria/06-bugs.md#bug-007--typescript-declarado-como-603-no-packagejson)
- [x] **#024** [Auditoria] Pre-commit hook (husky + lint-staged). → [05 §6.3](auditoria/05-codigo.md#63-husky--pre-commit)

### 🟡 P2 — Média Prioridade (30 dias pós-launch)

- [ ] **#028** [Auditoria] Rate limit `delete-account`. → [06 BUG-003](auditoria/06-bugs.md#bug-003--edge-function-delete-account-sem-rate-limit-auditoria-estática)
- [ ] **#029** [Plan + Auditoria] Refatorar `Settings.jsx` (541 LOC). Plan FASE 15
- [ ] **#030** [Plan SECURITY + Auditoria] Refatorar `services/notifications.js` (588 LOC) em 4 módulos
- [ ] **#031** [Auditoria] Confirmar `FORCE_RLS` em todas tabelas. → [04 §15.6](auditoria/04-supabase.md#156-force_rls-em-todas-as-tabelas)
- [ ] **#032** [Auditoria] Confirmar `SET search_path` em todas SECURITY DEFINER. → [04 §15.3](auditoria/04-supabase.md#153-audit-de-security-definer--search_path)
- [ ] **#033** [Auditoria] React.memo em DoseCard, PatientCard, TreatmentCard
- [ ] **#034** [Plan] Virtualização DoseHistory + Patients (`@tanstack/react-virtual`). Plan FASE 13
- [ ] **#035** [Plan] Integration tests (`useDoses`, `useUserPrefs` mocks). Plan FASE 9.4
- [ ] **#036** [Plan] Skeleton screens completos. Plan FASE 15
- [ ] **#037** [Plan] Erros inline em forms. Plan FASE 15
- [ ] **#038** [Plan] Pen test interno completo documentado. Plan FASE 8.4 + 20.3
- [ ] **#039** [Plan] Confirmação dupla delete batch (>10). Plan FASE 15
- [ ] **#040** [Plan] Subir contraste textos secundários no dark. Plan FASE 15
- [ ] **#041** [Plan] Hierarquia headings + Dynamic Type via `rem`. Plan FASE 15
- [ ] **#042** [Plan] Lighthouse mobile ≥90 em Reports + Dashboard. Plan FASE 17
- [ ] **#043** [Plan] Performance scroll lista 200+ doses sem jank (já coberto por #034)
- [ ] **#044** [Plan] Auditar continuidade RPC `register_sos_dose` (drift schema)
- [ ] **#045** [Auditoria] Confirmar `coverage/` no `.gitignore`. → [06 BUG-010](auditoria/06-bugs.md#bug-010--coverage-versionado-no-repo-provável)
- [ ] **#046** [Plan] Documentar runbook DR. Plan FASE 23.4
- [ ] **#047** [Plan] Google Play Integrity API. Plan FASE 23 backlog
- [ ] **#048** [Auditoria] Remover `tools/supabase.exe` do git (se versionado)
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

#### DX / Observability
- [ ] **#074** [Sessão v0.1.6.10] Habilitar upload de debug symbols (`ndk.debugSymbolLevel = 'FULL'` em build.gradle). Aviso recorrente do Play Console em todo build. Melhora stack traces de crashes/ANRs.

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
- [ ] **#089** [BUG-022, reportado user 2026-05-02 emulador Pixel 7] **Layout: AdSense banner empurrando header parcial.** Print confirma: banner "Test Ad 468x60" ocupa topo da viewport, header "Dosy ▸ Frederico" fica abaixo do banner com texto "Dosy" parcialmente cortado/sobreposto. Tabs filtro (12h/24h/48h/7 dias/Tudo) e cards (Pendentes/Adesão/Atrasadas) renderizam OK abaixo. Visível em emulador Pixel 7 (1080×2400 @420dpi). **⚠️ NÃO repro em Samsung S25 Ultra device real** — fix DEVE preservar layout atual em devices modernos. Provável causa: posicionamento absoluto AdSense em `index.html` ou container CSS colidindo com `<header>` sem `padding-top` proporcional ao banner; viewport `<meta>` ou safe-area-inset comportamento diferente em Pixel 7. Verificar `index.html` (placement AdSense) + componentes header (`Layout.jsx`/`AppHeader.jsx`). Test cross-device obrigatório antes commit (Pixel 7 emul + S25 Ultra real + tablet baseline). P2 UX visual.
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
**Total:** 73 itens · **P0:** 9 → 8 · **P1:** 18 · **P2:** 22 · **P3:** 24
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

- **Total:** 93 itens
- **Em aberto:** 62 (-2 fechados em v0.1.7.5: #092 + #093). Ainda: 3 v0.1.6.10; 5 v0.1.7.0; 4 v0.1.7.1; 1 v0.1.7.2; 2 v0.1.7.3; 14 v0.1.7.4; #084+#087FaseB v0.1.7.5; #089 v0.1.8.0
- **P0:** 5 (4 manuais user + #084 security) · **P1:** 11 · **P2:** 21 · **P3:** 25
- **Esforço P0 restante:** ~3-5 dias manual user + ~1-2 dias código (#079/#080 release v0.1.8.0)
- **Esforço P0+P1:** ~15-20 dias-pessoa
- **Wallclock até Produção pública:** ~6 semanas (inclui 14 dias passivos Closed Testing)

---

🚀 **Próximo passo concreto:** abrir [CHECKLIST.md §#001](CHECKLIST.md#001--adicionar-auth-check-de-admin-em-send-test-push-edge-function) e fechar item #001 (`send-test-push` admin check, 30 min).
