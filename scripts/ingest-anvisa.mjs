/**
 * ETL: ANVISA medicamentos → Supabase medcontrol.medications_catalog
 *
 * Uso: node scripts/ingest-anvisa.mjs
 * Requer: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY no .env.local
 *         OU SUPABASE_URL + SUPABASE_SERVICE_KEY como env vars diretas.
 *
 * Fonte: https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv
 * Atualização: diária (D-1). Rodar novamente para refresh.
 * Colunas usadas: MARCA_COMERCIAL, DESCRICAO_PRODUTO, PRINCIPIO_ATIVO_DCB, SITUACAO_REGISTRO
 */

import { createClient } from '@supabase/supabase-js'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { createInterface } from 'readline'
import https from 'https'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CSV_PATH = path.join(ROOT, '.tmp_anvisa_meds.csv')
const CSV_URL = 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv'
const BATCH_SIZE = 500
const SCHEMA = 'medcontrol'

// ── Supabase client ──────────────────────────────────────────────────────────
async function getSupabaseClient() {
  let url, key
  try {
    const env = await readFile(path.join(ROOT, '.env.local'), 'utf8')
    const lines = env.split('\n')
    const get = (k) => (lines.find((l) => l.startsWith(k + '=')) || '').split('=').slice(1).join('=').trim()
    url = get('VITE_SUPABASE_URL')
    key = get('VITE_SUPABASE_ANON_KEY')
  } catch {
    // fallback to process env
  }
  url = url || process.env.SUPABASE_URL
  // Precisa de service role key (bypassa RLS) para INSERT
  // Adicione SUPABASE_SERVICE_KEY=<service_role_key> no .env.local
  // (Supabase Dashboard → Settings → API → service_role key)
  key = key || process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    console.error('❌ Variáveis não encontradas.')
    console.error('   Adicione ao .env.local:')
    console.error('   SUPABASE_URL=https://guefraaqbkcehofchnrc.supabase.co')
    console.error('   SUPABASE_SERVICE_KEY=<service_role_key do painel Supabase>')
    process.exit(1)
  }
  return createClient(url, key, { db: { schema: SCHEMA } })
}

// ── Download ─────────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close()
        return download(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      res.on('data', (chunk) => {
        received += chunk.length
        if (total > 0) process.stdout.write(`\r  Baixando... ${((received / total) * 100).toFixed(1)}%   `)
      })
      pipeline(res, file).then(resolve).catch(reject)
    })
    req.on('error', reject)
  })
}

// ── Parse CSV ─────────────────────────────────────────────────────────────────
// ANVISA CSV usa ponto-e-vírgula como separador, encoding latin-1 ou UTF-8 com BOM.
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = []
    let headers = null

    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'latin1' }),
      crlfDelay: Infinity,
    })

    rl.on('line', (raw) => {
      const line = raw.replace(/^﻿/, '') // strip BOM
      const cols = line.split(';').map((c) => c.replace(/^"|"$/g, '').trim())

      if (!headers) {
        headers = cols.map((h) => h.toUpperCase())
        return
      }

      const get = (key) => {
        const i = headers.indexOf(key)
        return i >= 0 ? (cols[i] || '').trim() : ''
      }

      const situacao = get('SITUACAO_REGISTRO')
      // Só meds com registro ativo
      if (situacao !== 'Ativo') return

      const nomeComercial = get('NOME_PRODUTO')
      const principio = get('PRINCIPIO_ATIVO')

      if (!nomeComercial || !principio) return

      rows.push({ nome_comercial: nomeComercial, principio_ativo: principio })
    })

    rl.on('close', () => resolve(rows))
    rl.on('error', reject)
  })
}

// ── Deduplicate ───────────────────────────────────────────────────────────────
function deduplicate(rows) {
  const seen = new Set()
  return rows.filter((r) => {
    const key = `${r.nome_comercial.toLowerCase()}|${r.principio_ativo.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Upsert batches ────────────────────────────────────────────────────────────
async function upsertBatches(supabase, rows) {
  let inserted = 0
  let errors = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .schema(SCHEMA)
      .from('medications_catalog')
      .upsert(batch, { onConflict: 'nome_comercial,principio_ativo', ignoreDuplicates: true })

    if (error) {
      console.warn(`\n  ⚠️  Batch ${i}–${i + batch.length} erro:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
    }
    process.stdout.write(`\r  Inserindo... ${i + batch.length}/${rows.length}   `)
  }
  return { inserted, errors }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌿 Dosy — Ingest ANVISA Medicamentos\n')

  const supabase = await getSupabaseClient()

  // 1. Download
  if (existsSync(CSV_PATH)) {
    console.log(`  CSV já existe em cache: ${CSV_PATH}`)
    console.log('  (Delete o arquivo para forçar re-download)\n')
  } else {
    console.log(`  Baixando CSV de ${CSV_URL}...`)
    await download(CSV_URL, CSV_PATH)
    console.log('\n  ✅ Download concluído\n')
  }

  // 2. Parse
  console.log('  Parseando CSV...')
  const rows = await parseCSV(CSV_PATH)
  console.log(`  ${rows.length} linhas válidas encontradas\n`)

  // 3. Deduplicate
  const unique = deduplicate(rows)
  console.log(`  ${unique.length} entradas únicas após dedup (${rows.length - unique.length} removidas)\n`)

  // 4. Upsert
  console.log('  Inserindo no Supabase...')
  const { inserted, errors } = await upsertBatches(supabase, unique)
  console.log(`\n\n  ✅ Concluído: ${inserted} inseridos, ${errors} com erro`)

  // 5. Verify
  const { count } = await supabase.schema(SCHEMA).from('medications_catalog').select('*', { count: 'exact', head: true })
  console.log(`  📊 Total na tabela: ${count} registros\n`)
}

main().catch((e) => { console.error('\n❌ Erro:', e.message); process.exit(1) })
