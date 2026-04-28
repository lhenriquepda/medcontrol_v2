# Auditoria 4.5.1 — Código & Arquitetura

> **Tipo:** read-only. Nenhum código alterado.
> **Data:** 2026-04-28
> **Versão auditada:** 0.1.5.6 (versionCode 11)
> **Stack:** React 19 + Vite 5 + Tailwind 3 + TanStack Query 5 + Capacitor 8 + Supabase 2

---

## 📊 Pontuação de Risco

| Dimensão | Score (0-10) | Nota |
|---|---|---|
| Arquitetura geral | 7 | Limpa, separação service/hook/component clara |
| Segurança DB (RLS + RPCs) | 8 | RLS audit feito, RPCs SECURITY DEFINER corretas |
| Bundle size & performance | 4 | 716KB main monolítico, jspdf+html2canvas eager |
| Resiliência client (errors, retry) | 4 | Sem ErrorBoundary, retry inconsistente |
| Type safety | 3 | Projeto JS puro, sem TS, sem JSDoc rigoroso |
| Testes automatizados | 1 | ZERO testes |
| Vulnerabilidades dependências | 5 | 12 vulns (4 mod, 8 high) — concentradas em devDeps Capacitor |
| Observability | 6 | Sentry integrado com PII strip; sem PostHog/source maps |
| **Score global** | **5.5** | — |

---

## 🔍 Inventário

### Arquivos por categoria
- **8.935 linhas JS/JSX** total em `src/`
- 18 pages (3.373 LOC) — maiores: `Settings.jsx` 465, `Reports.jsx` 330, `Dashboard.jsx` 322, `TreatmentForm.jsx` 286, `DoseHistory.jsx` 256
- 24 components (2.409 LOC) — maiores: `PermissionsOnboarding` 246, `FilterBar` 217, `Icon` 193, `MedNameInput` 186, `MultiDoseModal` 175
- 9 services (1.391 LOC) — maior: `notifications.js` 581 (refatorado v1.0.5.5)
- 14 hooks (920 LOC)
- 6 utils (162 LOC)

### Edge Functions
| Função | LOC | Propósito |
|---|---|---|
| `delete-account` | 73 | LGPD hard-delete + auth.users wipe |
| `notify-doses` | 241 | FCM HTTP v1 + JWT OAuth, batch send |
| `send-test-push` | 119 | Admin tool — POST email do alvo |

### Supabase queries — RPCs (server-side)
| RPC | Arquivo | Tipo |
|---|---|---|
| `extend_continuous_treatments` | Dashboard.jsx | Cron-like sliding window |
| `confirm_dose` | dosesService.js | Status transition |
| `skip_dose` | dosesService.js | Status transition |
| `undo_dose` | dosesService.js | Status transition |
| `register_sos_dose` | dosesService.js | SOS validation server-side |
| `create_treatment_with_doses` | treatmentsService.js | Atomic insert |
| `update_treatment_schedule` | treatmentsService.js | Atomic regen |
| `list_patient_shares` | sharesService.js | Read |
| `share_patient_by_email` | sharesService.js | Insert with email lookup |
| `unshare_patient` | sharesService.js | Delete |
| `my_tier` | subscriptionService.js | Tier resolver |
| `admin_list_users` | subscriptionService.js | Admin only |
| `admin_grant_tier` | subscriptionService.js | Admin only + audit log |
| `upsert_push_subscription` | notifications.js | Cross-user device transfer |

### Supabase queries — SELECT/UPDATE direto
| Tabela | Operação | Arquivo |
|---|---|---|
| `patients` | SELECT/INSERT/UPDATE/DELETE | patientsService.js |
| `treatments` | SELECT/DELETE | treatmentsService.js (mutations via RPC) |
| `treatment_templates` | SELECT/INSERT | treatmentsService.js |
| `doses` | SELECT (paginated) | dosesService.js (mutations via RPC) |
| `sos_rules` | SELECT/INSERT/UPDATE | dosesService.js |
| `subscriptions` | SELECT (own tier) | Settings.jsx (export data) |
| `push_subscriptions` | SELECT/UPSERT/DELETE | notifications.js |
| `user_prefs` | SELECT/UPSERT | useUserPrefs.js |

---

## 🚩 Gaps Identificados

### CRÍTICO (P0 — bloqueia launch)

#### G1. Bundle monolítico 716KB (sem code splitting)
- `dist/assets/index-*.js` = **716KB** (gzip 206KB)
- `jspdf.es.min` = **390KB** (eager loaded — só usado em /relatorios)
- `html2canvas` = **202KB** (eager loaded — só usado em /relatorios)
- `index.es` (purify dep) = **151KB** (eager)
- Nenhum `React.lazy`, nenhum `import()` dynamic
- **Impacto:** time-to-interactive alto em 3G/dispositivos lentos. Lighthouse mobile não vai bater 90.

#### G2. Zero testes automatizados
- Sem Vitest, sem Jest, sem Testing Library, sem Playwright
- Funções críticas sem cobertura: `generateDoses`, `dateUtils`, `validateSos`, `services/notifications.js` (DND helper, group, schedule)
- **Impacto:** toda mudança = roleta russa. Refactor recente do notifications.js (557→430 linhas) não validado por testes — apenas smoke test manual.

#### G3. 12 vulnerabilidades npm (8 high, 4 moderate)
- Concentradas em devDeps: `@capacitor/assets` → `@trapezedev/project` → `@xmldom/xmldom`, `tar`, `xcode/uuid`
- **Impacto:** medium — afeta build pipeline, não runtime. Mas alguns CIs (GitHub Actions, Snyk) bloqueiam build.
- `npm audit fix --force` provavelmente quebra `@capacitor/assets` (sem fix disponível na cadeia direta).

### ALTO (P1 — antes do beta)

#### G4. Sem ErrorBoundary global
- Erro em qualquer componente derruba a página inteira (white screen)
- Sentry capturaria, mas user vê crash bruto sem fallback amigável
- **Impacto:** UX terrível em prod. App de saúde não pode dar white screen.

#### G5. 42 `console.log/warn/error` no bundle prod
- 9 arquivos: `App.jsx` (8), `notifications.js` (18), `PermissionsOnboarding` (3), `Dashboard` (3), `useUserPrefs` (5), etc.
- Nenhum strip no Vite build
- **Impacto:** logs em produção (logcat flood, leak de dados em DevTools), bundle maior

#### G6. Retry inconsistente em mutations TanStack
- Não há config global de retry em `QueryClient`
- Mutations falham silenciosamente em rede ruim
- **Impacto:** dose marcada como Tomada pode perder se rede flutua. Crítico em saúde.

#### G7. `validateSos` ainda roda no client (`dosesService.js:153`)
- Comentário no código: SOS migrado pra RPC. Mas `validateSos()` continua chamado em `SOS.jsx:49` ANTES de `register_sos_dose` RPC.
- Validação dupla: client (UX feedback) + server (RPC enforcement). Server tem trigger bloqueando bypass.
- **Status:** OK na prática (server enforça), mas código duplicado sugere risco. Verify se RPC retorna erro estruturado pra UX.

#### G8. `Settings.jsx` 465 linhas — god component
- Auth, theme, push perms, DND, daily summary, alarme crítico, export data, delete account, version check, name update — tudo num só arquivo
- **Impacto:** difícil manter, bug em uma seção quebra tudo.

#### G9. `notifications.js` 581 linhas
- Refatorado v1.0.5.5 (positivo — single source of truth). Mas crescimento contínuo.
- Sem extração de regras de negócio puras pra módulo testável separado.

### MÉDIO (P2 — pode esperar)

#### G10. Sem TypeScript / JSDoc rigoroso
- Projeto JS puro. Refactors arriscados sem checagem estática.
- Migração TS = trabalho grande (300+ arquivos). Alternativa: JSDoc + tsc no CI em modo `checkJs`.

#### G11. `mockStore.js` 205 linhas mantido sem uso ativo
- Modo demo (sem Supabase). Adiciona ~5KB ao bundle, código duplica caminhos service.
- Avaliar: ainda usado? Se não, remover. Se sim, lazy-load só em demo.

#### G12. Hardcoded paths em queries
- `Settings.jsx:117-119` faz 3 SELECTs separados pra export. Poderia ser 1 RPC.
- Risco baixo (rate limiting Supabase), mas N+1 anti-pattern.

#### G13. Sem manualChunks no Vite
- `rollupOptions.output.manualChunks` não configurado
- Vendor chunk não separado de app code → atualização de app invalida vendor cache

#### G14. Sem source maps Sentry upload no build
- Crashes em prod chegam minified, sem context
- Plugin `@sentry/vite-plugin` não instalado

### BAIXO (P3 — backlog pós-launch)

#### G15. `dosy_alarm.mp3` ausente
- Plano 2.5 marca opcional. Fallback usa `RingtoneManager.TYPE_ALARM`. Funciona, mas brand custom seria bonus.

#### G16. `Plan-detalhado-backup.md` 2285 linhas no repo
- Backup do plano antigo antes de virar checklist. Pode crescer e poluir grep. Avaliar mover pra `docs/archive/`.

#### G17. `CONTINUOUS_DAYS` mágico em `treatmentsService.js`
- Constante hardcoded. Já tem rolling window (5d). Avaliar parametrizar.

---

## 🎯 Top 10 Recomendações Priorizadas

| # | Ação | Severidade | Esforço | Quando |
|---|---|---|---|---|
| 1 | Code splitting (`React.lazy` por rota) + dynamic import jspdf/html2canvas | P0 | M | Antes Beta |
| 2 | Setup Vitest + tests críticos (`generateDoses`, `dateUtils`, `validateSos`, `notifications.inDnd/groupByMinute`) | P0 | M | Antes Beta |
| 3 | ErrorBoundary global + integração Sentry capture | P1 | S | Antes Beta |
| 4 | Vite plugin `vite-plugin-remove-console` em mode=production | P1 | XS | Imediato |
| 5 | Config retry global em `QueryClient` (3x exponential backoff) | P1 | XS | Imediato |
| 6 | `@sentry/vite-plugin` upload de source maps | P1 | S | Antes Beta |
| 7 | Refatorar `Settings.jsx` em sub-componentes (`SettingsAppearance`, `SettingsNotifs`, `SettingsAccount`, `SettingsAbout`) | P1 | M | Antes Beta |
| 8 | `npm audit fix` (não-breaking) + avaliar removal de `@capacitor/assets` se não usado | P1 | S | Imediato |
| 9 | Vite `manualChunks` separando vendor/react/supabase | P2 | S | Antes Beta |
| 10 | JSDoc + `tsc --checkJs` no CI (TS-lite) | P2 | M | Antes Beta |

**Esforço:** XS=<1h · S=2-4h · M=1-2 dias · L=3-5 dias

---

## 📈 Métricas Atuais (snapshot)

```
Bundle (dist/assets/):
├── index-*.js              716 KB  (gzip 206 KB)  ⚠️
├── jspdf.es.min            390 KB  (eager — só /relatorios)  ⚠️
├── html2canvas             202 KB  (eager — só /relatorios)  ⚠️
├── index.es (purify dep)   151 KB
├── index-*.css              49 KB
├── purify.es                24 KB
└── outros (web/native chunks) <10KB cada

Total dist:                 ~2.0 MB
Tamanho APK release:        12.3 MB
LOC src/:                   8.935 linhas
Console statements:         42 (em 9 arquivos)
Vulnerabilidades npm:       12 (8 high + 4 mod)
Edge Functions:             3 (delete-account, notify-doses, send-test-push)
RPCs SECURITY DEFINER:      ~14 mapeadas
Cobertura testes:           0% ❌
ErrorBoundary:              ❌
PostHog/product analytics:  ❌
Source maps Sentry:         ❌ (configurado mas sem upload)
```

---

## 📋 Arquivos auditados

- `src/services/{auth, supabase, dosesService, treatmentsService, patientsService, sharesService, subscriptionService, notifications, criticalAlarm, mockStore}`
- `src/hooks/*` (todos)
- `src/utils/*` (todos)
- `src/pages/*` (size scan)
- `src/components/*` (size scan)
- `supabase/functions/*` (3 funções, 433 LOC total)
- `vite.config.js`, `package.json`, `.env.example`
- `tools/` (22 utility scripts)
- `dist/` (bundle output v0.1.5.6)

---

## 🔄 Próximos passos (NÃO desta auditoria)

Achados desta auditoria devem ser propagados em `Plan.md` na FASE 4.6 (consolidação) — criar sub-fases concretas:

- **FASE 4.8 — Quality refactor** (G1, G4, G5, G6, G7, G8, G14): code splitting, ErrorBoundary, strip console, retry global, source maps, Settings refactor
- **FASE 4.11 — Tests setup** (G2): Vitest + cobertura critical utils
- **FASE 4.10 — Performance** (G1, G13): manualChunks, lazy load
- **FASE 0.4 — DB hardening v2** (após 4.5.2 RLS audit): G7 confirmação validateSos
- Backlog (G10, G11, G15, G16, G17): pós-launch

Auditorias seguintes (4.5.2 DB/RLS, 4.5.3 UX/A11y, 4.5.4 Mobile Security, etc) podem revelar gaps adicionais que se cruzam com estes — consolidação final em FASE 4.6.
