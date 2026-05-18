# Receita — Validação Autônoma via Emulator CLI

> Comprovado v0.2.3.2 2026-05-14. IA roda sozinha sem user na máquina para maioria validações device.
> Usar SEMPRE antes de pedir validação manual ao user (§11c).

---

## Stack autônoma

- **avdmanager CLI** — cria AVDs
- **emulator.exe** — launch headless com Studio Mirror
- **gradlew CLI** — build debug APK
- **ADB** — install + launch + UI interaction
- **uiautomator dump** — parse UI para bounds + text
- **Supabase MCP** `execute_sql` — trigger eventos backend direto
- **Chrome MCP** — admin.dosymed.app validações
- **logcat** via `Monitor` tool — captura eventos runtime

---

## 1. Setup AVDs (1× por device target)

```bash
# Instalar cmdline-tools se faltar:
curl -sL -o /tmp/clt.zip "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip"
unzip -q -o /tmp/clt.zip -d $ANDROID_HOME/cmdline-tools/
mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest
```

```bash
# Criar AVDs:
echo "no" | avdmanager create avd -n Pixel8_Test -k "system-images;android-35;google_apis_playstore;x86_64" -d "pixel_8"
echo "no" | avdmanager create avd -n Pixel9Pro_Test -k "system-images;android-35;google_apis_playstore;x86_64" -d "pixel_9_pro"
```

---

## 2. Start emulator (flags exatas do Android Studio)

```bash
# Flags EXATAS que Android Studio usa (extraídas via Win32_Process CommandLine).
# -qt-hide-window: esconde janela Qt MAS mantém processo Qt ativo
#   → Studio Device Mirroring pega frames via gRPC → keyboard físico funciona no HUD
#   DIFERE de -no-window (headless puro, sem Qt UI = Studio Mirror NÃO funciona)
$ANDROID_HOME/emulator/emulator.exe -netdelay none -netspeed full \
  -avd Pixel8_Test -qt-hide-window -grpc-use-token -idle-grpc-timeout 300
# Usar run_in_background: true

# Aguardar boot:
until [ "$(adb -s emulator-5554 shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 5; done
```

**Se emulator externo Qt já rodando** (janela apareceu em monitor externo, teclado não funciona):
```powershell
Get-Process | Where-Object { $_.ProcessName -match "qemu|emulator|crashpad|netsimd" } | Stop-Process -Force
```
Relançar com flags acima.

---

## 3. Login via CDP (mais confiável que click no form)

```bash
# Encontrar PID do app + setup port forward:
APP_PID=$(adb -s emulator-5554 shell pidof com.dosyapp.dosy.dev | tr -d '\r')
adb -s emulator-5554 forward tcp:9222 localabstract:webview_devtools_remote_$APP_PID

# Listar pages DevTools:
PAGE=$(curl -s http://localhost:9222/json | grep -oE '"id": "[A-F0-9]+"' | head -1 | grep -oE '[A-F0-9]+$')

# Auth via REST + set localStorage + reload:
node scripts/cdp_login.mjs "$PAGE" teste-plus@teste.com 123456
```

`scripts/cdp_login.mjs`: POST `/auth/v1/token`, salva session no localStorage formato Supabase v2, redireciona `/`.
Funciona com qualquer conta sem interagir com form HTML.

---

## 4. Build APK debug + install

```bash
cd android
TEMP='C:\temp\gradle_tmp' TMP='C:\temp\gradle_tmp' \
  JAVA_HOME='/c/Program Files/Eclipse Adoptium/jdk-25.0.3.9-hotspot' \
  PATH="$JAVA_HOME/bin:$PATH" ./gradlew assembleDebug

adb -s emulator-5554 install -r -t app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5554 shell pm grant com.dosyapp.dosy.dev android.permission.POST_NOTIFICATIONS
adb -s emulator-5554 shell am start -n com.dosyapp.dosy.dev/com.dosyapp.dosy.MainActivity
```

---

## 5. UI interaction — Appium W3C Actions OBRIGATÓRIO (Regra 17 RULES.md)

> 🛑 **NUNCA usar CDP eval (`document.querySelector().click()`) como substituto.**
> CDP só dispara eventos DOM JS — NÃO simula touch OS-level.
> React-Aria pickers, Headless dropdowns, Capacitor plugin handlers exigem touch real.

### Setup Appium (1× por máquina)

```bash
npm i -g appium
appium driver install uiautomator2

# Start server background:
appium --port 4723 --base-path / &
```

### Script-driver via WebdriverIO

`scripts/qa_appium.mjs`:
```js
import { remote } from 'webdriverio'

const driver = await remote({
  hostname: '127.0.0.1', port: 4723, path: '/',
  capabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'emulator-5554',
    'appium:appPackage': 'com.dosyapp.dosy.dev',
    'appium:appActivity': 'com.dosyapp.dosy.MainActivity',
    'appium:noReset': true,
  }
})

// Find by accessibility-id (preferido), text, ou xpath:
const button = await driver.$('~register-sos-button')   // accessibility id
const tomada = await driver.$('android=new UiSelector().textContains("Tomada")')

// Touch real (NÃO usar .click() pra dropdowns/pickers):
await tomada.click()                                    // simple tap (most cases OK)
// OU W3C Actions para gestures complexas:
await driver.performActions([{
  type: 'pointer',
  id: 'finger1',
  parameters: { pointerType: 'touch' },
  actions: [
    { type: 'pointerMove', duration: 0, x: 540, y: 800 },
    { type: 'pointerDown', button: 0 },
    { type: 'pause', duration: 100 },
    { type: 'pointerUp', button: 0 },
  ]
}])

// Text input (funciona inclusive em password fields):
const emailInput = await driver.$('~email-input')
await emailInput.setValue('teste-plus@teste.com')

await driver.deleteSession()
```

### Fallback simples (uiautomator dump) — APENAS pra leitura/screenshot

```bash
MSYS_NO_PATHCONV=1 adb shell uiautomator dump /data/local/tmp/ui.xml
MSYS_NO_PATHCONV=1 adb pull '//data/local/tmp/ui.xml' 'C:\temp\ui.xml'
# OK pra inspecionar bounds + text + accessibility-ids
# NÃO usar `adb shell input tap` pra pickers/dropdowns/modals → use Appium acima
```

### Simulação de idle/token expiry (sem esperar 30min real)

```sql
-- Via Supabase MCP — força refresh token revogado
UPDATE auth.refresh_tokens SET revoked=true
WHERE user_id=(SELECT id FROM auth.users WHERE email='teste-plus@teste.com');
```

Depois:
```bash
adb shell input keyevent KEYCODE_HOME    # background
sleep 5
adb shell am start -n com.dosyapp.dosy.dev/com.dosyapp.dosy.MainActivity  # foreground
# useAppResume dispara refresh → falha → simula scenario idle 30min
```

---

## 6. Trigger backend via Supabase MCP

```sql
-- Insert dose +3min → dispara dose_change_trigger → Edge v21 → FCM → AlarmScheduler
WITH u AS (SELECT id FROM auth.users WHERE email='teste-plus@teste.com')
INSERT INTO medcontrol.doses (id, "userId", ...) SELECT gen_random_uuid(), u.id, ... FROM u;

-- Validar audit log:
SELECT source, action, created_at FROM medcontrol.alarm_audit_log
WHERE user_id=(SELECT id FROM auth.users WHERE email='teste-plus@teste.com')
AND created_at > NOW() - INTERVAL '5 minutes' ORDER BY created_at DESC;
```

---

## 7. Monitor logcat

```bash
adb logcat -T '01-01 00:00:00.000' | grep --line-buffered -iE "AlarmScheduler|DosyMessagingService|FCM|fired|trigger_handler"
```

---

## 8. Screenshot evidência

```bash
MSYS_NO_PATHCONV=1 adb shell screencap -p /data/local/tmp/dash.png
MSYS_NO_PATHCONV=1 adb pull '//data/local/tmp/dash.png' 'C:\temp\dash.png'
# Read C:\temp\dash.png para visualizar
```

---

## Coverage autônoma comprovada (v0.2.3.2)

- ✅ App launch + dashboard render
- ✅ Login UI flow (email/senha — exceto password field via ADB)
- ✅ Plugin `CriticalAlarm` end-to-end: FCM → AlarmScheduler → fired via logcat
- ✅ `DosyMessagingService` FCM data handler
- ✅ `alarm_audit_log` 6 sources runtime
- ✅ `push_subscriptions` device_id_uuid filter (multi-device)
- ✅ Dose flow E2E: SQL INSERT → trigger → Edge → FCM → Java → fire
- ✅ UI layout cross-emulator (Pixel 8 vs Pixel 9 Pro)

---

## Limites conhecidos

- ⚠️ **Password field via ADB**: `input text` falha em campos `password=true`. Workarounds: (a) emulator embedded na HUD Studio (teclado físico funciona); (b) Appium W3C Actions; (c) pedir user logar 1× depois IA continua.
- ⚠️ Reboot test: `adb reboot` leva 30-60s restart.
- ⚠️ Push FCM real: emulator Google Play Services OK mas token diferente de device físico.
- ⚠️ Samsung One UI, Xiaomi MIUI behaviour: apenas device físico real.
