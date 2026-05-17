import { WebSocket } from 'ws'

const PAGE_ID = process.argv[2]
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
  await send('Runtime.enable')
  const script = `
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const entrar = btns.find(b => /entrar/i.test(b.textContent) && !/criar/i.test(b.textContent.toLowerCase()));
      if (!entrar) return 'no entrar button found: ' + btns.map(b => b.textContent.slice(0,20)).join(' | ');
      entrar.click();
      return 'clicked entrar: ' + entrar.textContent.slice(0,30);
    })()
  `
  const res = await send('Runtime.evaluate', { expression: script, returnByValue: true })
  console.log(res.result?.value || JSON.stringify(res.exceptionDetails))
  ws.close()
  process.exit(0)
})

ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1) })
