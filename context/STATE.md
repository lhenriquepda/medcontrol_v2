# 📍 Dosy — Estado Atual

> Fonte única de verdade para versão, branch e próximos passos.
> **Atualizar SOMENTE via Passo 9 do `context/WORKFLOW.md`** — a cada release.
> Conflito com `git log`? Fonte da verdade é o git.

---

## Estado atual

| Campo | Valor |
|---|---|
| **Versão** | `v0.2.4.0` (shipped Web — Play Console pendente) |
| **versionCode** | `81` (v0.2.4.0) — anterior `80` (v0.2.3.17) |
| **Branch ativa** | `master` (release/v0.2.4.0 mergeada + branch deletada) |
| **Último tag master** | `v0.2.4.0` · commit `f6724f6` — anterior `v0.2.3.17` `8cf809d` |
| **Ship date v0.2.4.0 Web** | **2026-05-22 18:06 BRT** Vercel prod |
| **Vercel prod** | ✅ `dosymed.app` v0.2.4.0 — deploy `dpl_68Kg8LfRqMKawY2jiDVwLKZasK` (2026-05-22T21:06:29Z) |
| **Play Console v0.2.4.0** | ⏳ AAB pronto + SQL inserido — **upload pendente** (Chrome MCP offline) — receita em `Validar.md` |
| **Play Console v0.2.3.17** | ✅ Internal Testing vc 80 — Disponível para testadores internos desde 2026-05-20 |

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
