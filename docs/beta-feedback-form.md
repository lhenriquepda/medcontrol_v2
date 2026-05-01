# Beta Feedback Form — Spec

> Estrutura para Google Forms (FASE 19 — Beta Interno + Closed Testing).
> Link curto na home + email periódico de check-in.

## Configuração Google Forms

- **Título:** Dosy Beta — Feedback Sigiloso
- **Descrição:**
  > Obrigado por testar o Dosy! Sua resposta leva ~3min e é totalmente sigilosa.
  > Quanto mais detalhada, melhor — bugs, ideias, frustrações, tudo conta.
- **Coleta de email:** Opcional (campo separado, não autenticação)
- **Confirmação após envio:** "Recebido. Em até 48h respondemos por email se você deixou contato."
- **Notificação:** Email para `suporte@dosyapp.com` em cada resposta
- **Link curto:** ~~https://forms.gle/dosy-beta~~ (configurar após criar)

## Seções

### 1. Identificação (opcional)
1. **Email** (opcional) — `texto curto` — só preencha se quiser ser respondido
2. **Versão do app** (obrigatório, dropdown)
   - 0.1.5.7
   - 0.1.5.8
   - 0.2.x
   - Não sei
3. **Modelo do celular** (opcional, texto curto)
   - Placeholder: "Ex: Moto G84, Samsung A54, Pixel 7"

### 2. NPS — Recomendação
4. **De 0 a 10, qual a chance de você recomendar o Dosy a um amigo ou familiar?** (obrigatório, escala linear 0-10)
   - 0 = "Jamais recomendaria"
   - 10 = "Recomendaria com certeza"
5. **Por quê?** (opcional, parágrafo) — *condicional: aparece se nota ≤ 8*

### 3. Uso real
6. **Em quantos dias dos últimos 7 você usou o Dosy?** (radio)
   - 0–1 (quase nada)
   - 2–3
   - 4–5
   - 6–7 (todo dia)
7. **Você já confiou no Dosy para tomar uma dose real?** (radio sim/não)
   - Não, só estou testando
   - Sim, em 1-2 ocasiões
   - Sim, todos os dias
8. **O alarme te acordou ou avisou no horário certo?** (radio)
   - Sempre
   - Quase sempre
   - Às vezes falhou
   - Falhou várias vezes
   - Não cheguei a usar alarme
9. **Se falhou, descreva o que aconteceu:** (opcional, parágrafo)

### 4. Bugs encontrados
10. **Você encontrou algum bug, travamento ou comportamento estranho?** (radio sim/não)
11. **Se sim, descreva:** (opcional, parágrafo)
    - Placeholder: "Ex: o app travou ao abrir histórico, alarme tocou 2x seguidas, paciente sumiu..."
12. **Anexar print (opcional)** — `upload arquivo` (até 3 arquivos, jpg/png/pdf, máx 10MB)

### 5. UX & Design
13. **A interface ficou clara e fácil de entender?** (escala 1-5)
14. **Houve alguma tela ou ação que te confundiu?** (opcional, parágrafo)
15. **Se desse pra mudar UMA coisa no Dosy agora, seria:** (opcional, parágrafo)

### 6. Funcionalidades faltando
16. **Que funcionalidade você sentiu falta?** (caixas de seleção — múltipla)
    - Compartilhar paciente com outro cuidador
    - Sincronização com Google Fit / Samsung Health
    - Apple Watch / Wear OS
    - iOS (versão para iPhone)
    - Histórico exportável (PDF/Excel)
    - Lembrete de consulta médica
    - Lembrete de exames
    - Receita digital integrada
    - Modo offline robusto
    - Outro:
17. **Qual a MAIS importante das que você marcou?** (opcional, texto curto)

### 7. Plano PRO (futuro)
18. **Você pagaria pelo Dosy PRO?** (radio)
    - Sim, R$ 9,90/mês ou menos
    - Sim, R$ 14,90/mês
    - Sim, mas só anual com desconto
    - Não, prefiro a versão grátis com anúncios
    - Talvez, depende dos recursos
19. **Que recursos PRO valeriam o pagamento?** (parágrafo opcional)

### 8. Geral
20. **Algo mais que queira dizer ao time?** (opcional, parágrafo) — placeholder: "Elogios, reclamações, sugestões..."

## Fluxo de envio

1. Tester preenche
2. Resposta vai pra planilha Google Sheets vinculada
3. Trigger Apps Script: email pra `suporte@dosyapp.com` com resumo
4. Equipe categoriza em planilha:
   - **Bug crítico** (S1) → tratar em <24h
   - **Bug bloqueante** (S2) → tratar em <72h
   - **Feature request** → backlog
   - **UX feedback** → revisar próxima sprint
   - **NPS Promotor (9-10)** → registrar pra retenção
   - **NPS Detrator (0-6)** → reach-out individual

## Cálculo NPS

```
NPS = % Promotores (9-10) − % Detratores (0-6)
```

Alvos por fase:
- Beta interno: ≥ 30 (boa base)
- Closed testing: ≥ 40 (bom)
- Open testing pre-launch: ≥ 50 (ótimo)

## Onde divulgar form

- [ ] Email semanal pra todos testers (template `docs/email-tester-checkin.md` — TODO)
- [ ] In-app: Settings → "Compartilhar feedback" botão (link `forms.gle/...`)
- [ ] Após 7 dias de uso: notification persuasive ("Como tá indo o Dosy?")
- [ ] Toast pós-confirmação 50ª dose: "Conta pra gente como tá sua experiência"

## Métricas que cruzam com PostHog

Ao receber resposta, cruzar com user PostHog (via email ou device id) pra ver:
- Quantas doses confirmadas
- Quantas pulada/atrasadas
- Frequência de abertura do app
- Funções mais usadas

Se NPS ≥ 9 + uso ≥ 6 dias: candidato a **case study** futuro.
