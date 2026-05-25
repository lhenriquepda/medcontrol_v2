// Debug S25U state — skeleton ainda visível
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP, ws } = await connect(9223);

// Enable Network to see in-flight requests
await send('Network.enable');

const supabaseEvents = [];
ws.on('message', (data) => {
  try {
    const m = JSON.parse(data.toString());
    if (m.method === 'Network.requestWillBeSent' && /supabase|rpc/i.test(m.params.request.url)) {
      supabaseEvents.push({ ts: Date.now(), event: 'sent', url: m.params.request.url.slice(0,150), id: m.params.requestId });
    } else if (m.method === 'Network.responseReceived' && /supabase|rpc/i.test(m.params.response.url)) {
      supabaseEvents.push({ ts: Date.now(), event: 'response', status: m.params.response.status, url: m.params.response.url.slice(0,150) });
    } else if (m.method === 'Network.loadingFailed') {
      // log all failures regardless of url for triage
      supabaseEvents.push({ ts: Date.now(), event: 'failed', err: m.params.errorText, type: m.params.type });
    }
  } catch {}
});

const state = await evalCDP(`(() => ({
  pathname: location.pathname,
  hasQA: /QA_Paciente_v0283_01/.test(document.body.textContent),
  patientCount: document.querySelectorAll('a[href^="/pacientes/"]').length,
  bodySnip: document.body.textContent.trim().slice(0, 400),
  hasSkeletonAttr: document.querySelectorAll('[class*="skeleton"], [aria-busy="true"]').length,
}))`);
console.log('S25U state:', JSON.stringify(state, null, 2));

// Aguarda 20s coletando eventos network
await sleep(20000);
console.log('\nNetwork events durante 20s:');
console.log(JSON.stringify(supabaseEvents.slice(0, 15), null, 2));

const finalState = await evalCDP(`(() => ({
  pathname: location.pathname,
  hasQA: /QA_Paciente_v0283_01/.test(document.body.textContent),
  patientCount: document.querySelectorAll('a[href^="/pacientes/"]').length,
}))`);
console.log('\nfinal:', JSON.stringify(finalState, null, 2));
console.log('shot:', await screenshot(send, 'S25U_debug'));
process.exit(0);
