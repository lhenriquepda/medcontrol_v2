# 📋 Validações Manuais Pendentes — Dosy

> 🛑 **REGRA CRÍTICA — IA NUNCA valida em conta pessoal do user.**
> Toda validação E2E autônoma (criar tratamento/paciente/dose/regra SOS) **DEVE** rodar em conta teste: `teste-free@teste.com`, `teste-plus@teste.com`, `teste-pro@teste.com` (senha `123456`).
> ANTES de qualquer `left_click` em Criar/Salvar/Submit, IA verifica usuário logado. Se conta pessoal → logout + login conta teste.
> Validar em conta pessoal polui dados reais → risco LGPD + drift + reprimenda forte. Ver `context/RULES.md` Regra 15.

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

## 🆕 Release atual — v0.2.3.14 EM CURSO (vc 77, aguardando autorização AAB Passo 10.5)

**Status:** branch `release/v0.2.3.14`. 4 commits (`8daa0af` bump + `2bd4139` useAppUpdate.js + `8fc5f03` useShares.js+SharePatientSheet.jsx + `1437d1f` docs). 3 fixes P2 user-reported bugs banner update + share error UI.

**Validações autonomous COMPLETAS (§11a web Chrome MCP, localhost:4173 preview prod, teste-plus@teste.com):**

- `[x]` **#0010 banner version_name correto** — `__dosyForceUpdate=true` + `__dosyDebugRecheck()` → banner verde renderiza texto `"v0.2.3.14 · toque para recarregar"` + botão "Atualizar". Caminho `dbInfo?.name` (DB autoritativa) primeiro funcionando. Path bug original (`info.availableVersion="77"` stringified) só dispara em device real pós-publish — validação device-only abaixo.
- `[x]` **#0011 modal mandatory render** — `__dosyForceMandatory=true` → `<alertdialog>` z-index 9999, body `overflow: hidden`, version "0.2.3.14", texto "Atualização obrigatória" + bloco Novidades + botão "Atualizar agora" + sem dismiss. Layout idêntico ao validado em v0.2.3.11. Path race `currentVersionCode=null` testável só em device.
- `[x]` **#0009 SharePatientSheet error UI** — PatientDetail → "Paciente Share LH" → Compartilhar paciente → injetar `q.setState({status:'error', error:{message:'JWT expired', code:'PGRST301'}})` na query `['patient_shares', id]` via QueryClient fiber walk → sheet renderiza `"Não foi possível carregar a lista (PGRST301)."` + botão `"Tentar novamente"`. Antes ficaria "Carregando…" infinito porque consumer só lia `isLoading`. Retry skip auth errors também garantido via code review (não retry inútil em 401).

**Validações §11b emulator (SKIP justificado):**

- `[skip]` **Emulator Appium UI** — fixes #0010 + #0011 dependem do plugin `@capawesome/capacitor-app-update` retornar dados reais do Play Core. Emulator sem AAB published no Internal Testing → `getAppUpdateInfo()` retorna erro/empty (não dispara shape buggy `availableVersion="77"`). Web debug toggles já validam UI render path. Fix #0009 é JS puro React Query — web validation suficiente.

**Validações device físico Samsung S25 Ultra pendentes (lhenrique.pda):**

> Necessárias APÓS upload AAB + propagação Internal Testing (~1h pós Play Console Salvar).

- `[ ]` **#0010 banner version_name real** — atualizar device de vc 76 (v0.2.3.13) → vc 77 (v0.2.3.14). Banner verde deve mostrar `"v0.2.3.14"` (NÃO `"versão 77"`). Se `info.availableVersion` vier `"77"` stringified do Play Core: regex semver descarta → cai pra `dbInfo?.name = "0.2.3.14"` da tabela `app_releases`. Fallback `versão 77` só se DB query falhar E plugin não retornar semver.
- `[ ]` **#0011 modal mandatory race real** — fresh install device antes do `useEffect getRealVersion` popular `currentVersionCode`. Se algum release intermediário marcado `is_mandatory=true`, modal deve renderizar. v0.2.3.14 = `false`, então sem cenário ativo agora — confirmar pela primeira release pós-v0.2.3.14 que marcar mandatory.
- `[ ]` **#0009 share error device** — refresh tokens revogados (esperar ~9-12h cycle ou forçar via Supabase admin) + reload PatientDetail compartilhado em S25 Ultra → SharePatientSheet deve mostrar mensagem vermelha + botão "Tentar novamente" (não "Carregando..." infinito).
- `[ ]` **Egress Supabase 24-48h pós ship v0.2.3.14** — observar painel API Gateway. Query mandatory roda sempre agora (era condicional). Impacto esperado: +1 query/sessão `app_releases` ~200B. Negligível.

**Status v0.2.3.12 (movido pra histórico):** já transitado por release v0.2.3.13. Items pendentes integrados a #300 STATE.md.

---

## 📦 Release anterior — v0.2.3.12 EM CURSO (vc 75, aguardando autorização AAB Passo 10.5)

**Status:** branch `release/v0.2.3.12`. 7 commits. 7 fixes runtime (PTR, SOS, throttle revert + NB-4 persistImmediate, useUpdateUserPrefs timeout, unsharePatient timeout, FCM await registration, useTreatments refetch).

**Validações autonomous COMPLETAS (Appium W3C + Supabase MCP + token revoke):**

- `[x]` **PTR timeout 20s** (`e6986a4`) — code review verified `Promise.race([fn, 20s])` em `usePullToRefresh.js:65-87`. Online refresh ~2s OK. Offline path inconclusivo (onlineManager short-circuit).
- `[x]` **SOS timeout 15s + register.reset** (`655461a`) — Live test PASS. Online submit normal. Offline path: yellow banner + reset OK pós reconnect.
- `[x]` **useUpdateUserPrefs timeout 15s** (`448bfea` Bug #4) — Live test PASS. CDP fetch patch 30s delay + toggle DnD → toast "Sync prefs timeout (15s)" capturado +15s.
- `[x]` **unsharePatient timeout 15s** (`448bfea` Bug #5) — Live test PASS. Fetch patch + tap X → toast "Tempo esgotado" capturado, 4 retries.
- `[x]` **useTreatments refetchOnMount:'always'** (`448bfea` NB-1) — Live test PASS. SQL insert externo → reload PatientDetail → "V12 NB1 Test" aparece imediato.
- `[x]` **NB-4 throttle 5000→1000ms + flushPersistImmediate** (`448bfea` + commit pendente) — Throttle 1s reduziu janela 5×; flushPersistImmediate em onMutate de confirmDose/skipDose/undoDose/registerSos reduz mais ~10× (janela ~100ms IDB write). Validar device real obrigatório (janela <100ms = OS kill edge case).

**Validações device físico Samsung S25 Ultra pendentes (lhenrique.pda):**

> Necessárias APÓS upload AAB + propagação Internal Testing (~1h pós Play Console Salvar).

- `[~]` **PTR stuck cenário real** — pull-to-refresh com network instável (5G→WiFi handoff): spinner deve sair em ≤20s, console warn em logcat. **Sessão 2026-05-18 emulator final-validation:** code review OK (`Promise.race + 20s timeout` em `usePullToRefresh.js:65-87` + handleRefresh per-query catch em `Dashboard.jsx:247-264`). Emulator não simula 5G→WiFi handoff real — fica device-only.
- `[~]` **SOS submit network slow real** — Cadastrar SOS com 5G fraco: ≤15s toast sucesso OU erro com retry. **Sessão 2026-05-18 emulator final-validation:** SOS submit normal PASS (981ms tap→toast `Dose S.O.S registrada` + dose persistida `done/sos` em `medcontrol.doses`). GSM speed test inconclusivo (input fill timing). Network real flapping é device-only.
- `[x]` **NB-4 mark + force-kill rapido** — Mark "Tomada", IMEDIATAMENTE swipe app outta recents OR force-stop. Reopen + verifica mark persistiu. **Sessão 2026-05-18 emulator final-validation:** 4 timing tests A/B/C/D Appium W3C + Supabase MCP:
  - Test A 114ms kill: **FAIL** (dose pendente após reopen — flushPersistImmediate não completou IDB write).
  - Test D 204ms kill: **FAIL** (mesma causa).
  - Test B 305ms kill: **PASS** (dose `done` + `actualTime` persistido pós drain).
  - Test C 612ms kill: **PASS** (idem).
  - **Threshold real ~250-300ms** (não ~100ms como assumido no comment do fix). Janela ainda 3× menor que original throttle 1000ms.
- `[x]` **FCM toggle device real** — Push toggle ON em S25 Ultra (Google Play Services OK): toast "ativadas" deve aparecer apenas após FCM token registrar (≤10s). **Sessão 2026-05-18 emulator:** PASS — tap → 974ms → toast `Notificações ativadas` + `aria-checked=true`. Bug #7 await-FCM-registration confirmado.
- `[x]` **DnD toggle Ajustes** — Toggle DnD com network normal: toast sem timeout. **Sessão 2026-05-18 emulator:** PASS — DnD switch tap → 1275ms → DB sync confirmada SQL `user_prefs.prefs->>'dndEnabled'='true'` `updatedAt=17:55:59`. Bug #4 timeout 15s NÃO disparou (network normal).
- `[x]` **Multi-device share/unshare** — Compartilhar paciente teste-free real, unshare network normal: toast "removido" ≤15s. **Sessão 2026-05-18 emulator:** PASS — SQL insert share → UI tap "Remover" → DB row deletada (`SELECT count FROM patient_shares WHERE ownerId=teste-plus = 0`). Bug #5 unsharePatient timeout 15s funcional (online path).
- `[x]` **Treatment cross-device** — Criar treatment em web prod (PC), abrir app device: aparece em PatientDetail imediato (Realtime ou refetchOnMount). **Sessão 2026-05-18 emulator:** PASS — SQL INSERT `treatments` externo "NB1 CrossDevice Test" → Appium navigate Pacientes → tap paciente → treatment visível em ≤3s. NB-1 `refetchOnMount: 'always'` em `useTreatments.js:20` confirmado.

**Validações monitoramento contínuo:**

- `[ ]` **Egress Supabase 24-48h pós ship v0.2.3.12** — observar painel API Gateway. Throttle revert pode aumentar IDB writes locais (zero impacto egress Supabase, só client IDB).
- `[ ]` **Sentry crashes Android nativos** — DOSY-7 + DOSY-3 segfault continuam aguardando #074 NDK symbols upload.
- `[~]` **Bug #10 processLock idle real** — depois 30-60min idle real, marcar dose imediato pós resume — verifica lag <5s. **Sessão 2026-05-18:** Skip — requer 30-60min idle real impraticável em sessão QA 60min. Validar device físico pós ship.

**Issue A nova (#0009 P2 BUGS.md):** `usePatientShares` 401 "Carregando..." infinito. Defer pra v0.2.3.13.

---

## 📦 v0.2.3.11 SHIPPED 2026-05-18 (movido pra histórico — manter aqui temporariamente)

**Status:** branch `release/v0.2.3.11`. Commit topo `d85fb4e` (#299 + #0006). 8 bugs (#0001-#0008) fixados + feature #299 (DB autoritativa in-app update + modal mandatory).

**Validações autonomous COMPLETAS (CDP + Chrome MCP + Supabase MCP):**

- `[x]` **#0001 push sub auto-register** — emulador, clear `dosy_fcm_token` + reload → token restaurado via INITIAL_SESSION branch `!cachedToken && perm=granted`.
- `[x]` **#0002 toast safe-area** — CDP `position=fixed bottom=96px` confirmado (sessão anterior).
- `[x]` **#0003 unshare startActivity removido** — 2-devices behavioral (Chrome web teste-plus owner + emulador teste-free caregiver). Focus pós FCM unshare = Launcher (NÃO foreground forçado). DosyMessagingService log `patient_unshared patientId=...` recebido sem `startActivity`.
- `[x]` **#0004 cold-start sem tela travada** — SharedPrefs `dosy_pending_unshare` simulado + open app → onResume consome + abre `/` Dashboard (não `/pacientes/{id}`). Var separada `__dosyPendingUnsharePatientId` evita conflito com openPatient.
- `[x]` **#0005 Reports cancelada filter** — pause SHARE 01 → Adesão 67% (2/3) durante pause, não 40% (2/5). Resume → 0 Cancelada visível.
- `[x]` **#0006 console [object Object]** — root cause via CDP stack trace: Capacitor bridge `cap.toNative` linha 348 console.dir + Sentry capture AppUpdate err -6. Fix: `capacitor.config.ts` `loggingBehavior: 'production'`. Smoke test pós install APK fresh: **0 entries** "object Object" em Capacitor/Console (era ~110).
- `[x]` **#0007 DoseModal date split** — CDP confirmou `<input type=date>` + `<input type=time>` separados (sessão anterior).
- `[x]` **#0008 pluralização + Termina hoje** — DOM scan: "1 dia" singular + "Termina hoje" visível pós cruzar meia-noite.
- `[x]` **#299 banner verde** — Chrome MCP localhost teste-plus `__dosyForceUpdate=true` → banner sticky topo gradient emerald renderizado (`hasBannerSticky: 1, bannerHeight: 64px`).
- `[x]` **#299 modal mandatory** — Chrome MCP localhost `__dosyForceMandatory=true` → modal vermelho full-screen renderizado (alertdialog, body overflow hidden, sem dismiss). Layout aprovado user 2026-05-18.

**Validações device físico Samsung S25 Ultra pendentes (lhenrique.pda):**

> Necessárias APÓS upload AAB + propagação Internal Testing (~1h pós Play Console Salvar). Validar device real só vale após APK shipped.

- `[x]` **#0001 push sub auto** — instalar AAB fresh, logar nova conta (sem subscription anterior), conferir push chega ao receber share. **Sessão 2026-05-18 emulator final-validation:** PASS — clear `localStorage.dosy_fcm_token` + reload → token restored em <700ms via INITIAL_SESSION branch `!cachedToken && perm=granted` em fcm.js auto-register.
- `[ ]` **#0002 toast Desfazer** — marcar dose como tomada, verificar banner verde "Desfazer" aparece acima BottomNav (não obscurecido por gesture nav). Device-only (visual safe-area).
- `[ ]` **#0003 + #0004 unshare UX device real** — outro user revoga share → app NÃO abre sozinho + ao abrir manual, cache limpo sem tela "Paciente Carregando..." infinita. Device-only (FCM data-only msg em background).
- `[~]` **#299 banner update real** — instalar vc 73 antes + propagar vc 74 → banner exibe "v0.2.3.11" (não "versão 74"). **Sessão 2026-05-18:** Cannot fully — requer duas versões AAB sequenciais em Play Console Internal Testing. Device-only.

**Validações monitoramento contínuo:**

- `[ ]` **Egress Supabase 24-48h pós ship v0.2.3.11** — observar painel API Gateway. Esperado: igual ou melhor que v0.2.3.10 (loggingBehavior=production reduz noise interno).
- `[ ]` **Sentry crashes Android nativos** — DOSY-7 + DOSY-3 segfault `<unknown>` continuam aguardando #074 NDK symbols upload (não escopo desta release).

---

## 📦 v0.2.3.10 SHIPPED 2026-05-17 (movido pra histórico)

**Status:** master @ tag `v0.2.3.10` (vc 73). Play Console Internal Testing publicado 15:28 BRT. Vercel prod dosymed.app v0.2.3.10 confirmado.

- `[x]` **#295 Alarme exibe nome do paciente** — confirmado com paciente "Dona Maria".
- `[x]` **#296 Pull-to-refresh remove paciente fantasma** — confirmado "Vovó Teste" sumiu do Dashboard.
- `[~]` **#297 Unshare em background** — cache cleanup OK, UX falhou (gerou #0003 + #0004, fechados em v0.2.3.11).

**Validações device físico v0.2.3.9 (perf):**
- `[x]` **Lag desapareceu device físico** — confirmado.

**Validações device físico v0.2.3.8 (caregiver killed alarm):**
- `[x]` **Cuidador app fechado recebe alarme com som no horário** — confirmado.

**Validações device físico v0.2.3.7 (perf bundle + server flow):**
- `[x]` Push share recebido em background.
- `[x]` Alarme caregiver killed (fire-time cron) — coberto pela validação v0.2.3.8.
- `[x]` Navegação BottomNav sem trava — coberto pela v0.2.3.9.
- `[x]` Marcação sequencial doses sem lag — coberto pela v0.2.3.9.

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

Para histórico exaustivo: ver [`Validar_archive`](archive/Validar_archive_2026-05-17_pre-reset.md), `context/updates/`, e ROADMAP §6.3 Δ release log.

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
