/**
 * test-conn.cjs — Verify app can connect to new project via Supabase JS client
 */
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://guefraaqbkcehofchnrc.supabase.co';
const ANON = 'sb_publishable_gUsNMQJJWnl9s_b3E1CSQA_OtJOK4ex';

const supabase = createClient(URL, ANON, { db: { schema: 'medcontrol' } });

(async () => {
  console.log('=== 1. Connectivity ===');
  const { data: session } = await supabase.auth.getSession();
  console.log(`  Session: ${session?.session ? 'active' : 'none (expected)'}`);

  console.log('\n=== 2. RLS check (should return 0 rows for anon) ===');
  const { data, error } = await supabase.from('patients').select('id').limit(5);
  if (error) console.log(`  Error: ${error.message}`);
  else console.log(`  Got ${data?.length ?? 0} rows (expected: 0 because RLS blocks anon)`);

  console.log('\n=== 3. RPC check (anon-callable) ===');
  // my_tier returns null for anon (no auth)
  const { data: tier, error: tierErr } = await supabase.rpc('my_tier');
  if (tierErr) console.log(`  Error: ${tierErr.message}`);
  else console.log(`  my_tier() = ${tier === null ? 'null (expected for anon)' : tier}`);

  console.log('\n=== 4. Auth: check existing user can attempt login ===');
  // Just check the auth endpoint responds (not actually logging in)
  const { data: ssoErr, error: signinErr } = await supabase.auth.signInWithPassword({
    email: 'test-no-such@nowhere.test',
    password: 'wrong-password-just-checking-endpoint'
  });
  console.log(`  Auth endpoint: ${signinErr?.message?.includes('credentials') ? 'OK (rejects bad creds)' : signinErr?.message || 'unexpected response'}`);

  console.log('\n✅ Connection working');
})();
