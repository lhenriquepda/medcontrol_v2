# 📋 Validações Manuais Pendentes — Dosy

> **Checklist de validações que exigem ação sua** (device físico, observação visual em produção, conferência manual em painéis externos). A IA não consegue executar sozinha.
>
> **Como funciona:**
> - A cada nova release, a IA adiciona uma seção **no topo** com as validações pendentes daquela versão.
> - Você executa cada item e marca `[x]` quando confirmar OK.
> - A IA varre este arquivo no início de cada nova sessão e te alerta se houver `[ ]` pendente — você decide se quer validar antes de começar trabalho novo, ou se prefere acumular.
> - Validações fechadas migram pra seção "📦 Histórico" no final do arquivo (manter rastro cronológico).
>
> **Convenções:**
> - `[ ]` = pendente · `[x]` = validado OK · `[~]` = parcial / observação anotada · `[skip]` = pulado (com motivo)
> - Cada validação tem 3 partes: **Como fazer**, **O que esperar**, **Se falhar**.

---

## 🆕 Release v0.2.1.8 — versionCode 56 (debug variant Studio — Internal Testing pendente)

**Escopo:** #204 mutation queue offline expandido — fixes A1/A2/B/C identificados via logcat S25 Ultra (sessão 2026-05-10). Mutations CRUD completas com optimistic + alarme offline + bloqueios features fora queue + avisos UX honestos.

**Mudanças código:**
- `src/main.jsx` — Fix B (pre-mount `Network.getStatus` bloqueante) + Fix C (`onlineManager.setEventListener` Capacitor única fonte, substitui default subscriber TanStack que disparava espúrio em Capacitor WebView)
- `src/services/mutationRegistry.js` — optimistic onMutate/onError/onSuccess em **TODAS** 12 mutations queue: confirmDose/skipDose/undoDose/registerSos/createPatient/updatePatient/deletePatient/createTreatment/updateTreatment/deleteTreatment/pauseTreatment/resumeTreatment/endTreatment. createTreatment gera doses local via `generateDoses` (dashboard + alarme offline). mutationFn createTreatment resolve `patientId` temp→real via `_tempIdSource` marker (drain pós-reconnect FK fix)
- `src/pages/PatientForm.jsx` + `src/pages/TreatmentForm.jsx` — detect offline em CREATE + EDIT paths: `mutate` fire-and-forget + toast claro + close modal imediato
- `src/hooks/useOfflineGuard.js` (novo) — helper `guard.ensure(label)` bloqueia + toast pra features FORA queue
- `src/components/OfflineNotice.jsx` (novo) — banner contextual reusable
- `src/components/SharePatientSheet.jsx` — guard share/unshare + button disable + banner
- `src/pages/SOS.jsx` — guard saveRule (SOS rules fora queue) + queue registerSos offline-aware + banner
- `src/pages/Settings/index.jsx` — guard exportar LGPD + excluir conta + banner topo

**Conta de teste:** `teste-plus@teste.com / 123456`. Conta admin pessoal pra dados reais.

---

### #204.v218.1 — Boot offline: mutations rehydradas NÃO disparam fetches espúrios

#### `[ ]` 218.1.1 — Pre-mount Network.getStatus bloqueante

**Como fazer:**
1. App aberto + algumas ações offline pendentes da sessão anterior (mutations no localStorage).
2. **Settings Android → Modo avião ON.**
3. Force-kill o Dosy (recents → swipe).
4. Reabrir Dosy.
5. Conectar device USB + rodar `adb logcat -s "Capacitor/Console:E"` no PC.

**O que esperar:**
- Logcat mostra (na ordem):
  ```
  [Dosy:net] pre-mount Network.getStatus: {"connected":false,"connectionType":"none"}
  [Dosy:net] bridge listener registered (Capacitor única fonte)
  ```
- Mutations rehydradas mantêm `isPaused=true` (NÃO tentam fetch).
- Banner amber aparece com count de pendentes.

**Se falhar:**
- Pre-mount não emite → `boot()` async não está bloqueando React mount.
- Mutations resumed imediato (isPaused=false ~1s no boot) → bridge Capacitor tarde.

---

### #204.v218.2 — Reconnect: setOnline única fonte (Capacitor bridge)

#### `[ ]` 218.2.1 — Sem flips espúrios `setOnline(true)` por TanStack default subscriber

**Como fazer:**
1. App offline com mutations pausadas.
2. **Modo avião OFF.**
3. Logcat ativo.

**O que esperar:**
- Logs `[Dosy:net] networkStatusChange event:` aparecem APENAS via Capacitor bridge (caller `Object.callback`).
- NÃO há `setOnline(true) caller=vendor-data-*` espúrio (default subscriber substituído por `setEventListener`).

**Se falhar:**
- Caller `vendor-data` aparece → Fix C não aplicou. Default subscriber TanStack ainda ativo.

---

### #204.v218.3 — Modal Cadastrar Paciente fecha imediato offline

#### `[ ]` 218.3.1 — Create offline + UX honesto

**Como fazer:**
1. Modo avião ON.
2. Pacientes → ➕ Novo paciente.
3. Preencher nome "Teste Offline" + idade 30 + salvar.

**O que esperar:**
- Modal fecha imediato (sem trava em loading).
- Toast info: **"Paciente salvo offline — sincroniza ao reconectar."**
- Lista pacientes mostra "Teste Offline" no topo (temp ID local).
- Banner amber count incrementa.

**Se falhar:**
- Modal trava em "Cadastrar paciente..." > 2s → `mutate` não foi chamado fire-and-forget.
- Sem toast → handler não detectou offline.

---

### #204.v218.4 — Modal Editar Paciente fecha imediato offline

#### `[ ]` 218.4.1 — Edit offline + UX honesto

**Como fazer:**
1. Modo avião ON.
2. Pacientes → tap paciente existente → Editar.
3. Mudar nome para "Editado Offline" + salvar.

**O que esperar:**
- Modal fecha imediato.
- Toast info: **"Alterações salvas offline — sincronizam ao reconectar."**
- Lista mostra nome novo "Editado Offline".

**Se falhar:**
- Modal trava → handler editing offline não foi adicionado.

---

### #204.v218.5 — Tratamento offline aparece no Dashboard + alarme dispara

#### `[ ]` 218.5.1 — createTreatment optimistic + doses local + alarme

**Como fazer:**
1. Modo avião ON.
2. Pacientes → tap paciente → ➕ Novo tratamento.
3. Preencher medicamento "TesteOffline" + dose "1 comp" + intervalo 8h + dose inicial **+2min do agora** + duração 1 dia + salvar.

**O que esperar:**
- Modal fecha imediato.
- Toast info: **"Tratamento salvo offline — sincroniza ao reconectar."**
- **Dashboard mostra tratamento + dose pendente +2min**.
- Esperar 2min com modo avião ON.
- **Alarme nativo dispara** (som customizado + tela cheia OU notif heads-up).

**Se falhar:**
- Dashboard sem dose → `generateDoses` local não inseriu no cache `['doses']`.
- Alarme não toca → AlarmScheduler não detectou doses temp no cache (verificar logcat `[Notif] reschedule`).

---

### #204.v218.6 — createTreatment drena após reconnect resolvendo temp patientId

#### `[ ]` 218.6.1 — Drain ordem FIFO + lookup _tempIdSource

**Como fazer:**
1. Modo avião ON + receita 218.3 (paciente novo) + 218.5 (tratamento novo no mesmo paciente).
2. Cache tem 2 mutations pausadas: `createPatient(temp-A)` + `createTreatment(patientId: temp-A)`.
3. **Modo avião OFF.**
4. Aguardar 5-10s banner drainings emerald.

**O que esperar:**
- Logcat:
  ```
  [Dosy:mut] updated createPatient status=success
  [Dosy:mut] updated createTreatment status=success (sem failureCount=4)
  ```
- Banner some.
- SQL no Supabase Studio:
  ```sql
  SELECT id, "patientId", "medName" FROM medcontrol.treatments
  WHERE "userId" = auth.uid()
  ORDER BY "createdAt" DESC LIMIT 3;
  ```
- Treatment row tem `patientId` real (UUID, não temp-xxx).

**Se falhar:**
- `createTreatment status=error failureCount=4` → mutationFn não resolveu temp patientId. Lookup `_tempIdSource` falhou.

---

### #204.v218.7 — Features FORA queue: bloqueio explícito + avisos

#### `[ ]` 218.7.1 — Compartilhar paciente bloqueado offline

**Como fazer:**
1. Modo avião ON.
2. Pacientes → tap paciente → 🔗 Compartilhar.
3. Tentar digitar email + Compartilhar.

**O que esperar:**
- Banner amarelo topo Sheet: **"Você está offline. Compartilhamento de pacientes requer internet."**
- Botão "Compartilhar" DESABILITADO.
- Se clicar mesmo assim: toast warn **"Sem conexão. Compartilhar paciente requer internet."**

**Se falhar:**
- Botão clicável → `disabled={!guard.online}` não aplicou.
- Sem banner → `<OfflineNotice />` não renderizou.

---

#### `[ ]` 218.7.2 — SOS regra bloqueada offline

**Como fazer:**
1. Modo avião ON.
2. Página S.O.S → selecionar paciente + medicamento.
3. Preencher intervalo mín 6h + clicar "Salvar regra".

**O que esperar:**
- Toast warn: **"Sem conexão. Salvar regra de segurança requer internet."**
- Regra NÃO salva.

**Se falhar:**
- Toast diferente / nenhum → `guard.ensure` não foi chamado.

---

#### `[ ]` 218.7.3 — SOS dose registrada offline ENTRA queue

**Como fazer:**
1. Modo avião ON.
2. Página S.O.S → preencher paciente + medicamento + dose + horário.
3. Clicar "Registrar S.O.S".

**O que esperar:**
- Toast info: **"Dose S.O.S salva offline — sincroniza ao reconectar."**
- Banner amber count incrementa.
- Dashboard mostra dose SOS (status done).

**Se falhar:**
- Modal trava → `mutate` não foi chamado fire-and-forget.

---

#### `[ ]` 218.7.4 — LGPD exportar bloqueado offline

**Como fazer:**
1. Modo avião ON.
2. Ajustes → "Exportar meus dados".

**O que esperar:**
- Toast warn: **"Sem conexão. Exportar dados LGPD requer internet."**
- Sem download / sem dialog.

**Se falhar:**
- Tentativa de fetch → guard.ensure não foi adicionado em `exportUserData`.

---

#### `[ ]` 218.7.5 — LGPD excluir conta bloqueado offline

**Como fazer:**
1. Modo avião ON.
2. Ajustes → "Excluir minha conta" → confirma.

**O que esperar:**
- Toast warn: **"Sem conexão. Excluir conta requer internet."**
- Conta NÃO excluída.

**Se falhar:**
- Edge Function tentou rodar → guard.ensure não aplicou.

---

#### `[ ]` 218.7.6 — Settings banner global offline

**Como fazer:**
1. Modo avião ON.
2. Abrir Ajustes.

**O que esperar:**
- Banner amarelo topo Ajustes: **"Você está offline. Exportação de dados, exclusão de conta e algumas configurações requer internet."**

**Se falhar:**
- Banner ausente → `<OfflineNotice />` não foi adicionado em Settings/index.

---

### #204.v218.8 — pause/resume/end Treatment optimistic

#### `[ ]` 218.8.1 — Pausar tratamento offline

**Como fazer:**
1. Modo avião ON.
2. Tratamento ativo → menu ⋮ → Pausar.

**O que esperar:**
- Status muda visualmente pra "Pausado" imediato.
- Doses futuras pendentes do tratamento somem do Dashboard.
- Alarmes do tratamento param (verificar próximo alarme NÃO toca).

**Se falhar:**
- Status não muda → onMutate optimistic não rodou.
- Doses futuras continuam → filter cancelFutureDoses local não rolou.

---

### #205.v218.9 — Single source refresh token: zero storms xx:00

#### `[ ]` 218.9.1 — Lifespan session ≥ 12h (sem re-login forçado)

**Como fazer:**
1. Instalar AAB vc 56 release variant (`com.dosyapp.dosy`) S25 Ultra.
2. Login `lhenrique.pda@gmail.com` (conta admin pessoal).
3. Anotar timestamp login + Painel admin `/auth-log` evento `login_email_senha`.
4. Usar app normalmente por 24h (foreground/background ciclos naturais).
5. Após 24h, abrir Painel admin `/auth-log` filtrado pelo user.

**O que esperar:**
- Eventos `login_email_senha` nas últimas 24h: **APENAS 1** (o login inicial).
- Demais eventos: `sessao_restaurada` apenas.
- Zero forced re-login (user não digitou senha novamente).

**Se falhar:**
- 2+ `login_email_senha` em 24h → re-login forçado ainda acontece. Verificar SQL `auth.refresh_tokens` se storm pattern xx:00 persiste.

---

#### `[ ]` 218.9.2 — SQL refresh_tokens sem storm xx:00

**Como fazer:**
1. 24h após install vc 56, abrir Supabase Studio SQL Editor.
2. Rodar:
   ```sql
   WITH u AS (SELECT id::text AS uid FROM auth.users WHERE email = 'lhenrique.pda@gmail.com')
   SELECT DATE_TRUNC('minute', rt.created_at) AS bucket,
          COUNT(*) AS tokens_in_minute
   FROM auth.refresh_tokens rt, u
   WHERE rt.user_id = u.uid
     AND rt.created_at > NOW() - INTERVAL '24 hours'
   GROUP BY 1 HAVING COUNT(*) > 2
   ORDER BY 1 DESC;
   ```

**O que esperar:**
- Result: 0 rows. Nenhum minuto com mais de 2 refreshes simultâneos.

**Se falhar:**
- Qualquer bucket >5 tokens em 1 minuto → storm ativa. Anotar timestamp + verificar logcat `DoseSyncWorker` / `DosyMessagingService` se aparecem refresh attempts.

---

#### `[ ]` 218.9.3 — Sessions lifespan ≥ 12h

**Como fazer:**
1. SQL:
   ```sql
   WITH u AS (SELECT id::uuid AS uid FROM auth.users WHERE email = 'lhenrique.pda@gmail.com')
   SELECT s.id, s.created_at, s.updated_at,
          EXTRACT(EPOCH FROM (s.updated_at - s.created_at))/3600 AS lifespan_hours
   FROM auth.sessions s, u
   WHERE s.user_id = u.uid AND s.created_at > NOW() - INTERVAL '7 days'
   ORDER BY s.created_at DESC LIMIT 10;
   ```

**O que esperar:**
- Sessões S25 Ultra (`user_agent LIKE 'Dalvik%SM-S938B%'`) lifespan ≥ 12h cada (vs 18min-3h v0.2.1.7).

**Se falhar:**
- Lifespan curto persiste → refresh chain ainda corrompendo. Verificar logcat se Worker/MessagingService log refresh attempts.

---

#### `[ ]` 218.9.4 — Logcat sem refresh calls native

**Como fazer:**
1. Device USB + `adb logcat -s "DoseSyncWorker:V" "DosyMessagingService:V"`.
2. Esperar Worker periodic rodar (6h ciclo natural OR forçar via Settings → Developer options → Workers → DoseSyncWorker → "Run").

**O que esperar:**
- Logs `DoseSyncWorker`: zero linhas `token refresh status=`.
- Pode aparecer: `access_token expired/near-expiry — skip rodada` (esperado se >1h sem foreground).
- `sync ok: fetched=N scheduled=M` em rodadas com token válido.

**Se falhar:**
- Linha `token refresh status=` → Worker ainda chama `/auth/v1/token`. Fix #205 não aplicou.

---

### Validação cruzada — drain completo após reconnect

#### `[ ]` 218.X — Reconectar drena TODAS mutations sem perda

**Como fazer:**
1. Receita completa offline 218.3 + 218.4 + 218.5 + 218.7.3 + 218.8 + várias confirmDose/skipDose.
2. **Modo avião OFF.**
3. Aguardar drain (banner emerald → some, ~10s).

**O que esperar:**
- Logcat zero `status=error failureCount=4`.
- Todas mutations `status=success`.
- SQL:
  ```sql
  SELECT id, "medName", status, "actualTime", "updatedAt"
  FROM medcontrol.doses
  WHERE "userId" = auth.uid()
    AND "updatedAt" > NOW() - INTERVAL '15 minutes'
  ORDER BY "updatedAt" DESC;
  ```
- Reflete todas confirmações/skips + dose SOS + doses do tratamento novo.

**Se falhar:**
- Qualquer mutation `status=error` → bug específico daquela mutation. Anotar key + failureCount.

---

## 🆕 Release v0.2.1.7 — versionCode 55 (publicado Internal Testing 2026-05-09 23:08)

**Escopo:** [#204 Mutation queue offline](CHECKLIST.md#204--mutation-queue-offline-react-query-nativa--fase-1-offline-first) + [#207 Defesa em profundidade alarme crítico](CHECKLIST.md#207--defesa-em-profundidade-alarme-crítico-5-fixes)

**AAB:** Internal Testing track ativo. Instalar via link [https://play.google.com/apps/internaltest/4700769831647466031](https://play.google.com/apps/internaltest/4700769831647466031)

**Conta de teste recomendada pra validação:** sua conta admin pessoal (com tratamentos e dados reais), ou `teste-plus@teste.com / 123456` (tier plus, sem ads). Para validar gating Free/Plus, use também `teste-free@teste.com / 123456`.

---

### #204 — Mutation queue offline (Fase 1 offline-first)

**Resumo:** ações offline (confirmar dose, pular, criar paciente, etc) ficam salvas localmente e sincronizam automaticamente quando a internet volta. Antes do fix, ficavam perdidas silenciosamente após 30s offline.

#### `[ ]` 204.1 — Avião mode + ações offline → banner amber

**Como fazer:**
1. Abrir Dosy no celular (S25 Ultra ou outro Android com Internal Testing instalado).
2. Fazer login normalmente.
3. **Settings Android → ativar "Modo avião"** (corta tudo: wifi + dados móveis).
4. Voltar pro Dosy.
5. Executar 5 ações em sequência:
   - Confirmar 1 dose (botão "Tomada")
   - Pular 1 dose (botão "Pular")
   - Confirmar mais 1 dose
   - Criar 1 paciente novo (Pacientes → +)
   - Cadastrar 1 tratamento novo no paciente recém-criado (botão `+` flutuante)
6. Aguardar uns 5 segundos depois da última ação.

**O que esperar:**
- Banner amarelo (amber) aparece no rodapé acima do BottomNav: **"5 ações salvas offline — sincroniza ao reconectar"** (ou número correspondente).
- Cada ação aparece como confirmada/pulada na tela na hora (optimistic update — UI responde instantâneo).
- App NÃO trava nem mostra erro de rede.

**Se falhar:**
- Sem banner aparecendo → `OfflineBanner.jsx` não está pegando state. Anotar no item: `[~] banner não apareceu`.
- App trava ou mostra erro → bug de retry/network mode. Anotar log do erro.

---

#### `[ ]` 204.2 — Reabrir conexão → drain emerald

**Como fazer:**
1. Continuando do item 204.1 (5 ações offline pendentes).
2. **Settings Android → desativar "Modo avião"** (volta wifi/dados).
3. Voltar pro Dosy e ficar olhando o banner.

**O que esperar:**
- Banner muda de amarelo (amber) para verde (emerald) com texto: **"Sincronizando 5 ações…"** (com ícone girando).
- Banner fica visível por até 3 segundos.
- Banner some sozinho.
- Stats do dashboard atualizam (atrasadas/adesão refletem ações sincronizadas).

**Se falhar:**
- Banner some sem mostrar emerald → drain rápido demais (feature funcionou mas UX não viu).
- Banner fica preso emerald além de 5s → mutations travadas. Verificar console logcat.

---

#### `[ ]` 204.3 — Confirmar sync server-side via SQL

**Como fazer:**
1. Após 204.2 confirmado, abrir [Supabase Studio](https://supabase.com/dashboard/project/guefraaqbkcehofchnrc/editor).
2. SQL Editor → rodar:
   ```sql
   SELECT id, "medName", status, "actualTime", "updatedAt"
   FROM medcontrol.doses
   WHERE "userId" = auth.uid()
     AND "updatedAt" > NOW() - INTERVAL '15 minutes'
   ORDER BY "updatedAt" DESC
   LIMIT 10;
   ```
   (Se SQL Editor não usar `auth.uid()`, substituir pelo seu UUID — pega em Authentication → Users.)

**O que esperar:**
- 3 linhas com `status = 'done'` (as confirmações)
- 1 linha com `status = 'skipped'` (a pulada)
- Para o paciente novo + tratamento, rodar SQL nas tabelas `patients` e `treatments` filtrando `"createdAt" > NOW() - INTERVAL '15 minutes'`.

**Se falhar:**
- Linhas faltando no DB → mutation foi descartada em vez de drenada. Bug crítico.

---

#### `[ ]` 204.4 — Force-kill app offline + reabrir → mutations sobrevivem

**Como fazer:**
1. Modo avião ativo + 1 dose confirmada offline (banner amber visível).
2. **Force kill o Dosy** (Recents → swipe away).
3. Reabrir o Dosy (ainda em avião mode).

**O que esperar:**
- Banner amber **continua aparecendo** "1 ação salva offline" (mutation persistida via TanStack Query persist mutations).
- Ao desativar avião mode, drain acontece normalmente (item 204.2).

**Se falhar:**
- Banner some após reabrir → persist de mutation não está funcionando. Bug crítico.

---

### #207 — Defesa em profundidade alarme crítico (5 fixes)

**Resumo:** alarmes agora disparam SEMPRE no horário, mesmo se o usuário não abrir o app por dias, e mesmo em Samsung/Xiaomi (que matam apps em background). Cobertura ampliada de 48h pra 7 dias. Permissão "Ignorar otimização de bateria" agora é solicitada explicitamente.

#### `[ ]` 207.1 — PermissionsOnboarding 5º item: battery optimization

**Como fazer:**
1. Desinstalar o Dosy do S25 Ultra (Settings → Apps → Dosy → Desinstalar).
2. Reinstalar via Internal Testing link.
3. Abrir o app, fazer login.
4. Após login, deve aparecer o modal **"Configurar alarmes"** com permissões.

**O que esperar:**
- Modal lista **5 itens**:
  1. Notificações habilitadas
  2. Alarmes exatos
  3. Notificações em tela cheia
  4. Aparecer sobre outros apps
  5. **Ignorar otimização de bateria** ← novo, com descrição: *"Crítico em Samsung/Xiaomi: sem isso o sistema pode cancelar alarmes pra economizar bateria."*
- Tocar "Abrir configurações" no 5º item abre dialog do Android: *"Permitir que o Dosy ignore a otimização de bateria? Sim/Não"*.
- Aceitar **Sim**.
- Voltar pro modal e tocar "Verificar de novo".
- 5º item agora aparece marcado com ✅ verde.
- Após todos 5 itens granted, modal fecha automaticamente.

**Se falhar:**
- 5º item não aparece → manifest ou plugin não tem `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
- Tap não abre dialog system → plugin `requestIgnoreBatteryOptimizations` quebrado.
- Recheck não detecta granted → plugin `isIgnoringBatteryOptimizations` retorna errado.

---

#### `[ ]` 207.2 — Alarme dispara no horário EXATO (não 15min antes)

**Contexto bug:** antes do fix, `advanceMins ?? 15` no scheduler.js fazia o alarme disparar 15 minutos antes do horário marcado quando as preferências locais não tinham o campo explícito. Agora `?? 0` alinha com o default real (alarme exato).

**Como fazer:**
1. Configurar um tratamento novo com dose **5 minutos no futuro** (ex: agora são 18:30, marcar dose pra 18:35).
2. Fechar o app (swipe away recents) — não deixar aberto.
3. Não tocar o celular por 5 minutos.

**O que esperar:**
- Alarme dispara **exatamente às 18:35** (margem de 30s aceitável devido floor pra minuto).
- **NÃO dispara antes** (não às 18:20 — esse seria o bug antigo).
- Som customizado `dosy_alarm.mp3` toca em loop.
- Tela cheia AlarmActivity OU notificação heads-up com botões "Ciente / Adiar 10min / Ignorar".

**Se falhar:**
- Alarme tocou 15min antes → fix `?? 0` não pegou (verificar `localStorage.medcontrol_notif`).
- Alarme não tocou → outro problema (battery optimization? exact alarm permission?).

---

#### `[ ]` 207.3 — Cobertura 7 dias mesmo sem abrir app

**Contexto bug:** antes, janela de scheduling local era 48h. User que não abria o app por 49h+ ficava sem alarmes locais (dependia de cron servidor + WorkManager, que Samsung mata). Agora 168h (7 dias).

**Como fazer:**
1. Abrir Dosy.
2. Configurar tratamento com dose **3 dias no futuro** (ex: hoje é dia 10, dose dia 13).
3. Fechar app.
4. **NÃO abrir o app entre hoje e dia 13.**
5. Aguardar dia 13 chegar.

**O que esperar:**
- Alarme dispara no horário marcado dia 13, mesmo sem abrir o app entre install e dose.
- Se quiser confirmar agendamento antes de esperar 3 dias: rodar `adb logcat -s AlarmScheduler` durante a configuração — deve aparecer `AlarmScheduler: scheduled id=N at=<timestamp dia 13>`.

**Se falhar:**
- Alarme não tocou dia 13 → janela ainda 48h ou DoseSyncWorker não rodou. Verificar `prefs.js` e `DoseSyncWorker.java`.

---

#### `[ ]` 207.4 — rescheduleAll sempre faz full reset (drop diff-and-apply)

**Contexto bug:** antes, idempotência via `localStorage.dosy_scheduled_groups_v1` causava drift quando OEM matava AlarmManager mas localStorage dizia "já agendado" → diff vazio → AlarmManager continuava vazio → alarme não tocava. Agora sempre `cancelAll() + reschedule from scratch`.

**Como fazer:**
1. Configurar 3 doses com horários diferentes (ex: +10min, +20min, +30min do agora).
2. Fechar app.
3. Reabrir app.
4. Conectar device USB + rodar `adb logcat -s AlarmScheduler AlarmReceiver Notif`.
5. Forçar reschedule fechando e reabrindo o app.

**O que esperar:**
- Log: `[Notif] reschedule START — full cancelAll`
- Log: `[Notif] groups to schedule: 3` (ou número correto)
- Log 3x: `AlarmScheduler: scheduled id=X at=Y count=1`
- **NÃO aparece** texto `diff — keep: N add/update: M remove: K` (esse é o log antigo do diff-and-apply removido).

**Se falhar:**
- Log antigo `diff — keep:` ainda aparece → fix não aplicou.
- `groups to schedule: 0` quando deveria ser 3 → window/filter bug.

---

#### `[ ]` 207.5 — Sentry breadcrumbs em rescheduleAll

**Como fazer:**
1. Forçar uma sessão real do app:
   - Login + uso normal por 5 min
   - Configurar/editar tratamentos
   - Confirmar/pular doses
2. Aguardar até que algum erro real ocorra OU 24h pós-uso.
3. Abrir [Sentry](https://lhp-tech.sentry.io/projects/dosy/) → ver issues recentes do release `dosy@0.2.1.7`.

**O que esperar:**
- Em qualquer issue capturada, no painel "Breadcrumbs" deve aparecer trail com:
  - `category=alarm`, `message=rescheduleAll START`, `data={dosesCount: N, patientsCount: M}`
  - `category=alarm`, `message=rescheduleAll END`, `data={alarmsScheduled: N, dndSkipped: 0, localNotifs: 0, summary: true, advanceMins: 0, groupsCount: N}`

**Se falhar:**
- Breadcrumbs sem entries de `category=alarm` → import Sentry em scheduler.js não pegou ou DSN não configurado em produção.

**Nota:** Sentry é gated em `import.meta.env.PROD` only. Build local de Studio é release variant → Sentry ativo.

---

### Validação cruzada (#204 + #207 juntos)

#### `[ ]` 204+207.x — Avião mode + alarme local agendado dispara

**Como fazer:**
1. Configurar dose +5min futuro com app online.
2. **Settings Android → Modo avião ON.**
3. Aguardar 5min.

**O que esperar:**
- Alarme dispara mesmo offline (porque foi agendado localmente via `setAlarmClock` antes do avião mode).
- Tap "Ciente" → app abre + tenta confirmar dose → mutation queued offline (banner amber aparece) → drain quando reconectar.

**Se falhar:**
- Alarme não disparou offline → AlarmManager não foi agendado ou foi cancelado.

---

## 📦 Histórico (validações fechadas)

> Quando você marcar todos `[x]` de uma release, a IA move a seção pra cá.

_(vazio — primeira release com este arquivo)_
