/**
 * test-sos-bypass.cjs â€” Verify INSERT direto em doses (type=sos) Ã© bloqueado
 */
const { Client } = require('pg');
const DST = process.env.DOSY_DB_URL;

(async () => {
  const c = new Client({ connectionString: DST, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Get column names of doses
  const { rows: cols } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='medcontrol' AND table_name='doses' ORDER BY ordinal_position
  `);
  console.log('doses columns:', cols.map(r=>r.column_name).join(', '));

  // Find a real user_id and their patient_id
  const { rows: users } = await c.query(`SELECT id, email FROM auth.users LIMIT 1`);
  const userId = users[0].id;
  const userEmail = users[0].email;

  const { rows: patients } = await c.query(`SELECT id FROM medcontrol.patients WHERE "userId" = $1 LIMIT 1`, [userId]);
  const patientId = patients[0].id;
  console.log(`\nTest user: ${userEmail} (${userId})`);
  console.log(`Test patient: ${patientId}\n`);

  const claims = JSON.stringify({ sub: userId, role: 'authenticated' }).replace(/'/g, "''");

  // â”€â”€â”€ Test 1: anon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('=== TEST 1: anon role INSERT direto em doses (type=sos) ===');
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL ROLE anon`);
    await c.query(`
      INSERT INTO medcontrol.doses ("patientId", "userId", "medName", "unit", "scheduledAt", "actualTime", "status", "type")
      VALUES ($1, $2, 'TestMed', '10mg', NOW(), NOW(), 'done', 'sos')
    `, [patientId, userId]);
    console.log('  âŒ FAIL â€” anon inseriu dose');
    await c.query('ROLLBACK');
  } catch (e) {
    console.log(`  âœ… BLOCKED â€” ${e.message.split('\n')[0]}`);
    await c.query('ROLLBACK');
  }

  // â”€â”€â”€ Test 2: authenticated direct INSERT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\n=== TEST 2: authenticated INSERT direto em doses (type=sos) ===');
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL ROLE authenticated`);
    await c.query(`SET LOCAL "request.jwt.claims" = '${claims}'`);
    const r = await c.query(`
      INSERT INTO medcontrol.doses ("patientId", "userId", "medName", "unit", "scheduledAt", "actualTime", "status", "type")
      VALUES ($1, $2, 'BypassTest', '10mg', NOW(), NOW(), 'done', 'sos')
      RETURNING id
    `, [patientId, userId]);
    console.log(`  âš  ALLOWED â€” id=${r.rows[0].id}`);
    console.log(`  âš  Atacante autenticado bypassa register_sos_dose (sem validaÃ§Ã£o de minIntervalHours)`);
    await c.query('ROLLBACK');
  } catch (e) {
    console.log(`  âœ… BLOCKED â€” ${e.message.split('\n')[0]}`);
    await c.query('ROLLBACK');
  }

  // â”€â”€â”€ Test 3: register_sos_dose RPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\n=== TEST 3: register_sos_dose RPC (caminho correto) ===');
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL ROLE authenticated`);
    await c.query(`SET LOCAL "request.jwt.claims" = '${claims}'`);
    await c.query(`
      SELECT medcontrol.register_sos_dose($1, 'RpcTest', '5mg', NOW(), 'test')
    `, [patientId]);
    console.log(`  âœ… RPC funciona`);
    await c.query('ROLLBACK');
  } catch (e) {
    console.log(`  âš  ${e.message.split('\n')[0]}`);
    await c.query('ROLLBACK');
  }

  // â”€â”€â”€ Test 4: cross-user attack (type=sos) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\n=== TEST 4a: User B â†’ paciente de User A (type=sos) ===');
  const { rows: others } = await c.query(`SELECT id, email FROM auth.users WHERE id != $1 LIMIT 1`, [userId]);
  if (others.length) {
    const otherId = others[0].id;
    const otherClaims = JSON.stringify({ sub: otherId, role: 'authenticated' }).replace(/'/g, "''");
    console.log(`  User B: ${others[0].email}`);
    try {
      await c.query('BEGIN');
      await c.query(`SET LOCAL ROLE authenticated`);
      await c.query(`SET LOCAL "request.jwt.claims" = '${otherClaims}'`);
      await c.query(`
        INSERT INTO medcontrol.doses ("patientId", "userId", "medName", "unit", "scheduledAt", "actualTime", "status", "type")
        VALUES ($1, $2, 'AttackTest', '99mg', NOW(), NOW(), 'done', 'sos')
      `, [patientId, otherId]);
      console.log(`  âŒ FAIL â€” User B inseriu dose no paciente alheio!`);
      await c.query('ROLLBACK');
    } catch (e) {
      console.log(`  âœ… BLOCKED â€” ${e.message.split('\n')[0]}`);
      await c.query('ROLLBACK');
    }

    // â”€â”€â”€ TEST 4b: User B â†’ patient NÃƒO compartilhado (type=scheduled) â”€â”€â”€
    console.log('\n=== TEST 4b: User B â†’ patient de OUTRO user (sem share) ===');
    // Fake patient_id (UUID vÃ¡lido mas inexistente) para simular "patient_id de outro user"
    const fakePatient = '00000000-0000-0000-0000-000000000001';
    try {
      await c.query('BEGIN');
      await c.query(`SET LOCAL ROLE authenticated`);
      await c.query(`SET LOCAL "request.jwt.claims" = '${otherClaims}'`);
      await c.query(`
        INSERT INTO medcontrol.doses ("patientId", "userId", "medName", "unit", "scheduledAt", "actualTime", "status", "type")
        VALUES ($1, $2, 'AttackTest', '99mg', NOW(), NOW(), 'pending', 'scheduled')
      `, [fakePatient, otherId]);
      console.log(`  âŒ FAIL â€” User B inseriu dose em patient inexistente/sem acesso!`);
      await c.query('ROLLBACK');
    } catch (e) {
      console.log(`  âœ… BLOCKED â€” ${e.message.split('\n')[0]}`);
      await c.query('ROLLBACK');
    }

    // â”€â”€â”€ TEST 4c: has_patient_access verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\n=== TEST 4c: has_patient_access(fake_patient) for User B ===');
    await c.query(`SET ROLE authenticated`);
    await c.query(`SET "request.jwt.claims" = '${otherClaims}'`);
    const { rows: hpa } = await c.query(`SELECT medcontrol.has_patient_access('${fakePatient}'::uuid) AS access`);
    console.log(`  has_patient_access = ${hpa[0].access} (esperado: false)`);
    await c.query(`RESET ROLE`);
    await c.query(`RESET "request.jwt.claims"`);
  }

  await c.end();
})();

