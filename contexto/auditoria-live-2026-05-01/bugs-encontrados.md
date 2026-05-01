# Bugs Encontrados — Auditoria Live 2026-05-01

> Sessão de validação live nav durante release v0.1.7.0. Foco: idle freeze + lentidão. Achados de comportamento real em device físico (teste03 + sessão Vercel preview).

---

## BUG-016 — Push FCM + alarme nativo não disparam após idle longo (~16min)

- **Severidade:** P0
- **Classificação:** [ANDROID] (afeta produto core)
- **Onde:** `supabase/functions/notify-doses` + `useRealtime.js` + `services/notifications.js` + plugin `criticalAlarm` Android
- **Cenário reproduzido (2026-05-01 18:55 BRT, teste03):**
  1. Doses criadas via REST direto em DB às 18:39 (window 16min antes do disparo)
  2. App Android ativo + foreground momentaneamente, depois bloqueio tela
  3. ~16min idle (app em background)
  4. Hora 18:55: nada disparou — sem alarme nativo, sem push FCM, sem notif
  5. User abre app pós-19:00: dose aparece como "Atrasada" (nunca foi sincronizada client-side)
- **Sintoma observado:**
  - Realtime websocket morreu silenciosamente durante idle (provavelmente Android Doze ou OS network management)
  - useRealtime.js sem heartbeat — não detecta dead websocket
  - notify-doses Edge cron PROVAVELMENTE rodou às 18:54-18:56 mas push não chegou (logs Edge bloqueados por 403/1010 PAT rate limit, não confirmado direto)
  - Plugin criticalAlarm nativo nunca foi acionado pra dose 18:55 (porque app nunca viu a dose antes do horário)
- **Comportamento contrastante:**
  - Dose 18:58 (com user recém-ativo no app): push FCM chegou ✅
  - Confirma: bug específico de estado idle longo, não regressão geral
- **Mitigação parcial release v0.1.7.0 (#076 useAppResume):**
  - Quando user volta foco após idle, app refetch + reconect realtime
  - Dose aparece como "Atrasada" rapidamente (sem cold reload)
  - Não previne PERDA de notificação, só recupera estado UI
- **Risco:**
  - **Healthcare CRITICAL.** Dose perdida = paciente não toma medicação a tempo.
  - Atinge user real em uso normal (celular bloqueado várias horas)
  - Push FCM falhar contradiz expectativa de sistema "fail-safe server-side"
- **Hipóteses ranqueadas:**
  1. **Realtime websocket morre silently** durante idle → app não recebe invalidate → não vê dose → não agenda alarme nativo. Fix: heartbeat keep-alive.
  2. **push_subscriptions.advanceMins = 0** → janela ±60s no Edge `notify-doses`. Cron executa a cada minuto, mas tolerância apertada. Pequeno drift = miss.
  3. **2 push_subscriptions** registradas pro user (token rotation gerou múltiplos). Edge envia pra todos, alguns podem falhar silently.
  4. **Edge Function notify-doses error handling** insuficiente — falhas não retentam, sem alerta.
  5. **FCM rate limit / token invalidation** sem cleanup automático.
- **Recomendação (vira items #079 + #080 ROADMAP):**
  - **#079** Realtime heartbeat keep-alive (5-10s ping) + reconnect automático em silent fail. Preserva conexão durante idle médio.
  - **#080** Investigar logs `notify-doses` Edge cron + observability + retry policy + cleanup tokens FCM inválidos.
- **Status:** Aberto P0. Mitigação parcial em v0.1.7.0; fix completo planejado v0.1.8.0.

---

## Sumário

- **Total bugs novos:** 1 (BUG-016)
- **Severidade:** P0 (1)
- **Plataforma:** [ANDROID] (1)

Próximo BUG-NNN: BUG-017.
