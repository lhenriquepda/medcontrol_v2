# Plano v0.2.8.0 — DoseSyncWorker.write (drain nativo Android)

**Status:** Planejamento detalhado para análise antes de implementação
**Motivação:** v0.2.7.0 resolveu B102 em 90% dos casos, mas não cobre "marcação durante idle suspended" — WebView pode receber lifecycle events do Android mas não retomar execução JavaScript imediatamente. A única solução é código nativo que rode independente do WebView.

---

## 1. Decisões arquiteturais (com alternativas analisadas)

### 1.1 Storage da queue: SharedPreferences (decisão)

**Atual:** `idb-keyval` em IndexedDB. Acessível APENAS de dentro da WebView.

**Alternativas avaliadas:**

| Opção | Worker Java acessa? | Atomicidade | Complexidade |
|---|---|---|---|
| IDB | ❌ | Boa em JS | Baixa |
| SharedPreferences (via `@capacitor/preferences`) | ✅ | apply async / commit sync | Baixa |
| SQLite nativo | ✅ | Transações | Alta |
| Arquivo JSON na pasta privada | ✅ | Sem garantias | Média |

**Decisão:** `@capacitor/preferences` (plugin oficial). JavaScript usa a API do plugin, código Java acessa o mesmo `SharedPreferences` diretamente. Single source of truth. Plugin já é dependência transitiva do Capacitor core, sem instalação extra.

**Trade-off aceito:** SharedPreferences não tem transação ACID nativa, mas para nossa carga (até ~20 entries) o overhead de race condition é desprezível com escrita serial.

### 1.2 Trigger do Worker: WorkManager PeriodicWorkRequest (decisão)

**Alternativas avaliadas:**

| Opção | Frequência | Sobrevive reboot? | Doze-aware? | Pode atrasar? |
|---|---|---|---|---|
| `AlarmManager.setExactAndAllowWhileIdle` | Configurável | ❌ (precisa BootReceiver) | ⚠️ bypass Doze | Não |
| `JobScheduler` direto | min 15min | ✅ | ✅ | Sim |
| `WorkManager.PeriodicWorkRequest` | min 15min | ✅ | ✅ | Sim |
| `Foreground Service` | Contínuo | ✅ | ❌ bypass Doze | Não |

**Decisão:** `WorkManager.PeriodicWorkRequest` a cada **15 minutos**.

**Por quê:**
- Sobrevive reboot do device automaticamente
- Respeita Doze e App Standby (não drena bateria)
- API oficial recomendada Google pra background sync
- Já usamos no projeto (`DoseSyncWorker` para agendar alarmes)
- O atraso por Doze é aceitável — healthcare crítico é < 1h até sync, não < 1min

**Trade-off aceito:** Em Doze deep sleep, Android pode atrasar execução até a próxima janela de manutenção (até 1-4h). Para nossa semântica (cuidador eventualmente vê dose), isso é aceitável. O caso patológico (app fechado + offline + low-battery por 24h) ainda é coberto: na próxima abertura, JS drain pega.

### 1.3 Constraints do Worker

```java
new PeriodicWorkRequest.Builder(MutationDrainWorker.class, 15, TimeUnit.MINUTES)
    .setConstraints(new Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build())
    .build()
```

**SEM `setRequiresBatteryNotLow`** — healthcare, prioridade sync > bateria. Egress é mínimo (próxima seção).

**SEM `setRequiresCharging`** — usuário não plugaria só pra sincronizar dose.

### 1.4 Auth: Worker faz refresh nativo (decisão — Opção B do user)

**Alternativas:**

| Opção | Esforço | Sobrevive token expirar? | Replica auth state? |
|---|---|---|---|
| **B (escolhida)** Worker faz refresh nativo | Alto (~200 linhas Java extras) | ✅ | Risco de desincronia controlado |
| A. Worker reusa access_token do SharedPreferences | Baixo | ❌ pula ciclo se expirado | Sem risco |

**Decisão final do user:** Opção B — Worker autônomo. Se access_token expirado, Worker faz POST nativo Java em `/auth/v1/token?grant_type=refresh_token`, salva novo `access_token` + `refresh_token` em `dosy_sync_credentials` SharedPreferences, e prossegue drenando.

**Por quê (justificativa do user):** Garantir drenagem mesmo em cenário patológico onde user fica dias sem abrir o app (ex.: viagem, hospital). Sem refresh nativo, queue ficaria stuck até user voltar. Com refresh nativo, mutations chegam pro cuidador em max 15min sempre que device estiver online — independente de user abrir app.

**Custo:** ~200 linhas extra Java (HttpURLConnection POST + JSON parse + atomic write SharedPreferences). Estimativa Passo 2: 4h → **6h**.

**Mitigação de desincronia:** Worker e JS escrevem no MESMO SharedPreferences `dosy_sync_credentials`. Qualquer um lê o token mais recente. Race possível: Worker refresha → JS lê stale 1× → JS tenta RPC e pega 401 → JS faz seu próprio refresh (já implementado em `sessionManager.js`). Pior caso: 1 RPC extra com token velho, sem perda de dados.

---

## 2. Análise de Egress (preocupação do user)

**Cenário A — Uso típico (app aberto regular):**
- 95% das marcações: `markDose` resolve em <1s pelo JS
- Worker dispara cada 15min, lê queue, encontra vazia → **0 RPC**
- Diferença vs hoje: **0 bytes/dia**

**Cenário B — User marca 5 doses, fecha app, fica offline:**
- 5 entries na queue persistidas em SharedPreferences
- Worker dispara em 15min: 5 POSTs RPC v3 (~1KB cada request) = ~5KB total
- Próximo ciclo (15min depois): queue vazia → **0 RPC**
- Total cenário: **5KB únicos**

**Cenário C — User offline 24h, marca 50 doses durante o dia:**
- Worker tenta cada 15min mas falha (NetworkType.CONNECTED não satisfeita)
- Quando rede volta: Worker dispara, processa as 50 entries
- Limite WorkManager ~10min por execução → ~30-40 RPCs por ciclo → 1-2 ciclos totais
- Total: **~50KB / device**

**Cenário D (pior caso) — App nunca aberto por dias com queue stuck:**
- 15min cycle × 24h = 96 tentativas/dia
- Cada ciclo: 1 read SharedPreferences (zero rede) se queue vazia
- Se queue tem 1 entry stuck: 1 POST/15min = 96 POSTs/dia = **~100KB**
- Idempotência server-side: entry zombie eventualmente removida pelo Worker em ciclo bem-sucedido

**Comparação com v0.2.7.0 atual:**
- v0.2.7.0 watchdog setInterval 30s = 120 IDB reads/hora (só quando JS rodando)
- v0.2.8.0 Worker 15min = 4 SharedPref reads/hora (sempre, mesmo suspended)
- Worker é MENOS agressivo que watchdog atual

**Não há cenário de storm.** Worker é gated por:
1. NetworkType.CONNECTED (offline = 0 cycles)
2. queueSize > 0 (vazia = 0 RPC, só 1 read SharedPref)
3. 15min mínimo entre cycles (WorkManager enforce)
4. Idempotência server-side (não duplica writes)

---

## 3. Race conditions (e como prevenir)

### Race 1: JS marca nova dose enquanto Worker está drenando

**Sequência problemática:**
```
T+0:    Worker lê queue: [A, B]
T+0.5:  User marca C via JS → queue = [A, B, C] (via Preferences)
T+1:    Worker processa A → grava queue [B] (sobreescreve, perde C!)
```

**Mitigação:** Worker NÃO grava queue inteira após processar. Em vez disso, remove entry individualmente:

```java
// Pseudo-código
for (entry of currentBatch) {
    if (postRpc(entry).success) {
        // Re-lê queue atual (pega C se foi adicionado)
        List<Entry> current = readQueue();
        current.removeIf(e -> e.requestId.equals(entry.requestId));
        writeQueue(current);
    }
}
```

Cada remoção é read-modify-write atômico via SharedPreferences `apply()`. Worst case: C é processada no próximo cycle.

### Race 2: JS drain e Worker drenam concorrentes

**Sequência:**
```
T+0: Worker lê queue [A]
T+0: JS drain (boot) lê queue [A]
T+1: Worker POST A → 200 OK
T+2: JS POST A → 200 OK (idempotência server: retorna result anterior)
T+3: Worker remove A da queue
T+4: JS remove A da queue (no-op, já removida)
```

**Resultado:** 2 RPCs em vez de 1, mas idempotência garante resultado correto. Custo: 1 RPC extra ~1KB.

**Mitigação opcional:** lock em SharedPreferences via flag `worker_in_progress`. JS verifica antes de drain. Complexidade adicional não vale o ganho — 1 RPC extra raramente.

### Race 3: Worker em execução quando app é killed

Worker é processo independente do app. App killed não afeta Worker. WorkManager garante completude do `doWork()` ou retry no próximo cycle.

---

## 4. Migração de IDB → SharedPreferences

### Estratégia: one-time migration no primeiro boot v0.2.8.0

```js
// src/main.jsx (boot)
async function migrateIdbToPreferences() {
  try {
    const oldQueue = await idbGet('dosy:pending-mutations')
    if (Array.isArray(oldQueue) && oldQueue.length > 0) {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({
        key: 'dosy_pending_mutations',
        value: JSON.stringify(oldQueue),
      })
      await idbDel('dosy:pending-mutations')
      console.log('[migrate] IDB queue migrated:', oldQueue.length, 'entries')
    }
  } catch (e) {
    console.warn('[migrate] IDB→Preferences fail:', e?.message)
  }
}
```

Idempotente: se rodar 2× sem entries em IDB, no-op.

### API pública `pendingMutationsQueue.js`

Mantém mesma assinatura, só troca backend:

```js
// Antes (idb-keyval)
import { get as idbGet, set as idbSet } from 'idb-keyval'

// Depois (Preferences)
import { Preferences } from '@capacitor/preferences'

async function readQueue() {
  const { value } = await Preferences.get({ key: 'dosy_pending_mutations' })
  return value ? JSON.parse(value) : []
}

async function writeQueue(items) {
  await Preferences.set({
    key: 'dosy_pending_mutations',
    value: JSON.stringify(items),
  })
}
```

Callers (`markDose.js`) não mudam.

### Web fallback

`@capacitor/preferences` em web usa `localStorage` automaticamente. Funciona transparente.

---

## 5. Arquitetura do MutationDrainWorker

### Arquivos novos

```
android/app/src/main/java/com/dosyapp/dosy/sync/
├── MutationDrainWorker.java   — Worker que lê queue + POSTs
└── MutationQueueStore.java    — Helper read/write SharedPreferences
```

### MutationDrainWorker.java (esboço)

```java
public class MutationDrainWorker extends Worker {
    private static final String TAG = "MutationDrainWorker";
    private static final int MAX_ENTRIES_PER_CYCLE = 20;
    private static final int RPC_TIMEOUT_MS = 15_000;
    
    @Override
    public Result doWork() {
        SharedPreferences syncPrefs = getApplicationContext()
            .getSharedPreferences("dosy_sync_credentials", Context.MODE_PRIVATE);
        SharedPreferences mutPrefs = getApplicationContext()
            .getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        
        String accessToken = syncPrefs.getString("access_token", null);
        long expMs = syncPrefs.getLong("access_token_exp_ms", 0);
        String supabaseUrl = syncPrefs.getString("supabase_url", null);
        String anonKey = syncPrefs.getString("anon_key", null);
        
        if (accessToken == null || expMs < System.currentTimeMillis() + 30_000) {
            Log.d(TAG, "Token expirado/missing — pula ciclo");
            return Result.success();
        }
        
        List<MutationEntry> queue = MutationQueueStore.read(mutPrefs);
        if (queue.isEmpty()) {
            return Result.success();
        }
        
        int processed = 0;
        for (MutationEntry entry : queue) {
            if (processed >= MAX_ENTRIES_PER_CYCLE) break;
            
            Result rpcResult = postRpc(supabaseUrl, anonKey, accessToken, entry);
            if (rpcResult == Result.SUCCESS) {
                MutationQueueStore.removeEntry(mutPrefs, entry.requestId);
                processed++;
            } else if (rpcResult == Result.AUTH_FAIL) {
                // Opção B (decisão user): tenta refresh nativo 1× antes de pular
                String newToken = refreshAccessTokenNative(supabaseUrl, anonKey, syncPrefs);
                if (newToken != null) {
                    accessToken = newToken;
                    // Retry essa entry no próximo cycle (não decrement processed)
                    Log.d(TAG, "Refresh OK, retry no próximo cycle");
                    break;
                } else {
                    Log.d(TAG, "Refresh fail — pula resto, próximo cycle tenta");
                    break;
                }
            } else {
                // Erro real (não-network, não-auth) — incrementa retry_count
                // Decisão user: 3× retry antes de descartar (não 1× como recomendação default)
                int retries = MutationQueueStore.incrementRetry(mutPrefs, entry.requestId);
                if (retries >= 3) {
                    Log.w(TAG, "Entry descartada após 3 retries: " + entry.requestId);
                    MutationQueueStore.removeEntry(mutPrefs, entry.requestId);
                }
                // Senão mantém na queue — próximo cycle tenta de novo
            }
        }
        
        return Result.success();
    }
    
    private Result postRpc(String supabaseUrl, String anonKey, String token, MutationEntry e) {
        // HTTPS POST pra https://{supabaseUrl}/rest/v1/rpc/{e.action}_dose_v3
        // Headers: Authorization Bearer, apikey, Content-Type
        // Body: { p_request_id, p_dose_id, p_actual_time?, p_observation? }
        // Timeout 15s
        // 200 → SUCCESS, 401 → AUTH_FAIL, outros → ERROR
    }
}
```

### MutationQueueStore.java (esboço)

```java
public class MutationQueueStore {
    private static final String KEY = "dosy_pending_mutations";
    
    public static List<MutationEntry> read(SharedPreferences prefs) {
        String json = prefs.getString(KEY, "[]");
        // Parse JSON → List<MutationEntry>
        // Cada entry tem campo opcional retryCount (default 0)
    }
    
    public static synchronized void removeEntry(SharedPreferences prefs, String requestId) {
        List<MutationEntry> current = read(prefs);
        current.removeIf(e -> e.requestId.equals(requestId));
        prefs.edit().putString(KEY, toJson(current)).apply();
    }
    
    /**
     * Incrementa retryCount da entry e retorna o novo valor.
     * Decisão user: descartar só após 3× falha em erro não-network.
     */
    public static synchronized int incrementRetry(SharedPreferences prefs, String requestId) {
        List<MutationEntry> current = read(prefs);
        int newCount = 0;
        for (MutationEntry e : current) {
            if (e.requestId.equals(requestId)) {
                e.retryCount = (e.retryCount == null ? 0 : e.retryCount) + 1;
                newCount = e.retryCount;
                break;
            }
        }
        prefs.edit().putString(KEY, toJson(current)).apply();
        return newCount;
    }
}
```

### Refresh nativo Java (Opção B do user)

```java
/**
 * POST nativo pra Supabase /auth/v1/token?grant_type=refresh_token
 * Retorna access_token novo ou null se falha.
 * Em sucesso, persiste novos tokens em syncPrefs atomicamente.
 */
private String refreshAccessTokenNative(String supabaseUrl, String anonKey, SharedPreferences syncPrefs) {
    String refreshToken = syncPrefs.getString("refresh_token", null);
    if (refreshToken == null) return null;
    
    try {
        URL url = new URL(supabaseUrl + "/auth/v1/token?grant_type=refresh_token");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("apikey", anonKey);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(10_000);
        conn.setReadTimeout(10_000);
        
        String body = "{\"refresh_token\":\"" + refreshToken + "\"}";
        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }
        
        if (conn.getResponseCode() != 200) {
            Log.w(TAG, "Refresh HTTP " + conn.getResponseCode());
            return null;
        }
        
        // Parse JSON response: { access_token, refresh_token, expires_in, ... }
        String response = readStream(conn.getInputStream());
        JSONObject json = new JSONObject(response);
        String newAccessToken = json.getString("access_token");
        String newRefreshToken = json.getString("refresh_token");
        long expiresIn = json.getLong("expires_in"); // segundos
        long expMs = System.currentTimeMillis() + (expiresIn * 1000);
        
        syncPrefs.edit()
            .putString("access_token", newAccessToken)
            .putString("refresh_token", newRefreshToken)
            .putLong("access_token_exp_ms", expMs)
            .apply();
        
        return newAccessToken;
    } catch (Exception e) {
        Log.w(TAG, "Refresh nativo fail: " + e.getMessage());
        return null;
    }
}
```

### Schedule do Worker

Em `MainActivity.java` ou plugin Capacitor existente:

```java
PeriodicWorkRequest mutationDrainWork = new PeriodicWorkRequest.Builder(
    MutationDrainWorker.class, 15, TimeUnit.MINUTES
).setConstraints(new Constraints.Builder()
    .setRequiredNetworkType(NetworkType.CONNECTED)
    .build()
).build();

WorkManager.getInstance(this).enqueueUniquePeriodicWork(
    "dosy_mutation_drain",
    ExistingPeriodicWorkPolicy.KEEP,
    mutationDrainWork
);
```

`enqueueUniquePeriodicWork` com `KEEP` policy garante que múltiplos schedules não duplicam. Se Worker já enfileirado, ignora.

---

## 6. Test plan

### Preparação (uma vez)

```bash
# Setup logcat verbose pra ver Worker activity
adb shell setprop log.tag.MutationDrainWorker VERBOSE
adb shell setprop log.tag.MutationQueueStore VERBOSE

# Filtro logcat ao vivo (executa em terminal separado)
adb logcat -s MutationDrainWorker MutationQueueStore MainActivity

# Forçar disparo manual do Worker (atalho — bypassa 15min wait)
# Substituir <pkg> por com.dosyapp.dosy ou com.dosyapp.dosy.dev
adb shell cmd jobscheduler run -f com.dosyapp.dosy 999  # JobId varia, descobrir via dumpsys
adb shell dumpsys jobscheduler | grep -A 5 "dosy-mutation-drain"
```

### Cenário 1 — Drain durante app suspended (caminho B102 último)

**Setup:**
- Login conta teste-free@teste.com (pwd 123456)
- Criar paciente + 1 tratamento com 3 doses agendadas pra próxima hora
- Garantir online (Wi-Fi ON)

**Steps:**
1. Marcar 1 dose como "Tomada" → confirma banner "Salvando..." some em <2s (drain JS OK normal)
2. Marcar 2ª dose como "Pular"
3. Bloquear tela do device imediatamente (botão lateral)
4. Aguardar 15-20min com tela bloqueada (sem tocar device)
5. Desbloquear tela → abrir app

**Verificação:**
- Logcat deve mostrar `[MutationDrainWorker] drain start — N entries pendentes` + `drain end — processed=N`
- BD via Supabase `mutation_log` table: COUNT(*) das últimas 30min = mutations marcadas
- Dashboard mostra doses como "Tomada"/"Pulado" (não banner queue)

**Passa se:** Worker drenou queue mesmo com app suspended (sem interação user).

### Cenário 2 — Drain offline + reconexão

**Steps:**
1. Wi-Fi + dados móveis OFF (modo avião ON)
2. Marcar 5 doses como "Tomada" rapidamente
3. Banner "Salvando 5 dose(s)..." aparece (network offline detectado)
4. Bloquear tela + esperar 5min (modo avião ainda)
5. Desativar modo avião (Wi-Fi/dados OFF→ON)
6. Imediatamente bloquear tela de novo, aguardar 20min sem tocar

**Verificação:**
- Logcat: Worker tenta cycle a cada 15min, mas NetworkType.CONNECTED gate skip enquanto offline
- Quando rede volta: próximo cycle drena 5 entries
- BD: 5 mutations em `mutation_log`

**Passa se:** Worker dispara só quando rede disponível (zero RPC offline).

### Cenário 3 — Refresh nativo Java (Opção B)

**Setup:**
- Login + aguardar 1h+ SEM abrir app (token JWT 1h expira)
- ALT: editar `access_token_exp_ms` em SharedPreferences pra forçar expiry (root/debug only)

**Steps:**
1. Com token expirado, marcar 1 dose via app
2. Banner queue aparece (RPC inicial falha 401 → drain JS tenta refresh → maybe queue stuck)
3. Fechar app + bloquear tela + aguardar 20min

**Verificação:**
- Logcat: `[MutationDrainWorker] token refreshed via refresh nativo (Opção B)`
- BD `mutation_log`: entry presente

**Passa se:** Worker fez refresh autônomo (sem JS) e drenou queue.

### Cenário 4 — App killed mid-RPC

**Steps:**
1. Marcar 1 dose como "Tomada"
2. Imediatamente: Settings → Apps → Dosy → Force Stop (mata processo mid-RPC)
3. NÃO abrir app por 20min (mantém killed)

**Verificação:**
- Logcat: Worker dispara (independent processo) e drena entry da SharedPreferences
- BD `mutation_log`: entry presente

**Passa se:** Worker drena mesmo com app NUNCA reaberta.

### Cenário 5 — Volume alto + dedupe idempotência

**Steps:**
1. Marcar 30 doses em sequência rápida (10 confirm, 10 skip, 10 undo)
2. Imediatamente fechar app (swipe recents)
3. Aguardar 30min (2 cycles do Worker)

**Verificação:**
- BD `mutation_log`: COUNT(*) = 30 (ou menor se JS drain pegou algumas)
- Sem duplicatas: SELECT request_id, COUNT(*) FROM mutation_log GROUP BY request_id HAVING COUNT(*) > 1 → 0 rows
- `pending_mutations` SharedPreferences: queue vazia ou diminuiu drasticamente

**Passa se:** Todas as 30 mutations processadas idempotentes (sem duplicate writes server-side).

### Verificação via BD (Supabase SQL)

```sql
-- Total drenado últimas 1h
SELECT
  COUNT(*) AS total,
  COUNT(DISTINCT user_id) AS users,
  MIN(created_at) AS first,
  MAX(created_at) AS last
FROM medcontrol.mutation_log
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Detectar duplicatas (sinal de bug idempotência)
SELECT request_id, COUNT(*) AS dupes
FROM medcontrol.mutation_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY request_id
HAVING COUNT(*) > 1;
```

### Verificação via SharedPreferences (debugging)

```bash
# Ver SharedPreferences "CapacitorStorage" do app
adb shell run-as com.dosyapp.dosy.dev cat /data/data/com.dosyapp.dosy.dev/shared_prefs/CapacitorStorage.xml

# Ver tokens auth
adb shell run-as com.dosyapp.dosy.dev cat /data/data/com.dosyapp.dosy.dev/shared_prefs/dosy_sync_credentials.xml
```

---

## 7. Risk analysis

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| OEM mata Worker (Samsung Game Booster, Xiaomi MIUI) | Média | Alto | Documentação: orientar user a whitelist app em Battery Optimization |
| SharedPreferences corrupt | Baixa | Médio | try/catch + queue.clear() fallback. Mutation perdida ≤ pior do que hoje |
| Token JWT muda formato entre versões Supabase | Baixa | Alto | Worker valida format antes do POST. Falha = retry next cycle |
| WorkManager versão conflict com Capacitor 8 | Baixa | Alto | Já usamos `androidx.work:work-runtime:2.9.1` no `DoseSyncWorker`. Sem risco |
| Idempotência server falha (bug RPC v3) | Muito baixa | Alto | Já testado em v0.2.7.0. mutation_log table funciona |
| User com >100 mutations stuck | Baixa | Baixo | Worker processa em batches de 20, eventualmente drena. Egress ~100KB total |
| Bateria afetada | Baixa | Médio | NetworkType.CONNECTED + 15min mínimo. WorkManager respeita Doze |

---

## 8. Plano de migração (ordem de implementação)

### Passo 1 — Plugin Preferences (2h)
- `npm install @capacitor/preferences`
- `npx cap sync android`
- Refactor `pendingMutationsQueue.js` substituindo idb-keyval por Preferences
- Migration boot one-time IDB → Preferences
- Testar: queue funciona web e Android igual antes

### Passo 2 — Worker Java (4h)
- `MutationQueueStore.java` (read/write SharedPreferences)
- `MutationDrainWorker.java` (esqueleto sem RPC)
- HTTP POST nativo via HttpURLConnection
- Auth header reuse do `dosy_sync_credentials` SharedPref
- Testar: log "queue vazia" a cada 15min

### Passo 3 — Schedule e integration (2h)
- `MainActivity.java` ou plugin: `enqueueUniquePeriodicWork`
- Testar: Worker dispara primeiro ciclo na boot
- Testar: drain queue real → entries removidas

### Passo 4 — Test plan completo (2h)
- 5 cenários manuais do §6
- Validação via mutation_log

### Passo 5 — Documentação (1h)
- Atualizar `Refactor_Sync_v2.md` §5.5 com Worker
- BUGS.md: fechar B102 categoricamente
- README.md user-facing: explicar drenagem offline

**Total estimado: 11h** = 1.5 dias de trabalho focado.

---

## 9. Pontos pra decisão antes de implementar

1. **Frequência 15min é OK?** Ou prefere 30min (mais bateria-friendly, menos rápido pra cuidador ver)?
2. **OK reusar access_token cached (Worker não refresha)?** Ou quer Worker self-suficiente (mais código Java)?
3. **OK Worker descartar mutations com erro real após 1 retry?** Ou prefere tentar 3× antes de descartar (queue cresce em caso patológico)?
4. **OK pular `RequiresBatteryNotLow`?** Healthcare vs bateria.
5. **Migration IDB → Preferences é one-way (sem rollback)?** Ou quero manter IDB fallback por 1 versão pra reverter se der ruim?

---

## 10. Comparação v0.2.7.0 atual vs v0.2.8.0 proposto

| Cenário | v0.2.7.0 (atual) | v0.2.8.0 (proposto) |
|---|---|---|
| Marca dose online | ✅ instant | ✅ instant |
| Marca dose offline + reabre online | ✅ drain no boot | ✅ drain no boot OU Worker em 15min |
| Process kill mid-RPC | ✅ drain idempotente próxima abertura | ✅ Worker drena em 15min, sem precisar abrir |
| Marca dose + app suspended por horas | ❌ stuck até user abrir app | ✅ Worker drena em 15min |
| App não aberto por dias | ❌ queue stuck | ✅ Worker drena toda vez que online |
| Cuidador vê marcação | Depende do user abrir app | Quase real-time (max 15min lag) |

---

## Status: AGUARDANDO ANÁLISE DO USER

Próximo passo após user aprovar/ajustar plano: implementação passo a passo do §8.
