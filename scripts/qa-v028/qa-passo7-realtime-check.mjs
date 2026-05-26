// Passo 7: Verifica se paciente aparece no S25U via Realtime (sem reload)
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9223);

// Navega S25U para Pacientes (se não estiver lá já)
const initial = await evalCDP(`(() => ({ pathname: location.pathname, hasQA: /QA_Paciente/.test(document.body.textContent) }))`);
console.log('S25U initial:', JSON.stringify(initial));

if (initial && initial.pathname && !initial.pathname.startsWith('/pacientes')) {
  const click = await evalCDP(`(() => {
    const link = Array.from(document.querySelectorAll('a')).find(a => (a.textContent||'').trim() === 'Pacientes');
    if (!link) return { fail: true };
    link.click();
    return { ok: true };
  })()`);
  console.log('navega Pacientes:', JSON.stringify(click));
}
await sleep(2500);
console.log('shot pacientes inicial:', await screenshot(send, 'S25U_step7_pacientes_initial'));

// Polling: dose deveria aparecer em <2s via Realtime
let appeared = false;
let appearedAt = null;
const t0 = Date.now();
for (let i = 1; i <= 15; i++) {
  await sleep(1000);
  const st = await evalCDP(`(() => ({
    pathname: location.pathname,
    hasQA: /QA_Paciente_v0283_01/.test(document.body.textContent),
    bodySnip: document.body.textContent.trim().slice(0,200),
  }))`);
  if (st.hasQA) {
    appeared = true; appearedAt = Date.now() - t0;
    console.log('t=' + i + 's: APARECEU em', appearedAt, 'ms via Realtime ✅');
    break;
  }
}
if (!appeared) {
  console.log('NÃO APARECEU em 15s — Realtime falhou OU paciente não veio cross-account');
}
console.log('shot final:', await screenshot(send, 'S25U_step7_after_realtime'));

process.exit(0);
