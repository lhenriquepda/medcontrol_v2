// Click Pular button + verify estado
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

const t0 = Date.now();
const click = await evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /^\\s*Pular\\s*$/.test((b.textContent||'').trim()) && !b.disabled);
  if (!btn) return { fail: true };
  btn.click();
  return { clicked: true };
})()`);
console.log('click Pular:', JSON.stringify(click));

// Aguarda modal fechar / dose ficar pulada
for (let i = 1; i <= 15; i++) {
  await sleep(1000);
  const st = await evalCDP(`(() => ({
    modalOpen: !!document.querySelector('[role="dialog"]') || /TestMed_v0283.*PREVISTO/.test(document.body.textContent||''),
    skippedDoses: (document.body.textContent.match(/pulada/gi) || []).length,
  }))`);
  if (st?.modalOpen === false) {
    console.log('t=' + i + 's: modal fechou em', Date.now()-t0, 'ms');
    break;
  }
  if (i % 5 === 0) console.log('t=' + i + 's:', JSON.stringify(st));
}

console.log('shot final:', await screenshot(send, 'emul_step20c_after_pular'));
process.exit(0);
