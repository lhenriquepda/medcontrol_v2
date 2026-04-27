const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DOSY_DB_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  console.log('Drop partial unique index...');
  await c.query(`DROP INDEX IF EXISTS medcontrol.push_subs_devicetoken_uniq`);
  console.log('  âœ“');

  console.log('Create UNIQUE constraint on deviceToken (non-partial â€” multiple NULLs OK)');
  await c.query(`ALTER TABLE medcontrol.push_subscriptions ADD CONSTRAINT push_subs_devicetoken_key UNIQUE ("deviceToken")`);
  console.log('  âœ“');

  await c.end();
})();

