# Dosy — Plano de Migração para APK / Play Store

> Documento vivo. Atualizar status dos itens conforme progresso.
> Última atualização: Abril 2026

---

## Visão Geral

O app Dosy é atualmente uma PWA (React + Vite + Tailwind + Supabase) hospedada na Vercel. O objetivo é transformá-lo em um produto Android distribuído pela Google Play Store, com monetização real (assinaturas), notificações nativas e experiência de app nativo.

**Ferramenta de migração:** [Capacitor](https://capacitorjs.com/) — envolve a PWA em uma shell nativa Android sem reescrever o código React.

**Stack resultante:**
```
React 19 (UI) + Vite (build) → dist/
  → Capacitor → Android (WebView nativo)
    → APK/AAB → Google Play Store
```

---

## Fases do Projeto

### Fase 1 — Fundação Capacitor
### Fase 2 — Notificações Nativas (FCM)
### Fase 3 — Monetização Real (In-App Purchase)
### Fase 4 — Polimento & Experiência Nativa
### Fase 5 — Preparação Play Store
### Fase 6 — Publicação & Pós-Launch

---

## FASE 1 — Fundação Capacitor

**Objetivo:** App abre no Android sem erros. Navegação funciona. Auth funciona.

### 1.1 Instalar Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npm install @capacitor/app @capacitor/status-bar @capacitor/keyboard @capacitor/splash-screen
npx cap init "Dosy" "com.dosyapp.dosy" --web-dir dist
npx cap add android
```

### 1.2 `capacitor.config.ts`

Criar na raiz do projeto:

```typescript
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dosyapp.dosy',
  appName: 'Dosy',
  webDir: 'dist',
  server: {
    androidScheme: 'https'   // necessário para Supabase auth funcionar em WebView
  },
  plugins: {
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0d1535',   // dark navy — mesmo do AppHeader
      overlaysWebView: false
    },
    Keyboard: {
      resizeOnFullScreen: true      // evita layout quebrado com teclado aberto
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0d1535',
      androidSplashResourceName: 'splash',
      showSpinner: false
    }
  }
}
export default config
```

### 1.3 Atualizar `package.json` scripts

```json
"scripts": {
  "build:android": "npm run build && npx cap sync android",
  "open:android": "npx cap open android",
  "cap:sync": "npx cap sync"
}
```

### 1.4 Corrigir autenticação no WebView Android

O Supabase usa `localStorage` para persistir sessão. No Android nativo, `localStorage` é instável (pode ser limpo pelo sistema). Migrar para **Capacitor Preferences** (antigo Storage):

```bash
npm install @capacitor/preferences
```

Modificar `src/services/supabase.js`:

```javascript
import { Preferences } from '@capacitor/preferences'

const CapacitorStorage = {
  getItem: async (key) => {
    const { value } = await Preferences.get({ key })
    return value
  },
  setItem: async (key, value) => {
    await Preferences.set({ key, value })
  },
  removeItem: async (key) => {
    await Preferences.remove({ key })
  }
}

export const supabase = createClient(URL, KEY, {
  auth: {
    storage: CapacitorStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false   // OBRIGATÓRIO no Android — sem URL redirect
  },
  db: { schema: 'medcontrol' }
})
```

### 1.5 Tratar botão Voltar do Android

Sem tratamento, o botão voltar fecha o app inesperadamente. Adicionar em `src/App.jsx`:

```javascript
import { App as CapacitorApp } from '@capacitor/app'

useEffect(() => {
  const handler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
    } else {
      CapacitorApp.exitApp()
    }
  })
  return () => handler.remove()
}, [])
```

### 1.6 Reconexão do Realtime ao sair/voltar

O Supabase Realtime desconecta quando Android coloca app em segundo plano. Adicionar em `src/hooks/useRealtime.js`:

```javascript
import { App as CapacitorApp } from '@capacitor/app'

useEffect(() => {
  const pause = CapacitorApp.addListener('pause', () => {
    supabase.removeAllChannels()
  })
  const resume = CapacitorApp.addListener('resume', () => {
    // Resubscreve e invalida queries para dados frescos
    setupRealtimeChannel()
    qc.invalidateQueries()
  })
  return () => { pause.remove(); resume.remove() }
}, [])
```

### 1.7 Build e sync

```bash
npm run build
npx cap sync android
npx cap open android   # abre Android Studio
```

Testar no emulador (API 26+) e em dispositivo físico antes de avançar.

---

## FASE 2 — Notificações Nativas (FCM)

**Objetivo:** Substituir Web Push API + VAPID por Firebase Cloud Messaging (FCM). As atuais notificações Web Push não funcionam de forma confiável em WebViews Android.

### 2.1 Por que trocar Web Push por FCM?

| | Web Push (atual) | FCM (necessário) |
|---|---|---|
| Funciona em PWA web | ✅ | ✅ |
| Funciona em Android nativo (Capacitor) | ❌ Não confiável | ✅ |
| Service Worker necessário | ✅ | Não |
| Delivery garantido | Parcial | ✅ |
| Suporte a snooze/ações nativas | Limitado | ✅ |

### 2.2 Setup Firebase

1. Criar projeto no [Firebase Console](https://console.firebase.google.com/)
2. Adicionar app Android com package `com.dosyapp.dosy`
3. Baixar `google-services.json` → colocar em `android/app/`
4. No Firebase Console → Cloud Messaging → copiar Server Key e Sender ID

### 2.3 Instalar pacotes Capacitor

```bash
npm install @capacitor/push-notifications @capacitor/local-notifications
```

Adicionar ao `capacitor.config.ts`:

```typescript
plugins: {
  PushNotifications: {
    presentationOptions: ['badge', 'sound', 'alert']
  },
  LocalNotifications: {
    smallIcon: 'ic_stat_dosy',
    iconColor: '#2B3EDF',    // brand color Dosy
    sound: 'default'
  }
}
```

### 2.4 Reescrever `src/hooks/usePushNotifications.js`

A hook atual usa a Web Push API. Criar lógica condicional: FCM no nativo, Web Push na web.

```javascript
import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

export function usePushNotifications() {
  // Subscribe
  const subscribe = useCallback(async (advanceMins = 15) => {
    if (isNative) {
      // FCM path
      await PushNotifications.requestPermissions()
      await PushNotifications.register()
      // token chegará via listener 'registration' → salvar no Supabase
    } else {
      // Web Push path (existente)
      // ... código atual mantido para web/PWA
    }
  }, [])

  // Listener: token FCM pronto
  useEffect(() => {
    if (!isNative) return
    PushNotifications.addListener('registration', async ({ value: deviceToken }) => {
      if (!hasSupabase) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.schema('medcontrol').from('push_subscriptions').upsert({
        userId: user.id,
        deviceToken,
        platform: 'android',
        advanceMins,
        userAgent: navigator.userAgent.slice(0, 250)
      }, { onConflict: 'deviceToken' })
    })
    return () => PushNotifications.removeAllListeners()
  }, [])

  // Scheduling local (próximas 24h)
  const scheduleDoses = useCallback(async (doses, advanceMins) => {
    if (isNative) {
      const pending = await LocalNotifications.getPending()
      const pendingIds = pending.notifications.map(n => n.id)
      const upcoming = doses
        .filter(d => d.status === 'pending')
        .filter(d => new Date(d.scheduledAt) > new Date())
      await LocalNotifications.schedule({
        notifications: upcoming.map(d => ({
          id: parseInt(d.id.replace(/-/g,'').slice(0,8), 16),
          title: `💊 ${d.medName}`,
          body: `Hora de tomar ${d.unit}`,
          schedule: { at: new Date(new Date(d.scheduledAt) - (advanceMins ?? 15) * 60000) },
          extra: { doseId: d.id }
        }))
      })
    } else {
      // Web Push path (existente — via SW SCHEDULE_DOSES)
    }
  }, [])
}
```

### 2.5 Migration banco de dados — `push_subscriptions`

Tabela atual tem `endpoint` e `keys` (formato Web Push). Adicionar colunas para FCM:

```sql
ALTER TABLE medcontrol.push_subscriptions
  ADD COLUMN "deviceToken" text,
  ADD COLUMN platform text DEFAULT 'web';

-- Novo índice para FCM tokens
CREATE UNIQUE INDEX push_subscriptions_device_token_idx
  ON medcontrol.push_subscriptions("deviceToken")
  WHERE "deviceToken" IS NOT NULL;
```

### 2.6 Reescrever Edge Function `notify-doses`

Atual usa `npm:web-push` (VAPID). Reescrever para Firebase Admin SDK:

```typescript
// supabase/functions/notify-doses/index.ts
import { initializeApp, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

// Secrets necessários: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
initializeApp({ credential: cert({ ... }) })

// Para subs web (endpoint+keys), continuar usando web-push
// Para subs android (deviceToken), usar Firebase Admin
const androidSubs = subs.filter(s => s.platform === 'android')
const webSubs = subs.filter(s => s.platform === 'web')

// FCM multicast
await getMessaging().sendEachForMulticast({
  tokens: androidSubs.map(s => s.deviceToken),
  notification: { title: `💊 ${dose.medName}`, body: `Dose: ${dose.unit}` },
  data: { doseId: dose.id }
})
```

**Novos secrets Supabase:**
```
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

---

## FASE 3 — Monetização Real (In-App Purchase)

**Objetivo:** Usuário pode assinar o plano PRO pela Play Store. Receita real.

### 3.1 Obrigatoriedade

Google Play **exige** Google Play Billing para compras de conteúdo digital dentro do app. Não é opcional. Usar RevenueCat como camada de abstração (suporta Play Store + App Store + Web).

### 3.2 Setup RevenueCat

1. Criar conta em [app.revenuecat.com](https://app.revenuecat.com)
2. Criar projeto "Dosy"
3. Conectar Google Play Console via chave de serviço
4. Criar produtos no Google Play Console:
   - `dosy_pro_monthly` — R$7,90/mês
   - `dosy_pro_yearly` — R$49,90/ano

```bash
npm install @revenuecat/purchases-capacitor
```

### 3.3 Criar `src/hooks/useInAppPurchase.js`

```javascript
import Purchases, { LOG_LEVEL } from '@revenuecat/purchases-capacitor'
import { Capacitor } from '@capacitor/core'

const RC_API_KEY_ANDROID = 'goog_...'   // do painel RevenueCat

export function useInAppPurchase() {
  const { user } = useAuth()
  const toast = useToast()

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return
    Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
    Purchases.configure({ apiKey: RC_API_KEY_ANDROID, appUserID: user.id })
  }, [user])

  const getOfferings = useCallback(async () => {
    const { offerings } = await Purchases.getOfferings()
    return offerings.current
  }, [])

  const purchasePro = useCallback(async (packageType = 'MONTHLY') => {
    try {
      const offering = await getOfferings()
      const pkg = offering?.availablePackages.find(p => p.packageType === packageType)
      if (!pkg) throw new Error('Produto não encontrado')

      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })

      if (customerInfo.entitlements.active['pro']) {
        // Sincronizar com Supabase
        await supabase.rpc('admin_grant_tier', {
          target_user: user.id,
          new_tier: 'pro',
          expires: new Date(customerInfo.entitlements.active['pro'].expirationDate),
          src: 'play_store'
        })
        toast.show({ message: '🎉 Plano PRO ativado!', kind: 'success' })
      }
    } catch (err) {
      if (err.code !== 'PURCHASE_CANCELLED') {
        toast.show({ message: err.message || 'Falha na compra.', kind: 'error' })
      }
    }
  }, [user])

  const restorePurchases = useCallback(async () => {
    const { customerInfo } = await Purchases.restorePurchases()
    if (customerInfo.entitlements.active['pro']) {
      // Sincronizar tier no Supabase
    }
  }, [])

  return { purchasePro, restorePurchases, getOfferings }
}
```

### 3.4 Atualizar `PaywallModal.jsx`

Substituir botão disabled pelo fluxo real:

```jsx
const { purchasePro } = useInAppPurchase()
const { isNative } = useCapacitorPlatform()

// Mensal
<button onClick={() => purchasePro('MONTHLY')} className="btn-primary w-full">
  Assinar PRO — R$7,90/mês
</button>

// Anual
<button onClick={() => purchasePro('ANNUAL')} className="btn-secondary w-full">
  Assinar Anual — R$49,90/ano (−48%)
</button>

// Restaurar compras (obrigatório pela Play Store)
<button onClick={restorePurchases} className="text-xs text-brand-600 underline mt-2">
  Restaurar compras
</button>
```

### 3.5 Webhook RevenueCat → Supabase (opcional mas recomendado)

Configurar webhook no RevenueCat para notificar Supabase em renovações/cancelamentos automáticos:
- RevenueCat → Event Delivery → Webhook → URL da Edge Function
- Edge Function atualiza `subscriptions` table automaticamente

---

## FASE 4 — Polimento & Experiência Nativa

**Objetivo:** App parece nativo, não uma webpage dentro de um frame.

### 4.1 Exportação PDF — trocar `window.print()`

`window.print()` é instável no Android. Substituir por geração client-side:

```bash
npm install jspdf html2canvas
```

```javascript
// src/pages/Reports.jsx
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Filesystem, Directory } from '@capacitor/filesystem'

async function exportPDF() {
  const reportEl = document.getElementById('report-content')
  const canvas = await html2canvas(reportEl, { scale: 2, useCORS: true })
  const pdf = new jsPDF('p', 'mm', 'a4')
  const imgData = canvas.toDataURL('image/png')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = (canvas.height * pageWidth) / canvas.width
  pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight)

  if (Capacitor.isNativePlatform()) {
    // Salvar no dispositivo Android
    const base64 = pdf.output('datauristring').split(',')[1]
    await Filesystem.writeFile({
      path: `relatorio-dosy-${Date.now()}.pdf`,
      data: base64,
      directory: Directory.Documents
    })
    toast.show({ message: 'PDF salvo em Documentos.', kind: 'success' })
  } else {
    // Web: download normal
    pdf.save(`relatorio-dosy.pdf`)
  }
}
```

### 4.2 Exportação CSV no Android

```bash
npm install @capacitor/filesystem
```

```javascript
// src/pages/Reports.jsx
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

async function exportCSV() {
  // ... gerar csv string como hoje ...
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: `dosy_${Date.now()}.csv`,
      data: btoa(unescape(encodeURIComponent(csv))),
      directory: Directory.Cache
    })
    await Share.share({ title: 'Relatório Dosy', url: uri })
  } else {
    downloadBlob(blob, `dosy_${Date.now()}.csv`)
  }
}
```

### 4.3 AdMob (substituir AdSense)

AdSense não funciona em WebView. Para monetização por anúncio no app nativo:

```bash
npm install @capacitor-community/admob
```

```javascript
// src/components/AdBanner.jsx
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob'

// Android Banner ID: ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
// Substituir AdSense no plano free por banner AdMob nativo
```

> **Nota:** AdSense pode continuar sendo usado na versão web (PWA). No APK, usar AdMob. Detectar plataforma e renderizar o componente correto.

### 4.4 Splash Screen & Ícones Adaptativos

**Instalar:**
```bash
npm install @capacitor/splash-screen @capacitor/assets
```

**Assets necessários (criar):**
- `resources/icon.png` — 1024×1024, Dosy logo, fundo transparente
- `resources/icon-foreground.png` — 108×108, apenas o logo pill (para adaptive icon Android 8+)
- `resources/splash.png` — 2732×2732, logo centralizado em fundo `#0d1535`

**Gerar automaticamente:**
```bash
npx @capacitor/assets generate --android
```

Isso gera todos os tamanhos necessários em `android/app/src/main/res/`.

### 4.5 Status Bar e Safe Area

Header do Dosy já usa `safe-top`. Verificar em dispositivos com notch/câmera punch-hole:

```javascript
// src/main.jsx ou App.jsx
import { StatusBar, Style } from '@capacitor/status-bar'

if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark })
  StatusBar.setBackgroundColor({ color: '#0d1535' })
}
```

### 4.6 Deep Links (para OAuth futuro)

Configurar em `android/app/src/main/AndroidManifest.xml`:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="dosy-teal.vercel.app" />
</intent-filter>
```

---

## FASE 5 — Preparação Play Store

**Objetivo:** Cumprir todos os requisitos do Google para publicação.

### 5.1 Google Play Console

1. Criar conta de desenvolvedor: [play.google.com/console](https://play.google.com/console) — taxa única de USD 25
2. Criar app → "Dosy" → "Aplicativo" → "Português (Brasil)"
3. Configurar perfil de app

### 5.2 Política de Privacidade (obrigatória)

Apps de saúde são **categoria sensível** no Play Store — política de privacidade é obrigatória.

Criar página de política de privacidade (pode ser no próprio site/Vercel):
```
https://dosy-teal.vercel.app/privacidade
```

Incluir:
- Dados coletados (email, nome, medicamentos, doses)
- Finalidade (gestão de saúde pessoal)
- Compartilhamento (Supabase, Firebase, RevenueCat)
- Direitos do usuário (exclusão de conta/dados)
- Contato do responsável

### 5.3 Termos de Uso

```
https://dosy-teal.vercel.app/termos
```

Adicionar rota `/privacidade` e `/termos` no `App.jsx` (páginas HTML simples).

### 5.4 Questionário de classificação IARC

Play Store exige classificação etária. Para app de saúde:
- Sem violência, sem conteúdo adulto → classificação **Livre (L)**
- Preencher no console: Conteúdo do app → Classificação de conteúdo

### 5.5 Declaração de saúde

Apps de saúde podem precisar de declaração adicional no Google Play. Confirmar se Dosy se enquadra em "aplicativo médico" ou apenas "bem-estar".

### 5.6 Assinatura do app (Keystore)

```bash
# Gerar keystore (fazer UMA vez, guardar com segurança — NÃO committar no git)
keytool -genkey -v -keystore dosy-release.keystore \
  -alias dosykey -keyalg RSA -keysize 2048 -validity 10000

# Armazenar senhas como variáveis de ambiente ou secrets do CI
```

**NUNCA commitar o `.keystore` no repositório.**

Configurar `android/app/build.gradle`:

```gradle
android {
  signingConfigs {
    release {
      storeFile file(System.getenv('KEYSTORE_PATH') ?: '../dosy-release.keystore')
      storePassword System.getenv('KEYSTORE_PASSWORD')
      keyAlias System.getenv('KEY_ALIAS') ?: 'dosykey'
      keyPassword System.getenv('KEY_PASSWORD')
    }
  }
  buildTypes {
    release {
      minifyEnabled false
      signingConfig signingConfigs.release
    }
  }
  defaultConfig {
    applicationId "com.dosyapp.dosy"
    minSdk 26       // Android 8.0 — cobre 95%+ dos dispositivos ativos
    targetSdk 34    // Android 14 — obrigatório pelo Play Store em 2024
    versionCode 1
    versionName "1.0.0"
  }
}
```

### 5.7 Build AAB (Android App Bundle)

O Play Store prefere `.aab` ao `.apk`:

```bash
# Build da web
npm run build

# Sync com Android
npx cap sync android

# No Android Studio:
Build → Generate Signed Bundle/APK → Android App Bundle

# Ou via CLI (requer gradle configurado):
cd android
./gradlew bundleRelease
```

Arquivo gerado: `android/app/build/outputs/bundle/release/app-release.aab`

### 5.8 Screenshots para Play Store

**Obrigatórias:**
- Mínimo 2 screenshots de phone (320dp – 3840dp)
- Resolução recomendada: 1080×1920px
- Formato: PNG ou JPEG

**Recomendadas:**
- Tablet 7" (opcional mas melhora conversão)
- Feature graphic: 1024×500px (banner principal da loja)

Tirar screenshots de:
1. Dashboard com doses do dia
2. Confirmação de dose (DoseModal)
3. Relatório PDF gerado
4. Configurações de notificação
5. Tela de pacientes

### 5.9 Descrição para Play Store

**Título:** Dosy – Controle de Medicamentos (máx 50 chars)
**Descrição curta:** Gerencie doses, tratamentos e adesão medicamentosa (máx 80 chars)
**Descrição longa:** Detalhar funcionalidades, público-alvo, privacidade (máx 4000 chars)

### 5.10 Preços e países

- App gratuito (download grátis)
- In-app: PRO Mensal (R$7,90), PRO Anual (R$49,90)
- Países: Brasil inicialmente; expandir depois

---

## FASE 6 — Publicação & Pós-Launch

### 6.1 Internal Testing Track (primeiro)

1. Upload do `.aab` → Testes internos
2. Adicionar email de testadores (até 100)
3. Testar todas as funcionalidades no dispositivo real
4. Resolver bugs antes de ir para produção

### 6.2 Closed Testing (beta)

1. Mover para Closed Testing (beta) com grupo maior
2. Coletar feedback → corrigir issues
3. Aguardar aprovação do Google (24-72h para apps de saúde pode ser mais lento)

### 6.3 Production Release

1. Subir para produção com rollout gradual (10% → 50% → 100%)
2. Monitorar crashlytics / Android Vitals no Play Console
3. Responder reviews

### 6.4 CI/CD para atualizações

Configurar GitHub Actions para build e upload automático:

```yaml
# .github/workflows/android-release.yml
name: Android Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-java@v4
        with: { distribution: 'temurin', java-version: '17' }
      - run: npm ci
      - run: npm run build
      - run: npx cap sync android
      - name: Build AAB
        run: |
          cd android
          ./gradlew bundleRelease \
            -PKEYSTORE_PASSWORD=${{ secrets.KEYSTORE_PASSWORD }} \
            -PKEY_PASSWORD=${{ secrets.KEY_PASSWORD }}
      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.SERVICE_ACCOUNT_JSON }}
          packageName: com.dosyapp.dosy
          releaseFiles: android/app/build/outputs/bundle/release/*.aab
          track: internal
```

### 6.5 Monitoramento pós-launch

- Android Vitals (crashes, ANRs, battery)
- Firebase Analytics (opcional)
- Reviews e ratings
- RevenueCat dashboard (receita, churn, LTV)

---

## Análise de Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Google rejeitar app (categoria saúde) | Média | Alto | Política de privacidade robusta + não mencionar diagnóstico médico |
| Keystore perdido/corrompido | Baixa | Crítico | Backup em 3 locais seguros (HD externo, nuvem criptografada, cofre físico) |
| Push FCM falhar no background | Média | Médio | LocalNotifications como fallback |
| Revenuecat billing error | Baixa | Alto | Testar extensivamente em ambiente de teste antes de lançar |
| Supabase auth token expirar offline | Média | Médio | `autoRefreshToken: true` + capturar erro e redirecionar para Login |
| WebView lenta vs app nativo | Alta | Médio | Testar performance; considerar Capacitor Ionic para componentes críticos |

---

## Estimativa de Esforço

| Fase | Estimativa | Dependências externas |
|---|---|---|
| Fase 1 — Fundação Capacitor | 1-2 dias | Android Studio instalado |
| Fase 2 — FCM Notifications | 2-3 dias | Conta Firebase |
| Fase 3 — In-App Purchase | 3-4 dias | Conta RevenueCat + Play Console + produtos criados |
| Fase 4 — Polimento nativo | 2-3 dias | — |
| Fase 5 — Preparação Play Store | 2-3 dias | Conta desenvolvedor Google (USD 25) |
| Fase 6 — Publicação | 1-2 dias + revisão Google (1-7 dias) | — |
| **Total estimado** | **11-17 dias de desenvolvimento** | + tempo de aprovação Google |

---

## Checklist Geral

### FASE 1 — Fundação Capacitor
- [ ] Instalar `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- [ ] Instalar `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/keyboard`, `@capacitor/splash-screen`
- [ ] Criar `capacitor.config.ts` com appId `com.dosyapp.dosy`
- [ ] Adicionar scripts `build:android`, `open:android` no `package.json`
- [ ] Instalar `@capacitor/preferences`
- [ ] Migrar Supabase `auth.storage` de localStorage para Capacitor Preferences
- [ ] Adicionar `detectSessionInUrl: false` no Supabase client
- [ ] Implementar handler do botão Voltar Android em `App.jsx`
- [ ] Implementar reconexão do Realtime em `useRealtime.js` (pause/resume)
- [ ] Executar `npx cap add android`
- [ ] Executar `npm run build && npx cap sync android`
- [ ] Testar app abrindo no emulador Android (API 26+)
- [ ] Testar app em dispositivo físico
- [ ] Confirmar Login/auth funcionando no Android

### FASE 2 — Notificações FCM
- [ ] Criar projeto no Firebase Console
- [ ] Adicionar app Android `com.dosyapp.dosy` no Firebase
- [ ] Baixar `google-services.json` → colocar em `android/app/`
- [ ] Instalar `@capacitor/push-notifications` e `@capacitor/local-notifications`
- [ ] Configurar PushNotifications e LocalNotifications no `capacitor.config.ts`
- [ ] Reescrever `usePushNotifications.js` com lógica isNative/web
- [ ] Adicionar migration SQL: colunas `deviceToken` e `platform` em `push_subscriptions`
- [ ] Reescrever Edge Function `notify-doses` para suportar FCM (Firebase Admin SDK)
- [ ] Adicionar secrets Firebase no painel Supabase
- [ ] Testar notificação local (LocalNotifications) no Android
- [ ] Testar push server-side (FCM) no Android
- [ ] Confirmar snooze funciona no nativo

### FASE 3 — Monetização
- [ ] Criar conta RevenueCat
- [ ] Criar conta Google Play Console (USD 25)
- [ ] Criar produtos no Play Console: `dosy_pro_monthly` e `dosy_pro_yearly`
- [ ] Conectar Play Console ao RevenueCat via chave de serviço
- [ ] Instalar `@revenuecat/purchases-capacitor`
- [ ] Criar `src/hooks/useInAppPurchase.js`
- [ ] Atualizar `PaywallModal.jsx` com botões de compra reais
- [ ] Adicionar botão "Restaurar compras" (obrigatório Google Play)
- [ ] Testar fluxo de compra em ambiente de teste do Play Store
- [ ] Testar restauração de compra
- [ ] (Opcional) Configurar webhook RevenueCat → Supabase para renovações

### FASE 4 — Polimento Nativo
- [ ] Instalar `jspdf` e `html2canvas`
- [ ] Substituir `window.print()` por jsPDF em `Reports.jsx`
- [ ] Instalar `@capacitor/filesystem` e `@capacitor/share`
- [ ] Adaptar exportação CSV para Android (Filesystem + Share)
- [ ] Instalar `@capacitor-community/admob`
- [ ] Criar lógica condicional AdSense (web) / AdMob (nativo) em `AdBanner.jsx`
- [ ] Criar assets de ícone: `resources/icon.png` (1024×1024) e `resources/splash.png`
- [ ] Criar `resources/icon-foreground.png` para adaptive icon (108×108)
- [ ] Executar `npx @capacitor/assets generate --android`
- [ ] Configurar StatusBar dark `#0d1535` na inicialização
- [ ] Testar safe area em dispositivos com notch
- [ ] Configurar deep links em AndroidManifest.xml
- [ ] Testar performance geral no Android (scroll, animações)

### FASE 5 — Preparação Play Store
- [ ] Criar/hospedar página de Política de Privacidade (`/privacidade`)
- [ ] Criar/hospedar página de Termos de Uso (`/termos`)
- [ ] Adicionar rotas `/privacidade` e `/termos` no `App.jsx`
- [ ] Preencher questionário IARC no Play Console
- [ ] Preencher declaração de saúde (se aplicável)
- [ ] Gerar keystore de release (`keytool -genkey ...`)
- [ ] Fazer backup do keystore em 3 locais seguros
- [ ] Configurar `android/app/build.gradle` com signingConfig
- [ ] Gerar primeiro `.aab` de release
- [ ] Tirar screenshots: Dashboard, DoseModal, Relatório, Settings, Pacientes (1080×1920)
- [ ] Criar Feature Graphic (1024×500px)
- [ ] Escrever descrição curta (máx 80 chars)
- [ ] Escrever descrição longa (máx 4000 chars)
- [ ] Configurar preços: gratuito (download) + PRO Mensal + PRO Anual

### FASE 6 — Publicação
- [ ] Upload AAB no track de Testes Internos
- [ ] Testar com grupo de testadores internos (mínimo 2-3 dispositivos)
- [ ] Corrigir bugs encontrados no teste interno
- [ ] Subir para Closed Testing (beta)
- [ ] Aguardar aprovação Google (1-7 dias)
- [ ] Publicar em produção com rollout gradual (10%)
- [ ] Expandir rollout para 100%
- [ ] Configurar GitHub Actions para CI/CD de releases
- [ ] Monitorar Android Vitals e crashes na primeira semana
- [ ] Responder primeiros reviews
