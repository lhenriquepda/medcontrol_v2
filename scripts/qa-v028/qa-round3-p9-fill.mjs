// Fill dose, time +5min, duracao 1, categoria via UI tap fallback
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Time +5min from now
const now = new Date();
now.setMinutes(now.getMinutes() + 5);
const targetHHMM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
console.log('target:', targetHHMM);

const fill = await evalCDP(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const inputs = Array.from(document.querySelectorAll('input'));
  const dose = inputs.find(i => /comprimido|gotas/i.test(i.placeholder || ''));
  const timeIn = inputs.find(i => i.type === 'time');
  const durNum = inputs.find(i => i.type === 'number');
  if (dose) {
    setter.call(dose, '1 comp');
    dose.dispatchEvent(new Event('input', { bubbles: true }));
    dose.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (timeIn) {
    setter.call(timeIn, '${targetHHMM}');
    timeIn.dispatchEvent(new Event('input', { bubbles: true }));
    timeIn.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (durNum) {
    setter.call(durNum, '1');
    durNum.dispatchEvent(new Event('input', { bubbles: true }));
    durNum.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return { d: dose?.value, t: timeIn?.value, dr: durNum?.value };
})()`);
console.log('fill:', JSON.stringify(fill));
await sleep(500);

// Click "Escolher categoria"
const clickCat = await evalCDP(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => /escolher categoria/i.test(b.textContent||''));
  if (!btn) return { fail: true };
  btn.click(); return { clicked: true };
})()`);
console.log('cat click:', JSON.stringify(clickCat));
await sleep(1500);
console.log('shot pré-tap-categoria:', await screenshot(send, 'emul_r3_cat_open'));

process.exit(0);
