# Play Store Reviews — Reply Playbook (#170 v0.2.1.3)

**Goal:** rating 4.3+ + reply rate >90% + 50+ reviews mês 6.

Reviews Play Store são pedacinhos críticos ASO. Google ranking algorithm fatora rating + reply rate. Sem reply em 24h = trust caí; com reply ≤24h = user re-rates 30%+ casos.

Esse playbook centraliza response templates + escalation rules.

---

## SLA reply

- **<24h** ⭐⭐⭐⭐⭐ 5 stars (thank + reinforce value)
- **<24h** ⭐⭐⭐⭐ 4 stars (thank + ask específico que melhoraria)
- **<12h** ⭐⭐⭐ 3 stars (acknowledge + offer help)
- **<6h** ⭐⭐ 2 stars (apologize + escalate to bug check)
- **<6h** ⭐ 1 star (apologize + escalate + offer DM/email)

Bugs reportados → criar ROADMAP item #NNN imediato.

---

## Templates

### ⭐⭐⭐⭐⭐ 5 stars — gratidão genérica

```
Obrigado pelo apoio, {nome}! Que bom que está ajudando você a cuidar
dos remédios. Qualquer sugestão pra melhorar mais ainda, manda pra
gente em contato@dosymed.app. 💊
```

### ⭐⭐⭐⭐ 4 stars — pergunta o que falta

```
Valeu pelo feedback, {nome}! Curioso pra saber o que segura a 5ª
estrela — qualquer sugestão concreta a gente analisa. Manda pra
contato@dosymed.app ou responde aqui. 🙌
```

### ⭐⭐⭐ 3 stars — acknowledge + offer help

```
Olá, {nome}. Obrigado pela honestidade. Quer me contar mais sobre
o que pode melhorar? Posso te ajudar diretamente em
contato@dosymed.app — todo feedback vai pro roadmap.
```

### ⭐⭐ 2 stars — apologize + escalate

```
Lamento a experiência ruim, {nome}. Vou levantar o que aconteceu
imediatamente — pode me detalhar o problema (qual celular, versão
do Android, em qual tela travou)? Manda pra contato@dosymed.app
e a gente prioriza o fix.
```

### ⭐ 1 star — apologize + DM + offer compensation

```
{nome}, peço sinceras desculpas. Reportes 1-estrela são levados a
sério aqui — quero entender o que deu errado pra corrigir. Pode me
contar em detalhes (celular, Android version, prints se possível)
em contato@dosymed.app? Vou priorizar pessoalmente. Se for bug
reproduzível, a próxima release sai com o fix.
```

---

## Bug detected em review — escalation

Quando review descreve bug específico:

1. **Reply imediato** com template apologize + agradecer detalhe
2. **Reproduzir** local (ou pedir mais info via reply)
3. **Catalogar** em `contexto/auditoria-live-{data}/bugs-encontrados.md`
4. **Criar item** ROADMAP `#NNN` com prioridade conforme severidade:
   - Crash / data loss → P0
   - Feature broken healthcare-adjacent (alarme, dose) → P0
   - UX feio mas funciona → P1/P2
5. **Reply update** assim que fix shipped: "Versão X.Y.Z saiu com fix
   pra esse problema, manda update pelo Play Store + me confirma se
   resolveu. Obrigado!"

---

## Frases banidas

❌ "Obrigado pelo feedback!" sozinho — robótico
❌ "Lamento ouvir isso." inglês traduzido
❌ "Vamos analisar e responder." sem prazo
❌ "Tente reinstalar o app." sem investigar
❌ Template idêntico copy-paste — Google detecta

✅ Sempre menciona nome do user (Console mostra)
✅ Sempre data/contexto específico
✅ Sempre próximo passo claro

---

## Stats tracking (PostHog)

Eventos auto-tracked:
- `review_prompt_shown` — Play Core dialog mostrado
- `review_prompt_skipped_quota` — Google quota exceeded (4-5/year limit)
- `review_prompt_failed` — plugin error

Dashboard PostHog: review prompts shown / month vs Console reviews count.
Conversion = (Console reviews / prompts shown) × 100. Target ≥30%.

---

## Trigger conditions In-App Review (#170 useInAppReview.js)

Prompt mostrado APENAS quando TODAS verdade:

1. Native Android (web no-op)
2. ≥7 dias desde install
3. ≥3 doses confirmadas
4. ≥1 alarme nativo disparado OK
5. Última sessão ativa <24h
6. Não foi prompted antes (lifetime once)

Trigger: 30s pós mount App.jsx (não no boot — feel intrusive).

Conditions ajustáveis em `src/hooks/useInAppReview.js`:
- `MIN_INSTALL_DAYS = 7`
- `MIN_DOSES_CONFIRMED = 3`
- `MIN_ALARMS_FIRED = 1`
- `MAX_LAST_ACTIVE_HOURS = 24`

---

## Quota Google Play Core

Google Play limita ~4-5 prompts/year per user automaticamente. Ignora
nossas chamadas além disso (silent error). useInAppReview captura via
event `review_prompt_skipped_quota`.

**NÃO** chame `requestReview()` em loop — Google penaliza developer
score se detectar abuse.

---

## Console manual reply workflow

1. Acessar `https://play.google.com/console/u/1/developers/{devId}/app/{appId}/user-feedback/reviews`
2. Filtrar **"Sem resposta"**
3. Aplicar template apropriado conforme rating
4. Marcar action item se bug detectado
5. Reply rate target >90%

---

## Re-engagement quando user atualiza review

Se user volta + atualiza rating ≥+1 estrela:
```
Que bom saber que melhorou, {nome}! Obrigado pela paciência. Se
encontrar mais coisa pra melhorar, manda pra contato@dosymed.app. 🙏
```
