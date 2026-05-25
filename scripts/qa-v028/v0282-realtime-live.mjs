// Captura WS frames realtime continuamente, escreve em arquivo. Operação ~25s.
import WebSocket from 'ws';
import { execSync } from 'child_process';
import fs from 'fs';

const list = JSON.parse(execSync('curl -s http://127.0.0.1:9222/json/list').toString());
const dosy = list.find(d => d.title === 'Dosy');
const ws = new WebSocket(dosy.webSocketDebuggerUrl);
await new Promise(r => ws.once('open', r));

let id = 1;
const pending = new Map();
const events = [];
ws.on('message', d => {
  const m = JSON.parse(d.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Network.webSocketFrameReceived') {
    const payload = m.params.response?.payloadData || '';
    events.push({ recv: true, len: payload.length, preview: payload.slice(0, 250), ts: Date.now() });
  } else if (m.method === 'Network.webSocketFrameSent') {
    const payload = m.params.response?.payloadData || '';
    events.push({ recv: false, len: payload.length, preview: payload.slice(0, 100), ts: Date.now() });
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
  return r.result?.value;
}

await send('Network.enable');
await send('Runtime.enable');

// Force resume manager
const state = await evalCDP(`(() => {
  const m = window.__realtimeManager;
  m.resumeAll('activity');
  m._registerActivity();
  return { isActive: m.isActive, ff: m._featureFlagEnabled };
})()`);
console.log('Manager state:', JSON.stringify(state));
console.log('Iniciando capture 25s...');

const t0 = Date.now();
await new Promise(r => setTimeout(r, 25_000));

console.log(`\nTotal WS frames: ${events.length}`);
const recvFrames = events.filter(e => e.recv);
const sentFrames = events.filter(e => !e.recv);
console.log(`  Received: ${recvFrames.length} (${recvFrames.reduce((s,e)=>s+e.len,0)} bytes)`);
console.log(`  Sent: ${sentFrames.length} (${sentFrames.reduce((s,e)=>s+e.len,0)} bytes)`);

const realtimeEvents = recvFrames.filter(e => /postgres_changes|INSERT|UPDATE|DELETE|event/i.test(e.preview));
console.log(`\nRealtime postgres events: ${realtimeEvents.length}`);
realtimeEvents.slice(0,3).forEach((e,i) => console.log(`[${i+1}] ${e.preview}`));

console.log('\nLast 5 received frames preview:');
recvFrames.slice(-5).forEach((e,i) => console.log(`  ${i+1}. (${e.len}b) ${e.preview.slice(0,150)}`));

ws.close();
