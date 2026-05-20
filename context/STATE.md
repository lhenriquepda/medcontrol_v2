# 📍 Dosy — Estado Atual

> Fonte única de verdade para versão, branch e próximos passos.
> **Atualizar SOMENTE via Passo 9 do `context/WORKFLOW.md`** — a cada release.
> Conflito com `git log`? Fonte da verdade é o git.

---

## Estado atual

| Campo | Valor |
|---|---|
| **Versão** | `v0.2.3.17` (em curso) |
| **versionCode** | `80` |
| **Branch ativa** | `release/v0.2.3.17` (refactor Fase 2 thread-safety + Fase 4 componentes core) |
| **Anteriores:** | `release/v0.2.3.15` (Fase 1) + `release/v0.2.3.16` (Fase 2 partial + Fase 5.8) ambas push OK, AABs pendentes upload manual |
| **Último tag master** | `v0.2.3.14` · merge `3858126` — anterior `v0.2.3.13` `3e27811` |
| **Ship date** | TBD (aguarda Passo 10.5 STOP) |
| **Play Console** | pendente upload — Internal Testing vc 77 (v0.2.3.14) é a última publicada |
| **Vercel prod** | `dosymed.app` — v0.2.3.14 (deploy `dpl_E3fuo27XcgfkNE9fwQo1WV7QoZFb`) |

**Status release/v0.2.3.17 (sessão autônoma 2026-05-20):**

- **Refactor 5 fases COMPLETO** ✅ — Fase 1 (RealtimeGate+versionedCache+per-dose busy) + Fase 2 (AlarmService thread-safe+RPC snooze_dose+Edge Function request-schedule-sync) + Fase 3 (single source + useAppLifecycle wrapper + useTier wrapper) + Fase 4 (10/10 componentes Dosy: EmptyState/DateRangeChips/StatGrid/MiniStat/FormRow/TodayDosesStat/MedicationHistoryGrid/TreatmentCard/DoseList/FilterPanel/DoseSheet + 6 adoções em páginas) + Fase 5 (Dashboard default range 30/60→7/14d + sessionMountedAt guard).
- **QA exaustivo emulator live** ✅ — Pixel8_Test cold-boot, APK debug vc 80 instalado, CDP login teste-plus, navegação em 8 telas, 11 items capturados em Validar.md, zero exceptions console.
- **AAB signed** ✅ — `android/app/release/app-release.aab` 50MB, vc 80 vN 0.2.3.17.
- **Upload Play Console** ❌ BLOQUEADO autonomamente — 3 vetores tentados (file_upload share, JS injection Mixed Content, base64 chunks). Caminho viável: 5min manual user OU criar service account Google Cloud 1× setup + CI 100% autônomo daqui em diante. Ver `Validar.md` v0.2.3.17 seção "Upload autônomo Chrome MCP".

**Escopo Fase 1 (Refactor_Full.md §5):**

- `src/state/realtimeGate.js` (novo) + `src/state/versionedCache.js` (novo) — gate per-queryKey TTL 2.5s descarta Realtime payloads enquanto mutation em flight; stamp `_localActedAt` em patch optimistic.
- `src/hooks/useDosyMutation.js` + `useDosyQuery.js` (novos) — wrappers finos pra padronizar uso futuro.
- `src/hooks/useRealtime.js` — debounce 1000ms → 2500ms + gate check.
- `src/services/mutationRegistry.js` — debounce refetch 2000ms → 1500ms; markDosesInFlight/clearDosesInFlight nas 4 mutations healthcare; `_localActedAt` stamp em patchDoseInCache.
- `src/components/MultiDoseModal.jsx` — `pendingDoseId` per-dose (elimina disabled coletivo que travava fila).
- `src/pages/Dashboard.jsx` — handleRefresh aguarda mutations doses drenarem (até 2s) antes de pull-to-refresh.

**Plus `Refactor_Full.md` (novo, na raiz) — plano completo de 5 fases (16 sem.).**

---

## P0 abertos (próxima release)

1. **#006** — device validation 3 devices físicos (manual user)
2. **#131** — recrutamento Reddit testers (desbloqueado pós #130)
3. **#132** — gate 14d ≥12 testers (depende #131)
4. **#133** — Production access Console (depende #132)
5. **#191/#192** — RevenueCat + Play Billing (Fase 3)
6. **#300** — Validação device físico v0.2.3.13 disclaimer paciente compartilhado + cenário E cache offline + snooze 10min + Samsung One UI battery optimizer impact

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
