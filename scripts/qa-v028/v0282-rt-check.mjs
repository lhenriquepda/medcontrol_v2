import WebSocket from 'ws';
import { execSync } from 'child_process';

const list = JSON.parse(execSync('curl -s http://127.0.0.1:9222/json/list').toString());
const dosy = list.find(d => d.title === 'Dosy');
const ws = new WebSocket(dosy.webSocketDebuggerUrl);
await new Promise(r => ws.once('open', r));

let id = 1;
const pending = new Map();
let frameCount = 0;
let realtimeFrames = 0;
const eventSamples = [];

ws.on('message', d => {
  const m = JSON.parse(d.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Network.webSocketFrameReceived') {
    frameCount++;
    const payload = m.params.response?.payloadData || '';
    if (/postgres_changes|INSERT|UPDATE|new.*record|treatments|doses/i.test(payload)) {
      realtimeFrames++;
      if (eventSamples.length < 3) eventSamples.push(payload.slice(0, 400));
    }
  }
});
function send(method, params={}) {
  return new Promise((res, rej) => {
    const myId = id++;
    pending.set(myId, m => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result));
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}

await send('Network.enable');
console.log('Capturing for 12s (trigger SQL externally NOW)...');

await new Promise(r => setTimeout(r, 12000));

console.log(`Total WS recv frames: ${frameCount}`);
console.log(`Realtime event frames (postgres_changes/INSERT/etc): ${realtimeFrames}`);
eventSamples.forEach((s, i) => console.log(`[${i+1}] ${s}`));

ws.close();
