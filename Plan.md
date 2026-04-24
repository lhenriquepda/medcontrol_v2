# Dosy — Plano de Migração para APK / Play Store

> Documento vivo. Atualizar status dos itens conforme progresso.
> Última atualização: Abril 2026

---

## Visão Geral

O app Dosy é atualmente uma PWA (React + Vite + Tailwind + Supabase) hospedada na Vercel. O objetivo é transformá-lo em um produto Android distribuído pela Google Play Store, com monetização real (assinaturas), notificações nativas e experiência de app nativo.

**Ferramenta de migração:** [Capacitor](https://capacitorjs.com/) — envolve a PWA em uma shell nativa Android sem reescrever o código React.

**Stack resultante:**
```
React 19 (UI) + Vite (build) → dist/
  → Capacitor → Android (WebView nativo)
    → APK/AAB → Google Play Store
```

---

## Fases do Projeto

### Fase 0 — Segurança & LGPD ⚠️ (fazer antes de publicar)
### Fase 1 — Fundação Capacitor
### Fase 2 — Notificações Nativas (FCM)
### Fase 3 — Monetização Real (In-App Purchase)
### Fase 4 — Polimento & Experiência Nativa
### Fase 5 — Preparação Play Store
### Fase 6 — Publicação & Pós-Launch

---

## FASE 0 — Segurança & LGPD

**Objetivo:** App seguro, dados dos usuários protegidos, conformidade com a LGPD (Lei 13.709/2018). Obrigatório antes de qualquer publicação pública. Play Store exige para apps de saúde.

> Apps de saúde manipulam dados sensíveis (categoria especial pela LGPD, Art. 11). Vazamento ou negligência pode gerar multas de até 2% do faturamento (máx R$50M) e dano reputacional irreversível.

---

### 0.1 Auditoria de Secrets & Variáveis de Ambiente

**Problema:** Credenciais podem vazar em commits ou documentação.

**Ações:**
- Criar `.env.example` com todas as variáveis necessárias (sem valores reais):
```bash
# .env.example
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
VITE_VAPID_PUBLIC_KEY=sua_vapid_public_key_aqui
VAPID_PRIVATE_KEY=<NUNCA expor no frontend — só no Edge Function>
```
- Verificar que `.env` e `.env.local` estão no `.gitignore` ✅ (já está)
- Rotacionar VAPID keys se já foram expostas em commits/documentação
- Nunca documentar valores reais em `Contexto.md`, `Plan.md` ou qualquer `.md`
- Adicionar `git-secrets` ou similar ao workflow para prevenir commits acidentais

**Comando para checar histórico git por leaks:**
```bash
git log --all --full-history -- "**/.env*"
git grep -i "private_key\|secret\|password" -- "*.md" "*.json"
```

---

### 0.2 Row Level Security (RLS) — Auditoria Completa

**Problema:** RLS incorreto pode expor dados de um usuário para outro.

**Verificar todas as tabelas no schema `medcontrol`:**
```sql
-- Listar tabelas e se têm RLS ativo
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'medcontrol';

-- Listar policies existentes
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'medcontrol';
```

**Tabelas críticas a verificar:**
- `patients` — usuário vê apenas seus próprios pacientes?
- `treatments` — usuário acessa apenas tratamentos dos seus pacientes?
- `doses` — idem
- `push_subscriptions` — **crítico**: usuário só lê/modifica suas próprias subs?
- `subscriptions` — tier do usuário, não pode ser alterado pelo próprio user
- `sos_rules` / `sos_doses` — idem patients

**Política mínima esperada para cada tabela:**
```sql
-- Exemplo para push_subscriptions (verificar se existe)
CREATE POLICY "Users own their push subs"
  ON medcontrol.push_subscriptions
  FOR ALL
  USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");
```

---

### 0.3 Sistema de Admin Seguro — Controle Total de Tiers

**Contexto:** Como criador do app, você precisa poder:
- Conceder PRO a qualquer usuário (mensal, anual, 2 anos, indeterminado)
- Revogar PRO a qualquer momento
- Ver lista de todos os usuários e seus tiers
- Tudo isso via painel dentro do próprio app

**Problema atual:** O email do admin provavelmente está hardcoded em algum lugar do código ou da RPC. Se alguém inspecionar o JS do app ou o histórico do git, descobre quem é o admin. Pior: se a RPC não verificar server-side, qualquer usuário autenticado pode chamar `admin_grant_tier` diretamente e se promover para PRO.

**Design seguro completo:**

#### Passo 1 — Criar tabela `admins` no banco

```sql
CREATE TABLE medcontrol.admins (
  user_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at  timestamptz DEFAULT now(),
  added_by  uuid REFERENCES auth.users(id)  -- quem adicionou (auditoria)
);

-- Nenhum usuário lê essa tabela diretamente
ALTER TABLE medcontrol.admins ENABLE ROW LEVEL SECURITY;
-- Sem policies de SELECT para usuários comuns — invisível pelo frontend
-- Apenas service_role (Edge Functions internas) pode ler/escrever

-- Inserir seu próprio user_id como admin (fazer UMA vez no Supabase Dashboard)
INSERT INTO medcontrol.admins (user_id) VALUES ('SEU_USER_ID_AQUI');
```

#### Passo 2 — Reescrever `admin_grant_tier` com verificação server-side

```sql
CREATE OR REPLACE FUNCTION medcontrol.admin_grant_tier(
  target_user uuid,
  new_tier    text,       -- 'free' | 'pro' | 'admin'
  expires     timestamptz DEFAULT NULL,   -- NULL = sem expiração
  src         text        DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, public
AS $$
BEGIN
  -- ✅ Verificação server-side: quem chama é admin?
  -- Não confia em NADA do frontend — só no JWT do Supabase
  IF NOT EXISTS (
    SELECT 1 FROM medcontrol.admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: caller is not an admin';
  END IF;

  -- Validar tier
  IF new_tier NOT IN ('free', 'pro', 'admin') THEN
    RAISE EXCEPTION 'INVALID_TIER: %', new_tier;
  END IF;

  -- Executar a mudança
  INSERT INTO medcontrol.subscriptions (user_id, tier, tier_expires, source, updated_at)
  VALUES (target_user, new_tier, expires, src, now())
  ON CONFLICT (user_id) DO UPDATE
    SET tier        = EXCLUDED.tier,
        tier_expires = EXCLUDED.tier_expires,
        source      = EXCLUDED.source,
        updated_at  = now();

  -- Log de auditoria
  INSERT INTO medcontrol.security_events (user_id, event_type, metadata)
  VALUES (
    auth.uid(),
    'admin_tier_change',
    jsonb_build_object(
      'target_user', target_user,
      'new_tier', new_tier,
      'expires', expires,
      'source', src
    )
  );

  RETURN jsonb_build_object('ok', true, 'target', target_user, 'tier', new_tier);
END;
$$;
```

#### Passo 3 — Frontend: nada muda para você

O painel admin continua funcionando exatamente como hoje. A diferença é que se alguém tentar chamar a RPC sem ser admin, o banco rejeita:

```
// Usuário comum tentando se promover:
POST /rest/v1/rpc/admin_grant_tier
Authorization: Bearer <token_usuario_normal>
{ "target_user": "...", "new_tier": "pro" }

→ 400 Bad Request: "UNAUTHORIZED: caller is not an admin"
```

```
// Você (admin) usando o painel:
POST /rest/v1/rpc/admin_grant_tier
Authorization: Bearer <seu_token>
{ "target_user": "...", "new_tier": "pro", "expires": "2027-04-24T00:00:00Z" }

→ 200 OK: { "ok": true, "tier": "pro" }
```

#### Exemplos de uso no painel admin

```javascript
// Dar PRO por 1 mês
await grantTier({ userId: '...', tier: 'pro', expiresAt: addMonths(new Date(), 1) })

// Dar PRO por 1 ano
await grantTier({ userId: '...', tier: 'pro', expiresAt: addYears(new Date(), 1) })

// Dar PRO por 2 anos
await grantTier({ userId: '...', tier: 'pro', expiresAt: addYears(new Date(), 2) })

// PRO vitalício (sem expiração)
await grantTier({ userId: '...', tier: 'pro', expiresAt: null })

// Revogar PRO → volta para free imediatamente
await grantTier({ userId: '...', tier: 'free', expiresAt: null })
```

#### O que muda no código

- **Remover** email hardcoded de qualquer RPC, `.env`, `Contexto.md` ou código JS
- **Não mudar** `subscriptionService.js` — o `grantTier()` já chama a RPC corretamente
- **Não mudar** o painel admin — UI continua igual
- **Adicionar** a tabela `admins` com seu `user_id` inserido manualmente via Supabase Dashboard (nunca via código commitado)

---

### 0.4 Content Security Policy (CSP)

**Problema:** Sem CSP, XSS pode roubar tokens de sessão do localStorage.

**Adicionar em `vercel.json`:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fcm.googleapis.com; frame-src https://googleads.g.doubleclick.net;"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

---

### 0.5 Sanitização de Inputs no PDF

**Problema:** `Reports.jsx` injeta strings do banco diretamente em HTML via `innerHTML` para gerar PDF. Se um nome de medicamento ou paciente contiver HTML/JS, há risco de XSS.

**Adicionar função de sanitização:**
```javascript
// src/utils/sanitize.js
export function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
```

**Usar em todos os template strings do PDF:**
```javascript
// Reports.jsx — em TODOS os lugares onde dados do banco vão pro HTML
`<td>${escapeHtml(d.medName)}</td>`
`<td>${escapeHtml(patient.name)}</td>`
`<td>${escapeHtml(d.unit)}</td>`
```

---

### 0.6 Segurança da Autenticação

**Problema:** Supabase gerencia senhas com bcrypt (seguro), mas o app não impõe requisitos de força de senha no cadastro.

**Adicionar validação no formulário de cadastro:**
```javascript
// src/pages/Login.jsx ou Register.jsx
function validatePassword(pwd) {
  const errors = []
  if (pwd.length < 8) errors.push('Mínimo 8 caracteres')
  if (!/[A-Z]/.test(pwd)) errors.push('Pelo menos uma letra maiúscula')
  if (!/[0-9]/.test(pwd)) errors.push('Pelo menos um número')
  return errors
}
```

**Limpar sessão completamente no logout:**
```javascript
// src/hooks/useAuth.js — no signOut
async function signOut() {
  await supabase.auth.signOut()
  // Limpar dados locais sensíveis
  localStorage.removeItem('medcontrol_notif')
  localStorage.removeItem('dashCollapsed')
  // Se futuramente usar Capacitor Preferences:
  // await Preferences.clear()
}
```

---

### 0.7 Proteção dos Dados Locais (Modo Demo)

**Problema:** Modo demo armazena dados de saúde (pacientes, doses, medicamentos) em `localStorage` sem criptografia. `localStorage` é acessível por qualquer script da mesma origem.

**Mitigações:**
1. Exibir aviso claro ao usuário: dados demo não são persistidos de forma segura
2. Limpar dados demo automaticamente ao fechar a aba (usar `sessionStorage` em vez de `localStorage` para modo demo)
3. Para versão APK: não usar `localStorage` — usar Capacitor Preferences (que usa SharedPreferences no Android, que tem proteção sandboxed por app)

```javascript
// src/services/demoStorage.js
// Trocar localStorage por sessionStorage no modo demo
const storage = isDemoMode ? sessionStorage : localStorage
```

---

### 0.8 LGPD — Direito de Acesso e Portabilidade (Art. 18)

**Usuário tem direito de:**
- Saber quais dados estão armazenados
- Exportar seus dados (portabilidade)
- Corrigir dados incorretos
- Revogar consentimento

**Implementar em `src/pages/Settings.jsx`:**

```javascript
// Exportar todos os dados do usuário
async function exportUserData() {
  const { data: { user } } = await supabase.auth.getUser()
  const [patients, treatments, doses, subs] = await Promise.all([
    supabase.schema('medcontrol').from('patients').select('*').eq('userId', user.id),
    supabase.schema('medcontrol').from('treatments').select('*'),  // via join
    supabase.schema('medcontrol').from('doses').select('*'),
    supabase.schema('medcontrol').from('subscriptions').select('tier, tier_expires').eq('user_id', user.id)
  ])
  const dump = {
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email, createdAt: user.created_at },
    patients: patients.data,
    treatments: treatments.data,
    doses: doses.data,
    subscription: subs.data?.[0]
  }
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dosy-meus-dados-${Date.now()}.json`
  a.click()
}
```

---

### 0.9 LGPD — Direito ao Esquecimento (Art. 18, VI)

**Usuário tem direito de excluir TODOS os seus dados.**

**Criar RPC no Supabase:**
```sql
CREATE OR REPLACE FUNCTION medcontrol.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_patient_ids uuid[];
BEGIN
  -- Coletar IDs dos pacientes do usuário
  SELECT ARRAY(SELECT id FROM medcontrol.patients WHERE "userId" = v_user_id)
  INTO v_patient_ids;

  -- Deletar em cascata
  DELETE FROM medcontrol.push_subscriptions WHERE "userId" = v_user_id;
  DELETE FROM medcontrol.doses WHERE "patientId" = ANY(v_patient_ids);
  DELETE FROM medcontrol.sos_doses WHERE "patientId" = ANY(v_patient_ids);
  DELETE FROM medcontrol.sos_rules WHERE "patientId" = ANY(v_patient_ids);
  DELETE FROM medcontrol.treatments WHERE "patientId" = ANY(v_patient_ids);
  DELETE FROM medcontrol.patients WHERE "userId" = v_user_id;
  DELETE FROM medcontrol.subscriptions WHERE user_id = v_user_id;

  -- Deletar a conta no auth (via admin API — chamar via Edge Function)
  -- A deleção do auth.users deve ser feita pela Edge Function com service_role key
END;
$$;
```

**Edge Function `delete-account`:**
```typescript
// supabase/functions/delete-account/index.ts
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service_role — nunca expor no frontend
)

Deno.serve(async (req) => {
  // Verificar JWT do usuário logado
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: { user }, error } = await adminClient.auth.getUser(jwt)
  if (error || !user) return new Response('Unauthorized', { status: 401 })

  // Deletar dados do schema
  await adminClient.rpc('delete_my_account')

  // Deletar conta do auth
  await adminClient.auth.admin.deleteUser(user.id)

  return new Response(JSON.stringify({ ok: true }))
})
```

**Botão em Settings:**
```jsx
<button onClick={handleDeleteAccount} className="btn-danger w-full">
  🗑️ Excluir minha conta e todos os dados
</button>
```

---

### 0.10 LGPD — Consentimento Explícito no Cadastro (Art. 7, I)

**Problema:** Cadastro atual não coleta consentimento explícito para tratamento de dados de saúde.

**Adicionar checkbox no formulário de cadastro:**
```jsx
<label className="flex items-start gap-2 text-sm">
  <input
    type="checkbox"
    required
    checked={consent}
    onChange={(e) => setConsent(e.target.checked)}
    className="mt-0.5"
  />
  <span>
    Li e aceito a{' '}
    <a href="/privacidade" className="text-brand-600 underline">Política de Privacidade</a>
    {' '}e consinto com o tratamento dos meus dados de saúde conforme a LGPD.
  </span>
</label>
```

Registrar o consentimento com timestamp no Supabase:
```sql
ALTER TABLE medcontrol.subscriptions
  ADD COLUMN consent_at timestamptz,
  ADD COLUMN consent_version text DEFAULT '1.0';
```

---

### 0.11 LGPD — Retenção de Dados (Art. 15)

**Política:** Dados devem ser retidos apenas enquanto necessário para a finalidade.

**Implementar:**
1. Usuários inativos há +2 anos → enviar email de aviso antes de deletar
2. Doses com status `done`/`skipped` mais antigas que 3 anos → podem ser anonimizadas
3. Logs de auditoria → reter por 1 ano (requisito legal)

**Criar Scheduled Job no Supabase (pg_cron):**
```sql
-- Anonimizar doses muito antigas (preserva histórico sem PII linkável)
SELECT cron.schedule(
  'anonymize-old-doses',
  '0 3 * * 0',  -- toda domingo 3h
  $$
    UPDATE medcontrol.doses
    SET observation = '[anonimizado]'
    WHERE "scheduledAt" < NOW() - INTERVAL '3 years'
      AND observation IS NOT NULL
      AND observation != '[anonimizado]'
  $$
);
```

---

### 0.12 Rate Limiting & Proteção Anti-Abuse

**Problema:** Edge Functions sem rate limiting podem ser abusadas.

**Supabase já oferece rate limiting básico no auth** (configurável no Dashboard).

**Para Edge Functions, adicionar via upstash/redis ou lógica simples:**
```typescript
// Verificar frequência de chamadas na função notify-doses
// Máximo: 1 chamada por usuário por minuto
const rateLimitKey = `rate:${user.id}:notify`
// Usar KV store do Deno Deploy ou tabela no Supabase
```

**No Supabase Auth (Dashboard → Authentication → Settings):**
- Habilitar proteção contra bots
- Configurar rate limit de signup (evitar abuso)
- Ativar email confirmation obrigatório

---

### 0.13 Logging de Eventos de Segurança

**Para auditoria LGPD e detecção de anomalias:**

```sql
CREATE TABLE medcontrol.security_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  event_type  text NOT NULL,  -- 'login', 'logout', 'data_export', 'account_delete', 'subscription_change'
  ip_address  text,
  user_agent  text,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

-- RLS: usuário só vê seus próprios eventos
ALTER TABLE medcontrol.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own events"
  ON medcontrol.security_events FOR SELECT
  USING (auth.uid() = user_id);
-- INSERT apenas via service_role (Edge Functions)
```

---

### 0.14 Mover Lógica de Negócio Sensível para o Servidor

> **Contexto:** Atualmente várias regras de negócio críticas são validadas apenas no cliente (JavaScript). Um atacante que envie requisições diretamente para a API do Supabase (via `curl`, Postman, ou script) **bypassa completamente** essas validações. O banco aceita qualquer INSERT/UPDATE que passe no RLS — sem saber que a regra de negócio foi violada.

---

#### 0.14.1 — CRÍTICO: Validação SOS não existe no servidor

**Problema:** `validateSos()` em `dosesService.js` verifica intervalo mínimo e máximo de doses SOS **só no frontend**. A inserção em seguida é um `INSERT` direto na tabela `doses`. Qualquer requisição direta à API ignora a validação.

```
// Atacante pode fazer isso diretamente:
POST /rest/v1/doses
{ type: 'sos', medName: 'Morfina', patientId: '...', status: 'done', ... }
// → Inserido sem checar minIntervalHours nem maxDosesIn24h
```

**Solução:** Criar RPC `register_sos_dose` que valida as regras antes de inserir:

```sql
CREATE OR REPLACE FUNCTION medcontrol.register_sos_dose(
  p_patient_id  uuid,
  p_med_name    text,
  p_unit        text,
  p_scheduled_at timestamptz,
  p_observation text DEFAULT ''
)
RETURNS medcontrol.doses
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule        medcontrol.sos_rules%ROWTYPE;
  v_last_dose   timestamptz;
  v_count_24h   int;
  v_diff_hours  float;
  v_new_dose    medcontrol.doses%ROWTYPE;
BEGIN
  -- 1. Verificar que o paciente pertence ao usuário logado
  IF NOT EXISTS (
    SELECT 1 FROM medcontrol.patients
    WHERE id = p_patient_id AND "userId" = auth.uid()
  ) THEN
    RAISE EXCEPTION 'PACIENTE_NAO_AUTORIZADO';
  END IF;

  -- 2. Buscar regra de segurança para o medicamento
  SELECT * INTO v_rule
  FROM medcontrol.sos_rules
  WHERE "patientId" = p_patient_id
    AND lower(med_name) = lower(p_med_name)
  LIMIT 1;

  IF FOUND THEN
    -- 3. Verificar intervalo mínimo
    IF v_rule.min_interval_hours IS NOT NULL THEN
      SELECT MAX(actual_time) INTO v_last_dose
      FROM medcontrol.doses
      WHERE "patientId" = p_patient_id
        AND lower(med_name) = lower(p_med_name)
        AND status = 'done';

      IF v_last_dose IS NOT NULL THEN
        v_diff_hours := EXTRACT(EPOCH FROM (p_scheduled_at - v_last_dose)) / 3600;
        IF v_diff_hours < v_rule.min_interval_hours THEN
          RAISE EXCEPTION 'INTERVALO_MINIMO_NAO_RESPEITADO: %h', v_rule.min_interval_hours;
        END IF;
      END IF;
    END IF;

    -- 4. Verificar máximo de doses em 24h
    IF v_rule.max_doses_in_24h IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count_24h
      FROM medcontrol.doses
      WHERE "patientId" = p_patient_id
        AND lower(med_name) = lower(p_med_name)
        AND status = 'done'
        AND actual_time >= (p_scheduled_at - INTERVAL '24 hours');

      IF v_count_24h >= v_rule.max_doses_in_24h THEN
        RAISE EXCEPTION 'LIMITE_24H_ATINGIDO: %', v_rule.max_doses_in_24h;
      END IF;
    END IF;
  END IF;

  -- 5. Inserir dose SOS
  INSERT INTO medcontrol.doses
    ("patientId", med_name, unit, scheduled_at, actual_time, status, type, observation, "treatmentId")
  VALUES
    (p_patient_id, p_med_name, p_unit, p_scheduled_at, p_scheduled_at, 'done', 'sos', p_observation, NULL)
  RETURNING * INTO v_new_dose;

  RETURN v_new_dose;
END;
$$;
```

**Frontend:** Substituir `supabase.from('doses').insert(...)` por `supabase.rpc('register_sos_dose', {...})` em `dosesService.js`.

---

#### 0.14.2 — CRÍTICO: `admin_grant_tier` acessível por qualquer usuário autenticado

**Problema:** `grantTier()` em `subscriptionService.js` chama `supabase.rpc('admin_grant_tier', ...)` diretamente do frontend. Se a RPC não verificar server-side que o chamador é admin, qualquer usuário pode executar:

```
POST /rest/v1/rpc/admin_grant_tier
Authorization: Bearer <token_de_qualquer_usuario>
{ "target_user": "meu_proprio_id", "new_tier": "pro" }
// → Upgrade gratuito para PRO
```

**Solução:** A RPC deve verificar o papel antes de executar (ver seção 0.3). Garantir que a verificação existe e está funcionando. Testar com usuário não-admin via Postman/curl.

---

#### 0.14.3 — ALTO: Geração e inserção de doses é client-side e não-atômica

**Problema:** `createTreatmentWithDoses()` em `treatmentsService.js`:
1. Insere o treatment no DB
2. Chama `generateDoses()` no cliente (JavaScript puro)
3. Insere as doses em bulk

Problemas:
- **Não é atômico:** se o browser fechar entre os passos 1 e 3, o tratamento fica sem doses
- **Sem limite:** atacante pode enviar `durationDays: 9999` gerando 100k+ doses de uma vez (DoS do banco)
- A mesma operação de regenerar doses em `updateTreatment` tem os mesmos problemas

**Solução:** Criar RPC `create_treatment_with_doses(payload jsonb)` que executa tudo em uma transação e valida limites:

```sql
CREATE OR REPLACE FUNCTION medcontrol.create_treatment_with_doses(payload jsonb)
RETURNS medcontrol.treatments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_treatment  medcontrol.treatments%ROWTYPE;
  v_duration   int;
  v_max_doses  int := 1000; -- limite de segurança
BEGIN
  -- Validar que patientId pertence ao usuário
  IF NOT EXISTS (
    SELECT 1 FROM medcontrol.patients
    WHERE id = (payload->>'patientId')::uuid
      AND "userId" = auth.uid()
  ) THEN
    RAISE EXCEPTION 'PACIENTE_NAO_AUTORIZADO';
  END IF;

  -- Limitar duração máxima (evitar DoS)
  v_duration := LEAST(COALESCE((payload->>'durationDays')::int, 90), 365);

  -- Inserir treatment
  INSERT INTO medcontrol.treatments (...) VALUES (...) RETURNING * INTO v_treatment;

  -- Gerar doses via função SQL (lógica de generateDoses migrada para plpgsql)
  -- Verificar que total de doses não excede v_max_doses
  -- Inserir doses em bloco

  RETURN v_treatment;
END;
$$;
```

---

#### 0.14.4 — ALTO: DELETE de doses e tratamentos não é atômico

**Problema:** `deleteTreatment()` faz dois DELETEs separados do cliente:
```js
await supabase.from('doses').delete().eq('treatmentId', id)
await supabase.from('treatments').delete().eq('id', id)
```
Se o primeiro DELETE passar e o segundo falhar, ficam doses órfãs. Se o atacante abortar a requisição entre as duas chamadas, o estado fica inconsistente.

**Solução:** Adicionar `ON DELETE CASCADE` na FK de `doses.treatmentId → treatments.id` no banco, ou criar RPC `delete_treatment(p_id uuid)` que faz tudo em uma transação.

```sql
-- Opção 1: FK cascade (mais simples, preferida)
ALTER TABLE medcontrol.doses
  DROP CONSTRAINT IF EXISTS doses_treatment_id_fkey,
  ADD CONSTRAINT doses_treatment_id_fkey
    FOREIGN KEY ("treatmentId") REFERENCES medcontrol.treatments(id)
    ON DELETE CASCADE;

-- Com isso, deletar o treatment já deleta as doses automaticamente.
```

---

#### 0.14.5 — MÉDIO: Transições de status de dose sem máquina de estados no servidor

**Problema:** `confirmDose`, `skipDose` e `undoDose` fazem UPDATE direto na tabela:
```js
await supabase.from('doses').update({ status: 'done' }).eq('id', id)
```
Sem verificação server-side:
- Atacante pode confirmar uma dose que não é dele (depende do RLS)
- Pode confirmar uma dose já `done` ou `skipped` (status inválido)
- Pode fazer `undoDose` em dose de 6 meses atrás (sem limite de tempo)

**Solução:** Criar RPCs com validação de transição:

```sql
CREATE OR REPLACE FUNCTION medcontrol.confirm_dose(
  p_dose_id uuid,
  p_actual_time timestamptz DEFAULT now(),
  p_observation text DEFAULT ''
)
RETURNS medcontrol.doses
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_dose medcontrol.doses%ROWTYPE;
BEGIN
  SELECT * INTO v_dose FROM medcontrol.doses WHERE id = p_dose_id;

  -- Verificar ownership via patient
  IF NOT EXISTS (
    SELECT 1 FROM medcontrol.patients p
    JOIN medcontrol.doses d ON d."patientId" = p.id
    WHERE d.id = p_dose_id AND (p."userId" = auth.uid() OR EXISTS (
      SELECT 1 FROM medcontrol.patient_shares
      WHERE patient_id = p.id AND shared_with = auth.uid()
    ))
  ) THEN
    RAISE EXCEPTION 'SEM_ACESSO';
  END IF;

  -- Transição válida: somente pending/overdue → done
  IF v_dose.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'TRANSICAO_INVALIDA: % -> done', v_dose.status;
  END IF;

  UPDATE medcontrol.doses
  SET status = 'done', actual_time = p_actual_time, observation = p_observation
  WHERE id = p_dose_id
  RETURNING * INTO v_dose;

  RETURN v_dose;
END;
$$;
```

---

#### 0.14.6 — MÉDIO: `patientId` nos INSERTs vem do cliente sem verificação explícita

**Problema:** Em `registerSos`, `createTreatmentWithDoses` e outros, o `patientId` é enviado pelo cliente. Se o RLS da tabela `doses`/`treatments` não verificar que o paciente pertence ao usuário logado, um atacante pode inserir dados em pacientes de outros usuários.

**Verificação necessária:** Confirmar que as políticas RLS nas tabelas `doses` e `treatments` incluem:
```sql
-- Para INSERT em doses:
WITH CHECK (
  EXISTS (
    SELECT 1 FROM medcontrol.patients p
    WHERE p.id = "patientId"
      AND (p."userId" = auth.uid() OR EXISTS (
        SELECT 1 FROM medcontrol.patient_shares
        WHERE patient_id = p.id AND shared_with = auth.uid()
      ))
  )
)
```

---

#### 0.14.7 — BAIXO: `select('*')` expõe todas as colunas

**Problema:** Todos os services usam `.select('*')`. Se uma coluna sensível for adicionada ao schema no futuro (ex: `internal_flag`, `admin_notes`), ela virá automaticamente para o cliente.

**Solução:** Usar colunas explícitas ou criar views com apenas os campos necessários:
```js
// Antes:
supabase.from('doses').select('*')

// Depois:
supabase.from('doses').select('id, patientId, medName, unit, scheduledAt, actualTime, status, type, observation, treatmentId')
```

---

#### Resumo das Prioridades

| # | Problema | Severidade | Bypass possível? |
|---|---|---|---|
| 0.14.1 | Validação SOS só no frontend | 🔴 CRÍTICO | Sim — POST direto à API |
| 0.14.2 | `admin_grant_tier` sem auth server-side | 🔴 CRÍTICO | Sim — RPC direta |
| 0.14.3 | Geração de doses não-atômica + sem limite | 🟠 ALTO | Sim — DoS + inconsistência |
| 0.14.4 | DELETE de tratamento não-atômico | 🟠 ALTO | Sim — dados órfãos |
| 0.14.5 | Transições de status sem validação | 🟡 MÉDIO | Parcial (depende do RLS) |
| 0.14.6 | `patientId` sem verificação de ownership | 🟡 MÉDIO | Depende do RLS |
| 0.14.7 | `select('*')` em todos os services | 🟢 BAIXO | Não (mas risco futuro) |

---

## FASE 1 — Fundação Capacitor

**Objetivo:** App abre no Android sem erros. Navegação funciona. Auth funciona.

### 1.1 Instalar Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npm install @capacitor/app @capacitor/status-bar @capacitor/keyboard @capacitor/splash-screen
npx cap init "Dosy" "com.dosyapp.dosy" --web-dir dist
npx cap add android
```

### 1.2 `capacitor.config.ts`

Criar na raiz do projeto:

```typescript
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dosyapp.dosy',
  appName: 'Dosy',
  webDir: 'dist',
  server: {
    androidScheme: 'https'   // necessário para Supabase auth funcionar em WebView
  },
  plugins: {
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0d1535',   // dark navy — mesmo do AppHeader
      overlaysWebView: false
    },
    Keyboard: {
      resizeOnFullScreen: true      // evita layout quebrado com teclado aberto
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0d1535',
      androidSplashResourceName: 'splash',
      showSpinner: false
    }
  }
}
export default config
```

### 1.3 Atualizar `package.json` scripts

```json
"scripts": {
  "build:android": "npm run build && npx cap sync android",
  "open:android": "npx cap open android",
  "cap:sync": "npx cap sync"
}
```

### 1.4 Corrigir autenticação no WebView Android

O Supabase usa `localStorage` para persistir sessão. No Android nativo, `localStorage` é instável (pode ser limpo pelo sistema). Migrar para **Capacitor Preferences** (antigo Storage):

```bash
npm install @capacitor/preferences
```

Modificar `src/services/supabase.js`:

```javascript
import { Preferences } from '@capacitor/preferences'

const CapacitorStorage = {
  getItem: async (key) => {
    const { value } = await Preferences.get({ key })
    return value
  },
  setItem: async (key, value) => {
    await Preferences.set({ key, value })
  },
  removeItem: async (key) => {
    await Preferences.remove({ key })
  }
}

export const supabase = createClient(URL, KEY, {
  auth: {
    storage: CapacitorStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false   // OBRIGATÓRIO no Android — sem URL redirect
  },
  db: { schema: 'medcontrol' }
})
```

### 1.5 Tratar botão Voltar do Android

Sem tratamento, o botão voltar fecha o app inesperadamente. Adicionar em `src/App.jsx`:

```javascript
import { App as CapacitorApp } from '@capacitor/app'

useEffect(() => {
  const handler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
    } else {
      CapacitorApp.exitApp()
    }
  })
  return () => handler.remove()
}, [])
```

### 1.6 Reconexão do Realtime ao sair/voltar

O Supabase Realtime desconecta quando Android coloca app em segundo plano. Adicionar em `src/hooks/useRealtime.js`:

```javascript
import { App as CapacitorApp } from '@capacitor/app'

useEffect(() => {
  const pause = CapacitorApp.addListener('pause', () => {
    supabase.removeAllChannels()
  })
  const resume = CapacitorApp.addListener('resume', () => {
    // Resubscreve e invalida queries para dados frescos
    setupRealtimeChannel()
    qc.invalidateQueries()
  })
  return () => { pause.remove(); resume.remove() }
}, [])
```

### 1.7 Build e sync

```bash
npm run build
npx cap sync android
npx cap open android   # abre Android Studio
```

Testar no emulador (API 26+) e em dispositivo físico antes de avançar.

---

## FASE 2 — Notificações Nativas (FCM)

**Objetivo:** Substituir Web Push API + VAPID por Firebase Cloud Messaging (FCM). As atuais notificações Web Push não funcionam de forma confiável em WebViews Android.

### 2.1 Por que trocar Web Push por FCM?

| | Web Push (atual) | FCM (necessário) |
|---|---|---|
| Funciona em PWA web | ✅ | ✅ |
| Funciona em Android nativo (Capacitor) | ❌ Não confiável | ✅ |
| Service Worker necessário | ✅ | Não |
| Delivery garantido | Parcial | ✅ |
| Suporte a snooze/ações nativas | Limitado | ✅ |

### 2.2 Setup Firebase

1. Criar projeto no [Firebase Console](https://console.firebase.google.com/)
2. Adicionar app Android com package `com.dosyapp.dosy`
3. Baixar `google-services.json` → colocar em `android/app/`
4. No Firebase Console → Cloud Messaging → copiar Server Key e Sender ID

### 2.3 Instalar pacotes Capacitor

```bash
npm install @capacitor/push-notifications @capacitor/local-notifications
```

Adicionar ao `capacitor.config.ts`:

```typescript
plugins: {
  PushNotifications: {
    presentationOptions: ['badge', 'sound', 'alert']
  },
  LocalNotifications: {
    smallIcon: 'ic_stat_dosy',
    iconColor: '#2B3EDF',    // brand color Dosy
    sound: 'default'
  }
}
```

### 2.4 Reescrever `src/hooks/usePushNotifications.js`

A hook atual usa a Web Push API. Criar lógica condicional: FCM no nativo, Web Push na web.

```javascript
import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

export function usePushNotifications() {
  // Subscribe
  const subscribe = useCallback(async (advanceMins = 15) => {
    if (isNative) {
      // FCM path
      await PushNotifications.requestPermissions()
      await PushNotifications.register()
      // token chegará via listener 'registration' → salvar no Supabase
    } else {
      // Web Push path (existente)
      // ... código atual mantido para web/PWA
    }
  }, [])

  // Listener: token FCM pronto
  useEffect(() => {
    if (!isNative) return
    PushNotifications.addListener('registration', async ({ value: deviceToken }) => {
      if (!hasSupabase) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.schema('medcontrol').from('push_subscriptions').upsert({
        userId: user.id,
        deviceToken,
        platform: 'android',
        advanceMins,
        userAgent: navigator.userAgent.slice(0, 250)
      }, { onConflict: 'deviceToken' })
    })
    return () => PushNotifications.removeAllListeners()
  }, [])

  // Scheduling local (próximas 24h)
  const scheduleDoses = useCallback(async (doses, advanceMins) => {
    if (isNative) {
      const pending = await LocalNotifications.getPending()
      const pendingIds = pending.notifications.map(n => n.id)
      const upcoming = doses
        .filter(d => d.status === 'pending')
        .filter(d => new Date(d.scheduledAt) > new Date())
      await LocalNotifications.schedule({
        notifications: upcoming.map(d => ({
          id: parseInt(d.id.replace(/-/g,'').slice(0,8), 16),
          title: `💊 ${d.medName}`,
          body: `Hora de tomar ${d.unit}`,
          schedule: { at: new Date(new Date(d.scheduledAt) - (advanceMins ?? 15) * 60000) },
          extra: { doseId: d.id }
        }))
      })
    } else {
      // Web Push path (existente — via SW SCHEDULE_DOSES)
    }
  }, [])
}
```

### 2.5 Migration banco de dados — `push_subscriptions`

Tabela atual tem `endpoint` e `keys` (formato Web Push). Adicionar colunas para FCM:

```sql
ALTER TABLE medcontrol.push_subscriptions
  ADD COLUMN "deviceToken" text,
  ADD COLUMN platform text DEFAULT 'web';

-- Novo índice para FCM tokens
CREATE UNIQUE INDEX push_subscriptions_device_token_idx
  ON medcontrol.push_subscriptions("deviceToken")
  WHERE "deviceToken" IS NOT NULL;
```

### 2.6 Reescrever Edge Function `notify-doses`

Atual usa `npm:web-push` (VAPID). Reescrever para Firebase Admin SDK:

```typescript
// supabase/functions/notify-doses/index.ts
import { initializeApp, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

// Secrets necessários: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
initializeApp({ credential: cert({ ... }) })

// Para subs web (endpoint+keys), continuar usando web-push
// Para subs android (deviceToken), usar Firebase Admin
const androidSubs = subs.filter(s => s.platform === 'android')
const webSubs = subs.filter(s => s.platform === 'web')

// FCM multicast
await getMessaging().sendEachForMulticast({
  tokens: androidSubs.map(s => s.deviceToken),
  notification: { title: `💊 ${dose.medName}`, body: `Dose: ${dose.unit}` },
  data: { doseId: dose.id }
})
```

**Novos secrets Supabase:**
```
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

---

## FASE 3 — Monetização Real (In-App Purchase)

**Objetivo:** Usuário pode assinar o plano PRO pela Play Store. Receita real.

### 3.1 Obrigatoriedade

Google Play **exige** Google Play Billing para compras de conteúdo digital dentro do app. Não é opcional. Usar RevenueCat como camada de abstração (suporta Play Store + App Store + Web).

### 3.2 Setup RevenueCat

1. Criar conta em [app.revenuecat.com](https://app.revenuecat.com)
2. Criar projeto "Dosy"
3. Conectar Google Play Console via chave de serviço
4. Criar produtos no Google Play Console:
   - `dosy_pro_monthly` — R$7,90/mês
   - `dosy_pro_yearly` — R$49,90/ano

```bash
npm install @revenuecat/purchases-capacitor
```

### 3.3 Criar `src/hooks/useInAppPurchase.js`

```javascript
import Purchases, { LOG_LEVEL } from '@revenuecat/purchases-capacitor'
import { Capacitor } from '@capacitor/core'

const RC_API_KEY_ANDROID = 'goog_...'   // do painel RevenueCat

export function useInAppPurchase() {
  const { user } = useAuth()
  const toast = useToast()

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return
    Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
    Purchases.configure({ apiKey: RC_API_KEY_ANDROID, appUserID: user.id })
  }, [user])

  const getOfferings = useCallback(async () => {
    const { offerings } = await Purchases.getOfferings()
    return offerings.current
  }, [])

  const purchasePro = useCallback(async (packageType = 'MONTHLY') => {
    try {
      const offering = await getOfferings()
      const pkg = offering?.availablePackages.find(p => p.packageType === packageType)
      if (!pkg) throw new Error('Produto não encontrado')

      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })

      if (customerInfo.entitlements.active['pro']) {
        // Sincronizar com Supabase
        await supabase.rpc('admin_grant_tier', {
          target_user: user.id,
          new_tier: 'pro',
          expires: new Date(customerInfo.entitlements.active['pro'].expirationDate),
          src: 'play_store'
        })
        toast.show({ message: '🎉 Plano PRO ativado!', kind: 'success' })
      }
    } catch (err) {
      if (err.code !== 'PURCHASE_CANCELLED') {
        toast.show({ message: err.message || 'Falha na compra.', kind: 'error' })
      }
    }
  }, [user])

  const restorePurchases = useCallback(async () => {
    const { customerInfo } = await Purchases.restorePurchases()
    if (customerInfo.entitlements.active['pro']) {
      // Sincronizar tier no Supabase
    }
  }, [])

  return { purchasePro, restorePurchases, getOfferings }
}
```

### 3.4 Atualizar `PaywallModal.jsx`

Substituir botão disabled pelo fluxo real:

```jsx
const { purchasePro } = useInAppPurchase()
const { isNative } = useCapacitorPlatform()

// Mensal
<button onClick={() => purchasePro('MONTHLY')} className="btn-primary w-full">
  Assinar PRO — R$7,90/mês
</button>

// Anual
<button onClick={() => purchasePro('ANNUAL')} className="btn-secondary w-full">
  Assinar Anual — R$49,90/ano (−48%)
</button>

// Restaurar compras (obrigatório pela Play Store)
<button onClick={restorePurchases} className="text-xs text-brand-600 underline mt-2">
  Restaurar compras
</button>
```

### 3.5 Webhook RevenueCat → Supabase (opcional mas recomendado)

Configurar webhook no RevenueCat para notificar Supabase em renovações/cancelamentos automáticos:
- RevenueCat → Event Delivery → Webhook → URL da Edge Function
- Edge Function atualiza `subscriptions` table automaticamente

---

## FASE 4 — Polimento & Experiência Nativa

**Objetivo:** App parece nativo, não uma webpage dentro de um frame.

### 4.1 Exportação PDF — trocar `window.print()`

`window.print()` é instável no Android. Substituir por geração client-side:

```bash
npm install jspdf html2canvas
```

```javascript
// src/pages/Reports.jsx
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Filesystem, Directory } from '@capacitor/filesystem'

async function exportPDF() {
  const reportEl = document.getElementById('report-content')
  const canvas = await html2canvas(reportEl, { scale: 2, useCORS: true })
  const pdf = new jsPDF('p', 'mm', 'a4')
  const imgData = canvas.toDataURL('image/png')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = (canvas.height * pageWidth) / canvas.width
  pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight)

  if (Capacitor.isNativePlatform()) {
    // Salvar no dispositivo Android
    const base64 = pdf.output('datauristring').split(',')[1]
    await Filesystem.writeFile({
      path: `relatorio-dosy-${Date.now()}.pdf`,
      data: base64,
      directory: Directory.Documents
    })
    toast.show({ message: 'PDF salvo em Documentos.', kind: 'success' })
  } else {
    // Web: download normal
    pdf.save(`relatorio-dosy.pdf`)
  }
}
```

### 4.2 Exportação CSV no Android

```bash
npm install @capacitor/filesystem
```

```javascript
// src/pages/Reports.jsx
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

async function exportCSV() {
  // ... gerar csv string como hoje ...
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: `dosy_${Date.now()}.csv`,
      data: btoa(unescape(encodeURIComponent(csv))),
      directory: Directory.Cache
    })
    await Share.share({ title: 'Relatório Dosy', url: uri })
  } else {
    downloadBlob(blob, `dosy_${Date.now()}.csv`)
  }
}
```

### 4.3 AdMob (substituir AdSense)

AdSense não funciona em WebView. Para monetização por anúncio no app nativo:

```bash
npm install @capacitor-community/admob
```

```javascript
// src/components/AdBanner.jsx
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob'

// Android Banner ID: ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
// Substituir AdSense no plano free por banner AdMob nativo
```

> **Nota:** AdSense pode continuar sendo usado na versão web (PWA). No APK, usar AdMob. Detectar plataforma e renderizar o componente correto.

### 4.4 Splash Screen & Ícones Adaptativos

**Instalar:**
```bash
npm install @capacitor/splash-screen @capacitor/assets
```

**Assets necessários (criar):**
- `resources/icon.png` — 1024×1024, Dosy logo, fundo transparente
- `resources/icon-foreground.png` — 108×108, apenas o logo pill (para adaptive icon Android 8+)
- `resources/splash.png` — 2732×2732, logo centralizado em fundo `#0d1535`

**Gerar automaticamente:**
```bash
npx @capacitor/assets generate --android
```

Isso gera todos os tamanhos necessários em `android/app/src/main/res/`.

### 4.5 Status Bar e Safe Area

Header do Dosy já usa `safe-top`. Verificar em dispositivos com notch/câmera punch-hole:

```javascript
// src/main.jsx ou App.jsx
import { StatusBar, Style } from '@capacitor/status-bar'

if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark })
  StatusBar.setBackgroundColor({ color: '#0d1535' })
}
```

### 4.6 Deep Links (para OAuth futuro)

Configurar em `android/app/src/main/AndroidManifest.xml`:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="dosy-teal.vercel.app" />
</intent-filter>
```

---

## FASE 5 — Preparação Play Store

**Objetivo:** Cumprir todos os requisitos do Google para publicação.

### 5.1 Google Play Console

1. Criar conta de desenvolvedor: [play.google.com/console](https://play.google.com/console) — taxa única de USD 25
2. Criar app → "Dosy" → "Aplicativo" → "Português (Brasil)"
3. Configurar perfil de app

### 5.2 Política de Privacidade (obrigatória)

Apps de saúde são **categoria sensível** no Play Store — política de privacidade é obrigatória.

Criar página de política de privacidade (pode ser no próprio site/Vercel):
```
https://dosy-teal.vercel.app/privacidade
```

Incluir:
- Dados coletados (email, nome, medicamentos, doses)
- Finalidade (gestão de saúde pessoal)
- Compartilhamento (Supabase, Firebase, RevenueCat)
- Direitos do usuário (exclusão de conta/dados)
- Contato do responsável

### 5.3 Termos de Uso

```
https://dosy-teal.vercel.app/termos
```

Adicionar rota `/privacidade` e `/termos` no `App.jsx` (páginas HTML simples).

### 5.4 Questionário de classificação IARC

Play Store exige classificação etária. Para app de saúde:
- Sem violência, sem conteúdo adulto → classificação **Livre (L)**
- Preencher no console: Conteúdo do app → Classificação de conteúdo

### 5.5 Declaração de saúde

Apps de saúde podem precisar de declaração adicional no Google Play. Confirmar se Dosy se enquadra em "aplicativo médico" ou apenas "bem-estar".

### 5.6 Assinatura do app (Keystore)

```bash
# Gerar keystore (fazer UMA vez, guardar com segurança — NÃO committar no git)
keytool -genkey -v -keystore dosy-release.keystore \
  -alias dosykey -keyalg RSA -keysize 2048 -validity 10000

# Armazenar senhas como variáveis de ambiente ou secrets do CI
```

**NUNCA commitar o `.keystore` no repositório.**

Configurar `android/app/build.gradle`:

```gradle
android {
  signingConfigs {
    release {
      storeFile file(System.getenv('KEYSTORE_PATH') ?: '../dosy-release.keystore')
      storePassword System.getenv('KEYSTORE_PASSWORD')
      keyAlias System.getenv('KEY_ALIAS') ?: 'dosykey'
      keyPassword System.getenv('KEY_PASSWORD')
    }
  }
  buildTypes {
    release {
      minifyEnabled false
      signingConfig signingConfigs.release
    }
  }
  defaultConfig {
    applicationId "com.dosyapp.dosy"
    minSdk 26       // Android 8.0 — cobre 95%+ dos dispositivos ativos
    targetSdk 34    // Android 14 — obrigatório pelo Play Store em 2024
    versionCode 1
    versionName "1.0.0"
  }
}
```

### 5.7 Build AAB (Android App Bundle)

O Play Store prefere `.aab` ao `.apk`:

```bash
# Build da web
npm run build

# Sync com Android
npx cap sync android

# No Android Studio:
Build → Generate Signed Bundle/APK → Android App Bundle

# Ou via CLI (requer gradle configurado):
cd android
./gradlew bundleRelease
```

Arquivo gerado: `android/app/build/outputs/bundle/release/app-release.aab`

### 5.8 Screenshots para Play Store

**Obrigatórias:**
- Mínimo 2 screenshots de phone (320dp – 3840dp)
- Resolução recomendada: 1080×1920px
- Formato: PNG ou JPEG

**Recomendadas:**
- Tablet 7" (opcional mas melhora conversão)
- Feature graphic: 1024×500px (banner principal da loja)

Tirar screenshots de:
1. Dashboard com doses do dia
2. Confirmação de dose (DoseModal)
3. Relatório PDF gerado
4. Configurações de notificação
5. Tela de pacientes

### 5.9 Descrição para Play Store

**Título:** Dosy – Controle de Medicamentos (máx 50 chars)
**Descrição curta:** Gerencie doses, tratamentos e adesão medicamentosa (máx 80 chars)
**Descrição longa:** Detalhar funcionalidades, público-alvo, privacidade (máx 4000 chars)

### 5.10 Preços e países

- App gratuito (download grátis)
- In-app: PRO Mensal (R$7,90), PRO Anual (R$49,90)
- Países: Brasil inicialmente; expandir depois

---

## FASE 6 — Publicação & Pós-Launch

### 6.1 Internal Testing Track (primeiro)

1. Upload do `.aab` → Testes internos
2. Adicionar email de testadores (até 100)
3. Testar todas as funcionalidades no dispositivo real
4. Resolver bugs antes de ir para produção

### 6.2 Closed Testing (beta)

1. Mover para Closed Testing (beta) com grupo maior
2. Coletar feedback → corrigir issues
3. Aguardar aprovação do Google (24-72h para apps de saúde pode ser mais lento)

### 6.3 Production Release

1. Subir para produção com rollout gradual (10% → 50% → 100%)
2. Monitorar crashlytics / Android Vitals no Play Console
3. Responder reviews

### 6.4 CI/CD para atualizações

Configurar GitHub Actions para build e upload automático:

```yaml
# .github/workflows/android-release.yml
name: Android Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-java@v4
        with: { distribution: 'temurin', java-version: '17' }
      - run: npm ci
      - run: npm run build
      - run: npx cap sync android
      - name: Build AAB
        run: |
          cd android
          ./gradlew bundleRelease \
            -PKEYSTORE_PASSWORD=${{ secrets.KEYSTORE_PASSWORD }} \
            -PKEY_PASSWORD=${{ secrets.KEY_PASSWORD }}
      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.SERVICE_ACCOUNT_JSON }}
          packageName: com.dosyapp.dosy
          releaseFiles: android/app/build/outputs/bundle/release/*.aab
          track: internal
```

### 6.5 Monitoramento pós-launch

- Android Vitals (crashes, ANRs, battery)
- Firebase Analytics (opcional)
- Reviews e ratings
- RevenueCat dashboard (receita, churn, LTV)

---

## Análise de Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Google rejeitar app (categoria saúde) | Média | Alto | Política de privacidade robusta + não mencionar diagnóstico médico |
| Vazamento de dados (LGPD) | Baixa | Crítico | RLS completo, CSP, sanitização de inputs, sem secrets no frontend |
| Multa LGPD por falta de consentimento | Média | Alto | Checkbox de consentimento no cadastro, política de privacidade publicada |
| XSS via dados do banco no PDF | Baixa | Alto | `escapeHtml` em todos os template strings antes de injetar no HTML |
| Keystore perdido/corrompido | Baixa | Crítico | Backup em 3 locais seguros (HD externo, nuvem criptografada, cofre físico) |
| Push FCM falhar no background | Média | Médio | LocalNotifications como fallback |
| Revenuecat billing error | Baixa | Alto | Testar extensivamente em ambiente de teste antes de lançar |
| `admin_grant_tier` chamado por usuário malicioso | **Alta** | **Crítico** | Verificação server-side obrigatória na RPC — testar via curl com token de user comum |
| Bypass de regras SOS via requisição direta | Alta | Alto | Mover `validateSos` para RPC server-side (0.14.1) |
| DoS via `durationDays` enorme → 100k doses | Média | Alto | Validar e limitar duração máxima server-side na RPC (0.14.3) |
| Dados órfãos por DELETE parcial | Média | Médio | FK ON DELETE CASCADE no schema (0.14.4) |
| Supabase auth token expirar offline | Média | Médio | `autoRefreshToken: true` + capturar erro e redirecionar para Login |
| WebView lenta vs app nativo | Alta | Médio | Testar performance; considerar Capacitor Ionic para componentes críticos |

---

## Estimativa de Esforço

| Fase | Estimativa | Dependências externas |
|---|---|---|
| Fase 0 — Segurança & LGPD | 3-5 dias | Advogado/consultoria LGPD (opcional) |
| Fase 1 — Fundação Capacitor | 1-2 dias | Android Studio instalado |
| Fase 2 — FCM Notifications | 2-3 dias | Conta Firebase |
| Fase 3 — In-App Purchase | 3-4 dias | Conta RevenueCat + Play Console + produtos criados |
| Fase 4 — Polimento nativo | 2-3 dias | — |
| Fase 5 — Preparação Play Store | 2-3 dias | Conta desenvolvedor Google (USD 25) |
| Fase 6 — Publicação | 1-2 dias + revisão Google (1-7 dias) | — |
| **Total estimado** | **14-22 dias de desenvolvimento** | + tempo de aprovação Google |

---

## Checklist Geral

### FASE 0 — Segurança & LGPD
- [ ] Criar `.env.example` com todas as variáveis (sem valores reais)
- [ ] Rotacionar VAPID keys (foram expostas em documentação anterior)
- [ ] Rodar `git grep` no histórico para verificar vazamento de secrets
- [ ] Auditar RLS em todas as tabelas: `patients`, `treatments`, `doses`, `push_subscriptions`, `subscriptions`, `sos_rules`, `sos_doses`
- [ ] Criar/verificar policy RLS em `push_subscriptions` para isolar por usuário
- [ ] Proteger `admin_grant_tier` RPC com verificação server-side (rejeitar chamadas do frontend)
- [ ] Remover email hardcoded de admin — usar tabela `admins` ou JWT claim
- [ ] Criar `vercel.json` com headers CSP, X-Frame-Options, X-Content-Type-Options
- [ ] Criar `src/utils/sanitize.js` com função `escapeHtml`
- [ ] Aplicar `escapeHtml` em todos os template strings do PDF em `Reports.jsx`
- [ ] Adicionar validação de senha forte no cadastro (mín. 8 chars, maiúscula, número)
- [ ] Limpar localStorage de dados sensíveis no `signOut`
- [ ] Trocar `localStorage` por `sessionStorage` no modo demo
- [ ] Implementar exportação de dados do usuário em `Settings.jsx` (portabilidade LGPD)
- [ ] Criar RPC `delete_my_account` no Supabase (cascata em todas as tabelas)
- [ ] Criar Edge Function `delete-account` com service_role para deletar do `auth.users`
- [ ] Adicionar botão "Excluir minha conta" na tela de Settings
- [ ] Adicionar checkbox de consentimento explícito no formulário de cadastro
- [ ] Adicionar colunas `consent_at` e `consent_version` na tabela `subscriptions`
- [ ] Criar rota `/privacidade` com política de privacidade completa (LGPD)
- [ ] Criar rota `/termos` com termos de uso
- [ ] Configurar pg_cron para anonimizar doses antigas (+3 anos)
- [ ] Ativar rate limiting no Supabase Auth (Dashboard → Settings)
- [ ] Habilitar confirmação de email obrigatória no cadastro
- [ ] Criar tabela `security_events` para log de auditoria
- [ ] Registrar eventos: login, logout, exportação, exclusão, mudança de assinatura

#### FASE 0.14 — Lógica de Negócio no Servidor
- [ ] **[CRÍTICO]** Criar RPC `register_sos_dose` com validação server-side de minIntervalHours e maxDosesIn24h
- [ ] **[CRÍTICO]** Substituir `supabase.from('doses').insert(sos)` por `supabase.rpc('register_sos_dose')` no `dosesService.js`
- [ ] **[CRÍTICO]** Testar via curl/Postman que INSERT direto em `doses` (type=sos) é bloqueado ou não passa nas regras
- [ ] **[CRÍTICO]** Verificar e testar que `admin_grant_tier` rejeita chamadas de usuário não-admin (ver 0.3)
- [ ] **[ALTO]** Criar RPC `create_treatment_with_doses(payload jsonb)` com validação de ownership do paciente e limite de durationDays (máx 365)
- [ ] **[ALTO]** Criar RPC `update_treatment_schedule` que regenera doses atomicamente em uma transação
- [ ] **[ALTO]** Adicionar `ON DELETE CASCADE` na FK `doses."treatmentId" → treatments.id`
- [ ] **[ALTO]** Adicionar `ON DELETE CASCADE` nas FKs de `treatments`, `doses`, `sos_rules` → `patients.id`
- [ ] **[MÉDIO]** Criar RPCs `confirm_dose`, `skip_dose`, `undo_dose` com validação de transição de status e ownership
- [ ] **[MÉDIO]** Substituir os 3 UPDATEs diretos em `dosesService.js` pelos novos RPCs
- [ ] **[MÉDIO]** Verificar RLS policies em `doses` e `treatments` incluem check de ownership via `patientId → patients."userId"`
- [ ] **[BAIXO]** Substituir `select('*')` por colunas explícitas em todos os services

### FASE 1 — Fundação Capacitor
- [ ] Instalar `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- [ ] Instalar `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/keyboard`, `@capacitor/splash-screen`
- [ ] Criar `capacitor.config.ts` com appId `com.dosyapp.dosy`
- [ ] Adicionar scripts `build:android`, `open:android` no `package.json`
- [ ] Instalar `@capacitor/preferences`
- [ ] Migrar Supabase `auth.storage` de localStorage para Capacitor Preferences
- [ ] Adicionar `detectSessionInUrl: false` no Supabase client
- [ ] Implementar handler do botão Voltar Android em `App.jsx`
- [ ] Implementar reconexão do Realtime em `useRealtime.js` (pause/resume)
- [ ] Executar `npx cap add android`
- [ ] Executar `npm run build && npx cap sync android`
- [ ] Testar app abrindo no emulador Android (API 26+)
- [ ] Testar app em dispositivo físico
- [ ] Confirmar Login/auth funcionando no Android

### FASE 2 — Notificações FCM
- [ ] Criar projeto no Firebase Console
- [ ] Adicionar app Android `com.dosyapp.dosy` no Firebase
- [ ] Baixar `google-services.json` → colocar em `android/app/`
- [ ] Instalar `@capacitor/push-notifications` e `@capacitor/local-notifications`
- [ ] Configurar PushNotifications e LocalNotifications no `capacitor.config.ts`
- [ ] Reescrever `usePushNotifications.js` com lógica isNative/web
- [ ] Adicionar migration SQL: colunas `deviceToken` e `platform` em `push_subscriptions`
- [ ] Reescrever Edge Function `notify-doses` para suportar FCM (Firebase Admin SDK)
- [ ] Adicionar secrets Firebase no painel Supabase
- [ ] Testar notificação local (LocalNotifications) no Android
- [ ] Testar push server-side (FCM) no Android
- [ ] Confirmar snooze funciona no nativo

### FASE 3 — Monetização
- [ ] Criar conta RevenueCat
- [ ] Criar conta Google Play Console (USD 25)
- [ ] Criar produtos no Play Console: `dosy_pro_monthly` e `dosy_pro_yearly`
- [ ] Conectar Play Console ao RevenueCat via chave de serviço
- [ ] Instalar `@revenuecat/purchases-capacitor`
- [ ] Criar `src/hooks/useInAppPurchase.js`
- [ ] Atualizar `PaywallModal.jsx` com botões de compra reais
- [ ] Adicionar botão "Restaurar compras" (obrigatório Google Play)
- [ ] Testar fluxo de compra em ambiente de teste do Play Store
- [ ] Testar restauração de compra
- [ ] (Opcional) Configurar webhook RevenueCat → Supabase para renovações

### FASE 4 — Polimento Nativo
- [ ] Instalar `jspdf` e `html2canvas`
- [ ] Substituir `window.print()` por jsPDF em `Reports.jsx`
- [ ] Instalar `@capacitor/filesystem` e `@capacitor/share`
- [ ] Adaptar exportação CSV para Android (Filesystem + Share)
- [ ] Instalar `@capacitor-community/admob`
- [ ] Criar lógica condicional AdSense (web) / AdMob (nativo) em `AdBanner.jsx`
- [ ] Criar assets de ícone: `resources/icon.png` (1024×1024) e `resources/splash.png`
- [ ] Criar `resources/icon-foreground.png` para adaptive icon (108×108)
- [ ] Executar `npx @capacitor/assets generate --android`
- [ ] Configurar StatusBar dark `#0d1535` na inicialização
- [ ] Testar safe area em dispositivos com notch
- [ ] Configurar deep links em AndroidManifest.xml
- [ ] Testar performance geral no Android (scroll, animações)

### FASE 5 — Preparação Play Store
- [ ] Criar/hospedar página de Política de Privacidade (`/privacidade`)
- [ ] Criar/hospedar página de Termos de Uso (`/termos`)
- [ ] Adicionar rotas `/privacidade` e `/termos` no `App.jsx`
- [ ] Preencher questionário IARC no Play Console
- [ ] Preencher declaração de saúde (se aplicável)
- [ ] Gerar keystore de release (`keytool -genkey ...`)
- [ ] Fazer backup do keystore em 3 locais seguros
- [ ] Configurar `android/app/build.gradle` com signingConfig
- [ ] Gerar primeiro `.aab` de release
- [ ] Tirar screenshots: Dashboard, DoseModal, Relatório, Settings, Pacientes (1080×1920)
- [ ] Criar Feature Graphic (1024×500px)
- [ ] Escrever descrição curta (máx 80 chars)
- [ ] Escrever descrição longa (máx 4000 chars)
- [ ] Configurar preços: gratuito (download) + PRO Mensal + PRO Anual

### FASE 6 — Publicação
- [ ] Upload AAB no track de Testes Internos
- [ ] Testar com grupo de testadores internos (mínimo 2-3 dispositivos)
- [ ] Corrigir bugs encontrados no teste interno
- [ ] Subir para Closed Testing (beta)
- [ ] Aguardar aprovação Google (1-7 dias)
- [ ] Publicar em produção com rollout gradual (10%)
- [ ] Expandir rollout para 100%
- [ ] Configurar GitHub Actions para CI/CD de releases
- [ ] Monitorar Android Vitals e crashes na primeira semana
- [ ] Responder primeiros reviews
