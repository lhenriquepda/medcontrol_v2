/**
 * cleanup.cjs — dedup data, add PKs, add missing FKs/uniques
 */
const { Client } = require('pg');
const SRC = 'postgresql://postgres:bJkXaiMIbQlc9ZWP@db.oubmmyitpahbcsjrhcxr.supabase.co:5432/postgres';
const DST = 'postgresql://postgres:xoeDZAnfn8TvBD5m@db.guefraaqbkcehofchnrc.supabase.co:5432/postgres';
const SCHEMA = 'medcontrol';

async function main() {
  const src = new Client({ connectionString: SRC, ssl: { rejectUnauthorized: false } });
  const dst = new Client({ connectionString: DST, ssl: { rejectUnauthorized: false } });
  await src.connect();
  await dst.connect();

  // ── 1. Get PK columns from source for each table ──────────────────────
  const { rows: tables } = await src.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename
  `, [SCHEMA]);

  console.log('=== 1. Dedup + add PKs ===\n');
  for (const { tablename } of tables) {
    const { rows: pkRows } = await src.query(`
      SELECT array_agg(a.attname ORDER BY x.ord) AS cols
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS x(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum
      WHERE c.contype = 'p' AND n.nspname = $1 AND cl.relname = $2
      GROUP BY c.oid
    `, [SCHEMA, tablename]);
    if (pkRows.length === 0) {
      console.log(`  ${tablename}: no PK in source — skip`);
      continue;
    }
    let pkCols = pkRows[0].cols;
    if (typeof pkCols === 'string') pkCols = pkCols.replace(/[{}]/g,'').split(',').filter(Boolean);
    const pkExpr = pkCols.map(c => `"${c}"`).join(', ');
    const pkName = `${tablename}_pkey`;

    // Check if PK already exists in dst
    const { rows: existing } = await dst.query(`
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE c.contype = 'p' AND n.nspname = $1 AND cl.relname = $2
    `, [SCHEMA, tablename]);
    if (existing.length > 0) {
      console.log(`  ${tablename}: PK already exists, skip`);
      continue;
    }

    // Count rows + duplicates
    const { rows: count } = await dst.query(`SELECT COUNT(*) AS n FROM ${SCHEMA}."${tablename}"`);
    const total = parseInt(count[0].n);
    const { rows: dupCount } = await dst.query(`
      SELECT COUNT(*) AS n FROM (
        SELECT ${pkExpr}, COUNT(*) AS c FROM ${SCHEMA}."${tablename}" GROUP BY ${pkExpr} HAVING COUNT(*) > 1
      ) t
    `);
    const dups = parseInt(dupCount[0].n);

    if (dups > 0) {
      // Dedup: keep oldest ctid for each PK group
      console.log(`  ${tablename}: ${total} rows, ${dups} duplicate PK groups → dedup`);
      await dst.query(`
        DELETE FROM ${SCHEMA}."${tablename}" a
        USING ${SCHEMA}."${tablename}" b
        WHERE a.ctid < b.ctid
          AND ${pkCols.map(c => `a."${c}" = b."${c}"`).join(' AND ')}
      `);
      const { rows: newCount } = await dst.query(`SELECT COUNT(*) AS n FROM ${SCHEMA}."${tablename}"`);
      console.log(`    after: ${newCount[0].n} rows`);
    } else {
      console.log(`  ${tablename}: ${total} rows, no dups`);
    }

    // Add PK
    try {
      await dst.query(`ALTER TABLE ${SCHEMA}."${tablename}" ADD CONSTRAINT "${pkName}" PRIMARY KEY (${pkExpr})`);
      console.log(`    + PK on (${pkExpr})`);
    } catch (e) {
      console.log(`    ! PK fail: ${e.message}`);
    }
  }

  // ── 2. Add unique constraints from source ─────────────────────────────
  console.log('\n=== 2. Unique constraints ===\n');
  const { rows: uqs } = await src.query(`
    SELECT cl.relname AS tbl, c.conname, pg_get_constraintdef(c.oid, true) AS def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE c.contype = 'u' AND n.nspname = $1
  `, [SCHEMA]);
  for (const u of uqs) {
    const { rows: ex } = await dst.query(`
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.contype = 'u' AND n.nspname = $1 AND c.conname = $2
    `, [SCHEMA, u.conname]);
    if (ex.length > 0) { console.log(`  ${u.conname}: exists, skip`); continue; }

    try {
      await dst.query(`ALTER TABLE ${SCHEMA}."${u.tbl}" ADD CONSTRAINT "${u.conname}" ${u.def}`);
      console.log(`  + ${u.conname}`);
    } catch (e) {
      console.log(`  ! ${u.conname}: ${e.message}`);
    }
  }

  // ── 3. Add missing FKs ─────────────────────────────────────────────────
  console.log('\n=== 3. FKs ===\n');
  await dst.query(`SET search_path TO ${SCHEMA}, public, auth`);

  const { rows: fks } = await src.query(`
    SELECT cl.relname AS tbl, c.conname, pg_get_constraintdef(c.oid, true) AS def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE c.contype = 'f' AND n.nspname = $1
  `, [SCHEMA]);

  // Track which FK definitions we've already applied (dedup duplicate FKs from source)
  const seenFkDefs = new Set();

  for (const fk of fks) {
    const key = `${fk.tbl}::${fk.def}`;
    if (seenFkDefs.has(key)) {
      console.log(`  ${fk.conname}: dup definition of existing FK, skip`);
      continue;
    }
    seenFkDefs.add(key);

    // Check if FK with same definition already exists
    const { rows: existing } = await dst.query(`
      SELECT conname FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE c.contype = 'f' AND n.nspname = $1 AND cl.relname = $2
        AND pg_get_constraintdef(c.oid, true) = $3
    `, [SCHEMA, fk.tbl, fk.def]);
    if (existing.length > 0) {
      console.log(`  ${fk.conname}: equiv exists as ${existing[0].conname}, skip`);
      continue;
    }

    try {
      await dst.query(`ALTER TABLE ${SCHEMA}."${fk.tbl}" ADD CONSTRAINT "${fk.conname}" ${fk.def}`);
      console.log(`  + ${fk.conname}: ${fk.def}`);
    } catch (e) {
      console.log(`  ! ${fk.conname}: ${e.message}`);
    }
  }

  // ── 4. Final verification ──────────────────────────────────────────────
  console.log('\n=== 4. Verification ===\n');
  for (const { tablename } of tables) {
    const r = await dst.query(`SELECT COUNT(*) AS n FROM ${SCHEMA}."${tablename}"`);
    console.log(`  ${tablename}: ${r.rows[0].n} rows`);
  }

  await src.end();
  await dst.end();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
