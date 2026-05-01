# Decisões Arquiteturais e de Produto (`decisoes/`)

> ADRs (Architectural Decision Records) leves. Decisões importantes que mudam o contexto do projeto e justificam registro permanente.

---

## Quando criar ADR

Crie um ADR ANTES de implementar quando a sessão envolve:

- Mudança de arquitetura (ex.: trocar Supabase por Firebase, mudar de Capacitor pra Expo)
- Mudança de modelo de dados (ex.: hard-delete → soft-delete, schema rewrite)
- Mudança de comportamento crítico do produto (ex.: alarme passa a rodar sempre em background)
- Mudança em policy de segurança (ex.: passar a logar todas mutations)
- Decisão entre 2+ opções com tradeoffs significativos (ex.: WorkManager vs AlarmManager pra background sync)
- Reverter ou superar uma ADR anterior

**NÃO crie ADR para:**
- Bug fixes triviais (vão pra `updates/`)
- Refactor que não muda comportamento externo
- Mudança de cor / layout
- Decisões internas a uma feature pequena

**Regra de bolso:** se você precisaria explicar a decisão pra alguém daqui a 6 meses que não estava na conversa, crie ADR.

---

## Items "parte de #X" no CHECKLIST não viram ADR

Se um item do `CHECKLIST.md` declara explicitamente **"parte de #001"** ou **"depende de #001"**, ele já está documentado no item pai. **Não cria ADR separada** pra dependência.

Esses items entram no **mesmo commit** do pai e marcam `[x]` simultaneamente em ambos no `ROADMAP.md`. Ver `../README.md §"Workflow operacional padrão"`.

---

## Formato de nome

```
YYYY-MM-DD-NNN-titulo-kebab-case.md
```

- `YYYY-MM-DD` — data da decisão
- `NNN` — número sequencial (001, 002, ...) por todas as ADRs do projeto
- `titulo-kebab-case` — slug curto

Exemplos:
- `2026-05-20-001-alarme-background-persistente.md`
- `2026-06-15-002-soft-delete-em-vez-de-hard.md`
- `2026-07-01-003-migrar-tanstack-query-pra-zustand.md`

---

## Template

```markdown
# ADR-NNN — {{Título}}

- **Data:** {{YYYY-MM-DD}}
- **Status:** Proposta | **Aceita** | Superada por ADR-MMM | Rejeitada
- **Autores:** {{nome / "agente Claude na sessão YYYY-MM-DD"}}

---

## Contexto

{{Qual problema motivou a decisão? Qual é o estado atual? Quais restrições existem?}}

Exemplo:
> O alarme atual usa `setAlarmClock()` que dispara apenas no horário exato.
> Em OEMs hostis (Xiaomi/MIUI, Huawei), o app é frequentemente killed em background,
> o que cancela os alarmes agendados. ~30% do market BR é afetado.
> Usuário relatou em FASE 19 (beta interno) que perdeu doses noturnas.

---

## Opções consideradas

### Opção A — {{nome}}

{{Descrição}}

**Prós:**
- {{...}}

**Contras:**
- {{...}}

### Opção B — {{nome}}

{{...}}

### Opção C — {{nome}}

{{...}}

---

## Decisão tomada

**Escolhemos:** Opção {{X}} — {{nome}}.

**Justificativa:**
{{Por quê esta opção venceu? Quais critérios pesaram mais?}}

---

## Consequências

### Positivas
- {{O que melhora}}

### Negativas / tradeoffs aceitos
- {{O que piora ou complica}}
- {{Custos adicionais}}

### Itens de follow-up
- [ ] Atualizar `PROJETO.md` §{{X}} para refletir nova arquitetura
- [ ] Adicionar item ao `ROADMAP.md` se gera trabalho
- [ ] Adicionar teste de regressão
- [ ] Documentar em `archive/security-original.md` se afeta segurança

---

## Referências

- Issue: {{link}}
- PR: {{link}}
- Discussão: {{link Slack/Discord}}
- ADRs relacionadas: {{ADR-NNN}}
```

---

## Estados de ADR

- **Proposta** — ainda em discussão, não implementada
- **Aceita** — implementada, ativa
- **Superada por ADR-MMM** — substituída por outra decisão
- **Rejeitada** — considerada e descartada (mas valeu o registro)

ADRs nunca são deletadas. Mesmo superadas, ficam pra contexto histórico.

---

## Convenções

- **1 decisão por arquivo.** Não agrupar.
- **Numeração sequencial não-reusada.** Mesmo que ADR seja rejeitada, o número fica gasto.
- **Imutabilidade após aceita.** Se decisão muda, criar nova ADR superando.
- **Linguagem direta.** Não "recomendamos considerar"; sim "decidimos X porque Y".

---

## Como o agente novo usa

Ao receber demanda do tipo "mude X" ou ao perguntar "por que está assim?":
```
ls contexto/decisoes/ | grep -i {{tema}}
```
→ procure ADR relevante. Se não houver e a demanda é uma decisão grande, crie uma antes de codar.

Antes de implementar mudança grande:
1. Consultar ADRs existentes (não estamos contradizendo decisão recente?).
2. Discutir com user se incerto.
3. Criar ADR como **Proposta**, mostrar pro user.
4. Após confirmação, mudar status pra **Aceita** e implementar.
