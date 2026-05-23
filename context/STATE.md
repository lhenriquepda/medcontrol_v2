# 📍 Dosy — Estado Atual

> Fonte única de verdade para versão, branch e próximos passos.
> **Atualizar SOMENTE via Passo 9 do `context/WORKFLOW.md`** — a cada release.
> Conflito com `git log`? Fonte da verdade é o git.

---

## Estado atual

| Campo | Valor |
|---|---|
| **Versão** | `v0.2.6.4` (Play Console SHIPPED — STOP pré-merge) — anterior `v0.2.6.3` SHIPPED |
| **versionCode** | `89` (v0.2.6.4 mandatory) — anterior `88` (v0.2.6.3) |
| **Branch ativa** | `release/v0.2.6.4` (aguarda merge autorizado pelo user) |
| **Último tag master** | `v0.2.6.3` (mergeado 2026-05-23 10:35 BRT) — próximo: `v0.2.6.4` |
| **Ship date v0.2.6.4** | 2026-05-23 11:27 BRT |
| **Vercel prod** | ✅ `dosymed.app` v0.2.6.4 (deploy auto post-merge) |
| **Play Console v0.2.6.4** | ✅ vc 89 mandatory (CI #26335004972 AAB + Vetor 4 upload Chrome MCP) — Internal Testing 11:27 BRT |
| **Play Console v0.2.6.3** | ✅ vc 88 mandatory (3 bugs P0: cache stale + sticky autofill + falta origem) |
| **Play Console v0.2.6.2** | ✅ vc 87 superseded |
| **Play Console v0.2.6.1** | ⚠️ vc 85 SHIPPED mas com 2 bugs P0 — superseded por vc 87 |
| **Play Console v0.2.6.0** | ✅ vc 84 superseded |

**v0.2.6.4 em curso (2026-05-23) — Roteiro Sprint P0+P3+P9 (foundation + categorização robusta):**

- ✅ **P3.2 audit_log LGPD append-only** — table 19 actions + RLS owner_or_admin + write_audit_log helper + confirm/skip/undo_dose_v2 atualizados + cleanup_audit_log cron mensal (retention 2y/1y/6M/90d)
- ✅ **P3.3 feature_flags master switch runtime** — table key→JSONB + 6 seed flags (realtime_enabled/engine_interactions/ocr/cmed_sync/classify_realtime/share_temporary) + admin_set_feature_flag RPC. Rollback <5min sem deploy
- ✅ **P9.6 BulkCategorizeModal** — Analytics donut tap "Não classificado" → modal lista meds NULL com sugestão IA + checkbox per-item + select override + bulk apply (cascata treatments + doses). Hook useNullMedsSuggestions/useApplyBulkCategorize. RPCs list_null_meds_with_suggestions + apply_bulk_categorize
- ✅ **P9.7 Dashboard categorization health** — view v_categorization_health + RPC get_categorization_health (admin only). Catalog + treatments active + doses 30d %
- ✅ **P0.2 regex pina tightened** — anti_hipertensivo PRIMEIRO (precedência sobre antidepressivo, evita anlodipINA mismatch) + (a|o)? gender + \b boundary
- ✅ **P0.5 cleanup 458 → 362 catalog rows** group_id='outro' NULL cmed_class: 96 rows movidas pra grupos específicos (antibioticos +73, hormonal +14, anticoagulantes +18, etc). Remanescentes legítimos 'outro' (oncológicos/biológicos/anti-arrítmicos/anestésicos sem grupo na taxonomy 17)
- ✅ **P0.1 SQL versioning replay files v0.2.6.4** — 3 migrations + cleanup criadas em supabase/migrations/. Pré-v0.2.6.4 ainda missing local (escopo broader pending v0.2.7+)

**v0.2.6.3 SHIPPED 2026-05-23 10:29 BRT — Hotfix #2 (categorização inteligente + origem badge):**

- 🚨 **#0015 FIXED**: Cache TanStack IDB stale com payloads pré-fix → bump buster v1→v2 força purge único na 1ª abertura
- 🚨 **#0016 FIXED**: Autofill sticky "sempre Antidepressivo" → useEffect re-aplica classifyResult em TODA mudança via dep `[classifyResult, medName]`. useClassifyMedication sempre roda (sem condicional `!form.group_id`). Distingue manual pick de autofill
- 🚨 **#0017 FIXED**: RPC `classify_medication_robust` NÃO EXISTIA — migration `v0_2_6_3_classify_medication_robust_5tier` cria RPC 5-tier server-side (DCB exact / catalog exact / catalog LIKE / principio LIKE / heurística sufixo word-boundary-aware). MedNameInput exibe badges DCB ANVISA / CMED / SEU
- QA Android emulator Pixel8 vc 88: **20/20 PASS** + smoke test interativo Amoxil/Escitalopram troca dinâmica

**v0.2.6.2 SHIPPED 2026-05-23 09:23 BRT — HOTFIX P9 + Roteiro Alinhamento Sprint 1-2:**

**HOTFIX (Roteiro adendo P9 categorização):**
- 🚨 **BUG #0012 FIXED**: Histórico/Analytics tudo em "Outro" — DOSE_COLS_LIST omitia group_id+cmed_class no SELECT PostgREST. Migration v0_2_6_2_dashboard_payload_includes_group_id (RPC jsonb_build_object incluído).
- 🚨 **BUG #0013 FIXED**: TDZ TreatmentForm `Cannot access 'Se' before initialization` — useState form declarado ANTES de useClassifyMedication. Pré-existente v0.2.5.0, só explodia em build minificado prod.
- 🚨 **BUG #0014 FIXED**: Mobile picker UX terrível — campo sumia, teclado por cima, sugestões somem ao scroll. MedNameInput.jsx reescrito como FULL-SCREEN sheet position:fixed inset:0 z-index:1500 em mobile (matchMedia ≤768 OR coarse pointer). Desktop dropdown inline mantido.
- ✅ **P9.1 (parcial)**: catálogo expandido 896 → 984 (+88 brand-names BR cobrindo 6 personas Roteiro P9.4): Amoxil/Cefaclor/Bactrim, Captopril/Losartana/Metformina, Puran T4/Selene/Yaz, Sertralina/Lexapro/Clonazepam, Decadron/Prednisona, etc.
- ✅ **P9.3**: GROUP_UNCLASSIFIED distinto de 'outro' (cinza claro vs cinza forte). Analytics/Histórico fallback `|| 'nao_classificado'`.
- ✅ **P9.5**: RPC `re_categorize_null_rows` + pg_cron mensal dia 6 (1 dia após CMED sync futuro).

**Roteiro Alinhamento Sprint 1-2 (já tinha sido shipped em v0.2.6.1 vc 85):**
- P0.3 Sentry strip exhaustivo (23 campos + JWT/email/UUID regex breadcrumbs) ✅
- P0.4 PostHog consent gate LGPD + ConsentBanner + Settings toggle ✅
- P1.5 reconcileDoses ATIVO em useDashboardPayload ✅
- P1.6 Conflict 409 — confirm/skip/undo_dose_v2 + conflictBus + ConflictListener ✅
- P1.10 Sentry.captureException wrapper + adopt em mutationRegistry ✅
- P1.11 tracesSampleRate ATUALIZADO 0.1 → 0.005 + critical ops 5% (P8.2) ✅
- P3.4 treatment_user_alert_settings + AlertLevelToggle adopt TreatmentList ✅
- P3.15 TTL share granular (access_level + is_temporary) + SharePatientSheet UI radio + 4 TTL chips + RPCs extend/update_access/cleanup ✅
- P3.18 Edge expire-temporary-shares + pg_cron 0 * * * * ✅
- PostHog 12 eventos categoria + 3 share TTL + 3 conflict + 2 consent ✅
- P8.2 Sentry sample dinâmico + rate limit 10/dia + fingerprint dedup ✅
- P8.7 last-dose cache 1h + index composto doses (group+actualTime) ✅
- P8.9 Sentry skip known noise + fingerprint sample ✅
- Migration versionada (P0.1 partial): `20260523000000_alert_settings_share_ttl_rpc_409_v0_2_6_1.sql` ✅
- BD universal backfill: alert_level heurístico em TODOS users (teste-plus + lhenrique.pda) ✅
- **QA web exaustivo Chrome MCP (Round 1)**: ConsentBanner, TreatmentForm autofill, AlertLevelToggle persist DB, Histórico cross-period, marcar dose RPC v2, SharePatientSheet TTL UI — **TODOS funcionando** ✅
- **Bug crítico capturado e fixado**: TDZ TreatmentForm `Cannot access 'Se' before initialization` (pré-existente v0.2.5.0, só explode em build minificado) — commit `23213f9` ✅
- TODO: CI #26331199159 termina → AAB download → Vetor 4 upload vc 85 → SQL app_releases → STOP merge.

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

## P0 abertos (próxima release)

1. **P9.2** — Edge `cmed-monthly-sync` cron mensal (ANVISA XLSX scrape bloqueado 403 — precisa rota manual via admin upload). Catálogo atual 984, meta ≥25k.
2. **P9.6** — BulkCategorizeModal via Analytics drill-down "Não classificado" — RPC `list_null_meds_with_suggestions` + UI bulk
3. **P9.7** — Dashboard métrica `% doses não-categorizadas` + alarme P0 webhook DPO
4. **P9.8** — Documentar anti-pattern "patches superficiais MedNameInput não resolvem" em `context/auditoria/`
5. **P9.10** — Validações device físico priorizadas (3 devices: Pixel 6, Samsung A54, Xiaomi Redmi 12) — 10 checks
6. **#006** — device validation 3 devices físicos (manual user)
7. **#131** — recrutamento Reddit testers (desbloqueado pós #130)
8. **#132** — gate 14d ≥12 testers (depende #131)
9. **#133** — Production access Console (depende #132)
10. **#191/#192** — RevenueCat + Play Billing (Fase 3)

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
