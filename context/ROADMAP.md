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

> 🚨 **IA: SEMPRE varrer [`context/BUGS.md`](BUGS.md) ANTES desta seção.** ROADMAP cobre **features, melhorias e roadmap de lançamento**. Bugs ativos ficam em `BUGS.md` (numeração #0001+). Alertar user sobre bugs abertos no início de cada sessão (Passo 0 README), igual ao alerta de itens pendentes do `Validar.md`.

**Estado atual:** ver [`context/STATE.md`](STATE.md) — versão, branch, tag, ship date, P0 top 3, contas teste.

**Bugs abertos:** ver [`context/BUGS.md`](BUGS.md).

**Validações pendentes:** ver [`context/Validar.md`](Validar.md).

### Próximo passo proposto

Validar device físico Samsung S25 Ultra v0.2.3.11 (itens `[ ]` em `Validar.md`) OU iniciar próxima release atacando P0 aberto:

- **#006** Device validation 3 devices físicos (FASE 17 manual user)
- **#131** Recrutar 15-20 testers externos via Reddit/redes (meta 12+ ativos)
- **#132** Gate 14 dias × 12+ testers ativos *(depende #131)*
- **#133** Solicitar Production access Console *(depende #132)*
- **#191** Tela "Meu plano" Free/Plus/Pro com upgrade path
- **#192** Pagamento E2E sandbox — RevenueCat + Play Billing

### Releases recentes (top 3 — histórico completo em §6.3 + `context/updates/`)

- **v0.2.3.12** (2026-05-18, vc 75) — 7 fixes runtime stuck/silent (PTR, SOS, NB-4 throttle+persistImmediate, useUpdateUserPrefs, unshare, FCM await, useTreatments) + Bug #0009 descoberto
- **v0.2.3.11** (2026-05-18, vc 74) — 8 bug-fixes UX (#0001-#0008) + feature #299 in-app update DB autoritativa
- **v0.2.3.10** (2026-05-17, vc 73) — #295 alarme nome paciente + #296 P2R + #297 unshare LGPD

> **Bloqueadores formais Console** (todos ✅ 2026-05-04/05): ver §6.4 P0 items (#003 #004 #008 #025 + Política Privacidade + Intent tela cheia).
> **Refactor v0.2.3.1** (Plano A scheduler unificado + 4 auditorias linha-por-linha): ver §6.3 Δ entry + `context/auditoria/2026-05-13-alarme-push-*`.

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

### 6.3 Δ Release log (cronológico — mais recente primeiro)

> Detalhe completo de cada release em [`context/updates/`](updates/). Δ aqui = 1 linha + pointer.

- **Δ v0.2.3.12** (2026-05-18, vc 75) — 7 fixes runtime: PTR timeout 20s + SOS timeout 15s + NB-4 throttle revert 5s→1s + flushPersistImmediate em 4 críticos + useUpdateUserPrefs timeout 15s + unsharePatient timeout 15s + Bug #7 FCM await registration + NB-1 useTreatments refetchOnMount:'always'. Regra 17 RULES.md (Appium mandatory) + auditoria 10 bugs teóricos → 5 acionáveis comprovados QA Appium. Bug #0009 descoberto (defer v0.2.3.13).
- **Δ v0.2.3.11** (2026-05-18, vc 74) — 8 bugs UX (#0001-#0008 em BUGS.md) + #299 `app_releases` DB autoritativa → [updates/](updates/2026-05-18-release-v0.2.3.11.md)
- **Δ v0.2.3.10** (2026-05-17, vc 73) — #295 alarme nome paciente + #296 P2R + #297 unshare LGPD → [updates/](updates/2026-05-17-release-v0.2.3.10.md)
- **Δ v0.2.3.9** (2026-05-17, vc 72) — perf bundle round-2 (#288-#294 cache/render/hooks) → [updates/](updates/2026-05-17-release-v0.2.3.9.md)
- **Δ v0.2.3.8** (2026-05-17, vc 71) — #287 P0 killed caregiver alarm gap (FCM data-only HIGH) *(sem updates/)*
- **Δ v0.2.3.7** (2026-05-15/17, vc 70) — perf bundle low-risk (#272-#275) + server-side caregiver flow (#279-#284) → [updates/](updates/2026-05-17-release-v0.2.3.7.md)
- **Δ v0.2.3.6** (2026-05-15, vc 69) — #250 ANVISA autocomplete + 10 bug-fixes P1/P2 → [updates/](updates/2026-05-15-release-v0.2.3.6.md)
- **Δ v0.2.3.5** (2026-05-15, vc 68) — UI/UX redesign 5 telas + sistema gradiente unificado + #251 share Plus gating → [updates/](updates/2026-05-15-release-v0.2.3.5.md)
- **Δ v0.2.3.4** (2026-05-14, vc 67) — #163 RPC consolidado + #165 IndexedDB persist + #236 #237 BUG UX *(sem updates/)*
- **Δ v0.2.3.3** (2026-05-14, vc 66) — #231 AdMob safe-area + #232 ANR + #233 401 race + #074/#110 NDK + Sentry triage 15→3 *(sem updates/)*
- **Δ v0.2.3.2** (2026-05-14, vc 65) — #227-#230 bug-fixes device + CLI gradlew destravado (fix `context/recipes/gradle-build.md`) *(sem updates/)*
- **Δ v0.2.3.1** (2026-05-13, vc 64) — refactor Plano A scheduler unificado + 4 auditorias linha-por-linha (RC-1..RC-4) → [updates/](updates/2026-05-13-release-v0.2.3.1-refactor-plano-a.md)
- **Δ v0.2.3.0** (2026-05-13, vc 63) — refactor alarme+push (#215-#226 + 12 itens auditoria) → [updates/](updates/2026-05-13-release-v0.2.3.0-refactor-alarme-push.md)
- **Δ v0.2.2.4** (2026-05-13, vc 62) — #214 cleanup `dose_alarms_scheduled` órfã → [updates/](updates/2026-05-13-release-v0.2.2.4.md)
- **Δ v0.2.2.3** (2026-05-13, vc 61) — #213 storm root cause Dashboard setInterval → [updates/](updates/2026-05-13-release-v0.2.2.3.md)
- **Δ v0.2.2.2** (2026-05-13, vc 60) — #212 storm WATCHDOG + signature guard → [updates/](updates/2026-05-13-release-v0.2.2.2.md)
- **Δ v0.2.2.1** (2026-05-13, vc 59) — #211 hotfix storm rescheduleAll + throttle 30s → [updates/](updates/2026-05-13-release-v0.2.2.1.md)
- **Δ v0.2.2.0** (2026-05-13, vc 58) — #210 sistema auditoria alarmes admin `/alarm-audit` → [updates/](updates/2026-05-13-release-v0.2.2.0.md)
- **Δ v0.2.1.9** (2026-05-13, vc 57) — #209 P0 refactor alarmes+push + `daily-alarm-sync` cron 5am BRT → [updates/](updates/2026-05-13-release-v0.2.1.9.md)
- **Δ v0.2.1.8** (2026-05-11, vc 56) — #205 single source refresh token (storm xx:00 fix) + #204 expand fixes → [updates/](updates/2026-05-11-release-v0.2.1.8.md)
- **Δ v0.2.1.7** (2026-05-10, vc 55) — #204 mutation queue offline + #207 defesa profundidade alarme → [updates/](updates/2026-05-10-release-v0.2.1.7.md)
- **Δ v0.2.1.6** (2026-05-08, vc 54) — #203 som alarme customizado `dosy_alarm.mp3` → [updates/](updates/2026-05-08-release-v0.2.1.6-alarm-sound.md)
- **Δ v0.2.1.5** (2026-05-08, vc 52+53) — bugs alarme/logout #195-#202 + telemetria auth → [updates/](updates/2026-05-07-release-v0.2.1.5-alarm-logout-bugs.md)
- **Δ v0.2.1.4** (2026-05-07, docs-only) — refactor §6 + 27 NOVOS itens planejamento (#162-#189) → [updates/](updates/2026-05-07-release-v0.2.1.4-docs-planning.md)
- **Δ v0.2.1.3** (2026-05-07, vc 49-51) — pre-Reddit hardening (#018 #162 #170 #189 #190) → [updates/](updates/2026-05-07-release-v0.2.1.3-pre-reddit-hardening.md)
- **Δ v0.2.1.2** (2026-05-06, vc 48) — #158 Console fix + #160 PatientDetail refactor + #161 alerts dismiss *(sem updates/)*
- **Δ v0.2.1.1** (2026-05-06, vc 47) — #159 BUG-LOGOUT fix useAuth boot validation *(sem updates/)*
- **Δ v0.2.1.0** (2026-05-05, vc 46) — 12 itens + #157 storm useRealtime fix + #158 Console rejection *(sem updates/)*
- **Δ v0.2.0.12** (2026-05-05, vc 45) — #144 JWT claim tier + #152 ChangePassword + #153 OTP recovery → [updates/](updates/2026-05-05-release-v0.2.0.12-recovery-otp-smtp.md)
- **Δ v0.2.0.11** (2026-05-05, vc 44) — #144 backend (frontend ROLLBACK) + #145 #146 + #029 #030 #034 #100 refactors → [updates/](updates/2026-05-05-release-v0.2.0.11-batch-p2-structural.md)
- **Δ v0.2.0.10** (2026-05-05, vc 43) — #139-#143 P2 egress + #142 cleanup JWT cron → [updates/](updates/2026-05-05-release-v0.2.0.10-egress-p2-jwt-cleanup.md)
- **Δ v0.2.0.9** (2026-05-05, vc 42) — #137 Dashboard 4→1 query + #138 DOSE_COLS_LIST + #128 patientName Edge → [updates/](updates/2026-05-05-release-v0.2.0.9-egress-p1-alarm-fix.md)
- **Δ v0.2.0.8** (2026-05-05, vc 41) — auditoria egress + #134-#136 P0 + #127 CI lint + #004 vídeo FGS → [updates/](updates/2026-05-05-release-v0.2.0.8-egress-p0.md)
- **Δ v0.2.0.7** (2026-05-04, vc 40) — Dosy Dev FLAG_SECURE off + StatusBar tema → [updates/](updates/2026-05-04-release-v0.2.0.7-flag-secure-statusbar.md)
- **Δ v0.2.0.6** (2026-05-04, vc 39) — #010 ic_stat_dosy + #017 LockScreen biometria → [updates/](updates/2026-05-04-release-v0.2.0.6-icon-locker.md)
- **Δ v0.2.0.5** (2026-05-04, vc 38) — #126 gitleaks pre-commit + #024 husky reforçado → [updates/](updates/2026-05-04-release-v0.2.0.5.md)
- **Δ v0.2.0.4** (2026-05-04, vc 37) — #028 rate limit + #037 inline errors + #119-followup + #125 splash → [updates/](updates/2026-05-04-release-v0.2.0.4.md)
- **Δ v0.2.0.3** (2026-05-04, vc 36) — #033 React.memo + #040 contraste + #106 launcher fix + alertas + #122 #123 → [updates/](updates/2026-05-04-release-v0.2.0.3.md)
- **Δ v0.2.0.0-0.2** (2026-05-03) — redesign visual Dosy peach/sunset + primitives + 18 telas migradas *(turnaround visual — ver §6.7)*
- **Δ v0.1.7.5** (2026-05-03) — #092 egress reduction + #093 race useRealtime + #084 JWT migration → [updates/](updates/2026-05-03-release-v0.1.7.5.md)
- **Δ v0.1.7.4** (2026-05-03) — #012-#016 #088 #090 #091 TZ fix + #086 parqueado → [updates/](updates/2026-05-03-release-v0.1.7.4.md)
- **Δ v0.1.7.3** (2026-05-02) — #085 #087 ajustes user (Alarme Crítico + DND) → [updates/](updates/2026-05-02-release-v0.1.7.3.md)
- **Δ v0.1.7.2** (2026-05-02) — #083 FCM-driven scheduling 4 caminhos (BUG-016 fix) → [updates/](updates/2026-05-02-release-v0.1.7.2.md)
- **Δ v0.1.7.1** (2026-05-01) — #079-#082 defense-in-depth notif idle → [updates/](updates/2026-05-01-release-v0.1.7.1.md)
- **Δ v0.1.7.0** (2026-05-01) — #023 #075-#078 perf + UX → [updates/](updates/2026-05-01-release-v0.1.7.0.md)
- **Δ v0.1.6.10** (2026-05-01) — #001 #002 #005 security + encoding → [updates/](updates/2026-05-01-release-v0.1.6.10.md)

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

