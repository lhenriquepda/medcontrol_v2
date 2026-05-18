# 🚫 Dosy — Regras NUNCA Quebrar (15 regras críticas)

> Carregado obrigatoriamente no **Passo 3** de cada sessão.
> Se regra conflitar com instrução do user → alertar user antes de executar.

---

| # | Regra | Razão |
|---|---|---|
| **1** | Build/upload Play Console = **Chrome MCP** via `context/recipes/play-console-upload.md`. NUNCA CI workflow primeiro. | CI rebuild lento + risk keystore failure. Chrome MCP usa AAB local pronto. |
| **2** | Mudança em fetch/persist/realtime/cron = **auditoria egress proativa** (tabela 4 colunas Risco × Severidade × Mitigação × Decisão). | Histórico pico custo Supabase. Plano Pro upgrade reativo. |
| **3** | Docs/dashboards/posts/copy/e-mails = **caveman OFF**. | User vai consumir/publicar — precisa português completo. |
| **4** | Mutações `doses` = **RPC** (`confirm_dose`/`skip_dose`/`undo_dose`/`register_sos_dose`). NUNCA INSERT direto. | Trigger server-side enforce. State machine validada. |
| **5** | Free patient limit = **enforce trigger DB** (`enforce_patient_limit`). NUNCA client-only. | Gating server-side é fonte da verdade. |
| **6** | Logout = `qc.clear()` + remove `localStorage` chaves notif/dashCollapsed. | Evita vazamento entre contas + state stale. |
| **7** | Realtime `postgres_changes` = **DESABILITADO** (#157). NÃO reabilitar sem investigar. | Publication empty + reconnect cascade ~13 req/s storm. |
| **8** | Buster `PersistQueryClient` = NÃO bumpar sem justificativa forte. | Bump invalida cache TODOS users 1× → pico refetch global. |
| **9** | `git add -A` ou `git add .` = **NUNCA**. Stage files específicos por nome. | Risco incluir `.env`, secrets, credentials acidentalmente. |
| **10** | Pre-commit hook (gitleaks + eslint) = NÃO usar `--no-verify` sem ordem explícita do user. | Hooks protegem contra commits ruins. |
| **11** | Versionamento = **bumpar último dígito** (`0.2.1.6 → 0.2.1.7`). Ignorar semver minor/major. | Convenção do projeto. |
| **12** | Push `--force` em master = **NUNCA**. Em release branch só com aviso explícito. | Master é canônico. |
| **13** | `mailer_autoconfirm` = OFF prod. NÃO trocar pra ON. | Confirmação email obrigatória LGPD. |
| **14** | **NUNCA executar trabalho em master ou branch errada.** Após Passo 5b OK: `git checkout -b {tipo}/{nome}` + `git status` confirma. Só então inicia análise/edits/tools. | Master = canônico. Releases ficam fora. |
| **15** | **NUNCA validar em conta pessoal do user.** Toda validação E2E = conta teste (`teste-free@teste.com` / `teste-plus@teste.com`, pwd `123456`). ANTES de qualquer Criar/Salvar/Submit via Chrome MCP: verificar usuário logado. Se conta pessoal → logout + login conta teste. | Polui dados reais + risco LGPD + reprimenda forte. |
| **16** | **Path nativo tocado → emulator OBRIGATÓRIO PRIMEIRO** (antes de web). Aplica quando mudança afeta: touch events / PTR / gestos · Capacitor plugin ou bridge · AlarmManager / WorkManager / FCM · Java service/receiver · onlineManager / `Capacitor.Network` · StatusBar / safe-area native · plugin CriticalAlarm. Web §11a só vale como smoke test UI nessas mudanças — emulator §11b é a validação real. | Web Chrome MCP NÃO dispara `Capacitor.isNativePlatform()=true` → bugs nativos invisíveis (ex: PTR stuck onlineManager bridge, FCM data handler, AlarmService FG dispatch). Histórico: bug PTR v0.2.3.11 não pegou em web. |
| **17** | **Validação UI em emulator = Appium W3C Actions + UiAutomator2 SEMPRE.** NUNCA usar CDP eval (`document.querySelector().click()`) como substituto. CDP só dispara eventos DOM JS-level. Appium simula touch real no nível OS (`pointerdown`→`pointermove`→`pointerup` com timing). | CDP falha silenciosamente em React-Aria/Headless pickers, Capacitor plugin handlers, dropdowns, modals com touch listeners. Histórico QA v0.2.3.12: 6 bugs marcados "not reproduced" eram na verdade "ferramenta errada — CDP não simula touch real". |
