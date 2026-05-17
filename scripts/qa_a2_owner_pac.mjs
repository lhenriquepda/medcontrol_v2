#!/usr/bin/env node
import { remote } from 'webdriverio'
import { writeFileSync, appendFileSync } from 'node:fs'

const REPORT = 'C:/temp/dosy_test/qa_a2_owner_pac.md'
writeFileSync(REPORT, `# A2 Owner Pacientes — ${new Date().toISOString()}\n\n`)
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

async function main() {
  const d = await remote(caps('emulator-5554'))
  try {
    // 1. Pacientes tab
    const pac = await d.$('//*[@content-desc="Pacientes"]')
    await pac.waitForDisplayed({ timeout: 8000 })
    await pac.click()
    await sleep(2500)
    const t1 = await texts(d)
    log(`Pacientes texts: ${JSON.stringify(t1)}`)
    const hasPaciente = t1.includes('TestePaciente')
    const hasNovoBtn = t1.includes('Novo paciente')
    log(`TestePaciente listed: ${hasPaciente}`)
    log(`Novo paciente button: ${hasNovoBtn}`)
    log(``)

    // 2. Tap TestePaciente by index search via element with @text directly clickable
    log(`Looking for clickable element with text TestePaciente`)
    // Use ViewGroup or button matching
    try {
      // Find via UiSelector
      const list = await d.$$('android=new UiSelector().textContains("TestePaciente")')
      log(`Found ${list.length} elements with text TestePaciente`)
      // Click the second one (card link is usually wrapper)
      if (list.length > 0) {
        await list[0].click()
        await sleep(2500)
        const t2 = await texts(d)
        log(`PatientDetail texts: ${JSON.stringify(t2)}`)
        const hasNovoTreatment = t2.includes('Novo')
        const hasCompartilhar = t2.some(x => /Compartilhar paciente/.test(x))
        const hasEdit = t2.some(x => /Editar/.test(x))
        const hasDelete = t2.some(x => /Excluir|Deletar/.test(x))
        log(`Novo (treatment) button: ${hasNovoTreatment}`)
        log(`Compartilhar paciente button: ${hasCompartilhar}`)
        log(`Editar button: ${hasEdit}`)
        log(`Excluir/Deletar: ${hasDelete}`)
      }
    } catch (e) {
      log(`UiSelector error: ${e.message}`)
    }
  } finally {
    try { await d.deleteSession() } catch (_) {}
  }
}

main().catch(e => log(`FATAL: ${e.message}`))
