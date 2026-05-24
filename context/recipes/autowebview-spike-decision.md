# MEL-008 — Decisão FINAL: Appium autoWebview híbrido

> v0.2.6.11 — fecha item MEL-008 do `_MELHORIAS.md`.
> Status: DECISÃO TOMADA — **não vamos investigar autoWebview**. Item fechado, sem ação adicional.

## Contexto

`scripts/qa-v0266/appium-runner.mjs` linha 41 usa `appium:autoWebview: false` + `driver.switchContext()` manual antes de cada operação DOM em hybrid Capacitor app.

MEL-008 sugeria spike de `appium:autoWebview: true` + `appium:browserName: 'chromedriver'` pra simplificar — Selenium-style finds funcionariam sem hybrid switch manual.

## Análise (decisão final)

**Não fazemos o spike por 3 razões**:

1. **Hybrid switch atual funciona**: `inWebView(driver, fn)` helper em `e2e/helpers/webview.mjs` (criado pelo MEL-006 v0.2.6.11) encapsula `switchContext` → wrapper pattern bem estabelecido. Zero flakiness em sessões 2h+ de QA real (validado v0.2.6.6+).

2. **`mobile:` commands são necessários**: usamos `mobile: clickGesture`, `mobile: swipeGesture`, `mobile: scrollGesture` em vários cenários (DoseCard swipe Tomada/Pular, PullToRefresh, BottomNav navigation). `autoWebview: true` força sessão WEBVIEW que **perde acesso** a esses comandos nativos — quebra mais que conserta.

3. **Diminishing returns**: economia esperada ~10-20% de boilerplate `switchContext` calls. Custo: 4-6h spike + risco regressão em 13+ specs já estabilizados.

## Decisão

**MEL-008 FECHADO sem ação**. Pattern hybrid switch + `mobile:` commands é o approach estabelecido. Re-avaliar apenas se Appium 3.x mudar a semântica do `autoWebview` capability.

## Histórico

- Item criado: _MELHORIAS.md QA real v0.2.6.6 (2026-05-24)
- Marcado deferido: v0.2.6.8 (2026-05-24)
- Decisão final: v0.2.6.11 (2026-05-24) — este documento
