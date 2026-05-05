import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TIMING, EASE } from '../animations'
import Icon from '../components/Icon'

export default function Termos() {
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
        <h1 className="font-semibold text-slate-900 dark:text-white">Termos de Uso</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        <p className="text-xs text-slate-400">Última atualização: Abril de 2026 · Versão 1.0</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">1. Aceitação dos Termos</h2>
          <p>
            Ao criar uma conta ou usar o <strong>Dosy</strong>, você concorda com estes Termos de Uso.
            Se não concordar, não use o serviço. Para menores de 18 anos, o uso requer autorização do responsável legal.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">2. Descrição do serviço</h2>
          <p>
            O Dosy é um aplicativo de <strong>gestão e lembrete de medicamentos</strong>. Ele permite:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Cadastrar pacientes e tratamentos medicamentosos</li>
            <li>Registrar a administração de doses</li>
            <li>Receber lembretes de dose via notificações push</li>
            <li>Visualizar histórico e relatórios de aderência</li>
            <li>Registrar doses SOS (medicamentos de uso esporádico)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">3. Aviso médico importante</h2>
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1.5"><Icon name="warning" size={16} /> O Dosy NÃO é um dispositivo médico</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-amber-700 dark:text-amber-400">
              <li>Não substitui prescrição ou orientação médica</li>
              <li>Não realiza diagnósticos nem recomenda tratamentos</li>
              <li>Erros de dosagem são de responsabilidade do usuário</li>
              <li>Em caso de emergência médica, ligue para o SAMU (192) ou Bombeiros (193)</li>
            </ul>
          </div>
          <p>
            Sempre siga as orientações do médico responsável. O Dosy é uma ferramenta de organização,
            não uma fonte de orientação clínica.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">4. Responsabilidades do usuário</h2>
          <p>Ao usar o Dosy, você se compromete a:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Fornecer informações verdadeiras no cadastro</li>
            <li>Manter sua senha segura e não compartilhá-la</li>
            <li>Usar o serviço apenas para fins lícitos e pessoais</li>
            <li>Não tentar acessar dados de outros usuários</li>
            <li>Não realizar engenharia reversa ou testes de invasão sem autorização</li>
            <li>Verificar as doses registradas com o profissional de saúde responsável</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">5. Planos e assinaturas</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Plano Gratuito:</strong> 1 paciente, funcionalidades básicas</li>
            <li><strong>Plano PRO:</strong> pacientes ilimitados, funcionalidades completas</li>
            <li>Preços e condições do PRO são exibidos no momento da compra</li>
            <li>Assinaturas são gerenciadas pela Google Play Store (Android) ou diretamente no app</li>
            <li>Reembolsos seguem a política da plataforma de pagamento utilizada</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">6. Disponibilidade do serviço</h2>
          <p>
            O Dosy é fornecido "como está" (<em>as-is</em>). Não garantimos disponibilidade ininterrupta.
            Manutenções programadas serão comunicadas com antecedência sempre que possível.
            Não somos responsáveis por perdas decorrentes de indisponibilidade do serviço.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">7. Limitação de responsabilidade</h2>
          <p>
            Na máxima extensão permitida pela lei brasileira, o Dosy e seus desenvolvedores não se responsabilizam por:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Danos decorrentes do uso incorreto do aplicativo</li>
            <li>Erros de dosagem não detectados pelo app</li>
            <li>Perda de dados por falha de dispositivo ou conectividade</li>
            <li>Decisões médicas tomadas com base nos dados do app</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">8. Propriedade intelectual</h2>
          <p>
            O código, design, marca e conteúdo do Dosy são de propriedade exclusiva do desenvolvedor.
            É proibida a reprodução, cópia ou distribuição sem autorização expressa por escrito.
            Os dados inseridos pelo usuário permanecem de sua propriedade.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">9. Rescisão</h2>
          <p>
            Você pode encerrar sua conta a qualquer momento em <em>Ajustes → Excluir minha conta</em>.
            Reservamos o direito de suspender ou encerrar contas que violem estes termos, com aviso prévio
            exceto em casos de violação grave de segurança.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">10. Lei aplicável e foro</h2>
          <p>
            Estes termos são regidos pelas leis da República Federativa do Brasil.
            Para resolução de disputas, fica eleito o foro da comarca de São Paulo/SP,
            salvo disposição legal em contrário para consumidores (Código de Defesa do Consumidor).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">11. Contato</h2>
          <p>Dúvidas sobre estes termos:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Geral: <a href="mailto:contato@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">contato@dosymed.app</a></li>
            <li>Jurídico: <a href="mailto:legal@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">legal@dosymed.app</a></li>
            <li>Privacidade / DPO: <a href="mailto:privacidade@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">privacidade@dosymed.app</a></li>
          </ul>
        </section>

        <p className="text-xs text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800">
          Dosy Med LTDA · Termos de Uso v1.1 · Brasil · Atualizado em maio de 2026
        </p>
      </div>
    </motion.div>
  )
}
