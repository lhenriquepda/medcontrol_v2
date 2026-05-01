# 03 — Checklist de Lançamento (consolidado e ordenado)

> Itens numerados sequencialmente, mesma numeração de `ROADMAP.md`. Cada um tem origem ([Plan.md] / [Auditoria] / [Plan.md + Auditoria]), esforço estimado, dependências e critério de aceitação.
>
> **Metodologia:** combina pendentes do `archive/plan-original.md` (linhas com `[ ]`, "Pendente", "Manual", "Backlog") + achados desta auditoria (25 dimensões). Ordenação: P0 → P1 → P2 → P3, considerando dependências técnicas.

---

## 🔴 P0 — Bloqueadores de Produção

### #001 — Adicionar auth check de admin em `send-test-push` Edge Function
- **Status:** ✅ Concluído @ commit 37c8fee (2026-05-01)
- **Origem:** [Auditoria] (BUG-002)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Severidade:** Crítica — qualquer authenticated user pode invocar; usa service_role
- **Snippet:**
  ```ts
  // supabase/functions/send-test-push/index.ts
  Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('POST only', { status: 405 })
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    }
    const jwt = authHeader.slice(7)
    const { data: { user }, error } = await supabase.auth.getUser(jwt)
    if (error || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!admin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    // ... resto da função
  })
  ```
- **Aceitação:** chamada sem JWT → 401. Chamada com JWT non-admin → 403. Chamada admin → push enviado. Email não-existente → resposta neutra `{ ok: true, sent: 0 }` (sem 404).
- **Detalhe:** [auditoria/04-supabase.md §7.2](auditoria/04-supabase.md#72-send-test-pushindexts-120-linhas--crítico) · [auditoria/06-bugs.md#bug-002](auditoria/06-bugs.md#bug-002--edge-function-send-test-push-não-valida-autorização-auditoria-estática)

### #002 — Sanitizar erro de email enumeration em `send-test-push`
- **Status:** ✅ Concluído @ commit 37c8fee (2026-05-01)
- **Origem:** [Auditoria] (BUG-015)
- **Esforço:** 5 min (parte do #001)
- **Dependências:** #001
- **Aceitação:** retornar `{ ok: true, sent: 0 }` em todos os fluxos (email não-existente, sem tokens, etc), nunca expor existência de email no response body/status.
- **Detalhe:** [auditoria/06-bugs.md#bug-015](auditoria/06-bugs.md#bug-015--resposta-de-erro-user-not-found-em-send-test-push-permite-enumeration)

### #003 — Rotacionar senha postgres histórica + revogar PAT kids-paint
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md (SECURITY.md) + Auditoria] (BUG-013)
- **Esforço:** 30 min (manual)
- **Dependências:** nenhuma
- **Aceitação:**
  - Senha postgres rotacionada via Supabase Dashboard → Project `dosy-app` → Settings → Database → Reset password
  - PAT `sbp_aedc82d7...` revogado em https://supabase.com/dashboard/account/tokens (conta dona kids-paint)
  - Nova senha em password manager (1Password/Bitwarden), não em arquivo plain text
  - `INFOS.md` na raiz movido para vault + deletado do disco + lixeira esvaziada
- **Detalhe:** [archive/security-original.md](archive/security-original.md) seções "CRÍTICO" e "ALTO"

### #004 — Vídeo demo FOREGROUND_SERVICE_SPECIAL_USE para Play Console
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 18.9.1
- **Esforço:** 2-3h (gravar + editar + upload YouTube unlisted + Console form)
- **Dependências:** nenhuma
- **Aceitação:**
  - Vídeo ~30s em YouTube unlisted demonstrando alarme crítico de dose: criar tratamento → bloquear telefone → alarme dispara fullscreen sobre lockscreen → Tomada/Pulada
  - Console: `Conteúdo do app` → `Permissões de serviço em primeiro plano` → URL preenchida
  - Campos descritivos em PT-BR explicando uso médico
- **Bloqueador:** sem isso, Closed Testing não promove para Produção

### #005 — Resolver BUG-001 — Encoding UTF-8 quebrado em nome de paciente
- **Status:** ✅ Concluído @ commit pendente (2026-05-01)
- **Origem:** [Auditoria] (BUG-001)
- **Esforço:** 1-3h (investigação + fix + verificação)
- **Dependências:** nenhuma
- **Aceitação:**
  1. ✅ Confirmado via `SELECT id, name, encode(name::bytea, 'hex')` — bytes `ef bf bd` (U+FFFD literal) presentes em 1 paciente legacy (`46d9196f` "Jo�o Teste", owner `teste03@teste.com`)
  2. ✅ Deletado via REST DELETE service_role
  3. ✅ Inserido novo paciente "João da Silva ÃÕÉÍÇãõéíç" via REST como teste03 → re-lido do DB → bytes idênticos UTF-8 puros (`c3 a3` para "ã" etc) → cleanup
  4. ⚠️ Playwright não está no repo. Substituído por **recipe documentado** em `contexto/updates/2026-05-01-fix-encoding-utf8-pacientes.md` (script Python pronto pra reauditoria periódica). Adicionar Playwright = item separado novo (P3).
- **Detalhe:** [auditoria/06-bugs.md#bug-001](auditoria/06-bugs.md#bug-001--encoding-utf-8-quebrado-em-nome-de-paciente)
- **Causa raiz:** seed legacy inserido durante dev cedo via tooling com encoding ruim (Windows-1252). DB Postgres é UTF-8 default; PostgREST round-trip funciona corretamente. Sem mudança de código necessária.

### #006 — Validação manual em device físico (FASE 17 Plan)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 17 + [Auditoria]
- **Esforço:** 1-2 dias (manual, 3 devices)
- **Dependências:** #001, #003 (bugs P0 corrigidos)
- **Aceitação:** rodar `docs/device-validation-checklist.md` em 3 devices (versões 12, 13, 14):
  - Pixel (stock Android)
  - Samsung A14 (One UI battery saver ON)
  - Xiaomi Redmi (MIUI agressivo) ou Motorola
  - Validar: alarme dispara locked + unlocked + app killed + DND + após reboot + adiar 10min funciona + FLAG_SECURE bloqueia screenshot + biometria (se wired) + responsividade
- **Saída:** issues em backlog ou re-abertura de sub-fase relevante

### #007 — Adicionar telemetria `notification_delivered` em PostHog (regressão silenciosa)
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 14)
- **Esforço:** 1-2h
- **Dependências:** PostHog key configurada (#018)
- **Aceitação:**
  - Evento PostHog `notification_delivered` disparado quando push FCM chega (background) e quando LocalNotif fire
  - Evento `notification_dismissed` / `notification_action_taken` (Tomada/Pular/Adiar)
  - Dashboard mostra taxa de entrega ≥ 99%
  - Alerta PostHog: queda > 5% em 1h dispara notif Slack/email
- **Justificativa:** SEM esta métrica, regressão em alarmes (a coisa mais crítica do app) passa despercebida em produção. Healthcare = não-negociável.

### #008 — Configurar `SENTRY_AUTH_TOKEN` + `ORG` + `PROJECT` em GitHub Secrets
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 10.1 manual pendente
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Aceitação:**
  - Secrets configurados em GitHub Actions
  - Próximo build CI envia source maps automaticamente para Sentry
  - Validar via Sentry → Releases → ver release tag `dosy@0.1.6.10` (próxima versão)

### #009 — Configurar PITR (Point-in-Time Recovery) e testar restore drill
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 21 §11)
- **Esforço:** 30 min config + 2h drill
- **Dependências:** Supabase Pro plan upgrade (custo)
- **Aceitação:**
  - PITR habilitado (Supabase Dashboard → Settings → Backups)
  - Retenção mínimo 7 dias
  - Drill executado: criar staging project, restaurar backup recente, validar dados íntegros
  - Runbook escrito: `docs/runbook-dr.md`

---

## 🟠 P1 — Alta Prioridade (pré-soft-launch)

### #010 — Criar `ic_stat_dosy` notification icon
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (BUG-005)
- **Esforço:** 1h (designer + ImageMagick + cap sync)
- **Dependências:** nenhuma
- **Aceitação:**
  - `ic_stat_dosy.xml` (vector) em `android/app/src/main/res/drawable-anydpi-v33/`
  - PNG fallback monocromático 24x24dp em `drawable-mdpi/hdpi/xhdpi/xxhdpi`
  - APK rebuild → notif aparece com silhueta correta no system tray
- **Detalhe:** [auditoria/06-bugs.md#bug-005](auditoria/06-bugs.md#bug-005--ic_stat_dosy-referenciado-mas-ausente-nos-drawables)

### #011 — Adicionar `<label>` explícito em inputs Login (A11y idosos)
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 7)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:** Login.jsx tem `<label htmlFor="email">` e `<label htmlFor="password">` visíveis acima dos inputs. TalkBack lê corretamente.

### #012 — Recriar policies RLS com `TO authenticated` explícito
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 8.3 backlog
- **Esforço:** 2-3h (migration + testes)
- **Dependências:** nenhuma
- **Aceitação:**
  - Migration `supabase/migrations/{ts}_refine_policies_to_authenticated.sql`
  - Todas policies em medcontrol têm `TO authenticated`
  - Pen test: anon role acessa ≠ falha; authenticated do user A acessa user B = falha
- **Detalhe:** [auditoria/04-supabase.md §15.2](auditoria/04-supabase.md#152-audit-de-policies)

### #013 — Splitar policies `cmd=ALL` em 4 separadas
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 8.3 backlog (Aud 5.2 G9)
- **Esforço:** 2h
- **Dependências:** #012
- **Aceitação:**
  - Tabelas com `cmd=ALL` (push_subs, user_prefs, subscriptions, security_events) divididas em SELECT/INSERT/UPDATE/DELETE
  - Cada policy com `using` + `with_check` apropriado

### #014 — Recriar RPC `extend_continuous_treatments` (BUG-004)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 + [Auditoria]
- **Esforço:** 3-4h
- **Dependências:** nenhuma
- **Aceitação:**
  - Migration `supabase/migrations/{ts}_recreate_extend_continuous_treatments.sql`
  - Função `(p_days_ahead int) RETURNS json`, SECURITY DEFINER, `SET search_path = medcontrol, pg_temp`
  - Validação ownership via `auth.uid()`
  - Reativar chamadas em `Dashboard.jsx` (mount + handleRefresh)
  - Teste: criar tratamento contínuo → mocar agora() para 7d depois → `dosesAdded > 0`

### #015 — Configurar PostHog key + dashboards launch
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 14.1 manual
- **Esforço:** 1-2h (criar conta + key + dashboards básicos)
- **Dependências:** nenhuma
- **Aceitação:**
  - Conta PostHog criada
  - Key em GitHub Secret `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST`
  - Próximo build CI envia eventos
  - Dashboards: DAU/WAU/MAU, retention D1/D7/D30, funnel signup→first_dose, NPS

### #016 — Configurar alertas Sentry (crash spike, error threshold)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 14.2 manual
- **Esforço:** 30 min
- **Dependências:** projeto Sentry com release tag (já feito FASE 7.3)
- **Aceitação:**
  - Alert rule: crash count > 10 em 1h → email/Slack
  - Alert rule: novo issue crítico (não visto antes) → notificação imediata
  - Threshold: ANR rate > 0.5%

### #017 — Wire LockScreen UI + integração biometria (`useAppLock`)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 11.3 → 12 ou 23
- **Esforço:** 4-6h
- **Dependências:** device físico para teste
- **Aceitação:**
  - LockScreen overlay em `main.jsx` antes de App
  - Toggle "App Lock" em Settings (default OFF)
  - Auto-lock após 5min em background (default 5)
  - Biometria desbloqueia (digital/face)
  - Fallback PIN se biometria não disponível
  - Tested em device físico

### #018 — AdSense IDs reais (web — não-bloqueante Android)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 4.3 pendente
- **Esforço:** 1h (criar conta AdSense + substituir)
- **Dependências:** verificação domínio AdSense
- **Aceitação:**
  - `index.html` script tag com publisher ID real
  - `VITE_ADSENSE_CLIENT` + `VITE_ADSENSE_SLOT` em Vercel env
  - Web mostra anúncios reais (não placeholder)
- **Notas:** [auditoria/06-bugs.md#bug-006](auditoria/06-bugs.md#bug-006--adsense-placeholder-em-produção-indexhtml). Se Beta vai só Android, P3.

### #019 — Subir `minimum_password_length` para 8 + complexity
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (BUG-008)
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Aceitação:**
  ```toml
  [auth]
  minimum_password_length = 8
  password_requirements = "lower_upper_letters_digits"
  ```
  Aplicar via Supabase Dashboard cloud + commitar `config.toml`. Frontend continua validando 8+. Senhas existentes < 8 não-quebradas (server só rejeita novas).

### #020 — Disclaimer médico visível ("Não substitui orientação")
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 18.5.1 + [Auditoria] (Dimensão 16)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  - Texto em modal aparece no primeiro signup (após consentimento checkbox)
  - Texto também em `/termos` em destaque
  - Onboarding tour menciona

### #021 — Backup keystore em 3 locais seguros
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 18.3 manual crítico
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  - 1: password manager com keystore + senhas (1Password/Bitwarden)
  - 2: pendrive offline criptografado (VeraCrypt) guardado fisicamente
  - 3: cloud cifrado (drive cifrado / pCloud Crypto)
  - Documento `docs/keystore-backup-procedure.md` com SOP
- **Risco se ignorado:** keystore perdido = app morto no Play Store, impossível publicar updates.

### #022 — Verificar TS 6.0.3 legitimidade (BUG-007)
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (BUG-007)
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Aceitação:**
  - `npm view typescript@6.0.3 maintainers` mostra `microsoft <microsoft>` ou similar oficial
  - Se confirmado oficial: deixar como está
  - Se duvidoso: degradar para `^5.7.0` e `npm install`

### #023 — Refatorar `useDoses` para `refetchIntervalInBackground: false`
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 22)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  ```js
  useQuery({
    queryKey: ['doses', filter],
    queryFn: ...,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,  // ← novo
    staleTime: 30_000,                    // ← novo
  })
  ```
  Polling pausa quando aba/app inativo. Custo Supabase reduz ~40%.

### #024 — Adicionar pre-commit hook (husky + lint-staged)
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 23)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  ```bash
  npm install -D husky lint-staged
  npx husky init
  echo "npx lint-staged" > .husky/pre-commit
  ```
  + config em package.json: `"lint-staged": { "*.{js,jsx}": ["eslint --fix", "prettier --write"] }`

### #025 — Screenshots phone retrabalho (Play Store)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 18.9.2
- **Esforço:** 2-3h (designer)
- **Dependências:** nenhuma
- **Aceitação:** 4+ screenshots phone 1080×1920 polidos em `resources/screenshots/` + uploaded em Console

### #026 — Provisionar caixa real `suporte@dosyapp.com`
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 18.5
- **Esforço:** 30 min (Google Workspace ou alias)
- **Dependências:** domínio dosyapp.com configurado
- **Aceitação:**
  - Email recebe e responde
  - Auto-responder com SLA documentada (Free 72h, PRO 24h, Plus 12h)
  - Testar mailto template em device Android real

### #027 — Promover Closed Testing track + 12 testers via Reddit
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 18.9.3
- **Esforço:** 1-2 dias setup + 14 dias passivo
- **Dependências:** #004, #006, screenshots #025
- **Aceitação:**
  - Closed Testing track com Google Group público
  - URL opt-in + posts Reddit (r/AndroidBeta, r/brasil)
  - 12+ testers ativos por 14 dias

---

## 🟡 P2 — Média Prioridade (30 dias pós-launch)

### #028 — Rate limit em `delete-account` Edge Function
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (BUG-003)
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Aceitação:** invocar 2x em < 5 min retorna 429.

### #029 — Refatorar `Settings.jsx` (541 LOC) em sub-componentes
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 + [Auditoria]
- **Esforço:** 6-8h
- **Aceitação:** orchestrator <100 LOC + 4-5 sections separadas. Tests passam, lint 0 erros.

### #030 — Refatorar `services/notifications.js` (588 LOC) em módulos
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md SECURITY.md] + [Auditoria]
- **Esforço:** 1-2 dias
- **Aceitação:**
  ```
  services/notifications/fcm.js
  services/notifications/local.js
  services/notifications/critical.js
  hooks/useNotifications.js (orchestration)
  ```

### #031 — Confirmar `FORCE_RLS` em todas as tabelas
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 21)
- **Esforço:** 30 min
- **Aceitação:** rodar SQL em [auditoria/04-supabase.md §15.6](auditoria/04-supabase.md#156-force_rls-em-todas-as-tabelas).

### #032 — Confirmar `SET search_path` em todas as funções SECURITY DEFINER
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 21)
- **Esforço:** 1h
- **Aceitação:** [auditoria/04-supabase.md §15.3](auditoria/04-supabase.md#153-audit-de-security-definer--search_path) — todas as DEFINER têm `SET search_path = medcontrol, pg_temp`.

### #033 — Adicionar React.memo em DoseCard, PatientCard, TreatmentCard
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 5)
- **Esforço:** 1h
- **Aceitação:** memoization com prop comparator. React DevTools Profiler confirma redução de re-renders em scroll de listas grandes.

### #034 — Implementar virtualização em DoseHistory + Patients (>200 itens)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 13 backlog
- **Esforço:** 4-6h
- **Aceitação:** `@tanstack/react-virtual` integrado; lista de 1000 doses scrolla sem jank em device mid-range.

### #035 — Integration tests (`useDoses`, `useUserPrefs` com mock Supabase)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 9.4 backlog
- **Esforço:** 1 dia
- **Aceitação:** 10+ tests cobrindo fluxos confirm/skip/undo + sync localStorage cache.

### #036 — Skeleton screens completos (TreatmentList, Reports, Analytics, SOS, forms)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 1 dia
- **Aceitação:** todas as pages com loading state visual durante data fetch.

### #037 — Erros inline em forms
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 1 dia
- **Aceitação:** PatientForm, TreatmentForm, SOS, Settings com mensagens de erro abaixo de cada campo, não só toast.

### #038 — Pen test interno completo documentado
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 8.4 + 20.3
- **Esforço:** 1-2 dias
- **Aceitação:**
  - User A → user B via API direta (curl) com JWT roubado → falha
  - Tampering APK + Play Integrity (se #047 implementado)
  - Burp/mitmproxy análise tráfego (cert pinning bloqueia)
  - Documento `docs/audits/pentest-interno.md`

### #039 — Confirmação dupla ao deletar batch (>10 itens)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 2h
- **Aceitação:** quando há >10 itens selecionados para delete, modal "Tem certeza? Esta ação não pode ser desfeita".

### #040 — Subir contraste textos secundários no dark
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 2h (revisar `theme.css`)
- **Aceitação:** axe DevTools confirma WCAG AA em todas as pages dark mode.

### #041 — Hierarquia headings + Dynamic Type via `rem`
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 4h
- **Aceitação:** font-scale 200% Android funciona; headings semânticos h1>h2>h3.

### #042 — Lighthouse mobile ≥90 em Reports + Dashboard
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 17 manual
- **Esforço:** depende de findings (parcial pode ser 1 dia)
- **Aceitação:** Lighthouse score ≥90 nas duas pages chave.

### #043 — Performance scroll lista 200+ doses sem jank
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 17
- **Esforço:** já coberto por #034 (virtualização)
- **Aceitação:** validar em device mid-range (Samsung A14).

### #044 — Recriar RPC `register_sos_dose` se houve drift schema
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 0.3 (verificar continua)
- **Esforço:** 30 min audit
- **Aceitação:** rodar `tools/test-sos-bypass.cjs` confirma trigger ainda bloqueia INSERT direto type=sos.

### #045 — Auditar `coverage/` no `.gitignore`
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (BUG-010)
- **Esforço:** 5 min
- **Aceitação:** `git check-ignore coverage/` retorna 0.

### #046 — Documentar runbook de Disaster Recovery
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.4
- **Esforço:** 1 dia
- **Aceitação:** `docs/runbook-dr.md` com SOPs para: keystore lost, DB corrupted, Supabase outage, Vercel down, Sentry full-replay restore.

### #047 — Google Play Integrity API
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 11 → 23 backlog
- **Esforço:** 1 dia
- **Aceitação:** APK modificado falha attestation; produção rejeita chamadas sem token válido.

### #048 — `tools/supabase.exe` removido do git (se versionado)
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 24)
- **Esforço:** 30 min (BFG ou git-filter-repo se versionado)
- **Aceitação:** `git ls-files tools/supabase.exe` vazio + `.gitignore` cobre.

### #049 — Pen test profissional (FASE 20)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 20.3
- **Esforço:** depende fornecedor (1-2 semanas)
- **Aceitação:** relatório com severidades; zero crit/high abertos.

---

## 🟢 P3 — Melhorias (90 dias)

### #050 — Audit_log abrangente (triggers UPDATE/DELETE)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.2 G12)
- **Esforço:** 1-2 dias

### #051 — 2FA opcional via TOTP
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.4 G10)
- **Esforço:** 1 dia (`auth.mfa.totp.enroll_enabled = true` + UI)

### #052 — Criptografia client-side de `observation`
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.4 G11)
- **Esforço:** 2-3 dias

### #053 — Logout remoto multi-device + tela "Dispositivos conectados"
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5
- **Esforço:** 1-2 dias

### #054 — Notif email + push ao login em device novo
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5
- **Esforço:** 1 dia

### #055 — Session replay (Sentry Replay ou PostHog) — **opcional, privacy concern**
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5
- **Esforço:** 1 dia
- **Risco:** healthcare = revisar antes (pode capturar dados sensíveis). Plan disabled session replay.

### #056 — Visual regression tests (Chromatic/Percy)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.6 G9)

### #057 — Performance budget em CI (size-limit/bundlesize)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5

### #058 — TypeScript migration (ou JSDoc + tsc --checkJs)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.1 G10)

### #059 — `dosy_alarm.mp3` custom sound
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 2.5

### #060 — Detecção root/jailbreak
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23 backlog
- **Aguarda:** plugin community Capacitor 8 maintained

### #061 — Drag-sort de pacientes
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog

### #062 — Anexar comprovantes/imagens em doses (PRO)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 2-3 dias (Supabase Storage policies + UI)

### #063 — Avaliar remoção de `mockStore.js`
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog

### #064 — Verificação de interações medicamentosas + alergia
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 11)
- **Esforço:** 1 semana (banco bulário ANVISA + lógica)
- **Diferenciador healthcare**

### #065 — Estoque + alerta "está acabando"
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 11)
- **Esforço:** 1 semana

### #066 — Lembrete de consulta médica
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 11)

### #067 — DosyMonitorService (FASE 23.7)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.7
- **Esforço:** 1 semana
- **Trigger:** se feedback Open Testing reportar alarms missing em Xiaomi/OnePlus

### #068 — iOS via Capacitor
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.6

### #069 — Internacionalização (en, es)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.6

### #070 — Plano Family (até 5 usuários)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.6

### #071 — Programa afiliados (5-10% recorrente)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.3

### #072 — A/B test paywall e onboarding (PostHog feature flags)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.2

### #073 — Programa de indicação (1 mês PRO grátis)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 22.3

### #075 — Reduzir agressividade React Query global (mitiga lentidão geral)
- **Status:** ⏳ Aberto
- **Origem:** [Sessão v0.1.7.0] Análise lentidão reportada pelo user
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Severidade:** alta — combina com #023 + #076 pra fix completo de lentidão/travamento
- **Snippet:**
  ```js
  // src/main.jsx — defaultOptions atual:
  // staleTime: 0
  // refetchOnMount: 'always'
  // refetchOnWindowFocus: true
  //
  // Mudar para:
  staleTime: 30_000,           // 30s — cache fresh por 30s, evita refetch redundante
  refetchOnMount: true,        // só se stale (não 'always')
  refetchOnWindowFocus: true,  // mantém — útil pós-idle curto
  ```
- **Aceitação:**
  - Navegação interna entre pages não dispara refetch se query foi feita há <30s
  - Volta de aba ainda refresh (refetchOnWindowFocus mantido)
  - DoseModal abre rápido (não espera refetch redundante)
  - Lint passa
- **Riscos:**
  - Alarme/notif: zero (config TanStack ≠ alarme nativo Android que vive em SharedPreferences)
  - Realtime: zero (websocket independente)
  - Stale data 30s: aceitável pra healthcare; doses mudam minutos, não segundos

### #076 — Refatorar useAppResume — recovery sem reload destrutivo (BUG-016)
- **Status:** ⏳ Aberto
- **Origem:** [Sessão v0.1.7.0] User reportou "app trava após ficar aberto muito tempo"
- **Esforço:** 2h
- **Dependências:** nenhuma
- **Severidade:** alta — causa raiz do travamento observado
- **Causa atual:** após 5min idle, `useAppResume.js` força `window.location.href = '/'`. Isso causa cold reload + perda de URL + tela branca 1-3s + cascata de refetch. Se algo falhar nesse reload (SW velho, JWT expirado, race condition), app fica em estado quebrado até hard close de Chrome.
- **Snippet (proposta):**
  ```js
  // src/hooks/useAppResume.js
  // Antes: window.location.href = '/'  (destrutivo)
  // Depois: cleanup + invalidate + reconnect realtime, preservando URL
  if (inactiveMs >= STALE_RELOAD_THRESHOLD_MS) {
    console.log('[useAppResume] long idle', inactiveMs, 'ms → soft recover')
    // 1. Force JWT refresh (Supabase rotaciona refresh token)
    await supabase.auth.refreshSession()
    // 2. Force realtime reconnect (drops dead websockets)
    supabase.removeAllChannels()
    // 3. Invalidate all queries — refetch fresh
    await qc.invalidateQueries()
    // 4. Refetch active queries
    await qc.refetchQueries({ type: 'active' })
    // URL preservada. Sem reload.
  }
  ```
- **Aceitação:**
  - App fica aberto 15min idle → volta foco → não força reload
  - Estado UI preservado (url, modais abertos, scroll position)
  - Doses recentes carregam (queries refetched)
  - Realtime resubscribe (dose tomada em outro device aparece)
  - Manual: device físico Android + 30min idle + voltar → app responde sem cold start
- **Riscos:**
  - Alarme nativo: zero (vive separado em AlarmReceiver + SharedPreferences)
  - Notif FCM: zero (background handler separado)
  - Edge case: se `supabase.auth.refreshSession()` falhar (refresh token expirado), redirect pra login (já handled em supabase.js auth listener)
- **Detalhe:** BUG-016 catalogado em `auditoria-live-2026-05-01/` (nova pasta criada na sessão se necessário)

### #077 — Listener TOKEN_REFRESHED em useRealtime (resubscribe pós JWT rotation)
- **Status:** ⏳ Aberto
- **Origem:** [Sessão v0.1.7.0]
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Severidade:** média — robustez. Sem isso, websocket pode morrer silenciosamente após Supabase rotacionar JWT (default 1h)
- **Snippet:**
  ```js
  // src/hooks/useRealtime.js — adicionar dentro do useEffect
  const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
      unsubscribe()
      subscribe()
    }
  })
  // cleanup: authSub.subscription.unsubscribe()
  ```
- **Aceitação:**
  - Forçar JWT refresh (via `supabase.auth.refreshSession()` no console) → realtime resubscribe ocorre
  - Console log mostra resubscribe disparado
  - Dose tomada em device A após 1h+ aparece em device B (longe-evita)
- **Riscos:** zero — adiciona robustez

### #078 — Bumpar SW cache version v5 → v6 (invalidar bundles velhos)
- **Status:** ⏳ Aberto
- **Origem:** [Sessão v0.1.7.0]
- **Esforço:** 5 min
- **Dependências:** nenhuma
- **Severidade:** baixa — limpeza. SW pode estar servindo bundle velho de v0.1.6.x se cache não rotaciona
- **Snippet:**
  ```js
  // public/sw.js linha 1
  // ANTES: const CACHE = 'medcontrol-v5'
  // DEPOIS: const CACHE = 'medcontrol-v6'
  ```
- **Aceitação:**
  - Após próximo deploy, SW activate event deleta cache `medcontrol-v5` e cria `medcontrol-v6`
  - Devices com bundle velho cached forçam download fresh
- **Convenção:** bumpar a cada release com mudança de bundle JS (esquecer = bug serve velho). **TODO:** automatizar em vite plugin (P2 futuro).

### #074 — Habilitar upload de debug symbols no Play Console
- **Status:** ⏳ Aberto
- **Origem:** [Sessão v0.1.6.10] Aviso recorrente Play Console
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Severidade:** baixa — não bloqueia release; melhora qualidade de stack traces de crashes/ANRs no Console
- **Snippet:**
  ```gradle
  // android/app/build.gradle dentro de android { ... }
  android {
      buildTypes {
          release {
              ndk {
                  debugSymbolLevel 'FULL'  // ou 'SYMBOL_TABLE' (mais leve)
              }
          }
      }
  }
  ```
- **Aceitação:**
  - Próximo AAB build inclui símbolos de depuração nativos
  - Play Console não exibe mais aviso "App Bundle contém código nativo, e você não fez upload dos símbolos de depuração"
  - Crashes nativos no Console mostram stack traces simbolicados em vez de offsets brutos
- **Detalhe:** Aviso aparece em todo upload AAB enquanto não habilitado. Sem impacto no usuário final; só dev observability. Tamanho AAB sobe ~5-10 MB com FULL.

---

## Resumo

- **P0:** 9 itens — restantes: 6 abertos após fechamento de #001/#002/#005 em v0.1.6.10
- **P1:** 22 itens (#010-027 + #075-#078 v0.1.7.0) · esforço estimado: ~10-15 dias-pessoa
- **P2:** 22 itens (#028-049) · esforço estimado: ~3-4 semanas-pessoa
- **P3:** 25 itens (#050-073, #074) · esforço estimado: 90+ dias

**Soft-launch (P0+P1):** ~15-20 dias-pessoa.
**Produção pública (após Open Testing 14 dias + #001-027):** ~6 semanas total.

---

## Sequência sugerida

```
Sem 1: P0 #001-005 + #007 + #008 (segurança + UTF-8 + telemetria)
Sem 2: P0 #004 vídeo + #006 device validation + P1 #010-016
Sem 3: P1 #017-022 + Closed Testing #027 inicia
Sem 4: P1 #023-026 + iteração feedback + Closed dia 7
Sem 5-6: Closed Testing dia 14 + P2 começo + Open Testing
Sem 7+: Produção rollout 5%→100% + P2 + P3 backlog
```

→ Ver `ROADMAP.md` para versão consolidada com links cruzados.
