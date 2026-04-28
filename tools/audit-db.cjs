#!/usr/bin/env node
/**
 * audit-db.cjs — Read-only DB introspection via Supabase Management API.
 * Usage: SUPABASE_PAT=sbp_... PROJECT_REF=guefraa... node tools/audit-db.cjs '<SQL>'
 *
 * Bypassa RLS via service-side execution. Apenas para audits read-only.
 */
const PAT = process.env.SUPABASE_PAT
const REF = process.env.PROJECT_REF || 'guefraaqbkcehofchnrc'
if (!PAT) { console.error('Missing SUPABASE_PAT env'); process.exit(1) }

const sql = process.argv[2]
if (!sql) { console.error('Missing SQL arg'); process.exit(1) }

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
    console.error('HTTP', r.status, text)
    process.exit(1)
  }
  console.log(text)
})()
