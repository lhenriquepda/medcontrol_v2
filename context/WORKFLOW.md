# Dosy — Workflow de Trabalho (Passos 5b + 6-14)

> Carregado sob demanda após Passo 5 (STOP inicial) ou quando usuário der nova diretiva.
> Passos 0-5 (entrada) → `context/README.md`

---

## ⚡ PASSO 5b — Classificar trabalho proposto

Ativa **logo após o user dizer o que quer fazer**. IA não pergunta categoria ao user — analisa o pedido sozinha e propõe.

### 🛑 STOP imperativo

**Antes de QUALQUER ação além do mínimo para classificar, IA OBRIGATORIAMENTE:**

1. Lê o pedido do user
2. Se o pedido **JÁ É O TRABALHO** (ex: "analisa 10 commits", "lê arquivo X", "investiga bug Y") → o trabalho é a investigação. **Continua precisando classificar branch ANTES de começar.**
3. Reporta classificação + branch + bump (se release) + ESPERA OK

**Permitido para classificar (leitura mínima):**
- ✅ 1-3 linhas stack trace Sentry para identificar origem
- ✅ Olhar 1 arquivo específico que user mencionou
- ✅ `Glob` para confirmar escopo arquivos prováveis

**Proibido antes OK do user:**
- ❌ `git log -10` ou `git log` extenso para "analisar histórico"
- ❌ Read completo de ROADMAP, CHECKLIST, ou docs grandes
- ❌ Executar análises / scripts / tools
- ❌ Tocar / editar / criar arquivos
- ❌ Iniciar tasks de investigação que JÁ SÃO o trabalho pedido

> **Princípio:** se o pedido em si é "investigar/analisar/auditar X", o branch DEVE ser criado primeiro (geralmente `docs/<slug>` ou `chore/<slug>`), porque o output é commit em algum lugar.

---

### Pergunta única decisória

**O trabalho vai gerar AAB novo + subir Play Console?**

| Resposta | Branch | Bump versão app |
|---|---|---|
| **Sim** | `release/vX.Y.Z.W` | Sim — bumpar último dígito (vc + 1, versionName + 1) em `android/app/build.gradle` + `package.json` |
| **Não** | Outro tipo (tabela abaixo) | Não — app stays |

### Tipos de branch quando não-release

| Tipo | Quando | Exemplo |
|---|---|---|
| `docs/<slug>` | Atualização `context/`, ADRs, READMEs, comentários | `docs/reorganiza-context` |
| `chore/<slug>` | Config CI, husky hooks, settings, gitignore, deps lock | `chore/eslint-bump-rules` |
| `server/<slug>` | Edge Function / migration / RLS / cron Supabase (sem afetar binário app) | `server/fix-notify-doses-500` |
| `refactor/<slug>` | Reorganização código sem mudança de behavior runtime | `refactor/split-dashboard-card` |
| `experiment/<slug>` | POC descartável, não merge master | `experiment/memed-poc` |

> Se ambíguo: IA escolhe categoria mais próxima. User corrige se discordar.

---

### IA reporta antes criar branch

1. **Versões atuais** de `context/STATE.md` (Internal Testing + Closed Testing)
2. **Análise resumida:** "trabalho identificado vai mexer em {X} → tipo {Y} sugerido"
3. **Branch proposto** + bump versão (se release)
4. **ESPERA OK user.** User pode corrigir tipo, IA acata + re-propõe.

---

### ⚠️ Após user dar OK — sequência OBRIGATÓRIA antes trabalho real

**IA NÃO inicia trabalho até criar branch + confirmar.**
Não importa se user disse "segue", "ok", "vai", "prossegue":

```bash
# 1. Criar branch IMEDIATAMENTE (primeira ação após OK):
git checkout -b {tipo}/{nome}

# 2. Confirmar branch criado (verificação obrigatória):
git status   # deve mostrar "On branch {tipo}/{nome}"
```

**3. Se `release/v*`:** bump em `android/app/build.gradle` (`versionCode` + `versionName`) + `package.json` (`version`) + commit inicial:
```
chore: abre release/vX.Y.Z.W — bump vc N→N+1
```

**4. Outros tipos:** branch fica vazia, sem commit inicial.

**5. SOMENTE AGORA** iniciar trabalho real (análise, leitura ampla, edits, git log extenso, executar tools).

> **Drift detector:** se IA já começou trabalho antes confirmar `git status` em branch nova → drift. PARAR, criar branch, retomar.

---

## 🔧 PASSOS 6-14 — Fechamento (após codar)

### Tabela de aplicabilidade por tipo de branch

| Passo | release/hotfix | docs/chore/server/refactor | experiment |
|---|---|---|---|
| 6 npm build | ✅ se tocou JS | ⚠️ só se tocou JS | ⚠️ opcional |
| 7 preview Vercel | ✅ se web tocou | ❌ | ❌ |
| 8 commit | ✅ | ✅ | ✅ |
| 9 sync docs | ✅ todos 5 obrigatórios | ⚠️ STATE + ROADMAP §3 + relevantes | ❌ |
| 10 push | ✅ | ✅ | ✅ |
| 10.5 STOP AAB | ✅ obrigatório | ❌ | ❌ |
| 11 validação | ✅ web + emulator + device | ⚠️ web smoke se relevante | ❌ |
| 12 build AAB + Play Console | ✅ SÓ após §11 + OK 10.5 | ❌ | ❌ |
| 13 pós-release | ✅ tag + merge + Vercel | ⚠️ merge sem tag | ❌ não merge |
| 14 STOP final | ✅ | ✅ | ✅ |

> **`server/<slug>`:** substituir Passo 11 por `mcp__supabase__deploy_edge_function` ou `apply_migration` conforme escopo. Passo 13 sem tag versão app.

---

## Passo 6 — Auditoria pré-commit

- `npm run build` (verde obrigatório, sem warnings novos)
- Auditoria egress proativa (se mudou fetch/persist/realtime/cron) — tabela 4 colunas em `context/CHECKLIST.md §#item`:

  | Risco | Severidade | Mitigação | Decisão |
  |---|---|---|---|
  | Egress extra por X | Alto/Médio/Baixo | Cache/TTL/RPC | Aceitar/Rejeitar |

- Lint via husky pre-commit (gitleaks 0 leaks + eslint max-warnings 80)

---

## Passo 7 — Validação preview Vercel (se web tocou)

URL: `https://dosy-git-{branch}-lhenriquepdas-projects.vercel.app`

```
navigate(url, tabId)
read_network_requests → confirmar sem erros 4xx/5xx
screenshot → confirmar sem ErrorBoundary
```

Não confiar só em build verde local.

---

## Passo 8 — Commit

```bash
git status && git diff --stat   # sanity check antes de stagar
```

Stage files **específicos por nome** (NUNCA `git add -A`):
```bash
git add src/components/X.jsx src/hooks/useY.js
```

Commit via HEREDOC:
```bash
git commit -m "$(cat <<'EOF'
tipo(escopo): descrição curta

Detalhe do why se não-óbvio.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Pre-commit hook DEVE passar. NÃO usar `--no-verify`.

> **Múltiplos fixes em release:** commits individuais por fix lógico, sem STOP entre eles. IA prossegue aplicando fixes + validando autonomamente até completar todo escopo. STOP único em Passo 10.5.

---

## Passo 9 — Sync docs (5 arquivos OBRIGATÓRIO — sequência fixa)

Executar EM ORDEM, nenhum pulável em release:

1. **`context/STATE.md`** — preencher template (versão, versionCode, tag, branch, data, P0 top 3)
2. **`context/ROADMAP.md §3`** — "Onde paramos" + itens fechados nesta sessão + §6.2 counter + §6.3 Δ + §6.4-6.7 status
3. **`context/CHECKLIST.md §#XXX`** — status → ✅ + commit hash + data + auditoria egress se aplicável
4. **`context/PROJETO.md`** header — se versão bumpou
5. **`docs/play-store/whatsnew/whatsnew-pt-BR`** — texto Play Store ≤500 chars (pt-BR, coloquial, 1-2 destaques)

**Validação após sync:**
```bash
git diff --stat context/ docs/play-store/whatsnew/
```
Se algum dos 5 não apareceu no diff → NÃO prosseguir para Passo 10. Verificar e corrigir.

---

## Passo 10 — Push

```bash
git push origin release/v{X.Y.Z.W}
```

---

## ⚠️ Passo 10.5 — STOP único obrigatório antes Build AAB

**REGRA CRÍTICA — NUNCA fechar release sem autorização explícita do user.**

**Pré-requisitos antes do STOP:**
1. Todos os fixes do escopo aplicados + commits feitos + push origin branch
2. `context/Validar.md` entry criada no topo com TODOS os items da release
3. Validação autônoma rodada (web §11a + emulator §11b + Supabase MCP DB state)
4. `Validar.md` com `[x]` em cada item validado autonomamente
5. Items `[ ]` restantes = SOMENTE os que dependem de device físico real OU observação temporal pós-deploy

**Reportar ao user:**
1. **Fixes aplicados:** lista commits + items fechados nesta sessão
2. **Validar.md status:** N items `[x]` validados, M items `[ ]` pendentes (motivo cada um)
3. **Pendências device user:** o que sobrou para ele fazer manualmente após ship
4. **Pergunta explícita:** `"Posso gerar o AAB vX.Y.Z.W agora?"`

**ESPERAR resposta afirmativa explícita:** "sim, gera AAB" / "pode subir" / "ok ship" / "fecha release".

> 🛑 **"Continue" / "Segue" / "OK" sozinhos NÃO autorizam ship.**

---

## Passo 11 — Validação

> ⚠️ **Validação ANTES do Build AAB.** Ordem correta: validar → aprovar → buildar.

### 11a — Web via Chrome MCP (SEMPRE executar primeiro)

→ Ver `context/recipes/web-validation.md` para receita completa.

Após validação web: atualizar `context/Validar.md` com seção topo `## 🆕 Release vX.Y.Z — versionCode N` contendo SOMENTE os items não cobertos por §11a+§11b. Cada item tem 3 partes: **Como fazer**, **O que esperar**, **Se falhar**.

> 🛑 **Validar.md entry é OBRIGATÓRIO mesmo em release pequena.** Se TODOS os cenários foram cobertos autonomous, criar entry com nota `**Validação device:** TODOS cenários cobertos autonomous §11a+§11b — nada para user fazer.`

### 11b — Emulator autônomo via CLI (após §11a)

→ Ver `context/recipes/emulator-setup.md` para receita completa.

### 11c — Validação device manual (fallback — só quando §11a+§11b não cobrem)

Cenários device-only que IA NÃO consegue autonomous:
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` Samsung One UI 7 / Xiaomi MIUI
- StatusBar overlay em hardware real
- Biometric auth (sensor real)
- AdMob banner PROD ad units
- SecureStorage Android KeyStore hardware-backed
- Capacitor In-App Updates flexible flow Play Core
- Privacy screen FLAG_SECURE recents blur

---

## Passo 12 — Build + Upload Play Store

> ⚠️ **NUNCA buildar antes de validar.** Chegou aqui = §11a + §11b feitos + Validar.md atualizado + user deu OK no Passo 10.5.

**1. Build AAB:**
→ Ver `context/recipes/gradle-build.md`

**2. Atualizar release notes:**
```
docs/play-store/whatsnew/whatsnew-pt-BR
```

**3. Upload Play Console:**
→ Ver `context/recipes/play-console-upload.md`

### Passo 12.1 — `app_releases` INSERT (OBRIGATÓRIO após publicar)

Executar via `mcp__supabase__execute_sql` ANTES de fechar o passo:

```sql
INSERT INTO medcontrol.app_releases (version_code, version_name, is_mandatory, whatsnew)
VALUES ({VC}, '{X.Y.Z.W}', {true|false}, $$
{whatsnew_text}
$$)
ON CONFLICT (version_code) DO NOTHING;
```

**Decisão `is_mandatory`:**

| Cenário | `is_mandatory` | UX no device |
|---|---|---|
| Bug fixes regulares, features, melhorias | `false` (default) | Banner verde dismissable |
| Security fix crítico (token leak, RLS bypass) | `true` | Modal vermelho full-screen, sem dismiss |
| Breaking schema/API que clientes antigos quebram | `true` | Modal vermelho |
| Bug P0 que corrompe dados | `true` | Modal vermelho |

**Regra prática:** se app antigo continua funcionando OK → `false`. Se app antigo causa dano → `true`. Em dúvida → `false`.

**Se `is_mandatory = true`:** IA pergunta explicitamente ao user antes do INSERT. Aguarda "sim" literal. Sem aguardo → NÃO faz INSERT mandatory.

**Reverter emergência:**
```sql
UPDATE medcontrol.app_releases SET is_mandatory = false WHERE version_code = {VC};
```
Devices voltam ao banner verde em ≤30min sem reinstall.

---

## Passo 13 — Pós-release

1. Atualizar memory `feedback_*.md` se padrão novo emergiu nesta release
2. Criar `context/updates/YYYY-MM-DD-release-vX.Y.Z.md` (template em `context/updates/README.md`)
3. `git tag vX.Y.Z.W` + `git push origin vX.Y.Z.W`
4. Merge `release/v*` → `master` linear (não squash):
   ```bash
   git checkout master && git merge --no-ff release/vX.Y.Z.W
   git push origin master
   ```
5. Vercel deploy master: `npx vercel --prod --yes`
6. **RE-LER `context/README.md` inteiro** (refrescar fluxo padrão para próximas sessões)
7. Limpar TodoWrite

---

## Passo 14 — STOP final

Reportar + confirmar checklist:

```
Commit hash final: {hash}
Tag git criada: vX.Y.Z.W
Play Console: Internal Testing vc N publicado {data} BRT
Vercel prod: dosymed.app vX.Y.Z.W confirmado

Checklist fechamento:
[ ] context/STATE.md atualizado (versão + tag + data)
[ ] context/ROADMAP.md §3 atualizado
[ ] context/CHECKLIST.md item(ns) fechado(s)
[ ] docs/play-store/whatsnew/whatsnew-pt-BR atualizado
[ ] context/updates/YYYY-MM-DD-release-vX.Y.Z.W.md criado

Próximo P0 sugerido para próxima sessão: #XXX
```

**ESPERAR comando user. Não emendar próximo trabalho automático.**

> Quando user retornar com nova diretiva → ativar **Passo 5b** ANTES de qualquer ação.
