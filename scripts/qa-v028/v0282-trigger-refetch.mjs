// Força manager._refetchFeatureFlag() — sem esperar 60min poll natural.
import WebSocket from 'ws';
import { execSync } from 'child_process';

const wsUrl = execSync('curl -s http://127.0.0.1:9222/json/list').toString();
const list = JSON.parse(wsUrl);
const dosy = list.find(d => d.title === 'Dosy');
const ws = new WebSocket(dosy.webSocketDebuggerUrl);
await new Promise(r => ws.once('open', r));

let id = 1;
const pending = new Map();
ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
function send(method, params={}) {
  return new Promise((res, rej) => {
    const myId = id++;
    pending.set(myId, m => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result));
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}
async function evalCDP(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  return r.result?.value;
}

await send('Runtime.enable');

const before = await evalCDP(`
  (() => {
    const m = window.__realtimeManager;
    return m ? { isActive: m.isActive, ff: m.featureFlagEnabled, paused: m.isPaused, reasons: m.pauseReasons } : null;
  })()
`);
console.log('Antes do refetch:', JSON.stringify(before));

const result = await evalCDP(`
  (async () => {
    const m = window.__realtimeManager;
    if (!m) return { error: 'no manager' };
    await m._refetchFeatureFlag();
    // pequena espera pra setSubscription propagar
    await new Promise(r => setTimeout(r, 500));
    return { isActive: m.isActive, ff: m.featureFlagEnabled, paused: m.isPaused, reasons: m.pauseReasons };
  })()
`);
console.log('Após refetch:', JSON.stringify(result));

ws.close();
