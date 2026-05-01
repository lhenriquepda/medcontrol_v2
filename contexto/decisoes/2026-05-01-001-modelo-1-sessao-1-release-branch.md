# ADR-001 — Modelo "1 sessão = 1 release branch versionada"

- **Data:** 2026-05-01
- **Status:** **Aceita**
- **Autores:** lhenriquepda + agente Claude (sessão 2026-05-01 release v0.1.6.10)

---

## Contexto

Projeto Dosy é healthcare app single-dev (lhenriquepda) + agente IA (Claude). Sem CI completa de validação automática. Cada merge pra master vai pra produção (Vercel + Play Store).

Plan original mencionava "branch por mudança" (`fix/*`, `feature/*`, `security/*`, `refactor/*`, `docs/*`). Modelo veio de práticas de teams maiores com PR review.

Aplicado a single-dev gerou problemas observados na sessão 2026-05-01:
- Fricção decisória "criar nova branch agora?" pra cada item
- Branch fragmentation (sessão criou 2 branches paralelas: `security/send-test-push-admin` + `fix/encoding-utf8-pacientes`) → user confuso "perdemos trabalho?"
- Bump de versão ambíguo: bumpa por branch ou por release? Quando?
- Master end up parcialmente sincronizado com prod (Edge Function deployada server-side antes de merge final, master atrasada)
- Atomicidade de release perdida — múltiplas merges pequenas em master = múltiplas oportunidades de drift entre git/Vercel/Play Store

User explicitou modelo mental:
> "essa sessão deve ser a atualização 0.1.6.6... fazemos tudo, quando eu disser terminamos, merge... aí sim, a versão 0.1.6.6 vai pra master"

Esse modelo casa com healthcare (atomicidade) + single-dev (reduz ritual) + master = produção (3 ambientes sempre sincronizados).

---

## Opções consideradas

### Opção A — Branch por mudança (modelo Plan original)

`fix/*`, `feature/*`, `security/*`, `refactor/*`, `docs/*` separadas por escopo.

**Prós:**
- Granularidade fina pra revert
- Familiar pra quem vem de teams maiores

**Contras:**
- Decisão "qual branch?" a cada item = ritual sem valor
- Múltiplas merges pequenas → master drifta de Vercel/Play Store em janelas curtas
- Bump de versão ambíguo (a cada merge? só em release?)
- Branches paralelas confundem user não-dev ("perdi trabalho?")

### Opção B — Tudo direto em master

Sem branches. Working tree → commit → push → master.

**Prós:**
- Zero ritual

**Contras:**
- Master vira instável durante sessão
- Vercel auto-deploy expõe estado intermediário em produção
- Sem ponto atômico pra revert release

### Opção C — 1 sessão = 1 release branch (escolhida)

Branch única `release/v{X.Y.Z}` por sessão. Acumula todos commits. Merge → master + tag + AAB + Console + Vercel no fim quando user pede "publica".

**Prós:**
- Atomicidade: release inteira = 1 evento sincronizado em 3 ambientes
- Master sempre = última versão publicada (regra invariante simples)
- Reduz ritual (zero decisão "qual branch?")
- Bump único no fim, baseado em commits acumulados
- Compatível com healthcare (rollback atômico via `git revert {tag}`)
- Branch persiste entre múltiplos chats da mesma sessão

**Contras:**
- Granularidade de revert mais grossa (tag inteira; pra revert parcial precisa cherry-pick)
- Um único bug crítico bloqueio um release inteira
- Hotfix urgente exige branch separada (`hotfix/{tema}`) fora do ciclo
- Conflito com modelo de teams maiores (irrelevante hoje)

---

## Decisão tomada

**Escolhemos:** Opção C — 1 sessão = 1 release branch versionada.

**Justificativa:**
- **Healthcare = atomicidade conta.** Reverter release inteiro é trivial; reverter mudanças soltas commitadas em master é frágil.
- **Single-dev = ritual zerado.** Nada de decisão "qual prefixo de branch?" — sempre `release/v{próxima}`.
- **Master = produção** vira regra invariante (não "às vezes mais à frente, às vezes atrás").
- **User mental model match.** User pensa em release como evento; modelo respeita isso.

---

## Consequências

### Positivas
- Master + Vercel + Play Store AAB sempre sincronizados (3 ambientes em estado conhecido)
- 1 ponto único de bump versão = 1 ponto único de tag git = 1 ponto único de rollback
- Múltiplas sessões podem trabalhar na mesma release branch (chat antigo + chat novo continuam no mesmo `release/v0.1.6.10`)
- Reduz fricção operacional do agente (não pergunta a cada item "criar branch?")
- README §Branch fica simples (1 modelo único, sem matriz tipo×branch-prefixo)

### Negativas / tradeoffs aceitos
- Granularidade de revert mais grossa — release inteira vs commit individual. Mitigação: commits dentro da branch são atômicos, então `git revert {sha}` continua funcionando antes do merge final
- Hotfix urgente exige saída do modelo (branch `hotfix/*` direto de master). Documentado como edge case
- Sessões longas acumulam muitos commits na release branch — diff fica grande. Mitigação: AAB build local valida antes de Console upload
- Modelo "só web/server" precisa cuidado: AAB skip mas ainda merece bump (web também versionada)

### Itens de follow-up
- [x] README §Branch reescrita com modelo (commit `b854eb0`)
- [x] README §Pre-trabalho atualizada pra checar release branch ativa (commit `826cd10`)
- [x] README §Padrão de fluxo / §Próxima sessão / §Geração de items alinhadas
- [x] Aplicado nesta release v0.1.6.10 (parcialmente — primeiros commits foram em master direto + 2 branches paralelas antes do modelo decidido; consolidado em `release/v0.1.6.10` no meio da sessão)
- [ ] Próxima release `v0.1.7.0` aplicará modelo limpo desde início

---

## Referências

- README §Branch: `contexto/README.md` (linhas 542-622)
- README §Pre-trabalho: `contexto/README.md` (linhas ~484-496)
- Sessão de adoção: `contexto/updates/2026-05-01-release-v0.1.6.10.md`
- Discussão original (chat): user pergunta "vai criar branch pra cada minima mudança...?" → "essa sessão deve ser a atualização 0.1.6.6"
