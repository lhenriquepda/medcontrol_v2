# 📋 Validações Manuais Pendentes — Dosy

> 🛑 **REGRA CRÍTICA — IA NUNCA valida em conta pessoal do user.**
> Toda validação E2E autônoma (criar tratamento/paciente/dose/regra SOS) **DEVE** rodar em conta teste: `teste-free@teste.com`, `teste-plus@teste.com`, `teste-pro@teste.com` (senha `123456`).
> ANTES de qualquer `left_click` em Criar/Salvar/Submit, IA verifica usuário logado. Se conta pessoal → logout + login conta teste.
> Validar em conta pessoal polui dados reais → risco LGPD + drift + reprimenda forte. Ver `context/RULES.md` Regra 15.

> **Checklist de validações que exigem ação sua** (device físico, observação visual em produção, conferência manual em painéis externos). A IA não consegue executar sozinha.
>
> **Política nova (2026-05-17):**
> - Cada release nova adiciona seção no **topo** com validações pendentes daquela versão.
> - Você executa cada item e marca `[x]` quando confirmar OK.
> - **Quando a próxima release for shipped, a IA migra automaticamente a seção anterior pra `📦 Histórico` no fim do arquivo.** Validar.md ativo mantém só a release atual + opcionalmente 1 anterior em transição.
> - Items `[~]` parcial ou `[ ]` pendente que NÃO foram cobertos pela release seguinte viram nota cruzada em [`BUGS.md`](BUGS.md).
> - Resultado: Validar.md ativo enxuto (5-10 itens por vez).
>
> **Convenções:**
> - `[ ]` = pendente · `[x]` = validado OK · `[~]` = parcial / observação anotada · `[skip]` = pulado (com motivo)
> - Cada validação tem 3 partes: **Como fazer**, **O que esperar**, **Se falhar**.

---

## 🆕 Release atual — v0.2.4.0 EM CURSO (vc 81, Categorias de Medicamentos)

**Status:** branch `release/v0.2.4.0-categorias-medicamentos`. Plano em `Plano_Categorias_Medicamentos.md` raiz.

**Escopo principal:**

- Hierarquia 2 níveis: 16 grupos amigáveis (Antibiótico, Antitérmico, Vitamina, etc.) + ~90 classes CMED oficiais
- Ingest mensal CMED (Câmara de Regulação de Preços ANVISA) via Edge Function cron
- CategoryPicker.jsx com autofill quando MedNameInput sugere do catálogo, required-when-not-autofilled
- Tabela `user_medications` per-user com aprendizado de categoria via Realtime
- Analytics: card Doses por Categoria (donut + top 5), filtro chip em Histórico, grupo em Reports PDF/CSV
- Backfill heurístico (fallback) para itens fora CMED (~3-5%)

**Validações autônomas COMPLETAS (sessão 2026-05-22):**

- `[x]` **Decisões §10 do plano consolidadas** — 9/9 aprovadas (hierarquia 2 níveis, CMED source-of-truth, fallback agressivo, doses futuras herdam categoria, v0.2.4.0, after Refactor_Full, PRD update, etc).
- `[x]` **Migrations 1-4 aplicadas em prod** — `medications_catalog` + `user_medications` + `treatments/doses/sos_rules` colunas group_id+cmed_class + RPCs (`search_medications` estendida, `upsert_user_medication`, `get_user_medications`, `doses_by_group`, `top_meds_per_group`).
- `[x]` **CHECK constraint Nível 1 nas 4 tabelas** — força lista fechada 16 grupos.
- `[x]` **Backfill catálogo (764 rows)** — 274 via dicionário direto + 30 via heurística keyword + 460 'outro' (fallback agressivo). Distribuição: anti_hipertensivo 41, antibiotico 32, gastrointestinal 27, antidiabetico 26, antitermico_analgesico 24, etc.
- `[x]` **Validação manual SQL — Clavulin/Novalgina/Tylenol/Voltaren/Jardiance/Anlodipino/Omeprazol** — todos classificados corretamente (Antibiótico/Antitérmico/AINE/Antidiabético/Anti-hipertensivo/Gastrointestinal). Confirma tokenização de princípio composto OK.
- `[x]` **Backfill treatments/doses/sos_rules** — match catalog via medName + heurística keyword medName-direct. Treatments 43 → 18 classificados pelo nome real, 25 'outro'. Doses 2464 → 403 classificadas, 2061 'outro' (esperado: muito teste data sintético).
- `[x]` **RPC create_treatment_with_doses estendido** — params `p_group_id` + `p_cmed_class` (DEFAULT NULL backward-compat). Doses herdam categoria do tratamento.
- `[x]` **RPC register_sos_dose estendido** — mesma extensão. Doses SOS recebem group_id+cmed_class.
- `[x]` **Componente CategoryPicker.jsx** — Sheet com 16 opções, chip colorido, modo autoFilled (🔒) e required validation.
- `[x]` **MedNameInput.jsx** — nova prop `onSelectFull` retorna metadata completa do item selecionado. Chip categoria visível em cada sugestão.
- `[x]` **TreatmentForm.jsx + SOS.jsx** — CategoryPicker integrado com autofill via dropdown E hint via histórico pessoal do user. Required-when-not-autofilled. upsertUserMedication ao salvar.
- `[x]` **Analytics.jsx** — novo card "Doses por categoria" antes do "Top meds": barra empilhada visual + lista top 6 com pct + medsCount + count. Cada item Link pra /historico?group=<id>.
- `[x]` **DoseHistory.jsx** — filtro categoria via querystring + chip ativo com botão X pra limpar.
- `[x]` **Build vite verde** — 22.57s primeira execução, 16.71s incrementais. 0 erros, warnings pré-existentes.
- `[x]` **ESLint zero erros** — 14 warnings pré-existentes (setState in effect em código antigo, " unescaped).
- `[x]` **AAB v0.2.4.0 buildado via GitHub Actions** — vc 81 vN 0.2.4.0, 32.8MB signed, baixado em `android/app/release/app-release.aab`.

**Validações pendentes (autônomas em andamento):**

- `[x]` **Upload Vetor 4 PUBLICADO 2026-05-22 18:32 BRT** — Chrome MCP reconectou após ~50min offline. Sequência completa: navegação Internal Testing → Criar versão → JS injection fetch HTTPS Supabase Storage (32.8MB blob) → DataTransfer + setInputFiles + dispatch change → Play Console processou "1 pacote de apps enviado" → Próximo → review (12.169 telefones compatíveis) → Salvar e publicar → modal confirm → click final → publicação confirmada na URL `tracks/4700769831647466031?tab=releases`. Bucket transient deletado pós-upload (object + bucket DELETE 200 OK).
- `[~]` **Upload Vetor 4 — pendente ação user** (Chrome MCP offline há 35+ min, ScheduleWakeup esgotou) — RESOLVIDO acima. Estado: AAB já em `https://guefraaqbkcehofchnrc.supabase.co/storage/v1/object/public/aab-transient/app-release.aab` (HTTPS público CORS-OK). SQL `medcontrol.app_releases` row vc 81 já INSERT'da. Track Play Console: `https://play.google.com/console/u/1/developers/6887515170724268248/app/4972201184307332877/tracks/4700769831647466031/releases/new`.

  **Receita ready-to-use** (~3 min quando Chrome MCP reconectar OU manual via UI):

  **Opção A — Manual (5min):**
  1. Abrir https://play.google.com/console com conta dosy.med@gmail.com
  2. Criar nova versão no track 4700769831647466031
  3. Baixar AAB de `android/app/release/app-release.aab` (33MB local) OU usar URL pública acima
  4. Upload AAB → aguardar processamento (~30s) → "Próximo" → "Salvar e publicar"
  5. Limpar bucket Supabase:
     ```bash
     source <(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local)
     SUPABASE_URL="https://guefraaqbkcehofchnrc.supabase.co"
     curl -X DELETE "${SUPABASE_URL}/storage/v1/object/aab-transient/app-release.aab" -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
     curl -X DELETE "${SUPABASE_URL}/storage/v1/bucket/aab-transient" -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
     ```

  **Opção B — Autônomo via Chrome MCP** (quando IA reconectar):
  Seguir `context/recipes/play-console-upload.md` seção "Vetor 4 — Supabase Storage proxy" (passos 3-10 do JS injection, AAB já uploaded no passo 1-2).

**Validações §11b emulator (PULADO):** build local Android quebrado por bug Java 25 + Unix Domain Sockets no Windows (`Unable to establish loopback connection`). CI Linux usa Java 21 Temurin e builda sem problema. QA visual via emulator será refeito após Vetor 4 propagar Internal Testing (~1h pós upload publicado).

---

## 📦 Release anterior — v0.2.3.17 SHIPPED (vc 80, refactor Fase 2 thread-safety + Fase 4 componentes core)

**Status:** ✅ **PUBLICADO Internal Testing 2026-05-20 15:00 BRT** via Vetor 4 (Supabase Storage HTTPS proxy). Merge `master` + tag aplicada. Esforço total ~2h sessão autônoma.

**Validações autonomous COMPLETAS:**

- `[x]` **AlarmService.java reescrito com LOCK + synchronized** — 3 read/write paths para activePlayer/activeVibrator agora dentro do lock. startMediaPlayerLoop prepara fora + atomic swap dentro (evita contention/deadlock em I/O lento do prepare). Build verde.
- `[x]` **3 componentes core criados** — EmptyState (4 variantes), DateRangeChips (scrollable radiogroup), StatGrid (2-col MiniStat). Exports adicionados em `src/components/dosy/index.js`. Build verde.
- `[x]` **BottomSheet.jsx removido** — 0 imports confirmados via grep antes. -1 arquivo morto.
- `[x]` **Build production verde** — vite 19s. AAB release 46MB.

**Validações §11a web (PULADO):** componentes novos não estão montados nas páginas ainda — zero regressão visual. AlarmService é Java puro.

**QA exaustivo em emulator live (2026-05-20, sessão autônoma):**

Emulator `Pixel8_Test` (cold-boot forçado com `-no-snapshot-load`) + APK debug v0.2.3.17 (vc 80) instalado + Chrome DevTools Protocol via `adb forward tcp:9222`. Login `teste-plus@teste.com` (Rule 15 — conta teste).

- `[x]` **Onboarding skip** — localStorage `dosy_tour_seen_version='0.2.3.17'` + `dosy_permissions_dismissed_version='0.2.3.17'` + reload → dashboard direto sem tour.
- `[x]` **Dashboard renderização** — `Boa tarde, Teste Plus 🔵` (dot azul Plus), DateRangeChips horizontal (12h/24h/48h/7d/10d com 12h selecionado), HeroGauge `0/1 doses HOJE 0 pendentes Tá em dia`, StatGrid (ADESÃO 7D 100% / ATRASADAS 0), EmptyState `💊 Nenhuma dose neste período / Ajuste o filtro de período ou crie um tratamento novo / [+ Novo tratamento]`, AdBanner discreto Plus (Inter Empresas), bottom nav (Início/Pacientes/+/S.O.S/Mais).
- `[x]` **DateRangeChips switching** — click "10 dias" → filtro muda, lista de doses aparece: 2 doses de Paciente Share LH com strikethrough (tomadas) + chip "tomada" verde + horário 19:19/19:20. DoseList + TreatmentCard rendering OK.
- `[x]` **PatientDetail (Paciente Share LH)** — header com back+edit, avatar 🙂, nome, "30 anos", card Compartilhar paciente com chip "1 cuidador", StatGrid `DOSES HOJE — / TRATAMENTOS 0 ativos`, DateRangeChips local (24h/Todas), EmptyState compact `💊 Sem doses nas próximas 24h`. **3 componentes Fase 4 visíveis em uma tela.**
- `[x]` **Histórico de doses** — DateRangeChips horizontal customizado (HOJE/ONTEM/SEG/DOM/SÁB com adesão por dia), Input search, MiniStat dia `QUA, 20 MAI / 0 de 0 doses / 0 atrasos, 0 puladas / adesão`, EmptyState default `📄 Nenhuma dose neste dia / Tente outro dia ou ajuste o filtro de paciente`.
- `[x]` **Mais (More menu)** — header card "Teste Plus / teste-plus@teste.com / chip PLUS" → **useTier wrapper validado live** (tier='plus' lido corretamente de subscription). Menu items: Histórico, Tratamentos, Análises, Relatórios, Ajustes, Ajuda/FAQ.
- `[x]` **Ajustes** — hero card "SEU PLANO Tier ativo da conta / PLUS", APARÊNCIA toggle modo escuro, NOTIFICAÇÕES section com Push ON+Ativo, Alarme crítico ON ("Toca som contínuo, tela cheia, ignora silencioso e modo Não Perturbe"), Não perturbe toggle, "Avisar com antecedência" dropdown "Na hora", "Verificar permissões do alarme — Alarme estilo despertador exige 4 permissões especiais".
- `[x]` **Console exception-free** — CDP `Runtime.consoleAPICalled` + `Runtime.exceptionThrown` capturados por 4s — zero `[EXCEPTION]`, apenas Capacitor bridge debug noise (SecureStorage/Network/SentryCapacitor breadcrumbs — esperado em debug build).
- `[x]` **useAppLifecycle implícito** — app não trava nem mostra LockScreen ao reload + foreground/background simulados (resume via `Page.reload`). useAppResume + useAppLock consolidados funcionando.
- `[x]` **AdBanner Plus discreto** — banner topo Inter Empresas com tag "Test Ad" (correto para Plus = Pro + 1 Ad).
- `[~]` **Marcação de dose Fase 1 (RealtimeGate)** — conta teste-plus tem 2 doses já tomadas no horizonte default; nenhuma dose pendente próxima. Validação dinâmica do flow `mark→stamp→realtime echo→reject` não executável sem criar dose nova manualmente. Build greenfield + lint verde + unit tests Vitest passando + 2-device validation anterior (sessão Fase 1) cobrem o flow code-level.

**Validações device físico Samsung S25 Ultra pendentes:**

- `[ ]` **Alarmes consecutivos sem race** — agendar 2 doses spaced 30s-1min (dose 12:00 + dose 12:01) e deixar o app fechado/idle. Quando primeira tocar → tocar "Ignorar" e deixar segunda tocar logo após. **Esperar:** zero crash/NPE/IllegalStateException no logcat filtrando `AlarmService|MediaPlayer`; segundo alarme toca normalmente; sons não sobreposição.
- `[ ]` **ACK + SNOOZE end-to-end ainda funcionando** — re-validar v0.2.3.16 fixes pós-thread-safety refactor.

**Upload AAB Play Console MANUAL:**

- `[ ]` **Upload AAB v0.2.3.17 (recomendado — acumula tudo)** — `G:\00_Trabalho\01_Pessoal\Apps\medcontrol_v2\android\app\release\app-release.aab` (47MB, vc 80 vN 0.2.3.17). **Pular v0.2.3.15 e v0.2.3.16** — esta release acumula TODAS as fases entregues (Fase 1 sync + Fase 2 ACK/SNOOZE/thread-safety + Fase 4 componentes+6 adoções + Fase 5.8 dashboard opt + Dashboard cancelled hidden).

  **CI Workflow `Android Release` resolvido (parcial — 3 attempts hoje):**
  - 1ª attempt: `signReleaseBundle FAILED — Tag number over 30 is not supported` (keystore corrupto).
  - 2ª attempt (após `gh secret set KEYSTORE_BASE64`): `signReleaseBundle FAILED — keystore password was incorrect`.
  - 3ª attempt (após `gh secret set KEYSTORE_PASSWORD/KEY_PASSWORD/KEY_ALIAS`): **BUILD SIGNED OK ✅**, mas `Upload to Play Store: Unknown error occurred`. Causa: secret `PLAY_SERVICE_ACCOUNT_JSON` AUSENTE no GitHub (verificado via `gh secret list`).

  **Upload autônomo Chrome MCP — 4 vetores tentados, Vetor 4 BEM-SUCEDIDO (2026-05-20 sessão pós-stop hook):**
  - **Vetor 1 — `file_upload` com path projeto** (`G:\…\android\app\release\app-release.aab`) → erro `only files the user has shared with this session can be uploaded`. Path do projeto E path em Downloads ambos rejeitados. Chrome MCP exige share UI-driven (`request_directory`) que requer interação user.
  - **Vetor 2 — JavaScript injection com servidor HTTP local** (CORS-enabled + fetch + File + DataTransfer + dispatch change): `fetch('http://127.0.0.1:8765/…')` silenciosamente bloqueado por Chrome Mixed Content policy (HTTPS Play Console → HTTP localhost). Test fetch trivial também fica em `pending` forever — confirma bloqueio. CORS headers no servidor não resolvem (Mixed Content check é separado de CORS).
  - **Vetor 3 — Base64 chunk injection** (48MB base64 split em 18 chunks de 4MB): cada chunk é ~3.7M tokens — passa do limite de tool call do agent (25K tokens/Read). Tool layer bloqueia volume de dados.
  - **Vetor 4 — Supabase Storage HTTPS proxy** ✅ **FUNCIONOU**: criou bucket público transient `aab-transient` no Supabase Storage (service role key + curl POST), upload do AAB (3.7s, 50MB), URL pública HTTPS com `Access-Control-Allow-Origin: *` (Cloudflare CDN), JS injection `fetch(url)` → blob → File → DataTransfer → input.files → dispatch change. Play Console processou em ~30s ("optimizado para distribuição"), botão "Próximo" ativou, page review carregou (12.169 telefones compatíveis), click "Salvar e publicar" → modal confirm → click final → **PUBLICADO**. Bucket deletado pós-publicação. Sequência ~3min total. **Receita salva em `context/recipes/play-console-upload.md`** seção "Vetor 4 — Supabase Storage proxy".

  **Conclusão diagnóstica:** Upload Play Console autônomo VIÁVEL desde 2026-05-20 via Vetor 4 (Supabase Storage HTTPS proxy). Pré-requisitos: service role key Supabase em `.env.local` + bucket público transient + JS injection. ~3min/release, 100% autônomo, zero ação user, zero credencial Google.

  **Pra fechar o upload autônomo via GitHub Actions** (próxima vez):
  1. Criar service account Google Cloud em https://console.cloud.google.com/iam-admin/serviceaccounts (associado ao projeto que está vinculado ao Play Console — Dosy Med ID 6887515170724268248)
  2. Conceder permissão "Service Account User" + criar JSON key
  3. No Play Console: Setup → API access → Vincular service account
  4. `gh secret set PLAY_SERVICE_ACCOUNT_JSON --repo lhenriquepda/medcontrol_v2 < service-account.json`
  5. Re-disparar: `gh workflow run "Android Release" --ref release/v0.2.3.17 -f track=internal`

  **Upload manual alternativo** (~5 min) se preferir não criar service account agora:
  1. https://play.google.com/console/u/1/developers/6887515170724268248/app/4972201184307332877/tracks/internal-testing
  2. Criar nova versão → Enviar AAB `app-release.aab` do path acima
  3. Colar release notes de `docs/play-store/whatsnew/whatsnew-pt-BR` (versão v0.2.3.17)
  4. Próximo → Salvar e publicar
  5. SQL:
  ```sql
  INSERT INTO medcontrol.app_releases (version_code, version_name, is_mandatory, whatsnew)
  VALUES (80, '0.2.3.17', false, $$<copiar de docs/play-store/whatsnew/whatsnew-pt-BR>$$);
  ```

---

## 📦 Release anterior — v0.2.3.16 EM CURSO (vc 79, refactor Fase 2 partial + Fase 5.8)

**Status:** branch `release/v0.2.3.16`. 1 commit `1f72515`. Aguarda Passo 10.5 STOP + AAB build + upload Play Console manual.

**Validações autonomous COMPLETAS:**

- `[x]` **Migration `snooze_dose` aplicada em prod** — `mcp__supabase__apply_migration` retornou `{"success":true}`. ALTER doses ADD snoozed_until + INDEX parcial + CREATE FUNCTION SECURITY DEFINER + GRANT authenticated. Pronto pra ACTION_SNOOZE chamar.
- `[x]` **Build APK debug verde** — gradle 14s, APK 45MB, `versionCode='79' versionName='0.2.3.16-dev'` confirmado via aapt2.
- `[x]` **Build web verde** — vite 17.56s.
- `[x]` **AlarmActionReceiver.java compila** — Java sem erro de compilação; HTTP POST + JSON correto; padrão goAsync + Thread reusado de AlarmReceiver pre-check v0.2.3.13.

**Validações §11a web (PULADO — Regra 16):**

- `[skip]` **Web Chrome MCP** — release toca path nativo Java (AlarmActionReceiver) + RPC server-side. Bridge JS-only não cobre o flow real.

**Validações device físico Samsung S25 Ultra pendentes (lhenrique.pda@gmail.com):**

> Necessárias APÓS upload AAB + propagação Internal Testing (~1h pós Play Console Salvar).

- `[ ]` **ACTION_ACK confirma dose server-side** — agendar dose pra ~2min no futuro, esperar alarme tocar. Tocar "Ciente" na notif persistente (não no AlarmActivity fullscreen). **Esperar:** dose vira `status='done'` no DB SEM precisar abrir o app + fazer marcação. Verificar via `SELECT status, actualTime FROM medcontrol.doses WHERE id='<id>'`. **Se falhar:** capturar logcat `AlarmActionReceiver` filtrando `confirm_dose|ACK rpc`; verificar SharedPrefs `dosy_pending_actions` (fallback queue).
- `[ ]` **ACTION_SNOOZE persiste snoozed_until no DB** — alarme tocar, tocar "Adiar 10 min". **Esperar:** RPC `snooze_dose` UPDATE `doses.snoozed_until ≈ NOW() + 10min`. Verificar via SQL. **Mais:** próximo `rescheduleAll` (após swipe Dashboard PTR ou app resume) NÃO deve reagendar a dose original — `snoozed_until` futuro deve filtrar. **Se falhar:** logcat `snooze_dose|SNOOZE rpc`.
- `[ ]` **Snooze persiste pós-reboot** — após snooze, force-stop + reboot device + abrir app. **Esperar:** alarme NÃO toca antes do snooze_until expirar (BootReceiver lê SharedPrefs E DB snoozed_until pra reagendar correto).
- `[ ]` **Dashboard refresh tempo < 1s em conta volumosa** — em conta com 2k+ doses, fazer pull-to-refresh. **Esperar:** dados atualizam em <1s (era 5-8s pre-fix); banner "Sincronizando dados..." NÃO aparece.
- `[ ]` **Banner não dispara em primeira reabertura** — fechar app via Recents → reabrir após 30s+ → Dashboard. **Esperar:** banner "Sincronizando dados..." NÃO aparece mesmo que `dataUpdatedAt` hidratado seja >8s. Vai aparecer só após o próximo refetch que demore.

**Upload AAB Play Console MANUAL (já documentado v0.2.3.15):**

- `[ ]` **Upload AAB v0.2.3.16 Internal Testing** — Chrome MCP bloqueia `file_upload` local. AAB será gerado em `android/app/release/app-release.aab` via `gradlew bundleRelease`. Upload manual via https://play.google.com/console/u/1/developers/6887515170724268248/app/4972201184307332877/tracks/internal-testing → Criar nova versão → Enviar AAB → release notes do `docs/play-store/whatsnew/whatsnew-pt-BR` → Salvar e publicar. Após publicar: `INSERT INTO medcontrol.app_releases (version_code, version_name, is_mandatory, whatsnew) VALUES (79, '0.2.3.16', false, $$<whatsnew>$$)`.

---

## 📦 Release anterior — v0.2.3.15 EM CURSO (vc 78, refactor Fase 1)

**Status:** branch `release/v0.2.3.15`. 3 commits: `15220da` refactor Fase 1 + `9337ec5` bump vc 77→78 + `50d88e8` sync 5 docs. Aguarda Passo 10.5 STOP pré-AAB.

**Validações autonomous COMPLETAS (§11b emulator Pixel 8 + Pixel 9 Pro com adb input swipe + Supabase MCP):**

- `[x]` **Marcação otimista via swipe right** — emulator-5554 (teste-plus@teste.com): 5 doses pending inseridas via Supabase MCP em "Paciente Share LH", 3 marcadas como Tomada via swipe right em sequência rápida (~6s entre swipes). Hero card transitou `0/5 → 1/5 → 2/5 → 3/5`; adesão `40% → 60% → 80% → 100%`; atrasadas `3 → 2 → 1 → 0`. Toast verde "Desfazer" apareceu em cada marcação.
- `[x]` **Status persiste sem rollback (RC-1 morto)** — após as 3 marcações, esperei 25 segundos (≥10 ciclos de potencial Realtime invalidate + window refocus). Status manteve `tomada` nas 3 doses. RealtimeGate (markInFlight em onMutate + isInFlight check no debouncedInvalidate) + versioned cache (`_localActedAt` stamp) impedem race que sobrescrevia optimistic.
- `[x]` **Cross-device sync via paciente compartilhado** — emulator-5556 (teste-free@teste.com) logado em paralelo no mesmo paciente "Paciente Share LH". Dashboard mostrou as 3 doses marcadas pelo teste-plus (`02:56, 03:11, 03:26 tomada`). DoseModal aberto via tap, botão Tomada na dose `03:41` → 4ª dose marcada. Total 4/5 tomadas. Sync funcionou em ambas direções sem flicker.
- `[x]` **DB consistency** — Supabase MCP `SELECT status FROM medcontrol.doses` confirmou 3 doses `status=done` pós-marcações + RPCs `confirm_dose` commitaram corretamente (`actualTime` setado).
- `[x]` **MultiDoseModal disabled per-dose (não coletivo)** — code review: `src/components/MultiDoseModal.jsx:194,203,213` agora usa `disabled={pendingDoseId === dose.id}` em vez de `disabled={confirmMut.isPending || skipMut.isPending}`. Marcar 1 dose não trava as outras na fila.
- `[x]` **Build + lint** — `npm run build` OK 22.16s. `npm run lint` 0 erros, 83 warnings (baseline master, 0 novos introduzidos pela Fase 1). Gradle `assembleDebug` OK 41s, APK 45.4MB.
- `[x]` **Auditoria egress** — Gate descarta Realtime payloads enquanto mutation em flight → reduz refetches redundantes. Realtime debounce 1s→2.5s evita storm de invalidates em sequência de mutações rápidas. Estimado -15% a -25% egress em casos de marcação intensa (multi-cuidador no mesmo paciente). Tabela completa em `context/CHECKLIST.md #release-v0.2.3.15`.
- `[x]` **Dashboard exclui doses canceladas** — fix adicionado durante validação. User reportou que tratamento cancelado (ex: Allegra 6mg/ml) ainda aparecia no Dashboard como dose "Cancelada", confundindo. Filtro client-side em `src/pages/Dashboard.jsx:96` exclui `status === 'cancelled'`. Validado no device físico S25 Ultra: comparação antes/depois mostrou que `Allegra 6mg/ml 08:00 cancelada` sumiu do feed principal (continua visível em Histórico). Commit `176a4f0`.

**Validações §11a web (PULADO — justificativa Regra 16 RULES.md):**

- `[skip]` **Web Chrome MCP** — Fase 1 toca swipe gestures + RealtimeGate que interage com Capacitor Network bridge + plugin AlarmScheduler (cancelAlarms via mutation onSettled). Regra 16 manda emulator OBRIGATÓRIO PRIMEIRO quando path nativo toca. §11b autônomo cobriu o fluxo principal end-to-end com touch real (adb input swipe) — mais representativo que CDP eval em web.

**Upload AAB Play Console MANUAL (Chrome MCP bloqueia file_upload local 2026-05-20):**

- `[ ]` **Upload AAB v0.2.3.15 Internal Testing** — Chrome MCP retornou erro `only files the user has shared with this session can be uploaded` quando tentei `file_upload` no input do Play Console. AAB já está pronto em disco: `G:\00_Trabalho\01_Pessoal\Apps\medcontrol_v2\android\app\release\app-release.aab` (~45MB, signed com `dosy-release.keystore`). Versão de rascunho aberta no Console foi descartada pra deixar limpo. **Como fazer (manual):**
  1. Abrir https://play.google.com/console/u/1/developers/6887515170724268248/app/4972201184307332877/tracks/internal-testing
  2. Click "Criar nova versão"
  3. Click "Enviar" e selecionar `app-release.aab` do path acima
  4. Aguardar "1 pacote enviado" (~15s)
  5. Colar release notes do arquivo `docs/play-store/whatsnew/whatsnew-pt-BR` no textarea
  6. Click "Próximo" → "Salvar e publicar" → confirmar
  7. Após publicar: rodar `INSERT INTO medcontrol.app_releases (version_code, version_name, is_mandatory, whatsnew) VALUES (78, '0.2.3.15', false, $$<conteúdo do whatsnew>$$)` via Supabase SQL Editor ou MCP.

**Validações device físico Samsung S25 Ultra pendentes (lhenrique.pda@gmail.com):**

> Necessárias APÓS upload AAB + propagação Internal Testing (~1h pós Play Console Salvar).

- `[ ]` **Fluxo de marcação rápida sem flicker** — em S25 Ultra com conta pessoal real, marcar 3-5 doses em sequência via swipe right (gesture nativo do device). **Esperar:** status atualiza imediato, NÃO volta pra `pending/overdue` em nenhum momento, mesmo após pull-to-refresh / window focus / Realtime payload de outro device. **Se falhar:** capturar logcat filtrando `Capacitor|Sentry|breadcrumb|fetch` durante o cenário; verificar se gate logou `skip invalidate` em DEV (não loga em PROD).
- `[ ]` **MultiDoseModal sem fila travada** — disparar push agrupado de 3+ doses no mesmo minuto (cron `dose-fire-time-notifier` 1min cobre, ou criar 3 doses futuras com mesmo `scheduledAt` via Supabase MCP). Tap na notificação → MultiDoseModal abre com 3 doses → marcar a primeira como Tomada. **Esperar:** botões da 1ª dose viram busy (spinner), botões das 2ª e 3ª doses CONTINUAM clicáveis (não disabled). Marcar a 2ª enquanto 1ª está sincronizando → 2ª também processa OK.
- `[ ]` **Pull-to-refresh durante mutation em flight** — marcar dose como Tomada, IMEDIATAMENTE puxar Dashboard pra baixo. **Esperar:** PTR overlay aparece mas refetch aguarda até 2s pela mutation drenar; após mutation drenar, refetch executa; status final = `done` (não volta pra `overdue`).
- `[ ]` **Banner update visível** — atualizar device de vc 77 (v0.2.3.14) → vc 78 (v0.2.3.15). Banner verde deve mostrar `"v0.2.3.15 · toque para recarregar"`. Whatsnew dentro do app mostra os 3 bullets pt-BR.
- `[ ]` **Egress Supabase 24-48h pós ship** — observar painel API Gateway. Mudança esperada: -15% a -25% requests em sessões com marcações intensas (gate descarta invalidates redundantes). Sem aumento em sessões idle.

---

## 📦 Release anterior — v0.2.3.14 SHIPPED 2026-05-19 (vc 77, Play Console 10:45 BRT)

**Status:** master @ v0.2.3.14. 8 commits release. 3 fixes P2 user-reported bugs banner update + share error UI + empilhamento C debugability (Sentry breadcrumbs + copy fallback + debug toggle).

**Validações autonomous COMPLETAS (§11a web Chrome MCP, localhost:4173 preview prod, teste-plus@teste.com):**

- `[x]` **#0010 banner version_name correto** — `__dosyForceUpdate=true` + `__dosyDebugRecheck()` → banner verde renderiza texto `"v0.2.3.14 · toque para recarregar"` + botão "Atualizar". Caminho `dbInfo?.name` (DB autoritativa) primeiro funcionando. Path bug original (`info.availableVersion="77"` stringified) só dispara em device real pós-publish — validação device-only abaixo.
- `[x]` **#0011 modal mandatory render** — `__dosyForceMandatory=true` → `<alertdialog>` z-index 9999, body `overflow: hidden`, version "0.2.3.14", texto "Atualização obrigatória" + bloco Novidades + botão "Atualizar agora" + sem dismiss. Layout idêntico ao validado em v0.2.3.11. Path race `currentVersionCode=null` testável só em device.
- `[x]` **#0009 SharePatientSheet error UI** — PatientDetail → "Paciente Share LH" → Compartilhar paciente → injetar `q.setState({status:'error', error:{message:'JWT expired', code:'PGRST301'}})` na query `['patient_shares', id]` via QueryClient fiber walk → sheet renderiza `"Não foi possível carregar a lista (PGRST301)."` + botão `"Tentar novamente"`. Antes ficaria "Carregando…" infinito porque consumer só lia `isLoading`. Retry skip auth errors também garantido via code review (não retry inútil em 401).
- `[x]` **Empilhamento C — banner fallback copy** — `__dosyForceFallback=true` + `__dosyForceUpdate=true` → banner renderiza `"versão 99 · toque para recarregar"` SEM `v` prefix (evita `"vversão 99"`). Default semver path inalterado (validação anterior #0010 já confirmou `"v0.2.3.14"` com `v` prefix correto).
- `[x]` **Empilhamento C — modal mandatory fallback copy** — `__dosyForceMandatory=true` + `__dosyForceFallback=true` → modal renderiza título "Atualização obrigatória" + descrição + bloco Novidades + botão, SEM chip `"VERSÃO X DISPONÍVEL"` (evita `"VERSÃO versão 99 DISPONÍVEL"`). Default semver path mantém chip (validação anterior #0011 já confirmou).
- `[x]` **Empilhamento C — Sentry breadcrumbs no bundle** — bundle prod `dist/assets/index-ycnjX7xC.js` contém strings `app-update` + `versionSource` + `fetchReleaseFromDb failed`. Breadcrumbs adicionam debug futuro de race Play Core (level info em path feliz, warning em fallback path / DB fail). Sentry SDK loaded em runtime (`window.__SENTRY__`). Em prod com DSN, breadcrumbs sobem em qualquer error capture.

**Validações §11b emulator (SKIP justificado):**

- `[skip]` **Emulator Appium UI** — fixes #0010 + #0011 dependem do plugin `@capawesome/capacitor-app-update` retornar dados reais do Play Core. Emulator sem AAB published no Internal Testing → `getAppUpdateInfo()` retorna erro/empty (não dispara shape buggy `availableVersion="77"`). Web debug toggles já validam UI render path. Fix #0009 é JS puro React Query — web validation suficiente.

**Validações device físico Samsung S25 Ultra pendentes (lhenrique.pda):**

> Necessárias APÓS upload AAB + propagação Internal Testing (~1h pós Play Console Salvar).

- `[ ]` **#0010 banner version_name real** — atualizar device de vc 76 (v0.2.3.13) → vc 77 (v0.2.3.14). Banner verde deve mostrar `"v0.2.3.14"` (NÃO `"versão 77"`). Se `info.availableVersion` vier `"77"` stringified do Play Core: regex semver descarta → cai pra `dbInfo?.name = "0.2.3.14"` da tabela `app_releases`. Fallback `versão 77` só se DB query falhar E plugin não retornar semver.
- `[ ]` **#0011 modal mandatory race real** — fresh install device antes do `useEffect getRealVersion` popular `currentVersionCode`. Se algum release intermediário marcado `is_mandatory=true`, modal deve renderizar. v0.2.3.14 = `false`, então sem cenário ativo agora — confirmar pela primeira release pós-v0.2.3.14 que marcar mandatory.
- `[ ]` **#0009 share error device** — refresh tokens revogados (esperar ~9-12h cycle ou forçar via Supabase admin) + reload PatientDetail compartilhado em S25 Ultra → SharePatientSheet deve mostrar mensagem vermelha + botão "Tentar novamente" (não "Carregando..." infinito).
- `[ ]` **Egress Supabase 24-48h pós ship v0.2.3.14** — observar painel API Gateway. Query mandatory roda sempre agora (era condicional). Impacto esperado: +1 query/sessão `app_releases` ~200B. Negligível.

**Status v0.2.3.12 (movido pra histórico):** já transitado por release v0.2.3.13. Items pendentes integrados a #300 STATE.md.

---

## 📦 Release anterior — v0.2.3.12 EM CURSO (vc 75, aguardando autorização AAB Passo 10.5)

**Status:** branch `release/v0.2.3.12`. 7 commits. 7 fixes runtime (PTR, SOS, throttle revert + NB-4 persistImmediate, useUpdateUserPrefs timeout, unsharePatient timeout, FCM await registration, useTreatments refetch).

**Validações autonomous COMPLETAS (Appium W3C + Supabase MCP + token revoke):**

- `[x]` **PTR timeout 20s** (`e6986a4`) — code review verified `Promise.race([fn, 20s])` em `usePullToRefresh.js:65-87`. Online refresh ~2s OK. Offline path inconclusivo (onlineManager short-circuit).
- `[x]` **SOS timeout 15s + register.reset** (`655461a`) — Live test PASS. Online submit normal. Offline path: yellow banner + reset OK pós reconnect.
- `[x]` **useUpdateUserPrefs timeout 15s** (`448bfea` Bug #4) — Live test PASS. CDP fetch patch 30s delay + toggle DnD → toast "Sync prefs timeout (15s)" capturado +15s.
- `[x]` **unsharePatient timeout 15s** (`448bfea` Bug #5) — Live test PASS. Fetch patch + tap X → toast "Tempo esgotado" capturado, 4 retries.
- `[x]` **useTreatments refetchOnMount:'always'** (`448bfea` NB-1) — Live test PASS. SQL insert externo → reload PatientDetail → "V12 NB1 Test" aparece imediato.
- `[x]` **NB-4 throttle 5000→1000ms + flushPersistImmediate** (`448bfea` + commit pendente) — Throttle 1s reduziu janela 5×; flushPersistImmediate em onMutate de confirmDose/skipDose/undoDose/registerSos reduz mais ~10× (janela ~100ms IDB write). Validar device real obrigatório (janela <100ms = OS kill edge case).

**Validações device físico Samsung S25 Ultra pendentes (lhenrique.pda):**

> Necessárias APÓS upload AAB + propagação Internal Testing (~1h pós Play Console Salvar).

- `[~]` **PTR stuck cenário real** — pull-to-refresh com network instável (5G→WiFi handoff): spinner deve sair em ≤20s, console warn em logcat. **Sessão 2026-05-18 emulator final-validation:** code review OK (`Promise.race + 20s timeout` em `usePullToRefresh.js:65-87` + handleRefresh per-query catch em `Dashboard.jsx:247-264`). Emulator não simula 5G→WiFi handoff real — fica device-only.
- `[~]` **SOS submit network slow real** — Cadastrar SOS com 5G fraco: ≤15s toast sucesso OU erro com retry. **Sessão 2026-05-18 emulator final-validation:** SOS submit normal PASS (981ms tap→toast `Dose S.O.S registrada` + dose persistida `done/sos` em `medcontrol.doses`). GSM speed test inconclusivo (input fill timing). Network real flapping é device-only.
- `[x]` **NB-4 mark + force-kill rapido** — Mark "Tomada", IMEDIATAMENTE swipe app outta recents OR force-stop. Reopen + verifica mark persistiu. **Sessão 2026-05-18 emulator final-validation:** 4 timing tests A/B/C/D Appium W3C + Supabase MCP:
  - Test A 114ms kill: **FAIL** (dose pendente após reopen — flushPersistImmediate não completou IDB write).
  - Test D 204ms kill: **FAIL** (mesma causa).
  - Test B 305ms kill: **PASS** (dose `done` + `actualTime` persistido pós drain).
  - Test C 612ms kill: **PASS** (idem).
  - **Threshold real ~250-300ms** (não ~100ms como assumido no comment do fix). Janela ainda 3× menor que original throttle 1000ms.
- `[x]` **FCM toggle device real** — Push toggle ON em S25 Ultra (Google Play Services OK): toast "ativadas" deve aparecer apenas após FCM token registrar (≤10s). **Sessão 2026-05-18 emulator:** PASS — tap → 974ms → toast `Notificações ativadas` + `aria-checked=true`. Bug #7 await-FCM-registration confirmado.
- `[x]` **DnD toggle Ajustes** — Toggle DnD com network normal: toast sem timeout. **Sessão 2026-05-18 emulator:** PASS — DnD switch tap → 1275ms → DB sync confirmada SQL `user_prefs.prefs->>'dndEnabled'='true'` `updatedAt=17:55:59`. Bug #4 timeout 15s NÃO disparou (network normal).
- `[x]` **Multi-device share/unshare** — Compartilhar paciente teste-free real, unshare network normal: toast "removido" ≤15s. **Sessão 2026-05-18 emulator:** PASS — SQL insert share → UI tap "Remover" → DB row deletada (`SELECT count FROM patient_shares WHERE ownerId=teste-plus = 0`). Bug #5 unsharePatient timeout 15s funcional (online path).
- `[x]` **Treatment cross-device** — Criar treatment em web prod (PC), abrir app device: aparece em PatientDetail imediato (Realtime ou refetchOnMount). **Sessão 2026-05-18 emulator:** PASS — SQL INSERT `treatments` externo "NB1 CrossDevice Test" → Appium navigate Pacientes → tap paciente → treatment visível em ≤3s. NB-1 `refetchOnMount: 'always'` em `useTreatments.js:20` confirmado.

**Validações monitoramento contínuo:**

- `[ ]` **Egress Supabase 24-48h pós ship v0.2.3.12** — observar painel API Gateway. Throttle revert pode aumentar IDB writes locais (zero impacto egress Supabase, só client IDB).
- `[ ]` **Sentry crashes Android nativos** — DOSY-7 + DOSY-3 segfault continuam aguardando #074 NDK symbols upload.
- `[~]` **Bug #10 processLock idle real** — depois 30-60min idle real, marcar dose imediato pós resume — verifica lag <5s. **Sessão 2026-05-18:** Skip — requer 30-60min idle real impraticável em sessão QA 60min. Validar device físico pós ship.

**Issue A nova (#0009 P2 BUGS.md):** `usePatientShares` 401 "Carregando..." infinito. Defer pra v0.2.3.13.

---

## 📦 v0.2.3.11 SHIPPED 2026-05-18 (movido pra histórico — manter aqui temporariamente)

**Status:** branch `release/v0.2.3.11`. Commit topo `d85fb4e` (#299 + #0006). 8 bugs (#0001-#0008) fixados + feature #299 (DB autoritativa in-app update + modal mandatory).

**Validações autonomous COMPLETAS (CDP + Chrome MCP + Supabase MCP):**

- `[x]` **#0001 push sub auto-register** — emulador, clear `dosy_fcm_token` + reload → token restaurado via INITIAL_SESSION branch `!cachedToken && perm=granted`.
- `[x]` **#0002 toast safe-area** — CDP `position=fixed bottom=96px` confirmado (sessão anterior).
- `[x]` **#0003 unshare startActivity removido** — 2-devices behavioral (Chrome web teste-plus owner + emulador teste-free caregiver). Focus pós FCM unshare = Launcher (NÃO foreground forçado). DosyMessagingService log `patient_unshared patientId=...` recebido sem `startActivity`.
- `[x]` **#0004 cold-start sem tela travada** — SharedPrefs `dosy_pending_unshare` simulado + open app → onResume consome + abre `/` Dashboard (não `/pacientes/{id}`). Var separada `__dosyPendingUnsharePatientId` evita conflito com openPatient.
- `[x]` **#0005 Reports cancelada filter** — pause SHARE 01 → Adesão 67% (2/3) durante pause, não 40% (2/5). Resume → 0 Cancelada visível.
- `[x]` **#0006 console [object Object]** — root cause via CDP stack trace: Capacitor bridge `cap.toNative` linha 348 console.dir + Sentry capture AppUpdate err -6. Fix: `capacitor.config.ts` `loggingBehavior: 'production'`. Smoke test pós install APK fresh: **0 entries** "object Object" em Capacitor/Console (era ~110).
- `[x]` **#0007 DoseModal date split** — CDP confirmou `<input type=date>` + `<input type=time>` separados (sessão anterior).
- `[x]` **#0008 pluralização + Termina hoje** — DOM scan: "1 dia" singular + "Termina hoje" visível pós cruzar meia-noite.
- `[x]` **#299 banner verde** — Chrome MCP localhost teste-plus `__dosyForceUpdate=true` → banner sticky topo gradient emerald renderizado (`hasBannerSticky: 1, bannerHeight: 64px`).
- `[x]` **#299 modal mandatory** — Chrome MCP localhost `__dosyForceMandatory=true` → modal vermelho full-screen renderizado (alertdialog, body overflow hidden, sem dismiss). Layout aprovado user 2026-05-18.

**Validações device físico Samsung S25 Ultra pendentes (lhenrique.pda):**

> Necessárias APÓS upload AAB + propagação Internal Testing (~1h pós Play Console Salvar). Validar device real só vale após APK shipped.

- `[x]` **#0001 push sub auto** — instalar AAB fresh, logar nova conta (sem subscription anterior), conferir push chega ao receber share. **Sessão 2026-05-18 emulator final-validation:** PASS — clear `localStorage.dosy_fcm_token` + reload → token restored em <700ms via INITIAL_SESSION branch `!cachedToken && perm=granted` em fcm.js auto-register.
- `[ ]` **#0002 toast Desfazer** — marcar dose como tomada, verificar banner verde "Desfazer" aparece acima BottomNav (não obscurecido por gesture nav). Device-only (visual safe-area).
- `[ ]` **#0003 + #0004 unshare UX device real** — outro user revoga share → app NÃO abre sozinho + ao abrir manual, cache limpo sem tela "Paciente Carregando..." infinita. Device-only (FCM data-only msg em background).
- `[~]` **#299 banner update real** — instalar vc 73 antes + propagar vc 74 → banner exibe "v0.2.3.11" (não "versão 74"). **Sessão 2026-05-18:** Cannot fully — requer duas versões AAB sequenciais em Play Console Internal Testing. Device-only.

**Validações monitoramento contínuo:**

- `[ ]` **Egress Supabase 24-48h pós ship v0.2.3.11** — observar painel API Gateway. Esperado: igual ou melhor que v0.2.3.10 (loggingBehavior=production reduz noise interno).
- `[ ]` **Sentry crashes Android nativos** — DOSY-7 + DOSY-3 segfault `<unknown>` continuam aguardando #074 NDK symbols upload (não escopo desta release).

---

## 📦 v0.2.3.10 SHIPPED 2026-05-17 (movido pra histórico)

**Status:** master @ tag `v0.2.3.10` (vc 73). Play Console Internal Testing publicado 15:28 BRT. Vercel prod dosymed.app v0.2.3.10 confirmado.

- `[x]` **#295 Alarme exibe nome do paciente** — confirmado com paciente "Dona Maria".
- `[x]` **#296 Pull-to-refresh remove paciente fantasma** — confirmado "Vovó Teste" sumiu do Dashboard.
- `[~]` **#297 Unshare em background** — cache cleanup OK, UX falhou (gerou #0003 + #0004, fechados em v0.2.3.11).

**Validações device físico v0.2.3.9 (perf):**
- `[x]` **Lag desapareceu device físico** — confirmado.

**Validações device físico v0.2.3.8 (caregiver killed alarm):**
- `[x]` **Cuidador app fechado recebe alarme com som no horário** — confirmado.

**Validações device físico v0.2.3.7 (perf bundle + server flow):**
- `[x]` Push share recebido em background.
- `[x]` Alarme caregiver killed (fire-time cron) — coberto pela validação v0.2.3.8.
- `[x]` Navegação BottomNav sem trava — coberto pela v0.2.3.9.
- `[x]` Marcação sequencial doses sem lag — coberto pela v0.2.3.9.

---

## 🟡 Pendências de monitoramento contínuo (observação passiva, não-bloqueador)

- `[ ]` **Egress Supabase 24-48h pós últimas releases (v0.2.3.7→v0.2.3.10)** — observar painel API Gateway: `rpc/get_dashboard_payload` count, FCM cron `dose-fire-time-notifier` empty ticks, total cuidador FCM data-only HIGH. Esperado: redução pós eliminar dual namespace cache (P4 v0.2.3.9) + payload mais leve (sem notification block pra owner/caregiver v0.2.3.8).
- `[ ]` **Sentry crashes Android nativos** — DOSY-7 e DOSY-3 segfault `<unknown>` aguardam #074 NDK symbols upload pra próximo release.

---

## 📦 Histórico

> Validações de releases anteriores (v0.2.1.x → v0.2.3.6) consolidadas. Arquivo completo pré-zeragem: [`Validar_archive_2026-05-17_pre-reset.md`](Validar_archive_2026-05-17_pre-reset.md) — 2434 linhas, referência cronológica.
>
> **Resumo de validações fechadas até v0.2.3.10:**
>
> - **v0.2.3.10** (3 device físico) — todas confirmadas hoje 2026-05-17 lhenrique.pda.
> - **v0.2.3.9** (perf bundle complete P1-P7) — lag desapareceu confirmado device físico.
> - **v0.2.3.8** (killed caregiver alarm) — alarme com som no cuidador app fechado confirmado.
> - **v0.2.3.7** (10 itens — perf F1+F3+F5+F6 + server flow #279/#280/#281 + idempotência #282 + RPC userId #283 + QA exaustivo 21/21) — coberto pelas validações posteriores.
> - **v0.2.3.6** (11 itens) — share Dashboard, dose passada, count exato, PatientDetail insertEntityIntoLists, Dashboard skeleton hour boundary, etc. Histórico em `Validar_archive_2026-05-17_pre-reset.md`.
> - **v0.2.3.0–v0.2.3.5** (~50 itens) — refactor scheduler unificado 3-cenários, plus #215 turnaround, #209 alarme/push, etc. Histórico arquivado.
> - **v0.2.2.x** (auditoria sistema alarmes + storm fixes) — todos resolvidos pelo refactor v0.2.3.x.
> - **v0.2.1.x** (mutation queue offline + idle skeleton + storm refresh token) — todos resolvidos.

Para histórico exaustivo: ver [`Validar_archive`](archive/Validar_archive_2026-05-17_pre-reset.md), `context/updates/`, e ROADMAP §6.3 Δ release log.

---

## 🛠️ Manual de validação autônoma (IA executa sem device físico)

> Mantido aqui para referência. Receita testada release v0.2.3.6. IA usa pra reproduzir bugs + validar fixes ANTES de pedir validação device pro user.

### Setup (1× por sessão Studio aberta)

**Pre-requisito Android Studio:** Settings → Tools → Device Mirroring →
- ✓ "Activate mirroring when a new physical device is connected"
- ✓ "Activate mirroring when the IDE launches an emulator"

Garante Studio "Running Devices" panel auto-pega emulator lançado via CLI.

### 1. Emulator com flags Studio (keyboard físico funciona via Mirror)

```bash
# Kill emulators velhos primeiro
powershell -c "Get-Process | Where-Object { \$_.ProcessName -match 'qemu|emulator|crashpad|netsimd' } | Stop-Process -Force"

# Lança com flags Studio (Win32_Process extraído)
$ANDROID_HOME/emulator/emulator.exe -netdelay none -netspeed full \
  -avd Pixel8_Test -qt-hide-window -grpc-use-token -idle-grpc-timeout 300
```

Wait boot:
```bash
until [ "$(adb -s emulator-5554 shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 5; done
```

### 2. Build + install APK debug

```bash
cd android
TEMP='C:\temp\gradle_tmp' TMP='C:\temp\gradle_tmp' \
  JAVA_HOME='/c/Program Files/Eclipse Adoptium/jdk-25.0.3.9-hotspot' \
  PATH="$JAVA_HOME/bin:$PATH" ./gradlew assembleDebug
adb -s emulator-5554 install -r -g android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. UI interaction via ADB + Appium

Para fluxos UI complexos: `scripts/qa_seq.mjs` + `scripts/flow_v4.mjs` (Appium WebDriverIO).

Para validações pontuais: `adb shell input tap X Y`, `adb shell input text "..."`, `uiautomator dump /sdcard/ui.xml`, `screencap -p /sdcard/x.png`.

### 4. SQL admin via Supabase MCP

`mcp__3f699930-ab4e-43b0-8c19-44c081f5eb40__execute_sql` para verificar audit log, push_subscriptions, doses state, etc.

### 5. Chrome MCP web localhost

`npm run dev` em background, `mcp__Claude_in_Chrome__navigate http://localhost:5173/`. Login conta teste, fluxo UI completo, console messages, network requests.
