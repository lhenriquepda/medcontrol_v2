# Fix send-test-push admin auth + email enum sanitize — 2026-05-01

> **Sessão:** ~30 min · **Agente:** Claude Opus 4.7 · **Versão app:** 0.1.6.9 (sem bump — Edge Function only)

---

## 🎯 Objetivo da sessão

Continuar do ROADMAP §4 e fechar #001 (admin auth check em `send-test-push`) + #002 (sanitizar email enumeration, parte de #001). Bug crítico P0: qualquer authenticated user podia chamar a função e disparar push para qualquer email; resposta 404 vazava existência de email.

## ✅ O que foi feito

- **Branch nova:** `security/send-test-push-admin` (saída de master)
- **Editado:** `supabase/functions/send-test-push/index.ts`
  - Auth Bearer JWT obrigatório → 401 sem header / JWT inválido
  - Lookup `medcontrol.admins.user_id = auth.uid()` → 403 se non-admin
  - Resposta neutra `{ ok: true, sent: 0 }` em todos os fluxos sem entrega:
    - email não-existente
    - sem tokens FCM
    - erro listagem `auth.admin.listUsers`
  - Removido echo do email no response body
  - Removido `results[]` detalhado (per-token status, response body) — só conta agregada `sent`
  - JSON parse com try/catch → 400 `invalid_json`
  - Validação `typeof email === 'string'`
- **Header doc atualizado** explicando contrato auth + sem enumeration
- **Contexto atualizado:**
  - `ROADMAP.md` §3, §4, §6 (#001 + #002 marcados [x]), §12 (P0 9→7)
  - `CHECKLIST.md` #001 + #002 status → ✅ Concluído + corrigido `userId` → `user_id` no snippet (estava errado, schema real é snake_case)

## 📦 Itens do ROADMAP fechados

- [x] **#001** Admin auth check em `send-test-push` — Bearer JWT validado + lookup `medcontrol.admins`. Aceitação: 401 sem JWT · 403 non-admin · 200 admin.
- [x] **#002** Sanitizar email enumeration — todos fluxos retornam `{ ok: true, sent: 0 }` sem distinguir email existente/inexistente.

## 🐛 Bugs novos descobertos

- **CHECKLIST.md §#001 snippet** referenciava coluna `userId` na tabela `admins`, mas schema real (PROJETO.md §4) usa `user_id`. Corrigido inline (parte deste commit).

## 🧠 Decisões tomadas

- **Manter validação de JWT via `service_role` client** (`supabase.auth.getUser(jwt)`) em vez de criar client separado com anon key + JWT no header. Equivalente em segurança e mais simples — a chave para validar o JWT é apenas a JWT secret do project, não o anon key.
- **Não criar ADR** — fix tactical, sem mudança de arquitetura. Contrato externo da função sempre foi "admin only" (cabeçalho original já dizia isso); só faltava enforcement.
- **Não atualizar PROJETO.md** — não houve mudança de schema, rota, gating, ou convenção. Bug fix puro de lógica.

## 📁 Arquivos da pasta `contexto/` atualizados

- `ROADMAP.md` — §3 (bug crítico marcado fechado), §4 (#001 + #002 strikethrough), §6 (checkboxes), §12 (P0 9→7)
- `CHECKLIST.md` — #001 + #002 Status → ✅; corrigido `userId` → `user_id` no snippet
- `updates/2026-05-01-fix-send-test-push-auth.md` — este arquivo

## 🚧 Estado deixado pra próxima sessão

- **Branch `security/send-test-push-admin` aberta**, commit feito, **sem push pra remote ainda** — aguarda aprovação user
- **Deploy Edge Function pendente:** `supabase functions deploy send-test-push --project-ref <ref>` (manual; user roda via CLI ou Supabase Dashboard)
- **Teste manual recomendado** antes de merge master:
  1. Sem header → 401
  2. Bearer JWT user normal → 403
  3. Bearer JWT admin → 200 + push real chega no device
  4. Bearer JWT admin com email inexistente → 200 `{ ok: true, sent: 0 }` (sem 404)
- **Próximo P0 sugerido (§4):** #003 Rotacionar senha postgres + revogar PAT kids-paint + INFOS.md → vault (manual, 30 min user)
- **Master tag:** ainda v0.1.6.9. Nenhum bump de versão (Edge Function only). Quando próximo release de app for sair, AAB segue mesma versão; Edge Function sai independente.

## 💬 Notas livres

- Edge Function não precisa bump de `package.json` / `versionCode`. Deploy é separado da pipeline AAB. Master receberá merge direto após aprovação do user (sem ciclo release de 8 passos completo, pois sem build de app).
- Resposta neutra também silencia erros internos (ex.: `listUsers` falhou) → bom pra security mas pode esconder problema. Trade-off aceito; logs server-side via Supabase já capturam erros.
- Se admin lookup tabela `admins` falhar (ex.: tabela não existe / RLS bloqueando service_role) → 403 retornado por segurança. Service_role bypassa RLS, então failure aqui = problema real de schema/policy.

## 📊 Métricas

- Commits criados: 2 (1 docs reorg master + 1 security fix branch)
- LOC tocadas em `send-test-push/index.ts`: +50 / -20 aprox
- Tempo de sessão: ~30 min
