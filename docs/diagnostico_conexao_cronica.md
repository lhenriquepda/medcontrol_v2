# Diagnostico: bug cronico "perde conexao com o BD / fila travada ate fechar-abrir"

> Investigacao multi-agente (debate estruturado de 13 agentes) aterrada no codigo instalado.
> Confianca do veredito: **74%**. Gerado em 2026-06-08.

---

## 1. Veredito — Root Cause

**Acoplamento auth↔dados via processLock compartilhado no cliente supabase-js VIVO: getSession() (que monta o header Authorization de TODA RPC PostgREST) e refreshSession() disputam o MESMO mutex em memória (processLock, aplicado INCONDICIONALMENTE incl. web). Quando uma operação que segura o lock pendura (refresh inline mid-flight num WebView/aba congelado), o acquire estoura 15s e _getAccessToken cai no fallback supabaseKey=ANON, RLS nega, e a RPC já estourou os 10s do authedRpc antes do lock liberar → dose vai pra FILA e fica presa até reload.**

### Mecanismo
Cadeia confirmada no código INSTALADO (auth-js/supabase-js 2.103.3, não 2.45 — node_modules/@supabase/auth-js/package.json:version e .../supabase-js/package.json:version). PASSO 1 (semeadura): app idle/background. O token entra na janela 30-90s antes do exp. sessionManager.getValidSession (sessionManager.js:86) trata token como válido se faltam >30s e retorna SEM refrescar. Mas a primeira leitura de header subsequente vai por outro caminho: supabase.rpc() → fetchWithAuth (index.cjs:108: `const accessToken = (await getAccessToken()) ?? supabaseKey`) → _getAccessToken (index.cjs:519-524) → this.auth.getSession() (index.cjs:523) → _acquireLock(15000) (GoTrueClient.js:2222) → _useSession → __loadSession, onde hasExpired = expires_at*1000-Date.now() < EXPIRY_MARGIN_MS (=AUTO_REFRESH_TICK_THRESHOLD 3 × AUTO_REFRESH_TICK_DURATION_MS 30000 = 90000ms = 90s; GoTrueClient.js:2333-2334, constants.js:6-13). Como faltam <90s, hasExpired=true → _callRefreshToken roda INLINE DENTRO do lock (GoTrueClient.js:2361). PASSO 2 (wedge): se o WebView/aba congelou esse fetch /token mid-flight (Doze, OS suspend, throttle de aba), o refresh não resolve e o lock fica retido. O timeout de 8s do sessionManager.doRefresh (sessionManager.js:104-108) faz só Promise.race — REJEITA o promise JS mas NÃO aborta o fetch subjacente (sem AbortController) nem libera o lock. PASSO 3 (sintoma): toda nova RPC (markDose→authedRpc→getValidSession→getSession→_acquireLock) espera o lock. Crítico: o budget de 10s do authedRpc (sessionManager.js:147) é MENOR que o lockAcquireTimeout de 15s (supabase.js:54), garantindo TimeoutError ANTES do lock liberar → markDose.js:210 marca _pendingSync + mantém na fila + scheduleRetryDrain. Mesmo quando o acquire finalmente estoura 15s, _getAccessToken resolve session vazia e retorna this.supabaseKey=ANON (index.cjs:524) → Bearer anon → RLS nega → 'sem conexão'. PASSO 4 (drain inerte): cada watchdog 10s / scheduleRetryDrain / onlineManager.subscribe reconverge em authedRpc→getValidSession→o MESMO lock wedged (markDose.js:383,343,415-419); failedTransient→break (markDose.js:513)→drained:0→backoff dobra→re-agenda a MESMA falha. O mutex de drain (currentDrainPromise) NÃO é o preso — o .finally sempre o limpa (markDose.js:449-452); o que prende é o refresh/lock upstream.

### Por que reload/fechar-abrir resolve
Todo o estado wedged vive 100% em memória do objeto GoTrueClient e do módulo sessionManager — NADA em storage muda. Reload destrói o WebView/aba e o event-loop, recriando o supabase client com PROCESS_LOCKS={}, lockAcquired=false, refreshingDeferred=null, autoRefreshTicker novo, e descartando o fetch /token órfão suspenso. O módulo sessionManager re-avalia: refreshPromise=null, refreshFailCount=0 (sessionManager.js:42-43). markDose: currentDrainPromise=null, lastColdStartAt=now, lastResumeAt=0. Decisivo: main.jsx boot trata o caminho DIFERENTE do cliente vivo — faz `await getValidSession()` SÍNCRONO com client fresco (main.jsx:475-476) que refresca limpo cedo, e dispara drainPendingMutations fire-and-forget INDEPENDENTE do getValidSession. O cliente vivo nunca reexecuta esse caminho: o resume é gate bloqueante (useAppResume.js:67-73) que aborta o drain. Por isso 'fechar e abrir DRENA' a fila persistida (que está intacta em Preferences/localStorage) mas o cliente vivo nunca se auto-cura.

### Por que acontece no browser tambem
O lock processLock é aplicado SEM guard de plataforma (supabase.js:45: `lock: processLock`, dentro do bloco auth que vale web E nativo — só o storage SecureStorage é gated em isNative na linha 37). A cadeia _getAccessToken→getSession→_acquireLock→__loadSession→_callRefreshToken-inline é idêntica byte-a-byte no browser e no WebView (mesmo bundle index.cjs/GoTrueClient.js). EXPIRY_MARGIN_MS=90s é a mesma constante nos dois. Logo o wedge nasce na camada JS compartilhada e satisfaz 'acontece no browser também'. No browser o usuário fica AINDA mais exposto: main.jsx:288 instala o setEventListener custom do onlineManager SÓ no nativo, deixando o web nos eventos window online/offline (sticky-false), sem re-sync (useAppResume.js:81 native-gated) e sem resumePausedMutations (nunca chamado em src) — uma SEGUNDA camada de wedge para leituras/SOS no navegador. Os agravantes puramente nativos (SecureStorage async sob lock supabase.js:14-29, autoRefreshTick em WebView congelado, Worker nativo) só AUMENTAM a frequência no Android; a causa-raiz é cross-platform.

### Mecanismo unificador (a narrativa unica)
Existe UM ponto único de falha do qual todos os sintomas derivam: a SERIALIZAÇÃO via lock em memória compartilhado entre (a) o refresh de token e (b) a leitura de token que monta o header Authorization de TODA RPC PostgREST. supabase.rpc() → fetchWithAuth → _getAccessToken → auth.getSession() → _acquireLock(15000) → __loadSession. AUTH e DADOS dividem o mesmo mutex vivo do GoTrueClient. Narrativa única: o app fica idle/background; o token entra na janela 30-90s antes do exp; getValidSession (margem 30s) diz 'ok' e segue, mas a montagem do header (margem 90s do auth-js) dispara um refresh INLINE sob lock; o WebView/aba congela esse fetch /token mid-flight; o timeout de 8s do sessionManager rejeita o promise JS mas NÃO aborta o fetch nem libera o lock; o lock fica retido. No resume, TODA leitura de header espera o lock — e como o budget de 10s da RPC é menor que os 15s do lockAcquireTimeout, a RPC estoura TimeoutError antes do lock liberar → markDose marca _pendingSync e a dose 'vai pra FILA'; quando o acquire enfim estoura 15s, _getAccessToken devolve Bearer ANON, RLS nega, app 'perde conexão com o BD'. A partir daí TUDO o que os outros laudos descreveram são CONSEQUÊNCIAS do mesmo lock travado, não bugs independentes: (i) o DRAIN inerte — watchdog 10s, scheduleRetryDrain, onlineManager.subscribe re-executam o drain mas cada tentativa reconverge em authedRpc→getValidSession→o MESMO lock wedged → break → drained:0 → backoff → re-bate na mesma falha (o mutex de drain está saudável; o preso é o refresh upstream); (ii) a AUTO-DESTRUIÇÃO de sessão — o refresh falha repetidamente, refreshFailCount (global, sem decay) atinge 2, emitAuthLost → signOut, e o getValidSession-gate aborta o drain antes de rodar; (iii) no browser, a camada extra do onlineManager sticky-false + offlineFirst sem resumePausedMutations adiciona um segundo wedge para SOS/leituras. As DUAS restrições são satisfeitas por construção: cross-platform porque o lock é incondicional e a cadeia é o mesmo bundle JS no browser e no WebView; e reload-resolve porque PROCESS_LOCKS/lockAcquired/refreshingDeferred/refreshPromise/refreshFailCount/o fetch órfão vivem SÓ em memória do client e do módulo, e nenhum tem caminho de reset em runtime fora de sucesso/signOut. Por que ~30 versões não resolveram: todas as defesas (timeout 8s, lockAcquireTimeout 15s, zombie-killer, watchdog 10s, MAX_REFRESH_FAILS, spurious-guard, cold-start 30s) tratam SINTOMAS a jusante do lock — nenhuma (i) aborta de fato o fetch do refresh, (ii) impede o refresh inline sob lock na leitura de header, nem (iii) desacopla auth de query. O fix de maior alavancagem, nunca tentado, está na própria API: passar a opção custom `accessToken` no createClient faz _getAccessToken retornar `await this.accessToken()` (index.cjs:522) SEM getSession/lock, eliminando o acoplamento na raiz — com o app gerenciando o refresh via sessionManager (que já existe). Em segundo plano: alinhar TOKEN_EXPIRY_MARGIN_SEC a 90s (matar o gatilho), dar AbortController/decay aos timeouts, e não fazer signOut por AuthLost transitório. O descompasso v3 (cliente chama _v3, migrations só têm _v2) é um TERCEIRO bug aditivo de higiene de contrato que coexiste mas não explica o sintoma central (404 esvaziaria a fila, não a prenderia).

### O que exatamente o reload reseta
O reload reseta EXCLUSIVAMENTE estado em memória do cliente JS vivo — nada em storage muda (a fila persiste intacta em Preferences/localStorage e drena no boot). Especificamente: (1) o dicionário PROCESS_LOCKS e a flag lockAcquired do GoTrueClient (processLock é mutex em memória do processo, supabase.js:44-45) — a operação de refresh zombie e a chain do lock são descartadas; (2) this.refreshingDeferred e o autoRefreshTicker internos do auth-js; (3) o fetch /token órfão suspenso sem AbortController (o novo event-loop o mata); (4) refreshPromise e refreshFailCount globais do sessionManager (sessionManager.js:42-43) — voltam a null/0 sem decay em runtime; (5) lastColdStartAt e lastResumeAt module-scope (markDose.js:54, useAppResume.js:41); (6) o singleton onlineManager (#online volta a true no construtor novo) e os retryers/mutations pausados do QueryClient. A resposta MAIS diagnóstica: o reload reconstrói o objeto GoTrueClient com PROCESS_LOCKS={} e força um getValidSession síncrono com client fresco (main.jsx:476) que refresca limpo ANTES do mount — algo que o caminho de resume do cliente vivo nunca faz (lá getValidSession é gate bloqueante que aborta o drain). Por isso o reload re-emite a request com Bearer JWT válido e a fila esvazia, enquanto o cliente vivo permanece servindo Bearer ANON (index.cjs:524) indefinidamente.

---

## 2. Agravantes (contributing causes)

**1. Margem de expiração divergente 30s (sessionManager) vs 90s (auth-js EXPIRY_MARGIN_MS) — o GATILHO determinístico que re-arma o wedge a cada ciclo idle** _(alta)_

getValidSession trata token válido se faltam >30s (TOKEN_EXPIRY_MARGIN_SEC=30, sessionManager.js:38,86) e devolve a sessão SEM refrescar. Mas a leitura de header subsequente via __loadSession considera hasExpired quando falta <90s (EXPIRY_MARGIN_MS=3×30000, confirmado em constants.js:6-13) e dispara _callRefreshToken INLINE dentro do lock (GoTrueClient.js:2333-2361). Resultado: em TODA janela 30-90s antes do exp, getValidSession diz 'ok', segue pra RPC, e a montagem do header re-dispara um refresh sob lock — exatamente ao voltar de idle. Isso torna o wedge re-disparável SEMPRE, não eventual, satisfazendo o 'acontece SEMPRE' do usuário. Alinhar TOKEN_EXPIRY_MARGIN_SEC para >=90s (refrescar antes do auth-js tentar inline) elimina o gatilho.

**2. Timeout de refresh (8s) sem AbortController + budget de RPC (10s) menor que lockAcquireTimeout (15s)** _(alta)_

doRefresh (sessionManager.js:104-108) só faz Promise.race com setTimeout — rejeita o promise JS mas o refreshSession()/fetch /token subjacente continua vivo segurando o lock (sem signal/abort). E authedRpc usa 10s (sessionManager.js:147) < lockAcquireTimeout 15s (supabase.js:54), garantindo que a RPC SEMPRE estoura TimeoutError antes do lock liberar → fila. Nenhuma das ~30 defesas (timeout 8s, zombie-killer, watchdog) aborta de fato o fetch órfão nem desacopla auth de query.

**3. Auto-destruição de sessão por falha transitória: refreshFailCount global sem decay + 3 caminhos de signOut no resume/heartbeat** _(alta)_

refreshFailCount é módulo-global e só reseta em sucesso ou emitAuthLost (sessionManager.js:43,53,122) — sem decay temporal. 2 timeouts de 8s consecutivos (rádio acordando pós-background) atingem MAX_REFRESH_FAILS=2 → emitAuthLost → useAppResume chama supabase.auth.signOut() em 3 pontos (useAppResume.js:72,169,180). Pior: getValidSession é gate BLOQUEANTE no resume — ao lançar AuthLostError faz `return` (useAppResume.js:73) ANTES do drainPendingMutations (linha 96), então a única retomada que poderia drenar é a que aborta. Amplificador do wedge primário, não causa independente (exige 2 falhas).

**4. onlineManager sticky-false no WEB (setEventListener custom só no nativo) + networkMode 'offlineFirst' sem resumePausedMutations** _(media)_

main.jsx:288 gateia o setEventListener custom em isNativePlatform; o web fica nos eventos window online/offline (um 'offline' sem 'online' subsequente trava isOnline()=false), sem re-sync (useAppResume.js:81 native-gated) e sem re-leitura de navigator.onLine no focus. Com networkMode='offlineFirst' (main.jsx:249,258) o retryer pausa mutations/queries quando isOnline()=false e resumePausedMutations NUNCA é chamado em src (confirmado: só comentários mortos do PersistQueryClientProvider removido). Governa o 'sem conexão genérico' no navegador, SOS [registerSos] e leituras stale — segundo bug real, mas NÃO o caminho central de marcar dose (confirm/skip/undo usa authedRpc+pendingMutationsQueue própria, fora do networkMode).

**5. Descompasso cliente↔migration nas RPCs v3 (bug ADITIVO de contrato, não o root cause do sintoma central)** _(media)_

O cliente chama confirm_dose_v3/skip_dose_v3/undo_dose_v3 com p_request_id (markDose.js:66-70) mas as migrations versionadas só definem _v2 (grep em supabase/migrations: só confirm_dose_v2/skip_dose_v2/undo_dose_v2; nenhuma tabela mutation_log; commit b3e572f menciona 'RPCs v3' mas o SQL nunca foi commitado). Como o usuário CONSEGUE marcar doses (a fila drena no reload) e ~30 versões shipparam, os _v3 quase certamente EXISTEM em prod aplicados via dashboard. Se NÃO existissem, todo mark daria 404 PGRST202 → não casa isNetworkError (markDose.js:94-99) → cai em 'erro real' → revertDose+queueRemove (markDose.js:219-220) ESVAZIANDO a fila, o OPOSTO do sintoma. Logo 404-v3 viola a restrição 'fila presa + reload resolve' e não pode ser o root cause; permanece um risco de higiene de contrato a verificar no backend real.

**6. Agravantes nativos: SecureStorage async sem timeout sob lock + Worker nativo detendo refresh_token** _(media)_

No nativo o storage do auth é SecureStorageAdapter async sem timeout (supabase.js:14-29), e get/set rodam DENTRO do lock (__loadSession/_saveSession) — bridge Capacitor lenta/suspensa retém o lock. criticalAlarm/useAuth passa refreshToken+accessToken ao Worker nativo (useAuth.jsx:208-219), um segundo refresher concorrente pelo mesmo refresh_token rotacionável. Ambos crossPlatform=false (o bug ocorre no browser sem eles), portanto só aumentam frequência/severidade no Android.

---

## 3. Hipoteses descartadas (e por que)

**1. Realtime / WebSocket como root cause do sintoma universal**

→ Para o usuário solo (~80% da base) o Realtime está FISICAMENTE DESLIGADO: useRealtime.js:80 exige hasCollabContext (sharedIds>0 || outboundShared>0, useAccessiblePatientIds.js:97), false sem share → channel.subscribe() nunca roda → WebSocket nem abre. Um subsistema sem conexão ativa não produz um sintoma que ocorre SEMPRE para todos. markDose não depende de Realtime (optimistic + queueAdd + authedRpc direto). No máximo deixa UI de cuidador stale (RT-01 setAuth ausente pós-refresh, RT-03 resume DOM-dependente) — risco residual só para quem compartilha. Logs realtime do backend vieram vazios, consistente.

**2. @supabase/supabase-js / auth-js DESATUALIZADO (^2.45.0) com races de token-refresh não corrigidos**

→ Premissa FALSA do briefing. O caret ^2.45.0 resolveu para 2.103.3 — confirmado em node_modules/@supabase/auth-js/package.json e .../supabase-js/package.json (version:2.103.3). Os fixes de _recoverAndRefresh / lock handling / token-refresh race pós-2.45 JÁ estão presentes. O root cause NÃO é lib velha — é a configuração/uso (processLock incondicional + margem divergente + timeout sem abort) sobre uma lib atual. Atualizar a lib não resolveria; mudar a config (accessToken custom / margem / abort) resolve.

**3. Poison-pill server-side SRV-03 (INVALID_TRANSITION 400 sem request_id idempotente) como causa da fila presa**

→ Toda a evidência server-side veio do PROJETO ERRADO: list_projects confirma que o único ref acessível pelo token MCP é bccpurtcrnadtfhstrrb (schema dosy, projeto dosy-v2), mas a prod REAL apontada pelo app é guefraaqbkcehofchnrc (.env: VITE_SUPABASE_URL=...ehofchnrc, VITE_SUPABASE_SCHEMA=medcontrol; supabase.js:56 db.schema=SCHEMA), inacessível pelo token. O pg_proc só-confirm_dose-sem-request_id, os logs sem-4xx e o pool 13/60 são do schema dosy que o cliente de prod nem usa. Além disso, um 400/poison-pill não seria limpo por reload (a função/estado server-side não muda), violando a restrição 'reload resolve'. Rebaixado.

**4. Saturação de connection pool / PgBouncer-Supavisor ('perde a conexão com o BD' = pool exhaustion)**

→ pg_stat_activity (no backend acessível) mostra 13/60 conexões, sem queueing, sem idle-in-transaction leak, statement_timeout 120s. O 'perde conexão com BD' é percepção do CLIENTE (supabase-js vivo crendo-se offline / fetch preso / Bearer anon), não o BD recusando conexões. Reload não resetaria saturação server-side de qualquer forma.

**5. Mutex de drain (currentDrainPromise) preso como zombie sendo a causa da fila inerte**

→ Descartado por evidência no código: markDose.js:449-452 o .finally SEMPRE limpa currentDrainPromise; e o drain retorna RÁPIDO com drained:0 (cada RPC estoura 8-10s e o break corta os demais chunks, markDose.js:513), nunca roda os 60s do zombie-killer (markDose.js:442). O mutex de drain está saudável. O que fica preso é o refresh/lock UPSTREAM (sessionManager.refreshPromise + processLock interno). O drain é SINTOMA que reconverge no mesmo lock wedged, não causa.

---

## 4. Relatorio detalhado

## Relatorio de Root Cause — Bug cronico "perde conexao com o BD / fila travada ate fechar-abrir"

### (a) Resumo executivo

O root cause e um **acoplamento entre autenticacao e dados pelo mesmo mutex em memoria** (`processLock`) dentro do cliente supabase-js vivo. Toda RPC PostgREST monta o header `Authorization` chamando `getSession()`, que adquire o MESMO lock que o `refreshSession()`. Quando o app fica idle/background, o refresh de token roda inline dentro desse lock; se a WebView/aba congela o `fetch /token` no meio, o lock fica retido e nenhuma operacao de dados libera o token. Como o orcamento de timeout da RPC (10s) e menor que o `lockAcquireTimeout` (15s), a marcacao de dose estoura `TimeoutError` antes do lock liberar e cai na fila; quando o lock finalmente expira, `_getAccessToken` devolve a **chave anon** (`Bearer anon`), o RLS nega e o app "perde conexao". Fechar-e-abrir resolve porque todo esse estado vive 100% em memoria (`PROCESS_LOCKS`, `refreshingDeferred`, `refreshPromise`, `refreshFailCount`, o `fetch` orfao) e so um cliente fresco o limpa. Acontece no navegador porque o lock e aplicado **incondicionalmente** (sem guard de plataforma) e a cadeia e o mesmo bundle JS no Chrome e na WebView.

**Correcao importante de premissa (confirmada por leitura do codigo instalado):** a versao de `@supabase/supabase-js` e `@supabase/auth-js` instalada e **2.103.3**, nao 2.45 (o `^2.45.0` do package.json resolveu para 2.103.3 — `node_modules/@supabase/auth-js/package.json` e `.../supabase-js/package.json`). Atualizar a lib **nao** resolve; o problema e a configuracao/uso (lock incondicional + margem divergente + timeout sem abort) sobre uma lib ja atual.

**Correcao critica ao fix proposto pelo veredito:** li o codigo instalado e a opcao custom `accessToken` no `createClient` **NAO pode ser aplicada ao cliente atual como esta**. Em `index.cjs:379-387`, quando `accessToken` e passado, o supabase-js substitui TODO o namespace `supabase.auth` por um Proxy que LANCA erro em qualquer acesso ("accessing supabase.auth.X is not possible") e nao registra `_listenForAuthEvents`. Como o app usa `supabase.auth.signInWithPassword / getSession / refreshSession / onAuthStateChange / signOut / verifyOtp / updateUser` em todo lugar (`useAuth.jsx`, `sessionManager.js`, `useAppResume.js`), passar `accessToken` no cliente unico quebraria login, restauracao de sessao e os listeners de auth. O fix correto e um **cliente de dados separado (dual-client)**: mantem o cliente de auth atual e cria um segundo cliente data-only com `accessToken: async () => (await getValidSession()).access_token`, usado por TODAS as RPCs/leituras. Isso desacopla auth de dados na raiz sem quebrar os fluxos de auth.

### (b) Mecanismo em detalhe

**O que trava (cadeia confirmada em codigo instalado 2.103.3):**

1. App idle/background. O token entra na janela 30-90s antes do `exp`.
2. `sessionManager.getValidSession()` (`sessionManager.js:86`) considera o token valido se faltam >30s e **retorna sem refrescar** (`TOKEN_EXPIRY_MARGIN_SEC=30`).
3. A RPC seguinte chama `supabase.rpc()` -> `fetchWithAuth` (`index.cjs:108`: `const accessToken = (await getAccessToken()) ?? supabaseKey`) -> `_getAccessToken` (`index.cjs:519-524`) -> `this.auth.getSession()` -> `_acquireLock(15000)` -> `__loadSession`. Dentro de `__loadSession` o auth-js usa `EXPIRY_MARGIN_MS = 90s` (3 x 30000) e considera o token "expirado-com-margem" -> dispara `_callRefreshToken` **INLINE dentro do lock**.
4. Se a WebView/aba congela esse `fetch /token` no meio (Doze, suspend do SO, throttle de aba), o refresh nao resolve e o lock fica retido. O timeout de 8s do `doRefresh` (`sessionManager.js:104-108`) e apenas `Promise.race` com `setTimeout` — **rejeita o promise JS mas NAO aborta o fetch** (sem `AbortController`) nem libera o lock.
5. Toda nova RPC (markDose -> authedRpc -> getValidSession -> getSession -> `_acquireLock`) espera o lock. Como `authedRpc` usa 10s (`sessionManager.js:147`) e o `lockAcquireTimeout` e 15s (`supabase.js:54`), a RPC **sempre** estoura `TimeoutError` antes do lock liberar -> a dose vai para `_pendingSync` + fica na fila (`markDose.js:210-215`).
6. Quando o acquire enfim estoura 15s, `_getAccessToken` resolve sessao vazia e retorna `this.supabaseKey` = anon (`index.cjs:524`) -> `Bearer anon` -> RLS nega -> "sem conexao".

**Por que reload resolve:** todo estado wedged vive em memoria do objeto `GoTrueClient` e do modulo `sessionManager`: `PROCESS_LOCKS={}`, `lockAcquired`, `refreshingDeferred`, `refreshPromise` (`sessionManager.js:42`), `refreshFailCount` (`:43`), o `autoRefreshTicker` e o `fetch /token` orfao. **Nada em storage muda** (a fila persiste intacta em Preferences/localStorage). O reload destroi a WebView/aba, recria o cliente com locks zerados e descarta o fetch suspenso. Decisivo: o `boot()` em `main.jsx:474-476` faz `await getValidSession()` SINCRONO com cliente fresco e dispara `drainPendingMutations` fire-and-forget INDEPENDENTE do getValidSession (`main.jsx:453`). O cliente vivo nunca reexecuta esse caminho — no resume, `getValidSession` e um gate bloqueante que, ao lancar `AuthLostError`, faz `return` ANTES do drain (`useAppResume.js:67-73,96`).

**Por que acontece no browser tambem:** o `lock: processLock` esta dentro do bloco `auth` que vale web E nativo — so o `storage: SecureStorageAdapter` e gated em `isNative` (`supabase.js:37 vs :45`). A cadeia `fetchWithAuth -> _getAccessToken -> getSession -> _acquireLock -> __loadSession -> _callRefreshToken-inline` e o mesmo bundle byte-a-byte no Chrome e na WebView; `EXPIRY_MARGIN_MS=90s` e a mesma constante. Quando a aba e throttled/congelada em background, o `fetch /token` pendura igual. No web o usuario fica AINDA mais exposto: o `onlineManager.setEventListener` custom so e instalado no nativo (`main.jsx:288`), deixando o web nos eventos `window online/offline` (sticky-false); nao ha re-sync no resume (`useAppResume.js:81` native-gated) nem `resumePausedMutations` (nunca chamado em `src/`). Isso adiciona uma SEGUNDA camada de wedge para leituras/SOS no navegador.

### (c) Tabela "O que esta errado"

| # | Problema | Camada | Severidade | Evidencia |
|---|----------|--------|-----------|-----------|
| 1 | `lock: processLock` aplicado INCONDICIONALMENTE (web tambem) acopla refresh de token e leitura de header de TODA RPC no mesmo mutex em memoria | JS compartilhada (supabase-js client) | Critica | `supabase.js:45,54`; `index.cjs:108,519-524` |
| 2 | Custom `accessToken` (fix proposto) NAO aplicavel ao cliente unico — desativa `supabase.auth.*` inteiro (Proxy que lanca) e nao registra auth events | JS compartilhada | Critica (afeta desenho do fix) | `index.cjs:379-387,402,522` |
| 3 | Margem de expiracao divergente: `getValidSession` 30s vs auth-js `EXPIRY_MARGIN_MS` 90s — gatilho deterministico que re-arma o wedge a cada ciclo idle ("acontece SEMPRE") | sessionManager | Alta | `sessionManager.js:38,86`; auth-js `constants` 3x30000=90000 |
| 4 | `doRefresh` so faz `Promise.race` com `setTimeout` — rejeita o promise JS mas NAO aborta o `fetch /token` (sem `AbortController`), que continua segurando o lock | sessionManager | Alta | `sessionManager.js:104-108` |
| 5 | Budget de RPC (10s) menor que `lockAcquireTimeout` (15s) — garante `TimeoutError` ANTES do lock liberar, mandando a dose pra fila | sessionManager + supabase | Alta | `sessionManager.js:147`; `supabase.js:54` |
| 6 | `refreshFailCount` global sem decay temporal + 3 caminhos de `signOut()` por `AuthLost` transitorio no resume/heartbeat; gate aborta o drain | lifecycle | Alta | `sessionManager.js:43,53,111,127`; `useAppResume.js:67-73,168-169,178-181` |
| 7 | Heartbeat faz early-return quando `visibilityState==='hidden'` — refresh proativo morre exatamente em background | lifecycle | Alta | `useAppResume.js:163` |
| 8 | `lastResumeAt` global serve a debounce E a medir `inactiveMs` — `markColdStart` (timeout 30s) raramente dispara, primeira RPC pos-idle usa 10s e estoura | lifecycle | Alta | `useAppResume.js:41,51-62` |
| 9 | `onlineManager` sticky-false no WEB (bridge custom so no nativo) + `networkMode: 'offlineFirst'` sem `resumePausedMutations` — pausa mutations/queries para sempre | conectividade + React Query | Media-Alta | `main.jsx:249,257,288`; `useAppResume.js:81`; sem `resumePausedMutations` em `src/` |
| 10 | `registerSos` (SOS via TanStack) herda `offlineFirst` sem override `networkMode:'always'` — pausa eternamente sob onlineManager travado | conectividade | Alta | `mutationRegistry.js` (registerSos sem override); `SOS.jsx` |
| 11 | Descompasso de contrato: cliente chama `confirm_dose_v3/skip_dose_v3/undo_dose_v3` com `p_request_id`, mas as migrations versionadas so definem `_v2` (schema `medcontrol`) e nao ha `mutation_log` | cliente + backend SQL | Media | `markDose.js:66-70`; migrations so tem `confirm_dose_v2/skip_dose_v2/undo_dose_v2`, sem `p_request_id`/`mutation_log` |
| 12 | Realtime nunca recebe `realtime.setAuth()` apos refresh — canal de cuidador pode usar JWT velho (so afeta quem compartilha) | realtime | Media | sem `setAuth` no fluxo realtime em `src/`; `useAuth.jsx` propaga token so pro Worker nativo |
| 13 | Agravantes nativos: `SecureStorageAdapter` async sem timeout sob o lock + Worker nativo detendo `refresh_token` (segundo refresher concorrente) | nativo | Media | `supabase.js:14-29,37`; `useAuth.jsx:208-219` |

### (d) Por que ~30 versoes de patches nao resolveram

Todas as defesas empilhadas tratam SINTOMAS **a jusante do lock**, sem atacar o acoplamento auth-dados:

- **`lockAcquireTimeout 15s`** (`supabase.js:54`) limita so a AQUISICAO, nao o `fn()` em execucao; e ainda PIORA a percepcao porque garante 15s de espera antes de cair em anon key.
- **`doRefresh` timeout 8s** (`sessionManager.js:104-108`) rejeita o promise JS mas deixa o `fetch` real vivo segurando o lock — nunca aborta de fato.
- **`zombie-mutex-killer 60s`** (`markDose.js:442`) nunca dispara: o drain retorna RAPIDO com `drained:0` (cada RPC estoura 8-10s e o `break` corta os chunks restantes em `markDose.js:513`), entao `currentDrainPromise` se limpa normalmente no `.finally` (`:449-452`). O mutex de drain esta saudavel; o preso e o refresh/lock UPSTREAM.
- **`watchdog 10s`, `scheduleRetryDrain` backoff, `window 'online'`, `onlineManager.subscribe`** (`markDose.js:380-419`) apenas re-executam o drain, que reconverge em `authedRpc -> getValidSession -> o MESMO lock wedged` -> `failedTransient` -> `break` -> `drained:0` -> backoff dobra -> re-bate na mesma falha.
- **`MAX_REFRESH_FAILS=2` + spurious-guard** amplificam: 2 timeouts transitorios disparam `emitAuthLost -> signOut`, e o gate de resume aborta o drain antes de ele rodar.
- **`cold-start timeout 30s`** depende de `markColdStart`, que quase nunca dispara por causa do bug do `inactiveMs` (`useAppResume.js:51-62`).

Nenhuma dessas (i) aborta de fato o `fetch` do refresh, (ii) impede o refresh inline sob lock na leitura de header, nem (iii) **desacopla auth de query**. O unico fix de raiz e tirar o caminho de dados de dentro do lock de auth (cliente de dados com `accessToken` custom alimentado pelo `getValidSession`), alinhar a margem (30s -> 90s), dar abort/decay aos timeouts e parar de fazer `signOut` por `AuthLost` transitorio.

---

## 5. Lista de tarefas (ordem de execucao)

### #1 — Instrumentar e confirmar o lock-wedge com auth debug + captura do Bearer (browser + S25U)

- **Tipo:** investigacao | **Risco:** baixo | **Depende de:** nenhuma
- **Arquivos:** `src/services/supabase.js (auth.debug condicional), scripts/qa-v028/ (novo script de captura CDP/DevTools)`
- **Mudanca:** Ativar temporariamente auth:{ debug: import.meta.env.DEV || flag } no createClient. Num ciclo background->foreground real no S25U E na aba dosymed.app: (a) procurar nos logs um '#_acquireLock begin' SEM '#_acquireLock end' apos idle; (b) capturar via CDP/DevTools Network o header Authorization das requests /rest/v1 durante um episodio wedged e checar se o Bearer e a ANON key (VITE_SUPABASE_ANON_KEY) vs JWT real; (c) logar Date.now() antes/depois de await getValidSession() em authedRpc (sessionManager.js:156) pra medir se consome ~15s.
- **Por que:** Confianca do veredito e 0.74. Begin-sem-end + Bearer anon cravam o root cause antes de mexer na arquitetura do cliente. Se o Bearer for JWT real, o root cause e outro e poupa um refactor grande.
- **Validacao:** Begin-sem-end nos logs apos idle E Bearer=anon durante wedge = root cause confirmado. Ausencia refuta e promove o wedge do onlineManager (web).

### #2 — Verificar no backend de prod (guefraaqbkcehofchnrc / schema medcontrol) se confirm_dose_v3/skip_dose_v3/undo_dose_v3 e mutation_log existem

- **Tipo:** investigacao | **Risco:** baixo | **Depende de:** nenhuma
- **Arquivos:** `backend Supabase prod (via dashboard/SQL), supabase/migrations/ (auditoria local)`
- **Mudanca:** Rodar SELECT proname, proargnames FROM pg_proc WHERE proname LIKE '%_dose_v3' no schema medcontrol do projeto de prod real (guefraaqbkcehofchnrc). Confirmar tambem se existe a tabela mutation_log com PK request_id. As migrations locais so tem _v2 (sem p_request_id, sem mutation_log) — markDose.js:66-70 chama _v3 com p_request_id. Se _v3 NAO existir, todo mark da 404 PGRST202 (segundo modo de falha).
- **Por que:** Confirmado por leitura: as migrations versionadas so definem _v2 em medcontrol. Se _v3 nao existe em prod, ha um bug aditivo de contrato. Como o usuario consegue marcar doses, _v3 provavelmente foi aplicado via dashboard sem migration commitada — precisa ser confirmado e a migration commitada pra reprodutibilidade.
- **Validacao:** pg_proc retorna as 3 funcoes _v3 com p_request_id e mutation_log existe = contrato OK (so falta commitar migration). Se nao existir, abrir tarefa separada de criacao das RPCs v3 idempotentes.

### #3 — Alinhar TOKEN_EXPIRY_MARGIN_SEC (30s -> 90s) para matar o gatilho do refresh inline sob lock

- **Tipo:** fix | **Risco:** baixo | **Depende de:** 1
- **Arquivos:** `src/services/sessionManager.js`
- **Mudanca:** Mudar TOKEN_EXPIRY_MARGIN_SEC de 30 para 90 (sessionManager.js:38), igualando o EXPIRY_MARGIN_MS=90s do auth-js. Assim getValidSession refresca PROATIVAMENTE (via doRefresh com mutex) na janela 30-90s, ANTES de __loadSession tentar o refresh inline dentro do lock na montagem do header.
- **Por que:** Quick win de 1 linha que remove o gatilho deterministico que re-arma o wedge a cada ciclo idle (explica o 'acontece SEMPRE'). Hoje getValidSession diz 'ok' na janela 30-90s e deixa o auth-js disparar o refresh escondido sob lock.
- **Validacao:** Logar secsUntilExpiry em getValidSession e confirmar via auth debug que o refresh inline ('session has expired' + _callRefreshToken) deixa de ocorrer na montagem do header. Repro tab-hidden 30-60min + marcar dose: nao deve mais ir pra fila com internet OK.

### #4 — Adicionar AbortController real ao refresh + alinhar budgets (RPC > lockAcquireTimeout)

- **Tipo:** fix | **Risco:** medio | **Depende de:** 1,3
- **Arquivos:** `src/services/sessionManager.js, src/services/supabase.js`
- **Mudanca:** (a) Em doRefresh: trocar o Promise.race nu por um caminho que aborte de fato — usar AbortController e passar o signal ao fetch global do supabase (via options.global.fetch wrapper em supabase.js que respeita signal), ou reduzir lockAcquireTimeout para um valor MENOR que o timeout de refresh para o lock liberar antes do budget. (b) Garantir que authedRpc timeoutMs (10s) seja MAIOR que lockAcquireTimeout (hoje 15s) — reduzir lockAcquireTimeout para ~7s OU subir o timeout de RPC, de forma que o lock libere ANTES da RPC desistir, evitando o fallback anon. Documentar a relacao no codigo.
- **Por que:** Hoje o fetch orfao continua segurando o lock (sem abort) e a RPC desiste antes do lock liberar (10s < 15s), garantindo fila + Bearer anon. Abortar o fetch e/ou inverter a relacao de budgets quebra essa armadilha.
- **Validacao:** Instrumentar latencia de getValidSession; num episodio simulado (tab congelada) confirmar que o lock libera dentro do budget e a RPC nao cai em anon. Verificar que refresh real abortado nao deixa refreshingDeferred sujo.

### #5 — ROOT CAUSE: criar cliente de dados separado (dual-client) com accessToken custom alimentado por getValidSession

- **Tipo:** fix | **Risco:** alto | **Depende de:** 1,3,4
- **Arquivos:** `src/services/supabase.js, src/services/sessionManager.js, src/services/markDose.js, src/services/fetchDashboard.js, e todos os call-sites de supabase.rpc/.from() para dados`
- **Mudanca:** Manter o cliente de auth atual (supabase) para login/sessao/refresh/onAuthStateChange/signOut/realtime.setAuth — INTOCADO. Criar um SEGUNDO cliente data-only: createClient(URL, KEY, { db:{schema:SCHEMA}, accessToken: async () => { const s = await getValidSession(); return s.access_token } }). ATENCAO (confirmado em index.cjs:379-387): com accessToken custom, supabase.auth vira um Proxy que LANCA em qualquer acesso e _listenForAuthEvents nao roda — por isso NUNCA usar esse cliente para auth, e por isso PRECISA ser um segundo cliente, nao trocar o existente. Apontar authedRpc, markDose drain, fetchDashboard e as leituras PostgREST para o cliente de dados. _getAccessToken passa a retornar await this.accessToken() (index.cjs:522) SEM getSession/_acquireLock — eliminando o acoplamento auth<->query na raiz.
- **Por que:** Este e o fix de maior alavancagem e o unico que ataca o root cause: tira o caminho de dados de dentro do processLock de auth. getValidSession ja existe e gerencia o refresh com mutex proprio; o cliente de dados so consome o token. Correcao critica ao veredito: NAO da pra passar accessToken no cliente unico (quebraria todo o supabase.auth do app) — tem que ser dual-client.
- **Validacao:** Em staging/teste-plus: (a) confirmar que requests /rest/v1 saem com Bearer JWT mesmo apos idle longo (nunca anon); (b) markDose para de cair em pendingSync pos-idle; (c) login/onAuthStateChange/realtime/refresh continuam funcionando (cliente de auth intacto); (d) auth debug mostra que getSession()/_acquireLock NAO sao mais chamados no caminho de dados. Repro tab-hidden 30-60min no browser + marcar dose: grava direto.

### #6 — Propagar token ao Realtime no refresh via o cliente de auth (realtime.setAuth)

- **Tipo:** fix | **Risco:** baixo | **Depende de:** 5
- **Arquivos:** `src/services/sessionManager.js (apos refresh bem-sucedido) ou src/hooks/useAuth.jsx (no TOKEN_REFRESHED)`
- **Mudanca:** Apos cada refresh bem-sucedido (doRefresh sucesso) e no evento TOKEN_REFRESHED, chamar supabase.realtime.setAuth(novoAccessToken) no cliente de AUTH (o de dados nao deve gerir realtime). Garante que canais postgres_changes de cuidadores nao fiquem com JWT velho. Como o cliente de dados usa accessToken custom, o realtime continua no cliente de auth.
- **Por que:** Hoje o app nunca chama realtime.setAuth apos refresh (so propaga token pro Worker nativo). So afeta quem compartilha pacientes, mas e correcao barata que evita canal mudo pos-idle no cuidador.
- **Validacao:** Com 2 contas (teste-plus compartilha com teste-pro): apos idle longo + refresh, confirmar que UPDATE cross-account ainda chega no canal sem precisar re-mount. Verificar nos logs realtime que o socket reautentica.

### #7 — Parar de fazer signOut por AuthLost transitorio + dar decay a refreshFailCount + rodar drain independente do getValidSession no resume

- **Tipo:** fix | **Risco:** medio | **Depende de:** 5
- **Arquivos:** `src/hooks/useAppResume.js, src/services/sessionManager.js`
- **Mudanca:** (a) Nos 3 catch de AuthLost (useAppResume.js:67-73 resume, :168-169 heartbeat, :178-181 onAuthLost) NAO chamar supabase.auth.signOut() — em vez disso degradar para banner 'reconectando' e re-tentar; so deslogar em erro de auth DEFINITIVO (401/403 real do getUser, ja existente em useAuth). (b) Dar decay temporal a refreshFailCount (reset apos ~5min sem nova falha) em sessionManager.js. (c) No resume, rodar drainPendingMutations + fetchDashboard INDEPENDENTE do resultado de getValidSession (igual ao boot fail-soft em main.jsx:453), nao abortar com return antes do drain.
- **Por que:** Hoje 2 timeouts transitorios (radio acordando) atingem MAX_REFRESH_FAILS=2 -> emitAuthLost -> signOut, e o gate de resume aborta o drain antes de ele rodar. E a unica retomada que poderia drenar a fila e exatamente a que se auto-destroi. Com o dual-client (tarefa 5) o AuthLost fica raro, mas isso elimina o modo catastrofico.
- **Validacao:** Simular 2 falhas de refresh consecutivas (throttle de rede) e confirmar que NAO ha signOut e que o drain roda. Confirmar que o usuario nao e mais ejetado para login por glitch de rede transitorio.

### #8 — Corrigir heartbeat hidden-guard e a medicao de inactiveMs (markColdStart)

- **Tipo:** fix | **Risco:** medio | **Depende de:** 5
- **Arquivos:** `src/hooks/useAppResume.js`
- **Mudanca:** (a) Remover/relaxar o guard 'if visibilityState===hidden return' do heartbeat (useAppResume.js:163) OU fazer refresh proativo no proprio onResume sincronamente — o heartbeat e o unico refresh proativo JS e hoje morre exatamente em background. (b) Separar lastResumeAt (debounce) de uma variavel dedicada lastBackgroundEnteredAt setada no onPause, e calcular inactiveMs = now - lastBackgroundEnteredAt (useAppResume.js:41,51-62), pra markColdStart (timeout 30s) disparar corretamente apos idle longo.
- **Por que:** Com o dual-client o token nunca trava o dado, mas estes dois bugs ainda fazem a primeira RPC pos-idle usar timeout 10s curto e o refresh proativo nao rodar em background — agravantes residuais que mantem latencia/risco.
- **Validacao:** Logar inactiveMs e confirmar que reflete o tempo real de background (nao ~0). Apos idle 30min, confirmar que markColdStart disparou (timeout 30s na primeira RPC) e que o refresh proativo ocorreu.

### #9 — Instalar bridge de onlineManager no WEB + override networkMode:'always' no registerSos

- **Tipo:** fix | **Risco:** medio | **Depende de:** 1
- **Arquivos:** `src/main.jsx, src/services/mutationRegistry.js, src/hooks/useAppResume.js`
- **Mudanca:** (a) Instalar um setEventListener custom TAMBEM no web (hoje gated em isNativePlatform, main.jsx:288): inicializar com navigator.onLine e re-ler navigator.onLine em visibilitychange/focus chamando setOnline(navigator.onLine) — elimina o sticky-false. (b) Re-sync onlineManager no resume tambem no web (remover o gate isNativePlatform em useAppResume.js:81 para o setOnline(navigator.onLine)). (c) Adicionar networkMode:'always' ao registerSos em mutationRegistry.js (hoje herda 'offlineFirst' e pausa eternamente sem resumePausedMutations). Considerar networkMode:'always' global nas mutations, dado que markDose ja tem fila offline propria.
- **Por que:** Segundo wedge confirmado no navegador: onlineManager trava isOnline()=false (um 'offline' sem 'online' subsequente) e o 'offlineFirst' pausa mutations/queries sem ninguem chamar resumePausedMutations (removido com o persister na v0.2.7.0). Governa o 'sem conexao generico' no web, SOS e leituras stale.
- **Validacao:** No browser durante o sintoma, no console comparar onlineManager.isOnline() vs navigator.onLine — apos o fix nunca deve ficar false enquanto navigator.onLine=true. SOS deve persistir sem reload. Disparar 'offline' sintetico e confirmar recuperacao no focus.

### #10 — Hardening nativo: timeout no SecureStorageAdapter + reconciliar refresher unico (Worker vs JS)

- **Tipo:** melhoria | **Risco:** medio | **Depende de:** 5,7
- **Arquivos:** `src/services/supabase.js, src/services/criticalAlarm.js, src/hooks/useAuth.jsx`
- **Mudanca:** (a) Envolver getItem/setItem/removeItem do SecureStorageAdapter (supabase.js:14-29) em Promise.race com timeout curto (~3s) para a bridge Capacitor lenta/suspensa nao reter o lock do cliente de AUTH dentro de __loadSession/_saveSession. (b) Confirmar que o Worker nativo NAO faz refresh concorrente pelo mesmo refresh_token rotacionavel — o JS deve ser a unica fonte de refresh; o Worker so consome accessToken cached (useAuth.jsx:208-219). Se o Worker refresca, remover essa capacidade.
- **Por que:** Agravantes puramente nativos que aumentam a frequencia no Android. Com o dual-client o storage so afeta o cliente de auth, mas refresh concorrente ainda pode gerar 'Already Used' -> _removeSession -> SIGNED_OUT.
- **Validacao:** S25U: apos Doze 30-60min, confirmar que nao ha 'Invalid Refresh Token: Already Used' nos logs auth e que o cliente de auth nao trava em setItem/getItem (logar latencia do adapter).

### #11 — Reverter instrumentacao temporaria (auth.debug) e limpar logs verbose do hot path

- **Tipo:** melhoria | **Risco:** baixo | **Depende de:** 5,7,8,9
- **Arquivos:** `src/services/supabase.js, src/hooks/useAppResume.js, src/services/markDose.js`
- **Mudanca:** Desativar auth:{ debug } em prod (manter so atras de flag dev). Auditar console.warn/info no hot path de mutation/drain (markDose.js, useAppResume.js) — em PROD WebView cada console faz bridge JS<->Native + Sentry breadcrumb serialize e degrada o main thread (catch-22 ja documentado). Manter apenas logs essenciais.
- **Por que:** A propria instrumentacao verbose ja amplificou o bug em versoes anteriores (degradacao de main-thread em <5min). Apos validar o fix, remover o ruido.
- **Validacao:** Profiling do main thread no S25U com app aberto >5min: sem degradacao de scroll/animacao. Confirmar que debug nao aparece em build de release.

### #12 — Validacao empirica completa do fix (browser + S25U) com contas teste

- **Tipo:** validacao | **Risco:** baixo | **Depende de:** 5,6,7,8,9,10
- **Arquivos:** `scripts/qa-v028/ (novos scripts de repro), docs/qa-reports/ (registro de resultados)`
- **Mudanca:** Executar o validationProtocol completo (ver campo proprio) em teste-free, teste-plus e teste-pro @teste.com. Reproduzir os 3 cenarios do usuario: (1) app aberto idle longo + marcar dose; (2) abrir app apos tempo (cold-start pos-idle); (3) navegador dosymed.app com aba em background + marcar dose. Confirmar que NENHUM exige fechar-abrir/reload para drenar.
- **Por que:** O bug persistiu 30 versoes porque os fixes trataram sintomas. Esta validacao precisa provar empiricamente que o root cause foi eliminado, nao mascarado.
- **Validacao:** Os 3 cenarios gravam a dose direto, com internet OK, sem reload. onlineManager.isOnline() nunca sticky-false. Bearer sempre JWT. Fila zera sozinha em <30s. Nenhum signOut espurio.

---

## 6. Quick wins (baixo risco, alto impacto)

1. Alinhar TOKEN_EXPIRY_MARGIN_SEC de 30 para 90 em sessionManager.js:38 (1 linha) — mata o gatilho do refresh inline sob lock na janela 30-90s, que e o que re-arma o wedge a cada ciclo idle (explica o 'acontece SEMPRE'). Baixissimo risco.
2. Nos 3 catch de AuthLost em useAppResume.js (linhas 67-73, 168-169, 178-181) NAO chamar supabase.auth.signOut() por falha transitoria — degradar para 'reconectando' e re-tentar. Elimina a auto-destruicao de sessao por glitch de rede.
3. Adicionar networkMode:'always' ao registerSos em mutationRegistry.js (hoje herda 'offlineFirst' e pausa eternamente sem resumePausedMutations) — destrava SOS no navegador imediatamente.
4. Instalar o setEventListener custom do onlineManager TAMBEM no web (main.jsx:288, hoje so nativo) inicializando com navigator.onLine e re-lendo em focus/visibilitychange — elimina o sticky-false que obriga reload no browser.
5. Ativar auth:{ debug: true } atras de flag dev no createClient (supabase.js) para capturar '#_acquireLock begin/end' — instrumentacao barata que confirma o lock-wedge antes do refactor grande.
6. Separar lastResumeAt (debounce) de lastBackgroundEnteredAt (medir inactiveMs) em useAppResume.js:41,51-62 — faz markColdStart (timeout 30s) finalmente disparar apos idle longo.

---

## 7. Como confirmar empiricamente (antes do refactor grande)

1. DECISIVO — Ativar `auth: { debug: true }` no createClient e, num ciclo background→foreground real no S25U E no browser dosymed.app, procurar nos logs um `#_acquireLock begin` SEM o `#_acquireLock end` correspondente após idle (os markers existem em GoTrueClient.js:2233/2282). Begin-sem-end confirma o lock órfão (root cause); ausência refuta e promove o wedge do onlineManager.
2. Capturar o header Authorization das requests PostgREST durante um episódio wedged via CDP/DevTools Network: se o Bearer for a ANON key (= VITE_SUPABASE_ANON_KEY / sb_publishable), confirma o fallback _getAccessToken→supabaseKey (index.cjs:524) e crava o root cause. Se for um JWT real, o root cause é outro.
3. Instrumentar a latência de getValidSession e do _acquireLock: logar Date.now() antes/depois de `await getValidSession()` em authedRpc (sessionManager.js:156). Num episódio, esperar ver ~15s (lockAcquireTimeout) seguido de TimeoutError aos 10s — provando que o lock consome o budget mesmo com internet OK.
4. No BROWSER durante o sintoma, no console: comparar `onlineManager.isOnline()` (import do @tanstack/react-query) vs `navigator.onLine`. Se isOnline()=false enquanto navigator.onLine=true, confirma o sticky-false do contributing-cause (web sem setEventListener custom) e justifica instalar o bridge web.
5. Repro controlada do gatilho de margem: logar em getValidSession o `secsUntilExpiry` retornado e cruzar com um log em __loadSession (auth debug) do `session has expired`. Confirmar que na janela 30-90s o getValidSession devolve 'ok' (>30s) MAS o auth-js dispara _callRefreshToken inline (<90s) — provando a divergência 30s vs 90s.
6. Reproduzir aba/app hidden por 30-60min e então marcar uma dose: medir se vai pra fila com internet OK. Cruzar com a versão SEM o guard `visibilityState==='hidden'` no heartbeat (useAppResume.js:163) e com TOKEN_EXPIRY_MARGIN_SEC=90 — se o ajuste de margem sozinho elimina a fila, confirma o gatilho como necessário.
7. VERIFICAR NO BACKEND REAL guefraaqbkcehofchnrc/schema medcontrol (inacessível pelo token MCP atual — só bccpurtcrnadtfhstrrb aparece em list_projects): SELECT proname FROM pg_proc para confirmar se confirm_dose_v3/skip_dose_v3/undo_dose_v3 e a tabela mutation_log EXISTEM (aplicados via dashboard). Se existirem, o sintoma central é puramente o lock-wedge; se NÃO existirem, há um segundo modo (todo mark→404→revert) a investigar — mas que esvaziaria a fila, não a prenderia.
8. Testar o fix do root cause em staging: passar `accessToken: async () => (await getValidSession()).access_token` no createClient e confirmar que (a) _getAccessToken passa a usar o branch index.cjs:522 (sem lock), (b) markDose para de cair em pendingSync pós-idle, (c) login/onAuthStateChange/realtime.setAuth continuam funcionando.

---

## 8. Protocolo de validacao completo

1. REGRA INVIOLAVEL: validar SOMENTE em contas teste-free / teste-plus / teste-pro @teste.com (senha 123456). NUNCA em conta pessoal. Antes de qualquer Criar/Salvar/Submit/marcar dose via Chrome MCP, verificar o usuario logado.
2. PASSO 0 (baseline antes do fix): reproduzir o bug no estado atual para ter um antes/depois. No browser dosymed.app logado como teste-plus, deixar a aba em background 30-60min (ou minimizar + travar a tela do laptop), voltar e marcar uma dose. Confirmar que vai pra fila e so reload resolve. No console: window com onlineManager.isOnline() vs navigator.onLine; capturar o header Authorization de uma request /rest/v1 (deve sair anon durante o wedge).
3. PASSO 1 (confirmar hipotese): com auth:{ debug } ativo, repetir o ciclo background->foreground e procurar '#_acquireLock begin' SEM 'end' correspondente. Capturar via DevTools Network o Bearer das requests PostgREST durante o episodio (anon = root cause confirmado).
4. PASSO 2 (apos tarefas 3,4,5 — dual-client + margem + abort): repetir o PASSO 0 no browser. A dose deve gravar DIRETO, sem reload, com internet OK. Confirmar via Network que o Bearer e sempre um JWT real (nunca anon) mesmo apos idle. Confirmar via auth debug que getSession()/_acquireLock NAO sao mais chamados no caminho de dados.
5. PASSO 3 (S25U nativo): instalar o build .dev no Samsung S25U logado como teste-plus. Cenario A 'app aberto idle longo': deixar o app aberto e idle >30min, marcar uma dose com internet OK — deve gravar direto. Cenario B 'abrir apos tempo' (cold-start pos-idle): force-stop o app, esperar >30min, reabrir e marcar dose — deve drenar/gravar sem stuck. Cenario C 'Doze real': deixar o device em Doze (tela travada, sem carregador) 30-60min, acordar e marcar dose.
6. PASSO 4 (auto-cura do cliente vivo): apos um ciclo de idle, NAO fechar/reabrir o app — confirmar que a fila (se algo entrou) zera sozinha em <30s pelo drain, e que o cliente vivo se recupera SEM reload. Este e o teste decisivo de que o root cause foi eliminado, nao mascarado.
7. PASSO 5 (nao-regressao de auth): login (email/senha), restauracao de sessao no boot, logout explicito, recovery via OTP, e onAuthStateChange devem continuar funcionando — o cliente de dados (accessToken custom) NAO pode ter quebrado o cliente de auth. Confirmar que nenhum acesso a supabase.auth.* lanca o erro do Proxy.
8. PASSO 6 (signOut espurio): simular 2 falhas de refresh consecutivas (throttle de rede no DevTools/ADB) e confirmar que o usuario NAO e ejetado para a tela de login e que o drain roda apos a rede voltar.
9. PASSO 7 (realtime cuidador): com teste-plus compartilhando paciente com teste-pro, apos idle longo + refresh, confirmar que um UPDATE em teste-pro chega no app de teste-plus sem re-mount (valida realtime.setAuth).
10. PASSO 8 (conectividade web): no browser, disparar um evento 'offline' sintetico e voltar com a aba em background; confirmar que onlineManager.isOnline() volta a true no focus (nao fica sticky-false) e que SOS/leituras nao ficam pausadas.
11. PASSO 9 (Sentry/logs prod): apos deploy em staging, monitorar Sentry por ausencia de bursts 401/403/409 'mutation falha silencioso pos-idle' e ausencia de 'Invalid Refresh Token: Already Used'.
12. PASSO 10.5 — STOP OBRIGATORIO antes de gerar AAB: NAO gerar o AAB sem perguntar literalmente 'Posso gerar o AAB?' e aguardar 'sim/pode/gera/sobe/fecha'. 'ataque tudo' ou 'implementa' NAO autorizam o ship.


---

## 9. Auditoria de egress (v0.2.8.6 — Regra 2)

Mudança toca fetch/persist (camada de auth/dados). Avaliação:

| Risco | Severidade | Mitigação | Decisão |
|---|---|---|---|
| `supabaseData` (2º cliente) duplicar conexões/requests | Baixo | Mesmo nº de RPCs (authedRpc só troca de cliente). Realtime fica só no cliente de auth (supabaseData nunca chama `.channel()`). | Aceitar — neutro |
| Provider lock-free chamar refresh com mais frequência | Baixo | Refresh continua 1×/lifetime do token (~1h), deduplicado por mutex único. Margem 90s só antecipa, não multiplica. | Aceitar — neutro |
| Margem 30s→90s gerar refresh extra | Baixo | 1 refresh por expiração independe da margem; só muda QUANDO. | Aceitar — neutro |
| Bridge onlineManager web (focus/visibilitychange) | Nenhum | Listeners só leem `navigator.onLine` (zero rede). | Aceitar — 0 egress |
| `registerSos` networkMode `always` | Baixo | Mesma RPC única; só deixa de pausar. | Aceitar — neutro |
| Cache de sessão em memória | Nenhum | Read-through do cliente de auth; reduz leituras de storage. | Aceitar — levemente positivo |

**Veredito:** egress **neutro a levemente positivo**. Nenhum novo polling, realtime ou fetch recorrente; o caminho lock-free elimina refreshes-inline redundantes. Sem necessidade de TTL/cache adicional.
