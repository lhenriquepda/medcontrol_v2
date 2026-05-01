# 01 — Relatório de Auditoria Completo (25 Dimensões)

> **Auditor:** auditoria autônoma sênior multidisciplinar (Claude)
> **Data:** 2026-05-01
> **Versão auditada:** Dosy 0.1.6.9 @ commit `5bb9d36` · branch `master`
> **Vercel deploy:** confirmado em `https://dosy-teal.vercel.app/` rodando v0.1.6.9 (espelhado com código auditado)
> **Cobertura:** análise estática completa do repo + ~15 min live nav via Claude in Chrome com `teste03@teste.com`. Sessão profunda de 90 min em device físico fica como gate manual pré-Beta.

Notação:
- ✅ OK · ⚠️ Atenção · ❌ Bloqueador · ❓ Não foi possível avaliar
- **P0/P1/P2/P3** = Severidade
- **[ANDROID]/[AMBOS]/[WEB-ONLY]** = Plataforma afetada

---

## 1. 🚨 Confiabilidade de alarmes e notificações — Score 8.5/10

### Auditoria estática

✅ **Permissões corretas** (`AndroidManifest.xml`):
- `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM` (Android 12+/13+)
- `POST_NOTIFICATIONS` (Android 13+)
- `USE_FULL_SCREEN_INTENT`, `ACCESS_NOTIFICATION_POLICY`
- `FOREGROUND_SERVICE_SPECIAL_USE` com property `medication_reminder`
- `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `TURN_SCREEN_ON`, `DISABLE_KEYGUARD`, `SYSTEM_ALERT_WINDOW`

✅ **AlarmManager API correta:** `setAlarmClock()` (mais robusto que `setExactAndAllowWhileIdle()`), bypassa Doze nativamente.

✅ **WorkManager NÃO é usado para alarmes** — escolha correta (WorkManager não garante horários exatos).

✅ **Plugin nativo CriticalAlarm** auditado (6 componentes Java em `android/app/src/main/java/com/dosyapp/dosy/plugins/criticalalarm/`):
- `CriticalAlarmPlugin.java` — bridge Capacitor
- `AlarmReceiver.java` — WakeLock 10s, IMPORTANCE_HIGH channel, bypassDND
- `AlarmActivity.java` — fullscreen FLAG_SHOW_WHEN_LOCKED + TURN_SCREEN_ON + MediaPlayer loop + Vibrator com pattern infinito + back button bloqueado
- `AlarmService.java` — foreground SPECIAL_USE + MediaPlayer estático + cleanup correto
- `BootReceiver.java` — re-agenda BOOT_COMPLETED + LOCKED_BOOT_COMPLETED + MY_PACKAGE_REPLACED, schema migration v1→v2
- `AlarmActionReceiver.java` — actions Tomada/Pular/Adiar 10min, snooze re-agendamento

✅ **Sem leaks aparentes:** WakeLock com timeout + release em `onDestroy`, MediaPlayer release + null assignment, Vibrator cancel.

✅ **PendingIntent FLAG_IMMUTABLE** (Android 12+).

✅ **Notification channel `IMPORTANCE_HIGH` + `setBypassDnd(true)`**.

⚠️ **`ic_stat_dosy` ausente** (`capacitor.config.ts` referencia, mas não existe em `drawable*`). LocalNotifications fallback para ic_launcher → ícone errado. **BUG-005 P1 [ANDROID]**.

⚠️ **SharedPreferences `dosy_critical_alarms`** sem criptografia. doseIds + medNames expostos em acesso físico ao device. P2.

⚠️ **Sem REQUEST_IGNORE_BATTERY_OPTIMIZATIONS** — justificável (setAlarmClock bypassa Doze), mas em OEMs hostis (Xiaomi, Huawei, OPPO, OnePlus) kill agressivo ainda é risco. Plan FASE 23.7 prevê `DosyMonitorService` post-launch.

### Pendências de validação manual (device físico)
- DND nativo Android (alarme bypass via ACCESS_NOTIFICATION_POLICY)
- Após reboot
- DND interno Dosy (janela 23:00-07:00 em Settings)
- 5 doses com 1 minuto de diferença (agrupamento)
- Force-stop em Xiaomi/MIUI, Huawei, Samsung

→ Cobertura em `docs/device-validation-checklist.md` (Plan FASE 17).

---

## 2. 🔐 Segurança (client-side + Edge) — Score 6.5/10

### 2.1 Autenticação
- ✅ Supabase Auth email/senha (bcrypt, plataforma).
- ✅ JWT exp 1h + refresh rotation.
- ✅ `mailer_autoconfirm=false` (cloud — confirma email).
- ⚠️ `minimum_password_length=6` em `config.toml` — frontend valida 8+. **BUG-008 P2**.
- ✅ Rate limit Auth: `sign_in_sign_ups=30/5min`, `token_refresh=150`.
- ❓ Brute-force protection — verificar dashboard Supabase `failed_login_attempts`.
- ⚠️ Logout: limpa `localStorage` específico mas TanStack persistor cache permanece com PII de saúde brevemente. `qc.clear()` em `useAuth.jsx:21-46` mitiga.

### 2.2 Storage local Android
- ✅ `@aparajita/capacitor-secure-storage` para auth tokens (Android KeyStore + EncryptedSharedPreferences).
- ✅ `data_extraction_rules.xml` exclui domínio = bloqueia ADB backup + device-to-device.
- ✅ `allowBackup="false"`.
- ⚠️ TanStack persistor (web e native) usa `localStorage` plain. PII de saúde (medName, observation, patientName) em cache 24h. Aceito como tradeoff offline-first.
- ⚠️ `dosy_critical_alarms` SharedPreferences sem encryption.

### 2.3 Comunicação
- ✅ TLS 1.2+ obrigatório, `cleartextTrafficPermitted="false"`.
- ✅ Certificate pinning Supabase (3 pins SHA-256 SPKI: GTS WE1, GTS R4, GlobalSign R) com expiration 2027-12-01.
- ✅ Cert pinning Vercel (CA validation, sem pin estrito por rotação LE).
- ✅ Sem trust de certificados de usuário em produção.

### 2.4 Mobile-specific
- ✅ FLAG_SECURE em DoseModal/PatientDetail/Reports/DoseHistory via `usePrivacyScreen`.
- ✅ Mask em recents view.
- ✅ ProGuard/R8 (`minifyEnabled=true`, `shrinkResources=true`) com keep rules para Capacitor + plugins + Sentry + Firebase + custom CriticalAlarm.
- ⚠️ Detecção root — Plan 23 backlog (plugin community não maintained Capacitor 8). P3.
- ⚠️ Play Integrity API — Plan 23 backlog. P2.
- ⚠️ Biometria (`useAppLock`) — infra pronta mas UI não-wired. Plan 11.3 → 12 ou 23.

### 2.5 Edge Functions
- ❌ **`send-test-push` sem auth admin** — qualquer authenticated user invoca + email enumeration via 404. **BUG-002 + BUG-015 P0 [AMBOS]**.
- ⚠️ `delete-account` sem rate limit. **BUG-003 P2**.
- ✅ `notify-doses` — cron-only, não invocado por client. Implementação JWT OAuth Firebase nativa.

### 2.6 OWASP Mobile Top 10 (2024)
| # | Categoria | Status |
|---|---|---|
| M1 | Improper Credential Usage | ✅ KeyStore |
| M2 | Inadequate Supply Chain Security | ⚠️ TS 6.x + admob desatualizado (BUG-007) |
| M3 | Insecure Authentication/Authorization | ⚠️ send-test-push (BUG-002 P0) |
| M4 | Insufficient Input/Output Validation | ✅ CHECKs DB + escapeHtml |
| M5 | Insecure Communication | ✅ TLS + pin |
| M6 | Inadequate Privacy Controls | ✅ LGPD + delete + export |
| M7 | Insufficient Binary Protections | ✅ ProGuard + R8 + FLAG_SECURE |
| M8 | Security Misconfiguration | ⚠️ password 6 chars, INFOS.md |
| M9 | Insecure Data Storage | ⚠️ TanStack cache + SharedPrefs |
| M10 | Insufficient Cryptography | ✅ AES-256-GCM, RSA 2048 keystore |

---

## 3. ⚖️ Privacidade e conformidade legal — Score 8/10

### LGPD (Brasil)
- ✅ Política de Privacidade `/privacidade` (rota pública).
- ✅ Termos de Uso `/termos` (rota pública).
- ✅ Consentimento explícito no cadastro (checkbox + log `subscriptions.consentAt` + `consentVersion`).
- ✅ Direito de Acesso (Art. 18) — Exportar JSON em Settings.
- ✅ Direito ao Esquecimento (Art. 18 VI) — `delete_my_account` RPC + Edge Function.
- ✅ pg_cron `anonymize-old-doses` (3 anos).
- ✅ Data Minimization — `observation` CHECK ≤500 chars.
- ✅ `security_events` audit log.
- ✅ `docs/RIPD.md` documentando Edge Functions com PII.
- ⚠️ DPO/Encarregado — não confirmado contato visível na app/site.
- ⚠️ Crianças/adolescentes (Art. 14) — público alvo 18+ declarado IARC; OK.
- ⚠️ Notificação de incidente — runbook não documentado (Plan 23.4 backlog).
- ⚠️ Transferência internacional — Supabase US/EU regions; declarar na privacy policy.

### ANVISA / CFM
- ⚠️ App **NÃO** é SaMD pela definição (Software as Medical Device): não diagnostica, não prescreve, apenas lembra/registra. ✅ correto.
- ⚠️ Disclaimer "Não substitui orientação médica" — verificar visibilidade nos Termos/Onboarding (Plan FASE 18 backlog implementação).
- ✅ Sem promessas médicas em descrição Play Store (Plan 18.6).

### GDPR (se vendido fora BR)
- Plan declara "pt-BR" — público inicial Brasil. GDPR aplicável só se aceitar usuários EU.

### Compliance score
- LGPD: 9/10 (DPO indicação faltando)
- ANVISA/CFM: 8/10 (disclaimer visível)
- GDPR: 6/10 (não-target inicial)

---

## 4. 🏗️ Arquitetura e qualidade de código — Score 7/10

### Pontos positivos
- ✅ Separação razoável: pages / components / hooks / services / utils.
- ✅ TanStack Query para data layer.
- ✅ Context API para auth (sem Redux/Zustand — adequado).
- ✅ `@sentry/react` ErrorBoundary global.
- ✅ Lint 0 errors / 49 warnings.
- ✅ CI rodando lint + test + audit + build em PR.
- ✅ 8 migrations DB versionadas.

### Pontos críticos
- ⚠️ God-components: Settings (541), Reports (436), Dashboard (382), notifications.js (588), TreatmentForm (310).
- ⚠️ Zero `React.memo` — re-renders em listas.
- ⚠️ Zero virtualização (listas grandes).
- ⚠️ Zero teste de integração (hooks com mock Supabase) ou E2E.
- ⚠️ Sem pre-commit hooks (husky).
- ⚠️ TS 6.0.3 — verificar (BUG-007).
- ⚠️ Migrations baseline `remote_schema.sql` vazio (0 bytes) — schema real só em produção sem dump versionado.
- ⚠️ ADRs (Architectural Decision Records) — não documentadas formalmente (Plan + SECURITY.md cobrem parcial).

---

## 5. ⚡ Performance e gestão de memória — Score 7.5/10

### Performance build
- ✅ Bundle main: 64 KB (gzip 20 KB) — **excelente**, alvo ≤500 KB superado.
- ✅ Vendor chunks split: react 206 KB, data 234 KB, vendor 220 KB, sentry 11 KB, capacitor 29 KB.
- ✅ jspdf (340 KB) + html2canvas (199 KB) lazy só na route /relatorios.
- ✅ React.lazy em 18 pages.
- ✅ Terser strip console.log/warn/info/debug em prod.
- ⚠️ APK ~10.4 MB (Plan declara). Alvo <50 MB ✅.

### Performance runtime (estimado)
- ❓ Cold start <2s — não medido em device real.
- ❓ Frame rate 60fps — não medido.
- ⚠️ Heap usage — não medido.
- ⚠️ Memory leaks — LeakCanary não rodado (Plan 17 device validation manual).

### Bateria
- ✅ AlarmManager.setAlarmClock — sem polling background.
- ✅ Sem WorkManager periódico desnecessário.
- ⚠️ TanStack `refetchInterval: 60s` em useDoses pode poluir bateria — adicionar `refetchIntervalInBackground: false`.
- ✅ Compressão gzip pelo Vercel/Supabase.

### Compatibilidade
- `minSdkVersion = 24` (Android 7.0+) — cobre ~92% device base BR.
- `targetSdkVersion = 36` — atual.
- ❓ Devices com 2GB RAM — testar em FASE 17.
- ❓ Telas pequenas / dobráveis / tablets — testar.

---

## 6. 🧭 Usabilidade e fluxo de navegação — Score 7/10

### Heurísticas de Nielsen (10)

1. ✅ **Visibilidade do status** — toasts presentes, loading skeletons parciais.
2. ✅ **Mundo real** — linguagem PT-BR, "Tomada/Pulada", "Adiar 10min".
3. ⚠️ **Controle e liberdade** — Undo 5s para delete (sim) e confirm/skip dose (sim). Cancelar form em meio?
4. ✅ **Consistência** — Tailwind tokens centralizados em `theme.css`, ícones flat Lucide.
5. ⚠️ **Prevenção de erro** — confirmação dupla para delete pacientes ✅, mas batch delete (>10) não existe ainda.
6. ✅ **Reconhecimento** — ícones acompanhados de label em BottomNav, FilterBar.
7. ⚠️ **Flexibilidade** — sem atalhos para power users.
8. ✅ **Estética e minimalismo** — design limpo dark mode default.
9. ⚠️ **Recuperação de erros** — mensagens via toast, mas inline em forms ainda não (Plan 15 backlog).
10. ✅ **Ajuda e documentação** — FAQ in-app + `docs/support-sla.md` + email suporte.

### Mobile heuristics
- ⚠️ Touch targets — Plan 12.2 mitigou principais (header back, FAB, BottomNav). Restantes em forms a verificar.
- ✅ Polegar zone — FAB + BottomNav bottom-friendly.
- ✅ Sem hover.
- ⚠️ Gestos — swipe em DoseCard? não confirmado live nav.
- ✅ Botão back Android handler (`@capacitor/app`).

### Saúde-specific
- ✅ Linguagem empática.
- ✅ Sem culpabilizar paciente em "Pulada" ou perdida.
- ⚠️ Modo cuidador remoto — features `patient_shares` existe, mas UX dedicado (perfil cuidador) não-explícito.

### Friction log e personas — ver `07-usabilidade.md`.

---

## 7. 🎨 UI e Acessibilidade — Score 6/10

### WCAG 2.2 AA
- ✅ `:focus-visible` global (Plan 7.4).
- ⚠️ Contraste — não medido sistematicamente. Login dark mode com cinzas claros para texto secundário (timestamps no histórico) parece marginal.
- ❓ Font Scale 200% — testar em device.
- ❓ TalkBack — testar em device.
- ⚠️ Aria-labels: ~25 ocorrências (boa cobertura inicial), mas inputs Login usam só `placeholder` (sem `<label>` ou `aria-label`).
- ✅ Touch targets ≥44px nos botões críticos (Plan 12.2).
- ✅ Não-só-cor — ícones acompanham status (✓, ↑, ↩).
- ❓ Reduce Motion — não confirmado em framer-motion config.

### Idosos
- ⚠️ Tipografia mínima — não confirmada 16sp+/18sp+.
- ✅ Botões grandes (FAB).
- ✅ Linguagem simples.
- ✅ Sem timeouts curtos visíveis.

### Design system
- ✅ Tokens em `src/styles/theme.css` (Plan 4.4).
- ✅ Tailwind consume CSS vars.
- ✅ Componentes reutilizáveis (Card, Field, Icon, etc).
- ✅ Empty states presentes (Dashboard, Pacientes lista vazia ainda não testada).

---

## 8. ⏳ Feedback visual e estados de carregamento — Score 6.5/10

| Ação | Tempo (live nav) | Feedback observado |
|---|---|---|
| Login → redirect dashboard | ~3-5s | Sem spinner óbvio durante submit |
| Carregar Dashboard | ~2s | Skeletons parciais |
| Navegar para Pacientes | ~1s | Quase instantâneo (cached) |
| Navegar para Settings | ~3s | Skeleton transição visível, página "salta" durante load |
| Navegar para Histórico | ~1.5s | OK |

### Observações
- ✅ `<PageSkeleton>` Suspense fallback em rotas lazy.
- ✅ Optimistic updates em confirm/skip/undo dose.
- ⚠️ Skeleton screens completos para forms (TreatmentList, Reports, Analytics, SOS) — Plan 15 backlog.
- ⚠️ Botão "Salvar" não fica disabled durante submit em todos os forms (verificar PatientForm/TreatmentForm/Settings).
- ✅ Pull-to-refresh (`react-simple-pull-to-refresh`) instalado.

---

## 9. 📝 Lógicas e fluxos de cadastro — Score 7/10

### Cadastro de paciente
- ✅ Campos básicos: nome, DoB, gênero, condições, alergias, observações.
- ✅ CHECKs DB: name length, age 0-150, weight 0-1000, condition/doctor/allergies length.
- ⚠️ Validação inline parcial (Plan 15 backlog).
- ⚠️ Sem máscaras CPF/telefone (usual para healthcare BR — opcional).
- ⚠️ Foto do paciente — não implementada.
- ✅ Multi-paciente: avatar com inicial, identificação clara.
- ✅ Hard-delete (não soft).
- ⚠️ Limite Free 1 paciente — testar em UI bound (paywall).

### Cadastro de tratamento
- ⚠️ Nome do medicamento: campo livre + autocomplete via `MedNameInput.jsx` (186 LOC). Cobertura da base (`src/data/medications.js`) — não-inspecionado, recomenda-se conferir abrangência (Bulário ANVISA, DEF, etc).
- ✅ Frequência: `mode=interval` (a cada N horas) + `mode=times` (horários específicos).
- ✅ Duração: por dias (`durationDays`) OU contínuo. CHECK `durationDays ≤ 365`.
- ✅ Geração doses: `utils/generateDoses.js` (cobertura 100% via 13 testes).
- ✅ Edição de tratamento: RPC `update_treatment_schedule` regenera doses atomicamente.
- ✅ DELETE com `ON CASCADE` em doses + sos_rules.
- ⚠️ Validação cruzada (interação medicamentosa, alergia conhecida) — não implementada (P2).
- ⚠️ Pause/cancelar — Plan menciona possibilidade, verificar UI.

### Lógica de doses
- ✅ Estados claros: agendada, tomada (no horário/atrasada), pulada manual/automática, cancelada.
- ✅ RPC `confirm_dose`, `skip_dose`, `undo_dose` validam transições.
- ⚠️ Tempo limite "no horário" vs "atrasada" — verificar config (provavelmente fixo 15-30min).
- ⚠️ Histórico de mudanças (auditoria por dose) — Plan 23.5 backlog.
- ✅ Undo via `useUndoableDelete` (5s window).

---

## 10. 📋 Listas — Score 7.5/10

### Doses do dia (Dashboard)
- ✅ Filtros 12h/24h/48h/7d/Tudo.
- ✅ Cards stats: PENDENTES HOJE, ADESÃO 7D, ATRASADAS.
- ✅ Empty state com CTA.
- ⚠️ Multi-paciente — identificação? AppHeader mostra user, não paciente ativo.

### Histórico
- ✅ Ordenação cronológica reversa.
- ✅ Agrupamento por dia com badge "Ontem 30 abr / 4/6".
- ✅ Status visual claro (cor + ícone).
- ✅ Search (text by medName/observation).
- ✅ Adesão visual com gradient bar.

### Pacientes
- ✅ Card avatar + nome + idade.
- ⚠️ Busca/filtro — verificar se existe.
- ⚠️ Indicador "tem dose pendente" — verificar.
- ⚠️ Drag-sort — Plan 15 backlog.

### Tratamentos por paciente
- ✅ Listagem em PatientDetail (live nav: 1 tratamento).
- ✅ Ativos vs encerrados — não confirmado em live nav.
- ⚠️ Posologia clara (medName + dose + frequência + duração) — confirmado.
- ⚠️ Progresso "Dia 5 de 10" — não confirmado.

### Performance
- ⚠️ Sem virtualização (FixedSizeList/react-window). Plan tem `@tanstack/react-virtual` em deps mas não-integrado. Ok para <200 itens.
- ✅ Pull-to-refresh.

---

## 11. 💊 Funcionalidades específicas de medicação — Score 6.5/10

| Feature | Status |
|---|---|
| Estoque de medicamento + alerta "acabando" | ❌ Não implementado |
| Receita controlada (azul/amarela) | ❌ Não implementado |
| Lembrete de consulta médica | ❌ Não implementado |
| Verificação de interações medicamentosas | ❌ Não implementado (P2 healthcare) |
| Avisos de alergia | ⚠️ Campo de alergias existe no PatientForm; verificação cruzada não |
| Modo cuidador remoto | ✅ Parcial — `patient_shares` |
| Tapering / desmame | ❌ Não implementado |
| Refeição (antes, durante, depois, jejum) | ❌ Não implementado |
| Snooze configurável | ✅ "Adiar 10min" fixo |
| Anotações por dose | ✅ Campo `observation` (limite 500 chars) |
| Foto da caixa | ❌ Plan 15 backlog |
| Múltiplos cuidadores | ✅ Via `patient_shares` |

**Crítico para healthcare:** verificação de interações + alergia conhecida ao cadastrar tratamento (P2). Banco bulário ANVISA seria diferenciador.

---

## 12. 🌪️ Casos de borda — Score 6/10

| Cenário | Cobertura |
|---|---|
| Tratamento que termina no meio do dia | ⚠️ Verificar `generateDoses` |
| Tratamento futuro (start_at > now) | ✅ Suportado |
| Edição de horário ativo | ✅ RPC `update_treatment_schedule` |
| Exclusão com histórico | ✅ ON CASCADE |
| Mudança de fuso horário | ❓ Tests `dateUtils.test.js` cobrem? |
| Mudança manual de data/hora device | ❓ AlarmManager.setAlarmClock é ABS time, OK |
| Reboot | ✅ BootReceiver |
| Force-stop | ⚠️ OEMs hostis — Plan 23.7 backlog |
| Reinstalação | ✅ Storage versionado por APP_VERSION |
| Troca de celular | ⚠️ allowBackup=false → re-login + re-baixar dados (esperado) |
| Múltiplos devices | ✅ `upsert_push_subscription` cross-device transfer |
| Sem internet 7 dias | ✅ TanStack persistor 24h cache + offline mutations |
| Storage cheio | ❓ Não testado |
| Permissões revogadas | ✅ PermissionsOnboarding re-aparece |
| Dose marcada por engano | ✅ Undo 5s |
| Duas doses do mesmo remédio próximas | ✅ SOS regras (`minIntervalHours`, `maxDosesIn24h`) |

---

## 13. 🧪 Testes e qualidade — Score 4/10

- ✅ 6 unit tests (utils 5, services 1) — 66 tests passing.
- ✅ Coverage utils ≥88% lines, 100% generateDoses.
- ❌ **Zero testes de integração** (hooks com mock Supabase) — Plan 9.4 backlog.
- ❌ **Zero E2E** (Playwright/Detox) — Plan 9.5 backlog.
- ✅ CI lint + test + audit + build em PR.
- ⚠️ Sem matriz de devices documentada antes de Beta.
- ⚠️ Beta testing — Plan FASE 19 (2 testers internos already).
- ⚠️ Testes com idosos — não programados.
- ⚠️ Bug tracker — não confirmado (GitHub Issues? Linear?).

---

## 14. 📊 Observabilidade e monitoramento — Score 7.5/10

- ✅ Sentry React + Capacitor com release tag + ErrorBoundary global.
- ✅ Source maps via `@sentry/vite-plugin` (sourcemap: 'hidden').
- ✅ `beforeSend` strip PII.
- ✅ PostHog instalado, eventos catalog (24), `sanitize_properties` LGPD-safe.
- ⚠️ `SENTRY_AUTH_TOKEN/ORG/PROJECT` em GitHub Secrets — Plan 10.1 manual pendente.
- ⚠️ Dashboards customizados PostHog — Plan 14.3 manual pendente.
- ⚠️ Alertas Sentry (crash spike, error threshold) — Plan 14.2 manual.
- ❌ Métrica chave **taxa de entrega de notificações** — não rastreada (P1 healthcare!).
- ⚠️ Funil onboarding — Plan documenta mas não confirma eventos wired.

**Recomendação P1:** evento PostHog `notification_delivered` para medir % entrega FCM/LocalNotif. Sem isso, não dá para detectar regressão silenciosa em alarmes (a coisa mais crítica do app).

---

## 15. 🏪 Conformidade com lojas (Google Play) — Score 7/10

- ✅ App registrado: `com.dosyapp.dosy`, App ID `4972201184307332877`.
- ✅ Política de Privacidade pública (`/privacidade`).
- ✅ Termos de Uso (`/termos`).
- ✅ Anúncios declarado (AdMob).
- ✅ Classificações IARC.
- ✅ Público alvo 18+.
- ✅ Segurança dos dados form preenchido (Plan 18.2).
- ✅ Apps de saúde declarado.
- ✅ Intent tela cheia: Despertador.
- ✅ Alarmes exatos: Despertador.
- ❌ **Permissões serviço primeiro plano (FOREGROUND_SERVICE_SPECIAL_USE)** — pendente vídeo demo (Plan 18.9.1).
- ⚠️ Target API level — verificar no momento do upload (Play exige sempre o atual).
- ✅ App Bundle (.aab) assinado e v0.1.6.1 já em Internal Testing.
- ⚠️ Screenshots phone — Plan 18.9.2 retrabalho.
- ✅ Descrição sem promessas médicas.

### Bloqueadores de Closed/Open Testing (Plan 18.9)
- Vídeo demo FGS (~30s YouTube unlisted)
- Screenshots regenerados
- 12 testers × 14 dias em Closed Testing antes de Produção (regra Google 2024)

---

## 16. ⚖️ Aspectos legais e disclaimers — Score 7/10

- ⚠️ Disclaimer médico ("Não substitui orientação médica") — verificar visibilidade nos Termos + Onboarding (Plan 18.5.1 menciona; live nav não confirmou em modal-prominent).
- ✅ Termo de Uso aceito explicitamente (consentimento checkbox).
- ✅ Limitação de responsabilidade — texto Termos.
- ⚠️ CNPJ e razão social em Política — não confirmado (depende de plano de pessoa física vs jurídica).
- ⚠️ SAC funcional — `suporte@dosyapp.com` declarado, "configurar caixa real antes do Beta" (Plan 18.5).
- ✅ Termo consentimento específico para dados de saúde — checkbox + `consentAt`.

---

## 17. 🎓 Onboarding e suporte — Score 7.5/10

- ✅ Onboarding tour 6 slides (live nav).
- ⚠️ First-run <3 min — não cronometrado oficialmente.
- ✅ Tour pulável (botão "Pular").
- ✅ Empty states com CTA (Dashboard "+ Novo tratamento", Pacientes "+ Novo").
- ✅ FAQ in-app (35 perguntas, 9 categorias) acessível de Settings + Mais.
- ✅ Email suporte com mailto template.
- ✅ Feedback in-app — Plan 19 templates Google Form.
- ✅ Changelog visível — UpdateBanner + version.json.

---

## 18. 🔄 Gestão de dados e ciclo de vida — Score 7/10

- ❓ Backup automático na nuvem — Supabase é a "nuvem"; PITR a confirmar.
- ✅ Restore em novo device — login + sync (sem ADB backup, esperado).
- ✅ Exportação JSON (Settings) — LGPD portabilidade.
- ✅ Sync multi-device via Supabase Realtime.
- ⚠️ Resolução de conflito — last-write-wins padrão Supabase. Para confirm_dose, RPC valida transição de status (não-conflito).
- ✅ Migração de schema versionada.
- ⚠️ Soft-delete vs hard-delete — hard-delete para pacientes/treatments/doses (LGPD-aligned). Documentar em ADR.

---

## 19. 🥊 Análise competitiva — Score N/A (não documentada)

Recomendação manual:
- **Medisafe** (líder global) — interações medicamentosas, refill reminders, family share.
- **MyTherapy** (Alemanha, BR pt-BR) — tracking de saúde, family doctor.
- **Lembrete de Remédios** (BR popular) — simples, free.
- **Mobile Saúde** (BR) — multi-feature healthcare.
- **Round Health** (US) — adesão + relatórios.

**Diferenciadores Dosy:**
- ✅ Alarme crítico nativo (despertador) — diferenciador real, raro em concorrentes BR.
- ✅ LGPD-first (raro nos concorrentes US/EU).
- ⚠️ Falta: bulário ANVISA, refill, integração farmácia, family share visualmente acessível.

---

## 20. 🚀 Prontidão para lançamento — Score 6/10

| Item | Status |
|---|---|
| Estratégia rollout gradual (5%→100%) | ⚠️ Plan 22.1 menciona, sem detalhe |
| Capacidade backend (Supabase) | ⚠️ Free aguenta MVP, Pro necessário 1k+ MAU |
| On-call definido | ❌ Não documentado |
| Runbook | ❌ Não documentado (Plan 23.4 backlog) |
| Rollback plan | ⚠️ Versioning APK + Vercel; sem playbook escrito |
| Métricas de sucesso (DAU, retention, NPS) | ✅ documentadas (`docs/launch-metrics.md`) |
| ASO | ✅ keywords definidas (`docs/play-store/seo-metadata.md`) |
| Beta testers | ✅ 2 internos, 12 Closed pendente |

---

## 21. 🗄️ Inventário Supabase — Score 6.7/10

→ Ver `04-supabase.md` (documento dedicado).

**Resumo:** RLS sólido + RPCs com state machines + CHECKs em DB + triggers cross-FK. **Bloqueadores P0:** `send-test-push` sem auth admin (BUG-002), email enumeration (BUG-015), rotação senha postgres pendente (BUG-013). **P2:** baseline migration vazio, RPC `extend_continuous_treatments` perdida (BUG-004), min_password_length=6.

---

## 22. 💸 Custos, cache, queries — Score 6/10

→ Ver `05-codigo.md` §4 (TanStack Query) e §3 (custos Supabase).

**Resumo:** `refetchOnMount: 'always'` global + `useDoses` polling 60s = anti-pattern. `Settings.jsx`, `Reports.jsx`, `Dashboard.jsx`, `notifications.js` são god-components. Bundle main 64 KB ✅ excelente. Migrar para staleTime estratégico antes de 1k MAU.

---

## 23. 📦 Análise de dependências — Score 7/10

→ Ver `05-codigo.md` §2.

**Resumo:** Stack atualizada. `typescript@^6.0.3` precisa verificação de legitimidade. `@capacitor-community/admob@8.0.0` desatualizado (dez/2023). Sem libs deprecated em uso. Lockfile presente. CI roda audit (continue-on-error para devDeps).

---

## 24. 🧹 Código morto e refactor — Score 7.5/10

→ Ver `05-codigo.md` §3 e §8.

**Resumo:** Console.log strippados ✅. Sem arquivos `.old`/`.bak`. ~15 TODO/FIXME documentados (referem-se a backlogs Plan). 2 docs antigos copiados para archive (`Plan_Suggestions.md`, `RoadMap.md`). God-components principais identificados — refactor backlog.

---

## 25. ✅ Validação cruzada Plan.md ↔ Realidade

> Verificação dos itens marcados `[x]` no `Plan.md`. Tabela de discrepâncias.

| Item Plan | Status | Confirmação |
|---|---|---|
| FASE 0.1 RLS + secrets (CONCLUÍDA) | ✅ **CONFIRMADO** | Migrations presentes (revoke_anon_grants, force_rls_user_prefs); SECURITY.md detalhado |
| FASE 0.2 LGPD (CONCLUÍDA) | ✅ **CONFIRMADO** | `/privacidade`, `/termos`, exportar/excluir conta em Settings (live nav) |
| FASE 0.3 Logic server-side (CONCLUÍDA) | ✅ **CONFIRMADO** | RPCs documentadas, triggers presentes |
| FASE 1 Capacitor (CONCLUÍDA) | ✅ **CONFIRMADO** | capacitor.config.ts, scripts npm, SecureStorage, SSL pinning |
| FASE 2 FCM + LocalNotif (CONCLUÍDA) | ✅ **CONFIRMADO** | Edge functions notify-doses + send-test-push, plugins capacitor |
| FASE 2.5 Alarme crítico nativo (CONCLUÍDA) | ✅ **CONFIRMADO** | 6 arquivos Java em `criticalalarm/` |
| FASE 3 Notifications central (CONCLUÍDA) | ✅ **CONFIRMADO** | services/notifications.js (588 LOC) |
| FASE 4.1 Export PDF/CSV (CONCLUÍDA) | ✅ **CONFIRMADO** | jspdf+html2canvas em deps + Reports.jsx lazy |
| FASE 4.2 Offline (CONCLUÍDA) | ✅ **CONFIRMADO** | TanStack persistor + useOnlineStatus |
| FASE 4.3 Ads (parcial) | ⚠️ **PARCIAL** | AdMob ID OK; AdSense placeholder ainda em `index.html` (BUG-006) |
| FASE 4.4 Visual&UX (CONCLUÍDA) | ✅ **CONFIRMADO** | theme.css, ícones flat |
| FASE 4.5 StatusBar+Deep links (CONCLUÍDA) | ✅ **CONFIRMADO** | AndroidManifest deep links + UpdateBanner |
| FASE 4.6 Assets icons/splash (CONCLUÍDA) | ✅ **CONFIRMADO** | mipmap-* presentes; ⚠️ ic_stat_dosy ausente (BUG-005) |
| FASE 5 Auditorias read-only (CONCLUÍDA) | ✅ **CONFIRMADO** | 7 docs em `docs/audits/Auditoria-4.5.X.md` |
| FASE 6 Migrations (CONCLUÍDA) | ⚠️ **PARCIAL** | infra OK; baseline `remote_schema.sql` está vazio (0 bytes) |
| FASE 7 P0 Quick Wins (CONCLUÍDA) | ✅ **CONFIRMADO** | revoke_anon, force_rls, ProGuard, focus-visible |
| FASE 8 Hardening DB (CONCLUÍDA parcial) | ✅ **CONFIRMADO** | CHECKs + trigger cross-FK presentes |
| FASE 9 Tests setup (CONCLUÍDA parcial) | ✅ **CONFIRMADO** | Vitest 66 tests, ESLint, CI |
| FASE 10 Quality Refactor (CONCLUÍDA parcial) | ✅ **CONFIRMADO** | ErrorBoundary, code splitting, source maps |
| FASE 11.1 FLAG_SECURE (CONCLUÍDA) | ✅ **CONFIRMADO** | usePrivacyScreen + uso em 4 telas |
| FASE 11.2 Network (CONCLUÍDA parcial) | ✅ **CONFIRMADO** | network_security_config OK |
| FASE 11.3 User-side (parcial) | ⚠️ **INFRA OK, UI NÃO-WIRED** | useAppLock pronto mas LockScreen não-wired ainda |
| FASE 12 A11y (CONCLUÍDA parcial) | ✅ **CONFIRMADO** | focus-trap-react em BottomSheet, skip-link, touch targets bumped |
| FASE 13 Performance avançada (parcial) | ✅ **CONFIRMADO** | rollup-plugin-visualizer + react-virtual em deps |
| FASE 14.1 PostHog (CONCLUÍDA) | ✅ **CONFIRMADO** | services/analytics.js + EVENTS catalog |
| FASE 15 UX Refinements (parcial) | ✅ **CONFIRMADO** | Undo + busca histórico |
| FASE 18.1 Docs legais (CONCLUÍDA) | ✅ **CONFIRMADO** | rotas /privacidade /termos |
| FASE 18.2 Play Console (parcial) | ⚠️ **PARCIAL** | tudo exceto vídeo FGS demo |
| FASE 18.3 Keystore (CONCLUÍDA) | ⚠️ **PARCIAL** | gerado, mas backup 3 locais ainda manual |
| FASE 18.4 AAB (CONCLUÍDA) | ✅ **CONFIRMADO** | dosy-release.keystore + scripts gradle dual-source |
| FASE 18.4.5 Hot-fixes (CONCLUÍDA) | ✅ **CONFIRMADO** | Sentry DSN, supabase 406, RPC missing, doseModal race |
| FASE 18.5 FAQ (CONCLUÍDA) | ✅ **CONFIRMADO** | live nav viu botão FAQ em Settings |
| FASE 19.1 Internal track (CONCLUÍDA) | ✅ **CONFIRMADO** | URL opt-in + 2 testers |

### Discrepâncias / itens [x] sem evidência clara
- FASE 6: `remote_schema.sql` vazio = baseline não-versionado de fato.
- FASE 4.3: AdSense web ainda placeholder.

---

## Score consolidado por dimensão

| # | Dimensão | Score |
|---|---|---|
| 1 | Confiabilidade alarmes/notificações | 8.5 |
| 2 | Segurança | 6.5 |
| 3 | Privacidade/LGPD | 8.0 |
| 4 | Arquitetura/qualidade código | 7.0 |
| 5 | Performance/memória | 7.5 |
| 6 | Usabilidade/navegação | 7.0 |
| 7 | UI/A11y | 6.0 |
| 8 | Feedback visual/loading | 6.5 |
| 9 | Lógicas de cadastro | 7.0 |
| 10 | Listas | 7.5 |
| 11 | Features específicas medicação | 6.5 |
| 12 | Casos de borda | 6.0 |
| 13 | Testes/qualidade | 4.0 |
| 14 | Observabilidade | 7.5 |
| 15 | Compliance lojas | 7.0 |
| 16 | Aspectos legais | 7.0 |
| 17 | Onboarding/suporte | 7.5 |
| 18 | Gestão de dados | 7.0 |
| 19 | Análise competitiva | N/A |
| 20 | Prontidão lançamento | 6.0 |
| 21 | Inventário Supabase | 6.7 |
| 22 | Custos/cache/queries | 6.0 |
| 23 | Dependências | 7.0 |
| 24 | Código morto/refactor | 7.5 |
| 25 | Validação Plan.md ↔ Realidade | 8.0 |
| | **MÉDIA GERAL** | **7.0** |

---

## Veredito final

**App está PRONTO COM RESSALVAS.**

Não está pronto para Produção (Open Testing público) sem resolver:
1. **BUG-002 (P0)** — `send-test-push` auth admin
2. **BUG-013 (P0)** — Rotacionar senha postgres histórica
3. **BUG-015 (P0)** — Email enumeration em send-test-push
4. **BUG-001 (P2)** — Encoding UTF-8 quebrado em nome
5. **BUG-005 (P1)** — `ic_stat_dosy` ausente
6. **Vídeo demo FGS** — bloqueador Closed Testing → Produção
7. **Sessão profunda 90min** em device físico real (FASE 17 Plan)

Está pronto para **Internal Testing** — já está há (Plan FASE 19.1).
Está **parcialmente pronto** para Closed Testing — pendente vídeo FGS + 12 testers.
Não está pronto para Open Testing / Produção pública.

**Pergunta-chave do auditor:**
> *"Eu colocaria minha mãe ou meu filho para usar este app amanhã, em produção, dependendo dele para tomar a medicação certa, na hora certa, todo dia?"*

**Resposta: Não com convicção total — ainda.**

O alarme crítico nativo é genuinamente sólido (auditoria estática indica robustez). A RLS é defesa-em-profundidade. A LGPD está coberta. **MAS:**
- Sem teste real em devices Android (Pixel + 1 OEM hostil) → não dá pra garantir alarme em todas as condições reais.
- BUG-001 (encoding) gera dúvida sobre integridade dos dados.
- BUG-002 (Edge Function admin sem proteção) é vetor de ataque ativo agora.
- Sem métrica `notification_delivered` em PostHog, regressão silenciosa em alarme passa despercebida.

Após resolver os 7 pontos acima + validação device físico (FASE 17), a resposta vira um SIM convicto.
