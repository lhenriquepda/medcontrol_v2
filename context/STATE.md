# 📍 Dosy — Estado Atual

> Fonte única de verdade para versão, branch e próximos passos.
> **Atualizar SOMENTE via Passo 9 do `context/WORKFLOW.md`** — a cada release.
> Conflito com `git log`? Fonte da verdade é o git.

---

## Estado atual

| Campo | Valor |
|---|---|
| **Versão** | `v0.2.6.1` (em curso) — anterior `v0.2.6.0` shipped |
| **versionCode** | `85` (v0.2.6.1) — anterior `84` (v0.2.6.0 shipped) |
| **Branch ativa** | `master` |
| **Último tag master** | `v0.2.4.1` · commit `cc5ff8f` — anterior `v0.2.4.0` `f6724f6` |
| **Ship date v0.2.4.1** | **2026-05-22 19:02 BRT** Internal Testing |
| **Vercel prod** | ✅ `dosymed.app` v0.2.4.1 via push master |
| **Play Console v0.2.4.1** | ✅ **vc 82 PUBLICADO 2026-05-22 19:02 BRT** — `is_mandatory=true` força update modal nos users vc 81 |
| **Play Console v0.2.4.0** | ❌ vc 81 BROKEN superseded por vc 82 |
| **Play Console v0.2.3.17** | ✅ vc 80 legacy |

**v0.2.6.1 em curso (2026-05-23) — Roteiro Alinhamento Dosy v2 Sprint 1-2:**
- P0.3 Sentry strip exhaustivo (23 campos + JWT/email/UUID regex breadcrumbs) ✅
- P0.4 PostHog consent gate LGPD + ConsentBanner + Settings toggle ✅
- P1.5 reconcileDoses ATIVO em useDashboardPayload ✅
- P1.6 Conflict 409 — confirm/skip/undo_dose_v2 + conflictBus + ConflictListener ✅
- P1.10 Sentry.captureException wrapper + adopt em mutationRegistry ✅
- P1.11 tracesSampleRate 0.1 ✅
- P3.4 treatment_user_alert_settings + AlertLevelToggle adopt TreatmentList ✅
- P3.15 TTL share granular (access_level + is_temporary) + SharePatientSheet UI radio + 4 TTL chips + RPCs extend/update_access/cleanup ✅
- P3.18 Edge expire-temporary-shares + pg_cron 0 * * * * ✅
- PostHog 12 eventos categoria + 3 share TTL + 3 conflict + 2 consent ✅
- Migration versionada (P0.1 partial): `20260523000000_alert_settings_share_ttl_rpc_409_v0_2_6_1.sql` ✅
- TODO: Build AAB CI Linux → Vetor 4 vc 85 → QA emulator dual-device 409 prompt + TTL share → fechar.

**Status release/v0.2.4.0 (sessão autônoma 2026-05-22):**

- **Plano Categorias de Medicamentos** ✅ — `Plano_Categorias_Medicamentos.md` raiz v3, 9/9 decisões §10 aprovadas autônomamente (hierarquia 2 níveis, CMED source-of-truth, fallback agressivo, doses futuras herdam, etc).
- **Fase 1 — Foundation** ✅ — 4 migrations em prod (catálogo + user_medications RLS + treatments/doses/sos_rules + RPCs). Backfill catalog 764 rows: 274 dicionário + 30 heurística + 460 'outro'. Clavulin/Novalgina/Tylenol/Voltaren classificados certo via tokenização de princípio composto.
- **Fase 2 — UI Cadastro** ✅ — CategoryPicker.jsx + useUserMedicationCategories + MedNameInput onSelectFull + TreatmentForm/SOS integração autofill + required-when-not-autofilled + upsert_user_medication ao salvar.
- **Fase 3 — Analytics/Histórico** ✅ — Card "Doses por categoria" donut + lista top 6 + deep-link `/historico?group=<id>` + filtro categoria com chip ativo no DoseHistory.
- **AAB v0.2.4.0** ✅ — Build via GitHub Actions Linux (local Windows quebrado por Java 25 + Unix Domain Sockets bug). Vc 81 vN 0.2.4.0, 32.8MB signed, em `android/app/release/app-release.aab`.
- **Upload Vetor 4** ⏳ — AAB já em Supabase Storage HTTPS público. Chrome MCP desconectou no início do upload; ScheduleWakeup retry agendado. SQL `app_releases` row vc 81 inserida (ON CONFLICT UPDATE).
- **Build vite verde + ESLint zero erros** ✅

**Status release/v0.2.3.17 (sessão autônoma 2026-05-20):**

- **Refactor 5 fases COMPLETO** ✅ — Fase 1 (RealtimeGate+versionedCache+per-dose busy) + Fase 2 (AlarmService thread-safe+RPC snooze_dose+Edge Function request-schedule-sync) + Fase 3 (single source + useAppLifecycle wrapper + useTier wrapper) + Fase 4 (10/10 componentes Dosy: EmptyState/DateRangeChips/StatGrid/MiniStat/FormRow/TodayDosesStat/MedicationHistoryGrid/TreatmentCard/DoseList/FilterPanel/DoseSheet + 6 adoções em páginas) + Fase 5 (Dashboard default range 30/60→7/14d + sessionMountedAt guard).
- **QA exaustivo emulator live** ✅ — Pixel8_Test cold-boot, APK debug vc 80 instalado, CDP login teste-plus, navegação em 8 telas, 11 items capturados em Validar.md, zero exceptions console.
- **AAB signed** ✅ — `android/app/release/app-release.aab` 50MB, vc 80 vN 0.2.3.17.
- **Upload Play Console** ✅ **PUBLICADO autonomamente 2026-05-20 15:00 BRT** via **Vetor 4 — Supabase Storage HTTPS proxy**. AAB → bucket público transient `aab-transient` → fetch HTTPS no Play Console (bypass Mixed Content + bypass file_upload share-path) → File+DataTransfer+dispatch change → "Salvar e publicar" modal confirmado. Bucket deletado pós-publicação. Row inserida em `medcontrol.app_releases` (vc 80, vN 0.2.3.17).

**Escopo Fase 1 (Refactor_Full.md §5):**

- `src/state/realtimeGate.js` (novo) + `src/state/versionedCache.js` (novo) — gate per-queryKey TTL 2.5s descarta Realtime payloads enquanto mutation em flight; stamp `_localActedAt` em patch optimistic.
- `src/hooks/useDosyMutation.js` + `useDosyQuery.js` (novos) — wrappers finos pra padronizar uso futuro.
- `src/hooks/useRealtime.js` — debounce 1000ms → 2500ms + gate check.
- `src/services/mutationRegistry.js` — debounce refetch 2000ms → 1500ms; markDosesInFlight/clearDosesInFlight nas 4 mutations healthcare; `_localActedAt` stamp em patchDoseInCache.
- `src/components/MultiDoseModal.jsx` — `pendingDoseId` per-dose (elimina disabled coletivo que travava fila).
- `src/pages/Dashboard.jsx` — handleRefresh aguarda mutations doses drenarem (até 2s) antes de pull-to-refresh.

**Plus `Refactor_Full.md` (novo, na raiz) — plano completo de 5 fases (16 sem.).**

---

## P0 abertos (próxima release v0.2.4.0)

1. **#NEW** — Categorias de Medicamentos (Plano_Categorias_Medicamentos.md raiz) — ingest CMED + hierarquia 2 níveis + Analytics por categoria
2. **#006** — device validation 3 devices físicos (manual user)
3. **#131** — recrutamento Reddit testers (desbloqueado pós #130)
4. **#132** — gate 14d ≥12 testers (depende #131)
5. **#133** — Production access Console (depende #132)
6. **#191/#192** — RevenueCat + Play Billing (Fase 3)
7. **#300** — Validação device físico v0.2.3.13 disclaimer paciente compartilhado + cenário E cache offline + snooze 10min + Samsung One UI battery optimizer impact

---

## Contas teste

| Conta | Tier | Senha |
|---|---|---|
| `teste-free@teste.com` | free | `123456` |
| `teste-plus@teste.com` | plus | `123456` |

---

## Template de atualização (Passo 9 — preencher a cada release)

```
| **Versão** | `vX.Y.Z.W` |
| **versionCode** | `NN` |
| **Branch ativa** | `master` (sem release em curso) |
| **Último tag** | `vX.Y.Z.W` · merge `{hash}` |
| **Ship date** | YYYY-MM-DD |
| **Play Console** | Internal Testing vc NN — publicado YYYY-MM-DD HH:MM BRT |
| **Vercel prod** | `dosymed.app` — vX.Y.Z.W confirmado YYYY-MM-DDTHH:MMZ |
```
