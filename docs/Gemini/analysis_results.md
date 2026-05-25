# Relatório de Análise do Projeto — MedControl v2

Realizamos uma análise profunda do codebase da aplicação. Buscamos por bugs lógicos, problemas de sincronização offline, divergências em testes automatizados, código morto (dead code) e alertas/warnings emitidos pelo linter ESLint.

---

## 1. Bugs Críticos Detectados

### 1.1. Falha Silenciosa no Descarte e Reversão de Doses em Offline Drain (`src/services/markDose.js`)
* **Problema**: Na função `_runDrain`, que processa a fila de mutações pendentes (`pendingMutationsQueue`) quando o dispositivo se reconecta à internet ou inicia o app, se o servidor retornar um erro lógico com `ok === false` que **não** seja o código `409` (por exemplo, `401 Unauthorized`, `403 Forbidden`, `404 Not Found` ou `500 Internal Server Error`), a mutação é removida da fila via `await _queueRemove(mut.requestId)`. Porém:
  1. A dose local **não é revertida** (continua com a flag otimista `_optimistic: true` e com o status modificado);
  2. Nenhuma mensagem ou toast de erro é emitida (pois `emitMutationError` só é chamada no fluxo interativo de `markDose`, mas não em `_runDrain` para esses casos);
  3. A mutação é excluída da fila e nunca será re-sincronizada, deixando o banco de dados local permanentemente inconsistente com o servidor.
* **Solução**: Atualizar o tratamento de resposta no loop do drain em `_runDrain` para tratar erros com `result?.ok === false` de forma análoga a `markDose`, revertendo o status local da dose via `revertDose()` e emitindo o erro visualmente via `emitMutationError()`.

---

## 2. Divergências e Quebras de Testes Unitários

### 2.1. Teste de Janela Incorreto para `24h` em `src/utils/dateUtils.test.js`
* **Problema**: O teste unitário para `rangeNow('24h')` possui uma expectativa errada herdada por cópia do teste de `12h`:
  ```javascript
  it('24h', () => {
    const r = rangeNow('24h')
    expect(new Date(r.from).getHours()).toBe(6) // DEVERIA SER 0!
    expect(new Date(r.to).getDate()).toBe(16)
  })
  ```
  A função `rangeNow('24h')` define a data inicial subtraindo 12 horas do momento atual (`12:00` no mock de tempo). Portanto, a hora inicial correta deve ser `12 - 12 = 0` (meia-noite), e não `6`. Isso fazia o teste falhar sempre.
* **Solução**: Ajustar a expectativa para `expect(new Date(r.from).getHours()).toBe(0)`.

### 2.2. Configuração de Estados Desatualizada em `src/utils/statusUtils.test.js`
* **Problema**: O teste `STATUS_CONFIG has 4 statuses` espera apenas as chaves `['done', 'skipped', 'overdue', 'pending']`. Contudo, na versão `0.2.3.1`, foi adicionado o novo status `cancelled`, totalizando 5 chaves. Isso causa falha na asserção.
* **Solução**: Atualizar a lista de chaves esperadas no teste para incluir `'cancelled'`.

### 2.3. Execução de Testes E2E indesejada no Vitest
* **Problema**: O arquivo de especificação de ponta a ponta (`e2e/specs/01-auth.spec.mjs`) está sendo coletado pelo runner do Vitest, mas ele utiliza sintaxe do Mocha/Appium (`this.timeout()`), gerando um erro `TypeError: Cannot read properties of undefined (reading 'timeout')`.
* **Solução**: Excluir a pasta `e2e/**` do escopo de testes na configuração `vitest.config.js`.

---

## 3. Código Morto (Dead Code)

### 3.1. Handlers de Doses em `src/services/mutationRegistry.js`
* **Detalhe**: Na versão `v0.2.7.0` (Refatoração de Sync v2), a máquina de estado de doses migrou do TanStack Query para uma Zustand Store (`src/state/doseStore.js`) com persistência em fila manual (`src/services/markDose.js`).
* **Código Morto**: Os registros de mutation defaults para `confirmDose`, `skipDose` e `undoDose` dentro de `src/services/mutationRegistry.js` são mantidos e importam funções de `dosesService.js`. Contudo, os hooks correspondentes (`useConfirmDose`, `useSkipDose`, `useUndoDose`) em `src/hooks/useDoses.js` foram reescritos para usar `useDoseAction`, que chama `markDose` diretamente e **não** passa pelo pipeline do TanStack Query.
* **Nota**: Podemos manter o arquivo por razões históricas para as demais mutações (como `registerSos`, `createPatient`, `createTreatment`), mas os callbacks de `confirmDose`, `skipDose` e `undoDose` no registro de defaults são 100% inativos.

---

## 4. Refatoração de Warnings do ESLint (Melhoria de Performance e Code Quality)

### 4.1. Chamada de `setState` dentro de `useEffect` em `src/pages/TreatmentForm.jsx`
* **Problema**: O linter avisa que atualizar o estado de `durationUnit` via `useEffect` no formulário causa re-renders em cascata indesejados (`react-hooks/set-state-in-effect`).
* **Solução**: Em vez de observar a mudança de `intervalHours` ou `mode` via efeito colateral, podemos fazer essa sincronização de unidade de forma imperativa direta nos locais onde o usuário interage e altera os valores de `intervalHours` ou `mode`.

### 4.2. Chamada de `setPermState` duplicada e dentro de `useEffect` em `src/services/notifications/index.js`
* **Problema**: O linter aponta a chamada `setPermState(Notification.permission)` no hook `useEffect` de montagem Web.
* **Solução**: O estado `permState` já é inicializado na criação do estado com `supported ? Notification.permission : 'unsupported'`. Logo, re-aplicar o mesmo valor imediatamente após o mount no `useEffect` é redundante. A linha pode ser removida com segurança.
