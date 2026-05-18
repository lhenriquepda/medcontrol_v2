# 02 — Relatório Resumido (Executive Brief)

> Versão de 2-3 páginas para stakeholder não-técnico ou retrospectiva rápida.

**App:** Dosy — Controle de Medicação · `com.dosyapp.dosy`
**Versão auditada:** 0.1.6.9 @ commit `5bb9d36` · branch `master`
**Data:** 2026-05-01
**Veredito:** ⚠️ **PRONTO COM RESSALVAS** — Internal Testing OK; Closed/Open Testing precisa P0+P1.

---

## Sumário Executivo

Dosy é um app sólido de gestão de medicação com Capacitor + React 19 + Supabase. O alarme crítico nativo (despertador real, ignora silencioso/DND) é genuinamente diferenciador. A arquitetura de segurança é **defesa-em-profundidade**: RLS em todas as tabelas, anon role sem grants, RPCs com state machines, CHECKs de integridade, certificate pinning, FLAG_SECURE em telas sensíveis, ProGuard/R8.

**Score médio: 7.0/10 across 25 dimensões.**

Há 9 bloqueadores P0 antes de Open Testing público — a maioria operacional/manual (rotação de senhas, vídeo demo Play Console, validação device físico) e 1 bug técnico crítico em Edge Function (`send-test-push` sem proteção admin).

---

## Top 3 Forças

1. **🔒 Segurança DB sólida** — anon revogado em 10/11 tabelas, RLS forçado, RPCs com `SECURITY DEFINER`, CHECKs de range/length em todas as colunas críticas, triggers de cross-FK ownership e bloqueio de INSERT direto em SOS doses. Plan documenta uma evolução de 3-4 sprints de hardening — já bem amadurecido.

2. **⏰ Alarme crítico nativo realmente robusto** — Plugin Java custom (`CriticalAlarmPlugin`) com `setAlarmClock()` (bypassa Doze), `FLAG_SHOW_WHEN_LOCKED` + `TURN_SCREEN_ON`, `MediaPlayer` com `USAGE_ALARM` em loop, vibração contínua, FLAG_IMMUTABLE em PendingIntents, recovery pós-reboot via `BootReceiver` com migração de schema legado (v1→v2). Sem leaks aparentes (WakeLock timeout + release, MediaPlayer release + null assignment).

3. **📦 Bundle e performance build excelente** — main 64 KB gzip 20 KB (era 716 KB → -91%). React.lazy em 18 pages, vendor chunks split, jspdf+html2canvas lazy só em /relatorios, Terser strip console.log, source maps Sentry hidden em prod, ErrorBoundary global. Bundle alvo ≤500 KB superado em 8x.

---

## Top 5 Bloqueadores (P0)

1. **🚨 BUG-002: Edge Function `send-test-push` sem auth admin** — qualquer usuário autenticado pode invocar e usa `service_role` para enumerar usuários por email + spammar push. Resposta `404 user not found: ${email}` permite enumeration. **Risco ativo agora.**
2. **🚨 BUG-013: Senha postgres histórica vazada em git** — `SECURITY.md` documenta 13 scripts antigos com senha hardcoded. Refator feito; **rotação manual da senha pendente** + revogar PAT kids-paint + mover INFOS.md para vault.
3. **🐛 BUG-001: Encoding UTF-8 quebrado em nome de paciente** — paciente seed mostrado como "Jo�o Teste" (char U+FFFD). Replacement char está nos bytes do banco. Risco de mojibake em qualquer nome com acentos brasileiros (ã, õ, é, ç). Em healthcare, dado de paciente corrompido é vermelho-alarme.
4. **⚠️ Vídeo demo `FOREGROUND_SERVICE_SPECIAL_USE`** — Play Console exige justificativa em vídeo YouTube unlisted antes de promover Closed → Produção (regra Google 2024).
5. **📱 Validação manual em 3 devices físicos (FASE 17)** — alarme em OEM hostil (Xiaomi MIUI, Samsung One UI), DND nativo, força-fechamento, reboot. Sem isto, não há garantia que alarme funciona em ~30% do market BR.

---

## Top 10 Riscos Altos

| Risco | Severidade | Mitigação atual | Pendente |
|---|---|---|---|
| `send-test-push` sem auth admin (BUG-002) | P0 | Gateway Supabase exige JWT | Adicionar admin check |
| Email enumeration (BUG-015) | P0 | — | Resposta neutra |
| Senha postgres antiga em git (BUG-013) | P0 | Scripts refatorados | Rotação manual |
| Encoding UTF-8 (BUG-001) | P2/P1 | — | Investigação + fix data |
| `ic_stat_dosy` ausente (BUG-005) | P1 | — | Criar drawable |
| Sem telemetria de notif delivery | P0 (saúde) | Sentry monitora crashes | Evento PostHog `notification_delivered` |
| Sem testes E2E ou integração | P2 | 66 unit tests | Playwright + hook integration |
| RPC `extend_continuous_treatments` sumiu (BUG-004) | P2 | pg_cron diário | Recriar migration |
| Senha mínima 6 chars (BUG-008) | P2 | Frontend valida 8+ | Subir server-side |
| God-components (Settings 541, Reports 436, notifications 588) | P2 | — | Refactor backlog |

---

## Score por Dimensão (resumido)

```
🟢 ≥8: Confiabilidade alarmes (8.5), LGPD/Privacidade (8.0), Validação Plan (8.0)
🟡 7: Arquitetura (7.0), Performance build (7.5), Lógicas cadastro (7.0), Listas (7.5),
       Onboarding (7.5), Compliance Play Store (7.0), Aspectos legais (7.0),
       Gestão dados (7.0), Observabilidade (7.5), Dependências (7.0),
       Código morto/refactor (7.5), Usabilidade (7.0)
🟠 6: Segurança (6.5), UI/A11y (6.0), Feedback visual (6.5), Features médicas (6.5),
       Casos de borda (6.0), Inventário Supabase (6.7), Custos/cache (6.0),
       Prontidão lançamento (6.0)
🔴 ≤4: Testes (4.0)
N/A: Análise competitiva (não documentada)
```

**MÉDIA: 7.0**

---

## Cronograma estimado

| Marco | Dias-pessoa | Wallclock |
|---|---|---|
| Resolver P0 (#001-009) | ~3-5 | 1 sprint (Sem 1) |
| Resolver P1 (#010-027) | ~10-15 | 2 sprints (Sem 2-3) |
| Closed Testing 14 dias (Plan FASE 18.9.3) | passivo | Sem 4-5 |
| Open Testing → Produção pública | rollout 5%→100% | Sem 6-7 |
| Backlog P2 (refactor, testes integração, virtualização) | ~3-4 semanas | pós-launch 30d |
| Backlog P3 (features healthcare, OEMs hostis, iOS) | 90+ dias | pós-launch 90d |

**Soft-launch (P0+P1):** ~15-20 dias-pessoa concentrados.

---

## Pergunta-chave do auditor

> *"Eu colocaria minha mãe ou meu filho para usar este app amanhã, em produção, dependendo dele para tomar a medicação certa, na hora certa, todo dia?"*

**Resposta: Não com convicção total — ainda.**

Razões:
1. **Sem teste real em devices Android** (Pixel + Samsung + Xiaomi) — alarme em todos os cenários de OEMs hostis ainda é hipótese.
2. **BUG-001 (encoding)** abre dúvida sobre integridade dos dados em PT-BR.
3. **BUG-002 (Edge Function admin desprotegida)** é vetor de ataque ativo.
4. **Sem métrica `notification_delivered`** — regressão silenciosa em alarme passa despercebida.

Após resolver os 9 itens P0 + validação device físico (FASE 17), a resposta vira um **SIM convicto**. A base é sólida. Falta apenas fechar os gaps específicos.

---

## Próximos passos imediatos (semana 1)

1. **Hoje:** rotacionar senha postgres + INFOS.md → vault (#003) — 30 min
2. **Hoje:** adicionar auth admin em `send-test-push` (#001) + sanitizar erro (#002) — 30 min
3. **Hoje:** investigar BUG-001 encoding via SQL no Supabase Studio — 1h
4. **Hoje:** configurar GitHub Secrets Sentry (#008) — 15 min
5. **Esta semana:** gravar vídeo FGS demo (#004) — 2-3h
6. **Esta semana:** wire telemetria notification_delivered (#007) — 1-2h
7. **Próxima semana:** rodar device validation FASE 17 em 3 devices (#006) — 1-2 dias
8. **Próxima semana:** atacar P1 #010-#016

→ Detalhes em [../CHECKLIST.md](../CHECKLIST.md) e [ROADMAP.md](../ROADMAP.md).

---

## Arquivos desta auditoria

- [`README.md`](../README.md) — índice + sumário + veredito
- [`ROADMAP.md`](../ROADMAP.md) — checklist macro com links cruzados
- [`01-relatorio-completo.md`](01-relatorio-completo.md) — relatório completo das 25 dimensões
- [`02-resumo-executivo.md`](02-resumo-executivo.md) — este documento
- [`../CHECKLIST.md`](../CHECKLIST.md) — checklist detalhado item-a-item
- [`04-supabase.md`](04-supabase.md) — DB, RLS, edge, custos
- [`05-codigo.md`](05-codigo.md) — código morto, deps, cache, performance
- [`06-bugs.md`](06-bugs.md) — 15 bugs catalogados
- [`07-usabilidade.md`](07-usabilidade.md) — diário de bordo nav live + friction log
- [`08-limitacoes-web.md`](08-limitacoes-web.md) — itens [WEB-ONLY] (informativo)
- [`archive/`](../archive/) — Plan original + RoadMap + SECURITY antigos (referência histórica)
