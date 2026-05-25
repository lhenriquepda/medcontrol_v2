# Plano de QA Autônomo para Agente de IA — MedControl v2 / Dosy v2

Este documento é o guia de execução de testes automatizados e interativos projetado especificamente para ser interpretado e executado de forma **100% autônoma por um agente de IA**. Ele descreve os procedimentos passo a passo, comandos de terminal e métodos de verificação lógica que a IA deve utilizar.

---

## 1. Kit de Ferramentas do Agente de IA

Para executar este plano de QA de forma autônoma, a IA utilizará as seguintes ferramentas padrão de seu contexto:

1. **`run_command`**: Para disparar builds, testes unitários, comandos do Android SDK (`adb`) e consultas SQL (`psql`).
2. **`view_file`**: Para inspecionar e analisar o dump XML de layouts do Android e ler logs de erro.
3. **`replace_file_content` / `write_to_file`**: Para programar scripts de automação auxiliares.

---

## 2. Protocolo de Interação com o Emulador Android (UI Autônoma)

Como a IA não possui visão de tela em tempo real por cursor físico, ela deve usar o seguinte protocolo em três etapas para interagir com a interface gráfica do emulador:

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  1. DUMP DO LAYOUT     │      │   2. PARSE COORDENADAS │      │   3. AÇÃO VIA ADB      │
│ adb shell uiautomator  │ ───> │ Procurar bounds="..."  │ ───> │ adb shell input tap    │
│ dump & adb pull        │      │ no XML (centro x, y)   │      │ adb shell input text   │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

### Script de Apoio para a IA
Para facilitar a localização e interação com elementos, a IA pode rodar comandos concatenados para puxar o XML e analisar o nó desejado.
* **Comando para extração de layout**:
  `adb shell uiautomator dump /data/local/tmp/uidump.xml && adb pull /data/local/tmp/uidump.xml tmp_ui.xml`
* **Cálculo de Coordenadas de Bounds**:
  Se o elemento possui `bounds="[100,200][300,400]"`, as coordenadas centrais de clique são:
  - $X = 100 + (300 - 100) / 2 = 200$
  - $Y = 200 + (400 - 200) / 2 = 300$
  - Comando: `adb shell input tap 200 300`

---

## 3. Roteiros de Teste Autônomo por Funcionalidade

---

### Cenário 1: Autenticação, Session Bootstrapping e Logout

#### Objetivo:
Verificar se o aplicativo inicializa corretamente, realiza login via Supabase e limpa todos os dados locais no logout.

#### Roteiro de Execução da IA:
1. **Inicializar o App**:
   `adb shell am force-stop com.dosyapp.dosy`
   `adb shell am start -n com.dosyapp.dosy/.MainActivity`
   *(Aguardar 3 segundos)*
2. **Verificar Estado Inicial**:
   Executar o dump de layout e ler `tmp_ui.xml`.
   * **Se encontrar campos de login (e-mail/senha)**: Proceder para o passo 3.
   * **Se encontrar a tela principal (Dashboard)**: Executar fluxo de Logout primeiro (clicar nas coordenadas de configurações -> botão "Sair"), depois retornar ao passo 1.
3. **Preencher Credenciais**:
   - Localizar os nós contendo `resource-id="email"` e `resource-id="password"`.
   - Clicar nas coordenadas do campo de E-mail.
   - Digitar o e-mail de teste: `adb shell input text "user@test.com"`
   - Clicar nas coordenadas do campo de Senha.
   - Digitar a senha: `adb shell input text "senha123"`
   - Clicar nas coordenadas do botão com texto "Entrar".
4. **Verificar Sucesso do Login**:
   *(Aguardar 5 segundos)*
   Executar novo dump de layout. A IA deve validar a presença de elementos com texto "Dashboard" ou o nome do paciente ativo.
5. **Verificar Limpeza Nativa no Logout**:
   - Localizar e clicar no botão "Configurações" e em seguida em "Sair".
   - Executar no terminal:
     `adb shell run-as com.dosyapp.dosy ls /data/data/com.dosyapp.dosy/shared_prefs/`
   - A IA deve verificar que os arquivos de preferência de alarmes e tokens foram esvaziados ou excluídos.

---

### Cenário 2: Tomada de Dose Offline e Fila de Sincronização

#### Objetivo:
Validar a persistência local em SharedPreferences durante desconexão e o envio automático em lote após o retorno da rede.

#### Roteiro de Execução da IA:
1. **Desativar Conexão de Rede**:
   `adb shell svc wifi disable`
   `adb shell svc data disable`
2. **Registrar Ação Offline na UI**:
   - Dump de layout e identificar o botão "Confirmar" da primeira dose pendente da lista.
   - Clicar nas coordenadas do botão.
3. **Verificar Comportamento Otimista (UI)**:
   - Executar novo dump de layout.
   - A IA deve constatar que a dose marcada sumiu da lista de pendentes ou mudou de cor/ícone para concluída imediatamente.
4. **Verificar Persistência da Fila Offline**:
   - Executar leitura das preferências nativas do Capacitor:
     `adb shell run-as com.dosyapp.dosy cat /data/data/com.dosyapp.dosy/shared_prefs/CapacitorStorage.xml`
   - A IA deve ler o XML retornado e validar a existência de um JSON sob a chave `pendingMutationsQueue` contendo a dose modificada com status `pending`.
5. **Religar Conexão de Rede**:
   `adb shell svc wifi enable`
   `adb shell svc data enable`
   *(Aguardar 5 segundos)*
6. **Validar Sincronização no Banco de Dados (Supabase)**:
   - A IA deve rodar uma query SQL direta no banco para checar o status atual da dose modificada:
     `psql -d $DATABASE_URL -c "SELECT status, \"actualTime\" FROM dosy.doses WHERE id = 'ID_DA_DOSE';"`
   - Critério de Aceite: O status no banco deve ser `'done'` e `actualTime` não deve ser nulo.
7. **Validar Esvaziamento da Fila Local**:
   - Rodar novamente o comando de leitura do `CapacitorStorage.xml` nativo e verificar que a chave `pendingMutationsQueue` agora está vazia `[]`.

---

### Cenário 3: Erro de Validação com Rollback Otimista (Reversão Segura)

#### Objetivo:
Verificar que mutações que falham no servidor (ex: dose inexistente ou erro 403) realizam rollback da UI e emitem avisos, sem travar a fila.

#### Roteiro de Execução da IA:
1. **Desativar Rede**:
   `adb shell svc wifi disable`
   `adb shell svc data disable`
2. **Inserir Mutação Inválida/Maliciosa na Fila**:
   - Para simular de forma autônoma sem depender de falhas externas, a IA deve escrever um patch direto no arquivo de preferências locais contendo um ID de dose inexistente (`00000000-0000-0000-0000-000000000000`).
3. **Religar Rede**:
   `adb shell svc wifi enable`
   `adb shell svc data enable`
4. **Monitorar Execução e Rollback**:
   *(Aguardar 5 segundos)*
   - Executar o dump de layout e inspecionar a tela.
   - Critério de Aceite: A IA deve identificar o aparecimento de um componente toast/snackbar com a mensagem de erro (ex: "Erro de sincronização" ou "Dose não encontrada").
   - A dose modificada localmente deve retornar visualmente ao estado original (`pending`).

---

### Cenário 4: Revogação de Cuidador e LGPD (`patient_shares`)

#### Objetivo:
Validar que a remoção do acesso de um cuidador deleta instantaneamente seus alarmes nativos e limpa seus dados de cache local.

#### Roteiro de Execução da IA (Simulação de 2 Dispositivos):
*Nota: A IA pode simular esse fluxo usando o emulador (cuidador) e chamadas diretas de banco de dados SQL (representando o proprietário).*

1. **Configurar o Emulador**:
   - Garantir que o emulador está logado com a conta do cuidador e que o cache possui dados do paciente compartilhado.
   - Dump de layout para confirmar a visualização das doses do paciente compartilhado.
2. **Simular Revogação do Acesso via SQL**:
   - Como o proprietário, a IA executa o comando SQL para deletar o compartilhamento:
     `psql -d $DATABASE_URL -c "DELETE FROM dosy.patient_shares WHERE shared_with_email = 'caregiver@test.com';"`
3. **Verificar Notificação de Limpeza Nativa (FCM HIGH)**:
   - Monitorar o `logcat` nativo do emulador em tempo real:
     `adb logcat -d | grep -E "DosyMessagingService|cancelAlarm"`
   - A IA deve verificar a linha de log confirmando a interceptação da mensagem push contendo o payload de remoção e a subsequente chamada nativa de cancelamento de alarmes.
4. **Verificar Limpeza da Interface**:
   *(Aguardar 3 segundos)*
   - Dump de layout no emulador.
   - Critério de Aceite: O app deve ter saído automaticamente da tela do paciente compartilhado ou exibir um banner/modal informando que o acesso foi encerrado, não permitindo mais ver as doses.

---

### Cenário 5: Inatividade do Realtime e Visibility Change (ADR-016)

#### Objetivo:
Garantir o desligamento automático de conexões realtime para economizar tráfego (egress) sob inatividade ou ocultação de tela.

#### Roteiro de Execução da IA:
1. **Ativar logs de Realtime no App**:
   - Garantir que a aplicação está rodando em modo desenvolvimento e com realtime ativado.
2. **Testar Ocultação de Tela (Visibility Hidden)**:
   - Enviar o app para background:
     `adb shell input keyevent 3`  # Botão Home do Android
   - Inspecionar a saída do logcat:
     `adb logcat -d | grep -i -E "realtime|unsubscribe|pausedAll"`
   - Critério de Aceite: O log do sistema deve registrar `pausedAll (visibility:hidden)` e a desconexão do canal realtime.
3. **Testar Retorno de Tela (Visibility Visible)**:
   - Trazer o app de volta para o foreground:
     `adb shell am start -n com.dosyapp.dosy/.MainActivity`
   - Inspecionar logs e confirmar a linha `resumeAll` e a re-inscrição bem-sucedida do WebSocket.
4. **Testar Inatividade (Idle 5 min)**:
   - Para evitar esperar 5 minutos de forma ociosa, a IA deve modificar temporariamente o tempo de idle na constante de desenvolvimento do código (`RealtimeManager` em `src/core/realtime/manager.ts`) de `5 * 60 * 1000` para `10_000` (10 segundos).
   - Abrir o app no emulador e não disparar nenhum comando de interação por 12 segundos.
   - Inspecionar logs.
   - Critério de Aceite: O logcat deve mostrar a chamada `pausedAll (reason: idle)` após 10 segundos sem interações detectadas.

---

## 4. Checklists de Execução e Status (Controle da IA)

A IA deve manter uma tabela de progresso ao rodar a suíte autônoma no emulador:

| ID Teste | Funcionalidade | Status | Log / Erro Encontrado |
| :--- | :--- | :---: | :--- |
| **AUT-01** | Login Supabase | `Sucesso` | Logado com teste-free@teste.com, dados carregados via Supabase |
| **AUT-04** | Logout e Limpeza Nativa | `Sucesso` | SharedPreferences nativos esvaziados com sucesso após logout |
| **PAC-02** | Validação Clínicos Patient | `Pendente` | Fora do escopo do ciclo de testes atual |
| **TRA-03** | Pausar Tratamento e Doses | `Pendente` | Fora do escopo do ciclo de testes atual |
| **TRA-05** | Edição com Histórico Histórico | `Pendente` | Fora do escopo do ciclo de testes atual |
| **DOS-03** | Janela de Undo (5min) | `Pendente` | Fora do escopo do ciclo de testes atual |
| **DOS-05** | Validação de Doses SOS | `Pendente` | Fora do escopo do ciclo de testes atual |
| **OFF-02** | Drain e Sync Offline | `Sucesso` | Enfileiramento offline no CapacitorStorage.xml verificado e enviado ao Supabase após restabelecer conexão |
| **OFF-03** | Conflito 409 UI Prompt | `Sucesso` | Erros lógicos de sincronização (como id inexistente returning 404) limpos com sucesso e revertidos localmente |
| **SHR-03** | Revogação LGPD Push HIGH | `Sucesso` | Remoção de compartilhamento via banco e simulação de FCM de revogação limparam os dados e cache local |
| **ALM-02** | Persistência BootReceiver | `Pendente` | Fora do escopo do ciclo de testes atual |
| **RTM-01** | Visibility Pause Realtime | `Bloqueado`| Lógica de salvaguardas (ADR-016) ainda não implementada no arquivo src/hooks/useRealtime.js |
| **RTM-02** | Idle Timeout Realtime | `Bloqueado`| Lógica de salvaguardas (ADR-016) ainda não implementada no arquivo src/hooks/useRealtime.js |
