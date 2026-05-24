// MEL-006 v0.2.6.11 — webview helper.
// Wrapper pra switchContext NATIVE_APP ↔ WEBVIEW_com.dosyapp.dosy.dev.
// Ver autowebview-spike-decision.md sobre por que NÃO usar appium:autoWebview.

const WEBVIEW_CTX = 'WEBVIEW_com.dosyapp.dosy.dev'
const NATIVE_CTX = 'NATIVE_APP'

/**
 * Executa fn dentro do contexto WEBVIEW, retorna ao NATIVE_APP no final.
 * @param {WebdriverIO.Browser} driver
 * @param {(driver) => Promise<any>} fn
 */
export async function inWebView(driver, fn) {
  const prevCtx = await driver.getContext()
  if (prevCtx !== WEBVIEW_CTX) {
    await driver.switchContext(WEBVIEW_CTX)
  }
  try {
    return await fn(driver)
  } finally {
    if (prevCtx === NATIVE_CTX) {
      await driver.switchContext(NATIVE_CTX)
    }
  }
}

/**
 * Executa fn dentro do contexto NATIVE_APP.
 * Usado pra gestos (mobile: clickGesture / swipeGesture) e widgets nativos.
 */
export async function inNative(driver, fn) {
  const prevCtx = await driver.getContext()
  if (prevCtx !== NATIVE_CTX) {
    await driver.switchContext(NATIVE_CTX)
  }
  try {
    return await fn(driver)
  } finally {
    if (prevCtx === WEBVIEW_CTX) {
      await driver.switchContext(WEBVIEW_CTX)
    }
  }
}

/**
 * Localiza element por data-testid no WebView (usa MEL-001 testids).
 * @param {WebdriverIO.Browser} driver
 * @param {string} testid e.g. 'dose-modal-confirm'
 */
export async function findByTestId(driver, testid) {
  return inWebView(driver, async () => {
    return driver.$(`[data-testid="${testid}"]`)
  })
}
