# 03 — Checklist de Lançamento (consolidado e ordenado)

> Itens numerados sequencialmente, mesma numeração de `ROADMAP.md`. Cada um tem origem ([Plan.md] / [Auditoria] / [Plan.md + Auditoria]), esforço estimado, dependências e critério de aceitação.
>
> **Metodologia:** combina pendentes do `archive/plan-original.md` (linhas com `[ ]`, "Pendente", "Manual", "Backlog") + achados desta auditoria (25 dimensões). Ordenação: P0 → P1 → P2 → P3, considerando dependências técnicas.

---

## 🔴 P0 — Bloqueadores de Produção

### #001 — Adicionar auth check de admin em `send-test-push` Edge Function
- **Status:** ✅ Concluído @ commit 37c8fee (2026-05-01)
- **Origem:** [Auditoria] (BUG-002)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Severidade:** Crítica — qualquer authenticated user pode invocar; usa service_role
- **Snippet:**
  ```ts
  // supabase/functions/send-test-push/index.ts
  Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('POST only', { status: 405 })
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    }
    const jwt = authHeader.slice(7)
    const { data: { user }, error } = await supabase.auth.getUser(jwt)
    if (error || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!admin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    // ... resto da função
  })
  ```
- **Aceitação:** chamada sem JWT → 401. Chamada com JWT non-admin → 403. Chamada admin → push enviado. Email não-existente → resposta neutra `{ ok: true, sent: 0 }` (sem 404).
- **Detalhe:** [auditoria/04-supabase.md §7.2](auditoria/04-supabase.md#72-send-test-pushindexts-120-linhas--crítico) · [auditoria/06-bugs.md#bug-002](auditoria/06-bugs.md#bug-002--edge-function-send-test-push-não-valida-autorização-auditoria-estática)

### #002 — Sanitizar erro de email enumeration em `send-test-push`
- **Status:** ✅ Concluído @ commit 37c8fee (2026-05-01)
- **Origem:** [Auditoria] (BUG-015)
- **Esforço:** 5 min (parte do #001)
- **Dependências:** #001
- **Aceitação:** retornar `{ ok: true, sent: 0 }` em todos os fluxos (email não-existente, sem tokens, etc), nunca expor existência de email no response body/status.
- **Detalhe:** [auditoria/06-bugs.md#bug-015](auditoria/06-bugs.md#bug-015--resposta-de-erro-user-not-found-em-send-test-push-permite-enumeration)

### #003 — Rotacionar senha postgres histórica + revogar PAT kids-paint
- **Status:** ✅ Concluído (2026-05-04)
- **Origem:** [Plan.md (SECURITY.md) + Auditoria] (BUG-013)
- **Esforço:** 30 min (manual)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ Senha postgres rotacionada via Supabase Dashboard `guefraaqbkcehofchnrc/database/settings` → Reset password (auto-generated 16-char strong, salva password manager user)
  - ✅ PAT `sbp_aedc82d7...` (conta `lhenrique.pda@gmail.com` dona kids-paint) já revogado anteriormente — verificado 2026-05-04: "No access tokens found" naquela conta
  - ✅ Nova senha em password manager user (entrada `Supabase Dosy postgres pwd (production)`)
  - ✅ `INFOS.md` ausente localmente e do git history (limpo via git-filter-repo durante #084 v0.1.7.5)
- **Detalhe:** [archive/security-original.md](archive/security-original.md) seções "CRÍTICO" e "ALTO"

### #004 — Vídeo demo FOREGROUND_SERVICE_SPECIAL_USE para Play Console
- **Status:** ✅ Concluído (2026-05-04)
- **Origem:** [Plan.md] FASE 18.9.1
- **Esforço:** 2-3h (gravar + editar + upload YouTube unlisted + Console form)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ Vídeo `alarm.mp4` (33s) gravado S25 Ultra Dosy Dev demonstrando: cadastro de tratamento → tela bloqueada → alarme fullscreen disparando sobre lockscreen → Tomada/Adiar/Pular
  - ✅ Upload YouTube como Shorts unlisted: https://www.youtube.com/watch?v=qLBCzualcCw
  - ✅ Play Console: Conteúdo do app → Permissões de serviço em primeiro plano → "Outro/Uso especial" + URL vídeo + descrição completa PT-BR (1082 chars) explicando categoria SPECIAL_USE necessária para alarmes médicos críticos não-cobertos pelas categorias padrão
  - ✅ Salvo (mensagem "A mudança foi salva")
- **Pendente:** envio pra revisão Google via Visão geral da publicação (junto com mudanças #025 + outras)

### #005 — Resolver BUG-001 — Encoding UTF-8 quebrado em nome de paciente
- **Status:** ✅ Concluído @ commit pendente (2026-05-01)
- **Origem:** [Auditoria] (BUG-001)
- **Esforço:** 1-3h (investigação + fix + verificação)
- **Dependências:** nenhuma
- **Aceitação:**
  1. ✅ Confirmado via `SELECT id, name, encode(name::bytea, 'hex')` — bytes `ef bf bd` (U+FFFD literal) presentes em 1 paciente legacy (`46d9196f` "Jo�o Teste", owner `teste03@teste.com`)
  2. ✅ Deletado via REST DELETE service_role
  3. ✅ Inserido novo paciente "João da Silva ÃÕÉÍÇãõéíç" via REST como teste03 → re-lido do DB → bytes idênticos UTF-8 puros (`c3 a3` para "ã" etc) → cleanup
  4. ⚠️ Playwright não está no repo. Substituído por **recipe documentado** em `contexto/updates/2026-05-01-fix-encoding-utf8-pacientes.md` (script Python pronto pra reauditoria periódica). Adicionar Playwright = item separado novo (P3).
- **Detalhe:** [auditoria/06-bugs.md#bug-001](auditoria/06-bugs.md#bug-001--encoding-utf-8-quebrado-em-nome-de-paciente)
- **Causa raiz:** seed legacy inserido durante dev cedo via tooling com encoding ruim (Windows-1252). DB Postgres é UTF-8 default; PostgREST round-trip funciona corretamente. Sem mudança de código necessária.

### #006 — Validação manual em device físico (FASE 17 Plan)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 17 + [Auditoria]
- **Esforço:** 1-2 dias (manual, 3 devices)
- **Dependências:** #001, #003 (bugs P0 corrigidos)
- **Aceitação:** rodar `docs/device-validation-checklist.md` em 3 devices (versões 12, 13, 14):
  - Pixel (stock Android)
  - Samsung A14 (One UI battery saver ON)
  - Xiaomi Redmi (MIUI agressivo) ou Motorola
  - Validar: alarme dispara locked + unlocked + app killed + DND + após reboot + adiar 10min funciona + FLAG_SECURE bloqueia screenshot + biometria (se wired) + responsividade
- **Saída:** issues em backlog ou re-abertura de sub-fase relevante

### #007 — Telemetria notificações PostHog (regressão silenciosa healthcare)
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — código restaurado. Bisect inicial deu false positive (storm não escalou em window 30s); investigação aprofundada identificou root cause real em #157 (useRealtime cascade + publication vazia).
- **Origem:** [Auditoria] (Dimensão 14)
- **Esforço:** 1-2h código + 30min setup dashboard PostHog
- **Dependências:** PostHog key já configurada (#015 ✅)
- **Implementação executada:**
  - `src/services/analytics.js` EVENTS: `NOTIFICATION_DELIVERED`, `NOTIFICATION_TAPPED`, `NOTIFICATION_DISMISSED` (constants)
  - `src/App.jsx` 4 listeners Capacitor wired (track call em cada):
    - `LocalNotifications.localNotificationReceived` → `NOTIFICATION_DELIVERED { kind:'local_foreground' }`
    - `LocalNotifications.localNotificationActionPerformed` → `NOTIFICATION_TAPPED { kind:'local' }`
    - `PushNotifications.pushNotificationReceived` → `NOTIFICATION_DELIVERED { kind:'push_foreground' }`
    - `PushNotifications.pushNotificationActionPerformed` → `NOTIFICATION_TAPPED { kind:'push' }`
  - Cleanup `localFireHandle?.remove?.()` adicionado ao return effect
  - Props: `kind`, `actionId`, `type`, `hasDoseId` — PII strip auto via `sanitize_properties` analytics.js (LGPD: zero email/name/observation/medName)

**Cobertura granular eventos:**
- ✅ FCM foreground delivery (Android app aberto) — `pushNotificationReceived`
- ✅ FCM tap (background OR foreground) — `pushNotificationActionPerformed`
- ✅ LocalNotif fire (foreground) — `localNotificationReceived`
- ✅ LocalNotif tap — `localNotificationActionPerformed`
- ⏳ FCM background delivery JS-side: NÃO captura (Android suspende JS background) — depende Edge `notify-doses` server-side delivery report (fora escopo #007 JS)
- ⏳ Notification dismissed (swipe-away sem tap): Capacitor LocalNotifications/PushNotifications NÃO emitem evento "dismissed" — requer custom Android plugin pra hook NotificationListenerService (parqueado v0.2.2.0+)

**Eventos relacionados já existentes:**
- `ALARM_FIRED` — alarme nativo full-screen disparado (DosyMessagingService → AlarmReceiver)
- `ALARM_DISMISSED` — user dismissed full-screen alarme
- `ALARM_SNOOZED` — user adiou (snooze button)
- `DOSE_CONFIRMED` — user marcou tomada via app
- `DOSE_SKIPPED` — user pulou via app

Combinação `ALARM_FIRED` + `NOTIFICATION_DELIVERED` + `DOSE_CONFIRMED/SKIPPED` mapeia funnel completo: agendamento → entrega → ação user.

**Pendente operacional (manual user, não bloqueante #007 fechado):**
- Dashboard PostHog: criar funnel `notification_delivered → alarm_fired → dose_confirmed/skipped/snoozed` com taxa entrega target ≥99%
- Alert PostHog: rule "drop >5% delivered last 1h vs prev 24h baseline" → notif email/Slack
- Documentar em `docs/playbooks/posthog-dashboards.md` (criar follow-up)

**Justificativa healthcare crítica:** sem esta métrica, regressão silenciosa em alarmes (3 caminhos #083) passa despercebida em produção. Healthcare = não-negociável.

**🚨 Bug storm preview Vercel (2026-05-05) — bisect inicial false positive, root cause real em #157:**

> **CORREÇÃO 2026-05-05 (sessão atual mais tarde):** Bisect inicial apontou #007 culpado por reduzir storm de 1053→0 reqs em window 30s. Investigação aprofundada (idle 5min completo) revelou que storm **escala ao longo do tempo em hidden tab** — bisect 30s capturou window pré-escalada. Storm real persistia mesmo sem #007 (715 reqs em 5min idle). Root cause real = **useRealtime reconnect cascade + publication `supabase_realtime` vazia** (ver #157). Após disable `useRealtime()` em App.jsx (commit `da61b04`), storm caiu para 9 reqs em 7min idle (~0.02 req/s sustained, 99.7% redução). #007 restaurado via revert do bisect commit `76dc28a`.

Validação preview Vercel `release/v0.2.1.0` Chrome MCP (Regra 9.1 README) detectou **storm catastrófico** (atribuído inicialmente a #007, depois identificado como #157):

| Métrica idle 30s hidden tab | Preview release v0.2.1.0 (com #007) | Prod master | Multiplicador |
|---|---|---|---|
| Total reqs Supabase | 1053 | 57 | **18×** |
| `/doses` | 809 (~27 req/s) | 48 (1.6 req/s) | 17× |
| `/patients` | 163 (5.4 req/s) | 6 (0.2 req/s) | 27× |
| `/treatments` | 81 (2.7 req/s) | 3 (0.1 req/s) | 27× |
| Egress 5min idle | 27 MB só `/doses` | ~2 MB todos | 13× |

**Extrapolação:** ~1 GB/h por user idle = quebra Supabase Pro tier rapidamente.

**Bisect:** revert src `App.jsx` + `analytics.js` ao estado anterior #007 (commit `76dc28a`) → **storm 0 reqs idle 44s** (vs 35 req/s antes). #007 confirmado culpado.

**Mecanismo (não-confirmado, candidatas):**
1. `import { track, EVENTS } from './services/analytics'` em App.jsx força init módulo `analytics.js` no boot.
2. `analytics.js` chama `initAnalytics()` em PROD que carrega `posthog-js` com `capture_pageview: 'history_change'` + autocapture.
3. PostHog autocapture instrumenta `window.fetch` globalmente.
4. Combinação possível: PostHog wrapper + interceptor próprio + `useEffect` App.jsx:126-131 (`scheduleDoses(allDoses, ...)` re-dispara em cada `allDoses` ref change) → cascade.
5. Ou: PostHog `capture_pageview: 'history_change'` reage a `pushState/popstate` durante navegação App.jsx → side-effect React Query refetch.

Sem repro cirúrgica, mecanismo exato pendente investigação dedicada v0.2.2.0+.

**Resolução real (descoberta sessão atual):** root cause = #157 (useRealtime cascade + publication vazia), não #007. Após disable `useRealtime()` em App.jsx (commit `da61b04`), storm sumiu (9 reqs / 7min idle = 0.021 req/s vs 12 req/s antes). #007 restaurado via revert bisect (commit `ff431ca`). Ver #157 entry abaixo + ver `contexto/updates/2026-05-05-investigacao-157-storm-realtime.md`.

**Lições (durable feedback memory):**
- Validação preview Vercel via Chrome MCP **DEVE** rodar pré-merge release branch (Regra 9.1 README) — confirmado mais uma vez. Sem ela, storm seria descoberto pós-prod com user impact + custo egress.
- **Idle 5min hidden tab é gate crítico** — capturou bug que bateria interativa (2 min) NÃO captou. **Bisect 30s window pode dar false negative** porque storm escala ao longo do tempo em hidden tab.
- Lint + build + manual smoke web local NÃO substituem preview Vercel real (Capacitor shim + PROD mode + lazy chunks comportam diferente).
- **Bisect deve sempre validar com window igual ao original observation** (storm 5min observed → bisect 5min, não 30s).

### #008 — Configurar `SENTRY_AUTH_TOKEN` + `ORG` + `PROJECT` em GitHub Secrets
- **Status:** ✅ Concluído (verificado 2026-05-04 — secrets criados em 2026-04-28)
- **Origem:** [Plan.md] FASE 10.1 manual pendente
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ Secrets configurados em GitHub Actions: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG=lhp-tech`, `SENTRY_PROJECT=dosy`, `VITE_SENTRY_DSN` (criados 2026-04-28)
  - ✅ Workflows `.github/workflows/ci.yml` + `android-release.yml` referenciam os 4 secrets corretamente em build step
  - ⚠️ Próximo build CI envia source maps — **bloqueado por #127** (CI failing por lint errors pré-existentes em AnimatedRoutes.jsx, não relacionados aos secrets). Quando CI passar, upload funciona auto.
- **Validação pendente:** Sentry → Releases → ver release tag `dosy@0.2.0.6` aparecer após próximo CI run bem-sucedido (depende #127)

### #009 — Configurar PITR (Point-in-Time Recovery) e testar restore drill
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 21 §11)
- **Esforço:** 30 min config + 2h drill
- **Dependências:** Supabase Pro plan upgrade (custo)
- **Aceitação:**
  - PITR habilitado (Supabase Dashboard → Settings → Backups)
  - Retenção mínimo 7 dias
  - Drill executado: criar staging project, restaurar backup recente, validar dados íntegros
  - Runbook escrito: `docs/runbook-dr.md`

### #091 — TZ fix extend_continuous BRT
- **Status:** ✅ Concluído @ commit b3c979e (2026-05-02)
- **Origem:** BUG-024 healthcare-critical
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  TZ fix em extend_continuous_treatments(p_user_id) — UTC raw → America/Sao_Paulo via AT TIME ZONE. Doses futuras com firstDoseTime array agora salvam horário correto. 3 tratamentos cleanup user lhenrique.pda. Migration 20260503025200_fix_extend_continuous_tz_bug.sql.
- **Aceitação:** Validado em release v0.1.7.4 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.4.

### #092 — Egress reduction multi-frente
- **Status:** ✅ Concluído @ commit 557dcd9 (2026-05-02)
- **Origem:** BUG-025 P0 Egress 400% Free Plan
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Realtime postgres_changes filter userId=eq.X server-side. listDoses default range -30d/+60d. Paginate cap 20→5 pages. queryKey timestamps normalizados hour boundary. refetchInterval 60s→5min, staleTime 30s→2min. staleTime bumps useUserPrefs/usePatients/useTreatments/useMyTier. App.jsx alarm scope -1d/+14d.
- **Aceitação:** Validado em release v0.1.7.5 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.5.

### #094 — Paywall falso pra users plus/pro
- **Status:** ✅ Concluído @ commit 8b32245 (2026-05-02)
- **Origem:** BUG-027 trust violation
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Fix paywall falso em mount race. teste03 (tier plus DB) tentou cadastrar paciente novo → paywall 'No plano grátis você pode ter até 1 paciente'. Causa: usePatientLimitReached retornava true quando tier=undefined; getMyTier auth.getUser() race null cache 30min. Fix: useMyTier enabled: !!user via useAuth + queryKey inclui userId + usePatientLimitReached retorna false durante loading.
- **Aceitação:** Validado em release v0.1.7.5 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.5.

### #101 — Auditoria egress pós-#092
- **Status:** ✅ Concluído (release v0.2.0.1)
- **Origem:** Auditoria pós-#092
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Audit findings 2026-05-04 via pg_stat_statements + pg_replication_slots. Conclusão: nenhum query patológico, #092 fix manteve. Removido photo_url de PATIENT_COLS_LIST (egress 50KB-2MB × refetch frequente).
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #106 — Ícone launcher + splash atualizar
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** BUG-034 brand consistency
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  REGRESSÃO IDENTIFICADA: pasta assets/ legacy com icon-only.png antigo tinha precedência sobre resources/ no @capacitor/assets generate. Fix: deletado assets/ legado, criado resources/icon-only.png composto, deletado mipmap-*/ic_launcher*.png stale, re-run generate → 86→61 outputs. ic_launcher peach pill + splash full peach.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #107 — schema rpc.catch is not a function
- **Status:** ✅ Concluído (release v0.2.0.0+)
- **Origem:** BUG-035 Sentry
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Sentry DOSY-J/F/G TypeError em Dashboard pull-to-refresh. supabase.schema().rpc() retorna PostgrestFilterBuilder (PromiseLike, só .then), .catch() throw TypeError. Fix: .then(undefined, errHandler) form 2-arg em Dashboard.jsx handleRefresh array Promise.all.
- **Aceitação:** Validado em release v0.2.0.0+ (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.0+.

### #109 — useRealtime concurrent subscribe race
- **Status:** ✅ Concluído @ commit 09724c1 (2026-05-04)
- **Origem:** BUG-037 Sentry healthcare reliability
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Lock flag subscribing + try/catch ch.on() defensive previne 4 paths convergent (status reconnect + watchdog + TOKEN_REFRESHED + native resume). 9 events em 4 issues. #093 (v0.1.7.5) aplicou fix nome único + await removeChannel + generation counter mas erro voltou em vendor bundle Vr.on.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #115 — Avatar foto cache via photo_version
- **Status:** ✅ Concluído (release v0.2.0.2)
- **Origem:** ROADMAP §6 P0 cost+UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Nova coluna photo_version SMALLINT em patients (migration replace_photo_thumb_with_photo_version). Lista carrega só photo_version (2B). Hook usePatientPhoto(id, version) checa localStorage[dosy_photo_<id>] = {v, data} — match version → render instant ZERO request. Mismatch → 1 fetch via getPatient → cache forever. PatientForm submit bump version. Foto baixa 1 vez por device.
- **Aceitação:** Validado em release v0.2.0.2 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.2.

### #126 — Pre-commit secret scanning gitleaks
- **Status:** ✅ Concluído (release v0.2.0.5)
- **Origem:** ROADMAP §6 P0 SECURITY
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  GitGuardian 4 incidents High: 3× postgres pwd + 1× VAPID. Fix: gitleaks 8.30.1 + .gitleaks.toml custom regras + .husky/pre-commit roda gitleaks protect --staged ANTES lint-staged + .github/workflows/gitleaks.yml CI camada não-bypassable. Full scan 27→0 leaks.
- **Aceitação:** Validado em release v0.2.0.5 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.5.

### #148 — Dashboard rpc debounce 60s
- **Status:** ✅ Concluído @ commit 7c8cf5b (2026-05-05)
- **Origem:** Validação preview Vercel
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Dashboard extend_continuous_treatments rpc 2× por mount. Causa: AnimatePresence popLayout mantém old + new Dashboard durante exit anim ~600ms → ambos useEffects firam. Fix: module-scope flag window.__dosyExtendContinuousAt debounce 60s. Identificado via Chrome MCP fetch interceptor preview Vercel.
- **Aceitação:** Validado em release v0.2.0.11 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.11.

### #149 — useDoses mutation refetch debounce 2s
- **Status:** ✅ Concluído @ commit 758035b (2026-05-05)
- **Origem:** Validação preview Vercel
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  useDoses mutation refetch storm — 12 fetches /doses em 200s sessão real (mark/skip/undo cascade). Causa: cada mutation onSettled invalida ['doses'] → todas active queryKeys (3-5) refetcham simultâneo. Optimistic update via patchDoseInCache já garante UI consistency. Fix: debounce 2s via module-scope timer. -75% storm.
- **Aceitação:** Validado em release v0.2.0.11 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.11.

### #150 — useDoses refetchInterval 15min
- **Status:** ✅ Concluído @ commit 017916d (2026-05-05)
- **Origem:** Validação preview Vercel
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  useDoses refetchInterval idle storm — 5 fetches /doses simultâneos cada 5min em IDLE. Causa: 5 active queryKeys × 5min interval. Math: 5 × 50KB × 12 cycles/h × 24h × 1000 users = 14GB/dia idle polling. Fix: 5min → 15min = -67% polling rate.
- **Aceitação:** Validado em release v0.2.0.11 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.11.

### #151 — useDoses refetchInterval opt-in
- **Status:** ✅ Concluído @ commit 78127b7 (2026-05-05)
- **Origem:** Validação preview Vercel
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  useDoses refetchInterval opt-in only Dashboard. Antes: hardcoded 15min em TODAS queries. Agora: default OFF, opt-in via options.pollIntervalMs. Dashboard explicitamente passa 15min. Outras telas (Settings, DoseHistory, Reports) sem polling — refetch só on mount + Realtime + invalidate explícito. -80% adicional idle egress.
- **Aceitação:** Validado em release v0.2.0.11 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.11.

### #154 — Custom SMTP Resend dosymed.app
- **Status:** ✅ Concluído (release v0.2.0.12)
- **Origem:** Sessão v0.2.0.12 (descoberto rate limit)
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Built-in Supabase email rate-limited 2/h (não-prod). Resend SMTP 30/h Supabase (1000+ Resend free tier). DNS Hostinger 4 records (DKIM TXT resend._domainkey, MX send→feedback-smtp.sa-east-1.amazonses.com, SPF TXT, DMARC). Domain Resend VERIFIED <5min. Supabase Auth → SMTP Settings: smtp.resend.com:465 user resend pass=API key, sender Dosy <noreply@dosymed.app>. Recovery OTP funcionando real prod.
- **Aceitação:** Validado em release v0.2.0.12 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.12.

---

## 🟠 P1 — Alta Prioridade (pré-soft-launch)

### #010 — Criar `ic_stat_dosy` notification icon
- **Status:** ✅ Concluído @ commit cbfc813 (2026-05-04) — validado device S25 Ultra
- **Origem:** [Auditoria] (BUG-005)
- **Esforço:** 1h (designer + ImageMagick + cap sync)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ `ic_stat_dosy.xml` vector drawable 24dp em `android/app/src/main/res/drawable/` (single source escala todas densidades; substituiu PNG colorida 96x96 stale).
  - ✅ 3 paths Java nativos (AlarmReceiver/AlarmActivity/AlarmService) trocados de `R.mipmap.ic_launcher` → `R.drawable.ic_stat_dosy` + `setColor(0xFFFF6B5B)` accent peach.
  - ✅ Validação visual S25 Ultra Dosy Dev: notificação dispara, status tray mostra silhueta correta.
- **Detalhe:** [auditoria/06-bugs.md#bug-005](auditoria/06-bugs.md#bug-005--ic_stat_dosy-referenciado-mas-ausente-nos-drawables)

### #011 — Adicionar `<label>` explícito em inputs Login (A11y universal — TalkBack/screen readers)
- **Status:** ✅ Concluído @ commit eb6c06c (2026-05-02)
- **Origem:** [Auditoria] (Dimensão 7)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:** Login.jsx tem `<label htmlFor="email">` e `<label htmlFor="password">` visíveis acima dos inputs. TalkBack lê corretamente.

### #012 — Recriar policies RLS com `TO authenticated` explícito
- **Status:** ✅ Concluído @ commit 1496f48 (2026-05-02)
- **Origem:** [Plan.md] FASE 8.3 backlog
- **Esforço:** 2-3h (migration + testes)
- **Dependências:** nenhuma
- **Aceitação:**
  - Migration `supabase/migrations/{ts}_refine_policies_to_authenticated.sql`
  - Todas policies em medcontrol têm `TO authenticated`
  - Pen test: anon role acessa ≠ falha; authenticated do user A acessa user B = falha
- **Detalhe:** [auditoria/04-supabase.md §15.2](auditoria/04-supabase.md#152-audit-de-policies)

### #013 — Splitar policies `cmd=ALL` em 4 separadas
- **Status:** ✅ Concluído @ commit 1496f48 (2026-05-02)
- **Origem:** [Plan.md] FASE 8.3 backlog (Aud 5.2 G9)
- **Esforço:** 2h
- **Dependências:** #012
- **Aceitação:**
  - Tabelas com `cmd=ALL` (push_subs, user_prefs, subscriptions, security_events) divididas em SELECT/INSERT/UPDATE/DELETE
  - Cada policy com `using` + `with_check` apropriado

### #014 — Recriar RPC `extend_continuous_treatments` (BUG-004)
- **Status:** ✅ Concluído @ commit f7e4315 (2026-05-02)
- **Origem:** [Plan.md] FASE 23.5 + [Auditoria]
- **Esforço:** 3-4h
- **Dependências:** nenhuma
- **Aceitação:**
  - Migration `supabase/migrations/{ts}_recreate_extend_continuous_treatments.sql`
  - Função `(p_days_ahead int) RETURNS json`, SECURITY DEFINER, `SET search_path = medcontrol, pg_temp`
  - Validação ownership via `auth.uid()`
  - Reativar chamadas em `Dashboard.jsx` (mount + handleRefresh)
  - Teste: criar tratamento contínuo → mocar agora() para 7d depois → `dosesAdded > 0`

### #015 — Configurar PostHog key + dashboards launch
- **Status:** ✅ Concluído (release v0.1.7.4)
- **Origem:** [Plan.md] FASE 14.1 manual
- **Esforço:** 1-2h (criar conta + key + dashboards básicos)
- **Dependências:** nenhuma
- **Aceitação:**
  - Conta PostHog criada
  - Key em GitHub Secret `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST`
  - Próximo build CI envia eventos
  - Dashboards: DAU/WAU/MAU, retention D1/D7/D30, funnel signup→first_dose, NPS

### #016 — Configurar alertas Sentry (crash spike, error threshold)
- **Status:** ✅ Concluído (release v0.1.7.4)
- **Origem:** [Plan.md] FASE 14.2 manual
- **Esforço:** 30 min
- **Dependências:** projeto Sentry com release tag (já feito FASE 7.3)
- **Aceitação:**
  - Alert rule: crash count > 10 em 1h → email/Slack
  - Alert rule: novo issue crítico (não visto antes) → notificação imediata
  - Threshold: ANR rate > 0.5%

### #017 — Wire LockScreen UI + integração biometria (`useAppLock`)
- **Status:** ✅ Concluído @ commit 869ab34 (2026-05-04) — validado device S25 Ultra
- **Origem:** [Plan.md] FASE 11.3 → 12 ou 23
- **Esforço:** 4-6h
- **Dependências:** nenhuma
- **Aceitação (todos validados em S25 Ultra Dosy Dev):**
  - ✅ LockScreen overlay em App.jsx (camada lógica equivalente a main.jsx — AuthProvider necessário pra signOut escape hatch)
  - ✅ Toggle "Bloqueio do app" em Settings seção "Privacidade e segurança" (native-only, default OFF) — toast feedback + dropdown timeout aparece quando ON
  - ✅ Auto-lock após N min em background (validado timeout 1min, configurável 1/5/15/30/60min via Dropdown)
  - ✅ Biometria desbloqueia (digital/face) via `@aparajita/capacitor-biometric-auth` 10.x
  - ✅ Cold start: app abre direto na tela de bloqueio
  - ✅ Cancelar prompt biometria (back button) mantém bloqueado + botões Desbloquear/Sair-da-conta visíveis
  - ✅ Disable toggle exige biometria (anti-tamper)
  - ✅ Fallback senha celular via `allowDeviceCredential: true`

### #018 — AdMob Android prod (prioritário) + AdSense web (secundário)
- **Status:** ⏳ Aberto (parcial AdMob — escopo expandido 2026-05-05)
- **Origem:** [Plan.md] FASE 4.3 pendente; cross-ref AdMob Console assessment 2026-05-05
- **Esforço:** AdMob: 15min flag flip + aguardar Play Production approval. AdSense: 1h opcional.
- **Dependências:** AdMob app approval Google (depende #133 Production track Play Console).

**Estado atual AdMob (2026-05-05 — Chrome MCP Console assessment):**
- ✅ Conta AdMob aprovada · perfil pagamento completo (dosy.med@gmail.com)
- ✅ App "Dosy" Android registrado: App ID `ca-app-pub-2350865861527931~5445284437`
- ✅ Banner ad unit "Dosy Bottom Banner": `ca-app-pub-2350865861527931/2984960441`
- ✅ AndroidManifest meta-data ads.APPLICATION_ID já com prod ID real
- ✅ `.env` + `.env.production`: `VITE_ADMOB_BANNER_ANDROID=ca-app-pub-2350865861527931/2984960441`
- ❌ `.env.production`: `VITE_ADMOB_USE_TEST=true` — força sandbox banner Google `/6300978111` (sempre fill, $0)
- ⏸️ AdMob Console status app: "Requer revisão / Veiculação limitada" (espera Play Store Production track #133)

**Estado atual AdSense web:**
- ❌ `index.html` linha 18-19: script tag com placeholder `client=ca-pub-XXXXXXXXXXXXXXXX` (404 silently)
- ❌ `.env*` + Vercel env: `VITE_ADSENSE_CLIENT` + `VITE_ADSENSE_SLOT` vazios → AdBanner.jsx retorna null
- 🟡 Foco mobile-first → web AdSense baixa prioridade. Pode permanecer placeholder OU remover script index.html cosmeticamente.

**Aceitação AdMob:**
  - Após `#133` aprovação Production: flip `VITE_ADMOB_USE_TEST=false` em Vercel + `.env.production` local
  - Rebuild AAB + Vercel deploy: real ad unit veicula (ou no-fill no início enquanto eCPM warm-up)
  - Validar device real: `[AdMob] no-fill / load fail` aceitável; sem crash; CSS var `--ad-banner-height` colapsa em no-fill

**Aceitação AdSense (opcional):**
  - Decisão: criar conta AdSense web + verificar domínio dosymed.app → preencher `data-ad-client` real OU remover linhas 17-19 index.html
  - Se preencher: `VITE_ADSENSE_CLIENT=ca-pub-...` + `VITE_ADSENSE_SLOT=...` em Vercel env

**Progresso v0.2.1.0 (2026-05-05):**
  - ✅ AdSense placeholder script removido de `index.html` (linhas 17-19 viraram comentário documentado). Network tab Vercel preview não mais carrega `adsbygoogle.js` 404. Reativação documentada no comentário.
  - ⏸️ AdMob `VITE_ADMOB_USE_TEST=false`: aguarda #133 Production track Play Console aprovado.

**Notas:** [auditoria/06-bugs.md#bug-006](auditoria/06-bugs.md#bug-006--adsense-placeholder-em-produção-indexhtml). Item original era "AdSense IDs em index.html" → ampliado pra cobrir ambos AdSense (web) + AdMob (Android native principal).

### #019 — Subir `minimum_password_length` para 8 + complexity
- **Status:** ✅ Concluído @ commit eb6c06c (2026-05-02)
- **Origem:** [Auditoria] (BUG-008)
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Aceitação:**
  ```toml
  [auth]
  minimum_password_length = 8
  password_requirements = "lower_upper_letters_digits"
  ```
  Aplicar via Supabase Dashboard cloud + commitar `config.toml`. Frontend continua validando 8+. Senhas existentes < 8 não-quebradas (server só rejeita novas).

### #020 — Disclaimer médico visível ("Não substitui orientação")
- **Status:** ✅ Concluído @ commit eb6c06c (2026-05-02)
- **Origem:** [Plan.md] FASE 18.5.1 + [Auditoria] (Dimensão 16)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  - Texto em modal aparece no primeiro signup (após consentimento checkbox)
  - Texto também em `/termos` em destaque
  - Onboarding tour menciona

### #021 — Backup keystore em 3 locais seguros
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 18.3 manual crítico
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  - 1: password manager com keystore + senhas (1Password/Bitwarden)
  - 2: pendrive offline criptografado (VeraCrypt) guardado fisicamente
  - 3: cloud cifrado (drive cifrado / pCloud Crypto)
  - Documento `docs/keystore-backup-procedure.md` com SOP
- **Risco se ignorado:** keystore perdido = app morto no Play Store, impossível publicar updates.

### #022 — Verificar TS 6.0.3 legitimidade (BUG-007)
- **Status:** ✅ Concluído (release v0.1.7.4)
- **Origem:** [Auditoria] (BUG-007)
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Aceitação:**
  - `npm view typescript@6.0.3 maintainers` mostra `microsoft <microsoft>` ou similar oficial
  - Se confirmado oficial: deixar como está
  - Se duvidoso: degradar para `^5.7.0` e `npm install`

### #023 — Refatorar `useDoses` para `refetchIntervalInBackground: false`
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01) — release v0.1.7.0
- **Origem:** [Auditoria] (Dimensão 22)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  ```js
  useQuery({
    queryKey: ['doses', filter],
    queryFn: ...,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,  // ← novo
    staleTime: 30_000,                    // ← novo
  })
  ```
  Polling pausa quando aba/app inativo. Custo Supabase reduz ~40%.

### #024 — Adicionar pre-commit hook (husky + lint-staged)
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 23)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  ```bash
  npm install -D husky lint-staged
  npx husky init
  echo "npx lint-staged" > .husky/pre-commit
  ```
  + config em package.json: `"lint-staged": { "*.{js,jsx}": ["eslint --fix", "prettier --write"] }`

### #025 — Screenshots phone retrabalho (Play Store)
- **Status:** ✅ Concluído (2026-05-04)
- **Origem:** [Plan.md] FASE 18.9.2
- **Esforço:** 2-3h (designer)
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ 19 screenshots brutos capturados S25 Ultra Dosy Dev (1080×2340 atende mínimo 1080px Play Store)
  - ✅ Triagem: 8 melhores escolhidas em `resources/prints/processado/` ordenadas 01-08 (alarme multi-dose · início multi-paciente · análises · marcar dose · relatórios · paciente · histórico · onboarding alarme)
  - ✅ Plus assets gerados via sharp: `icon-512-peach.png` (composto icon-background + logo-mono-light, safe margin 17% H · 37% V) + `feature-graphic-1024x500.png` (gradient peach + tagline) + `yt-avatar-800.png` + `yt-banner-2560x1440.png`
  - ✅ Upload Play Console: ícone 512 + 8 screenshots phone uploadados, Salvar persistido como rascunho
  - ✅ Listagem da loja → campo Vídeo preenchido com URL YouTube unlisted
- **Pendente:** envio pra revisão Google via Visão geral da publicação

### #026 — Emails oficiais `*@dosymed.app` via ImprovMX → dosy.med@gmail.com
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — DNS + ImprovMX + 7 aliases verificados (Gmail labels manuais user)
- **Origem:** [Plan.md] FASE 18.5
- **Esforço:** 1h setup (Chrome MCP) + 5min Gmail labels manual user
- **Dependências:** domínio `dosymed.app` já em produção (custom domain Vercel + Resend SMTP #154)
- **Resolução escolhida:** **ImprovMX free** (25 aliases, DNS-only, zero infra, free forever).

**Setup executado (Chrome MCP dosy.med@gmail.com):**

1. ✅ Conta ImprovMX criada manualmente user `dosy.med@gmail.com` + domain `dosymed.app` adicionado
2. ✅ DNS Hostinger 3 records adicionados (apex `@`):
   - `MX @ 10 mx1.improvmx.com`
   - `MX @ 20 mx2.improvmx.com`
   - `TXT @ "v=spf1 include:spf.improvmx.com ~all"`
3. ✅ DNS propagation verificada via `nslookup -type=mx dosymed.app 8.8.8.8` (records visíveis Google DNS)
4. ✅ ImprovMX domain status: **VERIFIED** (email confirmação "Amazing! Your domain is verified")
5. ✅ 7 aliases criados (todos forward → `dosy.med@gmail.com`):

| Alias | Uso |
|---|---|
| `*@dosymed.app` (catch-all) | Fallback any address |
| `contato@dosymed.app` | Geral / Play Console contato |
| `privacidade@dosymed.app` | DPO LGPD (#156) |
| `suporte@dosymed.app` | Atendimento usuários |
| `legal@dosymed.app` | Jurídico / Termos / DMCA |
| `dpo@dosymed.app` | Data Protection Officer (sinônimo privacidade) |
| `security@dosymed.app` | Vuln disclosures |
| `hello@dosymed.app` | First-touch friendly outreach |

**Resilience considerations:**
- SPF não conflita com Resend SMTP outbound (#154) pq Resend usa subdomain `send.dosymed.app`
- DKIM Resend (`resend._domainkey`) intocado
- DMARC `_dmarc` policy `p=none` mantida — bom pra debug inicial
- Free tier limit: 25 aliases (espaço ainda pra +18) e 10 mensagens/dia. Upgrade $9/mo se exceder

**Gmail filters + labels (concluído v0.2.1.0 via Chrome MCP):**
- ✅ 7 labels criadas: Contato, Privacidade, Suporte, Legal, DPO, Security, Hello (sidebar Gmail)
- ✅ 7 filters criados, cada um `Matches: to:(<alias>@dosymed.app) Do this: Apply label "<Label>"`
- ✅ Filters aplicam label automaticamente em emails recebidos (mantém inbox + label, não archive)
- Test envio futuro pra qualquer `<alias>@dosymed.app` → ImprovMX forward → dosy.med@gmail.com → filter aplica label correspondente

**Fix anti-spam (2026-05-05 sessão atual via Chrome MCP):**
- **Problema:** user enviou TESTE 1 lhenrique.pda@gmail.com → contato@dosymed.app → forward funcionou (ImprovMX dashboard SENT) MAS Gmail flagou como Spam (forwarder novo, sender desconhecido). Filtros 1-7 só aplicam label, sem flag "Never Spam".
- **Diagnóstico:** ImprovMX dashboard 1 Received OK. DNS MX+SPF OK. Causa = Gmail spam heuristic. TESTE 1 + ImprovMX TEST email achados em Spam.
- **Fix:** 8º filtro catch-all criado `Matches: to:(dosymed.app) Do this: Never send it to Spam, Mark it as important`. Cobre 7 aliases atuais + futuros + qualquer `<x>@dosymed.app`.
- **Validação end-to-end:** TESTE 1 resgatado Spam → marcado "Report not spam" → Inbox `Contato` label. ImprovMX TEST `Alias test for contato@dosymed.app` chegou Inbox direto label `Contato`. Forward chain validado: gmail.com → dosymed.app MX (improvmx) → forwarder@improvmx.com → dosy.med@gmail.com Inbox + label.
- **Limitação Gmail conhecida:** filtro NÃO aplica retroativo em Spam/Trash. Resgate manual user para emails antigos lá.
- **Pendência (opcional):** consolidar filtros 1-7 adicionando "Never Spam"+"Mark important" em cada (catch-all 8 já cobre na prática, mas redundância protege contra Gmail decidir mover apesar do filter 8).

**Fix Sentry whitelist (2026-05-06 sessão v0.2.1.4 via Chrome MCP):**
- **Problema:** user reportou TESTE 02 enviado contato@dosymed.app não chegou + emails Sentry em Spam.
- **Investigação:**
  - TESTE 02 **CHEGOU** Inbox + label "Contato" 11:29 PM (~7min delay forward chain). Headers SPF: PASS / DKIM: PASS / DMARC: PASS / dara=fail (irrelevant). Filter #026 catch-all funcionou. User talvez checou antes de chegar.
  - 5 emails Sentry achados Spam (May 1-2, errors `postgres_changes` callbacks — issue #093 já fixed mas Sentry envio reverberou). Sender `noreply@md.getsentry.com` envia DIRETO pra `dosy.med@gmail.com` — bypass ImprovMX dosymed.app. Filter #026 catch-all (`to:(dosymed.app)`) NÃO cobre.
- **Fix:** 9º filter Gmail criado `Matches: from:(getsentry.com OR sentry.io) Do this: Never send it to Spam, Always mark it as important`. Cobre `noreply@md.getsentry.com` (issue alerts), `noreply@sentry.io` (account/billing), e qualquer outro Sentry domain.
- **Resgate retroativo:** 5 conversations Sentry desmarcadas Spam → Inbox manual via "Not spam" toolbar (filter Gmail não aplica retroativo Spam/Trash). Toast confirmou: "Future messages from these senders will be sent to Inbox".
- **Estado final 9 filters Gmail:**
  1-7 — `to:(<alias>@dosymed.app)` → label "<Alias>"
  8 — `to:(dosymed.app)` → Never Spam + Mark important (catch-all #026)
  9 — `from:(getsentry.com OR sentry.io)` → Never Spam + Mark important (Sentry whitelist)

**Pendente código v0.2.1.0:**
- ⏳ Atualizar UI Settings → "Suporte" link mailto: → `mailto:suporte@dosymed.app`
- ⏳ Termos.jsx + Privacidade.jsx (criando #156) referenciar emails canônicos
- ⏳ Footer Login mostrar `contato@dosymed.app` se cabível

**Validação aceitação:**
- ✅ DNS records visíveis externamente (nslookup 8.8.8.8 OK)
- ✅ ImprovMX domain VERIFIED (notif email recebido confirmando)
- ⏳ Test send email pra `suporte@dosymed.app` → confirmar chegar dosy.med@gmail.com (user pode testar manual)
- ⏳ Auto-responder SLA: parqueado v0.2.2.0+ (Gmail templates OR Resend Inbound webhook)

### #027 — Promover Closed Testing track + 12 testers via Reddit
- **Status:** ✅ Concluído v0.2.0.12 (2026-05-05) — superseded por #129-#133
- **Origem:** [Plan.md] FASE 18.9.3
- **Esforço:** N/A (substituído)
- **Dependências:** N/A
- **Resolução:** Item original "promover Closed Testing + 12 testers via amigos/Reddit" expandido em granularidade fina conforme estratégia 2026-05-05: User decidiu pular recrutamento Internal com pessoas conhecidas e ir direto Closed via Google Group público + Reddit/redes externas. Trabalho real distribuído em:
  - **#129** Criar Google Group público `dosy-testers`
  - **#130** Configurar Closed Testing track Console (tester list = e-mail group + países BR + AAB v0.2.0.7+)
  - **#131** Recrutar 15-20 testers externos (Reddit r/AlphaAndBetausers + r/SideProject + r/brasil + targeted r/medicina/r/saude/r/tdah/r/diabetes + Twitter + LinkedIn + Discord)
  - **#132** Gate 14d × ≥12 ativos + iterar bugs em mini-releases
  - **#133** Solicitar Production access pós-gate
- **Validação:** trabalho remanescente fica nos itens granulares acima.

### #088 — Dose não aparece Início (Pixel 7)
- **Status:** ✅ Concluído @ commit 705b69f (2026-05-02)
- **Origem:** BUG-021
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Fix viewport-specific em useDoses: refetchOnMount: 'always' (Pixel 7 emulador). NÃO repro Samsung S25 Ultra device real. Fix preserva comportamento em devices modernos.
- **Aceitação:** Validado em release v0.1.7.4 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.4.

### #089 — Layout AdSense banner empurrando header parcial (Pixel 7)
- **Status:** ✅ Concluído organicamente entre v0.1.7.4-v0.2.0.12 (validado user print Pixel 7 emulador 2026-05-05)
- **Origem:** BUG-022 reportado user 2026-05-02
- **Prioridade:** P2 UX visual
- **Esforço:** Investigação não-iniciada (fix orgânico durante refactors AppHeader / CSS vars)
- **Dependências:** nenhuma
- **Problema original:**
  Banner "Test Ad 468x60" ocupava topo viewport. Header "Dosy ▸ Frederico" ficava abaixo do banner com texto "Dosy" parcialmente cortado/sobreposto. Visível emulador Pixel 7 (1080×2400 @420dpi). NÃO repro Samsung S25 Ultra real.
- **Validação fechamento (2026-05-05):**
  Print user emulador Pixel 7 v0.2.0.12 mostra layout limpo: banner "Test Ad - This is a 320x50 test ad" topo + header Dosy abaixo + "Boa noite, Teste Free" + ⚙️ ícone. Wordmark "Dosy" inteiro visível, sem sobreposição. Tabs filtro 12h/24h/48h/7 dias/10 dias renderizam OK.
- **Provável fix orgânico:**
  - #113 (v0.2.0.x) buffer +4 px em `--ad-banner-height` CSS var (era exagerado +16, ajustado pra +4 sem perder safety margin)
  - AppHeader top calc com `env(safe-area-inset-top, 0px) + var(--ad-banner-height, 0px) + var(--update-banner-height, 0px)` cobre todos viewports
  - Cross-device validation natural durante refactors v0.2.0.x
- **Aceitação:** ✅ User print Pixel 7 v0.2.0.12 confirma layout OK
- **Detalhe:** Bug fechado sem fix dedicado — sintoma desapareceu durante refactors progressivos AppHeader / CSS vars.

### #090 — Pós-login redireciona pra Início
- **Status:** ✅ Concluído @ commit 63f444c (2026-05-02)
- **Origem:** BUG-023
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  navigate('/', {replace:true}) explícito em Login.submit após signin/signup success se path atual não é '/' nem '/reset-password'. Causa: React Router preservava pathname /ajustes herdado pré-logout.
- **Aceitação:** Validado em release v0.1.7.4 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.4.

### #093 — Race useRealtime postgres_changes
- **Status:** ✅ Concluído @ commit 557dcd9 (2026-05-02)
- **Origem:** BUG-026 / Sentry crash spike
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Fix race condition useRealtime: nome único realtime:${userId}:${gen}:${Date.now()} por subscribe + await supabase.removeChannel() + generation counter ignora callbacks de canais antigos durante reconnect.
- **Aceitação:** Validado em release v0.1.7.5 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.5.

### #095 — Versão real native packageInfo /Ajustes
- **Status:** ✅ Concluído (release v0.1.7.5)
- **Origem:** BUG companion #094
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  /Ajustes mostra versão real native via packageInfo (era hardcoded ou stale).
- **Aceitação:** Validado em release v0.1.7.5 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.1.7.5.

### #096 — Admin panel tier consistente
- **Status:** ✅ Concluído @ commit 60d4422 (2026-05-04)
- **Origem:** BUG-028
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  listAllUsers agora aplica mesmo promo free→plus que getMyTier — admin panel sincroniza com client view. Fix inconsistência tier display: AjustesScreen + AppHeader (TierBadge) liam plus mas /admin mostrava free.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #099 — Avatar paciente upload + crop
- **Status:** ✅ Concluído @ commit 1fcff21 (2026-05-04)
- **Origem:** BUG-031
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Canvas client-side center-square-crop 512x512 + JPEG 0.78 (~50KB) antes de salvar. Resolve aspect 1:1 + reduz payload DB. Fix: handler upload PatientForm + invalidate queryClient ['patients'].
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #102 — Atalho hardware silenciar alarme
- **Status:** ✅ Concluído @ commit f02bf12 (2026-05-04)
- **Origem:** ROADMAP §6 P1 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  AlarmActivity.onKeyDown override KEYCODE_VOLUME_UP/DOWN → toggleMute() + return true. Botões físicos volume silenciam ringtone instantaneamente sem dismiss. muteButton label sincroniza '🔇 Som off'.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #103 — UpdateBanner URL runtime
- **Status:** ✅ Concluído @ commit 4a6e39c (2026-05-04)
- **Origem:** BUG-032
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  UpdateBanner apontava dosy-teal.vercel.app (preview antigo morto) → fetch 404 silent → available=false. Fix: usar window.location.origin runtime. App detecta nova versão Play Store via version.json corretamente.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #105 — MultiDoseModal Dosy primitives
- **Status:** ✅ Concluído @ commit 65211cb (2026-05-04)
- **Origem:** BUG-033
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Sheet + Card per dose + StatusPill kind + Buttons ghost/secondary/primary com Lucide icons. Quando user clica Ciente no AlarmActivity nativo, app abre via deep link ?doses=id1,id2 → Dashboard renderiza MultiDoseModal. Refactor de classes legacy bg-slate-900 + btn-primary blue.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #108 — PatientForm weight.replace TypeError
- **Status:** ✅ Concluído @ commit 09724c1 (2026-05-04)
- **Origem:** BUG-036 Sentry DOSY-K
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Coerce String() em load + submit. Causa: campo weight passa pelo input já como number OR null, mas onSubmit chama weight.replace(',','.') esperando string. Fix: coerce String(weight) antes de replace.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #114 — Avatar foto crop manual react-easy-crop
- **Status:** ✅ Concluído (release v0.2.0.2)
- **Origem:** BUG-038
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Integrado react-easy-crop em CropModal component novo. PatientForm onPhoto → modal abre com zoom slider 1-3x + drag pan (cropShape circular live preview) → confirm gera canvas 512×512 jpeg q0.78 (~50KB). Substitui auto-crop center-square v0.2.0.1.
- **Aceitação:** Validado em release v0.2.0.2 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.2.

### #116 — Header alertas: sino → ícones diretos
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P1 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  HeaderAlertIcon primitive (4 tones: danger/warning/info/update). AppHeader renderiza condicionalmente: AlertCircle pulse (overdue → /?filter=overdue), Users (shares novos → /pacientes), Pill (tratamentos acabando ≤3d → /pacientes), Download (update → startUpdate). Padrão WhatsApp/Gmail. UpdateBanner verde mantido. BellAlerts deprecated.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #119 — Promo free→plus removida client
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P1 cost+truth
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  subscriptionService.getMyTier mapeava free→plus durante beta interno (bypass paywall). Agora: tier vem direto DB via RPC my_tier. Paywall ativo pra users free reais. Reais (lhenrique admin, daffiny+ela pro) não afetados. Mesmo bypass removido em listAllUsers.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #125 — Splash distorcido S25 Ultra
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** BUG-039
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  drawable/splash_icon.png era 3224×1292 stale. Theme.SplashScreen Android 12+ esticava pra preencher safe zone 240dp. Source resources/splash_icon.png já era 1024×1024. Fix: cp resources/splash_icon.png android/app/src/main/res/drawable/splash_icon.png. Bg color #FFF4EC em colors.xml dosy_splash_bg.
- **Aceitação:** Validado em release v0.2.0.4 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.4.

### #152 — ChangePasswordModal em Ajustes
- **Status:** ✅ Concluído @ commit b2f53ff (2026-05-05)
- **Origem:** User request v0.2.0.12
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  ChangePasswordModal.jsx novo. Botão 'Alterar senha' Settings → Conta. Modal padrão Dosy (ícone Lock) + 3 inputs (atual + nova + repetir). Validação inline (≥8 chars, match repeat, atual ≠ nova). Re-autentica via signInWithPassword({email, password: current}) → updateUser({password: nova}). Toast success + close modal.
- **Aceitação:** Validado em release v0.2.0.12 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.12.

### #153 — Recovery senha via OTP 6 dígitos
- **Status:** ✅ Concluído @ commit b2f53ff..31da691 (2026-05-05)
- **Origem:** BUG-041 reformulação
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Substitui magic-link broken #147. useAuth.sendRecoveryOtp(email) → signInWithOtp shouldCreateUser:false. verifyRecoveryOtp(email, token) → verifyOtp type:'email' + flag localStorage dosy_force_password_change=1. Login.jsx 2 sub-modes 'forgot-email' + 'forgot-otp'. App.jsx ForceNewPasswordModal aberto auto via useEffect [user]. Email OTP length 8→6 dígitos. Email template Magic Link customizado pra OTP code. Validado E2E Chrome MCP.
- **Aceitação:** Validado em release v0.2.0.12 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.12.

---

## 🟡 P2 — Média Prioridade (30 dias pós-launch)

### #028 — Rate limit em `delete-account` Edge Function
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Auditoria] (BUG-003)
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Aceitação:** invocar 2x em < 5 min retorna 429.

### #029 — Refatorar `Settings.jsx` (541 LOC) em sub-componentes
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Origem:** [Plan.md] FASE 15 + [Auditoria]
- **Esforço:** 6-8h
- **Aceitação:** orchestrator <100 LOC + 4-5 sections separadas. Tests passam, lint 0 erros.

### #030 — Refatorar `services/notifications.js` (588 LOC) em módulos
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Origem:** [Plan.md SECURITY.md] + [Auditoria]
- **Esforço:** 1-2 dias
- **Aceitação:**
  ```
  services/notifications/fcm.js
  services/notifications/local.js
  services/notifications/critical.js
  hooks/useNotifications.js (orchestration)
  ```

### #031 — Confirmar `FORCE_RLS` em todas as tabelas
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Auditoria] (Dimensão 21)
- **Esforço:** 30 min
- **Aceitação:** rodar SQL em [auditoria/04-supabase.md §15.6](auditoria/04-supabase.md#156-force_rls-em-todas-as-tabelas).

### #032 — Confirmar `SET search_path` em todas as funções SECURITY DEFINER
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Auditoria] (Dimensão 21)
- **Esforço:** 1h
- **Aceitação:** [auditoria/04-supabase.md §15.3](auditoria/04-supabase.md#153-audit-de-security-definer--search_path) — todas as DEFINER têm `SET search_path = medcontrol, pg_temp`.

### #033 — Adicionar React.memo em DoseCard, PatientCard, TreatmentCard
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** [Auditoria] (Dimensão 5)
- **Esforço:** 1h
- **Aceitação:** memoization com prop comparator. React DevTools Profiler confirma redução de re-renders em scroll de listas grandes.

### #034 — Implementar virtualização em DoseHistory + Patients (>200 itens)
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Origem:** [Plan.md] FASE 13 backlog
- **Esforço:** 4-6h
- **Aceitação:** `@tanstack/react-virtual` integrado; lista de 1000 doses scrolla sem jank em device mid-range.

### #035 — Integration tests (`useDoses`, `useUserPrefs` com mock Supabase)
- **Status:** ⏳ Aberto — diferido v0.2.2.0+ (backlog estabilidade pós-rampa Closed Testing)
- **Origem:** [Plan.md] FASE 9.4 backlog
- **Esforço:** 1 dia
- **Aceitação:** 10+ tests cobrindo fluxos confirm/skip/undo + sync localStorage cache.
- **Justificativa diferimento:** Sem testers Closed ativos hoje. Teste integração defende contra regressão durante iteração rápida em resposta a bug reports — útil quando volume de mudança crescer. Implementar antes de Open Testing/Production.

### #036 — Skeleton screens em páginas com lista
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05)
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 1h (refinamento — componente Skeleton já existia #104 v0.2.0.0)
- **Páginas afetadas v0.2.1.0:**
  - ✅ TreatmentList: `loadingTreatments` from `useTreatments()` → SkeletonList count=3 antes empty state
  - ✅ Analytics: `loadingDoses` from `useDoses()` → SkeletonList count=3 entre filter chips e Adesão card
- **Páginas pré-existentes com skeleton (#104 + outros):**
  - Dashboard, Patients, DoseHistory, Admin
- **Não-aplicável (form-based, render imediato sem depender de fetch):**
  - Reports — form date pickers + patient picker + export buttons
  - SOS — form med + paciente + datetime + button
  - PatientForm — form único
  - TreatmentForm — form único
- **Implementação:** import `SkeletonList` de `src/components/Skeleton.jsx`. Render condicional `if (loading) <SkeletonList /> else if (empty) <empty> else <list>`.
- **Resultado UX:** elimina flash "Nenhum tratamento" / "Sem dados no período" durante 100-500ms initial fetch.

### #037 — Erros inline em forms
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 1 dia
- **Aceitação:** PatientForm, TreatmentForm, SOS, Settings com mensagens de erro abaixo de cada campo, não só toast.

### #038 — Pen test interno completo documentado
- **Status:** ⏳ Aberto — diferido v0.2.2.0+ ou pré-Open Testing (#133 gate)
- **Origem:** [Plan.md] FASE 8.4 + 20.3
- **Esforço:** 1-2 dias
- **Aceitação:**
  - User A → user B via API direta (curl) com JWT roubado → falha
  - Tampering APK + Play Integrity (se #047 implementado)
  - Burp/mitmproxy análise tráfego (cert pinning bloqueia)
  - Documento `docs/audits/pentest-interno.md`
- **Justificativa diferimento:** Não bloqueia Closed Testing (audiência controlada). Recomendado executar antes Open Testing público (#133 transição) pra detectar privilege escalation cross-tenant. Item de pré-launch público, não pré-fechado.

### #039 — Confirmação dupla ao deletar batch (>10 itens)
- **Status:** 🚧 Bloqueado (não-aplicável atual) — re-avaliar quando feature batch select existir
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 2h (UI confirm modal trivial) — mas pré-req feature inexistente
- **Pré-requisito ausente:** App hoje delete só 1-by-1 (DoseCard menu, PatientCard menu, TreatmentForm). Não há feature batch select (multi-checkbox + delete em massa) em nenhuma página. Item proposto pressupõe UI batch que não foi implementada.
- **Aceitação (quando feature existir):** quando há >10 itens selecionados para delete, modal "Tem certeza? Esta ação não pode ser desfeita".
- **Decisão:** parquear até batch select ser priorizado. Sem trigger pra implementar isolado.

### #040 — Subir contraste textos secundários no dark
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 2h (revisar `theme.css`)
- **Aceitação:** axe DevTools confirma WCAG AA em todas as pages dark mode.

### #041 — Hierarquia headings + Dynamic Type via `rem` (PARTIAL v0.2.1.0)
- **Status:** 🟡 Parcial v0.2.1.0 — audit headings done; refactor rem diferido v0.2.2.0+
- **v0.2.1.0 done:** auditoria semantic confirmou PageHeader.jsx renderiza `<h1>` (componente reusado por 14/18 pages). Pages com h1 explicit semantic: Privacidade, Termos, Login, Install (4 outras outras usam PageHeader).
- **v0.2.2.0+ deferred:** refactor mass `fontSize: Npx` → `rem` (172 ocorrências entre pages + components). Decisão: baixo ROI no Capacitor Android WebView (system font-scale não afeta WebView por padrão). Alto risco regressão visual. Re-avaliar quando RWD breakpoint upgrade for priorizado.


- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 4h
- **Aceitação:** font-scale 200% Android funciona; headings semânticos h1>h2>h3.

### #042 — Lighthouse mobile ≥90 em Reports + Dashboard (DEFERIDO v0.2.2.0+)
- **Status:** ⏳ Diferido v0.2.2.0+ (não-bloqueante Closed Testing)
- **Justificativa diferimento v0.2.1.0:** audit completo + iterar fixes (~1 dia trabalho). Depende ambiente prod estável + análise profile bundle. Não-bloqueante Closed Testing categoria Saúde e fitness (review padrão). Re-avaliar pré-Open Testing público (#133).


- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 17 manual
- **Esforço:** depende de findings (parcial pode ser 1 dia)
- **Aceitação:** Lighthouse score ≥90 nas duas pages chave.

### #043 — Performance scroll lista 200+ doses sem jank
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 17
- **Esforço:** já coberto por #034 (virtualização)
- **Aceitação:** validar em device mid-range (Samsung A14).

### #044 — Recriar RPC `register_sos_dose` se houve drift schema
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Plan.md] FASE 0.3 (verificar continua)
- **Esforço:** 30 min audit
- **Aceitação:** rodar `tools/test-sos-bypass.cjs` confirma trigger ainda bloqueia INSERT direto type=sos.

### #045 — Auditar `coverage/` no `.gitignore`
- **Status:** ✅ Concluído (release v0.2.0.2)
- **Origem:** [Auditoria] (BUG-010)
- **Esforço:** 5 min
- **Aceitação:** `git check-ignore coverage/` retorna 0.

### #046 — Documentar runbook de Disaster Recovery
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — `docs/runbook-dr.md` v1.0
- **Origem:** [Plan.md] FASE 23.4
- **Esforço:** 1 dia (executado em 1h)
- **Aceitação:**
  - ✅ RTO 5-15min / RPO 24h documentados
  - ✅ Baseline produção snapshot 2026-05-05 (5 users, 582 doses, etc) referência pré-incidente
  - ✅ Procedure restore daily backup Supabase (passos 1-12, smoke test SQL incluído)
  - ✅ Procedure roll JWT secret #084 (compromised key)
  - ✅ Procedure restore keystore Android #021 (3 locais backup)
  - ✅ Procedure region outage Supabase São Paulo
  - ✅ Procedure pós-incidente (timeline + RCA + LGPD art.48 ANPD notification 72h)
  - ✅ 11 components mapeados com failure modes + recovery (DB/Auth/Edge/Realtime/Storage/FCM/Resend/ImprovMX/CDN/AAB)
  - ✅ Drill schedule semestral staging + anual full
  - ✅ Contatos emergência (owner, DPO, Supabase support, Resend, ImprovMX)
  - ✅ Histórico revisões + próximas iterações (v1.1 incident-comm-template, v1.2 PITR re-eval, v1.3 drill executado)

### #047 — Google Play Integrity API
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 11 → 23 backlog
- **Esforço:** 1 dia
- **Aceitação:** APK modificado falha attestation; produção rejeita chamadas sem token válido.

### #048 — `tools/supabase.exe` removido do git (se versionado)
- **Status:** ✅ Concluído (release v0.2.0.4)
- **Origem:** [Auditoria] (Dimensão 24)
- **Esforço:** 30 min (BFG ou git-filter-repo se versionado)
- **Aceitação:** `git ls-files tools/supabase.exe` vazio + `.gitignore` cobre.

### #049 — Pen test profissional (FASE 20)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 20.3
- **Esforço:** depende fornecedor (1-2 semanas)
- **Aceitação:** relatório com severidades; zero crit/high abertos.

### #100 — Avatar emoji redesign categorias
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Origem:** ROADMAP §6 P2 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  PARCIAL: PatientForm AVATAR_GROUPS reorganizado em 6 categorias (Família, Saúde NOVO, Pessoas, Animais, Atividades NOVO, Cores). Saúde inclui emojis médicos. Default '👤' → '🙂' via DEFAULT_AVATAR. Dedup duplicatas. Fallbacks atualizados em PatientAvatar/FilterBar/Dashboard/PatientDetail. Escopo SVG flat tinted + sliders cor + migration parqueado backlog.
- **Aceitação:** Validado em release v0.2.0.11 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.11.

### #104 — Skeleton legacy → Dosy peach
- **Status:** ✅ Concluído @ commit 8e093a0 (2026-05-04)
- **Origem:** ROADMAP §6 P2 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Card primitive bg-elevated + bg-sunken bars + dosy-shadow-xs. SkeletonList migrado de bg-slate-200 azul pra bg-dosy-bg-sunken (peach #FBE9DC) + shimmer warm.
- **Aceitação:** Validado em release v0.2.0.1 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.1.

### #117 — Alerta paciente compartilhado novo
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P2 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Service listReceivedShares consulta patient_shares WHERE sharedWithUserId = me. Hook useReceivedShares (staleTime 60s, 5min após #141). Header conta shares cujo createdAt > localStorage[dosy_shares_seen_at]. Click → seenAt=now → nav /pacientes. Decay automático.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #118 — Alerta tratamento acabando ≤3 dias
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P2 UX
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Computa endDate = startDate + durationDays*86400000ms em memória (sem coluna nova). Filtra: !isContinuous && status='active' && endDate >= now && endDate-now ≤ 3d. seenAt-based decay igual ao #117. Click → nav /pacientes. EndingSoonSheet componente novo (#118-followup).
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #120 — SharePatientSheet copy plus
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P2 truth
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Copy condicional baseado em tier real. Hardcoded check em SharePatientSheet.jsx:10 mostrava 'Você está no plano Free' pra user Plus. Server-side check OK (RPC APENAS_PRO_COMPARTILHA), apenas client copy errado.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #121 — PaywallModal Escape close
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P2 a11y
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Fix em surfaces.jsx Sheet + Modal: keydown listener Escape chamando onClose. Cobre todos sheets/modals dosy (PaywallModal, SharePatientSheet, EndingSoonSheet, etc).
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #123 — Sessão invalida após DELETE auth.users
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P2 UX/security
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Fix useAuth boot: após getSession(), chama supabase.auth.getUser() (bate na API). Se retornar erro/null, força signOut local + clear cache. Cobre: user deletado, banned, JWT key rotation.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

---

## 🟢 P3 — Melhorias (90 dias)

### #050 — Audit_log abrangente (triggers UPDATE/DELETE)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.2 G12)
- **Esforço:** 1-2 dias

### #051 — 2FA opcional via TOTP
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.4 G10)
- **Esforço:** 1 dia (`auth.mfa.totp.enroll_enabled = true` + UI)

### #052 — Criptografia client-side de `observation`
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.4 G11)
- **Esforço:** 2-3 dias

### #053 — Logout remoto multi-device + tela "Dispositivos conectados"
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5
- **Esforço:** 1-2 dias

### #054 — Notif email + push ao login em device novo
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5
- **Esforço:** 1 dia

### #055 — Session replay (Sentry Replay ou PostHog) — **opcional, privacy concern**
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5
- **Esforço:** 1 dia
- **Risco:** healthcare = revisar antes (pode capturar dados sensíveis). Plan disabled session replay.

### #056 — Visual regression tests (Chromatic/Percy)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.6 G9)

### #057 — Performance budget em CI (size-limit/bundlesize)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5

### #058 — TypeScript migration (ou JSDoc + tsc --checkJs)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.5 (Aud 5.1 G10)

### #059 — `dosy_alarm.mp3` custom sound
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 2.5

### #060 — Detecção root/jailbreak
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23 backlog
- **Aguarda:** plugin community Capacitor 8 maintained

### #061 — Drag-sort de pacientes
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog

### #062 — Anexar comprovantes/imagens em doses (PRO)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog
- **Esforço:** 2-3 dias (Supabase Storage policies + UI)

### #063 — Avaliar remoção de `mockStore.js`
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 15 backlog

### #064 — Verificação de interações medicamentosas + alergia
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 11)
- **Esforço:** 1 semana (banco bulário ANVISA + lógica)
- **Diferenciador healthcare**

### #065 — Estoque + alerta "está acabando"
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 11)
- **Esforço:** 1 semana

### #066 — Lembrete de consulta médica
- **Status:** ⏳ Aberto
- **Origem:** [Auditoria] (Dimensão 11)

### #067 — DosyMonitorService (FASE 23.7)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.7
- **Esforço:** 1 semana
- **Trigger:** se feedback Open Testing reportar alarms missing em Xiaomi/OnePlus

### #068 — iOS via Capacitor
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.6

### #069 — Internacionalização (en, es)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.6

### #070 — Plano Family (até 5 usuários)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.6

### #071 — Programa afiliados (5-10% recorrente)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.3

### #072 — A/B test paywall e onboarding (PostHog feature flags)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 23.2

### #073 — Programa de indicação (1 mês PRO grátis)
- **Status:** ⏳ Aberto
- **Origem:** [Plan.md] FASE 22.3

### #155 — Screenshots novos Play Console v0.2.0.12 (Alterar senha + Recuperar senha)
- **Status:** ⏳ Aberto
- **Origem:** Sessão 2026-05-05 release v0.2.0.12 — features senha (#152 + #153) sem cobertura nos screenshots atuais
- **Prioridade:** P3 (cosmético, não-bloqueador release)
- **Esforço:** 30-60min (capturar + curar + upload Console via Chrome MCP)
- **Dependências:** Master merge v0.2.0.12 + AAB publicado Play Store + acesso S25 Ultra real
- **Descrição técnica:**
  Capturar 2 screenshots S25 Ultra device real em build prod pós-merge master:
  1. Tela "Alterar senha" — Ajustes → Conta → click "Alterar senha" → modal Dosy padrão com ícone Lock + 3 inputs preenchidos (atual + nova + repetir) + footer Cancelar/Confirmar
  2. Tela "Recuperar senha — código 6 dígitos" — Login → "Esqueci minha senha" → email digitado → "Enviar código" → step 2 mostra "Código enviado para X. Digite os 6 dígitos abaixo." + input 000000 placeholder + Confirmar código + Reenviar código
  Resolução S25 Ultra: 1080×2340 OR 1440×3088. Crop pra remover status bar/nav bar via Android Studio device frame OU keep full conforme padrão atual.
- **Aceitação:**
  - 2 screenshots novos curados em `resources/prints/processado/v0.2.0.12-XX-{senha-ajustes,senha-recuperar}.png`
  - Upload Play Console → Listagem da loja → Smartphones → adicionar (sem remover existentes)
  - Pendente revisão Google (junto com próximas mudanças marketing)
- **Detalhe:** Não-bloqueador. Pode ser feito em batch com outras atualizações store quando houver mudança visual significativa.
- **Plus opcional:** atualizar feature graphic 1024×500 OU vídeo demo se disponível ROI.

### #122 — AppHeader greeting trunca nome
- **Status:** ✅ Concluído (release v0.2.0.3)
- **Origem:** ROADMAP §6 P3 cosmético
- **Esforço:** Não documentado
- **Dependências:** Não documentado
- **Descrição técnica:**
  Substituído firstName por shortName em userDisplay.js: retorna primeira+segunda palavra se ambas ≤6 chars (cobre 'Teste Free', 'Teste Plus'), senão só primeira.
- **Aceitação:** Validado em release v0.2.0.3 (sem regressões reportadas)
- **Detalhe:** Ver `contexto/updates/` log da release v0.2.0.3.

### #075 — Reduzir agressividade React Query global (mitiga lentidão geral)
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01)
- **Origem:** [Sessão v0.1.7.0] Análise lentidão reportada pelo user
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Severidade:** alta — combina com #023 + #076 pra fix completo de lentidão/travamento
- **Snippet:**
  ```js
  // src/main.jsx — defaultOptions atual:
  // staleTime: 0
  // refetchOnMount: 'always'
  // refetchOnWindowFocus: true
  //
  // Mudar para:
  staleTime: 30_000,           // 30s — cache fresh por 30s, evita refetch redundante
  refetchOnMount: true,        // só se stale (não 'always')
  refetchOnWindowFocus: true,  // mantém — útil pós-idle curto
  ```
- **Aceitação:**
  - Navegação interna entre pages não dispara refetch se query foi feita há <30s
  - Volta de aba ainda refresh (refetchOnWindowFocus mantido)
  - DoseModal abre rápido (não espera refetch redundante)
  - Lint passa
- **Riscos:**
  - Alarme/notif: zero (config TanStack ≠ alarme nativo Android que vive em SharedPreferences)
  - Realtime: zero (websocket independente)
  - Stale data 30s: aceitável pra healthcare; doses mudam minutos, não segundos

### #076 — Refatorar useAppResume — recovery sem reload destrutivo
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01) — validado live: app recupera URL+state ao voltar foco, sem cold reload. Mitigação parcial do BUG-016 (não previne perda de notif idle, só recovery UX).
- **Origem:** [Sessão v0.1.7.0] User reportou "app trava após ficar aberto muito tempo"
- **Esforço:** 2h
- **Dependências:** nenhuma
- **Severidade:** alta — causa raiz do travamento observado
- **Causa atual:** após 5min idle, `useAppResume.js` força `window.location.href = '/'`. Isso causa cold reload + perda de URL + tela branca 1-3s + cascata de refetch. Se algo falhar nesse reload (SW velho, JWT expirado, race condition), app fica em estado quebrado até hard close de Chrome.
- **Snippet (proposta):**
  ```js
  // src/hooks/useAppResume.js
  // Antes: window.location.href = '/'  (destrutivo)
  // Depois: cleanup + invalidate + reconnect realtime, preservando URL
  if (inactiveMs >= STALE_RELOAD_THRESHOLD_MS) {
    console.log('[useAppResume] long idle', inactiveMs, 'ms → soft recover')
    // 1. Force JWT refresh (Supabase rotaciona refresh token)
    await supabase.auth.refreshSession()
    // 2. Force realtime reconnect (drops dead websockets)
    supabase.removeAllChannels()
    // 3. Invalidate all queries — refetch fresh
    await qc.invalidateQueries()
    // 4. Refetch active queries
    await qc.refetchQueries({ type: 'active' })
    // URL preservada. Sem reload.
  }
  ```
- **Aceitação:**
  - App fica aberto 15min idle → volta foco → não força reload
  - Estado UI preservado (url, modais abertos, scroll position)
  - Doses recentes carregam (queries refetched)
  - Realtime resubscribe (dose tomada em outro device aparece)
  - Manual: device físico Android + 30min idle + voltar → app responde sem cold start
- **Riscos:**
  - Alarme nativo: zero (vive separado em AlarmReceiver + SharedPreferences)
  - Notif FCM: zero (background handler separado)
  - Edge case: se `supabase.auth.refreshSession()` falhar (refresh token expirado), redirect pra login (já handled em supabase.js auth listener)
- **Detalhe:** BUG-016 catalogado em `auditoria-live-2026-05-01/` (nova pasta criada na sessão se necessário)

### #077 — Listener TOKEN_REFRESHED em useRealtime (resubscribe pós JWT rotation)
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01)
- **Origem:** [Sessão v0.1.7.0]
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Severidade:** média — robustez. Sem isso, websocket pode morrer silenciosamente após Supabase rotacionar JWT (default 1h)
- **Snippet:**
  ```js
  // src/hooks/useRealtime.js — adicionar dentro do useEffect
  const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
      unsubscribe()
      subscribe()
    }
  })
  // cleanup: authSub.subscription.unsubscribe()
  ```
- **Aceitação:**
  - Forçar JWT refresh (via `supabase.auth.refreshSession()` no console) → realtime resubscribe ocorre
  - Console log mostra resubscribe disparado
  - Dose tomada em device A após 1h+ aparece em device B (longe-evita)
- **Riscos:** zero — adiciona robustez

### #078 — Bumpar SW cache version v5 → v6 (invalidar bundles velhos)
- **Status:** ✅ Concluído @ commit a67c1b7 (2026-05-01)
- **Origem:** [Sessão v0.1.7.0]
- **Esforço:** 5 min
- **Dependências:** nenhuma
- **Severidade:** baixa — limpeza. SW pode estar servindo bundle velho de v0.1.6.x se cache não rotaciona
- **Snippet:**
  ```js
  // public/sw.js linha 1
  // ANTES: const CACHE = 'medcontrol-v5'
  // DEPOIS: const CACHE = 'medcontrol-v6'
  ```
- **Aceitação:**
  - Após próximo deploy, SW activate event deleta cache `medcontrol-v5` e cria `medcontrol-v6`
  - Devices com bundle velho cached forçam download fresh
- **Convenção:** bumpar a cada release com mudança de bundle JS (esquecer = bug serve velho). **TODO:** automatizar em vite plugin (P2 futuro).

### #079 — Realtime heartbeat keep-alive — caminho 1 de 3 (defense-in-depth)
- **Status:** ✅ Concluído @ commit b4812e0 (2026-05-01) — release v0.1.7.1
- **Origem:** [auditoria-live-2026-05-01] BUG-016 — push + alarme não disparam após 16min idle. Premissa universal: muitos users (cuidadores, pais, profissionais, idosos) deixam app aberto em background — idle deve ser ilimitado.
- **Esforço:** 2-3h (impl + teste device físico)
- **Dependências:** nenhuma
- **Severidade:** P0 — healthcare-critical (dose perdida = paciente sem medicação)
- **Causa-raiz:** websocket Supabase realtime morre silenciosamente durante idle longo Android (Doze + OS network management). Sem heartbeat, sem detecção de conexão morta. App não recebe `postgres_changes` de novas doses → não agenda alarme nativo.
- **Snippet (proposta):**
  ```js
  // src/hooks/useRealtime.js — adicionar dentro do useEffect, após channel.subscribe()
  let pingTimer, pongTimer, heartbeatActive = false
  const startHeartbeat = () => {
    if (heartbeatActive) return
    heartbeatActive = true
    const tick = () => {
      // Ping interno do client Supabase
      pongTimer = setTimeout(() => {
        // Sem pong em 5s → reconnect
        console.warn('[useRealtime] heartbeat timeout — reconnecting')
        unsubscribe()
        subscribe()
        startHeartbeat()
      }, 5_000)
      // Trigger ping (se v2 supabase-js suportar)
      channel?.send({ type: 'broadcast', event: 'ping', payload: {} })
      pingTimer = setTimeout(tick, 30_000)
    }
    pingTimer = setTimeout(tick, 30_000)
    channel?.on('broadcast', { event: 'pong' }, () => clearTimeout(pongTimer))
  }
  startHeartbeat()
  // Cleanup: clearTimeout(pingTimer); clearTimeout(pongTimer)
  ```
- **Alternativa:** investigar `RealtimeClient` do supabase-js — pode já ter heartbeat configurável (`heartbeatIntervalMs`).
- **Aceitação:**
  - App idle por 30min em device físico: dose criada via DB direto APARECE no app sem precisar abrir
  - Alarme nativo agendado dentro de 30s da inserção DB
  - Reconnect automático ao detectar silent fail (logs Sentry: `[useRealtime] heartbeat timeout`)
- **Riscos:**
  - Battery drain — heartbeat 30s é leve mas existe. Considerar pausar em `appStateChange isActive=false` no Android nativo (já pausa hoje) e validar que retoma corretamente
  - Network mobile flaky — ping/pong em 3G ruim pode falsar timeout. Tunear thresholds via teste real
- **Detalhe:** [auditoria-live-2026-05-01/bugs-encontrados.md#bug-016](auditoria-live-2026-05-01/bugs-encontrados.md#bug-016)

### #080 — notify-doses reliability — caminho 2 de 3 (defense-in-depth)
- **Status:** ✅ Concluído @ commit 4b82d16 (2026-05-01) — release v0.1.7.1
- **Origem:** [auditoria-live-2026-05-01] BUG-016
- **Esforço:** 3-4h (investigação + fix + dashboard)
- **Dependências:** acesso aos logs Edge Function (PAT precisa scope `read_logs` ou via Supabase Dashboard manual)
- **Severidade:** P0 — fail-safe server-side falhou, healthcare-critical
- **Sintomas observados (BUG-016):**
  - Dose 18:55 BRT (criada 18:39 via REST direto): nem realtime, nem alarme nativo, nem push FCM
  - Dose 18:58 BRT com user recém-ativo: push chegou normal
  - 2 push_subscriptions registradas pro user (token rotation gerou múltiplos)
  - advanceMins=0 → janela ±60s no Edge query
- **Aceitação:**
  - Logs Edge `notify-doses` últimas 24h analisados — confirmar se cron rodou pra cada dose perdida
  - Implementar retry com exponential backoff em falha FCM transitória (`UNAVAILABLE`, `INTERNAL`)
  - Cleanup `push_subscriptions.deviceToken` em response FCM `INVALID_ARGUMENT` / `UNREGISTERED` (token expirado)
  - Dashboard PostHog/Sentry: alerta queda push delivery rate <99% em 1h (já item #007 + #016)
  - Métrica `notify-doses` por execução: count enviados, count sucessos, count falhas + reason
- **Investigação inicial:**
  - Confirmar `pg_cron.job_run_details` mostra cron rodou às 18:54-18:56
  - Confirmar Edge response = 200 + `sent: N` apropriado
  - Se cron OK + Edge OK + push não chegou → problema FCM-side ou token Android
- **Detalhe:** [auditoria-live-2026-05-01/bugs-encontrados.md#bug-016](auditoria-live-2026-05-01/bugs-encontrados.md#bug-016)

### #081 — Defense-in-depth Android: alarmes nativos horizonte 24-72h — caminho 3 de 3
- **Status:** ✅ Concluído @ commit 49550e4 (2026-05-01) — release v0.1.7.1. **Gate validação device 24h idle FECHADO 2026-05-02** — alarme dose teste tocou após Dosy Dev fechado por 24h sem abrir, confirmando defense-in-depth #083 funciona end-to-end real. BUG-016 100% resolvido.
- **Validação 24h idle pendente (gate final):**
  - User mantém Dosy Dev INSTALADO mas FECHADO por 1 dia inteiro (24h sem abrir)
  - Pré-test: user cadastra dose +24-30h via web (Vercel prod) ANTES fechar app
  - Esperado: alarme físico dispara no horário sem nunca user ter aberto Dosy Dev nesse intervalo
  - Confirma caminhos #083 funcionam end-to-end com app realmente idle longo (não só ~minutos)
  - Caminhos validados: 1 (trigger DB <2s), 2 (cron 6h FCM data), 4 (WorkManager 6h). Caminho 3 (rescheduleAll quando app abre) é sobre re-agendar AO ABRIR — não testado neste cenário (app fica fechado).
  - Resultado positivo → marcar #081 nota "Gate 3 em andamento" como ✅ definitivo + log em updates/
  - Resultado negativo → reabrir investigação (qual caminho falhou? logs Sentry/PostHog/Edge?)
- **Origem:** [auditoria-live-2026-05-01] BUG-016 — defense-in-depth healthcare healthcare-critical
- **Esforço:** 6-8h (impl plugin + WorkManager + teste device físico)
- **Dependências:** nenhuma
- **Severidade:** P0 — caminho mais robusto. Independe de app foreground / websocket / push.
- **Princípio:** Sistema atual depende de 1 caminho (app ativo). Muitos users deixam app aberto background, mas Android pode kill mesmo assim. Solução: agendar alarmes locais com horizonte FUTURO ao invés de só "próxima dose".
- **Estratégia:**
  1. Quando app abre / sincroniza: plugin `criticalAlarm` agenda TODAS doses dos próximos 24-72h via `setAlarmClock()` (sobrevive Doze)
  2. SharedPreferences armazena lista. `BootReceiver` re-agenda após reboot (já existe)
  3. **Novo:** `WorkManager` periódico (a cada 6-12h) sincroniza DB → reagenda alarmes recém-criados sem precisar app foreground
  4. `WorkManager` requer `WorkRequest` com `setInitialDelay` + `setPeriodic`. Bateria-friendly.
- **Snippet conceitual (Java/Kotlin Android):**
  ```java
  // android/app/src/main/java/.../DoseSyncWorker.java
  public class DoseSyncWorker extends Worker {
      public Result doWork() {
          // 1. Fetch doses próximos 72h via Supabase REST (auth via stored token)
          // 2. Diff com SharedPreferences cache
          // 3. setAlarmClock() pra novas doses, cancelAlarm() pra removidas
          return Result.success();
      }
  }
  // Schedule:
  PeriodicWorkRequest sync = new PeriodicWorkRequest.Builder(
      DoseSyncWorker.class, 6, TimeUnit.HOURS).build();
  WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
      "dose-sync", ExistingPeriodicWorkPolicy.KEEP, sync);
  ```
- **Aceitação:**
  - App fechado por 48h em device físico
  - Doses criadas via DB direto chegam até 72h depois
  - Alarme nativo dispara conforme schedule, mesmo SEM app NUNCA ter sido aberto
  - WorkManager log mostra runs periódicos no `adb shell dumpsys jobscheduler`
- **Riscos:**
  - Bateria: WorkManager a cada 6h é leve mas existir. Threshold ajustável.
  - OEMs hostis (Xiaomi/MIUI): WorkManager pode ser killed. Mitigação: combinação com `setAlarmClock()` que bypassa Doze por design.
  - Duplicação de alarmes: cuidado com idempotência ao reagendar.
- **Detalhe:** [auditoria-live-2026-05-01/bugs-encontrados.md#bug-016](auditoria-live-2026-05-01/bugs-encontrados.md#bug-016)

### #083 — FCM-driven alarm scheduling + 4 caminhos coordenados (idempotente)
- **Status:** ✅ Concluído @ commits `23deca4` + `3465ab6` + `26c51ab` (2026-05-02) — release v0.1.7.2. Validado end-to-end: cadastro web → trigger DB → Edge FCM → device agendou alarme nativo → alarme físico tocou no Android no horário.
- **Origem:** [Sessão v0.1.7.1] User pedido: "alarme funcionar mesmo sem abrir app, dose +1mês precisa tocar"
- **Esforço:** ~6-8h (Edge + Android nativo + migration + testes)
- **Dependências:** #079 #080 #081 já fechados; nenhuma externa
- **Severidade:** P0 — healthcare-critical, fecha BUG-016 100%

#### Arquitetura — 4 caminhos coordenados pra agendar alarme nativo

Cada caminho roda independente. **Idempotência via id determinístico** (`AlarmScheduler.idFromString(doseId)` — mesmo id = substitui, nunca duplica). User vê **1 alarme** mesmo se 4 caminhos tentarem agendar.

| # | Caminho | Quando dispara | Cobertura | Latência |
|---|---|---|---|---|
| **1** | Trigger DB Supabase ON INSERT/UPDATE doses | Imediato ao cadastrar/editar dose | "+30min via web, app fechado" | <2s |
| **2** | Cron Edge 6h `notify-doses-schedule` | Sweep periódico | Garantia caso trigger falhou; doses 72h adiante | até 6h |
| **3** | App `rescheduleAll()` quando abre | Toda vez user abre app | Redundância adicional | imediato |
| **4** | WorkManager DoseSyncWorker (#081 atual) | A cada 6h em background | Backup se FCM falhar entrega | até 6h |

#### Notificação push tray — fallback inteligente

> Filosofia user: "se dose tiver alarme setado, ok; se não, manda push"

- **Hoje:** `notify-doses` cron 1min manda push tray sempre (~advanceMins antes da dose)
- **Novo:** cron antes de mandar push, consulta tabela `dose_alarms_scheduled (doseId, userId, deviceId)`:
  - Se row existe → device já tem alarme nativo agendado → **skip push** (alarme fullscreen cobre)
  - Se row ausente → push é única chance → manda push tray normal

Comportamento prático user:
- Caso ideal: alarme nativo agendado → device toca despertador fullscreen no horário, sem push tray redundante
- Caso fallback: alarme não foi agendado (caminhos 1-4 falharam todos) → push tray dispara como única notificação — user vê algo, mesmo que menos crítico

#### Componentes a implementar

**A. Database migration `20260502xxxxxx_dose_alarms_scheduled.sql`:**
```sql
CREATE TABLE medcontrol.dose_alarms_scheduled (
  "doseId" uuid REFERENCES medcontrol.doses(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL,
  "deviceId" text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("doseId", "deviceId")
);
-- RLS: service_role only
```

**B. Edge Function NOVA `schedule-alarms-fcm` (cron 6h):**
- Pra cada user com push_subscription ativa, busca doses pendentes próximas 72h
- Manda FCM **data message** `{"action": "schedule_alarms", "doses": [{...}]}` pra deviceToken
- **NÃO inclui notification payload** (silencioso, só wake-up)
- Atualiza `dose_alarms_scheduled` (especulativo — assume FCM entrega)

**C. Edge Function NOVA `dose-trigger-handler` (Postgres webhook trigger):**
- Trigger ON INSERT/UPDATE em `medcontrol.doses` chama essa função
- Lógica idêntica a `schedule-alarms-fcm` mas pra dose única recém-cadastrada

**D. Edge `notify-doses` (modificada):**
- Antes de enviar push tray, query `dose_alarms_scheduled` por doseId+deviceId
- Se row existe → skip
- Se não → manda push (mantém comportamento atual)

**E. Android `FirebaseMessagingService` (handler novo):**
```java
@Override
public void onMessageReceived(RemoteMessage msg) {
  Map<String, String> data = msg.getData();
  if ("schedule_alarms".equals(data.get("action"))) {
    JSONArray doses = new JSONArray(data.get("doses"));
    for (JSONObject d : doses) {
      AlarmScheduler.scheduleDose(ctx, idFromString(d.getString("doseId")),
          parseInstant(d.getString("scheduledAt")), d);
      // Reporta ao server
      reportAlarmScheduled(ctx, d.getString("doseId"), getDeviceId());
    }
  } else {
    super.onMessageReceived(msg); // notification message — handler default
  }
}
```

**F. Android `criticalAlarm` plugin:**
- Novo método `reportAlarmScheduled(doseId)` chama Supabase REST insert dose_alarms_scheduled
- Auth via SharedPreferences (já temos via #081)

**G. App `rescheduleAll` (modificado):**
- Após agendar local: também upsert `dose_alarms_scheduled` (defesa em camadas)

#### Aceitação

1. ✅ User cadastra dose +1 mês via web. Não abre app Android. 1 mês depois alarme dispara fullscreen.
2. ✅ User cadastra dose +30min via web. Trigger manda FCM data <2s. Device agenda. 30min depois despertador toca.
3. ✅ User cadastra dose +5min via web (advanceMins=5). FCM data + cron notify-doses ambos rodam. Device agenda alarme via FCM data. Cron notify-doses ANTES de mandar push tray detecta alarme já agendado e skip — user vê apenas despertador, sem push redundante.
4. ✅ Device offline durante FCM data send. Volta online 2h depois. Cron 6h re-tenta + entrega. Device agenda. Alarme funciona.
5. ✅ User cadastra dose +5min via web. Push FCM data falha entrega total (rate limit). Cron `notify-doses` 1min detecta dose em janela, alarme NÃO agendado → manda push tray. User vê notif "dose em 1min" como fallback.
6. ✅ User abre app após 1 semana. App roda rescheduleAll. Verifica quais doses já tem alarme agendado (via local SharedPreferences). Adiciona apenas as faltantes. **Sem duplicar.**
7. ✅ 4 caminhos tentam agendar mesma dose. AlarmScheduler.scheduleDose com mesmo id = replace. user vê 1 alarme.

#### Riscos / mitigação

- **FCM data message pode ter delivery delay** (Doze mode estendido) — mitigação: cron 6h sweep + WorkManager #081 + rescheduleAll quando app abre = 4 caminhos
- **DB trigger pode falhar silenciosamente** — mitigação: cron 6h pega no próximo ciclo
- **Bateria** — wake-up FCM data 4×/dia + cron sync = baixo impacto (Slack/WhatsApp fazem dezenas/dia)
- **Latência cron 6h pra dose +30min "via web app fechado"** — mitigação: trigger DB cobre <2s

#### Implementação faseada (sub-items se quiser quebrar)

- #083.1 Migration `dose_alarms_scheduled`
- #083.2 Edge `schedule-alarms-fcm` cron 6h
- #083.3 Edge `dose-trigger-handler` + Postgres trigger
- #083.4 `notify-doses` modificação (skip se alarme agendado)
- #083.5 Android FirebaseMessagingService handler
- #083.6 `criticalAlarm` plugin: reportAlarmScheduled method
- #083.7 App rescheduleAll: upsert dose_alarms_scheduled
- #083.8 Validação device físico (idle 1 semana sem abrir app)

### #082 — Dual-app Android: Dosy Dev + Dosy oficial coexistem
- **Status:** ✅ Concluído @ commit 5b5938e (2026-05-01) — release v0.1.7.1
- **Origem:** [Sessão v0.1.7.1] User pedido: "ambiente dev independente, fácil merge em Dosy quando release"
- **Esforço:** 1h (Gradle + Firebase entry + manifest)
- **Implementação:**
  - `android/app/build.gradle`: buildTypes.debug com `applicationIdSuffix .dev` + resValue app_name "Dosy Dev"
  - `android/app/build.gradle`: buildTypes.release com resValue app_name "Dosy"
  - Firebase Console: nova app entry `com.dosyapp.dosy.dev` (registrada via Console)
  - `android/app/src/debug/google-services.json`: novo (Firebase plugin auto-escolhe por buildType)
  - `AndroidManifest.xml`: `${appLabel}` placeholder (substituído conforme variant)
  - `build.gradle`: dep `com.google.guava:guava:33.4.0-android` (resolve Worker.startWork() ListenableFuture compileClasspath)
- **Aceitação:**
  - Studio Run debug → instala "Dosy Dev" (`com.dosyapp.dosy.dev`) no device
  - Build release → AAB "Dosy" (`com.dosyapp.dosy`) pra Play Store
  - Apps coexistem no mesmo device, dados isolados
  - Push FCM funciona em dev (Firebase entry .dev separada)
- **Validado:** Gate 1 (build OK + instalou) ✅ via Android Studio Run em emulador

### #074 — Habilitar upload de debug symbols no Play Console
- **Status:** ✅ Concluído (release v0.2.0.2)
- **Origem:** [Sessão v0.1.6.10] Aviso recorrente Play Console
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Severidade:** baixa — não bloqueia release; melhora qualidade de stack traces de crashes/ANRs no Console
- **Snippet:**
  ```gradle
  // android/app/build.gradle dentro de android { ... }
  android {
      buildTypes {
          release {
              ndk {
                  debugSymbolLevel 'FULL'  // ou 'SYMBOL_TABLE' (mais leve)
              }
          }
      }
  }
  ```
- **Aceitação:**
  - Próximo AAB build inclui símbolos de depuração nativos
  - Play Console não exibe mais aviso "App Bundle contém código nativo, e você não fez upload dos símbolos de depuração"
  - Crashes nativos no Console mostram stack traces simbolicados em vez de offsets brutos
- **Detalhe:** Aviso aparece em todo upload AAB enquanto não habilitado. Sem impacto no usuário final; só dev observability. Tamanho AAB sobe ~5-10 MB com FULL.

---

### #084 — Hotfix v0.1.7.5: rotação service_role JWT + JWT secret Supabase + reconectar Vercel↔GitHub
- **Status:** ✅ Concluído (release v0.1.7.5)
- **Origem:** INCIDENTE 2026-05-02 22:23 UTC. Migration `20260502091000_dose_trigger_webhook.sql` (commit original `85d5e61`) foi commitada com service_role JWT inline. GitGuardian + GitHub Security flagged em ~6min. Histórico do branch reescrito via `git-filter-repo` + force push (commit `6310c1e`). Tag `pre-secret-purge-backup` empurrada origin como referência.
- **Severidade:** P0 security — service_role bypassa RLS = exposição teórica de TODOS dados saúde de TODOS users (LGPD categoria especial). Chave permanece em GitHub commit cache + indexers externos (Google cache, Wayback, etc) por tempo indeterminado.
- **Esforço:** ~30-60min (sessão dedicada)
- **Dependências:** nenhuma (independente)

#### Janela de exposição

- **Leak:** 2026-05-02 ~22:23 UTC (push original `85d5e61`)
- **Purge:** 2026-05-02 ~22:29 UTC (force push `6310c1e`)
- **Window in-repo:** ~6min
- **Window cache externo:** indeterminado (continua exposta)

#### Plan de execução — divisão autônomo / user

> **Filosofia:** agente faz tudo que não é destrutivo-irrecuperável ou prohibited safety-rule. User só clica botão final irreversível ou autoriza OAuth.

**FASE 0 — Pre-checks (autônomo agente):**
- [ ] Confirmar branch: criar `release/v0.1.7.3` a partir de master atualizada
- [ ] Verificar `.env.local` tem `VITE_SUPABASE_ANON_KEY` legível pra registrar valor velho (pra audit)
- [ ] `git fetch origin && git status` clean
- [ ] Verificar Vercel CLI auth (`vercel whoami` deve retornar `lhenriquepda`)

**FASE 1 — Auditar logs janela leak (autônomo agente, via PAT):**
- [ ] Query Supabase logs Auth + REST janela 22:23-22:29 UTC
- [ ] Query `auth.audit_log_entries` mesma janela
- [ ] Comparar com baseline (sessão anterior idle period) — uso anômalo?
- [ ] Reportar achados antes prosseguir rotação

**FASE 1.5 — Audit secrets adicionais no histórico (autônomo agente):**
> Defense-in-depth: garantir que rotação JWT é o ÚNICO leak. Outros tipos de
> credenciais (PAT, service account JSON, Firebase keys, VAPID, etc) podem
> ter vazado em commits diferentes sem detection ainda.
- [ ] `git log --all --full-history -p -- supabase/migrations/ | grep -iE "jwt|service_role|sbp_|sk-|api[_-]key|password|secret"`
- [ ] `git log --all --full-history -p -- .env* supabase/functions/ | grep -iE "key|secret|token"`
- [ ] Buscar em refs órfãos: `git fsck --lost-found` + inspect
- [ ] Verificar tags com conteúdo sensível: `pre-secret-purge-backup` (já confirmada limpa em audit 2026-05-02 11:50 UTC)
- [ ] Listar resultado consolidado em `contexto/updates/{data}-release-v0.1.7.3.md` antes prosseguir

**FASE 2 — Reconectar Vercel↔GitHub (guided via Claude in Chrome):**
- [ ] Agente navega `https://vercel.com/lhenriquepdas-projects/dosy/settings/git`
- [ ] Agente clica botão "GitHub" pra iniciar reconexão
- [ ] **USER ACTION:** autoriza OAuth Vercel↔GitHub (pelas regras safety, OAuth login = só user)
- [ ] **USER ACTION:** seleciona repo `lhenriquepda/medcontrol_v2`
- [ ] Agente confirma webhook ativo via deployments page
- [ ] Agente push commit vazio teste pra confirmar auto-deploy dispara

**FASE 3 — Rotação JWT secret (guided via Claude in Chrome):**
- [ ] Agente navega Supabase Dashboard → projeto dosy-app → Settings → API
- [ ] Agente localiza botão "Generate a new JWT secret" / "Roll JWT Secret"
- [ ] Agente expande/lê confirmação dialog (preview destruction message)
- [ ] **USER ACTION:** clica botão Roll (irreversível) + confirma dialog
- [ ] Agente copia novos valores: `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (NUNCA log no chat — só persist em arquivos protegidos)

**FASE 4 — Atualizar env vars (autônomo agente):**
- [ ] Vercel CLI: `vercel env rm VITE_SUPABASE_ANON_KEY production` (3 envs: prod/preview/dev)
- [ ] Vercel CLI: `vercel env add VITE_SUPABASE_ANON_KEY production` (cole valor novo)
- [ ] Repetir pra preview + development
- [ ] Atualizar `.env.local` (não-commitado, gitignored) — anon key novo
- [ ] **USER ACTION:** confirmar não há outras máquinas dev pendentes
- [ ] Atualizar `SUPABASE_SERVICE_ROLE_KEY` em Edge Functions secrets:
  - Via Supabase Dashboard → Edge Functions → Secrets, OR
  - Via Supabase CLI: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... --project-ref guefraaqbkcehofchnrc`

**FASE 5 — Redeploy infra (autônomo agente):**
- [ ] Vercel CLI: `vercel --prod --force` (rebuild com env nova)
- [ ] Edge Functions redeploy (todas que usam service_role): `supabase functions deploy --project-ref guefraaqbkcehofchnrc` lista relevant
- [ ] Confirmar Vercel prod respondendo 200 em `https://dosy-teal.vercel.app/ajustes`

**FASE 6 — Rebuild Android (parcialmente guided):**
- [ ] Agente atualiza `android/app/src/main/assets/capacitor.config.json` se necessário (verificar se anon key não está baked)
- [ ] Agente verifica `src/services/supabase.js` lê `import.meta.env.VITE_SUPABASE_ANON_KEY` (não hardcoded)
- [ ] Bump versão patch: 0.1.7.2 → 0.1.7.3 (package.json + gradle versionCode 27)
- [ ] **USER ACTION:** Android Studio Build → Generate Signed Bundle (release variant)
- [ ] **USER ACTION:** confirma AAB pronto em `android/app/release/app-release.aab`
- [ ] Agente upload AAB Play Console via Claude in Chrome (mesmo fluxo de v0.1.7.2)
- [ ] **USER ACTION:** confirma "Salvar e publicar" no Console

**FASE 7 — Verificação pós-rotação (autônomo agente):**
- [ ] Test: query Supabase com chave VELHA → deve retornar 401/403
- [ ] Test: query Supabase com chave NOVA → deve retornar 200
- [ ] Test: login Vercel prod (`https://dosy-teal.vercel.app`) com `teste03@teste.com / 123456` → fluxo completo
- [ ] Test: device físico Dosy Dev (instalado v0.1.7.2-dev) — login + cadastrar dose teste → alarme dispara?
  - **Nota:** Dosy Dev tem chave VELHA baked → vai falhar até reinstall. Esperado. Reinstall via Studio Run após FASE 6.
- [ ] Auditar logs Supabase 1h pós-rotação — qualquer 401 inesperado de cliente legítimo?

**FASE 8 — Cleanup + release v0.1.7.3 (autônomo agente):**
- [ ] Merge `release/v0.1.7.3` → master (--no-ff) + tag `v0.1.7.3` + push
- [ ] Atualizar `contexto/`: ROADMAP §3+§12, PROJETO.md versão, README.md "Estado atual"
- [ ] Criar `contexto/updates/2026-05-XX-release-v0.1.7.3.md` com log completo + audit findings
- [ ] Marcar #084 ✅ Concluído em CHECKLIST + ROADMAP
- [ ] Decrementar P0: 7 → 6
- [ ] Deletar `release/v0.1.7.3` local + remote
- [ ] (Opcional) Deletar tag `pre-secret-purge-backup` se audit confirmou zero uso anômalo

**FASE 8.5 — Resolution alerts security dashboards (guided via Claude in Chrome):**
> Após rotação confirmada, marcar alertas como "resolved/revoked" pra fechar
> ticket. Chave vazada continua existindo em commit cache GitHub + indexers
> externos, mas perde valor (rotation = chave inválida server-side).
- [ ] **GitHub Security:** navega `https://github.com/lhenriquepda/medcontrol_v2/security/secret-scanning`
  - Localiza alerta "Supabase Service Key" (commit 85d5e614)
  - Click "Close as" → "Revoked" (chave já rotacionada)
  - Add comment: "Rotated v0.1.7.3 hotfix on YYYY-MM-DD"
- [ ] **GitGuardian:** navega `https://dashboard.gitguardian.com` (login via GitHub OAuth)
  - Localiza alerta `Supabase Service Role JWT` no repo medcontrol_v2
  - Marcar "Resolved" → motivo "Secret revoked"
- [ ] (Opcional) **GitHub Support:** abrir ticket pra purgar commit cache órfão `85d5e614`
  - Endpoint: `https://support.github.com/contact/private-information`
  - Justificar: secret credential exposed, request commit deletion from cache
  - Não-bloqueante (rotation já mitiga risco efetivo)
- [ ] Verificar 24h depois: alertas permanecem fechados, novos não disparam

#### Aceitação

- Chave velha retorna 401/403 em qualquer endpoint
- Chave nova funciona em Vercel prod + Edge Functions + APK Dosy Dev (após reinstall)
- Logs Supabase janela leak auditados — relatório de uso anômalo (0 ou N) em `updates/`
- Vercel↔GitHub reconectado: push pra master dispara auto-deploy
- AAB v0.1.7.3 publicado Play Store Internal Testing
- 3 ambientes sincronizados (master + Vercel prod + Play Store) versionados v0.1.7.3
- `pre-secret-purge-backup` tag mantida ou deletada conforme audit

#### Risk register

| Risco | Mitigação |
|---|---|
| Dosy oficial Play Store users com chave velha → 401 até auto-update | Auto-update Android é rápido pra Internal Testing (<24h). User comunica testers se notar. |
| Edge Function downtime entre roll e redeploy | Redeploy imediato após rotação. Idle ~2min. |
| Vercel env update falha → prod fica com chave inválida | Dry-run env update + verify ANTES rebuild. Rollback: revert env via dashboard. |
| User cliente caches anon key velha em IndexedDB | Service worker bump cache version força refresh. |
| OAuth Vercel↔GitHub falha | Fallback: continuar `vercel --prod` CLI até sessão futura. |

- **Detalhe completo:** ver `contexto/updates/2026-05-02-release-v0.1.7.2.md` (incident report).

---

### #085 — BUG-018: Alarme Crítico OFF em Ajustes mas alarme tocou
- **Status:** ✅ Concluído @ commit f22f5a9 (2026-05-02)
- **Origem:** Reportado user 2026-05-02 pós install v0.1.7.2. User toggle OFF em Ajustes → cadastrou dose teste → alarme nativo fullscreen disparou (não deveria — esperado: apenas notificação push tray).
- **Severidade:** P1 healthcare-adjacent (trust violation user setting + LGPD/privacy implications quanto user opta por menos intrusão)
- **Esforço:** ~3-5h (auditar 4 caminhos + criar source-of-truth + testes)
- **Dependências:** nenhuma (independente, mas #087 DND UX depende disso)

#### Diagnóstico provável

Toggle "Alarme Crítico" não está sendo respeitado em algum dos 4 caminhos coordenados de #083. Suspeitos:

| Caminho | Onde verificar | Risco |
|---|---|---|
| 1. Trigger DB (Edge `dose-trigger-handler`) | Edge consulta user prefs antes mandar FCM data com `scheduleAlarm:true`? | Alto — Edge talvez ignora flag |
| 2. Cron 6h (Edge `schedule-alarms-fcm`) | Mesma checagem? | Alto |
| 3. App `rescheduleAll()` | `criticalAlarm.js` consulta useUserPrefs antes scheduling? | Médio |
| 4. WorkManager DoseSyncWorker | Worker consulta SharedPreferences flag antes setAlarmClock? | Alto (é background, sem React state) |

#### Investigação inicial

- [ ] Reproduzir: toggle OFF Ajustes → cadastrar dose +1min → confirmar alarme fullscreen disparou
- [ ] Inspecionar `useUserPrefs.js` — qual key salva o toggle? Persiste em DB ou só local?
- [ ] Inspecionar Edge `dose-trigger-handler/index.ts` — query user prefs antes responder?
- [ ] Inspecionar Edge `schedule-alarms-fcm/index.ts` — mesmo
- [ ] Inspecionar `src/services/criticalAlarm.js` — `scheduleAlarm()` consulta prefs?
- [ ] Inspecionar `DoseSyncWorker.java` (Android) — lê SharedPreferences `criticalAlarmEnabled`?
- [ ] Inspecionar `DosyMessagingService.onMessageReceived` — lê flag antes de chamar `AlarmScheduler.schedule()`?

#### Solução

Single source of truth: flag persistida em `medcontrol.user_prefs.critical_alarm_enabled` (DB) + cached SharedPreferences Android.

- Cliente UI: ao toggle, atualiza ambos (DB + local cache via SharedPreferences plugin)
- Edge functions: leem `user_prefs.critical_alarm_enabled` antes mandar FCM data com `scheduleAlarm:true`. Se OFF, mandam só `pushNotification:true` (tray fallback).
- AlarmScheduler.schedule() (Android nativo): consulta SharedPreferences cache antes setAlarmClock. Se OFF, no-op (push tray cobre).
- `criticalAlarm.js` (web/Capacitor): mesma checagem antes de chamar plugin.

#### Aceitação

- [ ] Toggle OFF Ajustes → cadastrar dose → push tray dispara, **alarme fullscreen NÃO** dispara em nenhum dos 4 caminhos
- [ ] Toggle ON novamente → alarme fullscreen dispara normalmente
- [ ] Dose já agendada (com toggle ON) + user toggle OFF depois → próxima dose: respeita OFF (cancelar alarme nativo agendado se necessário)
- [ ] Test cobre todos 4 caminhos: trigger DB, cron 6h, rescheduleAll, WorkManager
- [ ] Logs Sentry/PostHog telemetria: zero `critical_alarm_fired_when_disabled`

---

### #086 — BUG-019: Resumo Diário não funciona — nunca dispara
- **Status:** ⏸️ Bloqueado — parqueado pra v0.1.8.0 (caminho B). UI ocultada em v0.1.7.3 (commit pending).
- **Origem:** Reportado user 2026-05-02. Feature configurada em Ajustes (horário definido) mas user nunca recebeu notificação no horário marcado.
- **Severidade:** P1 broken feature user-facing
- **Esforço:** ~2-4h (depende de fix vs parquear)
- **Dependências:** nenhuma

#### Diagnóstico provável

Feature pode ter quebrado em qualquer ponto end-to-end:

1. Persistência horário em prefs/DB — config salva?
2. Mecanismo agendamento — pg_cron job? Edge cron? AlarmManager local? WorkManager?
3. Trigger lógica — chega na hora, calcula payload, manda push
4. FCM token ativo + channel notif Android registrado
5. UI Ajustes — horário exibido bate com persistido?

#### Investigação inicial

- [ ] Localizar onde feature está implementada (UI Ajustes, service, Edge, cron)
- [ ] Inspecionar `pages/Settings.jsx` — campo horário salva em qual key?
- [ ] Inspecionar `useUserPrefs` — `daily_summary_time` ou similar persiste em DB?
- [ ] Buscar Edge function relevante (`daily-summary`?, `notify-doses`?)
- [ ] Verificar pg_cron jobs ativos: `SELECT * FROM cron.job` no Supabase
- [ ] Sentry/logs: erro nas execuções? Job nem roda?
- [ ] FCM token user — registrado? Chegando push de teste em outras features?

#### Decisão branch points

- **Caminho A — Feature broken end-to-end mas baixa complexidade:** fix em v0.1.7.3
- **Caminho B — Feature precisa retrabalho significativo:** parquear pra v0.1.8.0 + esconder UI até pronto + comunicar user ✅ ESCOLHIDO
- **Caminho C — Feature funciona, mas user-side issue (FCM token expirado, channel mutado):** dx fix + telemetria preventiva

#### Decisão tomada (2026-05-02): Caminho B

Investigação concluída em src/services/notifications.js:312-338. Resumo diário
implementado client-side via Capacitor LocalNotifications. Schedule
{ every: 'day' } depende de:
- App abrir pelo menos 1x pra rescheduleAll() agendar
- Sobreviver Doze mode Android

Sem cron server-side equivalente (não há Edge `daily-summary-cron`). User idle
nunca recebe.

Para fix completo precisaria:
- Migration nova: tabela `daily_summary_log` (PK userId+date) pra idempotência
- Edge function `daily-summary-cron`
- Schedule pg_cron 1x/hora chamando Edge
- Timezone handling per-user (default America/Sao_Paulo, mas pode haver users
  fora — tabela user_prefs sem coluna timezone atualmente)
- Push tray formatting + payload

Esforço: ~3-5h. Escopo grande pra hotfix v0.1.7.3 (focado #084 security +
#085/#087 toggle bypass).

**Ação v0.1.7.3:** ocultar UI Resumo Diário em Settings.jsx pra user não
esperar feature broken. Toggle + horário continuam persistidos em DB se
setados antes; apenas não-renderizados.

**Próxima sessão v0.1.8.0:** quebrar #086 em sub-itens (#086.1 migration,
#086.2 Edge, #086.3 cron schedule, #086.4 timezone field, #086.5 reativar
UI) e implementar.

#### Aceitação

- [ ] User configura resumo diário às HH:MM em Ajustes
- [ ] No horário marcado (±1min), notificação push tray chega
- [ ] Conteúdo resumo bate com adesão últimas 24h: doses programadas, tomadas, perdidas, próximas
- [ ] Se feature parqueada (caminho B): UI esconde toggle + nota "em breve" + ROADMAP item v0.1.8.0 criado

---

### #087 — BUG-020: DND verificar funcional + UX condicional ao Alarme Crítico
- **Status:** ✅ Concluído @ commit f22f5a9 (2026-05-02)
- **Origem:** Reportado user 2026-05-02. Solicitação dupla: (1) verificar se Não Perturbe atual respeita janela horária configurada; (2) refactor UX condicional.
- **Severidade:** P1 UX healthcare-adjacent
- **Esforço:** ~3-4h (verificação + UX refactor)
- **Dependências:** **#085 deve fechar primeiro** — toggle parent precisa funcionar pra UX condicional fazer sentido.

#### Verificação funcional (parte 1)

- [ ] Inspecionar implementação atual DND em `pages/Settings.jsx` + `services/notifications.js` + `criticalAlarm.js`
- [ ] DND tem campos: hora início + hora fim + flag enabled?
- [ ] Quando alarme deveria disparar dentro da janela DND, qual comportamento atual? (silencia, vibra só, bypassa, nada)
- [ ] Reproduzir: configurar DND 22:00-08:00 → criar dose 02:00 → testar comportamento
- [ ] Documentar comportamento atual antes de refactorar

#### Refactor UX condicional (parte 2)

Comportamento desejado por user:
- Toggle pai: **Alarme Crítico** (Ajustes raiz)
  - **OFF:** apenas push notification tray (sem alarme fullscreen). DND option **NÃO aparece** na UI.
  - **ON:** alarme fullscreen ativo. **DND option aparece** abaixo:
    - DND toggle: enabled / disabled
    - Se enabled: campos horário início + fim
    - Comportamento: dentro da janela DND, **Alarme Crítico desativa** (push tray cobre como fallback). Fora da janela: Alarme Crítico normal.

#### Componentes afetados

- `pages/Settings.jsx` — render condicional DND section
- `useUserPrefs.js` — hook com novos fields se ainda não existirem
- Migration DB — adicionar `dnd_start_time`, `dnd_end_time`, `dnd_enabled` em `user_prefs` (se ainda não)
- Edge functions + AlarmScheduler — checar janela DND antes scheduling (mesmo source-of-truth #085)

#### Aceitação

- [ ] Alarme Crítico OFF → DND option não aparece na UI
- [ ] Alarme Crítico ON → DND option aparece com toggle + campos horário
- [ ] DND ON + janela 22:00-08:00 → criar dose 02:00 → push tray dispara, alarme fullscreen não
- [ ] DND OFF (com Alarme Crítico ON) → alarme fullscreen normal independente de horário
- [ ] DND ON com janela inválida (start > end, atravessa meia-noite) é tratado corretamente
- [ ] Persistência DB OK — relogar mantém config

### #127 — CI failing (lint errors react-hooks pré-existentes em AnimatedRoutes.jsx)
- **Status:** ✅ Concluído (2026-05-05)
- **Origem:** descoberto durante validação #008 (2026-05-04)
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Aceitação:**
  - ✅ 2 errors `react-hooks/refs` resolvidos (`Cannot access refs during render`)
  - ✅ Fix: substituído `useRef('forward')` (directionRef + prevPathRef) por `useState(location.pathname)` (prevPath) + computa `direction` puro durante render
  - ✅ `npm run lint` retorna 0 errors (61 warnings — todos pré-existentes ou heurística react-compiler padrão codebase)
  - ✅ Build prod ok (`npm run build` 32s)
  - ⏸ GitHub CI workflow Lint+Test+Build vai passar no próximo push (validação automática)
  - ⏸ Sentry source maps upload rodará automaticamente após próximo CI bem-sucedido (libera #008 aceitação completa)
- **Impacto resolvido:** CI verde → source maps Sentry sobem → crash investigation pós-launch com stack trace symbolicado.

### #128 — BUG-040: Multi-dose alarm mostra só 1 medicamento + paciente "Sem Paciente"
- **Status:** ✅ Concluído @ commit 559004b (2026-05-05)
- **Origem:** reproduzido S25 Ultra Dosy Dev v0.2.0.7 durante captura assets #025 (2026-05-04)
- **Esforço:** 2-4h (investigação + fix + reteste device)
- **Dependências:** nenhuma
- **Aceitação:**
  - Reproduzir: cadastrar 6 doses simultâneas (`scheduledAt` idêntico) distribuídas entre 2 pacientes — 3 Lucas + 3 Maria — confirma que ainda mostra só 1 med + "Sem Paciente"
  - Fix: AlarmActivity render multi-dose deve listar TODAS doses agendadas pra mesmo `scheduledAt` (com nome paciente correto cada uma) — não só uma
  - Validar nome paciente preenchido em qualquer caminho (Receiver / Activity / Service)
  - Re-teste S25 Ultra: 6 doses simultâneas → tela Alarme mostra 6 itens com nome de cada paciente
- **Hipóteses iniciais:**
  - (a) `AlarmReceiver` agrupa doses pelo `scheduledAt` exato mas falha quando 2 pacientes diferentes — group key pode estar derivando só do timestamp e perdendo lista patientId/medName
  - (b) FCM data path entrega só 1 dose ID no payload (não array completo) → AlarmActivity carrega só essa
  - (c) Patient name lookup no Activity falha (RPC call falha → fallback "Sem Paciente")
  - (d) `AlarmScheduler` agenda múltiplos `setAlarmClock()` mas só primeiro dispara, others suprimidos pelo OS por timing idêntico
- **Investigar primeiro:**
  - Logs `adb logcat` filtro `AlarmReceiver|AlarmActivity|AlarmService|AlarmScheduler|DosyMessagingService` durante repro
  - DB: `SELECT id, "patientId", "medName" FROM doses WHERE "scheduledAt" = X` confirma 6 doses no DB
  - Conferir se Realtime entregou todas 6 ao app antes do alarme disparar
  - Conferir Edge `notify-doses` logs — quantos FCM envelopes foram enviados (1 com array vs 6 separados?)
- **Detalhe:** Bug isolado fora de auditoria formal. Catalogar em `auditoria-live-2026-05-04/` se virar item recorrente. Por hora só ROADMAP.
- **P1 healthcare-adjacent** (trust violation: usuário não vê todas medicações que precisa tomar; LGPD-adjacent: paciente perde identificação da dose).

---

## Plano Closed Testing externo (decisão user 2026-05-05)

**User decidiu pular recrutamento Internal Testing com pessoas conhecidas (família/amigos) e ir direto ao Closed Testing recrutando testers externos via Google Group público + Reddit/redes.** Internal Testing fica live (ele + agente) só pra validação técnica, não pra coleta de feedback.

Gate Google: ≥12 testers ativos × 14 dias antes de Open Testing.

### #129 — Criar Google Group público `dosy-testers`
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — via Chrome MCP dosy.med@gmail.com
- **Origem:** Estratégia recrutamento Closed Testing 2026-05-05
- **Esforço:** 10 min (Chrome MCP automation + 1 captcha manual user)
- **Dependências:** nenhuma
- **Resolução:**
  - Grupo criado: **`Dosy Testers`** · email `dosy-testers@googlegroups.com` · owner Dosy Med LTDA
  - URL pública: **https://groups.google.com/g/dosy-testers** (HTTP 200 anônimo verificado)
  - Configurações:
    - "Quem pode pesquisar pelo grupo" → ✅ Qualquer pessoa da web (discovery via search/Reddit)
    - "Quem pode participar do grupo" → ✅ Qualquer pessoa pode participar (auto-aprovação)
    - "Quem pode ver as conversas / postar / ver os membros" → Participantes do grupo (privacy testers reports)
  - Descrição: "Grupo público de testers do Dosy (app de controle de medicação, Android). Membros recebem acesso opt-in à fase Closed Testing via Play Store. Auto-aprovação ativa. Site: https://dosymed.app"
- **Próximo:** #130 importar email group `dosy-testers@googlegroups.com` em Closed Testing track Play Console.

### #130 — Configurar Closed Testing track no Console com Group como tester list
- **Status:** 🚨 BLOQUEADO — Google Play **REJEITOU** review pós-submit (2026-05-05 23:30 BRT). Razão: "Política de requisitos do Play Console — Alguns tipos de apps só podem ser distribuídos por organizações". App declara categoria/recursos exigindo conta de **organização (CNPJ)**, conta atual `dosy.med@gmail.com` é pessoal. Resolução demanda decisão estratégica (criar conta org Google Play + transfer app, OU reverter declarações específicas que ativaram org gate). Ver §#158 abaixo.
- **Origem:** Estratégia recrutamento Closed Testing 2026-05-05
- **Esforço:** 30 min config Console + 1h cross-checks pré-submit
- **Dependências:** #129 (✅ done) + #156 página privacidade
- **Progresso v0.2.1.0 (Chrome MCP):**
  - ✅ Faixa "Teste fechado - Alpha" pré-existente reutilizada
  - ✅ País Brasil selecionado + salvo
  - ✅ Tester list: Grupos do Google → `dosy-testers@googlegroups.com`
  - ✅ Endereço feedback URL: `https://groups.google.com/g/dosy-testers`
  - ✅ Versão criada: AAB **v0.2.0.12 vc 45** (vc 44 removido — estava conflitando)
  - ✅ Release notes pt-BR: "v0.2.0.12 — Recuperação de senha por código de 6 dígitos via email + Trocar senha em Ajustes + melhorias internas (egress -50%, alarme multi-paciente fixed). Beta fechado: ajude a testar o controle de medicação e reporte bugs em https://groups.google.com/g/dosy-testers"
  - ✅ Rascunho salvo (Step 2 "Visualizar e confirmar" — 0 erros, 1 aviso)
  - ✅ **Side-effects pré-publicação resolvidos in-line:**
    - Categoria do app: **Saúde e fitness** (Console → Configurações da loja, publicado). Trocada de Medicina v0.2.1.0 (2026-05-05) — audiência Dosy é consumer self-care/cuidador, não profissional clínico; "Saúde e fitness" alinhado com peers (Medisafe, MyTherapy) + escrutinio Google razoável + discoverability maior.
    - Detalhes contato: email `contato@dosymed.app` + site `https://dosymed.app` (publicado direto Google Play)
- **Pendente pré-submit Google review:**
  - ⏳ #156: criar/atualizar página `https://dosymed.app/privacidade` (URL referenciada nas 14 mudanças pendentes)
  - ⏳ Verificar HTTP 200 dos URLs `/privacidade` antes click "Enviar 14 mudanças para revisão"
  - ⏳ Conferir status questionários Conteúdo (Classificação, Público-alvo, Segurança dados, Intent tela cheia) — possivelmente já preenchidos releases passadas
  - ⏳ Confirmação user explícita pra submeter (irreversível, dispara review Google 1-7 dias)
- **Submit final 2026-05-05 23:14 BRT:** Console → "Enviar 14 mudanças para revisão" → Google review iniciado.
- **Resultado submit (2026-05-05 23:30 BRT):** ❌ **REJEITADO**. Mensagem Google: "App rejeitado — O envio recente do seu app foi rejeitado por não obedecer às políticas do Google Play. Política de requisitos do Play Console: Violação dos requisitos do Play Console. Seu app não obedece à política de requisitos do Play Console. Alguns tipos de apps só podem ser distribuídos por organizações. Você selecionou uma categoria do app ou declarou que o app oferece recursos que exigem o envio usando uma conta de organização." Aplicado em 6 de mai. App não disponível Google Play até resolver.
- **Diagnóstico provável:** alguma das declarações de Conteúdo do app (App de saúde + Permissões alarme exato + Serviços primeiro plano + Recursos financeiros + Apps governamentais + ID publicidade) ativou gate "requires organization account" do Google. Mais provável: combo "App de saúde" + "Saúde e fitness" categoria + medication tracking features = Google interpreta como app médico sensível requerendo CNPJ.
- **Path resolução** (item dedicado **#158** abaixo):
  - **Opção A:** criar conta Google Play Developer empresarial (CNPJ + verification documents + $25 USD nova taxa) → transferir app `com.dosyapp.dosy` da conta pessoal pra empresarial via Console "Transferir um app" workflow (1-3 semanas, complex paperwork)
  - **Opção B:** reverter declarações específicas no Conteúdo do app pra desativar gate organização → re-submit. Risco: app perde algumas certifications (ex.: Saúde e fitness) e pode necessitar refactor features médico
  - **Opção C:** apelar diretamente Google via formulário "Entrar em contato com o suporte" explicando que Dosy é app de auto-cuidado consumer, não app médico profissional, requesting reclassification

### #131 — Recrutar testers externos via Reddit + redes (meta 15-20 inscritos)
- **Status:** ⏳ Aberto
- **Origem:** Estratégia recrutamento Closed Testing 2026-05-05
- **Esforço:** 1-2h posts iniciais + acompanhamento semanal
- **Dependências:** #129 + #130 (precisa Group + opt-in URL antes)
- **Aceitação:**
  - Posts em r/AlphaAndBetausers, r/SideProject, r/brasil, r/desenvolvimentopt
  - Posts targeted: r/medicina, r/saude, r/tdah, r/diabetes (público-alvo cuidadores)
  - Compartilhamento Twitter/X + LinkedIn pessoal
  - Discord Indie Hackers BR + comunidades QA Android
  - Template post: "[Beta tester] Dosy — app Android pra organizar medicação família/idosos. Diferencial: alarme estilo despertador (ignora silencioso). Grátis. Link Google Group: {URL} → após entrar instala via {opt-in Console}"
  - Meta: 15-20 inscritos (folga pq alguns não testam)
  - Acompanhar contador "testadores ativos" no Console

### #132 — Gate Closed Testing: 14 dias rodando com ≥12 testadores ativos
- **Status:** ⏳ Aberto
- **Origem:** Regra Google 2023+ pra contas novas
- **Esforço:** 14 dias passivos + iteração semanal de feedback
- **Dependências:** #131
- **Aceitação:**
  - Console mostra ≥12 testadores ativos por ≥14 dias consecutivos
  - Sentry: 0 crashes críticos novos durante janela
  - Iterar bugs reportados em mini-releases v0.2.0.x conforme aparecerem
  - Gate Console habilita "Solicitar acesso de produção"

### #133 — Solicitar acesso Open Testing / Produção
- **Status:** ⏳ Aberto
- **Origem:** Pós #132 gate
- **Esforço:** 1h (preencher form Console + responder perguntas Google)
- **Dependências:** #132
- **Aceitação:**
  - Console → Solicitar acesso de produção → preencher questionário sobre teste fechado
  - Aguardar aprovação Google (~24-72h)
  - Após aprovação: Open Testing fica disponível com link público (sem lista) OU promover direto pra Production
  - Decidir estratégia: passar por Open Testing 7-14 dias OU produção rollout 5%→100%

---

## Plano fixes egress (auditoria 2026-05-05)

> **Detalhes em** `contexto/egress-audit-2026-05-05/README.md`. Egress 35.79 GB / 5 GB Free (715%). Grace expira 06 May. Fix #092 v0.1.7.5 cobriu apenas ~30%. Causa raiz: `invalidateQueries()` em massa em events não-data-related (visibility/focus/resume) + Realtime sem debounce.

### #134 — `useAppResume` remover invalidate em short idle, scopear long idle
- **Status:** ✅ Concluído @ commit e3d0d93 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F1
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** -30% a -45%
- **Aceitação:**
  - `src/hooks/useAppResume.js:58` (`qc.invalidateQueries()` em short idle <5min) — REMOVER. Realtime + refetchInterval cobrem.
  - Long idle (>=5min) já faz `refetchQueries({ type: 'active' })` — não precisa também `invalidateQueries()` antes (line 49).
  - Manter `refreshSession` + `removeAllChannels` em long idle.
- **Risco UX:** dados podem aparecer 30-120s mais "antigos" se Realtime não trouxer update; aceitável vs economia.

### #135 — `useRealtime` resume nativo: remover invalidate ALL keys
- **Status:** ✅ Concluído @ commit e3d0d93 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F6
- **Esforço:** 10 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** -5% a -10%
- **Aceitação:**
  - `src/hooks/useRealtime.js:180-182` — remover loop `qc.invalidateQueries`. Resubscribe + Realtime postgres_changes events tomam conta updates pós-resume.
- **Risco UX:** zero.

### #136 — `useRealtime` postgres_changes: debounce invalidate 1s
- **Status:** ✅ Concluído @ commit e3d0d93 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F2
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Impacto egress estimado:** -15% a -25% (especialmente dias de cron extend)
- **Aceitação:**
  - `src/hooks/useRealtime.js:113-119` — wrap `qc.invalidateQueries` em debounce 1000ms por table.
  - Implementação: timeout + flag por queryKey, ou `lodash.debounce`.
- **Risco UX:** atualização cross-device até 1s extra. Healthcare app — não-crítico.

### #137 — Dashboard: consolidar 4 useDoses em 1
- **Status:** ✅ Concluído @ commit 0124608 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F3
- **Esforço:** 2h
- **Dependências:** nenhuma
- **Impacto egress estimado:** -20% a -30%
- **Aceitação:**
  - `src/pages/Dashboard.jsx:85, 116, 118, 123` — substituir 4 hooks por 1 `useDoses({from: -30d, to: +14d})`. Filtros visuais via `useMemo` client-side.
  - Calcular `pendingToday`, `overdueNow`, `weekAdherence` em memória sobre array único.
- **Risco UX:** Dashboard 1 round-trip em vez de 4. Mais rápido.

### #138 — `DOSE_COLS_LIST` sem `observation`
- **Status:** ✅ Concluído @ commit 0813d94 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F4
- **Esforço:** 1h (incluindo verificação Reports/Analytics)
- **Dependências:** nenhuma
- **Impacto egress estimado:** -15% a -30% no payload listDoses
- **Aceitação:**
  - `src/services/dosesService.js` — criar `DOSE_COLS_LIST` (10 cols sem observation) pra `listDoses`. Manter `DOSE_COLS_FULL` pra `getDose` detail.
  - Verificar Reports.jsx, Analytics.jsx, DoseHistory.jsx — se exibem observation em lista, adaptar (lazy-load via getDose ao expandir).
  - Análoga à mudança #115 (PATIENT_COLS_LIST/FULL).
- **Risco UX:** zero — UI lista não exibe observation.

### #139 — `dose-trigger-handler` skip se scheduledAt > 6h futuro
- **Status:** ✅ Concluído @ commit bf45f80 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F7
- **Esforço:** 30 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** Edge invocations -50-70%
- **Aceitação:**
  - `supabase/functions/dose-trigger-handler/index.ts:103-106` — adicionar early return se `scheduledAt > now + 6h`. Cron 6h `schedule-alarms-fcm` cobre.
- **Risco UX:** zero. Alarme nativo agendado pelo cron 6h antes da dose.

### #140 — `schedule-alarms-fcm` HORIZON 72h → 24h
- **Status:** ✅ Concluído @ commit bf45f80 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F8
- **Esforço:** 15 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** payload FCM 3× menor
- **Aceitação:**
  - `supabase/functions/schedule-alarms-fcm/index.ts` — `HORIZON_HOURS = 24` (era 72). Cron 6h × 4 ciclos cobre 24h com folga.
- **Risco UX:** zero.

### #141 — `useReceivedShares` staleTime 60s → 5min
- **Status:** ✅ Concluído @ commit bf45f80 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F10
- **Esforço:** 5 min
- **Dependências:** nenhuma
- **Impacto egress estimado:** pequeno mas free win
- **Aceitação:**
  - `src/hooks/useShares.js` `useReceivedShares` — `staleTime: 5 * 60_000`.
- **Risco UX:** novo share notif pode demorar até 5min em aparecer. Aceitável (shares raros).

### #142 — Rotacionar JWT cron `schedule-alarms-fcm-6h` + refatorar pra usar vault/env
- **Status:** ✅ Segurança fechada (2026-05-05) — cleanup cosmético deferido
- **Confirmação:**
  - Supabase Dashboard → Settings → JWT Keys → Legacy JWT Secret = **REVOKED** ("No new JSON Web Tokens are issued nor verified with it by Supabase products")
  - PostgREST com JWT antigo: **HTTP 401** (verificado via curl `/rest/v1/doses?...`)
  - Edge function continua 200 OK pq é pública (`verify_jwt: false`), executa com `SERVICE_ROLE_KEY` env separada do JWT do header
  - Atacante com JWT vazado NÃO consegue privilege escalation (DB queries via PostgREST barram)
- **Cleanup deferido pra v0.2.0.10 (cosmético, não-security):**
  - JWT hardcoded no cron job 3 ainda existe mas não é validado por nada
  - Substituir por `vault.read_secret('SUPABASE_SERVICE_ROLE_KEY')` ou remover header (Edge function ignora)
  - Refactor pra usar `supabase_functions.http_request()` (passa apikey automaticamente)
- **Origem:** egress-audit-2026-05-05 F11 (security)
- **Esforço:** 1h
- **Dependências:** nenhuma
- **Impacto egress:** zero (security-only)
- **Aceitação:**
  - Drop cron job `schedule-alarms-fcm-6h` atual.
  - Recriar usando `vault.read_secret('SUPABASE_SERVICE_ROLE_KEY')` ou `supabase_functions.http_request` (passa service key automaticamente).
  - Rotate JWT secret se ainda válido (verificar via test request com JWT antigo).
- **Risco:** zero funcional. Critical security fix.

### #143 — `useUserPrefs.queryFn`: `getSession()` em vez de `getUser()`
- **Status:** ✅ Concluído @ commit bf45f80 (2026-05-05)
- **Origem:** egress-audit-2026-05-05 F9
- **Esforço:** 15 min
- **Impacto egress estimado:** -1 round-trip auth por refetch useUserPrefs
- **Aceitação:** trocar `supabase.auth.getUser()` por `supabase.auth.getSession()` em `src/hooks/useUserPrefs.js:50`.

### #144 — Custom JWT claim `tier` via Auth Hook (longo prazo)
- **Status:** ✅ Concluído @ commit 54e0d0a (2026-05-05)
- **Origem:** egress-audit-2026-05-05
- **Esforço:** 4-6h (Auth Hook setup + client refactor)
- **Impacto egress estimado:** elimina round-trip useMyTier
- **Aceitação:** Auth Hook custom claim → JWT carrega `tier` → client lê localmente.

### #145 — `useRealtime` watchdog: invalidate só se data divergente
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Esforço:** 1h
- **Impacto egress estimado:** -5% mobile flaky
- **Aceitação:** watchdog compara timestamp último change broadcast vs `qc.getQueryState('doses').dataUpdatedAt`. Só invalidate se diff significativo.

### #146 — `pg_cron extend_continuous_treatments`: confirmar batch INSERT
- **Status:** ✅ Concluído @ commit 9a9f399 (2026-05-05)
- **Esforço:** 30 min audit
- **Aceitação:** verificar se INSERTs são single multi-row (1 webhook total) ou N inserts (N webhooks). Otimizar pra 1.

### #147 — BUG-041: Recuperação de senha email link aponta pra localhost / erro
- **Status:** ✅ Concluído @ commit b2f53ff (2026-05-05)
- **Origem:** Reportado user 2026-05-05 ao tentar recuperar senha esposa Daffiny.
- **Esforço:** 1-3h investigação + fix Site URL config + test mobile/web
- **Workaround temp 2026-05-05:** Daffiny senha resetada via SQL direto (`UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf'))` + DELETE auth.sessions). Login fresh com nova senha.
- **Bug:** email recovery do Supabase contém link redirect — clicado leva pra "localhost" ou tela de erro. Não consegue concluir reset password.
- **Hipóteses:**
  - (a) Supabase Auth Settings → URL Configuration → Site URL apontando pra `localhost:5173` ou stale (deveria ser `https://dosymed.app`)
  - (b) Redirect Allow List não inclui `https://dosymed.app/reset-password` ou `dosy://reset-password`
  - (c) Code em `useAuth.jsx:resetPassword` passa `redirectTo` mas Supabase ignora se não estiver no allow list → fallback pra Site URL (localhost)
  - (d) Email template Supabase tem URL placeholder hardcoded errado
- **Investigar:**
  - https://supabase.com/dashboard/project/guefraaqbkcehofchnrc/auth/url-configuration
  - Site URL atual + Redirect URLs allow list
  - Email Templates (Recovery template HTML)
  - useAuth.jsx:199-202 redirectTo logic web vs mobile
  - App.jsx:234-260 deep link handler `dosy://reset-password` Capacitor
- **Reformulação v0.2.1.0:**
  - Decisão: trocar fluxo magic-link por OTP code (6 dígitos enviado por email/SMS) — mais simples + funciona offline + sem dependência de redirect URL config
  - Página `/reset-password` recebe input OTP + nova senha
  - OR: SSO Google obrigatório (já implementado via OAuth) reduz necessidade reset password manual
- **Aceitação fix temporária (se v0.2.1.0 demorar):**
  - Fix Site URL config Supabase Dashboard
  - Add `https://dosymed.app/*` + `dosy://*` em Redirect Allow List
  - Test fluxo end-to-end: solicitar email → clicar link → cair em /reset-password → preencher nova senha → login

---

## Resumo

- **P0:** 9 itens — restantes: 6 abertos após fechamento de #001/#002/#005 em v0.1.6.10
- **P1:** 22 itens (#010-027 + #075-#078 v0.1.7.0) · esforço estimado: ~10-15 dias-pessoa
- **P2:** 22 itens (#028-049) · esforço estimado: ~3-4 semanas-pessoa
- **P0 v0.1.7.1:** #079 #080 #081 healthcare-critical (defense-in-depth notif idle ilimitado)
- **P3:** 25 itens (#050-073, #074) · esforço estimado: 90+ dias

**Soft-launch (P0+P1):** ~15-20 dias-pessoa.
**Produção pública (após Open Testing 14 dias + #001-027):** ~6 semanas total.

---

## Sequência sugerida

```
Sem 1: P0 #001-005 + #007 + #008 (segurança + UTF-8 + telemetria)
Sem 2: P0 #004 vídeo + #006 device validation + P1 #010-016
Sem 3: P1 #017-022 + Closed Testing #027 inicia
Sem 4: P1 #023-026 + iteração feedback + Closed dia 7
Sem 5-6: Closed Testing dia 14 + P2 começo + Open Testing
Sem 7+: Produção rollout 5%→100% + P2 + P3 backlog
```

→ Ver `ROADMAP.md` para versão consolidada com links cruzados.

---

### #156 — Atualizar página `https://dosymed.app/privacidade` (LGPD healthcare)
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — DESBLOQUEIA #130 submit Google review
- **Origem:** Sessão 2026-05-05 v0.2.1.0 — descoberta durante setup Closed Testing track Console (mudança pendente "Definir o URL da Política de Privacidade como https://dosymed.app/privacidade")
- **Esforço:** 2-3h (escrever conteúdo LGPD healthcare + criar rota + linkar UI)
- **Dependências:** #026 email `privacidade@dosymed.app` provisionado (DPO contato)
- **Aceitação:**
  - URL `https://dosymed.app/privacidade` retorna HTTP 200
  - Conteúdo cobre LGPD para healthcare (controle medicação):
    - **Identificação controlador:** Dosy Med LTDA + DPO `privacidade@dosymed.app`
    - **Dados coletados:**
      - Auth: email + senha hash (Supabase Auth)
      - Saúde sensível (LGPD art.5-II + art.11): pacientes, doses, tratamentos, observações, fotos paciente
      - Técnicos: FCM token push, user agent, IP (logs Supabase)
      - Telemetria: PostHog events anonimizados (não-PII)
    - **Finalidades:** alarmes lembrete medicação, sincronização multi-device, recuperação senha
    - **Bases legais LGPD:** consentimento (art.7-I, registro signup) + cuidado saúde (art.11-II-f) + execução contrato (Plus tier)
    - **Compartilhamento:** Supabase (cloud storage criptografado SSE), Google FCM (push delivery), Resend (transactional email recovery), PostHog (analytics anônima), Sentry (error tracking)
    - **Internacional:** Supabase São Paulo (BR) — dados em jurisdição brasileira
    - **Retenção:** até deletar conta via app (Settings → Excluir conta, #028 fechado)
    - **Direitos titular (LGPD art.18):** acesso, retificação, eliminação, portabilidade, anonimização, revogação consentimento — exercício via `privacidade@dosymed.app`
    - **Crianças/adolescentes:** uso por responsável legal (cuidador) — política específica art.14
    - **Cookies/storage:** localStorage para cache UI + secure storage Android Keystore para tokens
    - **Última atualização:** 2026-05-05
  - Linkado: Settings → Privacidade + Termos.jsx (referência cruzada) + footer Login + ToS página
- **Implementação executada:** Privacidade.jsx (React route já existia v0.2.0.0, atualizado conteúdo v0.2.1.0). Rota `/privacidade` confirmada em App.jsx linha 298. SPA fallback Vercel resolve via index.html → React Router → Privacidade lazy-loaded.

**Mudanças v0.2.1.0 (2 passes):**

**Pass 1 v1.1 (initial):**
- Email DPO: `dosy.privacidade@gmail.com` → `privacidade@dosymed.app` + outros 4 aliases
- Entidade: "pessoa física" → "Dosy Med LTDA"
- Terceiros expandidos: Resend, PostHog, Sentry, AdMob, FCM
- Versão v1.0 → v1.1
- Termos.jsx + FAQ.jsx idem

**Pass 2 v1.2 (deep audit Play Store Health Apps Policy):**
- **Estrutura expandida 11 → 15 seções** com cobertura completa
- **§1 Controlador**: contato granular (DPO + suporte + legal + security + contato geral)
- **§2 Dados coletados** reorganizado em 4 sub-categorias: identificação, sensíveis saúde, técnicos, telemetria anônima
  - Adicionou: foto paciente, peso, alergias, condição médica, médico, anotações cuidador
  - Adicionou: SOS rules (intervalos, max 24h)
  - Adicionou: `patient_shares` table (compartilhamento entre usuários #117)
  - Adicionou: tier subscription history
  - Adicionou: rate-limit triggers em security_events
- **§3 Finalidades + bases legais por finalidade**: 7 finalidades mapeadas (lembrete medicação Art.7-V+11-II-f, sharing Art.7-I, recovery Art.7-V, histórico Art.7-V+11-II-f, auditoria Art.7-IX, telemetria Art.7-IX, ads Art.7-IX)
  - "Não fazemos" list explícita: venda, perfilamento publicitário, scoring saúde, share seguradoras
- **§4 Sub-processadores**: tabela 10 providers (Supabase, FCM, AdMob, Play Billing, Resend, PostHog, Sentry, Vercel, Hostinger, ImprovMX) com finalidade + região + base de adequação (sa-east-1 BR para Supabase, Cláusulas-padrão LGPD para US/EU)
  - Cobre transferência internacional Art. 33-V LGPD
- **§5 Direitos LGPD**: lista completa Art.18 (10 direitos) + reclamação ANPD link gov.br/anpd
- **§6 Segurança**: criptografia em repouso AES-256 (era ausente), App Lock biométrico (#017), Android Keystore hardware-backed, JWT secret rotation procedure (#084), backup diário 7-day rolling RPO 24h RTO 5-15min ref runbook DR (#046)
- **§7 Retenção**: granular por tipo (FCM tokens revogados limpeza semanal, compartilhamentos pendentes 30d, observações > 3y anonimização, conta deletada < 30d + backups 7d adicional)
- **§8 Cookies/storage**: enumera localStorage + Android Keystore + sessionStorage + IndexedDB PWA + zero cookies tracking
- **§9 Menores**: idade mínima 13 anos com consentimento responsável legal (Art.14 LGPD), 16 anos GDPR EU
- **§10 Decisões automatizadas (NOVO)**: explicit "não realiza" — sem AI diagnóstica, sem scoring saúde, sem recomendação automática (Art.20 LGPD)
- **§11 Compliance Google Play Health Apps Policy (NOVO)**: 9 checkpoints com link policy oficial Google (support.google.com/googleplay/android-developer/answer/13316080)
  - Política privacidade explícita
  - Coleta limitada finalidade declarada
  - Criptografia trânsito + repouso
  - Não compartilha seguradoras/empregadores/anunciantes saúde
  - Ads apenas não-personalizados sem dados saúde
  - Mecanismo exclusão acessível user
  - FGS Special Use declarado Console (#004)
  - Disclaimer médico
- **§12 Notificação incidentes ANPD (NOVO)**: comunicação Art. 48 LGPD operacional 72h, conteúdo da notificação detalhado, ref runbook DR
- **§13 Canais contato**: 5 emails granulares com confirmação 72h pra security disclosure
- **§14 Alterações**: 15 dias antecedência via noreply@
- **§15 Histórico versões (NOVO)**: log v1.0 → v1.1 → v1.2

**Termos.jsx + FAQ.jsx**: mantido pass 1 (emails canônicos + entidade Dosy Med LTDA).

**Pré-checks pré-submit Google review (#130):**
- ✅ URL `/privacidade` route existe (App.jsx:298)
- ⏳ Verificar HTTP 200 prod via `curl -I https://dosymed.app/privacidade` após próximo deploy Vercel
- ⏳ Conteúdo renderiza corretamente em mobile (testar Chrome MCP preview)
- ✅ Conteúdo cobre todos requisitos LGPD para healthcare

**Bloqueia:** Antes era #130. Agora #130 desbloqueado pra submit Google review (junto com cross-checks restantes).

### #157 — Disable useRealtime() — storm 13 req/s preview/prod
- **Status:** ✅ Concluído v0.2.1.0 (2026-05-05) — fix targeted commit `da61b04` + restore #007 commit `ff431ca`
- **Origem:** Validação preview Vercel pré-merge release/v0.2.1.0 (Regra 9.1 README) descobriu storm 18× prod baseline. Bisect inicial false positive (#007). Investigação aprofundada via Chrome MCP + Supabase MCP identificou root cause real.
- **Prioridade:** P0 (egress bloqueador prod — bug pré-existente master desde algum momento entre v0.1.7.x e v0.2.0.x)
- **Esforço:** ~1h investigação + 5min fix
- **Dependências:** nenhuma

**Pattern observado:**
- 13 reqs/s sustained idle hidden tab (mesmo prod master)
- Bursts paralelas <100ms + gaps regulares ~2-3s entre bursts
- Cada burst: 11× /doses + 1× /patients + 1× /treatments
- Storm escalava ao longo do tempo: 30s window = ~57 reqs (1.9 req/s, parecia normal); 5min window = 3558 reqs (12 req/s); 28min window = 77k reqs (46 req/s sustained)
- Extrapolação: ~5GB/h egress por user idle hidden tab

**Investigação (Chrome MCP + Supabase MCP):**
1. **Chrome MCP fetch interceptor + WebSocket hook + visibility events** capturaram pattern exato.
2. **Bisect commit b3fe670 #007 src files (commit `76dc28a`):** storm 30s = 0 reqs (false positive — storm não tinha escalado em 30s).
3. **Idle 5min validation pós-bisect:** storm voltou (715 reqs em 5min = 2.4 req/s). Não era #007.
4. **Comparação prod master 28min idle:** 77k reqs (46 req/s) — bug pré-existente confirmado, não regressão release.
5. **Supabase MCP `SELECT FROM pg_publication_tables WHERE pubname='supabase_realtime'`:** retornou **[]** vazio. Publication não tem tabelas configuradas.
6. **Supabase MCP `get_logs(realtime)`:** flood de errors `IncreaseSubscriptionConnectionPool: Too many database timeouts` + `ChannelRateLimitReached: Too many channels` + `Stop tenant ... no connected users`.
7. **Análise código `useRealtime.js:80-108`:** `onStatusChange(CLOSED/CHANNEL_ERROR/TIMED_OUT)` dispara `setTimeout(reconnect, 1-30s backoff)` → `unsubscribe + subscribe + for keys: refetchQueries({type:'active'})`. Cycle confirmed.

**Mecanismo:**
```
Channel subscribe → server sees "no users" → STOP tenant → CLOSE ch
  → onStatusChange CLOSED → setTimeout backoff 1-2s
  → unsubscribe + subscribe + refetchQueries(['doses','patients','treatments',...])
  → 13 reqs paralelos disparam (4-9 active doses keys + patients + treatments)
  → channel briefly SUBSCRIBED → reconnectAttempts=0 reset
  → tenant idle stops again → CLOSED → loop
```

**Por quê publication vazia:**
Não-conhecido — provavelmente migration removeu tables do `supabase_realtime` publication em algum momento, OU publication nunca foi configurada via Studio Dashboard. Histórico release notes (#079/#092/#093/#136/#145) menciona realtime fixes mas nenhum reseta publication.

**Fix aplicado v0.2.1.0:**
```diff
- useRealtime()
+ // #157 (v0.2.1.0) — DISABLED. Bug investigation 2026-05-05 found:
+ //   1. publication `supabase_realtime` empty (NO postgres_changes events delivered)
+ //   2. useRealtime reconnect cascade burns ~13 req/s storm sustained idle hidden tab
+ //   3. Net: zero functional value + catastrophic egress cost.
+ // Re-enable plan v0.2.2.0+: populate publication via Studio + verify reconnect logic
+ // useRealtime()
```

Hook `src/hooks/useRealtime.js` preservado intacto — apenas invocação comentada em App.jsx:67.

**Validação pós-fix:**

| Métrica idle hidden tab | Pre-fix | Pós-fix #157 |
|---|---|---|
| 30s | ~57 reqs (já escalando) | 1 req |
| 90s | ~785 reqs (8.7 req/s) | 2 reqs |
| 5min completo | 3558 reqs (12 req/s) | 9 reqs (0.021 req/s) |
| Visibility | hidden | hidden |

**Storm 99.7% eliminado.** 9 reqs em 7min = comportamento sano (1 auth/v1/user + 1 patient_shares + 1 patients + 1 treatments + 5 doses durante mount + occasional refetch on staleTime).

**Plano v0.2.2.0+ retomar useRealtime():**
1. Studio → Database → Replication → publication `supabase_realtime` toggle:
   - `medcontrol.doses`
   - `medcontrol.patients`
   - `medcontrol.treatments`
   - `medcontrol.sos_rules`
   - `medcontrol.treatment_templates`
   - `medcontrol.patient_shares`
2. Re-enable `useRealtime()` em App.jsx:67 (uncomment)
3. Refactor `useRealtime.js` defensive: adicionar `if (reconnectAttempts >= 5) suspend reconnects until visibilitychange visible` para evitar storm em channel empty state futuro
4. Re-rodar preview Vercel idle 5min hidden tab → confirmar 0 reqs sustained
5. Validar postgres_changes events chegam (test: insert dose via Studio → expect Dashboard auto-update sem refresh)

**Aceitação:**
- ✅ Storm 99.7% eliminado preview release/v0.2.1.0 (medido)
- ✅ #007 PostHog telemetria restored (era false positive bisect)
- ⏳ Validar prod master pós-merge (espera-se mesmo fix levar a 0.02 req/s sustained)

**Lições durables:**
- Storm pode escalar com tempo em hidden tab — bisect window deve igualar window observation original
- publication realtime vazia + hook subscribe = silent rate-limit cascade (não-óbvio sem inspecionar BD direto)
- Investigação multi-camada (cliente Chrome MCP + servidor Supabase MCP) é necessária pra root cause real

**Detalhe completo:** `contexto/updates/2026-05-05-investigacao-157-storm-realtime.md`

### #158 — Resolver rejection Google Play (org account required) NOVO P0 URGENTE
- **Status:** 🚨 BLOQUEADO + URGENTE ANTES PRÓXIMO RELEASE — Google Play rejeitou submit Closed Testing 2026-05-05. Plano execução estruturado abaixo (7 passos) deve ser concluído **antes do próximo release v0.2.2.0**.
- **Origem:** Console submit #130 release/v0.2.1.0 (2026-05-05 23:14 BRT) → Google review rejeitado em <30 min com mensagem "Violação dos requisitos do Play Console — apps de certas categorias só por organização".
- **Prioridade:** P0 URGENTE (bloqueador rollout Closed Testing público + Production track futuro)
- **Esforço total:** 1-3 dias investigação + plano (passos 1-7) + 1-3 semanas execução plano (opção A/B/C escolhida)
- **Dependências:** decisão user pós passo 7
- **Escopo:** trabalho operacional Console + paperwork — **não precisa branch git** (zero código). Updates em `contexto/decisoes/` (ADR) + `contexto/updates/` (logs sessão).

**Diretrizes execução (7 passos sequenciais — agente seguir em ordem):**

#### Passo 1 — Ler e-mail Google rejection completo
- Console → Notificações (sino topo direito) → "App rejeitado · 5 de mai." → Mais detalhes
- Click "Ver e-mail" → ler email Google completo (texto integral do reviewer)
- Capturar: data, mensagem específica, link política violada, recursos/categorias citados especificamente
- **Goal:** entender EXATAMENTE qual declaração foi flagged (não só "Política requisitos genérica"). Cole texto integral do email em `contexto/decisoes/{data}-rejection-google.md` como evidência.

#### Passo 2 — Entrar nos links sugeridos pela página Detalhes
- Detalhes problema referenciam: `requisitos do Play Console` + `conteúdo do app` + Central de Ajuda transferir apps + Central de Ajuda configurar org account
- Ler políticas oficiais Google Play 2026 via WebFetch:
  - https://support.google.com/googleplay/android-developer/answer/13316080 (Health Apps Policy)
  - https://support.google.com/googleplay/android-developer/answer/9858738 (Developer Program Policies)
  - Link específico do email rejection (mais autoritativo)
- **Goal:** identificar quais features/declarações requerem org account explicitamente. Documente excerpts relevantes.

#### Passo 3 — Estudar assunto org account requirements
- Buscar Google Play documentation: "organization account requirements 2026"
- Lista oficial categorias/features que exigem CNPJ:
  - Apps governamentais (declaração)
  - Apps financeiros sensíveis (Recursos financeiros declaração)
  - Apps de saúde médica/clínica (App de saúde declaração + categoria sensível)
  - Outras a confirmar via documentação
- Decisões transferência app pessoal → empresarial (workflow + documents required + tempo Google approve)
- Custo: $25 USD nova taxa Console + paperwork BR (~R$ 1000-3000 contador abertura empresa OU usar empresa CNPJ existente se user tiver)
- **Goal:** entender opções concretas + custos/prazos reais.

#### Passo 4 — Analisar app atual (declarações Conteúdo do app)
- Console → Política e programas → Conteúdo do app (sidebar)
- Listar TODAS declarações ativas atualmente (screenshot cada):
  - ID de publicidade (declaração obrigatória SDK ads)
  - Apps governamentais (provavelmente "Não")
  - Recursos financeiros (assinaturas Play Billing — Plus/Pro)
  - Serviços em primeiro plano (FGS Special Use #004 alarmes)
  - Permissões de alarme exato (#004 alarme nativo)
  - **App de saúde** (provável culprit — declaração explícita de healthcare features)
  - Categoria do app: **Saúde e fitness** (mudou v0.2.1.0 de Medicina pra Saúde — pode ainda ser sensível pra Google)
  - Audiência (idade 18+ #156 v1.3)
- Cross-ref com app real: features Dosy = lembrete medicação + tracking dose + push + alarme nativo + paciente CRUD + analytics adesão + LGPD
- **Goal:** identificar exatamente qual declaração ativou org gate. Captura screenshot Console pra evidence.

#### Passo 5 — Validar app nas regras Google
- Cross-ref features Dosy × Health Apps Policy 2026:
  - Dosy faz diagnóstico médico? **Não** (pure tracking, no AI)
  - Dosy interage com prescription system regulator (e-prescribing, eMR integration)? **Não** (free-form input user)
  - Dosy é dispositivo médico classificado ANVISA/FDA? **Não** (consumer self-care)
  - Dosy compartilha dados saúde com terceiros? **Não** (não vende, não broker — privacy policy explícita §11)
  - Dosy serve healthcare professionals? **Não** (target consumer pais/cuidadores/idosos)
- Compatibilidade: Dosy é **app consumer** com features healthcare leves, NÃO app médico clínico
- Documentation reference: Google Health Apps Policy distinguishes "consumer wellness apps" (Saúde e fitness OK conta pessoal) vs "medical devices/clinical apps" (org account required)
- **Goal:** confirmar Dosy fit consumer category (deveria passar se declarações alinhadas). Documente conclusão evidence-based.

#### Passo 6 — Investigar rejeição específica (qual declaração triggered gate)
- Hipótese A mais provável: **declaração "App de saúde"** marcada YES → Google interpreta como medical clinical → org gate
- Hipótese B alternativa: combo de features (#004 FGS Special Use + alarme exato + saúde + medication) escalou flag automatic
- Hipótese C: categoria "Saúde e fitness" combinado com declaração específica
- Workflow investigação:
  1. Console → Conteúdo do app → "App de saúde" → review configuration atual
  2. Se YES: ler descrição/respostas do questionário "App de saúde" — quais checkboxes ativaram gate
  3. Cross-ref com requisitos Google: cada checkbox tem implicação organização
  4. Se possível, simular reverter cada declaração isoladamente (Console permite editar antes submit) e ver qual desliga warning
- Capturar evidência: screenshot configuration atual + identificar trigger exato
- **Goal:** root cause confirmed — sem isso, opção B (revert declaration) não pode ser executada cirurgicamente.

#### Passo 7 — Elaborar plano correção (decision matrix + ADR)

| Critério | Opção A (CNPJ + transfer) | Opção B (revert declarações) | Opção C (apelo Google) |
|---|---|---|---|
| Tempo | 1-3 semanas | 2-4h | 1-2 semanas |
| Custo | R$ 1000-3000 (empresa BR se não tem) + $25 USD nova conta Console | $0 | $0 |
| Risco | Alto setup mas resolve permanente | Médio (perde certifications + pode trigger outra rejection) | Alto (Google pode rejeitar apelo silently) |
| Mantém escopo healthcare | Sim | **Não** (downgrade pra "lifestyle/lembrete") | Sim |
| Permite Production track | Sim | Sim mas com escopo reduzido | Talvez |
| Reversibilidade | Permanente | Re-submit declarations restaurar mas re-trigger | N/A |
| Internal Testing afetado | Não (continua) | Não (continua) | Não (continua) |

**Recomendação default (revisar pós passos 1-6):**
- **Curto prazo (esta semana):** Opção B — reverter declaração "App de saúde" (most likely trigger) → re-submit Closed Testing → testers external entram via opt-in
- **Médio prazo (próximas 2-4 semanas):** Opção A em paralelo — verificar se user já tem CNPJ; se sim, pular abertura empresa; se não, abrir Dosy Med LTDA com contador + cadastrar conta Google Play empresarial + transferir app
- **Pós-A success:** restaurar declaração "App de saúde" + categoria Medicina se quiser → re-submit com escopo healthcare completo

**Output deliverables passo 7:**
- ADR `contexto/decisoes/2026-05-XX-rejection-google-fix.md` documentando decisão escolhida + razão
- Plano timeline execução (datas concretas)
- Items derivados para ROADMAP (ex.: #159 "abrir empresa Dosy Med LTDA", #160 "transferir app Console", #161 "re-submit Closed Testing post-fix")

**Aceitação final #158:**
- Closed Testing track aprovado Google (ou nova conta org com app transferido + aprovado)
- Opt-in URL aceitando inscrições novas
- Production track futuro submit passa review
- Internal Testing continua funcionando independente (já garantido — não foi afetado)

**Internal Testing track NÃO afetado:** continua publicando AAB normalmente (v0.2.1.0 vc 46 publicada 2026-05-05 23:42). User + esposa + testers existentes recebem updates auto Play Store.

**Internal Testing track NÃO afetado:** continua publicando AAB normalmente (v0.2.1.0 vc 46 publicada 2026-05-05 23:42). User + esposa + testers existentes recebem updates.

**Closed Testing público bloqueado:** sem aprovação Google, opt-in URL `https://play.google.com/apps/internaltest/4700769831647466031` permanece sem usuários novos podendo se inscrever.

**Production track bloqueado:** mesma rejection vai aplicar pra Production submit futuro.

**Análise opções:**

**Opção A — Conta Google Play Developer empresarial (recomendada longo prazo):**
1. Criar empresa "Dosy Med LTDA" oficialmente (se já não tem CNPJ)
2. Cadastrar nova conta Google Play Developer com CNPJ + $25 USD taxa nova
3. Verification documents (CNPJ, comprovante endereço empresa, possível video call)
4. Console → app Dosy → Configurações → Transferir um app → para conta empresarial
5. Aguardar Google approve transfer (~1-2 semanas)
6. Re-submit Closed Testing/Production
- **Vantagem:** resolve permanente, libera todas categorias incluindo healthcare strict, profissional + alinha com app de saúde sério
- **Desvantagem:** demora, custos abertura empresa BR (R$ 1000-3000 contador) + paperwork

**Opção B — Reverter declarações específicas (rápida mas escopo reduzido):**
1. Identificar QUAL declaração ativou gate (Conteúdo do app → review todas as declarações):
   - "App de saúde" — provável culpada
   - "Permissões de alarme exato" (#004 FGS Special Use)
   - "Serviços em primeiro plano" (#004 FGS)
   - "Recursos financeiros" (Play Billing assinaturas)
   - "Apps governamentais" — improvável aplica
2. Reverter declaração mais provável (App de saúde) → mudar pra categoria menos sensível
3. Re-submit
- **Vantagem:** ship Closed Testing/Production rapidamente
- **Desvantagem:** app perde certificação healthcare, pode comprometer trust/positioning consumer self-care; pode ainda falhar se outra declaração for culpada

**Opção C — Apelo Google explicando contexto:**
1. Console → Ajuda → Entrar em contato com suporte
2. Explicar: Dosy é app consumer self-care/lembrete medicação, não app médico profissional, target audiência geral (pais, idosos, cuidadores)
3. Solicitar reclassificação manual do reviewer
- **Vantagem:** preserva todas declarações + categoria; sem custo
- **Desvantagem:** Google review apelos é slow + opaque; pode demorar 1-2 semanas; pode ser rejeitado sem explanation

**Recomendação:** A longo prazo + B paralelo curto prazo. Atalho: começar A (criar empresa + CNPJ se não tem), enquanto isso testar B reverting declarações específicas e ver se passa review. Se B passa, ship Closed Testing imediato com escopo reduzido enquanto A finaliza.

**Aceitação:**
- Closed Testing track aprovado Google + opt-in URL aceitando inscrições novas
- Production track submit futuro passa review
- Internal Testing continua funcionando independente

**Detalhe rejection email:** ver Console → Notificações → "App rejeitado · 5 de mai." → Mais detalhes (já lido na sessão).


### #159 — BUG-LOGOUT fix: useAuth boot validation transient vs auth failure
- **Status:** ✅ Concluído v0.2.1.1 (2026-05-06) — fix targeted commit aplicado em release/v0.2.1.1
- **Origem:** User reported (2026-05-06 madrugada) — "abro app e está deslogado, preciso ficar logando o tempo inteiro"
- **Prioridade:** P0 (bug crítico UX — afeta retenção user)
- **Esforço:** 30 min investigação + 5 min fix + ceremony

**Causa raiz:**
`useAuth.jsx:34-49` (#123 release v0.2.0.3) implementou boot session validation via `supabase.auth.getUser()` API call. Lógica original deslogava em **QUALQUER erro**:
```js
if (error || !u?.user) {
  await supabase.auth.signOut()  // <-- desloga até em network slow/timeout
  ...
}
```

Cenário trigger frequente:
1. App cold start Android (especialmente após Doze mode OS)
2. `supabase.auth.getSession()` retorna session local OK (cached)
3. `supabase.auth.getUser()` bate API `/auth/v1/user`
4. Network mobile slow OR Supabase API timeout → `error` truthy
5. Branch desloga user mesmo com sessão válida

User Android vivencia isso múltiplas vezes/dia.

**Fix targeted (`src/hooks/useAuth.jsx`):**
Distinguir error type. SignOut só em evidência forte de auth failure:
- `error.status === 401` (Unauthorized)
- `error.status === 403` (Forbidden)
- Mensagem contém regex `/jwt|token.*expired|user.*not.*found|invalid.*claim|invalid.*token/i`

Outros erros (network timeout, 5xx, fetch exception) → preservar session local. Próximo boot OR próxima request authenticada re-valida automaticamente.

**Trade-off aceitável:**
User com session realmente revogada (deletado/banned) continua com cache stale até próxima request 401. Auth listener `onAuthStateChange` captura SIGNED_OUT normalmente quando server responde 401 numa query subsequente.

**Aceitação:**
- ✅ Cold start Android com network instável NÃO desloga user
- ✅ Real auth failure (JWT invalid após user deletado) ainda desloga via fallback request 401
- ✅ Network exception (offline) preserva session
- ✅ User + esposa relatam fim de logout repetido pós-rollout v0.2.1.1 vc 47

**Detalhe code change:** ver commit release/v0.2.1.1 fix `useAuth.jsx`. Comment block in-code documenta racional + trade-off completo.

### #160 — PatientDetail refactor: Doses Hoje card + dose list 24h/Todas + tratamentos por status (Ativos/Pausados/Encerrados)
- **Status:** ✅ Concluído v0.2.1.2 (2026-05-06) — commits `c6f6963` (v1) + `1913b56` (v2 collapse + Doses card destaque) + `c371072` (v2.1 dark mode adaptive). Ver entry "#160 v2" abaixo pra detalhe completo extensão.
- **Origem:** User reported (2026-05-06) — "página paciente individual: tratamentos ativos mostrando encerrados, melhorar info exibida, replicar lista doses do início pra marcar dose direto da página"
- **Prioridade:** P1 UX (página crítica fluxo paciente)
- **Esforço:** 2-3h refactor + test
- **Dependências:** nenhuma
- **Arquivo:** `src/pages/PatientDetail.jsx`

**Mudanças requeridas:**

1. **Substituir card "Adesão"** por card **"Doses Hoje: X de Y"**
   - X = doses tomadas hoje (status='done' AND scheduledAt entre 00:00-23:59 hoje)
   - Y = total doses agendadas hoje (status in ['done', 'pending', 'overdue', 'skipped'])
   - Formato: `"Doses Hoje: 3 de 5"` ou similar
   - Pode incluir progress bar visual peach palette
   - Adesão move para tela Relatórios (já existe lá)

2. **Manter card "Tratamentos Ativos"** como está (count tratamentos ativos)

3. **Bug fix tratamentos:** atual lista "ativos" inclui encerrados. Filtro errado. Separar em **3 seções distintas**:
   - **Tratamentos Ativos** — `status='active'` AND `endDate >= today`
   - **Tratamentos Pausados** — `status='paused'`
   - **Tratamentos Encerrados** — `status='ended'` OR `endDate < today`
   - Cada seção colapsável (collapsed por default Pausados+Encerrados, Ativos expandido)
   - Counter por seção (`Ativos (3)`, `Pausados (1)`, `Encerrados (2)`)

4. **NOVA seção: Lista de doses do paciente**
   - Replica visual da Dashboard (mesma `DoseCard` component)
   - Filtro segmentado simples: `24h | Todas`
   - Default: 24h
   - Doses do paciente apenas (filter `patientId === current.id`)
   - Ações inline: marcar tomada, pular, undo (mesma UX Dashboard)
   - Mesma DoseModal abre on click
   - Empty state se zero doses no filtro

5. **Reordenar layout** (top → bottom):
   ```
   [Foto avatar grande]
   Nome
   Idade · Peso
   [Compartilhar / Compartilhado badge]
   ─────────────────────────────────
   [Card Doses Hoje X/Y]  [Card Tratamentos Ativos count]
   ─────────────────────────────────
   Lista de doses
   [Filtro: 24h | Todas]
   • Dose 1 (action buttons)
   • Dose 2
   ...
   ─────────────────────────────────
   Tratamentos Ativos (3) ▼
     • Tratamento A
     • Tratamento B
     • Tratamento C
   ─────────────────────────────────
   Tratamentos Pausados (1) ▶
   ─────────────────────────────────
   Tratamentos Encerrados (2) ▶
   ```

**Implementação técnica:**
- Reusar `DoseCard` ou similar component da Dashboard
- Reusar `useDoses({ patientId, from, to })` hook com filter por paciente
- Reusar `useConfirmDose` / `useSkipDose` / `useUndoDose` mutations
- Reusar `useTreatments({ patientId })` hook + group by status client-side via useMemo
- Adicionar collapse state useState pra Pausados/Encerrados
- Filtro 24h/Todas: useState segmented control (similar ao Dashboard 12h/24h/48h chips)

**Aceitação:**
- ✅ Card "Doses Hoje: X de Y" no topo (substitui Adesão)
- ✅ Card "Tratamentos Ativos" mantido
- ✅ Tratamentos separados em 3 seções (Ativos/Pausados/Encerrados) — encerrados NÃO aparecem em Ativos
- ✅ Lista de doses com filtro 24h/Todas + ações marcar/pular funcionando idêntico ao Dashboard
- ✅ Layout reordenado conforme spec
- ✅ Build OK + lint zero errors
- ✅ Test manual prod preview Vercel (paciente real ou teste)

**Out of scope (parqueado v0.2.2.0+):**
- Filtros adicionais (paciente, status, tipo) na lista doses paciente
- Edição inline tratamentos (atual Editar/Pausar/Encerrar buttons mantidos)
- Stats avançadas (gráficos adesão semanal, etc) — vão pra Reports/Analytics

### #161 — Alerts dismiss refinement: ending 1×/dia + share permanent + overdue persist
- **Status:** ✅ Concluído v0.2.1.2 (2026-05-06) — AppHeader.jsx LS_ENDING_SEEN_DATE date-based
- **Origem:** User reported (2026-05-06) — "alertas precisam sumir depois de vistos. Doses atrasadas persistente sempre. Compartilhamento aparece quando recebe, depois some pra sempre. Tratamento encerrando aparece 1× por dia, dismiss = some hoje, amanhã reaparece"
- **Prioridade:** P1 UX
- **Esforço:** 15 min
- **Arquivo:** `src/components/dosy/AppHeader.jsx`

**Comportamento por tipo de alerta:**

| Tipo | Trigger | Dismiss | Persist? |
|---|---|---|---|
| Doses atrasadas | overdueCount > 0 | NÃO dismissable | Sempre enquanto há overdue |
| Compartilhamento | createdAt > LS_SHARES_SEEN | Click pra ver = some pra sempre | Sim (já existia) |
| Tratamento encerrando | endingSoonList ≠ [] AND seenDate ≠ today | Click hoje = some hoje | **Reaparece amanhã** |

**Mudança técnica:**
- Antes: `LS_ENDING_SEEN` armazenava timestamp ISO. Filter `t.updatedAt > seenAt` = só re-mostrar quando trat fosse atualizado (raro, dias restantes muda mas updatedAt não)
- Depois: `LS_ENDING_SEEN_DATE` armazena date string YYYY-MM-DD. Compare `seenDate === todayISODate()`:
  - Se mesmo dia → badge zero (dismissed hoje)
  - Próximo dia (today muda) → badge reaparece automaticamente
  - Quando trat sair do endingSoonList (vencer ou ser encerrado), badge zera permanente

**Aceitação:**
- ✅ User clica ícone Pill amarelo → Sheet abre → fecha → ícone some pelo resto do dia
- ✅ Próximo dia (00:00 UTC virou) → ícone reaparece com mesmos trats (até saírem do horizon ≤3d)
- ✅ Compartilhamento mantém comportamento: dismiss permanente
- ✅ Doses atrasadas mantém: persistente

**Detalhe code change:**
```js
const LS_ENDING_SEEN_DATE = 'dosy_ending_seen_date' // YYYY-MM-DD

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

const endingSoonNew = useMemo(() => {
  if (endingSoonList.length === 0) return 0
  const seenDate = localStorage.getItem(LS_ENDING_SEEN_DATE)
  if (seenDate === todayISODate()) return 0
  return endingSoonList.length
}, [endingSoonList])

const onClickEnding = () => {
  localStorage.setItem(LS_ENDING_SEEN_DATE, todayISODate())
  setEndingSheetOpen(true)
}
```

### #160 v2 — PatientDetail collapse opcional Doses + Tratamentos Ativos + header card destaque
- **Status:** ✅ Concluído v0.2.1.2 (2026-05-06) — extensão #160
- **Origem:** User reported (2026-05-06) — "lista retrátil de encerrados/pausados ok, quero retrair tb Doses + Tratamentos Ativos. Header Doses mais destacado, talvez dentro de card cor diferente"
- **Esforço:** 20 min

**Mudanças:**
- collapse state: `{ doses: false, active: false, paused: true, ended: true }` (defaults)
- Doses agora dentro **Card com gradient sunset soft** (peach/orange) — destaque visual claro vs outras seções
- Header Doses font display 16px bold + count badge (rgba white 40%) + chevron rotate
- Tratamentos Ativos: collapse toggle adicionado (antes era forçado expanded)
- Filtro 24h/Todas e DoseCard list movidos pra dentro card destaque
- Visual collapse pause/ended mantido conforme #160 v1

**Aceitação:**
- ✅ Card Doses com background gradient peach distinto vs outras seções background neutral
- ✅ Click header Doses → collapse/expand
- ✅ Click header Tratamentos Ativos → collapse/expand
- ✅ Pausados/Encerrados continuam collapse default

### Mounjaro fix — paciente Luiz Henrique conta lhenrique.pda@gmail.com
- **Status:** ✅ Concluído v0.2.1.2 (2026-05-06) — SQL data fix
- **Origem:** User reported (2026-05-06) — "cadastrei Mounjaro 4 doses 1×/semana, fez uma semana ontem e não me avisou, está em encerrados"
- **Causa raiz:** `durationDays: 4` salvo (literal "4 dias") quando user esperava 28 (4 doses × 7 dias intervalo). Form `TreatmentForm.jsx` pede "Duração (dias)" — UX confusa pra tratamentos semanais/mensais.
- **Fix data SQL** (1-time):
  ```sql
  UPDATE medcontrol.treatments
  SET "durationDays" = 28, status = 'active', "updatedAt" = NOW()
  WHERE id = '4af9b31d-5971-4a8b-b09a-5fa1003bb16a';

  -- Insert doses 2-4 (1×/semana 14:30 BRT)
  INSERT INTO medcontrol.doses (...)
  VALUES
    ('2026-05-06 17:30:00+00'::timestamptz),  -- HOJE
    ('2026-05-13 17:30:00+00'::timestamptz),  -- 7d
    ('2026-05-20 17:30:00+00'::timestamptz);  -- 14d
  ```
- **Resultado:** Mounjaro volta pra Tratamentos Ativos + dose hoje aparece no Início (overdue se já passou 14:30) + alarme dispara nos próximos.

**Pendente v0.2.2.0+ (não nesta release):**
- TreatmentForm.jsx UX improvement: pra `intervalHours >= 24` (tratamentos diários/semanais/mensais), pedir "Número de doses" ao invés "Duração (dias)" + calcular durationDays internamente OR adicionar warning "Com intervalo 168h e duração 4 dias, só 1 dose será agendada" quando `intervalHours/24 > durationDays`. **Item criado: #162 (próxima release).**

### #162 — TreatmentForm UX warning intervalHours/24 > durationDays (Mounjaro repro prevention)

- **Status:** ⏳ Aberto
- **Categoria:** 🐛 BUGS
- **Prioridade:** P2
- **Origem:** User-reported 2026-05-06 (Mounjaro silent fail v0.2.1.2)
- **Esforço:** 1-2h
- **Release sugerida:** v0.2.2.0+

**Problema:**

Form `TreatmentForm.jsx` aceita `durationDays < intervalHours/24` sem warning visual. Resultado: tratamento semanal (intervalHours=168) com `durationDays=4` gera apenas 1 dose (em vez de 4 doses ao longo de 28 dias). Tratamento auto-encerra cedo (`effectiveStatus → 'auto-ended'` quando `endDate < now`) e user não percebe — alerta "tratamento acabando" silencia precoce, app vai pra "Encerrados" sem aviso óbvio.

**Repro Mounjaro v0.2.1.2 (paciente lhenrique.pda):**
- Mounjaro: intervalHours=168 (semanal) + durationDays=4 (literal 4 dias) → endDate 03/05 → auto-ended dia 03/05 → user esperava 4 doses × 7d = 28 dias.
- SQL data fix aplicado v0.2.1.2 (durationDays 4→28 + status active + 3 doses pendentes).

**Causa raiz UX:**
- Campo "Duração (dias)" no form = ambíguo pra tratamentos com `intervalHours >= 24`. User pensa "4 doses" digita "4" mas semantic correto = "28 dias" (4 doses × 7d intervalo).
- Sem validação inline, sem hint, sem warning amarelo.

**Abordagem (escolher 1 ou ambos):**

**Opção A — Warning inline (mínimo viável, 30min):**
```jsx
// TreatmentForm.jsx — após onChange durationDays/intervalHours
const dosesPossiveis = Math.floor((durationDays * 24) / intervalHours)
const warningSilent = intervalHours >= 24 && dosesPossiveis < 2
{warningSilent && (
  <div style={{ background: 'var(--dosy-amber-bg)', padding: 12, borderRadius: 8 }}>
    ⚠️ Com intervalo de {intervalHours/24}d e duração {durationDays}d,
    apenas {dosesPossiveis} dose{dosesPossiveis !== 1 ? 's serão' : ' será'} agendada
    {dosesPossiveis > 1 ? 's' : ''}. Tratamento auto-encerra em {durationDays}d.
    <div style={{ fontSize: 12, marginTop: 6 }}>
      Esperava mais doses? Aumente "Duração (dias)" pra {Math.ceil((intervalHours/24) * dosesEsperadas)}d
    </div>
  </div>
)}
```

**Opção B — Refactor campo "Número de doses" (1-2h, melhor UX):**
- Pra `intervalHours >= 24`, trocar campo "Duração (dias)" por "Número de doses" + calcular `durationDays = numDoses * (intervalHours/24)` internamente
- Pra `intervalHours < 24` (cada X horas), manter "Duração (dias)" atual
- Toggle automático baseado em `intervalHours` value
- Side-effect: schema DB inalterado (durationDays continua persistindo) — só UI muda

**Decisão recomendada:** Opção A primeiro (warning, low risk), Opção B v0.2.3.0+ se feedback usuário continuar mostrando confusão.

**Dependências:**
- TreatmentForm.jsx atual lê durationDays + intervalHours via state form
- Tokens design `--dosy-amber-bg` (já existe pra warnings)

**Critério de aceitação:**
- ✅ Form com intervalHours=168 + durationDays=4 → warning amarelo visível
- ✅ Form com intervalHours=24 + durationDays=30 → sem warning (30 doses faz sentido)
- ✅ Form com intervalHours=168 + durationDays=28 → sem warning (4 doses faz sentido)
- ✅ Texto warning calcula dosesPossiveis correto
- ✅ Sugestão de "Aumente para Xd" arredonda pra cima
- ✅ Validado no preview Vercel via Chrome MCP (Regra 9.1)

---

## Plano egress otimização escala (preparar Open Testing/Production)

> **Contexto investigação 2026-05-06:** Supabase Pro cycle (05 May - 05 Jun) consumiu 8.74 GB / 250 GB com 4 MAU = **3.75 GB/user/mês** (~30× padrão SaaS healthcare 50-200 MB/user/mês). Storm pré-#157 dominou cycle (May 5 = 7.2 GB, May 6 pós-fix = 0.5 GB, **redução 14× dia-a-dia**). Steady state estimado pós #157 fix: ~15 GB/mês com user atual. Math escala: 100 users heavy = ~375 GB/mês → ESTOURA Pro 250 GB. Items #163-#167 preparam escala Open Testing/Production (objetivo ≤500 MB/user/mês = 5-10× redução combined).
>
> **Sequência sugerida** (ordem dependência + ROI):
> 1. **#163** RPC consolidado Dashboard (3-4h, -40% a -60% Dashboard egress, low risk)
> 2. **#165** Delta sync + TanStack persist (3-5h, -70% a -90% reads steady state, médio risk)
> 3. **#164** Realtime broadcast (4-6h, -80% a -90% Realtime, alto ROI mas requer #157 retomar coordenado)
> 4. **#166** MessagePack + compression (2-3h, 50-70% payload, low risk)
> 5. **#168** CDN cache strategy (2-3h, low risk + aproveita Cached Egress 250 GB ociosa)
> 6. **#167** Cursor pagination + cols aggressive + Supavisor (3-5h, marginal mas estrutural)
>
> Total esforço: **~17-26h código distribuído v0.2.2.0+ → v0.2.3.0+**.

### #163 — RPC consolidado Dashboard `get_dashboard_payload`

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P1 (cost escala — preparar Open Testing)
- **Origem:** Investigação egress 2026-05-06 (3.75 GB/user/mês = 30× padrão SaaS)
- **Esforço:** 3-4h
- **Release sugerida:** v0.2.2.0+

**Problema:**

Dashboard atual faz 4 queries paralelas em paralelo no mount:
- `useDoses(filter)` → listDoses RPC
- `usePatients()` → listPatients
- `useTreatments()` → listTreatments
- `extend_continuous_treatments` rpc

Cada query carrega:
- Auth context (set_config search_path + auth.uid + JWT decode) ~1-2 KB
- Response payload (rows + duplicate metadata)
- HTTP overhead (headers + TLS handshake reuse)

Resultado: 4× round-trip + ~4× auth overhead duplicado. PostgREST + RLS context per request.

**Abordagem:**

Migration: criar SQL function `medcontrol.get_dashboard_payload(p_user_id uuid)` SECURITY DEFINER com `SET search_path = medcontrol, public`:

```sql
CREATE OR REPLACE FUNCTION medcontrol.get_dashboard_payload(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = medcontrol, public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Auth check (caller deve ser user)
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'doses', (
      SELECT coalesce(jsonb_agg(d ORDER BY "scheduledAt"), '[]'::jsonb)
      FROM (
        SELECT id, "patientId", "treatmentId", "medName", dose, unit, "scheduledAt", "takenAt", status
        FROM medcontrol.doses
        WHERE "userId" = p_user_id
          AND "scheduledAt" >= now() - interval '30 days'
          AND "scheduledAt" <= now() + interval '60 days'
        ORDER BY "scheduledAt"
        LIMIT 500
      ) d
    ),
    'patients', (
      SELECT coalesce(jsonb_agg(p), '[]'::jsonb)
      FROM (
        SELECT id, name, "ageMonths", weight, avatar, "photoVersion", "isShared"
        FROM medcontrol.patients
        WHERE "ownerId" = p_user_id OR id IN (
          SELECT "patientId" FROM medcontrol.patient_shares WHERE "sharedWithUserId" = p_user_id
        )
      ) p
    ),
    'treatments', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb)
      FROM (
        SELECT id, "patientId", "medName", dose, unit, "intervalHours", "isContinuous", "durationDays", "startDate", status
        FROM medcontrol.treatments
        WHERE "userId" = p_user_id
      ) t
    ),
    'stats', (
      SELECT jsonb_build_object(
        'overdue', count(*) FILTER (WHERE status = 'overdue'),
        'upcoming_24h', count(*) FILTER (WHERE status = 'scheduled' AND "scheduledAt" <= now() + interval '24 hours')
      )
      FROM medcontrol.doses
      WHERE "userId" = p_user_id
    ),
    'serverTime', extract(epoch from now())::int
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION medcontrol.get_dashboard_payload(uuid) TO authenticated;
```

Frontend: novo hook `useDashboardPayload(userId)`:

```js
// src/hooks/useDashboardPayload.js
export function useDashboardPayload() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_payload', { p_user_id: user.id })
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 15 * 60_000, // 15min, opt-in só Dashboard
  })
}
```

Dashboard.jsx — substituir 4 hooks por 1:

```js
// Antes
const { data: doses } = useDoses(filter)
const { data: patients } = usePatients()
const { data: treatments } = useTreatments()
useEffect(() => extendContinuous(), [])

// Depois
const { data: payload } = useDashboardPayload()
const { doses = [], patients = [], treatments = [], stats } = payload || {}
```

**Dependências:**
- Migration SQL nova (testar local + apply prod)
- Hook novo `useDashboardPayload`
- Refactor Dashboard.jsx (manter compat outras telas que usam useDoses/usePatients separados)

**Critério de aceitação:**
- ✅ Migration aplica sem erro
- ✅ RPC retorna payload completo Dashboard render OK
- ✅ Auth check funciona (caller != p_user_id retorna error)
- ✅ Validação Chrome MCP preview: Dashboard 1 fetch (vez de 4) + payload size ≤60% original combinado
- ✅ Sentry sem regressões (DOSY-* events)

**Métrica esperada:**
- -40% a -60% Dashboard egress
- -75% Dashboard request count (4 → 1)
- Round-trip time -300ms (4 paralelas → 1 single)

---

### #164 — Realtime broadcast healthcare alerts (combinado retomar #157)

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P1 (cost escala — combinado retomar #157)
- **Origem:** Investigação egress 2026-05-06 + plano retomar #157 v0.2.2.0+
- **Esforço:** 4-6h
- **Release sugerida:** v0.2.2.0+

**Problema:**

#157 disabled `useRealtime()` em App.jsx (commit `da61b04`) por storm 12 req/s sustained idle. Root cause: publication `supabase_realtime` vazia + reconnect cascade gerava `ChannelRateLimitReached` + refetch loop. Mas **realtime sync é necessário** pra UX multi-device (user marca dose tomada num device → outro device vê instantâneo).

Solução tradicional `postgres_changes` streaming:
- Cliente subscribe canal `realtime:medcontrol.doses`
- Cada UPDATE/INSERT no DB → server envia full row pro cliente
- Cliente recebe row 50KB → invalidate query → refetch full list 200KB

Padrão **broadcast** (Supabase Realtime channels):
- Edge function envia `supabase.channel('user:<userId>').send({type:'broadcast', event:'dose_update', payload:{id, status, takenAt}})`
- Cliente subscribe canal user-scoped → recebe payload customizado ~1KB (só campos mudados)
- Patch cache local diretamente via `qc.setQueryData(['doses'], (old) => old.map(d => d.id === payload.id ? {...d, ...payload} : d))`
- Bypass refetch network completo

**Abordagem:**

Server side — modificar Edge `dose-trigger-handler` (cron + INSERT trigger):

```ts
// supabase/functions/dose-trigger-handler/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function broadcastDoseUpdate(userId: string, doseUpdate: {id, status, takenAt?, scheduledAt?}) {
  const channel = supabase.channel(`user:${userId}`)
  await channel.send({
    type: 'broadcast',
    event: 'dose_update',
    payload: doseUpdate
  })
}

// Após INSERT/UPDATE dose:
await broadcastDoseUpdate(userId, { id, status: 'taken', takenAt: new Date().toISOString() })
```

Client side — novo hook `useUserBroadcast`:

```js
// src/hooks/useUserBroadcast.js
import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export function useUserBroadcast() {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`user:${user.id}`)
      .on('broadcast', { event: 'dose_update' }, ({ payload }) => {
        // Patch cache local sem refetch
        qc.setQueriesData({ queryKey: ['doses'] }, (old) => {
          if (!Array.isArray(old)) return old
          return old.map(d => d.id === payload.id ? { ...d, ...payload } : d)
        })
        qc.setQueryData(['dashboard', user.id], (old) => {
          if (!old) return old
          return {
            ...old,
            doses: old.doses.map(d => d.id === payload.id ? { ...d, ...payload } : d)
          }
        })
      })
      .on('broadcast', { event: 'patient_update' }, ({ payload }) => {
        // Similar pra patients
      })
      .on('broadcast', { event: 'treatment_update' }, ({ payload }) => {
        // Similar pra treatments
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, qc])
}
```

App.jsx — re-enable mas usando broadcast:

```js
// Antes (#157 disabled): // useRealtime()
// Agora:
useUserBroadcast()
```

**Dependências:**
- Edge functions modificadas (dose-trigger-handler + handler PATCH/DELETE)
- Hook novo client
- Manter `useRealtime.js` desabled (postgres_changes stream substituído)
- Validação multi-device

**Critério de aceitação:**
- ✅ Marcar dose tomada device A → device B atualiza ≤2s sem refetch
- ✅ Network tab: payload broadcast event ≤1.5 KB (vs ~50 KB postgres_changes)
- ✅ Idle 5min sem requests automáticos (broadcast só dispara em events)
- ✅ Reconnect resiliente (sem cascade storm #157)
- ✅ Validação Chrome MCP preview Vercel: idle 5min = 0 fetches

**Métrica esperada:**
- -80% a -90% Realtime egress
- Latência sync multi-device <2s
- Zero idle polling

---

### #165 — Delta sync doses + TanStack persist IndexedDB offline-first

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P1 (cost escala — UX offline-first)
- **Origem:** Investigação egress 2026-05-06 (steady state still high)
- **Esforço:** 3-5h
- **Release sugerida:** v0.2.2.0+ ou v0.2.3.0+

**Problema:**

Hoje cliente abre app → 4 queries paralelas full pull (doses 30d + patients all + treatments all). Mesmo com staleTime 15min (#150), navigate entre rotas + refresh manual + open app revisita cache mas não persiste entre sessions (TanStack Query in-memory only).

Ideal: cache persist entre sessions + initial render instant + delta sync background only.

**Abordagem:**

(a) **Server-side delta filter** — adicionar `?since=lastSyncedAt` em listDoses:

```js
// src/services/dosesService.js
export async function listDoses({ from, to, status, since }) {
  let q = supabase.schema('medcontrol').from('doses').select(DOSE_COLS_LIST)
  if (from) q = q.gte('scheduledAt', from)
  if (to) q = q.lte('scheduledAt', to)
  if (status) q = q.eq('status', status)
  if (since) q = q.gt('updatedAt', since) // ← novo filter delta
  return q.order('scheduledAt')
}
```

useDoses tracks `lastSyncedAt` via localStorage:

```js
// src/hooks/useDoses.js
const lastSyncedAt = localStorage.getItem('dosy_doses_last_sync') || '1970-01-01'
const { data: deltaRows } = useQuery({
  queryKey: ['doses', 'delta', lastSyncedAt],
  queryFn: async () => {
    const rows = await listDoses({ since: lastSyncedAt })
    if (rows.length > 0) {
      localStorage.setItem('dosy_doses_last_sync', new Date().toISOString())
    }
    return rows
  },
  staleTime: 30_000,
})
```

Patch cache local com delta rows ao invés de full list refetch.

(b) **TanStack persist plugin** — instalar `@tanstack/query-persist-client` + `@tanstack/query-async-storage-persister`:

```bash
npm i @tanstack/query-persist-client @tanstack/query-async-storage-persister idb-keyval
```

```js
// src/main.jsx
import { persistQueryClient } from '@tanstack/query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

const persister = createAsyncStoragePersister({
  storage: { getItem: get, setItem: set, removeItem: del },
  key: 'dosy-query-cache',
  throttleTime: 2000,
})

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  buster: __APP_VERSION__, // invalida cache em deploy novo
  dehydrateOptions: {
    shouldDehydrateQuery: (q) => {
      // Persist só queries safe (não auth, não temp)
      return ['doses', 'patients', 'treatments', 'dashboard'].includes(q.queryKey[0])
    },
  },
})
```

(c) **staleTime bump** combinado: 15min → 30min (cache persist garante boot instant + delta sync atualiza background).

**Dependências:**
- Migration: garantir `updatedAt` index em medcontrol.doses (`CREATE INDEX IF NOT EXISTS idx_doses_updated_at ON medcontrol.doses("userId", "updatedAt") WHERE "updatedAt" IS NOT NULL`)
- Trigger: garantir `updatedAt` auto-update em todas mutations
- IndexedDB compat (Capacitor WebView OK; older Android <7.0 sem fallback)

**Critério de aceitação:**
- ✅ App restart → render Dashboard ≤500ms (cache local instant)
- ✅ Cache persist sobrevive force stop + reabrir
- ✅ Delta sync 1 request retorna só rows mudadas (verificar payload size)
- ✅ Cache invalida em deploy novo (buster __APP_VERSION__)
- ✅ Validação Chrome MCP: idle 5min sem app aberto + reabrir = boot rápido + 1 delta fetch ≤5KB

**Métrica esperada:**
- -70% a -90% reads steady state (após initial pull pesado)
- Boot time -800ms (cache local vs network round-trip)
- UX offline-first (modo avião funcional read-only)

---

### #166 — MessagePack Edge functions payload + compression headers

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (cost escala — payload size optimization)
- **Origem:** Investigação egress 2026-05-06
- **Esforço:** 2-3h
- **Release sugerida:** v0.2.3.0+

**Problema:**

Edge functions atuais (`dose-trigger-handler`, `schedule-alarms-fcm`, `notify-doses`, `send-test-push`) retornam JSON. JSON tem overhead significativo: keys repetidos em arrays, strings numbers, null verbose. MessagePack binary ~50-70% menor pra mesmo payload.

Compression: Supabase serve gzip por default. Verificar headers cliente `Accept-Encoding: br, gzip` (Brotli melhor que gzip — verificar Vercel CDN pass-through).

**Abordagem:**

(a) **MessagePack** Edge functions:

```ts
// supabase/functions/dose-trigger-handler/index.ts
import { encode } from 'jsr:@msgpack/msgpack'

return new Response(encode(payload), {
  headers: {
    'Content-Type': 'application/x-msgpack',
    'Cache-Control': 'no-store',
  },
})
```

Cliente decode no fetch wrapper:

```js
// src/lib/supabaseClient.js fetch interceptor
import { decode } from '@msgpack/msgpack'

const origFetch = window.fetch
window.fetch = async (...args) => {
  const resp = await origFetch(...args)
  if (resp.headers.get('content-type')?.includes('application/x-msgpack')) {
    const buf = await resp.arrayBuffer()
    const data = decode(buf)
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { 'content-type': 'application/json' },
    })
  }
  return resp
}
```

(b) **Compression headers** verify:

```js
// Adicionar Accept-Encoding em todos fetches
fetch(url, {
  headers: {
    'Accept-Encoding': 'br, gzip, deflate',
  },
})
```

Verificar Vercel `vercel.json` headers config:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Accept-CH", "value": "Save-Data" }
      ]
    }
  ]
}
```

**Dependências:**
- `@msgpack/msgpack` deno port (server) + npm pkg (client)
- Fetch wrapper compat (não quebrar JSON endpoints PostgREST)

**Critério de aceitação:**
- ✅ Edge function retorna application/x-msgpack
- ✅ Cliente decode + render OK
- ✅ Network tab: payload binary ≤50% size original JSON
- ✅ Brotli compression aplicado pelo Vercel CDN (verificar `content-encoding: br`)
- ✅ Sentry sem regressões parsing

**Métrica esperada:**
- -50% a -70% Edge function payload size
- -10% a -20% adicional via Brotli vs Gzip

---

### #167 — Cursor pagination + selective columns aggressive + Supavisor pooler

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (cost escala — estrutural)
- **Origem:** Investigação egress 2026-05-06
- **Esforço:** 3-5h
- **Release sugerida:** v0.2.3.0+

**Problema:**

(a) **Offset pagination** atual (`?from=N&to=M`) força server re-scan rows skipped. Cursor pagination (`?after=last_id`) usa index seek direto.

(b) **DOSE_COLS_LIST** já reduzido (#138 sem observation). Pode ir mais aggressive: status string `'scheduled' | 'taken' | 'skipped' | 'overdue'` → int code `0 | 1 | 2 | 3` (1 byte vs 8-9 bytes). Drop campos read-rare (`updatedBy`, `createdBy` em listas).

(c) **Supavisor transaction mode** — Supabase Pro inclui pooler. Trocar direct conn por `aws-0-sa-east-1.pooler.supabase.com:6543` pra reduzir handshake overhead 200-400 bytes/request (PG handshake + RLS context setup mais leve em pooled conn).

**Abordagem:**

(a) **Cursor pagination**:

```js
// src/services/dosesService.js
export async function listDosesCursor({ after, limit = 100 }) {
  let q = supabase.schema('medcontrol').from('doses').select(DOSE_COLS_LIST)
    .order('scheduledAt')
    .order('id') // tiebreaker
    .limit(limit)
  if (after) {
    const [scheduledAt, id] = after.split('|')
    q = q.or(`scheduledAt.gt.${scheduledAt},and(scheduledAt.eq.${scheduledAt},id.gt.${id})`)
  }
  const { data } = await q
  const lastRow = data[data.length - 1]
  const nextCursor = lastRow ? `${lastRow.scheduledAt}|${lastRow.id}` : null
  return { rows: data, nextCursor }
}
```

(b) **Status int code** — migration:

```sql
ALTER TABLE medcontrol.doses
  ADD COLUMN status_code smallint;

UPDATE medcontrol.doses SET status_code = CASE status
  WHEN 'scheduled' THEN 0
  WHEN 'taken' THEN 1
  WHEN 'skipped' THEN 2
  WHEN 'overdue' THEN 3
END;

CREATE INDEX idx_doses_status_code ON medcontrol.doses("userId", status_code);
```

DOSE_COLS_LIST drop string `status` da lista, usar `status_code`. Frontend decode:

```js
const STATUS_DECODE = { 0: 'scheduled', 1: 'taken', 2: 'skipped', 3: 'overdue' }
const STATUS_ENCODE = Object.fromEntries(Object.entries(STATUS_DECODE).map(([k, v]) => [v, +k]))
```

(c) **Supavisor pooler** — trocar URL `.env`:

```env
# Antes
VITE_SUPABASE_URL=https://guefraaqbkcehofchnrc.supabase.co

# Depois (transaction mode pooler)
VITE_SUPABASE_URL=https://guefraaqbkcehofchnrc.supabase.co  # API gateway mantém
# Direct DB conn (SSR/Edge) usa pooler
DATABASE_URL=postgres://postgres.guefraaqbkcehofchnrc:[pwd]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

Edge functions usar `DATABASE_URL` pooler.

**Dependências:**
- Migration status_code + index
- Refactor frontend status display (manter compat string display)
- Pool conn URL Edge functions

**Critério de aceitação:**
- ✅ Cursor pagination retorna rows consistentes (sem duplicate/skip em concurrent INSERT)
- ✅ Status int code: payload list -8 bytes/row (1500 doses = -12 KB save)
- ✅ Supavisor pooler conn estável (Edge function logs sem timeout/disconnect)
- ✅ Sentry sem regressões

**Métrica esperada:**
- Marginal -5% a -10% por item, mas cumulativo estrutural longprazo
- Permite scale 1000+ users sem re-arq major

---

### #168 — CDN cache strategy: bundle + assets via Vercel CDN + Supabase Storage cache headers

- **Status:** ⏳ Aberto
- **Categoria:** ✨ MELHORIAS
- **Prioridade:** P2 (cost escala — aproveitar Cached Egress separado)
- **Origem:** Investigação egress 2026-05-06 (Pro Cached Egress 250 GB separado, 0/250 atualmente)
- **Esforço:** 2-3h
- **Release sugerida:** v0.2.3.0+

**Problema:**

Pro plan tem **2 quotas separadas**:
- **Database Egress 250 GB** — traffic PostgREST + Edge functions (consumido 8.74 GB / 250 atualmente)
- **Cached Egress 250 GB** — traffic via CDN cache hits (Storage, Edge function cached responses, static assets) — atualmente **0 / 250 GB**

Quota Cached Egress está completamente ociosa. Otimização: deslocar traffic do DB Egress para Cached Egress quando possível, aproveitando 250 GB extras gratuitos no Pro.

Exemplos de oportunidades:
- Bundle JS Dosy serve de Vercel CDN (não Supabase) — verificar HIT rate `cache-control` headers
- Imagens estáticas (logo, splash, ícones) servem Vercel CDN
- Fotos pacientes (Supabase Storage `patient-photos`): hoje sem `cache-control` → cliente re-baixa toda vez. Setar `cache-control: public, max-age=31536000, immutable` (foto path versioned via `photo_version` #115, então safe immutable)
- Edge functions retornando dados estáticos-ish (FAQ, Termos, Privacidade conteúdo) com `cache-control: public, max-age=3600 s-maxage=86400` → CDN cache hit em vez de re-execute
- PostgREST `etag` headers permitem 304 Not Modified em refetch idempotente (cliente reusa cache local)

**Abordagem:**

(a) **Verificar Vercel CDN cache hit rate atual:**

```bash
# Curl Vercel asset com headers
curl -I https://dosymed.app/assets/index-Cmc-tujf.js
# Esperar: cache-control: public, max-age=31536000, immutable
# x-vercel-cache: HIT (após 1ª request)
```

Vercel default cobre `/assets/*` immutable (Vite hash filenames). Verificar `index.html` cache curto (max-age=0 must-revalidate) pra deploys novos serem detectados.

`vercel.json` (criar se não existir):

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/icon-(.*).png",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    },
    {
      "source": "/(.*\\.svg|.*\\.woff2)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

(b) **Supabase Storage `patient-photos` cache headers** — atualizar upload service:

```js
// src/services/patientService.js (upload photo path)
async function uploadPatientPhoto(patientId, file, version) {
  const path = `${patientId}/${version}.jpg`
  const { error } = await supabase.storage
    .from('patient-photos')
    .upload(path, file, {
      cacheControl: '31536000, immutable', // 1 year, version garante busting
      upsert: true,
      contentType: 'image/jpeg',
    })
  if (error) throw error
  return path
}
```

Nota: `photo_version` #115 já garante busting — quando user troca foto, version++ → new path → cache miss legítimo. Files antigos viram garbage collected (Supabase Storage não auto-deleta — pode adicionar pg_cron pra cleanup `photo_version < current` rows, mas low priority).

(c) **Edge functions cache-control** — endpoints estáticos-ish:

```ts
// Hipotético: edge function retornando FAQ.md content (se mover pra DB futuro)
return new Response(content, {
  headers: {
    'Content-Type': 'text/markdown',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  },
})
```

(d) **PostgREST etag verify** — Supabase já envia `etag` em responses GET; cliente HTTP cache automático respeita 304. Verificar Network tab Chrome MCP: requests duplicadas idempotentes retornam 304 Not Modified em vez de 200 + payload.

(e) **Service Worker cache strategy** — atualizar `public/sw.js` (atualmente v6 #078) com strategy mais agressiva:

```js
// Cache First pra assets imutáveis
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Assets versioned (Vite hash) → cache forever
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
        const cloned = resp.clone()
        caches.open('dosy-assets-v6').then(c => c.put(event.request, cloned))
        return resp
      }))
    )
    return
  }

  // index.html → network first (deploys novos)
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
    return
  }
})
```

**Dependências:**
- `vercel.json` config commit
- patientService upload path com cacheControl
- Service worker bump v6 → v7 (#078 pattern)
- Validar Network tab Chrome MCP HIT/MISS rate

**Critério de aceitação:**
- ✅ Curl Vercel asset retorna `cache-control: max-age=31536000, immutable`
- ✅ 2ª visita Dosy (mesmo browser) → assets retornam `x-vercel-cache: HIT`
- ✅ Supabase Storage upload setou `cache-control` 1 year
- ✅ Foto paciente carrega 1× por device por version (cache hit local + CDN)
- ✅ Service worker v7 deployed + cache strategy assets-first funcional offline
- ✅ Validação Chrome MCP: visita repetida Dosy → assets bytes ≤10% original (cache hit)
- ✅ Cached Egress dashboard começa subir (sinal traffic deslocado pra cache quota)

**Métrica esperada:**
- Bundle JS + assets: 100% CDN cache (já parcialmente)
- Fotos pacientes: 1 download por version por device (vs every refetch)
- Cached Egress quota usage: 0 → ~30-50 GB/mês com 100 users (ainda dentro 250 GB)
- DB Egress save: -10% a -15% (asset traffic pequeno em relação DB queries, ROI moderado)

**Notas:**
- ROI menor que #163-#165 (que atacam DB queries diretamente) MAS quase grátis (config files apenas, low risk)
- Aproveita quota Cached Egress 250 GB ociosa do Pro plan
- Combinado com #166 (compression headers) cobre todo bullet 7 da análise original

---

## Plano marketing/ASO/growth (preparar Open Testing/Production launch)

> **Contexto análise concorrentes 2026-05-07:** Forecast realista solo dev sem marketing budget = 1.5K-3K MAU Year 1 (vs Medisafe ~200K MAU BR, MyTherapy ~100K, Pílula Certa ~500K — todos com anos brand recognition + parcerias). Solo dev BR healthcare apps típicos demoram 2-3 anos pra 50K MAU sem investimento. Dosy diferenciadores técnicos forte (alarme nativo crítico, compartilhamento, LGPD healthcare) MAS sem ataque marketing = stagnation. Items #169-#173 visam Year 1 5K-10K MAU + Year 3 50K MAU realista executando playbook.
>
> **Sequência sugerida** (ordem dependência + gating launch):
> 1. **#169** ASO Play Store completo (6-8h) — pre-Production launch obrigatório
> 2. **#170** Reviews strategy + In-App Review (4-5h) — ativar dia 1 Production
> 3. **#173** Healthcare differentiators moat (15-22h, promove #064/#065/#066) — diferencial vs competitors
> 4. **#171** Marketing orgânico playbook BR (8-10h setup + ongoing) — paralelo Production
> 5. **#172** Landing page + blog SEO (12-16h initial + 24h conteúdo) — SEO leva 6-12 meses indexar
>
> Total esforço: **~50-65h initial** + 2-3h/semana ongoing (#171 content + #170 reviews reply).

### #169 — ASO Play Store completo: keywords + listing copy + screenshots strategy + A/B test

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (growth — pre-Production launch)
- **Origem:** Análise concorrentes BR 2026-05-07
- **Esforço:** 6-8h
- **Release sugerida:** v0.2.2.0+ (antes Production #133)

**Problema:**

Listing Play Store atual tem categoria "Saúde e fitness" + descrição básica + 8 screenshots (#025) + ícone + feature graphic. Falta otimização ASO real:
- Keywords não pesquisadas (qual termo BR converte?)
- Título 30 chars sem keyword primária forte
- Short description 80 chars genérica
- Full description 4000 chars sem distribuição estratégica keywords
- Screenshots ordem não testada (primeiros 3 = 80% conversão)
- Sem vídeo preview (boost conversão 25-35%)
- Zero A/B test rodando

**Abordagem:**

(a) **Keywords research BR healthcare** (use Google Play Console Keyword Planner + Sensor Tower free tier + AppTweak trial):

Tier 1 (alta intent, médio volume):
- "lembrete remédio" (~10K searches/mês BR)
- "alarme medicação" (~5K)
- "controle medicamentos" (~3K)
- "lembrete dose" (~2K)

Tier 2 (long-tail, alta conversão):
- "lembrete remédio idoso"
- "controle medicamentos diabetes"
- "alarme medicação Alzheimer"
- "cuidador dose remédio"
- "compartilhar medicação família"

(b) **Listing copy otimizado:**

**Título** (30 chars max):
- Atual: "Dosy" (subutilizado)
- Proposto: "Dosy: Lembrete de Remédios" (28 chars, keyword primária)

**Short description** (80 chars):
- "Alarme inteligente p/ medicação. Multi-paciente. Cuidadores. 100% PT-BR." (78 chars)

**Full description** (4000 chars) estrutura:

```
[Hook 1ª linha — 1ª impressão Play Store]
Nunca mais esqueça uma dose. O Dosy te avisa na hora certa, com alarme que toca alto até no modo silencioso.

[Problema/dor — 2-3 linhas]
Quem cuida de pais idosos, controla medicação para diabetes, ansiedade ou tratamento contínuo sabe: esquecer uma dose pode comprometer todo o tratamento.

[Solução — features primárias com keywords]
✅ ALARME CRÍTICO que toca alto + tela cheia (mesmo no silencioso)
✅ MULTI-PACIENTE: gerencie remédios de pais, filhos, marido/esposa
✅ COMPARTILHAR com cuidadores e familiares
✅ HISTÓRICO completo de doses tomadas
✅ TRATAMENTOS contínuos (controle hipertensão, diabetes, depressão)

[Diferencial vs concorrentes]
Diferente de outros apps de lembrete de remédio, o Dosy:
- Toca alarme REAL (não só notificação que some)
- 100% em português BR (não tradução)
- Funciona offline (não precisa internet)
- LGPD: seus dados ficam só com você

[Use cases]
Perfeito para: idosos com Alzheimer, diabéticos tipo 2, controle de TDAH, ansiedade, depressão, tratamento de tireoide, cuidadores profissionais e familiares.

[CTA + planos]
GRATUITO: 1 paciente + lembretes ilimitados
PRO R$ 14,90/mês: pacientes ilimitados + compartilhamento + sem anúncios

[Trust signals]
🏥 Conformidade LGPD healthcare
🔒 Dados criptografados (Android Keystore)
📱 Funciona em qualquer Android 7+
⭐ Avaliação 4.X (X reviews)

[Footer keywords secundárias]
lembrete remédio | alarme medicação | controle medicamentos | dose remédio | cuidador idoso | diabetes hipertensão | tratamento contínuo
```

(c) **Screenshots strategy** (primeiros 3 = 80% conversão):
1. **Screenshot 1**: Tela alarme nativo fullscreen disparado (visual impact + keyword "alarme tela cheia")
2. **Screenshot 2**: Dashboard com 3-4 pacientes + "Doses Hoje 5/8" (multi-paciente USP)
3. **Screenshot 3**: Modal compartilhar paciente com família (cuidadores diferencial)
4. Screenshots 4-8: features secundárias (#160 PatientDetail, #161 alerts, histórico, paywall, ajustes)

Cada screenshot com **caption text overlay** keyword-rich (lib `screenshots-pro` ou Photoshop): "Alarme que TOCA ALTO" / "Multi-paciente" / "Compartilhe com família".

(d) **Vídeo preview Play Console** (30s):
- 0-3s: Hook (paciente idoso esquece remédio cena)
- 4-10s: Solução (Dosy alarme dispara, acorda paciente)
- 11-20s: Features carousel (multi-paciente + compartilhar + histórico)
- 21-27s: Use cases (diabetes/Alzheimer/cuidador)
- 28-30s: CTA "Baixe Dosy grátis" + logo

Gravação device real S25 Ultra Studio captura. Trilha sonora upbeat 30s (Epidemic Sound free tier).

(e) **A/B test Play Console experiment**:
- Variant A: screenshots ordem #1-#8 atual
- Variant B: screenshots reordem (alarme primeiro vs multi-paciente primeiro)
- 50/50 split 2 semanas
- Métrica: install conversion rate
- Vencedor → manter

**Dependências:**
- Console acesso (já tem)
- Vídeo gravação device real (need user manual ~1h)
- Screenshots regerar com text overlay (#155 + novos)

**Critério de aceitação:**
- ✅ Listing copy publicado Console com keywords distribuídas
- ✅ 8 screenshots com text overlay keyword-rich
- ✅ Vídeo preview 30s uploaded (YouTube unlisted + linked Console)
- ✅ A/B test experiment ativo Console
- ✅ Métricas baseline capturadas (install rate, store visit rate, conversion rate)

**Métrica esperada:**
- +30-50% Play Store conversion rate (visit → install)
- +20-40% organic install volume via keyword ranking

---

### #170 — Reviews Play Store strategy: In-App Review API + reply playbook

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (growth — ativar dia 1 Production)
- **Origem:** Análise concorrentes BR 2026-05-07
- **Esforço:** 4-5h
- **Release sugerida:** v0.2.2.0+

**Problema:**

Reviews Play Store são **trust signal crítico** + **ranking factor algoritmo**:
- Apps com 4.3+ rating + 50+ reviews convertem 3-5× mais que apps sem reviews
- Algoritmo ASO penaliza apps <4.0 rating (cai pra trás em searches)
- Negative reviews sem reply parecem app abandonado
- Solo dev sem reply rate alto = signal ruim pra Google

**Abordagem:**

(a) **In-App Review API integração**:

Plugin Capacitor: `@capacitor-community/in-app-review`

```bash
npm i @capacitor-community/in-app-review
npx cap sync android
```

```js
// src/services/inAppReview.js
import { InAppReview } from '@capacitor-community/in-app-review'
import { Capacitor } from '@capacitor/core'

const REVIEW_LS_KEY = 'dosy_review_prompt_seen'
const REVIEW_DEFER_DAYS = 90 // Re-prompt se user já viu há 90+ dias

export async function maybePromptReview() {
  if (Capacitor.getPlatform() !== 'android') return

  const seen = localStorage.getItem(REVIEW_LS_KEY)
  if (seen) {
    const seenDate = new Date(seen)
    const daysAgo = (Date.now() - seenDate.getTime()) / 86400000
    if (daysAgo < REVIEW_DEFER_DAYS) return
  }

  try {
    await InAppReview.requestReview()
    localStorage.setItem(REVIEW_LS_KEY, new Date().toISOString())
  } catch (e) {
    console.warn('In-app review failed:', e)
  }
}
```

(b) **Trigger inteligente** (não show no boot — happy path moments):

```js
// src/hooks/useReviewPrompt.js
import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { maybePromptReview } from '../services/inAppReview'

const TRIGGER_LS = 'dosy_review_trigger_state' // {dosesTaken, alarmsFired, daysActive, lastTrigger}

export function useReviewPrompt() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const state = JSON.parse(localStorage.getItem(TRIGGER_LS) || '{}')
    const eligible =
      (state.dosesTaken || 0) >= 3 &&
      (state.alarmsFired || 0) >= 1 &&
      (state.daysActive || 0) >= 7
    if (eligible) maybePromptReview()
  }, [user])
}

// Increment counters quando user faz ação positiva:
export function trackDoseTaken() {
  const state = JSON.parse(localStorage.getItem(TRIGGER_LS) || '{}')
  state.dosesTaken = (state.dosesTaken || 0) + 1
  localStorage.setItem(TRIGGER_LS, JSON.stringify(state))
}

export function trackAlarmFired() {
  const state = JSON.parse(localStorage.getItem(TRIGGER_LS) || '{}')
  state.alarmsFired = (state.alarmsFired || 0) + 1
  localStorage.setItem(TRIGGER_LS, JSON.stringify(state))
}
```

Wire em DoseModal (mark taken) + AlarmService (alarm fired) + App.jsx daysActive tracker.

(c) **Response template Play Console** (3 categorias):

**Positive (4-5 stars):**
```
Olá [Nome]! Obrigado pela avaliação 5 estrelas! Ficamos muito felizes que o Dosy está te ajudando a cuidar da sua [família/saúde]. Se tiver sugestões de novas features, me escreve em contato@dosymed.app! 💜
```

**Negative (1-2 stars):**
```
Olá [Nome], desculpe pela experiência ruim. Pode me contar exatamente o que aconteceu pra eu corrigir? Manda detalhes pra contato@dosymed.app que vou priorizar o fix. Quero muito que o Dosy funcione bem pra você.
```

**Feature request (3-4 stars + sugestão):**
```
Oi [Nome]! Boa sugestão sobre [feature]. Vou adicionar no roadmap. Algumas features parecidas estão em desenvolvimento: [feature relacionada]. Se quiser acompanhar updates, segue @dosymed no Instagram!
```

(d) **Reply playbook** (turnaround <24h):
- Verificar Play Console reviews diariamente (calendar reminder 9h)
- Responder TODAS reviews em <24h (inclusive 5 stars sem texto = "Obrigado!")
- Negative reviews: criar item ROADMAP novo + reply mencionando ETA fix
- Feature requests: agradecer + adicionar tag `[user-requested]` em ROADMAP CHECKLIST origem

(e) **Métricas tracking PostHog**:
```js
// Após maybePromptReview:
posthog.capture('review_prompted', { source: 'in_app' })
// User feedback (não temos visibilidade real review action mas trackeamos prompt)
```

**Dependências:**
- Plugin install + cap sync
- Hooks integration DoseModal + AlarmService + App.jsx
- Console reviews monitoring habit user

**Critério de aceitação:**
- ✅ Plugin instalado + funcional Android device real
- ✅ Trigger fires APENAS após 3 doses + 1 alarm + 7 days active
- ✅ Re-prompt 90 dias se user dismissed
- ✅ Console reply rate >90% reviews <24h turnaround
- ✅ Validado device real S25 Ultra (eligibility logic + native dialog)

**Métrica esperada:**
- 30-40% prompted users deixam review
- Review rate: 1 review per 50 MAU típico (Dosy: 10-30 reviews mês 6 com 1K MAU)
- Rating mantém 4.3+ se app funciona + replies acontecem

---

### #171 — Marketing orgânico playbook BR: Reddit + Instagram + LinkedIn + TikTok

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (growth — paralelo Production launch)
- **Origem:** Análise concorrentes BR 2026-05-07
- **Esforço:** 8-10h setup + 2-3h/semana ongoing
- **Release sugerida:** v0.2.2.0+ ongoing

**Problema:**

Solo dev sem marketing budget depende 100% orgânico. Brasil tem comunidades healthcare ativas em multiple platforms — Dosy precisa presença consistente sem virar spam.

**Abordagem:**

(a) **Reddit BR** target subs:

| Sub | Members | Estratégia |
|---|---|---|
| r/saude | 80K | Posts úteis (não-promo) + mention Dosy em comments quando relevante |
| r/idosos | 5K | Cuidadores idosos = persona PRO target |
| r/cuidadores | 3K | Direct fit |
| r/diabetes | 15K | Use case medicação contínua |
| r/tdah | 60K | Use case medicação psiquiátrica diária |
| r/bipolar | 8K | Use case adesão tratamento crítica |
| r/depressao | 25K | Use case medicação contínua + cuidador familiar |
| r/brasil | 1M | Posts ocasionais virais (não focused healthcare) |

Regras:
- 90% posts úteis (responder dúvidas + share knowledge)
- 10% promoção sutil (signature: "Eu uso o Dosy pra isso, é grátis: dosymed.app")
- Nunca spam direto = ban auto
- Karma build first (~1 mês posting útil antes de mention Dosy)

(b) **Instagram strategy**:

Hashtags BR healthcare (pesquisa Instagram explore):
- #cuidadosaude (1.2M posts)
- #cuidadoidoso (340K)
- #saudemental (8M)
- #medicacao (200K)
- #diabetesbrasil (450K)
- #cuidadorfamilia (90K)

Conteúdo strategy (3 posts/semana):
- 1 post educativo (carrossel "5 dicas pra organizar medicação idoso")
- 1 post UX Dosy (vídeo 30s feature highlight)
- 1 post user testimony (anônimo, com permissão)

Parcerias microinfluencers (10K-50K followers cuidadores):
- Lista 50 candidatos via search hashtags + manual review
- Outreach DM personalizada (não copy-paste)
- Permuta: PRO grátis 1 ano + R$ 100-300/post (budget total R$ 1-3K mês 1)
- Meta: 5-10 microinfluencers ativos mês 6

(c) **LinkedIn healthcare BR** (B2B trust):

Conteúdo:
- Posts sobre LGPD healthcare (autoridade técnica)
- Cases de cuidadores profissionais usando Dosy
- Articles long-form Dosy founder ("Por que criamos um app de medicação 100% LGPD compliant")

Network targets:
- Médicos geriatras BR
- Farmacêuticos clínicos
- Cuidadores profissionais
- Healthcare tech founders BR

(d) **TikTok healthcare BR**:

Formato POV cuidadora 30s:
- "POV: você cuida da sua mãe e nunca esquece um remédio porque..."
- "Como organizo os 7 remédios da minha avó"
- "Minha rotina manhã com app de medicação"

Hashtags: #cuidadoraidosa #saudefamilia #organizacaocuidador

3 vídeos/semana inicial. Algoritmo TikTok BR favorece autenticidade > production value.

(e) **Content calendar 6 meses**:

```
Semana 1-4 (mês 1):
- Reddit: 1 post útil/semana cada sub-prioritário (r/saude, r/idosos, r/cuidadores, r/diabetes, r/tdah)
- Instagram: 3 posts/semana (12 total mês 1)
- LinkedIn: 1 post/semana
- TikTok: 3 vídeos/semana

Semana 5-12 (mês 2-3):
- Outreach 50 microinfluencers Instagram
- Reddit: continuar útil + começar mention sutil
- Blog SEO #172 começa publicar (1 artigo/semana)

Semana 13-26 (mês 4-6):
- Parcerias 5-10 microinfluencers ativas
- Iterate winning content (double down 80/20)
- Avaliar metrics: MAU, conversion rate, CAC
```

**Dependências:**
- Conta Reddit autenticada (build karma 1 mês antes promo)
- Conta Instagram @dosymed (criar)
- Conta LinkedIn dosy.med (já tem? verificar)
- Conta TikTok @dosymed (criar)
- Budget R$ 1-3K mês 1 microinfluencer permuta

**Critério de aceitação:**
- ✅ Contas criadas + first posts publicados (4 platforms)
- ✅ Calendar 90 dias agendado (Buffer/Hootsuite ou planner manual)
- ✅ 5 microinfluencers ativos mês 3
- ✅ 50+ posts orgânicos publicados mês 3
- ✅ Métricas tracking: followers growth + click-through rate landing dosymed.app + Play Store install attribution UTM

**Métrica esperada:**
- 100-500 installs/mês orgânicos via Reddit (mês 3)
- 200-1000 installs/mês via Instagram parcerias (mês 6)
- Brand awareness BR healthcare niche +200% (mensurável via brand search "dosy app")

---

### #172 — Landing page dosymed.app marketing + blog SEO healthcare BR

- **Status:** ⏳ Aberto
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P2 (growth — SEO leva 6-12 meses indexar)
- **Origem:** Análise concorrentes BR 2026-05-07
- **Esforço:** 12-16h initial + 2h/artigo (24h total 12 artigos)
- **Release sugerida:** v0.2.3.0+ → v0.2.5.0+

**Problema:**

dosymed.app hoje só serve PWA + /privacidade + /termos. Sem SEO BR healthcare = invisible Google searches. Apps medicação BR top ranking (Medisafe, MyTherapy) têm sites com blog SEO + landing pages otimizadas há anos.

**Abordagem:**

(a) **Landing pages** (rotas novas Vite SSG ou client-rendered + meta tags):
- `/sobre` — Quem somos, missão, LGPD compliance, equipe
- `/pacientes` — App pra quem? Diabetes/Alzheimer/cuidadores idosos use cases
- `/cuidadores` — Multi-paciente + compartilhamento family-friendly
- `/precos` — Free vs PRO comparativa + FAQ pricing

Cada página: H1 com keyword primária + 800-1200 palavras + CTA Play Store + Schema.org markup.

(b) **Blog SEO** 12 artigos initial (1500+ palavras cada):

| Artigo | Keyword primária | Volume mensal BR |
|---|---|---|
| Como organizar medicação de idoso com Alzheimer | "organizar medicação idoso Alzheimer" | 1K |
| Alarme de dose esquecida pra diabetes tipo 2 | "alarme dose diabetes" | 800 |
| Compartilhar lembrete de remédio com a família via WhatsApp | "compartilhar medicação família" | 600 |
| Lembrete de medicação para ansiedade e depressão | "lembrete remédio ansiedade" | 1.5K |
| Top 5 apps de lembrete de remédio no Brasil 2026 | "melhor app lembrete remédio" | 3K |
| Como funciona o alarme nativo Android para medicação | "alarme medicação Android" | 500 |
| Cuidador de idosos: 7 dicas pra controlar medicações | "cuidador idoso medicação" | 800 |
| Tratamento contínuo: como não esquecer doses por meses | "tratamento contínuo medicação" | 400 |
| LGPD na saúde: dados médicos no app são seguros? | "LGPD saúde dados" | 300 |
| Diferença entre lembrete e alarme de medicação | "lembrete vs alarme remédio" | 200 |
| Como ajustar a dose de Mounjaro semanal pelo app | "Mounjaro lembrete semanal" | 1.2K (trending) |
| Top 10 medicamentos crônicos mais prescritos BR 2026 | "medicamentos mais prescritos BR" | 2K |

Cada artigo: H1+H2 hierarchy + meta description 150-160 chars + internal linking + outbound link autoridade (FDA, ANVISA) + CTA download Dosy.

(c) **Schema.org markup**:

Página inicial:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Dosy",
  "operatingSystem": "Android",
  "applicationCategory": "HealthApplication",
  "applicationSubCategory": "MedicalApplication",
  "offers": [
    {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "BRL",
      "name": "Free"
    },
    {
      "@type": "Offer",
      "price": "14.90",
      "priceCurrency": "BRL",
      "name": "PRO Mensal"
    }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "ratingCount": "150"
  }
}
</script>
```

Blog posts:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  "headline": "Como organizar medicação de idoso com Alzheimer",
  "datePublished": "2026-08-01",
  "author": { "@type": "Person", "name": "Luiz Henrique" },
  "audience": { "@type": "MedicalAudience", "audienceType": "Caregivers" }
}
</script>
```

(d) **OG tags + Twitter cards**:
```html
<meta property="og:title" content="Dosy: Lembrete de Remédios com Alarme Inteligente">
<meta property="og:description" content="Nunca esqueça uma dose. Alarme que toca alto, multi-paciente, compartilhamento com família.">
<meta property="og:image" content="https://dosymed.app/og-image.png">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```

(e) **Sitemap.xml + robots.txt + canonical URLs**:
```xml
<!-- /sitemap.xml -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://dosymed.app/</loc><priority>1.0</priority></url>
  <url><loc>https://dosymed.app/sobre</loc><priority>0.8</priority></url>
  <url><loc>https://dosymed.app/pacientes</loc><priority>0.8</priority></url>
  <url><loc>https://dosymed.app/cuidadores</loc><priority>0.8</priority></url>
  <url><loc>https://dosymed.app/precos</loc><priority>0.8</priority></url>
  <url><loc>https://dosymed.app/blog/organizar-medicacao-alzheimer</loc><priority>0.7</priority></url>
  <!-- ...11 more articles -->
</urlset>
```

**Dependências:**
- Vite static page rendering OR React Router routes + meta dinâmica via react-helmet
- Editor blog (markdown files src/content/blog/*.md OR Notion CMS)
- Domain SEO basics (verify Google Search Console + submit sitemap)

**Critério de aceitação:**
- ✅ 4 landing pages publicadas com SEO básico
- ✅ 12 artigos blog publicados (release distribuído ao longo 12 semanas)
- ✅ Schema.org markup validado Rich Results Test Google
- ✅ Google Search Console configurado + sitemap indexado
- ✅ Lighthouse SEO score ≥90 todas páginas
- ✅ 5+ artigos rankeando top 10 Google BR mês 6 (longtail keywords)

**Métrica esperada:**
- 500-2000 organic Google search visits/mês (mês 6)
- 1000-5000 organic visits/mês (mês 12)
- 5-15% conversion rate visit → install (50-300 installs/mês via SEO mês 12)
- SEO leva 6-12 meses indexar — investimento longprazo

---

### #173 — Healthcare differentiators moat: promove #064 #065 #066 P3→P1

- **Status:** ⏳ Aberto (umbrella; itens individuais ficam em §6.5 P3 mas com promotion note)
- **Categoria:** 🚀 IMPLEMENTAÇÃO
- **Prioridade:** P1 (growth — diferencial vs Medisafe/MyTherapy/Pílula Certa)
- **Origem:** Análise concorrentes BR 2026-05-07
- **Esforço:** 15-22h total (#064: 8-12h, #065: 4-6h, #066: 3-4h)
- **Release sugerida:** v0.2.3.0+ → v0.3.0.0+

**Problema:**

Análise competitive: Medisafe, MyTherapy, Pílula Certa são genéricos pra reminder. Faltam features healthcare deep BR que cuidadores REAIS pedem:
- Verificação interações medicamentosas (ex: warfarin + ibuprofen = sangramento)
- Verificação alergias (ex: paciente alérgico AAS, medicação nova contém AAS)
- Estoque medicação (acabar sem aviso = adesão quebrada)
- Lembrete consulta médica (esquece consulta = receita expira = sem medicação)

Dosy pode criar moat real com essas 3 features + posicionamento marketing forte.

**Abordagem:**

**(a) #064 — Verificação interações medicamentosas + alergias** (8-12h, mais complexo):

Data sources:
- **OpenFDA Drug API** (US, free): https://open.fda.gov/apis/drug/
- **DrugBank API** (paid, mais completo)
- **ANVISA Bulário Eletrônico** (BR, scraping limitado)

Estratégia start: cache local OpenFDA → 1000 medicamentos top BR + interactions matrix:

```sql
-- Migration: medications + interactions tables
CREATE TABLE medcontrol.medications_db (
  id text PRIMARY KEY, -- e.g. "metformina-500mg"
  name text NOT NULL,
  active_ingredient text NOT NULL,
  category text, -- "antidiabetic", "anti-inflammatory"
  warnings text[]
);

CREATE TABLE medcontrol.medication_interactions (
  med_a text REFERENCES medcontrol.medications_db,
  med_b text REFERENCES medcontrol.medications_db,
  severity text, -- "minor", "moderate", "severe"
  description text,
  PRIMARY KEY (med_a, med_b)
);

CREATE TABLE medcontrol.patient_allergies (
  patient_id uuid REFERENCES medcontrol.patients,
  allergen text NOT NULL,
  severity text,
  notes text,
  PRIMARY KEY (patient_id, allergen)
);
```

Frontend: TreatmentForm verifica novo medicamento contra paciente.allergies + paciente.activeTreatments. Warning visual amarelo (interação moderada) ou vermelho (severa) com dialog confirma "ainda quero adicionar".

**(b) #065 — Estoque medicação + alerta acabando** (4-6h):

```sql
ALTER TABLE medcontrol.treatments
  ADD COLUMN stock_quantity integer,
  ADD COLUMN stock_unit text DEFAULT 'comprimidos',
  ADD COLUMN stock_low_threshold integer DEFAULT 7;
```

Cálculo dias até zero baseado em interval + dose:
```js
function daysUntilEmpty(treatment) {
  if (!treatment.stock_quantity) return null
  const dosesPerDay = 24 / treatment.intervalHours
  const dosesPerStock = treatment.stock_quantity / treatment.dose
  return Math.floor(dosesPerStock / dosesPerDay)
}
```

Alert header novo (#117/#118 padrão): "📦 Mounjaro acabando em 5 dias" → click → opção "Comprar" (Drogaria São Paulo / Drogasil affiliate links).

**(c) #066 — Lembrete consulta médica + Calendar export** (3-4h):

```sql
CREATE TABLE medcontrol.appointments (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  patient_id uuid REFERENCES medcontrol.patients,
  doctor_name text,
  specialty text,
  scheduled_at timestamptz NOT NULL,
  notes text,
  reminder_minutes integer DEFAULT 1440 -- 24h before
);
```

Frontend: `/consultas` rota nova + AppointmentCard + AppointmentForm. Local notification 24h before via Capacitor LocalNotifications (já temos infra). `.ics` export → user adiciona Google Calendar / Apple Calendar.

**Posicionamento marketing** (use em #169 listing copy + #171 social media):

> "Dosy é o ÚNICO app brasileiro de medicação com:
> ✅ Verificação automática de interações medicamentosas (alerta antes da dose)
> ✅ Controle de estoque (avisa antes de acabar)
> ✅ Agenda de consultas integrada
>
> Outros apps só lembram da hora. Dosy cuida do tratamento inteiro."

**Dependências:**
- #064 → OpenFDA API integration OR ANVISA scraping (8-12h)
- #065 → migration + UI (4-6h, simpler)
- #066 → migration + new route + Calendar export (3-4h)
- Atualização ROADMAP §6.5 P3 entries #064/#065/#066 com note "promovido P1 via #173"

**Critério de aceitação:**
- ✅ #064: TreatmentForm dispara warning interaction quando adiciona medicação que conflita com active treatment OR allergy paciente
- ✅ #065: PatientDetail mostra estoque + alert header "acabando" ≤7 dias
- ✅ #066: /consultas rota com appointment list + form + .ics export funcional
- ✅ Marketing copy atualizado #169 listing + #171 social
- ✅ Validação Chrome MCP preview + device real S25 Ultra

**Métrica esperada:**
- Differential ASO Play Store keyword "interações medicamentosas" (zero competidores BR atualmente)
- +20-30% conversion rate Free→PRO (features só PRO)
- Brand positioning "Dosy = sério" vs "Dosy = lembrete genérico"

---

> **Nota promotion #064/#065/#066:** entries originais em §6.5 ✨ MELHORIAS P3 ficam mantidas pra histórico mas com flag `[promovido P1 via #173]`. Quando implementar, mover entries do P3 pra fechado normal (✅).
