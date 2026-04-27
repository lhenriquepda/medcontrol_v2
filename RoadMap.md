# Dosy — Roadmap de Evolução

> **Visão:** Tornar o Dosy o assistente de saúde familiar mais intuitivo e seguro do Brasil, combinando UX moderno, alarmes confiáveis e privacidade total dos dados.

> **Como usar este documento:** prioridades P0 (próximas 4-8 semanas pós-launch) → P3 (visão 18+ meses). Cada item tem escopo, justificativa e estimativa. Releitura recomendada a cada 2 sprints (~1 mês) para reordenar conforme feedback dos usuários.

---

## 🎯 P0 — Pós-launch imediato (4-8 semanas)

*Foco: estabilizar versão 1.0, capturar feedback, corrigir bugs reais.*

### P0.1 — Telemetria de produto (Android Vitals + Sentry)
- **Por quê:** sem dados, otimização é palpite.
- **O que:** monitorar diariamente Android Vitals (crashes, ANRs, battery drain) + Sentry (erros JS).
- **Métricas-alvo:** crash-free rate ≥ 99,5%; ANR rate ≤ 0,47%.
- **Esforço:** Sentry já integrado. Configurar dashboard alerts (Slack/email) — 1 dia.

### P0.2 — Gestão de Estoque (Pharmacy Stock)
- **Por quê:** maior pedido recorrente em apps similares (Medisafe, MyTherapy).
- **O que:** campo `stock_quantity` em `treatments`. Subtrai automaticamente em `confirm_dose`. Notif quando estoque ≤ 3 doses ("Comprar Aerolin — restam 2 doses").
- **Schema:** `ALTER TABLE treatments ADD COLUMN stock_quantity int, refill_threshold int DEFAULT 3`.
- **Esforço:** 2-3 dias (UI + RPC update + notif logic).

### P0.3 — Ações rápidas na notificação
- **Por quê:** reduz fricção 80% — user marca "Tomada" sem abrir app.
- **O que:** botões inline na heads-up notif Android (`addAction(Tomada)`, `addAction(Adiar 15min)`). Tap action chama RPC direto (PendingIntent → Receiver → Supabase via app process).
- **iOS futuro:** `UNNotificationAction` equivalente.
- **Esforço:** 2 dias (Java NotificationCompat.Action + handler Receiver + JS bridge).

### P0.4 — Onboarding interativo (primeira vez)
- **Por quê:** usuários abandonam apps sem tutorial em 30s.
- **O que:** 3 telas swipe na primeira abertura: "Cadastre paciente" → "Crie tratamento" → "Permita alarme + notif". Skipável.
- **Bonus:** detectar permissões faltando (`USE_FULL_SCREEN_INTENT`, `SYSTEM_ALERT_WINDOW`, `POST_NOTIFICATIONS`) e direcionar Settings.
- **Esforço:** 2 dias (componente carrossel + permission requesters).

### P0.5 — Suporte ao usuário in-app
- **Por quê:** reviews 1-estrela são frequentemente bugs com workarounds simples. Canal direto previne.
- **O que:** botão "Falar com suporte" em Settings → abre email pré-preenchido com info do device (versão app, Android version, user UUID anônimo). Opcional: integrar Intercom ou Crisp se justificar custo.
- **Esforço:** 1 dia (mailto template) ou 3 dias (chat widget).

### P0.6 — Política de versão mínima (force update)
- **Por quê:** versões antigas com bugs LGPD ou segurança não devem rodar em produção.
- **O que:** Supabase RPC `min_app_version()` retorna semver string. App ao iniciar compara com `versionName` do `BuildConfig`. Se outdated → modal forçando update.
- **Esforço:** 1 dia.

---

## 📈 P1 — Retenção e engajamento (3-6 meses)

*Foco: usuários voltam diariamente e renovam PRO.*

### P1.1 — Gamificação leve (Streaks de adesão)
- **Por quê:** mecânica comprovada (Duolingo, Strava). Aumenta retenção 30 dias em 40-60%.
- **O que:** "Streak atual: 7 dias 100% de adesão" no Dashboard. Badge ao bater 7/30/100/365 dias. Notif celebrativa.
- **Cuidado:** não ser invasivo em apps de saúde (alguns users ficam ansiosos ao "perder streak"). Toggle opt-in em Settings.
- **Esforço:** 3-4 dias (cálculo streak + UI + assets badges).

### P1.2 — Compartilhamento Familiar Avançado (Dosy Family)
- **Por quê:** caso de uso #1 — cuidadores cuidando de pais idosos. Já temos `patient_shares` table, falta UX completo.
- **O que:**
  - Convite por email/SMS/QR code
  - Notificação push pra cuidador secundário quando dose tomada/atrasada
  - Permissões granulares: somente leitura vs editar tratamentos vs aceitar dose
  - Atividade compartilhada: "Maria tomou Losartana às 8h" no feed do filho
- **Schema:** já tem `patient_shares`, adicionar `permissions JSONB` + `activity_log` table.
- **Esforço:** 5-7 dias.

### P1.3 — Calendário externo (Google Calendar / iCal)
- **Por quê:** visão da rotina fora do app. Útil pra coordenar com agenda médica.
- **O que:** botão "Sincronizar com Google Calendar" em Settings. OAuth Google → Calendar API → criar eventos recorrentes. Opcional: gerar `.ics` exportável (mais simples, sem OAuth).
- **Início:** começar com `.ics` export (1 dia). Depois OAuth Google Calendar (3-4 dias).

### P1.4 — Widgets tela inicial Android
- **Por quê:** reduz fricção a zero — próxima dose visível sem abrir app.
- **O que:** widget Android nativo 4x1 / 2x2 mostrando "Próxima dose: Losartana às 14h" + botão Tomada. Implementar em Java + Capacitor bridge.
- **Esforço:** 4-5 dias (widget Java + RemoteViews + Receiver + intent handler).

### P1.5 — Analytics avançado (PRO)
- **Por quê:** diferencial vs apps gratuitos. Gráficos vendem PRO.
- **O que:**
  - Heatmap de adesão (matriz semana × hora) — identificar horários problema
  - Gráfico tendência adesão últimos 30/90 dias
  - Comparação entre pacientes
  - Insights automáticos: "Você esquece mais doses às quartas-feiras à noite"
- **Esforço:** 5-7 dias (recharts/visx + agregação SQL).

### P1.6 — Multi-idioma (i18n)
- **Por quê:** abrir mercado pra Portugal + países lusófonos (Angola, Moçambique). Espanhol abre LATAM.
- **O que:** `react-i18next` setup. Português BR/PT, Espanhol, Inglês.
- **Esforço:** 4-5 dias (extrair strings + tradução + RTL future-proof).

### P1.7 — Modo cuidador profissional (B2B)
- **Por quê:** lar de idosos / cuidadores domiciliares são clientes premium dispostos a pagar.
- **O que:** plano `caregiver` acima de PRO. Limite alto de pacientes (10+), relatórios consolidados, compliance HIPAA-like.
- **Esforço:** 7-10 dias (tier + UI + relatórios agregados).

---

## 🎨 P2 — Diferenciação competitiva (6-12 meses)

*Foco: features que competidores não têm, justificam preço PRO premium.*

### P2.1 — Dosy AI (Assistente de Saúde Local)
- **Por quê:** AI é vetor diferenciação 2026-2027. Privacidade local = LGPD compliant.
- **O que:**
  - Câmera escaneia receita médica → OCR → preenche tratamento automaticamente (Tesseract.js ou Google ML Kit)
  - Chat sobre bulas/interações: "Posso tomar Aerolin com Clavulin?" → modelo local responde com fontes
  - LLM local (Phi-3-mini ou Gemma 2B via MLC LLM) — zero envio de dados PII pra cloud
- **Risco regulatório:** AI dando conselho médico = ANVISA pode exigir registro. Disclaimer legal necessário.
- **Esforço:** 15-25 dias (prova-de-conceito) + parecer jurídico.

### P2.2 — Suporte a Wearables (Wear OS / Apple Watch)
- **Por quê:** UX premium — confirmar dose girando pulso, sem celular.
- **O que:** mini-app Wear OS (Kotlin). Notif espelhada do celular com botão Tomada. Apple Watch versão extension WatchKit.
- **Esforço:** 10-15 dias por plataforma.

### P2.3 — Modo Direção (Android Auto / CarPlay)
- **Por quê:** segurança — alarmes simplificados no painel quando dirigindo.
- **O que:** integração Android Auto Driver Distraction Guidelines. Áudio TTS "É hora da Losartana", botão grande Tomada/Adiar no painel.
- **Esforço:** 5-7 dias Android Auto + 5-7 dias CarPlay.

### P2.4 — Receitas com gráficos de tendência (Relatórios PRO 2.0)
- **Por quê:** médicos amam dados. Pacientes com bons dados ganham consulta melhor.
- **O que:** PDF avançado com gráficos de:
  - Adesão por medicamento ao longo do tempo
  - Pressão arterial / glicemia / peso (se user inserir manualmente)
  - Eventos adversos reportados
- Botão "Enviar via WhatsApp ao Dr. José" diretamente do app.
- **Esforço:** 5-7 dias.

### P2.5 — Lembretes inteligentes (ML)
- **Por quê:** alarmes fixos perdem efetividade com tempo (banner blindness).
- **O que:** ML local detecta padrões "user esquece mais às quartas 22h" → ajusta antecedência automaticamente. Notif diferente em horários de risco.
- **Esforço:** 10-15 dias (modelo simples de classificação + tuning UX).

### P2.6 — Integração Google Fit / Apple Health / Saúde Caixa
- **Por quê:** ecossistema saúde — dose registrada no Dosy aparece no Google Fit timeline.
- **O que:** export bidirecional. Healthcare data já normalizado.
- **Esforço:** 5-7 dias por plataforma.

### P2.7 — Personalização visual avançada
- **O que:**
  - Acentos de cor (12 paletas — Azul Saúde, Verde, Rosa, Roxo, etc)
  - Densidade de UI (compacto/normal/relaxado)
  - Fontes (Sans-serif, Dyslexia-friendly OpenDyslexic)
  - Modo Alto Contraste (acessibilidade visual)
- **Esforço:** 4-6 dias.

### P2.8 — Acessibilidade completa (WCAG AA)
- **Por quê:** público idoso/deficiência visual é alvo natural. Conformidade Lei Brasileira de Inclusão.
- **O que:**
  - TalkBack/VoiceOver labels em 100% UI
  - Contraste AA mínimo
  - Tamanhos de toque ≥ 48dp
  - Suporte a leitores de tela em modal queue + alarme fullscreen
- **Esforço:** 5-7 dias audit + correções.

### P2.9 — Transições fluidas (Native-feel)
- **O que:** Framer Motion / native shared element transitions entre telas. Skeleton screens otimizados. Tactile feedback (Haptics API).
- **Esforço:** 4-5 dias.

---

## 🌐 P3 — Expansão de plataforma (12-18+ meses)

*Foco: ampliar alcance após product-market fit no Android.*

### P3.1 — Port para iOS (App Store)
- **Pré-requisito:** receita PRO Android cobrindo USD 99/ano Apple + Mac cloud.
- **Codebase reaproveitável 100%:** React/Capacitor/Supabase/RPCs/LGPD pages — zero refactor.

**Trabalho real:**

1. **Plugin CriticalAlarm Swift** (`com.dosyapp.dosy.plugins.criticalalarm`):
   - `UNUserNotificationCenter` + `UNCalendarNotificationTrigger`
   - Sem fullscreen alarm UI (iOS proíbe activity launch background)
   - Som loop via `UNNotificationSound.criticalSoundNamed` + `.caf`
   - **Critical Alerts entitlement** — request developer.apple.com (semanas)
   - Resultado: notif persistente alta prioridade que ignora silencioso/Focus
2. **APNs:** upload key no Firebase Console (FCM HTTP v1 já suporta tokens iOS — Edge Function zero mudança)
3. **StoreKit:** RevenueCat suporta nativamente — JS idêntico. Produtos no App Store Connect
4. **SSL Pinning iOS:** `URLSessionDelegate` custom
5. **Asset Catalog Xcode:** ícones/launch screens (`npx @capacitor/assets generate --ios`)
6. **CI/CD:** Mac cloud + workflow `ios-release.yml`

**Custos:**
| Item | Custo |
|---|---|
| Apple Developer Program | USD 99/ano |
| Mac cloud build | ~USD 30-50/mês |
| Critical Alerts entitlement | Grátis (aprovação manual Apple) |
| Tempo dev porte alarme | ~2-3 dias |

**Limitações iOS:**
- Sem fullscreen alarm UI (substitui por Critical Alert persistente)
- 64 notif pending limit por app (vs ilimitado Android)
- Aprovação App Store: revisão manual 1-7 dias por release

**Estimativa total:** 5-8 dias dev + tempo Apple (entitlement + review).

### P3.2 — PWA polida (web app)
- **Por quê:** alcance sem instalação. Funciona em desktop, iOS sem App Store.
- **O que:** já é PWA. Polir manifest, install prompts, offline shell, share target API.
- **Esforço:** 2-3 dias.

### P3.3 — Versão desktop (Tauri / Electron)
- **Por quê:** cuidadores em desktop trabalho. Vantagem: tela maior pra dashboard multi-paciente.
- **O que:** Tauri (mais leve que Electron) wrap do mesmo build web.
- **Esforço:** 3-5 dias.

### P3.4 — API pública para integrações
- **Por quê:** healthtech ecosystem — apps de pressão arterial, glicosímetros, smartwatches conectarem ao Dosy.
- **O que:** REST API documentada (OpenAPI), OAuth 2.0, rate limiting, webhooks.
- **Esforço:** 7-10 dias + parecer jurídico LGPD para data sharing.

---

## 🛡️ P4 — Operacional / Compliance contínuo

*Background work — sempre presente, nunca "feito".*

### P4.1 — Auditorias LGPD periódicas
- Revisar `security_events` mensalmente
- Atualizar `docs/RIPD.md` quando processos mudarem
- Renovar certidões (ANPD se solicitado)
- Pen test anual (idealmente)

### P4.2 — Rotação de secrets
- VAPID keys: rotacionar anualmente
- Service account JSONs (Firebase, Play): a cada 6 meses
- Supabase service_role: rotacionar ao trocar dev de equipe

### P4.3 — Backup + DR (Disaster Recovery)
- Supabase tem backups automáticos (point-in-time recovery)
- Documentar runbook de restauração
- Testar restore em staging anualmente

### P4.4 — Monitoramento + alerting
- Uptime: BetterStack / UptimeRobot — alerta se Edge Function falhar
- Performance: Vercel Analytics (web) + Android Vitals (mobile)
- Erros críticos: Sentry → Slack/email

### P4.5 — A/B testing infrastructure
- **Por quê:** decisões de produto baseadas em dados, não opinião.
- **O que:** integrar PostHog ou Statsig (feature flags + experimentação). Testar variações de paywall, copy, onboarding.
- **Esforço:** 3-5 dias.

### P4.6 — Documentação pública
- Site marketing simples (`dosy-teal.vercel.app/sobre`)
- Blog/changelog público
- FAQ
- Press kit pra cobertura mídia

---

## 🚫 Decisões explícitas — o que NÃO faremos (por enquanto)

Documentar para evitar re-debate:

- **Não suportaremos jejum intermitente / dieta / fitness tracking** — escopo é medicação, não wellness geral
- **Não armazenaremos PHI sensível além de medicação** (sem prontuário médico, sem exames laboratoriais — risco regulatório alto)
- **Não venderemos dados anonimizados pra farmacêuticas** — princípio de privacidade do produto, mesmo se LGPD permitir
- **Não faremos versão "kids"** sem ter ToS/parental consent flow (COPPA-like ANPD)
- **Não suportaremos prescription scanning com auto-pedido em farmácia** — fora do escopo, regulado pela ANVISA

---

## 📊 Métricas de sucesso (north stars)

Revisar trimestralmente:

| Métrica | Alvo 6 meses pós-launch | Alvo 12 meses |
|---|---|---|
| Downloads Play Store | 5.000 | 50.000 |
| MAU (Monthly Active Users) | 1.500 | 20.000 |
| Retenção D30 | 35% | 50% |
| Conversão Free → PRO | 2% | 5% |
| Crash-free sessions | 99,5% | 99,8% |
| Adesão média usuários | 70% | 85% |
| Reviews Play Store | ★ 4,2+ | ★ 4,5+ |

---

## 📢 Comunicado para os Usuários (template release notes)

> "Estamos construindo o Dosy pra ser mais que um lembrete — um parceiro real na rotina de cuidado com quem você ama. Cada atualização traz mais inteligência, segurança e privacidade. Obrigado por confiar."

---

## 📝 Como contribuir com este roadmap

1. **Reordenar:** se feedback de usuário sugerir promover P2 → P1, mover e justificar em commit message
2. **Adicionar:** novos itens entram com escopo, justificativa e estimativa
3. **Remover:** se item virou P0/P1 e foi feito → mover pra `Plan.md` (que rastreia execução)
4. **Cancelar:** se pesquisa mostrar que ninguém pede → mover pra "Decisões explícitas"
