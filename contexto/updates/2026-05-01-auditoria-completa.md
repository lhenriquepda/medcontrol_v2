# Auditoria completa pré-lançamento + reorganização do contexto — 2026-05-01

> **Sessão:** ~14:00 - 17:00 BRT · **Agente:** Claude Opus 4.7 · **Versão app:** 0.1.6.9 @ commit 5bb9d36

---

## 🎯 Objetivo da sessão

Usuário solicitou auditoria completa de pré-lançamento multidisciplinar (engenharia mobile, backend, security, UX, LGPD, FinOps) cobrindo 25 dimensões + Plan.md ↔ realidade. Após auditoria, reestruturação da pasta de outputs como pasta-mãe de contexto do projeto.

---

## ✅ O que foi feito

### Auditoria

- Reconhecimento completo do repo (`Plan.md` 1055 linhas, `SECURITY.md`, `RoadMap.md`, `Plan_Suggestions.md`, `Contexto.md`).
- Análise estática de:
  - **Supabase:** 9 migrations, 11 tabelas, edge functions (`delete-account`, `notify-doses`, `send-test-push`), RPCs SECURITY DEFINER, triggers cross-FK.
  - **Frontend:** 12.133 LOC em 95 arquivos `.js/.jsx`, hooks TanStack Query, services, components. God-components identificados (Settings 541, Reports 436, Dashboard 382, notifications.js 588).
  - **Android/Capacitor:** AndroidManifest, `build.gradle`, `proguard-rules.pro`, `network_security_config.xml`, `data_extraction_rules.xml`, plugin nativo `CriticalAlarm` (6 arquivos Java).
  - **Code quality:** 35 prod + 22 dev deps, lint 0 errors / 49 warnings, 6 unit tests (66/66 pass), CI pipeline.
- Live nav ~15min via Claude in Chrome com `teste03@teste.com`:
  - Confirmou v0.1.6.9 espelhada Vercel ↔ código.
  - Validou login, dashboard, pacientes, settings, histórico, mais.
  - Descobriu BUG-001 (encoding UTF-8 quebrado em nome paciente).
  - Zero console errors detectados.
- 4 subagents paralelos para deep-dives (Supabase, frontend, Android, code quality).

### Artefatos gerados (`contexto/`)

- `README.md` — entry point com regras de manutenção
- `PROJETO.md` — Contexto.md migrado da raiz
- `ROADMAP.md` — checklist macro 73 itens com workflow
- `CHECKLIST.md` — detalhe item-a-item com snippets
- `auditoria/01-relatorio-completo.md` — 25 dimensões
- `auditoria/02-resumo-executivo.md` — brief 2-3 páginas
- `auditoria/04-supabase.md` — DB, RLS, edge fns, custos
- `auditoria/05-codigo.md` — TanStack Query anti-patterns, deps, dead code
- `auditoria/06-bugs.md` — 15 bugs catalogados
- `auditoria/07-usabilidade.md` — diário live nav + friction log + personas
- `auditoria/08-limitacoes-web.md` — itens [WEB-ONLY] (informativo)
- `decisoes/README.md` — template + howto
- `updates/README.md` — template + howto
- `updates/2026-05-01-auditoria-completa.md` — este arquivo
- `archive/` — cópias de Plan.md, Plan_Suggestions.md, RoadMap.md, SECURITY.md, Contexto.md, prompt-auditoria-v2.md

### Mudanças no repo raiz

- Deletados (cópias preservadas em `contexto/archive/`):
  - `Plan.md`, `Plan_Suggestions.md`, `RoadMap.md`, `SECURITY.md`
- Movido pra `contexto/PROJETO.md`:
  - `Contexto.md`
- Pasta criada: `contexto/` (renomeada de inicialmente `analise/`).

### Estrutura final

```
contexto/
├── README.md
├── PROJETO.md
├── ROADMAP.md
├── CHECKLIST.md
├── auditoria/
├── decisoes/
├── updates/
└── archive/
```

---

## 📦 Itens do ROADMAP fechados

Nenhum item de implementação fechado nesta sessão — auditoria é geração de roadmap, não execução. **73 itens novos catalogados** no ROADMAP/CHECKLIST.

---

## 🐛 Bugs novos descobertos

15 bugs catalogados em `auditoria/06-bugs.md`:

- **BUG-001 [AMBOS] P2** — Encoding UTF-8 quebrado em nome paciente ("Jo�o Teste")
- **BUG-002 [AMBOS] P0** — Edge fn `send-test-push` sem auth admin (vetor ativo)
- **BUG-003 [AMBOS] P2** — `delete-account` sem rate limit
- **BUG-004 [AMBOS] P2** — RPC `extend_continuous_treatments` sumiu do schema
- **BUG-005 [ANDROID] P1** — `ic_stat_dosy` ausente em drawables
- **BUG-006 [WEB-ONLY] P1/P3** — AdSense placeholder em produção
- **BUG-007 [AMBOS] P3** — TS 6.0.3 — verificar legitimidade
- **BUG-008 [AMBOS] P2** — `minimum_password_length=6` em config.toml
- **BUG-009 [AMBOS] P3** — `enable_confirmations=false` apenas local
- **BUG-010 [AMBOS] P3** — `coverage/` versionado?
- **BUG-011 [ANDROID] P1** — AdMob test ID — possivelmente já OK (verificar)
- **BUG-012 [AMBOS] P1** — INFOS.md no disco com secrets
- **BUG-013 [AMBOS] P0** — Senha postgres histórica vazada (manual)
- **BUG-014 [ANDROID] P3** — Sem REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (justificável)
- **BUG-015 [AMBOS] P0** — Email enumeration em `send-test-push`

---

## 🧠 Decisões tomadas

Nenhuma ADR criada nesta sessão. Algumas decisões registradas inline:

- **Estrutura `contexto/` em vez de `analise/`** — pasta-mãe de contexto vivo do projeto, não snapshot de auditoria.
- **`auditoria/` como subpasta histórica imutável** — snapshot 2026-05-01. Re-auditoria futura cria nova pasta `auditoria-YYYY-MM-DD/`.
- **`Contexto.md` movido pra `contexto/PROJETO.md`** — alinha nomenclatura e centraliza onboarding técnico.
- **Cópias em `archive/` preservam originais** — `git rm` apenas dos arquivos da raiz; cópias intactas.

---

## 📁 Arquivos da pasta `contexto/` atualizados

Toda a estrutura foi criada nesta sessão. Arquivos relevantes:

- `README.md` — entry point + regras manutenção
- `PROJETO.md` — Contexto.md migrado (sem alteração de conteúdo, apenas movido)
- `ROADMAP.md` — gerado novo
- `CHECKLIST.md` — gerado novo
- `auditoria/*` — todos novos
- `decisoes/README.md` — template novo
- `updates/README.md` — template novo

---

## 🚧 Estado deixado pra próxima sessão

**Próximo passo concreto:** [`CHECKLIST.md` §#001](../CHECKLIST.md#001--adicionar-auth-check-de-admin-em-send-test-push-edge-function) — adicionar admin auth check em `send-test-push` Edge Function (30 min).

**Sequência Sem 1 recomendada:**
1. #001 send-test-push admin (30 min) — *começar aqui*
2. #002 sanitizar erro enumeration (5 min, parte de #001)
3. #003 rotacionar senha postgres + revogar PAT + INFOS.md → vault (30 min manual)
4. #005 investigar BUG-001 encoding UTF-8 (1-3h SQL + verificação UI)
5. #008 GitHub Secrets Sentry (15 min)
6. #007 telemetria PostHog `notification_delivered` (1-2h)
7. #004 vídeo demo FGS (2-3h)
8. #006 device validation FASE 17 em 3 devices (1-2 dias)

**Bloqueadores externos / dependentes do user:**
- #003 — rotação manual senha (precisa user logado em Supabase Dashboard)
- #004 — gravação de vídeo (precisa user com device físico)
- #006 — device validation (precisa user com 3 devices físicos)
- #021 — keystore backup 3 locais (manual)
- #025 — screenshots phone retrabalho (precisa designer ou user)
- #027 — Closed Testing track + Reddit posts (manual)

**Não-commitado ainda:**
- 4 deletions de raiz staged (`git rm Plan.md Plan_Suggestions.md RoadMap.md SECURITY.md`)
- `Contexto.md` deletion staged (movido pra PROJETO.md)
- `contexto/` untracked (precisa `git add contexto/`)

**Sugestão de commit:**
```
docs: cria pasta contexto/ + auditoria completa pré-lançamento

Reestrutura docs/roadmap em contexto/ (entry point para agentes).
Audita 25 dimensões, mapeia 73 itens (P0/P1/P2/P3), descobre 15 bugs.

- contexto/README.md: entry + regras manutenção
- contexto/PROJETO.md: migrado de Contexto.md raiz
- contexto/ROADMAP.md: roadmap consolidado pós-auditoria
- contexto/CHECKLIST.md: detalhe item-a-item com snippets
- contexto/auditoria/: 7 docs cobrindo todas as dimensões
- contexto/decisoes/, updates/: templates e logs
- contexto/archive/: cópias de Plan.md, SECURITY.md, RoadMap.md, etc
- Remove originais da raiz (preservados em archive/)
```

---

## 💬 Notas livres

- **Live nav curta** — usuário forneceu credenciais tarde no fluxo. Sessão profunda 90min em device físico fica pra FASE 17 manual.
- **`remote_schema.sql` vazio** — schema real só em produção. Recomenda-se `supabase db pull` (precisa Docker).
- **TS 6.0.3 instalado** confirma installed via `node -e`. Não validei se é typosquat — recomendo `npm view typescript@6.0.3 maintainers` em sessão futura.
- **AdMob app ID** — SECURITY.md menciona test ID, mas manifest atual tem `ca-app-pub-2350865861527931~5445284437` (prod). Discrepância documentada como BUG-011 "verificar".
- **Tier promo Plus** — `getMyTier()` em `subscriptionService.js` converte free→plus automaticamente. **REVERTER ANTES DO LANÇAMENTO PRODUÇÃO** (Plan.md FASE 16).

---

## 📊 Métricas

- Commits criados nesta sessão: 0 (auditoria não-commitada ainda)
- LOC adicionadas (docs): ~7.300 linhas em 13 arquivos novos
- Tempo de sessão: ~3h
- Subagents paralelos usados: 4 (Supabase, frontend, Android, code quality)
- Tokens consumidos: ~não-tracked
- Versão auditada: 0.1.6.9 @ 5bb9d36
