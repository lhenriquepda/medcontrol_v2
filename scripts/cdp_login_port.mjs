// Same as cdp_login.mjs but accepts PORT param: node cdp_login_port.mjs PORT PAGE_ID EMAIL PASS
import { WebSocket } from 'ws'

const PORT = process.argv[2]
const PAGE_ID = process.argv[3]
const EMAIL = process.argv[4]
const PASS = process.argv[5] || '123456'

const ws = new WebSocket(`ws://localhost:${PORT}/devtools/page/${PAGE_ID}`)
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
  console.log(`CDP connected port ${PORT}`)
  await send('Runtime.enable')
  const script = `
    (async () => {
      const email = document.querySelector('input[type="email"]')
      const pass = document.querySelector('input[type="password"]')
      const btns = Array.from(document.querySelectorAll('button'))
      const entrar = btns.find(b => /entrar/i.test(b.textContent) && !/criar/i.test(b.textContent.toLowerCase()))
      if (!email || !pass || !entrar) {
        return JSON.stringify({err:'inputs missing', hasEmail:!!email, hasPass:!!pass, hasBtn:!!entrar})
      }
      const setVal = (el, v) => {
        const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        desc.set.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      setVal(email, '${EMAIL}')
      setVal(pass, '${PASS}')
      await new Promise(r => setTimeout(r, 400))
      entrar.click()
      return 'submitted ${EMAIL}'
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
