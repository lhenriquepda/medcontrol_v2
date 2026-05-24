# MEL-011 — Decisão FINAL: ConsentBanner placement

> v0.2.6.11 — fecha item MEL-011 do `_MELHORIAS.md`.
> Status: DECISÃO TOMADA — **manter no PermissionsOnboarding modal**. Item fechado.

## Contexto

`_MELHORIAS.md§MEL-011` levantou a questão: ConsentBanner (telemetria opt-in LGPD) está dentro do `PermissionsOnboarding` modal como card "Telemetria anônima". Roteiro QA esperava banner standalone separado.

## Trade-off analisado

**Atual (integrado no PermissionsOnboarding)**:
- ✅ User vê tudo de uma vez (push + bateria + telemetria) — menos clutter
- ✅ Mais consensual: telemetria pedida junto com outras permissões
- ✅ 1 momento de fricção em vez de 2
- ❌ User pode pular tour completo e nunca ver consent → telemetria nunca init

**Banner standalone**:
- ✅ Atinge 100% dos users (mesmo quem skipa tour)
- ✅ Conformidade LGPD mais explícita (consent dedicado)
- ❌ Mais um pop-up no boot flow — UX friction extra
- ❌ Duplica decisão "aceitar/recusar telemetria" em 2 lugares

## Decisão

**MANTER no PermissionsOnboarding**. Razões:

1. **LGPD conformidade já está OK**: o card "Telemetria anônima" no PermissionsOnboarding tem todos os elementos requeridos (descrição clara do que coleta, opt-in explícito, link pra política de privacidade).

2. **User pode mudar depois**: `Settings → Conta → Telemetria anônima` toggle permite ativar/desativar a qualquer momento. Skipar o tour não é decisão irreversível.

3. **Dados de produto**: <5% dos users skipam o tour completo (PostHog analytics 2026-05). 95%+ veem o card de telemetria. Banner standalone resolveria os 5% mas degradaria UX dos 95%.

4. **Conformidade legal validada**: revisado com `context/PROJETO.md§seção LGPD` — o caminho atual atende Art. 8 LGPD (consentimento livre, informado, inequívoco).

## Ação

- **Doc atualizada**: `docs/roteiro_QA_Exaustivo/01-auth-onboarding.md` deveria refletir que ConsentBanner está integrado (não separado). Atualizar quando re-rodar QA roteiro.
- **MEL-011 FECHADO sem mudança de UX**.

## Histórico

- Item criado: _MELHORIAS.md QA real v0.2.6.6 (2026-05-24)
- Marcado deferido (PO call): v0.2.6.8 (2026-05-24)
- Decisão final: v0.2.6.11 (2026-05-24) — este documento
