// Smoke test v0.2.8.2 — Fase 4 RealtimeManager + Fase 5 boundaries + BUG-MEDINPUT
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

class CDP {
  constructor(ws) { this.ws = ws; this.id = 1; this.pending = new Map(); this.msgs = []; this.errs = []; }
  static async connect() {
    const ws = new WebSocket(await getWs());
    await new Promise(r => ws.once('open', r));
    const cdp = new CDP(ws);
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.id && cdp.pending.has(m.id)) { cdp.pending.get(m.id)(m); cdp.pending.delete(m.id); }
      else if (m.method === 'Runtime.consoleAPICalled') cdp.msgs.push((m.params.args||[]).map(a=>a.value||a.description).join(' '));
      else if (m.method === 'Runtime.exceptionThrown') cdp.errs.push(m.params.exceptionDetails);
    });
    await cdp.send('Runtime.enable');
    return cdp;
  }
  send(method, params={}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, (m) => m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result?.value;
  }
  close() { this.ws.close(); }
}

async function main() {
  const cdp = await CDP.connect();
  const log = (...a) => console.log(...a);

  log('=== Smoke v0.2.8.2 ===');
  await sleep(2000);

  // 1. Versão
  const v = await cdp.eval(`fetch('/version.json').then(r=>r.json())`);
  log('version.json:', JSON.stringify(v));

  // 2. RealtimeManager está disponível?
  const rt = await cdp.eval(`
    (async () => {
      try {
        const mod = await import('/src/core/realtime/manager.js');
        if (!mod.realtimeManager) return { hasManager: false };
        return {
          hasManager: true,
          isActive: mod.realtimeManager.isActive,
          isPaused: mod.realtimeManager.isPaused,
          pauseReasons: mod.realtimeManager.pauseReasons,
          featureFlagEnabled: mod.realtimeManager.featureFlagEnabled,
        };
      } catch (e) {
        // import path falha em prod build (paths bundleados). Tenta global.
        return { error: e.message, hasGlobal: typeof window !== 'undefined' };
      }
    })()
  `);
  log('RealtimeManager state:', JSON.stringify(rt));

  // 3. Boot pathname + body
  const state = await cdp.eval(`({ pathname: location.pathname, body: document.body.innerText.slice(0,400) })`);
  log('boot pathname:', state.pathname);
  log('body excerpt:', state.body.replace(/\n/g,' | ').slice(0,250));

  // 4. MedNameInput abre + tem buttons esperados (TreatmentForm)
  await cdp.eval(`history.pushState({}, '', '/tratamento/novo'); window.dispatchEvent(new PopStateEvent('popstate'));`);
  await sleep(3000);
  const tf = await cdp.eval(`({
    pathname: location.pathname,
    bodyHasMed: /MEDICAMENTO/.test(document.body.innerText),
    bodyHasFreq: /FREQU/i.test(document.body.innerText),
  })`);
  log('TreatmentForm:', JSON.stringify(tf));

  // 5. Erros console
  log('\nexceptions:', cdp.errs.length);
  log('console msgs:', cdp.msgs.length);
  cdp.errs.forEach(e => log('EXC:', e.text || e.exception?.description || JSON.stringify(e).slice(0,200)));
  const errPatterns = cdp.msgs.filter(m => /error|fail|Cannot|undefined is not|realtime/i.test(m)).slice(0, 8);
  log('error/realtime msgs:', errPatterns.map(s => s.slice(0,200)));

  log('\n=== JSON ===');
  console.log(JSON.stringify({
    version: v?.version,
    rtManagerOk: rt?.hasManager === true,
    rtIsActive: rt?.isActive,
    rtFeatureFlag: rt?.featureFlagEnabled,
    bootPathname: state.pathname,
    formLoaded: tf?.bodyHasMed && tf?.bodyHasFreq,
    exceptions: cdp.errs.length,
  }));

  cdp.close();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
