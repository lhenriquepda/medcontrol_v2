# Dosy — Mapa do App

> Inventário funcional do app. Lista o que cada página contém. Sem detalhes visuais (cor, formato, posicionamento) — designer tem liberdade total nessa parte.

---

## Sobre o app

**Dosy — Controle de Medicação.** App mobile (Android + PWA web) de organização e lembrete de medicação para qualquer pessoa que toma remédio com horário: pacientes crônicos, pais cuidando dos filhos, cuidadores familiares.

- Português Brasil único.
- Tema Dark e Light com toggle manual.
- Tier Free / Plus / Pro / Admin. Free limita 1 paciente. Plus/Pro liberam ilimitado, Análises, Relatórios PDF/CSV e Compartilhamento.
- Login email/senha com consentimento LGPD obrigatório.

---

## Sempre visíveis

### Header
- Logo Dosy clicável (leva pra Início).
- Saudação contextual com nome do user (Bom dia / Boa tarde / Boa noite) e indicador do tier (Free, Plus, Pro, Admin).
- Aviso de doses atrasadas quando há, clicável (leva pra Início filtrado por atrasadas).
- Acesso rápido pra Ajustes.

### Bottom Nav
Menu inferior com 5 itens, todos com ícones ilustrativos:
1. **Início**
2. **Pacientes**
3. **+** botão central pra adicionar tratamento novo
4. **S.O.S**
5. **Mais**

### AdBanner
Banner publicitário visível apenas no plano Free, em telas principais (Início, Pacientes, Mais, etc.). Some no Plus/Pro/Admin.

### UpdateBanner
Aviso no topo quando há nova versão disponível, com ação pra atualizar.

---

## Páginas autenticadas

### Início
- 3 cards de status: Pendentes hoje, Adesão 7 dias, Atrasadas.
- Filtro de período inline com opções 12h, 24h, 48h, 7 dias, Tudo, e botão pra abrir filtros avançados.
- **Modal Filtros:** título Filtros, opção Paciente com seletor, opção Status com botões (Pendente, Atrasada, Tomada, Pulada — cada um com ícone), opção Tipo com 2 botões (Horário fixo, S.O.S — com ícones), botões Limpar e Aplicar.
- Lista de doses agrupada por paciente. Cada grupo mostra avatar e nome do paciente, contagem de doses, alerta de atrasadas, e pode ser recolhido/expandido.
- Cada dose mostra: nome do medicamento, dose/unidade, horário, status. Permite confirmar como tomada ou pular direto na lista.
- Pull-to-refresh no topo.
- Estado inicial (sem pacientes): card de boas-vindas com guia de 3 passos e CTA pra cadastrar primeiro paciente.
- Estado vazio (sem doses no período): mensagem "Nenhuma dose neste período" + CTA pra criar tratamento.

### Pacientes
- Título "Pacientes" + botão pra adicionar novo.
- Aviso de limite de plano Free quando aplicável (1/1 paciente, com link pra conhecer Pro).
- Lista de pacientes com avatar (foto ou emoji), nome, idade, condição.
- Estado vazio: "Nenhum paciente cadastrado" + CTA.

### Detalhe do Paciente
- Avatar grande, nome, idade, peso, condição, médico responsável, alergias (com aviso se houver).
- Acesso a "Compartilhar paciente" (recurso Pro): mostra com quem está compartilhado e permite gerenciar.
- Aviso quando paciente é compartilhado por outra pessoa (colaboração).
- 2 cards lado a lado: Adesão hoje (%), Tratamentos ativos (contagem).
- Seção Tratamentos ativos com link pra adicionar novo, e lista de cards de cada tratamento ativo.
- Estado sem tratamentos: "Sem tratamentos ativos".

### Novo / Editar Paciente
- Avatar (escolha de emoji ou upload de foto).
- Campos: Nome completo, Idade, Peso (kg), Condição/diagnóstico, Médico responsável, Alergias.
- Botão Salvar.
- Na edição: botão Excluir paciente com confirmação dupla (avisa que doses associadas serão removidas).

### Novo / Editar Tratamento
- Campos principais: Paciente (seletor), Medicamento (com sugestões dos já usados), Dose / unidade.
- **Modo de agendamento** com 2 opções:
  - **Intervalo fixo**: chips de frequência (4h, 6h, 8h, 12h, 1x/dia, 2 em 2 dias, 3 em 3 dias, 1x/semana, quinzenal, 1x/mês) + horário da 1ª dose.
  - **Horários**: lista de horários pontuais (ex: 08:00, 12:00, 16:00), permite adicionar e remover.
- Toggle **Uso contínuo** (sem data de fim). Quando desligado, pede Duração em dias.
- Campo Início (data e hora).
- Preview informando quantas doses serão geradas.
- Opção de salvar tratamento como modelo reutilizável (apenas em criação) com nome do modelo.
- Botão Criar tratamento / Salvar alterações.
- Na edição: botão Excluir tratamento com confirmação.
- Acesso a templates salvos por um botão de modelos (carrega configurações pré-prontas).

### Lista de Tratamentos
- Título "Tratamentos" + botão pra adicionar novo.
- Campo de busca por medicamento.
- Lista de cards de tratamento (medicamento, paciente, dose, frequência, status).
- Estado vazio: "Nenhum tratamento" + CTA.

### S.O.S
- Título "S.O.S" e subtítulo "Dose extra fora do agendado".
- Campos: Paciente, Medicamento, Dose, Quando (data e hora, default agora), Observação.
- Card de regra de segurança (aparece quando o medicamento já foi cadastrado): Intervalo mínimo entre doses, Máximo de doses em 24h, com botão pra salvar a regra.
- Botão Registrar S.O.S.
- Validação automática: bloqueia registro com aviso se violar regra de segurança ("Próxima permitida: HH:MM").
- Histórico recente do paciente abaixo.

### Mais
- Card de perfil: avatar, nome, email, plano atual.
- Banner pra conhecer o Pro (apenas no Free).
- Lista de itens com ícone, label e descrição curta:
  - **Histórico** — Doses por dia, adesão.
  - **Tratamentos** — Lista e gerenciamento.
  - **Análises** — Adesão e calendários (Pro).
  - **Relatórios** — Exportar PDF / CSV (Pro).
  - **Ajustes** — Tema, notificações, conta.
  - **Ajuda / FAQ** — Dúvidas e tutoriais.
- Acesso ao Painel Admin (apenas pra usuários Admin).

### Histórico
- Título "Histórico de doses".
- Seletor de paciente (default Todos pacientes).
- Pílulas de período: Hoje, Ontem, 7 dias, 30 dias, 90 dias.
- Navegação anterior/próximo período.
- Campo de busca por medicamento ou observação.
- Card resumo: Adesão no período, com barra de progresso e contagens (tomadas, atrasadas, puladas).
- Lista agrupada por dia, cada grupo com badge de adesão diária e cards de dose (medicamento, paciente, horário previsto vs real, status).

### Análises (Pro)
- Título "Análises".
- No Free: prévia bloqueada com mensagem explicando o recurso e CTA pra desbloquear.
- No Pro:
  - Toggle de período: 7 dias / 30 dias.
  - Calendário heatmap dos últimos dias (cor reflete adesão diária).
  - Adesão por paciente em barras.
  - Uso de S.O.S por medicamento em ranking.

### Relatórios (Pro)
- Título "Relatórios".
- Seletor de paciente.
- Range de data e hora De / Até (default últimos 30 dias).
- Botões Baixar PDF e Baixar CSV.
- No Free: clicar abre paywall.
- No Android: salva no dispositivo + abre opções pra compartilhar (WhatsApp, Email, Drive).

### Ajustes
- Card "Seu plano" com tier atual.
- **Aparência:**
  - Toggle Modo escuro.
  - Estilo de ícones (Flat moderno / Emoji legado).
- **Notificações:**
  - Toggle Notificações push (com status atual: ativo, desativado, ou bloqueado).
  - Botão Verificar permissões do alarme (Android).
  - Avisar com antecedência (seleciona Na hora, 5 min antes, 15, 30, 1h).
  - Toggle Alarme crítico (despertador estilo, ignora silencioso e DND).
  - Toggle Não perturbe (aparece apenas se Alarme crítico ON): janela horária De / Até em que o alarme não toca, doses recebem só notificação simples.
- **Conta:**
  - Editar nome.
  - Email (somente leitura).
  - Botão Sair da conta.
- **Dados & Privacidade:**
  - Exportar meus dados (LGPD).
  - Excluir conta permanentemente (com confirmação dupla).

### Painel Admin (apenas Admin)
- Lista de usuários com email, tier atual, data de criação.
- Ações: alterar tier, conceder Plus/Pro promocional, ver assinaturas ativas.

### Ajuda / FAQ
- Título "Ajuda / FAQ" + contagem de perguntas.
- Campo de busca por palavra-chave.
- Lista categorizada (Notificações, Pacientes, Tratamentos, Conta, etc.) com perguntas expansíveis.
- Rodapé com versão do app e disclaimer "Dosy não substitui orientação médica".

---

## Páginas não autenticadas

### Login
Tela única com 3 modos: Entrar, Criar conta, Esqueci minha senha.

- Logo Dosy.
- Toggle entre Entrar e Criar conta.
- Campos com label visível:
  - Nome (apenas no signup).
  - Email.
  - Senha (mínimo 8 caracteres, 1 maiúscula, 1 número no signup).
- Link "Esqueci minha senha".
- Hint da senha no signup.
- Checkbox de consentimento LGPD com link pra Política de Privacidade (obrigatório no signup).
- Disclaimer médico no signup: aviso de que Dosy é ferramenta de organização e não substitui prescrição, diagnóstico ou orientação médica.
- Botão principal: Entrar / Criar conta / Enviar link de recuperação.
- Modo demonstração disponível em web sem cadastro.

### Política de Privacidade
Texto institucional LGPD-compliant. Acessível antes do login.

### Termos de Uso
Texto contratual, com disclaimer médico em destaque na seção de limitações.

### Reset Password
Recebida via link enviado por email.
- Campos Nova senha e Confirmar senha.
- Botão Salvar nova senha.

### Install
Landing page institucional pra download web, com CTAs pra Play Store e links pra Termos / Privacidade.

---

## Modais e overlays globais

### Modal de Dose
Abre ao tocar num card de dose na lista. Mostra:
- Medicamento, paciente, horário previsto, horário real, status.
- Botões Tomei agora, Pular, Editar horário (Pro), Desfazer (após ação).
- Histórico recente do mesmo medicamento (5 últimas doses).
- Campo opcional de observação.

### Modal de Múltiplas Doses
Abre via notificação push agrupada (várias doses no mesmo horário). Lista todas e permite confirmar ou pular em lote.

### Modal Filtros
Já descrito em Início.

### Paywall
Aparece ao tentar usar feature Pro sem ter o tier:
- Razão contextual.
- Lista de benefícios do Pro (Pacientes ilimitados, Análises, Relatórios, Compartilhamento).
- Botão Assinar Pro.
- Botão Fechar.

### Compartilhar Paciente (Pro)
- Lista de compartilhamentos atuais (email + permissão + botão revogar).
- Campo pra adicionar email + permissão (visualizar / editar).
- Botão Convidar.

### Confirmação Destrutiva
Aparece em ações como excluir paciente, tratamento ou conta.
- Título e mensagem explicando consequência.
- Botões Cancelar e Confirmar.

### Onboarding Tour
Carousel de 6 slides exibido no primeiro login após signup:
- Slide de boas-vindas.
- Slides apresentando recursos chave (alarme despertador, S.O.S, adesão, compartilhamento).
- Slide final com CTA Começar.
- Opção Pular sempre disponível.

### Permissões do Alarme (Android)
Sheet exibido no primeiro uso pra solicitar 4 permissões especiais necessárias pro alarme estilo despertador funcionar (notificações, alarmes exatos, tela cheia, sobreposição).

---

## Sitemap

```
Início
│
├── Pacientes
│   ├── Novo paciente
│   ├── Detalhe do paciente
│   └── Editar paciente
│
├── + Novo tratamento
├── Editar tratamento
├── Lista de tratamentos
│
├── S.O.S
│
└── Mais
    ├── Histórico
    ├── Tratamentos
    ├── Análises (Pro)
    ├── Relatórios (Pro)
    ├── Ajustes
    ├── Ajuda / FAQ
    └── Painel Admin (Admin)

Não autenticado:
├── Login (Entrar / Criar conta / Esqueci senha)
├── Privacidade
├── Termos
├── Reset Password
├── Install
└── FAQ (também acessível público)
```

---

## User flows principais

### 1. Onboarding (primeiro uso)
Login → cadastro com consent LGPD e disclaimer médico → permissões do alarme (Android) → tour de boas-vindas → Início vazio com guia → cadastrar primeiro paciente → criar primeiro tratamento → primeira dose visível na lista.

### 2. Acompanhamento diário (uso recorrente)
Abre app → Início mostra cards de status e lista de doses agrupadas por paciente → toca numa dose pendente → modal abre → "Tomei agora" → toast de confirmação com opção Desfazer → status atualiza.

Atalho: confirmar direto pelo card sem abrir modal.

### 3. Receber alarme estilo despertador
Hora da dose chega → tela cheia abre (mesmo no silencioso/DND) com som contínuo, vibração, nome do medicamento e paciente → user toca Tomei, Adiar 10 min ou Pular → app registra → status sincroniza no Início.

### 4. Cadastrar dose S.O.S
Bottom nav → S.O.S → preenche paciente, medicamento, dose, horário, observação → Registrar → validação contra regra de segurança → sucesso ou bloqueio com horário da próxima dose permitida.

### 5. Exportar relatório (Pro)
Mais → Relatórios → seleciona paciente e período → Baixar PDF ou CSV → no Android: arquivo gerado e share sheet abre pra enviar via WhatsApp, Email, Drive.

### 6. Compartilhar paciente (Pro)
Detalhe do paciente → Compartilhar → adiciona email do cuidador + permissão → outro user aceita → vê paciente compartilhado → edições aparecem em tempo real pra ambos.

### 7. Recuperação de senha
Login → Esqueci minha senha → digita email → recebe email com link → clica → tela Reset Password → define nova senha → volta pro Login.

### 8. Mudar pra Pro
Tenta ação bloqueada (>1 paciente, Análises, Relatórios, Compartilhar) → Paywall abre → benefícios listados → assina → tier atualizado → recursos desbloqueados em tempo real.
