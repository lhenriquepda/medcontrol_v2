# 2026-05-05 — #026 fix anti-spam Gmail (catch-all filter)

## Contexto

Sessão emendada após chat anterior travar pós-commit `86009d4` (#156 v1.3 idade 18+). User reportou: enviou TESTE 1 de `lhenrique.pda@gmail.com` para `contato@dosymed.app` 19:36 BRT, não recebeu em `dosy.med@gmail.com`.

Sessão anterior fechou #026 marcando "Gmail labels manuais user" — assumiu setup labels-only era suficiente. **Errado:** sem flag `Never send to Spam`, Gmail spam heuristic flagou forward novo direto pra Spam.

## Investigação (Chrome MCP)

1. **DNS dosymed.app via nslookup 8.8.8.8:** MX `mx1/mx2.improvmx.com` + SPF `include:spf.improvmx.com` ✅ OK
2. **DNS dossymed.app (typo verificação):** NXDOMAIN — descartado typo user
3. **ImprovMX dashboard:** Domain VERIFIED · 7 aliases verdes ativos · 1 Received nos últimos 30 dias (= setup confirmation 2026-05-04, NÃO o TESTE 1 hoje — hint de que ImprovMX nem registrou TESTE 1 ou contou separado)
4. **Click TEST alias `contato`:** ImprovMX SENT + hint "Check Spam Folder" — comportamento esperado pra forwarder novo
5. **Gmail Spam:** TESTE 1 achado lá. Razão Gmail: "This message is similar to messages that were identified as spam in the past."

**Causa raiz:** Gmail spam filter, não bug ImprovMX/DNS.

## Fix

**1 filtro catch-all** criado via Chrome MCP em `dosy.med@gmail.com` Settings → Filters and Blocked Addresses → Create new filter:

```
Matches: to:(dosymed.app)
Do this: Never send it to Spam · Always mark it as important
Also apply filter to 1 matching conversation: ON
```

Cobre 7 aliases atuais (`contato`, `privacidade`, `suporte`, `legal`, `dpo`, `security`, `hello`) + catch-all `*` + qualquer alias futuro sem precisar editar 7 filtros existentes.

8 filtros total agora em Gmail.

**Note Gmail:** "filter will not be applied to old conversations in Spam or Trash" — TESTE 1 + ImprovMX TEST email já em Spam não foram resgatados pelo filtro retroativo. Resgate manual via "Report not spam" em TESTE 1 → moveu pra Inbox + Gmail aprende.

## Validação end-to-end

Inbox `dosy.med@gmail.com` confirmado:

- **ImprovMX** "Alias test for contato@dosymed.app" 8:51 PM (label `Contato`)
- **lhenrique** "TESTE 1" 7:37 PM (label `Contato`, resgatado Spam)

Forward chain validado:
```
gmail.com → dosymed.app MX (improvmx) → forwarder@improvmx.com → dosy.med@gmail.com Inbox
                                                                  ↓
                                             filtros: label "Contato" + Never Spam (filter 8)
```

## Updates docs

- `contexto/CHECKLIST.md §#026` — adicionado bloco "Fix anti-spam (2026-05-05 sessão atual via Chrome MCP)" descrevendo problema + diagnóstico + fix + validação + limitação Gmail retroativo + pendência opcional consolidar 7 filtros.
- `contexto/ROADMAP.md §6 Δ 2026-05-05 v0.2.1.0` — adicionado "+#026 fix anti-spam: 8º filtro catch-all" + "+#156 v1.3 idade 13+ → 18+" (este último faltava na linha Δ pós-commit `86009d4`).

## Pendência opcional (não bloqueante release)

Consolidar filtros 1-7 adicionando "Never Spam" + "Mark important" em cada (catch-all 8 já cobre na prática, mas redundância protege caso Gmail decida mover apesar do filter 8). Não fazer agora — pula → fechar release.

## Estado release/v0.2.1.0

8 commits acumulados (último `86009d4`). Counter: 110/42/1.

**Próximos passos finalização release** (pós este fix):
1. Cross-checks Console submit #130 (6 itens manuais — Classificação conteúdo, Política Privacidade URL pós-deploy, Anúncios, Segurança dados, Intent tela cheia, Público-alvo já alinhado v1.3 18+)
2. Click "Enviar 14 mudanças para revisão" — dispara Google review ~24-72h
3. Release ceremony 8 passos: bump → build AAB → upload Console → tag → merge master → Vercel prod sync → atualizar contexto/PROJETO.md → delete branch
