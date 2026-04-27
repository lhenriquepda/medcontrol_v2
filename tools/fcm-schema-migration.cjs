/**
 * Migration: add deviceToken column for FCM, relax endpoint/keys to nullable
 * (Web Push uses endpoint+keys, FCM uses deviceToken — same table, different fields)
 */
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:xoeDZAnfn8TvBD5m@db.guefraaqbkcehofchnrc.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });

(async () => {
  await c.connect();

  // Add deviceToken column
  console.log('1. Add deviceToken column');
  try {
    await c.query(`ALTER TABLE medcontrol.push_subscriptions ADD COLUMN IF NOT EXISTS "deviceToken" text`);
    console.log('  ✓');
  } catch (e) { console.log(`  ! ${e.message}`); }

  // Relax endpoint/keys to nullable (FCM doesn't need them)
  console.log('2. Relax endpoint nullable');
  try {
    await c.query(`ALTER TABLE medcontrol.push_subscriptions ALTER COLUMN endpoint DROP NOT NULL`);
    console.log('  ✓');
  } catch (e) { console.log(`  ! ${e.message}`); }

  console.log('3. Relax keys nullable');
  try {
    await c.query(`ALTER TABLE medcontrol.push_subscriptions ALTER COLUMN keys DROP NOT NULL`);
    console.log('  ✓');
  } catch (e) { console.log(`  ! ${e.message}`); }

  // Unique index on deviceToken (for upsert from FCM registration)
  console.log('4. Unique index on deviceToken');
  try {
    await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS push_subs_devicetoken_uniq ON medcontrol.push_subscriptions("deviceToken") WHERE "deviceToken" IS NOT NULL`);
    console.log('  ✓');
  } catch (e) { console.log(`  ! ${e.message}`); }

  // CHECK: must have either endpoint OR deviceToken
  console.log('5. CHECK: endpoint OR deviceToken required');
  try {
    await c.query(`ALTER TABLE medcontrol.push_subscriptions ADD CONSTRAINT push_subs_has_target CHECK (endpoint IS NOT NULL OR "deviceToken" IS NOT NULL)`);
    console.log('  ✓');
  } catch (e) { console.log(`  ! ${e.message}`); }

  // Verify
  const { rows } = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema='medcontrol' AND table_name='push_subscriptions'
    ORDER BY ordinal_position
  `);
  console.log('\nFinal schema:');
  for (const r of rows) console.log(`  ${r.column_name} (${r.data_type}, null=${r.is_nullable})`);

  await c.end();
})();
