# Auditoria 4.5.6 — Tests & CI

> **Tipo:** read-only
> **Data:** 2026-04-28

## Score: 2/10

| Dimensão | Score | Nota |
|---|---|---|
| Unit tests | 0 | ZERO arquivos `.test.js`/`.spec.js` (excluindo node_modules) |
| Integration tests | 0 | Zero |
| E2E tests | 0 | Zero |
| Test framework | 0 | Vitest/Jest/Playwright NÃO instalados (`grep -E "vitest\|jest\|playwright" package.json` = vazio) |
| Coverage tool | 0 | Não configurado |
| Lint config | ? | ESLint não confirmado em package.json |
| Prettier | 0 | Não configurado |
| TypeScript | 0 | Projeto JS puro |
| Pre-commit hooks | 0 | Sem husky/lint-staged |
| CI build verify | 8 | `.github/workflows/ci.yml` faz build em PR ✓ |
| CI tests | 0 | CI não roda tests (não existem) |
| CI security scan | 0 | Sem `npm audit` ou Snyk no workflow |
| CI source maps Sentry | 0 | Sem upload no build |

## CI atual (.github/workflows)
- **ci.yml**: setup-node 20 + `npm ci` + `npm run build` (com env placeholders) + `npx cap sync android`
  - Roda em push master/main + PR
  - Timeout 10min
  - Sem lint, sem tests, sem audit
- **android-release.yml**: build signed AAB + upload Play Store (multi-track via workflow_dispatch)

## Gaps

### CRÍTICO (P0)
- **G1.** ZERO testes automatizados. Funções críticas em saúde sem cobertura:
  - `generateDoses` (gera dose schedule — bug aqui = doses no horário errado)
  - `dateUtils` (formatTime, relativeLabel — base de toda UI)
  - `validateSos` (limites de segurança — bug = overdose)
  - `services/notifications.js` (`inDnd`, `groupByMinute`, `rescheduleAll` — refactor recente, sem regressão check)
  - `statusUtils`, `tierUtils`, `userDisplay`
  - **Risco em saúde:** muito alto. Refactor recente (notifications.js 557→430 LOC) validado só por smoke test manual.

### ALTO (P1)
- **G2.** Sem ESLint config visível em package.json. Code style drift garantido.
- **G3.** Sem CI security scan (`npm audit --audit-level=high`).
- **G4.** Sem source maps Sentry upload — crashes em prod chegam minified, sem context util pra debug.
- **G5.** Sem CI lint step. Build OK + import quebrado em path = passa CI mas crasha em runtime.

### MÉDIO (P2)
- **G6.** Sem pre-commit hooks (husky + lint-staged). Devs podem commitar broken code.
- **G7.** Sem TypeScript / `tsc --checkJs` em CI. Refactors arriscados sem static check.
- **G8.** Sem dependency dashboard / Dependabot config (recheck — `.github/dependabot.yml`?).

### BAIXO (P3)
- **G9.** Sem visual regression tests (Chromatic / Percy).
- **G10.** Sem performance budget em CI (size-limit / bundlesize).

## Top 5 Recomendações
1. **Vitest setup** + tests em utils críticos (`generateDoses`, `dateUtils`, `validateSos`, `notifications.inDnd/groupByMinute`) (M) — P0 antes Beta
2. **ESLint + Prettier + lint-staged** + `npm run lint` em CI (S) — P1
3. **`@sentry/vite-plugin`** upload source maps no Vercel build (S) — P1
4. **CI security scan** `npm audit --audit-level=high` (XS) — P1
5. **Pre-commit hook** lint + tests changed files (S) — P2

## Cobertura alvo
- ≥90% em utils núcleo (cycle-critical: generateDoses, validateSos, notifications)
- ≥70% no resto
- E2E Playwright: login → dashboard → criar tratamento → ver doses (1 happy path mínimo antes Beta)
