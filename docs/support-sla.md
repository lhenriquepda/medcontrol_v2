# Dosy — Política de Suporte (SLA)

> Vigente a partir de 2026-04-28. Versão inicial — ajustar conforme volume real após Beta.

## Canais

- **Email principal:** suporte@dosyapp.com
- **In-app:** FAQ → "Falar com suporte" (mailto pré-preenchido com versão + plataforma)
- **Atendimento:** apenas em pt-BR. Inglês best-effort.

## Tempos de resposta (primeira resposta)

| Plano  | Dia útil      | Fim de semana / feriado |
|--------|---------------|-------------------------|
| Free   | até 72h       | até 5 dias úteis        |
| PRO    | até 24h       | até 48h                 |
| Plus   | até 12h       | até 24h                 |

> "Primeira resposta" = humano lendo o ticket e respondendo, não auto-reply.
> Resolução final pode levar mais tempo dependendo da complexidade.

## Severidades

- **S1 — Crítico:** alarme não toca, app não abre, dados perdidos.
  Triagem imediata. Atualização a cada 4h até resolver.
- **S2 — Alto:** funcionalidade quebrada com workaround.
  Atualização diária.
- **S3 — Médio:** bug menor, dúvida de uso, sugestão.
  Resposta dentro do SLA do plano.
- **S4 — Baixo:** roadmap, feature request.
  Triagem semanal.

## O que cobre

- Bugs técnicos (alarme, sync, login, pagamento)
- Dúvidas de uso não respondidas no FAQ
- Recuperação de conta (via email cadastrado)
- Problemas de cobrança (redirecionamos parte ao Google Play)

## O que NÃO cobre

- Conselho médico ou farmacêutico (nunca, em nenhum plano)
- Recuperação de dados após exclusão de conta (irreversível)
- Suporte em jailbreak/root, builds não-oficiais
- Customização avançada (integrações próprias)

## Escalonamento

Sem resposta dentro do SLA?
1. Reenviar email com "[ESCALONAMENTO]" no subject.
2. Caso PRO/Plus, mencionar plano + e-mail de cobrança.

## Métricas internas

- **Taxa primeira resposta SLA:** alvo ≥95%
- **CSAT pós-ticket:** alvo ≥4/5 (medido via PostHog survey)
- **Tickets/MAU:** alvo ≤2% (queda implica FAQ funcionando)

## Templates de resposta

Usar pasta `docs/support-templates/` (criar quando volume justificar).
Modelo inicial — bug com versão antiga:

> Olá [nome], obrigado por escrever! Pelo print, você está na versão X.Y.Z.
> Esse problema foi corrigido na versão A.B.C. Atualize pela Play Store
> ou pelo banner em Ajustes → Versão. Avisa se persistir, OK?
