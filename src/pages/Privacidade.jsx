import { useNavigate } from 'react-router-dom'

export default function Privacidade() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Voltar"
        >
          ←
        </button>
        <h1 className="font-semibold text-slate-900 dark:text-white">Política de Privacidade</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        <p className="text-xs text-slate-400">Última atualização: Abril de 2026 · Versão 1.0</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">1. Quem somos</h2>
          <p>
            O <strong>Dosy</strong> é um aplicativo de gestão de medicamentos desenvolvido e operado por pessoa física
            (desenvolvedor independente), com sede no Brasil. Este documento descreve como coletamos, usamos e protegemos
            seus dados pessoais, em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">2. Dados que coletamos</h2>
          <p>Coletamos apenas os dados necessários para o funcionamento do serviço:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Conta:</strong> nome, endereço de e-mail, senha (armazenada com hash bcrypt)</li>
            <li><strong>Pacientes:</strong> nome, idade, condição de saúde, médico responsável, alergias</li>
            <li><strong>Tratamentos e doses:</strong> medicamentos, unidades, horários, status de administração</li>
            <li><strong>Notificações push:</strong> endpoint de notificação, chave pública, plataforma do dispositivo</li>
            <li><strong>Dados de uso:</strong> eventos de segurança (login, exportação de dados, exclusão de conta) para auditoria</li>
          </ul>
          <p className="text-xs text-slate-500">
            Dados de saúde são considerados <strong>dados sensíveis</strong> (categoria especial, Art. 11 LGPD) e recebem
            proteção adicional. O campo "observação" nas doses não deve conter diagnósticos clínicos detalhados.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">3. Como usamos os dados</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Exibir a agenda de medicamentos e alertas de doses</li>
            <li>Enviar notificações push de lembrete de dose (apenas com sua permissão)</li>
            <li>Gerar relatórios e histórico de aderência</li>
            <li>Garantir a segurança da conta (eventos de auditoria)</li>
          </ul>
          <p>Não vendemos, compartilhamos nem usamos seus dados para fins de publicidade ou análise comportamental.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">4. Base legal (LGPD, Art. 7 e 11)</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Consentimento explícito</strong> — coletado no cadastro para tratamento de dados de saúde</li>
            <li><strong>Execução de contrato</strong> — necessário para prestar o serviço contratado</li>
            <li><strong>Legítimo interesse</strong> — logs de segurança para proteção da conta</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">5. Seus direitos (LGPD, Art. 18)</h2>
          <p>Você tem direito a:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Acesso:</strong> saber quais dados temos sobre você</li>
            <li><strong>Portabilidade:</strong> exportar todos os seus dados em formato JSON (<em>Ajustes → Exportar meus dados</em>)</li>
            <li><strong>Correção:</strong> atualizar nome, informações de pacientes e tratamentos a qualquer momento</li>
            <li><strong>Exclusão:</strong> deletar sua conta e todos os dados permanentemente (<em>Ajustes → Excluir minha conta</em>)</li>
            <li><strong>Revogação de consentimento:</strong> ao excluir a conta, o consentimento é revogado e os dados removidos</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">6. Armazenamento e segurança</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Dados armazenados na plataforma <strong>Supabase</strong> (infraestrutura em nuvem, servidores nos EUA/UE)</li>
            <li>Transferência internacional com garantias de segurança adequadas (criptografia em trânsito via TLS 1.2+)</li>
            <li>Row-Level Security (RLS) garante isolamento total entre contas</li>
            <li>Senhas armazenadas com bcrypt (hash unidirecional)</li>
            <li>Sessão limpa no logout (dados locais removidos)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">7. Retenção de dados</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Dados ativos: mantidos enquanto a conta estiver ativa</li>
            <li>Logs de auditoria: retidos por até 1 ano (requisito de segurança)</li>
            <li>Observações em doses com mais de 3 anos: anonimizadas automaticamente</li>
            <li>Após exclusão da conta: todos os dados são deletados permanentemente</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">8. Cookies e dados locais</h2>
          <p>
            O app usa <code>localStorage</code> apenas para preferências de interface (tema, configurações de notificação).
            O modo demonstração usa <code>sessionStorage</code>, que é limpo automaticamente ao fechar o navegador.
            Não utilizamos cookies de rastreamento de terceiros.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">9. Menores de idade</h2>
          <p>
            O Dosy pode ser usado para gerenciar medicamentos de menores sob supervisão de um responsável adulto.
            A conta deve ser criada pelo responsável legal. Não coletamos intencionalmente dados de crianças
            sem supervisão parental.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">10. Contato e DPO</h2>
          <p>
            Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:
          </p>
          <p className="font-medium">dosy.privacidade@gmail.com</p>
          <p className="text-xs text-slate-500">
            Prazo de resposta: até 15 dias úteis, conforme Art. 18 da LGPD.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">11. Alterações nesta política</h2>
          <p>
            Notificaremos sobre alterações relevantes por e-mail ou notificação no app com pelo menos 15 dias de antecedência.
            O uso continuado após a notificação constitui aceitação das alterações.
          </p>
        </section>

        <p className="text-xs text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800">
          Dosy · Política de Privacidade v1.0 · Brasil
        </p>
      </div>
    </div>
  )
}
