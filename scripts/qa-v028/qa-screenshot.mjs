// Screenshot ambos os devices
import WebSocket from 'ws';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DEVICES = [
  { name: 'emul-5554', port: 9222 },
  { name: 'S25U',      port: 9223 },
];

const outDir = path.resolve(process.cwd(), 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

async function shoot({ name, port }) {
  const list = JSON.parse(execSync(`curl -s http://127.0.0.1:${port}/json/list`).toString());
  const dosy = list.find(d => d.title === 'Dosy' && d.type === 'page');
  if (!dosy) { console.log(`[${name}] no target`); return; }
  const ws = new WebSocket(dosy.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));
  let id = 1; const pending = new Map();
  ws.on('message', d => { const m = JSON.parse(d.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params={}) => new Promise(res => { const myId = id++; pending.set(myId, m => res(m.result)); ws.send(JSON.stringify({id:myId,method,params})); });
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 50 });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(outDir, `${name}_${ts}.jpg`);
  fs.writeFileSync(outPath, Buffer.from(r.data, 'base64'));
  console.log(`[${name}] ${outPath}`);
  ws.close();
}

for (const d of DEVICES) { await shoot(d); }
