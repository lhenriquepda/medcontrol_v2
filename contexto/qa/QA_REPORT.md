# QA Report — Dosy v0.2.3.6

**Data:** 2026-05-15  
**Branch:** release/v0.2.3.6  
**Device:** Pixel8_Test (emulator-5554, Android 35 x86_64, DPR 2.625, viewport 412×840)  
**Conta:** teste-plus@teste.com (tier Plus)  
**Executado por:** IA autônoma (Claude Code)  
**Objetivo:** QA completo pré-release — todas telas, fluxos como usuário real  

---

## Status Global

| Área | Status | Bugs |
|---|---|---|
| Dashboard | ✅ OK | — |
| Patients (CRUD) | ✅ OK | — |
| Treatments (CRUD + pause/resume) | ✅ OK | BUG #3 cosmético |
| Doses (confirm/skip/undo) | ✅ OK | — |
| SOS (regras + over-limit + force) | ✅ OK | BUG #1 locale |
| Histórico | ✅ OK | — |
| Análises (Analytics) | ✅ OK | — |
| Relatórios (PDF/CSV) | ✅ OK | BUG #4 status |
| Ajustes (Settings) | ✅ OK | BUG #2 ad position |
| Push FCM (alarme crítico OFF) | ✅ OK | — |
| Push resumo diário | ⏳ pendente (manual) | — |
| Idle 20min | ❌ FALHOU → **FIXADO** #255 | BUG #6 P1 |

---

## 🐛 Bugs Encontrados

### BUG #1 — HORÁRIO em SOS mostra formato en-US
**Área:** SOS → campo HORÁRIO  
**Severidade:** Visual / UX — P3  
**Descrição:** O campo `<input type="datetime-local">` no formulário SOS exibe o horário no formato americano: `05/15/2026, 3:06PM` em vez de pt-BR `15/05/2026 15:06`.  
**Reprodução:** Navegar para S.O.S → o campo HORÁRIO mostra data pré-preenchida em formato en-US.  
**Causa provável:** O elemento `datetime-local` usa a locale do OS/WebView do Android. O WebView no emulador está configurado com locale `en-US` em vez de `pt-BR`.  
**Impacto:** Confusão visual para usuários BR. Não afeta o valor interno (ISO 8601).  
**Evidência logcat:** Nenhuma — visual only.  
**Sugestão fix:** Usar um componente customizado de datepicker em vez de `<input type="datetime-local">`, ou formatar o valor displayed via JS com `Intl.DateTimeFormat('pt-BR')`.

---

### BUG #2 — Ad banner Plus aparece ACIMA do header Dosy
**Área:** Mais → tela geral (toda a app com Plus tier)  
**Severidade:** Visual / UX — P3  
**Descrição:** O banner de anúncio (AdMob, 1 ad para Plus) é renderizado ACIMA do header da app (logo Dosy + saudação). Resultado: o logo Dosy fica deslocado para baixo e o primeiro conteúdo visível é o ad em vez da identidade visual da app.  
**Reprodução:** Logar como teste-plus@teste.com → navegar para /mais → ad banner aparece antes do header Dosy.  
**Impacto:** Impacto na identidade visual. Para usuários Plus (que pagam), o ad acima do header parece mais intrusivo que "discreto". Revisar posicionamento.  
**Sugestão fix:** Ad deve aparecer em posição discreta (ex: bottom, abaixo do bottom nav, ou no meio de lista) — nunca sobre o header.

---

### BUG #3 — TesteRemedio exibe "1 dias" restando mas termina HOJE
**Área:** Tratamentos → card de tratamento  
**Severidade:** Cosmético — P4  
**Descrição:** O tratamento TesteRemedio (TestePaciente) exibe "1 dias" de duração restante com data de término 15/05/2026, sendo que hoje é 15/05/2026. Deveria exibir "Termina hoje" ou "0 dias" em vez de "1 dias".  
**Reprodução:** Navegar para /tratamentos → ver card TesteRemedio.  
**Impacto:** Confusão de leitura (1 dia = amanhã implica, mas termina hoje).  
**Sugestão fix:** Se `daysRemaining <= 0`, exibir "Termina hoje". Se `daysRemaining < 0`, exibir "Encerrado".

---

### BUG #4 — Dose mostra status "Cancelada" em Relatórios após pause/resume de tratamento
**Área:** Relatórios → DETALHAMENTO  
**Severidade:** Funcional — P2  
**Descrição:** Após ciclo de pause+resume do tratamento Dipirona, a dose de 16:00 do dia aparece nos Relatórios com status "Cancelada" em vez de "Pendente" (o status real no momento da consulta). O dashboard mostrava a dose como "pendente", mas os relatórios exibem "Cancelada".  
**Reprodução:**  
1. Criar tratamento Dipirona (8h/8h) para QAPacienteNovo  
2. Confirmar dose → Desfazer (undo)  
3. Pausar o tratamento → Retomar  
4. Navegar para /relatórios → DETALHAMENTO  
5. Dose de 16:00 aparece como "Cancelada"  
**Causa provável:** O ciclo de pause/resume pode estar cancelando doses com `scheduledAt` no passado imediato e não recriando-as. Ou o status "cancelled" existe no DB mas o dashboard o mapeia para "pending" ao exibir.  
**Impacto:** Inconsistência entre dashboard (pendente) e relatórios (cancelada). Pode confundir usuários e médicos que consultam o histórico.  
**Sugestão investigação:** `SELECT status, "scheduledAt" FROM medcontrol.doses WHERE id='[dose_id]'` para ver o status real no DB.

---

### BUG #6 — IDLE LONGO → Skeleton infinito no Dashboard (FIXADO em #255)
**Área:** Dashboard / useAppResume  
**Severidade:** P1 — Funcional crítico  
**Reproduced:** App em background 3h10min. Token expirou durante freeze do Android (processo congelado por OS).  
**Sintoma:** Após retornar ao foreground, Dashboard mostra skeleton infinito. Saudação e header cards carregam (PersistQueryClient cache), mas patient list e ADESÃO 7D ficam em skeleton para sempre.  
**Root cause:**  
1. Token expirou poucos minutos antes do freeze (exp < now em 11.448 segundos)
2. `useAppResume.onResume()` chama `supabase.auth.refreshSession()`
3. `refreshSession()` tenta adquirir `processLock` (lockAcquireTimeout=15s)
4. Lock timeout → lança `ProcessLockAcquireTimeoutError` (sem fazer HTTP request)
5. Código classifica como "transient error" (`isAuthFailure=false`) → mantém session
6. `refetchQueries()` dispara todas queries com token expirado → todas retornam 401
7. Queries ficam em estado de erro/skeleton infinito
8. **Zero network requests** observados via CDP Network Monitor  
**Fix aplicado:** `_readStoredTokenExpiry()` lê `expires_at` direto do localStorage (bypass processLock). Se token expirado + refresh falhou como "transient" → force `supabase.auth.signOut()` → `useAuth` redireciona para login. Commit `de90af7`.  
**Observação:** O `lockAcquireTimeout: 15s` (v0.2.3.6) fixou o orphan lock (skeleton loop por lock órfão). Este bug é diferente: o lock não está órfão — está sendo adquirido, mas timeout antes de fazer o HTTP. O fix `#255` fecha o gap.

---

### OBSERVAÇÃO #5 — Console errors "[object Object]" no Dashboard/Patients
**Área:** Dashboard → Console  
**Severidade:** Investigar — P2  
**Descrição:** Ao carregar o Dashboard e navegar para /pacientes, o CDP captura erros de console `[error] [object Object]`. Esses erros são objetos JavaScript (possivelmente erros Supabase ou React Query) sendo logados sem `.message` serializado.  
**Reprodução:** Abrir CDP Console listener antes de navegar → erros aparecem em 2 instâncias no Dashboard e ao navegar para Patients.  
**Impacto:** Podem ser erros de fetch silenciosos. Não causaram problema visível na UI mas podem mascarar problemas de rede.  
**Sugestão investigação:** Adicionar `console.error('...', err?.message, err)` em vez de `console.error(err)` nos catch blocks para serializar corretamente.

---

## Detalhamento por Seção

### 1. Dashboard `/`
- ✅ Renderiza com saudação: "Boa tarde, Teste Plus"
- ✅ Filtros de tempo: 12h, 24h, 48h, 7 dias, 10 dias — todos funcionam
- ✅ Contador "X/Y doses" atualiza corretamente
- ✅ "X pendentes" / "X atrasadas agora" atualiza após confirmar/pular
- ✅ "Tá em dia." aparece quando sem atrasadas
- ✅ Badges de alerta (dose atrasada, tratamento acabando) funcionam
- ✅ Patient cards expansíveis com dose list
- ✅ Swipe reveal: Tomada (verde, swipe direita) / Pular (vermelho, swipe esquerda)
- ✅ Adesão 7D calculada corretamente
- ⚠️ Dose detail modal: dose confirmada mas mostra via swipe — funciona via ADB touch events
- ℹ️ Ad banner Test Ad visível (Pixel8 emulator com Google Play Store)

### 2. Pacientes `/pacientes`
- ✅ Listagem com avatar, nome, idade
- ✅ Criar paciente: form completo (nome, idade, peso, condição, médico, alergias, avatar)
- ✅ Toast "Paciente cadastrado." após save
- ✅ Redirecionamento para /pacientes após criação
- ✅ Patient detail: shows todos campos + "Compartilhar paciente" + "Doses hoje" + "Tratamentos"
- ✅ Botão "Editar" navega para /pacientes/{id}/editar
- ✅ "Novo tratamento" navega para /tratamento/novo?patientId={id}

### 3. Tratamentos `/tratamentos`
- ✅ Lista ativos/pausados/encerrados com contadores
- ✅ Busca por medicamento
- ✅ Filtro por paciente  
- ✅ Criar tratamento com ANVISA autocomplete (onPointerDown funciona)
- ✅ ANVISA autocomplete retorna sugestões para "Dipi" → Dipirona, Dipirona sódica, etc.
- ✅ Frequência, modo, duração configuráveis
- ✅ "Salvar como modelo" disponível
- ✅ Pausar tratamento: funciona sem diálogo (instantâneo), move para PAUSADOS
- ✅ Retomar tratamento: funciona, move de volta para ATIVOS
- ✅ Ações: Editar, Pausar/Retomar, Encerrar
- 🐛 BUG #3: "1 dias" quando termina hoje

### 4. Doses (via Dashboard)
- ✅ Confirmar dose: swipe direita + tap Tomada → "X marcada como tomada" toast
- ✅ Dose detail modal: PREVISTO, TOMADO, horário real, botão Desfazer
- ✅ Desfazer: funciona no modal → dose volta para pendente
- ✅ Pular dose: via tap card → modal com opções: Agora / Hora prevista / Outro / Ignorar / Pular / Tomada
- ✅ Dashboard atualiza em tempo real após cada ação
- ✅ ATRASADAS: 0 + "Tá em dia." após pular dose atrasada
- ℹ️ Swipe gestures requerem touch events (ADB swipe não funciona confiável para swipe-reveal — use onPointerDown CDP ou touch físico)

### 5. S.O.S `/sos`
- ✅ Header: "S.O.S / Dose extra fora do agendado"
- ✅ DOSE EMERGENCIAL hero card
- ✅ Chips de paciente: todos os pacientes da conta listados
- ✅ Autocomplete ANVISA: "Dipi" → [Dipirona, Dipirona sódica, Anlodipino...] ✅
- ✅ Medicamentos recentes aparecem após primeiro SOS
- ✅ Stats: ÚLTIMAS 24H e TOTAL SOS atualizam
- ✅ Validação: toast "Preencha paciente, medicamento e dose." quando incompleto
- ✅ Limites de segurança: regra criada (mín. 2h, máx. 2/dia Dipirona)
- ✅ Over-limit ConfirmDialog: "⚠️ Limite de segurança atingido / Intervalo mínimo de 2h não respeitado. Próxima permitida: XX/XX/XXXX XX:XX / Cancelar / Registrar mesmo assim"
- ✅ Force submit (p_force=true): dose inserida quando user confirma
- ✅ ATUALIZAR limite existente funciona
- 🐛 BUG #1: Data/hora em formato en-US no campo HORÁRIO

### 6. Histórico `/historico`
- ✅ Semana de adesão com percentuais diários
- ✅ Lista doses por dia com detalhes
- ✅ Filtro "Todos pacientes"
- ✅ Tags: "s.o.s" para doses SOS, "no horário" para doses confirmadas

### 7. Análises `/relatorios-analise`
- ✅ Filtros 7d, 30d, 90d
- ✅ Filtro por paciente
- ✅ Gráfico circular de adesão geral com percentual
- ✅ "+XX pp vs. anterior" comparativo
- ✅ Grid de stats: Tomadas, Puladas, Atrasadas
- ✅ Sequência de dias sem esquecer
- ✅ Total doses no período
- ✅ Horário difícil
- ✅ SOS no período com top medicamento

### 8. Relatórios `/relatorios`
- ✅ Filtros por paciente e período (7d, 10d, 30d, 1 ano, Custom)
- ✅ Summary card: adesão % e "X de Y doses"
- ✅ Distribuição: Tomadas, Puladas, Atrasadas, Pendentes com %
- ✅ Top medicamentos com contagem
- ✅ DETALHAMENTO: lista com data, status, paciente, med
- ✅ "Exportar PDF": toast "PDF salvo em Documentos · dosy-todos"
- ✅ "Exportar CSV": funciona
- 🐛 BUG #4: Status "Cancelada" após ciclo pause/resume

### 9. Ajustes `/ajustes`
- ✅ SEU PLANO: badge "PLUS" visível
- ✅ Modo escuro: toggle funciona (html.classList.contains('dark') = true)
- ✅ Notificações push: toggle ON/OFF, label "Ativo/Inativo"
- ✅ Alarme crítico: toggle — localStorage `criticalAlarm` atualiza via ADB tap
- ✅ Não perturbe: toggle disponível
- ✅ Bloqueio do app: toggle disponível
- ✅ SEU NOME: campo editável + "Salvar nome"
- ✅ Email: exibido corretamente
- ✅ Alterar senha: disponível
- ✅ Sair: disponível
- ✅ LGPD: "Compartilhar meus dados (JSON)" + "Excluir minha conta e todos os dados"
- ✅ Versão: "Dosy v0.2.3.6-dev · pt-BR / Atualizado"
- ✅ Ajuda/FAQ: link disponível
- ⚠️ Toggle interaction: via JS `click()` pode clicar no elemento errado. Usar ADB tap com coordenadas físicas.
- 🐛 BUG #2: Ad banner acima do header na tela "Mais"

### 10. Push FCM — Alarme Crítico OFF
- ✅ FCM data message recebido: `DosyMessagingService: schedule_alarms: 1 doses`
- ✅ `criticalOn=false` corretamente lido pelo AlarmScheduler
- ✅ `branch=PUSH_CRITICAL_OFF` → push regular agendado (não alarm)
- ✅ Push_subscriptions: device registrado (device_id_uuid: 45d9e2e1, criado 15:18 UTC)
- ✅ triggerAt correto para scheduledAt da dose

### 11. Push Resumo Diário
- ⏳ Pendente validação

### 12. Idle 3h10min — processLock lockAcquireTimeout
**Resultado: FALHOU — BUG #6 identificado e FIXADO em commit de90af7**
- App em background de 15:21 UTC a 18:31 UTC (3h10min — muito além dos 20min target)
- Token expirou em 15:22 UTC (1min após ir para background)
- Android congelou processo às 15:23 UTC (`ActivityManager: freezing 2177 com.dosyapp.dosy.dev`)
- Push notification disparou às 15:23 UTC (`NOTIFICATION_HEADS_UP_DISAPPEAR` em logcat) ✅
- Após resume às 18:31 UTC:
  - ✅ App retornou ao foreground sem crash
  - ✅ Ajustes (/ajustes) carregou imediatamente sem skeleton
  - ✅ Saudação "Boa noite" atualizada corretamente
  - ❌ Dashboard → skeleton infinito na patient list e ADESÃO 7D
  - ❌ Zero network requests ao Supabase em 10+ minutos de foreground
  - Root cause: token expirado + processLock timeout → "transient error" sem HTTP → skeleton
- Fix aplicado: `_readStoredTokenExpiry()` + force signOut quando token expirado
- ⏳ Precisa validação no device físico após rebuild com fix #255

---

## Logcat Relevante

### Push FCM — Alarme Crítico OFF (15:20:34 UTC)
```
DosyMessagingService: schedule_alarms: 1 doses
AlarmScheduler: scheduleDoseAlarm prefsSource=payload criticalOn=false dndOn=false inDnd=false triggerAt=1778858580000
AlarmScheduler: scheduleDoseAlarm groupId=794813114 branch=PUSH_CRITICAL_OFF count=1
DosyMessagingService: scheduled groups=1
```

---

## Observações de Refactor / Debt

1. **Console errors não serializados**: `console.error(err)` loga `[object Object]`. Padrão deveria ser `console.error(err?.message || err)` ou usar Sentry captureException.
2. **Swipe gestures não testáveis via CDP JS**: Os componentes de swipe-reveal usam `onPointerDown` React que não responde a `element.click()` ou `mousedown`. Para testes automatizados futuros, considerar adicionar atributos `data-testid` nos botões Tomada/Pular para acesso via CDP sem swipe.
3. **datetime-local locale**: Input type="datetime-local" herda locale do dispositivo — considerar componente customizado ou usar `lang="pt-BR"` no HTML root.
4. **Status "Cancelada"**: Verificar se esse status está sendo renderizado no frontend ou apenas no DB. Se apenas no DB, não é problema visual, mas o relatorio deve mapear "cancelled" → "Cancelada" com estilo visual distinto.
