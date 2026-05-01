# Logs de Sessão (`updates/`)

> Cada sessão de trabalho substantiva gera um arquivo aqui. Histórico cronológico do projeto.

---

## Para que serve

Quando uma sessão termina (auditoria, fix de bug, nova feature, refactor, etc.), o agente cria um log aqui. Isto permite que:

- O próximo agente entenda o que mudou recentemente sem ler todos os commits.
- Stakeholders vejam progresso por sessão (não por commit individual).
- Decisões e contexto de "por que" não fiquem perdidos só em PR descriptions.

---

## Formato de nome

```
YYYY-MM-DD-acao-curta.md
```

Exemplos:
- `2026-05-01-auditoria-completa.md`
- `2026-05-15-fix-send-test-push-auth.md`
- `2026-05-22-refactor-settings-component.md`
- `2026-06-01-feature-medication-stock.md`

Se múltiplas sessões no mesmo dia: sufixo `-N`:
- `2026-05-15-fix-encoding-utf8-1.md`
- `2026-05-15-fix-encoding-utf8-2.md`

---

## Template

Copie e preencha:

```markdown
# {{Título Curto}} — {{YYYY-MM-DD}}

> **Sessão:** {{início HH:MM - fim HH:MM}} · **Agente:** {{Claude / Cursor / nome}} · **Versão app:** {{X.Y.Z}}

---

## 🎯 Objetivo da sessão

{{1-3 frases descrevendo o que o usuário pediu}}

## ✅ O que foi feito

- {{Lista de ações concretas}}
- {{Arquivos criados/editados/deletados}}
- {{Comandos rodados}}

## 📦 Itens do ROADMAP fechados

- [x] **#XXX** {{título do item}} — {{breve nota de aceitação}}

## 🐛 Bugs novos descobertos

- **BUG-NNN** {{nome}} — adicionado a `auditoria/06-bugs.md` ou `ROADMAP.md` §XXX

## 🧠 Decisões tomadas

- {{Decisão importante}} → ADR em `decisoes/{data}-{NNN}-{titulo}.md`
- {{Decisão menor}} (não justifica ADR) — registro aqui

## 📁 Arquivos da pasta `contexto/` atualizados

- `ROADMAP.md` — atualizado §X (contadores, novo próximo passo)
- `PROJETO.md` — atualizado §Y (nova tabela DB / plugin / convenção)
- `decisoes/{...}.md` — criada
- {{etc}}

## 🚧 Estado deixado pra próxima sessão

- {{O que está em progresso e ainda não fechado}}
- {{Bloqueadores externos esperando dev humano}}
- {{Próximo passo recomendado}}

## 💬 Notas livres

- {{Algo que não cabe nas seções acima mas é importante registrar}}
- {{Surpresas, gotchas, ressalvas}}

## 📊 Métricas (opcional)

- Commits criados: N
- LOC adicionadas/removidas: +X / -Y
- Tempo de sessão: ~Z h
- Custo aprox tokens: ~K
```

---

## Padrões de qualidade

- **Concisão:** ideal 1-2 páginas por sessão. Não escrever romance.
- **Verbos no passado:** "fechou item #001", "descobriu bug X".
- **Commits referenciados:** se possível, listar SHAs curtos (`git log --oneline`).
- **Sem PII:** nunca colar senhas, tokens, ou dados de paciente real.
- **Decisões importantes vão pra ADR**, não pra log. Logs apenas referenciam.

---

## Quando NÃO criar log

- Sessão exclusivamente exploratória sem mudanças (só leu código, respondeu pergunta).
- Trabalho de < 30 min com 1-2 commits triviais (lint fix, typo). Ainda assim, atualize ROADMAP se houve item fechado.

---

## Gates obrigatórios antes de marcar item concluído

Ver também `../README.md §"Workflow operacional padrão"`.

| Gate | Quando | Comando | Critério |
|---|---|---|---|
| **Lint** | Sempre, antes de commit | `npm run lint` | 0 errors (warnings ≤ max-warnings configurado) |
| **Test** | Item afeta lógica testada (utils/services/hooks) | `npm test` | 100% pass |
| **Build local** | Mudou config/deps/build | `npm run build` | Sem erro |
| **Cap sync** | Mudou plugin Capacitor / código nativo | `npm run cap:sync` ou `npm run build:android` | Sem erro |
| **Aceitação manual** | Sempre | (manual) | Critério de aceitação do `CHECKLIST.md §#XXX` validado |

Pre-commit hooks (husky + lint-staged) ainda não configurados — item #024 do ROADMAP. Até lá, gates manuais.

### Após gates passarem, fechar item em DOIS arquivos

Itens não fecham em ROADMAP apenas — **ambos** ROADMAP + CHECKLIST devem ser atualizados. Ver `../README.md §"Regra 1"` para detalhe.

Resumo:
- `ROADMAP.md §6`: marcar `[x]`
- `ROADMAP.md §12`: decrementar contador
- `CHECKLIST.md §#XXX`: `Status: ✅ Concluído @ commit {sha-curto} ({YYYY-MM-DD})`

**Validação cross-file:**
```bash
grep -c "Status:.*⏳ Aberto\|Status:.*🟡 Em progresso\|Status:.*⏸️ Bloqueado" contexto/CHECKLIST.md
```
Deve igualar P0+P1+P2+P3 abertos do ROADMAP §12.

---

## Convenções de commit (referência rápida)

Detalhe completo em `../README.md §"Workflow operacional padrão"`. Resumo:

```
{type}({version}): {sumário ≤72 chars}

{detalhe opcional}

Fecha #XXX #YYY do contexto/ROADMAP.md.
```

**Types:** `feat` `fix` `security` `chore` `docs` `refactor` `test` `perf` `ci`

---

## Como o agente novo usa

Ao iniciar trabalho:
```
ls contexto/updates/ | tail -5
```
→ leia os 2-3 últimos pra entender mudanças recentes antes de começar.

Ao finalizar:
1. Cria entry novo (template acima)
2. Garante que ROADMAP foi atualizado (Regra 1 do README)
3. Commit referenciando itens fechados
