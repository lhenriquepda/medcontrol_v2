# Dosy — Security Audit & Encryption Status

> Última auditoria: Abril 2026 — pós-Beta v1.0.1.
> Próxima revisão: antes do submit Play Store production.

---

## 🔒 Status de criptografia (resposta direta)

| Camada | Criptografado? | Como |
|---|---|---|
| **Em trânsito** (cliente ↔ Supabase) | ✅ Sim | TLS 1.3 (HTTPS obrigatório, SSL pinning Android) |
| **Em trânsito** (FCM, Edge Functions) | ✅ Sim | TLS 1.3 |
| **Em repouso no servidor** (Postgres) | ✅ Sim | AES-256 gerenciado pela AWS (Supabase platform) |
| **Auth tokens no Android** | ✅ Sim | Android KeyStore (AES-256-GCM via `EncryptedSharedPreferences`) — `@aparajita/capacitor-secure-storage` |
| **Auth tokens na web** | ⚠️ Não | localStorage padrão (browser sandbox isola por origem, mas não criptografa) |
| **Cache TanStack Query (web + native)** | ⚠️ Não | localStorage — contém doses, pacientes, etc. |
| **`localStorage 'medcontrol_notif'`** | ⚠️ Não | Cache de prefs (não-sensível) |
| **PWA Service Worker cache** | ⚠️ Não | CacheStorage (cross-origin bypass aplicado em SW v5) |
| **Colunas DB com PII** (medName, observation, patientName) | ⚠️ Plain text | Confiamos em encryption-at-rest da plataforma + RLS |
| **Backup Android (ADB / device-to-device)** | ✅ Bloqueado | `allowBackup="false"` + `data_extraction_rules.xml` |

**Resumo honesto:** dados em trânsito + em repouso no servidor estão criptografados. Tokens de auth no Android estão em KeyStore. Conteúdo de medicação na DB é plain text (mas isolado por RLS + encryption-at-rest da AWS). Web localStorage é o ponto mais fraco — nada crítico além de auth tokens (que rotacionam a cada hora).

---

## 🚨 Vulnerabilidades encontradas (Abril 2026)

### CRÍTICO — Senha postgres vazada em git

**Achado:** 13 scripts em `tools/*.cjs` continham `postgresql://postgres:xoeDZAnfn8TvBD5m@...` hardcoded. Commits `2119b45`, `766c24e` em git history.

**Impacto:** acesso role `postgres` = superuser DB. Bypassa RLS, todas as RPCs SECURITY DEFINER, pode ler/escrever qualquer tabela incluindo `auth.users` (senhas hashadas mas exposta superficie).

**Remediação aplicada:**
- ✅ Refactor 13 scripts para `process.env.DOSY_DB_URL`
- ✅ `LEGACY_KP_DB_URL` env var pra kids-paint password também removido

**Ação MANUAL pendente (URGENTE):**
1. Supabase Dashboard → Project `dosy-app` → Settings → Database → **Reset database password**
2. Anotar nova senha em gerenciador (1Password / Bitwarden / KeePass)
3. (Opcional, low-prio) Re-escrever git history com `git filter-repo --path-glob 'tools/*.cjs' --invert-paths` — perde scripts antigos mas remove senha do histórico permanente. Como repo é privado e single-dev, é aceitável skipar.

---

### ALTO — `INFOS.md` no disco com secrets plain text

**Achado:** arquivo `INFOS.md` na raiz do projeto com:
- VAPID private key
- Supabase Personal Access Token
- Database passwords (antiga + nova)

**Impacto:** se backup do disco / OneDrive / nuvem for comprometido = secrets vazam.

**Remediação aplicada:**
- ✅ `INFOS.md` no `.gitignore` (não commita)
- ✅ Secrets agora em env vars

**Ação MANUAL pendente:**
1. Mover conteúdo do `INFOS.md` pra cofre criptografado (1Password / Bitwarden vault)
2. **Deletar arquivo do disco** (`Remove-Item INFOS.md`)
3. Esvaziar lixeira

---

### ALTO — PAT kids-paint ainda ativo

**Achado:** PAT `sbp_aedc82d7...` foi gerado pra migração one-shot de kids-paint → dosy-app. Já não é usado.

**Remediação MANUAL:**
1. Login em conta dona kids-paint: https://supabase.com/dashboard/account/tokens
2. Revogar token "Migration kids-paint to dosy-app"

---

### MÉDIO — AdMob test ID em produção

**Achado:** `AndroidManifest.xml` usa `ca-app-pub-3940256099942544~3347511713` (Google test ID).

**Impacto:** anúncios fake em produção = zero receita.

**Remediação:**
1. Criar conta AdMob (https://admob.google.com)
2. Registrar app `com.dosyapp.dosy`
3. Substituir test ID pelo real ID na manifest + `VITE_ADMOB_BANNER_ANDROID`

---

### BAIXO — Anon key no JS bundle

**Achado:** `VITE_SUPABASE_ANON_KEY` aparece no bundle JS público.

**Status:** ✅ **Padrão Supabase aceito.** Anon key é desenhada pra ser pública. Segurança vem de RLS + RPCs server-side (verificação ownership antes de qualquer escrita).

**Sem ação necessária.**

---

### BAIXO — Console logs em produção

**Achado:** Logs verbosos `console.log` em `usePushNotifications.js`, `App.jsx`, etc. Visíveis no logcat Android.

**Impacto:** info técnica (UUIDs, tokens preview) exposta em logs do device. Atacante com root pode ver.

**Remediação proposta:**
- Vite plugin `vite-plugin-remove-console` em build PROD
- Ou wrapper `log()` que checa `import.meta.env.PROD`

**Não-bloqueante.**

---

## 🛡️ Camadas de defesa ativas

### 1. Autenticação
- ✅ Supabase Auth email/senha (bcrypt)
- ✅ JWT com expiração 1h + refresh token
- ✅ `mailer_autoconfirm=false` — confirmação email obrigatória
- ✅ Senha forte exigida (8+ chars, maiúscula, número)
- ✅ Rate limiting Auth: `rate_limit_otp=5`, `rate_limit_anonymous_users=30`

### 2. Autorização
- ✅ **RLS em todas as 11 tabelas** schema `medcontrol`
- ✅ Policies por `auth.uid()` + `has_patient_access()` (compartilhamento)
- ✅ **22 RPCs SECURITY DEFINER** — toda mutação crítica passa por server-side state machine (`confirm_dose`, `skip_dose`, `register_sos_dose`, `create_treatment_with_doses`, `delete_my_account`, `admin_grant_tier`)
- ✅ Trigger `enforce_sos_via_rpc_trigger` — bloqueia INSERT direto em `doses` com type=sos
- ✅ Trigger `enforce_patient_limit_trigger` — limite Free 1 paciente
- ✅ Admin via tabela `admins` (sem hardcoded email)

### 3. Network
- ✅ HTTPS obrigatório (CSP `default-src 'self'`)
- ✅ SSL Pinning Android (`network_security_config.xml` — pins SHA-256 SPKI Supabase)
- ✅ `cleartextTrafficPermitted="false"`

### 4. Storage
- ✅ Android KeyStore para auth tokens (SecureStorage)
- ✅ ADB backup bloqueado (`allowBackup="false"`)
- ✅ Modo demo usa `sessionStorage` (não persiste cross-session)
- ✅ Logout limpa `localStorage.removeItem('medcontrol_notif', 'dashCollapsed')`

### 5. Permissões Android
- ✅ Princípio menor privilégio: só permissões necessárias
- ✅ User grant explícito Android 14+ (USE_FULL_SCREEN_INTENT, SYSTEM_ALERT_WINDOW, POST_NOTIFICATIONS)
- ✅ Onboarding guiado pra cada permissão

### 6. LGPD
- ✅ Consentimento explícito no cadastro (checkbox bloqueante + log `subscriptions.consentAt`)
- ✅ Política Privacidade `/privacidade` (rota pública)
- ✅ Termos Uso `/termos` (rota pública)
- ✅ Direito de Acesso (Art. 18) — botão "Exportar dados" em Settings
- ✅ Direito ao Esquecimento (Art. 18 VI) — RPC `delete_my_account` + Edge Function
- ✅ Anonimização automática `pg_cron` (doses +3 anos → observation anonymized)
- ✅ Data Minimization — `observation` CHECK length ≤ 500
- ✅ Logs auditoria — `security_events` table (login, tier change, account delete)
- ✅ RIPD documentado — `docs/RIPD.md`

### 7. Input/XSS
- ✅ React JSX auto-escape (default safe)
- ✅ `escapeHtml()` em PDF render (`utils/sanitize.js` — Reports.jsx)
- ✅ Inputs validados client (validatePassword) + server (RPC checks)
- ✅ Sem `dangerouslySetInnerHTML` em produção

---

## 🧰 Refactor — análise de hotspots

### Arquivos que precisam refactor (priorizado)

| Arquivo | Problema | Severidade | Esforço |
|---|---|---|---|
| `src/hooks/usePushNotifications.js` (~470 linhas) | God-hook: FCM register + LocalNotif + CriticalAlarm + scheduling + DB persistence misturados | Alto | 1-2 dias |
| `src/pages/Settings.jsx` (~390 linhas) | Múltiplas responsabilidades: theme, notif, name, export, delete account, permissions | Médio | 4-6h |
| `src/pages/Dashboard.jsx` (~250 linhas) | Lots of state + queries + effects, podia extrair `useDashboardStats()`, `useDoseQueue()` hooks | Médio | 3-4h |
| `src/services/dosesService.js` | Mistura listDoses (com paginação loop) + RPC wrappers + mock fallback. Splittable. | Baixo | 2h |
| `tools/*.cjs` | 16 scripts, padrão repetitivo. Extrair `tools/_db.cjs` shared helper. | Baixo | 1h (já parcial — env vars feito) |
| `android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/AlarmActivity.java` (~400 linhas) | Layout em código Java verbose. XML layout file seria mais idiomático. | Baixo | 4h |

### Refactors aplicados nesta auditoria
- ✅ `tools/*.cjs` — 14 scripts movidos pra env vars (`DOSY_DB_URL`, `LEGACY_KP_DB_URL`)
- ✅ `tools/migrate-kp-to-dosy.cjs` — PATs via env (`SRC_PAT`, `DST_PAT`)

### Refactors recomendados (futuro)

**P1 — usePushNotifications split:**
- `src/services/notifications/fcm.js` — FCM register + listeners
- `src/services/notifications/local.js` — LocalNotifications scheduling
- `src/services/notifications/critical.js` — CriticalAlarm scheduling
- `src/hooks/useNotifications.js` — thin orchestration layer

**P2 — Dashboard hooks extraction:**
- `useDashboardStats(filters)` — pendingToday, overdueNow, adherence
- `useDoseQueue(searchParams)` — modal queue logic
- `useContinuousExtension()` — auto-extend RPC trigger

**P3 — Settings sections:**
- `Settings/AppearanceSection.jsx`
- `Settings/NotificationsSection.jsx`
- `Settings/AccountSection.jsx`
- `Settings/DataPrivacySection.jsx`

---

## ✅ Plano de remediação — checklist

### Imediato (esta semana)
- [ ] **Rotacionar senha postgres** Supabase Dashboard `dosy-app`
- [ ] **Mover INFOS.md** pra cofre criptografado + deletar do disco
- [ ] **Revogar PAT kids-paint** (`sbp_aedc82d7...`)
- [x] Refatorar tools/*.cjs com env vars
- [x] Documentar audit em SECURITY.md

### Antes de Play Store production
- [ ] Substituir AdMob test ID por real ID
- [ ] Configurar `VITE_SENTRY_DSN` real (criar projeto sentry.io)
- [ ] Escanear dependências: `npm audit fix` (atualmente 2 moderate severities)
- [ ] Rotacionar VAPID keys (descartar antigas do kids-paint)
- [ ] Pen test simples (Burp Suite ou OWASP ZAP) contra `/rest/v1/*` endpoints
- [ ] Adicionar `vite-plugin-remove-console` no build PROD
- [ ] Remover `supabase.exe` do `tools/` (já gitignored, deletar localmente)

### Long-term (P2+)
- [ ] Application-level encryption pra `doses.observation` (AES-GCM client-side com chave derivada de senha — opcional, alto custo dev)
- [ ] CSP nonce-based (eliminar `'unsafe-inline'` em script-src)
- [ ] HSTS preload + Expect-CT
- [ ] Subresource Integrity (SRI) em scripts externos AdSense/Google Fonts

---

## 📞 Reportar vulnerabilidade

Encontrou problema de segurança? Não abra issue público — manda email pra `dosy.med@gmail.com` com:
- Descrição do problema
- Passos reprodução
- Impacto estimado
- Sua sugestão de fix (opcional)

Resposta < 48h. Disclosure coordenado se aplicável.
