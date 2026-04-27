const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DOSY_DB_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const r = await c.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='medcontrol' AND table_name='push_subscriptions' ORDER BY ordinal_position`);
  console.log('push_subscriptions columns:');
  for (const row of r.rows) console.log(`  ${row.column_name} (${row.data_type}, nullable=${row.is_nullable})`);
  await c.end();
})();

