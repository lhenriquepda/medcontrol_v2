# Auditoria 4.5.2 — DB Schema + RLS

> **Tipo:** read-only (introspecção via Supabase Management API)
> **Data:** 2026-04-28
> **Projeto:** dosy-app (`guefraaqbkcehofchnrc`)
> **Schema:** `medcontrol` (11 tabelas)
> **Postgres:** 17.6.1.104

---

## 📊 Pontuação de Risco

| Dimensão | Score (0-10) | Nota |
|---|---|---|
| RLS habilitado | 10 | 11/11 tabelas |
| FORCE RLS | 9 | 10/11 tabelas (gap: user_prefs) |
| Policies por operação | 6 | Mix — várias com `cmd=ALL` única |
| Role explícito (`authenticated`) | 3 | Todas usam `{public}` (inclui anon) |
| Grants tabela explícitos | 2 | anon tem TODOS os privilégios em 10 tabelas |
| FK + CASCADE | 10 | Todas FKs com ON DELETE CASCADE corretas |
| CHECK constraints | 5 | Algumas presentes, gaps em treatments/patients/sos_rules |
| UNIQUE composto | 9 | Patient_shares + push_subs OK |
| Triggers de validação | 4 | 2 triggers (SOS bypass + patient limit). Falta cross-FK ownership |
| Indexes | 9 | Coverage abrangente em FKs + query patterns |
| RPCs SECURITY DEFINER | 9 | 22/23 SD (1 não-SD: admin_email — OK) |
| Overloads dead code | 7 | `create_treatment_with_doses` tem 2 signatures (gap menor) |
| **Score global** | **7.0** | Sólido, mas defesa em profundidade fraca em grants |

---

## 🔍 Inventário

### 11 Tabelas
| Tabela | RLS | Force RLS | Policies | Triggers | Notes |
|---|---|---|---|---|---|
| `admins` | ✓ | ✓ | 0 | — | Sem policy = só SD funcs (correto) |
| `doses` | ✓ | ✓ | 4 (S/I/U/D) | enforce_sos_via_rpc BEFORE INSERT | OK |
| `patient_shares` | ✓ | ✓ | 3 (S/I/D, sem U) | — | Imutável após criar |
| `patients` | ✓ | ✓ | 6 (own 4 + shared 2) | enforce_patient_limit BEFORE INSERT | OK |
| `push_subscriptions` | ✓ | ✓ | 1 (ALL) | — | Considerar split |
| `security_events` | ✓ | ✓ | 2 (admin_all + own_select) | — | OK |
| `sos_rules` | ✓ | ✓ | 4 (S/I/U/D) | — | OK |
| `subscriptions` | ✓ | ✓ | 3 (admin_all + own_select + own_upsert) | — | OK |
| `treatment_templates` | ✓ | ✓ | 4 (S/I/U/D) | — | OK |
| `treatments` | ✓ | ✓ | 4 (S/I/U/D) | — | OK |
| `user_prefs` | ✓ | **✗** | 1 (ALL) | — | ⚠ Sem force_rls |

### 23 Functions (medcontrol schema)
- 22 SECURITY DEFINER ✓
- 1 não-SD: `admin_email` (stable, helper) — OK
- 2 com mesmo nome `create_treatment_with_doses` (overload, ⚠ dead code)
- Funções principais: confirm_dose, skip_dose, undo_dose, register_sos_dose, create_treatment_with_doses, update_treatment_schedule, share_patient_by_email, list_patient_shares, unshare_patient, my_tier, admin_grant_tier, admin_list_users, delete_my_account, has_patient_access, is_admin, effective_tier, on_new_user_subscription, enforce_sos_via_rpc, enforce_patient_limit, extend_continuous_treatments, extend_all_active_continuous, upsert_push_subscription

### 2 Triggers
- `doses.enforce_sos_via_rpc_trigger` (BEFORE INSERT) — bloqueia INSERT direto SOS
- `patients.enforce_patient_limit_trigger` (BEFORE INSERT) — limite por tier

### 2 pg_cron jobs
- `anonymize-old-doses` (Domingos 3h) — LGPD: anonimiza observation +3 anos
- `extend-continuous-treatments-daily` (4h) — sliding window 5d

### Indexes (33 total)
- Cobertura completa de FKs (`userId`, `patientId`, `treatmentId`, `ownerId`, `sharedWithUserId`)
- Compostos query-pattern: `(patientId, scheduledAt)`, `(patientId, status, scheduledAt)`, `(patientId, status)`
- Partial: `treatments_horizon_idx WHERE status='active' AND isContinuous=true`
- security_events: `(event_type, created_at DESC)` — query admin recente

---

## 🚩 Gaps Identificados

### CRÍTICO (P0)

#### G1. anon role tem FULL TABLE GRANTS em 10/11 tabelas
- Privilégios concedidos a `anon`: SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
- Aplica-se a: `admins`, `doses`, `patient_shares`, `patients`, `push_subscriptions`, `security_events`, `sos_rules`, `subscriptions`, `treatment_templates`, `treatments`
- Única exceção: `user_prefs` (apenas authenticated tem grants)
- **Risco:** RLS é única camada bloqueando anon. Se policy tiver bug lógico → anon escapa. Defense-in-depth quebrada.
- **Mitigação atual:** policies usam `auth.uid() = userId` que retorna NULL pra anon → bloqueia. Funciona mas frágil.
- **Fix:** `REVOKE ALL ON medcontrol.<tabela> FROM anon` em todas exceto onde anon legitimamente precisa (ex: nenhuma neste app — login obrigatório).
- **Severidade:** P0 — defense-in-depth em saúde é mandatory.

### ALTO (P1)

#### G2. `user_prefs` sem FORCE ROW LEVEL SECURITY
- 10/11 tabelas têm `force_rls=true`. user_prefs é exceção.
- **Risco:** owner do role pode bypassar RLS. Em Supabase, table owner = `postgres`. Service role conecta como postgres → BYPASSA RLS automaticamente. Mas qualquer função SECURITY DEFINER por owner postgres também bypassa. Isso é por design no Supabase, mas FORCE_RLS adiciona camada extra (recomendado em saúde).
- **Fix:** `ALTER TABLE medcontrol.user_prefs FORCE ROW LEVEL SECURITY`

#### G3. Todas policies usam role `{public}` (não explicitamente `authenticated`)
- Policies em `pg_policies` mostram `roles: {public}`. Role `public` inclui `anon` + `authenticated`.
- **Risco:** depende de `auth.uid() = ...` retornar NULL/falso pra anon. Funciona mas implícito. Daily-money recomenda explícito `TO authenticated`.
- **Fix:** recriar policies com `TO authenticated` (`CREATE POLICY ... FOR ... TO authenticated USING (...)`).
- **Combo com G1:** se G1 fixed (REVOKE FROM anon) → G3 perde urgência. Mas explicitness ajuda audit/compliance.

#### G4. `create_treatment_with_doses` overload (dead code)
- 2 versões coexistem:
  - V1: 10 params (sem `p_timezone`)
  - V2: 11 params (com `p_timezone`)
- Cliente atual chama V2 (`treatmentsService.js` passa `p_timezone`). V1 nunca é chamada.
- **Risco:** se algum caller cair na V1 (default args mal alinhados), comportamento diferente. Bug latente.
- **Fix:** `DROP FUNCTION medcontrol.create_treatment_with_doses(uuid, text, text, integer, integer, boolean, timestamptz, text, text, boolean)` (V1 sem p_timezone).

#### G5. Sem trigger de cross-FK ownership em doses
- Cenário: cliente envia INSERT em `doses` com `patientId=X` + `treatmentId=Y` onde Y pertence a outro patient.
- RLS valida `has_patient_access(patientId)` → OK
- FK valida que treatmentId existe → OK
- **Mas NADA valida que treatment.patientId == dose.patientId**
- **Risco:** dose "órfã" — patient X mostra dose, mas treatment é de Y. Histórico corrompido.
- **Fix:** trigger BEFORE INSERT em doses validando `(SELECT patientId FROM treatments WHERE id=NEW.treatmentId) = NEW.patientId` quando treatmentId não-NULL.

#### G6. CHECK constraints faltantes em treatments
- Sem `CHECK (intervalHours > 0)` ou `CHECK (intervalHours >= 1)` — pode inserir 0/negativo
- Sem `CHECK (durationDays > 0)` — pode inserir 0/negativo (mitigado por RPC limite ≤365, mas acesso direto não)
- Sem `CHECK (length(medName) <= 200)` — DoS via string gigante
- Sem `CHECK (length(unit) <= 100)`
- **Risco:** baixo→médio (RPC limita, mas RLS permite UPDATE direto via PostgREST sem RPC).

#### G7. CHECK constraints faltantes em sos_rules
- Sem `CHECK (minIntervalHours > 0)`, `CHECK (maxDosesIn24h > 0)`
- Sem `CHECK (length(medName) <= 200)`

#### G8. CHECK constraints faltantes em patients
- Sem `CHECK (length(name) <= 200)`, `CHECK (length(condition) <= 500)`, `CHECK (length(doctor) <= 200)`, `CHECK (length(allergies) <= 500)`
- Sem `CHECK (age >= 0 AND age <= 150)`
- Sem `CHECK (weight > 0 AND weight < 1000)` (kg sanity)

### MÉDIO (P2)

#### G9. Policies `cmd=ALL` em vez de 4 separadas
- Tabelas afetadas: `push_subscriptions` (push_own_all), `user_prefs` (user_prefs_own), `subscriptions` (sub_admin_all), `security_events` (security_events_admin_all)
- **Risco:** baixo. ALL com mesma `qual` + `with_check` é equivalente. Mas split permite `WITH CHECK` precisamente em UPDATE bloqueando alteração de `userId`/`createdAt`.
- **Fix opcional:** dividir em 4 policies com `WITH CHECK` específico em UPDATE.

#### G10. Sem auditoria UPDATE bloqueando alteração de `userId`
- `WITH CHECK` em UPDATE policies usa mesma condição do `qual` (USING). Não impede usuário re-atribuir `userId` pra outro user, depois perder acesso.
- Cenário: user X faz `UPDATE patients SET userId='outro_user' WHERE id=p1` — passa USING (userId=auth.uid()) MAS WITH CHECK (userId=auth.uid()) avalia DEPOIS do update → falha → bloqueado. OK.
- **Status:** funcionando. Validar via pen test.

#### G11. anon tem grant `REFERENCES`
- Permite criar FKs externas apontando pras tabelas medcontrol.
- **Risco:** mínimo. Mas remove é trivial.
- **Fix:** parte do REVOKE ALL FROM anon (G1).

### BAIXO (P3)

#### G12. Sem audit_log abrangente
- Só `security_events` registra tier change + delete account.
- Daily-money recomenda audit_log completo: triggers em INSERT/UPDATE/DELETE de TODAS tabelas → grava (userId, action, payload, ip, ua, createdAt).
- **Aplicabilidade Dosy:** parcial. Em saúde, ter trail completo de mudanças (especialmente em doses + treatments) ajuda em incident response e LGPD audit. Mas custo de storage cresce rápido.
- **Fix:** opcional pós-launch. Considerar partial audit (apenas DELETE + UPDATE em campos sensíveis).

#### G13. Patient_shares sem `updatedAt`
- Tabela tem só `createdAt`. Tudo mais é imutável (sem policy UPDATE).
- **Status:** OK por design.

#### G14. `medcontrol_dump.sql` em tools/ é arquivo vazio (0 bytes)
- Histórico de schema não está versionado.
- Vinculado à FASE 4.5.5 (Supabase CLI migrations) já planejada.

---

## 🎯 Top 10 Recomendações Priorizadas

| # | Ação | Severidade | Esforço | Quando |
|---|---|---|---|---|
| 1 | `REVOKE ALL ON medcontrol.<tabelas> FROM anon` (10 tabelas) | P0 | XS | Imediato |
| 2 | `ALTER TABLE medcontrol.user_prefs FORCE ROW LEVEL SECURITY` | P1 | XS | Imediato |
| 3 | Recriar policies com `TO authenticated` explícito (todas tabelas) | P1 | S | Antes Beta |
| 4 | `DROP FUNCTION medcontrol.create_treatment_with_doses` V1 (10 params) | P1 | XS | Imediato |
| 5 | Adicionar CHECK constraints: `treatments.intervalHours/durationDays > 0`, length max em medName/unit/observation | P1 | S | Antes Beta |
| 6 | Adicionar CHECK em `sos_rules.minIntervalHours/maxDosesIn24h > 0` + length | P1 | XS | Imediato |
| 7 | Adicionar CHECK em `patients` (length name/condition/doctor/allergies, age/weight sanity) | P1 | XS | Imediato |
| 8 | Trigger `validate_dose_treatment_match` BEFORE INSERT/UPDATE em doses | P1 | S | Antes Beta |
| 9 | Splitar policies `cmd=ALL` em 4 (push_subs, user_prefs, subscriptions admin, security_events admin) | P2 | S | Antes Beta |
| 10 | Audit_log table + triggers seletivos (UPDATE/DELETE em doses/treatments/patients) | P3 | M | Pós-launch |

**Esforço:** XS=<30min · S=1-3h · M=meio dia · L=1+ dia

---

## 📈 Métricas Atuais

```
Tabelas medcontrol:           11
Policies total:               31
Policies com TO authenticated: 0 (todas via {public})
RLS enabled:                  11/11
FORCE RLS:                    10/11 (gap: user_prefs)
FK ON DELETE CASCADE:         18/18 ✓
UNIQUE constraints:           4 (push_subs deviceToken/endpoint, patient_shares composto)
CHECK constraints:            6 (doses observation/type/status, push_subs target, subscriptions tier, treatments status)
Indexes:                      33 (4 PK únicos + 29 secundários)
Triggers de validação:        2 (SOS bypass + patient limit)
SECURITY DEFINER funcs:       22/23
Overloads (dead code):        1 (create_treatment_with_doses V1)
pg_cron jobs ativos:          2 (anonymize-old-doses + extend-continuous-treatments)
anon role tem grants em:      10/11 tabelas (gap P0)
```

---

## 🔄 Próximos passos (NÃO desta auditoria)

Achados desta auditoria devem ser propagados em `Plan.md` na FASE 4.6 (consolidação) — criar sub-fases concretas:

- **FASE 0.4 — Hardening DB v2 (pós-auditoria)** entra DENTRO da FASE 0:
  - 0.4.1 REVOKE ALL FROM anon (G1) — P0 imediato
  - 0.4.2 FORCE RLS em user_prefs (G2)
  - 0.4.3 Policies com TO authenticated (G3)
  - 0.4.4 DROP overload create_treatment_with_doses V1 (G4)
  - 0.4.5 CHECKs faltantes em treatments/sos_rules/patients (G6/G7/G8)
  - 0.4.6 Trigger cross-FK ownership doses (G5)
  - 0.4.7 Splitar policies ALL (G9) — opcional
- **Backlog pós-launch:** G12 audit_log abrangente

Auditorias seguintes (4.5.3 UX/A11y, 4.5.4 Mobile Security, etc) podem revelar gaps adicionais. Consolidação final em FASE 4.6.
