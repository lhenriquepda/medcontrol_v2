#!/usr/bin/env node
import { remote } from 'webdriverio'
import { writeFileSync, appendFileSync } from 'node:fs'

const REPORT = 'C:/temp/dosy_test/qa_owner_drill.md'
writeFileSync(REPORT, `# Owner drill v0.2.3.7 — ${new Date().toISOString()}\n\n`)
const log = (line) => { console.log(line); appendFileSync(REPORT, line + '\n') }

const caps = (udid) => ({
  hostname: '127.0.0.1', port: 4723, path: '/', logLevel: 'error',
  capabilities: {
    platformName: 'Android', 'appium:automationName': 'UiAutomator2',
    'appium:udid': udid,
    'appium:appPackage': 'com.dosyapp.dosy.dev',
    'appium:appActivity': 'com.dosyapp.dosy.MainActivity',
    'appium:noReset': true,
    'appium:newCommandTimeout': 180
  }
})
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function texts(d) {
  const src = await d.getPageSource()
  return [...src.matchAll(/text="([^"]{2,120})"/g)].map(m => m[1])
}

async function tap(d, xp, t=8000) {
  const el = await d.$(xp)
  await el.waitForDisplayed({ timeout: t })
  await el.click()
  await sleep(1800)
}

async function check(name, fn) {
  try {
    const r = await fn()
    log(`✅ ${name}` + (r ? ` — ${r}` : ''))
    return true
  } catch (e) {
    log(`❌ ${name} — ${e.message}`)
    return false
  }
}

async function main() {
  log(`## OWNER drill (5554, Plus)`)
  const d = await remote(caps('emulator-5554'))
  try {
    // Start on Início
    await tap(d, '//*[@content-desc="Início"]')
    await check('A1 owner Início Plus banner', async () => {
      const t = await texts(d)
      if (!t.includes('Teste Plus')) throw new Error('not Plus user')
      return 'Teste Plus PLUS OK'
    })

    await check('A1.2 owner Dashboard filtros', async () => {
      const t = await texts(d)
      const filters = ['12h','24h','48h','7 dias','10 dias'].filter(f => t.includes(f))
      if (filters.length < 5) throw new Error(`${5-filters.length} missing`)
      return `5/5 visible`
    })

    await check('A1.3 owner Dashboard badges/cards', async () => {
      const t = await texts(d)
      const cards = ['Pendentes','Tomadas','Atrasadas','Puladas','S.O.S','Aderência']
      const found = cards.filter(c => t.some(x => x.includes(c)))
      if (found.length < 3) throw new Error(`only ${found.length}/${cards.length}`)
      return `${found.length}/${cards.length}: ${found.join('|')}`
    })

    // A2 Pacientes
    await tap(d, '//*[@content-desc="Pacientes"]')
    await check('A2 owner Pacientes list', async () => {
      const t = await texts(d)
      log(`   debug texts: ${JSON.stringify(t.slice(0, 30))}`)
      return t.length + ' items'
    })

    await tap(d, '//*[@text="TestePaciente"]')
    await check('A2.1 owner Patient Detail buttons', async () => {
      const t = await texts(d)
      log(`   patient detail texts: ${JSON.stringify(t)}`)
      const hasNovo = t.includes('Novo')
      const hasShare = t.some(x => /Compartilhar paciente/.test(x))
      if (!hasNovo) throw new Error('Novo treatment missing')
      if (!hasShare) throw new Error('Share button missing')
      return 'Novo+Share visible'
    })

    // A6 Mais menu
    await tap(d, '//*[@content-desc="Mais"]')
    await check('A6 Mais menu options', async () => {
      const t = await texts(d)
      log(`   mais menu: ${JSON.stringify(t)}`)
      return t.length + ' items'
    })
  } finally {
    try { await d.deleteSession() } catch (_) {}
  }
  log(`\nReport: ${REPORT}`)
}

main().catch(e => log(`FATAL: ${e.message}`))
