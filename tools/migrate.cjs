/**
 * migrate.js â€” Full DB migration: kids-paint â†’ dosy-app
 * Migrates: medcontrol schema (DDL + data) + auth.users + auth.identities
 * Does NOT touch: Vercel PWA (dosy-teal.vercel.app) stays on kids-paint
 */
const { Client } = require('pg');

const SRC_URL = process.env.LEGACY_KP_DB_URL;
const DST_URL = process.env.DOSY_DB_URL;
const SCHEMA  = 'medcontrol';

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function connect(url, label) {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`âœ” Connected: ${label}`);
  return c;
}

async function exec(client, sql, params = [], label = '') {
  try {
    return await client.query(sql, params);
  } catch (e) {
    const msg = `SQL Error${label ? ' [' + label + ']' : ''}: ${e.message}`;
    console.error(msg);
    console.error('  SQL preview:', sql.slice(0, 300));
    throw e;
  }
}

async function tryExec(client, sql, params = [], label = '') {
  try {
    await client.query(sql, params);
    return true;
  } catch (e) {
    console.log(`  âš  ${label || sql.slice(0, 60)}: ${e.message}`);
    return false;
  }
}

// â”€â”€ main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function migrate() {
  const src = await connect(SRC_URL, 'source (kids-paint)');
  const dst = await connect(DST_URL, 'target (dosy-app)');

  try {

    // â”€â”€ 1. Schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 1. Creating schema â”€â”€');
    await exec(dst, `CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
    console.log(`  + schema ${SCHEMA}`);

    // â”€â”€ 2. Extensions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 2. Extensions â”€â”€');
    const { rows: exts } = await src.query(`
      SELECT extname FROM pg_extension
      WHERE extname NOT IN ('plpgsql', 'pg_net')
      ORDER BY extname
    `);
    for (const { extname } of exts) {
      await tryExec(dst, `CREATE EXTENSION IF NOT EXISTS "${extname}"`, [], `ext: ${extname}`);
      console.log(`  + ${extname}`);
    }

    // â”€â”€ 3. Enum types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 3. Enum types â”€â”€');
    const { rows: enums } = await src.query(`
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = $1
      GROUP BY t.typname
    `, [SCHEMA]);
    for (const { typname, labels } of enums) {
      const vals = labels.map(l => `'${l}'`).join(', ');
      await tryExec(dst, `CREATE TYPE ${SCHEMA}.${typname} AS ENUM (${vals})`, [], `enum: ${typname}`);
      console.log(`  + ${typname}: [${labels.join(', ')}]`);
    }

    // â”€â”€ 4. Tables (without FK) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 4. Tables â”€â”€');
    const { rows: tables } = await src.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename
    `, [SCHEMA]);

    for (const { tablename } of tables) {
      // Column definitions
      const { rows: cols } = await src.query(`
        SELECT
          a.attname                                                     AS col,
          pg_catalog.format_type(a.atttypid, a.atttypmod)              AS dtype,
          a.attnotnull                                                  AS notnull,
          pg_catalog.pg_get_expr(d.adbin, d.adrelid)                   AS dflt,
          a.attidentity                                                 AS identity
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = $1 AND c.relname = $2
        ORDER BY a.attnum
      `, [SCHEMA, tablename]);

      const colDefs = cols.map(({ col, dtype, notnull, dflt, identity }) => {
        let def = `"${col}" ${dtype}`;
        if (identity === 'a')      def += ' GENERATED ALWAYS AS IDENTITY';
        else if (identity === 'd') def += ' GENERATED BY DEFAULT AS IDENTITY';
        else if (dflt)             def += ` DEFAULT ${dflt}`;
        if (notnull)               def += ' NOT NULL';
        return def;
      });

      // Primary key
      const { rows: pk } = await src.query(`
        SELECT array_agg(a.attname ORDER BY x.ord) AS cols
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS x(attnum, ord) ON true
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum
        WHERE c.contype = 'p' AND n.nspname = $1 AND cl.relname = $2
        GROUP BY c.oid
      `, [SCHEMA, tablename]);

      // Parse pk cols â€” pg may return name[] as JS array or as '{col1,col2}' string
      let pkCols = [];
      if (pk[0]?.cols) {
        const raw = pk[0].cols;
        if (Array.isArray(raw)) pkCols = raw;
        else if (typeof raw === 'string') pkCols = raw.replace(/[{}]/g,'').split(',').filter(Boolean);
      }
      if (pkCols.length) {
        colDefs.push(`PRIMARY KEY (${pkCols.map(c => `"${c}"`).join(', ')})`);
      }

      const ddl = `CREATE TABLE IF NOT EXISTS ${SCHEMA}."${tablename}" (\n  ${colDefs.join(',\n  ')}\n)`;
      await tryExec(dst, ddl, [], `table: ${tablename}`);

      // Add PK separately in case table already existed without it
      if (pkCols.length) {
        await tryExec(dst,
          `ALTER TABLE ${SCHEMA}."${tablename}" ADD PRIMARY KEY (${pkCols.map(c=>`"${c}"`).join(', ')})`,
          [], `pk: ${tablename}`
        );
      }
      console.log(`  + ${tablename} (${cols.length} cols, pk: ${pkCols.join(',')||'none'})`);
    }

    // â”€â”€ 5. Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 5. Data â”€â”€');
    for (const { tablename } of tables) {
      const { rows } = await src.query(`SELECT * FROM ${SCHEMA}."${tablename}"`);
      if (rows.length === 0) { console.log(`  = ${tablename}: empty`); continue; }

      // Disable triggers temporarily for data load
      await tryExec(dst, `ALTER TABLE ${SCHEMA}."${tablename}" DISABLE TRIGGER ALL`, [], '');

      const colNames = Object.keys(rows[0]).map(k => `"${k}"`).join(', ');
      let inserted = 0;

      for (const row of rows) {
        const vals = Object.values(row);
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
        const ok = await tryExec(
          dst,
          `INSERT INTO ${SCHEMA}."${tablename}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          vals,
          `insert row`
        );
        if (ok) inserted++;
      }

      await tryExec(dst, `ALTER TABLE ${SCHEMA}."${tablename}" ENABLE TRIGGER ALL`, [], '');
      console.log(`  + ${tablename}: ${inserted}/${rows.length} rows`);
    }

    // â”€â”€ 6. Sequences â€” reset to current max â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 6. Resetting sequences â”€â”€');
    const { rows: seqInfo } = await src.query(`
      SELECT sequencename, last_value
      FROM pg_sequences
      WHERE schemaname = $1
    `, [SCHEMA]);
    for (const seq of seqInfo) {
      const val = seq.last_value ? parseInt(seq.last_value) : 1;
      await tryExec(dst,
        `SELECT setval('${SCHEMA}."${seq.sequencename}"', ${val}, true)`,
        [], `seq: ${seq.sequencename}`
      );
      console.log(`  + ${seq.sequencename} â†’ ${val}`);
    }

    // â”€â”€ 6b. auth.users â€” migrate BEFORE FK constraints (tables ref auth.users) â”€â”€
    console.log('\nâ”€â”€ 6b. auth.users (needed before FK constraints) â”€â”€');

    // Find which columns in DST auth.users are GENERATED (cannot be inserted)
    const { rows: generatedCols } = await dst.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users'
        AND is_generated = 'ALWAYS'
    `);
    const generatedSet = new Set(generatedCols.map(r => r.column_name));
    console.log(`  Generated cols (skip): ${[...generatedSet].join(', ') || 'none'}`);

    const { rows: usersEarly } = await src.query(`SELECT * FROM auth.users ORDER BY created_at`);
    console.log(`  Found ${usersEarly.length} users`);
    let uEarly = 0;
    for (const user of usersEarly) {
      // Only insert columns that exist and aren't generated in the destination
      const keys = Object.keys(user).filter(k => !generatedSet.has(k));
      const vals = keys.map(k => user[k]);
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
      const ok = await tryExec(dst,
        `INSERT INTO auth.users (${keys.map(k=>`"${k}"`).join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
        vals, `user: ${user.email}`
      );
      if (ok) { uEarly++; console.log(`  + ${user.email}`); }
    }
    console.log(`  Users: ${uEarly}/${usersEarly.length}`);

    // auth.identities â€” also check for generated columns
    const { rows: genIdentCols } = await dst.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'identities'
        AND is_generated = 'ALWAYS'
    `);
    const genIdentSet = new Set(genIdentCols.map(r => r.column_name));

    const { rows: identitiesEarly } = await src.query(`SELECT * FROM auth.identities`);
    let iEarly = 0;
    for (const id of identitiesEarly) {
      const keys = Object.keys(id).filter(k => !genIdentSet.has(k));
      const vals = keys.map(k => id[k]);
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
      const ok = await tryExec(dst,
        `INSERT INTO auth.identities (${keys.map(k=>`"${k}"`).join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        vals, `identity`
      );
      if (ok) iEarly++;
    }
    console.log(`  Identities: ${iEarly}/${identitiesEarly.length}`);

    // â”€â”€ 7. Constraints (CHECK, UNIQUE, FK) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 7. Constraints (check / unique / fk) â”€â”€');
    // Set search_path so FK references resolve to medcontrol schema
    await dst.query(`SET search_path TO ${SCHEMA}, public, auth`);
    const { rows: constraints } = await src.query(`
      SELECT
        c.contype,
        c.conname,
        cl.relname AS table_name,
        pg_get_constraintdef(c.oid, true) AS condef
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE c.contype IN ('c','u','f') AND n.nspname = $1
      ORDER BY CASE c.contype WHEN 'c' THEN 1 WHEN 'u' THEN 2 WHEN 'f' THEN 3 END
    `, [SCHEMA]);

    for (const { contype, conname, table_name, condef } of constraints) {
      const label = `${contype === 'f' ? 'fk' : contype === 'u' ? 'unique' : 'check'}: ${conname}`;
      const ok = await tryExec(
        dst,
        `ALTER TABLE ${SCHEMA}."${table_name}" ADD CONSTRAINT "${conname}" ${condef}`,
        [], label
      );
      if (ok) console.log(`  + ${label}`);
    }

    // â”€â”€ 8. Indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 8. Indexes â”€â”€');
    const { rows: indexes } = await src.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = $1
        AND indexname NOT IN (
          SELECT conname FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          WHERE n.nspname = $1
        )
    `, [SCHEMA]);
    for (const { indexname, indexdef } of indexes) {
      const ok = await tryExec(dst, indexdef, [], `idx: ${indexname}`);
      if (ok) console.log(`  + ${indexname}`);
    }

    // â”€â”€ 9. Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 9. Functions â”€â”€');
    const { rows: funcs } = await src.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = $1 AND p.prokind IN ('f','p')
      ORDER BY p.proname
    `, [SCHEMA]);
    for (const { proname, def } of funcs) {
      const ok = await tryExec(dst, def, [], `fn: ${proname}`);
      if (ok) console.log(`  + ${proname}()`);
    }

    // â”€â”€ 10. Triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 10. Triggers â”€â”€');
    const { rows: triggers } = await src.query(`
      SELECT t.tgname, cl.relname AS tbl, pg_get_triggerdef(t.oid) AS def
      FROM pg_trigger t
      JOIN pg_class cl ON cl.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = $1 AND NOT t.tgisinternal
    `, [SCHEMA]);
    for (const { tgname, tbl, def } of triggers) {
      const ok = await tryExec(dst, def, [], `trigger: ${tgname} on ${tbl}`);
      if (ok) console.log(`  + ${tgname} on ${tbl}`);
    }

    // â”€â”€ 11. RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 11. RLS + Policies â”€â”€');
    const { rows: rlsTbls } = await src.query(`
      SELECT cl.relname
      FROM pg_class cl
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = $1 AND cl.relrowsecurity = true AND cl.relkind = 'r'
    `, [SCHEMA]);
    for (const { relname } of rlsTbls) {
      await tryExec(dst, `ALTER TABLE ${SCHEMA}."${relname}" ENABLE ROW LEVEL SECURITY`, [], `rls: ${relname}`);
      await tryExec(dst, `ALTER TABLE ${SCHEMA}."${relname}" FORCE ROW LEVEL SECURITY`, [], '');
      console.log(`  + RLS: ${relname}`);
    }

    const { rows: policies } = await src.query(`
      SELECT policyname, tablename, permissive, roles, cmd, qual, with_check
      FROM pg_policies WHERE schemaname = $1
    `, [SCHEMA]);
    for (const p of policies) {
      const permissive = p.permissive === 'PERMISSIVE' ? 'PERMISSIVE' : 'RESTRICTIVE';
      // pg returns name[] as JS array or as '{role1,role2}' string â€” handle both
      let rolesArr = p.roles;
      if (typeof rolesArr === 'string') rolesArr = rolesArr.replace(/[{}]/g,'').split(',').filter(Boolean);
      const roles = (Array.isArray(rolesArr) && rolesArr.length) ? rolesArr.join(', ') : 'PUBLIC';
      let sql = `CREATE POLICY "${p.policyname}" ON ${SCHEMA}."${p.tablename}" AS ${permissive} FOR ${p.cmd} TO ${roles}`;
      if (p.qual)        sql += ` USING (${p.qual})`;
      if (p.with_check)  sql += ` WITH CHECK (${p.with_check})`;
      const ok = await tryExec(dst, sql, [], `policy: ${p.policyname}`);
      if (ok) console.log(`  + ${p.policyname} on ${p.tablename}`);
    }

    // â”€â”€ 12. Grants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('\nâ”€â”€ 12. Grants â”€â”€');
    await exec(dst, `GRANT USAGE ON SCHEMA ${SCHEMA} TO anon, authenticated, service_role`);
    await exec(dst, `GRANT ALL ON ALL TABLES IN SCHEMA ${SCHEMA} TO anon, authenticated, service_role`);
    await exec(dst, `GRANT ALL ON ALL SEQUENCES IN SCHEMA ${SCHEMA} TO anon, authenticated, service_role`);
    await exec(dst, `GRANT ALL ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} TO anon, authenticated, service_role`);
    console.log('  + anon, authenticated, service_role');

    // auth.users + identities already migrated in step 6b (before FK constraints)

    console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('âœ…  MIGRATION COMPLETE');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

  } finally {
    await src.end();
    await dst.end();
  }
}

migrate().catch(e => {
  console.error('\nâŒ FATAL:', e.message);
  process.exit(1);
});

