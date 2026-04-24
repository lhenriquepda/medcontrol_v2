# Dosy — Contexto Completo do Projeto

> Documento para onboarding de IA. Leia do início ao fim antes de tocar em qualquer código.

---

## 1. O que é o projeto

PWA mobile-first de **gestão de medicamentos** em pt-BR, rebrandeado de MedControl para **Dosy**. O usuário cadastra **pacientes** (ex: filhos, familiares, ele mesmo), cria **tratamentos** por medicamento e acompanha **doses** agendadas no dashboard diário. Inclui modo SOS para doses de resgate, análises de adesão, exportação de relatórios, notificações push e sistema de assinaturas Free/PRO/Admin.

**Repositório:** https://github.com/lhenriquepda/medcontrol_v2
**Deploy (Vercel):** https://dosy-teal.vercel.app
**Vercel project:** `dosy` (em `lhenriquepdas-projects`)
**Dev local:** `npm run dev` em `G:/00_Trabalho/01_Pessoal/Apps/medcontrol_v2`

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| UI | React 19 + Vite 5 + Tailwind 3 (darkMode: 'class') |
| Roteamento | React Router DOM v6 |
| Estado servidor | TanStack React Query v5.99+ |
| Backend | Supabase (projeto `oubmmyitpahbcsjrhcxr`, nome `kids-paint`) |
| Schema DB | `medcontrol` (dedicado, isolado do schema `public`) |
| Auth | Supabase Auth com email/senha + metadata (name) |
| Realtime | Supabase Realtime (postgres_changes) |
| Push Notifications | Web Push API + VAPID + Supabase Edge Function |
| Service Worker | `public/sw.js` — cache network-first + scheduling local |
| Deploy | Vercel CLI (`vercel deploy --prod`) + GitHub push |
| PWA | manifest.webmanifest + ícones PNG na raiz |
| Monetização | Free/PRO/Admin — pagamento "em breve" |
| Anúncios | Google AdSense (espaço reservado) |

---

## 3. Variáveis de ambiente

### `.env` local (NÃO commitado — criar manualmente):
```
VITE_SUPABASE_URL=https://oubmmyitpahbcsjrhcxr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_5b24Pif5mVp23rBsLhhDWg_2NhKVrJp
VITE_SUPABASE_SCHEMA=medcontrol
VITE_VAPID_PUBLIC_KEY=BEIoP8V9460uEZZuR2DPDIuhCmeJeM44AwAWa5VFKseCAaqhnNgayDge4miebCKFwWvcCaUlLj5G_xkwsM9CbjA
```

### Vercel production (configurar no painel):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SCHEMA`, `VITE_VAPID_PUBLIC_KEY`

### Supabase Edge Function secrets (painel Supabase → Edge Functions → Secrets):
```
VAPID_PUBLIC_KEY=BEIoP8V9460uEZZuR2DPDIuhCmeJeM44AwAWa5VFKseCAaqhnNgayDge4miebCKFwWvcCaUlLj5G_xkwsM9CbjA
VAPID_PRIVATE_KEY=PR7ZLbquZGTBFIw3z12b9MbncImlXschupvapYt4xQQ
VAPID_SUBJECT=mailto:lhenrique.pda@gmail.com
```

---

## 4. Banco de dados Supabase

**Projeto:** `oubmmyitpahbcsjrhcxr` (compartilhado com app `kids-paint`, schema separado)

### Schema `medcontrol` — tabelas:

```
patients            — id, "userId", name, age, avatar, photo_url, weight, condition, doctor, allergies
treatments          — id, "userId", "patientId", "medName", unit, "intervalHours", "durationDays",
                      "startDate", "firstDoseTime", status, "isTemplate", "isContinuous"
doses               — id, "userId", "treatmentId", "patientId", "medName", unit,
                      "scheduledAt", "actualTime", status, type, observation
sos_rules           — id, "userId", "patientId", "medName", "minIntervalHours", "maxDosesIn24h"
treatment_templates — modelos de tratamento por usuário
subscriptions       — id="userId", tier, "expiresAt", source
push_subscriptions  — id, "userId", endpoint, keys (JSONB), "advanceMins", "userAgent"
```

> **ATENÇÃO colunas camelCase**: todas entre aspas no DDL (`"userId"`, `"scheduledAt"`, etc.). Não remover aspas.

### RLS:
Todas as tabelas têm policies `own_select/insert/update/delete` por `"userId" = auth.uid()`.

### Funções (SECURITY DEFINER):
```sql
medcontrol.admin_email()         — retorna 'lhenrique.pda@gmail.com' hardcoded
medcontrol.is_admin()            — true se auth.uid() é o admin_email
medcontrol.effective_tier(uid)   — 'admin'|'pro'|'free' respeitando expiresAt
medcontrol.my_tier()             — atalho: effective_tier(auth.uid())
medcontrol.admin_grant_tier(target_user, new_tier, expires, src)
medcontrol.admin_list_users()    — lista todos usuários (bypass RLS auth.users)
medcontrol.enforce_patient_limit() — trigger: bloqueia >1 paciente no free
medcontrol.on_new_user_subscription() — trigger: cria subscription ao criar user
```

### Triggers:
```
public.auto_confirm_email_trigger                → BEFORE INSERT on auth.users → auto-confirma email
medcontrol.on_new_user_subscription_trigger      → AFTER INSERT on auth.users → cria subscription free
medcontrol.enforce_patient_limit_trigger         → BEFORE INSERT on patients → bloqueia free >1 paciente
```

### Migrations aplicadas (ordem):
1. `medcontrol_init` — schema + tabelas + RLS
2. `auto_confirm_emails_v2` — trigger auto-confirm
3. `subscriptions_and_admin` — subscriptions, tier functions, admin RPC
4. `enforce_free_limits` — trigger limite paciente free
5. `enable_realtime_medcontrol` — publicação realtime
6. `admin_list_users_rpc` — RPC SECURITY DEFINER para listar usuários
7. `push_subscriptions` — tabela para Web Push subscriptions

---

## 5. Estrutura de arquivos

```
src/
├── main.jsx                  # Entry point: QueryClient, BrowserRouter, ToastProvider
├── App.jsx                   # Rotas + AppHeader global + BottomNav
│
├── pages/
│   ├── Login.jsx             # Auth: email/senha, criar conta, modo demo. Logo Dosy em dark navy
│   ├── Dashboard.jsx         # Tela inicial: doses agrupadas por paciente, stats, FilterBar
│   ├── Patients.jsx          # Lista de pacientes
│   ├── PatientForm.jsx       # Criar/editar paciente (nome, avatar emoji)
│   ├── PatientDetail.jsx     # Detalhe: tratamentos + histórico doses do paciente
│   ├── TreatmentForm.jsx     # Criar/editar tratamento com geração de doses
│   ├── TreatmentList.jsx     # Lista de tratamentos do usuário
│   ├── DoseHistory.jsx       # Histórico completo de doses com filtros
│   ├── SOS.jsx               # Dose extra fora do agendado, com regras de segurança
│   ├── Analytics.jsx         # Gráficos de adesão (PRO)
│   ├── Reports.jsx           # Exportar PDF/CSV — design Dosy branded (PRO)
│   ├── Settings.jsx          # Tema, push notifications, nome do usuário, logout
│   ├── More.jsx              # Hub de features extras, upgrade PRO
│   └── Admin.jsx             # Painel admin (tiers/usuários)
│
├── components/
│   ├── AppHeader.jsx         # Header GLOBAL sticky z-40 — visível em todas as telas autenticadas
│   │                         # Conteúdo: dosy-logo-light.png → "/", saudação + TierBadge,
│   │                         # badge "N atrasadas" (clica → "/?filter=overdue"), link Ajustes
│   ├── Header.jsx            # Header de página interna (título + botão voltar) — NÃO sticky
│   ├── BottomNav.jsx         # Navegação inferior fixa (5 abas)
│   ├── FilterBar.jsx         # Barra filtros Dashboard: segmented period + botão funil SVG
│   │                         # sticky top-[68px] z-20 (abaixo do AppHeader)
│   ├── DoseCard.jsx          # Card de dose individual (status, horário, ações)
│   ├── DoseModal.jsx         # Modal: confirmar/pular/desfazer dose. actualTime default = agora
│   ├── PatientCard.jsx       # Card de paciente na listagem
│   ├── TierBadge.jsx         # Chip FREE/PRO/ADMIN inline
│   ├── AdBanner.jsx          # Banner AdSense (só Free)
│   ├── PaywallModal.jsx      # Bottom sheet de upgrade PRO
│   ├── BottomSheet.jsx       # Sheet deslizante via createPortal (escapa stacking context)
│   ├── ConfirmDialog.jsx     # Dialog de confirmação genérico
│   ├── EmptyState.jsx        # Estado vazio com ícone + mensagem + ação
│   ├── Field.jsx             # Label + input wrapper — importado por TreatmentForm e SOS
│   ├── MedNameInput.jsx      # Input com autocomplete de medicamentos (data/medications.js)
│   ├── Skeleton.jsx          # Placeholders de loading (SkeletonList)
│   ├── LockedOverlay.jsx     # Blur + botão PRO gate para features bloqueadas
│   └── SharePatientSheet.jsx # Sheet de compartilhamento de paciente
│
├── hooks/
│   ├── useAuth.jsx           # user, loading, signInEmail, signUpEmail, signInDemo,
│   │                         # signOut, updateProfile({name}), hasSupabase
│   ├── useDoses.js           # useDoses, useConfirmDose, useSkipDose, useUndoDose,
│   │                         # useRegisterSos, useSosRules, useUpsertSosRule
│   ├── usePatients.js        # usePatients, useCreatePatient, useUpdatePatient, useDeletePatient
│   ├── useTreatments.js      # useTreatments, useCreateTreatment, useUpdateTreatment,
│   │                         # useDeleteTreatment, useTreatment, useTemplates, useCreateTemplate
│   ├── useSubscription.js    # useMyTier, useIsPro, useIsAdmin, usePatientLimitReached
│   ├── usePushNotifications.js # subscribe(advanceMins), unsubscribe, scheduleDoses(doses)
│   │                           # state: supported, permState, subscribed, loading
│   ├── useRealtime.js        # Supabase Realtime → invalidate queries automático
│   ├── useShares.js          # Compartilhamento de pacientes entre usuários
│   ├── useTheme.jsx          # Dark/light mode: localStorage + class no <html>
│   └── useToast.jsx          # Toasts (success/error/warn/info), toast.show({message, kind})
│
├── services/
│   ├── supabase.js           # createClient, hasSupabase, traduzirErro(err)
│   ├── dosesService.js       # listDoses, confirmDose, skipDose, undoDose,
│   │                         # registerSos, listSosRules, upsertSosRule, validateSos
│   ├── treatmentsService.js  # CONTINUOUS_DAYS (exportado), createTreatmentWithDoses,
│   │                         # updateTreatment, listTreatments, deleteTreatment, etc.
│   ├── patientsService.js    # CRUD pacientes, PatientLimitError
│   ├── subscriptionService.js# getMyTier, listAllUsers, grantTier, FREE_PATIENT_LIMIT
│   ├── sharesService.js      # Lógica compartilhamento de pacientes
│   └── mockStore.js          # Store localStorage para modo demo (sem Supabase)
│
├── utils/
│   ├── dateUtils.js          # formatDate, formatTime, formatDateTime, rangeNow, pad,
│   │                         # toDatetimeLocalInput, fromDatetimeLocalInput
│   ├── generateDoses.js      # Algoritmo geração de doses a partir de um tratamento
│   ├── statusUtils.js        # STATUS_CONFIG (done/skipped/overdue/pending), statusLabel()
│   ├── tierUtils.js          # TIER_LABELS, TIER_COLORS_SUBTLE (usado em Admin),
│   │                         # TIER_COLORS_BOLD (usado em More, TierBadge)
│   └── userDisplay.js        # firstName(user), displayName(user), initial(user)
│
└── data/
    └── medications.js        # Lista de medicamentos comuns para autocomplete

public/
├── sw.js                     # Service Worker (cache v5, push, scheduling)
├── manifest.webmanifest      # PWA manifest — name:"Dosy", ícones PNG only
├── dosy-logo.png             # Logo para fundos claros
├── dosy-logo-light.png       # Logo para fundos escuros (AppHeader, Login, PDF relatório)
├── icon-192.png              # Ícone PWA 192×192 (Dosy branded)
├── icon-512.png              # Ícone PWA 512×512 (Dosy branded)
├── apple-touch-icon.png      # Ícone iOS (Dosy branded)
└── favicon-64.png            # Favicon browser (Dosy branded)

supabase/
└── functions/
    └── notify-doses/
        └── index.ts          # Edge Function Deno: push server-side para doses próximas
                              # usa npm:web-push, lê push_subscriptions, deleta endpoints 410

```

---

## 6. Funcionalidades detalhadas

### Pacientes
- Cadastrar com nome e avatar emoji
- Cada usuário gerencia seus próprios pacientes (RLS)
- Free: máximo 1 paciente (trigger server-side + PaywallModal client)

### Tratamentos
- Medicamento, dose (unit), intervalo, horários múltiplos por dia, data início, duração
- **Uso contínuo** (`isContinuous`): sem data de fim — gera `CONTINUOUS_DAYS = 90` dias de doses
- Intervalos: 4h / 6h / 8h / 12h / 1x/dia / 2 em 2 dias / 3 em 3 dias / **1x/semana** / **quinzenal** / **1x/mês**
- Templates salvos para reutilizar configurações
- Editar tratamento regenera doses futuras

### Doses — ciclo de vida
```
pending → done    (confirmar — registra actualTime, padrão = agora)
pending → skipped (pular — observação opcional)
done/skipped → pending (desfazer)
overdue           (scheduledAt no passado + status pending → calculado)
```

- Listagem por período: 12h / 24h / 48h / 7d / tudo
- Filtros: status, tipo (agendada/SOS), paciente
- **Optimistic update**: UI atualiza imediatamente via `patchDoseInCache`, rollback em erro
- **Realtime sync**: `refetchDoses()` após cada mutação (não `invalidateQueries`, ver §Decisões)

### SOS
- Dose extra fora do agendamento normal
- Regras de segurança por medicamento (intervalo mínimo, máx/24h)
- `validateSos()` valida client-side antes de registrar

### Dashboard
- Stats: pendentes hoje, % adesão 7 dias, atrasadas (últimos 30 dias)
- Doses agrupadas por paciente, colapsáveis (estado salvo em localStorage)
- Badge "N atrasadas" no **AppHeader** — clica → navega para `/?filter=overdue`
- Dashboard lê `?filter=overdue` via `useSearchParams` e aplica filtro. Funciona mesmo quando já está na tela (useEffect observa searchParams, não initializer de useState)
- FilterBar sticky abaixo do AppHeader (top-[68px])

### Notificações Push
- Subscribe: `Notification.requestPermission()` → `PushManager.subscribe(VAPID)` → salva em `push_subscriptions`
- Scheduling local: SW recebe `SCHEDULE_DOSES` e agenda `setTimeout` para cada dose nas próximas 24h
- Notificação local: mostra ações ✅ Tomei / ⏰ 15min snooze
- Push server-side: Edge Function `notify-doses` consulta `push_subscriptions` + doses próximas e envia via `web-push`
- **ATENÇÃO**: Edge Function não é chamada automaticamente — precisa cron externo (cron-job.org) a cada 5 min
- Antecedência configurável em Settings: na hora / 5 / 10 / 15 / 30 min / 1h

### Relatórios (PRO)
- **PDF**: abre janela de impressão. Header dark navy + `dosy-logo-light.png` (URL absoluta via `window.location.origin`). Barra de stats (total, adesão%, puladas, atrasadas). Tabela com coluna **Paciente** quando filtrando "Todos". Badges de status coloridos. `print-color-adjust: exact` em todos elementos com background.
- **CSV**: UTF-8 BOM, todos os campos, inclui Paciente
- Preview in-app: lista de doses com nome do medicamento + paciente inline + adesão %

### Branding Dosy
- Logo principal: `dosy-logo-light.png` — usada em AppHeader (dark), Login (dark), PDF (dark)
- Logo alternativa: `dosy-logo.png` — para fundos claros (se necessário no futuro)
- Cor primária header: `#0d1535` (dark navy) — sempre, independente do tema
- Ícones PWA: todos PNG Dosy branded, sem `icon.svg` (removido)

---

## 7. AppHeader (componente global)

```jsx
// Renderizado em App.jsx para todos os usuários autenticados, ANTES das Routes
<AppHeader />   // sticky top-0 z-40 bg-[#0d1535]
<div className="min-h-screen">
  <Routes>...</Routes>
  <BottomNav />
</div>
```

- Logo (`dosy-logo-light.png`) clicável → `"/"`
- Saudação (Bom dia/tarde/noite + `firstName(user)`) + `<TierBadge />`
- Badge de doses atrasadas (pisca, `animate-pulse`) — clica → `nav('/?filter=overdue')`
- Link ajustes → `"/ajustes"` (ícone `⚙`)
- `Header.jsx` (páginas internas) **não é sticky** — foi removido sticky para não colidir com AppHeader

---

## 8. Service Worker (`public/sw.js`)

**Cache version:** `medcontrol-v5`

```
install  → caches ['/', '/index.html', '/manifest.webmanifest']
activate → deleta caches antigos, clients.claim()
fetch    → cross-origin? return (nunca cacheia Supabase/CDN)
           navegação? network-first com fallback para cache
           asset? stale-while-revalidate
push     → mostra notificação (title, body, icon, actions: Tomei / 15min)
notificationclick → snooze: setTimeout 15min → nova notificação
                    ação padrão: abre app
message  → SCHEDULE_DOSES: agenda setTimeout por dose (próximas 24h)
           CLEAR_SCHEDULE: limpa todos os timers
```

**Por que `cross-origin return`?** Sem este bypass, o SW cacheava respostas GET do Supabase (stale-while-revalidate). Após confirmar uma dose, o app recebia a resposta cacheada e não o dado atualizado. Funcionava no browser (SW dev desativado) mas falhava no mobile (SW instalado interceptava). Fix adicionado na versão v5.

---

## 9. TanStack React Query — padrões usados

### QueryClient (main.jsx):
```js
staleTime: 0
refetchOnMount: 'always'
refetchOnWindowFocus: true
refetchOnReconnect: true
retry: 1
```

### Query keys:
```
['patients']
['treatments', filter]
['doses', filter]          // filter é object memoizado com useMemo no Dashboard
['sos_rules', patientId]
['my_tier']
['admin_users']
```

### Optimistic update de doses:
```js
onMutate: async ({ id, ... }) => {
  await qc.cancelQueries({ queryKey: ['doses'] })
  const snapshots = patchDoseInCache(qc, id, { status: 'done', ... })
  return { snapshots }
},
onError: (_e, _v, ctx) => rollback(qc, ctx?.snapshots),
onSettled: () => refetchDoses(qc)   // força refetch imediato (não invalidate lazy)
```

### Por que `getQueryCache().findAll()` e não `setQueriesData()`?
TanStack Query v5 tem matching parcial de queryKey inconsistente em `setQueriesData`. Usar `getQueryCache().findAll({ queryKey: ['doses'] })` + loop manual é mais confiável para patchear todos os caches de doses ativos (há múltiplas queries com filtros diferentes, todas precisam ser atualizadas).

### Por que `refetchQueries` e não `invalidateQueries`?
`invalidateQueries` marca como stale mas o refetch só acontece quando o componente está montado e focado (lazy). `refetchQueries` força refetch imediato, garantindo que a UI mobile veja o estado atualizado sem precisar sair e voltar da tela.

---

## 10. Constantes importantes

| Constante | Arquivo | Valor | Descrição |
|---|---|---|---|
| `CONTINUOUS_DAYS` | `treatmentsService.js` (**exportada**) | `90` | Dias gerados para uso contínuo. Importar daqui, não redeclarar. |
| `refetchInterval` | `useDoses.js` | `60_000` ms | Refetch automático de doses a cada minuto |
| `MS_IN_24H` | `usePushNotifications.js` | `86_400_000` ms | Janela de scheduling local de notificações |
| `NOTIF_KEY` | `usePushNotifications.js` + `Settings.jsx` | `'medcontrol_notif'` | Chave localStorage preferências notificação |
| `CACHE` | `sw.js` | `'medcontrol-v5'` | Versão do cache SW — incrementar para forçar update |
| `FREE_PATIENT_LIMIT` | `subscriptionService.js` | `1` | Máximo de pacientes no plano free |

---

## 11. Rotas

```
/                     Dashboard (doses do dia, stats, realtime)
/pacientes            Lista de pacientes
/pacientes/novo       Criar paciente
/pacientes/:id        Detalhe do paciente
/pacientes/:id/editar Editar paciente
/tratamento/novo      Criar tratamento (?patientId=... para pré-selecionar)
/tratamento/:id       Editar tratamento
/tratamentos          Lista de tratamentos
/sos                  Dose SOS (resgate)
/mais                 Menu Mais
/historico            Histórico de doses
/relatorios-analise   Analytics (PRO)
/relatorios           Relatórios PDF/CSV (PRO)
/ajustes              Settings
/admin                Painel Admin (isAdmin only)
*                     → redirect para /
```

---

## 12. Gating Free/PRO

### Free:
- Máximo 1 paciente (trigger server-side + `PatientLimitError` client)
- Analytics: `LockedOverlay` com prévia borrada
- Relatórios: botões dim + paywall
- AdBanner visível

### PRO/Admin:
- Sem ads, acesso total
- Admin: acesso a `/admin`

### PaywallModal:
6 features, preços R$7,90/mês · R$49,90/ano. Botão disabled (pagamento não implementado).

---

## 13. Auth + perfil

- `signUpEmail(email, password, name)` → salva name em `user_metadata.name`
- `updateProfile({ name })` → `supabase.auth.updateUser({ data: { name } })`
- `displayName(user)` → `user_metadata.name || user.name || email.split('@')[0] || 'Usuário'`
- Auto-confirm de email via trigger (sem verificação de email)
- Modo demo: `signInDemo()` → usuário fake em mockStore

---

## 14. Modo dual (Supabase vs Mock)

`hasSupabase = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)`

- **Com Supabase:** dados no banco, RLS, auth real
- **Sem Supabase (demo):** `mockStore.js` simula tudo em localStorage com dados seed

Todos os services verificam `hasSupabase` e desviam para `mock.*` se false.

---

## 15. Deploy

```bash
# Build local:
npm run build

# Deploy manual para Vercel (projeto dosy):
vercel deploy --prod

# Push para GitHub (Vercel faz CI automático via GitHub):
git push
# Nota: o projeto Vercel "dosy" NÃO está configurado para CI via GitHub ainda.
# Deploy automático = vercel deploy --prod manualmente.

# Adicionar env var:
vercel env add NOME_VAR production
# (depois redeploy)
```

---

## 16. Conta admin

**Email:** `lhenrique.pda@gmail.com` (hardcoded em `medcontrol.admin_email()`)

Painel Admin (`/admin`): lista usuários, gerencia tiers via `admin_grant_tier` RPC.

Para mudar o admin:
```sql
create or replace function medcontrol.admin_email() returns text
language sql stable as $$ select 'novo@email.com'::text $$;
```

---

## 17. Convenções do código

- Tailwind classes inline, sem CSS modules
- `camelCase` em JS, `"camelCase"` nas colunas SQL (aspas obrigatórias)
- React Query keys: sempre array, primeiro elemento = tipo de entidade
- Invalidar por prefixo: `qc.invalidateQueries({ queryKey: ['patients'] })`
- `BottomSheet` sempre via `createPortal` (evita stacking context bug com sticky+backdrop-blur)
- Todos os forms: loading em `mutation.isPending`, erro via `useToast`
- Tier check: `useIsPro()` ou `useIsAdmin()` — nunca comparar string diretamente
- `displayName(user)` ou `firstName(user)` — nunca `user.email` direto sem fallback
- `CONTINUOUS_DAYS`: importar de `treatmentsService.js`, não redeclarar
- `Field` component: importar de `components/Field.jsx`, não redeclarar inline

---

## 18. Problemas já resolvidos (não reinventar)

| Problema | Solução |
|---|---|
| Status de dose não atualizava no mobile | SW cacheava Supabase API. Fix: `if (url.origin !== self.location.origin) return` no SW fetch handler (v5) |
| `patchDoseInCache` não patcheava todas queries | Trocar `setQueriesData` por `getQueryCache().findAll()` + loop manual |
| Dose não atualizava após mutação (lazy) | `refetchQueries` em vez de `invalidateQueries` no `onSettled` |
| Badge atrasadas não filtrava quando já na tela | useEffect observa `searchParams` (não useState initializer) |
| Modal cortado atrás de sticky header | `BottomSheet` usa `createPortal(…, document.body)` |
| Usuário free criava >1 paciente | Trigger `enforce_patient_limit` server-side + `PatientLimitError` client |
| Admin não via outros usuários | View com security_invoker bloqueava. Solução: RPC `admin_list_users` SECURITY DEFINER |
| Erros Supabase em inglês | `traduzirErro()` em `supabase.js` |
| Background do PDF some ao imprimir | `print-color-adjust: exact` em todos elementos com background |
| Logo some no PDF (janela nova) | URL absoluta: `window.location.origin + '/dosy-logo-light.png'` |
| `query` object instável como queryKey | `useMemo` no Dashboard para estabilizar o objeto |

---

## 19. O que NÃO está implementado (pendente)

- [ ] **Pagamento real** — botão "Assinar PRO" disabled. RevenueCat (mobile) ou Stripe (web)
- [ ] **Cron para push server-side** — Edge Function `notify-doses` existe mas precisa chamada externa a cada 5 min (cron-job.org ou similar)
- [ ] **VAPID secrets no Supabase** — configurar no painel antes de usar push server-side
- [ ] **Google AdSense real** — slot reservado, preencher `VITE_ADSENSE_CLIENT` + `VITE_ADSENSE_SLOT`
- [ ] **Login com Google** — Supabase configurado, mas OAuth callback precisa domínio real
- [ ] **Resumo diário automático** — toggle em Settings existe, envio não implementado
- [ ] **Capacitor / APK Android** — não configurado (app funciona como PWA instalável)
- [ ] **Paginação de doses** — sem limite de resultados em períodos longos
- [ ] **Offline queue** — mutações offline falham silenciosamente
- [ ] **Domínio customizado** — para `dosy.vercel.app` sem sufixo: Vercel → Settings → Domains
