# 🛑 Dosy — Entry Point Obrigatório

> **IA nova recebendo este projeto:** siga os 5 passos abaixo SEM PULAR. Pare no Passo 5 e espere comando do user antes de tocar código.
> Histórico completo (fluxo anterior) → [`context/README_legacy.md`](README_legacy.md)

---

## 📑 Índice — Fluxo de trabalho

### 🟡 Passos de Entrada (toda sessão)

| Passo | O que fazer | Quando |
|---|---|---|
| [0](#-passo-0--varrer-validarmd--bugsmd) | Varrer `Validar.md` + `BUGS.md` — alertar pendências/bugs abertos | Sempre |
| [1](#-passo-1--carregar-contexto-3-reads-paralelos) | 3 reads paralelos: `STATE.md` + `PROJETO.md` + `ROADMAP.md §3` | Sempre |
| [2](#-passo-2--estado-git) | `git status` + `git log -5` | Sempre |
| [3](#-passo-3--rulesmd-obrigatório--não-pular) | **`Read context/RULES.md`** — 15 regras NUNCA quebrar | 🛑 OBRIGATÓRIO |
| [4](#-passo-4--memória-durável-auto-injetada) | Memória auto-injetada — confirmar prioridades 🔴 | Auto |
| [5](#-passo-5--stop-reportar-ao-user) | **STOP** — reportar versão, P0s, próximo passo | Esperar OK |
| [5b](#passo-5b) | Classificar trabalho proposto | → `context/WORKFLOW.md` |

### 🔧 Passos de Fechamento (após codar)

→ **`context/WORKFLOW.md`** Passos 6-14

### 📚 Referência rápida

| Precisa de | Arquivo |
|---|---|
| Estado atual (versão, branch, P0s, contas teste) | `context/STATE.md` |
| 15 regras nunca quebrar | `context/RULES.md` |
| Fluxo fechamento passo-a-passo (Passos 6-14) | `context/WORKFLOW.md` |
| Play Console upload AAB via Chrome MCP | `context/recipes/play-console-upload.md` |
| Build AAB via gradlew CLI | `context/recipes/gradle-build.md` |
| Setup emulator + ADB + validação autônoma | `context/recipes/emulator-setup.md` |
| Validação web via Chrome MCP | `context/recipes/web-validation.md` |
| Stack, DB, schema, convenções, gating | `context/PROJETO.md` |
| Roadmap macro + itens abertos | `context/ROADMAP.md` |
| Detalhe técnico por item `#XXX` | `context/CHECKLIST.md` |
| Bugs abertos (P0-P4) | `context/BUGS.md` |
| Validações device pendentes | `context/Validar.md` |
| Mapa funcional do app (páginas, flows) | `context/APP.md` |
| ADRs / decisões arquitetura | `context/decisoes/` |
| Updates cronológicos por release | `context/updates/` |
| Auditoria técnica (DB, frontend, UX) | `context/auditoria/` |

---

## 🚨 PASSO 0 — Varrer `Validar.md` + `BUGS.md`

Abrir **em paralelo**:
1. [`context/Validar.md`](Validar.md) — contar checkboxes `[ ]` na seção topo (release mais recente)
2. [`context/BUGS.md`](BUGS.md) — contar bugs por prioridade nas seções P0-P4 (acima do "📦 Histórico")

**Se houver `[ ]` em Validar.md OU bugs abertos em BUGS.md:**

> ⚠️ **Alertar user no início da resposta:**
> *"Antes de começarmos: N validações pendentes em `Validar.md` + M bugs abertos em `BUGS.md`. Quer atacar antes, ou acumular?"*
>
> - Listar até 3 validações pendentes resumidas
> - Listar até 3 bugs por prioridade (P0 > P4): `#0003 P2 — descrição curta`

**Se ambos limpos:** prosseguir Passo 1 sem alerta.

> User decide se valida/ataca agora, posterga ou pula. **IA não decide por ele — só alerta.**

---

## ⚡ PASSO 1 — Carregar contexto (3 reads paralelos)

```
Read context/STATE.md               — versão atual, branch, P0 top 3, contas teste
Read context/PROJETO.md (limit 200) — stack, DB, convenções, gating Free/Plus/Pro/Admin
Read context/ROADMAP.md (offset 150, limit 50) — §3 "Onde paramos"
```

---

## ⚡ PASSO 2 — Estado git

```bash
git status
git log --oneline -5
```

Identificar: branch ativa, commits ahead origin, working tree clean ou dirty.
**Se ROADMAP §3 contradisser `git` → fonte da verdade é o git.**

---

## ⚡ PASSO 3 — RULES.md (obrigatório — NÃO pular)

> 🛑 **Este Read é mandatório.** Sem ele a sessão pode violar regra crítica silenciosamente (Chrome MCP, egress, git add -A, conta pessoal, etc).

```
Read context/RULES.md
```

Internalizar antes de avançar. As 15 regras estão em RULES.md (não repetidas aqui).

---

## ⚡ PASSO 4 — Memória durável (auto-injetada)

Auto-injetada via MEMORY.md no system prompt de cada sessão. Confirmar prioridades:

| Prioridade | Memory file | Quando importa |
|---|---|---|
| 🔴 | `feedback_chrome_automation` | Build/upload Play Console / Vercel / Supabase admin |
| 🔴 | `feedback_egress_priority` | Mudança em fetch / persist / realtime / cron |
| 🔴 | `flow_session_lifecycle` | Lifecycle session / pré-release / pós-merge |
| 🟡 | `feedback_versioning` | Bump versão (sempre último dígito) |
| 🟡 | `feedback_caveman_user_facing` | Docs / dashboards / posts / copy / e-mails |
| 🟡 | `feedback_ptbr_only` | UI admin, dashboards, docs |

---

## ⚡ PASSO 5 — STOP. Reportar ao user.

**Antes de tocar código**, reportar em até 5 bullets (dados de STATE.md + git):

- **Versão atual:** master @ vX.Y.Z (vc N) · branch ativa: `master` ou `release/vX.Y.Z+1`
- **Último item fechado:** #XXX — descrição curta + commit hash
- **P0 abertos top 3:** de `context/STATE.md`
- **Próximo passo proposto**
- **Pergunta:** OK seguir essa direção? Ou outra prioridade?

**🛑 ESPERAR comando explícito do user. NÃO COMEÇAR a codar.**

> Quando user retornar com diretiva → ativar **Passo 5b** OBRIGATÓRIO antes de qualquer ação.

<a name="passo-5b"></a>

*Passo 5b (classificação de trabalho) e Passos 6-14 (fechamento) → [`context/WORKFLOW.md`](WORKFLOW.md)*
