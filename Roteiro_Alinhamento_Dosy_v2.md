# Roteiro Alinhamento medcontrol → Dosy v2

> **Leia INTEIRO antes de codar.** Consolidado pós-auditoria 2026-05-23 (4 agentes paralelos + Supabase MCP direto). Substitui versão anterior.
>
> **Versão real:** v0.2.6.3 (vc 88, branch `release/v0.2.6.3`, dirty). **DB project:** `guefraaqbkcehofchnrc` (Postgres 17 sa-east-1, schema `medcontrol`).
> **Spec target:** `G:\00_Trabalho\01_Pessoal\Apps\dosy-app\docs\` (schema alvo `dosy`).
> **Bugs P0 abertos:** #0015 antibióticos→Outros · #0016 autofill sempre Antidepressivo · #0017 falta CMED 30k.

---

## 0. Legenda

| Sigla | Significado |
|---|---|
| 🔴 | Bloqueia release pública v1.0.0 |
| 🟡 | Degrada qualidade, ship sem bloquear |
| 🟢 | Já feito — NÃO toque |
| ✅ | Critério de aceite |

Spec target: ler `dosy-app/docs/{10,11,14,15,16,20,21}.md` + ADRs 015 (CMED) e 016 (Realtime) antes de mexer.

---

## 1. 🟢 Já alinhado ao spec — NÃO refazer

17 grupos+hormonal · CategoryPicker (265 LOC) · CategoryHintModal (151 LOC) · `classify_medication_robust` 5-tier RPC (DCB 1.0 / catalog_exact 0.95 / catalog_like 0.85 / principio_like 0.75 / heuristic_suffix 0.55) · `nao_classificado` ≠ `outro` (Analytics+DoseHistory) · DoseHistory chips multi-select + "Última dose por categoria" · MedNameInput mobile-first híbrido (635 LOC, fullscreen sheet) · TTL granular sharing (3 colunas notify) · RLS split SELECT/INSERT/UPDATE/DELETE em 55 policies · 12 indexes hot path em `doses` (partial pending/done/snoozed/fire_notified) · `re_categorize_null_rows` cron mensal · Sentry PII strip 24 campos + dedup fingerprint + rate-limit 10/dia + critical ops 5% oversample · PostHog ConsentBanner gate · GIN trgm `search_medications` + UNION user_medications · CHECK constraint enum 17 grupos em 5 tabelas · push_subscriptions multi-device com `device_id_uuid` · alarm_audit_log (24k rows) · 14 Edge functions HTTP 200 · 12 eventos PostHog categoria · `extend_continuous_treatments` recursive · `validate_dose_treatment_match` trigger · `enforce_sos_via_rpc` gate.

**Dosy v2 spec deveria COPIAR de medcontrol** (medcontrol > spec): TTL granular sharing 3 colunas notify (`expiryNotifiedAt`, `one_hour_notified_at`, `twenty_four_hour_notified_at`); dose triggers com dedup `should_fire := (status='pending' AND scheduledAt>now())` (funcionalmente equivalente a `pg_trigger_depth`); `classify_medication_robust` 5-tier (mais granular que spec 3-tier); `CHECK constraint chk_doses_group` consistente em 5 tabelas.

---

## 2. 🔴 P0 — Fechar antes do merge release/v0.2.6.3

| # | Tarefa | Path | ✅ Aceite |
|---|---|---|---|
| P0.1 | Validar fix #0015 em device (mutationRegistry buster v1→v2 + DOSE_COLS_LIST inclui group_id+cmed_class) | `src/services/mutationRegistry.js` | Device: Histórico mostra antibióticos sob "antibiotico" (não Outros). PostHog `DOSE_REFRESHED_AFTER_BUSTER_BUMP` ≥1 |
| P0.2 | Fix #0016 — regex `pina($\|\s\|\d)` muito ampla (faz match anlodi**PINA** antes anti_hipertensivo). Reordenar precedência ou tightener regex | `src/constants/medCategories.js:64-78` (função `inferGroupFromName`) | "Anlodipino 5mg" → autofill anti_hipertensivo. "Sertralina 50mg" → antidepressivo |
| P0.3 | Validar fix #0017 — useClassifyMedication retorna `null` se RPC group_id NULL + cache key inclui `_lc` (normalized lowercase) | `src/hooks/useClassifyMedication.js` | Med fora catálogo: campo grupo VAZIO (sem falso autofill). CategoryHintModal abre |
| P0.4 | Versionar 4 migrations v0.2.4.0 categorias (aplicadas em prod via MCP, AUSENTES no repo) | `supabase/migrations/2026042*_categorias_*.sql` (criar 4) | `supabase migration list` ok. `supabase db diff` retorna vazio |
| P0.5 | Limpar 458 rows `medications_catalog WHERE group_id='outro' AND cmed_class IS NULL` — Tigeciclina, Linezolida, Cefazolina, Aminofilina, Cimetidina, Ác. Mefenâmico, Colchicina, Imatinibe, Tamoxifeno e 449 outros | SQL UPDATE direto + re-run `re_categorize_null_rows()` | `SELECT count(*) WHERE group_id='outro' AND cmed_class IS NULL` <100 |

---

## 3. 🔴 P1 — CMED 30k catalog (bloqueia bug #0017)

| # | Tarefa | Path | ✅ Aceite |
|---|---|---|---|
| P1.1 | Criar `scripts/ingest-cmed.mjs` — lê XLSX CMED → batches 500 → upsert `medications_catalog` (nome, principio_ativo, cmed_class, ean, group_id derivado) | `scripts/ingest-cmed.mjs` (criar, ~250 LOC) | `node scripts/ingest-cmed.mjs supabase/seeds/cmed-2026-05.xlsx` → 28k-32k upserts. `SELECT count(*)` >25k |
| P1.2 | Edge function `cmed-monthly-sync` (cron `0 7 1 * *`) baixa XLSX, chama RPC `ingest_cmed_batch(jsonb)` | `supabase/functions/cmed-monthly-sync/index.ts` (criar) | 1ª run mensal HTTP 200. catalog count cresce |
| P1.3 | Criar tabela `dosy.cmed_class_to_group_mapping (cmed_class TEXT PK, group_id TEXT, version INT)`. Migrar dict hardcoded de `src/constants/medCategories.js` + `scripts/lib/classify-medication.mjs` para DB | Migration + atualizar 2 arquivos JS | Tabela tem 90+ rows. `classify_medication_robust` lê da tabela. Frontend lê via TanStack cache 1h |
| P1.4 | Backfill EAN para top 100 vendidos (hoje 0/984 com EAN) — habilita scan código de barras PRD | SQL UPDATE direto | `SELECT count(*) WHERE ean IS NOT NULL` >100 |

---

## 4. 🔴 P2 — DB schema gaps (Fase 2 rewrite)

| # | Tarefa | Path | ✅ Aceite |
|---|---|---|---|
| P2.1 | Schema rename `medcontrol` → `dosy` (Fase 2 Dosy v2). Migration ALL AT ONCE | `ALTER SCHEMA medcontrol RENAME TO dosy` + ajustar 56 migrations qualified + Java alarm scheduler refs | Build verde. App roda dev+prod sem erro. Search-replace `medcontrol.` → `dosy.` em RPCs |
| P2.2 | Criar `dosy.profiles (id, full_name, locale, timezone, marketing_opt_in, plan_overrides JSONB)` | Migration + ADR | Sign-up novo cria row. Settings lê daqui (não `auth.users.raw_user_meta_data`) |
| P2.3 | Versionamento imutável: `dosy.treatment_versions` + cols `parent_treatment_id`, `version`, `paused_at`, `ended_at` em `treatments` | Migration + RPC `update_treatment_preserving_history` | Editar treatment cria nova row v+1. Old preservada |
| P2.4 | `dosy.audit_log` genérico `(actor_id, action, target_table, target_id, diff JSONB, created_at)` + trigger | Migration + retention policy 19-SEGURANCA §3.5 | LGPD logs UPDATE/DELETE doses/treatments/shares |
| P2.5 | `dosy.feature_flags (key, value JSONB, updated_at)` — substitui Edge `admin-feature-flags`. Habilita master switch `realtime_enabled` ADR-016 | Migration + RPC `admin_set_feature_flag` + Edge `get-feature-flags` (P3.5) | Toggle flag via SQL → cliente reflete <5min |
| P2.6 | `dosy.fcm_dispatched_log (dose_id PK, dispatched_at)` — ADR-016 P8.4 anti-dup FCM | Migration + helper em dose-trigger-handler | EXPLAIN ANALYZE SELECT <5ms |
| P2.7 | `dosy.schedule_sync_throttle (user_id PK, last_request_at)` — ADR-016 P8.10 rate-limit | Migration + check em `request-schedule-sync` (P3.4) | Cliente recebe 429 se <60s |
| P2.8 | RPCs `has_patient_mark_access(uid, pid)` + `has_patient_full_access(uid, pid)` — tier granular cuidador. Coluna `patient_shares.access_level` existe mas RLS atual trata todo shared como `full` | Migration RPC + ajustar 4 RLS policies em doses/treatments | Cuidador `mark` confirma/skip mas NÃO edita treatment. Test passa |
| P2.9 | RPC `export_my_data()` + Edge `export-my-data` (LGPD ADR-013) | RPC retorna jsonb + Edge gera PDF/JSON | Settings → "Exportar dados" → download |
| P2.10 | Drop 4 overloads legacy: `register_sos_dose` (×3 → 1), `share_patient_by_email` (×3 → 1), `create_treatment_with_doses` (×2 → 1), `extend_continuous_treatments` (×2 → 1) | 4 migrations `DROP FUNCTION ... (signature)` | `SELECT proname, count(*) FROM pg_proc GROUP BY proname HAVING count(*) > 1` retorna vazio |
| P2.11 | Cols faltantes em `patients`: `insurance, insurance_card, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, height, blood_type, observations` | Migration ADD COLUMN | Patient Detail UI exibe |
| P2.12 | Cols faltantes em `treatments`: `dose_amount NUMERIC, medication_id UUID FK, custom_times JSONB` | Migration ADD COLUMN + ajustar `create_treatment_with_doses` | Treatment grava custom_times. Detail mostra |
| P2.13 | Engine ADR-012: tabelas `medications`, `medication_principles`, `medication_rules`, `medication_interactions` + RPCs `validate_sos`, `check_interactions` (HOJE: só `sos_rules` flat) | 4 migrations + 2 RPCs + ADR | SOS warning sofisticado funciona. Interaction modal exibe |

---

## 5. 🔴 P3 — Edge functions consolidation

| # | Tarefa | Path | ✅ Aceite |
|---|---|---|---|
| P3.1 | Criar `_shared/fcm.ts` — extrair `getFcmAccessToken` OAuth/JWT (~30 LOC duplicados em 6 functions: dose-trigger, dose-fire-time, patient-share, patient-unshare, daily-alarm, send-test-push) | `supabase/functions/_shared/fcm.ts` | dose-trigger-handler 495→~420 LOC. dose-fire-time 230→~200 |
| P3.2 | `_shared/webhookHmac.ts` — assinar webhooks postgres→edge com HMAC | `supabase/functions/_shared/webhookHmac.ts` | dose-trigger-handler rejeita request sem `X-Dosy-HMAC` válido |
| P3.3 | `pg_trigger_depth() = 0` guard + dedup via `fcm_dispatched_log` window 30s em `dose_change_notify_*` (3 triggers) | Migration ajustar triggers + helper edge | UPDATE cascata (status + reschedule) dispara FCM 1× (não 2×). PostHog `FCM_DEDUP_HIT` ≥1 |
| P3.4 | Migrar `request-schedule-sync` de STUB → executor real (chama `daily-alarm-sync` direto, remove polling client `rescheduleAll`) | `supabase/functions/request-schedule-sync/index.ts` (76 LOC hoje) | Cliente chama 1× pós-confirm_dose. PostHog `SCHEDULE_SYNC_TRIGGERED` |
| P3.5 | Edge `get-feature-flags` (Cache-Control 5min) — substitui query direta tabela `feature_flags` | `supabase/functions/get-feature-flags/index.ts` | Client query frequência <12/hora/user. PostHog `FF_CACHE_HIT` |
| P3.6 | Edge `treatment-changed-handler` (trigger AFTER UPDATE em treatments) — reschedule server-side + invalida cache | `supabase/functions/treatment-changed-handler/index.ts` | Edit treatment → doses futuras regeradas server-side |
| P3.7 | Edge `notify-expiring-shares` (cron hourly) — email 24h+1h antes expiry | `supabase/functions/notify-expiring-shares/index.ts` | Cuidador recebe email "share expira em 24h". `twenty_four_hour_notified_at` preenchido |

---

## 6. 🟡 P4 — Frontend primitives + Reports

| # | Tarefa | Path | ✅ Aceite |
|---|---|---|---|
| P4.1 | Extrair `<BottomSheet>` primitive — 200+ LOC inline em MedNameInput + CategoryPicker + CategoryHintModal | `src/components/dosy/primitives/BottomSheet.jsx` (criar) + refactor 3 callers | LOC inline ↓ ~600. iOS safe-area OK. Aceita `open, onClose, snapPoints, children` |
| P4.2 | Extrair `<CategoryBadge>` — 3 duplicações inline (Analytics, DoseHistory, TreatmentForm) | `src/components/dosy/primitives/CategoryBadge.jsx` | 3 callers consumindo. Props `groupId, count?, clickable?` |
| P4.3 | Reports.jsx integração categoria — filtro multi-select chips + coluna group_id no export PDF/CSV + agregação por grupo | `src/pages/Reports.jsx` (894 LOC, hoje 0 refs `categor\|group\|MED_`) | Export CSV tem coluna "Categoria". Filtro chips funcional |
| P4.4 | Analytics drill-down Nível 2 — clicar barra "antibiotico" abre subdrill 16 classes CMED | `src/pages/Analytics.jsx` | Click → modal/page top-N CMED classes do grupo |
| P4.5 | Botão "Compartilhar pro médico" em DoseHistory (PDF resumo período via P2.9) | `src/pages/DoseHistory.jsx` + Edge `export-my-data` | Click → PDF download/share native |
| P4.6 | Realtime safeguards ADR-016 — visibility-change pause + idle 5min unsubscribe + master switch `feature_flags.realtime_enabled` | `src/hooks/useRealtime.js` (256 LOC, HOJE DESABILITADO em App.jsx:75) | 4 testes ADR-016 §11: visibility-pause / 100 idle / 6min unsub / flag flip no-op |
| P4.7 | Analytics filter cancelled (bug #0005) — `.filter(d => d.status !== 'cancelled')` em "doses por categoria" | `src/pages/Analytics.jsx` | Dose cancelada NÃO conta. BUGS.md #0005 fechado |

---

## 7. 🟡 P5 — Crons faltantes

| Cron | Schedule | Path / RPC | ✅ Aceite |
|---|---|---|---|
| mark-overdue-doses | `*/5 * * * *` | RPC `mark_overdue_doses()` UPDATE doses SET overdue=true WHERE scheduledAt+window<now() AND status='pending' | Badge "atrasada" aparece <6min |
| cleanup-security-events | `0 4 * * 0` | DELETE WHERE created_at < now()-90d | Tabela <10k rows |
| cleanup-fcm-dispatched-log | `0 3 * * *` | DELETE WHERE dispatched_at < now()-7d (ADR-016 P8.4) | Tabela <1k rows |
| cleanup-schedule-throttle | `0 3 * * *` | DELETE WHERE last_request_at < now()-24h (P8.10) | Tabela <100 rows |
| cleanup-audit-log-by-action | `0 5 1 * *` | DELETE seguindo 19-SEGURANCA §3.5 retention | audit_log <500k rows |
| update-anvisa-dataset | `0 6 2 * *` | Edge function atualiza brand names | catalog refresh mensal |

---

## 8. 🟡 P6 — Tests/QA

| # | Tarefa | Path | ✅ Aceite |
|---|---|---|---|
| P6.1 | Criar `supabase/tests/` + 3 specs pgTAP: `confirm_dose_v2.sql` (happy+409+edge), `share_patient_ttl.sql`, `classify_medication_robust.sql` (5-tier) | `supabase/tests/*.sql` (criar pasta) | `pg_prove` OK em CI |
| P6.2 | Threshold global vitest 70/70/70/70 em `vitest.config.js:21-22` (hoje só `src/utils/**`) | `vitest.config.js` | `npm test -- --coverage` enforce |
| P6.3 | Renovar coverage stale 25 dias. Tests para 3 críticos: CategoryPicker, MedNameInput, DoseHistory | `tests/components/*.test.jsx` (zero .test.tsx hoje) | Statements >60% |
| P6.4 | E2E Appium testes ADR-016 §11 (4 cenários realtime) | `tests/e2e/realtime-safeguards.spec.mjs` | 4 verdes CI emulator |

---

## 9. 🟡 P7 — Cleanups

| # | Tarefa | Path | ✅ Aceite |
|---|---|---|---|
| P7.1 | Mover 48 `scripts/qa_*.mjs` + 7 `qa_nb4_*` para `scripts/_archive/qa-legacy-2026-05/` | `scripts/_archive/` (criar) | `ls scripts/qa_*` vazio. Histórico preservado |
| P7.2 | Remover `src/hooks/useRealtime.js` (256 LOC dead) APENAS depois P4.6 re-enable OU se ADR-008 mantiver deferred | `src/hooks/useRealtime.js` | grep `useRealtime` = 0 |
| P7.3 | Remover `src/components/dosy/BellAlerts.jsx` (188 LOC, não usado) + refs em `index.js` + `HeaderAlertIcon.jsx` | 3 arquivos | grep `BellAlerts` = 0 |
| P7.4 | Decisão `medication_categorization_suggestions` table (sem consumer cliente): DROP ou implementar ADR-015 P3.8 (aprendizado coletivo) | Migration + ADR-015 addendum | Decisão registrada |
| P7.5 | Migrar 121 catches restantes para `captureCaught` wrapper (hoje 9 hot paths) | `src/**/*.js` grep `catch (.*) { ... captureException` | `Sentry.captureException` direto <10 |

---

## 10. 🟢 P8 — Release-gate v1.0.0 (Open Testing público)

Ler `dosy-app/docs/20-DEFINITION_OF_DONE.md §7.1`. Critérios MANDATORY:

```
[ ] Egress Supabase REAL <10GB/mês durante 30+ dias Internal Testing
[ ] Sentry transactions <10k/mês, errors <5k/mês (dedup ativo)
[ ] Realtime concurrent connections <100 em pico (free tier 200)
[ ] Zero `realtime_max_channels_exceeded` em 7 dias
[ ] 4 testes realtime safeguards ADR-016 §11 passam
[ ] Fatura mensal real <$100 com 100+ users testers durante 30 dias
[ ] DPO email funcional + alerta P0 webhook testado
[ ] Runbook `egress-supabase-spike.md` ensaiado
[ ] `suggest_categories_for_unknown` EXPLAIN ANALYZE <50ms
```

**Bloqueia ship público.** Qualquer item ❌ → mitigar antes.

---

## 11. Ordem de execução sugerida

```
release/v0.2.6.3 (atual):  P0.1 → P0.2 → P0.3 → P0.4 → P0.5 → MERGE master
v0.2.7.0:                  P1.1 → P1.2 → P1.3 → P1.4 (CMED 30k)
v0.2.8.0:                  P2.1 (schema rename — Fase 2 rewrite Dosy v2)
v0.2.9.x:                  P2.2-P2.13 (cols, RPCs, audit_log, engine)
v0.3.0.0:                  P3.1-P3.7 (Edge consolidation)
v0.3.1.0:                  P4.1-P4.7 (Frontend primitives + Reports + Realtime)
v0.3.2.0:                  P5 (crons) + P6 (tests) + P7 (cleanup)
v1.0.0:                    P8 release-gate (30 dias Internal Testing)
```

---

## 12. Comandos copy-paste prontos

```bash
# Verificar overloads RPC restantes:
psql -c "SELECT proname, count(*) FROM pg_proc WHERE pronamespace = 'medcontrol'::regnamespace GROUP BY proname HAVING count(*) > 1;"

# Catalog gaps (P0.5):
psql -c "SELECT count(*) FROM medcontrol.medications_catalog WHERE group_id='outro' AND cmed_class IS NULL;"

# Re-rodar cron classificação:
psql -c "SELECT medcontrol.re_categorize_null_rows();"

# Doses categorizadas mal (sample):
psql -c "SELECT medName, group_id, count(*) FROM medcontrol.doses WHERE group_id='outro' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;"

# Migrations missing categorias (P0.4):
ls supabase/migrations/ | grep -i categor

# Test pgTAP local (P6.1):
supabase db test

# Verificar schemas BD:
psql -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast');"
```

---

## 13. Referências cruzadas Dosy v2

- `dosy-app/docs/10-ARCHITECTURE.md §4.8` — RealtimeManager safeguards (5 mecanismos)
- `dosy-app/docs/11-DB_SCHEMA.md §2.18-§2.20` — feature_flags, fcm_dispatched_log, schedule_sync_throttle
- `dosy-app/docs/14-STATE_MACHINE.md` — transições válidas doses
- `dosy-app/docs/15-CACHE_KEYS.md` — TanStack keys + invalidação
- `dosy-app/docs/16-INTEGRACOES.md §1.3` — Edge cache pattern get-feature-flags
- `dosy-app/docs/20-DEFINITION_OF_DONE.md §7.1` — release-gate v1.0.0
- `dosy-app/docs/21-COST_BUDGET.md` — budget $0-100/mês com 100+ users
- `dosy-app/docs/adr/015-cmed-catalog.md` — catálogo CMED 30k + classificação
- `dosy-app/docs/adr/016-realtime-safeguards-lifecycle.md` — 5 safeguards realtime

---

## 14. Findings auditoria (resumo executivo)

**DB real (Agent 1):** 73 migrations aplicadas. 22 RPCs (4 com overloads). 14 Edge functions HTTP 200. RLS split correto. 12 indexes hot path. **0 NULL group_id** em catalog/doses (cron `re_categorize_null_rows` resolveu). **458 rows `outro` cmed_class=NULL** — antibióticos invisíveis. 2 erros pontuais logs (timestamp vazio + alarm_audit_log user_id NULL — Java alarm scheduler).

**Categorias (Agent 2):** 17 grupos + hormonal shipped. `classify_medication_robust` 5-tier funcional. 984 catalog (vs spec 30k). Reports.jsx **ZERO** integração. Bug #0015/#0016/#0017 abertos. Migrations v0.2.4.0 NÃO versionadas no repo (aplicadas via MCP).

**Frontend (Agent 3):** v0.2.6.3 real (não v0.2.5.0). MedNameInput.jsx 635 LOC já mobile-first híbrido. **BottomSheet/CategoryBadge/List primitives AUSENTES**. 3 bugs com fix em código não validado em device.

**Edge+Tests (Agent 4):** `_shared/fcm.ts` AUSENTE (OAuth duplicado ×6). `pg_trigger_depth + fcm_dispatched_log` NÃO implementado. `request-schedule-sync` ainda STUB. `ingest-cmed.mjs` AUSENTE. 48 scripts qa_* legados + 256 LOC `useRealtime.js` dead. pgTAP nunca criado. Coverage stale 25 dias. Sentry config completo (P0.3 done) + PostHog consent gate funcional.

---

> **Próxima auditoria:** após merge release/v0.2.6.3. Rodar este roteiro top→bottom; cada item marcado em commit. **Não deixe nada pra IA Dosy v2 fazer.**
