# 🛑 Dosy — Entry Point Obrigatório

> **Você é uma IA recebendo este projeto.** Siga os 5 passos abaixo SEM PULAR. Pare no Passo 5 e espere comando do user antes de tocar código.
>
> **Histórico longo + auditoria + decisões antigas** moveram para [`README_legacy.md`](README_legacy.md). Use como referência apenas quando o user pedir contexto histórico específico.

---

## ⚡ PASSO 1 — Carregar contexto (3 reads paralelos)

Execute **em paralelo**, em uma única mensagem com 3 chamadas Read:

1. `Read PROJETO.md` (limit 200) — stack canônica, schema DB, convenções, gating Free/Plus/Pro/Admin, plugin nativo CriticalAlarm, deploy.
2. `Read ROADMAP.md` (offset 150, limit 50) — §3 "Onde paramos" (branch ativa + último item fechado + próximo passo).
3. `Read CHECKLIST.md` (sob demanda do user) — entry detalhado por item `#XXX`.

> **Atenção:** PROJETO.md tem ~1000 linhas; leia só o que cabe inicial (limit 200 cobre header + stack + schema + funcionalidades). Resto sob demanda.

---

## ⚡ PASSO 2 — Estado git (fonte da verdade)

```bash
git status
git log --oneline -5
```

Identificar: branch ativa, commits ahead origin, working tree clean ou dirty.

> Se ROADMAP.md §3 contradisser `git`, **fonte da verdade é o git.**

---

## ⚡ PASSO 3 — Memória durável (auto-injetada)

Claude Code auto-injeta o índice de memória project-scoped no system reminder do início de cada conversa. **Atenção especial a:**

| Prioridade | Memory file | Quando importa |
|---|---|---|
| 🔴 | [`feedback_chrome_automation`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\feedback_chrome_automation.md) | Build/upload Play Console / Vercel / Supabase admin |
| 🔴 | [`feedback_egress_priority`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\feedback_egress_priority.md) | Mudança em fetch / persist / realtime / cron |
| 🔴 | [`flow_session_lifecycle`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\flow_session_lifecycle.md) | Lifecycle session / pré-release / pós-merge |
| 🟡 | [`feedback_versioning`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\feedback_versioning.md) | Bump versão (sempre último dígito, ignora semver) |
| 🟡 | [`feedback_caveman_user_facing`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\feedback_caveman_user_facing.md) | Docs / dashboards / posts / copy / e-mails |
| 🟡 | [`feedback_ptbr_only`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\feedback_ptbr_only.md) | UI admin, dashboards, docs |
| 🟡 | [`feedback_reddit_copy`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\feedback_reddit_copy.md) | Posts Reddit recrutamento |
| 🟢 | [`reference_test_accounts`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\reference_test_accounts.md) | Login teste-free@/teste-plus@ |
| 🟢 | [`reference_external_services`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\reference_external_services.md) | URLs admin / Supabase / Notion |
| 🟢 | [`project_dosy_category`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\project_dosy_category.md) | Play Store categoria Saúde e Fitness |
| 🟢 | [`project_plus_vs_pro`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\project_plus_vs_pro.md) | Plus = Pro + 1 Ad discreto |

---

## ⚡ PASSO 4 — Regras NEGATIVAS (NUNCA quebrar)

| # | Regra | Razão |
|---|---|---|
| **1** | Build / upload Play Console = **Chrome MCP via §10**. NUNCA CI workflow primeiro. | CI rebuild é lento + risk de keystore failure. Chrome MCP usa AAB local pronto. |
| **2** | Mudança em fetch / persist / realtime / cron = **auditoria egress proativa** (tabela 4 colunas Risco × Severidade × Mitigação × Decisão). | Histórico de pico custo Supabase. Plano Pro upgrade reativo. |
| **3** | Docs / dashboards / posts / copy / e-mails = **caveman OFF**. | User vai consumir/publicar — precisa português completo. |
| **4** | Mutações `doses` = **RPC** (`confirm_dose` / `skip_dose` / `undo_dose` / `register_sos_dose`). NUNCA INSERT direto. | Trigger server-side enforce. State machine validada. |
| **5** | Free patient limit = **enforce trigger DB** (`enforce_patient_limit`). NUNCA client-only check. | Gating server-side é fonte da verdade. |
| **6** | Logout = `qc.clear()` + remove `localStorage` chaves notif/dashCollapsed. | Evita vazamento entre contas + state stale. |
| **7** | Realtime `postgres_changes` = **DESABILITADO** (#157). Não reabilitar sem investigar. | Publication empty + reconnect cascade burn ~13 req/s storm. |
| **8** | Buster `PersistQueryClient` = NÃO bumpar sem justificativa forte. | Bump invalida cache de TODOS users 1× → pico refetch global. |
| **9** | `git add -A` ou `git add .` = **NUNCA**. Stage files específicos por nome. | Risco de incluir `.env`, secrets, credentials acidentalmente. |
| **10** | Pre-commit hook (gitleaks + eslint) = NÃO usar `--no-verify` sem ordem explícita do user. | Hooks protegem contra commits ruins. |
| **11** | Versionamento = **bumpar último dígito** (`0.2.1.6 → 0.2.1.7`). Ignorar semver minor/major. | Convenção do projeto. |
| **12** | Push `--force` em master = **NUNCA**. Em release branch só com aviso explícito. | Master é canônico. |
| **13** | `mailer_autoconfirm` = OFF prod. Não trocar pra ON. | Confirmação email obrigatória LGPD. |

---

## ⚡ PASSO 5 — STOP. Reportar ao user.

**Antes de tocar código**, reporte em até 5 bullets:

- **Versão atual:** master @ vX.Y.Z (vc N) · branch ativa `release/vX.Y.Z+1`
- **Último item fechado:** #XXX — descrição curta + commit hash
- **P0 abertos top 3:** #aaa, #bbb, #ccc
- **Próximo passo proposto:** ler CHECKLIST §#XXX e seguir
- **Pergunta:** OK seguir essa direção? Ou outra prioridade?

**ESPERAR comando explícito do user. NÃO COMEÇAR a codar.**

---

# 🔧 PASSOS 6-14 — Fechamento (após codar)

Quando o user confirmar próximo passo e você tiver implementado código, siga esta ordem:

## Passo 6 — Auditoria pré-commit
- `npm run build` (verde obrigatório, sem warnings novos)
- Auditoria egress (se mudou fetch/persist/realtime/cron) — tabela 4 colunas em CHECKLIST §#item
- Lint passa via husky pre-commit (gitleaks 0 leaks + eslint max-warnings 80)

## Passo 7 — Validação preview Vercel (se web tocou)
- URL: `https://dosy-git-{branch}-lhenriquepdas-projects.vercel.app`
- Chrome MCP `mcp__Claude_in_Chrome__navigate` + `read_network_requests`
- Não confiar só em build verde local

## Passo 8 — Commit
- `git status` + `git diff --stat` (sanity)
- Stage files **específicos por nome** (NUNCA `git add -A`)
- Commit message via HEREDOC + `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- Pre-commit hook DEVE passar (não `--no-verify`)

## Passo 9 — Sync docs (4 arquivos OBRIGATÓRIO)
- `ROADMAP.md` §3 "Onde paramos" + §6.2 counter + §6.3 Δ release log + §6.4-6.7 entry status
- `CHECKLIST.md` entry detalhado item `#XXX` (status + implementação fechada + auditoria egress se aplicável)
- `PROJETO.md` header (se versão bumpou)
- `README.md` §"Estado atual" (se versão bumpou — caso vocês criem essa seção aqui no V2)

## Passo 10 — Push
```bash
git push origin release/v{X.Y.Z}
```

## Passo 11 — Build + Upload Play Store (se release pronto pra teste)
- Bump `versionCode + 1` em `android/app/build.gradle`
- Build AAB local Android Studio (workaround `gradlew.bat` loopback Win11)
- Atualizar `docs/play-store/whatsnew/whatsnew-pt-BR` com release notes
- **Chrome MCP** Play Console via [§10 Receita](#10--receita-chrome-mcp-play-console-upload-aab) — upload + release notes + Salvar e publicar
- Internal Testing track ativa em ~1h

## Passo 12 — Validação (web primeiro, device só pro que web não cobre)

### 12a — Validação web via Chrome MCP (IA executa SEMPRE que possível)

Antes de pedir validação device pro user, verifique se o item pode ser validado via web:

**Validável via web** (IA executa via Chrome MCP em `https://dosymed.app/` ou preview Vercel `https://dosy-git-{branch}-lhenriquepdas-projects.vercel.app`):
- UI rendering / componentes novos / animações framer-motion
- Hooks React Query (cache, persist, optimistic updates, invalidate)
- Fluxos auth (login/logout/reset)
- CRUD pacientes / tratamentos / doses via UI
- Banners (Update, Offline, etc) + lógica show/hide condicional
- Service Worker cache (web only)
- Egress via Network panel + `window.__dosyNetMonitor` interceptor
- TanStack mutation queue offline (DevTools Network throttling "Offline")
- Form validation, modals, tier gating UI
- LGPD flows (export dados, delete account UI step 1)
- Telemetria PostHog/Sentry events firing (em PROD only — verificar no painel admin)
- Conteúdo estático (privacidade, termos, FAQ)

**Receita validação web:**
1. Chrome MCP `navigate` para preview Vercel da branch ativa
2. `read_page` ou `find` para localizar componente alvo
3. `javascript_tool` ou `computer` simula interação user
4. `read_console_messages` (filter pattern) verifica logs/erros
5. `read_network_requests` ou interceptor JS valida fetch/persist behavior
6. Screenshot final como evidência

### 12b — Validação device (somente o que web não cobre)

Apenas pra features Capacitor nativas que não rodam no browser:
- Plugin `CriticalAlarm` nativo (AlarmManager, lockscreen overlay, full-screen intent, foreground service)
- `BootReceiver` re-schedule pós reboot
- `DoseSyncWorker` periodic WorkManager
- `DosyMessagingService` FCM data handler
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` Samsung One UI 7 / Xiaomi MIUI
- Push FCM real (background delivery não captura JS)
- StatusBar overlay native, AdMob banner real, Biometric auth
- SecureStorage Android KeyStore
- Capacitor In-App Updates (Google Play flexible)
- Privacy screen (FLAG_SECURE recents blur)
- BackButton handler nativo

**Receita validação device:**
1. User instala via link Internal Testing no S25 Ultra (ou device principal)
2. Checklist específico do item em `CHECKLIST.md §#XXX` seção "Validação device"
3. User captura Logcat se item envolveu plugin nativo (`adb logcat -s {tag}`)
4. IA verifica Sentry breadcrumbs/issues 24h pós-install + painel admin

**Antes de pedir validação device, IA:**
1. Listar itens da release que precisam device-only (vs web-validável)
2. Validar TUDO que cabe web via Chrome MCP
3. Reportar resultado web pro user
4. Pedir validação manual SOMENTE pros itens device-only restantes

## Passo 13 — Pós-release (release fechado, mergeado master)
- Atualizar memory `feedback_*.md` se padrão novo emergiu nesta release
- Criar `contexto/updates/YYYY-MM-DD-release-vX.Y.Z.md` (template em `updates/README.md`)
- `git tag vX.Y.Z` + `git push origin vX.Y.Z`
- Merge `release/v*` → `master` linear (não squash)
- Vercel deploy master: `npx vercel --prod --yes`
- **RE-LER `contexto/README.md` §1-5 inteiro** (refrescar fluxo padrão pra próximas sessions)
- Limpar TodoWrite + reportar release fechada ao user

## Passo 14 — STOP final
Reportar:
- Commit hash final + tag git criada
- Play Console status (Internal Testing publicado, vc N+1)
- Próximo P0 sugerido pra próxima session
- **Esperar comando user. Não emendar próximo trabalho automático.**

---

# 📚 REFERÊNCIA DETALHADA (sob demanda)

> Tudo abaixo é referência. Leia somente quando o user perguntar algo específico ou quando os Passos acima exigirem.

## §10 — Receita Chrome MCP Play Console upload AAB

```
1. mcp__Claude_in_Chrome__tabs_context_mcp(createIfEmpty: true) — pega tabId
2. navigate(url: "https://play.google.com/console/u/1/developers/6887515170724268248/app-list", tabId)
3. screenshot — verifica conta logada `dosy.med@gmail.com` (avatar canto superior direito)
4. Click app Dosy → Testar e lançar → Teste interno
5. Botão "Criar nova versão"
6. find(query: "file input upload AAB pacote app", tabId) → ref_XXX
7. file_upload(paths: ["G:\\00_Trabalho\\01_Pessoal\\Apps\\medcontrol_v2\\android\\app\\release\\app-release.aab"], ref: "ref_XXX", tabId)
8. wait 15s + screenshot — confirma "1 pacote enviado"
9. find(query: "release notes textarea pt-BR") → ref_YYY
10. form_input(ref_YYY, value: "<pt-BR>\n{notas}\n</pt-BR>")
11. Click "Próximo" → step Visualizar e confirmar
12. Click "Salvar e publicar" → modal confirma → click "Salvar e publicar" dentro modal
13. screenshot final — confirma "Disponível para testadores internos"
```

**NÃO use** `computer.left_click` no botão "Enviar" — abre native dialog invisível ao agente.
**Use** `find` + `file_upload` com ref direto.

**Conta Google ativa obrigatória:** `dosy.med@gmail.com`. Se outra conta logada, pause + peça user trocar.

**Fallback** se Chrome MCP indisponível: lista textual de passos manuais. Mas Chrome MCP é o caminho preferido sempre.

## §11 — Convenções código essenciais

- Tailwind inline, sem CSS modules
- camelCase JS / `"camelCase"` SQL (aspas obrigatórias DDL)
- React Query keys: array, primeiro elemento = entidade (`['doses', filter]`)
- BottomSheet via `createPortal(…, document.body)` + `pb-5 safe-bottom`
- Forms: loading via `mutation.isPending`, erro via `useToast`
- Tier check: `useIsPro()` / `useIsAdmin()` — nunca string compare
- `displayName(user)` / `firstName(user)` — nunca `user.email` direto
- Mutações server-side via RPC — nunca INSERT/UPDATE direto em `doses`
- Select com colunas explícitas (sem `select('*')` em production code)
- `escapeHtml` sanitize em todo HTML injetado (PDF Reports etc)
- `uuid()` de `utils/uuid.js` em vez de `crypto.randomUUID()` direto (Android 11 polyfill)

## §12 — Recursos externos

| Recurso | URL | Uso |
|---|---|---|
| **Painel admin Dosy** | https://admin.dosymed.app | Listar users, mudar tier, marcar tester, ver Sentry/PostHog/egress |
| ↳ Auth log | https://admin.dosymed.app/auth-log | #201 — eventos auth pt-BR |
| **Site público** | https://dosymed.app | Landing + privacidade + termos + FAQ |
| **Google Group testers** | https://groups.google.com/g/dosy-testers | Auto-aprovação tester onboarding |
| **PostHog** | https://us.posthog.com/project/401835 | Analytics events |
| **Sentry** | https://lhp-tech.sentry.io/projects/dosy/ | Issues / crash reports |
| **Supabase** | https://supabase.com/dashboard/project/guefraaqbkcehofchnrc | DB + Edge Functions + Auth + Egress |
| **Play Console** | https://play.google.com/console/u/1/developers/6887515170724268248 | AAB upload + tracks (conta dosy.med@gmail.com) |
| **Vercel** | https://vercel.com/lhenriquepdas-projects | Deploys dosymed.app + admin.dosymed.app |
| **Repo principal** | https://github.com/lhenriquepda/medcontrol_v2 | Código + CI |
| **Repo admin** | https://github.com/lhenriquepda/dosy-admin | Painel admin (separado) |
| **Notion · Growth Hub** | https://www.notion.so/359e3c80936f81f09a2cf7e4ecd63523 | Recrutamento + marketing + canais BR |

## §13 — Estado atual do projeto

> Atualizado a cada release no Passo 13. Se contradisser `git log`, fonte da verdade é o git.

**App:** Dosy — Controle de Medicação · pkg `com.dosyapp.dosy`
**Versão atual:** master @ `v0.2.1.6` (vc 54 Internal Testing) · branch ativa `release/v0.2.1.7` (vc 55 publicado Internal Testing 2026-05-09 23:08)
**Vercel prod:** `https://dosymed.app/`
**Contas teste:** `teste-free@teste.com / 123456` (free) + `teste-plus@teste.com / 123456` (plus)

**Release em curso `release/v0.2.1.7`:**
- 🚧 #204 Mutation queue offline (TanStack networkMode 'offlineFirst' + persist mutations + bridge Capacitor.Network ↔ onlineManager + OfflineBanner) — código mergeado, validação device pendente
- 🚧 #207 Defesa em profundidade alarme crítico (5 fixes — advanceMins fallback, janela 7d, drop diff-and-apply, REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Sentry breadcrumbs) — código mergeado + AAB vc 55 publicado, validação device pendente

**P0 abertos pra Closed Testing público:**
- #006 device validation 3 devices físicos (manual user)
- #131 recrutamento Reddit testers (desbloqueado pós #130)
- #132 gate 14d ≥12 testers (depende #131)
- #133 Production access Console (depende #132)
- #191 #192 revenue path RevenueCat + Play Billing (Fase 3)
- #193 (release-specific TBD)

## §14 — Ciclo publicar release (8 passos referência)

1. Branch `release/v{X.Y.Z}` aberta de master
2. Implementação iterativa + commits + sync docs (Passo 9)
3. Push branch + validação preview Vercel (Passo 7)
4. Build AAB + upload Play Console Internal Testing (Passo 11)
5. Validação device (Passo 12)
6. Iterar bugs encontrados (volta passo 2)
7. Quando estável: tag git + merge master + Vercel deploy prod (Passo 13)
8. Atualizar memory + updates/ + RE-LER README §1-5 (Passo 13)

## §15 — Worktrees + branches

- `release/v{X.Y.Z}` — desenvolvimento ativo, builds Android instalam como **Dosy Dev** (`com.dosyapp.dosy.dev`) via Studio Run debug variant
- `master` — estável, builds AAB release variant publicam como **Dosy** (`com.dosyapp.dosy`)
- Worktrees opcionais em `.claude/worktrees/` (gitignored), branches `claude/*` para experimentação isolada
- Atomicidade: master + Vercel produção + Play Store AAB sempre 3 sincronizados

## §16 — Mapa pasta contexto/

```
contexto/
├── README.md             ← este arquivo · ENTRY POINT
├── README_legacy.md      ← versão antiga (1300+ linhas) · referência histórica
├── PROJETO.md            ← briefing técnico canônico (stack, DB, convenções)
├── ROADMAP.md            ← onde estamos + onde vamos + processo de release
├── CHECKLIST.md          ← detalhe item-a-item (snippets, aceitação, auditoria)
├── auditoria/            ← snapshot auditoria 2026-05-01 (relatório, supabase, código, bugs, UX)
├── decisoes/             ← ADRs (decisões importantes que mudam contexto)
├── updates/              ← log cronológico de sessões (release-vX.Y.Z.md)
└── archive/              ← docs históricos imutáveis
```

## §17 — Convenções da pasta

- Idioma: pt-BR por default. Snippets em inglês quando idiomático.
- Markdown GFM. Headings semânticos. Links relativos entre docs.
- Datas: ISO 8601 (`YYYY-MM-DD`).
- Updates: `YYYY-MM-DD-acao-curta.md`.
- ADRs: `YYYY-MM-DD-NNN-titulo.md`.
- Não delete `archive/` ou `README_legacy.md` — histórico imutável.

## §18 — Manutenção docs (Regras 1-9)

Detalhe completo das regras 1-9 em [`README_legacy.md` §"Regras de manutenção"](README_legacy.md#%EF%B8%8F-regras-de-manutenção-crítico).
Resumo essencial:
- **Regra 1:** ROADMAP §6 + CHECKLIST entry compartilham numeração `#XXX`. Ambos atualizados a cada mudança de status.
- **Regra 9:** Chrome MCP é caminho primário pra Play Console / Vercel / Supabase admin. CI workflow é fallback.
- **Regra 9.1:** Validação preview Vercel via Chrome MCP antes de fechar release branch.

## §19 — Onde ler quando…

| Pergunta | Arquivo |
|---|---|
| Status / próximo passo | este README §13 + ROADMAP §3 |
| O que falta fazer macro | ROADMAP §6 |
| Detalhe técnico de um item `#XXX` | CHECKLIST §#XXX |
| Detalhe DB / RLS / RPC / Edge | auditoria/04-supabase.md |
| Frontend / cache / TanStack / deps | auditoria/05-codigo.md |
| Bug específico Sentry / user-reported | auditoria/06-bugs.md |
| UX / fluxos navegados | auditoria/07-usabilidade.md |
| Decisão arquitetura / produto | decisoes/ |
| Contexto histórico | archive/ + README_legacy.md |
| Última release publicada | updates/ último arquivo |

---

🚀 **Próximo passo concreto:** validação device #204 + #207 (S25 Ultra) → fechar ambos → tag v0.2.1.7 + merge master + Vercel deploy → seguir #131 recrutamento Reddit + #006 device validation múltiplos devices.
