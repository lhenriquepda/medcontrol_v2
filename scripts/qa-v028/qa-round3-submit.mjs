// Submit treatment
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

const t0 = Date.now();
const sub = await evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /^Criar tratamento$/.test((b.textContent||'').trim()));
  if (!btn) return { fail: true };
  if (btn.disabled) return { disabled: true };
  btn.click(); return { clicked: true };
})()`);
console.log('submit:', JSON.stringify(sub));

for (let i = 1; i <= 20; i++) {
  await sleep(1000);
  const path = await evalCDP(`location.pathname`);
  if (path && path !== '/tratamento/novo' && typeof path === 'string') {
    console.log('t=' + i + 's: nav to', path, '— OK em', Date.now()-t0, 'ms');
    break;
  }
}

console.log('shot final:', await screenshot(send, 'emul_r3_treatment_final'));
process.exit(0);
