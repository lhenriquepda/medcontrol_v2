# Auditoria 4.5.7 — Observability

> **Tipo:** read-only
> **Data:** 2026-04-28

## Score: 5/10

| Dimensão | Score | Nota |
|---|---|---|
| Sentry integrado | 9 | `@sentry/react` + `@sentry/capacitor` em main.jsx + `beforeSend` PII strip ✓ |
| Sentry source maps upload | 0 | Sem `@sentry/vite-plugin` — crashes minified em prod |
| Sentry release tagging | 0 | `release` não setado — não dá pra correlacionar crash com versão |
| Sentry dist tagging | 0 | `dist` não setado |
| Sentry ignoreErrors filter | 9 | Filtra rede comum (Network/fetch failed) ✓ |
| `tracesSampleRate` | 8 | 0.1 (10%) — razoável |
| ErrorBoundary wrap | 0 | Sem `<Sentry.ErrorBoundary>` no tree |
| PostHog product analytics | 0 | Não integrado |
| Feature flags | 0 | Sem feature flag system |
| Funil paywall metrics | 0 | view → click → checkout → success não tracked |
| Eventos críticos custom | 0 | dose_confirmed/skipped/alarm_fired não emitidos |
| Dashboards retention/DAU | 0 | Sem PostHog/Mixpanel/Firebase Analytics |
| Crash-free rate target | ? | Sem alerting Sentry |
| ANR rate (Android) | ? | Disponível Play Console pós-launch |
| Logs estruturados | 5 | console.log/warn/error usado, sem schema (logflare/axiom não integrados) |

## Sentry config atual (main.jsx)
```js
{
  dsn: VITE_SENTRY_DSN,
  environment: MODE,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Strip PII: email, username, ip, request body
  },
  ignoreErrors: ['Network request failed', 'NetworkError', 'Load failed', 'Failed to fetch']
}
```

✓ Pontos fortes:
- LGPD-aware PII strip
- Native + web inicialização correta (`SentryCapacitor.init` vs `Sentry.init`)
- Só ativa em PROD (`if (SENTRY_DSN && import.meta.env.PROD)`)

## Gaps

### CRÍTICO (P0)
- **G1.** Source maps NÃO uploadados. Stack traces em prod chegam minified (`a1.b2.c3:35`), inúteis pra debug. Daily-money 0.3.5 / FASE 4.5.13 alvo.

### ALTO (P1)
- **G2.** Sem `<Sentry.ErrorBoundary>` no React tree. Crashes não-rede não são capturados. White screen sem reportar.
- **G3.** Sem `release` config — Sentry não correlaciona crashes com versão (0.1.5.6 vs 1.0.0). Difícil saber se crash é regressão.
- **G4.** ZERO PostHog. Sem product analytics:
  - Não sabemos quantos users ativam alarme crítico
  - Não sabemos onde users desistem do onboarding
  - Não sabemos taxa de conversão Free → PRO
  - Lançar Play Store sem isso = voar cego
- **G5.** Sem feature flags. Toggle novos features pra subset de users em prod = sem mecanismo (precisa redeploy).
- **G6.** Sem dashboards: DAU, MAU, retention D1/D7/D30, churn, ARPU. FASE 9 critério de saída exige ≥40% D7 retention — sem medir.

### MÉDIO (P2)
- **G7.** Sem alerting Sentry pra spike de crashes. Regressão crítica em launch passa despercebida nas primeiras horas.
- **G8.** Sem session replay (Sentry/PostHog). Difícil reproduzir bugs reportados por user.
- **G9.** Eventos custom críticos não emitidos:
  - `dose_confirmed`, `dose_skipped`, `alarm_fired` (validar funil Sotomada)
  - `notification_permission_granted/denied`
  - `paywall_shown`, `paywall_clicked`, `upgrade_complete`
  - `share_patient_invite_sent/accepted`

### BAIXO (P3)
- **G10.** Sem tracing distributed (Sentry traces não correlacionam web → Edge Function → DB).
- **G11.** Sem logs estruturados (logflare/axiom). Console-only debug em prod.
- **G12.** Sem APM (Application Performance Monitoring) custom — confiando só em Sentry traces 10%.

## Top 7 Recomendações
1. **`@sentry/vite-plugin`** upload source maps + release tag (`pkg.version`) (S) — P0 antes Beta
2. **`<Sentry.ErrorBoundary>`** wrapping App em main.jsx + fallback UI (XS) — P1
3. **PostHog SDK** + eventos críticos (`dose_confirmed`, `paywall_*`) (M) — P1 antes Beta
4. **Sentry alerting**: crash spike, error rate threshold (XS, config dashboard) — P1
5. **Métricas-alvo lançamento documented**: crash-free ≥99.5%, ANR <0.5%, retention D7 ≥40% (XS) — P1
6. **Session replay** (Sentry Replay ou PostHog) opcional (S) — P2
7. **Logs estruturados** Logflare ou Axiom (S) — P3 pós-launch

## Métricas críticas pra dashboard launch
- Crash-free rate (alvo ≥99.5%)
- ANR rate (alvo <0.5%, Android Vitals)
- Retention D1/D7/D30
- DAU/MAU
- Funnel: install → onboarding complete → first dose confirmed
- Conversion: Free → PRO
- Notif permission grant rate
- Critical alarm enabled rate (default ON, mas usuário pode desativar)
