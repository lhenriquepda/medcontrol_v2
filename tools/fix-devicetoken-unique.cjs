const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:xoeDZAnfn8TvBD5m@db.guefraaqbkcehofchnrc.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  console.log('Drop partial unique index...');
  await c.query(`DROP INDEX IF EXISTS medcontrol.push_subs_devicetoken_uniq`);
  console.log('  ✓');

  console.log('Create UNIQUE constraint on deviceToken (non-partial — multiple NULLs OK)');
  await c.query(`ALTER TABLE medcontrol.push_subscriptions ADD CONSTRAINT push_subs_devicetoken_key UNIQUE ("deviceToken")`);
  console.log('  ✓');

  await c.end();
})();
