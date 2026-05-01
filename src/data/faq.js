/**
 * FAQ — base de perguntas frequentes (FASE 18.5).
 * Estrutura: { id, category, question, answer, keywords }
 *
 * Categorias usadas no UI (mantém ordem):
 *   - 'comeco'    Primeiros passos
 *   - 'alarme'    Alarme & Notificações
 *   - 'permissoes' Permissões Android
 *   - 'doses'     Doses
 *   - 'compartilhar' Compartilhar paciente
 *   - 'plano'     Plano PRO/Plus
 *   - 'privacidade' Privacidade & Dados
 *   - 'sync'      Sincronização & Offline
 *   - 'bugs'      Problemas comuns
 *
 * Respostas em pt-BR, concisas (3-5 linhas), sem aconselhamento médico.
 * Search procura em question + keywords (case-insensitive, sem acento).
 */

export const FAQ_CATEGORIES = [
  { id: 'comeco', label: 'Primeiros passos', icon: 'home' },
  { id: 'alarme', label: 'Alarme & Notificações', icon: 'bell' },
  { id: 'permissoes', label: 'Permissões Android', icon: 'key' },
  { id: 'doses', label: 'Doses', icon: 'pill' },
  { id: 'compartilhar', label: 'Compartilhar paciente', icon: 'users' },
  { id: 'plano', label: 'Plano PRO', icon: 'crown' },
  { id: 'privacidade', label: 'Privacidade & Dados', icon: 'lock' },
  { id: 'sync', label: 'Sincronização & Offline', icon: 'refresh' },
  { id: 'bugs', label: 'Problemas comuns', icon: 'alert' },
]

export const FAQ = [
  // ─── Primeiros passos ───────────────────────────────────────
  {
    id: 'q-cadastrar-paciente',
    category: 'comeco',
    question: 'Como cadastrar meu primeiro paciente?',
    answer:
      'Toque na aba "Pacientes" e depois no botão "+ Novo paciente". Preencha nome, idade e (opcional) condição. Você pode escolher um avatar emoji ou tirar uma foto. No plano grátis você pode ter 1 paciente; no PRO, ilimitados.',
    keywords: ['cadastrar', 'novo', 'criar', 'paciente', 'comecar', 'inicio'],
  },
  {
    id: 'q-criar-tratamento',
    category: 'comeco',
    question: 'Como criar um tratamento?',
    answer:
      'Abra o paciente e toque em "+ Novo tratamento". Informe o nome do remédio, dose, intervalo entre tomadas (ex: 8 em 8 horas), data de início e duração em dias. O Dosy gera todas as doses automaticamente até o fim do tratamento.',
    keywords: ['tratamento', 'remedio', 'medicamento', 'criar', 'agendar'],
  },
  {
    id: 'q-dose-continua',
    category: 'comeco',
    question: 'O que é dose contínua e como funciona?',
    answer:
      'Use "duração contínua" quando o paciente toma o remédio por tempo indeterminado (ex: pressão alta). O Dosy renova as doses semanalmente. Você pode encerrar o tratamento a qualquer momento na tela do tratamento.',
    keywords: ['continua', 'continuo', 'sempre', 'cronico', 'duracao'],
  },
  {
    id: 'q-dashboard',
    category: 'comeco',
    question: 'O que aparece na tela inicial?',
    answer:
      'A Dashboard mostra as doses do dia: pendentes, atrasadas e tomadas. Toque numa dose para confirmar, pular ou registrar dose extra (S.O.S). O cabeçalho exibe taxa de adesão e próxima dose.',
    keywords: ['dashboard', 'inicio', 'home', 'principal', 'doses do dia'],
  },

  // ─── Alarme & Notificações ──────────────────────────────────
  {
    id: 'q-alarme-nao-toca',
    category: 'alarme',
    question: 'Por que o alarme não está tocando?',
    answer:
      'Verifique 3 pontos: (1) "Alarme crítico" ligado em Ajustes; (2) Permissão de notificação concedida ao Dosy; (3) "Alarmes & lembretes" liberado nas configurações Android. Em alguns celulares (Xiaomi, Samsung) também é preciso liberar "iniciar automaticamente" e "executar em segundo plano".',
    keywords: ['alarme', 'nao toca', 'silencio', 'mudo', 'sem som', 'falha'],
  },
  {
    id: 'q-modo-dnd',
    category: 'alarme',
    question: 'O que é o modo Não Perturbe?',
    answer:
      'Em Ajustes você pode definir uma janela diária (ex: 22h às 7h) em que doses não-críticas não tocam som. Doses marcadas como críticas ainda tocam normalmente. Útil pra noites de sono sem perder remédios urgentes.',
    keywords: ['dnd', 'nao perturbe', 'silencio', 'noite', 'dormir', 'modo'],
  },
  {
    id: 'q-tocar-silencioso',
    category: 'alarme',
    question: 'Como o alarme toca mesmo no modo silencioso?',
    answer:
      'Quando "Alarme crítico" está ligado, o Dosy usa um canal de alarme do Android que ignora o silencioso. Você precisa também conceder a permissão "Alarmes e lembretes" pedida no primeiro uso. Sem essa permissão, o som respeita o modo silencioso.',
    keywords: ['silencioso', 'mudo', 'critico', 'tocar', 'volume', 'ignorar'],
  },
  {
    id: 'q-adiar-10min',
    category: 'alarme',
    question: 'Adiar a dose por 10 minutos cria uma dose nova?',
    answer:
      'Não. Adiar reagenda apenas o alerta — a dose original permanece pendente. Após adiar, o alarme volta a tocar 10 minutos depois. Você pode adiar várias vezes se precisar.',
    keywords: ['adiar', 'snooze', '10 min', 'remarcar', 'depois'],
  },
  {
    id: 'q-push-sumiu',
    category: 'alarme',
    question: 'A notificação push sumiu, como reativo?',
    answer:
      'Vá em Ajustes → desligue e religue "Notificações". Se persistir, abra Configurações Android → Apps → Dosy → Notificações e confira se estão liberadas. Reinicie o app para reagendar todos os alarmes.',
    keywords: ['push', 'notificacao', 'sumiu', 'parou', 'reativar'],
  },
  {
    id: 'q-resumo-diario',
    category: 'alarme',
    question: 'O que é o resumo diário?',
    answer:
      'É uma notificação única no horário que você escolher (padrão: 8h) com a lista de doses do dia. Configure em Ajustes → "Resumo diário". Útil pra começar o dia sabendo o que tomar.',
    keywords: ['resumo', 'diario', 'manha', 'lista', 'agenda'],
  },

  // ─── Permissões Android ─────────────────────────────────────
  {
    id: 'q-tantas-permissoes',
    category: 'permissoes',
    question: 'Por que o Dosy precisa de tantas permissões?',
    answer:
      'Cada permissão tem um motivo: Notificações (alertar dose), Alarmes & lembretes (tocar mesmo silencioso), Sobreposição (mostrar tela cheia ao tocar), Bateria sem otimização (não ser morto em background). Sem elas, o alarme pode falhar silenciosamente.',
    keywords: ['permissoes', 'porque', 'tantas', 'privacidade', 'acessos'],
  },
  {
    id: 'q-tela-cheia',
    category: 'permissoes',
    question: 'Como liberar "tela cheia" para o alarme?',
    answer:
      'Configurações Android → Apps → Dosy → "Aparecer sobre outros apps" → ligado. Em alguns celulares aparece como "Pop-ups enquanto outros apps estão em uso" ou "Sobreposição".',
    keywords: ['tela cheia', 'sobreposicao', 'overlay', 'fullscreen'],
  },
  {
    id: 'q-app-nao-abre-update',
    category: 'permissoes',
    question: 'O app não abre direito depois de atualizar — o que faço?',
    answer:
      'Atualizações grandes às vezes resetam permissões críticas. Vá em Ajustes do Dosy → "Permissões" e re-conceda cada uma. Se persistir, desinstale e reinstale o app — seus dados ficam salvos na nuvem.',
    keywords: ['atualizar', 'update', 'nao abre', 'travado', 'erro'],
  },
  {
    id: 'q-bateria-otimizacao',
    category: 'permissoes',
    question: 'Por que desativar otimização de bateria?',
    answer:
      'Android pode "matar" apps em segundo plano para economizar bateria. Se isso acontece com o Dosy, alarmes deixam de tocar. Em Ajustes → Permissões, escolha "Não otimizar" para o Dosy.',
    keywords: ['bateria', 'otimizacao', 'background', 'segundo plano', 'morrer'],
  },

  // ─── Doses ──────────────────────────────────────────────────
  {
    id: 'q-tomada-pular-ignorar',
    category: 'doses',
    question: 'Qual a diferença entre Tomada, Pular e Ignorar?',
    answer:
      '"Tomada" registra que o paciente tomou (conta na adesão). "Pular" marca como não tomada por escolha (ex: contra-indicação, jejum) e não conta como atraso. "Ignorar" só fecha o alerta sem registrar — a dose volta a aparecer atrasada depois.',
    keywords: ['tomada', 'pular', 'ignorar', 'diferenca', 'opcoes', 'dose'],
  },
  {
    id: 'q-dose-sos',
    category: 'doses',
    question: 'Como registrar uma dose extra (S.O.S)?',
    answer:
      'Na aba S.O.S, escolha o paciente e o medicamento. Informe quantos comprimidos e o horário. Doses S.O.S aparecem no histórico marcadas como "extra" e contam para os relatórios.',
    keywords: ['sos', 'extra', 'dor', 'avulsa', 'fora horario', 'urgencia'],
  },
  {
    id: 'q-editar-dose-tomada',
    category: 'doses',
    question: 'Como editar uma dose já tomada?',
    answer:
      'Abra o Histórico, toque na dose desejada e use "Desfazer". A dose volta para pendente — daí você pode marcar de novo (ou registrar atraso correto). Edições ficam registradas.',
    keywords: ['editar', 'desfazer', 'errado', 'historico', 'corrigir'],
  },
  {
    id: 'q-dose-atrasada',
    category: 'doses',
    question: 'Por que aparece "atrasada"?',
    answer:
      'O Dosy considera uma dose atrasada quando passou o horário previsto e ela não foi tomada nem pulada. Você pode confirmar mesmo atrasada — o sistema registra o horário real da tomada.',
    keywords: ['atrasada', 'atraso', 'tarde', 'esqueci', 'passou hora'],
  },
  {
    id: 'q-pular-dose',
    category: 'doses',
    question: 'Posso pular uma dose com segurança?',
    answer:
      'Pular registra que você optou por não tomar. Não substitui orientação médica — em caso de dúvida sobre suspender medicação, fale com o médico responsável. O Dosy não dá conselho clínico.',
    keywords: ['pular', 'nao tomar', 'esquecer', 'seguranca'],
  },

  // ─── Compartilhar paciente ──────────────────────────────────
  {
    id: 'q-compartilhar-cuidador',
    category: 'compartilhar',
    question: 'Como compartilhar um paciente com um cuidador?',
    answer:
      'Recurso disponível no plano PRO. Abra o paciente → "Compartilhar" → digite o e-mail do cuidador. Ele recebe um convite e, ao aceitar, vê as doses e pode confirmar tomadas. Você controla quem tem acesso.',
    keywords: ['compartilhar', 'cuidador', 'familia', 'convite', 'enfermeiro'],
  },
  {
    id: 'q-compartilhar-permissoes',
    category: 'compartilhar',
    question: 'Quem recebe o paciente compartilhado pode editar?',
    answer:
      'Por padrão, cuidadores têm permissão de visualização e confirmação de doses, mas não podem alterar tratamentos nem dados do paciente. Apenas o dono original edita o cadastro.',
    keywords: ['editar', 'permissao', 'cuidador', 'acesso', 'compartilhar'],
  },
  {
    id: 'q-revogar-compartilhamento',
    category: 'compartilhar',
    question: 'Como remover o acesso de um cuidador?',
    answer:
      'Abra o paciente compartilhado → "Compartilhamentos" → remova o cuidador da lista. Ele perde acesso imediatamente e deixa de receber notificações.',
    keywords: ['remover', 'revogar', 'cancelar', 'tirar', 'compartilhar'],
  },

  // ─── Plano PRO/Plus ─────────────────────────────────────────
  {
    id: 'q-pro-features',
    category: 'plano',
    question: 'O que vem no plano PRO?',
    answer:
      'PRO libera: pacientes ilimitados, compartilhamento com cuidadores, relatórios em PDF/CSV, análises de adesão e calendários. O plano grátis mantém o uso essencial pra 1 paciente.',
    keywords: ['pro', 'premium', 'recursos', 'pago', 'beneficios'],
  },
  {
    id: 'q-cancelar-pro',
    category: 'plano',
    question: 'Como cancelo o PRO?',
    answer:
      'Cancele a qualquer momento direto na Play Store: Conta → Pagamentos e assinaturas → Assinaturas → Dosy → Cancelar. Você continua com PRO até o fim do período já pago.',
    keywords: ['cancelar', 'sair', 'desfazer', 'parar', 'pagamento', 'assinatura'],
  },
  {
    id: 'q-trial',
    category: 'plano',
    question: 'Como funciona o trial de 7 dias?',
    answer:
      'Ao assinar PRO pela primeira vez você ganha 7 dias grátis de teste. Cancele dentro desse prazo e nada é cobrado. Se não cancelar, a primeira mensalidade é debitada no 8º dia.',
    keywords: ['trial', 'teste', '7 dias', 'gratis', 'experimental'],
  },
  {
    id: 'q-restaurar-compras',
    category: 'plano',
    question: 'Como restauro a compra após reinstalar?',
    answer:
      'Em Ajustes → "Restaurar compras". O Dosy verifica sua conta Google e reativa o PRO automaticamente — desde que use a mesma conta da compra original.',
    keywords: ['restaurar', 'reinstalar', 'recuperar', 'comprou', 'celular novo'],
  },

  // ─── Privacidade & Dados ────────────────────────────────────
  {
    id: 'q-onde-dados',
    category: 'privacidade',
    question: 'Onde meus dados ficam armazenados?',
    answer:
      'Em servidores Supabase com criptografia em trânsito e em repouso. Dados são privados por padrão — só você vê. A política completa está em Ajustes → "Privacidade".',
    keywords: ['dados', 'onde', 'servidor', 'nuvem', 'armazenamento', 'lgpd'],
  },
  {
    id: 'q-exportar-dados',
    category: 'privacidade',
    question: 'Como exporto meus dados?',
    answer:
      'Em Ajustes → "Exportar meus dados (JSON)". O arquivo contém pacientes, tratamentos, doses e histórico. Use pra backup pessoal ou levar a outro app.',
    keywords: ['exportar', 'baixar', 'json', 'backup', 'levar', 'lgpd'],
  },
  {
    id: 'q-excluir-conta',
    category: 'privacidade',
    question: 'Como excluo minha conta?',
    answer:
      'Em Ajustes → "Excluir minha conta e todos os dados". A ação é irreversível: pacientes, tratamentos, doses e histórico são deletados permanentemente. Faça backup antes (exportar JSON).',
    keywords: ['excluir', 'apagar', 'deletar', 'conta', 'remover', 'lgpd'],
  },
  {
    id: 'q-vê-dados-saude',
    category: 'privacidade',
    question: 'A Dosy lê meus dados de saúde de outros apps?',
    answer:
      'Não. O Dosy só armazena o que você cadastra dentro do app. Não há integração com Google Fit, Samsung Health ou similares. Não acessamos prontuário, exames ou histórico médico externo.',
    keywords: ['saude', 'fit', 'health', 'integra', 'le', 'acessa'],
  },
  {
    id: 'q-conselho-medico',
    category: 'privacidade',
    question: 'O Dosy substitui orientação médica?',
    answer:
      'Não. O Dosy é um lembrete — não diagnostica, não prescreve, não recomenda doses. Sempre siga orientação do médico ou farmacêutico. Em emergência, ligue 192 (SAMU).',
    keywords: ['conselho', 'medico', 'diagnostico', 'prescricao', 'substitui'],
  },

  // ─── Sincronização & Offline ────────────────────────────────
  {
    id: 'q-dois-celulares',
    category: 'sync',
    question: 'Posso usar a Dosy em 2 celulares?',
    answer:
      'Sim. Faça login com a mesma conta nos dois aparelhos — os dados sincronizam automaticamente. Doses confirmadas em um celular aparecem no outro em segundos.',
    keywords: ['dois', 'celulares', 'sincroniza', 'aparelhos', 'tablet'],
  },
  {
    id: 'q-offline',
    category: 'sync',
    question: 'O app funciona sem internet?',
    answer:
      'Alarmes locais funcionam offline — doses tocam normalmente. Mas para sincronizar tomadas, criar pacientes ou ver histórico em outro celular, você precisa conectar à internet.',
    keywords: ['offline', 'sem internet', 'sem conexao', 'avião', 'wifi'],
  },
  {
    id: 'q-update-automatico',
    category: 'sync',
    question: 'O Dosy atualiza sozinho?',
    answer:
      'O app verifica novas versões em segundo plano e mostra um banner "↑ Atualizar". A atualização não é instalada sem sua confirmação. Em caso de crash crítico, recomendamos atualizar imediatamente.',
    keywords: ['atualizar', 'update', 'automatico', 'nova versao'],
  },

  // ─── Bugs comuns ────────────────────────────────────────────
  {
    id: 'q-alarme-2x',
    category: 'bugs',
    question: 'O alarme tocou duas vezes seguidas — bug?',
    answer:
      'Se o som vem do app, normalmente é o "alarme crítico" + "notificação push" disparando juntos. Verifique em Ajustes se há mais de uma fonte ativa. Se persistir, registre via "Falar com suporte" no FAQ.',
    keywords: ['duas vezes', 'duplicado', '2x', 'repetido', 'duplicate'],
  },
  {
    id: 'q-resumo-nao-chegou',
    category: 'bugs',
    question: 'O resumo diário não chegou hoje, e agora?',
    answer:
      'Causas comuns: (1) Celular ficou desligado no horário do resumo; (2) "Otimização de bateria" matou o app; (3) Modo Não Perturbe global do Android estava ativo. Reabra o app — ao iniciar, o Dosy reagenda o próximo resumo.',
    keywords: ['resumo', 'nao chegou', 'sumiu', 'manha', 'falhou'],
  },
  {
    id: 'q-versao-desatualizada',
    category: 'bugs',
    question: 'O app diz "Versão desatualizada"',
    answer:
      'Toque no banner "↑ Atualizar" — você será levado à página de download da versão mais recente. Versões antigas podem ter bugs já corrigidos. Mantenha sempre atualizado.',
    keywords: ['desatualizada', 'antiga', 'velha', 'atualizar', 'versao'],
  },
  {
    id: 'q-relatar-bug',
    category: 'bugs',
    question: 'Como relato um bug?',
    answer:
      'Use o botão "Falar com suporte" no fim da página do FAQ. O e-mail abre pré-preenchido com a versão do app — descreva o que aconteceu, quando e em qual celular. Anexe um print se tiver.',
    keywords: ['bug', 'relatar', 'reportar', 'erro', 'problema', 'suporte'],
  },
]

/**
 * Normaliza string pra busca (lowercase, sem acentos).
 */
export function normalize(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Filtra FAQ por query. Procura em question + keywords + category label.
 */
export function searchFaq(query) {
  const q = normalize(query.trim())
  if (!q) return FAQ
  return FAQ.filter((item) => {
    const haystack = normalize(
      [
        item.question,
        item.answer,
        (item.keywords || []).join(' '),
        FAQ_CATEGORIES.find((c) => c.id === item.category)?.label || '',
      ].join(' ')
    )
    return haystack.includes(q)
  })
}
