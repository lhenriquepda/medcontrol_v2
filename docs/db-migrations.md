# Database Migrations — Fluxo de Trabalho

> Versionamento de schema do projeto Dosy (`guefraaqbkcehofchnrc`, schema `medcontrol`).
> Setup: Supabase CLI 2.90+ via Scoop. Project link em `supabase/config.toml`.

---

## ⚠ Limitação atual

`supabase db pull` (baseline dump) exige Docker Desktop OU DB password explícito. Decisão: **forward-only migrations** sem baseline dump por enquanto.

- Estado atual em prod = "baseline implícito" documentado em `docs/audits/Auditoria-4.5.2.md`
- Próximas mudanças entram como migrations versionadas em `supabase/migrations/`
- Quando precisar: instalar Docker Desktop e rodar `supabase db pull --schema medcontrol` pra retroativo

---

## Fluxo padrão pra mudança de schema

### 1. Criar nova migration
```bash
supabase migration new <nome_descritivo>
# Ex: supabase migration new revoke_anon_grants
```

Gera arquivo `supabase/migrations/YYYYMMDDHHMMSS_revoke_anon_grants.sql`. Editar com SQL puro:

```sql
-- supabase/migrations/20260428150000_revoke_anon_grants.sql
REVOKE ALL ON medcontrol.patients FROM anon;
REVOKE ALL ON medcontrol.treatments FROM anon;
-- ... etc
```

### 2. Aplicar em prod (3 caminhos)

**Caminho A — via Management API (sem Docker):**
```bash
SUPABASE_PAT=sbp_xxx node tools/apply-migration.cjs supabase/migrations/<arquivo>.sql
```
(Ver script `tools/apply-migration.cjs` abaixo. Usa endpoint `/v1/projects/{ref}/database/query`.)

**Caminho B — `supabase db push` (exige Docker OU DB password):**
```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx supabase db push
```

**Caminho C — manual via Supabase Dashboard:**
- Cole SQL em SQL Editor do Dashboard
- Executar
- Commitar arquivo da migration no repo (audit trail)

### 3. Verificar
```bash
SUPABASE_PAT=sbp_xxx node tools/audit-db.cjs "<query verificação>"
```

### 4. Commit
```bash
git add supabase/migrations/<arquivo>.sql
git commit -m "db: <descrição>"
```

---

## Regras de equipe

1. **ZERO edits diretos em prod schema.** Toda mudança via migration commitada.
2. **Migrations são imutáveis após push.** Mudou? Cria nova migration corretiva.
3. **Migrations são DDL apenas.** DML (INSERT/UPDATE de dados) vai via RPC ou seed scripts separados.
4. **Naming pattern:** `YYYYMMDDHHMMSS_descritivo_em_snake_case.sql`. Verbo no infinitivo (`add_check_treatments`, `drop_overload_create_treatment`).
5. **Cada PR com migration:** descrever em commit message + testar em staging antes de merge (quando staging existir).

---

## Exemplos de migrations futuras (FASES 7+8)

- `20260428_revoke_anon_grants.sql` — Aud 5.2 G1
- `20260428_force_rls_user_prefs.sql` — Aud 5.2 G2
- `20260428_drop_overload_create_treatment.sql` — Aud 5.2 G4
- `20260428_check_constraints_treatments.sql` — Aud 5.2 G6
- `20260428_check_constraints_patients.sql` — Aud 5.2 G8
- `20260428_check_constraints_sos_rules.sql` — Aud 5.2 G7
- `20260428_trigger_dose_treatment_match.sql` — Aud 5.2 G5
- `20260428_policies_to_authenticated.sql` — Aud 5.2 G3
- `20260428_split_all_policies.sql` — Aud 5.2 G9

---

## Quando adicionar Docker Desktop?

Se quiser usar:
- `supabase start` (DB local pra testes)
- `supabase db pull` (dump baseline)
- `supabase db reset` (reseta local pra estado dos migrations)
- `supabase test db` (testes pgTAP)

Por enquanto, com migrations forward-only via Management API, Docker é dispensável.
