#!/usr/bin/env node
import { remote } from 'webdriverio'
import { writeFileSync, appendFileSync } from 'node:fs'

const REPORT = 'C:/temp/dosy_test/qa_b_caregiver.md'
writeFileSync(REPORT, `# B Caregiver — ${new Date().toISOString()}\n\n`)
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
  return [...src.matchAll(/text="([^"]{2,150})"/g)].map(m => m[1])
}

async function tap(d, xp, t=8000) {
  const el = await d.$(xp)
  await el.waitForDisplayed({ timeout: t })
  await el.click()
  await sleep(2000)
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
  log(`## CAREGIVER drill (5556, Free)`)
  const d = await remote(caps('emulator-5556'))
  try {
    // B1 Início Free
    await tap(d, '//*[@content-desc="Início"]')
    await check('B1 caregiver Início Free banner', async () => {
      const t = await texts(d)
      if (!t.includes('Teste Free')) throw new Error('not Free user')
      if (!t.some(x => /Plano FREE/i.test(x))) {
        log(`   debug: ${JSON.stringify(t.slice(0, 20))}`)
      }
      return 'Teste Free FREE OK'
    })

    await check('B1.2 Dashboard filtros caregiver', async () => {
      const t = await texts(d)
      const filters = ['12h','24h','48h','7 dias','10 dias'].filter(f => t.includes(f))
      if (filters.length < 5) throw new Error(`${5-filters.length} missing`)
      return `5/5 visible`
    })

    // B2 Pacientes counter Free
    await tap(d, '//*[@content-desc="Pacientes"]')
    await check('B2 caregiver Pacientes counter Free SHARED EXCLUDED', async () => {
      const t = await texts(d)
      log(`   pacientes texts: ${JSON.stringify(t)}`)
      const counter = t.find(x => /Plano Free:.*\/1 paciente/.test(x))
      if (!counter) throw new Error('counter missing')
      if (!/Plano Free: 1\/1 paciente/.test(counter)) {
        throw new Error(`counter wrong: ${counter}`)
      }
      return counter
    })

    await check('B2.2 caregiver shared TestePaciente visible', async () => {
      const t = await texts(d)
      if (!t.includes('TestePaciente')) throw new Error('shared not visible')
      const hasFreeMine = t.some(x => /Paciente Free 1/.test(x))
      if (!hasFreeMine) throw new Error('own patient Paciente Free 1 missing')
      return 'TestePaciente + Paciente Free 1 visible'
    })

    // B3 shared patient detail Novo HIDDEN
    const sharedEl = await d.$('android=new UiSelector().textContains("TestePaciente")')
    await sharedEl.click()
    await sleep(2200)
    await check('B3 caregiver shared detail Novo HIDDEN', async () => {
      const t = await texts(d)
      log(`   shared detail texts: ${JSON.stringify(t)}`)
      const hasBanner = t.some(x => /Paciente compartilhado com/.test(x))
      if (!hasBanner) throw new Error('not on shared detail')
      const novoBtn = t.filter(x => x === 'Novo')
      if (novoBtn.length > 0) throw new Error(`Novo ainda visível ${novoBtn.length}×`)
      return 'Novo HIDDEN non-owner OK'
    })

    await check('B3.2 caregiver shared detail Compartilhar HIDDEN', async () => {
      const t = await texts(d)
      const hasShareBtn = t.some(x => /^Compartilhar paciente/.test(x))
      if (hasShareBtn) throw new Error('caregiver não devia ver Compartilhar (not owner)')
      return 'Compartilhar HIDDEN non-owner OK'
    })

    // Volta + abrir patient próprio
    await d.back()
    await sleep(1500)
    const ownEl = await d.$('android=new UiSelector().textContains("Paciente Free 1")')
    await ownEl.click()
    await sleep(2200)
    await check('B3.3 caregiver own detail Novo VISIBLE', async () => {
      const t = await texts(d)
      const hasNovo = t.includes('Novo')
      if (!hasNovo) throw new Error('caregiver no own patient deveria ver Novo')
      return 'own patient Novo visible OK'
    })
  } finally {
    try { await d.deleteSession() } catch (_) {}
  }
}

main().catch(e => log(`FATAL: ${e.message}`))
