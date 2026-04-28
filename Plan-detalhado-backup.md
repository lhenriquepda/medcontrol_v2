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
### Fase 2.5 — Alarme Crítico Nativo ⚠️ BLOCKER PRA LAUNCH
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

### 0.13 Índices Compostos no Banco (Performance + Segurança)

**Problema:** Sem índices adequados, queries com filtros de usuário + data fazem full table scan. Em escala, isso vaza timing information e abre DoS via queries lentas.

```sql
-- Dashboard query: doses por patientId + scheduledAt
CREATE INDEX IF NOT EXISTS doses_patient_scheduled_idx
  ON medcontrol.doses ("patientId", "scheduledAt");

-- Filtro por status + scheduledAt (overdue, pending)
CREATE INDEX IF NOT EXISTS doses_patient_status_idx
  ON medcontrol.doses ("patientId", status, "scheduledAt");

-- Treatments por paciente
CREATE INDEX IF NOT EXISTS treatments_patient_status_idx
  ON medcontrol.treatments ("patientId", status);

-- Push subs por userId (lookup na hora de enviar notificações)
CREATE INDEX IF NOT EXISTS push_subs_user_idx
  ON medcontrol.push_subscriptions ("userId");

-- SOS rules lookup (medName case-insensitive)
CREATE INDEX IF NOT EXISTS sos_rules_patient_med_idx
  ON medcontrol.sos_rules ("patientId", lower(med_name));
```

---

### 0.14 LGPD — Data Minimization & RIPD (Art. 37-38)

**Data Minimization:** Avaliar campos que coletam mais dados do que necessário.

- Campo `observation` em doses: texto livre — pode conter diagnósticos, histórico médico sensível. Considerar limite de caracteres (500) e aviso ao usuário de não incluir dados clínicos desnecessários.
- `userAgent` em `push_subscriptions`: armazenado completo (até 250 chars). Guardar apenas plataforma (`Android/iOS/Web`) para minimizar PII coletada.

**RIPD (Relatório de Impacto à Proteção de Dados):**
Manter registro interno das Edge Functions e dados PII processados (obrigatório se a ANPD solicitar):

```
notify-doses     → processa: userId, medName, unit, scheduledAt
delete-account   → processa: todos os dados do usuário (exclusão)
admin_grant_tier → processa: userId, tier, expiry (admin only)
```

---

### 0.15 Logging de Eventos de Segurança

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

### 1.7 Secure Storage — Android KeyStore (substituir Capacitor Preferences)

**Problema:** `@capacitor/preferences` armazena dados em SharedPreferences em **texto simples**. Tokens de sessão do Supabase ficam legíveis por qualquer processo com root ou via backup ADB. Para app de saúde (dados categoria especial LGPD), inaceitável.

**Solução:** Usar Android KeyStore via plugin de Secure Storage:

```bash
npm install @aparajita/capacitor-secure-storage
```

O plugin usa:
- **Android:** `EncryptedSharedPreferences` (AES-256-GCM via Android KeyStore, protegida por hardware em dispositivos com TEE)
- **iOS:** Keychain Services
- **Web:** localStorage com fallback (não criptografado — exibir aviso no modo web)

**Modificar `src/services/supabase.js`:**
```javascript
import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { Capacitor } from '@capacitor/core'

// Storage seguro: KeyStore no nativo, localStorage na web
const SecureStorageAdapter = Capacitor.isNativePlatform() ? {
  getItem: async (key) => {
    try { return await SecureStorage.get(key) } catch { return null }
  },
  setItem: async (key, value) => {
    await SecureStorage.set(key, value)
  },
  removeItem: async (key) => {
    try { await SecureStorage.remove(key) } catch {}
  }
} : localStorage  // web usa localStorage como antes

export const supabase = createClient(URL, KEY, {
  auth: {
    storage: SecureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  db: { schema: SCHEMA }
})
```

> **Nota:** Substituir `@capacitor/preferences` por `SecureStorage` para todos os dados sensíveis. Dados não-sensíveis (preferências de UI, collapsed state) podem continuar em `localStorage`.

---

### 1.8 SSL Pinning (Proteção contra Man-in-the-Middle)

**Problema:** Em redes Wi-Fi públicas ou corporativas com proxy, um atacante pode apresentar um certificado falso e interceptar todas as requisições ao Supabase (login, dados de saúde).

**Solução:** Configurar o app para aceitar **apenas** o certificado do domínio Supabase:

```bash
npm install @ionic-native/http
# ou via capacitor-community:
npm install @capacitor-community/http
```

**Configurar em `capacitor.config.ts`:**
```typescript
plugins: {
  CapacitorHttp: {
    enabled: true  // intercepta fetch/XHR e aplica pinning
  }
}
```

**Adicionar pins em `android/app/src/main/res/xml/network_security_config.xml`:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">supabase.co</domain>
    <pin-set>
      <!-- SHA-256 do certificado intermediário da CA do Supabase -->
      <!-- Gerar com: openssl s_client -connect SEU_PROJETO.supabase.co:443 | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64 -->
      <pin digest="SHA-256">HASH_DO_CERTIFICADO_AQUI</pin>
    </pin-set>
  </domain-config>
</network-security-config>
```

> ⚠️ **Atenção:** SSL Pinning pode quebrar o app se o certificado do Supabase for renovado sem atualizar o pin. Manter pin do certificado intermediário (mais estável) e sempre incluir um backup pin.

---

### 1.9 Build e sync

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

### 4.6 Modo Offline — Fila de Sincronização de Mutações

**Contexto:** Usuário marca dose como "Tomada" no subsolo/avião sem sinal. Sem offline support, a ação é perdida silenciosamente.

**Solução:** `persistQueryClient` + mutation queue com TanStack Query:

```bash
npm install @tanstack/query-persist-client-core @tanstack/query-sync-storage-persister
```

**Configurar em `src/main.jsx`:**
```javascript
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'dosy-query-cache'
})

// No Android nativo: trocar por SecureStorage ou Capacitor Preferences
```

**Implementar mutation queue em `src/hooks/useDoses.js`:**
```javascript
// Optimistic update já existe — adicionar persistência offline:
export function useConfirmDose() {
  return useMutation({
    mutationFn: confirmDose,
    // UI atualiza imediatamente
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['doses'] })
      const previous = qc.getQueryData(['doses'])
      qc.setQueryData(['doses'], (old) =>
        old?.map(d => d.id === id ? { ...d, status: 'done' } : d)
      )
      return { previous }
    },
    onError: (_, __, ctx) => {
      // Reverter se falhar
      qc.setQueryData(['doses'], ctx.previous)
    },
    // Retry automático quando voltar online
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000)
  })
}
```

**Detectar conectividade:**
```javascript
// src/hooks/useOnlineStatus.js
import { Network } from '@capacitor/network'

export function useOnlineStatus() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    Network.getStatus().then(s => setOnline(s.connected))
    const handler = Network.addListener('networkStatusChange', s => setOnline(s.connected))
    return () => handler.remove()
  }, [])
  return online
}
```

> Notificações locais (`LocalNotifications`) são o "mestre" para alertas críticos de dose — funcionam offline. Push FCM serve para engajamento e quando app está fechado.

---

### 4.7 Deep Links (para OAuth futuro)

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

## FASE 4.5 — Auditorias & Hardening Pré-Play-Store

**Objetivo:** Antes de submeter Play Store, passar app por bateria de auditorias estruturadas (código, UX, segurança mobile, performance) e fechar gaps críticos. Cada sub-fase de auditoria gera doc anexo `Auditoria-4.5.X.md` que vira input read-only — achados se propagam pras sub-fases de remediação correspondentes.

> **Convenção:** auditoria primeiro (gera relatório), remediação depois (itens propagados pras sub-fases). Concluído quando todas auditorias rodaram + gaps críticos/altos fechados.

### 4.5.1 Auditoria de código & arquitetura
- [ ] Mapear todas queries Supabase em uso (RPC + select direto)
- [ ] Inventariar tabelas + columns + indexes atuais
- [ ] Listar todas Edge Functions + RPCs SECURITY DEFINER
- [ ] Mapear lógica financeira/médica que ainda roda no client (deveria ser server)
- [ ] Avaliar bundle size com `rollup-plugin-visualizer` — identificar chunks gordos (jspdf 390KB, html2canvas 200KB)
- [ ] Identificar débitos técnicos + comportamentos quebrados conhecidos
- [ ] `npm audit` completo + Snyk scan
- [ ] Gerar `docs/audits/Auditoria-4.5.1.md` com pontuação de risco + top 10 recomendações

### 4.5.2 Auditoria DB — schema + RLS
- [ ] Auditar policies RLS em TODAS tabelas (`patients`, `treatments`, `doses`, `user_prefs`, `push_subscriptions`, `shares`, `subscriptions`, `audit_log`)
- [ ] Garantir cada policy use `auth.uid() = userId`
- [ ] Trocar role `public` → `authenticated` se houver
- [ ] `ALTER TABLE ... FORCE ROW LEVEL SECURITY` em todas
- [ ] Substituir policy única `ALL` por 4 (SELECT/INSERT/UPDATE/DELETE)
- [ ] Policy UPDATE com `WITH CHECK` bloqueando alteração de `userId` e `createdAt`
- [ ] Testar RLS pen test interno (user A tenta ler dados user B via API direta)
- [ ] Gerar `docs/audits/Auditoria-4.5.2.md`

### 4.5.3 Hardening DB — remediação (vinda da 4.5.2)
- [ ] CHECK `intervalHours > 0` em `treatments`
- [ ] CHECK length max em `medName`, `unit`, `observation` (ex: 200/100/500 chars)
- [ ] CHECK `scheduledAt` não no passado distante (sanity)
- [ ] Trigger validando ownership cruzado: `dose.userId == treatment.userId`
- [ ] Trigger validando: `dose.patientId == treatment.patientId`
- [ ] Adicionar índices em FKs faltantes (`userId`, `patientId`, `treatmentId`, `scheduledAt`, `status`)
- [ ] Sanitizar texto livre em RPCs (escape HTML, remover ctrl chars)
- [ ] Padronizar email lowercase + trim antes de inserir

### 4.5.4 Atomicidade — eliminar multi-step não-transacional
- [ ] Auditar todas mutations multi-step (criar treatment + doses, deletar patient + cascade, share + accept)
- [ ] Garantir tudo via RPC PL/pgSQL transacional ou Edge Function
- [ ] `delete-account` Edge Function (LGPD — soft delete + hard delete em 30d)
- [ ] `export-user-data` Edge Function (LGPD — JSON completo do user)

### 4.5.5 Migrations versionadas (Supabase CLI)
- [ ] Instalar Supabase CLI local
- [ ] `supabase init` no repo + commitar `supabase/config.toml`
- [ ] `supabase link --project-ref <ref>`
- [ ] `supabase db pull` → migration baseline
- [ ] Documentar fluxo: criar migration → testar local → push prod
- [ ] Pasta `supabase/migrations/` versionada
- [ ] Regra de equipe: ZERO edits diretos em prod schema

### 4.5.6 Auditoria UX & A11y
- [ ] Test app inteiro em device Android real (3 marcas, versões 12/13/14)
- [ ] Listar telas com overflow, fonte pequena, toque difícil
- [ ] Validar acessibilidade (contraste WCAG AA, toque ≥44px, leitor de tela TalkBack)
- [ ] Documentar fluxos críticos (cadastrar dose, confirmar/pular, criar tratamento)
- [ ] Gerar `docs/audits/Auditoria-4.5.6.md`

### 4.5.7 A11y — remediação (vinda da 4.5.6)
- [ ] Auditar touch targets <44×44px → aumentar (especialmente icon-only buttons)
- [ ] Adicionar `aria-label` em ~50 botões só-ícone
- [ ] `:focus-visible` global no `theme.css` com outline brand visível
- [ ] Trap de foco em `BottomSheet` (Tab cíclico)
- [ ] Skip-to-content link no início do `<main>`
- [ ] Hierarquia de headings correta por página (h1 único, h2/h3 sub)
- [ ] `aria-live="polite"` em região de toasts
- [ ] Subir contraste textos secundários no dark (slate-400 → slate-300)
- [ ] Suportar Dynamic Type (fonte system-scaled, usar `rem`)
- [ ] `inputMode="numeric"` em campos quantidade/dose
- [ ] Erros inline próximos ao campo (além do toast)
- [ ] Skeleton screens em todas listas async (Patients, Treatments, History)
- [ ] Empty states com ilustração leve em listas vazias
- [ ] Testar manualmente com TalkBack ativo

### 4.5.8 Qualidade de código — remediação
- [ ] Strip `console.log` no build prod (Vite plugin `vite-plugin-remove-console`)
- [ ] `<ErrorBoundary>` global no React root + reportar Sentry
- [ ] Retry automático mutations TanStack Query (retry: 3, exponential backoff)
- [ ] Code splitting por rota com `React.lazy` (todas pages)
- [ ] Dynamic import de `jspdf` + `html2canvas` (só carrega em /relatorios)
- [ ] Bundle alvo: ≤500KB main + chunks por rota
- [ ] ESLint + Prettier + commit hooks (lint-staged)
- [ ] TypeScript strict (eliminar `any` se houver)

### 4.5.9 Auditoria de segurança mobile
- [ ] OWASP Mobile Top 10 review
- [ ] Tentativa de bypass RLS via API direta (Postman/curl)
- [ ] Tentativa de tampering APK
- [ ] Análise de tráfego com Burp/mitmproxy
- [ ] Validar APK release tem ProGuard/R8 ativo
- [ ] Validar não há secrets no bundle (grep build output)
- [ ] Considerar pen test profissional terceirizado
- [ ] Gerar `docs/audits/Auditoria-4.5.9.md`

### 4.5.10 Hardening segurança mobile (vinda da 4.5.9)
- [ ] Network Security Config — force HTTPS no Android
- [ ] Certificate pinning `*.supabase.co` + `dosy-teal.vercel.app`
- [ ] Google Play Integrity API integration
- [ ] FLAG_SECURE em telas com info médica sensível (DoseModal, PatientDetail, Reports)
- [ ] Mask de valores em background (recents view) — info médica não vaza
- [ ] Modo discreto opcional (●●●● em med names + observations)
- [ ] Detectar root/jailbreak — warn user (saúde sensível)
- [ ] Biometria opcional pra abrir app (toggle Settings)
- [ ] Re-autenticar após N min em background
- [ ] Logout remoto multi-device (revogar sessão)
- [ ] Tela "Dispositivos conectados" listando sessões ativas
- [ ] Notif email + push ao login em device novo
- [ ] 2FA opcional via TOTP (futuro, não bloqueante)
- [ ] Considerar criptografia client-side de `observation` (info médica)

### 4.5.11 Logs & auditoria
- [ ] Tabela `medcontrol.audit_log` (userId, action, payload, ip, ua, createdAt)
- [ ] Triggers em INSERT/UPDATE/DELETE de doses/treatments/patients → grava audit_log
- [ ] Endpoint admin pra revisar logs suspeitos
- [ ] Retenção: 90d detalhado, 1 ano agregado
- [ ] PITR habilitado no Supabase + testado restore em staging

### 4.5.12 Tests automatizados
- [ ] Setup Vitest + Testing Library
- [ ] Unit tests utils críticos: `dateUtils`, `generateDoses`, `statusUtils`, `tierUtils`, `userDisplay`
- [ ] Unit tests `services/notifications.js` (DND helper, group, schedule logic)
- [ ] Unit tests hooks com mock Supabase: `useDoses`, `useUserPrefs`
- [ ] Integration: criar treatment → doses geradas corretas
- [ ] Integration: confirm/skip/undo dose → cache atualizado
- [ ] E2E Playwright (web): login → dashboard → criar treatment → ver doses
- [ ] Cobertura alvo: ≥90% em utils núcleo, ≥70% no resto
- [ ] CI verde 5 dias consecutivos antes de avançar

### 4.5.13 Observability avançada
- [ ] PostHog SDK (product analytics + feature flags)
- [ ] Eventos críticos: dose_confirmed, dose_skipped, alarm_fired, paywall_view, paywall_click, upgrade_complete
- [ ] Funnel paywall: view → click → checkout → success
- [ ] Dashboards: DAU, MAU, retention D1/D7/D30, crash-free rate, ANR rate
- [ ] Sentry source maps upload no Vercel build
- [ ] Alertas Sentry pra regressões (crash rate spike)
- [ ] Métricas-alvo lançamento: crash-free ≥99.5%, ANR <0.5%, retention D7 ≥40%

### 4.5.14 Performance
- [ ] Lighthouse score ≥90 em pages-chave (web)
- [ ] Bundle analyzer report (`rollup-plugin-visualizer`)
- [ ] Lazy load images (Camera/avatar uploads)
- [ ] React Query persistor offline (já tem — validar)
- [ ] Virtualizar listas longas (>100 items) com `react-virtual`
- [ ] Otimizar re-renders (React.memo onde necessário)
- [ ] Performance scroll lista de 200+ doses sem jank

### 4.5.15 Validação manual em device real
- [ ] 3 devices Android (baixo, médio, top) — versões 12, 13, 14
- [ ] Performance scroll listas longas
- [ ] Teclado virtual não cobre submit
- [ ] TalkBack ativo: fluxos navegáveis
- [ ] Modo escuro forçado, fonte aumentada do sistema
- [ ] Notch / dynamic island / safe-area inferior
- [ ] Pull-to-refresh funcionando
- [ ] Sem rede + 3G simulada (TanStack persistor offline)
- [ ] Contraste sob luz solar real
- [ ] Alarme dispara corretamente em 3 cenários: locked, unlocked, app killed
- [ ] DND respeitado (alarme silencia, push notif passa)

### 4.5.16 UX refinements (gaps notados)
- [ ] Undo (5s) ao deletar paciente/tratamento (atualmente só em doses)
- [ ] Busca text-search dentro de Histórico (filtros têm chips, falta search)
- [ ] Confirmação dupla ao deletar batch
- [ ] Sort configurável de pacientes (drag-and-drop ou ordem manual)
- [ ] Anexar comprovantes/imagens em doses (foto da medicação) — feature PRO

**Validação FASE 4.5:** todas auditorias rodadas + docs `Auditoria-4.5.X.md` gerados; gaps críticos/altos fechados; bundle ≤500KB main; cobertura tests ≥70%; pen test interno aprovado; 0 secrets no bundle; `npm audit` limpo high/critical; A11y WCAG AA atingido; performance Lighthouse ≥90.

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

### 6.5 Sentry — Monitoramento de Erros em Produção

**Contexto:** Sem monitoramento, erros em produção são invisíveis. Um crash no fluxo de SOS pode colocar usuário em risco sem que o dev saiba.

```bash
npm install @sentry/react @sentry/capacitor
```

**Configurar em `src/main.jsx`:**
```javascript
import * as Sentry from '@sentry/react'
import * as SentryCapacitor from '@sentry/capacitor'

SentryCapacitor.init(
  {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,  // 'development' | 'production'
    // LGPD: não enviar dados pessoais para Sentry
    beforeSend(event) {
      // Strip PII: remover emails, nomes de pacientes, nomes de medicamentos
      if (event.user) { delete event.user.email; delete event.user.username }
      return event
    },
    tracesSampleRate: 0.1  // 10% das transações
  },
  Sentry.init
)
```

**O que monitorar:**
- Falhas em RPCs do Supabase (`register_sos_dose`, `confirm_dose`)
- Falhas de autenticação inesperadas
- Erros no Service Worker / push notifications
- Crashes no fluxo de compra (RevenueCat)

> ⚠️ **LGPD:** Configurar `beforeSend` para remover PII antes de enviar ao Sentry. Nomes de medicamentos são dados de saúde — categoria especial.

---

### 6.6 Escalabilidade Futura — Table Partitioning (pós 10k usuários)

**Quando aplicar:** Tabela `doses` acima de ~5 milhões de linhas (estimativa: 10k usuários × 3 remédios × 365 dias ≈ 11M registros/ano).

```sql
-- Converter doses para tabela particionada por mês (PostgreSQL 14+)
-- ATENÇÃO: operação destrutiva — fazer em janela de manutenção com backup
CREATE TABLE medcontrol.doses_new (
  LIKE medcontrol.doses INCLUDING ALL
) PARTITION BY RANGE ("scheduledAt");

-- Criar partições mensais
CREATE TABLE medcontrol.doses_2025_01 PARTITION OF medcontrol.doses_new
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- ... repetir para cada mês

-- Migrar dados e renomear
INSERT INTO medcontrol.doses_new SELECT * FROM medcontrol.doses;
ALTER TABLE medcontrol.doses RENAME TO doses_old;
ALTER TABLE medcontrol.doses_new RENAME TO doses;
```

**Benefício:** Queries de Dashboard (doses de "hoje") varrem apenas a partição do mês corrente — ordens de magnitude mais rápido.

---

### 6.7 Monitoramento pós-launch

- Android Vitals (crashes, ANRs, battery)
- Sentry (erros em tempo real)
- Firebase Analytics (funil de conversão, retenção)
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
- [x] Criar `.env.example` com todas as variáveis (sem valores reais)
- [x] Rotacionar VAPID keys — N/A: app migrado para novo projeto `dosy-app` com par VAPID novo gerado (`BHnTRizO...`). kids-paint não é mais usado pelo Android. ✅
- [x] Rodar `git grep` no histórico para verificar vazamento de secrets ✅ — auditado: VAPID privada antiga do kids-paint encontrada em `Contexto.md` (commit 78f4b77, removida em 843d4d1 mas ainda no histórico). Risco baixo: app migrou para `dosy-app` com par VAPID novo. Nenhum service_role/PAT/JWT vazou.
- [x] Auditar RLS em todas as tabelas: `patients`, `treatments`, `doses`, `push_subscriptions`, `subscriptions`, `sos_rules` — todas com RLS ativo ✅
- [x] Criar/verificar policy RLS em `push_subscriptions` para isolar por usuário — policy `push_own_all` já existe ✅
- [x] Proteger `admin_grant_tier` RPC com verificação server-side — usa `is_admin()` reescrito ✅
- [x] Remover email hardcoded de admin — criada tabela `admins`, `is_admin()` e `effective_tier()` reescritas ✅
- [x] Criar `vercel.json` com headers CSP, X-Frame-Options, X-Content-Type-Options ✅
- [x] Criar `src/utils/sanitize.js` com função `escapeHtml` ✅
- [x] Aplicar `escapeHtml` em todos os template strings do PDF em `Reports.jsx` ✅
- [x] Adicionar validação de senha forte no cadastro (mín. 8 chars, maiúscula, número) ✅
- [x] Limpar localStorage de dados sensíveis no `signOut` ✅
- [x] Trocar `localStorage` por `sessionStorage` no modo demo ✅
- [x] Implementar exportação de dados do usuário em `Settings.jsx` (portabilidade LGPD) ✅
- [x] Criar RPC `delete_my_account` no Supabase (cascata em todas as tabelas) ✅
- [x] Criar Edge Function `delete-account` com service_role para deletar do `auth.users` ✅
- [x] Adicionar botão "Excluir minha conta" na tela de Settings ✅
- [x] Adicionar checkbox de consentimento explícito no formulário de cadastro ✅
- [x] Adicionar colunas `consentAt` e `consentVersion` na tabela `subscriptions` ✅
- [x] Criar rota `/privacidade` com política de privacidade completa (LGPD) ✅
- [x] Criar rota `/termos` com termos de uso ✅
- [x] Configurar pg_cron para anonimizar doses antigas (+3 anos) — `anonymize-old-doses` agendado (Domingos 3h) no projeto `dosy-app` ✅
- [x] Ativar rate limiting no Supabase Auth — `rate_limit_otp=5`, `rate_limit_anonymous_users=30`, `rate_limit_token_refresh=150` no projeto `dosy-app` ✅
- [x] Habilitar confirmação de email obrigatória no cadastro — `mailer_autoconfirm=false` no projeto `dosy-app` ✅
- [x] Criar tabela `security_events` para log de auditoria ✅
- [x] Registrar eventos de mudança de tier em `admin_grant_tier` ✅ / exclusão de conta em `delete_my_account` ✅
- [x] Criar índices compostos: `doses(patientId, scheduledAt)`, `doses(patientId, status, scheduledAt)`, `treatments(patientId, status)`, `push_subscriptions(userId)` ✅
- [x] Limitar campo `observation` a 500 chars (Data Minimization LGPD) ✅
- [x] Trocar `userAgent` completo em push_subscriptions por plataforma simplificada — coluna `platform` adicionada ✅
- [x] Documentar quais Edge Functions processam PII (para RIPD se ANPD solicitar) — `docs/RIPD.md` criado com `notify-doses`, `delete-account`, `admin_grant_tier` ✅

#### FASE 0.14 — Lógica de Negócio no Servidor
- [x] **[CRÍTICO]** Criar RPC `register_sos_dose` com validação server-side de minIntervalHours e maxDosesIn24h ✅
- [x] **[CRÍTICO]** Substituir `supabase.from('doses').insert(sos)` por `supabase.rpc('register_sos_dose')` no `dosesService.js` ✅
- [x] **[CRÍTICO]** Testar que INSERT direto em `doses` (type=sos) é bloqueado ✅ — `tools/test-sos-bypass.cjs` valida: anon bloqueado por trigger, authenticated direct bloqueado por trigger `enforce_sos_via_rpc_trigger`, RPC funciona, cross-patient bloqueado por RLS. Fix aplicado: `tools/security-fix.cjs` (drop `own_*` policies inseguras + trigger).
- [x] **[CRÍTICO]** `admin_grant_tier` rejeita chamadas de usuário não-admin — `is_admin()` usa tabela `admins` ✅
- [x] **[ALTO]** Criar RPC `create_treatment_with_doses(payload jsonb)` com validação de ownership do paciente e limite de durationDays (máx 365) ✅
- [x] **[ALTO]** Criar RPC `update_treatment_schedule` que regenera doses atomicamente em uma transação ✅
- [x] **[ALTO]** Adicionar `ON DELETE CASCADE` na FK `doses."treatmentId" → treatments.id` ✅
- [x] **[ALTO]** Adicionar `ON DELETE CASCADE` nas FKs de `treatments`, `doses`, `sos_rules`, `patient_shares` → `patients.id` ✅
- [x] **[MÉDIO]** Criar RPCs `confirm_dose`, `skip_dose`, `undo_dose` com validação de transição de status e ownership ✅
- [x] **[MÉDIO]** Substituir os 3 UPDATEs diretos em `dosesService.js` pelos novos RPCs ✅
- [x] **[MÉDIO]** RLS policies em `doses` e `treatments` incluem check via `has_patient_access()` — auditado ✅
- [x] **[BAIXO]** Substituir `select('*')` por colunas explícitas em todos os services ✅

### FASE 1 — Fundação Capacitor
- [x] Instalar `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` ✅
- [x] Instalar `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/keyboard`, `@capacitor/splash-screen` ✅
- [x] Criar `capacitor.config.ts` com appId `com.dosyapp.dosy` ✅
- [x] Adicionar scripts `build:android`, `open:android` no `package.json` ✅
- [x] Instalar `@aparajita/capacitor-secure-storage` (substitui `@capacitor/preferences` para dados sensíveis) ✅
- [x] Migrar Supabase `auth.storage` de localStorage para SecureStorage (Android KeyStore) — adapter condicional (web→localStorage, native→SecureStorage) ✅
- [x] Adicionar `detectSessionInUrl: false` no Supabase client (apenas em modo native) ✅
- [x] Implementar handler do botão Voltar Android em `App.jsx` ✅
- [x] Implementar reconexão do Realtime em `useRealtime.js` (pause/resume) ✅
- [x] Executar `npx cap add android` ✅
- [x] Executar `npm run build && npx cap sync android` ✅
- [x] Instalar JDK 17 + JDK 21 (Temurin) e Android SDK (cmdline-tools, platforms 34/35/36, build-tools 34.0.0) ✅
- [x] Configurar `JAVA_HOME` e `ANDROID_HOME` em variáveis de usuário ✅
- [x] Testar app abrindo no emulador Android (Pixel 10 Pro via Studio) ✅
- [ ] Testar app em dispositivo físico
- [x] Confirmar Login/auth funcionando no Android — testado no emulador Pixel 10 Pro (2026-04-26): login + logout + relogin OK contra `dosy-app` (novo projeto). SecureStorage ativo, sessão persiste. ✅
- [x] SSL Pinning em `network_security_config.xml` ✅ — Pinning ATIVO para `guefraaqbkcehofchnrc.supabase.co` (dosy-app). Hashes SHA-256 SPKI extraídos via Node.js (`tools/extract-spki.cjs`): primary GTS WE1 (válido até Feb 2029), backup GTS Root R4 (até Jan 2028). Cleartext bloqueado, CA validation + pinning ativos.
- [x] Bloquear ADB backup e device-to-device transfer via `allowBackup="false"` + `data_extraction_rules.xml` ✅
- [ ] **NOTA:** Build CLI via `gradlew.bat` quebra com `Unable to establish loopback connection` (bug Win11 24H2 + JVM UnixDomainSockets). Workaround: build via Android Studio (JBR patched). CI/produção: rodar build em runner Linux (GitHub Actions) — sem o bug.

### FASE 2 — Notificações FCM
- [x] Criar projeto no Firebase Console — projeto `dosy-b592e` ✅
- [x] Adicionar app Android `com.dosyapp.dosy` no Firebase ✅
- [x] Baixar `google-services.json` → `android/app/` ✅
- [x] Instalar `@capacitor/push-notifications` e `@capacitor/local-notifications` ✅
- [x] Configurar PushNotifications e LocalNotifications no `capacitor.config.ts` ✅
- [x] Reescrever `usePushNotifications.js` com lógica isNative/web — FCM no nativo (registration listener + LocalNotifications), Web Push na web ✅
- [x] Adicionar migration SQL: colunas `deviceToken` e `platform` em `push_subscriptions` — `tools/fcm-schema-migration.cjs` ✅
- [x] Reescrever Edge Function `notify-doses` para suportar FCM (HTTP v1 API + JWT OAuth) ✅
- [x] Adicionar secrets Firebase no painel Supabase — `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` ✅
- [x] Testar notificação local (LocalNotifications) no Android — 10 doses agendadas no Pixel 10 Pro emulador, dispararam no horário ✅
- [x] Testar push server-side (FCM) no Android — token persistido, FCM HTTP v1 API retornou 200, notificação visual apareceu ✅
- [ ] Confirmar snooze funciona no nativo ← validar quando precisar (não-bloqueante)
- [x] **EXTRA:** Multi-device test — 2 emuladores, 2 users, push direcionado entrega só pro alvo correto ✅
- [x] **EXTRA:** Edge Function `send-test-push` deployada para testes admin (POST com email do alvo)
- [x] **EXTRA:** Notification channel `doses` criado no app (Android 8+ requer)
- [x] **EXTRA:** Payload FCM corrigido — `priority: 'HIGH'` (uppercase), `notification_priority: 'PRIORITY_HIGH'`, `default_sound: true`
- [x] **EXTRA:** Criar RPC `upsert_push_subscription` SECURITY DEFINER — solução pra cross-user device ownership transfer (mesmo device, user A logout → user B login → token vai pro user B sem RLS bloquear)
- [x] **EXTRA:** Trocar partial unique index por UNIQUE constraint em `deviceToken` — partial index não funciona com `ON CONFLICT`

### FASE 2.5 — Alarme Crítico Nativo (BLOCKER PRA LAUNCH)
> Notificação push padrão (Capacitor LocalNotifications) toca som 1x e não bypassa silencioso/DND.
> Pra app de medicação, lembretes precisam comportar-se como **alarme do despertador**: tela cheia, som em loop até dismiss, ignora silencioso, mostra na lock screen.
> Requer plugin Android nativo custom (não existe plugin Capacitor maintained pra isso).

- [x] Criar plugin Capacitor Android `CriticalAlarmPlugin` (Java) ✅
- [x] Criar `AlarmReceiver` (BroadcastReceiver disparado por AlarmManager) ✅
- [x] Criar `AlarmActivity` full-screen com FLAG_SHOW_WHEN_LOCKED + TURN_SCREEN_ON, MediaPlayer USAGE_ALARM loop, botões Ciente / Adiar 10min, vibração contínua ✅
- [x] Adicionar permissão `USE_FULL_SCREEN_INTENT` no AndroidManifest ✅
- [x] Adicionar permissão `ACCESS_NOTIFICATION_POLICY` ✅
- [x] Adicionar `SYSTEM_ALERT_WINDOW` para BAL bypass Android 14+ ✅ (granted via adb appops)
- [ ] Adicionar `dosy_alarm.mp3` em `res/raw/` (custom — fallback usa default RingtoneManager.TYPE_ALARM) ← opcional
- [x] Registrar plugin em `MainActivity.java` ✅
- [x] Bridge JS: `src/services/criticalAlarm.js` ✅
- [x] Atualizar `usePushNotifications.scheduleDoses` — agrupa doses por minuto, agenda 1 critical alarm por grupo ✅
- [x] Toggle "criticalAlarm" em prefs (default ON) — controlado em Settings ✅
- [x] Quando OFF/falha: fallback LocalNotifications ✅
- [x] **EXTRA:** `AlarmService` foreground service (BAL workaround Android 14+ — MediaPlayer loop em service, BAL exempt via SYSTEM_ALERT_WINDOW) ✅
- [x] **EXTRA:** Agrupamento doses mesmo horário — 1 alarme único + 1 notif single com lista, vs N alarmes simultâneos ✅
- [x] **EXTRA:** Modal queue — tap notif abre fila Ignorar/Pular/Tomada por dose ✅
- [x] Tap em notif tray → MainActivity → modal queue (Ignorar/Pular/Tomada via RPC) ✅
- [x] Re-agendar alarmes após reboot (`BootReceiver` registrado AndroidManifest, BOOT_COMPLETED + LOCKED_BOOT_COMPLETED + MY_PACKAGE_REPLACED) ✅
- [x] Testar: device bloqueado → tela cheia liga + som ✅ (validado emulador Pixel 10 Pro 2026-04-27)
- [x] Testar: app killed (home Android) → alarme dispara fullscreen ✅
- [ ] Testar: dose com alarme crítico ATIVO → silenciar device → ainda tocar (USAGE_ALARM bypassa silencioso, validar em device físico)
- [ ] Testar: dose com alarme crítico ATIVO → DND mode → ainda tocar (após permissão ACCESS_NOTIFICATION_POLICY granted)
- [ ] Testar: tap "Adiar 10 min" → re-agenda pra +10min (re-test após mudança de implementação)

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
- [ ] **CTA permanente "Gerenciar plano" / "Mudar plano" / "Cancelar"** — atualmente paywall só abre via fluxos pontuais (locked feature, banner home). Usuário PRO/Plus não tem onde gerenciar assinatura, e Free não tem ponto fixo de upgrade.
  - Adicionar seção **"Assinatura"** em `Settings.jsx` (após "Aparência" ou antes de "Conta"):
    - Free: card com tier atual + botão "Conhecer PRO" → abre PaywallModal
    - PRO/Plus: card com tier atual + data renovação + botões "Mudar plano" (PaywallModal com toggle Mensal/Anual) e "Cancelar assinatura" (deep link Play Store: `https://play.google.com/store/account/subscriptions?sku=<sku>&package=<pkg>`)
  - Reforçar card de tier em `More.jsx` com CTA explícito (já existe info do plano, falta botão de ação pra PRO/Plus)
  - Adicionar botão "Restaurar compras" na seção (RevenueCat `restorePurchases()`) — obrigatório Google Play
  - Link "Política de cobrança" → texto curto explicando renovação automática + como cancelar (compliance Play Store)
  - Considerar badge/banner sutil pra Free em pages-chave (Dashboard hero quando tier=free, já existe; replicar em PatientDetail/TreatmentList se patient/treatment limit reached)

### FASE 4 — Polimento Nativo
- [x] Instalar `jspdf` e `html2canvas` ✅
- [x] Substituir `window.print()` por jsPDF em `Reports.jsx` (native path: html2canvas → jsPDF → Filesystem.Cache → Share). Web mantém window.print. ✅
- [x] Instalar `@capacitor/filesystem` e `@capacitor/share` ✅
- [x] Adaptar exportação CSV para Android (Filesystem + Share) ✅
- [x] Implementar offline mutations + persistência cache (TanStack PersistQueryClient + retry exponential backoff 3x) ✅
- [x] Instalar `@capacitor/network` ✅
- [x] Criar `src/hooks/useOnlineStatus.js` com Network listener (native) + navigator.onLine (web) ✅
- [x] Instalar `@capacitor-community/admob` ✅
- [x] Criar lógica condicional AdSense (web) / AdMob (nativo) em `AdBanner.jsx` — test ID default, real ID via `VITE_ADMOB_BANNER_ANDROID` env ✅
- [ ] Criar assets de ícone: `resources/icon.png` (1024×1024) e `resources/splash.png` ← design assets needed (manual)
- [ ] Criar `resources/icon-foreground.png` para adaptive icon (108×108) ← design assets needed (manual)
- [ ] Executar `npx @capacitor/assets generate --android` (depende dos assets acima)
- [x] Configurar StatusBar dark `#0d1535` na inicialização (main.jsx + Capacitor StatusBar plugin) ✅
- [ ] Testar safe area em dispositivos com notch ← device físico
- [x] Configurar deep links em AndroidManifest.xml — `https://dosy-teal.vercel.app` + `dosy://` custom scheme ✅
- [ ] Testar performance geral no Android (scroll, animações) ← device físico

### FASE 5 — Preparação Play Store
- [x] Criar página de Política de Privacidade (`/privacidade`) — `src/pages/Privacidade.jsx` criado ✅
- [x] Criar página de Termos de Uso (`/termos`) — `src/pages/Termos.jsx` criado ✅
- [x] Adicionar rotas `/privacidade` e `/termos` no `App.jsx` como rotas públicas (antes do auth check) ✅
- [ ] Preencher questionário IARC no Play Console ← manual (web Play Console)
- [ ] Preencher declaração de saúde (se aplicável) ← manual (web Play Console)
- [ ] Gerar keystore de release ← `docs/play-store/keystore-instructions.md` com comando + checklist segurança ⚠️ MANUAL CRÍTICO
- [ ] Fazer backup do keystore em 3 locais seguros ← manual (instruções em keystore-instructions.md)
- [x] Configurar `android/app/build.gradle` com signingConfig — env-based (KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD), só ativa se keystore existir ✅
- [x] `.keystore` + `*.jks` adicionados ao `.gitignore` ✅
- [ ] Gerar primeiro `.aab` de release (depende keystore) ← `cd android && .\gradlew.bat bundleRelease`
- [ ] Tirar screenshots: Dashboard, DoseModal, Relatório, Settings, Pacientes (1080×1920) ← manual
- [ ] Criar Feature Graphic (1024×500px) ← manual (design)
- [x] Escrever descrição curta — `docs/play-store/description-short.txt` (80 chars) ✅
- [x] Escrever descrição longa — `docs/play-store/description-long.txt` (~3500 chars com features, LGPD, contato) ✅
- [x] Release notes template — `docs/play-store/release-notes.md` ✅
- [x] App title — `docs/play-store/app-title.txt` ✅
- [ ] Configurar preços: gratuito (download) + PRO Mensal + PRO Anual ← manual (Play Console + RevenueCat)

### FASE 6 — Publicação
- [ ] Upload AAB no track de Testes Internos ← manual (Play Console upload primeira vez OU via workflow_dispatch GitHub Actions)
- [ ] Testar com grupo de testadores internos (mínimo 2-3 dispositivos) ← manual
- [ ] Corrigir bugs encontrados no teste interno ← contínuo
- [ ] Subir para Closed Testing (beta) ← manual ou `gh workflow run android-release.yml -f track=beta`
- [ ] Aguardar aprovação Google (1-7 dias) ← manual
- [ ] Publicar em produção com rollout gradual (10%) ← manual (Play Console)
- [ ] Expandir rollout para 100% ← manual
- [x] Configurar GitHub Actions para CI/CD de releases — `.github/workflows/android-release.yml` (build signed AAB + upload Play Store, multi-track via workflow_dispatch) + `ci.yml` (build verification em PRs) ✅
- [x] Integrar Sentry (`@sentry/react` + `@sentry/capacitor`) com `beforeSend` removendo PII (email, name, observation, request body) — só ativa em PROD ✅
- [x] Configurar `VITE_SENTRY_DSN` no `.env.example` + workflow secrets ✅
- [x] Setup CI docs — `docs/play-store/ci-setup.md` com lista completa secrets necessários ✅
- [x] Whatsnew template — `docs/play-store/whatsnew/whatsnew-pt-BR` (≤500 chars) ✅
- [ ] Monitorar Android Vitals e crashes na primeira semana ← manual pós-launch
- [ ] Responder primeiros reviews ← manual pós-launch
