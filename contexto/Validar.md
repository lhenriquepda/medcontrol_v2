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
