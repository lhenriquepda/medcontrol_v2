#!/usr/bin/env node
/**
 * apply-migration.cjs — Aplica arquivo SQL de migration via Supabase Management API.
 *
 * Workaround pra ausência de Docker Desktop (supabase db push exige).
 * Lê SQL inteiro e POST pra /v1/projects/{ref}/database/query (executa como service role).
 *
 * Usage:
 *   SUPABASE_PAT=sbp_xxx node tools/apply-migration.cjs supabase/migrations/20260428_xxx.sql
 *
 * Env vars:
 *   SUPABASE_PAT      — Personal Access Token (sbp_xxx) — REQUIRED
 *   PROJECT_REF       — Project ref (default: guefraaqbkcehofchnrc)
 */
const fs = require('fs')
const path = require('path')

const PAT = process.env.SUPABASE_PAT
const REF = process.env.PROJECT_REF || 'guefraaqbkcehofchnrc'
const file = process.argv[2]

if (!PAT) {
  console.error('Missing SUPABASE_PAT env')
  process.exit(1)
}
if (!file) {
  console.error('Usage: SUPABASE_PAT=sbp_xxx node tools/apply-migration.cjs <file.sql>')
  process.exit(1)
}

const fullPath = path.resolve(file)
if (!fs.existsSync(fullPath)) {
  console.error(`File not found: ${fullPath}`)
  process.exit(1)
}

const sql = fs.readFileSync(fullPath, 'utf8')
console.log(`Applying ${path.basename(fullPath)} (${sql.length} chars)...`)

;(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  })
  const text = await r.text()
  if (!r.ok) {
    console.error(`HTTP ${r.status}:`, text)
    process.exit(1)
  }
  console.log('✓ Migration applied successfully')
  // Show response if non-empty (CREATE/SELECT outputs)
  try {
    const json = JSON.parse(text)
    if (Array.isArray(json) && json.length > 0) {
      console.log('Response:', JSON.stringify(json, null, 2).slice(0, 500))
    }
  } catch {
    if (text.length < 500) console.log('Response:', text)
  }
})()
