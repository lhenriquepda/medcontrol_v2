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
- **Status:** ✅ Concluído (2026-05-04)
- **Origem:** [Plan.md (SECURITY.md) + Auditoria] (BUG-013)
- **Esforço:** 30 min (manual)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ Senha postgres rotacionada via Supabase Dashboard `guefraaqbkcehofchnrc/database/settings` → Reset password (auto-generated 16-char strong, salva password manager user)
  - ✅ PAT `sbp_aedc82d7...` (conta `lhenrique.pda@gmail.com` dona kids-paint) já revogado anteriormente — verificado 2026-05-04: "No access tokens found" naquela conta
  - ✅ Nova senha em password manager user (entrada `Supabase Dosy postgres pwd (production)`)
  - ✅ `INFOS.md` ausente localmente e do git history (limpo via git-filter-repo durante #084 v0.1.7.5)
- **Detalhe:** [archive/security-original.md](archive/security-original.md) seções "CRÍTICO" e "ALTO"

### #004 — Vídeo demo FOREGROUND_SERVICE_SPECIAL_USE para Play Console
- **Status:** ✅ Concluído (2026-05-04)
- **Origem:** [Plan.md] FASE 18.9.1
- **Esforço:** 2-3h (gravar + editar + upload YouTube unlisted + Console form)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ Vídeo `alarm.mp4` (33s) gravado S25 Ultra Dosy Dev demonstrando: cadastro de tratamento → tela bloqueada → alarme fullscreen disparando sobre lockscreen → Tomada/Adiar/Pular
  - ✅ Upload YouTube como Shorts unlisted: https://www.youtube.com/watch?v=qLBCzualcCw
  - ✅ Play Console: Conteúdo do app → Permissões de serviço em primeiro plano → "Outro/Uso especial" + URL vídeo + descrição completa PT-BR (1082 chars) explicando categoria SPECIAL_USE necessária para alarmes médicos críticos não-cobertos pelas categorias padrão
  - ✅ Salvo (mensagem "A mudança foi salva")
- **Pendente:** envio pra revisão Google via Visão geral da publicação (junto com mudanças #025 + outras)

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
- **Status:** ✅ Concluído (verificado 2026-05-04 — secrets criados em 2026-04-28)
- **Origem:** [Plan.md] FASE 10.1 manual pendente
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ Secrets configurados em GitHub Actions: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG=lhp-tech`, `SENTRY_PROJECT=dosy`, `VITE_SENTRY_DSN` (criados 2026-04-28)
  - ✅ Workflows `.github/workflows/ci.yml` + `android-release.yml` referenciam os 4 secrets corretamente em build step
  - ⚠️ Próximo build CI envia source maps — **bloqueado por #127** (CI failing por lint errors pré-existentes em AnimatedRoutes.jsx, não relacionados aos secrets). Quando CI passar, upload funciona auto.
- **Validação pendente:** Sentry → Releases → ver release tag `dosy@0.2.0.6` aparecer após próximo CI run bem-sucedido (depende #127)

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
- **Status:** ✅ Concluído @ commit cbfc813 (2026-05-04) — validado device S25 Ultra
- **Origem:** [Auditoria] (BUG-005)
- **Esforço:** 1h (designer + ImageMagick + cap sync)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ `ic_stat_dosy.xml` vector drawable 24dp em `android/app/src/main/res/drawable/` (single source escala todas densidades; substituiu PNG colorida 96x96 stale).
  - ✅ 3 paths Java nativos (AlarmReceiver/AlarmActivity/AlarmService) trocados de `R.mipmap.ic_launcher` → `R.drawable.ic_stat_dosy` + `setColor(0xFFFF6B5B)` accent peach.
  - ✅ Validação visual S25 Ultra Dosy Dev: notificação dispara, status tray mostra silhueta correta.
- **Detalhe:** [auditoria/06-bugs.md#bug-005](auditoria/06-bugs.md#bug-005--ic_stat_dosy-referenciado-mas-ausente-nos-drawables)

### #011 — Adicionar `<label>` explícito em inputs Login (A11y universal — TalkBack/screen readers)
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
- **Status:** ✅ Concluído @ commit 869ab34 (2026-05-04) — validado device S25 Ultra
- **Origem:** [Plan.md] FASE 11.3 → 12 ou 23
- **Esforço:** 4-6h
- **Dependências:** nenhuma
- **Aceitação (todos validados em S25 Ultra Dosy Dev):**
  - ✅ LockScreen overlay em App.jsx (camada lógica equivalente a main.jsx — AuthProvider necessário pra signOut escape hatch)
  - ✅ Toggle "Bloqueio do app" em Settings seção "Privacidade e segurança" (native-only, default OFF) — toast feedback + dropdown timeout aparece quando ON
  - ✅ Auto-lock após N min em background (validado timeout 1min, configurável 1/5/15/30/60min via Dropdown)
  - ✅ Biometria desbloqueia (digital/face) via `@aparajita/capacitor-biometric-auth` 10.x
  - ✅ Cold start: app abre direto na tela de bloqueio
  - ✅ Cancelar prompt biometria (back button) mantém bloqueado + botões Desbloquear/Sair-da-conta visíveis
  - ✅ Disable toggle exige biometria (anti-tamper)
  - ✅ Fallback senha celular via `allowDeviceCredential: true`

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
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01) — release v0.1.7.0
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
- **Status:** ✅ Concluído (2026-05-04)
- **Origem:** [Plan.md] FASE 18.9.2
- **Esforço:** 2-3h (designer)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ 19 screenshots brutos capturados S25 Ultra Dosy Dev (1080×2340 atende mínimo 1080px Play Store)
  - ✅ Triagem: 8 melhores escolhidas em `resources/prints/processado/` ordenadas 01-08 (alarme multi-dose · início multi-paciente · análises · marcar dose · relatórios · paciente · histórico · onboarding alarme)
  - ✅ Plus assets gerados via sharp: `icon-512-peach.png` (composto icon-background + logo-mono-light, safe margin 17% H · 37% V) + `feature-graphic-1024x500.png` (gradient peach + tagline) + `yt-avatar-800.png` + `yt-banner-2560x1440.png`
  - ✅ Upload Play Console: ícone 512 + 8 screenshots phone uploadados, Salvar persistido como rascunho
  - ✅ Listagem da loja → campo Vídeo preenchido com URL YouTube unlisted
- **Pendente:** envio pra revisão Google via Visão geral da publicação

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
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01)
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

### #076 — Refatorar useAppResume — recovery sem reload destrutivo
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01) — validado live: app recupera URL+state ao voltar foco, sem cold reload. Mitigação parcial do BUG-016 (não previne perda de notif idle, só recovery UX).
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
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01)
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
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01)
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

### #079 — Realtime heartbeat keep-alive — caminho 1 de 3 (defense-in-depth)
- **Status:** ✅ Concluído @ commit b4812e0 (2026-05-01) — release v0.1.7.1
- **Origem:** [auditoria-live-2026-05-01] BUG-016 — push + alarme não disparam após 16min idle. Premissa universal: muitos users (cuidadores, pais, profissionais, idosos) deixam app aberto em background — idle deve ser ilimitado.
- **Esforço:** 2-3h (impl + teste device físico)
- **Dependências:** nenhuma
- **Severidade:** P0 — healthcare-critical (dose perdida = paciente sem medicação)
- **Causa-raiz:** websocket Supabase realtime morre silenciosamente durante idle longo Android (Doze + OS network management). Sem heartbeat, sem detecção de conexão morta. App não recebe `postgres_changes` de novas doses → não agenda alarme nativo.
- **Snippet (proposta):**
  ```js
  // src/hooks/useRealtime.js — adicionar dentro do useEffect, após channel.subscribe()
  let pingTimer, pongTimer, heartbeatActive = false
  const startHeartbeat = () => {
    if (heartbeatActive) return
    heartbeatActive = true
    const tick = () => {
      // Ping interno do client Supabase
      pongTimer = setTimeout(() => {
        // Sem pong em 5s → reconnect
        console.warn('[useRealtime] heartbeat timeout — reconnecting')
        unsubscribe()
        subscribe()
        startHeartbeat()
      }, 5_000)
      // Trigger ping (se v2 supabase-js suportar)
      channel?.send({ type: 'broadcast', event: 'ping', payload: {} })
      pingTimer = setTimeout(tick, 30_000)
    }
    pingTimer = setTimeout(tick, 30_000)
    channel?.on('broadcast', { event: 'pong' }, () => clearTimeout(pongTimer))
  }
  startHeartbeat()
  // Cleanup: clearTimeout(pingTimer); clearTimeout(pongTimer)
  ```
- **Alternativa:** investigar `RealtimeClient` do supabase-js — pode já ter heartbeat configurável (`heartbeatIntervalMs`).
- **Aceitação:**
  - App idle por 30min em device físico: dose criada via DB direto APARECE no app sem precisar abrir
  - Alarme nativo agendado dentro de 30s da inserção DB
  - Reconnect automático ao detectar silent fail (logs Sentry: `[useRealtime] heartbeat timeout`)
- **Riscos:**
  - Battery drain — heartbeat 30s é leve mas existe. Considerar pausar em `appStateChange isActive=false` no Android nativo (já pausa hoje) e validar que retoma corretamente
  - Network mobile flaky — ping/pong em 3G ruim pode falsar timeout. Tunear thresholds via teste real
- **Detalhe:** [auditoria-live-2026-05-01/bugs-encontrados.md#bug-016](auditoria-live-2026-05-01/bugs-encontrados.md#bug-016)

### #080 — notify-doses reliability — caminho 2 de 3 (defense-in-depth)
- **Status:** ✅ Concluído @ commit 4b82d16 (2026-05-01) — release v0.1.7.1
- **Origem:** [auditoria-live-2026-05-01] BUG-016
- **Esforço:** 3-4h (investigação + fix + dashboard)
- **Dependências:** acesso aos logs Edge Function (PAT precisa scope `read_logs` ou via Supabase Dashboard manual)
- **Severidade:** P0 — fail-safe server-side falhou, healthcare-critical
- **Sintomas observados (BUG-016):**
  - Dose 18:55 BRT (criada 18:39 via REST direto): nem realtime, nem alarme nativo, nem push FCM
  - Dose 18:58 BRT com user recém-ativo: push chegou normal
  - 2 push_subscriptions registradas pro user (token rotation gerou múltiplos)
  - advanceMins=0 → janela ±60s no Edge query
- **Aceitação:**
  - Logs Edge `notify-doses` últimas 24h analisados — confirmar se cron rodou pra cada dose perdida
  - Implementar retry com exponential backoff em falha FCM transitória (`UNAVAILABLE`, `INTERNAL`)
  - Cleanup `push_subscriptions.deviceToken` em response FCM `INVALID_ARGUMENT` / `UNREGISTERED` (token expirado)
  - Dashboard PostHog/Sentry: alerta queda push delivery rate <99% em 1h (já item #007 + #016)
  - Métrica `notify-doses` por execução: count enviados, count sucessos, count falhas + reason
- **Investigação inicial:**
  - Confirmar `pg_cron.job_run_details` mostra cron rodou às 18:54-18:56
  - Confirmar Edge response = 200 + `sent: N` apropriado
  - Se cron OK + Edge OK + push não chegou → problema FCM-side ou token Android
- **Detalhe:** [auditoria-live-2026-05-01/bugs-encontrados.md#bug-016](auditoria-live-2026-05-01/bugs-encontrados.md#bug-016)

### #081 — Defense-in-depth Android: alarmes nativos horizonte 24-72h — caminho 3 de 3
- **Status:** ✅ Concluído @ commit 49550e4 (2026-05-01) — release v0.1.7.1. **Gate validação device 24h idle FECHADO 2026-05-02** — alarme dose teste tocou após Dosy Dev fechado por 24h sem abrir, confirmando defense-in-depth #083 funciona end-to-end real. BUG-016 100% resolvido.
- **Validação 24h idle pendente (gate final):**
  - User mantém Dosy Dev INSTALADO mas FECHADO por 1 dia inteiro (24h sem abrir)
  - Pré-test: user cadastra dose +24-30h via web (Vercel prod) ANTES fechar app
  - Esperado: alarme físico dispara no horário sem nunca user ter aberto Dosy Dev nesse intervalo
  - Confirma caminhos #083 funcionam end-to-end com app realmente idle longo (não só ~minutos)
  - Caminhos validados: 1 (trigger DB <2s), 2 (cron 6h FCM data), 4 (WorkManager 6h). Caminho 3 (rescheduleAll quando app abre) é sobre re-agendar AO ABRIR — não testado neste cenário (app fica fechado).
  - Resultado positivo → marcar #081 nota "Gate 3 em andamento" como ✅ definitivo + log em updates/
  - Resultado negativo → reabrir investigação (qual caminho falhou? logs Sentry/PostHog/Edge?)
- **Origem:** [auditoria-live-2026-05-01] BUG-016 — defense-in-depth healthcare healthcare-critical
- **Esforço:** 6-8h (impl plugin + WorkManager + teste device físico)
- **Dependências:** nenhuma
- **Severidade:** P0 — caminho mais robusto. Independe de app foreground / websocket / push.
- **Princípio:** Sistema atual depende de 1 caminho (app ativo). Muitos users deixam app aberto background, mas Android pode kill mesmo assim. Solução: agendar alarmes locais com horizonte FUTURO ao invés de só "próxima dose".
- **Estratégia:**
  1. Quando app abre / sincroniza: plugin `criticalAlarm` agenda TODAS doses dos próximos 24-72h via `setAlarmClock()` (sobrevive Doze)
  2. SharedPreferences armazena lista. `BootReceiver` re-agenda após reboot (já existe)
  3. **Novo:** `WorkManager` periódico (a cada 6-12h) sincroniza DB → reagenda alarmes recém-criados sem precisar app foreground
  4. `WorkManager` requer `WorkRequest` com `setInitialDelay` + `setPeriodic`. Bateria-friendly.
- **Snippet conceitual (Java/Kotlin Android):**
  ```java
  // android/app/src/main/java/.../DoseSyncWorker.java
  public class DoseSyncWorker extends Worker {
      public Result doWork() {
          // 1. Fetch doses próximos 72h via Supabase REST (auth via stored token)
          // 2. Diff com SharedPreferences cache
          // 3. setAlarmClock() pra novas doses, cancelAlarm() pra removidas
          return Result.success();
      }
  }
  // Schedule:
  PeriodicWorkRequest sync = new PeriodicWorkRequest.Builder(
      DoseSyncWorker.class, 6, TimeUnit.HOURS).build();
  WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
      "dose-sync", ExistingPeriodicWorkPolicy.KEEP, sync);
  ```
- **Aceitação:**
  - App fechado por 48h em device físico
  - Doses criadas via DB direto chegam até 72h depois
  - Alarme nativo dispara conforme schedule, mesmo SEM app NUNCA ter sido aberto
  - WorkManager log mostra runs periódicos no `adb shell dumpsys jobscheduler`
- **Riscos:**
  - Bateria: WorkManager a cada 6h é leve mas existir. Threshold ajustável.
  - OEMs hostis (Xiaomi/MIUI): WorkManager pode ser killed. Mitigação: combinação com `setAlarmClock()` que bypassa Doze por design.
  - Duplicação de alarmes: cuidado com idempotência ao reagendar.
- **Detalhe:** [auditoria-live-2026-05-01/bugs-encontrados.md#bug-016](auditoria-live-2026-05-01/bugs-encontrados.md#bug-016)

### #083 — FCM-driven alarm scheduling + 4 caminhos coordenados (idempotente)
- **Status:** ✅ Concluído @ commits `23deca4` + `3465ab6` + `26c51ab` (2026-05-02) — release v0.1.7.2. Validado end-to-end: cadastro web → trigger DB → Edge FCM → device agendou alarme nativo → alarme físico tocou no Android no horário.
- **Origem:** [Sessão v0.1.7.1] User pedido: "alarme funcionar mesmo sem abrir app, dose +1mês precisa tocar"
- **Esforço:** ~6-8h (Edge + Android nativo + migration + testes)
- **Dependências:** #079 #080 #081 já fechados; nenhuma externa
- **Severidade:** P0 — healthcare-critical, fecha BUG-016 100%

#### Arquitetura — 4 caminhos coordenados pra agendar alarme nativo

Cada caminho roda independente. **Idempotência via id determinístico** (`AlarmScheduler.idFromString(doseId)` — mesmo id = substitui, nunca duplica). User vê **1 alarme** mesmo se 4 caminhos tentarem agendar.

| # | Caminho | Quando dispara | Cobertura | Latência |
|---|---|---|---|---|
| **1** | Trigger DB Supabase ON INSERT/UPDATE doses | Imediato ao cadastrar/editar dose | "+30min via web, app fechado" | <2s |
| **2** | Cron Edge 6h `notify-doses-schedule` | Sweep periódico | Garantia caso trigger falhou; doses 72h adiante | até 6h |
| **3** | App `rescheduleAll()` quando abre | Toda vez user abre app | Redundância adicional | imediato |
| **4** | WorkManager DoseSyncWorker (#081 atual) | A cada 6h em background | Backup se FCM falhar entrega | até 6h |

#### Notificação push tray — fallback inteligente

> Filosofia user: "se dose tiver alarme setado, ok; se não, manda push"

- **Hoje:** `notify-doses` cron 1min manda push tray sempre (~advanceMins antes da dose)
- **Novo:** cron antes de mandar push, consulta tabela `dose_alarms_scheduled (doseId, userId, deviceId)`:
  - Se row existe → device já tem alarme nativo agendado → **skip push** (alarme fullscreen cobre)
  - Se row ausente → push é única chance → manda push tray normal

Comportamento prático user:
- Caso ideal: alarme nativo agendado → device toca despertador fullscreen no horário, sem push tray redundante
- Caso fallback: alarme não foi agendado (caminhos 1-4 falharam todos) → push tray dispara como única notificação — user vê algo, mesmo que menos crítico

#### Componentes a implementar

**A. Database migration `20260502xxxxxx_dose_alarms_scheduled.sql`:**
```sql
CREATE TABLE medcontrol.dose_alarms_scheduled (
  "doseId" uuid REFERENCES medcontrol.doses(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL,
  "deviceId" text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("doseId", "deviceId")
);
-- RLS: service_role only
```

**B. Edge Function NOVA `schedule-alarms-fcm` (cron 6h):**
- Pra cada user com push_subscription ativa, busca doses pendentes próximas 72h
- Manda FCM **data message** `{"action": "schedule_alarms", "doses": [{...}]}` pra deviceToken
- **NÃO inclui notification payload** (silencioso, só wake-up)
- Atualiza `dose_alarms_scheduled` (especulativo — assume FCM entrega)

**C. Edge Function NOVA `dose-trigger-handler` (Postgres webhook trigger):**
- Trigger ON INSERT/UPDATE em `medcontrol.doses` chama essa função
- Lógica idêntica a `schedule-alarms-fcm` mas pra dose única recém-cadastrada

**D. Edge `notify-doses` (modificada):**
- Antes de enviar push tray, query `dose_alarms_scheduled` por doseId+deviceId
- Se row existe → skip
- Se não → manda push (mantém comportamento atual)

**E. Android `FirebaseMessagingService` (handler novo):**
```java
@Override
public void onMessageReceived(RemoteMessage msg) {
  Map<String, String> data = msg.getData();
  if ("schedule_alarms".equals(data.get("action"))) {
    JSONArray doses = new JSONArray(data.get("doses"));
    for (JSONObject d : doses) {
      AlarmScheduler.scheduleDose(ctx, idFromString(d.getString("doseId")),
          parseInstant(d.getString("scheduledAt")), d);
      // Reporta ao server
      reportAlarmScheduled(ctx, d.getString("doseId"), getDeviceId());
    }
  } else {
    super.onMessageReceived(msg); // notification message — handler default
  }
}
```

**F. Android `criticalAlarm` plugin:**
- Novo método `reportAlarmScheduled(doseId)` chama Supabase REST insert dose_alarms_scheduled
- Auth via SharedPreferences (já temos via #081)

**G. App `rescheduleAll` (modificado):**
- Após agendar local: também upsert `dose_alarms_scheduled` (defesa em camadas)

#### Aceitação

1. ✅ User cadastra dose +1 mês via web. Não abre app Android. 1 mês depois alarme dispara fullscreen.
2. ✅ User cadastra dose +30min via web. Trigger manda FCM data <2s. Device agenda. 30min depois despertador toca.
3. ✅ User cadastra dose +5min via web (advanceMins=5). FCM data + cron notify-doses ambos rodam. Device agenda alarme via FCM data. Cron notify-doses ANTES de mandar push tray detecta alarme já agendado e skip — user vê apenas despertador, sem push redundante.
4. ✅ Device offline durante FCM data send. Volta online 2h depois. Cron 6h re-tenta + entrega. Device agenda. Alarme funciona.
5. ✅ User cadastra dose +5min via web. Push FCM data falha entrega total (rate limit). Cron `notify-doses` 1min detecta dose em janela, alarme NÃO agendado → manda push tray. User vê notif "dose em 1min" como fallback.
6. ✅ User abre app após 1 semana. App roda rescheduleAll. Verifica quais doses já tem alarme agendado (via local SharedPreferences). Adiciona apenas as faltantes. **Sem duplicar.**
7. ✅ 4 caminhos tentam agendar mesma dose. AlarmScheduler.scheduleDose com mesmo id = replace. user vê 1 alarme.

#### Riscos / mitigação

- **FCM data message pode ter delivery delay** (Doze mode estendido) — mitigação: cron 6h sweep + WorkManager #081 + rescheduleAll quando app abre = 4 caminhos
- **DB trigger pode falhar silenciosamente** — mitigação: cron 6h pega no próximo ciclo
- **Bateria** — wake-up FCM data 4×/dia + cron sync = baixo impacto (Slack/WhatsApp fazem dezenas/dia)
- **Latência cron 6h pra dose +30min "via web app fechado"** — mitigação: trigger DB cobre <2s

#### Implementação faseada (sub-items se quiser quebrar)

- #083.1 Migration `dose_alarms_scheduled`
- #083.2 Edge `schedule-alarms-fcm` cron 6h
- #083.3 Edge `dose-trigger-handler` + Postgres trigger
- #083.4 `notify-doses` modificação (skip se alarme agendado)
- #083.5 Android FirebaseMessagingService handler
- #083.6 `criticalAlarm` plugin: reportAlarmScheduled method
- #083.7 App rescheduleAll: upsert dose_alarms_scheduled
- #083.8 Validação device físico (idle 1 semana sem abrir app)

### #082 — Dual-app Android: Dosy Dev + Dosy oficial coexistem
- **Status:** ✅ Concluído @ commit 5b5938e (2026-05-01) — release v0.1.7.1
- **Origem:** [Sessão v0.1.7.1] User pedido: "ambiente dev independente, fácil merge em Dosy quando release"
- **Esforço:** 1h (Gradle + Firebase entry + manifest)
- **Implementação:**
  - `android/app/build.gradle`: buildTypes.debug com `applicationIdSuffix .dev` + resValue app_name "Dosy Dev"
  - `android/app/build.gradle`: buildTypes.release com resValue app_name "Dosy"
  - Firebase Console: nova app entry `com.dosyapp.dosy.dev` (registrada via Console)
  - `android/app/src/debug/google-services.json`: novo (Firebase plugin auto-escolhe por buildType)
  - `AndroidManifest.xml`: `${appLabel}` placeholder (substituído conforme variant)
  - `build.gradle`: dep `com.google.guava:guava:33.4.0-android` (resolve Worker.startWork() ListenableFuture compileClasspath)
- **Aceitação:**
  - Studio Run debug → instala "Dosy Dev" (`com.dosyapp.dosy.dev`) no device
  - Build release → AAB "Dosy" (`com.dosyapp.dosy`) pra Play Store
  - Apps coexistem no mesmo device, dados isolados
  - Push FCM funciona em dev (Firebase entry .dev separada)
- **Validado:** Gate 1 (build OK + instalou) ✅ via Android Studio Run em emulador

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

### #084 — Hotfix v0.1.7.5: rotação service_role JWT + JWT secret Supabase + reconectar Vercel↔GitHub
- **Status:** ⏳ Aberto — sessão dedicada próxima
- **Origem:** INCIDENTE 2026-05-02 22:23 UTC. Migration `20260502091000_dose_trigger_webhook.sql` (commit original `85d5e61`) foi commitada com service_role JWT inline. GitGuardian + GitHub Security flagged em ~6min. Histórico do branch reescrito via `git-filter-repo` + force push (commit `6310c1e`). Tag `pre-secret-purge-backup` empurrada origin como referência.
- **Severidade:** P0 security — service_role bypassa RLS = exposição teórica de TODOS dados saúde de TODOS users (LGPD categoria especial). Chave permanece em GitHub commit cache + indexers externos (Google cache, Wayback, etc) por tempo indeterminado.
- **Esforço:** ~30-60min (sessão dedicada)
- **Dependências:** nenhuma (independente)

#### Janela de exposição

- **Leak:** 2026-05-02 ~22:23 UTC (push original `85d5e61`)
- **Purge:** 2026-05-02 ~22:29 UTC (force push `6310c1e`)
- **Window in-repo:** ~6min
- **Window cache externo:** indeterminado (continua exposta)

#### Plan de execução — divisão autônomo / user

> **Filosofia:** agente faz tudo que não é destrutivo-irrecuperável ou prohibited safety-rule. User só clica botão final irreversível ou autoriza OAuth.

**FASE 0 — Pre-checks (autônomo agente):**
- [ ] Confirmar branch: criar `release/v0.1.7.3` a partir de master atualizada
- [ ] Verificar `.env.local` tem `VITE_SUPABASE_ANON_KEY` legível pra registrar valor velho (pra audit)
- [ ] `git fetch origin && git status` clean
- [ ] Verificar Vercel CLI auth (`vercel whoami` deve retornar `lhenriquepda`)

**FASE 1 — Auditar logs janela leak (autônomo agente, via PAT):**
- [ ] Query Supabase logs Auth + REST janela 22:23-22:29 UTC
- [ ] Query `auth.audit_log_entries` mesma janela
- [ ] Comparar com baseline (sessão anterior idle period) — uso anômalo?
- [ ] Reportar achados antes prosseguir rotação

**FASE 1.5 — Audit secrets adicionais no histórico (autônomo agente):**
> Defense-in-depth: garantir que rotação JWT é o ÚNICO leak. Outros tipos de
> credenciais (PAT, service account JSON, Firebase keys, VAPID, etc) podem
> ter vazado em commits diferentes sem detection ainda.
- [ ] `git log --all --full-history -p -- supabase/migrations/ | grep -iE "jwt|service_role|sbp_|sk-|api[_-]key|password|secret"`
- [ ] `git log --all --full-history -p -- .env* supabase/functions/ | grep -iE "key|secret|token"`
- [ ] Buscar em refs órfãos: `git fsck --lost-found` + inspect
- [ ] Verificar tags com conteúdo sensível: `pre-secret-purge-backup` (já confirmada limpa em audit 2026-05-02 11:50 UTC)
- [ ] Listar resultado consolidado em `contexto/updates/{data}-release-v0.1.7.3.md` antes prosseguir

**FASE 2 — Reconectar Vercel↔GitHub (guided via Claude in Chrome):**
- [ ] Agente navega `https://vercel.com/lhenriquepdas-projects/dosy/settings/git`
- [ ] Agente clica botão "GitHub" pra iniciar reconexão
- [ ] **USER ACTION:** autoriza OAuth Vercel↔GitHub (pelas regras safety, OAuth login = só user)
- [ ] **USER ACTION:** seleciona repo `lhenriquepda/medcontrol_v2`
- [ ] Agente confirma webhook ativo via deployments page
- [ ] Agente push commit vazio teste pra confirmar auto-deploy dispara

**FASE 3 — Rotação JWT secret (guided via Claude in Chrome):**
- [ ] Agente navega Supabase Dashboard → projeto dosy-app → Settings → API
- [ ] Agente localiza botão "Generate a new JWT secret" / "Roll JWT Secret"
- [ ] Agente expande/lê confirmação dialog (preview destruction message)
- [ ] **USER ACTION:** clica botão Roll (irreversível) + confirma dialog
- [ ] Agente copia novos valores: `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (NUNCA log no chat — só persist em arquivos protegidos)

**FASE 4 — Atualizar env vars (autônomo agente):**
- [ ] Vercel CLI: `vercel env rm VITE_SUPABASE_ANON_KEY production` (3 envs: prod/preview/dev)
- [ ] Vercel CLI: `vercel env add VITE_SUPABASE_ANON_KEY production` (cole valor novo)
- [ ] Repetir pra preview + development
- [ ] Atualizar `.env.local` (não-commitado, gitignored) — anon key novo
- [ ] **USER ACTION:** confirmar não há outras máquinas dev pendentes
- [ ] Atualizar `SUPABASE_SERVICE_ROLE_KEY` em Edge Functions secrets:
  - Via Supabase Dashboard → Edge Functions → Secrets, OR
  - Via Supabase CLI: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... --project-ref guefraaqbkcehofchnrc`

**FASE 5 — Redeploy infra (autônomo agente):**
- [ ] Vercel CLI: `vercel --prod --force` (rebuild com env nova)
- [ ] Edge Functions redeploy (todas que usam service_role): `supabase functions deploy --project-ref guefraaqbkcehofchnrc` lista relevant
- [ ] Confirmar Vercel prod respondendo 200 em `https://dosy-teal.vercel.app/ajustes`

**FASE 6 — Rebuild Android (parcialmente guided):**
- [ ] Agente atualiza `android/app/src/main/assets/capacitor.config.json` se necessário (verificar se anon key não está baked)
- [ ] Agente verifica `src/services/supabase.js` lê `import.meta.env.VITE_SUPABASE_ANON_KEY` (não hardcoded)
- [ ] Bump versão patch: 0.1.7.2 → 0.1.7.3 (package.json + gradle versionCode 27)
- [ ] **USER ACTION:** Android Studio Build → Generate Signed Bundle (release variant)
- [ ] **USER ACTION:** confirma AAB pronto em `android/app/release/app-release.aab`
- [ ] Agente upload AAB Play Console via Claude in Chrome (mesmo fluxo de v0.1.7.2)
- [ ] **USER ACTION:** confirma "Salvar e publicar" no Console

**FASE 7 — Verificação pós-rotação (autônomo agente):**
- [ ] Test: query Supabase com chave VELHA → deve retornar 401/403
- [ ] Test: query Supabase com chave NOVA → deve retornar 200
- [ ] Test: login Vercel prod (`https://dosy-teal.vercel.app`) com `teste03@teste.com / 123456` → fluxo completo
- [ ] Test: device físico Dosy Dev (instalado v0.1.7.2-dev) — login + cadastrar dose teste → alarme dispara?
  - **Nota:** Dosy Dev tem chave VELHA baked → vai falhar até reinstall. Esperado. Reinstall via Studio Run após FASE 6.
- [ ] Auditar logs Supabase 1h pós-rotação — qualquer 401 inesperado de cliente legítimo?

**FASE 8 — Cleanup + release v0.1.7.3 (autônomo agente):**
- [ ] Merge `release/v0.1.7.3` → master (--no-ff) + tag `v0.1.7.3` + push
- [ ] Atualizar `contexto/`: ROADMAP §3+§12, PROJETO.md versão, README.md "Estado atual"
- [ ] Criar `contexto/updates/2026-05-XX-release-v0.1.7.3.md` com log completo + audit findings
- [ ] Marcar #084 ✅ Concluído em CHECKLIST + ROADMAP
- [ ] Decrementar P0: 7 → 6
- [ ] Deletar `release/v0.1.7.3` local + remote
- [ ] (Opcional) Deletar tag `pre-secret-purge-backup` se audit confirmou zero uso anômalo

**FASE 8.5 — Resolution alerts security dashboards (guided via Claude in Chrome):**
> Após rotação confirmada, marcar alertas como "resolved/revoked" pra fechar
> ticket. Chave vazada continua existindo em commit cache GitHub + indexers
> externos, mas perde valor (rotation = chave inválida server-side).
- [ ] **GitHub Security:** navega `https://github.com/lhenriquepda/medcontrol_v2/security/secret-scanning`
  - Localiza alerta "Supabase Service Key" (commit 85d5e614)
  - Click "Close as" → "Revoked" (chave já rotacionada)
  - Add comment: "Rotated v0.1.7.3 hotfix on YYYY-MM-DD"
- [ ] **GitGuardian:** navega `https://dashboard.gitguardian.com` (login via GitHub OAuth)
  - Localiza alerta `Supabase Service Role JWT` no repo medcontrol_v2
  - Marcar "Resolved" → motivo "Secret revoked"
- [ ] (Opcional) **GitHub Support:** abrir ticket pra purgar commit cache órfão `85d5e614`
  - Endpoint: `https://support.github.com/contact/private-information`
  - Justificar: secret credential exposed, request commit deletion from cache
  - Não-bloqueante (rotation já mitiga risco efetivo)
- [ ] Verificar 24h depois: alertas permanecem fechados, novos não disparam

#### Aceitação

- Chave velha retorna 401/403 em qualquer endpoint
- Chave nova funciona em Vercel prod + Edge Functions + APK Dosy Dev (após reinstall)
- Logs Supabase janela leak auditados — relatório de uso anômalo (0 ou N) em `updates/`
- Vercel↔GitHub reconectado: push pra master dispara auto-deploy
- AAB v0.1.7.3 publicado Play Store Internal Testing
- 3 ambientes sincronizados (master + Vercel prod + Play Store) versionados v0.1.7.3
- `pre-secret-purge-backup` tag mantida ou deletada conforme audit

#### Risk register

| Risco | Mitigação |
|---|---|
| Dosy oficial Play Store users com chave velha → 401 até auto-update | Auto-update Android é rápido pra Internal Testing (<24h). User comunica testers se notar. |
| Edge Function downtime entre roll e redeploy | Redeploy imediato após rotação. Idle ~2min. |
| Vercel env update falha → prod fica com chave inválida | Dry-run env update + verify ANTES rebuild. Rollback: revert env via dashboard. |
| User cliente caches anon key velha em IndexedDB | Service worker bump cache version força refresh. |
| OAuth Vercel↔GitHub falha | Fallback: continuar `vercel --prod` CLI até sessão futura. |

- **Detalhe completo:** ver `contexto/updates/2026-05-02-release-v0.1.7.2.md` (incident report).

---

### #085 — BUG-018: Alarme Crítico OFF em Ajustes mas alarme tocou
- **Status:** ⏳ Aberto — release v0.1.7.3
- **Origem:** Reportado user 2026-05-02 pós install v0.1.7.2. User toggle OFF em Ajustes → cadastrou dose teste → alarme nativo fullscreen disparou (não deveria — esperado: apenas notificação push tray).
- **Severidade:** P1 healthcare-adjacent (trust violation user setting + LGPD/privacy implications quanto user opta por menos intrusão)
- **Esforço:** ~3-5h (auditar 4 caminhos + criar source-of-truth + testes)
- **Dependências:** nenhuma (independente, mas #087 DND UX depende disso)

#### Diagnóstico provável

Toggle "Alarme Crítico" não está sendo respeitado em algum dos 4 caminhos coordenados de #083. Suspeitos:

| Caminho | Onde verificar | Risco |
|---|---|---|
| 1. Trigger DB (Edge `dose-trigger-handler`) | Edge consulta user prefs antes mandar FCM data com `scheduleAlarm:true`? | Alto — Edge talvez ignora flag |
| 2. Cron 6h (Edge `schedule-alarms-fcm`) | Mesma checagem? | Alto |
| 3. App `rescheduleAll()` | `criticalAlarm.js` consulta useUserPrefs antes scheduling? | Médio |
| 4. WorkManager DoseSyncWorker | Worker consulta SharedPreferences flag antes setAlarmClock? | Alto (é background, sem React state) |

#### Investigação inicial

- [ ] Reproduzir: toggle OFF Ajustes → cadastrar dose +1min → confirmar alarme fullscreen disparou
- [ ] Inspecionar `useUserPrefs.js` — qual key salva o toggle? Persiste em DB ou só local?
- [ ] Inspecionar Edge `dose-trigger-handler/index.ts` — query user prefs antes responder?
- [ ] Inspecionar Edge `schedule-alarms-fcm/index.ts` — mesmo
- [ ] Inspecionar `src/services/criticalAlarm.js` — `scheduleAlarm()` consulta prefs?
- [ ] Inspecionar `DoseSyncWorker.java` (Android) — lê SharedPreferences `criticalAlarmEnabled`?
- [ ] Inspecionar `DosyMessagingService.onMessageReceived` — lê flag antes de chamar `AlarmScheduler.schedule()`?

#### Solução

Single source of truth: flag persistida em `medcontrol.user_prefs.critical_alarm_enabled` (DB) + cached SharedPreferences Android.

- Cliente UI: ao toggle, atualiza ambos (DB + local cache via SharedPreferences plugin)
- Edge functions: leem `user_prefs.critical_alarm_enabled` antes mandar FCM data com `scheduleAlarm:true`. Se OFF, mandam só `pushNotification:true` (tray fallback).
- AlarmScheduler.schedule() (Android nativo): consulta SharedPreferences cache antes setAlarmClock. Se OFF, no-op (push tray cobre).
- `criticalAlarm.js` (web/Capacitor): mesma checagem antes de chamar plugin.

#### Aceitação

- [ ] Toggle OFF Ajustes → cadastrar dose → push tray dispara, **alarme fullscreen NÃO** dispara em nenhum dos 4 caminhos
- [ ] Toggle ON novamente → alarme fullscreen dispara normalmente
- [ ] Dose já agendada (com toggle ON) + user toggle OFF depois → próxima dose: respeita OFF (cancelar alarme nativo agendado se necessário)
- [ ] Test cobre todos 4 caminhos: trigger DB, cron 6h, rescheduleAll, WorkManager
- [ ] Logs Sentry/PostHog telemetria: zero `critical_alarm_fired_when_disabled`

---

### #086 — BUG-019: Resumo Diário não funciona — nunca dispara
- **Status:** ⏸️ Bloqueado — parqueado pra v0.1.8.0 (caminho B). UI ocultada em v0.1.7.3 (commit pending).
- **Origem:** Reportado user 2026-05-02. Feature configurada em Ajustes (horário definido) mas user nunca recebeu notificação no horário marcado.
- **Severidade:** P1 broken feature user-facing
- **Esforço:** ~2-4h (depende de fix vs parquear)
- **Dependências:** nenhuma

#### Diagnóstico provável

Feature pode ter quebrado em qualquer ponto end-to-end:

1. Persistência horário em prefs/DB — config salva?
2. Mecanismo agendamento — pg_cron job? Edge cron? AlarmManager local? WorkManager?
3. Trigger lógica — chega na hora, calcula payload, manda push
4. FCM token ativo + channel notif Android registrado
5. UI Ajustes — horário exibido bate com persistido?

#### Investigação inicial

- [ ] Localizar onde feature está implementada (UI Ajustes, service, Edge, cron)
- [ ] Inspecionar `pages/Settings.jsx` — campo horário salva em qual key?
- [ ] Inspecionar `useUserPrefs` — `daily_summary_time` ou similar persiste em DB?
- [ ] Buscar Edge function relevante (`daily-summary`?, `notify-doses`?)
- [ ] Verificar pg_cron jobs ativos: `SELECT * FROM cron.job` no Supabase
- [ ] Sentry/logs: erro nas execuções? Job nem roda?
- [ ] FCM token user — registrado? Chegando push de teste em outras features?

#### Decisão branch points

- **Caminho A — Feature broken end-to-end mas baixa complexidade:** fix em v0.1.7.3
- **Caminho B — Feature precisa retrabalho significativo:** parquear pra v0.1.8.0 + esconder UI até pronto + comunicar user ✅ ESCOLHIDO
- **Caminho C — Feature funciona, mas user-side issue (FCM token expirado, channel mutado):** dx fix + telemetria preventiva

#### Decisão tomada (2026-05-02): Caminho B

Investigação concluída em src/services/notifications.js:312-338. Resumo diário
implementado client-side via Capacitor LocalNotifications. Schedule
{ every: 'day' } depende de:
- App abrir pelo menos 1x pra rescheduleAll() agendar
- Sobreviver Doze mode Android

Sem cron server-side equivalente (não há Edge `daily-summary-cron`). User idle
nunca recebe.

Para fix completo precisaria:
- Migration nova: tabela `daily_summary_log` (PK userId+date) pra idempotência
- Edge function `daily-summary-cron`
- Schedule pg_cron 1x/hora chamando Edge
- Timezone handling per-user (default America/Sao_Paulo, mas pode haver users
  fora — tabela user_prefs sem coluna timezone atualmente)
- Push tray formatting + payload

Esforço: ~3-5h. Escopo grande pra hotfix v0.1.7.3 (focado #084 security +
#085/#087 toggle bypass).

**Ação v0.1.7.3:** ocultar UI Resumo Diário em Settings.jsx pra user não
esperar feature broken. Toggle + horário continuam persistidos em DB se
setados antes; apenas não-renderizados.

**Próxima sessão v0.1.8.0:** quebrar #086 em sub-itens (#086.1 migration,
#086.2 Edge, #086.3 cron schedule, #086.4 timezone field, #086.5 reativar
UI) e implementar.

#### Aceitação

- [ ] User configura resumo diário às HH:MM em Ajustes
- [ ] No horário marcado (±1min), notificação push tray chega
- [ ] Conteúdo resumo bate com adesão últimas 24h: doses programadas, tomadas, perdidas, próximas
- [ ] Se feature parqueada (caminho B): UI esconde toggle + nota "em breve" + ROADMAP item v0.1.8.0 criado

---

### #087 — BUG-020: DND verificar funcional + UX condicional ao Alarme Crítico
- **Status:** ⏳ Aberto — release v0.1.7.3
- **Origem:** Reportado user 2026-05-02. Solicitação dupla: (1) verificar se Não Perturbe atual respeita janela horária configurada; (2) refactor UX condicional.
- **Severidade:** P1 UX healthcare-adjacent
- **Esforço:** ~3-4h (verificação + UX refactor)
- **Dependências:** **#085 deve fechar primeiro** — toggle parent precisa funcionar pra UX condicional fazer sentido.

#### Verificação funcional (parte 1)

- [ ] Inspecionar implementação atual DND em `pages/Settings.jsx` + `services/notifications.js` + `criticalAlarm.js`
- [ ] DND tem campos: hora início + hora fim + flag enabled?
- [ ] Quando alarme deveria disparar dentro da janela DND, qual comportamento atual? (silencia, vibra só, bypassa, nada)
- [ ] Reproduzir: configurar DND 22:00-08:00 → criar dose 02:00 → testar comportamento
- [ ] Documentar comportamento atual antes de refactorar

#### Refactor UX condicional (parte 2)

Comportamento desejado por user:
- Toggle pai: **Alarme Crítico** (Ajustes raiz)
  - **OFF:** apenas push notification tray (sem alarme fullscreen). DND option **NÃO aparece** na UI.
  - **ON:** alarme fullscreen ativo. **DND option aparece** abaixo:
    - DND toggle: enabled / disabled
    - Se enabled: campos horário início + fim
    - Comportamento: dentro da janela DND, **Alarme Crítico desativa** (push tray cobre como fallback). Fora da janela: Alarme Crítico normal.

#### Componentes afetados

- `pages/Settings.jsx` — render condicional DND section
- `useUserPrefs.js` — hook com novos fields se ainda não existirem
- Migration DB — adicionar `dnd_start_time`, `dnd_end_time`, `dnd_enabled` em `user_prefs` (se ainda não)
- Edge functions + AlarmScheduler — checar janela DND antes scheduling (mesmo source-of-truth #085)

#### Aceitação

- [ ] Alarme Crítico OFF → DND option não aparece na UI
- [ ] Alarme Crítico ON → DND option aparece com toggle + campos horário
- [ ] DND ON + janela 22:00-08:00 → criar dose 02:00 → push tray dispara, alarme fullscreen não
- [ ] DND OFF (com Alarme Crítico ON) → alarme fullscreen normal independente de horário
- [ ] DND ON com janela inválida (start > end, atravessa meia-noite) é tratado corretamente
- [ ] Persistência DB OK — relogar mantém config

### #127 — CI failing (lint errors react-hooks pré-existentes em AnimatedRoutes.jsx)
- **Status:** ✅ Concluído (2026-05-05)
- **Origem:** descoberto durante validação #008 (2026-05-04)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ 2 errors `react-hooks/refs` resolvidos (`Cannot access refs during render`)
  - ✅ Fix: substituído `useRef('forward')` (directionRef + prevPathRef) por `useState(location.pathname)` (prevPath) + computa `direction` puro durante render
  - ✅ `npm run lint` retorna 0 errors (61 warnings — todos pré-existentes ou heurística react-compiler padrão codebase)
  - ✅ Build prod ok (`npm run build` 32s)
  - ⏸ GitHub CI workflow Lint+Test+Build vai passar no próximo push (validação automática)
  - ⏸ Sentry source maps upload rodará automaticamente após próximo CI bem-sucedido (libera #008 aceitação completa)
- **Impacto resolvido:** CI verde → source maps Sentry sobem → crash investigation pós-launch com stack trace symbolicado.

### #128 — BUG-040: Multi-dose alarm mostra só 1 medicamento + paciente "Sem Paciente"
- **Status:** ⏳ Aberto
- **Origem:** reproduzido S25 Ultra Dosy Dev v0.2.0.7 durante captura assets #025 (2026-05-04)
- **Esforço:** 2-4h (investigação + fix + reteste device)
- **Dependências:** nenhuma
- **Aceitação:**
  - Reproduzir: cadastrar 6 doses simultâneas (`scheduledAt` idêntico) distribuídas entre 2 pacientes — 3 Lucas + 3 Maria — confirma que ainda mostra só 1 med + "Sem Paciente"
  - Fix: AlarmActivity render multi-dose deve listar TODAS doses agendadas pra mesmo `scheduledAt` (com nome paciente correto cada uma) — não só uma
  - Validar nome paciente preenchido em qualquer caminho (Receiver / Activity / Service)
  - Re-teste S25 Ultra: 6 doses simultâneas → tela Alarme mostra 6 itens com nome de cada paciente
- **Hipóteses iniciais:**
  - (a) `AlarmReceiver` agrupa doses pelo `scheduledAt` exato mas falha quando 2 pacientes diferentes — group key pode estar derivando só do timestamp e perdendo lista patientId/medName
  - (b) FCM data path entrega só 1 dose ID no payload (não array completo) → AlarmActivity carrega só essa
  - (c) Patient name lookup no Activity falha (RPC call falha → fallback "Sem Paciente")
  - (d) `AlarmScheduler` agenda múltiplos `setAlarmClock()` mas só primeiro dispara, others suprimidos pelo OS por timing idêntico
- **Investigar primeiro:**
  - Logs `adb logcat` filtro `AlarmReceiver|AlarmActivity|AlarmService|AlarmScheduler|DosyMessagingService` durante repro
  - DB: `SELECT id, "patientId", "medName" FROM doses WHERE "scheduledAt" = X` confirma 6 doses no DB
  - Conferir se Realtime entregou todas 6 ao app antes do alarme disparar
  - Conferir Edge `notify-doses` logs — quantos FCM envelopes foram enviados (1 com array vs 6 separados?)
- **Detalhe:** Bug isolado fora de auditoria formal. Catalogar em `auditoria-live-2026-05-04/` se virar item recorrente. Por hora só ROADMAP.
- **P1 healthcare-adjacent** (trust violation: usuário não vê todas medicações que precisa tomar; LGPD-adjacent: paciente perde identificação da dose).

---

## Plano Closed Testing externo (decisão user 2026-05-05)

**User decidiu pular recrutamento Internal Testing com pessoas conhecidas (família/amigos) e ir direto ao Closed Testing recrutando testers externos via Google Group público + Reddit/redes.** Internal Testing fica live (ele + agente) só pra validação técnica, não pra coleta de feedback.

Gate Google: ≥12 testers ativos × 14 dias antes de Open Testing.

### #129 — Criar Google Group público `dosy-testers`
- **Status:** ⏳ Aberto
- **Origem:** Estratégia recrutamento Closed Testing 2026-05-05
- **Esforço:** 10 min (manual user)
- **Dependências:** nenhuma
- **Aceitação:**
  - Group criado em https://groups.google.com → "Criar grupo"
  - Nome: `Dosy Testers` · E-mail: `dosy-testers@googlegroups.com` (ou similar disponível)
  - Configurações: "Qualquer pessoa pode pedir e entrar" (auto-aprovação); visibilidade pública
  - URL pública do group salva pra divulgação (ex.: `https://groups.google.com/g/dosy-testers/about`)

### #130 — Configurar Closed Testing track no Console com Group como tester list
- **Status:** ⏳ Aberto
- **Origem:** Estratégia recrutamento Closed Testing 2026-05-05
- **Esforço:** 30 min (manual user + agente Chrome MCP)
- **Dependências:** #129
- **Aceitação:**
  - Console → Test and release → Closed testing → Create track
  - Track nome: "Dosy Beta Fechado" (ou similar)
  - Tester list: adicionar e-mail do Google Group `dosy-testers@googlegroups.com` (em vez de e-mails individuais)
  - Países: Brasil + qualquer outro relevante
  - Promover AAB v0.2.0.7 (ou versão atual em Internal) pra Closed track
  - Salvar opt-in URL gerado pelo Console pra divulgação

### #131 — Recrutar testers externos via Reddit + redes (meta 15-20 inscritos)
- **Status:** ⏳ Aberto
- **Origem:** Estratégia recrutamento Closed Testing 2026-05-05
- **Esforço:** 1-2h posts iniciais + acompanhamento semanal
- **Dependências:** #129 + #130 (precisa Group + opt-in URL antes)
- **Aceitação:**
  - Posts em r/AlphaAndBetausers, r/SideProject, r/brasil, r/desenvolvimentopt
  - Posts targeted: r/medicina, r/saude, r/tdah, r/diabetes (público-alvo cuidadores)
  - Compartilhamento Twitter/X + LinkedIn pessoal
  - Discord Indie Hackers BR + comunidades QA Android
  - Template post: "[Beta tester] Dosy — app Android pra organizar medicação família/idosos. Diferencial: alarme estilo despertador (ignora silencioso). Grátis. Link Google Group: {URL} → após entrar instala via {opt-in Console}"
  - Meta: 15-20 inscritos (folga pq alguns não testam)
  - Acompanhar contador "testadores ativos" no Console

### #132 — Gate Closed Testing: 14 dias rodando com ≥12 testadores ativos
- **Status:** ⏳ Aberto
- **Origem:** Regra Google 2023+ pra contas novas
- **Esforço:** 14 dias passivos + iteração semanal de feedback
- **Dependências:** #131
- **Aceitação:**
  - Console mostra ≥12 testadores ativos por ≥14 dias consecutivos
  - Sentry: 0 crashes críticos novos durante janela
  - Iterar bugs reportados em mini-releases v0.2.0.x conforme aparecerem
  - Gate Console habilita "Solicitar acesso de produção"

### #133 — Solicitar acesso Open Testing / Produção
- **Status:** ⏳ Aberto
- **Origem:** Pós #132 gate
- **Esforço:** 1h (preencher form Console + responder perguntas Google)
- **Dependências:** #132
- **Aceitação:**
  - Console → Solicitar acesso de produção → preencher questionário sobre teste fechado
  - Aguardar aprovação Google (~24-72h)
  - Após aprovação: Open Testing fica disponível com link público (sem lista) OU promover direto pra Production
  - Decidir estratégia: passar por Open Testing 7-14 dias OU produção rollout 5%→100%

---

## Plano fixes egress (auditoria 2026-05-05)

> **Detalhes em** `contexto/egress-audit-2026-05-05/README.md`. Egress 35.79 GB / 5 GB Free (715%). Grace expira 06 May. Fix #092 v0.1.7.5 cobriu apenas ~30%. Causa raiz: `invalidateQueries()` em massa em events não-data-related (visibility/focus/resume) + Realtime sem debounce.

### #134 — `useAppResume` remover invalidate em short idle, scopear long idle
- **Status:** ⏳ Aberto
- **Origem:** egress-audit-2026-05-05 F1
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** -30% a -45%
- **Aceitação:**
  - `src/hooks/useAppResume.js:58` (`qc.invalidateQueries()` em short idle <5min) — REMOVER. Realtime + refetchInterval cobrem.
  - Long idle (>=5min) já faz `refetchQueries({ type: 'active' })` — não precisa também `invalidateQueries()` antes (line 49).
  - Manter `refreshSession` + `removeAllChannels` em long idle.
- **Risco UX:** dados podem aparecer 30-120s mais "antigos" se Realtime não trouxer update; aceitável vs economia.

### #135 — `useRealtime` resume nativo: remover invalidate ALL keys
- **Status:** ⏳ Aberto
- **Origem:** egress-audit-2026-05-05 F6
- **Esforço:** 10 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** -5% a -10%
- **Aceitação:**
  - `src/hooks/useRealtime.js:180-182` — remover loop `qc.invalidateQueries`. Resubscribe + Realtime postgres_changes events tomam conta updates pós-resume.
- **Risco UX:** zero.

### #136 — `useRealtime` postgres_changes: debounce invalidate 1s
- **Status:** ⏳ Aberto
- **Origem:** egress-audit-2026-05-05 F2
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Impacto egress estimado:** -15% a -25% (especialmente dias de cron extend)
- **Aceitação:**
  - `src/hooks/useRealtime.js:113-119` — wrap `qc.invalidateQueries` em debounce 1000ms por table.
  - Implementação: timeout + flag por queryKey, ou `lodash.debounce`.
- **Risco UX:** atualização cross-device até 1s extra. Healthcare app — não-crítico.

### #137 — Dashboard: consolidar 4 useDoses em 1
- **Status:** ⏳ Aberto
- **Origem:** egress-audit-2026-05-05 F3
- **Esforço:** 2h
- **Dependências:** nenhuma
- **Impacto egress estimado:** -20% a -30%
- **Aceitação:**
  - `src/pages/Dashboard.jsx:85, 116, 118, 123` — substituir 4 hooks por 1 `useDoses({from: -30d, to: +14d})`. Filtros visuais via `useMemo` client-side.
  - Calcular `pendingToday`, `overdueNow`, `weekAdherence` em memória sobre array único.
- **Risco UX:** Dashboard 1 round-trip em vez de 4. Mais rápido.

### #138 — `DOSE_COLS_LIST` sem `observation`
- **Status:** ⏳ Aberto
- **Origem:** egress-audit-2026-05-05 F4
- **Esforço:** 1h (incluindo verificação Reports/Analytics)
- **Dependências:** nenhuma
- **Impacto egress estimado:** -15% a -30% no payload listDoses
- **Aceitação:**
  - `src/services/dosesService.js` — criar `DOSE_COLS_LIST` (10 cols sem observation) pra `listDoses`. Manter `DOSE_COLS_FULL` pra `getDose` detail.
  - Verificar Reports.jsx, Analytics.jsx, DoseHistory.jsx — se exibem observation em lista, adaptar (lazy-load via getDose ao expandir).
  - Análoga à mudança #115 (PATIENT_COLS_LIST/FULL).
- **Risco UX:** zero — UI lista não exibe observation.

### #139 — `dose-trigger-handler` skip se scheduledAt > 6h futuro
- **Status:** ⏳ Aberto
- **Origem:** egress-audit-2026-05-05 F7
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** Edge invocations -50-70%
- **Aceitação:**
  - `supabase/functions/dose-trigger-handler/index.ts:103-106` — adicionar early return se `scheduledAt > now + 6h`. Cron 6h `schedule-alarms-fcm` cobre.
- **Risco UX:** zero. Alarme nativo agendado pelo cron 6h antes da dose.

### #140 — `schedule-alarms-fcm` HORIZON 72h → 24h
- **Status:** ⏳ Aberto
- **Origem:** egress-audit-2026-05-05 F8
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** payload FCM 3× menor
- **Aceitação:**
  - `supabase/functions/schedule-alarms-fcm/index.ts` — `HORIZON_HOURS = 24` (era 72). Cron 6h × 4 ciclos cobre 24h com folga.
- **Risco UX:** zero.

### #141 — `useReceivedShares` staleTime 60s → 5min
- **Status:** ⏳ Aberto
- **Origem:** egress-audit-2026-05-05 F10
- **Esforço:** 5 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** pequeno mas free win
- **Aceitação:**
  - `src/hooks/useShares.js` `useReceivedShares` — `staleTime: 5 * 60_000`.
- **Risco UX:** novo share notif pode demorar até 5min em aparecer. Aceitável (shares raros).

### #142 — Rotacionar JWT cron `schedule-alarms-fcm-6h` + refatorar pra usar vault/env
- **Status:** ⏳ Aberto
- **Origem:** egress-audit-2026-05-05 F11 (security)
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Impacto egress:** zero (security-only)
- **Aceitação:**
  - Drop cron job `schedule-alarms-fcm-6h` atual.
  - Recriar usando `vault.read_secret('SUPABASE_SERVICE_ROLE_KEY')` ou `supabase_functions.http_request` (passa service key automaticamente).
  - Rotate JWT secret se ainda válido (verificar via test request com JWT antigo).
- **Risco:** zero funcional. Critical security fix.

### #143 — `useUserPrefs.queryFn`: `getSession()` em vez de `getUser()`
- **Status:** ⏳ Aberto
- **Origem:** egress-audit-2026-05-05 F9
- **Esforço:** 15 min
- **Impacto egress estimado:** -1 round-trip auth por refetch useUserPrefs
- **Aceitação:** trocar `supabase.auth.getUser()` por `supabase.auth.getSession()` em `src/hooks/useUserPrefs.js:50`.

### #144 — Custom JWT claim `tier` via Auth Hook (longo prazo)
- **Status:** ⏳ Aberto P2
- **Origem:** egress-audit-2026-05-05
- **Esforço:** 4-6h (Auth Hook setup + client refactor)
- **Impacto egress estimado:** elimina round-trip useMyTier
- **Aceitação:** Auth Hook custom claim → JWT carrega `tier` → client lê localmente.

### #145 — `useRealtime` watchdog: invalidate só se data divergente
- **Status:** ⏳ Aberto P2
- **Esforço:** 1h
- **Impacto egress estimado:** -5% mobile flaky
- **Aceitação:** watchdog compara timestamp último change broadcast vs `qc.getQueryState('doses').dataUpdatedAt`. Só invalidate se diff significativo.

### #146 — `pg_cron extend_continuous_treatments`: confirmar batch INSERT
- **Status:** ⏳ Aberto P2
- **Esforço:** 30 min audit
- **Aceitação:** verificar se INSERTs são single multi-row (1 webhook total) ou N inserts (N webhooks). Otimizar pra 1.

---

## Resumo

- **P0:** 9 itens — restantes: 6 abertos após fechamento de #001/#002/#005 em v0.1.6.10
- **P1:** 22 itens (#010-027 + #075-#078 v0.1.7.0) · esforço estimado: ~10-15 dias-pessoa
- **P2:** 22 itens (#028-049) · esforço estimado: ~3-4 semanas-pessoa
- **P0 v0.1.7.1:** #079 #080 #081 healthcare-critical (defense-in-depth notif idle ilimitado)
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
