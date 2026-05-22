#!/usr/bin/env node
/**
 * backfill-catalog-groups — v0.2.4.0 Categorias de Medicamentos
 *
 * One-shot script: percorre medications_catalog inteiro, aplica heurística
 * de classificação (dicionário princípio_ativo + keyword), preenche group_id
 * + principio_ativo_normalizado em batch UPDATE.
 *
 * Roda ANTES do ingest CMED (que sobrescreve com classes oficiais via EAN).
 *
 * Uso:
 *   node scripts/backfill-catalog-groups.mjs           # dry-run (mostra prévia)
 *   node scripts/backfill-catalog-groups.mjs --apply   # commit no DB
 *
 * Source-of-truth: usa creds de .env.local (SUPABASE_SERVICE_ROLE_KEY).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyMedication, normalize } from './lib/classify-medication.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Parse .env.local manualmente (sem dependência dotenv)
function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const localEnv = loadEnv(path.join(ROOT, '.env.local'))
const baseEnv = loadEnv(path.join(ROOT, '.env'))

const SUPABASE_URL = baseEnv.VITE_SUPABASE_URL || 'https://guefraaqbkcehofchnrc.supabase.co'
const SERVICE_KEY = localEnv.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY em .env.local')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')

console.log(`[backfill-catalog-groups] mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`)
console.log(`[backfill-catalog-groups] supabase=${SUPABASE_URL}`)

async function rpc(sql) {
  // PostgREST raw via service role — usa Storage URL e SQL via /rest/v1/rpc/{exec_sql}
  // Como não temos exec_sql RPC, usa fetch direto em /rest/v1/medications_catalog
  throw new Error('use fetch directly')
}

async function fetchCatalog() {
  // Fetch em batches de 1000
  const all = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/medications_catalog?select=id,nome_comercial,principio_ativo,group_id,cmed_class,principio_ativo_normalizado&order=id&limit=${PAGE}&offset=${offset}`
    const r = await fetch(url, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept-Profile': 'medcontrol',
      },
    })
    if (!r.ok) {
      throw new Error(`fetch catalog failed: ${r.status} ${await r.text()}`)
    }
    const batch = await r.json()
    if (!batch.length) break
    all.push(...batch)
    if (batch.length < PAGE) break
    offset += PAGE
  }
  return all
}

async function patchRow(id, body) {
  const url = `${SUPABASE_URL}/rest/v1/medications_catalog?id=eq.${id}`
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'medcontrol',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const txt = await r.text()
    throw new Error(`patch ${id} failed: ${r.status} ${txt}`)
  }
}

async function main() {
  console.log('[backfill-catalog-groups] fetching catalog...')
  const rows = await fetchCatalog()
  console.log(`[backfill-catalog-groups] ${rows.length} rows no catálogo`)

  const counts = {
    total: rows.length,
    already: 0,
    classified: 0,
    unclassified: 0,
    bySource: { cmed: 0, principio_dict: 0, principio_keyword: 0, none: 0 },
    byGroup: {},
  }

  const updates = []

  for (const row of rows) {
    const norm = normalize(row.principio_ativo)
    const needsNormalized = norm && row.principio_ativo_normalizado !== norm

    if (row.group_id) {
      counts.already += 1
      if (needsNormalized) {
        updates.push({ id: row.id, body: { principio_ativo_normalizado: norm } })
      }
      continue
    }

    const result = classifyMedication({ principio_ativo: row.principio_ativo })
    counts.bySource[result.source] = (counts.bySource[result.source] || 0) + 1

    if (result.group_id) {
      counts.classified += 1
      counts.byGroup[result.group_id] = (counts.byGroup[result.group_id] || 0) + 1
      updates.push({
        id: row.id,
        body: { group_id: result.group_id, principio_ativo_normalizado: norm || null },
      })
    } else {
      counts.unclassified += 1
      if (needsNormalized) {
        updates.push({ id: row.id, body: { principio_ativo_normalizado: norm } })
      }
    }
  }

  console.log('[backfill-catalog-groups] resumo:')
  console.log(JSON.stringify(counts, null, 2))
  console.log(`[backfill-catalog-groups] ${updates.length} rows com mudanças pendentes`)

  if (!APPLY) {
    console.log('[backfill-catalog-groups] dry-run, sample primeiras 5 updates:')
    console.log(JSON.stringify(updates.slice(0, 5), null, 2))
    return
  }

  console.log('[backfill-catalog-groups] APPLY mode — aplicando updates...')
  let i = 0
  let failed = 0
  for (const upd of updates) {
    try {
      await patchRow(upd.id, upd.body)
      i += 1
      if (i % 100 === 0) console.log(`  ${i}/${updates.length}`)
    } catch (e) {
      failed += 1
      console.error(`  fail ${upd.id}: ${e.message}`)
    }
  }
  console.log(`[backfill-catalog-groups] done. ${i} OK, ${failed} fail.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
