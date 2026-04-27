/**
 * finalize.cjs — Setup pg_cron + verify Plan.md items
 */
const { Client } = require('pg');
const DST = 'postgresql://postgres:xoeDZAnfn8TvBD5m@db.guefraaqbkcehofchnrc.supabase.co:5432/postgres';

(async () => {
  const c = new Client({ connectionString: DST, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('=== 1. Enable pg_cron ===');
  try {
    await c.query(`CREATE EXTENSION IF NOT EXISTS pg_cron`);
    console.log('  + pg_cron enabled');
  } catch (e) {
    console.log(`  ! ${e.message}`);
  }

  console.log('\n=== 2. Schedule anonymize-old-doses cron job ===');
  try {
    // Check if job already exists
    const { rows: existing } = await c.query(`SELECT jobid FROM cron.job WHERE jobname = 'anonymize-old-doses'`);
    if (existing.length > 0) {
      console.log(`  = already scheduled (jobid=${existing[0].jobid})`);
    } else {
      await c.query(`
        SELECT cron.schedule(
          'anonymize-old-doses',
          '0 3 * * 0',
          $$
            UPDATE medcontrol.doses
            SET observation = '[anonimizado]'
            WHERE "scheduledAt" < NOW() - INTERVAL '3 years'
              AND observation IS NOT NULL
              AND observation != '[anonimizado]'
          $$
        )
      `);
      console.log('  + scheduled (Sundays 3am)');
    }
  } catch (e) {
    console.log(`  ! ${e.message}`);
  }

  // ── Plan.md verification ──
  console.log('\n=== 3. Plan.md verification ===');

  // Tables
  const tables = ['admins','doses','patient_shares','patients','push_subscriptions','security_events','sos_rules','subscriptions','treatment_templates','treatments'];
  console.log('\n  Tables:');
  for (const t of tables) {
    const { rows } = await c.query(`SELECT 1 FROM pg_tables WHERE schemaname='medcontrol' AND tablename=$1`, [t]);
    console.log(`    ${rows.length ? '✓' : '✗'} ${t}`);
  }

  // Required functions (Plan.md sections 0.3, 0.9, 0.14.x)
  const fns = ['admin_grant_tier','is_admin','effective_tier','my_tier','register_sos_dose','create_treatment_with_doses','update_treatment_schedule','confirm_dose','skip_dose','undo_dose','delete_my_account','has_patient_access','share_patient_by_email','unshare_patient','list_patient_shares','enforce_patient_limit','admin_email','admin_list_users','on_new_user_subscription'];
  console.log('\n  Functions:');
  for (const f of fns) {
    const { rows } = await c.query(`
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='medcontrol' AND p.proname=$1
    `, [f]);
    console.log(`    ${rows.length ? '✓' : '✗'} ${f}()`);
  }

  // Required indexes (Plan.md 0.13)
  const idxs = ['doses_patient_scheduled_idx','doses_patient_status_scheduled_idx','treatments_patient_status_idx','push_subs_user_idx','sos_rules_patient_idx'];
  console.log('\n  Indexes (security):');
  for (const i of idxs) {
    const { rows } = await c.query(`SELECT 1 FROM pg_indexes WHERE schemaname='medcontrol' AND indexname=$1`, [i]);
    console.log(`    ${rows.length ? '✓' : '✗'} ${i}`);
  }

  // CASCADE on FKs (Plan.md 0.14.4)
  console.log('\n  CASCADE on critical FKs:');
  const cascades = [
    { tbl: 'doses', fk: 'doses_treatmentId_fkey', ref: 'treatments' },
    { tbl: 'doses', fk: 'doses_patientId_fkey', ref: 'patients' },
    { tbl: 'treatments', fk: 'treatments_patientId_fkey', ref: 'patients' },
    { tbl: 'sos_rules', fk: 'sos_rules_patientId_fkey', ref: 'patients' },
    { tbl: 'patient_shares', fk: 'patient_shares_patientId_fkey', ref: 'patients' }
  ];
  for (const cf of cascades) {
    const { rows } = await c.query(`
      SELECT pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid JOIN pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname='medcontrol' AND cl.relname=$1 AND c.contype='f' AND c.conname=$2
    `, [cf.tbl, cf.fk]);
    if (rows.length) {
      const cascade = rows[0].def.includes('CASCADE');
      console.log(`    ${cascade ? '✓' : '⚠'} ${cf.fk} ${cascade ? '' : '(no CASCADE!)'}`);
    } else {
      console.log(`    ✗ ${cf.fk} missing`);
    }
  }

  // RLS enabled + forced (Plan.md 0.2)
  console.log('\n  RLS:');
  const { rows: rlsRows } = await c.query(`
    SELECT cl.relname, cl.relrowsecurity, cl.relforcerowsecurity
    FROM pg_class cl JOIN pg_namespace n ON n.oid=cl.relnamespace
    WHERE n.nspname='medcontrol' AND cl.relkind='r' ORDER BY cl.relname
  `);
  for (const r of rlsRows) {
    console.log(`    ${r.relrowsecurity && r.relforcerowsecurity ? '✓' : '⚠'} ${r.relname} (rls=${r.relrowsecurity}, forced=${r.relforcerowsecurity})`);
  }

  // Consent columns (Plan.md 0.10)
  console.log('\n  Consent columns:');
  const { rows: consentCols } = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='medcontrol' AND table_name='subscriptions'
      AND column_name IN ('consentAt','consentVersion','consent_at','consent_version')
  `);
  console.log(`    ${consentCols.length ? '✓' : '✗'} subscriptions: ${consentCols.map(r=>r.column_name).join(', ') || 'MISSING'}`);

  // Cron jobs
  console.log('\n  pg_cron jobs:');
  const { rows: jobs } = await c.query(`SELECT jobname, schedule FROM cron.job ORDER BY jobname`);
  for (const j of jobs) console.log(`    ✓ ${j.jobname} (${j.schedule})`);
  if (jobs.length === 0) console.log('    ⚠ no jobs');

  // observation length check (Plan.md 0.14)
  console.log('\n  observation length constraint:');
  const { rows: obsCheck } = await c.query(`
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid JOIN pg_namespace n ON n.oid=c.connamespace
    WHERE n.nspname='medcontrol' AND cl.relname='doses' AND c.conname='doses_observation_length'
  `);
  console.log(`    ${obsCheck.length ? '✓' : '✗'} doses.observation length check`);

  await c.end();
})();
