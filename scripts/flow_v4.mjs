#!/usr/bin/env node
// flow v4 — only steps 2 share + 3 push verify. Owner already on TestePaciente detail.

import { remote } from 'webdriverio'
import { execSync } from 'node:child_process'

const APPIUM = { hostname: '127.0.0.1', port: 4723, path: '/', logLevel: 'error' }
const caps = (udid) => ({
  ...APPIUM,
  capabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:udid': udid,
    'appium:appPackage': 'com.dosyapp.dosy.dev',
    'appium:appActivity': 'com.dosyapp.dosy.MainActivity',
    'appium:noReset': true,
    'appium:newCommandTimeout': 180,
    'appium:autoGrantPermissions': true,
    'appium:disableWindowAnimation': true
  }
})

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function dumpTexts(d, lbl, lim = 30) {
  const src = await d.getPageSource()
  const texts = [...src.matchAll(/text="([^"]{2,80})"/g)].map(m => m[1])
  console.log(`[${lbl}]`, texts.slice(0, lim))
  return texts
}

async function tap(d, xp, lbl, opts = {}) {
  console.log(`[${lbl}] tap ${xp}`)
  const el = await d.$(xp)
  await el.waitForDisplayed({ timeout: opts.timeout || 10000 })
  await el.click()
  await sleep(opts.after || 1500)
}

async function main() {
  console.log('=== Owner Appium ===')
  const owner = await remote(caps('emulator-5554'))

  try {
    await dumpTexts(owner, 'OWNER-state', 15)
    // Navigate Pacientes → TestePaciente
    await tap(owner, `//*[@content-desc="Pacientes"]`, 'OWNER-nav', { after: 2000 })
    await tap(owner, `//*[@text="TestePaciente"]`, 'OWNER-card', { after: 3000 })
    console.log('[OWNER] detail open')

    // Tap Compartilhar paciente button (Appium .click works where ADB tap fails)
    await tap(owner, `//*[contains(@text,"Compartilhar paciente")]`, 'OWNER-share-btn', { after: 4000 })
    const sheet1 = await dumpTexts(owner, 'OWNER-after-share', 40)
    const sheetOpen = sheet1.some(t => /Compartilhar ·/.test(t) || /E-MAIL DO/.test(t))
    if (!sheetOpen) { console.error('Sheet did not open'); throw new Error('sheet') }
    console.log('[OWNER] sheet open ✓')

    // Tap email field → type via ADB
    const emailEl = await owner.$(`(//android.widget.EditText)[last()]`)
    await emailEl.waitForDisplayed({ timeout: 5000 })
    await emailEl.click()
    await sleep(500)
    execSync(`adb -s emulator-5554 shell input text "teste-free\\@teste.com"`, { stdio: 'ignore' })
    await sleep(1500)
    await owner.hideKeyboard().catch(() => {})
    await sleep(500)

    console.log('[OWNER] email typed. Tap Compartilhar submit')
    // The submit button is the SECOND occurrence of "Compartilhar" in the sheet
    await tap(owner, `//android.widget.Button[@text="Compartilhar"]`, 'OWNER-submit', { after: 8000 })

    // Wait up to 60s for mutation to complete
    let success = false
    for (let i = 0; i < 30; i++) {
      await sleep(2000)
      const t = await dumpTexts(owner, `OWNER-poll-${i}`, 50)
      const stillEnviando = t.some(x => /Enviando/.test(x))
      const successMsg = t.find(x => /compartilhado com teste-free|sucesso/i.test(x))
      const errorMsg = t.find(x => /Erro|n[ãa]o encontrad|inv[áa]lid|J[áa] compart/i.test(x))
      if (successMsg) { console.log('[OWNER] success:', successMsg); success = true; break }
      if (errorMsg) { console.log('[OWNER] ERROR:', errorMsg); break }
      if (!stillEnviando) {
        console.log('[OWNER] not Enviando anymore — checking caregiver tray')
        success = true; break
      }
    }

    if (!success) {
      console.warn('[OWNER] mutation never completed after 60s — known stuck state')
    }

    // Verify caregiver tray
    await sleep(3000)
    const tray = execSync(
      `adb -s emulator-5556 shell "dumpsys notification --noredact 2>/dev/null | grep -E 'android.title|android.bigText'"`,
      { encoding: 'utf8' }
    )
    const has = /Paciente compartilhado/.test(tray) && /TestePaciente/.test(tray)
    console.log(`\n[STEP-3] caregiver share PUSH for TestePaciente present: ${has}`)
    if (has) {
      console.log('*** STEP 3 PASS ***')
      console.log(tray.slice(0, 600))
    }
  } catch (e) {
    console.error('FAIL:', e.message || e)
    process.exitCode = 1
  } finally {
    try { await owner.deleteSession() } catch (_) {}
  }
}

main()
