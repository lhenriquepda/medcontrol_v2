/**
 * verify.cjs — verify migration state on dst, fix lingering issues
 */
const { Client } = require('pg');
const DST = 'postgresql://postgres:xoeDZAnfn8TvBD5m@db.guefraaqbkcehofchnrc.supabase.co:5432/postgres';

(async () => {
  const c = new Client({ connectionString: DST, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('=== Tables and row counts ===');
  const { rows: tables } = await c.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'medcontrol' ORDER BY tablename
  `);
  for (const { tablename } of tables) {
    const r = await c.query(`SELECT COUNT(*) AS n FROM medcontrol."${tablename}"`);
    console.log(`  ${tablename}: ${r.rows[0].n} rows`);
  }

  console.log('\n=== Primary Keys ===');
  const { rows: pks } = await c.query(`
    SELECT cl.relname AS tbl, c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE c.contype = 'p' AND n.nspname = 'medcontrol'
    ORDER BY cl.relname
  `);
  for (const r of pks) console.log(`  ${r.tbl}: ${r.def}`);

  console.log('\n=== Foreign Keys ===');
  const { rows: fks } = await c.query(`
    SELECT cl.relname AS tbl, c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE c.contype = 'f' AND n.nspname = 'medcontrol'
    ORDER BY cl.relname, c.conname
  `);
  for (const r of fks) console.log(`  ${r.tbl}.${r.conname}\n    ${r.def}`);

  console.log('\n=== Unique constraints ===');
  const { rows: uqs } = await c.query(`
    SELECT cl.relname AS tbl, c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE c.contype = 'u' AND n.nspname = 'medcontrol'
    ORDER BY cl.relname, c.conname
  `);
  for (const r of uqs) console.log(`  ${r.tbl}.${r.conname}: ${r.def}`);

  console.log('\n=== auth.users count ===');
  const u = await c.query(`SELECT COUNT(*) AS n, COUNT(email_confirmed_at) AS confirmed FROM auth.users`);
  console.log(`  ${u.rows[0].n} users, ${u.rows[0].confirmed} confirmed`);

  console.log('\n=== Functions ===');
  const fns = await c.query(`
    SELECT proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'medcontrol' ORDER BY proname
  `);
  console.log(`  ${fns.rows.length}: ${fns.rows.map(r=>r.proname).join(', ')}`);

  console.log('\n=== RLS state ===');
  const rls = await c.query(`
    SELECT cl.relname, cl.relrowsecurity AS enabled, cl.relforcerowsecurity AS forced
    FROM pg_class cl JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'medcontrol' AND cl.relkind = 'r' ORDER BY cl.relname
  `);
  for (const r of rls.rows) console.log(`  ${r.relname}: enabled=${r.enabled} forced=${r.forced}`);

  await c.end();
})();
