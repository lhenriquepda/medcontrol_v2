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
