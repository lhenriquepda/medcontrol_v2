// Validação automática pendências v0.2.8.1 Validar.md linhas 43-45
// - Item 1: TreatmentForm — chip intervalo + switch modo sem crash/render loop
// - Item 2: Rollback otimista — forçar 404 marcando dose deletada server-side

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

async function main() {
  const cdp = await CDP.connect();
  const log = (...args) => console.log(...args);

  log('\n=== STEP 0: Estado inicial ===');
  let state = await cdp.eval(`
    ({
      pathname: location.pathname,
      bodyExcerpt: document.body.innerText.slice(0, 300),
      hasOverlay: !!document.querySelector('[role="dialog"]'),
    })
  `);
  log('pathname:', state.pathname);
  log('body:', state.bodyExcerpt.replace(/\n/g, ' | ').slice(0,200));

  // VAL 1: TreatmentForm chip intervalo + switch modo
  log('\n=== VAL 1: TreatmentForm — chip intervalo + switch modo (sem render loop) ===');
  cdp.resetLogs();

  await cdp.eval(`history.pushState({}, '', '/tratamento/novo'); window.dispatchEvent(new PopStateEvent('popstate'));`);
  await sleep(2500);
  state = await cdp.eval(`({ pathname: location.pathname, body: document.body.innerText.slice(0, 800) })`);
  log('after navigate pathname:', state.pathname);
  log('form snippet:', state.body.replace(/\n/g, ' | ').slice(0,500));

  await sleep(1000);
  const formInfo = await cdp.eval(`
    (() => {
      const chips = Array.from(document.querySelectorAll('button')).filter(b => /\\b(6h|8h|12h|24h|Cont|Manh)/i.test(b.textContent || ''));
      return {
        chipCount: chips.length,
        chipLabels: chips.map(c => c.textContent.trim().slice(0, 30)),
        allButtons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0,30)).filter(t=>t.length<30 && t.length>0).slice(0,50),
      };
    })()
  `);
  log('form info:', JSON.stringify(formInfo, null, 2));

  log('--- click chip 6h ---');
  const tap6h = await cdp.eval(`
    (() => {
      const chips = Array.from(document.querySelectorAll('button')).filter(b => /^\\s*6h\\s*$/.test(b.textContent || ''));
      if (chips.length === 0) return { found: false };
      chips[0].scrollIntoView({block:'center'});
      chips[0].click();
      return { found: true, count: chips.length };
    })()
  `);
  log('6h click:', JSON.stringify(tap6h));
  await sleep(800);

  log('--- click chip 24h ---');
  const tap24h = await cdp.eval(`
    (() => {
      const chips = Array.from(document.querySelectorAll('button')).filter(b => /^\\s*24h\\s*$/.test(b.textContent || ''));
      if (chips.length === 0) return { found: false };
      chips[0].click();
      return { found: true, count: chips.length };
    })()
  `);
  log('24h click:', JSON.stringify(tap24h));
  await sleep(800);

  log('--- click chip 8h ---');
  const tap8h = await cdp.eval(`
    (() => {
      const chips = Array.from(document.querySelectorAll('button')).filter(b => /^\\s*8h\\s*$/.test(b.textContent || ''));
      if (chips.length === 0) return { found: false };
      chips[0].click();
      return { found: true, count: chips.length };
    })()
  `);
  log('8h click:', JSON.stringify(tap8h));
  await sleep(800);

  log('--- click "Cont" mode ---');
  const tapCont = await cdp.eval(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => /^\\s*Cont/i.test(b.textContent || '') && (b.textContent||'').length < 20);
      if (btns.length === 0) return { found: false };
      btns[0].click();
      return { found: true, count: btns.length, label: btns[0].textContent.trim() };
    })()
  `);
  log('Continuo click:', JSON.stringify(tapCont));
  await sleep(800);

  log('--- click "Por dias" mode ---');
  const tapDur = await cdp.eval(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => /^(\\s*Por dias|\\s*Per|\\s*Dura)/i.test(b.textContent || '') && (b.textContent||'').length < 25);
      if (btns.length === 0) return { found: false };
      btns[0].click();
      return { found: true, count: btns.length, label: btns[0].textContent.trim() };
    })()
  `);
  log('Por dias click:', JSON.stringify(tapDur));
  await sleep(800);

  log('--- toggle mode mais 2x pra estressar setState ---');
  await cdp.eval(`document.querySelectorAll('button').forEach(b => { if (/^\\s*Cont/i.test(b.textContent||'') && (b.textContent||'').length<20) b.click(); });`);
  await sleep(400);
  await cdp.eval(`document.querySelectorAll('button').forEach(b => { if (/^(\\s*Por dias|\\s*Per|\\s*Dura)/i.test(b.textContent||'') && (b.textContent||'').length<25) b.click(); });`);
  await sleep(400);

  log('--- console errors até aqui ---');
  const errCount = cdp.errors.length;
  const warnCount = cdp.consoleMsgs.filter(m => m.type === 'warning').length;
  const setStateWarnings = cdp.consoleMsgs.filter(m => /set-state-in-effect|Cannot update a component while rendering|Maximum update depth/i.test(m.text || ''));
  log(`exceptions: ${errCount}, warnings: ${warnCount}, setState/loop warns: ${setStateWarnings.length}`);
  if (errCount > 0) {
    log('errors:', cdp.errors.slice(0,3).map(e => e.text || e.exception?.description));
  }
  if (setStateWarnings.length > 0) {
    log('setState warnings:', setStateWarnings.slice(0,3).map(w => w.text));
  }

  const val1_clicked = tap6h.found || tap8h.found || tap24h.found || tapCont.found || tapDur.found;
  const val1_pass = errCount === 0 && setStateWarnings.length === 0 && val1_clicked;
  log(`\nVAL 1 result: ${val1_pass ? 'PASS' : 'FAIL'}`);

  // VAL 2: rollback otimista
  log('\n=== VAL 2: Rollback otimista — marcar dose com tratamento deletado server-side ===');
  log('STEP: voltando ao Dashboard');
  await cdp.eval(`history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate'));`);
  await sleep(1500);
  state = await cdp.eval(`({ pathname: location.pathname, body: document.body.innerText.slice(0, 400) })`);
  log('after back pathname:', state.pathname);
  log('body:', state.body.replace(/\n/g,' | ').slice(0,300));

  log('\n=== RESUMO ===');
  log(`VAL 1 TreatmentForm switch: ${val1_pass ? 'PASS' : 'FAIL'} (errors=${errCount}, setStateWarn=${setStateWarnings.length})`);
  log(`VAL 2 rollback otimista: pending SQL setup`);

  // Output JSON pra script externo capturar
  console.log('\nJSON_RESULT:' + JSON.stringify({
    val1: { pass: val1_pass, errors: errCount, setStateWarnings: setStateWarnings.length, clicks: { tap6h, tap8h, tap24h, tapCont, tapDur } },
    val2: { status: 'pending-sql' },
  }));

  cdp.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
