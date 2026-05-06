# 2026-05-05 — Investigação #157 storm 12 req/s + fix useRealtime cascade

## TLDR

Validação preview Vercel pré-merge release/v0.2.1.0 (Regra 9.1 README) descobriu **storm catastrófico** 18× prod baseline (1053 reqs / 30s idle hidden tab, ~5GB/h extrapolado). Investigação aprofundada Chrome MCP + Supabase MCP identificou **root cause real**: `useRealtime()` reconnect cascade + publication `supabase_realtime` vazia. Fix: comentar `useRealtime()` em App.jsx:67. Storm 99.7% eliminado (9 reqs / 7min idle pós-fix). Bug pré-existente master (não regressão release).

## Cronologia investigação

### Fase 1 — Detecção storm (sessão atual início)

Após sync ROADMAP/CHECKLIST/updates fix anti-spam Gmail #026 (commit `4356014`), executei validação obrigatória pré-merge per Regra 9.1 README:

1. ✅ Lint local: 0 errors
2. ✅ Build local: 18.98s
3. ✅ Push origin/release/v0.2.1.0 (8 commits)
4. ❌ **Preview Vercel Chrome MCP — STORM detectado**

**Receita validação:**
- Login `teste-plus@teste.com` em `dosy-git-release-v0210-lhenriquepdas-projects.vercel.app`
- Arm fetch interceptor `__dosyNetMonitorV3`
- Bateria interações + idle 5min hidden tab

**Resultado release v0.2.1.0 (com #007 incluído):**

| Métrica | Valor |
|---|---|
| Total reqs Supabase em 5min idle | 3558 |
| `/doses` por segundo | 9-27 (escalou) |
| `/patients` por segundo | 1.8 |
| `/treatments` por segundo | 0.9 |
| Egress 5min idle | 27 MB só `/doses` |

### Fase 2 — Bisect inicial (false positive)

Hipótese inicial: 3 commits feat tocam código operacional release:
- `b3fe670` #007 PostHog telemetria (App.jsx + analytics.js)
- `8807bfc` #036 skeleton screens
- `a0c070a` batch (vários src files)

Bisect commit `76dc28a`: revert `#007` src files (App.jsx + analytics.js) → push → Vercel rebuild 150s → retest 30s idle hidden tab.

**Resultado bisect (window 30s):** 0 reqs / 44s. Storm 100% eliminado aparentemente. **#007 falsamente identificado como culpado.**

User decisão A2: parquear `#007` v0.2.2.0+ (commit `774a7b7` docs). 11 commits no branch.

### Fase 3 — Re-validação pós-A2 (descoberta false positive)

Antes ceremony, re-rodei validação completa idle 5min pra confirmar fix durável:

```
Bisect (sem #007 src) idle 5min: 715 reqs (2.4 req/s)
```

Storm voltou. Bisect 30s tinha capturado window pré-escalada — **storm escala ao longo do tempo em hidden tab**.

Comparei com prod tab aberta há 28min:
```
Prod master 28min idle: 77379 reqs (46 req/s)
```

**Storm é PRÉ-EXISTENTE em prod master**, não regressão release v0.2.1.0. #007 é inocente.

### Fase 4 — Investigação multi-camada

User aprovou investigação dedicada via Chrome MCP (cliente) + Supabase MCP (backend) + code analysis.

**Chrome MCP fetch interceptor + WebSocket hook + visibility events:**

Pattern observado idle hidden tab:
- 13 reqs/s sustained
- Bursts paralelas <100ms + gaps regulares ~2-3s
- Cada burst: 11× /doses + 1× /patients + 1× /treatments
- Visibility hidden + hasFocus false confirmados durante storm
- WS events ZERO pós-hook (hook injetado tarde, pré-existing WS continuou)

149 bursts em 5min, **gap min 1998ms / max 3006ms / avg 2419ms**. Padrão consistente sugere setTimeout backoff + refetch cycle.

**Supabase MCP `pg_publication_tables`:**
```sql
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
```
Resultado: `[]` **VAZIO**. Nenhuma tabela configurada na publication realtime.

Implica: postgres_changes events nunca foram entregues pra qualquer subscriber, mesmo com app rodando 24/7 em prod. Realtime delivery silenciosamente quebrada há tempo desconhecido.

**Supabase MCP `get_logs(realtime)`:**
- 50+ entries `IncreaseSubscriptionConnectionPool: Too many database timeouts`
- Multiple `ChannelRateLimitReached: Too many channels`
- Cycles `Stop tenant guefraaqbkcehofchnrc because of no connected users` + restart

Server side está em loop tentando manter tenant alive enquanto cliente cycles subscribe → fail → reconnect.

**Code analysis `src/hooks/useRealtime.js`:**

```js
// linha 80-108: onStatusChange handler
const onStatusChange = (myGen) => (status) => {
  if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    reconnectAttempts++
    const delay = Math.min(1_000 * Math.pow(2, reconnectAttempts), 30_000)
    setTimeout(async () => {
      if (!user) return
      await unsubscribe()
      await subscribe()
      // refetch SCOPED a queries ATIVAS apenas (#145 v0.2.0.11)
      for (const keys of Object.values(TABLE_TO_KEYS)) {
        for (const key of keys) {
          qc.refetchQueries({ queryKey: key, type: 'active' })
        }
      }
    }, delay)
  }
}
```

`TABLE_TO_KEYS` cobre 6 tabelas × 1-3 keys each = ~10 keys. Cada reconnect dispara refetch em **TODAS active keys simultaneamente** = bursts paralelas.

`reconnectAttempts = 0` reset em SUBSCRIBED status (linha 84). Se channel briefly succeeds before failing again, counter resets, backoff volta a 1s. Loop tight.

### Fase 5 — Mecanismo confirmado

```
1. App carrega → useRealtime subscribe channel → ch.on(postgres_changes, table, handler) × 6
2. Server: publication empty → subscriber sem eventos
3. Tenant idle (no users connected effectively) → STOP tenant
4. CLOSE channel → onStatusChange('CLOSED')
5. setTimeout backoff 1-2s
6. unsubscribe + subscribe (new chanName via uuid #093) + refetchQueries(['doses','patients','treatments',...]) × 10 keys × type:'active'
7. ~13 fetches paralelos disparam <100ms
8. New channel briefly SUBSCRIBED → reconnectAttempts=0 reset
9. Tenant idle no broker → STOP again
10. Loop infinito a cada ~2-3s
```

### Fase 6 — Fix targeted

Single line change `src/App.jsx:56`:

```diff
-  useRealtime()
+  // #157 (v0.2.1.0) — DISABLED. Bug investigation 2026-05-05 found:
+  //   1. publication `supabase_realtime` empty (NO postgres_changes events delivered)
+  //   2. useRealtime reconnect cascade burns ~13 req/s storm
+  //   3. Net: zero functional value + catastrophic egress cost.
+  // Re-enable plan v0.2.2.0+: populate publication + verify reconnect guard
+  // useRealtime()
   useAppResume()
```

Hook `src/hooks/useRealtime.js` preservado intacto. Apenas invocação comentada.

Commit: `da61b04 fix(release/v0.2.1.0): #157 disable useRealtime() — storm 13 req/s preview/prod`

Push + Vercel rebuild 130s.

### Fase 7 — Validação pós-fix

| Métrica idle hidden tab | Pre-fix | Pós-fix #157 |
|---|---|---|
| 30s | ~57 reqs (já escalando em prod) | 1 req |
| 90s | ~785 reqs (8.7 req/s) | 2 reqs |
| 5min completo | 3558 reqs (12 req/s) | **9 reqs (0.021 req/s)** |
| 7min completo (visible→hidden) | extrapolável | **9 reqs total** |

**Storm 99.7% eliminado.** 9 reqs total em 7min: 1× auth/v1/user + 1× patient_shares + 1× patients + 1× treatments + 5× doses (mount inicial + occasional refetch). Comportamento sano.

### Fase 8 — Restore #007 (false positive bisect)

Storm não era #007. Bisect commit `76dc28a` revertido via `git revert ff431ca`. App.jsx + analytics.js restaurados. CHECKLIST/ROADMAP §#007 status `🟡 PARQUEADO` → `✅ Concluído v0.2.1.0`.

## Estado release/v0.2.1.0 final

13 commits agora:

| Commit | Item |
|---|---|
| `2522efd` | #089 BUG-022 fechado organicamente |
| `a0c070a` | Batch 6 items (#129/#130/#018/#026/#046/#156 v1.1) |
| `43747d1` | #156 v1.2 deep audit Health Apps Policy |
| `d4f3ecb` | Categoria Saúde e fitness + audit counter |
| `b3fe670` | #007 PostHog telemetria (RESTAURADO via revert do bisect) |
| `8807bfc` | #036 skeleton screens |
| `eff7cd9` | #041 partial + #042 deferred |
| `86009d4` | #156 v1.3 idade 18+ |
| `4356014` | #026 fix anti-spam Gmail |
| `76dc28a` | bisect: revert #007 src (false positive) |
| `774a7b7` | docs parquear #007 (revertido depois) |
| `da61b04` | **#157 fix disable useRealtime()** |
| `ff431ca` | revert do bisect (restore #007) |

Counter: **111 fechados / 41 abertos / 1 hold (#130)**.

## Plano v0.2.2.0+ retomar useRealtime()

1. **Studio → Database → Replication** → publication `supabase_realtime` toggle:
   - `medcontrol.doses`
   - `medcontrol.patients`
   - `medcontrol.treatments`
   - `medcontrol.sos_rules`
   - `medcontrol.treatment_templates`
   - `medcontrol.patient_shares`

2. **Refactor `useRealtime.js` defensive:**
   - Adicionar `if (reconnectAttempts >= 5) suspend reconnects until visibilitychange visible`
   - Avoid storm em channel empty state futuro
   - Considerar `if (publication empty) skip subscribe entirely` como sanity check

3. **Re-enable `useRealtime()` em App.jsx:67** (uncomment)

4. **Re-validar preview Vercel idle 5min hidden tab** — confirmar 0 reqs sustained com publication populated

5. **Smoke test postgres_changes:**
   - Insert dose via Studio → expect Dashboard auto-update sem refresh
   - Validar realtime delivery funcional

## Lições durables

1. **Validação preview Vercel via Chrome MCP é GATE OBRIGATÓRIO pré-merge.** Regra 9.1 README confirmada novamente. Sem ela, storm 18× egress passaria pra prod (mas já estava em prod, latente).

2. **Storm pode escalar ao longo do tempo em hidden tab.** Bisect window 30s ≠ confirmação. Sempre validar com window equivalente à observation original (5min observed → bisect 5min).

3. **Idle 5min hidden tab é gate crítico** — capturou bug que bateria interativa (2 min) NÃO captou.

4. **Bisect deve sempre validar com window igual ao observed** — bisect 30s deu false positive porque escalada de storm não havia atingido magnitude visible.

5. **Investigação multi-camada essencial pra root cause real:**
   - Cliente: Chrome MCP fetch interceptor + WebSocket hook + visibility events + React fiber walk
   - Backend: Supabase MCP `execute_sql` (pg_publication_tables, triggers, cron) + `get_logs(realtime, api, postgres)`
   - Code: grep invalidate/refetch/setInterval calls + read full hook implementations

6. **Publication realtime vazia + hook subscribe = silent rate-limit cascade** — não-óbvio sem inspecionar BD direto. Vale audit periódico.

7. **Bug pré-existente latente é mais perigoso que regressão fresh** — release v0.2.1.0 herdou bug master + bisect investigação focou erradamente em commits release.

## Próximos passos sessão

1. Push commit ff431ca (restore #007) + commits docs
2. Aguardar Vercel rebuild
3. Validar idle 60s pós-restore #007 (confirmar storm não voltou com #007 ativo)
4. Skeleton render check #036 via code review (cache quente impossibilita repro empírico)
5. Console submit #130 (6 cross-checks user manual)
6. Release ceremony 8 passos (bump → build AAB → upload Console → tag → merge master → Vercel sync → atualizar PROJETO.md → delete branch)
