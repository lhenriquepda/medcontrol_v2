# 2026-05-06 — ADR #001: Resolução rejection Google Play (Health apps gate)

**Status:** Proposto · aguarda decisão user
**Item ROADMAP:** #158 P0 URGENTE
**Releases impactados:** v0.2.1.0 (rejection origem) · v0.2.2.0+ (resolução pré-requisito)

---

## Contexto

Console submit Closed Testing track Alpha em release/v0.2.1.0 (2026-05-05 23:14 BRT) rejeitado pelo Google em <30 min com mensagem "Violação dos requisitos do Play Console — apps de certas categorias só por organização".

Investigação dedicada (sessão 2026-05-06 madrugada) executou plano 7 passos definido em CHECKLIST §#158. Findings críticos:

### Email Google rejection (capturado integral)

```
Subject: Action Required: Your app is not compliant with Google Play Policies (Dosy)
To: dosy.med@gmail.com

Issue found: Violation of Play Console Requirements
Your app is not compliant with the Play Console Requirements policy.
Some types of apps can only be distributed by organizations. You have selected
an app category or declared your app offers certain features that require you
to submit your app using an organization account.

Issue details: We found an issue in the following area(s):
- Developer Account

About the Play Console Requirements
From August 31, 2024, new developer accounts must register as an organization
if they provide the following services:
1. Financial products and services
2. Health apps, such as medical apps and human subjects research apps
3. Apps approved to use the VpnService class
4. Government apps

Submit an Appeal: It may take up to 7 days to receive a response.
This decision was taken by automated systems.
```

### Google Health App Categories (Answer 13996367)

Google distingue 3 health categorizations:

| Categoria | Definição | Org? |
|---|---|---|
| **Health & Fitness Apps** | medication reminders, fitness, sleep, nutrition trackers (consumer wellness) | ❌ Não |
| **Medical Apps** | EHRs, telehealth, symptom checkers, SaMD (Software as Medical Device) | ✅ **Sim** |
| **Human Subjects Research Apps** | IRB-approved research studies | ✅ Sim |

Citação literal: "Consumer wellness apps (**medication reminders**, fitness trackers) fall under Health and fitness apps, **NOT the medical app classification**."

**Conclusão:** Dosy = consumer medication reminder = Health & Fitness consumer = personal account deveria ser permitido.

### Console Conteúdo do app — declaração problemática

Página Console → Conteúdo do app → Apps de saúde → Recursos de saúde:

```
Saúde e fitness (consumer — NÃO requer org):
  ☐ Atividade e condicionamento físicos
  ☐ Controle de nutrição e peso
  ☐ Monitoramento de ciclo menstrual
  ☐ Controle do sono
  ☐ Controle de estresse, relaxamento e acuidade mental

Medicina (TODAS sub-categorias = Medical app, REQUEREM org):
  ☑ Controle de doenças e condições médicas  ← MARCADO ATUAL (TRIGGER REJECTION)
  ☐ Suporte à decisão clínica
  ☐ Prevenção de doenças e saúde pública
  ☐ Emergência e primeiros socorros
  ☐ Serviços e gerenciamento de saúde
  ☐ Apps para dispositivos médicos
  ☐ Saúde mental e comportamental
  ☐ Educação e referências médicas
  ☐ Controle de medicamentos e tratamentos  ← verificar se também marcado
  ☐ Fisioterapia e reabilitação
  ☐ Saúde reprodutiva e sexual

Pesquisa em seres humanos: REQUER org
Outro: campo texto livre
```

**Trigger identificado:** checkbox "Controle de doenças e condições médicas" em **Medicina** category está marcado. Esta categoria é classificada Medical App pelo Google → org account required.

## Opções

### Opção B-refined (Quick win — Personal account preserved)

**O que fazer:**
1. Console → Conteúdo do app → Apps de saúde → DESMARCAR "Controle de doenças e condições médicas" (e qualquer outra checkbox em Medicina)
2. Avaliar marcar zero ou usar campo "Outro" com descrição: "Lembrete de medicação para auto-cuidado consumer (uso doméstico familiar — não app médico clínico nem SaMD)"
3. Re-submit Closed Testing (Console → Visão geral → Enviar mudanças para revisão)
4. Aguardar Google review (~24-72h)

**Vantagens:**
- Resolução em 1-3 dias (quick)
- Custo zero
- Mantém personal account `dosy.med@gmail.com`
- Declaração tecnicamente honesta — Dosy é consumer medication reminder, não SaMD

**Desvantagens:**
- Não pode marcar "Apps de saúde" como medical, perdendo positioning healthcare profissional
- Risco residual: Google review humano pode questionar "Apps de saúde declaration inaccurate" em next rejection cycle
- Privacidade.jsx atual menciona LGPD healthcare profundo — mensagens entre app declarações vs documentação

**Mitigação risco residual:**
- Privacidade.jsx pode permanecer LGPD-compliant (saúde é setor jurídico, não declaração Console)
- Categoria Console "Saúde e fitness" mantida (não muda)
- Em "Outro" Apps de saúde: explicar Dosy como consumer medication reminder explicitly

### Opção A (Long-term — Organization account permanent solution)

**O que fazer:**
1. **Verificar se user já tem CNPJ/empresa Dosy Med LTDA registrada:**
   - Se SIM → pular abertura empresa
   - Se NÃO → abrir empresa BR (~R$ 1000-3000 contador, ~5-15 dias)
2. Solicitar **D-U-N-S number** Dun & Bradstreet (gratuito, ~30 dias BR)
3. Console → criar nova conta Google Play Developer **Organization** ($25 USD nova taxa)
4. Verificação Google: até 5 dias
5. Console → app Dosy → Configurações → Transferir app → para conta org (2 dias úteis aprovação)
6. Re-submit Closed Testing/Production na conta org
7. Após sucesso: solicitar refund $25 USD da conta personal antiga via support

**Vantagens:**
- Resolve permanente (qualquer Health app category aceita)
- Profissional + alinha com positioning Dosy Med LTDA
- Mantém Privacidade.jsx healthcare scope completo
- Production track viable longo prazo

**Desvantagens:**
- 30-45 dias resolução completa
- Custos: R$ 1000-3000 abertura empresa (se não tem) + $25 USD Console
- Paperwork BR + Google verification cycles
- Internal Testing track CONTINUA funcionando durante transição (não bloqueia user+esposa atual)

**Dados transferência app pessoal → org (Google docs):**
- Transferem: usuários, estatísticas, avaliações, comentários, subscrições
- NÃO transferem: bulk export reports, earnings reports, grupos de teste (recriar), promoções (códigos válidos)
- Application ID `com.dosyapp.dosy` mantido
- Firebase/Analytics/AdMob: re-link manual após transferência
- Tempo Google approve: ~2 business days

### Opção C (Appeal — Free + preserves scope, slow)

**O que fazer:**
1. Console → email rejection → Submit Appeal
2. Texto apelo: explicar Dosy é consumer medication reminder targeting consumer audience (pais, cuidadores, idosos), não medical app clínico ou SaMD. Citar Google docs explicitamente que medication reminders = Health & Fitness category.
3. Aguardar response Google (até 7 dias)

**Vantagens:**
- Custo zero
- Preserva escopo declarações + Privacidade.jsx healthcare
- Se aceito: desbloqueia personal account sem mudar Console declarations

**Desvantagens:**
- Google appeal review é opaque + slow
- "This decision was taken by automated systems" — appeal reviewer humano pode confirmar decision automated
- Pode ser rejeitado sem explanation
- Se rejeitado: ainda preciso fazer A ou B

## Decisão recomendada

**Estratégia híbrida B + C paralelo:**

### Fase 1 (1-2 dias) — Imediato
1. **Aplicar Opção B-refined** Console (desmarcar Medicina checkboxes + ajustar Outro)
2. **Submit Appeal Opção C** em paralelo (simulta neamente, sem dependência)
3. Re-submit Closed Testing track #130

### Fase 2 (2-7 dias) — Aguardar
- Google re-review nova submission B (24-72h Closed Testing)
- Google appeal C (até 7 dias)

### Fase 3 (cenários)
- ✅ B aceita → Closed Testing live → user+esposa + testers externos. Appeal C cancelar/abandonar.
- ❌ B rejeitada novamente OR C aceita → segue C (declarações originais OK)
- ❌ Ambos rejeitados → Opção A (org account) tornar-se necessária

### Fase 4 (longo prazo opcional — após B/C resolve)
- Avaliar abrir conta org futuramente para escalar Dosy (Production track + categoria Medicina full healthcare positioning)
- Não bloqueia operação user atual (Internal Testing já funciona)

## Plano execução B-refined detalhado (próxima sessão)

```
Console → Conteúdo do app → Apps de saúde → Gerenciar
1. DESMARCAR todas checkboxes Medicina:
   - Controle de doenças e condições médicas (atual marcado)
   - Controle de medicamentos e tratamentos (verificar se marcado)
   - Outras Medicina sub-categorias se marcadas
2. Avaliar Saúde e fitness:
   - Marcar OPCIONAL (campo opcional Google)
   - OU deixar nada se Dosy não fit consumer fitness existing categories
3. Outro → texto descritivo (250 char):
   "Lembrete de medicação para auto-cuidado consumer (uso doméstico familiar
   por pais, cuidadores informais, idosos). Não é app médico clínico, SaMD ou
   sistema EHR. Foco em adesão a tratamentos prescritos por profissional médico
   externo ao app."
4. Salvar declaração
5. Console → Visão geral da publicação → Enviar mudanças para revisão
6. Aguardar Google re-review 24-72h
```

## Plano execução C paralelo

```
Email rejection → Submit Appeal (link no email)
Texto:
"Hello Google Play Team,

Dosy (com.dosyapp.dosy) is a consumer medication reminder application targeting
families managing medication schedules at home — parents administering
medication to children, caregivers tracking elderly relatives, individuals
managing their own daily medication doses.

Per Google Play Health app categories documentation
(https://support.google.com/googleplay/android-developer/answer/13996367),
'Consumer wellness apps (medication reminders, fitness trackers) fall under
Health and fitness apps, NOT the medical app classification.'

Dosy:
- Does NOT provide medical diagnosis, treatment recommendations, or clinical decision support
- Does NOT integrate with EHR systems or e-prescribing platforms
- Is NOT a Software as a Medical Device (SaMD) regulated by ANVISA/FDA
- Does NOT serve healthcare professionals — target audience is consumers (parents, caregivers, elderly individuals)
- Functions: dose scheduling reminder, alarm notification, dose tracking history,
  medication adherence stats — purely consumer self-care utility

We respectfully request reclassification as Health & Fitness consumer app,
allowing distribution via personal developer account dosy.med@gmail.com.

Thank you for your consideration.

The Dosy Team"

Submit + aguardar até 7 dias.
```

## Aceitação final ADR #001

- ✅ Closed Testing track Google review aprova v0.2.1.x (via B ou C)
- ✅ Opt-in URL https://play.google.com/apps/internaltest/4700769831647466031 aceita inscrições novas
- ✅ Production track futuro submit passa review
- ✅ Internal Testing continua funcionando (✅ já garantido — v0.2.1.1 vc 47 publicado, não afetado)

## Status

**Proposto.** Aguarda confirmação user pra executar Fase 1 (B + C paralelo) próxima sessão.

Caso B falhe E C falhe, escalar para Opção A (org account) com plan dedicado.

## Histórico decisões relacionadas

- v0.2.1.0 categoria Console: Medicina → **Saúde e fitness** (commit `d4f3ecb`) — pré-requisito mas não suficiente
- v0.2.1.0 #156 v1.3 Privacidade idade 18+ + LGPD healthcare — escopo legal mantido independente declarações Console
- Internal Testing AAB v0.2.1.0 vc 46 + v0.2.1.1 vc 47 publicados sem afetação rejection
