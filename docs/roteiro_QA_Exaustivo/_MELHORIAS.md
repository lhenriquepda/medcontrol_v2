# 💡 _MELHORIAS.md — Sugestões e cobertura faltante QA v0.2.6.6

> Achados durante QA exaustivo automatizado (passes 1+2 CDP+adb UiAutomator2 + tentativa Appium W3C). Inclui melhorias UX/UX/DX descobertas + lista de cenários ainda não testados que exigem QA manual ou novo runner.

---

## 🚀 Melhorias sugeridas (descobertas no QA)

### #MEL-001 — `data-testid` em components-chave reduziria fragilidade de QA automatizado

**Origem**: durante automação, várias buscas precisaram cair em fallbacks (`Array.from(querySelectorAll('button')).find(b => /regex/.test(b.innerText))`) porque elementos críticos não têm seletor estável.

**Components que se beneficiariam de `data-testid`**:
- `MedNameInput` (trigger button + sheet container + search input + suggestion items)
- `CategoryPicker` (trigger + items + error hint)
- `DoseCard` (root + Tomada button + Pular button + swipe area + observation collapse)
- `MultiDoseModal` (root + per-dose item + per-dose busy state)
- `AlertLevelToggle` (3 chips Crítico/Push/Silencioso)
- `PaywallModal` (root + CTA + close)
- `OnboardingTour` (slide indicator + next/skip)
- `PermissionsOnboarding` (per-permission card + accept/ignore)
- `ConsentBanner`/`Telemetria card` (accept + decline)
- `SharePatientSheet` (TTL chips + access level radios)
- `PullToRefreshOverlay` (root)
- `LockedOverlay` (root + tier blocker)

**Esforço**: baixo (~30min por component, total ~6h)

**Benefício**: cuts QA automation time pela metade + permite Appium/Selenium tests determinísticos.

---

### #MEL-002 — Documentar/expor `window.__dosy*` debug toggles em `context/recipes/`

Durante o QA descobri 4 toggles globais usados internamente:
- `window.__dosyAdMobShown` (boolean)
- `window.__dosySystemStatusBarHeight` (px)
- `window.__dosyForceUpdate` (citado em STATE.md)
- `window.__dosyForceMandatory` (citado)
- `window.__dosyForceFallback` (citado)
- `window.__dosyOnline` (não definido — null em ambos emul, mas usado em probe)
- `window.__dosyPendingPatientId` / `__dosyPendingUnsharePatientId` (cold-start handlers)

**Sugestão**: criar `context/recipes/debug-toggles.md` listando todos toggles + quando usar.

**Esforço**: baixo (~30min)

---

### #MEL-003 — BUG #E04 fix: condicional `medName.length > 0` no CategoryPicker error

**Origem**: #QA-003 no `_BUGS.md`. Mensagem "Escolha uma categoria — não conseguimos detectar pelo nome" aparece prematuramente.

**Fix sugerido (mínimo invasivo)**:
```jsx
// src/components/CategoryPicker.jsx
{(form.medName?.trim().length > 0 && !classifyResult && !manualCategory) && (
  <p className="text-red-600 text-sm">Escolha uma categoria — não conseguimos detectar pelo nome.</p>
)}
```

**Esforço**: baixo (~15min + smoke test)

---

### #MEL-004 — Fix #QA-001: extender `RequireTier` para `/relatorios`

**Origem**: #QA-001 no `_BUGS.md`. Free acessa `/relatorios` sem paywall.

**Fix sugerido**:
```jsx
// src/App.jsx (ou route config)
<Route path="/relatorios" element={
  <RequireTier tier="plus" fallback={<LockedOverlay feature="Relatórios" />}>
    <Reports />
  </RequireTier>
} />
```

OU se já existe wrapper Analytics — replicar mesma lógica em Reports.

**Esforço**: baixo (~30min + smoke test)

---

### #MEL-005 — Pull-to-refresh com gesto via adb swipe (test helper)

Adicionar ao `scripts/qa-v0266/cdp.mjs` helper:
```js
export async function ptrSwipe(adbSerial) {
  const { execSync } = await import('child_process')
  execSync(`adb -s ${adbSerial} shell input swipe 540 400 540 1400 300`)
}
```

Permite testar §4.9 (PtR) e §11 (offline scroll) em runner Appium/CDP.

**Esforço**: baixo (~15min + 5 testes Mod 04+07+11)

---

### #MEL-006 — Add `e2e/` dir com Appium tests reusáveis

Estrutura sugerida:
```
e2e/
  ├── package.json           # webdriverio + @wdio/appium-service
  ├── wdio.conf.mjs          # 2 capabilities (5554+5556)
  ├── helpers/
  │   ├── auth.mjs           # loginAs(driver, email)
  │   ├── webview.mjs        # inWebView(driver, fn)
  │   ├── dismissTour.mjs
  │   └── adbWrap.mjs        # tap/swipe/keyevent via adb
  └── specs/
      ├── 01-auth.spec.mjs
      ├── 02-patients.spec.mjs
      ├── ...
      └── 13-edge.spec.mjs
```

Substitui scripts ad-hoc atuais por suite estruturada (npm run e2e).

**Esforço**: médio (~8-16h pra setup + portar 13 mods atuais)

---

### #MEL-007 — Pre-criar dados de teste idempotentemente via SQL antes de QA

`docs/roteiro_QA_Exaustivo/00-setup.md §0.7` lista dados base mínimos. Mas pre-existem dados antigos das contas teste que confundem QA (Free com "Paciente Free 1" + "Paciente Share LH", Plus com "Paciente Share LH" só).

**Sugestão**: script `scripts/qa-v0266/reset-test-data.sql`:
```sql
-- Limpa todas doses+treatments+patients_shares+patients das 3 contas teste
DELETE FROM medcontrol.doses WHERE "userId" IN (SELECT id FROM auth.users WHERE email LIKE 'teste-%@teste.com');
DELETE FROM medcontrol.treatments WHERE "userId" IN (...);
DELETE FROM medcontrol.patient_shares WHERE "ownerId" IN (...);
DELETE FROM medcontrol.patients WHERE "userId" IN (...);

-- Re-cria dados base canônicos
INSERT INTO medcontrol.patients ("userId", name, avatar, age) VALUES
  ((SELECT id FROM auth.users WHERE email='teste-plus@teste.com'), 'Paciente QA Plus', '🙂', 30),
  ((SELECT id FROM auth.users WHERE email='teste-free@teste.com'), 'Paciente QA Free', '👵', 65);

-- Pre-cria tratamento Escitalopram 24h teste-plus
-- (precisa usar RPC create_treatment_with_doses pra gerar doses)
```

Roda antes de cada QA run pra estado consistente.

**Esforço**: médio (~2-4h SQL + validação)

---

### #MEL-008 — Capacitor `appium:autoWebview` capability poderia simplificar QA hybrid

Em `appium-runner.mjs` linha 41, capability `appium:autoWebview: false` força código a usar `driver.switchContext()` toda call. 

Alternativa: `appium:autoWebview: true` + `appium:browserName: 'chromedriver'` faria sessão WEBVIEW automática + Selenium-style finds funcionariam sem hybrid switch.

Trade-off: perde acesso a `mobile:` commands (clickGesture nativo, swipeGesture).

**Sugestão**: investigar híbrido com 2 drivers em paralelo (1 WEBVIEW pra DOM ops, 1 NATIVE pra touch).

**Esforço**: médio (~4-6h pesquisa Appium docs + spike).

---

### #MEL-009 — Adicionar `pm clear` no runner antes de Mod 01

Roteiro `§1.1` espera ConsentBanner em fresh launch. Pra isso QA precisa:
```bash
adb -s emulator-5554 shell pm clear com.dosyapp.dosy.dev
```

E re-launch antes do test Mod 01.

**Sugestão**: helper `resetAppData(adbSerial)` em `cdp.mjs` + `appium-runner.mjs` chama no início de Mod 01 RUN.

**Esforço**: baixo (~15min + 1 teste)

---

### #MEL-010 — Add CI workflow GitHub Actions roda QA pre-merge

```yaml
# .github/workflows/qa-android.yml
name: QA Android Smoke
on: [pull_request]
jobs:
  qa-emulator:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 35
          arch: x86_64
          script: |
            adb install -r -t app-debug.apk
            npm install
            node scripts/qa-v0266/qa-exaustivo.mjs
            # fail se report.json.bugs.length > 0
```

Catches regressões antes de mergear.

**Esforço**: alto (~16-24h setup CI + headless emulator + secrets keystore).

---

### #MEL-011 — Decisão sobre #QA-004: ConsentBanner como step do tour vs banner separado

Atual: telemetria opt-in está dentro do PermissionsOnboarding modal como card "Telemetria anônima".

Trade-offs:
- **Pró atual (integrado)**: user vê tudo de uma vez, menos clutter, mais consentual (junto com permissões)
- **Contra atual**: docs/roteiro esperam banner separado (precisa atualizar `01-auth-onboarding.md §1.1`); usuário pode pular tour e nunca ver consent → telemetria nunca init (bom pra LGPD mas ruim pra produto)

**Sugestão**: confirmar decisão com PO, atualizar docs OU mover para banner standalone se Decision = aceito sair.

---

### #MEL-012 — Free counter "1/1 paciente" deveria virar CTA proeminente

Atual visibleText em Free `/pacientes`: "Plano Free: 1/1 paciente. Conhecer Pro"

Sugestão UX:
- Mudar "Conhecer Pro" pra botão amarelo/laranja "Desbloquear Plus →" mais clicável
- Adicionar mini-stats "Você poderia gerenciar +N pacientes em Plus"

**Esforço**: baixo (~30min design + impl)

---

## 📋 Cobertura faltante — QA NÃO executado

Cenários do roteiro que exigem retomada (manual ou novo runner):

### 🔴 Crítico (P0/P1 healthcare/billing)

| Mod | Item | Razão de não-execução |
|---|---|---|
| 01.4 | Signup nova conta completo | Exige email único + consentir LGPD + check-email |
| 01.5 | Forgot password OTP 6 dígitos | Exige acesso ao inbox `teste-*@teste.com` |
| 01.10 | Logout limpa sessão | Não testado para evitar invalidar QA states |
| 01.12 | AppLock biometria (`emu finger touch 1`) | Não testado |
| 02.8 | Excluir paciente cascata + Undo 5s | Não testado |
| 03.11/3.12 | Pausar/Retomar tratamento + cancel/recreate alarmes | Não testado |
| 03.13 | Encerrar tratamento (irreversível) | Não testado |
| 03.14 | AlertLevelToggle (Crítico/Push/Silenc.) por tratamento + por dose | Não testado — UI presente, fluxo end-to-end pendente |
| 04.5 | DoseCard swipe (não direct click) | Tentado mas `tomadaButtons` retornou 0 no pass 2 (sem doses pendentes visíveis pós-mark) |
| 04.5 | Undo 5s funcional + BD revert | Não testado |
| 04.7 | MultiDoseModal busy state per-dose + auto-close + bug #0020 | Não testado |
| 04.9 | Pull-to-refresh barrier mutation + extend_continuous_treatments RPC | Não testado (no adb swipe helper) |
| 06.1-6.24 | **TODA validação real de alarmes** (disparar, Ciente, Adiar, BootReceiver, FCM caregiver) | Exige adiantar relógio device + tela bloqueada + esperar real |
| 07.6 | Export PDF/CSV download via share sheet nativo | Não testado |
| 08.* | **TODO compartilhamento A→B real cross-device** | Exige Plus invitar Free, Free aceitar, ambos verem mesmo paciente, cancelDose race condition |
| 09.13 | Export JSON LGPD (Art.15) | Não testado |
| 09.14 | **Excluir conta LGPD (Art.18 VI)** | Não testado — exige conta descartável |
| 11.2 | Mutation queue offline + drain ao reconectar | Não testado — exige airplane mode toggle real |
| 11.6 | flushPersistImmediate em force-kill | Não testado |
| 12.* | **Race conditions multi-device** (dose simultanea 2 emul + ConflictListener 409) | Não testado |

### 🟡 Importante (P2 UX)

| Mod | Item | Razão |
|---|---|---|
| 02.3 | Avatar scroll horizontal vs tap acidental | Não testado — exige Appium TouchAction multi-step |
| 02.4 | Upload foto + crop (camera + galeria) | Não testado — exige file picker nativo |
| 02.6 | PrivacyScreen mascara Recents + bloqueia screenshot | Não testado |
| 03.2 (CRÍTICO) | Scroll vertical lista CMED sem tap acidental | Não testado — exige TouchAction `swipe` real |
| 03.2 | Scroll com teclado aberto não fecha sheet | Não testado |
| 04.5 | DoseCard swipe direita/esquerda + threshold | Não testado (precisaria swipe gesture) |
| 06.8 | DND cross-midnight (23h→07h, dose 02:00) | Não testado |
| 07.6 | Export PDF + range muito grande (1 ano + 500+ doses) | Não testado |
| 11.10 | useAppResume F1+F2+F3+watchdog 5s timeout | Não testado (sem KEYCODE_HOME + bg long) |
| 13.* | Rotação portrait/landscape | Não testado |
| 13.7 | TalkBack accessibility | Não testado |
| 13.20 | Fast tap aria-busy bloqueia double-submit | Não testado |

### 🟢 Nice-to-have (P3/P4)

| Mod | Item |
|---|---|
| 02.5 | Campos extra paciente (peso vírgula vs ponto, emoji em nome) |
| 03.9 | Templates de tratamento salvar/usar |
| 03.16 | Auto-detect "auto-ended" tratamento finito ontem |
| 05.12 | SOS opioide/corticoide warning extra |
| 10.11 | Upgrade flow end-to-end (Stripe/Play Billing) — `⏭️ Skip se billing não dev` |

---

## 🛠️ Ações concretas recomendadas (priorizadas)

1. **#MEL-004** + **#QA-001** (P1): adicionar gate `/relatorios` — protege revenue (~30min)
2. **#MEL-003** + **#QA-003** (P3): fix BUG #E04 condicional categoria — limpa UX (~15min)
3. **#MEL-007** SQL reset test data: idempotência QA + reproducibility (~2-4h)
4. **#MEL-001** data-testid: viabiliza Appium completo (~6h)
5. **#MEL-006** e2e/ suite Appium: cobertura crescente automática (~16h iniciais)
6. **#MEL-010** CI workflow: catch regressões pre-merge (~16h)

Total estimado fase 1 (#MEL-003+004+007): **~3-5h** pra alta-alavancagem.

---

## 📊 Resumo estatístico

| Métrica | Valor |
|---|---|
| Bugs P0 encontrados | 0 |
| Bugs P1 encontrados | 1 (#QA-001 paywall /relatorios) |
| Bugs P2 encontrados | 1 (#QA-002 MedSearch sheet Free) |
| Bugs P3 encontrados | 3 (#QA-003 E04 + #QA-004 ConsentBanner + #QA-005 telemetria text leak) |
| Bugs P4 encontrados | 0 |
| **Total bugs** | **5** |
| Melhorias propostas | 12 (#MEL-001 a #MEL-012) |
| Mods cobertos via probe automatizado | 13/13 |
| Cobertura passos estimada | ~15-20% do roteiro completo |
| Cobertura passos crítica restante | ~80% (alarmes reais + cross-device + LGPD + offline) |
| Validações positivas | ~35 (login, navegação, badges, AdMob, RPC, etc) |

---

## 🆕 Melhorias adicionais — QA real interativo (sessão 2026-05-24 13:30-13:50 BRT)

### #M-realq1 — Banner AdMob com gap visual ao topo

**Sintoma**: Banner Ad ("Test Ad") fica deslocado do topo da área útil — há gap visível entre status bar do sistema e o banner. Vide `docs/qa-reports/qa-real-v0266/06-post-tour.png`.

**Sugestão**: Auditar CSS `--ad-banner-height` + `--system-status-bar-height` em `useAdMobBanner.js` para detectar dupla margem. Considerar position:sticky.

Cross-ref: BUG #B001 + #E01 do qa-dinamico v0.2.6.6.

---

### #M-realq2 — Hit area dos botões em MultiDoseModal pequena demais

**Sintoma**: Durante este QA, primeiro tap em botão "Tomada" no MultiDoseModal caiu na área entre botões/card e modal fechou sem marcar.

**Sugestão**:
- Aumentar padding dos botões pra 48dp altura mínima (Material Design)
- Confirmar fechamento se há doses pending: "Você tem 2 doses não marcadas. Fechar mesmo assim?"

---

### #M-realq3 — Toast Undo "Desfazer" não persiste tempo suficiente

**Sintoma**: Toast "Dose confirmada. Desfazer ✕" desaparece em ~5s. Pra dose marcada errada, tempo curto demais.

**Sugestão**: estender Undo janela pra 8-10s. Ou persistir banner Undo no topo do Dashboard até user dismiss ou nova ação.

---

### #M-realq4 — Logcat `Capacitor/AdMob: No listeners found` é poluição alta

**Sintoma**: Cada refresh AdMob (vezes 3 por carga) gera log "No listeners found for event bannerAdSizeChanged" — confirma bug E01.

**Sugestão**: corrigir typo `bannerAdSize` → `bannerAdSizeChanged` em `useAdMobBanner.js:98`. Resolve E01 + reduz ruído.

---

### #M-realq5 — Mensagem de erro alarme genérica demais

**Sintoma**: `CriticalAlarmPlugin.scheduleGroup` falha com mensagem `"schedule failed (past trigger or permission)"` — agrupa 2 causas distintas.

**Sugestão**: separar erros: `past_trigger`, `too_close_threshold_30s`, `permission_denied_exact_alarm`. Cada um com action sugerida pro user.

Cross-ref: BUG #B100.

---

### #M-realq6 — App leva >5s pra mostrar Dashboard após force-stop+restart

**Sintoma**: Force-stop + start → ~5s de "Carregando..." em branco antes do Dashboard aparecer (ActivityTaskManager log: `Displayed +5s510ms`).

**Sugestão**:
- Pre-fetch dashboard_payload em paralelo com auth check
- Skeleton states em vez de "Carregando..."
- Optimistic UI: cache antigo enquanto carrega fresh

---

### #M-realq7 — Botão "Cadastrar primeiro paciente" muito próximo do BottomNav

**Sintoma**: Em empty state, CTA principal fica ~50px acima do BottomNav — tap baixo pode pegar BottomNav errado.

**Sugestão**: margin-bottom 24px+ ou reposicionar CTA mais alto.

---

### #M-realq8 — Falta indicador "atrasada há X minutos"

**Sintoma**: Card mostra apenas "13:40 atrasada" — não diz há quanto tempo. Severidade visual igual pra 5min e 5h de atraso.

**Sugestão**: adicionar subtítulo "há 12 min" / "há 2h" / "há 1 dia". Cores mais intensas conforme tempo.

---

### #M-realq9 — Cron `extend_continuous_treatments` não roda automaticamente

**Sintoma**: Logcat não mostra chamada periódica do RPC. Vide spec G19 + Cron L9.

**Sugestão**: validar pg_cron config ou expor "Última sincronização" em Settings.

---

### #M-realq10 — Bug #B102 P0 catastrófico — DoseModal Tomada/Pular não persiste no BD

**Sintoma**: este QA confirmou que mutations `confirmDose` / `skipDose` UI são otimistas mas NÃO disparam o POST `/rpc/confirm_dose_v2` ao Supabase. Bug é DETERMINÍSTICO, acontece TODO clique.

**Sugestão**: ver `_BUGS.md#B102` para detalhes técnicos completos. Aplicar fix em `mutationRegistry.js` + `dosesService.js` urgente.

---

Total adicional QA real: **10 melhorias** + cross-ref pra bugs descobertos no mesmo passo.

---

## 🟢 STATUS FIX v0.2.6.7 (commit 3c58767 + migration 20260524150000)

### Implementadas v0.2.6.7

| ID | Status | Detalhe | Commit |
|---|---|---|---|
| **E01** (M-realq4) | 🟢 FIX | `useAdMobBanner.js` event name typo corrigido — `bannerAdSize` → `bannerAdSizeChanged`. Resolve B001 (gap visual) também porque altura agora atualiza dinamicamente. | `3c58767` |
| **E02** | 🟢 FIX | Migration `20260524150000_v0_2_6_7_get_user_medications_rpc.sql` cria RPC ausente. Categorias custom do user vão funcionar pela primeira vez. | `b0b4152` |
| **E04** (M-realq2 indireto) | 🟢 FIX | `CategoryPicker.jsx` prop `showRequiredError` (default false). SOS + TreatmentForm passam `showRequiredError={!!medName}` — mensagem não aparece mais premature. | `3c58767` |
| **M-realq3** | 🟢 FIX | Toast Undo 5s→8s (`useToast.jsx`). Tempo suficiente pra reagir após marcação errada. | `f475836` |
| **M101** | 🟢 FIX | Dashboard range default 12h→24h (`Dashboard.jsx`). Dia completo visível ao abrir o app. | `f475836` |
| **M201** (M-realq5) | 🟢 FIX | `CriticalAlarmPlugin.java` separa 3 causas distintas: `permission_denied_exact_alarm` (Android 12+ canScheduleExactAlarms false), `too_close_threshold_60s_fallback_tray` (deltaSec<60), `past_trigger`. Mensagem genérica `"schedule failed (past trigger or permission)"` eliminada. | `cc7a383` |
| **M500** (M-realq8) | 🟢 FIX | Nova função `overdueLabel(scheduledAt)` em `dateUtils.js` + uso em `DoseCard.jsx`. Labels proporcionais: `atrasada 5min` / `atrasada 2h` / `atrasada 1d`. Resolve severidade visual igual entre atraso pequeno vs grande. | `cc7a383` |

## 🟢 STATUS FIX v0.2.6.8 (UX quick wins follow-up)

### Implementadas v0.2.6.8

| ID | Status | Detalhe |
|---|---|---|
| **MEL-004** (#QA-001) | 🟢 FIX | `Reports.jsx` — Card prominent no topo "Exportar PDF/CSV é recurso Plus" + CTA "Conhecer Plus" antes do user navegar até botões. Free entende upfront que tem gate. |
| **MEL-012** | 🟢 FIX | `Patients.jsx` — Counter Free expandido pra 2 linhas com badge "Plus →" destacado + descrição "libera ilimitados + share + relatórios". Antes era 1 linha discreta. |
| **M-realq7** | 🟢 FIX | `dosy/EmptyState.jsx` — `action` marginTop 4→12 + marginBottom 4. Padding visual entre CTA empty state e BottomNav. |
| **M600** | 🟢 FIX | `dosy/BottomNav.jsx` — Badge vermelho com count de shares recebidos sobre ícone Pacientes. `useReceivedShares` já tem staleTime 5min (zero egress extra). |
| **M102** | 🟢 FIX | `PullToRefreshOverlay.jsx` — Estado "✓ Atualizado" por 1200ms após refresh completar. Antes user via spinner sumir abruptamente. |
| **MEL-005** | 🟢 FIX | `scripts/qa-v0266/cdp.mjs` — Helper `ptrSwipe(adbSerial)` via adb input swipe. Permite testar §4.9 PtR e §11 offline scroll. |
| **MEL-009** | 🟢 FIX | `scripts/qa-v0266/cdp.mjs` — Helper `resetAppData(adbSerial, pkg)` via pm clear + monkey launcher. Garante ConsentBanner fresh em Mod 01.1. |
| **MEL-002** | 🟢 FIX | `context/recipes/debug-toggles.md` — Tabela completa dos 8 toggles `window.__dosy*` + cenários comuns + como inspecionar release build via chrome://inspect. |
| **MEL-007** | 🟢 FIX | `scripts/qa-v0266/reset-test-data.sql` — Reset idempotente das 3 contas teste-* + seed canônico (Plus/Pro 1 patient cada, Free 0 patients). |

### Diferido (próximos releases — escopo > pragmatic time)

| ID | Esforço estimado | Bloqueador / Rationale |
|---|---|---|
| **MEL-001** data-testid em ~12 components | ~6h | Alta refactor surface — só compensa quando MEL-006 (e2e/) for criada. Sem suite consumindo, ROI baixo. |
| **MEL-006** estrutura `e2e/` Appium reusável | ~16h | Setup wdio + 13 specs portados. Bloqueado por MEL-001 (data-testid) pra reduzir flakiness. |
| **MEL-008** Capacitor `autoWebview` research | ~4-6h | Spike investigativo sem garantia de ganho. Atual hybrid switch funciona — diminishing returns. |
| **MEL-010** CI workflow QA pre-merge | ~16-24h | Setup emulator headless + secrets Play Store + keystore via base64. Quase release process completa. |
| **MEL-011** ConsentBanner decision | PO call | Decisão de produto: integrar no Permissions ou banner standalone. Não é dev decision. |
| **M-realq2** DoseModal hit area | parcial | aria-busy timeout reset (v0.2.6.7) já cobre maioria. Aumentar padding requer test de regressão em todos os modais. |
| **M-realq6** Skeleton states Dashboard | médio | Depende de pre-fetch dashboard_payload em paralelo com auth check — exige refactor de bootstrap. |
| **M-realq9** pg_cron `extend_continuous_treatments` | observability | Não é fix, é validação. Requer monitoring em prod (Sentry/PostHog evento) — não código. |
| **M001** AdMob banner gap | RESOLVIDO | B001 já fechado via E01 fix (event typo). Linha histórica. |

**Acompanhamento**: `docs/qa-reports/qa-real-v0266/_BUGS.md` lista bugs P0; este arquivo trata UX/melhorias.
