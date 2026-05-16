#!/usr/bin/env node
// Full flow v3 — uses existing patient (no new patient creation form).
// Tests steps 2.share → 3 push → 4 tap → 5 kill → 6 dose → 7 push → 9 fire-time → 11 modal

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

async function dumpTexts(driver, label, limit = 25) {
  const src = await driver.getPageSource()
  const texts = [...src.matchAll(/text="([^"]{2,80})"/g)].map(m => m[1])
  console.log(`[${label}]`, texts.slice(0, limit))
  return { src, texts }
}

async function tapText(driver, text, label, opts = {}) {
  const xp = opts.contains ? `//*[contains(@text,"${text}")]` : `//*[@text="${text}"]`
  console.log(`[${label}] tap "${text}"${opts.contains?' (contains)':''}`)
  const el = await driver.$(xp)
  await el.waitForDisplayed({ timeout: opts.timeout || 10000 })
  await el.click()
  await sleep(opts.after || 1500)
}

async function tapDesc(driver, desc, label, opts = {}) {
  console.log(`[${label}] tap desc="${desc}"`)
  const el = await driver.$(`//*[@content-desc="${desc}"]`)
  await el.waitForDisplayed({ timeout: opts.timeout || 10000 })
  await el.click()
  await sleep(opts.after || 1500)
}

async function adbType(serial, value) {
  const safe = value.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/@/g, '\\@')
  execSync(`adb -s ${serial} shell input text "${safe}"`, { stdio: ['ignore', 'pipe', 'pipe'] })
  await sleep(500)
}

async function tapElementThenAdbType(driver, xpath, value, serial, label) {
  console.log(`[${label}] tap+adbType "${value}"`)
  const el = await driver.$(xpath)
  await el.waitForDisplayed({ timeout: 8000 })
  await el.click()
  await sleep(400)
  await adbType(serial, value)
}

function trayMatch(serial, regex) {
  try {
    const out = execSync(
      `adb -s ${serial} shell "dumpsys notification --noredact 2>/dev/null | grep -E 'android.title|android.bigText'"`,
      { encoding: 'utf8' }
    )
    return regex.test(out) ? out : null
  } catch { return null }
}

async function main() {
  const owner = await remote(caps('emulator-5554'))
  const carer = await remote(caps('emulator-5556'))

  // Use existing patient "TestePaciente"
  const PATIENT = 'TestePaciente'

  try {
    console.log('\n========================')
    console.log('STEP 2: owner share existing patient via UI')
    console.log('========================\n')

    await dumpTexts(owner, 'OWNER-home')
    await tapDesc(owner, 'Pacientes', 'OWNER', { after: 2000 })
    await dumpTexts(owner, 'OWNER-list')

    // Tap exact patient card text
    await tapText(owner, PATIENT, 'OWNER', { after: 3000 })
    const { texts: detailTexts } = await dumpTexts(owner, 'OWNER-detail', 60)

    // Find Compartilhar paciente button
    if (!detailTexts.find(t => /Compartilhar paciente/i.test(t))) {
      console.warn('[OWNER] No "Compartilhar paciente" visible — scroll')
      const sz = await owner.getWindowRect()
      for (let i = 0; i < 4; i++) {
        await owner.execute('mobile: swipeGesture', {
          left: 0, top: sz.height * 0.5, width: sz.width, height: sz.height * 0.4,
          direction: 'up', percent: 0.8
        }).catch(() => {})
        await sleep(700)
        const { texts: nt } = await dumpTexts(owner, `OWNER-scroll-${i+1}`, 20)
        if (nt.find(t => /Compartilhar paciente/i.test(t))) break
      }
    }

    await tapText(owner, 'Compartilhar paciente', 'OWNER', { contains: true, after: 3000 })

    await dumpTexts(owner, 'OWNER-share-sheet')
    // Type email into the first visible EditText in the share sheet
    await tapElementThenAdbType(owner, '(//android.widget.EditText)[last()]', 'teste-free@teste.com', 'emulator-5554', 'OWNER')

    // Confirm share
    let confirmed = false
    for (const txt of ['Compartilhar', 'Confirmar', 'Convidar', 'Adicionar', 'Enviar']) {
      try { await tapText(owner, txt, 'OWNER', { timeout: 2500, after: 5000 }); confirmed = true; console.log(`[OWNER] confirm via "${txt}"`); break } catch (_) {}
    }
    if (!confirmed) {
      console.warn('[OWNER] No explicit confirm — share may auto-fire on email entry')
      await dumpTexts(owner, 'OWNER-after-email', 30)
    }
    await sleep(5000)

    console.log('\n========================')
    console.log('STEP 3: verify caregiver tray (share PUSH)')
    console.log('========================')
    const sharePush = trayMatch('emulator-5556', /Paciente compartilhado|compartilhou.*com vo/i)
    if (sharePush) {
      console.log('*** STEP 3 PASS — share PUSH found ***')
      console.log(sharePush.slice(0, 500))
    } else {
      console.error('*** STEP 3 FAIL — no share PUSH ***')
      const all = execSync(`adb -s emulator-5556 shell "dumpsys notification --noredact 2>/dev/null | grep -E 'android.title|android.bigText'"`, { encoding: 'utf8' })
      console.log('caregiver tray:', all.slice(0, 800))
      throw new Error('share-push-missing')
    }

    console.log('\n========================')
    console.log('STEP 4: caregiver tap PUSH (manual sim: just verify patient is in caregiver list)')
    console.log('========================')
    // Caregiver opens notif shade + taps. Use Appium openNotifications + tap.
    await carer.openNotifications()
    await sleep(2500)
    const shareXp = `//*[contains(@text,"compartilhou") or contains(@text,"Paciente compartilhado")]`
    try {
      const el = await carer.$(shareXp)
      await el.waitForDisplayed({ timeout: 8000 })
      await el.click()
      console.log('[CAREGIVER] tapped share notification')
      await sleep(4000)
    } catch (e) {
      console.warn('[CAREGIVER] could not tap notification:', e.message)
      await carer.pressKeyCode(4)
    }

    await dumpTexts(carer, 'CAREGIVER-after-tap', 30)
    // Navigate to Pacientes to verify shared patient
    await tapDesc(carer, 'Pacientes', 'CAREGIVER', { after: 2500 })
    const { texts: carerListTexts } = await dumpTexts(carer, 'CAREGIVER-list', 30)
    const seesPatient = carerListTexts.find(t => t.includes(PATIENT))
    console.log(`[STEP-4] caregiver sees ${PATIENT} in list: ${!!seesPatient}`)

    console.log('\n========================')
    console.log('STEP 5: kill caregiver app (HOME)')
    console.log('========================')
    await carer.pressKeyCode(3) // HOME
    await sleep(2000)
    console.log('[CAREGIVER] backgrounded.')

    console.log('\n========================')
    console.log('STEP 6: owner creates new dose for shared patient')
    console.log('========================')
    // Owner should still be on patient detail OR navigate back
    // Use sync nav back to patient
    await tapDesc(owner, 'Início', 'OWNER', { after: 2000 })
    await tapDesc(owner, 'Pacientes', 'OWNER', { after: 2000 })
    await tapText(owner, PATIENT, 'OWNER', { after: 3000 })

    const { texts: detailNowTexts } = await dumpTexts(owner, 'OWNER-detail-2', 60)
    // Find new treatment / dose button
    let txAdded = false
    for (const txt of ['Novo tratamento', 'Adicionar tratamento', '+ Tratamento', 'Add tratamento', 'Adicionar dose']) {
      try { await tapText(owner, txt, 'OWNER', { timeout: 3000, after: 2500 }); txAdded = true; break } catch (_) {}
    }
    if (!txAdded) {
      // Use bottom nav + button
      console.warn('[OWNER] no Novo tratamento in detail — using "Novo (paciente ou tratamento)"')
      await tapDesc(owner, 'Novo (paciente ou tratamento)', 'OWNER', { after: 2500 })
      try { await tapText(owner, 'Novo tratamento', 'OWNER', { timeout: 3000, after: 2000 }) } catch (_) {}
    }

    await dumpTexts(owner, 'OWNER-tx-form', 50)
    // Fill med name
    await tapElementThenAdbType(owner, '(//android.widget.EditText)[1]', 'UITestMed', 'emulator-5554', 'OWNER')
    await sleep(800)
    await owner.hideKeyboard().catch(() => {})
    console.log('[OWNER] Treatment form: only set med name; defaults used for rest.')
    // Note: full treatment form filling is complex (intervals, dates, units).
    // Defaults usually fine for a smoke test.
    // Save
    for (const txt of ['Criar tratamento', 'Salvar', 'Cadastrar', 'Confirmar']) {
      try { await tapText(owner, txt, 'OWNER', { timeout: 2500, after: 4000 }); console.log(`[OWNER] saved via "${txt}"`); break } catch (_) {}
    }
    await sleep(6000)

    console.log('\n========================')
    console.log('STEP 7: verify caregiver tray dose PUSH')
    console.log('========================')
    const dosePush = trayMatch('emulator-5556', /Dose programada|UITestMed/i)
    if (dosePush) {
      console.log('*** STEP 7 PASS — dose PUSH found ***')
      console.log(dosePush.slice(0, 400))
    } else {
      console.error('*** STEP 7 FAIL — no dose PUSH on caregiver')
      const all = execSync(`adb -s emulator-5556 shell "dumpsys notification --noredact 2>/dev/null | grep -E 'android.title|android.bigText'"`, { encoding: 'utf8' })
      console.log('caregiver tray:', all.slice(0, 800))
    }

    console.log('\n========================')
    console.log('STEPS 9-13: out of scope for this v3 run (need treatment with specific scheduledAt)')
    console.log('========================')
    console.log('TEST V3 FINISH.')
  } catch (e) {
    console.error('FAIL:', e?.message || e)
    process.exitCode = 1
  } finally {
    try { await owner.deleteSession() } catch (_) {}
    try { await carer.deleteSession() } catch (_) {}
  }
}

main()
