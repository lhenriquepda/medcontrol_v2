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
4. **Skim [`updates/`](updates/)** — últimos 1-2 logs de sessão pra entender o que mudou recentemente.
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

ROADMAP e CHECKLIST **compartilham numeração** (`#001` aqui = `#001` lá). Atualize **ambos** em qualquer mudança de status — manter consistente é obrigatório.

**Em `ROADMAP.md`:**
- Item fechado? Marque `[x]` em §6
- Atualize contadores §12 (P0 9→8 etc)
- Bug novo descoberto? Adicione na prioridade certa (P0/P1/P2/P3) com numeração sequencial (#074 e diante)
- Próximo passo mudou? Reescreva §4

**Em `CHECKLIST.md`:**
- Atualize campo `**Status:**` do item:
  - `⏳ Aberto` → `🟡 Em progresso` ao começar
  - `🟡 Em progresso` → `✅ Concluído @ commit {sha} ({YYYY-MM-DD})` ao fechar
  - Estados especiais:
    - `🚫 Cancelado — superado por #YYY` (com link)
    - `⏸️ Bloqueado — aguardando {dependência externa}`
- Item novo? Adicione entry completo (snippet, deps, aceitação) com `Status: ⏳ Aberto`

**Validação de consistência:**

```bash
# Itens abertos no CHECKLIST devem bater com contadores do ROADMAP §12
grep -c "Status:.*⏳ Aberto\|Status:.*🟡 Em progresso\|Status:.*⏸️ Bloqueado" contexto/CHECKLIST.md
```

Inconsistência entre ROADMAP e CHECKLIST = bug de manutenção. Corrigir antes de commit final.

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
2. Ler arquivo específico se demanda for técnica
3. Trabalhar
4. No fim: atualizar ROADMAP + CHECKLIST + criar updates/{ts}.md + (se aplicável) PROJETO.md + decisoes/
5. Commit
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

7. **Branch dedicada se >500 LOC ou múltiplos items P0/P1.** PR final.

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

1. `git status` — working tree limpo? Branch correta?
2. `git log -1 --format="%h %s"` — último commit conhecido
3. `git fetch origin && git status` — sync com remote (sem ahead/behind unexpected)
4. **Se itens P0 ou destrutivos na fila:** confirmar com usuário antes de codar
5. **Listar itens previstos da sessão** ao usuário com estimativa de esforço

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

**Versão:** bump conforme escopo (patch pra fix, minor pra feature, major pra breaking).

### Branch / PR — modelo "master = release"

**`master` é sagrado. Sempre reflete a ÚLTIMA versão publicada.**

- `master` = `https://dosy-teal.vercel.app` (Vercel produção) = AAB no Play Store Internal Testing — **sempre os 3 sincronizados**
- Trabalho do dia-a-dia **NUNCA** vai direto pra master
- Master só recebe merge no momento de **publicar release** (ver §"Publicar release" abaixo)

**Toda mudança = branch nova:**

| Tipo de mudança | Nome de branch sugerido |
|---|---|
| Fix bug | `fix/{tema}` |
| Feature nova | `feature/{tema}` |
| Refactor (geralmente com ADR) | `refactor/{tema}` |
| Mudança segurança | `security/{tema}` |
| Só docs / contexto/ | `docs/{tema}` |
| Migration DB | `migration/{tema}` |

**Por quê master = release apenas:**
- Single-dev sem CI de validação automática completa → cada merge pra master vai pra produção
- Healthcare = zero margem de erro
- Reverter release inteiro é trivial (`git revert {tag}`); reverter mudanças soltas commitadas em master é frágil

**Múltiplas branches simultâneas:**
- Trabalho mais longo (>1 sessão) → fica na branch entre sessões, retoma depois
- Trabalhos não-relacionados → branches separadas
- `git branch` lista; agente reporta no início de cada sessão se há branches pendentes

**Convenção nome de branch:**

```
feature/{tema}              # nova feature
fix/{tema}                  # bug fix grande
refactor/{tema}             # refactor não-trivial
security/{tema}             # mudança de segurança
docs/{tema}                 # só docs
```

Ex.: `feature/estoque-medicacao`, `fix/encoding-utf8-pacientes`, `security/admin-edge-functions`.

- Pre-commit hooks ainda não configurados (item #024 do ROADMAP). Por enquanto, gates manuais antes de commit.

---

## 🧪 Como testar mudanças (guia para usuário não-dev)

> **Regra ouro:** sempre que o agente mudar algo, ele DEVE dizer 3 coisas:
> 1. **Onde estou agora** (qual branch, qual versão master segue rodando em produção)
> 2. **Onde você testa essa mudança** (comando exato, URL específica)
> 3. **Como sair dessa fase de teste** (mergear pra master? descartar branch?)

### Ambientes de teste

| Ambiente | URL / Como acessar | Reflete | Quando usar |
|---|---|---|---|
| **Local web (dev server)** | `npm run dev` → http://localhost:5173 | seu working tree (mudanças não-commitadas inclusas) | iteração rápida, qualquer mudança web |
| **Local Android emulator** | `npm run build:android` → Android Studio Run | seu working tree empacotado | mudanças em plugin nativo, alarme, push, biometria |
| **Local Android device físico** | mesmo + USB cable + USB debugging on | seu working tree empacotado | validação final mobile (FASE 17) |
| **Vercel preview** | URL única gerada pelo Vercel para cada PR | branch da feature (não master) | demonstrar feature web pra você antes de mergear |
| **Vercel produção** | https://dosy-teal.vercel.app | master | validação final produção web |
| **Play Store Internal Testing** | URL opt-in: `https://play.google.com/apps/internaltest/4700769831647466031` | último AAB submetido (pode estar atrás de master) | validação real Android |

### Decisão "onde testar" por tipo de mudança

| Mudança | Teste mínimo |
|---|---|
| Edge Function (Supabase server-side) | Local web (chamar function via UI) OU `curl` direto pra endpoint |
| Migration DB | Local web + verificar dados via Supabase Studio (cloud) |
| UI web apenas | Local web → http://localhost:5173 |
| UI compartilhada web+Android | Local web PRIMEIRO + Android emulator se afeta layout mobile |
| Plugin nativo Android (alarme, biometria, push, secure storage) | Android emulator + device físico |
| Mudança que afeta build (gradle, capacitor.config) | Build full `npm run build:android` + Android Studio |
| Mudança em config Supabase (config.toml, RLS) | Aplicar em cloud + testar via local web |

### Fluxo de teste passo-a-passo (para você, não-dev)

**Cenário: agente fez mudança em branch `feature/estoque` e pediu pra você testar.**

1. **Agente diz:** *"Branch `feature/estoque` pronta. Pra testar:"*

2. **Agente envia comandos exatos:**
   ```
   git checkout feature/estoque
   npm install                    # se mudou deps
   npm run dev
   ```

3. **Você abre:** http://localhost:5173

4. **Você loga:** `teste03@teste.com / 123456`

5. **Agente lista o que testar:**
   - "Vai em Pacientes → tap João → seção 'Estoque' nova deve aparecer"
   - "Adicione estoque com valor 5"
   - "Marque dose como tomada → estoque deve descer pra 4"
   - "Quando chegar em 2, deve aparecer alerta amarelo"

6. **Você testa cada passo** e reporta de volta:
   - "Funcionou tudo" → agente prossegue pra merge
   - "Passo 3 não funcionou" → agente investiga, ajusta

7. **Após aprovação sua:** agente merge pra master:
   ```
   git checkout master
   git merge feature/estoque
   git push
   ```

8. **Vercel auto-deploya** em ~2 minutos. Agente confirma:
   *"Mergeado. Vercel deploy iniciou. Em ~2min https://dosy-teal.vercel.app reflete v{nova}. Refresh com Ctrl+F5 pra forçar."*

9. **Para Android (se aplicável):**
   - Mudanças em plugin nativo / alarme / build → exigem novo AAB
   - Agente avisa: *"Mudança afeta Android. Master tem v{nova} mas Play Store Internal ainda em v0.1.6.9. Quer fazer build novo AAB agora? Precisa Android Studio aberto + você seguindo passo a passo."*

### O que evitar

- ❌ Testar em produção (https://dosy-teal.vercel.app) o que **ainda não foi mergeado** — você vai testar versão antiga e achar que mudança "não funcionou"
- ❌ Confiar que "Play Store já tem versão nova" só porque mergeou pra master — Android exige build/upload manual (até CI Android estar configurado)
- ❌ Mexer em `master` direto sem testar (exceto fix trivial confirmado)
- ❌ Trabalhar em duas mudanças ao mesmo tempo na mesma branch — confunde diff e revert

### Mensagem padrão do agente quando inicia trabalho em branch

```
🌿 BRANCH NOVA: {tipo}/{tema}

**Onde você está:**
- Master continua em v{atual} — sempre = última release publicada
  - Vercel produção: https://dosy-teal.vercel.app (v{atual})
  - Play Store Internal Testing: AAB v{atual}
- Vou trabalhar em branch separada: {tipo}/{tema}
- Master NÃO será tocada até você pedir release.

**Onde testar (durante/depois do meu trabalho):**
- Local web: `npm run dev` → http://localhost:5173
- Vercel preview: URL única gerada após push da branch (vou te mandar)
- Android: só no fim, durante release (build AAB explícito)

**Como saímos:**
- Você aprova → quando pedir "publica" / "manda pro Play Store" → ciclo de release começa (8 passos)
- Se quiser descartar: `git branch -D {tipo}/{tema}` (master continua intocada)

**Não vou tocar master sem ciclo de release completo.**
```

### Worktrees git — não usar agora

Plano original mencionava worktrees pra paralelismo. **Não usar até time crescer.** Single-dev + agente = branches simples são suficientes. Worktrees podem voltar quando 2+ devs trabalharem em paralelo.

---

## 🚀 Publicar release (fim de sessão)

> Quando user pede "publica" / "manda pro Play Store" / "atualiza produção" / "finaliza e libera". Aqui master é sincronizado com Play Store + Vercel produção.

### Princípios

1. **Master = release.** A cada release: `master` recebe merge da branch + nova tag git.
2. **3 ambientes sincronizados:** master = Vercel produção = Play Store Internal AAB. Sem desvios.
3. **Bump de versão é parte do release**, não preparação separada.
4. **Cada release ganha tag git** (`v0.1.6.10`) pra rollback rápido.
5. **Próxima sessão = ciclo novo.** Mesmo chat. Nova branch. Novo bump no fim.

### Pre-checks (agente roda antes de iniciar release)

```bash
# 1. Branch atual NÃO é master (deve estar em feature/* ou similar)
git branch --show-current

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

#### Passo 3 — Build do AAB (Android)

Agente guia step-by-step (user não-dev):

1. *"Abra Android Studio com o projeto carregado"*
2. *"Menu **Build** → **Generate Signed Bundle / APK** → **Android App Bundle**"*
3. *"Selecione keystore: `dosy-release.keystore` (deve estar em `android/`)"*
4. *"Senhas vêm de `android/keystore.properties` — Android Studio puxa automático se config OK"*
5. *"Variant: **release**"*
6. *"Aguardar build (~2-3min)"*
7. *"AAB sai em: `android/app/release/app-release.aab`"*
8. *"Confirma tamanho (~17-20 MB esperado) e me avisa quando estiver pronto"*

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
git merge --no-ff feature/{tema} -m "release: vX.Y.Z"     # preserva história
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin master --tags
```

#### Passo 6 — Vercel produção sincroniza

Push pra master deve auto-trigger Vercel deploy (assumindo CI configurado em `vercel.json` + GitHub integration).

```bash
# Aguardar ~2 minutos
# Confirmar versão exibida em https://dosy-teal.vercel.app/ajustes (rodapé "Versão")
```

Agente avisa user: *"Aguarda ~2min e abre https://dosy-teal.vercel.app/ajustes (Ctrl+F5 pra forçar refresh). Versão deve mostrar vX.Y.Z. Me confirma?"*

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

#### Passo 8 — Limpar branch (opcional)

```bash
# Se feature/* não vai ser reutilizada
git branch -d feature/{tema}
git push origin --delete feature/{tema}
```

Agente pergunta se user quer deletar ou manter (pode ser útil pra hotfix rápido na mesma feature).

### Reporte final ao user

```
🚀 RELEASE vX.Y.Z PUBLICADA

**Estado dos 3 ambientes (sincronizados):**
- ✅ master @ commit {sha} · tag vX.Y.Z
- ✅ Vercel produção: https://dosy-teal.vercel.app (vX.Y.Z visível em Settings)
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
2. `git status` deve estar limpo + branch master sync
3. Cria nova branch `feature/{novo-tema}` ou `fix/{novo-tema}` conforme demanda
4. Trabalha em sessões — pode ser 1 sessão curta ou várias longas
5. Quando user pedir "publica" → ciclo §"Publicar release" recomeça com **novo bump** (ex.: vX.Y.Z+1)

**Não há "release contínuo" silencioso.** Cada release é evento explícito + atomic + tagueado + sincronizado em 3 ambientes.

### Edge cases

- **Mudança só docs (`contexto/`):** ainda exige bump? **Não.** Pode ir pra master direto via PR de docs ou mergeada na próxima release. Sem bump versão app.
- **Hotfix urgente em produção:** branch `hotfix/{tema}` saindo direto de master, ciclo encurtado (skip preview Vercel, build AAB direto). Bump patch sempre.
- **Mudança só web (sem AAB novo):** legítimo se não-mobile. Bump versão pode ser pulado. Reporta: *"Mudança só web. Quer bump versão pra registro ou mantém?"*. Master + Vercel produção atualizados; Play Store não.
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

## 📋 Estado atual do projeto (snapshot 2026-05-01)

**App:** Dosy — Controle de Medicação · pkg `com.dosyapp.dosy`
**Versão:** `0.1.6.9` @ commit `5bb9d36` · branch `master`
**Vercel:** `https://dosy-teal.vercel.app/` (alinhado com código)
**Conta teste:** `teste03@teste.com / 123456`
**Play Store:** Internal Testing **ativo** (Closed Testing bloqueado por #004 vídeo FGS + #006 device validation)

**Veredito da última auditoria:** ⚠️ **PRONTO COM RESSALVAS** · Score 7.0/10 médio em 25 dimensões.

**Bloqueadores P0 ativos:** 9 itens (~3-5 dias-pessoa). Ver `ROADMAP.md` §6.

**Próximo passo concreto:** [`CHECKLIST.md` §#001](CHECKLIST.md#001--adicionar-auth-check-de-admin-em-send-test-push-edge-function) — adicionar admin auth check em `send-test-push` Edge Function (30 min).

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
