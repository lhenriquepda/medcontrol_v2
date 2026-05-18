# 2026-05-04 — P0 #003 fechado (rotação senha postgres + verificação PAT)

## Contexto

Pós-release v0.2.0.6 (master sync). User pediu sequência de P0 manuais que destravam Closed Testing. Ordem: #003 → #008 → #025 → #004 → #006.

#003 ainda marcado `⏳ Aberto` em CHECKLIST e ROADMAP. User confirmou que rotação não havia sido feita (senha postgres `xoeDZAnfn8TvBD5m` vazada via `tools/cleanup.cjs` commit `2119b45`, identificada em #126 v0.2.0.5).

## Ações realizadas

### 1. Senha postgres rotacionada
- Supabase Dashboard `https://supabase.com/dashboard/project/guefraaqbkcehofchnrc/database/settings`
- Click "Reset password" → dialog → click "Generate a password" (16-char strong auto-gen)
- Senha mostrada ao user pelo agente (Claude in Chrome MCP — clipboard API não funcionou via click programático, valor lido direto do `<input>`)
- User salvou em password manager local (entrada `Supabase Dosy postgres pwd (production)`)
- Click "Reset password" final → dialog fechou sem erro → rotação aplicada

### 2. PAT `sbp_aedc82d7...` (kids-paint)
- CHECKLIST especificava conta dona "kids-paint" → user confirmou conta = `lhenrique.pda@gmail.com`
- User trocou conta no Supabase manualmente (logout dosy.med + login lhenrique.pda)
- Página `https://supabase.com/dashboard/account/tokens` em lhenrique.pda retornou "No access tokens found"
- Conclusão: PAT `aedc82d7` já revogado anteriormente (provavelmente em sessão #084 v0.1.7.5 quando JWT rotation aconteceu)

### 3. INFOS.md cleanup
- `find . -iname INFOS*` retornou 0 ocorrências
- `git log --all --diff-filter=A` para "INFOS" retornou 0 ocorrências
- Conclusão: arquivo nunca commitado OU limpo via `git-filter-repo` durante sessão #084 v0.1.7.5 (que reescreveu histórico após vazamento JWT)

## Side findings

- Supabase Dosy Org status: **EXCEEDING USAGE LIMITS** (plano FREE) — grace period até 01 Jun 2026. Relacionado #009 (PITR + DR drill depende upgrade Pro plan). Não bloqueia operação atual mas precisa decisão antes do grace period expirar.
- PAT atual ativo em conta `dosy.med@gmail.com`: `Dasy App` `sbp_cf1c••••76ff` (last used 1d ago, expira 29 May 2026). Legítimo (criado pra Claude/scripts dev).

## Aceitação CHECKLIST §#003

- ✅ Senha postgres rotacionada via Supabase Dashboard
- ✅ PAT `sbp_aedc82d7` revogado (verificado via conta lhenrique.pda sem tokens)
- ✅ Nova senha em password manager (não plain text)
- ✅ INFOS.md ausente local + git history

## Pendências paralelas

- #008 Sentry GitHub Secrets (próximo na fila)
- #025 Screenshots phone 1080×1920
- #004 Vídeo FGS YouTube unlisted
- #006 Device validation 3 devices

## Próxima ação imediata

#008 Sentry GitHub Secrets — abrir `https://github.com/lhenriquepda/medcontrol_v2/settings/secrets/actions` e configurar `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` (~15 min).
