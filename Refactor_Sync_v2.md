# Refactor Sync v2 — Arquitetura de Sincronização Healthcare

**Status:** Plano  
**Versão alvo:** v0.3.0.0  
**Data:** 2026-05-24  
**Motivação:** B102 ("dose marcada não persiste") sobreviveu 8 releases de hotfix (v0.2.6.7 → v0.2.6.15). Cada fix atacou um sintoma diferente; nenhum atingiu a raiz porque a raiz é **arquitetural**.

---

## 1. Por que refatorar

### 1.1 Sintomas recorrentes

- **B102:** user marca dose (Tomada/Pulada) → UI muda → fecha app → reabre → dose voltou pra atrasada
- **B100 / "perde comunicação com BD":** após ~5min idle, requests ficam pendurados, UI mostra skeleton infinito
- **Heartbeat 401 em loop:** token expira, `useAppResume.heartbeat` detecta mas NÃO chama `refreshSession()` — apenas dropa channels e refetcha (que vai falhar 401 de novo)
- **Process kills agressivos no Samsung One UI 7:** 4 restarts em 7min observados no S25 Ultra — TanStack persist queue + hydrate stale + Realtime + heartbeat se misturam de forma imprevisível

### 1.2 Diagnóstico empírico (v0.2.6.15, S25U RXCY308LH0L, 2026-05-24)

Telemetria verbose capturou a cadeia exata do bug pela primeira vez:

```
19:14:19  heartbeat fail 401 → soft reconnect  (loop a cada 1min por 7min)
                                                ↳ NUNCA chama refreshSession()
19:21:26.686  [DoseCard] onSwiped  dx=288  wasHorizontal=true  ✓
19:21:26.838  [DoseCard] SWIPE CONFIRM handler-fire             ✓
19:21:26.838  [Dashboard] handleSwipeConfirm ENTER (mutStatus: idle)
19:21:26.838  [Dashboard] confirmMut.mutateAsync calling
19:21:26.846  [mut:confirmDose] onMutate  (cache patch optimistic ✓)
19:21:26.858  [mut:confirmDose] mutationFn:start
              ↓
            ╳  supabase.rpc('confirm_dose_v2')  ── HANG PARA SEMPRE
              (token zombie + Supabase JS aguardando auth válido)

NENHUM evento depois: zero mutationFn:ok / throw / POST / onSuccess / onSettled
```

Confirmado por SQL direto: BD ainda mostra status original — RPC nunca chegou. Cache otimista persistido em IDB → ao reabrir, hydrate mostra "Tomada" por 1-2s → refetch fresh do server retorna estado real → UI volta pra "atrasada".

### 1.3 Camadas mal coordenadas hoje

O fluxo de uma mutação atualmente atravessa **6 sistemas independentes**:

| # | Sistema | Responsabilidade | Arquivo |
|---|---------|-----------------|---------|
| 1 | TanStack `useMutation({ mutationKey })` | API hook | `src/hooks/useDoses.js` |
| 2 | `setMutationDefaults` registry | mutationFn + onMutate/onError/onSettled | `src/services/mutationRegistry.js` |
| 3 | `realtimeGate` (markInFlight/clearInFlight) | Bloqueia Realtime de sobrescrever cache durante mutation | `src/state/realtimeGate.js` |
| 4 | `versionedCache` (`_localActedAt` stamps) | Backup do gate — Realtime ignora payload em janela de 2.5s | `src/state/versionedCache.js` |
| 5 | TanStack persist (IDB) + `resumePausedMutations` | Drain offline queue após reconnect | `src/main.jsx:236-426` |
| 6 | `useAppResume` heartbeat + soft reconnect | Detectar token zombie + refetch | `src/hooks/useAppResume.js:284-336` |

Cada camada tem sua própria noção de "in-flight", "stale", "online". Race conditions emergem das interseções (heartbeat refetch atropelando mutation, Realtime payload chegando mid-mutation, persist hydrate sobrescrevendo fresh fetch, etc).

**A complexidade não vem de UMA decisão errada — vem da soma. Cada release adicionou uma proteção contra um sintoma específico, sem rever o todo.**

### 1.4 Escopo do refactor

**Manter intacto:**
- RPCs server-side (`confirm_dose_v2`, `skip_dose_v2`, `undo_dose_v2`, `get_dashboard_payload`)
- RLS policies, triggers, audit_log, alarm_audit_log
- Edge functions (`expire-temporary-shares`, etc)
- UI components (Dashboard, DoseCard, DoseModal, MultiDoseModal)
- Camada nativa: AlarmScheduler, CriticalAlarm, DosyMessagingService
- Gerador de doses, CMED catalog, autofill

**Substituir:**
- Stack de sincronização cliente: TanStack Query mutations + persist + Realtime gate + versionedCache + heartbeat-reconnect
- Por uma camada `dosySync` com **uma única fonte da verdade** e **um único ponto de coordenação**

---

## 2. Princípios

Antes de desenhar o sistema, definir os invariantes não-negociáveis:

### P1. Server é a única fonte da verdade
Cliente nunca grava em cache local sem confirmação do server, exceto otimismo de curtíssima duração (≤10s). Após 10s sem confirmação, otimismo expira e cache volta ao último estado servidor.

### P2. Healthcare critical: mutação confirmada = mutação garantida
Quando user marca uma dose, o sistema deve garantir uma de três coisas em ≤10s:
- **Sucesso:** persistido no BD ✓ (ícone verde, sem ação)
- **Falha visível:** banner "Erro ao salvar. [Retentar]" com ação clara
- **Pendente persistente:** ícone âmbar "Salvando..." que sobrevive process kill, drena no próximo boot

**Nunca:** UI muda silenciosamente sem garantia. Nunca "achou que salvou mas não salvou".

### P3. Token JWT válido = pré-condição de qualquer RPC
Toda chamada RPC verifica `expires_at > now() + 30s` antes de disparar. Se inválido, faz `refreshSession()` síncrono. Se refresh falha 2× → logout obrigatório.

Heartbeat não tenta "soft reconnect". Heartbeat detecta zombie → refreshSession() ou logout. Sem estados intermediários.

### P4. Process kill é estado normal
Samsung One UI 7 / Android Doze matam o processo agressivamente. Cada open do app deve assumir que tudo em memória sumiu. Persist é só para coisas que **precisam** sobreviver kill (mutações pendentes, sessão JWT). Cache de queries não precisa persist — fetch fresh é mais barato que coordenar hydrate.

### P5. UI nunca trava esperando rede
Toda operação de rede tem timeout duro (8-10s) + feedback visual. Skeleton infinito = bug. Spinner sem cancelar = bug.

### P6. Realtime é hint, não fonte
Postgres `realtime` envia notificação de mudança. Cliente trata como "talvez tenha mudado algo, valide na próxima oportunidade". Cliente **nunca** aplica payload Realtime direto no cache — sempre dispara um refetch e usa o resultado do GET como verdade.

### P7. Mutações são idempotentes via client request id
Toda mutação envia um UUID `request_id` gerado no cliente. RPC server-side faz `INSERT ... ON CONFLICT (request_id) DO NOTHING RETURNING *`. Se queue drena 2× a mesma mutação (process kill mid-RPC + replay), server retorna o mesmo resultado sem duplicar efeito.

---

## 3. Lifecycle do app

### 3.1 Cold Start (app não estava em memória)

**Trigger:** user toca ícone, OS lança processo do zero.

```
1. Native boot (Capacitor MainActivity onCreate)
2. WebView carrega index.html
3. JS boot:
   a. supabase.auth.getSession()  → lê SecureStorage
      - se session existe e expires_at > now + 30s → válida, segue
      - se session existe mas expirada (ou < 30s) → refreshSession() síncrono
        - sucesso → segue
        - falha → emit AUTH_LOST → render LoginPage
      - se session não existe → render LoginPage
   b. Network.getStatus() → seta onlineManager
   c. Carrega outstanding mutations queue (IDB key 'dosy:pending-mutations')
   d. Se queue tem itens e online: drainPendingMutations() em paralelo (não bloqueia UI)
   e. Render <App />
4. Dashboard.useEffect:
   a. fetch get_dashboard_payload (com timeout 10s)
   b. preenche store com resposta server
   c. UI renderiza
5. AlarmScheduler.rescheduleAll (job nativo, fora do critical path)
6. Realtime.subscribe (best-effort, não-bloqueante)
```

**Garantias:**
- Em ≤10s após user tocar ícone, ou Dashboard renderiza com dados frescos, ou tela de erro "Sem conexão. [Tentar de novo]" aparece.
- Mutações pendentes da sessão anterior são drenadas em paralelo (não bloqueiam UI).
- Não há "splash infinito".

### 3.2 Warm Resume (background → foreground, <5min)

**Trigger:** user volta pro app, processo ainda em memória.

```
1. Capacitor App.resume event
2. AppLifecycle handler:
   a. Network.getStatus() → reset onlineManager
   b. Token check:
      - getSession() → expires_at > now + 30s? sim, segue
      - se quase expirando ou expirado → refreshSession() em background
   c. drainPendingMutations() (se queue tem itens)
   d. Refetch ONLY dashboard-payload (não tudo)
   e. Realtime reconnect se desconectado
3. Realtime subscribe se necessário
```

**Garantias:**
- Resume em <500ms percebido pelo user.
- Dados frescos em ≤3s após resume.
- Token sempre válido antes do refetch.
- Mutações pendentes drenadas first.

### 3.3 Long Resume (background → foreground, >5min)

**Trigger:** user volta após >5min, ou volta de Doze deep sleep.

Mesma sequência do Warm Resume, mas com **assumption**: token quase certamente expirou.

```
1. Capacitor App.resume event
2. AppLifecycle:
   a. forceRefreshSession() upfront, await
      - sucesso → segue
      - falha → logout, mostra LoginPage com mensagem "Sessão expirou"
   b. resto = warm resume
```

### 3.4 Process Killed (Samsung/Doze)

**Trigger:** OS mata processo. Próxima abertura é Cold Start.

Tudo em memória sumiu. Apenas IDB sobrevive:
- `dosy:session` (JWT refresh token)
- `dosy:pending-mutations` (queue de mutações não confirmadas)
- `dosy:user-prefs` (preferences)

Outros caches NÃO persistem. Sem hydrate de "última lista de doses" — cold start fetcha fresh. Isso elimina a categoria inteira de bugs "cache stale sobrescreve fresh".

### 3.5 Idle ativo (app foreground sem interação)

**Comportamento atual problemático:** heartbeat a cada 60s, detecta token zombie, tenta soft reconnect, falha, repete.

**Comportamento novo:**
- Heartbeat 60s = `getSession()` apenas (read SecureStorage, sem rede)
- Se token expira em <60s → `refreshSession()` proativo (em background)
- Se refresh falha → emit AUTH_LOST → render banner "Sua sessão expirou. [Fazer login]"
- Sem "soft reconnect" — ou tá logado, ou não tá

---

## 4. Auth lifecycle

### 4.1 Estados possíveis

```
┌──────────────┐
│  ANONYMOUS   │  Nenhum token. Renderiza LoginPage.
└──────┬───────┘
       │ user logs in
       ↓
┌──────────────┐
│   VALID      │  Token expires_at > now + 30s. Operações OK.
└──────┬───────┘
       │ token expira em <30s
       ↓
┌──────────────┐
│  REFRESHING  │  refreshSession() em curso. Operações enfileiradas até resolver.
└──────┬───────┘
       │
       ├── sucesso → volta pra VALID
       │
       └── falha (2 tentativas) → AUTH_LOST
                                  ↓
                          ┌──────────────┐
                          │  AUTH_LOST   │  Banner: "Sessão expirou. [Login]"
                          └──────────────┘
```

### 4.2 API pública

```js
// auth/sessionManager.js (novo)

/**
 * Retorna sessão válida. Se token expira em <30s, faz refresh sync.
 * Throw AuthLostError se refresh falha 2×.
 */
async function getValidSession() { ... }

/**
 * Wrapper pra qualquer RPC. Garante token válido antes de chamar.
 * Throw AuthLostError se sessão inválida.
 * Throw TimeoutError se RPC demora >10s.
 */
async function authedRpc(rpcName, params, options = { timeoutMs: 10_000 }) {
  await getValidSession() // pode fazer refreshSession + retry
  const result = await Promise.race([
    supabase.rpc(rpcName, params),
    timeout(options.timeoutMs)
  ])
  if (result.__timeout) throw new TimeoutError(rpcName)
  return result
}
```

Toda RPC do app passa por `authedRpc`. Sem exceção. Heartbeat não existe mais como sistema separado — virou um caso particular de "validar sessão" disparado por timer 60s.

### 4.3 O que muda em código existente

- `dosesService.js`: `confirmDose/skipDose/undoDose` substituem `rpcV2WithAuthRetry` por `authedRpc`
- `useAppResume.js`: heartbeat antigo deletado (~250 linhas). Lifecycle reduz a `getValidSession()` em resume + timer 60s.
- `supabaseClient.js`: remove configurações de `autoRefreshToken: true` ambíguas, força refresh manual via sessionManager.

---

## 5. Marcação de dose: o coração do refactor

Esta é a operação healthcare-critical. Vou desenhar duas opções e justificar a escolha.

### 5.1 Opção A: Optimistic + RPC direto (SÍNCRONO)

```
user swipe / tap
  ↓
optimistic patch local store (UI mostra Tomada imediatamente, ícone ⏳)
  ↓
authedRpc('confirm_dose_v2', { dose_id, actual_time, request_id })  [timeout 10s]
  ↓
┌─────────────────────────┬────────────────────────────────────┐
│  sucesso (200)          │  erro / timeout                    │
├─────────────────────────┼────────────────────────────────────┤
│ confirma store (ícone ✓)│ adiciona em pending-mutations queue│
│ remove optimistic flag  │ store mantém optimistic + flag ⚠️   │
│ track DOSE_CONFIRMED    │ banner: "Salvando offline..."      │
└─────────────────────────┴────────────────────────────────────┘
```

**Prós:**
- Server é fonte da verdade desde o primeiro segundo
- UX rápida (otimismo)
- Falhas explícitas (não silenciosas)
- Trivial de raciocinar

**Contras:**
- Se offline persistente, queue cresce. Mas isso é desejável em healthcare.

### 5.2 Opção B: Buffer local + sync periódico (ASSÍNCRONO)

```
user swipe → grava em IDB (status: 'pending-sync') → UI mostra Tomada
  ↓
Worker a cada 10s drena queue → RPC → marca synced
```

**Prós:**
- UI nunca espera rede
- Robusto a process kill no meio

**Contras:**
- Server fica defasado por até 10s sempre
- Race conditions multi-device (user marca em 2 devices, qual ganha?)
- Difícil de mostrar "está salvando" vs "está salvo" — user confiará menos
- B102 disfarçado: se worker quebra, mutações nunca drenam, app não percebe

### 5.3 Decisão: Opção A (Optimistic + RPC direto + queue de fallback)

Healthcare critical exige feedback rápido e confiável. Opção A com queue como FALLBACK (não como primary path) entrega:

1. **Online:** 99% das mutações resolvem em <2s, UX percebe instantâneo
2. **Offline:** mutação vai pra queue persistida com flag visual ⚠️ "Salvando offline"
3. **Process kill mid-RPC:** queue tem entry, drena no próximo boot via `request_id` idempotente
4. **Server reject (409 conflict):** banner "Outro dispositivo marcou — aceitar?"

### 5.4 Pseudocódigo da função `markDose`

```js
// src/services/dosySync/markDose.js (novo)

async function markDose({ doseId, action, payload }) {
  // action: 'confirm' | 'skip' | 'undo'
  // payload: { actualTime?, observation? }
  
  const requestId = uuid()
  const optimisticStatus = action === 'confirm' ? 'done'
                         : action === 'skip'    ? 'skipped'
                         : 'pending'
  
  // 1. Optimistic local (sempre)
  doseStore.patch(doseId, {
    status: optimisticStatus,
    _optimistic: true,
    _requestId: requestId,
    _localActedAt: Date.now()
  })
  
  // 2. Persist em queue ANTES do RPC (sobrevive process kill)
  await pendingMutationsQueue.add({
    requestId,
    doseId,
    action,
    payload,
    createdAt: Date.now()
  })
  
  // 3. Tenta RPC com timeout
  try {
    const result = await authedRpc(`${action}_dose_v3`, {
      p_request_id: requestId,
      p_dose_id: doseId,
      ...payload
    }, { timeoutMs: 10_000 })
    
    // Sucesso
    doseStore.patch(doseId, {
      ...result.dose,
      _optimistic: false,
      _confirmedAt: Date.now()
    })
    await pendingMutationsQueue.remove(requestId)
    track(EVENTS.DOSE_CONFIRMED, { action })
    
  } catch (err) {
    if (err instanceof TimeoutError || err instanceof NetworkError) {
      // Queue mantida pra drain posterior. UI mostra ⚠️ "Salvando..."
      doseStore.patch(doseId, { _pendingSync: true })
      emit('dose:sync-pending', { doseId, requestId })
      return  // não throw — user já viu ação completa
    }
    
    if (err.code === 409) {
      // Conflict: outro dispositivo modificou
      await pendingMutationsQueue.remove(requestId)
      doseStore.patch(doseId, err.currentState)  // reverte pro estado server
      emit('dose:conflict', { doseId, currentState: err.currentState })
      return
    }
    
    // Erro real (RLS, validação, server bug)
    await pendingMutationsQueue.remove(requestId)
    doseStore.revert(doseId)  // reverte optimistic
    toast.error(`Não foi possível ${action}: ${err.message}`)
    captureException(err)
  }
}
```

### 5.5 Drain da queue

Roda em 3 momentos:
1. **App boot:** depois de validar sessão
2. **App resume:** depois de validar sessão
3. **Network reconnect:** evento online → drain

```js
async function drainPendingMutations() {
  const pending = await pendingMutationsQueue.getAll()
  if (pending.length === 0) return
  
  await getValidSession()  // garante auth
  
  // FIFO, não-paralelo (evita conflitar entre si)
  for (const mut of pending) {
    try {
      const result = await authedRpc(`${mut.action}_dose_v3`, {
        p_request_id: mut.requestId,
        p_dose_id: mut.doseId,
        ...mut.payload
      }, { timeoutMs: 10_000 })
      
      doseStore.patch(mut.doseId, { ...result.dose, _pendingSync: false })
      await pendingMutationsQueue.remove(mut.requestId)
      
    } catch (err) {
      if (err.code === 409) {
        // Conflict — server tem state diferente. Aceita server.
        doseStore.patch(mut.doseId, err.currentState)
        await pendingMutationsQueue.remove(mut.requestId)
        emit('dose:conflict-drain', { mut })
      } else if (err instanceof TimeoutError || err instanceof NetworkError) {
        // Para drain, deixa mutações restantes pra próxima tentativa
        break
      } else {
        // Erro real — descarta mutação (não retry infinito)
        await pendingMutationsQueue.remove(mut.requestId)
        captureException(err, { extra: { mut } })
      }
    }
  }
}
```

### 5.6 Garantia de idempotência server-side

RPC `confirm_dose_v3` (e similares) precisa:

```sql
CREATE OR REPLACE FUNCTION medcontrol.confirm_dose_v3(
  p_request_id uuid,
  p_dose_id uuid,
  p_actual_time timestamptz,
  p_observation text DEFAULT ''
) RETURNS jsonb AS $$
DECLARE
  v_existing record;
BEGIN
  -- Idempotência: se request_id já foi processado, retorna resultado anterior
  SELECT * INTO v_existing
  FROM medcontrol.mutation_log
  WHERE request_id = p_request_id;
  
  IF FOUND THEN
    RETURN v_existing.result;
  END IF;
  
  -- Processa normalmente (lógica atual de confirm_dose_v2)
  -- ...
  
  -- Grava resultado pra próximos replays
  INSERT INTO medcontrol.mutation_log (request_id, user_id, result, created_at)
  VALUES (p_request_id, auth.uid(), v_result, NOW());
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Migration nova: tabela `mutation_log (request_id PK, user_id, result jsonb, created_at)` com TTL 24h via cron cleanup.

---

## 6. Cache strategy

### 6.1 Estado atual problemático

- TanStack Query 5 cache em memória + persist em IDB
- Hydrate complexo via `PersistQueryClientProvider`
- `setMutationDefaults` registra callbacks que precisam estar online no momento do hydrate
- `versionedCache._localActedAt` + `realtimeGate.isInFlight` tentam coordenar race conditions
- Resultado: 6 sistemas que se contradizem em casos de borda

### 6.2 Estado novo

**Store local = Zustand single source of truth** (ou Map nativo + custom hooks; sem TanStack).

```js
// src/state/doseStore.js (novo)

const doseStore = create((set, get) => ({
  doses: new Map(),  // doseId → dose object
  loaded: false,
  loadedAt: null,
  
  setAll(doses) {
    set({
      doses: new Map(doses.map(d => [d.id, d])),
      loaded: true,
      loadedAt: Date.now()
    })
  },
  
  patch(doseId, patch) {
    set(state => {
      const next = new Map(state.doses)
      const current = next.get(doseId)
      if (!current) return state
      next.set(doseId, { ...current, ...patch })
      return { doses: next }
    })
  },
  
  revert(doseId) {
    // Reverte optimistic patch para último _confirmedAt
    // ... (snapshot tracking)
  }
}))

// Hook
function useDoses(filter) {
  const doses = useDoseStore(s => s.doses)
  return useMemo(() => applyFilter([...doses.values()], filter), [doses, filter])
}
```

**Sem persist do cache.** Cold start sempre fetcha fresh. Custo: 1 RPC extra por boot (~200ms). Benefício: elimina hydrate stale bugs.

### 6.3 Fetch strategy

```js
// src/services/dosySync/fetchDashboard.js (novo)

async function fetchDashboard({ patientId, from, to } = {}) {
  await getValidSession()
  
  const data = await authedRpc('get_dashboard_payload', {
    p_patient_id: patientId,
    p_from: from || defaultFrom(),
    p_to: to || defaultTo()
  }, { timeoutMs: 10_000 })
  
  doseStore.setAll(data.doses)
  patientStore.setAll(data.patients)
  treatmentStore.setAll(data.treatments)
  
  return data
}
```

Chamado em:
- App boot (depois de validar sessão)
- App resume (se loadedAt > 30s ago)
- Manual refresh (pull-to-refresh)
- Após drain de mutações (re-sync)

### 6.4 Realtime

```js
// src/services/dosySync/realtime.js (novo)

let realtimeChannel = null

function subscribeRealtime() {
  if (realtimeChannel) return
  
  realtimeChannel = supabase
    .channel('doses-changes')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'medcontrol', 
      table: 'doses' 
    }, (payload) => {
      // NÃO aplicamos payload direto. Só agendamos refetch.
      scheduleRefetch()
    })
    .subscribe()
}

const scheduleRefetch = debounce(() => {
  fetchDashboard().catch(captureException)
}, 1500)

function unsubscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
}
```

Realtime fica simples: notifica → debounce 1.5s → refetch. Nunca tenta aplicar payload no cache local.

---

## 7. Comparação antes/depois

| Aspecto | v0.2.6.x atual | v0.3.0.0 proposto |
|---------|----------------|---------------------|
| Camadas de sync | 6 (TanStack mutations, persist, gate, versionedCache, heartbeat, resume) | 2 (dosySync + zustand store) |
| Linhas de código sync | ~2.500 (estimativa) | ~600 (estimativa) |
| Race conditions conhecidas | 4+ (gate vs heartbeat, hydrate vs fetch, persist mutations vs new, Realtime vs refetch) | 0 desenhadas |
| Cache hydrate stale | ✗ Bug recorrente | ✓ Eliminado (não persiste cache) |
| Token zombie recovery | ✗ Heartbeat loop infinito | ✓ Refresh ou logout |
| Mutation drop após kill | ✗ Possível | ✓ Garantido drain |
| Idempotência | ✗ Risco de duplicar (sem request_id) | ✓ Server descarta replays |
| Feedback visual de save | ⚠️ Inconsistente | ✓ ✓ saved / ⏳ syncing / ⚠️ pending |
| Timeout em RPC | ✗ Pode hang forever | ✓ 10s hard |

---

## 8. Plano de migração

Refactor não pode ser big bang — app está em produção. Migração em **4 fases**, cada uma shippable independentemente.

### Fase 1 — Foundation (v0.3.0.0)
**Escopo:** auth + RPC wrappers, sem trocar lógica de mutations ainda.

- `sessionManager.js` (novo): `getValidSession`, `authedRpc`
- `dosesService.js`: troca `rpcV2WithAuthRetry` por `authedRpc`
- `useAppResume.js`: deleta heartbeat antigo (~250 linhas), substitui por timer simples que valida sessão
- Migration SQL: cria tabela `mutation_log` para idempotência futura

**Risco:** baixo. Mudança transparente para UI.  
**Validação:** todos os bugs de "RPC hangs" resolvem. Heartbeat 401 loop não existe mais.

### Fase 2 — Store local (v0.3.1.0)
**Escopo:** Zustand store + remove TanStack cache para doses/patients/treatments.

- `doseStore.js`, `patientStore.js`, `treatmentStore.js` (novos)
- `useDoses`, `usePatients`, `useTreatments` reescritos como adapters Zustand
- `fetchDashboard.js` (novo) substitui `useDashboardPayload`
- Remove TanStack `persist` config inteira
- TanStack continua usado pra mutations por enquanto (isolamento de mudança)

**Risco:** médio. Comportamento de fetch on mount muda.  
**Validação:** hydrate stale bugs somem. Cold start ~200ms mais lento (aceito).

### Fase 3 — markDose (v0.3.2.0)
**Escopo:** substitui TanStack mutations por `markDose` + pendingMutationsQueue.

- `pendingMutationsQueue.js` (novo): IDB-backed queue
- `markDose.js` (novo): a função desenhada na seção 5.4
- `drainPendingMutations.js` (novo)
- `mutationRegistry.js`: deletado inteiro (~900 linhas)
- `useConfirmDose/useSkipDose/useUndoDose`: reescritos como thin wrappers de markDose
- Migration SQL: `confirm_dose_v3`, `skip_dose_v3`, `undo_dose_v3` com idempotência

**Risco:** alto. Coração healthcare crítico.  
**Validação:** QA exaustivo emulator + S25U real. B102 não deve aparecer mais.

### Fase 4 — Realtime simplificado (v0.3.3.0)
**Escopo:** novo Realtime que só notifica refetch.

- `realtimeSubscription.js` (novo): scheduleRefetch debounced
- Remove `realtimeGate`, `versionedCache`
- `useRealtime.js` reescrito como thin wrapper

**Risco:** baixo (já não dependemos do Realtime pra correção).  
**Validação:** 2 emulators marcando doses em paralelo, ambos convergem.

---

## 9. Risk analysis

### O que pode dar errado

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Regressão em fluxos não-doses (createPatient, createTreatment) | Média | Fase 2 só mexe em queries de doses primeiro. Patients/treatments numa fase 2.5 separada. |
| RPC v3 com bug de idempotência (mutation_log inflar) | Baixa | Cron diário cleanup `WHERE created_at < NOW() - INTERVAL '24h'`. Monitor table size. |
| Performance regressão (cold start +200ms) | Baixa | Aceitável trade-off. Medir antes/depois e validar. |
| Multi-device race resolvido errado | Baixa | RPC v3 mantém lógica 409 atual + currentState. Cliente prompt "Aceitar?" igual hoje. |
| Push notifications quebram (dependem de cache stale?) | Baixa | Notificação é agendada nativo (AlarmScheduler). Independe do cache JS. |
| Edge case: user offline + força close mid-mutation + reabre online | Baixa | Queue persistida em IDB sobrevive. Drain no boot. Idempotência server-side garante 1× efeito. |

### O que NÃO refazer
- RPCs server-side (manter, criar v3 ao lado)
- Edge functions
- AlarmScheduler nativo
- UI components
- CMED catalog ingest
- Auth flow login/signup (só refactor token management)

---

## 10. Definição de pronto

Cada fase shippable somente quando:

- [ ] Lint passa, build passa
- [ ] QA emulator: 10 mutações sequenciais sem perda
- [ ] QA emulator: app force-killed mid-mutation → reabrir → mutation drena
- [ ] QA emulator: 5min idle → resume → mutação funciona em <2s
- [ ] QA real S25U: mesmo set acima
- [ ] Sentry breadcrumb em pontos críticos (auth, mutation, drain)
- [ ] Telemetria PostHog: novos eventos `DOSE_PENDING_SYNC`, `DOSE_DRAIN_SUCCESS`, `DOSE_DRAIN_FAILED`, `AUTH_LOST`
- [ ] Rollback plan: feature flag por fase, capaz de reverter sem deploy novo

---

## 11. Estimativa

| Fase | Esforço | Wall clock |
|------|---------|---------|
| Fase 1 (Foundation) | 1 dia | 1 dia |
| Fase 2 (Store local) | 1.5 dias | 2 dias |
| Fase 3 (markDose) | 2 dias | 3 dias (inclui QA) |
| Fase 4 (Realtime) | 0.5 dia | 1 dia |
| **Total** | **5 dias** | **~7 dias com QA real** |

Considera trabalho focado, sem paralelizar com features. Margem 30% pra imprevistos: **plano realista de 2 semanas**.

---

## 12. Decisões pendentes (precisam input)

1. **Zustand vs hook customizado simples?**  
   Zustand: 3KB, idiomático, devtools. Hook customizado: 0 deps, mais código. Recomendo Zustand.

2. **Manter TanStack Query para outras coisas (queries não-doses)?**  
   Sim — não há motivo pra remover de queries simples (CMED catalog search, etc). Só mexer no que tem mutation/sync complexo.

3. **Sentry breadcrumb mantém v0.2.6.13 verbose ou volta DEV-only?**  
   Quando v0.3.x estabilizar, voltar DEV-only. Em ramp-up release, keep verbose.

4. **Migration data: doses existentes em BD têm campos compatíveis?**  
   Sim, RPC v3 lê mesma tabela `medcontrol.doses`. Só adiciona checagem idempotência via tabela paralela `mutation_log`.

5. **Atacar agora ou depois de v0.2.6.16 hotfix do heartbeat?**  
   Recomendo: shipping v0.2.6.16 com fix mínimo do heartbeat (chamar `refreshSession()` em vez de só refetch) — resolve 80% do B102 imediato. Refactor v0.3.0.0 inicia depois.

---

## 13. Próximos passos

1. User valida este plano (ajustes em escopo, ordem das fases, decisões pendentes)
2. v0.2.6.16: hotfix heartbeat (~2h) — bandage rápido enquanto refactor não vem
3. Abre branch `refactor/sync-v3` baseado em master
4. Fase 1 implementada como PR isolado (revisável)
5. Cada fase ship em release dedicada antes de iniciar próxima

---

**Documento vivo.** Atualizar conforme decisões.
