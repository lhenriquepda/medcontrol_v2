# 03 — Checklist de Lançamento (consolidado e ordenado)

> Itens numerados sequencialmente, mesma numeração de `ROADMAP.md`. Cada um tem origem ([Plan.md] / [Auditoria] / [Plan.md + Auditoria]), esforço estimado, dependências e critério de aceitação.
>
> **Metodologia:** combina pendentes do `archive/plan-original.md` (linhas com `[ ]`, "Pendente", "Manual", "Backlog") + achados desta auditoria (25 dimensões). Ordenação: P0 → P1 → P2 → P3, considerando dependências técnicas.

---

## 🚧 Release v0.2.3.3 em curso

### #release-v0.2.3.3 — Fix #231 + cost escala #163+#164+#165 + #110 native crashes + Sentry triage
- **Status:** 🚧 branch `release/v0.2.3.3` aberta (commit `5487a30` bump vc 65→66). Esforço estimado 15-23h.
- **Escopo expandido:**
  - **#231 P2 BUG layout** — banner AdMob safe-area-inset duplicado Android 15 (detalhe abaixo)
  - **#163 P1 cost escala** — RPC consolidado `get_dashboard_payload` (4 queries → 1, esperado -40% a -60% Dashboard egress)
  - **#164 P1 cost escala** — Realtime broadcast em vez postgres_changes (retoma #157 disabled, esperado -80% a -90% Realtime egress + sync multi-device)
  - **#165 P1 cost escala** — Delta sync doses + TanStack persist IndexedDB offline-first (esperado -70% a -90% reads steady state)
  - **#110 P2 native crashes** — Sentry DOSY-3 REGRESSED + DOSY-7 (`art::ArtMethod::Invoke` IllegalInstruction + Segfault unknown — investigação)
  - **#232 P1 BUG ANR MainActivity.onCreate** (NOVO descoberto Sentry triage) — `WorkManager.enqueueUniquePeriodicWork` + `cleanupLegacyChannels` chamados sincronicamente em onCreate bloqueiam main thread. Fix: mover ambos pra background thread via Executor. ✅ DONE commit `b373675`.
  - **#233 P1 BUG 401 race tokens** (NOVO descoberto Supabase egress check) — 16 GETs `/rest/v1/patients` e `/rest/v1/doses` retornam 401 unauthorized em 60min. Tokens expirados em multi-device race. Investigar fonte: (a) JS supabase-js auto-refresh falha em background fetch; (b) Java DoseSyncWorker access_token SharedPref stale (relacionado #205 single source); (c) cuidador/share queries com user context errado. ~1-2h.
  - **#234 P2 OPTIMIZE Cache-Control egress** (NOVO descoberto Supabase egress check) — Cached egress = 0 GB em 9.21 GB total. Adicionar `Cache-Control: max-age=300, s-maxage=60` em GET responses estáveis (patients/treatments — não doses). Esperado -10% a -20% egress free. ~30min.
  - **#074/#110 P2 NDK symbols upload Sentry** — DOSY-3 + DOSY-7 native crashes mostram `<unknown>` frames. Setup `@sentry/wizard` ou Gradle plugin `io.sentry.android.gradle` autoUploadProGuardMapping + NDK debug symbols. Validar via test crash + Sentry symbolication. ~2-3h.
  - **Sentry triage** — ✅ DONE: 15 → 3 abertas (7 resolved, 5 archived, 3 keep open scope)
- **Detalhe #231 P2 BUG layout AdMob banner safe-area-inset duplicado Android 15:**
- **Root cause provável:** `env(safe-area-inset-top)` duplicado WebView Android 15 + plugin Capacitor AdMob ambos aplicando padding-top.
- **Plano investigação:**
  1. Identificar componente container do banner Ad em `src/` (provável `AdBanner` ou similar em layout principal)
  2. DevTools Chrome emulator-5554 (Pixel 8) — `chrome://inspect` + WebView `chrome://devtools`
  3. Inspecionar computed styles `padding-top` / `env(safe-area-inset-top)` no container Ad + body + #root
  4. Comparar com Pixel 9 Pro emulator-5556 mesma inspeção
  5. Identificar onde inset aplicado em duplicidade
- **Fix opções (escolher após investigação):**
  - (a) CSS override: `body { padding-top: 0 !important; }` quando banner Ad ativo (delegar inset só pro content abaixo)
  - (b) Detectar `Capacitor.getPlatform()==='android'` + `statusBarHeight` runtime + zerar via classe condicional
  - (c) `@capacitor-community/admob` config `position=TOP_CENTER` + `margin=0` explícito (se ainda não está)
- **Esforço:** 2-4h investigação + fix + validação 2 emulators + device físico.
- **Aceitação:**
  - ✅ Pixel 8 emulator-5554 Android 15 — banner colado imediatamente abaixo status bar (sem gap peach)
  - ✅ Pixel 9 Pro emulator-5556 Android 17 — banner continua correto (não regrediu)
  - ✅ Device físico real (user testa) — banner correto
  - ✅ Screenshot before/after Pixel 8 anexado no CHECKLIST/Validar.md
- **Arquivos prováveis:** `src/components/AdBanner*.{jsx,tsx,jsx,js,css}` OR `src/layouts/*` OR `index.css` (`env(safe-area-inset-top)` usage), `capacitor.config.ts` ou `.json` (AdMob plugin config).
- **Backend:** zero impacto (mudança CSS/JS frontend only).

---

## ✅ Release v0.2.3.2 SHIPPED 2026-05-14

### #release-v0.2.3.2 — Bug-fixes #227-#230 + CLI gradlew destravado
- **Status:** ✅ SHIPPED Play Console Internal Testing 14:46 BRT 2026-05-14. Master `c0cb372` pushed → Vercel auto-deploy. Tag `v0.2.3.2` em `e277aa6`.
- **Bump:** vc 64→65 + versionName 0.2.3.1→0.2.3.2
- **Bugs fechados (4):**
  - **#227 P1** RLS audit log root cause múltiplo: `alarm_audit_config` sem policy SELECT pra authenticated + `alarm_audit_log` sem SELECT own. **2 migrations:** `alarm_audit_config_user_select_policy_v0_2_3_2` + `audit_log_policies_final_v0_2_3_2`. Validado SQL `SELECT DISTINCT source FROM alarm_audit_log` retorna 6 sources.
  - **#228 P1** `unsubscribeFcm` cross-device contamination → fix `src/services/notifications/fcm.js` filtra delete por `device_id_uuid` (fallback legacy null).
  - **#229 P1** snooze persist async race em reboot → fix `AlarmScheduler.java` 5 callsites `apply()` → `commit()` sync (persistAlarm + saveTrayEntries + persistTrayEntry + removePersistedTrayEntry + removePersisted). Runtime validado audit chain.
  - **#230 P2** Edge `dose-trigger-handler` v21 ACTIVE: BATCH agrupa por (ownerId, patientId, minute_bucket) + query group siblings + envia CSV completo. Java reconstroi hash `sortedDoseIds.join('|')`.
- **CLI gradlew destravado (bonus técnico):**
  - **Root cause definitivo:** filter driver bloqueia AF_UNIX em `C:\Users\<user>\AppData\Local\Temp`. JDK NIO `PipeImpl.LoopbackConnector` (init Selector) usa AF_UNIX nesse temp → `connect0` retorna "Invalid argument".
  - **Não é Kaspersky** (pausa total não resolve), **não é JDK** (testado 21+23+25 mesmo erro), **não é Winsock** (reset não resolve).
  - Diagnóstico binário: bind+connect AF_UNIX OK em `C:\temp`, FAIL em `AppData\Local\Temp` (mesmo código + mesmo JDK).
  - **Fix:** `TEMP/TMP` redirect → `C:\temp\gradle_tmp` antes `./gradlew`. JDK 25 Adoptium Temurin 25.0.3.9 (winget).
  - Comando final: `TEMP='C:\temp\gradle_tmp' TMP='C:\temp\gradle_tmp' JAVA_HOME='/c/Program Files/Eclipse Adoptium/jdk-25.0.3.9-hotspot' PATH="$JAVA_HOME/bin:$PATH" ./gradlew bundleRelease`
  - **AAB CLI 33s autônomo** (substitui Studio GUI manual em todo flow futuro).
- **Validar.md:** 62 [x] / 0 pending — TODOS FLUXOs v0.2.3.1 + legacy fechados antes bugs serem descobertos.
- **Backend deployed:**
  - Edge `dose-trigger-handler` v21 ACTIVE
  - Migrations `alarm_audit_config_user_select_policy_v0_2_3_2` + `audit_log_policies_final_v0_2_3_2`
- **Commits (cronológico):**
  - `1802853` fix(v0.2.3.2): bug-fixes #227 #228 #229 #230 device validação
  - `a1ea4cd` docs(v0.2.3.2): valida Validar.md 100% (62 [x] / 0 pending)
  - `2d460b4` docs(v0.2.3.2): atualiza ROADMAP §3 + §6.2 counter + §6.3 Δ release log
  - `e0fde9d` build(v0.2.3.2): CLI gradlew destravado + release notes + AAB Play Console
  - `c0cb372` Merge release/v0.2.3.0 → master
- **Docs atualizados:**
  - `contexto/ROADMAP.md` §3 onde paramos (master) + §6.3 Δ release log entry expandido
  - `contexto/Validar.md` topo SHIPPED status
  - `contexto/CHECKLIST.md` (esta entrada)
  - `contexto/README.md` §11 fluxo CLI documentado
  - `android/gradle.properties` header CLI workaround
  - `docs/play-store/whatsnew/whatsnew-pt-BR` release notes pt-br user-facing
- **Counter:** 142+4 = 146 fechados / 78 abertos

---

## 🚧 Refactor v0.2.3.1 (mergeado em v0.2.3.2)

### #refactor-v0.2.3.1 — Plano A + Fixes B/C alarme/push (consolidação 4 auditorias)
- **Status:** ✅ Mergeado v0.2.3.2 SHIPPED. AAB vc 65 Play Console Internal Testing.
- **Origem:** 4 auditorias linha-por-linha 2026-05-13 revelando 4 root causes arquiteturais não cobertos por #215-#226 v0.2.3.0
- **Esforço:** ~10h dedicadas (4 auditorias + 7 blocos implementação)
- **Branch:** `release/v0.2.3.0` (renomeada logicamente v0.2.3.1)
- **Commits (cronológico):**
  - `0ef1eac` Bloco 1 — Cleanup código morto (23 itens: 2 Edge stubs + DB orphan + 6 JS exports + 2 Java methods + 4 imports + 5 comentários estale + canal `doses_v2` loop fix)
  - `f8596c7` Bloco 2 — Fix B-01 (AlarmReceiver cancela PendingIntent tray pendente AlarmManager, não só notif visível) + A-03 (snooze persist via `AlarmScheduler.persistSnoozedAlarm`)
  - `88d7f17` Bloco 3 — **Plano A** unifica tray em Java M2 (`CriticalAlarm.scheduleTrayGroup` + `cancelTrayGroup` + `cancelAllTrays` substituem `LocalNotifications.schedule` foreground path; BootReceiver re-agenda trays persistidas em novo namespace `dosy_tray_scheduled` SharedPrefs). Elimina RC-1 + RC-4
  - `c8554c3` Bloco 4 — **Fix B** AlarmReceiver consulta SharedPrefs `dosy_user_prefs` antes de fire → re-rota dinâmica se prefs mudaram entre agendamento e fire (RC-2)
  - `0bb8070` Bloco 5 — **Fix C** + A-02: trigger statement-level batch UPDATE/DELETE (1 fire vs N row-level) + `cancelFutureDoses` UPDATE status='cancelled' (não DELETE) + `DosyMessagingService.handleCancelAlarms` reconstroi `sortedDoseIds.join('|')` hash multi-dose group + Edge dose-trigger-handler v20 deployed BATCH_UPDATE/BATCH_DELETE handlers + migration `add_cancelled_status_to_doses` (constraint expand)
  - `5ab1af6` Bloco 6 — A-05 consolida SharedPrefs (1 namespace `dosy_user_prefs`, remove duplicação `dosy_sync_credentials.critical_alarm_enabled`) + A-01 doc recomputeOverdue
  - `0cfef80` Bloco 7 — A-04 janela useDoses unificada -30d/+60d (App.jsx + Dashboard compartilham cache TanStack) + B-02 DailySummary 1 query unificada + docs novos `docs/alarm-scheduling-v0.2.3.1.md`
  - `ba346ce` Bump v0.2.3.1 (package.json + android/app/build.gradle vc 63→64, vn 0.2.3.0→0.2.3.1)
- **Backend deployed via MCP:**
  - Edge `dose-trigger-handler` v20 ACTIVE (BATCH_UPDATE/BATCH_DELETE handlers — agrupa old_rows por (ownerId,patientId), envia 1 FCM por device com CSV completo)
  - Migration `20260514000000_cleanup_orphan_dose_notifications_v0_2_3_1` (DROP `dose_notifications` 150 rows órfãs + UNSCHEDULE notify-doses-1min + schedule-alarms-fcm-6h idempotente)
  - Migration `20260514001000_dose_change_batch_trigger_v0_2_3_1` (trigger statement-level batch substitui FOR EACH ROW pra UPDATE/DELETE; INSERT continua per-row)
  - Migration `20260514001500_add_cancelled_status_to_doses_v0_2_3_1` (CHECK constraint aceita 'cancelled')
- **Root causes resolvidos:**
  - **RC-1** dual tray race — Plano A unifica em Java M2. Antes: foreground path usava Capacitor LocalNotifications M3 + FCM path usava Java TrayNotificationReceiver M2 coexistindo no mesmo `groupId+BACKUP_OFFSET` PendingIntent slot mas Components diferentes → 2 PendingIntents pendentes AlarmManager → 2 fires
  - **RC-2** prefs fire time — Fix B AlarmReceiver consulta SharedPrefs antes de startForegroundService. Branch dinâmico (alarm vs tray vs DnD-tray) re-decidido se prefs mudaram entre agendamento e fire
  - **RC-3** cancel group hash multi-dose — Fix C reconstroi hash `sortedDoseIds.join('|')` ao receber CSV cancel_alarms FCM. Antes single-dose hashes não cobriam multi-dose group
  - **RC-4** 5 paths sem coordenação — Plano A converge tudo em PendingIntent única AlarmManager. Idempotência via mesmo `groupId` agora funciona cross-source
- **Achados A-XX + B-XX consolidados:**
  - A-01 doc recomputeOverdue side-effect (dosesSignature flippa quando dose passa horário → scheduleDoses storm-protected via throttle 30s)
  - A-02 cancelFutureDoses UPDATE batch (não DELETE 360 trigger fires)
  - A-03 snooze persist via SharedPreferences pra sobreviver reboot
  - A-04 janela useDoses unificada -30d/+60d App+Dashboard (cache compartilhado)
  - A-05 1 namespace SharedPrefs `dosy_user_prefs` (remove legacy `dosy_sync_credentials.critical_alarm_enabled`)
  - B-01 AlarmReceiver cancela tray PendingIntent (não só notif visível NotificationManagerCompat.cancel)
  - B-02 DailySummary 1 query unificada (não 2 com status filter separados)
  - B-03 cosmético `android:showOnLockScreen` atributo inválido manifest (skip)
- **Cleanup 23 itens código morto removidos:** Edge functions `notify-doses` + `schedule-alarms-fcm` (deletadas repo, deploys 410 Gone stubs continuam até `supabase functions delete` manual), JS exports órfãos (`scheduleCriticalAlarm`, `cancelGroup`, `loadScheduledState`, `logAuditEvent`, `isIgnoringBatteryOptimizations`, `updateAccessToken`, `setCriticalAlarmEnabled`), re-exports notifications/index.js, CHANNEL_ID='doses_v2' constant + branch channels.js, 4 imports não usados AlarmScheduler.java, 5 comentários estale, Java methods `CriticalAlarmPlugin.schedule` + `updateAccessToken` + `setCriticalAlarmEnabled`, AlarmActionReceiver.NOTIF_ID_OFFSET morto, EVENTS analytics órfãs (ALARM_FIRED, ALARM_DISMISSED, ALARM_SNOOZED, NOTIFICATION_DISMISSED, DOSE_OVERDUE_DISMISSED)
- **AlarmReceiver fallback canal renomeado:** `doses_critical_v2` → `dosy_alarm_fallback` (antes MainActivity.cleanupLegacyChannels deletava cada boot → AlarmReceiver.ensureChannel recriava = loop)
- **Docs atualizados:**
  - `docs/alarm-scheduling-v0.2.3.1.md` NOVO (fluxos end-to-end completos + arquivos críticos + validação cenários)
  - `docs/archive/alarm-scheduling-shadows-pre-v0.2.3.1.md` (obsoleto arquivado)
  - `contexto/Validar.md` substituído cenários granulares 230.1.1-230.5.2 por 5 FLUXOS LONGOS A-E + audit (cada fluxo executa várias ações em sequência cobrindo múltiplos cenários)
- **Aceitação device (Validar.md FLUXO-A a FLUXO-E + audit):**
  - FLUXO-A: 3 branches alarm/tray/DnD-tray + B-01 cancel race + Fix B re-rota
  - FLUXO-B: snooze 10min + reboot 5min depois → alarme horário snoozed
  - FLUXO-C: pause tratamento 90d → 1 FCM batch (não 360) + multi-dose group cancela corretamente + caregiver compartilhado respeita DnD próprio
  - FLUXO-D: reboot re-agenda alarmes + trays + WorkManager 6h + cron 5am
  - FLUXO-E: logout deleta push_subscription + Device A para de receber FCM
  - audit: alarm_audit_log popula 5 sources após FLUXOS A-E
- **Detalhe completo:** [`contexto/auditoria/2026-05-13-alarme-push-FINAL-fluxo-e-refactor.md`](auditoria/2026-05-13-alarme-push-FINAL-fluxo-e-refactor.md) (consolidado das 4 auditorias + plano 7 blocos)

---

## 🔴 P0 — Bloqueadores de Produção

### #001 — Adicionar auth check de admin em `send-test-push` Edge Function
- **Status:** ✅ Concluído @ commit 37c8fee (2026-05-01)
- **Origem:** [Auditoria] (BUG-002)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Severidade:** Crítica — qualquer authenticated user pode invocar; usa service_role
- **Snippet:**
  ```ts
  // supabase/functions/send-test-push/index.ts
  Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('POST only', { status: 405 })
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    }
    const jwt = authHeader.slice(7)
    const { data: { user }, error } = await supabase.auth.getUser(jwt)
    if (error || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!admin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    // ... resto da função
  })
  ```
- **Aceitação:** chamada sem JWT → 401. Chamada com JWT non-admin → 403. Chamada admin → push enviado. Email não-existente → resposta neutra `{ ok: true, sent: 0 }` (sem 404).
- **Detalhe:** [auditoria/04-supabase.md §7.2](auditoria/04-supabase.md#72-send-test-pushindexts-120-linhas--crítico) · [auditoria/06-bugs.md#bug-002](auditoria/06-bugs.md#bug-002--edge-function-send-test-push-não-valida-autorização-auditoria-estática)

### #002 — Sanitizar erro de email enumeration em `send-test-push`
- **Status:** ✅ Concluído @ commit 37c8fee (2026-05-01)
- **Origem:** [Auditoria] (BUG-015)
- **Esforço:** 5 min (parte do #001)
- **Dependências:** #001
- **Aceitação:** retornar `{ ok: true, sent: 0 }` em todos os fluxos (email não-existente, sem tokens, etc), nunca expor existência de email no response body/status.
- **Detalhe:** [auditoria/06-bugs.md#bug-015](auditoria/06-bugs.md#bug-015--resposta-de-erro-user-not-found-em-send-test-push-permite-enumeration)

### #003 — Rotacionar senha postgres histórica + revogar PAT kids-paint
- **Status:** ✅ Concluído (2026-05-04)
- **Origem:** [Plan.md (SECURITY.md) + Auditoria] (BUG-013)
- **Esforço:** 30 min (manual)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ Senha postgres rotacionada via Supabase Dashboard `guefraaqbkcehofchnrc/database/settings` → Reset password (auto-generated 16-char strong, salva password manager user)
  - ✅ PAT `sbp_aedc82d7...` (conta `lhenrique.pda@gmail.com` dona kids-paint) já revogado anteriormente — verificado 2026-05-04: "No access tokens found" naquela conta
  - ✅ Nova senha em password manager user (entrada `Supabase Dosy postgres pwd (production)`)
  - ✅ `INFOS.md` ausente localmente e do git history (limpo via git-filter-repo durante #084 v0.1.7.5)
- **Detalhe:** [archive/security-original.md](archive/security-original.md) seções "CRÍTICO" e "ALTO"

### #004 — Vídeo demo FOREGROUND_SERVICE_SPECIAL_USE para Play Console
- **Status:** ✅ Concluído (2026-05-04)
- **Origem:** [Plan.md] FASE 18.9.1
- **Esforço:** 2-3h (gravar + editar + upload YouTube unlisted + Console form)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ Vídeo `alarm.mp4` (33s) gravado S25 Ultra Dosy Dev demonstrando: cadastro de tratamento → tela bloqueada → alarme fullscreen disparando sobre lockscreen → Tomada/Adiar/Pular
  - ✅ Upload YouTube como Shorts unlisted: https://www.youtube.com/watch?v=qLBCzualcCw
  - ✅ Play Console: Conteúdo do app → Permissões de serviço em primeiro plano → "Outro/Uso especial" + URL vídeo + descrição completa PT-BR (1082 chars) explicando categoria SPECIAL_USE necessária para alarmes médicos críticos não-cobertos pelas categorias padrão
  - ✅ Salvo (mensagem "A mudança foi salva")
- **Pendente:** envio pra revisão Google via Visão geral da publicação (junto com mudanças #025 + outras)

### #005 — Resolver BUG-001 — Encoding UTF-8 quebrado em nome de paciente
- **Status:** ✅ Concluído @ commit pendente (2026-05-01)
- **Origem:** [Auditoria] (BUG-001)
- **Esforço:** 1-3h (investigação + fix + verificação)
- **Dependências:** nenhuma
- **Aceitação:**
  1. ✅ Confirmado via `SELECT id, name, encode(name::bytea, 'hex')` — bytes `ef bf bd` (U+FFFD literal) presentes em 1 paciente legacy (`46d9196f` "Jo�o Teste", owner `teste03@teste.com`)
  2. ✅ Deletado via REST DELETE service_role
  3. ✅ Inserido novo paciente "João da Silva ÃÕÉÍÇãõéíç" via REST como teste03 → re-lido do DB → bytes idênticos UTF-8 puros (`c3 a3` para "ã" etc) → cleanup
  4. ⚠️ Playwright não está no repo. Substituído por **recipe documentado** em `contexto/updates/2026-05-01-fix-encoding-utf8-pacientes.md` (script Python pronto pra reauditoria periódica). Adicionar Playwright = item separado novo (P3).
- **Detalhe:** [auditoria/06-bugs.md#bug-001](auditoria/06-bugs.md#bug-001--encoding-utf-8-quebrado-em-nome-de-paciente)
- **Causa raiz:** seed legacy inserido durante dev cedo via tooling com encoding ruim (Windows-1252). DB Postgres é UTF-8 default; PostgREST round-trip funciona corretamente. Sem mudança de código necessária.

### #006 — Validação manual em device físico (FASE 17 Plan)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 17 + [Auditoria]
- **Esforço:** 1-2 dias (manual, 3 devices)
- **Dependências:** #001, #003 (bugs P0 corrigidos)
- **Aceitação:** rodar `docs/device-validation-checklist.md` em 3 devices (versões 12, 13, 14):
  - Pixel (stock Android)
  - Samsung A14 (One UI battery saver ON)
  - Xiaomi Redmi (MIUI agressivo) ou Motorola
  - Validar: alarme dispara locked + unlocked + app killed + DND + após reboot + adiar 10min funciona + FLAG_SECURE bloqueia screenshot + biometria (se wired) + responsividade
- **Saída:** issues em backlog ou re-abertura de sub-fase relevante

### #007 — Telemetria notificações PostHog (regressão silenciosa healthcare)
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — código restaurado. Bisect inicial deu false positive (storm não escalou em window 30s); investigação aprofundada identificou root cause real em #157 (useRealtime cascade + publication vazia).
- **Origem:** [Auditoria] (Dimensão 14)
- **Esforço:** 1-2h código + 30min setup dashboard PostHog
- **Dependências:** PostHog key já configurada (#015 ✅)
- **Implementação executada:**
  - `src/services/analytics.js` EVENTS: `NOTIFICATION_DELIVERED`, `NOTIFICATION_TAPPED`, `NOTIFICATION_DISMISSED` (constants)
  - `src/App.jsx` 4 listeners Capacitor wired (track call em cada):
    - `LocalNotifications.localNotificationReceived` → `NOTIFICATION_DELIVERED { kind:'local_foreground' }`
    - `LocalNotifications.localNotificationActionPerformed` → `NOTIFICATION_TAPPED { kind:'local' }`
    - `PushNotifications.pushNotificationReceived` → `NOTIFICATION_DELIVERED { kind:'push_foreground' }`
    - `PushNotifications.pushNotificationActionPerformed` → `NOTIFICATION_TAPPED { kind:'push' }`
  - Cleanup `localFireHandle?.remove?.()` adicionado ao return effect
  - Props: `kind`, `actionId`, `type`, `hasDoseId` — PII strip auto via `sanitize_properties` analytics.js (LGPD: zero email/name/observation/medName)

**Cobertura granular eventos:**
- ✅ FCM foreground delivery (Android app aberto) — `pushNotificationReceived`
- ✅ FCM tap (background OR foreground) — `pushNotificationActionPerformed`
- ✅ LocalNotif fire (foreground) — `localNotificationReceived`
- ✅ LocalNotif tap — `localNotificationActionPerformed`
- ⏳ FCM background delivery JS-side: NÃO captura (Android suspende JS background) — depende Edge `notify-doses` server-side delivery report (fora escopo #007 JS)
- ⏳ Notification dismissed (swipe-away sem tap): Capacitor LocalNotifications/PushNotifications NÃO emitem evento "dismissed" — requer custom Android plugin pra hook NotificationListenerService (parqueado v0.2.2.0+)

**Eventos relacionados já existentes:**
- `ALARM_FIRED` — alarme nativo full-screen disparado (DosyMessagingService → AlarmReceiver)
- `ALARM_DISMISSED` — user dismissed full-screen alarme
- `ALARM_SNOOZED` — user adiou (snooze button)
- `DOSE_CONFIRMED` — user marcou tomada via app
- `DOSE_SKIPPED` — user pulou via app

Combinação `ALARM_FIRED` + `NOTIFICATION_DELIVERED` + `DOSE_CONFIRMED/SKIPPED` mapeia funnel completo: agendamento → entrega → ação user.

**Pendente operacional (manual user, não bloqueante #007 fechado):**
- Dashboard PostHog: criar funnel `notification_delivered → alarm_fired → dose_confirmed/skipped/snoozed` com taxa entrega target ≥99%
- Alert PostHog: rule "drop >5% delivered last 1h vs prev 24h baseline" → notif email/Slack
- Documentar em `docs/playbooks/posthog-dashboards.md` (criar follow-up)

**Justificativa healthcare crítica:** sem esta métrica, regressão silenciosa em alarmes (3 caminhos #083) passa despercebida em produção. Healthcare = não-negociável.

**🚨 Bug storm preview Vercel (2026-05-05) — bisect inicial false positive, root cause real em #157:**

> **CORREÇÃO 2026-05-05 (sessão atual mais tarde):** Bisect inicial apontou #007 culpado por reduzir storm de 1053→0 reqs em window 30s. Investigação aprofundada (idle 5min completo) revelou que storm **escala ao longo do tempo em hidden tab** — bisect 30s capturou window pré-escalada. Storm real persistia mesmo sem #007 (715 reqs em 5min idle). Root cause real = **useRealtime reconnect cascade + publication `supabase_realtime` vazia** (ver #157). Após disable `useRealtime()` em App.jsx (commit `da61b04`), storm caiu para 9 reqs em 7min idle (~0.02 req/s sustained, 99.7% redução). #007 restaurado via revert do bisect commit `76dc28a`.

Validação preview Vercel `release/v0.2.1.0` Chrome MCP (Regra 9.1 README) detectou **storm catastrófico** (atribuído inicialmente a #007, depois identificado como #157):

| Métrica idle 30s hidden tab | Preview release v0.2.1.0 (com #007) | Prod master | Multiplicador |
|---|---|---|---|
| Total reqs Supabase | 1053 | 57 | **18×** |
| `/doses` | 809 (~27 req/s) | 48 (1.6 req/s) | 17× |
| `/patients` | 163 (5.4 req/s) | 6 (0.2 req/s) | 27× |
| `/treatments` | 81 (2.7 req/s) | 3 (0.1 req/s) | 27× |
| Egress 5min idle | 27 MB só `/doses` | ~2 MB todos | 13× |

**Extrapolação:** ~1 GB/h por user idle = quebra Supabase Pro tier rapidamente.

**Bisect:** revert src `App.jsx` + `analytics.js` ao estado anterior #007 (commit `76dc28a`) → **storm 0 reqs idle 44s** (vs 35 req/s antes). #007 confirmado culpado.

**Mecanismo (não-confirmado, candidatas):**
1. `import { track, EVENTS } from './services/analytics'` em App.jsx força init módulo `analytics.js` no boot.
2. `analytics.js` chama `initAnalytics()` em PROD que carrega `posthog-js` com `capture_pageview: 'history_change'` + autocapture.
3. PostHog autocapture instrumenta `window.fetch` globalmente.
4. Combinação possível: PostHog wrapper + interceptor próprio + `useEffect` App.jsx:126-131 (`scheduleDoses(allDoses, ...)` re-dispara em cada `allDoses` ref change) → cascade.
5. Ou: PostHog `capture_pageview: 'history_change'` reage a `pushState/popstate` durante navegação App.jsx → side-effect React Query refetch.

Sem repro cirúrgica, mecanismo exato pendente investigação dedicada v0.2.2.0+.

**Resolução real (descoberta sessão atual):** root cause = #157 (useRealtime cascade + publication vazia), não #007. Após disable `useRealtime()` em App.jsx (commit `da61b04`), storm sumiu (9 reqs / 7min idle = 0.021 req/s vs 12 req/s antes). #007 restaurado via revert bisect (commit `ff431ca`). Ver #157 entry abaixo + ver `contexto/updates/2026-05-05-investigacao-157-storm-realtime.md`.

**Lições (durable feedback memory):**
- Validação preview Vercel via Chrome MCP **DEVE** rodar pré-merge release branch (Regra 9.1 README) — confirmado mais uma vez. Sem ela, storm seria descoberto pós-prod com user impact + custo egress.
- **Idle 5min hidden tab é gate crítico** — capturou bug que bateria interativa (2 min) NÃO captou. **Bisect 30s window pode dar false negative** porque storm escala ao longo do tempo em hidden tab.
- Lint + build + manual smoke web local NÃO substituem preview Vercel real (Capacitor shim + PROD mode + lazy chunks comportam diferente).
- **Bisect deve sempre validar com window igual ao original observation** (storm 5min observed → bisect 5min, não 30s).

### #008 — Configurar `SENTRY_AUTH_TOKEN` + `ORG` + `PROJECT` em GitHub Secrets
- **Status:** ✅ Concluído (verificado 2026-05-04 — secrets criados em 2026-04-28)
- **Origem:** [Plan.md] FASE 10.1 manual pendente
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ Secrets configurados em GitHub Actions: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG=lhp-tech`, `SENTRY_PROJECT=dosy`, `VITE_SENTRY_DSN` (criados 2026-04-28)
  - ✅ Workflows `.github/workflows/ci.yml` + `android-release.yml` referenciam os 4 secrets corretamente em build step
  - ⚠️ Próximo build CI envia source maps — **bloqueado por #127** (CI failing por lint errors pré-existentes em AnimatedRoutes.jsx, não relacionados aos secrets). Quando CI passar, upload funciona auto.
- **Validação pendente:** Sentry → Releases → ver release tag `dosy@0.2.0.6` aparecer após próximo CI run bem-sucedido (depende #127)

### #009 — Configurar PITR (Point-in-Time Recovery) e testar restore drill
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 21 §11)
- **Esforço:** 30 min config + 2h drill
- **Dependências:** Supabase Pro plan upgrade (custo)
- **Aceitação:**
  - PITR habilitado (Supabase Dashboard → Settings → Backups)
  - Retenção mínimo 7 dias
  - Drill executado: criar staging project, restaurar backup recente, validar dados íntegros
  - Runbook escrito: `docs/runbook-dr.md`

### #091 — TZ fix extend_continuous BRT
- **Status:** ✅ Concluído @ commit b3c979e (2026-05-02)
- **Origem:** BUG-024 healthcare-critical
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  TZ fix em extend_continuous_treatments(p_user_id) — UTC raw → America/Sao_Paulo via AT TIME ZONE. Doses futuras com firstDoseTime array agora salvam horário correto. 3 tratamentos cleanup user lhenrique.pda. Migration 20260503025200_fix_extend_continuous_tz_bug.sql.
- **Aceitação:** Validado em release v0.1.7.4 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.4.

### #092 — Egress reduction multi-frente
- **Status:** ✅ Concluído @ commit 557dcd9 (2026-05-02)
- **Origem:** BUG-025 P0 Egress 400% Free Plan
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Realtime postgres_changes filter userId=eq.X server-side. listDoses default range -30d/+60d. Paginate cap 20→5 pages. queryKey timestamps normalizados hour boundary. refetchInterval 60s→5min, staleTime 30s→2min. staleTime bumps useUserPrefs/usePatients/useTreatments/useMyTier. App.jsx alarm scope -1d/+14d.
- **Aceitação:** Validado em release v0.1.7.5 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.5.

### #094 — Paywall falso pra users plus/pro
- **Status:** ✅ Concluído @ commit 8b32245 (2026-05-02)
- **Origem:** BUG-027 trust violation
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Fix paywall falso em mount race. teste03 (tier plus DB) tentou cadastrar paciente novo → paywall 'No plano grátis você pode ter até 1 paciente'. Causa: usePatientLimitReached retornava true quando tier=undefined; getMyTier auth.getUser() race null cache 30min. Fix: useMyTier enabled: !!user via useAuth + queryKey inclui userId + usePatientLimitReached retorna false durante loading.
- **Aceitação:** Validado em release v0.1.7.5 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.5.

### #101 — Auditoria egress pós-#092
- **Status:** ✅ Concluído (release v0.2.0.1)
- **Origem:** Auditoria pós-#092
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Audit findings 2026-05-04 via pg_stat_statements + pg_replication_slots. Conclusão: nenhum query patológico, #092 fix manteve. Removido photo_url de PATIENT_COLS_LIST (egress 50KB-2MB × refetch frequente).
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #106 — Ícone launcher + splash atualizar
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** BUG-034 brand consistency
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  REGRESSÃO IDENTIFICADA: pasta assets/ legacy com icon-only.png antigo tinha precedência sobre resources/ no @capacitor/assets generate. Fix: deletado assets/ legado, criado resources/icon-only.png composto, deletado mipmap-*/ic_launcher*.png stale, re-run generate → 86→61 outputs. ic_launcher peach pill + splash full peach.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #107 — schema rpc.catch is not a function
- **Status:** ✅ Concluído (release v0.2.0.0+)
- **Origem:** BUG-035 Sentry
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Sentry DOSY-J/F/G TypeError em Dashboard pull-to-refresh. supabase.schema().rpc() retorna PostgrestFilterBuilder (PromiseLike, só .then), .catch() throw TypeError. Fix: .then(undefined, errHandler) form 2-arg em Dashboard.jsx handleRefresh array Promise.all.
- **Aceitação:** Validado em release v0.2.0.0+ (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.0+.

### #109 — useRealtime concurrent subscribe race
- **Status:** ✅ Concluído @ commit 09724c1 (2026-05-04)
- **Origem:** BUG-037 Sentry healthcare reliability
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Lock flag subscribing + try/catch ch.on() defensive previne 4 paths convergent (status reconnect + watchdog + TOKEN_REFRESHED + native resume). 9 events em 4 issues. #093 (v0.1.7.5) aplicou fix nome único + await removeChannel + generation counter mas erro voltou em vendor bundle Vr.on.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #115 — Avatar foto cache via photo_version
- **Status:** ✅ Concluído (release v0.2.0.2)
- **Origem:** ROADMAP §6 P0 cost+UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Nova coluna photo_version SMALLINT em patients (migration replace_photo_thumb_with_photo_version). Lista carrega só photo_version (2B). Hook usePatientPhoto(id, version) checa localStorage[dosy_photo_<id>] = {v, data} — match version → render instant ZERO request. Mismatch → 1 fetch via getPatient → cache forever. PatientForm submit bump version. Foto baixa 1 vez por device.
- **Aceitação:** Validado em release v0.2.0.2 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.2.

### #126 — Pre-commit secret scanning gitleaks
- **Status:** ✅ Concluído (release v0.2.0.5)
- **Origem:** ROADMAP §6 P0 SECURITY
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  GitGuardian 4 incidents High: 3× postgres pwd + 1× VAPID. Fix: gitleaks 8.30.1 + .gitleaks.toml custom regras + .husky/pre-commit roda gitleaks protect --staged ANTES lint-staged + .github/workflows/gitleaks.yml CI camada não-bypassable. Full scan 27→0 leaks.
- **Aceitação:** Validado em release v0.2.0.5 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.5.

### #148 — Dashboard rpc debounce 60s
- **Status:** ✅ Concluído @ commit 7c8cf5b (2026-05-05)
- **Origem:** Validação preview Vercel
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Dashboard extend_continuous_treatments rpc 2× por mount. Causa: AnimatePresence popLayout mantém old + new Dashboard durante exit anim ~600ms → ambos useEffects firam. Fix: module-scope flag window.__dosyExtendContinuousAt debounce 60s. Identificado via Chrome MCP fetch interceptor preview Vercel.
- **Aceitação:** Validado em release v0.2.0.11 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.11.

### #149 — useDoses mutation refetch debounce 2s
- **Status:** ✅ Concluído @ commit 758035b (2026-05-05)
- **Origem:** Validação preview Vercel
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  useDoses mutation refetch storm — 12 fetches /doses em 200s sessão real (mark/skip/undo cascade). Causa: cada mutation onSettled invalida ['doses'] → todas active queryKeys (3-5) refetcham simultâneo. Optimistic update via patchDoseInCache já garante UI consistency. Fix: debounce 2s via module-scope timer. -75% storm.
- **Aceitação:** Validado em release v0.2.0.11 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.11.

### #150 — useDoses refetchInterval 15min
- **Status:** ✅ Concluído @ commit 017916d (2026-05-05)
- **Origem:** Validação preview Vercel
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  useDoses refetchInterval idle storm — 5 fetches /doses simultâneos cada 5min em IDLE. Causa: 5 active queryKeys × 5min interval. Math: 5 × 50KB × 12 cycles/h × 24h × 1000 users = 14GB/dia idle polling. Fix: 5min → 15min = -67% polling rate.
- **Aceitação:** Validado em release v0.2.0.11 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.11.

### #151 — useDoses refetchInterval opt-in
- **Status:** ✅ Concluído @ commit 78127b7 (2026-05-05)
- **Origem:** Validação preview Vercel
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  useDoses refetchInterval opt-in only Dashboard. Antes: hardcoded 15min em TODAS queries. Agora: default OFF, opt-in via options.pollIntervalMs. Dashboard explicitamente passa 15min. Outras telas (Settings, DoseHistory, Reports) sem polling — refetch só on mount + Realtime + invalidate explícito. -80% adicional idle egress.
- **Aceitação:** Validado em release v0.2.0.11 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.11.

### #154 — Custom SMTP Resend dosymed.app
- **Status:** ✅ Concluído (release v0.2.0.12)
- **Origem:** Sessão v0.2.0.12 (descoberto rate limit)
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Built-in Supabase email rate-limited 2/h (não-prod). Resend SMTP 30/h Supabase (1000+ Resend free tier). DNS Hostinger 4 records (DKIM TXT resend._domainkey, MX send→feedback-smtp.sa-east-1.amazonses.com, SPF TXT, DMARC). Domain Resend VERIFIED <5min. Supabase Auth → SMTP Settings: smtp.resend.com:465 user resend pass=API key, sender Dosy <noreply@dosymed.app>. Recovery OTP funcionando real prod.
- **Aceitação:** Validado em release v0.2.0.12 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.12.

---

## 🟠 P1 — Alta Prioridade (pré-soft-launch)

### #010 — Criar `ic_stat_dosy` notification icon
- **Status:** ✅ Concluído @ commit cbfc813 (2026-05-04) — validado device S25 Ultra
- **Origem:** [Auditoria] (BUG-005)
- **Esforço:** 1h (designer + ImageMagick + cap sync)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ `ic_stat_dosy.xml` vector drawable 24dp em `android/app/src/main/res/drawable/` (single source escala todas densidades; substituiu PNG colorida 96x96 stale).
  - ✅ 3 paths Java nativos (AlarmReceiver/AlarmActivity/AlarmService) trocados de `R.mipmap.ic_launcher` → `R.drawable.ic_stat_dosy` + `setColor(0xFFFF6B5B)` accent peach.
  - ✅ Validação visual S25 Ultra Dosy Dev: notificação dispara, status tray mostra silhueta correta.
- **Detalhe:** [auditoria/06-bugs.md#bug-005](auditoria/06-bugs.md#bug-005--ic_stat_dosy-referenciado-mas-ausente-nos-drawables)

### #011 — Adicionar `<label>` explícito em inputs Login (A11y universal — TalkBack/screen readers)
- **Status:** ✅ Concluído @ commit eb6c06c (2026-05-02)
- **Origem:** [Auditoria] (Dimensão 7)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:** Login.jsx tem `<label htmlFor="email">` e `<label htmlFor="password">` visíveis acima dos inputs. TalkBack lê corretamente.

### #012 — Recriar policies RLS com `TO authenticated` explícito
- **Status:** ✅ Concluído @ commit 1496f48 (2026-05-02)
- **Origem:** [Plan.md] FASE 8.3 backlog
- **Esforço:** 2-3h (migration + testes)
- **Dependências:** nenhuma
- **Aceitação:**
  - Migration `supabase/migrations/{ts}_refine_policies_to_authenticated.sql`
  - Todas policies em medcontrol têm `TO authenticated`
  - Pen test: anon role acessa ≠ falha; authenticated do user A acessa user B = falha
- **Detalhe:** [auditoria/04-supabase.md §15.2](auditoria/04-supabase.md#152-audit-de-policies)

### #013 — Splitar policies `cmd=ALL` em 4 separadas
- **Status:** ✅ Concluído @ commit 1496f48 (2026-05-02)
- **Origem:** [Plan.md] FASE 8.3 backlog (Aud 5.2 G9)
- **Esforço:** 2h
- **Dependências:** #012
- **Aceitação:**
  - Tabelas com `cmd=ALL` (push_subs, user_prefs, subscriptions, security_events) divididas em SELECT/INSERT/UPDATE/DELETE
  - Cada policy com `using` + `with_check` apropriado

### #014 — Recriar RPC `extend_continuous_treatments` (BUG-004)
- **Status:** ✅ Concluído @ commit f7e4315 (2026-05-02)
- **Origem:** [Plan.md] FASE 23.5 + [Auditoria]
- **Esforço:** 3-4h
- **Dependências:** nenhuma
- **Aceitação:**
  - Migration `supabase/migrations/{ts}_recreate_extend_continuous_treatments.sql`
  - Função `(p_days_ahead int) RETURNS json`, SECURITY DEFINER, `SET search_path = medcontrol, pg_temp`
  - Validação ownership via `auth.uid()`
  - Reativar chamadas em `Dashboard.jsx` (mount + handleRefresh)
  - Teste: criar tratamento contínuo → mocar agora() para 7d depois → `dosesAdded > 0`

### #015 — Configurar PostHog key + dashboards launch
- **Status:** ✅ Concluído (release v0.1.7.4)
- **Origem:** [Plan.md] FASE 14.1 manual
- **Esforço:** 1-2h (criar conta + key + dashboards básicos)
- **Dependências:** nenhuma
- **Aceitação:**
  - Conta PostHog criada
  - Key em GitHub Secret `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST`
  - Próximo build CI envia eventos
  - Dashboards: DAU/WAU/MAU, retention D1/D7/D30, funnel signup→first_dose, NPS

### #016 — Configurar alertas Sentry (crash spike, error threshold)
- **Status:** ✅ Concluído (release v0.1.7.4)
- **Origem:** [Plan.md] FASE 14.2 manual
- **Esforço:** 30 min
- **Dependências:** projeto Sentry com release tag (já feito FASE 7.3)
- **Aceitação:**
  - Alert rule: crash count > 10 em 1h → email/Slack
  - Alert rule: novo issue crítico (não visto antes) → notificação imediata
  - Threshold: ANR rate > 0.5%

### #017 — Wire LockScreen UI + integração biometria (`useAppLock`)
- **Status:** ✅ Concluído @ commit 869ab34 (2026-05-04) — validado device S25 Ultra
- **Origem:** [Plan.md] FASE 11.3 → 12 ou 23
- **Esforço:** 4-6h
- **Dependências:** nenhuma
- **Aceitação (todos validados em S25 Ultra Dosy Dev):**
  - ✅ LockScreen overlay em App.jsx (camada lógica equivalente a main.jsx — AuthProvider necessário pra signOut escape hatch)
  - ✅ Toggle "Bloqueio do app" em Settings seção "Privacidade e segurança" (native-only, default OFF) — toast feedback + dropdown timeout aparece quando ON
  - ✅ Auto-lock após N min em background (validado timeout 1min, configurável 1/5/15/30/60min via Dropdown)
  - ✅ Biometria desbloqueia (digital/face) via `@aparajita/capacitor-biometric-auth` 10.x
  - ✅ Cold start: app abre direto na tela de bloqueio
  - ✅ Cancelar prompt biometria (back button) mantém bloqueado + botões Desbloquear/Sair-da-conta visíveis
  - ✅ Disable toggle exige biometria (anti-tamper)
  - ✅ Fallback senha celular via `allowDeviceCredential: true`

### #018 — AdMob Android prod (prioritário) + AdSense web (secundário)
- **Status:** ⏳ Aberto (parcial AdMob — escopo expandido 2026-05-05)
- **Origem:** [Plan.md] FASE 4.3 pendente; cross-ref AdMob Console assessment 2026-05-05
- **Esforço:** AdMob: 15min flag flip + aguardar Play Production approval. AdSense: 1h opcional.
- **Dependências:** AdMob app approval Google (depende #133 Production track Play Console).

**Estado atual AdMob (2026-05-05 — Chrome MCP Console assessment):**
- ✅ Conta AdMob aprovada · perfil pagamento completo (dosy.med@gmail.com)
- ✅ App "Dosy" Android registrado: App ID `ca-app-pub-2350865861527931~5445284437`
- ✅ Banner ad unit "Dosy Bottom Banner": `ca-app-pub-2350865861527931/2984960441`
- ✅ AndroidManifest meta-data ads.APPLICATION_ID já com prod ID real
- ✅ `.env` + `.env.production`: `VITE_ADMOB_BANNER_ANDROID=ca-app-pub-2350865861527931/2984960441`
- ❌ `.env.production`: `VITE_ADMOB_USE_TEST=true` — força sandbox banner Google `/6300978111` (sempre fill, $0)
- ⏸️ AdMob Console status app: "Requer revisão / Veiculação limitada" (espera Play Store Production track #133)

**Estado atual AdSense web:**
- ❌ `index.html` linha 18-19: script tag com placeholder `client=ca-pub-XXXXXXXXXXXXXXXX` (404 silently)
- ❌ `.env*` + Vercel env: `VITE_ADSENSE_CLIENT` + `VITE_ADSENSE_SLOT` vazios → AdBanner.jsx retorna null
- 🟡 Foco mobile-first → web AdSense baixa prioridade. Pode permanecer placeholder OU remover script index.html cosmeticamente.

**Aceitação AdMob:**
  - Após `#133` aprovação Production: flip `VITE_ADMOB_USE_TEST=false` em Vercel + `.env.production` local
  - Rebuild AAB + Vercel deploy: real ad unit veicula (ou no-fill no início enquanto eCPM warm-up)
  - Validar device real: `[AdMob] no-fill / load fail` aceitável; sem crash; CSS var `--ad-banner-height` colapsa em no-fill

**Aceitação AdSense (opcional):**
  - Decisão: criar conta AdSense web + verificar domínio dosymed.app → preencher `data-ad-client` real OU remover linhas 17-19 index.html
  - Se preencher: `VITE_ADSENSE_CLIENT=ca-pub-...` + `VITE_ADSENSE_SLOT=...` em Vercel env

**Progresso v0.2.1.0 (2026-05-05):**
  - ✅ AdSense placeholder script removido de `index.html` (linhas 17-19 viraram comentário documentado). Network tab Vercel preview não mais carrega `adsbygoogle.js` 404. Reativação documentada no comentário.
  - ⏸️ AdMob `VITE_ADMOB_USE_TEST=false`: aguarda #133 Production track Play Console aprovado.

**Notas:** [auditoria/06-bugs.md#bug-006](auditoria/06-bugs.md#bug-006--adsense-placeholder-em-produção-indexhtml). Item original era "AdSense IDs em index.html" → ampliado pra cobrir ambos AdSense (web) + AdMob (Android native principal).

### #019 — Subir `minimum_password_length` para 8 + complexity
- **Status:** ✅ Concluído @ commit eb6c06c (2026-05-02)
- **Origem:** [Auditoria] (BUG-008)
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Aceitação:**
  ```toml
  [auth]
  minimum_password_length = 8
  password_requirements = "lower_upper_letters_digits"
  ```
  Aplicar via Supabase Dashboard cloud + commitar `config.toml`. Frontend continua validando 8+. Senhas existentes < 8 não-quebradas (server só rejeita novas).

### #020 — Disclaimer médico visível ("Não substitui orientação")
- **Status:** ✅ Concluído @ commit eb6c06c (2026-05-02)
- **Origem:** [Plan.md] FASE 18.5.1 + [Auditoria] (Dimensão 16)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  - Texto em modal aparece no primeiro signup (após consentimento checkbox)
  - Texto também em `/termos` em destaque
  - Onboarding tour menciona

### #021 — Backup keystore em 3 locais seguros
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 18.3 manual crítico
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  - 1: password manager com keystore + senhas (1Password/Bitwarden)
  - 2: pendrive offline criptografado (VeraCrypt) guardado fisicamente
  - 3: cloud cifrado (drive cifrado / pCloud Crypto)
  - Documento `docs/keystore-backup-procedure.md` com SOP
- **Risco se ignorado:** keystore perdido = app morto no Play Store, impossível publicar updates.

### #022 — Verificar TS 6.0.3 legitimidade (BUG-007)
- **Status:** ✅ Concluído (release v0.1.7.4)
- **Origem:** [Auditoria] (BUG-007)
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Aceitação:**
  - `npm view typescript@6.0.3 maintainers` mostra `microsoft <microsoft>` ou similar oficial
  - Se confirmado oficial: deixar como está
  - Se duvidoso: degradar para `^5.7.0` e `npm install`

### #023 — Refatorar `useDoses` para `refetchIntervalInBackground: false`
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01) — release v0.1.7.0
- **Origem:** [Auditoria] (Dimensão 22)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  ```js
  useQuery({
    queryKey: ['doses', filter],
    queryFn: ...,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,  // ← novo
    staleTime: 30_000,                    // ← novo
  })
  ```
  Polling pausa quando aba/app inativo. Custo Supabase reduz ~40%.

### #024 — Adicionar pre-commit hook (husky + lint-staged)
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 23)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  ```bash
  npm install -D husky lint-staged
  npx husky init
  echo "npx lint-staged" > .husky/pre-commit
  ```
  + config em package.json: `"lint-staged": { "*.{js,jsx}": ["eslint --fix", "prettier --write"] }`

### #025 — Screenshots phone retrabalho (Play Store)
- **Status:** ✅ Concluído (2026-05-04)
- **Origem:** [Plan.md] FASE 18.9.2
- **Esforço:** 2-3h (designer)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ 19 screenshots brutos capturados S25 Ultra Dosy Dev (1080×2340 atende mínimo 1080px Play Store)
  - ✅ Triagem: 8 melhores escolhidas em `resources/prints/processado/` ordenadas 01-08 (alarme multi-dose · início multi-paciente · análises · marcar dose · relatórios · paciente · histórico · onboarding alarme)
  - ✅ Plus assets gerados via sharp: `icon-512-peach.png` (composto icon-background + logo-mono-light, safe margin 17% H · 37% V) + `feature-graphic-1024x500.png` (gradient peach + tagline) + `yt-avatar-800.png` + `yt-banner-2560x1440.png`
  - ✅ Upload Play Console: ícone 512 + 8 screenshots phone uploadados, Salvar persistido como rascunho
  - ✅ Listagem da loja → campo Vídeo preenchido com URL YouTube unlisted
- **Pendente:** envio pra revisão Google via Visão geral da publicação

### #026 — Emails oficiais `*@dosymed.app` via ImprovMX → dosy.med@gmail.com
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — DNS + ImprovMX + 7 aliases verificados (Gmail labels manuais user)
- **Origem:** [Plan.md] FASE 18.5
- **Esforço:** 1h setup (Chrome MCP) + 5min Gmail labels manual user
- **Dependências:** domínio `dosymed.app` já em produção (custom domain Vercel + Resend SMTP #154)
- **Resolução escolhida:** **ImprovMX free** (25 aliases, DNS-only, zero infra, free forever).

**Setup executado (Chrome MCP dosy.med@gmail.com):**

1. ✅ Conta ImprovMX criada manualmente user `dosy.med@gmail.com` + domain `dosymed.app` adicionado
2. ✅ DNS Hostinger 3 records adicionados (apex `@`):
   - `MX @ 10 mx1.improvmx.com`
   - `MX @ 20 mx2.improvmx.com`
   - `TXT @ "v=spf1 include:spf.improvmx.com ~all"`
3. ✅ DNS propagation verificada via `nslookup -type=mx dosymed.app 8.8.8.8` (records visíveis Google DNS)
4. ✅ ImprovMX domain status: **VERIFIED** (email confirmação "Amazing! Your domain is verified")
5. ✅ 7 aliases criados (todos forward → `dosy.med@gmail.com`):

| Alias | Uso |
|---|---|
| `*@dosymed.app` (catch-all) | Fallback any address |
| `contato@dosymed.app` | Geral / Play Console contato |
| `privacidade@dosymed.app` | DPO LGPD (#156) |
| `suporte@dosymed.app` | Atendimento usuários |
| `legal@dosymed.app` | Jurídico / Termos / DMCA |
| `dpo@dosymed.app` | Data Protection Officer (sinônimo privacidade) |
| `security@dosymed.app` | Vuln disclosures |
| `hello@dosymed.app` | First-touch friendly outreach |

**Resilience considerations:**
- SPF não conflita com Resend SMTP outbound (#154) pq Resend usa subdomain `send.dosymed.app`
- DKIM Resend (`resend._domainkey`) intocado
- DMARC `_dmarc` policy `p=none` mantida — bom pra debug inicial
- Free tier limit: 25 aliases (espaço ainda pra +18) e 10 mensagens/dia. Upgrade $9/mo se exceder

**Gmail filters + labels (concluído v0.2.1.0 via Chrome MCP):**
- ✅ 7 labels criadas: Contato, Privacidade, Suporte, Legal, DPO, Security, Hello (sidebar Gmail)
- ✅ 7 filters criados, cada um `Matches: to:(<alias>@dosymed.app) Do this: Apply label "<Label>"`
- ✅ Filters aplicam label automaticamente em emails recebidos (mantém inbox + label, não archive)
- Test envio futuro pra qualquer `<alias>@dosymed.app` → ImprovMX forward → dosy.med@gmail.com → filter aplica label correspondente

**Fix anti-spam (2026-05-05 sessão atual via Chrome MCP):**
- **Problema:** user enviou TESTE 1 lhenrique.pda@gmail.com → contato@dosymed.app → forward funcionou (ImprovMX dashboard SENT) MAS Gmail flagou como Spam (forwarder novo, sender desconhecido). Filtros 1-7 só aplicam label, sem flag "Never Spam".
- **Diagnóstico:** ImprovMX dashboard 1 Received OK. DNS MX+SPF OK. Causa = Gmail spam heuristic. TESTE 1 + ImprovMX TEST email achados em Spam.
- **Fix:** 8º filtro catch-all criado `Matches: to:(dosymed.app) Do this: Never send it to Spam, Mark it as important`. Cobre 7 aliases atuais + futuros + qualquer `<x>@dosymed.app`.
- **Validação end-to-end:** TESTE 1 resgatado Spam → marcado "Report not spam" → Inbox `Contato` label. ImprovMX TEST `Alias test for contato@dosymed.app` chegou Inbox direto label `Contato`. Forward chain validado: gmail.com → dosymed.app MX (improvmx) → forwarder@improvmx.com → dosy.med@gmail.com Inbox + label.
- **Limitação Gmail conhecida:** filtro NÃO aplica retroativo em Spam/Trash. Resgate manual user para emails antigos lá.
- **Pendência (opcional):** consolidar filtros 1-7 adicionando "Never Spam"+"Mark important" em cada (catch-all 8 já cobre na prática, mas redundância protege contra Gmail decidir mover apesar do filter 8).

**Fix Sentry whitelist (2026-05-06 sessão v0.2.1.4 via Chrome MCP):**
- **Problema:** user reportou TESTE 02 enviado contato@dosymed.app não chegou + emails Sentry em Spam.
- **Investigação:**
  - TESTE 02 **CHEGOU** Inbox + label "Contato" 11:29 PM (~7min delay forward chain). Headers SPF: PASS / DKIM: PASS / DMARC: PASS / dara=fail (irrelevant). Filter #026 catch-all funcionou. User talvez checou antes de chegar.
  - 5 emails Sentry achados Spam (May 1-2, errors `postgres_changes` callbacks — issue #093 já fixed mas Sentry envio reverberou). Sender `noreply@md.getsentry.com` envia DIRETO pra `dosy.med@gmail.com` — bypass ImprovMX dosymed.app. Filter #026 catch-all (`to:(dosymed.app)`) NÃO cobre.
- **Fix:** 9º filter Gmail criado `Matches: from:(getsentry.com OR sentry.io) Do this: Never send it to Spam, Always mark it as important`. Cobre `noreply@md.getsentry.com` (issue alerts), `noreply@sentry.io` (account/billing), e qualquer outro Sentry domain.
- **Resgate retroativo:** 5 conversations Sentry desmarcadas Spam → Inbox manual via "Not spam" toolbar (filter Gmail não aplica retroativo Spam/Trash). Toast confirmou: "Future messages from these senders will be sent to Inbox".
- **Estado final 9 filters Gmail:**
  1-7 — `to:(<alias>@dosymed.app)` → label "<Alias>"
  8 — `to:(dosymed.app)` → Never Spam + Mark important (catch-all #026)
  9 — `from:(getsentry.com OR sentry.io)` → Never Spam + Mark important (Sentry whitelist)

**Pendente código v0.2.1.0:**
- ⏳ Atualizar UI Settings → "Suporte" link mailto: → `mailto:suporte@dosymed.app`
- ⏳ Termos.jsx + Privacidade.jsx (criando #156) referenciar emails canônicos
- ⏳ Footer Login mostrar `contato@dosymed.app` se cabível

**Validação aceitação:**
- ✅ DNS records visíveis externamente (nslookup 8.8.8.8 OK)
- ✅ ImprovMX domain VERIFIED (notif email recebido confirmando)
- ⏳ Test send email pra `suporte@dosymed.app` → confirmar chegar dosy.med@gmail.com (user pode testar manual)
- ⏳ Auto-responder SLA: parqueado v0.2.2.0+ (Gmail templates OR Resend Inbound webhook)

### #027 — Promover Closed Testing track + 12 testers via Reddit
- **Status:** ✅ Concluído v0.2.0.12 (2026-05-05) — superseded por #129-#133
- **Origem:** [Plan.md] FASE 18.9.3
- **Esforço:** N/A (substituído)
- **Dependências:** N/A
- **Resolução:** Item original "promover Closed Testing + 12 testers via amigos/Reddit" expandido em granularidade fina conforme estratégia 2026-05-05: User decidiu pular recrutamento Internal com pessoas conhecidas e ir direto Closed via Google Group público + Reddit/redes externas. Trabalho real distribuído em:
  - **#129** Criar Google Group público `dosy-testers`
  - **#130** Configurar Closed Testing track Console (tester list = e-mail group + países BR + AAB v0.2.0.7+)
  - **#131** Recrutar 15-20 testers externos (Reddit r/AlphaAndBetausers + r/SideProject + r/brasil + targeted r/medicina/r/saude/r/tdah/r/diabetes + Twitter + LinkedIn + Discord)
  - **#132** Gate 14d × ≥12 ativos + iterar bugs em mini-releases
  - **#133** Solicitar Production access pós-gate
- **Validação:** trabalho remanescente fica nos itens granulares acima.

### #088 — Dose não aparece Início (Pixel 7)
- **Status:** ✅ Concluído @ commit 705b69f (2026-05-02)
- **Origem:** BUG-021
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Fix viewport-specific em useDoses: refetchOnMount: 'always' (Pixel 7 emulador). NÃO repro Samsung S25 Ultra device real. Fix preserva comportamento em devices modernos.
- **Aceitação:** Validado em release v0.1.7.4 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.4.

### #089 — Layout AdSense banner empurrando header parcial (Pixel 7)
- **Status:** ✅ Concluído organicamente entre v0.1.7.4-v0.2.0.12 (validado user print Pixel 7 emulador 2026-05-05)
- **Origem:** BUG-022 reportado user 2026-05-02
- **Prioridade:** P2 UX visual
- **Esforço:** Investigação não-iniciada (fix orgânico durante refactors AppHeader / CSS vars)
- **Dependências:** nenhuma
- **Problema original:**
  Banner "Test Ad 468x60" ocupava topo viewport. Header "Dosy ▸ Frederico" ficava abaixo do banner com texto "Dosy" parcialmente cortado/sobreposto. Visível emulador Pixel 7 (1080×2400 @420dpi). NÃO repro Samsung S25 Ultra real.
- **Validação fechamento (2026-05-05):**
  Print user emulador Pixel 7 v0.2.0.12 mostra layout limpo: banner "Test Ad - This is a 320x50 test ad" topo + header Dosy abaixo + "Boa noite, Teste Free" + ⚙️ ícone. Wordmark "Dosy" inteiro visível, sem sobreposição. Tabs filtro 12h/24h/48h/7 dias/10 dias renderizam OK.
- **Provável fix orgânico:**
  - #113 (v0.2.0.x) buffer +4 px em `--ad-banner-height` CSS var (era exagerado +16, ajustado pra +4 sem perder safety margin)
  - AppHeader top calc com `env(safe-area-inset-top, 0px) + var(--ad-banner-height, 0px) + var(--update-banner-height, 0px)` cobre todos viewports
  - Cross-device validation natural durante refactors v0.2.0.x
- **Aceitação:** ✅ User print Pixel 7 v0.2.0.12 confirma layout OK
- **Detalhe:** Bug fechado sem fix dedicado — sintoma desapareceu durante refactors progressivos AppHeader / CSS vars.

### #090 — Pós-login redireciona pra Início
- **Status:** ✅ Concluído @ commit 63f444c (2026-05-02)
- **Origem:** BUG-023
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  navigate('/', {replace:true}) explícito em Login.submit após signin/signup success se path atual não é '/' nem '/reset-password'. Causa: React Router preservava pathname /ajustes herdado pré-logout.
- **Aceitação:** Validado em release v0.1.7.4 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.4.

### #093 — Race useRealtime postgres_changes
- **Status:** ✅ Concluído @ commit 557dcd9 (2026-05-02)
- **Origem:** BUG-026 / Sentry crash spike
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Fix race condition useRealtime: nome único realtime:${userId}:${gen}:${Date.now()} por subscribe + await supabase.removeChannel() + generation counter ignora callbacks de canais antigos durante reconnect.
- **Aceitação:** Validado em release v0.1.7.5 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.5.

### #095 — Versão real native packageInfo /Ajustes
- **Status:** ✅ Concluído (release v0.1.7.5)
- **Origem:** BUG companion #094
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  /Ajustes mostra versão real native via packageInfo (era hardcoded ou stale).
- **Aceitação:** Validado em release v0.1.7.5 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.5.

### #096 — Admin panel tier consistente
- **Status:** ✅ Concluído @ commit 60d4422 (2026-05-04)
- **Origem:** BUG-028
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  listAllUsers agora aplica mesmo promo free→plus que getMyTier — admin panel sincroniza com client view. Fix inconsistência tier display: AjustesScreen + AppHeader (TierBadge) liam plus mas /admin mostrava free.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #099 — Avatar paciente upload + crop
- **Status:** ✅ Concluído @ commit 1fcff21 (2026-05-04)
- **Origem:** BUG-031
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Canvas client-side center-square-crop 512x512 + JPEG 0.78 (~50KB) antes de salvar. Resolve aspect 1:1 + reduz payload DB. Fix: handler upload PatientForm + invalidate queryClient ['patients'].
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #102 — Atalho hardware silenciar alarme
- **Status:** ✅ Concluído @ commit f02bf12 (2026-05-04)
- **Origem:** ROADMAP §6 P1 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  AlarmActivity.onKeyDown override KEYCODE_VOLUME_UP/DOWN → toggleMute() + return true. Botões físicos volume silenciam ringtone instantaneamente sem dismiss. muteButton label sincroniza '🔇 Som off'.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #103 — UpdateBanner URL runtime
- **Status:** ✅ Concluído @ commit 4a6e39c (2026-05-04)
- **Origem:** BUG-032
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  UpdateBanner apontava dosy-teal.vercel.app (preview antigo morto) → fetch 404 silent → available=false. Fix: usar window.location.origin runtime. App detecta nova versão Play Store via version.json corretamente.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #105 — MultiDoseModal Dosy primitives
- **Status:** ✅ Concluído @ commit 65211cb (2026-05-04)
- **Origem:** BUG-033
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Sheet + Card per dose + StatusPill kind + Buttons ghost/secondary/primary com Lucide icons. Quando user clica Ciente no AlarmActivity nativo, app abre via deep link ?doses=id1,id2 → Dashboard renderiza MultiDoseModal. Refactor de classes legacy bg-slate-900 + btn-primary blue.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #108 — PatientForm weight.replace TypeError
- **Status:** ✅ Concluído @ commit 09724c1 (2026-05-04)
- **Origem:** BUG-036 Sentry DOSY-K
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Coerce String() em load + submit. Causa: campo weight passa pelo input já como number OR null, mas onSubmit chama weight.replace(',','.') esperando string. Fix: coerce String(weight) antes de replace.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #114 — Avatar foto crop manual react-easy-crop
- **Status:** ✅ Concluído (release v0.2.0.2)
- **Origem:** BUG-038
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Integrado react-easy-crop em CropModal component novo. PatientForm onPhoto → modal abre com zoom slider 1-3x + drag pan (cropShape circular live preview) → confirm gera canvas 512×512 jpeg q0.78 (~50KB). Substitui auto-crop center-square v0.2.0.1.
- **Aceitação:** Validado em release v0.2.0.2 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.2.

### #116 — Header alertas: sino → ícones diretos
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P1 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  HeaderAlertIcon primitive (4 tones: danger/warning/info/update). AppHeader renderiza condicionalmente: AlertCircle pulse (overdue → /?filter=overdue), Users (shares novos → /pacientes), Pill (tratamentos acabando ≤3d → /pacientes), Download (update → startUpdate). Padrão WhatsApp/Gmail. UpdateBanner verde mantido. BellAlerts deprecated.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #119 — Promo free→plus removida client
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P1 cost+truth
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  subscriptionService.getMyTier mapeava free→plus durante beta interno (bypass paywall). Agora: tier vem direto DB via RPC my_tier. Paywall ativo pra users free reais. Reais (lhenrique admin, daffiny+ela pro) não afetados. Mesmo bypass removido em listAllUsers.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #125 — Splash distorcido S25 Ultra
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** BUG-039
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  drawable/splash_icon.png era 3224×1292 stale. Theme.SplashScreen Android 12+ esticava pra preencher safe zone 240dp. Source resources/splash_icon.png já era 1024×1024. Fix: cp resources/splash_icon.png android/app/src/main/res/drawable/splash_icon.png. Bg color #FFF4EC em colors.xml dosy_splash_bg.
- **Aceitação:** Validado em release v0.2.0.4 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.4.

### #152 — ChangePasswordModal em Ajustes
- **Status:** ✅ Concluído @ commit b2f53ff (2026-05-05)
- **Origem:** User request v0.2.0.12
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  ChangePasswordModal.jsx novo. Botão 'Alterar senha' Settings → Conta. Modal padrão Dosy (ícone Lock) + 3 inputs (atual + nova + repetir). Validação inline (≥8 chars, match repeat, atual ≠ nova). Re-autentica via signInWithPassword({email, password: current}) → updateUser({password: nova}). Toast success + close modal.
- **Aceitação:** Validado em release v0.2.0.12 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.12.

### #153 — Recovery senha via OTP 6 dígitos
- **Status:** ✅ Concluído @ commit b2f53ff..31da691 (2026-05-05)
- **Origem:** BUG-041 reformulação
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Substitui magic-link broken #147. useAuth.sendRecoveryOtp(email) → signInWithOtp shouldCreateUser:false. verifyRecoveryOtp(email, token) → verifyOtp type:'email' + flag localStorage dosy_force_password_change=1. Login.jsx 2 sub-modes 'forgot-email' + 'forgot-otp'. App.jsx ForceNewPasswordModal aberto auto via useEffect [user]. Email OTP length 8→6 dígitos. Email template Magic Link customizado pra OTP code. Validado E2E Chrome MCP.
- **Aceitação:** Validado em release v0.2.0.12 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.12.

---

## 🟡 P2 — Média Prioridade (30 dias pós-launch)

### #028 — Rate limit em `delete-account` Edge Function
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Auditoria] (BUG-003)
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Aceitação:** invocar 2x em < 5 min retorna 429.

### #029 — Refatorar `Settings.jsx` (541 LOC) em sub-componentes
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Origem:** [Plan.md] FASE 15 + [Auditoria]
- **Esforço:** 6-8h
- **Aceitação:** orchestrator <100 LOC + 4-5 sections separadas. Tests passam, lint 0 erros.

### #030 — Refatorar `services/notifications.js` (588 LOC) em módulos
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Origem:** [Plan.md SECURITY.md] + [Auditoria]
- **Esforço:** 1-2 dias
- **Aceitação:**
  ```
  services/notifications/fcm.js
  services/notifications/local.js
  services/notifications/critical.js
  hooks/useNotifications.js (orchestration)
  ```

### #031 — Confirmar `FORCE_RLS` em todas as tabelas
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Auditoria] (Dimensão 21)
- **Esforço:** 30 min
- **Aceitação:** rodar SQL em [auditoria/04-supabase.md §15.6](auditoria/04-supabase.md#156-force_rls-em-todas-as-tabelas).

### #032 — Confirmar `SET search_path` em todas as funções SECURITY DEFINER
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Auditoria] (Dimensão 21)
- **Esforço:** 1h
- **Aceitação:** [auditoria/04-supabase.md §15.3](auditoria/04-supabase.md#153-audit-de-security-definer--search_path) — todas as DEFINER têm `SET search_path = medcontrol, pg_temp`.

### #033 — Adicionar React.memo em DoseCard, PatientCard, TreatmentCard
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** [Auditoria] (Dimensão 5)
- **Esforço:** 1h
- **Aceitação:** memoization com prop comparator. React DevTools Profiler confirma redução de re-renders em scroll de listas grandes.

### #034 — Implementar virtualização em DoseHistory + Patients (>200 itens)
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Origem:** [Plan.md] FASE 13 backlog
- **Esforço:** 4-6h
- **Aceitação:** `@tanstack/react-virtual` integrado; lista de 1000 doses scrolla sem jank em device mid-range.

### #035 — Integration tests (`useDoses`, `useUserPrefs` com mock Supabase)
- **Status:** ⏳ Aberto — diferido v0.2.2.0+ (backlog estabilidade pós-rampa Closed Testing)
- **Origem:** [Plan.md] FASE 9.4 backlog
- **Esforço:** 1 dia
- **Aceitação:** 10+ tests cobrindo fluxos confirm/skip/undo + sync localStorage cache.
- **Justificativa diferimento:** Sem testers Closed ativos hoje. Teste integração defende contra regressão durante iteração rápida em resposta a bug reports — útil quando volume de mudança crescer. Implementar antes de Open Testing/Production.

### #036 — Skeleton screens em páginas com lista
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05)
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 1h (refinamento — componente Skeleton já existia #104 v0.2.0.0)
- **Páginas afetadas v0.2.1.0:**
  - ✅ TreatmentList: `loadingTreatments` from `useTreatments()` → SkeletonList count=3 antes empty state
  - ✅ Analytics: `loadingDoses` from `useDoses()` → SkeletonList count=3 entre filter chips e Adesão card
- **Páginas pré-existentes com skeleton (#104 + outros):**
  - Dashboard, Patients, DoseHistory, Admin
- **Não-aplicável (form-based, render imediato sem depender de fetch):**
  - Reports — form date pickers + patient picker + export buttons
  - SOS — form med + paciente + datetime + button
  - PatientForm — form único
  - TreatmentForm — form único
- **Implementação:** import `SkeletonList` de `src/components/Skeleton.jsx`. Render condicional `if (loading) <SkeletonList /> else if (empty) <empty> else <list>`.
- **Resultado UX:** elimina flash "Nenhum tratamento" / "Sem dados no período" durante 100-500ms initial fetch.

### #037 — Erros inline em forms
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 1 dia
- **Aceitação:** PatientForm, TreatmentForm, SOS, Settings com mensagens de erro abaixo de cada campo, não só toast.

### #038 — Pen test interno completo documentado
- **Status:** ⏳ Aberto — diferido v0.2.2.0+ ou pré-Open Testing (#133 gate)
- **Origem:** [Plan.md] FASE 8.4 + 20.3
- **Esforço:** 1-2 dias
- **Aceitação:**
  - User A → user B via API direta (curl) com JWT roubado → falha
  - Tampering APK + Play Integrity (se #047 implementado)
  - Burp/mitmproxy análise tráfego (cert pinning bloqueia)
  - Documento `docs/audits/pentest-interno.md`
- **Justificativa diferimento:** Não bloqueia Closed Testing (audiência controlada). Recomendado executar antes Open Testing público (#133 transição) pra detectar privilege escalation cross-tenant. Item de pré-launch público, não pré-fechado.

### #039 — Confirmação dupla ao deletar batch (>10 itens)
- **Status:** 🚧 Bloqueado (não-aplicável atual) — re-avaliar quando feature batch select existir
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 2h (UI confirm modal trivial) — mas pré-req feature inexistente
- **Pré-requisito ausente:** App hoje delete só 1-by-1 (DoseCard menu, PatientCard menu, TreatmentForm). Não há feature batch select (multi-checkbox + delete em massa) em nenhuma página. Item proposto pressupõe UI batch que não foi implementada.
- **Aceitação (quando feature existir):** quando há >10 itens selecionados para delete, modal "Tem certeza? Esta ação não pode ser desfeita".
- **Decisão:** parquear até batch select ser priorizado. Sem trigger pra implementar isolado.

### #040 — Subir contraste textos secundários no dark
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 2h (revisar `theme.css`)
- **Aceitação:** axe DevTools confirma WCAG AA em todas as pages dark mode.

### #041 — Hierarquia headings + Dynamic Type via `rem` (PARTIAL v0.2.1.0)
- **Status:** 🟡 Parcial v0.2.1.0 — audit headings done; refactor rem diferido v0.2.2.0+
- **v0.2.1.0 done:** auditoria semantic confirmou PageHeader.jsx renderiza `<h1>` (componente reusado por 14/18 pages). Pages com h1 explicit semantic: Privacidade, Termos, Login, Install (4 outras outras usam PageHeader).
- **v0.2.2.0+ deferred:** refactor mass `fontSize: Npx` → `rem` (172 ocorrências entre pages + components). Decisão: baixo ROI no Capacitor Android WebView (system font-scale não afeta WebView por padrão). Alto risco regressão visual. Re-avaliar quando RWD breakpoint upgrade for priorizado.


- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 4h
- **Aceitação:** font-scale 200% Android funciona; headings semânticos h1>h2>h3.

### #042 — Lighthouse mobile ≥90 em Reports + Dashboard (DEFERIDO v0.2.2.0+)
- **Status:** ⏳ Diferido v0.2.2.0+ (não-bloqueante Closed Testing)
- **Justificativa diferimento v0.2.1.0:** audit completo + iterar fixes (~1 dia trabalho). Depende ambiente prod estável + análise profile bundle. Não-bloqueante Closed Testing categoria Saúde e fitness (review padrão). Re-avaliar pré-Open Testing público (#133).


- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 17 manual
- **Esforço:** depende de findings (parcial pode ser 1 dia)
- **Aceitação:** Lighthouse score ≥90 nas duas pages chave.

### #043 — Performance scroll lista 200+ doses sem jank
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 17
- **Esforço:** já coberto por #034 (virtualização)
- **Aceitação:** validar em device mid-range (Samsung A14).

### #044 — Recriar RPC `register_sos_dose` se houve drift schema
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Plan.md] FASE 0.3 (verificar continua)
- **Esforço:** 30 min audit
- **Aceitação:** rodar `tools/test-sos-bypass.cjs` confirma trigger ainda bloqueia INSERT direto type=sos.

### #045 — Auditar `coverage/` no `.gitignore`
- **Status:** ✅ Concluído (release v0.2.0.2)
- **Origem:** [Auditoria] (BUG-010)
- **Esforço:** 5 min
- **Aceitação:** `git check-ignore coverage/` retorna 0.

### #046 — Documentar runbook de Disaster Recovery
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — `docs/runbook-dr.md` v1.0
- **Origem:** [Plan.md] FASE 23.4
- **Esforço:** 1 dia (executado em 1h)
- **Aceitação:**
  - ✅ RTO 5-15min / RPO 24h documentados
  - ✅ Baseline produção snapshot 2026-05-05 (5 users, 582 doses, etc) referência pré-incidente
  - ✅ Procedure restore daily backup Supabase (passos 1-12, smoke test SQL incluído)
  - ✅ Procedure roll JWT secret #084 (compromised key)
  - ✅ Procedure restore keystore Android #021 (3 locais backup)
  - ✅ Procedure region outage Supabase São Paulo
  - ✅ Procedure pós-incidente (timeline + RCA + LGPD art.48 ANPD notification 72h)
  - ✅ 11 components mapeados com failure modes + recovery (DB/Auth/Edge/Realtime/Storage/FCM/Resend/ImprovMX/CDN/AAB)
  - ✅ Drill schedule semestral staging + anual full
  - ✅ Contatos emergência (owner, DPO, Supabase support, Resend, ImprovMX)
  - ✅ Histórico revisões + próximas iterações (v1.1 incident-comm-template, v1.2 PITR re-eval, v1.3 drill executado)

### #047 — Google Play Integrity API
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 11 → 23 backlog
- **Esforço:** 1 dia
- **Aceitação:** APK modificado falha attestation; produção rejeita chamadas sem token válido.

### #048 — `tools/supabase.exe` removido do git (se versionado)
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Auditoria] (Dimensão 24)
- **Esforço:** 30 min (BFG ou git-filter-repo se versionado)
- **Aceitação:** `git ls-files tools/supabase.exe` vazio + `.gitignore` cobre.

### #049 — Pen test profissional (FASE 20)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 20.3
- **Esforço:** depende fornecedor (1-2 semanas)
- **Aceitação:** relatório com severidades; zero crit/high abertos.

### #100 — Avatar emoji redesign categorias
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Origem:** ROADMAP §6 P2 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  PARCIAL: PatientForm AVATAR_GROUPS reorganizado em 6 categorias (Família, Saúde NOVO, Pessoas, Animais, Atividades NOVO, Cores). Saúde inclui emojis médicos. Default '👤' → '🙂' via DEFAULT_AVATAR. Dedup duplicatas. Fallbacks atualizados em PatientAvatar/FilterBar/Dashboard/PatientDetail. Escopo SVG flat tinted + sliders cor + migration parqueado backlog.
- **Aceitação:** Validado em release v0.2.0.11 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.11.

### #104 — Skeleton legacy → Dosy peach
- **Status:** ✅ Concluído @ commit 8e093a0 (2026-05-04)
- **Origem:** ROADMAP §6 P2 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Card primitive bg-elevated + bg-sunken bars + dosy-shadow-xs. SkeletonList migrado de bg-slate-200 azul pra bg-dosy-bg-sunken (peach #FBE9DC) + shimmer warm.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #117 — Alerta paciente compartilhado novo
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P2 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Service listReceivedShares consulta patient_shares WHERE sharedWithUserId = me. Hook useReceivedShares (staleTime 60s, 5min após #141). Header conta shares cujo createdAt > localStorage[dosy_shares_seen_at]. Click → seenAt=now → nav /pacientes. Decay automático.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #118 — Alerta tratamento acabando ≤3 dias
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P2 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Computa endDate = startDate + durationDays*86400000ms em memória (sem coluna nova). Filtra: !isContinuous && status='active' && endDate >= now && endDate-now ≤ 3d. seenAt-based decay igual ao #117. Click → nav /pacientes. EndingSoonSheet componente novo (#118-followup).
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #120 — SharePatientSheet copy plus
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P2 truth
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Copy condicional baseado em tier real. Hardcoded check em SharePatientSheet.jsx:10 mostrava 'Você está no plano Free' pra user Plus. Server-side check OK (RPC APENAS_PRO_COMPARTILHA), apenas client copy errado.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #121 — PaywallModal Escape close
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P2 a11y
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Fix em surfaces.jsx Sheet + Modal: keydown listener Escape chamando onClose. Cobre todos sheets/modals dosy (PaywallModal, SharePatientSheet, EndingSoonSheet, etc).
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #123 — Sessão invalida após DELETE auth.users
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P2 UX/security
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Fix useAuth boot: após getSession(), chama supabase.auth.getUser() (bate na API). Se retornar erro/null, força signOut local + clear cache. Cobre: user deletado, banned, JWT key rotation.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

---

## 🟢 P3 — Melhorias (90 dias)

### #050 — Audit_log abrangente (triggers UPDATE/DELETE)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.2 G12)
- **Esforço:** 1-2 dias

### #051 — 2FA opcional via TOTP
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.4 G10)
- **Esforço:** 1 dia (`auth.mfa.totp.enroll_enabled = true` + UI)

### #052 — Criptografia client-side de `observation`
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.4 G11)
- **Esforço:** 2-3 dias

### #053 — Logout remoto multi-device + tela "Dispositivos conectados"
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5
- **Esforço:** 1-2 dias

### #054 — Notif email + push ao login em device novo
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5
- **Esforço:** 1 dia

### #055 — Session replay (Sentry Replay ou PostHog) — **opcional, privacy concern**
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5
- **Esforço:** 1 dia
- **Risco:** healthcare = revisar antes (pode capturar dados sensíveis). Plan disabled session replay.

### #056 — Visual regression tests (Chromatic/Percy)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.6 G9)

### #057 — Performance budget em CI (size-limit/bundlesize)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5

### #058 — TypeScript migration (ou JSDoc + tsc --checkJs)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.1 G10)

### #059 — `dosy_alarm.mp3` custom sound
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 2.5

### #060 — Detecção root/jailbreak
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23 backlog
- **Aguarda:** plugin community Capacitor 8 maintained

### #061 — Drag-sort de pacientes
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog

### #062 — Anexar comprovantes/imagens em doses (PRO)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 2-3 dias (Supabase Storage policies + UI)

### #063 — Avaliar remoção de `mockStore.js`
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog

### #064 — Verificação de interações medicamentosas + alergia
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 11)
- **Esforço:** 1 semana (banco bulário ANVISA + lógica)
- **Diferenciador healthcare**

### #065 — Estoque + alerta "está acabando"
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 11)
- **Esforço:** 1 semana

### #066 — Lembrete de consulta médica
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 11)

### #067 — DosyMonitorService (FASE 23.7)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.7
- **Esforço:** 1 semana
- **Trigger:** se feedback Open Testing reportar alarms missing em Xiaomi/OnePlus

### #068 — iOS via Capacitor
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.6

### #069 — Internacionalização (en, es)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.6

### #070 — Plano Family (até 5 usuários)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.6

### #071 — Programa afiliados (5-10% recorrente)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.3

### #072 — A/B test paywall e onboarding (PostHog feature flags)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.2

### #073 — Programa de indicação (1 mês PRO grátis)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 22.3

### #155 — Screenshots novos Play Console v0.2.0.12 (Alterar senha + Recuperar senha)
- **Status:** ⏳ Aberto
- **Origem:** Sessão 2026-05-05 release v0.2.0.12 — features senha (#152 + #153) sem cobertura nos screenshots atuais
- **Prioridade:** P3 (cosmético, não-bloqueador release)
- **Esforço:** 30-60min (capturar + curar + upload Console via Chrome MCP)
- **Dependências:** Master merge v0.2.0.12 + AAB publicado Play Store + acesso S25 Ultra real
- **Descrição técnica:**
  Capturar 2 screenshots S25 Ultra device real em build prod pós-merge master:
  1. Tela "Alterar senha" — Ajustes → Conta → click "Alterar senha" → modal Dosy padrão com ícone Lock + 3 inputs preenchidos (atual + nova + repetir) + footer Cancelar/Confirmar
  2. Tela "Recuperar senha — código 6 dígitos" — Login → "Esqueci minha senha" → email digitado → "Enviar código" → step 2 mostra "Código enviado para X. Digite os 6 dígitos abaixo." + input 000000 placeholder + Confirmar código + Reenviar código
  Resolução S25 Ultra: 1080×2340 OR 1440×3088. Crop pra remover status bar/nav bar via Android Studio device frame OU keep full conforme padrão atual.
- **Aceitação:**
  - 2 screenshots novos curados em `resources/prints/processado/v0.2.0.12-XX-{senha-ajustes,senha-recuperar}.png`
  - Upload Play Console → Listagem da loja → Smartphones → adicionar (sem remover existentes)
  - Pendente revisão Google (junto com próximas mudanças marketing)
- **Detalhe:** Não-bloqueador. Pode ser feito em batch com outras atualizações store quando houver mudança visual significativa.
- **Plus opcional:** atualizar feature graphic 1024×500 OU vídeo demo se disponível ROI.

### #122 — AppHeader greeting trunca nome
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P3 cosmético
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Substituído firstName por shortName em userDisplay.js: retorna primeira+segunda palavra se ambas ≤6 chars (cobre 'Teste Free', 'Teste Plus'), senão só primeira.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #075 — Reduzir agressividade React Query global (mitiga lentidão geral)
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01)
- **Origem:** [Sessão v0.1.7.0] Análise lentidão reportada pelo user
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Severidade:** alta — combina com #023 + #076 pra fix completo de lentidão/travamento
- **Snippet:**
  ```js
  // src/main.jsx — defaultOptions atual:
  // staleTime: 0
  // refetchOnMount: 'always'
  // refetchOnWindowFocus: true
  //
  // Mudar para:
  staleTime: 30_000,           // 30s — cache fresh por 30s, evita refetch redundante
  refetchOnMount: true,        // só se stale (não 'always')
  refetchOnWindowFocus: true,  // mantém — útil pós-idle curto
  ```
- **Aceitação:**
  - Navegação interna entre pages não dispara refetch se query foi feita há <30s
  - Volta de aba ainda refresh (refetchOnWindowFocus mantido)
  - DoseModal abre rápido (não espera refetch redundante)
  - Lint passa
- **Riscos:**
  - Alarme/notif: zero (config TanStack ≠ alarme nativo Android que vive em SharedPreferences)
  - Realtime: zero (websocket independente)
  - Stale data 30s: aceitável pra healthcare; doses mudam minutos, não segundos

### #076 — Refatorar useAppResume — recovery sem reload destrutivo
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01) — validado live: app recupera URL+state ao voltar foco, sem cold reload. Mitigação parcial do BUG-016 (não previne perda de notif idle, só recovery UX).
- **Origem:** [Sessão v0.1.7.0] User reportou "app trava após ficar aberto muito tempo"
- **Esforço:** 2h
- **Dependências:** nenhuma
- **Severidade:** alta — causa raiz do travamento observado
- **Causa atual:** após 5min idle, `useAppResume.js` força `window.location.href = '/'`. Isso causa cold reload + perda de URL + tela branca 1-3s + cascata de refetch. Se algo falhar nesse reload (SW velho, JWT expirado, race condition), app fica em estado quebrado até hard close de Chrome.
- **Snippet (proposta):**
  ```js
  // src/hooks/useAppResume.js
  // Antes: window.location.href = '/'  (destrutivo)
  // Depois: cleanup + invalidate + reconnect realtime, preservando URL
  if (inactiveMs >= STALE_RELOAD_THRESHOLD_MS) {
    console.log('[useAppResume] long idle', inactiveMs, 'ms → soft recover')
    // 1. Force JWT refresh (Supabase rotaciona refresh token)
    await supabase.auth.refreshSession()
    // 2. Force realtime reconnect (drops dead websockets)
    supabase.removeAllChannels()
    // 3. Invalidate all queries — refetch fresh
    await qc.invalidateQueries()
    // 4. Refetch active queries
    await qc.refetchQueries({ type: 'active' })
    // URL preservada. Sem reload.
  }
  ```
- **Aceitação:**
  - App fica aberto 15min idle → volta foco → não força reload
  - Estado UI preservado (url, modais abertos, scroll position)
  - Doses recentes carregam (queries refetched)
  - Realtime resubscribe (dose tomada em outro device aparece)
  - Manual: device físico Android + 30min idle + voltar → app responde sem cold start
- **Riscos:**
  - Alarme nativo: zero (vive separado em AlarmReceiver + SharedPreferences)
  - Notif FCM: zero (background handler separado)
  - Edge case: se `supabase.auth.refreshSession()` falhar (refresh token expirado), redirect pra login (já handled em supabase.js auth listener)
- **Detalhe:** BUG-016 catalogado em `auditoria-live-2026-05-01/` (nova pasta criada na sessão se necessário)

### #077 — Listener TOKEN_REFRESHED em useRealtime (resubscribe pós JWT rotation)
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01)
- **Origem:** [Sessão v0.1.7.0]
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Severidade:** média — robustez. Sem isso, websocket pode morrer silenciosamente após Supabase rotacionar JWT (default 1h)
- **Snippet:**
  ```js
  // src/hooks/useRealtime.js — adicionar dentro do useEffect
  const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
      unsubscribe()
      subscribe()
    }
  })
  // cleanup: authSub.subscription.unsubscribe()
  ```
- **Aceitação:**
  - Forçar JWT refresh (via `supabase.auth.refreshSession()` no console) → realtime resubscribe ocorre
  - Console log mostra resubscribe disparado
  - Dose tomada em device A após 1h+ aparece em device B (longe-evita)
- **Riscos:** zero — adiciona robustez

### #078 — Bumpar SW cache version v5 → v6 (invalidar bundles velhos)
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01)
- **Origem:** [Sessão v0.1.7.0]
- **Esforço:** 5 min
- **Dependências:** nenhuma
- **Severidade:** baixa — limpeza. SW pode estar servindo bundle velho de v0.1.6.x se cache não rotaciona
- **Snippet:**
  ```js
  // public/sw.js linha 1
  // ANTES: const CACHE = 'medcontrol-v5'
  // DEPOIS: const CACHE = 'medcontrol-v6'
  ```
- **Aceitação:**
  - Após próximo deploy, SW activate event deleta cache `medcontrol-v5` e cria `medcontrol-v6`
  - Devices com bundle velho cached forçam download fresh
- **Convenção:** bumpar a cada release com mudança de bundle JS (esquecer = bug serve velho). **TODO:** automatizar em vite plugin (P2 futuro).

### #079 — Realtime heartbeat keep-alive — caminho 1 de 3 (defense-in-depth)
- **Status:** ✅ Concluído @ commit b4812e0 (2026-05-01) — release v0.1.7.1
- **Origem:** [auditoria-live-2026-05-01] BUG-016 — push + alarme não disparam após 16min idle. Premissa universal: muitos users (cuidadores, pais, profissionais, idosos) deixam app aberto em background — idle deve ser ilimitado.
- **Esforço:** 2-3h (impl + teste device físico)
- **Dependências:** nenhuma
- **Severidade:** P0 — healthcare-critical (dose perdida = paciente sem medicação)
- **Causa-raiz:** websocket Supabase realtime morre silenciosamente durante idle longo Android (Doze + OS network management). Sem heartbeat, sem detecção de conexão morta. App não recebe `postgres_changes` de novas doses → não agenda alarme nativo.
- **Snippet (proposta):**
  ```js
  // src/hooks/useRealtime.js — adicionar dentro do useEffect, após channel.subscribe()
  let pingTimer, pongTimer, heartbeatActive = false
  const startHeartbeat = () => {
    if (heartbeatActive) return
    heartbeatActive = true
    const tick = () => {
      // Ping interno do client Supabase
      pongTimer = setTimeout(() => {
        // Sem pong em 5s → reconnect
        console.warn('[useRealtime] heartbeat timeout — reconnecting')
        unsubscribe()
        subscribe()
        startHeartbeat()
      }, 5_000)
      // Trigger ping (se v2 supabase-js suportar)
      channel?.send({ type: 'broadcast', event: 'ping', payload: {} })
      pingTimer = setTimeout(tick, 30_000)
    }
    pingTimer = setTimeout(tick, 30_000)
    channel?.on('broadcast', { event: 'pong' }, () => clearTimeout(pongTimer))
  }
  startHeartbeat()
  // Cleanup: clearTimeout(pingTimer); clearTimeout(pongTimer)
  ```
- **Alternativa:** investigar `RealtimeClient` do supabase-js — pode já ter heartbeat configurável (`heartbeatIntervalMs`).
- **Aceitação:**
  - App idle por 30min em device físico: dose criada via DB direto APARECE no app sem precisar abrir
  - Alarme nativo agendado dentro de 30s da inserção DB
  - Reconnect automático ao detectar silent fail (logs Sentry: `[useRealtime] heartbeat timeout`)
- **Riscos:**
  - Battery drain — heartbeat 30s é leve mas existe. Considerar pausar em `appStateChange isActive=false` no Android nativo (já pausa hoje) e validar que retoma corretamente
  - Network mobile flaky — ping/pong em 3G ruim pode falsar timeout. Tunear thresholds via teste real
- **Detalhe:** [auditoria-live-2026-05-01/bugs-encontrados.md#bug-016](auditoria-live-2026-05-01/bugs-encontrados.md#bug-016)

### #080 — notify-doses reliability — caminho 2 de 3 (defense-in-depth)
- **Status:** ✅ Concluído @ commit 4b82d16 (2026-05-01) — release v0.1.7.1
- **Origem:** [auditoria-live-2026-05-01] BUG-016
- **Esforço:** 3-4h (investigação + fix + dashboard)
- **Dependências:** acesso aos logs Edge Function (PAT precisa scope `read_logs` ou via Supabase Dashboard manual)
- **Severidade:** P0 — fail-safe server-side falhou, healthcare-critical
- **Sintomas observados (BUG-016):**
  - Dose 18:55 BRT (criada 18:39 via REST direto): nem realtime, nem alarme nativo, nem push FCM
  - Dose 18:58 BRT com user recém-ativo: push chegou normal
  - 2 push_subscriptions registradas pro user (token rotation gerou múltiplos)
  - advanceMins=0 → janela ±60s no Edge query
- **Aceitação:**
  - Logs Edge `notify-doses` últimas 24h analisados — confirmar se cron rodou pra cada dose perdida
  - Implementar retry com exponential backoff em falha FCM transitória (`UNAVAILABLE`, `INTERNAL`)
  - Cleanup `push_subscriptions.deviceToken` em response FCM `INVALID_ARGUMENT` / `UNREGISTERED` (token expirado)
  - Dashboard PostHog/Sentry: alerta queda push delivery rate <99% em 1h (já item #007 + #016)
  - Métrica `notify-doses` por execução: count enviados, count sucessos, count falhas + reason
- **Investigação inicial:**
  - Confirmar `pg_cron.job_run_details` mostra cron rodou às 18:54-18:56
  - Confirmar Edge response = 200 + `sent: N` apropriado
  - Se cron OK + Edge OK + push não chegou → problema FCM-side ou token Android
- **Detalhe:** [auditoria-live-2026-05-01/bugs-encontrados.md#bug-016](auditoria-live-2026-05-01/bugs-encontrados.md#bug-016)

### #081 — Defense-in-depth Android: alarmes nativos horizonte 24-72h — caminho 3 de 3
- **Status:** ✅ Concluído @ commit 49550e4 (2026-05-01) — release v0.1.7.1. **Gate validação device 24h idle FECHADO 2026-05-02** — alarme dose teste tocou após Dosy Dev fechado por 24h sem abrir, confirmando defense-in-depth #083 funciona end-to-end real. BUG-016 100% resolvido.
- **Validação 24h idle pendente (gate final):**
  - User mantém Dosy Dev INSTALADO mas FECHADO por 1 dia inteiro (24h sem abrir)
  - Pré-test: user cadastra dose +24-30h via web (Vercel prod) ANTES fechar app
  - Esperado: alarme físico dispara no horário sem nunca user ter aberto Dosy Dev nesse intervalo
  - Confirma caminhos #083 funcionam end-to-end com app realmente idle longo (não só ~minutos)
  - Caminhos validados: 1 (trigger DB <2s), 2 (cron 6h FCM data), 4 (WorkManager 6h). Caminho 3 (rescheduleAll quando app abre) é sobre re-agendar AO ABRIR — não testado neste cenário (app fica fechado).
  - Resultado positivo → marcar #081 nota "Gate 3 em andamento" como ✅ definitivo + log em updates/
  - Resultado negativo → reabrir investigação (qual caminho falhou? logs Sentry/PostHog/Edge?)
- **Origem:** [auditoria-live-2026-05-01] BUG-016 — defense-in-depth healthcare healthcare-critical
- **Esforço:** 6-8h (impl plugin + WorkManager + teste device físico)
- **Dependências:** nenhuma
- **Severidade:** P0 — caminho mais robusto. Independe de app foreground / websocket / push.
- **Princípio:** Sistema atual depende de 1 caminho (app ativo). Muitos users deixam app aberto background, mas Android pode kill mesmo assim. Solução: agendar alarmes locais com horizonte FUTURO ao invés de só "próxima dose".
- **Estratégia:**
  1. Quando app abre / sincroniza: plugin `criticalAlarm` agenda TODAS doses dos próximos 24-72h via `setAlarmClock()` (sobrevive Doze)
  2. SharedPreferences armazena lista. `BootReceiver` re-agenda após reboot (já existe)
  3. **Novo:** `WorkManager` periódico (a cada 6-12h) sincroniza DB → reagenda alarmes recém-criados sem precisar app foreground
  4. `WorkManager` requer `WorkRequest` com `setInitialDelay` + `setPeriodic`. Bateria-friendly.
- **Snippet conceitual (Java/Kotlin Android):**
  ```java
  // android/app/src/main/java/.../DoseSyncWorker.java
  public class DoseSyncWorker extends Worker {
      public Result doWork() {
          // 1. Fetch doses próximos 72h via Supabase REST (auth via stored token)
          // 2. Diff com SharedPreferences cache
          // 3. setAlarmClock() pra novas doses, cancelAlarm() pra removidas
          return Result.success();
      }
  }
  // Schedule:
  PeriodicWorkRequest sync = new PeriodicWorkRequest.Builder(
      DoseSyncWorker.class, 6, TimeUnit.HOURS).build();
  WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
      "dose-sync", ExistingPeriodicWorkPolicy.KEEP, sync);
  ```
- **Aceitação:**
  - App fechado por 48h em device físico
  - Doses criadas via DB direto chegam até 72h depois
  - Alarme nativo dispara conforme schedule, mesmo SEM app NUNCA ter sido aberto
  - WorkManager log mostra runs periódicos no `adb shell dumpsys jobscheduler`
- **Riscos:**
  - Bateria: WorkManager a cada 6h é leve mas existir. Threshold ajustável.
  - OEMs hostis (Xiaomi/MIUI): WorkManager pode ser killed. Mitigação: combinação com `setAlarmClock()` que bypassa Doze por design.
  - Duplicação de alarmes: cuidado com idempotência ao reagendar.
- **Detalhe:** [auditoria-live-2026-05-01/bugs-encontrados.md#bug-016](auditoria-live-2026-05-01/bugs-encontrados.md#bug-016)

### #083 — FCM-driven alarm scheduling + 4 caminhos coordenados (idempotente)
- **Status:** ✅ Concluído @ commits `23deca4` + `3465ab6` + `26c51ab` (2026-05-02) — release v0.1.7.2. Validado end-to-end: cadastro web → trigger DB → Edge FCM → device agendou alarme nativo → alarme físico tocou no Android no horário.
- **Origem:** [Sessão v0.1.7.1] User pedido: "alarme funcionar mesmo sem abrir app, dose +1mês precisa tocar"
- **Esforço:** ~6-8h (Edge + Android nativo + migration + testes)
- **Dependências:** #079 #080 #081 já fechados; nenhuma externa
- **Severidade:** P0 — healthcare-critical, fecha BUG-016 100%

#### Arquitetura — 4 caminhos coordenados pra agendar alarme nativo

Cada caminho roda independente. **Idempotência via id determinístico** (`AlarmScheduler.idFromString(doseId)` — mesmo id = substitui, nunca duplica). User vê **1 alarme** mesmo se 4 caminhos tentarem agendar.

| # | Caminho | Quando dispara | Cobertura | Latência |
|---|---|---|---|---|
| **1** | Trigger DB Supabase ON INSERT/UPDATE doses | Imediato ao cadastrar/editar dose | "+30min via web, app fechado" | <2s |
| **2** | Cron Edge 6h `notify-doses-schedule` | Sweep periódico | Garantia caso trigger falhou; doses 72h adiante | até 6h |
| **3** | App `rescheduleAll()` quando abre | Toda vez user abre app | Redundância adicional | imediato |
| **4** | WorkManager DoseSyncWorker (#081 atual) | A cada 6h em background | Backup se FCM falhar entrega | até 6h |

#### Notificação push tray — fallback inteligente

> Filosofia user: "se dose tiver alarme setado, ok; se não, manda push"

- **Hoje:** `notify-doses` cron 1min manda push tray sempre (~advanceMins antes da dose)
- **Novo:** cron antes de mandar push, consulta tabela `dose_alarms_scheduled (doseId, userId, deviceId)`:
  - Se row existe → device já tem alarme nativo agendado → **skip push** (alarme fullscreen cobre)
  - Se row ausente → push é única chance → manda push tray normal

Comportamento prático user:
- Caso ideal: alarme nativo agendado → device toca despertador fullscreen no horário, sem push tray redundante
- Caso fallback: alarme não foi agendado (caminhos 1-4 falharam todos) → push tray dispara como única notificação — user vê algo, mesmo que menos crítico

#### Componentes a implementar

**A. Database migration `20260502xxxxxx_dose_alarms_scheduled.sql`:**
```sql
CREATE TABLE medcontrol.dose_alarms_scheduled (
  "doseId" uuid REFERENCES medcontrol.doses(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL,
  "deviceId" text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("doseId", "deviceId")
);
-- RLS: service_role only
```

**B. Edge Function NOVA `schedule-alarms-fcm` (cron 6h):**
- Pra cada user com push_subscription ativa, busca doses pendentes próximas 72h
- Manda FCM **data message** `{"action": "schedule_alarms", "doses": [{...}]}` pra deviceToken
- **NÃO inclui notification payload** (silencioso, só wake-up)
- Atualiza `dose_alarms_scheduled` (especulativo — assume FCM entrega)

**C. Edge Function NOVA `dose-trigger-handler` (Postgres webhook trigger):**
- Trigger ON INSERT/UPDATE em `medcontrol.doses` chama essa função
- Lógica idêntica a `schedule-alarms-fcm` mas pra dose única recém-cadastrada

**D. Edge `notify-doses` (modificada):**
- Antes de enviar push tray, query `dose_alarms_scheduled` por doseId+deviceId
- Se row existe → skip
- Se não → manda push (mantém comportamento atual)

**E. Android `FirebaseMessagingService` (handler novo):**
```java
@Override
public void onMessageReceived(RemoteMessage msg) {
  Map<String, String> data = msg.getData();
  if ("schedule_alarms".equals(data.get("action"))) {
    JSONArray doses = new JSONArray(data.get("doses"));
    for (JSONObject d : doses) {
      AlarmScheduler.scheduleDose(ctx, idFromString(d.getString("doseId")),
          parseInstant(d.getString("scheduledAt")), d);
      // Reporta ao server
      reportAlarmScheduled(ctx, d.getString("doseId"), getDeviceId());
    }
  } else {
    super.onMessageReceived(msg); // notification message — handler default
  }
}
```

**F. Android `criticalAlarm` plugin:**
- Novo método `reportAlarmScheduled(doseId)` chama Supabase REST insert dose_alarms_scheduled
- Auth via SharedPreferences (já temos via #081)

**G. App `rescheduleAll` (modificado):**
- Após agendar local: também upsert `dose_alarms_scheduled` (defesa em camadas)

#### Aceitação

1. ✅ User cadastra dose +1 mês via web. Não abre app Android. 1 mês depois alarme dispara fullscreen.
2. ✅ User cadastra dose +30min via web. Trigger manda FCM data <2s. Device agenda. 30min depois despertador toca.
3. ✅ User cadastra dose +5min via web (advanceMins=5). FCM data + cron notify-doses ambos rodam. Device agenda alarme via FCM data. Cron notify-doses ANTES de mandar push tray detecta alarme já agendado e skip — user vê apenas despertador, sem push redundante.
4. ✅ Device offline durante FCM data send. Volta online 2h depois. Cron 6h re-tenta + entrega. Device agenda. Alarme funciona.
5. ✅ User cadastra dose +5min via web. Push FCM data falha entrega total (rate limit). Cron `notify-doses` 1min detecta dose em janela, alarme NÃO agendado → manda push tray. User vê notif "dose em 1min" como fallback.
6. ✅ User abre app após 1 semana. App roda rescheduleAll. Verifica quais doses já tem alarme agendado (via local SharedPreferences). Adiciona apenas as faltantes. **Sem duplicar.**
7. ✅ 4 caminhos tentam agendar mesma dose. AlarmScheduler.scheduleDose com mesmo id = replace. user vê 1 alarme.

#### Riscos / mitigação

- **FCM data message pode ter delivery delay** (Doze mode estendido) — mitigação: cron 6h sweep + WorkManager #081 + rescheduleAll quando app abre = 4 caminhos
- **DB trigger pode falhar silenciosamente** — mitigação: cron 6h pega no próximo ciclo
- **Bateria** — wake-up FCM data 4×/dia + cron sync = baixo impacto (Slack/WhatsApp fazem dezenas/dia)
- **Latência cron 6h pra dose +30min "via web app fechado"** — mitigação: trigger DB cobre <2s

#### Implementação faseada (sub-items se quiser quebrar)

- #083.1 Migration `dose_alarms_scheduled`
- #083.2 Edge `schedule-alarms-fcm` cron 6h
- #083.3 Edge `dose-trigger-handler` + Postgres trigger
- #083.4 `notify-doses` modificação (skip se alarme agendado)
- #083.5 Android FirebaseMessagingService handler
- #083.6 `criticalAlarm` plugin: reportAlarmScheduled method
- #083.7 App rescheduleAll: upsert dose_alarms_scheduled
- #083.8 Validação device físico (idle 1 semana sem abrir app)

### #082 — Dual-app Android: Dosy Dev + Dosy oficial coexistem
- **Status:** ✅ Concluído @ commit 5b5938e (2026-05-01) — release v0.1.7.1
- **Origem:** [Sessão v0.1.7.1] User pedido: "ambiente dev independente, fácil merge em Dosy quando release"
- **Esforço:** 1h (Gradle + Firebase entry + manifest)
- **Implementação:**
  - `android/app/build.gradle`: buildTypes.debug com `applicationIdSuffix .dev` + resValue app_name "Dosy Dev"
  - `android/app/build.gradle`: buildTypes.release com resValue app_name "Dosy"
  - Firebase Console: nova app entry `com.dosyapp.dosy.dev` (registrada via Console)
  - `android/app/src/debug/google-services.json`: novo (Firebase plugin auto-escolhe por buildType)
  - `AndroidManifest.xml`: `${appLabel}` placeholder (substituído conforme variant)
  - `build.gradle`: dep `com.google.guava:guava:33.4.0-android` (resolve Worker.startWork() ListenableFuture compileClasspath)
- **Aceitação:**
  - Studio Run debug → instala "Dosy Dev" (`com.dosyapp.dosy.dev`) no device
  - Build release → AAB "Dosy" (`com.dosyapp.dosy`) pra Play Store
  - Apps coexistem no mesmo device, dados isolados
  - Push FCM funciona em dev (Firebase entry .dev separada)
- **Validado:** Gate 1 (build OK + instalou) ✅ via Android Studio Run em emulador

### #074 — Habilitar upload de debug symbols no Play Console
- **Status:** ✅ Concluído (release v0.2.0.2)
- **Origem:** [Sessão v0.1.6.10] Aviso recorrente Play Console
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Severidade:** baixa — não bloqueia release; melhora qualidade de stack traces de crashes/ANRs no Console
- **Snippet:**
  ```gradle
  // android/app/build.gradle dentro de android { ... }
  android {
      buildTypes {
          release {
              ndk {
                  debugSymbolLevel 'FULL'  // ou 'SYMBOL_TABLE' (mais leve)
              }
          }
      }
  }
  ```
- **Aceitação:**
  - Próximo AAB build inclui símbolos de depuração nativos
  - Play Console não exibe mais aviso "App Bundle contém código nativo, e você não fez upload dos símbolos de depuração"
  - Crashes nativos no Console mostram stack traces simbolicados em vez de offsets brutos
- **Detalhe:** Aviso aparece em todo upload AAB enquanto não habilitado. Sem impacto no usuário final; só dev observability. Tamanho AAB sobe ~5-10 MB com FULL.

---

### #084 — Hotfix v0.1.7.5: rotação service_role JWT + JWT secret Supabase + reconectar Vercel↔GitHub
- **Status:** ✅ Concluído (release v0.1.7.5)
- **Origem:** INCIDENTE 2026-05-02 22:23 UTC. Migration `20260502091000_dose_trigger_webhook.sql` (commit original `85d5e61`) foi commitada com service_role JWT inline. GitGuardian + GitHub Security flagged em ~6min. Histórico do branch reescrito via `git-filter-repo` + force push (commit `6310c1e`). Tag `pre-secret-purge-backup` empurrada origin como referência.
- **Severidade:** P0 security — service_role bypassa RLS = exposição teórica de TODOS dados saúde de TODOS users (LGPD categoria especial). Chave permanece em GitHub commit cache + indexers externos (Google cache, Wayback, etc) por tempo indeterminado.
- **Esforço:** ~30-60min (sessão dedicada)
- **Dependências:** nenhuma (independente)

#### Janela de exposição

- **Leak:** 2026-05-02 ~22:23 UTC (push original `85d5e61`)
- **Purge:** 2026-05-02 ~22:29 UTC (force push `6310c1e`)
- **Window in-repo:** ~6min
- **Window cache externo:** indeterminado (continua exposta)

#### Plan de execução — divisão autônomo / user

> **Filosofia:** agente faz tudo que não é destrutivo-irrecuperável ou prohibited safety-rule. User só clica botão final irreversível ou autoriza OAuth.

**FASE 0 — Pre-checks (autônomo agente):**
- [ ] Confirmar branch: criar `release/v0.1.7.3` a partir de master atualizada
- [ ] Verificar `.env.local` tem `VITE_SUPABASE_ANON_KEY` legível pra registrar valor velho (pra audit)
- [ ] `git fetch origin && git status` clean
- [ ] Verificar Vercel CLI auth (`vercel whoami` deve retornar `lhenriquepda`)

**FASE 1 — Auditar logs janela leak (autônomo agente, via PAT):**
- [ ] Query Supabase logs Auth + REST janela 22:23-22:29 UTC
- [ ] Query `auth.audit_log_entries` mesma janela
- [ ] Comparar com baseline (sessão anterior idle period) — uso anômalo?
- [ ] Reportar achados antes prosseguir rotação

**FASE 1.5 — Audit secrets adicionais no histórico (autônomo agente):**
> Defense-in-depth: garantir que rotação JWT é o ÚNICO leak. Outros tipos de
> credenciais (PAT, service account JSON, Firebase keys, VAPID, etc) podem
> ter vazado em commits diferentes sem detection ainda.
- [ ] `git log --all --full-history -p -- supabase/migrations/ | grep -iE "jwt|service_role|sbp_|sk-|api[_-]key|password|secret"`
- [ ] `git log --all --full-history -p -- .env* supabase/functions/ | grep -iE "key|secret|token"`
- [ ] Buscar em refs órfãos: `git fsck --lost-found` + inspect
- [ ] Verificar tags com conteúdo sensível: `pre-secret-purge-backup` (já confirmada limpa em audit 2026-05-02 11:50 UTC)
- [ ] Listar resultado consolidado em `contexto/updates/{data}-release-v0.1.7.3.md` antes prosseguir

**FASE 2 — Reconectar Vercel↔GitHub (guided via Claude in Chrome):**
- [ ] Agente navega `https://vercel.com/lhenriquepdas-projects/dosy/settings/git`
- [ ] Agente clica botão "GitHub" pra iniciar reconexão
- [ ] **USER ACTION:** autoriza OAuth Vercel↔GitHub (pelas regras safety, OAuth login = só user)
- [ ] **USER ACTION:** seleciona repo `lhenriquepda/medcontrol_v2`
- [ ] Agente confirma webhook ativo via deployments page
- [ ] Agente push commit vazio teste pra confirmar auto-deploy dispara

**FASE 3 — Rotação JWT secret (guided via Claude in Chrome):**
- [ ] Agente navega Supabase Dashboard → projeto dosy-app → Settings → API
- [ ] Agente localiza botão "Generate a new JWT secret" / "Roll JWT Secret"
- [ ] Agente expande/lê confirmação dialog (preview destruction message)
- [ ] **USER ACTION:** clica botão Roll (irreversível) + confirma dialog
- [ ] Agente copia novos valores: `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (NUNCA log no chat — só persist em arquivos protegidos)

**FASE 4 — Atualizar env vars (autônomo agente):**
- [ ] Vercel CLI: `vercel env rm VITE_SUPABASE_ANON_KEY production` (3 envs: prod/preview/dev)
- [ ] Vercel CLI: `vercel env add VITE_SUPABASE_ANON_KEY production` (cole valor novo)
- [ ] Repetir pra preview + development
- [ ] Atualizar `.env.local` (não-commitado, gitignored) — anon key novo
- [ ] **USER ACTION:** confirmar não há outras máquinas dev pendentes
- [ ] Atualizar `SUPABASE_SERVICE_ROLE_KEY` em Edge Functions secrets:
  - Via Supabase Dashboard → Edge Functions → Secrets, OR
  - Via Supabase CLI: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... --project-ref guefraaqbkcehofchnrc`

**FASE 5 — Redeploy infra (autônomo agente):**
- [ ] Vercel CLI: `vercel --prod --force` (rebuild com env nova)
- [ ] Edge Functions redeploy (todas que usam service_role): `supabase functions deploy --project-ref guefraaqbkcehofchnrc` lista relevant
- [ ] Confirmar Vercel prod respondendo 200 em `https://dosy-teal.vercel.app/ajustes`

**FASE 6 — Rebuild Android (parcialmente guided):**
- [ ] Agente atualiza `android/app/src/main/assets/capacitor.config.json` se necessário (verificar se anon key não está baked)
- [ ] Agente verifica `src/services/supabase.js` lê `import.meta.env.VITE_SUPABASE_ANON_KEY` (não hardcoded)
- [ ] Bump versão patch: 0.1.7.2 → 0.1.7.3 (package.json + gradle versionCode 27)
- [ ] **USER ACTION:** Android Studio Build → Generate Signed Bundle (release variant)
- [ ] **USER ACTION:** confirma AAB pronto em `android/app/release/app-release.aab`
- [ ] Agente upload AAB Play Console via Claude in Chrome (mesmo fluxo de v0.1.7.2)
- [ ] **USER ACTION:** confirma "Salvar e publicar" no Console

**FASE 7 — Verificação pós-rotação (autônomo agente):**
- [ ] Test: query Supabase com chave VELHA → deve retornar 401/403
- [ ] Test: query Supabase com chave NOVA → deve retornar 200
- [ ] Test: login Vercel prod (`https://dosy-teal.vercel.app`) com `teste03@teste.com / 123456` → fluxo completo
- [ ] Test: device físico Dosy Dev (instalado v0.1.7.2-dev) — login + cadastrar dose teste → alarme dispara?
  - **Nota:** Dosy Dev tem chave VELHA baked → vai falhar até reinstall. Esperado. Reinstall via Studio Run após FASE 6.
- [ ] Auditar logs Supabase 1h pós-rotação — qualquer 401 inesperado de cliente legítimo?

**FASE 8 — Cleanup + release v0.1.7.3 (autônomo agente):**
- [ ] Merge `release/v0.1.7.3` → master (--no-ff) + tag `v0.1.7.3` + push
- [ ] Atualizar `contexto/`: ROADMAP §3+§12, PROJETO.md versão, README.md "Estado atual"
- [ ] Criar `contexto/updates/2026-05-XX-release-v0.1.7.3.md` com log completo + audit findings
- [ ] Marcar #084 ✅ Concluído em CHECKLIST + ROADMAP
- [ ] Decrementar P0: 7 → 6
- [ ] Deletar `release/v0.1.7.3` local + remote
- [ ] (Opcional) Deletar tag `pre-secret-purge-backup` se audit confirmou zero uso anômalo

**FASE 8.5 — Resolution alerts security dashboards (guided via Claude in Chrome):**
> Após rotação confirmada, marcar alertas como "resolved/revoked" pra fechar
> ticket. Chave vazada continua existindo em commit cache GitHub + indexers
> externos, mas perde valor (rotation = chave inválida server-side).
- [ ] **GitHub Security:** navega `https://github.com/lhenriquepda/medcontrol_v2/security/secret-scanning`
  - Localiza alerta "Supabase Service Key" (commit 85d5e614)
  - Click "Close as" → "Revoked" (chave já rotacionada)
  - Add comment: "Rotated v0.1.7.3 hotfix on YYYY-MM-DD"
- [ ] **GitGuardian:** navega `https://dashboard.gitguardian.com` (login via GitHub OAuth)
  - Localiza alerta `Supabase Service Role JWT` no repo medcontrol_v2
  - Marcar "Resolved" → motivo "Secret revoked"
- [ ] (Opcional) **GitHub Support:** abrir ticket pra purgar commit cache órfão `85d5e614`
  - Endpoint: `https://support.github.com/contact/private-information`
  - Justificar: secret credential exposed, request commit deletion from cache
  - Não-bloqueante (rotation já mitiga risco efetivo)
- [ ] Verificar 24h depois: alertas permanecem fechados, novos não disparam

#### Aceitação

- Chave velha retorna 401/403 em qualquer endpoint
- Chave nova funciona em Vercel prod + Edge Functions + APK Dosy Dev (após reinstall)
- Logs Supabase janela leak auditados — relatório de uso anômalo (0 ou N) em `updates/`
- Vercel↔GitHub reconectado: push pra master dispara auto-deploy
- AAB v0.1.7.3 publicado Play Store Internal Testing
- 3 ambientes sincronizados (master + Vercel prod + Play Store) versionados v0.1.7.3
- `pre-secret-purge-backup` tag mantida ou deletada conforme audit

#### Risk register

| Risco | Mitigação |
|---|---|
| Dosy oficial Play Store users com chave velha → 401 até auto-update | Auto-update Android é rápido pra Internal Testing (<24h). User comunica testers se notar. |
| Edge Function downtime entre roll e redeploy | Redeploy imediato após rotação. Idle ~2min. |
| Vercel env update falha → prod fica com chave inválida | Dry-run env update + verify ANTES rebuild. Rollback: revert env via dashboard. |
| User cliente caches anon key velha em IndexedDB | Service worker bump cache version força refresh. |
| OAuth Vercel↔GitHub falha | Fallback: continuar `vercel --prod` CLI até sessão futura. |

- **Detalhe completo:** ver `contexto/updates/2026-05-02-release-v0.1.7.2.md` (incident report).

---

### #085 — BUG-018: Alarme Crítico OFF em Ajustes mas alarme tocou
- **Status:** ✅ Concluído @ commit f22f5a9 (2026-05-02)
- **Origem:** Reportado user 2026-05-02 pós install v0.1.7.2. User toggle OFF em Ajustes → cadastrou dose teste → alarme nativo fullscreen disparou (não deveria — esperado: apenas notificação push tray).
- **Severidade:** P1 healthcare-adjacent (trust violation user setting + LGPD/privacy implications quanto user opta por menos intrusão)
- **Esforço:** ~3-5h (auditar 4 caminhos + criar source-of-truth + testes)
- **Dependências:** nenhuma (independente, mas #087 DND UX depende disso)

#### Diagnóstico provável

Toggle "Alarme Crítico" não está sendo respeitado em algum dos 4 caminhos coordenados de #083. Suspeitos:

| Caminho | Onde verificar | Risco |
|---|---|---|
| 1. Trigger DB (Edge `dose-trigger-handler`) | Edge consulta user prefs antes mandar FCM data com `scheduleAlarm:true`? | Alto — Edge talvez ignora flag |
| 2. Cron 6h (Edge `schedule-alarms-fcm`) | Mesma checagem? | Alto |
| 3. App `rescheduleAll()` | `criticalAlarm.js` consulta useUserPrefs antes scheduling? | Médio |
| 4. WorkManager DoseSyncWorker | Worker consulta SharedPreferences flag antes setAlarmClock? | Alto (é background, sem React state) |

#### Investigação inicial

- [ ] Reproduzir: toggle OFF Ajustes → cadastrar dose +1min → confirmar alarme fullscreen disparou
- [ ] Inspecionar `useUserPrefs.js` — qual key salva o toggle? Persiste em DB ou só local?
- [ ] Inspecionar Edge `dose-trigger-handler/index.ts` — query user prefs antes responder?
- [ ] Inspecionar Edge `schedule-alarms-fcm/index.ts` — mesmo
- [ ] Inspecionar `src/services/criticalAlarm.js` — `scheduleAlarm()` consulta prefs?
- [ ] Inspecionar `DoseSyncWorker.java` (Android) — lê SharedPreferences `criticalAlarmEnabled`?
- [ ] Inspecionar `DosyMessagingService.onMessageReceived` — lê flag antes de chamar `AlarmScheduler.schedule()`?

#### Solução

Single source of truth: flag persistida em `medcontrol.user_prefs.critical_alarm_enabled` (DB) + cached SharedPreferences Android.

- Cliente UI: ao toggle, atualiza ambos (DB + local cache via SharedPreferences plugin)
- Edge functions: leem `user_prefs.critical_alarm_enabled` antes mandar FCM data com `scheduleAlarm:true`. Se OFF, mandam só `pushNotification:true` (tray fallback).
- AlarmScheduler.schedule() (Android nativo): consulta SharedPreferences cache antes setAlarmClock. Se OFF, no-op (push tray cobre).
- `criticalAlarm.js` (web/Capacitor): mesma checagem antes de chamar plugin.

#### Aceitação

- [ ] Toggle OFF Ajustes → cadastrar dose → push tray dispara, **alarme fullscreen NÃO** dispara em nenhum dos 4 caminhos
- [ ] Toggle ON novamente → alarme fullscreen dispara normalmente
- [ ] Dose já agendada (com toggle ON) + user toggle OFF depois → próxima dose: respeita OFF (cancelar alarme nativo agendado se necessário)
- [ ] Test cobre todos 4 caminhos: trigger DB, cron 6h, rescheduleAll, WorkManager
- [ ] Logs Sentry/PostHog telemetria: zero `critical_alarm_fired_when_disabled`

---

### #086 — BUG-019: Resumo Diário não funciona — nunca dispara
- **Status:** ⏸️ Bloqueado — parqueado pra v0.1.8.0 (caminho B). UI ocultada em v0.1.7.3 (commit pending).
- **Origem:** Reportado user 2026-05-02. Feature configurada em Ajustes (horário definido) mas user nunca recebeu notificação no horário marcado.
- **Severidade:** P1 broken feature user-facing
- **Esforço:** ~2-4h (depende de fix vs parquear)
- **Dependências:** nenhuma

#### Diagnóstico provável

Feature pode ter quebrado em qualquer ponto end-to-end:

1. Persistência horário em prefs/DB — config salva?
2. Mecanismo agendamento — pg_cron job? Edge cron? AlarmManager local? WorkManager?
3. Trigger lógica — chega na hora, calcula payload, manda push
4. FCM token ativo + channel notif Android registrado
5. UI Ajustes — horário exibido bate com persistido?

#### Investigação inicial

- [ ] Localizar onde feature está implementada (UI Ajustes, service, Edge, cron)
- [ ] Inspecionar `pages/Settings.jsx` — campo horário salva em qual key?
- [ ] Inspecionar `useUserPrefs` — `daily_summary_time` ou similar persiste em DB?
- [ ] Buscar Edge function relevante (`daily-summary`?, `notify-doses`?)
- [ ] Verificar pg_cron jobs ativos: `SELECT * FROM cron.job` no Supabase
- [ ] Sentry/logs: erro nas execuções? Job nem roda?
- [ ] FCM token user — registrado? Chegando push de teste em outras features?

#### Decisão branch points

- **Caminho A — Feature broken end-to-end mas baixa complexidade:** fix em v0.1.7.3
- **Caminho B — Feature precisa retrabalho significativo:** parquear pra v0.1.8.0 + esconder UI até pronto + comunicar user ✅ ESCOLHIDO
- **Caminho C — Feature funciona, mas user-side issue (FCM token expirado, channel mutado):** dx fix + telemetria preventiva

#### Decisão tomada (2026-05-02): Caminho B

Investigação concluída em src/services/notifications.js:312-338. Resumo diário
implementado client-side via Capacitor LocalNotifications. Schedule
{ every: 'day' } depende de:
- App abrir pelo menos 1x pra rescheduleAll() agendar
- Sobreviver Doze mode Android

Sem cron server-side equivalente (não há Edge `daily-summary-cron`). User idle
nunca recebe.

Para fix completo precisaria:
- Migration nova: tabela `daily_summary_log` (PK userId+date) pra idempotência
- Edge function `daily-summary-cron`
- Schedule pg_cron 1x/hora chamando Edge
- Timezone handling per-user (default America/Sao_Paulo, mas pode haver users
  fora — tabela user_prefs sem coluna timezone atualmente)
- Push tray formatting + payload

Esforço: ~3-5h. Escopo grande pra hotfix v0.1.7.3 (focado #084 security +
#085/#087 toggle bypass).

**Ação v0.1.7.3:** ocultar UI Resumo Diário em Settings.jsx pra user não
esperar feature broken. Toggle + horário continuam persistidos em DB se
setados antes; apenas não-renderizados.

**Próxima sessão v0.1.8.0:** quebrar #086 em sub-itens (#086.1 migration,
#086.2 Edge, #086.3 cron schedule, #086.4 timezone field, #086.5 reativar
UI) e implementar.

#### Aceitação

- [ ] User configura resumo diário às HH:MM em Ajustes
- [ ] No horário marcado (±1min), notificação push tray chega
- [ ] Conteúdo resumo bate com adesão últimas 24h: doses programadas, tomadas, perdidas, próximas
- [ ] Se feature parqueada (caminho B): UI esconde toggle + nota "em breve" + ROADMAP item v0.1.8.0 criado

---

### #087 — BUG-020: DND verificar funcional + UX condicional ao Alarme Crítico
- **Status:** ✅ Concluído @ commit f22f5a9 (2026-05-02)
- **Origem:** Reportado user 2026-05-02. Solicitação dupla: (1) verificar se Não Perturbe atual respeita janela horária configurada; (2) refactor UX condicional.
- **Severidade:** P1 UX healthcare-adjacent
- **Esforço:** ~3-4h (verificação + UX refactor)
- **Dependências:** **#085 deve fechar primeiro** — toggle parent precisa funcionar pra UX condicional fazer sentido.

#### Verificação funcional (parte 1)

- [ ] Inspecionar implementação atual DND em `pages/Settings.jsx` + `services/notifications.js` + `criticalAlarm.js`
- [ ] DND tem campos: hora início + hora fim + flag enabled?
- [ ] Quando alarme deveria disparar dentro da janela DND, qual comportamento atual? (silencia, vibra só, bypassa, nada)
- [ ] Reproduzir: configurar DND 22:00-08:00 → criar dose 02:00 → testar comportamento
- [ ] Documentar comportamento atual antes de refactorar

#### Refactor UX condicional (parte 2)

Comportamento desejado por user:
- Toggle pai: **Alarme Crítico** (Ajustes raiz)
  - **OFF:** apenas push notification tray (sem alarme fullscreen). DND option **NÃO aparece** na UI.
  - **ON:** alarme fullscreen ativo. **DND option aparece** abaixo:
    - DND toggle: enabled / disabled
    - Se enabled: campos horário início + fim
    - Comportamento: dentro da janela DND, **Alarme Crítico desativa** (push tray cobre como fallback). Fora da janela: Alarme Crítico normal.

#### Componentes afetados

- `pages/Settings.jsx` — render condicional DND section
- `useUserPrefs.js` — hook com novos fields se ainda não existirem
- Migration DB — adicionar `dnd_start_time`, `dnd_end_time`, `dnd_enabled` em `user_prefs` (se ainda não)
- Edge functions + AlarmScheduler — checar janela DND antes scheduling (mesmo source-of-truth #085)

#### Aceitação

- [ ] Alarme Crítico OFF → DND option não aparece na UI
- [ ] Alarme Crítico ON → DND option aparece com toggle + campos horário
- [ ] DND ON + janela 22:00-08:00 → criar dose 02:00 → push tray dispara, alarme fullscreen não
- [ ] DND OFF (com Alarme Crítico ON) → alarme fullscreen normal independente de horário
- [ ] DND ON com janela inválida (start > end, atravessa meia-noite) é tratado corretamente
- [ ] Persistência DB OK — relogar mantém config

### #127 — CI failing (lint errors react-hooks pré-existentes em AnimatedRoutes.jsx)
- **Status:** ✅ Concluído (2026-05-05)
- **Origem:** descoberto durante validação #008 (2026-05-04)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ 2 errors `react-hooks/refs` resolvidos (`Cannot access refs during render`)
  - ✅ Fix: substituído `useRef('forward')` (directionRef + prevPathRef) por `useState(location.pathname)` (prevPath) + computa `direction` puro durante render
  - ✅ `npm run lint` retorna 0 errors (61 warnings — todos pré-existentes ou heurística react-compiler padrão codebase)
  - ✅ Build prod ok (`npm run build` 32s)
  - ⏸ GitHub CI workflow Lint+Test+Build vai passar no próximo push (validação automática)
  - ⏸ Sentry source maps upload rodará automaticamente após próximo CI bem-sucedido (libera #008 aceitação completa)
- **Impacto resolvido:** CI verde → source maps Sentry sobem → crash investigation pós-launch com stack trace symbolicado.

### #128 — BUG-040: Multi-dose alarm mostra só 1 medicamento + paciente "Sem Paciente"
- **Status:** ✅ Concluído @ commit 559004b (2026-05-05)
- **Origem:** reproduzido S25 Ultra Dosy Dev v0.2.0.7 durante captura assets #025 (2026-05-04)
- **Esforço:** 2-4h (investigação + fix + reteste device)
- **Dependências:** nenhuma
- **Aceitação:**
  - Reproduzir: cadastrar 6 doses simultâneas (`scheduledAt` idêntico) distribuídas entre 2 pacientes — 3 Lucas + 3 Maria — confirma que ainda mostra só 1 med + "Sem Paciente"
  - Fix: AlarmActivity render multi-dose deve listar TODAS doses agendadas pra mesmo `scheduledAt` (com nome paciente correto cada uma) — não só uma
  - Validar nome paciente preenchido em qualquer caminho (Receiver / Activity / Service)
  - Re-teste S25 Ultra: 6 doses simultâneas → tela Alarme mostra 6 itens com nome de cada paciente
- **Hipóteses iniciais:**
  - (a) `AlarmReceiver` agrupa doses pelo `scheduledAt` exato mas falha quando 2 pacientes diferentes — group key pode estar derivando só do timestamp e perdendo lista patientId/medName
  - (b) FCM data path entrega só 1 dose ID no payload (não array completo) → AlarmActivity carrega só essa
  - (c) Patient name lookup no Activity falha (RPC call falha → fallback "Sem Paciente")
  - (d) `AlarmScheduler` agenda múltiplos `setAlarmClock()` mas só primeiro dispara, others suprimidos pelo OS por timing idêntico
- **Investigar primeiro:**
  - Logs `adb logcat` filtro `AlarmReceiver|AlarmActivity|AlarmService|AlarmScheduler|DosyMessagingService` durante repro
  - DB: `SELECT id, "patientId", "medName" FROM doses WHERE "scheduledAt" = X` confirma 6 doses no DB
  - Conferir se Realtime entregou todas 6 ao app antes do alarme disparar
  - Conferir Edge `notify-doses` logs — quantos FCM envelopes foram enviados (1 com array vs 6 separados?)
- **Detalhe:** Bug isolado fora de auditoria formal. Catalogar em `auditoria-live-2026-05-04/` se virar item recorrente. Por hora só ROADMAP.
- **P1 healthcare-adjacent** (trust violation: usuário não vê todas medicações que precisa tomar; LGPD-adjacent: paciente perde identificação da dose).

---

## Plano Closed Testing externo (decisão user 2026-05-05)

**User decidiu pular recrutamento Internal Testing com pessoas conhecidas (família/amigos) e ir direto ao Closed Testing recrutando testers externos via Google Group público + Reddit/redes.** Internal Testing fica live (ele + agente) só pra validação técnica, não pra coleta de feedback.

Gate Google: ≥12 testers ativos × 14 dias antes de Open Testing.

### #129 — Criar Google Group público `dosy-testers`
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — via Chrome MCP dosy.med@gmail.com
- **Origem:** Estratégia recrutamento Closed Testing 2026-05-05
- **Esforço:** 10 min (Chrome MCP automation + 1 captcha manual user)
- **Dependências:** nenhuma
- **Resolução:**
  - Grupo criado: **`Dosy Testers`** · email `dosy-testers@googlegroups.com` · owner Dosy Med LTDA
  - URL pública: **https://groups.google.com/g/dosy-testers** (HTTP 200 anônimo verificado)
  - Configurações:
    - "Quem pode pesquisar pelo grupo" → ✅ Qualquer pessoa da web (discovery via search/Reddit)
    - "Quem pode participar do grupo" → ✅ Qualquer pessoa pode participar (auto-aprovação)
    - "Quem pode ver as conversas / postar / ver os membros" → Participantes do grupo (privacy testers reports)
  - Descrição: "Grupo público de testers do Dosy (app de controle de medicação, Android). Membros recebem acesso opt-in à fase Closed Testing via Play Store. Auto-aprovação ativa. Site: https://dosymed.app"
- **Próximo:** #130 importar email group `dosy-testers@googlegroups.com` em Closed Testing track Play Console.

### #130 — Configurar Closed Testing track no Console com Group como tester list
- **Status:** ✅ APROVADO Google 2026-05-06 (track ATIVO desde então). Rejeição inicial 2026-05-05 (org account required) resolvida via #158 fixes v0.2.1.2 (Console 13 declarações Apps de saúde desmarcadas Medicina + categoria medical→saude/fitness + manifest categories medical→lifestyle). Google revisou + aprovou Closed Testing track "Alpha". AABs vc 49-51 publicados Internal e promovidos Closed. Desbloqueia #131 #132 #133.
- **Origem:** Estratégia recrutamento Closed Testing 2026-05-05
- **Esforço:** 30 min config Console + 1h cross-checks pré-submit
- **Dependências:** #129 (✅ done) + #156 página privacidade
- **Progresso v0.2.1.0 (Chrome MCP):**
  - ✅ Faixa "Teste fechado - Alpha" pré-existente reutilizada
  - ✅ País Brasil selecionado + salvo
  - ✅ Tester list: Grupos do Google → `dosy-testers@googlegroups.com`
  - ✅ Endereço feedback URL: `https://groups.google.com/g/dosy-testers`
  - ✅ Versão criada: AAB **v0.2.0.12 vc 45** (vc 44 removido — estava conflitando)
  - ✅ Release notes pt-BR: "v0.2.0.12 — Recuperação de senha por código de 6 dígitos via email + Trocar senha em Ajustes + melhorias internas (egress -50%, alarme multi-paciente fixed). Beta fechado: ajude a testar o controle de medicação e reporte bugs em https://groups.google.com/g/dosy-testers"
  - ✅ Rascunho salvo (Step 2 "Visualizar e confirmar" — 0 erros, 1 aviso)
  - ✅ **Side-effects pré-publicação resolvidos in-line:**
    - Categoria do app: **Saúde e fitness** (Console → Configurações da loja, publicado). Trocada de Medicina v0.2.1.0 (2026-05-05) — audiência Dosy é consumer self-care/cuidador, não profissional clínico; "Saúde e fitness" alinhado com peers (Medisafe, MyTherapy) + escrutinio Google razoável + discoverability maior.
    - Detalhes contato: email `contato@dosymed.app` + site `https://dosymed.app` (publicado direto Google Play)
- **Pendente pré-submit Google review:**
  - ⏳ #156: criar/atualizar página `https://dosymed.app/privacidade` (URL referenciada nas 14 mudanças pendentes)
  - ⏳ Verificar HTTP 200 dos URLs `/privacidade` antes click "Enviar 14 mudanças para revisão"
  - ⏳ Conferir status questionários Conteúdo (Classificação, Público-alvo, Segurança dados, Intent tela cheia) — possivelmente já preenchidos releases passadas
  - ⏳ Confirmação user explícita pra submeter (irreversível, dispara review Google 1-7 dias)
- **Submit final 2026-05-05 23:14 BRT:** Console → "Enviar 14 mudanças para revisão" → Google review iniciado.
- **Resultado submit (2026-05-05 23:30 BRT):** ❌ **REJEITADO**. Mensagem Google: "App rejeitado — O envio recente do seu app foi rejeitado por não obedecer às políticas do Google Play. Política de requisitos do Play Console: Violação dos requisitos do Play Console. Seu app não obedece à política de requisitos do Play Console. Alguns tipos de apps só podem ser distribuídos por organizações. Você selecionou uma categoria do app ou declarou que o app oferece recursos que exigem o envio usando uma conta de organização." Aplicado em 6 de mai. App não disponível Google Play até resolver.
- **Diagnóstico provável:** alguma das declarações de Conteúdo do app (App de saúde + Permissões alarme exato + Serviços primeiro plano + Recursos financeiros + Apps governamentais + ID publicidade) ativou gate "requires organization account" do Google. Mais provável: combo "App de saúde" + "Saúde e fitness" categoria + medication tracking features = Google interpreta como app médico sensível requerendo CNPJ.
- **Path resolução** (item dedicado **#158** abaixo):
  - **Opção A:** criar conta Google Play Developer empresarial (CNPJ + verification documents + $25 USD nova taxa) → transferir app `com.dosyapp.dosy` da conta pessoal pra empresarial via Console "Transferir um app" workflow (1-3 semanas, complex paperwork)
  - **Opção B:** reverter declarações específicas no Conteúdo do app pra desativar gate organização → re-submit. Risco: app perde algumas certifications (ex.: Saúde e fitness) e pode necessitar refactor features médico
  - **Opção C:** apelar diretamente Google via formulário "Entrar em contato com o suporte" explicando que Dosy é app de auto-cuidado consumer, não app médico profissional, requesting reclassification

### #131 — Recrutar testers externos via Reddit + redes (meta 15-20 inscritos)
- **Status:** ⏳ Aberto
- **Origem:** Estratégia recrutamento Closed Testing 2026-05-05
- **Esforço:** 1-2h posts iniciais + acompanhamento semanal
- **Dependências:** #129 + #130 (precisa Group + opt-in URL antes)
- **Aceitação:**
  - Posts em r/AlphaAndBetausers, r/SideProject, r/brasil, r/desenvolvimentopt
  - Posts targeted: r/medicina, r/saude, r/tdah, r/diabetes (público-alvo cuidadores)
  - Compartilhamento Twitter/X + LinkedIn pessoal
  - Discord Indie Hackers BR + comunidades QA Android
  - Template post: "[Beta tester] Dosy — app Android pra organizar medicação família/idosos. Diferencial: alarme estilo despertador (ignora silencioso). Grátis. Link Google Group: {URL} → após entrar instala via {opt-in Console}"
  - Meta: 15-20 inscritos (folga pq alguns não testam)
  - Acompanhar contador "testadores ativos" no Console

### #132 — Gate Closed Testing: 14 dias rodando com ≥12 testadores ativos
- **Status:** ⏳ Aberto
- **Origem:** Regra Google 2023+ pra contas novas
- **Esforço:** 14 dias passivos + iteração semanal de feedback
- **Dependências:** #131
- **Aceitação:**
  - Console mostra ≥12 testadores ativos por ≥14 dias consecutivos
  - Sentry: 0 crashes críticos novos durante janela
  - Iterar bugs reportados em mini-releases v0.2.0.x conforme aparecerem
  - Gate Console habilita "Solicitar acesso de produção"

### #133 — Solicitar acesso Open Testing / Produção
- **Status:** ⏳ Aberto
- **Origem:** Pós #132 gate
- **Esforço:** 1h (preencher form Console + responder perguntas Google)
- **Dependências:** #132
- **Aceitação:**
  - Console → Solicitar acesso de produção → preencher questionário sobre teste fechado
  - Aguardar aprovação Google (~24-72h)
  - Após aprovação: Open Testing fica disponível com link público (sem lista) OU promover direto pra Production
  - Decidir estratégia: passar por Open Testing 7-14 dias OU produção rollout 5%→100%

---

## Plano fixes egress (auditoria 2026-05-05)

> **Detalhes em** `contexto/egress-audit-2026-05-05/README.md`. Egress 35.79 GB / 5 GB Free (715%). Grace expira 06 May. Fix #092 v0.1.7.5 cobriu apenas ~30%. Causa raiz: `invalidateQueries()` em massa em events não-data-related (visibility/focus/resume) + Realtime sem debounce.

### #134 — `useAppResume` remover invalidate em short idle, scopear long idle
- **Status:** ✅ Concluído @ commit e3d0d93 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F1
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** -30% a -45%
- **Aceitação:**
  - `src/hooks/useAppResume.js:58` (`qc.invalidateQueries()` em short idle <5min) — REMOVER. Realtime + refetchInterval cobrem.
  - Long idle (>=5min) já faz `refetchQueries({ type: 'active' })` — não precisa também `invalidateQueries()` antes (line 49).
  - Manter `refreshSession` + `removeAllChannels` em long idle.
- **Risco UX:** dados podem aparecer 30-120s mais "antigos" se Realtime não trouxer update; aceitável vs economia.

### #135 — `useRealtime` resume nativo: remover invalidate ALL keys
- **Status:** ✅ Concluído @ commit e3d0d93 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F6
- **Esforço:** 10 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** -5% a -10%
- **Aceitação:**
  - `src/hooks/useRealtime.js:180-182` — remover loop `qc.invalidateQueries`. Resubscribe + Realtime postgres_changes events tomam conta updates pós-resume.
- **Risco UX:** zero.

### #136 — `useRealtime` postgres_changes: debounce invalidate 1s
- **Status:** ✅ Concluído @ commit e3d0d93 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F2
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Impacto egress estimado:** -15% a -25% (especialmente dias de cron extend)
- **Aceitação:**
  - `src/hooks/useRealtime.js:113-119` — wrap `qc.invalidateQueries` em debounce 1000ms por table.
  - Implementação: timeout + flag por queryKey, ou `lodash.debounce`.
- **Risco UX:** atualização cross-device até 1s extra. Healthcare app — não-crítico.

### #137 — Dashboard: consolidar 4 useDoses em 1
- **Status:** ✅ Concluído @ commit 0124608 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F3
- **Esforço:** 2h
- **Dependências:** nenhuma
- **Impacto egress estimado:** -20% a -30%
- **Aceitação:**
  - `src/pages/Dashboard.jsx:85, 116, 118, 123` — substituir 4 hooks por 1 `useDoses({from: -30d, to: +14d})`. Filtros visuais via `useMemo` client-side.
  - Calcular `pendingToday`, `overdueNow`, `weekAdherence` em memória sobre array único.
- **Risco UX:** Dashboard 1 round-trip em vez de 4. Mais rápido.

### #138 — `DOSE_COLS_LIST` sem `observation`
- **Status:** ✅ Concluído @ commit 0813d94 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F4
- **Esforço:** 1h (incluindo verificação Reports/Analytics)
- **Dependências:** nenhuma
- **Impacto egress estimado:** -15% a -30% no payload listDoses
- **Aceitação:**
  - `src/services/dosesService.js` — criar `DOSE_COLS_LIST` (10 cols sem observation) pra `listDoses`. Manter `DOSE_COLS_FULL` pra `getDose` detail.
  - Verificar Reports.jsx, Analytics.jsx, DoseHistory.jsx — se exibem observation em lista, adaptar (lazy-load via getDose ao expandir).
  - Análoga à mudança #115 (PATIENT_COLS_LIST/FULL).
- **Risco UX:** zero — UI lista não exibe observation.

### #139 — `dose-trigger-handler` skip se scheduledAt > 6h futuro
- **Status:** ✅ Concluído @ commit bf45f80 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F7
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** Edge invocations -50-70%
- **Aceitação:**
  - `supabase/functions/dose-trigger-handler/index.ts:103-106` — adicionar early return se `scheduledAt > now + 6h`. Cron 6h `schedule-alarms-fcm` cobre.
- **Risco UX:** zero. Alarme nativo agendado pelo cron 6h antes da dose.

### #140 — `schedule-alarms-fcm` HORIZON 72h → 24h
- **Status:** ✅ Concluído @ commit bf45f80 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F8
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** payload FCM 3× menor
- **Aceitação:**
  - `supabase/functions/schedule-alarms-fcm/index.ts` — `HORIZON_HOURS = 24` (era 72). Cron 6h × 4 ciclos cobre 24h com folga.
- **Risco UX:** zero.

### #141 — `useReceivedShares` staleTime 60s → 5min
- **Status:** ✅ Concluído @ commit bf45f80 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F10
- **Esforço:** 5 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** pequeno mas free win
- **Aceitação:**
  - `src/hooks/useShares.js` `useReceivedShares` — `staleTime: 5 * 60_000`.
- **Risco UX:** novo share notif pode demorar até 5min em aparecer. Aceitável (shares raros).

### #142 — Rotacionar JWT cron `schedule-alarms-fcm-6h` + refatorar pra usar vault/env
- **Status:** ✅ Segurança fechada (2026-05-05) — cleanup cosmético deferido
- **Confirmação:**
  - Supabase Dashboard → Settings → JWT Keys → Legacy JWT Secret = **REVOKED** ("No new JSON Web Tokens are issued nor verified with it by Supabase products")
  - PostgREST com JWT antigo: **HTTP 401** (verificado via curl `/rest/v1/doses?...`)
  - Edge function continua 200 OK pq é pública (`verify_jwt: false`), executa com `SERVICE_ROLE_KEY` env separada do JWT do header
  - Atacante com JWT vazado NÃO consegue privilege escalation (DB queries via PostgREST barram)
- **Cleanup deferido pra v0.2.0.10 (cosmético, não-security):**
  - JWT hardcoded no cron job 3 ainda existe mas não é validado por nada
  - Substituir por `vault.read_secret('SUPABASE_SERVICE_ROLE_KEY')` ou remover header (Edge function ignora)
  - Refactor pra usar `supabase_functions.http_request()` (passa apikey automaticamente)
- **Origem:** egress-audit-2026-05-05 F11 (security)
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Impacto egress:** zero (security-only)
- **Aceitação:**
  - Drop cron job `schedule-alarms-fcm-6h` atual.
  - Recriar usando `vault.read_secret('SUPABASE_SERVICE_ROLE_KEY')` ou `supabase_functions.http_request` (passa service key automaticamente).
  - Rotate JWT secret se ainda válido (verificar via test request com JWT antigo).
- **Risco:** zero funcional. Critical security fix.

### #143 — `useUserPrefs.queryFn`: `getSession()` em vez de `getUser()`
- **Status:** ✅ Concluído @ commit bf45f80 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F9
- **Esforço:** 15 min
- **Impacto egress estimado:** -1 round-trip auth por refetch useUserPrefs
- **Aceitação:** trocar `supabase.auth.getUser()` por `supabase.auth.getSession()` em `src/hooks/useUserPrefs.js:50`.

### #144 — Custom JWT claim `tier` via Auth Hook (longo prazo)
- **Status:** ✅ Concluído @ commit 54e0d0a (2026-05-05)
- **Origem:** egress-audit-2026-05-05
- **Esforço:** 4-6h (Auth Hook setup + client refactor)
- **Impacto egress estimado:** elimina round-trip useMyTier
- **Aceitação:** Auth Hook custom claim → JWT carrega `tier` → client lê localmente.

### #145 — `useRealtime` watchdog: invalidate só se data divergente
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Esforço:** 1h
- **Impacto egress estimado:** -5% mobile flaky
- **Aceitação:** watchdog compara timestamp último change broadcast vs `qc.getQueryState('doses').dataUpdatedAt`. Só invalidate se diff significativo.

### #146 — `pg_cron extend_continuous_treatments`: confirmar batch INSERT
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Esforço:** 30 min audit
- **Aceitação:** verificar se INSERTs são single multi-row (1 webhook total) ou N inserts (N webhooks). Otimizar pra 1.

### #147 — BUG-041: Recuperação de senha email link aponta pra localhost / erro
- **Status:** ✅ Concluído @ commit b2f53ff (2026-05-05)
- **Origem:** Reportado user 2026-05-05 ao tentar recuperar senha esposa Daffiny.
- **Esforço:** 1-3h investigação + fix Site URL config + test mobile/web
- **Workaround temp 2026-05-05:** Daffiny senha resetada via SQL direto (`UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf'))` + DELETE auth.sessions). Login fresh com nova senha.
- **Bug:** email recovery do Supabase contém link redirect — clicado leva pra "localhost" ou tela de erro. Não consegue concluir reset password.
- **Hipóteses:**
  - (a) Supabase Auth Settings → URL Configuration → Site URL apontando pra `localhost:5173` ou stale (deveria ser `https://dosymed.app`)
  - (b) Redirect Allow List não inclui `https://dosymed.app/reset-password` ou `dosy://reset-password`
  - (c) Code em `useAuth.jsx:resetPassword` passa `redirectTo` mas Supabase ignora se não estiver no allow list → fallback pra Site URL (localhost)
  - (d) Email template Supabase tem URL placeholder hardcoded errado
- **Investigar:**
  - https://supabase.com/dashboard/project/guefraaqbkcehofchnrc/auth/url-configuration
  - Site URL atual + Redirect URLs allow list
  - Email Templates (Recovery template HTML)
  - useAuth.jsx:199-202 redirectTo logic web vs mobile
  - App.jsx:234-260 deep link handler `dosy://reset-password` Capacitor
- **Reformulação v0.2.1.0:**
  - Decisão: trocar fluxo magic-link por OTP code (6 dígitos enviado por email/SMS) — mais simples + funciona offline + sem dependência de redirect URL config
  - Página `/reset-password` recebe input OTP + nova senha
  - OR: SSO Google obrigatório (já implementado via OAuth) reduz necessidade reset password manual
- **Aceitação fix temporária (se v0.2.1.0 demorar):**
  - Fix Site URL config Supabase Dashboard
  - Add `https://dosymed.app/*` + `dosy://*` em Redirect Allow List
  - Test fluxo end-to-end: solicitar email → clicar link → cair em /reset-password → preencher nova senha → login

---

## Resumo

- **P0:** 9 itens — restantes: 6 abertos após fechamento de #001/#002/#005 em v0.1.6.10
- **P1:** 22 itens (#010-027 + #075-#078 v0.1.7.0) · esforço estimado: ~10-15 dias-pessoa
- **P2:** 22 itens (#028-049) · esforço estimado: ~3-4 semanas-pessoa
- **P0 v0.1.7.1:** #079 #080 #081 healthcare-critical (defense-in-depth notif idle ilimitado)
- **P3:** 25 itens (#050-073, #074) · esforço estimado: 90+ dias

**Soft-launch (P0+P1):** ~15-20 dias-pessoa.
**Produção pública (após Open Testing 14 dias + #001-027):** ~6 semanas total.

---

## Sequência sugerida

```
Sem 1: P0 #001-005 + #007 + #008 (segurança + UTF-8 + telemetria)
Sem 2: P0 #004 vídeo + #006 device validation + P1 #010-016
Sem 3: P1 #017-022 + Closed Testing #027 inicia
Sem 4: P1 #023-026 + iteração feedback + Closed dia 7
Sem 5-6: Closed Testing dia 14 + P2 começo + Open Testing
Sem 7+: Produção rollout 5%→100% + P2 + P3 backlog
```

→ Ver `ROADMAP.md` para versão consolidada com links cruzados.

---

### #156 — Atualizar página `https://dosymed.app/privacidade` (LGPD healthcare)
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — DESBLOQUEIA #130 submit Google review
- **Origem:** Sessão 2026-05-05 v0.2.1.0 — descoberta durante setup Closed Testing track Console (mudança pendente "Definir o URL da Política de Privacidade como https://dosymed.app/privacidade")
- **Esforço:** 2-3h (escrever conteúdo LGPD healthcare + criar rota + linkar UI)
- **Dependências:** #026 email `privacidade@dosymed.app` provisionado (DPO contato)
- **Aceitação:**
  - URL `https://dosymed.app/privacidade` retorna HTTP 200
  - Conteúdo cobre LGPD para healthcare (controle medicação):
    - **Identificação controlador:** Dosy Med LTDA + DPO `privacidade@dosymed.app`
    - **Dados coletados:**
      - Auth: email + senha hash (Supabase Auth)
      - Saúde sensível (LGPD art.5-II + art.11): pacientes, doses, tratamentos, observações, fotos paciente
      - Técnicos: FCM token push, user agent, IP (logs Supabase)
      - Telemetria: PostHog events anonimizados (não-PII)
    - **Finalidades:** alarmes lembrete medicação, sincronização multi-device, recuperação senha
    - **Bases legais LGPD:** consentimento (art.7-I, registro signup) + cuidado saúde (art.11-II-f) + execução contrato (Plus tier)
    - **Compartilhamento:** Supabase (cloud storage criptografado SSE), Google FCM (push delivery), Resend (transactional email recovery), PostHog (analytics anônima), Sentry (error tracking)
    - **Internacional:** Supabase São Paulo (BR) — dados em jurisdição brasileira
    - **Retenção:** até deletar conta via app (Settings → Excluir conta, #028 fechado)
    - **Direitos titular (LGPD art.18):** acesso, retificação, eliminação, portabilidade, anonimização, revogação consentimento — exercício via `privacidade@dosymed.app`
    - **Crianças/adolescentes:** uso por responsável legal (cuidador) — política específica art.14
    - **Cookies/storage:** localStorage para cache UI + secure storage Android Keystore para tokens
    - **Última atualização:** 2026-05-05
  - Linkado: Settings → Privacidade + Termos.jsx (referência cruzada) + footer Login + ToS página
- **Implementação executada:** Privacidade.jsx (React route já existia v0.2.0.0, atualizado conteúdo v0.2.1.0). Rota `/privacidade` confirmada em App.jsx linha 298. SPA fallback Vercel resolve via index.html → React Router → Privacidade lazy-loaded.

**Mudanças v0.2.1.0 (2 passes):**

**Pass 1 v1.1 (initial):**
- Email DPO: `dosy.privacidade@gmail.com` → `privacidade@dosymed.app` + outros 4 aliases
- Entidade: "pessoa física" → "Dosy Med LTDA"
- Terceiros expandidos: Resend, PostHog, Sentry, AdMob, FCM
- Versão v1.0 → v1.1
- Termos.jsx + FAQ.jsx idem

**Pass 2 v1.2 (deep audit Play Store Health Apps Policy):**
- **Estrutura expandida 11 → 15 seções** com cobertura completa
- **§1 Controlador**: contato granular (DPO + suporte + legal + security + contato geral)
- **§2 Dados coletados** reorganizado em 4 sub-categorias: identificação, sensíveis saúde, técnicos, telemetria anônima
  - Adicionou: foto paciente, peso, alergias, condição médica, médico, anotações cuidador
  - Adicionou: SOS rules (intervalos, max 24h)
  - Adicionou: `patient_shares` table (compartilhamento entre usuários #117)
  - Adicionou: tier subscription history
  - Adicionou: rate-limit triggers em security_events
- **§3 Finalidades + bases legais por finalidade**: 7 finalidades mapeadas (lembrete medicação Art.7-V+11-II-f, sharing Art.7-I, recovery Art.7-V, histórico Art.7-V+11-II-f, auditoria Art.7-IX, telemetria Art.7-IX, ads Art.7-IX)
  - "Não fazemos" list explícita: venda, perfilamento publicitário, scoring saúde, share seguradoras
- **§4 Sub-processadores**: tabela 10 providers (Supabase, FCM, AdMob, Play Billing, Resend, PostHog, Sentry, Vercel, Hostinger, ImprovMX) com finalidade + região + base de adequação (sa-east-1 BR para Supabase, Cláusulas-padrão LGPD para US/EU)
  - Cobre transferência internacional Art. 33-V LGPD
- **§5 Direitos LGPD**: lista completa Art.18 (10 direitos) + reclamação ANPD link gov.br/anpd
- **§6 Segurança**: criptografia em repouso AES-256 (era ausente), App Lock biométrico (#017), Android Keystore hardware-backed, JWT secret rotation procedure (#084), backup diário 7-day rolling RPO 24h RTO 5-15min ref runbook DR (#046)
- **§7 Retenção**: granular por tipo (FCM tokens revogados limpeza semanal, compartilhamentos pendentes 30d, observações > 3y anonimização, conta deletada < 30d + backups 7d adicional)
- **§8 Cookies/storage**: enumera localStorage + Android Keystore + sessionStorage + IndexedDB PWA + zero cookies tracking
- **§9 Menores**: idade mínima 13 anos com consentimento responsável legal (Art.14 LGPD), 16 anos GDPR EU
- **§10 Decisões automatizadas (NOVO)**: explicit "não realiza" — sem AI diagnóstica, sem scoring saúde, sem recomendação automática (Art.20 LGPD)
- **§11 Compliance Google Play Health Apps Policy (NOVO)**: 9 checkpoints com link policy oficial Google (support.google.com/googleplay/android-developer/answer/13316080)
  - Política privacidade explícita
  - Coleta limitada finalidade declarada
  - Criptografia trânsito + repouso
  - Não compartilha seguradoras/empregadores/anunciantes saúde
  - Ads apenas não-personalizados sem dados saúde
  - Mecanismo exclusão acessível user
  - FGS Special Use declarado Console (#004)
  - Disclaimer médico
- **§12 Notificação incidentes ANPD (NOVO)**: comunicação Art. 48 LGPD operacional 72h, conteúdo da notificação detalhado, ref runbook DR
- **§13 Canais contato**: 5 emails granulares com confirmação 72h pra security disclosure
- **§14 Alterações**: 15 dias antecedência via noreply@
- **§15 Histórico versões (NOVO)**: log v1.0 → v1.1 → v1.2

**Termos.jsx + FAQ.jsx**: mantido pass 1 (emails canônicos + entidade Dosy Med LTDA).

**Pré-checks pré-submit Google review (#130):**
- ✅ URL `/privacidade` route existe (App.jsx:298)
- ⏳ Verificar HTTP 200 prod via `curl -I https://dosymed.app/privacidade` após próximo deploy Vercel
- ⏳ Conteúdo renderiza corretamente em mobile (testar Chrome MCP preview)
- ✅ Conteúdo cobre todos requisitos LGPD para healthcare

**Bloqueia:** Antes era #130. Agora #130 desbloqueado pra submit Google review (junto com cross-checks restantes).

### #157 — Disable useRealtime() — storm 13 req/s preview/prod
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — fix targeted commit `da61b04` + restore #007 commit `ff431ca`
- **Origem:** Validação preview Vercel pré-merge release/v0.2.1.0 (Regra 9.1 README) descobriu storm 18× prod baseline. Bisect inicial false positive (#007). Investigação aprofundada via Chrome MCP + Supabase MCP identificou root cause real.
- **Prioridade:** P0 (egress bloqueador prod — bug pré-existente master desde algum momento entre v0.1.7.x e v0.2.0.x)
- **Esforço:** ~1h investigação + 5min fix
- **Dependências:** nenhuma

**Pattern observado:**
- 13 reqs/s sustained idle hidden tab (mesmo prod master)
- Bursts paralelas <100ms + gaps regulares ~2-3s entre bursts
- Cada burst: 11× /doses + 1× /patients + 1× /treatments
- Storm escalava ao longo do tempo: 30s window = ~57 reqs (1.9 req/s, parecia normal); 5min window = 3558 reqs (12 req/s); 28min window = 77k reqs (46 req/s sustained)
- Extrapolação: ~5GB/h egress por user idle hidden tab

**Investigação (Chrome MCP + Supabase MCP):**
1. **Chrome MCP fetch interceptor + WebSocket hook + visibility events** capturaram pattern exato.
2. **Bisect commit b3fe670 #007 src files (commit `76dc28a`):** storm 30s = 0 reqs (false positive — storm não tinha escalado em 30s).
3. **Idle 5min validation pós-bisect:** storm voltou (715 reqs em 5min = 2.4 req/s). Não era #007.
4. **Comparação prod master 28min idle:** 77k reqs (46 req/s) — bug pré-existente confirmado, não regressão release.
5. **Supabase MCP `SELECT FROM pg_publication_tables WHERE pubname='supabase_realtime'`:** retornou **[]** vazio. Publication não tem tabelas configuradas.
6. **Supabase MCP `get_logs(realtime)`:** flood de errors `IncreaseSubscriptionConnectionPool: Too many database timeouts` + `ChannelRateLimitReached: Too many channels` + `Stop tenant ... no connected users`.
7. **Análise código `useRealtime.js:80-108`:** `onStatusChange(CLOSED/CHANNEL_ERROR/TIMED_OUT)` dispara `setTimeout(reconnect, 1-30s backoff)` → `unsubscribe + subscribe + for keys: refetchQueries({type:'active'})`. Cycle confirmed.

**Mecanismo:**
```
Channel subscribe → server sees "no users" → STOP tenant → CLOSE ch
  → onStatusChange CLOSED → setTimeout backoff 1-2s
  → unsubscribe + subscribe + refetchQueries(['doses','patients','treatments',...])
  → 13 reqs paralelos disparam (4-9 active doses keys + patients + treatments)
  → channel briefly SUBSCRIBED → reconnectAttempts=0 reset
  → tenant idle stops again → CLOSED → loop
```

**Por quê publication vazia:**
Não-conhecido — provavelmente migration removeu tables do `supabase_realtime` publication em algum momento, OU publication nunca foi configurada via Studio Dashboard. Histórico release notes (#079/#092/#093/#136/#145) menciona realtime fixes mas nenhum reseta publication.

**Fix aplicado v0.2.1.0:**
```diff
- useRealtime()
+ // #157 (v0.2.1.0) — DISABLED. Bug investigation 2026-05-05 found:
+ //   1. publication `supabase_realtime` empty (NO postgres_changes events delivered)
+ //   2. useRealtime reconnect cascade burns ~13 req/s storm sustained idle hidden tab
+ //   3. Net: zero functional value + catastrophic egress cost.
+ // Re-enable plan v0.2.2.0+: populate publication via Studio + verify reconnect logic
+ // useRealtime()
```

Hook `src/hooks/useRealtime.js` preservado intacto — apenas invocação comentada em App.jsx:67.

**Validação pós-fix:**

| Métrica idle hidden tab | Pre-fix | Pós-fix #157 |
|---|---|---|
| 30s | ~57 reqs (já escalando) | 1 req |
| 90s | ~785 reqs (8.7 req/s) | 2 reqs |
| 5min completo | 3558 reqs (12 req/s) | 9 reqs (0.021 req/s) |
| Visibility | hidden | hidden |

**Storm 99.7% eliminado.** 9 reqs em 7min = comportamento sano (1 auth/v1/user + 1 patient_shares + 1 patients + 1 treatments + 5 doses durante mount + occasional refetch on staleTime).

**Plano v0.2.2.0+ retomar useRealtime():**
1. Studio → Database → Replication → publication `supabase_realtime` toggle:
   - `medcontrol.doses`
   - `medcontrol.patients`
   - `medcontrol.treatments`
   - `medcontrol.sos_rules`
   - `medcontrol.treatment_templates`
   - `medcontrol.patient_shares`
2. Re-enable `useRealtime()` em App.jsx:67 (uncomment)
3. Refactor `useRealtime.js` defensive: adicionar `if (reconnectAttempts >= 5) suspend reconnects until visibilitychange visible` para evitar storm em channel empty state futuro
4. Re-rodar preview Vercel idle 5min hidden tab → confirmar 0 reqs sustained
5. Validar postgres_changes events chegam (test: insert dose via Studio → expect Dashboard auto-update sem refresh)

**Aceitação:**
- ✅ Storm 99.7% eliminado preview release/v0.2.1.0 (medido)
- ✅ #007 PostHog telemetria restored (era false positive bisect)
- ⏳ Validar prod master pós-merge (espera-se mesmo fix levar a 0.02 req/s sustained)

**Lições durables:**
- Storm pode escalar com tempo em hidden tab — bisect window deve igualar window observation original
- publication realtime vazia + hook subscribe = silent rate-limit cascade (não-óbvio sem inspecionar BD direto)
- Investigação multi-camada (cliente Chrome MCP + servidor Supabase MCP) é necessária pra root cause real

**Detalhe completo:** `contexto/updates/2026-05-05-investigacao-157-storm-realtime.md`

### #158 — Resolver rejection Google Play (org account required) NOVO P0 URGENTE
- **Status:** ✅ FECHADO 2026-05-06 — Google APROVOU pós-fixes v0.2.1.2. Closed Testing track "Alpha" ativo desde 2026-05-06 mid-day (#130 ✅). **Fix path B aplicado:** reverter declarações Console (Apps de saúde 13 checkboxes Medicina desmarcados + categoria medical→saude/fitness + manifest categories medical→lifestyle). Path A (org account CNPJ + transfer app) NÃO necessário. Desbloqueou #131 #132 #133. ADR `decisoes/2026-05-06-001-rejection-google-fix.md`.
- **Origem:** Console submit #130 release/v0.2.1.0 (2026-05-05 23:14 BRT) → Google review rejeitado em <30 min com mensagem "Violação dos requisitos do Play Console — apps de certas categorias só por organização".
- **Prioridade:** P0 URGENTE (bloqueador rollout Closed Testing público + Production track futuro)
- **Esforço total:** 1-3 dias investigação + plano (passos 1-7) + 1-3 semanas execução plano (opção A/B/C escolhida)
- **Dependências:** decisão user pós passo 7
- **Escopo:** trabalho operacional Console + paperwork — **não precisa branch git** (zero código). Updates em `contexto/decisoes/` (ADR) + `contexto/updates/` (logs sessão).

**Diretrizes execução (7 passos sequenciais — agente seguir em ordem):**

#### Passo 1 — Ler e-mail Google rejection completo
- Console → Notificações (sino topo direito) → "App rejeitado · 5 de mai." → Mais detalhes
- Click "Ver e-mail" → ler email Google completo (texto integral do reviewer)
- Capturar: data, mensagem específica, link política violada, recursos/categorias citados especificamente
- **Goal:** entender EXATAMENTE qual declaração foi flagged (não só "Política requisitos genérica"). Cole texto integral do email em `contexto/decisoes/{data}-rejection-google.md` como evidência.

#### Passo 2 — Entrar nos links sugeridos pela página Detalhes
- Detalhes problema referenciam: `requisitos do Play Console` + `conteúdo do app` + Central de Ajuda transferir apps + Central de Ajuda configurar org account
- Ler políticas oficiais Google Play 2026 via WebFetch:
  - https://support.google.com/googleplay/android-developer/answer/13316080 (Health Apps Policy)
  - https://support.google.com/googleplay/android-developer/answer/9858738 (Developer Program Policies)
  - Link específico do email rejection (mais autoritativo)
- **Goal:** identificar quais features/declarações requerem org account explicitamente. Documente excerpts relevantes.

#### Passo 3 — Estudar assunto org account requirements
- Buscar Google Play documentation: "organization account requirements 2026"
- Lista oficial categorias/features que exigem CNPJ:
  - Apps governamentais (declaração)
  - Apps financeiros sensíveis (Recursos financeiros declaração)
  - Apps de saúde médica/clínica (App de saúde declaração + categoria sensível)
  - Outras a confirmar via documentação
- Decisões transferência app pessoal → empresarial (workflow + documents required + tempo Google approve)
- Custo: $25 USD nova taxa Console + paperwork BR (~R$ 1000-3000 contador abertura empresa OU usar empresa CNPJ existente se user tiver)
- **Goal:** entender opções concretas + custos/prazos reais.

#### Passo 4 — Analisar app atual (declarações Conteúdo do app)
- Console → Política e programas → Conteúdo do app (sidebar)
- Listar TODAS declarações ativas atualmente (screenshot cada):
  - ID de publicidade (declaração obrigatória SDK ads)
  - Apps governamentais (provavelmente "Não")
  - Recursos financeiros (assinaturas Play Billing — Plus/Pro)
  - Serviços em primeiro plano (FGS Special Use #004 alarmes)
  - Permissões de alarme exato (#004 alarme nativo)
  - **App de saúde** (provável culprit — declaração explícita de healthcare features)
  - Categoria do app: **Saúde e fitness** (mudou v0.2.1.0 de Medicina pra Saúde — pode ainda ser sensível pra Google)
  - Audiência (idade 18+ #156 v1.3)
- Cross-ref com app real: features Dosy = lembrete medicação + tracking dose + push + alarme nativo + paciente CRUD + analytics adesão + LGPD
- **Goal:** identificar exatamente qual declaração ativou org gate. Captura screenshot Console pra evidence.

#### Passo 5 — Validar app nas regras Google
- Cross-ref features Dosy × Health Apps Policy 2026:
  - Dosy faz diagnóstico médico? **Não** (pure tracking, no AI)
  - Dosy interage com prescription system regulator (e-prescribing, eMR integration)? **Não** (free-form input user)
  - Dosy é dispositivo médico classificado ANVISA/FDA? **Não** (consumer self-care)
  - Dosy compartilha dados saúde com terceiros? **Não** (não vende, não broker — privacy policy explícita §11)
  - Dosy serve healthcare professionals? **Não** (target consumer pais/cuidadores/idosos)
- Compatibilidade: Dosy é **app consumer** com features healthcare leves, NÃO app médico clínico
- Documentation reference: Google Health Apps Policy distinguishes "consumer wellness apps" (Saúde e fitness OK conta pessoal) vs "medical devices/clinical apps" (org account required)
- **Goal:** confirmar Dosy fit consumer category (deveria passar se declarações alinhadas). Documente conclusão evidence-based.

#### Passo 6 — Investigar rejeição específica (qual declaração triggered gate)
- Hipótese A mais provável: **declaração "App de saúde"** marcada YES → Google interpreta como medical clinical → org gate
- Hipótese B alternativa: combo de features (#004 FGS Special Use + alarme exato + saúde + medication) escalou flag automatic
- Hipótese C: categoria "Saúde e fitness" combinado com declaração específica
- Workflow investigação:
  1. Console → Conteúdo do app → "App de saúde" → review configuration atual
  2. Se YES: ler descrição/respostas do questionário "App de saúde" — quais checkboxes ativaram gate
  3. Cross-ref com requisitos Google: cada checkbox tem implicação organização
  4. Se possível, simular reverter cada declaração isoladamente (Console permite editar antes submit) e ver qual desliga warning
- Capturar evidência: screenshot configuration atual + identificar trigger exato
- **Goal:** root cause confirmed — sem isso, opção B (revert declaration) não pode ser executada cirurgicamente.

#### Passo 7 — Elaborar plano correção (decision matrix + ADR)

| Critério | Opção A (CNPJ + transfer) | Opção B (revert declarações) | Opção C (apelo Google) |
|---|---|---|---|
| Tempo | 1-3 semanas | 2-4h | 1-2 semanas |
| Custo | R$ 1000-3000 (empresa BR se não tem) + $25 USD nova conta Console | $0 | $0 |
| Risco | Alto setup mas resolve permanente | Médio (perde certifications + pode trigger outra rejection) | Alto (Google pode rejeitar apelo silently) |
| Mantém escopo healthcare | Sim | **Não** (downgrade pra "lifestyle/lembrete") | Sim |
| Permite Production track | Sim | Sim mas com escopo reduzido | Talvez |
| Reversibilidade | Permanente | Re-submit declarations restaurar mas re-trigger | N/A |
| Internal Testing afetado | Não (continua) | Não (continua) | Não (continua) |

**Recomendação default (revisar pós passos 1-6):**
- **Curto prazo (esta semana):** Opção B — reverter declaração "App de saúde" (most likely trigger) → re-submit Closed Testing → testers external entram via opt-in
- **Médio prazo (próximas 2-4 semanas):** Opção A em paralelo — verificar se user já tem CNPJ; se sim, pular abertura empresa; se não, abrir Dosy Med LTDA com contador + cadastrar conta Google Play empresarial + transferir app
- **Pós-A success:** restaurar declaração "App de saúde" + categoria Medicina se quiser → re-submit com escopo healthcare completo

**Output deliverables passo 7:**
- ADR `contexto/decisoes/2026-05-XX-rejection-google-fix.md` documentando decisão escolhida + razão
- Plano timeline execução (datas concretas)
- Items derivados para ROADMAP (ex.: #159 "abrir empresa Dosy Med LTDA", #160 "transferir app Console", #161 "re-submit Closed Testing post-fix")

**Aceitação final #158:**
- Closed Testing track aprovado Google (ou nova conta org com app transferido + aprovado)
- Opt-in URL aceitando inscrições novas
- Production track futuro submit passa review
- Internal Testing continua funcionando independente (já garantido — não foi afetado)

**Internal Testing track NÃO afetado:** continua publicando AAB normalmente (v0.2.1.0 vc 46 publicada 2026-05-05 23:42). User + esposa + testers existentes recebem updates auto Play Store.

**Internal Testing track NÃO afetado:** continua publicando AAB normalmente (v0.2.1.0 vc 46 publicada 2026-05-05 23:42). User + esposa + testers existentes recebem updates.

**Closed Testing público bloqueado:** sem aprovação Google, opt-in URL `https://play.google.com/apps/internaltest/4700769831647466031` permanece sem usuários novos podendo se inscrever.

**Production track bloqueado:** mesma rejection vai aplicar pra Production submit futuro.

**Análise opções:**

**Opção A — Conta Google Play Developer empresarial (recomendada longo prazo):**
1. Criar empresa "Dosy Med LTDA" oficialmente (se já não tem CNPJ)
2. Cadastrar nova conta Google Play Developer com CNPJ + $25 USD taxa nova
3. Verification documents (CNPJ, comprovante endereço empresa, possível video call)
4. Console → app Dosy → Configurações → Transferir um app → para conta empresarial
5. Aguardar Google approve transfer (~1-2 semanas)
6. Re-submit Closed Testing/Production
- **Vantagem:** resolve permanente, libera todas categorias incluindo healthcare strict, profissional + alinha com app de saúde sério
- **Desvantagem:** demora, custos abertura empresa BR (R$ 1000-3000 contador) + paperwork

**Opção B — Reverter declarações específicas (rápida mas escopo reduzido):**
1. Identificar QUAL declaração ativou gate (Conteúdo do app → review todas as declarações):
   - "App de saúde" — provável culpada
   - "Permissões de alarme exato" (#004 FGS Special Use)
   - "Serviços em primeiro plano" (#004 FGS)
   - "Recursos financeiros" (Play Billing assinaturas)
   - "Apps governamentais" — improvável aplica
2. Reverter declaração mais provável (App de saúde) → mudar pra categoria menos sensível
3. Re-submit
- **Vantagem:** ship Closed Testing/Production rapidamente
- **Desvantagem:** app perde certificação healthcare, pode comprometer trust/positioning consumer self-care; pode ainda falhar se outra declaração for culpada

**Opção C — Apelo Google explicando contexto:**
1. Console → Ajuda → Entrar em contato com suporte
2. Explicar: Dosy é app consumer self-care/lembrete medicação, não app médico profissional, target audiência geral (pais, idosos, cuidadores)
3. Solicitar reclassificação manual do reviewer
- **Vantagem:** preserva todas declarações + categoria; sem custo
- **Desvantagem:** Google review apelos é slow + opaque; pode demorar 1-2 semanas; pode ser rejeitado sem explanation

**Recomendação:** A longo prazo + B paralelo curto prazo. Atalho: começar A (criar empresa + CNPJ se não tem), enquanto isso testar B reverting declarações específicas e ver se passa review. Se B passa, ship Closed Testing imediato com escopo reduzido enquanto A finaliza.

**Aceitação:**
- Closed Testing track aprovado Google + opt-in URL aceitando inscrições novas
- Production track submit futuro passa review
- Internal Testing continua funcionando independente

**Detalhe rejection email:** ver Console → Notificações → "App rejeitado · 5 de mai." → Mais detalhes (já lido na sessão).


### #159 — BUG-LOGOUT fix: useAuth boot validation transient vs auth failure
- **Status:** ✅ Concluído v0.2.1.1 (2026-05-06) — fix targeted commit aplicado em release/v0.2.1.1
- **Origem:** User reported (2026-05-06 madrugada) — "abro app e está deslogado, preciso ficar logando o tempo inteiro"
- **Prioridade:** P0 (bug crítico UX — afeta retenção user)
- **Esforço:** 30 min investigação + 5 min fix + ceremony

**Causa raiz:**
`useAuth.jsx:34-49` (#123 release v0.2.0.3) implementou boot session validation via `supabase.auth.getUser()` API call. Lógica original deslogava em **QUALQUER erro**:
```js
if (error || !u?.user) {
  await supabase.auth.signOut()  // <-- desloga até em network slow/timeout
  ...
}
```

Cenário trigger frequente:
1. App cold start Android (especialmente após Doze mode OS)
2. `supabase.auth.getSession()` retorna session local OK (cached)
3. `supabase.auth.getUser()` bate API `/auth/v1/user`
4. Network mobile slow OR Supabase API timeout → `error` truthy
5. Branch desloga user mesmo com sessão válida

User Android vivencia isso múltiplas vezes/dia.

**Fix targeted (`src/hooks/useAuth.jsx`):**
Distinguir error type. SignOut só em evidência forte de auth failure:
- `error.status === 401` (Unauthorized)
- `error.status === 403` (Forbidden)
- Mensagem contém regex `/jwt|token.*expired|user.*not.*found|invalid.*claim|invalid.*token/i`

Outros erros (network timeout, 5xx, fetch exception) → preservar session local. Próximo boot OR próxima request authenticada re-valida automaticamente.

**Trade-off aceitável:**
User com session realmente revogada (deletado/banned) continua com cache stale até próxima request 401. Auth listener `onAuthStateChange` captura SIGNED_OUT normalmente quando server responde 401 numa query subsequente.

**Aceitação:**
- ✅ Cold start Android com network instável NÃO desloga user
- ✅ Real auth failure (JWT invalid após user deletado) ainda desloga via fallback request 401
- ✅ Network exception (offline) preserva session
- ✅ User + esposa relatam fim de logout repetido pós-rollout v0.2.1.1 vc 47

**Detalhe code change:** ver commit release/v0.2.1.1 fix `useAuth.jsx`. Comment block in-code documenta racional + trade-off completo.

### #160 — PatientDetail refactor: Doses Hoje card + dose list 24h/Todas + tratamentos por status (Ativos/Pausados/Encerrados)
- **Status:** ✅ Concluído v0.2.1.2 (2026-05-06) — commits `c6f6963` (v1) + `1913b56` (v2 collapse + Doses card destaque) + `c371072` (v2.1 dark mode adaptive). Ver entry "#160 v2" abaixo pra detalhe completo extensão.
- **Origem:** User reported (2026-05-06) — "página paciente individual: tratamentos ativos mostrando encerrados, melhorar info exibida, replicar lista doses do início pra marcar dose direto da página"
- **Prioridade:** P1 UX (página crítica fluxo paciente)
- **Esforço:** 2-3h refactor + test
- **Dependências:** nenhuma
- **Arquivo:** `src/pages/PatientDetail.jsx`

**Mudanças requeridas:**

1. **Substituir card "Adesão"** por card **"Doses Hoje: X de Y"**
   - X = doses tomadas hoje (status='done' AND scheduledAt entre 00:00-23:59 hoje)
   - Y = total doses agendadas hoje (status in ['done', 'pending', 'overdue', 'skipped'])
   - Formato: `"Doses Hoje: 3 de 5"` ou similar
   - Pode incluir progress bar visual peach palette
   - Adesão move para tela Relatórios (já existe lá)

2. **Manter card "Tratamentos Ativos"** como está (count tratamentos ativos)

3. **Bug fix tratamentos:** atual lista "ativos" inclui encerrados. Filtro errado. Separar em **3 seções distintas**:
   - **Tratamentos Ativos** — `status='active'` AND `endDate >= today`
   - **Tratamentos Pausados** — `status='paused'`
   - **Tratamentos Encerrados** — `status='ended'` OR `endDate < today`
   - Cada seção colapsável (collapsed por default Pausados+Encerrados, Ativos expandido)
   - Counter por seção (`Ativos (3)`, `Pausados (1)`, `Encerrados (2)`)

4. **NOVA seção: Lista de doses do paciente**
   - Replica visual da Dashboard (mesma `DoseCard` component)
   - Filtro segmentado simples: `24h | Todas`
   - Default: 24h
   - Doses do paciente apenas (filter `patientId === current.id`)
   - Ações inline: marcar tomada, pular, undo (mesma UX Dashboard)
   - Mesma DoseModal abre on click
   - Empty state se zero doses no filtro

5. **Reordenar layout** (top → bottom):
   ```
   [Foto avatar grande]
   Nome
   Idade · Peso
   [Compartilhar / Compartilhado badge]
   ─────────────────────────────────
   [Card Doses Hoje X/Y]  [Card Tratamentos Ativos count]
   ─────────────────────────────────
   Lista de doses
   [Filtro: 24h | Todas]
   • Dose 1 (action buttons)
   • Dose 2
   ...
   ─────────────────────────────────
   Tratamentos Ativos (3) ▼
     • Tratamento A
     • Tratamento B
     • Tratamento C
   ─────────────────────────────────
   Tratamentos Pausados (1) ▶
   ─────────────────────────────────
   Tratamentos Encerrados (2) ▶
   ```

**Implementação técnica:**
- Reusar `DoseCard` ou similar component da Dashboard
- Reusar `useDoses({ patientId, from, to })` hook com filter por paciente
- Reusar `useConfirmDose` / `useSkipDose` / `useUndoDose` mutations
- Reusar `useTreatments({ patientId })` hook + group by status client-side via useMemo
- Adicionar collapse state useState pra Pausados/Encerrados
- Filtro 24h/Todas: useState segmented control (similar ao Dashboard 12h/24h/48h chips)

**Aceitação:**
- ✅ Card "Doses Hoje: X de Y" no topo (substitui Adesão)
- ✅ Card "Tratamentos Ativos" mantido
- ✅ Tratamentos separados em 3 seções (Ativos/Pausados/Encerrados) — encerrados NÃO aparecem em Ativos
- ✅ Lista de doses com filtro 24h/Todas + ações marcar/pular funcionando idêntico ao Dashboard
- ✅ Layout reordenado conforme spec
- ✅ Build OK + lint zero errors
- ✅ Test manual prod preview Vercel (paciente real ou teste)

**Out of scope (parqueado v0.2.2.0+):**
- Filtros adicionais (paciente, status, tipo) na lista doses paciente
- Edição inline tratamentos (atual Editar/Pausar/Encerrar buttons mantidos)
- Stats avançadas (gráficos adesão semanal, etc) — vão pra Reports/Analytics

### #161 — Alerts dismiss refinement: ending 1×/dia + share permanent + overdue persist
- **Status:** ✅ Concluído v0.2.1.2 (2026-05-06) — AppHeader.jsx LS_ENDING_SEEN_DATE date-based
- **Origem:** User reported (2026-05-06) — "alertas precisam sumir depois de vistos. Doses atrasadas persistente sempre. Compartilhamento aparece quando recebe, depois some pra sempre. Tratamento encerrando aparece 1× por dia, dismiss = some hoje, amanhã reaparece"
- **Prioridade:** P1 UX
- **Esforço:** 15 min
- **Arquivo:** `src/components/dosy/AppHeader.jsx`

**Comportamento por tipo de alerta:**

| Tipo | Trigger | Dismiss | Persist? |
|---|---|---|---|
| Doses atrasadas | overdueCount > 0 | NÃO dismissable | Sempre enquanto há overdue |
| Compartilhamento | createdAt > LS_SHARES_SEEN | Click pra ver = some pra sempre | Sim (já existia) |
| Tratamento encerrando | endingSoonList ≠ [] AND seenDate ≠ today | Click hoje = some hoje | **Reaparece amanhã** |

**Mudança técnica:**
- Antes: `LS_ENDING_SEEN` armazenava timestamp ISO. Filter `t.updatedAt > seenAt` = só re-mostrar quando trat fosse atualizado (raro, dias restantes muda mas updatedAt não)
- Depois: `LS_ENDING_SEEN_DATE` armazena date string YYYY-MM-DD. Compare `seenDate === todayISODate()`:
  - Se mesmo dia → badge zero (dismissed hoje)
  - Próximo dia (today muda) → badge reaparece automaticamente
  - Quando trat sair do endingSoonList (vencer ou ser encerrado), badge zera permanente

**Aceitação:**
- ✅ User clica ícone Pill amarelo → Sheet abre → fecha → ícone some pelo resto do dia
- ✅ Próximo dia (00:00 UTC virou) → ícone reaparece com mesmos trats (até saírem do horizon ≤3d)
- ✅ Compartilhamento mantém comportamento: dismiss permanente
- ✅ Doses atrasadas mantém: persistente

**Detalhe code change:**
```js
const LS_ENDING_SEEN_DATE = 'dosy_ending_seen_date' // YYYY-MM-DD

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

const endingSoonNew = useMemo(() => {
  if (endingSoonList.length === 0) return 0
  const seenDate = localStorage.getItem(LS_ENDING_SEEN_DATE)
  if (seenDate === todayISODate()) return 0
  return endingSoonList.length
}, [endingSoonList])

const onClickEnding = () => {
  localStorage.setItem(LS_ENDING_SEEN_DATE, todayISODate())
  setEndingSheetOpen(true)
}
```

### #160 v2 — PatientDetail collapse opcional Doses + Tratamentos Ativos + header card destaque
- **Status:** ✅ Concluído v0.2.1.2 (2026-05-06) — extensão #160
- **Origem:** User reported (2026-05-06) — "lista retrátil de encerrados/pausados ok, quero retrair tb Doses + Tratamentos Ativos. Header Doses mais destacado, talvez dentro de card cor diferente"
- **Esforço:** 20 min

**Mudanças:**
- collapse state: `{ doses: false, active: false, paused: true, ended: true }` (defaults)
- Doses agora dentro **Card com gradient sunset soft** (peach/orange) — destaque visual claro vs outras seções
- Header Doses font display 16px bold + count badge (rgba white 40%) + chevron rotate
- Tratamentos Ativos: collapse toggle adicionado (antes era forçado expanded)
- Filtro 24h/Todas e DoseCard list movidos pra dentro card destaque
- Visual collapse pause/ended mantido conforme #160 v1

**Aceitação:**
- ✅ Card Doses com background gradient peach distinto vs outras seções background neutral
- ✅ Click header Doses → collapse/expand
- ✅ Click header Tratamentos Ativos → collapse/expand
- ✅ Pausados/Encerrados continuam collapse default

### Mounjaro fix — paciente Luiz Henrique conta lhenrique.pda@gmail.com
- **Status:** ✅ Concluído v0.2.1.2 (2026-05-06) — SQL data fix
- **Origem:** User reported (2026-05-06) — "cadastrei Mounjaro 4 doses 1×/semana, fez uma semana ontem e não me avisou, está em encerrados"
- **Causa raiz:** `durationDays: 4` salvo (literal "4 dias") quando user esperava 28 (4 doses × 7 dias intervalo). Form `TreatmentForm.jsx` pede "Duração (dias)" — UX confusa pra tratamentos semanais/mensais.
- **Fix data SQL** (1-time):
  ```sql
  UPDATE medcontrol.treatments
  SET "durationDays" = 28, status = 'active', "updatedAt" = NOW()
  WHERE id = '4af9b31d-5971-4a8b-b09a-5fa1003bb16a';

  -- Insert doses 2-4 (1×/semana 14:30 BRT)
  INSERT INTO medcontrol.doses (...)
  VALUES
    ('2026-05-06 17:30:00+00'::timestamptz),  -- HOJE
    ('2026-05-13 17:30:00+00'::timestamptz),  -- 7d
    ('2026-05-20 17:30:00+00'::timestamptz);  -- 14d
  ```
- **Resultado:** Mounjaro volta pra Tratamentos Ativos + dose hoje aparece no Início (overdue se já passou 14:30) + alarme dispara nos próximos.

**Pendente v0.2.2.0+ (não nesta release):**
- TreatmentForm.jsx UX improvement: pra `intervalHours >= 24` (tratamentos diários/semanais/mensais), pedir "Número de doses" ao invés "Duração (dias)" + calcular durationDays internamente OR adicionar warning "Com intervalo 168h e duração 4 dias, só 1 dose será agendada" quando `intervalHours/24 > durationDays`. **Item criado: #162 (próxima release).**

### #162 — TreatmentForm UX warning intervalHours/24 > durationDays + toggle granularidade Dias/Semanas/Meses

- **Status:** ✅ FECHADO v0.2.1.3 vc 51 (2026-05-07) — v1 (vc 50) warning amarelo + v2 (vc 51) toggle Dias/Semanas/Meses auto-switch. Validado device user (v2 OK).
- **Categoria:** 🐛 BUGS
- **Prioridade:** P2
- **Origem:** User-reported 2026-05-06 (Mounjaro silent fail v0.2.1.2) + feedback v1 2026-05-07
- **Esforço:** 1-2h v1 + 2h v2
- **Release:** v0.2.1.3 vc 50 (v1) + vc 51 (v2)

**v1 (vc 50) — fechado:**
Warning amarelo inline em form quando `intervalHours/24 > durationDays`. User valida cenários: 168h+4d trigger warning, 28d sem warning, 24h+30d sem warning, contínuo OFF/ON.

**v2 (vc 51) — user feedback 2026-05-07 "ok mas não gostei":**

User pediu mudar abordagem. Em vez de só warning, quer **toggle granularidade** acima do campo "Duração":

- Toggle 3 chips: **Dias / Semanas / Meses** (default Dias)
- Auto-switch baseado intervalHours:
  - 4h, 6h, 8h, 12h, 24h, 48h, 72h → **Dias**
  - 168h (semanal), 336h (quinzenal) → **Semanas**
  - 720h (mensal) → **Meses**
- Internamente persiste sempre `durationDays` (multiplier × value: ×1, ×7, ×30)
- Edit mode detecta best unit pra display (ex: 28d → 4 semanas)

Vantagem: user escolhe granularidade natural ao tipo tratamento. Mounjaro semanal → "4 semanas" (não "28 dias"). Anticoncepcional → "21 dias". Hormônio mensal → "6 meses".

Implementation:
- New state `durationUnit: 'days' | 'weeks' | 'months'` + `durationValue: number`
- Constant `DURATION_MULTIPLIER = { days: 1, weeks: 7, months: 30 }`
- Helper `setDurationValue(v)` recalcula durationDays
- Helper `setDurationUnit(unit)` preserva intent user
- useEffect auto-switch quando user muda intervalHours (não em edit)
- Label dinâmico: "Duração (dias/semanas/meses)"
- 3 chips estilo Dosy primary peach (active state) + bg-elevated (inactive)

Warning v1 mantido (calcula em durationDays internamente).

**Critério aceitação v2:**
- ✅ Default Dias com input numérico
- ✅ Click chip Semanas → label muda + 7 entrada vira 49 dias internamente
- ✅ Mudar intervalo 24h→168h auto-switch chip pra Semanas (form novo)
- ✅ Edit existing 28d treatment → mostra 4 Semanas no toggle
- ✅ Edit existing 30d treatment → mostra 1 Mês
- ✅ Edit existing 21d treatment → mostra 21 Dias (não divide perfeitamente)
- ✅ Toggle Uso contínuo ON oculta toggle granularidade + input

**Problema:**

Form `TreatmentForm.jsx` aceita `durationDays < intervalHours/24` sem warning visual. Resultado: tratamento semanal (intervalHours=168) com `durationDays=4` gera apenas 1 dose (em vez de 4 doses ao longo de 28 dias). Tratamento auto-encerra cedo (`effectiveStatus → 'auto-ended'` quando `endDate < now`) e user não percebe — alerta "tratamento acabando" silencia precoce, app vai pra "Encerrados" sem aviso óbvio.

**Repro Mounjaro v0.2.1.2 (paciente lhenrique.pda):**
- Mounjaro: intervalHours=168 (semanal) + durationDays=4 (literal 4 dias) → endDate 03/05 → auto-ended dia 03/05 → user esperava 4 doses × 7d = 28 dias.
- SQL data fix aplicado v0.2.1.2 (durationDays 4→28 + status active + 3 doses pendentes).

**Causa raiz UX:**
- Campo "Duração (dias)" no form = ambíguo pra tratamentos com `intervalHours >= 24`. User pensa "4 doses" digita "4" mas semantic correto = "28 dias" (4 doses × 7d intervalo).
- Sem validação inline, sem hint, sem warning amarelo.

**Abordagem (escolher 1 ou ambos):**

**Opção A — Warning inline (mínimo viável, 30min):**
```jsx
// TreatmentForm.jsx — após onChange durationDays/intervalHours
const dosesPossiveis = Math.floor((durationDays * 24) / intervalHours)
const warningSilent = intervalHours >= 24 && dosesPossiveis < 2
{warningSilent && (
  <div style={{ background: 'var(--dosy-amber-bg)', padding: 12, borderRadius: 8 }}>
    ⚠️ Com intervalo de {intervalHours/24}d e duração {durationDays}d,
    apenas {dosesPossiveis} dose{dosesPossiveis !== 1 ? 's serão' : ' será'} agendada
    {dosesPossiveis > 1 ? 's' : ''}. Tratamento auto-encerra em {durationDays}d.
    <div style={{ fontSize: 12, marginTop: 6 }}>
      Esperava mais doses? Aumente "Duração (dias)" pra {Math.ceil((intervalHours/24) * dosesEsperadas)}d
    </div>
  </div>
)}
```

**Opção B — Refactor campo "Número de doses" (1-2h, melhor UX):**
- Pra `intervalHours >= 24`, trocar campo "Duração (dias)" por "Número de doses" + calcular `durationDays = numDoses * (intervalHours/24)` internamente
- Pra `intervalHours < 24` (cada X horas), manter "Duração (dias)" atual
- Toggle automático baseado em `intervalHours` value
- Side-effect: schema DB inalterado (durationDays continua persistindo) — só UI muda

**Decisão recomendada:** Opção A primeiro (warning, low risk), Opção B v0.2.3.0+ se feedback usuário continuar mostrando confusão.

**Dependências:**
- TreatmentForm.jsx atual lê durationDays + intervalHours via state form
- Tokens design `--dosy-amber-bg` (já existe pra warnings)

**Critério de aceitação:**
- ✅ Form com intervalHours=168 + durationDays=4 → warning amarelo visível
- ✅ Form com intervalHours=24 + durationDays=30 → sem warning (30 doses faz sentido)
- ✅ Form com intervalHours=168 + durationDays=28 → sem warning (4 doses faz sentido)
- ✅ Texto warning calcula dosesPossiveis correto
- ✅ Sugestão de "Aumente para Xd" arredonda pra cima
- ✅ Validado no preview Vercel via Chrome MCP (Regra 9.1)

---

## Plano egress otimização escala (preparar Open Testing/Production)

> **Contexto investigação 2026-05-06:** Supabase Pro cycle (05 May - 05 Jun) consumiu 8.74 GB / 250 GB com 4 MAU = **3.75 GB/user/mês** (~30× padrão SaaS healthcare 50-200 MB/user/mês). Storm pré-#157 dominou cycle (May 5 = 7.2 GB, May 6 pós-fix = 0.5 GB, **redução 14× dia-a-dia**). Steady state estimado pós #157 fix: ~15 GB/mês com user atual. Math escala: 100 users heavy = ~375 GB/mês → ESTOURA Pro 250 GB. Items #163-#167 preparam escala Open Testing/Production (objetivo ≤500 MB/user/mês = 5-10× redução combined).
>
> **Sequência sugerida** (ordem dependência + ROI):
> 1. **#163** RPC consolidado Dashboard (3-4h, -40% a -60% Dashboard egress, low risk)
> 2. **#165** Delta sync + TanStack persist (3-5h, -70% a -90% reads steady state, médio risk)
> 3. **#164** Realtime broadcast (4-6h, -80% a -90% Realtime, alto ROI mas requer #157 retomar coordenado)
> 4. **#166** MessagePack + compression (2-3h, 50-70% payload, low risk)
> 5. **#168** CDN cache strategy (2-3h, low risk + aproveita Cached Egress 250 GB ociosa)
> 6. **#167** Cursor pagination + cols aggressive + Supavisor (3-5h, marginal mas estrutural)
>
> Total esforço: **~17-26h código distribuído v0.2.2.0+ → v0.2.3.0+**.

### #163 — RPC consolidado Dashboard `get_dashboard_payload`

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P1 (cost escala — preparar Open Testing)
- **Origem:** Investigação egress 2026-05-06 (3.75 GB/user/mês = 30× padrão SaaS)
- **Esforço:** 3-4h
- **Release sugerida:** v0.2.2.0+

**Problema:**

Dashboard atual faz 4 queries paralelas em paralelo no mount:
- `useDoses(filter)` → listDoses RPC
- `usePatients()` → listPatients
- `useTreatments()` → listTreatments
- `extend_continuous_treatments` rpc

Cada query carrega:
- Auth context (set_config search_path + auth.uid + JWT decode) ~1-2 KB
- Response payload (rows + duplicate metadata)
- HTTP overhead (headers + TLS handshake reuse)

Resultado: 4× round-trip + ~4× auth overhead duplicado. PostgREST + RLS context per request.

**Abordagem:**

Migration: criar SQL function `medcontrol.get_dashboard_payload(p_user_id uuid)` SECURITY DEFINER com `SET search_path = medcontrol, public`:

```sql
CREATE OR REPLACE FUNCTION medcontrol.get_dashboard_payload(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Auth check (caller deve ser user)
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'doses', (
      SELECT coalesce(jsonb_agg(d ORDER BY "scheduledAt"), '[]'::jsonb)
      FROM (
        SELECT id, "patientId", "treatmentId", "medName", dose, unit, "scheduledAt", "takenAt", status
        FROM medcontrol.doses
        WHERE "userId" = p_user_id
          AND "scheduledAt" >= now() - interval '30 days'
          AND "scheduledAt" <= now() + interval '60 days'
        ORDER BY "scheduledAt"
        LIMIT 500
      ) d
    ),
    'patients', (
      SELECT coalesce(jsonb_agg(p), '[]'::jsonb)
      FROM (
        SELECT id, name, "ageMonths", weight, avatar, "photoVersion", "isShared"
        FROM medcontrol.patients
        WHERE "ownerId" = p_user_id OR id IN (
          SELECT "patientId" FROM medcontrol.patient_shares WHERE "sharedWithUserId" = p_user_id
        )
      ) p
    ),
    'treatments', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb)
      FROM (
        SELECT id, "patientId", "medName", dose, unit, "intervalHours", "isContinuous", "durationDays", "startDate", status
        FROM medcontrol.treatments
        WHERE "userId" = p_user_id
      ) t
    ),
    'stats', (
      SELECT jsonb_build_object(
        'overdue', count(*) FILTER (WHERE status = 'overdue'),
        'upcoming_24h', count(*) FILTER (WHERE status = 'scheduled' AND "scheduledAt" <= now() + interval '24 hours')
      )
      FROM medcontrol.doses
      WHERE "userId" = p_user_id
    ),
    'serverTime', extract(epoch from now())::int
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.get_dashboard_payload(uuid) TO authenticated;
```

Frontend: novo hook `useDashboardPayload(userId)`:

```js
// src/hooks/useDashboardPayload.js
export function useDashboardPayload() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_payload', { p_user_id: user.id })
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 15 * 60_000, // 15min, opt-in só Dashboard
  })
}
```

Dashboard.jsx — substituir 4 hooks por 1:

```js
// Antes
const { data: doses } = useDoses(filter)
const { data: patients } = usePatients()
const { data: treatments } = useTreatments()
useEffect(() => extendContinuous(), [])

// Depois
const { data: payload } = useDashboardPayload()
const { doses = [], patients = [], treatments = [], stats } = payload || {}
```

**Dependências:**
- Migration SQL nova (testar local + apply prod)
- Hook novo `useDashboardPayload`
- Refactor Dashboard.jsx (manter compat outras telas que usam useDoses/usePatients separados)

**Critério de aceitação:**
- ✅ Migration aplica sem erro
- ✅ RPC retorna payload completo Dashboard render OK
- ✅ Auth check funciona (caller != p_user_id retorna error)
- ✅ Validação Chrome MCP preview: Dashboard 1 fetch (vez de 4) + payload size ≤60% original combinado
- ✅ Sentry sem regressões (DOSY-* events)

**Métrica esperada:**
- -40% a -60% Dashboard egress
- -75% Dashboard request count (4 → 1)
- Round-trip time -300ms (4 paralelas → 1 single)

---

### #164 — Realtime broadcast healthcare alerts (combinado retomar #157)

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P1 (cost escala — combinado retomar #157)
- **Origem:** Investigação egress 2026-05-06 + plano retomar #157 v0.2.2.0+
- **Esforço:** 4-6h
- **Release sugerida:** v0.2.2.0+

**Problema:**

#157 disabled `useRealtime()` em App.jsx (commit `da61b04`) por storm 12 req/s sustained idle. Root cause: publication `supabase_realtime` vazia + reconnect cascade gerava `ChannelRateLimitReached` + refetch loop. Mas **realtime sync é necessário** pra UX multi-device (user marca dose tomada num device → outro device vê instantâneo).

Solução tradicional `postgres_changes` streaming:
- Cliente subscribe canal `realtime:medcontrol.doses`
- Cada UPDATE/INSERT no DB → server envia full row pro cliente
- Cliente recebe row 50KB → invalidate query → refetch full list 200KB

Padrão **broadcast** (Supabase Realtime channels):
- Edge function envia `supabase.channel('user:<userId>').send({type:'broadcast', event:'dose_update', payload:{id, status, takenAt}})`
- Cliente subscribe canal user-scoped → recebe payload customizado ~1KB (só campos mudados)
- Patch cache local diretamente via `qc.setQueryData(['doses'], (old) => old.map(d => d.id === payload.id ? {...d, ...payload} : d))`
- Bypass refetch network completo

**Abordagem:**

Server side — modificar Edge `dose-trigger-handler` (cron + INSERT trigger):

```ts
// supabase/functions/dose-trigger-handler/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function broadcastDoseUpdate(userId: string, doseUpdate: {id, status, takenAt?, scheduledAt?}) {
  const channel = supabase.channel(`user:${userId}`)
  await channel.send({
    type: 'broadcast',
    event: 'dose_update',
    payload: doseUpdate
  })
}

// Após INSERT/UPDATE dose:
await broadcastDoseUpdate(userId, { id, status: 'taken', takenAt: new Date().toISOString() })
```

Client side — novo hook `useUserBroadcast`:

```js
// src/hooks/useUserBroadcast.js
import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export function useUserBroadcast() {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`user:${user.id}`)
      .on('broadcast', { event: 'dose_update' }, ({ payload }) => {
        // Patch cache local sem refetch
        qc.setQueriesData({ queryKey: ['doses'] }, (old) => {
          if (!Array.isArray(old)) return old
          return old.map(d => d.id === payload.id ? { ...d, ...payload } : d)
        })
        qc.setQueryData(['dashboard', user.id], (old) => {
          if (!old) return old
          return {
            ...old,
            doses: old.doses.map(d => d.id === payload.id ? { ...d, ...payload } : d)
          }
        })
      })
      .on('broadcast', { event: 'patient_update' }, ({ payload }) => {
        // Similar pra patients
      })
      .on('broadcast', { event: 'treatment_update' }, ({ payload }) => {
        // Similar pra treatments
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, qc])
}
```

App.jsx — re-enable mas usando broadcast:

```js
// Antes (#157 disabled): // useRealtime()
// Agora:
useUserBroadcast()
```

**Dependências:**
- Edge functions modificadas (dose-trigger-handler + handler PATCH/DELETE)
- Hook novo client
- Manter `useRealtime.js` desabled (postgres_changes stream substituído)
- Validação multi-device

**Critério de aceitação:**
- ✅ Marcar dose tomada device A → device B atualiza ≤2s sem refetch
- ✅ Network tab: payload broadcast event ≤1.5 KB (vs ~50 KB postgres_changes)
- ✅ Idle 5min sem requests automáticos (broadcast só dispara em events)
- ✅ Reconnect resiliente (sem cascade storm #157)
- ✅ Validação Chrome MCP preview Vercel: idle 5min = 0 fetches

**Métrica esperada:**
- -80% a -90% Realtime egress
- Latência sync multi-device <2s
- Zero idle polling

---

### #165 — Delta sync doses + TanStack persist IndexedDB offline-first

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P1 (cost escala — UX offline-first)
- **Origem:** Investigação egress 2026-05-06 (steady state still high)
- **Esforço:** 3-5h
- **Release sugerida:** v0.2.2.0+ ou v0.2.3.0+

**Problema:**

Hoje cliente abre app → 4 queries paralelas full pull (doses 30d + patients all + treatments all). Mesmo com staleTime 15min (#150), navigate entre rotas + refresh manual + open app revisita cache mas não persiste entre sessions (TanStack Query in-memory only).

Ideal: cache persist entre sessions + initial render instant + delta sync background only.

**Abordagem:**

(a) **Server-side delta filter** — adicionar `?since=lastSyncedAt` em listDoses:

```js
// src/services/dosesService.js
export async function listDoses({ from, to, status, since }) {
  let q = supabase.schema('medcontrol').from('doses').select(DOSE_COLS_LIST)
  if (from) q = q.gte('scheduledAt', from)
  if (to) q = q.lte('scheduledAt', to)
  if (status) q = q.eq('status', status)
  if (since) q = q.gt('updatedAt', since) // ← novo filter delta
  return q.order('scheduledAt')
}
```

useDoses tracks `lastSyncedAt` via localStorage:

```js
// src/hooks/useDoses.js
const lastSyncedAt = localStorage.getItem('dosy_doses_last_sync') || '1970-01-01'
const { data: deltaRows } = useQuery({
  queryKey: ['doses', 'delta', lastSyncedAt],
  queryFn: async () => {
    const rows = await listDoses({ since: lastSyncedAt })
    if (rows.length > 0) {
      localStorage.setItem('dosy_doses_last_sync', new Date().toISOString())
    }
    return rows
  },
  staleTime: 30_000,
})
```

Patch cache local com delta rows ao invés de full list refetch.

(b) **TanStack persist plugin** — instalar `@tanstack/query-persist-client` + `@tanstack/query-async-storage-persister`:

```bash
npm i @tanstack/query-persist-client @tanstack/query-async-storage-persister idb-keyval
```

```js
// src/main.jsx
import { persistQueryClient } from '@tanstack/query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

const persister = createAsyncStoragePersister({
  storage: { getItem: get, setItem: set, removeItem: del },
  key: 'dosy-query-cache',
  throttleTime: 2000,
})

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  buster: __APP_VERSION__, // invalida cache em deploy novo
  dehydrateOptions: {
    shouldDehydrateQuery: (q) => {
      // Persist só queries safe (não auth, não temp)
      return ['doses', 'patients', 'treatments', 'dashboard'].includes(q.queryKey[0])
    },
  },
})
```

(c) **staleTime bump** combinado: 15min → 30min (cache persist garante boot instant + delta sync atualiza background).

**Dependências:**
- Migration: garantir `updatedAt` index em medcontrol.doses (`CREATE INDEX IF NOT EXISTS idx_doses_updated_at ON medcontrol.doses("userId", "updatedAt") WHERE "updatedAt" IS NOT NULL`)
- Trigger: garantir `updatedAt` auto-update em todas mutations
- IndexedDB compat (Capacitor WebView OK; older Android <7.0 sem fallback)

**Critério de aceitação:**
- ✅ App restart → render Dashboard ≤500ms (cache local instant)
- ✅ Cache persist sobrevive force stop + reabrir
- ✅ Delta sync 1 request retorna só rows mudadas (verificar payload size)
- ✅ Cache invalida em deploy novo (buster __APP_VERSION__)
- ✅ Validação Chrome MCP: idle 5min sem app aberto + reabrir = boot rápido + 1 delta fetch ≤5KB

**Métrica esperada:**
- -70% a -90% reads steady state (após initial pull pesado)
- Boot time -800ms (cache local vs network round-trip)
- UX offline-first (modo avião funcional read-only)

---

### #166 — MessagePack Edge functions payload + compression headers

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (cost escala — payload size optimization)
- **Origem:** Investigação egress 2026-05-06
- **Esforço:** 2-3h
- **Release sugerida:** v0.2.3.0+

**Problema:**

Edge functions atuais (`dose-trigger-handler`, `schedule-alarms-fcm`, `notify-doses`, `send-test-push`) retornam JSON. JSON tem overhead significativo: keys repetidos em arrays, strings numbers, null verbose. MessagePack binary ~50-70% menor pra mesmo payload.

Compression: Supabase serve gzip por default. Verificar headers cliente `Accept-Encoding: br, gzip` (Brotli melhor que gzip — verificar Vercel CDN pass-through).

**Abordagem:**

(a) **MessagePack** Edge functions:

```ts
// supabase/functions/dose-trigger-handler/index.ts
import { encode } from 'jsr:@msgpack/msgpack'

return new Response(encode(payload), {
  headers: {
    'Content-Type': 'application/x-msgpack',
    'Cache-Control': 'no-store',
  },
})
```

Cliente decode no fetch wrapper:

```js
// src/lib/supabaseClient.js fetch interceptor
import { decode } from '@msgpack/msgpack'

const origFetch = window.fetch
window.fetch = async (...args) => {
  const resp = await origFetch(...args)
  if (resp.headers.get('content-type')?.includes('application/x-msgpack')) {
    const buf = await resp.arrayBuffer()
    const data = decode(buf)
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { 'content-type': 'application/json' },
    })
  }
  return resp
}
```

(b) **Compression headers** verify:

```js
// Adicionar Accept-Encoding em todos fetches
fetch(url, {
  headers: {
    'Accept-Encoding': 'br, gzip, deflate',
  },
})
```

Verificar Vercel `vercel.json` headers config:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Accept-CH", "value": "Save-Data" }
      ]
    }
  ]
}
```

**Dependências:**
- `@msgpack/msgpack` deno port (server) + npm pkg (client)
- Fetch wrapper compat (não quebrar JSON endpoints PostgREST)

**Critério de aceitação:**
- ✅ Edge function retorna application/x-msgpack
- ✅ Cliente decode + render OK
- ✅ Network tab: payload binary ≤50% size original JSON
- ✅ Brotli compression aplicado pelo Vercel CDN (verificar `content-encoding: br`)
- ✅ Sentry sem regressões parsing

**Métrica esperada:**
- -50% a -70% Edge function payload size
- -10% a -20% adicional via Brotli vs Gzip

---

### #167 — Cursor pagination + selective columns aggressive + Supavisor pooler

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (cost escala — estrutural)
- **Origem:** Investigação egress 2026-05-06
- **Esforço:** 3-5h
- **Release sugerida:** v0.2.3.0+

**Problema:**

(a) **Offset pagination** atual (`?from=N&to=M`) força server re-scan rows skipped. Cursor pagination (`?after=last_id`) usa index seek direto.

(b) **DOSE_COLS_LIST** já reduzido (#138 sem observation). Pode ir mais aggressive: status string `'scheduled' | 'taken' | 'skipped' | 'overdue'` → int code `0 | 1 | 2 | 3` (1 byte vs 8-9 bytes). Drop campos read-rare (`updatedBy`, `createdBy` em listas).

(c) **Supavisor transaction mode** — Supabase Pro inclui pooler. Trocar direct conn por `aws-0-sa-east-1.pooler.supabase.com:6543` pra reduzir handshake overhead 200-400 bytes/request (PG handshake + RLS context setup mais leve em pooled conn).

**Abordagem:**

(a) **Cursor pagination**:

```js
// src/services/dosesService.js
export async function listDosesCursor({ after, limit = 100 }) {
  let q = supabase.schema('medcontrol').from('doses').select(DOSE_COLS_LIST)
    .order('scheduledAt')
    .order('id') // tiebreaker
    .limit(limit)
  if (after) {
    const [scheduledAt, id] = after.split('|')
    q = q.or(`scheduledAt.gt.${scheduledAt},and(scheduledAt.eq.${scheduledAt},id.gt.${id})`)
  }
  const { data } = await q
  const lastRow = data[data.length - 1]
  const nextCursor = lastRow ? `${lastRow.scheduledAt}|${lastRow.id}` : null
  return { rows: data, nextCursor }
}
```

(b) **Status int code** — migration:

```sql
ALTER TABLE medcontrol.doses
  ADD COLUMN status_code smallint;

UPDATE medcontrol.doses SET status_code = CASE status
  WHEN 'scheduled' THEN 0
  WHEN 'taken' THEN 1
  WHEN 'skipped' THEN 2
  WHEN 'overdue' THEN 3
END;

CREATE INDEX idx_doses_status_code ON medcontrol.doses("userId", status_code);
```

DOSE_COLS_LIST drop string `status` da lista, usar `status_code`. Frontend decode:

```js
const STATUS_DECODE = { 0: 'scheduled', 1: 'taken', 2: 'skipped', 3: 'overdue' }
const STATUS_ENCODE = Object.fromEntries(Object.entries(STATUS_DECODE).map(([k, v]) => [v, +k]))
```

(c) **Supavisor pooler** — trocar URL `.env`:

```env
# Antes
VITE_SUPABASE_URL=https://guefraaqbkcehofchnrc.supabase.co

# Depois (transaction mode pooler)
VITE_SUPABASE_URL=https://guefraaqbkcehofchnrc.supabase.co  # API gateway mantém
# Direct DB conn (SSR/Edge) usa pooler
DATABASE_URL=postgres://postgres.guefraaqbkcehofchnrc:[pwd]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

Edge functions usar `DATABASE_URL` pooler.

**Dependências:**
- Migration status_code + index
- Refactor frontend status display (manter compat string display)
- Pool conn URL Edge functions

**Critério de aceitação:**
- ✅ Cursor pagination retorna rows consistentes (sem duplicate/skip em concurrent INSERT)
- ✅ Status int code: payload list -8 bytes/row (1500 doses = -12 KB save)
- ✅ Supavisor pooler conn estável (Edge function logs sem timeout/disconnect)
- ✅ Sentry sem regressões

**Métrica esperada:**
- Marginal -5% a -10% por item, mas cumulativo estrutural longprazo
- Permite scale 1000+ users sem re-arq major

---

### #168 — CDN cache strategy: bundle + assets via Vercel CDN + Supabase Storage cache headers

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (cost escala — aproveitar Cached Egress separado)
- **Origem:** Investigação egress 2026-05-06 (Pro Cached Egress 250 GB separado, 0/250 atualmente)
- **Esforço:** 2-3h
- **Release sugerida:** v0.2.3.0+

**Problema:**

Pro plan tem **2 quotas separadas**:
- **Database Egress 250 GB** — traffic PostgREST + Edge functions (consumido 8.74 GB / 250 atualmente)
- **Cached Egress 250 GB** — traffic via CDN cache hits (Storage, Edge function cached responses, static assets) — atualmente **0 / 250 GB**

Quota Cached Egress está completamente ociosa. Otimização: deslocar traffic do DB Egress para Cached Egress quando possível, aproveitando 250 GB extras gratuitos no Pro.

Exemplos de oportunidades:
- Bundle JS Dosy serve de Vercel CDN (não Supabase) — verificar HIT rate `cache-control` headers
- Imagens estáticas (logo, splash, ícones) servem Vercel CDN
- Fotos pacientes (Supabase Storage `patient-photos`): hoje sem `cache-control` → cliente re-baixa toda vez. Setar `cache-control: public, max-age=31536000, immutable` (foto path versioned via `photo_version` #115, então safe immutable)
- Edge functions retornando dados estáticos-ish (FAQ, Termos, Privacidade conteúdo) com `cache-control: public, max-age=3600 s-maxage=86400` → CDN cache hit em vez de re-execute
- PostgREST `etag` headers permitem 304 Not Modified em refetch idempotente (cliente reusa cache local)

**Abordagem:**

(a) **Verificar Vercel CDN cache hit rate atual:**

```bash
# Curl Vercel asset com headers
curl -I https://dosymed.app/assets/index-Cmc-tujf.js
# Esperar: cache-control: public, max-age=31536000, immutable
# x-vercel-cache: HIT (após 1ª request)
```

Vercel default cobre `/assets/*` immutable (Vite hash filenames). Verificar `index.html` cache curto (max-age=0 must-revalidate) pra deploys novos serem detectados.

`vercel.json` (criar se não existir):

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/icon-(.*).png",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    },
    {
      "source": "/(.*\\.svg|.*\\.woff2)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

(b) **Supabase Storage `patient-photos` cache headers** — atualizar upload service:

```js
// src/services/patientService.js (upload photo path)
async function uploadPatientPhoto(patientId, file, version) {
  const path = `${patientId}/${version}.jpg`
  const { error } = await supabase.storage
    .from('patient-photos')
    .upload(path, file, {
      cacheControl: '31536000, immutable', // 1 year, version garante busting
      upsert: true,
      contentType: 'image/jpeg',
    })
  if (error) throw error
  return path
}
```

Nota: `photo_version` #115 já garante busting — quando user troca foto, version++ → new path → cache miss legítimo. Files antigos viram garbage collected (Supabase Storage não auto-deleta — pode adicionar pg_cron pra cleanup `photo_version < current` rows, mas low priority).

(c) **Edge functions cache-control** — endpoints estáticos-ish:

```ts
// Hipotético: edge function retornando FAQ.md content (se mover pra DB futuro)
return new Response(content, {
  headers: {
    'Content-Type': 'text/markdown',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  },
})
```

(d) **PostgREST etag verify** — Supabase já envia `etag` em responses GET; cliente HTTP cache automático respeita 304. Verificar Network tab Chrome MCP: requests duplicadas idempotentes retornam 304 Not Modified em vez de 200 + payload.

(e) **Service Worker cache strategy** — atualizar `public/sw.js` (atualmente v6 #078) com strategy mais agressiva:

```js
// Cache First pra assets imutáveis
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Assets versioned (Vite hash) → cache forever
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
        const cloned = resp.clone()
        caches.open('dosy-assets-v6').then(c => c.put(event.request, cloned))
        return resp
      }))
    )
    return
  }

  // index.html → network first (deploys novos)
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
    return
  }
})
```

**Dependências:**
- `vercel.json` config commit
- patientService upload path com cacheControl
- Service worker bump v6 → v7 (#078 pattern)
- Validar Network tab Chrome MCP HIT/MISS rate

**Critério de aceitação:**
- ✅ Curl Vercel asset retorna `cache-control: max-age=31536000, immutable`
- ✅ 2ª visita Dosy (mesmo browser) → assets retornam `x-vercel-cache: HIT`
- ✅ Supabase Storage upload setou `cache-control` 1 year
- ✅ Foto paciente carrega 1× por device por version (cache hit local + CDN)
- ✅ Service worker v7 deployed + cache strategy assets-first funcional offline
- ✅ Validação Chrome MCP: visita repetida Dosy → assets bytes ≤10% original (cache hit)
- ✅ Cached Egress dashboard começa subir (sinal traffic deslocado pra cache quota)

**Métrica esperada:**
- Bundle JS + assets: 100% CDN cache (já parcialmente)
- Fotos pacientes: 1 download por version por device (vs every refetch)
- Cached Egress quota usage: 0 → ~30-50 GB/mês com 100 users (ainda dentro 250 GB)
- DB Egress save: -10% a -15% (asset traffic pequeno em relação DB queries, ROI moderado)

**Notas:**
- ROI menor que #163-#165 (que atacam DB queries diretamente) MAS quase grátis (config files apenas, low risk)
- Aproveita quota Cached Egress 250 GB ociosa do Pro plan
- Combinado com #166 (compression headers) cobre todo bullet 7 da análise original

---

## Plano marketing/ASO/growth (preparar Open Testing/Production launch)

> **Contexto análise concorrentes 2026-05-07:** Forecast realista solo dev sem marketing budget = 1.5K-3K MAU Year 1 (vs Medisafe ~200K MAU BR, MyTherapy ~100K, Pílula Certa ~500K — todos com anos brand recognition + parcerias). Solo dev BR healthcare apps típicos demoram 2-3 anos pra 50K MAU sem investimento. Dosy diferenciadores técnicos forte (alarme nativo crítico, compartilhamento, LGPD healthcare) MAS sem ataque marketing = stagnation. Items #169-#173 visam Year 1 5K-10K MAU + Year 3 50K MAU realista executando playbook.
>
> **Sequência sugerida** (ordem dependência + gating launch):
> 1. **#169** ASO Play Store completo (6-8h) — pre-Production launch obrigatório
> 2. **#170** Reviews strategy + In-App Review (4-5h) — ativar dia 1 Production
> 3. **#173** Healthcare differentiators moat (15-22h, promove #064/#065/#066) — diferencial vs competitors
> 4. **#171** Marketing orgânico playbook BR (8-10h setup + ongoing) — paralelo Production
> 5. **#172** Landing page + blog SEO (12-16h initial + 24h conteúdo) — SEO leva 6-12 meses indexar
>
> Total esforço: **~50-65h initial** + 2-3h/semana ongoing (#171 content + #170 reviews reply).

### #169 — ASO Play Store completo: keywords + listing copy + screenshots strategy + A/B test

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (growth — pre-Production launch)
- **Origem:** Análise concorrentes BR 2026-05-07
- **Esforço:** 6-8h
- **Release sugerida:** v0.2.2.0+ (antes Production #133)

**Problema:**

Listing Play Store atual tem categoria "Saúde e fitness" + descrição básica + 8 screenshots (#025) + ícone + feature graphic. Falta otimização ASO real:
- Keywords não pesquisadas (qual termo BR converte?)
- Título 30 chars sem keyword primária forte
- Short description 80 chars genérica
- Full description 4000 chars sem distribuição estratégica keywords
- Screenshots ordem não testada (primeiros 3 = 80% conversão)
- Sem vídeo preview (boost conversão 25-35%)
- Zero A/B test rodando

**Abordagem:**

(a) **Keywords research BR healthcare** (use Google Play Console Keyword Planner + Sensor Tower free tier + AppTweak trial):

Tier 1 (alta intent, médio volume):
- "lembrete remédio" (~10K searches/mês BR)
- "alarme medicação" (~5K)
- "controle medicamentos" (~3K)
- "lembrete dose" (~2K)

Tier 2 (long-tail, alta conversão):
- "lembrete remédio idoso"
- "controle medicamentos diabetes"
- "alarme medicação Alzheimer"
- "cuidador dose remédio"
- "compartilhar medicação família"

(b) **Listing copy otimizado:**

**Título** (30 chars max):
- Atual: "Dosy" (subutilizado)
- Proposto: "Dosy: Lembrete de Remédios" (28 chars, keyword primária)

**Short description** (80 chars):
- "Alarme inteligente p/ medicação. Multi-paciente. Cuidadores. 100% PT-BR." (78 chars)

**Full description** (4000 chars) estrutura:

```
[Hook 1ª linha — 1ª impressão Play Store]
Nunca mais esqueça uma dose. O Dosy te avisa na hora certa, com alarme que toca alto até no modo silencioso.

[Problema/dor — 2-3 linhas]
Quem cuida de pais idosos, controla medicação para diabetes, ansiedade ou tratamento contínuo sabe: esquecer uma dose pode comprometer todo o tratamento.

[Solução — features primárias com keywords]
✅ ALARME CRÍTICO que toca alto + tela cheia (mesmo no silencioso)
✅ MULTI-PACIENTE: gerencie remédios de pais, filhos, marido/esposa
✅ COMPARTILHAR com cuidadores e familiares
✅ HISTÓRICO completo de doses tomadas
✅ TRATAMENTOS contínuos (controle hipertensão, diabetes, depressão)

[Diferencial vs concorrentes]
Diferente de outros apps de lembrete de remédio, o Dosy:
- Toca alarme REAL (não só notificação que some)
- 100% em português BR (não tradução)
- Funciona offline (não precisa internet)
- LGPD: seus dados ficam só com você

[Use cases]
Perfeito para: idosos com Alzheimer, diabéticos tipo 2, controle de TDAH, ansiedade, depressão, tratamento de tireoide, cuidadores profissionais e familiares.

[CTA + planos]
GRATUITO: 1 paciente + lembretes ilimitados
PRO R$ 14,90/mês: pacientes ilimitados + compartilhamento + sem anúncios

[Trust signals]
🏥 Conformidade LGPD healthcare
🔒 Dados criptografados (Android Keystore)
📱 Funciona em qualquer Android 7+
⭐ Avaliação 4.X (X reviews)

[Footer keywords secundárias]
lembrete remédio | alarme medicação | controle medicamentos | dose remédio | cuidador idoso | diabetes hipertensão | tratamento contínuo
```

(c) **Screenshots strategy** (primeiros 3 = 80% conversão):
1. **Screenshot 1**: Tela alarme nativo fullscreen disparado (visual impact + keyword "alarme tela cheia")
2. **Screenshot 2**: Dashboard com 3-4 pacientes + "Doses Hoje 5/8" (multi-paciente USP)
3. **Screenshot 3**: Modal compartilhar paciente com família (cuidadores diferencial)
4. Screenshots 4-8: features secundárias (#160 PatientDetail, #161 alerts, histórico, paywall, ajustes)

Cada screenshot com **caption text overlay** keyword-rich (lib `screenshots-pro` ou Photoshop): "Alarme que TOCA ALTO" / "Multi-paciente" / "Compartilhe com família".

(d) **Vídeo preview Play Console** (30s):
- 0-3s: Hook (paciente idoso esquece remédio cena)
- 4-10s: Solução (Dosy alarme dispara, acorda paciente)
- 11-20s: Features carousel (multi-paciente + compartilhar + histórico)
- 21-27s: Use cases (diabetes/Alzheimer/cuidador)
- 28-30s: CTA "Baixe Dosy grátis" + logo

Gravação device real S25 Ultra Studio captura. Trilha sonora upbeat 30s (Epidemic Sound free tier).

(e) **A/B test Play Console experiment**:
- Variant A: screenshots ordem #1-#8 atual
- Variant B: screenshots reordem (alarme primeiro vs multi-paciente primeiro)
- 50/50 split 2 semanas
- Métrica: install conversion rate
- Vencedor → manter

**Dependências:**
- Console acesso (já tem)
- Vídeo gravação device real (need user manual ~1h)
- Screenshots regerar com text overlay (#155 + novos)

**Critério de aceitação:**
- ✅ Listing copy publicado Console com keywords distribuídas
- ✅ 8 screenshots com text overlay keyword-rich
- ✅ Vídeo preview 30s uploaded (YouTube unlisted + linked Console)
- ✅ A/B test experiment ativo Console
- ✅ Métricas baseline capturadas (install rate, store visit rate, conversion rate)

**Métrica esperada:**
- +30-50% Play Store conversion rate (visit → install)
- +20-40% organic install volume via keyword ranking

---

### #170 — Reviews Play Store strategy: In-App Review API + reply playbook

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (growth — ativar dia 1 Production)
- **Origem:** Análise concorrentes BR 2026-05-07
- **Esforço:** 4-5h
- **Release sugerida:** v0.2.2.0+

**Problema:**

Reviews Play Store são **trust signal crítico** + **ranking factor algoritmo**:
- Apps com 4.3+ rating + 50+ reviews convertem 3-5× mais que apps sem reviews
- Algoritmo ASO penaliza apps <4.0 rating (cai pra trás em searches)
- Negative reviews sem reply parecem app abandonado
- Solo dev sem reply rate alto = signal ruim pra Google

**Abordagem:**

(a) **In-App Review API integração**:

Plugin Capacitor: `@capacitor-community/in-app-review`

```bash
npm i @capacitor-community/in-app-review
npx cap sync android
```

```js
// src/services/inAppReview.js
import { InAppReview } from '@capacitor-community/in-app-review'
import { Capacitor } from '@capacitor/core'

const REVIEW_LS_KEY = 'dosy_review_prompt_seen'
const REVIEW_DEFER_DAYS = 90 // Re-prompt se user já viu há 90+ dias

export async function maybePromptReview() {
  if (Capacitor.getPlatform() !== 'android') return

  const seen = localStorage.getItem(REVIEW_LS_KEY)
  if (seen) {
    const seenDate = new Date(seen)
    const daysAgo = (Date.now() - seenDate.getTime()) / 86400000
    if (daysAgo < REVIEW_DEFER_DAYS) return
  }

  try {
    await InAppReview.requestReview()
    localStorage.setItem(REVIEW_LS_KEY, new Date().toISOString())
  } catch (e) {
    console.warn('In-app review failed:', e)
  }
}
```

(b) **Trigger inteligente** (não show no boot — happy path moments):

```js
// src/hooks/useReviewPrompt.js
import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { maybePromptReview } from '../services/inAppReview'

const TRIGGER_LS = 'dosy_review_trigger_state' // {dosesTaken, alarmsFired, daysActive, lastTrigger}

export function useReviewPrompt() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const state = JSON.parse(localStorage.getItem(TRIGGER_LS) || '{}')
    const eligible =
      (state.dosesTaken || 0) >= 3 &&
      (state.alarmsFired || 0) >= 1 &&
      (state.daysActive || 0) >= 7
    if (eligible) maybePromptReview()
  }, [user])
}

// Increment counters quando user faz ação positiva:
export function trackDoseTaken() {
  const state = JSON.parse(localStorage.getItem(TRIGGER_LS) || '{}')
  state.dosesTaken = (state.dosesTaken || 0) + 1
  localStorage.setItem(TRIGGER_LS, JSON.stringify(state))
}

export function trackAlarmFired() {
  const state = JSON.parse(localStorage.getItem(TRIGGER_LS) || '{}')
  state.alarmsFired = (state.alarmsFired || 0) + 1
  localStorage.setItem(TRIGGER_LS, JSON.stringify(state))
}
```

Wire em DoseModal (mark taken) + AlarmService (alarm fired) + App.jsx daysActive tracker.

(c) **Response template Play Console** (3 categorias):

**Positive (4-5 stars):**
```
Olá [Nome]! Obrigado pela avaliação 5 estrelas! Ficamos muito felizes que o Dosy está te ajudando a cuidar da sua [família/saúde]. Se tiver sugestões de novas features, me escreve em contato@dosymed.app! 💜
```

**Negative (1-2 stars):**
```
Olá [Nome], desculpe pela experiência ruim. Pode me contar exatamente o que aconteceu pra eu corrigir? Manda detalhes pra contato@dosymed.app que vou priorizar o fix. Quero muito que o Dosy funcione bem pra você.
```

**Feature request (3-4 stars + sugestão):**
```
Oi [Nome]! Boa sugestão sobre [feature]. Vou adicionar no roadmap. Algumas features parecidas estão em desenvolvimento: [feature relacionada]. Se quiser acompanhar updates, segue @dosymed no Instagram!
```

(d) **Reply playbook** (turnaround <24h):
- Verificar Play Console reviews diariamente (calendar reminder 9h)
- Responder TODAS reviews em <24h (inclusive 5 stars sem texto = "Obrigado!")
- Negative reviews: criar item ROADMAP novo + reply mencionando ETA fix
- Feature requests: agradecer + adicionar tag `[user-requested]` em ROADMAP CHECKLIST origem

(e) **Métricas tracking PostHog**:
```js
// Após maybePromptReview:
posthog.capture('review_prompted', { source: 'in_app' })
// User feedback (não temos visibilidade real review action mas trackeamos prompt)
```

**Dependências:**
- Plugin install + cap sync
- Hooks integration DoseModal + AlarmService + App.jsx
- Console reviews monitoring habit user

**Critério de aceitação:**
- ✅ Plugin instalado + funcional Android device real
- ✅ Trigger fires APENAS após 3 doses + 1 alarm + 7 days active
- ✅ Re-prompt 90 dias se user dismissed
- ✅ Console reply rate >90% reviews <24h turnaround
- ✅ Validado device real S25 Ultra (eligibility logic + native dialog)

**Métrica esperada:**
- 30-40% prompted users deixam review
- Review rate: 1 review per 50 MAU típico (Dosy: 10-30 reviews mês 6 com 1K MAU)
- Rating mantém 4.3+ se app funciona + replies acontecem

---

### #171 — Marketing orgânico playbook BR: Reddit + Instagram + LinkedIn + TikTok

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (growth — paralelo Production launch)
- **Origem:** Análise concorrentes BR 2026-05-07
- **Esforço:** 8-10h setup + 2-3h/semana ongoing
- **Release sugerida:** v0.2.2.0+ ongoing

**Problema:**

Solo dev sem marketing budget depende 100% orgânico. Brasil tem comunidades healthcare ativas em multiple platforms — Dosy precisa presença consistente sem virar spam.

**Abordagem:**

(a) **Reddit BR** target subs:

| Sub | Members | Estratégia |
|---|---|---|
| r/saude | 80K | Posts úteis (não-promo) + mention Dosy em comments quando relevante |
| r/idosos | 5K | Cuidadores idosos = persona PRO target |
| r/cuidadores | 3K | Direct fit |
| r/diabetes | 15K | Use case medicação contínua |
| r/tdah | 60K | Use case medicação psiquiátrica diária |
| r/bipolar | 8K | Use case adesão tratamento crítica |
| r/depressao | 25K | Use case medicação contínua + cuidador familiar |
| r/brasil | 1M | Posts ocasionais virais (não focused healthcare) |

Regras:
- 90% posts úteis (responder dúvidas + share knowledge)
- 10% promoção sutil (signature: "Eu uso o Dosy pra isso, é grátis: dosymed.app")
- Nunca spam direto = ban auto
- Karma build first (~1 mês posting útil antes de mention Dosy)

(b) **Instagram strategy**:

Hashtags BR healthcare (pesquisa Instagram explore):
- #cuidadosaude (1.2M posts)
- #cuidadoidoso (340K)
- #saudemental (8M)
- #medicacao (200K)
- #diabetesbrasil (450K)
- #cuidadorfamilia (90K)

Conteúdo strategy (3 posts/semana):
- 1 post educativo (carrossel "5 dicas pra organizar medicação idoso")
- 1 post UX Dosy (vídeo 30s feature highlight)
- 1 post user testimony (anônimo, com permissão)

Parcerias microinfluencers (10K-50K followers cuidadores):
- Lista 50 candidatos via search hashtags + manual review
- Outreach DM personalizada (não copy-paste)
- Permuta: PRO grátis 1 ano + R$ 100-300/post (budget total R$ 1-3K mês 1)
- Meta: 5-10 microinfluencers ativos mês 6

(c) **LinkedIn healthcare BR** (B2B trust):

Conteúdo:
- Posts sobre LGPD healthcare (autoridade técnica)
- Cases de cuidadores profissionais usando Dosy
- Articles long-form Dosy founder ("Por que criamos um app de medicação 100% LGPD compliant")

Network targets:
- Médicos geriatras BR
- Farmacêuticos clínicos
- Cuidadores profissionais
- Healthcare tech founders BR

(d) **TikTok healthcare BR**:

Formato POV cuidadora 30s:
- "POV: você cuida da sua mãe e nunca esquece um remédio porque..."
- "Como organizo os 7 remédios da minha avó"
- "Minha rotina manhã com app de medicação"

Hashtags: #cuidadoraidosa #saudefamilia #organizacaocuidador

3 vídeos/semana inicial. Algoritmo TikTok BR favorece autenticidade > production value.

(e) **Content calendar 6 meses**:

```
Semana 1-4 (mês 1):
- Reddit: 1 post útil/semana cada sub-prioritário (r/saude, r/idosos, r/cuidadores, r/diabetes, r/tdah)
- Instagram: 3 posts/semana (12 total mês 1)
- LinkedIn: 1 post/semana
- TikTok: 3 vídeos/semana

Semana 5-12 (mês 2-3):
- Outreach 50 microinfluencers Instagram
- Reddit: continuar útil + começar mention sutil
- Blog SEO #172 começa publicar (1 artigo/semana)

Semana 13-26 (mês 4-6):
- Parcerias 5-10 microinfluencers ativas
- Iterate winning content (double down 80/20)
- Avaliar metrics: MAU, conversion rate, CAC
```

**Dependências:**
- Conta Reddit autenticada (build karma 1 mês antes promo)
- Conta Instagram @dosymed (criar)
- Conta LinkedIn dosy.med (já tem? verificar)
- Conta TikTok @dosymed (criar)
- Budget R$ 1-3K mês 1 microinfluencer permuta

**Critério de aceitação:**
- ✅ Contas criadas + first posts publicados (4 platforms)
- ✅ Calendar 90 dias agendado (Buffer/Hootsuite ou planner manual)
- ✅ 5 microinfluencers ativos mês 3
- ✅ 50+ posts orgânicos publicados mês 3
- ✅ Métricas tracking: followers growth + click-through rate landing dosymed.app + Play Store install attribution UTM

**Métrica esperada:**
- 100-500 installs/mês orgânicos via Reddit (mês 3)
- 200-1000 installs/mês via Instagram parcerias (mês 6)
- Brand awareness BR healthcare niche +200% (mensurável via brand search "dosy app")

---

### #172 — Landing page dosymed.app marketing + blog SEO healthcare BR

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P2 (growth — SEO leva 6-12 meses indexar)
- **Origem:** Análise concorrentes BR 2026-05-07
- **Esforço:** 12-16h initial + 2h/artigo (24h total 12 artigos)
- **Release sugerida:** v0.2.3.0+ → v0.2.5.0+

**Problema:**

dosymed.app hoje só serve PWA + /privacidade + /termos. Sem SEO BR healthcare = invisible Google searches. Apps medicação BR top ranking (Medisafe, MyTherapy) têm sites com blog SEO + landing pages otimizadas há anos.

**Abordagem:**

(a) **Landing pages** (rotas novas Vite SSG ou client-rendered + meta tags):
- `/sobre` — Quem somos, missão, LGPD compliance, equipe
- `/pacientes` — App pra quem? Diabetes/Alzheimer/cuidadores idosos use cases
- `/cuidadores` — Multi-paciente + compartilhamento family-friendly
- `/precos` — Free vs PRO comparativa + FAQ pricing

Cada página: H1 com keyword primária + 800-1200 palavras + CTA Play Store + Schema.org markup.

(b) **Blog SEO** 12 artigos initial (1500+ palavras cada):

| Artigo | Keyword primária | Volume mensal BR |
|---|---|---|
| Como organizar medicação de idoso com Alzheimer | "organizar medicação idoso Alzheimer" | 1K |
| Alarme de dose esquecida pra diabetes tipo 2 | "alarme dose diabetes" | 800 |
| Compartilhar lembrete de remédio com a família via WhatsApp | "compartilhar medicação família" | 600 |
| Lembrete de medicação para ansiedade e depressão | "lembrete remédio ansiedade" | 1.5K |
| Top 5 apps de lembrete de remédio no Brasil 2026 | "melhor app lembrete remédio" | 3K |
| Como funciona o alarme nativo Android para medicação | "alarme medicação Android" | 500 |
| Cuidador de idosos: 7 dicas pra controlar medicações | "cuidador idoso medicação" | 800 |
| Tratamento contínuo: como não esquecer doses por meses | "tratamento contínuo medicação" | 400 |
| LGPD na saúde: dados médicos no app são seguros? | "LGPD saúde dados" | 300 |
| Diferença entre lembrete e alarme de medicação | "lembrete vs alarme remédio" | 200 |
| Como ajustar a dose de Mounjaro semanal pelo app | "Mounjaro lembrete semanal" | 1.2K (trending) |
| Top 10 medicamentos crônicos mais prescritos BR 2026 | "medicamentos mais prescritos BR" | 2K |

Cada artigo: H1+H2 hierarchy + meta description 150-160 chars + internal linking + outbound link autoridade (FDA, ANVISA) + CTA download Dosy.

(c) **Schema.org markup**:

Página inicial:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Dosy",
  "operatingSystem": "Android",
  "applicationCategory": "HealthApplication",
  "applicationSubCategory": "MedicalApplication",
  "offers": [
    {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "BRL",
      "name": "Free"
    },
    {
      "@type": "Offer",
      "price": "14.90",
      "priceCurrency": "BRL",
      "name": "PRO Mensal"
    }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "ratingCount": "150"
  }
}
</script>
```

Blog posts:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  "headline": "Como organizar medicação de idoso com Alzheimer",
  "datePublished": "2026-08-01",
  "author": { "@type": "Person", "name": "Luiz Henrique" },
  "audience": { "@type": "MedicalAudience", "audienceType": "Caregivers" }
}
</script>
```

(d) **OG tags + Twitter cards**:
```html
<meta property="og:title" content="Dosy: Lembrete de Remédios com Alarme Inteligente">
<meta property="og:description" content="Nunca esqueça uma dose. Alarme que toca alto, multi-paciente, compartilhamento com família.">
<meta property="og:image" content="https://dosymed.app/og-image.png">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```

(e) **Sitemap.xml + robots.txt + canonical URLs**:
```xml
<!-- /sitemap.xml -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://dosymed.app/</loc><priority>1.0</priority></url>
  <url><loc>https://dosymed.app/sobre</loc><priority>0.8</priority></url>
  <url><loc>https://dosymed.app/pacientes</loc><priority>0.8</priority></url>
  <url><loc>https://dosymed.app/cuidadores</loc><priority>0.8</priority></url>
  <url><loc>https://dosymed.app/precos</loc><priority>0.8</priority></url>
  <url><loc>https://dosymed.app/blog/organizar-medicacao-alzheimer</loc><priority>0.7</priority></url>
  <!-- ...11 more articles -->
</urlset>
```

**Dependências:**
- Vite static page rendering OR React Router routes + meta dinâmica via react-helmet
- Editor blog (markdown files src/content/blog/*.md OR Notion CMS)
- Domain SEO basics (verify Google Search Console + submit sitemap)

**Critério de aceitação:**
- ✅ 4 landing pages publicadas com SEO básico
- ✅ 12 artigos blog publicados (release distribuído ao longo 12 semanas)
- ✅ Schema.org markup validado Rich Results Test Google
- ✅ Google Search Console configurado + sitemap indexado
- ✅ Lighthouse SEO score ≥90 todas páginas
- ✅ 5+ artigos rankeando top 10 Google BR mês 6 (longtail keywords)

**Métrica esperada:**
- 500-2000 organic Google search visits/mês (mês 6)
- 1000-5000 organic visits/mês (mês 12)
- 5-15% conversion rate visit → install (50-300 installs/mês via SEO mês 12)
- SEO leva 6-12 meses indexar — investimento longprazo

---

### #173 — Healthcare differentiators moat: promove #064 #065 #066 P3→P1

- **Status:** ⏳ Aberto (umbrella; itens individuais ficam em §6.5 P3 mas com promotion note)
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (growth — diferencial vs Medisafe/MyTherapy/Pílula Certa)
- **Origem:** Análise concorrentes BR 2026-05-07
- **Esforço:** 15-22h total (#064: 8-12h, #065: 4-6h, #066: 3-4h)
- **Release sugerida:** v0.2.3.0+ → v0.3.0.0+

**Problema:**

Análise competitive: Medisafe, MyTherapy, Pílula Certa são genéricos pra reminder. Faltam features healthcare deep BR que cuidadores REAIS pedem:
- Verificação interações medicamentosas (ex: warfarin + ibuprofen = sangramento)
- Verificação alergias (ex: paciente alérgico AAS, medicação nova contém AAS)
- Estoque medicação (acabar sem aviso = adesão quebrada)
- Lembrete consulta médica (esquece consulta = receita expira = sem medicação)

Dosy pode criar moat real com essas 3 features + posicionamento marketing forte.

**Abordagem:**

**(a) #064 — Verificação interações medicamentosas + alergias** (8-12h, mais complexo):

Data sources:
- **OpenFDA Drug API** (US, free): https://open.fda.gov/apis/drug/
- **DrugBank API** (paid, mais completo)
- **ANVISA Bulário Eletrônico** (BR, scraping limitado)

Estratégia start: cache local OpenFDA → 1000 medicamentos top BR + interactions matrix:

```sql
-- Migration: medications + interactions tables
CREATE TABLE medcontrol.medications_db (
  id text PRIMARY KEY, -- e.g. "metformina-500mg"
  name text NOT NULL,
  active_ingredient text NOT NULL,
  category text, -- "antidiabetic", "anti-inflammatory"
  warnings text[]
);

CREATE TABLE medcontrol.medication_interactions (
  med_a text REFERENCES medcontrol.medications_db,
  med_b text REFERENCES medcontrol.medications_db,
  severity text, -- "minor", "moderate", "severe"
  description text,
  PRIMARY KEY (med_a, med_b)
);

CREATE TABLE medcontrol.patient_allergies (
  patient_id uuid REFERENCES medcontrol.patients,
  allergen text NOT NULL,
  severity text,
  notes text,
  PRIMARY KEY (patient_id, allergen)
);
```

Frontend: TreatmentForm verifica novo medicamento contra paciente.allergies + paciente.activeTreatments. Warning visual amarelo (interação moderada) ou vermelho (severa) com dialog confirma "ainda quero adicionar".

**(b) #065 — Estoque medicação + alerta acabando** (4-6h):

```sql
ALTER TABLE medcontrol.treatments
  ADD COLUMN stock_quantity integer,
  ADD COLUMN stock_unit text DEFAULT 'comprimidos',
  ADD COLUMN stock_low_threshold integer DEFAULT 7;
```

Cálculo dias até zero baseado em interval + dose:
```js
function daysUntilEmpty(treatment) {
  if (!treatment.stock_quantity) return null
  const dosesPerDay = 24 / treatment.intervalHours
  const dosesPerStock = treatment.stock_quantity / treatment.dose
  return Math.floor(dosesPerStock / dosesPerDay)
}
```

Alert header novo (#117/#118 padrão): "📦 Mounjaro acabando em 5 dias" → click → opção "Comprar" (Drogaria São Paulo / Drogasil affiliate links).

**(c) #066 — Lembrete consulta médica + Calendar export** (3-4h):

```sql
CREATE TABLE medcontrol.appointments (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  patient_id uuid REFERENCES medcontrol.patients,
  doctor_name text,
  specialty text,
  scheduled_at timestamptz NOT NULL,
  notes text,
  reminder_minutes integer DEFAULT 1440 -- 24h before
);
```

Frontend: `/consultas` rota nova + AppointmentCard + AppointmentForm. Local notification 24h before via Capacitor LocalNotifications (já temos infra). `.ics` export → user adiciona Google Calendar / Apple Calendar.

**Posicionamento marketing** (use em #169 listing copy + #171 social media):

> "Dosy é o ÚNICO app brasileiro de medicação com:
> ✅ Verificação automática de interações medicamentosas (alerta antes da dose)
> ✅ Controle de estoque (avisa antes de acabar)
> ✅ Agenda de consultas integrada
>
> Outros apps só lembram da hora. Dosy cuida do tratamento inteiro."

**Dependências:**
- #064 → OpenFDA API integration OR ANVISA scraping (8-12h)
- #065 → migration + UI (4-6h, simpler)
- #066 → migration + new route + Calendar export (3-4h)
- Atualização ROADMAP §6.5 P3 entries #064/#065/#066 com note "promovido P1 via #173"

**Critério de aceitação:**
- ✅ #064: TreatmentForm dispara warning interaction quando adiciona medicação que conflita com active treatment OR allergy paciente
- ✅ #065: PatientDetail mostra estoque + alert header "acabando" ≤7 dias
- ✅ #066: /consultas rota com appointment list + form + .ics export funcional
- ✅ Marketing copy atualizado #169 listing + #171 social
- ✅ Validação Chrome MCP preview + device real S25 Ultra

**Métrica esperada:**
- Differential ASO Play Store keyword "interações medicamentosas" (zero competidores BR atualmente)
- +20-30% conversion rate Free→PRO (features só PRO)
- Brand positioning "Dosy = sério" vs "Dosy = lembrete genérico"

---

> **Nota promotion #064/#065/#066:** entries originais em §6.5 ✨ MELHORIAS P3 ficam mantidas pra histórico mas com flag `[promovido P1 via #173]`. Quando implementar, mover entries do P3 pra fechado normal (✅).

---

## Plano features differentiators concorrentes (análise gap 2026-05-07)

> **Análise concorrentes BR/global:** Medisafe (~200K MAU BR) tem drug interactions parcial, sem OCR forte; MyTherapy (~100K BR) tem mood tracking + medições simples; Pílula Certa (~500K BR) só nicho contraceptivos; Cuidador.io (~50K) B2B fragmento. Gaps Dosy pode atacar:
> - **Onboarding friction**: nenhum BR tem OCR forte caixa+receita auto-import (#174 #175)
> - **B2B trust healthcare**: report PDF visual robusto pra médico nenhum tem (#176)
> - **Cultural BR**: WhatsApp dominância 90% smartphones — feature share dose status nenhum BR tem (#177)
> - **Acessibilidade**: Wear OS BR Galaxy Watch crescendo (#179) + voz/TTS idosos baixa visão (#181)
> - **Healthcare deep**: health metrics correlação dose-outcome (#180) + mood tracking psiquiátrica (#182)
> - **Niche profundo**: modo Alzheimer escalada nenhum tem (#178)
> - **Monetização extra**: refill affiliate (#183) + telemedicina integration (#184)
> - **B2B mode profissional**: Cuidador.io fragmento, espaço pra Dosy (#185)
> - **Ecosystem**: Apple Health/Google Fit (#186) + receita digital BR Memed/Nexodata (#187)
>
> Decisão user 2026-05-07: iOS (#068) **NÃO promove** antes tração Android — custo dev/validação/infra alto. Foca Android-first 100%.

### #174 — OCR camera medication scan (foto caixa → auto-cadastro)

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (growth differentiator launch)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 8-12h
- **Release:** v0.2.2.0+

**Problema:** Onboarding TreatmentForm friction — user digita manualmente nome med + dose + interval (5min cadastro 1 medicamento). Idosos abandonam.

**Abordagem:** Plugin `@capacitor-mlkit/text-recognition` (Google ML Kit on-device, free, offline-capable):

```bash
npm i @capacitor-mlkit/text-recognition
npx cap sync
```

```js
// src/services/ocrMedication.js
import { TextRecognition, TextRecognitionLanguage } from '@capacitor-mlkit/text-recognition'

export async function scanMedicationBox(photoUri) {
  const { text } = await TextRecognition.recognizeText({
    path: photoUri,
    language: TextRecognitionLanguage.Latin
  })
  return parseMedicationLabel(text)
}

function parseMedicationLabel(rawText) {
  // Regex BR med labels: "METFORMINA 500mg" / "Mounjaro 5mg/0.5ml" / "Aspirin 100mg"
  const lines = rawText.split('\n')
  const medMatch = lines.find(l => /[A-Z]{4,}\s+\d+\s*(mg|mcg|g|ml|ui)/i.test(l))
  const doseMatch = medMatch?.match(/(\d+)\s*(mg|mcg|g|ml|ui)/i)

  // ANVISA RDC bulário scraping (futuro): match medName → known interval
  return {
    medName: medMatch?.replace(doseMatch?.[0], '').trim() || '',
    dose: doseMatch?.[1] || '',
    unit: doseMatch?.[2] || 'mg',
    rawText, // user pode editar
  }
}
```

UX TreatmentForm: botão "📷 Escanear caixa" → Camera plugin → ML Kit OCR → preview parsed fields user edita confirma → salva treatment.

**Critério aceitação:**
- ✅ Plugin instalado + funcional Android device real
- ✅ OCR retorna text bruto + parsed structured fields confidence scoring
- ✅ User edita campos antes salvar (não auto-save sem review)
- ✅ Suporta offline (ML Kit on-device)
- ✅ 80%+ accuracy em 20 caixas BR test set (Mounjaro/Metformina/Pantoprazol/Losartana/etc)

**Métrica esperada:**
- Onboarding cadastro 1 med: 5min → 30s (-90%)
- Conversion rate primeira sessão: +30-40%

---

### #175 — Receita médica scan OCR auto-import (foto receita → batch treatments)

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (growth differentiator launch — único BR)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 12-16h
- **Release:** v0.2.2.0+ → v0.2.3.0+

**Problema:** User chega Dosy com receita médica papel/PDF → cadastrar 5 medicamentos manualmente = 25min friction. Receita médica BR estruturada (RDC ANVISA): nome paciente + médico CRM + medicamentos + posologia.

**Abordagem:** Mesmo ML Kit OCR (#174) + parser regex robusto receita BR + UX confirmação batch:

```js
// src/services/ocrPrescription.js
export async function scanPrescription(photoUri) {
  const { text } = await TextRecognition.recognizeText({ path: photoUri })
  return parsePrescriptionBR(text)
}

function parsePrescriptionBR(rawText) {
  const lines = rawText.split('\n')

  // Extrai paciente (após "Paciente:" ou "Nome:")
  const patientLine = lines.find(l => /paciente|nome:/i.test(l))
  const patientName = patientLine?.replace(/^.*?:/, '').trim()

  // Extrai medicamentos (linhas estruturadas: "1. METFORMINA 500mg - tomar 1cp 2x ao dia")
  const medRegex = /^\d+[\.\)]\s*([A-Z\s]+)\s+(\d+\s*(?:mg|mcg|g|ml|ui))[\s\-]+(.+)/gim
  const meds = []
  let match
  while ((match = medRegex.exec(rawText)) !== null) {
    const [, medName, dose, posology] = match
    const intervalHours = parsePosology(posology) // "2x ao dia" → 12; "8/8h" → 8
    meds.push({ medName: medName.trim(), dose, intervalHours, posology })
  }

  // Médico CRM (rodapé)
  const crmLine = lines.find(l => /CRM[\s\-:]/i.test(l))

  return { patientName, meds, doctor: crmLine, rawText }
}

function parsePosology(text) {
  const lower = text.toLowerCase()
  if (/\b(\d+)x?\s*(?:ao dia|por dia|\/dia)\b/.test(lower)) {
    const n = parseInt(RegExp.$1)
    return Math.round(24 / n)
  }
  if (/\b(\d+)\/(\d+)h\b/.test(lower)) return parseInt(RegExp.$1)
  if (/\bcada\s+(\d+)\s*horas?\b/.test(lower)) return parseInt(RegExp.$1)
  if (/\bsemanal|1x?\s*por semana\b/.test(lower)) return 168
  if (/\bmensal|1x?\s*por m[eê]s\b/.test(lower)) return 720
  return 24 // default diário
}
```

UX: PatientDetail → botão "📋 Importar receita" → Camera → ML Kit OCR → preview list parsed meds → user edita/confirma cada → salva batch treatments.

**Critério aceitação:**
- ✅ OCR receita 1 página retorna 5+ medicamentos estruturados
- ✅ Posology parser cobre 80%+ formatos BR ("2x ao dia", "8/8h", "1cp cada 12h", "semanal")
- ✅ User edita lista antes batch save (não auto-save)
- ✅ Validado 10 receitas reais BR (acumular dataset progressivo)
- ✅ Patient name auto-fill se já existe paciente (matching nome similar)

**Métrica esperada:**
- Onboarding 5 medicamentos receita: 25min → 2min (-92%)
- Único concorrente BR com feature → ASO listing differentiator forte

---

### #176 — Adesão report PDF/email pra médico 30/60/90d

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (B2B trust healthcare professional)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 6-8h
- **Release:** v0.2.2.0+

**Problema:** Médico precisa saber adesão tratamento. User leva consulta sem dados → médico ajusta cego. App pode gerar report visual robusto.

**Abordagem:** Edge function Puppeteer ou client `jsPDF` + email Resend SMTP (#154):

```js
// src/services/adesaoReport.js
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export async function generateAdherenceReport(patientId, periodDays = 30) {
  const doses = await listDosesRange({ patientId, days: periodDays })
  const taken = doses.filter(d => d.status === 'taken').length
  const skipped = doses.filter(d => d.status === 'skipped').length
  const overdue = doses.filter(d => d.status === 'overdue').length
  const adherenceRate = (taken / doses.length * 100).toFixed(1)

  const doc = new jsPDF()
  doc.setFontSize(20)
  doc.text(`Relatório de Adesão — Dosy`, 14, 20)
  doc.setFontSize(12)
  doc.text(`Paciente: ${patient.name}`, 14, 35)
  doc.text(`Período: ${periodDays} dias`, 14, 42)
  doc.text(`Adesão: ${adherenceRate}%`, 14, 49)

  // Stats summary
  doc.autoTable({
    startY: 60,
    head: [['Status', 'Doses']],
    body: [
      ['Tomadas', taken],
      ['Puladas', skipped],
      ['Atrasadas', overdue],
    ],
  })

  // Detalhe por medicamento
  const byMed = groupBy(doses, 'medName')
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 10,
    head: [['Medicamento', 'Dose', 'Adesão %', 'Tomadas/Total']],
    body: Object.entries(byMed).map(([med, list]) => {
      const t = list.filter(d => d.status === 'taken').length
      return [med, list[0].dose, `${(t/list.length*100).toFixed(0)}%`, `${t}/${list.length}`]
    }),
  })

  return doc.output('blob')
}

export async function emailAdherenceReport(patientId, doctorEmail, periodDays = 30) {
  const pdfBlob = await generateAdherenceReport(patientId, periodDays)
  // Edge function envia email via Resend com PDF attachment
  await supabase.functions.invoke('send-adherence-report', {
    body: { patientId, doctorEmail, periodDays, pdfBase64: await blobToBase64(pdfBlob) }
  })
}
```

UX PatientDetail → botão "📊 Relatório pra médico" → modal escolhe período (30/60/90d) + email médico → gera PDF + envia via Resend.

**Critério aceitação:**
- ✅ PDF gerado com header Dosy + stats summary + detalhe por med
- ✅ Email enviado via Resend SMTP com PDF attachment
- ✅ User pode também baixar PDF local (sem email)
- ✅ Período 30/60/90d cobertos
- ✅ Médico recebe email visual profissional (não plain text)

**Métrica esperada:**
- B2B trust healthcare professional ↑ (médicos recomendam app pacientes)
- Differential vs MyTherapy weekly email simples

---

### #177 — WhatsApp share dose status (cuidador remoto cultural BR)

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (cultural BR launch)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 3-4h
- **Release:** v0.2.2.0+

**Problema:** Filha distante quer saber se mãe tomou remédio. Hoje liga/manda mensagem manual. WhatsApp dominante BR (90%+ smartphones).

**Abordagem:** Deep link WhatsApp pre-formatted message:

```js
// src/components/ShareDoseStatusButton.jsx
function shareDoseStatus(dose, patient) {
  const status = dose.status === 'taken' ? '✅ Tomou' : dose.status === 'skipped' ? '⏭️ Pulou' : '⏰ Atrasado'
  const time = formatTime(dose.takenAt || dose.scheduledAt)
  const text = `${patient.name} ${status} ${dose.medName} ${dose.dose}${dose.unit} às ${time} 💊\n\nDosy: dosymed.app`
  const encoded = encodeURIComponent(text)

  // Universal WhatsApp deeplink (works web + app)
  const url = `https://wa.me/?text=${encoded}`
  window.open(url, '_blank')
}
```

UX: PatientDetail → DoseCard tem botão "📱 Compartilhar" (alongside já existing actions) → click abre WhatsApp picker contato → user escolhe família → mensagem pre-formatted enviada.

Versão PRO: configurar "auto-share doses" → toda dose tomada gera WhatsApp share automático pra contato configurado (filho/cuidador).

**Critério aceitação:**
- ✅ Botão share funciona Android (WhatsApp app) + Web (WhatsApp Web)
- ✅ Mensagem pre-formatted clara + signature dosymed.app
- ✅ Múltiplas linguagens dose status (Tomou/Pulou/Atrasado/Encerrou)
- ✅ Validado device real Galaxy S25 Ultra + Android emulator

**Métrica esperada:**
- Word-of-mouth orgânico forte ("nossa, isso ajuda demais!" → instala app)
- Cultural BR fit: 90% market WhatsApp

---

### #178 — Modo Alzheimer escalada (alarme intensifica + SMS/WhatsApp cuidador)

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (healthcare niche profundo)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 6-8h
- **Release:** v0.2.3.0+

**Problema:** Paciente Alzheimer/demência não responde alarme normal (esquece, não entende, dorme profundo). Cuidador remoto não sabe.

**Abordagem:** Toggle PatientForm "Cuidados especiais (Alzheimer/demência)" → ativa modo escalada:

```js
// android/app/src/main/java/com/dosyapp/dosy/AlarmActivity.java extending #083 FCM-driven alarm
// Após alarm dispara:
// T+0: Volume normal + vibração padrão
// T+5min sem dismiss: Volume 2× + vibração contínua
// T+10min sem dismiss: SMS/WhatsApp cuidador via Edge function
// T+15min sem dismiss: 2ª chamada cuidador

// supabase/functions/escalate-alarm/index.ts
serve(async (req) => {
  const { doseId, patientId, level } = await req.json()
  const patient = await getPatient(patientId)
  const caregivers = await getPatientCaregivers(patientId) // patient_shares

  if (level === 'sms') {
    await sendTwilioSMS(caregivers[0].phone, `⚠️ ${patient.name} não tomou ${dose.medName} (alarme não atendido)`)
  } else if (level === 'whatsapp') {
    await sendWhatsAppBusinessAPI(caregivers[0].phone, escalation_template)
  }
})
```

UX:
- PatientForm: toggle "Cuidados especiais" → ativa modo
- Settings global: configurar canal escalation (SMS/WhatsApp/Push) + cooldown
- Cuidador recebe alerta: deep link app cuidador → vê paciente + dose missed

**Dependências:**
- #117 patient_share (existente — caregivers list)
- Twilio account ($1/100 SMS BR) ou WhatsApp Business API
- Phone field paciente_shares (migration adicionar)

**Critério aceitação:**
- ✅ Toggle Alzheimer mode ativa escalada (default off)
- ✅ T+5 / T+10 / T+15 escalation triggers funcionais
- ✅ Cuidador recebe notif + deep link
- ✅ Validado device real S25 Ultra + emulador

**Métrica esperada:**
- Niche real-world saver — Alzheimer = 1.2M BR (IBGE)
- Differentiator único no mercado mundial

---

### #179 — Wear OS / Galaxy Watch support (alarme pulso)

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (acessibilidade + diferencial)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 8-12h
- **Release:** v0.2.3.0+

**Problema:** Idoso dorme profundo, celular longe (cabeceira/sala), perde alarme. Galaxy Watch BR mercado crescendo.

**Abordagem:** Wear OS API native bridge Android (custom Capacitor plugin OR `@capacitor/wear` se existir):

```kotlin
// android/app/src/main/java/com/dosyapp/dosy/WearAlarmHandler.kt
class WearAlarmHandler(context: Context) {
  fun sendAlarmToWear(doseId: String, medName: String) {
    val dataClient = Wearable.getDataClient(context)
    val request = PutDataMapRequest.create("/dose-alarm")
      .apply {
        dataMap.putString("doseId", doseId)
        dataMap.putString("medName", medName)
        dataMap.putLong("timestamp", System.currentTimeMillis())
      }
      .asPutDataRequest()
      .setUrgent()

    dataClient.putDataItem(request)
  }
}
```

Wear app companion separate (Android Studio Wear OS template) — display alarm + buttons "Tomei" / "Adiar".

**Dependências:**
- Wear OS companion app (separate AAB linked main app)
- Test em Galaxy Watch real (user precisa hardware)

**Critério aceitação:**
- ✅ Alarm dispara celular + watch simultaneous
- ✅ Dismiss via watch button → main app marca dose taken
- ✅ Vibração watch funcional

**Métrica esperada:**
- BR Galaxy Watch market crescendo (Samsung dominante)
- Diferencial vs Medisafe (sem Wear OS)

---

### #180 — Health metrics tracking (PA, glicemia, peso, temperatura)

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (healthcare deep)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 10-14h
- **Release:** v0.2.3.0+

**Problema:** Diabéticos precisam glicemia + medicação link; hipertensos PA + med. Hoje user tem app separado pra metrics.

**Abordagem:** Schema novo + UX integrate dose tomada:

```sql
CREATE TABLE medcontrol.health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  patient_id uuid REFERENCES medcontrol.patients,
  metric_type text NOT NULL, -- 'blood_pressure', 'glucose', 'weight', 'temperature'
  value_numeric numeric, -- 110 (glicemia mg/dL) ou 75 (peso kg)
  value_systolic integer, value_diastolic integer, -- BP only
  unit text NOT NULL,
  measured_at timestamptz DEFAULT now(),
  related_dose_id uuid REFERENCES medcontrol.doses, -- linked metric
  notes text
);

CREATE INDEX idx_health_metrics_patient_time ON medcontrol.health_metrics(patient_id, measured_at DESC);
```

UX:
- DoseModal "Tomada" → opcional input metric (ex: "Antes de tomar Mounjaro: glicemia ___")
- PatientDetail nova section "Saúde": chart trend 30/60/90d (lib `recharts` ou `victory`)
- Form rápido add metric standalone (sem dose linked)

**Critério aceitação:**
- ✅ 4 metric types funcionais
- ✅ Chart trend renderiza patient detail
- ✅ Linked metric ↔ dose visível (correlação dose-outcome)
- ✅ Export CSV pra médico

**Métrica esperada:**
- Diabéticos retention ↑ (glicemia + dose linked = único app)
- PRO upsell (feature exclusiva PRO?)

---

### #181 — Voz/TTS prompts + comando voz (acessibilidade idosos baixa visão)

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (acessibilidade)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 6-8h
- **Release:** v0.2.3.0+

**Problema:** Idoso baixa visão não vê tela. TalkBack ajuda mas é genérico. App pode ser pro-ativo: alarme dispara → TTS fala "É hora do Mounjaro 14:30".

**Abordagem:**

```js
// src/services/voice.js
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

export async function speakDoseAlarm(dose) {
  await TextToSpeech.speak({
    text: `É hora do ${dose.medName}, ${dose.dose}${dose.unit}, às ${formatTime(dose.scheduledAt)}.`,
    lang: 'pt-BR',
    rate: 0.9, // levemente mais lento idosos
    pitch: 1.0,
  })
}

export async function listenForDoseConfirmation() {
  await SpeechRecognition.requestPermission()
  const result = await SpeechRecognition.start({
    language: 'pt-BR',
    maxResults: 3,
    prompt: 'Diga "tomei minha dose" ou "pulei"',
    partialResults: false,
    popup: false,
  })
  const text = result.matches?.[0]?.toLowerCase() || ''
  if (/tomei|tomado|sim/i.test(text)) return 'taken'
  if (/pulei|pulou|não/i.test(text)) return 'skipped'
  return null
}
```

UX Settings: toggle "Acessibilidade voz" → ativa TTS em alarmes + comando voz pós alarme. AlarmActivity dispara → TTS fala → após 3s auto-listen 5s → marca dose status.

**Critério aceitação:**
- ✅ TTS PT-BR clear pronunciation medicamentos
- ✅ Comando voz reconhece "tomei" / "pulei" / "adiar" 80%+ accuracy
- ✅ Toggle Settings off por default (opt-in)
- ✅ Validado device real S25 Ultra + idoso real test (user pai/mãe?)

**Métrica esperada:**
- Acessibilidade demographic +30% (idosos baixa visão são target heavy)

---

### #182 — Symptom diary + mood tracking (antes/depois dose)

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P3 (backlog futuro)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 6-8h
- **Release:** v0.3.0.0+

**Problema:** Medicação psiquiátrica (ansiedade/depressão/bipolar) requer ajuste fino baseado em sintomas/humor. App pode capturar.

**Abordagem:**

```sql
CREATE TABLE medcontrol.symptom_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  patient_id uuid REFERENCES medcontrol.patients,
  related_dose_id uuid REFERENCES medcontrol.doses,
  mood_score integer CHECK (mood_score BETWEEN 1 AND 5), -- 😢😞😐🙂😊
  symptoms text[], -- ['ansiedade', 'fadiga', 'dor cabeça']
  notes text,
  logged_at timestamptz DEFAULT now()
);
```

UX DoseModal "Tomada" → após mark taken, opcional "Como se sente?" emoji 5-scale + sintomas checkbox + observation. Trend chart PatientDetail seção "Saúde".

**Critério aceitação:**
- ✅ Mood tracking 5-emoji scale
- ✅ Symptoms common BR list (psiquiátrica + crônica)
- ✅ Trend chart 30d/60d
- ✅ Export combined dose+mood (correlação)

---

### #183 — Refill affiliate links Drogasil/Drogaria SP/Pague Menos

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (monetização extra — combinado #065 estoque)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 4-6h (incluindo signup affiliate)
- **Release:** v0.2.3.0+ (depende #065 implementado primeiro)

**Problema:** User estoque acabando precisa comprar. App pode oferecer atalho + ganhar comissão.

**Abordagem:**

Signup affiliate programs:
- Drogasil afiliados (via Lomadee ou direto)
- Drogaria São Paulo afiliados
- Pague Menos afiliados
- Raia afiliados

Deeplinks com tracking ID afiliado:

```js
// src/services/refillLinks.js
const AFFILIATE_LINKS = {
  drogasil: (medName) => `https://www.drogasil.com.br/search?q=${encodeURIComponent(medName)}&utm_source=dosy&utm_medium=affiliate&utm_id=DOSY123`,
  drogaria_sp: (medName) => `https://www.drogariasaopaulo.com.br/search?...`,
  paguemenos: (medName) => `https://www.paguemenos.com.br/search?...`,
  raia: (medName) => `https://www.drogaraia.com.br/search?...`,
}

export function getRefillOptions(medName) {
  return Object.entries(AFFILIATE_LINKS).map(([store, fn]) => ({
    store,
    url: fn(medName),
    name: STORE_NAMES[store],
  }))
}
```

UX: alert header novo (#117/#118 padrão) "📦 Mounjaro acabando — Comprar?" → click → bottom sheet 4 drogarias → click drogaria → abre app/web com search pre-filled medicamento.

**Dependências:**
- #065 estoque implementado (#173)
- Affiliate programs signup (1-2 semanas approval cada)

**Critério aceitação:**
- ✅ 4 drogarias deeplinks funcionais
- ✅ Tracking ID afiliado validado (clicks tracked)
- ✅ Sheet UX consistent Dosy primitives
- ✅ Settings toggle off (user opt-out se não quer)

**Métrica esperada:**
- 2-5% comissão venda (R$ 50 venda Mounjaro = R$ 1-2.50)
- Volume escala 1000 MAU = ~100 refill clicks/mês = R$ 100-250/mês adicional

---

### #184 — Telemedicina integration (Doctoralia/Conexa Saúde/Drogasil Telemedicina)

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P3 (backlog futuro — depende parcerias)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 8-12h
- **Release:** v0.3.0.0+

**Abordagem:** Botão "Agendar consulta" PatientDetail → opções providers parceiros affiliate. Doctoralia API (limited public) ou deeplinks.

**Critério aceitação:** Deeplinks 3 providers funcionais + tracking affiliate + UX consent privacy.

---

### #185 — Cuidador profissional B2B mode (1 cuidador 5+ idosos diferentes residências)

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P3 (B2B mercado nicho)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 16-24h (UX redesign + RLS expansion)
- **Release:** v0.4.0.0+ (mais futuro)

**Abordagem:** Toggle Settings "Modo cuidadora profissional" → habilita gerenciar 5+ pacientes residências distintas + reports separados + cobranças por hora cuidado (futuro).

**Dependências:** #117 patient_share expansion + RLS rework + UX redesign navegação multi-residência.

---

### #186 — Apple Health / Google Fit / Samsung Health bidirectional sync

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P3 (ecosystem integration)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 12-16h
- **Release:** v0.3.0.0+ (depende #180 health metrics)

**Abordagem:** Plugin `@capacitor-community/health` (ou Health Connect Android API). Doses Dosy → Health platforms; metrics #180 → Health platforms.

**Critério aceitação:** Bidirectional sync funcional + user consent + privacy controls granulares.

---

### #187 — Receita digital prescription import (Memed, Nexodata BR)

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P3 (BR-specific future-proof)
- **Origem:** Análise gap concorrentes 2026-05-07
- **Esforço:** 12-20h
- **Release:** v0.3.0.0+

**Abordagem:** Memed (1ª receita digital BR) + Nexodata API integração. User receba receita digital → app importa automático criando treatments. Diferente #175 OCR scan — esse é integração nativa receita digital pre-formatted.

**Dependências:** Signup parceria Memed/Nexodata API + RDC ANVISA compliance.

**Critério aceitação:** Import automático batch treatments + paciente nome match + médico CRM linked.

---

### #188 — 🔥 Mini IA Chat: cadastro tratamento via escrita/fala natural (KILLER FEATURE mundial)

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (KILLER differentiator launch — único mundial)
- **Origem:** User feedback 2026-05-07
- **Esforço:** 12-18h (V1 escrita) + 4-6h (V2 voz future)
- **Release:** v0.2.2.0+ → v0.2.3.0+

**Problema:**

Onboarding TreatmentForm friction massivo: user navega 6 campos (paciente + medName + dose + unit + intervalHours + durationDays) digitando manualmente. Idosos e cuidadores apressados abandonam. Mesmo com #174 OCR caixa + #175 OCR receita, ainda há fluxo: "tenho receita papel? OCR. Tenho caixa? OCR. Apenas sei o que médico falou? digito manual."

**Solução:**

Floating chat button bottom-right (Dosy primary peach) → Sheet chat UI → user digita frase natural ("Desloratadina 10 dias 5ml 8 em 8 horas pro Rael") → backend NLP parser via Claude API tool use → returna structured fields → app preview parsed → user edita/confirma → salva treatment.

**Exemplos input natural reconhecidos:**

```
"Desloratadina 10 dias 5ml 8 em 8 horas pro Rael"
→ {patient:"Rael", med:"Desloratadina", dose:5, unit:"ml", interval:8h, duration:10d}

"Mãe Mounjaro 5mg semanal por 6 meses"
→ {patient:"Mãe", med:"Mounjaro", dose:5, unit:"mg", interval:168h, duration:180d}

"Dipirona 1 comprimido cada 6 horas até melhorar"
→ {med:"Dipirona", dose:1, unit:"cp", interval:6h, isContinuous:true}

"Aspirin 100mg uma vez ao dia pro pai começando amanhã às 8h"
→ {patient:"pai", med:"Aspirin", dose:100, unit:"mg", interval:24h, isContinuous:true, startDate:"tomorrow", startTime:"08:00"}

"Anticoncepcional 21 dias 1cp 24h pra mim"
→ {patient:"<self>", med:"Anticoncepcional", dose:1, unit:"cp", interval:24h, duration:21d}
```

**Arquitetura técnica:**

**Decisão arquitetural: Claude API Haiku via Edge function gateway com tool use.**

Rationale:
- **Haiku** ($0.25/$1.25 1M tokens) suficiente pra task simple parsing
- **Tool use** garante structured output (zero hallucination JSON)
- **Edge function gateway** centraliza: API key não exposta cliente + rate limit + audit log + futura migração modelo (Sonnet/Opus se precisar)
- **Privacy**: user consent antes 1ª vez (envia frase pra Anthropic — disclaimer explícito)
- **Cost**: ~$0.000375/request × 5000 req/mês 1000 MAU = $1.88/mês ≈ R$10

**Edge function gateway:**

```ts
// supabase/functions/parse-treatment-nl/index.ts
import { serve } from 'jsr:@std/http/server'
import Anthropic from 'npm:@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const TREATMENT_TOOL = {
  name: 'create_treatment',
  description: 'Extract medication treatment fields from natural language Portuguese-BR text',
  input_schema: {
    type: 'object',
    properties: {
      patientHint: { type: 'string', description: 'First name or relationship (mãe/pai/eu/<name>)' },
      medName: { type: 'string', description: 'Medication name capitalized (Mounjaro, Desloratadina)' },
      dose: { type: 'number', description: 'Numeric dose value (5, 100, 1)' },
      unit: { type: 'string', enum: ['mg','mcg','g','ml','ui','cp','gota','spray'] },
      intervalHours: { type: 'number', description: '24=diário, 168=semanal, 8=8/8h, 720=mensal' },
      durationDays: { type: 'number', description: 'null se contínuo' },
      isContinuous: { type: 'boolean' },
      startDate: { type: 'string', description: 'YYYY-MM-DD ou null se hoje. "amanhã"→D+1' },
      startTime: { type: 'string', description: 'HH:MM ou null' },
      confidence: { type: 'string', enum: ['high','medium','low'] },
      missingFields: { type: 'array', items: { type: 'string' }, description: 'Campos não inferidos' },
    },
    required: ['medName', 'dose', 'unit', 'intervalHours', 'confidence']
  }
}

serve(async (req) => {
  // CORS + auth
  const { text, userId } = await req.json()

  // Rate limit (1 req/3s per user via Redis/memory)
  if (await isRateLimited(userId)) {
    return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 })
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    tools: [TREATMENT_TOOL],
    tool_choice: { type: 'tool', name: 'create_treatment' },
    system: `Você é um assistente que extrai dados de tratamento médico de texto em português-BR.
Reconheça padrões: "8 em 8 horas"=8h, "8/8h"=8h, "uma vez ao dia"=24h, "semanal"=168h, "mensal"=720h.
Reconheça pacientes: nomes próprios, "mãe/pai/filho/avó", "pra mim"="<self>".
Reconheça datas: "hoje"=null, "amanhã"=D+1, "começando dia X"=parse.
Se faltar info crítica, retorne confidence=low + listMissingFields.`,
    messages: [{ role: 'user', content: text }]
  })

  const toolUse = response.content.find(c => c.type === 'tool_use')
  if (!toolUse) {
    return new Response(JSON.stringify({ error: 'parse_failed', rawText: text }), { status: 400 })
  }

  // Audit log (não persistir text — privacy)
  await supabase.from('medcontrol.nl_parse_audit').insert({
    user_id: userId,
    confidence: toolUse.input.confidence,
    missing_fields: toolUse.input.missingFields,
    parsed_at: new Date()
  })

  return new Response(JSON.stringify(toolUse.input), { status: 200 })
})
```

**Frontend Chat UI:**

```jsx
// src/components/ChatNLPSheet.jsx
import { useState } from 'react'
import { Sheet, Button, Input } from './primitives'
import { MessageCircle, Send, Mic } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { TreatmentPreviewModal } from './TreatmentPreviewModal'

export function FloatingChatButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 90, right: 20, // above bottom nav
          width: 56, height: 56, borderRadius: 9999,
          background: 'var(--dosy-primary)',
          color: 'white', border: 'none',
          boxShadow: 'var(--dosy-shadow-lg)',
          zIndex: 50, cursor: 'pointer',
        }}
        aria-label="Cadastrar tratamento via chat"
      >
        <MessageCircle size={24} strokeWidth={2} />
      </button>
      <ChatNLPSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function ChatNLPSheet({ open, onClose }) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState(null)

  const examples = [
    'Desloratadina 10 dias 5ml 8 em 8 horas pro Rael',
    'Mãe Mounjaro 5mg semanal por 6 meses',
    'Dipirona 1cp cada 6h até melhorar',
    'Anticoncepcional 21 dias 1cp por dia pra mim',
  ]

  async function send() {
    if (!input.trim()) return
    setHistory(h => [...h, { role: 'user', text: input }])
    setParsing(true)

    const { data, error } = await supabase.functions.invoke('parse-treatment-nl', {
      body: { text: input }
    })

    setParsing(false)
    if (error || data.error) {
      setHistory(h => [...h, {
        role: 'assistant',
        text: 'Não consegui entender. Tenta reformular ou usa o cadastro manual.'
      }])
      return
    }

    if (data.confidence === 'low' || data.missingFields?.length > 0) {
      setHistory(h => [...h, {
        role: 'assistant',
        text: `Entendi parcialmente. Faltam: ${data.missingFields.join(', ')}. Pode completar?`
      }])
    }

    setPreview(data)
    setInput('')
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Cadastrar tratamento">
        {history.length === 0 && (
          <div>
            <p style={{ fontSize: 14, color: 'var(--dosy-fg-secondary)' }}>
              Escreva naturalmente, ex:
            </p>
            {examples.map(ex => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: 10, marginTop: 8, borderRadius: 8,
                  background: 'var(--dosy-bg-elevated)',
                  border: '1px solid var(--dosy-border)',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                "{ex}"
              </button>
            ))}
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} style={{
            margin: '12px 0', padding: 10, borderRadius: 12,
            background: msg.role === 'user' ? 'var(--dosy-primary)' : 'var(--dosy-bg-elevated)',
            color: msg.role === 'user' ? 'white' : 'var(--dosy-fg)',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
          }}>
            {msg.text}
          </div>
        ))}

        {parsing && <div>Pensando...</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ex: Desloratadina 10 dias 5ml 8/8h pro Rael"
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <Button onClick={send} kind="primary" disabled={parsing}>
            <Send size={18} />
          </Button>
          {/* V2 future: voz */}
          {/* <Button onClick={startVoice} kind="ghost"><Mic size={18}/></Button> */}
        </div>
      </Sheet>

      {preview && (
        <TreatmentPreviewModal
          parsed={preview}
          onConfirm={async (final) => {
            await createTreatment(final)
            setPreview(null)
            onClose()
            // Reset state
          }}
          onCancel={() => setPreview(null)}
        />
      )}
    </>
  )
}
```

**Privacy consent flow** (1ª vez user usa chat):

```jsx
// PrivacyConsentModal antes 1ª chamada
<Modal title="Sobre o Chat IA">
  <p>O chat usa inteligência artificial (Anthropic Claude) pra entender suas frases.</p>
  <p>O texto que você escrever é enviado pra Anthropic processar. Nenhum dado pessoal seu (nome, email) é incluído.</p>
  <p>Você pode usar o cadastro manual a qualquer momento.</p>
  <Button onClick={accept}>Entendi e quero usar</Button>
  <Button kind="ghost" onClick={cancel}>Prefiro cadastro manual</Button>
</Modal>
```

**V2 voz (combinado #181 — release v0.3.0+):**

```jsx
// Botão mic no chat input
async function startVoice() {
  await SpeechRecognition.requestPermission()
  const result = await SpeechRecognition.start({ language: 'pt-BR' })
  setInput(result.matches?.[0] || '')
  send() // auto-send
}

// TTS opcional ler back parsed
async function speakConfirmation(parsed) {
  await TextToSpeech.speak({
    text: `Entendi: ${parsed.medName} ${parsed.dose}${parsed.unit}, cada ${parsed.intervalHours} horas, por ${parsed.durationDays || 'tempo indeterminado'} dias. Confirma?`,
    lang: 'pt-BR',
  })
}
```

**Dependências:**
- Anthropic API key (~R$10/mês 1000 MAU; setup conta + billing)
- Edge function gateway novo
- Sheet/Modal primitives (existentes)
- TreatmentPreviewModal componente novo
- Privacy consent modal (LGPD compliance)
- V2 voz: plugins `@capacitor-community/speech-recognition` + `@capacitor-community/text-to-speech` (#181)

**Schema DB audit log:**

```sql
CREATE TABLE medcontrol.nl_parse_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  confidence text,
  missing_fields text[],
  parsed_at timestamptz DEFAULT now()
  -- NOT persisting input text (privacy)
);
ALTER TABLE medcontrol.nl_parse_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own audit" ON medcontrol.nl_parse_audit
  FOR SELECT TO authenticated USING (user_id = auth.uid());
```

**Critério de aceitação:**

V1 (escrita):
- ✅ Floating button visível em todas telas (não cobre nav)
- ✅ Sheet chat UI funcional Android + Web
- ✅ Privacy consent 1ª vez user usa
- ✅ 5 example phrases clickáveis pre-fill input
- ✅ Edge function `parse-treatment-nl` deployed + ANTHROPIC_API_KEY configured
- ✅ 10 frases test set retorna structured correto:
  - "Desloratadina 10 dias 5ml 8 em 8 horas pro Rael" → all fields parsed
  - "Mãe Mounjaro 5mg semanal por 6 meses" → patient="Mãe", interval=168, duration=180
  - "Dipirona 1cp cada 6h até melhorar" → isContinuous=true
  - "Anticoncepcional 21 dias 1cp por dia pra mim" → patient=<self>
  - Edge cases: misspell, ordem trocada, unidades pluralizadas
- ✅ Confidence low → app pede user complete missing fields
- ✅ TreatmentPreviewModal usuário edita/confirma antes salvar (NUNCA auto-save)
- ✅ Patient matching: hint "mãe/pai" → procura paciente existente OR sugere criar novo
- ✅ Audit log entries criadas (sem texto user, só metadata)
- ✅ Rate limit funcional (1 req/3s per user)
- ✅ Error handling: parse_failed → fallback cadastro manual
- ✅ Validação Chrome MCP preview Vercel + device real S25 Ultra

V2 (voz future v0.3.0+):
- ✅ Botão mic chat input
- ✅ Speech recognition PT-BR funcional (combinado #181)
- ✅ Auto-send pós voz reconhecido
- ✅ TTS opcional confirmação parsed result

**Métrica esperada:**
- Onboarding cadastro 1 treatment: 5min manual → 30s chat (-90%)
- Conversion rate primeira sessão: +50-70% (KILLER UX)
- Retention dia 7: +30% (user que usa chat tende voltar)
- Brand differentiator MUNDIAL — primeiro app medicação com IA conversacional cadastro
- Marketing copy: "Cadastre só falando" / "IA entende seu jeito"

**Cost ongoing:**

| Modelo | Cost/request | 1000 MAU × 5/mês | Mensal R$ |
|---|---|---|---|
| Haiku 4.5 | $0.000375 | $1.88 | R$ 10 |
| Sonnet 4 | $0.0045 | $22.50 | R$ 113 |

**Recomendação: Haiku** suficiente pra parser simple. Sonnet só se complexity Real-world demanda upgrade.

**Riscos:**
- Anthropic API downtime → fallback gracefully cadastro manual com toast "Chat indisponível, use cadastro normal"
- LLM hallucination unit/interval → tool use mitiga + user confirm antes save
- Privacy LGPD → consent explícito + sem PII enviado + audit log no-text
- Rate abuse → rate limit Edge function + cap mensal API spending alert

**Posicionamento marketing** (use #169 listing + #171 social):

> "Cadastre tratamentos só ESCREVENDO o que o médico falou.
>
> Diga: 'Mounjaro 5mg semanal por 6 meses pra mãe'
>
> O Dosy entende e cadastra automaticamente. Só você confirmar.
>
> Único app brasileiro com IA pra te ajudar a cuidar."

**Future iterations (v0.3.0+ → v1.0.0+):**
- Voz (V2 combinado #181)
- Multi-turn conversations ("ah, esqueci de falar que começa amanhã" → adiciona startDate)
- Edit treatment via chat ("aumenta dose Mounjaro pra 10mg")
- Mark dose taken via chat ("já tomei o Mounjaro")
- Query history ("quantas doses faltam pra Mounjaro?")
- LLM personalizado fine-tuned BR healthcare data (longprazo)

---

### #189 — UpdateBanner mostra versionCode em vez de versionName

- **Status:** ⏳ Aberto
- **Categoria:** 🐛 BUGS
- **Prioridade:** P2 (UX bug não-blocker)
- **Origem:** User-reported 2026-05-07
- **Esforço:** 1-2h
- **Release:** v0.2.1.5+ (próxima code release)

**Problema:**

UpdateBanner mostra `v code 49` (versionCode) ao invés `v0.2.1.4` (versionName) que user vê em Console release notes.

User quote: "no banner de update que aparece, ele mostra o v code do console, atualmente ta em ~44 eu acho. Eu gostaria que aparecesse o versionamento correto do app... no caso, o que colocamos entre ( ) no console na hora que subimos aab".

**Root cause:**

`src/hooks/useAppUpdate.js:90-94` Native check Play Core API:

```js
if (info.updateAvailability === 2 && info.flexibleUpdateAllowed) {
  setLatest({
    version: info.availableVersion ?? `code ${info.availableVersionCode}`,
    source: 'play'
  })
}
```

Plugin `@capawesome/capacitor-app-update` `getAppUpdateInfo()` Android Play Core API:
- `availableVersionCode` — sempre populated (integer ex: 49)
- `availableVersion` (versionName) — populated em SOME Android versions / SOME Play Core versions. Frequently undefined em older devices OR Play Core SDK older.

Quando `availableVersion === undefined` → fallback `code ${info.availableVersionCode}` mostra "code 49" feio.

UpdateBanner.jsx:67-71 usa esse `latest.version` direto:
```jsx
} else if (latest?.version) {
  subtitle = isNative
    ? `v${latest.version} · toque para baixar`
    : `v${latest.version} · toque para recarregar`
}
```

Resultado visível user: "v code 49 · toque para baixar" em vez de "v0.2.1.4 · toque para baixar".

**Abordagem:**

Fix dual fallback strategy useAppUpdate.js:

```js
// Local map mantido em build constant (atualiza a cada release)
const VERSION_CODE_TO_NAME = {
  46: '0.2.1.0',
  47: '0.2.1.1',
  48: '0.2.1.2',
  49: '0.2.1.4',
  // adicionar próximas releases aqui
}

const checkNative = useCallback(async () => {
  try {
    const { AppUpdate } = await import('@capawesome/capacitor-app-update')
    const info = await AppUpdate.getAppUpdateInfo()
    if (info.updateAvailability === 2 && info.flexibleUpdateAllowed) {
      // Primary: availableVersion (versionName) from Play Core
      let version = info.availableVersion

      // Fallback 1: local map versionCode → versionName
      if (!version && info.availableVersionCode) {
        version = VERSION_CODE_TO_NAME[info.availableVersionCode]
      }

      // Fallback 2: fetch version.json Vercel (web fallback in native path)
      if (!version) {
        try {
          const res = await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            version = data.version
          }
        } catch { /* ignore */ }
      }

      // Fallback 3: ainda undefined → use versionCode mas com label clearer
      if (!version) {
        version = `versão ${info.availableVersionCode}` // PT-BR friendly vs "code 49"
      }

      setLatest({ version, source: 'play' })
    }
    // ... resto
  } catch (e) {
    console.log('[useAppUpdate] native check skipped:', e?.message)
  }
}, [])
```

Alternative simpler: SEMPRE fetch version.json no native path (paralelo Play Core). version.json é fonte canônica versionName (já updated a cada release v0.2.1.0 #103 BUG-032 fix URL origin runtime).

**Approach recomendada:** Sempre fetch version.json em paralelo com Play Core check. version.json define versionName; Play Core define availability + downloadable. Combina informações.

```js
const checkNative = useCallback(async () => {
  try {
    const { AppUpdate } = await import('@capawesome/capacitor-app-update')
    const [info, webData] = await Promise.allSettled([
      AppUpdate.getAppUpdateInfo(),
      fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    ])

    const playInfo = info.status === 'fulfilled' ? info.value : null
    const versionData = webData.status === 'fulfilled' ? webData.value : null

    if (playInfo?.updateAvailability === 2 && playInfo.flexibleUpdateAllowed) {
      const version = playInfo.availableVersion
        ?? versionData?.version
        ?? `versão ${playInfo.availableVersionCode}`

      setLatest({ version, source: 'play' })
    } else {
      setLatest(null)
    }
    if (playInfo?.installStatus === 11) setDownloaded(true)
  } catch (e) {
    console.log('[useAppUpdate] native check skipped:', e?.message)
  }
}, [])
```

**Dependências:**
- `public/version.json` deploy Vercel auto-update a cada build (verify Vite plugin)
- VERSION_URL constant em `src/lib/constants.js` ou similar

**Critério de aceitação:**

- ✅ Banner mostra `v0.2.1.4 · toque para baixar` (versionName) em vez de `v code 49`
- ✅ Fallback gracefully se Play Core retorna availableVersion undefined
- ✅ Fallback secondary version.json Vercel funcional
- ✅ Última fallback `versão N` PT-BR friendly (não "code N")
- ✅ Validação device real S25 Ultra: instalar versão antiga → publish nova versão Console → banner aparece com versionName correto
- ✅ Validação web (Vercel preview): banner mostra versionName de version.json

**Métrica esperada:**
- UX consistency — user vê mesma string em Console release notes + banner update
- Trust trust — "code 49" parece error message; "v0.2.1.4" parece release oficial

---

### #190 — BUG-LOGOUT-RESUME: app desloga após idle >5min (extends #159)

- **Status:** ✅ FECHADO v0.2.1.3 vc 50 (2026-05-07) — fix em useAppResume.js distinguir transient vs auth real (mesma estratégia #159). Validado device user ("190 ok").
- **Categoria:** 🐛 BUGS
- **Prioridade:** P0 (trust killer — bloqueador Reddit recrutamento testers)
- **Origem:** User-reported 2026-05-07
- **Esforço:** 1-2h (fix + AAB build + Internal upload)
- **Release:** v0.2.1.3 vc 50 hotfix mid-flight

**User report:**
> "BUG captado... o app no celular esta deslogando CONSTANTEMENTE e isso é muito chato, ja digitei a senha hoje umas 4 vezes, não sei se tem um padrão, mas percebi que as vezes o app ta aberto em idle no celular e quando volto pra ele ele pede login e senha DE NOVO"

**Pattern user observado:** idle ≥5min → volta foreground → app pede login.

**Root cause:**

`src/hooks/useAppResume.js:44` em long idle (≥5min) chama `supabase.auth.refreshSession()`. Em Android Capacitor com network instável, esse refresh pode falhar por múltiplas razões:

1. **Network slow** durante app resume (background → foreground transition)
2. **Android Doze** matou socket/cellular durante idle, recovery slow
3. **SecureStorage hiccup** retorna stale token momento errado
4. **Server clock skew** rejeita token tecnicamente válido
5. **Refresh_token revogado** (auth real failure)

Implementação anterior tratava QUALQUER erro como falha:
```js
try {
  await supabase.auth.refreshSession()
  // ...
} catch (err) {
  console.warn('[useAppResume] soft recover failed', err)
  if (typeof window !== 'undefined') window.location.reload()  // ← DESTRUTIVO
}
```

Resultado:
- Erro transient → Supabase auth dispatcher pode disparar `SIGNED_OUT` event
- `onAuthStateChange` listener em `useAuth.jsx` chama `setUser(null)` + `qc.clear()`
- User vê tela login

Plus fallback `window.location.reload()` agrava cascade:
- Reload remount React tree
- `useAuth` init() roda novamente boot path
- Boot `getUser()` check pode falhar de novo (mesma network instable)
- Cascade signOut

**Background histórico:**

#159 v0.2.1.1 (2026-05-06) já fixou cenário similar **boot path**: distinguir transient errors vs auth real em `useAuth.jsx` init. Faltou cobrir **resume path** equivalente em `useAppResume.js`.

**Fix v0.2.1.3 vc 50:**

Mesma estratégia #159 aplicada `useAppResume.js`:

```js
const { error: refreshErr } = await supabase.auth.refreshSession()
if (refreshErr) {
  const errMsg = refreshErr.message || ''
  const errStatus = refreshErr.status
  const isAuthFailure =
    errStatus === 401 ||
    errStatus === 403 ||
    /jwt|token.*expired|invalid.*refresh|invalid.*claim|invalid.*token|user.*not.*found|refresh.*revoked/i.test(errMsg)
  if (!isAuthFailure) {
    console.warn('[useAppResume] refresh transient error (keeping session):', errMsg, 'status:', errStatus)
  } else {
    console.warn('[useAppResume] refresh auth failure (will signOut via listener):', errMsg, 'status:', errStatus)
  }
}
// Continue: removeAllChannels + refetchQueries even em transient
```

Plus catch handler:
```js
} catch (err) {
  // NÃO forçar reload em catch — reload causa init() cascade.
  console.warn('[useAppResume] soft recover network exception (keeping session):', err?.message || err)
}
```

**Trade-offs aceitos:**
- User com refresh_token realmente revogado pode continuar com cache stale por algumas requisições, até onAuthStateChange dispatch via Supabase ou getUser() failure dispara signOut natural
- Trust violation reduzido massivamente vs current behavior (false logouts em network glitch comum mobile)

**Critério aceitação:**
- ✅ App idle 30min em background → volta foreground → continua logado (sem pedir senha)
- ✅ Validado real device S25 Ultra cellular (network típico instável Brasil)
- ✅ Validado real device emulador Pixel 7 com network throttle "Slow 3G"
- ✅ Sentry sem regressão (DOSY-* events) — verifica não introduz cascade outro
- ✅ Refresh_token realmente revogado (admin DELETE auth.users) → signOut funciona dentro 1-2 requests authenticated naturais
- ✅ Reportes user "não desloga mais" pós-install vc 50

---

### #191 — Tela "Meu plano" acessível a Free/Plus/Pro (não só paywall)

- **Status:** ⏳ Pendente
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P0 pré-OpenTest (sem isso Plus não consegue virar Pro = revenue ceiling)
- **Origem:** User-flagged 2026-05-07 ("usuario Free/Plus precisa migrar pro Pro sem ser pelo paywall") + promove plan-original FASE 16.3 nunca migrada
- **Esforço:** 4-6h (UI nova + refactor PaywallModal pra modo "manage")
- **Inclui (FASE 16.3 plan-original):** Settings.jsx seção "Assinatura", reforço card More.jsx, botão "Restaurar compras", link "Política de cobrança", badge sutil Free pages-chave

**Problema:**

Hoje paywall só aparece no fluxo Free quando bate limite (1 paciente / 3 tratamentos). User Plus não tem caminho UI pra virar Pro — preso no Plus indefinidamente. Pro features (sem ad, export, multi-paciente ilimitado) inacessíveis sem ir manualmente na Play Store assinar SKU separado.

**Sintomas:**
- Plus user que quer remover ads → não acha botão
- Free user em telas que NÃO batem limite (ex: Configurações) → não vê opção de upgrade voluntário
- Pro user (já pago) → quer ver/gerenciar/cancelar assinatura → vai onde?

**Solução proposta:**

Tela `/meu-plano` (ou Sheet) com 3 estados:
1. **Free:** mostra Plus + Pro lado-a-lado, CTA upgrade ambos
2. **Plus:** mostra plano atual com ✓ destacando benefícios + card Pro com diferenciais (sem ad, multi-paciente, export PDF, etc) + CTA upgrade Pro
3. **Pro:** mostra plano atual + link "Gerenciar no Google Play" (cancel, downgrade, payment method, etc — Play Store handle isso, não dá pra fazer in-app)

Acesso:
- Item Sidebar/Profile "Meu plano"
- CTA discreto na home/configurações pra Free user voluntário ("desbloquear tudo")

**Impacto:**
- Plus → Pro path desbloqueado = revenue conversion possível
- Free pode upgrade voluntário (sem precisar bater limite)
- Pro tem onde gerenciar = trust + LGPD ("transparência sobre assinatura")

**Critério aceitação:**
- ✅ Free user clica "Meu plano" → vê 3 cards (Free atual + Plus + Pro com CTA)
- ✅ Plus user clica "Meu plano" → vê Plus atual + card Pro com upgrade CTA
- ✅ Pro user clica "Meu plano" → vê Pro atual + link Play Store gerenciar
- ✅ Upgrade Plus → Pro funciona via Play Billing real (sandbox + prod)
- ✅ Cancel Pro via Play Store → app detecta downgrade no próximo refresh tier (RevenueCat ou Play Console webhook)

---

### #192 — Validar fluxo pagamento end-to-end (sandbox + Play Console testers)

- **Status:** ⏳ Pendente
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P0 pré-OpenTest (BLOQUEADOR launch)
- **Origem:** User-flagged 2026-05-07 ("quando for pra opentest isso tudo precisa estar rodando liso... pagamento inclusive") + promove plan-original FASE 16.4
- **Esforço:** 1-2 dias (depende #191 + setup tester accounts Play Console)

**Escopo de validação:**

1. **Free → Plus** via paywall
   - Bate limite → modal aparece → click Plus → Play Billing flow → confirma compra → tier vira plus → limite removido
   - Cancela compra mid-flow → tier permanece free, sem side-effect
   - Compra reembolsada (Google) → app detecta downgrade

2. **Free → Pro** via tela #191
   - Click "Pro" → Play Billing → tier vira pro → ads removidos imediatamente

3. **Plus → Pro** via tela #191
   - Click "Pro" → Play Billing handle "upgrade" SKU → tier vira pro → ads removidos sem perder dados

4. **Pro → Cancel**
   - User vai Play Store → cancela → próximo refresh tier detecta → vira free na data de expiração (NÃO antes)
   - Durante "grace period" (assinatura paga mas cancelada) → tier permanece pro até expiração

5. **Restore purchases**
   - User reinstala app → entra mesma conta Google → click "Restaurar compras" → tier correto re-aplicado

6. **Edge cases**
   - Network falha durante compra → flow recupera na próxima abertura
   - User troca conta Google → restoration funciona
   - Múltiplos devices mesma conta → tier sincronizado

**Critério aceitação:**
- ✅ Cada fluxo acima testado em real device com Play Console License Tester
- ✅ Sentry sem erros de billing
- ✅ PostHog tracking events `upgrade_complete` / `upgrade_failed` funcionais
- ✅ Subscriptions table reflete tier correto pós-fluxo (RPC `my_tier` consistente)
- ✅ Restore purchases funciona após reinstall

---

### #193 — Webhook Google Play subscription notifications (RTDN)

- **Status:** ⏳ Pendente
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (necessário pra cancel/refund detectar fora do app)
- **Origem:** Implicit em #192 (sem isso, cancel só detecta na próxima abertura do app) + reformula plan-original FASE 16.2
- **Esforço:** 1-2 dias (Edge Function + Pub/Sub setup + Play Console config)
- **Reformulação plan-original:** plan original especificava "Webhook RevenueCat → Supabase". Reformulado direto Pub/Sub → Edge Function (RTDN nativo Google) — evita custo + dependência RevenueCat. Plan-original FASE 16.2 também tinha `validate-purchase` Edge Function, que vai ser implementada em #192 separadamente (validar receipt no client side da compra).

**Por quê:**

Sem RTDN (Real-Time Developer Notifications), app só sabe que user cancelou quando abre o app + chama `purchaseService.refresh()`. Se user cancela no Play Store e nunca mais abre o app, tier permanece pro infinitamente no DB.

Com RTDN: Google Pub/Sub → Edge Function `play-billing-webhook` recebe notification → atualiza tier em `subscriptions` table imediatamente.

**Critério aceitação:**
- ✅ Edge Function `play-billing-webhook` deployed
- ✅ Validação Pub/Sub signature
- ✅ Handle SUBSCRIPTION_CANCELED / EXPIRED / RECOVERED / RESTARTED / GRACE_PERIOD
- ✅ Logs Sentry de eventos processados
- ✅ Idempotente (replay safe)

---

### #194 — Tracking analytics flow upgrade (eventos PostHog completos)

- **Status:** ⏳ Pendente
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P1 pré-OpenTest (sem isso não dá pra debugar conversão drop-off)
- **Origem:** Implicit em #191/#192
- **Esforço:** 2-3h

**Eventos novos (já parcialmente em `EVENTS` catalog):**
- `manage_plan_opened` (entrou na tela #191) — origem (sidebar/home/config)
- `plan_card_clicked` (qual plano) — Plus ou Pro
- `upgrade_checkout_started` ✅ existe
- `upgrade_complete` ✅ existe — incluir from_tier + to_tier
- `upgrade_failed` ✅ existe — incluir error code
- `restore_purchases_clicked` ✅ existe — incluir result
- `manage_subscription_play_clicked` (clicou link Play Store)
- `cancel_detected` (RTDN do #193 detectou cancel)

**Critério aceitação:**
- ✅ Painel admin `/analytics` mostra funnel `manage_plan_opened → plan_card_clicked → upgrade_complete`
- ✅ Drop-off rate visível por etapa
- ✅ Sentry sem PII em eventos

---

### #195 — Não deletar push_subscription em SIGNED_OUT automático

- **Status:** ✅ FECHADO v0.2.1.5 vc 52 (2026-05-08) — fix em `useAuth.jsx:127-143` + flag `dosy_explicit_logout` em `signOut()`. Deploy commit `cd7d5bb`.
- **Categoria:** 🐛 BUGS
- **Prioridade:** P0 (trust killer combinado com #196 — quebra reagendamento de alarmes)
- **Origem:** Investigação user-reported 2026-05-07 ("alarme não disparou às 20h, app continua deslogando")
- **Esforço:** 1-2h

**Root cause identificado:**

`src/hooks/useAuth.jsx:127-143` quando `onAuthStateChange` captura evento `SIGNED_OUT`, executa um `DELETE FROM medcontrol.push_subscriptions WHERE deviceToken = cachedToken`. Esse cleanup foi pensado pra logout explícito (botão "Sair" → user real saiu).

```js
} else if (event === 'SIGNED_OUT') {
  clearSyncCredentials().catch(...)
  try {
    const cachedToken = localStorage.getItem('dosy_fcm_token')
    if (cachedToken) {
      supabase.schema('medcontrol').from('push_subscriptions')
        .delete().eq('deviceToken', cachedToken)  // ← problema aqui
        ...
    }
  }
}
```

**Problema:** Supabase JS dispara `SIGNED_OUT` em cenários transient/automáticos (não só logout explícito):
- Boot `getUser()` retornou erro classificado como auth failure (#159 já cobre, mas SDK interno pode disparar mesmo assim)
- Internal token refresh loop falhou
- WebSocket auth disconnect
- `supabase.auth.signOut()` chamado em algum cleanup hook

Em qualquer um desses casos, push_subscription do device é deletado. Próximo cron `schedule-alarms-fcm-6h` lê push_subs filtrando por `deviceToken IS NOT NULL` → device atual não aparece → FCM data message não enviado → AlarmScheduler local não reagenda.

Resultado: usuário fica sem alarmes até abrir o app de novo (rescheduleAll re-cria push_subscription via `subscribe()`).

**Fix proposto:**

Separar logout explícito de SIGNED_OUT automático.

Opção A (preferida): adicionar flag `localStorage.dosy_explicit_logout = '1'` antes de chamar `supabase.auth.signOut()` no `signOut()` da `useAuth`. Em `onAuthStateChange` SIGNED_OUT, ler flag — se presente, deletar push_sub (logout real); se ausente, preservar (transient).

Opção B: marcar push_subscription como `pending_cleanup` (boolean) ao invés de DELETE. Cron limpa quem fica `pending_cleanup` há > 7d. Permite recovery se user re-loga.

**Critério aceitação:**
- ✅ Botão "Sair" → push_subscription deletada como hoje
- ✅ Network glitch / boot transient SIGNED_OUT → push_subscription preservada
- ✅ App recupera login (token refresh) → cron próximo envia FCM normalmente
- ✅ Validar device real: deslogar manual + verificar DELETE acontece; idle longo + verificar DELETE NÃO acontece

---

### #196 — useAuth onAuthStateChange ignorar SIGNED_OUT spurious

- **Status:** ✅ FECHADO v0.2.1.5 vc 52 (2026-05-08) — listener async + valida `getSession()` antes de processar SIGNED_OUT sem flag explícita. Commit `cd7d5bb`.
- **Categoria:** 🐛 BUGS
- **Prioridade:** P0 (trust killer — extends #159 + #190)
- **Origem:** Investigação user-reported 2026-05-07
- **Esforço:** 2-3h

**Background:**

#159 fixou logout transient no boot do `getUser()`. #190 fixou logout transient no `useAppResume.refreshSession()`. Mas `onAuthStateChange` (linha 76-89 useAuth.jsx) ainda captura QUALQUER `SIGNED_OUT` event do Supabase JS e dispara `setUser(null)` + `qc.clear()`.

Supabase JS dispara SIGNED_OUT em vários cenários internos não cobertos pelos fixes #159/#190 (refresh loops, WebSocket disconnects, internal cleanup). User vê tela de login mesmo session local válida.

**Fix proposto:**

Em `onAuthStateChange`, distinguir SIGNED_OUT real vs spurious:
- Verificar se `dosy_explicit_logout` flag setado (do #195) — se sim, processar normal
- Se NÃO setado, validar com `supabase.auth.getSession()` — se ainda tem session válida, ignorar SIGNED_OUT (log warning + preservar user state)
- Se session de fato gone, processar normal

Trade-off: 1 round-trip extra `getSession` (lightweight, sem network — lê localStorage). Aceitável.

**Critério aceitação:**
- ✅ Logout explícito → `setUser(null)` + UI vai pra Login
- ✅ Network glitch dispara SIGNED_OUT spurious → user state preservado, próximo refresh recupera
- ✅ Validar device real: idle 30min + retorna foreground = continua logado
- ✅ Sentry sem regressão (DOSY-* events)

---

### #197 — Restaurar caminho 2 (notify-doses cron) como fallback push tray

- **Status:** ✅ FECHADO v0.2.1.5 vc 52 (2026-05-08) — cron `notify-doses-1min` ativo (`* * * * *`) + Edge Function redeploy `verify_jwt: false`. Migration `20260507230000_notify_doses_cron_1min.sql`. Commit `f19c985`.
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (defense-in-depth — sem isso, falha caminho 1 (FCM data) = silêncio total)
- **Origem:** Investigação 2026-05-07 (cron `schedule-alarms-fcm-6h` é o único caminho hoje)
- **Esforço:** 1-2h

**Estado atual:**

Edge Function `notify-doses` existe deployed (id `5a9616a5...`), mas SEM cron job no Postgres. Função foi descontinuada em algum refactor passado (provável v0.1.7.x quando #083 introduziu `schedule-alarms-fcm`).

Hoje só existe **caminho 1**: `schedule-alarms-fcm-6h` envia FCM data message → app local agenda AlarmManager. Se FCM data falhar (rede, token expirado, MessagingService crash), usuário não recebe NADA.

**Fix proposto:**

Restaurar `notify-doses` como caminho 2 (push tray simples, redundância):
1. Verificar código atual da Edge Function `notify-doses` (pode estar stale)
2. Atualizar pra: query doses pending nos próximos 5min → enviar FCM **notification** (não data) tray simples ("Hora do remédio: <medName>")
3. Adicionar cron `*/5 * * * *` (a cada 5min) chamando Edge Function
4. Custo egress: 1 query pequena + 1 FCM por dose ativa cada 5min — aceitável (<0.1MB/dia/user típico)

Isso garante que mesmo se AlarmManager local falhar, user recebe push tray simples. Push tray não é tão chamativa quanto AlarmActivity full-screen, mas é última linha defesa.

**Critério aceitação:**
- ✅ `notify-doses` cron rodando `*/5 * * * *`
- ✅ Dose pending dentro 5min → push tray entregue
- ✅ Idempotente (não envia mesma dose 2× em 5min subsequentes — usa flag DB ou hash dedup)
- ✅ Egress aumento <5% medido em production após 7d
- ✅ Validar device: AlarmManager desabilitado manualmente (settings) + dose vence = push tray chega

---

### #198 — Reagendar alarmes no boot do app após instalação fresca/upgrade

- **Status:** ✅ FECHADO v0.2.1.5 vc 52 (2026-05-08) — App.jsx useEffect detecta install/upgrade via `localStorage.dosy_last_known_vc` + skip scheduleDoses durante TanStack loading (guard `dosesLoaded && patientsLoaded`). Commit `f9f100c`.
- **Categoria:** 🐛 BUGS
- **Prioridade:** P1 (sombra de até 6h após reinstall = tester perde alarmes)
- **Origem:** Investigação 2026-05-07 (user instalou 3 versões hoje, perdeu alarmes 16h e 20h)
- **Esforço:** 1-2h

**Problema:**

Reinstalação ou upgrade do APK (Internal Testing → Closed Testing release) limpa o `AlarmManager` pending alarms (comportamento Android nativo). Próximo agendamento depende do cron `schedule-alarms-fcm-6h` rodar — pode demorar até 6h.

**Fix proposto:**

Em `App.jsx` boot, detectar instalação fresca/upgrade comparando build version armazenada em SharedPreferences com a atual:
- Se `last_known_vc !== current_vc` (primeira execução pós-install/upgrade), forçar `rescheduleAll()` imediato
- Salvar `current_vc` em SharedPreferences
- Custo: 1 query doses 24h horizon + N AlarmManager.setAlarmClock — barato, sem network round-trip extra (já tem doses cache local TanStack)

**Critério aceitação:**
- ✅ Reinstalar APK + abrir app = alarmes reagendados imediato (sem aguardar cron 6h)
- ✅ Boot subsequente (mesma vc) = sem reschedule extra (preserva otimização atual)
- ✅ Validar device: instalar vc N+1 + verificar dose < 6h tem alarme local agendado dentro de 30s

---

### #199 — Cleanup automático push_subscriptions stale (deviceToken NULL > 30d)

- **Status:** ✅ FECHADO v0.2.1.5 vc 52 (2026-05-08) — cron `cleanup-stale-push-subs-daily` (`0 5 * * *`) + RPC `medcontrol.cleanup_stale_push_subscriptions()`. Migration `20260507230500_cleanup_stale_push_subs_cron.sql`. Commit `34904a5`.
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P2 (housekeeping — não bloqueia mas evita debt)
- **Origem:** Investigação 2026-05-07 (user tem 6 push_subs stale)
- **Esforço:** 1h

**Problema:**

Quando user reinstala app, novo push_subscription é criado mas o anterior fica no DB com `deviceToken=NULL` (cleared via algum cleanup parcial). Stale rows acumulam ao longo dos meses.

User do bug 2026-05-07 tem **8 push_subscriptions** das quais 6 com `deviceToken=NULL`. Cron de schedule já filtra `NOT NULL`, então não é problema funcional, mas é debt.

**Fix proposto:**

Cron diário `0 5 * * *` (5am UTC = 02am BRT, low traffic):
```sql
DELETE FROM medcontrol.push_subscriptions
WHERE "deviceToken" IS NULL
  AND "createdAt" < NOW() - INTERVAL '30 days';
```

**Critério aceitação:**
- ✅ Cron criado + ativo
- ✅ Run diário sem erro
- ✅ Logs mostram count de rows deletadas
- ✅ Validar: rows com deviceToken populated NÃO afetadas

---

### #200 — Análise + fix sombras de agendamento de alarme (egress-aware)

- **Status:** ✅ FECHADO v0.2.1.5 vc 52 (2026-05-08) — HORIZON cron 24h→30h + doc `docs/alarm-scheduling-shadows.md` (7 sombras A-G + matrix cobertura). Sub-item #200.1 idempotente também fechado (commit `54b00d1`). Commit principal `b0a6ee5`.
- **Categoria:** 🐛 BUGS
- **Prioridade:** P1 (afeta confiabilidade healthcare crítico)
- **Origem:** User-flagged 2026-05-07 ("existem períodos de sombra no desenvolvimento? quando adiciono dose, ela pode não ir pro alarme?")
- **Esforço:** 4-6h investigação + impl

**Sombras identificadas na arquitetura atual:**

1. **Sombra A — Dose criada por OUTRO device do mesmo user:**
   - Device A (web ou tablet) cria dose
   - Device B (celular) com app fechado
   - DB trigger `dose-trigger-handler` envia FCM data, mas device B com FCM token expirado/UNREGISTERED não recebe
   - Cron 6h pode demorar até 6h pra reagendar
   - **Window real de sombra: até 6h se trigger DB falhou no device B**

2. **Sombra B — Dose com `scheduledAt > 6h` future:**
   - DB trigger skip `beyond-cron-horizon` (otimização #139)
   - Esperando cron 6h pegar quando entrar em janela 24h
   - **Não é sombra real** — design intencional, dose entra na janela cedo o suficiente

3. **Sombra C — Cron `schedule-alarms-fcm-6h` last run + dose criada entre crons:**
   - Cron 18:00 UTC. Dose criada 20:00 UTC com `scheduledAt = 21:30 UTC`.
   - DB trigger: 1h30 < 6h → trigger dispara FCM data → device agenda local
   - **Sem sombra** se DB trigger funciona

4. **Sombra D — Reinstalação de app (coberto por #198)**

5. **Sombra E — Device offline quando FCM enviado:**
   - FCM tem retry 28 dias mas pode atrasar
   - Worst case: alarme atrasa horas após device voltar online
   - Mitigado por `rescheduleAll()` quando app abre
   - **Sombra: até user abrir app**

6. **Sombra F — Trigger DB webhook falhou (rede flap, function down):**
   - Sem retry automático
   - Próximo cron 6h pega
   - **Sombra: até 6h**

**Fix proposto (escolher 1-2 itens, mantendo egress baixo):**

| Opção | Impacto sombra | Custo egress | Recomendação |
|-------|----------------|--------------|--------------|
| Aumentar HORIZON cron de 24h para 12h reduzido + cron 3h | Reduz C/F | -50% reach + 2× FCM rate = +0% | ❌ pior |
| Aumentar HORIZON cron de 24h para 30h, mantendo 6h | Reduz C/F parcial | +25% payload por device, mesma freq | ✅ pequeno overhead |
| Trigger DB elevar limite de 6h → 12h ou 24h | Reduz B trivial | +40-60% FCM em INSERT batch (cron extend cria 100s/dia) | ❌ ferra egress |
| Cron `notify-doses` *5min push tray fallback (#197) | Reduz E/F substancial | +5% (1 query+FCM/5min) | ✅ defense-in-depth |
| `rescheduleAll` no boot (#198) | Reduz D | 0 (já fazemos no useEffect) | ✅ obrigatório |
| Dose UI cria → app chama AlarmScheduler local IMEDIATO (não espera FCM round-trip) | Reduz A/F localmente | 0 (lógica local) | ✅ ideal |

**Recomendação combinada:**
- Implementar #197 (notify-doses fallback)
- Implementar #198 (rescheduleAll fresh install)
- Garantir `App.jsx` useEffect já reagenda localmente em INSERT/UPDATE de dose (parece que já faz — validar)
- Aumentar HORIZON cron 24h → 30h (mudança 1 linha, pequeno overhead)
- **Refatorar `rescheduleAll` pra ser idempotente** (ver sub-item §#200.1 abaixo)

**Critério aceitação:**
- ✅ Documento `docs/alarm-scheduling-shadows.md` enumera todas sombras + cobertura
- ✅ Cada sombra tem mitigação ativa
- ✅ Egress total prod monitorado pós-deploy: aumento aceitável (<10%)
- ✅ Test em device: criar dose 30min future + app fechado = alarme toca

#### Sub-item #200.1 — `rescheduleAll` idempotente (não cancelAll antes) ✅ FECHADO v0.2.1.5

**Implementação JS-only (sem mudança em plugin nativo) — 2026-05-07:**

Em vez de Option A (plugin expor `listScheduled()` lendo SharedPreferences), foi usado Option B (track em localStorage `dosy_scheduled_groups_v1`). Resultado equivalente sem precisar tocar Kotlin.

Mudanças em `src/services/notifications/`:
- `channels.js`: `cancelGroup(groupId)` cancela 1 grupo específico (CriticalAlarm + LocalNotifications). `loadScheduledState`/`saveScheduledState`/`clearScheduledState` helpers localStorage.
- `scheduler.js`: `rescheduleAll` agora calcula desired vs current via hash por grupo. `toRemove` cancelados, `toAddOrUpdate` re-agendados, `toKeep` preservados intactos. State persistido em localStorage no fim. Primeira execução por sessão (`firstResetDoneInSession=false`) força `cancelAll()` pra cobrir install fresco e desync.

Hash por grupo: `${at.toISOString()}|${doseIds.sort().join(',')}|${shouldRing ? 'r' : 't'}|${scheduledAt}`. Mudou qualquer coisa relevante → hash diferente → re-agenda.

**Resultado:**
- Janela vazia 200-2000ms eliminada (alarmes não mudados ficam intactos)
- Resilência contra crash mid-reschedule (state previsível)
- Performance melhor (não cancela+reagenda alarmes que não mudaram)



**Problema atual em `src/services/notifications/scheduler.js:46-48`:**

```js
// 1. Cancelar tudo (sempre, antes de qualquer agendamento)
await cancelAll()

// 2. Setup channel
await ensureChannel()

// 3. ... resto do código que agenda novamente
```

**Sombra do pattern destrutivo:**

Toda execução do `rescheduleAll` chama `cancelAll()` PRIMEIRO. Se algo entre o cancel e o reschedule falhar (exception JS, AlarmScheduler nativo retorna erro, network slow durante busca de prefs, OOM kill do app), o AlarmManager fica **VAZIO** e alarmes previamente agendados são perdidos. Próxima recuperação só no cron 6h.

Caso real onde isso bate:
- User loga → useEffect dispara `scheduleDoses([])` enquanto query carrega → `rescheduleAll([])` chama `cancelAll()` + agenda nada → AlarmManager zerado por 200-2000ms até query terminar
- Se algo crashar nesse window, alarmes não voltam até cron

**Fix proposto (idempotente):**

Padrão "diff and apply":
1. Buscar `existingAlarmIds = AlarmManager.listScheduled()` (precisa expor essa API no plugin nativo — adicionar método novo)
2. Calcular `desiredAlarmIds` baseado nas doses do parâmetro
3. `toAdd = desiredAlarmIds - existingAlarmIds` → agendar só esses
4. `toRemove = existingAlarmIds - desiredAlarmIds` → cancelar só esses
5. `toUpdate` (mesmo doseId mas scheduledAt mudou) → cancel + reschedule só esses

**Custo:**
- Plugin nativo: adicionar método `listScheduled()` retornando `{id, scheduledAt}[]` lendo SharedPreferences (onde já persiste alarms)
- JS: lógica de diff, ~30 linhas
- Egress: zero (operação 100% local)

**Benefício:**
- Window vazio eliminado
- Resilência contra crashes mid-reschedule (state previsível)
- Performance: não cancela+reagenda alarmes que não mudaram (menor IPC plugin)

**Critério aceitação sub-item:**
- ✅ `CriticalAlarm.listScheduled()` plugin retorna alarmes pending atuais
- ✅ `rescheduleAll` calcula diff e aplica só toAdd/toUpdate/toRemove
- ✅ Test: chamar `rescheduleAll([])` quando havia 5 alarmes → cancela os 5; chamar `rescheduleAll(mesmas5)` → noop, AlarmManager preserva os 5
- ✅ Test: chamar `rescheduleAll(novas3)` quando havia 5 alarmes → cancela 5, agenda 3 (set diff completo)
- ✅ Test simulado crash mid-reschedule → AlarmManager NÃO fica vazio (alarmes do estado anterior preservados até diff completo)

---

### #201 — Telemetria auth events (login/logout tracking)

- **Status:** ✅ FECHADO v0.2.1.5 vc 53 (2026-05-08) — backend + frontend + admin panel.
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1
- **Origem:** User pediu pra debugar bugs logout em produção 2026-05-08
- **Esforço real:** ~3h

**Implementação:**

Backend (Supabase):
- Migration `20260507231500_auth_events_telemetry.sql` cria tabela `medcontrol.auth_events` com colunas event_type/app_version/app_build/platform/user_agent/device_id/logout_kind/details(jsonb)/createdAt
- RPC `log_auth_event(p_event_type, p_app_version, p_app_build, p_platform, p_user_agent, p_device_id, p_logout_kind, p_details)` — cliente registra próprios events
- RPC `admin_list_auth_events(p_user_id, p_event_type, p_app_version, p_since, p_limit)` — admin lista com filtros
- RLS: user lê próprios + admin lê todos. INSERT só via RPC.

Frontend (App):
- Service `src/services/authTelemetry.js` encapsula `logAuthEvent(type, extra)` com cache `App.getInfo()` + `getDeviceId()`
- `useAuth.jsx` integra:
  - `signInEmail()` → `tipo: 'login_email_senha'` / "Digitou email e senha e clicou em Entrar"
  - `signUpEmail()` → `tipo: 'criou_conta_nova'` / "Criou conta nova e entrou pela primeira vez"
  - `verifyRecoveryOtp()` → `tipo: 'recuperacao_senha'` / "Recuperou a senha pelo código enviado por email"
  - init() session restore → `tipo: 'sessao_restaurada'` / "Abriu o app e a sessão já estava salva (não digitou senha)"
  - `signOut()` → `tipo: 'clicou_sair'` / "Clicou no botão Sair"

Admin panel (dosy-admin):
- Página `/auth-log` "Histórico de login" 🔐
- Filtros: userId, tipo evento, versão app, limit
- Renderiza `details.descricao` em PT-BR + slug técnico abaixo

Commits: `6aad8f2`, `f0da129`, `cd9dc7c`. Master + Vercel deploy auto.

---

### #202 — Mutex + debounce em useAppResume previne refresh storm

- **Status:** ✅ FECHADO v0.2.1.5 vc 53 (2026-05-08) — implementação direta no useAppResume.js
- **Categoria:** 🐛 BUGS
- **Prioridade:** P0 (trust killer healthcare crítico — user reportou "deslogando de novo")
- **Origem:** Investigação 2026-05-08 user reportou logout persistente. Query SQL revelou refresh storm.

**Bug observado em prod:**

User `lhenrique.pda@gmail.com` 2026-05-08 12:00:02-12:00:04 UTC (09:00 BRT) — refresh tokens criados+revogados:
- 12:00:02.76 → token 1072 (criado)
- 12:00:03.28 → token 1073 (rotacionou 1072) — 1072 revogado em 281ms
- 12:00:03.58 → token 1074 (rotacionou 1073)
- 12:00:03.95 → token 1075 (rotacionou 1074)
- 12:00:04.23 → token 1076 (rotacionou 1075)

5 tokens em 1.48s — Supabase detectou token reuse → revogou refresh chain inteira → user deslogado em cascade.

**Causa raiz:**

`visibilitychange` + `window.focus` + Capacitor `appStateChange` disparam `onResume()` quase-simultâneos ao retomar app. Cada um chamava `supabase.auth.refreshSession()` em paralelo → rotações concorrentes do mesmo refresh_token.

**Fix em `src/hooks/useAppResume.js`:**

1. Mutex module-level `refreshInProgress = false`. Se outro refresh em curso, skip.
2. Debounce 1s (`RESUME_DEBOUNCE_MS = 1000`) ignora resume events <1s após o último.
3. Liberar mutex em `finally` block (mesmo em exception).

Commit: `8948004`.

**Critério aceitação validado:**
- ✅ Build sem regressão
- ✅ Logs em prod não devem mostrar mais bursts de refresh tokens
- ✅ Hard refresh device + alternar tabs/apps rápido — sem deslogar

---

### #203 — Som de alarme customizado (dosy_alarm.mp3)

- **Status:** ✅ FECHADO v0.2.1.6 vc 54 (2026-05-08)
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2
- **Origem:** User pediu pra usar mp3 próprio "Instante de Pausa" como som de alarme
- **Esforço real:** ~30min

**Implementação:**

1. **Otimização do mp3:** ffmpeg re-encode 192kbps stereo → 96kbps mono 44.1kHz. Original 1.66MB → 811KB (50% redução). Suficiente pra alarme healthcare em alto-falante de celular sem perder clareza.

2. **Coloca em `android/app/src/main/res/raw/dosy_alarm.mp3`** (resource id auto-gerado pelo Android build).

3. **`AlarmService.java`** já tinha fallback raw (linha 255-263): `getResources().getIdentifier("dosy_alarm", "raw", ...)` → URI `android.resource://...`. Sem mudança.

4. **`AlarmReceiver.java`** atualizado pra usar mesmo raw em channel sound (linhas 163-172):
```java
int rawId = context.getResources().getIdentifier("dosy_alarm", "raw", context.getPackageName());
if (rawId != 0) {
    sound = Uri.parse("android.resource://" + context.getPackageName() + "/" + rawId);
}
if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
```

5. **CHANNEL_ID bumped** `doses_critical` → `doses_critical_v2`. Channel sound é immutable após `createNotificationChannel()`. Devices que tinham canal antigo (com som default) recebem novo canal `_v2` com som custom no upgrade. Antigo fica órfão (limpável via Settings → App).

**Critério aceitação:**
- ✅ Reinstalar APK em device + criar dose 5min future → alarme toca com som custom
- ✅ Lock screen + dose dispara → fullscreen AlarmActivity com som custom
- ✅ Tray notification posted by AlarmReceiver → mostra som custom (canal v2 ativo)

Commits: `4c9a588` (sound + channel + bump vc 54).

---

### #204 — Mutation queue offline (React Query nativa) — Fase 1 offline-first

- **Status:** ✅ Fechado v0.2.1.7 base + v0.2.1.8 expand fixes A1/A2/B/C (vc 56, Vercel prod 2026-05-12 01:50 UTC, tag `v0.2.1.8` commit `b7b5c71`) — 13 validações marcadas [`Validar.md`](Validar.md) (8 device + 5 web + SQL); 218.9.x cumulativo 24h pendente (não-bloqueador)
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P0 (bloqueador antes Closed Testing público)
- **Origem:** Auditoria offline-first 2026-05-08 (pré-Teste Fechado, pergunta crítica do usuário sobre comportamento offline em app de medicação)
- **Esforço estimado:** 6-10h (código real ~3h)
- **Release sugerida:** v0.2.1.7

**Implementação fechada (código):**

- ✅ `src/services/mutationRegistry.js` — `setMutationDefaults` por chave (12 mutations: confirmDose/skipDose/undoDose/registerSos/createPatient/updatePatient/deletePatient/createTreatment/updateTreatment/deleteTreatment/pauseTreatment/resumeTreatment/endTreatment) — mutationFn + onMutate/onError/onSuccess/onSettled centralizados.
- ✅ `src/main.jsx` — `defaultOptions.{queries,mutations}.networkMode='offlineFirst'` + bridge `Capacitor.Network.networkStatusChange` ↔ `onlineManager.setOnline()` (fallback `navigator.onLine`+events na web) + `registerMutationDefaults(queryClient)` chamado ANTES `<PersistQueryClientProvider>` hydrate + `persistOptions.dehydrateOptions.shouldDehydrateMutation: () => true` + `onSuccess: queryClient.resumePausedMutations()`. **Buster mantido `v1`** (NÃO bumpar — evita pico egress 1x todos users na atualização; TanStack hydrate é tolerante a campo `mutations` extra).
- ✅ Hooks refatorados (`useDoses.js`/`usePatients.js`/`useTreatments.js`) — `useMutation({ mutationKey: ['confirmDose'] })` formato, defaults aplicados via lookup. Helpers `patchDoseInCache`/`rollback`/`refetchDoses` migrados pra registry.
- ✅ `src/components/OfflineBanner.jsx` — banner fixed bottom-center acima BottomNav. Estados: amber `N ação(ões) salva(s) offline — sincroniza ao reconectar` (offline+pending>0) ou emerald `Sincronizando N ação(ões)…` (online+drain ≤3s pós-reconnect). Hook `useIsMutating()` + `useOnlineStatus()` + transição offline→online via state local.
- ✅ `src/App.jsx` — `<OfflineBanner />` integrado pós `<ForceNewPasswordModal>`.
- ✅ Build smoke-test: `npm run build` verde 28.53s.

**Pendente (não bloqueia merge mas alvo desta release):**

- [ ] Telemetria PostHog `mutation_queued_offline` + `mutation_drained_online` (Fase 1.5, separar)
- [ ] Validação device S25 Ultra modo avião (vide checklist abaixo)
- [ ] Considerar `client_request_id` UUID idempotência server-side (item novo backlog #205?)

**Auditoria egress #204 (importante — projeto sensível a custo Supabase):**

| Risco | Severidade | Decisão |
|---|---|---|
| `buster v1→v2` invalidaria cache de TODOS users 1x na atualização → pico simultâneo refetch (doses ~5KB + patients ~1KB + treatments ~2KB) × N users | 🔴 Alto 1x | **Mantido `v1`** — TanStack hydrate tolerante a campo extra `mutations` (legacy carrega normal). Schema delta backward-compat. |
| `refetchOnReconnect: true` (default herdado) + bridge `onlineManager` Capacitor passa a detectar avião mode real (antes navigator.onLine WebView reportava sempre `true`) → mais transições online↔offline = mais refetches | 🟡 Médio | **Aceito** — `staleTime` longo cobre janelas curtas (5min patients/treatments + 2min doses + 10min prefs). Refetch só se realmente stale. Monitorar pós Closed Testing. |
| Drain de N mutations enfileiradas → N RPCs server-side em rajada | 🟢 Baixo | **Inevitável** — cada mutation = 1 RPC obrigatório. `refetchDoses` debounce 2s consolida invalidações pós-drain. |
| `resumePausedMutations()` em todo hydrate | 🟢 Zero | **No-op** se `mutationCache` vazio. |
| Persist mutations no localStorage | 🟢 Zero | **Local apenas** — nenhum egress. |
| `useIsMutating()` em OfflineBanner | 🟢 Zero | **Cache local** — sem fetch. |

Net egress incremental esperado: ~zero pra usuários online normais. Pico real só em cenário offline → drain (que é o objetivo da feature). Aceitável.

**Problema:**

App de medicação não tolera perda de ação crítica. Auditoria revelou:

1. **Leitura offline OK** — `PersistQueryClientProvider` (src/main.jsx:66-89) com `createSyncStoragePersister` localStorage `maxAge: 24h`. Mobile abre offline, renderiza doses cacheadas, UI funciona.

2. **Escrita offline BROKEN** — mutations (confirmar dose, pular, undo, criar paciente, registrar SOS) hoje em `src/hooks/useDoses.js:82-131` configuradas com `retry: 3` + `retryDelay: Math.min(1000 * 2^attempt, 30000)`. Após 3 retries em ~30s, React Query descarta a mutation. Não há queue, não há fallback, não há resync ao reconectar. O `optimistic update` faz a UI mostrar como se tivesse confirmado, mas o servidor nunca recebeu.

3. **Cenário real Closed Testing** — tester confirma dose 14:30 enquanto no metrô (offline). UI marca como tomada. 30s depois, mutation falha + descarta. Tester volta online, banco diz dose ainda pendente, próximo refetch sobrescreve cache local → UI muda pra "esquecida". Pior: cálculo da próxima dose (continuous treatment) usa horário errado. Healthcare data corrupted silently.

**Padrão de mercado escolhido:**

TanStack Query feature oficial **Offline Mutations** (https://tanstack.com/query/latest/docs/react/guides/mutations#persisting-offline-mutations). Combina:
- `onlineManager.setOnline(false/true)` — pausa/resume execução
- `mutationCache` — serializável via persister existente
- `defaultOptions.mutations.networkMode: 'offlineFirst'` — não falha imediato em offline, espera reconexão

Zero deps novas (todas já em package.json). Zero schema change. Compatível com optimistic updates atuais.

**Abordagem (sem código final):**

(a) **Bridge `useOnlineStatus` ↔ `onlineManager`** em `src/main.jsx`:

```js
import { onlineManager } from '@tanstack/react-query'
import { Network } from '@capacitor/network'

// Sync onlineManager with Capacitor Network
Network.addListener('networkStatusChange', (status) => {
  onlineManager.setOnline(status.connected)
})
Network.getStatus().then((status) => onlineManager.setOnline(status.connected))
```

(b) **Configurar `networkMode` global** em `QueryClient` defaults:

```js
new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',  // serve cache mesmo offline
      // ... staleTime/retry existentes
    },
    mutations: {
      networkMode: 'offlineFirst',  // pausa em offline ao invés falhar
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    },
  },
})
```

(c) **Persister cobrir mutations** — atualmente `PersistQueryClientProvider` persiste só queries. Adicionar `dehydrateOptions.shouldDehydrateMutation: () => true` pra serializar mutations pendentes:

```js
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister,
    dehydrateOptions: {
      shouldDehydrateQuery: (q) => q.state.status === 'success',
      shouldDehydrateMutation: () => true,  // ← novo
    },
  }}
  onSuccess={() => {
    // resume mutations pausadas após hydrate
    queryClient.resumePausedMutations()
  }}
>
```

(d) **`mutationDefaults` em hooks críticos** — registrar mutationFn por chave pra resume funcionar (TanStack precisa da função pra re-executar pós-hydrate):

```js
// src/services/mutationRegistry.js (novo)
export function registerMutations(queryClient) {
  queryClient.setMutationDefaults(['confirmDose'], {
    mutationFn: confirmDose,
    onMutate: optimisticConfirmDose,
    onError: rollbackConfirmDose,
  })
  // ... idem skipDose, undoDose, createPatient, registerSosDose
}
```

useDoses.js + usePatients.js + useSos.js refatorar `useMutation` pra usar `mutationKey: ['confirmDose']` (lookup nos defaults).

(e) **UX feedback offline** — quando mutation paused, mostrar toast PT-BR:

```jsx
// src/components/OfflineBanner.jsx (novo)
const isOnline = useOnlineStatus()
const pendingMutations = useIsMutating()

if (!isOnline && pendingMutations > 0) {
  return <Banner>{pendingMutations} ação(ões) salva(s) — sincronizando ao reconectar</Banner>
}
```

**Mutations a cobrir (lista completa):**

| Hook/Service | Mutation | Criticidade |
|---|---|---|
| `useDoses.confirmDose` | confirmar dose tomada | 🔴 crítica (cálculo próxima dose continuous) |
| `useDoses.skipDose` | pular dose | 🔴 crítica (audit trail) |
| `useDoses.undoDose` | desfazer confirm/skip | 🟠 alta (correção user) |
| `useSos.registerSos` | registrar dose SOS extra | 🔴 crítica (anti-duplicação) |
| `usePatients.create/update/delete` | CRUD paciente | 🟠 alta |
| `useTreatments.create/update/pause/resume` | CRUD tratamento | 🟠 alta |
| `useUserPrefs.update` | preferências user | 🟡 média (não-crítico) |
| `usePushSubscription.register` | re-register FCM token | 🟢 baixa (fallback existe) |

**Dependências:**
- TanStack Query v5.51+ (já em `package.json` ✓)
- `@capacitor/network` v8.0.1 (já ✓)
- `@tanstack/query-sync-storage-persister` (já ✓)
- Sem migration DB

**Critério de aceitação:**

- ✅ Avião mode + confirmar dose → toast "1 ação salva — sincronizando ao reconectar"
- ✅ Avião mode + criar paciente + confirmar dose + registrar SOS → 3 mutations queued
- ✅ Voltar online → toast "Sincronizado" + queue drena em ordem FIFO
- ✅ Force kill app offline com mutations pending → reabrir → mutations persisted, drenam ao reconectar
- ✅ Conflict caso: mutation offline confirma dose, server-side cron já marcou skipped (race) → server response wins (refetch invalida cache otimista)
- ✅ Logout durante queue pendente → flush queue antes signOut (evita orphan mutations próxima sessão)
- ✅ Telemetria PostHog `mutation_queued_offline` + `mutation_drained_online` pra observability
- ✅ E2E manual: 5 confirm doses offline + reabrir online + verificar SQL `medcontrol.doses` reflete todas

**Risco / mitigações:**

| Risco | Mitigação |
|---|---|
| Conflict mutation offline + Realtime online (Plus user multi-device) | TanStack default: server response sobrescreve cache otimista. OK. |
| Mutation duplicada se app crash entre execute + ack | Idempotência server-side via `client_request_id` UUID — backlog item ([futuro #205?]) ou aceitar risco baixo no teste fechado |
| Queue cresce indefinidamente offline 24h+ | Persister maxAge 24h drop queue antigo. UX: toast warning "X ações pendentes há mais de 24h — verifique conexão" |
| User logout offline com queue cheia | Bloquear signOut até queue drenar OU dropar queue + warn user |
| Drift: mutation success local, server 5xx silencioso | onError callback marca como failed pós-retry exhaust + toast "Falhou ao salvar — tente novamente" |

**Não-escopo (Fase 2/3 cobertas por #165):**

- Delta sync via `updated_at` server-side filter
- TanStack persist trocado pra IndexedDB (Dexie/idb-keyval)
- staleTime bump 15min → 30min combinado
- Cobertura web frontend (Service Worker / vite-plugin-pwa)

**Métrica esperada:**

- Mutation loss rate offline: **100% → ~0%** (zero perda observável em testes manuais)
- UX: ações respondem instant (optimistic) + sincronizam transparente quando online volta
- Egress: zero impacto (drain ao reconectar = mesmo número de requests, só timing diferente)
- Esforço dev: 6-10h (4-6h código + 2-4h testes manuais avião mode)

**Validação device pré-merge:**

- [ ] Internal Testing AAB v0.2.1.7 instalado S25 Ultra
- [ ] Modo avião + confirm 3 doses + skip 1 + criar 1 paciente
- [ ] Reabrir wifi → todas 5 ações sincronizam
- [ ] SQL `SELECT * FROM medcontrol.doses WHERE userId = '...' AND status IN ('taken','skipped') ORDER BY updatedAt DESC LIMIT 5` confirma
- [ ] Painel admin `/auth-log` ou criar log dedicado mutations offline (opcional)

**Pós-Teste Fechado (não bloqueia merge):**

- Promover #165 (delta sync + IndexedDB) pra v0.2.2.0
- Considerar `client_request_id` idempotência (item novo backlog)
- Considerar PWA Service Worker se web frontend ganhar tração

---

### #207 — Defesa em profundidade alarme crítico (5 fixes)

- **Status:** ✅ Fechado v0.2.1.7 (vc 55, Vercel prod 2026-05-10) — validação device acumulada em [`Validar.md`](Validar.md)
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P0 (alarme é CRÍTICO em app de medicação — falha = paciente perde dose)
- **Origem:** User reportou 2026-05-08 19:48 — push FCM 6min antes funcionou mas alarme não disparou. Histórico de inconsistência ("cada hora funciona de um jeito").
- **Esforço real:** ~1.5h código

**Root causes identificados:**

| # | Bug | Local | Impacto |
|---|---|---|---|
| 🔴 1 | `advanceMins ?? 15` fallback no scheduler agendava alarme 15min antes do horário se localStorage prefs incompletos. DEFAULT_PREFS declara 0 — desalinhado. | `scheduler.js:58` + `scheduler.js:244` (web) | Alarme tocava 15min antes ou não tocava no horário esperado |
| 🟡 2 | `SCHEDULE_WINDOW_MS = 48h` (JS) + `HORIZON_HOURS = 72L` (DoseSyncWorker) cobriam só 2-3 dias futuros. User que não abria app por 49h+ não tinha alarmes locais — dependia FCM cron + Worker (que Samsung One UI 7 mata). | `prefs.js:10` + `DoseSyncWorker.java:53` | Doses futuras > janela não agendadas localmente |
| 🟡 3 | `firstResetDoneInSession` cache idempotência diff-and-apply (#200.1). Após primeira execução da sessão, lê `dosy_scheduled_groups_v1` localStorage. Se OEM matou AlarmManager mas localStorage diz "agendado" → diff vazio → não re-agenda. AlarmManager continua vazio. Drift silencioso. | `scheduler.js:31,66-71` + diff logic em `scheduler.js:91-145` | Cache vs SO desincronizado, alarme não toca apesar UI dizer "agendado" |
| 🔴 4 | `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` ausente no manifest + sem UX. Samsung One UI 7 default coloca apps em bucket "rare/restricted" → kills WorkManager + cancela alarms. | `AndroidManifest.xml` + `PermissionsOnboarding.jsx` | Samsung mata todo background activity, alarmes desaparecem |
| 🟢 5 | Zero observabilidade prod sobre quando rescheduleAll roda + quantos alarmes agenda. Bug invisível Sentry. | `scheduler.js` | Impossível diagnosticar prod issues remotamente |

**Implementação fechada (código):**

- ✅ `scheduler.js:58` — `prefs.advanceMins ?? 15` → `?? 0` (alinha DEFAULT_PREFS useUserPrefs.js)
- ✅ `scheduler.js:244` (rescheduleAllWeb) — mesma correção
- ✅ `prefs.js:10` — `SCHEDULE_WINDOW_MS = 48h` → `168h (7d)` + comentário razão
- ✅ `DoseSyncWorker.java:53` — `HORIZON_HOURS = 72L` → `168L` alinhado JS
- ✅ `scheduler.js` — drop `firstResetDoneInSession` flag + drop `loadScheduledState()` diff logic + drop `toRemove/toUpdate/toKeep` calc + drop `cancelGroup` por-groupId. Substituído por `cancelAll()` SEMPRE no início + agenda todos do desired set. Estado persistido apenas pra observabilidade.
- ✅ `AndroidManifest.xml` — adicionado `<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />` com comentário razão Samsung One UI 7 + Play Store policy compliance (medication reminder exception)
- ✅ `CriticalAlarmPlugin.java` — 3 métodos novos: `isIgnoringBatteryOptimizations()` retorna `{ignoring: bool}`, `requestIgnoreBatteryOptimizations()` abre dialog system + fallback `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` + `checkPermissions()` enriquecido com `ignoringBatteryOpt` field e `allGranted` agora inclui essa flag
- ✅ `criticalAlarm.js` — bridge JS expondo 2 métodos novos
- ✅ `PermissionsOnboarding.jsx` — 5º item "Ignorar otimização de bateria" com action requestIgnoreBatteryOptimizations + descrição explicativa Samsung/Xiaomi
- ✅ `scheduler.js` — `Sentry.addBreadcrumb` em `rescheduleAll START` (com dosesCount + patientsCount) e `END` (com alarmsScheduled + dndSkipped + localNotifs + summary + advanceMins + groupsCount). Crashes futuros virão com trail completo do scheduling state.
- ✅ Build verde: `npm run build` 21.11s

**Trade-off egress / performance:**

| Mudança | Custo | Justificativa |
|---|---|---|
| Drop diff-and-apply | +200-2000ms janela cancelAll vazia por sessão (mitigada: roda async background, user não percebe) | App de medicação não pode tolerar drift cache vs SO. Custo aceito pra garantia 100%. |
| SCHEDULE_WINDOW_MS 48h → 168h | ~3x mais alarmes registrados (5 → 28 typical user) | AlarmManager limit ~500/app — folga 20x. Custo Android desprezível. |
| HORIZON_HOURS Worker 72 → 168 | Worker fetch query retorna 2-3x mais rows | Doses são pequenas (~250 bytes), diferença 10KB/Worker run. Worker roda 4x/dia max — desprezível. |
| Sentry breadcrumbs | ~2 breadcrumbs por rescheduleAll (~50/dia user típico) | Sentry quota: ~1M breadcrumbs/mês plano grátis. 50 × 30d × 100 users = 150k/mês — bem dentro. |

**Validação device (S25 Ultra) — alinhada com testes #204:**

- [ ] Instalar AAB v0.2.1.7 vc 55 Internal Testing
- [ ] PermissionsOnboarding aparece pós-login → 5º item "battery optimization" listado e bloqueante
- [ ] Toca em "Abrir configurações" → dialog system Android pede whitelist → aceitar → recheck mostra granted
- [ ] Logcat `adb logcat -s "AlarmScheduler" "AlarmReceiver" "DoseSyncWorker" "Notif"` durante 24h cobertura:
  - `[Notif] reschedule START — full cancelAll` aparece
  - `[Notif] reschedule END — alarms: N` confirma N agendados
  - `AlarmScheduler: scheduled id=XXX at=YYY count=Z` por dose
- [ ] Configurar dose pra **2 horas no futuro** + fechar app + esperar alarme tocar (simula app em background longo)
- [ ] Configurar dose pra **3 dias no futuro** + reinstalar app + verificar Worker re-agenda quando rodar
- [ ] Sentry dashboard: confirmar breadcrumbs `alarm: rescheduleAll START/END` aparecem em qualquer crash report
- [ ] Bateria S25 Ultra Settings → Otimização de bateria → Dosy: confirma "Sem restrições" pós onboarding

**Pendente Fase 1.5 (não bloqueia merge):**

- [ ] Telemetria PostHog `alarm_scheduling_drift_detected` (Worker detecta AlarmManager < expected)
- [ ] `CriticalAlarm.getActiveAlarms()` JS-side probe pra detectar mismatch real-time + force reschedule
- [ ] Painel admin /alarm-debug por user (lista alarmes agendados ↔ DoseSyncWorker last-run + ignoringBatteryOpt status)
- [ ] Fallback emergencial via In-app Foreground Service "Dosy Monitor" sempre ON (DosyMonitorService) — promover #23.7 backlog

---

### #205 — Single source refresh token (storm xx:00 fix)

- **Status:** ✅ Fechado v0.2.1.8 (vc 56, Vercel prod 2026-05-12 01:50 UTC, tag `v0.2.1.8` commit `b7b5c71`, AAB Internal Testing 2026-05-11 22:45 BRT) — validação cumulativa 218.9.x 24h pendente (não-bloqueador release; qualquer falha → fix v0.2.1.9+)
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P0 (bloqueador antes Closed Testing público — re-logins frequentes degradam UX healthcare crítica)
- **Origem:** Investigação 2026-05-10 SQL `auth.refresh_tokens` + `auth.sessions` + telemetria `medcontrol.auth_events` durante session lifecycle user `lhenrique.pda@gmail.com` no S25 Ultra (vc 55 Internal Testing v0.2.1.7)
- **Esforço estimado:** 4-6h (código real ~2h Java + 30min JS)

**Problema observado:**

User reportou re-login forçado constante no app S25 Ultra. Painel admin `/auth-log` mostrou 4 `login_email_senha` em ~12h (digitou senha manualmente) intercalados com `sessao_restaurada`. SQL revelou:

```sql
-- Sessions S25 Ultra últimas 72h: 8 sessões distintas, lifespans muito curtos
WITH u AS (SELECT id::uuid AS uid FROM auth.users WHERE email = 'lhenrique.pda@gmail.com')
SELECT s.id, s.created_at, s.updated_at,
       EXTRACT(EPOCH FROM (s.updated_at - s.created_at))/3600 AS lifespan_hours
FROM auth.sessions s, u WHERE s.user_id = u.uid
ORDER BY s.created_at DESC LIMIT 10;
-- Resultados: 0.27h, 3.66h, 0.30h, 8.54h, 3.41h, 3.81h, 60.35h (web), 9.05h
-- → sessões mobile morrem em 18min a ~9h
```

```sql
-- Pattern refresh storm 100% top-of-hour xx:00:0X
WITH u AS (SELECT id::text AS uid FROM auth.users WHERE email = 'lhenrique.pda@gmail.com')
SELECT DATE_TRUNC('minute', created_at) AS bucket, COUNT(*) AS tokens
FROM auth.refresh_tokens rt, u WHERE rt.user_id = u.uid
  AND created_at > NOW() - INTERVAL '48 hours'
GROUP BY 1 HAVING COUNT(*) > 2 ORDER BY 1 DESC;
-- 2026-05-11 00:00 → 20 tokens
-- 2026-05-10 18:00 → 3 tokens
-- 2026-05-10 12:00 → 19 tokens
-- 2026-05-09 12:00 → 25 tokens
-- → TODAS storms top-of-hour
```

20+ refreshes em 7 segundos mesma session 89867645 (00:00:04 → 00:00:11). Cada token rotacionado em 5-8ms, todos `rotated_from_parent=true revoked=true` exceto último. Lifespan session: 16 minutos.

**Causas (3 fontes paralelas chamando `/auth/v1/token?grant_type=refresh_token`):**

1. **JS supabase-js auto-refresh** — `createClient({ auth: { autoRefreshToken: true }})` em `src/services/supabase.js:34`. Refresh automático quando JWT expira (~xx:00 após login).

2. **`DoseSyncWorker.refreshAccessToken()` Android** — `android/.../DoseSyncWorker.java:108`. WorkManager periodic 6h chama HTTP POST direto. Lê `refresh_token` SharedPref → POST → persist `newRefresh`.

3. **`DosyMessagingService.refreshAccessToken()` Android FCM handler** — `android/.../DosyMessagingService.java:202`. Static method usado por `reportAlarmScheduled()` quando FCM data message chega.

Os 3 caminhos compartilham SharedPref `dosy_sync_credentials.refresh_token`. Quando JWT expira ~xx:00:
- JS app foreground chama refresh → recebe novoToken1, persiste
- Worker periodic OU FCM handler entra → lê refresh_token (pode ser velho se app ainda processando), chama refresh com token velho → 400 OR usa newer → persiste outroToken
- Race condition `sp.edit().putString.apply()` não-atômico → escritas se sobrescrevem
- Supabase Auth detecta **token reuse** → revoga chain inteira → próximas tentativas retornam 401 → cascata 20+ refreshes em 7s todos falhando ou rotacionando inutilmente
- App recebe sequência de erros → eventualmente `setUser(null)` → user vê tela login

**Implementação fechada (código):**

✅ `android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/CriticalAlarmPlugin.java`:
- `setSyncCredentials` aceita opcionais `accessToken` (String) + `accessTokenExp` (Long epoch ms)
- Novo `@PluginMethod public void updateAccessToken(PluginCall call)` — escreve apenas `access_token` + `access_token_exp_ms` em SharedPref, sem touchar refresh_token/anon_key/schema. Lightweight pra TOKEN_REFRESHED listener.

✅ `android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/DoseSyncWorker.java`:
- **Removeu `refreshAccessToken()` private method** — não chama mais `/auth/v1/token`
- `doWork()` lê `access_token` + `access_token_exp_ms` SharedPref direto
- Se `access_token == null` ou `(now + 60s) >= exp` → `Result.success()` (skip rodada, NÃO retry pra evitar storm; next periodic pega token fresco após JS refresh foreground)
- Se fetch retorna não-200 → `Result.success()` (assume token rejeitado, skip)
- Mantém grouping doses por minuto + AlarmScheduler integration

✅ `android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/DosyMessagingService.java`:
- **Removeu static `refreshAccessToken()` method** completo + chamada de `reportAlarmScheduled()`
- `reportAlarmScheduled()` lê `access_token` cached + verifica exp local
- Se ausente/expirado → skip silencioso (alarme local já scheduled em `handleScheduleAlarms`, este report é defense extra pra cron skip push redundante — não-crítico se falhar)

✅ `src/services/criticalAlarm.js`:
- `setSyncCredentials` payload inclui `accessToken` + `accessTokenExp` opcionais
- Novo `updateAccessToken({accessToken, accessTokenExp})` export — chama plugin method

✅ `src/hooks/useAuth.jsx`:
- Listener `onAuthStateChange` em SIGNED_IN/TOKEN_REFRESHED/INITIAL_SESSION propaga `s.access_token` + `s.expires_at * 1000` ms via `setSyncCredentials`
- Mantém propagation `refresh_token` (Worker ainda lê — mas NÃO usa pra refresh; mantido pra futuro fallback)

**Estratégia anti-storm:**

| Camada | Antes | Depois |
|---|---|---|
| JS supabase-js | auto-refresh ON | auto-refresh ON (ÚNICA fonte) |
| Worker periodic | refreshAccessToken() POST `/auth/v1/token` | lê `access_token` cached + verifica exp local; expirado → skip rodada |
| FCM handler reportAlarmScheduled | refreshAccessToken() POST `/auth/v1/token` | lê `access_token` cached + verifica exp local; expirado → skip report (não-crítico) |
| useAppResume #202 | mutex JS-side | mantém (refresh JS-side único) |

**Trade-offs:**

- WorkManager rodada pode skip se user não foreground app por >1h após token expirar → AlarmManager local já scheduled da rodada anterior (HORIZON 168h cobre 7 dias). Próximas execuções (6h período) acabarão pegando token fresco quando user abrir app.
- DosyMessagingService.reportAlarmScheduled skip → notify-doses cron pode mandar push redundante mesmo com alarme local agendado. Não-crítico (defense extra; cobre cenário Worker não tinha rodado ainda).
- Se user ficar offline literal >7d sem abrir app → Worker eventualmente terá só doses fora HORIZON cached + alarmes não agendados. Cenário extremo aceitável.

**Auditoria egress #205:**

| Risco | Severidade | Mitigação | Decisão |
|---|---|---|---|
| Worker pula rodadas se token expirado → menos requests | 🟢 Zero/negativo | N/A | **Aceitável** — net egress reduz (storm 20 reqs/min eliminada) |
| FCM handler skip reportAlarmScheduled → cron sem flag agendado | 🟡 Médio | Cron `notify-doses` fallback push tray cobre — user vê notif mesmo sem alarme | **Aceitável** — defense extra perdida em raro cenário |
| JS supabase-js single source → próximo refresh natural cobre | 🟢 Zero | onAuthStateChange TOKEN_REFRESHED dispara `setSyncCredentials` com access_token fresco | **OK** |

**Critério de aceitação:**

- ✅ Build verde
- ✅ SQL `auth.refresh_tokens` durante 24h após install vc 56: zero buckets >5 tokens/minuto top-of-hour
- ✅ SQL `auth.sessions` lifespan >12h por sessão (em vez de 18min-3h atual)
- ✅ Painel admin `/auth-log` zero `login_email_senha` em <24h consecutivos (apenas `sessao_restaurada`)
- ✅ Sentry zero issues "TypeError: Failed to fetch (refresh_token)" pós-install
- ✅ Logcat S25 Ultra: zero linhas `[DoseSyncWorker] token refresh status=` ou `[DosyMessagingService] refreshAccessToken`

**Risco / mitigações:**

| Risco | Mitigação |
|---|---|
| access_token expira durante Worker rodada (rara — JS deveria ter refeito refresh antes Worker rodar) | Worker skip + retry periodic 6h depois. AlarmManager local cobertura 168h cobre janela |
| User fica offline >1h sem abrir app → access_token expira → Worker skip + nenhum JS pra refresh | Aceitável: AlarmManager local da rodada anterior cobre próximas 168h. User abrir app → JS refresh → próximo Worker rodada usa fresh |
| Race FCM handler + JS app foreground refresh simultâneo (raríssimo) | FCM handler agora lê apenas access_token, não chama refresh. Race eliminada arquiteturalmente |
| Plugin updateAccessToken falhar silencioso (catch geral) | Sentry breadcrumb opcional pós-Closed Testing (Fase 1.5) |

**Validação device pré-merge:**

Ver [`Validar.md`](Validar.md) seção "#205 v218.x" — checklist completo S25 Ultra:
- Reinstalar vc 56 + login → SQL refresh_tokens monitorar 24h
- Forçar lifecycle: foreground 30min, background 90min, retornar, repetir 3 ciclos cobrindo top-of-hour
- Sentry breadcrumbs zero "Failed to fetch"
- Painel admin `/auth-log` apenas `sessao_restaurada` consecutivos

**Pós-merge (não bloqueia):**

- [ ] Bumpar JWT expiry Supabase Dashboard Auth → Settings: 3600 → 28800 (8h) ou 86400 (24h) — paliativo extra que reduz frequência storms se algum caminho residual permanecer
- [ ] Plus refactor `useUserPrefs.update` + `useUpsertSosRule` + `useSharePatient` etc pra entrarem na queue offline (item separado #206)
- [ ] Telemetria PostHog `auth_refresh_storm_detected` (Worker detecta storm via timestamp delta)

---

### #208 — UpdateBanner mostra versionName errado quando map `VERSION_CODE_TO_NAME` desatualizado

- **Status:** ⏳ Aberto
- **Categoria:** 🐛 BUGS
- **Prioridade:** P2 (UX bug recorrente, não-bloqueador — fluxo update funciona, label visual errado)
- **Origem:** User-reported 2026-05-11 pós-install vc 56 Internal Testing — banner mostrou "v0.2.1.7" ao invés de "v0.2.1.8" na atualização vc 55→56
- **Esforço estimado:** (a) curto-prazo 5min · (b) longer-term 1-2h
- **Release sugerida:** v0.2.1.9+ (próxima code release; junto com outros fixes minores)
- **Extends:** #189 (triple fallback chain já implementada v0.2.1.3 vc 49)

**Problema:**

User-reported 2026-05-11 22:50 BRT após desinstalar Dosy + reinstalar Teste Interno:

> "app não veio atualizado... baixou versão anterior xx.1.7 e apareceu banner verde de atualização... atualizou pra xx.1.8, mas no banner verde estava escrito nova versão 0.2.1.7"

Sequência observada:
1. Install Teste Interno entregou vc 55 (0.2.1.7) — Internal Testing CDN ainda não propagou vc 56 (~1h delay esperado após publish)
2. App vc 55 detectou update disponível via Play Core (`info.updateAvailability === 2`)
3. UpdateBanner.jsx renderizou subtitle `v${latest.version}` — **mostrou "v0.2.1.7" (versão errada — deveria ser "v0.2.1.8" nova)**
4. User clicou Atualizar → flexible update baixou vc 56 → app virou 0.2.1.8 ✅ (fluxo função OK)

**Root cause:**

`src/hooks/useAppUpdate.js:89-101` `VERSION_CODE_TO_NAME` map manual:

```js
const VERSION_CODE_TO_NAME = {
  46: '0.2.1.0',
  47: '0.2.1.1',
  // ...
  54: '0.2.1.6',
  55: '0.2.1.7',
  // adicionar próximas releases aqui  ← FALTA 56: '0.2.1.8'
}
```

Triple fallback chain (#189 fix v0.2.1.3 vc 49) ordem:
1. `info.availableVersion` Play Core — Android 16 retorna `undefined` (regressão API ou Play Core SDK)
2. `versionData?.version` Vercel `/version.json` — CDN stale logo após deploy (vercel cache CDN ~minutos)
3. `VERSION_CODE_TO_NAME[info.availableVersionCode]` — **undefined** (entry 56 faltando)
4. Fallback `versão ${info.availableVersionCode}` — feio ("versão 56")

User viu "0.2.1.7" — provavelmente Vercel CDN cache stale serviu `version.json` antigo (vc 55 era prod até minutos antes do deploy v0.2.1.8). Plus `currentVersion` no fallback final em outro caminho do banner.

**Bug recorrente:**

Comentário inline `// adicionar próximas releases aqui` nunca lembrado no release lifecycle (passo 8 commit ou passo 11 AAB build). Toda nova versionCode + versionName precisa entry manual nesse map — esquecimento sistemático.

**Abordagem (a) curto-prazo — entry manual + memory note (5min):**

```js
const VERSION_CODE_TO_NAME = {
  // ... existing
  55: '0.2.1.7',
  56: '0.2.1.8',  // ← NOVO
  // futuro 57+, lembrar atualizar A CADA release no Passo 11 README
}
```

Plus criar/atualizar `memory/feedback_release_lifecycle.md` com checklist:
- [ ] Bump vc + vn em build.gradle + package.json
- [ ] **Atualizar VERSION_CODE_TO_NAME em useAppUpdate.js** ← NOVO item
- [ ] npm run build + cap sync
- [ ] Commit chore
- [ ] AAB build + upload Play Console

**Abordagem (b) longer-term — gerar map dinamicamente (1-2h):**

Opção 1: **Vite plugin custom** que lê `git tag --list "v*"` no build → emite chunk `versionMap.json` deployado junto `version.json` → useAppUpdate.js fetcha em vez de hardcoded.

Opção 2: **Build script `scripts/sync-version-map.mjs`** rodado pre-build que parsea git tags → atualiza arquivo `src/data/versionMap.json` → committed git. Auto-update toda release.

Trade-off (b): elimina bug recorrente sempre, mas adiciona complexidade build pipeline. Aceitável pra evitar manutenção manual.

**Critério de aceitação:**

- ✅ User instala vc N → banner mostra "v(N+1).versionName" correto (não "versão (N+1)" feio)
- ✅ Vercel CDN cache miss não afeta banner — fallback map cobre
- ✅ Memory note ou auto-pipeline previne esquecimento próximas releases

**Risco / mitigações:**

| Risco | Mitigação |
|---|---|
| Approach (a) esquecida outra release | Memory feedback + check Passo 11 README |
| Approach (b) build pipeline overhead | Plugin Vite trivial — read git tags + emit JSON; +~50ms build |
| Vercel CDN cache stale persiste 1h+ | Aceito — fallback map cobre quando CDN missing/stale |

**Não-escopo:**

- Não bumpa vc 57 só pra esse fix (cosmético). Próxima release "natural" (v0.2.1.9 ou code release) inclui.
- Não muda fluxo update flexible — funcionou perfeito user. Apenas label banner subtitle.

**Validação pós-fix:**

- [ ] Reinstall via Internal Testing após próxima release N+1 publicada — banner deve mostrar "v0.X.Y.Z" (N+1) correto, não "versão (N+1)"
- [ ] Se Vercel CDN ainda servir version.json antigo, map fallback kick in OK

---

### #209 — Push 5am + alarme 8am falha + header "Sem Paciente" (TZ bug update_treatment_schedule + arq alarmes redundante)

- **Status:** ✅ Resolvido (release v0.2.1.9 vc 57)
- **Categoria:** 🐛 BUGS
- **Prioridade:** P0 (alarme crítico falhou — risco clínico real)
- **Origem:** User-reported 2026-05-13 manhã — 3 bugs simultâneos S25 Ultra Android 16:
  1. Alarme 20h 2026-05-12 tocou com várias doses no horário mas header "Sem Paciente"
  2. Push notification 5am 2026-05-13 pra Broncho-Vaxom Liam/Rael (agendado 8am)
  3. Alarme 8am 2026-05-13 NÃO tocou — nem Broncho-Vaxom, nem 14 outras doses regulares 8am (Luiz Henrique/Liam/Rael)

**Problema:**

3 bugs com causas relacionadas mas distintas:

**BUG 1 (Header "Sem Paciente"):**
DoseSyncWorker.java query `/rest/v1/doses` sem embed `patients(name)`. Persistia `patientName=""` no SharedPreferences. AlarmActivity render "Sem Paciente" fallback quando nome vazio + grouped doses.

**BUG 2 (Push 5am pra dose 8am):**
RPC `update_treatment_schedule` interpretava `dose_times = "08:00"` como UTC ao invés de BRT. Postgres `(date_trunc('day', startDate) + interval '8 hours')::timestamptz` virou `08:00 UTC = 05:00 BRT`. Doses criadas com `scheduledAt = 2026-05-13 05:00:00-03:00` (5am local) ao invés de 8am. Edge Function `notify-doses-1min` cron disparou push 5am corretamente — só que o `scheduledAt` que estava errado.

**BUG 3 (Alarme 8am não tocou — 2 categorias):**
- Doses Broncho-Vaxom: scheduledAt errado 5am → não havia alarme 8am pra tocar
- 14 doses regulares 8am: arq alarmes redundante — DoseSyncWorker 6h cobertura 168h, schedule-alarms-fcm-6h cron, notify-doses-1min cron, JS rescheduleAll. Múltiplos paths concorrentes sem coordenação → cancelamentos/sobreposições + Doze mode S25 Ultra agressivo bloqueou FCM data delivery → alarme local nunca agendado pra esses ids específicos.

**Root cause:**

1. `medcontrol.update_treatment_schedule` PL/pgSQL sem `AT TIME ZONE` correção — interpretava times locais como UTC
2. `DoseSyncWorker.java` query sem PostgREST embed `patients(name)` → patientName vazio persistido
3. Arquitetura alarmes 5 paths redundantes (rescheduleAll JS + dose-trigger-handler 6h + notify-doses-1min cron + schedule-alarms-fcm-6h cron + DoseSyncWorker 168h) sem coordenação → race + over-egress + Doze blocking
4. Edge Function `dose-trigger-handler` horizon 6h muito curto pra dose criada hoje 23h pra amanhã 8am (>6h gap)

**Implementação:**

**Fase 1 — Correção bugs imediatos:**

1. `DoseSyncWorker.java` query PostgREST embed `patients(name)`, extrair `d.patients.name` → `entry.put("patientName", ...)`. HORIZON 168h → 48h (alinhado com daily-alarm-sync).
2. `AlarmScheduler.java` novo método estático `cancelAlarm(Context, int id)` + `removePersisted(Context, int id)` helper — pra DosyMessagingService cancelar alarmes via FCM remoto.
3. `DosyMessagingService.java` novo handler action `cancel_alarms` (parse CSV `doseIds`, loop `AlarmScheduler.cancelAlarm`).
4. DB migration `fix_update_treatment_schedule_timezone`: RPC reescrito com parâmetro `p_timezone DEFAULT 'America/Sao_Paulo'`, `v_start_local := (v_treatment."startDate" AT TIME ZONE p_timezone)::timestamp`, `v_first := (date_trunc('day', v_start_local) + make_interval(...)) AT TIME ZONE p_timezone`.
5. DB migration `data_fix_doses_timezone_v0_2_1_9_retry`: regenera doses `status=pending` `scheduledAt > now()` via RPC corrigido idempotente.

**Fase 2 — Refactor cron 5am:**

6. Edge Function nova `daily-alarm-sync/index.ts`: cron `0 8 * * *` UTC (5am BRT), horizon 48h, FCM data com retry exponencial 3 attempts, multi-TZ via `user_prefs.prefs.timezone`. Shared module `_shared/userPrefs.ts`.
7. Edge Function `dose-trigger-handler` v16: horizon 6h → 48h, novo action `cancel_alarms` pra DELETE + UPDATE pending→non-pending + scheduledAt-change.
8. DB migration `cron_jobs_v0_2_1_9_daily_alarm_sync`: UNSCHEDULE `notify-doses-1min` + `schedule-alarms-fcm-6h`, SCHEDULE `daily-alarm-sync-5am`.

**Fase 3 — Bug #208 follow-up:**

9. `useAppUpdate.js` adicionar `56: '0.2.1.8'` + `57: '0.2.1.9'` no `VERSION_CODE_TO_NAME` map (fix #208 inline).

**Nova arquitetura (4 paths coordenados):**

| Path | Quem | Quando | Horizon | Função |
|---|---|---|---|---|
| JS rescheduleAll | App foreground | App start + offline replay | 48h | Reagenda local instantâneo |
| dose-trigger-handler | DB trigger | Mudança real-time (INSERT/UPDATE/DELETE) | 48h | FCM data pra todos devices user |
| daily-alarm-sync | pg_cron 5am BRT | Diário | 48h | Garante alarmes 48h frente independente |
| DoseSyncWorker | WorkManager | Periodic 6h | 48h | Defense-in-depth Doze-recovery |

**Egress audit:**

| Path antes | Reqs/dia | Path agora | Reqs/dia | Redução |
|---|---|---|---|---|
| notify-doses-1min cron | 1440 (1/min) | daily-alarm-sync 5am | 1 | -99.9% |
| schedule-alarms-fcm 6h cron | 4 | (removido) | 0 | -100% |
| dose-trigger-handler real-time | ~10-30/dia user (mudanças) | dose-trigger-handler real-time | ~10-30/dia user | = |
| DoseSyncWorker periodic 6h | 4/dia/device | DoseSyncWorker periodic 6h | 4/dia/device | = |
| JS rescheduleAll | 1-10/dia/app session | JS rescheduleAll | 1-10/dia/app session | = |
| **Total estimado** | **~1480/dia (servidor) + ~14/dia/device** | **~5/dia/user (servidor) + ~14/dia/device** | **-99% servidor** |

**Critério de aceitação:**

- ✅ Build verde + AAB vc 57 publicado Internal Testing
- ✅ DB SQL `doses pending scheduledAt LIKE '%05:00:00%'` retorna 0 rows (corrigidas pra 08:00)
- ✅ S25 Ultra dose criada hoje pra amanhã 8am → alarme dispara 8am BRT com header patient correto
- ✅ Push notification chega apenas na hora certa (não +3h offset)
- ✅ Cron `notify-doses-1min` + `schedule-alarms-fcm-6h` UNSCHEDULED no `cron.job` view
- ✅ Cron `daily-alarm-sync-5am` SCHEDULED + executando 5am BRT diariamente
- ✅ Supabase egress dashboard: queda ~99% requests Edge Functions vs baseline pré-v0.2.1.9
- ✅ Update banner mostra "v0.2.1.9" correto (não "versão 57" fallback feio)

**Risco / mitigações:**

| Risco | Severidade | Mitigação | Decisão |
|---|---|---|---|
| daily-alarm-sync cron falhar 5am (Supabase outage) | 🟡 Médio | DoseSyncWorker 6h periodic cobre próximas 48h independente. dose-trigger-handler real-time cobre mudanças | **Aceitável** — defense-in-depth |
| Doze mode S25 Ultra bloquear FCM data | 🟡 Médio | DoseSyncWorker local AlarmManager.setAlarmClock bypassa Doze. Local agendamento via WorkManager backup | **Aceitável** |
| RPC update_treatment_schedule TZ default `America/Sao_Paulo` errado pra usuários outros fusos | 🟢 Baixo | Param `p_timezone` aceita user_prefs.timezone — futuro multi-TZ ready. BR-only release atual | **OK** |
| Migration data-fix re-trigger update_treatment_schedule sobrescreve customizações user | 🟢 Baixo | Idempotente — só regenera doses `status=pending scheduledAt > now()`. Status taken/skipped preserved | **OK** |
| Cron unschedule deixa órfãos schedule-alarms-fcm-6h job rodando | 🟢 Baixo | DROP cron.job aplicado migration. Verificar SELECT * FROM cron.job retorna apenas daily-alarm-sync-5am | **OK** |

**Validação device pré-merge:**

Ver [`Validar.md`](Validar.md) seções 219.1.1 → 219.6.1 — checklist completo S25 Ultra:
- Doses futuras 8am criadas hoje 23h → alarme 8am BRT dispara com nome paciente correto
- Cancelar tratamento → FCM `cancel_alarms` chega + AlarmScheduler.cancelAlarm executado + SharedPreferences cleaned
- 5am cron daily-alarm-sync logs Edge Function executa + agenda 48h doses pending
- Update banner pós-install vc 57 mostra "v0.2.1.9" correto

**Não-escopo:**

- Multi-TZ user UI selector (futuro release)
- Migrar todas Edge Functions pra usar `_shared/userPrefs.ts` (incremental)
- Telemetria PostHog `alarm_missed_detected` Worker side (item separado)

---

### #210 — Sistema auditoria de alarmes para admin.dosymed.app

- **Status:** ✅ Resolvido (release v0.2.2.0 vc 58)
- **Categoria:** 🛠️ OBSERVABILIDADE / DEBUG
- **Prioridade:** P1 (debug arquitetura alarmes pós-#209)
- **Origem:** User-requested 2026-05-13 pós-publish v0.2.1.9 — necessidade observar fluxo completo de agendamento de alarmes no celular pra debugar duplicidade/sobreposição/inconsistência entre 6 caminhos.

**Problema:**

Pós-refactor #209, arquitetura de alarmes ficou com 4 paths coordenados (JS rescheduleAll + dose-trigger-handler + daily-alarm-sync + DoseSyncWorker) + AlarmReceiver fire + FCM cancel handler. Sem visibilidade end-to-end, impossível confirmar:
- Algum path agendando duplicado?
- Cancel chegou ao device?
- Cron 5am realmente disparou FCM data?
- Worker rodou nas últimas 24h?
- Alarme fired_received aconteceu?

**Implementação:**

1. **DB schema** (migration `create_alarm_audit_log_v0_2_2_0`):
   - `medcontrol.alarm_audit_log` (user_id, device_id, dose_id, source, action, scheduled_at, patient_name, med_name, metadata jsonb, created_at)
   - `medcontrol.alarm_audit_config` (user_id, enabled, notes, created_by, updated_at) — whitelist usuários
   - RLS: admin-only SELECT logs + manage config. User INSERT próprio gated por config.enabled.
   - Helper RPC `is_alarm_audit_enabled(p_user_id)` (consultado app/Edge)
   - Admin RPCs: `admin_list_alarm_audit(filtros)`, `admin_list_alarm_audit_config()`, `admin_toggle_alarm_audit(email, enabled, notes)`
   - Seed `lhenrique.pda@gmail.com` enabled
   - Cron `alarm-audit-cleanup-daily` 3:15 UTC — retention 7d via `cron_alarm_audit_cleanup()`

2. **JS helper** (`src/services/notifications/auditLog.js`):
   - `isEnabled()` cache 5min via RPC
   - `logAuditEvent(ev)` + `logAuditEventsBatch(events)` silent-fail
   - Wire `scheduler.js rescheduleAll`: batch_start/batch_end + per-dose scheduled (critical_alarm + local_notif) + per-dose skipped (dnd_window)

3. **Java helper** (`AlarmAuditLogger.java`):
   - Executor single-thread (não bloqueia hot path)
   - `logScheduled/logCancelled/logFired/logBatch` POST `/rest/v1/alarm_audit_log`
   - Reuse credentials `dosy_sync_credentials` SharedPrefs
   - device_id = `Build.MODEL (Build.MANUFACTURER)`
   - Wire `DoseSyncWorker` (source `java_worker`): batch_start/batch_end + per-dose scheduled
   - Wire `DosyMessagingService.handleScheduleAlarms` (source `java_fcm_received`): batch_start/batch_end + per-dose scheduled
   - Wire `DosyMessagingService.handleCancelAlarms` (source `java_fcm_received`): per-dose cancelled
   - Wire `AlarmReceiver.onReceive` (source `java_alarm_scheduler`): per-dose fired_received

4. **Edge Functions** (`_shared/auditLog.ts` novo):
   - `getEnabledAuditUsers(supabase)` → `Set<user_id>` whitelist preload
   - `logAuditBatch(supabase, rows[])` insert batch
   - `daily-alarm-sync` v2: per-user gate audit + batch_start/end + per-dose fcm_sent/skipped (source `edge_daily_sync`)
   - `dose-trigger-handler` v17: gate audit + per-dose fcm_sent/cancelled/skipped (source `edge_trigger_handler`) com `triggerType` (INSERT/UPDATE/DELETE) + `triggerReason` (insert_pending_future / status_pending_to_done / scheduled_at_changed / undo_to_pending / delete_pending) no metadata

5. **Admin UI dosy-admin**:
   - `/alarm-audit` página principal — RPC `admin_list_alarm_audit` paginado, filtros (email user, source, action, dose_id, hoursBack [1h/6h/24h/72h/168h/all], limit [50-1000]), stats cards (total/doses/sources/actions), tabela clicável → modal detalhes (descrição linguagem natural pt-BR + tags coloridas source/action + metadata raw JSON pretty + link "Ver todos eventos desta dose")
   - `/alarm-audit-config` página config — RPC `admin_list_alarm_audit_config` lista usuários monitorados com log_count, form add (email + notes) via `admin_toggle_alarm_audit`, toggle pause/reactivate por linha
   - Nav Layout entry "⏰ Histórico de alarmes"
   - Linguagem natural pt-BR (caveman OFF user-facing): labels traduzidos `js_scheduler` → "App (em uso ativo)", `edge_daily_sync` → "Servidor (sincronização diária 5h)", etc

**Configuração inicial:**

- Seed migration: `lhenrique.pda@gmail.com` enabled = true (notes: "Owner debug — seed v0.2.2.0")
- Outros users: invisíveis ao sistema (zero inserts geração)

**Egress audit:**

| Cenário | Rows/dia estimado | Notas |
|---|---|---|
| lhenrique device foreground (JS rescheduleAll 3x/dia) | ~60 rows | 14 doses × 3 reschedule + batch tags |
| lhenrique Worker periodic 6h (4x/dia) | ~60 rows | 14 doses × 4 rodadas |
| lhenrique FCM received (cron 5am + trigger real-time ~10/dia) | ~150 rows | 14 doses × 11 events |
| lhenrique AlarmReceiver fired (14/dia) | 14 rows | 1 por fire |
| Edge daily-sync 5am 1x/dia | ~30 rows | 14 doses × 2 devices × 1 cron |
| Edge trigger-handler real-time (~10/dia) | ~10 rows | 1 per mudança dose |
| **Total estimado lhenrique** | **~324 rows/dia** | aceitável debug feature |
| Outros users (não habilitados) | 0 rows | gate via RLS + Set<userId> Edge |

7d retention × 324/dia = ~2300 rows total — trivial pra Postgres.

**Critério de aceitação:**

- ✅ Build verde admin + app
- ✅ AAB vc 58 publicado Internal Testing
- ✅ Migration aplicada — `SELECT * FROM medcontrol.alarm_audit_config` retorna lhenrique enabled
- ✅ Cron `alarm-audit-cleanup-daily` SCHEDULED
- ✅ Edge functions deployed: daily-alarm-sync v2 + dose-trigger-handler v17
- 🧪 Device runtime: instalar vc 58, abrir app, abrir admin `/alarm-audit` → ver eventos JS scheduler.js rescheduleAll na lista
- 🧪 Aguardar 5am BRT seguinte: cron daily-alarm-sync deve gerar batch_start/fcm_sent/batch_end events source `edge_daily_sync`
- 🧪 Confirmar dose como tomada via app: dose-trigger-handler deve gerar `cancelled` event source `edge_trigger_handler`
- 🧪 Aguardar 8am alarme fire: AlarmReceiver deve gerar `fired_received` event source `java_alarm_scheduler`

**Risco / mitigações:**

| Risco | Severidade | Mitigação | Decisão |
|---|---|---|---|
| Audit insert silent fail bloqueia alarme hot path | 🔴 Alto | JS: try/catch wrap. Java: Executor separado + silent fail. Edge: try/catch + console.warn | **OK** — alarme nunca bloqueado |
| RLS muito restritivo bloqueia INSERT autenticado | 🟡 Médio | Policy `audit_log_user_insert` valida user_id = auth.uid() + EXISTS config.enabled | **OK** — testado seed lhenrique |
| Egress alto se +1 user habilitado | 🟡 Médio | Gate per-user no Edge via `Set<user_id>` pré-loaded — não habilitados zero insert | **OK** |
| Cron cleanup falhar → tabela cresce | 🟢 Baixo | 7d × 324 rows/dia × 1 user = 2300 rows. Manual cleanup acessível via Supabase SQL Editor | **OK** |
| Privacy concern (logs detalhados doses) | 🟢 Baixo | Apenas admin-only SELECT (RLS). User opt-in via config whitelist explícita | **OK** |
| dose-trigger-handler trigger DB falha em INSERT/UPDATE | 🟡 Médio | Edge Function async fire-and-forget pelo trigger. DB INSERT/UPDATE não bloqueia se Edge fail | **OK** |

**Validação device pré-merge:**

Ver [`Validar.md`](Validar.md) seções 220.x — checklist completo S25 Ultra:
- Instalar vc 58 + abrir app → SQL `SELECT * FROM medcontrol.alarm_audit_log WHERE user_id = (lhenrique uuid) ORDER BY created_at DESC LIMIT 10` retorna eventos
- Abrir admin `/alarm-audit` → eventos aparecem com timestamps próximos
- Filtros source/action/dose funcionam
- Modal detalhes mostra metadata jsonb completo
- Habilitar/desabilitar via `/alarm-audit-config` toggle reflete (próximo evento usuário não habilitado some)

**Não-escopo:**

- Realtime live updates admin page (manual refresh OK per user)
- Notif/alerta admin pra eventos suspeitos (próximo iteration)
- Export CSV histórico (futuro)
- Retention configurável (hardcode 7d agora)

---

### #211 — Storm rescheduleAll + window 168h + audit per-group inserts (HOTFIX v0.2.2.1)

- **Status:** ✅ Resolvido (release v0.2.2.1 vc 59)
- **Categoria:** 🐛 BUG / 🛠️ PERFORMANCE
- **Prioridade:** P1 (storm silencioso pré-existente, revelado pelo audit v0.2.2.0)
- **Origem:** Descoberto via `/alarm-audit` no admin.dosymed.app — 868 rows em 30min após install vc 58. Esperado ~10.

**Problema:**

Audit v0.2.2.0 imediato pós-deploy revelou padrão:
```
16:18:50-53 (BURST INICIAL — 3s):
  3 batch_start concorrentes, 418 scheduled rows, 4 batch_end
16:19:49 → batch_start + 10 scheduled + batch_end
16:20:49 → batch_start + 10 scheduled + batch_end
16:21:50 → ...
```

rescheduleAll JS rodando 1×/min recorrente após burst inicial. Audit revelou problema pré-existente (storm sempre existiu, era invisível).

**Root causes (3 simultâneos):**

1. **Storm 1/min** — App.jsx useEffect `[user, allDoses, allPatients, dosesLoaded, patientsLoaded, scheduleDoses]`. Algum dep flipa ref a cada 60s. Suspeita primária: realtime channel reconnect (watchdog 60s) → refetch `['doses']` → new data ref → useEffect re-fires. Investigação completa = item separado, throttle resolve sintoma.
2. **Window 168h** — `prefs.js SCHEDULE_WINDOW_MS = 168 * 3600 * 1000` mas comentário inline dizia "48h". Plan #209 era 48h. 168h × 14-30 doses/dia = ~100-200 doses/batch.
3. **Audit per-group inserts** — scheduler.js wire v0.2.2.0 chamava `logAuditEventsBatch(group.map(...))` per iteration. 10 grupos × 1 insert = 10 separate inserts/batch.

**Implementação:**

1. `prefs.js SCHEDULE_WINDOW_MS = 48 * 3600 * 1000` + comment atualizado (alinha daily-alarm-sync cron 5am + Worker 6h + dose-trigger real-time).

2. `scheduler.js` throttle pattern:
```js
const RESCHEDULE_THROTTLE_MS = 30_000
let _lastRunAt = 0
let _pendingTrailing = null
let _pendingArgs = null

export async function rescheduleAll(args = {}) {
  if (!isNative) return rescheduleAllWeb(args.doses, args.patients, args.prefsOverride)
  const now = Date.now()
  const elapsed = now - _lastRunAt
  if (elapsed < RESCHEDULE_THROTTLE_MS) {
    _pendingArgs = args
    if (!_pendingTrailing) {
      _pendingTrailing = setTimeout(() => {
        _pendingTrailing = null
        const a = _pendingArgs; _pendingArgs = null
        rescheduleAll(a)
      }, RESCHEDULE_THROTTLE_MS - elapsed)
    }
    return { throttled: true }
  }
  _lastRunAt = now
  return _rescheduleAllImpl(args)
}
```

Pattern: primeira execução roda imediato. Requests dentro janela 30s coalescem em single trailing run com last args. Garante updates real (dose confirm/skip/undo invoke scheduleDoses) NÃO são perdidas — apenas atrasadas até 30s.

3. `scheduler.js` audit accumulator:
```js
const auditAccumulator = []
auditAccumulator.push({ action: 'batch_start', metadata: {...} })
// ... per group: auditAccumulator.push(...)
auditAccumulator.push({ action: 'batch_end', metadata: {...} })
logAuditEventsBatch(auditAccumulator)  // single insert
```

Cobre 3 return paths: nothing_to_schedule (early return), error (LocalNotifications.schedule fail), normal completion.

4. DB GRANTS (descoberto durante debug):
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON medcontrol.alarm_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON medcontrol.alarm_audit_config TO service_role;
GRANT USAGE ON SCHEMA medcontrol TO authenticated, anon;
GRANT INSERT, SELECT ON medcontrol.alarm_audit_log TO authenticated;
GRANT SELECT ON medcontrol.alarm_audit_config TO authenticated;
```

5. Cleanup 868 storm rows: `DELETE FROM alarm_audit_log WHERE created_at < now() - interval '1 minute'`.

**Critério de aceitação:**

- ✅ Build verde + AAB vc 59 publicado Internal Testing
- ✅ DB grants aplicados via migrations grant_service_role_audit_tables + grant_authenticated_audit_tables
- 🧪 Device runtime vc 59: abrir app → /alarm-audit mostra 1 batch_start + N scheduled (≤30 com window 48h) + 1 batch_end em 1 row INSERT
- 🧪 30s após abrir app: tentativas adicionais de schedule são throttled (logcat `[Notif] reschedule throttled — trailing run em Xms`)
- 🧪 60min uso normal: ~5-15 batches no audit (não 60)

**Risco / mitigações:**

| Risco | Severidade | Mitigação | Decisão |
|---|---|---|---|
| Throttle perde update real-time (dose confirm não reagenda imediato) | 🟢 Baixo | Trailing run garante last args executados em ≤30s. Worker 6h + dose-trigger real-time + daily 5am cobrem | **OK** |
| Window 48h muito curta — dose >48h não agenda | 🟢 Baixo | Cron daily 5am BRT roda diário cobrindo próximas 48h. Worker 6h reforço | **OK** |
| Storm root cause não identificado (só sintoma fixado via throttle) | 🟡 Médio | Item separado investigar useEffect deps + realtime watchdog. Throttle previne degradação enquanto isso | **Aceitável** |
| Audit batch grande (>200 rows) demora pra escrever | 🟢 Baixo | Postgres COPY/INSERT batch <100ms pra ~1000 rows. silent-fail wrap | **OK** |

**Não-escopo:**

- Investigar root cause storm (App.jsx useEffect deps + realtime watchdog) — item separado #212
- Telemetria storm detection — alerta admin se rows/min > threshold

---

### #212 — Storm rescheduleAll root cause (watchdog + signature guard) — v0.2.2.2

- **Status:** ✅ Resolvido (release v0.2.2.2 vc 60)
- **Categoria:** 🐛 BUG / 🛠️ PERFORMANCE
- **Prioridade:** P1
- **Origem:** Pós-deploy v0.2.2.1 (hotfix throttle), audit polling 11min confirmou storm continuou em 1.36 batches/min — throttle reduziu impacto mas não eliminou gatilho.

**Problema:**

Audit revelou cadência 60s estável entre batches + outliers:
```
17:01:29 → 59 (initial)
17:01:58 → 10 (+29s trailing run throttle)
17:02:28 → 10 (+30s)
17:03:28 → 10 (+60s)
... 15 batches em 11min
```

Esperado pelo plan #209: ~10 rescheduleAll/dia (cron 5h + Worker 6h + interações). Realidade: ~2000/dia. **200× excesso.**

**Egress estimado:**

| Componente | Egress/dia/device |
|---|---|
| `useDoses` refetch (14 dias window) | ~17 MB |
| `dose_alarms_scheduled` upsert | ~5-10 MB |
| Realtime channel reconnect | ~7 MB |
| `alarm_audit_log` INSERT | ~1 MB |
| **Total** | **~30-40 MB/dia/device** |

Escalado pra 100 testers Closed = 3-4 GB/dia. Plano Pro 250GB/mês = 12% só desse loop.

**Root cause (cadeia 60s):**

1. `useRealtime.js` mantém WebSocket canal ['realtime:userId:gen:ts']
2. `WATCHDOG_INTERVAL_MS = 60_000` — vigia roda a cada 60s checando channel.state
3. Em Android Doze + token JWT refresh window, state muda pra `!== 'joined'` ocasionalmente
4. Watchdog dispara `unsubscribe + subscribe + refetchQueries({queryKey: ['doses'], type: 'active'})`
5. Refetch retorna fresh data — mesmo conteúdo, mas array ref novo (timestamps microsec diferem)
6. App.jsx useEffect dep `allDoses` detecta "mudou" → `scheduleDoses(allDoses, {patients})` → `rescheduleAll`
7. Throttle v0.2.2.1 prevent concurrent execution mas trailing run sempre dispara → storm 60s+30s cycles

**Implementação:**

1. **`useRealtime.js`** — `WATCHDOG_INTERVAL_MS` 60000 → 300000 (5min). Reduz frequência reconnect cycle 5×. Status callbacks (CLOSED/CHANNEL_ERROR/TIMED_OUT) continuam funcionando — watchdog é safety net only.

2. **`App.jsx`** — Signature guard via `useMemo`:
```js
const dosesSignature = useMemo(() => {
  if (!dosesLoaded) return ''
  return (allDoses || [])
    .map(d => `${d.id}:${d.status}:${d.scheduledAt}`)
    .sort()
    .join('|')
}, [allDoses, dosesLoaded])

const patientsSignature = useMemo(() => {
  if (!patientsLoaded) return ''
  return (allPatients || []).map(p => `${p.id}:${p.name || ''}`).sort().join('|')
}, [allPatients, patientsLoaded])

useEffect(() => {
  if (!user || !dosesLoaded || !patientsLoaded) return
  scheduleDoses(allDoses, { patients: allPatients })
}, [user, dosesSignature, patientsSignature, dosesLoaded, patientsLoaded, scheduleDoses])
```

Refetch retorna mesma signature → useEffect não re-fires. Mudança real (status pending→done, scheduledAt change, dose new) → signature flipa → reschedule.

**Critério de aceitação:**

- ✅ Build verde + AAB vc 60 publicado Internal Testing
- 🧪 Device runtime vc 60: app aberto 10min → /alarm-audit mostra ≤2 batches (não 15)
- 🧪 60min uso normal: ≤10 batches total (não ~80)
- 🧪 Egress Supabase Dashboard: queda ~95% useDoses queries/hora vs vc 59

**Risco / mitigações:**

| Risco | Severidade | Mitigação | Decisão |
|---|---|---|---|
| Watchdog 5min lento pra detectar silent fail (heartbeat parou mas status ok) | 🟡 Médio | Status callbacks supabase-js cobrem 95%+ casos. Watchdog era safety net pra raros. Reconnect manual via app resume listener (App.jsx) cobre cold path | **Aceitável** |
| Signature pode não detectar mudança sutil (ex: dose updatedAt only) | 🟢 Baixo | scheduleDoses não usa updatedAt — só status/scheduledAt. Outros campos irrelevantes pra scheduling | **OK** |
| useMemo deps allDoses ainda flipa ref a cada refetch | 🟢 Baixo | useMemo recalcula signature, mas saída string identical → dep não muda → useEffect não re-fires | **OK** |

**Validação device pós-merge:**

Ver `Validar.md` seção `#212.v222.x`:
- vc 60 instalado → /alarm-audit últimos 10min ≤2 batches
- Marcar dose como tomada → 1 batch_start aparece (signature flipou)
- Idle 30min → 0-1 batches (cron 5am + Worker 6h apenas)

**Não-escopo:**

- Root cause raiz pq channel.state !== 'joined' frequente em S25 Ultra (Android Doze suspending WS, token refresh churn) — investigação Capacitor.Network listener vs supabase-js auth events.

---

### #213 — Storm REAL root cause: Dashboard.jsx setInterval setTick → caller redundante (v0.2.2.3)

- **Status:** ✅ Resolvido (release v0.2.2.3 vc 61)
- **Categoria:** 🐛 BUG / 🛠️ PERFORMANCE
- **Prioridade:** P1
- **Origem:** Logcat Dosy-Dev (~6min monitoramento) pós-deploy v0.2.2.2 — signature guard App.jsx funcionou (initial só), mas storm 60s continuou.

**Problema:**

Auditoria logcat capturou pattern exato:
```
15:33:29 rescheduleAll START dosesCount=30 patientsCount=3
15:33:29 CriticalAlarm.cancelAll
15:33:29 AlarmScheduler scheduled id=386571675 count=2
15:33:30 AlarmScheduler scheduled id=1912498711 count=7
15:33:29 rescheduleAll END alarmsScheduled=9 groupsCount=2

15:34:31 rescheduleAll START dosesCount=30 (+62s — idêntico!)
... loop infinito
```

**Conteúdo IDÊNTICO entre cycles** — mesmos IDs, mesmas timestamps `at=...`. Cancel + reagenda mesmos alarmes 1×/min = waste puro.

**Root cause real:**

`src/pages/Dashboard.jsx:99`:
```js
const t = setInterval(() => setTick(Math.floor(Date.now() / 60000)), 60000)
```

Plus `Dashboard.jsx:222-224`:
```js
const { scheduleDoses } = usePushNotifications()
useEffect(() => {
  scheduleDoses(todayDoses, { patients })
}, [todayDoses, patients, scheduleDoses])
```

Cadeia 60s:
1. `setInterval 60s` → `setTick(novo número)`
2. `tick` muda → `todayDoses = useMemo(... [doses, tick])` recalcula → new array ref
3. `useEffect([todayDoses, ...])` re-fires → `scheduleDoses(todayDoses, {patients})`
4. `rescheduleAll` → `cancelAll` + reagenda 9 alarmes (mesmo conteúdo)
5. 60s loop reinicia

**Por que signature guard App.jsx não pegou?**

App.jsx signature guard funciona no App.jsx useEffect próprio. Mas Dashboard.jsx tem seu próprio useEffect chamando scheduleDoses diretamente — bypassa App.jsx completamente. 2 callers competindo.

**Implementação:**

Remove Dashboard.jsx:222-224 completamente. App.jsx top-level signature guard cobre full window 48h. Daily summary é agendado dentro do mesmo rescheduleAll do App.jsx (sem perda). Plus remove import `usePushNotifications` Dashboard.jsx:24 desnecessário.

```diff
-  // Schedule push notifications for upcoming doses + daily summary.
-  // SEMPRE roda (mesmo sem doses hoje) — daily summary é independente e precisa
-  // ser agendado mesmo quando não há doses programadas.
-  const { scheduleDoses } = usePushNotifications()
-  useEffect(() => {
-    scheduleDoses(todayDoses, { patients })
-  }, [todayDoses, patients, scheduleDoses])
+  // v0.2.2.3 (#213) — REMOVIDO scheduleDoses caller. App.jsx top-level useEffect
+  // (com signature guard v0.2.2.2) já agenda full window 48h. Dashboard caller
+  // era vestígio pré-#198 + executava a cada 60s via setInterval setTick:99...
```

**Critério de aceitação:**

- ✅ Build verde + AAB vc 61 publicado Internal Testing
- 🧪 Device runtime vc 61: app aberto 10min → /alarm-audit ≤2 batches
- 🧪 Logcat zero `rescheduleAll dosesCount=30` (Dashboard caller eliminado)
- 🧪 60min uso normal: ≤5 batches total (era 60)
- 🧪 Daily summary notif ainda agendado (verificar metadata.localNotifs ≥1)

**Risco / mitigações:**

| Risco | Severidade | Mitigação | Decisão |
|---|---|---|---|
| Dashboard caller cobria edge case que App.jsx não cobre | 🟢 Baixo | App.jsx top-level com `alarmWindow -1d/+14d` é superset do Dashboard `todayDoses`. scheduler.js filtra 48h. Daily summary agendado em rescheduleAll mesmo | **OK** |
| Dose criada hoje após app open não agenda alarme | 🟢 Baixo | dose-trigger-handler Edge dispara FCM real-time em INSERT pending. mutationRegistry chama scheduleDoses ao confirm/skip/undo | **OK** |
| Push tray daily summary perdido | 🟢 Baixo | scheduler.js linhas 277-307 agendam DAILY_SUMMARY_NOTIF dentro do rescheduleAll. Roda no App.jsx initial | **OK** |

**Egress estimado pós-fix:**

| Componente | Antes (v0.2.2.2) | Após (v0.2.2.3) |
|---|---|---|
| rescheduleAll/dia | ~1440 | ~5 |
| useDoses refetch/dia | ~1440 | ~24 (watchdog 5min + interações) |
| dose_alarms_scheduled upsert/dia | ~13000 | ~50 |
| **Total egress MB/dia/device** | **~30-40** | **~1-2** |

**95% redução estimada.** Plano Supabase Pro 250GB/mês recupera margem pra Closed Testing 100 users.





---

### #214 — Cleanup dose_alarms_scheduled tabela órfã (v0.2.2.4)

- **Status:** ✅ Resolvido (release v0.2.2.4 vc 62)
- **Categoria:** 🧹 CLEANUP / 🛠️ PERFORMANCE
- **Prioridade:** P2
- **Origem:** Auditoria pós-#213 identificou tabela órfã ainda recebendo ~13k writes/dia sem consumers.

**Problema:**

Tabela `medcontrol.dose_alarms_scheduled` criada em #083.7 (v0.1.7.2) pra `notify-doses-1min` cron skipar push se alarme local já agendado. Plus `schedule-alarms-fcm-6h` cron consultava também. Ambos crons foram **UNSCHEDULED em #209** (v0.2.1.9) substituídos por `daily-alarm-sync-5am` + `dose-trigger-handler` real-time.

**Tabela ficou:**
- 2 writers ativos: JS `scheduler.js` upsert + Java `DosyMessagingService.reportAlarmScheduled()` POST
- **0 readers** (consumers removidos #209)
- ~13k upserts/dia/device storming pré-fix #213, ~50/dia pós-fix

`alarm_audit_log` v0.2.2.0 substitui completamente rastreio.

**Implementação:**

1. **`src/services/notifications/scheduler.js`:**
   - Remove bloco upsert linhas 204-221 (`supabase.from('dose_alarms_scheduled').upsert(...)`)
   - Remove imports unused: `supabase`, `hasSupabase`, `getDeviceId`

2. **`DosyMessagingService.java`:**
   - Remove método static `reportAlarmScheduled()` (~50 linhas)
   - Remove call sites em `handleScheduleAlarms` (loop chamada)
   - Remove imports HTTP unused: `BufferedReader`, `IOException`, `InputStreamReader`, `OutputStream`, `HttpURLConnection`, `URL`, `StandardCharsets`

3. **Migration `drop_dose_alarms_scheduled_v0_2_2_4`:**
   ```sql
   DROP TABLE IF EXISTS medcontrol.dose_alarms_scheduled CASCADE;
   ```

**Critério de aceitação:**

- ✅ Build verde + AAB vc 62 pendente
- ✅ Migration aplicada — SQL `EXISTS` retorna false pra tabela
- 🧪 Device runtime vc 62: logcat ZERO menções `dose_alarms_scheduled` OR `reportAlarmScheduled`
- 🧪 audit log continua funcionando normal

**Risco / mitigações:**

| Risco | Severidade | Mitigação | Decisão |
|---|---|---|---|
| Algum Edge function legado consulta tabela | 🟢 Baixo | grep código + Edge functions confirmou zero consumers ativos #209+ | **OK** |
| Script admin/SQL ad-hoc usava | 🟢 Baixo | RLS policy só permitia user read próprio + service_role. Sem dependências externas | **OK** |
| Feature "cron pula push se alarme local existe" precisaria volta | 🟢 Baixo | Arquitetura #209 cron 5am + trigger real-time torna feature desnecessária | **OK** |

**Egress save:** ~5-10 MB/dia/device.

**Não-escopo:**

- Cleanup outras tabelas/colunas órfãs (item separado se aplicável)

---

## NOVOS items descobertos via auditoria 2026-05-13 Alarme + Push

> Origem: `contexto/auditoria/2026-05-13-alarme-push-auditoria.md` (varredura ponta-a-ponta 11 arquivos Java + JS notifications + 6 Edge Functions + 22 migrations + Manifest + capacitor.config + sw.js). 19 bugs/riscos identificados P0→P3 + análise impacto egress + storm risk.

### #215 — Refactor scheduler unificado + push backup co-agendado (cobre DnD/criticalAlarm-off)

- **Categoria:** 🔄 TURNAROUND
- **Prioridade:** 🔴 P0
- **Origem:** [Auditoria 2026-05-13 B-01 + B-02 + B-09 + arquitetura duplicada cross-source]
- **Esforço:** 10-14h (refactor + testes E2E + validação device S25 Ultra + edge cases limite+cuidador)
- **Dependências:** #220 (alinhar hash JS↔Java antes pra IDs determinísticos cross-source funcionarem)
- **Release alvo:** `release/v0.2.3.0` (bump versão app — gera AAB novo)

**Decisões consolidadas com user 2026-05-13 (pós-revisão plano 3 cenários):**

| # | Decisão | Comportamento final |
|---|---|---|
| 2 | Margem boot recovery alarme atrasado | **2h** (era proposto 1h em #224 — alinhar pra 2h também) |
| 3 | Push silencioso dentro janela DnD | **Vibração leve** (não 100% silencioso) — canal `dosy_tray` com `vibration: true` + pattern curto (200ms) + sound null |
| 4 | User desliga toggle Alarme Crítico no Ajustes | **Cancela todos alarmes nativos agendados + troca por push** (próximos 48h passam a ser cobertos só por push) — já é o comportamento do helper unificado, só garantir `useUserPrefs` mutation dispara `rescheduleAll` ao mudar flag |
| 6 | Cuidador compartilhando paciente | **SEMPRE alarme cheio prioridade** + respeita DnD/criticalAlarm-off do cuidador. Se cuidador tem DnD 22h-7h ativo e dose paciente 23h → cuidador recebe só push silencioso vibração leve; paciente recebe baseado nas configs próprias. Cenário 02 envia FCM data pra TODOS aparelhos (paciente + cuidadores) — cada aparelho aplica próprias prefs ao decidir branch |
| 8 | Limite Android ~500 alarmes/notificações por app | **Janela dinâmica:** se total agendado (alarmes + pushes) projetado > 400 itens (margem 100 do limit) → janela cai pra **24h** apenas. Se < 400 → mantém **48h** normal. Recalcula a cada execução Cenário 01/03. User com 50+ doses/dia (raro) automaticamente fica em 24h horizon. Inclui telemetria `alarm_horizon_decision: 24h\|48h` em metadata audit log |
| 9 | Mudança horário tratamento via update_treatment_schedule | **Aceita proposta:** servidor regenera doses pendentes; Cenário 02 dispara FCM `cancel_alarms` (#221) pra cada dose alterada + FCM `schedule_alarms` pras novas |
| 10 | Cuidador opt-in receber alarmes de paciente compartilhado | **Sempre recebe** (por enquanto). Toggle "Quero receber lembretes das doses dos pacientes compartilhados: Sim/Não" parqueado pra release futura. Helper unificado fica preparado pra ler future flag `prefs.receiveShared` (default true) sem refactor adicional |
| 11 | Admin panel `admin.dosymed.app/alarm-audit` + `/alarm-audit-config` | **Mantém funcional** — refactor preserva populamento de `medcontrol.alarm_audit_log` em **TODOS 4 paths** (Cenário 01 source `js_scheduler`, Cenário 02 sources `js_scheduler` + `java_fcm_received` + `edge_trigger_handler`, Cenário 03 sources `java_worker` + `edge_daily_sync`). Cada insert inclui metadata `branch: alarm_plus_push\|push_dnd\|push_critical_off\|skipped` + `horizon: 24h\|48h` + `reason` (debug) |

**Problema (3 falhas em 1 release):**

**Problema (3 falhas em 1 release):**

1. **B-01 — Janela DnD = zona silêncio total.** `dose-trigger-handler:134-138` skip FCM data se `inDndWindow=true`. `daily-alarm-sync:121` filtra `dosesOutsideDnd`. Cron `notify-doses-1min` (que era o caminho push tray fallback DnD) UNSCHEDULED em #209. Resultado: dose dentro DnD = ZERO alerta (era pra ser "silenciar alarme estilo despertador" mas hoje silencia tudo).
2. **B-02 — `criticalAlarm=false` + app background = silêncio total.** Mesma raiz: 3 caminhos skipam (dose-trigger, daily-alarm-sync) + cron 1min unscheduled. User que escolheu "só push tray, sem alarme despertador" não recebe nada se app fechado.
3. **B-09 — `dose-trigger-handler` `SIX_HOURS_MS` desalinhado com `daily-alarm-sync` 48h horizon.** Dose criada entre 6h-48h futuro fica sem FCM realtime; espera próximo cron 5am BRT (delay até 24h).
4. **Bonus — lógica duplicada cross-source.** Filtros + grouping + audit espalhados em `notifications/scheduler.js` + `DosyMessagingService.handleScheduleAlarms` + `DoseSyncWorker.scheduleDoses` + `daily-alarm-sync` Edge. Drift silencioso (B-07 hash já desalinhou JS↔Java).

**Solução (fluxo user-aligned 2026-05-13):**

### Cenário 01 — App abre / atualiza

Gatilhos: `App.jsx` top-level useEffect (signature guard pós #212/#213) ao mount, ao receber update de cache, ao mudança de toggle prefs (Alarme Crítico ON/OFF, DnD enable/disable, DnD horário).

```pseudo
function cenario01_appOpen(ctx):
  # 1. Sync banco → cache local
  doses = fetchDoses(now, now + windowHours)  # window decidido em scheduleHorizon() ↓
  prefs = loadPrefs()

  # 2. Cancela TUDO agendado pra evitar drift
  cancelAllAlarms()
  cancelAllLocalNotifications()

  # 3. Determina janela dinâmica (decisão 8)
  totalItemsProjected = doses.filter(d => criticalOn && !inDnd(d, prefs)).length * 2  # alarm + push
                     + doses.filter(d => !criticalOn || inDnd(d, prefs)).length        # só push
  horizonHours = (totalItemsProjected > 400) ? 24 : 48
  doses = doses.filter(d => d.scheduledAt <= now + horizonHours)

  # 4. Pra cada dose, chama helper unificado
  for dose in doses:
    branch = scheduleDoseAlarm(ctx, dose, prefs)
    auditLog.insert({
      source: 'js_scheduler',
      action: branch == 'skipped' ? 'skipped' : 'scheduled',
      dose_id: dose.id,
      scheduled_at: dose.scheduledAt,
      metadata: { branch, horizon: horizonHours, source_scenario: 'app_open' }
    })
```

### Cenário 02 — Mudança status dose (Tomada / Pulada / Desfazer)

Gatilho: user clica "Ciente" / "Pular" / "Desfazer" no DoseCard, DoseModal, AlarmActivity, AlarmActionReceiver.

```pseudo
function cenario02_doseStatusChange(doseId, newStatus):
  # 1. RPC server-side (confirm_dose / skip_dose / undo_dose)
  rpc.callServerMutation(doseId, newStatus)

  # 2. Local: cancela ou reagenda APENAS essa dose
  if newStatus == 'pending':  # undo
    dose = fetchDose(doseId)
    branch = scheduleDoseAlarm(ctx, dose, loadPrefs())
    auditLog.insert({ source: 'js_scheduler', action: 'scheduled', metadata: { branch, source_scenario: 'undo_dose' }})
  else:  # done/skipped
    cancelAlarm(doseId)
    cancelLocalNotification(doseId + BACKUP_OFFSET)
    auditLog.insert({ source: 'js_scheduler', action: 'cancelled', metadata: { source_scenario: 'mark_dose' }})

  # 3. Server-side trigger dose_change_notify → Edge dose-trigger-handler envia FCM
  #    para TODOS aparelhos (paciente + cuidadores) com action=schedule_alarms OU cancel_alarms
  #    (depende newStatus). Cada aparelho recebe via DosyMessagingService e chama
  #    handler que delega ao helper unificado Java (mesma lógica scheduleDoseAlarm).
  #    Aparelho aplica PRÓPRIAS prefs (decisão 6 + 10) — cuidador com DnD próprio recebe só push silencioso.
```

### Cenário 03 — Manutenção a cada 6h (app fechado) + cron diário 5am BRT

**Cenário 03a — WorkManager 6h (Android background):**

```pseudo
function cenario03a_workManager6h():
  # Android acorda app brevemente (~10s budget)
  doses = fetchDosesViaREST(now, now + horizonHours)  # auth via cached accessToken
  prefs = loadPrefsFromSharedPreferences()

  cancelAllAlarms()  # opcional: só doses cujo conteúdo mudou (otimização futura)
  for dose in doses:
    branch = scheduleDoseAlarmJava(ctx, dose, prefs)  # MESMA lógica do helper JS, paridade
    auditLog.insertViaREST({
      source: 'java_worker',
      action: branch == 'skipped' ? 'skipped' : 'scheduled',
      metadata: { branch, horizon: horizonHours, source_scenario: 'workmanager_6h' }
    })
```

**Cenário 03b — Cron daily 5am BRT (servidor → todos devices):**

```pseudo
function cenario03b_dailyAlarmSync():
  # Edge function rodando 5am BRT diário
  for user in pushSubscriptions:
    prefs = getUserNotifPrefs(user.id)
    doses = getDosesNext48h(user.id)
    horizonHours = (projectedItems(doses, prefs) > 400) ? 24 : 48
    doses = doses.filter(d => d.scheduledAt <= now + horizonHours)

    # Particionar em chunks 30 doses (#225 chunking 4KB FCM limit)
    chunks = chunkBy(doses, 30)
    for chunk in chunks:
      for device in user.devices:
        sendFcmData(device.deviceToken, {
          action: 'schedule_alarms',
          doses: JSON.stringify(chunk),
          horizon: horizonHours
        })

    auditLog.insertBatch(doses.map(d => ({
      source: 'edge_daily_sync',
      action: 'fcm_sent',
      dose_id: d.id,
      metadata: { horizon: horizonHours, source_scenario: 'cron_5am' }
    })))
```

Device recebe FCM → `DosyMessagingService.onMessageReceived(action=schedule_alarms)` → delega ao helper unificado Java que aplica prefs locais + decide branch.

### Helper unificado `scheduleDoseAlarm(ctx, dose, prefs)` — 1 lugar 4 paths

```pseudo
function scheduleDoseAlarm(ctx, dose, prefs):
  groupId = idFromString(dose.id)  # hash alinhado JS↔Java (#220)
  backupId = groupId + BACKUP_OFFSET

  # Branch A — Alarme Crítico OFF → só push tray
  if !prefs.criticalAlarm:
    LocalNotifications.schedule({
      id: groupId,
      channel: 'dosy_tray',
      sound: 'default',
      schedule: { at: dose.scheduledAt, allowWhileIdle: true }
    })
    return 'push_critical_off'

  # Branch B — DnD ON e dose em janela → só push tray COM VIBRAÇÃO LEVE (decisão 3)
  if inDndWindow(dose.scheduledAt, prefs):
    LocalNotifications.schedule({
      id: groupId,
      channel: 'dosy_tray',  # canal com vibration:true + pattern curto 200ms + sound null
      schedule: { at: dose.scheduledAt, allowWhileIdle: true }
    })
    return 'push_dnd'

  # Branch C — Caso normal → alarme nativo + push backup co-agendado
  AlarmScheduler.scheduleDose(ctx, groupId, dose.scheduledAt, [dose])  # AlarmManager.setAlarmClock
  LocalNotifications.schedule({
    id: backupId,
    channel: 'dosy_tray',
    sound: 'default',
    schedule: { at: dose.scheduledAt, allowWhileIdle: true }
  })
  return 'alarm_plus_push'
```

**Coordenação alarme + push backup (decisão antiga mantida):**

- `AlarmReceiver.onReceive` (alarme nativo disparou OK): chamar `NotificationManagerCompat.cancel(backupId)` ANTES de start AlarmService → anti-duplicate (user não vê alarme + push vibrando ao mesmo tempo).
- Se OEM mata alarme nativo (Doze profundo Samsung One UI 7, Xiaomi MIUI), LocalNotification backup dispara como fallback visual no horário exato. Tray com som default + vibração — user vê notif + sente vibração mesmo sem fullscreen.

**Janela dinâmica (decisão 8):**

```pseudo
function computeHorizon(doses, prefs):
  # Estima quantos itens vão pro AlarmManager + LocalNotifications storage
  projectedItems = 0
  for dose in doses:
    if !prefs.criticalAlarm or inDndWindow(dose.scheduledAt, prefs):
      projectedItems += 1  # só push
    else:
      projectedItems += 2  # alarm + push backup

  # Android limit ~500 por app. Margem 100 → threshold 400.
  return projectedItems > 400 ? 24 : 48
```

Edge case: user com 50 doses/dia × 48h = 100 doses × 2 itens = 200. Long da limit. Janela 48h mantida.
Edge case extremo: user com 100 doses/dia (cuidador profissional 5+ residências modo futuro #185) × 48h = 200 doses × 2 = 400 itens. Próximo refactor pra 24h. Telemetria PostHog `alarm_horizon_24h` event futuro pra identificar quem cai nessa categoria.

**Audit log mantém admin `/alarm-audit` funcional (decisão 11):**

Todos 4 paths (JS scheduler / Java worker / Java FCM / Edge daily-sync + Edge trigger-handler) inserem em `medcontrol.alarm_audit_log` quando user está em `alarm_audit_config.enabled=true` whitelist. Metadata uniformizada inclui:

```json
{
  "branch": "alarm_plus_push | push_dnd | push_critical_off | skipped",
  "horizon": 24 | 48,
  "source_scenario": "app_open | mark_dose | undo_dose | workmanager_6h | cron_5am | fcm_trigger_handler",
  "groupId": 12345678,
  "criticalAlarmEnabled": true,
  "dndEnabled": false,
  "inDndWindow": false,
  "reason": "string (debug curto)"
}
```

Páginas admin `/alarm-audit` (filtros usuário/origem/ação/dose/período + modal detalhes) + `/alarm-audit-config` (toggle por email) continuam funcionando sem mudança — refactor apenas enriquece metadata.

**Auditoria egress + storm risk:**

| Aspecto | Impacto | Mitigação |
|---|---|---|
| Egress server-side | **Zero** (LocalNotification é local Android) | — |
| AlarmManager storm | Nenhum — throttle 30s + signature guard pós #211/#212 já cobre | — |
| LocalNotifications limit | Capacitor LocalNotifications aceita ~500 simultâneas. Janela 48h × 4 doses/dia × 2 (alarme+backup) = 384 itens, dentro limit | — |
| Cancel race alarme↔backup | AlarmReceiver pode falhar cancel se LocalNotification dispara primeiro (ms-level race) → user vê notif backup + alarme nativo simultâneos | Aceitável (vibração extra 1×/dia max) — alternativa: backup +60s delay |
| Drift cross-source | **Eliminado** — 1 helper único, todas caminhos passam mesmas filtros | — |

**Mudanças código:**

1. **Novo** `src/services/notifications/unifiedScheduler.js` (ou expandir `scheduler.js`):
   - Função `scheduleDoseAlarm(doses, prefs)` retorna `{ tray, tray_dnd, alarm_plus_backup }` arrays
   - Substituído por `rescheduleAll` chama unifiedScheduler internamente

2. **Java** `AlarmReceiver.java`:
   ```java
   @Override
   public void onReceive(Context context, Intent intent) {
     int alarmId = intent.getIntExtra("id", 0);
     // Anti-duplicate: cancela LocalNotification backup
     NotificationManagerCompat.from(context).cancel(alarmId + BACKUP_OFFSET);
     // ... resto fluxo atual (audit, startForegroundService, etc)
   }
   ```

3. **Edge `daily-alarm-sync`** + **`dose-trigger-handler`**: REMOVER skip DnD/criticalAlarm-off em payload constructor. Mandar TODAS doses 48h horizon (filtrar futuras + pending apenas). DosyMessagingService.handleScheduleAlarms recebe payload + delega ao helper Java unificado que decide alarme vs backup vs tray.

4. **Java** `DosyMessagingService` + `DoseSyncWorker` chamam novo helper `AlarmScheduler.scheduleDoseFromPayload(ctx, doseJson, prefs)` (lê prefs SharedPreferences pra decidir branch).

5. **`dose-trigger-handler`** `SIX_HOURS_MS` → `48 * 60 * 60 * 1000` (cobre B-09).

6. **`notifications/channels.js`** — confirmar `doses_v2` aceita sound default + `allowWhileIdle: true` no schedule (cobertura Doze).

**Critério aceitação (validação device S25 Ultra):**

- ✅ Build verde + AAB novo (vc 63+) gerado
- 🧪 **Cenário 01.A** criticalAlarm ON + DnD OFF + dose +5min via app foreground → alarme nativo full-screen toca + LocalNotification backup NÃO toca (cancelada por AlarmReceiver). audit log: `branch=alarm_plus_push source_scenario=app_open horizon=48`
- 🧪 **Cenário 01.B** criticalAlarm ON + DnD 22:00-07:00 + dose 23:30 → LocalNotification tray COM vibração leve (200ms) dispara, sem fullscreen, sem som — alarme nativo NÃO agendado. audit log: `branch=push_dnd horizon=48`
- 🧪 **Cenário 01.C** criticalAlarm OFF + dose +5min → LocalNotification tray dispara (sem fullscreen, com sound default) — alarme nativo NÃO agendado. audit log: `branch=push_critical_off horizon=48`
- 🧪 **Cenário 01.D** Toggle Alarme Crítico ON → OFF em Ajustes → todos alarmes nativos pendentes cancelados imediatamente + recadastrados como push. SQL `SELECT count(*) FROM alarm_audit_log WHERE source_scenario='toggle_critical_off'` > 0
- 🧪 **Cenário 02.A** dose +30min agendada → user marca Tomada → alarme + push backup cancelados em <2s local + outros aparelhos cancelam em <5s via FCM. audit log: 2 entries (`action=cancelled` source=`js_scheduler` + source=`java_fcm_received` outro device)
- 🧪 **Cenário 02.B** dose Tomada → user Desfazer → alarme + push reagendados. audit log: `branch=alarm_plus_push source_scenario=undo_dose`
- 🧪 **Cenário 02.C** cuidador compartilha paciente da mãe → mãe e cuidador têm app instalado → dose mãe 8h → ambos recebem alarme cheio 8h em paralelo (decisão 6). Cuidador marca Tomada → alarme da mãe cancela <5s
- 🧪 **Cenário 02.D** cuidador com DnD próprio 22-7h + dose paciente compartilhado 23h → cuidador recebe SÓ push silencioso vibração leve; paciente recebe baseado nas configs próprias. audit log: `branch=push_dnd` no aparelho cuidador
- 🧪 **Cenário 03.A** Force-stop app + WorkManager dispara 6h depois → device acorda <10s + cancelAlarmes + reagenda + dorme. audit log: `source=java_worker source_scenario=workmanager_6h`
- 🧪 **Cenário 03.B** Cron 5am BRT dispara → device recebe FCM data → DosyMessagingService agenda. audit log: `source=edge_daily_sync source_scenario=cron_5am` + `source=java_fcm_received source_scenario=fcm_schedule_alarms`
- 🧪 **Cenário 03.C** Samsung One UI 7 SEM battery whitelist + dose +30min app fechado → OEM pode matar AlarmManager; LocalNotification backup dispara como fallback ~30min depois (sem fullscreen mas COM vibração + som). User vê notif na barra
- 🧪 **Boot recovery** device desligado pós-dose 8h → boot 9h30 → BootReceiver detecta `(now - triggerAt) < 2h` (decisão 2 — 2h margem) → dispara alarme imediato com flag `lateRecovery=true`. AlarmActivity mostra badge "Atrasada — celular estava desligado"
- 🧪 **Limite dinâmico** seed test user com 200 doses/dia × 2 dias = 400 doses × 2 itens = 800 (acima limit). Helper compute horizon = 24h (decisão 8). audit log: `horizon=24` registrado
- 🧪 **Audit consistência** SQL `SELECT count(*) FROM alarm_audit_log WHERE source IN ('js_scheduler','java_worker','java_fcm_received','edge_daily_sync','edge_trigger_handler') AND created_at > now() - interval '1 day' GROUP BY source` — todos 5 sources com entries
- 🧪 **Admin panel** `admin.dosymed.app/alarm-audit` carrega + filtros funcionam + modal detalhes mostra metadata `branch + horizon + source_scenario` legível

**Risco / mitigações:**

| Risco | Severidade | Mitigação | Decisão |
|---|---|---|---|
| AlarmReceiver falha cancel backup → user vê notif duplicada | 🟡 Médio | Adicionar delay 60s ao backup (`scheduleAt + 60s`) → janela cancel maior | Aceitável — melhor receber 2× que perder dose |
| LocalNotifications 500 items limit estourado | 🟢 Baixo | Janela 48h × 4 doses/dia × 2 = 384 < 500. Edge case 50+ doses/dia raro | Documentar limit + chunking se atingir |
| OEM mata LocalNotification também | 🟡 Médio | LocalNotification.schedule `allowWhileIdle: true` força exact mesmo Doze. Battery whitelist (#207) cobre maioria | Aceitável vs ZERO alert hoje |
| Refactor introduz regressão arquitetura crítica | 🟠 Alto | Validar TODOS cenários A-G device antes merge master + rollback plan via revert commit | OK — testes E2E obrigatórios |
| Storm de cancel/reschedule durante migration | 🟢 Baixo | Próximo rescheduleAll faz cancelAll + reschedule from scratch ✅ já existe. Migration transparente | OK |

**Egress save:** Zero (LocalNotification local) — fix elimina silêncio sem custo.

**Não-escopo (vai pra items separados):**

- B-04 (drift Edge daily-alarm-sync source) → #217
- B-05 (drift migrations locais) → #218
- B-07 (hash JS↔Java) → #220 (mas é blocker pra #215 — fazer antes ou junto)
- B-08 (cancel_alarms server-side) → #221

**Referências:**

- Auditoria seção §4.1 [B-01, B-02], §4.3 [B-09] — `contexto/auditoria/2026-05-13-alarme-push-auditoria.md`
- ROADMAP §6.7 #215

---

### #216 — Limpar Edge `notify-doses` ref tabela DROPADA `dose_alarms_scheduled`

- **Categoria:** 🐛 BUGS
- **Prioridade:** 🟠 P1
- **Origem:** [Auditoria 2026-05-13 B-03]
- **Esforço:** 30min
- **Dependências:** decisão #219 (manter Edge ou deletar)

**Problema:**

Edge `notify-doses` v19 ACTIVE (deployed) tem função `shouldSkipPushBecauseAlarmScheduled` em `supabase/functions/notify-doses/index.ts:187-203` que consulta `medcontrol.dose_alarms_scheduled`. Tabela foi DROPADA em migration `drop_dose_alarms_scheduled_v0_2_2_4` (#214). Se cron for re-scheduled OU alguém invocar Edge manualmente (verify_jwt:false) → resposta 500 com erro PostgreSQL `42P01 relation "medcontrol.dose_alarms_scheduled" does not exist`.

**Solução:**

```ts
// supabase/functions/notify-doses/index.ts

// REMOVER função inteira:
// async function shouldSkipPushBecauseAlarmScheduled(doseId, userId) { ... }

// REMOVER call site (linha ~287):
// if (criticalAlarmOn && await shouldSkipPushBecauseAlarmScheduled(dose.id, userId)) {
//   skipped++;
//   continue;
// }
```

**Critério aceitação:**

- ✅ `notify-doses/index.ts` sem referências `dose_alarms_scheduled`
- ✅ `supabase functions deploy notify-doses` OK
- 🧪 `curl -X POST .../functions/v1/notify-doses` retorna 200 (não 500)
- 🧪 Smoke test: cron re-scheduled 1 min com 1 user teste → push tray entregue OK

**Risco / mitigação:** zero — código órfão (cron unscheduled).

---

### #217 — Drift repo↔prod: commit source `daily-alarm-sync` + `_shared/auditLog.ts`

- **Categoria:** 🐛 BUGS
- **Prioridade:** 🟠 P1
- **Origem:** [Auditoria 2026-05-13 B-04]
- **Esforço:** 15min

**Problema:**

`supabase/functions/daily-alarm-sync/index.ts` (211 linhas) + `supabase/functions/_shared/auditLog.ts` (64 linhas) deployed v2 ACTIVE mas **ausentes do repo local**. Drift impede: code review via PR, gitleaks scan, eslint, busca grep, rollback via git revert. Próximo `supabase functions deploy daily-alarm-sync` daria push de pasta vazia → função perdida em prod.

**Solução:**

```bash
cd supabase/functions
supabase functions download daily-alarm-sync
# Confirmar arquivos criados:
# supabase/functions/daily-alarm-sync/index.ts
# supabase/functions/_shared/auditLog.ts (se download incluir)

# Plus garantir _shared/auditLog.ts (já que daily-alarm-sync importa):
# Se não veio no download, baixar via Supabase MCP get_edge_function ou copiar conteúdo capturado em auditoria (já temos source completo)

git add supabase/functions/daily-alarm-sync/ supabase/functions/_shared/auditLog.ts
git commit -m "chore(supabase): commit daily-alarm-sync + auditLog source local (drift fix #217)"
```

**Critério aceitação:**

- ✅ `supabase/functions/daily-alarm-sync/index.ts` existe local
- ✅ `supabase/functions/_shared/auditLog.ts` existe local
- ✅ gitleaks scan passa (sem secrets hardcoded)
- 🧪 `supabase functions deploy daily-alarm-sync` mantém mesmo SHA256 (`a35a205cc152ad029bf8ba7b7d445672df6b94eadabf1f41090b568b6ef1c9c9`)

**Risco / mitigação:** zero — apenas captura de estado atual.

---

### #218 — Drift migrations locais: restaurar 15 migrations faltantes

- **Categoria:** 🐛 BUGS
- **Prioridade:** 🟠 P1
- **Origem:** [Auditoria 2026-05-13 B-05]
- **Esforço:** 1-2h

**Problema:**

Filesystem `supabase/migrations/` tem 21 arquivos; DB tem 22 migrations aplicadas. Faltam locais (~15 migrations cobrindo trabalho v0.2.0.4 → v0.2.2.4):

```
20260504133842_add_patient_photo_thumb
20260504134036_replace_photo_thumb_with_photo_version
20260504163656_drop_signup_plus_promo_trigger
20260505133325_144_jwt_claim_tier_auth_hook
20260505133542_146_cron_audit_log_extend_continuous
20260507175920_admin_db_stats_function
20260507191028_add_tester_grade_to_subscriptions_v2
20260513121915_fix_update_treatment_schedule_timezone        # #209
20260513122009_data_fix_doses_timezone_v0_2_1_9_retry        # #209
20260513122442_cron_jobs_v0_2_1_9_daily_alarm_sync           # #209
20260513132459_create_alarm_audit_log_v0_2_2_0               # #210
20260513132512_cron_alarm_audit_cleanup_v0_2_2_0             # #210
20260513161435_grant_service_role_audit_tables               # #211
20260513161809_grant_authenticated_audit_tables              # #211
20260513191154_drop_dose_alarms_scheduled_v0_2_2_4           # #214
```

Impacto: rebuild local schema impossível, ADR history perdido, hot-swap dev/prod inviável.

**Solução:**

```bash
# Opção A: pull oficial
supabase db pull

# Opção B: por migration via Supabase MCP execute_sql + manual SQL extraction
# Pra cada migration faltante, consultar supabase_migrations.schema_migrations + recriar arquivo .sql
```

**Critério aceitação:**

- ✅ `ls supabase/migrations/ | wc -l` = 36 (21 atuais + 15 faltantes)
- ✅ `supabase migration list` mostra paridade local↔remote
- ✅ Diff `supabase db diff --schema medcontrol` vazio

**Risco / mitigação:** zero — apenas captura de estado.

---

### #219 — Deletar/proteger Edges órfãs `notify-doses` + `schedule-alarms-fcm`

- **Categoria:** 🐛 BUGS
- **Prioridade:** 🟠 P1
- **Origem:** [Auditoria 2026-05-13 B-06]
- **Esforço:** 15min
- **Dependências:** decisão escopo — se `notify-doses` for caminho fallback DnD (alternativa ao #215), manter; senão deletar

**Problema:**

Edges `notify-doses` v19 + `schedule-alarms-fcm` v15 ainda ACTIVE deployed mas crons unscheduled em #209. Ambas `verify_jwt:false` = públicas anônimas. Atacante pode invocar manualmente → consume quota Supabase + FCM (potencial abuse).

**Solução (2 opções, decisão user):**

**Opção A — Deletar** (se #215 implementado e cobre toda funcionalidade):
```bash
supabase functions delete notify-doses
supabase functions delete schedule-alarms-fcm
# Plus DELETE source local
rm -rf supabase/functions/notify-doses supabase/functions/schedule-alarms-fcm
git add supabase/functions/ && git commit -m "chore(supabase): remove edges órfãs notify-doses + schedule-alarms-fcm (#219)"
```

**Opção B — Proteger** (manter como fallback):
```bash
# Set verify_jwt: true em config.toml + redeploy
# Plus restringir uso via service_role only no cron
```

**Critério aceitação:**

- ✅ `supabase functions list` mostra estado decidido (deletadas OU ambas com `verify_jwt:true`)
- 🧪 `curl -X POST .../functions/v1/notify-doses` retorna 404 (deletado) OU 401 (auth required)

**Risco / mitigação:** Opção A irreversível mas backup via git. Opção B custo zero mas mantém código órfão (B-03 ainda precisa fix).

---

### #220 — Alinhar hash `AlarmScheduler.idFromString` Java com `% 2147483647`

- **Categoria:** 🐛 BUGS
- **Prioridade:** 🟠 P1
- **Origem:** [Auditoria 2026-05-13 B-07]
- **Esforço:** 30min
- **Dependências:** **bloqueador implícito de #215** — IDs determinísticos cross-source são premissa

**Problema:**

`src/services/notifications/prefs.js:41-48` `doseIdToNumber`:
```js
function doseIdToNumber(uuid) {
  let h = 0
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h) + uuid.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h) % 2147483647   // <-- mod aplicado
}
```

`android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/AlarmScheduler.java:156-166` `idFromString`:
```java
public static int idFromString(String s) {
  int h = 0;
  for (int i = 0; i < s.length(); i++) {
    h = ((h << 5) - h) + s.charAt(i);
    h |= 0;
  }
  return Math.abs(h);   // <-- SEM mod
}
```

Pra strings longas, `Math.abs(h)` pode produzir valor `> 2147483647 / 2` → JS mod faz wrap, Java não. IDs cross-source divergem → mesma dose pode ter alarme agendado **duas vezes** (JS path id_A, FCM/Worker path id_B). Probabilidade baixa (UUID v4 hashes raramente estouram) mas não-zero.

**Solução:**

```java
// AlarmScheduler.java:156-166
public static int idFromString(String s) {
  int h = 0;
  for (int i = 0; i < s.length(); i++) {
    h = ((h << 5) - h) + s.charAt(i);
    h |= 0;
  }
  return Math.abs(h) % 2147483647;  // alinha JS
}
```

**Critério aceitação:**

- ✅ Java alinhado com JS
- 🧪 Teste unitário cross-source: gerar 1000 UUID v4 random, calcular hash em ambos lados, asserir igualdade
- 🧪 Device runtime vc 63+: logcat audit `alarm_audit_log` mostra mesmo `groupId` em sources `js_scheduler` + `java_fcm_received` + `java_worker` pra mesma dose

**Risco / mitigação:**

| Risco | Severidade | Mitigação |
|---|---|---|
| Storm transitória durante migration | 🟢 Baixo | Alarmes agendados pré-fix com ID-Java old continuam agendados; novos com ID-novo. Próximo `rescheduleAll` faz `cancelAll` → reset. 1 storm ~5s |
| Alarmes duplicados durante janela 30s pós-deploy | 🟢 Baixo | AlarmReceiver dispara 2× alarme: 1× ID-old, 1× ID-novo. User vê 2× notif. Aceitável (raro) |

**Egress save:** Zero. Storm transitória pequena.

---

### #221 — Implementar `cancel_alarms` server-side em `dose-trigger-handler`

- **Categoria:** 🐛 BUGS
- **Prioridade:** 🟠 P1
- **Origem:** [Auditoria 2026-05-13 B-08]
- **Esforço:** 2-3h

**Problema:**

Java pronto: `DosyMessagingService.handleCancelAlarms` recebe `data.action=cancel_alarms` com `doseIds` CSV; `AlarmScheduler.cancelAlarm` cancela cada por groupId hash. Mas **nenhuma Edge envia esse FCM data hoje**:

- `dose-trigger-handler:100-101`: `type==='DELETE'` → response `'skipped: delete'`
- Trigger DB `dose_change_notify` filtra `WHEN NEW.status='pending' AND NEW.scheduledAt>now` → UPDATE com `status` mudando `pending→done/skipped/cancelled` NÃO firea trigger
- DELETE em doses (via deleteTreatment cascade) NÃO firea trigger

Impacto: user marca dose done/skipped/deletada → alarme local continua agendado → toca no horário com payload SharedPreferences cached (dose já não-pending). User vê alarme fantasma da dose que ele acabou de marcar.

**Mitigação atual:** próxima abertura do app, `rescheduleAll` cancela tudo + re-agenda só pending. Cobre user que abre app antes do alarme tocar.

**Solução completa:**

1. **Expandir trigger DB** pra firear também em DELETE + status change:
   ```sql
   -- supabase/migrations/YYYYMMDDHHmmss_expand_dose_change_notify_to_delete_and_status_change.sql
   DROP TRIGGER IF EXISTS dose_change_notify ON medcontrol.doses;
   CREATE TRIGGER dose_change_notify
     AFTER INSERT OR UPDATE OR DELETE
     ON medcontrol.doses
     FOR EACH ROW
     EXECUTE FUNCTION medcontrol.notify_dose_change();

   -- Atualizar função pra incluir OLD em DELETE
   CREATE OR REPLACE FUNCTION medcontrol.notify_dose_change()
   RETURNS TRIGGER AS $$
   DECLARE
     edge_url text := 'https://guefraaqbkcehofchnrc.supabase.co/functions/v1/dose-trigger-handler';
     payload jsonb;
   BEGIN
     payload := jsonb_build_object(
       'type', TG_OP,
       'table', TG_TABLE_NAME,
       'schema', TG_TABLE_SCHEMA,
       'record', CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,
       'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
     );
     PERFORM net.http_post(...);
     RETURN COALESCE(NEW, OLD);
   END;
   $$;
   ```

2. **Estender `dose-trigger-handler`** pra disparar `cancel_alarms`:
   ```ts
   if (type === 'DELETE') {
     await sendFcmData(deviceToken, {
       action: 'cancel_alarms',
       doseIds: record.id  // single ID
     })
     return
   }

   if (type === 'UPDATE' && old_record.status === 'pending' && record.status !== 'pending') {
     // pending → done/skipped/cancelled
     await sendFcmData(deviceToken, {
       action: 'cancel_alarms',
       doseIds: record.id
     })
     return
   }
   ```

**Auditoria egress:**

- +1 FCM data por mark/skip/undo dose. Hoje ~5 marks/day/user típico = 5 FCMs/dia/user. Trivial vs alarm-storm pré-#211 (1000+/dia).
- AlarmScheduler.cancelAlarm idempotente — cancelar ID inexistente = no-op.

**Critério aceitação:**

- ✅ Trigger DB firea em INSERT/UPDATE/DELETE
- ✅ `dose-trigger-handler` envia `cancel_alarms` em DELETE + UPDATE status change
- 🧪 Device runtime: marcar dose done → ~2s depois logcat `cancel_alarms: requested=1 cancelled=1`
- 🧪 Device runtime: deletar tratamento com 5 doses → 5 logcats `cancel_alarms` ou 1 com CSV
- 🧪 alarm_audit_log mostra `action=cancelled` source `java_fcm_received` com metadata `reason=fcm_cancel_action`

**Risco / mitigação:**

| Risco | Severidade | Mitigação |
|---|---|---|
| Storm FCM se cron extend_continuous_treatments insere 100s doses em batch + cada um trigger | 🟡 Médio | Trigger atual já filtra `WHEN status='pending' AND scheduledAt>now` — INSERT OK. DELETE só acontece em deleteTreatment cascade (raro user-driven). UPDATE status só em mark/skip (raro) | OK |
| Device offline durante mark → FCM perdido → alarme zombie ainda dispara | 🟡 Médio | Próximo `rescheduleAll` cancela. AlarmActivity ao abrir verifica status server e fecha se não-pending (defesa extra futuro) | Aceitável |

**Egress save:** Negativo (+5 FCM/dia/user) — mas elimina alarme zombie UX problem.

---

### #222 — Consolidar 3 channels Android (→ 2) + cleanup código morto AlarmActivity

- **Categoria:** ✨ MELHORIAS
- **Prioridade:** 🟡 P2
- **Origem:** [Auditoria 2026-05-13 B-10 + B-11]
- **Esforço:** 2-3h

**Problema (2 sub-bugs combinados):**

**B-10 — 3 channel IDs sobrepostos:**

| Channel ID | Criado por | Sound | Uso |
|---|---|---|---|
| `doses_v2` | LocalNotifications + AlarmActivity.postPersistentNotification (código morto) | default ringtone | Push tray + LocalNotifications |
| `doses_critical` | AlarmService.ensureChannel | **NULL** (MediaPlayer drives) | Notif FG service |
| `doses_critical_v2` | AlarmReceiver.ensureChannel | `dosy_alarm.mp3` USAGE_ALARM | Fallback fullScreenIntent |

Channel `doses_critical` (sound null) órfão no device users pré-#203. Sem cleanup migration.

**B-11 — Código morto AlarmActivity (~150 linhas):**

- `mediaPlayer`, `vibrator` campos instance (linhas 67-68) — nunca atribuídos
- `startAlarmSound` (685), `startVibration` (703) — funções nunca chamadas
- `postPersistentNotification` (774), `cancelPersistentNotification` (820) — postPersistent nunca chamada, cancel chamada mas no-op
- `CHANNEL_ID = "doses_v2"` (63), `NOTIF_ID_OFFSET = 100_000_000` (64) — usados só no morto

**Solução:**

1. **Consolidar pra 2 canais:**
   - `dosy_tray` (substitui `doses_v2`) — push tray + LocalNotifications + AlarmReceiver fallback (sound `dosy_alarm.mp3` USAGE_ALARM via channel)
   - `dosy_critical` (mantém ID `doses_critical` por compatibilidade) — AlarmService FG (sound null, MediaPlayer drives)

2. **Migration code em app boot:**
   ```java
   // MainActivity.onCreate ou app boot init
   NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
   if (nm.getNotificationChannel("doses_v2") != null) {
     nm.deleteNotificationChannel("doses_v2");
   }
   if (nm.getNotificationChannel("doses_critical_v2") != null) {
     nm.deleteNotificationChannel("doses_critical_v2");
   }
   ```

3. **Deletar código morto AlarmActivity:**
   - Linhas 63 (CHANNEL_ID), 64 (NOTIF_ID_OFFSET)
   - Linhas 67-68 (mediaPlayer, vibrator fields)
   - Função `startAlarmSound` (676-700)
   - Função `startVibration` (703-712)
   - Função `postPersistentNotification` (774-818)
   - Função `cancelPersistentNotification` (820-822)
   - Função `ensureChannel` (824-840)
   - Call site `cancelPersistentNotification()` em `handleAction` (linhas 736, 738, 742)

**Critério aceitação:**

- ✅ Build verde + AAB gerado
- ✅ AlarmActivity.java ~150 linhas removidas
- ✅ Channel migration code roda 1× per install fresh
- 🧪 Device runtime: `adb shell dumpsys notification` mostra 2 canais (dosy_tray, dosy_critical), sem doses_v2 OR doses_critical_v2
- 🧪 Settings > Apps > Dosy > Notifications mostra apenas 2 categorias canal

**Risco / mitigação:**

| Risco | Severidade | Mitigação |
|---|---|---|
| User config personalizada no canal antigo perdida | 🟢 Baixo | Canais antigos não tinham sound customizável por user. Defaults preservados | Aceitável |
| Channel sound migration race | 🟢 Baixo | Channel ID novo → sistema cria fresh com sound novo | OK |

**Egress save:** Zero. Apenas higiene.

---

### #223 — Deletar `usePushNotifications.js` deprecated re-export

- **Categoria:** ✨ MELHORIAS
- **Prioridade:** 🟢 P3
- **Origem:** [Auditoria 2026-05-13 B-12]
- **Esforço:** 5min

**Problema:**

`src/hooks/usePushNotifications.js` é arquivo único de 7 linhas:
```js
/**
 * @deprecated — Use `useNotifications` from '../services/notifications'.
 */
export { useNotifications as usePushNotifications } from '../services/notifications'
```

`App.jsx` ainda importa via `from '../hooks/usePushNotifications'`. Indireção desnecessária.

**Solução:**

```diff
-import { usePushNotifications } from './hooks/usePushNotifications'
+import { useNotifications } from './services/notifications'

// App.jsx renomear destructuring:
-const { subscribe, isNative, supported, scheduleDoses } = usePushNotifications()
+const { subscribe, isNative, supported, scheduleDoses } = useNotifications()

// Deletar arquivo:
// rm src/hooks/usePushNotifications.js
```

**Critério aceitação:**

- ✅ `src/hooks/usePushNotifications.js` removido
- ✅ Build verde
- ✅ `grep -r "usePushNotifications" src/` zero resultados (exceto comentários)

**Risco / mitigação:** zero.

---

### #224 — BootReceiver dispara alarme atrasado se <2h margem

- **Categoria:** 🐛 BUGS
- **Prioridade:** 🟡 P2
- **Origem:** [Auditoria 2026-05-13 B-13]
- **Esforço:** 30min

**Problema:**

`BootReceiver.java:41`:
```java
if (triggerAt <= now) continue; // alarme passou enquanto device estava off
```

Cenário: user dorme com phone off, boota às 9am, dose era 8am. BootReceiver pula esse alarme. Dose fica `pending` no DB sem alerta visual até user abrir app. Janela cega 0-Nh.

**Solução:**

```java
// BootReceiver.java — decisão user 2026-05-13: margem 2h (era 1h proposta)
private static final long LATE_ALARM_GRACE_MS = 2 * 60 * 60 * 1000L; // 2h

for (int i = 0; i < arr.length(); i++) {
  JSONObject obj = arr.getJSONObject(i);
  long triggerAt = obj.getLong("triggerAt");

  if (triggerAt <= now) {
    // Se passou recentemente (<1h), dispara imediato com label "atrasada"
    if ((now - triggerAt) < LATE_ALARM_GRACE_MS) {
      Intent alarmIntent = new Intent(ctx, AlarmReceiver.class);
      alarmIntent.putExtra("id", obj.getInt("id"));
      alarmIntent.putExtra("doses", obj.optJSONArray("doses").toString());
      alarmIntent.putExtra("lateRecovery", true);  // flag pra AlarmActivity mostrar "atrasada"
      ctx.sendBroadcast(alarmIntent);
      // não re-agenda (já passou)
    }
    continue;
  }

  // ... resto fluxo atual (re-agenda futuro)
}
```

**Critério aceitação:**

- ✅ Build verde
- 🧪 Device runtime: agendar dose +30min, force-stop app, reiniciar device com phone off > 5min, boot pós-horário dose → alarme dispara imediato com label "atrasada"
- 🧪 Edge case: dose >2h atrás → skip silencioso (fluxo atual mantido)
- 🧪 alarm_audit_log mostra `action=fired_received` source `java_boot_receiver` com metadata `lateRecovery=true`

**Risco / mitigação:**

| Risco | Severidade | Mitigação |
|---|---|---|
| Boot pós-horário trigger storm 10+ alarmes simultâneos | 🟢 Baixo | Limit GRACE_MS = 1h. Doses 4×/dia × 1h = max 1 atrasada. AlarmActivity já suporta multi-dose group | OK |
| User vê alarme "atrasada" sem entender contexto | 🟢 Baixo | UI flag `lateRecovery` adiciona badge "Atrasada — alarme não disparou no horário" | Documentar |

**Egress save:** Zero.

---

### #225 — FCM payload `daily-alarm-sync` chunking 4KB

- **Categoria:** ✨ MELHORIAS
- **Prioridade:** 🟡 P2
- **Origem:** [Auditoria 2026-05-13 B-14]
- **Esforço:** 1-2h

**Problema:**

`daily-alarm-sync/index.ts:145-149`:
```ts
const data = {
  action: 'schedule_alarms',
  doses: JSON.stringify(dosesPayload),  // <-- sem chunking
  syncedAt: now.toISOString(),
  horizonHours: String(HORIZON_HOURS)
}
```

FCM v1 data message limit é 4KB. Para user com 50+ doses/dia e 48h horizon (limit 1000 doses no fetch), payload pode passar 4KB → FCM responde `INVALID_ARGUMENT` → device não recebe agendamento.

**Solução:**

```ts
const CHUNK_SIZE = 30  // ~3KB safe margin

const chunks: any[][] = []
for (let i = 0; i < dosesPayload.length; i += CHUNK_SIZE) {
  chunks.push(dosesPayload.slice(i, i + CHUNK_SIZE))
}

for (const sub of userSubs) {
  const sendPromises = chunks.map((chunk, idx) =>
    sendFcmDataWithRetry(sub.deviceToken, {
      action: 'schedule_alarms',
      doses: JSON.stringify(chunk),
      syncedAt: now.toISOString(),
      horizonHours: String(HORIZON_HOURS),
      chunkIndex: String(idx),
      chunkTotal: String(chunks.length)
    })
  )
  const results = await Promise.all(sendPromises)
  results.forEach(ok => ok ? totalDevicesOk++ : totalDevicesFail++)
}
```

DosyMessagingService já é idempotente (mesmo groupKey hash) → safe receber múltiplas mensagens chunks.

**Critério aceitação:**

- ✅ Edge testada com 100 doses payload — não responde `INVALID_ARGUMENT`
- 🧪 Device runtime: user com 60 doses/48h → recebe 2 FCM data messages → AlarmScheduler agenda 60 alarmes (não duplica via idFromString idempotência)
- 🧪 alarm_audit_log mostra 60 `action=scheduled` source `edge_daily_sync`

**Risco / mitigação:**

| Risco | Severidade | Mitigação |
|---|---|---|
| Race entre chunks (chunk 2 chega antes chunk 1) | 🟢 Baixo | AlarmScheduler idempotente — ordem não importa | OK |
| 1 chunk falha, outros OK → set parcial agendado | 🟢 Baixo | Retry exponential já existe (`sendFcmDataWithRetry`). Worker 6h pega gap | OK |

**Egress save:** Zero líquido — múltiplas FCMs pequenas vs 1 grande. Mas alguns users hoje pode estar perdendo 100% dos alarmes (silent INVALID_ARGUMENT) — fix recupera entrega.

---

### #226 — Padronizar `device_id` UUID cross-source em `alarm_audit_log`

- **Categoria:** ✨ MELHORIAS
- **Prioridade:** 🟢 P3
- **Origem:** [Auditoria 2026-05-13 B-15]
- **Esforço:** 1-2h

**Problema:**

Três semânticas distintas pra coluna `alarm_audit_log.device_id`:

| Source | Valor gravado |
|---|---|
| `js_scheduler` (JS) | UUID v4 estável (`SharedPreferences "device_id"` via `getDeviceId()`) |
| `java_worker` / `java_fcm_received` / `java_alarm_scheduler` (Java) | `Build.MODEL + " (" + Build.MANUFACTURER + ")"` — **não-único** entre devices iguais |
| `edge_daily_sync` (Edge) | `sub.deviceToken.slice(-12)` — últimos 12 chars FCM token |

Análise cross-source dificultada — admin panel `/alarm-audit` não consegue filtrar por device consistente.

**Solução:**

1. **Java `AlarmAuditLogger.java:106`:**
   ```java
   // Antes:
   row.put("device_id", android.os.Build.MODEL + " (" + android.os.Build.MANUFACTURER + ")");

   // Depois:
   String deviceId = sp.getString("device_id", null);
   row.put("device_id", deviceId);  // UUID v4 já gravado por CriticalAlarmPlugin.setSyncCredentials
   ```

2. **Edge `daily-alarm-sync` `_shared/auditLog.ts`** (consequência #217 commit):
   - Adicionar coluna `device_id` em `medcontrol.push_subscriptions` (UUID estável, populado pelo JS no upsert via RPC)
   - Edge lê de `push_subscriptions.device_id` ao buscar subs
   - Metadata pode incluir `device_token_tail: sub.deviceToken.slice(-12)` pra debug

3. **Migration:**
   ```sql
   ALTER TABLE medcontrol.push_subscriptions ADD COLUMN device_id text;
   -- Backfill pra rows existentes: gerar UUID v4 (devices vão atualizar pós próximo subscribe)
   UPDATE medcontrol.push_subscriptions SET device_id = gen_random_uuid()::text WHERE device_id IS NULL;
   ```

4. **JS `fcm.js`** RPC `upsert_push_subscription` passa `device_id` parâmetro:
   ```js
   const deviceId = await getDeviceId()  // mesmo do plugin
   await supabase.schema('medcontrol').rpc('upsert_push_subscription', {
     p_device_token: deviceToken,
     p_device_id: deviceId,
     // ...
   })
   ```

**Critério aceitação:**

- ✅ Migration aplicada — `push_subscriptions.device_id` coluna existe
- ✅ Java + Edge usam mesma fonte UUID
- 🧪 admin `/alarm-audit` filtra por device_id mostra eventos consistentes cross-source

**Risco / mitigação:**

| Risco | Severidade | Mitigação |
|---|---|---|
| Rows audit pré-fix têm device_id incompatível | 🟢 Baixo | Aceitar — só dados históricos. Filter no admin "post-#226" | Documentar cutoff date |
| RPC `upsert_push_subscription` precisa update assinatura | 🟢 Baixo | Adicionar `p_device_id` parâmetro opcional, backward-compat | OK |

**Egress save:** Zero. Higiene observabilidade.
