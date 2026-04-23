# MedControl v1.0 — Contexto Completo do Projeto

> Documento para onboarding de IA. Leia do início ao fim antes de tocar em qualquer código.

---

## 1. O que é o projeto

PWA mobile-first de **gestão de medicamentos** em pt-BR. O usuário cadastra **pacientes** (ex: filhos, familiares, ele mesmo), cria **tratamentos** por medicamento, e acompanha **doses** agendadas no dashboard diário. Inclui modo SOS para doses de resgate, análises de adesão, exportação de relatórios e sistema de assinaturas Free/PRO/Admin.

**Repositório:** https://github.com/lhenriquepda/medcontrol_v2  
**Deploy (Vercel):** https://medcontrolv2-three.vercel.app  
**Dev local:** `npm start` em `G:/00_Trabalho/01_Pessoal/Apps/medcontrol_v2`

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| UI | React 19 + Vite 5 + Tailwind 3 (darkMode: 'class') |
| Roteamento | React Router DOM v6 |
| Estado servidor | TanStack React Query v5 |
| Backend | Supabase (projeto `oubmmyitpahbcsjrhcxr`, nome `kids-paint`) |
| Schema DB | `medcontrol` (dedicado, isolado do schema `public` do kids-paint) |
| Auth | Supabase Auth com email/senha + metadata (name) |
| Realtime | Supabase Realtime (postgres_changes) |
| Deploy | Vercel (CI via GitHub push automático) |
| PWA | manifest.webmanifest + sw.js na raiz |
| Monetização | Estrutura Free/PRO/Admin — pagamento "em breve" |
| Anúncios | Google AdSense (espaço reservado, ativado via env vars) |

---

## 3. Variáveis de ambiente

### `.env` local (NÃO commitado — criar manualmente):
```
VITE_SUPABASE_URL=https://oubmmyitpahbcsjrhcxr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_5b24Pif5mVp23rBsLhhDWg_2NhKVrJp
VITE_SUPABASE_SCHEMA=medcontrol

# AdSense (opcional — deixe vazio em dev pra ver placeholder)
VITE_ADSENSE_CLIENT=
VITE_ADSENSE_SLOT=
```

### Vercel production (já configurado):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SCHEMA` — valores iguais ao .env.

---

## 4. Banco de dados Supabase

**Projeto:** `oubmmyitpahbcsjrhcxr` (compartilhado com app `kids-paint`, mas schema separado)

### Schema `medcontrol` — tabelas:

```
patients            — pacientes (id, "userId", name, age, avatar, photo_url, weight, condition, doctor, allergies)
treatments          — tratamentos (id, "userId", "patientId", "medName", unit, "intervalHours", "durationDays", "startDate", "firstDoseTime", status, "isTemplate")
doses               — doses (id, "userId", "treatmentId", "patientId", "medName", unit, "scheduledAt", "actualTime", status, type, observation)
sos_rules           — regras SOS (id, "userId", "patientId", "medName", "minIntervalHours", "maxDosesIn24h")
treatment_templates — modelos de tratamento por usuário
subscriptions       — planos (id="userId", tier, "expiresAt", source)
admin_users_view    — view (SECURITY INVOKER, problema: substituída por RPC)
```

> **ATENÇÃO colunascase**: todas colunas camelCase estão entre aspas no DDL: `"userId"`, `"createdAt"`, `"scheduledAt"`, etc. Não remover aspas.

### RLS:
Todas as tabelas têm policies `own_select/insert/update/delete` por `"userId" = auth.uid()`.

### Funções (SECURITY DEFINER):
```sql
medcontrol.admin_email()         — retorna 'lhenrique.pda@gmail.com' hardcoded
medcontrol.is_admin()            — true se auth.uid() é o admin_email
medcontrol.effective_tier(uid)   — 'admin'|'pro'|'free' respeitando expiresAt
medcontrol.my_tier()             — atalho: effective_tier(auth.uid())
medcontrol.admin_grant_tier(target_user, new_tier, expires, src) — muda tier
medcontrol.admin_list_users()    — lista todos usuários (bypass RLS auth.users)
medcontrol.enforce_patient_limit() — trigger: bloqueia >1 paciente no free
medcontrol.on_new_user_subscription() — trigger: cria subscription ao criar user
```

### Triggers:
```
public.auto_confirm_email_trigger     → BEFORE INSERT on auth.users → auto-confirma email (sem verificação)
medcontrol.on_new_user_subscription_trigger → AFTER INSERT on auth.users → cria subscription free (ou admin se email = admin_email)
medcontrol.enforce_patient_limit_trigger    → BEFORE INSERT on medcontrol.patients → bloqueia free >1 paciente
```

### Realtime:
Todas as 6 tabelas de medcontrol estão na `supabase_realtime` publication.

### Migrations aplicadas (ordem):
1. `medcontrol_init` — schema + 5 tabelas + RLS
2. `auto_confirm_emails_v2` — trigger auto-confirm
3. `subscriptions_and_admin` — subscriptions, tier functions, admin RPC, view
4. `enforce_free_limits` — trigger limite paciente free
5. `enable_realtime_medcontrol` — publicação realtime
6. `admin_list_users_rpc` — RPC SECURITY DEFINER para listar usuários (corrige RLS da view)

---

## 5. Arquitetura frontend

### Estrutura de pastas:
```
src/
  components/       — componentes reutilizáveis
  hooks/            — lógica de estado e queries
  pages/            — páginas (rotas)
  services/         — acesso a dados (Supabase ou mockStore)
  utils/            — helpers (dates, userDisplay, generateDoses)
```

### Modo dual (Supabase vs Mock):
`hasSupabase = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)`

- **Com Supabase:** dados no banco, RLS, auth real.
- **Sem Supabase (demo):** `mockStore.js` simula tudo em `localStorage` com dados seed.

Todos os services verificam `hasSupabase` e desviam para `mock.*` se false.

### QueryClient (main.jsx):
```js
staleTime: 0
refetchOnMount: 'always'
refetchOnWindowFocus: true
refetchOnReconnect: true
retry: 1
```
Dados sempre frescos ao navegar entre abas.

### Realtime (useRealtime.js):
Ativado em `App.jsx` via `useRealtime()`. Subscreve `postgres_changes` em todas tabelas → `qc.invalidateQueries()` automático. UI atualiza instantaneamente após qualquer mutação.

---

## 6. Componentes importantes

| Arquivo | Descrição |
|---|---|
| `BottomSheet.jsx` | Modal deslizante — usa `createPortal(…, document.body)` para escapar de stacking context criado por sticky+backdrop-blur |
| `PaywallModal.jsx` | Bottom sheet de upgrade PRO. Props: `open`, `onClose`, `reason` |
| `LockedOverlay.jsx` | Wrapper PRO-gate: blur+opacity para free, botão 🔒 → abre PaywallModal. Passa `children` normalmente para PRO |
| `TierBadge.jsx` | Chip FREE/PRO/ADMIN colorido, lê `useMyTier()` |
| `AdBanner.jsx` | Banner AdSense discreto, invisível para PRO, placeholder em dev |
| `FilterBar.jsx` | Redesenhado: segmented control de período + botão ⚙ com badge → BottomSheet de filtros (Paciente / Status / Tipo) |
| `Logo.jsx` | Logo SVG do app |

---

## 7. Hooks principais

| Hook | Descrição |
|---|---|
| `useAuth` | user, loading, signInEmail, signUpEmail(email,pass,name), signInGoogle, signInDemo, signOut, updateProfile({name}), hasSupabase |
| `useMyTier` | query `my_tier` RPC → 'free'\|'pro'\|'admin'. staleTime 60s |
| `useIsPro` | derived: tier === 'pro' \|\| 'admin' |
| `useIsAdmin` | derived: tier === 'admin' |
| `usePatientLimitReached` | free + patients.length >= FREE_PATIENT_LIMIT (=1) |
| `useRealtime` | Supabase realtime subscriptions → invalidate queries |
| `usePatients / useCreatePatient / useUpdatePatient / useDeletePatient` | CRUD patients |
| `useTreatments / useCreateTreatment / useDeleteTreatment` | CRUD treatments |
| `useDoses / useConfirmDose / useSkipDose / useUndoDose` | CRUD doses, refetchInterval 60s |

---

## 8. Gating Free/PRO

### Plano FREE:
- Máximo **1 paciente** (bloqueado server-side pelo trigger `enforce_patient_limit` + client-side em `PatientForm`)
- **Analytics** (`/relatorios-analise`): conteúdo bloqueado com `LockedOverlay` mostrando prévia borrada
- **Relatórios** (`/relatorios`): botões Exportar PDF/CSV dim (opacity-60) + 🔒 → `PaywallModal`
- **More tab**: itens Análises e Relatórios com opacity-60, badge "🔒 PRO", clique interceptado → paywall
- **AdBanner** visível no Dashboard + aba Mais
- Erro server `PLANO_FREE_LIMITE_PACIENTES:` capturado em `patientsService.js` → `PatientLimitError` com `code='FREE_PATIENT_LIMIT'` → `PatientForm` abre paywall

### Plano PRO / Admin:
- Sem ads
- Acesso total a todas as features
- Admin tem acesso ao `/admin`

### PaywallModal:
6 features listadas: pacientes ilimitados, PDF/CSV, análises, resumo diário, backup, sem ads.  
Preços: R$7,90/mês · R$49,90/ano (-48%).  
Botão "Assinar PRO — em breve" (disabled — pagamento não implementado ainda).

---

## 9. Conta admin

**Email admin:** `lhenrique.pda@gmail.com`  
Hardcoded em `medcontrol.admin_email()` no banco.

Para mudar o admin: executar SQL:
```sql
create or replace function medcontrol.admin_email() returns text
language sql stable as $$ select 'novo@email.com'::text $$;
```

### Painel Admin (`/admin`):
- Lista todos usuários via `supabase.rpc('admin_list_users')`
- Mostra nome, email, contagem de pacientes/tratamentos, tier atual
- `GrantSheet`: cards visual Free/PRO/Admin + duração (Para sempre / N dias / Até data)
- Chama `supabase.rpc('admin_grant_tier', {target_user, new_tier, expires, src})`

---

## 10. Auth + perfil de usuário

### Signup:
`useAuth.signUpEmail(email, password, name)` — salva `name` em `user.user_metadata.name`.

### Display name:
`src/utils/userDisplay.js` — helpers `displayName(user)`, `firstName(user)`, `initial(user)`.  
Prioridade: `user_metadata.name → user.name → email.split('@')[0] → 'Usuário'`.

### Editar nome:
`useAuth.updateProfile({ name })` — chama `supabase.auth.updateUser({ data: { name } })`.  
UI: Settings (`/ajustes`) → seção Conta → campo "Seu nome" + botão Salvar.

---

## 11. Rotas

```
/                   Dashboard (doses do dia, stats, realtime)
/pacientes          Lista de pacientes com limite free
/pacientes/novo     Criar paciente (PatientForm)
/pacientes/:id      Detalhe do paciente
/pacientes/:id/editar  Editar paciente
/tratamento/novo    Criar tratamento com geração automática de doses
/tratamento/:id     Editar tratamento
/tratamentos        Lista de tratamentos (TreatmentList)
/sos                Registro dose de resgate (SOS)
/mais               Menu Mais (More)
/relatorios-analise Analytics (🔒 PRO)
/relatorios         Relatórios PDF/CSV (🔒 PRO — export locked)
/ajustes            Settings (tema, notificações, editar nome, sair)
/admin              Painel Admin (🔒 só isAdmin)
* → /              Redirect
```

---

## 12. Serviços de dados

### `supabase.js`
```js
createClient(URL, KEY, { auth: {...}, db: { schema: 'medcontrol' } })
traduzirErro(err) // mapeia erros inglês → português
```

### `patientsService.js`
`PatientLimitError` (class, `code='FREE_PATIENT_LIMIT'`) lançado quando trigger retorna `PLANO_FREE_LIMITE_PACIENTES`.

### `subscriptionService.js`
```js
getMyTier()          // rpc('my_tier') — retorna 'free'|'pro'|'admin'
listAllUsers()       // rpc('admin_list_users')
grantTier({userId, tier, expiresAt, source})  // rpc('admin_grant_tier')
FREE_PATIENT_LIMIT = 1
```

### `mockStore.js`
LocalStorage completo com seed de dados demo. Suporta userId-scoped filtering (simula RLS).
Funções: `signInLocal`, `signUpLocal(email, pass, name)`, `signInDemo`, `signOut`, `updateProfile`, `list/getById/insert/update/remove/removeWhere`.

---

## 13. Geração de doses

`src/utils/generateDoses.js` — dado um treatment (startDate, intervalHours, durationDays, firstDoseTime), gera array de doses agendadas.

`treatmentsService.createTreatmentWithDoses()` — cria treatment + batch insert de doses geradas.

---

## 14. Fluxo de deploy

```bash
# Deploy automático: git push
git add -A && git commit -m "mensagem" && git push origin master
# → Vercel detecta push → build automático → deploy em ~20s

# Deploy manual:
vercel --prod

# Adicionar env var nova:
vercel env add NOME_VAR production
# (depois redeploy)
```

---

## 15. O que NÃO está implementado (pendente)

- [ ] **Pagamento real** — botão "Assinar PRO" disabled. Precisaria RevenueCat (mobile) ou Stripe (web)
- [ ] **Google AdSense real** — slot reservado, precisa aprovar site no AdSense e preencher `VITE_ADSENSE_CLIENT` + `VITE_ADSENSE_SLOT`
- [ ] **Push notifications reais** — UI de configuração existe (Settings), mas envio server-side não implementado
- [ ] **Capacitor / APK Android** — não configurado. Para converter PWA em APK: `npm i @capacitor/core @capacitor/cli @capacitor/android`, `npx cap init`, `npx cap add android`, `npx cap sync`, build via Android Studio
- [ ] **Login com Google** — botão removido da UI; Supabase está configurado mas OAuth callback precisaria de domínio real
- [ ] **Resumo diário automático** — toggle existe em Settings, lógica de envio de notificação diária não implementada
- [ ] **Paginação de doses** — sem limite de resultados no período longo
- [ ] **Offline queue** — app requer conexão; mutações offline falham silenciosamente

---

## 16. Convenções do código

- Tailwind classes inline, sem CSS modules
- `camelCase` em nomes de variáveis JS, `"camelCase"` nas colunas SQL (aspas obrigatórias)
- React Query keys: `['patients']`, `['treatments', filter]`, `['doses', filter]`, `['my_tier']`, `['admin_users']`
- Invalidar sempre por prefixo: `qc.invalidateQueries({ queryKey: ['patients'] })` — propaga para todos subkeys
- BottomSheet sempre via `createPortal` para evitar stacking context bug
- Todos os formulários: loading state em `mutation.isPending`, erro via `useToast`
- Tier check: usar `useIsPro()` ou `useIsAdmin()` — nunca comparar string tier diretamente em componentes
- `displayName(user)` para mostrar nome — nunca `user.email` direto sem fallback

---

## 17. Usuários no banco (dev/test)

| Email | Tier | Obs |
|---|---|---|
| `lhenrique.pda@gmail.com` | admin | Conta do dono. Admin hardcoded. |
| `teste@teste.com` | free* | Conta de teste. Pode ter sido elevada a PRO via painel admin. |

*Verificar tier atual no painel admin antes de testar gating.

---

## 18. Problemas já resolvidos (não reinventar)

| Problema | Solução aplicada |
|---|---|
| Dados não atualizavam ao navegar | `staleTime: 0` + `refetchOnMount: 'always'` + `useRealtime()` |
| Modal cortado atrás do sticky header | `BottomSheet` usa `createPortal(…, document.body)` |
| Usuário free criava >1 paciente | Trigger server-side `enforce_patient_limit` + `PatientLimitError` no client |
| Admin não via outros usuários | View com `security_invoker=true` bloqueava RLS. Solução: RPC `admin_list_users` SECURITY DEFINER |
| Email duplicado não dava erro | Detectado via `identities.length === 0` no signup |
| Demo data vazando entre usuários | mockStore filtra por `userId` em todos métodos |
| Erros em inglês do Supabase | `traduzirErro()` em `supabase.js` mapeia para pt-BR |
| camelCase columns no `.order()` | Removido order server-side; sort client-side em todos services |
| Google OAuth sem domínio real | Botão removido da UI |
