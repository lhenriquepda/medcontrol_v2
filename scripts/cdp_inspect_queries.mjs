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
      // Find QueryClient via React fiber walk
      try {
        const root = document.querySelector('#root');
        const findFiber = (node) => {
          const k = Object.keys(node).find(k => k.startsWith('__reactContainer$') || k.startsWith('__reactFiber$'));
          return k ? node[k] : null;
        };
        let fiber = findFiber(root);
        if (!fiber) return JSON.stringify({error: 'no fiber'});
        // walk up to find PersistQueryClientProvider
        let qc = null;
        const visit = (f, depth) => {
          if (!f || depth > 30 || qc) return;
          // PersistQueryClientProvider stores client in memoizedProps.client
          if (f.memoizedProps?.client?.getQueryCache) {
            qc = f.memoizedProps.client;
            return;
          }
          if (f.stateNode?.queryClient) {
            qc = f.stateNode.queryClient;
            return;
          }
          if (f.child) visit(f.child, depth + 1);
          if (f.sibling) visit(f.sibling, depth + 1);
        };
        visit(fiber.stateNode?.current || fiber, 0);
        if (!qc) return JSON.stringify({error: 'no QueryClient found'});
        const all = qc.getQueryCache().getAll();
        const dosesQueries = all
          .filter(q => Array.isArray(q.queryKey) && q.queryKey[0] === 'doses')
          .map(q => ({
            key: q.queryKey,
            from: q.queryKey[1]?.from,
            to: q.queryKey[1]?.to,
            state: q.state.status,
            dataLen: Array.isArray(q.state?.data) ? q.state.data.length : (typeof q.state?.data),
            isStale: q.isStale(),
            isActive: q.isActive(),
            observers: q.observers.length,
            updatedAt: q.state.dataUpdatedAt ? new Date(q.state.dataUpdatedAt).toISOString() : null
          }));
        return JSON.stringify({
          totalQueries: all.length,
          activeDoses: dosesQueries.filter(q => q.isActive),
          allDosesQueries: dosesQueries
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
