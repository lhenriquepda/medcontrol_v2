// Passo 9e: continua com TestMed + fill rest of form
import { connect, screenshot, sleep } from './qa-cdp-helpers.mjs';

const { send, evalCDP } = await connect(9222);

// Click "Continuar com TestMed_v0283"
const click1 = await evalCDP(`(() => {
  const btns = Array.from(document.querySelectorAll('button, [role="button"], div'));
  const target = btns.find(el => /Continuar com.*TestMed/i.test((el.textContent||'').trim()));
  if (!target) return { fail: 'no Continuar' };
  target.click();
  return { clicked: true };
})()`);
console.log('Continuar:', JSON.stringify(click1));
await sleep(1500);

// Calculate target time +15min from now
const now = new Date();
now.setMinutes(now.getMinutes() + 15);
const targetHHMM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
console.log('target HH:MM:', targetHHMM);

// Fill dose unidade + time
const fillRest = await evalCDP(`(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const inputs = Array.from(document.querySelectorAll('input, textarea'));

  // dose/unidade
  const dose = inputs.find(i => /1 comprimido|gotas/i.test(i.placeholder || ''));
  if (dose) {
    setter.call(dose, '1 comp');
    dose.dispatchEvent(new Event('input', { bubbles: true }));
    dose.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // hora 1ª dose
  const timeIn = inputs.find(i => i.type === 'time');
  if (timeIn) {
    setter.call(timeIn, '${targetHHMM}');
    timeIn.dispatchEvent(new Event('input', { bubbles: true }));
    timeIn.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // duração 1 dia
  const durNum = inputs.find(i => i.type === 'number');
  if (durNum) {
    setter.call(durNum, '1');
    durNum.dispatchEvent(new Event('input', { bubbles: true }));
    durNum.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return {
    doseVal: dose?.value, timeVal: timeIn?.value, durVal: durNum?.value,
  };
})()`);
console.log('fillRest:', JSON.stringify(fillRest));
await sleep(800);
console.log('shot pré-submit:', await screenshot(send, 'emul_step9e_pre_submit'));

// Click "Criar tratamento"
const t0 = Date.now();
const submit = await evalCDP(`(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const target = btns.find(b => /^Criar tratamento$/i.test((b.textContent||'').trim()));
  if (!target) return { fail: 'no Criar tratamento btn', all: btns.map(b => b.textContent.trim().slice(0,20)).slice(0,15) };
  if (target.disabled) return { fail: 'btn disabled' };
  target.click();
  return { clicked: true };
})()`);
console.log('submit:', JSON.stringify(submit));

// Poll status
for (let i = 1; i <= 25; i++) {
  await sleep(1000);
  const st = await evalCDP(`(() => ({ pathname: location.pathname, disabled: Array.from(document.querySelectorAll('button')).find(b=>/Criar tratamento/.test(b.textContent||''))?.disabled }))`);
  if (st?.pathname && st.pathname !== '/tratamento/novo') {
    console.log('t=' + i + 's: NAVEGOU pra', st.pathname, '— OK em', Date.now()-t0, 'ms');
    break;
  }
  if (i % 5 === 0) console.log('t=' + i + 's:', JSON.stringify(st));
}

console.log('shot final:', await screenshot(send, 'emul_step9e_final'));
process.exit(0);
