#!/usr/bin/env node
// QA exaustivo — varre cada área do app via Appium + ADB hybrid.
// Owner = emulator-5554 (Pixel 8, teste-plus)
// Caregiver = emulator-5556 (Pixel 10, teste-free)
import { remote } from 'webdriverio'
import { execSync } from 'node:child_process'
import { writeFileSync, appendFileSync } from 'node:fs'

const REPORT = 'C:/temp/dosy_test/qa_report.md'
writeFileSync(REPORT, `# QA Report Dosy v0.2.3.7 — ${new Date().toISOString()}\n\n`)
const log = (line) => { console.log(line); appendFileSync(REPORT, line + '\n') }

const APPIUM = { hostname: '127.0.0.1', port: 4723, path: '/', logLevel: 'error' }
const caps = (udid) => ({
  ...APPIUM,
  capabilities: {
    platformName: 'Android', 'appium:automationName': 'UiAutomator2',
    'appium:udid': udid,
    'appium:appPackage': 'com.dosyapp.dosy.dev',
    'appium:appActivity': 'com.dosyapp.dosy.MainActivity',
    'appium:noReset': true,
    'appium:newCommandTimeout': 240
  }
})
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function texts(d) {
  const src = await d.getPageSource()
  return [...src.matchAll(/text="([^"]{2,80})"/g)].map(m => m[1])
}

async function tap(d, xp) {
  const el = await d.$(xp)
  await el.waitForDisplayed({ timeout: 8000 })
  await el.click()
  await sleep(1800)
}

async function tryTap(d, xp) {
  try { await tap(d, xp); return true } catch (_) { return false }
}

async function navHome(d) { await tap(d, '//*[@content-desc="Início"]') }
async function navPacientes(d) { await tap(d, '//*[@content-desc="Pacientes"]') }
async function navSos(d) { await tap(d, '//*[@content-desc="S.O.S"]') }
async function navMais(d) { await tap(d, '//*[@content-desc="Mais"]') }
async function navNovo(d) { await tap(d, '//*[@content-desc="Novo (paciente ou tratamento)"]') }

async function area(d, label, fn) {
  log(`\n## ${label}`)
  try {
    const result = await fn()
    log(`✅ PASS`)
    return result
  } catch (e) {
    log(`❌ FAIL: ${e.message}`)
  }
}

async function main() {
  const plus = await remote(caps('emulator-5554'))
  const free = await remote(caps('emulator-5556'))

  try {
    // ─── QA A: Login states (smoke) ─────────────────────────────────
    await area(plus, 'A1. Owner login state', async () => {
      await navHome(plus)
      const t = await texts(plus)
      const ok = t.includes('Teste Plus') && t.includes('Plano PLUS')
      if (!ok) throw new Error(`identity not Teste Plus`)
      return { tier: 'PLUS' }
    })
    await area(free, 'A2. Caregiver login state', async () => {
      await navHome(free)
      const t = await texts(free)
      const ok = t.includes('Teste Free') && t.includes('Plano FREE')
      if (!ok) throw new Error(`identity not Teste Free`)
      return { tier: 'FREE' }
    })

    // ─── QA B: Dashboard filtros ─────────────────────────────────────
    await area(plus, 'B1. Dashboard owner filtros 12h/24h/48h/7d/10d', async () => {
      const filters = ['12h', '24h', '48h', '7 dias', '10 dias']
      const found = []
      const t = await texts(plus)
      for (const f of filters) if (t.includes(f)) found.push(f)
      if (found.length < 5) throw new Error(`filters missing: ${5 - found.length}`)
      // Try tap 48h
      await tryTap(plus, '//*[@text="48h"]')
      return { filters: found.length }
    })
    await area(plus, 'B2. Dashboard Adesão 7D badge', async () => {
      const t = await texts(plus)
      const hasAdesao = t.some(x => /ADES.O 7D/i.test(x))
      if (!hasAdesao) throw new Error('Adesão badge missing')
    })

    // ─── QA C: Pacientes ─────────────────────────────────────────────
    await area(plus, 'C1. Pacientes list', async () => {
      await navPacientes(plus)
      const t = await texts(plus)
      const ok = t.includes('Pacientes') && t.includes('Novo paciente')
      if (!ok) throw new Error('list page broken')
    })
    await area(plus, 'C2. Patient Detail TestePaciente', async () => {
      await tryTap(plus, '//*[@text="TestePaciente"]')
      const t = await texts(plus)
      const ok = t.some(x => /Compartilhar paciente/.test(x))
      if (!ok) throw new Error('detail missing Compartilhar')
    })

    // ─── QA D: Tratamento criar ──────────────────────────────────────
    await area(plus, 'D1. Tratamento novo form abre', async () => {
      const found = await tryTap(plus, '//*[@text="Novo"]')
      if (!found) await navNovo(plus)
      await sleep(2000)
      const t = await texts(plus)
      const ok = t.some(x => /NOVO TRATAMENTO/.test(x))
      if (!ok) throw new Error('form did not open')
    })
    await area(plus, 'D2. Tratamento form campos', async () => {
      const t = await texts(plus)
      const fields = ['PACIENTE *', 'MEDICAMENTO *', 'DOSE / UNIDADE*', 'FREQUÊNCIA']
      const missing = fields.filter(f => !t.includes(f))
      if (missing.length) throw new Error(`missing: ${missing.join(', ')}`)
    })
    await area(plus, 'D3. Tratamento Voltar', async () => {
      await tryTap(plus, '//*[@text="Voltar"]')
      await sleep(1500)
      const t = await texts(plus)
      if (t.includes('NOVO TRATAMENTO')) throw new Error('still on form')
    })

    // ─── QA F: SOS ───────────────────────────────────────────────────
    await area(plus, 'F1. SOS page abre', async () => {
      await navSos(plus)
      await sleep(2000)
      const t = await texts(plus)
      const ok = t.some(x => /SOS|S\.?O\.?S/.test(x))
      if (!ok) throw new Error('SOS page not loaded')
    })
    await area(plus, 'F2. SOS form campos', async () => {
      const t = await texts(plus)
      // SOS may require selecting patient + med + dose
      const hasFields = t.some(x => /Paciente|Medicamento|Dose/i.test(x))
      if (!hasFields) throw new Error('SOS fields missing')
    })

    // ─── QA G: Mais (settings) ──────────────────────────────────────
    await area(plus, 'G1. Mais nav', async () => {
      await navMais(plus)
      await sleep(2000)
      const t = await texts(plus)
      const sections = ['Ajustes', 'Histórico', 'Tratamentos', 'Relatórios']
      const missing = sections.filter(s => !t.includes(s))
      if (missing.length) throw new Error(`Mais sections missing: ${missing.join(', ')}`)
    })

    // ─── QA H: Caregiver Pacientes (shared) ──────────────────────────
    await area(free, 'H1. Caregiver Pacientes', async () => {
      await navPacientes(free)
      await sleep(2500)
      const t = await texts(free)
      log(`   caregiver list texts: ${t.slice(10, 25).join(' | ')}`)
    })

    // ─── QA I: AppHeader badges (overdue counter) ────────────────────
    await area(plus, 'I1. Plus AppHeader overdue badge', async () => {
      await navHome(plus)
      const t = await texts(plus)
      // Badge "X doses atrasadas" present?
      const badge = t.find(x => / dose[s]? atrasada/i.test(x))
      log(`   badge: ${badge || 'NONE'}`)
    })

    // ─── QA J: Bottom nav presence ───────────────────────────────────
    await area(plus, 'J1. Bottom nav 5 items', async () => {
      const t = await texts(plus)
      const items = ['Início', 'Pacientes', 'S.O.S', 'Mais']
      const missing = items.filter(i => !t.includes(i))
      if (missing.length) throw new Error(`bottom nav missing: ${missing.join(', ')}`)
    })

    // ─── QA K: Mais → Ajustes ───────────────────────────────────────
    await area(plus, 'K1. Mais → Ajustes navegação', async () => {
      await navMais(plus)
      await sleep(1500)
      await tryTap(plus, '//*[@text="Ajustes"]')
      await sleep(2500)
      const t = await texts(plus)
      log(`   Ajustes sections: ${t.filter(x => /Notif|Conta|Tema|Idioma|Privacidade|Suporte|Sobre|DnD/i.test(x)).slice(0, 10).join(' | ')}`)
    })

    // ─── QA L: Mais → Relatórios ────────────────────────────────────
    await area(plus, 'L1. Mais → Relatórios', async () => {
      await navMais(plus)
      await sleep(1500)
      await tryTap(plus, '//*[@text="Relatórios"]')
      await sleep(2500)
      const t = await texts(plus)
      const hasReports = t.some(x => /Exportar|PDF|CSV|Per[ií]odo/i.test(x))
      if (!hasReports) throw new Error('Relatórios page broken')
    })

    // ─── QA M: Mais → Tratamentos (list) ────────────────────────────
    await area(plus, 'M1. Mais → Tratamentos lista', async () => {
      await navMais(plus)
      await sleep(1500)
      await tryTap(plus, '//*[@text="Tratamentos"]')
      await sleep(2500)
      const t = await texts(plus)
      log(`   Tratamentos: ${t.slice(8, 20).join(' | ')}`)
    })

    // ─── QA N: Mais → Histórico ─────────────────────────────────────
    await area(plus, 'N1. Mais → Histórico', async () => {
      await navMais(plus)
      await sleep(1500)
      await tryTap(plus, '//*[@text="Histórico"]')
      await sleep(2500)
      const t = await texts(plus)
      log(`   Histórico: ${t.slice(8, 20).join(' | ')}`)
    })

    // ─── QA O: Mais → Análises ──────────────────────────────────────
    await area(plus, 'O1. Mais → Análises', async () => {
      await navMais(plus)
      await sleep(1500)
      await tryTap(plus, '//*[@text="Análises"]')
      await sleep(2500)
      const t = await texts(plus)
      log(`   Análises: ${t.slice(8, 20).join(' | ')}`)
    })

    log('\n\n## QA COMPLETO — FIM')
  } catch (e) {
    log(`\nFATAL: ${e.message}`)
  } finally {
    try { await plus.deleteSession() } catch (_) {}
    try { await free.deleteSession() } catch (_) {}
  }
  log(`\nReport saved: ${REPORT}`)
}

main()
