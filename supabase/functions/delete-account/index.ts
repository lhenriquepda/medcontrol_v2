// Supabase Edge Function — delete-account
// Deletes user data (medcontrol schema) and the auth.users row.
// LGPD Art. 18, VI — Direito ao Esquecimento.
//
// Required env vars (auto-set by Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'medcontrol' }
  })

  try {
    // 1. Verify caller's JWT and get user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const jwt = authHeader.slice(7)
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(jwt)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Item #028 (release v0.2.0.4): rate limit via security_events.
    // Antes: delete-account aceitava chamadas ilimitadas. User podia spam
    // accidentally OR atacante via JWT roubado podia tentar DoS account
    // (apesar de auth.uid scope, ainda DoS via repeated calls + admin ops).
    // Agora: max 1 tentativa por user por 60s. Insert security_event +
    // checa contagem últimos 60s. Resposta 429 + Retry-After.
    const sixtySecAgo = new Date(Date.now() - 60_000).toISOString()
    const { count: recentAttempts } = await adminClient
      .from('security_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('event_type', 'delete_account_attempt')
      .gte('created_at', sixtySecAgo)
    if ((recentAttempts ?? 0) > 0) {
      return new Response(JSON.stringify({ error: 'rate_limit', message: 'Aguarde 60s antes de tentar novamente.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }
      })
    }
    await adminClient.from('security_events').insert({
      user_id: user.id,
      event_type: 'delete_account_attempt',
      ip_address: req.headers.get('x-forwarded-for') ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    })

    // 2. Delete user data via RPC (handles all medcontrol cascade)
    const { error: rpcErr } = await adminClient.rpc('delete_my_account')
    if (rpcErr) {
      console.error('delete_my_account RPC failed:', rpcErr)
      // Continue anyway — try to delete auth user
    }

    // 3. Delete auth user (admin-level operation)
    const { error: delErr } = await adminClient.auth.admin.deleteUser(user.id)
    if (delErr) {
      return new Response(JSON.stringify({ error: 'Delete failed', details: delErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ ok: true, userId: user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('delete-account error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
