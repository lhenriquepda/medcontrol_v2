# Métricas-alvo Launch — Dosy

> Métricas operacionais e de produto pra monitorar nas primeiras semanas pós-launch.
> Fonte: Sentry (técnicas) + PostHog (produto) + Google Play Console (Android Vitals).

---

## 🎯 Critérios de saída Beta (FASE 21)

Pra avançar Beta Aberto → produção rollout:

| Métrica | Alvo | Fonte |
|---|---|---|
| Crash-free rate | ≥99.5% | Sentry / Android Vitals |
| ANR rate (Android) | <0.5% | Android Vitals |
| Retention D1 | ≥60% | PostHog |
| Retention D7 | ≥40% | PostHog |
| Retention D30 | ≥25% | PostHog |
| Avaliação média Play Store | ≥4.3 | Play Console |
| Notificação permission grant rate | ≥75% | PostHog (`notification_permission_granted` / total tentativas) |
| Onboarding completion rate | ≥70% | PostHog (`onboarding_tour_completed`) |

---

## 📊 Dashboards

### Sentry
- **Crash-free sessions** (24h, 7d) — alvo ≥99.5%
- **Top issues** (last 24h) — triagem diária
- **Performance** (Web Vitals: LCP, FID, CLS) — alvo verde
- **Releases** — comparar crash rate por versão (`dosy@0.1.5.X`)

### PostHog
- **DAU / MAU** — usuários ativos
- **Retention cohorts** — D1/D7/D30 por install date
- **Funil paywall**: `paywall_shown` → `paywall_clicked_plan` → `upgrade_checkout_started` → `upgrade_complete`
- **Funil onboarding**: `app_open_first` → `permissions_granted` → `patient_created` → `treatment_created` → `dose_confirmed`
- **Ações por user**: avg `dose_confirmed/day`, avg `dose_skipped/day`
- **Critical alarm enabled**: % users com `critical_alarm_toggled` ON
- **DND adoption**: % users com `dnd_toggled` ON

### Android Vitals (Play Console)
- **ANR rate** (alvo <0.5%)
- **Crash rate** (alvo <2%)
- **Slow rendering** (alvo <5%)
- **Wakeups** (alvo <10/h)

---

## 🚨 Alerting (Sentry)

Configurar em https://lhp-tech.sentry.io/alerts/rules/dosy/ :

1. **Crash spike**: error rate >5/min por 10min → email + Slack
2. **New issue regression**: issue resolvida reapareceu → notify
3. **Edge Function failures**: `notify-doses` `delete-account` exceção → notify
4. **Performance degradação**: P95 transaction >3s → notify

---

## 📋 Eventos custom catalog

Centralizado em `src/services/analytics.js` (export `EVENTS`).

| Evento | Quando dispara | Props |
|---|---|---|
| `dose_confirmed` | User confirma dose | (none — PII strip) |
| `dose_skipped` | User pula dose | (none) |
| `dose_undone` | Undo após confirmar/pular | (none) |
| `sos_dose_registered` | Dose SOS criada | (none) |
| `alarm_fired` | Critical alarm dispara | TBD wire up native plugin |
| `notification_permission_granted` | Permissão concedida | platform: 'android'\|'web' |
| `notification_permission_denied` | Permissão negada | platform |
| `critical_alarm_toggled` | Toggle Settings | enabled: bool |
| `dnd_toggled` | Toggle DND | enabled: bool |
| `paywall_shown` | PaywallModal montado | reason: string |
| `paywall_clicked_plan` | Click botão plano | plan: 'monthly'\|'yearly' |
| `upgrade_complete` | Compra concluída | plan |
| `patient_created` | Patient cadastrado | (none) |
| `patient_deleted` | Patient deletado | (none) |
| `treatment_created` | Treatment cadastrado | (none) |
| `treatment_deleted` | Treatment deletado | (none) |
| `share_patient_invite_sent` | Convite share enviado | TBD |
| `account_deleted` | Conta deletada | (none) |
| `data_exported` | Export LGPD | TBD |

---

## 🔒 LGPD compliance

- **PII strip** automático em `analytics.js` (`sanitize_properties`):
  - Remove: email, name, observation, medName, patientName, doctor, allergies, condition
- **Session replay** desabilitado (`disable_session_recording: true`)
- **Mask all text** desativado pra não expor (input opcional não captura por padrão)
- **User identifier**: apenas `auth.uid()` (UUID anônimo, sem email)

Se ANPD solicitar, eventos PostHog não contém dado pessoal de saúde.
