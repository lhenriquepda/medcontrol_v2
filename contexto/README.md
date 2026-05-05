# 📚 Pasta de Contexto — Dosy

> **Pasta de entrada do projeto.** Qualquer agente, dev ou stakeholder que pegue este projeto começa aqui.
>
> Esta pasta contém TUDO que é necessário pra entender: do que se trata, decisões tomadas, estado atual, ações concluídas, ações pendentes, restrições, convenções.

---

## ⚡ Início rápido para agentes

**Você é um agente IA recebendo este projeto pela primeira vez? Faça nesta ordem:**

1. **Leia este README inteiro** (você está aqui).
2. **Leia [`PROJETO.md`](PROJETO.md)** — briefing técnico canônico (stack, schema, convenções, gating Free/Plus/Pro/Admin, plugins nativos, deploy). É o "manual do operador" do código.
3. **Leia [`ROADMAP.md`](ROADMAP.md)** — onde paramos, próximo passo, fluxo macro de release.
4. **Leia o último log em [`updates/`](updates/)** — geralmente `release-vX.Y.Z.md` da última release publicada. Diz o que mudou e se há `release/v*` ativa em andamento.
5. **Conforme demanda do usuário:**
   - Pediu pra continuar desenvolvimento → ler item específico em [`CHECKLIST.md`](CHECKLIST.md)
   - Pediu detalhe técnico DB → [`auditoria/04-supabase.md`](auditoria/04-supabase.md)
   - Pediu detalhe frontend/cache/deps → [`auditoria/05-codigo.md`](auditoria/05-codigo.md)
   - Pediu sobre bug específico → [`auditoria/06-bugs.md`](auditoria/06-bugs.md)
   - Pediu sobre UX/fluxos → [`auditoria/07-usabilidade.md`](auditoria/07-usabilidade.md)
   - Pediu sobre decisão de arquitetura/produto → [`decisoes/`](decisoes/)
   - Pediu contexto histórico/justificativa de algo antigo → [`archive/`](archive/)

---

## 🗺️ Mapa da pasta

```
contexto/
├── README.md                    ← este arquivo · ENTRY POINT
├── PROJETO.md                   ← briefing técnico canônico (stack, DB, convenções)
├── ROADMAP.md                   ← onde estamos + onde vamos + processo de release
├── CHECKLIST.md                 ← detalhe item-a-item dos 73 itens (snippets, aceitação)
├── auditoria/                   ← snapshot da auditoria 2026-05-01
│   ├── 01-relatorio-completo.md
│   ├── 02-resumo-executivo.md
│   ├── 04-supabase.md
│   ├── 05-codigo.md
│   ├── 06-bugs.md
│   ├── 07-usabilidade.md
│   └── 08-limitacoes-web.md
├── decisoes/                    ← ADRs leves (decisões importantes que mudam contexto)
│   └── README.md                ← template + howto
├── updates/                     ← log cronológico de sessões
│   ├── README.md                ← template + howto
│   └── YYYY-MM-DD-titulo.md     ← um por sessão
└── archive/                     ← docs históricos imutáveis (referência)
    ├── plan-original.md         ← Plan.md original (62 KB roadmap pre-auditoria)
    ├── security-original.md     ← SECURITY.md (vulns operacionais pendentes)
    ├── contexto-original.md     ← snapshot Contexto.md em 2026-05-01
    ├── roadmap-original.md
    ├── plan-suggestions-original.md
    └── prompt-auditoria-v2.md   ← spec original que gerou a auditoria
```

---

## 🛠️ Regras de manutenção (CRÍTICO)

**Esta pasta é viva. Cada sessão de trabalho DEVE atualizá-la.**

### Regra 1 — Sempre atualize `ROADMAP.md` E `CHECKLIST.md` no fim da sessão

#### Princípio canônico

**`ROADMAP.md` e `CHECKLIST.md` são complementares, não-redundantes**:

| Documento | Propósito | Granularidade | Quando consultar |
|---|---|---|---|
| `ROADMAP.md` §6 | **Lista RESUMIDA** de todas as tarefas — visão macro | 1 linha por item (descrição curta + status `[ ]/[x]` + commit/release) | "O que falta? O que foi feito?" — overview |
| `CHECKLIST.md` | **Lista DETALHADA** das tarefas — visão técnica completa | Entry completo por item (snippet de código, dependências, critério de aceitação, racional, links auditoria) | "Como implemento o #042? Qual é o snippet? Que critério aceitar?" — execução |

**Ambos compartilham numeração** (`#001` ROADMAP = `#001` CHECKLIST). Toda mudança de status atualiza **AMBOS** — inconsistência = bug de manutenção que propaga para sessões futuras.

#### Workflow obrigatório por item

**Ao FECHAR um item:**
1. ✅ ROADMAP §6 → marcar `- [x] **#XXX** [...] **fechado v0.X.Y.Z commit `{sha}`** {descrição curta 1-2 linhas}`
2. ✅ CHECKLIST §#XXX → atualizar campo `**Status:**` para `✅ Concluído @ commit {sha} ({YYYY-MM-DD})`
3. ✅ Update log da release (`updates/YYYY-MM-DD-release-vX.Y.Z-*.md`) → adicionar item à seção "Items fechados v0.X.Y.Z"

**Ao DESCOBRIR um item novo (durante sessão):**
1. ✅ ROADMAP §6 → adicionar entry `- [ ] **#XXX** [PRIORIDADE] {descrição curta}` na seção certa (P0/P1/P2/P3)
2. ✅ CHECKLIST → criar entry completo com template:
   - `## #XXX — {título}`
   - `**Status:** ⏳ Aberto`
   - `**Prioridade:** P0/P1/P2/P3`
   - `**Origem:** {sessão YYYY-MM-DD / Sentry / user-reported / auditoria}`
   - `**Problema:** {descrição detalhada}`
   - `**Abordagem:** {snippet/plano técnico}`
   - `**Dependências:** {outros itens / libs / config}`
   - `**Critério de aceitação:** {como validar}`
3. ✅ Update log atual → adicionar à seção "Items novos descobertos"

**Numeração sequencial GLOBAL:** próximo número livre é o maior `#XXX` em uso + 1. Verificar:
```bash
grep -oE "#[0-9]{3}" contexto/ROADMAP.md contexto/CHECKLIST.md | sort -u | tail -5
```

#### Estados especiais CHECKLIST

- `🟡 Em progresso` — começou implementação mas não fechou
- `⏸️ Bloqueado — aguardando {dependência externa}` — ex: aguarda user device, aguarda config Supabase, aguarda merge externo
- `🚫 Cancelado — superado por #YYY` — item virou obsoleto, link pro substituto
- `⏭️ Parqueado vX.Y.Z` — postponed pra release futura específica
- `✅ Concluído @ commit {sha} ({YYYY-MM-DD})` — fechado, sempre cita commit

#### Validação de consistência (sanity check pré-merge)

```bash
# Items abertos CHECKLIST = items [ ] ROADMAP §6 (deve bater)
grep -c "Status:.*⏳ Aberto\|Status:.*🟡 Em progresso\|Status:.*⏸️ Bloqueado" contexto/CHECKLIST.md
grep -c "^- \[ \]" contexto/ROADMAP.md

# Items órfãos CHECKLIST (em CHECKLIST mas sem entry ROADMAP)
diff <(grep -oE "^## #[0-9]+" contexto/CHECKLIST.md | sort -u) <(grep -oE "^- \[.\] \*\*#[0-9]+" contexto/ROADMAP.md | grep -oE "#[0-9]+" | sort -u)
```

Inconsistência entre ROADMAP e CHECKLIST = **bug de manutenção bloqueante**. Corrigir antes de commit final + master merge.

#### Penalty de drift

Drift histórico observado: items fechados sem update CHECKLIST → próxima sessão acha item ainda aberto → re-implementação acidental → conflito git → tempo perdido.

**Auditoria semestral recomendada:** rodar agente cross-ref ROADMAP × CHECKLIST × `updates/*.md` (~2-3h cada vez), bulk-fix discrepâncias. Última auditoria: 2026-05-05 (ver bulk update v0.2.0.12 fechando ~60 discrepâncias acumuladas v0.1.7.4-v0.2.0.11).

### Regra 2 — Sempre crie um log em `updates/` no fim da sessão

Formato: `YYYY-MM-DD-titulo-curto.md` (ex.: `2026-05-15-fix-send-test-push-auth.md`).

Use template em [`updates/README.md`](updates/README.md). Cobre:
- O que foi feito (commits + arquivos tocados)
- Por que foi feito
- Itens do ROADMAP fechados (#XXX)
- Itens novos descobertos
- Estado deixado para próxima sessão

### Regra 3 — Decisões importantes viram ADR em `decisoes/`

Se a sessão tomou uma **decisão que muda o contexto do projeto** (ex.: "alarme passa a rodar sempre em background", "schema mudou de hard-delete pra soft-delete", "trocar Supabase por Firebase"), crie um arquivo em `decisoes/` antes de codar.

Use template em [`decisoes/README.md`](decisoes/README.md). Cobre:
- Contexto/problema
- Opções consideradas
- Decisão tomada
- Consequências (positivas + negativas)
- Status (aceita / superada por outra ADR)

### Regra 4 — `PROJETO.md` reflete o **estado atual** do código

`PROJETO.md` é o doc onboarding canônico. Tem que ser sempre verdadeiro.

**Atualize SE você IMPLEMENTOU mudança intencional:**
- Nova tabela / coluna DB
- Nova RPC ou migration
- Mudança em policy RLS
- Novo plugin Capacitor / dep prod
- Mudança em `config.toml` ou `capacitor.config.ts`
- Mudança em gating (Free/Plus/Pro/Admin)
- Nova convenção de código adotada
- Nova rota
- Mudança de comportamento de feature visível ao user
- Mudança em variável de ambiente esperada

**Não precisa atualizar SE foi:**
- Bug fix sem mudança de comportamento externo
- Refactor interno (mesmo contrato público)
- Update de teste apenas
- Lint/format fix
- Mudança em dep dev sem impacto na build

#### ⚠️ Discrepância entre PROJETO.md e realidade observada

**Se durante auditoria/teste/leitura você encontrar comportamento que CONTRADIZ `PROJETO.md`** (ex.: doc diz "limite Free 1 paciente" mas app cria 3; doc diz "alarme bypassa DND" mas observou DND silenciar):

🚨 **NÃO atualize `PROJETO.md` automaticamente.** A discrepância pode ser:
- **(a)** doc desatualizado (mudança implementada sem update do doc) → corrigir doc
- **(b)** bug / regressão (app não cumpre intenção original) → corrigir app
- **(c)** ambos (mudança intencional parcial + bug)

Você não tem contexto pra decidir. **Reporte ao usuário humano** com:

```markdown
🚨 DISCREPÂNCIA DETECTADA

**`PROJETO.md` §X afirma:** "{citação}"
**Realidade observada:** {o que você viu, com evidência: arquivo:linha, screenshot, network req}
**Possíveis causas:**
- (a) doc desatualizado — atualizar PROJETO.md
- (b) regressão/bug — abrir item no ROADMAP
- (c) decisão pendente — criar ADR

**Não vou tomar ação até decisão sua.**
```

Aguarde decisão antes de prosseguir. Pode ser que o user:
- Decida (a) → você atualiza PROJETO.md + nota em `updates/`
- Decida (b) → você abre BUG novo, adiciona ao ROADMAP, talvez ADR se mudar arquitetura
- Decida (c) → ADR + plano de remediação

### Regra 5 — Auditoria é histórica, não viva

`auditoria/` é snapshot 2026-05-01 (auditoria estática completa pré-lançamento). **Não edite** os arquivos lá dentro.

**Nova auditoria? Crie pasta nova ao lado por convenção de tipo:**

| Tipo de auditoria | Pasta | Quando |
|---|---|---|
| Estática completa (25 dimensões) | `auditoria-{YYYY-MM-DD}/` | Re-auditoria full pré-marco grande |
| Live nav exaustiva (sessão profunda no app rodando) | `auditoria-live-{YYYY-MM-DD}/` | Sessão de QA explorada manual |
| Pen test profissional | `pentest-{YYYY-MM-DD}/` | Contratado externo |
| Device validation manual (FASE 17) | `device-validation-{YYYY-MM-DD}/` | 3 devices físicos |
| A11y audit dedicada | `a11y-{YYYY-MM-DD}/` | TalkBack + axe DevTools |
| Performance / Lighthouse | `perf-{YYYY-MM-DD}/` | Profile completo |

Cada pasta nova deve ter um `README.md` próprio com veredito + sumário, e documentar tipo + escopo + duração + ferramentas usadas.

#### Numeração de bugs cross-pasta

Bugs são **numerados sequencialmente em todo o projeto** (`BUG-001`, `BUG-002`, ...) — nunca recomeçam por pasta. Última auditoria deixou em `BUG-015` (ver `auditoria/06-bugs.md`). Próximo bug encontrado em qualquer auditoria futura é `BUG-016`.

**Por quê:** evita conflito de IDs ao referenciar entre pastas, ROADMAP, commits e PRs.

**Como descobrir o próximo número:**
```bash
grep -rh "^## BUG-" contexto/ | sort -V | tail -1
```

### Regra 6 — `archive/` é imutável

Arquivos históricos. **Nunca edite.** Apenas leitura.

### Regra 7 — Nunca dois agentes editando ao mesmo tempo

Esta pasta é fonte da verdade compartilhada. Se você está rodando em paralelo com outro chat/sessão, **coordene** ou aguarde. Conflitos de versão aqui custam caro porque se propagam pra todas as sessões futuras.

### Regra 8 — Comunicação com usuário não-dev (CRÍTICA)

**Usuário deste projeto não é desenvolvedor.** Não sabe git avançado, não conhece JWT/DevTools/curl, não distingue branch de tag. Comunicação técnica complexa = bloqueio = fricção.

#### Princípios de comunicação

1. **Toda jargão técnica DEVE ser traduzida** na primeira menção:
   - ❌ *"Edge Function deployada em prod"*
   - ✅ *"Correção colocada no servidor — está rodando agora"*
   - ❌ *"JWT do DevTools → IndexedDB → supabase-auth-token"*
   - ✅ *"Esse teste precisa que você faça login na sua conta — consegue agora?"*
   - ❌ *"git merge --no-ff + push origin"*
   - ✅ *"Vou juntar branch com master e atualizar o servidor"*

2. **Toda decisão pedida ao user DEVE incluir recomendação clara.**
   - ❌ *"(a) X, (b) Y, (c) Z. Qual prefere?"*
   - ✅ *"Recomendo X porque {motivo}. Quer X? (sim/não)"*

3. **Preferir perguntas binárias (sim/não) sobre múltipla escolha.**
   - Múltipla escolha só quando consequência de cada opção for **claramente diferente** e **explicada em 1 linha cada**

4. **Nunca pedir input que requer conhecimento técnico do user.**
   - Se teste exige JWT, DevTools, curl, terminal config → agente faz tudo OU sugere pular o teste explicando o risco

5. **Resumo em 1 linha sempre primeiro.** Detalhes técnicos abaixo, recolhidos.
   - ❌ Tabela de 8 cenários antes de dizer se funcionou
   - ✅ *"✅ Funcionou. 6 de 8 testes passaram, 2 pulei porque exigiriam sua conta admin. Risco do não-testado é baixo. Detalhes abaixo se quiser ver."*

6. **Vocabulário proibido AO FALAR COM USER (sem tradução):**

   > Esta lista se aplica APENAS a mensagens que o user vai LER. Em docs internas (`contexto/`, READMEs, comentários de código, commits, PRs) os termos técnicos são livres — o public-alvo lá é dev/agente.

   `JWT` · `Bearer` · `prod` · `deploy` · `mergear` (use "juntar" ou "publicar") · `branch` (use "versão de teste" ou "rascunho separado") · `commit` (use "salvar mudança") · `endpoint` · `payload` · `token` (no body, OK em headers explicados) · `staging` · `production` (use "servidor de teste" / "servidor real") · `IndexedDB` · `localStorage` (use "cache do navegador") · `CORS`, `CSRF` (explicar de forma curta inline)

7. **Vocabulário OK** (já familiar pelo PROJETO.md): paciente, dose, tratamento, alarme, push, FCM (mencionar 1x e usar "notificação"), Vercel, Play Store, Android, AAB.

8. **Comandos pro user copiar:** sempre completos, prontos pra colar. Sem placeholder genérico tipo `<ref>` ou `{token}`.
   - ❌ `supabase functions deploy {name} --project-ref <ref>`
   - ✅ Agente roda no Bash dele e mostra resultado. OU diz: *"Cole isso no terminal: `supabase functions deploy send-test-push --project-ref guefraaqbkcehofchnrc`"* (com valor real preenchido)

#### Template "Decisão de aprovação"

Toda vez que precisar aprovação do user pra ação:

```markdown
{Resumo 1 linha do que aconteceu até agora}

**Próxima ação:** {O que vou fazer se aprovar, em português simples}

**Por que recomendo:** {Razão em 1-2 linhas}

**Risco se aprovar:** {Em 1 linha — o que pode dar errado}
**Risco se não aprovar:** {Em 1 linha — o que perdemos esperando}

**Aprova?** (sim / não / quero entender melhor antes)
```

Exemplo (correção do que aconteceu na sessão real):

> Bug crítico de segurança corrigido. Testei 6 cenários — todos passaram. 2 cenários extras que eu queria testar exigiam acessar sua conta admin (não vou fazer login no seu lugar).
>
> **Próxima ação:** juntar correção com versão principal e atualizar servidor.
>
> **Por que recomendo:** os 6 testes cobrem a parte arriscada (bloquear quem não é admin). O que ficou sem testar é o caminho que já funcionava antes — não mexi nessa parte.
>
> **Risco se aprovar:** mínimo — se algo quebrar, reverter leva 30 segundos.
> **Risco se não aprovar:** servidor continua vulnerável até você decidir testar mais.
>
> **Aprova?** (sim / não / quero entender melhor antes)

#### Template "Reporte de teste"

```markdown
**Resultado:** ✅ Funcionou / ⚠️ Funcionou parcial / ❌ Falhou

**O que testei:** {1-2 linhas plain português}

**O que faltou:** {1 linha — o que ficou sem teste e por quê}

**Recomendação:** {ir adiante OR testar mais antes}

<details>
<summary>Detalhes técnicos (opcional)</summary>

{tabela técnica, comandos curl, status codes, etc.}

</details>
```

#### Template "Pergunta sobre coisas técnicas que o user não sabe"

Se chegou num ponto que precisa de info que o user não-dev não tem:

```markdown
Pra continuar, preciso de {X}.

**O que é {X}:** {explicação 1-2 linhas em português}

**Como conseguir:**
- Opção fácil: {ação simples}
- Opção mais técnica: {se a fácil não der}

**Se não for possível agora:** podemos pular esse passo. Risco: {1 linha}.

Como você prefere?
```

Exemplo:

> Pra testar o último cenário, preciso fazer login com sua conta admin no app.
>
> **O que é "conta admin":** sua conta principal que tem permissão especial pra mandar push de teste. Outras contas (teste-free, teste-plus) não.
>
> **Como conseguir:**
> - Opção fácil: você loga no app web (https://dosy-app.vercel.app), eu te guio passo a passo pra rodar o teste a partir do navegador.
> - Opção mais técnica: pular esse teste e confiar nos 6 que passaram (risco baixo — caminho não-testado é o que já funcionava antes).
>
> Como você prefere?

#### Auto-checagem antes de enviar mensagem ao user

Antes de mandar resposta longa, agente revisa:
- Tem jargão sem tradução? Se sim, traduzir.
- Pedi decisão sem dar recomendação? Se sim, adicionar recomendação.
- Resumo em 1 linha está no topo? Se não, adicionar.
- Pedi pro user fazer algo técnico? Se sim, oferecer alternativa fácil ou pular.

### Regra 9 — Automação web admin via Claude in Chrome MCP (CRÍTICA)

**User é não-dev.** Listas de 10-15 passos manuais em Play Console, Vercel, Supabase Studio, GitHub = fricção alta + risco erro humano. Agente DEVE dirigir browser via `mcp__Claude_in_Chrome__*` em vez de pedir clicks manuais.

**Quando aplicar:**
- Play Console: criar release, upload AAB metadata, salvar release notes, start rollout, ler crashes/ANRs
- Vercel dashboard: verificar deploy status, ler logs, revalidar env vars
- Supabase Studio: aplicar migration via UI, ler logs, conferir RLS policies, ver dashboard egress
- GitHub: criar release, ler Actions logs, conferir webhooks
- Sentry: criar alert rule, conferir release tag, ler issue details
- Qualquer console web admin

**Padrão de execução:**
1. Agente abre/seleciona aba via `navigate` ou `select_browser` → `tabs_create_mcp`
2. Agente lê estado da página com `get_page_text` ou `read_page` ou `preview_snapshot`
3. Agente preenche forms via `form_input` ou `javascript_tool` (set value + dispatch event)
4. Agente clica botões via `find` + `javascript_tool` (`.click()`) ou `mcp__Claude_in_Chrome__computer`
5. Agente valida resultado via `read_console_messages` + `get_page_text` re-check

**Upload de arquivo — agente faz via `mcp__Claude_in_Chrome__file_upload` (DISCOVERY 2026-05-05 release v0.2.0.10):**

Antes parecia que upload exigia user manual (drag-drop). Na verdade MCP tem tool `file_upload` que entrega arquivo direto pro `<input type="file">` element — sem precisar clicar botão "Enviar"/"Procurar"/"Choose file".

**Pegada:** clicar no botão visível ABRE native file picker dialog que é invisível ao agente (impossível navegar). Solução: ignorar botão, achar input file element direto.

**Receita validada (Play Console upload AAB):**
```
1. find tabId, query: "file input upload AAB pacote app"
   → retorna ref tipo button "(file input)" (file)
2. file_upload({ paths: ["G:\\...\\app-release.aab"], ref: "ref_XXX", tabId })
   → upload inicia + Console mostra "está sendo otimizado pra distribuição"
3. wait 8-15s + screenshot pra confirmar "1 pacote de apps enviado" + nome arquivo listado
```

Sites com drop zone visual mas SEM input file exposto no DOM: aí sim pause + peça user manual. Mas Play Console / Vercel / GitHub Actions todos têm input acessível (HTML padrão `<input type="file">` escondido por CSS atrás do botão).

**NÃO use:** `computer.left_click` no botão "Enviar" — abre native dialog invisível.
**Use:** `find` + `file_upload` com ref direto.

**Conta Google ativa para Play Console / Google Workspace:** `dosy.med@gmail.com`. Antes de iniciar fluxo Play Console / Search Console / qualquer painel Google, agente DEVE conferir conta logada (geralmente avatar no canto superior direito). Se outra conta estiver ativa, agente pausa e pede user pra trocar pra `dosy.med@gmail.com` antes de continuar (não tem como agente trocar conta — exige interação user com o seletor de contas Google).

**Não confundir com:** login Google + 2FA push + senha — manuais user-only por questão de segurança. Agente nunca digita credencial em form de login.

**Fallback se Chrome MCP indisponível:** lista textual de passos manuais (formato anterior). Mas Chrome MCP é o caminho preferido sempre que possível.

**Reporte ao user:**
```
Vou dirigir o Play Console / Vercel / etc pra você. Pause só pra upload do AAB.
{passo a passo automatizado começa}
```

### Regra 9.1 — Validação preview Vercel via Chrome MCP (DISCOVERY 2026-05-05 v0.2.0.11)

**Antes de fechar release branch:** agente DEVE validar preview Vercel `dosy-git-{branch}-lhenriquepdas-projects.vercel.app` via Chrome MCP. Não confiar só em build verde local.

**Achados v0.2.0.11 que JUSTIFICAM essa regra:**
- #144 hook integration causou logout cascade em prod (não detectado no build/lint local)
- #148 extend_continuous_treatments rpc 2× por mount (AnimatePresence popLayout)
- #149 mutation refetch storm 12 fetches /doses (mark/skip/undo cascade)
- #150 refetchInterval 5min × 5 queryKeys = idle storm 5 fetches/cycle
- #151 refetchInterval só Dashboard (outras telas off)

Todos esses bugs identificados POR Chrome MCP + JS fetch interceptor (`window.__dosyNetMonitor`) no preview Vercel real, não em local.

**Receita validação preview obrigatória:**

1. **Branch pushed → Vercel preview rebuild ~2min**
2. **Login real** (teste-plus@teste.com / 123456 OR admin) via `form_input` + click
3. **Arm fetch interceptor** via `mcp__Claude_in_Chrome__javascript_tool`:
   ```js
   if (!window.__dosyNetMonitorV3) {
     window.__dosyRequests = []
     window.__dosyNetMonitorV3 = true
     const origFetch = window.fetch
     window.fetch = async function(url, opts) {
       const u = typeof url === 'string' ? url : (url?.url || '')
       const isSupa = u.includes('supabase.co')
       const start = Date.now()
       const path = isSupa ? u.split('?')[0].replace('https://guefraaqbkcehofchnrc.supabase.co', '') : ''
       const resp = await origFetch.apply(this, arguments)
       if (isSupa) {
         const cloned = resp.clone()
         let bodySize = 0
         try { bodySize = (await cloned.text()).length } catch {}
         window.__dosyRequests.push({ ts: start, path, method: opts?.method || 'GET', size_bytes: bodySize, status: resp.status })
       }
       return resp
     }
   }
   window.__dosyRequests.length = 0
   window.__dosyMonitorStart = Date.now()
   ```

4. **Bateria interações reais:**
   - Click dose → DoseModal → Tomada
   - Click dose → DoseModal → Pular
   - Click Desfazer toast
   - Pull-to-refresh
   - Navegar `/historico` → click chips dia
   - Navegar `/pacientes` → click paciente
   - Navegar `/relatorios`
   - Navegar `/sos`, `/mais`, `/ajustes`
   - Voltar `/`

5. **IDLE longo 5min+** (Bash `sleep 300` + run_in_background) — detectar polling/refetch background.

6. **Read window.__dosyRequests** + agrupar por endpoint + count + bytes:
   ```js
   const groups = {}
   let totalBytes = 0
   for (const r of window.__dosyRequests) {
     const k = `${r.method} ${r.path}`
     if (!groups[k]) groups[k] = { count: 0, total_bytes: 0 }
     groups[k].count++
     groups[k].total_bytes += r.size_bytes || 0
     totalBytes += r.size_bytes || 0
   }
   ```

7. **Triggers ALERT:**
   - Idle >2min com requests = polling não-justificado
   - Mutation única gera >3 fetches downstream = storm cascade
   - 5+ active queryKeys simultâneas = candidatas opt-in interval
   - Endpoints duplicados `+0ms` = double-mount (AnimatePresence/StrictMode/etc)

**Pegada:** Chrome MCP `read_network_requests` é flaky — limpa em SPA navigation. Usa fetch interceptor JS (`window.__dosyNetMonitorV3`) — sobrevive navegações client-side.

**Pegada 2:** SPA navigate via `mcp__Claude_in_Chrome__navigate` faz full page reload (limpa monitor). Pra preservar monitor entre rotas, use History API:
```js
history.pushState({}, '', '/ajustes')
window.dispatchEvent(new PopStateEvent('popstate'))
```

**Sequência idle longa via background sleep:**
```bash
# Tool: Bash com run_in_background:true
sleep 300
# Aguarde TaskOutput ou notificação completion
# Depois ler window.__dosyRequests via JS
```

**Sempre que possível** — não só releases que mexem em egress/auth/realtime — agente valida preview Vercel via Chrome MCP. Especialmente:
- Mudanças hooks React Query (queryKey, staleTime, refetchInterval)
- Mudanças useEffect com deps complexas
- Refactors splittando arquivos (verifica imports/lazy chunks)
- Mudanças schema DB (RLS, RPCs, triggers)
- Auth flow changes (login, logout, refreshSession)

---

## 🎯 Quando o usuário pede algo

| Pedido típico | Faça |
|---|---|
| "Continue de onde paramos" | Leia `ROADMAP.md` §3 e §4. Inicie próximo item priorizado |
| "Trabalhe no item #023" | Leia `CHECKLIST.md` §#023. Confirme dependências fechadas. Implemente |
| "Mude X no schema/auth/alarme" | Antes de codar: criar `decisoes/{data}-{titulo}.md`. Atualize `PROJETO.md` no fim. Atualize `ROADMAP.md` se afeta planejamento |
| "Quero feature/seção nova X" | Ver §"Geração de novos itens — feature nova" abaixo |
| "Audite Y" / "live nav exaustivo" / "pen test" | Ver §"Geração de novos itens — auditoria" abaixo |
| "Qual estado da segurança?" | `auditoria/01-relatorio-completo.md §2` + `archive/security-original.md` (vulns operacionais) |
| "Por que decidimos X?" | Procure em `decisoes/`. Se não houver, ler em `archive/plan-original.md` |
| "Posso deletar arquivo Z" | Verifique se está referenciado em `PROJETO.md` ou outros docs. Documente a remoção em `updates/` |
| "Achei bug Y" / "tem bug em Z" | Reproduzir em código → catalogar como `BUG-NNN` na pasta de auditoria correspondente (ou criar `auditoria-live-{data}/` se for descoberta isolada). Decidir classificação `[ANDROID]`/`[AMBOS]`/`[WEB-ONLY]`. Se [ANDROID] ou [AMBOS] → gerar item(s) `#NNN` no ROADMAP/CHECKLIST. [WEB-ONLY] não entra no checklist (vai pra `auditoria/08-limitacoes-web.md`) |

**Padrão de fluxo:**
```
1. Ler README + PROJETO + ROADMAP §3-4
2. Verificar/criar branch release/v{próxima}
3. Ler arquivo específico se demanda for técnica
4. Trabalhar (todos commits na branch release/v*)
5. Atualizar ROADMAP + CHECKLIST + criar updates/{ts}.md + (se aplicável) PROJETO.md + decisoes/
6. Commit na branch release/v* (NÃO em master)
7. Master só recebe merge no fim da sessão, quando user disser "publica"/"terminamos" (ver §"Publicar release")
```

---

## ➕ Geração de novos itens no ROADMAP/CHECKLIST

> Sempre que descobrir/criar trabalho novo (feature, bug, action item de auditoria, decisão pendente), entra aqui.

### Sources que geram itens

- Pedido feature nova ("estoque", "iOS", "compartilhar família")
- Bugs encontrados em auditoria (estática, live nav, pen test, device validation)
- Bugs encontrados durante outro trabalho (escapou de teste)
- ADR aprovada que gera trabalho de remediação
- Feedback de tester real
- Compliance / regulatory change

### Diferença entre bug e item ROADMAP

- `BUG-NNN` é **achado documentado** em pasta de auditoria (`auditoria/06-bugs.md` ou pasta nova `auditoria-live-{data}/`)
- `#NNN` do ROADMAP é **ação executável** que resolve aquele bug
- Bug pode gerar 0, 1 ou múltiplos items #NNN. Ex.: BUG-002 → #001 + #002
- Bug `[WEB-ONLY]` gera 0 items (não-bloqueante Android — só registra)

### Geração de novos itens — feature nova

User pede feature nova ("quero seção X", "adicionar Y"):

1. **Buscar duplicatas** primeiro:
   ```bash
   grep -i "{tema}" contexto/ROADMAP.md contexto/CHECKLIST.md
   ```

2. **Se já existe** → reportar item #XXX existente + perguntar:
   - (a) priorizar — promover de P3→P1 (justificar negócio)
   - (b) expandir escopo — adicionar sub-itens (#XXX.1, #XXX.2)
   - (c) feature diferente, criar novos items separados

3. **Se nova de fato** → quebrar em sub-tarefas executáveis. Cada sub-task vira 1 item.
   Exemplo "estoque medicação":
   ```
   #074 ADR-NNN: arquitetura estoque (tabela vs coluna)         P1  1h
   #075 Migration: tabela medication_stock + FKs + RLS           P1  2h
   #076 RPC decrement_stock_on_dose_taken                        P1  1h
   #077 UI seção "Estoque" em PatientDetail                      P1  4h
   #078 Form add/edit estoque                                    P1  3h
   #079 Alerta "acabando" (≤ N doses restantes)                  P1  2h
   #080 Integração com Notifications (push refill)               P1  2h
   #081 Testes unit + integration                                P1  3h
   #082 Atualizar PROJETO.md §6 e §4                             P1  30min
   ```

4. **Confirmar lista com user** — esforço, prioridade, escopo. Aguardar OK.

5. **Após confirmação:**
   - Adicionar items em `ROADMAP.md` §6 na prioridade negociada (P0/P1/P2/P3)
   - Adicionar entries detalhadas em `CHECKLIST.md` (numeração sequencial, `Status: ⏳ Aberto`, esforço, deps, snippet quando possível, aceitação)
   - Atualizar `ROADMAP.md` §12 contadores
   - Se mudança arquitetural → criar ADR em `decisoes/` ANTES de implementar

6. **Implementar:** seguir workflow padrão item por item.

7. **Trabalho acontece na branch da release ativa** (`release/v{próxima-versão}`). Se ainda não existe, agente cria no início da sessão. Múltiplos items fechados = múltiplos commits na MESMA branch.

8. **Ao concluir todos os items da feature:** atualizar `PROJETO.md` (nova seção §6 Funcionalidades, §4 schema DB se aplicável, §12 Rotas).

### Geração de novos itens — auditoria

User pede auditoria (estática, live nav, pen test, etc.):

1. **Decidir tipo** e criar pasta nova ao lado de `auditoria/` conforme tabela em Regra 5:
   - `auditoria-{data}/` — estática completa
   - `auditoria-live-{data}/` — live nav exaustiva
   - `pentest-{data}/`, `device-validation-{data}/`, `a11y-{data}/`, `perf-{data}/`

2. **Executar auditoria** documentando em arquivos da pasta nova:
   - `README.md` (sumário + veredito)
   - `bugs-encontrados.md` (BUG-NNN sequencial cross-pasta — descobrir próximo via `grep -rh "^## BUG-" contexto/ | sort -V | tail -1`)
   - Outros arquivos conforme tipo (diário, friction log, dashboards, etc.)

3. **Para cada bug encontrado:**
   - Classificar `[ANDROID]` / `[AMBOS]` / `[WEB-ONLY]`
   - `[WEB-ONLY]` → registra em `bugs-encontrados.md` mas **não entra** no ROADMAP
   - `[ANDROID]` ou `[AMBOS]` → quebrar em ação(ões) executável(eis):
     - 1 bug pode virar 1 item ou múltiplos no ROADMAP
     - Ex.: BUG-002 (send-test-push) virou #001 (admin check) + #002 (sanitizar erro)

4. **Adicionar action items** ao ROADMAP/CHECKLIST:
   - Numeração sequencial (próximo após #073 = #074)
   - Em `ROADMAP.md` §6 prioridade certa (P0 se bloqueador, P1 se alta, etc.)
   - Em `CHECKLIST.md` entry completa com link cruzado para bug: `Detalhe: contexto/auditoria-{tipo}-{data}/bugs-encontrados.md#bug-NNN`
   - `Status: ⏳ Aberto`
   - Atualizar `ROADMAP.md` §12 contadores

5. **Reportar ao user** com template:
   ```
   Auditoria {tipo} concluída em ~Xh.

   Bugs catalogados: N (P0:a · P1:b · P2:c · P3:d)
   Items adicionados ao ROADMAP/CHECKLIST: M
   Pasta criada: contexto/auditoria-{tipo}-{data}/

   ROADMAP §12: P0 {antes}→{depois} · P1 ... etc

   Top 3 críticos:
   1. ...
   2. ...
   3. ...

   Próximo passo §4: {revisado conforme novos achados}

   Quer atacar próximo P0 ou priorizar bug novo da auditoria?
   ```

### Bug isolado (descoberto fora de auditoria formal)

Durante outro trabalho ou uso casual, achou bug:

1. **Reproduzir em código** se possível.
2. **Buscar** se já está catalogado: `grep -i "{tema}" contexto/auditoria*/bugs* contexto/ROADMAP.md`.
3. **Se novo:**
   - Decidir onde catalogar:
     - Tem auditoria-live recente aberta → adicionar lá
     - Sem auditoria recente → criar `auditoria-live-{data}/bugs-encontrados.md` minimalista (1-2 bugs OK)
   - BUG-NNN com numeração sequencial cross-pasta
   - Classificar plataforma + severidade
   - Se [ANDROID]/[AMBOS] → adicionar item(s) `#NNN` ROADMAP/CHECKLIST
4. **Reportar ao user** + perguntar se prioriza ou continua trabalho atual.

---

## ⚙️ Workflow operacional padrão

### Pre-trabalho (sempre)

1. `git fetch origin && git branch --list 'release/*'` — descobrir se já existe release branch ativa
2. **Se existe** (ex.: retornou `release/v0.1.6.10`): `git checkout release/v0.1.6.10` — continuar acumulando commits da sessão anterior. **Modelo permite só 1 ativa por vez.** Se aparecer mais de uma → erro de manutenção, reportar antes de tudo.
3. **Se NÃO existe:** criar branch `release/v{próximo}` (incremento último dígito do master atual; ver §"Versão da branch") direto, sem perguntar bump
4. `git status` — working tree limpo? Branch correta?
5. `git log -1 --format="%h %s"` — último commit conhecido
6. **Se itens P0 ou destrutivos na fila:** confirmar com usuário antes de codar
7. **Listar itens previstos da sessão** ao usuário com estimativa de esforço

### Durante o trabalho (por item)

1. Ler `CHECKLIST.md §#XXX` (snippet, deps, aceitação, Status atual)
2. **Atualizar `Status` em CHECKLIST §#XXX** de `⏳ Aberto` → `🟡 Em progresso`
3. Confirmar dependências fechadas (itens listados como "Dependências" — verificar Status delas em CHECKLIST)
4. Ler arquivo(s) do código afetado(s)
5. Editar
6. **Gates obrigatórios antes de marcar concluído:**
   - `npm run lint` — 0 errors
   - `npm test` — se item afeta lógica testada (utils, services, hooks)
   - Critério de aceitação do CHECKLIST §#XXX validado manualmente
7. **Atualizar AMBOS:**
   - `ROADMAP.md` §6: marcar `[x]` no item
   - `ROADMAP.md` §12: decrementar contador da prioridade (P0 9→8 etc)
   - `CHECKLIST.md §#XXX`: `Status: 🟡 Em progresso` → `Status: ✅ Concluído @ commit {sha-curto} ({YYYY-MM-DD})`
8. **Validar consistência ROADMAP ↔ CHECKLIST:**
   ```bash
   grep -c "Status:.*⏳ Aberto\|Status:.*🟡 Em progresso\|Status:.*⏸️ Bloqueado" contexto/CHECKLIST.md
   # deve bater com soma dos contadores ROADMAP §12 (P0+P1+P2+P3 abertos)
   ```

### Items dependentes / "parte de #X"

Se um item do CHECKLIST diz **"parte de #001"** ou **"depende de #001"**, ele entra no **mesmo commit** do item pai. Marca `[x]` em ambos no ROADMAP.

Ex.: `#001` (admin check) + `#002` (sanitizar erro enumeration, parte de #001) = 1 commit `security: ...` com `Fecha #001 #002`.

### Commit

- 1 item simples = 1 commit
- Itens dependentes = 1 commit
- Itens não-relacionados = commits separados
- **Nunca `--no-verify`** sem permissão explícita do user
- **Nunca `git reset --hard` ou `git push --force`** em master sem confirmação

**Formato:**
```
{type}({version}): {sumário curto, ≤72 chars}

{detalhe opcional, por que vs o que}

Fecha #XXX #YYY do contexto/ROADMAP.md.
```

**Types:** `feat` · `fix` · `security` · `chore` · `docs` · `refactor` · `test` · `perf` · `ci`

**Versão:** sempre incremento último dígito (regra Dosy — ver §"Versão da branch").

### Branch / PR — modelo "1 sessão = 1 branch versionada = 1 release"

> **🌟 FONTE CANÔNICA do modelo de branch.** Outras seções (`§Padrão de fluxo`, `§Pre-trabalho`, `§Próxima sessão`, `§Geração de items` passo 7) só apontam pra cá. Mudou regra? Atualize aqui primeiro.

**`master` é sagrado.** Sempre reflete a última versão publicada (Play Store + Vercel produção sincronizados). Trabalho do dia-a-dia **NUNCA** vai direto pra master.

**Princípio "1 sessão = 1 branch versionada = 1 release" + dual-app Android:**

- Branch `release/v{X.Y.Z}` em desenvolvimento → builds Android instalam como **Dosy Dev** (`com.dosyapp.dosy.dev`) via Studio Run debug variant
- Master + Play Store oficial → builds Android instalam como **Dosy** (`com.dosyapp.dosy`) via AAB release variant
- **Dosy Dev e Dosy coexistem no mesmo device** — user usa Dosy oficial normalmente enquanto Dosy Dev roda testes
- Reduz risco: nenhum teste destrutivo (force stop, idle 24h, dose injection) afeta Dosy oficial
- Workflow padrão: agente acumula commits na release branch → user testa em Dosy Dev → quando OK, ciclo release oficial promove pra Dosy

#### Modelo

```
Sessão começa
  ├── Agente cria branch única `release/v{próxima-versão}`
  │     (ex.: master em v0.1.6.9 → branch `release/v0.1.6.10`)
  │
  ├── TODAS as mudanças desta sessão vão nessa branch:
  │     - código (src/, android/, supabase/functions/, supabase/migrations/)
  │     - docs (contexto/, README, comentários)
  │     - data fixes em prod (registro do cleanup, mesmo sem código)
  │     - cada item ROADMAP fechado vira 1 commit nessa branch
  │
  ├── Sessão pode durar 1 chat ou múltiplos chats — branch persiste entre eles
  │
  └── Quando user diz "terminamos" / "publica" / "manda pro Play Store":
        └── Ciclo de release dos 8 passos (ver §"Publicar release"):
              1. Bump versão (package.json + android/app/build.gradle)
              2. Build AAB local (Android Studio)
              3. Upload Play Console + start rollout
              4. Merge --no-ff branch → master + tag vX.Y.Z + push
              5. Vercel auto-deploya (~2 min)
              6. Atualizar contexto/ (PROJETO.md versão, ROADMAP §3, updates/)
              7. Reporte final ao user
              8. Branch deletada
```

#### Por que esse modelo

- **Single-dev sem CI completa:** cada merge pra master vai direto pra produção. Não pode haver código intermediário lá.
- **Healthcare = zero margem de erro:** rollback de release inteiro = `git revert {tag}` (atômico). Rollback de commits soltos em master = frágil.
- **Atomicidade:** master + Vercel produção + Play Store AAB sempre 3 sincronizados.
- **Reduz ritual:** branch única elimina decisão "criar nova branch?" a cada item.
- **Bump uma única vez no fim:** não importa quantos itens fecharam; release é evento único.

#### Convenção nome de branch

```
release/v{versão-próxima}
```

Sempre. Único formato. Ex.: `release/v0.1.6.10`, `release/v0.1.7.0`, `release/v0.2.0.0`.

#### Versão da branch = versão proposta da release

**Regra Dosy:** sempre incrementar **último dígito** (`X.Y.Z.W → X.Y.Z.(W+1)`), independente do escopo (bug fix, feature visível, breaking change). Numeração linear simples, NÃO semver tradicional.

- Master em `0.2.0.5` → próxima branch `release/v0.2.0.6`
- Master em `0.2.0.9` → próxima branch `release/v0.2.0.10`
- Não sugerir minor (`0.2.1.0`) ou major (`0.3.0.0`) bump.

Agente cria branch `release/v{próximo}` no início da sessão sem perguntar bump (só confirma master atual + próxima versão proposta como info, não como decisão).

#### Múltiplas sessões antes de release

Branch `release/v0.1.6.10` persiste entre sessões. Agente em chat novo:
1. Lê `git branch` → vê `release/v0.1.6.10` ativa
2. Faz checkout dela (não cria nova)
3. Continua acumulando commits

#### Hotfix urgente fora do ciclo

Cenário raro: bug crítico em produção precisa fix imediato sem mexer em release/v0.1.6.10 em andamento.

- Branch `hotfix/{tema}` saindo direto de master (não da release branch)
- Bump patch automático
- Ciclo release encurtado (skip preview Vercel)
- Após hotfix: rebase release/v0.1.6.10 onto master atualizada

#### Mudanças que NÃO entram em release branch

Raras exceções pra master direto (sem branch + sem bump):
- `.gitignore`, scripts `tools/` puro dev
- Correção typo em commit message anterior (via amend, antes de push)

**Tudo que afeta usuário, build, deploy ou doc canônico → release branch.**

- Pre-commit hooks ainda não configurados (item #024 do ROADMAP). Por enquanto, gates manuais antes de commit.

---

## 🧪 Como testar mudanças (guia para usuário não-dev)

> **Regra ouro:** sempre que o agente mudar algo, ele DEVE dizer 3 coisas:
> 1. **Onde estou agora** (release branch ativa, qual versão master segue rodando em produção)
> 2. **Onde você testa essa mudança** (comando exato, URL específica)
> 3. **Quando publica de verdade** (continua acumulando próximos itens nesta release OU já vai pro Play Store?)

### Ambientes de teste

| Ambiente | Pacote / URL | Reflete | Quando usar |
|---|---|---|---|
| **Local web (dev server)** | `npm run dev` → http://localhost:5173 | seu working tree (mudanças não-commitadas inclusas) | iteração rápida, qualquer mudança web |
| **Dosy Dev (Android Studio Run)** | pkg `com.dosyapp.dosy.dev` · label "Dosy Dev" | branch `release/v*` ativa empacotada | **TODO trabalho de release branch em device físico/emulator vai aqui.** Coexiste lado-a-lado com Dosy oficial. Dados separados, alarme/notif/storage isolados. |
| **Vercel dev** | https://dosy-dev.vercel.app | branch `release/v*` ativa (re-aliased após cada `vercel deploy --yes`) | **validação OBRIGATÓRIA pré-merge.** Toda release passa aqui antes de promover pra prod |
| **Vercel produção** | https://dosy-app.vercel.app | **master estável** (atualiza APENAS após ciclo completo: validação dev → merge master → tag → AAB Play Store) | **NUNCA aponta pra release ativa.** Mantém versão estável até release fechar |
| **Dosy oficial — Play Store Internal Testing** | pkg `com.dosyapp.dosy` · URL opt-in: `https://play.google.com/apps/internaltest/4700769831647466031` | último AAB submetido (master ou atrás) | validação real Android **só recebe builds quando release oficial é cortada (Passo 3 do ciclo)** |

**Princípio Vercel (regra crítica):**
- `dosy-app.vercel.app` = sempre versão **estável publicada** (master pós-tag + AAB Play Store ativo)
- `dosy-dev.vercel.app` = sempre **release em desenvolvimento** (branch `release/v*` corrente)
- Validação em dev é GATE OBRIGATÓRIO antes de promover pra prod. NUNCA deploy --prod direto da release branch.
- Comandos:
  - Release em desenvolvimento → `vercel deploy --yes` + `vercel alias set <url> dosy-dev.vercel.app`
  - Promover pra prod (FIM do release): merge → master + tag + AAB publicado primeiro, THEN `git checkout master && vercel --prod && vercel alias set <url> dosy-app.vercel.app`

**Princípio dual-app:**
- **Dosy Dev** (`com.dosyapp.dosy.dev`): app instalado pelo Android Studio Run em debug variant. Usa Firebase entry separada (`google-services.json` em `src/debug/`) — push FCM dev funciona sem afetar prod. Reinstalado a cada Run. Use livremente pra testes destrutivos, force stop, idle longo.
- **Dosy** (`com.dosyapp.dosy`): app oficial Play Store. Recebe builds APENAS via release oficial (release branch → AAB → Console). Nunca instalado via Studio Run no flow normal.
- Coexistem no mesmo device. User pode usar Dosy normalmente enquanto Dosy Dev roda testes em background (force stop, idle 24h, etc).

### Decisão "onde testar" por tipo de mudança

| Mudança | Teste mínimo |
|---|---|
| Edge Function (Supabase server-side) | Deploy em prod via `supabase functions deploy {name} --project-ref guefraaqbkcehofchnrc` (PAT em `.env.local`) → testar com `curl` direto. **Rollback:** `git checkout {tag-anterior} -- supabase/functions/{name}/` + redeploy. Edge Functions são deploy independente do AAB/Vercel; podem ser deployadas durante sessão pra testar antes do release final. |
| Migration DB | Local web + verificar dados via Supabase Studio (cloud) |
| UI web apenas | Local web → http://localhost:5173 |
| UI compartilhada web+Android | Local web PRIMEIRO + **Dosy Dev** (Android Studio Run) se afeta layout mobile |
| Plugin nativo Android (alarme, biometria, push, secure storage) | **Dosy Dev** em device físico (`com.dosyapp.dosy.dev`) |
| Mudança que afeta build (gradle, capacitor.config) | Build full `npm run build:android` + Android Studio Run → **Dosy Dev** |
| Mudança em config Supabase (config.toml, RLS) | Aplicar em cloud + testar via local web |
| Validação idle ilimitado / WorkManager / alarmes nativos | **Dosy Dev** force stop + esperar (24-48h) — Dosy oficial fica intocado durante teste |

### Fluxo de teste passo-a-passo (para você, não-dev)

**Cenário web: agente está acumulando mudanças na branch `release/v0.1.7.1` e quer que você teste em browser.**

1. Agente diz: *"Mudança X pronta na branch release/v0.1.7.1. Testa local:"*
2. Comandos exatos: `git checkout release/v0.1.7.1 && npm install && npm run dev`
3. Abre http://localhost:5173, loga `teste-plus@teste.com / 123456` (ou `teste-free@teste.com` se for testar paywall)
4. Reporta: "funcionou" ou "não funcionou"

**Cenário Android: agente quer que você teste em device físico (alarme, idle, plugin nativo).**

1. Conecta cabo USB no device, **Depuração USB ON**
2. Android Studio aberto + branch `release/v*` checked out + sync Gradle OK
3. Click **Run ▶** — Studio compila + instala **Dosy Dev** (`com.dosyapp.dosy.dev`)
4. **Dosy Dev** abre no celular — ícone separado de Dosy oficial
5. Login `teste-plus@teste.com / 123456` (mesmo backend Supabase; pra testar paywall use `teste-free@teste.com / 123456`)
6. Pode desconectar cabo — app instalado roda independente
7. Faz testes (criar dose, force stop, esperar idle, etc) **APENAS no Dosy Dev**
8. **Dosy oficial Play Store** continua funcionando paralelo, intocado, com seus dados/medicamentos reais
9. Quando terminar testes: simplesmente desinstala **Dosy Dev** ou deixa pra próxima sessão

**Master NÃO é tocada** durante a sessão. Dosy oficial só recebe nova versão quando você disser "publica" → ciclo release dos 8 passos (AAB build + Console upload + merge master + tag).

### O que evitar

- ❌ Testar em produção (https://dosy-app.vercel.app) o que **ainda não foi mergeado** — você vai testar versão antiga e achar que mudança "não funcionou"
- ❌ Confiar que "Play Store já tem versão nova" só porque mergeou pra master — Android exige build/upload manual (até CI Android estar configurado)
- ❌ Mexer em `master` direto durante a sessão — sempre via release branch
- ❌ Criar branch nova `fix/*` ou `feature/*` no meio de uma sessão com `release/v*` ativa — tudo vai na release branch
- ❌ **Instalar build de release branch como "Dosy" oficial** — sempre instalar como **Dosy Dev** (`com.dosyapp.dosy.dev`) via Android Studio Run debug variant. Studio Run em release variant escreveria sobre Dosy oficial — só fazer no ciclo de release final.
- ❌ **Misturar dados entre Dosy e Dosy Dev** — se logar mesma conta nos dois apps, ambos veem o mesmo backend Supabase. OK pra teste, mas crie tratamentos teste só em Dosy Dev pra não poluir histórico real.

### Regra de ouro — fix de bug device-specific (ex.: emulador antigo)

Quando bug aparece em **um device** (emulador antigo, viewport específico, OEM fork) mas **NÃO em device de referência** (Samsung S25 Ultra device físico = baseline atual), o fix DEVE preservar comportamento no device de referência. Caso contrário, fix vira regressão pior que o bug original.

**Protocolo obrigatório antes de commit:**
1. Reproduzir bug no device com problema (ex.: emulador Pixel 7 API 35) — confirmar repro consistente
2. Implementar fix
3. Testar fix no device com problema — confirmar resolvido
4. **Testar fix no device de referência (S25 Ultra)** — confirmar zero regressão
5. Se passo 4 falhar, voltar pro 2 (revisar fix). Não commit antes de ambos passarem.

**Se fix exige trade-off (não dá pra cobrir ambos)**: documenta em ADR (`contexto/decisoes/`) explicando opção escolhida + lista devices afetados. Reporta user antes de prosseguir.

Aplicável a: layout responsive, race conditions timing, latência realtime, plugins nativos, FCM behavior, gestures touch.

### Mensagem padrão do agente ao iniciar sessão

> Use **exatamente** este template. Não improvise. Não adicione info técnica extra.

```
🌿 Vou trabalhar em separado, sem mexer no que está no ar.

**No ar agora (intocado):** v{atual}
- App web: https://dosy-app.vercel.app
- Dosy oficial Play Store: AAB v{atual}

**Branch desta sessão:** `release/v{próxima}` (todas mudanças vão aqui)
**Onde mudanças aparecem em Android:** **Dosy Dev** (instalado via Studio Run, coexiste com Dosy oficial)

**O que vou fazer:** {descrição em 1-2 linhas, português simples}

**Onde você vai testar quando eu terminar uma mudança:**
- Web: `npm run dev` → http://localhost:5173 (eu te guio passo a passo)
- Android: Android Studio Run → instala/atualiza **Dosy Dev** no device. Dosy oficial fica intocado.

**Quando publicar de verdade:** só quando você disser "publica" / "terminamos" — aí faço bump de versão + AAB + Console + merge master + tag.

**Posso começar?** (sim / não / tenho dúvida)
```

---

## 🚀 Publicar release (fim de sessão)

> Quando user pede "publica" / "manda pro Play Store" / "atualiza produção" / "finaliza e libera". Aqui master é sincronizado com Play Store + Vercel produção.

### Princípios

1. **Release = sincronizar 3 ambientes** (master git + Vercel produção web + Play Store AAB) + tag git. Não é "só dar merge". É evento atômico cobrindo bump de versão, build AAB, upload Console, merge master, tag, deploy Vercel, atualizar `contexto/`.
2. **3 ambientes sincronizados sempre:** master = Vercel produção = Play Store Internal AAB. Sem desvios. Exceção: release "só web/server" (sem mudança Android) pode pular Build AAB + Console — versão ainda bumpada e taggeada.
3. **Bump de versão é parte do release**, não preparação separada. Decidido no Passo 1 com base nos commits acumulados.
4. **Cada release ganha tag git** (`v0.1.6.10`) pra rollback rápido (`git revert {tag}`).
5. **Próxima sessão = ciclo novo.** Mesmo chat ou novo. Nova `release/v{X.Y.Z+1}` a partir de master. Novo bump no fim.

### Pre-checks (agente roda antes de iniciar release)

```bash
# 1. Branch atual = release/v{próxima} (NÃO master)
git branch --show-current  # deve retornar algo como release/v0.1.6.10

# 2. Working tree limpo
git status --porcelain

# 3. Tudo committado, sync com origin
git log --oneline origin/$(git branch --show-current)..HEAD
git fetch origin

# 4. Items fechados desta sessão estão marcados [x] em ROADMAP + Status atualizado em CHECKLIST
grep -c "Status:.*✅ Concluído" contexto/CHECKLIST.md
```

Se algo falha → agente reporta e pede usuário corrigir antes de prosseguir.

### Os 8 passos do release

#### Passo 1 — Decidir bump de versão (semver)

Agente analisa commits da branch desde último merge e decide:

| Tipo de mudança | Bump | Exemplo |
|---|---|---|
| Bug fix sem novo comportamento | **patch** | `0.1.6.9` → `0.1.6.10` |
| Feature nova / mudança visível ao user | **minor** | `0.1.6.9` → `0.1.7.0` |
| Breaking change (raro pré-1.0) | **major** | `0.1.x` → `1.0.0` |

Reporta ao user: *"Mudanças desta sessão são patch/minor/major. Bump proposto: vX.Y.Z. Confirmar?"*

#### Passo 2 — Atualizar arquivos de versão

```bash
# package.json
npm version {patch|minor|major} --no-git-tag-version
# (ou edição manual do campo "version")

# android/app/build.gradle
# - versionCode: incrementa +1 (sequencial sempre, nunca volta)
# - versionName: espelha package.json
```

Commit dedicado: `chore(release): bump to vX.Y.Z`

#### Passo 3 — Build do AAB (Android, vai pra Dosy oficial)

> **IMPORTANTE:** AAB release variant tem `applicationId = com.dosyapp.dosy` (sem suffix `.dev`). Após upload no Console, vira atualização do **Dosy oficial** Play Store. Dosy Dev (debug variant `.dev`) NÃO é afetado e continua coexistindo no device dos testers.

Agente guia step-by-step (user não-dev):

1. *"Abra Android Studio com o projeto carregado"*
2. *"Menu **Build** → **Generate Signed Bundle / APK** → **Android App Bundle**"*
3. *"Selecione keystore: `dosy-release.keystore` (deve estar em `android/`)"*
4. *"Senhas vêm de `android/keystore.properties` — Android Studio puxa automático se config OK"*
5. *"Variant: **release**"* — IMPORTANTE: release, não debug
6. *"Aguardar build (~2-3min)"*
7. *"AAB sai em: `android/app/release/app-release.aab`"*
8. *"Confirma tamanho (~17-20 MB esperado) e me avisa quando estiver pronto"*

**Why release variant matters:** debug variant build = pkg `com.dosyapp.dosy.dev` (Dosy Dev), release variant build = pkg `com.dosyapp.dosy` (Dosy oficial). Console aceita só release-signed AABs.

#### Passo 4 — Publicar no Play Console

Agente abre Play Console via Claude in Chrome:

1. Navega: `https://play.google.com/console` → app Dosy → **Internal testing** (ou track decidido)
2. Click **Create new release**
3. **Upload AAB:**
   - Aguarda user fazer drag-drop do `app-release.aab`
   - Console valida (versionCode > anterior)
4. **Release name:** auto-preenche com `vX.Y.Z (NN)` — agente confirma com user
5. **Release notes** (max 500 chars por idioma):
   - Agente escreve em pt-BR usando items fechados nesta sessão (ROADMAP/CHECKLIST `Status: ✅ Concluído`)
   - User revisa antes de salvar
6. **Save** → **Review release** → **Start rollout to Internal testing**
7. Agente confirma com user que "Released" aparece no Console.

#### Passo 5 — Merge para master + tag

Após confirmação Console publicado:

```bash
git checkout master
git pull origin master                                    # sync
git merge --no-ff release/v{X.Y.Z} -m "release: vX.Y.Z"   # preserva história
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin master --tags
```

#### Passo 6 — Vercel produção sincroniza

Push pra master deve auto-trigger Vercel deploy (assumindo CI configurado em `vercel.json` + GitHub integration).

```bash
# Aguardar ~2 minutos
# Confirmar versão exibida em https://dosy-app.vercel.app/ajustes (rodapé "Versão")
```

Agente avisa user: *"Aguarda ~2min e abre https://dosy-app.vercel.app/ajustes (Ctrl+F5 pra forçar refresh). Versão deve mostrar vX.Y.Z. Me confirma?"*

Se Vercel deploy falhar: agente investiga via dashboard Vercel, reporta erro, decide se rollback Play Store (problemático) ou hotfix.

#### Passo 7 — Atualizar `contexto/`

- `PROJETO.md`: atualizar metadata "Versão atual: vX.Y.Z" + commit hash + data
- `ROADMAP.md` §3 "Onde paramos": atualizar última versão publicada + data + items fechados nesta release
- `ROADMAP.md` §12 contadores (revalidar)
- `contexto/updates/{data}-release-vX.Y.Z.md`: log completo da sessão (template `updates/README.md`)
  - Items fechados
  - Bugs novos descobertos
  - AAB submetido (commit hash + timestamp)
  - URL Vercel produção confirmada
  - Próximo passo (próxima release? bug específico?)

Commit:
```
docs(release): vX.Y.Z release log

- ROADMAP atualizado (estado §3, contadores §12)
- PROJETO atualizado (versão atual)
- updates/{data}-release-vX.Y.Z.md
```

#### Passo 8 — Limpar branch da release

```bash
git branch -d release/v{X.Y.Z}
git push origin --delete release/v{X.Y.Z} 2>/dev/null  # se foi pushada
```

Branch da release sempre é deletada após merge — próxima sessão cria nova branch com versão `v{X.Y.Z+1}`. Tag git `vX.Y.Z` permanece (ponto de referência pra rollback).

### Reporte final ao user

```
🚀 RELEASE vX.Y.Z PUBLICADA

**Estado dos 3 ambientes (sincronizados):**
- ✅ master @ commit {sha} · tag vX.Y.Z
- ✅ Vercel produção: https://dosy-app.vercel.app (vX.Y.Z visível em Settings)
- ✅ Play Store Internal Testing: AAB vX.Y.Z (versionCode NN) em rollout

**Items fechados nesta release:** N (P0:a · P1:b · P2:c · P3:d)
- ✅ #001: ...
- ✅ #002: ...

**Bugs novos descobertos:** M (catalogados em {pasta})

**ROADMAP §12:** P0 N→M · P1 N→M · P2 inalterado · P3 inalterado

**Sessão registrada:** contexto/updates/{data}-release-vX.Y.Z.md
**Tag git:** vX.Y.Z

**Próxima release:** quando você pedir. Mesmo chat ou novo, ciclo recomeça em nova branch com bump no fim.

**Validação 24h pós-release:**
- Sentry: crash spike?
- Internal Testing testers reportaram algo?
- Play Console crashes/ANRs?
```

### Próxima sessão (mesmo chat ou novo)

User pede algo novo. Agente:

1. Lê README + PROJETO + ROADMAP §3-4 (PROJETO já reflete vX.Y.Z)
2. `git fetch origin && git branch -v` — verifica se já existe `release/v*` ativa de sessão anterior
3. **Se sim:** checkout dela (continua acumulando)
4. **Se não:** confirma próxima versão com user, cria `release/v{X.Y.Z+1}` a partir de master atualizada
5. Trabalha — pode ser 1 sessão curta ou várias longas, todas no mesmo branch
6. Quando user pedir "publica" / "terminamos" → ciclo §"Publicar release" recomeça com bump correspondente

**Não há "release contínuo" silencioso.** Cada release é evento explícito + atomic + tagueado + sincronizado em 3 ambientes.

### Edge cases

- **Hotfix urgente em produção:** branch `hotfix/{tema}` saindo direto de master (não interfere em release/v* ativa). Ciclo encurtado (skip preview Vercel, build AAB direto). Bump patch sempre. Após hotfix mergear pra master, rebase release/v* atual onto master nova.
- **Mudança só web/server (sem AAB novo):** legítimo se não-mobile (ex.: só Edge Function, só docs/contexto, só Vercel deploy). Ainda vai em release branch + ainda merece bump (web também versionada). Diferença: Passo 2 (Build AAB) e Passo 3 (Console) são pulados. Reporta: *"Mudança só web/server. Bump vX.Y.Z, sem novo AAB."* AAB Play Store fica atrás de master nesse caso até próximo release Android.
- **Vercel deploy falha após merge master:** investigar dashboard Vercel. Se for transient, retry. Se for breaking, `git revert` o merge + investigar causa antes de re-tentar.
- **AAB rejeitado pelo Play Console:** corrigir, bump patch, novo build, novo upload. Master ainda não foi tocado nesta etapa (ordem dos passos: AAB → Console → master) — exatamente pra cobrir esse cenário.

### Ordem é importante

1. Bump versão na branch ✅
2. Build AAB local ✅
3. Upload Console + iniciar rollout ✅
4. **APENAS DEPOIS:** merge pra master + tag + push
5. Vercel auto-deploya
6. Atualizar contexto/

**Por quê:** se passo 3 (Console) falhar, master ainda não foi tocado. Reverter mais simples. Master só vira "verdade publicada" quando confirmado nos 3 ambientes.

### Reporte ao usuário no fim da sessão

Template:
```
**Concluído nesta sessão:**
- ✅ #XXX: {título curto}
- ✅ #YYY: {título curto}

**ROADMAP:** P0 N→M · P1 N→M · P2 N→M · P3 N→M

**Próximo passo §4:** #ZZZ ({1-line razão})

**Bloqueadores externos:** {itens dependentes do user, com indicação clara}

**Sessão registrada em:** `contexto/updates/{file}.md`

**Quer continuar com #ZZZ ou outra prioridade?**
```

---

## 🔍 Mapa diagnóstico

> Quando o usuário reporta sintoma sem apontar arquivo, comece por aqui:

| Sintoma / Pergunta | Onde investigar |
|---|---|
| Alarme não dispara em Android | `android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/AlarmReceiver.java` + `AlarmActivity.java` + `AlarmService.java` + `services/notifications.js` + `AndroidManifest.xml` (permissions) |
| Alarme dispara mas sem som | `AlarmActivity.java` MediaPlayer + `AlarmService.java` channel sound + system DND state |
| Alarme não re-agenda após reboot | `BootReceiver.java` + SharedPreferences `dosy_critical_alarms` |
| Push FCM não chega | `supabase/functions/notify-doses/index.ts` + `usePushNotifications.js` + `services/notifications.js` + Firebase Console |
| Push duplicado / fora de horário | `notify-doses` window logic + `useUserPrefs` advance_mins + DND prefs |
| Login falha | `services/supabase.js` + `useAuth.jsx` + Supabase Dashboard auth logs |
| Reset password não funciona | `App.jsx` deep link handler `dosy://reset-password` + `pages/ResetPassword.jsx` |
| Dose não salva | `services/dosesService.js` (RPCs `confirm_dose`, `skip_dose`, `undo_dose`) + RLS policies via `auditoria/04-supabase.md §5` |
| SOS dose bloqueada | `register_sos_dose` RPC + trigger `enforce_sos_via_rpc_trigger` + `sos_rules` validation |
| Tratamento contínuo sem doses futuras | RPC `extend_continuous_treatments` (sumiu — BUG-004 #014) + pg_cron fallback |
| Build Android quebra | `android/app/build.gradle` + `proguard-rules.pro` + JDK version + Gradle Wrapper |
| APK release crashes | source maps Sentry + `proguard-rules.pro` keep rules + ProGuard mapping |
| Bundle web inflado | `dist/stats.html` (após build prod) + `vite.config.js` `manualChunks` |
| Cache TanStack Query mal | `main.jsx` defaultOptions + hook específico em `hooks/use*.js` |
| FLAG_SECURE / privacy | `usePrivacyScreen.js` + `@capacitor-community/privacy-screen` config |
| Storage seguro / KeyStore | `services/supabase.js` `SecureStorageAdapter` + `@aparajita/capacitor-secure-storage` |
| LGPD / export / delete conta | `pages/Settings.jsx` (botões) + RPC `delete_my_account` + Edge Function `delete-account` |
| Realtime não atualiza | `hooks/useRealtime.js` + `subscriptions` Supabase Dashboard |
| Tier (Free/Plus/Pro) errado | `services/subscriptionService.js` + RPC `admin_grant_tier` + tabela `subscriptions` |
| Encoding / acentos quebrados | DB `medcontrol.patients.name` direto (BUG-001) + Supabase JS client config |

---

## 📋 Estado atual do projeto

> **Atualizado a cada release no Passo 7** (ver §"Publicar release"). Se essa seção contradiz `ROADMAP.md §3` ou `git log`, fonte da verdade é o git.

**App:** Dosy — Controle de Medicação · pkg `com.dosyapp.dosy`
**Público-alvo:** amplo — pais com crianças em tratamento, pessoas organizadas com múltiplos medicamentos diários, cuidadores formais/informais, clínicas/consultórios, hospitais/instituições, idosos auto-gerindo medicação. **NÃO é app exclusivo de idosos.** Decisões UX seguem design universal — fluxos simples e legíveis servem todas personas.
**Versão atual:** `0.1.7.5` (tag `v0.1.7.5`) · branch `master`
**Vercel prod:** `https://dosy-app.vercel.app/` (master = v0.1.7.5)
**Vercel dev:** `https://dosy-dev.vercel.app/` (release branch ativa — atualmente espelha master)
**Contas teste:** `teste-free@teste.com / 123456` (tier free) + `teste-plus@teste.com / 123456` (tier plus). Antiga `teste03@teste.com` deletada.
**Play Store Internal Testing:** AAB versionCode 30 / versionName 0.1.7.5.

**Última release publicada:** v0.1.7.5 em 2026-05-03 — fechou #084 (JWT rotation) / #092 (egress) / #093 (Realtime race) / #094 (paywall race) / #095 (versão real).

**Veredito da última auditoria:** ⚠️ **PRONTO COM RESSALVAS** · Score 7.0/10 médio em 25 dimensões. BUG-016 + #085 + #087 Fase A resolvidos.

**Bloqueadores P0 ativos:** 4 itens (#084 fechado v0.1.7.5).
- #003 rotação senha postgres + revogar PAT (~30min, manual user)
- #004 vídeo demo FGS Play Console (~2-3h, manual user)
- #006 device validation 3 devices físicos (1-2 dias, manual user)
- #007 PostHog telemetria (depende #018 manual)
- #008 Sentry GitHub Secrets (~15min, manual user)
- #009 PITR + DR drill (depende upgrade Pro plan)

**Bugs novos pra v0.1.8.0:**
- #086 Resumo Diário fix completo (migration + Edge cron + timezone)
- #088 Dose não aparece em Início sem refresh (TanStack Query invalidate)
- #089 Layout AdSense + header truncamento Pixel 7

**Próximo passo concreto:** validação 24h pós-release v0.1.7.5 (Sentry crash spike, Console crashes/ANRs, Supabase egress trend). Depois v0.2.0.0 redesign (user vai escrever prompt detalhado quando começar) ou v0.1.8.0 minor (#086 Resumo Diário fix + #089 Pixel 7 layout + P1 batch).

---

## ⚠️ Limitações conhecidas

1. **Live nav 15 min** (não 90 min ideais) — sessão profunda em device físico ainda pendente (FASE 17 do Plan original — item #006).
2. **`remote_schema.sql` vazio** — RLS policies inferidas via Plan/SECURITY/services. Confirmar via SQLs em `auditoria/04-supabase.md §15` no Supabase Studio.
3. **TS 6.0.3** declarado em `package.json` — verificar legitimidade (BUG-007 P3).
4. **Sem testes E2E** — fluxos completos cobertos parcialmente.

---

## 📝 Convenções desta pasta

- **Idioma:** Português (BR) por default. Códigos/snippets em inglês quando idiomático.
- **Markdown:** GFM. Headings semânticos. Links relativos entre docs.
- **Datas:** ISO 8601 (`YYYY-MM-DD`).
- **Nomeação updates:** `YYYY-MM-DD-acao-curta.md` (ex.: `2026-05-15-fix-encoding-utf8.md`).
- **Nomeação ADRs:** `YYYY-MM-DD-NNN-titulo.md` (ex.: `2026-05-20-001-alarme-background-persistente.md`).
- **Não use emojis em código.** Use em docs com moderação se ajudar leitura.
- **Não delete `archive/`.** Histórico imutável.

---

## 🤖 Para o usuário humano

Esta pasta foi desenhada pra que **qualquer agente IA novo** consiga retomar o trabalho sem você precisar reexplicar contexto. Funciona como handoff.

**Se você quer que um agente continue:**

> Cole isto no chat novo:
>
> *"Continue o desenvolvimento do projeto. Leia `contexto/README.md` inteiro pra entender estrutura + regras. Depois leia `contexto/PROJETO.md` + `contexto/ROADMAP.md`. Confirme estado antes de começar. [descrever sua demanda específica]"*

**Se você terminou uma sessão e quer garantir que o contexto está atualizado antes de fechar:**

> Diga ao agente:
>
> *"Antes de finalizar, garante que ROADMAP.md está atualizado, cria entry em updates/ com resumo desta sessão, e se houve decisão importante, cria ADR em decisoes/. Atualiza PROJETO.md se houve mudança técnica."*

---

🚀 **Próximo passo concreto:** abrir [`CHECKLIST.md` §#001](CHECKLIST.md#001--adicionar-auth-check-de-admin-em-send-test-push-edge-function).
