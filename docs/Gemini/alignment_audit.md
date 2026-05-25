# Relatório de Auditoria de Alinhamento — MedControl v2 vs. Dosy v2 Spec

Este documento apresenta uma análise comparativa detalhada entre o estado atual da aplicação no repositório `medcontrol_v2` e o planejamento/especificação contidos nos documentos de design da futura versão `dosy-app` (localizados em `G:\00_Trabalho\01_Pessoal\Apps\dosy-app\docs`).

---

## 1. Resumo Executivo e Status Geral

A aplicação atual (`medcontrol_v2`) encontra-se em um estágio intermediário de transição (versão base `v0.2.8.0`). Vários mecanismos críticos baseados em lições de produção (como o agendamento de alarmes nativos resilientes e o pre-check HTTP no disparo do alarme) já estão integrados. No entanto, existem **gaps estruturais, de banco de dados e de arquitetura** significativos para atingir o alento completo da especificação `dosy-app`.

### Matriz de Alinhamento por Componente

| Componente / Área | Status | Detalhes do Gap | Referência Spec |
| :--- | :---: | :--- | :--- |
| **Arquitetura de Pastas** | 🔴 Incompatível | O app atual usa estrutura convencional (`src/services`, `src/state`, `src/hooks`, `src/utils`). O spec exige separação rígida em `src/pages`, `src/components`, `src/core`, `src/storage`, `src/sync` e `src/native`. | `10-ARCHITECTURE.md` |
| **Restrições de Imports (Boundaries)** | 🔴 Ausente | Sem regras de lint (`no-restricted-imports`) para impedir que a UI fale diretamente com o Supabase ou Capacitor. | `10-ARCHITECTURE.md §2` |
| **Database Namespace** | 🔴 Incompatível | O banco de dados físico e todas as consultas no código ainda utilizam o schema `medcontrol` em vez do planejado `dosy`. | `11-DB_SCHEMA.md` |
| **Tabelas do Banco de Dados** | 🔴 Lacunas Graves | Faltam tabelas essenciais como `profiles`, `treatment_versions`, `feature_flags`, `medication_principles`, `medication_rules` e `fcm_dispatched_log`. | `11-DB_SCHEMA.md §2` |
| **Colunas de Domínio** | 🔴 Incompleto | Campos clínicos em `patients` (peso, altura, contato de emergência, etc.) e campos de controle em `treatments` (como `version`, `parent_treatment_id`) ainda não existem no banco atual. | `11-DB_SCHEMA.md §2.3` |
| **Fila Offline & Storage** | 🟡 Divergência Planejada | O spec planeja `idb-keyval` para a fila de mutações. A base real migrou para `@capacitor/preferences` para viabilizar que o Worker Nativo em Java processe a sincronização em background. | `13-OFFLINE_FIRST.md` & `Plano_Worker_Native_v028.md` |
| **Realtime & Salvaguardas** | 🔴 Crítico | O realtime está **desativado** (`App.jsx:80`) devido a picos de egress. As 5 salvaguardas obrigatórias de ciclo de vida (ADR-016) não estão implementadas em `useRealtime.js`. | `ADR-016` & `10-ARCHITECTURE.md §4.8` |
| **Catálogo CMED 30k** | 🔴 Lacuna | O catálogo atual contém apenas ~980 medicamentos seed hardcoded contra as 30 mil apresentações reais da CMED planejadas. | `ADR-015` |
| **Máquinas de Estado** | 🟡 Parcial | As transições e regras de status de dose existem de forma descentralizada no front-end e em triggers do banco, mas não isoladas em um módulo puro `canTransition(from, to)`. | `14-STATE_MACHINE.md` |

---

## 2. Análise Detalhada dos Gaps

### 2.1. Estrutura de Pastas e Boundaries de Código (`10-ARCHITECTURE.md`)
O arquivo `10-ARCHITECTURE.md` estipula que a camada de visualização (UI) não deve conhecer detalhes de persistência (Supabase, IndexedDB) ou APIs nativas (Capacitor).
* **Estado Atual**: A UI importa diretamente funções de `src/services/supabase.js`, executa mutações TanStack Query de forma ad-hoc e chama plugins do Capacitor diretamente em telas.
* **Impacto**: Alta acoplagem. Dificulta a substituição de bibliotecas de storage ou execução em plataformas sem suporte nativo sem quebrar a UI.
* **Ação Necessária**: Migrar a lógica de negócio de `src/services` para `src/core/entities` encapsulada através de `entityFactory`, e configurar regras de Lint restritivas para bloquear importações diretas do Supabase nas pastas de componentes.

### 2.2. Schema do Banco de Dados e RPCs (`11-DB_SCHEMA.md`)
O planejamento prevê a transição completa de nomenclatura de banco para o namespace `dosy`.
* **Estado Atual**:
  - O schema Postgres físico é `medcontrol`.
  - As chaves estrangeiras (`medication_id` etc.) e campos de controle de histórico de tratamento (`parent_treatment_id`, `version`) não existem.
  - Várias RPCs possuem sobrecargas legadas (overloads) que acumulam complexidade técnica (`register_sos_dose`, `share_patient_by_email`).
* **Ação Necessária**: Executar a migração em massa `ALTER SCHEMA medcontrol RENAME TO dosy`, criar as colunas adicionais de dados clínicos dos pacientes e implementar a lógica de versionamento imutável de tratamentos através de funções SQL específicas.

### 2.3. Sincronização e Fila Offline (`13-OFFLINE_FIRST.md`)
Há uma divergência saudável e documentada entre o planejamento e o codebase real sobre a fila offline:
* **Especificado**: Guardar a fila de mutações no IndexedDB local usando a biblioteca `idb-keyval`.
* **Realidade**: Migrado para `@capacitor/preferences` (SharedPreferences nativo no Android).
* **Justificativa**: O app utiliza um Worker Nativo de background (`DoseSyncWorker.java` em Java) rodando via WorkManager periódico. O código Java não consegue acessar de forma performática ou confiável o IndexedDB do WebView Chrome. Armazenar a fila em `SharedPreferences` permite que o código Java leia as mutações pendentes e envie para o Supabase de forma totalmente transparente e em background, mesmo com o WebView destruído/suspenso pelo sistema operacional.
* **Ação Recomendada**: Atualizar o documento `13-OFFLINE_FIRST.md` na pasta do `dosy-app` para registrar essa decisão de arquitetura nativa em vez de forçar o uso exclusivo de IndexedDB.

### 2.4. Realtime Manager & Salvaguardas (ADR-016)
O maior risco financeiro e operacional mapeado é o consumo excessivo de tráfego de saída (Egress) do Supabase quando realtime está ativado sem limites.
* **Estado Atual**: O hook `useRealtime.js` realiza uma inscrição ampla para todas as atualizações do banco pertencentes ao usuário logado, mantendo a conexão WebSocket aberta indefinidamente. Para conter a falha, o realtime foi completamente comentado em `App.jsx`.
* **Planejado (ADR-016)**: Um `RealtimeManager` centralizado que implementa:
  1. **Visibility Guard**: Cancela inscrições quando o app fica em segundo plano/tab oculta e reconecta quando volta.
  2. **Idle Detection (5 min)**: Desconecta se o usuário passar 5 minutos sem tocar ou digitar na tela.
  3. **Master Switch**: Ativa/Desativa o realtime dinamicamente através de feature flags no banco de dados, assumindo polling como fallback caso desativado.
  4. **Max Channels Limit**: Limita a no máximo 1 canal ativo em paralelo por usuário.
* **Ação Necessária**: Desenvolver a classe `RealtimeManager` e reativar o realtime na aplicação principal aplicando rigorosamente as 5 salvaguardas da ADR-016.

### 2.5. Catálogo CMED e categorização robusta (ADR-015)
O spec prevê um catálogo curado integrado ao banco local para apoiar a categorização automática dos medicamentos inseridos.
* **Estado Atual**: A base possui um seed de apenas ~980 registros e a lógica de categorização no client (`inferGroupFromName`) depende de expressões regulares complexas, o que gerou bugs como o #0016 (onde o termo "pina" na substância Amilodipina acionava a regra incorreta, categorizando-o como Antidepressivo em vez de Anti-hipertensivo).
* **Planejado**: Ingestão de mais de 28 mil registros da CMED ANVISA e uso da tabela auxiliar `cmed_class_to_group_mapping` associada a uma trigger inteligente (`classify_medication_robust` de 5 níveis).
* **Ação Necessária**: Criar o script de ingestão do Excel da CMED (`ingest-cmed.mjs`), configurar a trigger de classificação robusta no banco de dados e integrar a tabela de aprendizado coletivo (`medication_categorization_suggestions`).

---

## 3. Roteiro Recomendado de Alinhamento

Para colocar o aplicativo atual em conformidade total com o planejamento do `dosy-app`, a seguinte ordem de execução (baseada no histórico de auditoria) é recomendada:

```
[Fase 1: Correção de Bugs e Preparação]
  ├── Fix bug #0016 (Regex de categorias)
  ├── Adicionar migrations de categorias ausentes no repositório (v0.2.4.0)
  └── Integrar e validar os testes unitários quebrados de dateUtils e statusUtils

[Fase 2: Expansão do Catálogo CMED (ADR-015)]
  ├── Ingestão da planilha CMED ANVISA (30k rows) via script local
  └── Criar tabela cmed_class_to_group_mapping no DB e mover lógica regex para lá

[Fase 3: Migração de Schema & Gaps Clínicos]
  ├── Executar Rename do Schema (medcontrol → dosy) e ajustar referências no código Java
  ├── Adicionar colunas clínicas adicionais (patients) e campos de versão (treatments)
  └── Criar tabelas auxiliares: audit_log, feature_flags, fcm_dispatched_log

[Fase 4: Hardening de Realtime & Salvaguardas (ADR-016)]
  ├── Implementar RealtimeManager com visibility-change, idle-timeout e master-switch
  └── Reativar a chamada useRealtime() em App.jsx com as salvaguardas ativas

[Fase 5: Refatoração de Arquitetura de Pastas (10-ARCHITECTURE.md)]
  ├── Mover hooks e regras de negócio para src/core/
  └── Aplicar regras no eslint.config.js para isolamento rígido da UI
```

---

## 4. Considerações de Privacidade e LGPD

Ambos os projetos têm como prioridade a segurança de dados de saúde. 
* A especificação de limites de caracteres (max 500 em observações de dose), remoção de dados de PII em logs de erro do Sentry e o banner de consentimento de Analytics (PostHog Consent) já estão parcialmente integrados em `medcontrol_v2` e devem ser mantidos e validados após a mudança para o schema `dosy`.
* O fluxo de unshare de paciente compartilhado exige a exclusão síncrona dos alarmes nativos nos dispositivos dos cuidadores via FCM do tipo HIGH priority, conforme planejado em `14-STATE_MACHINE.md §5.4`. Essa integração nativa precisa ser validada em conjunto com a migração de schema.
