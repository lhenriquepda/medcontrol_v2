# Receita — Validação Web via Chrome MCP

> Executar SEMPRE antes de pedir validação device ao user. Web cobre ~70% dos cenários.

---

## Alvos (em ordem de prioridade)

| Prioridade | URL | Quando usar |
|---|---|---|
| **1. localhost** | `http://localhost:5173/` | Default — branch não-mergeada, código local exato, sem push |
| **2. Preview Vercel** | `https://dosy-git-{branch}-lhenriquepdas-projects.vercel.app` | Após push da branch, testa build Vite + envs Vercel |
| **3. Prod** | `https://dosymed.app/` | Só pós-merge master + Vercel deploy (smoke test) |

---

## Receita lifecycle completo

### 1. Subir dev server (se não rodando)

```bash
npm run dev   # run_in_background: true — aguardar "VITE ready" no output
```

Verificar `http://localhost:5173/` responde antes navegar.

### 2. Navegar

```
mcp__Claude_in_Chrome__tabs_context_mcp(createIfEmpty: true) → tabId
navigate(url: "http://localhost:5173/", tabId)
screenshot — confirma carregou (sem ErrorBoundary)
```

### 3. Login com conta teste

- `teste-plus@teste.com / 123456` — tier plus (sem ads, todas features). **Default pra maioria das validações.**
- `teste-free@teste.com / 123456` — tier free (paywall ativo, 1 paciente). Usar quando item afetar gating Free/Plus.

Pular OnboardingTour clicando "Pular" canto superior direito.

### 4. Identificar items web-validáveis vs device-only

Listar antes de começar — reportar ao final.

### 5. Iterar por item

```
find / read_page    → localiza componente
javascript_tool     → simula interação (click, type, scroll)
read_console_messages (filter pattern) → verifica logs/erros
javascript_tool     → inspeciona estado (localStorage, fiber, QueryClient)
screenshot          → evidência
```

### 6. Reportar 3 categorias

- ✅ Web-validáveis confirmados (com evidências)
- ⚠️ Web-parciais (parte validada, parte exige device — explicar limite)
- ⏳ Device-only (lista para user executar no S25 Ultra)

---

## O que é validável via web

- UI rendering / componentes / animações framer-motion
- React Query (cache, persist, optimistic updates, invalidate)
- Fluxos auth (login/logout/reset)
- CRUD pacientes / tratamentos / doses via UI
- Banners (Update, Offline) + lógica show/hide
- Egress via Network panel + `window.__dosyNetMonitor`
- TanStack mutation queue offline (DevTools throttling "Offline")
- Form validation, modals, tier gating UI
- LGPD flows (export dados, delete account UI step 1)
- Telemetria PostHog/Sentry events (PROD only — verificar painel admin)
- Conteúdo estático (privacidade, termos, FAQ)

---

## Limites conhecidos — NÃO validável via web

- DevTools Network throttling "Offline": `navigator.onLine = false` ativa `useOnlineStatus` mas NÃO bloqueia fetch real → mutations não pausam de verdade. Precisa device físico.
- Capacitor.Network bridge → `onlineManager` só ativa em `Capacitor.isNativePlatform()`.
- FCM background, AlarmManager, plugin nativo CriticalAlarm — Android-only.
- Samsung One UI battery optimization, Xiaomi MIUI behaviour.
- Biometric auth (sensor real).
- AdMob banner PROD (sandbox apenas no emulator).
- SecureStorage Android KeyStore hardware-backed.
- Capacitor In-App Updates Play Core flexible flow.
- Privacy screen FLAG_SECURE recents blur.

Para esses itens → `context/recipes/emulator-setup.md` (§11b) ou validação device físico user (§11c).
