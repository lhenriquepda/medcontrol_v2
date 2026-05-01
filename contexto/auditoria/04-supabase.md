# 04 — Inventário e Auditoria Profunda do Supabase

> **Data:** 2026-05-01 · **Versão auditada:** 0.1.6.9 @ commit `5bb9d36` · **Branch:** master
> **Project ref:** `guefraaqbkcehofchnrc` (cloud) · região não inferida via repo
> **Schema principal:** `medcontrol` (exposto na API junto com `public` e `graphql_public`)

---

## 1. Reconhecimento

### 1.1 Variáveis de ambiente (`.env.example`)

| Variável | Tipo | Comentário |
|---|---|---|
| `VITE_SUPABASE_URL` | Public | OK expor no bundle |
| `VITE_SUPABASE_ANON_KEY` | Public | OK expor (RLS protege) |
| `VITE_VAPID_PUBLIC_KEY` | Public | Web Push |
| `VITE_SENTRY_DSN` | Public | OK expor |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | Public | OK expor |
| `VITE_ADMOB_BANNER_ANDROID` | Public | OK expor |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRET** | Apenas Edge Functions (Supabase secrets) |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | **SECRET** | Edge Functions (notify-doses, send-test-push) |
| `VAPID_PRIVATE_KEY` | **SECRET** | Edge Function (Web Push) |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | **SECRET** | CI build apenas |

### 1.2 Verificação anti-vazamento

- `grep -r "SUPABASE_SERVICE_ROLE_KEY" src/` → **0 resultados** ✅
- `grep -r "service_role" src/` → 1 (`Settings.jsx:187`, comentário documentando que delete-account "service_role required")
- `grep -r "eyJ" src/ tools/` → 0 JWTs hardcoded ✅
- ⚠️ `SECURITY.md` reporta histórico: senha postgres já vazou em git em scripts antigos `tools/*.cjs`. **Refatoração feita** (env vars), **rotação manual da senha pendente** — ver `06-bugs.md#bug-013`.

### 1.3 Migrations

Diretório `supabase/migrations/`:

| Timestamp | Arquivo | Conteúdo |
|---|---|---|
| 20260428142412 | `revoke_anon_grants.sql` | REVOKE ALL FROM `anon` em 10 tabelas |
| 20260428142413 | `force_rls_user_prefs.sql` | `ALTER TABLE user_prefs FORCE ROW LEVEL SECURITY` |
| 20260428142414 | `drop_overload_create_treatment.sql` | DROP função overload V1 |
| 20260428172242 | `remote_schema.sql` | ⚠️ **0 bytes** — baseline placeholder |
| 20260428180000 | `check_constraints_treatments.sql` | CHECKs `intervalHours>0`, `durationDays∈[1,365]`, length |
| 20260428180001 | `check_constraints_doses.sql` | CHECKs length em medName/unit |
| 20260428180002 | `check_constraints_sos_rules.sql` | CHECKs intervals + length |
| 20260428180003 | `check_constraints_patients.sql` | CHECKs length + age 0-150 + weight 0-1000 |
| 20260428180004 | `trigger_dose_treatment_match.sql` | TRIGGER cross-FK ownership |

⚠️ **Baseline `remote_schema.sql` está vazio** — schema real está em produção (cloud) sem dump versionado. Recomendação documentada em Plan FASE 6: regenerar via `supabase db pull` (precisa Docker).

---

## 2. Inventário de tabelas (schema `medcontrol`)

> Lista deduzida de migrations + Plan.md + uso no código `src/services/`. Para listagem definitiva, rodar:
> ```sql
> SELECT tablename, hasindexes, rowsecurity, forcerowsecurity
> FROM pg_tables LEFT JOIN pg_class ON pg_class.relname = pg_tables.tablename
> WHERE schemaname = 'medcontrol';
> ```

| Tabela | RLS | FORCE_RLS | FKs principais | Notas |
|---|---|---|---|---|
| `admins` | ✅ | ❓ | (UUID admin → auth.users) | Admin gating |
| `doses` | ✅ | ❓ | `patientId` → `patients`, `treatmentId` → `treatments` (CASCADE) | Trigger `validate_dose_treatment_match` |
| `patient_shares` | ✅ | ❓ | `patientId` → `patients`, `userId` → auth.users | Compartilhamento |
| `patients` | ✅ | ❓ | `userId` → auth.users (CASCADE) | CHECK age 0-150, weight 0-1000 |
| `push_subscriptions` | ✅ | ❓ | `userId` → auth.users | UNIQUE em `deviceToken` |
| `security_events` | ✅ | ❓ | `userId` → auth.users | Audit log |
| `sos_rules` | ✅ | ❓ | `patientId` → `patients` (CASCADE) | CHECK intervals positivos |
| `subscriptions` | ✅ | ❓ | `userId` → auth.users (PK) | Tier free/pro/plus + `consentAt` LGPD |
| `treatment_templates` | ✅ | ❓ | (sem FK paciente — global ou por user?) | Templates pré-definidos |
| `treatments` | ✅ | ❓ | `patientId` → `patients` (CASCADE) | CHECKs intervalHours>0, durationDays≤365 |
| `user_prefs` | ✅ | ✅ FORÇADO | `userId` → auth.users (PK) | Notif prefs DB-side |

**FORCE_RLS:** confirmado apenas em `user_prefs` (migration explícita). Demais: presumível mas não-confirmado via repo. **Ação recomendada:** rodar audit em todas as tabelas e adicionar `ALTER TABLE ... FORCE ROW LEVEL SECURITY` se faltar.

---

## 3. Análise de schema

### Pontos positivos
- ✅ FKs com `ON DELETE CASCADE` em todas as relações de paciente (Plan 0.3) — sem dados órfãos.
- ✅ CHECKs em `intervalHours`, `durationDays`, `age`, `weight`, lengths de strings.
- ✅ UUID para IDs públicos (presumível pelo padrão Supabase + uso de `auth.uid()`).
- ✅ `created_at`/`updated_at` presumível em todas (não confirmado por inspeção).
- ✅ Soft-delete via `deleted_at` **NÃO** é o padrão (hard-delete usado) — é uma decisão deliberada para LGPD compliance (Direito ao Esquecimento Art. 18 VI).

### Riscos / pontos de atenção
- ⚠️ `treatment_templates` — verificar se tem `userId` ou se é global; se global, precisa policy SELECT `USING (true)` que permita read para `authenticated`.
- ⚠️ Sem inspeção do remote_schema, não dá pra confirmar se há colunas `email`/`phone` em `patients` sem mascaramento — Plan documenta apenas `name, condition, doctor, allergies, age, weight`.
- ⚠️ `observation` em `doses` limitado a 500 chars (Data Minimization LGPD) — ✅ correto.

---

## 4. Indexes

Confirmados (Plan 0.1):
- `doses(patientId, scheduledAt)` — query principal de listDoses
- `doses(patientId, status, scheduledAt)` — filtragem por status
- `treatments(patientId, status)` — listagem ativa
- `push_subscriptions(userId)` — push lookup

**Faltam confirmar (recomendação):**
- `doses(userId, scheduledAt DESC)` — se queries usam `userId` direto sem join (verificar listDoses paginação 1000 rows)
- `doses(treatmentId)` — para CASCADE delete
- `patient_shares(patientId, userId)` — UNIQUE composto idealmente
- `sos_rules(patientId)`
- `security_events(userId, createdAt DESC)` — audit log scan
- GIN em `observation` se busca textual for usada (Plan 15 search por medName/observation).

**Ferramentas:**
- `pg_stat_user_indexes` para detectar indexes não usados
- `pg_stat_statements` para queries lentas

**Recomendação:** rodar audit periódica em produção (Plan 23.4 review trimestral).

---

## 5. Análise de RLS (CRÍTICA)

### 5.1 O que está confirmado
- ✅ `anon` role REVOKE ALL em 10/11 tabelas (migration `revoke_anon_grants.sql`).
- ✅ `user_prefs` com `FORCE_RLS` (migration explícita).
- ✅ Trigger `validate_dose_treatment_match` impede insert/update de dose com `treatmentId` de outro paciente.
- ✅ Trigger `enforce_sos_via_rpc_trigger` (Plan 0.3) bloqueia INSERT direto em doses com `type='sos'`.
- ✅ Trigger `enforce_patient_limit_trigger` (Plan SECURITY.md) — limite Free 1 paciente.

### 5.2 O que NÃO foi confirmado via repo
Sem `remote_schema.sql` populado, não temos o texto das policies. Verificar manualmente no Supabase Studio:

```sql
SELECT
  schemaname, tablename, policyname,
  permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'medcontrol'
ORDER BY tablename, policyname;
```

### 5.3 Riscos típicos a caçar
Conforme prompt original e auditoria docs:

- ❌ Tabela com RLS desabilitado → confirmar via `pg_class.relrowsecurity = true` em todas
- ❌ Policy `USING (true)` sem restrição → grep por `qual = 'true'`
- ❌ INSERT policy sem `WITH CHECK` → verificar `with_check IS NOT NULL` para policies INSERT
- ❌ UPDATE policy permitindo trocar `userId`/`patientId` → `with_check` deve repetir `qual`
- ❌ JOINs em policies que vazam dados → review `qual` complexos
- ❌ Anon role com SELECT em tabelas com PII (já mitigado pelo REVOKE)

### 5.4 Padrão esperado por tabela

```sql
-- patients
USING (userId = auth.uid() OR EXISTS (
  SELECT 1 FROM medcontrol.patient_shares
  WHERE patientId = patients.id AND userId = auth.uid()
))
WITH CHECK (userId = auth.uid())

-- doses
USING (medcontrol.has_patient_access(patientId))
WITH CHECK (medcontrol.has_patient_access(patientId))

-- push_subscriptions
USING (userId = auth.uid()) WITH CHECK (userId = auth.uid())
```

### 5.5 Backlog FASE 8.3 (Plan)
- [ ] Recriar policies com `TO authenticated` explícito (não `TO public`).
- [ ] Splitar policies `cmd=ALL` em 4 separadas (SELECT/INSERT/UPDATE/DELETE) para clareza.

---

## 6. Funções e triggers

### 6.1 RPCs SECURITY DEFINER (Plan 0.3 + SECURITY.md)
- `register_sos_dose(p_patient_id, p_med_name, p_unit)` — valida `minIntervalHours` + `maxDosesIn24h`
- `create_treatment_with_doses(payload jsonb)` — ownership + limit `durationDays ≤ 365`
- `update_treatment_schedule(...)` — regenera doses atomicamente
- `confirm_dose(p_id, p_actual_time, p_observation)` — state machine
- `skip_dose(p_id, p_observation)` — state machine
- `undo_dose(p_id)` — state machine
- `delete_my_account()` — LGPD cascade
- `admin_grant_tier(p_user_id, p_tier)` — protegida por `is_admin()`
- `upsert_push_subscription(p_device_token, p_platform, p_advance_mins, p_user_agent)` — cross-user device transfer
- `has_patient_access(p_patient_id)` — helper para policies
- `is_admin()` — helper

⚠️ **Verificar em todas:** `SET search_path = medcontrol, pg_temp` (CVE comum em SECURITY DEFINER quando search_path mutável).

### 6.2 Triggers
- `validate_dose_treatment_match_trigger` — BEFORE INSERT/UPDATE de `patientId|treatmentId` em doses
- `enforce_sos_via_rpc_trigger` — bloqueia INSERT direto type=sos
- `enforce_patient_limit_trigger` — limite Free
- (presumível) `update_updated_at_trigger` em todas as tabelas com updated_at

### 6.3 RPC perdida — `extend_continuous_treatments`
- ⚠️ Plan FASE 18.4.5 + 23.5: RPC sumiu do schema (PGRST202 404).
- Mitigação atual: pg_cron diário + chamadas client comentadas em Dashboard.
- Recriar (P2) — ver `06-bugs.md#bug-004`.

---

## 7. Edge Functions (`supabase/functions/`)

### 7.1 `delete-account/index.ts` (74 linhas)
- ✅ **Auth check OK** (linha 35-46): valida JWT via `getUser()`.
- ❌ **Sem rate limit** — risk DoS (BUG-003 P2).
- ✅ CORS OK (linha 14-18).
- ✅ Service role encapsulado.
- ✅ Chama RPC `delete_my_account()` (cascade) + fallback `auth.admin.deleteUser()`.
- ✅ Tratamento de erro razoável.

### 7.2 `send-test-push/index.ts` (120 linhas) — **CRÍTICO**
- ❌ **SEM auth check de admin** (BUG-002 P0).
- ❌ Sem rate limit.
- ❌ Email enumeration (BUG-015): retorna 404 com `user not found: ${email}`.
- ✅ Service role encapsulado.
- ⚠️ Mitigação parcial: gateway Supabase exige JWT por default (sem `verify_jwt = false`), mas qualquer authenticated user invoca.
- ✅ Cache JWT FCM com expiração.
- ✅ FCM payload correto (priority HIGH, default sound).

**Recomendação:** snippet em `06-bugs.md#bug-002`.

### 7.3 `notify-doses/index.ts` (242 linhas)
- ❌ Sem auth check (função é cron do Supabase — gated implicitamente).
- ✅ Filter por window now ± advanceMins.
- ✅ FCM 404/UNREGISTERED → DELETE token (bom housekeeping).
- ✅ Secrets via env.
- ✅ Implementação JWT OAuth Firebase nativa (sem deps suspeitos).

⚠️ Validar que função não está exposta via URL pública sem auth — Supabase Functions têm flag `[functions.<name>] verify_jwt = true` por default, mas se `verify_jwt = false` algum dev seteu manualmente no dashboard, qualquer um chama. **Conferir no Supabase Dashboard → Functions → Settings.**

---

## 8. Storage buckets

- `grep -r "storage.from(" src/` → 0 resultados ✅ — app **NÃO usa storage**.
- `config.toml` Storage habilitado mas sem buckets configurados.
- Quando implementar comprovantes/imagens (Plan FASE 15 backlog): definir bucket privado + policies por user.

---

## 9. Realtime

- `grep "channel(" src/` → 1 resultado: `src/hooks/useRealtime.js`.
- Canal `realtime:${user.id}` (privado por auth.uid()).
- Tabelas presumíveis com Realtime: `patients`, `treatments`, `doses`, `sos_rules`, `treatment_templates`, `subscriptions`, `patient_shares`.

⚠️ **Custo:** Realtime cobra por concurrent connections (Free 200). Para 1k usuários simultâneos = upgrade necessário. Avaliar se realmente precisa todas as tabelas (talvez `patient_shares` poderia ser polled em vez de realtime).

---

## 10. Auth (config.toml + cloud)

### Local config (`config.toml`)
- `jwt_expiry = 3600` (1h) ✅
- `enable_refresh_token_rotation = true` ✅
- `refresh_token_reuse_interval = 10` ✅
- `enable_anonymous_sign_ins = false` ✅
- `enable_signup = true`
- `minimum_password_length = 6` ⚠️ **fraco** (BUG-008 P2)
- `password_requirements = ""` ⚠️ sem regex
- `enable_confirmations = false` ⚠️ local dev only — cloud é true por afirmação Plan (BUG-009 P3)
- Rate limits razoáveis: `sign_in_sign_ups = 30 / 5min`, `token_verifications = 30 / 5min`

### Recomendações
- Subir para `minimum_password_length = 8` + `password_requirements = "lower_upper_letters_digits"`.
- Confirmar via dashboard cloud.
- 2FA TOTP — Plan 23.5 backlog (não-bloqueante).

### OAuth providers
- Apple/Google/Facebook etc — todos `enabled = false` no config.toml. Plan documenta que `useAuth.jsx` tem código OAuth comentado (Google/Facebook). Não-bloqueante.

---

## 11. Backups e PITR

- `config.toml` não menciona PITR (não é configurável local — só cloud).
- ⚠️ Verificar Supabase Dashboard → Project → Settings → Backups: PITR habilitado?
- Pro plan necessário para retenção 7+ dias.

**Recomendação:**
- Habilitar PITR antes do Beta.
- Testar restore manual (drill) em projeto staging antes do launch.
- Documentar runbook de DR em `docs/runbook-dr.md` (Plan 23.4 backlog).

---

## 12. Observabilidade Supabase

- Logs: habilitado por default.
- Database webhooks: nenhum configurado no repo.
- Métricas custom: nenhum, mas PostHog cobre client-side (Plan FASE 14).

**Recomendação:**
- Configurar webhook `auth.users` INSERT → analytics evento `signup_completed`.
- Configurar alertas em Supabase Dashboard: query latency > 500ms, error rate > 1%.

---

## 13. Estimativa de custos (FinOps)

> Projeção rough — confirmar com pricing atualizado Supabase.

| Recurso | Limite Free | Uso atual estimado | A 1k MAU | A 10k MAU |
|---|---|---|---|---|
| Database size | 500 MB | <50 MB (poucas tabelas, sem blob) | ~150 MB | ~2 GB → **Pro plan** |
| Bandwidth | 5 GB/mês | <0.5 GB | ~5 GB → **Pro** | ~50 GB |
| Edge Function invocations | 500k/mês | <5k (notify-doses cron + delete + test-push) | ~200k | ~2M → **Pro** |
| Storage | 1 GB | 0 (não usa) | ainda 0 | depende de comprovantes Plan 15 |
| Realtime concurrent | 200 | <10 | ~50 | ~500 → **Pro** |
| Auth MAUs | 50k | ~5 | ~1k | ~10k |

**Conclusão:** Free aguenta MVP, beta de até 200 testers. **Pro plan ($25/mês)** vira necessário em rampagem para 1-10k MAU.

---

## 14. Riscos críticos consolidados

| Risco | Severidade | Mitigação atual | Pendente |
|---|---|---|---|
| RLS desabilitado em alguma tabela | **P0** | Migrations forçam em user_prefs | Confirmar nas demais |
| Policy USING(true) sem restrição | **P0** | Plan diz auditado FASE 5.2 | Re-conferir via pg_policies |
| `send-test-push` sem auth admin | **P0** | Gateway exige JWT | BUG-002 |
| Email enumeration `send-test-push` | **P0** | — | BUG-015 |
| Senha postgres vazada git | **P0** | Scripts refatorados | BUG-013 (rotação manual pendente) |
| Funções SECURITY DEFINER sem search_path fixed | **P1** | Plan 7.1 mitigou parcial | Confirmar nas demais |
| `delete-account` sem rate limit | **P2** | — | BUG-003 |
| `extend_continuous_treatments` sumiu | **P2** | pg_cron fallback | BUG-004 |
| min_password_length=6 | **P2** | Frontend valida 8+ | BUG-008 |
| PITR não configurado | **P2** | — | Habilitar antes Beta |

---

## 15. Recomendações SQL prontas

### 15.1 Audit completo de RLS

```sql
-- Verifica RLS habilitado e forçado em todas as tabelas medcontrol
SELECT
  c.relname AS tabela,
  c.relrowsecurity AS rls_habilitado,
  c.relforcerowsecurity AS rls_forcado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'medcontrol' AND c.relkind = 'r'
ORDER BY tabela;
```

### 15.2 Audit de policies

```sql
SELECT
  schemaname, tablename, policyname,
  permissive, roles, cmd,
  COALESCE(qual::text, '∅ NO USING') AS using_clause,
  COALESCE(with_check::text, '∅ NO WITH CHECK') AS with_check_clause
FROM pg_policies
WHERE schemaname = 'medcontrol'
ORDER BY tablename, cmd, policyname;
```

### 15.3 Audit de SECURITY DEFINER + search_path

```sql
SELECT
  p.proname AS funcao,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security,
  p.proconfig AS config_overrides  -- procurar 'search_path=...'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'medcontrol' AND p.prosecdef = true
ORDER BY funcao;
```

Para cada SECURITY DEFINER sem search_path setado:
```sql
ALTER FUNCTION medcontrol.<nome>(<args>) SET search_path = medcontrol, pg_temp;
```

### 15.4 Audit de grants

```sql
SELECT grantee, privilege_type, table_name
FROM information_schema.role_table_grants
WHERE table_schema = 'medcontrol' AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, table_name;
```

Esperado: `anon` com 0 linhas (após migration 7.1).

### 15.5 Recomendar criação de indexes faltantes

```sql
-- Indexes para queries frequentes
CREATE INDEX IF NOT EXISTS idx_doses_user_scheduled ON medcontrol.doses (userId, scheduledAt DESC);
CREATE INDEX IF NOT EXISTS idx_doses_treatment ON medcontrol.doses (treatmentId);
CREATE INDEX IF NOT EXISTS idx_patient_shares_patient_user ON medcontrol.patient_shares (patientId, userId);
CREATE INDEX IF NOT EXISTS idx_sos_rules_patient ON medcontrol.sos_rules (patientId);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON medcontrol.security_events (userId, createdAt DESC);
```

(Antes de criar, validar via `pg_stat_statements` se a query realmente faz scan sequencial.)

### 15.6 FORCE_RLS em todas as tabelas

```sql
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'medcontrol' AND c.relkind = 'r'
      AND c.relrowsecurity = true AND c.relforcerowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE medcontrol.%I FORCE ROW LEVEL SECURITY;', r.relname);
  END LOOP;
END $$;
```

---

## 16. Score Supabase

| Sub-dimensão | Score (0-10) |
|---|---|
| Schema & integrity (CHECKs, FKs, types) | 8.0 |
| RLS + grants | 7.5 (bom defense-in-depth, falta confirmar policies refinadas) |
| RPCs + state machines | 9.0 (sólido) |
| Edge Functions | 5.0 (BUG-002 P0 derruba) |
| Migrations versionadas | 6.5 (baseline vazio é gap) |
| Indexes | 7.0 (cobre queries principais) |
| Auth config | 6.5 (senha 6 chars é fraco) |
| Storage | N/A (não usado) |
| Realtime | 7.5 (correto, mas custo a monitorar) |
| Backups & DR | 4.0 (não confirmado PITR + sem drill) |
| **MÉDIA** | **6.7** |

**Conclusão:** infraestrutura DB + RLS + RPCs é **sólida** e mostra evolução ao longo das auditorias prévias. **Edge Function `send-test-push`** é o ponto crítico que deve ser corrigido antes de qualquer publicação.
