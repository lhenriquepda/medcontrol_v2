# ADR-002 — Comunicação com user não-dev (Regra 8)

- **Data:** 2026-05-01
- **Status:** **Aceita**
- **Autores:** lhenriquepda + agente Claude (sessão 2026-05-01 release v0.1.6.10)

---

## Contexto

User do projeto Dosy (lhenriquepda) é product owner / desenvolvedor de produto, **não programador**. Não distingue branch de tag, não conhece JWT/curl/DevTools/IndexedDB, não sabe interpretar status codes HTTP, não opera Supabase Dashboard avançado.

Agente Claude default vem treinado pra falar com devs (jargão técnico denso, múltiplas opções abstratas, perguntas tipo "(a) X, (b) Y, (c) Z, qual prefere?").

Na sessão 2026-05-01 observamos fricção real:

1. **Após fix de segurança** agente perguntou: *"(a) Mergear direto · (b) Você testa via DevTools copiando JWT · (c) Pular teste"* → user respondeu *"nao entendi nada das ultimas perguntas... nao sei tomar essas decisoes com a formulaçao da pergunta feita"*

2. **Em outra confusão** sobre teste admin, agente disse "JWT do DevTools → IndexedDB → supabase-auth-token" → user não-dev paralisou.

3. **Branch model confusão** — agente reportou "branch security/send-test-push-admin... fix/encoding-utf8-pacientes... master atrás de v0.1.6.10" → user perguntou *"perdemos tudo que fizemos no branch anterior?"*

User começou a redigir Regra 8 manualmente no README durante a sessão (commit `6ec13a6`) capturando o problema.

---

## Opções consideradas

### Opção A — Manter comunicação default

Confiar que user gradualmente aprende vocabulário técnico.

**Prós:**
- Zero esforço de adaptação do agente
- User aprende "de graça"

**Contras:**
- Fricção real e custosa em decisões críticas (segurança, release)
- Bloqueio em pontos onde decisão precisa ser tomada agora
- Custo de retrabalho (agente reformula, user re-pergunta)
- Não respeita expertise do user (que é em produto/UX, não em código)

### Opção B — Agente traduz tudo, sempre

Glossário interno completo, traduzir todo termo técnico inline.

**Prós:**
- Zero risco de jargão escapar

**Contras:**
- Verboso ao extremo
- Tradução excessiva pode soar condescendente
- Termos já familiares pelo PROJETO.md (paciente, dose, alarme, push) ficariam reformulados desnecessariamente

### Opção C — Regras explícitas de comunicação user-facing (escolhida)

Vocabulário proibido SOMENTE quando agente fala COM o user (não em docs internos). Templates obrigatórios para decisões de aprovação, reportes de teste e perguntas técnicas. Auto-checagem antes de mandar resposta longa. Recomendação clara em toda decisão pedida.

**Prós:**
- Foco em momentos críticos (decisões, reportes)
- Não pollui docs internos com tradução
- Templates reduzem variabilidade entre respostas
- User não-dev consegue aprovar/reprovar com base em informação clara
- Reduz fricção sem infantilizar

**Contras:**
- Agente precisa lembrar de aplicar (auto-checagem)
- Vocabulário proibido pode soar arbitrário sem contexto
- Pode ser inconsistente entre sessões se README não for relido

---

## Decisão tomada

**Escolhemos:** Opção C — Regras explícitas em README como "Regra 8 — Comunicação com usuário não-dev (CRÍTICA)".

**Componentes da decisão:**

1. **Vocabulário proibido AO FALAR COM USER:** `JWT` · `Bearer` · `prod` · `deploy` · `mergear` · `branch` · `commit` · `endpoint` · `payload` · `token` · `staging` · `production` · `IndexedDB` · `localStorage` · `CORS` · `CSRF` (lista completa em README Regra 8).

2. **Vocabulário OK** (familiar via PROJETO.md): paciente, dose, tratamento, alarme, push, FCM, Vercel, Play Store, Android, AAB.

3. **Toda decisão pedida ao user inclui recomendação clara** — não múltipla escolha sem direção.

4. **Templates obrigatórios:**
   - "Decisão de aprovação" (resumo + próxima ação + por que recomendo + risco de aprovar/não)
   - "Reporte de teste" (✅/⚠️/❌ + o que testei + o que faltou + recomendação + detalhes técnicos em `<details>`)
   - "Pergunta técnica que user não tem como responder" (com opção fácil + opção técnica + opção pular)

5. **Auto-checagem antes de enviar resposta longa:**
   - Tem jargão sem tradução?
   - Pedi decisão sem dar recomendação?
   - Resumo em 1 linha está no topo?
   - Pedi pro user fazer algo técnico?

**Justificativa:**
- Captura o problema real observado na sessão (fricção em momentos de decisão)
- Não infla docs internos com tradução
- Aplica onde importa: comunicação com usuário no chat
- Templates reduzem variabilidade — agente em chat novo segue mesmo padrão

---

## Consequências

### Positivas
- User aprova/reprova decisões críticas com base em info clara
- Reduz round-trips "agente explica → user pergunta de novo → agente reformula"
- Estabelece linguagem comum entre user (PT-BR não-técnico) e agente
- Templates reduzem variabilidade → user sabe o que esperar de respostas
- README claro pra agentes futuros (chat novo herda o modelo)

### Negativas / tradeoffs aceitos
- Vocabulário proibido pode parecer paternalista sem contexto da Regra 8
- Auto-checagem depende do agente lembrar (não há enforcement automático)
- Templates podem virar "checklist de fachada" se aplicados mecanicamente — Regra 8 §"Auto-checagem" tenta mitigar
- Em alguns casos, jargão é mais preciso que tradução (ex.: "JWT" → "token de identificação que prova quem você é"). Tradeoff: clareza > precisão pra audience não-dev

### Itens de follow-up
- [x] Regra 8 escrita no README (commit `6ec13a6`, autoria user)
- [x] Vocabulário escopado a "AO FALAR COM USER" (commit pós-audit deste turno)
- [ ] Próximas sessões validarão se agente aplica Regra 8 consistentemente
- [ ] Se Regra 8 falha repetidamente, considerar templates ainda mais rígidos OU adicionar exemplos via prompt-engineering

---

## Referências

- README Regra 8: `contexto/README.md` (linhas ~202-325)
- Sessão de adoção: `contexto/updates/2026-05-01-release-v0.1.6.10.md`
- Origem da fricção (chat): user *"nao entendi nada das ultimas perguntas... nao sei tomar essas decisoes com a formulaçao da pergunta feita"*
- Commit autoria user (Regra 8): `6ec13a6 docs(contexto): add Rule 8 — communication guidelines for non-dev user`
