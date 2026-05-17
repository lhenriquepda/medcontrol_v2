import { WebSocket } from 'ws'
const PORT = process.argv[2], PAGE_ID = process.argv[3]
const ws = new WebSocket(`ws://localhost:${PORT}/devtools/page/${PAGE_ID}`)
let mid = 0
const send = (m, p={}) => new Promise(r => { const id=++mid; ws.send(JSON.stringify({id,method:m,params:p})); const h=d=>{const x=JSON.parse(d.toString());if(x.id===id){ws.off('message',h);r(x.result)}}; ws.on('message',h) })
ws.on('open', async () => {
  await send('Runtime.enable')
  const s = `
    (() => {
      localStorage.setItem('dosy_permissions_dismissed_version', '0.2.3.7')
      localStorage.setItem('dosy_tour_seen_version', '0.2.3.7')
      return 'ok'
    })()
  `
  const r = await send('Runtime.evaluate', { expression: s, returnByValue: true })
  console.log('LS set:', r.result?.value)
  await send('Page.enable')
  await send('Page.reload')
  console.log('reloaded')
  ws.close(); process.exit(0)
})
ws.on('error', e => { console.error(e.message); process.exit(1) })
