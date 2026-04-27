const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:xoeDZAnfn8TvBD5m@db.guefraaqbkcehofchnrc.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();

  // patient_shares state
  console.log('=== patient_shares ===');
  const { rows: shares } = await c.query(`SELECT * FROM medcontrol.patient_shares`);
  for (const s of shares) console.log(JSON.stringify(s));

  // has_patient_access definition
  console.log('\n=== has_patient_access() definition ===');
  const { rows: fn } = await c.query(`SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='medcontrol' AND p.proname='has_patient_access'`);
  console.log(fn[0].def);

  // Check if user B has access to user A's patient
  const userA = '3e3899cb-cc40-4940-9384-442fb5123865';
  const patientA = '3ad82f18-6715-45bd-8b4d-261ab1ef15c6';
  const { rows: usersB } = await c.query(`SELECT id, email FROM auth.users WHERE id != $1 LIMIT 1`, [userA]);
  const userB = usersB[0].id;

  console.log(`\n=== Test has_patient_access for User B (${usersB[0].email}) on Patient A ===`);
  await c.query(`SET ROLE authenticated`);
  await c.query(`SET "request.jwt.claims" = '${JSON.stringify({ sub: userB, role: 'authenticated' })}'`);
  const { rows: r } = await c.query(`SELECT medcontrol.has_patient_access('${patientA}'::uuid) AS access`);
  console.log(`  has_patient_access = ${r[0].access}`);
  await c.query(`RESET ROLE`);
  await c.query(`RESET "request.jwt.claims"`);

  // Show actual sharing relations
  console.log('\n=== Patient A sharing ===');
  const { rows: sh } = await c.query(`SELECT * FROM medcontrol.patient_shares WHERE "patientId" = $1`, [patientA]);
  console.log(JSON.stringify(sh, null, 2));

  await c.end();
})();
