# 05 — Análise de Código (custos/cache, dependências, código morto)

> Cobre Dimensões 22, 23 e 24 do prompt original.
> **Data:** 2026-05-01 · **Versão:** 0.1.6.9 @ `5bb9d36`

---

## 1. Estatísticas gerais

- **LOC total `src/`:** ~12.133 linhas em 95 arquivos `.js/.jsx`
- **TypeScript:** 0 arquivos `.ts/.tsx` (projeto 100% JavaScript)
- **Diretórios:** `pages/` (19 arq, ~4.067 LOC), `components/` (28, ~2.833), `hooks/` (20, ~1.600), `services/` (12, ~1.617), `data/`, `utils/`, `styles/`
- **God-components (>300 LOC):**
  - `pages/Settings.jsx` — 541 LOC
  - `pages/Reports.jsx` — 436 LOC
  - `pages/Dashboard.jsx` — 382 LOC
  - `services/notifications.js` — 588 LOC (god-service)
  - `pages/TreatmentForm.jsx` — 310 LOC
- **Tests:** 6 unit tests (`utils/*.test.js`, `services/dosesService.test.js`, `services/notifications.test.js`) — 66/66 passando, coverage utils 88%

---

## 2. Dependências (package.json)

### 2.1 Inventário

- **Prod:** 35 pacotes
- **Dev:** 22 pacotes
- **Total:** 57

### 2.2 Categorias

| Categoria | Pacotes | Notas |
|---|---|---|
| Core React | `react@19`, `react-dom@19`, `react-router-dom@6.26` | ✅ Atualizado |
| Data | `@supabase/supabase-js@2.45`, `@tanstack/react-query@5.51`, `@tanstack/react-query-persist-client@5.100`, `@tanstack/query-sync-storage-persister`, `@tanstack/react-virtual@3.13` | ✅ |
| Capacitor first-party | `@capacitor/{core,android,app,browser,cli,filesystem,keyboard,local-notifications,network,push-notifications,share,splash-screen,status-bar}@8.x` | ✅ |
| Capacitor community | `@aparajita/capacitor-biometric-auth@10`, `@aparajita/capacitor-secure-storage@8`, `@capacitor-community/admob@8`, `@capacitor-community/privacy-screen@8`, `@capawesome/capacitor-app-update@8` | ⚠️ admob: último release dez/2023 |
| Observability | `@sentry/capacitor@3.2`, `@sentry/react@10.43`, `posthog-js@1.372` | ✅ |
| UI helpers | `framer-motion@11`, `lucide-react@1.11`, `focus-trap-react@12`, `react-swipeable@7`, `react-simple-pull-to-refresh@1.3` | ✅ |
| PDF/Export | `jspdf@4.2`, `html2canvas@1.4` | ✅ |
| Build/Lint | `vite@5.4`, `@vitejs/plugin-react@4.3`, `eslint@9.39`, `prettier@3.8`, `typescript@6.0.3` ⚠️, `vitest@4.1`, `terser@5.46` | ⚠️ TS 6.x — verificar |

### 2.3 Achados

#### 🔴 P3 — TypeScript declarado `^6.0.3`
- `package.json:81` declara `^6.0.3`. Microsoft TS oficial **5.x é a stable** com cutoff 2026-01.
- **Verificação local:** `node -e "console.log(require('./node_modules/typescript/package.json').version)"` → `6.0.3` instalado.
- **Risco:** se for typosquat, pode injetar código malicioso em build. Se for pacote oficial Microsoft, OK.
- **Ação:** rodar `npm view typescript@6.0.3 maintainers` e confirmar `[microsoft <microsoft>]`. Se duvidoso, downgrade para `^5.7.0`.
- **Nota:** TypeScript não é usado em código (95 `.js/.jsx`, 0 `.ts/.tsx`). É devDep apenas (provavelmente pra ESLint plugin types).

#### 🟡 P2 — `@capacitor-community/admob@8.0.0` desatualizado
- Último release: dez/2023.
- Em uma stack Capacitor 8.3.1 isso pode causar warnings ou incompatibilidades futuras.
- **Ação:** monitorar GitHub do plugin; se `@capacitor/admob` first-party for lançado, migrar.

#### 🟢 Sem `moment` ou libs deprecated identificadas
- `grep "moment"` em `src/` → **0 imports**.
- App usa `Date` nativo + `utils/dateUtils.js` (28 testes unitários cobrem).

#### 🟢 Lockfile presente
- `package-lock.json` versionado (~531 KB). ✅

#### 🟢 `.npmrc` com `legacy-peer-deps=true`
- Necessário para Capacitor + React 19 coexistirem. Aceitável.

### 2.4 Vulnerabilidades

- CI (`.github/workflows/ci.yml`) roda `npm audit --audit-level=high` com `continue-on-error: true`.
- Plan documenta: 12 vulns persistem em devDeps (`@capacitor/assets` chain). Zero risco runtime.
- ⚠️ Rodar `npm audit --production` periodicamente (não está em CI).
- **Recomendação:** pre-launch, rodar `npm audit fix --production` + `snyk test` para prod-only vulns.

---

## 3. Código morto (Dead code)

### 3.1 Análise

- **`console.log/debug` em runtime:** **0** (já strippados via Terser `pure_funcs` em prod — Plan 7.2). ✅
- **`debugger` statements:** 0 ✅
- **Arquivos `.old.js`/`.bak.js`/`_unused/`:** nenhum ✅
- **Imports não-usados:** ESLint `no-unused-vars` ativo, `no-unused-imports` via plugin. Lint atual: 0 errors, 49 warnings (max=80).
- **Pacotes em deps não-importados:** análise rápida sugere todos importados; ferramenta dedicada (`depcheck`/`knip`) não rodada nesta auditoria — recomenda-se rodar pré-launch.

### 3.2 Comentários TODO/FIXME

Encontrados ~15 comentários relevantes (não-críticos):

- `App.jsx:34-37` — `extend_continuous_treatments` desabilitado (FASE 23.5 backlog, ver BUG-004)
- `Dashboard.jsx:34-36` — mesma issue
- `notifications.js:167` — comentário sobre lógica de critical alarms (operacional)
- `DoseHistory.jsx:40` — text search por medName/observation (FASE 15 backlog — Plan diz **implementado**, verificar)
- `useAuth.jsx:90-111` — OAuth Google/Facebook código comentado
- `useAppUpdate.js:4`, `Install.jsx:7`, `OnboardingTour.jsx:4`, `PermissionsOnboarding.jsx:18` — `eslint-disable no-undef` (Capacitor globals)

### 3.3 Componentes potencialmente órfãos

Sugestão de revisão (rodar `knip` ou `ts-prune`):

- `mockStore.js` (206 LOC) — usado por 5 arquivos (auth + services), **ATIVO** (modo demo). Plan 15 backlog: avaliar remoção.
- `OnboardingTour.jsx` — confirmar que ainda é exibido pós-login (live nav confirmou: ainda exibe).
- `Plan_Suggestions.md` (raiz) — apêndice antigo, não-usado em runtime, pode ser arquivado em `analise/archive/`.

### 3.4 Documentação duplicada

Na raiz, foram identificados arquivos `.md` com sobreposição de propósito:

| Arquivo | Tamanho | Status |
|---|---|---|
| `Plan.md` | 62 KB / 1055 linhas | Ativo, principal |
| `RoadMap.md` | 15 KB | ⚠️ provavelmente subset/snapshot antigo do Plan.md |
| `Plan_Suggestions.md` | 4.7 KB | ⚠️ apêndice antigo |
| `Contexto.md` | 44 KB / 972 linhas | Ativo, contexto pra novos chats |
| `SECURITY.md` | 11 KB | Ativo, security-specific |

**Recomendação:** `RoadMap.md` e `Plan_Suggestions.md` foram **copiados** para `analise/archive/` durante esta auditoria. Dev pode deletar das raízes após review.

### 3.5 Tabelas/colunas órfãs no Supabase

Não foi possível auditar via repo (precisa pg_stat_user_tables em produção):

```sql
SELECT relname, n_live_tup, last_seq_scan, last_idx_scan
FROM pg_stat_user_tables WHERE schemaname='medcontrol'
ORDER BY n_live_tup;
```

### 3.6 Endpoints / Edge Functions não usadas

Confirmadas em uso:
- ✅ `delete-account` — chamada de `Settings.jsx`
- ✅ `notify-doses` — cron job Supabase
- ✅ `send-test-push` — admin panel (potencialmente)

---

## 4. TanStack Query — Cache & Custos

### 4.1 Configuração global (`main.jsx:61-76`)

```js
defaultOptions: {
  queries: {
    staleTime: 0,                  // ⚠️ refetch agressivo
    refetchOnMount: 'always',      // ⚠️ todo mount refaz
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    gcTime: 24h (persisted)
  },
  mutations: {
    retry: 3,
    retryDelay: exponential
  }
}
```

### 4.2 Hooks individuais

| Hook | staleTime | refetchInterval | Anti-pattern? |
|---|---|---|---|
| `useDoses(filter)` | 0 (default) | **60_000 ms** ⚠️ | Polling contínuo + refetchOnMount=always = redundante |
| `usePatients()` | 6_000 | — | refetchOnMount=false (cobre janela undo 5s) ✅ |
| `useTreatments(filter)` | 6_000 | — | Mesmo padrão undo-safe ✅ |
| `useSubscription()` | 60_000 | — | Tier + ads, cache razoável ✅ |
| `useUserMedications()` | 30_000 | — | gcTime: 30min ✅ |
| `useUserPrefs()` | 30_000 | — | Notif settings ✅ |
| `useSosRules(patientId)` | (default) | — | enabled: !!patientId ✅ |
| `useRealtime()` | N/A | N/A | Subscription, não usa Query ✅ |

### 4.3 Custo estimado

Com `useDoses` polling 60s + `refetchOnMount: 'always'`:
- 1 user ativo (1 sessão de 1h, navega 10 pages) = ~70 requests/h.
- 1k users = 70k req/h = ~50M req/mês.
- Supabase Pro plan tem bandwidth 50 GB. Cada request /doses é ~10-20 KB → ~500 GB-1 TB/mês para 1k users. **Pro insuficiente para 1k MAU**.

### 4.4 Anti-patterns encontrados

1. ⚠️ **`refetchInterval: 60_000` em useDoses** sem `refetchIntervalInBackground: false` — polluí mesmo quando aba inativa.
2. ⚠️ **`refetchOnMount: 'always'` global** — não aproveita cache.
3. ⚠️ **Falta de `select` para transformar dados sem re-render** — observação geral.
4. ⚠️ **`retry: 1` em queries** — frágil em rede instável (3G).
5. ✅ Mutations com optimistic update + rollback (useDoses confirm/skip/undo) — implementação sólida.
6. ✅ Invalidation lazy (`refetchType: 'active'`) em `onSettled` — fix da FASE 18.4.5.

### 4.5 Audit `listDoses` (deep-dive)

`services/dosesService.js`:
- `listDoses({from, to, ...})` paginated loop até 20 pages × 1000 rows = cap 20k rows.
- Sem `select` específico além das colunas literais — OK (não pega `*`).
- `.order('scheduledAt', { ascending: false })` — usa index `(patientId, scheduledAt)` ✅.
- Status `overdue` computado em cliente — pode mover para query DB (filter `WHERE status='pending' AND scheduledAt < now() - INTERVAL '15 min'`).

### 4.6 Estratégia de cache em camadas

| Camada | Atualmente | Recomendação |
|---|---|---|
| Client (TanStack Query) | localStorage persistor 24h | Reduzir refetch, aumentar staleTime |
| HTTP cache (Cache-Control) | Não inspecionado em headers Supabase | Supabase API geralmente não tem cache (RLS dinâmico) |
| CDN (Vercel Edge) | Vercel headers OK (CSP) | Static assets cached bem |
| Database (Postgres) | shared_buffers padrão Supabase | OK para tamanho atual |

### 4.7 Bundle e network

- Bundle main: 64 KB (gzip 20 KB) — ✅ excelente, abaixo do alvo 500 KB.
- Vendor chunks split (vendor-react, vendor-data, vendor-sentry, vendor-capacitor, vendor-icons).
- jspdf (340 KB) + html2canvas (199 KB) lazy load só na route /relatorios. ✅
- React.lazy em 18 pages. ✅
- `loading="lazy"` em 1 `<img>` (PatientCard). ⚠️ aumentar uso.

---

## 5. Performance frontend

### 5.1 Otimizações React

| Padrão | Count | Impacto |
|---|---|---|
| `React.memo` | **0** | ⚠️ DoseCard / PatientCard re-renderiza desnecessariamente |
| `useMemo` | ~8 | OK (Dashboard usa 5) |
| `useCallback` | ~5 | OK |
| `React.lazy` | 18 (todas pages) | ✅ excelente |

### 5.2 Listas grandes

- `DoseHistory.jsx` — sem virtualização, render direto.
- `Patients.jsx` — sem virtualização.
- ⚠️ Para >200 doses, possível jank. Plan 23 backlog cita virtualização (`@tanstack/react-virtual` já em deps — não-integrado).

### 5.3 Image optimization

- Logo Login: PNG (não-lazy, above-fold OK).
- Avatares pacientes: ícone Lucide vetorial (sem imagens reais).
- Fotos paciente — Plan 15 backlog: feature ainda não implementada.

---

## 6. Lint, Format, Tests

### 6.1 ESLint (`eslint.config.js`)
- ESLint 9 flat config.
- Plugins: `react@7.37`, `react-hooks@7.1`, `react-refresh@0.5`, `prettier`.
- `react-in-jsx-scope: off` (React 19) ✅.
- `exhaustive-deps: warn` ✅.
- `npm run lint --max-warnings=80` — atualmente 49 warnings, 0 errors ✅.

### 6.2 Prettier
- `.prettierrc` config: semi=false, singleQuote=true, trailingComma=es5, printWidth=110, tabWidth=2.
- `.prettierignore` presente.

### 6.3 Husky / pre-commit
- ❌ **Sem `.husky/`** — lint/format roda apenas em CI.
- **Recomendação:** `npm install -D husky lint-staged` + `.husky/pre-commit` para evitar bad commits.

### 6.4 Vitest
- 6 test files: utils (5) + services (1).
- Coverage threshold: utils ≥80% lines/funcs/statements, ≥70% branches.
- ⚠️ Sem teste de hooks (`useDoses`, `useUserPrefs`) — Plan 9.4 backlog.
- ⚠️ Sem E2E (Playwright) — Plan 9.5 backlog.

### 6.5 CI
- `.github/workflows/ci.yml`: install → lint → test → audit → build → cap sync.
- Node 22 (Capacitor CLI requer).
- Secrets configurados (Sentry, Supabase, PostHog).
- ✅ Sólido para PR/push.

---

## 7. Tools / scripts personalizados

### 7.1 `scripts/`
- `copy-apk-to-dist.cjs` — copia APK para `dist/dosy-beta.apk` (download web).
- `gen-icons.mjs` — `@capacitor/assets` gen.

### 7.2 `tools/` (~25 arquivos `.cjs` + `supabase.exe` ~98 MB)

Scripts auxiliares de DB management:
- `apply-migration.cjs` — aplica .sql via Management API
- `migrate.cjs` (21 KB) — migração principal
- `audit-db.cjs` — audit RLS/permissions
- `verify.cjs`, `cleanup.cjs`, `finalize.cjs`, `test-conn.cjs`
- `debug-rls.cjs`, `fix-devicetoken-unique.cjs`, `create-push-rpc.cjs`
- `migrate-kp-to-dosy.cjs`, `test-sos-bypass.cjs`, `security-fix.cjs`

⚠️ **`tools/supabase.exe` (98 MB)**: presumível binary Supabase CLI para Windows — verificar se está em `.gitignore` ou já versionado por engano. Se versionado, ocupa espaço inflado no repo.

```bash
$ git ls-files tools/supabase.exe
# se retornar path, está versionado — REMOVER via git filter-repo
```

**Recomendação:** mover `tools/supabase.exe` → ferramenta global (Scoop/asdf/Path) e `.gitignore`-ar.

---

## 8. Refactor — hotspots

> Ver `archive/security-original.md` §"Análise de hotspots" para Plano detalhado.

| Arquivo | Problema | Esforço | Severidade |
|---|---|---|---|
| `services/notifications.js` (588 LOC) | god-service — FCM + LocalNotif + CriticalAlarm + scheduling | 1-2 dias | P2 |
| `pages/Settings.jsx` (541 LOC) | god-component — Settings tem 4-5 sections | 4-6h | P2 |
| `pages/Reports.jsx` (436 LOC) | gerador PDF + gráficos misturados | 4-6h | P3 |
| `pages/Dashboard.jsx` (382 LOC) | extrair `useDashboardStats`, `useDoseQueue` | 3-4h | P2 |
| `services/dosesService.js` | listDoses + RPCs + mock fallback | 2h | P3 |
| `tools/*.cjs` | refactor parcial feito (env vars) | 1h | P3 |
| `AlarmActivity.java` (~400 LOC) | layout em código Java verbose | 4h | P3 |

**Padrão de refactor recomendado para Settings:**
```
src/pages/Settings.jsx (orchestrator, ~80 LOC)
src/pages/Settings/AppearanceSection.jsx
src/pages/Settings/NotificationsSection.jsx
src/pages/Settings/AccountSection.jsx
src/pages/Settings/DataPrivacySection.jsx
src/pages/Settings/VersionSection.jsx
```

---

## 9. Observabilidade (Sentry + PostHog)

### 9.1 Sentry
- ✅ Init em `main.jsx` com release tag `dosy@${__APP_VERSION__}`.
- ✅ ErrorBoundary global wrap App.
- ✅ Source maps via `@sentry/vite-plugin` (sourcemap: 'hidden' em prod) — exige `SENTRY_AUTH_TOKEN+ORG+PROJECT` em CI.
- ⚠️ Plan 10.1 — secrets em GitHub Actions: ainda manual.
- ✅ `beforeSend` strip PII (email/username/IP/body).
- ⚠️ `autoSessionTracking: false` — economiza eventos mas perde session tracking.

### 9.2 PostHog
- ✅ `initAnalytics()` lazy load + no-op sem `VITE_POSTHOG_KEY`.
- ✅ 24 eventos catalog (`EVENTS` em `services/analytics.js`).
- ✅ `sanitize_properties` strip PII de saúde.
- ✅ Session replay desabilitado.
- ⚠️ Sem feature flags ativos (Plan 14.1 backlog manual).
- ⚠️ Dashboards customizados manuais (Plan 14.3 backlog).

### 9.3 Crash-free rate / ANR / métricas
- Sem dashboard pronto — Plan 14 documenta alvos:
  - Crash-free ≥99.5%, ANR <0.5%, retention D7 ≥40%, NPS ≥7.
- ⚠️ Configurar alertas Sentry: crash spike, error threshold (manual em Sentry UI).

---

## 10. Resumo

### 10.1 Forças
- ✅ Stack moderna e atual (React 19 + TanStack Query 5 + Capacitor 8 + Vite 5).
- ✅ Code splitting agressivo (bundle main 64 KB).
- ✅ Test infra (Vitest 4) + ESLint 9 flat + Prettier — qualidade básica.
- ✅ Sentry + PostHog integrados com PII-safe.
- ✅ Mutations com optimistic update + rollback.
- ✅ LGPD analytics correctly stripped.

### 10.2 Fraquezas
- ⚠️ `refetchOnMount: 'always'` global — custo TanStack Query exagerado.
- ⚠️ `useDoses` polling 60s sem condicional de visibilidade.
- ⚠️ Zero `React.memo` — listas re-renderizam.
- ⚠️ Zero virtualização — listas grandes podem janky.
- ⚠️ TS 6.0.3 — verificar legitimidade.
- ⚠️ Sem pre-commit hooks.
- ⚠️ Sem testes de integração (hooks com mock Supabase) ou E2E.
- ⚠️ God-components (Settings 541, Reports 436, Dashboard 382, notifications 588).

### 10.3 Score por sub-dimensão
| Sub-dimensão | Score (0-10) |
|---|---|
| Dependências (saúde, vulns) | 7.0 |
| Código morto / dead code | 8.0 (limpo) |
| TanStack Query / cache | 6.0 (anti-patterns globais) |
| Bundle / performance build | 9.0 (excelente) |
| Lint / format infra | 8.5 |
| Testes (unit) | 7.0 |
| Testes (integração / E2E) | 2.0 (ausentes) |
| Observabilidade | 8.0 |
| Refactor / arquitetura | 6.5 (god-components) |
| **MÉDIA** | **6.9** |
