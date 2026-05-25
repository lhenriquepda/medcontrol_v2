// Fase C: trigger evento real server-side e capturar payload Realtime via CDP
import WebSocket from 'ws';
import { execSync } from 'child_process';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const list = JSON.parse(execSync('curl -s http://127.0.0.1:9222/json/list').toString());
const dosy = list.find(d => d.title === 'Dosy');
const ws = new WebSocket(dosy.webSocketDebuggerUrl);
await new Promise(r => ws.once('open', r));

let id = 1;
const pending = new Map();
const wsFrames = [];
const consoleMsgs = [];

ws.on('message', d => {
  const m = JSON.parse(d.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Network.webSocketFrameReceived') {
    const payload = m.params.response?.payloadData || '';
    if (payload.includes('postgres_changes') || payload.includes('insert') || payload.includes('update') || payload.includes('event')) {
      wsFrames.push({ received: true, payload: payload.slice(0, 400), ts: Date.now() });
    }
  } else if (m.method === 'Runtime.consoleAPICalled') {
    consoleMsgs.push((m.params.args||[]).map(a => a.value || a.description).join(' '));
  }
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
  if (r.exceptionDetails) return { exc: r.exceptionDetails.text };
  return r.result?.value;
}

await send('Runtime.enable');
await send('Network.enable');

// Confirma que manager está ativo
const stateBefore = await evalCDP(`(() => {
  const m = window.__realtimeManager;
  return { isActive: m.isActive, ff: m._featureFlagEnabled };
})()`);
console.log('Antes do trigger:', JSON.stringify(stateBefore));

// Aguarda 3s pra estabilizar canal
await sleep(3000);
wsFrames.length = 0;
consoleMsgs.length = 0;

console.log('\nTrigger pronto. Aguardando evento SQL externo...');
await sleep(15000); // janela de 15s pra script SQL externo rodar

console.log(`\nResultado: ${wsFrames.length} frames WS contendo postgres_changes/event captured`);
wsFrames.slice(0, 5).forEach((f, i) => {
  console.log(`\n[Frame ${i+1}] ${f.payload}`);
});

console.log('\nConsole msgs durante janela:', consoleMsgs.length);
const dashRefresh = consoleMsgs.filter(m => /fetchDashboard|realtime|received/i.test(m));
console.log('Realtime-related msgs:', dashRefresh.length);
dashRefresh.slice(0,3).forEach(m => console.log('  ', m.slice(0,200)));

ws.close();
