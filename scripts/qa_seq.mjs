#!/usr/bin/env node
// QA sequencial (1 session per emulator de cada vez) — evita conflito Appium dual.

import { remote } from 'webdriverio'
import { writeFileSync, appendFileSync } from 'node:fs'

const REPORT = 'C:/temp/dosy_test/qa_seq_report.md'
writeFileSync(REPORT, `# QA Sequencial Dosy v0.2.3.7 — ${new Date().toISOString()}\n\n`)
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
  return [...src.matchAll(/text="([^"]{2,80})"/g)].map(m => m[1])
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

async function runOwner() {
  log(`\n## OWNER session (5554, Plus)`)
  const d = await remote(caps('emulator-5554'))
  try {
    await check('A1 owner login Plus', async () => {
      await tap(d, '//*[@content-desc="Início"]')
      const t = await texts(d)
      if (!t.includes('Teste Plus')) throw new Error('not Plus')
      return 'Teste Plus PLUS'
    })

    await check('B1 dashboard filtros', async () => {
      const t = await texts(d)
      const filters = ['12h','24h','48h','7 dias','10 dias'].filter(f => t.includes(f))
      if (filters.length < 5) throw new Error(`${5-filters.length} missing`)
      return `${filters.length}/5 visible`
    })

    await check('C1 pacientes list owner', async () => {
      await tap(d, '//*[@content-desc="Pacientes"]')
      const t = await texts(d)
      if (!t.includes('Novo paciente')) throw new Error('no Novo button')
      return t.filter(x => /^TestePaciente|Paciente Free/.test(x)).length + ' patients'
    })

    await check('C2 owner Patient Detail Compartilhar', async () => {
      await tap(d, '//*[@text="TestePaciente"]')
      const t = await texts(d)
      const hasShare = t.some(x => /Compartilhar paciente/.test(x))
      if (!hasShare) throw new Error('Compartilhar button missing')
      return 'has Compartilhar paciente'
    })

    await check('C3 owner Novo treatment button VISIBLE', async () => {
      const t = await texts(d)
      if (!t.includes('Novo')) throw new Error('Novo button missing (owner should see)')
      return 'Novo visible (owner OK)'
    })

    await check('F1 SOS page', async () => {
      await tap(d, '//*[@content-desc="S.O.S"]')
      const t = await texts(d)
      const hasS = t.some(x => /SOS|S\.O\.S/.test(x))
      if (!hasS) throw new Error('not SOS')
    })

    await check('G1 Mais → Histórico', async () => {
      await tap(d, '//*[@content-desc="Mais"]')
      await tap(d, '//*[@text="Histórico"]')
      const t = await texts(d)
      if (!t.some(x => /doses/.test(x))) throw new Error('hist page broken')
    })

    await check('J1 Mais → Relatórios', async () => {
      await tap(d, '//*[@content-desc="Mais"]')
      await tap(d, '//*[@text="Relatórios"]')
      const t = await texts(d)
      if (!t.some(x => /Exportar|PDF|CSV/i.test(x))) throw new Error('reports broken')
    })

    await check('K1 Mais → Análises', async () => {
      await tap(d, '//*[@content-desc="Mais"]')
      await tap(d, '//*[@text="Análises"]')
      const t = await texts(d)
      if (!t.some(x => /ADES.O GERAL/.test(x))) throw new Error('analises broken')
    })

    await check('L1 Mais → Ajustes', async () => {
      await tap(d, '//*[@content-desc="Mais"]')
      await tap(d, '//*[@text="Ajustes"]')
      const t = await texts(d)
      if (!t.some(x => /NOTIFICAÇÕES/.test(x))) throw new Error('ajustes broken')
    })
  } finally {
    try { await d.deleteSession() } catch (_) {}
  }
}

async function runCaregiver() {
  log(`\n## CAREGIVER session (5556, Free)`)
  const d = await remote(caps('emulator-5556'))
  try {
    await check('A2 caregiver login Free', async () => {
      await tap(d, '//*[@content-desc="Início"]')
      const t = await texts(d)
      if (!t.includes('Teste Free')) throw new Error('not Free')
      return 'Teste Free FREE'
    })

    await check('H1 caregiver Pacientes counter Free SHARED EXCLUDED', async () => {
      await tap(d, '//*[@content-desc="Pacientes"]')
      const t = await texts(d)
      const counter = t.find(x => /Plano Free:.*\/1 paciente/.test(x))
      if (!counter) throw new Error('counter missing')
      if (!/Plano Free: 1\/1 paciente/.test(counter)) {
        throw new Error(`counter wrong: ${counter}`)
      }
      return counter
    })

    await check('H2 caregiver shared TestePaciente visible', async () => {
      const t = await texts(d)
      if (!t.includes('TestePaciente')) throw new Error('shared not visible')
      return 'shared visible'
    })

    await check('H3 caregiver Patient Detail Novo HIDDEN (Bug fix)', async () => {
      await tap(d, '//*[@text="TestePaciente"]')
      const t = await texts(d)
      const banner = t.find(x => /Paciente compartilhado com/.test(x))
      if (!banner) throw new Error('not on shared detail')
      const novoCount = t.filter(x => x === 'Novo').length
      if (novoCount > 0) throw new Error(`Novo button still visible (${novoCount}× — should be 0 caregiver)`)
      return 'Novo hidden non-owner'
    })

    await check('H4 caregiver Patient Detail share button HIDDEN', async () => {
      const t = await texts(d)
      const hasShareBtn = t.some(x => /^Compartilhar paciente/.test(x))
      if (hasShareBtn) throw new Error('caregiver should not see Compartilhar (not owner)')
      return 'share hidden non-owner'
    })

    await check('F1 caregiver SOS page accessible', async () => {
      await tap(d, '//*[@content-desc="S.O.S"]')
      const t = await texts(d)
      const hasS = t.some(x => /SOS|S\.O\.S/.test(x))
      if (!hasS) throw new Error('SOS broken')
    })
  } finally {
    try { await d.deleteSession() } catch (_) {}
  }
}

async function main() {
  try {
    await runOwner()
    await sleep(2000)
    await runCaregiver()
    log('\n\n## QA SEQ COMPLETO')
  } catch (e) {
    log(`\nFATAL: ${e.message}`)
  }
  log(`\nReport: ${REPORT}`)
}

main()
