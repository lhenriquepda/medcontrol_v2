# SEO Play Store — Dosy

> Otimização de discoverability na Play Store. Algoritmo prioriza:
> 1. Title + short description (peso máximo)
> 2. Long description (peso médio)
> 3. Categoria correta
> 4. Reviews + rating
> 5. Engagement (D1, D7, D30 retention)

---

## App title (max 30 chars)

**Atual (`app-title.txt`):** `Dosy — Controle de Medicação`

**Sugestões otimizadas (testar):**

| Variante | Chars | Keywords prioritárias |
|----------|-------|------------------------|
| `Dosy — Controle de Medicação` | 30 | controle, medicação |
| `Dosy: Lembrete de Remédio` | 26 | lembrete, remédio |
| `Dosy — Lembrar de Remédios` | 27 | lembrar, remédios |

**Recomendado:** `Dosy — Lembrete de Remédios` (palavra "lembrete" + "remédios" é a query mais comum no Brasil).

⚠️ Nome do publisher (Dosy Med) já aparece junto. Não repetir.

---

## Short description (max 80 chars)

**Atual (`description-short.txt`):** verificar.

**Sugestão:**
```
Lembrete de remédios com alarme que toca no silencioso. Para você e família.
```
77 chars. Cobre: lembrete, remédios, alarme, silencioso, família.

**Variante (caregivers-focused):**
```
Lembrete de medicação para idosos, crônicos e cuidadores. Alarme confiável.
```
76 chars.

---

## Categoria

**Recomendado:** `Saúde e Fitness` (Health & Fitness)

**Tags secundárias (Play Console permite múltiplas):**
- Medical
- Lifestyle
- Productivity (não — deixa ambíguo)

⚠️ NÃO marcar:
- Medical (Apps de telessaúde) — exige verificação CRM
- Children (Família) — restrições FERPA

---

## Keywords-alvo Brasil

Queries pesquisadas no Brasil (volume estimado/mês via Google Trends):

| Keyword | Volume | Concorrência |
|---------|--------|--------------|
| lembrete de remédio | alto | média |
| controle de medicação | médio | baixa |
| alarme remédio idoso | médio | baixa |
| lembrar tomar remédio | médio | baixa |
| medicamento horário | médio | baixa |
| cuidador idoso app | baixo | baixa |
| pílula lembrar | baixo | média |
| receita app | baixo | alta (apps de receita ≠ remédio) |

**Estratégia:** focar nas 4 primeiras (alto+médio volume, baixa concorrência).

Inserir naturalmente em:
- Title (1x mínimo)
- Short description (1-2x)
- Long description (4-6x distribuído)

---

## Long description (max 4000 chars)

A versão atual (`description-long.txt`) é boa, ~3500 chars. Manter, mas otimizar 1ª linha (peso máximo no algoritmo):

**Atual (1ª linha):**
```
💊 Dosy — Controle de Medicamentos para Toda a Família
```

**Otimizado:**
```
💊 Dosy — Lembrete de Remédios e Controle de Medicação para Toda a Família
```

Adicionar parágrafo de keywords no fim (rodapé SEO):

```
🔍 PALAVRAS-CHAVE
Lembrete de remédio, alarme de medicação, controle de medicamentos, app cuidador, pílula horário, idoso medicação, tratamento contínuo, farmácia caseira, adesão terapêutica, polifarmácia, hipertensão diabetes alzheimer.
```

Não exagerar — keyword stuffing penaliza. Máximo 1 parágrafo de até 250 chars de keywords.

---

## Screenshots (mínimo 2, máximo 8)

Ordem recomendada (1080×1920):

1. **Hero** — Dashboard com 3 doses pendentes + adesão 79%
2. **Alarme** — Tela cheia do alarme tocando ("Hora da Losartana")
3. **Tratamento** — Form Novo Tratamento com intervalos
4. **Histórico** — Calendário com dias verdes/vermelhos
5. **Compartilhar** — Tela "Cuidadores" com avatar
6. **Modo PRO** — Paywall com features

Cada screenshot deve ter **caption legível na thumbnail** (16-25 px texto). Hierarchy visual: 1 frase grande + 1 descrição curta.

---

## Feature Graphic (1024×500)

✅ Já gerado em `resources/feature-graphic.png`. Mostra logo + tagline + phone mockup.

Atende guideline Google Play (sem texto cortado em thumbnail Play Store quando aparece em listas).

---

## App Icon

✅ Já em `resources/icon.png`. Verificar:
- 512×512px (Play Store)
- Mipmap dirs Android (gerado via @capacitor/assets)
- Adaptive icon foreground/background separados

---

## Categorias Data Safety

Preencher honesto, evita rejeição:

- **Coleta:** Dados pessoais (email, nome), Saúde (dados de medicação)
- **Compartilha com terceiros:** Não (apenas Supabase como processor)
- **Criptografia em trânsito:** Sim (HTTPS)
- **Pode deletar:** Sim (Settings → Excluir conta)
- **Anúncios:** Sim (AdMob, dados anonimizados)

---

## Classificação etária IARC

Questionário Play Console: marcar:
- Sem violência
- Sem nudidade
- Sem linguagem profana
- Trata de **saúde/medicação**: Sim
- Idade-alvo: 16+ (recomendação Google pra apps com info médica)

---

## ASO (App Store Optimization) — checklist

- [ ] Title contém keyword principal
- [ ] Short desc contém keyword secundária
- [ ] Long desc primeiro parágrafo: keyword principal 2x
- [ ] Categoria correta (Saúde e Fitness)
- [ ] Screenshots com text overlay legível
- [ ] Feature Graphic com brand visível
- [ ] Icon adaptive
- [ ] Política de privacidade pública (URL ativo)
- [ ] Reviews 4.0+ (cultivar via in-app prompt após 30+ doses confirmadas)
- [ ] Localização: PT-BR primário, EN secundário (depois)

---

## Após launch (FASE 22+)

Monitorar via Play Console:
- Impressões na busca por query
- CTR (Click-through rate) — alvo ≥ 25%
- Conversão store listing → install — alvo ≥ 30%
- Retenção D1, D7, D30 — alvo ≥ 60%, 40%, 25%

Iterar A/B title + screenshots a cada 2 semanas até atingir target.
