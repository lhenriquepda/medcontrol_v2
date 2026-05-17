# 📋 Validações Manuais Pendentes — Dosy

> 🛑 **REGRA CRÍTICA — IA NUNCA valida em conta pessoal do user.**
> Toda validação E2E autônoma (criar tratamento/paciente/dose/regra SOS) **DEVE** rodar em conta teste: `teste-free@teste.com`, `teste-plus@teste.com`, `teste-pro@teste.com` (senha `123456`).
> ANTES de qualquer `left_click` em Criar/Salvar/Submit, IA verifica usuário logado. Se conta pessoal → logout + login conta teste.
> Validar em conta pessoal polui dados reais → risco LGPD + drift + reprimenda forte. Ver README §4 Regra 15.

> **Checklist de validações que exigem ação sua** (device físico, observação visual em produção, conferência manual em painéis externos). A IA não consegue executar sozinha.
>
> **Política nova (2026-05-17):**
> - Cada release nova adiciona seção no **topo** com validações pendentes daquela versão.
> - Você executa cada item e marca `[x]` quando confirmar OK.
> - **Quando a próxima release for shipped, a IA migra automaticamente a seção anterior pra `📦 Histórico` no fim do arquivo.** Validar.md ativo mantém só a release atual + opcionalmente 1 anterior em transição.
> - Items `[~]` parcial ou `[ ]` pendente que NÃO foram cobertos pela release seguinte viram nota cruzada em [`BUGS.md`](BUGS.md).
> - Resultado: Validar.md ativo enxuto (5-10 itens por vez).
>
> **Convenções:**
> - `[ ]` = pendente · `[x]` = validado OK · `[~]` = parcial / observação anotada · `[skip]` = pulado (com motivo)
> - Cada validação tem 3 partes: **Como fazer**, **O que esperar**, **Se falhar**.

---

## 🆕 Release atual — v0.2.3.10 SHIPPED 2026-05-17

**Status:** master @ tag `v0.2.3.10` (vc 73). Play Console Internal Testing publicado 15:28 BRT. Vercel prod dosymed.app v0.2.3.10 confirmado.

**Validações device físico Samsung S25 Ultra (lhenrique.pda):**

- `[x]` **#295 Alarme exibe nome do paciente** — confirmado com paciente "Dona Maria" (alarme mostrou nome correto, não "Sem paciente").
- `[x]` **#296 Pull-to-refresh remove paciente fantasma** — confirmado "Vovó Teste" sumiu do Dashboard após puxar pra baixo (owner revogou share).
- `[~]` **#297 Unshare em background** — cache cleanup funcionou (paciente sumiu de Pacientes E Dashboard após clicar Dashboard e voltar), MAS UX falhou: app abriu sozinho + tela "Paciente Carregando..." travada. Bugs originados: [`BUGS.md` #0003 + #0004](BUGS.md).

**Validações device físico v0.2.3.9 (perf):**

- `[x]` **Lag desapareceu device físico** — confirmado uso normal lhenrique.pda S25 Ultra. App fluido.

**Validações device físico v0.2.3.8 (caregiver killed alarm):**

- `[x]` **Cuidador app fechado recebe alarme com som no horário** — confirmado (swipe-kill app + dose +3min → alarme tocou normal com tela grande Ciente/Adiar/Ignorar).

**Validações device físico v0.2.3.7 (perf bundle + server flow):**

- `[x]` **Push share recebido em background** — confirmado (após registrar push_subscription Android via toggle Ajustes).
- `[x]` **Alarme caregiver killed (fire-time cron)** — coberto pela validação v0.2.3.8 acima (mesma cadeia FCM).
- `[x]` **Navegação BottomNav sem trava** — coberto pela validação v0.2.3.9 perf acima.
- `[x]` **Marcação sequencial doses sem lag** — coberto pela validação v0.2.3.9 perf acima.

---

## 🟡 Pendências de monitoramento contínuo (observação passiva, não-bloqueador)

- `[ ]` **Egress Supabase 24-48h pós últimas releases (v0.2.3.7→v0.2.3.10)** — observar painel API Gateway: `rpc/get_dashboard_payload` count, FCM cron `dose-fire-time-notifier` empty ticks, total cuidador FCM data-only HIGH. Esperado: redução pós eliminar dual namespace cache (P4 v0.2.3.9) + payload mais leve (sem notification block pra owner/caregiver v0.2.3.8).
- `[ ]` **Sentry crashes Android nativos** — DOSY-7 e DOSY-3 segfault `<unknown>` aguardam #074 NDK symbols upload pra próximo release.

---

## 📦 Histórico

> Validações de releases anteriores (v0.2.1.x → v0.2.3.6) consolidadas. Arquivo completo pré-zeragem: [`Validar_archive_2026-05-17_pre-reset.md`](Validar_archive_2026-05-17_pre-reset.md) — 2434 linhas, referência cronológica.
>
> **Resumo de validações fechadas até v0.2.3.10:**
>
> - **v0.2.3.10** (3 device físico) — todas confirmadas hoje 2026-05-17 lhenrique.pda.
> - **v0.2.3.9** (perf bundle complete P1-P7) — lag desapareceu confirmado device físico.
> - **v0.2.3.8** (killed caregiver alarm) — alarme com som no cuidador app fechado confirmado.
> - **v0.2.3.7** (10 itens — perf F1+F3+F5+F6 + server flow #279/#280/#281 + idempotência #282 + RPC userId #283 + QA exaustivo 21/21) — coberto pelas validações posteriores.
> - **v0.2.3.6** (11 itens) — share Dashboard, dose passada, count exato, PatientDetail insertEntityIntoLists, Dashboard skeleton hour boundary, etc. Histórico em `Validar_archive_2026-05-17_pre-reset.md`.
> - **v0.2.3.0–v0.2.3.5** (~50 itens) — refactor scheduler unificado 3-cenários, plus #215 turnaround, #209 alarme/push, etc. Histórico arquivado.
> - **v0.2.2.x** (auditoria sistema alarmes + storm fixes) — todos resolvidos pelo refactor v0.2.3.x.
> - **v0.2.1.x** (mutation queue offline + idle skeleton + storm refresh token) — todos resolvidos.

Para histórico exaustivo: ver [`Validar_archive_2026-05-17_pre-reset.md`](Validar_archive_2026-05-17_pre-reset.md), `contexto/updates/`, e ROADMAP §6.3 Δ release log.

---

## 🛠️ Manual de validação autônoma (IA executa sem device físico)

> Mantido aqui para referência. Receita testada release v0.2.3.6. IA usa pra reproduzir bugs + validar fixes ANTES de pedir validação device pro user.

### Setup (1× por sessão Studio aberta)

**Pre-requisito Android Studio:** Settings → Tools → Device Mirroring →
- ✓ "Activate mirroring when a new physical device is connected"
- ✓ "Activate mirroring when the IDE launches an emulator"

Garante Studio "Running Devices" panel auto-pega emulator lançado via CLI.

### 1. Emulator com flags Studio (keyboard físico funciona via Mirror)

```bash
# Kill emulators velhos primeiro
powershell -c "Get-Process | Where-Object { \$_.ProcessName -match 'qemu|emulator|crashpad|netsimd' } | Stop-Process -Force"

# Lança com flags Studio (Win32_Process extraído)
$ANDROID_HOME/emulator/emulator.exe -netdelay none -netspeed full \
  -avd Pixel8_Test -qt-hide-window -grpc-use-token -idle-grpc-timeout 300
```

Wait boot:
```bash
until [ "$(adb -s emulator-5554 shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 5; done
```

### 2. Build + install APK debug

```bash
cd android
TEMP='C:\temp\gradle_tmp' TMP='C:\temp\gradle_tmp' \
  JAVA_HOME='/c/Program Files/Eclipse Adoptium/jdk-25.0.3.9-hotspot' \
  PATH="$JAVA_HOME/bin:$PATH" ./gradlew assembleDebug
adb -s emulator-5554 install -r -g android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. UI interaction via ADB + Appium

Para fluxos UI complexos: `scripts/qa_seq.mjs` + `scripts/flow_v4.mjs` (Appium WebDriverIO).

Para validações pontuais: `adb shell input tap X Y`, `adb shell input text "..."`, `uiautomator dump /sdcard/ui.xml`, `screencap -p /sdcard/x.png`.

### 4. SQL admin via Supabase MCP

`mcp__3f699930-ab4e-43b0-8c19-44c081f5eb40__execute_sql` para verificar audit log, push_subscriptions, doses state, etc.

### 5. Chrome MCP web localhost

`npm run dev` em background, `mcp__Claude_in_Chrome__navigate http://localhost:5173/`. Login conta teste, fluxo UI completo, console messages, network requests.
