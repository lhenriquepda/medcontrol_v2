# Plano de Implementação Consolidado — Correções e Alinhamento MedControl v2 → Dosy v2

Este documento consolida o plano de correções imediatas (testes quebrados, warnings de linter e correção de drain offline) com o plano de transição e alinhamento completo do codebase `medcontrol_v2` para a especificação do `dosy-app`.

---

## 1. Decisões Arquiteturais e Diretrizes do Alinhamento

Para a transição de nomenclatura e arquitetura, estabelecemos as seguintes decisões sobre divergir ou adotar a especificação:

1. **Fila Offline (Código Atual Vence)**: Manteremos `@capacitor/preferences` (SharedPreferences nativo) para persistência da fila em vez de `idb-keyval` (IndexedDB). Isso é obrigatório para que o worker nativo Java (`DoseSyncWorker.java`) acesse a fila de mutações e execute sincronizações com o Supabase em segundo plano, mesmo com o WebView do Chrome destruído pelo sistema operacional.
2. **Camadas de Pastas e Boundaries (Spec Vence)**: Adotaremos a separação rígida definida em `10-ARCHITECTURE.md` (`src/pages`, `src/components`, `src/core`, `src/storage`, `src/sync`, `src/native`), monitorada por regras restritivas do ESLint para evitar que a UI manipule APIs nativas ou banco de dados diretamente.
3. **Salvaguardas de Realtime (Spec Vence)**: Desenvolveremos o `RealtimeManager` com as 5 salvaguardas da `ADR-016` (visibility change pause, inatividade de 5 minutos, feature-flags, canal único e dashboard PostHog) para reativar o realtime de forma financeiramente viável.
4. **Catálogo CMED 30k (Spec Vence)**: Faremos a ingestão da planilha ANVISA CMED e migraremos a classificação de medicamentos para triggers baseadas em tabelas relacionais de classes terapêuticas no banco de dados, eliminando falsos-positivos de regex no front-end.

---

## 2. User Review Required

> [!IMPORTANT]
> A exclusão dos testes de `e2e/**` do runner principal do Vitest é necessária porque o runner de testes unitários não suporta a sintaxe e escopo do Mocha/Appium utilizados nesses testes ponta-a-ponta. Os testes de E2E continuarão existindo e deverão ser executados pelo seu runner específico.

> [!WARNING]
> A correção do fluxo de erro lógico em `_runDrain` (`markDose.js`) garante que falhas reais de sincronização (ex: dose inexistente 404, não autorizado 401) resultem em reversão do estado otimista no front-end, emitindo mensagens de erro legíveis ao usuário, em vez de remover silenciosamente o item da fila e deixar a interface travada no estado otimista com sucesso falso.

---

## 3. Cronograma de Execução em Fases

### Fase 1: Correção de Bugs, Testes e ESLint (Plano Anterior)

#### 1. Configuração de Testes e Linter
* **`vitest.config.js`**: Excluir a pasta `e2e/**` das buscas automáticas de testes unitários do Vitest (`test.exclude`).

#### 2. Correção de Testes Unitários
* **`dateUtils.test.js`**: Atualizar a expectativa do teste de `rangeNow('24h')` de `expect(new Date(r.from).getHours()).toBe(6)` para `expect(new Date(r.from).getHours()).toBe(0)` (meia-noite local, dadas as 12 horas de recuo no mock).
* **`statusUtils.test.js`**: Atualizar o teste `STATUS_CONFIG has 4 statuses` para verificar se contém as 5 chaves reais (`['done', 'skipped', 'overdue', 'pending', 'cancelled']`), além de verificar a rotulagem do status `cancelled` como `Cancelada`.

#### 3. Correção do Drain Offline
* **`markDose.js`**: No método `_runDrain`, tratar erros com `result?.ok === false` que não sejam do tipo `409 Conflict`. Chamar `revertDose(mut.doseId)` e `emitMutationError()` caso ocorra um erro lógico final (ex: códigos `401`, `403`, `404`, ou erros de validação) para garantir que a UI não fique presa no estado de sucesso otimista falso.

#### 4. Limpeza de Warnings do ESLint
* **`notifications/index.js`**: Remover a chamada redundante `setPermState(Notification.permission)` no `useEffect` de montagem Web, já que o estado já é inicializado no construtor do `useState` usando o mesmo valor.
* **`TreatmentForm.jsx`**: Mudar a lógica de atualização automática de `durationUnit` de um `useEffect` reativo para chamadas diretas e sincronizadas no handler de chips de intervalo fixo e na mudança de modo de tratamento, eliminando o warning `react-hooks/set-state-in-effect`.

---

### Fase 2: Ingestão do Catálogo CMED (ADR-015)
1. Criar o script JS/TS `scripts/ingest-cmed.mjs` para processar em lotes a planilha do CMED da ANVISA (~30k rows).
2. Criar a tabela `dosy.cmed_class_to_group_mapping` e migrar o dicionário de classes terapêuticas para o banco.
3. Implementar a trigger de classificação robusta de 5 níveis `classify_medication_robust` no Postgres.
4. Criar a tabela `dosy.medication_categorization_suggestions` para aprendizado coletivo de categorias não catalogadas.
5. Corrigir o regex de categorização local temporário em `src/constants/medCategories.js` para mitigar o bug de falso-positivo de antidepressivo para Amilodipina/Anlodipino.

---

### Fase 3: Migração de Schema (Fase 2 Rewrite)
1. Criar migração SQL global para renomear o schema `medcontrol` para `dosy` (`ALTER SCHEMA medcontrol RENAME TO dosy`).
2. Ajustar todas as chamadas de RPCs e queries no front-end para o novo namespace (`dosy.`).
3. Atualizar o código Java do agendador nativo (`AlarmScheduler.java`, `DoseSyncWorker.java` etc.) para ler as tabelas no novo namespace do banco.
4. Criar as colunas e tabelas faltantes: tabela `profiles`, `audit_log`, `feature_flags`, `fcm_dispatched_log` e versionamento em `treatments` / `treatment_versions`.

---

### Fase 4: Implementação das Salvaguardas de Realtime (ADR-016)
1. Desenvolver a classe `RealtimeManager` em `src/core/realtime/manager.ts`.
2. Adicionar listeners para monitorar `visibilitychange` da aba/aplicação para pausar e retomar conexões via `pauseAll()` e `resumeAll()`.
3. Adicionar listeners de interação (`pointerdown`, `keydown`, `touchstart`) para controle de inatividade (idle-detection após 5 minutos).
4. Integrar o master switch que consome a feature flag `realtime_enabled` para desabilitar conexões remotamente.
5. Reativar o realtime no bootstrap da aplicação (`App.jsx`).

---

### Fase 5: Reestruturação de Pastas e Boundaries (10-ARCHITECTURE.md)
1. Criar a pasta `src/core/` e migrar a lógica das entidades.
2. Implementar a fábrica de entidades (`entityFactory`) para expor hooks padronizados (`useList`, `useGet`, `useMutate`).
3. Mapear `src/storage/` ( IndexedDB genérico) e `src/sync/` (fila de mutações com tratamento de erros).
4. Adicionar regras no `eslint.config.js` (`no-restricted-imports`) para impedir acoplamento direto da UI com Supabase ou Capacitor.

---

## 4. Plano de Verificação e QA

### 4.1. Testes Automatizados
* **Testes Unitários**: Rodar `npm run test` para certificar-se de que todos os testes unitários passam com sucesso.
* **Cobertura (Coverage)**: Validar a cobertura de testes no Vitest visando o patamar de 70%.
* **Linter**: Executar `npm run lint` para conferir a eliminação dos warnings resolvidos.
* **Banco de Dados**: Criar testes pgTAP no Supabase para garantir a estabilidade das RPCs no novo schema `dosy`.

### 4.2. Verificação Manual
1. **Modo Offline**: Desativar a rede, simular erros do servidor (como token inválido ou dose deletada no servidor) e verificar se o drain em `markDose.js` reverte o estado otimista local de forma limpa, alertando o usuário.
2. **Inatividade Realtime**: Deixar o app aberto na tela de detalhe de paciente por 6 minutos sem tocar na tela. Verificar nos logs se o unsubscribe foi disparado. Ocultar a aba e validar se o realtime foi pausado instantaneamente.
