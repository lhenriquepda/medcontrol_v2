# Dosy — Mapa do App

> Documento de inventário visual e funcional do app. Detalha cada página, componente sempre visível, modal global, sitemap e principais user flows. Para uso em briefing de design, onboarding de IA e auditoria de UX.
>
> **Última revisão:** 2026-05-03 — pós release v0.1.7.3 (versionCode 27)

---

## Sobre o app

**Dosy — Controle de Medicação.** App mobile (Android nativo via Capacitor + PWA web) de organização e lembrete de medicação para qualquer pessoa que toma remédio com horário: pacientes crônicos, pais cuidando dos filhos, cuidadores familiares.

- **Plataformas:** Android (Play Store, pkg `com.dosyapp.dosy`) + Web PWA (https://dosy-teal.vercel.app).
- **Idioma:** Português (BR) único. Sem internacionalização ainda.
- **Tema:** Dark / Light com toggle manual (default segue sistema).
- **Tier:** Free / Plus / Pro / Admin. Free limita 1 paciente; Plus/Pro liberam ilimitado + Análises + Relatórios PDF/CSV + Compartilhamento.
- **Autenticação:** Supabase Auth email/senha + consentimento LGPD obrigatório no signup.
- **Diferenciais visíveis:** alarme estilo despertador (bypassa silencioso/DND no Android), notificação push tray fallback, modo S.O.S para doses extras com regras de segurança, painel de adesão.

---

## Componentes sempre visíveis

### Header (`AppHeader.jsx`)

Barra superior fixa (sticky, fundo azul escuro `#0d1535`) presente em todas as telas autenticadas.

- **Logo Dosy** à esquerda (clicável, leva pra Início).
- **Saudação contextual:** "Bom dia / Boa tarde / Boa noite" + primeiro nome do user + chip de tier (Free/Plus/Pro/Admin).
- **Badge de doses atrasadas** (rosa pulsante) quando há doses overdue — clicável, leva pra Início filtrada por `status=overdue`.
- **Ícone de engrenagem** (botão circular) à direita, leva pra Ajustes.

### Bottom Nav Menu (`BottomNav` — montado em `App.jsx`)

Barra inferior fixa com 5 itens, ícones ilustrativos + label:

1. **Início** — ícone casa, leva pro Dashboard.
2. **Pacientes** — ícone pessoas, leva pra lista de pacientes.
3. **+ (botão central destacado)** — botão circular azul flutuante, leva pra "Novo tratamento".
4. **S.O.S** — ícone sirene, leva pra registro de dose extra fora do agendado.
5. **Mais** — ícone três pontos, leva pra menu secundário (Histórico, Tratamentos, Análises, Relatórios, Ajustes, FAQ).

### AdBanner (`AdBanner.jsx`)

Banner publicitário aparece em telas principais (Início, Pacientes, Mais, etc.) **somente para tier Free**. Plus/Pro/Admin não veem.

- **Web:** AdSense responsivo abaixo do header / dentro do conteúdo.
- **Android nativo:** AdMob banner overlay no topo via plugin Capacitor (TOP_CENTER, ADAPTIVE_BANNER).
- Disclaimer "Publicidade" acima da área do banner em web.

### UpdateBanner (`UpdateBanner.jsx`)

Banner discreto no topo (abaixo do AdBanner se houver) quando há update disponível via Service Worker (web) ou Play In-App Updates (Android). Botão "Atualizar agora" recarrega a app.

---

## Páginas autenticadas

### Início (`Dashboard.jsx`)

Tela principal de acompanhamento diário das doses.

- **3 cards de status** lado a lado:
  - **Pendentes hoje** (azul) — número de doses do dia ainda não confirmadas.
  - **Adesão 7d** (verde) — porcentagem de adesão dos últimos 7 dias.
  - **Atrasadas** (rosa pulsante quando >0) — total de doses overdue.

- **Filtros sticky (FilterBar)** logo abaixo:
  - Linha 1: pílulas de período horizontais — `12h`, `24h`, `48h`, `7 dias`, `Tudo` + botão circular com ícone funil pra abrir modal de filtros avançados.
  - Linha 2 (condicional): chips dos filtros ativos com X pra remover individualmente + link "limpar" no final.

- **Modal de filtros avançados (BottomSheet "Filtros"):**
  - **Paciente** — dropdown picker com avatar + nome de cada paciente (opção "Todos pacientes").
  - **Status** — grid 2 colunas com 4 botões (cada um com ícone): Pendente, Atrasada, Tomada, Pulada.
  - **Tipo** — grid 2 colunas com 2 botões: Horário fixo, S.O.S, cada um com ícone + hint pequeno embaixo.
  - Footer: botão **Limpar** (secundário) + **Aplicar** (primário).

- **Conteúdo principal (3 estados):**
  - **Sem pacientes (primeiro uso):** card "Bem-vindo ao Dosy!" com ícone mão acenando + mini guia 3 passos (1. Cadastre os pacientes / 2. Crie um tratamento / 3. Acompanhe as doses) + CTA "Cadastrar primeiro paciente".
  - **Sem doses no período:** EmptyState com ícone pílula + mensagem "Nenhuma dose neste período" + CTA "+ Novo tratamento".
  - **Com doses:** lista agrupada por paciente. Cada grupo tem cabeçalho clicável (avatar + nome + contagem + badge de atrasadas/pendentes) que colapsa/expande. Dentro, cards de dose (DoseCard) com nome do medicamento, dose/unidade, horário, status, swipeable pra confirmar/pular.

- **Pull-to-refresh** no topo (overlay com spinner + texto "Puxe para atualizar / Solte para atualizar / Atualizando…").

- **DoseModal (modal individual de dose):** abre ao tocar num card. Mostra detalhes completos da dose, botões "Tomei agora", "Pular", "Editar horário" (PRO), histórico do medicamento.

- **MultiDoseModal (modal de múltiplas doses):** abre via deep-link de notificação push quando o user toca numa notif que agrupou várias doses do mesmo horário. Lista todas, permite confirmar em lote.

### Pacientes (`Patients.jsx`)

Lista de pacientes cadastrados.

- **Header:** título "Pacientes" + botão "+ Novo" no canto direito.
- **AdBanner** abaixo.
- **Card de limite Free** (tier free + tem 1 paciente): "Plano grátis: 1/1 paciente · Ver PRO →" — clicar abre paywall.
- **Lista de PatientCard** (avatar emoji ou foto + nome + idade + condição). Sem pacientes: EmptyState "Nenhum paciente cadastrado" + CTA "Adicionar paciente".
- **PaywallModal** abre ao tentar adicionar 2º paciente em tier free.

### Detalhe do Paciente (`PatientDetail.jsx`)

Acessada ao tocar num PatientCard.

- **Header:** botão voltar + nome do paciente + link "Editar".
- **Card do paciente:** avatar grande, nome, idade · peso, condição, médico, alergias (com aviso vermelho se houver).
- **Card de Compartilhamento (PRO):** "Compartilhar paciente" — cuidadores adicionais com edição em tempo real (ícone aperto de mão). Free vê CTA pra upgrade.
- **Bloco "Compartilhado com você"** (quando user não é dono): badge azul indicando colaboração.
- **2 cards menores lado a lado:** Adesão hoje (%) + Tratamentos ativos (contagem).
- **Seção "Tratamentos ativos":** cabeçalho com link "+ Novo" + lista de tratamentos (medicamento, posologia, próxima dose). Sem ativos: EmptyState "Sem tratamentos ativos".

### Novo / Editar Paciente (`PatientForm.jsx`)

Formulário de cadastro/edição de paciente.

- **Header:** botão voltar + título "Novo paciente" ou "Editar paciente".
- **Campos:**
  - **Avatar** — picker emoji ou upload de foto.
  - **Nome completo*** (placeholder "Nome completo").
  - **Idade** (numérico, "Ex: 45").
  - **Peso (kg)** (decimal, "Ex: 78,5").
  - **Condição/diagnóstico** ("Ex: Hipertensão").
  - **Médico responsável** ("Ex: Dra. Ana").
  - **Alergias** (textarea, "Ex: Penicilina, AAS").
- **Botão primário** "Salvar" no rodapé.
- **Botão excluir** (vermelho) só na edição. Abre `ConfirmDialog` "Excluir paciente?" com mensagem sobre doses associadas.

### Novo / Editar Tratamento (`TreatmentForm.jsx`)

Formulário central pra criar tratamento e gerar doses.

- **Header:** botão voltar + título "Novo tratamento" ou "Editar tratamento" + botão modelo (📋) à direita se há templates salvos.
- **Campos principais:**
  - **Paciente*** — select dropdown (desabilitado em edição).
  - **Medicamento*** — input com autocomplete (`MedNameInput` — sugere nomes já usados pelo user).
  - **Dose / unidade*** ("Ex: 1 comprimido, 15 gotas").
- **Card "Modo de agendamento"** (toggle de 2 abas):
  - **Intervalo fixo:** chips de frequência (4h, 6h, 8h, 12h, 1x/dia, 2 em 2 dias, 3 em 3 dias, 1x/semana, quinzenal, 1x/mês) + campo "Horário da 1ª dose".
  - **Horários:** lista editável de horários pontuais (ex: 08:00, 12:00, 16:00, 20:00) com botões + e ✕ pra adicionar/remover.
- **Toggle "Uso contínuo ♾"** (sem data fim) — quando OFF mostra campo "Duração (dias)". Quando ON, sistema gera 5 dias iniciais e renova automaticamente via cron.
- **Campo "Início"** — datetime-local picker.
- **Preview** ("X doses no total" ou "X doses (primeiros 5 dias gerados)").
- **Card "Salvar como modelo"** (apenas em criação) — checkbox + nome do template pra reutilizar depois.
- **Botão primário** "Criar tratamento" / "Salvar alterações".
- **Botão excluir** vermelho na edição → `ConfirmDialog` "Excluir tratamento?".
- **BottomSheet "Carregar modelo"** — lista de templates salvos com nome + preview (medicamento · dose · intervalo).

### Lista de Tratamentos (`TreatmentList.jsx`)

Lista todos tratamentos do user (ativos e inativos).

- **Header:** voltar + "Tratamentos" + botão "+ Novo".
- **Campo de busca** "Buscar por medicamento…".
- **Lista** com cards de tratamento (medicamento, paciente, dose, frequência, status). Sem itens: EmptyState "Nenhum tratamento" + CTA.

### S.O.S (`SOS.jsx`)

Tela de registro de dose extra fora do agendado (paliativo, dor, etc.).

- **Fundo rosa-claro** sutil pra diferenciar visualmente do flow normal.
- **Header:** "S.O.S" + subtítulo "Dose extra fora do agendado".
- **Formulário:**
  - **Paciente*** — picker.
  - **Medicamento*** — autocomplete.
  - **Dose*** ("Ex: 1 comprimido").
  - **Quando** — datetime-local (default agora).
  - **Observação** ("Ex: Dor de cabeça forte").
- **Card de regra de segurança** (quando medicamento já foi cadastrado):
  - **Intervalo mínimo (h)** entre doses S.O.S do mesmo medicamento.
  - **Máximo de doses em 24h.**
  - Botão **Salvar regra**.
  - Validação ao registrar: bloqueia com mensagem "Próxima permitida: HH:MM" se violar regra.
- **Botão primário** "Registrar S.O.S".
- **Histórico recente** do paciente abaixo (últimas doses S.O.S).

### Mais (`More.jsx`)

Menu secundário acessado pelo bottom nav.

- **Header:** "Mais".
- **Card de perfil:** avatar (inicial em círculo brand), nome, email, plano. Chip de tier à direita.
- **Banner "Conheça o Dosy PRO"** (gradient brand) — só pra free, abre paywall.
- **Lista de itens** com ícone + label + hint:
  - **Histórico** — Doses por dia, adesão.
  - **Tratamentos** — Lista e gerenciamento.
  - **Análises** — Adesão e calendários (PRO, badge cadeado quando free).
  - **Relatórios** — Exportar PDF / CSV (PRO).
  - **Ajustes** — Tema, notificações, conta.
  - **Ajuda / FAQ** — Dúvidas, suporte e tutoriais.
- **Painel Admin** (só pra tier admin) — card destacado em vermelho com ícone coroa.

### Histórico (`DoseHistory.jsx`)

Linha do tempo completa de doses passadas.

- **Header:** voltar + "Histórico de doses".
- **Picker de paciente** (default "Todos pacientes").
- **Pílulas de período:** Hoje, Ontem, 7 dias, 30 dias, 90 dias.
- **Navegador anterior/próximo** pra mover período.
- **Campo de busca** ("Buscar por medicamento ou observação…").
- **Card resumo:** "Adesão no período" + barra de progresso + contagens (✓ tomadas / atrasadas / puladas).
- **Lista agrupada por dia** com badge de adesão por dia + cards de dose (medicamento, paciente, horário previsto vs real, status colorido).

### Análises (`Analytics.jsx`) — PRO

Gráficos e métricas avançadas.

- **Header:** voltar + "Análises" + badge PRO se locked.
- **Free vê preview borrado** com `LockedOverlay` "Análises detalhadas de adesão, calendário e S.O.S são exclusivas do PRO" + CTA Desbloquear.
- **PRO vê:**
  - Toggle período: 7 dias / 30 dias.
  - **Calendário heatmap** — grid de dias coloridos (verde = todas tomadas, amarelo = parcial, vermelho = nenhuma, cinza = sem doses).
  - **Adesão por paciente** — barras horizontais com %.
  - **Uso de S.O.S por medicamento** — ranking + barra proporcional.

### Relatórios (`Reports.jsx`) — PRO

Exportação de histórico em PDF e CSV.

- **Header:** voltar + "Relatórios".
- **Picker de paciente.**
- **Range datetime-local de/até** (default últimos 30 dias).
- **Botões export:** "Baixar PDF" + "Baixar CSV".
  - Web: download direto do navegador.
  - Android: salva em cache + abre share sheet do sistema.
- **Free:** clicar em qualquer botão abre paywall.
- **Privacy screen ativo** (FLAG_SECURE Android) — não aparece em screenshots/recents.

### Ajustes (`Settings.jsx`)

Configurações da conta e do app.

- **Header:** voltar + "Ajustes".
- **Card "Seu plano"** — Tier ativo + chip grande.
- **Seção Aparência:**
  - Toggle Modo escuro.
  - Estilo de ícones — select (Flat = visual moderno · Emoji = legado colorido).
- **Seção Notificações:**
  - Toggle "Notificações push" + status (ativo / desativado / bloqueado pelo SO).
  - Botão "Verificar permissões do alarme" (Android) — re-checa as 4 permissões especiais (post notifications, exact alarm, full screen intent, draw overlay).
  - Dropdown "Avisar com antecedência" (Na hora / 5 min antes / 15 min antes / 30 min antes / 1h antes).
  - Toggle "Alarme crítico" (rosa quando ON) — ativa despertador fullscreen ignorando silencioso e DND.
  - Toggle "Não perturbe" (aparece SÓ se Alarme Crítico ON, item #087) — define janela horária (De / Até) em que o alarme crítico não toca, doses recebem só push tray.
  - (Resumo Diário ocultado em v0.1.7.3, será reativado na v0.1.8.0).
- **Seção Conta:**
  - Campo "Seu nome" + botão Salvar.
  - Email (somente leitura).
  - Botão "Sair da conta" → ConfirmDialog.
- **Seção Dados & Privacidade:**
  - Botão "Exportar meus dados" (LGPD — CSV/JSON do user).
  - Botão "Excluir conta permanentemente" → ConfirmDialog dupla "Excluir conta permanentemente?".

### Painel Admin (`Admin.jsx`) — apenas tier Admin

Gerenciamento manual de tier de usuários (concessão de Plus/Pro promocional, suporte).

- Lista de usuários com email, tier atual, data de criação.
- Ações: alterar tier, revogar acesso PRO promo, ver assinaturas ativas.

### Ajuda / FAQ (`FAQ.jsx`)

Base de conhecimento com perguntas frequentes.

- **Header:** voltar + "Ajuda / FAQ" + subtítulo "X perguntas frequentes".
- **Campo de busca** ("Buscar pergunta ou palavra-chave…").
- **Lista categorizada** com headings de categorias (Notificações, Pacientes, Tratamentos, Conta, etc.) + perguntas expansíveis (accordion).
- **Footer:** versão do app + link "Dosy não substitui orientação médica".

---

## Páginas não autenticadas

### Login / Cadastro / Recuperação (`Login.jsx`)

Tela única com 3 modos (signin / signup / forgot).

- **Background gradient azul escuro** (`#0d1535 → #1a2660`).
- **Logo Dosy** centralizado.
- **Toggle de modo** entre "Entrar" e "Criar conta" (link "Esqueci minha senha" leva pro modo forgot).
- **Campos com label explícito** (item #011, A11y idosos):
  - **Nome** (signup only).
  - **Email** + placeholder "seu@email.com".
  - **Senha** + placeholder "••••••••" (mínimo 8 chars, 1 maiúscula, 1 número no signup).
- **Link "Esqueci minha senha"** (signin).
- **Hint de senha** (signup): "Senha: mín. 8 chars, uma maiúscula, um número.".
- **Checkbox de consentimento LGPD** (signup) — link pra Política de Privacidade obrigatório.
- **Disclaimer médico amber** (signup, item #020): "⚠️ Aviso importante. Dosy é uma ferramenta de organização e lembrete de medicação. **Não substitui prescrição, diagnóstico ou orientação de profissional de saúde.**"
- **Botão primário** "Entrar" / "Criar conta" / "Enviar link de recuperação".
- **Modo demo** (web sem Supabase configurado) — botão "Modo demonstração" pra explorar sem cadastro.

### Política de Privacidade (`Privacidade.jsx`)

Texto institucional LGPD-compliant. Acessível antes do login (link rodapé).

### Termos de Uso (`Termos.jsx`)

Texto contratual. Inclui disclaimer médico em destaque na seção "Limitações". Acessível antes do login.

### Reset Password (`ResetPassword.jsx`)

Recebida via deep link `dosy://reset-password?token=...` (Android) ou URL Vercel (web).

- Campo "Nova senha" + "Confirmar senha".
- Botão "Salvar nova senha".

### Install (`Install.jsx`)

Landing page institucional para download web → CTA Play Store + Termos / Privacidade.

---

## Modais e overlays globais

### DoseModal (`DoseModal.jsx`)

Modal individual de dose. Abre ao tocar num DoseCard. Mostra:
- Medicamento, paciente, horário previsto/real, status colorido.
- Botões: "Tomei agora", "Pular", "Editar horário" (PRO), "Desfazer" (após ação).
- Histórico recente do mesmo medicamento (5 últimas doses).
- Campo de observação opcional.

### MultiDoseModal (`MultiDoseModal.jsx`)

Modal pra múltiplas doses do mesmo horário. Aberto via notificação agrupada. Permite confirmar/pular em lote.

### BottomSheet "Filtros" (`FilterBar.jsx`)

Já descrito em Início.

### PaywallModal (`PaywallModal.jsx`)

Aparece ao tentar usar feature PRO sem ter o tier.
- Título e razão contextual ("No plano grátis você pode ter até 1 paciente…").
- Lista de benefícios PRO (Pacientes ilimitados / Análises / Relatórios PDF/CSV / Compartilhamento).
- Botão "Assinar PRO" (placeholder enquanto billing não implementado).
- Botão "Fechar".

### SharePatientSheet (`SharePatientSheet.jsx`) — PRO

BottomSheet pra compartilhar paciente com outro user.
- Lista de compartilhamentos atuais (email + permissão + botão revogar).
- Campo "Adicionar email" + botão "Convidar".
- Toggle de permissão (visualizar / editar).

### ConfirmDialog (`ConfirmDialog.jsx`)

Dialog modal pra ações destrutivas (excluir paciente, tratamento, conta, sair).
- Título + mensagem.
- Botões "Cancelar" + "Confirmar" (vermelho quando `danger=true`).

### OnboardingTour (`OnboardingTour.jsx`)

Carousel de 6 slides aparece no primeiro login após signup:
- Slide 1: "Bem-vindo ao Dosy" (mão acenando).
- Slides 2–5: features chave (alarme despertador, S.O.S, adesão, compartilhamento).
- Slide 6: CTA "Começar".
- Botão "Pular" no canto superior direito.

### PermissionsOnboarding (`PermissionsOnboarding.jsx`)

Sheet Android-only pra solicitar 4 permissões especiais do alarme crítico:
- POST_NOTIFICATIONS
- SCHEDULE_EXACT_ALARM
- USE_FULL_SCREEN_INTENT
- SYSTEM_ALERT_WINDOW (overlay)

### DailySummaryModal (`DailySummaryModal.jsx`)

(Funcionalidade ocultada em v0.1.7.3 — não rendered no momento.) Modal que aparecia no horário configurado mostrando resumo do dia (doses pendentes, atrasadas, próximas).

### UpdateBanner (`UpdateBanner.jsx`)

Já descrito em "Sempre visíveis".

---

## Sitemap

```
/  (Início — Dashboard)
│
├── /pacientes
│   ├── /pacientes/novo
│   ├── /pacientes/:id
│   └── /pacientes/:id/editar
│
├── /tratamento/novo
├── /tratamento/:id  (editar)
├── /tratamentos     (lista completa)
│
├── /sos
│
├── /mais
│   ├── /historico
│   ├── /tratamentos        (compartilhado com /tratamentos)
│   ├── /relatorios-analise (Análises — PRO)
│   ├── /relatorios         (Relatórios PDF/CSV — PRO)
│   ├── /ajustes
│   ├── /faq
│   └── /admin              (Admin only)
│
└── (não autenticado)
    ├── /login            (catch-all → Login)
    ├── /privacidade
    ├── /termos
    ├── /reset-password
    ├── /install
    └── /faq              (também acessível público)
```

---

## User flows principais

### 1. Onboarding — primeiro uso

```
Login (signup) →
  consent LGPD + disclaimer médico →
  signup success →
  PermissionsOnboarding (Android, 4 perms) →
  OnboardingTour (6 slides) →
  Dashboard vazio com card "Bem-vindo ao Dosy" + CTA "Cadastrar primeiro paciente" →
  PatientForm preenche dados →
  PatientDetail (paciente recém-criado) →
  CTA "+ Novo tratamento" →
  TreatmentForm (paciente preselecionado) →
  Dashboard com primeira dose visível
```

### 2. Acompanhamento diário (uso recorrente)

```
App abre →
  Dashboard mostra cards de status (Pendentes hoje / Adesão 7d / Atrasadas) →
  Lista agrupada por paciente →
  User toca em DoseCard pendente →
  DoseModal abre →
  Botão "Tomei agora" →
  Toast "X marcada como tomada — Desfazer" →
  Status atualiza em real-time (verde/check) →
  Repetir pra próximas doses
```

Alternativa: swipe-right no DoseCard direto na lista marca como tomada (sem abrir modal).

### 3. Receber alarme estilo despertador

```
Hora da dose chega →
  AlarmManager Android dispara →
  AlarmActivity abre fullscreen (mesmo no silencioso/DND) →
  Som contínuo + vibração + tela cheia com nome do medicamento e paciente →
  User toca "Tomei" ou "Adiar 10 min" ou "Pular" →
  App registra no DB →
  Status sincroniza no Dashboard
```

### 4. Cadastrar dose S.O.S

```
Bottom nav → S.O.S →
  Fundo rosa diferencia visualmente →
  Picker paciente + medicamento + dose + horário (default agora) + observação →
  Botão "Registrar S.O.S" →
  Validação contra regra de segurança (intervalo mínimo + máx/24h) →
  Se ok: toast "Dose S.O.S registrada" + aparece no histórico
  Se viola: toast vermelho "Próxima permitida: HH:MM"
```

### 5. Exportar relatório (PRO)

```
Mais → Relatórios →
  Seleciona paciente + range de/até →
  Botão "Baixar PDF" →
  PDF gerado com header (paciente + período) + tabela de doses + assinatura "Dosy v{x.y.z}" →
  Web: download navegador
  Android: cache + share sheet (envia pra WhatsApp/Email/Drive)
```

### 6. Compartilhar paciente com cuidador (PRO)

```
PatientDetail → "Compartilhar paciente" →
  SharePatientSheet abre →
  Adicionar email + permissão (visualizar/editar) →
  "Convidar" →
  Outro user recebe (email/notif) →
  Aceita → vê paciente em sua lista marcado "Compartilhado com você" →
  Edições aparecem em tempo real pra ambos via Supabase Realtime
```

### 7. Recuperação de senha

```
Login → "Esqueci minha senha" →
  Modo forgot → input email → "Enviar link" →
  Toast "Email enviado" →
  User abre email → clica link →
  Web: redireciona /reset-password?token=...
  Android: deep link dosy://reset-password?token=... →
  ResetPassword tela → nova senha + confirmar →
  "Salvar nova senha" → redireciona Login
```

### 8. Mudar tier para PRO

```
Qualquer ação bloqueada (Análises / Relatórios / >1 paciente / Compartilhar) →
  PaywallModal abre →
  Lista benefícios + "Assinar PRO" →
  (Billing não implementado ainda — placeholder ou fluxo manual via admin) →
  Tier atualizado → cards desbloqueados em real-time
```

---

## Notas para design

- **Tom de voz:** acolhedor, prático, não-clínico. Evita jargão médico técnico em copy de botão (ex: "Tomei agora" vs "Marcar como administrada").
- **Hierarquia visual:** ícones flat modernos por padrão (Lucide), opção emoji legado pra users que preferem. Cards com cantos arredondados (rounded-xl, rounded-2xl). Brand color azul royal (`#3b5bdb` aproximado).
- **Estados emocionais codificados por cor:**
  - Verde (emerald) = positivo (dose tomada, adesão alta).
  - Rosa/vermelho (rose) = atenção (dose atrasada, alarme crítico, S.O.S).
  - Âmbar = aviso/PRO/disclaimer.
  - Azul brand = principal, navegação, CTAs primários.
  - Cinza = neutro / inativo / sem dados.
- **Dark mode** é tratado como first-class (não afterthought) — todas combinações de cor têm pares dark com saturação reduzida.
- **Touch targets** mínimo 44×44 dp (idosos).
- **Animações** sutis via framer-motion (staggers, springs) — nunca bloqueiam interação, máximo 300ms.
- **Safe-area** respeitada em todos sticky elements (header, bottom nav, pull-to-refresh).
