// MEL-006 v0.2.6.11 — auth helper.
// Login deterministic via testids (MEL-001 v0.2.6.10).
import { inWebView } from './webview.mjs'

/**
 * Loga com email/senha. Aguarda dashboard render (StatGrid visível).
 * @param {WebdriverIO.Browser} driver
 * @param {string} email — default 'teste-plus@teste.com'
 * @param {string} password — default '123456'
 */
export async function loginAs(driver, email = 'teste-plus@teste.com', password = '123456') {
  await inWebView(driver, async () => {
    const emailInput = await driver.$('input[type="email"], input[name="email"]')
    await emailInput.waitForExist({ timeout: 10_000 })
    await emailInput.setValue(email)

    const passInput = await driver.$('input[type="password"], input[name="password"]')
    await passInput.setValue(password)

    const submitBtn = await driver.$('button[type="submit"]')
    await submitBtn.click()

    // Aguarda redirect pra dashboard — HeroGauge é marcador
    await driver.waitUntil(async () => {
      const url = await driver.getUrl()
      return /\/$/.test(url) || /\/dashboard/.test(url)
    }, { timeout: 15_000, timeoutMsg: 'Login não redirecionou pra dashboard em 15s' })
  })
}

/**
 * Verifica se usuário logado lendo localStorage Supabase session.
 */
export async function isLoggedIn(driver) {
  return inWebView(driver, async () => {
    return driver.execute(() => {
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-'))
        return keys.some(k => {
          const v = JSON.parse(localStorage.getItem(k) || 'null')
          return !!v?.access_token
        })
      } catch { return false }
    })
  })
}
