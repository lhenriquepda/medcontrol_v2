// VAL 2 — Rollback otimista: forçar 404 marcando dose deletada server-side
// Pré-requisito: dose b1bb83af-... já criada via SQL pro teste-free.
// Estratégia: reload dashboard → tap dose → SQL delete server-side → tap "Tomada" → esperar 404 + revert + toast

import WebSocket from 'ws';
import { execSync } from 'child_process';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWs() {
  const r = execSync('curl -s http://127.0.0.1:9222/json/list').toString();
  const list = JSON.parse(r);
  return list[0].webSocketDebuggerUrl;
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.pending = new Map();
    this.consoleMsgs = [];
    this.errors = [];
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
      }
    });
    await cdp.send('Runtime.enable');
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
  resetLogs() { this.consoleMsgs = []; this.errors = []; }
}

const DOSE_ID = 'b1bb83af-8e71-47d9-994c-e2ffc30c3f00';

async function main() {
  const cdp = await CDP.connect();
  const log = (...args) => console.log(...args);

  log('=== VAL 2: Rollback otimista forçando 404 ===');

  // STEP 1: forçar refetch dashboard pra trazer a dose
  log('\nSTEP 1: forçar refetch via QueryClient invalidate');
  await cdp.eval(`history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate'));`);
  await sleep(1000);

  // Buscar o queryClient global do React Query
  await cdp.eval(`
    (() => {
      // dispara pull-to-refresh equivalente — invalidate all queries
      const qc = window.__REACT_QUERY_CLIENT__ || (window.__dosyQC__);
      if (qc) {
        qc.invalidateQueries();
        qc.refetchQueries({ type: 'active' });
        return 'invalidated';
      }
      // Fallback: dispatch focus event
      window.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      return 'no qc, dispatched focus';
    })()
  `);
  await sleep(3000);

  // Confirma se dose apareceu
  let state = await cdp.eval(`({
    pathname: location.pathname,
    body: document.body.innerText.slice(0, 1500),
    bodyHasMed: /QA-Rollback Med/.test(document.body.innerText),
  })`);
  log('pathname:', state.pathname);
  log('body has QA-Rollback Med?', state.bodyHasMed);
  log('body:', state.body.replace(/\n/g,' | ').slice(0,800));

  if (!state.bodyHasMed) {
    log('\nDOSE NÃO APARECEU NA UI — tentando reload completo');
    await cdp.eval(`location.reload()`);
    await sleep(4500);
    state = await cdp.eval(`({
      pathname: location.pathname,
      body: document.body.innerText.slice(0, 1500),
      bodyHasMed: /QA-Rollback Med/.test(document.body.innerText),
    })`);
    log('after reload pathname:', state.pathname);
    log('body has QA-Rollback Med?', state.bodyHasMed);
    log('body:', state.body.replace(/\n/g,' | ').slice(0,800));
  }

  if (!state.bodyHasMed) {
    log('FATAL: dose ainda não apareceu na UI mesmo após reload. Saindo.');
    cdp.close();
    process.exit(2);
  }

  // STEP 2: Tap na dose pra abrir DoseModal
  log('\nSTEP 2: tap na dose pra abrir DoseModal');
  cdp.resetLogs();

  const tap = await cdp.eval(`
    (() => {
      const all = Array.from(document.querySelectorAll('*'));
      const candidates = all.filter(el => /QA-Rollback Med/.test(el.textContent || '') && el.tagName !== 'HTML' && el.tagName !== 'BODY');
      // pegar o ancestor clicável mais próximo (button/li/article)
      let target = null;
      for (const el of candidates) {
        let curr = el;
        while (curr && curr !== document.body) {
          if (curr.matches('button, [role="button"], a, li, article, [data-dose-id]')) {
            target = curr;
            break;
          }
          curr = curr.parentElement;
        }
        if (target) break;
      }
      if (!target) {
        return { found: false, candidateCount: candidates.length, firstCandidate: candidates[0]?.tagName + ': ' + (candidates[0]?.textContent || '').slice(0,100) };
      }
      target.scrollIntoView({block:'center'});
      target.click();
      return { found: true, tag: target.tagName, textSnippet: (target.textContent || '').slice(0,100) };
    })()
  `);
  log('tap result:', JSON.stringify(tap));
  await sleep(1500);

  state = await cdp.eval(`({
    body: document.body.innerText.slice(0, 800),
    hasDialog: !!document.querySelector('[role="dialog"], .dose-modal, [aria-modal="true"]'),
  })`);
  log('after tap hasDialog:', state.hasDialog);
  log('body:', state.body.replace(/\n/g,' | ').slice(0,600));

  cdp.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
