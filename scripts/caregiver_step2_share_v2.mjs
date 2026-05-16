#!/usr/bin/env node
// Step 2 v2 — hybrid Appium tap + ADB input.text (webview EditText workaround).

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
    'appium:newCommandTimeout': 240,
    'appium:autoGrantPermissions': true,
    'appium:disableWindowAnimation': true
  }
})

const sleep = ms => new Promise(r => setTimeout(r, ms))

function adb(serial, cmd) {
  return execSync(`adb -s ${serial} shell ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

async function dumpTexts(driver, label, limit = 30) {
  const src = await driver.getPageSource()
  const texts = [...src.matchAll(/text="([^"]{2,80})"/g)].map(m => m[1])
  console.log(`[${label}] texts:`, texts.slice(0, limit))
  return { src, texts }
}

async function tapByText(driver, text, label, opts = {}) {
  const xp = opts.contains ? `//*[contains(@text,"${text}")]` : `//*[@text="${text}"]`
  console.log(`[${label}] Tap "${text}"`)
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

async function tapElementAndType(driver, xpath, value, serial, label) {
  console.log(`[${label}] Tap+type "${value}" → ${xpath}`)
  const el = await driver.$(xpath)
  await el.waitForDisplayed({ timeout: 8000 })
  await el.click()
  await sleep(500)
  // Type via ADB (works in webview HTML inputs where Appium fails)
  // Escape special chars for shell
  const safeVal = value.replace(/'/g, "\\'").replace(/"/g, '\\"')
  execSync(`adb -s ${serial} shell input text "${safeVal}"`, { stdio: ['ignore', 'pipe', 'pipe'] })
  await sleep(700)
}

async function main() {
  console.log('=== Connecting OWNER (5554) ===')
  const owner = await remote(caps('emulator-5554'))
  console.log('=== Connecting CAREGIVER (5556) ===')
  const carer = await remote(caps('emulator-5556'))

  const PATIENT_NAME = `UIShare${Date.now().toString().slice(-5)}`
  console.log(`\n*** PATIENT_NAME = ${PATIENT_NAME} ***\n`)

  try {
    // Clear caregiver tray first
    try { execSync(`adb -s emulator-5556 shell cmd notification cancel ${'com.dosyapp.dosy.dev'} 0`, { stdio: 'ignore' }) } catch(_){}

    console.log('=== STEP 2.A: owner Dashboard → Pacientes ===')
    await dumpTexts(owner, 'OWNER', 12)
    await tapByDesc(owner, 'Pacientes', 'OWNER')

    console.log('\n=== STEP 2.B: tap Novo paciente ===')
    await tapByText(owner, 'Novo paciente', 'OWNER')
    await sleep(2500)

    console.log('\n=== STEP 2.C: fill name via ADB input ===')
    await tapElementAndType(owner, '(//android.widget.EditText)[1]', PATIENT_NAME, 'emulator-5554', 'OWNER')

    console.log('\n=== STEP 2.D: fill idade via ADB input ===')
    await tapElementAndType(owner, '//android.widget.EditText[@text="Ex: 45"]', '40', 'emulator-5554', 'OWNER')

    console.log('\n=== STEP 2.E: hide kb + scroll up ===')
    await owner.hideKeyboard().catch(() => {})
    await sleep(700)
    const sz = await owner.getWindowRect()
    for (let i = 0; i < 4; i++) {
      await owner.execute('mobile: swipeGesture', {
        left: 0, top: sz.height * 0.5, width: sz.width, height: sz.height * 0.4,
        direction: 'up', percent: 0.8
      }).catch(() => {})
      await sleep(600)
    }
    await dumpTexts(owner, 'OWNER-scrolled', 40)

    console.log('\n=== STEP 2.F: tap Salvar ===')
    let saved = false
    for (const txt of ['Salvar', 'Criar paciente', 'Cadastrar paciente', 'Criar', 'Confirmar']) {
      try {
        await tapByText(owner, txt, 'OWNER', { timeout: 2500, after: 3500 })
        saved = true
        console.log(`[OWNER] Saved via "${txt}"`)
        break
      } catch (_) {}
    }
    if (!saved) { console.error('[FAIL] No save button'); throw new Error('save') }
    await sleep(3500)

    console.log(`\n=== STEP 2.G: open patient ${PATIENT_NAME} ===`)
    await tapByText(owner, PATIENT_NAME, 'OWNER', { contains: true, after: 3000 })
    await dumpTexts(owner, 'OWNER-detail', 50)

    console.log('\n=== STEP 2.H: find + tap Compartilhar ===')
    let shareOpened = false
    for (const txt of ['Compartilhar', 'Compartilhamento']) {
      try {
        await tapByText(owner, txt, 'OWNER', { timeout: 2500, after: 2500 })
        shareOpened = true
        break
      } catch (_) {}
    }
    if (!shareOpened) {
      try { await tapByDesc(owner, 'Compartilhar', 'OWNER') ; shareOpened = true } catch(_){}
    }
    if (!shareOpened) {
      console.warn('[OWNER] Share button by direct tap failed. Dumping for menu hunt.')
      await dumpTexts(owner, 'OWNER-no-share', 80)
      // Scroll detail
      for (let i = 0; i < 3; i++) {
        await owner.execute('mobile: swipeGesture', {
          left: 0, top: sz.height * 0.5, width: sz.width, height: sz.height * 0.4,
          direction: 'up', percent: 0.7
        }).catch(() => {})
        await sleep(700)
      }
      for (const txt of ['Compartilhar', 'Convidar cuidador', 'Adicionar cuidador']) {
        try { await tapByText(owner, txt, 'OWNER', { timeout: 2500 }); shareOpened = true; break } catch(_){}
      }
      if (!shareOpened) throw new Error('share not found after scroll')
    }
    await sleep(2500)
    await dumpTexts(owner, 'OWNER-share-modal', 30)

    console.log('\n=== STEP 2.I: type teste-free email ===')
    await tapElementAndType(owner, '(//android.widget.EditText)[last()]', 'teste-free@teste.com', 'emulator-5554', 'OWNER')

    console.log('\n=== STEP 2.J: confirm share ===')
    let shareConfirmed = false
    for (const txt of ['Compartilhar', 'Confirmar', 'Enviar', 'Adicionar', 'OK']) {
      try {
        await tapByText(owner, txt, 'OWNER', { timeout: 2500, after: 4500 })
        shareConfirmed = true
        console.log(`[OWNER] Confirmed via "${txt}"`)
        break
      } catch (_) {}
    }
    if (!shareConfirmed) {
      console.warn('[OWNER] Share confirm button not found by text')
      await dumpTexts(owner, 'OWNER-confirm', 40)
    }
    await sleep(6000)

    console.log('\n=== STEP 3: verify caregiver tray ===')
    // Use direct ADB to read notification tray
    const tray = execSync(
      `adb -s emulator-5556 shell "dumpsys notification --noredact 2>/dev/null | grep -E 'android.title|android.bigText|android.text'"`,
      { encoding: 'utf8' }
    )
    const shareNotifFound = /compartilh|Paciente compartilhado/i.test(tray)
    console.log(`[STEP-3] share notification found in tray: ${shareNotifFound}`)
    console.log(`[STEP-3] tray excerpt:\n${tray.slice(0, 800)}`)
    if (!shareNotifFound) {
      console.error('[FAIL] No share PUSH notification on caregiver tray')
      process.exitCode = 2
    } else {
      console.log('\n*** STEP 3 PASS — caregiver received share PUSH ***')
    }
  } catch (e) {
    console.error('TEST EXCEPTION:', e?.message || e)
    process.exitCode = 1
  } finally {
    try { await owner.deleteSession() } catch (_) {}
    try { await carer.deleteSession() } catch (_) {}
  }
}

main()
