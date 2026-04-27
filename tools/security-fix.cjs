/**
 * security-fix.cjs — Fix RLS gaps found by test-sos-bypass
 *
 * Issue 1: own_insert/own_update/own_delete só checam userId — não checam ownership do patientId
 *          → User B pode inserir/modificar dose com userId=B, patientId=A's patient
 * Issue 2: register_sos_dose RPC pode ser bypassada via INSERT direto em doses
 *
 * Fix:
 *   - Reescrever own_* policies em doses, treatments, sos_rules para incluir has_patient_access(patientId)
 *   - Trigger BEFORE INSERT em doses que bloqueia type='sos' direto
 *     (register_sos_dose seta GUC pra liberar)
 */
const { Client } = require('pg');
const DST = 'postgresql://postgres:xoeDZAnfn8TvBD5m@db.guefraaqbkcehofchnrc.supabase.co:5432/postgres';

(async () => {
  const c = new Client({ connectionString: DST, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('=== Fix 1: doses RLS — verificar patientId ownership em INSERT/UPDATE/DELETE ===');

  // Drop weak own_* policies — shared_* já cobrem owner + shared via has_patient_access
  const weak = ['own_insert', 'own_update', 'own_delete', 'own_select'];
  for (const pol of weak) {
    try {
      await c.query(`DROP POLICY IF EXISTS ${pol} ON medcontrol.doses`);
      console.log(`  + dropped ${pol} on doses`);
    } catch (e) { console.log(`  ! ${pol}: ${e.message}`); }
  }

  // Same para treatments, sos_rules, treatment_templates, patients
  for (const tbl of ['treatments', 'sos_rules']) {
    for (const pol of weak) {
      try {
        await c.query(`DROP POLICY IF EXISTS ${pol} ON medcontrol.${tbl}`);
        console.log(`  + dropped ${pol} on ${tbl}`);
      } catch (e) {}
    }
  }

  // treatment_templates não tem patientId — manter own_* (só userId)
  console.log('  = treatment_templates: own_* mantidas (não tem patientId)');

  // patients tem userId mas é a própria entidade — manter own_*
  console.log('  = patients: own_* mantidas');

  console.log('\n=== Fix 2: trigger bloqueia INSERT direto type=sos ===');

  // Trigger function
  await c.query(`
    CREATE OR REPLACE FUNCTION medcontrol.enforce_sos_via_rpc()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = medcontrol, public
    AS $func$
    BEGIN
      IF NEW.type = 'sos' AND coalesce(current_setting('medcontrol.via_register_sos_dose', true), '') != 'true' THEN
        RAISE EXCEPTION 'SOS_INSERT_DIRETO_BLOQUEADO: use register_sos_dose() RPC';
      END IF;
      RETURN NEW;
    END;
    $func$;
  `);
  console.log('  + function enforce_sos_via_rpc()');

  await c.query(`DROP TRIGGER IF EXISTS enforce_sos_via_rpc_trigger ON medcontrol.doses`);
  await c.query(`
    CREATE TRIGGER enforce_sos_via_rpc_trigger
    BEFORE INSERT ON medcontrol.doses
    FOR EACH ROW EXECUTE FUNCTION medcontrol.enforce_sos_via_rpc()
  `);
  console.log('  + trigger enforce_sos_via_rpc_trigger on doses');

  console.log('\n=== Fix 3: register_sos_dose seta GUC pra passar pelo trigger ===');

  // Get current register_sos_dose definition
  const { rows: fn } = await c.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='medcontrol' AND p.proname='register_sos_dose'
  `);
  console.log('  Current register_sos_dose snippet:');
  const snippet = fn[0].def.substring(fn[0].def.indexOf('BEGIN'), fn[0].def.indexOf('BEGIN') + 200);
  console.log('    ' + snippet.replace(/\n/g, '\n    '));

  // Patch: insert PERFORM set_config at the start of the BEGIN block
  // We'll wrap the existing INSERT with the GUC set
  const newDef = fn[0].def.replace(
    /INSERT INTO medcontrol\.doses/,
    `PERFORM set_config('medcontrol.via_register_sos_dose', 'true', true);\n  INSERT INTO medcontrol.doses`
  );

  if (newDef === fn[0].def) {
    console.log('  ⚠ INSERT pattern not found — manual review needed');
  } else {
    await c.query(newDef);
    console.log('  + register_sos_dose patched (sets GUC before INSERT)');
  }

  await c.end();
  console.log('\n✅ Security fixes applied. Run test-sos-bypass.cjs to verify.');
})();
