# 06 — Bugs Mapeados (live nav + análise estática)

> Bugs encontrados via Claude in Chrome (URL `https://dosy-teal.vercel.app/`, conta `teste03@teste.com`) + análise estática do código.
> Cada bug classificado como **[ANDROID]** (afeta Android final), **[AMBOS]** (web e Android), ou **[WEB-ONLY]** (só ambiente browser, fora do checklist).
> Severidade: **P0** (bloqueador), **P1** (alto), **P2** (médio), **P3** (baixo).
>
> **Limitação importante:** live nav cobriu ~15 minutos focados (versão, login, dashboard, paciente, settings, histórico, mais menu, console errors). NÃO foi feita a sessão de 90 minutos completa requerida pelo prompt original — credenciais foram fornecidas tarde, e priorização foi gerar artefatos completos. Bugs adicionais podem existir em fluxos não-cobertos (criar/editar paciente, criar tratamento, gerar relatório PDF, S.O.S, multi-paciente, slow 3G, offline, etc).

---

## BUG-001 — Encoding UTF-8 quebrado em nome de paciente

- **Severidade:** P2
- **Classificação:** [AMBOS]
- **Onde:** Lista de pacientes (`/pacientes`), PatientDetail (`/pacientes/{id}`), AppHeader (saudação)
- **Sintoma observado:** Paciente cadastrado como "João Teste" exibe como "Jo�o Teste" (caractere `<U+FFFD>` REPLACEMENT CHARACTER no lugar do "ã").
- **Evidência:** charCode 65533 confirmado via `JSON.parse(localStorage['dosy-query-cache'])` — bytes do nome em cache: `[74,111,65533,111,32,84,101,115,116,101]` = "Jo�o Teste".
- **Causa-raiz provável:** dado foi inserido via algum script/seed/teste que gravou Latin-1 ou bytes inválidos no campo `patients.name` do Postgres. UI apenas exibe o que está no banco.
- **Risco:**
  - Nomes brasileiros com acentos (ã, õ, é, í, ç) podem aparecer corrompidos.
  - Atinge **diretamente o público-alvo** (PT-BR, idosos, cuidadores).
  - Em relatórios PDF / export CSV, dado corrompido sai assim.
  - Pode ter sido introduzido em testes manuais antes de o `Content-Type: application/json; charset=utf-8` estar correto, mas resta a dúvida: é só nesse paciente seed ou afeta inserções via UI?
- **Reprodução:**
  1. Login `teste03@teste.com`
  2. Bottom nav → Pacientes
  3. Card paciente mostra "Jo�o Teste"
  4. Tap → PatientDetail mostra o mesmo "Jo�o Teste" no header e card.
- **Recomendação:**
  1. Validar no Supabase Studio: `SELECT id, name, octet_length(name), encode(name::bytea, 'escape') FROM medcontrol.patients;` — verificar se o byte é U+FFFD literal ou bytes mal-formados.
  2. **Criar paciente novo via UI com "João da Silva"** e re-validar — se UI grava OK, é só dado seed legado contaminado e basta corrigir/deletar esse seed.
  3. Se UI grava errado: investigar PatientForm.jsx + patientsService.js + Supabase JS client config.
  4. Adicionar teste E2E (Playwright) cobrindo "criar paciente com acentos" → re-ler → comparar.
- **Status:** ❌ Bloqueador para teste real com brasileiros (P2 → considerar P1 se afetar inserções via UI).

---

## BUG-002 — Edge Function `send-test-push` não valida autorização (auditoria estática)

- **Severidade:** P0
- **Classificação:** [AMBOS] — afeta cliente e servidor (toda função Edge é remota)
- **Onde:** `supabase/functions/send-test-push/index.ts`
- **Sintoma:** função declarada como "admin-only" no comentário (linha 4) mas **não verifica nenhum token/role**. Qualquer caller que conhece a URL pode:
  1. Disparar push spam para qualquer email cadastrado.
  2. Enumerar contas via response 404 (`user not found: ${email}`) vs 200 (`sent: N`).
- **Evidência:**
  ```ts
  // send-test-push/index.ts:59
  Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('POST only', { status: 405 })
    const { email, ... } = await req.json()
    // ... NENHUM auth check, vai direto pra supabase.auth.admin.listUsers()
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users.find((u: any) => u.email === email)
    if (!user) return new Response(JSON.stringify({ error: `user not found: ${email}` }), { status: 404 })
  ```
- **Mitigação parcial existente:** Supabase por default exige `Authorization: Bearer <JWT>` no gateway (a menos que `[functions.<name>].verify_jwt = false` esteja em `config.toml`). `config.toml` atual NÃO tem essa override → função exige um JWT válido (mesmo anon).
  - **Mas:** qualquer usuário **autenticado** pode invocar (incluindo PRO/Plus comuns), e a função usa `service_role` para acessar `auth.admin.listUsers()` e a tabela `push_subscriptions`.
- **Risco:**
  - Vetor de spam push para qualquer email da base.
  - Vetor de enumeration de emails cadastrados.
  - Vetor de reconhecimento — atacante mapea quem está/não está cadastrado.
- **Recomendação (snippet):**
  ```ts
  Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('POST only', { status: 405 })
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    }
    const jwt = authHeader.slice(7)
    const { data: { user }, error } = await supabase.auth.getUser(jwt)
    if (error || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    // Check admin role
    const { data: admin } = await supabase.from('admins').select('userId').eq('userId', user.id).maybeSingle()
    if (!admin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    // Generic error to avoid email enumeration
    // ... resto da função
    if (!targetUser) return new Response(JSON.stringify({ ok: true, sent: 0 }))  // mensagem neutra
  ```
- **Adicional:** considerar rate limit (Supabase Pro plan: rate limiting de Edge Functions; ou implementar em-código com `KV cache`).

---

## BUG-003 — Edge Function `delete-account` sem rate limit (auditoria estática)

- **Severidade:** P2
- **Classificação:** [AMBOS]
- **Onde:** `supabase/functions/delete-account/index.ts`
- **Sintoma:** função tem auth check correto (valida JWT linha 35-46) e fluxo LGPD apropriado, mas **sem rate limit**. Atacante autenticado pode invocar 1000x rapidamente.
- **Risco:**
  - Custo de invocações Edge Functions (Free: 500k/mês).
  - DoS: locks de DB durante cascade delete repetido.
- **Recomendação:** rate limit por user (1 chamada / 5 min) usando `Deno.openKv()` ou tabela `function_invocations` com TTL.

---

## BUG-004 — `extend_continuous_treatments` RPC sumiu (PGRST202 404)

- **Severidade:** P2
- **Classificação:** [AMBOS]
- **Onde:** Dashboard.jsx (chamada cliente desabilitada), backend
- **Sintoma:** RPC `extend_continuous_treatments(p_days_ahead int)` foi removida do schema (migration perdida ou rollback). Plan.md FASE 18.4.5 e §23.5 documentam: "função sumiu do schema (migration perdida)".
- **Mitigação atual:**
  - Chamadas client-side comentadas em `Dashboard.jsx` (mount + handleRefresh).
  - pg_cron faz fallback diário.
- **Risco:**
  - Tratamento contínuo (sem `durationDays`) fica sem extensão sob demanda. User pode abrir o app e não ver doses dos próximos 7 dias até pg_cron rodar.
  - Migration ausente = schema fora dos arquivos versionados (drift entre `supabase/migrations/` e Postgres real).
- **Recomendação:**
  1. Recriar a função em nova migration `supabase/migrations/{timestamp}_recreate_extend_continuous_treatments.sql` com assinatura documentada `(p_days_ahead int) returns json` retornando `{dosesAdded, treatmentsExtended}`.
  2. SECURITY DEFINER + `SET search_path = medcontrol, pg_temp`.
  3. Validar ownership via `auth.uid()`.
  4. Reativar chamada em `Dashboard.jsx` (mount + handleRefresh).
  5. Adicionar teste de integração: criar tratamento contínuo → mocar agora() para 7 dias depois → verificar `dosesAdded > 0`.

---

## BUG-005 — `ic_stat_dosy` referenciado mas ausente nos drawables

- **Severidade:** P1
- **Classificação:** [ANDROID]
- **Onde:** `capacitor.config.ts` referencia `LocalNotifications.smallIcon: 'ic_stat_dosy'`, mas o recurso não existe em `android/app/src/main/res/drawable*`.
- **Evidência:**
  ```bash
  $ find android/app/src/main/res -name "ic_stat_dosy*"
  (vazio)
  ```
- **Sintoma esperado em runtime:** LocalNotifications fallback para `ic_launcher` (silhueta colorida) → notificação parece "estranha" ou tem branding ruim no system tray Android (especialmente Android 6+ que exige ícone monocromático para notification small icon).
- **Risco:**
  - Notificação fica visualmente quebrada (ex.: quadrado branco sólido).
  - Em Android < 11, sistema pode rejeitar e não mostrar a notif.
- **Recomendação:**
  1. Criar vector drawable `ic_stat_dosy.xml` em `android/app/src/main/res/drawable-anydpi-v33/` + fallback PNG monocromático 24x24dp em `drawable-mdpi`, `drawable-hdpi`, `drawable-xhdpi`, `drawable-xxhdpi` (silhueta branca da pílula Dosy).
  2. Re-build APK e validar em device físico que o ícone aparece monocromático correto.
- **Status:** confirmado via `find` — drawable ausente.

---

## BUG-006 — AdSense placeholder em produção (`index.html`)

- **Severidade:** P1 (web) / não-crítico (Android)
- **Classificação:** [WEB-ONLY] (no Android usa AdMob real)
- **Onde:** `index.html` script tag AdSense
- **Sintoma:** publisher ID `ca-pub-XXXXXXXXXXXXXXXX` (placeholder).
- **Risco no web:** zero receita + placeholder "Publicidade · Espaço reservado" visível em produção.
- **Recomendação:**
  1. Criar conta AdSense, registrar `dosy-teal.vercel.app`.
  2. Substituir placeholder em `index.html`.
  3. Setar `VITE_ADSENSE_CLIENT` + `VITE_ADSENSE_SLOT` no Vercel env.
- **Notas:** Plan.md FASE 4.3 confirma. Se Beta vai diretamente para Android (sem propaganda web), pode ser P3.

---

## BUG-007 — TypeScript declarado como `^6.0.3` no `package.json`

- **Severidade:** P3 (verificação necessária)
- **Classificação:** [AMBOS] (afeta build dev / CI)
- **Onde:** `package.json:81` + `package-lock.json:69`
- **Sintoma:** dependência declarada `"typescript": "^6.0.3"`. Versão 6.x do TypeScript foi de fato lançada após o cutoff de TS 5.x — pode ser legítimo, mas requer **verificação se é o pacote oficial Microsoft `typescript@npm`** (e não um typosquat).
- **Verificação:**
  - `node -e "console.log(require('./node_modules/typescript/package.json').version)"` → `6.0.3` instalado.
  - O projeto não usa TS em produção (95 arquivos `.js/.jsx`, 0 `.ts/.tsx`). É devDep apenas.
  - Risco de instalações futuras puxarem versão maliciosa se o registro for de typosquat.
- **Recomendação:**
  1. Verificar `npm view typescript@6.0.3` se mantém maintainer Microsoft (`microsoft`).
  2. Se confirmado oficial: atualizar `package-lock.json` integrity hashes para resolver SHA-512 da versão.
  3. Se incerto: degradar para `^5.7.x` (última stable verificada da Microsoft).
- **Status:** sem certeza — auditor pediu verificação manual.

---

## BUG-008 — `minimum_password_length = 6` no `supabase/config.toml`

- **Severidade:** P2
- **Classificação:** [AMBOS]
- **Onde:** `supabase/config.toml:175`
- **Sintoma:** servidor aceita senha com 6 chars. Frontend (`Login.jsx:7-12`) valida ≥ 8 chars + maiúscula + número, mas alguém chamando direto a API auth (curl ou app paralelo com mesma project ref) consegue criar conta com senha fraca.
- **Risco:** brute-force facilitado em produção.
- **Recomendação:**
  ```toml
  # supabase/config.toml
  [auth]
  minimum_password_length = 8
  password_requirements = "lower_upper_letters_digits"
  ```
  + aplicar via dashboard Supabase também (config.toml local pode não refletir cloud).

---

## BUG-009 — `enable_confirmations = false` no `supabase/config.toml` (apenas local)

- **Severidade:** P3
- **Classificação:** [AMBOS]
- **Onde:** `supabase/config.toml:216`
- **Sintoma:** local config não exige confirmação de email. Plan.md afirma `mailer_autoconfirm=false` no cloud (correto), mas o `config.toml` versionado pode confundir devs novos lendo o repo.
- **Recomendação:** alinhar `config.toml` com cloud (`enable_confirmations = true`) OU adicionar comentário explícito que esse valor é local-only e cloud é `true`.

---

## BUG-010 — `coverage/` versionado no repo (provável)

- **Severidade:** P3
- **Classificação:** [AMBOS] (qualidade)
- **Onde:** `coverage/` na raiz (timestamp 2026-04-28)
- **Sintoma:** diretório de coverage existe; verificar se está em `.gitignore`.
- **Risco:** poluição de PRs, churn em diff de cada CI run.
- **Recomendação:** confirmar `.gitignore` cobre `coverage/` e `coverage-*/`.

---

## BUG-011 — Anúncios AdMob test ID em produção (referência cruzada)

> Já documentado em `SECURITY.md`. Mantido aqui para visibilidade.

- **Severidade:** P1
- **Classificação:** [ANDROID]
- **Onde:** `android/app/src/main/AndroidManifest.xml:51-53`
- **Sintoma:** `meta-data ads.APPLICATION_ID = ca-app-pub-3940256099942544~3347511713` (Google test ID).
- **Status segundo Plan FASE 4.3:** ⚠️ ID de banner production já está em `VITE_ADMOB_BANNER_ANDROID`, mas o **App ID do manifesto** ainda é o test ID.
- **Recomendação:** trocar `meta-data` para o App ID real `ca-app-pub-2350865861527931~5445284437` (já presente nas linhas 50-53 da auditoria — **na verdade o manifesto já tem o ID prod**: `ca-app-pub-2350865861527931~5445284437`). **Verificar:** o test ID listado em `SECURITY.md` é histórico — o estado atual do manifesto está correto.
- **Status:** **possivelmente já resolvido**. Re-confirmar lendo o manifest atual.

---

## BUG-012 — `INFOS.md` no disco com secrets plain text (referência cruzada)

> Documentado em `SECURITY.md`. Mantido aqui para visibilidade.

- **Severidade:** P1
- **Classificação:** [AMBOS] (operacional)
- **Status:** "remediação aplicada" (gitignored), mas ação manual pendente: mover conteúdo para vault + deletar do disco.
- **Recomendação:** ver `archive/security-original.md` §"Pendente urgente".

---

## BUG-013 — Senha postgres histórica vazada em git (referência cruzada)

> Documentado em `SECURITY.md` como "CRÍTICO".

- **Severidade:** P0 (operacional, não-código)
- **Classificação:** [AMBOS]
- **Status:** scripts já refatorados para env, mas **rotação de senha postgres ainda pendente** (manual em Supabase Dashboard).
- **Recomendação:** ação imediata — rotacionar senha + revogar PAT kids-paint.

---

## BUG-014 — Sem REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (verificado, justificável)

- **Severidade:** P3 (decisão de design)
- **Classificação:** [ANDROID]
- **Sintoma:** permissão ausente no `AndroidManifest.xml`.
- **Análise:** App usa `setAlarmClock()` (despertador), que bypassa Doze nativamente — não precisa whitelist de bateria. Decisão correta.
- **Status:** ✅ justificável, manter ausente.
- **Risco residual:** OEMs hostis (Xiaomi/MIUI, Huawei/EMUI) com "App auto-start" desabilitado por default ainda podem matar app inteiro → alarme cancelado.
- **Mitigação documentada:** Plan FASE 23.7 (DosyMonitorService) + onboarding guiado pra cada OEM.

---

## BUG-015 — Resposta de erro "user not found" em `send-test-push` permite enumeration

- **Severidade:** P0 (mesmo nível do BUG-002, sub-issue)
- **Classificação:** [AMBOS]
- **Onde:** `supabase/functions/send-test-push/index.ts:69`
- **Sintoma:** retorna 404 com mensagem `user not found: ${email}` se email não existe; retorna 200 se existe.
- **Recomendação:** retornar resposta neutra `{ ok: true, sent: 0 }` em ambos os casos.

---

## Resumo

| ID | Severidade | Classificação | Componente | Status |
|---|---|---|---|---|
| BUG-001 | P2 | [AMBOS] | Patient name encoding | Aberto |
| BUG-002 | **P0** | [AMBOS] | Edge fn `send-test-push` sem auth admin | Aberto |
| BUG-003 | P2 | [AMBOS] | Edge fn `delete-account` sem rate limit | Aberto |
| BUG-004 | P2 | [AMBOS] | RPC `extend_continuous_treatments` sumiu | Aberto (mitigação por pg_cron) |
| BUG-005 | P1 | [ANDROID] | `ic_stat_dosy` ausente | Aberto |
| BUG-006 | P1 (web) / P3 (Android) | [WEB-ONLY] | AdSense placeholder | Aberto |
| BUG-007 | P3 | [AMBOS] | TS 6.0.3 — verificar | Aberto |
| BUG-008 | P2 | [AMBOS] | min_password_length=6 | Aberto |
| BUG-009 | P3 | [AMBOS] | `enable_confirmations=false` em config | Aberto |
| BUG-010 | P3 | [AMBOS] | `coverage/` versionado? | Verificar |
| BUG-011 | P1 | [ANDROID] | AdMob app ID — possivelmente já OK | Verificar |
| BUG-012 | P1 | [AMBOS] | INFOS.md no disco | Aberto (manual) |
| BUG-013 | **P0** | [AMBOS] | Rotacionar senha postgres | Aberto (manual) |
| BUG-014 | P3 | [ANDROID] | Sem ignore battery opt | ✅ justificado |
| BUG-015 | **P0** | [AMBOS] | Email enumeration `send-test-push` | Aberto (parte do BUG-002) |

**P0:** 3 bugs | **P1:** 4 | **P2:** 4 | **P3:** 4 | ✅ resolvidos: 1

---

## Bugs cobertos pela auditoria — aviso

Esta auditoria foi **majoritariamente estática** (leitura de código + 15 min de live nav). Bugs típicos que **só aparecem em uso prolongado** ainda não foram caçados:

- ❓ Race conditions em multi-clique rápido (criar treatment → marcar dose imediatamente)
- ❓ Comportamento offline (TanStack persistor + retry)
- ❓ Slow 3G simulado
- ❓ Rotação de tela / responsivo em viewport pequeno (testar em 360x640)
- ❓ Acessibilidade real com TalkBack/VoiceOver
- ❓ Limites Free (1 paciente) — comportamento ao tentar criar 2º paciente
- ❓ Editar tratamento ativo — afeta doses futuras corretamente?
- ❓ Geração PDF com 50+ doses
- ❓ Compartilhar paciente (`patient_shares`) — fluxo cross-user
- ❓ Reset password fluxo completo

**Recomendação:** sessão estendida (90 min) de exploração com 5 personas (idoso, cuidador, paciente 8 meds, click-everything, malicious) DEVE rodar antes do Beta interno.
