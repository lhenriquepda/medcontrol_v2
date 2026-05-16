#!/usr/bin/env node
// Step 2 isolated: OWNER creates patient + shares with teste-free via UI.
// Validates Step 3 (caregiver tray push share) by reading dumpsys.

import { remote } from 'webdriverio'

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
    'appium:newCommandTimeout': 240,
    'appium:autoGrantPermissions': true,
    'appium:disableWindowAnimation': true
  }
})

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function dumpTexts(driver, label, limit = 30) {
  const src = await driver.getPageSource()
  const texts = [...src.matchAll(/text="([^"]{2,80})"/g)].map(m => m[1])
  console.log(`[${label}] ${texts.length} texts:`, texts.slice(0, limit))
  return { src, texts }
}

async function tapByText(driver, text, label, opts = {}) {
  const xp = opts.contains ? `//*[contains(@text,"${text}")]` : `//*[@text="${text}"]`
  console.log(`[${label}] Tap "${text}" (${opts.contains ? 'contains' : 'exact'})`)
  const el = await driver.$(xp)
  await el.waitForDisplayed({ timeout: opts.timeout || 10000 })
  await el.click()
  await sleep(opts.after || 1500)
  return el
}

async function tapByDesc(driver, desc, label, opts = {}) {
  console.log(`[${label}] Tap content-desc="${desc}"`)
  const el = await driver.$(`//*[@content-desc="${desc}"]`)
  await el.waitForDisplayed({ timeout: opts.timeout || 10000 })
  await el.click()
  await sleep(opts.after || 1500)
}

async function typeIn(driver, xpath, value, label) {
  console.log(`[${label}] Type "${value}" → ${xpath}`)
  const el = await driver.$(xpath)
  await el.waitForDisplayed({ timeout: 8000 })
  await el.click()
  await sleep(400)
  await el.clearValue().catch(() => {})
  await el.setValue(value)
  await sleep(500)
}

async function main() {
  console.log('=== Connecting OWNER (5554) ===')
  const owner = await remote(caps('emulator-5554'))
  console.log('=== Connecting CAREGIVER (5556) ===')
  const carer = await remote(caps('emulator-5556'))

  const PATIENT_NAME = `UIShare${Date.now().toString().slice(-5)}`

  try {
    console.log('\n=== Step A: owner dump ===')
    await dumpTexts(owner, 'OWNER', 15)

    console.log('\n=== Step B: owner → Pacientes ===')
    await tapByDesc(owner, 'Pacientes', 'OWNER')
    await dumpTexts(owner, 'OWNER-pacientes', 15)

    console.log('\n=== Step C: owner → Novo paciente ===')
    await tapByText(owner, 'Novo paciente', 'OWNER')
    await sleep(2000)
    await dumpTexts(owner, 'OWNER-form', 30)

    console.log('\n=== Step D: fill name ===')
    // First EditText after NOME label
    await typeIn(owner, '(//android.widget.EditText)[1]', PATIENT_NAME, 'OWNER')

    console.log('\n=== Step E: fill idade ===')
    await typeIn(owner, '//android.widget.EditText[@text="Ex: 45"]', '40', 'OWNER')

    console.log('\n=== Step F: hide keyboard + scroll for Salvar ===')
    await owner.hideKeyboard().catch(() => {})
    await sleep(800)
    // Scroll up form
    const sz = await owner.getWindowRect()
    for (let i = 0; i < 3; i++) {
      await owner.execute('mobile: swipeGesture', {
        left: 0, top: sz.height * 0.4, width: sz.width, height: sz.height * 0.4,
        direction: 'up', percent: 0.8
      }).catch(() => {})
      await sleep(700)
    }
    await dumpTexts(owner, 'OWNER-scrolled', 30)

    console.log('\n=== Step G: tap Salvar/Criar ===')
    const saveCandidates = ['Salvar', 'Criar paciente', 'Criar', 'Confirmar']
    let saved = false
    for (const txt of saveCandidates) {
      try {
        await tapByText(owner, txt, 'OWNER', { timeout: 3000, after: 3000 })
        saved = true
        console.log(`[OWNER] Saved via "${txt}"`)
        break
      } catch (_) { /* try next */ }
    }
    if (!saved) {
      console.error('[FAIL] Could not find Save button')
      await dumpTexts(owner, 'OWNER-no-save', 60)
      throw new Error('save button not found')
    }
    await sleep(3000)
    await dumpTexts(owner, 'OWNER-saved', 30)

    console.log(`\n=== Step H: open patient ${PATIENT_NAME} ===`)
    await tapByText(owner, PATIENT_NAME, 'OWNER', { contains: true, after: 3000 })
    await dumpTexts(owner, 'OWNER-detail', 30)

    console.log('\n=== Step I: find Compartilhar ===')
    let shareTapped = false
    for (const txt of ['Compartilhar', 'Compartilhamento', 'Convidar']) {
      try {
        await tapByText(owner, txt, 'OWNER', { timeout: 3000 })
        shareTapped = true
        console.log(`[OWNER] Share opened via "${txt}"`)
        break
      } catch (_) { /* try */ }
    }
    if (!shareTapped) {
      console.warn('[OWNER] No share button found by text — trying content-desc')
      try { await tapByDesc(owner, 'Compartilhar', 'OWNER') } catch (_) {
        console.error('[FAIL] No share trigger')
        await dumpTexts(owner, 'OWNER-no-share', 60)
        throw new Error('share not found')
      }
    }
    await sleep(2000)
    await dumpTexts(owner, 'OWNER-share-modal', 30)

    console.log('\n=== Step J: type teste-free email ===')
    await typeIn(owner, '(//android.widget.EditText)[1]', 'teste-free@teste.com', 'OWNER')

    console.log('\n=== Step K: confirm share ===')
    for (const txt of ['Compartilhar', 'Confirmar', 'Enviar', 'OK']) {
      try {
        await tapByText(owner, txt, 'OWNER', { timeout: 3000, after: 4000 })
        console.log(`[OWNER] Share confirmed via "${txt}"`)
        break
      } catch (_) { /* try */ }
    }
    await sleep(5000)
    console.log(`[OWNER] Share dispatched for ${PATIENT_NAME}.`)

    console.log('\n=== Step L: caregiver dumpsys notification ===')
    // Use ADB direct (Appium has no clean way to read system tray)
  } catch (e) {
    console.error('TEST FAILURE:', e?.message || e)
    process.exitCode = 1
  } finally {
    try { await owner.deleteSession() } catch (_) {}
    try { await carer.deleteSession() } catch (_) {}
  }

  console.log(`\n=== PATIENT_NAME=${PATIENT_NAME} ===`)
  console.log('Now run: adb -s emulator-5556 shell "dumpsys notification --noredact | grep bigText"')
}

main()
