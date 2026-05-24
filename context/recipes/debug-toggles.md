# Receita — Debug toggles `window.__dosy*`

> v0.2.6.8 (MEL-002): catálogo dos toggles globais disponíveis no app pra debug + QA automatizado. Setados via Chrome DevTools console (web), Capacitor LiveReload (emulator) ou Sentry breadcrumb (release).

---

## Visão geral

Cada toggle vive em `window.__dosy*`. Quando usar:
- **Dev**: console DevTools pra inspecionar estado.
- **QA automatizado**: setar antes do flow pra forçar branch específico (tier free vs plus, force update, etc).
- **Suporte user**: pedir pra user setar valor + reportar comportamento (raríssimo, só Sentry).

---

## Tabela de toggles

| Toggle | Tipo | Setado por | Lido por | Propósito |
|---|---|---|---|---|
| `__dosyAdMobShown` | boolean | `useAdMobBanner.js` | QA probe | Indica se banner AdMob carregou. QA usa pra esperar banner pronto antes de medir `--ad-banner-height`. |
| `__dosySystemStatusBarHeight` | number (px) | `MainActivity.java` via `evaluateJavascript` | CSS `--system-status-bar-height` | Altura real do status bar Android (vem do WindowInsets). Web usa fallback 30dp se null. |
| `__dosyForceUpdate` | boolean | user/QA console | `useAppUpdate.js` | Força UpdateBanner aparecer mesmo se vc no-op. Test path "atualização disponível". |
| `__dosyForceMandatory` | boolean | user/QA console | `useAppUpdate.js` | Força banner em modo mandatory (não pode dismissar). Test path update obrigatório. |
| `__dosyForceFallback` | boolean | user/QA console | `useFcm.js` ou similar | Força fallback path (ex: tray notification em vez de full-screen alarm). |
| `__dosyOnline` | boolean \| null | usuário (ou null inicialmente) | `useOnlineStatus.js` | Override status network. `true` = forçar online (esconde OfflineBanner), `false` = forçar offline (banner + queue mutations). Null = comportamento normal. |
| `__dosyPendingPatientId` | uuid string | cold-start handler universal link | `App.jsx::useEffect` | Patient ID a abrir após autenticar (deep link entrada). Limpado após uso. |
| `__dosyPendingUnsharePatientId` | uuid string | universal link `/unshare?id=...` | `PatientDetail.jsx` | Patient ID a remover share automaticamente após cold-start. Limpado após mutation. |

---

## Cenários comuns

### Forçar UpdateBanner mandatory pra screenshot

```js
window.__dosyForceUpdate = true
window.__dosyForceMandatory = true
// Re-trigger useAppUpdate check:
document.dispatchEvent(new Event('visibilitychange'))
```

### Simular offline em QA

```js
window.__dosyOnline = false  // Mostra OfflineBanner + paused queries
// ... fazer ações que devem ficar na queue ...
window.__dosyOnline = true   // Drain mutation queue + refetch
```

### Inspecionar AdMob load state

```js
// Logo após abrir Dashboard:
console.log({
  shown: window.__dosyAdMobShown,
  height: getComputedStyle(document.documentElement).getPropertyValue('--ad-banner-height')
})
// Ad shown=true + height>0 → banner carregou ok.
```

### Verificar status bar height nativo

```js
console.log({
  toggle: window.__dosySystemStatusBarHeight,
  cssVar: getComputedStyle(document.documentElement).getPropertyValue('--system-status-bar-height')
})
// Esperado: 84px (Pixel 8 API 36 com gesture nav).
```

---

## Como inspectar no emulator (release build)

Release builds têm PrivacyScreen FLAG_SECURE — bloqueia adb screencap. Use Chrome DevTools via `chrome://inspect/#devices` apontando pra WebView Capacitor.

1. `adb forward tcp:9229 localabstract:chrome_devtools_remote`
2. Abrir `chrome://inspect/#devices` no Chrome desktop
3. Click "inspect" na WebView do app
4. Console direto.

---

## Não confundir com state global de prod

Os toggles `__dosy*` são DEBUG only. Estado real do app vive em:
- React Query cache: `window.__queryClient` (se exposto pelo `main.jsx`)
- React state: usar React DevTools
- Sentry breadcrumbs: `Sentry.getCurrentHub().getScope().getBreadcrumbs()`
- Capacitor plugins: `Capacitor.Plugins.<PluginName>` (ex: `CriticalAlarm`, `AdMob`)

**NUNCA** usar toggles `__dosy*` pra alterar comportamento prod do user. São pra debugging interno.
