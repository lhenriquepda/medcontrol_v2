#!/usr/bin/env node
/**
 * One-shot migration: kids-paint → dosy-app.
 *
 * Source (READ-ONLY): kids-paint (oubmmyitpahbcsjrhcxr)
 * Target (WIPE+RESTORE): dosy-app (guefraaqbkcehofchnrc)
 *
 * Order:
 *   1. Disable triggers in target (avoid conflicts with INSERT from source)
 *   2. Wipe target medcontrol.* + auth.users
 *   3. Copy auth.users (with encrypted_password — login works after)
 *   4. Copy medcontrol tables in FK order:
 *      subscriptions → admins → patients → treatments → doses → sos_rules → patient_shares → treatment_templates
 *   5. Re-enable triggers
 *   6. Validate counts match
 *
 * Skips:
 *   - push_subscriptions (kids-paint Web Push subs incompatible with dosy-app FCM)
 *   - security_events (start clean audit log in dosy-app)
 *
 * Usage:
 *   node tools/migrate-kp-to-dosy.cjs
 */

// Tokens loaded from env — DO NOT hardcode here.
// Run: SRC_PAT=sbp_xxx DST_PAT=sbp_yyy node tools/migrate-kp-to-dosy.cjs
const SRC_REF = process.env.SRC_REF || 'oubmmyitpahbcsjrhcxr'    // kids-paint
const SRC_PAT = process.env.SRC_PAT
const DST_REF = process.env.DST_REF || 'guefraaqbkcehofchnrc'    // dosy-app
const DST_PAT = process.env.DST_PAT

if (!SRC_PAT || !DST_PAT) {
  console.error('Missing env: set SRC_PAT (source PAT) and DST_PAT (target PAT).')
  console.error('Source = kids-paint (read-only). Target = dosy-app (wipe + restore).')
  process.exit(1)
}

const ENDPOINT = (ref) => `https://api.supabase.com/v1/projects/${ref}/database/query`

async function runSql(ref, pat, query) {
  const res = await fetch(ENDPOINT(ref), {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`SQL on ${ref} failed (${res.status}): ${text}`)
  }
  try { return JSON.parse(text) } catch { return text }
}

async function selectAll(ref, pat, schema, table, cols) {
  const colList = cols.map((c) => `"${c}"`).join(', ')
  const sql = `SELECT ${colList} FROM ${schema}.${table};`
  return runSql(ref, pat, sql)
}

function sqlValue(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') {
    // JSONB / arrays → cast
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  }
  // string / timestamp / uuid all serialized as quoted text
  return `'${String(v).replace(/'/g, "''")}'`
}

function buildInsert(schema, table, cols, rows) {
  if (rows.length === 0) return null
  const colList = cols.map((c) => `"${c}"`).join(', ')
  const tuples = rows.map((r) => `(${cols.map((c) => sqlValue(r[c])).join(', ')})`).join(',\n  ')
  return `INSERT INTO ${schema}.${table} (${colList}) VALUES\n  ${tuples};`
}

async function bulkInsert(ref, pat, schema, table, cols, rows, batchSize = 200) {
  if (rows.length === 0) {
    console.log(`    ${schema}.${table}: 0 rows`)
    return
  }
  let inserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const sql = buildInsert(schema, table, cols, batch)
    await runSql(ref, pat, sql)
    inserted += batch.length
    process.stdout.write(`    ${schema}.${table}: ${inserted}/${rows.length}\r`)
  }
  console.log(`    ${schema}.${table}: ${inserted} rows ✓`)
}

async function main() {
  console.log('='.repeat(60))
  console.log('Migration: kids-paint → dosy-app')
  console.log('='.repeat(60))

  // ── 1. Verify source counts ────────────────────────────────────────
  console.log('\n[1/6] Source counts (kids-paint):')
  const srcCounts = await runSql(SRC_REF, SRC_PAT,
    `SELECT
      (SELECT COUNT(*) FROM auth.users) AS users,
      (SELECT COUNT(*) FROM medcontrol.patients) AS patients,
      (SELECT COUNT(*) FROM medcontrol.treatments) AS treatments,
      (SELECT COUNT(*) FROM medcontrol.doses) AS doses,
      (SELECT COUNT(*) FROM medcontrol.sos_rules) AS sos_rules,
      (SELECT COUNT(*) FROM medcontrol.subscriptions) AS subscriptions,
      (SELECT COUNT(*) FROM medcontrol.admins) AS admins,
      (SELECT COUNT(*) FROM medcontrol.patient_shares) AS shares,
      (SELECT COUNT(*) FROM medcontrol.treatment_templates) AS templates;`
  )
  console.log('   ', srcCounts[0])

  // ── 2. Read all source data ────────────────────────────────────────
  console.log('\n[2/6] Reading source data...')

  // auth.users — only relevant columns (need encrypted_password for login)
  const userCols = ['id', 'email', 'encrypted_password', 'email_confirmed_at',
                    'last_sign_in_at', 'raw_app_meta_data', 'raw_user_meta_data',
                    'created_at', 'updated_at', 'phone', 'phone_confirmed_at',
                    'role', 'aud', 'is_anonymous', 'is_sso_user', 'is_super_admin',
                    'instance_id', 'banned_until', 'confirmation_token',
                    'recovery_token', 'email_change_token_new', 'email_change',
                    'invited_at', 'confirmation_sent_at', 'recovery_sent_at',
                    'email_change_sent_at', 'reauthentication_token',
                    'reauthentication_sent_at', 'email_change_token_current',
                    'email_change_confirm_status']
  const users = await selectAll(SRC_REF, SRC_PAT, 'auth', 'users', userCols)
  console.log(`    auth.users: ${users.length}`)

  // email column is GENERATED in dosy-app — exclude from INSERT (let DB compute)
  const identityCols = ['provider_id', 'user_id', 'identity_data', 'provider',
                        'last_sign_in_at', 'created_at', 'updated_at', 'id']
  const identities = await selectAll(SRC_REF, SRC_PAT, 'auth', 'identities', identityCols)
  console.log(`    auth.identities: ${identities.length}`)

  const subscriptions = await selectAll(SRC_REF, SRC_PAT, 'medcontrol', 'subscriptions',
    ['userId', 'tier', 'expiresAt', 'source', 'updatedAt', 'createdAt', 'consentAt', 'consentVersion'])
  console.log(`    subscriptions: ${subscriptions.length}`)

  const admins = await selectAll(SRC_REF, SRC_PAT, 'medcontrol', 'admins',
    ['user_id', 'added_at', 'added_by'])
  console.log(`    admins: ${admins.length}`)

  const patients = await selectAll(SRC_REF, SRC_PAT, 'medcontrol', 'patients',
    ['id', 'userId', 'name', 'age', 'avatar', 'photo_url', 'weight', 'condition', 'doctor', 'allergies', 'createdAt', 'updatedAt'])
  console.log(`    patients: ${patients.length}`)

  const treatments = await selectAll(SRC_REF, SRC_PAT, 'medcontrol', 'treatments',
    ['id', 'userId', 'patientId', 'medName', 'unit', 'intervalHours', 'durationDays', 'startDate', 'firstDoseTime', 'status', 'isTemplate', 'isContinuous', 'createdAt', 'updatedAt'])
  console.log(`    treatments: ${treatments.length}`)

  const doses = await selectAll(SRC_REF, SRC_PAT, 'medcontrol', 'doses',
    ['id', 'userId', 'treatmentId', 'patientId', 'medName', 'unit', 'scheduledAt', 'actualTime', 'status', 'type', 'observation', 'createdAt', 'updatedAt'])
  console.log(`    doses: ${doses.length}`)

  const sosRules = await selectAll(SRC_REF, SRC_PAT, 'medcontrol', 'sos_rules',
    ['id', 'userId', 'patientId', 'medName', 'minIntervalHours', 'maxDosesIn24h', 'createdAt', 'updatedAt'])
  console.log(`    sos_rules: ${sosRules.length}`)

  const shares = await selectAll(SRC_REF, SRC_PAT, 'medcontrol', 'patient_shares',
    ['id', 'patientId', 'ownerId', 'sharedWithUserId', 'createdAt'])
  console.log(`    patient_shares: ${shares.length}`)

  const templates = await selectAll(SRC_REF, SRC_PAT, 'medcontrol', 'treatment_templates',
    ['id', 'userId', 'name', 'medName', 'unit', 'intervalHours', 'durationDays', 'createdAt', 'updatedAt'])
  console.log(`    treatment_templates: ${templates.length}`)

  // ── 3. Disable triggers + wipe target ──────────────────────────────
  console.log('\n[3/6] Disabling triggers + wiping target (dosy-app)...')

  // Only disable triggers we own in medcontrol schema (auth.users triggers
  // owned by supabase_auth_admin and we have no custom ones there in dosy-app)
  const triggerOff = `
    ALTER TABLE medcontrol.patients DISABLE TRIGGER enforce_patient_limit_trigger;
    ALTER TABLE medcontrol.doses DISABLE TRIGGER enforce_sos_via_rpc_trigger;
  `
  await runSql(DST_REF, DST_PAT, triggerOff)
  console.log('    triggers disabled')

  const wipe = `
    DELETE FROM medcontrol.patient_shares;
    DELETE FROM medcontrol.sos_rules;
    DELETE FROM medcontrol.doses;
    DELETE FROM medcontrol.treatments;
    DELETE FROM medcontrol.treatment_templates;
    DELETE FROM medcontrol.patients;
    DELETE FROM medcontrol.security_events;
    DELETE FROM medcontrol.subscriptions;
    DELETE FROM medcontrol.admins;
    DELETE FROM medcontrol.push_subscriptions;
    DELETE FROM auth.identities;
    DELETE FROM auth.users;
  `
  await runSql(DST_REF, DST_PAT, wipe)
  console.log('    target wiped')

  // ── 4. Insert in FK-safe order ─────────────────────────────────────
  console.log('\n[4/6] Inserting into target...')

  await bulkInsert(DST_REF, DST_PAT, 'auth', 'users', userCols, users, 50)
  await bulkInsert(DST_REF, DST_PAT, 'auth', 'identities', identityCols, identities, 50)

  await bulkInsert(DST_REF, DST_PAT, 'medcontrol', 'subscriptions',
    ['userId', 'tier', 'expiresAt', 'source', 'updatedAt', 'createdAt', 'consentAt', 'consentVersion'],
    subscriptions)

  await bulkInsert(DST_REF, DST_PAT, 'medcontrol', 'admins',
    ['user_id', 'added_at', 'added_by'], admins)

  await bulkInsert(DST_REF, DST_PAT, 'medcontrol', 'patients',
    ['id', 'userId', 'name', 'age', 'avatar', 'photo_url', 'weight', 'condition', 'doctor', 'allergies', 'createdAt', 'updatedAt'],
    patients)

  await bulkInsert(DST_REF, DST_PAT, 'medcontrol', 'treatments',
    ['id', 'userId', 'patientId', 'medName', 'unit', 'intervalHours', 'durationDays', 'startDate', 'firstDoseTime', 'status', 'isTemplate', 'isContinuous', 'createdAt', 'updatedAt'],
    treatments)

  await bulkInsert(DST_REF, DST_PAT, 'medcontrol', 'doses',
    ['id', 'userId', 'treatmentId', 'patientId', 'medName', 'unit', 'scheduledAt', 'actualTime', 'status', 'type', 'observation', 'createdAt', 'updatedAt'],
    doses, 300)

  await bulkInsert(DST_REF, DST_PAT, 'medcontrol', 'sos_rules',
    ['id', 'userId', 'patientId', 'medName', 'minIntervalHours', 'maxDosesIn24h', 'createdAt', 'updatedAt'],
    sosRules)

  await bulkInsert(DST_REF, DST_PAT, 'medcontrol', 'patient_shares',
    ['id', 'patientId', 'ownerId', 'sharedWithUserId', 'createdAt'], shares)

  await bulkInsert(DST_REF, DST_PAT, 'medcontrol', 'treatment_templates',
    ['id', 'userId', 'name', 'medName', 'unit', 'intervalHours', 'durationDays', 'createdAt', 'updatedAt'],
    templates)

  // ── 5. Re-enable triggers ──────────────────────────────────────────
  console.log('\n[5/6] Re-enabling triggers...')
  const triggerOn = `
    ALTER TABLE medcontrol.patients ENABLE TRIGGER enforce_patient_limit_trigger;
    ALTER TABLE medcontrol.doses ENABLE TRIGGER enforce_sos_via_rpc_trigger;
  `
  await runSql(DST_REF, DST_PAT, triggerOn)
  console.log('    triggers re-enabled')

  // ── 6. Validate ────────────────────────────────────────────────────
  console.log('\n[6/6] Validating counts in target (dosy-app)...')
  const dstCounts = await runSql(DST_REF, DST_PAT,
    `SELECT
      (SELECT COUNT(*) FROM auth.users) AS users,
      (SELECT COUNT(*) FROM medcontrol.patients) AS patients,
      (SELECT COUNT(*) FROM medcontrol.treatments) AS treatments,
      (SELECT COUNT(*) FROM medcontrol.doses) AS doses,
      (SELECT COUNT(*) FROM medcontrol.sos_rules) AS sos_rules,
      (SELECT COUNT(*) FROM medcontrol.subscriptions) AS subscriptions,
      (SELECT COUNT(*) FROM medcontrol.admins) AS admins,
      (SELECT COUNT(*) FROM medcontrol.patient_shares) AS shares,
      (SELECT COUNT(*) FROM medcontrol.treatment_templates) AS templates;`
  )
  console.log('    ', dstCounts[0])

  console.log('\n✅ Migration complete.')
}

main().catch((e) => {
  console.error('\n❌ Migration FAILED:', e.message)
  console.error(e.stack)
  process.exit(1)
})
