// VAL 2 — Disparo da mutation com 404 forçado
// Pré-condição: modal aberto na dose b1bb83af + dose deve ter sido deletada server-side ANTES dessa execução
// Estratégia: inspecionar botões do modal, tap "Tomada", aguardar 6s, capturar console + toast

import WebSocket from 'ws';
import { execSync } from 'child_process';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWs() {
  const r = execSync('curl -s http://127.0.0.1:9222/json/list').toString();
  const list = JSON.parse(r);
  const dosy = list.find(d => d.title === 'Dosy' || (d.url || '').startsWith('https://localhost'));
  if (!dosy) throw new Error('No Dosy target found. Available: ' + JSON.stringify(list.map(d => d.title || d.url)));
  return dosy.webSocketDebuggerUrl;
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.pending = new Map();
    this.consoleMsgs = [];
    this.errors = [];
    this.network = [];
  }
  static async connect() {
    const wsUrl = await getWs();
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
    const cdp = new CDP(ws);
    ws.on('message', (data) => {
      const m = JSON.parse(data.toString());
      if (m.id && cdp.pending.has(m.id)) {
        cdp.pending.get(m.id)(m);
        cdp.pending.delete(m.id);
      } else if (m.method === 'Runtime.consoleAPICalled') {
        const text = (m.params.args || []).map(a => a.value || a.description).join(' ');
        cdp.consoleMsgs.push({ type: m.params.type, text });
      } else if (m.method === 'Runtime.exceptionThrown') {
        cdp.errors.push(m.params.exceptionDetails);
      } else if (m.method === 'Network.responseReceived') {
        const u = m.params.response?.url || '';
        if (u.includes('confirm_dose') || u.includes('rpc/') || u.includes('rest/v1')) {
          cdp.network.push({ url: u, status: m.params.response?.status });
        }
      }
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    return cdp;
  }
  send(method, params={}) {
    return new Promise((resolve, reject) => {
      const myId = this.id++;
      this.pending.set(myId, (m) => m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result));
      this.ws.send(JSON.stringify({ id: myId, method, params }));
    });
  }
  async eval(expression, awaitPromise=true) {
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text + ' ' + (res.result?.description || ''));
    }
    return res.result?.value;
  }
  close() { this.ws.close(); }
  resetLogs() { this.consoleMsgs = []; this.errors = []; this.network = []; }
}

async function main() {
  const cdp = await CDP.connect();
  const log = (...args) => console.log(...args);

  log('=== VAL 2 Trigger — tap Tomada esperando 404 ===');

  // STEP A: estado inicial — confirma modal aberto + lista botões
  const beforeState = await cdp.eval(`
    (() => {
      const dlg = document.querySelector('[role="dialog"], [aria-modal="true"], .DialogPortal');
      if (!dlg) {
        // tentar abrir tap na dose
        const all = Array.from(document.querySelectorAll('*'));
        const cards = all.filter(el => /QA-Rollback Med/.test(el.textContent || '') && /pendente/i.test(el.textContent || '') && el.matches('button, [role="button"], li, article'));
        if (cards.length === 0) return { dialog: false, openedFresh: false };
        cards[0].click();
        return { dialog: false, openedFresh: true };
      }
      const buttons = Array.from(dlg.querySelectorAll('button')).map(b => ({
        text: (b.textContent || '').trim().slice(0, 40),
        ariaLabel: b.getAttribute('aria-label'),
        disabled: b.disabled,
      }));
      return { dialog: true, buttons };
    })()
  `);
  log('beforeState:', JSON.stringify(beforeState, null, 2));

  if (beforeState.openedFresh) {
    await sleep(1500);
    const post = await cdp.eval(`
      (() => {
        const dlg = document.querySelector('[role="dialog"], [aria-modal="true"]');
        if (!dlg) return { dialog: false };
        const buttons = Array.from(dlg.querySelectorAll('button')).map(b => ({
          text: (b.textContent || '').trim().slice(0, 40),
          ariaLabel: b.getAttribute('aria-label'),
          disabled: b.disabled,
        }));
        return { dialog: true, buttons };
      })()
    `);
    log('after fresh open:', JSON.stringify(post, null, 2));
    if (!post.dialog) { log('FATAL: modal não abriu'); cdp.close(); process.exit(2); }
  }

  cdp.resetLogs();

  // STEP B: clica "Tomada"
  log('\nSTEP B: tap "Tomada"');
  const tapTomada = await cdp.eval(`
    (() => {
      const dlg = document.querySelector('[role="dialog"], [aria-modal="true"]');
      const scope = dlg || document;
      const btns = Array.from(scope.querySelectorAll('button')).filter(b => /^\\s*(Tomada|Marcar como tomada|Tomar agora|Confirmar)\\s*$/i.test(b.textContent || ''));
      if (btns.length === 0) {
        return { found: false, allBtns: Array.from(scope.querySelectorAll('button')).map(b => (b.textContent || '').trim().slice(0, 50)) };
      }
      btns[0].click();
      return { found: true, label: btns[0].textContent.trim() };
    })()
  `);
  log('tapTomada:', JSON.stringify(tapTomada));

  // Aguarda 6s pra RPC + revert + toast
  log('\nSTEP C: aguardar 6s pra RPC + revert + toast...');
  await sleep(6000);

  // STEP D: capturar estado final
  const afterState = await cdp.eval(`({
    body: document.body.innerText.slice(0, 2000),
    hasToast: !!document.querySelector('[role="alert"], [role="status"], .Toaster__toast, [data-sonner-toast], [class*="toast"]'),
    toastSnippets: Array.from(document.querySelectorAll('[role="alert"], [role="status"], [class*="toast"], [class*="Toaster"]')).slice(0,6).map(el => (el.textContent || '').trim().slice(0,200)),
    doseStillPending: /QA-Rollback Med[\\s\\S]*pendente/.test(document.body.innerText.replace(/[\\n\\r]/g, ' ')),
    doseMarked: /QA-Rollback Med[\\s\\S]*tomada/.test(document.body.innerText.replace(/[\\n\\r]/g, ' ')),
  })`);
  log('afterState:', JSON.stringify(afterState, null, 2));

  log('\n--- Console capturado ---');
  log('exceptions:', cdp.errors.length);
  log('console msgs total:', cdp.consoleMsgs.length);
  const relevant = cdp.consoleMsgs.filter(m => /404|revert|emitMutationError|drain|markDose|RPC|fail|error|toast/i.test(m.text || ''));
  log('relevant msgs:');
  relevant.slice(0,15).forEach(m => log(`  [${m.type}] ${m.text.slice(0,300)}`));

  log('\n--- Network capturado ---');
  log('network entries:', cdp.network.length);
  cdp.network.slice(-15).forEach(n => log(`  ${n.status} ${n.url.slice(0, 150)}`));

  log('\n=== JSON_RESULT_VAL2 ===');
  console.log(JSON.stringify({
    tapTomadaFound: tapTomada.found,
    hasToast: afterState.hasToast,
    doseStillPending: afterState.doseStillPending,
    doseMarkedAsDone: afterState.doseMarked,
    networkFails: cdp.network.filter(n => n.status >= 400).map(n => ({ url: n.url.slice(0, 100), status: n.status })),
    exceptionsCount: cdp.errors.length,
  }));

  cdp.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
