/**
 * CDP test helpers — QA v0.2.6.6 via Chrome DevTools Protocol direct.
 * Sem dependências externas. WebSocket pra emulator WebView via adb forward.
 */
import { WebSocket } from 'ws'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export async function listPages(port) {
  const res = await fetch(`http://localhost:${port}/json`)
  const pages = await res.json()
  // Aceita Capacitor prod (https://localhost) E LiveReload dev (http://10.0.2.2:5173)
  return pages.filter(p => p.type === 'page' && (
    p.url.startsWith('https://localhost') ||
    p.url.startsWith('http://10.0.2.2')
  ))
}

export function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    const events = []
    const eventListeners = new Map()
    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString())
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)))
        else resolve(msg.result)
      } else if (msg.method) {
        events.push(msg)
        const listeners = eventListeners.get(msg.method)
        if (listeners) listeners.forEach(l => l(msg.params))
      }
    })
    ws.on('open', () => {
      const client = {
        send(method, params = {}) {
          id++
          const myId = id
          return new Promise((res, rej) => {
            pending.set(myId, { resolve: res, reject: rej })
            ws.send(JSON.stringify({ id: myId, method, params }))
            setTimeout(() => {
              if (pending.has(myId)) {
                pending.delete(myId)
                rej(new Error(`CDP timeout: ${method}`))
              }
            }, 30000)
          })
        },
        on(method, fn) {
          if (!eventListeners.has(method)) eventListeners.set(method, [])
          eventListeners.get(method).push(fn)
        },
        events,
        close: () => ws.close(),
      }
      resolve(client)
    })
    ws.on('error', reject)
  })
}

export async function evalJs(client, expression, opts = {}) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: opts.await || false,
  })
  if (result.exceptionDetails) {
    throw new Error(`JS eval failed: ${result.exceptionDetails.text || JSON.stringify(result.exceptionDetails)}`)
  }
  return result.result?.value
}

/** Screenshot pra arquivo PNG. */
export async function screenshot(client, filePath) {
  const { data } = await client.send('Page.captureScreenshot', { format: 'png' })
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, Buffer.from(data, 'base64'))
  return filePath
}

/** Aguarda elemento aparecer (poll seletor CSS), timeout ms. */
export async function waitFor(client, selector, timeoutMs = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const present = await evalJs(client, `!!document.querySelector(${JSON.stringify(selector)})`)
    if (present) return true
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}

/** Aguarda texto específico aparecer. */
export async function waitForText(client, text, timeoutMs = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const found = await evalJs(client, `document.body.innerText.includes(${JSON.stringify(text)})`)
    if (found) return true
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}

/** Click element via CSS selector. Retorna true se element existia. */
export async function clickSelector(client, selector) {
  return await evalJs(client, `
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return false
      el.scrollIntoView({block:'center'})
      el.click()
      return true
    })()
  `)
}

/** Click elemento por texto exato. */
export async function clickByText(client, text, tag = '*') {
  return await evalJs(client, `
    (() => {
      const els = Array.from(document.querySelectorAll(${JSON.stringify(tag)}))
      const el = els.find(e => (e.innerText || '').trim() === ${JSON.stringify(text)})
      if (!el) return false
      el.scrollIntoView({block:'center'})
      el.click()
      return true
    })()
  `)
}

/** Type em input via native setter (dispatch React onChange). */
export async function typeInto(client, selector, value) {
  return await evalJs(client, `
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return false
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(el, ${JSON.stringify(value)})
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()
  `)
}

/** Navega via History API. */
export async function navigate(client, path) {
  return await evalJs(client, `
    (() => {
      history.pushState({}, '', ${JSON.stringify(path)})
      window.dispatchEvent(new PopStateEvent('popstate'))
      return location.pathname
    })()
  `)
}

/** State do app pra inspeção. */
export async function getState(client) {
  return await evalJs(client, `
    (() => ({
      url: location.pathname + location.search,
      title: document.title,
      online: navigator.onLine,
      adMobShown: !!window.__dosyAdMobShown,
      statusBarHeight: window.__dosySystemStatusBarHeight,
      toasts: Array.from(document.querySelectorAll('[role="status"], [role="alert"]'))
        .map(t => t.textContent?.trim().substring(0, 100))
        .filter(Boolean),
      visibleText: document.body.innerText.substring(0, 500),
    }))()
  `)
}

export async function findCdpPage(port, urlPattern = /localhost|10\.0\.2\.2/) {
  const pages = await listPages(port)
  const dosy = pages.find(p => urlPattern.test(p.url))
  if (!dosy) {
    const allUrls = pages.map(p => p.url).join(', ')
    throw new Error(`No page matching ${urlPattern} on port ${port}. Available: ${allUrls}`)
  }
  return dosy
}

// v0.2.6.8 FIX MEL-005 — Pull-to-refresh helper via adb input swipe.
// Permite testar §4.9 (PtR Dashboard), §11 (offline scroll) em runner Appium/CDP.
// usePullToRefresh.js threshold=80px, MAX_PULL=120 com RESISTANCE 2.5 → swipe
// real precisa de ~200-350px de delta pra cruzar threshold (passa pra distance
// > 80 após resistance). Default 1000ms (suficiente pra trigger + animação).
export async function ptrSwipe(adbSerial, opts = {}) {
  const { execSync } = await import('child_process')
  const startX = opts.x ?? 540
  const startY = opts.startY ?? 300
  const endY = opts.endY ?? 1500
  const durationMs = opts.durationMs ?? 1000
  execSync(`adb -s ${adbSerial} shell input swipe ${startX} ${startY} ${startX} ${endY} ${durationMs}`,
    { stdio: 'pipe' })
  // Aguarda spinner aparecer + refresh completar + "✓ Atualizado" desaparecer (1200ms).
  await new Promise(r => setTimeout(r, 2500))
}

// v0.2.6.8 FIX MEL-009 — pm clear pra reset app data antes de Mod 01 (ConsentBanner fresh).
// Roteiro §1.1 espera ConsentBanner em fresh launch. Sem isso QA encontra app já
// onboardado (consent dismissed) e Mod 01.1 falha silenciosamente.
export async function resetAppData(adbSerial, pkg = 'com.dosyapp.dosy.dev') {
  const { execSync } = await import('child_process')
  execSync(`adb -s ${adbSerial} shell pm clear ${pkg}`, { stdio: 'pipe' })
  // Re-launch (pm clear força stop). Cold-start leva ~3-5s.
  execSync(`adb -s ${adbSerial} shell monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`, { stdio: 'pipe' })
  await new Promise(r => setTimeout(r, 5000))
}
