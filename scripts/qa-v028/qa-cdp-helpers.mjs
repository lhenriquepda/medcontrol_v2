// CDP helpers reusáveis pra QA v0.2.8.3 — conecta a um device, expõe send/eval/tap/etc
import WebSocket from 'ws';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function connect(port) {
  const list = JSON.parse(execSync(`curl -s http://127.0.0.1:${port}/json/list`).toString());
  const dosy = list.find(d => d.title === 'Dosy' && d.type === 'page');
  if (!dosy) throw new Error(`no Dosy target on port ${port}`);
  const ws = new WebSocket(dosy.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));
  let id = 1; const pending = new Map();
  ws.on('message', d => { const m = JSON.parse(d.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params={}) => new Promise(res => { const myId = id++; pending.set(myId, m => res(m.result)); ws.send(JSON.stringify({id:myId,method,params})); });
  const evalCDP = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r?.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r?.result?.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('DOM.enable');
  return { ws, send, evalCDP, target: dosy };
}

export async function screenshot(send, label) {
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 50 });
  const outDir = path.resolve(process.cwd(), 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(11, 19);
  const outPath = path.join(outDir, `${label}_${ts}.jpg`);
  fs.writeFileSync(outPath, Buffer.from(r.data, 'base64'));
  return outPath;
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
