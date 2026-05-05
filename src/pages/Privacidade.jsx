import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TIMING, EASE } from '../animations'

/**
 * Política de Privacidade Dosy v1.2 (2026-05-05)
 * - LGPD compliance (Lei 13.709/2018) for healthcare-adjacent app
 * - Google Play Health Apps Policy compliance
 * - Sub-processadores explicit listing
 * - Features atualizadas v0.2.0.x: sharing pacientes, biometria, tiers, recovery OTP
 *
 * #156 v0.2.1.0 — bloqueador #130 Closed Testing submit Google review.
 */
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
        <p className="text-xs text-slate-400">Última atualização: Maio de 2026 · Versão 1.3</p>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">1. Identificação do controlador</h2>
          <p>
            <strong>Dosy Med LTDA</strong> ("Dosy", "nós") é o controlador dos dados pessoais tratados
            por meio do aplicativo Dosy (Android) e do site dosymed.app, em conformidade com a
            <strong> Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</strong>.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
            <li>Sede: Brasil</li>
            <li>Site: <a href="https://dosymed.app" className="text-orange-600 dark:text-orange-400 underline">https://dosymed.app</a></li>
            <li>Contato geral: <a href="mailto:contato@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">contato@dosymed.app</a></li>
            <li>Encarregado de Proteção de Dados (DPO): <a href="mailto:privacidade@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">privacidade@dosymed.app</a></li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">2. Categorias de dados coletados</h2>

          <p className="font-medium text-slate-800 dark:text-slate-200">Dados de identificação (não-sensíveis)</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Nome do usuário responsável</li>
            <li>Endereço de e-mail (login + recuperação de senha)</li>
            <li>Senha (armazenada apenas como hash <code>bcrypt</code> — nunca em texto plano)</li>
            <li>Tier de assinatura (Free / PRO / Plus) e histórico de mudanças</li>
          </ul>

          <p className="font-medium text-slate-800 dark:text-slate-200 mt-3">Dados sensíveis de saúde (Art. 5-II + Art. 11 LGPD)</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Pacientes cadastrados: nome, idade, peso, foto opcional, alergias, condição médica, médico responsável, anotações de cuidador</li>
            <li>Tratamentos: medicamentos, dosagem, unidade, frequência, duração, observações livres</li>
            <li>Doses: horário agendado, status (tomada / pulada / atrasada), observação livre da dose</li>
            <li>Dados de SOS (emergência): regras de dose extra, intervalo mínimo, máximo 24h</li>
            <li>Compartilhamento entre usuários: quando você convida outro usuário pra co-gerenciar um paciente, o e-mail do convidado é registrado em <code>patient_shares</code></li>
          </ul>

          <p className="font-medium text-slate-800 dark:text-slate-200 mt-3">Dados técnicos e de uso</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Token de notificação push (FCM): identificador único Firebase Cloud Messaging do dispositivo</li>
            <li>Plataforma do dispositivo (Android / web), versão do app, idioma, fuso horário</li>
            <li>Endereço IP da requisição (logs servidor) e user-agent</li>
            <li>Eventos de auditoria (<code>security_events</code>): login, logout, exportação de dados, exclusão de conta, rate-limit triggers</li>
          </ul>

          <p className="font-medium text-slate-800 dark:text-slate-200 mt-3">Telemetria anônima</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Eventos de produto (PostHog): por exemplo <code>notification_delivered</code>, <code>signup_completed</code>, <code>dose_marked_taken</code> — sem PII</li>
            <li>Stack traces de exceções (Sentry): mensagem de erro, linha de código, modelo do device — sem conteúdo sensível</li>
          </ul>

          <p className="text-xs text-slate-500">
            Dados de saúde recebem proteção adicional via Row-Level Security (RLS) Postgres + criptografia em trânsito.
            O campo "observação" em doses/tratamentos é livre — recomendamos não incluir diagnósticos clínicos completos
            ou identificadores de terceiros (CPF, número de prontuário).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">3. Finalidades e bases legais</h2>
          <p>Cada dado é tratado com finalidade específica e base legal LGPD definida:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Lembrete de medicação</strong> (alarme push + nativo): Art. 7-V (execução de contrato) + Art. 11-II-f (cuidado em saúde)</li>
            <li><strong>Compartilhamento entre usuários</strong>: Art. 7-I (consentimento explícito ao convidar)</li>
            <li><strong>Recuperação de senha via OTP</strong>: Art. 7-V (execução de contrato)</li>
            <li><strong>Histórico e relatórios</strong>: Art. 7-V + Art. 11-II-f</li>
            <li><strong>Auditoria e segurança</strong>: Art. 7-IX (legítimo interesse — proteção contra fraude/abuso)</li>
            <li><strong>Telemetria anônima</strong>: Art. 7-IX (legítimo interesse — detectar regressão de funcionalidade crítica)</li>
            <li><strong>Anúncios não-personalizados (Free)</strong>: Art. 7-IX (legítimo interesse — sustentar plano gratuito)</li>
          </ul>
          <p>
            <strong>Não fazemos</strong>: venda de dados pessoais, uso de dados de saúde para perfilamento publicitário,
            análise comportamental, decisões automatizadas com efeito jurídico, scoring de saúde, compartilhamento com
            seguradoras, planos ou empregadores.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">4. Sub-processadores (terceiros que processam dados)</h2>
          <p>
            Para operar o serviço, contratamos sub-processadores que cumprem suas próprias políticas de segurança.
            Lista atualizada:
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-300 dark:border-slate-700">
                <th className="text-left py-1 pr-2">Provedor</th>
                <th className="text-left py-1 pr-2">Finalidade</th>
                <th className="text-left py-1">Região / Adequação</th>
              </tr>
            </thead>
            <tbody className="text-slate-600 dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-800"><td className="py-1 pr-2">Supabase Inc.</td><td className="py-1 pr-2">DB Postgres + Auth + Storage + Realtime + Edge Functions</td><td className="py-1">São Paulo (sa-east-1) — BR</td></tr>
              <tr className="border-b border-slate-200 dark:border-slate-800"><td className="py-1 pr-2">Google LLC (Firebase)</td><td className="py-1 pr-2">Push notifications (FCM)</td><td className="py-1">EUA — Cláusulas-padrão LGPD</td></tr>
              <tr className="border-b border-slate-200 dark:border-slate-800"><td className="py-1 pr-2">Google LLC (AdMob)</td><td className="py-1 pr-2">Anúncios não-personalizados (apenas Free)</td><td className="py-1">EUA — Cláusulas-padrão LGPD</td></tr>
              <tr className="border-b border-slate-200 dark:border-slate-800"><td className="py-1 pr-2">Google LLC (Play Billing)</td><td className="py-1 pr-2">Processamento de assinaturas (PRO/Plus)</td><td className="py-1">EUA — Cláusulas-padrão LGPD</td></tr>
              <tr className="border-b border-slate-200 dark:border-slate-800"><td className="py-1 pr-2">Resend Inc.</td><td className="py-1 pr-2">Email transactional (recovery, alertas)</td><td className="py-1">EUA — Cláusulas-padrão LGPD</td></tr>
              <tr className="border-b border-slate-200 dark:border-slate-800"><td className="py-1 pr-2">PostHog Inc.</td><td className="py-1 pr-2">Telemetria anônima de uso</td><td className="py-1">EUA — Cláusulas-padrão LGPD</td></tr>
              <tr className="border-b border-slate-200 dark:border-slate-800"><td className="py-1 pr-2">Functional Software Inc. (Sentry)</td><td className="py-1 pr-2">Crash analytics</td><td className="py-1">EUA — Cláusulas-padrão LGPD</td></tr>
              <tr className="border-b border-slate-200 dark:border-slate-800"><td className="py-1 pr-2">Vercel Inc.</td><td className="py-1 pr-2">Hospedagem web + edge logs</td><td className="py-1">EUA — Cláusulas-padrão LGPD</td></tr>
              <tr className="border-b border-slate-200 dark:border-slate-800"><td className="py-1 pr-2">Hostinger International Ltd.</td><td className="py-1 pr-2">DNS do domínio dosymed.app</td><td className="py-1">EU/Lituânia — GDPR</td></tr>
              <tr><td className="py-1 pr-2">ImprovMX</td><td className="py-1 pr-2">Forward de e-mails inbound</td><td className="py-1">EUA — Cláusulas-padrão LGPD</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-slate-500">
            Quando há transferência internacional de dados, exigimos garantias adequadas (cláusulas contratuais padrão,
            certificações ou regulamentos equivalentes), conforme Art. 33-V LGPD.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">5. Seus direitos LGPD (Art. 18)</h2>
          <p>Você pode exercer os seguintes direitos a qualquer momento via <a href="mailto:privacidade@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">privacidade@dosymed.app</a>:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Confirmação</strong> da existência de tratamento dos seus dados</li>
            <li><strong>Acesso</strong> aos seus dados (também disponível via Ajustes → Exportar meus dados)</li>
            <li><strong>Correção</strong> de dados incompletos, inexatos ou desatualizados</li>
            <li><strong>Anonimização ou bloqueio</strong> de dados desnecessários ou tratados em desconformidade</li>
            <li><strong>Eliminação</strong> dos dados tratados com seu consentimento (Ajustes → Excluir minha conta)</li>
            <li><strong>Portabilidade</strong> em formato JSON estruturado</li>
            <li><strong>Informação</strong> sobre entidades públicas e privadas com quem compartilhamos dados (lista §4)</li>
            <li><strong>Revogação do consentimento</strong> a qualquer momento (excluir conta = revoga)</li>
            <li><strong>Oposição</strong> a tratamento baseado em legítimo interesse</li>
            <li><strong>Reclamação</strong> à Autoridade Nacional de Proteção de Dados (ANPD) — <a href="https://www.gov.br/anpd" className="text-orange-600 dark:text-orange-400 underline">gov.br/anpd</a></li>
          </ul>
          <p className="text-xs text-slate-500">
            Prazo de resposta: até 15 dias corridos (Art. 19 LGPD). Para acesso e portabilidade, formato eletrônico
            estruturado e interoperável.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">6. Segurança técnica e organizacional</h2>
          <p>Medidas de segurança implementadas:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Criptografia em trânsito</strong>: TLS 1.2+ obrigatório em todas as conexões (HTTPS strict)</li>
            <li><strong>Criptografia em repouso</strong>: dados Supabase criptografados via AES-256 (server-side encryption)</li>
            <li><strong>Row-Level Security (RLS)</strong>: cada usuário só acessa seus próprios pacientes/doses (defense-in-depth)</li>
            <li><strong>Senhas</strong>: bcrypt + mínimo 8 caracteres + complexidade letra maiúscula+minúscula+dígito obrigatória</li>
            <li><strong>App Lock biométrico</strong> (opcional): impressão digital ou senha do dispositivo bloqueia abertura do app</li>
            <li><strong>Tokens em Android Keychain</strong>: hardware-backed quando disponível</li>
            <li><strong>Rate-limiting</strong>: proteção contra brute-force de login e abuso de RPCs</li>
            <li><strong>Auditoria</strong>: logs de eventos sensíveis (login, exclusão, exportação) retidos por 1 ano</li>
            <li><strong>JWT secret rotation</strong>: procedimento documentado para rotação imediata em caso de comprometimento</li>
            <li><strong>Backup diário</strong>: 7 snapshots Supabase (RPO 24h, RTO 5-15min) — runbook em <code>docs/runbook-dr.md</code></li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">7. Retenção de dados</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Conta ativa</strong>: dados mantidos enquanto a conta existir</li>
            <li><strong>Logs de auditoria</strong>: 1 ano (requisito de segurança)</li>
            <li><strong>Observações em doses antigas</strong> (&gt; 3 anos): anonimização automática (texto removido, mantém status)</li>
            <li><strong>Backups</strong>: 7 dias rolling (daily snapshot)</li>
            <li><strong>Após exclusão da conta</strong>: dados removidos do banco principal em &lt; 30 dias; backups expurgados em até 7 dias adicionais (rotação)</li>
            <li><strong>FCM tokens revogados</strong>: limpeza automática semanal de tokens inválidos</li>
            <li><strong>Compartilhamentos pendentes</strong>: deletados se não aceitos em 30 dias</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">8. Cookies e armazenamento local</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>localStorage</strong>: preferências de UI (tema, idioma, último filtro), cache de tier, fotos de pacientes (cache cliente)</li>
            <li><strong>Android Keystore</strong>: tokens de autenticação (hardware-backed quando disponível)</li>
            <li><strong>sessionStorage</strong>: modo demonstração apenas (limpo ao fechar)</li>
            <li><strong>Cookies de terceiros</strong>: nenhum (não usamos cookies de tracking)</li>
            <li><strong>IndexedDB</strong>: cache offline de doses recentes (PWA)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">9. Idade mínima e uso por adultos</h2>
          <p>
            Idade mínima para criar conta no Dosy: <strong>18 anos</strong>. O app é projetado para uso por
            <strong> adultos responsáveis</strong> (autocuidado de medicação) e por <strong>cuidadores</strong> adultos
            (filhos de idosos, pais responsáveis pela medicação de menores, profissionais de cuidado).
          </p>
          <p>
            <strong>Pacientes menores</strong> podem ser cadastrados como dependentes pelo responsável legal adulto que
            criou a conta — nesse caso, o adulto é o titular dos dados perante a LGPD e responde pelo consentimento
            (Art. 14 LGPD aplicável aos dados do menor sob sua tutela).
          </p>
          <p>
            <strong>Não coletamos intencionalmente</strong> dados de menores criando contas próprias. Caso identifiquemos
            cadastro feito por menor de 18 anos sem responsável, a conta é desabilitada e os dados eliminados.
          </p>
          <p className="text-xs text-slate-500">
            Reportes de cadastro indevido por menor: <a href="mailto:privacidade@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">privacidade@dosymed.app</a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">10. Decisões automatizadas</h2>
          <p>
            O Dosy <strong>não realiza</strong> decisões automatizadas com efeito jurídico (Art. 20 LGPD).
            Não há scoring de saúde, perfilamento médico, IA diagnóstica, recomendações automáticas de medicação
            ou tratamento. Toda interpretação clínica é responsabilidade do usuário e/ou seu profissional de saúde.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">11. Compliance Google Play Health Apps Policy</h2>
          <p>
            O Dosy está classificado como aplicativo de <strong>Saúde e fitness</strong> no Google Play e segue a
            <a href="https://support.google.com/googleplay/android-developer/answer/13316080" className="text-orange-600 dark:text-orange-400 underline"> Health Apps policy</a>:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>✅ Política de privacidade explícita (este documento)</li>
            <li>✅ Coleta limitada ao necessário para a finalidade declarada</li>
            <li>✅ Criptografia em trânsito e em repouso</li>
            <li>✅ Não compartilhamento com seguradoras, anunciantes de saúde ou empregadores</li>
            <li>✅ Anúncios apenas <strong>não-personalizados</strong> e nunca usando dados de saúde</li>
            <li>✅ Mecanismo de exclusão de conta acessível ao usuário</li>
            <li>✅ Foreground Service Special Use (alarmes de medicação) declarado e justificado em Console</li>
            <li>✅ Sem transferência de dados de saúde para fins comerciais não declarados</li>
            <li>✅ Disclaimer médico claro: o Dosy <strong>não substitui orientação médica</strong></li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">12. Notificação de incidentes</h2>
          <p>
            Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares,
            comunicaremos:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>ANPD</strong>: notificação em prazo razoável conforme Art. 48 LGPD (referência operacional: 72h)</li>
            <li><strong>Titulares afetados</strong>: e-mail ao endereço cadastrado + notificação no app</li>
            <li><strong>Conteúdo da notificação</strong>: natureza, dados afetados, riscos, medidas adotadas, contato DPO</li>
          </ul>
          <p className="text-xs text-slate-500">Procedimento operacional documentado em runbook interno (<code>docs/runbook-dr.md</code>).</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">13. Canais de contato</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>DPO / Privacidade / LGPD</strong>: <a href="mailto:privacidade@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">privacidade@dosymed.app</a> (ou <a href="mailto:dpo@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">dpo@dosymed.app</a>)</li>
            <li><strong>Suporte ao usuário</strong>: <a href="mailto:suporte@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">suporte@dosymed.app</a></li>
            <li><strong>Questões legais / DMCA</strong>: <a href="mailto:legal@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">legal@dosymed.app</a></li>
            <li><strong>Vulnerabilidades de segurança</strong>: <a href="mailto:security@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">security@dosymed.app</a> (responsible disclosure — confirmação inicial 72h)</li>
            <li><strong>Contato geral / imprensa</strong>: <a href="mailto:contato@dosymed.app" className="text-orange-600 dark:text-orange-400 underline">contato@dosymed.app</a></li>
          </ul>
          <p className="text-xs text-slate-500">
            Site oficial: <a href="https://dosymed.app" className="text-orange-600 dark:text-orange-400 underline">https://dosymed.app</a>
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">14. Alterações</h2>
          <p>
            Notificaremos sobre alterações relevantes por e-mail (canal <code>noreply@dosymed.app</code>) e/ou notificação
            no app com pelo menos 15 dias de antecedência. O uso continuado após a notificação constitui ciência das
            alterações. Histórico de versões disponível abaixo.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-base text-slate-900 dark:text-white">15. Histórico de versões</h2>
          <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
            <li><strong>v1.3</strong> (2026-05-05) — Idade mínima 13+ → 18+ (alinhamento Play Console público-alvo). Reescrita §9 cobre uso por adultos/cuidadores + responsável legal pra pacientes menores como dependentes</li>
            <li><strong>v1.2</strong> (2026-05-05) — Sub-processadores explícitos, compliance Google Play Health Apps Policy (categoria Saúde e fitness), notificação ANPD, decisões automatizadas, recovery OTP, biometria, sharing pacientes, tier system</li>
            <li><strong>v1.1</strong> (2026-05-05) — Atualização Resend SMTP + AdMob + Sentry + PostHog + entidade Dosy Med LTDA + emails canônicos @dosymed.app</li>
            <li><strong>v1.0</strong> (2026-04) — Versão inicial</li>
          </ul>
        </section>

        <p className="text-xs text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800">
          Dosy Med LTDA · Política de Privacidade v1.3 · Brasil · Atualizada em maio de 2026 · DPO <a href="mailto:privacidade@dosymed.app" className="underline">privacidade@dosymed.app</a>
        </p>
      </div>
    </motion.div>
  )
}
