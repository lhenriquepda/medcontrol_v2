# Refactor §6 ROADMAP em 4 categorias visuais — release/v0.2.1.4 (docs-only)

**Data:** 2026-05-06
**Branch:** `release/v0.2.1.4`
**Tipo:** docs-only (sem código)
**Esforço:** ~1.5h

---

## O que foi feito

### Refactor §6 ROADMAP — 4 categorias × 4 prioridades

User feedback: §6 estava "embolado" — difícil entender o que falta vs o que foi feito vs onde cada item se encaixa. Solução proposta + aprovada:

**Categorias** (cada item pertence a 1):
- 🚀 **IMPLEMENTAÇÃO** — caminho launch Play Store (compliance Console + recrutamento testers + Production gate)
- ✨ **MELHORIAS** — incrementais visuais/UX/perf não-bloqueadoras
- 🐛 **BUGS** — correções de bug específicos (Sentry, user-reported, audit findings)
- 🔄 **TURNAROUND** — mudanças drásticas (redesign visual, pivot Negócio, schema breaking change)

**Bolinhas prioridade** (visual rápido):
- 🔴 P0 bloqueador
- 🟠 P1 alta
- 🟡 P2 média
- 🟢 P3 baixa

**Status emojis** substituem `[x]`/`[ ]`:
- ✅ fechado · 🚧 em progresso · ⏳ aberto · 🚨 BLOQUEADO Google · ⏸️ bloqueado dep · 🚫 cancelado · ⏭️ parqueado

### Estrutura nova §6

```
§6 Itens (catálogo)
  §6.1 📍 Legenda
  §6.2 📊 Counter (sub-counter por categoria × prioridade)
  §6.3 Δ Release log (cronológico — preservado histórico)
  §6.4 🚀 IMPLEMENTAÇÃO (P0 + P1 + P2 + P3)
  §6.5 ✨ MELHORIAS (P2 + P3)
  §6.6 🐛 BUGS (P2)
  §6.7 🔄 TURNAROUND (vazio — última foi REDESIGN v0.2.0.0)
  §6.8 📚 Items fechados — referência cronológica (114 itens agrupados por release)
```

### Counter nova v0.2.1.4

**Total:** 162 itens · 114 fechados · 44 abertos · 2 BLOQUEADOS Google review

| Categoria | 🔴 P0 | 🟠 P1 | 🟡 P2 | 🟢 P3 | Total abertos |
|---|---|---|---|---|---|
| 🚀 IMPLEMENTAÇÃO | 5 (2 🚨) | 2 | 2 | 0 | 9 |
| ✨ MELHORIAS | 0 | 0 | 6 | 24 | 30 |
| 🐛 BUGS | 0 | 0 | 3 | 0 | 3 |
| 🔄 TURNAROUND | 0 | 0 | 0 | 0 | 0 |
| **Total** | **5** | **2** | **11** | **24** | **42** |

### Item novo descoberto: #162

**Mounjaro UX warning** entrou no §6 v0.2.1.2 sem numeração (era data fix SQL operacional). User feedback:
> "Mounjaro data fix entrou no ROADMAP abaixo no cap. de Egress e sem numeração, nao faz sentido"

Resolução:
- Removido "Mounjaro data fix" do §6 catalog (era operacional SQL, sem código)
- Movido pra §6.8 release log v0.2.1.2 como entry sem numeração mas contextualizada
- Criado **#162** novo BUG categoria 🐛 P2 — TreatmentForm UX warning intervalHours/24 > durationDays
  - Previne repro Mounjaro silent fail
  - 2 opções de fix (warning inline 30min vs refactor "Número de doses" 1-2h)
  - Detalhe completo CHECKLIST §#162

### README.md adequação Regra 1

Atualizada Regra 1 + sub-seções pra refletir nova estrutura:

1. **§"Princípio canônico"** — tabela ROADMAP §6 menciona "4 categorias com sub-prioridade P0/P1/P2/P3"
2. **§"Estrutura §6 ROADMAP"** — nova subseção explicando categorias + bolinhas + status
3. **§"Workflow obrigatório por item"**:
   - "Ao FECHAR" agora move pra §6.8 + decrementa sub-counter §6.2 + adiciona Δ release log §6.3
   - "Ao DESCOBRIR" agora exige decidir categoria + adicionar em sub-seção certa + incrementar sub-counter
   - Template CHECKLIST agora tem campo `**Categoria:**`
4. **§"Validação consistência"** — comandos grep adaptados pra novo formato (✅/⏳/🚨 emojis ao invés `[x]/[ ]`)
5. **§"Geração de novos itens — feature nova"** passo 5: menciona categoria + sub-seção §6.4-§6.7
6. **§"Geração de novos itens — auditoria"** passo 4: BUGS sempre vão §6.6
7. **§"Bug isolado"** passo 3: BUGS sempre vão §6.6 categoria 🐛

### ROADMAP.md Regra de manutenção (header §🛠️) também atualizada

Mesma adequação: tabela menciona categorias, workflow descreve sub-seções, lista de categorias + bolinhas + status no início.

### §3 "Onde paramos" + §12 "Resumo numérico" atualizados

- §3 — adicionado "Branch ativa: `release/v0.2.1.4` (refactor docs §6 + #162)"
- §12 — substituído resumo stale (~95 itens / 72 abertos) por snapshot atual:
  - 162 itens · 114 fechados · 44 abertos · 2 BLOQUEADOS
  - Distribuição por categoria abertos
  - P0 críticos launch listados explicitamente
  - "Próximo passo concreto" focado no caminho real (Google review #158 → #131-#133 gate Production)

---

## Por que foi feito

User reportou §6 "embolado" — não conseguia ver visualmente o que estava aberto, fechado, qual prioridade, qual tipo de trabalho. Mistura de items launch-blocker com nice-to-have backlog era difícil de filtrar mentalmente.

Categorização força clareza:
- IMPLEMENTAÇÃO = caminho do launch (foco curto prazo)
- MELHORIAS = backlog incremental (sem urgência)
- BUGS = correções (atacam regressões/issues)
- TURNAROUND = mudanças grandes (raras, mas marcadas pra visibilidade)

Bolinhas coloridas + status emojis = scan visual rápido sem precisar parsear texto.

---

## Items do ROADMAP fechados (#XXX)

(nenhum nesta sessão — refactor docs apenas)

---

## Items novos descobertos

- **#162** [P2 BUG 🐛] TreatmentForm UX warning intervalHours/24 > durationDays — origem Mounjaro repro v0.2.1.2

---

## Estado deixado para próxima sessão

**Branch ativa:** `release/v0.2.1.4`

**Pronto pra:**
- Continuar acumulando commits docs/code nesta release
- Implementar #162 (1-2h fix)
- OU fechar release v0.2.1.4 só com refactor docs (release docs-only legítima — incrementa último dígito)

**Pendente caminho launch:**
- Aguardar Google re-review v0.2.1.2 fixes (#158 desbloqueio Closed Testing — ETA 24h-7d)

**Files alterados:**
- `contexto/ROADMAP.md` — refactor completo §6 + atualização §3 + §12 + Regra de manutenção header
- `contexto/README.md` — Regra 1 + sub-seções "Geração novos itens" + "Validação consistência" + "Bug isolado"
- `contexto/CHECKLIST.md` — adicionado #162 entry
- `contexto/updates/2026-05-06-refactor-roadmap-categorias.md` — este log
