# Roteiro Alinhamento medcontrol_v2 ↔ Dosy v2 — versão AMBICIOSA

> **Status:** Roteiro executável criado 2026-05-22 por análise comparativa medcontrol_v2 (v0.2.5.0 vc 83) vs Dosy v2 (rewrite documentado em 22 docs + 15 ADRs).
> **Audiência:** IA executora trabalhando no medcontrol_v2.
> **Self-contained:** este documento contém todo contexto necessário pra executar sem depender da sessão de análise.
> **Meta:** levar medcontrol_v2 o mais próximo possível da perfeição — incorporando TUDO de melhor que existe nos docs Dosy v2 + preservando TUDO de bom que medcontrol já tem em prod. **NADA fica "pra Dosy v2 fazer".**

---

## 1. Contexto compacto

**Quem é Dosy v2:**
- Rewrite from-scratch do medcontrol_v2 documentado em `G:\00_Trabalho\01_Pessoal\Apps\dosy-app\`
- Está em **Fase 0 (Docs upfront)** — 22 docs principais + 15 ADRs + workflow operacional
- ADR-003 manda **reuso literal** da camada nativa Android Java do medcontrol (12 arquivos, ~5.400 LOC)
- Vai consumir ~10-11 semanas até Internal Testing ship (Fase 5)
- Spec consolidada inclui lições dos bugs reportados em prod 2026-05-22 (dropdown autocomplete + Histórico só dia + Escitalopram)

**O que medcontrol_v2 deve fazer com este roteiro:**

Trazer pra dentro do medcontrol_v2 **tudo** que está melhor nos docs Dosy v2 — implementando, adaptando, refatorando — mesmo que isso signifique mexer em áreas grandes. **A meta é que medcontrol_v2 sirva como referência viva** do que Dosy v2 vai consolidar.

**Princípios de execução:**
1. **Nenhum gap fica de fora** — se existe nos docs Dosy v2, tenta implementar em medcontrol
2. **Migrations sempre versionadas** (fim da era "aplica via Supabase MCP sem SQL")
3. **Cada P0/P1 fix tem regression test** ou validation device antes de fechar
4. **Branches `chore/`, `fix/`, `feat/`, `refactor/`** pequenas mergeable em master
5. **Não regredir** bugs já fixados (consultar `context/BUGS.md` antes de mexer em hot path)
6. **Documentar tudo** em `context/` conforme padrão medcontrol existente + adotar Regras 16+17 do Dosy v2

**O que NÃO está no escopo (raro):**
- Renomear `applicationId` `com.dosyapp.dosy` — manter (ADR-004)
- Renomear schema namespace `medcontrol` no app vivo — Dosy v2 começa com `dosy`, medcontrol continua `medcontrol` (cross-app migration acontece quando users migrarem)
- Trocar Firebase project `dosy-b592e` se está estável

---

## 2. Sumário executivo do que está EXCELENTE vs QUEBRADO

### ✅ Excelente (manter e usar como base)

- Native Android Java 12 arquivos production-ready
- Manifest hardening completo (15 permissions justificadas, FOREGROUND_SERVICE_SPECIAL_USE)
- Stack versions alinhadas com Dosy v2 ADRs
- `dosy-tokens.css` autoritativo + `animations.js` corretos
- 25 primitives Dosy implementadas (Card/Button/Input/Sheet/Modal/Avatar/StatusPill/Toast/Icon)
- Custom Access Token Hook tier JWT
- Trigger system FCM elaborado (statement-level batch + single-row insert)
- RLS hardening exemplar
- TZ fix consolidado (AT TIME ZONE pattern)
- Categorias v0.2.4.0+v0.2.5.0 funcionais (5 commits shipped)
- DCB ranking + `classify_medication_robust` 5 tiers (lições medcontrol que vão pro Dosy v2)

### 🔴 Quebrado (este roteiro vai consertar)

- `remote_schema.sql` VAZIO
- 4 conjuntos migrations NÃO-versionadas
- Realtime DESABILITADO em prod
- `versionedCache.reconcileDoses` zumbi
- Conflict resolution 409 inexistente
- UI ↔ Supabase direto em 5+ JSX (viola arquitetura)
- Sentry PII strip incompleto (LGPD risk)
- PostHog inicia sem consent
- `Sentry.captureException` usado 1 vez (121 catches silenciosos)
- MedNameInput dropdown inline (3 bugs estruturais)
- Coverage 4.35% global
- `request-schedule-sync` STUB em prod (vulnerabilidade)
- `scheduler.js` healthcare-critical 0% coverage
- 7 NB-4 variants sem regression test consolidado
- ~480 LOC FCM OAuth duplicados (sem `_shared/fcm.ts`)
- `dose-fire-time-notifier` cron 1440 invocações/dia (drop planejado mas não feito)
- Refactor_Full Fases 2-5 incompletas
- Engine ADR-012 ausente
- 10+ tabelas/triggers/RPCs faltantes vs spec Dosy v2

---

## 3. Estrutura do roteiro

| Camada | Tema | # Items | Tempo estimado |
|---|---|---|---|
| **P0** | Segurança / LGPD / Reproducibilidade | 6 | 1 semana |
| **P1** | Arquitetural (correções fundamentais) | 14 | 2-3 semanas |
| **P2** | Refactor_Full Fases 2-5 (concluir) | 18 | 4-6 semanas |
| **P3** | Backport schema + RPCs + Edge Functions Dosy v2 | 24 | 6-8 semanas |
| **P4** | UI primitives Dosy v2 (backport completo) | 22 | 4-5 semanas |
| **P5** | Test stack completo (pgTAP + Deno + regression) | 15 | 3-4 semanas |
| **P6** | Documentação (gaps absorvidos) | 14 | 1-2 semanas |
| **P7** | Limpeza estrutural | 13 | 1-2 semanas |
| | **TOTAL** | **126** | **~5-7 meses solo dev** |

Esta é uma jornada de meses, mas cada item é independente e mergeable. Pode parar em qualquer momento e continuar — o app permanece sempre shippable.

---

## 4. P0 — Críticos (segurança, LGPD, reproducibilidade)

### P0.1 Versionar SQL das migrations v0.2.4.0+ aplicadas via MCP em prod

**Rationale:** Schema-as-code restaurado. Sem isso, recriação from scratch impossível, deploy em novo projeto Supabase impossível.

```bash
cd "G:\00_Trabalho\01_Pessoal\Apps\medcontrol_v2"
git checkout -b chore/versionar-migrations-categorias
supabase db diff --use-migra > supabase/migrations/$(date +%Y%m%d%H%M%S)_categorias_v0_2_4_0_to_v0_2_5_0_replay.sql

# Revisar diff manualmente. Deve conter:
# - ALTER medications_catalog +ean+group_id+cmed_class+tarja+tipo_produto+principio_ativo_normalizado+updated_from_cmed_at+is_dcb
# - CREATE user_medications (RLS owner-only)
# - ALTER treatments+doses+sos_rules +group_id+cmed_class
# - CHECK constraint chk_*_group 17 valores (incluindo hormonal)
# - RPC search_medications nova (retorna group_id+cmed_class+is_dcb, ORDER BY is_dcb DESC)
# - RPC upsert_user_medication, get_user_medications, doses_by_group, top_meds_per_group
# - RPC classify_medication_robust 5 tiers
# - Seed DCBs top-50 com group_id correto
# - Brand_map BR (Aerolin/Clenil/Decadron/Mounjaro/Ozempic/Zoloft/Lexapro/Tylenol/Buscopan/Cataflam/Clavulin/Rivotril/etc.) 70+ entries

# Validar localmente
supabase db reset --debug

git add supabase/migrations/
git commit -m "chore(db): versionar migrations v0.2.4.0-v0.2.5.0 aplicadas via MCP"
git push -u origin chore/versionar-migrations-categorias
```

**Aceite:** `supabase db reset` recria estado prod idêntico + `supabase db lint` 0 errors + colunas/RPCs/CHECK/seeds confirmados via `\d medications_catalog` no psql.

---

### P0.2 Snapshot completo schema atual

**Rationale:** `remote_schema.sql` (0 bytes) atualmente. Necessário pra `supabase db reset`.

```bash
git checkout -b chore/snapshot-remote-schema
supabase db dump --data-only=false > supabase/migrations/20260428172242_remote_schema.sql

# Validar
wc -l supabase/migrations/20260428172242_remote_schema.sql  # >2000 lines
grep -E "is_dcb|classify_medication_robust|user_medications|hormonal" supabase/migrations/20260428172242_remote_schema.sql

git add supabase/migrations/20260428172242_remote_schema.sql
git commit -m "chore(db): snapshot completo schema medcontrol prod"
```

**Aceite:** arquivo >50KB + grep retorna matches pras colunas v0.2.5.0. Pode rodar em paralelo com P0.1.

---

### P0.3 Sentry PII strip exhaustivo (LGPD)

**Rationale:** Atualmente strip apenas 4 campos. Falta strip de 11+ campos sensíveis healthcare BR em `event.contexts`, `event.extra`, `event.breadcrumbs[].data`, `event.tags`.

**Editar `src/main.jsx` linhas 40-50:**

```javascript
const SENSITIVE_FIELDS = [
  'name', 'email', 'username', 'ip_address',
  'condition', 'allergies', 'doctor', 'insurance', 'insurance_card',
  'phone', 'emergency_contact', 'emergency_phone',
  'weight', 'height', 'blood_type',
  'medName', 'patientName', 'observation',
  'access_token', 'refresh_token', 'jwt', 'apiKey',
  'password', 'service_role', 'anon_key'
];

function stripPII(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  Object.keys(obj).forEach(key => {
    const lower = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(f => lower.includes(f.toLowerCase()))) {
      obj[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      stripPII(obj[key]);
    }
  });
  return obj;
}

beforeSend(event, hint) {
  if (event.user) stripPII(event.user);
  if (event.request) stripPII(event.request);
  if (event.contexts) stripPII(event.contexts);
  if (event.extra) stripPII(event.extra);
  if (event.tags) stripPII(event.tags);
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(b => {
      if (b.data) stripPII(b.data);
      if (b.message) {
        SENSITIVE_FIELDS.forEach(f => {
          const re = new RegExp(f, 'gi');
          if (re.test(b.message)) {
            b.message = b.message.replace(re, '[REDACTED]');
          }
        });
      }
      return b;
    });
  }
  return event;
}
```

**Criar `src/main.test.js`** com testes pra cada caminho.

**Aceite:** teste unitário passa + manual check 5 eventos Sentry últimos 7 dias sem PII.

**Branch:** `fix/sentry-pii-strip-exhaustivo`

---

### P0.4 PostHog consent gate (LGPD)

**Rationale:** PostHog inicia em `src/services/analytics.js` sem consent. Viola LGPD-first + docs Dosy v2.

**Em `src/services/analytics.js:26-75`:**

```javascript
export function initAnalytics() {
  if (!POSTHOG_KEY) return;
  const consent = localStorage.getItem('dosy_consent_telemetry');
  if (consent !== 'true') {
    console.info('[analytics] PostHog NÃO inicializado — consent telemetria pendente');
    return;
  }
  // ... resto existente
}

export function setConsent(value) {
  localStorage.setItem('dosy_consent_telemetry', value ? 'true' : 'false');
  if (value && !window.posthog) initAnalytics();
  if (!value && window.posthog) {
    window.posthog.opt_out_capturing();
    window.posthog.reset();
  }
}

export function getConsent() {
  return localStorage.getItem('dosy_consent_telemetry');
}
```

**Criar `src/components/ConsentBanner.jsx`** + montar em `App.jsx` antes do `MainAppContent`.

**Adicionar toggle em `src/pages/Settings/sections.jsx`** seção `DataPrivacySection`.

**Aceite:** banner aparece em user novo + opt-out remove eventos do PostHog (verificar dashboard 5min).

**Branch:** `feat/posthog-consent-gate`

---

### P0.5 Keystore exposure check + rotação se necessária

```bash
git log --all --full-history -- "*.keystore"
git log --all --full-history -- "*.jks"
git ls-files | grep -E "\.keystore|\.jks"

# Se TUDO vazio: OK
# Se RETORNAR commits: ROTAÇÃO IMEDIATA
# 1. keytool -genkey -v -keystore ~/.keystores/dosy-release-new.keystore -alias dosy -keyalg RSA -keysize 4096 -validity 10000
# 2. Backup nova em 3 locais offline (cofre 1Password + drive + USB)
# 3. Play Console → app → Setup → App integrity → Upload key certificate → upload novo .pem
# 4. Atualizar android/keystore.properties pra path absoluto fora do repo
```

**Aceite:** git history limpo + keystore fora do repo + Play Console upload key atualizado se houve exposure.

---

### P0.6 `dose-trigger-handler` anti-duplicate pre-check

**Rationale:** Atualmente, mesma dose com múltiplos UPDATEs em sequência dispara FCM N vezes. Sem dedup transacional. Flood risk em retry storms.

**Em `supabase/functions/dose-trigger-handler/index.ts`** (linhas 327-374 UPDATE pending→non-pending):

Adicionar advisory lock no Postgres trigger OU tabela de fingerprint:

```sql
-- Migration nova: anti-dup pre-check via tabela
CREATE TABLE IF NOT EXISTS medcontrol.fcm_dispatched_log (
  dose_id UUID NOT NULL,
  dispatch_kind TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dose_id, dispatch_kind, scheduled_at)
);
CREATE INDEX fcm_dispatched_log_dispatched_at_idx ON medcontrol.fcm_dispatched_log(dispatched_at);
-- Cleanup cron diário >7d
```

Na Edge function, antes de dispatch:

```typescript
const recent = await adminSb
  .schema('medcontrol')
  .from('fcm_dispatched_log')
  .select('dose_id')
  .eq('dose_id', doseId)
  .eq('dispatch_kind', dispatchKind)
  .gte('dispatched_at', new Date(Date.now() - 60_000).toISOString())
  .maybeSingle();

if (recent.data) {
  console.warn('[dose-trigger] skip dup dispatch', { doseId, dispatchKind });
  return new Response(JSON.stringify({ skipped: 'duplicate' }), { status: 200 });
}

// ... dispatch ...

await adminSb.schema('medcontrol').from('fcm_dispatched_log').insert({
  dose_id: doseId,
  dispatch_kind: dispatchKind,
  scheduled_at: scheduledAt,
});
```

**Aceite:** simular 2 UPDATEs <60s na mesma dose → segunda dispara `skipped: duplicate`.

---

## 5. P1 — Arquitetural (correções fundamentais)

### P1.1 Sincronizar `package-lock.json`
```bash
rm package-lock.json
npm install --legacy-peer-deps
git commit -m "chore: sync lockfile com package.json 0.2.5.0"
```

### P1.2 Adicionar `engines` em `package.json`
```json
"engines": { "node": ">=22.0.0 <23", "npm": ">=10.0.0" }
```

### P1.3 `@sentry/react` com `^`
`package.json:50` → `"@sentry/react": "^10.43.0"`

### P1.4 `prettier --check` em pre-commit
`package.json` lint-staged config + `src/**/*.{js,jsx}` → `["eslint --max-warnings=80", "prettier --check"]`

### P1.5 Ativar `versionedCache.reconcileDoses` (resolve bug "status volta")

**Em `src/hooks/useDashboardPayload.js`:**

```javascript
import { reconcileDoses } from '../state/versionedCache';

// Após o useQuery:
const reconciled = useMemo(() => {
  if (!query.data?.doses) return query.data;
  const current = qc.getQueryData(['dashboard-payload', keyFilter]);
  if (!current?.doses) return query.data;
  return { ...query.data, doses: reconcileDoses(current.doses, query.data.doses) };
}, [query.data, qc, keyFilter]);
```

**Em `src/services/dosesService.js` (confirmDose, skipDose, undoDose, registerSos):**

```javascript
const { data, error } = await supabase.rpc('confirm_dose', { ... });
if (data) data._serverConfirmedAt = Date.now();
return data;
```

Adicionar PostHog event `sync_conflict_explicit_resolution` quando reconcile rejeita server payload.

**Aceite:** bug "status volta" não se manifesta em test cellular ruim (validation device NB-4 pattern).

**Branch:** `fix/ativar-reconcile-doses-status-volta`

---

### P1.6 Conflict resolution 409 — RPCs healthcare retornam `current_state`

**Rationale:** Hoje `confirm_dose`, `skip_dose`, `undo_dose` retornam erro genérico em estado terminal. Cliente faz rollback silencioso (viola ADR-013).

**Editar RPCs SQL:**

```sql
CREATE OR REPLACE FUNCTION medcontrol.confirm_dose(
  p_dose_id UUID, p_actual_time TIMESTAMPTZ, p_observation TEXT
) RETURNS JSONB AS $$
DECLARE v_current RECORD;
BEGIN
  SELECT * INTO v_current FROM medcontrol.doses WHERE id = p_dose_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND', 'code', 404);
  END IF;
  IF v_current.status NOT IN ('pending', 'overdue') THEN
    RETURN jsonb_build_object(
      'error', 'INVALID_TRANSITION',
      'code', 409,
      'current_state', row_to_json(v_current)
    );
  END IF;
  UPDATE medcontrol.doses SET status='done', "actualTime"=p_actual_time, observation=p_observation, "updatedAt"=NOW() WHERE id=p_dose_id;
  RETURN jsonb_build_object('ok', true, 'dose', row_to_json(v_current));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, extensions, public;
```

**Aplicar mesma estrutura em** `skip_dose`, `undo_dose`, `register_sos_dose`, `update_treatment_schedule`.

**Em `src/services/mutationRegistry.js`, no `onError`:**

```javascript
onError: (error, variables, context) => {
  if (error?.code === 409 && error?.current_state) {
    toast.show({
      kind: 'warning',
      message: 'Essa dose foi alterada em outro dispositivo. Aceitar?',
      action: 'Aceitar',
      onAction: () => {
        qc.setQueryData(['dashboard-payload', '*'], (old) => patchWith(old, error.current_state));
      }
    });
  } else {
    toast.show({
      kind: 'error',
      message: 'Não foi possível registrar. Toque pra tentar de novo.',
      onUndo: () => mutate(variables)
    });
  }
  rollback(qc, context?.snapshots);
}
```

**Aceite:** simular 2 devices marcando mesma dose → segundo recebe prompt 409 (não rollback silencioso).

**Branch:** `feat/conflict-resolution-409-explicit`

---

### P1.7 Snackbar persistente em `onError` de mutations healthcare

Já parcialmente em P1.6. Para mutations não-healthcare (createPatient, updateTreatment, etc.), adicionar feedback explícito em todos os `onError`.

**Lista de mutations a tratar:**
- `confirmDose`, `skipDose`, `undoDose`, `registerSos` (já em P1.6)
- `createPatient`, `updatePatient`, `deletePatient`
- `createTreatment`, `updateTreatment`, `deleteTreatment`, `pauseTreatment`, `resumeTreatment`, `endTreatment`
- `useUpdateUserPrefs`, `useUpsertSosRule`, `useDeleteSosRule`, `useSharePatient`, `useUnsharePatient`

**Aceite:** simular 5xx em cada mutation → toast persistente aparece com botão Retry.

---

### P1.8 UI ↔ Supabase enforcement — mover 5 JSX pra services

**Arquivos a refatorar:**
- `pages/Dashboard.jsx:305` — extrair `extend_continuous_treatments` pra `dashboardService.js`
- `pages/Settings/index.jsx:129-131,190` — 4 chamadas pra `subscriptionService.js`, `dosesService.js`, `treatmentsService.js`
- `components/DoseModal.jsx:44` — lazy-load `observation` em `dosesService.fetchObservation(doseId)`
- `components/ForceNewPasswordModal.jsx` + `ChangePasswordModal.jsx` — `supabase.auth.updateUser` em `authService.updatePassword(newPwd)`

**Adicionar ESLint rule** em `eslint.config.js`:

```javascript
{
  files: ['src/pages/**', 'src/components/**', 'src/hooks/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@supabase/*'], message: 'Import via core/entities/* — Regra 5 RULES.md' }
      ]
    }]
  }
}
```

Com exceções pra `src/services/**` e `src/utils/**`.

**Aceite:** `npm run lint` retorna 0 violações + os 5 JSX não importam supabase direto.

**Branch:** `refactor/ui-supabase-boundary`

---

### P1.9 Realtime sob demanda (re-ativar restrito a PatientDetail compartilhado)

**Rationale:** Realtime DESABILITADO em prod desde v0.2.1.0 #157 (storm 5GB/h). ADR-011 Dosy v2 propõe re-ativar APENAS em PatientDetail de paciente compartilhado.

**Refatorar `src/hooks/useRealtime.js`:**

```javascript
export function useRealtimePatient(patientId, isShared) {
  useEffect(() => {
    if (!patientId || !isShared) return; // só ativa em paciente compartilhado
    const channel = supabase.channel(`realtime:patient:${patientId}:${Date.now()}`);
    channel
      .on('postgres_changes', { event: '*', schema: 'medcontrol', table: 'doses', filter: `patientId=eq.${patientId}` },
        () => debouncedInvalidate(['dashboard-payload']))
      .on('postgres_changes', { event: '*', schema: 'medcontrol', table: 'patient_shares', filter: `patientId=eq.${patientId}` },
        () => debouncedInvalidate(['patient_shares', patientId]))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [patientId, isShared]);
}
```

**Usar em `pages/PatientDetail.jsx`:**

```javascript
const patient = usePatient(patientId);
useRealtimePatient(patientId, patient?.is_shared);
```

**Configurar publication Supabase** pra incluir apenas `doses` + `patient_shares` (não `patients`/`treatments`/`sos_rules`).

**Aceite:** egress < 100MB/h por user idle (era 5GB/h). Validação: deixar app em hidden tab 1h, medir egress via Supabase dashboard.

**Branch:** `feat/realtime-sob-demanda-shared-patient`

---

### P1.10 `Sentry.captureException` nos 121 catches silenciosos

Adicionar em:
- `src/services/mutationRegistry.js` onError de cada mutation (healthcare-critical)
- `src/services/notifications/scheduler.js` catch linha 280+
- `src/services/notifications/fcm.js` registration failure
- `src/hooks/useAuth.jsx` todos os catches
- `src/services/notifications/auditLog.js` insert fails
- Todos `} catch {}` silenciosos (Grep retorna 20+ ocorrências)

**Configurar ESLint:**

```javascript
'no-empty': ['error', { allowEmptyCatch: false }]
```

E criar custom rule (eslint-plugin local) que detecta `.catch(() => {})` patterns.

**Aceite:** Sentry mostra eventos categorizados por `tags.source` nos próximos 7 dias.

**Branch:** `fix/sentry-capture-exception-critical-paths`

---

### P1.11 `tracesSampleRate: 0.1` em prod

`src/main.jsx`:
```javascript
tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
```

Habilita performance monitoring (10% sampling cabe Sentry Free tier 10k transactions/mês).

---

### P1.12 Timeouts em TODAS as mutations (15s padrão)

**Refatorar `src/services/mutationRegistry.js`** wrapping cada mutationFn:

```javascript
function withTimeout(fn, timeoutMs = 15000) {
  return async (...args) => {
    return Promise.race([
      fn(...args),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs))
    ]);
  };
}

// Aplicar:
mutationFn: withTimeout(async ({ id, actualTime }) => { ... })
```

**Aceite:** mutation pendente >15s rejeita com `TIMEOUT` → onError snackbar.

---

### P1.13 `useReducer` em `TreatmentForm.jsx` (14 campos useState único)

**Refatorar `src/pages/TreatmentForm.jsx`:**

```javascript
const initialState = { /* 14 fields */ };

function formReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.key]: action.value };
    case 'AUTOFILL_FROM_CATALOG': return { ...state, ...action.payload };
    case 'RESET': return initialState;
    default: throw new Error('Unknown action');
  }
}

const [form, dispatch] = useReducer(formReducer, initialState);
const set = (k, v) => dispatch({ type: 'SET_FIELD', key: k, value: v });
```

Adicionar validação Zod no submit:

```javascript
import { z } from 'zod';
const TreatmentSchema = z.object({
  patientId: z.string().uuid(),
  medName: z.string().min(1).max(200),
  unit: z.string().min(1).max(100),
  intervalHours: z.number().int().min(1).max(168).optional(),
  // ...
});

const parsed = TreatmentSchema.safeParse(form);
if (!parsed.success) { /* show errors */ return; }
```

**Aceite:** form passa testes de validação edge cases + zero re-renders desnecessários em digitação.

**Branch:** `refactor/treatment-form-reducer`

---

### P1.14 Eliminar `theme.css` legacy

**Rationale:** Mistura `--color-brand-*` azul com `--dosy-*` warm coral. Inconsistência (focus rings inputs azul em vez de sunset).

**Substituir referências:**
- `src/index.css` linhas 158-170 (`.input` focus): trocar `var(--color-brand-100)` → `var(--dosy-sunset-1)`
- `src/index.css` linhas 100-105 (`.card`): trocar `var(--color-*)` → `var(--dosy-*)`
- `src/App.jsx` skip-link: `bg-brand-600` → `bg-[var(--dosy-primary)]`

**Deletar `src/styles/theme.css`** após verificar zero referências.

**Aceite:** Grep `--color-brand-` retorna 0 matches em `src/`. Focus visual coral consistente em todos inputs.

**Branch:** `refactor/eliminar-theme-css-legacy`

---

## 6. P2 — Refactor_Full Fases 2-5 (concluir)

### Fase 2 — Consolidação de alarmes

#### P2.1 Edge `request-schedule-sync` REAL (substituir stub)

**Atualmente:** STUB que valida Bearer mas NÃO o JWT.

**Implementar de verdade:**

```typescript
// supabase/functions/request-schedule-sync/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 });
  const jwt = auth.slice(7);

  const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) return new Response('unauthorized', { status: 401 });

  // Reusar lógica do daily-alarm-sync (extrair pra _shared/scheduling.ts)
  const { schedulePayload } = await import('../_shared/scheduling.ts');
  const result = await schedulePayload(user.id, { horizonHours: clamp(body.horizon_hours, 1, 168) });

  return new Response(JSON.stringify(result), { status: 200 });
});
```

**Extrair lógica comum** de `daily-alarm-sync/index.ts` linhas 117-275 pra `_shared/scheduling.ts` reutilizável.

**Aceite:** POST sem JWT válido → 401. POST com JWT válido → FCM dispatch payload pra device user.

**Branch:** `feat/request-schedule-sync-real-implementation`

---

#### P2.2 Drop `dose-fire-time-notifier` (1440 invocações/dia sem ganho)

**Rationale:** Cron 1×/min defensivo pra caregivers killed. Custou 1440 invocações/dia. Refactor_Full Fase 2 propôs drop em favor de WorkManager 24h + pre-check HTTP.

**Sequência:**

1. **Garantir que WorkManager + AlarmReceiver pre-check HTTP cobrem o caso** (verificar `qa_appium` cenário killed-caregiver com `dose-fire-time-notifier` desativado)
2. `select cron.unschedule('dose-fire-time-1min')` no Supabase SQL Editor
3. `supabase functions delete dose-fire-time-notifier`
4. Remover migration `20260516161000_dose_fire_notified_at_v0_2_3_7` se não usada em mais lugar (verificar grep `fire_notified_at`)
5. Verificar `DosyMessagingService.handleFireNowAlarm` continua sendo invocado por algum cron equivalente (se não, remover)
6. Egress audit: verificar redução ~1440 invocações/dia

**Aceite:** Audit Supabase mostra redução 1440 invocações/dia + caregiver killed test passa.

**Branch:** `refactor/drop-dose-fire-time-notifier`

---

#### P2.3 BootReceiver query NOW-2h..NOW+horizon (catch-up doses perdidas)

**Já parcialmente implementado** em `BootReceiver.java` (grace 2h #224). Verificar e expandir:

```java
// android/.../BootReceiver.java
public void onReceive(Context ctx, Intent intent) {
  // ... atual ...

  // Catch-up: query doses perdidas durante boot
  long now = System.currentTimeMillis();
  long graceStart = now - (2L * 60L * 60L * 1000L);
  long horizonEnd = now + (48L * 60L * 60L * 1000L);

  // Query DB direto via HTTP (boot context, sem JS bridge ainda)
  fetchUpcomingDoses(ctx, graceStart, horizonEnd, (doses) -> {
    for (Dose d : doses) {
      if (d.scheduledAt < now) {
        // Late-fire imediato
        AlarmReceiver.sendBroadcastForLateRecovery(ctx, d);
      } else {
        AlarmScheduler.scheduleDoseAlarm(ctx, d.id, d.scheduledAt, ...);
      }
    }
  });
}
```

**Reusar `DoseSyncWorker.fetchUpcomingDoses()`** pattern.

**Aceite:** Boot em emulator com 5 doses agendadas nas últimas 2h → todas late-fire imediato.

**Branch:** `feat/boot-receiver-catchup-2h`

---

#### P2.4 Drop Capacitor `LocalNotifications` inteiramente

**Rationale:** Consolidar `src/services/notifications/` → `src/services/scheduling/`. Hoje Capacitor LocalNotifications coexiste com Java tray — race condition #215.

**Sequência:**

1. Verificar todos os usos de `@capacitor/local-notifications` em `src/`
2. Substituir cada uso por Java tray (via `CriticalAlarm.scheduleTrayGroup`)
3. Remover plugin de `capacitor.config.ts` + `package.json` + `capacitor.build.gradle`
4. `npx cap sync android` + rebuild

**Aceite:** `grep -r "@capacitor/local-notifications" src/` retorna 0 matches.

**Branch:** `refactor/drop-capacitor-local-notifications`

---

#### P2.5 Cliente JS deixar de reagendar alarmes

Atualmente `App.jsx:233-246` recalcula `dosesSignature` (FNV hash) e chama `scheduleDoses`. Refactor_Full Fase 2 propõe servidor único agendador.

**Refatorar:**
- Mover trigger pra Edge `request-schedule-sync` (P2.1)
- App.jsx useEffect só chama `requestScheduleSync()` em login + treatment change
- Servidor agenda via FCM data-only `schedule_alarms`
- Cliente Java recebe e agenda via `AlarmScheduler.scheduleDoseAlarm`

**Aceite:** App não tem mais `rescheduleAll` JS-side. Test cellular ruim não causa storm.

**Branch:** `refactor/server-side-alarm-scheduling`

---

### Fase 3 — Single source of truth

#### P2.6 Tier 100% via JWT claim (eliminar query DB redundante)

**Já parcialmente:** Custom Access Token Hook #22 injeta tier em `app_metadata`. Mas `useTier` ainda faz query DB.

**Refatorar `src/hooks/useSubscription.js`:**

```javascript
export function useMyTier() {
  const { session } = useAuth();
  const tier = session?.user?.app_metadata?.tier ?? 'free';
  return { data: tier, isLoading: false };
}
```

Remover `useQuery(['my_tier', user?.id])` que faz round-trip.

**Aceite:** PostHog event `tier_check_latency` < 5ms (era ~200ms).

---

#### P2.7 Push token consolidate (SharedPrefs Android como cache de `push_subscriptions`)

Hoje SharedPrefs `dosy_fcm_token` e `dosy_device_id_uuid` são fonte primária — `push_subscriptions` DB é secundário. Reverter: DB é fonte de verdade, SharedPrefs é cache.

**Refatorar fluxo:**
- `subscribeFcm()` em fcm.js insere em DB primeiro, depois cache local
- BootReceiver não confia em SharedPrefs sem verificar DB
- `useAuth` SIGNED_OUT deleta DB row antes de limpar SharedPrefs

**Aceite:** force-clear SharedPrefs Android → next launch re-fetch token de DB e re-cacheia.

**Branch:** `refactor/push-token-db-primary`

---

#### P2.8 `generateDoses.js` removido (RPC server-side única fonte)

**Rationale:** `src/utils/generateDoses.js` é fallback offline duplicado da lógica do RPC `create_treatment_with_doses`. Drift risco.

**Sequência:**
- Verificar onde `generateDoses` é usado (provavelmente em `mutationRegistry.js` createTreatment optimistic patch)
- Substituir por estrutura mínima local (só pra UI patch otimista) que NÃO replica lógica de geração
- Quando RPC volta, server doses sobrescrevem patch local
- `rm src/utils/generateDoses.js` + remover import

**Aceite:** Grep `generateDoses` retorna 0 matches.

**Branch:** `refactor/drop-generate-doses-js`

---

#### P2.9 `useAppLifecycle` merge real (consolidar useAppResume + useAppLock)

Hoje wrapper declarado mas não usado — `App.jsx` chama os 2 hooks diretos.

**Refatorar:**
- `useAppLifecycle.js` torna-se ponto único + chama internamente `useAppResume` + `useAppLock`
- `App.jsx` chama só `useAppLifecycle()`
- Remover chamadas duplicadas

**Aceite:** Grep `useAppResume` + `useAppLock` em pages/components retorna 0 (só `useAppLifecycle.js` usa).

---

#### P2.10 Remover hook órfãos

Deletar arquivos:
- `src/hooks/useDosyQuery.js` (25 LOC, 0 callers)
- `src/hooks/useDosyMutation.js` (22 LOC, 0 callers)
- `src/hooks/usePushNotifications.js` (se órfão)

Verificar com `grep -r "useDosyQuery\|useDosyMutation\|usePushNotifications" src/`.

**Aceite:** files deletados + build verde.

---

### Fase 4 — Componentização completa

#### P2.11 Adoção dos 6 componentes restantes em forms/lists (15+ páginas)

Componentes criados em Fase 4 mas pendente adopção:
- `FormRow.jsx` — adotar em TreatmentForm, PatientForm, Settings
- `TodayDosesStat.jsx` — adotar em Dashboard
- `MedicationHistoryGrid.jsx` — adotar em SOS, Analytics, TreatmentForm sugestões
- `TreatmentCard.jsx` — adotar em TreatmentList (substituir inline)
- `DoseList.jsx` — adotar em Dashboard, PatientDetail (substituir inline)
- `DoseSheet.jsx` — consolidar `DoseModal` + `MultiDoseModal` em wrapper único

**Aceite:** 6 componentes têm pelo menos 1 uso real em página.

**Branch:** `refactor/adopt-fase4-components`

---

#### P2.12 Varredura `legacy|deprecated|REMOVIDO|débito|TODO|FIXME` → cleanup

```bash
grep -rE "legacy|deprecated|REMOVIDO|débito|TODO|FIXME" src/ --include="*.js" --include="*.jsx" > /tmp/cleanup.txt
# Revisar cada match: deletar, refatorar, ou converter em GitHub Issue
```

**Aceite:** `cleanup.txt` < 20 entries (era 42 comentários).

---

#### P2.13 Consolidar 47 scripts QA em `scripts/qa/` parametrizado

Reorganizar:
```
scripts/
├── automation/
│   ├── ingest-anvisa.mjs
│   ├── backfill-catalog-groups.mjs
│   ├── ingest-cmed.mjs                # NOVO P3.5
│   ├── gen-icons.mjs
│   └── copy-apk-to-dist.cjs
├── data/                              # datasets
├── qa/                                # gitignored (.gitkeep)
│   ├── lib/
│   │   ├── appium.mjs                 # consolidado de qa_appium_lib
│   │   └── cdp.mjs                    # 1 cdp_login consolidado
│   └── flows/                         # specs E2E parametrizados
│       ├── owner-flow.spec.mjs
│       ├── caregiver-flow.spec.mjs
│       ├── nb4-force-kill.spec.mjs
│       └── ...
└── tests/                             # validators CI
    ├── validate-medications-seed.ts
    └── validate-cmed-mapping-coverage.ts
```

Deletar redundantes (lista em P7.1).

**Aceite:** <15 scripts ativos em raiz `scripts/`. QA flows parametrizados via argv.

---

#### P2.14 Edge `notify-doses` + `schedule-alarms-fcm` (stubs 410) deletados

```bash
supabase functions delete notify-doses
supabase functions delete schedule-alarms-fcm
git rm -r supabase/functions/notify-doses supabase/functions/schedule-alarms-fcm
git commit -m "chore: delete deprecated Edge stubs (returned 410)"
```

---

#### P2.15 `DoseModal` + `MultiDoseModal` → `DoseSheet` único

Consolidar em wrapper que escolhe internamente single vs multi baseado em `doses.length`.

**Aceite:** `DoseModal.jsx` e `MultiDoseModal.jsx` deletados. Único wrapper em `dosy/DoseSheet.jsx`.

---

### Fase 5 — Performance e instrumentação

#### P2.16 Bundle analysis + lazy load Analytics/Reports/Admin/FAQ/Privacidade/Termos/Install

Em `App.jsx`, garantir lazy:
```javascript
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports = lazy(() => import('./pages/Reports'));
const Admin = lazy(() => import('./pages/Admin'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Privacidade = lazy(() => import('./pages/Privacidade'));
const Termos = lazy(() => import('./pages/Termos'));
const Install = lazy(() => import('./pages/Install'));
```

Rodar `npm run build` + analisar `dist/stats.html` (visualizer plugin já configurado em vite.config.js).

**Aceite:** Initial bundle main chunk < 250KB gzipped (era ~400KB).

---

#### P2.17 React.memo audit (DoseCard, PatientAvatar, MiniStat, EmptyState)

```javascript
export default React.memo(DoseCard, (prev, next) => {
  return prev.dose.id === next.dose.id
    && prev.dose.status === next.dose.status
    && prev.dose.actualTime === next.dose.actualTime;
});
```

**Aceite:** Profile React DevTools: <30 re-renders em Dashboard mount com 50 doses.

---

#### P2.18 Web Vitals + Sentry tracing → PostHog

```javascript
// src/main.jsx
import { onCLS, onLCP, onFID, onINP } from 'web-vitals';

onCLS(({ value }) => posthog?.capture('web_vital_cls', { value }));
onLCP(({ value }) => posthog?.capture('web_vital_lcp', { value }));
onFID(({ value }) => posthog?.capture('web_vital_fid', { value }));
onINP(({ value }) => posthog?.capture('web_vital_inp', { value }));
```

Sentry traces (tracesSampleRate 0.1 em P1.11) capturará RPC duration + FCM latency automaticamente.

**Aceite:** PostHog Insights mostra Web Vitals trend nos próximos 14 dias.

---

## 7. P3 — Backport schema + RPCs + Edge Functions Dosy v2

### Tabelas faltantes

#### P3.1 `medcontrol.profiles`

```sql
CREATE TABLE medcontrol.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  consent_version INT NOT NULL DEFAULT 1,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE medcontrol.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_self ON medcontrol.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY profiles_update_self ON medcontrol.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Trigger on signup
CREATE OR REPLACE FUNCTION medcontrol.on_new_user_create_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO medcontrol.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_new_user_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION medcontrol.on_new_user_create_profile();

-- Backfill existing users
INSERT INTO medcontrol.profiles (user_id, name)
SELECT id, COALESCE(raw_user_meta_data->>'name', '') FROM auth.users
ON CONFLICT DO NOTHING;
```

**Aceite:** `SELECT COUNT(*) FROM medcontrol.profiles` == `SELECT COUNT(*) FROM auth.users`.

---

#### P3.2 `medcontrol.audit_log` append-only (LGPD)

```sql
CREATE TABLE medcontrol.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  patient_id UUID REFERENCES medcontrol.patients(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'dose_marked_done', 'dose_marked_skipped', 'dose_undone',
    'sos_registered', 'sos_forced_override',
    'patient_shared', 'patient_unshared', 'share_access_changed', 'share_extended',
    'treatment_created', 'treatment_paused', 'treatment_resumed', 'treatment_ended',
    'account_deleted', 'data_exported'
  )),
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_log_user_idx ON medcontrol.audit_log(user_id, "createdAt" DESC);
CREATE INDEX audit_log_patient_idx ON medcontrol.audit_log(patient_id, "createdAt" DESC);
CREATE INDEX audit_log_action_idx ON medcontrol.audit_log(action);

ALTER TABLE medcontrol.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_admin_or_owner ON medcontrol.audit_log
  FOR SELECT TO authenticated USING (
    medcontrol.is_admin()
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM medcontrol.patients WHERE id = patient_id AND "userId" = auth.uid())
  );
-- INSERT via funções SECURITY DEFINER apenas
```

**Disparar audit em RPCs:** alterar `confirm_dose`, `unshare_patient`, `delete_my_account`, etc., pra INSERT em `audit_log`.

**Aceite:** após confirmar 1 dose, query `SELECT * FROM medcontrol.audit_log WHERE action='dose_marked_done'` retorna 1 row.

**Cron de cleanup** (1 ano após delete share):
```sql
DELETE FROM medcontrol.audit_log
WHERE patient_id NOT IN (SELECT id FROM medcontrol.patients)
AND "createdAt" < NOW() - INTERVAL '365 days';
```

---

#### P3.3 `medcontrol.feature_flags`

```sql
CREATE TABLE medcontrol.feature_flags (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);
ALTER TABLE medcontrol.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY ff_select_public ON medcontrol.feature_flags FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY ff_admin_write ON medcontrol.feature_flags FOR ALL TO authenticated
  USING (medcontrol.is_admin()) WITH CHECK (medcontrol.is_admin());

-- Seed inicial
INSERT INTO medcontrol.feature_flags (key, value, description) VALUES
  ('beta_promo_active', 'false'::jsonb, 'Se true, novos signups ganham tier Plus 30d grátis'),
  ('engine_interactions_enabled', 'false'::jsonb, 'Habilita check_interactions warning UI'),
  ('ocr_enabled', 'false'::jsonb, 'Habilita OCR via Gemini Vision'),
  ('realtime_enabled', 'true'::jsonb, 'Master switch Realtime (rollback rápido se storm)'),
  ('cmed_monthly_sync_enabled', 'true'::jsonb, 'Habilita cron mensal CMED ingest')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION medcontrol.admin_set_feature_flag(p_key TEXT, p_value JSONB)
RETURNS VOID AS $$
BEGIN
  IF NOT medcontrol.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO medcontrol.feature_flags (key, value, updated_by)
  VALUES (p_key, p_value, auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW(), updated_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;
```

**Cliente consome via:**
```javascript
const { data: flags } = useQuery({
  queryKey: ['feature_flags'],
  queryFn: () => supabase.from('feature_flags').select('*'),
  staleTime: 5 * 60 * 1000
});
const isOcrEnabled = flags?.find(f => f.key === 'ocr_enabled')?.value === true;
```

**Aceite:** Admin panel pode toggle flags em runtime sem deploy.

---

#### P3.4 `medcontrol.treatment_user_alert_settings` (per-user-per-treatment)

```sql
CREATE TABLE medcontrol.treatment_user_alert_settings (
  treatment_id UUID NOT NULL REFERENCES medcontrol.treatments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('critical', 'push', 'silent')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (treatment_id, user_id)
);
ALTER TABLE medcontrol.treatment_user_alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_settings_self ON medcontrol.treatment_user_alert_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION medcontrol.update_user_alert_setting(p_treatment_id UUID, p_alert_level TEXT)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT medcontrol.has_patient_access((SELECT "patientId" FROM medcontrol.treatments WHERE id = p_treatment_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO medcontrol.treatment_user_alert_settings (treatment_id, user_id, alert_level)
  VALUES (p_treatment_id, auth.uid(), p_alert_level)
  ON CONFLICT (treatment_id, user_id) DO UPDATE
  SET alert_level = EXCLUDED.alert_level, "updatedAt" = NOW();

  -- Trigger Edge handler pra propagar pro AlarmScheduler nativo
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/treatment-alert-setting-handler',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := jsonb_build_object('treatment_id', p_treatment_id, 'user_id', auth.uid(), 'alert_level', p_alert_level)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;
```

**UI:** Adicionar `<AlertLevelToggle>` em `TreatmentCard.jsx` (3 segmentos crítico/push/silent).

**Aceite:** Toggle per-treatment funciona independente do switch global Alarme Crítico.

---

#### P3.5 `medcontrol.custom_medication_rules` (overrides per-user-per-patient)

```sql
CREATE TABLE medcontrol.custom_medication_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES medcontrol.patients(id) ON DELETE CASCADE,
  med_name TEXT NOT NULL,
  min_interval_hours INT,
  max_doses_24h INT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, patient_id, med_name)
);
ALTER TABLE medcontrol.custom_medication_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_rules_self ON medcontrol.custom_medication_rules
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**Permite ao user** override `sos_rules` quando médico prescreveu diferente do padrão DCB.

---

#### P3.6 Tabelas Engine ADR-012 (medication_principles + medication_interactions)

```sql
CREATE TABLE medcontrol.medication_principles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dcb TEXT UNIQUE NOT NULL,
  name_pt TEXT NOT NULL,
  therapeutic_class TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE medcontrol.medication_principles ENABLE ROW LEVEL SECURITY;
CREATE POLICY mp_select_public ON medcontrol.medication_principles FOR SELECT USING (true);
CREATE POLICY mp_admin_write ON medcontrol.medication_principles FOR ALL USING (medcontrol.is_admin()) WITH CHECK (medcontrol.is_admin());

CREATE TABLE medcontrol.medication_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principle_a_id UUID NOT NULL REFERENCES medcontrol.medication_principles(id),
  principle_b_id UUID NOT NULL REFERENCES medcontrol.medication_principles(id),
  severity TEXT NOT NULL CHECK (severity IN ('leve', 'moderada', 'grave')),
  description TEXT NOT NULL,
  source TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (principle_a_id, principle_b_id),
  CHECK (principle_a_id < principle_b_id) -- evita duplicação simétrica
);
CREATE INDEX mi_a_idx ON medcontrol.medication_interactions(principle_a_id);
CREATE INDEX mi_b_idx ON medcontrol.medication_interactions(principle_b_id);

-- Seed inicial: top 50 interações graves (Anticoagulante x AINE, ISRS x IMAO, etc.)
-- (referência: ANVISA + BNF Brazilian National Formulary)
```

**RPC `check_interactions`:**
```sql
CREATE OR REPLACE FUNCTION medcontrol.check_interactions(p_patient_id UUID, p_med_name TEXT)
RETURNS SETOF JSONB AS $$
  -- Lookup principle_id do med_name via medications_catalog
  -- Cross-join com active treatments do paciente
  -- Buscar interações graves
  -- Retornar [{severity, description, with_med_name}]
$$ LANGUAGE sql SECURITY DEFINER;
```

**UI:** TreatmentForm submit verifica → mostra modal warning se grave (user pode override → audit_log).

**Aceite:** cadastrar Anticoagulante (Varfarina) num paciente que já tem AINE (Ibuprofeno) → modal aparece.

**Branch:** `feat/engine-adr-012-interactions`

---

#### P3.7 `cmed_class_to_group_mapping` (tabela DB — não JS)

```sql
CREATE TABLE medcontrol.cmed_class_to_group_mapping (
  cmed_class_normalized TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cmed_mapping_group_id CHECK (group_id IN (
    'antibiotico','antifungico','antiviral','antitermico_analgesico',
    'anti_inflamatorio','corticoide','anti_hipertensivo','antidiabetico',
    'antialergico','antidepressivo','ansiolitico','anticoagulante',
    'gastrointestinal','broncodilatador','vitamina','hormonal','outro','nao_classificado'
  ))
);

-- Seed: ~90 entries do scripts/lib/classify-medication.mjs CMED_CLASS_TO_GROUP
-- (gerar SQL via script: node -e "console.log(...generate sql)")

CREATE OR REPLACE FUNCTION medcontrol.resolve_group_from_cmed_class(p_cmed_class TEXT)
RETURNS TEXT AS $$
  SELECT group_id FROM medcontrol.cmed_class_to_group_mapping
  WHERE cmed_class_normalized = lower(extensions.unaccent(p_cmed_class))
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION medcontrol.update_medication_group_from_cmed_class()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cmed_class IS NOT NULL THEN
    NEW.group_id := medcontrol.resolve_group_from_cmed_class(NEW.cmed_class);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medications_catalog_cmed_group
  BEFORE INSERT OR UPDATE OF cmed_class ON medcontrol.medications_catalog
  FOR EACH ROW EXECUTE FUNCTION medcontrol.update_medication_group_from_cmed_class();
```

**Aceite:** INSERT em medications_catalog com `cmed_class='Macrolídeos'` → trigger auto-popula `group_id='antibiotico'`.

---

#### P3.8 `medication_categorization_suggestions` (aprendizado coletivo)

```sql
CREATE TABLE medcontrol.medication_categorization_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES medcontrol.medications_catalog(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  suggested_group_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('modal_top3', 'modal_picker_full', 'edit_existing')),
  was_consensual BOOLEAN,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX mcs_med_idx ON medcontrol.medication_categorization_suggestions(medication_id);
CREATE INDEX mcs_user_idx ON medcontrol.medication_categorization_suggestions(user_id);

ALTER TABLE medcontrol.medication_categorization_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcs_self ON medcontrol.medication_categorization_suggestions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY mcs_admin_select ON medcontrol.medication_categorization_suggestions
  FOR SELECT TO authenticated USING (medcontrol.is_admin());
```

**Loop de melhoria:** Admin painel mostra medicamentos com >=10 suggestions same group → propõe UPDATE em catálogo.

---

#### P3.9 RPC `suggest_categories_for_unknown` (pg_trgm fuzzy)

```sql
CREATE OR REPLACE FUNCTION medcontrol.suggest_categories_for_unknown(p_name TEXT, p_principio_ativo TEXT DEFAULT NULL, p_limit INT DEFAULT 3)
RETURNS TABLE (group_id TEXT, score FLOAT, reason TEXT) AS $$
  WITH candidates AS (
    -- Trigram match contra catálogo com group_id populado
    SELECT m.group_id, similarity(lower(extensions.unaccent(m.nome_comercial)), lower(extensions.unaccent(p_name))) AS sim
    FROM medcontrol.medications_catalog m
    WHERE m.group_id IS NOT NULL
    AND similarity(lower(extensions.unaccent(m.nome_comercial)), lower(extensions.unaccent(p_name))) > 0.3
    ORDER BY sim DESC LIMIT 20
  )
  SELECT c.group_id,
         AVG(c.sim) AS score,
         'similar a "' || (SELECT nome_comercial FROM medcontrol.medications_catalog WHERE group_id = c.group_id ORDER BY similarity(lower(extensions.unaccent(nome_comercial)), lower(extensions.unaccent(p_name))) DESC LIMIT 1) || '"' AS reason
  FROM candidates c
  GROUP BY c.group_id
  ORDER BY score DESC LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = medcontrol, extensions, public;
```

**Cliente consome em `CategoryHintModal.jsx`** quando autofill falha.

---

### RPCs faltantes

#### P3.10 `update_treatment_preserving_history`

```sql
CREATE OR REPLACE FUNCTION medcontrol.update_treatment_preserving_history(p_treatment_id UUID, p_patch JSONB)
RETURNS UUID AS $$
DECLARE v_old RECORD; v_new_id UUID;
BEGIN
  SELECT * INTO v_old FROM medcontrol.treatments WHERE id = p_treatment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT medcontrol.has_patient_access(v_old."patientId") THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Versão antiga: status='ended', parent_treatment_id=null já era
  UPDATE medcontrol.treatments SET status='ended', "updatedAt"=NOW() WHERE id = p_treatment_id;

  -- Cancela doses futuras pending da versão antiga
  UPDATE medcontrol.doses SET status='cancelled', "updatedAt"=NOW()
  WHERE "treatmentId" = p_treatment_id AND status='pending' AND "scheduledAt" > NOW();

  -- Versão nova: clone do row antigo + patch + parent_treatment_id + version+1
  INSERT INTO medcontrol.treatments (
    "userId", "patientId", "medName", unit, "intervalHours", "durationDays",
    "isContinuous", "startDate", "firstDoseTime", status,
    parent_treatment_id, version, group_id, cmed_class
  )
  SELECT
    v_old."userId", v_old."patientId",
    COALESCE(p_patch->>'medName', v_old."medName"),
    COALESCE(p_patch->>'unit', v_old.unit),
    COALESCE((p_patch->>'intervalHours')::INT, v_old."intervalHours"),
    COALESCE((p_patch->>'durationDays')::INT, v_old."durationDays"),
    COALESCE((p_patch->>'isContinuous')::BOOLEAN, v_old."isContinuous"),
    NOW(),
    COALESCE(p_patch->>'firstDoseTime', v_old."firstDoseTime"),
    'active',
    p_treatment_id,
    COALESCE(v_old.version, 1) + 1,
    COALESCE(p_patch->>'group_id', v_old.group_id),
    COALESCE(p_patch->>'cmed_class', v_old.cmed_class)
  RETURNING id INTO v_new_id;

  -- Gera doses novas (chamar create_treatment_with_doses internamente seria mais limpo, mas inline aqui)
  -- ... loop generation ...

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;
```

**Adicionar colunas:**
```sql
ALTER TABLE medcontrol.treatments
  ADD COLUMN parent_treatment_id UUID REFERENCES medcontrol.treatments(id),
  ADD COLUMN version INT NOT NULL DEFAULT 1;
CREATE INDEX treatments_parent_idx ON medcontrol.treatments(parent_treatment_id);
```

**Aceite:** Edit treatment → row antiga vira `ended`, nova vira `active v2`. History query retorna 2 rows.

---

#### P3.11 RPCs `end/pause/resume_treatment` dedicados (atualmente UPDATE direto)

```sql
CREATE OR REPLACE FUNCTION medcontrol.end_treatment(p_treatment_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT medcontrol.has_patient_access((SELECT "patientId" FROM medcontrol.treatments WHERE id = p_treatment_id)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE medcontrol.treatments SET status='ended', "updatedAt"=NOW() WHERE id = p_treatment_id;
  UPDATE medcontrol.doses SET status='cancelled', "updatedAt"=NOW()
  WHERE "treatmentId" = p_treatment_id AND status IN ('pending','overdue') AND "scheduledAt" > NOW();
  INSERT INTO medcontrol.audit_log (user_id, patient_id, action, metadata)
  VALUES (auth.uid(), (SELECT "patientId" FROM medcontrol.treatments WHERE id = p_treatment_id), 'treatment_ended', jsonb_build_object('treatment_id', p_treatment_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

-- pause_treatment: similar, status='paused'
-- resume_treatment: status='active' + UPDATE doses cancelled→pending where scheduledAt > NOW()
```

**Cliente em `treatmentsService.js`** chama via `supabase.rpc('end_treatment', ...)` em vez de UPDATE direto.

---

#### P3.12 `validate_sos` separado de `register_sos_dose`

Atualmente lógica de validação está EMBUTIDA em `register_sos_dose`. Extrair pra permitir preview UI antes do submit.

```sql
CREATE OR REPLACE FUNCTION medcontrol.validate_sos(p_patient_id UUID, p_med_name TEXT, p_scheduled_at TIMESTAMPTZ)
RETURNS JSONB AS $$
DECLARE v_rule RECORD; v_recent_count INT; v_last_dose TIMESTAMPTZ; v_diff_hours FLOAT;
BEGIN
  -- (mesma lógica de register_sos_dose linhas 23-45 mas só retorna {allowed, reason, next_available_at})
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;
```

`register_sos_dose` chama `validate_sos` internamente.

---

#### P3.13 `export_my_data` (LGPD portabilidade)

```sql
CREATE OR REPLACE FUNCTION medcontrol.export_my_data()
RETURNS JSONB AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO medcontrol.audit_log (user_id, action) VALUES (v_uid, 'data_exported');
  RETURN jsonb_build_object(
    'profile', (SELECT row_to_json(p) FROM medcontrol.profiles p WHERE user_id = v_uid),
    'patients', (SELECT jsonb_agg(row_to_json(p)) FROM medcontrol.patients p WHERE "userId" = v_uid),
    'treatments', (SELECT jsonb_agg(row_to_json(t)) FROM medcontrol.treatments t WHERE "userId" = v_uid),
    'doses', (SELECT jsonb_agg(row_to_json(d)) FROM medcontrol.doses d WHERE "userId" = v_uid),
    'sos_rules', (SELECT jsonb_agg(row_to_json(s)) FROM medcontrol.sos_rules s WHERE "userId" = v_uid),
    'shares', (SELECT jsonb_agg(row_to_json(ps)) FROM medcontrol.patient_shares ps WHERE "ownerId" = v_uid OR "sharedWithUserId" = v_uid),
    'user_medications', (SELECT jsonb_agg(row_to_json(um)) FROM medcontrol.user_medications um WHERE user_id = v_uid),
    'subscription', (SELECT row_to_json(s) FROM medcontrol.subscriptions s WHERE "userId" = v_uid),
    'exported_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;
```

**Edge function `export-my-data`** wrap pra gerar PDF estruturado + JSON ao Storage temp (TTL 1h).

**UI em Settings → "Exportar meus dados"** botão dispara + email com link download.

---

#### P3.14 `has_patient_full_access` + `has_patient_mark_access` (granularidade share)

```sql
CREATE OR REPLACE FUNCTION medcontrol.has_patient_full_access(p_patient_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM medcontrol.patients WHERE id = p_patient_id AND "userId" = auth.uid())
  OR EXISTS (SELECT 1 FROM medcontrol.patient_shares WHERE "patientId" = p_patient_id AND "sharedWithUserId" = auth.uid() AND access_level = 'full');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION medcontrol.has_patient_mark_access(p_patient_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM medcontrol.patients WHERE id = p_patient_id AND "userId" = auth.uid())
  OR EXISTS (SELECT 1 FROM medcontrol.patient_shares WHERE "patientId" = p_patient_id AND "sharedWithUserId" = auth.uid() AND access_level IN ('mark', 'full'));
$$ LANGUAGE sql STABLE;
```

**Refatorar RLS policies** treatments INSERT/UPDATE → `has_patient_full_access`. doses mark via RPC → `has_patient_mark_access`.

---

#### P3.15 TTL share — `access_level` + `is_temporary` + `expires_at`

```sql
ALTER TABLE medcontrol.patient_shares
  ADD COLUMN access_level TEXT NOT NULL DEFAULT 'full' CHECK (access_level IN ('read','mark','full')),
  ADD COLUMN is_temporary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN last_extended_at TIMESTAMPTZ,
  ADD COLUMN invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD CONSTRAINT ttl_consistency CHECK (
    (is_temporary = false AND expires_at IS NULL) OR
    (is_temporary = true AND expires_at IS NOT NULL AND expires_at > invited_at)
  );

CREATE INDEX shares_expires_idx ON medcontrol.patient_shares(expires_at) WHERE is_temporary = true;
```

**RPCs:**
- `share_patient_by_email(patient_id, email, access_level, expires_at)` — atualizar pra novos params
- `update_share_access(share_id, new_level)` — owner-only
- `extend_temporary_share(share_id, new_expires_at)` — owner-only

**UI:**
- `SharePatientSheet.jsx` adiciona radio "Permanente / Temporário" + datepicker
- `<TemporaryShareBadge>` assimétrico no PatientDetail (owner vê cronômetro, caregiver não)

**Aceite:** Share temporário 1h expira automaticamente, paciente desaparece da lista do cuidador.

---

### Edge Functions faltantes

#### P3.16 `_shared/fcm.ts` consolidado (eliminar ~480 LOC duplicados)

Criar `supabase/functions/_shared/fcm.ts`:

```typescript
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getFcmAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  // ... PKCS8 RS256 signing logic (mover de daily-alarm-sync)
  cachedToken = { value: token, expiresAt: Date.now() + 3500 * 1000 };
  return token;
}

export interface SendOpts {
  token: string;
  data?: Record<string, string>;
  notification?: { title: string; body: string };
  android?: { priority?: 'HIGH'|'NORMAL'; collapse_key?: string; ttl?: string };
}

export async function sendFcm(opts: SendOpts): Promise<{ ok: boolean; error?: string }> {
  const token = await getFcmAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;
  // ... retry exp backoff + classify UNREGISTERED vs INVALID_ARGUMENT
}

export async function sendFcmBatch(opts: SendOpts[]): Promise<{ ok: number; fail: number }> { ... }
```

**Refatorar 6 functions** pra importar de `_shared/fcm.ts`.

**Aceite:** Grep `getFcmAccessToken` em `supabase/functions/` retorna 1 match (apenas em `_shared/fcm.ts`).

**Branch:** `refactor/shared-fcm-consolidation`

---

#### P3.17 Edge `treatment-changed-handler`

Trigger DB → Edge → FCM data-only pra todos devices do user re-agendarem.

```typescript
// supabase/functions/treatment-changed-handler/index.ts
import { sendFcmBatch } from '../_shared/fcm.ts';

Deno.serve(async (req) => {
  const body = await req.json();
  const treatmentId = body.record?.id;
  const userId = body.record?.userId;

  // Buscar push_subscriptions do user
  const { data: subs } = await adminSb.schema('medcontrol').from('push_subscriptions')
    .select('deviceToken').eq('userId', userId);

  const payloads = subs.map(s => ({
    token: s.deviceToken,
    data: { type: 'treatment_changed', treatment_id: treatmentId, user_id: userId },
    android: { priority: 'HIGH' }
  }));

  const result = await sendFcmBatch(payloads);
  return new Response(JSON.stringify(result), { status: 200 });
});
```

**Trigger SQL:**
```sql
CREATE OR REPLACE FUNCTION medcontrol.notify_treatment_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status OR NEW."intervalHours" != OLD."intervalHours" OR NEW."firstDoseTime" != OLD."firstDoseTime" THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/treatment-changed-handler',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, net, public;

CREATE TRIGGER trg_notify_treatment_changed
  AFTER UPDATE OF status, "intervalHours", "firstDoseTime" ON medcontrol.treatments
  FOR EACH ROW EXECUTE FUNCTION medcontrol.notify_treatment_changed();
```

**Java handler em `DosyMessagingService`:** `data.type=treatment_changed` → trigger `DoseSyncWorker.runOnce()` imediato.

**Aceite:** Edit treatment → todos devices recebem FCM em <5s + re-agendam local.

---

#### P3.18 Edge `expire-temporary-shares` (cron hourly)

```typescript
// supabase/functions/expire-temporary-shares/index.ts
Deno.serve(async () => {
  const { data: expired } = await adminSb.schema('medcontrol').from('patient_shares')
    .select('*').eq('is_temporary', true).lte('expires_at', new Date().toISOString());

  for (const share of expired ?? []) {
    // Delete row (trigger patient-unshare-handler dispara FCM)
    await adminSb.schema('medcontrol').from('patient_shares').delete().eq('id', share.id);
  }
  return new Response(JSON.stringify({ expired: expired?.length ?? 0 }));
});
```

**pg_cron schedule:**
```sql
SELECT cron.schedule('expire-temp-shares-hourly', '0 * * * *',
  $$SELECT net.http_post(url := current_setting('app.settings.supabase_url') || '/functions/v1/expire-temporary-shares', ...);$$
);
```

---

#### P3.19 Edge `notify-expiring-shares` (cron hourly)

Alerta owner 1h antes (sempre) + 24h antes (se share > 36h).

```typescript
Deno.serve(async () => {
  const now = new Date();
  const in1h = new Date(now.getTime() + 60*60*1000);
  const in24h = new Date(now.getTime() + 24*60*60*1000);

  // Shares expirando em ~1h: alerta owner
  const { data: nearExpire } = await adminSb.schema('medcontrol').from('patient_shares')
    .select('*').eq('is_temporary', true)
    .gte('expires_at', now.toISOString()).lte('expires_at', in1h.toISOString())
    .is('one_hour_notified_at', null);

  for (const share of nearExpire ?? []) {
    await sendFcmToUser(share.ownerId, {
      data: { type: 'share_expiring_1h', share_id: share.id, patient_id: share.patientId }
    });
    await adminSb.schema('medcontrol').from('patient_shares').update({ one_hour_notified_at: now.toISOString() }).eq('id', share.id);
  }

  // Similar pra 24h
  return new Response(JSON.stringify({ ok: true }));
});
```

**Adicionar colunas:** `one_hour_notified_at`, `twenty_four_hour_notified_at` em `patient_shares`.

---

#### P3.20 Edge `treatment-alert-setting-handler` (per-user-per-treatment)

Trigger AFTER INSERT/UPDATE em `treatment_user_alert_settings` → FCM data-only pro device do user re-agendar AlarmScheduler com novo nível.

---

#### P3.21 Edge `cmed-monthly-sync` (substitui scripts manuais)

```typescript
// supabase/functions/cmed-monthly-sync/index.ts
import { parseXlsx } from 'https://esm.sh/exceljs@4';

Deno.serve(async () => {
  // 1. Download XLSX CMED do mês corrente
  const cmedUrl = `https://www.gov.br/anvisa/.../xls_conformidade_site_${currentMonth}.xlsx`;
  const xlsxBuffer = await fetch(cmedUrl).then(r => r.arrayBuffer());

  // 2. Parse rows
  const rows = await parseXlsx(xlsxBuffer);

  // 3. Diff vs snapshot atual em Storage
  const { data: lastSnapshot } = await adminSb.storage.from('cmed-snapshots').download('latest.json');
  const diff = computeDiff(lastSnapshot, rows);

  // 4. Salva diff pra admin review
  await adminSb.storage.from('cmed-snapshots').upload(`pending-${currentMonth}.json`, JSON.stringify(diff));

  // 5. Email admin com link pra aprovação
  await sendAdminEmail({
    subject: `CMED sync ${currentMonth}: ${diff.added.length} adds, ${diff.removed.length} removes`,
    body: `Review at /admin/cmed-pending`
  });

  return new Response(JSON.stringify({ pending_review: diff }));
});
```

**Admin painel** em `/admin/cmed-pending` aprova → Edge function 2 (`cmed-apply`) executa migration auto-gerada.

---

#### P3.22 Edge `delete-account` audit final

Em `supabase/functions/delete-account/index.ts` após linha 88:

```typescript
const result = await adminSb.rpc('delete_my_account');
const delUser = await adminSb.auth.admin.deleteUser(user.id);

// AUDIT FINAL
await adminSb.schema('medcontrol').from('security_events').insert({
  user_id: user.id,
  event_type: 'delete_account_success',
  metadata: { rpc_ok: !result.error, auth_delete_ok: !delUser.error, ts: new Date().toISOString() },
  ip_address: clientIp,
  user_agent: userAgent
});

await adminSb.schema('medcontrol').from('audit_log').insert({
  user_id: user.id,
  action: 'account_deleted',
  metadata: { rpc_ok: !result.error, auth_delete_ok: !delUser.error }
});
```

---

#### P3.23 HMAC validation em webhooks `pg_net`

Criar `_shared/webhookHmac.ts`:

```typescript
import { crypto } from 'https://deno.land/std/crypto/mod.ts';

export async function validateHmac(req: Request, secret: string): Promise<boolean> {
  const sig = req.headers.get('x-signature');
  if (!sig) return false;
  const body = await req.text();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const computed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const computedHex = Array.from(new Uint8Array(computed)).map(b => b.toString(16).padStart(2, '0')).join('');
  return sig === computedHex;
}
```

**Trigger SQL atualiza pra incluir HMAC:**
```sql
PERFORM net.http_post(
  url := current_setting('app.settings.supabase_url') || '/functions/v1/dose-trigger-handler',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-signature', encode(hmac(payload::text, current_setting('app.settings.webhook_secret'), 'sha256'), 'hex')
  ),
  body := payload
);
```

**Edge function valida HMAC primeiro thing.**

---

#### P3.24 `patient-unshare-handler` defense-in-depth

Atualmente confia 100% em FCM. Adicionar 2 mecanismos:

1. **Server-side invalidation token:** quando unshare acontece, inserir em `pending_cache_invalidations` table. Caregiver app on resume verifica + força cleanup IDB.

```sql
CREATE TABLE medcontrol.pending_cache_invalidations (
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  reason TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, patient_id, "createdAt")
);
```

2. **JWT claim refresh:** após unshare, set custom claim que força client refresh do JWT next call (server rejeita queries com claim antigo).

**Aceite:** simular FCM falha (force-stop app) → na próxima abertura, paciente desaparece em <2s.

---

## 8. P4 — UI primitives Dosy v2 (backport completo)

### P4.1 `<MedicationPicker>` BottomSheet (substituir MedNameInput dropdown)

**Rationale:** 3 bugs estruturais reproduzíveis. Spec completa em `dosy-app/docs/07-DESIGN_SYSTEM.md §3.13`.

**Criar `src/components/dosy/MedicationPicker.jsx`** (novo):

```jsx
import { Sheet } from './surfaces';
import { Input } from './forms';

export default function MedicationPicker({ value, onChange, onSelectFull, patient }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [state, setState] = useState('idle'); // idle/searching/results/empty/error/offline

  // Bottom Sheet 80vh em mobile, dropdown inline em web (responsive)
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return (
      <>
        <Input value={value} onClick={() => setSheetOpen(true)} readOnly placeholder="Digite o medicamento" />
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} height="80vh">
          <SheetHeader title="Buscar medicamento" onClose={() => setSheetOpen(false)} />
          <Input autoFocus value={query} onChange={setQuery} placeholder="Digite nome ou princípio..." />
          {state === 'searching' && <LoadingExplicit text="Buscando..." />}
          {state === 'results' && (
            <ResultList>
              {results.map(r => (
                <MedicationResultRow key={r.id} med={r}
                  onPointerDown={(e) => { e.preventDefault(); onSelectFull(r); setSheetOpen(false); }} />
              ))}
            </ResultList>
          )}
          {state === 'empty' && <EmptyState query={query} />}
          <SheetFooter>
            <Button kind="ghost" onClick={() => { onChange(query); setSheetOpen(false); }}>
              + Continuar com "{query}" digitado
            </Button>
          </SheetFooter>
        </Sheet>
      </>
    );
  }

  // Desktop: dropdown inline com Portal + auto-flip
  return <DesktopAutocomplete ... />;
}
```

**Substituir uso em** `TreatmentForm.jsx`, `SOS.jsx`:
```jsx
- <MedNameInput value={...} onChange={...} />
+ <MedicationPicker value={...} onChange={...} onSelectFull={...} />
```

**Deletar `src/components/MedNameInput.jsx`** após migração.

**Validações device obrigatórias:**
- Pixel 6: teclado virtual NÃO cobre resultados
- Samsung A54: scroll dentro sheet sem fechar
- Xiaomi Redmi 12: tap em result registra
- Persona 6 simulada (font scaling 1.5×): targets ≥56dp
- Voice input: query preservada

**Aceite:** 0 incidências do bug "sheet some quando arrasta" em 7 dias prod.

**Branch:** `refactor/medication-picker-bottomsheet`

---

### P4.2 `<CategoryBadge>` display-only

```jsx
// src/components/dosy/CategoryBadge.jsx
export default function CategoryBadge({ groupId, size = 'md', variant = 'tinted' }) {
  const group = MED_GROUPS.find(g => g.id === groupId) ?? MED_GROUPS.find(g => g.id === 'nao_classificado');
  const colorVar = group.color;

  const styles = {
    md: { height: 26, fontSize: 12, paddingX: 10 },
    sm: { height: 22, fontSize: 11, paddingX: 8 }
  }[size];

  if (variant === 'outlined') {
    return (
      <span style={{
        height: styles.height, fontSize: styles.fontSize, padding: `0 ${styles.paddingX}px`,
        border: `1px solid color-mix(in srgb, ${colorVar} 30%, transparent)`,
        color: colorVar, borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6
      }}>
        <Dot color={colorVar} />{group.label}
      </span>
    );
  }
  return (
    <span style={{
      height: styles.height, fontSize: styles.fontSize, padding: `0 ${styles.paddingX}px`,
      background: `color-mix(in srgb, ${colorVar} 12%, transparent)`,
      color: colorVar, borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6
    }}>
      <Dot color={colorVar} />{group.label}
    </span>
  );
}
```

**Substituir 4+ renderings inline** em MedNameInput, DoseHistory, Analytics.

---

### P4.3 `<Section>` collapsable unificada

Consolidar `TreatmentSection` (PatientDetail), `CollapsibleSection` (TreatmentList), regras section (SOS).

```jsx
// src/components/dosy/Section.jsx
export default function Section({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="dosy-section">
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        <h3>{title}</h3>
        {count !== undefined && <Chip>{count}</Chip>}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
```

---

### P4.4 `<FilterChip>` + `<DataChip>` (consolidar 4 `chipStyle()` locais)

```jsx
// src/components/dosy/Chip.jsx
export function FilterChip({ active, onClick, children, count }) { ... }
export function DataChip({ avatar, label, onRemove }) { ... }
```

**Refatorar Analytics, Reports, TreatmentList, SOS** pra usar.

---

### P4.5 `<Button loading>` inline (substituir `disabled={isPending}`)

```jsx
// Em buttons.jsx, adicionar prop `loading`
export function Button({ kind = 'primary', loading, children, onClick, ...props }) {
  return (
    <button onClick={onClick} aria-busy={loading} {...props}>
      {loading && <Spinner size="sm" />}
      <span style={{ opacity: loading ? 0.7 : 1 }}>{children}</span>
    </button>
  );
}
```

**Refatorar Dashboard, TreatmentForm, SOS, Settings mutations:**
```jsx
- <Button disabled={mutation.isPending}>Criar</Button>
+ <Button loading={mutation.isPending}>Criar</Button>
```

---

### P4.6 `<List>` virtualizado

Consolidar 5 implementações ad hoc (Dashboard, Patients, PatientDetail, DoseHistory, TreatmentList).

```jsx
// src/components/dosy/List.jsx
import { useVirtualizer } from '@tanstack/react-virtual';

export default function List({ items, renderItem, emptyState, loadingState, errorState, virtualizeAt = 50 }) {
  if (loadingState) return loadingState;
  if (errorState) return errorState;
  if (items.length === 0) return emptyState;

  if (items.length < virtualizeAt) {
    return <div>{items.map(renderItem)}</div>;
  }

  // Virtualized
  const parentRef = useRef();
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5
  });
  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map(vRow => (
          <div key={vRow.key} style={{ position: 'absolute', top: vRow.start, width: '100%' }}>
            {renderItem(items[vRow.index])}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### P4.7 3 primitives Dosy NOVOS

#### P4.7a `<AlertLevelToggle>` 3-segmentos
Per-treatment crítico/push/silent. Conecta com `treatment_user_alert_settings` (P3.4).

#### P4.7b `<CriticalInertBadge>`
Quando switch global Alarme Crítico OFF + tratamento marcado Crítico → mostra badge "Crítico inerte" + tooltip.

#### P4.7c `<TemporaryShareBadge>` assimétrico
Owner vê cronômetro `-- 3d 4h 12min`. Caregiver vê apenas badge "Compartilhamento temporário" SEM tempo.

---

### P4.8 `<CategorySuggestionModal>` automático no autofill-fail (mover do submit)

Hoje `CategoryHintModal` dispara NO SUBMIT. Mover pra disparar AUTOMATICAMENTE quando `useClassifyMedication` retorna `group_id=NULL`:

```jsx
// Em TreatmentForm.jsx
const classify = useClassifyMedication(form.medName);

useEffect(() => {
  if (classify.data && !classify.data.group_id && !form.group_id) {
    setHintModalOpen(true); // dispara automaticamente
  }
}, [classify.data]);
```

---

### P4.9 Drill-down Analytics donut → classe CMED

Em `Analytics.jsx` no card "Doses por categoria":

```jsx
<Donut data={groupCounts} onSliceClick={(groupId) => setDrillDownGroup(groupId)} />
{drillDownGroup && (
  <Sheet open onClose={() => setDrillDownGroup(null)}>
    <h3>{MED_GROUPS.find(g => g.id === drillDownGroup).label}</h3>
    <CmedClassBreakdown groupId={drillDownGroup} period={period} />
  </Sheet>
)}
```

`CmedClassBreakdown` chama RPC nova `cmed_class_stats(group_id, period)`.

---

### P4.10 Card "Última dose de cada categoria" no topo Histórico

```jsx
// Em DoseHistory.jsx topo
<LastDoseByCategory userId={user.id} />

// Componente
function LastDoseByCategory({ userId }) {
  const { data } = useQuery({
    queryKey: ['last-dose-by-group', userId],
    queryFn: () => supabase.rpc('last_dose_per_group', { p_user_id: userId, p_limit: 5 })
  });
  return (
    <Card variant="elevated">
      <SectionTitle>Última dose de cada categoria</SectionTitle>
      <List items={data} renderItem={r => (
        <Row>
          <CategoryBadge groupId={r.group_id} />
          <span>{r.med_name}</span>
          <span>{formatRelative(r.last_actual_time)}</span>
        </Row>
      )} />
    </Card>
  );
}
```

RPC nova:
```sql
CREATE OR REPLACE FUNCTION medcontrol.last_dose_per_group(p_user_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (group_id TEXT, med_name TEXT, last_actual_time TIMESTAMPTZ) AS $$
  SELECT DISTINCT ON (group_id) group_id, "medName", "actualTime"
  FROM medcontrol.doses
  WHERE "userId" = p_user_id AND status = 'done' AND group_id IS NOT NULL
  ORDER BY group_id, "actualTime" DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
```

---

### P4.11 Botão "Compartilhar pro médico" no Histórico

```jsx
// Em DoseHistory.jsx header
<Button kind="primary" onClick={() => setShareSheetOpen(true)}>
  <Icon name="share-2" /> Compartilhar pro médico
</Button>

<Sheet open={shareSheetOpen}>
  <h3>Como compartilhar?</h3>
  <Button onClick={() => shareScreenshot()}>Tirar screenshot</Button>
  <Button onClick={() => sharePdf()}>Gerar PDF</Button>
</Sheet>
```

`sharePdf` reusa jsPDF/html2canvas que Reports.jsx já usa, mas gera PDF compacto 1-2 páginas com filtros atuais aplicados.

---

### P4.12 Reports.jsx integrar categoria (PDF + CSV)

Atualmente Reports.jsx zero menções a categoria. Adicionar:

```jsx
// Reports.jsx
<FilterPanel>
  <CategoryPicker value={filterGroup} onChange={setFilterGroup} mode="filter" multiSelect />
</FilterPanel>

<Card title="Resumo por categoria">
  <Table>
    {groupSummary.map(g => (
      <Row>
        <CategoryBadge groupId={g.group_id} />
        <span>{g.total_doses}</span>
        <span>{g.percentage}%</span>
        <span>Top: {g.top_med}</span>
      </Row>
    ))}
  </Table>
</Card>
```

CSV export adiciona coluna `cmed_class`. PDF inclui breakdown.

---

### P4.13 Tokens / a11y polish (~10 sub-items consolidados)

- Audit cores hex hardcoded → tokens (`#3F9E7E` → `var(--dosy-success)`)
- Audit font-sizes `.5` → escala fixa
- Aplicar `shouldReduceMotion()` em todas animações Dashboard/Analytics/SOS/Onboarding
- Touch targets ≥56dp em BottomNav NavLink, Settings Row, Skip-link
- Skip-link `bg-brand-600` → `var(--dosy-primary)`
- Substituir `window.confirm` em TreatmentList por `<ConfirmDialog>`
- `Analytics.jsx` filtrar cancelled doses (bug #0005 fix)
- Foreground accessibility: `aria-busy`, `aria-live="polite"` em loading states
- Lint rule: banir hex em JSX (`no-restricted-syntax`)
- Lint rule: banir `fontSize: X.5`

---

### P4.14 Eliminar código morto UI

```bash
rm src/hooks/useRealtime.js          # 200+ LOC dead (substituído por useRealtimePatient em P1.9)
rm src/components/BellAlerts.jsx     # 188 LOC, AppHeader optou pelos ícones diretos
rm src/components/AnimatedRoutes.jsx # 56 LOC, não importado
rm src/components/Dropdown.jsx       # 83 LOC, vestigial uso .input legacy
rm src/components/PatientCard.jsx    # 23 LOC, quase não usado
```

Verificar via Grep que nenhum importa antes.

---

## 9. P5 — Test stack completo

### P5.1 pgTAP em `supabase/tests/`

```bash
mkdir -p supabase/tests
cat > supabase/tests/001_confirm_dose.sql <<'EOF'
BEGIN;
SELECT plan(8);

-- Setup test data
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'test@dosy.com');
INSERT INTO medcontrol.patients (id, "userId", name, age) VALUES (...);
INSERT INTO medcontrol.treatments (id, "userId", "patientId", "medName", unit, "startDate", status) VALUES (...);
INSERT INTO medcontrol.doses (id, "userId", "treatmentId", "patientId", "medName", unit, "scheduledAt", status) VALUES (..., 'pending');

-- Test 1: happy path
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001"}';
SELECT ok((SELECT (medcontrol.confirm_dose('...dose_id...', NOW(), null))->>'ok')::boolean, 'confirm_dose happy path returns ok=true');

-- Test 2: idempotência (confirmar já confirmada)
SELECT is((medcontrol.confirm_dose('...dose_id...', NOW(), null))->>'code', '409', 'returns 409 if already done');

-- Test 3: returns current_state em 409
SELECT isnt((medcontrol.confirm_dose('...done_dose...', NOW(), null))->'current_state', null, '409 returns current_state');

-- Test 4: RLS bloqueia user errado
SET LOCAL request.jwt.claims = '{"sub": "...different_user..."}';
SELECT throws_like('SELECT medcontrol.confirm_dose(''...other_user_dose...'', NOW(), null)', '%forbidden%', 'RLS denies other user');

-- ... 4 more tests

SELECT * FROM finish();
ROLLBACK;
EOF

# Rodar
supabase test db
```

Criar tests pra cada RPC: `skip_dose`, `undo_dose`, `register_sos_dose`, `create_treatment_with_doses`, `update_treatment_preserving_history`, `end_treatment`, `share_patient_by_email`, `unshare_patient`, `extend_temporary_share`, `delete_my_account`, `export_my_data`, `effective_tier`, `admin_grant_tier`, `has_patient_access`, `validate_sos`, `check_interactions`.

**Aceite:** `supabase test db` passa 100+ tests + CI gate (PR rejected se RPC nova sem test).

---

### P5.2 Deno test em Edge functions

```typescript
// supabase/functions/dose-trigger-handler/index.test.ts
import { assertEquals } from 'https://deno.land/std/assert/mod.ts';
import { handler } from './index.ts';

Deno.test('dose-trigger-handler INSERT pending → schedule_alarms FCM', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({
      type: 'INSERT',
      record: { id: '...', userId: '...', status: 'pending', scheduledAt: '2026-06-01T10:00:00Z' }
    })
  });
  // Mock sendFcm
  const res = await handler(req);
  const json = await res.json();
  assertEquals(json.ok, true);
  // assert FCM was called with action=schedule_alarms
});
```

Criar tests pra cada function: `daily-alarm-sync`, `dose-trigger-handler`, `patient-share-handler`, `patient-unshare-handler`, `delete-account`, `treatment-changed-handler`, `expire-temporary-shares`, `notify-expiring-shares`, `cmed-monthly-sync`.

---

### P5.3 Vitest cobertura state machines 100%

Criar `src/core/state-machines/doses.ts` (novo):

```typescript
type DoseStatus = 'pending' | 'overdue' | 'done' | 'skipped' | 'cancelled';

const VALID_TRANSITIONS: Record<DoseStatus, DoseStatus[]> = {
  pending: ['overdue', 'done', 'skipped', 'cancelled'],
  overdue: ['done', 'skipped', 'cancelled'],
  done: ['pending'], // undo
  skipped: ['pending'], // undo
  cancelled: ['pending'] // resume_treatment
};

export function canTransition(from: DoseStatus, to: DoseStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

Test:
```typescript
import { describe, it, expect } from 'vitest';
import { canTransition } from './doses';

describe('Dose state machine', () => {
  it.each([
    ['pending', 'done', true],
    ['pending', 'cancelled', true],
    ['done', 'pending', true],
    ['done', 'skipped', false],
    ['cancelled', 'done', false],
    // ... all combinations
  ])('canTransition(%s, %s) == %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});
```

Mesma estrutura para state machines de `treatments`, `subscriptions`, `shares`.

**Configurar threshold** em `vitest.config.js`:
```javascript
coverage: {
  thresholds: {
    'src/core/state-machines/**': { lines: 100, branches: 100, functions: 100, statements: 100 }
  }
}
```

---

### P5.4 Vitest `scheduler.js` (healthcare-critical 0% atual)

`src/services/notifications/scheduler.test.js`:

```javascript
describe('rescheduleAll', () => {
  it('DnD window honrada — não agenda alarme em DnD', async () => {
    setPrefs({ dnd_enabled: true, dnd_start: '22:00', dnd_end: '07:00' });
    const now = new Date('2026-06-01T23:30:00');
    await rescheduleAll([{ id: '1', scheduledAt: '2026-06-02T01:00:00' }]);
    // Assert: tray scheduled, NOT critical alarm
  });

  it('criticalOff count correto — todos tratamentos viram tray', ...);
  it('signature guard previne reagendamento desnecessário', ...);
  it('cancelAll chamado antes de novo agendamento', ...);
  it('Throttle 30s + trailing run', ...);
});
```

**Meta:** ≥60% coverage em `scheduler.js`.

---

### P5.5 Vitest `mutationRegistry.js` (694 LOC, 0% atual)

Test cada mutation: onMutate patch, onSuccess clear gate + invalidate, onError rollback + snackbar.

---

### P5.6 5 cenários E2E top (Dosy v2 §3.8) — gaps 3, 4, 5

Criar `scripts/qa/flows/`:

- `cold-start-alarm-fire.spec.mjs` — Cold start → AlarmActivity → tap "Tomada" → DB confirma
- `offline-queue-drain.spec.mjs` — Offline → Confirm 3 doses → Online → Queue drain → DB tem 3 done
- `end-treatment-cancels-alarm.spec.mjs` — End treatment → Alarm cancelado → Next NÃO dispara

---

### P5.7 5 cenários E2E v1.1 (gaps 7, 9, 10)

- `share-ttl-expira.spec.mjs` — Share temporário 1min → wait → cuidador cleanup
- `update-mandatory-modal.spec.mjs` — Set is_mandatory=true em app_releases → next launch → modal bloqueante
- `logout-cleanup-sharedprefs.spec.mjs` — Logout → SharedPrefs limpos + alarms cancelled

---

### P5.8 Regression tests consolidados por bug

Estrutura `tests/regression/medcontrol-bugs/`:
- `nb4-force-kill-dose.test.js` (consolida 7 NB-4 variants)
- `0001-fcm-token-clear-reload.test.js`
- `0005-cancelled-pollution-stats.test.js`
- `0009-share-sheet-loading-infinite.test.js`
- `0010-banner-version-vs-semver.test.js`
- `157-realtime-storm.test.js` (assert: realtime sob demanda só PatientDetail)
- `205-refresh-token-storm.test.js`
- `215-prefs-race-scheduler.test.js`
- `229-snooze-persist-reboot.test.js`
- `272-default-range-dashboard.test.js`
- `275-throttle-persist-1000ms.test.js`
- `287-killed-caregiver-gap.test.js`
- `297-unshare-lgpd-cleanup.test.js`
- `300-precheck-http-alarm-receiver.test.js`

**DoD §2:** novo bug em prod = regression test escrito antes do fix (red → green).

---

### P5.9 Sample validation 50 brand-names BR

```javascript
// tests/integration/medication-catalog-coverage.test.js
const BRANDS = [
  { name: 'Clavulin BD 875mg', expected_group: 'antibiotico' },
  { name: 'Novalgina 500mg', expected_group: 'antitermico_analgesico' },
  { name: 'Tylenol 750mg', expected_group: 'antitermico_analgesico' },
  { name: 'Dorflex', expected_group: 'antitermico_analgesico' },
  { name: 'Buscopan Composto', expected_group: 'antitermico_analgesico' },
  { name: 'Aerolin Spray', expected_group: 'broncodilatador' },
  { name: 'Losartana 50mg', expected_group: 'anti_hipertensivo' },
  { name: 'Omeprazol 20mg', expected_group: 'gastrointestinal' },
  { name: 'Puran T4 25mcg', expected_group: 'hormonal' },
  { name: 'Selene', expected_group: 'hormonal' },
  // ... 40 mais
];

test.each(BRANDS)('%s deve retornar group_id=%s no autocomplete', async ({ name, expected_group }) => {
  const { data } = await supabase.rpc('search_medications', { q: name.substring(0, 5), lim: 5 });
  const match = data.find(m => m.nome_comercial.toLowerCase().includes(name.toLowerCase().split(' ')[0]));
  expect(match?.group_id).toBe(expected_group);
});
```

---

### P5.10-P5.15 (consolidados)

- CI workflow rodar `npm test` + `supabase test db` + `deno test supabase/functions` em cada PR
- Coverage threshold global `src/core/**` 90%+ + `src/services/**` 60%+
- Sample validation script `validate-medications-seed.ts` em CI
- Test pra Sentry beforeSend strip (validar P0.3)
- Test pra PostHog consent gate (validar P0.4)
- Lighthouse CI (a11y + performance score) em PR

---

## 10. P6 — Documentação (gaps absorvidos)

### P6.1 ADR-005 Google Play "Saúde e fitness" (não Medicina)

Criar `context/decisoes/2026-XX-XX-google-play-categoria-saude.md` documentando:
- Decisão: Console categoria "Saúde e fitness"
- Texto loja: descrever como "medication reminder consumer wellness" (não medical device)
- Disclaimers obrigatórios: "Não substitui orientação médica"
- Permissions justificadas: USE_EXACT_ALARM (medication reminder Play policy permite)
- Histórico: rejection 2026-05-06 + resolução

---

### P6.2 Anti-pattern nomeado `disabled={anyMutationPending}` coletivo

Documentar em `context/PROJETO.md` ou novo `context/anti-patterns.md`:

```markdown
## Anti-pattern: `disabled={anyMutationPending}` coletivo em fila de doses

**Sintoma:** botão "Tomada" preso enquanto outra mutation pending em qualquer dose.

**Causa:** todas mutations compartilham 1 estado `isPending` global.

**Solução:** per-dose `pendingDoseId` ref + checagem `pendingDoseId === thisDose.id`.

**Origem:** `MultiDoseModal.jsx` v0.2.3.13 — fix Fase 1 Refactor_Full.
```

---

### P6.3 Inventário 10 componentes unificáveis (Refactor_Full §11) com props + LOC

Documentar em `context/PROJETO.md` ou `docs/component-inventory.md`:

| Component | LOC atual | LOC após adopção | Economia | Status |
|---|---|---|---|---|
| EmptyState | 4 variantes built-in 115 LOC | 80 LOC | 35 | ✅ adopted |
| DateRangeChips | 62 | 62 | 0 | ✅ adopted |
| StatGrid | 39 | 39 | 0 | ✅ adopted |
| FormRow | 90 | -150 (consolidates) | 60 | 🟡 pending |
| TodayDosesStat | 94 | -50 | 44 | 🟡 pending |
| MedicationHistoryGrid | 136 | -200 | 64 | 🟡 pending |
| TreatmentCard | 102 | -300 | 198 | 🟡 pending |
| DoseList | 87 | -250 | 163 | 🟡 pending |
| FilterPanel | 175 | -200 | 25 | 🟡 pending |
| DoseSheet (DoseModal + MultiDoseModal) | 55 + 306 + 262 | 200 | 423 | 🟡 pending |
| **TOTAL economia** | | | **~1300 LOC** | |

---

### P6.4 Spec técnico alarme+push detalhado

Criar `docs/alarm-scheduling-v0.2.6.md` atualizando `v0.2.3.1`:

- 5 caminhos scheduling (JS rescheduleAll DEPRECATED, mutation cache patch, DB trigger, daily-alarm-sync cron, Java DoseSyncWorker)
- 3 mecanismos fire (M1 AlarmReceiver, M2 TrayNotificationReceiver, M3 Capacitor LocalNotifications REMOVIDO em P2.4)
- Branch logic ALARM_PLUS_PUSH / PUSH_DND / PUSH_CRITICAL_OFF
- Re-rota fire-time consultando SharedPrefs (Fix B)
- Pre-check HTTP (#300)
- Statement-level trigger batch FCM

---

### P6.5 Decisão consciente "não criar cron 1min"

`context/decisoes/2026-XX-XX-no-cron-1min.md`:

> **Decisão:** Não criar cron Edge Function de frequência <5min.
>
> **Origem:** `dose-fire-time-notifier` custou 1440 invocações/dia sem ganho real (substituído por pre-check HTTP em AlarmReceiver + WorkManager 24h).
>
> **Alternativas:** Pre-check HTTP em fire time, WorkManager periodic, trigger DB AFTER UPDATE.

---

### P6.6 ADR-006 single-dev "1 sessão = 1 release branch"

Já existe em `context/decisoes/2026-05-01-001-modelo-1-sessao-1-release-branch.md`. Manter atualizado.

---

### P6.7 Datasets brand_map BR consolidar

Criar `scripts/data/brand_map_br.json`:

```json
{
  "Aerolin": { "principio": "Salbutamol", "group_id": "broncodilatador" },
  "Clenil": { "principio": "Beclometasona", "group_id": "broncodilatador" },
  "Decadron": { "principio": "Dexametasona", "group_id": "corticoide" },
  "Mounjaro": { "principio": "Tirzepatida", "group_id": "antidiabetico" },
  "Ozempic": { "principio": "Semaglutida", "group_id": "antidiabetico" },
  "Zoloft": { "principio": "Sertralina", "group_id": "antidepressivo" },
  "Lexapro": { "principio": "Escitalopram", "group_id": "antidepressivo" }
}
```

Consumido por `ingest-cmed.mjs` (P3.21) como override + por `classify_medication_robust` tier 0.

---

### P6.8 Aplicar Regras 16+17 do Dosy v2

- **Regra 16:** Histórico em ordem reversa cronológica em TODOS docs (prepend no TOPO)
- **Regra 17:** Pendências preliminares no doc destino (não em `context/CHECKLIST.md` gigante)

Auditar cada doc em `context/` e converter histórico pra reverso. Migrar entries `CHECKLIST.md` que são notas preliminares pra docs destino respectivos.

---

### P6.9-P6.14 (consolidados)

- ADR Resend SMTP atualizar com rate limit 2/h Supabase built-in
- Doc beta feedback form Google Forms spec
- Egress audit playbook F1-F8 patterns
- Documentar realidade vs spec contrato bridge JS↔Java
- Adicionar PR template checklist (egress, RLS, cache key, state machine, lint zero)
- Atualizar `STATE.md` header: "Status: Em alinhamento ativo com Dosy v2 docs"

---

## 11. P7 — Limpeza estrutural

### P7.1 Deletar scripts redundantes (17 arquivos)

```bash
cd "G:\00_Trabalho\01_Pessoal\Apps\medcontrol_v2"
rm scripts/qa_tap_mais.mjs scripts/qa_nb4_test.mjs scripts/qa_nb4_open.mjs scripts/qa_nb4_normal.mjs scripts/qa_nb4_kill.mjs scripts/qa_nb4_kill_v2.mjs scripts/qa_bug4_b.mjs scripts/qa_v12_login.mjs scripts/qa_v12_tap.mjs scripts/qa_v12_tap_strong.mjs scripts/qa_v12_patch_capacitor.mjs scripts/qa_unshare.mjs scripts/qa_skip_login.mjs scripts/flow_v3.mjs scripts/caregiver_step2_share.mjs scripts/cdp_click_entrar.mjs scripts/cdp_login_port.mjs
git commit -am "chore(scripts): remove 17 scripts redundantes"
```

### P7.2 Mover scripts pra `_archive/` (11 arquivos)

```bash
mkdir -p scripts/_archive
mv scripts/qa_owner_drill.mjs scripts/qa_seq.mjs scripts/qa_a2_owner_pac.mjs scripts/qa_v12_validate.mjs scripts/qa_v12_inject.mjs scripts/qa_v12_install_observer.mjs scripts/qa_v12_toast_capture.mjs scripts/qa_v12_patch_capacitor2.mjs scripts/qa_final_login.mjs scripts/qa_nb4_final.mjs scripts/qa_nb4_kill_v3.mjs scripts/_archive/
echo "scripts/_archive/**" >> .gitignore  # opcional gitignored
git commit -am "chore(scripts): mover 11 scripts históricos pra _archive/"
```

### P7.3 Renomear `qa_scroll_up.mjs` → `qa_swipe_down.mjs`

(impl faz swipe down — naming confuso)

### P7.4 Fix hard-coded keys em `appium_login.mjs`

Mover `sb_publishable_*` inline → `process.env.SUPABASE_ANON_KEY` em todos os 3 scripts.

### P7.5 Remover AdMob meta-data se não usa

Verificar AdMob ainda ativo. Se não, remover `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" ... />` do Manifest.

### P7.6 Remover `config.xml` Cordova legacy

`rm android/app/src/main/res/xml/config.xml` (Cordova já não usa, vestígio).

### P7.7 Consolidar `scripts/data/` estrutura

```bash
mkdir -p scripts/automation scripts/data scripts/qa scripts/tests
mv scripts/ingest-*.mjs scripts/backfill-*.mjs scripts/gen-icons.mjs scripts/copy-apk-to-dist.cjs scripts/automation/
# qa/ + tests/ conforme P2.13
```

### P7.8 `CHECKLIST.md` 490KB — fragmentar

Estrutura:
```
context/checklist/
├── README.md (índice)
├── 2026-04-fase0.md
├── 2026-05-v0.2.3.x.md
├── 2026-05-v0.2.4.0-categorias.md
├── 2026-05-v0.2.5.0-ux-refactor.md
└── archived/
    └── pre-2026-05.md
```

### P7.9 Mover `dosy-release.keystore` para fora do repo

`mv dosy-release.keystore ~/.keystores/dosy-release.keystore`
`android/keystore.properties` aponta path absoluto.

### P7.10 Adicionar `.editorconfig`

```ini
root = true
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
[*.gradle]
indent_size = 4
[*.java]
indent_size = 4
[*.md]
trim_trailing_whitespace = false
```

### P7.11 ESLint `--max-warnings` 80 → 0 (gradual em 8 PRs)

Branch `chore/eslint-warnings-cleanup` reduzindo 80 → 70 → 60 → 50 → 40 → 30 → 20 → 10 → 0 em PRs separados, cada um corrigindo categorias de warnings.

### P7.12 Paralelizar jobs CI

`.github/workflows/ci.yml`:
```yaml
jobs:
  lint: { ... }
  test: { ... }
  build: { ... }
  gitleaks: { ... }
# Removidos sequenciais
```

CI time -40%.

### P7.13 Adicionar `@sentry/react` `^` + commit-msg hook commitlint

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional
echo "module.exports = { extends: ['@commitlint/config-conventional'] };" > commitlint.config.js
echo "npx commitlint --edit \$1" > .husky/commit-msg
chmod +x .husky/commit-msg
```

---

## 12. Critérios gerais de aceite (release-gate)

Antes de declarar este roteiro "completo" ou parcial pra release, verificar:

### Release v0.2.6.0 — após P0 + P1.1-P1.7 fechados
- [ ] `supabase db reset` recria estado prod sem erros
- [ ] Sentry events 7 dias sem PII (manual check 5 eventos)
- [ ] User novo passa por consent banner
- [ ] `git log --all -- "*.keystore"` vazio
- [ ] `reconcileDoses` ativo (Sentry breadcrumb)
- [ ] Conflict 409 retorna current_state (validar em emulator dual)
- [ ] Snackbar persistente em onError

### Release v0.3.0.0 — após P2 fechado
- [ ] Refactor_Full Fases 2-5 todas completas
- [ ] Cliente JS não reagenda alarmes (server-side único)
- [ ] `dose-fire-time-notifier` deletado
- [ ] Capacitor LocalNotifications removido
- [ ] 6 componentes Dosy adopted em pelo menos 1 página cada
- [ ] CI tempo <5min

### Release v0.4.0.0 — após P3 fechado
- [ ] Engine ADR-012 funcionando (interactions check em UI)
- [ ] TTL share com access_level granular
- [ ] CMED ingest cron mensal automático
- [ ] LGPD compliance: export_my_data + audit_log + consent gate

### Release v0.5.0.0 — após P4 fechado
- [ ] `<MedicationPicker>` BottomSheet em mobile (3 bugs eliminados)
- [ ] Todos primitives Dosy adopted
- [ ] Theme.css legacy eliminado
- [ ] A11y Persona 6 audit passa

### Release v0.6.0.0 — após P5 fechado
- [ ] pgTAP 100+ tests
- [ ] Deno tests cobrem todas Edge functions
- [ ] Coverage `core/state-machines/**` 100%, `services/**` 60%+
- [ ] 10 cenários E2E top + v1.1 cobertos
- [ ] Sample validation 50 brand-names BR passa

### Release v1.0.0 — após P6 + P7 fechados
- [ ] Todos docs Dosy v2 absorvidos (15+ items)
- [ ] Estrutura `scripts/` consolidada (<15 ativos raiz)
- [ ] ESLint `--max-warnings=0`
- [ ] Marca paridade conceitual com Dosy v2 spec

---

## 13. Cadência sugerida

**Sprint 1 (semana 1-2):** P0 completos (6 items)
**Sprint 2 (semana 3-4):** P1.1-P1.7 + começa P1.8-P1.14
**Sprint 3 (semana 5-6):** P1.14 + P2 Fase 2 alarmes (P2.1-P2.5)
**Sprint 4 (semana 7-8):** P2 Fase 3 + Fase 4 (P2.6-P2.15)
**Sprint 5 (semana 9-10):** P2 Fase 5 (P2.16-P2.18) + P3 tabelas (P3.1-P3.9)
**Sprint 6 (semana 11-13):** P3 RPCs + Edges (P3.10-P3.24)
**Sprint 7 (semana 14-16):** P4 UI primitives core (P4.1-P4.6)
**Sprint 8 (semana 17-18):** P4 UI primitives restantes (P4.7-P4.14)
**Sprint 9 (semana 19-21):** P5 testes (15 items)
**Sprint 10 (semana 22-23):** P6 docs + P7 limpeza
**Buffer (semana 24):** validações device exaustivas + ship v1.0.0

**Total estimado:** 6 meses solo dev. Pode acelerar com pair-programming Claude + user revisão.

---

## 14. Referências cruzadas

**Relatório completo de análise:**
`G:\00_Trabalho\01_Pessoal\Apps\dosy-app\docs\_archive\medcontrol-v2-analysis-2026-05-22.md`

**Docs Dosy v2 mais úteis pra referência:**
- `dosy-app/docs/workflow/RULES.md` — 17 regras (Regra 13 Appium W3C, Regra 15 Caveman OFF, Regra 16 histórico reverso, Regra 17 pendências no doc destino)
- `dosy-app/docs/adr/013-optimistic-ui-sync-resiliente.md` — reconcileDoses + 409 explícito
- `dosy-app/docs/adr/015-catalogo-cmed-hierarquia.md` — design Categorias final
- `dosy-app/docs/16-INTEGRACOES.md` §3.1 — Sentry PII strip exhaustivo
- `dosy-app/docs/07-DESIGN_SYSTEM.md` §3.13 — MedicationPicker BottomSheet
- `dosy-app/docs/18-TESTES.md` §3.8 — top 5 cenários E2E
- `dosy-app/docs/11-DB_SCHEMA.md` §4 — triggers + cron jobs
- `dosy-app/docs/19-SEGURANCA.md` §3 — LGPD compliance

**ADRs medcontrol existentes:**
- `context/decisoes/2026-05-01-001-modelo-1-sessao-1-release-branch.md`
- `context/decisoes/2026-05-01-002-comunicacao-user-nao-dev.md`
- `context/decisoes/2026-05-05-resend-smtp-setup.md`
- `context/decisoes/2026-05-06-001-rejection-google-fix.md`

---

> **Princípio guia:** medcontrol_v2 deve ser referência viva do que Dosy v2 vai consolidar. Não há "Dosy v2 vai fazer isso" — se está nos docs, medcontrol tenta implementar primeiro. Único limite: estabilidade de produção (não regredir bugs já fixados).
> **Status do roteiro:** vivo. Atualizar conforme sprints fecham.
> **Origem:** Análise comparativa 10 agentes paralelos 2026-05-22.
