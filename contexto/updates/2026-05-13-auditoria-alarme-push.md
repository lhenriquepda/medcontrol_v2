# Auditoria sistema Alarme + Push — 2026-05-13

> **Sessão:** ~16:30 – 19:20 BRT · **Agente:** Claude Opus 4.7 · **Versão app:** master @ v0.2.2.4 (vc 62) → próxima `release/v0.2.3.0`

---

## 🎯 Objetivo da sessão

User pediu auditoria ponta-a-ponta de 100% do código relacionado a Alarme + Push. Sem pular nenhum arquivo ou linha. Gerar relatório com fluxo real, bugs encontrados, sugestões de melhoria. Depois, com base na auditoria, refatorar tudo seguindo plano de 3 cenários proposto pelo user.

## ✅ O que foi feito

### Fase 1 — Auditoria (branch `docs/auditoria-alarme-push`)

Varredura completa cobrindo:

- **11 arquivos Java native** (plugin CriticalAlarm): CriticalAlarmPlugin, AlarmScheduler, AlarmReceiver, AlarmService, AlarmActivity, AlarmActionReceiver, BootReceiver, DoseSyncWorker, DosyMessagingService, AlarmAuditLogger, MainActivity.
- **JS notifications** (5 arquivos `services/notifications/*`) + `criticalAlarm.js` + `mutationRegistry.js`.
- **Hooks core**: useAuth, useRealtime, useUserPrefs, useAppResume, usePushNotifications.
- **App.jsx + Dashboard.jsx + PermissionsOnboarding + Settings sections**.
- **6 Edge Functions** (5 locais lidas + `daily-alarm-sync` deployed-only puxada via Supabase MCP `get_edge_function`).
- **22 migrations DB** confirmadas via Supabase MCP `list_migrations`.
- **Cron jobs** ativos via `cron.job` SQL.
- **AndroidManifest** + `capacitor.config.ts` + `build.gradle` + `public/sw.js`.

**Relatório:** [`contexto/auditoria/2026-05-13-alarme-push-auditoria.md`](../auditoria/2026-05-13-alarme-push-auditoria.md) — 563 linhas. Cobre:

- §1 Inventário completo
- §2 Fluxo real ponta-a-ponta (4 cenários ASCII)
- §3 Mapa dependências cruzadas
- §4 19 bugs/riscos priorizados P0→P3
- §5 Sugestões de melhoria priorizadas
- §6 Conclusão + métricas observáveis via `alarm_audit_log`

**Bugs P0 críticos identificados:**

- **B-01** Janela DnD virou zona de silêncio total pós #209 — `dose-trigger-handler` e `daily-alarm-sync` filtram fora doses na janela DnD, e o cron `notify-doses-1min` que era fallback push tray foi UNSCHEDULED. Dose em DnD = ZERO alerta.
- **B-02** `criticalAlarm=false` + app background = silêncio total. Mesma raiz.
- **B-03** Edge `notify-doses` v19 deployed ainda referencia tabela `dose_alarms_scheduled` DROPADA em v0.2.2.4. Crasha `42P01` se invocada.

**Bugs P1 estruturais:**

- **B-04** `daily-alarm-sync/index.ts` + `_shared/auditLog.ts` ausentes do repo local (deployed only).
- **B-05** 15 migrations DB não commitadas localmente (drift repo↔prod).
- **B-06** Edges órfãs `notify-doses` + `schedule-alarms-fcm` `verify_jwt:false` expostas.
- **B-07** Hash `idFromString` Java sem `% 2147483647` (mismatch JS).
- **B-08** `cancel_alarms` FCM action sem caller server-side.

Plus B-09 a B-15 em P2/P3 (channels duplicados, código morto AlarmActivity, BootReceiver perde alarmes durante boot, FCM payload sem chunking 4KB, device_id inconsistente).

### Fase 2 — Items #215-#226 ROADMAP + CHECKLIST

12 NOVOS items adicionados:

| # | Categoria | Prioridade | Resumo |
|---|---|---|---|
| #215 | 🔄 TURNAROUND | 🔴 P0 | Refactor scheduler unificado + push backup co-agendado + cobertura DnD/criticalAlarm-off + 3 cenários |
| #216 | 🐛 BUGS | 🟠 P1 | Limpar Edge `notify-doses` ref `dose_alarms_scheduled` DROPADA |
| #217 | 🐛 BUGS | 🟠 P1 | Drift Edge `daily-alarm-sync` + `_shared/auditLog.ts` ausentes local |
| #218 | 🐛 BUGS | 🟠 P1 | Drift 15 migrations locais faltantes |
| #219 | 🐛 BUGS | 🟠 P1 | Deletar Edges órfãs `notify-doses` + `schedule-alarms-fcm` |
| #220 | 🐛 BUGS | 🟠 P1 | Alinhar hash `idFromString` Java com `% 2147483647` |
| #221 | 🐛 BUGS | 🟠 P1 | Implementar `cancel_alarms` server-side em `dose-trigger-handler` |
| #222 | ✨ MELHORIAS | 🟡 P2 | Consolidar channels Android (3→2) + cleanup código morto AlarmActivity ~150 linhas |
| #223 | ✨ MELHORIAS | 🟢 P3 | Deletar `usePushNotifications.js` deprecated |
| #224 | 🐛 BUGS | 🟡 P2 | BootReceiver dispara alarme atrasado se <2h margem |
| #225 | ✨ MELHORIAS | 🟡 P2 | FCM payload chunking 4KB `daily-alarm-sync` |
| #226 | ✨ MELHORIAS | 🟢 P3 | Padronizar `device_id` UUID cross-source `alarm_audit_log` |

§6.2 counter atualizado: 82 abertos (10 P0 / 19 P1 / 22 P2 / 31 P3).

### Fase 3 — Decisões user consolidadas em #215

User propôs fluxo simplificado em 3 cenários. Após review do plano, respondeu 11 decisões pendentes:

| # | Decisão | Comportamento |
|---|---|---|
| 2 | Margem boot atraso | **2h** (#224 alinhado) |
| 3 | Push silencioso DnD | **Vibração leve 200ms**, sound null |
| 4 | Toggle Alarme Crítico OFF | Cancela alarmes nativos + recadastra push imediato |
| 6 | Cuidador compartilhando | **SEMPRE alarme cheio prioridade** + respeita DnD próprio |
| 8 | Limite Android ~500 | **Janela dinâmica:** itens > 400 → 24h; senão 48h |
| 9 | Mudança horário tratamento | Aceita proposta (`update_treatment_schedule` + Cenário 02 cross-device) |
| 10 | Cuidador opt-in compartilhado | Sempre recebe (toggle parqueado futuro) |
| 11 | Admin `/alarm-audit` | **Mantém funcional** — todos 4 paths populam `alarm_audit_log` com metadata uniformizada |

Helper unificado `scheduleDoseAlarm(ctx, dose, prefs)` com 3 branches documentado:

- `push_critical_off` — Alarme Crítico OFF → só push tray
- `push_dnd` — DnD janela → só push tray vibração leve
- `alarm_plus_push` — caso normal → alarme nativo + LocalNotification backup co-agendada

3 Cenários pseudocódigo:

- **Cenário 01** — app open/update → cancelAll + reagenda janela dinâmica
- **Cenário 02** — status change dose (Tomada/Pulada/Desfazer) → local + FCM cross-device (paciente + cuidadores)
- **Cenário 03a** — WorkManager 6h Android background
- **Cenário 03b** — Cron daily 5am BRT Edge `daily-alarm-sync`

13 cenários validação device S25 Ultra detalhados em CHECKLIST §#215.

## 📦 Commits

3 commits na branch `docs/auditoria-alarme-push`:

- `727bab0` — `docs(auditoria): sistema Alarme + Push ponta-a-ponta`
- `e0df0f2` — `docs(roadmap,checklist): 12 items #215-#226 auditoria Alarme + Push`
- `b8238ac` — `docs(#215): consolida decisões user 3-cenários + edge cases admin audit`

Merge linear no master: `db89a8f`. Push para `origin/master` OK. Vercel auto-deploy trigger via push.

## 🎯 Próximo passo

User autorizou:

1. ✅ Merge `docs/auditoria-alarme-push` → master (este commit).
2. ⏭️ Abrir `release/v0.2.3.0` para atacar #215 (refactor scheduler unificado + 3 cenários).
3. ⏭️ Pós refactor, se necessário, atacar #216–#221 (cleanup pré-/pós-refactor).

## 📚 Referências

- Relatório auditoria: [`contexto/auditoria/2026-05-13-alarme-push-auditoria.md`](../auditoria/2026-05-13-alarme-push-auditoria.md)
- CHECKLIST §#215 a §#226 com pseudocódigo + critérios aceitação
- ROADMAP §6.7 (TURNAROUND) + §6.6 (BUGS) + §6.5 (MELHORIAS) atualizados
