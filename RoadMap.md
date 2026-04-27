# Dosy — Roteiro de Evolução e Futuras Atualizações

> **Visão:** Tornar o Dosy o assistente de saúde familiar mais intuitivo e seguro do mercado, combinando design moderno com tecnologia de ponta.

---

## 🚀 Curto Prazo (Próximos 3 meses)

*Foco: Estabilização e Lançamento Mobile*

### 1. Gestão de Estoque (Pharmacy Stock)
- **Funcionalidade:** O usuário insere a quantidade de comprimidos/ml ao cadastrar o tratamento. O app subtrai automaticamente a cada dose confirmada.
- **Alerta de Reposição:** Notificação quando o estoque atingir um nível crítico (ex: "Restam apenas 3 doses").

### 2. Integração com Calendários Externos
- Opção de sincronizar os horários de medicação com o Google Calendar ou iCal, facilitando a visão da rotina diária fora do app.

### 3. Melhoria na Experiência de Notificação
- **Ações Rápidas:** Botões diretamente na notificação nativa para "Adiar 15 min" ou "Registrar como Tomada" sem precisar abrir o app.

---

## 🎨 Design & UX (Interface 2.0)

*Foco: Polimento Visual e Acessibilidade*

### 1. Transições Fluidas (Native-feel)
- Animações de transição de página (Framer Motion) para simular o comportamento de apps 100% nativos.

### 2. Personalização de Temas
- Além do Dark/Light, introduzir "Acentos de Cor" onde o usuário pode escolher a cor principal do app (Azul, Verde Saúde, Rosa, etc.).

### 3. Widgets para Tela Inicial
- **Android/iOS Widgets:** Visualização rápida da próxima dose diretamente na tela de bloqueio ou tela inicial do celular.

---

## 🛠️ Médio Prazo (6 a 12 meses)

*Foco: Inteligência e Conectividade*

### 1. Dosy AI (Assistente de Saúde Local)
- Integração com modelos de linguagem locais (LLM) para responder dúvidas sobre bulas e interações medicamentosas com privacidade total.
- **Leitura de Receita:** Uso da câmera para escanear receitas médicas e preencher automaticamente os dados do tratamento.

### 2. Suporte a Wearables (Smartwatches)
- Extensão para Wear OS e Apple Watch, permitindo confirmar doses apenas girando o pulso.

### 3. Modo Direção (Android Auto)
- Notificações seguras e simplificadas no painel do carro para que o usuário não perca a dose enquanto dirige.

---

## 📱 Port para iOS (Médio Prazo)

*Foco: Expansão de plataforma após validação Android*

**Pré-requisito:** Lançamento Android estável + tração de mercado validada (downloads, retenção, receita PRO).

### Por que faz sentido
- Codebase React/Capacitor 100% reaproveitável (UI, hooks, services, RPCs Supabase, LGPD pages — zero refactor)
- Maioria dos plugins Capacitor já tem implementação iOS pronta (push, local-notifications, filesystem, share, network, secure-storage Keychain, AdMob, Sentry)
- Mercado iOS BR ~15% mas com ARPU mais alto (poder de compra)

### O que precisa porte real
1. **Plugin CriticalAlarm em Swift** (`com.dosyapp.dosy.plugins.criticalalarm`):
   - Reescrever lógica em `UNUserNotificationCenter` + `UNCalendarNotificationTrigger`
   - Sem fullscreen alarm UI (iOS proíbe activity launch background)
   - Som loop via `UNNotificationSound.criticalSoundNamed` + custom `.caf`
   - **Critical Alerts entitlement** — request via developer.apple.com (aprovação manual Apple, semanas)
   - Resultado: notificação persistente alta prioridade que ignora silencioso/Focus, sem fullscreen

2. **APNs (Apple Push Notification service)**:
   - Upload APNs key no Firebase Console (FCM HTTP v1 já suporta tokens iOS — Edge Function `notify-doses` zero mudança)
   - Provisioning profile + push entitlement no Xcode

3. **In-App Purchase (StoreKit)**:
   - RevenueCat suporta StoreKit nativamente — código JS idêntico
   - Configurar produtos no App Store Connect (mesmos `dosy_pro_monthly` / `dosy_pro_yearly`)

4. **SSL Pinning**:
   - `network_security_config.xml` é Android-only
   - iOS: `URLSessionDelegate` custom ou plugin `@capacitor-community/http` com pinning

5. **Adaptive icons / launch screens**:
   - Asset Catalog Xcode (formato diferente de `mipmap-*` Android)
   - `npx @capacitor/assets generate --ios` automatiza

6. **Build infrastructure**:
   - Mac físico ou cloud (MacStadium, GitHub Actions `macos-latest` runner)
   - Xcode + signing certificates Apple Developer
   - Workflow `.github/workflows/ios-release.yml` adicional

### Custos extras iOS

| Item | Custo |
|---|---|
| Apple Developer Program | USD 99/ano (vs USD 25 único Android) |
| Mac para build (cloud) | ~USD 30-50/mês |
| Critical Alerts entitlement | Grátis (mas exige aprovação Apple) |
| Tempo dev porte alarme | ~2-3 dias |

### Limitações conhecidas iOS

- **Sem fullscreen alarm UI** — iOS bloqueia activity launch em background. Substitui por notificação Critical Alert persistente.
- **Sem `BootReceiver` equivalente** — iOS persiste agendamentos automaticamente, não precisa.
- Volume de alarmes globais limitado a 64 notificações pendentes por app (vs ilimitado Android).

### Estimativa total

- **Sem Critical Alerts:** ~3-5 dias dev (scaffold Capacitor iOS + APNs + ícones + StoreKit + testes TestFlight)
- **Com Critical Alerts (recomendado app saúde):** +2-3 dias (Swift impl + entitlement Apple)
- **Total:** 5-8 dias dev + tempo aprovação Apple (entitlement Critical Alerts + review App Store)

### Sequência ideal

1. ✅ Lançar Android primeiro (Play Store)
2. Validar tração: downloads, retenção 30d, churn PRO
3. Avaliar pedidos iOS via reviews/email
4. Quando receita PRO cobrir custos Apple → iniciar porte
5. TestFlight beta com mesmos testadores Android
6. Submit App Store

---

## 🌐 Longo Prazo e Ecossistema

*Foco: Expansão e Valor Agregado*

### 1. Compartilhamento Familiar Avançado (Dosy Family)
- Sincronização em tempo real entre dispositivos. Ex: O pai registra a dose do filho e a mãe recebe a confirmação instantaneamente em seu próprio celular.

### 2. Relatórios Médicos Inteligentes
- Geração de PDFs avançados com gráficos de tendência de saúde, prontos para serem enviados via WhatsApp diretamente para o médico durante a consulta.

### 3. Gamificação de Adesão
- Sistema de conquistas e "Streaks" (sequências) para incentivar o usuário a manter 100% de adesão ao tratamento, com badges colecionáveis.

---

## 📢 Comunicado para os Usuários

> "Estamos trabalhando para que o Dosy seja mais do que um lembrete; queremos ser o seu parceiro na jornada de cuidado com quem você ama. As próximas atualizações trarão mais inteligência e facilidade para o seu dia a dia. Fique ligado!"
