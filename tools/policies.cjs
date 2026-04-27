const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DOSY_DB_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const r = await c.query(`SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='medcontrol' AND tablename='doses' ORDER BY policyname`);
  for (const p of r.rows) {
    console.log('--- ' + p.policyname + ' (' + p.cmd + ') ---');
    if (p.qual) console.log('  USING: ' + p.qual);
    if (p.with_check) console.log('  WITH CHECK: ' + p.with_check);
  }
  await c.end();
})();

