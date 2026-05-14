# 🛑 Dosy — Entry Point Obrigatório

> **Você é uma IA recebendo este projeto.** Siga os passos abaixo SEM PULAR. Pare no Passo 5 e espere comando do user antes de tocar código.
>
> **Histórico longo + auditoria + decisões antigas** moveram para [`README_legacy.md`](README_legacy.md). Use como referência apenas quando o user pedir contexto histórico específico.

---

## 🚨 PASSO 0 — Varrer `Validar.md` (validações manuais pendentes)

**Antes de qualquer coisa**, abra [`contexto/Validar.md`](Validar.md) e conte os checkboxes `[ ]` na seção topo (release mais recente).

**Se houver `[ ]` pendentes:**

> ⚠️ **Alerta para o user no início da resposta:**
>
> *"Antes de começarmos: você tem **N validações pendentes** da release `vX.Y.Z` em `contexto/Validar.md` (lista resumida abaixo). Quer validar antes de iniciar trabalho novo, ou prefere acumular?"*
>
> Listar até 5 itens pendentes resumidos: `[ ] 204.1 — Avião mode + ações offline → banner amber`.

**Se todos `[x]` ou seção vazia:** prosseguir Passo 1 sem alerta.

> O user decide se valida agora, posterga ou pula. **Você não decide por ele** — só alerta.

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
| **14** | **NUNCA executar trabalho em master ou branch errado.** Após Passo 5b OK do user, primeira ação OBRIGATÓRIA = `git checkout -b {tipo}/{nome}` + `git status` confirma. Só então inicia análise/edits/tools. | User disse "segue" significa "crie branch + execute", não "pule branch". Master = canônico, releases ficam fora dela. |

---

## ⚡ PASSO 5 — STOP. Reportar ao user.

**Antes de tocar código**, reporte em até 5 bullets:

- **Versão atual:** master @ vX.Y.Z (vc N) · branch ativa: `master` (sem release em curso) **OU** `release/vX.Y.Z+1` (em curso)
- **Último item fechado:** #XXX — descrição curta + commit hash
- **P0 abertos top 3:** #aaa, #bbb, #ccc
- **Próximo passo proposto:** ler CHECKLIST §#XXX e seguir
- **Pergunta:** OK seguir essa direção? Ou outra prioridade?

**ESPERAR comando explícito do user. NÃO COMEÇAR a codar.**

> 🛑 **Quando user retornar com diretiva ("vamos fazer X"):** ANTES de QUALQUER ação (mesmo leitura ampla de arquivos, git log, etc), ativar **Passo 5b OBRIGATÓRIO**. Não inicie investigação ampla sem reportar branch + esperar OK.

---

## ⚡ PASSO 5b — Classificar trabalho proposto

Ativa **logo após o user dizer o que quer fazer**. IA não pergunta categoria ao user — analisa o pedido sozinha e propõe.

### 🛑 STOP imperativo

**Antes de QUALQUER ação além do mínimo pra classificar, IA OBRIGATORIAMENTE:**
1. Lê o pedido do user
2. Se o pedido **JÁ É O TRABALHO** (ex: "analisa 10 commits e ROADMAP", "lê arquivo X", "investiga bug Y") → o trabalho é a investigação. **Continua precisando classificar branch ANTES de começar.**
3. Reporta classificação + branch + bump (se release) + ESPERA OK

**Permitido pra classificar (leitura mínima):**
- ✅ 1-3 linhas stack trace Sentry pra identificar origem
- ✅ Olhar 1 arquivo específico que user mencionou
- ✅ `Glob` pra confirmar escopo arquivos prováveis

**Proibido antes OK do user:**
- ❌ `git log -10` ou `git log` extenso pra "analisar histórico"
- ❌ Read completo de ROADMAP, CHECKLIST, ou docs grandes
- ❌ Executar análises / scripts / tools
- ❌ Tocar / editar / criar arquivos
- ❌ Iniciar tasks investigation que JÁ SÃO o trabalho pedido

> **Princípio:** se o pedido em si é "investigar/analisar/auditar X", o branch DEVE ser criado primeiro (geralmente `docs/<slug>` ou `chore/<slug>`), porque o output (relatório, doc atualizado, sumário) é commit em algum lugar.

### Pergunta única decisória

**O trabalho vai gerar AAB novo + subir Play Console?**

| Resposta | Branch | Bump versão app |
|---|---|---|
| **Sim** | `release/vX.Y.Z.W` | Sim — bumpar último dígito (vc + 1, versionName + 1) em `android/app/build.gradle` + `package.json` |
| **Não** | Outro tipo (sugestões abaixo) | Não — app stays |

### Sugestões nome branch quando não-release (não exaustivo, IA escolhe)

| Tipo | Quando | Exemplo |
|---|---|---|
| `docs/<slug>` | Atualização documentação `contexto/`, ADRs, READMEs, comentários | `docs/passo-5b-classificacao` |
| `chore/<slug>` | Config CI, husky hooks, settings, gitignore, deps lock | `chore/eslint-bump-rules` |
| `server/<slug>` | Edge Function / migration / RLS / cron Supabase (sem afetar binário app) | `server/fix-notify-doses-500` |
| `refactor/<slug>` | Reorganização código sem mudança de behavior runtime | `refactor/split-dashboard-card` |
| `experiment/<slug>` | POC descartável, não merge master | `experiment/memed-poc` |

> **Se ambíguo:** IA escolhe a categoria mais próxima. User corrige se discordar.

### Princípio geral

IA usa **bom senso** pra:
- Investigar antes de propor fix (ex: bug Sentry → ler stack trace primeiro pra saber se origem é `src/` vs `supabase/`)
- Identificar arquivos prováveis com base em PROJETO.md §5 mapa estrutura
- Escolher tipo branch mais natural

Não há regra micro pra cada caso. Critério único é AAB sim/não. Resto é análise contextual.

### IA reporta antes criar branch

1. **Versões atuais** Internal Testing + Closed Testing (Chrome MCP no Play Console / cache memory).
2. **Análise resumida:** "trabalho identificado vai mexer em {X} → tipo {Y} sugerido".
3. **Branch proposto** + bump versão (se release).
4. **ESPERA OK user.** User pode corrigir tipo, IA acata + re-propõe.

### ⚠️ Após user dar OK — sequência OBRIGATÓRIA antes trabalho real

**IA NÃO inicia trabalho até criar branch + confirmar.** Não importa se user disse "segue", "ok", "vai", "prossegue":

1. **Criar branch IMEDIATAMENTE** (primeira ação após OK):
   ```bash
   git checkout -b {tipo}/{nome}
   ```

2. **Confirmar branch criado** (verificação obrigatória):
   ```bash
   git status   # deve mostrar "On branch {tipo}/{nome}"
   ```

3. **Se `release/v*`:** bump em `android/app/build.gradle` (`versionCode` + `versionName`) + `package.json` (`version`) + commit inicial:
   ```
   chore: abre release/vX.Y.Z.W — bump vc N→N+1
   ```

4. **Outros tipos:** branch fica vazia, sem commit inicial.

5. **SOMENTE AGORA** iniciar trabalho real (análise, leitura ampla, edits, git log extenso, executar tools).

> **Drift detector:** se IA já começou trabalho antes confirmar `git status` em branch nova → drift. PARAR, criar branch, retomar.

---

# 🔧 PASSOS 6-14 — Fechamento (após codar)

Quando o user confirmar próximo passo e você tiver implementado código, siga esta ordem.

> **Diferença conforme tipo de branch (Passo 5b):**
>
> | Passo | release/hotfix | docs / chore / server / refactor | experiment |
> |---|---|---|---|
> | 6 npm build | ✅ se tocou JS | ⚠️ só se tocou JS | ⚠️ opcional |
> | 7 preview Vercel | ✅ se web tocou | ❌ | ❌ |
> | 8 commit | ✅ | ✅ | ✅ |
> | 9 sync 4 docs | ✅ ROADMAP+CHECKLIST+PROJETO+README | ⚠️ só ROADMAP §3 + relevantes | ❌ |
> | 10 push | ✅ | ✅ | ✅ |
> | 11 build AAB + upload Play Console | ✅ | ❌ | ❌ |
> | 12 validação web + device | ✅ ambos | ⚠️ web smoke se relevante | ❌ |
> | 13 pós-release (tag + merge master + Vercel prod) | ✅ tag canônico | ⚠️ merge master sem tag/AAB, Vercel auto-deploy git push | ❌ não merge |
> | 14 STOP final | ✅ | ✅ | ✅ |
>
> Para `server/<slug>`: substituir Passo 11 por `mcp__...supabase__deploy_edge_function` ou `apply_migration` conforme escopo. Plus Passo 13 sem tag versão app.

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

Antes de pedir validação device pro user, verifique se o item pode ser validado via web.

**Ordem de prioridade do alvo da validação:**

1. **`http://localhost:5173/`** (`npm run dev`) — código local exato, mais rápido, não depende de push. **Default quando branch ainda não foi mergeada / código ainda em desenvolvimento**.
2. **Preview Vercel da branch** `https://dosy-git-{branch}-lhenriquepdas-projects.vercel.app` — testa build process Vite + envs Vercel. Usar após push da branch quando precisar validar build prod.
3. **`https://dosymed.app/`** (master prod) — apenas pós-merge master + Vercel deploy. Smoke test pós-deploy.

> Antes de validar: rodar `npm run dev` em background OR confirmar que `Bash` shell tem dev server vivo. Se não, IA inicia via `npm run dev` background.

**Validável via web** (qualquer um dos 3 alvos acima):
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

**Receita validação web (lifecycle completo):**

1. **Subir dev server localhost** se não rodar:
   ```bash
   npm run dev   # background — aguardar "VITE ready" no output
   ```
   Verificar `http://localhost:5173/` responde antes navegar.

2. **Navegar via Chrome MCP** para o alvo (localhost > preview Vercel > dosymed.app conforme prioridade):
   ```
   mcp__Claude_in_Chrome__tabs_context_mcp(createIfEmpty: true) → tabId
   navigate(url, tabId)
   screenshot — confirma carregou (sem ErrorBoundary)
   ```

3. **Entrar (login)** com conta teste — memory [`reference_test_accounts`](C:\Users\lhenrique\.claude\projects\G--00-Trabalho-01-Pessoal-Apps-medcontrol-v2\memory\reference_test_accounts.md):
   - `teste-plus@teste.com / 123456` — tier **plus** (sem ads, todas features). Default pra maioria validações.
   - `teste-free@teste.com / 123456` — tier **free** (paywall ativo, 1 paciente máx). Use quando item afetar gating Free/Plus.
   - Pular `OnboardingTour` clicando "Pular" canto superior direito.

4. **Identificar quais itens da release são web-validáveis** (vs device-only) — listar antes começar pra reportar status no fim.

5. **Iterar validações** por item:
   - `find` ou `read_page` localiza componente alvo
   - `javascript_tool` ou `computer` simula interação user (click, type, scroll)
   - `read_console_messages` (filter pattern) verifica logs/erros
   - `javascript_tool` inspeciona estado runtime (`localStorage`, `window.__dosyNetMonitor`, fiber walk pra QueryClient)
   - Screenshot como evidência

6. **Reportar:**
   - ✅ Web-validáveis confirmados (com evidências)
   - ⚠️ Web-parciais (validáveis em parte, parte exige device — explicar limite)
   - ⏳ Device-only (lista pra user executar S25 Ultra)

> **Limites conhecidos Chrome MCP web:**
> - DevTools Network throttling "Offline" não acessível direto. Override `navigator.onLine = false` ativa `useOnlineStatus` mas NÃO bloqueia fetch real → mutations não pausam de verdade. Drain offline-online ponta-a-ponta exige device físico OR Chrome DevTools Protocol.
> - Capacitor.Network bridge → onlineManager só ativa em `Capacitor.isNativePlatform()` — fluxo nativo não testável web.
> - FCM background, AlarmManager, plugin nativo CriticalAlarm — tudo Android-only.

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
4. **Atualizar [`contexto/Validar.md`](Validar.md)** adicionando seção nova no TOPO com a release atual (`## 🆕 Release vX.Y.Z — versionCode N`) contendo todos os itens device-only pendentes em formato checklist `[ ]`. Cada item tem 3 partes: **Como fazer**, **O que esperar**, **Se falhar**. Ver template em `Validar.md` da release v0.2.1.7.
5. Pedir validação manual ao user, apontando pra `Validar.md`

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
- Commit hash final + tag git criada (se release)
- Play Console status (Internal Testing publicado vc N+1, se release)
- Próximo P0 sugerido pra próxima session
- **Esperar comando user. Não emendar próximo trabalho automático.**

> **Quando user retornar com nova diretiva:** ativar **Passo 5b** (classificar trabalho proposto) ANTES de tocar qualquer arquivo. Investigar escopo + propor branch + esperar OK.

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
**Versão atual:** Branch `release/v0.2.3.0` ativa (rebranded `v0.2.3.1` logicamente — vc 64, vn 0.2.3.1). AAB pendente Play Console + validação device 5 FLUXOS Validar.md.
**Master @ tag:** `v0.2.2.4` (vc 62 Internal Testing 2026-05-13 16:48 BRT). Última release fechada estável.
**Vercel prod:** `https://dosymed.app/` (sincronizado master v0.2.2.4)
**Contas teste:** `teste-free@teste.com / 123456` (free) + `teste-plus@teste.com / 123456` (plus)

**Em curso — Release v0.2.3.1 (2026-05-13):**
- 🚧 **Refactor Plano A + Fixes B/C** após 4 auditorias linha-por-linha revelando 4 root causes arquiteturais não cobertos por #215-#226 v0.2.3.0. 7 blocos implementados em 8 commits + bump vc 63→64:
  - RC-1 dual tray race resolvido (Plano A unifica em Java M2 via `CriticalAlarm.scheduleTrayGroup`)
  - RC-2 prefs fire time resolvido (Fix B AlarmReceiver consulta SharedPrefs antes de fire)
  - RC-3 cancel group hash resolvido (Fix C reconstroi `sortedDoseIds.join('|')`)
  - RC-4 5 paths coordenação resolvida (PendingIntent única AlarmManager)
  - A-01..A-05 + B-01..B-03 fixados
  - 23 itens código morto removidos
- Backend: Edge dose-trigger-handler v20 (BATCH handlers) + 3 migrations applied
- Docs: `docs/alarm-scheduling-v0.2.3.1.md` novo + `contexto/auditoria/2026-05-13-alarme-push-FINAL-fluxo-e-refactor.md` consolidado
- Pendente: AAB vc 64 + validar 5 FLUXOS A-E em S25 Ultra (Validar.md)

**Última release fechada master:**
- ✅ v0.2.2.4 (2026-05-13) — **#214 P2 CLEANUP** Remove tabela `dose_alarms_scheduled` órfã (consumers — cron notify-doses-1min + schedule-alarms-fcm-6h — foram removidos em #209). 3 mudanças: (a) `scheduler.js` remove upsert + imports unused (`supabase`, `hasSupabase`, `getDeviceId`); (b) `DosyMessagingService.java` remove método `reportAlarmScheduled()` + call sites + imports HTTP unused; (c) Migration `drop_dose_alarms_scheduled_v0_2_2_4` aplicada. `alarm_audit_log` v0.2.2.0 substitui rastreio. Economia ~5-10 MB/dia/device egress + ~13k upserts/dia removidos. Validado Dosy-Dev Studio Run vc 62 — fluxo E2E 4 caminhos confirmados (JS App.jsx + Edge dose-trigger-handler + FCM + DosyMessagingService + AlarmScheduler nativo + audit log multi-source). Mark/skip/undo doses validados. AAB vc 62 publicado Internal Testing 2026-05-13 16:48 BRT. Tag `v0.2.2.4`.

**Release anterior fechada master:**
- ✅ v0.2.2.3 (2026-05-13) — **#213 P1 STORM REAL ROOT CAUSE** Logcat Dosy-Dev confirmou storm 60s exato vinha de `Dashboard.jsx:99` `setInterval setTick(60s)` flipando `todayDoses` ref → useEffect Dashboard:222 chamando `scheduleDoses(todayDoses)` → cancelAll + reagenda 9 alarmes idênticos cada 60s. App.jsx top-level signature guard v0.2.2.2 OK mas Dashboard caller sem guard era o storm. Fix: remove Dashboard caller completo (1 linha + import). App.jsx top-level cobre full 48h window. Validado Dosy-Dev Studio Run vc 61 — storm eliminado. Tag `v0.2.2.3`. AAB superseded por vc 62 mesmo dia.

**Release anterior fechada master:**
- ✅ v0.2.2.2 (2026-05-13) — **#212 P1 STORM ROOT CAUSE** Throttle v0.2.2.1 não eliminou storm (1.36 batches/min observado pós-deploy). 2 fixes: (a) Watchdog realtime 60s → 300s (5min); (b) App.jsx useEffect signature guard via useMemo `dosesSignature` (id:status:scheduledAt sorted) — re-trigger só em mudança real, não em ref-change. Esperado pós-vc 60: ~10 rescheduleAll/dia (era ~2000). AAB vc 60 publicado Internal Testing 2026-05-13 15:14 BRT. Tag `v0.2.2.2`.
- ✅ v0.2.2.1 (2026-05-13) — **#211 P1 HOTFIX** Storm rescheduleAll descoberto via audit v0.2.2.0. 3 fixes: (a) `SCHEDULE_WINDOW_MS` 168h→48h (alinha plan #209, era 168h hardcoded mas comentário dizia 48h); (b) Throttle module-level rescheduleAll 30s com trailing run (mata storm 1/min causado por realtime invalidation OR useEffect deps); (c) Audit batch single insert (acumulator + 1 insert/batch — antes 10-400 inserts/batch). Plus GRANT service_role + authenticated em alarm_audit_log/config (bug DB descoberto post-deploy v0.2.2.0). AAB vc 59 publicado Internal Testing 2026-05-13 13:53 BRT. Tag `v0.2.2.1`.
- ✅ v0.2.2.0 (2026-05-13) — **#210 NOVO P1** Sistema auditoria alarmes admin.dosymed.app. Tabela `alarm_audit_log` + config whitelist `alarm_audit_config` (seed: lhenrique.pda@gmail.com). Captura 6 caminhos (JS scheduler + Java AlarmScheduler/Worker/FCM + Edge daily-sync/trigger-handler) com source/action/dose/scheduledAt/metadata jsonb. Admin pages `/alarm-audit` (filtros + modal detalhes) + `/alarm-audit-config` (toggle por email). Cron diário cleanup >7d. AAB vc 58 publicado Internal Testing 2026-05-13 10:50 BRT. Tag `v0.2.2.0`.
- ✅ v0.2.1.9 (2026-05-13) — **#209 NOVO P0** Refactor sistema alarmes + push pós 3 bugs reportados user 2026-05-13. Migration SQL TZ fix `update_treatment_schedule` + data-fix doses pending; `DoseSyncWorker` JOIN patients; Nova Edge Function `daily-alarm-sync` (cron 5am BRT, 48h horizon); `dose-trigger-handler` v16 + action `cancel_alarms`; `AlarmScheduler.cancelAlarm`; UNSCHEDULE crons antigos (`notify-doses-1min`, `schedule-alarms-fcm-6h`); SCHEDULE `daily-alarm-sync-5am`. Egress estimado -99%. Plus fix #208 (VERSION_CODE_TO_NAME map +57). AAB vc 57 publicado 2026-05-13 10:09 BRT (substituído por vc 58 no mesmo dia). Tag `v0.2.1.9`.

**Release anterior fechada:**
- ✅ v0.2.1.8 (2026-05-11) — #205 NOVO P0 single source refresh token (storm xx:00 fix) + #204 expand fixes A1/A2/B/C + optimistic CRUD completos (update/pause/resume/end Treatment + registerSos) + forms edit offline + `useOfflineGuard` + `OfflineNotice` bloqueios features fora queue + bug fix `usePatient/useTreatment` initialData fallback + helper `patchEntityListsInCache`. Commit `b7b5c71`. Tag `v0.2.1.8`. 13 validações marcadas Validar.md.

**Release anterior:**
- ✅ v0.2.1.7 (2026-05-10) — #204 Mutation queue offline base + #207 Defesa em profundidade alarme + reestruturação contexto/ V2 (entry point Passos 0-14 + Validar.md). Commit `0edc6b3`. Tag `v0.2.1.7`.

**Validações pendentes (cumulativas — não-bloqueador):** ver [`Validar.md`](Validar.md) — 218.9.x #205 storm xx:00 (24h device + SQL `auth.refresh_tokens` + sessions lifespan) + 207.3 (3 dias alarme) + 207.4/207.5 parciais. Qualquer falha → fix v0.2.1.9+.

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
├── Validar.md            ← validações manuais pendentes · varrer no Passo 0
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
| Validações manuais pendentes (alertar user no Passo 0) | [`Validar.md`](Validar.md) |
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
