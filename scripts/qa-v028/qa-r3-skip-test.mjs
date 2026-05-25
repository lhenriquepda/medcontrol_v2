// Mark TestMed_R3 atrasada como Pulada em teste-plus
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Click dose atrasada
const click = await evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /TestMed_R3/.test(b.textContent||'') && /atrasada/i.test(b.textContent||''));
  if (!btn) return { fail: 'no atrasada' };
  btn.click(); return { clicked: true };
})()`);
console.log('click dose:', JSON.stringify(click));
await sleep(1500);

// Click Pular
const clickPular = await evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /^\\s*Pular\\s*$/.test((b.textContent||'').trim()) && !b.disabled);
  if (!btn) return { fail: true };
  btn.click(); return { clicked: true };
})()`);
console.log('click Pular:', JSON.stringify(clickPular));

// Poll BD status
const t0 = Date.now();
process.exit(0);
