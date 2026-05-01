# 08 — Limitações da Auditoria Web (itens [WEB-ONLY])

> **Importante:** este documento lista comportamentos que NÃO podem ser validados rodando o app na versão web (Vercel). Eles **NÃO são bugs** e **NÃO entram no checklist de lançamento**. São inerentes ao ambiente browser e só fazem sentido testar no APK Android final.
>
> O propósito deste arquivo é **explicar por que certos itens do prompt original não foram cobertos via Claude in Chrome** e direcionar onde testar manualmente em device físico (ver `docs/device-validation-checklist.md` no repo, e FASE 17 do `archive/plan-original.md`).

---

## 1. Alarme crítico nativo (CriticalAlarm plugin)

| Comportamento | Auditável na web? | Onde testar |
|---|---|---|
| Disparo de alarme em horário exato (`AlarmManager.setAlarmClock`) | ❌ Não | Device Android físico |
| Tela cheia sobre lock screen (`FLAG_SHOW_WHEN_LOCKED`) | ❌ Não | Device físico, com tela bloqueada |
| Som em loop ignorando perfil silencioso/DND (`USAGE_ALARM`) | ❌ Não | Device físico, modo silencioso ativo |
| Vibração contínua | ❌ Não | Device físico |
| Re-agendamento após reboot (`BootReceiver`) | ❌ Não | Device físico, reiniciar device |
| Sobrevivência a force-stop em OEMs hostis (Xiaomi/MIUI, Huawei, OnePlus) | ❌ Não | Device físico de cada OEM |
| Snooze 10 min via notification action | ❌ Não | Device físico |

**Auditoria estática feita:**
- Manifesto declara permissões corretas (`SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `ACCESS_NOTIFICATION_POLICY`, `FOREGROUND_SERVICE_SPECIAL_USE`).
- Plugin nativo Java auditado (`android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/`):
  - `AlarmReceiver.java`, `AlarmActivity.java`, `AlarmService.java`, `BootReceiver.java`, `AlarmActionReceiver.java`, `CriticalAlarmPlugin.java`.
  - WakeLock com timeout + release em `onDestroy` (sem leak).
  - `MediaPlayer.release()` + null assignment em cleanup.
  - `Vibrator.cancel()` em cleanup.
  - PendingIntent com `FLAG_IMMUTABLE` (Android 12+ correto).
  - Notification channel `IMPORTANCE_HIGH` + `setBypassDnd(true)`.
  - Re-agendamento pós-reboot com fallback de schema legado (v1 → v2).

Ver detalhes em `01-relatorio-completo.md` §1 (Confiabilidade de alarmes).

---

## 2. Notificações push FCM

| Comportamento | Auditável na web? | Onde testar |
|---|---|---|
| Recebimento push do servidor (`@capacitor/push-notifications`) | ❌ Não | Device físico Android com FCM token |
| Tap em notification tray abre `MainActivity` + modal queue | ❌ Não | Device físico |
| Multi-device push (mesmo user logado em N devices) | ❌ Não | 2+ devices físicos |
| Token rotation + cleanup automático (token inválido `UNREGISTERED` → DELETE no Supabase) | ❌ Não | Backend test + device |
| Resumo diário | ❌ Não | Device físico, esperar horário configurado |

**Auditoria estática feita:**
- `usePushNotifications.js` auditado (re-export shim para `notifications.js`).
- Edge Function `notify-doses/index.ts` audita FCM HTTP v1 + JWT OAuth (auditada — ver `04-supabase.md`).
- `upsert_push_subscription` RPC declarada no Plan.md.
- Configuração canal `doses` no manifesto via `LocalNotifications.smallIcon: 'ic_stat_dosy'` (⚠️ ver bug em `06-bugs.md` BUG-005 — ícone ausente).

---

## 3. Storage seguro nativo (Android KeyStore)

| Comportamento | Auditável na web? | Onde testar |
|---|---|---|
| Auth token Supabase em `EncryptedSharedPreferences` (`@aparajita/capacitor-secure-storage`) | ❌ Não | Device físico (logout/login + reinstalar) |
| FLAG_SECURE bloqueando screenshot em DoseModal/PatientDetail/Reports/DoseHistory | ❌ Não | Device físico, tentar tirar screenshot |
| Mask em recents view (privacy-screen plugin) | ❌ Não | Device físico, ver app no carrossel de recents |
| ADB backup bloqueado (`allowBackup="false"`) | ❌ Não | Device físico com debug enabled, `adb backup` |

**Auditoria estática feita:**
- `services/supabase.js` configura `SecureStorageAdapter` para nativo (auth.storage).
- `network_security_config.xml` força TLS 1.2+, sem cleartext, com pins SHA-256 SPKI Supabase.
- `data_extraction_rules.xml` exclui todos domínios.
- `usePrivacyScreen.js` hook + uso em DoseModal/PatientDetail/Reports/DoseHistory.

---

## 4. Permissões em runtime (Android 13+/14+)

| Comportamento | Auditável na web? | Onde testar |
|---|---|---|
| Prompt `POST_NOTIFICATIONS` (Android 13+) | ❌ Não | Device físico Android 13+ |
| Prompt `SCHEDULE_EXACT_ALARM` settings (Android 12+) | ❌ Não | Device físico Android 12+ |
| Prompt `USE_FULL_SCREEN_INTENT` settings (Android 14+) | ❌ Não | Device físico Android 14+ |
| Bypass DND via `ACCESS_NOTIFICATION_POLICY` | ❌ Não | Device físico, ativar modo "Não Perturbe" sistema |
| Reset de permissões pós-update do app | ❌ Não | Device físico, instalar v anterior + atualizar |

**Auditoria estática feita:**
- `PermissionsOnboarding.jsx` (246 LOC) usa `criticalAlarm.checkAllPermissions()` para auditar status.
- Storage versionado por `APP_VERSION` (re-aparece após major update).

---

## 5. Background tasks / Doze Mode / App Standby

| Comportamento | Auditável na web? | Onde testar |
|---|---|---|
| Alarme dispara durante Doze Mode (device idle, tela apagada) | ❌ Não | Device físico, esperar Doze (~1h sem uso) |
| App Standby (não usado por dias) | ❌ Não | Device físico, esperar 7+ dias |
| Bateria fraca / saver mode | ❌ Não | Device físico |

**Auditoria estática feita:**
- App usa `setAlarmClock()` (não `setExactAndAllowWhileIdle()`), que é a API mais robusta — bypassa Doze nativamente.
- App **NÃO** usa WorkManager (esp. `enqueueUniquePeriodicWork`) — escolha correta para horários exatos.
- ⚠️ Para OEMs hostis (Xiaomi/Huawei) há plano `DosyMonitorService` em backlog (FASE 23.7 do Plan).

---

## 6. Capacitor App Update (Play In-App Updates)

| Comportamento | Auditável na web? | Onde testar |
|---|---|---|
| Detecção automática de update via Play Store | ❌ Não | Device físico, com app publicado em track Internal/Closed |
| Banner "Atualização disponível" não-bloqueante | ❌ Não | Device físico |
| Update flexível (background) vs imediato | ❌ Não | Device físico |

**Auditoria estática feita:**
- `useAppUpdate.js` hook (183 LOC) + `UpdateBanner.jsx`.
- Plugin `@capawesome/capacitor-app-update@8.0.3` em deps.
- `version.json` emitido no build (web) — fallback para web checagem manual.

---

## 7. Biometria (App Lock)

| Comportamento | Auditável na web? | Onde testar |
|---|---|---|
| Unlock por digital/face ID | ❌ Não | Device físico com biometria cadastrada |
| Auto-lock após N minutos em background | ❌ Parcial (lógica timer pode ser testada) | Device físico para validar trigger |

**Auditoria estática feita:**
- `useAppLock.js` hook completo (auto-lock após N min bg).
- Plugin `@aparajita/capacitor-biometric-auth@10.0.0` em deps.
- ⚠️ UI de LockScreen + integração `main.jsx` ainda **não-wired** (FASE 11.3 do Plan, movida para FASE 12 ou 23).

---

## 8. AdMob (banners nativos)

| Comportamento | Auditável na web? | Onde testar |
|---|---|---|
| Banner AdMob Top center overlay (nativo) | ❌ Não | Device físico (web mostra apenas placeholder/AdSense) |
| Targeted ads via Google Play Services | ❌ Não | Device físico real (não emulador) |

**Auditoria estática feita:**
- `AdBanner.jsx` condicional AdSense (web) / AdMob (nativo).
- `VITE_ADMOB_BANNER_ANDROID` configurado para production ID.
- ⚠️ `index.html` script tag AdSense ainda com placeholder `ca-pub-XXXXXXXXXXXXXXXX` (FASE 4.3 pendente — ver `06-bugs.md` BUG-006).

---

## 9. Deep links (App Links Android)

| Comportamento | Auditável na web? | Onde testar |
|---|---|---|
| `dosy://auth/callback?code=...` (OAuth flow nativo) | ❌ Não | Device físico, tap link de email |
| `https://dosy-teal.vercel.app/...` com `autoVerify="true"` | ❌ Não | Device físico, tap link |
| `dosy://reset-password?code=...` (PKCE) | ❌ Não | Device físico |

**Auditoria estática feita:**
- `AndroidManifest.xml` com 2 `<intent-filter>` (HTTPS autoVerify + custom scheme).
- `App.jsx:209-243` handler de deep links (login OAuth + password reset).

---

## 10. Capacitor Filesystem + Share

| Comportamento | Auditável na web? | Onde testar |
|---|---|---|
| Salvar PDF gerado em Cache + Share Sheet nativo | ❌ Não | Device físico, gerar relatório |
| Export CSV → Share | ❌ Não | Device físico |

**Auditoria estática feita:**
- `Reports.jsx` usa `dynamic import('jspdf')` + `dynamic import('html2canvas')` (lazy).
- Fallback web: `window.open` ou download blob.

---

## Resumo

Itens [WEB-ONLY] **NÃO contam** como gaps de qualidade do app. Todos têm cobertura estática feita via leitura de código (manifesto, plugin Java, hooks Capacitor) e validação documentada em `docs/device-validation-checklist.md` (FASE 17).

**Antes do Beta interno**, o dev DEVE rodar manualmente o checklist em pelo menos 3 devices Android (versões 12, 13, 14) — esse é um gate de qualidade que nenhuma auditoria estática substitui.

Ver `../CHECKLIST.md` item P0 #007 (Validação device físico) e `ROADMAP.md` §🔴 P0.
