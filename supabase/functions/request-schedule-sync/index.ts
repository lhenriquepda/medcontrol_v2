// Refactor Fase 2 (Refactor_Full.md §4.6) — release v0.2.3.17.
// Endpoint chamado pelo cliente quando user muda prefs (criticalAlarm, advanceMins,
// dndEnabled etc) ou volta da Settings. Faz o trabalho que o JS `rescheduleAll`
// fazia client-side, agora server-side: pega doses do user no horizonte e dispara
// FCM `reschedule_all` para o device fazer reagendamento local.
//
// Substitui (ao longo do tempo) o caller JS `rescheduleAll` espalhado em App.jsx,
// useUpdateUserPrefs e outros lugares — cliente JS deixa de orquestrar alarme,
// apenas pede pro server sincronizar e o server manda FCM data com o schedule
// atualizado pro AlarmScheduler nativo.
//
// MVP desta Fase 2 remainder: endpoint stub que valida sessão + retorna ACK.
// O FCM dispatch real reusa o `daily-alarm-sync` (cron 5am BRT) que já implementa
// a lógica de busca + chunking + FCM — ver TODO inline pra evolução completa.
//
// Deployada em prod 2026-05-20 via mcp__supabase__deploy_edge_function.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const reason = body?.reason || 'unspecified'
    const horizonHours = Math.max(1, Math.min(168, Number(body?.horizon_hours) || 48))

    const ts = new Date().toISOString()

    // TODO Fase 2 evolução: reusar lógica de daily-alarm-sync pra buscar doses
    // do user na janela horizonHours + dispatch FCM schedule_alarms pro device
    // dele. MVP: ACK only — cliente já tem AlarmScheduler.scheduleDoseAlarm que
    // reagenda quando recebe FCM data, então não precisa server orchestration
    // ainda. Esse endpoint estabelece a interface contractual; o backend interno
    // evolui sem mudar cliente.

    return new Response(
      JSON.stringify({
        ok: true,
        ack: true,
        reason,
        horizon_hours: horizonHours,
        ts,
        note: 'MVP — backend dispatch implementation pending Fase 2 final iteration'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'internal_error', message: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
