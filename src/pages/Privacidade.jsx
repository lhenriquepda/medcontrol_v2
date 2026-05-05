import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TIMING, EASE } from '../animations'

export default function Privacidade() {
  const navigate = useNavigate()

  return (
    <motion.div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: TIMING.base, ease: EASE.inOut }}
    >
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
        <p className="text-xs text-slate-400">Última atualização: Maio de 2026 · Versão 1.1</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">1. Quem somos</h2>
          <p>
            O <strong>Dosy</strong> é um aplicativo de gestão de medicamentos operado por <strong>Dosy Med LTDA</strong>,
            sediada no Brasil. Este documento descreve como coletamos, usamos e protegemos
            seus dados pessoais, em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</strong>.
          </p>
          <p className="text-xs text-slate-500">
            Site oficial: <a href="https://dosymed.app" className="text-orange-600 dark:text-orange-400 underline">https://dosymed.app</a> ·
            Contato geral: <a href="mailto:contato@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">contato@dosymed.app</a>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">2. Dados que coletamos</h2>
          <p>Coletamos apenas os dados necessários para o funcionamento do serviço:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Conta:</strong> nome, endereço de e-mail, senha (armazenada com hash bcrypt)</li>
            <li><strong>Pacientes:</strong> nome, idade, condição de saúde, médico responsável, alergias, foto opcional</li>
            <li><strong>Tratamentos e doses:</strong> medicamentos, unidades, horários, status de administração, observações livres</li>
            <li><strong>Notificações push (FCM):</strong> token de dispositivo Firebase, plataforma, idioma, fuso horário</li>
            <li><strong>Dados técnicos:</strong> versão do app, modelo do device (ANR/crash diagnostics), IP de requisição (logs servidor)</li>
            <li><strong>Telemetria anonimizada:</strong> eventos de uso (PostHog) sem PII pra detectar regressão (ex: notification_delivered, signup_completed)</li>
            <li><strong>Erros (Sentry):</strong> stack traces de exceções, sem conteúdo sensível</li>
            <li><strong>Auditoria de segurança:</strong> eventos login, exportação de dados, exclusão de conta, rate-limit triggers</li>
          </ul>
          <p className="text-xs text-slate-500">
            Dados de saúde são considerados <strong>dados sensíveis</strong> (categoria especial, Art. 11 LGPD) e recebem
            proteção adicional via Row-Level Security (RLS) e criptografia em trânsito. O campo "observação" em doses
            é livre — recomendamos não incluir diagnósticos clínicos completos ou identificadores de terceiros.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">3. Como usamos os dados</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Exibir a agenda de medicamentos e alertas de doses</li>
            <li>Enviar notificações push de lembrete (com sua permissão explícita do sistema)</li>
            <li>Disparar alarme nativo Android críticos (categoria Use Specialized Foreground Service: alarmes de medicação)</li>
            <li>Gerar relatórios e histórico de aderência</li>
            <li>Recuperação de senha via código OTP enviado por email (#153)</li>
            <li>Detectar regressão funcional (telemetria de entrega push, crash analytics)</li>
            <li>Garantir segurança (rate-limit, auditoria, defesa contra abuso)</li>
          </ul>
          <p>Não vendemos seus dados pessoais. Não usamos seus dados de saúde para perfilamento, publicidade direcionada ou análise comportamental.</p>
          <p className="text-xs text-slate-500">
            <strong>Anúncios (apenas plano Free):</strong> AdMob banner Android pode exibir anúncios não-personalizados.
            Não compartilhamos dados de saúde com Google AdMob; apenas o request de banner padrão (sem perfil).
          </p>
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
            <li>Dados primários: <strong>Supabase</strong> (Postgres + RLS), região <code>sa-east-1</code> (São Paulo, Brasil)</li>
            <li>Email transactional (recovery, alertas): <strong>Resend</strong> via SMTP (domínio dosymed.app verificado)</li>
            <li>Push notifications: <strong>Firebase Cloud Messaging</strong> (Google) — apenas token + payload mínimo</li>
            <li>Telemetria anônima: <strong>PostHog</strong> (eventos sem PII) e <strong>Sentry</strong> (crash analytics)</li>
            <li>Anúncios (Free): <strong>Google AdMob</strong> banner Android (sem dados de saúde)</li>
            <li>Tokens armazenados em <strong>Android Keystore</strong> (hardware-backed) ou <code>localStorage</code> sandboxed</li>
            <li>Transferência via TLS 1.2+ obrigatório · App lock biométrico opcional (#017)</li>
            <li>Row-Level Security garante isolamento total entre usuários (defesa em profundidade)</li>
            <li>Senhas com bcrypt + mínimo 8 caracteres, complexidade letra+número obrigatória</li>
            <li>Sessão limpa no logout local; tokens revogados server-side via signOut</li>
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
            Para exercer seus direitos LGPD ou esclarecer dúvidas sobre esta política, entre em contato com nosso
            Encarregado de Proteção de Dados (DPO):
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>DPO / Privacidade:</strong> <a href="mailto:privacidade@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">privacidade@dosymed.app</a> (também: <a href="mailto:dpo@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">dpo@dosymed.app</a>)</li>
            <li><strong>Suporte geral:</strong> <a href="mailto:suporte@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">suporte@dosymed.app</a></li>
            <li><strong>Questões legais / DMCA:</strong> <a href="mailto:legal@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">legal@dosymed.app</a></li>
            <li><strong>Vulnerabilidades:</strong> <a href="mailto:security@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">security@dosymed.app</a> (responsible disclosure)</li>
          </ul>
          <p className="text-xs text-slate-500">
            Prazo de resposta: até 15 dias úteis, conforme Art. 18 LGPD. Para vulnerabilidades, prazo de
            confirmação inicial 72h.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">11. Alterações nesta política</h2>
          <p>
            Notificaremos sobre alterações relevantes por e-mail (canal `noreply@dosymed.app`) ou notificação no app
            com pelo menos 15 dias de antecedência. O uso continuado após a notificação constitui aceitação das alterações.
          </p>
        </section>

        <p className="text-xs text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800">
          Dosy Med LTDA · Política de Privacidade v1.1 · Brasil · Atualizada em maio de 2026
        </p>
      </div>
    </motion.div>
  )
}
