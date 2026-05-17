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
    (async () => {
      try {
        const open = indexedDB.open('keyval-store');
        await new Promise((r,e) => { open.onsuccess=r; open.onerror=e; });
        const db = open.result;
        const tx = db.transaction('keyval', 'readonly');
        const store = tx.objectStore('keyval');
        const rawVal = await new Promise((r) => { const req = store.get('dosy-query-cache'); req.onsuccess = () => r(req.result); });
        db.close();
        if (!rawVal) return JSON.stringify({error: 'no cache'});
        const parsed = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
        const queries = parsed?.clientState?.queries || [];
        const dosesQueries = queries.filter(q => Array.isArray(q.queryKey) && q.queryKey[0] === 'doses');
        const dpQueries = queries.filter(q => Array.isArray(q.queryKey) && q.queryKey[0] === 'dashboard-payload');
        return JSON.stringify({
          totalSize: typeof rawVal === 'string' ? rawVal.length : JSON.stringify(rawVal).length,
          totalQueries: queries.length,
          dosesQueries: dosesQueries.map(q => ({
            from: q.queryKey[1]?.from,
            to: q.queryKey[1]?.to,
            patient: q.queryKey[1]?.patientId,
            dataLen: Array.isArray(q.state?.data) ? q.state.data.length : 'n/a',
            sizeBytes: JSON.stringify(q.state?.data || '').length
          })),
          dashboardPayloadQueries: dpQueries.map(q => ({
            from: q.queryKey[1]?.from,
            to: q.queryKey[1]?.to,
            dosesInPayload: q.state?.data?.doses?.length,
            sizeBytes: JSON.stringify(q.state?.data || '').length
          }))
        }, null, 2);
      } catch (e) { return JSON.stringify({error: e.message, stack: e.stack}); }
    })()
  `
  const res = await send('Runtime.evaluate', {
    expression: script,
    awaitPromise: true,
    returnByValue: true,
  })
  console.log(res.result?.value || JSON.stringify(res.exceptionDetails))
  ws.close()
  process.exit(0)
})

ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1) })
