# e2e/ — Appium WebdriverIO suite (MEL-006)

> Estrutura criada v0.2.6.11 (2026-05-24). Setup mínimo funcional.
> Specs adicionais (Mod 01-13) portadas incrementalmente conforme uso.

## Filosofia

Substitui scripts ad-hoc `scripts/qa-v0266/*.mjs` por suite estruturada via wdio. Helpers reusáveis em `e2e/helpers/`, specs por módulo em `e2e/specs/`.

**Não substitui** o roteiro QA exaustivo em `docs/roteiro_QA_Exaustivo/`. Roteiro = documentação de cenários esperados (humano). e2e/ = executores automatizados de subset desses cenários.

## Pré-requisitos

```bash
npm install -D @wdio/cli @wdio/local-runner @wdio/mocha-framework \
  @wdio/spec-reporter @wdio/appium-service appium @appium/uiautomator2-driver
```

Emulator rodando: `emulator -avd Pixel_8_API_36 -no-snapshot -no-boot-anim`.
ADB visível: `adb devices` deve listar `emulator-5554` device.

## Rodar

```bash
cd e2e
npm run e2e             # roda tudo
npm run e2e -- --spec specs/01-auth.spec.mjs  # spec único
```

## Estrutura

```
e2e/
  README.md                    # este arquivo
  package.json                 # scripts + deps wdio
  wdio.conf.mjs                # config 2 capabilities (emul-5554 + emul-5556)
  helpers/
    auth.mjs                   # loginAs(driver, email, password)
    webview.mjs                # inWebView(driver, fn) wrapper switchContext
    adbWrap.mjs                # tap, swipe, keyevent via adb (mobile: fallback)
    dismissTour.mjs            # auto-dismiss onboarding/tour
  specs/
    01-auth.spec.mjs           # smoke login + dashboard render
    # 02-13 portados incrementalmente
```

## Decisão MEL-008 relacionada

Hybrid switch + `mobile:` commands (vs `autoWebview: true`) — ver `context/recipes/autowebview-spike-decision.md`.

## Status implementação

- [x] Estrutura base (este commit v0.2.6.11)
- [x] wdio.conf.mjs com 2 capabilities
- [x] helpers core (auth, webview, adbWrap, dismissTour)
- [x] spec smoke 01-auth
- [ ] specs 02-13 (incremental, conforme demanda QA)
- [ ] CI integration (ver `.github/workflows/qa-android-smoke.yml` v0.2.6.11)
