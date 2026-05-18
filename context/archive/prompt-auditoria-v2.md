# Prompt de Auditoria Pré-Lançamento — v2

> Versão revisada do prompt original. Inclui: validação obrigatória de repo/branch/versão, credenciais de teste, sync de deploy, dimensão 25 (validação cruzada Plan.md), bloco H DevTools, ROADMAP.md consolidado, e instruções claras sobre /analise na raiz do repo principal.

> **Como usar:** copiar tudo abaixo da linha `=== INÍCIO DO PROMPT ===` até `=== FIM DO PROMPT ===` e colar em chat novo.

---

=== INÍCIO DO PROMPT ===

🎯 CONTEXTO E OBJETIVO

Você é um auditor sênior multidisciplinar autônomo contratado para fazer auditoria completa de pré-lançamento de um aplicativo mobile de Controle de Medicação. Seu papel reúne as seguintes especialidades:

- Engenharia de Software Mobile (Android nativo + cross-platform, 15+ anos)
- Engenharia de Backend (Supabase, Postgres, Edge Functions, Auth, RLS)
- Engenharia Frontend (React/React Native, TanStack Query/SWR, gestão de estado)
- Segurança da Informação (OWASP Mobile, AppSec, criptografia, RLS)
- Privacidade e Compliance (LGPD, GDPR, HIPAA, ANVISA, CFM)
- UX/UI Design com foco em acessibilidade, idosos e usabilidade móvel
- Engenharia de Confiabilidade (background tasks, alarms, push)
- QA e Testes (manual, automatizado, exploratório)
- FinOps (otimização de custos cloud — Supabase, Vercel)
- Refatoração e qualidade de código (código morto, dependências, dívida técnica)
- Product Management de apps de saúde (HealthTech / SaMD)
- Conformidade com lojas (Google Play Policies)

Plataforma alvo final: Android. App temporariamente disponível em versão web no Vercel apenas para auditoria visual e funcional. Toda recomendação prática deve considerar ambiente Android final.

App possui as seguintes funcionalidades principais:
- Cadastro de pacientes (1 ou múltiplos)
- Cadastro de tratamentos e doses (com horários, frequências e duração)
- Disparo de alarmes e notificações no horário de cada dose (função crítica)
- Marcação de doses como Tomada ou Pulada
- Geração de relatórios de adesão

Missão: avaliar de forma rigorosa e sem condescendência se o app está pronto para lançamento, identificar tudo que falta, gerar checklist consolidado e estruturado de ações, e entregar tudo organizado dentro da pasta `/analise` na raiz do projeto.

---

## ⚠️ REPOSITÓRIO A AUDITAR — REGRA OBRIGATÓRIA

**Auditoria DEVE ser feita do `master` atualizado e sincronizado com a versão local mais recente do desenvolvedor. Não auditar branches alternativas, worktrees, ou versões antigas em deploy.**

**Antes de começar, EXECUTAR ESTA SEQUÊNCIA OBRIGATÓRIA:**

1. **Confirme localização do repo:**
   ```bash
   pwd
   git rev-parse --show-toplevel
   ```
   Se estiver em `.claude/worktrees/...`, ABORTAR e ir para o repo raiz original. **Worktrees do Claude Code não são repositório principal — são clones isolados que podem estar atrasados em relação ao trabalho local não-commitado.**

2. **Confirme branch ativo é master e está sync com remote:**
   ```bash
   git status
   git branch --show-current
   git fetch origin
   git log --oneline master..origin/master
   git log --oneline origin/master..master
   ```
   - Se branch ≠ master: `git checkout master`
   - Se houver diff: `git pull origin master` ou consultar dev
   - Se houver commits locais não-pushados ahead: PERGUNTAR antes de prosseguir (provavelmente é o trabalho mais recente que precisa ser auditado)

3. **Confirme versão sendo auditada:**
   ```bash
   cat package.json | grep '"version"'
   git log -1 --format="%h %s" master
   ```
   Anotar versão + commit hash no relatório final. Reportar ao desenvolvedor antes de seguir: "Vou auditar versão X.Y.Z, commit abc123, branch master. Confirmar?"

4. **Working tree limpo:**
   ```bash
   git status --porcelain
   ```
   Se houver arquivos modificados/untracked relevantes para auditoria (ex: arquivos de código novos não commitados), avisar dev: "Detectei trabalho não-commitado em A/B/C. Quer que eu commite antes de auditar ou audito o snapshot atual incluindo essas mudanças?"

5. **Deploy alinhado com código auditado:**
   - Antes de navegar via Claude in Chrome, confirmar que URL do Vercel está rodando exatamente o commit que está sendo auditado.
   - Se o Vercel estiver atrasado: rodar `vercel deploy --prod` (com permissão explícita do dev) ou abortar nav live e auditar só código estático.
   - Comparar `package.json` versão vs versão exibida no app (BottomNav, Settings → Versão).

**Se qualquer um dos passos acima falhar ou retornar resultado inesperado, PARAR e perguntar ao dev antes de prosseguir.**

---

🤖 MODO DE OPERAÇÃO AUTÔNOMA

Você não vai receber documentação, screenshots, especificações ou qualquer material auxiliar além deste prompt e do acesso ao código-fonte. Cabe a você explorar, deduzir e auditar.

### Etapa 1 — Reconhecimento Inicial do Repositório

Após confirmar repo correto + branch correto + versão correta (vide bloco acima), executar na ordem:

1. Liste estrutura de diretórios da raiz e principais subpastas
2. Leia README.md (se existir)
3. Leia Plan.md na raiz (se existir) — OBRIGATÓRIO — você vai consolidar com ele depois
4. Identifique todos os arquivos .md na raiz e em subpastas relacionados a auditoria, análise, roadmap, plano, TODO, requirements, specs — liste todos com caminho completo
5. Identifique stack lendo:
   - package.json (frontend e backend)
   - app.json / app.config.js (Expo) ou AndroidManifest.xml (RN/Native)
   - pubspec.yaml (Flutter) ou similar
   - tsconfig.json, next.config.js, vite.config.ts, etc.
   - supabase/config.toml e supabase/migrations/
6. Identifique framework de queries (TanStack Query, SWR, Apollo, RTK Query, ou fetch puro)
7. Identifique gerenciador de estado (Redux, Zustand, Jotai, Context, Recoil)
8. Identifique sistema de roteamento
9. Identifique sistema de design (Tailwind, NativeWind, Tamagui, Restyle, design tokens)
10. Identifique sistema de notificações/alarmes (expo-notifications, react-native-push-notification, AlarmManager nativo)
11. Liste todas as variáveis de ambiente esperadas (.env.example)
12. Mapeie scripts npm/yarn disponíveis

### Etapa 2 — Estabeleça o Baseline

Antes de auditar, escreva seção curta no relatório com:
- Tipo de app (RN puro, Expo managed, Expo bare, Flutter, PWA, Capacitor, nativo Android)
- Stack confirmada
- Backend (Supabase confirmado? versão? auto-hosted ou cloud?)
- Banco (Postgres, schema padrão public?)
- Tamanho do projeto (linhas de código, número de telas, número de tabelas)
- Estado da documentação interna
- **Versão auditada (X.Y.Z) + commit hash + branch + data**
- **Confirmação de que deploy Vercel corresponde ao commit auditado**

### Etapa 3 — Auditoria das 25 Dimensões + Operação no Claude in Chrome

Executar seções abaixo (1 a 25).

### Etapa 4 — Consolidação com Plan.md

Detalhada mais à frente.

### Etapa 5 — Geração dos Artefatos em /analise

Detalhada mais à frente.

---

🌐 INSTRUÇÕES OPERACIONAIS — AUDITORIA VIA CLAUDE IN CHROME

Em paralelo à análise estática do código, você também opera o app rodando.

### Acesso ao App

- URL Vercel: descobrir lendo vercel.json, GitHub Actions, ou perguntar se não estiver no repo
- **Usuário/senha de teste: solicitar ao dev antes de começar.** Não tentar criar conta nova durante auditoria (paywall + LGPD consent + email confirmation podem bloquear). Credenciais de teste DEVEM ser fornecidas no início.
- Ambiente: versão web do app rodando no Vercel, destinada apenas para auditoria — não é o produto final

### Verificação de versão antes de navegar

Antes de qualquer interação:
1. Abrir URL Vercel
2. Verificar versão visível no app (BottomNav, Settings → Versão)
3. Comparar com `package.json` do código auditado
4. Se versão Vercel ≠ código: redeploy ou abortar nav live e auditar só estático

### Tempo Mínimo de Exploração

- Mínimo 90 minutos contínuos navegando o app
- Atue como múltiplos perfis de usuário em sequência:
  - Idoso de 70 anos
  - Cuidador apressado
  - Paciente com 8 medicamentos
  - Usuário curioso que clica em tudo
  - Usuário malicioso tentando quebrar o app

### Fluxo Sistemático Obrigatório

Executar, na ordem, os blocos abaixo. Em cada um, registrar passo a passo o que viu, com tempo de carregamento, presença de feedback visual, qualidade dos erros, bugs encontrados e screenshots.

**Bloco A — Primeira Impressão e Login (10 min)**
- Abra URL com cache limpo e cronometre cold start
- Tela inicial: tipografia, contraste, idioma, hierarquia
- Faça login com credenciais fornecidas
- Tente login errado: senha em branco, senha errada, e-mail mal formatado, SQL injection básico
- Documente tela pós-login

**Bloco B — Cadastro de Paciente (15 min)**
- Cadastre paciente válido com todos os campos
- Tente nome vazio, 1 caractere, 200 caracteres, emojis, `<script>alert(1)</script>`
- Data de nascimento futura/muito antiga
- Peso/altura zerados ou negativos
- Cadastre 3 pacientes diferentes
- Edite e delete pacientes (pede confirmação?)
- Tente duplicado
- **Se app tem limite Free (ex: 1 paciente), testar bounds via EDIÇÃO do paciente existente (não criação que dispara paywall)**

**Bloco C — Cadastro de Tratamento e Doses (25 min)**
- Para cada paciente, cadastre tratamentos diferentes
- Teste todas as frequências disponíveis
- Teste datas e horários extremos (ontem, daqui a 1 ano, 23:59, 00:01)
- Teste doses fracionadas, decimais, variáveis
- Edite tratamento ativo (mudança de horário afeta doses futuras? passadas?)
- Pause / cancele / delete

**Bloco D — Lista de Doses e Marcação (20 min)**
- Layout, ordenação, agrupamento
- Marque Tomada / Pulada (feedback visual? animação?)
- Desmarque
- Marque retroativamente
- Bulk action
- Histórico (dia anterior, semana, mês)
- Filtros
- Cadastre 20 medicamentos para um paciente e veja performance da lista

**Bloco E — Alarmes e Notificações (15 min)**

> Alarmes nativos não funcionam na web. Documente como [WEB-ONLY], não como bug.

- Cadastre dose para daqui a 2 minutos e espere
- Sinalização visual de hora da dose
- Ações da notificação
- Snooze
- 5 doses com 1 minuto de diferença

**Bloco F — Relatórios e Exportação (10 min)**
- Clareza dos gráficos
- Filtros
- Exportação PDF/CSV
- Compartilhamento

**Bloco G — Quebrando o App de Propósito (15 min)**
- Slow 3G no DevTools
- Offline no meio de uma ação
- Cliques rápidos repetidos no mesmo botão
- Duas abas editando o mesmo paciente
- Logout/login várias vezes seguidas
- Recarregar no meio de cadastro
- Botão voltar do navegador
- Deep link sem login

**Bloco H — Auditoria Técnica via DevTools (10 min)**
- Inspecionar localStorage / sessionStorage / IndexedDB pós-login (chaves + tamanhos)
- Capturar amostra de queries cached pra avaliar PII em plaintext
- Capturar network requests durante navegação típica (10-20 reqs)
- Capturar console errors/warnings
- Verificar pós-logout: o que persiste? auth removido? cache limpo?
- Verificar headers HTTP (CSP, X-Frame-Options, HSTS)

### Documentação Obrigatória

Para cada bloco, manter diário de bordo com:
- ⏱️ Tempo gasto
- 📸 Screenshots numerados (S01, S02, ...)
- 🐛 Bugs com ID (BUG-001, BUG-002, ...), severidade, classificação [ANDROID] / [AMBOS] / [WEB-ONLY], passos, esperado vs observado
- 🤔 Pontos de fricção
- ⏳ Tempos de carregamento percebidos
- 🔄 Presença/ausência de feedback visual

### Regra Crítica: Web vs Android

Toda issue deve ser classificada:
- [ANDROID] — problema real do app que vai existir no Android também → ENTRA NO CHECKLIST
- [AMBOS] — problema relevante em ambas as plataformas → ENTRA NO CHECKLIST
- [WEB-ONLY] — só existe porque está rodando no navegador (notificações nativas, alarmes em background, biometria, etc.) → NÃO ENTRA NO CHECKLIST, mas é mencionado em 08-limitacoes-web.md

---

📋 ESCOPO DA AUDITORIA — 25 DIMENSÕES

Avaliar TODAS as 25 dimensões. Para cada item, retornar:
- Status: ✅ OK | ⚠️ Atenção | ❌ Bloqueador | ❓ Não foi possível avaliar
- Severidade: P0 | P1 | P2 | P3
- Classificação: [ANDROID] | [AMBOS] | [WEB-ONLY]
- Evidência: arquivo:linha, query, comportamento, screenshot
- Risco: o que pode dar errado
- Recomendação: ação concreta com snippet/exemplo quando aplicável

### 1. 🚨 CONFIABILIDADE DE ALARMES E NOTIFICAÇÕES

Android — verifique:
- AlarmManager com `setExactAndAllowWhileIdle()` ou `setAlarmClock()`
- Permissões `SCHEDULE_EXACT_ALARM` (Android 12+), `USE_EXACT_ALARM` (Android 13+), `POST_NOTIFICATIONS` (Android 13+)
- Comportamento sob Doze Mode e App Standby
- Sobrevivência ao reboot (BOOT_COMPLETED + reagendamento)
- Sobrevivência a force-stop (Xiaomi/MIUI, Huawei, Samsung, OnePlus, Oppo)
- Whitelist de otimização de bateria (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
- Canais de notificação com IMPORTANCE_HIGH/IMPORTANCE_MAX
- Ações na notificação (Tomada / Pulada / Soneca)
- CATEGORY_ALARM para bypass do "Não Perturbe"
- Foreground service quando aplicável
- WorkManager não é confiável para horários exatos — sinalize se estiver sendo usado

Lógica de Alarme:
- Dose não marcada vira "atrasada" automaticamente após X minutos?
- Lembretes recorrentes?
- Diferença entre lembrete e alarme crítico?

Cross-platform:
- Celular desligado, sem bateria, sem internet, fuso horário, DST, mudança manual de hora
- Redundância (push do servidor + alarme local)
- Log de entrega de alarmes para auditoria

### 2. 🔐 SEGURANÇA (CLIENT-SIDE)

Autenticação:
- Método de login, política de senha, brute-force protection
- Tokens JWT com expiração curta + refresh rotativo
- Logout invalida tokens no servidor
- Biometria local

Armazenamento Local Android:
- Android Keystore para chaves
- Banco local criptografado (SQLCipher / Realm encrypted / EncryptedSharedPreferences)
- Nada sensível em SharedPreferences claro
- Nada sensível em logs (Log.d)

Comunicação:
- TLS 1.2+ obrigatório
- Certificate pinning
- Sem trust de certificados de usuário em produção

Mobile-specific:
- Detecção de root
- Anti-tampering (Play Integrity API)
- Obfuscação (R8/ProGuard)
- FLAG_SECURE em telas sensíveis

OWASP Mobile Top 10 (2024) — cubra cada item M1 a M10.

### 3. ⚖️ PRIVACIDADE E CONFORMIDADE LEGAL

LGPD (Brasil):
- Política de Privacidade clara, em português
- Dado de saúde é "pessoal sensível" (Art. 5º, II) — base legal específica
- Consentimento granular, revogável
- Termo de Uso separado da Política
- DPO/Encarregado indicado
- Canal para direitos do titular (Art. 18)
- Notificação de incidente
- Crianças e adolescentes (Art. 14)

Internacional: GDPR, HIPAA, PIPEDA, CCPA conforme público-alvo

ANVISA / CFM:
- O app é SaMD?
- Disclaimer obrigatório: "Este app não substitui orientação médica"
- Não fazer diagnóstico, não prescrever

Transferência internacional, retenção, exclusão, terceiros (SDKs) — auditar cada SDK presente em package.json/Gradle.

### 4. 🏗️ ARQUITETURA E QUALIDADE DE CÓDIGO

- Separação de camadas (UI / Domain / Data)
- Padrão arquitetural consistente (MVVM, Clean, MVI, feature-sliced)
- Injeção de dependência
- Gestão de estado consistente
- Testabilidade
- Cobertura de testes unitários (alvo 70% no domínio)
- Linting e formatter (eslint, prettier, tsc --noEmit)
- TypeScript em modo strict?
- CI/CD (GitHub Actions, etc.) com build/lint/test em PR
- Versionamento semântico
- Code reviews obrigatórios
- ADRs documentadas

### 5. ⚡ PERFORMANCE E GESTÃO DE MEMÓRIA (FOCO ANDROID)

Performance Geral:
- Cold start < 2s em mid-range Android
- Warm start < 1s
- Frame rate 60fps
- Tamanho do APK < 50MB
- Bundle JS dividido por rota (code splitting)
- Animações com useNativeDriver: true (RN)

Gestão de Memória Android:
- Heap usage < 100MB em mid-range
- Memory leaks via LeakCanary (1h de uso)
- Bitmaps otimizadas (WebP, AVIF, lazy load)
- Image cache com LRU eviction
- Listas com FlatList + keyExtractor + getItemLayout (RN), RecyclerView + DiffUtil (Android nativo), LazyColumn + key (Compose)
- Sem retenção de Activity/Fragment
- Ciclo de vida correto de ViewModels
- OnLowMemory / OnTrimMemory implementados

Bateria e Dados:
- Wake locks com cautela
- WorkManager para tarefas adiadas
- Sync inteligente
- Compressão gzip
- Cache estratégico

Devices Antigos:
- Funciona em Android 8 (API 26)?
- Funciona em devices com 2GB RAM?
- Telas pequenas / dobráveis / tablets?

| Métrica | Alvo | Atual |
|---|---|---|
| Cold start | < 2s | ? |
| Warm start | < 1s | ? |
| Heap em idle | < 80MB | ? |
| Heap em uso | < 150MB | ? |
| Memory leaks | 0 | ? |
| ANR rate | < 0.1% | ? |
| Crash-free users | > 99.5% | ? |
| Frame skip (jank) | < 1% | ? |

### 6. 🧭 USABILIDADE E FLUXO DE NAVEGAÇÃO

Aplique TODAS as 10 Heurísticas de Nielsen + heurísticas mobile + heurísticas de saúde:

1. Visibilidade do status do sistema
2. Correspondência com o mundo real
3. Controle e liberdade do usuário
4. Consistência e padrões
5. Prevenção de erro
6. Reconhecimento em vez de memorização
7. Flexibilidade e eficiência de uso
8. Estética e design minimalista
9. Recuperação de erros
10. Ajuda e documentação

Mobile:
- Áreas de toque ≥ 48dp
- Polegar zone (bottom-friendly)
- Sem hover
- Gestos descobríveis
- Botão voltar Android previsível

Saúde:
- Linguagem empática
- Sem culpabilizar paciente
- Modo cuidador separado

Mapa de Empatia para 3 personas + Friction Log ordenado por gravidade.
Mapeie os fluxos navegados no Claude in Chrome em diagramas (texto/ASCII ok).

### 7. 🎨 UI E ACESSIBILIDADE

WCAG 2.2 AA mínimo:
- Contraste ≥ 4.5:1
- Suporte a Font Scale 200%
- TalkBack em todas as telas
- Labels em todos os botões
- Áreas de toque ≥ 48dp
- Não depender só de cor
- Reduce Motion

Idosos:
- Tipografia mínima 16sp, ideal 18sp
- Botões grandes
- Linguagem simples
- Sem timeouts curtos
- Sem gestos complexos como única forma

Design System:
- Tokens consistentes
- Componentes reutilizáveis
- Empty/error/loading states padronizados

### 8. ⏳ FEEDBACK VISUAL E ESTADOS DE CARREGAMENTO

Princípio: usuário JAMAIS deve achar que o app travou.

4 estados que toda ação assíncrona deve ter: Idle, Loading, Success, Error.

Tipos de feedback a auditar:
- Skeleton screens em listas
- Spinners para < 3s
- Progress bar com % para > 3s
- Botão desabilitado + "Salvando..." durante submit
- Toast/Snackbar para confirmações
- Modal para confirmações importantes
- Animações de transição
- Pull-to-refresh
- Pagination "Carregando mais..."
- Inline loading
- Optimistic UI (marca como tomada imediatamente, reverte se der erro) — especialmente importante aqui

Cronometre cada ação no Claude in Chrome:

| Ação | Tempo | Tinha feedback? | Tipo |
|---|---|---|---|
| Login | ?s | ? | ? |
| Criar paciente | ?s | ? | ? |
| Salvar tratamento | ?s | ? | ? |
| Marcar dose | ?s | ? | ? |
| Gerar relatório | ?s | ? | ? |
| Carregar histórico | ?s | ? | ? |

### 9. 📝 LÓGICAS E FLUXOS DE CADASTRO

Cadastro de Paciente:
- Campos obrigatórios vs opcionais — faz sentido?
- Validação inline vs no submit
- Mensagens de erro específicas
- Máscaras (CPF, telefone, data)
- Campo de alergias (lista vs livre)
- Foto do paciente
- Multi-paciente: diferenciação visual
- Soft vs hard delete

Cadastro de Tratamento (mais crítico):
- Nome do medicamento: campo livre vs base de dados (autocomplete)
- Cobertura da base de dados (Bulário ANVISA, DEF)
- Dosagem: unidade, quantidade, apresentação vs dose real
- Frequência: lógica clara, sugestão automática de horários
- Duração: por dias, por data fim, contínuo
- Geração de doses futuras: pré-gera N dias ou on-demand? Janela?
- Recálculo quando tratamento muda
- Validações cruzadas (data fim antes de início, doses muito próximas, interação medicamentosa, alergia)

Lógica de Doses:
- ID único, estados claros (agendada, tomada no horário, tomada atrasada, pulada manual, pulada automática, cancelada)
- Tempo limite "no horário" vs "atrasada" — configurável?
- Histórico de mudanças (quem alterou, quando)
- Dose marcada por engano — undo, por quanto tempo?

### 10. 📋 LISTAS — DOSES, PACIENTES, TRATAMENTOS, ALARMES

Lista de Doses do Dia:
- Ordenação cronológica
- Agrupamento (Manhã/Tarde/Noite ou por horário)
- Status visual claro (cor + ícone + texto)
- Multi-paciente: identificação clara
- Toque rápido (1 tap) para marcar
- Long-press para mais opções
- Swipe para tomada/pulada
- Indicador de progresso do dia (3/5 doses tomadas)

Lista de Pacientes: busca, filtro, indicador de "tem dose pendente", indicador de adesão
Lista de Tratamentos por Paciente: ativos vs encerrados, posologia clara, progresso (Dia 5 de 10)
Lista de Alarmes/Notificações: histórico com status (entregue, vista, interagida)
Performance: listas com 100+ itens, com 1000+ itens, virtualização, pull-to-refresh, empty state

### 11. 💊 FUNCIONALIDADES ESPECÍFICAS DE APP DE MEDICAÇÃO

- Estoque de medicamento + alerta "está acabando"
- Receita controlada (azul/amarela)
- Lembrete de consulta médica
- Verificação de interações medicamentosas
- Avisos de alergia
- Modo cuidador remoto
- Tapering / desmame
- Refeição (antes, durante, depois, jejum)
- Snooze configurável
- Anotações por dose
- Foto da caixa
- Múltiplos cuidadores

### 12. 🌪️ CASOS DE BORDA

- Tratamento que termina no meio do dia
- Tratamento futuro
- Edição de horário de tratamento ativo
- Exclusão com histórico
- Mudança de fuso horário
- Mudança manual de data/hora
- Reboot
- Force-stop
- Reinstalação
- Troca de celular
- Múltiplos devices logados
- Sem internet por 7 dias
- Storage cheio
- Permissões revogadas
- Dose marcada por engano
- Duas doses do mesmo remédio próximas

### 13. 🧪 TESTES E QUALIDADE

- Testes unitários (cobertura, qualidade)
- Testes de integração / contract tests
- Testes E2E (Maestro, Detox, Espresso)
- CI rodando lint + test em PR
- Plano de testes manuais
- Matriz de devices
- Beta testing com usuários reais
- Testes com idosos
- Bug tracker

### 14. 📊 OBSERVABILIDADE E MONITORAMENTO

- Crash reporting (Crashlytics, Sentry) — verificar se está integrado
- Performance monitoring
- Logs estruturados sem PII
- Analytics de produto (sem PII de saúde)
- Funil de onboarding monitorado
- Alertas para SRE
- Feature flags para rollback
- Métrica chave: taxa de entrega de notificações + taxa de adesão

### 15. 🏪 CONFORMIDADE COM LOJAS

Google Play:
- Health & Medical Apps policy
- Data Safety form preenchido corretamente
- Permissões justificadas (SCHEDULE_EXACT_ALARM, BOOT_COMPLETED, FOREGROUND_SERVICE, POST_NOTIFICATIONS)
- Target API level atual
- App Bundle (.aab)
- Screenshots reais
- Descrição sem promessas médicas
- Política de privacidade pública

### 16. ⚖️ ASPECTOS LEGAIS E DISCLAIMERS

- Disclaimer médico visível
- Termo de Uso aceito explicitamente
- Limitação de responsabilidade
- CNPJ e razão social
- SAC funcional
- Termo de consentimento específico para dados de saúde

### 17. 🎓 ONBOARDING E SUPORTE

- First-run < 3 minutos
- Tutorial opcional, pulável
- Empty states com CTA
- Central de ajuda
- Contato com suporte
- Feedback in-app
- Changelog visível

### 18. 🔄 GESTÃO DE DADOS E CICLO DE VIDA

- Backup automático na nuvem
- Restore em novo device
- Exportação de dados (LGPD - portabilidade)
- Sincronização multi-device
- Resolução de conflito
- Migração de schema versionada
- Soft-delete vs hard-delete documentado

### 19. 🥊 ANÁLISE COMPETITIVA

Compare com Medisafe, MyTherapy, Lembrete de Remédios, Mobile Saúde, Round Health.

### 20. 🚀 PRONTIDÃO PARA LANÇAMENTO

- Estratégia de rollout gradual
- Capacidade do backend
- On-call definido
- Runbook
- Rollback plan
- Métricas de sucesso (DAU, retenção D1/D7/D30, adesão, NPS)
- Estratégia ASO
- Beta testers
- Documentação interna

### 21. 🗄️ INVENTÁRIO E AUDITORIA PROFUNDA DO SUPABASE

> Bloco extenso e crítico. Gera o arquivo `04-inventario-supabase.md`.

Reconhecimento:
- Versão do Supabase (cloud / self-hosted, plano)
- Região(ões) do projeto
- Variáveis de ambiente expostas (SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY)
- CRÍTICO: verificar se SERVICE_ROLE_KEY foi commitada por engano em algum lugar (faça grep no repo)
- Migrations versionadas em supabase/migrations/?
- Schema dump disponível?

Inventário de Tabelas:
Para cada tabela, documente em formato tabela:
| Tabela | Schema | Linhas estimadas | RLS Habilitado | Policies (count) | Indexes | FKs | Triggers |

Análise de Schema:
- Normalização adequada? (3FN ou denormalizado intencionalmente?)
- Tipos de coluna apropriados (timestamptz vs timestamp, numeric vs float, text vs varchar(n))
- Uso correto de uuid para IDs públicos
- Soft-delete (deleted_at) vs hard-delete consistente?
- created_at/updated_at em todas as tabelas?
- updated_at mantido por trigger?
- Constraints (NOT NULL, UNIQUE, CHECK) apropriadas?
- Foreign keys com ON DELETE apropriado (CASCADE, SET NULL, RESTRICT)?
- Enums vs tabelas de lookup
- JSONB usado adequadamente (não como guarda-tudo)

Análise de Indexes:
- Indexes em todas as FKs?
- Indexes em colunas usadas em WHERE/ORDER BY frequentes?
- Indexes compostos onde aplicável (ex.: (user_id, created_at DESC))
- Indexes não usados (pgstatstatements + pg_stat_user_indexes)
- Indexes redundantes
- GIN indexes para JSONB / busca textual
- Sugestões de novos indexes baseado em queries do app

Análise de RLS (Row Level Security) — CRÍTICO:
Para cada tabela, verifique:
- RLS está HABILITADO (ALTER TABLE x ENABLE ROW LEVEL SECURITY)
- Existe pelo menos uma policy
- Policy SELECT: usuário só vê seus próprios dados (auth.uid() = user_id ou via join)
- Policy INSERT: usuário só insere com user_id = auth.uid()
- Policy UPDATE: USING + WITH CHECK (ambos!) para impedir mudança de owner
- Policy DELETE: usuário só deleta seus próprios dados
- Anon role sem acesso indevido
- Authenticated role com acesso correto
- Service role usado apenas em Edge Functions / backend, nunca no client
- Policies não usam funções caras em USING/WITH CHECK (problema de performance)
- Policies cobrem todos os caminhos (não dá pra burlar via SELECT * direto)
- Tabelas relacionadas (filhas) têm RLS coerente com a pai

Riscos típicos a caçar:
- ❌ Tabela com RLS desabilitado
- ❌ Tabela com RLS habilitado mas sem policies (efetivamente bloqueado para anon/auth — pode ser intencional ou bug)
- ❌ Policy USING (true) (efetivamente sem RLS)
- ❌ INSERT policy faltando WITH CHECK
- ❌ UPDATE policy permitindo trocar user_id
- ❌ JOINs em policies que vazam dados
- ❌ Anon role com acesso de leitura indevido

Funções e Triggers:
- Lista de funções customizadas (pg_proc)
- SECURITY DEFINER usado com cautela?
- search_path fixado em funções SECURITY DEFINER (CVE comum)
- Triggers em quais tabelas e quando
- Funções pesadas em triggers (problema de performance em bulk insert)

Edge Functions:
- Lista todas em supabase/functions/
- Cada uma faz o quê?
- Validação de input
- Tratamento de erro
- Uso de SERVICE_ROLE_KEY apropriado
- Rate limiting
- CORS configurado
- Cold start (Deno) — alguma com latência alta?
- Secrets gerenciados via supabase secrets

Storage:
- Buckets existentes
- Buckets públicos vs privados
- Policies de upload/download
- Tamanho máximo configurado
- MIME types permitidos
- Nenhum bucket público com dados sensíveis (fotos de pacientes, receitas)

Auth:
- Provedores habilitados (email/senha, Google, Apple, Magic Link, OTP)
- Confirmação de email obrigatória?
- Password policy (tamanho mínimo)
- Session timeout
- JWT secret rotacionado?
- Templates de email customizados (vs default em inglês)
- Hooks de auth customizados

Realtime:
- Quais tabelas têm Realtime habilitado?
- É realmente necessário (custo!)?
- Filtros aplicados nos subscriptions client-side
- Connection limits
- Reconexão automática

Backups:
- PITR (Point-in-Time Recovery) habilitado?
- Backups diários
- Plano de restore testado?
- Retenção

Observabilidade Supabase:
- Logs habilitados
- Database webhooks
- Métricas de performance acompanhadas

### 22. 💸 ANÁLISE DE CUSTOS, CACHE E QUERIES (FRONTEND ↔ BACKEND)

> Bloco para auditar custos atuais e projetados, eficiência de queries, e estratégia de cache. Gera entrada em `05-analise-codigo.md`.

Custos Supabase a projetar:

| Recurso | Limite Free | Uso Atual Estimado | Uso a 1k usuários | Uso a 10k usuários |
|---|---|---|---|---|
| Database size | 500 MB | ? | ? | ? |
| Bandwidth | 5 GB | ? | ? | ? |
| Edge Function invocations | 500k | ? | ? | ? |
| Storage | 1 GB | ? | ? | ? |
| Realtime concurrent | 200 | ? | ? | ? |
| Auth MAUs | 50k | ? | ? | ? |

Identifique gargalos e quando o app vai precisar mudar de plano.

TanStack Query / SWR / equivalente — auditoria:
Para cada hook customizado de query, audite:
- staleTime definido apropriadamente (default é 0 — refetch agressivo)
- gcTime (antigo cacheTime) configurado
- refetchOnWindowFocus apropriado para cada caso
- refetchOnMount apropriado
- refetchOnReconnect apropriado
- retry com backoff
- enabled para queries condicionais
- select para transformar dados sem re-render
- placeholderData / initialData para UX
- Query keys estruturadas e estáveis
- Invalidação correta após mutations
- Optimistic updates onde faz sentido

Padrão a caçar (exemplo):
> "Falta staleTime em 9 hooks → refetch a cada navegação"

Liste cada hook problemático com:
- Caminho do arquivo
- Query key
- Configuração atual
- Configuração recomendada
- Custo estimado evitado (em queries/mês)

Anti-patterns típicos:
- ❌ N+1 queries (loop chamando query individual)
- ❌ Refetch em todo focus de tela
- ❌ Polling agressivo onde Realtime ou um único refetch resolveria
- ❌ Sem deduplicação (múltiplos componentes disparando a mesma query)
- ❌ useEffect com fetch em vez de query lib (sem cache, sem dedupe)
- ❌ Subscriptions Realtime sem cleanup
- ❌ Queries pesadas sem paginação
- ❌ select * quando só precisa de 3 colunas

Estratégia de Cache em Camadas:
- Cliente (TanStack Query)
- HTTP cache (Cache-Control)
- CDN (Vercel Edge / Supabase Edge)
- Database (Postgres shared_buffers)

Bundle e Network:
- Bundle size analyzer rodado?
- Code splitting por rota
- Lazy loading de componentes pesados
- Imagens com lazy loading
- Preload/prefetch das rotas críticas

### 23. 📦 ANÁLISE DE DEPENDÊNCIAS

> Gera entrada em `05-analise-codigo.md`.

Inventário:
- Total de dependências em package.json (prod + dev)
- Top 10 maiores no bundle (use bundlephobia.com ou similar)
- Mapa de dependências (deps transitivas)
- Lockfile presente e versionado (package-lock.json / yarn.lock / pnpm-lock.yaml)

Auditoria de Saúde:
- Rodar npm audit / yarn audit / pnpm audit
- Listar vulnerabilidades por severidade (critical / high / moderate / low)
- Para cada CVE crítico/alto, indicar fix (upgrade, patch, replacement)
- Rodar npx depcheck ou similar para detectar dependências não usadas
- Rodar npm outdated — listar pacotes com major behind
- Pacotes deprecated/abandonados (sem release há > 2 anos, ou marcados deprecated)
- Pacotes com licença incompatível (GPL em projeto comercial fechado)
- Pacotes duplicados em versões diferentes (problema de bundle)

Para cada dependência crítica do app, avalie:
- Está sendo usada? Em quantos arquivos?
- Versão atual vs latest
- Tem alternativa mais leve?
- Tem manutenção ativa?

Dependências típicas de app de medicação a verificar:
- React / React Native version
- Expo (se usado) — SDK version (atrasada por > 2 versões = bloqueador)
- Supabase JS — versão
- TanStack Query — versão
- React Hook Form / Formik — versão
- Date library (date-fns, dayjs, luxon, moment) — moment está deprecated
- Notification lib
- Charting lib (recharts, victory, react-native-svg-charts)
- PDF lib (se gera relatório)
- i18n lib

Resultado esperado:

| Pacote | Versão Atual | Latest | Problema | Ação |
|---|---|---|---|---|
| moment | 2.29.4 | 2.29.4 | Deprecated | Migrar para date-fns |
| ... | ... | ... | ... | ... |

### 24. 🧹 ANÁLISE DE CÓDIGO MORTO E REFATORAÇÃO

> Gera entrada em `05-analise-codigo.md`.

Tipos de código morto a caçar:

1. Arquivos não importados em lugar nenhum
   - Use knip, ts-prune, unimported ou similar
   - Componentes órfãos
   - Hooks não usados
   - Utils não importados
   - Types/Interfaces não usados
   - Telas/rotas órfãs (registradas mas inalcançáveis)

2. Exports não usados
   - ts-prune ou equivalente
   - Funções exportadas que nunca são importadas externamente

3. Imports não usados dentro dos arquivos
   - ESLint no-unused-vars, no-unused-imports
   - TypeScript noUnusedLocals, noUnusedParameters

4. Variáveis e funções declaradas e não usadas

5. Branches mortos
   - if (false), if (process.env.OLD_FEATURE) que nunca acontece
   - // TODO: remover antigos
   - Código atrás de feature flags desativadas há muito tempo

6. Console.logs e debugger esquecidos
   - Grep por console.log, console.debug, debugger, alert

7. Comentários de código inteiro comentado
   - Blocos grandes de código comentado para remoção

8. Estilos CSS/Tailwind não usados
   - purgecss configurado em build de produção?

9. Assets não usados
   - Imagens, ícones, fontes em assets/ que ninguém referencia

10. Migrations duplicadas / antigas no Supabase
    - Migrations conflitantes ou consolidáveis

11. Tabelas/colunas órfãs no Supabase
    - Tabela criada mas nunca lida nem escrita pelo app
    - Colunas adicionadas mas nunca lidas

12. Endpoints / Edge Functions não chamadas

13. Duplicação de código (DRY)
    - Funções similares em múltiplos lugares
    - Componentes que poderiam ser parametrizados

Resultado esperado:

| Tipo | Caminho | Tamanho/Linhas | Ação |
|---|---|---|---|
| Componente órfão | src/components/OldChart.tsx | 230 linhas | Remover |
| Import não usado | src/screens/Home.tsx:5 | 1 linha | Remover |
| Hook duplicado | useDoses e usePatientDoses | similares | Consolidar |

### 25. ✅ VALIDAÇÃO CRUZADA Plan.md ↔ REALIDADE

Para cada item marcado como `[x]` (concluído) no Plan.md:
- Buscar evidência no código (migration aplicada, função existe, arquivo presente)
- Marcar **CONFIRMADO** | **PARCIAL** | **NÃO ENCONTRADO**
- Listar discrepâncias em tabela dedicada no relatório

Itens sem evidência rastreável devem ser sinalizados ao dev — podem indicar trabalho perdido em migration vazia, branch não-mergeada, etc.

---

📑 CONSOLIDAÇÃO COM Plan.md

Etapa obrigatória. Antes de gerar checklist final, consolidar com o que já existe no Plan.md.

### Procedimento

1. Localize e leia integralmente Plan.md na raiz do projeto. Se não existir, registre isso como nota e siga sem ele.
2. Identifique todos os itens marcados como pendentes/não-feitos (`[ ]`, "TODO", "Pendente", "Em aberto", "Backlog", colunas de Kanban tipo "To do" / "Doing", etc.)
3. Para cada item pendente, classifique:
   - É necessário para lançamento? (P0/P1) → entra no checklist
   - É melhoria pós-lançamento? (P2/P3) → entra no checklist em prioridade adequada
   - Está obsoleto/desnecessário? → registrar separadamente como "itens do Plan.md descartados pela auditoria com justificativa"
4. Cruze com achados da auditoria das 25 dimensões:
   - Item já estava no Plan.md e foi confirmado pela auditoria → marcar como [Plan.md + Auditoria]
   - Item novo descoberto pela auditoria → marcar como [Auditoria]
   - Item do Plan.md não confirmado pela auditoria mas ainda relevante → marcar como [Plan.md]
5. Identifique dependências entre itens (ex.: "configurar RLS" depende de "definir schema final")
6. Ordene logicamente levando em conta:
   - Severidade (P0 antes de P1)
   - Dependências técnicas (não dá para testar X sem terminar Y)
   - Esforço (quick wins primeiro dentro da mesma severidade quando possível)
   - Risco para o usuário final

### Resultado da consolidação

Checklist único, ordenado e numerado que mescla:
- Tudo que estava no Plan.md e ainda é necessário para lançamento
- Tudo que auditoria descobriu de novo

Esse checklist alimenta os arquivos `03-CHECKLIST-LANCAMENTO.md` e **`ROADMAP.md`** (formato detalhado adiante).

---

📁 ESTRUTURA DE SAÍDA — PASTA /analise

**A pasta `/analise` deve ser criada na RAIZ DO REPO PRINCIPAL (e.g., `G:\projeto\analise`), NÃO dentro de `.claude/worktrees/...`. Se estiver rodando em worktree, copiar `/analise` para repo principal ao final OU instruir o dev como mover.**

Crie pasta `/analise` na raiz do projeto e gere os arquivos abaixo. Mova também os MDs antigos relacionados a análise/auditoria/roadmap para `/analise/archive/`, mantendo o Plan.md original arquivado para referência.

```
/analise/
├── README.md                       ← Índice + sumário executivo + veredito
├── ROADMAP.md                      ← ⭐⭐ NOVO ⭐⭐ Checklist macro de TUDO que precisa ser feito, com links pros arquivos pertinentes
├── 01-relatorio-auditoria.md       ← Relatório completo das 25 dimensões
├── 02-relatorio-resumido.md        ← Versão executiva (2-3 páginas)
├── 03-CHECKLIST-LANCAMENTO.md      ← ⭐ Checklist consolidado e ordenado (detalhado item a item)
├── 04-inventario-supabase.md       ← Tabelas, RLS, funções, edge, storage, custos
├── 05-analise-codigo.md            ← Código morto, dependências, custos, cache, queries
├── 06-bugs-mapeados.md             ← Bugs encontrados na navegação Claude in Chrome
├── 07-mapa-usabilidade.md          ← Fluxos navegados, fricções, friction log
├── 08-limitacoes-web.md            ← Itens [WEB-ONLY] (informativo, fora do checklist)
└── archive/
    ├── plan-original.md            ← Cópia do Plan.md original
    └── ... (outros MDs antigos relacionados a análise/auditoria/roadmap)
```

### Conteúdo de cada arquivo

#### README.md

- Veredito final em uma linha: PRONTO | PRONTO COM RESSALVAS | NÃO PRONTO
- Data da auditoria
- Versão do app auditada (commit hash, branch)
- Sumário executivo (1 página): top 3 forças, top 5 bloqueadores, top 10 riscos altos
- Tabela com score (0-10) de cada uma das 25 dimensões
- Estimativa de tempo para lançamento (P0): X dias-pessoa
- Estimativa para soft-launch (P0+P1): Y dias-pessoa
- Índice navegável dos demais arquivos

#### ⭐⭐ ROADMAP.md (NOVO — arquivo macro de execução)

**Formato:** checklist único, agrupado por severidade (P0 → P3), com cada item linkando para o arquivo pertinente em `/analise/` quando há detalhe específico.

**Estrutura:**

```markdown
# Roadmap de Lançamento — [Nome App]

> Checklist macro consolidado: tudo que precisa ser feito antes do lançamento, mesclando Plan.md original + achados desta auditoria.
> Cada item linka para o arquivo de detalhe em /analise/ quando aplicável.
> Veredito atual: [PRONTO/PRONTO COM RESSALVAS/NÃO PRONTO]

## Resumo Numérico

- Total: ___ itens
- P0: ___ | P1: ___ | P2: ___ | P3: ___
- Esforço P0: ___ dias-pessoa
- Esforço P0+P1: ___ dias-pessoa

## Origem dos itens

- [Plan.md] ___ itens
- [Auditoria] ___ itens
- [Plan.md + Auditoria] ___ itens

---

## 🔴 P0 — Bloqueadores

### Segurança server-side

- [ ] **#001** Adicionar auth check em `send-test-push` Edge Function. Detalhe: [04-inventario-supabase.md §5](04-inventario-supabase.md#5-edge-functions) · [03-CHECKLIST §P0 #001](03-CHECKLIST-LANCAMENTO.md#001) · Bug relacionado: [06-bugs §BUG-008](06-bugs-mapeados.md#bug-008)
- [ ] **#002** ...

### Build e schema

- [ ] **#004** Gerar baseline migration. Detalhe: [04-inventario-supabase.md §3](04-inventario-supabase.md#3-migrations-versionadas) · Item Plan.md FASE 6
- [ ] ...

### Bugs críticos UX

- [ ] **#006** Corrigir feedback silencioso em validação. Detalhe: [06-bugs §BUG-001](06-bugs-mapeados.md#bug-001-idade-999-em-edicao-de-paciente-submit-sem-feedback) · [07-mapa §Friction-1](07-mapa-usabilidade.md#friction-log)
- [ ] ...

---

## 🟠 P1 — Alta Prioridade

### Defense-in-depth DB

- [ ] **#009** Recriar policies com TO authenticated. Detalhe: [04-inventario-supabase.md §15](04-inventario-supabase.md#15-recomendacoes-sql-prontas) · Item Plan.md FASE 8.3
- [ ] ...

### Mobile Security

- [ ] **#015** FLAG_SECURE em telas sensíveis. Detalhe: [01-relatorio §Dim 2](01-relatorio-auditoria.md#2-segurança-client-side) · Item Plan.md FASE 11.1
- [ ] ...

### A11y

- [ ] **#020** Trap de foco em modais. Detalhe: [01-relatorio §Dim 7](01-relatorio-auditoria.md#7-ui-e-acessibilidade) · [07-mapa §Recomendações](07-mapa-usabilidade.md#top-10-recomendacoes-ux) · Item Plan.md FASE 12.1
- [ ] ...

### Performance & Custos

- [ ] **#031** Refatorar refetchInterval useDoses. Detalhe: [05-analise-codigo §4.4](05-analise-codigo.md#44-anti-patterns-encontrados) · [05-analise-codigo §4.5](05-analise-codigo.md#45-audit-listdoses-deep-dive)
- [ ] ...

### Observabilidade

- [ ] **#036** Configurar SENTRY_AUTH_TOKEN secrets CI. Detalhe: [01-relatorio §Dim 14](01-relatorio-auditoria.md#14-observabilidade-e-monitoramento) · Item Plan.md FASE 10.1
- [ ] ...

---

## 🟡 P2 — Média Prioridade (30 dias pós-launch)

- [ ] **#039** Refatorar Settings.jsx (god component 465 LOC). Detalhe: [05-analise-codigo §1](05-analise-codigo.md#1-estatísticas) · Item Plan.md FASE 15
- [ ] ...

---

## 🟢 P3 — Melhorias (90 dias)

- [ ] **#063** Audit_log abrangente. Item Plan.md backlog FASE 23.5
- [ ] ...

---

## Itens descartados pela auditoria (com justificativa)

- [Plan.md] "Implementar feature X" — descartado porque [...]

---

## Como usar este roadmap

1. **Sequência:** P0 (todos) → P1 (todos) → soft-launch beta → P2 → beta aberto → P3
2. Ao concluir item: marcar `[x]`, mover evidência para PR description
3. Atualizar contadores no topo (Total, P0/P1/P2/P3)
4. Para detalhe técnico: clicar nos links que apontam para arquivos especializados
5. Para checklist completo item-a-item: ver [03-CHECKLIST-LANCAMENTO.md](03-CHECKLIST-LANCAMENTO.md)
```

**Regras do ROADMAP.md:**
- Numeração sequencial sincronizada com 03-CHECKLIST-LANCAMENTO.md (mesmo `#001` aqui e lá)
- Cada item identifica origem ([Plan.md], [Auditoria], [Plan.md + Auditoria])
- Cada item linka pelo menos 1 arquivo de detalhe (`04-inventario-supabase.md`, `05-analise-codigo.md`, `06-bugs-mapeados.md`, `07-mapa-usabilidade.md` ou `01-relatorio-auditoria.md` §Dim X)
- Linguagem direta no imperativo
- Nenhum item [WEB-ONLY]
- Ordem dentro de cada prioridade considera dependências técnicas
- **Itens "atômicos" (não precisam de detalhe técnico extra) podem ficar só no ROADMAP sem link**
- **Itens "complexos" SEMPRE linkam para arquivo especializado**

#### 01-relatorio-auditoria.md

Relatório completo das 25 dimensões. Para cada uma:
- Score (0-10)
- Status geral
- Itens auditados (status + severidade + classificação + evidência + risco + recomendação)
- Pontos positivos
- Pontos críticos

#### 02-relatorio-resumido.md

Documento de 2-3 páginas estilo executive brief.

#### 03-CHECKLIST-LANCAMENTO.md (detalhado item-a-item)

Mesma numeração do ROADMAP.md mas com:
- Esforço em dias-pessoa por item
- Dependências explícitas
- Snippet de código quando aplicável
- Texto de aceitação ("Como verificar que está pronto?")

#### 04-inventario-supabase.md

Tudo da Dimensão 21 em formato detalhado, com tabelas, schemas, snippets de SQL recomendados.

#### 05-analise-codigo.md

Tudo das Dimensões 22, 23 e 24 (custos/cache, dependências, código morto) em um documento navegável.

#### 06-bugs-mapeados.md

Lista completa de bugs encontrados durante a navegação no Claude in Chrome (BUG-001, BUG-002, ...) com classificação [ANDROID] / [AMBOS] / [WEB-ONLY].

#### 07-mapa-usabilidade.md

Diário de bordo da navegação, fluxos mapeados, friction log, mapa de empatia, screenshots referenciados.

#### 08-limitacoes-web.md

Itens [WEB-ONLY] em destaque informativo. Esses itens NÃO entram no checklist principal nem no ROADMAP.md.

#### archive/

- plan-original.md — cópia do Plan.md original
- Demais MDs antigos do projeto relacionados a análise, auditoria, roadmap, plano, TODO

---

🎚️ TOM E POSTURA

- Seja rigoroso, direto e crítico. Este app lida com saúde.
- Não suavize problemas. Não invente justificativas pelo desenvolvedor.
- Quando algo estiver bom, elogie de forma específica.
- Use exemplos concretos sempre que possível (snippet, arquivo:linha, query SQL, screenshot).
- Cite normas, RFCs, guidelines.
- Se faltar informação, diga claramente o que tentou e o que precisa para concluir.
- Priorize o usuário final.
- **Se a versão deployada (Vercel) ou em git divergir da versão local que o dev está trabalhando, PARAR e perguntar antes de assumir. Não auditar versão errada.**
- **Distinguir claramente entre "encontrado em código" e "verificado em runtime". Achado estático sem confirmação live é hipótese, não fato.**

---

✍️ INSTRUÇÃO FINAL

1. **OBRIGATÓRIO PRIMEIRO:** Confirmar repo principal + branch master + sync com remote + versão a auditar (vide bloco "REPOSITÓRIO A AUDITAR"). Se houver dúvida, perguntar ao dev.
2. **Solicitar credenciais de teste** ao dev antes de iniciar Claude in Chrome.
3. Confirmar que **deploy Vercel está sincronizado com commit que será auditado** (redeploy se necessário, com permissão).
4. Faça reconhecimento inicial do repositório (Etapa 1).
5. Estabeleça baseline (Etapa 2) incluindo versão + commit + branch + data.
6. Acesse URL Vercel via Claude in Chrome com credenciais fornecidas e execute blocos A a H por no mínimo 90 minutos, mantendo diário de bordo.
7. Audite as 25 dimensões sobre código + comportamento observado.
8. Leia Plan.md e identifique pendentes.
9. Consolide os achados da auditoria com pendentes do Plan.md em checklist único, lógico e ordenado.
10. Crie pasta `/analise/` na **raiz do repo principal** (não worktree).
11. Gere todos os 9 arquivos (README + ROADMAP + 01 a 08) mais o `archive/`.
12. Mova MDs antigos relacionados a análise/auditoria/roadmap para `archive/`.
13. **Garanta que ROADMAP.md tem links cruzados para arquivos de detalhe** quando aplicável.
14. Confirme no `README.md` da pasta o status final, com link para os demais arquivos.
15. **Reportar ao dev no fim:**
    - Versão auditada (X.Y.Z @ commit abc123)
    - Localização da pasta `/analise/`
    - Total de itens P0/P1/P2/P3
    - Veredito (PRONTO / PRONTO COM RESSALVAS / NÃO PRONTO)
    - Top 3 bloqueadores

A pergunta que você precisa responder ao final é:

> "Eu colocaria minha mãe ou meu filho para usar este app amanhã, em produção, dependendo dele para tomar a medicação certa, na hora certa, todo dia?"

Se a resposta não é um SIM convicto, o app não está pronto, e o `ROADMAP.md` + `03-CHECKLIST-LANCAMENTO.md` precisam estar 100% claros sobre o que fazer para chegar lá.

Boa auditoria. Não tenha pressa. Não tenha pena. Trabalhe de forma autônoma. Entregue tudo organizado em `/analise`.

**IMPORTANTE: Não vou estar aqui, faça tudo sozinho. Se precisar me perguntar algo CRÍTICO (versão errada, credenciais faltando, divergência git séria), pergunte; senão siga o plano e me reporte apenas no final.**

=== FIM DO PROMPT ===

---

## Mudanças desta versão (v2) vs original

| # | Mudança | Razão |
|---|---|---|
| 1 | **Bloco "REPOSITÓRIO A AUDITAR" no topo, com 5 checagens git obrigatórias** | Evita auditar worktree desatualizada |
| 2 | **Etapa 2 baseline inclui versão + commit hash + data** | Rastreabilidade |
| 3 | **Credenciais de teste solicitadas no início** | Evita gastar tempo tentando criar conta com paywall/LGPD |
| 4 | **Verificação versão Vercel ≡ código auditado** | Evita auditar deploy antigo |
| 5 | **Bloco H — DevTools (localStorage, network, console)** | Achados LGPD do cache só vieram de DevTools |
| 6 | **Dimensão 25 — Validação cruzada Plan.md ↔ realidade** | Plan.md pode mentir (item marcado done sem migration aplicada) |
| 7 | **`/analise` na raiz do repo principal, não worktree** | Evita confusão recorrente |
| 8 | **NOVO arquivo ROADMAP.md como checklist macro com links cruzados** | Visão única consolidada |
| 9 | **Distinção "encontrado em código" vs "verificado em runtime"** | Honestidade técnica |
| 10 | **Reporte final ao dev com versão+localização+veredito** | Closure clara |
| 11 | **Permissão pra perguntar coisas CRÍTICAS apesar de "não vou estar aqui"** | Evita auditoria perdida por dúvida bloqueadora |
