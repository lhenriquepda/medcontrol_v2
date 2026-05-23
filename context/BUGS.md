# 🐛 BUGS — Lista de bugs

> **Esta é a fonte de verdade para bugs.** Toda IA recebendo o projeto DEVE varrer este arquivo no início da sessão (Passo 0 README) — alertar o user sobre bugs abertos antes de iniciar trabalho novo.
>
> **Numeração própria começando em #0001**, independente do ROADMAP (que cobre features, perf, refactor e roadmap de lançamento).
>
> **Como funciona:**
> - IA adiciona bug novo aqui assim que descoberto/reportado pelo user.
> - Severidade: `🔴 P0` bloqueador, `🟠 P1` alta, `🟡 P2` média, `🟢 P3` baixa, `🔵 P4` cosmético.
> - Cada bug tem: número, prioridade, descrição, causa-raiz se conhecida, plano de fix se proposto, status (`OPEN` / `IN_PROGRESS` / `FIXED v0.X.Y.Z`).
> - Quando fixado: marcar `FIXED v0.X.Y.Z` + commit hash + mover para Histórico no fim do arquivo.

---

## 🔴 P0 — Bloqueadores

Nenhum bug P0 aberto.

---

## 🟠 P1 — Alta prioridade

Nenhum bug P1 aberto.

---

## 🟡 P2 — Média prioridade

Nenhum bug P2 aberto.

---

## 🟢 P3 — Baixa prioridade

Nenhum bug P3 aberto.

---

## 🔵 P4 — Cosmético / UX

Nenhum bug P4 aberto.

---

## 📦 Histórico — Bugs SHIPPED (referência cronológica)

> Ordem cronológica reversa. Releases anteriores: ver `context/updates/` + ROADMAP §6.3 Δ release log.

### v0.2.6.4 (2026-05-23, vc 89 mandatory)

- **#0018** P0 — Regex `inferGroupFromName` muito ampla em medCategories.js — sufixo "alina" do antidepressivo capturava "anlodipina" (deveria ser anti_hipertensivo). Plus: `dipino` só matchava gender masculino, falhando em "anlodipina" gender feminino. Fix: reordenar precedência (anti_hipertensivo PRIMEIRO) + gender `(a|o)?` + `\b` boundary em pril/olol/prazol/zolam/azepam/terol/tropio. Heurísticas expandidas (antialergico, antitermico, anticoagulante). Roteiro P0.2.
- **#0019** P0 — 458 rows medications_catalog WHERE group_id='outro' AND cmed_class IS NULL = antibióticos invisíveis. Drogas como Tigeciclina, Linezolida, Cefazolina, Amoxicilina, Olmesartana, Anlodipino, Tiroxina ficavam em 'outro' em vez do grupo correto. Fix: migration `v0_2_6_4_p0_5_catalog_cleanup` com 17 UPDATE statements pattern-based em principio_ativo (96 rows movidas). Remanescentes 362 são legitimamente 'outro' (oncológicos/biológicos/anti-arrítmicos sem grupo na taxonomy 17). Roteiro P0.5.

### v0.2.6.3 (2026-05-23, vc 88 mandatory)

- **#0015** P0 — Histórico/Analytics ainda mostra "Outro" mesmo após fix DOSE_COLS+RPC em v0.2.6.2. Root cause: PersistQueryClientProvider IDB key `dosy-query-cache` com buster `v1` contém payloads serializados pré-fix (vc 84/85). TanStack hydrate carrega cache stale na 1ª abertura do novo APK. Fix: bump buster v1→v2 em main.jsx + mutationRegistry.js (commit `d38f356`). Pico egress global aceito 1×.
- **#0016** P0 — Autofill sempre sugere "Antidepressivo" mesmo trocando medName. Root cause: useEffect em TreatmentForm/SOS aplicava classifyResult somente quando form.group_id era NULL (early return). User digitava Escitalopram→antidepressivo, depois Amoxil → categoria stale. Plus: useClassifyMedication só rodava com `!form.group_id`. Fix: hook sempre roda; useEffect re-aplica em `[classifyResult, medName]`; distingue manual pick (autoFilledGroup=false) de autofill — LIMPA stale autofill quando classifyResult null.
- **#0017** P0 — RPC `classify_medication_robust` NÃO EXISTIA no DB (foi documentada v0.2.4.0 mas nunca criada). Hook caía sempre no fallback heurístico cliente com regex amplo (`/pram|alina/`). Falta cruzar nome digitado com BD CMED 30k real-time + dropdown não mostrava origem. Fix: migration `v0_2_6_3_classify_medication_robust_5tier` cria RPC 5-tier (DCB exact 1.0 / catalog exact 0.95 / catalog LIKE 0.85 / principio LIKE 0.75 / heurística sufixo 0.55 word-boundary-aware). MedNameInput exibe 3 badges: DCB ANVISA (azul) / CMED (verde) / SEU (laranja).

### v0.2.6.2 (2026-05-23, vc 87 mandatory)

- **#0012** P0 — Histórico/Analytics tudo em "Outro" mesmo com antibióticos categorizados no DB. Root cause duplo: (a) `DOSE_COLS_LIST` em `dosesService.js` SELECT PostgREST omitia `group_id, cmed_class` → cliente recebia undefined → fallback `d.group_id || 'outro'` agrupava tudo; (b) RPC `get_dashboard_payload` `jsonb_build_object` omitia mesmos campos. Fix duplo (commit `2bf8dad` + migration `v0_2_6_2_dashboard_payload_includes_group_id`). BD estava correto (47 doses antibiotico done Liam Sinot Clav + Rael Clavulin/Amoxi/Azitro). Bug pre-existente desde v0.2.4.0. ✅ Validado QA Android emulator Pixel8.
- **#0013** P0 — TreatmentForm crasha `Cannot access 'Se' before initialization` em build minificado prod. Root cause: `useClassifyMedication(form?.medName)` referenciava `form` ANTES de `const [form, setForm] = useState()` na linha 89. Vite dev hidden o TDZ; build minificado expõe. Fix: reorder useState antes de useClassifyMedication (commit `23213f9`). Bug pre-existente v0.2.5.0. ✅ Validado QA Android.
- **#0014** P0 — MedNameInput mobile UX quebrada (campo some, teclado por cima, sugestões somem ao scroll, "uma zona" segundo user). Root cause: dropdown inline em Capacitor WebView Android — teclado virtual reposiciona, scroll body desfocava input, click-outside captura tap em scrollbar interno. Fix estrutural: reescrito mobile-first em FULL-SCREEN sheet `position:fixed inset:0 z-index:1500` (P0.7 Roteiro_Alinhamento_Dosy_v2 anti-pattern P9.8). Detect mobile via `matchMedia('(max-width:768px)')` OR coarse pointer. Trigger é `<button aria-haspopup="dialog">`, tap abre sheet com header fixo (X close + search icon + input fontSize:16 anti-zoom Android) + lista flex-1 `overscroll-behavior:contain`. Lock body scroll, autoFocus delay 80ms. Desktop dropdown inline mantido inalterado. Commit `2bf8dad`.

### v0.2.3.14 (2026-05-19, vc 77)

- **#0009** P2 — `usePatientShares` query 401 JWT expiry mostrava "Carregando..." pra sempre. Fix `useShares.js`: retry handler skip auth errors (não retry 401/PGRST301). `SharePatientSheet.jsx`: error state explícito + botão "Tentar novamente" quando query em `status: 'error'`. Commit `8fc5f03`. ✅ Validado web Chrome MCP (inject `q.setState({status:'error'})` via fiber walk → sheet renderiza mensagem vermelha + retry).
- **#0010** P2 — Update banner mostrava `"versão 75"` em vez de `"0.2.3.12"`. Root cause: `useAppUpdate.js:153-156` preferia `info.availableVersion` (Play Core retorna stringified versionCode quando Play Store backend não popula versionName imediatamente pós-publish). Fix: inverter ordem — DB autoritativa primeiro, validar shape semver de `info.availableVersion` (`/\d+\.\d+/`), fallback `versão N` sem `v` prefix. Commit `2bd4139`. ✅ Validado web (`__dosyForceUpdate=true` → `"v0.2.3.14 · toque para recarregar"`).
- **#0011** P2 — Update banner verde em vez de modal mandatory quando release intermediária tem `is_mandatory=true`. Root cause race: `currentVersionCode=null` em primeiro check (useEffect getRealVersion ainda não populou) → mandatory check pulado. Fix: query upper-bound-only quando currentVc null (any release `<=availableVc` mandatory → conservatively treat as mandatory). Trade-off falso-positivo em fresh install antigo aceitável em healthcare. Commit `2bd4139`. ✅ Validado web (`__dosyForceMandatory=true` → modal vermelho z-index 9999, body overflow hidden, sem dismiss).

#### Recursos novos v0.2.3.14 (Empilhamento C — debugability)

- **Sentry breadcrumbs em `useAppUpdate`** — `fetchReleaseFromDb` emite info/warning/error levels. Permite confirmar root cause real de #0011 em prod (timing A vs race Play Core B).
- **Copy fallback sanitization** — banner fallback path renderiza `"versão 99 · toque para recarregar"` sem `v` prefix (evita `"vversão 99"`). Modal fallback path sem chip `"VERSÃO X DISPONÍVEL"` (evita `"VERSÃO versão 99 DISPONÍVEL"`). Default semver path inalterado.
- **Debug toggle `window.__dosyForceFallback`** — força copy fallback localmente sem precisar derrubar DB query. Padrão consistente com `__dosyForceUpdate`/`__dosyForceMandatory` de v0.2.3.11. Commits `077e796` + `c839d5f`.

### v0.2.3.11 (2026-05-18, vc 74)

- **#0001** P2 — Push subscription Android não registra automaticamente. Fix `useAuth` SIGNED_IN + INITIAL_SESSION: se `!cachedToken` e permissão Android `granted` → `subscribeFcm(15)` auto. Sem prompt surpresa. Commit `7e043ab`. ✅ Validado emulador (CDP clear `dosy_fcm_token` + reload → token restaurado via auto-subscribe path).
- **#0002** P2 — Banner "Desfazer" não aparecia no Samsung One UI device físico após marcar dose. Fix `useToast.jsx`: `bottom-24` → `calc(6rem + env(safe-area-inset-bottom, 0px))`. Garante toast acima BottomNav em gesture nav (safe-area ≈ 28-34px). Commit `7e043ab`. ✅ Validado emulador (CDP captureScreenshot `TOAST_FOUND pos=fixed bottom=96px`).
- **#0003** P2 — `DosyMessagingService.handlePatientUnshared` chamava `ctx.startActivity(intent)` forçando app abrir sozinho. Fix: REMOVE startActivity. `MainActivity.sWeakRef = WeakReference<MainActivity>` em onCreate. App vivo: `runOnUiThread → postJsEvent` direto. App morto: SharedPreferences `dosy_pending_unshare` consumido em `onResume → checkPendingUnshare`. Commits `7e043ab` + `1062e62`. ✅ Validado behavioral (Chrome web teste-plus unshare → emulador teste-free focus=Launcher pós FCM, cache cleanup silencioso).
- **#0004** P2 — Após unshare em background, app abria travado em "Paciente Carregando..." infinito. Fix: `postJsEvent` nova key `"unsharePatientId"` → window var separada `__dosyPendingUnsharePatientId` (não confunde com `__dosyPendingPatientId` do openPatient). App.jsx cold-start handler lê var separada → `onPatientUnshared` (cache cleanup), não `onOpenPatient` (navegação). Commits `7e043ab` + `1062e62`. ✅ Validado cold-start (SharedPrefs manualmente populado + open app → onResume consome + abre `/` Dashboard).
- **#0005** P2 — Status "Cancelada" em Reports persistia indevidamente após ciclo pause/resume. Fix `treatmentsService.resumeTreatment`: após RPC `update_treatment_schedule`, UPDATE doses cancelled→pending WHERE `scheduledAt > now()`. Reports: exclui cancelled do denominador de adherence + topMeds ignora cancelled. Commit `3d73a57`. ✅ Validado live (pausar SHARE 01 → Reports Adesão 67% (2/3) durante pause — não 40% (2/5) que seria sem fix → resume → 3 doses sem Cancelada).
- **#0006** P2 — Console logs `[object Object]` em logcat (Dashboard/Patients). Root cause identificado via CDP trace: (a) Capacitor bridge interno `cap.toNative` linha 348 chama `console.dir(call)` em TODA chamada nativa (~110 entries por reload); (b) Sentry vendor captura AppUpdate install error -6 (ERROR_INSTALL_NOT_ALLOWED, emulador-only) e re-emite event object → `toString → [object Object]`. **Não é código app** — `useAppUpdate.js` usa `e?.message` correto. Fix: `capacitor.config.ts` adiciona `android: { loggingBehavior: 'production' }` — silencia bridge tracing em debug builds também. Release builds já silenciam via BuildConfig.DEBUG=false. Commit deste fix (#299 sessão).
- **#0007** P3 — HORÁRIO no DoseModal modo "outro" exibia formato en-US (`05/15/2026 3:06PM`). Fix `DoseModal.jsx`: substitui `datetime-local` por `type="date"` + `type="time"` separados — mesmo fix #261 SOS.jsx v0.2.3.6. Commit `3d73a57`. ✅ Validado emulador (CDP query `<input type=date>` + `<input type=time>` campos distintos pt-BR DD/MM/YYYY + 24h).
- **#0008** P4 — TreatmentList exibia "1 dias" (plural) quando `durationDays === 1`. Fix `TreatmentList.jsx:446`: `t.durationDays === 1` → `Number(t.durationDays) === 1` (DB retorna string). Branch `Termina hoje` quando `diffDays === 0` já existente — validado visualmente após cruzar meia-noite durante teste. Commit `3d73a57`. ✅ Validado.

#### Recursos novos v0.2.3.11
- **#299** Tabela autoritativa `medcontrol.app_releases` substitui mapa hardcoded `VERSION_CODE_TO_NAME` + cadeia frágil `/version.json` Vercel. RLS `FOR SELECT USING (true)` (read-only public). IA atualiza no Passo 12 via INSERT idempotente (ON CONFLICT DO NOTHING). Cache localStorage `dosy_vname_<vcode>` evita queries repetidas. Banner verde dismissable default; coluna `is_mandatory BOOLEAN` força modal vermelho full-screen bloqueante (uso de modal só em security fixes / breaking schema). Migration `20260518000000_app_releases_v0_2_3_11.sql` aplicada. Hook `useAppUpdate.js` + componente `UpdateBanner.jsx` refatorados.

### v0.2.3.10 (2026-05-17, vc 73)
- **#295** P2 — "Sem paciente" no alarme — `listDoses` JOIN inline `patients(name)` + `useDashboardPayload` enrich client. Commit `efd4aa7`. ✅ Validado device físico (paciente "Dona Maria").
- **#296** P2 — Pull-to-refresh Dashboard não removia pacientes/doses fantasmas — invalidação ampla de namespaces. Commit `efd4aa7`. ✅ Validado device físico.
- **#297** P1 LGPD — Unshare patient deixava paciente fantasma no cuidador — Edge `patient-unshare-handler` v1 + DB trigger DELETE + Java handler. Commit `efd4aa7`. ⚠️ Cache cleanup funciona mas UX errada — gerou #0003 + #0004 abertos (fechados em v0.2.3.11).

### v0.2.3.8 (2026-05-17, vc 71)
- **#287** P0 — Killed caregiver alarm gap — Edge `dose-trigger-handler` v25 + `dose-fire-time-notifier` v7 enviam DATA-ONLY HIGH + Java `handleFireNowAlarm` dispara `AlarmService` imediato. Commit `981fab4`. ✅ Validado device físico.

### v0.2.3.7 (2026-05-17, vc 70)
- **#279** P1 — Edge FCM caregiver bypass Doze.
- **#280** P1 — Patient share PUSH notification.
- **#281** P1 — Fire-time alarm FCM cuidador app killed.
- **#282** P1 — Idempotência AlarmScheduler + WorkManager backup Samsung Doze.
- **#283** P1 — RPCs salvam userId=patient.userId (não auth.uid).

### v0.2.3.6 (2026-05-15, vc 69)
- **#253b** P2 — Email template wordmark texto (img→CSS).
- **#254b** P2 — Self-patient signup via user_metadata.
- **#255** P1 — Idle longo (>1h) → skeleton infinito.
- **#256b** P1 — SOS submit trava silencioso (window.confirm Capacitor).
- **#257b** P1 — `lockAcquireTimeout: 15s` em `supabase.js`.
- **#258b** P1 — Sharing Dashboard via `get_dashboard_payload` CTE.
- **#259** P2 — Status "Cancelada" persistia em Reports pós pause/resume (fix parcial — reaberto como #0005, fechado v0.2.3.11).
- **#260** P2 — Console errors `[object Object]` (fix parcial — reaberto como #0006, fechado v0.2.3.11).
- **#261** P3 — HORÁRIO SOS en-US format (fix parcial — reaberto como #0007, fechado v0.2.3.11).
- **#262** P3 — Ad banner posição (resolvido — Ad agora é overlay global no topo, sem conflito de header).
- **#263** P4 — "1 dia" / "Termina hoje" relativo (fix parcial — reaberto como #0008, fechado v0.2.3.11).
- **#264** P1 — Dose 1ª passada pulada em `create_treatment_with_doses`.
- **#265** P2 — Count exato total doses.
- **#266** P1 — PatientDetail não mostrava tratamento recém-criado.
- **#267** P1 — Dashboard skeleton em hour boundary.

### v0.2.3.2 (2026-05-14, vc 65)
- **#227** P1 — `alarm_audit_log` RLS root cause.
- **#228** P1 — `unsubscribeFcm` cross-device contamination.
- **#229** P1 — Snooze persist em reboot (`apply()` → `commit()` sync).
- **#230** P2 — Edge `dose-trigger-handler` BATCH_UPDATE multi-dose group hash.

### Releases anteriores
Ver `context/ROADMAP.md` §6.3 Δ release log para histórico completo (v0.2.1.x, v0.2.2.x, v0.2.3.0, v0.2.3.1).
