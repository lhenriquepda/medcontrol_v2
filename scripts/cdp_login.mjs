// Chrome DevTools Protocol — execute JS in WebView to login.
// Bypasses keyboard input limitation in webview HTML forms via ADB.
import { WebSocket } from 'ws'

const PAGE_ID = process.argv[2]
const EMAIL = process.argv[3] || 'daffiny.estevam@gmail.com'
const PASS = process.argv[4] || '123456'

const ws = new WebSocket(`ws://localhost:9222/devtools/page/${PAGE_ID}`)
let msgId = 0

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId
    ws.send(JSON.stringify({ id, method, params }))
    const handler = (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.id === id) { ws.off('message', handler); resolve(msg.result) }
    }
    ws.on('message', handler)
  })
}

ws.on('open', async () => {
  console.log('CDP connected')
  await send('Runtime.enable')
  // Login via Supabase JS imported dynamically
  const script = `
    (async () => {
      const m = await import('/src/services/supabase.js').catch(()=>null)
      if (!m?.supabase) {
        // Fallback: tap login form + fill via DOM
        const email = document.querySelector('input[type="email"]')
        const pass = document.querySelector('input[type="password"]')
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Entrar'))
        if (!email) return 'no email input found'
        const setVal = (el, v) => {
          const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
          desc.set.call(el, v)
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
        setVal(email, '${EMAIL}')
        setVal(pass, '${PASS}')
        await new Promise(r => setTimeout(r, 200))
        btn?.click()
        return 'login form submitted via DOM'
      }
      const { error } = await m.supabase.auth.signInWithPassword({ email: '${EMAIL}', password: '${PASS}' })
      return error ? ('error: ' + error.message) : ('signed in as ${EMAIL}')
    })()
  `
  const res = await send('Runtime.evaluate', {
    expression: script,
    awaitPromise: true,
    returnByValue: true,
  })
  console.log('Result:', JSON.stringify(res.result?.value || res.result || res.exceptionDetails))
  ws.close()
  process.exit(0)
})

ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1) })
