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

### #0001 — Push subscription Android não registra automaticamente

**Reportado:** 2026-05-17 lhenrique.pda Samsung S25 Ultra
**Status:** `OPEN`

**Descrição:** Conta `lhenrique.pda@gmail.com` nunca havia registrado push_subscription Android no DB. Quando teste-plus criou paciente e compartilhou, o Edge `patient-share-handler` dispatchava mas a query de subs `platform='android'` retornava vazia → nenhum push chegava no device. Só funcionou depois de o user ir em Ajustes → Notificações push → toggle OFF/ON manualmente, que disparou o `subscribeFcm` + `upsert_push_subscription`.

**Causa-raiz provável:** flow de registro de push subscription só roda quando o user passa pelo `PermissionsOnboarding` OU toggla manual em Ajustes. Se o user instalou o app antes desse onboarding existir, OU pulou o onboarding, OU permissão foi auto-revoked pelo Samsung, a conta fica sem push_subscription Android e a IA não detecta automaticamente.

**Plano de fix proposto:**
- No `useAuth` SIGNED_IN, verificar se existe push_subscription para esse `(userId, platform='android', deviceIdUuid)` no DB.
- Se não existir + permissão Android está granted, chamar `subscribeFcm(0)` automaticamente.
- Se permissão Android está denied, mostrar banner persistente no Dashboard "Habilitar notificações" com call-to-action que abre Ajustes do app.

---

### #0002 — Banner "Desfazer" não aparece no device físico após marcar dose

**Reportado:** 2026-05-17 lhenrique.pda Samsung S25 Ultra v0.2.3.7
**Status:** `OPEN`

**Descrição:** Ao marcar uma dose como tomada/pulada via `DoseModal` no device físico, o toast com botão "Desfazer" (que deveria ficar 5s visível) **não aparece**. No web e no emulador funciona normal.

**Causa-raiz provável:** código intacto (`DoseModal.jsx:72-86`, `Dashboard.jsx:542-555`, `useToast.jsx:33-62`). Hipóteses:
1. Toast com `position: fixed; bottom: 96px` obscurecido por BottomNav + safe-area do device físico Samsung One UI.
2. z-index 60 colide com algum outro overlay.
3. Patch optimistic dispara re-render que esconde o toast antes do botão renderizar.

**Plano de fix proposto:** subir dev server localhost + abrir no S25 Ultra via Chrome DevTools remoto + inspecionar DOM/CSS no momento da marcação. Confirmar hipótese 1 (safe-area) e ajustar `bottom` para `calc(env(safe-area-inset-bottom) + 96px + 8px)` OU subir z-index.

---

### #0003 — `handlePatientUnshared` força o app abrir sozinho via `startActivity`

**Reportado:** 2026-05-17 lhenrique.pda Samsung S25 Ultra v0.2.3.10
**Status:** `OPEN`

**Descrição:** Quando o cuidador está com app fechado e o owner revoga o compartilhamento via web, o app do cuidador **abre sozinho** na tela do paciente — comportamento intrusivo e errado. O esperado é cache cleanup silencioso em background.

**Causa-raiz:** `DosyMessagingService.handlePatientUnshared` em `android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/DosyMessagingService.java` chama `ctx.startActivity(intent)` direto para forçar a `MainActivity` processar o `unsharePatientId`. Isso acorda o app sem toque do usuário.

**Plano de fix proposto:**
- REMOVER `ctx.startActivity(intent)`.
- Salvar apenas em `SharedPreferences("dosy_pending_unshare")` (já existe fallback parcial).
- Quando app vivo, usar `LocalBroadcastManager.sendBroadcast(intent)` ou `BridgeWebView.evaluateJavascript` direto.
- `MainActivity.onCreate`: ler `SharedPreferences("dosy_pending_unshare")` ao iniciar + dispatch JS event.

---

### #0004 — Após unshare em background, app abre travado em "Paciente Carregando..."

**Reportado:** 2026-05-17 lhenrique.pda Samsung S25 Ultra v0.2.3.10
**Status:** `OPEN`

**Descrição:** Consequência do #0003. Quando o app é forçado a abrir pelo `startActivity` e propaga o `unsharePatientId` via `postJsEvent`, o JS App.jsx tenta navegar para `/pacientes/{id}` de um paciente que NÃO EXISTE mais → tela fica em "Paciente Carregando..." infinito. Solução manual atual: clicar Dashboard e voltar para Pacientes.

**Causa-raiz:** `MainActivity.postJsEvent("dosy:patientUnshared", "patientId", id)` em `MainActivity.java:170` usa a key `"patientId"` que mapeia para `__dosyPendingPatientId` no `postJsEvent`. O listener `dosy:openPatient` em `App.jsx` LÊ esse mesmo var no cold start e navega para `PatientDetail` que falha em carregar.

**Plano de fix proposto:**
- Em `MainActivity.postJsEvent`, criar varName separado para unshare (ex: `__dosyPendingUnsharePatientId`).
- Em App.jsx `dosy:patientUnshared` listener, ler o var separado.

> **#0003 + #0004 devem ser fixados juntos na mesma release (estão acoplados).**

---

### #0005 — Status "Cancelada" em Relatórios após ciclo pause/resume tratamento

**Reportado:** 2026-05-15 QA v0.2.3.6 (BUG #4 do relatório QA)
**Status:** `OPEN` — necessita reconfirmação na v0.2.3.10

**Descrição:** Após ciclo de pausa/resumo de tratamento, Relatórios mostra doses com status "Cancelada" indevidamente.

**Plano de fix proposto:** investigar fluxo de pause/resume + status persistente em doses. Ajustar `update_treatment_schedule` ou `recompute` para refletir status correto.

---

### #0006 — Console errors `[object Object]` silenciosos

**Reportado:** 2026-05-15 QA v0.2.3.6 (OBSERVAÇÃO #5)
**Status:** `OPEN` — necessita reconfirmação na v0.2.3.10

**Descrição:** Logs no console exibem `[object Object]` em vez de mensagem útil em alguns lugares (Dashboard/Patients).

**Plano de fix proposto:** caçar os `console.log/warn/error` que passam objetos diretos sem `err?.message || JSON.stringify(err)`.

---

## 🟢 P3 — Baixa prioridade

### #0007 — HORÁRIO no formulário SOS exibe formato en-US

**Reportado:** 2026-05-15 QA v0.2.3.6 (BUG #1)
**Status:** `OPEN` — necessita reconfirmação na v0.2.3.10

**Descrição:** No formulário SOS, o campo HORÁRIO mostra `05/15/2026 3:06PM` em vez de `15/05/2026 15:06`.

**Causa-raiz provável:** `datetime-local` herda locale do Android WebView Samsung.

**Plano de fix proposto:** split em `type="date"` + `type="time"` separados, como feito no `TreatmentForm` em v0.2.3.6.

---

## 🔵 P4 — Cosmético / UX

### #0008 — Tratamentos exibe "1 dias" quando tratamento termina hoje

**Reportado:** 2026-05-15 QA v0.2.3.6 (BUG #3)
**Status:** `OPEN` — necessita reconfirmação na v0.2.3.10

**Descrição:** Quando um tratamento termina no mesmo dia, a lista de Tratamentos mostra "1 dias" em vez de "Termina hoje".

**Plano de fix proposto:** ajustar lógica de relativização de data + pluralização em `TreatmentList`.

---

## 📦 Histórico — Bugs SHIPPED (referência cronológica)

> Ordem cronológica reversa. Releases anteriores: ver `contexto/updates/` + ROADMAP §6.3 Δ release log.

### v0.2.3.10 (2026-05-17, vc 73)
- **#295** P2 — "Sem paciente" no alarme — `listDoses` JOIN inline `patients(name)` + `useDashboardPayload` enrich client. Commit `efd4aa7`. ✅ Validado device físico (paciente "Dona Maria").
- **#296** P2 — Pull-to-refresh Dashboard não removia pacientes/doses fantasmas — invalidação ampla de namespaces. Commit `efd4aa7`. ✅ Validado device físico.
- **#297** P1 LGPD — Unshare patient deixava paciente fantasma no cuidador — Edge `patient-unshare-handler` v1 + DB trigger DELETE + Java handler. Commit `efd4aa7`. ⚠️ Cache cleanup funciona mas UX errada — gerou #0003 + #0004 abertos.

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
- **#259** P2 — Status "Cancelada" persistia em Reports pós pause/resume (fix parcial — reaberto como #0005 acima).
- **#260** P2 — Console errors `[object Object]` (fix parcial — reaberto como #0006 acima).
- **#261** P3 — HORÁRIO SOS en-US format (fix parcial — reaberto como #0007 acima).
- **#262** P3 — Ad banner posição (resolvido — Ad agora é overlay global no topo, sem conflito de header).
- **#263** P4 — "1 dia" / "Termina hoje" relativo (fix parcial — reaberto como #0008 acima).
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
Ver `contexto/ROADMAP.md` §6.3 Δ release log para histórico completo (v0.2.1.x, v0.2.2.x, v0.2.3.0, v0.2.3.1).
