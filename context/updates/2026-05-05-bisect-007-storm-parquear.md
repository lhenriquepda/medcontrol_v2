# 2026-05-05 — Bisect #007 storm preview Vercel + parquear v0.2.2.0+

## Contexto

Sessão emendada após chat anterior travar. Após sync ROADMAP/CHECKLIST/updates pra release v0.2.1.0 (commit `4356014` doc-only fix anti-spam Gmail), executei validação obrigatória pré-merge per Regra 9.1 README:

1. ✅ Lint local: 0 errors / 68 warnings (pré-existentes)
2. ✅ Build local: 18.98s, dist gerado
3. ✅ Push origin/release/v0.2.1.0 (8 commits)
4. ❌ **Preview Vercel Chrome MCP — STORM detectado**

## Achado: Storm catastrófico release/v0.2.1.0

**Receita:** Login `teste-plus@teste.com` no preview Vercel `dosy-git-release-v0210-lhenriquepdas-projects.vercel.app` + arm fetch interceptor `__dosyNetMonitorV3` + bateria interações + idle 5min hidden tab.

**Resultado release v0.2.1.0:**

| Métrica | Valor |
|---|---|
| Total reqs Supabase em 5min idle | **3558** |
| `/doses` por segundo | ~9 req/s (escalou pra 27 sustained) |
| `/patients` por segundo | ~1.8 req/s |
| `/treatments` por segundo | ~0.9 req/s |
| Egress 5min idle | 27 MB só `/doses` |
| Tab visibility | hidden (background) |
| `hasFocus` | false |

**Comparação prod master (baseline):**

```
release/v0.2.1.0:  1053 reqs / 30s idle hidden tab
prod master:         57 reqs / 30s idle hidden tab
multiplicador:       18×
```

**Extrapolação:** ~1 GB/h egress por user idle. Quebra Supabase Pro tier rapidamente em produção.

## Bisect

Hipótese inicial: 3 commits feat tocam código operacional release v0.2.1.0:
- `b3fe670` #007 PostHog telemetria notif (App.jsx + analytics.js)
- `8807bfc` #036 skeleton screens (TreatmentList.jsx + Analytics.jsx)
- `a0c070a` #129/#130/#018/#026/#046/#156 v1.1 (vários — index.html + FAQ.jsx + Privacidade.jsx + Termos.jsx)

Bisect 1: revert `#007` src files (App.jsx + analytics.js) → commit `76dc28a` → push → Vercel rebuild 150s → retest 30s idle hidden tab.

**Resultado bisect 1:** **0 reqs / 44s idle.** Storm 100% eliminado.

`#007 confirmado culpado.`

## Decisão user

Após apresentação opções (A1 fix targeted ~30-60min, A2 parquear v0.2.2.0+ ~2min, A3 confirmar duplo via cherry-pick), user escolheu **A2** — parquear `#007` v0.2.2.0+ pra investigação dedicada.

**Razão:** Telemetria notif healthcare é valiosa mas Closed Testing categoria Saúde e fitness NÃO depende dela (Google review observa app, não dashboard PostHog). Submit Console + #156/#130 prosseguem sem #007.

## Implementação parquear

**Código:**
- Bisect commit `76dc28a` permanece (revert App.jsx + analytics.js src files)
- Constants `EVENTS.NOTIFICATION_DELIVERED/_TAPPED/_DISMISSED` preservadas em analytics.js (zero side-effect, prep retomar v0.2.2.0+)

**Docs (este commit):**
- `contexto/CHECKLIST.md §#007`:
  - Status `✅ Concluído v0.2.1.0` → `🟡 PARQUEADO v0.2.2.0+`
  - Bloco "Bug storm preview Vercel" detalhado: tabela métricas, bisect resultado, mecanismo candidato (5 hipóteses não-confirmadas), plano retomar v0.2.2.0+ (5 passos)
  - Lições durables: validação preview obrigatória, idle 5min hidden tab é gate crítico, lint+build+manual smoke web local NÃO substituem preview Vercel
- `contexto/ROADMAP.md`:
  - §6 counter `110 fechados / 42 abertos` → `109 fechados / 43 abertos`
  - §6 Δ release adicionado "+#007 PARQUEADO v0.2.2.0+ (storm bisect culpado)" + "+#036 skeleton screens fix orgânico"
  - Linha #007 `[x] fechado v0.2.1.0` → `[ ] PARQUEADO v0.2.2.0+ código revertido` + nota completa

## Mecanismo candidato (não-confirmado)

5 hipóteses requerem investigação dedicada v0.2.2.0+:

1. `import { track, EVENTS } from './services/analytics'` em App.jsx força init módulo analytics.js no boot, antes mesmo de ser chamado.
2. `analytics.js` chama `initAnalytics()` em PROD que carrega `posthog-js` com `capture_pageview: 'history_change'` + autocapture default.
3. PostHog autocapture instrumenta `window.fetch` globalmente.
4. Combinação possível: PostHog wrapper + `useDoses(alarmWindow)` (App.jsx:126-131) + `scheduleDoses(allDoses, ...)` re-render (allDoses muda referência a cada refetch) → cascade.
5. `capture_pageview: 'history_change'` reage a `pushState/popstate` durante navegação App.jsx → invalida React Query indireto → refetch → ...

Sem repro cirúrgica em ambiente isolado, mecanismo exato pendente.

## Plano retomar v0.2.2.0+

Passos documentados em CHECKLIST §#007:

1. Reproduzir storm dev local (`npm run dev` + interceptor)
2. Bisect mais fino: cherry-pick #007 mas DESABILITAR `initAnalytics()` boot
3. Se storm não retorna sem PostHog → culpa é PostHog config. Refactor: `capture_pageview: 'history_change'` off, autocapture off, init lazy só após user click
4. Se storm retorna mesmo sem PostHog → culpa é listeners ou import side-effect. Refactor: hook separado `usePushNotificationsTelemetry()` lazy importado só native
5. Validar fix com mesma receita preview Vercel + idle 5min antes ship v0.2.2.0+

## Estado release/v0.2.1.0 pós-bisect

10 commits agora:

| Commit | Item |
|---|---|
| `2522efd` | #089 BUG-022 fechado organicamente |
| `a0c070a` | Batch 6 items (#129/#130/#018/#026/#046/#156 v1.1) |
| `43747d1` | #156 v1.2 deep audit Health Apps Policy |
| `d4f3ecb` | Categoria Saúde e fitness + audit counter |
| `b3fe670` | #007 PostHog telemetria *(revertido em src — bisect)* |
| `8807bfc` | #036 skeleton screens |
| `eff7cd9` | #041 partial + #042 deferred |
| `86009d4` | #156 v1.3 idade 18+ |
| `4356014` | #026 fix anti-spam Gmail (sessão atual) |
| `76dc28a` | **bisect: revert #007 src files** (sessão atual) |

Counter: **109 fechados / 43 abertos / 1 hold (#130)**.

## Próximos passos sessão

1. Skeleton render check #036 (force remount sem cache) — confirmar feature funciona
2. Console submit #130 (6 cross-checks manuais user — Classificação/Anúncios/Segurança dados/Intent tela cheia/Política Privacidade URL/Público-alvo já alinhado v1.3 18+)
3. Click "Enviar 14 mudanças para revisão" Console (Google review ~24-72h)
4. Release ceremony 8 passos (bump → build AAB → upload Console → tag → merge master → Vercel sync → atualizar PROJETO.md → delete branch)

## Lições durables

- **Validação preview Vercel via Chrome MCP é GATE OBRIGATÓRIO pré-merge release.** Regra 9.1 README confirmada mais uma vez. Sem ela, bug 18× egress passaria pra prod.
- **Idle 5min hidden tab é cenário crítico.** Bateria interativa 2min mostrou apenas 7 reqs (saudável). Storm só visível APÓS bateria + sleep idle background. Se tivéssemos parado em "bateria OK", missed.
- **Lint + build + smoke web local NÃO substituem preview Vercel real.** Capacitor shim em web + PROD mode + lazy chunks comportam diferente entre dev local e build prod Vercel.
- **Bisect cirúrgico é eficaz** — 1 revert + 1 retest 30s identificou commit culpado em ~10min.
