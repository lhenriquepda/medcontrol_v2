// Mede egress numa janela de N segundos via CDP Network domain.
// Uso: node v0282-egress-measure.mjs <label> <seconds>
// Captura: HTTP requests/bytes + WebSocket frames/bytes + console msgs + manager state.

import WebSocket from 'ws';
import { execSync } from 'child_process';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWs() {
  const r = execSync('curl -s http://127.0.0.1:9222/json/list').toString();
  const list = JSON.parse(r);
  const dosy = list.find(d => d.title === 'Dosy');
  if (!dosy) throw new Error('no Dosy target');
  return dosy.webSocketDebuggerUrl;
}

const label = process.argv[2] || 'unknown';
const seconds = parseInt(process.argv[3] || '90', 10);

async function main() {
  const wsUrl = await getWs();
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.once('open', r));

  let id = 1;
  const pending = new Map();
  const consoleMsgs = [];
  const network = { reqCount: 0, bytes: 0, wsFrames: 0, wsBytes: 0, requests: new Map(), realtimeFrames: 0 };

  function send(method, params={}) {
    return new Promise((resolve, reject) => {
      const myId = id++;
      pending.set(myId, m => m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result));
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  }
  function evalCDP(expr) {
    return send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }).then(r => r.result?.value);
  }

  ws.on('message', (data) => {
    const m = JSON.parse(data.toString());
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    const method = m.method;
    if (method === 'Runtime.consoleAPICalled') {
      consoleMsgs.push((m.params.args || []).map(a => a.value || a.description).join(' '));
    } else if (method === 'Network.requestWillBeSent') {
      network.requests.set(m.params.requestId, { url: m.params.request?.url, method: m.params.request?.method });
      network.reqCount++;
    } else if (method === 'Network.dataReceived') {
      network.bytes += (m.params.encodedDataLength || 0);
    } else if (method === 'Network.webSocketFrameReceived' || method === 'Network.webSocketFrameSent') {
      network.wsFrames++;
      const len = (m.params.response?.payloadData || '').length;
      network.wsBytes += len;
      // Heurística: payload Realtime tem typically "phoenix" or "postgres_changes"
      const payload = m.params.response?.payloadData || '';
      if (payload.includes('postgres_changes') || payload.includes('realtime') || payload.includes('phx_reply')) {
        network.realtimeFrames++;
      }
    }
  });

  await send('Runtime.enable');
  await send('Network.enable');

  console.log(`=== Medição: ${label} (${seconds}s) ===`);

  // Estado inicial do manager
  const mgrState = await evalCDP(`
    (() => {
      const m = window.__realtimeManager;
      if (!m) return { hasManager: false };
      return {
        hasManager: true,
        isActive: m.isActive,
        isPaused: m.isPaused,
        pauseReasons: m.pauseReasons,
        featureFlagEnabled: m.featureFlagEnabled,
      };
    })()
  `);
  console.log('Manager:', JSON.stringify(mgrState));

  const startBody = await evalCDP(`document.body.innerText.slice(0, 200)`);
  console.log('Body:', startBody.replace(/\n/g, ' | ').slice(0, 150));

  // RESET counters
  network.reqCount = 0;
  network.bytes = 0;
  network.wsFrames = 0;
  network.wsBytes = 0;
  network.realtimeFrames = 0;
  network.requests.clear();
  consoleMsgs.length = 0;

  const t0 = Date.now();
  await sleep(seconds * 1000);
  const elapsed = (Date.now() - t0) / 1000;

  // Estado final manager
  const mgrFinal = await evalCDP(`
    (() => {
      const m = window.__realtimeManager;
      if (!m) return { hasManager: false };
      return {
        isActive: m.isActive,
        isPaused: m.isPaused,
        pauseReasons: m.pauseReasons,
        featureFlagEnabled: m.featureFlagEnabled,
      };
    })()
  `);

  const uniqUrls = [...new Set([...network.requests.values()].map(r => {
    try { return new URL(r.url).pathname.slice(0, 60); } catch { return (r.url || '').slice(0, 60); }
  }))].slice(0, 15);

  console.log(`\nResultado (${label}, ${elapsed.toFixed(1)}s):`);
  console.log(`  HTTP requests:    ${network.reqCount}`);
  console.log(`  HTTP bytes recv:  ${network.bytes} (${(network.bytes/1024).toFixed(2)} KB)`);
  console.log(`  WS frames total:  ${network.wsFrames}`);
  console.log(`  WS bytes total:   ${network.wsBytes} (${(network.wsBytes/1024).toFixed(2)} KB)`);
  console.log(`  WS realtime evts: ${network.realtimeFrames}`);
  console.log(`  Console msgs:     ${consoleMsgs.length}`);
  console.log(`  Unique URLs:      ${JSON.stringify(uniqUrls)}`);
  console.log(`  Manager final:    ${JSON.stringify(mgrFinal)}`);

  // Extrapolação
  const totalBytes = network.bytes + network.wsBytes;
  console.log(`\n  TOTAL bytes (HTTP+WS):  ${totalBytes} (${(totalBytes/1024).toFixed(2)} KB)`);
  console.log(`  Extrap KB/h:            ${((totalBytes/elapsed)*3600/1024).toFixed(2)}`);
  console.log(`  Extrap MB/dia (16h on): ${((totalBytes/elapsed)*3600*16/1024/1024).toFixed(2)}`);

  console.log(`\nJSON_${label}: ${JSON.stringify({
    label, seconds: elapsed,
    http_reqs: network.reqCount,
    http_bytes: network.bytes,
    ws_frames: network.wsFrames,
    ws_bytes: network.wsBytes,
    ws_realtime_frames: network.realtimeFrames,
    total_bytes: totalBytes,
    extrap_kb_per_hour: (totalBytes/elapsed)*3600/1024,
    console_msgs: consoleMsgs.length,
    manager_initial: mgrState,
    manager_final: mgrFinal,
  })}`);

  ws.close();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
