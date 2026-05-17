#!/usr/bin/env node
// Steps 4 → 7: caregiver tap share PUSH + navigate, kill, owner creates dose, verify caregiver dose tray.

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

async function tryTap(d, xp, lbl, opts = {}) {
  try { await tap(d, xp, lbl, opts); return true } catch (_) { return false }
}

async function main() {
  console.log('=== Open both sessions ===')
  const owner = await remote(caps('emulator-5554'))
  const carer = await remote(caps('emulator-5556'))

  try {
    console.log('\n=== STEP 4: caregiver open notif shade + tap share PUSH ===')
    await carer.openNotifications()
    await sleep(2500)
    await dumpTexts(carer, 'CARER-shade', 30)
    // Tap notification card "Paciente compartilhado"
    const tapped = await tryTap(carer, `//*[contains(@text,"Teste Plus compartilhou")]`, 'CARER-tap', { after: 4000 })
    if (!tapped) {
      console.log('[CARER] Falling back: tap card by title')
      await tryTap(carer, `//*[contains(@text,"Paciente compartilhado")]`, 'CARER-tap2', { after: 4000 })
    }
    await dumpTexts(carer, 'CARER-after-tap', 30)

    // If still on home shade — go to Pacientes via bottom nav
    const texts = await dumpTexts(carer, 'CARER-state', 30)
    if (!texts.some(t => /TestePaciente/.test(t))) {
      console.log('[CARER] Navigate manually to Pacientes')
      await tap(carer, `//*[@content-desc="Pacientes"]`, 'CARER-nav', { after: 2500 })
    }
    const list = await dumpTexts(carer, 'CARER-pacientes-list', 30)
    const seesShared = list.some(t => /TestePaciente/.test(t))
    if (seesShared) console.log('*** STEP 4 PASS — caregiver sees shared TestePaciente ***')
    else console.error('*** STEP 4 FAIL — TestePaciente not visible in caregiver list ***')

    console.log('\n=== STEP 5: kill caregiver (HOME background) ===')
    await carer.pressKeyCode(3)
    await sleep(2500)
    console.log('[CARER] backgrounded')

    console.log('\n=== STEP 6: owner cria new dose for TestePaciente ===')
    // Owner: Pacientes → TestePaciente → "Novo tratamento" or +
    await dumpTexts(owner, 'OWNER-start', 25)
    // Close any leftover sheet first via tap Fechar
    try {
      const closeEl = await owner.$(`//*[@text="Fechar"]`)
      if (await closeEl.isDisplayed().catch(() => false)) {
        await closeEl.click()
        await sleep(1500)
      }
    } catch (_) {}

    // Make sure we're on home or pacientes
    await tryTap(owner, `//*[@content-desc="Pacientes"]`, 'OWNER-pacientes', { after: 2500 })
    await tryTap(owner, `//*[@text="TestePaciente"]`, 'OWNER-patient', { after: 3000 })
    await dumpTexts(owner, 'OWNER-detail', 40)

    // Find "Novo" tratamento button (within Tratamentos section)
    let txOpen = false
    for (const xp of [`//*[@text="Novo"]`, `//*[contains(@text,"Novo tratamento")]`, `//*[contains(@text,"Adicionar tratamento")]`]) {
      if (await tryTap(owner, xp, `OWNER-new-tx-${xp}`, { timeout: 2500, after: 3000 })) { txOpen = true; break }
    }
    if (!txOpen) {
      // Try bottom-nav center button "Novo (paciente ou tratamento)"
      console.log('[OWNER] use bottom-nav + button')
      await tap(owner, `//*[@content-desc="Novo (paciente ou tratamento)"]`, 'OWNER-+', { after: 3000 })
      await tryTap(owner, `//*[contains(@text,"Novo tratamento")]`, 'OWNER-new-tx', { timeout: 2500, after: 3000 })
    }

    const txForm = await dumpTexts(owner, 'OWNER-tx-form', 50)
    console.log('[OWNER] tx form opened')

    // Need to pick TestePaciente if patient selector exists
    const patientField = txForm.find(t => /^Paciente/.test(t))
    if (patientField) {
      console.log('[OWNER] patient selector visible — try select TestePaciente')
      await tryTap(owner, `//*[@text="Paciente"]`, 'OWNER-pat-sel', { after: 2000 })
      await tryTap(owner, `//*[@text="TestePaciente"]`, 'OWNER-pick-tp', { after: 1500 })
    }

    // Fill med name
    const medEl = await owner.$(`(//android.widget.EditText)[1]`)
    await medEl.waitForDisplayed({ timeout: 5000 })
    await medEl.click()
    await sleep(500)
    execSync(`adb -s emulator-5554 shell input text "UITestMed"`, { stdio: 'ignore' })
    await sleep(800)
    await owner.hideKeyboard().catch(() => {})

    console.log('[OWNER] Med name entered. Treatment form likely needs dose first time + interval + duration. Defaults used; submit immediately.')

    // Tap Save
    let saved = false
    for (const txt of ['Criar tratamento', 'Cadastrar', 'Salvar', 'Confirmar']) {
      if (await tryTap(owner, `//*[@text="${txt}"]`, `OWNER-save-${txt}`, { timeout: 2500, after: 6000 })) {
        saved = true; console.log(`[OWNER] saved via "${txt}"`); break
      }
    }
    if (!saved) console.warn('[OWNER] no save button found — form may have required fields missing')

    await sleep(5000)

    console.log('\n=== STEP 7: verify caregiver tray dose programada ===')
    const tray = execSync(
      `adb -s emulator-5556 shell "dumpsys notification --noredact 2>/dev/null | grep -E 'android.title|android.bigText'"`,
      { encoding: 'utf8' }
    )
    console.log('caregiver tray:', tray.slice(0, 800))
    const hasDose = /Dose programada.*TestePaciente|UITestMed/i.test(tray)
    if (hasDose) console.log('*** STEP 7 PASS — dose PUSH found ***')
    else console.error('*** STEP 7 FAIL — no dose PUSH for TestePaciente ***')
  } catch (e) {
    console.error('FAIL:', e.message || e)
    process.exitCode = 1
  } finally {
    try { await owner.deleteSession() } catch (_) {}
    try { await carer.deleteSession() } catch (_) {}
  }
}

main()
